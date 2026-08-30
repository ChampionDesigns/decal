// The typed error surface of the transport.
//
// SCOPE Part 3 §1: the client "never touches the DOM and never imports UI". The old
// module did both from inside its error paths — `api.js:1` imports `ui.js`, and an upload
// failure raised a toast (`uploadProfile`, `uploadProfileWithParent`) before rethrowing.
// So a transport failure could only ever be told one way, and every caller inherited that
// decision. Here a failure is DATA: a value with a kind, a status and the server's own
// message. Nothing in this file can reach a screen.
//
// THE DEFECT THIS FILE EXISTS TO KILL (E2 bug 10, five instances, verified at source):
// `getReaSettings` -> null (:1306), `getPlugins` -> null (:1905), `getPluginSettings`
// -> {} (:1924), `verifyVisualizerCredentials` -> false (:1989), `getScaleDeviceId`
// -> null (:621). Every one MANUFACTURES AN ANSWER from a transport failure. The fourth
// is the clearest: an unreachable server becomes indistinguishable from a wrong password.
// That is A7 in its purest form — a fallback path that turns an absence into a plausible
// value — and there is no such path here. A failed request yields a failure. It cannot
// yield `null`, `{}`, `false`, or a stale cached copy.
//
// Kinds are closed and few, because a caller has to be able to branch on them:
//
//   network   the fetch itself rejected — nothing was answered. No status.
//   timeout   we aborted it ourselves. No status.
//   http      the server answered with a non-2xx. `status` and `problem` are real.
//   decode    the server answered 2xx but the body was not the JSON we asked for.
//   conditional  we sent If-None-Match and got 304 with nothing stored to return.
//
// `http` carries ReaPrime's own error envelope. Every handler in the pinned tree answers
// a client error as `{"error": ..., "message"?: ...}` (`json_response.dart`), and the
// arm-time refusal this whole design is built around is one of them:
// `POST /api/v1/machine/profile` -> 400 `{"error":"Unsupported profile","message":...}`
// (`de1handler.dart` `_profileHandler`, the `ProfileModeUnsupportedException` arm). B9 is
// only meaningful if that message survives the trip to the screen intact, so it does.

/** The closed set of failure kinds. */
export const REA_ERROR = Object.freeze({
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    HTTP: 'http',
    DECODE: 'decode',
    CONDITIONAL: 'conditional',
});

const KINDS = Object.freeze(Object.values(REA_ERROR));

/** True for a value produced by {@link reaFailure}. */
export function isReaFailure(value) {
    return !!value && typeof value === 'object' && value.ok === false && KINDS.includes(value.kind);
}

/**
 * Build a failure result.
 *
 * Frozen, so a caller cannot patch a plausible value onto a failure and pass it on — the
 * defensive-scaffolding habit this rewrite is shedding did exactly that in five places.
 *
 * @param {string} kind    one of REA_ERROR
 * @param {object} detail
 * @param {number|null} [detail.status]   HTTP status, or null for network/timeout
 * @param {string} detail.message         human-readable, already includes the server's
 * @param {object|string|null} [detail.problem]  the server's parsed body, verbatim
 * @param {string} detail.method
 * @param {string} detail.url
 * @param {Error|null} [detail.cause]
 */
export function reaFailure(kind, { status = null, message, problem = null, method, url, cause = null }) {
    if (!KINDS.includes(kind)) throw new Error(`rea-errors: unknown kind ${kind}`);
    return Object.freeze({
        ok: false,
        kind,
        status,
        message,
        problem,
        method,
        url,
        cause,
    });
}

/**
 * Build a success result.
 *
 * `notModified` is a first-class outcome rather than an error: the server said the body
 * the caller already holds is current, which is information, not a fault. `data` is the
 * stored body in that case — see rea-conditional.js — so a caller that does not care
 * about revalidation can ignore the flag entirely and still be correct.
 */
export function reaSuccess({ status, data, etag = null, notModified = false, method, url }) {
    return Object.freeze({ ok: true, status, data, etag, notModified, method, url });
}

/**
 * The server's message, or the transport's own. Never a UI string — no punctuation
 * decisions, no i18n, no "Failed to ..." prefix invented here. A screen formats it.
 */
export function reaMessageOf(failure) {
    if (!isReaFailure(failure)) return null;
    const problem = failure.problem;
    if (problem && typeof problem === 'object') {
        const parts = [problem.error, problem.message].filter((p) => typeof p === 'string' && p);
        if (parts.length) return parts.join(': ');
    }
    if (typeof problem === 'string' && problem.trim()) return problem.trim();
    return failure.message;
}

/** The Error form, for the small number of call sites that genuinely want to throw. */
export class ReaError extends Error {
    constructor(failure) {
        super(reaMessageOf(failure) || 'request failed');
        this.name = 'ReaError';
        this.kind = failure.kind;
        this.status = failure.status;
        this.problem = failure.problem;
        this.method = failure.method;
        this.url = failure.url;
        if (failure.cause) this.cause = failure.cause;
    }
}

/**
 * `data` on success; throws {@link ReaError} on failure.
 *
 * Deliberately NOT the default shape. Returning failures makes ignoring one a visible
 * choice at the call site; throwing makes ignoring one the default, which is how 55
 * `try`/`catch` blocks accumulated in a single 2,406-line module (E2: 274 lines of
 * defensive scaffolding, almost all of it `catch (e) { logger.error(...); throw e; }`).
 */
export function unwrapRea(result) {
    if (result && result.ok) return result.data;
    throw new ReaError(result);
}
