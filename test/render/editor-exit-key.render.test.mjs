

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditing, typeNumpad, eventsNamed } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

/** A pressure step with no exit and both scalar slots empty — all three adds are offered. */
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

/** The same step already carrying a 100 mL stop — the X09/X11 starting state. */
const STOPPED_STEP = Object.freeze({ ...BARE_STEP, volume: 100 });

const BAND = `${EDITOR.matrix} >>> ui-exit-sentence`;

async function applyCommits(page) {
    await page.evalFn(async () => {
        const draftMod = await import('/src/lib/editor-draft.js');
        const root = window.__editor;
        const screen = window.__h.need('editor-screen');
        const route = (name) => (event) => {
            const result = draftMod.applyEditorEdit(root.draft, name, event.detail ?? {});
            if (!result.applied) return;
            root.draft = result.draft;
            root.push();
        };
        screen.addEventListener('value-commit', route('value-commit'));
        screen.addEventListener('exit-remove', route('exit-remove'));
    });
    await page.settle(2);
}

/** Step 0 of the draft the composition root holds, as a plain object. */
const stepZero = (page) => page.evalFn(() => JSON.parse(JSON.stringify(window.__editor.draft.steps[0])));

async function pressBand(page, id) {
    const control = `${BAND} >>> #${id}`;
    await page.evalFn((sel) => {
        window.__h.need(sel).scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }, control);
    await page.settle(2);

    const box = await page.box(control);
    assert.ok(box.width > 0 && box.height > 0, `#${id}: the control has no box to press`);
    assert.ok(box.top >= 0 && box.top + box.height <= page.geometry.height,
        `#${id}: the control is outside the window, so the press would land elsewhere`);
    await page.click(control);
    await page.settle(3);
}

/** The band's own record for one slot — the OTHER authority on which step key it owns. */
const bandRecord = (page, slot) => page.evalFn(async (s) => {
    const mod = await import('/src/lib/exit-sentence.js');
    const step = window.__editor.draft.steps[0];
    const found = mod.exitBand(step).find((entry) => entry.slot === s) ?? null;
    return found ? { slot: found.slot, field: found.field, occupied: found.occupied } : null;
}, slot);

/** Every sentence the band is currently drawing, as text. */
const sentences = (page) => page.evalFn(async () => {
    const mod = await import('/src/lib/exit-sentence.js');
    return mod.serializeExitSlots(window.__editor.draft.steps[0]).map((slot) => slot.sentence);
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the exit band writes STEP keys (F-020)', () => {
    const staged = (steps, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditing(page, { steps });
        await applyCommits(page);
        return fn(page);
    });

    test('+ Volume → 60 → Confirm puts 60 on `step.volume`, and writes no `exitVolume`',
        () => staged([{ ...BARE_STEP }], async (page) => {
            assert.deepEqual(await sentences(page), [],
                'the step starts with no exit sentence at all');

            await pressBand(page, 'add-volume');
            await typeNumpad(page, '60');

            const step = await stepZero(page);
            assert.equal(step.volume, 60, 'the number lands on the STEP key the band reads');
            assert.equal('exitVolume' in step, false,
                'no door field id may reach a profile step — that key is what a save carried');

            const said = await sentences(page);
            assert.equal(said.length, 1, 'the band now shows exactly one sentence');
            assert.match(said[0], /^Volume\b/, 'and it is the volume one');
            assert.match(said[0], /60/);
            assert.deepEqual(page.pageErrors, []);
        }));

    test('the committed key IS the band\'s own `field` — one source checked against '
        + 'the other', () => staged([{ ...BARE_STEP }], async (page) => {
        const offered = await bandRecord(page, 'volume');
        assert.equal(offered.occupied, false, 'the slot starts empty');

        await pressBand(page, 'add-volume');
        await typeNumpad(page, '60');

        const commits = await eventsNamed(page, 'value-commit');
        assert.equal(commits.length, 1, 'the confirm commits exactly once');
        assert.equal(commits[0].field, offered.field,
            'the commit\'s field must be the key exit-sentence.js says the slot owns');
        assert.equal(commits[0].limitKey, 'exitVolume',
            'the DOOR row is still named — the pad has to be armed from somewhere');
        assert.notEqual(commits[0].field, commits[0].limitKey,
            'the two keys are different facts and the fix is that they stopped being one');
    }));

    test('+ Weight → 36 → Confirm puts 36 on `step.weight`',
        () => staged([{ ...BARE_STEP }], async (page) => {
            await pressBand(page, 'add-weight');
            await typeNumpad(page, '36');

            const step = await stepZero(page);
            assert.equal(step.weight, 36);
            assert.equal('exitWeight' in step, false);
            assert.match((await sentences(page)).join(' | '), /^Weight\b/);
        }));

    test('EDITING an occupied sentence moves the STEP key, not a second one (X11)',
        () => staged([{ ...STOPPED_STEP }], async (page) => {
            assert.match((await sentences(page))[0], /100/, 'the step starts with a 100 mL stop');

            await pressBand(page, 'sentence-volume');
            await typeNumpad(page, '500');

            const step = await stepZero(page);
            assert.equal(step.volume, 500, 'the edit lands on the key the band reads');
            assert.equal('exitVolume' in step, false,
                'the device answered 200 with an unchanged hash for exactly this key');
            assert.match((await sentences(page))[0], /500/);
        }));

    test('remove then re-add ends with ONE key carrying the new number (X09)',
        () => staged([{ ...STOPPED_STEP }], async (page) => {
            await pressBand(page, 'remove-volume');
            assert.equal((await stepZero(page)).volume, 0,
                'the × clears the slot by writing the step key at 0');
            assert.deepEqual(await sentences(page), [], 'and the sentence is gone');

            await pressBand(page, 'add-volume');
            await typeNumpad(page, '48');

            const step = await stepZero(page);
            assert.equal(step.volume, 48,
                'the re-add must land on the same key the remove cleared — one body used to '
                + 'carry volume:0 AND exitVolume:48, and the server kept the zero');
            assert.equal('exitVolume' in step, false);
            assert.equal((await sentences(page)).length, 1);
            assert.match((await sentences(page))[0], /48/);
        }));

    test('the keypad is still armed from the DOOR row, so the bound did not move with '
        + 'the key', () => staged([{ ...BARE_STEP }], async (page) => {
        await pressBand(page, 'add-volume');
        const armed = await page.evalFn((sel) => {
            const pad = window.__h.need(sel);
            return { limitKey: pad.limitKey, keys: Object.keys(pad.limits ?? {}), ranged: pad.ranged };
        }, EDITOR.numpad);
        assert.equal(armed.limitKey, 'exitVolume');
        assert.deepEqual(armed.keys, ['exitVolume'],
            'the pad reads limits[limitKey], so the row it was armed with is the door\'s');
        assert.equal(armed.ranged, true, 'and it really did resolve a band');
    }));
});
