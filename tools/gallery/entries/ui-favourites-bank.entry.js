/**
 * The gallery entry for.
 */

const LIVE_ROW = JSON.stringify([
    { value: 'p1', name: 'Extractamundo Dos!' },
    { value: 'p2', name: 'Temp test' },
    { value: 'p3', name: 'Extract Blooming Espresso' },
    null,
    null,
]);

const FULL_ROW = JSON.stringify([
    { value: 'p1', name: 'Extractamundo Dos!' },
    { value: 'p2', name: 'Temp test' },
    { value: 'p3', name: 'Extract Blooming Espresso' },
    { value: 'p4', name: 'Londinium' },
    { value: 'p5', name: 'Blooming Filter 2.1' },
]);

const row = (attrs, favourites = LIVE_ROW) =>
    `<ui-favourites-bank ${attrs} favourites='${favourites}'></ui-favourites-bank>`;

export const entry = {
    id: 'ui-favourites-bank',
    title: 'Favourites bank',
    module: './entries/ui-favourites-bank.demo.js',
    notes:
        'Component #36, the Live header\'s profile-shortcut bank (SCOPE Part 4 Wave 4 '
        + 'row 36; spec §5.2 #36, slate-live.css:114-238). One <ui-bank> (#3) is the '
        + 'row - ground, hairline, radius, seam, roving tabindex, and THE selection '
        + 'treatment; one <ui-favourite-slot> (#35) per cell is the mark, carrying '
        + 'OCCUPANCY. Two bugs die structurally. L7: "three overlapping '
        + 'implementations of the favourite button\'s box; width: 20% !important is '
        + 'dead and the --slate-space-4 padding paints nothing" - here the cell\'s box '
        + 'has one owner, inside ui-bank\'s shadow root, and no document rule can add '
        + 'a second. L8: "the favourites bank ... bypasses all four --slate-selected-* '
        + 'dials" - this component declares no selected colour, weight, shadow or '
        + 'pseudo-element at all. The mark is `inert`, which is what makes a #35 '
        + 'inside a #3 cell one control rather than a button inside a button.',
    states: [
        {
            id: 'default',
            title: 'The Live header row, as the oracle measured it',
            notes:
                'Three occupied favourites and two empty slots, the first one current. '
                + 'CITE find --id fav-profile-btn-0..4 (live-ready): five cells at '
                + '264.094 / 180 / 234 / 180 / 180 in a 1040px box, and the last two '
                + 'record no text at all - quoted as what Slate does, never as the '
                + 'target, because that geometry IS bug L7. Here the cells are equal '
                + 'because ui-bank\'s items are flex: 1 1 0 and nothing else has an '
                + 'opinion. CITE live-ready #profile-fav-nav [i=2] background-color = '
                + 'rgb(26, 33, 39) - the same --ui-key ground the real bank uses, which '
                + 'is exactly why the copy went unnoticed: it agreed on everything but '
                + 'selection.',
            html: row('label="Favourite profiles" value="p1"'),
        },
        {
            id: 'beside-the-tabs',
            title: 'The defect that started the audit',
            notes:
                'Ben\'s original report was that the selection bank looked different on '
                + 'Live than on Settings. Slate answers with four coexisting selection '
                + 'implementations; the favourites bank is one of them, and re-skinning '
                + 'selection "changes the tabs and leaves the favourites alone" (L8). '
                + 'These two rows are the same component underneath - one ui-bank, one '
                + 'selectionSurface, one set of dials - so they cannot diverge. The '
                + 'rendering suite proves it by turning --ui-selected-face once and '
                + 'measuring both.',
            html:
                '<div style="display:grid; gap:var(--ui-space-5)">'
                + row('label="Favourite profiles" value="p2"')
                + '<ui-tab-bar label="Chart" value="power"'
                + ' tabs=\'["Pressure / Flow","Resistance / Impedance","Shot data"]\''
                + '></ui-tab-bar>'
                + '</div>',
        },
        {
            id: 'dials-radian',
            title: 'The same rules, two values moved',
            notes:
                'Slate ships --ui-selected-led at 0px and --ui-selected-glow at 0% '
                + '(styles/tokens.css:819-822); Radian moves those two. Neither this '
                + 'component\'s CSS nor ui-bank\'s changes - which is the whole claim of '
                + 'spec §3.9, "four values, zero rule changes", and it only holds '
                + 'because there is ONE selection treatment. Slate\'s own favourites '
                + 'strip could not do this: its selected cell is a color-mix face, a '
                + 'font-weight of 500 and an ::after LED strip, all !important, none of '
                + 'them a dial (slate-live.css:214-243).',
            html:
                '<div style="display:grid; gap:var(--ui-space-5)">'
                + row('label="Slate dials" value="p1"')
                + '<div style="--ui-selected-led:var(--ui-toggle-led); --ui-selected-glow:55%">'
                + row('label="Radian dials" value="p1"')
                + '</div></div>',
        },
        {
            id: 'full',
            title: 'Five occupied, and the names give way first',
            notes:
                'P25 in Slate: "the favourites strip rendered five cells regardless, so '
                + 'empty slots drew a full border and read as failed-to-load, and the '
                + 'active tab wrapped to two lines." Here a name never wraps: the mark '
                + 'is fixed at --ui-hit-min and the name track is flex: 0 1 auto with '
                + 'min-inline-size: 0, so it ellipsises continuously as the row '
                + 'narrows. No breakpoint, and nothing to get wrong at one.',
            html: row('label="Favourite profiles" value="p4"', FULL_ROW),
        },
        {
            id: 'floor',
            title: 'At the row\'s ergonomic floor',
            notes:
                'The stage is 420px, which is exactly 5 x (--ui-hit-min + 2 x '
                + '--ui-space-4) - the floor the component declares. The names have '
                + 'gone; the marks have not, because ergonomics is physical (spec §2.2: '
                + '"Control heights, touch targets, hairlines | Fixed token. Never '
                + 'fluid ... A control that shrinks with the window becomes unusable '
                + 'exactly when the window is small"). Below this the row overflows its '
                + 'parent where a screen can see it, rather than letting ui-bank\'s '
                + 'overflow: hidden eat the marks - content silently removed is what '
                + 'spec §2.4 bans.',
            hostStyle: { 'inline-size': '420px' },
            html: row('label="Favourite profiles" value="p3"'),
        },
        {
            id: 'disabled',
            title: 'Disabled, and the empty slots that always were',
            notes:
                'The whole row dims once through --ui-opacity-disabled (.38, one dial '
                + 'against Slate\'s three live values) and every press is refused. Note '
                + 'that the two empty slots are disabled even in the live row above: an '
                + 'empty favourite holds no profile, so the roving tab stop skips it '
                + 'and a press cannot load what is not there. Occupancy is DATA here - '
                + 'Slate spells it `:empty, :not(:has(*)):blank`, and `:blank` is '
                + 'implemented in no shipping engine, so one invalid selector '
                + 'invalidates the list and the valid half dies with it (bug L6).',
            html: row('label="Favourite profiles" value="p1" disabled'),
        },
    ],
};

export default entry;
