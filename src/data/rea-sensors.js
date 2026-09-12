/**
 * SENSOR DISCOVERY — polled, capability-gated, and RE-RUN ON SOCKET CLOSE.
 */

import { createFanout } from './rea-fanout.js';
import { WS_CHANNELS, WS_MESSAGE, sensorSnapshotPath } from './rea-ws-channels.js';
import { WS_SIGNAL } from './rea-sockets.js';
import { findSensorId, sensorKindOf, SENSOR_ID_SUFFIX } from './rea-names.js';
import { routeById } from './rea-routes.js';

/** The sensor kinds this skin knows how to read. Same keys as SENSOR_ID_SUFFIX. */
export const SENSOR_KIND = Object.freeze({
    PUCK_ESTIMATOR: 'puckEstimator',
    MILK_PROBE: 'milkProbe',
});

export const R3_CAPABILITY_GATE = Object.freeze({
    rNumber: 'R3',
    argument: 'capabilityGate',
    upstreamGap: 'GET /api/v1/machine/capabilities serves no estimator entry at 42f67f69',
    handlerFile: 'lib/src/services/webserver/de1handler.dart',
    handlerSymbol: 'De1Handler.addRoutes /api/v1/machine/capabilities',
    interim: 'the one R3-tagged adapter module (Gate 4) supplies this argument',
});

export const SENSORS_ROUTE_ID = 'getSensors';
export const SENSORS_ROUTE = routeById(SENSORS_ROUTE_ID).route;

/** Default discovery interval. 15 s: it is a poll for a thing
 *  that appears once per boot, not a telemetry rate. */
export const DEFAULT_DISCOVERY_MS = 15000;

export const REDISCOVERY_BACKOFF_MS = Object.freeze({
    first: 0,
    min: 1000,
    max: DEFAULT_DISCOVERY_MS,
});

export function readSensorListing(listing) {
    if (!Array.isArray(listing)) return null;
    const entries = [];
    for (const entry of listing) {
        const id = typeof entry === 'string' ? entry : entry && entry.id;
        if (typeof id !== 'string') return null;
        entries.push(Object.freeze({
            id,
            kind: sensorKindOf(id),
            info: entry && typeof entry === 'object' && entry.info && typeof entry.info === 'object'
                ? Object.freeze({ ...entry.info })
                : null,
        }));
    }
    return Object.freeze(entries);
}

export function createSensorDiscovery({
    transport,
    sockets,
    capabilityGate,
    intervalMs = DEFAULT_DISCOVERY_MS,
    logger = null,
    timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
} = {}) {
    if (!transport || typeof transport.get !== 'function') {
        throw new Error('createSensorDiscovery: transport must be injected');
    }
    if (!sockets || typeof sockets.channel !== 'function') {
        throw new Error('createSensorDiscovery: sockets must be injected');
    }
    if (typeof capabilityGate !== 'function') {
        throw new Error(
            'createSensorDiscovery: capabilityGate is required — see R3_CAPABILITY_GATE. '
            + 'The capability entry does not exist upstream yet; the R3-tagged adapter supplies it.',
        );
    }
    const log = logger && logger.scope ? logger.scope('sensors') : logger;
    const row = WS_CHANNELS.sensorSnapshot;

    /** Per-kind state. One entry appears the first time something subscribes to that kind. */
    const kinds = new Map();
    let running = false;
    let timer = null;
    let discovering = false;
    /** The pass in flight, so a re-check that arrives mid-pass waits for it. */
    let inPass = null;
    let lastListing = null;
    /** The delay the NEXT re-discovery is armed at. Reset by a frame, doubled by a retry. */
    let rediscoverDelayMs = REDISCOVERY_BACKOFF_MS.first;

    /** Arm a re-discovery after a close or a refusal, and widen the next one. */
    function scheduleRediscovery() {
        const delay = rediscoverDelayMs;
        rediscoverDelayMs = Math.min(
            delay === 0 ? REDISCOVERY_BACKOFF_MS.min : delay * 2,
            REDISCOVERY_BACKOFF_MS.max,
        );
        schedule(delay);
    }

    const note = (level, message) => {
        if (log && log[level]) log[level](message);
    };

    function kindState(kind) {
        if (!SENSOR_ID_SUFFIX[kind]) throw new Error(`sensors: unknown kind "${kind}"`);
        let state = kinds.get(kind);
        if (!state) {
            state = {
                kind,
                fanout: createFanout({ logger: log, label: `sensor:${kind}` }),
                channel: null,
                unsubscribeChannel: null,
                unsubscribeSignals: null,
                attachedId: null,
                gateOpen: null,      // null = not asked yet; the gate is never assumed
                lastError: null,
                recheck: false,
            };
            kinds.set(kind, state);
        }
        return state;
    }

    /** Rules 2 and 3: detach, forget the id, and let the next poll find the new one. */
    function detach(state, reason) {
        if (!state.channel) return;
        if (state.unsubscribeChannel) state.unsubscribeChannel();     // last subscriber -> closes
        if (state.unsubscribeSignals) state.unsubscribeSignals();
        state.unsubscribeChannel = null;
        state.unsubscribeSignals = null;
        state.channel = null;
        state.attachedId = null;
        state.fanout.clear();
        note('info', `sensor ${state.kind} detached (${reason})`);
    }

    function attach(state, sensorId) {
        if (state.attachedId === sensorId && state.channel) return;
        const path = sensorSnapshotPath(sensorId);
        if (state.channel) {
            // Close-before-open, via the one lifecycle policy. Never a second socket.
            detach(state, 'retargeting');
        }
        const key = `sensor:${state.kind}`;
        let channel = sockets.get(key);
        if (channel) {
            if (channel.path !== path) channel.retarget(path);
        } else {
            channel = sockets.channel({ key, path, channel: row });
        }
        state.channel = channel;
        state.attachedId = sensorId;
        state.unsubscribeSignals = channel.onSignal((signal) => {
            state.fanout.signal(signal);
            if (signal.kind === WS_MESSAGE.ERROR) {
                // `{"error":"not found"}` — the id is dead, not the reading.
                state.lastError = signal.error;
                detach(state, `error envelope: ${signal.error}`);
                scheduleRediscovery();
            } else if (signal.kind === WS_SIGNAL.CLOSE) {
                detach(state, 'socket closed');
                scheduleRediscovery();
            }
        });
        state.unsubscribeChannel = channel.subscribe((frame) => {
            rediscoverDelayMs = REDISCOVERY_BACKOFF_MS.first;
            state.fanout.emit(frame);
        });
        note('info', `sensor ${state.kind} attached: ${sensorId}`);
    }

    /* An attached kind is compared against the listing again only when it was marked, so
     * an id replaced under an unchanged machine is not invisible to every later pass. */
    const wantsPass = (state) => state.fanout.size() > 0 && (!state.attachedId || state.recheck);

    /** Mark one kind, or every kind, for the next pass. Returns how many were marked. */
    function mark(kind) {
        if (kind === null || kind === undefined) {
            for (const state of kinds.values()) state.recheck = true;
            return kinds.size;
        }
        if (!SENSOR_ID_SUFFIX[kind]) throw new Error(`sensors: unknown kind "${kind}"`);
        const state = kinds.get(kind);
        if (!state) return 0;
        state.recheck = true;
        return 1;
    }

    function runPass() {
        if (inPass) return inPass;
        inPass = Promise.resolve(discover()).finally(() => { inPass = null; });
        return inPass;
    }

    async function gateFor(state) {
        try {
            const allowed = await capabilityGate(state.kind);
            state.gateOpen = allowed === true;
        } catch (err) {
            state.gateOpen = null;
            state.lastError = String(err && err.message || err);
            note('warn', `capability gate for ${state.kind} failed: ${state.lastError}`);
        }
        return state.gateOpen === true;
    }

    /** One discovery pass over every kind something is subscribed to. */
    async function discover() {
        if (discovering) return;
        discovering = true;
        try {
            const wanted = [...kinds.values()].filter(wantsPass);
            if (wanted.length === 0) return;

            const gated = [];
            for (const state of wanted) {
                if (await gateFor(state)) { gated.push(state); continue; }
                if (state.gateOpen === false) state.recheck = false;
            }
            if (gated.length === 0) return;

            const response = await transport.get(SENSORS_ROUTE);
            if (!response.ok) {
                note('warn', `GET ${SENSORS_ROUTE} failed: ${response.message}`);
                return;
            }
            const listing = readSensorListing(response.data);
            if (listing === null) {
                note('warn', `GET ${SENSORS_ROUTE} answered a shape this build cannot read`);
                return;
            }
            lastListing = listing;
            for (const state of gated) {
                state.recheck = false;
                const id = findSensorId(response.data, state.kind);
                if (!id) continue;                          // not registered yet; poll again
                attach(state, id);
            }
        } finally {
            discovering = false;
            reschedule();
        }
    }

    function schedule(delay) {
        if (!running) return;
        if (timer !== null) timers.clearTimeout(timer);
        timer = timers.setTimeout(() => {
            timer = null;
            runPass();
        }, delay);
    }

    /** Rule 1's other half: the poll runs only while something is missing AND wanted. */
    function reschedule() {
        if (!running) return;
        const outstanding = [...kinds.values()].some(wantsPass);
        if (!outstanding) {
            if (timer !== null) timers.clearTimeout(timer);
            timer = null;
            return;
        }
        schedule(intervalMs);
    }

    return {
        /**
         * Start discovering. EXPLICIT, because the old link started its interval at
         * construction and could therefore be polling before anything wanted an answer.
         */
        start() {
            if (running) return;
            running = true;
            runPass();
            return this;
        },

        /** Stop polling and close every sensor socket. */
        stop() {
            running = false;
            if (timer !== null) timers.clearTimeout(timer);
            timer = null;
            for (const state of kinds.values()) {
                detach(state, 'stopped');
                state.fanout.reset();
            }
            kinds.clear();
        },

        subscribe(kind, listener) {
            const state = kindState(kind);
            const off = state.fanout.subscribe(listener);
            if (running) schedule(0);
            let released = false;
            return () => {
                if (released) return;
                released = true;
                off();
                if (state.fanout.size() === 0) detach(state, 'no subscribers');
            };
        },

        /** Observe one sensor's signals: error envelopes, opens and closes. */
        onSignal(kind, listener) {
            return kindState(kind).fanout.onSignal(listener);
        },

        /** Force a pass now — after a machine connect, say. Returns the pass's promise. */
        discoverNow() {
            return runPass();
        },

        /**
         * Mark a kind — or every kind, when none is named — to be compared against the
         * listing again, and run a pass. Resolves when that pass has finished.
         */
        invalidate(kind = null) {
            const marked = mark(kind);
            if (marked === 0 || !running) return Promise.resolve();
            return inPass ? inPass.then(() => runPass()) : runPass();
        },

        /** The id currently attached for a kind, or null. */
        attachedId(kind) {
            const state = kinds.get(kind);
            return state ? state.attachedId : null;
        },

        /** The last frame for a kind, or null. Null while detached, always. */
        last(kind) {
            const state = kinds.get(kind);
            return state ? state.fanout.last() : null;
        },

        /** What is true right now, per kind. */
        status() {
            return {
                running,
                polling: timer !== null,
                /** What the next re-discovery after a close would wait. 0 = the free retry. */
                rediscoverDelayMs,
                lastListing,
                kinds: [...kinds.values()].map((s) => ({
                    kind: s.kind,
                    subscribers: s.fanout.size(),
                    attachedId: s.attachedId,
                    gateOpen: s.gateOpen,
                    lastError: s.lastError,
                    frames: s.fanout.frameCount(),
                })),
            };
        },
    };
}
