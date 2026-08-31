/**
 * The gallery entry for.
 */

const LANGUAGES = [
    ['English', 'English'],
    ['français', 'French'],
    ['español', 'Spanish'],
    ['Deutsch', 'German'],
    ['Schweizer Hochdeutsch', 'Swiss High German'],
    ['简体中文', 'Simplified Chinese'],
    ['繁體中文', 'Traditional Chinese'],
    ['한국어', 'Korean'],
    ['português', 'Portuguese'],
    ['العربية', 'Arabic'],
    ['עברית', 'Hebrew'],
    ['dansk', 'Danish'],
];

const ENDONYM = 'display:block; font-size:var(--ui-text-lg); font-weight:var(--ui-weight-medium); color:var(--ui-text)';
const ENGLISH = 'display:block; font-size:var(--ui-text-note); color:var(--ui-muted)';

const tile = ([endonym, english], checked = false) =>
    '<ui-card pad="tight" role="radio" aria-checked="' + (checked ? 'true' : 'false') + '" tabindex="0">'
    + '<span style="' + ENDONYM + '">' + endonym + '</span>'
    + '<span style="' + ENGLISH + '">' + english + '</span>'
    + '</ui-card>';

const grid = (attrs, count = LANGUAGES.length) =>
    '<ui-tile-grid role="radiogroup" aria-label="Display language"' + (attrs ? ' ' + attrs : '') + '>'
    + LANGUAGES.slice(0, count).map((lang, i) => tile(lang, i === 0)).join('')
    + '</ui-tile-grid>';

export const entry = {
    id: 'ui-tile-grid',
    title: 'Auto-fill tile grid',
    module: './entries/ui-tile-grid.demo.js',
    notes:
        'Component #40 (spec §5.2 #40, Appendix 14): repeat(auto-fill, minmax(280px, '
        + '1fr)) — "the only genuinely fluid layout in the whole app. Copy the '
        + 'pattern." One rule, owned once, so the next grid of same-sized things uses '
        + 'it instead of retyping 280. The oracle pins the numbers through the grid\'s '
        + 'children: 30 language tiles at 291x84, column pitch 303 and row pitch 96, '
        + 'inside a 1200px leaf — 12px gutters (--ui-space-3) and 4 tracks of exactly '
        + 'the 291 the authored rule predicts. Two knobs, both private and both set '
        + 'from the light tree: --_ui-tile-grid-min (280px) and --_ui-tile-grid-gap '
        + '(--ui-space-3). One departure: the minimum is min(280px, 100%), so a '
        + 'container narrower than a tile gets one full-width track instead of an '
        + 'overflow that the reference skin\'s own wrapper silently clips (settings.js:5641, spec '
        + '§2.4). It declares no colour, no role and no selected look — the tiles are '
        + 'the consumer\'s, and here they are #8 cards.',
    states: [
        {
            id: 'leaf-1200',
            title: 'The Settings leaf, at the reference skin\'s own width',
            notes:
                'ORACLE settings-units---language-select-language: 30 tiles, all '
                + '291x84, first row x = 629 / 932 / 1235 / 1538 → 4 columns at a 303 '
                + 'pitch inside a 1200px leaf. floor((1200 + 12) / (280 + 12)) = 4 and '
                + '(1200 - 3 x 12) / 4 = 291: the rule and the rendered pixels agree.',
            hostStyle: { 'inline-size': '1200px' },
            html: grid(''),
        },
        {
            id: 'reflow-900',
            title: 'Three columns at 900',
            notes:
                'Nothing was told to do this. floor((900 + 12) / 292) = 3 tracks of '
                + '292. The reference skin has no answer here — its geometry is frozen at 1920x1200 '
                + '— so the spec governs (Part 10 §4).',
            hostStyle: { 'inline-size': '900px' },
            html: grid(''),
        },
        {
            id: 'reflow-600',
            title: 'Two columns at 600',
            notes: 'floor((600 + 12) / 292) = 2 tracks of 294.',
            hostStyle: { 'inline-size': '600px' },
            html: grid(''),
        },
        {
            id: 'collapsed-240',
            title: 'Narrower than one tile — the departure',
            notes:
                'A bare minmax(280px, 1fr) cannot go below 280, so the reference skin\'s grid would '
                + 'be 280 wide inside a 240 box and the leaf wrapper — '
                + '"w-full max-w-full overflow-x-hidden", settings.js:5641 — would cut '
                + 'the difference with no affordance (spec §2.4: "At no point does '
                + 'anything tell the user content was removed"). min(280px, 100%) gives '
                + 'one full-width track instead. Reachable now: the design floor is '
                + '~1000 x 600 and Settings collapses to two columns '
                + 'below 1100px (spec §4.4).',
            hostStyle: { 'inline-size': '240px' },
            html: grid('', 4),
        },
        {
            id: 'wider-minimum',
            title: 'The minimum, turned up to 420px',
            notes:
                '--_ui-tile-grid-min is read, not baked in. Set on the host from the '
                + 'light tree, where the outer tree wins over a :host default (CSS '
                + 'Scoping §3.3). Same 900px stage as reflow-900, two columns instead '
                + 'of three.',
            hostStyle: { 'inline-size': '900px' },
            html: grid('style="--_ui-tile-grid-min: 420px"'),
        },
        {
            id: 'tall-pane',
            title: 'Four tiles in a tall pane',
            notes:
                'align-content: start. A grid\'s initial align-content behaves as '
                + 'stretch, which pours surplus block space into the auto-sized row '
                + 'tracks — one row of tiles in a 520px pane becomes one row of 520px '
                + 'tiles. The reference skin never met the case; a Settings leaf pane is a scroll '
                + 'region with a definite height (spec §4.4), so this one will.',
            hostStyle: { 'inline-size': '620px', 'block-size': '520px' },
            html: grid('style="block-size: 100%"', 4),
        },
    ],
};

export default entry;
