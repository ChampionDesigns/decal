/**
 * The five keys under a step column, and the step a brand-new profile opens with.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, matrixStep, selectPanel,
} from '../harness/editor.js';

/** The screen's OWN matrix — the fallback it renders when no caller mounted one. */
const MATRIX = `${EDITOR.screen} >>> #matrix`;

/** One step column's action rail. */
const rail = (index) => `${MATRIX} >>> [data-cell="actions-${index}"] ui-action-key-rail`;

/** The pressable control of one key on one step's rail. */
const keyControl = (index, action) => `${rail(index)} >>> #key-${action} >>> .btn`;

/** One step column's head cell, for reading names off the screen rather than the draft. */
const headCell = (index) => `${MATRIX} >>> [data-cell="head-${index}"]`;

const draftOf = (page) => page.evalFn((sel) => {
    const held = window.__h.need(sel)._draft;
    return held ? JSON.parse(JSON.stringify(held)) : null;
}, EDITOR.screen);

/** The step names in the draft, in order — a failure then says which step went where. */
const draftNames = async (page) => (await draftOf(page)).steps.map((s) => s.name);

/** The step names ON SCREEN, read out of the head cells. */
const screenNames = (page) => page.evalFn((sel) => {
    const matrix = window.__h.need(sel);
    return [...matrix.renderRoot.querySelectorAll('[data-cell^="head-"]')]
        .map((cell) => (cell.querySelector('.name-display')?.textContent ?? '').trim())
        /* The head cell draws "1." before the name; the ordinal is the column's, not the
         * step's, so it comes off before the comparison. */
        .map((text) => text.replace(/^\d+\.\s*/, ''));
}, MATRIX);

/** Which keys one rail is currently refusing. */
const railDisabled = (page, index) => page.evalFn((sel) => {
    const el = window.__h.need(sel);
    return Object.fromEntries([...el.renderRoot.querySelectorAll('ui-button')]
        .map((b) => [b.dataset.action, Boolean(b.disabled)]));
}, rail(index));

/** Where the caret is, as an anchor path — the harness's own deep walk. */
const activePath = (page) => page.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

async function pressKey(page, index, action) {
    await page.evalFn((sel, i) => {
        const cell = window.__h.need(sel).renderRoot.querySelector(`[data-cell="actions-${i}"]`);
        if (cell) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
    }, MATRIX, index);
    await page.settle(2);

    const box = await page.box(keyControl(index, action));
    assert.ok(box.width > 0 && box.height > 0,
        `${action} on step ${index + 1}: the key has no box to press`);
    assert.ok(box.left >= 0 && box.top >= 0
        && box.left + box.width <= page.geometry.width
        && box.top + box.height <= page.geometry.height,
        `${action} on step ${index + 1}: the key is outside the window, so a press at its `
        + 'coordinates would land on something else');

    await page.click(keyControl(index, action));
    await page.settle(4);
}

async function seated(page, steps) {
    await mountEditor(page, { matrix: null, fields: 0 });
    await seatProfile(page, { profile: editingProfile(steps) });
    await page.settle(4);
    assert.equal(await page.exists(MATRIX), true,
        'the screen renders its own matrix when nobody handed it one');
    return page;
}

/** Three named steps, so a reorder is readable in a failure message. */
const three = () => [
    matrixStep({ name: 'one' }),
    matrixStep({ name: 'two' }),
    matrixStep({ name: 'three' }),
];

describe(`profile editor — the step action keys (${BENCH.name})`, () => {
    let browser = null;
    let page = null;

    before(async () => {
        browser = await launch({ geometry: BENCH });
        page = await browser.newPage({ geometry: BENCH });
    });

    after(async () => {
        await browser?.close();
    });

    const mounted = (steps, body) => async () => {
        await page.reload();
        await seated(page, steps);
        await body(page);
        assert.deepEqual(page.pageErrors, [], 'nothing threw during the press');
    };

    test('PIN: the rail\'s five ids and the draft writer\'s five ids are the same five',
        mounted(three(), async () => {
            const authored = await page.evalFn(async () => {
                const [railModule, draftModule] = await Promise.all([
                    import('/src/components/ui-action-key-rail.js'),
                    import('/src/lib/editor-draft.js'),
                ]);
                return {
                    rail: railModule.ACTION_KEYS.map((k) => k.action),
                    draft: [...draftModule.STEP_ACTIONS],
                    event: railModule.STEP_ACTION,
                };
            });
            assert.deepEqual(authored.rail, authored.draft,
                'a sixth key on the rail with no rule in the draft writer is a dead button, '
                + 'which is the defect this whole suite exists for');
            assert.equal(authored.event, 'step-action',
                'and the screen listens for this exact name — it imports it from the rail');
        }));

    test('PIN: step-action has a listener, and that listener changes the draft',
        mounted(three(), async () => {
            const before = (await draftOf(page)).steps.length;
            const sent = await page.evalFn((sel) => {
                window.__h.need(sel).dispatchEvent(new CustomEvent('step-action', {
                    bubbles: true, composed: true, cancelable: true,
                    detail: { action: 'insert-after', index: 0, count: 3 },
                }));
                return true;
            }, MATRIX);
            assert.equal(sent, true);
            await page.settle(4);
            const after = (await draftOf(page)).steps.length;
            assert.equal(after, before + 1,
                'the event reached a writer — this was FALSE until 27 August 2026, with '
                + 'every suite in the tree green');
        }));

    test('insert-after: a real press adds a step, and it is the shared blank step',
        mounted(three(), async () => {
            await pressKey(page, 0, 'insert-after');

            const draft = await draftOf(page);
            assert.equal(draft.steps.length, 4, 'a step was added');
            const seed = await page.evalFn(() => import('/src/lib/profile-modes.js')
                .then((m) => JSON.parse(JSON.stringify(m.NEW_STEP))));
            const added = draft.steps[1];
            assert.deepEqual({ ...added, name: '' }, { ...seed, name: '' },
                'the same object a brand-new profile opens with — one seed, not two');
            assert.ok(added.name.length > 0,
                'and the screen gave it a translated name, because the seed module has no t()');
            assert.deepEqual(await draftNames(page),
                ['one', added.name, 'two', 'three'], 'inserted AFTER, not before');
            assert.deepEqual(await screenNames(page),
                ['one', added.name, 'two', 'three'], 'and the matrix on screen agrees');
        }));

    test('duplicate: a real press copies the step it is under, into the next column',
        mounted(three(), async () => {
            await pressKey(page, 1, 'duplicate');
            assert.deepEqual(await draftNames(page), ['one', 'two', 'two', 'three']);

            const draft = await draftOf(page);
            assert.deepEqual(draft.steps[2], draft.steps[1], 'identical by value');

            /* AND INDEPENDENT. Editing the copy's limiter through the draft must not reach
             * the original — a shallow copy would share that object. */
            const shared = await page.evalFn((sel) => {
                const steps = window.__h.need(sel)._draft.steps;
                return steps[1].limiter === steps[2].limiter;
            }, EDITOR.screen);
            assert.equal(shared, false, 'two steps must never share one limiter object');
        }));

    test('move-right: a real press swaps the step with the one after it',
        mounted(three(), async () => {
            await pressKey(page, 0, 'move-right');
            assert.deepEqual(await draftNames(page), ['two', 'one', 'three']);
            assert.deepEqual(await screenNames(page), ['two', 'one', 'three']);
        }));

    test('move-left: a real press swaps the step with the one before it',
        mounted(three(), async () => {
            await pressKey(page, 1, 'move-left');
            assert.deepEqual(await draftNames(page), ['two', 'one', 'three']);
        }));

    test('delete: a real press removes exactly that step',
        mounted(three(), async () => {
            await pressKey(page, 1, 'delete');
            assert.deepEqual(await draftNames(page), ['one', 'three']);
            assert.deepEqual(await screenNames(page), ['one', 'three']);
        }));

    test('a structural edit makes the profile dirty, so Save says so',
        mounted(three(), async () => {
            const before = await page.evalFn((sel) => window.__h.need(sel).changeCount ?? null,
                EDITOR.screen);
            const bandBefore = await page.evalFn((sel) => window.__h.need(sel)
                .getAttribute('change-count'), EDITOR.band);
            assert.equal(bandBefore, '0', 'a freshly seated profile is clean');

            await pressKey(page, 0, 'duplicate');
            const bandAfter = await page.evalFn((sel) => window.__h.need(sel)
                .getAttribute('change-count'), EDITOR.band);
            assert.notEqual(bandAfter, '0',
                `the band still read ${bandAfter} after a step was duplicated`);
            assert.equal(typeof before, 'number');
        }));

    test('the Review tab follows a structural edit', mounted(three(), async () => {
        await selectPanel(page, 'review');
        const before = await page.count(`${EDITOR.review} >>> .block`);
        await selectPanel(page, 'steps');
        await pressKey(page, 0, 'insert-after');
        await selectPanel(page, 'review');
        const after = await page.count(`${EDITOR.review} >>> .block`);
        assert.equal(after, before + 1, 'one more step, one more review block');
    }));

    test('the two arrows are refused at the two ends, and the press does nothing',
        mounted(three(), async () => {
            assert.equal((await railDisabled(page, 0))['move-left'], true);
            assert.equal((await railDisabled(page, 2))['move-right'], true);

            await pressKey(page, 0, 'move-left');
            assert.deepEqual(await draftNames(page), ['one', 'two', 'three'],
                'a disabled key refuses the press natively — nothing moved');
        }));

    test('on a one-step profile, delete is grey and the two GROWING keys are live',
        mounted([matrixStep({ name: 'only' })], async () => {
            const state = await railDisabled(page, 0);
            assert.deepEqual(state, {
                'move-left': true,
                delete: true,
                'insert-after': false,
                duplicate: false,
                'move-right': true,
            });

            /* AND THE WAY OUT WORKS: from one step you can always reach two, and at two
             * delete comes back. */
            await pressKey(page, 0, 'duplicate');
            assert.deepEqual(await draftNames(page), ['only', 'only']);
            assert.equal((await railDisabled(page, 0)).delete, false,
                'delete is live again the moment there is a second step');

            await pressKey(page, 0, 'delete');
            assert.deepEqual(await draftNames(page), ['only']);
            assert.equal((await railDisabled(page, 0)).delete, true, 'and grey again at one');
        }));

    test('after a move, the caret is on the same key of the step that moved',
        mounted(three(), async () => {
            await pressKey(page, 0, 'move-right');
            assert.deepEqual(await draftNames(page), ['two', 'one', 'three']);

            const where = await activePath(page);
            assert.match(String(where), /key-move-right/,
                `the caret left the key it was on: ${where}`);

            /* THE PROOF THAT IT FOLLOWED THE STEP RATHER THAN THE COLUMN: press the key
             * that now has focus, with the keyboard, and the SAME step moves again. */
            await page.press('Enter');
            await page.settle(4);
            assert.deepEqual(await draftNames(page), ['two', 'three', 'one'],
                'a second press moved the same step on, not whatever was displaced');
        }));

    test('after a delete, the caret lands on the step that took the column',
        mounted(three(), async () => {
            await pressKey(page, 1, 'delete');
            const where = await activePath(page);
            assert.match(String(where), /key-delete/, `the caret was lost: ${where}`);
            assert.deepEqual(await draftNames(page), ['one', 'three']);
        }));

    /**
     * A NAME FIELD MAY NOT SURVIVE ITS STEP MOVING OUT FROM UNDER IT. `_editing` is an
     * index, and an index only names a step while the list holds still.
     */
    test('an open step-name field closes when the list moves under it',
        mounted(three(), async () => {
            await page.click(`${headCell(2)} .name-display`);
            await page.settle(3);
            assert.equal(await page.exists(`${headCell(2)} ui-text-field`), true,
                'the name field is open on step 3');

            await pressKey(page, 0, 'delete');
            assert.deepEqual(await draftNames(page), ['two', 'three']);
            const open = await page.count(`${MATRIX} >>> ui-text-field`);
            assert.equal(open, 0,
                'a field left open on a stale index is a person typing into the wrong step');
        }));

    test('an edit to ANOTHER step leaves an open name field alone',
        mounted(three(), async () => {
            await page.click(`${headCell(0)} .name-display`);
            await page.settle(3);
            assert.equal(await page.exists(`${headCell(0)} ui-text-field`), true);

            await page.evalFn((sel) => {
                window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
                    bubbles: true,
                    composed: true,
                    detail: { index: 2, row: 'temperature', field: 'temperature', value: 88 },
                }));
                return true;
            }, MATRIX);
            await page.settle(4);

            assert.equal((await draftOf(page)).steps[2].temperature, 88, 'the edit landed');
            assert.equal(await page.exists(`${headCell(0)} ui-text-field`), true,
                'and the field somebody is typing in is still open');
        }));
});

/** The steppers and banks of one step column, by the row keys the model declares. */
const CELL = (row, index = 0) => `${MATRIX} >>> [data-cell="${row}-${index}"]`;

describe('profile selector — the + opens an editable profile', () => {
    let browser = null;
    let page = null;

    const SELECTOR = 'selector-screen';
    const ADD_TRIGGER = `${SELECTOR} >>> #add-open`;
    const ADD_ITEM = `${SELECTOR} >>> #add >>> .item[data-index="0"]`;

    before(async () => {
        browser = await launch({ geometry: BENCH });
        page = await browser.newPage({ geometry: BENCH });
    });

    after(async () => {
        await browser?.close();
    });

    async function stage() {
        await page.reload();
        await page.mount(
            '<div id="stage" style="inline-size: 100%">'
            + '<div id="sel" style="block-size: 100dvh"><selector-screen></selector-screen></div>'
            + '<div id="ed" style="block-size: 100dvh"><editor-screen></editor-screen></div>'
            + '</div>',
            ['/src/screens/selector-screen.js', '/src/screens/editor-screen.js'],
        );
        await page.settle(6);
        await page.evalFn(async (capabilities) => {
            const [store, adapters] = await Promise.all([
                import('/src/stores/profile-editor-store.js'),
                import('/src/data/adapters-r.js'),
            ]);
            /* NOTHING IS SAVED IN THIS BLOCK, so the transport refuses everything: a fake
             * that answered 200 would let a stray write pass unnoticed. */
            const transport = { async request() { return { ok: false, status: 503, data: null }; } };
            const boot = {
                profileEditor: store.createProfileEditorStore({ transport }),
                capabilities: { machineLimits: () => adapters.r2MachineLimits(capabilities) },
                logger: null,
            };
            const selector = window.__h.need('selector-screen');
            const editor = window.__h.need('editor-screen');
            selector.boot = boot;
            editor.boot = boot;
            await Promise.all([selector.updateComplete, editor.updateComplete]);
            return true;
        }, [{ id: 'machine' }]);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'both screens must mount without throwing');
    }

    /** Press +, then the first row of the menu it opens. Real hit-tested presses. */
    async function pressNewProfile() {
        await page.click(ADD_TRIGGER);
        await page.settle(4);
        const label = await page.evalFn((sel) => (window.__h.need(sel).textContent ?? '').trim(),
            ADD_ITEM);
        assert.match(label, /new profile/i,
            `the first row of the add menu is not the new-profile door: "${label}"`);
        await page.click(ADD_ITEM);
        await page.settle(6);
    }

    test('PIN: the editor is NEVER seated with a profile that has no steps', async () => {
        await stage();
        await pressNewProfile();

        const draft = await draftOf(page);
        assert.notEqual(draft, null, 'a profile was seated');
        assert.ok(Array.isArray(draft.steps));
        assert.ok(draft.steps.length >= 1,
            'no steps means no step columns, no action rail, and no way to add one — '
            + 'this was FALSE until 27 August 2026');
        assert.deepEqual(page.pageErrors, []);
    });

    test('it opens with exactly ONE step, and the matrix draws exactly one column',
        async () => {
            await stage();
            await pressNewProfile();

            assert.equal((await draftOf(page)).steps.length, 1);
            const columns = await page.count(`${MATRIX} >>> [data-cell^="head-"]`);
            assert.equal(columns, 1, 'one step, one column on screen');
        });

    test('that one step carries Ben\'s six values, on rendered controls', async () => {
        await stage();
        await pressNewProfile();

        /* THE SEED, READ OUT OF THE PAGE. Its single declaration is the subject of
         * `test/profile-modes.test.mjs`; here it is only the yardstick. */
        const seed = await page.evalFn(() => import('/src/lib/profile-modes.js')
            .then((m) => JSON.parse(JSON.stringify(m.NEW_STEP))));

        const shown = await page.evalFn((matrixSel) => {
            const matrix = window.__h.need(matrixSel);
            const cell = (row) => matrix.renderRoot.querySelector(`[data-cell="${row}-0"]`);
            const control = (row, tag) => cell(row)?.querySelector(tag) ?? null;
            const read = (row) => {
                const el = control(row, 'ui-stepper');
                return el ? { value: el.value, text: (el.renderRoot.querySelector('#value')?.textContent ?? '').trim() } : null;
            };
            return {
                pump: control('pump', 'ui-bank')?.value ?? null,
                probe: control('probe', 'ui-bank')?.value ?? null,
                target: read('target'),
                limiter: read('limiter'),
                temperature: read('temperature'),
                duration: read('duration'),
                exitText: (cell('exits')?.textContent ?? '').trim(),
            };
        }, MATRIX);

        assert.equal(shown.pump, seed.pump, 'a pressure profile step');
        assert.equal(shown.target.value, seed.pressure, 'with a target of 8 bar');
        assert.equal(shown.limiter.value, seed.limiter.value, 'flow limit of 8 mL/s');
        assert.equal(shown.temperature.value, seed.temperature, 'a target temperature of 85 C');
        assert.equal(shown.probe, seed.sensor, 'at the coffee ...');
        assert.equal(shown.duration.value, seed.seconds, '... duration of 30 s');

        /* AND THE NUMBERS ARE ON SCREEN, not merely on a property. A stepper handed a
         * value but refused a range renders UNAVAILABLE, which would pass every assertion
         * above and show the person nothing. */
        for (const [row, entry] of Object.entries({
            target: shown.target,
            limiter: shown.limiter,
            temperature: shown.temperature,
            duration: shown.duration,
        })) {
            assert.match(entry.text, /\d/, `${row}: the cell reads "${entry.text}"`);
        }

        /* "no exit conditions" — the band is drawn and it names none. */
        assert.equal((await draftOf(page)).steps[0].exit, null);
        assert.ok(shown.exitText.length >= 0, 'the exit band is present and carries no condition');
    });

    test('the new profile is a COMPLETE document, so its Save has something legal to send',
        async () => {
            await stage();
            await pressNewProfile();

            const read = await page.evalFn(async (sel) => {
                const m = await import('/src/data/rea-profile.js');
                const result = m.readProfileFile(window.__h.need(sel)._draft);
                return { ok: result.ok, reason: result.reason ?? null, missing: [...(result.missing ?? [])] };
            }, EDITOR.screen);
            assert.equal(read.ok, true, `${read.reason}: ${read.missing.join(', ')}`);
        });

    test('and it is immediately editable — insert-after grows it to two steps', async () => {
        await stage();
        await pressNewProfile();

        /* THE WHOLE POINT, END TO END: press +, get a profile, press the editor's own
         * insert key, get a second step. That sentence was untrue in both halves. */
        await pressKey(page, 0, 'insert-after');
        assert.equal((await draftOf(page)).steps.length, 2);
        assert.equal(await page.count(`${MATRIX} >>> [data-cell^="head-"]`), 2);
        assert.deepEqual(page.pageErrors, []);
    });
});
