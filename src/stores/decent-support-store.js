/**
 * decent-support-store.js — the message thread with Decent support, through the account proxy.
 *
 * THE PAGE PROMISED THIS AND DID NOT BUILD IT. Help › Talk to Decent told a signed-out
 * reader "Come back here — this page will show the message box", and a signed-IN reader got
 * one sentence saying an account was linked. A promise in copy that the code does not keep
 * is the defect class this fork exists to remove, and it was the loudest example left.
 *
 * THE BLOCKER RECORDED AGAINST IT WAS NOT REAL. `settings-leaves.js` said the leaf could
 * only be "a read-only account status — there is no sign-in route on the web API to build a
 * form against". Both halves of that are true and neither is the obstacle: nobody was
 * asking for a sign-in form. Sending a message needs an ALREADY authenticated request, and
 * that is precisely what `/api/v1/account/proxy/…` is for.
 *
 * ===========================================================================
 * THE CONTRACT, RE-READ AT THE PIN (2b047d02) BEFORE ANY OF THIS WAS WRITTEN
 * ===========================================================================
 *
 *   GET /api/v1/account/proxy/support/api/<endpoint>
 *     `AccountProxyHandler._handleGet`, lib/src/services/webserver/account_proxy_handler.dart
 *
 *   It forwards to `https://decentespresso.com/support/api/<endpoint>` with the linked
 *   account's e-mail and password attached SERVER-SIDE as Basic auth, and relays the
 *   upstream status and body verbatim. The credentials never reach this skin.
 *
 *   AUTHORISATION IS A BEARER TOKEN THE APP INJECTS INTO THE PAGE. `webui_service.dart`
 *   puts `<meta name="reaprime-proxy-token" content="…">` into every served skin page and a
 *   companion script sets `window.__REA_PROXY_TOKEN__` from it. `proxy_auth_middleware.dart`
 *   validates the bearer on every `/api/v1/account/proxy/` request: 401 for a missing or
 *   unknown token, 403 for one that is not scoped.
 *
 *   THE INJECTED TOKEN IS READ-ONLY AND THAT DECIDES THE VERB. `ProxyTokenService`'s
 *   constructor registers the skin caller with `scopes: {scopeAccountProxy}` — the read
 *   scope — and `proxy_auth_middleware` demands `account:proxy:write` for POST and PUT. So
 *   a skin gets 403 on a write and every call here is a GET with a query string.
 *
 *   THE PATH ALLOWLIST IS EXACTLY `support/api/`. `DecentProxyService` is constructed with
 *   `allowedPrefixes = const {'support/api/'}` and checks it twice — once on the incoming
 *   path and once on the assembled upstream URI — answering 403 for anything else. Both
 *   endpoints below are inside it.
 *
 *   AND `Access-Control-Allow-Origin` IS NARROW FOR THIS PATH ALONE. The webserver's general
 *   CORS middleware allows any origin; `accountProxyCorsMiddleware` then REMOVES that header
 *   for `/api/v1/account/proxy/` and re-adds it only for the skin server's own origins —
 *   `http://localhost:<webUIPort>`, `127.0.0.1`, `[::1]` and the device IP.
 *
 *   THAT LAST ONE IS THE REASON THIS CANNOT BE EXERCISED OFF A REAL TABLET, and it is worth
 *   knowing before anyone calls a red result a bug. A skin served from the dev harness
 *   (`python3 -m http.server`) or from the capture battery's own port is not one of those
 *   origins, so the browser drops the proxy response before this store sees it, and
 *   `window.__REA_PROXY_TOKEN__` is undefined there anyway. Both produce a stated refusal
 *   below rather than a silent nothing.
 *
 * ===========================================================================
 * THE TWO UPSTREAM ENDPOINTS, AND HOW MUCH IS ACTUALLY KNOWN ABOUT EACH
 * ===========================================================================
 *
 *   `support/api/email?subject=…&body=…`   SEND. This one is corroborated inside ReaPrime:
 *       `DecentAccountService.emailSerialMismatch` builds exactly that URL with exactly
 *       those two parameter names, sends it with the account's credentials, and treats a
 *       non-200 OR a trimmed body of `'0'` as a failure. Slate's skin sends the same pair.
 *       Two independent callers, one shape.
 *
 *   `support/api/emails`                   LIST. This one is NOT corroborated anywhere in
 *       ReaPrime — no Dart file names it. The ONLY evidence it exists is Slate's own
 *       `talkDecentFetchEmails`, which calls it through the same proxy and parses an array
 *       of `{from_user, now, subject, body, automsg}`. The proxy allows it because the
 *       allowlist is a PREFIX, not a list of endpoints, so ReaPrime does not have to know
 *       about it for the call to go through.
 *
 *       THIS IS A REAL LIMIT ON WHAT THIS FILE CAN CLAIM, and it is why the thread list
 *       reports its own failure rather than rendering an empty conversation. An endpoint
 *       that answers 404 and an account with no messages must not look the same on screen:
 *       one is "nothing to show" and the other is "this could not be read", and only the
 *       second is worth telling somebody about.
 *
 * NO `since`, AND THAT DELETES A WHOLE SUBSYSTEM. Slate passes `since=<newest stored
 * timestamp>` and therefore has to KEEP the thread: `idb.js` carries a `decent_emails`
 * object store, `addEmails` / `getAllEmails` / `getLatestEmailTimestamp`, and the rendered
 * conversation is the local database rather than the server's answer. This store asks for
 * the whole thread every time, which is what Slate itself does on a first run, so:
 *
 *   - there is no second copy of the conversation to go stale, and no storage-routes row,
 *     no retention rule and no eviction policy to get wrong;
 *   - a message deleted or edited upstream is simply gone here, instead of surviving for
 *     ever in a cache nothing invalidates;
 *   - and `since` is a parameter with no evidence behind it at all — see the route table's
 *     `account-proxy-query-passthrough` exception, which adds `subject` and `body` because
 *     ReaPrime's own Dart names them, and deliberately does not add `since`.
 *
 * The cost is one full thread per open instead of a delta. A support conversation is a
 * handful of messages; this is not the shot history.
 *
 * ===========================================================================
 * WHY THE BODY IS READ AS TEXT
 * ===========================================================================
 *
 * `transport.request(..., { expect: 'text' })`, which exists for this route family. The
 * proxy relays VERBATIM and the spec types the success body `application/octet-stream`,
 * `format: binary` — so the transport cannot assume JSON, and for these two endpoints it
 * would be wrong twice:
 *
 *   `email` answers a bare token. `'0'` is a refusal, and ReaPrime's own code compares it
 *       as a STRING. `JSON.parse('0')` succeeds and yields the number zero, which is worse
 *       than throwing: the refusal would arrive as a value a caller has to know to convert
 *       back before testing.
 *
 *   `emails` answers JSON that is sometimes MALFORMED. Slate repairs `"key": ,` to
 *       `"key": null,` with a regex before parsing, and nobody writes that by accident —
 *       it is the trace of a real body that broke a real parser. `JSON.parse` throws on it
 *       and the transport's DECODE failure carries only the first 200 characters, so the
 *       thread would be unrecoverable from the error.
 *
 * THE REPAIR IS PORTED, NARROWED, AND IT IS NOT A FALLBACK PATH (A7). It rewrites one
 * lexical shape — a key whose value is empty before a comma — into an explicit null. It
 * does not invent a message, retry, or substitute an empty thread for a failed read: if the
 * body still will not parse afterwards, that is UNREADABLE and the page says so.
 *
 * ===========================================================================
 * WHAT THIS STORE DOES NOT DO
 * ===========================================================================
 *
 * NO `support/api/sn`. Slate reads the account's machine serial and prints it under
 * "Decent account linked". It is a real endpoint (`fetchSerialNumbers` uses
 * `/support/api/sn?onlyespressomachines=1`) and it would work through this proxy — but it
 * is a badge, not the message box Ben asked for, and its query parameter would need its own
 * row in the route table. Left out deliberately rather than half-built.
 *
 * NO ATTACHMENTS AND NO MACHINE-INFO BLOCK IN HERE. Slate appends model, firmware, serial
 * and app version to the body behind a switch. That is a decision about WHAT TEXT TO SEND,
 * which belongs to the surface that has the machine and app documents in hand — the leaf —
 * and this store sends the string it is given. A store that composed prose would be a
 * second author of the message.
 *
 * NO POLLING AND NO TIMER. `load()` runs when the leaf opens and when Refresh is pressed,
 * and after a successful send. Slate polls nothing either; a settings page that quietly
 * fetched a mailbox every few seconds would be a clock nobody asked for.
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

/**
 * WHY A CALL DID NOT WORK, in the vocabulary the page can put in a sentence.
 *
 * Each one is a DIFFERENT THING TO DO ABOUT IT, which is the only reason to distinguish
 * them: a missing token means this page is not being served by ReaPrime and nothing the
 * reader does will help; a 401 means the account came unlinked and they should sign in
 * again; a refusal from the upstream mail service is worth retrying.
 */
export const SUPPORT_REFUSAL = Object.freeze({
    /** No `window.__REA_PROXY_TOKEN__`. The page was not served by ReaPrime — a dev
     *  harness, a file:// open, or a build with no account service. Never retryable. */
    NO_TOKEN: 'noToken',
    /** 401. Either the bearer is unknown, or no Decent account is linked — the handler
     *  answers 401 for both (`jsonUnauthorized`), and the page already knows which,
     *  because it only builds this surface when the account store says linked. */
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

/**
 * Slate's repair, narrowed to the one shape it was written for.
 *
 * `"subject": ,` is not valid JSON and it is what the upstream emits for a key with no
 * value. Slate's regex is `/"(\w+)":\s*,/g` and this is the same rule: a quoted word key,
 * a colon, optional whitespace, then the comma that should have had a value before it.
 *
 * IT DOES NOT TRY TO BE A JSON PARSER. Anything else malformed stays malformed and the read
 * is reported as UNREADABLE — a repair that grew to cover cases nobody has observed would
 * be inventing a wire format.
 */
const repairEmptyValues = (text) => text.replace(/"(\w+)":\s*,/g, '"$1": null,');

/**
 * One upstream record, reduced to the five fields anything renders.
 *
 * FROM SLATE'S RENDERER, WHICH IS THE ONLY DESCRIPTION OF THIS SHAPE THAT EXISTS:
 *   `from_user`  non-empty means Decent wrote it; absent or blank means the account did.
 *                That is Slate's own discriminator (`const isDecent = msg.from_user && …`)
 *                and there is no other flag on the record.
 *   `now`        UNIX seconds. Slate multiplies by 1000 for a `Date`.
 *   `subject`    optional; drawn as a header strip above the body when present.
 *   `body`       the text. Slate falls back through `body || message || subject`, which
 *                says the field name is not stable, so all three are read here.
 *   `automsg`    truthy on an automated reply; Slate draws a small "auto" pill.
 *
 * ABSENCE IS PASSED THROUGH AS ABSENCE (A7). No invented timestamp, no "(no subject)", no
 * placeholder author. The screen decides what an absent field looks like; this only refuses
 * to make one up.
 */
/* NO ID AND NO LIST KEY, WHICH IS A DELETION RATHER THAN AN OVERSIGHT. The first cut of
 * this carried `key: \`m${index}\`` for a lit list key, and nothing ever read it: the
 * thread is REPLACED whole on every read — there is no incremental update and no
 * per-message state to preserve — so keying buys nothing, and the records carry no upstream
 * id to key on anyway. A field with no reader is the defect this fork exists to remove, and
 * it does not get an exemption for being small. */
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

/** Oldest first, which is how a conversation reads. Records with no timestamp keep the
 *  order the server sent them in rather than being sorted to one end as though they were
 *  ancient — an unknown time is not time zero. */
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

/**
 * @param {object} options
 * @param {object} options.transport      a `createReaTransport(...)` client
 * @param {string|null} [options.token]   `window.__REA_PROXY_TOKEN__`, read ONCE by the
 *                                        shell — this module touches no ambient state.
 */
export function createDecentSupportStore({ transport, token = null, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createDecentSupportStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('support') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'decent-support', logger: log });
    let inFlight = null;

    /* THE BEARER IS BUILT ONCE AND ONLY IF THERE IS ONE. An empty string, a non-string or a
     * missing global all mean the same thing — this page was not served by ReaPrime — and
     * that is a stated refusal rather than a header reading "Bearer undefined", which the
     * middleware would answer 401 to and which would then be reported as an unlinked
     * account. Two very different sentences for the reader. */
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
        /* AN EMPTY BODY IS AN EMPTY THREAD, and that is the one absence here that IS an
         * answer rather than a fault: the relay returned 200 and the upstream had nothing
         * to say. It is kept distinct from the unparseable case below. */
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

        /**
         * Send one message.
         *
         * BOTH FIELDS ARE REFUSED WHEN BLANK, HERE AND NOT ONLY IN THE FORM. The upstream
         * takes whatever it is given and answers `0` or not; an empty subject would arrive
         * at a human's inbox as an untitled message and there would be no way to tell it
         * from a failure. Slate checks both in its click handler and this checks them where
         * the check cannot be bypassed.
         *
         * THE DRAFT IS NOT CLEARED HERE. This returns an outcome and the leaf decides — the
         * same rule the plugin settings form follows ("THE DRAFT IS CLEARED ONLY ON
         * SUCCESS"), and the reason is that a refused send must leave the words on screen.
         *
         * THE THREAD IS RE-READ ON SUCCESS, because that is the only way the sent message
         * becomes visible: nothing is appended locally. If the re-read fails the send still
         * SUCCEEDED, so the send status stands and the thread reports its own failure —
         * two facts, two places, neither overwriting the other.
         */
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
            /* THE UPSTREAM'S OWN REFUSAL IS A 200. `emailSerialMismatch` treats a trimmed
             * body of '0' as a failure on a 200 response, and so does Slate. A store that
             * read only the status would report a message that was never delivered as sent. */
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
