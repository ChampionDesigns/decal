// THE ESTIMATOR LINK — the puck estimator's live frames, as a store.
//
// The estimator moved: `MachineSnapshot` is pure machine telemetry, and observer output —
// which the machine never reads back — lives on the sensor abstraction beside the milk
// probe, at `/ws/v1/sensors/<id>/snapshot`. This store owns that stream's latest frame and
// the identity of the sensor it came from. It is genuinely current work; what it replaces
// is `estimator-link.js`, whose channel map was right and whose four surrounding behaviours
// were not.
//
// ── THE FOUR DEFECTS, AND WHAT REPLACES EACH ─────────────────────────────────────────
//
//  1. IT NEVER RE-DISCOVERS. `if (stopped || socket) return;` — once a socket existed,
//     discovery stopped for good. The sensor id derives from the MACHINE's deviceId
//     (`'${machineDeviceId}-puckestimator'`), so swapping the machine mints a NEW id and
//     the old link dialled the dead one for ever, while `sensors_handler.dart` answered
//     `{"error":"not found"}` and closed. Re-discovery on close is `rea-sensors.js`'s job
//     (Gate 3) and this store consumes it: the CLOSE and the ERROR ENVELOPE are both
//     signals here, and both clear the held frame immediately. A held frame from a sensor
//     that is gone is the stale-value defect wearing the estimator's colour.
//  2. THE LEGACY BACK-TRANSLATION. The old link mapped every channel back to the snapshot
//     key names the skin already used, so nothing downstream had to change. A rewrite has
//     no old consumers, so there is nothing to translate for, and translating would
//     re-bake seven dead names behind a shim. Channels keep ReaPrime's names, read through
//     the address layer.
//  3. THE POLL RAN FOR EVER on a machine with no estimator, at 15 s, against a route with
//     no ETag (`sensors_handler.dart` answers `jsonOk`, not `jsonOkConditional`). The poll
//     is now gated on capabilities — through the R3-tagged adapter, because no capability
//     entry for the estimator exists upstream yet — and `rea-sensors.js` requires that
//     gate rather than defaulting it.
//  4. IT STARTED ITS INTERVAL AT CONSTRUCTION, so it could be polling before anything
//     wanted an answer. `start()` here is explicit and idempotent.
//
// AND ONE SHAPE CHANGE: `apply` RETURNS NEW STATE. The old `apply(snapshot)` mutated the
// snapshot in place, which is why nothing could observe it and two consumers could see
// different objects for the same frame. Gate 4's rule — in-place mutation becomes
// return-new-state, because the store is what makes it observable.
//
// ABSENT CHANNELS STAY ABSENT. `encodeSample` OMITS a channel the firmware has not
// observed; a zero would misrepresent "not observed" as a real measurement of zero
// resistance. The address layer turns an omitted key into an absence with a reason, and
// this store passes that through untouched. Nothing here nulls, zeroes or interpolates.
//
// ReaPrime read AS WRITTEN at 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
// `bengle_puck_estimator.dart` (the class doc, `info.dataChannels`, `encodeSample`,
// `_machineDeviceId`) and `sensors_handler.dart`. The store issues no request itself — the
// listing GET and the socket both belong to `rea-sensors.js` — so it declares no route.

import { createStore } from './store.js';
import { readEstimatorFrame, presentChannels } from '../data/rea-address.js';
import { allAbsent, ABSENCE } from '../data/reading.js';
import { SENSOR_KIND } from '../data/rea-sensors.js';
import { ESTIMATOR_CHANNELS, ESTIMATOR_MEASURED_POWER_MIN_REV } from '../data/rea-names.js';
import { WS_SIGNAL } from '../data/rea-sockets.js';
import { WS_MESSAGE } from '../data/rea-ws-channels.js';

/**
 * THE NINE CHANNELS THE LINK FOLDS ONTO A SAMPLE.
 *
 * Exactly the nine the old map carried — its left-hand side was accurate, and it is kept.
 * What is gone is its right-hand side: no channel is renamed to a machine-snapshot key on
 * the way past. The sensor's full seventeen stay available on `state.channels`; these nine
 * are what a sample-shaped consumer reads, and the three duplicated quantities (B6) are all
 * inside them.
 *
 * `hydraulicPowerMeasured` needs BengleEstSample rev >= 3 and is simply absent below it —
 * which is a data state, not an error, and not a reason to substitute the derived twin.
 */
export const ESTIMATOR_LINK_CHANNELS = Object.freeze([
    'r1',
    'r2',
    'compliance',
    'flags',
    'collapseEventCount',
    'collapseLastEventT',
    'collapseLastEventMagnitude',
    'collapseLastEventConcavity',
    'hydraulicPowerMeasured',
]);

/**
 * And they are required to BE nine of the seventeen, at import.
 *
 * This module already imports `ESTIMATOR_CHANNELS` — the checked-against-Dart list — and
 * then hand-wrote a subset of it beside the import, with a test that asserted the length
 * and three members. A subset assertion is the whole guard that was missing: it costs
 * nothing and turns "the firmware renamed a collapse channel" from nine silent absences
 * into a failure that names the key.
 */
for (const channel of ESTIMATOR_LINK_CHANNELS) {
    if (!ESTIMATOR_CHANNELS.includes(channel)) {
        throw new Error(
            `estimator-link: "${channel}" is not one of the estimator's channels in rea-names.js — `
            + 'the folded set must be a subset of the sensor\'s own channel list.',
        );
    }
}

export { ESTIMATOR_MEASURED_POWER_MIN_REV };

/** The folded set with nothing in it — one shape whether or not a frame is held, so a
 *  consumer never has to test for the link's existence before reading a channel. */
const ABSENT_LINK_CHANNELS = allAbsent(ESTIMATOR_LINK_CHANNELS, ABSENCE.NO_SOURCE);

/** Why the link holds no frame. `detached` is the normal state on a machine with none. */
export const LINK_STATE = Object.freeze({
    STOPPED: 'stopped',
    DISCOVERING: 'discovering',
    ATTACHED: 'attached',
});

const EMPTY = Object.freeze({
    status: LINK_STATE.STOPPED,
    sensorId: null,
    frame: null,
    channels: null,
    present: Object.freeze([]),
    rev: null,
    frames: 0,
    lastError: null,
    updatedAt: null,
});

/**
 * @param {object} deps
 * @param {object} deps.discovery  createSensorDiscovery(...) — owns the poll, the R3 gate
 *                                 and re-discovery on close
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]
 */
export function createEstimatorLinkStore({ discovery, logger = null, now = () => Date.now() } = {}) {
    if (!discovery || typeof discovery.subscribe !== 'function' || typeof discovery.onSignal !== 'function') {
        throw new Error('createEstimatorLinkStore: sensor discovery must be injected (see createSensorDiscovery)');
    }
    const log = logger && logger.scope ? logger.scope('estimator') : logger;
    // Gate 4's ONE store primitive — frozen state, return-new-state enforced, replay to a
    // late subscriber. `set()` throws if handed the object it already holds, which is the
    // in-place mutation this module's `apply` used to be.
    const store = createStore({ ...EMPTY }, { label: 'estimator-link', logger: log });
    let offFrames = null;
    let offSignals = null;

    const publish = (next) => store.set(next);
    const state = () => store.get();

    /**
     * WHO IS ATTACHED IS DISCOVERY'S ANSWER, NOT A SECOND COPY HERE. The id derives from
     * the machine's deviceId, so it changes on a machine swap; a remembered one is the
     * defect. `state.sensorId` records which sensor the HELD FRAME came from, which is the
     * same id whenever a frame is held, because a detach drops the frame with it.
     */
    const attachedId = () => discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR);

    /** A frame arrived. The reader is the address layer's; this store learns no key name. */
    function onFrame(frame) {
        const reading = readEstimatorFrame(frame);
        if (!reading.ok) {
            // An error envelope reaching the frame path at all would be a Gate 3 bug; it is
            // handled here as what it is rather than stored as an empty frame, which is
            // exactly how the old link made a dead sensor look like a quiet one.
            publish({
                ...state(),
                lastError: reading.error,
                channels: null,
                present: Object.freeze([]),
                updatedAt: now(),
            });
            return;
        }
        const rev = reading.channels.rev;
        publish({
            ...state(),
            status: LINK_STATE.ATTACHED,
            sensorId: attachedId(),
            frame,
            channels: reading.channels,
            present: Object.freeze(presentChannels(reading.channels, ESTIMATOR_CHANNELS)),
            rev: typeof rev === 'number' ? rev : null,
            frames: state().frames + 1,
            lastError: null,
            updatedAt: now(),
        });
    }

    /**
     * A signal arrived. A CLOSE or an error envelope means the id we hold is finished —
     * drop the frame with it. Re-discovery is `rea-sensors.js`'s and it is already running;
     * what this must not do is keep charting the last frame of a machine that has gone.
     */
    function onSignal(signal) {
        if (!signal) return;
        if (signal.kind === WS_SIGNAL.OPEN) {
            // The attach itself is observable — a screen can say "waiting for the first
            // frame" rather than "no estimator", which are different states.
            publish({ ...state(), status: LINK_STATE.ATTACHED, sensorId: attachedId() });
            return;
        }
        if (signal.kind === WS_MESSAGE.ERROR || signal.kind === WS_SIGNAL.CLOSE) {
            if (log && log.info) log.info(`estimator link cleared: ${signal.kind}`);
            publish({
                ...EMPTY,
                status: LINK_STATE.DISCOVERING,
                frames: state().frames,
                lastError: signal.error || null,
                updatedAt: now(),
            });
        }
    }

    return {
        get state() { return store.get(); },

        /** Observe. The current state replays to a late subscriber. */
        subscribe(listener) { return store.subscribe(listener); },

        /**
         * Start. EXPLICIT and idempotent — the old link started its interval in its
         * constructor. Subscribing is what makes the estimator WANTED, which is what lets
         * discovery poll for it at all.
         */
        start() {
            if (offFrames) return this;
            offSignals = discovery.onSignal(SENSOR_KIND.PUCK_ESTIMATOR, onSignal);
            offFrames = discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, onFrame);
            publish({ ...state(), status: LINK_STATE.DISCOVERING });
            if (typeof discovery.start === 'function') discovery.start();
            return this;
        },

        /** Stop observing. The socket closes when the last subscriber leaves. */
        stop() {
            if (offFrames) offFrames();
            if (offSignals) offSignals();
            offFrames = null;
            offSignals = null;
            publish({ ...EMPTY });
            store.destroy();
        },

        /** The sensor id currently attached, or null. Asked of discovery every time, so it
         *  can never be a remembered id from the machine that has gone. */
        sensorId() { return attachedId(); },

        /** Is a channel carrying a measurement right now? Key presence, through the reader. */
        has(channel) { return state().present.includes(channel); },

        /**
         * Fold the latest estimator frame onto a sample — RETURNING A NEW OBJECT.
         *
         * The estimator keeps its own namespace: `sample.estimator`. It is never merged
         * into the machine's keys, under its own names or anyone else's. That is the
         * difference between a store and the old shim, and it is why a consumer can always
         * tell which instrument it is reading.
         *
         * With no frame held, `estimator.ok` is false and the channels are absent — the
         * state a chart draws as a gap.
         */
        apply(sample) {
            const base = sample && typeof sample === 'object' ? sample : {};
            const channels = state().channels;
            const folded = channels
                ? Object.freeze(Object.fromEntries(
                    ESTIMATOR_LINK_CHANNELS.map((channel) => [channel, channels[channel]]),
                ))
                : null;
            return Object.freeze({
                ...base,
                estimator: Object.freeze({
                    ok: folded !== null,
                    sensorId: state().sensorId,
                    rev: state().rev,
                    channels: folded === null ? ABSENT_LINK_CHANNELS : folded,
                    present: state().present,
                    updatedAt: state().updatedAt,
                }),
            });
        },
    };
}
