/**
 * Which.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** Where the one read got to. */
export const APP_INFO_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** The request never landed, or the handler answered something that is not a body. */
    FAILED: 'failed',
});

const UNREAD = Object.freeze(['', 'unknown']);

/** One served string, or null where the server said it does not know. */
function readText(source, key) {
    const value = source?.[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return UNREAD.includes(trimmed.toLowerCase()) ? null : trimmed;
}

const EMPTY_INFO = Object.freeze({
    commit: null,
    commitShort: null,
    branch: null,
    buildTime: null,
    version: null,
    buildNumber: null,
    /** `true`, `false`, or null when the body carried no boolean at all. */
    appStore: null,
    fullVersion: null,
    localIp: null,
});

export function readAppInfo(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return Object.freeze({
        commit: readText(body, 'commit'),
        commitShort: readText(body, 'commitShort'),
        branch: readText(body, 'branch'),
        buildTime: readText(body, 'buildTime'),
        version: readText(body, 'version'),
        buildNumber: readText(body, 'buildNumber'),
        appStore: typeof body.appStore === 'boolean' ? body.appStore : null,
        fullVersion: readText(body, 'fullVersion'),
        localIp: readText(body, 'localIp'),
    });
}

const EMPTY_STATE = Object.freeze({
    status: APP_INFO_STATUS.IDLE,
    info: EMPTY_INFO,
    error: null,
});

/**
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} [deps.logger]
 */
export function createAppInfoStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createAppInfoStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('appInfo') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'appInfo', logger: log });
    let inFlight = null;
    let done = false;

    const read = () => {
        if (inFlight) return inFlight;
        store.set({ ...store.get(), status: APP_INFO_STATUS.LOADING, error: null });
        inFlight = (async () => {
            const result = await callRoute(transport, 'getInfo');
            if (!result.ok) {
                if (log && log.info) log.info(`app info read failed: ${result.status ?? 'no status'}`);
                return store.set({ status: APP_INFO_STATUS.FAILED, info: EMPTY_INFO, error: result });
            }
            const info = readAppInfo(result.data);
            if (info === null) {
                if (log && log.warn) log.warn('app info answered a body that is not a record');
                return store.set({ status: APP_INFO_STATUS.FAILED, info: EMPTY_INFO, error: result });
            }
            done = true;
            return store.set({ status: APP_INFO_STATUS.READY, info, error: null });
        })().finally(() => { inFlight = null; });
        return inFlight;
    };

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        load() {
            if (done) return Promise.resolve(store.get());
            return read();
        },

        /** Ask again, whatever happened last time. Declared for the day something needs it. */
        reload() {
            done = false;
            inFlight = null;
            return read();
        },

        stop() { store.destroy(); },
    };
}
