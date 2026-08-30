// The TTL cache primitive — and the register of the only two instances allowed to exist.
//
// DECISIONS.md, "KEEP caching only where it measurably pays", and SCOPE Part 3 §4:
// "Caches survive only with a named payoff — and Ben's rule is measure it, do not assume
// it." So this file is deliberately awkward to use casually: `createTtlCache` demands a
// `payoff` string and throws without one, and the two sanctioned instances are declared
// as data in `DE1_CACHE_SPECS` where a test can count them.
//
// WHAT THE OLD MODULE HAD, and the verdict on each (scope/e2-api.md, "Caching: keep two,
// delete three"):
//
//   de1SettingsCache          60 s  KEEP     — see the payoff below
//   de1AdvancedSettingsCache  40 s  KEEP     — same
//   reatsettingscache         40 s  DELETE   — it lies. `GET /api/v1/settings`
//                                   (`settings_handler.dart`) assembles 22 in-memory
//                                   scalars with ZERO I/O — no device read, no disk, no
//                                   network beyond the request itself. Caching it saves
//                                   nothing and costs staleness, and it was never
//                                   invalidated: `setReaSettings` did not touch it, only
//                                   `ensureGatewayModeTracking` did — the one setting
//                                   nobody edits by hand — so every setting changed from
//                                   the settings page read back PRE-CHANGE for up to 40 s.
//   currentShotSettings        —    DELETE   — a write-only mirror. Its only reader,
//                                   `sendShotSettings`, has no caller anywhere.
//   local shot-list mirroring  —    DELETE   — ReaPrime serves ETag/304 on the lists the
//                                   skin reads; revalidation replaces the mirror
//                                   (rea-conditional.js).
//
// ONE DIFFERENCE FROM THE OLD CACHES THAT IS NOT A PORT: the old `getDe1Settings`
// returned EXPIRED cached data from its catch block when the request failed
// ("Return cached data if available, even if expired, to avoid breaking functionality").
// That is a fallback path — A7 — and it is the exact shape of the defect this wave
// exists to kill: a stale value standing in for a dead server, indistinguishable on
// screen from a live one. Here a failed read is a failure. The cache answers only from a
// FRESH entry, and never on the error path.

/**
 * FREEZE WHAT IS CACHED, ALL THE WAY DOWN.
 *
 * Both caches in this layer — the TTL caches here and the 304 replay store in
 * rea-conditional.js — hand out the SAME object to every reader, so a caller that adapted a
 * result in place changed what the next cache hit and the next 304 replay reported as the
 * server's answer. `a.data.fan = 999` followed by a second read inside the TTL returned
 * `fan = 999, fromCache: true`; a `push` into a list body was replayed verbatim on the next
 * 304. That is a locally-modified body presented as ReaPrime's, which is the defect class
 * this wave exists to kill, arriving through the one door nobody watches.
 *
 * A copy on read would cost a deep clone per hit and still let the FIRST holder mutate the
 * cached object. Freezing on write costs one walk per stored body and makes the mutation
 * itself loud: every module here is an ES module, so assignment to a frozen property throws
 * rather than silently doing nothing. The result envelope was already frozen
 * (`rea-errors.js`); this is the half that was missing.
 *
 * JSON.parse output is a tree with no cycles, but the `seen` set costs nothing and means an
 * injected fixture cannot hang the cache.
 */
export function freezeDeep(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && 'value' in descriptor) freezeDeep(descriptor.value, seen);
    }
    return Object.freeze(value);
}

/**
 * A single-value cache with a TTL and explicit invalidation.
 *
 * @param {object} spec
 * @param {string} spec.name
 * @param {number} spec.ttlMs
 * @param {string} spec.payoff   why this cache exists, in one line. Required.
 * @param {Function} [spec.now]  injected clock; tests do not sleep.
 */
export function createTtlCache({ name, ttlMs, payoff, now = Date.now } = {}) {
    if (!name) throw new Error('createTtlCache: name is required');
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error(`createTtlCache(${name}): ttlMs must be a positive number`);
    if (typeof payoff !== 'string' || payoff.trim().length < 10) {
        throw new Error(`createTtlCache(${name}): a named payoff is required (DECISIONS.md — keep caching only where it measurably pays)`);
    }

    let value = null;
    let storedAt = null;

    return Object.freeze({
        name,
        ttlMs,
        payoff,
        /**
         * @returns {{fresh: boolean, value: unknown, ageMs: number|null}}
         *          `fresh: false` means GO TO THE SERVER. It never means "here is an old
         *          value you may use anyway" — `value` is null unless fresh.
         */
        read() {
            if (storedAt === null) return { fresh: false, value: null, ageMs: null };
            const ageMs = now() - storedAt;
            if (ageMs >= ttlMs) return { fresh: false, value: null, ageMs };
            return { fresh: true, value, ageMs };
        },
        write(next) {
            // Frozen deeply, so the value handed to the next reader is the one the server
            // sent and a caller that edits it fails loudly at the edit.
            value = freezeDeep(next);
            storedAt = now();
            return value;
        },
        /** Write-through invalidation. The next read goes to the machine. */
        invalidate() {
            value = null;
            storedAt = null;
        },
        /** Diagnostics only — never a read path. */
        get state() {
            return Object.freeze({ name, ttlMs, storedAt, hasValue: value !== null });
        },
    });
}

/**
 * The two sanctioned caches, as data.
 *
 * The payoff is structural and was checked against the handlers at ReaPrime
 * 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3, not assumed:
 *
 *  * There is NO push stream for either settings surface. `websocket_v1.yml` has no
 *    machine-settings socket; the nine `/ws/v1/...` routes carry snapshots, shot settings,
 *    water levels, raw, shot state, scale, sensors, devices, display and update. So there
 *    is nothing cheap to poll and nothing to subscribe to.
 *  * Neither GET is conditional. `de1handler.dart` returns plain `jsonOk` from both
 *    `GET /api/v1/machine/settings` and `GET /api/v1/machine/settings/advanced` — no
 *    `jsonOkConditional`, so no ETag, so revalidation is not available as it is for the
 *    lists.
 *  * The read is genuinely expensive: it is serialized MMR reads over BLE — NINE awaited
 *    device reads for the base settings (`getFanThreshhold`, `getUsbChargerMode`,
 *    `getFlushTemperature`, `getFlushTimeout`, `getFlushFlow`, `getHotWaterFlow`,
 *    `getSteamFlow`, `getTankTempThreshold`, `getSteamPurgeMode`) and SIX for advanced
 *    (`getHeaterPhase1Flow`, `getHeaterPhase2Flow`, `getHeaterIdleTemp`,
 *    `getHeaterPhase2Timeout`, `getHeaterVoltage`, `getRefillKitSettings`) — fifteen in
 *    total, which is the "15 serialized MMR reads" the scope cites, counted here per
 *    route because that is the number each cache actually spares.
 *
 * BENCH ITEM, not asserted: the wall-clock cost of those fifteen reads on the machine.
 * The structural argument stands on its own — there is nothing else to do but cache or
 * refetch — but the TTLs (60 s / 40 s) are inherited numbers and deserve one measurement.
 */
export const DE1_CACHE_SPECS = Object.freeze([
    Object.freeze({
        key: 'machineSettings',
        name: 'de1SettingsCache',
        ttlMs: 60000,
        route: '/machine/settings',
        deviceReads: 9,
        payoff: 'GET /machine/settings is nine serialized MMR reads over BLE, has no push stream and no ETag; the settings screen reads it on every entry.',
    }),
    Object.freeze({
        key: 'machineSettingsAdvanced',
        name: 'de1AdvancedSettingsCache',
        ttlMs: 40000,
        route: '/machine/settings/advanced',
        deviceReads: 6,
        payoff: 'GET /machine/settings/advanced is six serialized MMR reads over BLE, has no push stream and no ETag; the advanced pane reads it on every entry.',
    }),
]);
