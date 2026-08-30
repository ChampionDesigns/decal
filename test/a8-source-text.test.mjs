/**
 * A8's guard and its canary.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
    LEDGER, READ_NAMES, DEFAULT_TEST_ROOTS,
    runSourceTextScan, findSourceTextReads, blankJsComments, listTestFiles, formatReport,
} from '../scripts/a8-source-text.js';
import { REPO_ROOT } from '../scripts/lib/authored-css.js';

const CANARIES = ['test/fixtures/canaries'];
const CANARY = 'test/fixtures/canaries/a8-source-text.js';

const EDITOR_TESTS = [
    'test/render/editor-skeleton.render.test.mjs',
    'test/harness/editor.js',
    'test/fixtures/editor-shell-fixture.js',
];

const SHEET = `styles/${'tokens'}.css`;
const MODULE = `src/components/${'ui-stepper'}.js`;

describe('A8 over the shipping tree', () => {
    test('no test matches the source text of a style or component file', async () => {
        const report = await runSourceTextScan({});
        assert.equal(report.ok, true, `\n${formatReport(report)}`);
    });

    test('the scan actually covers the tree — not a narrowed root that finds nothing',
        async () => {
            const report = await runSourceTextScan({});
            assert.ok(report.scanned > 200,
                `only ${report.scanned} test files scanned; the tree has more than that`);
            assert.ok(report.files.includes('test/render/editor-skeleton.render.test.mjs'),
                'the render suites are in the scanned set');
            assert.ok(report.files.includes('test/harness/index.js'),
                'and so are the helpers — "including in a helper"');
            assert.deepEqual(DEFAULT_TEST_ROOTS, ['test'], 'one root, and it is test/');
        });
});

describe('the canary fires, and fires on every hop', () => {
    test('the guard fails on the canary and names it', async () => {
        /* `exclude: []` on purpose: the DEFAULT scan steps around this directory (that
         * is what keeps the build from failing on its own canaries), so a canary test
         * has to point the scan AT it. */
        const report = await runSourceTextScan({
            roots: CANARIES, exclude: [], ledger: {}, checkRot: false,
        });
        assert.equal(report.ok, false, 'a canary the guard passes is not a canary');
        assert.deepEqual(report.violations.map((v) => v.file), [CANARY],
            'exactly the canary — the five Gate C canaries beside it are clean of this rule');
    });

    test('all three resolution hops are exercised, and all three resolve', async () => {
        const source = await fsp.readFile(path.resolve(REPO_ROOT, CANARY), 'utf8');
        const found = findSourceTextReads(source);

        const kinds = new Set(found.hits.map((h) => h.via));
        assert.ok(kinds.has('literal'), 'hop 0: a path literal in the read\'s own arguments');
        assert.ok(kinds.has('helper'), 'hop 1: a local read helper, path at the call site');
        assert.ok(kinds.has('binding'), 'hop 2: a local path binding handed to a read by name');

        assert.ok(found.helpers.includes('repoFile'),
            `the read helper was resolved (found: ${found.helpers.join(', ')})`);
        assert.ok(found.pathBindings.includes('SOURCE') && found.pathBindings.includes('SHEETS'),
            `the path bindings were resolved (found: ${found.pathBindings.join(', ')})`);
        assert.ok(found.pathBindings.includes('file'),
            'and the for-of loop variable inherited the list it walks');
    });

    test('the canary is ledger-proof: ledgering it is the only way to pass it', async () => {
        const clean = await runSourceTextScan({
            roots: CANARIES, exclude: [], checkRot: true,
            ledger: { [CANARY]: 'the canary, deliberately' },
        });
        assert.equal(clean.ok, true, 'a ledgered file passes');
        assert.deepEqual(clean.ledgered, [CANARY], 'and is reported as ledgered, not as clean');
    });
});

describe('the guard is precise', () => {
    test('a render suite that mounts a component module does not trip', async () => {
        for (const rel of EDITOR_TESTS) {
            const source = await fsp.readFile(path.resolve(REPO_ROOT, rel), 'utf8');
            const found = findSourceTextReads(source);
            assert.equal(found.hit, false,
                `${rel} trips A8: ${JSON.stringify(found.hits)}`);
        }
    });

    test('the file most likely to trip a careless scanner does not', async () => {
        const rel = 'test/render/ui-menu.render.test.mjs';
        const source = await fsp.readFile(path.resolve(REPO_ROOT, rel), 'utf8');
        assert.match(source, /src\/components\/ui-menu\.js/, 'the bait is still there');
        assert.equal(findSourceTextReads(source).hit, false, `${rel} must stay clean`);
    });

    test('prose is not code — a comment describing a read does not fire', () => {
        const prose = [
            `// the old suite did readFileSync("${SHEET}") and matched 1920px`,
            `/* and ${MODULE} was read the same way */`,
            'export const clean = 1;',
        ].join('\n');
        assert.equal(findSourceTextReads(prose).hit, false, 'a comment is not a read');

        /* And the stripper keeps line numbers, or a violation is reported at the wrong
         * line and the report stops being usable. */
        const blanked = blankJsComments(prose);
        assert.equal(blanked.split('\n').length, prose.split('\n').length,
            'comments are blanked, never deleted');
    });

    test('a read with no style-or-component path in reach does not fire', () => {
        const fine = [
            "import { readFileSync } from 'node:fs';",
            "const fixture = readFileSync('tools/rea-fixtures/api__v1__profiles.json', 'utf8');",
            "const generated = readFileSync('src/data/rea-routes.generated.js', 'utf8');",
            'export const n = fixture.length + generated.length;',
        ].join('\n');
        const found = findSourceTextReads(fine);
        assert.equal(found.hit, false,
            `a fixture and a generated data module are not styles: ${JSON.stringify(found.hits)}`);
    });

    for (const [subtree, module] of [['lib', 'machine-limits'], ['stores', 'settings-store']]) {
        test(`a read of src/${subtree}/ fires — the widened pattern reaches it`, () => {
            /* COMPOSED, like SHEET and MODULE above: spelled out, it would make this file
             * trip the guard it tests. */
            const bad = [
                "import { readFileSync } from 'node:fs';",
                `const source = readFileSync('src/${subtree}/${module}.js', 'utf8');`,
                'export const pinned = /min: 70/.test(source);',
            ].join('\n');
            const found = findSourceTextReads(bad);
            assert.equal(found.hit, true,
                `src/${subtree}/ is inside A8's rule and must be inside its pattern`);
            assert.equal(found.hits[0].line, 2, 'reported at the line the path is on');
        });
    }

    test('and the same code WITH a style path does fire — the sample is not inert', () => {
        const bad = [
            "import { readFileSync } from 'node:fs';",
            `const sheet = readFileSync('${SHEET}', 'utf8');`,
            'export const locked = /1920px/.test(sheet);',
        ].join('\n');
        const found = findSourceTextReads(bad);
        assert.equal(found.hit, true, 'one path is the whole difference');
        assert.equal(found.hits[0].via, 'literal');
        assert.equal(found.hits[0].line, 2, 'reported at the line the path is on');
    });
});

describe('the ledger', () => {
    test('every entry is a file that exists and still reads source text', async () => {
        const report = await runSourceTextScan({});
        for (const rel of Object.keys(LEDGER)) {
            const stat = await fsp.stat(path.resolve(REPO_ROOT, rel)).catch(() => null);
            assert.ok(stat?.isFile(), `${rel}: ledgered but not on disk`);
            assert.ok(report.ledgered.includes(rel),
                `${rel}: ledgered but no longer reads source text — remove the entry`);
        }
        assert.equal(report.ledgered.length, Object.keys(LEDGER).length,
            'the ledger and the tripping set are the same set');
    });

    test('every entry carries a reason, and none of them is a pattern', () => {
        for (const [rel, why] of Object.entries(LEDGER)) {
            assert.equal(typeof why, 'string');
            assert.ok(why.length > 30, `${rel}: a reason has to say something`);
            assert.ok(!/[*?]/.test(rel), `${rel}: exact paths only — a pattern grows on its own`);
        }
    });

    test('rot fires when an entry stops reading source text', async () => {
        const report = await runSourceTextScan({
            ledger: { ...LEDGER, 'test/a8-source-text.test.mjs': 'a deliberately rotten entry' },
        });
        assert.equal(report.ok, false, 'an entry that does not trip must be reported');
        const rot = report.violations.filter((v) => /ledger rot/.test(v.message));
        assert.deepEqual(rot.map((v) => v.file), ['test/a8-source-text.test.mjs'],
            'exactly the rotten one');
    });

    test('the ledger cannot be grown by this wave — the editor suites are not in it', () => {
        for (const rel of EDITOR_TESTS) {
            assert.equal(Object.prototype.hasOwnProperty.call(LEDGER, rel), false,
                `${rel} is ledgered; A8 is a wave-wide block and the editor's suites are `
                + 'rendering tests by construction');
        }
    });
});

describe('wave 5.5: the editor\'s tests', () => {
    test('every editor test file exists, and zero of them match source text', async () => {
        const files = await listTestFiles();
        const editor = files.filter((f) => /^editor[-.]/.test(path.basename(f)));

        assert.ok(editor.length > 0, 'the wave landed at least one editor suite');
        for (const rel of EDITOR_TESTS) {
            assert.ok(editor.includes(rel), `${rel} is missing from the tree`);
        }

        const dirty = [];
        for (const rel of editor) {
            const source = await fsp.readFile(path.resolve(REPO_ROOT, rel), 'utf8');
            if (findSourceTextReads(source).hit) dirty.push(rel);
        }
        assert.deepEqual(dirty, [],
            'A8: every assertion about editor geometry is a computed style or a rendered box');
    });

    test('the read names the guard knows are the ones node exposes', () => {
        assert.deepEqual([...READ_NAMES].sort(),
            ['readFile', 'readFileSync', 'readdir', 'readdirSync'],
            'readdir counts: listing src/components/ and asserting on the names is '
            + 'reading the tree\'s source one level up');
    });
});
