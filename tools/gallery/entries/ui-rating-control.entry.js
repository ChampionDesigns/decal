/**
 * ui-rating-control.entry.js — the gallery entry for Wave 4 item #46 (Rating control).
 *
 * A PER-ENTRY FILE, not an edit to `tools/gallery/entries.js`. That file is one shared
 * hand-written array and this wave has twenty-two parallel builders, so N appends to it
 * are N-1 lost entries. The wave's single cross-cutting writer adds one import line and
 * one array slot; `test/ui-rating-control-gallery-entry.test.mjs` makes that hand-off
 * safe by failing here rather than in a battery photographing an empty stage.
 *
 * `module` is resolved by `tools/gallery/gallery.js` (`import(entry.module)`), so it is
 * relative to `tools/gallery/`, not to this directory.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`<entry.id>--<state.id>`), so they are identifiers
 * rather than labels and a rename is a re-baseline.
 *
 * THE SIX STATES ARE THE SIX THINGS WORTH LOOKING AT, and two of them exist only
 * because of bug L4:
 *
 *   - `unrated` and `rated` are the machine without the DYE2 plugin, which is the
 *     common case and the one Slate's 165px box was hand-derived for;
 *   - `handoff` is the FOURTH CHILD arriving — the exact configuration in which
 *     ".slate-shot-rate is 11px shorter than its own contents" (LAYOUT_SPEC_DRAFT.md
 *     §7.2 L4);
 *   - `stated-height` puts Slate's own frozen 165px on the element as an inline
 *     block-size WITH the handoff present. In Slate that is the bug, photographed:
 *     children summing to 176, the button's bottom measured at 1156 against a box
 *     bottom of 1145. Here the box is as tall as its contents anyway, because
 *     `min-block-size: max-content` outranks a stated height. A capture that ever
 *     shows the button clipped is the defect coming back;
 *   - `nothing-to-rate` is Slate's own disabled case (shot-rating.js:69-73, "with no
 *     shot on screen there is nothing to rate ... say so on the control rather than
 *     accepting input and discarding it");
 *   - `narrow` is the container floor at Slate's own zone width, which is the only
 *     honest way to show something that reads its own container rather than the
 *     viewport (spec §2.1 Rule 1).
 *
 * The stage widths are lengths only — no colour literal reaches an inline style, which
 * Gate C scans `tools/` for.
 */

/** Slate's own zone: CITE live-ready .slate-shot-rate [i=154] rect 1720,980,172,165. */
const SLATE_ZONE = '172px';

/** A stage wide enough that nothing is at its floor, for the four ordinary states. */
const ROOMY = '260px';

export const entry = {
    id: 'ui-rating-control',
    title: 'Rating control',
    module: '../../src/components/ui-rating-control.js',
    notes:
        'Enjoyment score + slider + DYE handoff, composed from #33, #23 and #1. The row '
        + 'exists to retire bug L4 - a 165px box with 176px of children whenever the '
        + 'handoff is present - so the host states no height at all and instead states '
        + 'min-block-size: max-content, which a stated height cannot beat. The rating '
        + 'persists through ReaPrime\'s own enjoyment annotation, not the skin-local KV '
        + 'orphan (CARRY_FORWARD.md §3c); this control reads and writes nothing itself - '
        + 'it publishes rating-change / dye-handoff and the screen owns the transport. '
        + '(rating-input, one per pixel of drag, was retired 29 Aug 2026 - audit F-011 - '
        + 'because nothing heard it and the drag preview is this component\'s own state.)',
    states: [
        {
            id: 'unrated',
            title: 'Unrated (no handoff)',
            notes:
                'The dash, not a zero. "An unrated shot must not look like a shot rated '
                + 'zero" (slate-live.css:1533) - ui-stat-tile renders the em dash in '
                + '--ui-muted and announces a sentence, and the track fills nothing.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1"></ui-rating-control>',
        },
        {
            id: 'rated',
            title: 'Rated 73 (no handoff)',
            notes:
                'The three-child column Slate\'s 165px was derived for. The score is the '
                + 'served enjoyment annotation, printed at the control\'s own step so the '
                + 'number and the thumb cannot disagree.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1" score="73"></ui-rating-control>',
        },
        {
            id: 'handoff',
            title: 'With the DYE handoff - L4\'s configuration',
            notes:
                'The fourth child. In Slate the children now sum to 176 in a 165px box and '
                + 'the button\'s bottom measures 1156 against 1145; here the column simply '
                + 'grows by the button and the gap.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1" score="73" handoff></ui-rating-control>',
        },
        {
            id: 'stated-height',
            title: 'Slate\'s 165px stated, handoff present',
            notes:
                'The bug, aimed straight at the component. A screen states Slate\'s own '
                + 'frozen height and the box is still as tall as its contents, because '
                + 'min-block-size: max-content outranks it. Nothing is clipped and nothing '
                + 'scrolls.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control style="block-size: 165px" shot-id="shot-1" score="73" handoff></ui-rating-control>',
        },
        {
            id: 'nothing-to-rate',
            title: 'Nothing to rate',
            notes:
                'No shot id: the slider and the handoff refuse, at the one disabled dial '
                + '(--ui-opacity-disabled), and the score is absent rather than zero.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control handoff></ui-rating-control>',
        },
        {
            id: 'narrow',
            title: 'Slate\'s own zone width (172px)',
            notes:
                'The container floor. The slider\'s 48px hit box and the handoff\'s '
                + '--ui-control-h hold - ergonomics is physical (spec §2.2) - and the '
                + 'narrow container is absorbed by the score\'s fluid display step, which '
                + 'floors at the clamp\'s 22px rather than clipping.',
            hostStyle: { 'inline-size': SLATE_ZONE },
            html: '<ui-rating-control shot-id="shot-1" score="100" handoff></ui-rating-control>',
        },
    ],
};

export default entry;
