// SENSOR DISCOVERY — polled, capability-gated, and RE-RUN ON SOCKET CLOSE.
//
// SCOPE Part 3 §2 (sensors row) and Part 6, `estimator-link.js`. Sensor presence has NO
// PUSH SIGNAL: bridge-registered sensors never appear on `/ws/v1/devices`, so polling
// `GET /api/v1/sensors` is necessary, not lazy. ReaPrime registers the puck estimator
// lazily, on the first decoded frame, so "not there yet" is the normal state at boot.
//
// THE LIVE DEFECT THIS MODULE EXISTS TO NOT REBUILD (`estimator-link.js`, discovery loop):
// IT NEVER RE-DISCOVERS. `if (stopped || socket) return;` — once a socket exists, discovery
// stops for good. The sensor id is derived from the MACHINE's deviceId, so swapping the
// machine mints a new id; the old link dials the dead one for ever while
// `sensors_handler.dart` answers `{"error":"not found"}` and closes the socket. The frame
// mapper turns that envelope into an empty update, every consumer's "estimator absent"
// branch takes over, and the derived channel is charted in the estimator's place with
// NOTHING SURFACED. That is the fallback-path failure mode in miniature, and it is why
// this module has none.
//
// THE THREE RULES:
//
//  1. GATE THE POLL ON CAPABILITIES (A3). A 15 s poll against a machine with no estimator
//     runs for ever, on a route with no cache validation (`sensors_handler.dart` answers
//     `jsonOk`, not `jsonOkConditional` — there is no ETag to save it).
//  2. RE-RUN DISCOVERY ON SOCKET CLOSE. The close IS the signal. It costs one GET and it
//     is the only thing that makes a machine swap visible.
//  3. AN ERROR ENVELOPE IS A SIGNAL, NOT A FRAME. `{"error":"not found"}` means the id is
//     dead — detach and re-discover — and never "the estimator read nothing this tick".
//
// ── R3: THE CAPABILITY GATE IS AN INJECTION POINT, ON PURPOSE ────────────────────────
// `GET /api/v1/machine/capabilities` serves SEVEN entries at 2b047d02 (`de1handler.dart`
// `addRoutes`: cupWarmer, integratedScale, stopAtWeight, ledStrip, scaleCalibration,
// preheat, wakeSchedule) and NONE of them is the estimator. The entry has to be added
// upstream — that is R3 — and upstream is out of the overnight run. So this module does
// not read capabilities itself: it takes `capabilityGate` as a REQUIRED argument, whose
// interim implementation is the one R3-tagged adapter module (Gate 4). One named seam,
// tagged with its R-number, is the decided interim; a local guess at "does this machine
// have an estimator" would be exactly the invented answer this wave exists to delete.
//
// There is deliberately NO default gate. A missing gate throws at construction rather than
// defaulting to "poll anyway" (which reinstates the defect) or "never poll" (which hides
// the estimator on a machine that has one).

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

/**
 * THE R3 SEAM. Name it in one place so a grep for "R3" finds the gate, the adapter and the
 * upstream ask together.
 *
 * `capabilityGate(kind)` -> boolean | Promise<boolean>. True means "this machine can have
 * a sensor of this kind, so polling for it is worth doing".
 */
export const R3_CAPABILITY_GATE = Object.freeze({
    rNumber: 'R3',
    argument: 'capabilityGate',
    upstreamGap: 'GET /api/v1/machine/capabilities serves no estimator entry at 2b047d02',
    handlerFile: 'lib/src/services/webserver/de1handler.dart',
    handlerSymbol: 'De1Handler.addRoutes /api/v1/machine/capabilities',
    interim: 'the one R3-tagged adapter module (Gate 4) supplies this argument',
});

/**
 * `GET /api/v1/sensors`, relative to the transport's `/api/v1` base — READ OUT OF THE
 * GENERATED TABLE rather than spelled here. A hand-written path beside a generated table of
 * every documented path is a second copy of a server truth, and this one was written while
 * the table already carried the row.
 */
export const SENSORS_ROUTE_ID = 'getSensors';
export const SENSORS_ROUTE = routeById(SENSORS_ROUTE_ID).route;

/** Default discovery interval. `estimator-link.js`'s 15 s, kept — it is a poll for a thing
 *  that appears once per boot, not a telemetry rate. */
export const DEFAULT_DISCOVERY_MS = 15000;

/**
 * RE-DISCOVERY BACKOFF — the bound rule 2 did not have.
 *
 * Rule 2 says the close IS the signal and "it costs one GET", and for the case it was
 * written for — a machine swap, where the listing has moved on — that is exactly right:
 * the first retry is IMMEDIATE and stays immediate for every sensor that has ever
 * delivered a frame.
 *
 * What it did not survive is the listing and the socket DISAGREEING: an id
 * `GET /api/v1/sensors` still carries while `sensors_handler.dart` answers
 * `{"error":"not found"}` and closes. Both the error and the close handler re-armed at
 * 0 ms and discovery re-attached at once, so four rounds produced five sockets and five
 * GETs with no delay and no cap. The window is real — `sensors_handler.dart` shares
 * `_controller.sensors` between the listing and the upgrade, so a deregistration mid-flight
 * puts them out of step — and unbounded is the wrong answer to it.
 *
 * So: the first retry is free, and every retry after one that produced NO FRAME doubles to
 * the poll interval. A frame is what resets it, because a frame is the only evidence the
 * attachment worked.
 */
export const REDISCOVERY_BACKOFF_MS = Object.freeze({
    first: 0,
    min: 1000,
    max: DEFAULT_DISCOVERY_MS,
});

/**
 * Read a `GET /api/v1/sensors` listing: `[{id, info}, …]` (`SensorsHandler.addRoutes`).
 *
 * `info` is `SensorInfo.toJson`: `{name, vendor, data: [{key, type, unit}], commands}`.
 * The channel list is DESCRIPTIVE and is not a validity signal — a channel the firmware
 * has not observed is omitted from the frame regardless of what `info` advertises. Read
 * frames through rea-address.js, not through this.
 */
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

/**
 * @param {object} deps
 * @param {object} deps.transport                     createReaTransport(...)
 * @param {object} deps.sockets                       createReaSockets(...)
 * @param {(kind: string) => boolean|Promise<boolean>} deps.capabilityGate  R3 seam, required
 * @param {number} [deps.intervalMs]
 * @param {object} [deps.logger]
 * @param {{setTimeout: Function, clearTimeout: Function}} [deps.timers]  injected for tests
 */
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
        // The replay value goes with the socket: a frame from the PREVIOUS sensor id
        // replayed to a new subscriber is the machine-swap defect wearing a disguise.
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
        // One key per KIND, not per id: two ids for the same kind are the same channel
        // moved, which is a retarget (close-before-open, replay dropped) and not a second
        // socket. `sockets.channel` refuses to rebind a key silently, so the move is
        // spelled out here.
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
            // A FRAME is the only evidence the attachment worked, so it is the only thing
            // that returns the next re-discovery to immediate.
            rediscoverDelayMs = REDISCOVERY_BACKOFF_MS.first;
            state.fanout.emit(frame);
        });
        note('info', `sensor ${state.kind} attached: ${sensorId}`);
    }

    async function gateFor(state) {
        try {
            const allowed = await capabilityGate(state.kind);
            state.gateOpen = allowed === true;
        } catch (err) {
            // A gate that failed to answer is NOT a yes and NOT a no. Recorded and
            // retried; nothing is assumed on its behalf.
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
            const wanted = [...kinds.values()].filter((s) => s.fanout.size() > 0 && !s.attachedId);
            if (wanted.length === 0) return;

            const gated = [];
            for (const state of wanted) {
                if (await gateFor(state)) gated.push(state);
            }
            if (gated.length === 0) return;

            const response = await transport.get(SENSORS_ROUTE);
            if (!response.ok) {
                // No listing means no answer. It does not mean no sensors — nothing is
                // detached here, and the next pass asks again.
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
            discover();
        }, delay);
    }

    /** Rule 1's other half: the poll runs only while something is missing AND wanted. */
    function reschedule() {
        if (!running) return;
        const outstanding = [...kinds.values()].some((s) => s.fanout.size() > 0 && !s.attachedId);
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
            discover();
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

        /**
         * Observe one sensor's frames. RAW frames — reading them is rea-address.js's job
         * (`readEstimatorFrame`, `readMilkProbeFrame`), so there is one reader of ReaPrime's
         * names and this module never learns a channel name.
         *
         * The first subscriber makes the kind wanted and triggers a discovery pass; the
         * last one to leave detaches it, which closes the socket.
         */
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
            return discover();
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
