/**
 * decent-account-store.js — whether this ReaPrime is signed in to a Decent account.
 *
 * ONE ROUTE AND ONE BOOLEAN, and that is the whole surface at the pin:
 *
 *   GET /api/v1/account/decent -> 200 {loggedIn: bool}
 *     `AccountHandler._handleStatus`, `lib/src/services/webserver/account_handler.dart:12`
 *
 * THERE IS NO SIGN-IN ROUTE HERE, AND THE LEAF SAYS SO RATHER THAN OFFERING A FORM.
 * `DecentAccountService` owns the credentials and ReaPrime signs in through its own
 * Flutter UI; the only account traffic the web API carries is this read and the
 * `/api/v1/account/proxy/<rest>` pass-through, which forwards an ALREADY-AUTHENTICATED
 * request and cannot establish a session. A username and password box here would collect
 * credentials it has nowhere to send.
 *
 * SO THE LEAF IS A READING, NOT A CONTROL, and it was EMPTY before — which told the user
 * nothing at all. Knowing that the machine is signed in, or is not, is the useful half
 * and it is the half that exists.
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
