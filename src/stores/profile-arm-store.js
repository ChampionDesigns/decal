

import { callRoute } from '../data/rea-routes.js';
import { profileArmBody, profileRefusal } from '../data/rea-profile.js';
import { createStore } from './store.js';

/**
 * Which profile is armed on the machine, and the write that arms another.
 */
export const ARM_STATUS = Object.freeze({
    IDLE: 'idle',
    ARMING: 'arming',
    /** 200. The machine is running what the user picked. */
    ARMED: 'armed',
    /** A typed 400. `refusal` carries the server's own `{kind, error, message}`. */
    REFUSED: 'refused',
    /** Anything else — a 500, a timeout, a network failure. Not a refusal. */
    FAILED: 'failed',
});

const EMPTY_STATE = Object.freeze({
    status: ARM_STATUS.IDLE,
    /** `{kind: 'unsupported'|'invalid', error, message}` from `profileRefusal`, or null. */
    refusal: null,
    /** The transport failure for a non-400 fault, verbatim. Never a refusal. */
    error: null,
    /** Which profile the state is about, when the caller named one. */
    profileId: null,
    at: null,
});

/**
 * @param {object} deps
 * @param {object} deps.transport  createReaTransport(...)
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]
 */
export function createProfileArmStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createProfileArmStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('arm') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileArm', logger: log });
    const publish = (next) => store.set(next);

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        /** The refusal to surface, or null. The one thing `<live-refusal>` reads. */
        refusal() { return store.get().refusal; },

        async arm(profile, { profileId = null } = {}) {
            publish({ ...EMPTY_STATE, status: ARM_STATUS.ARMING, profileId, at: now() });

            const result = await callRoute(transport, 'postMachineProfile', {
                body: profileArmBody(profile),
            });

            if (result.ok) {
                return publish({ ...EMPTY_STATE, status: ARM_STATUS.ARMED, profileId, at: now() });
            }

            const refusal = profileRefusal(result);
            if (refusal) {
                if (log && log.info) log.info(`profile refused: ${refusal.error}`);
                return publish({
                    ...EMPTY_STATE, status: ARM_STATUS.REFUSED, refusal, profileId, at: now(),
                });
            }

            if (log && log.warn) log.warn(`arming failed: ${result.message}`);
            return publish({
                ...EMPTY_STATE, status: ARM_STATUS.FAILED, error: result, profileId, at: now(),
            });
        },

        clear() { return publish({ ...EMPTY_STATE }); },

        stop() { store.destroy(); },
    };
}
