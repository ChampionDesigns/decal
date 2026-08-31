/**
 * A.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditing, eventsNamed } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const notices = (page) => page.evalFn((sel) => {
    const host = window.__h.q(sel);
    if (!host) return null;
    return [...host.children].map((n) => ({
        tone: n.getAttribute('tone'),
        text: (n.textContent ?? '').trim(),
    }));
}, EDITOR.notice);

/** Which overlay, if any, the region has open — a refusal must open none of them. */
const overlayState = (page) => page.evalFn((sel) => {
    const overlays = window.__h.need(sel);
    const flag = (id) => overlays.renderRoot.querySelector(id)?.open === true;
    return { numpad: flag('#numpad'), exit: flag('#exit'), lever: flag('#lever') };
}, EDITOR.overlays);

/** Ask the overlay region to open the pad on one door field. */
const openField = (page, field) => page.evalFn(
    (sel, f) => window.__h.need(sel).openNumpad({ field: f }), EDITOR.overlays, field,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a refused keypad open reaches the person (F-008)', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditing(page);
        return fn(page);
    });

    test('the screen has a notice surface and it starts empty', () => staged(async (page) => {
        assert.deepEqual(await notices(page), [],
            'nothing is announced before anything is refused');
    }));

    test('a field the door refuses ON PURPOSE raises a notice', () => staged(async (page) => {
        const opened = await openField(page, 'targetVolumeCountStart');
        assert.equal(opened, false, 'the door refuses, so nothing opens');
        await page.settle(4);

        assert.deepEqual(await overlayState(page),
            { numpad: false, exit: false, lever: false },
            'a refusal opens nothing and closes nothing');

        const said = await notices(page);
        assert.equal(said.length, 1, 'exactly one notice, for exactly one refusal');
        assert.equal(said[0].tone, 'warn', 'a refusal is not a failure and not an ok');
        assert.ok(said[0].text.length > 0, 'and it says something');
        assert.match(said[0].text, /targetVolumeCountStart/,
            'the door\'s own sentence is printed verbatim — the same rule #announce '
            + 'applies to the server\'s refusals');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('a field NOBODY declared is refused and announced too', () => staged(async (page) => {
        const opened = await openField(page, 'notAField');
        assert.equal(opened, false);
        await page.settle(4);

        const said = await notices(page);
        assert.equal(said.length, 1);
        assert.match(said[0].text, /notAField/);
    }));

    test('the wire still leaves the region, so nothing above it lost a report',
        () => staged(async (page) => {
            await openField(page, 'targetVolumeCountStart');
            await page.settle(4);
            const refusals = await eventsNamed(page, 'numpad-refused');
            assert.equal(refusals.length, 1,
                'the screen listens without stopping — a composition root above it still '
                + 'receives the event exactly as it did before');
            assert.equal(refusals[0].field, 'targetVolumeCountStart');
            assert.ok(typeof refusals[0].reason === 'string' && refusals[0].reason.length > 0);
        }));

    test('a field the door DOES answer for opens the pad and announces nothing',
        () => staged(async (page) => {
            const opened = await openField(page, 'targetWeight');
            assert.equal(opened, true);
            await page.settle(4);

            assert.equal((await overlayState(page)).numpad, true, 'the pad opened');
            assert.deepEqual(await notices(page), [],
                'a control that worked says nothing — a notice on every open would be noise');
        }));
});
