/**
 * chart-feed.js — the shot buffer's road to the chart card, and the only road there is.
 *
 * WHAT THIS IS. A reactive controller that watches ONE shot buffer (wave 0b,
 * `src/stores/shot-buffer.js`), runs gate 6's derivation over it
 * (`deriveFromBuffer`, `src/lib/shot-derivation.js`) at most once per animation frame,
 * and hands the result to its host to render. `<ui-chart-card>` takes a derivation and
 * nothing else — "a screen hands it `deriveFromBuffer(buffer)` and the card draws that"
 * — so this controller is the whole of what a screen has to own in order to put a live
 * shot on a chart.
 *
 * WHY IT IS A MODULE AND NOT SIX LINES INSIDE `live-screen.js`. Three reasons, each of
 * them a numbered defect:
 *
 * 1. BUG chart-C13 — "`chart.js` reads other modules' RENDERED DOM as an input,
 *    scraping numbers back out of `#profile-name`, `#history-date`, `#dose-in-value`,
 *    `#shot-data-total-weight` and `#shot-data-total-time` with a regex"
 *    (LAYOUT_SPEC_DRAFT.md §7.8). The cure is not vigilance, it is a data road with
 *    no DOM in it: this file imports no component, touches no element, and its ONLY
 *    input is the buffer's own published state. `CARRY_FORWARD.md` gate 6 calls that
 *    "fed from the model", and the shape of the fix is that the model is the only
 *    thing there is to feed from.
 *
 * 2. BUG chart-C9 — "dead weight on the 15 Hz path" (`chart.js:801-817, 595-599,
 *    1972-1980, 781`). The live buffer publishes once per machine frame; a screen that
 *    re-derived on each publish inside `willUpdate` would run gate 6's walk once per
 *    frame whether or not anything changed, and would run it again for every unrelated
 *    reactive update the screen has. Here the publish only marks the feed DIRTY, the
 *    single-flight frame scheduler (wave 0a, shared with the plot surface) coalesces,
 *    and a run whose buffer revision has not moved is skipped outright. `derivations`
 *    is the count, exposed so a test can assert the coalescing rather than trust it.
 *
 * 3. B4 — THE TIME AXIS IS ReaPrime's, AND NOTHING HERE TOUCHES IT. "The skin plots
 *    what ReaPrime stamps... Until [R4] lands the skin does not try to reconstruct it"
 *    (SCOPE Part 3 §4, and `src/stores/time-axis.js`, which verified it at the pin).
 *    The derivation's `axis.t` is arrival stamps minus the chosen origin, in seconds,
 *    with the transport's own jitter left in and the unstamped samples dropped and
 *    counted. This file passes that bundle through UNCHANGED — it holds no clock, does
 *    no resampling, no interpolation, no monotonic clamp, and never substitutes
 *    `Date.now()` for a stamp it cannot read. When R4 lands, `stampOf` in
 *    `time-axis.js` gains the machine-clock field and nothing here changes, which is
 *    the point of the deferral being permanent for shots recorded before it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   - NO ENDPOINT, NO STORE IMPORT. The buffer arrives as an argument. The screen gets
 *     it from the app shell's `live.shot`; a test hands it one it filled by hand; a
 *     recorded shot needs no buffer at all (`deriveFromRecord` goes straight to the
 *     card). Same rule as the card itself: data is passed in, never fetched.
 *   - NO POLICY ABOUT WHAT A SHOT IS. `open`, `close`, `joinedLate` and the B6 source
 *     choice are the buffer's (`shot-buffer.js`); the refusal shape and its `reason`
 *     are gate 6's. This controller re-decides none of them and re-labels none of them.
 *   - NO RATE OF ITS OWN. One frame is the coalescing window because that is the
 *     render budget's unit (Part 3 §2: 15 Hz is the RENDER budget, not the socket
 *     rate). A timer here would be a second clock disagreeing with the first.
 *
 * USE
 *     #chart = new ChartFeed(this);          // in a Lit element
 *     willUpdate(changed) { if (changed.has('shot')) this.#chart.watch(this.shot); }
 *     render() { return html`<ui-chart-card .derivation=${this.#chart.derivation}>`; }
 */

import { createSingleFlightFrameScheduler } from './chart-render-scheduler.js';
import { deriveFromBuffer } from './shot-derivation.js';
import { logger } from './logger.js';

/** One scope for both halves of the chart road; the surface already logs under it. */
const log = logger.scope('chart');

export class ChartFeed {
    #host;

    #buffer = null;

    #unsubscribe = null;

    #derivation = null;

    #record = null;

    #derive;

    #scheduler;

    /** How many derivations have actually run. The oracle for chart-C9's coalescing. */
    #derivations = 0;

    /** The buffer revision the current derivation was taken at; null when there is none. */
    #revision = null;

    /**
     * @param {object} host  a Lit-style host: `addController` and `requestUpdate`
     * @param {object} [options]
     * @param {object|null} [options.record]  the shot record, when one is known — gate 6
     *        reads `workflow.stepNames` out of it for the step boundaries' names. A live
     *        shot has no record yet and passes null, which is a named absence, not a gap.
     * @param {Function} [options.requestFrame]  injected for tests; defaults to rAF
     * @param {Function} [options.cancelFrame]
     * @param {Function} [options.derive]  the derivation, injected only so a test can
     *        count calls or make one throw. Defaults to gate 6's own.
     */
    constructor(host, { record = null, requestFrame, cancelFrame, derive = deriveFromBuffer } = {}) {
        if (!host) throw new Error('ChartFeed: a host is required');
        this.#host = host;
        this.#record = record;
        this.#derive = derive;
        this.#scheduler = createSingleFlightFrameScheduler(() => this.#run(), {
            requestFrame,
            cancelFrame,
            /* Belt and braces. `#run` catches for itself (see `#reportFailure`), because
             * HALF ITS CALLERS DO NOT COME THROUGH HERE — the mount path, the record
             * setter and `refresh()` all run off the frame. This handler stays so that a
             * future throw raised by the scheduler's own plumbing is reported the same
             * way rather than swallowed. */
            onError: (error) => this.#reportFailure(error),
        });
        host.addController?.(this);
    }

    /* ---- what the host reads ---------------------------------------------- */

    /** The latest gate-6 derivation, or null before the first one. Handed on as-is. */
    get derivation() { return this.#derivation; }

    /** The buffer being watched, or null. */
    get buffer() { return this.#buffer; }

    /** How many times the derivation has run. Coalescing is provable, not asserted. */
    get derivations() { return this.#derivations; }

    /** The buffer revision the current derivation belongs to. */
    get revision() { return this.#revision; }

    /** Whether a derivation is pending — a frame requested and not yet run. */
    get pending() { return this.#scheduler.state().dirty; }

    /**
     * The record gate 6 reads step names and the workflow's dose out of.
     *
     * Settable because a live shot learns its record LATER (the workflow arrives with
     * the shot, the stored record only exists once ReaPrime has written it), and a
     * chart whose step boundaries are unnamed until then is right rather than wrong.
     */
    get record() { return this.#record; }

    set record(record) {
        if (record === this.#record) return;
        this.#record = record ?? null;
        /* The step NAMES live in the record and nowhere else, so a record arriving has
         * to re-derive even though the buffer has not moved a sample. Dropping the held
         * revision is what says so — the skip in `#run` is a cache, and this invalidates
         * it. Derived NOW rather than on the next frame, for the same reason `watch`
         * does: an input the caller SET is not a frame of telemetry to coalesce, and a
         * caller that sets a property and reads `derivation` on the next line is right
         * to expect the two to agree. */
        this.#revision = null;
        if (this.#buffer) this.#runNow();
    }

    /* ---- watching ---------------------------------------------------------- */

    /**
     * Watch a buffer — or `null` to let go of the one being watched.
     *
     * Idempotent for the same buffer, so a host that sets the property on every update
     * costs one identity comparison. Switching buffers drops the previous subscription
     * FIRST: two live subscriptions to two buffers would interleave two shots into one
     * chart, and the failure would look like a machine glitch rather than like a bug.
     */
    watch(buffer) {
        if (buffer === this.#buffer) return this;
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#buffer = buffer ?? null;
        this.#derivation = null;
        this.#revision = null;
        if (!this.#buffer) {
            this.#scheduler.cancelPending();
            this.#host.requestUpdate?.();
            return this;
        }
        /* Derive ONCE, now, rather than waiting for the next publish: a screen mounted
         * mid-shot must show the shot so far, and a buffer that is between frames — or
         * that holds a finished shot nobody is adding to — would otherwise leave the
         * card empty for ever with nothing wrong anywhere. */
        this.#subscribe();
        this.#runNow();
        return this;
    }

    #subscribe() {
        const buffer = this.#buffer;
        if (!buffer || typeof buffer.subscribe !== 'function') {
            throw new Error('ChartFeed.watch: a shot buffer with subscribe() is required');
        }
        this.#unsubscribe = buffer.subscribe(() => this.#invalidate());
    }

    /* ---- the frame --------------------------------------------------------- */

    /** Mark dirty and let the scheduler decide when. The 15 Hz path's whole cost. */
    #invalidate() {
        this.#scheduler.request();
    }

    /** Derive right now, off the frame — the mount path and the test seam. */
    refresh() {
        this.#runNow();
        return this.#derivation;
    }

    #runNow() {
        this.#scheduler.cancelPending();
        this.#run();
    }

    /**
     * A derivation that throws must not take the screen with it, and must not be silent
     * either: the chart keeps the last good shot on screen and the failure is reported,
     * with provenance, exactly as the plot surface reports a mount that did not finish.
     *
     * ONE handler, because there are TWO ways in. The scheduled path had this guard from
     * the start (the scheduler's own try/catch, `chart-render-scheduler.js:34-39`); the
     * off-frame path — `watch()` from a host's `willUpdate`, the `record` setter,
     * `refresh()`, `hostConnected()` — did not, so a throw on the FIRST buffer propagated
     * straight into Lit's update and took the screen down. The revision is deliberately
     * NOT advanced here: a failed derivation is not a cached one, so the next publish
     * tries again rather than freezing the chart on the failure.
     */
    #reportFailure(error) {
        log.error(`derivation failed: ${error?.message ?? error}`);
    }

    #run() {
        const buffer = this.#buffer;
        if (!buffer) return;
        /* THE SKIP THAT MAKES chart-C9 STRUCTURAL. A publish that carries no new sample
         * — a staleness re-classification, a cap notice, a second subscriber arriving —
         * moves the revision but not the shot; and two publishes inside one frame are
         * one derivation by construction. Comparing the revision costs one integer and
         * removes the whole class of "the chart re-derived because something else
         * changed". */
        const revision = typeof buffer.revision === 'function' ? buffer.revision() : null;
        if (revision !== null && revision === this.#revision) return;
        let derivation;
        try {
            derivation = this.#derive(buffer, { record: this.#record });
        } catch (error) {
            this.#reportFailure(error);
            return;
        }
        this.#derivation = derivation;
        this.#revision = revision;
        this.#derivations += 1;
        this.#host.requestUpdate?.();
    }

    /* ---- lifecycle (CONVENTIONS §12: what is subscribed is unsubscribed) ---- */

    hostConnected() {
        if (this.#buffer && !this.#unsubscribe) {
            this.#subscribe();
            this.#runNow();
        }
    }

    hostDisconnected() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#scheduler.cancelPending();
    }

    /** Let go of everything. The host's `disconnectedCallback` is the usual caller. */
    destroy() {
        this.hostDisconnected();
        this.#buffer = null;
        this.#derivation = null;
        this.#revision = null;
    }
}
