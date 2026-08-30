/**
 * editor-versions-name.render.test.mjs — THE VERSION ROW HAS A NAME (audit F-016, row 2).
 *
 * F-016 is the Wave 1 inventory of controls whose accessible name resolved to the empty
 * string under the plan's cascade (aria-label → aria-labelledby → &lt;label&gt; → title →
 * collapsed visible text). Sixteen rows; two of them are the editor's, and this is the one
 * that is not a chart well: the `ui-button` of a version record in the Previous versions
 * dialog, state `editor--steps`. The entry's own note says why it had nothing to inherit —
 * "its label is composed per record from a title and a timestamp, so no verbatim name
 * exists to copy".
 *
 * WHY THE NAME IS THE WHOLE ROW AND NOT JUST THE TITLE. Two versions of one profile
 * normally SHARE a title — that is what a version is — so a name built from the title alone
 * would name every row in the dialog identically, which is F-017's defect manufactured on
 * purpose. The date is the discriminator the row is drawn around, and the change line is
 * what tells apart two saves a minute apart.
 *
 * THE NAME IS READ OFF CHROME'S OWN ACCESSIBILITY TREE, not off the attribute. An attribute
 * assertion would pass against a name that never reaches the tree — a `label` on a host
 * that forgot to forward it, or a control hidden from the tree by an ancestor — which is
 * exactly the class of defect F-016 is an inventory of.
 *
 * A8: nothing here reads a source file.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditor, seatProfile, editingProfile } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const VERSIONS = 'editor-screen >>> #versions';

/** Two earlier versions of the seated record, sharing its title — the ordinary case. */
const RECORDS = [
    {
        id: 'profile:seated',
        profile: { ...editingProfile(), title: 'Morning ristretto' },
        updatedAt: '2026-08-24T09:00:00.000Z',
    },
    {
        id: 'profile:v1',
        profile: { ...editingProfile(), title: 'Morning ristretto', target_weight: 40 },
        updatedAt: '2026-08-24T08:32:00.000Z',
    },
    {
        id: 'profile:v0',
        profile: { ...editingProfile(), title: 'Morning ristretto', tank_temperature: 20 },
        updatedAt: '2026-08-23T14:05:00.000Z',
    },
];

/**
 * Hand the screen a library door holding a ready version list, and show the dialog.
 *
 * `#versionsBody` reads `boot.library.get().versions` and nothing else, so this is the
 * whole of what the dialog needs — no save loop, no transport. The dialog is SHOWN because
 * a closed `<ui-dialog>` wraps a closed native `<dialog>`, which is `display: none` and is
 * therefore absent from the accessibility tree; a name assertion against it would be
 * vacuous.
 */
async function showVersions(page) {
    await page.evalFn(async (sel, records) => {
        const screen = window.__h.need(sel);
        screen.boot = {
            ...screen.boot,
            library: { get: () => ({ versions: { status: 'ready', records } }) },
        };
        screen.requestUpdate();
        await screen.updateComplete;
        screen.renderRoot.querySelector('#versions').show({ reason: 'press' });
        await screen.updateComplete;
        return true;
    }, EDITOR.screen, RECORDS);
    await page.settle(6);
}

/** Every version row: its record id, its visible text, and Chrome's name for it. */
async function rows(page) {
    await page.send('Accessibility.enable');
    const count = await page.evalFn((sel) => {
        const body = window.__h.need(sel).renderRoot.querySelector('#versions .versions');
        window.__rows = body ? [...body.querySelectorAll('ui-button')] : [];
        return window.__rows.length;
    }, EDITOR.screen);

    const out = [];
    for (let i = 0; i < count; i += 1) {
        const { result } = await page.send('Runtime.evaluate', {
            expression: `window.__rows[${i}]`, returnByValue: false,
        });
        const { nodes } = await page.send('Accessibility.getPartialAXTree', {
            objectId: result.objectId, fetchRelatives: true,
        });
        const node = nodes.find((n) => n.role?.value === 'button') ?? null;
        const meta = await page.evalFn((n) => {
            const el = window.__rows[n];
            return { id: el.dataset.id ?? null, text: (el.textContent ?? '').trim() };
        }, i);
        out.push({ ...meta, name: (node?.name?.value ?? '').trim() });
    }
    return out;
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a version record is a named control (F-016 #2)', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: editingProfile() });
        await showVersions(page);
        return fn(page);
    });

    test('the dialog lists the OTHER versions, and every one has a name',
        () => staged(async (page) => {
            const listed = await rows(page);
            assert.equal(listed.length, 2,
                'the seated record is not one of its own previous versions');

            for (const row of listed) {
                assert.notEqual(row.name, '',
                    `version ${row.id} has no accessible name — this is the F-016 row`);
            }
            assert.deepEqual(page.pageErrors, []);
        }));

    test('the name carries the DATE, so two versions of one profile are told apart',
        () => staged(async (page) => {
            const listed = await rows(page);
            const names = listed.map((row) => row.name);
            assert.equal(new Set(names).size, names.length,
                'no two rows may announce the same sentence — they share a title by nature');
            for (const name of names) {
                assert.match(name, /\d/, 'a name with no date in it cannot discriminate');
            }
        }));

    test('the name is what the row says — one sentence, not a second one to drift',
        () => staged(async (page) => {
            for (const row of await rows(page)) {
                assert.equal(row.name, row.text,
                    'the announced name and the drawn face are composed from the same locals');
            }
        }));
});
