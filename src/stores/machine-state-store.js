

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/**
 * The machine's state and substate, and how stale the last frame is.
 */
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
