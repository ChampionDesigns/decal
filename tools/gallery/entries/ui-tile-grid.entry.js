/**
 * ui-tile-grid.entry.js — the gallery entry for component #40 (wave 4, item #40).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js:
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. This wave runs its builders in
 * parallel under a whole-file-write rule, so N appends to one array clobber each
 * other. Each builder owns one file here and the wave's single cross-cutting writer
 * wires them into `entries.js` once, serially:
 *
 *     import { entry as uiTileGrid } from './entries/ui-tile-grid.entry.js';
 *     export const entries = [ ...existing, uiTileGrid ];
 *
 * `module` points at the .demo.js sidecar, not at the component: the states stage
 * real #8 cards as the tiles and the gallery hangs on an undefined custom element.
 * See there.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-tile-grid--<state>`): identifiers, not labels.
 * A rename is a re-baseline.
 *
 * WHAT THE STATES ARE FOR, and this component is the extreme case of the general
 * rule. `hostStyle` sizes the STAGE, not the window (spec §2.1 Rule 1), and for #40
 * the stage width IS the entire input: there is no attribute, no property and no
 * media query that changes what this component does. Five of the six states are
 * therefore one markup at five stage widths, and the battery's diff between them is
 * the component's whole behaviour. `leaf-1200` is Slate's own leaf reproduced from
 * the oracle at the width Slate gave it; the rest are widths Slate has never been
 * asked about and has no vote on (Part 10 §4: responsive behaviour disqualifies the
 * corpus, and 98.4 % of its geometry is frozen).
 */

/** Slate's own language list, in Slate's own order, from the oracle.
 *  CITE prov_query.py find --cls slate-lang-tile → "found 30 element(s) in 1
 *  state(s)", settings-units---language-select-language, text in DOM order
 *  "EnglishEnglish" "françaisFrench" "españolSpanish" "DeutschGerman"
 *  "Schweizer HochdeutschSwiss High German" "简体中文Simplified Chinese"
 *  "繁體中文Traditional Chinese" "한국어Korean" "portuguêsPortuguese"
 *  "العربيةArabic" "עבריתHebrew" "danskDanish" "svenskaSwedish" "norskNorwegian" …
 *  — the endonym leads and the English name follows underneath, which is Slate's own
 *  P37 note: "First-run language choice is often made by someone who cannot read the
 *  English chrome" (slate-shell.css:1844-1846). */
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

/* Two type roles, inline, because a gallery state is light DOM and the type-role
 * classes live behind adoptTypeRoles(). Every value is a token — Gate C scans tools/
 * (authored-css.js:71) and a literal here would fail the build, which is the point.
 *   ORACLE the endonym is --slate-text-lg / --slate-weight-medium / --slate-text and
 *   the English name --slate-text-note / --slate-muted (slate-shell.css:1881-1889),
 *   carried to --ui-text-lg / --ui-weight-medium / --ui-text and --ui-text-note /
 *   --ui-muted. */
const ENDONYM = 'display:block; font-size:var(--ui-text-lg); font-weight:var(--ui-weight-medium); color:var(--ui-text)';
const ENGLISH = 'display:block; font-size:var(--ui-text-note); color:var(--ui-muted)';

/** One tile. `role="radio"` + `aria-checked` on the CARD, never on the grid: the
 *  selected look belongs to the tile (DECISIONS.md:244, spec §3.9), and #40 declares
 *  no colour at all so it could not express one if it wanted to. */
const tile = ([endonym, english], checked = false) =>
    '<ui-card pad="tight" role="radio" aria-checked="' + (checked ? 'true' : 'false') + '" tabindex="0">'
    + '<span style="' + ENDONYM + '">' + endonym + '</span>'
    + '<span style="' + ENGLISH + '">' + english + '</span>'
    + '</ui-card>';

/** The grid, with `role="radiogroup"` written by the CONSUMER — exactly as Slate's
 *  screen does it (`settings.js:5657`), and exactly what this component preserves:
 *  an author-written role is captured once and never overwritten. */
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
        + 'overflow that Slate\'s own wrapper silently clips (settings.js:5641, spec '
        + '§2.4). It declares no colour, no role and no selected look — the tiles are '
        + 'the consumer\'s, and here they are #8 cards.',
    states: [
        {
            id: 'leaf-1200',
            title: 'The Settings leaf, at Slate\'s own width',
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
                + '292. Slate has no answer here — its geometry is frozen at 1920x1200 '
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
                'A bare minmax(280px, 1fr) cannot go below 280, so Slate\'s grid would '
                + 'be 280 wide inside a 240 box and the leaf wrapper — '
                + '"w-full max-w-full overflow-x-hidden", settings.js:5641 — would cut '
                + 'the difference with no affordance (spec §2.4: "At no point does '
                + 'anything tell the user content was removed"). min(280px, 100%) gives '
                + 'one full-width track instead. Reachable now: the design floor is '
                + '~1000 x 600 (DECISIONS.md:178) and Settings collapses to two columns '
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
                + 'tiles. Slate never met the case; a Settings leaf pane is a scroll '
                + 'region with a definite height (spec §4.4), so this one will.',
            hostStyle: { 'inline-size': '620px', 'block-size': '520px' },
            html: grid('style="block-size: 100%"', 4),
        },
    ],
};

export default entry;
