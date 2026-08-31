/**
 * THE CAPABILITY STORE — the single mechanism for machine differences.
 */

import { createStore } from './store.js';
import {
    R3_SENSOR_CAPABILITY,
    r3GroupHeadControllerCapability,
    r3ProfileModeCapabilities,
    r2MachineLimits,
    machineClassFromServedSet,
    PROFILE_MODE_BIT,
    PROFILE_MODE_MASK,
} from '../data/adapters-r.js';

export { PROFILE_MODE_BIT, PROFILE_MODE_MASK };

export const SERVED_CAPABILITIES = Object.freeze([
    'cupWarmer',
    'integratedScale',
    'stopAtWeight',
    'ledStrip',
    'scaleCalibration',
    'preheat',
    'wakeSchedule',
]);

/** The tri-state. Rule 1. */
export const CAPABILITY = Object.freeze({
    PRESENT: 'present',
    ABSENT: 'absent',
    UNKNOWN: 'unknown',
});

/** Why the store cannot answer. Reportable, never smoothed into an `absent`. */
export const CAPABILITY_REASON = Object.freeze({
    NOT_LOADED: 'notLoaded',
    LOADING: 'loading',
    FAILED: 'failed',
    UNREADABLE: 'unreadable',
});

export const CAPABILITY_GAPS = Object.freeze([
    Object.freeze({
        gap: 'profile modes (Power / Lever / HOLD / power exit)',
        item: 'R3',
        via: 'profileModes() — r3ProfileModeCapabilities, a UI-offer hint; authority is the arm-time 400',
    }),
    Object.freeze({
        gap: "the profile editor's flow ranges",
        item: 'R2',
        via: 'machineLimits() serves the machine\'s own rows behind r2MachineLimits; the'
            + " step-authoring ranges are AUTHORING_RANGES (profile-modes.js), the one table R2's"
            + ' per-machine answer overwrites — the two are disjoint by field',
    }),
    Object.freeze({
        gap: 'the milk-probe steam UI',
        item: 'R3',
        via: 'sensorGate("milkProbe") — r3MilkProbeCapability',
    }),
    Object.freeze({
        gap: 'the steam-power preset table',
        item: 'R2',
        via: 'machineLimits() — the same one limits table',
    }),
    Object.freeze({
        gap: 'group-head controller hardware',
        item: 'R3',
        via: 'groupHeadController() — r3GroupHeadControllerCapability (the named example)',
    }),
]);

export function readFeedbackAvailability(result) {
    if (!result || typeof result !== 'object') {
        return Object.freeze({ available: CAPABILITY.UNKNOWN, reason: CAPABILITY_REASON.NOT_LOADED });
    }
    if (result.ok === true) return Object.freeze({ available: CAPABILITY.PRESENT, reason: null });
    if (result.status === 503) return Object.freeze({ available: CAPABILITY.ABSENT, reason: null });
    return Object.freeze({ available: CAPABILITY.UNKNOWN, reason: CAPABILITY_REASON.FAILED });
}

export const FEEDBACK_SCREENSHOTS_ATTACH = false;

/** Read `{capabilities: string[]}`. `null` for a body this build cannot read. */
export function readCapabilityEntries(body) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.capabilities)) return null;
    if (!body.capabilities.every((entry) => typeof entry === 'string')) return null;
    return Object.freeze([...body.capabilities]);
}

const EMPTY_STATE = Object.freeze({
    status: 'idle',
    entries: null,
    reason: CAPABILITY_REASON.NOT_LOADED,
    error: null,
    machineInfo: null,
    loadedAt: null,
});

/**
 * @param {object} deps
 * @param {{capabilities: () => Promise<object>}} deps.routes  createReaRoutes(transport)
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]  injected for tests
 */
export function createCapabilitiesStore({ routes, logger = null, now = () => Date.now() } = {}) {
    if (!routes || typeof routes.capabilities !== 'function') {
        throw new Error('createCapabilitiesStore: routes must be injected (see createReaRoutes)');
    }
    const log = logger && logger.scope ? logger.scope('capabilities') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'capabilities', logger: log });
    let inFlight = null;
    let epoch = 0;

    const publish = (next) => store.set(next);
    const state = () => store.get();

    /** Publish only if the machine this answer was asked of is still the machine. */
    const publishIfCurrent = (asOf, next, what) => {
        if (asOf !== epoch) {
            if (log && log.info) log.info(`discarding a ${what} answer for a machine that is gone`);
            return state();
        }
        return publish(next);
    };

    /** The tri-state for one entry name. */
    function capability(name) {
        if (state().entries === null) return CAPABILITY.UNKNOWN;
        return state().entries.includes(name) ? CAPABILITY.PRESENT : CAPABILITY.ABSENT;
    }

    /** Turn an adapter answer into the store's own vocabulary. Rule 2 in one place. */
    function fromAdapter(result) {
        if (!result.known) {
            return Object.freeze({
                capability: CAPABILITY.UNKNOWN,
                value: result.value,
                reason: state().entries === null ? state().reason : CAPABILITY_REASON.NOT_LOADED,
                provisional: true,
                tag: result.tag,
                adapter: result.adapter,
                basis: result.basis,
                note: result.note,
                swapWhen: result.swapWhen,
            });
        }
        const truthy = result.value === true
            || (result.value && typeof result.value === 'object' && result.value.mask > 0);
        return Object.freeze({
            capability: truthy ? CAPABILITY.PRESENT : CAPABILITY.ABSENT,
            value: result.value,
            reason: null,
            provisional: true,
            tag: result.tag,
            adapter: result.adapter,
            basis: result.basis,
            note: result.note,
            swapWhen: result.swapWhen,
        });
    }

    return {
        /** The current state. Frozen; replaced, never mutated. */
        get state() { return store.get(); },

        /** Observe. The current state is replayed to a late subscriber immediately. */
        subscribe(listener) { return store.subscribe(listener); },

        async load() {
            if (inFlight) return inFlight;
            const asOf = epoch;
            publish({ ...state(), status: 'loading', reason: CAPABILITY_REASON.LOADING });
            inFlight = (async () => {
                const result = await routes.capabilities();
                if (!result.ok) {
                    if (log && log.warn) log.warn(`capabilities read failed: ${result.message}`);
                    return publishIfCurrent(asOf, {
                        ...state(),
                        status: 'error',
                        entries: null,
                        reason: CAPABILITY_REASON.FAILED,
                        error: result,
                    }, 'failed capabilities');
                }
                const entries = readCapabilityEntries(result.data);
                if (entries === null) {
                    if (log && log.warn) log.warn('capabilities answered a shape this build cannot read');
                    return publishIfCurrent(asOf, {
                        ...state(),
                        status: 'error',
                        entries: null,
                        reason: CAPABILITY_REASON.UNREADABLE,
                        error: result,
                    }, 'unreadable capabilities');
                }
                return publishIfCurrent(asOf, {
                    ...state(),
                    status: 'ready',
                    entries,
                    reason: null,
                    error: null,
                    loadedAt: now(),
                }, 'capabilities');
            })().finally(() => { inFlight = null; });
            return inFlight;
        },

        /** Re-read — after a machine connect or swap. Same request, no cache. */
        refresh() { return this.load(); },

        forget() {
            epoch += 1;
            inFlight = null;
            return publish({ ...EMPTY_STATE });
        },

        /**
         * Feed in a `GET /api/v1/machine/info` body. The store does not fetch it — one
         * store, one route — and until this arrives the two info-backed gates answer
         * `unknown`.
         */
        applyMachineInfo(info) {
            return publish({ ...state(), machineInfo: info && typeof info === 'object' ? info : null });
        },

        capability,

        /** Fail-closed offer test. True only for a `present`. */
        offers(name) { return capability(name) === CAPABILITY.PRESENT; },

        /** Why there is no answer, or null when there is one. */
        reason() { return state().entries === null ? state().reason : null; },

        /** Every entry the server named, or null. Frozen. */
        entries() { return state().entries; },

        /** Entries the server named that this build does not know about — a newer server. */
        unknownEntries() {
            if (state().entries === null) return null;
            return Object.freeze(state().entries.filter((entry) => !SERVED_CAPABILITIES.includes(entry)));
        },

        /* ── the R3 seams. Every gap the served seven do not cover leaves through here ── */

        sensorGate: (kind) => {
            const adapter = R3_SENSOR_CAPABILITY[kind];
            if (!adapter) throw new Error(`capabilities: no R3 sensor adapter for kind "${kind}"`);
            return adapter(state().entries).value === true;
        },

        /** The same question with its provenance attached. */
        sensorCapability(kind) {
            const adapter = R3_SENSOR_CAPABILITY[kind];
            if (!adapter) throw new Error(`capabilities: no R3 sensor adapter for kind "${kind}"`);
            return fromAdapter(adapter(state().entries));
        },

        /** R3, the named example: is there group-head-controller hardware? */
        groupHeadController() {
            return fromAdapter(r3GroupHeadControllerCapability(state().machineInfo));
        },

        profileModes() {
            return fromAdapter(r3ProfileModeCapabilities(state().machineInfo));
        },

        machineLimits() {
            return r2MachineLimits(state().entries);
        },

        machineClass() {
            return machineClassFromServedSet(state().entries);
        },

        gaps: CAPABILITY_GAPS,

        /** Drop every subscriber. This store holds no timer and no socket. */
        stop() { store.destroy(); },
    };
}
