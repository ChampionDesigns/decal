/**
 * The Live skeleton's contract, without a browser.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

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
        assert.match(CODE['src/screens/live-screen.js'], /ghc: \{ type: Boolean, reflect: true \}/);
        assert.match(CODE['src/screens/live-main.js'], /<slot name="ghc">/);
    });

    test('no steam bound, no chart number and no foot-band number is written here', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /\b(130|135|165|160|170)\b/, `${file} writes a steam bound`);
            assert.doesNotMatch(CODE[file], /\b160px\b/, `${file} copies the chart floor out of the token sheet`);
        }
        for (const file of SCREEN_FILES) {
            const lengths = [...CODE[file].matchAll(/(?<![-\w(])(\d+(?:\.\d+)?)(px|rem|em)\b/g)];
            assert.deepEqual(lengths.map((m) => m[0]), [],
                `${file} writes a raw length: ${lengths.map((m) => m[0]).join(', ')}`);
        }
    });
});

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

    test('--ui-live-foot-share is a share of the screen, with its arithmetic beside it', () => {
        const value = declaration('--ui-live-foot-share');
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

describe('bugs that die in the source', () => {
    test('L5: no correction margins, and no fractional gap anywhere in the rail', () => {
        const rail = CODE['src/screens/live-rail.js'];
        assert.match(rail, /gap: var\(--ui-space-6\)/, 'one uniform gap, from the spacing scale');
        assert.match(rail, /::slotted\(\*\) \{[^}]*margin: 0/s, 'slotted rows have their margins zeroed');
        assert.doesNotMatch(rail, /margin-(top|bottom|block)/, 'a correction margin is exactly what L5 is');
        assert.doesNotMatch(rail, /\d+\.\d+/, 'a fractional length in a rail is how the L5 chain started');
    });

    test('nothing in the skeleton is absolutely positioned but the one named overlay', () => {
        const OVERLAYS = { 'src/screens/live-screen.js': '.notice-layer' };
        for (const file of SCREEN_FILES) {
            const found = [...CODE[file].matchAll(/position:\s*(absolute|fixed)/g)].map((m) => m[0]);
            const allowed = OVERLAYS[file];
            if (!allowed) {
                assert.deepEqual(found, [],
                    `${file} positions something - §4.1: "One grid. No absolutely-positioned structure."`);
                continue;
            }
            assert.equal(found.length, 1,
                `${file} may position ${allowed} and nothing else; found ${found.length}: ${found.join(', ')}`);
            assert.match(CODE[file], new RegExp(`\\${allowed}\\s*\\{[^}]*position:\\s*absolute`, 's'),
                `the one positioned rule in ${file} must be ${allowed}`);
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

describe('D2: translation is a value from the first commit', () => {
    test('the screen renders no literal text node at all', () => {
        const code = CODE['src/screens/live-screen.js'];
        assert.match(code, /new I18nController\(this\)/);

        const literals = [...code.matchAll(/(?<![=!])>\s*([A-Za-z][^<>{}]*?)\s*</g)]
            .map((m) => m[1].trim())
            .filter((s) => s.length > 0);
        assert.deepEqual(literals, [],
            `literal text in a template: ${literals.join(' | ')} - D2 makes every readable string a value`);
    });

    test('every label the bands render is translated, not pasted', () => {
        const code = CODE['src/screens/live-screen.js'];
        assert.match(code, /t\(row\.label\)/, 'the rail rows go through t()');
        assert.match(code, /t\(gauge\.label\)/, 'the gauge labels go through t()');
        assert.match(code, /aria-label=\$\{t\(/, 'so do the region names');
    });
});

describe('the favourite hold-menu writes only when the gesture says "empty this"', () => {
    const WIRING = stripComments(read('src/screens/live-wiring.js'));

    const handler = () => {
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
