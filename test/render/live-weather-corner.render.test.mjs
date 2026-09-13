/**
 * The corner is weather's or the shot's. The Live band's fourth block carries the shot's
 * post-shot actions or the weather reading, one at a time, and a fresh reading takes it.
 * All five states a `weather` payload can produce are mounted at both render geometries.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** A reading the corner draws: fresh, located, with today's range and three periods. */
const FRESH = Object.freeze({
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 3,
    isDay: true, code: 2, temperature: 21.4, units: 'metric', high: 26, low: 12,
    periods: [
        { id: 'am', label: 'AM', probability: 20, amount: 0.2 },
        { id: 'pm', label: 'PM', probability: 70, amount: 4.2 },
        { id: 'night', label: 'NIGHT', probability: 35, amount: 1.1 },
    ],
});

/** The five states. `weatherState` hides a stale reading and a failed one. */
const STATES = Object.freeze([
    ['no weather at all', null, false],
    ['no location has ever been set', { ok: false, reason: 'no_location' }, true],
    ['a valid reading', FRESH, true],
    ['a reading that has aged out', { ...FRESH, ageMinutes: 240 }, false],
    ['a failed read', { ok: false, reason: 'network' }, false],
]);

const configure = (page, patch) => page.evalFn(async (props) => {
    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
    const screen = window.__h.q('live-screen');
    screen.limits = r2MachineLimits(['cupWarmer']).value;
    Object.assign(screen, props);
    await screen.updateComplete;
}, patch);

/**
 * The block, measured. `reach` is the band's own scroll extent rather than its client
 * box, because the band is the screen's last-resort scroller.
 */
const READ_BLOCK = `(() => {
  const root = window.__h.q('live-screen').shadowRoot;
  const band = root.querySelector('live-foot').shadowRoot.querySelector('.band');
  const controls = root.querySelector('.foot-controls');
  const rate = root.querySelector('ui-rating-control');
  const wx = root.querySelector('ui-weather-corner');
  const bandBox = band.getBoundingClientRect();
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
  };
  const inRate = (id) => (rate ? box(rate.shadowRoot.getElementById(id)) : null);
  return {
    children: [...controls.children].map((el) => el.tagName.toLowerCase()),
    controls: box(controls),
    weather: box(wx),
    weatherInk: wx ? wx.shadowRoot.textContent.replace(/\\s+/g, ' ').trim() : null,
    rainDrawn: wx ? Boolean(wx.shadowRoot.querySelector('.rain')?.getBoundingClientRect().height) : null,
    tempDrawn: wx ? Boolean(wx.shadowRoot.querySelector('.temp')?.getBoundingClientRect().height) : null,
    rate: box(rate),
    score: inRate('rate'),
    notes: inRate('notes'),
    handoff: inRate('handoff'),
    band: { top: +bandBox.top.toFixed(1), height: +bandBox.height.toFixed(1),
            reach: +(bandBox.top + band.scrollHeight).toFixed(1),
            scrollHeight: band.scrollHeight, clientHeight: band.clientHeight },
    inlineOverflow: band.scrollWidth > band.clientWidth + 1,
  };
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the Live corner @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const withShot = (weather, fn, extra = {}) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            await configure(page, {
                weather,
                shotId: 'shot-1',
                rating: 73,
                dye2: true,
                historyCount: 12,
                storedShot: {
                    id: 'shot-1',
                    timestamp: '2026-08-13T10:15:57.783240',
                    workflow: { profile: { title: 'Extractamundo Dos! (2)' } },
                },
                storedDerivation: {
                    ok: true,
                    scalars: {
                        durationSeconds: 45, dose: 18, yield: 39, ratio: 2.2,
                        timeToFirstDrop: 8, averageFlow: 2.1, peakFlowAfterFirstDrop: 2.8,
                        averagePressure: 6.1, peakPressure: 9,
                    },
                    phases: {
                        preinfusion: { seconds: 15, weight: 10, volume: 17 },
                        extraction: { seconds: 30, weight: 29, volume: 30 },
                        total: { seconds: 45, weight: 39, volume: 47 },
                    },
                },
                ...extra,
            });
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the band must render without throwing');
            await fn(page);
        });

        for (const [name, weather, corner] of STATES) {
            test(`the corner holds one thing, and weather takes it — ${name}`,
                () => withShot(weather, async (page) => {
                    const got = await page.eval(READ_BLOCK);

                    assert.deepEqual(got.children,
                        corner ? ['ui-weather-corner'] : ['ui-rating-control'],
                        `the corner holds ${JSON.stringify(got.children)}`);

                    if (corner) {
                        assert.equal(Math.round(got.weather.w), 245,
                            'the corner is the sideways block at its own stated width');
                        assert.equal(got.tempDrawn, weather === FRESH,
                            'a located reading draws its temperature; the prompt draws the ask');
                        assert.equal(got.rate, null,
                            'the shot\'s buttons are absent, not shrunk');
                        return;
                    }

                    for (const [key, el] of [['score', got.score], ['notes', got.notes], ['handoff', got.handoff]]) {
                        assert.ok(el && el.w > 0 && el.h > 0,
                            `${key} has no box: ${JSON.stringify(el)}`);
                        assert.ok(el.h >= 44,
                            `${key} is under the hit floor at ${el.h}px: ${JSON.stringify(el)}`);
                    }

                    assert.ok(got.notes.bottom <= got.band.reach + 1,
                        `the notes button ends at ${got.notes.bottom} and the band's content `
                        + `reaches ${got.band.reach}`);
                    assert.ok(got.score.top >= got.band.top - 1,
                        `the rating starts above the band's own scroll origin (${got.score.top} `
                        + `against ${got.band.top}) — a scroll container cannot scroll upward`);

                    assert.equal(got.inlineOverflow, false,
                        'the band must not overflow on the inline axis');
                }));
        }

        test('the corner NEVER COSTS THE CHART HEIGHT', () => withShot(FRESH, async (page) => {
            /* The claim is one-way: a corner holding weather may not ask for more band than
               the same corner holding the shot's buttons. */
            const withWeather = await page.eval(READ_BLOCK);
            await configure(page, { weather: null });
            await page.settle(4);
            const without = await page.eval(READ_BLOCK);

            assert.deepEqual(withWeather.children, ['ui-weather-corner']);
            assert.deepEqual(without.children, ['ui-rating-control']);
            assert.ok(withWeather.band.height <= without.band.height + 0.51,
                `weather grew the band from ${without.band.height} to `
                + `${withWeather.band.height} and took it off the chart`);
            assert.ok(withWeather.band.scrollHeight <= without.band.scrollHeight,
                `weather grew what the band has to scroll: ${withWeather.band.scrollHeight} `
                + `against ${without.band.scrollHeight}`);
        }));

        test('the rain strip is drawn, because nothing is sharing the width',
            () => withShot(FRESH, async (page) => {
                const got = await page.eval(READ_BLOCK);
                assert.match(got.weatherInk, /Chance of rain/);
                assert.equal(got.rainDrawn, true,
                    'the rain strip is on the band');
            }));

        test('while the record is still being written, weather still holds the corner',
            () => withShot(FRESH, async (page) => {
                await configure(page, { shotSaving: true });
                await page.settle(4);
                const got = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const controls = root.querySelector('.foot-controls');
                    return {
                        children: [...controls.children].map((el) => el.tagName.toLowerCase()),
                        waiting: Boolean(root.querySelector('.rating-waiting')),
                    };
                });
                assert.deepEqual(got.children, ['ui-weather-corner'],
                    'the waiting line waits its turn like the rating does');
                assert.equal(got.waiting, false);
            }));
    });
}
