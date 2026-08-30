/**
 * alignment-offset.js — the ±5 s alignment between two shots. Gate 7 port.
 *
 * Carried from Slate's `history-viewer.js` (CARRY_FORWARD `history-viewer.js` row:
 * "Keep `HV_OFFSET_LIMIT = 5` and its reasoning … `setAlignmentOffset` (`:1026-1038`)
 * as a redraw rather than a reach into the renderer's trace list"). Only the offset
 * POLICY comes across in Wave 4 — it is the build input for #44, the compare bar
 * (SCOPE Part 4 #44: "±5 s offset policy ports from `history-viewer.js`"; Part 10 §8
 * stages this port ahead of its consumer). The rest of the viewer is Wave 5 phase 6.
 *
 * Not to be confused with `chart-align.js`, which aligns CHANNELS onto one x axis
 * inside a single shot. This module aligns two SHOTS against each other in time.
 *
 * WHAT THE SOURCE OWNED THAT DID NOT COME ACROSS
 *
 *   - the module-singleton `state.offset` (`:81-91`, verified a singleton in the
 *     audit). The offset is now the caller's value, passed in and returned, so more
 *     than one comparison can exist at a time.
 *   - every `document.getElementById('hv-align*')` in `updateAlignBar` (`:1042-1069`):
 *     the control state is answered here as data and rendered by #44.
 *   - the painted-band arithmetic (`:1055-1061`, "filling from the left end made a
 *     slider sitting at 0.0 s read as about 60% of something"). That behaviour is
 *     already in the library: `ui-slider`'s `origin` property (#23). The compare bar
 *     sets `origin="0"`; there is no second copy of the maths.
 *   - the shifting of a series itself. `shiftSeriesX` in `shot-derivation.js` already
 *     carries it from Gate 5/6, so this module owns the NUMBER and that module owns
 *     the ARRAY: apply an offset as `shiftSeriesX(series, clampAlignmentOffset(n))`.
 *   - the P–Q correspondence marks (`:339-402`). Unreachable in Slate; BUILT by fix run 6
 *     in `history-power.js` + `history-power-page.js`, which is the one place this
 *     module's offset means something other than a slide — "a time offset cannot move a
 *     P–Q path", so what it moves there is which point of B corresponds to A's instant.
 *
 * Gate 2: this module reads NOTHING from the server. An alignment offset is a piece of
 * view state the person operating the slider owns, so there is no address-layer read
 * here and no server key string — by absence, not by exemption.
 *
 * DOM-free, no imports, pure functions: `node:test` imports it directly.
 */

/**
 * How far the comparison shot may be slid, either way.
 *
 * Five seconds, not fifteen. Carried verbatim in reasoning from `history-viewer.js:52-61`:
 * the alignment is for the drift between two pours of the SAME profile — preinfusion ends
 * on a pressure threshold, so a coarser grind pushes everything after it a second or two
 * right. Fifteen seconds of travel spends most of the slider on offsets that put the two
 * shots in different phases entirely, and squeezes the range you actually use into the
 * middle third of the track.
 *
 * It is not a limit on what can be compared; it is a statement of what alignment MEANS.
 */
export const ALIGNMENT_OFFSET_LIMIT_S = 5;

/**
 * The granularity of the control, from the shipped slider (`index.html:582`,
 * `step="0.1"`). Tenths, because the readout is printed to one decimal — a finer step
 * would move the traces without changing the number beside them.
 *
 * The policy does not quantise: `clampAlignmentOffset` bounds a value, the control
 * chooses the increments. A value arriving from a keyboard nudge or a stored view is
 * used as given.
 */
export const ALIGNMENT_OFFSET_STEP_S = 0.1;

/**
 * The two slots of a comparison. A is the reference and never moves; B is the shot the
 * offset slides (`history-viewer.js:242-244`, and the test that pins it: "the alignment
 * slides B against A, not both").
 */
export const ALIGNMENT_SLOT = Object.freeze({ REFERENCE: 'a', MOVING: 'b' });

/**
 * The offset as it will actually be applied — bounded, and never NaN.
 *
 * Every path that uses an offset goes through here first, including the readout. The
 * viewer's own note is the reason (`:1146`, "Repaint every control from state, so no two
 * of them can disagree"): a slider that reports 7.0 s while the traces moved 5.0 s is the
 * same class of silent lie as the inert slider this whole surface was rebuilt around.
 *
 * @param {unknown} seconds
 * @returns {number} within ±ALIGNMENT_OFFSET_LIMIT_S; 0 for anything not a finite number
 */
export function clampAlignmentOffset(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return 0;
    if (value > ALIGNMENT_OFFSET_LIMIT_S) return ALIGNMENT_OFFSET_LIMIT_S;
    if (value < -ALIGNMENT_OFFSET_LIMIT_S) return -ALIGNMENT_OFFSET_LIMIT_S;
    return value === 0 ? 0 : value;   // normalises -0, which prints as "-0.0 s"
}

/**
 * An instant on B's clock, as drawn: B's time t is drawn at t + offset.
 *
 * The scalar form of the offset, for the things that ride the time axis without being a
 * series — B's step boundaries move with B's curves and A's stay put (`:472-484`), and
 * two call sites clamping separately is how a drift between them starts.
 *
 * @param {number} t seconds on the moving shot's own clock
 * @param {unknown} offset
 * @returns {number}
 */
export function alignedInstant(t, offset) {
    return t + clampAlignmentOffset(offset);
}

/**
 * The offset after a shot is put in a slot, or taken out of one.
 *
 * `history-viewer.js:1130-1132`: "A new pair starts aligned: carrying an offset across
 * would silently apply an alignment chosen for two different shots" — and `:1102-1103`
 * for the empty case, "an alignment chosen for a pair means nothing once the pair is
 * gone". Slate resets on the B slot only, which is what this carries; changing A is
 * recorded as a deferred question rather than decided here —
 * `waves/4/ledger-src/port-history-viewer-offset-deferred-questions.json`, the only
 * entry in it. One line here and one test flip it.
 *
 * @param {unknown} offset the offset in force
 * @param {string} slot which slot changed — 'a' or 'b'
 * @returns {number}
 */
export function alignmentOffsetAfterSlotChange(offset, slot) {
    return slot === ALIGNMENT_SLOT.MOVING ? 0 : clampAlignmentOffset(offset);
}

/**
 * The readout beside the slider: a signed number of seconds, to one decimal.
 *
 * Signed always, because an unsigned "3.0 s" does not say which way the shot moved, and
 * the sign is the whole content of the control at small offsets. Clamped first, so the
 * number printed is the number applied.
 *
 * The zero form is the shipped one, quoted from the corpus (Part 10 §4 citation rule):
 *
 *   CITE  history-viewer .slate-compare-offset [i=174] <label class="slate-compare-offset">
 *         text "Align B 0.0 s"   rect x=336 y=159 w=1410 h=44
 *
 * — one decimal, a space before the unit, and no sign at zero. Everything else about that
 * label (its wording, and the 44 px slider beside a 64 px Reset, layout bug H8) belongs to
 * #44, not here.
 *
 * @param {unknown} seconds
 * @returns {string} e.g. "+3.0 s", "0.0 s", "-2.5 s"
 */
export function formatAlignmentOffset(seconds) {
    const clamped = clampAlignmentOffset(seconds);
    const fixed = clamped.toFixed(1);
    if (Number(fixed) === 0) return '0.0 s';
    return `${clamped > 0 ? '+' : ''}${fixed} s`;
}

/**
 * What the compare bar can do right now, as data (`updateAlignBar`, `:1042-1064`).
 *
 *   - `available`: a table has no time axis to slide, so on the data page the control has
 *     no meaning and is not shown at all rather than shown dead.
 *   - `sliderDisabled`: without a second shot there is nothing to move.
 *   - `resetDisabled`: reset is only ever an undo — at 0 there is nothing to undo.
 *
 * Defaults are the safe reading of a missing flag: a bar lives on a chart page
 * (`hasTimeAxis` true), and no comparison shot until the caller says otherwise.
 *
 * @param {{offset?: unknown, hasComparison?: boolean, hasTimeAxis?: boolean}} view
 * @returns {{available: boolean, sliderDisabled: boolean, resetDisabled: boolean}}
 */
export function alignmentControlState({ offset = 0, hasComparison = false, hasTimeAxis = true } = {}) {
    const compare = Boolean(hasComparison);
    return Object.freeze({
        available: Boolean(hasTimeAxis),
        sliderDisabled: !compare,
        resetDisabled: !compare || clampAlignmentOffset(offset) === 0,
    });
}

/*
 * OFFSET-AS-REDRAW, the doctrine this module is half of — carried as prose because it
 * governs the CONSUMER, and there is nothing left to implement once it is followed.
 *
 * Slate's first alignment slider reached into the renderer's trace list, found B's traces
 * by a `meta` tag and rewrote their x arrays IN PLACE. It addressed one index past the
 * end, the renderer threw, a catch swallowed it, and the control did nothing at all —
 * invisible to any test that only read the source (`test/history-viewer.test.mjs:1-8`).
 * That machinery existed because a full redraw was assumed expensive. It is 4 ms
 * (`:1032-1034`).
 *
 * So: a new offset is a REDRAW. The consumer re-reads both bundles and rebuilds the traces
 * with `shiftSeriesX(series, clampAlignmentOffset(n))` at build time — the only place the
 * offset can be applied wrongly — and because that returns a NEW x array, redrawing twice
 * cannot compound the shift. `test/alignment-offset.test.mjs` pins that composition.
 */
