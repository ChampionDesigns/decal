// The settings store — B7 at volume, and the spine every settings leaf reads and writes
// through.
//
// SCOPE Part 5 §4: "**B7 (accepted): one store per setting, never two.** Machine-scoped
// settings (steam stop mode, tank units, experimental channels…) live in ReaPrime's KV
// store; only genuinely device-scoped preferences stay local."
//
// This module is the volume answer to the same problem `units.js` solves for one key. It
// adds NO storage policy of its own: the layer for every key is looked up in
// `../lib/storage-routes.js` through `../lib/storage-router.js`, and this file never names
// a backend, a namespace, a prefix or an endpoint. That is deliberate and it is the whole
// design — 37 leaves each choosing a store at their own call site is precisely the shape
// the dual-write bug grew in.
//
// WHAT THIS FILE GUARANTEES, AND HOW
//
//  1. ONE STORE PER SETTING. Not by convention — by construction. A row carries exactly one
//     `layer`, the router talks to exactly one backend, and there is no path here that
//     writes twice or reads two places and picks. The dual-write drill in
//     `test/settings-store.test.mjs` instruments BOTH backends and asserts a machine-scoped
//     write touches one and only one; it fails if anyone ever adds a mirror.
//
//  2. A FAILED WRITE SURFACES. This is the units.js defect (`units.js:52-58,:106-115`: two
//     stores, a swallowed `.catch(() => {})`, and a boot-time read of the OTHER one first,
//     so a rejected put lost the preference silently and then overwrote the good copy on
//     the next boot). Here a failed write does three things and hides none of them: it
//     leaves the in-memory value UNCHANGED, it returns an outcome saying so, and it fires
//     `onWriteFailure`. A settings row that shows a value it did not persist is the same
//     silent revert wearing a new coat, so the store refuses to show one.
//
//  3. AN UNKNOWN KEY IS REFUSED, NEVER DEFAULTED. The router throws StorageRouterError
//     UNKNOWN_KEY for a key with no row and this file does not catch it. A leaf that
//     invents a key fails loudly on its first call rather than persisting into a namespace
//     nobody will ever read back. (Two real keys — `helpHidden`, `helpLaunches` — were
//     found exactly this way while enumerating the 37 leaves.)
//
//  4. CAPABILITY GATING IS A3 AND FAILS CLOSED. `gate()` renders a surface only on
//     CAPABILITY.PRESENT. Both ABSENT and UNKNOWN hide it, and UNKNOWN is the one that
//     matters here: the mock answers /api/v1/machine/capabilities with 503 by design (wave
//     5.1 REPORT), so `entries` stays null and every gate reads UNKNOWN rather than ABSENT.
//     A gate that only checked for ABSENT would render every machine page against the mock
//     — a finding, not a nicety. The old skin gated the same three leaves on
//     `String(model).toLowerCase().includes('bengle')` (machine.js:18-20); the served array
//     replaces the sniff, and no model string is read anywhere in this file.
//
//  5. A HIDDEN SURFACE DOES NOT WRITE. Fail-closed has to cover the write direction too,
//     or a stale control left on screen can still post to a machine that never advertised
//     the feature. `set()` on a gated key whose capability is not PRESENT refuses, with the
//     capability verdict in the outcome — and so does `remove()`, because a DELETE is a
//     write too and it is the one write path that used to run the backend ungated.
//
// DOM-free: no `document`, no `window`, no `localStorage`, no `fetch`. Everything is
// injected. NO TIMERS: there is no debounce, throttle or setTimeout in this module, and
// none belongs here (D7's write pattern is the LED path's, and it is a timer-free one).

import { createStore } from './store.js';
import { defaultFor } from '../lib/settings-defaults.js';
import { STORAGE_ROUTES, settingsKeys, settingsLeaves, keysForLeaf } from '../lib/storage-routes.js';
import { CAPABILITY } from './capabilities-store.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/** What a surface may do. Two states, because "maybe" is not something a screen can paint. */
export const SURFACE = Object.freeze({
    SHOWN: 'shown',
    HIDDEN: 'hidden',
});

/** Why a write did not happen. Reportable — a leaf shows the reason, never a shrug. */
export const WRITE_REFUSAL = Object.freeze({
    BACKEND_FAILED: 'backendFailed',
    CAPABILITY_NOT_PRESENT: 'capabilityNotPresent',
});

/** Where a loaded value came from. `absent` is a real answer, not a failure. */
export const VALUE_SOURCE = Object.freeze({
    STORED: 'stored',
    ABSENT: 'absent',
});

/**
 * @param {object} options
 * @param {object} options.storage        a `createStorageRouter(...)` — `{get,set,remove}`
 *                                        by LOGICAL key. Required: a settings store that
 *                                        quietly persists nowhere is the failure this
 *                                        module exists to remove.
 * @param {object} [options.capabilities] a `createCapabilitiesStore(...)`. Absent means no
 *                                        capability answer is available at all, which is
 *                                        UNKNOWN — so every gated surface hides. That is
 *                                        the fail-closed default, not a degraded mode.
 * @param {object} [options.routes]       the routing table (injectable for tests).
 * @param {object} [options.logger]
 */
export function createSettingsStore({ storage, capabilities = null, routes = STORAGE_ROUTES, logger = NOOP_LOGGER } = {}) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('createSettingsStore: the storage router must be injected (see src/lib/storage-router.js)');
    }
    const log = logger.scope ? logger.scope('settings') : logger;

    const keys = Object.freeze(settingsKeys(routes));
    const known = new Set(keys);
    const values = new Map();          // key -> createStore(...)
    const loadedKeys = new Set();
    const writeFailureListeners = new Set();

    /* The reactive cell for a key, minted on first use.
     *
     * ABSENCE IS SPELLED `undefined` EVERYWHERE ON THIS SURFACE, and that takes one line of
     * care: `createStore`'s own initial-value default is `null`, so passing `undefined`
     * into it would silently produce a cell holding `null` and hand callers a second
     * spelling of nothing. The cell is therefore built with `null` deliberately and
     * normalised on the way out, in both directions a value can leave (a read and a
     * subscription).
     *
     * The normalisation is SAFE, not a fudge: a stored `null` is unrepresentable through
     * this stack. The router collapses null and undefined to the fallback on read
     * (`storage-router.js:136`) and routes a null write to remove() (:160-163), precisely
     * because ReaPrime's KV handler would otherwise store the four-character string
     * 'null'. So `null` can only ever mean "nothing here", never a value someone chose.
     *
     * "Not read yet" and "read, and absent" are still distinguishable — by `isLoaded`, not
     * by two different nothings. Two spellings of nothing is the confusion the address
     * layer's absence contract exists to prevent. */
    function cell(key) {
        if (!values.has(key)) {
            values.set(key, createStore(null, { label: `settings:${key}`, logger: log, freeze: false }));
        }
        return values.get(key);
    }

    /** The one spelling of absence on this surface. */
    const unwrap = (value) => (value === null ? undefined : value);

    /* Row lookup that REFUSES rather than defaults. The router throws its own
     * StorageRouterError on the way to a backend; this catches the same mistake one step
     * earlier so a caller asking about an unknown key gets the same answer as one writing
     * to it. */
    function rowFor(key, verb) {
        if (!known.has(key)) {
            throw new Error(
                `settings: '${key}' is not a settings key. ${verb} needs a row in `
                + 'src/lib/storage-routes.js carrying a `leaf` (B7: one owner per setting). '
                + 'There is no default and no fallback layer.',
            );
        }
        return routes[key];
    }

    /**
     * A3, fail-closed. PRESENT shows; ABSENT and UNKNOWN both hide.
     *
     * @returns {{surface: string, capability: string|null, reason: string|null}}
     */
    function gate(key) {
        const row = rowFor(key, 'gate()');
        return gateCapability(row.capability ?? null);
    }

    /**
     * A3 over a CAPABILITY NAME, with no storage key in it.
     *
     * `gate(key)` above asks the routing table which capability a stored setting needs.
     * That works for a preference this skin stores and answers nothing for a MACHINE
     * field, which has no row in that table — so a control moved from a stored key to a
     * machine field would silently lose its gate. That is not a hypothetical: on 26 August
     * 2026 the cup-warmer rows moved to the machine door and their gate had to move with
     * them, and the only honest place for it was the ROW.
     *
     * ONE VERDICT FUNCTION, TWO WAYS IN. Both spellings end here, so fail-closed is
     * decided once: PRESENT shows, and both ABSENT and UNKNOWN hide.
     */
    function gateCapability(capability) {
        if (!capability) {
            return Object.freeze({ surface: SURFACE.SHOWN, capability: null, verdict: null });
        }
        const verdict = capabilities && typeof capabilities.capability === 'function'
            ? capabilities.capability(capability)
            : CAPABILITY.UNKNOWN;
        return Object.freeze({
            surface: verdict === CAPABILITY.PRESENT ? SURFACE.SHOWN : SURFACE.HIDDEN,
            capability,
            verdict,
        });
    }

    /**
     * A3 OVER AN R3 SENSOR KIND, and it is a second DOOR rather than a second VERDICT.
     *
     * `gateCapability` above asks the served capability array, which is the right question
     * for the seven entries `de1handler.dart` puts in it. The milk probe is not one of the
     * seven: `capabilities-store.js` answers it through `sensorCapability(kind)`, an R3
     * adapter over the same array (`r3MilkProbeCapability`), and `live-wiring.js` says why
     * in as many words at its own `#offers` — "Two doors because ReaPrime has two, not
     * because this file chose to have two."
     *
     * SO THE SKIN ASKS ONE QUESTION PER OPTION AND ASKS IT THE SAME WAY EVERYWHERE. The
     * Live rail's Milk option and the Settings page's Milk Temp option are the same offer
     * about the same hardware; before this existed the settings side had no way to reach
     * the adapter at all, so the option was drawn ungreyed on every machine — including one
     * whose capability read had not landed.
     *
     * THE FAIL-CLOSED RULE IS NOT REPEATED, it is `gateCapability`'s: PRESENT shows, ABSENT
     * and UNKNOWN both hide. An unknown SENSOR KIND is a programming error and the
     * capability store throws on it, which is right — a typo must not read as "no probe".
     */
    function gateSensor(kind) {
        if (!kind) {
            return Object.freeze({ surface: SURFACE.SHOWN, capability: null, verdict: null });
        }
        const verdict = capabilities && typeof capabilities.sensorCapability === 'function'
            ? capabilities.sensorCapability(kind).capability
            : CAPABILITY.UNKNOWN;
        return Object.freeze({
            surface: verdict === CAPABILITY.PRESENT ? SURFACE.SHOWN : SURFACE.HIDDEN,
            capability: kind,
            verdict,
        });
    }

    function announceWriteFailure(event) {
        for (const listener of writeFailureListeners) {
            try {
                listener(event);
            } catch (error) {
                log.error('a settings write-failure listener threw', error);
            }
        }
    }

    return {
        /** Every settings key, sorted. Derived from the table — never a second list. */
        keys,

        /** Every settings leaf that owns at least one persisted key. */
        leaves: Object.freeze(settingsLeaves(routes)),

        /** The keys one leaf owns. */
        keysFor: (leaf) => keysForLeaf(leaf, routes),

        /** The row behind a key: layer, scope, status, leaf, capability. Throws if unknown. */
        rowFor: (key) => rowFor(key, 'rowFor()'),

        /** A3 gating verdict for one key. See `gate` above. */
        gate,
        gateCapability,
        /** A3 over an R3 SENSOR KIND — the milk probe's door. See `gateSensor` above. */
        gateSensor,

        /** The current in-memory value. `undefined` until `load(key)` has resolved. */
        value(key) {
            rowFor(key, 'value()');
            const stored = unwrap(cell(key).get());
            if (stored !== undefined) return stored;
            /* THE DECIDED DEFAULT, and only when nothing is stored.
             *
             * Ben, 26 August 2026 (O3): "the current option should always be shown as
             * selected ... Where its not a machine setting then we need to decide what
             * default value is." He then decided all thirty-eight.
             *
             * THIS STORE STILL REFUSES TO INVENT A VALUE, which is the rule that stopped
             * the units.js silent revert and is not being relaxed. What changes is that a
             * value somebody CHOSE is no longer an invention: settings-defaults.js is a
             * table of decisions with his words beside each one, and a key nobody has
             * decided still returns undefined and still renders empty.
             *
             * A DEFAULT IS NOT A WRITE. Nothing is persisted here — the tablet still has no
             * stored value, and the first time the user touches the control their choice is
             * what gets written. So a default that is later changed in this file follows
             * every tablet that never touched the setting, which is what a default should
             * do and what a write-on-first-read would prevent. */
            return defaultFor(key);
        },

        /** The stored value alone, with no default behind it. */
        storedValue(key) {
            rowFor(key, 'storedValue()');
            return unwrap(cell(key).get());
        },

        /** True once this key has been read — tells "not read yet" from "read, absent". */
        isLoaded: (key) => loadedKeys.has(key),

        /** Subscribe to one key; fires immediately with the current value. */
        subscribe(key, listener) {
            rowFor(key, 'subscribe()');
            return cell(key).subscribe((value) => listener(unwrap(value)));
        },

        /**
         * Read ONE key from its ONE layer. Never writes: the old boot path wrote its answer
         * back, which is how a failed write's loss became permanent.
         *
         * A backend failure reads as absent (the router logs it and returns the fallback) —
         * a broken read must not take a screen down. That asymmetry with `set` is
         * deliberate: a read that fails costs a default for one paint, a write that fails
         * silently costs the user's choice forever.
         */
        async load(key) {
            rowFor(key, 'load()');
            const value = await storage.get(key);
            loadedKeys.add(key);
            /* AN UNCHANGED READ PUBLISHES NOTHING, and for an OBJECT value that is not an
             * optimisation — it is the difference between working and throwing.
             *
             * `store.set` refuses to be handed the object it already holds, because that
             * is pattern F wearing a disguise: the mutation already happened and nothing
             * downstream can see it. A backend that answers with the SAME REFERENCE it
             * was given — the memory backend does, and so would any cache — makes an
             * ordinary re-read look exactly like that mistake.
             *
             * IT HAD NEVER FIRED because every routed key held a primitive. `keyboard
             * Bindings` is the first object-valued one, and it fired on the second visit
             * to the leaf: write the overrides, leave, come back, and `load()` handed the
             * cell its own object. `Object.is` here is the same comparison `set` makes
             * one line down for a primitive, applied where the value is not one. */
            const held = cell(key);
            if (!Object.is(held.get(), value)) held.set(value);
            return Object.freeze({
                key,
                value,
                source: value === undefined ? VALUE_SOURCE.ABSENT : VALUE_SOURCE.STORED,
            });
        },

        /** Read every key one leaf owns. */
        async loadLeaf(leaf) {
            return Promise.all(keysForLeaf(leaf, routes).map((key) => this.load(key)));
        },

        /** Read every settings key. */
        async loadAll() {
            return Promise.all(keys.map((key) => this.load(key)));
        },

        /**
         * Write ONE key to its ONE layer, and tell the truth about what happened.
         *
         * On failure the in-memory value is NOT changed, so a leaf bound to this store
         * paints the value that is actually stored rather than the one the user tried to
         * set. That is the whole lesson of the units.js revert.
         *
         * @returns {Promise<{ok: boolean, key: string, layer: string, reason: string|null}>}
         */
        async set(key, value) {
            const row = rowFor(key, 'set()');
            const verdict = gate(key);
            if (verdict.surface === SURFACE.HIDDEN) {
                // Fail-closed covers writes too: a control that should not be on screen
                // must not be able to post to a machine that never advertised the feature.
                const refusal = Object.freeze({
                    ok: false,
                    key,
                    layer: row.layer,
                    reason: WRITE_REFUSAL.CAPABILITY_NOT_PRESENT,
                    capability: verdict.capability,
                    verdict: verdict.verdict,
                });
                log.error(`refusing to write '${key}': capability '${verdict.capability}' is ${verdict.verdict}, not present`);
                announceWriteFailure(refusal);
                return refusal;
            }
            const stored = await storage.set(key, value);
            if (!stored) {
                const failure = Object.freeze({
                    ok: false,
                    key,
                    layer: row.layer,
                    reason: WRITE_REFUSAL.BACKEND_FAILED,
                    capability: verdict.capability,
                    verdict: verdict.verdict,
                });
                log.error(`'${key}' was NOT stored on layer '${row.layer}' — the shown value stays ${JSON.stringify(cell(key).get())}`);
                announceWriteFailure(failure);
                return failure;
            }
            loadedKeys.add(key);
            cell(key).set(value);
            return Object.freeze({ ok: true, key, layer: row.layer, reason: null, capability: verdict.capability, verdict: verdict.verdict });
        },

        /**
         * Delete one key. Same contract as `set`.
         *
         * Deleting is also how a KV value is cleared: ReaPrime's handler turns a JSON null
         * body into the literal string 'null' (`kv_store_handler.dart:41,:47` —
         * `jsonDecode('null')` is null so `maybeJson ?? value` falls through to the raw
         * body), which would read back as a present, truthy setting. The router already
         * routes a null write to remove() for every layer at once; this is the named door.
         */
        async remove(key) {
            const row = rowFor(key, 'remove()');
            const verdict = gate(key);
            if (verdict.surface === SURFACE.HIDDEN) {
                // "Same contract as set" includes claim 5: a delete IS a write. A DELETE to
                // a machine that never advertised the feature is the same fail-closed breach
                // as a PUT, so it takes the same refusal rather than a quieter one.
                const refusal = Object.freeze({
                    ok: false,
                    key,
                    layer: row.layer,
                    reason: WRITE_REFUSAL.CAPABILITY_NOT_PRESENT,
                    capability: verdict.capability,
                    verdict: verdict.verdict,
                });
                log.error(`refusing to remove '${key}': capability '${verdict.capability}' is ${verdict.verdict}, not present`);
                announceWriteFailure(refusal);
                return refusal;
            }
            const removed = await storage.remove(key);
            if (!removed) {
                const failure = Object.freeze({
                    ok: false, key, layer: row.layer, reason: WRITE_REFUSAL.BACKEND_FAILED, capability: verdict.capability, verdict: verdict.verdict,
                });
                log.error(`'${key}' was NOT removed from layer '${row.layer}'`);
                announceWriteFailure(failure);
                return failure;
            }
            loadedKeys.add(key);
            cell(key).set(undefined);
            return Object.freeze({ ok: true, key, layer: row.layer, reason: null, capability: verdict.capability, verdict: verdict.verdict });
        },

        /**
         * Every write that did not happen. THE SURFACING SEAM — the reason this store can
         * claim a failed write is not silent. A screen subscribes once and shows the
         * failure; nothing here decides how (D11 owns the Save wording, and this wave
         * supplies counts, not sentences).
         */
        onWriteFailure(listener) {
            writeFailureListeners.add(listener);
            return () => writeFailureListeners.delete(listener);
        },

        /** The whole enumeration, flattened — for a settings debug panel and for tests. */
        describe() {
            return keys.map((key) => {
                const row = routes[key];
                return {
                    key,
                    leaf: row.leaf,
                    layer: row.layer,
                    scope: row.scope,
                    status: row.status,
                    capability: row.capability || null,
                    surface: gate(key).surface,
                };
            });
        },
    };
}
