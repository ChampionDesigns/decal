

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** Every non-ignored node the engine exposes, as {role, name}. */
async function axNodes(page) {
    await page.send('Accessibility.enable');
    const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
    return nodes
        .filter((node) => !node.ignored)
        .map((node) => ({ role: node.role?.value ?? '', name: node.name?.value ?? '' }));
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`selector row actions @ ${geometry.name}`, () => {

        const onSelector = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.evalFn(() => window.__carry.mount());
            await page.evalFn(() => window.__carry.show('selector'));
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the selector must mount without throwing');
            return fn(page);
        });

        test('F-016 #8 — every row-actions opener is named, after its own profile',
            () => onSelector(async (page) => {
                const nodes = await axNodes(page);
                const named = nodes.map((n) => n.name).filter((n) => n.includes('More actions'));

                assert.ok(named.length > 0,
                    `the openers must be named — saw ${JSON.stringify(nodes)}`);

                const treeitems = nodes.filter((n) => n.role === 'treeitem').map((n) => n.name);
                for (const label of named) {
                    const subject = label.replace('More actions for ', '');
                    assert.ok(treeitems.some((row) => row.startsWith(subject)),
                        `"${label}" must name a row that is on the glass — rows: ${JSON.stringify(treeitems)}`);
                }
                assert.equal(new Set(named).size, named.length,
                    'no two openers share a name: each says which profile it acts on');
            }));

        test('F-016 #8 — and no row takes an opener\'s name into its own',
            () => onSelector(async (page) => {
                const nodes = await axNodes(page);
                const treeitems = nodes.filter((n) => n.role === 'treeitem').map((n) => n.name);

                assert.ok(treeitems.length > 0, 'the listing must be on the glass');

                /* THE EXACT STRING CLUSTER L MEASURED AND PARKED ON. If this ever comes
                 * back it means a row stopped naming itself and Chrome went back to
                 * composing one from its contents. */
                const polluted = treeitems.filter((name) => name.includes('More actions'));
                assert.deepEqual(polluted, [],
                    'a row announces its own content only — a labelled affordance inside it '
                    + `must not be folded in. Rows: ${JSON.stringify(treeitems)}`);

                /* AND THE NAME IS STILL THE ROW'S CONTENT, not a placeholder that merely
                 * happens to exclude the affordance: every row is named after something a
                 * person can read on it. */
                for (const name of treeitems) {
                    assert.ok(name.trim().length > 0,
                        `a row with no name at all is not the fix either — rows: ${JSON.stringify(treeitems)}`);
                }
            }));

        test('D21 — ONE opener is focusable, on the active row, and the rest are still spans',
            () => onSelector(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.querySelector('selector-screen').shadowRoot;
                    const openers = [...root.querySelectorAll('#rows .row-dots')];
                    return openers.map((el) => ({
                        tag: el.tagName,
                        role: el.getAttribute('role'),
                        tabindex: el.getAttribute('tabindex'),
                        named: (el.getAttribute('aria-label') || '').startsWith('More actions for'),
                        hidden: el.getAttribute('aria-hidden'),
                        /* The GLYPH is hidden on its own span, one level in, so the name
                         * is "More actions for X" and not "More actions for X ⋯". */
                        glyphHidden: el.querySelector('[aria-hidden="true"]')?.textContent?.trim(),
                        /* Which row is it in, as the tree itself marks it. */
                        active: el.closest('ui-list-row')?.hasAttribute('data-active') ?? null,
                    }));
                });
                assert.ok(shape.length > 0, 'the openers must be on the glass');

                const focusable = shape.filter((el) => el.tabindex !== null);
                assert.equal(focusable.length, 1,
                    'EXACTLY ONE tab stop for the whole listing — not one per row, which is '
                    + `what P12 measured at 79. Saw ${focusable.length} of ${shape.length}`);
                assert.equal(focusable[0].active, true,
                    'and it is the row aria-activedescendant names, so it moves with the keys');
                assert.deepEqual(focusable[0], {
                    tag: 'SPAN', role: 'button', tabindex: '0', named: true,
                    hidden: null, glyphHidden: '⋯', active: true,
                }, `the reachable opener is a named button — saw ${JSON.stringify(focusable[0])}`);

                for (const el of shape.filter((e) => e.tabindex === null)) {
                    assert.deepEqual(el, {
                        tag: 'SPAN', role: null, tabindex: null, named: true,
                        hidden: null, glyphHidden: '⋯', active: el.active,
                    }, `an unreachable opener must stay a role-less span — saw ${JSON.stringify(el)}`);
                }

                const nodes = await axNodes(page);
                const asControl = nodes.filter((n) => n.name
                    && n.name.includes('More actions') && n.role === 'button');
                assert.equal(asControl.length, 1,
                    'exactly one of the openers is announced as a control — the reachable '
                    + `one. Saw ${JSON.stringify(asControl)}`);
            }));

        test('D21 — Enter on the opener opens that row\'s menu, and does not choose the row',
            () => onSelector(async (page) => {
                const before = await page.evalFn(() => window.__carry.selectedId?.() ?? null);

                const opened = await page.evalFn(async () => {
                    const root = document.querySelector('selector-screen').shadowRoot;
                    const opener = [...root.querySelectorAll('#rows .row-dots')]
                        .find((el) => el.getAttribute('tabindex') === '0');
                    if (!opener) return { reached: false };
                    opener.focus();
                    const focused = root.activeElement === opener;
                    opener.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', bubbles: true, composed: true, cancelable: true,
                    }));
                    const menu = opener.closest('ui-menu');
                    await menu?.updateComplete;
                    return {
                        reached: true,
                        focused,
                        open: !!menu?.open,
                        /* The component keeps this in step with its own open state, on
                         * whatever is slotted as the trigger. */
                        expanded: opener.getAttribute('aria-expanded'),
                        items: (menu?.items ?? []).length,
                    };
                });

                assert.equal(opened.reached, true, 'the active row offers a reachable opener');
                assert.equal(opened.focused, true, 'and a caret can land on it');
                assert.equal(opened.open, true, 'Enter opens the menu');
                assert.equal(opened.expanded, 'true', 'and the opener says so');
                assert.ok(opened.items > 0, 'the menu it opened has its rows');

                /* THE KEY DID NOT ALSO REACH THE TREE. Enter on the tree CHOOSES the
                 * active option, so without stopPropagation one keystroke would open a
                 * menu and load a profile. */
                const after = await page.evalFn(() => window.__carry.selectedId?.() ?? null);
                assert.equal(after, before, 'and the row was not chosen by the same press');
            }));

        test('D21 — the row name is STILL clean, with a reachable control inside it',
            () => onSelector(async (page) => {
                const nodes = await axNodes(page);
                const treeitems = nodes.filter((n) => n.role === 'treeitem').map((n) => n.name);
                assert.ok(treeitems.length > 0, 'the listing must be on the glass');
                assert.deepEqual(treeitems.filter((name) => name.includes('More actions')), [],
                    'a row announces its own content only, however operable the affordance '
                    + `inside it has become. Rows: ${JSON.stringify(treeitems)}`);
            }));
    });
}
