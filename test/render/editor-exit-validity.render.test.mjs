/**
 * The exit condition's four entry paths, measured against one rule, and where the caret
 * returns to.
 *
 * A channel, a direction and a threshold, written by the type bank, the direction bank,
 * the inline stepper and the keypad. Every bound is read back from the module that owns
 * it rather than typed here.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, EDITING_MODULES, editingProfile, editorStage, eventsNamed, matrixStep,
    mountEditing, seatProfile, selectPanel,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const POWER_STEP = Object.freeze({
    name: 'Ramp',
    pump: 'power',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    power: 4,
    limiter: { value: 9, range: 0.6 },
});

const draftOf = (page) => page.evalFn(
    (sel) => ({ ...window.__h.need(sel).draft }), EDITOR.exitDialog,
);

const commitState = (page) => page.evalFn((sel) => {
    const dialog = window.__h.need(sel);
    const confirm = dialog.renderRoot.querySelector('#confirm');
    const reject = dialog.renderRoot.querySelector('#reject');
    return {
        disabled: confirm?.hasAttribute('disabled') === true || confirm?.disabled === true,
        reason: (reject?.textContent ?? '').trim(),
    };
}, EDITOR.exitDialog);

const declaredBand = (page, type) => page.evalFn(async (exitType) => {
    const modes = await import('/src/lib/profile-modes.js');
    const range = modes.exitRange(exitType);
    return { min: range.min, max: range.max, step: range.step, unit: range.unit };
}, type);

const caret = (page) => page.evalFn(() => {
    const el = window.__h.deepActiveElement();
    if (!el) return { tag: null, host: null, id: null };
    const root = el.getRootNode();
    return {
        tag: el.tagName,
        id: el.id || null,
        host: root && root.host ? root.host.tagName : null,
    };
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('profile editor — one validator over every exit entry path', () => {
    const staged = (steps, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditing(page, { steps });
        return fn(page);
    });

    test('the threshold keypad is armed with the DIRECTION\'s floor, not the channel\'s',
        () => staged([{ ...POWER_STEP }], async (page) => {
            await page.evalFn(
                (sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays,
            );
            await page.settle(4);
            await page.click(`${EDITOR.exitDialog} >>> #direction >>> #item-1`);
            await page.settle(4);
            assert.equal((await draftOf(page)).condition, 'under',
                'the direction bank did not move the draft');

            await page.click(`${EDITOR.exitDialog} >>> #value >>> #value`);
            await page.settle(5);

            const type = (await draftOf(page)).type;
            const band = await declaredBand(page, type);
            const armed = await page.evalFn((sel) => {
                const pad = window.__h.need(sel);
                return { open: pad.open, min: pad.range?.min ?? null, max: pad.range?.max ?? null };
            }, EDITOR.numpad);

            assert.equal(armed.open, true, 'pressing the threshold must open its keypad');
            assert.equal(armed.max, band.max, 'the pad took a maximum the door did not declare');
            const floor = await page.evalFn(async (payload) => {
                const validity = await import('/src/lib/exit-validity.js');
                return Math.max(payload.min, validity.exitValueMin('under', payload.step));
            }, { min: band.min, step: band.step });
            assert.equal(armed.min, floor,
                'the pad is bounded by the channel alone, so "falls below" can be typed to zero');
            assert.ok(armed.min > band.min,
                'the falls-below floor must sit ABOVE the channel floor, or nothing was lifted');
        }));

    test('zero typed into a falls-below keypad never reaches the profile as a dead exit',
        () => staged([{ ...POWER_STEP }], async (page) => {
            await page.evalFn(
                (sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays,
            );
            await page.settle(4);
            await page.click(`${EDITOR.exitDialog} >>> #direction >>> #item-1`);
            await page.settle(4);
            await page.click(`${EDITOR.exitDialog} >>> #value >>> #value`);
            await page.settle(5);

            await page.click(`${EDITOR.numpad} >>> #key-0`);
            await page.settle(3);
            await page.click(`${EDITOR.numpad} >>> #confirm`);
            await page.settle(5);

            assert.equal(await page.evalFn(sel => window.__h.need(sel).open, EDITOR.numpad), true);
            assert.deepEqual(await eventsNamed(page, 'exit-condition-change'), []);
            await page.evalFn(sel => {
                const pad = window.__h.need(sel);
                for (const digit of String(pad.range.min)) pad.press(digit === '.' ? 'decimal' : digit);
                return true;
            }, EDITOR.numpad);
            await page.click(`${EDITOR.numpad} >>> #confirm`);
            await page.settle(5);

            const back = await draftOf(page);
            const dead = await page.evalFn(async (payload) => {
                const validity = await import('/src/lib/exit-validity.js');
                return validity.deadExitReason(payload);
            }, { type: back.type, condition: back.condition, value: back.value });
            assert.equal(dead, null,
                `the keypad staged an exit that can never fire — ${JSON.stringify(back)}`);

            await page.click(`${EDITOR.exitDialog} >>> #confirm`);
            await page.settle(4);
            const [change] = await eventsNamed(page, 'exit-condition-change');
            assert.ok(change, 'Done reported nothing at all');
            const committed = await page.evalFn(async (payload) => {
                const validity = await import('/src/lib/exit-validity.js');
                return validity.deadExitReason(payload);
            }, { type: change.type, condition: change.condition, value: change.value });
            assert.equal(committed, null,
                `the profile received a dead exit — ${JSON.stringify(change)}`);
        }));

    test('a threshold beyond the NEW type\'s band refuses Done and says which band it is',
        () => staged([{ ...POWER_STEP }], async (page) => {
            await page.evalFn(
                (sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays,
            );
            await page.settle(4);

            const offered = await page.evalFn(
                (sel) => window.__h.need(sel).renderRoot.querySelector('#type').items
                    .map((item) => item.value),
                EDITOR.exitDialog,
            );
            assert.ok(offered.length >= 2, 'a power step must be offered more than one exit channel');
            const bands = await Promise.all(offered.map((t) => declaredBand(page, t)));
            let wide = 0;
            let narrow = 0;
            for (let i = 1; i < bands.length; i += 1) {
                if (bands[i].max > bands[wide].max) wide = i;
                if (bands[i].max < bands[narrow].max) narrow = i;
            }
            assert.ok(bands[wide].max > bands[narrow].max,
                'the offered channels share one ceiling, so there is no type change to test');

            await page.click(`${EDITOR.exitDialog} >>> #type >>> #item-${wide}`);
            await page.settle(4);
            await page.evalFn((payload) => {
                const dialog = window.__h.need(payload.sel);
                const stepper = dialog.renderRoot.querySelector('#value');
                stepper.value = payload.value;
                stepper.dispatchEvent(new CustomEvent('change', {
                    detail: { value: payload.value }, bubbles: true, composed: true,
                }));
                return true;
            }, { sel: EDITOR.exitDialog, value: bands[wide].max });
            await page.settle(3);
            assert.equal((await draftOf(page)).value, bands[wide].max);
            assert.equal((await commitState(page)).disabled, false,
                'a threshold at its own channel maximum must be committable');

            await page.click(`${EDITOR.exitDialog} >>> #type >>> #item-${narrow}`);
            await page.settle(4);

            const held = await draftOf(page);
            assert.equal(held.value, bands[wide].max,
                'the draft was silently clamped — a mode switch must not move a recipe number');
            const state = await commitState(page);
            assert.equal(state.disabled, true,
                'Done accepted a threshold beyond the selected channel\'s band');
            assert.ok(state.reason.length > 0,
                'a refused action with no sentence beside it is a dead affordance');
            assert.ok(state.reason.includes(String(bands[narrow].max)),
                `the refusal must name the band it is refusing against — got "${state.reason}"`);

            await page.click(`${EDITOR.exitDialog} >>> #confirm`);
            await page.settle(4);
            assert.deepEqual(await eventsNamed(page, 'exit-condition-change'), [],
                'Done committed an out-of-band threshold');
            assert.equal(
                await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.exitDialog), true,
                'the dialog must stay open on a state the person has to resolve',
            );
        }));

    test('resolving the threshold releases Done, and the draft that commits is the resolved one',
        () => staged([{ ...POWER_STEP }], async (page) => {
            await page.evalFn(
                (sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays,
            );
            await page.settle(4);
            const offered = await page.evalFn(
                (sel) => window.__h.need(sel).renderRoot.querySelector('#type').items
                    .map((item) => item.value),
                EDITOR.exitDialog,
            );
            const bands = await Promise.all(offered.map((t) => declaredBand(page, t)));
            let wide = 0;
            let narrow = 0;
            for (let i = 1; i < bands.length; i += 1) {
                if (bands[i].max > bands[wide].max) wide = i;
                if (bands[i].max < bands[narrow].max) narrow = i;
            }
            await page.click(`${EDITOR.exitDialog} >>> #type >>> #item-${wide}`);
            await page.settle(3);
            await page.evalFn((payload) => {
                const stepper = window.__h.need(payload.sel).renderRoot.querySelector('#value');
                stepper.value = payload.value;
                stepper.dispatchEvent(new CustomEvent('change', {
                    detail: { value: payload.value }, bubbles: true, composed: true,
                }));
                return true;
            }, { sel: EDITOR.exitDialog, value: bands[wide].max });
            await page.settle(3);
            await page.click(`${EDITOR.exitDialog} >>> #type >>> #item-${narrow}`);
            await page.settle(4);
            assert.equal((await commitState(page)).disabled, true);

            await page.click(`${EDITOR.exitDialog} >>> #value >>> #decrement`);
            await page.settle(4);
            const resolved = await draftOf(page);
            assert.ok(resolved.value <= bands[narrow].max,
                'the stepper did not bring the threshold inside the new band');
            assert.equal((await commitState(page)).disabled, false,
                'a resolved threshold must release Done');

            await page.click(`${EDITOR.exitDialog} >>> #confirm`);
            await page.settle(4);
            const [change] = await eventsNamed(page, 'exit-condition-change');
            assert.ok(change, 'a resolved draft must commit');
            assert.equal(change.type, resolved.type);
            assert.equal(change.value, resolved.value);
        }));
});

describe('profile editor — the keypad gives the caret back to the control that opened it', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditing(page, { steps: [{ ...POWER_STEP }] });
        return fn(page);
    });

    async function openFromCell(page) {
        const cell = 'step-matrix >>> [data-cell="temperature-0"] ui-stepper';
        const control = await page.evalFn((sel) => {
            const stepper = window.__h.q(sel);
            if (!stepper) return null;
            stepper.scrollIntoView({ block: 'center', inline: 'nearest' });
            return true;
        }, cell);
        assert.equal(control, true, 'the temperature cell must be on screen to be pressed');
        await page.settle(2);
        await page.click(`${cell} >>> #value`);
        await page.settle(5);
        return page;
    }

    for (const [name, close] of [
        ['Confirm', async (page) => page.click(`${EDITOR.numpad} >>> #confirm`)],
        ['Cancel', async (page) => page.click(`${EDITOR.numpad} >>> #cancel`)],
        ['Escape', async (page) => page.press('Escape')],
    ]) {
        test(`${name} puts the caret back on the value button that opened the keypad`,
            () => staged(async (page) => {
                await openFromCell(page);
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad),
                    true, 'the value press must open the keypad');

                await close(page);
                await page.settle(6);

                const where = await caret(page);
                assert.notEqual(where.tag, 'BODY',
                    `${name} left the caret on BODY — the editor has no keyboard position at all`);
                assert.equal(where.host, 'UI-STEPPER',
                    `${name} restored focus to ${where.host ?? where.tag}, not to the value control`);
                assert.equal(where.id, 'value',
                    `${name} restored focus to "${where.id}", not to the value button`);
            }));
    }
});

const REVIEW_STEP = Object.freeze(matrixStep({
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

const REVIEW_BLOCK = `${EDITOR.review} >>> [data-block="step-0"]`;
const REVIEW_NUMPAD = 'editor-screen >>> #overlays >>> #numpad';
const REVIEW_EXIT = 'editor-screen >>> #overlays >>> #exit';

describe('profile editor — a Review slot gets its own caret back', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await page.mount(editorStage(), EDITING_MODULES);
        await page.settle(6);
        assert.deepEqual(page.pageErrors, [], 'the editor must mount without throwing');
        await seatProfile(page, { profile: editingProfile([REVIEW_STEP]) });
        await page.settle(4);
        await selectPanel(page, 'review');
        return fn(page);
    });

    test('the nested exit keypad round trip ends on the sentence slot, not inside the dialog',
        () => staged(async (page) => {
            const slot = `${REVIEW_BLOCK} .seg-num[data-field="exitValue"]`;
            await page.evalFn((sel) => {
                window.__h.need(sel).scrollIntoView({ block: 'center', inline: 'nearest' });
                return true;
            }, slot);
            await page.settle(2);
            const box = await page.box(slot);
            assert.ok(box.top >= 0 && box.top + box.height <= page.geometry.height,
                'the exit threshold slot must be inside the window to be pressed');

            await page.click(slot);
            await page.settle(5);
            assert.equal(
                await page.evalFn((sel) => window.__h.need(sel).open, REVIEW_EXIT), true,
                'a review exit threshold must open the condition dialog',
            );

            await page.click(`${REVIEW_EXIT} >>> #value >>> #value`);
            await page.settle(5);
            assert.equal(
                await page.evalFn((sel) => window.__h.need(sel).open, REVIEW_NUMPAD), true,
                'the dialog threshold must open its keypad',
            );

            await page.press('Escape');
            await page.settle(6);
            assert.equal(
                await page.evalFn((sel) => window.__h.need(sel).open, REVIEW_EXIT), true,
                'dismissing the keypad must hand the dialog back',
            );

            await page.click(`${REVIEW_EXIT} >>> #cancel`);
            await page.settle(6);

            const where = await page.evalFn((sel) => {
                const el = window.__h.deepActiveElement();
                const want = window.__h.need(sel);
                const root = el ? el.getRootNode() : null;
                return {
                    tag: el ? el.tagName : null,
                    isTheSlot: el === want,
                    inside: root && root.host ? root.host.tagName : null,
                    visible: Boolean(el && el.getClientRects().length > 0),
                };
            }, slot);
            assert.equal(where.isTheSlot, true,
                `after the round trip the caret is on ${where.inside ?? where.tag}, not on the `
                + 'sentence slot that started it');
            assert.equal(where.visible, true,
                'the caret came back to a control with no box — a focus nobody can see');
        }));

    test('closing the keypad returns focus to the sentence slot that opened it',
        () => staged(async (page) => {
            const slot = `${REVIEW_BLOCK} .seg-num[data-field="temperature"]`;
            await page.evalFn((sel) => {
                window.__h.need(sel).scrollIntoView({ block: 'center', inline: 'nearest' });
                return true;
            }, slot);
            await page.settle(2);
            const box = await page.box(slot);
            assert.ok(box.top >= 0 && box.top + box.height <= page.geometry.height,
                'the slot must be inside the window or the press lands elsewhere');

            await page.click(slot);
            await page.settle(5);
            assert.equal(
                await page.evalFn((sel) => window.__h.need(sel).open, REVIEW_NUMPAD), true,
                'pressing a review number must open the keypad',
            );

            await page.press('Escape');
            await page.settle(6);

            const where = await page.evalFn((sel) => {
                const el = window.__h.deepActiveElement();
                const want = window.__h.need(sel);
                return {
                    tag: el ? el.tagName : null,
                    isTheSlot: el === want,
                    field: el && el.dataset ? el.dataset.field ?? null : null,
                };
            }, slot);
            assert.notEqual(where.tag, 'BODY',
                'Escape left the caret on BODY — the review sentence has no keyboard position');
            assert.equal(where.isTheSlot, true,
                `the caret came back to ${where.tag} (field ${where.field}), not to the slot pressed`);
        }));
});
