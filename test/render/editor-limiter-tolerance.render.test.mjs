/**
 * editor-limiter-tolerance.render.test.mjs — THE TWO TOLERANCE STEPPERS ON THE GLASS.
 *
 * WHAT IS ASSERTED IS THE WHOLE CHAIN, the same shape the settings tab's own suite pins:
 * the control composes, it reads the profile it was opened on, a press moves the draft,
 * the change is COUNTED, and the next save carries it. A test that only asserted the two
 * rows exist would pass against a control wired to nothing, which is the exact shape of
 * the defect this panel was rebuilt to remove.
 *
 * AND THE DISABLED CASE IS ASSERTED TOO, because it is the one the draft door refuses. A
 * profile in which no step carries a pressure limit has no knee to widen; the row states
 * that and the stepper does not move, rather than moving and writing nothing.
 *
 * Nothing here reads a source file.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, editorCalls, selectPanel, matrixStep,
} from '../harness/editor.js';
import { POWER_CAP_DEFAULT } from '../../src/lib/profile-modes.js';

const geometry = GATE_A_GEOMETRIES[0];

const PRESSURE_ROW = 'pressure-limit-tolerance';
const FLOW_ROW = 'flow-limit-tolerance';

const stepper = (row) => `editor-screen >>> #field-${row}`;
const rowPart = (row, part) => `editor-screen >>> [data-row="${row}"] >>> #${part}`;

/** The draft the screen holds and what the store makes of it. */
const report = (page) => page.evalFn((sel) => {
    const screen = window.__h.need(sel);
    const draft = screen._draft;
    const change = window.__editorStore.changeCount(draft);
    return {
        ranges: (draft?.steps ?? []).map((s) => (s.limiter ? s.limiter.range : null)),
        pumps: (draft?.steps ?? []).map((s) => s.pump),
        count: change.count,
        fields: change.fields,
    };
}, EDITOR.screen);

/** Press the plus key inside one stepper, the way a finger does. */
async function pressUp(page, row) {
    await page.evalFn((sel) => {
        window.__h.need(sel).renderRoot.querySelector('#increment').click();
    }, stepper(row));
    await page.settle(3);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the editor Settings tab carries the two limiter tolerances', () => {
    const staged = (fn, profile = null) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: profile ?? editingProfile() });
        await selectPanel(page, 'settings');
        return fn(page);
    });

    test('both steppers compose', () => staged(async (page) => {
        assert.equal(await page.exists(stepper(PRESSURE_ROW)), true);
        assert.equal(await page.exists(stepper(FLOW_ROW)), true);
        assert.deepEqual(page.pageErrors, []);
    }));

    test('each reads the width the profile is authored with', () => staged(async (page) => {
        const read = (row) => page.evalFn((s) => window.__h.need(s).value, stepper(row));
        assert.equal(await read(PRESSURE_ROW), POWER_CAP_DEFAULT.range);
        assert.equal(await read(FLOW_ROW), POWER_CAP_DEFAULT.range);
    }, editingProfile([
        matrixStep({ limiter: { value: 9, range: POWER_CAP_DEFAULT.range } }),
        matrixStep({ pump: 'pressure', pressure: 9, limiter: { value: 8, range: POWER_CAP_DEFAULT.range } }),
    ])));

    test('each names its own unit beside the heading', () => staged(async (page) => {
        const hint = (row) => page.evalFn(
            (s) => window.__h.need(s).textContent.trim(), rowPart(row, 'hint'),
        );
        assert.match(await hint(PRESSURE_ROW), /bar$/);
        assert.match(await hint(FLOW_ROW), /mL\/s$/);
    }));

    test('a press moves the draft, and only the steps that unit reaches',
        () => staged(async (page) => {
            const before = await report(page);
            assert.deepEqual(before.pumps, ['flow', 'pressure']);
            assert.equal(before.count, 0, 'an untouched draft is clean');

            await pressUp(page, PRESSURE_ROW);

            const after = await report(page);
            assert.ok(after.ranges[0] > before.ranges[0], 'the flow step took the new width');
            assert.equal(after.ranges[1], before.ranges[1],
                'the pressure step keeps its own — it is measured in the other unit');
            assert.equal(after.count, 1, 'and one step changed');
            assert.deepEqual(after.fields, ['steps[0]']);
        }));

    test('the other stepper reaches the other steps', () => staged(async (page) => {
        const before = await report(page);
        await pressUp(page, FLOW_ROW);
        const after = await report(page);
        assert.equal(after.ranges[0], before.ranges[0]);
        assert.ok(after.ranges[1] > before.ranges[1]);
        assert.deepEqual(after.fields, ['steps[1]']);
    }));

    test('the save carries the new width', () => staged(async (page) => {
        await pressUp(page, PRESSURE_ROW);
        const wanted = (await report(page)).ranges[0];

        await page.click(EDITOR.save);
        await page.settle(8);

        const calls = await editorCalls(page);
        const body = calls[0]?.body?.profile ?? {};
        assert.equal(calls[0]?.method, 'POST');
        assert.equal(body.steps[0].limiter.range, wanted);
        assert.equal(body.steps[0].limiter.value, 9, 'and the limit itself is untouched');
    }));

    test('a profile with no pressure limit disables that row and says why',
        () => staged(async (page) => {
            const disabled = await page.evalFn(
                (s) => window.__h.need(s).disabled, stepper(PRESSURE_ROW),
            );
            assert.equal(disabled, true);

            const caption = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), rowPart(PRESSURE_ROW, 'caption'),
            );
            assert.match(caption, /no step/i);

            assert.equal(
                await page.evalFn((s) => window.__h.need(s).disabled, stepper(FLOW_ROW)),
                false,
                'the flow-limit row is still live — the pressure step carries one',
            );
        }, editingProfile([
            matrixStep({ limiter: null }),
            matrixStep({ pump: 'pressure', pressure: 9, limiter: { value: 8, range: POWER_CAP_DEFAULT.range } }),
        ])));
});
