

/**
 * The error shapes ReaPrime answers with, and what each means to a caller.
 */
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

export function unwrapRea(result) {
    if (result && result.ok) return result.data;
    throw new ReaError(result);
}
