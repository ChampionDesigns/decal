/**
 * One temperature preference, from the gauge through the drawn series to the axis,
 * the legend and the cursor's reading, and back again.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';

const SCREEN_MODULE = ['/src/screens/live-screen.js'];
const CARD_MODULE = ['/src/components/ui-chart-card.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

const CELSIUS = 93;
const FAHRENHEIT = 199.4;

const RECORD = `(() => {
  const base = Date.parse('2026-08-17T09:15:00.000Z');
  const at = (ms) => new Date(base + ms).toISOString();
  const measurements = [];
  for (let i = 0; i < 8; i += 1) {
    measurements.push({
      machine: {
        timestamp: at(i * 1000),
        state: { state: 'espresso', substate: 'pouring' },
        flow: 2, pressure: 9, targetFlow: 2, targetPressure: 9,
        mixTemperature: ${CELSIUS}, groupTemperature: ${CELSIUS},
        targetMixTemperature: ${CELSIUS}, targetGroupTemperature: ${CELSIUS},
        profileFrame: 0, steamTemperature: 140,
      },
      scale: { timestamp: at(i * 1000), weight: i, weightFlow: 1, battery: 80, timerValue: i * 1000 },
    });
  }
  return { id: 'temp-unit', timestamp: at(0), measurements };
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const cardStage = `
<div id="stage" style="inline-size: 760px; block-size: 340px; margin: 24px">
  <ui-chart-card id="c" label="Temperature" scrub-label="Temperature scrub"
    y-policy="temp" channels="groupTemp targetTemp mixTemp targetMixTemp"
    style="display: block; block-size: 340px"></ui-chart-card>
</div>`;

const FEED_CARD = (unit) => `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const el = document.getElementById('c');
  await el.ready;
  window.__record = window.__record ?? ${RECORD};
  window.__derivation = window.__derivation ?? deriveFromRecord(window.__record);
  el.tempUnit = ${JSON.stringify(unit)};
  el.derivation = window.__derivation;
  await el.updateComplete;
  el.drawNow();
  await new Promise((r) => requestAnimationFrame(r));
  return { ok: el.derivation.ok, hasPlot: Boolean(el.plotHandle) };
})()`;

const READ_CARD = `(() => {
  const el = document.getElementById('c');
  const raw = el.plotHandle.raw;
  const i = el.channels.findIndex((c) => c.key === 'groupTemp');
  return {
    drawn: raw.data[i + 1][3],
    band: [raw.scales.y.min, raw.scales.y.max],
    stored: window.__derivation.series.groupTemp.y[3],
    storedAll: [...window.__derivation.series.groupTemp.y],
    cursor: el.cursor.active ? el.cursor.values.groupTemp : null,
  };
})()`;

describe('the chart card draws degrees in the preference\'s own unit', () => {
    test('93 C reads 199.4 F on the canvas, on the axis and at the cursor — and comes back',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(cardStage, CARD_MODULE);
            const fed = await page.eval(FEED_CARD('C'));
            assert.equal(fed.ok, true, 'the fixture must derive');
            assert.equal(fed.hasPlot, true);

            const celsius = await page.eval(READ_CARD);
            assert.equal(celsius.drawn, CELSIUS, 'Celsius draws the wire\'s own number');
            assert.ok(celsius.band[0] <= CELSIUS && celsius.band[1] >= CELSIUS,
                `the Celsius band must contain the reading: ${JSON.stringify(celsius.band)}`);

            await page.eval(FEED_CARD('F'));
            const box = await page.box('#c >>> .well');
            await page.mouse('mouseMoved', box.left + box.width / 2, box.top + box.height / 2);
            const fahrenheit = await page.eval(READ_CARD);

            assert.ok(Math.abs(fahrenheit.drawn - FAHRENHEIT) < 1e-9,
                `the canvas holds ${fahrenheit.drawn}, not ${FAHRENHEIT}`);
            assert.ok(Math.abs(fahrenheit.cursor - FAHRENHEIT) < 1e-9,
                `the cursor names ${fahrenheit.cursor}, not ${FAHRENHEIT}`);
            assert.ok(fahrenheit.band[0] <= FAHRENHEIT && fahrenheit.band[1] >= FAHRENHEIT,
                `the Fahrenheit band must contain the reading: ${JSON.stringify(fahrenheit.band)}`);
            assert.ok(fahrenheit.band[0] > celsius.band[1],
                `the band did not convert at all: ${JSON.stringify(fahrenheit.band)} against `
                + `${JSON.stringify(celsius.band)}`);

            assert.equal(fahrenheit.stored, CELSIUS,
                'the derivation the card was handed was rewritten in place');
            assert.ok(fahrenheit.storedAll.every((v) => v === CELSIUS),
                'some sample of the stored series was converted');

            await page.eval(FEED_CARD('C'));
            const back = await page.eval(READ_CARD);
            assert.equal(back.drawn, CELSIUS, 'flipping back must restore the canvas');
            assert.ok(back.band[0] <= CELSIUS && back.band[1] >= CELSIUS,
                `the restored band must contain the reading: ${JSON.stringify(back.band)}`);
            assert.ok(back.band[1] < fahrenheit.band[0],
                `the band is still in Fahrenheit: ${JSON.stringify(back.band)}`);
            assert.deepEqual(page.pageErrors, []);
        }));
});

const configure = (page, patch) => page.evalFn(async (props) => {
    const { r2MachineLimits } = await import('/src/data/adapters-r.js');
    const screen = window.__h.q('live-screen');
    screen.limits = r2MachineLimits(['cupWarmer']).value;
    Object.assign(screen, props);
    await screen.updateComplete;
}, patch);

const FEED_SCREEN = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const screen = document.querySelector('live-screen');
  await screen.updateComplete;
  window.__record = ${RECORD};
  window.__derivation = deriveFromRecord(window.__record);
  screen.storedDerivation = window.__derivation;
  screen.storedShot = { id: 'temp-unit', timestamp: '2026-08-13T10:15:57.783240',
                        workflow: { profile: { title: 'Bench' } } };
  screen.shotId = 'temp-unit';
  await screen.updateComplete;
  return window.__derivation.ok;
})()`;

const READ_EXPANDED = `(async () => {
  const screen = document.querySelector('live-screen');
  const overlay = screen.shadowRoot.querySelector('live-expanded-chart');
  const card = overlay.shadowRoot.getElementById('plot-temp');
  await card.ready;
  await overlay.updateComplete;
  card.drawNow();
  await new Promise((r) => requestAnimationFrame(r));
  const raw = card.plotHandle.raw;
  const i = card.channels.findIndex((c) => c.key === 'groupTemp');
  const legend = overlay.shadowRoot.querySelector('ui-chart-legend[chart="plot-temp"]');
  return {
    unit: card.getAttribute('temp-unit'),
    drawn: raw.data[i + 1][3],
    band: [raw.scales.y.min, raw.scales.y.max],
    labels: legend.items.filter((item) => item.key.endsWith('Temp')).map((item) => item.label),
    stored: window.__derivation.series.groupTemp.y[3],
  };
})()`;

const READ_SCREEN = `(() => {
  const screen = document.querySelector('live-screen');
  const root = screen.shadowRoot;
  const tiles = [...root.querySelectorAll('.gauges ui-stat-tile')]
    .map((el) => ({ label: el.label, value: el.value, unit: el.unit }));
  const card = root.getElementById('live-chart');
  return {
    tempUnit: screen.tempUnit,
    group: tiles.find((t) => t.label === 'Group') ?? null,
    steam: tiles.find((t) => t.label === 'Steam') ?? null,
    y2: card.y2 ? [...(typeof card.y2.range === 'function' ? card.y2.range() : card.y2.range)] : null,
    y2Same: card.y2,
    liveGroup: (() => { const i = card.channels.findIndex(c => c.key === 'groupTemp'); return i < 0 ? null : card.plotHandle?.raw.data[i + 1]?.[3]; })(),
  };
})()`;

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the Live screen's temperature unit @ ${geometry.name}`, () => {

        const live = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, SCREEN_MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'and run without throwing');
        });

        test('93 C reads 199.4 F on the gauge AND on the expanded chart, and returns',
            () => live(async (page) => {
                assert.equal(await page.eval(FEED_SCREEN), true);
                await configure(page, {
                    tempUnit: 'c',
                    readings: { group: CELSIUS, steamTemperature: 140, pressure: 9, flow: 2, weight: 12 },
                });
                await page.evalFn(() => {
                    const screen = window.__h.q('live-screen');
                    screen._expanded = true;
                    return screen.updateComplete;
                });
                await page.settle(4);

                const cScreen = await page.eval(READ_SCREEN);
                const cChart = await page.eval(READ_EXPANDED);
                assert.equal(cScreen.group.value, '93.0', 'the Celsius gauge');
                assert.equal(cScreen.group.unit, '°C');
                assert.equal(cChart.drawn, CELSIUS, 'and the Celsius plot');
                assert.equal(cScreen.liveGroup, CELSIUS / 10,
                    'the Live trace is the canonical Celsius over ten');
                assert.ok(cChart.labels.every((l) => l.includes('°C')),
                    `the Celsius legend: ${JSON.stringify(cChart.labels)}`);

                await configure(page, { tempUnit: 'f' });
                await page.settle(4);
                const fScreen = await page.eval(READ_SCREEN);
                const fChart = await page.eval(READ_EXPANDED);

                assert.equal(fScreen.group.value, '199.4', 'the gauge follows the preference');
                assert.equal(fScreen.group.unit, '°F');
                assert.equal(fScreen.liveGroup, CELSIUS / 10,
                    'the Live trace does not follow the preference — it carries no unit to be wrong in');
                assert.equal(fChart.unit, 'F', 'and the preference reaches the card');
                assert.ok(Math.abs(fChart.drawn - FAHRENHEIT) < 1e-9,
                    `the expanded plot holds ${fChart.drawn}, not ${FAHRENHEIT}`);
                assert.ok(fChart.band[0] <= FAHRENHEIT && fChart.band[1] >= FAHRENHEIT,
                    `and its axis must contain it: ${JSON.stringify(fChart.band)}`);
                assert.ok(fChart.labels.every((l) => l.includes('°F')),
                    `the legend must say so too: ${JSON.stringify(fChart.labels)}`);
                assert.equal(fChart.stored, CELSIUS,
                    'the stored telemetry stays canonical Celsius');

                await configure(page, { tempUnit: 'c' });
                await page.settle(4);
                const back = await page.eval(READ_EXPANDED);
                assert.equal(back.drawn, CELSIUS, 'and it all comes back');
                assert.ok(back.band[0] <= CELSIUS && back.band[1] >= CELSIUS,
                    `the restored band must contain the reading: ${JSON.stringify(back.band)}`);
                assert.ok(back.band[1] < fChart.band[0],
                    `the band is still in Fahrenheit: ${JSON.stringify(back.band)}`);
                assert.ok(back.labels.every((l) => l.includes('°C')));
            }));

        test('the steam chart\'s right-hand axis follows the same preference, once',
            () => live(async (page) => {
                await configure(page, {
                    tempUnit: 'c',
                    machineState: 'steam',
                    chartMode: 'steam',
                    readings: { steamTemperature: 140 },
                });
                await page.settle(4);
                const celsius = await page.eval(READ_SCREEN);
                assert.deepEqual(celsius.y2, [0, 195], 'the steam axis, in Celsius');

                await configure(page, { tempUnit: 'f' });
                await page.settle(4);
                const fahrenheit = await page.eval(READ_SCREEN);
                assert.deepEqual(fahrenheit.y2, [32, 383],
                    `the steam axis did not follow the preference: ${JSON.stringify(fahrenheit.y2)}`);

                const stable = await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    const card = screen.shadowRoot.getElementById('live-chart');
                    const first = card.y2;
                    screen.requestUpdate();
                    await screen.updateComplete;
                    return card.y2 === first;
                });
                assert.equal(stable, true,
                    'the y2 bound is rebuilt every render, which rebuilds the plot with it');
            }));
    });
}

const absentStand = (unit, fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, SCREEN_MODULE);
    await page.evalFn(async (stored) => {
        const { createLiveStores, FEED } = await import('/src/stores/live-stores.js');
        const { createStorageRouter } = await import('/src/lib/storage-router.js');
        const { createMemoryBackend } = await import('/src/lib/storage-backends.js');
        const { LAYERS } = await import('/src/lib/storage-routes.js');
        const storage = createStorageRouter({
            backends: {
                [LAYERS.kv]: createMemoryBackend(),
                [LAYERS.kvNumpad]: createMemoryBackend(),
                [LAYERS.local]: createMemoryBackend(),
                [LAYERS.session]: createMemoryBackend(),
            },
        });
        await storage.set('tempUnit', stored);
        const live = createLiveStores({
            sockets: { channel() { throw new Error('no channels in this fixture'); } },
        });
        live.feed(FEED.CONNECTION).accept({
            devices: [{ id: 'bench', name: 'Bench', type: 'machine', state: 'connected', available: true }],
            scanning: false,
            connectionStatus: { phase: 'ready', foundMachines: [], foundScales: [], pendingAmbiguity: null },
        });
        const screen = document.querySelector('live-screen');
        screen.boot = { live, storage };
        await screen.updateComplete;
        window.__absent = { live, FEED, screen };
    }, unit);
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    await fn(page);
    assert.deepEqual(page.pageErrors, [], 'and run without throwing');
});

const snapshot = (page, withTemps) => page.evalFn(async (temps) => {
    const { live, FEED, screen } = window.__absent;
    live.feed(FEED.MACHINE).accept({
        timestamp: new Date().toISOString(),
        state: { state: 'idle', substate: 'idle' },
        pressure: 0,
        flow: 0,
        ...(temps ? { groupTemperature: 93, steamTemperature: 140 } : {}),
    });
    await new Promise((resolve) => setTimeout(resolve, 260));
    await screen.updateComplete;
}, withTemps);

const TILES = `(() => {
  const screen = document.querySelector('live-screen');
  const tiles = [...screen.shadowRoot.querySelectorAll('.gauges ui-stat-tile')]
    .map((el) => ({ label: el.label, value: el.value, unit: el.unit }));
  return {
    unit: screen.tempUnit,
    held: screen.readings ? { group: screen.readings.group, steam: screen.readings.steam } : null,
    group: tiles.find((t) => t.label === 'Group') ?? null,
    steam: tiles.find((t) => t.label === 'Steam') ?? null,
  };
})()`;

describe('a temperature tile with no reading', () => {

    const READS = { c: ['93.0', '140.0'], f: ['199.4', '284.0'] };

    for (const [stored, symbol] of [['c', '°C'], ['f', '°F']]) {
        test(`stays absent in ${symbol}`, () => absentStand(stored, async (page) => {
            await snapshot(page, true);
            const reading = await page.eval(TILES);
            assert.equal(reading.group.unit, symbol, 'the stored preference reached the tile');
            assert.equal(reading.group.value, READS[stored][0], 'the Group tile reads the frame');
            assert.equal(reading.steam.value, READS[stored][1], 'and so does Steam');

            await snapshot(page, false);
            const absent = await page.eval(TILES);
            assert.equal(absent.held.group, null,
                'the controller writes null for a channel the frame does not carry');
            assert.equal(absent.held.steam, null);
            assert.equal(absent.group.value, '—',
                `an absent Group read "${absent.group.value}" in ${symbol}`);
            assert.equal(absent.steam.value, '—',
                `an absent Steam read "${absent.steam.value}" in ${symbol}`);
        }));
    }
});

