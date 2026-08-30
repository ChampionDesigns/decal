/**
 * Whether this ReaPrime is signed in to a Decent account.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

export const ACCOUNT_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** Asked and refused, or the server was not there. Distinct from "signed out". */
    UNAVAILABLE: 'unavailable',
});

const EMPTY_STATE = Object.freeze({
    status: ACCOUNT_STATUS.IDLE,
    /** true, false, or null while unknown. NEVER defaulted to false: "not asked" and
     *  "signed out" are different sentences and the leaf prints different ones. */
    loggedIn: null,
    error: null,
});

export function createDecentAccountStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createDecentAccountStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('account') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'decent-account', logger: log });
    let inFlight = null;

    async function read() {
        const result = await callRoute(transport, 'getAccountDecent');
        if (!result.ok || !result.data || typeof result.data !== 'object') {
            return store.set({ ...EMPTY_STATE, status: ACCOUNT_STATUS.UNAVAILABLE, error: result });
        }
        return store.set({
            status: ACCOUNT_STATUS.READY,
            loggedIn: typeof result.data.loggedIn === 'boolean' ? result.data.loggedIn : null,
            error: null,
        });
    }

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        load() {
            if (inFlight) return inFlight;
            store.set({ ...store.get(), status: ACCOUNT_STATUS.LOADING });
            inFlight = read().finally(() => { inFlight = null; });
            return inFlight;
        },
        refresh() {
            inFlight = null;
            return this.load();
        },
        stop() { store.destroy(); },
    };
}
