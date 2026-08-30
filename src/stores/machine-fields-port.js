/**
 * machine-fields-port.js — one `{read, write}` port over TWO machine documents.
 * Wave 5.4, row `d9-calibration-surfaces` (the flow-calibration factor's half).
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHY IT IS A TABLE RATHER THAN AN `if`
 * ===========================================================================
 *
 * `settings-leaf-model.js` takes ONE machine port — `{read(), write(patch)}` — and a
 * registry row with `source: 'machine'` names a FIELD of it. That is deliberate: the model
 * branches on the row's declared source, never on anything a call site chose, which is
 * what makes "one store per setting" (B7) a property of the table instead of a habit.
 *
 * D9 asks for the flow-calibration factor on `calibration-flow-multiplier`, a PRIMITIVE
 * leaf, so it wants to be a stepper row on #29 like every other machine number. But it
 * does not live in `GET /api/v1/machine/settings`; it lives behind its own pair,
 * `GET`/`POST /api/v1/machine/calibration` (`de1handler.dart:464`, `:472` at pin
 * 2b047d02 — re-anchored 21 Aug; `:463` and `:471` are blank), which is why the registry
 * had it as a PENDING row.
 *
 * The two wrong answers, named so nobody re-proposes them:
 *
 *   (a) a bespoke leaf for one number — §4.4 lists NINE leaves that need their own
 *       layout and this is not one of them; a tenth would be the one-primitive claim
 *       leaking, for a row that is a plain stepper.
 *   (b) a second `source` in the registry — the vocabulary would grow a member for every
 *       machine document the skin ever reads, and each new member is a new branch in the
 *       model AND in the renderer. The renderer has five archetype branches and a test
 *       that both directions are exhausted; adding sources is how that stops being true.
 *
 * So the SPLIT MOVES DOWN, to the layer whose whole job is "which door does this value go
 * through". `FIELD_DOORS` below is a frozen field -> door map, exactly the shape
 * `storage-routes.js` has one storey up for browser storage. Reading it is how you learn
 * where `flowMultiplier` goes; there is no call site that decides.
 *
 * ONE OWNER PER FIELD IS ASSERTED, NOT ASSUMED. `test/settings-bespoke.test.mjs` checks
 * that no field appears in two doors and that every routed field names a door that this
 * port actually has.
 *
 * ===========================================================================
 * WHAT A FAILED HALF DOES
 * ===========================================================================
 *
 * `read()` merges both documents and a door that fails contributes NOTHING rather than
 * nulls — an absent field is the address layer's absence and renders as such, while a
 * field present with a null value would be a machine claiming to hold nothing.
 *
 * `write()` sends only the doors the patch actually names: a patch of settings fields
 * alone never touches `/machine/calibration`. It reports `true` only when every door it
 * used said yes, because D11's commit clears the staged intents on `true` and a partial
 * success that reported `true` would silently drop the half that failed.
 *
 * NO DOM, NO ROUTE PATH. The calibration door is `calibration-store.js`; the settings door
 * is `rea-de1-settings.js` through `machinePortFor`.
 */

/**
 * Fields that do NOT live in the DE1 settings document, and the door each one takes.
 *
 * IT WAS ONE ENTRY AND IT IS NOW EIGHTEEN, which is the sentence the first version of
 * this file predicted: "it is a table rather than a special case because the second entry
 * is the one that turns a special case into a bug". Four doors joined the two, each one
 * a document ReaPrime already serves and no client addressed:
 *
 *   advanced   GET/POST /api/v1/machine/settings/advanced — the four heater numbers and
 *              the two enums. `rea-de1-settings.js` has carried `readAdvancedSettings`
 *              and `writeAdvancedSettings` since wave 0b; nothing called either.
 *   app        GET/POST /api/v1/settings — ReaPrime's OWN preferences, which are not the
 *              machine's and not this skin's. Scale power, charging, night mode, the two
 *              app-side flow multipliers.
 *   workflow   GET/PUT /api/v1/workflow — steam and hot-water TARGETS. The route
 *              deep-merges, and `De1Controller.updateWorkflowSettings` writes the changed
 *              group through to the DE1, so this is a real machine write and not a
 *              preference (workflow_handler.dart `_applyUpdate`, de1_controller.dart:531).
 *
 * WHY NOT `POST /machine/shotSettings` FOR THE TARGETS, which is where the registry's
 * pending entries pointed. Read at the pin: `De1ShotSettings.fromJson` calls `parseInt`
 * on all EIGHT fields and `parseInt` ends in `int.parse(value)`, which THROWS on a
 * missing key (de1_interface.dart:151-162, models/data/utils.dart:14-18). That route is a
 * whole-document write with no partial form — sending one target zeroes the other seven.
 * Slate survives it by keeping every field cached off the shotSettings socket and posting
 * all eight (api.js `sendShotSettings`). The workflow door takes a patch, so the read-
 * modify-write and the socket it depends on are not needed at all.
 */
export const FIELD_DOORS = Object.freeze({
    flowMultiplier: 'calibration',

    /* POST /machine/settings/advanced. The six keys `DE1_ADVANCED_WRITE_KEYS` names. */
    heaterPh1Flow: 'advanced',
    heaterPh2Flow: 'advanced',
    heaterIdleTemp: 'advanced',
    heaterPh2Timeout: 'advanced',
    heaterVoltage: 'advanced',
    refillKitSetting: 'advanced',

    /* POST /settings. ReaPrime's preferences — see `rea-app-settings.js` for the two
     * enum vocabularies and the one range the handler enforces. */
    weightFlowMultiplier: 'app',
    volumeFlowMultiplier: 'app',
    /* THE HOT-WATER LOOKAHEAD, added 26 August 2026 with the row that finally shows it.
     * `hot_water_sequencer.dart:117-118` reads it as `lookaheadSeconds`, so without a
     * control a Bengle stopped hot water at weight using an invisible 0.3 s lead nobody
     * could see or tune — while the two SIBLING multipliers were already on Calibration. */
    hotWaterFlowMultiplier: 'app',
    scalePowerMode: 'app',
    blockOnNoScale: 'app',
    /* THE HOT-WATER STOP POLICY, and the reason recorded for NOT adopting this door was
     * stale: `stopHotWaterAtWeight` is served by GET /settings, accepted by POST /settings,
     * and read by `hot_water_sequencer.dart:106`. Until this row existed the Hot water stop
     * bank wrote a local string and the machine went on stopping by whatever it already
     * held. */
    stopHotWaterAtWeight: 'app',
    gatewayMode: 'app',
    logLevel: 'app',
    automaticUpdateCheck: 'app',
    /* READ-ONLY THROUGH THE SAME DOOR. `webUiPath` is served by `GET /settings` and the
     * page prints it; it is NOT in `APP_SETTINGS_WRITE_KEYS`, so the door's own `pick`
     * drops it on the way out and a write can never reach the handler. Re-pointing the
     * server at another folder is how a skin removes itself from the screen. */
    webUiPath: 'app',
    chargingMode: 'app',
    nightModeEnabled: 'app',
    nightModeSleepTime: 'app',
    nightModeMorningTime: 'app',
    lowBatteryBrightnessLimit: 'app',

    /* PUT /workflow. FLAT NAMES FOR A NESTED DOCUMENT, and the flattening is the door's,
     * not a caller's — see `workflowDoorFor`. */
    steamTargetTemperature: 'workflow',
    steamDuration: 'workflow',
    /* THE MILK-PROBE STOP, added 26 August 2026 with the steam-stop bank that arms it.
     * `steam_sequencer.dart:134-140` reads `wf.steamSettings.stopAtTemperature` and returns
     * immediately when it is `<= 0`, so this field IS the Milk Temp mode; the Live rail has
     * read and written it through `workflow-targets.js` since the rail was built, and the
     * settings page had no way to reach it at all. */
    milkStopTemp: 'workflow',
    hotWaterTargetTemperature: 'workflow',
    hotWaterDuration: 'workflow',
    hotWaterVolume: 'workflow',
    /* THE FOUR THE LIVE RAIL ALREADY READ OFF THIS DOCUMENT, and the settings page was
     * reading off `/machine/settings` — one setting, two doors.
     *
     * Both doors write the SAME MMR registers: `updateWorkflowSettings` calls
     * `setFlushTimeout` / `setFlushFlow` / `setFlushTemperature`, which is exactly what
     * `POST /machine/settings` writes. What differs is what happens AFTERWARDS. POST
     * /machine/settings does not update the cached workflow document, so a flush temperature
     * changed on the Settings page left the Live rail showing the old number until something
     * re-synced. That is B7's "two stores for one setting" with the stores one level down,
     * and it is the same defect the `steamDuration` row was moved to close on 26 August.
     *
     * ONE DOOR PER FIELD, and the door is the one `workflow-targets.js` already uses, so the
     * two surfaces read and write the same document. `test/settings-doors.test.mjs` holds the
     * two tables together: a key in both `SCALAR_FIELDS` and a settings row must be
     * `workflow` here. */
    steamFlow: 'workflow',
    flushTemp: 'workflow',
    flushFlow: 'workflow',
    flushTimeout: 'workflow',

    /* POST /machine/waterLevels. THE ONE DOOR WITH NO REST READ — see `waterLevelsDoorFor`
     * below. `refillLevel` is the tank's low-water alert height. */
    refillLevel: 'waterLevels',

    /* GET/POST /presence/settings. The sleep policy — the SCHEDULES beside it are a list
     * and stay bespoke. */
    autoSleepEnabled: 'presence',
    sleepAfterMinutes: 'presence',

    /* GET/PUT /machine/cupWarmer and /cupWarmer/preheat. Two routes, one door — the
     * cup-warmer STORE already owns both and the split is its business, not the
     * registry's. */
    cupWarmerTemperature: 'cupWarmer',
    cupWarmerCurrentTemperature: 'cupWarmer',
    cupWarmerPreheatEnabled: 'cupWarmer',
    cupWarmerPreheatLead: 'cupWarmer',
    /* READ-ONLY, LIKE `measuredVoltage`: whether the firmware answers the pre-heat route at
     * all is a FACT about the machine, not a setting, and no control writes it. It is on
     * this table because the two pre-warm rows are drawn inert against it, and because a
     * field with no door would be a field the port silently dropped. */
    cupWarmerPreheatSupported: 'cupWarmer',

    /* GET /machine/info. READ-ONLY, and the only field of its kind here: the measured
     * mains voltage is a MEASUREMENT, not a setting, and no control writes it. It is on
     * this table because the Voltage page prints it beside the choice it is evidence for,
     * and because a field with no door would be a field the port silently dropped. */
    measuredVoltage: 'machineInfo',
});

/** Every door name this port knows how to open. The suite checks the table against it. */
export const DOORS = Object.freeze([
    'settings', 'calibration', 'advanced', 'app', 'workflow', 'waterLevels', 'machineInfo',
    'cupWarmer', 'presence',
]);

/**
 * The workflow document's nested addresses, by the flat field name the registry uses.
 *
 * Exported because the door below reads it in BOTH directions and a test reads it too. A
 * second copy of "steam temperature lives at steamSettings.targetTemperature" is exactly
 * the duplication `FIELD_DOORS` exists to prevent, one level down.
 */
export const WORKFLOW_FIELD_PATHS = Object.freeze({
    steamTargetTemperature: Object.freeze(['steamSettings', 'targetTemperature']),
    steamFlow: Object.freeze(['steamSettings', 'flow']),
    steamDuration: Object.freeze(['steamSettings', 'duration']),
    milkStopTemp: Object.freeze(['steamSettings', 'stopAtTemperature']),
    hotWaterTargetTemperature: Object.freeze(['hotWaterData', 'targetTemperature']),
    hotWaterDuration: Object.freeze(['hotWaterData', 'duration']),
    hotWaterVolume: Object.freeze(['hotWaterData', 'volume']),
    /* THE FLUSH BLOCK. `rinseData` is ReaPrime's name for it and `flushTimeout` is this
     * skin's name for its duration — the settings row has been spelled that way since the
     * DE1 settings document was the door, and renaming it would move the row's `field`,
     * its fallback and the ABI mirrors with it. The flat name is the registry's; the path
     * is the document's; this table is the one place they meet. */
    flushTemp: Object.freeze(['rinseData', 'targetTemperature']),
    flushFlow: Object.freeze(['rinseData', 'flow']),
    flushTimeout: Object.freeze(['rinseData', 'duration']),
});

/**
 * A `{read, write}` door over the workflow store.
 *
 * The store holds the whole document and already owns `PUT /workflow`; this only maps
 * three flat names on and off it. A patch becomes the smallest nested object that names
 * the changed leaves, because the handler DEEP-MERGES (`deepMergeJson(currentJson,
 * merge)`) — sending a whole `hotWaterData` would overwrite the flow and duration nobody
 * touched.
 *
 * @param {object|null} workflow  `createWorkflowStore(...)`
 */
export function workflowDoorFor(workflow) {
    if (!workflow || typeof workflow.load !== 'function' || typeof workflow.apply !== 'function') return null;
    return Object.freeze({
        async read() {
            await workflow.load();
            const document = workflow.get?.().workflow ?? null;
            if (!document || typeof document !== 'object') return {};
            const out = {};
            for (const [field, [group, leaf]] of Object.entries(WORKFLOW_FIELD_PATHS)) {
                const value = document[group]?.[leaf];
                /* ABSENT STAYS ABSENT, as at the calibration door: a machine that has not
                 * answered is not a machine holding zero. */
                if (Number.isFinite(value)) out[field] = value;
            }
            return out;
        },
        async write(patch) {
            const merge = {};
            for (const [field, value] of Object.entries(patch)) {
                const path = WORKFLOW_FIELD_PATHS[field];
                if (!path) return false;
                const [group, leaf] = path;
                merge[group] = { ...(merge[group] ?? {}), [leaf]: value };
            }
            if (Object.keys(merge).length === 0) return false;
            /* `apply` answers with the STORE STATE, not a result envelope: a refused write
             * publishes the previous document with `writeError` set, and a successful one
             * publishes the server's own reply with `writeError` null. So the verdict is
             * read off the state, and the state is the document the machine actually
             * holds — which is what makes the model's re-read show a clamp rather than
             * the number that was asked for. */
            const state = await workflow.apply(merge, { label: 'settings targets' });
            return Boolean(state && state.writeError === null);
        },
    });
}

/**
 * A `{read, write}` door over the machine's sleep policy.
 *
 * TWO OF THE PAGE, NOT THE PAGE. Sleep and Wake carries a sleep policy and a LIST of wake
 * schedules; the list needs a layout nothing else has and stays bespoke, while the policy
 * is two ordinary settings rows and had been drawn by hand beside it. Ben, 26 August 2026:
 * "the card layout is not like the rest of the settings, needs a rewrite" — and the
 * rewrite for the half that IS rows is to make them rows.
 *
 * `userPresenceEnabled` IS THE AUTOMATIC-SLEEP SWITCH. The field is named for the
 * mechanism (the machine watches for use) and the setting is named for the effect (it goes
 * to sleep on its own), which is Ben's own wording: "a toggle, on/off, puts the machine to
 * sleep after a period of inactivity". The name a user reads should say what happens to
 * them, so the row's heading is the effect and this is the one place the two names meet.
 *
 * THE STORE VALIDATES AND THIS DOES NOT. `setSleepTimeout` rounds to a whole integer
 * because the handler tests `v is! int` and refuses a Dart float; that boundary is the
 * store's and is not repeated here.
 *
 * @param {object|null} store  `createPresenceStore(...)`
 */
export function presenceDoorFor(store) {
    if (!store || typeof store.load !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.load();
            const state = store.get?.() ?? null;
            const out = {};
            if (typeof state?.presenceEnabled === 'boolean') out.autoSleepEnabled = state.presenceEnabled;
            if (Number.isFinite(state?.sleepTimeoutMinutes)) out.sleepAfterMinutes = state.sleepTimeoutMinutes;
            return out;
        },
        async write(patch) {
            const results = [];
            if (Object.hasOwn(patch, 'autoSleepEnabled')) {
                results.push(await store.setPresenceEnabled(Boolean(patch.autoSleepEnabled)));
            }
            if (Object.hasOwn(patch, 'sleepAfterMinutes')) {
                results.push(await store.setSleepTimeout(Number(patch.sleepAfterMinutes)));
            }
            if (results.length === 0) return false;
            return results.every(Boolean);
        },
    });
}

/**
 * A `{read, write}` door over the cup warmer and its scheduled pre-warm.
 *
 * THE PAGE HAD A BESPOKE LAYOUT AND DID NOT NEED ONE. Ben, 26 August 2026, asked for
 * Slate's order and Slate's shape on this leaf — "enable, target, then the pre-warm pair"
 * — which is four ordinary settings rows. Every one of them was drawn by hand in
 * `settings-bespoke-leaf.js` because the values came from two routes the leaf model could
 * not reach. This door is what lets them be rows, and the bespoke section for this leaf is
 * gone with them.
 *
 * `cupWarmerTemperature` IS BOTH THE TARGET AND THE SWITCH, and that is the machine's own
 * shape rather than a compression invented here: `cup-warmer.js` states it — the machine
 * "holds only the live value (0 when off)". So the page draws a `zeroSwitch` row over it,
 * exactly as the steam and water-tank pages do over theirs, and `cupWarmerTarget` in the
 * KV store remembers what to come back to.
 *
 * WRITING ZERO IS NOT HOW IT IS SWITCHED OFF, and the store says why in as many words:
 * `{temperature: 0}` would ENABLE the warmer at a 0 °C setpoint, because the handler calls
 * `setCupWarmerEnabled(true)` whenever a temperature arrives without an explicit enable.
 * So a write of zero becomes `setEnabled(false)` and a write above zero becomes
 * `setTarget(value, {enabled: true})` — the intent stated explicitly, which is what the
 * store's own note asks callers to do.
 *
 * @param {object|null} store  `createCupWarmerStore(...)`
 */
export function cupWarmerDoorFor(store) {
    if (!store || typeof store.refresh !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.refresh();
            const state = store.get?.() ?? null;
            const out = {};
            /* THE SETPOINT IS `temperature`, AND IT USED TO READ `currentTemperature`.
             *
             * `GET /machine/cupWarmer` serves BOTH: `temperature` is `matSetPoint`, the
             * number the page is for, and `currentTemperature` is the live reading off the
             * plate — `Future<double?>`, null whenever the warmer is off. This door read
             * the LIVE one and handed it over as the setting, so the Target temperature
             * stepper displayed however warm the mat happened to be, and pressing + moved
             * from there rather than from the target. Found on 26 August 2026 by
             * photographing the page beside Slate's, which prints the two as separate rows.
             *
             * THE LIVE ONE IS CARRIED TOO, under its own name, for the reading row that
             * shows it. An absent or null reading stays absent: null means "no reading",
             * which is what the machine says when the warmer is off, and it must never
             * become a zero. */
            const target = state?.warmer?.temperature;
            const live = state?.warmer?.currentTemperature;
            const enabled = state?.warmer?.enabled;
            /* THE FIELD IS THE SETPOINT, AND "OFF" IS ZERO. A warmer that reports a
             * temperature while `enabled` is false is a mat coasting down from its last
             * setpoint, not a setting — so the SETTING reads zero and the switch reads
             * off, which is the one answer the page can act on. */
            if (Number.isFinite(target)) out.cupWarmerTemperature = enabled === false ? 0 : target;
            else if (enabled === false) out.cupWarmerTemperature = 0;
            /* AND THE SETPOINT THE MACHINE IS STILL HOLDING, UNDER ITS OWN NAME — audit
             * F-049's third face, Ben's decision D09 (30 August 2026).
             *
             * The line above is right and stays: the SETTING is zero when the warmer is
             * off, because that is the one answer the page can act on. But it means the
             * machine's own remembered target is invisible to everything above this door,
             * and the `zeroSwitch` restore ladder needs it. MEASURED: a warmer holding
             * `{"temperature":70,"enabled":false}` — the real tablet's own closing state —
             * switched back on from the glass was written 60, because the ladder reached
             * `STORED_DEFAULTS.cupWarmerTarget` before it reached the machine. A real 70
             * overwritten by a shipped 60, with no word on the glass.
             *
             * THIS IS THE ONE FIELD OF THE THREE `zeroSwitch` ROWS THAT CAN HAVE ONE.
             * Steam and the water tank say "off" by putting a zero IN the field, so there
             * is no held number to publish; the cup warmer is the only one whose off is a
             * separate `enabled` flag, which is exactly why it is the only one the audit
             * could catch this on. `settings-leaves.js` names it as that row's `heldField`.
             *
             * IT IS NOT A SETTING AND NOTHING WRITES IT. `write()` below has no branch for
             * it: it is a reading of what the machine remembers, published so the ladder
             * can ask rather than guess. */
            if (Number.isFinite(target)) out.cupWarmerHeldTarget = target;
            if (Number.isFinite(live)) out.cupWarmerCurrentTemperature = live;
            if (typeof state?.preheat?.enabled === 'boolean') {
                out.cupWarmerPreheatEnabled = state.preheat.enabled;
            }
            if (Number.isFinite(state?.preheat?.leadMinutes)) {
                out.cupWarmerPreheatLead = state.preheat.leadMinutes;
            }
            /* WHETHER THE FIRMWARE CAN PRE-WARM AT ALL, and the store has computed it since
             * gate 4 with nothing outside the store reading it.
             *
             * `refresh()` sets `preheatSupported` true, false or null from the HANDLER'S OWN
             * 404 — which is a stronger answer than the capability list, and stronger than
             * Slate's, which infers support from the shape of a payload. Two finished halves
             * with no other half, in the file this fork exists to clean.
             *
             * WHAT IT COST: `MACHINE_FALLBACKS` carried `cupWarmerPreheatEnabled: true`, so
             * on a machine that had 404'd the pre-heat route the switch painted ON with its
             * lead stepper live and no caveat anywhere — a control claiming a machine does
             * something it cannot, which is exactly what A3 exists to prevent. Slate refuses
             * this by construction: `supported === false` renders the toggle disabled and
             * prints the sentence.
             *
             * TRI-STATE, AND ONLY `false` IS A VERDICT. Null means the route has not been
             * asked yet, and the rows stay live rather than accusing a machine of a fault
             * before anybody has spoken to it. A boolean is carried; null is simply absent,
             * which is this port's own contract for "no answer". */
            if (typeof state?.preheatSupported === 'boolean') {
                out.cupWarmerPreheatSupported = state.preheatSupported;
            }
            return out;
        },
        async write(patch) {
            const results = [];
            if (Object.hasOwn(patch, 'cupWarmerTemperature')) {
                const value = Number(patch.cupWarmerTemperature);
                results.push(value > 0
                    ? await store.setTarget(value, { enabled: true })
                    : await store.setEnabled(false));
            }
            const preheat = {};
            if (Object.hasOwn(patch, 'cupWarmerPreheatEnabled')) {
                preheat.enabled = Boolean(patch.cupWarmerPreheatEnabled);
            }
            if (Object.hasOwn(patch, 'cupWarmerPreheatLead')) {
                preheat.leadMinutes = Number(patch.cupWarmerPreheatLead);
            }
            if (Object.keys(preheat).length > 0) results.push(await store.setPreheat(preheat));
            if (results.length === 0) return false;
            return results.every((result) => result && result.ok !== false);
        },
    });
}

/**
 * A READ-ONLY door over `GET /machine/info`, for the one measured value a settings page
 * shows.
 *
 * IT REFUSES EVERY WRITE, AND THAT IS THE POINT. The machine reports its mains voltage;
 * nothing sets it. A door that answered `true` to a write would make the port report a
 * successful commit for a value that went nowhere — the silent-revert class this whole
 * layer exists to remove — so it answers `false` and the commit reports a failure. No
 * control on any page writes this field, so the refusal is unreachable by design and is
 * here to stay unreachable.
 *
 * THE PATH IS THE STORE'S. `machine-info-store.js` owns `GET /machine/info` and its own
 * cache; this maps one key off the body it already holds.
 *
 * @param {object|null} store  `createMachineInfoStore(...)`
 */
export function machineInfoDoorFor(store) {
    if (!store || typeof store.load !== 'function') return null;
    return Object.freeze({
        async read() {
            await store.load();
            const value = Number(store.info?.()?.extra?.voltage);
            /* THE BAND IS SLATE'S SANITY CHECK, not a range: `settings.js:5147` accepts
             * 80..280 V and prints nothing outside it. A machine reporting 3 V is a
             * machine that has not measured, and printing it beside "consistent with
             * 110V" would be evidence for a choice nobody should make on it. */
            return Number.isFinite(value) && value >= 80 && value <= 280
                ? { measuredVoltage: Math.round(value) }
                : {};
        },
        async write() { return false; },
    });
}

/**
 * A `{read, write}` door over the tank's low-water alert level.
 *
 * THE ONE DOOR WHOSE READ IS NOT A REST CALL, and it is worth saying why rather than
 * leaving the asymmetry to be discovered. ReaPrime serves `refillLevel` on the
 * `/ws/v1/machine/waterLevels` SOCKET and offers no GET beside the POST: the generated
 * route table has exactly one row for the path (`postMachineWaterLevels`,
 * rea-routes.generated.js:939). So the read side is the live feed's last frame — which is
 * the same value, arriving by the only door there is — and the write side is the POST.
 *
 * AN ABSENT FRAME IS AN ABSENT VALUE, not a zero: a socket that has not spoken yet leaves
 * the field out of the document entirely, and the model then shows the decided fallback
 * (settings-defaults.js `refillLevel`) exactly as it does for a machine that has not
 * answered a REST read. Zero is a real setting here — no alert — and must not be a
 * stand-in for silence.
 *
 * THE POST CARRIES ONLY `refillLevel`. The handler's own summary says so ("Only the
 * refillLevel field is used"), so `currentLevel` is not sent: the tank's actual level is
 * the machine's to measure and a client that echoed it back would be claiming to know it.
 *
 * @param {object} deps
 * @param {object|null} deps.feed     the FEED.WATER feed store — `{get()}` over the frame
 * @param {Function|null} deps.post   `(body) => Promise<any>` for postMachineWaterLevels
 */
export function waterLevelsDoorFor({ feed = null, post = null } = {}) {
    if (!feed || typeof feed.get !== 'function' || typeof post !== 'function') return null;
    return Object.freeze({
        async read() {
            const frame = feed.get()?.frame ?? null;
            const value = frame?.refillLevel;
            return Number.isFinite(value) ? { refillLevel: value } : {};
        },
        async write(patch) {
            const value = patch?.refillLevel;
            if (!Number.isFinite(value)) return false;
            try {
                await post({ refillLevel: value });
                return true;
            } catch {
                return false;
            }
        },
    });
}

/**
 * @param {object} deps
 * @param {object|null} deps.settings     `machinePortFor(createDe1SettingsClient(...))`
 * @param {object|null} deps.calibration  `createCalibrationStore(...)`
 * @param {object|null} deps.advanced     a `{read, write}` — `advancedPortFor(client)`
 * @param {object|null} deps.app          a `{read, write}` — `createAppSettingsClient(...)`
 * @param {object|null} deps.workflow     a `{read, write}` — `workflowDoorFor(store)`
 * @param {object|null} deps.waterLevels  a `{read, write}` — `waterLevelsDoorFor({...})`
 * @param {object|null} deps.machineInfo  a `{read, write}` — `machineInfoDoorFor(store)`
 * @param {object|null} deps.cupWarmer   a `{read, write}` — `cupWarmerDoorFor(store)`
 * @param {object|null} deps.presence    a `{read, write}` — `presenceDoorFor(store)`
 * @returns {object|null} a `{read, write}` port, or null when no door exists
 */
export function createMachineFieldsPort({
    settings = null, calibration = null, advanced = null, app = null, workflow = null,
    waterLevels = null, machineInfo = null, cupWarmer = null, presence = null,
} = {}) {
    /* EVERY DOOR IS NORMALISED HERE AND NOWHERE ELSE. Two of the five have a shape of
     * their own — the settings port predates this file, and the calibration store is a
     * store rather than a client — so the adapting happens once, at construction, and the
     * read and write below are a loop over one uniform interface. The alternative is what
     * this file used to be: one `if` per door in `read()` and another in `write()`, which
     * is two places to forget a door and the reason the third door would have been a bug. */
    const doors = {};

    if (settings && typeof settings.read === 'function') {
        doors.settings = Object.freeze({
            read: () => settings.read(),
            write: (patch) => (typeof settings.write === 'function' ? settings.write(patch) : false),
        });
    }

    if (calibration && typeof calibration.readFlow === 'function') {
        doors.calibration = Object.freeze({
            async read() {
                await calibration.readFlow();
                const value = calibration.get().flowMultiplier;
                /* ABSENT STAYS ABSENT. `readFlow` sets null both for "the machine has no
                 * answer" and for "the request failed", and neither is a value; the key is
                 * simply not added, so the row shows the dash rather than a zero. */
                return Number.isFinite(value) ? { flowMultiplier: value } : {};
            },
            write(patch) {
                if (typeof calibration.writeFlow !== 'function') return false;
                return calibration.writeFlow(patch.flowMultiplier);
            },
        });
    }

    for (const [name, door] of Object.entries({
        advanced, app, workflow, waterLevels, machineInfo, cupWarmer, presence,
    })) {
        if (door && typeof door.read === 'function' && typeof door.write === 'function') {
            doors[name] = Object.freeze({ read: () => door.read(), write: (patch) => door.write(patch) });
        }
    }

    if (Object.keys(doors).length === 0) return null;

    return Object.freeze({
        /** Which doors this port actually has. Diagnostics and the suite — never a branch. */
        get open() { return Object.freeze(Object.keys(doors).sort()); },

        async read() {
            const out = {};
            /* SEQUENTIAL, NOT `Promise.all`. The advanced and settings doors share one
             * TTL cache pair and the workflow door writes through the same transport;
             * reading them in parallel buys milliseconds and costs a reproducible order
             * in every capture. */
            for (const door of Object.values(doors)) {
                let document = null;
                try {
                    document = await door.read();
                } catch {
                    /* A door that throws contributes NOTHING, exactly as a door that
                     * fails does. The model's own read is what reports the absence. */
                    document = null;
                }
                if (document && typeof document === 'object') Object.assign(out, document);
            }
            return out;
        },

        async write(patch) {
            if (!patch || typeof patch !== 'object') return false;

            const byDoor = new Map();
            for (const [field, value] of Object.entries(patch)) {
                const name = FIELD_DOORS[field] ?? 'settings';
                if (!byDoor.has(name)) byDoor.set(name, {});
                byDoor.get(name)[field] = value;
            }

            const results = [];
            for (const [name, doorPatch] of byDoor) {
                const door = doors[name];
                /* A patch naming a door this port does not have is a FAILURE, not a
                 * skip: `commit()` clears the staged intents on true, so reporting
                 * success for a value that never left the tablet is the silent-revert
                 * class this whole layer exists to stop. */
                if (!door) return false;
                results.push(await door.write(doorPatch));
            }

            /* Every door said yes, and there was at least one door. An empty patch is not
             * a successful write of nothing — the model never sends one, and if it did,
             * reporting `true` would clear staged intents that were never posted. */
            return results.length > 0 && results.every(Boolean);
        },
    });
}
