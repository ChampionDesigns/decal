/**
 * The scanner underneath guard, tested on strings.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    extractCssTemplates, parseCssBlock, stripCssComments,
    blankHtmlComments, extractHtmlBlocks, collectHtmlCss,
    listAuthoredFiles, collectAuthoredCss, DEFAULT_SCAN_ROOTS,
} from '../scripts/lib/authored-css.js';

describe('extracting css`` templates from JavaScript', () => {
    test('finds a plain tagged template and nothing else', () => {
        const src = [
            'import { css } from "lit";',
            'const notCss = `color: red`;',
            'export const a = css`',
            '    :host { color: var(--ui-text); }',
            '`;',
        ].join('\n');
        const blocks = extractCssTemplates(src);
        assert.equal(blocks.length, 1);
        assert.match(blocks[0].text, /--ui-text/);
        assert.ok(!blocks[0].text.includes('color: red'), 'an untagged template is not authored CSS');
        assert.equal(blocks[0].line, 3, 'the block starts on the css` line');
    });

    test('finds a template nested inside an interpolation', () => {
        const src = 'const s = css`a { ${flag ? css`color: #00ff88;` : css``} }`;';
        const blocks = extractCssTemplates(src);
        assert.equal(blocks.length, 3, 'outer, the true branch, the empty false branch');
        assert.ok(blocks.some((b) => b.text.includes('#00ff88')));
    });

    test('an interpolation is blanked, not deleted, so later line numbers stay right', () => {
        const src = [
            'const s = css`',
            '    .a { ${fragment} }',
            '    .b { color: var(--ui-text); }',
            '`;',
        ].join('\n');
        const [block] = extractCssTemplates(src);
        assert.equal(block.interpolations, 1);
        const { declarations } = parseCssBlock(block.text, { startLine: block.line });
        const colour = declarations.find((d) => d.property === 'color');
        assert.equal(colour.line, 3, 'the declaration is on source line 3');
    });

    test('a regex literal containing quotes and backticks does not derail the scan', () => {
        // The classic scanner break: `/["'`]/` looks like the start of a string.
        const src = [
            'const re = /["\'`]/g;',
            'const div = a / b / c;',
            'export const s = css`.x { color: var(--ui-text); }`;',
        ].join('\n');
        const blocks = extractCssTemplates(src);
        assert.equal(blocks.length, 1);
        assert.match(blocks[0].text, /--ui-text/);
    });

    test('a css` written inside a comment or a string is not a template', () => {
        const src = [
            '/* Historically this was css`color: red` and it is not any more. */',
            'const doc = "write css`...` in static styles";',
            "const doc2 = 'or css`...` here';",
            'export const s = css`.y { color: var(--ui-key); }`;',
        ].join('\n');
        const blocks = extractCssTemplates(src);
        assert.equal(blocks.length, 1);
        assert.match(blocks[0].text, /--ui-key/);
    });

    test('a template tagged with something else is not authored CSS', () => {
        const src = 'const t = html`<b style="color: red"></b>`; const u = svg`<rect fill="#f00"/>`;';
        assert.deepEqual(extractCssTemplates(src), []);
    });
});

describe('parsing CSS', () => {
    test('comments are blanked, keeping every offset', () => {
        const text = 'a {\n/* !important #ff0000 */\ncolor: var(--ui-text);\n}';
        const stripped = stripCssComments(text);
        assert.equal(stripped.length, text.length, 'blanked, not deleted');
        assert.ok(!stripped.includes('#ff0000'));
        assert.equal(stripped.split('\n').length, text.split('\n').length);
    });

    test('a semicolon inside url() or a string does not split a declaration', () => {
        const { declarations } = parseCssBlock(
            '.a {\n  background-image: url("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=");\n  content: "a; b";\n}',
        );
        assert.equal(declarations.length, 2);
        assert.equal(declarations[0].property, 'background-image');
        assert.equal(declarations[1].value, '"a; b"');
    });

    test('at-rules are recorded with their names and lines', () => {
        const { atRules } = parseCssBlock([
            ':host { color: var(--ui-text); }',
            '@font-face {',
            '  font-family: "X";',
            '}',
            '@container (inline-size >= 400px) {',
            '  .p { block-size: 40px; }',
            '}',
        ].join('\n'));
        assert.deepEqual(atRules.map((a) => a.name), ['font-face', 'container']);
        assert.equal(atRules[0].line, 2);
        assert.equal(atRules[1].line, 5);
    });

    test('a declaration with no trailing semicolon before } is still a declaration', () => {
        const { declarations } = parseCssBlock('.a { color: var(--ui-text) }');
        assert.deepEqual(declarations.map((d) => d.property), ['color']);
    });

    test('!important is flagged on the declaration, however it is spaced', () => {
        const { declarations } = parseCssBlock('.a { display: flex !important; color: red ! important; }');
        assert.deepEqual(declarations.map((d) => d.important), [true, true]);
    });

    test('a pseudo-selector colon is not a declaration split', () => {
        const { declarations } = parseCssBlock('button:focus-visible { outline: none; }');
        assert.deepEqual(declarations.map((d) => d.property), ['outline']);
    });

    test('nested rules keep their own line numbers', () => {
        const { declarations } = parseCssBlock([
            '@media print {',              // 1
            '  .a {',                      // 2
            '    color: var(--ui-text);',  // 3
            '  }',                         // 4
            '}',                           // 5
        ].join('\n'));
        assert.equal(declarations[0].line, 3);
    });
});

describe('authored CSS inside an HTML document', () => {
    const DOC = [
        '<!DOCTYPE html>',                                   // 1
        '<head>',                                            // 2
        '<!-- prose about <style> and color: #ff0000 -->',   // 3
        '<style media="screen">',                            // 4
        '  .a { color: #c0ffee; }',                          // 5
        '</style>',                                          // 6
        '</head>',                                           // 7
        '<script type="module">',                            // 8
        "const doc = 'never write color: #ff0000';",         // 9
        'export const s = css`.b { border-color: #0ff; }`;', // 10
        '</script>',                                         // 11
    ].join('\n');

    test('an HTML comment is blanked, not deleted, so line numbers survive', () => {
        const blanked = blankHtmlComments(DOC);
        assert.equal(blanked.length, DOC.length, 'blanked, not deleted');
        assert.ok(!blanked.includes('#ff0000') || blanked.indexOf('#ff0000') > DOC.indexOf('<script'),
            'the colour inside the HTML comment is gone');
        assert.equal(blanked.split('\n').length, DOC.split('\n').length);
    });

    test('<style> and <script> bodies are found with their own line numbers', () => {
        const { styles, scripts } = extractHtmlBlocks(DOC);
        assert.equal(styles.length, 1);
        assert.equal(scripts.length, 1);
        assert.equal(styles[0].line, 4, 'the body starts on the <style> line');
        assert.match(styles[0].text, /#c0ffee/);
        assert.ok(!styles[0].text.includes('</style>'), 'the close tag is not part of the body');
    });

    test('a <style> written inside an HTML comment is not authored CSS', () => {
        const blocks = collectHtmlCss('<!-- <style>.x { color: red; }</style> -->\n<p>hi</p>');
        assert.deepEqual(blocks, []);
    });

    test('both halves are collected, at absolute lines, and strings are not scanned', () => {
        const blocks = collectHtmlCss(DOC);
        assert.deepEqual(blocks.map((b) => b.kind), ['style-element', 'template']);
        const decls = blocks.flatMap((b) => b.declarations);
        assert.deepEqual(decls.map((d) => [d.property, d.line]), [['color', 5], ['border-color', 10]]);
        assert.ok(!decls.some((d) => /#ff0000/.test(d.value)), 'the colour in the JS string is not a declaration');
    });

    test('a document with no <style> and no css`` yields nothing, but is still read', async () => {
        const files = await listAuthoredFiles(DEFAULT_SCAN_ROOTS);
        assert.ok(files.includes('index.html'));
        const { blocks } = await collectAuthoredCss({ roots: ['index.html'] });
        assert.deepEqual(blocks, []);
    });
});

describe('collecting the tree', () => {
    test('the file walk sees component files, stylesheets and documents', async () => {
        const files = await listAuthoredFiles(DEFAULT_SCAN_ROOTS);
        assert.ok(files.includes('styles/tokens.css'));
        assert.ok(files.includes('src/components/base.js'));
        assert.ok(files.includes('tools/gallery/index.html'));
        assert.ok(!files.some((f) => f.startsWith('test/')), 'test/ is never a scan root');
        assert.ok(!files.some((f) => f.startsWith('vendor/')), 'vendored code is not authored here');
    });

    test('a scan root may be a single file', async () => {
        const files = await listAuthoredFiles(['index.html']);
        assert.deepEqual(files, ['index.html']);
    });

    test('base.js yields real CSS blocks with plausible line numbers', async () => {
        const { blocks } = await collectAuthoredCss({ roots: ['src'] });
        const base = blocks.filter((b) => b.file === 'src/components/base.js');
        assert.ok(base.length >= 4, `expected the base fragments plus baseStyles, got ${base.length}`);
        for (const b of base) {
            assert.ok(b.line > 1, 'a template inside a file starts after line 1');
            assert.ok(b.declarations.length > 0, `block at line ${b.line} parsed no declarations`);
        }
        // The file documents !important a dozen times in prose and uses it zero times.
        assert.equal(base.some((b) => b.declarations.some((d) => d.important)), false);
    });

    test('a missing scan root is not a failure', async () => {
        const files = await listAuthoredFiles(['src', 'does-not-exist']);
        assert.ok(files.length > 0);
    });
});
