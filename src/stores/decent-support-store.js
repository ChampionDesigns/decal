/**
 * The message thread with Decent support, through the account proxy.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

export const SUPPORT_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** The thread could not be read. `reason` says why; it is never an empty thread. */
    UNAVAILABLE: 'unavailable',
});

export const SEND_STATUS = Object.freeze({
    IDLE: 'idle',
    SENDING: 'sending',
    SENT: 'sent',
    REFUSED: 'refused',
});

export const SUPPORT_REFUSAL = Object.freeze({
    /** No `window.__REA_PROXY_TOKEN__`. The page was not served by ReaPrime — a dev
     *  harness, a file:// open, or a build with no account service. Never retryable. */
    NO_TOKEN: 'noToken',
    NOT_LINKED: 'notLinked',
    /** 403. Token unscoped, path outside the allowlist, or (on a ReaPrime newer than the
     *  pin) account consent declined at the native prompt. */
    FORBIDDEN: 'forbidden',
    /** The upstream answered `0` — its own refusal token. Nothing else is knowable. */
    UPSTREAM_REFUSED: 'upstreamRefused',
    /** A 200 whose body could not be understood as a thread. Distinct from "no messages". */
    UNREADABLE: 'unreadable',
    /** Anything else: a network failure, a timeout, a 5xx. */
    FAILED: 'failed',
});

/** The proxy path segment for each call. One place, so neither is spelled twice. */
const SEND_ENDPOINT = 'email';
const THREAD_ENDPOINT = 'emails';

/** The upstream's own refusal token, for both endpoints. Compared as a STRING — see the
 *  header on why the body is read as text rather than parsed. */
const UPSTREAM_REFUSAL = '0';

const EMPTY_STATE = Object.freeze({
    status: SUPPORT_STATUS.IDLE,
    reason: null,
    /** The conversation, oldest first. Empty AND `status: READY` means "no messages yet",
     *  which is a real answer; empty with `status: UNAVAILABLE` means it could not be read. */
    messages: Object.freeze([]),
    send: Object.freeze({ status: SEND_STATUS.IDLE, reason: null }),
});

const repairEmptyValues = (text) => text.replace(/"(\w+)":\s*,/g, '"$1": null,');

function readMessage(record) {
    if (!record || typeof record !== 'object') return null;
    const text = [record.body, record.message, record.subject]
        .find((value) => typeof value === 'string' && value !== '');
    const from = typeof record.from_user === 'string' && record.from_user.trim() !== ''
        ? record.from_user.trim()
        : null;
    const at = Number.isFinite(record.now) ? record.now : null;
    return Object.freeze({
        from,
        at,
        subject: typeof record.subject === 'string' && record.subject !== '' ? record.subject : null,
        body: text ?? null,
        auto: Boolean(record.automsg),
    });
}

function inOrder(messages) {
    return messages
        .map((message, index) => ({ message, index }))
        .sort((a, b) => {
            if (a.message.at === null || b.message.at === null) return a.index - b.index;
            return a.message.at - b.message.at;
        })
        .map((entry) => entry.message);
}

/** Map a transport failure onto the vocabulary above. The status is the whole signal. */
function refusalFor(result) {
    if (result.status === 401) return SUPPORT_REFUSAL.NOT_LINKED;
    if (result.status === 403) return SUPPORT_REFUSAL.FORBIDDEN;
    return SUPPORT_REFUSAL.FAILED;
}

export function createDecentSupportStore({ transport, token = null, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createDecentSupportStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('support') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'decent-support', logger: log });
    let inFlight = null;

    const bearer = typeof token === 'string' && token.trim() !== ''
        ? Object.freeze({ Authorization: `Bearer ${token.trim()}` })
        : null;

    const publish = (patch) => {
        store.set({ ...store.get(), ...patch });
        return store.get();
    };

    /** One proxied GET, with the bearer and the text body. Returns the transport result. */
    const proxied = (endpoint, query) => callRoute(transport, 'getAccountProxySupportApiByEndpoint', {
        params: { endpoint },
        query,
        headers: bearer,
        expect: 'text',
    });

    async function readThread() {
        if (!bearer) {
            return publish({
                status: SUPPORT_STATUS.UNAVAILABLE,
                reason: SUPPORT_REFUSAL.NO_TOKEN,
                messages: EMPTY_STATE.messages,
            });
        }

        const result = await proxied(THREAD_ENDPOINT, null);
        if (!result.ok) {
            if (log && log.warn) log.warn(`thread read failed: ${result.message}`);
            return publish({
                status: SUPPORT_STATUS.UNAVAILABLE,
                reason: refusalFor(result),
                messages: EMPTY_STATE.messages,
            });
        }

        const text = typeof result.data === 'string' ? result.data.trim() : '';
        if (text === UPSTREAM_REFUSAL) {
            return publish({
                status: SUPPORT_STATUS.UNAVAILABLE,
                reason: SUPPORT_REFUSAL.UPSTREAM_REFUSED,
                messages: EMPTY_STATE.messages,
            });
        }
        if (text === '') {
            return publish({ status: SUPPORT_STATUS.READY, reason: null, messages: EMPTY_STATE.messages });
        }

        let parsed = null;
        try {
            parsed = JSON.parse(repairEmptyValues(text));
        } catch (error) {
            if (log && log.warn) log.warn(`thread body did not parse: ${error && error.message}`);
            return publish({
                status: SUPPORT_STATUS.UNAVAILABLE,
                reason: SUPPORT_REFUSAL.UNREADABLE,
                messages: EMPTY_STATE.messages,
            });
        }
        if (!Array.isArray(parsed)) {
            return publish({
                status: SUPPORT_STATUS.UNAVAILABLE,
                reason: SUPPORT_REFUSAL.UNREADABLE,
                messages: EMPTY_STATE.messages,
            });
        }

        const messages = inOrder(parsed.map((record) => readMessage(record)).filter((message) => message !== null));
        return publish({ status: SUPPORT_STATUS.READY, reason: null, messages: Object.freeze(messages) });
    }

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** Whether a bearer reached this store at all. The leaf asks so it can say why the
         *  box is not there, instead of drawing a compose form that cannot send. */
        get hasToken() { return bearer !== null; },

        load() {
            if (inFlight) return inFlight;
            publish({ status: SUPPORT_STATUS.LOADING });
            inFlight = readThread().finally(() => { inFlight = null; });
            return inFlight;
        },

        refresh() {
            inFlight = null;
            return this.load();
        },

        async send({ subject, body } = {}) {
            const title = typeof subject === 'string' ? subject.trim() : '';
            const text = typeof body === 'string' ? body.trim() : '';
            if (title === '' || text === '') return false;
            if (!bearer) {
                publish({ send: Object.freeze({ status: SEND_STATUS.REFUSED, reason: SUPPORT_REFUSAL.NO_TOKEN }) });
                return false;
            }

            publish({ send: Object.freeze({ status: SEND_STATUS.SENDING, reason: null }) });
            const result = await proxied(SEND_ENDPOINT, { subject: title, body: text });
            if (!result.ok) {
                if (log && log.warn) log.warn(`send failed: ${result.message}`);
                publish({ send: Object.freeze({ status: SEND_STATUS.REFUSED, reason: refusalFor(result) }) });
                return false;
            }
            if (typeof result.data === 'string' && result.data.trim() === UPSTREAM_REFUSAL) {
                publish({ send: Object.freeze({ status: SEND_STATUS.REFUSED, reason: SUPPORT_REFUSAL.UPSTREAM_REFUSED }) });
                return false;
            }

            publish({ send: Object.freeze({ status: SEND_STATUS.SENT, reason: null }) });
            inFlight = null;
            await readThread().catch(() => {});
            return true;
        },

        /** Put the compose box back to its resting state — after the reader has read the
         *  confirmation, or when they start typing again. */
        clearSendState() {
            publish({ send: EMPTY_STATE.send });
            return store.get();
        },

        stop() { store.destroy(); },
    };
}
