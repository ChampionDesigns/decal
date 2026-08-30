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

    function cell(key) {
        if (!values.has(key)) {
            values.set(key, createStore(null, { label: `settings:${key}`, logger: log, freeze: false }));
        }
        return values.get(key);
    }

    /** The one spelling of absence on this surface. */
    const unwrap = (value) => (value === null ? undefined : value);

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

        async load(key) {
            rowFor(key, 'load()');
            const value = await storage.get(key);
            loadedKeys.add(key);
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
