/**
 * ui-slider-thumb-parity.test.mjs — the half of bug T22 that Chrome cannot render.
 *
 * T22 (`LAYOUT_SPEC_DRAFT.md:1198`): "`::-moz-range-thumb` is never overridden — a
 * second 24×24 `#385a92` thumb spec with its own colours and hover transform"
 * (`main.css:376-395`). Together with the three live specs that is spec §5.2 #23's
 * verdict on component #23: "Four thumb specs, two of them off-token."
 *
 * WHY THIS IS A STATIC TEST AND NOT A RENDERING ONE. An unknown pseudo-element
 * invalidates the selector it appears in, so a `::-moz-range-thumb` rule cannot be
 * merged into the WebKit one — the two engines need two rules, and two rules is
 * exactly how a divergence starts. Chrome does not merely ignore the Gecko rule, it
 * DROPS it at parse time: measured, `sheet.cssRules` after `replaceSync` of both
 * rules contains only the `::-webkit-` one. So no assertion made in the Gate A
 * harness can see the Gecko thumb at all, and the only honest check is on what was
 * authored. Everything about the thumb that Chrome CAN render — its 26px derivation
 * from `--ui-icon`, its `--ui-surface` face, its `--ui-line-strong` hairline — is
 * asserted for real in `test/render/ui-slider.render.test.mjs`, through the input's
 * user-agent shadow tree.
 *
 * The rule this file enforces: the paired rules carry IDENTICAL declaration blocks,
 * every value is a token or a private property derived from one, and no thumb rule
 * carries a hover treatment. A fifth spec cannot be added without turning this red.
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
    // "Four thumb specs, two of them OFF-TOKEN" (spec §5.2 #23). A value here is
    // legal only if it reads a --ui-* token, reads the component's own --_ui-*
    // derivation, or is a bare keyword that carries no palette and no measurement.
    const KEYWORDS = new Set(['none', 'border-box', 'solid', 'transparent', '0', '100%']);
    const rules = await componentRules();

    for (const [webkit, gecko] of PAIRS) {
        for (const selector of [webkit, gecko]) {
            for (const decl of declarations(find(rules, selector)[0].body)) {
                /* A DERIVATION IS NOT AN OFF-TOKEN VALUE, and one arrived on 23 Aug
                 * 2026: the thumb is offset by half the difference between the ink and
                 * its own size, so it rides the line rather than sitting 20px under it
                 * (Ben: "the slider not on the line"). Every operand is a private
                 * property this file already governs; what is left after removing the
                 * calc wrapper and its operators is arithmetic, not a measurement
                 * somebody wrote down.
                 *
                 * SO THE CHECK OPENS calc() AND KEEPS ITS TEETH: the operands must
                 * still each be a var(), and a bare NUMBER is allowed only as an
                 * operand — `2` in `/ 2` is a divisor, not a length. A literal with a
                 * unit (26px, 50%) is still the off-token half of T22 and still fails,
                 * which is the thing this test was written for. */
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

    // The other half of T22's sentence: "with its own colours AND HOVER TRANSFORM"
    // (main.css:381-384, :397-400 — a scale(1.1) and a second box-shadow, on the
    // Gecko copy only, so the two engines animate differently).
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

    // And nothing in the file paints a raw colour (Gate C's own guard covers the
    // tree; this pins the file the bug is about).
    const css = extractCssTemplates(source).map((t) => t.text).join('\n');
    assert.equal(
        /#[0-9a-fA-F]{3,8}\b/.test(stripCssComments(css)), false,
        'a hex literal in ui-slider.js — #385a92 is exactly how T22 reads today.',
    );
});
