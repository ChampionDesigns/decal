/**
 * editor-add-step-aria.render.test.mjs — THE ADD DOOR SITS IN A LEGAL ARIA SLOT (D05).
 *
 * Ben, 30 August 2026, reviewing the first round's stated departure — F-033 shipped the
 * add-step door as a `<button>` loose inside `role="table"` and said so in the source:
 *
 *   "the add-step door must sit in a LEGAL ARIA slot, not as a button loose inside
 *    role=table. Rework the matrix roles so the door is reachable AND strict."
 *
 * The strict reading of `table` takes ROWS and row groups as its children and nothing
 * else, so a control among them is a shape nobody is promised. Two known-good shapes were
 * named: put the door outside the table element, or give the table a real row/cell wrapper
 * for it. **The door is outside the table** — the rows now live in their own `role="table"`
 * element inside the matrix's shadow root and the door is that element's sibling. It adds
 * a COLUMN, not a row, and belongs to no row, so a row/cell wrapper would have announced a
 * table position it does not occupy.
 *
 * WHAT THIS FILE MEASURES, and every claim is Chrome's own accessibility tree:
 *   1. the table's AX children are ALL rows — nothing else is in there;
 *   2. the door is in the tree, named, a button, and NOT a descendant of the table;
 *   3. the table still has its ten rows, its headers and its cells, and its name;
 *   4. a zero-step profile exposes NO table at all (an empty `role="table"` is the same
 *      violation from the other side) and still reaches the door, by keyboard;
 *   5. a read-only matrix exposes the table and no control.
 *
 * F-033's own behaviours are asserted by `editor-add-step.render.test.mjs` and are not
 * repeated here; this file is about the shape a screen reader is handed.
 *
 * A8: no assertion reads a source file. The tree comes from `Accessibility.getFullAXTree`,
 * the boxes from the layout, the focus from a real Tab.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { mountEditor, seatProfile, editingProfile, matrixStep } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const MATRIX = 'editor-screen >>> #matrix';
const ADD = `${MATRIX} >>> #add-step`;

/** ARIA's own list of what may be a child of `role="table"`. */
const TABLE_CHILD_ROLES = ['row', 'rowgroup'];

/**
 * THE WHOLE TREE, WITH ITS EDGES — parent and child ids kept, which is the difference
 * between this and the harness's `accessibleNames` (that one flattens to role+name).
 * Containment is the claim here, so the edges are the evidence.
 */
async function axTree(page) {
    await page.send('Accessibility.enable');
    const { nodes } = await page.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const role = (n) => n?.role?.value ?? '';
    const name = (n) => n?.name?.value ?? '';
    /** Walk to the root, skipping nothing — an ignored node still nests its children. */
    const ancestors = (node) => {
        const out = [];
        let cur = byId.get(node.parentId);
        while (cur) { out.push(cur); cur = byId.get(cur.parentId); }
        return out;
    };
    /** The children a screen reader is given: ignored nodes are transparent. */
    const exposedChildren = (node) => {
        const out = [];
        const walk = (ids) => {
            for (const id of ids ?? []) {
                const child = byId.get(id);
                if (!child) continue;
                if (child.ignored) walk(child.childIds);
                else out.push(child);
            }
        };
        walk(node.childIds);
        return out;
    };
    return {
        nodes,
        role,
        name,
        ancestors,
        exposedChildren,
        all: (r) => nodes.filter((n) => !n.ignored && role(n) === r),
        one: (r) => {
            const found = nodes.filter((n) => !n.ignored && role(n) === r);
            assert.equal(found.length, 1, `expected exactly one ${r}, found ${found.length}`);
            return found[0];
        },
    };
}

/** The door's own AX node, found by name rather than by markup. */
const doorOf = (tree) => tree.all('button').find((n) => tree.name(n) === 'Add a step') ?? null;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the add door is reachable AND strict (D05)', () => {
    const staged = (steps, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: { ...editingProfile(), steps } });
        return fn(page);
    });

    const three = () => [
        matrixStep({ name: 'one' }),
        matrixStep({ name: 'two', pump: 'pressure', pressure: 9 }),
        matrixStep({ name: 'three' }),
    ];

    test('EVERY child of the table is a row — the door is not among them',
        () => staged(three(), async (page) => {
            const tree = await axTree(page);
            const table = tree.one('table');
            assert.equal(tree.name(table), 'Profile steps', 'and the table is still named');

            const children = tree.exposedChildren(table).map((n) => ({
                role: tree.role(n), name: tree.name(n),
            }));
            assert.ok(children.length > 0, 'a table with no children is the same fault inverted');
            const illegal = children.filter((c) => !TABLE_CHILD_ROLES.includes(c.role));
            assert.deepEqual(illegal, [],
                'role="table" takes rows and row groups and nothing else — F-033 shipped a '
                + 'button in here');
        }));

    test('the door IS in the tree, named, and outside the table',
        () => staged(three(), async (page) => {
            const tree = await axTree(page);
            const door = doorOf(tree);
            assert.ok(door, 'the door must be in the tree at all — reachable is half the ask');
            assert.equal(tree.role(door), 'button', 'a control, not a paint');

            const lineage = tree.ancestors(door).map((n) => tree.role(n));
            assert.equal(lineage.includes('table'), false,
                `the door is still inside a table: ${lineage.join(' < ')}`);
            assert.equal(lineage.includes('row'), false, 'and it is inside no row');
            assert.equal(lineage.includes('cell'), false, 'and it is no table cell');
        }));

    test('the table semantics are intact — ten rows, headers, cells, one name',
        () => staged(three(), async (page) => {
            const tree = await axTree(page);
            const table = tree.one('table');

            const rows = tree.exposedChildren(table);
            assert.equal(rows.length, 10, 'the ten rows the model declares, and no eleventh');
            for (const row of rows) {
                const cells = tree.exposedChildren(row).map((n) => tree.role(n));
                assert.ok(cells.length > 0, 'a row with no cells');
                const strays = cells.filter(
                    (r) => !['cell', 'gridcell', 'columnheader', 'rowheader'].includes(r),
                );
                assert.deepEqual(strays, [], 'a row takes cells and nothing else');
            }

            assert.equal(tree.all('rowheader').length, 9, 'nine row headers');
            assert.equal(tree.all('columnheader').length, 1 + 3, 'and the head row');
        }));

    test('the HOST is no longer a table, so the door has somewhere legal to stand',
        () => staged(three(), async (page) => {
            const host = await page.evalFn((sel) => {
                const el = window.__h.need(sel);
                return {
                    role: el.getAttribute('role'),
                    label: el.getAttribute('aria-label'),
                    inner: el.renderRoot.querySelector('[role="table"]')?.getAttribute('aria-label')
                        ?? null,
                    doorIsSibling: el.renderRoot.querySelector('#add-step')?.parentNode
                        === el.renderRoot,
                };
            }, MATRIX);
            assert.equal(host.role, null,
                'the table role moved off the host — everything in this shadow root is a '
                + 'child of the host, so a table role here has no legal siblings');
            assert.equal(host.label, null, 'and the name went with it, so it is not said twice');
            assert.equal(host.inner, 'Profile steps', 'the rows carry the named table');
            assert.equal(host.doorIsSibling, true, 'the door stands beside it');
        }));

    test('FROM ZERO STEPS there is no empty table, and the door is still reached by keyboard',
        () => staged([], async (page) => {
            const tree = await axTree(page);
            assert.deepEqual(tree.all('table').map((n) => tree.name(n)), [],
                'role="table" with no rows is aria-required-children from the other side — '
                + 'which is what the host was every time a profile arrived with no steps');

            const door = doorOf(tree);
            assert.ok(door, 'and the only control on this profile is still in the tree');

            /* REACHED BY A REAL TAB, from the top of the document — the zero-step profile
             * is the one where "reachable" had to be argued for, so it is measured rather
             * than assumed. */
            await page.evalFn(() => { document.body.focus(); });
            let landed = false;
            for (let i = 0; i < 40 && !landed; i += 1) {
                await page.press('Tab');
                landed = await page.evalFn((sel) => {
                    const active = window.__h.deepActiveElement();
                    return active === window.__h.need(sel).renderRoot.querySelector('#add-step');
                }, MATRIX);
            }
            assert.equal(landed, true, 'Tab never reached the door');
        }));

    test('a read-only matrix exposes the table and no control at all',
        () => staged(three(), async (page) => {
            await page.evalFn(async (sel) => {
                const host = window.__h.need(sel);
                host.editable = false;
                await host.updateComplete;
            }, MATRIX);
            await page.settle(3);

            const tree = await axTree(page);
            const table = tree.one('table');
            assert.equal(tree.exposedChildren(table).length, 10, 'the rows are still rows');
            assert.equal(doorOf(tree), null, 'and no door is offered');
        }));
});
