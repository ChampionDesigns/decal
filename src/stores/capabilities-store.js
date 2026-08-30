// THE CAPABILITY STORE — the single mechanism for machine differences (A3).
//
// SCOPE Part 3 §3, verbatim on the rule:
//
//   "The skin learns what the machine can do from GET /api/v1/machine/capabilities, and
//    from NOTHING ELSE. Never from the model name, never from a raw feature byte, never
//    from a fetch that happened to fail. If something the skin needs is not in the
//    endpoint, the fix is to ADD IT TO THE ENDPOINT (A3, feeding R3) — not to sniff for
//    it."
//
// This store replaces `machine.js`, whose whole content was a model-string sniff plus a
// module-scope singleton with a comment-enforced boot order. THE SKIN HAS NEVER CALLED THE
// CAPABILITY ENDPOINT. Now everything gates on it.
//
// WHY THE SNIFF FAILS, concretely, because it is the argument that carries the decision:
// ReaPrime chooses the device CLASS at discovery from the advertised name, while `model`
// is a byte read after connect. A Bengle that advertised as a plain DE1 becomes a
// `UnifiedDe1` — `model` reads "Bengle", `GET /machine/capabilities` returns `[]`, and
// every Bengle route 404s through `_bengleFirmwareGate`. The sniffing skin then shows
// three settings pages whose every call fails. The capability check and the route gate
// CANNOT disagree, because they are the same predicate: `de1 is BengleInterface`.
//
// ── THE FOUR RULES HERE ──────────────────────────────────────────────────────────────
//
//  1. THREE ANSWERS, NOT TWO. `present` / `absent` / `unknown`. `[]` is a REAL ANSWER
//     (not a Bengle) and is never confused with a failed read: the handler runs inside
//     `withDe1`, so with no machine connected `connectedDe1()` throws
//     `DeviceNotConnectedException` and the route answers 500 — not `[]`. A store that
//     collapsed those two would report every Bengle as a DE1 during a reconnect.
//  2. OFFERING FAILS CLOSED, ABSENCE STAYS VISIBLE. `offers(name)` is true only for a
//     `present`. But `capability(name)` returns the tri-state and `reason()` says why, so
//     "we do not know yet" is renderable as itself rather than as a missing feature.
//  3. ROUTE REGISTERED IS WEAKER THAN FEATURE AVAILABLE. `POST /api/v1/feedback` is always
//     registered and answers 503 unless the build carries a GitHub token
//     (`feedback_handler.dart`: `if (!_service.isConfigured) return jsonServiceUnavailable`).
//     That 503 is FEATURE ABSENT — hide the form — not a transient error to retry.
//     `readFeedbackAvailability` is the one place that judgement is written down.
//  4. WHAT THE SEVEN DO NOT COVER GOES THROUGH THE ADAPTER, NEVER BACK TO THE NAME.
//     `CAPABILITY_GAPS` enumerates the four, each pointing at its R-item. A call site that
//     needs one of them calls the store method that wraps the R3 adapter; there is no
//     other route, and no machine name is read anywhere in this file.
//
// The store performs exactly ONE request — `GET /api/v1/machine/capabilities`, through the
// injected route helper. `GET /api/v1/machine/info` is NOT fetched here: its answer is fed
// in with `applyMachineInfo`, by whoever owns that feed, so this store has one route and
// one contract row. Until an info answer arrives, the GHC and profile-mode gates report
// `unknown` — which is the honest state, not `false`.
//
// ReaPrime read AS WRITTEN at 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
// `de1handler.dart` (`addRoutes` GET /api/v1/machine/capabilities, `withDe1`,
// `_bengleFirmwareGate`, `_infoHandler`), `feedback_handler.dart`, `machine.dart`
// (`MachineInfo.toJson`), `unified_de1.dart` (`_assertProfileModeSupported`).

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
        via: 'profileModes() — r3ProfileModeCapabilities, a UI-offer hint; authority is the arm-time 400 (B9)',
    }),
    Object.freeze({
        gap: "the profile editor's flow ranges",
        item: 'R2 (possibly F2 underneath)',
        // Precise about WHERE, because the imprecise version read as a promise this
        // store does not keep: machineLimits() carries no per-step authoring range
        // today (its rows are the machine's own — steam, hot water, flush, brewTemp).
        // What is missing is the MACHINE-DEPENDENT lift the old editor did by name
        // (profile_editor.js:485-495, flow 15/8 -> 20 on a Bengle; A3 forbids the
        // name test, so it is unported). That lift is an R2 answer, and it lands as a
        // rewrite of the ONE authoring-range table — profile-modes.js AUTHORING_RANGES
        // — never as a second copy. B2 holds per field: no key is in both tables, and
        // the one field both touch (brew temperature) is injected from machine-limits.
        via: 'machineLimits() serves the machine\'s own rows behind r2MachineLimits; the'
            + " step-authoring ranges are AUTHORING_RANGES (profile-modes.js), the one table R2's"
            + ' per-machine answer overwrites — the two are disjoint by field, which is B2',
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
    // 503 = the build carries no GitHub token. The feature is absent on this machine and
    // the form is hidden; retrying is the wrong response and so is an error toast.
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
    // Gate 4's ONE store primitive, not a second mechanism beside it: frozen state,
    // return-new-state enforced, replay to a late subscriber, and `StoreController` for
    // free in every component that reads a capability.
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
                // The capability read's own reason when that is what is missing;
                // otherwise the missing input is the machine-info feed.
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
                    // NOT `[]`. A failed read is not "this machine is a DE1" — 500 is what
                    // `withDe1` answers when nothing is connected, and treating it as an
                    // empty capability set would hide every Bengle feature on a reconnect
                    // and call it a machine difference.
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
            // And the in-flight read is released as well as invalidated: without this, a
            // `load()` for the NEW machine would join the old machine's request, whose
            // answer this epoch then discards — leaving nothing to re-read and a store that
            // sits at `unknown` for ever.
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
