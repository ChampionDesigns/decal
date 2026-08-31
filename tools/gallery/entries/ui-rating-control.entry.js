/**
 * The gallery entry for.
 */

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
        + 'orphan; this control reads and writes nothing itself - '
        + 'it publishes rating-change / dye-handoff and the screen owns the transport. '
        + '(rating-input, one per pixel of drag, was retired 29 Aug 2026 - audit F-011 - '
        + 'because nothing heard it and the drag preview is this component\'s own state.)',
    states: [
        {
            id: 'unrated',
            title: 'Unrated (no handoff)',
            notes:
                'The dash, not a zero. "An unrated shot must not look like a shot rated '
                + 'zero" - ui-stat-tile renders the em dash in '
                + '--ui-muted and announces a sentence, and the track fills nothing.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1"></ui-rating-control>',
        },
        {
            id: 'rated',
            title: 'Rated 73 (no handoff)',
            notes:
                'The three-child column the reference skin\'s 165px was derived for. The score is the '
                + 'served enjoyment annotation, printed at the control\'s own step so the '
                + 'number and the thumb cannot disagree.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1" score="73"></ui-rating-control>',
        },
        {
            id: 'handoff',
            title: 'With the DYE handoff - L4\'s configuration',
            notes:
                'The fourth child. In the reference skin the children now sum to 176 in a 165px box and '
                + 'the button\'s bottom measures 1156 against 1145; here the column simply '
                + 'grows by the button and the gap.',
            hostStyle: { 'inline-size': ROOMY },
            html: '<ui-rating-control shot-id="shot-1" score="73" handoff></ui-rating-control>',
        },
        {
            id: 'stated-height',
            title: 'the reference skin\'s 165px stated, handoff present',
            notes:
                'The bug, aimed straight at the component. A screen states the reference skin\'s own '
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
            title: 'the reference skin\'s own zone width (172px)',
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
