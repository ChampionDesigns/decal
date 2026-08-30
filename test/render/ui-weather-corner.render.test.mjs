/**
 * ui-weather-corner.render.test.mjs — the corner draws, at the box it was measured for.
 *
 * The numbers asserted below are MEASURED, not chosen: `<ui-rating-control>` on the
 * tablet is 102.1 x 144.2 CSS px under app-root's zoom of 0.6675, so the corner it
 * replaces is 153 x 216 design px. A component that drifts from that leaves the live
 * screen's fourth block a different size from the three controls it stands in for.
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

/* THE ASSERTIONS RUN INSIDE `withPage`. It closes the page when its callback returns, so
 * a helper that resolves WITH the page hands back a dead session — every call then fails
 * with "Session with given id not found", which is what the first draft of this file did. */
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
        /* 320, NOT THE OLD 153. The corner was sized to the three controls it replaced
           (153 x 216, being 3 x 64 + 2 x 12). Ben chose the short-band layout on 30
           August: the band's rule now lands on the left rail's own divider at y 992,
           which leaves the band 172 tall — too short for a 216 stack — and pays for it
           in width. The HEIGHT is deliberately not asserted: the host is block-size
           100% and takes the band's, so a number here would be a second owner of it. */
        /* 290, DOWN FROM 320 ON 30 AUGUST. Ben: "Weather is a bit too wide." The pixels
           are not saved, they are moved: the band's phase table is its only
           minmax(0, 1fr) track, so it gets what the other three blocks leave, and it was
           ellipsising all four of its headers at 365 against the 495 they needed. */
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
            /* THE MARK'S SIZE, NOT JUST ITS EXISTENCE. The first version asserted the svg
             * was there — it was, at its default 300 x 150, invisible and pushing the card
             * out of its box on the tablet. An <svg> with only a viewBox has no intrinsic
             * size, and a <span> wrapper cannot give it one. */
            assert.deepEqual(seen.glyph, [44, 44],
                'the mark is 44px, beside the temperature rather than above it');
            /* AND THAT IT ACTUALLY DRAWS. A fragment written with lit's `html` instead of
             * its `svg` template creates <path> in the HTML namespace: the svg is present,
             * the right size and the right colour, and renders NOTHING. Its paths measure
             * 0 x 0, which is the only signal — there is no error. Found on the tablet. */
            assert.ok(seen.ink > 0,
                'the mark has no geometry — its paths are in the wrong namespace');
            /* The title names the number under it — Ben, 30 August 2026. "Rain" over
               "43%" left the 43 unnamed. It measures 205px in the block's 283. */
            assert.equal(seen.title, 'Chance of rain');
            assert.deepEqual(seen.labels, ['AM', 'PM'], 'the corner takes TWO of the three');
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
            /* THE BAND NO LONGER LEANS ON THIS HOST FOR ITS HEIGHT. It used to: the
               corner declared 216 and the band inherited it, so an absent plugin had to
               keep the box or the rail jumped. The short band takes its height from the
               identity column and the phase table instead, and this host is block-size
               100% of whatever they settle on — 0 when it is measured on its own. */
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
