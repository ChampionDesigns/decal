// A MACHINE-INFO STORE — one store, one route: GET /api/v1/machine/info.
//
// WHY THIS FILE EXISTS AT ALL. The capability store is explicit that it will not fetch
// this: "Feed in a `GET /api/v1/machine/info` body. The store does not fetch it — one
// store, one route — and until this arrives the two info-backed gates answer `unknown`"
// (`capabilities-store.js` `applyMachineInfo`). Both R3 gates that answer from
// `machineInfo` — `groupHeadController()` and `profileModes()` — were therefore pinned at
// `unknown` for ever, because nothing in the tree owned the feed. `live-capability-gates-ghc`
// is the item that needs the answer, so it is the item that brings the owner.
//
// THE SCREEN NEVER CALLS THIS. The screen law is "the machine-state truth is the store's;
// the screen never talks to an endpoint directly — stores and the generated client only",
// so the shape is the tree's ordinary one: an assembly function, every dependency
// injected, nothing started until someone calls `load()`, and the shell wires it
// (`src/lib/app-boot.js`).
//
// THIS MODULE READS NO MACHINE NAME. `MachineInfo.toJson` carries `model`, and A3 is the
// rule that a screen may never gate on it — so the body travels through here VERBATIM and
// is never inspected. There is no `model` read, no comparison, no branch on any string in
// this file, and `test/live-connection-gates.test.mjs` asserts that over its own source in
// the same way `test/adapters-r.test.mjs` does for the adapter module. The FIRST consumer
// is `capabilities.applyMachineInfo`, whose adapters read `GHC` by key presence — it is no
// longer the only one. `settings-bespoke-leaf.js` reads `info.GHC` off this store's body
// directly for the machine-information card. That is an informational display of the
// document rather than a capability gate, so whether SCOPE Part 10 s10 wants it behind
// `r3GroupHeadControllerCapability` is RECORDED, NOT DECIDED (adapter audit, 20 Aug); the
// read is not rerouted here. What is fixed is this sentence, which said "the one consumer"
// after the second one arrived.
//
// FORGETTING IS PART OF THE CONTRACT. When the machine goes away the previous machine's
// info is exactly the stale answer `capabilities.forget()` exists to prevent — it drops
// `machineInfo` for that reason and says so. `forget()` here is its mirror, so the two
// cannot disagree about which machine is being described.
//
// CONTRACT ROW `getMachineInfo`, checked at the pin 2b047d02: GET /api/v1/machine/info ->
// `De1Handler._infoHandler` (`lib/src/services/webserver/de1handler.dart`), 200
// `{version, model, serialNumber, GHC, extra}`; **500 `{error, st}` via `withDe1` WHEN NO
// MACHINE IS CONNECTED** — the key is `error`, not `e`: the Dart catch variable is `e` and
// the JSON key is not (`de1handler.dart:513-514`). The `{e, st}` spelling belongs to
// `/api/v1/devices` (`devices_handler.dart:210-211`) and this header carried it by copy
// until 21 Aug. That 500 is the ordinary state of this route on a machine that is off, not
// a fault to retry — it is why `status: 'unavailable'` below is a first-class outcome and
// why nothing here retries.

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** What the store knows. `info` is the body verbatim, or null. */
export const MACHINE_INFO_STATUS = Object.freeze({
    /** `load()` has not been called. */
    NOT_LOADED: 'notLoaded',
    LOADING: 'loading',
    READY: 'ready',
    /** The server answered, and the answer was not a readable body. */
    UNREADABLE: 'unreadable',
    /** No machine to ask (the documented 500), or the request never landed. */
    UNAVAILABLE: 'unavailable',
});

const EMPTY_STATE = Object.freeze({
    status: MACHINE_INFO_STATUS.NOT_LOADED,
    info: null,
    error: null,
    loadedAt: null,
});

export function readMachineInfo(body) {
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

/**
 * @param {object} deps
 * @param {object} deps.transport  createReaTransport(...)
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]
 */
export function createMachineInfoStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createMachineInfoStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('machineInfo') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'machineInfo', logger: log });
    let inFlight = null;
    // The same generation guard the capability store carries, for the same reason: a read
    // in flight across a `forget()` must not land afterwards and re-describe the machine
    // that just went away.
    let epoch = 0;

    const publish = (next) => store.set(next);
    const publishIfCurrent = (asOf, next) => {
        if (asOf !== epoch) {
            if (log && log.info) log.info('discarding machine info for a machine that is gone');
            return store.get();
        }
        return publish(next);
    };

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        /** The body, or null. The one thing `applyMachineInfo` wants. */
        info() { return store.get().info; },

        /**
         * Ask once. Concurrent callers join the same request — a screen and the shell both
         * asking on connect is one call, not two.
         */
        load() {
            if (inFlight) return inFlight;
            const asOf = epoch;
            publish({ ...store.get(), status: MACHINE_INFO_STATUS.LOADING, error: null });
            inFlight = (async () => {
                const result = await callRoute(transport, 'getMachineInfo');
                if (!result.ok) {
                    // Both documented failures land here and neither is retried: a 500
                    // from `withDe1` means there is no machine to ask, and a transport
                    // failure means the server is not there. `refresh()` is the retry, and
                    // it is called on a connect, which is the event that changes the answer.
                    return publishIfCurrent(asOf, {
                        ...EMPTY_STATE,
                        status: MACHINE_INFO_STATUS.UNAVAILABLE,
                        error: result,
                    });
                }
                const info = readMachineInfo(result.data);
                if (info === null) {
                    if (log && log.warn) log.warn('machine info answered an unreadable body');
                    return publishIfCurrent(asOf, {
                        ...EMPTY_STATE,
                        status: MACHINE_INFO_STATUS.UNREADABLE,
                        error: result,
                    });
                }
                return publishIfCurrent(asOf, {
                    status: MACHINE_INFO_STATUS.READY, info, error: null, loadedAt: now(),
                });
            })().finally(() => { inFlight = null; });
            return inFlight;
        },

        /** Re-read — after a machine connect or swap. Same request, no cache. */
        refresh() { return this.load(); },

        /** The machine went away. Mirrors `capabilities.forget()`. */
        forget() {
            epoch += 1;
            inFlight = null;
            return publish({ ...EMPTY_STATE });
        },

        /** Drop every subscriber. This store holds no timer and no socket. */
        stop() { store.destroy(); },
    };
}
