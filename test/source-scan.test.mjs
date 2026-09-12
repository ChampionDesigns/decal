/**
 * The scanner every prose gate and every source-reading test is built on. A quote, a
 * backtick and a slash each mean different things in different places, so the traps
 * here are the ones a pattern-matching version gets wrong.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { comments, strings, stripComments } from '../scripts/lib/source-scan.js';

const textOf = (units) => units.map((u) => u.text);

describe('comments', () => {
    test('a slash pair inside a regex literal is not a comment', () => {
        const source = "const rx = /^vendor\\//;\n// the only comment here\n";
        assert.deepEqual(textOf(comments(source)), ['// the only comment here']);
    });

    test('a quote inside a regex literal does not open a string', () => {
        const source = "const rx = /['\"]/g;\n/* still reachable */\n";
        assert.deepEqual(textOf(comments(source)), ['/* still reachable */']);
    });

    test('a comment opener inside a string is not a comment', () => {
        assert.deepEqual(comments("const s = 'a /* b */ c';\n"), []);
    });

    test('a divided property named for a keyword is not a regex', () => {
        const source = 'const r = a.yield / b;\n// after the division\n';
        assert.deepEqual(textOf(comments(source)), ['// after the division']);
    });

    test('a slash after a postfix increment divides rather than opening a regex', () => {
        const source = 'let i = 0;\nconst r = i++ / 2;\n// after the division\n';
        assert.deepEqual(textOf(comments(source)), ['// after the division']);
    });

    test('a line comment with no trailing newline still reports', () => {
        assert.deepEqual(textOf(comments('const a = 1; // at the end')), ['// at the end']);
    });

    test('a comment inside a tagged template is part of the template, not a comment', () => {
        assert.deepEqual(comments('const s = css`\n    /* inside */\n    color: red;\n`;\n'), []);
    });
});

describe('strings', () => {
    test('a template yields one chunk either side of an interpolation', () => {
        const units = strings('const s = `head ${ value } tail`;\n');
        assert.deepEqual(textOf(units), ['head ', ' tail']);
        assert.deepEqual(units.map((u) => u.kind), ['template', 'template']);
    });

    test('an interpolation is code, so a nested template does not close the outer one', () => {
        const units = strings('const s = `a ${ inner(`b ${x} c`) } d`;\n');
        assert.deepEqual(textOf(units), ['a ', 'b ', ' c', ' d']);
    });

    test('a template chunk reports the line its own text starts on', () => {
        const units = strings('const s = html`\n    <p>one</p>\n`;\n');
        assert.deepEqual(units.map((u) => u.line), [1]);
        assert.match(units[0].text, /<p>one<\/p>/);
    });

    test('a regex literal is code and is never a string', () => {
        assert.deepEqual(strings("const rx = /a'b\"c/;\n"), []);
    });

    test('both quote styles are read, and an escaped quote does not end one', () => {
        const units = strings("const a = 'it\\'s here';\nconst b = \"and here\";\n");
        assert.deepEqual(textOf(units), ["it\\'s here", 'and here']);
    });
});

describe('stripComments', () => {
    test('a regex literal survives with its contents intact', () => {
        const code = stripComments("const rx = /^a\\/'b/g; // gone\n");
        assert.match(code, /\/\^a\\\/'b\/g;/);
        assert.doesNotMatch(code, /gone/);
    });

    test('dropStrings empties a template without losing its interpolated code', () => {
        const code = stripComments('const s = `text ${ value } more`;\n', { dropStrings: true });
        assert.match(code, /value/);
        assert.doesNotMatch(code, /text|more/);
    });
});
