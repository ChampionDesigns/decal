/**
 * editor-review-slots.render.test.mjs — the Review tab's sentences are CONTROLS.
 *
 * The description carries clickable inline text that changes the settings it describes.
 *
 * ===========================================================================
 * WHAT THIS FILE PROVES, AND WHY EACH CLAIM NEEDS A BROWSER
 * ===========================================================================
 * 1. THE SLOTS ARE REAL CONTROLS. Buttons, enabled, with a box big enough to hit — not
 *    spans with a click handler. A span cannot be tabbed to and announces as text, so
 *    "it works when I press it" would be true and the feature still unreachable by
 *    keyboard.
 *
 * 2. THE PAD IS ARMED FROM THE SENTENCE. The bounds the keypad opens with are the ones
 *    the words were PRINTED from — read off the segment's own data attributes and off
 *    the armed pad, and compared. This is the one place the panel could still have
 *    two answers: `reviewStepSpec` resolves its ranges inside the sentence rather than
 *    through the ranges door, so a second lookup at press time is exactly the drift the
 *    skin keeps finding.
 *
 * 3. THE EXIT THRESHOLD OPENS THE DIALOG AND NOT THE PAD. `exitValue` is not a step key
 *    — it lives at `step.exit.value` — and `applyStepValue` writes `{...step, [field]:
 *    value}` for any field it does not name. Routed as a plain number it would put an
 *    `exitValue` key on the step, a shape ReaPrime never sent, and the profile would
 *    fail to save with the same class of error F-048 produced. Only a real press through
 *    the real router can show which door it took.
 *
 * 4. A TOGGLE WRITES AND THE SENTENCE RE-READS. The word after the press is the PORT's,
 *    rebuilt from the draft — so this asserts on rendered text and not on an event
 *    payload, which is the only way to catch a write that landed somewhere the sentence
 *    does not read from.
 *
 * 5. A BLOCK THAT DESCRIBES NO STEP STAYS PROSE. The right column's totals carry no step
 *    index and must not be pressable.
 *
 * Nothing here reads a file. Every claim is a computed style, a measured box, a real
 * press, or a value the component itself holds.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, EDITING_MODULES, editorStage, seatProfile, selectPanel, editingProfile, matrixStep,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

/**
 * ONE STEP THAT EMITS EVERY SEGMENT KIND. A pressure step carries the probe and
 * transition toggles, a target, a limiter and a duration; the exit gives the condition
 * its direction word and its threshold. Without the exit, claim 3 has nothing to press.
 */
const RICH_STEP = Object.freeze(matrixStep({
    name: 'Infusion',
    pump: 'pressure',
    transition: 'fast',
    sensor: 'coffee',
    temperature: 92,
    pressure: 9,
    seconds: 25,
    volume: 0,
    weight: 0,
    limiter: { value: 4, range: 0.6 },
    exit: { type: 'flow', condition: 'over', value: 2 },
}));

const STEP0 = `${EDITOR.review} >>> [data-block="step-0"]`;

/* THE OVERLAY REGION, ON THIS STAGE. `EDITOR.overlays` spells the EDITING stage's
 * light-DOM child; here nothing is slotted into `overlays`, so the screen renders its
 * own as the slot's fallback content — inside its shadow root, which is where the
 * screen's header says the two halves agree by construction. */
const OVERLAYS = 'editor-screen >>> #overlays';
const NUMPAD = `${OVERLAYS} >>> #numpad`;

/** Which overlay is open, read off the region rather than inferred from the screen. */
const overlayState = (page) => page.evalFn((sel) => {
    const overlays = window.__h.need(sel);
    const flag = (id) => overlays.renderRoot.querySelector(id)?.open === true;
    return { numpad: flag('#numpad'), exit: flag('#exit'), lever: flag('#lever') };
}, OVERLAYS);

/** The armed keypad's own state — the row it was given, under the key it was given. */
const padState = (page) => page.evalFn((sel) => {
    const pad = window.__h.need(sel);
    const entry = pad.limits?.[pad.limitKey] ?? null;
    return { limitKey: pad.limitKey, value: pad.value, entry: entry ? { ...entry } : null };
}, NUMPAD);

/** Every slot in one block, as the DOM holds it. */
const slotsIn = (page, block) => page.evalFn((sel) => Array.from(
    window.__h.need(sel).querySelectorAll('.slot'),
).map((el) => ({
    tag: el.tagName,
    kind: el.className,
    disabled: el.disabled === true,
    text: el.textContent.trim(),
    data: { ...el.dataset },
    box: { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height },
})), block);

/**
 * PRESS A SLOT THE WAY A PERSON DOES, AND REFUSE TO LIE ABOUT IT. The review column is
 * its own scrollport, so a slot can be laid out perfectly and still sit below the window
 * — and `page.click` would then dispatch at coordinates holding something else, making
 * the assertion afterwards about a gesture that never happened. Same rule, and the same
 * reason, as `pressAdd` in the exit-add suite.
 */
async function pressSlot(page, selector) {
    await page.evalFn((sel) => {
        window.__h.need(sel).scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }, selector);
    await page.settle(2);

    const box = await page.box(selector);
    assert.ok(box.width > 0 && box.height > 0, `${selector}: the slot has no box to press`);
    assert.ok(box.top >= 0 && box.top + box.height <= page.geometry.height,
        `${selector}: the slot is outside the window, so a press would land elsewhere`);

    await page.click(selector);
    await page.settle(3);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('profile editor — the Review sentence is editable', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        /* THE OVERLAY REGION HAS TO BE LOADED, not merely slotted. `editorStage` leaves
         * the `overlays` slot empty, so the screen renders its own <editor-overlays> as
         * fallback — but only the EDITING module list defines that element, and an
         * undefined custom element is an inert <editor-overlays> with no renderRoot. So
         * the modules are the editing set and the markup is the plain stage: this suite
         * needs the screen's review panel and the real router behind it, and nothing
         * else. */
        await page.mount(editorStage(), EDITING_MODULES);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'the editor must mount without throwing');
        await seatProfile(page, { profile: editingProfile([RICH_STEP]) });
        await page.settle(4);
        await selectPanel(page, 'review');
        return fn(page);
    });

    test('every slot in a step block is a real, enabled, hittable button',
        () => staged(async (page) => {
            const slots = await slotsIn(page, STEP0);
            assert.ok(slots.length >= 4,
                `the sentence must offer several slots, got ${slots.length}`);
            for (const slot of slots) {
                assert.equal(slot.tag, 'BUTTON',
                    `"${slot.text}" must be a button — a span is unreachable by keyboard`);
                assert.equal(slot.disabled, false, `"${slot.text}" must be pressable`);
                assert.ok(slot.box.w > 0 && slot.box.h > 0,
                    `"${slot.text}" must have a box to press`);
            }
            assert.ok(slots.some((s) => s.kind.includes('seg-num')), 'numbers are slots');
            assert.ok(slots.some((s) => s.kind.includes('seg-tog')), 'toggles are slots');
        }));

    test('a number opens the keypad ARMED WITH THE BOUNDS THE SENTENCE PRINTED',
        () => staged(async (page) => {
            const target = `${STEP0} .seg-num[data-field="temperature"]`;
            const printed = (await slotsIn(page, STEP0))
                .find((s) => s.data.field === 'temperature');
            assert.ok(printed, 'the temperature sentence must carry a number slot');

            await pressSlot(page, target);
            assert.deepEqual(await overlayState(page),
                { numpad: true, exit: false, lever: false },
                'a number opens the keypad and nothing else');

            const pad = await padState(page);
            assert.equal(pad.limitKey, 'temperature',
                'the pad is keyed by the matrix row, so it wears that row\'s heading');
            assert.equal(pad.value, printed.text.split(' ')[0],
                'the pad opens on the number the sentence was showing');
            assert.equal(pad.entry.min, Number(printed.data.min),
                'the pad\'s floor is the sentence\'s floor — one bound, not two');
            assert.equal(pad.entry.max, Number(printed.data.max),
                'the pad\'s ceiling is the sentence\'s ceiling');
        }));

    test('a confirmed number reaches the draft and the sentence says so',
        () => staged(async (page) => {
            const target = `${STEP0} .seg-num[data-field="temperature"]`;
            const before = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), target,
            );
            await pressSlot(page, target);

            /* TYPED, NOT SET. The keypad's own keys are the gesture; writing `pad.value`
             * would prove the commit path works from a state no person can reach. */
            for (const key of ['9', '5']) {
                await page.click(`${NUMPAD} >>> #key-${key}`);
            }
            await page.click(`${NUMPAD} >>> #confirm >>> #btn`);
            await page.settle(4);

            const after = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), target,
            );
            assert.notEqual(after, before, 'the confirm must move the number');
            assert.equal(after.split(' ')[0], '95',
                'the sentence is rebuilt from the draft, so the number it shows IS the '
                + 'number in the profile — one road to the draft, the same one the '
                + 'Steps tab takes');
        }));

    test('the exit threshold opens the CONDITION DIALOG, never the keypad',
        () => staged(async (page) => {
            await pressSlot(page, `${STEP0} .seg-num[data-field="exitValue"]`);
            assert.deepEqual(await overlayState(page),
                { numpad: false, exit: true, lever: false },
                'exitValue is not a step key: routed as a plain number it would write '
                + 'step.exitValue and the profile would fail to save');
        }));

    test('the exit DIRECTION opens the same dialog — one owner for one sentence',
        () => staged(async (page) => {
            await pressSlot(page, `${STEP0} .seg-tog[data-kind="exitcmp"]`);
            assert.equal((await overlayState(page)).exit, true);
        }));

    test('a toggle writes the draft and the sentence re-reads it',
        () => staged(async (page) => {
            const target = `${STEP0} .seg-tog[data-kind="probe"]`;
            const before = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), target,
            );
            await pressSlot(page, target);
            const after = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), target,
            );
            assert.notEqual(after, before,
                'the press must move the probe and the sentence must be rebuilt from '
                + 'the draft — an unchanged word means the write landed somewhere the '
                + 'sentence does not read');
            assert.deepEqual([before, after].sort(), ['coffee', 'water'],
                'the two words are the wire\'s two words');
        }));

    test('a block that describes no step is prose, not controls',
        () => staged(async (page) => {
            const blocks = await page.evalFn((sel) => Array.from(
                window.__h.need(sel).renderRoot.querySelectorAll('.block'),
            ).map((el) => ({
                id: el.dataset.block,
                slots: el.querySelectorAll('.slot').length,
                live: el.querySelectorAll('.slot:not([disabled])').length,
            })), EDITOR.review);

            const stepless = blocks.filter((b) => !/^step-\d+$/.test(b.id ?? ''));
            for (const block of stepless) {
                assert.equal(block.live, 0,
                    `block "${block.id}" describes no step, so it has no address to `
                    + 'write to and must not offer a control');
            }
        }));

    test('the panel still throws nothing of its own accord', () => staged(async (page) => {
        assert.deepEqual(page.pageErrors, []);
    }));
});
