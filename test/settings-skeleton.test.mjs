
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
        const column = CODE['src/screens/settings-nav-column.js'];
        assert.doesNotMatch(column, /block-size:\s*var\(--ui-nav-row\)/,
            'the column does not size the rows; the rows do');
    });
});

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
        // the rule is two hairlines of two greys. One gap has one width and it is the token's.
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /gap:\s*\d/, `${file} writes a gap in pixels`);
        }
    });
});

describe('T16: no scrollable region in this cluster hides its scrollbar', () => {
    test('no scrollbar-width, no scrollbar-color, no ::-webkit-scrollbar', () => {
        for (const file of SCREEN_FILES) {
            assert.doesNotMatch(CODE[file], /scrollbar-width/, `${file}'s defect`);
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

describe('the numbers, and there are only four of them', () => {
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

describe('what the skeleton does not import', () => {
    test('no store, no endpoint, no limit, no capability, no storage key', () => {

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
        assert.match(screen, /change-count=\$\{this\.changeCount \+ \(this\.#ledPending \? 1 : 0\)\}/,
            '"A count, and nothing else, crosses the boundary"');
        assert.doesNotMatch(screen, /'Save|"Save|Save \(/,
            'the Save wording belongs to #31 and to no screen');
        assert.doesNotMatch(screen, /primaryLabel|commitView/,
            'both were deleted by D11');
    });

});
