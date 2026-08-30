/**
 * live-screen.test.mjs - the Live skeleton's contract, without a browser.
 *
 * What belongs here rather than in the rendering suite: the rules that are about what
 * the FILES may contain. A rendered box cannot tell you that the screen reads no
 * store, that no chart number was copied out of the token sheet, or that the foot
 * band's floor is still a derivation rather than a number somebody guessed - and
 * those are exactly the rules wave 5.1 is judged on (Part 10 §12, wf-w5p1-live).
 *
 * The geometry, the surrender order and the bugs are in
 * `test/render/live-screen.render.test.mjs`, which runs in a real engine at three
 * sizes including C1's 1920 x 1080.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

/** Block comments carry quoted defect text - "position: absolute inside #main-row" -
 *  so every source rule below reads the code with the comments taken out. */
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SCREEN_FILES = Object.freeze([
    'src/screens/live-screen.js',
    'src/screens/live-header.js',
    'src/screens/live-rail.js',
    'src/screens/live-main.js',
    'src/screens/live-foot.js',
]);

const SOURCE = Object.fromEntries(SCREEN_FILES.map((f) => [f, read(f)]));
const CODE = Object.fromEntries(SCREEN_FILES.map((f) => [f, stripComments(SOURCE[f])]));
const TOKENS = read('styles/tokens.css');

/* ===========================================================================
 * 1. The five files, and one tag each
 * =========================================================================== */

describe('the skeleton is five modules and five tags', () => {
    test('src/screens/ holds the skeleton, and every file there defines at most its own tag', () => {
        const onDisk = readdirSync(join(REPO, 'src', 'screens')).filter((f) => f.endsWith('.js')).sort();
        for (const file of SCREEN_FILES) {
            assert.ok(onDisk.includes(file.split('/').pop()), `${file} is missing from src/screens/`);
        }

        for (const file of SCREEN_FILES) {
            const tag = file.split('/').pop().replace(/\.js$/, '');
            const defines = [...CODE[file].matchAll(/customElements\.define\('([^']+)'/g)].map((m) => m[1]);
            assert.deepEqual(defines, [tag], `${file} must define exactly ${tag}`);
        }

        /* THE LIST WAS AN EQUALITY AND IS NOW A SUBSET, on purpose. It was written when
         * `src/screens/` held only the skeleton, and wave 5.1's later rows fill the slots
         * the skeleton left — with elements (`live-connection`, `live-refusal`) and with
         * plain modules (`live-gates`, `live-dimming`, `live-wiring`) that define no tag at
         * all. An equality would make every one of those rows edit this line, which is how
         * a shared assertion becomes a merge conflict instead of a check.
         *
         * The rule that GENERALISES, and is what the equality was really protecting: a
         * screen module defines at most one custom element, and if it defines one it is
         * named after the file. The five skeleton tags are still pinned, above. */
        for (const name of onDisk) {
            const source = stripComments(read(join('src', 'screens', name)));
            const defines = [...source.matchAll(/customElements\.define\('([^']+)'/g)].map((m) => m[1]);
            assert.ok(defines.length <= 1, `${name} defines more than one tag: ${defines.join(', ')}`);
            if (defines.length === 1) {
                assert.deepEqual(defines, [name.replace(/\.js$/, '')], `${name} must define its own tag`);
            }
        }
    });

    test('the route table still names live-screen, and the screen still defines it', () => {
        assert.match(read('src/lib/app-routes.js'), /tag: 'live-screen'/);
        assert.match(CODE['src/screens/live-screen.js'], /customElements\.define\('live-screen'/);
    });
});

/* ===========================================================================
 * 2. THE SCREEN LAWS (Part 10 §12, the wf-w5p1-live row)
 * =========================================================================== */

describe('screen laws', () => {
    test('no endpoint is spelled anywhere in the skeleton', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /['"`][^'"`]*\/(api|ws)\/v1/,
                `${file} spells a path - the screen talks to stores and the generated client, never an endpoint`);
        }
    });

    test('no store, no transport and no R adapter is imported by the skeleton', () => {
        const forbidden = [/from '[^']*\/stores\//, /from '[^']*adapters-r/, /from '[^']*rea-(address|routes|devices|transport)/];
        for (const file of SCREEN_FILES) {
            for (const pattern of forbidden) {
                assert.doesNotMatch(CODE[file], pattern, `${file} reaches past the layout layer (${pattern})`);
            }
        }
    });

    test('no machine name is read, and the GHC gate is a slot rather than a sniff', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /\b(bengle|de1|decent)\b/i, `${file} reads a machine name`);
            assert.doesNotMatch(CODE[file], /machineInfo|capabilit/i, `${file} reads a capability directly`);
        }
        // The strip is a property the gate sets, and its own row (live-capability-gates-ghc)
        // owns r3GroupHeadControllerCapability. The skeleton owns only the slot.
        assert.match(CODE['src/screens/live-screen.js'], /ghc: \{ type: Boolean, reflect: true \}/);
        assert.match(CODE['src/screens/live-main.js'], /<slot name="ghc">/);
    });

    test('no steam bound, no chart number and no foot-band number is written here', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /\b(130|135|165|160|170)\b/, `${file} writes a steam bound`);
            assert.doesNotMatch(CODE[file], /\b160px\b/, `${file} copies the chart floor out of the token sheet`);
        }
        // Every length in the skeleton's own CSS is a token or 0. `1fr`, `40%` and the
        // grid line numbers are not lengths; a bare `12px` would be.
        for (const file of SCREEN_FILES) {
            const lengths = [...CODE[file].matchAll(/(?<![-\w(])(\d+(?:\.\d+)?)(px|rem|em)\b/g)];
            assert.deepEqual(lengths.map((m) => m[0]), [],
                `${file} writes a raw length: ${lengths.map((m) => m[0]).join(', ')}`);
        }
    });
});

/* ===========================================================================
 * 3. M3 - THE FOOT BAND'S FLOOR IS A TOKEN TO FILL
 * =========================================================================== */

describe('M3: the foot band floor is a token, and not a frozen guess', () => {
    const declaration = (name) => {
        const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(TOKENS);
        assert.ok(m, `${name} is not declared in styles/tokens.css`);
        return m[1].trim();
    };

    test('--ui-live-foot-min-h exists, and its value contains no number of its own', () => {
        const value = declaration('--ui-live-foot-min-h');
        assert.match(value, /^calc\(/, 'the floor is a derivation, not a literal');
        assert.doesNotMatch(value, /\d+(px|rem|em|%)/,
            `the floor still carries a length literal (${value}) - M3 is "a token to fill, never a frozen guess"`);
        for (const token of ['--ui-section-head-h', '--ui-list-row', '--ui-space-3']) {
            assert.ok(value.includes(token), `${token} is part of the stated derivation`);
        }
    });


    /* THE FLOOR GAINED A SECOND TERM ON 21 AUGUST 2026 (DQ-541, Ben's own direction:
     * "the foot band should scale, not have fixed pixel height but reduce so it looks
     * similar regardless of resolution"). The band's min-block-size is now
     * max(--ui-live-foot-min-h, --ui-live-foot-share), so the assertion below asserts
     * BOTH terms rather than being relaxed to a substring: M3's derived floor is still
     * consumed, by name, in the file that owns it, and the share rides beside it.
     * The screen's row function is untouched — the cap is still the grid's. */
    test('the band consumes the floor AND the share, and the screen consumes the cap', () => {
        assert.match(
            CODE['src/screens/live-foot.js'],
            /min-block-size: max\(var\(--ui-live-foot-min-h\), var\(--ui-live-foot-share\)\)/,
            'the band takes the larger of M3\'s floor and its proportional share',
        );
        assert.match(CODE['src/screens/live-screen.js'], /fit-content\(var\(--ui-live-foot-max-share\)\)/);
        // and nowhere else, so there is one owner of each.
        const others = SCREEN_FILES.filter((f) => f !== 'src/screens/live-foot.js');
        for (const file of others) {
            assert.doesNotMatch(CODE[file], /--ui-live-foot-min-h/, `${file} is a second owner of the floor`);
            assert.doesNotMatch(CODE[file], /--ui-live-foot-share/, `${file} is a second owner of the share`);
        }
    });

    /* DQ-541's OWN TOKEN, held to the same standard as M3's floor: it is a share of the
     * screen and not a pixel height, and the token sheet has to say what it is a share OF
     * and why the number is what it is. The rendered behaviour — 216 / 194.4 / 190.3 at
     * 1200 / 1080 / 800 — is the render suite's, in a real engine. */
    test('--ui-live-foot-share is a share of the screen, with its arithmetic beside it', () => {
        const value = declaration('--ui-live-foot-share');
        /* A SHARE OF THE APP, NOT OF THE VIEWPORT — the assertion moved off `dvh` when
         * the fit landed (src/lib/app-fit.js). The app is drawn at a 1200-unit reference
         * height and scaled, so the viewport and the app container stopped being the
         * same number: on Ben's tablet `18dvh` is 144 units where the design says 216,
         * and the band would have silently lost a phase row on the one screen that
         * matters. The INTENT is unchanged and is what this still holds — a share of the
         * screen, never a frozen pixel height. */
        assert.match(value, /^calc\(0?\.\d+\s*\*\s*var\(--ui-app-h/,
            `the share must be a share of the app's own height and not a pixel height (${value})`);
        assert.doesNotMatch(value, /\d+(px|rem|em)\b/,
            `the share carries a length literal (${value}) — it is a share, not a guess`);
        assert.doesNotMatch(value, /\d+(dvh|vh|svh|lvh)\b(?!\))/,
            `the share reads the viewport (${value}), which the fit divorced from design units`);
        assert.match(TOKENS, /--ui-live-foot-min-h:/,
            'the share has a floor beside it, so a short screen still shows a band');
    });
});

/* ===========================================================================
 * 4. THE BUGS THAT ARE SOURCE-LEVEL (L5, and the header's three absolutes)
 * =========================================================================== */

describe('bugs that die in the source', () => {
    test('L5: no correction margins, and no fractional gap anywhere in the rail', () => {
        const rail = CODE['src/screens/live-rail.js'];
        /* THE TOKEN MOVED AND THE CLAIM DID NOT (parity 7-live-polish, it15). L5 is
         * "one uniform gap, from the spacing scale, in whole pixels, with no correction
         * margins" — not "the third step of the scale". The rail spends --ui-space-6
         * now, the same 28px it already spends on its inset, because --ui-space-3 made
         * Decal's row pitch 76px against the oracle's 91 (ORACLE live-ready
         * .slate-stepper [i=24] y=234 and [i=31] y=325). The three assertions under
         * this one are what actually hold L5 dead, and they are untouched. */
        assert.match(rail, /gap: var\(--ui-space-6\)/, 'one uniform gap, from the spacing scale');
        assert.match(rail, /::slotted\(\*\) \{[^}]*margin: 0/s, 'slotted rows have their margins zeroed');
        assert.doesNotMatch(rail, /margin-(top|bottom|block)/, 'a correction margin is exactly what L5 is');
        assert.doesNotMatch(rail, /\d+\.\d+/, 'a fractional length in a rail is how the L5 chain started');
    });

    test('nothing in the skeleton is absolutely positioned (L1, and the header clusters)', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /position:\s*(absolute|fixed)/,
                `${file} positions something - §4.1: "One grid. No absolutely-positioned structure."`);
        }
    });

    test('the header is a three-part flex row with the middle cluster at 1fr, min-inline-size 0', () => {
        const header = CODE['src/screens/live-header.js'];
        assert.match(header, /:host \{[^}]*display: flex/s);
        assert.match(header, /\.favourites \{[^}]*flex: 1 1 auto;[^}]*min-inline-size: 0/s);
        assert.match(header, /\.lead,\s*\.actions \{[^}]*flex: 0 0 auto/s);
        for (const slot of ['lead', 'favourites', 'actions']) {
            assert.ok(header.includes(`<slot name="${slot}">`), `the ${slot} cluster has a slot`);
        }
    });
});

/* ===========================================================================
 * 5. D2 - EVERY READABLE STRING IS A VALUE
 * =========================================================================== */

describe('D2: translation is a value from the first commit', () => {
    test('the screen renders no literal text node at all', () => {
        const code = CODE['src/screens/live-screen.js'];
        assert.match(code, /new I18nController\(this\)/);

        // Text between tags that is not an interpolation. `${t('Library')}` passes;
        // `>Library<` would not. The lookbehind is for `=>`, which is an arrow
        // function and not a closing tag.
        const literals = [...code.matchAll(/(?<![=!])>\s*([A-Za-z][^<>{}]*?)\s*</g)]
            .map((m) => m[1].trim())
            .filter((s) => s.length > 0);
        assert.deepEqual(literals, [],
            `literal text in a template: ${literals.join(' | ')} - D2 makes every readable string a value`);
    });

    test('every label the bands render is translated, not pasted', () => {
        const code = CODE['src/screens/live-screen.js'];
        // The rail's placeholder rows became real controls in `live-components-inventory`,
        // so the row label now arrives on a row descriptor (`t(row.label)`) rather than as
        // the row itself (`t(row)`). The rule this test is about did not change: a readable
        // string is a value read through t(), wherever it comes from.
        assert.match(code, /t\(row\.label\)/, 'the rail rows go through t()');
        assert.match(code, /t\(gauge\.label\)/, 'the gauge labels go through t()');
        assert.match(code, /aria-label=\$\{t\(/, 'so do the region names');
    });
});

/* ===========================================================================
 * The favourite slot menu destroys nothing on its way to the selector
 * =========================================================================== */

describe('the favourite hold-menu writes only when the gesture says "empty this"', () => {
    /* WHAT THIS IS PINNING, and the measurement behind it. Ben's rail on 28 August 2026
     * came back `{0:…, 1:…, 2:…, 3:null, 4:…}` and slot 3 had held "Rao Allongé" that
     * morning. His words: nothing anyone did intentionally cleared it.
     *
     * `#onFavouriteAction`'s `replace` branch used to call
     * `library.setFavourite(detail.slot, null)` before dispatching `library-open`, on the
     * theory that the selector's "Add to favourites" takes the FIRST EMPTY slot and this
     * makes the pressed one empty. Two things were wrong with that. The clear is
     * destructive, immediate and persisted while the assignment it prepares for is a
     * separate decision on another screen that may never be made — press Replace, change
     * your mind, press Back, and the slot is gone with nothing having said so. And the
     * consumer it cleared for does not exist: there is no "Add to favourites" in this
     * skin, `firstEmptySlot()` has no reader outside its own test, and the selector's only
     * assignment gesture names its own slot and overwrites it.
     *
     * THE RULE, STATED SO IT SURVIVES A REWRITE OF THE HANDLER: exactly one branch of this
     * menu writes to the rail, and it is `clear`. A source scan is the right shape of test
     * for it because the defect is a call that should not be there at all — a behavioural
     * test can only ever prove that the paths someone thought to drive do not clear, while
     * this proves no path does.
     *
     * Comments are stripped first, so the long note in the source that QUOTES the deleted
     * call cannot satisfy or defeat this. */
    const WIRING = stripComments(read('src/screens/live-wiring.js'));

    const handler = () => {
        /* THE DEFINITION, not the first mention: the handler is also referenced where it
         * is bound as a listener, and slicing from that reference reads the wrong function
         * and passes for the wrong reason. Anchor on the assignment. */
        const start = WIRING.indexOf('#onFavouriteAction = (');
        assert.ok(start > 0, '#onFavouriteAction is gone — this test needs re-aiming, not deleting');
        // An arrow-function class field ends at the first `};` back at class-member indent.
        const rest = WIRING.slice(start);
        const end = rest.indexOf('\n    };');
        assert.ok(end > 0, 'could not find the end of the handler');
        return rest.slice(0, end);
    };

    test('exactly ONE setFavourite call in the whole menu handler', () => {
        const body = handler();
        const calls = [...body.matchAll(/setFavourite\s*\(/g)];
        assert.equal(calls.length, 1,
            `the menu writes to the rail ${calls.length} times; only 'clear' may. `
            + 'A second write here is how slot 3 was emptied.');
    });

    test('and it is inside the CLEAR branch, above replace and browse', () => {
        const body = handler();
        const clearAt = body.indexOf("detail.action === 'clear'");
        const writeAt = body.indexOf('setFavourite');
        const replaceAt = body.indexOf("detail.action === 'replace'");
        assert.ok(clearAt >= 0 && writeAt >= 0 && replaceAt >= 0, 'the three branches are still named');
        assert.ok(writeAt > clearAt, 'the one write belongs to clear');
        assert.ok(writeAt < replaceAt, 'and it is finished before replace/browse is reached');
    });

    test('the replace/browse branch dispatches and does nothing else', () => {
        const body = handler();
        const branch = body.slice(body.indexOf("detail.action === 'replace'"));
        assert.doesNotMatch(branch, /setFavourite/,
            'replace must not clear the slot it is about to send you to fill');
        assert.match(branch, /library-open/, 'it still opens the selector');
    });
});
