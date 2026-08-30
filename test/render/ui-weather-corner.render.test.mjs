/**
 * The corner draws, at the box it was measured for.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/components/ui-weather-corner.js'];
const geometry = GATE_A_GEOMETRIES[0];

const READING = {
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 3,
    isDay: true, code: 2, temperature: 21.4, units: 'metric',
    periods: [
        { id: 'am', label: 'AM', fromHour: 6, toHour: 12, tomorrow: false, probability: 20, amount: 0.2 },
        { id: 'pm', label: 'PM', fromHour: 12, toHour: 18, tomorrow: false, probability: 70, amount: 4.2 },
        { id: 'night', label: 'NIGHT', fromHour: 18, toHour: 6, tomorrow: false, probability: 35, amount: 1.1 },
    ],
};

const host = (reading) => `<ui-weather-corner id="wx"></ui-weather-corner>`;

const mount = (reading, fn) => browser.withPage({ geometry }, async (page) => {
    await page.mount(host(), MODULE);
    if (reading !== undefined) {
        await page.evalFn((r) => { window.__h.need('#wx').reading = r; }, reading);
    }
    await page.settle(3);
    assert.deepEqual(page.pageErrors, [], 'the corner must mount without throwing');
    return fn(page);
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the weather corner', () => {
    test('fills the 290px box the short band gives it', () => mount(READING, async (page) => {
        const box = await page.box('#wx');

        assert.equal(Math.round(box.width), 290, 'the width the short band gives it');
        const over = await page.evalFn(() => {
            const card = window.__h.need('#wx').shadowRoot.querySelector('.card');
            return { scroll: card.scrollHeight, client: card.clientHeight };
        });
        assert.ok(over.scroll <= over.client + 1,
            `the card overflows its box by ${over.scroll - over.client}px`);
    }));

    test('draws the temperature, the mark and both halves of the strip',
        () => mount(READING, async (page) => {
            const seen = await page.evalFn(() => {
                const root = window.__h.need('#wx').shadowRoot;
                return {
                    temp: root.querySelector('.temp .value')?.textContent?.trim(),
                    unit: root.querySelector('.temp .unit')?.textContent?.trim(),
                    marks: root.querySelectorAll('.glyph svg').length,
                    ink: (() => {
                        /* The union of the drawn paths' boxes: zero when the namespace is wrong. */
                        let area = 0;
                        for (const el of root.querySelectorAll('.glyph svg path, .glyph svg circle')) {
                            const b = el.getBoundingClientRect();
                            area += b.width * b.height;
                        }
                        return Math.round(area);
                    })(),
                    glyph: (() => {
                        const r = root.querySelector('.glyph svg').getBoundingClientRect();
                        return [Math.round(r.width), Math.round(r.height)];
                    })(),
                    labels: [...root.querySelectorAll('.half .label')].map((e) => e.textContent.trim()),
                    chances: [...root.querySelectorAll('.half .chance')].map((e) => e.textContent.trim()),
                    title: root.querySelector('.rain .title')?.textContent?.trim(),
                };
            });
            assert.equal(seen.temp, '21', 'the corner rounds; the modal carries the decimal');
            assert.equal(seen.unit, '°C');
            assert.equal(seen.marks, 1);
            assert.deepEqual(seen.glyph, [44, 44],
                'the mark is 44px, beside the temperature rather than above it');
            assert.ok(seen.ink > 0,
                'the mark has no geometry — its paths are in the wrong namespace');
            assert.deepEqual(seen.chances, ['20%', '70%']);
        }));

    test('EVERY LABEL FITS ITS HALF — the reason they are two letters',
        () => mount({ ...READING, periods: [READING.periods[2], READING.periods[0]] },
            async (page) => {
                const fits = await page.evalFn(() => {
                    const root = window.__h.need('#wx').shadowRoot;
                    return [...root.querySelectorAll('.half')].map((half) => {
                        const label = half.querySelector('.label');
                        return { text: label.textContent.trim(), over: label.scrollWidth > half.clientWidth };
                    });
                });
                for (const f of fits) {
                    assert.equal(f.over, false, `${f.text} overflows its half — see the header`);
                }
            }));

    test('exactly one half carries the channel ink, and it is the wetter one',
        () => mount(READING, async (page) => {
            const wet = await page.evalFn(() => {
                const root = window.__h.need('#wx').shadowRoot;
                return [...root.querySelectorAll('.half')].map((h) => h.classList.contains('wet'));
            });
            assert.deepEqual(wet, [false, true], 'PM at 70% is the one to point at');
        }));

    test('a dry pair colours neither half', () => mount({
        ...READING,
        periods: [{ ...READING.periods[0], probability: 5 }, { ...READING.periods[1], probability: 10 }],
    }, async (page) => {
        const wet = await page.evalFn(() => [...window.__h.need('#wx').shadowRoot
            .querySelectorAll('.half')].map((h) => h.classList.contains('wet')));
        assert.deepEqual(wet, [false, false]);
    }));

    test('a period the forecast does not reach draws a dash, never a zero',
        () => mount({
            ...READING,
            periods: [READING.periods[0], { ...READING.periods[1], probability: null, amount: null }],
        }, async (page) => {
            const second = await page.evalFn(() => window.__h.need('#wx').shadowRoot
                .querySelectorAll('.half')[1].querySelector('.chance').textContent.trim());
            assert.equal(second, '—', 'a dash states no forecast; "0 %" would claim a dry night');
        }));

    test('no location set ASKS rather than hiding — the picker is behind the corner',
        () => mount({ ok: false, reason: 'no_location' }, async (page) => {
            const asked = await page.evalFn(() => {
                const root = window.__h.need('#wx').shadowRoot;
                return { prompt: !!root.querySelector('.card.prompt'),
                         text: root.querySelector('.ask')?.textContent?.trim() };
            });
            assert.equal(asked.prompt, true);
            assert.equal(asked.text, 'Set your location');
        }));

    test('an absent plugin draws NOTHING AT ALL — feature-absent, not an error',
        () => mount(null, async (page) => {
            const empty = await page.evalFn(() => {
                const el = window.__h.need('#wx');
                return { cards: el.shadowRoot.querySelectorAll('.card').length,
                         height: Math.round(el.getBoundingClientRect().height) };
            });
            assert.equal(empty.cards, 0, 'nothing is drawn');
            assert.equal(empty.height, 0, 'it adds no height of its own');
        }));

    test('a reading past two hours hides the same way a missing one does',
        () => mount({ ...READING, ageMinutes: 121 }, async (page) => {
            const cards = await page.evalFn(() => window.__h.need('#wx')
                .shadowRoot.querySelectorAll('.card').length);
            assert.equal(cards, 0);
        }));

    test('it is pressable, and pressing it SAYS SO rather than opening anything itself',
        () => mount(READING, async (page) => {
            await page.eval(`window.__opened = 0;
                document.querySelector('#wx').addEventListener('weather-open', () => { window.__opened++; });`);
            await page.click('#wx >>> .card');
            const opened = await page.eval('window.__opened');
            assert.equal(opened, 1, 'one press, one event');
        }));

    test('the empty state is pressable too — it is the only way to set a location',
        () => mount({ ok: false, reason: 'no_location' }, async (page) => {
            await page.eval(`window.__opened = 0;
                document.querySelector('#wx').addEventListener('weather-open', () => { window.__opened++; });`);
            await page.click('#wx >>> .card');
            assert.equal(await page.eval('window.__opened'), 1);
        }));

    test('NO CARD CHROME AT REST — it is part of the rail, not a tile on it',
        () => mount(READING, async (page) => {
            const chrome = await page.evalFn(() => {
                const cs = getComputedStyle(window.__h.need('#wx').shadowRoot.querySelector('.card'));
                return { border: cs.borderTopWidth, bg: cs.backgroundColor };
            });
            assert.equal(chrome.border, '0px', 'no border at rest');
            assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(chrome.bg),
                `the card paints a background at rest: ${chrome.bg}`);
        }));
});
