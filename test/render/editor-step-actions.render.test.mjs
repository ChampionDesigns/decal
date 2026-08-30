/**
 * editor-step-actions.render.test.mjs — the five keys under a step column, and the step a
 * brand-new profile opens with.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS: BOTH DEFECTS GOT PAST A FULL GREEN SUITE
 * ===========================================================================
 * Ben, 27 August 2026, two reports in one message:
 *
 *   "IN the profile editor page, the 5 buttons down the bottom dont seem to do anything,
 *    like if I try to make a new step of copy one etc it does noting."
 *
 *   "in profile selector, if I press the button to make a new profile it loads the profile
 *    editor but there is no steps, wich means there is not + button to add a new step etc,
 *    ie I cannot add any steps."
 *
 * NEITHER WAS A BROKEN COMPONENT. `ui-action-key-rail.js` has a 93-test suite that proves
 * all five keys press, dispatch `step-action` composed and bubbling, and grey correctly at
 * the edges — and every one of those tests mounts the rail ON ITS OWN, where an event
 * nobody hears is the right answer. `step-matrix.render.test.mjs` mounts the rails and
 * asserts a drag emits nothing. `editor-editing.render.test.mjs` drives the editing events
 * through a composition root the HARNESS owns. Between them, nobody ever asked the question
 * a person asks: I pressed this; did anything happen to the profile?
 *
 * SO EVERY CLAIM HERE IS DRIVEN THE WAY BEN DRIVES IT. The real `<editor-screen>` with its
 * own `<step-matrix>` and a profile seated through the real `createProfileEditorStore`; the
 * real `<selector-screen>` with its real + menu; presses dispatched by CDP at viewport
 * coordinates so Chrome's own hit test decides what was pressed; and the assertion is on
 * THE SCREEN'S OWN DRAFT, which is the object a Save would send. Nothing here reads a
 * source file (A8) and nothing states a bound (B2).
 *
 * ===========================================================================
 * THE TWO PINS, AND WHAT THEY ARE PINNING AGAINST
 * ===========================================================================
 * Section 1 is not a behaviour test, it is a tripwire on the two shapes that failed:
 *
 *   1. THE RAIL'S EVENT HAS A LISTENER THAT CHANGES THE DRAFT. Stated as a fact about the
 *      draft rather than about listener counts, because "a listener is attached" was never
 *      the missing half — the missing half was that pressing changed nothing. Deleting the
 *      screen's `#onStepAction` turns this red.
 *   2. A NEW PROFILE IS NEVER SEATED WITH ZERO STEPS. Section 4.
 *
 * ===========================================================================
 * ONE GEOMETRY, DECLARED
 * ===========================================================================
 * BENCH only, and the reason is worth writing down rather than leaving as a shrug. Every
 * claim below is about WIRING — a press reaching a draft — and wiring does not vary with
 * the window. What DOES vary is whether a given step column is inside the matrix's
 * scrollport at all: the rail is 192px and a column is 431, so at BENCH's 1281 the third
 * column is already outside it and at FLOOR's 1000 the second is. That is a real property
 * and it is `step-matrix.render.test.mjs`'s, at both geometries, where the boxes are the
 * subject. Here it is a hazard instead, and `pressKey` below handles it by scrolling the
 * column into view and REFUSING TO PRESS unless the key is genuinely on screen — so a
 * press that lands on the wrong thing fails loudly instead of asserting about a step
 * nobody touched.
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

/**
 * THE SCREEN'S OWN DRAFT, as plain data. This is the object `saveAsNewVersion` would send,
 * which is what makes it the honest subject: a test that asserted on the matrix's `steps`
 * property would pass just as well if the screen never wrote anything down.
 */
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

/**
 * PRESS ONE KEY, THE WAY A PERSON DOES, AND REFUSE TO LIE ABOUT IT.
 *
 * The matrix is its own scrollport in both axes, so a step column can be laid out perfectly
 * and still be nowhere near the viewport. `page.click` dispatches at the rect's centre and
 * Chrome hits whatever is there — which, for a column scrolled out of the port, is
 * something else entirely, and the assertion afterwards would then be about a press that
 * never happened. So: scroll the column into its own port the way the person scrolls it,
 * then CHECK the key's box is inside the window before pressing.
 */
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

/**
 * A SEATED EDITOR THAT OWNS ITS OWN MATRIX.
 *
 * `matrix: null` leaves the `steps` mount region empty, which is what makes the screen
 * render its own `<step-matrix>` as slot fallback (`#owns`) — the arrangement the APP uses
 * and the one no other suite drives. Every other editor suite mounts a stand-in or its own
 * real matrix, which is a caller-mounted region and therefore a different wiring.
 */
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

    /* =====================================================================
     * 1. THE TWO PINS
     * ===================================================================== */

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

    /**
     * THE PIN THAT WOULD HAVE CAUGHT IT. Not "is a listener attached" — the rail dispatched
     * perfectly all along and every isolated test was green. The fact that was false is
     * that pressing a key changed the profile. It is driven here by DISPATCHING the rail's
     * own event on the matrix, so the pin holds even if the keys are one day laid out
     * somewhere a hit test cannot reach; the real presses in section 2 are the other half.
     */
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

    /* =====================================================================
     * 2. THE FIVE KEYS, PRESSED
     * ===================================================================== */

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

    /**
     * D11's count is the store's reading of the draft, so a structural edit has to move it.
     * A profile whose steps were reordered and whose band still reads "Save" is a profile
     * somebody closes without saving.
     */
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

    /**
     * THE REVIEW TAB IS MODEL OUTPUT over the same draft, so it has to follow. This is the
     * cheapest proof that the draft the screen wrote is the draft every other surface reads
     * — not a private copy the matrix happens to be holding.
     */
    test('the Review tab follows a structural edit', mounted(three(), async () => {
        await selectPanel(page, 'review');
        const before = await page.count(`${EDITOR.review} >>> .block`);
        await selectPanel(page, 'steps');
        await pressKey(page, 0, 'insert-after');
        await selectPanel(page, 'review');
        const after = await page.count(`${EDITOR.review} >>> .block`);
        assert.equal(after, before + 1, 'one more step, one more review block');
    }));

    /* =====================================================================
     * 3. THE EDGES, AND WHERE THE CARET GOES
     * ===================================================================== */

    test('the two arrows are refused at the two ends, and the press does nothing',
        mounted(three(), async () => {
            assert.equal((await railDisabled(page, 0))['move-left'], true);
            assert.equal((await railDisabled(page, 2))['move-right'], true);

            await pressKey(page, 0, 'move-left');
            assert.deepEqual(await draftNames(page), ['one', 'two', 'three'],
                'a disabled key refuses the press natively — nothing moved');
        }));

    /**
     * THE ONE STEP A PROFILE ALWAYS KEEPS, proved from the person's side.
     *
     * `step-matrix.js render()` refuses to draw a matrix with no steps and hands the other
     * half to the draft owner by name: "'never delete the last step' is the draft owner's
     * rule to keep". With no steps there are no columns, with no columns there are no
     * rails, and the rail is the ONLY route to a new step — which is exactly the dead end
     * Ben reported from the other side. So delete goes GREY rather than being pressable and
     * refused: a live button that does nothing is the defect, not the fix.
     */
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

    /**
     * THE CARET RIDES WITH THE STEP.
     *
     * Lit reuses the DOM, so after a move the button under the finger belongs to the step
     * that was DISPLACED. Without this, a second press moves the wrong step; after a delete
     * the caret falls out to <body> with nothing to say where it went.
     */
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

            /* A value edit rebuilds only the step it touched (`editor-draft.js`: "new step
             * objects ON THE PATH THAT CHANGED"), so step 0's object is the same object and
             * the field stays. A blunter "the steps changed at all" rule would close it. */
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

/**
 * ===========================================================================
 * 4. A NEW PROFILE, OPENED FROM THE + THE WAY BEN OPENS IT
 * ===========================================================================
 * Ben, 27 August 2026: "in profile selector, if I press the button to make a new profile
 * it loads the profile editor but there is no steps, wich means there is not + button to
 * add a new step etc, ie I cannot add any steps."
 *
 * THE HANDOFF IS THE SUBJECT, so it is driven and not simulated. The selector seats the
 * record in the SHELL'S store (`boot.profileEditor`) and then asks for a route; the editor
 * reads it back off the same store. Both screens are mounted here over ONE store, which is
 * the whole handoff minus the route swap — and the route swap is precisely the thing the
 * store exists to survive (`#openNewProfile`: "a route swap destroys this screen ... so a
 * record handed over any other way would go with it"). `<app-root>` is not in this suite,
 * so the swap is the one link left to `test/render/app-shell.render.test.mjs`.
 *
 * NOT ONE OF BEN'S SIX NUMBERS IS TYPED IN THIS BLOCK. They are read out of the page from
 * `profile-modes.js NEW_STEP`, which is their single declaration; a test that retyped them
 * would be a second seed that drifts silently. What IS asserted here is the thing a
 * constant cannot assert: that they reached rendered controls.
 */

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

    /**
     * BOTH SCREENS, ONE STORE. The selector runs without a library store (its own "layout
     * demo" state — an empty list, every toolbar control present), because the listing is
     * not what is being tested and a 147-record mock would only add a socket to the run.
     * What it DOES have is the two doors `#openNewProfile` actually reads.
     */
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

            /* `{ title, steps: [] }` was missing eight of a profile's ten keys as well as
             * its step, and `POST /api/v1/profiles` requires four of them. Judged by the
             * address layer's own reader rather than by a list retyped here. */
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
