// machine-state-store.js — asking the machine to change state, and the one caller that does.
//
// WHY IT EXISTS. `putMachineStateByNewState` has been in the generated route table since
// wave 2 and nothing in `src/` addressed it, so the app could read that the machine was
// asleep and had no way to wake it. `<ui-screensaver>` is the surface that needs it: its
// own header says "the screen performs the one PUT (`putMachineStateByNewState`, per the
// port digest)", and the black blank it raises is a trap without a wake behind it.
//
// ONE OWNER, AND IT IS NOT A SCREEN. The screensaver reports a WAKE INTENT and never
// commands (`screensaver-policy.js` rule 2: "nothing that is not a wake may emit a wake");
// the shell hears the intent and asks this store. A screen that called `callRoute` itself
// would be the second place deciding what a wake is.
//
// THE ROUTE, READ AT THE PIN 2b047d02 (`De1Handler._requestStateHandler`,
// `lib/src/services/webserver/de1handler.dart:639-675`):
//
//   PUT /api/v1/machine/state/<newState>
//     200 jsonOk(null)                            the request reached the machine
//     400 {details:'No scale detected, blocking espresso request', type:'block_no_scale'}
//                                                 ESPRESSO only, and only with the
//                                                 blockOnNoScale setting on, no scale
//                                                 connected and a non-cleaning profile
//     500                                         `withDe1`'s catch-all — including an
//                                                 unknown state name, which
//                                                 `MachineState.values.byName` throws on
//
// A 200 IS NOT A STATE CHANGE. `de1.requestState` is a BLE write; the machine's own state
// arrives on the snapshot feed like every other reading, and this store publishes only what
// it ASKED for and what the route answered. Nothing here reports the machine as awake —
// the screensaver drops on the confirmed state, which is the whole point of its policy.

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** Where a state request got to. */
export const REQUEST_STATUS = Object.freeze({
    IDLE: 'idle',
    SENDING: 'sending',
    /** 200. The request reached the machine. NOT "the machine is in that state". */
    SENT: 'sent',
    /** A typed 400 — today only `block_no_scale`. `problem` carries the server's own body. */
    REFUSED: 'refused',
    /** Anything else. */
    FAILED: 'failed',
});

const EMPTY_STATE = Object.freeze({
    status: REQUEST_STATUS.IDLE,
    /** The state name asked for, or null. */
    requested: null,
    /** The server's own refusal body, verbatim, or null. */
    problem: null,
    error: null,
    at: null,
});

export function createMachineStateStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createMachineStateStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('machineState') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'machineState', logger: log });

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        async request(state) {
            if (typeof state !== 'string' || state === '') return store.get();
            store.set({ ...EMPTY_STATE, status: REQUEST_STATUS.SENDING, requested: state, at: now() });
            const result = await callRoute(transport, 'putMachineStateByNewState', {
                params: { newState: state },
            });
            if (result.ok) {
                return store.set({ ...EMPTY_STATE, status: REQUEST_STATUS.SENT, requested: state, at: now() });
            }
            if (result.status === 400) {
                if (log && log.info) log.info(`state '${state}' refused: ${result.message}`);
                return store.set({
                    ...EMPTY_STATE,
                    status: REQUEST_STATUS.REFUSED,
                    requested: state,
                    problem: result.problem ?? null,
                    at: now(),
                });
            }
            if (log && log.warn) log.warn(`state '${state}' failed: ${result.message}`);
            return store.set({
                ...EMPTY_STATE, status: REQUEST_STATUS.FAILED, requested: state, error: result, at: now(),
            });
        },

        clear() { return store.set({ ...EMPTY_STATE, at: now() }); },

        stop() { store.destroy(); },
    };
}
