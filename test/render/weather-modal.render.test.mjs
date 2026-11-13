/**
 * The weather detail: what it draws from a reading, and what its location field says.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { readTable } from '../../scripts/build-i18n.js';

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
    const typeDraft = async (page, typed) => {
        await page.click('#m >>> .place .save');
        await page.settle(2);
        await page.evalFn(() => {
            const field = window.__h.need('#m').shadowRoot.querySelector('#place');
            field.focus();
            field.select();
        });
        await page.send('Input.insertText', { text: typed });
        await page.settle(2);
    };

    const field = (page) => page.evalFn(() => {
        const root = window.__h.need('#m').shadowRoot;
        const input = root.querySelector('#place');
        const failure = root.querySelector('.place .failed');
        return {
            value: input ? input.value : null,
            focused: Boolean(input) && root.activeElement === input,
            failure: failure ? failure.textContent.replace(/\s+/g, ' ').trim() : '',
        };
    });

    const send = async (page, reading) => {
        await page.evalFn((r) => { window.__h.need('#m').reading = r; }, reading);
        await page.settle(3);
    };

    test('a reading with a new place leaves the typed location in the field', () => mount(READING, async (page) => {
        await typeDraft(page, 'Fitzroy, AU');
        assert.equal((await field(page)).value, 'Fitzroy, AU', 'the typing reached the field');
        await send(page, { ...READING, place: 'Carlton, Victoria, Australia', ageMinutes: 1 });
        const seen = await field(page);
        assert.equal(seen.value, 'Fitzroy, AU', 'the new place must not replace the typed location');
        assert.equal(seen.focused, true, 'the field keeps the focus');
    }));

    test('a reading that turns bad, then good again, leaves the typed location in the field',
        () => mount(READING, async (page) => {
            await typeDraft(page, 'Fitzroy, AU');
            await send(page, { ok: false, reason: 'network' });
            const bad = await field(page);
            assert.equal(bad.value, 'Fitzroy, AU', 'a failed reading must not clear the typed location');
            assert.equal(bad.focused, true, 'the field keeps the focus when the reading fails');
            await send(page, { ...READING, place: 'Carlton, Victoria, Australia' });
            const good = await field(page);
            assert.equal(good.value, 'Fitzroy, AU', 'a good reading must not replace the typed location');
            assert.equal(good.focused, true, 'the field keeps the focus when the reading returns');
        }));

    test('a failed save, then a new reading, keeps the typed location and the failure',
        () => mount(READING, async (page) => {
            await page.evalFn(() => {
                window.__h.need('#m').addEventListener('weather-location', (e) => e.detail.respond(false));
            });
            await typeDraft(page, 'Fitzroy, AU');
            await page.press('Enter');
            await page.settle(3);
            assert.equal((await field(page)).failure, 'The location was not saved. Try again.');
            await send(page, { ok: false, reason: 'network' });
            await send(page, { ...READING, place: 'Carlton, Victoria, Australia' });
            const seen = await field(page);
            assert.equal(seen.value, 'Fitzroy, AU', 'the typed location is still in the field');
            assert.equal(seen.failure, 'The location was not saved. Try again.', 'the failure is still said');
        }));

    test('every literal key the modal asks for is in the string table, with a note', () => mount(READING, async (page) => {
        await page.evalFn(async () => {
            const { translations } = await import('/src/lib/i18n.js');
            const plain = translations.t;
            window.__keys = new Set();
            translations.t = (key, params) => { window.__keys.add(key); return plain(key, params); };
            const m = window.__h.need('#m');
            m.reading = { ...m.reading };
            m.addEventListener('weather-location', (e) => {
                e.detail.respond(new Promise((resolve) => { window.__answer = resolve; }));
            });
        });
        await page.settle(2);
        await page.click('#m >>> .place .save');
        await page.settle(2);
        await page.evalFn(() => { window.__h.need('#m').shadowRoot.querySelector('#place').value = 'Fitzroy, AU'; });
        await page.click('#m >>> .place .save');
        await page.settle(2);
        assert.equal(await page.evalFn(() => window.__h.need('#m').saving), true, 'the save is pending');
        await page.evalFn(() => window.__answer(false));
        await page.settle(2);
        assert.equal(await page.evalFn(() => Boolean(window.__h.need('#m').shadowRoot.querySelector('.failed'))),
            true, 'the failed save is said');
        await page.evalFn(() => {
            const m = window.__h.need('#m');
            m.editing = false;
            m.reading = { ok: false, reason: 'no_location' };
        });
        await page.settle(2);
        const asked = await page.evalFn(async (r) => {
            const { conditionWord } = await import('/src/lib/weather-model.js');
            const runtime = new Set([conditionWord(r.code, r.isDay), ...r.periods.map((p) => p.label)]);
            return [...window.__keys].filter((key) => !runtime.has(key));
        }, READING);
        assert.ok(asked.includes('No reading yet. Set a location below and it will arrive shortly.'),
            'the no-location state was drawn');
        const byKey = new Map(readTable().entries.map((entry) => [entry.key, entry]));
        assert.deepEqual(asked.filter((key) => !byKey.has(key)), [],
            'keys the weather modal asks for that are not in i18n/source/strings.json');
        assert.deepEqual(asked.filter((key) => !(byKey.get(key).note || '').trim()), [],
            'weather modal keys in the table with no note');
    }));
});
