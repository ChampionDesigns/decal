/**
 * selector-row-actions-name.render.test.mjs — audit F-016 #8, on the real screen.
 *
 * WHY A NEW FILE, AND WHY IT IS THE SELECTOR'S SHAPE IN CLUSTER A'S SUITE. The finding
 * is a control on `selector-screen` — the `<ui-menu>` trigger at the end of every
 * profile row — but it could not be closed there. Naming that span renamed the ROW:
 * a `treeitem` with no explicit label is named from its contents, and a labelled
 * descendant is part of them, so the screen was choosing between an unnamed control and
 * seventy-eight rows announcing
 *
 *     "Alpha bloom Loaded More actions for Alpha bloom"
 *
 * The fix is in `ui-list-row` — a row whose list has given it a role now composes its
 * own `aria-label` from its own content, so name-from-content never runs and no
 * affordance can enter it. `ui-list-row.render.test.mjs` asserts that mechanism on a
 * synthetic row. THIS file asserts the thing the finding is actually about: that on the
 * screen where the control lives, in the composition it really ships in, BOTH halves are
 * true at once. Neither suite can see that alone.
 *
 * IT READS THE ENGINE, NOT THE MARKUP. `Accessibility.getFullAXTree` walks the flattened
 * tree and computes names the way a screen reader is told them — the only instrument
 * that can answer "what is this called", and the one cluster L used to measure the
 * regression that parked this finding the first time.
 *
 * Gate A, both standard geometries, on the shared carry fixture: a real `createAppBoot`,
 * the real stores, the real `<selector-screen>`.
 */

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

                /* BEFORE THIS FIX THERE WERE ZERO. The span carried `aria-hidden`, so the
                 * element that takes the press was hidden along with its ⋯ glyph — which
                 * is exactly what Wave 1 rowed: accessible name, the empty string. */
                assert.ok(named.length > 0,
                    `the openers must be named — saw ${JSON.stringify(nodes)}`);

                /* AND EACH NAMES ITS OWN ROW. "More actions" repeated down a listing is
                 * the E14 same-name shape (F-017); the name has to say which profile it
                 * would act on, which is the only reason it is worth announcing. */
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
                /* ROUND 1's ASSERTION, OVERRIDDEN BY BEN'S DECISION D21. It read:
                 *
                 *     assert.deepEqual(el, { tag: 'SPAN', role: null, tabindex: null,
                 *         named: true, hidden: null, glyphHidden: '⋯' },
                 *         'the opener must be a named, role-less, non-focusable span');
                 *
                 * applied to EVERY opener, and beneath it:
                 *
                 *     assert.deepEqual(unexpected, ['generic'],
                 *         'the openers are announced as named generics, never as controls:
                 *          a button or a role="button" here is a tab stop per row, which is
                 *          P12 and was once measured at 79 of them');
                 *
                 * Both were the right guard on a fix that only had to NAME the opener, and
                 * round 1's own note beside the template said what they cost: "STILL OPEN,
                 * and unchanged by this: THE KEYBOARD ROUTE." Remove for good is reachable
                 * by no other means, so an unreachable opener is not a safe end state — it
                 * is a control a keyboard cannot operate.
                 *
                 * WHAT D21 CHANGES IS THE NUMBER, NOT THE LAW. P12's complaint is 78
                 * operable nodes and 79 tab stops; the roving tabindex adds exactly ONE, on
                 * the row aria-activedescendant already names, and it moves with the arrow
                 * keys. Tab from the listing reaches the opener for the row you are
                 * standing on, and nothing else. */
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

                /* AND EVERY OTHER ONE IS EXACTLY WHAT ROUND 1 LEFT: the role is written
                 * only where the element is actually reachable, because an unlabelled
                 * focusable generic is worse than either end state and a role on something
                 * a caret cannot reach is a control that does not exist. */
                for (const el of shape.filter((e) => e.tabindex === null)) {
                    assert.deepEqual(el, {
                        tag: 'SPAN', role: null, tabindex: null, named: true,
                        hidden: null, glyphHidden: '⋯', active: el.active,
                    }, `an unreachable opener must stay a role-less span — saw ${JSON.stringify(el)}`);
                }

                /* AND THE TREE STILL HOLDS ONE CONTROL, NOT SEVENTY-EIGHT. */
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
                    /* aria-expanded IS WRITTEN IN THE COMPONENT'S OWN updated(), so it is
                     * one frame behind the property. Reading it without this measures the
                     * render loop rather than the announcement. */
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
                /* THE PROPERTY F-016 #8 PAID FOR, RE-MEASURED UNDER THE NEW SHAPE. Naming
                 * the opener once folded its name into the row's ("Alpha bloom Loaded More
                 * actions for Alpha bloom"); ui-list-row's self-naming is what stops it,
                 * and a focusable, ROLE-CARRYING descendant is a harder case than the named
                 * generic that policy was measured against. */
                const nodes = await axNodes(page);
                const treeitems = nodes.filter((n) => n.role === 'treeitem').map((n) => n.name);
                assert.ok(treeitems.length > 0, 'the listing must be on the glass');
                assert.deepEqual(treeitems.filter((name) => name.includes('More actions')), [],
                    'a row announces its own content only, however operable the affordance '
                    + `inside it has become. Rows: ${JSON.stringify(treeitems)}`);
            }));
    });
}
