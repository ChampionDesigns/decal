/**
 * The one POST behind Send Feedback.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

export const FEEDBACK_STATUS = Object.freeze({
    IDLE: 'idle',
    SENDING: 'sending',
    SENT: 'sent',
    REFUSED: 'refused',
});

export const FEEDBACK_REFUSAL = Object.freeze({
    /** 503 — the ReaPrime build carries no GitHub token. Not retryable. */
    NOT_CONFIGURED: 'notConfigured',
    /** 400 — a blank description. */
    EMPTY_DESCRIPTION: 'emptyDescription',
    /** 400 — the app is not signed in to a Decent account, or could not check it. */
    ACCOUNT_REQUIRED: 'accountRequired',
    /** Anything else, including a 500 from the submit itself. */
    FAILED: 'failed',
});

/** `FeedbackType`, verbatim from `lib/src/models/feedback/feedback_request.dart:3`. */
export const FEEDBACK_TYPES = Object.freeze([
    Object.freeze({ value: 'bug', label: 'Bug Report', hint: 'Something is not working.' }),
    Object.freeze({ value: 'feature', label: 'Feature Request', hint: 'Suggest an improvement.' }),
    Object.freeze({ value: 'question', label: 'Question', hint: 'Ask how something is meant to work.' }),
    Object.freeze({ value: 'other', label: 'Other', hint: 'Share thoughts or ideas.' }),
]);

const EMPTY_STATE = Object.freeze({
    status: FEEDBACK_STATUS.IDLE,
    reason: null,
    /** The handler's own message, when it sent one. Shown verbatim; never rewritten. */
    message: null,
    issueUrl: null,
    issueNumber: null,
});

const ACCOUNT_REQUIRED_ERROR = 'Decent account required';

function refusalOf(result) {
    if (result.status === 503) return FEEDBACK_REFUSAL.NOT_CONFIGURED;
    if (result.status !== 400) return FEEDBACK_REFUSAL.FAILED;
    return result.problem?.error === ACCOUNT_REQUIRED_ERROR
        ? FEEDBACK_REFUSAL.ACCOUNT_REQUIRED
        : FEEDBACK_REFUSAL.EMPTY_DESCRIPTION;
}

function failureMessage(result) {
    const problem = result?.problem;
    if (!problem || typeof problem !== 'object') return null;
    for (const key of ['errorMessage', 'message']) {
        const value = problem[key];
        if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return null;
}

export function createFeedbackStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createFeedbackStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('feedback') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'feedback', logger: log });

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        async submit({ description, type = 'other', includeLogs = true, includeSystemInfo = true } = {}) {
            const text = typeof description === 'string' ? description.trim() : '';
            if (text === '') {
                return store.set({
                    ...EMPTY_STATE,
                    status: FEEDBACK_STATUS.REFUSED,
                    reason: FEEDBACK_REFUSAL.EMPTY_DESCRIPTION,
                });
            }
            const known = FEEDBACK_TYPES.some((entry) => entry.value === type);
            store.set({ ...EMPTY_STATE, status: FEEDBACK_STATUS.SENDING });
            const result = await callRoute(transport, 'postFeedback', {
                body: {
                    description: text,
                    /* AN UNKNOWN WORD BECOMES `other` AT THE HANDLER SILENTLY, so it is
                     * made explicit here instead — the request then says what the server
                     * will do with it. */
                    type: known ? type : 'other',
                    includeLogs: includeLogs !== false,
                    includeSystemInfo: includeSystemInfo !== false,
                },
            });
            if (result.ok) {
                const body = result.data;
                return store.set({
                    status: FEEDBACK_STATUS.SENT,
                    reason: null,
                    message: null,
                    issueUrl: typeof body?.issueUrl === 'string' && body.issueUrl !== '' ? body.issueUrl : null,
                    issueNumber: Number.isInteger(body?.issueNumber) ? body.issueNumber : null,
                });
            }

            const reason = refusalOf(result);
            if (log && log.warn) log.warn(`feedback refused (${reason})`);
            return store.set({
                ...EMPTY_STATE,
                status: FEEDBACK_STATUS.REFUSED,
                reason,
                message: failureMessage(result),
            });
        },

        /** Back to a blank form. The surface's own "send another". */
        reset() { return store.set({ ...EMPTY_STATE }); },

        stop() { store.destroy(); },
    };
}
