/**
 * The weather detail: what it draws from a reading, and what its location field says.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/screens/weather-modal.js'];
const geometry = GATE_A_GEOMETRIES[0];

const READING = Object.freeze({
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 7,
    isDay: true, code: 2, temperature: 21.4, apparent: 20.1, units: 'metric',
    humidity: 64, dewPoint: 14.2, wind: 11, windFrom: 'NW', pressure: 1013,
    periods: [
        { id: 'night', label: 'NIGHT', fromHour: 18, toHour: 6, tomorrow: false, probability: 35, amount: 1.1 },
        { id: 'am', label: 'AM', fromHour: 6, toHour: 12, tomorrow: true, probability: 20, amount: 0.2 },
        { id: 'pm', label: 'PM', fromHour: 12, toHour: 18, tomorrow: true, probability: 70, amount: 4.2 },
    ],
});

const mount = (reading, fn) => browser.withPage({ geometry }, async (page) => {
    await page.mount('<weather-modal id="m" open></weather-modal>', MODULE);
    await page.evalFn((r) => { window.__h.need('#m').reading = r; }, reading);
    await page.settle(3);
    assert.deepEqual(page.pageErrors, [], 'the modal must mount without throwing');
    return fn(page);
});

const READ = () => {
    const root = window.__h.need('#m').shadowRoot;
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    return {
        when: [...root.querySelectorAll('.part .when')].map(text),
        hours: [...root.querySelectorAll('.part .hours')].map(text),
        chances: [...root.querySelectorAll('.part .pc')].map(text),
        amounts: [...root.querySelectorAll('.part .mm')].map(text),
        cells: Object.fromEntries([...root.querySelectorAll('.grid .cell')]
            .map((c) => [text(c.querySelector('.lab')), text(c.querySelector('.v'))])),
        place: text(root.querySelector('.place .current')),
        temp: text(root.querySelector('.now .big')),
        word: text(root.querySelector('.now .word')),
        stamp: text(root.querySelector('.stamp')),
        empty: text(root.querySelector('.body > .note')),
    };
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the weather modal', () => {
    test('draws all three periods, the running one first, with their hours', () => mount(READING, async (page) => {
        const seen = await page.evalFn(READ);
        assert.deepEqual(seen.when, ['NIGHT', 'AM · tomorrow', 'PM · tomorrow']);
        assert.deepEqual(seen.hours, ['18:00 – 06:00', '06:00 – 12:00', '12:00 – 18:00']);
        assert.deepEqual(seen.chances, ['35%', '20%', '70%']);
        assert.deepEqual(seen.amounts, ['1.1 mm expected', '0.2 mm expected', '4.2 mm expected']);
    }));

    test('shows the temperature with its decimal, the condition, humidity and the place',
        () => mount(READING, async (page) => {
            const seen = await page.evalFn(READ);
            assert.equal(seen.temp, '21.4°C');
            assert.equal(seen.word, 'Partly cloudy');
            assert.equal(seen.cells.Humidity, '64%');
            assert.equal(seen.cells['Dew point'], '14.2°C');
            assert.equal(seen.cells.Wind, '11km/h NW');
            assert.equal(seen.cells.Pressure, '1013hPa');
            assert.equal(seen.place, 'Brunswick, Victoria, Australia');
            assert.equal(seen.stamp, 'Updated 7 min ago · Open-Meteo');
        }));

    test('an imperial reading gives rain in inches', () => mount({
        ...READING,
        units: 'imperial', temperature: 70.5, dewPoint: 57.6, wind: 7,
        periods: READING.periods.map((p) => ({ ...p, amount: 0.04 })),
    }, async (page) => {
        const seen = await page.evalFn(READ);
        assert.equal(seen.temp, '70.5°F');
        assert.equal(seen.amounts[0], '0.04 in expected');
        assert.equal(seen.cells.Wind, '7mph NW');
    }));

    test('a missing value draws a dash, never a zero', () => mount({
        ...READING, humidity: null, periods: [{ ...READING.periods[0], probability: null, amount: null }],
    }, async (page) => {
        const seen = await page.evalFn(READ);
        assert.equal(seen.cells.Humidity, '—');
        assert.deepEqual(seen.chances, ['—']);
        assert.deepEqual(seen.amounts, []);
    }));

    test('no location yet says so and offers to set one', () => mount({ ok: false, reason: 'no_location' },
        async (page) => {
            const seen = await page.evalFn(READ);
            assert.match(seen.empty, /^No reading yet/);
            assert.equal(seen.place, 'Not set');
            const button = await page.evalFn(() => window.__h.need('#m').shadowRoot
                .querySelector('.place .save').textContent.trim());
            assert.equal(button, 'Set');
        }));

    test('a typed location is said once, trimmed, and the field closes', () => mount(READING, async (page) => {
        await page.evalFn(() => {
            window.__said = [];
            window.__h.need('#m').addEventListener('weather-location', (e) => window.__said.push(e.detail));
        });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        await page.evalFn(() => { window.__h.need('#m').shadowRoot.querySelector('#place').value = '  Fitzroy, AU  '; });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        const after = await page.evalFn(() => ({
            said: window.__said,
            field: Boolean(window.__h.need('#m').shadowRoot.querySelector('#place')),
        }));
        assert.deepEqual(after.said, [{ location: 'Fitzroy, AU' }]);
        assert.equal(after.field, false, 'the field closes after a save');
    }));

    test('Enter saves the same way', () => mount(READING, async (page) => {
        await page.evalFn(() => {
            window.__said = [];
            window.__h.need('#m').addEventListener('weather-location', (e) => window.__said.push(e.detail));
        });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        await page.evalFn(() => { window.__h.need('#m').shadowRoot.querySelector('#place').value = 'Fitzroy, AU'; });
        await page.press('Enter');
        assert.deepEqual(await page.eval('window.__said'), [{ location: 'Fitzroy, AU' }]);
    }));

    test('an empty field says nothing and stays open', () => mount(READING, async (page) => {
        await page.evalFn(() => {
            window.__said = [];
            window.__h.need('#m').addEventListener('weather-location', (e) => window.__said.push(e.detail));
        });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        await page.evalFn(() => { window.__h.need('#m').shadowRoot.querySelector('#place').value = '   '; });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        const after = await page.evalFn(() => ({
            said: window.__said,
            field: Boolean(window.__h.need('#m').shadowRoot.querySelector('#place')),
        }));
        assert.deepEqual(after.said, []);
        assert.equal(after.field, true);
    }));
});
