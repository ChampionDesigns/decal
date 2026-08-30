/**
 * The half of bug T22 that Chrome cannot render.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { extractCssTemplates, stripCssComments } from '../scripts/lib/authored-css.js';

const SOURCE = new URL('../src/components/ui-slider.js', import.meta.url);

/** Flat rule scanner. The component has no nested rules; this asserts that too. */
function parseRules(cssText) {
    const src = stripCssComments(cssText);
    const rules = [];
    let buf = '';
    let selector = null;
    let depth = 0;
    let body = '';

    for (const ch of src) {
        if (depth === 0) {
            if (ch === '{') { selector = buf.trim(); buf = ''; depth = 1; body = ''; continue; }
            buf += ch;
            continue;
        }
        if (ch === '{') { depth++; body += ch; continue; }
        if (ch === '}') {
            depth--;
            if (depth === 0) { rules.push({ selector, body }); selector = null; continue; }
            body += ch;
            continue;
        }
        body += ch;
    }
    assert.equal(depth, 0, 'unbalanced braces in the component CSS');
    return rules;
}

function declarations(body) {
    const out = [];
    let buf = '';
    let paren = 0;
    for (const ch of body) {
        if (ch === '(') paren++;
        if (ch === ')') paren = Math.max(0, paren - 1);
        if (ch === ';' && paren === 0) { out.push(buf); buf = ''; continue; }
        buf += ch;
    }
    out.push(buf);
    return out
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
            const at = d.indexOf(':');
            assert.ok(at > 0, `not a declaration: ${d}`);
            return {
                property: d.slice(0, at).trim(),
                value: d.slice(at + 1).trim().replace(/\s+/g, ' '),
            };
        });
}

async function componentRules() {
    const source = await readFile(SOURCE, 'utf8');
    const templates = extractCssTemplates(source);
    assert.ok(templates.length >= 1, 'no css template found in ui-slider.js');
    return templates.flatMap((t) => parseRules(t.text));
}

const find = (rules, selector) => rules.filter((r) => r.selector === selector);

/* The pairs. Each is one job written twice because CSS makes it impossible to write
 * once — which is the whole mechanism behind T22. */
const PAIRS = [
    ['.track::-webkit-slider-thumb', '.track::-moz-range-thumb'],
    ['.track::-webkit-slider-runnable-track', '.track::-moz-range-track'],
];

test('T22: each engine pseudo has exactly one rule — no fourth thumb spec', async () => {
    const rules = await componentRules();
    for (const selector of PAIRS.flat()) {
        assert.equal(
            find(rules, selector).length, 1,
            `expected exactly one \`${selector}\` rule, found ${find(rules, selector).length}. `
            + 'Slate has four thumb specs; this component has one, written twice.',
        );
    }
});

test('T22: the WebKit and Gecko blocks are identical, declaration for declaration', async () => {
    const rules = await componentRules();
    for (const [webkit, gecko] of PAIRS) {
        const a = declarations(find(rules, webkit)[0].body);
        const b = declarations(find(rules, gecko)[0].body);
        assert.deepEqual(
            b, a,
            `\`${gecko}\` has drifted from \`${webkit}\`.\n`
            + '  That drift IS bug T22: main.css:386-395 is a Gecko thumb at 24×24 #385a92 '
            + 'with its own colours and hover transform, and nobody ever noticed because '
            + 'the bench browser never renders it.',
        );
    }
});

test('T22: every thumb value is a token or a private property derived from one', async () => {
    const KEYWORDS = new Set(['none', 'border-box', 'solid', 'transparent', '0', '100%']);
    const rules = await componentRules();

    for (const [webkit, gecko] of PAIRS) {
        for (const selector of [webkit, gecko]) {
            for (const decl of declarations(find(rules, selector)[0].body)) {
                const parts = decl.value
                    .replace(/\bcalc\(/g, ' ')
                    .replace(/[()]/g, ' ')
                    .replace(/(^|\s)var\s+--/g, '$1var(--')
                    .split(/\s+/)
                    .filter(Boolean);
                const OPERATOR = /^[-+*/]$/;
                const BARE_NUMBER = /^\d+(\.\d+)?$/;
                const offToken = parts.filter((p) => !p.startsWith('var(--')
                    && !p.startsWith('--')
                    && !KEYWORDS.has(p)
                    && !OPERATOR.test(p)
                    && !BARE_NUMBER.test(p));
                assert.deepEqual(
                    offToken, [],
                    `${selector} { ${decl.property}: ${decl.value} } carries a value that is `
                    + 'neither a token nor an allowed keyword — the off-token half of T22.',
                );
            }
        }
    }
});

test('T22: one source of truth for the thumb size, and no hover treatment anywhere', async () => {
    const source = await readFile(SOURCE, 'utf8');
    const rules = await componentRules();

    const declaredSize = rules
        .flatMap((r) => declarations(r.body))
        .filter((d) => d.property === '--_ui-slider-thumb');
    assert.equal(
        declaredSize.length, 1,
        'the thumb size must be declared exactly once; both engine rules read it.',
    );

    for (const rule of rules) {
        assert.ok(
            !/:hover/.test(rule.selector),
            `${rule.selector} carries a hover treatment; the thumb specs must not diverge by state.`,
        );
        for (const decl of declarations(rule.body)) {
            assert.notEqual(
                decl.property, 'transform',
                `${rule.selector} transforms something — T22's hover transform, one step from returning.`,
            );
        }
    }

    const css = extractCssTemplates(source).map((t) => t.text).join('\n');
    assert.equal(
        /#[0-9a-fA-F]{3,8}\b/.test(stripCssComments(css)), false,
        'a hex literal in ui-slider.js — #385a92 is exactly how T22 reads today.',
    );
});
