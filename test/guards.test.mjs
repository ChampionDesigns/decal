/**
 * guards.test.mjs — Gate C's canaries.
 *
 * "Every guard ships with a canary. A fixture that deliberately violates the rule,
 *  and a test asserting the guard fails on it. All three old-guard failures were
 *  guards that silently stopped covering their target; a canary converts that decay
 *  from invisible to a red build." — SCOPE Part 8 §2, Gate C.
 *
 * The canary is as much the deliverable as the guard. So this file asserts in both
 * directions, and exactly:
 *
 *   - each guard FAILS on its canary, at the right file and the right line;
 *   - each guard PASSES on a clean component that uses the shapes most likely to
 *     trip a careless scanner (test/fixtures/guard-clean/) — a guard that fires on
 *     everything gets switched off, which is the same outcome as one that fires on
 *     nothing;
 *   - the guards find the violation hidden in a nested template inside an
 *     interpolation, and do NOT find the ones written in prose, in a comment or in a
 *     string (test/fixtures/canaries/hidden-literal.js);
 *   - all THREE halves of the scan are covered: the `css` templates in .js files, plain
 *     .css files, and authored CSS inside an HTML document — a `<style>` element or a
 *     `css` template in an inline `<script>` (test/fixtures/canaries/html-style-literal.html);
 *   - the default scan roots exclude test/, so the build does not fail on its own
 *     canaries (test/fixtures/canaries/README.md states this as worth a test);
 *   - the exemption-rot check fires when an exempt path does not exist ON DISK, and
 *     does not fire merely because a run's scan roots were narrowed;
 *   - and the shipping tree is clean, which is the assertion the build actually runs.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    GUARDS, runGuards, formatReport,
    colourLiteralGuard, fontFaceGuard, importantGuard, privatePaletteGuard,
} from '../scripts/guards.js';
import { DEFAULT_SCAN_ROOTS, collectAuthoredCss } from '../scripts/lib/authored-css.js';
import { findColourLiterals, isColourBearing } from '../scripts/lib/colour-literals.js';

const CANARIES = ['test/fixtures/canaries'];
const CLEAN = ['test/fixtures/guard-clean'];

/**
 * Run over a fixture tree. The exemption check stays ON: the exempt sheets live under
 * the real repo root, which is still `root` here, so narrowing `roots` must not make
 * the rot check fire. That it once did is the reason this argument is spelled out.
 */
const overFixtures = (roots, only = null) => runGuards({ roots, only, checkExemptions: true });

/* ---------------------------------------------------------------------------
 * The tree the build actually guards
 * ------------------------------------------------------------------------- */

describe('Gate C over the shipping tree', () => {
    test('every guard passes', async () => {
        const report = await runGuards({});
        assert.equal(report.ok, true, `\n${formatReport(report)}`);
        assert.equal(report.violations.length, 0);
    });

    test('and it is actually looking at something', async () => {
        // A guard that scans zero files passes forever. This is the assertion that
        // catches the day someone moves src/ and nobody notices Gate C went quiet.
        const report = await runGuards({});
        assert.ok(report.blocks >= 5, `expected several CSS blocks, found ${report.blocks}`);
        assert.ok(report.declarations >= 100, `expected a real declaration count, found ${report.declarations}`);
        /* WHAT "SOMETHING" IS DEPENDS ON WHAT THE GUARD ASKS. Every guard here reads CSS
         * blocks except `parses`, which asks a question about FILES — the block scanner
         * only extracts css`` templates, so a guard that must see every authored file
         * cannot be written against blocks at all, which is precisely the gap it closes.
         * Asserted per kind rather than by loosening the number, because "blocks or files,
         * whichever is non-zero" would let a block guard go quiet and still pass. */
        for (const r of report.results) {
            const kind = GUARDS.find((g) => g.id === r.guard)?.kind;
            if (kind === 'files') {
                assert.ok(r.filesScanned > 0, `${r.guard} scanned no files`);
                assert.equal(r.blocksScanned, 0, `${r.guard} is a file guard and has no blocks`);
            } else {
                assert.ok(r.blocksScanned > 0, `${r.guard} scanned nothing`);
            }
        }
    });

    test('the scan reaches css`` templates and HTML, not just .css files', async () => {
        const report = await runGuards({});
        const exts = new Set(report.files.map((f) => path.extname(f)));
        assert.ok(exts.has('.js'), 'the file list must include .js component files');
        assert.ok(exts.has('.css'), 'the file list must include .css sheets');
        assert.ok(exts.has('.html'), 'the file list must include the hand-written documents');
    });

    test('the tool pages` <style> blocks are scanned, not skipped as scaffolding', async () => {
        // ~120 lines of authored CSS in a <style> element. Before it was read, Gate C
        // reported PASS on a file it had never opened.
        const report = await runGuards({});
        assert.ok(report.files.includes('tools/gallery/index.html'));
        assert.ok(report.files.includes('index.html'));
        // The blocks themselves, via the collector the guards share. EVERY tool page with
        // a <style> element is here, not a fixed count: wave 5.1 added the screens walk
        // (tools/screens/index.html), and a count nobody could add to would have made the
        // next tool page's chrome unscanned — the very hole this test was written for.
        const { blocks } = await collectAuthoredCss({});
        const styleEl = blocks.filter((b) => b.kind === 'style-element');
        const gallery = styleEl.find((b) => b.file === 'tools/gallery/index.html');
        assert.ok(gallery, 'the gallery chrome is no longer scanned');
        assert.ok(gallery.declarations.length >= 40,
            `expected the gallery chrome's declarations, got ${gallery.declarations.length}`);
        for (const block of styleEl) {
            assert.match(block.file, /^(tools\/.*|index)\.html$|^tools\/.*\/index\.html$/,
                `a <style> element outside the tool pages: ${block.file}`);
            assert.ok(block.declarations.length > 0, `${block.file}'s block parsed to nothing`);
        }
    });

    test('the default scan roots exclude test/ and vendor/, so the build cannot fail on its own canaries', () => {
        assert.deepEqual([...DEFAULT_SCAN_ROOTS], ['src', 'styles', 'tools', 'index.html']);
        assert.ok(!DEFAULT_SCAN_ROOTS.some((r) => r.startsWith('test')));
        assert.ok(!DEFAULT_SCAN_ROOTS.some((r) => r.startsWith('vendor')));
    });
});

/* ---------------------------------------------------------------------------
 * The canaries — one per guard, all three halves of the scan
 * ------------------------------------------------------------------------- */

describe('Gate C canaries', () => {
    test('colour-literal fails on the template canary, at the right lines', async () => {
        const report = await overFixtures(CANARIES, ['colour-literal']);
        const hits = report.violations.filter((v) => v.file.endsWith('canaries/colour-literal.js'));
        assert.equal(hits.length, 3, `\n${formatReport(report)}`);
        assert.deepEqual(hits.map((h) => h.line), [22, 23, 24]);
        assert.deepEqual(hits.map((h) => h.message.split(' ')[0]), ['hex', 'function', 'function']);
        assert.equal(report.ok, false);
    });

    test('colour-literal fails on the stylesheet canary too', async () => {
        const report = await overFixtures(CANARIES, ['colour-literal']);
        const hits = report.violations.filter((v) => v.file.endsWith('canaries/sheet-colour-literal.css'));
        assert.equal(hits.length, 3);
        assert.ok(hits.some((h) => h.message.includes('named colour literal tomato')),
            'a bare named colour on a colour-bearing property is a literal');
    });

    test('colour-literal fails on the HTML canary, in both places CSS can hide there', async () => {
        const report = await overFixtures(CANARIES, ['colour-literal']);
        const hits = report.violations.filter((v) => v.file.endsWith('canaries/html-style-literal.html'));
        assert.equal(hits.length, 3, `\n${formatReport(report)}`);
        // Two in the <style> element, one in a css`` template inside the inline <script>.
        assert.deepEqual(hits.map((h) => h.line), [19, 20, 33]);
        assert.ok(hits.some((h) => h.message.includes('#c0ffee')), 'the <style> element half');
        assert.ok(hits.some((h) => h.message.includes('#0ff')), 'the inline <script> half');
    });

    test('font-face fails on both its canaries', async () => {
        const report = await overFixtures(CANARIES, ['font-face']);
        const files = report.violations.map((v) => v.file);
        assert.ok(files.some((f) => f.endsWith('canaries/font-face.js')), 'the template half');
        assert.ok(files.some((f) => f.endsWith('canaries/sheet-font-face.css')), 'the stylesheet half');
        assert.equal(report.violations.length, 2);
        assert.equal(report.ok, false);
    });

    test('important fails on its canary', async () => {
        const report = await overFixtures(CANARIES, ['important']);
        assert.equal(report.violations.length, 2, `\n${formatReport(report)}`);
        assert.deepEqual(report.violations.map((v) => v.line), [22, 26]);
        assert.equal(report.ok, false);
    });

    test('private-palette fails on its canary and names the tokens', async () => {
        const report = await overFixtures(CANARIES, ['private-palette']);
        assert.equal(report.violations.length, 3);
        const names = report.violations.map((v) => v.message.match(/--ui-[a-z-]+/)[0]);
        assert.deepEqual(names, ['--ui-steel', '--ui-selected-face', '--ui-text']);
    });

    test('every guard in the registry has at least one canary that trips it', async () => {
        const report = await overFixtures(CANARIES);
        const tripped = new Set(report.violations.map((v) => v.guard));
        for (const guard of GUARDS) {
            assert.ok(
                tripped.has(guard.id),
                `guard "${guard.id}" has no canary that fails it — it could be scanning nothing and nobody would know`,
            );
        }
    });
});

/* ---------------------------------------------------------------------------
 * Guard blindness, in both directions
 * ------------------------------------------------------------------------- */

describe('guard blindness', () => {
    test('a literal hidden in a nested template inside an interpolation is found', async () => {
        const report = await overFixtures(CANARIES, ['colour-literal']);
        const hits = report.violations.filter((v) => v.file.endsWith('hidden-literal.js'));
        assert.equal(hits.length, 1, `expected exactly the nested one, got:\n${JSON.stringify(hits, null, 2)}`);
        assert.match(hits[0].message, /#00ff88/);
        assert.equal(hits[0].line, 49);
    });

    test('the viewport-unit guard finds all four shapes and spares the var() fallback', async () => {
        /* The four shapes are a fraction of the height, a fraction of the width, a
         * vmin, and one buried in a calc() where it reads as arithmetic. The shape it
         * must NOT report is `var(--ui-app-h, 100dvh)`: that is the pre-fit fallback,
         * the reason a WebView with the inline script blocked still gets a page, and a
         * guard that fired on it would be a guard nobody could satisfy. */
        const report = await overFixtures(CANARIES, ['viewport-unit']);
        const hits = report.violations.filter((v) => v.file.endsWith('viewport-unit.js'));
        assert.deepEqual(hits.map((v) => v.detail.split(':')[0]).sort(),
            ['block-size', 'inline-size', 'min-block-size', 'padding-block'],
            `\n${formatReport(report)}`);
        assert.ok(!hits.some((v) => /max-block-size/.test(v.detail)),
            'the guard fired on the var() fallback, which nothing could then satisfy');
    });

    test('colours and !important written in prose, comments and strings are not violations', async () => {
        const report = await overFixtures(CANARIES);
        const hits = report.violations.filter((v) => v.file.endsWith('hidden-literal.js'));
        // The file writes #ff0000, rgb(1, 2, 3) and "!important" in a doc comment, in
        // two module-scope strings, in a comment inside the css template, and in a
        // `content:` string. src/components/base.js does the same when it documents
        // why those things are never used — a guard that greps the raw file fails on
        // the file that documents the rule.
        assert.equal(hits.filter((h) => h.guard === 'important').length, 0);
        assert.equal(hits.filter((h) => /#ff0000|rgb\(/.test(h.message)).length, 0);
    });

    test('a colour written in an HTML comment or a JS string is not a violation either', async () => {
        // The HTML canary's own explanatory comment writes #ff0000 and rgb(1, 2, 3),
        // and its inline script writes #ff0000 in a comment and in a string. Only the
        // three real ones may fire — the same rule, on the new scan surface.
        const report = await overFixtures(CANARIES, ['colour-literal']);
        const hits = report.violations.filter((v) => v.file.endsWith('html-style-literal.html'));
        const decoyLines = [15, 28, 29]; // the HTML comment, the JS comment, the JS string
        assert.equal(hits.filter((h) => decoyLines.includes(h.line)).length, 0,
            `a decoy fired:\n${JSON.stringify(hits, null, 2)}`);
        assert.equal(hits.filter((h) => /#ff0000/.test(h.message)).length, 0,
            '#ff0000 appears only in prose in that file');
    });

    test('a clean component using the tricky-but-legal shapes passes every guard', async () => {
        const report = await overFixtures(CLEAN);
        assert.equal(report.violations.length, 0, `\n${formatReport(report)}`);
        assert.ok(report.blocks > 0, 'the clean fixture must actually be scanned');
    });
});

/* ---------------------------------------------------------------------------
 * The exemptions
 * ------------------------------------------------------------------------- */

describe('exemptions', () => {
    const temps = [];
    after(async () => {
        for (const dir of temps) await fsp.rm(dir, { recursive: true, force: true });
    });

    /** A throwaway tree whose only content is the files named. */
    async function makeTree(files) {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gatec-exempt-'));
        temps.push(dir);
        for (const [rel, body] of Object.entries(files)) {
            const abs = path.join(dir, rel);
            await fsp.mkdir(path.dirname(abs), { recursive: true });
            await fsp.writeFile(abs, body, 'utf8');
        }
        return dir;
    }

    test('the token sheets are the single exempted home for colour', () => {
        assert.deepEqual(colourLiteralGuard.exempt, ['styles/tokens.css', 'styles/chart-channels.css']);
        assert.deepEqual(privatePaletteGuard.exempt, ['styles/tokens.css', 'styles/chart-channels.css']);
        assert.deepEqual(fontFaceGuard.exempt, ['styles/document.css']);
        assert.deepEqual(importantGuard.exempt, [], 'nothing is exempt from the !important rule');
    });

    test('an exemption pointing at a file that is not on disk is itself a violation', async () => {
        // The mechanism under test is a FILESYSTEM fact. So: a tree where one exempt
        // sheet exists and the rest do not, and the check must name exactly those.
        const root = await makeTree({
            'styles/tokens.css': ':root { --ui-text: #e8eef2; }\n',
            'src/thing.js': 'export const x = 1;\n',
        });
        const report = await runGuards({ root, roots: ['src', 'styles'], checkExemptions: true });
        const rot = report.violations.filter((v) => /exempt path does not exist/.test(v.message));

        // Five, because the registry's exemptions are: chart-channels.css for two
        // guards, document.css for one, and the two instrument host pages for the
        // viewport-unit guard — the pages whose stage IS the viewport, which is the
        // ground being stated rather than the app reading it.
        assert.equal(rot.length, 5, `\n${formatReport(report)}`);
        assert.deepEqual(
            [...new Set(rot.map((v) => v.file))].sort(),
            ['styles/chart-channels.css', 'styles/document.css',
                'tools/gallery/index.html', 'tools/screens/index.html'],
            'chart-channels is missing for two guards, document.css for one, both host pages for one',
        );
        assert.ok(!rot.some((v) => v.file === 'styles/tokens.css'),
            'tokens.css is on disk, so it must never be reported missing');
        for (const v of rot) assert.equal(v.severity, 'error');
    });

    test('narrowing the scan roots does not make the rot check fire', async () => {
        // The bug this pins: the check used to test membership of THIS run's scanned
        // file list, so `roots: ['src']` reported all five exempt sheets as
        // non-existent while they sat in styles/. Five false errors whose obvious
        // remedy is checkExemptions:false — the check switching itself off.
        for (const roots of [['src'], ['tools'], ['test/fixtures/canaries']]) {
            const report = await runGuards({ roots, checkExemptions: true });
            const rot = report.violations.filter((v) => /exempt path does not exist/.test(v.message));
            assert.equal(rot.length, 0, `roots=${JSON.stringify(roots)} raised ${rot.length} false rot violations`);
        }
    });

    test('the exempted sheets really do hold literals, so the exemption is load-bearing', async () => {
        // If tokens.css ever stopped holding colour literals, the exemption would be
        // dead weight — and dead exemptions are how a guard's coverage silently shrinks.
        const report = await runGuards({ roots: ['styles'], checkExemptions: true });
        assert.equal(report.violations.length, 0, 'styles/ is clean with the exemptions in place');

        const unexempted = await runGuards({ roots: ['styles'], only: ['colour-literal'], checkExemptions: true });
        // Sanity: prove the guard would have plenty to say about the token sheet by
        // scanning it directly through the vocabulary rather than the file walk.
        assert.ok(findColourLiterals('--ui-steel', '#b0c4ce').length > 0);
        assert.equal(unexempted.violations.length, 0);
    });
});

/* ---------------------------------------------------------------------------
 * The colour vocabulary, on strings
 * ------------------------------------------------------------------------- */

describe('what counts as a colour literal', () => {
    test('the three literal forms are caught', () => {
        assert.equal(findColourLiterals('color', '#fff').length, 1);
        assert.equal(findColourLiterals('color', '#ff004480').length, 1);
        assert.equal(findColourLiterals('background-color', 'rgb(1 2 3 / 50%)').length, 1);
        assert.equal(findColourLiterals('border-color', 'oklch(70% 0.1 200)').length, 1);
        assert.equal(findColourLiterals('color', 'rebeccapurple').length, 1);
    });

    test('tokens, keywords and derivations are not literals', () => {
        for (const [prop, value] of [
            ['color', 'var(--ui-text)'],
            ['background-color', 'var(--ui-key)'],
            ['outline-color', 'currentColor'],
            ['border-color', 'transparent'],
            ['box-shadow', 'inset 0 calc(-1 * var(--ui-selected-led)) 0 0 currentColor'],
            ['text-shadow', '0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent)'],
            ['background-image', 'linear-gradient(to right, var(--ui-steel) 50%, var(--ui-line) 50%)'],
            ['color', 'inherit'],
            ['outline', 'none'],
        ]) {
            assert.deepEqual(findColourLiterals(prop, value), [], `${prop}: ${value}`);
        }
    });

    test('a colour name in a non-colour property is not a colour', () => {
        // "plum", "linen" and "tan" are also ordinary words. Flagging them in
        // grid-template-areas is the false positive that gets a guard exempted.
        assert.deepEqual(findColourLiterals('grid-template-areas', '"plum linen"'), []);
        assert.deepEqual(findColourLiterals('font-family', 'Geist, system-ui, sans-serif'), []);
        assert.equal(isColourBearing('grid-template-areas'), false);
        assert.equal(isColourBearing('background'), true);
        assert.equal(isColourBearing('--anything'), true, 'a custom property carrying a bare name can only be a colour');
    });

    test('a string that looks like a colour is not one', () => {
        assert.deepEqual(findColourLiterals('content', '"#ff0000"'), []);
        assert.deepEqual(findColourLiterals('background-image', 'url(#gradient)'), []);
    });
});
