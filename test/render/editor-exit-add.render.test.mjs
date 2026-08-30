/**
 * editor-exit-add.render.test.mjs — THE + CONDITION BUTTON, DRIVEN AS A USER DRIVES IT.
 *
 * Ben, 29 August 2026: "In the profile editor, if I tried to press the + Condition button
 * to a step that doesn't have an exit condition it didn't add one or start the condition
 * modal."
 *
 * THE BAND WAS NEVER AT FAULT. `ui-exit-sentence` dispatched `exit-add` correctly —
 * composed, bubbling, carrying {index, slot, type} — and its own suite proved the menu was
 * composed. NOTHING LISTENED: the string `exit-add` appeared nowhere in `src/` outside two
 * comments, exactly as `step-action` did on 27 August.
 *
 * That is why this file drives the WHOLE editor rather than the band alone. The band's own
 * suite mounts it in isolation, where an unheard event is the CORRECT outcome, so no
 * assertion there could ever have gone red. The gesture only means something end to end.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditing, eventsNamed } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

/** A pressure step with no exit and no scalar slots — all three add slots are offered. */
const BARE_STEP = Object.freeze({
    name: 'Preinfusion',
    pump: 'pressure',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    pressure: 3,
    limiter: { value: 0, range: 0.6 },
});

const BAND = `${EDITOR.matrix} >>> ui-exit-sentence`;
const MENU = `${BAND} >>> #menu-condition`;

/** Which overlay is open, read off the region rather than inferred from the screen. */
const overlayState = (page) => page.evalFn((sel) => {
    const overlays = window.__h.need(sel);
    const flag = (id) => overlays.renderRoot.querySelector(id)?.open === true;
    return { numpad: flag('#numpad'), exit: flag('#exit') };
}, EDITOR.overlays);

/**
 * PRESS ONE ADD SLOT, THE WAY A PERSON DOES, AND REFUSE TO LIE ABOUT IT.
 *
 * The matrix is its own scrollport, so the exit band can be laid out perfectly and still
 * sit below the window — at 1281x801 the band's first add slot lands at y=843. `page.click`
 * dispatches at the rect's centre and Chrome hits whatever is there, which for a row
 * outside the port is nothing at all: the press never happens and the assertion afterwards
 * is about a gesture that was never made. So scroll it into the port first, then CHECK the
 * box is inside the window before pressing. Same rule as `pressKey` in the step-action
 * suite, and it is the reason this file's first draft failed green-looking.
 */
async function pressAdd(page, slot) {
    const control = `${BAND} >>> #add-${slot}`;
    await page.evalFn((sel) => {
        window.__h.need(sel).scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }, control);
    await page.settle(2);

    const box = await page.box(control);
    assert.ok(box.width > 0 && box.height > 0, `+ ${slot}: the control has no box to press`);
    assert.ok(box.top >= 0 && box.top + box.height <= page.geometry.height,
        `+ ${slot}: the control is outside the window, so a press at its coordinates `
        + 'would land on something else');

    await page.click(control);
    await page.settle(3);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('profile editor — the + Condition button', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditing(page, { steps: [BARE_STEP] });
        return fn(page);
    });

    test('a step with no exit offers the add slot, and pressing it opens the type menu',
        () => staged(async (page) => {
            assert.equal(await page.exists(`${BAND} >>> #add-condition`), true);
            await pressAdd(page, 'condition');
            assert.equal(await page.evalFn((s) => window.__h.need(s).open, MENU), true,
                'the press must open the menu — this is the bug Ben hit');
            assert.ok(await page.count(`${MENU} >>> [role=menuitem]`) > 0,
                'the open menu must list the legal exit types');
        }));

    test('choosing a type opens the condition modal SEEDED WITH THAT TYPE',
        () => staged(async (page) => {
            await pressAdd(page, 'condition');
            const chosen = await page.evalFn((s) => window.__h.need(s).items[0].id, MENU);
            await page.click(`${MENU} >>> [role=menuitem]`);
            await page.settle(3);

            assert.equal((await overlayState(page)).exit, true,
                'the condition modal must open');
            const draft = await page.evalFn(
                (s) => ({ ...window.__h.need(s).draft }), EDITOR.exitDialog,
            );
            assert.equal(draft.type, chosen,
                'the menu pick must reach the dialog rather than be re-guessed from the pump');
            assert.equal(Number.isFinite(draft.value), true,
                'the dialog invents a value for a condition that has none');
        }));

    test('nothing is written until the modal confirms', () => staged(async (page) => {
        await pressAdd(page, 'condition');
        await page.click(`${MENU} >>> [role=menuitem]`);
        await page.settle(3);
        assert.deepEqual(await eventsNamed(page, 'exit-condition-change'), [],
            'opening the modal must write nothing — a cancel has to mean cancel');

        await page.click(`${EDITOR.exitDialog} >>> #confirm`);
        await page.settle(3);
        const written = await eventsNamed(page, 'exit-condition-change');
        assert.equal(written.length, 1, 'the confirm writes exactly once');
        assert.equal(written[0].index, 0);
        assert.equal(typeof written[0].type, 'string');
        assert.equal(Number.isFinite(written[0].value), true);
    }));

    test('+ Volume opens the keypad — the same event, the other door',
        () => staged(async (page) => {
            await pressAdd(page, 'volume');
            assert.equal((await overlayState(page)).numpad, true,
                'a scalar add slot opens the pad, not the dialog');
        }));

    test('the band still emits nothing of its own accord', () => staged(async (page) => {
        assert.deepEqual(await eventsNamed(page, 'exit-condition-change'), []);
        assert.deepEqual(page.pageErrors, []);
    }));
});
