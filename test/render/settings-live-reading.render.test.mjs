/**
 * A live machine reading is drawn in the unit its own row band spells.
 *
 * The snapshot is Celsius on every channel; the band, the target and the symbol arrive
 * converted. These assert on what `ui-settings-row` prints, and on a non-temperature row
 * too, so a conversion keyed on "this row is live" rather than on the band still fails.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-reading-leaf-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const STEAM = 'machine-steam-temp';
const HOT_WATER = 'machine-hot-water-temp';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a live settings reading follows the temperature unit its caption spells', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        assert.deepEqual(page.pageErrors, [], 'the leaves must mount without throwing');
    });

    after(async () => { await page?.close(); });

    const reading = (leaf, row) => page.evalFn(
        (l, r) => globalThis.__liveReadingLeaf.readingOf(l, r), leaf, row);

    const chooseUnit = (value) => page.evalFn(
        (v) => globalThis.__liveReadingLeaf.chooseUnit(v), value);

    const publish = (frame) => page.evalFn(
        (f) => globalThis.__liveReadingLeaf.frame(f), frame);

    test('in Celsius it is the machine\'s own number', async () => {
        await chooseUnit('c');
        await publish({ steamTemperature: 150, groupTemperature: 90, pressure: 9 });

        assert.equal((await reading('steam', STEAM)).text, 'now 150 °C');
        assert.equal((await reading('hotWater', HOT_WATER)).text, 'now 90 °C');
    });

    test('in Fahrenheit the number converts, and the symbol moves with it', async () => {
        await chooseUnit('f');

        const steam = await reading('steam', STEAM);
        assert.equal(steam.text, 'now 302 °F', '150 °C is 302 °F');
        assert.equal(steam.unit, '°F', 'the band the caption borrows its symbol from');

        const hotWater = await reading('hotWater', HOT_WATER);
        assert.equal(hotWater.text, 'now 194 °F', '90 °C is 194 °F');
        assert.equal(hotWater.unit, '°F');
    });

    test('the number and the unit move together when the choice changes under an open page',
        async () => {

            await chooseUnit('c');
            assert.equal((await reading('steam', STEAM)).text, 'now 150 °C');

            await chooseUnit('f');
            assert.equal((await reading('steam', STEAM)).text, 'now 302 °F');

            await chooseUnit('c');
            assert.equal((await reading('steam', STEAM)).text, 'now 150 °C');
        });

    test('a reading in bar is the same number in either unit', async () => {
        for (const unit of ['c', 'f']) {
            await chooseUnit(unit);
            const pressure = await reading('mixed', 'stub-pressure');
            assert.equal(pressure.text, 'now 9 bar', `bar moved with the preference in ${unit}`);
            const steam = await reading('mixed', 'stub-steam-temp');
            assert.equal(steam.text, 'now 302 °F',
                'and the temperature beside it, on the same frame, did convert');
        }
    });

    test('a channel the machine is not reporting stays absent in either unit', async () => {
        for (const unit of ['c', 'f']) {
            await chooseUnit(unit);
            await publish({ groupTemperature: 90 });
            const steam = await reading('steam', STEAM);
            assert.equal(steam.text, steam.dash, `a silent channel printed a number in ${unit}`);
        }
    });

    test('a zero reading stays absent in Fahrenheit, where zero converts to 32', async () => {

        await chooseUnit('f');
        await publish({ steamTemperature: 0, groupTemperature: 90 });

        const steam = await reading('steam', STEAM);
        assert.equal(steam.text, steam.dash);
        assert.equal((await reading('hotWater', HOT_WATER)).text, 'now 194 °F',
            'and the row beside it still reads, so the frame really arrived');
    });
});
