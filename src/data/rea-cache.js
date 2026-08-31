/**
 * The TTL cache primitive — and the register of the only two instances allowed to exist.
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

export function createTtlCache({ name, ttlMs, payoff, now = Date.now } = {}) {
    if (!name) throw new Error('createTtlCache: name is required');
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error(`createTtlCache(${name}): ttlMs must be a positive number`);
    if (typeof payoff !== 'string' || payoff.trim().length < 10) {
        throw new Error(`createTtlCache(${name}): a named payoff is required (keep caching only where it measurably pays)`);
    }

    let value = null;
    let storedAt = null;

    return Object.freeze({
        name,
        ttlMs,
        payoff,
        read() {
            if (storedAt === null) return { fresh: false, value: null, ageMs: null };
            const ageMs = now() - storedAt;
            if (ageMs >= ttlMs) return { fresh: false, value: null, ageMs };
            return { fresh: true, value, ageMs };
        },
        write(next) {
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
