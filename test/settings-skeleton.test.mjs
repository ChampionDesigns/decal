// THE SETTINGS SKELETON, AT SOURCE LEVEL — wave 5.4, rows `settings-shell-skeleton`,
// `nav-columns-shared-pitch`, `c4-derived-nav-row-pitch`, `c5-single-gap-divider`,
// `leaf-pane-one-measure`, `scroll-regions-floors`.
//
// WHAT BELONGS HERE AND WHAT BELONGS IN THE RENDER SUITE. Anything about a rendered box
// is measured in `test/render/settings-skeleton.render.test.mjs` off the engine — pitch,
// the collapse, the floors, the measure. What is here instead is the class of claim a
// measurement CANNOT make: that a number exists in exactly one place, that a floor is a
// token rather than a literal that happens to equal one today, and that a defect has no
// spelling in this tree. A screen can measure right and still carry the mechanism that
// made the old one wrong.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../scripts/lib/source-scan.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** The four files this cluster owns. */
const SCREEN_FILES = [
    'src/screens/settings-screen.js',
    'src/screens/settings-master-detail.js',
    'src/screens/settings-nav-column.js',
    'src/screens/settings-leaf-pane.js',
];

const SOURCE = Object.fromEntries(SCREEN_FILES.map((f) => [f, read(f)]));

/**
 * `stripComments` is JavaScript-aware, so it leaves the CSS comments inside a `css`
 * tagged template alone — they are template CONTENT, not JS comments. Every assertion
 * below is about what the file DOES, and a comment that quotes a defect ("measured
 * pitch 89 vs 93", "rgb(14, 19, 23)") must not read as committing it. So both passes
 * run, in that order.
 */
const stripCssComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ');
const CODE = Object.fromEntries(
    SCREEN_FILES.map((f) => [f, stripCssComments(stripComments(SOURCE[f]))]),
);
const TOKENS = read('styles/tokens.css');

const declaration = (name) => {
    const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(TOKENS);
    assert.ok(m, `${name} is not declared in styles/tokens.css`);
    return m[1].trim();
};

/* ===========================================================================
 * 1. THE FLOORS ARE TOKENS WITH M18 NOTES  (Part 10 §9's review check)
 * =========================================================================== */

describe('M18: every floor marked "proposal — confirm" is a token, not a frozen number', () => {
    test('--ui-settings-nav-min-h is three nav rows, as arithmetic', () => {
        const value = declaration('--ui-settings-nav-min-h');
        assert.match(value, /^calc\(/, 'the floor is a derivation, not a literal');
        assert.doesNotMatch(value, /\d+(px|rem|em|%)/,
            `the floor carries a length literal (${value}) — Part 5 §4 gives it as 3 x var(--ui-nav-row)`);
        assert.ok(value.includes('--ui-nav-row'), 'and the row it is three of is the derived token (C4)');
    });

    test('--ui-settings-leaf-min-h is one settings row plus one heading line', () => {
        const value = declaration('--ui-settings-leaf-min-h');
        assert.match(value, /^calc\(/);
        assert.doesNotMatch(value, /\d+(px|rem|em)/,
            `the floor carries a length literal (${value})`);
        for (const token of ['--ui-control-h', '--ui-text-lg']) {
            assert.ok(value.includes(token), `${token} is part of the stated derivation`);
        }
    });

    test('both settings floors are tokens, not frozen numbers', () => {
        assert.match(TOKENS, /--ui-settings-nav-min-h:/);
        assert.match(TOKENS, /--ui-settings-leaf-min-h:/);
    });

    test('one floor token serves BOTH nav columns, and only the column declares it', () => {
        // T2 read one box out: two instances of one component cannot be given two
        // floors any more than two pitches.
        assert.match(CODE['src/screens/settings-nav-column.js'],
            /min-block-size: var\(--ui-settings-nav-min-h\)/);
        for (const file of SCREEN_FILES.filter((f) => !f.endsWith('nav-column.js'))) {
            assert.doesNotMatch(CODE[file], /--ui-settings-nav-min-h/,
                `${file} is a second owner of the nav floor`);
        }
        assert.match(CODE['src/screens/settings-leaf-pane.js'],
            /min-block-size: var\(--ui-settings-leaf-min-h\)/);
    });
});

/* ===========================================================================
 * 2. C4 — THE PITCH IS CONSUMED, NEVER RE-PINNED
 * =========================================================================== */

describe('C4: --ui-nav-row is derived, and this screen only consumes it', () => {
    test('the token in the sheet is a derivation over --ui-control-h', () => {
        const value = declaration('--ui-nav-row');
        assert.match(value, /^calc\(/, 'C4: "stop pinning it"');
        assert.ok(value.includes('--ui-control-h'), 'derived from the control height');
        assert.doesNotMatch(value, /\b89px\b/, 'T18: the 89 justified itself with arithmetic wrong on both halves');
    });

    test('no file in this cluster redefines it or writes a pitch of its own', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /--ui-nav-row\s*:/,
                `${file} re-declares the pitch — CONVENTIONS §11 keeps the arithmetic in tokens.css once`);
            assert.doesNotMatch(CODE[file], /\b(89|93)px\b/, `${file} writes T2's measured pitch`);
        }
    });

    test('the columns hold rows and no row height', () => {
        // The pitch belongs to #24 and #25. A column that declared a row height would
        // be the second owner §2.3 forbids, and the two columns would be free to drift.
        const column = CODE['src/screens/settings-nav-column.js'];
        assert.doesNotMatch(column, /block-size:\s*var\(--ui-nav-row\)/,
            'the column does not size the rows; the rows do');
    });
});

/* ===========================================================================
 * 3. C5 / T19 / T4 — THE DIVIDER IS A GAP, SO THERE IS NO SEPARATOR TO GET WRONG
 * =========================================================================== */

describe('C5: one gap, one ink, no separator element', () => {
    test('the body composes the seam utility and writes no divider of its own', () => {
        const body = CODE['src/screens/settings-master-detail.js'];
        assert.match(body, /seam-grid/, 'display, gap and ground come from the utility');
        assert.doesNotMatch(body, /border(-\w+)?:\s*(?!0)/, 'a divider here would be a second spelling');
        assert.doesNotMatch(body, /box-shadow/, 'and so would this');
    });

    test('T4: no drag handle, no resize cursor, no aria-hidden affordance', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /col-resize|ew-resize/, `${file} draws a drag cursor`);
            assert.doesNotMatch(CODE[file], /aria-hidden/, `${file} hides an interactive node from AT`);
            assert.doesNotMatch(CODE[file], /separator/i, `${file} names a separator element`);
        }
    });

    test('the seam is never given a width of its own', () => {
        // T19 is two hairlines of two greys. One gap has one width and it is the token's.
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /gap:\s*\d/, `${file} writes a gap in pixels`);
        }
    });
});

/* ===========================================================================
 * 4. T16 — THE SCROLLBAR IS VISIBLE BECAUSE NOTHING HIDES IT
 * =========================================================================== */

describe('T16: no scrollable region in this cluster hides its scrollbar', () => {
    test('no scrollbar-width, no scrollbar-color, no ::-webkit-scrollbar', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /scrollbar-width/, `${file}: slate-shell.css:456's defect`);
            assert.doesNotMatch(CODE[file], /scrollbar-color/, file);
            assert.doesNotMatch(CODE[file], /::-webkit-scrollbar/, file);
        }
    });

    test('and nothing clips instead of scrolling', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /overflow(-[xy])?:\s*hidden/,
                `${file} clips silently — "the old app's default answer everywhere but the numpad was hidden"`);
        }
    });
});

/* ===========================================================================
 * 5. EVERY LENGTH IS A TOKEN, EXCEPT THE FOUR §4.4 WRITES AS NUMBERS
 * =========================================================================== */

describe('the numbers, and there are only four of them', () => {
    // §4.4's own track list, the 1100px container threshold, and the collapsed branch's
    // 30% share. A container condition takes no var(), so 1100 HAS to be a literal.
    //
    // THE TWO WIDE-BRANCH MINIMUMS BECAME ONE MEASURED WIDTH (Ben, 26 August 2026: "Can we
    // make the two menu columns the same width and reduce the overall width the two take
    // up … Make it around 580? Or does one leaf column have a wide text?").
    //
    // ONE DID, AND THEN IT WAS RENAMED. Measured at both Gate A geometries with a Range
    // over each name at the rendered type, the widest leaf was "Sleep & Wake Schedules" at
    // 255 — 41px past anything else in the tree, so one name was deciding how much of the
    // screen the navigation took. Ben: "'Sleep & Wake Schedules' what can we call this to
    // reduce the text length?" It is "Sleep & Wake" now (141), and the shorter title is
    // also the truer one — only half that page is schedules.
    //
    // So the floors are the widest category, "Units & Language" at 181, and the widest
    // leaf, "Default load settings" at 214, each plus the row's own 24px of padding on
    // both sides: 229 and 262. 262 is the smallest EQUAL column where nothing ellipsises,
    // and two of them is 524 — under the 580 Ben asked for, and 206px back from the 730
    // the percentage pair took at 1920.
    //
    // IT IS A LENGTH AND NOT A TOKEN because it is not on any scale: it is the width of one
    // string at one type size, measured. `--_ui-settings-nav-col` gives it one home, and
    // this list is what stops a second one appearing.
    //
    // In source order: the column width, the threshold, and the collapsed branch's pane
    // minimum. Three, and every one of them is stated where it is used.
    const ALLOWED = new Map([
        ['src/screens/settings-master-detail.js', ['262px', '1100px', '220px']],
    ]);

    test('no file writes a raw length the spec did not', () => {
        for (const file of SCREEN_FILES) {
            const lengths = [...CODE[file].matchAll(/(?<![-\w])(\d+(?:\.\d+)?)(px|rem|em)\b/g)]
                .map((m) => m[0]);
            assert.deepEqual(lengths, ALLOWED.get(file) ?? [],
                `${file} writes a raw length: ${lengths.join(', ')}`);
        }
    });

    test('the collapse threshold is written once and exported', () => {
        const body = CODE['src/screens/settings-master-detail.js'];
        assert.equal((body.match(/1100/g) ?? []).length, 2,
            'the exported constant and the query condition it is exported to be checked against');
        assert.match(body, /export const MASTER_DETAIL_COLLAPSE_PX = 1100;/);
        // And nobody else spells it.
        for (const file of SCREEN_FILES.filter((f) => !f.endsWith('master-detail.js'))) {
            assert.doesNotMatch(CODE[file], /1100/, `${file} is a second owner of the threshold`);
        }
    });

    test('no colour, no font-face, no important anywhere in the cluster', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, `${file} writes a colour`);
            assert.doesNotMatch(CODE[file], /@font-face/, file);
            assert.doesNotMatch(CODE[file], /!important/, file);
        }
    });
});

/* ===========================================================================
 * 6. THE LAYER BOUNDARY — a skeleton reaches no data layer
 * =========================================================================== */

describe('what the skeleton does not import', () => {
    test('no store, no endpoint, no limit, no capability, no storage key', () => {
        /* A NAME IS NOT A DATA LAYER, and the guard could not tell the two apart.
         *
         * The boundary this protects is that a skeleton does not READ data: it takes what
         * it draws through `boot`, and it never opens a store, calls a route or resolves a
         * limit itself. `import { FEED } from 'src/stores/live-stores.js'` does none of
         * that — `FEED` is a frozen table of channel NAMES, and the screen uses one of them
         * to ask `boot.live.feed(...)` for the feed it was given. The store never enters
         * the file. Blocking it forced the alternative of writing the string 'machineSnapshot'
         * inline, which is the same import with the single owner removed.
         *
         * SO A STORE IMPORT IS ALLOWED ONLY FOR SCREAMING_CASE BINDINGS, which is the
         * convention every frozen name table in this tree already follows and which no
         * factory can satisfy — `createLiveStores` fails, `FEED` passes. Everything else on
         * the list is unchanged and still absolute. */
        /* WHAT THE BOUNDARY ACTUALLY IS, restated 26 August 2026 after it blocked two
         * legitimate reads and had to be looked at properly.
         *
         * A skeleton takes everything it draws through `boot` — the one injected surface —
         * and OWNS no data itself: it opens no store, calls no route, resolves no limit and
         * reads no storage key. `boot.capabilities.machineClass()` and `boot.live.feed(...)`
         * are that surface being asked a question, which is the pattern, not a breach of it.
         * Importing `capabilities-store.js` would be the breach.
         *
         * So the list is IMPORT-SHAPED now. That is a narrower claim than the old
         * substring sweep and a truer one: the old version would have passed a file that
         * imported the capability store under an alias, and failed one whose only sin was
         * the word `capabilities` on a property read.
         *
         * ONE EXEMPTION, and it is bounded by naming: a store module may be imported for
         * SCREAMING_CASE bindings only. `FEED` is a frozen table of channel names and the
         * screen uses one to ask `boot` for a feed; no factory can satisfy the pattern
         * (`createLiveStores` fails, `FEED` passes), so the store itself still cannot enter.
         *
         * `callRoute` STAYS ABSOLUTE. It is the one name that is a data read wherever it
         * appears, property or import. */
        const CONSTANT_FROM_STORES = /import\s*\{([^}]*)\}\s*from\s*'src\/stores\/[^']*';/g;
        const forbidden = [
            /from 'src\/data\//,
            /from 'src\/stores\//,
            /callRoute/,
            /from '[^']*machine-limits/,
            /from '[^']*capabilit/i,
            /from '[^']*storage-rout/,
        ];
        for (const file of SCREEN_FILES) {
            const body = CODE[file].replace(CONSTANT_FROM_STORES, (whole, names) => {
                const bindings = names.split(',').map((n) => n.trim()).filter(Boolean);
                const allConstants = bindings.length > 0
                    && bindings.every((n) => /^[A-Z][A-Z0-9_]*$/.test(n));
                return allConstants ? '' : whole;
            });
            for (const pattern of forbidden) {
                assert.doesNotMatch(body, pattern, `${file} reaches past the layout layer (${pattern})`);
            }
        }
    });

    test('no @media (width) — the collapse is a container query on its own box', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /@media[^{]*width/,
                `${file} asks the viewport; spec §2.1 Rule 1 says it asks its own container`);
        }
        assert.match(CODE['src/screens/settings-master-detail.js'],
            /@container \(inline-size < 1100px\)/);
    });

    test('D11: the screen supplies a count and never a word', () => {
        const screen = CODE['src/screens/settings-screen.js'];
        /* THE COUNT GAINED A SECOND TERM ON 26 AUGUST 2026 and is still a count. The
         * Lighting leaf carries no registry rows, so `changeCount` was always zero there and
         * the header's primary Save took its not-dirty branch — it CLOSED the page while
         * every colour the person had picked sat in the strip's volatile state, pushed live
         * by a PUT that does not persist. An uncommitted preview is a pending change and is
         * counted like any other; `#ledPending` is one or nothing, because a strip either
         * matches NVM or it does not. What has not changed is the boundary: a NUMBER crosses
         * it, and the wording is still #31's alone. */
        assert.match(screen, /change-count=\$\{this\.changeCount \+ \(this\.#ledPending \? 1 : 0\)\}/,
            '"A count, and nothing else, crosses the boundary"');
        assert.doesNotMatch(screen, /'Save|"Save|Save \(/,
            'the Save wording belongs to #31 and to no screen');
        assert.doesNotMatch(screen, /primaryLabel|commitView/,
            'both were deleted by D11');
    });

    // There is deliberately no F3/Q1 test in this block, and the one that stood here has
    // been removed. Part 10 §12's MUST NOT for this workflow reads "no code, no branch, no
    // plan doc, no placeholder control, no disabled button, no TODO that implies a shape,
    // no test naming one" — and a test asserting the absence of a particular spelling
    // still names it and still implies a shape, in its title and three times over in its
    // regex. The routing cluster wrote the same test, removed it, and recorded why at
    // test/settings-contract.test.mjs:226-231; this is that reading, applied here. The
    // guard also protected nothing: there is no such code in these four files for it to
    // catch. The hole is recorded in deferred_questions, which is the single sanctioned
    // deliverable, and nowhere else.
});
