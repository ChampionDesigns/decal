// THE LIVE LAYER, ASSEMBLED — one store per feed, and the wiring that fills them.
//
// SCOPE Part 3 §4 names the seven: machine snapshot, scale, shot state, connection (the
// FULL B8 state), display, update, sensors. This module builds exactly those, over Gate 3's
// sockets and Gate 2's readers, and adds the shot-so-far buffer they feed.
//
// WHY AN ASSEMBLY FUNCTION AND NOT SEVEN MODULE-LEVEL INSTANCES: because seven module-level
// instances IS pattern C — the sharing would again depend on ES-module singleton semantics,
// and nothing could be built twice in one process, which is the property every test in this
// tree relies on. The app shell calls this once and passes the result down; a test calls it
// with fakes. `src/lib/i18n.js` keeps a module-level instance because translation is
// genuinely document-scoped and has no source to inject; machine state has both.
//
// EVERY DEPENDENCY IS INJECTED, INCLUDING TIME. No `window`, no `fetch`, no `Date.now` that
// a test cannot move, no timer that starts itself. `estimator-link.js:120-121` started an
// interval at construction and polled for ever whether anything wanted an answer; nothing
// in this layer starts until `attachAll()`.
//
// THE ANSWER PATH (B8) IS NOT A STORE. `/ws/v1/devices` is consumed as the connection feed,
// but the reply — `PUT /api/v1/devices/connect {deviceId}` — is `rea-devices.js`'s
// `createDevicesLink`, which is passed in and re-exposed here. Reading the connection state
// without being able to answer it is the old skin's failure: ReaPrime parks in a selection
// session while `pendingAmbiguity` is set and suppresses recovery until the choice arrives.

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

/**
 * Adapt one sensor kind to the `{subscribe, onSignal, last}` shape a feed store attaches
 * to. `createSensorDiscovery` is per-KIND by argument rather than by instance, because two
 * ids for one kind are one channel moved, not two channels.
 */
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

/**
 * Adapt `shot-source-selector.js` (B6) to the shot buffer's two hooks.
 *
 * The selector decides from an ADDRESSED sample — `{machine, estimator}` as the address
 * layer reads them — while the buffer holds raw frames in the recorded shape, so the
 * addressing happens here, in the one module that already knows both sides. The estimator
 * frame is found by SENSOR KIND, never by spelling an id: the id is
 * `<machineDeviceId>-puckestimator` and changes with the machine.
 *
 * `beginShot` is called once per shot on its first sample and `endShot` when the shot
 * closes, so a held decision cannot outlive the shot it was made for.
 *
 * @param {{beginShot: Function, endShot: Function}} selector
 * @returns {{chooseSources: Function, releaseSources: Function}}
 */
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

/**
 * @param {object} deps
 * @param {object} deps.sockets              `createReaSockets(...)`
 * @param {object} [deps.devicesLink]        `createDevicesLink(...)` — the B8 answer path
 * @param {object} [deps.sensorDiscovery]    `createSensorDiscovery(...)`
 * @param {() => number} [deps.clock]
 * @param {object} [deps.logger]
 * @param {object} [deps.staleAfterMs]       per-feed overrides of DEFAULT_STALE_AFTER_MS
 * @param {{beginShot: Function, endShot: Function}} [deps.sourceSelector]
 *        B6 — `createShotSourceSelector()`. Adapted through `sourceSelectorHooks`; pass
 *        this rather than the two hooks unless a test needs them separately.
 * @param {(context: {shotId: string|null, sample: object}) => object} [deps.chooseSources]
 * @param {() => void} [deps.releaseSources]
 */
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
        /** THE ONE GRAVIMETRIC SOURCE. `weightFlow` is server-smoothed and identical on
         *  Bengle and DE1 — there is no machine-type branch anywhere in this layer. */
        [FEED.SCALE]: make(FEED.SCALE, readScaleSnapshot, budget.scale),
        /** The sequencer's own view of the shot: consumed, not re-derived from substates. */
        [FEED.SHOT_STATE]: make(FEED.SHOT_STATE, readShotStateFrame, budget.shotState),
        /** B8 in full — phases, found-device lists, `pendingAmbiguity`, the error object.
         *  A malformed frame reads as `null`, which is DIFFERENT from an empty list, so a
         *  partial frame is never rendered as "the machine went away". */
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
        // Two B6 wirings at once is two decisions per shot. Refused at construction rather
        // than resolved by precedence, which would make the loser invisible.
        throw new Error('createLiveStores: pass sourceSelector OR chooseSources/releaseSources, not both');
    }
    const b6 = sourceSelector ? sourceSelectorHooks(sourceSelector) : { chooseSources, releaseSources };
    const shot = createShotBuffer({ clock, logger, ...b6 });

    /**
     * The sensors map for a live sample, keyed by SENSOR ID exactly as a recorded
     * measurement keys it — the id comes from discovery, never spelled here.
     *
     * A kind that is not currently attached, or whose feed is not live, contributes
     * NOTHING: an omitted key is "no reading", which is what the address layer expects,
     * where a stale frame copied forward would be a measurement that never happened.
     */
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

    /* THE DISPLAY CHANNEL IS HELD, because it is the only one this app SENDS on.
     *
     * Every other channel here is read-only: a feed attaches, frames arrive, nothing goes
     * the other way. `/ws/v1/display` is different — it carries `setBrightness`,
     * `requestWakeLock` and `releaseWakeLock`, and until 26 August 2026 nothing in the skin
     * sent any of them. The Brightness page wrote a device-scoped key, no reader existed,
     * and the panel never changed; the screensaver emitted its own dim event and nothing
     * listened for that either. Both halves were finished and neither was joined.
     *
     * ONE CHANNEL, NOT TWO. Opening a second socket to the same path to send on would give
     * the display two connections and two reconnect clocks, so the channel the DISPLAY feed
     * attaches to is the channel this sends on. It exists only while `attachAll()` has run,
     * which is exactly when a command could be delivered anyway. */
    let displayChannel = null;

    /* AND THE UPDATE CHANNEL, HELD FOR THE SAME REASON AND ADOPTED LATE (27 August 2026).
     *
     * `/ws/v1/update` has been ATTACHED on every boot since this layer was written, its
     * frames parsed by a complete reader carrying phase, currentVersion, latestVersion,
     * releaseNotes, releaseUrl, installable, progress and error — and until this date
     * `FEED.UPDATE` appeared nowhere outside this file and `feed-readers.js`. A socket held
     * open for the life of the app, its frames read and then thrown away: the finished half
     * with no other half this fork exists to remove. Updates > Skin / App is the consumer,
     * and the two commands below are what turn that reading into a page a person can act
     * on. */
    let updateChannel = null;

    const live = {
        feeds,
        shot,
        /** The B8 answer path, or null if no link was injected. Never re-implemented here. */
        devices: devicesLink,
        sensorDiscovery,

        /** One feed by name. Throws on a name that does not exist, rather than answering
         *  undefined and letting a screen render blank for ever. */
        feed(name) {
            const found = feeds[name];
            if (!found) throw new Error(`liveStores: no feed named "${name}"`);
            return found;
        },

        /**
         * Open every feed. Subscribing is what opens a socket (the socket layer's rule E),
         * so this is the moment the app starts talking to ReaPrime — an explicit act, at a
         * time the caller chooses.
         */
        attachAll() {
            if (detachers.length > 0) return live;
            detachers = [
                feeds[FEED.MACHINE].attach(channelFor(WS_CHANNELS.machineSnapshot)),
                feeds[FEED.SCALE].attach(channelFor(WS_CHANNELS.scaleSnapshot)),
                feeds[FEED.SHOT_STATE].attach(channelFor(WS_CHANNELS.shotState)),
                // The devices link owns this channel when one was injected, so the answer
                // path and the state feed are the same socket — not two.
                feeds[FEED.CONNECTION].attach(devicesLink ? devicesLink.channel : channelFor(WS_CHANNELS.devices)),
                (() => {
                    displayChannel = channelFor(WS_CHANNELS.display);
                    return feeds[FEED.DISPLAY].attach(displayChannel);
                })(),
                /* THE UPDATE CHANNEL IS HELD, exactly as the display channel above it is,
                 * and for the same reason: its two commands ride the socket the feed is
                 * already attached to. Opening a second connection to `/ws/v1/update` to
                 * send on would give one path two sockets and two reconnect clocks. */
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

        /**
         * Set the tablet's panel brightness, 0..100.
         *
         * THE HANDLER'S FAILURE MODE IS SILENCE. `display_handler.dart` checks
         * `brightness is int && 0..100` and, for anything else, writes a log line and sends
         * NO reply — a caller that passes 100.0, "80" or 120 gets exactly what it gets for a
         * value that worked. The channel table's own `validateCommand` catches that before
         * it leaves, which is why this rounds and clamps here rather than trusting a slider
         * to have produced an integer.
         *
         * A REFUSAL IS REPORTED, NEVER SWALLOWED. `{ok: false, reason}` comes back when the
         * socket is shut or the value was rejected, and the caller decides what to show —
         * a brightness that silently did not change is the defect this closes.
         *
         * @param {number} value 0..100
         * @returns {{ok: true}|{ok: false, reason: string}}
         */
        setBrightness(value) {
            if (!displayChannel) return { ok: false, reason: 'the display feed is not attached' };
            const n = Math.round(Number(value));
            if (!Number.isFinite(n)) return { ok: false, reason: 'brightness must be a number' };
            const clamped = Math.min(100, Math.max(0, n));
            return displayChannel.send({ command: 'setBrightness', brightness: clamped });
        },

        /**
         * Hold the tablet awake, or stop holding it.
         *
         * THE WAKE-LOCK SWITCH WROTE A KEY NOTHING READ. `wakeLockEnabled` had a row on the
         * Wake Lock page, a route in `storage-routes.js` and a default of `true`, and a
         * sweep of `src/` on 26 August 2026 found those three declarations and NO reader at
         * all — no writer of the lock, no command, nothing. The tablet's screen slept
         * exactly as the operating system decided, whichever way the switch was set. That is
         * this fork's own defect class: a finished half with no other half.
         *
         * Meanwhile the skin already carried FOUR ways to take the lock and used none of
         * them: `requestWakeLock` and `releaseWakeLock` are declared commands on the display
         * channel (`rea-ws-channels.js`), and `postDisplayWakelock` / `deleteDisplayWakelock`
         * are in the generated route table with `DisplayState` as their reply.
         *
         * THE SOCKET PAIR, NOT THE REST PAIR, and the choice is not a coin toss. The display
         * FEED is already attached to this channel, so the command rides a connection this
         * layer owns and no new contract row is needed. It also buys the behaviour the
         * setting's own footnote promises — "The wake lock releases by itself when the
         * connection to the machine drops": `display_handler.dart` tracks `overrideRequested`
         * per socket and calls `releaseWakeLock()` in both `onDone` and `onError`. Over REST
         * that sentence would simply be false, because a REST-taken lock outlives the page
         * that asked for it.
         *
         * A REFUSAL IS REPORTED, exactly as `setBrightness` reports one. There is no value to
         * validate here — the command name IS the value — so the shape check `setBrightness`
         * needs has no counterpart, and the strict `=== true` is what keeps a truthy
         * non-boolean from being read as a request to hold the screen awake.
         *
         * @param {boolean} on  true takes the override, false releases it
         * @returns {{ok: true}|{ok: false, reason: string}}
         */
        setWakeLock(on) {
            if (!displayChannel) return { ok: false, reason: 'the display feed is not attached' };
            return displayChannel.send({ command: on === true ? 'requestWakeLock' : 'releaseWakeLock' });
        },

        /**
         * Ask ReaPrime to look for a newer build of itself.
         *
         * THE ONLY THING THAT MOVES `latestVersion` OFF NULL. `UpdateCheckService` seeds its
         * state at `idle` with `latestVersion: null` and re-checks on a twelve-hour timer,
         * so a tablet booted an hour ago legitimately does not know whether an update
         * exists. Null is "not known yet" and never "up to date" — `readUpdateFrame` says so
         * in its own comment — and this command is how a person turns the first into the
         * second without waiting half a day.
         *
         * NOTHING IS RETURNED BUT THE SEND. `requestCheck()` answers nothing and refuses
         * silently while a check, a download or an install is already running
         * (`_inProgress`), so the ANSWER arrives as the next frame on the feed and nowhere
         * else. A caller that awaited a result here would be awaiting a promise the server
         * never makes.
         *
         * @returns {{ok: true}|{ok: false, reason: string}}
         */
        checkAppUpdate() {
            if (!updateChannel) return { ok: false, reason: 'the update feed is not attached' };
            return updateChannel.send({ command: 'check' });
        },

        /**
         * Ask ReaPrime to download and install the update it has found.
         *
         * THE PLATFORM DECIDES, AND IT SAYS SO IN THE FRAME. `canInstall` is `Platform
         * .isAndroid`, and `installable` on every frame is `_isAndroid && hasUpdate` — so
         * the caller already knows, from the reading it is rendering, whether this command
         * can do anything. A skin that sniffed the user agent instead would be answering a
         * question the server has already answered.
         *
         * AN UNSUPPORTED PLATFORM REPLIES `{error, url}` RATHER THAN A FRAME, which is an
         * error envelope carrying the fallback URL — a signal with a payload. This layer
         * does not chase it: `releaseUrl` is on every frame anyway, so the surface can offer
         * the link from what it is already holding rather than from a reply that only
         * arrives after a press that was never going to work.
         *
         * @returns {{ok: true}|{ok: false, reason: string}}
         */
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
