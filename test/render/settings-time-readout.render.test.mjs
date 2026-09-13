/**
 * The time a picker's readout says it is about to save.
 *
 * Each digit segment is one `ui-bank` cell whose label track can ellipsise, so what is
 * asserted is `scrollWidth` against the room the cell gives — an ellipsis and a digit look
 * alike in a capture. Both surfaces that open a picker, at both ends of the type scale.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const SIZES = Object.freeze(['fit-screen', 'largest']);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the time picker's readout @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        let page;

        before(async () => {
            page = await browser.newPage({ geometry });
            await page.mount(STAGE, MODULES);
            await page.evalFn(() => window.__settings.mount().then(() => true));
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');

            await page.evalFn(() => window.__settings.capabilities(['wakeSchedule']).then(() => true));
            await page.settle();
        });

        after(async () => { await page?.close(); });

        const show = async (categoryId, leafId) => {
            await page.evalFn(async (c, l) => {
                await window.__settings.selectCategory(c);
                await window.__settings.selectLeaf(l);
                return true;
            }, categoryId, leafId);
            await page.settle();
        };

        const displaySize = async (value) => {
            await show('display', 'display-screen');
            const done = await page.evalFn(
                (v) => window.__settings.change('display-display-size-density', v).then((ok) => ok),
                value,
            );
            assert.equal(done, true, 'the Display size control must exist');
            await page.settle();
        };

        const pressBespoke = async (id) => {
            const pressed = await page.evalFn((buttonId) => {
                const bespoke = document.querySelector('settings-screen')
                    .shadowRoot.getElementById('bespoke');
                const button = bespoke?.shadowRoot?.getElementById(buttonId);
                if (!button) return false;
                button.click();
                return true;
            }, id);
            assert.equal(pressed, true, `#${id} must be on the page`);
            await page.settle();
        };

        const readout = (pickerId) => page.evalFn((id) => {
            const bespoke = document.querySelector('settings-screen')
                .shadowRoot.getElementById('bespoke');
            const picker = bespoke.shadowRoot.getElementById(id);
            const bank = picker.shadowRoot.getElementById('field');
            const labels = [...bank.shadowRoot.querySelectorAll('.label')];
            const digits = [...picker.shadowRoot.querySelectorAll('.digits')];
            return digits.map((span, index) => {
                const label = labels[index];
                const box = label.getBoundingClientRect();
                return {
                    text: span.textContent.trim(),
                    needs: span.getBoundingClientRect().width,
                    room: box.width,
                    clipped: label.scrollWidth > Math.ceil(box.width),
                };
            });
        }, pickerId);

        const pressChip = async (pickerId, index) => {
            await page.evalFn((id, n) => {
                const bespoke = document.querySelector('settings-screen')
                    .shadowRoot.getElementById('bespoke');
                bespoke.shadowRoot.getElementById(id).shadowRoot.getElementById(`chip-${n}`).click();
                return true;
            }, pickerId, index);
            await page.settle();
        };

        const assertLegible = (cells, where) => {
            assert.equal(cells.length, 2, `${where}: the readout is an hour and a minute`);
            for (const cell of cells) {
                assert.match(cell.text, /^\d\d$/,
                    `${where}: a time segment is two digits, and "${cell.text}" is what it holds`);
                assert.equal(cell.clipped, false,
                    `${where}: "${cell.text}" is clipped — the cell shows ${cell.room}px of `
                    + `${cell.needs}px, so the digits become an ellipsis`);
                assert.ok(cell.needs <= cell.room,
                    `${where}: "${cell.text}" needs ${cell.needs}px and the cell reserves `
                    + `${cell.room}px`);
            }
        };

        for (const size of SIZES) {
            test(`the wake-schedule editor shows both digits of the time at ${size}`, async () => {
                await displaySize(size);
                await show('machine', 'machine-sleep-wake-schedules');
                await pressBespoke('schedule-add');

                assertLegible(await readout('schedule-time'), `${size}, as opened`);

                await pressChip('schedule-time', 11);
                assertLegible(await readout('schedule-time'), `${size}, hour chosen`);

                await pressChip('schedule-time', 11);
                assertLegible(await readout('schedule-time'), `${size}, minute chosen`);
            });

            test(`the charger's night-time dialog shows both digits of the time at ${size}`, async () => {
                await displaySize(size);
                await show('accessories', 'accessories-usb-charger');
                await pressBespoke('night-sleep');

                assertLegible(await readout('night-picker'), `${size}, night time`);
            });
        }
    });
}
