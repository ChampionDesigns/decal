/**
 * feedback-store.js — the one POST behind Send Feedback.
 *
 * THE LEAF WAS EMPTY AND ITS OWN DECLARATION SAID WHY: "POST /api/v1/feedback — contract
 * row status `recorded`. Availability is already readable
 * (capabilities-store.readFeedbackAvailability); the form is not." Availability was the
 * half that had been built; this is the form's half.
 *
 * CONTRACT, read at 2b047d02 (`feedback_handler.dart` `_handleSubmitFeedback`):
 *
 *   POST /api/v1/feedback
 *     201 {…FeedbackResult}   submitted — the service opens a GitHub issue
 *     400 {error, message}    `description` missing or blank, and nothing else is checked
 *     503 {error, message}    THE BUILD CARRIES NO TOKEN. `_service.isConfigured` is
 *                             false, and this is a property of how ReaPrime was compiled
 *                             (`--dart-define=GITHUB_FEEDBACK_TOKEN=…`), not of the
 *                             machine, the network or the request.
 *     500                     the submit itself failed
 *
 * AVAILABILITY IS ONLY KNOWABLE BY ASKING. There is no GET, so the 503 arrives at SUBMIT
 * time and never before. Hiding the form until a probe answered would mean posting a real
 * feedback item to find out, so the form is shown and a 503 is reported as what it is —
 * "this build cannot send feedback" — rather than as a failure the user could retry.
 * `readFeedbackAvailability` in the capability store is the one place that judgement is
 * written; this store reports the raw result and does not re-decide it.
 *
 * `type` IS AN ENUM WITH A FORGIVING PARSER AND THE FORM STILL SPELLS IT PROPERLY.
 * `FeedbackType.values.firstWhere(..., orElse: () => FeedbackType.other)` means an unknown
 * word silently becomes `other` — a 200 for a request that did not say what it meant. The
 * four names below are the enum's own.
 *
 * SCREENSHOTS ARE NOT SENT. `FeedbackRequest.fromJson` does not read them at all — the
 * field exists on the Dart class and the JSON parser skips it, so anything this skin
 * attached would be dropped in silence. `includeLogs` and `includeSystemInfo` ARE read,
 * and both default to true when absent.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

export const FEEDBACK_STATUS = Object.freeze({
    IDLE: 'idle',
    SENDING: 'sending',
    SENT: 'sent',
    /** Refused. `reason` says which of the three refusals it was. */
    REFUSED: 'refused',
});

export const FEEDBACK_REFUSAL = Object.freeze({
    /** 503 — the ReaPrime build carries no GitHub token. Not retryable. */
    NOT_CONFIGURED: 'notConfigured',
    /** 400 — a blank description. The only field the handler validates. */
    EMPTY_DESCRIPTION: 'emptyDescription',
    /** Anything else, including a 500 from the submit itself. */
    FAILED: 'failed',
});

/** `FeedbackType`, verbatim from `lib/src/models/feedback/feedback_request.dart:3`. */
/* THE FOUR THE HANDLER ACCEPTS, each with the sentence Slate puts under it.
 *
 * Ben, 26 August 2026: "mostly copy Slate." Slate draws three of these as TILES with a
 * subtitle each — "Something isn't working", "Suggest an improvement", "Share thoughts or
 * ideas" — and the subtitle is what tells a reader which one their message is. Labels
 * alone leave "Question" and "Other" indistinguishable until you have written the message.
 *
 * FOUR, NOT SLATE'S THREE: `FeedbackType` on the handler has four names and dropping one
 * would make a category unreachable. The fourth's sentence is this skin's. */
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
    /* WHERE THE REPORT LANDED, AND IT WAS THROWN AWAY UNTIL 27 AUGUST 2026.
     *
     * A successful submit answers 201 with `FeedbackSubmissionResult.toJson` —
     * `{success, issueUrl, issueNumber}` — and this store read none of it: it set SENT
     * with `message: null` and never touched `result.data`, so the only thing the screen
     * could say was "Thank you." A person who has just described a fault has one further
     * question, which is where it went, and the answer was on the wire the whole time.
     * That is the finished half with no other half this fork exists to remove.
     *
     * BOTH ARE OPTIONAL ON THE DART CLASS and both are omitted from the JSON when null, so
     * a 201 carrying neither is a real outcome — the report was filed and this build did
     * not say where. The screen draws the plain thank-you for that, and never a fabricated
     * issue number. */
    issueUrl: null,
    issueNumber: null,
});

/**
 * THE SERVER'S OWN REASON FOR REFUSING, AND IT WAS UNREACHABLE.
 *
 * This store used to read `result.data?.message`, and a failed transport result HAS NO
 * `data` FIELD AT ALL: `reaFailure` builds `{ok:false, kind, status, message, problem, …}`
 * and the parsed body lands in `problem` (`rea-transport.js` puts `parseProblem(text)`
 * there on any non-ok status; `rea-errors.js` documents it as "the server's parsed body,
 * verbatim"). So every refusal fell through to the screen's generic "Sending failed." and
 * the handler's own sentence — the one naming WHICH of the three refusals it was — was
 * never seen by anybody. A half with no caller, in the one place a user needs the detail.
 *
 * TWO KEYS, BECAUSE THE HANDLER GENUINELY USES TWO. A 400 and a 503 are hand-built
 * `{error, message}` bodies; a failed SUBMIT is `jsonError(result.toJson())`, which is
 * `FeedbackSubmissionResult` and spells the same idea `errorMessage`. Both are read, in
 * that order, and anything that is not a non-empty string is null so the screen falls back
 * to its own sentence rather than printing "[object Object]".
 */
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

        /**
         * Send one. `description` is the only required field.
         *
         * A BLANK DESCRIPTION IS REFUSED HERE TOO, and not to save a round trip: the
         * handler's test is `(json['description'] as String).trim().isEmpty`, so a body
         * with no `description` key at all CASTS NULL TO STRING and throws into the
         * catch-all — a 500 where a 400 was meant. Sending a string always is what keeps
         * the refusal legible.
         */
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
                /* KEEP WHAT THE 201 SAID. `issueNumber` is an int on the Dart class and
                 * `issueUrl` a string, and both are absent from the body when null — so
                 * each is taken only in the type it is served in and is otherwise left
                 * null. A number coerced out of a string here would put a plausible issue
                 * number under a link that goes nowhere. */
                const body = result.data;
                return store.set({
                    status: FEEDBACK_STATUS.SENT,
                    reason: null,
                    message: null,
                    issueUrl: typeof body?.issueUrl === 'string' && body.issueUrl !== '' ? body.issueUrl : null,
                    issueNumber: Number.isInteger(body?.issueNumber) ? body.issueNumber : null,
                });
            }

            const reason = result.status === 503
                ? FEEDBACK_REFUSAL.NOT_CONFIGURED
                : result.status === 400
                    ? FEEDBACK_REFUSAL.EMPTY_DESCRIPTION
                    : FEEDBACK_REFUSAL.FAILED;
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
