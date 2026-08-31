/**
 *: a switch that has not been read does not say "off".
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

        const CHECKABLE = new Set(['switch', 'checkbox', 'menuitemcheckbox']);
        const asserted = nodes.filter((node) => CHECKABLE.has(node.role));
        assert.deepEqual(
            asserted.map((node) => `${node.role}=${node.checked}`), [],
            'something in the pending leaf is announcing a checked state',
        );
    });

    test('AND THE FALLBACK IT WOULD HAVE DRAWN IS THE WRONG ONE — the defect, measured',
        async () => {
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
