/**
 * Render tests for the temperature unit on the History screen.
 *
 * Checks that the stored preference reaches the phase table, the flow page's traces,
 * its axis and its key, that each states the unit it is drawing, and that switching
 * back returns the original values.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const CELSIUS = 93;
const FAHRENHEIT = 199.4;
const EX_BAND_C = '93➔95';
const EX_BAND_F = '199➔203';
const PI_BAND_C = '85➔91';
const PI_BAND_F = '185➔196';

const RECORD = (id) => `(() => {
  const base = Date.parse('2026-08-17T09:15:00.000Z');
  const at = (ms) => new Date(base + ms).toISOString();
  const pi = [85, 87, 89, 91];
  const ex = [93, 95, 93, 95, 93, 95, 93, 95];
  const measurements = [];
  for (let i = 0; i < pi.length + ex.length; i += 1) {
    const pouring = i >= pi.length;
    const group = pouring ? ex[i - pi.length] : pi[i];
    measurements.push({
      machine: {
        timestamp: at(i * 1000),
        state: { state: 'espresso', substate: pouring ? 'pouring' : 'preinfusion' },
        flow: pouring ? 2 : 0.5, pressure: pouring ? 9 : 3,
        targetFlow: 2, targetPressure: 9,
        mixTemperature: group, groupTemperature: group,
        targetMixTemperature: 94, targetGroupTemperature: 94,
        profileFrame: pouring ? 1 : 0, steamTemperature: 140,
      },
      scale: { timestamp: at(i * 1000), weight: i, weightFlow: 1, battery: 80, timerValue: i * 1000 },
    });
  }
  return { id: ${JSON.stringify(id)}, timestamp: at(0), measurements };
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const dataStage = `
<div id="stage" style="inline-size: 1100px; block-size: 760px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-data-page id="page-under-test"></history-data-page>
</div>`;

const FEED_DATA = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const el = document.querySelector('history-data-page');
  window.__record = window.__record ?? ${RECORD('temp-a')};
  window.__derivation = window.__derivation ?? deriveFromRecord(window.__record);
  el.derivationA = window.__derivation;
  el.rows = [];
  await el.updateComplete;
  return window.__derivation.ok;
})()`;

const SET_DATA_UNIT = (unit) => `(async () => {
  const el = document.querySelector('history-data-page');
  el.tempUnit = ${JSON.stringify(unit)};
  await el.updateComplete;
  await Promise.all([...el.renderRoot.querySelectorAll('ui-data-grid')].map((g) => g.updateComplete));
  await new Promise((r) => requestAnimationFrame(r));
  return true;
})()`;

const READ_TABLE = `(() => {
  const el = document.querySelector('history-data-page');
  const grid = el.renderRoot.getElementById('table-a');
  const cells = {};
  for (const cell of grid.renderRoot.querySelectorAll('.cell')) {
    if (!cell.id.endsWith('-temp')) continue;
    cells[cell.id] = cell.textContent.replace(/\\s+/g, '');
  }
  const unit = grid.renderRoot.getElementById('unit-temp');
  return {
    /* THE HEADER AS THE GRID DREW IT, not as the page declared it. */
    unit: unit ? unit.textContent.trim() : null,
    cells,
    stored: [...window.__derivation.series.groupTemp.y],
  };
})()`;

describe('the History phase table\'s Temp column follows the preference', () => {
    test('93..95 C reads 199..203 F in both phase rows, states its unit, and comes back',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(dataStage, ['/src/screens/history-data-page.js']);
            assert.equal(await page.eval(FEED_DATA), true, 'the fixture must derive');

            await page.eval(SET_DATA_UNIT('c'));
            const celsius = await page.eval(READ_TABLE);

            const banded = (read) => Object.values(read.cells)
                .filter((text) => /\d/.test(text)).sort();
            assert.deepEqual(banded(celsius), [EX_BAND_C, PI_BAND_C].sort(),
                `the Celsius table must print the fixture's own bands: `
                + `${JSON.stringify(celsius.cells)}`);
            assert.equal(celsius.unit, '(°C)', 'the Celsius header must say which degree it is');

            await page.eval(SET_DATA_UNIT('f'));
            const fahrenheit = await page.eval(READ_TABLE);
            assert.deepEqual(banded(fahrenheit), [EX_BAND_F, PI_BAND_F].sort(),
                `the Fahrenheit table must convert BOTH ends of each band: `
                + `${JSON.stringify(fahrenheit.cells)}`);
            assert.equal(fahrenheit.unit, '(°F)', 'and the header must follow the cells');

            assert.ok(fahrenheit.stored.every((v) => v <= 100),
                'the derivation the page was handed was rewritten in place');

            await page.eval(SET_DATA_UNIT('c'));
            const back = await page.eval(READ_TABLE);
            assert.deepEqual(back.cells, celsius.cells,
                'flipping back must restore the Celsius cells exactly');
            assert.equal(back.unit, '(°C)');
            assert.deepEqual(page.pageErrors, []);
        }));
});

const flowStage = `
<div id="stage" style="inline-size: 1100px; block-size: 760px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-flow-page id="page-under-test"></history-flow-page>
</div>`;

const FEED_FLOW = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const el = document.querySelector('history-flow-page');
  window.__record = window.__record ?? ${RECORD('temp-a')};
  window.__recordB = window.__recordB ?? ${RECORD('temp-b')};
  window.__derivation = window.__derivation ?? deriveFromRecord(window.__record);
  window.__derivationB = window.__derivationB ?? deriveFromRecord(window.__recordB);
  el.derivationA = window.__derivation;
  el.derivationB = window.__derivationB;
  await el.updateComplete;
  return window.__derivation.ok && window.__derivationB.ok;
})()`;

const scrub = async (page) => {
    const box = await page.box('history-flow-page >>> #plot-temp >>> .well');
    await page.mouse('mouseMoved', box.left + box.width * 0.3, box.top + box.height / 2);
    await page.mouse('mouseMoved', box.left + box.width / 2, box.top + box.height / 2);
    await page.eval('(async () => { const el = document.querySelector("history-flow-page");'
        + ' await el.updateComplete; return true; })()');
};

const SET_FLOW_UNIT = (unit) => `(async () => {
  const el = document.querySelector('history-flow-page');
  el.tempUnit = ${JSON.stringify(unit)};
  await el.updateComplete;
  const cards = [...el.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  for (let i = 0; i < 6; i += 1) await new Promise((r) => requestAnimationFrame(r));
  for (const c of cards) c.drawNow();
  await new Promise((r) => requestAnimationFrame(r));
  return true;
})()`;

const READ_FLOW = `(() => {
  const el = document.querySelector('history-flow-page');
  const card = el.renderRoot.getElementById('plot-temp');
  const raw = card.plotHandle.raw;
  const at = (key) => {
    const i = card.channels.findIndex((c) => c.key === key);
    return i < 0 ? null : raw.data[i + 1][4];
  };
  const legend = el.renderRoot.querySelector('ui-chart-legend[chart="plot-temp"]');
  const foot = card.querySelector('.reading');
  return {
    attr: card.getAttribute('temp-unit'),
    /* THE CURSOR'S OWN TWO SURFACES: the number on the chip and the announced line. Both
       are composed by the page out of the records it handed the plot, so both follow the
       drawn unit or none of them do. */
    chip: legend.values ? legend.values.groupTemp ?? null : null,
    line: foot ? foot.textContent.trim() : '',
    a: at('groupTemp'),
    b: at('b:groupTemp'),
    band: [raw.scales.y.min, raw.scales.y.max],
    labels: legend.items.filter((item) => /°/.test(item.label)).map((item) => item.label),
    series: raw.series.length,
    stored: window.__derivation.series.groupTemp.y[4],
  };
})()`;

describe('the History flow page draws degrees in the preference\'s own unit', () => {
    test('93 C reads 199.4 F on A\'s trace, on B\'s, on the axis and in the key — and comes back',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(flowStage, ['/src/screens/history-flow-page.js']);
            assert.equal(await page.eval(FEED_FLOW), true, 'both fixtures must derive');

            await page.eval(SET_FLOW_UNIT('c'));
            await scrub(page);
            const celsius = await page.eval(READ_FLOW);
            assert.equal(celsius.a, CELSIUS, 'Celsius draws the wire\'s own number');
            assert.equal(celsius.b, CELSIUS, 'and so does the comparison');
            assert.ok(celsius.labels.every((l) => l.includes('°C')),
                `the Celsius key must say °C — ${JSON.stringify(celsius.labels)}`);
            assert.equal(celsius.chip, '95.0',
                'the Celsius chip must name the sample the crosshair is standing on');
            assert.ok(celsius.line.includes('Group °C 95.0'),
                `the announced line must agree with the chip — ${celsius.line}`);

            await page.eval(SET_FLOW_UNIT('f'));
            await scrub(page);
            const fahrenheit = await page.eval(READ_FLOW);
            assert.equal(fahrenheit.attr, 'F', 'the page must hand the unit to the card');
            assert.ok(Math.abs(fahrenheit.a - FAHRENHEIT) < 1e-9,
                `A's trace holds ${fahrenheit.a}, not ${FAHRENHEIT}`);

            assert.ok(Math.abs(fahrenheit.b - FAHRENHEIT) < 1e-9,
                `B's trace holds ${fahrenheit.b}, not ${FAHRENHEIT}`);
            assert.equal(fahrenheit.series, celsius.series,
                'the comparison must survive the unit change — B\'s series are still drawn');
            assert.ok(fahrenheit.band[0] <= FAHRENHEIT && fahrenheit.band[1] >= FAHRENHEIT,
                `the Fahrenheit band must contain the reading: ${JSON.stringify(fahrenheit.band)}`);
            assert.ok(fahrenheit.band[0] > celsius.band[1],
                `the band did not convert at all: ${JSON.stringify(fahrenheit.band)} against `
                + `${JSON.stringify(celsius.band)}`);
            assert.ok(fahrenheit.labels.length === celsius.labels.length
                && fahrenheit.labels.every((l) => l.includes('°F')),
                `the key must follow the axis — ${JSON.stringify(fahrenheit.labels)}`);

            assert.equal(fahrenheit.chip, '203.0',
                `the chip still names a Celsius number — ${fahrenheit.chip}`);
            assert.ok(fahrenheit.line.includes('Group °F 203.0')
                && fahrenheit.line.includes('Group Target °F 201.2'),
                `the announced line must be in the unit its own words claim — ${fahrenheit.line}`);
            assert.equal(fahrenheit.stored, CELSIUS,
                'the derivation the page was handed was rewritten in place');

            await page.eval(SET_FLOW_UNIT('c'));
            const back = await page.eval(READ_FLOW);
            assert.equal(back.a, CELSIUS, 'flipping back must restore A\'s canvas');
            assert.equal(back.b, CELSIUS, 'and B\'s');
            assert.equal(back.chip, celsius.chip, 'and the cursor readout');
            assert.ok(back.band[1] < fahrenheit.band[0],
                `the band is still in Fahrenheit: ${JSON.stringify(back.band)}`);
            assert.deepEqual(page.pageErrors, []);
        }));
});

const screenStage = `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen></history-screen>
</div>`;

const ARM = (stored) => `(async () => {
  const screen = document.querySelector('history-screen');
  const key = (route) => (route === '/shots'
    ? 'api__v1__shots~limit=20~offset=0~order=desc.json'
    : 'api__v1__shots__' + route.slice('/shots/'.length) + '.json');
  window.__asked = [];
  screen.boot = {
    transport: {
      request: async (route) => {
        const res = await fetch('/tools/rea-fixtures/' + key(route), { cache: 'no-store' });
        if (!res.ok) return { ok: false, status: 404, message: 'no recording', data: null };
        return { ok: true, status: 200, data: await res.json(), notModified: false };
      },
    },
    storage: {
      get: async (row) => { window.__asked.push(row); return ${JSON.stringify(stored)}; },
    },
  };
  await screen.updateComplete;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    await screen.updateComplete;
    if (screen.tempUnit === 'F') break;
  }
  return { asked: window.__asked, unit: screen.tempUnit };
})()`;

const READ_SCREEN = `(async () => {
  const screen = document.querySelector('history-screen');
  const slot = screen.renderRoot.querySelector('slot[name="page"]');
  const pages = slot.assignedElements({ flatten: true });
  const named = {};
  for (const el of pages) named[el.dataset.page] = el;
  const table = named.data
    ? named.data.renderRoot.getElementById('table-a')
    : null;
  return {
    flow: named.flow ? named.flow.getAttribute('temp-unit') : null,
    data: named.data ? named.data.getAttribute('temp-unit') : null,
    power: named.power ? named.power.getAttribute('temp-unit') : null,
    tempColumn: table ? (table.columns.find((c) => c.key === 'temp') || {}).unit : null,
  };
})()`;

describe('the History screen reads the temperature preference and hands it down', () => {
    test('a stored `f` reaches the flow page, the data page and the phase table\'s header',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            await page.mount(screenStage, ['/src/screens/history-screen.js']);
            await page.settle(4);
            const armed = await page.eval(ARM('f'));
            assert.ok(armed.asked.includes('tempUnit'),
                `the screen must ask storage for the preference — asked ${JSON.stringify(armed.asked)}`);
            assert.equal(armed.unit, 'F', 'and hold the canonical form of what it answered');

            const read = await page.eval(READ_SCREEN);
            assert.equal(read.flow, 'F', 'the flow page must be handed the unit');
            assert.equal(read.data, 'F', 'and so must the data page');

            assert.equal(read.power, null, 'the power page has no temperature to convert');
            assert.equal(read.tempColumn, '°F',
                'the phase table under the charts must agree with them');
            assert.deepEqual(page.pageErrors, []);
        }));
});
