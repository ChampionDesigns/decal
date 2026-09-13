/**
 * The settings store — the spine every settings leaf reads and writes through.
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
    SUPERSEDED: 'superseded',
});

/** Where one key's read or write has got to. */
export const OPERATION = Object.freeze({
    IDLE: 'idle',
    PENDING: 'pending',
    FAILED: 'failed',
});

/** Why a read did not happen. */
export const READ_REFUSAL = Object.freeze({
    BACKEND_FAILED: 'readFailed',
});

export const OPERATION_KIND = Object.freeze({
    READ: 'read',
    WRITE: 'write',
});

const IDLE_OPERATION = Object.freeze({ status: OPERATION.IDLE, reason: null });

/** Where a loaded value came from. `absent` is a real answer, not a failure. */
export const VALUE_SOURCE = Object.freeze({
    STORED: 'stored',
    ABSENT: 'absent',
    FAILED: 'failed',
});

export function createSettingsStore({ storage, capabilities = null, routes = STORAGE_ROUTES, logger = NOOP_LOGGER } = {}) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('createSettingsStore: the storage router must be injected (see src/lib/storage-router.js)');
    }
    const log = logger.scope ? logger.scope('settings') : logger;

    const keys = Object.freeze(settingsKeys(routes));
    const known = new Set(keys);
    const values = new Map();          // key -> createStore(...)
    const operations = new Map();
    const operationListeners = new Set();
    const loadedKeys = new Set();
    const writeFailureListeners = new Set();

    const readFailures = new Map();
    if (typeof storage.onReadFailure === 'function') {
        storage.onReadFailure((event) => {
            const key = event?.key;
            if (typeof key !== 'string') return;
            readFailures.set(key, (readFailures.get(key) ?? 0) + 1);
        });
    }

    /* Every read and every write takes a number, so an answer that arrives after a newer
     * one is discarded rather than published over it. */
    const issued = new Map();
    const lastWrite = new Map();
    const settledAt = new Map();

    function nextIssue(key) {
        const next = (issued.get(key) ?? 0) + 1;
        issued.set(key, next);
        return next;
    }

    function nextWriteIssue(key) {
        const next = nextIssue(key);
        lastWrite.set(key, next);
        return next;
    }

    const writeIsCurrent = (key, issue) => lastWrite.get(key) === issue;
    const readIsCurrent = (key, issue) => issued.get(key) === issue
        && issue > (settledAt.get(key) ?? 0);
    const markSettled = (key) => settledAt.set(key, issued.get(key) ?? 0);

    function publishOperation(key, kind, status, reason = null) {
        const slot = `${kind}:${key}`;
        const held = operations.get(slot) ?? IDLE_OPERATION;
        if (held.status === status && held.reason === reason) return;
        const next = Object.freeze({ key, kind, status, reason });
        if (status === OPERATION.IDLE) operations.delete(slot);
        else operations.set(slot, next);
        for (const listener of operationListeners) {
            try {
                listener(next);
            } catch (error) {
                log.error('a settings operation listener threw', error);
            }
        }
    }

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
                + 'src/lib/storage-routes.js carrying a `leaf` (one owner per setting). '
                + 'There is no default and no fallback layer.',
            );
        }
        return routes[key];
    }

    /**
     * Fail-closed. PRESENT shows; ABSENT and UNKNOWN both hide.
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

        /** The gating verdict for one key. See `gate` above. */
        gate,
        gateCapability,
        /** Gating over an R3 SENSOR KIND — the milk probe's door. See `gateSensor` above. */
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

        /** Every read and write state change, as {key, kind, status, reason}. */
        onOperation(listener) {
            operationListeners.add(listener);
            return () => operationListeners.delete(listener);
        },

        /** Subscribe to one key; fires immediately with the current value. */
        subscribe(key, listener) {
            rowFor(key, 'subscribe()');
            return cell(key).subscribe((value) => listener(unwrap(value)));
        },

        async load(key) {
            rowFor(key, 'load()');
            const issue = nextIssue(key);
            const failuresBefore = readFailures.get(key) ?? 0;
            const value = await storage.get(key);
            const failed = (readFailures.get(key) ?? 0) > failuresBefore;
            if (!readIsCurrent(key, issue)) {
                return Object.freeze({
                    key,
                    value: unwrap(cell(key).get()),
                    source: VALUE_SOURCE.STORED,
                    superseded: true,
                });
            }
            if (failed) {
                log.error(`'${key}' could not be read from layer '${rowFor(key, 'load()').layer}' — the shown value stays ${JSON.stringify(cell(key).get())}`);
                publishOperation(key, OPERATION_KIND.READ, OPERATION.FAILED, READ_REFUSAL.BACKEND_FAILED);
                return Object.freeze({
                    key,
                    value: unwrap(cell(key).get()),
                    source: VALUE_SOURCE.FAILED,
                    failed: true,
                });
            }
            loadedKeys.add(key);
            if (operations.get(`${OPERATION_KIND.READ}:${key}`)?.reason === READ_REFUSAL.BACKEND_FAILED) {
                publishOperation(key, OPERATION_KIND.READ, OPERATION.IDLE);
            }
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
            const issue = nextWriteIssue(key);
            publishOperation(key, OPERATION_KIND.WRITE, OPERATION.PENDING);
            const stored = await storage.set(key, value);
            const newest = writeIsCurrent(key, issue);
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
                if (newest) publishOperation(key, OPERATION_KIND.WRITE, OPERATION.FAILED, WRITE_REFUSAL.BACKEND_FAILED);
                announceWriteFailure(failure);
                return failure;
            }
            if (!newest) {
                log.debug(`a settings write for '${key}' answered after a newer one; discarding it`);
                return Object.freeze({
                    ok: false,
                    key,
                    layer: row.layer,
                    reason: WRITE_REFUSAL.SUPERSEDED,
                    capability: verdict.capability,
                    verdict: verdict.verdict,
                });
            }
            markSettled(key);
            publishOperation(key, OPERATION_KIND.WRITE, OPERATION.IDLE);
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
            const issue = nextWriteIssue(key);
            publishOperation(key, OPERATION_KIND.WRITE, OPERATION.PENDING);
            const removed = await storage.remove(key);
            const newest = writeIsCurrent(key, issue);
            if (!removed) {
                const failure = Object.freeze({
                    ok: false, key, layer: row.layer, reason: WRITE_REFUSAL.BACKEND_FAILED, capability: verdict.capability, verdict: verdict.verdict,
                });
                log.error(`'${key}' was NOT removed from layer '${row.layer}'`);
                if (newest) publishOperation(key, OPERATION_KIND.WRITE, OPERATION.FAILED, WRITE_REFUSAL.BACKEND_FAILED);
                announceWriteFailure(failure);
                return failure;
            }
            if (!newest) {
                log.debug(`a settings delete for '${key}' answered after a newer write; discarding it`);
                return Object.freeze({
                    ok: false, key, layer: row.layer, reason: WRITE_REFUSAL.SUPERSEDED, capability: verdict.capability, verdict: verdict.verdict,
                });
            }
            markSettled(key);
            publishOperation(key, OPERATION_KIND.WRITE, OPERATION.IDLE);
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
