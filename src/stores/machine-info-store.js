

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
