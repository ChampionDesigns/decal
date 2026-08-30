/**
 * settings-pending-switch.render.test.mjs — D08: a switch that has not been read does not
 * say "off".
 *
 * THE FINDING THIS CLOSES is audit F-042's stated weak case. Round 1 gave every unanswered
 * settings row a pending face — disabled, dashed, asserting nothing — and wrote down the
 * one archetype where that was not enough:
 *
 *     "a disabled `ui-switch` still announces checked/unchecked, so a pending switch
 *      asserts 'off' to a screen reader even while it refuses input; `ui-switch` carries
 *      role='switch' and has no third state"
 *
 * MEASURED on the tablet, and it is not a theoretical window: Accessories › Cup Warmer
 * booted with the pre-warm switch reading FALSE for about four seconds while the server
 * held TRUE. Ben's ruling (D08, 30 Aug 2026): "a switch whose source has not answered
 * renders as a skeleton/inert row, never a false 'off' ... a screen reader must not hear
 * 'off' while pending."
 *
 * WHAT IS ASSERTED, AND WHY IT IS THE ACCESSIBILITY TREE RATHER THAN THE MARKUP. The
 * failure was never "the wrong element is in the DOM" — it was "the right element makes a
 * claim nobody has earned". So the load-bearing assertion is over
 * `Accessibility.getFullAXTree`: while pending, no node in the leaf has role `switch`, and
 * nothing in it is checked. The DOM assertions beside it say WHICH mechanism delivered
 * that, so a future change that keeps the tree honest by some other route still passes and
 * a future change that quietly re-adds the control fails on the tree, not on a selector.
 *
 * AND THE SETTLED HALF IS ASSERTED TOO, in the same page. A fix that deleted the switch
 * would pass every pending assertion here and ship a leaf with no control on it, so the
 * release step demands the real `ui-switch` back, carrying the value the gated backend
 * held all along — which is `false` where the shipped default is `true`, so the settled
 * face cannot be the fallback wearing the answer's clothes.
 *
 * ONE GEOMETRY. Nothing in this file is a measurement of a box; it is a question about
 * what the row claims. The geometry sweep belongs to `settings-leaves.render.test.mjs`,
 * which measures rects.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/pending-leaf-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const ROW = 'display-screen-saver-enabled';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('D08 — a pending switch asserts nothing', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        assert.deepEqual(page.pageErrors, [], 'the leaf must mount without throwing');
    });

    after(async () => { await page?.close(); });

    /** Every node the leaf contributes to the accessibility tree, flattened. */
    const axNodes = async () => {
        const { nodes } = await page.send('Accessibility.getFullAXTree');
        return nodes.map((node) => ({
            role: node.role?.value ?? null,
            name: node.name?.value ?? '',
            checked: node.properties?.find((p) => p.name === 'checked')?.value?.value ?? null,
            disabled: node.properties?.find((p) => p.name === 'disabled')?.value?.value ?? null,
        }));
    };

    /** What the leaf actually composed into the row's control slot. */
    const controlReport = () => page.evalFn((rowId) => {
        const leaf = document.getElementById('leaf');
        const row = leaf.shadowRoot.querySelector(`ui-settings-row[data-row="${rowId}"]`);
        if (!row) return null;
        const slotted = [...row.children];
        return {
            tags: slotted.map((el) => el.localName),
            switches: row.querySelectorAll('ui-switch:not([pending])').length,
            skeletons: row.querySelectorAll('ui-switch[pending]').length,
            roles: slotted.map((el) => el.getAttribute('role')),
            ariaChecked: slotted.map((el) => el.getAttribute('aria-checked')),
            knobs: slotted.map((el) => el.shadowRoot?.querySelector('.knob') ? 1 : 0),
            /* The sentence a reader is given INSTEAD of a state, read off the live node.
             * It lives in #5's SHADOW root since the fix moved there — a consumer cannot
             * forget it and cannot double it — so the light DOM is empty and both are
             * reported, because "which tree is it in" is the thing that changed. */
            text: slotted.map((el) => el.shadowRoot?.querySelector('.a11y')?.textContent.trim() ?? '')
                .join(' ').trim(),
            lightText: slotted.map((el) => el.textContent.trim()).join(' ').trim(),
            /* #29's naming ladder runs on `updated`; rule 3 refuses to name a role-less
             * generic, so a skeleton must come back with NO borrowed heading on it. */
            labelled: slotted.map((el) => el.getAttribute('aria-label')),
            /* The skeleton must hold the switch's own box or the row jumps when the
             * answer lands. Both come from #5's tokens; this asks the engine, not CSS. */
            box: slotted[0] ? (({ width, height }) => ({ width, height }))(
                slotted[0].getBoundingClientRect(),
            ) : null,
        };
    }, ROW);

    test('the model says pending, and the leaf draws a skeleton instead of a switch', async () => {
        const rows = await page.evalFn(() => window.__pendingLeaf.rows());
        const row = rows.find((r) => r.id === ROW);
        assert.ok(row, `${ROW} must be on this leaf`);
        assert.equal(row.archetype, 'switch', 'the archetype this decision is about');
        assert.equal(row.pending, true, 'the gated backend has not answered yet');
        assert.equal(row.inert, false,
            'and it is NOT inert — no master switch is off; nobody knows the value yet');

        const control = await controlReport();
        assert.equal(control.switches, 0, 'a live ui-switch is in the row while nobody has read it');
        assert.equal(control.skeletons, 1, 'the pending face stands in its place');
        assert.deepEqual(control.tags, ['ui-switch'], 'one element in the slot');
        /* THE MECHANISM, so a later reader can see WHICH of the three claims moved. */
        assert.deepEqual(control.roles, [null], 'a pending switch is not a switch');
        assert.deepEqual(control.ariaChecked, [null], 'and it announces no state');
        assert.deepEqual(control.knobs, [0],
            'the knob IS the state — drawing one either side would be the visual half of '
            + 'the same lie');
    });

    test('NOTHING IN THE LEAF IS A SWITCH, AND NOTHING IS CHECKED — the AX tree', async () => {
        const nodes = await axNodes();

        const switches = nodes.filter((node) => node.role === 'switch');
        assert.deepEqual(
            switches, [],
            'role="switch" is present while pending — this is the "off" a screen reader '
            + 'heard, and D08 is that it must not',
        );

        /* THE WIDER CLAIM, ONE STEP WIDER THAN THE ROLE NAME, because `checked` is not the
         * switch role's alone: a `checkbox` or a `menuitemcheckbox` introduced later
         * carries the same false assertion under a different name, and a fix that renamed
         * the role rather than removing the control would pass the check above.
         *
         * `radio` IS DELIBERATELY NOT IN THIS LIST, and it is not an oversight. This leaf's
         * saver-TYPE row is a BANK, and a bank is drawn as a radio group whose unselected
         * members each announce `checked=false` — three of them, measured. A pending bank
         * asserting "none of these is chosen" is arguably the same fault one archetype
         * over, but D08 is a ruling about SWITCHES and widening it here would be this
         * worker deciding a question Ben has not been asked. It is in the FIXLOG for him. */
        const CHECKABLE = new Set(['switch', 'checkbox', 'menuitemcheckbox']);
        const asserted = nodes.filter((node) => CHECKABLE.has(node.role));
        assert.deepEqual(
            asserted.map((node) => `${node.role}=${node.checked}`), [],
            'something in the pending leaf is announcing a checked state',
        );
    });

    test('AND THE FALLBACK IT WOULD HAVE DRAWN IS THE WRONG ONE — the defect, measured',
        async () => {
            /* THIS IS THE ASSERTION THAT MAKES THE OTHERS MEAN SOMETHING. `valueFor` is
             * untouched by the F-042 work: while pending the model still hands back the
             * shipped default, and for this key that default is `true` while the backend
             * holds `false`. So the control that used to be rendered here would have drawn
             * and announced ON, and the answer four seconds later is OFF.
             *
             * It is the tablet's cup-warmer case with the polarity reversed — there the
             * server held TRUE and the page drew FALSE — and reversing it is the point: a
             * pending face is not "draw the safe value", it is "draw no value". */
            const rows = await page.evalFn(() => window.__pendingLeaf.rows());
            const row = rows.find((r) => r.id === ROW);
            assert.equal(row.pending, true, 'still in the window');
            assert.equal(row.checked, true,
                'the model still offers the shipped default — that is what the renderer '
                + 'must now refuse to draw as a state');
        });

    test('the reader is told the value is not known, and the heading is not borrowed', async () => {
        const control = await controlReport();
        assert.equal(control.text, 'Not known',
            'the visually-hidden sentence that replaces the state');
        assert.equal(control.lightText, '',
            'and it is #5\'s, not the leaf\'s — one owner, so it cannot be doubled');

        /* #29's rule 3 — "never name a role-less generic". If the skeleton were given the
         * row's heading it would announce "Show screen saver" as though it were a control,
         * which is the fault one step quieter. */
        assert.deepEqual(control.labelled, [null], 'the row named the pending switch');

        /* AND THE SENTENCE IS REACHABLE, not display:none'd out of the tree: the shared
         * `.a11y` treatment clips a 1px box rather than removing it. */
        const nodes = await axNodes();
        assert.ok(
            nodes.some((node) => node.name.includes('Not known')),
            'the sentence is in the DOM but not in the accessibility tree',
        );
    });

    test('the pending face holds the switch box, so the row does not jump', async () => {
        const pending = await controlReport();
        await page.evalFn(() => window.__pendingLeaf.release());
        await page.settle();
        const settled = await page.evalFn((rowId) => {
            const leaf = document.getElementById('leaf');
            const row = leaf.shadowRoot.querySelector(`ui-settings-row[data-row="${rowId}"]`);
            const el = row.querySelector('ui-switch');
            const { width, height } = el.getBoundingClientRect();
            return { width, height };
        }, ROW);

        assert.ok(Math.abs(pending.box.width - settled.width) <= 0.51,
            `pending ${pending.box.width}px vs settled ${settled.width}px`);
        assert.ok(Math.abs(pending.box.height - settled.height) <= 0.51,
            `pending ${pending.box.height}px vs settled ${settled.height}px`);
    });

    test('once the source answers, the real switch is back — with the ANSWER, not the default',
        async () => {
            /* The gate was opened by the case above; this suite shares one page, and the
             * order is deliberate — the box comparison needs the pending face still on
             * screen, and everything after it needs the settled one. */
            const rows = await page.evalFn(() => window.__pendingLeaf.rows());
            const row = rows.find((r) => r.id === ROW);
            assert.equal(row.pending, false, 'the backend answered');

            const control = await controlReport();
            assert.equal(control.switches, 1, 'the control must come back — D08 is not a deletion');
            assert.equal(control.skeletons, 0);
            assert.deepEqual(control.knobs, [1], 'and the knob is back, because there is a state to draw');

            const state = await page.evalFn((rowId) => {
                const leaf = document.getElementById('leaf');
                const el = leaf.shadowRoot
                    .querySelector(`ui-settings-row[data-row="${rowId}"] ui-switch`);
                return {
                    checked: el.checked,
                    ariaChecked: el.getAttribute('aria-checked'),
                    role: el.getAttribute('role'),
                    name: el.getAttribute('aria-label'),
                };
            }, ROW);

            /* THE SHIPPED DEFAULT FOR THIS KEY IS `true` AND THE BACKEND HELD `false`, so
             * this assertion is the one that separates "the answer arrived" from "the
             * fallback was drawn all along". */
            assert.equal(state.checked, false, 'the backend\'s value, not settings-defaults\' true');
            assert.equal(state.ariaChecked, 'false',
                'and NOW saying "off" is correct, because somebody read it');
            assert.equal(state.role, 'switch');
            assert.ok(state.name && state.name.length > 0,
                'and #29 names it again, which it could not do while it was a generic');
        });
});
