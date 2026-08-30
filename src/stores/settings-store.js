/**
 * The settings store — B7 at volume, and the spine every settings leaf reads and writes through.
 */

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
