/**
 * THE ESTIMATOR LINK — the puck estimator's live frames, as a store.
 */

import { createStore } from './store.js';
import { readEstimatorFrame, presentChannels } from '../data/rea-address.js';
import { allAbsent, ABSENCE } from '../data/reading.js';
import { SENSOR_KIND } from '../data/rea-sensors.js';
import { ESTIMATOR_CHANNELS, ESTIMATOR_MEASURED_POWER_MIN_REV } from '../data/rea-names.js';
import { WS_SIGNAL } from '../data/rea-sockets.js';
import { WS_MESSAGE } from '../data/rea-ws-channels.js';

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

export function createEstimatorLinkStore({ discovery, logger = null, now = () => Date.now() } = {}) {
    if (!discovery || typeof discovery.subscribe !== 'function' || typeof discovery.onSignal !== 'function') {
        throw new Error('createEstimatorLinkStore: sensor discovery must be injected (see createSensorDiscovery)');
    }
    const log = logger && logger.scope ? logger.scope('estimator') : logger;
    const store = createStore({ ...EMPTY }, { label: 'estimator-link', logger: log });
    let offFrames = null;
    let offSignals = null;

    const publish = (next) => store.set(next);
    const state = () => store.get();

    const attachedId = () => discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR);

    /** A frame arrived. The reader is the address layer's; this store learns no key name. */
    function onFrame(frame) {
        const reading = readEstimatorFrame(frame);
        if (!reading.ok) {
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

    function onSignal(signal) {
        if (!signal) return;
        if (signal.kind === WS_SIGNAL.OPEN) {
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
