/**
 * THE LIVE LAYER, ASSEMBLED — one store per feed, and the wiring that fills them.
 */

import { createFeedStore, DEFAULT_STALE_AFTER_MS, FEED_STATUS } from './feed-store.js';
import { readShotStateFrame, readDisplayFrame, readUpdateFrame } from './feed-readers.js';
import { createShotBuffer, attachShotBuffer } from './shot-buffer.js';
import { WS_CHANNELS } from '../data/rea-ws-channels.js';
import { readDevicesFrame } from '../data/rea-devices.js';
import { SENSOR_KIND } from '../data/rea-sensors.js';
import {
    readMachineSnapshot,
    readScaleSnapshot,
    readWaterLevels,
    readEstimatorFrame,
    readMilkProbeFrame,
    sensorKindOf,
} from '../data/rea-address.js';

/** The feed names, so no screen spells one wrong and no store is created twice. */
export const FEED = Object.freeze({
    MACHINE: 'machineSnapshot',
    SCALE: 'scale',
    SHOT_STATE: 'shotState',
    CONNECTION: 'connection',
    DISPLAY: 'display',
    UPDATE: 'update',
    ESTIMATOR: 'estimator',
    MILK_PROBE: 'milkProbe',
    /** The tank's level and its refill threshold, in millimetres. */
    WATER: 'waterLevels',
});

export function sensorSource(discovery, kind) {
    if (!discovery || typeof discovery.subscribe !== 'function') {
        throw new Error('sensorSource: a sensor discovery is required');
    }
    return {
        subscribe: (listener) => discovery.subscribe(kind, listener),
        onSignal: (listener) => discovery.onSignal(kind, listener),
        last: () => discovery.last(kind),
    };
}

export function sourceSelectorHooks(selector) {
    if (!selector || typeof selector.beginShot !== 'function' || typeof selector.endShot !== 'function') {
        throw new Error('sourceSelectorHooks: a shot source selector is required');
    }
    const estimatorFrameOf = (sample) => {
        const sensors = sample && sample.sensors;
        if (!sensors || typeof sensors !== 'object') return null;
        for (const [id, frame] of Object.entries(sensors)) {
            if (sensorKindOf(id) === SENSOR_KIND.PUCK_ESTIMATOR) return frame;
        }
        return null;
    };
    return {
        chooseSources: ({ shotId, sample }) => selector.beginShot({
            machine: readMachineSnapshot(sample && sample.machine),
            estimator: readEstimatorFrame(estimatorFrameOf(sample)),
        }, { shotId }).sources,
        releaseSources: () => selector.endShot(),
    };
}

export function createLiveStores({
    sockets,
    devicesLink = null,
    sensorDiscovery = null,
    clock = () => Date.now(),
    logger = null,
    staleAfterMs = {},
    sourceSelector = null,
    chooseSources = null,
    releaseSources = null,
} = {}) {
    if (!sockets || typeof sockets.channel !== 'function') {
        throw new Error('createLiveStores: sockets must be injected (see createReaSockets)');
    }
    const budget = { ...DEFAULT_STALE_AFTER_MS, ...staleAfterMs };
    const make = (label, read, ms) => createFeedStore({ label, read, clock, logger, staleAfterMs: ms });

    const feeds = {
        /** The workhorse, ~10 Hz in a shot. Derived channels are omitted, not null —
         *  `readMachineSnapshot` decides that by key presence and nothing here re-gates it. */
        [FEED.MACHINE]: make(FEED.MACHINE, readMachineSnapshot, budget.machineSnapshot),
        [FEED.SCALE]: make(FEED.SCALE, readScaleSnapshot, budget.scale),
        /** The sequencer's own view of the shot: consumed, not re-derived from substates. */
        [FEED.SHOT_STATE]: make(FEED.SHOT_STATE, readShotStateFrame, budget.shotState),
        [FEED.CONNECTION]: make(FEED.CONNECTION, readDevicesFrame, budget.devices),
        [FEED.DISPLAY]: make(FEED.DISPLAY, readDisplayFrame, budget.display),
        [FEED.UPDATE]: make(FEED.UPDATE, readUpdateFrame, budget.update),
        [FEED.ESTIMATOR]: make(FEED.ESTIMATOR, readEstimatorFrame, budget.sensor),
        [FEED.MILK_PROBE]: make(FEED.MILK_PROBE, readMilkProbeFrame, budget.sensor),
        /** THE TANK. Sends on change, so its budget is `null` — see the token's own note:
         *  a full tank nobody draws from is silent, and a silent tank is not a stale one. */
        [FEED.WATER]: make(FEED.WATER, readWaterLevels, budget.waterLevels),
    };

    if (sourceSelector && (chooseSources || releaseSources)) {
        throw new Error('createLiveStores: pass sourceSelector OR chooseSources/releaseSources, not both');
    }
    const b6 = sourceSelector ? sourceSelectorHooks(sourceSelector) : { chooseSources, releaseSources };
    const shot = createShotBuffer({ clock, logger, ...b6 });

    const sensorsForSample = () => {
        if (!sensorDiscovery) return undefined;
        const map = {};
        for (const [kind, name] of [[SENSOR_KIND.PUCK_ESTIMATOR, FEED.ESTIMATOR], [SENSOR_KIND.MILK_PROBE, FEED.MILK_PROBE]]) {
            const id = sensorDiscovery.attachedId(kind);
            if (!id) continue;
            const state = feeds[name].get();
            if (state.status !== FEED_STATUS.LIVE || state.frame === null) continue;
            map[id] = state.frame;
        }
        return Object.keys(map).length > 0 ? map : undefined;
    };

    let detachers = [];

    const channelFor = (row) => sockets.channel({ key: row.key, path: row.path, channel: row });

    let displayChannel = null;

    let updateChannel = null;

    const live = {
        feeds,
        shot,
        /** The answer path, or null if no link was injected. Never re-implemented here. */
        devices: devicesLink,
        sensorDiscovery,

        /** One feed by name. Throws on a name that does not exist, rather than answering
         *  undefined and letting a screen render blank for ever. */
        feed(name) {
            const found = feeds[name];
            if (!found) throw new Error(`liveStores: no feed named "${name}"`);
            return found;
        },

        attachAll() {
            if (detachers.length > 0) return live;
            detachers = [
                feeds[FEED.MACHINE].attach(channelFor(WS_CHANNELS.machineSnapshot)),
                feeds[FEED.SCALE].attach(channelFor(WS_CHANNELS.scaleSnapshot)),
                feeds[FEED.SHOT_STATE].attach(channelFor(WS_CHANNELS.shotState)),
                feeds[FEED.CONNECTION].attach(devicesLink ? devicesLink.channel : channelFor(WS_CHANNELS.devices)),
                (() => {
                    displayChannel = channelFor(WS_CHANNELS.display);
                    return feeds[FEED.DISPLAY].attach(displayChannel);
                })(),
                (() => {
                    updateChannel = channelFor(WS_CHANNELS.update);
                    return feeds[FEED.UPDATE].attach(updateChannel);
                })(),
                feeds[FEED.WATER].attach(channelFor(WS_CHANNELS.waterLevels)),
            ];
            if (sensorDiscovery) {
                detachers.push(
                    feeds[FEED.ESTIMATOR].attach(sensorSource(sensorDiscovery, SENSOR_KIND.PUCK_ESTIMATOR)),
                    feeds[FEED.MILK_PROBE].attach(sensorSource(sensorDiscovery, SENSOR_KIND.MILK_PROBE)),
                );
                sensorDiscovery.start();
            }
            detachers.push(attachShotBuffer({
                buffer: shot,
                machine: feeds[FEED.MACHINE],
                shotState: feeds[FEED.SHOT_STATE],
                scale: feeds[FEED.SCALE],
                sensors: sensorsForSample,
            }));
            return live;
        },

        /** Close every feed. Values survive, marked stale — the deletion rule. */
        detachAll() {
            for (const detach of detachers) detach();
            detachers = [];
            displayChannel = null;
            updateChannel = null;
            if (sensorDiscovery) sensorDiscovery.stop();
            return live;
        },

        attached() {
            return detachers.length > 0;
        },

        /**
         * Re-classify every feed's staleness. Driven by whatever already ticks — never by a
         * timer this layer owns. Publishes only where the answer changed.
         */
        refreshStaleness(now = clock()) {
            for (const feed of Object.values(feeds)) feed.refreshStaleness(now);
        },

        setBrightness(value) {
            if (!displayChannel) return { ok: false, reason: 'the display feed is not attached' };
            const n = Math.round(Number(value));
            if (!Number.isFinite(n)) return { ok: false, reason: 'brightness must be a number' };
            const clamped = Math.min(100, Math.max(0, n));
            return displayChannel.send({ command: 'setBrightness', brightness: clamped });
        },

        setWakeLock(on) {
            if (!displayChannel) return { ok: false, reason: 'the display feed is not attached' };
            return displayChannel.send({ command: on === true ? 'requestWakeLock' : 'releaseWakeLock' });
        },

        checkAppUpdate() {
            if (!updateChannel) return { ok: false, reason: 'the update feed is not attached' };
            return updateChannel.send({ command: 'check' });
        },

        installAppUpdate() {
            if (!updateChannel) return { ok: false, reason: 'the update feed is not attached' };
            return updateChannel.send({ command: 'install' });
        },

        /** What is true right now, per feed — the diagnostic a bench session reads. */
        status(now = clock()) {
            return Object.fromEntries(Object.entries(feeds).map(([name, feed]) => {
                const state = feed.get();
                return [name, {
                    status: state.status,
                    frames: state.frames,
                    ageMs: feed.ageMs(now),
                    sourceOpen: state.sourceOpen,
                    error: state.error,
                    attached: feed.attached(),
                }];
            }));
        },

        destroy() {
            live.detachAll();
            for (const feed of Object.values(feeds)) feed.destroy();
            shot.destroy();
        },
    };

    return live;
}
