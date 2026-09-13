/**
 * The readings above the Live chart are one row with one rhythm, measured at both render
 * geometries. The drawn extent of each cap and value group is measured with a Range, not
 * the boxes, and every claim is a relation between measured numbers.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js', '/src/lib/app-fit.js'];

/**
 * The stage is the design canvas in its own units: `app-fit.js` lays the app out at a
 * 1200-unit reference height and scales the result, so `computeFit` is asked for the box.
 */
const STAGE = '<div id="stage"><live-screen></live-screen></div>';

const fitStage = (page) => page.evalFn(async () => {
    const { computeFit } = await import('/src/lib/app-fit.js');
    const { designWidth, designHeight } = computeFit({
        width: window.innerWidth, height: window.innerHeight,
    });
    const stage = document.getElementById('stage');
    stage.style.inlineSize = `${designWidth}px`;
    stage.style.blockSize = `${designHeight}px`;
    const screen = window.__h.q('live-screen');
    await screen.updateComplete;
    return { designWidth, designHeight };
});

const SCREEN = 'live-screen';

/** Short readings in Celsius — the resting case. */
const SHORT = { pressure: 1.2, flow: 2.3, weight: 36.7, group: 93.4, steam: 150.5, tank: 82 };

/** The long case: three digits and a decimal everywhere, and Fahrenheit temperatures. */
const LONG = { pressure: 12.3, flow: 12.6, weight: 999.9, group: 93.4, steam: 150.5, tank: 128 };

/** The milk tile sits between Steam and Tank. */
const MILK = { ...SHORT, milk: 62.4 };

/**
 * Every tile's label box and complete value group, in row order. `group` spans the
 * reading and its unit — the thing a person sees as one term.
 */
const CLUSTER = `(() => {
    const screen = document.querySelector('live-screen');
    const row = screen.shadowRoot.querySelector('.gauges');
    const tiles = [...row.querySelectorAll('ui-stat-tile')];
    const ink = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter((b) => b.width > 0);
        if (!rects.length) return null;
        return { left: Math.min(...rects.map((b) => b.left)),
                 right: Math.max(...rects.map((b) => b.right)) };
    };
    const rowBox = row.getBoundingClientRect();
    return {
        row: { left: rowBox.left, right: rowBox.right },
        tiles: tiles.map((tile) => {
            const box = tile.getBoundingClientRect();
            return {
                label: tile.label,
                value: tile.value,
                unit: tile.unit,
                cell: { left: box.left, right: box.right, width: box.width },
                labelInk: ink(tile.shadowRoot.getElementById('label')),
                groupInk: ink(tile.shadowRoot.getElementById('value')),
            };
        }),
    };
})()`;

const read = (page) => page.eval(`JSON.stringify(${CLUSTER})`).then(JSON.parse);
const cluster = (page) => read(page).then((got) => got.tiles);

const configure = (page, props) => page.evalFn(async (patch) => {
    const screen = window.__h.q('live-screen');
    Object.assign(screen, patch);
    await screen.updateComplete;
    return screen.shadowRoot.querySelectorAll('.gauges > ui-stat-tile').length;
}, props);

const spread = (values) => Math.max(...values) - Math.min(...values);

const gaps = (centres) => centres.slice(1).map((c, i) => c - centres[i]);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the gauge row's rhythm @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {
        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await fitStage(page);
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'and run without throwing');
        });

        /** The one shape every case is checked against. */
        const assertRhythm = (tiles, what) => {
            const wrapped = spread(tiles.map((t) => t.cell.left)) > 0
                && tiles.some((t, i) => i > 0 && t.cell.left < tiles[i - 1].cell.left);
            assert.equal(wrapped, false, `${what}: this case is one row (a wrapped row has two rhythms)`);

            for (const tile of tiles) {
                assert.ok(Math.abs(tile.labelInk.left - tile.groupInk.left) <= 1,
                    `${what}: ${tile.label}'s cap starts `
                    + `${(tile.labelInk.left - tile.groupInk.left).toFixed(2)}px off its own reading`);
                assert.ok(Math.abs(tile.groupInk.left - tile.cell.left) <= 1,
                    `${what}: ${tile.label} sits ${(tile.groupInk.left - tile.cell.left).toFixed(2)}px `
                    + "inside its own cell — one tile aligned unlike the rest breaks the row's rhythm");
            }

            const groupGaps = gaps(tiles.map((t) => t.groupInk.left));
            assert.ok(spread(groupGaps) <= 1,
                `${what}: adjacent readings start ${groupGaps.map((g) => g.toFixed(2)).join(', ')} `
                + 'apart — they must follow one pitch');

            for (let i = 1; i < tiles.length; i += 1) {
                assert.ok(tiles[i].groupInk.left > tiles[i - 1].groupInk.right,
                    `${what}: ${tiles[i - 1].label} and ${tiles[i].label} overlap`);
                assert.ok(tiles[i].groupInk.left > tiles[i - 1].labelInk.right,
                    `${what}: ${tiles[i - 1].label}'s cap runs into ${tiles[i].label}`);
            }
        };

        test('the row spreads to the card, first cell to last', () => mounted(async (page) => {
            await configure(page, { readings: SHORT, tempUnit: 'c' });
            const got = await read(page);
            const first = got.tiles[0];
            const last = got.tiles[got.tiles.length - 1];
            assert.ok(Math.abs(first.cell.left - got.row.left) <= 1,
                'the row starts on the first cell');
            assert.ok(Math.abs(last.cell.right - got.row.right) <= 1,
                `the row ends ${(got.row.right - last.cell.right).toFixed(2)}px past its last cell — `
                + 'the seven share the whole width or they are not spread');
        }));

        test('short Celsius readings sit on one pitch', () => mounted(async (page) => {
            const count = await configure(page, { readings: SHORT, tempUnit: 'c' });
            assert.equal(count, 7, 'the resting cluster is seven tiles');
            const tiles = await cluster(page);
            assert.deepEqual(tiles.map((t) => t.label),
                ['Time', 'Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Tank'],
                'in the row order the cluster declares');
            assert.ok(tiles.every((t) => t.value && t.value !== ''), 'with readings in them');
            assertRhythm(tiles, 'short C');
        }));

        test('long Fahrenheit readings do not move their neighbours', () => mounted(async (page) => {
            await configure(page, { readings: SHORT, tempUnit: 'c' });
            const before = await cluster(page);
            await configure(page, { readings: LONG, tempUnit: 'f' });
            const after = await cluster(page);

            assert.ok(after.some((t) => t.unit === '°F'), 'the premise: the temperatures converted');
            assertRhythm(after, 'long F');

            for (let i = 0; i < after.length; i += 1) {
                assert.ok(Math.abs(after[i].cell.left - before[i].cell.left) <= 1,
                    `${after[i].label} changed position when its neighbours' digits changed`);
            }
        }));

        test('an absent reading keeps its place in the row', () => mounted(async (page) => {
            await configure(page, { readings: { ...SHORT, weight: null, tank: null }, tempUnit: 'c' });
            const tiles = await cluster(page);
            assert.equal(tiles.length, 7, 'an absent reading is a dash, not a missing tile');
            assertRhythm(tiles, 'absent readings');
        }));

        test('the milk probe adds an eighth tile without breaking the rhythm', () => mounted(async (page) => {
            const count = await configure(page, { readings: MILK, tempUnit: 'c' });
            assert.equal(count, 8, 'the milk tile is drawn when its channel has a reading');
            const tiles = await cluster(page);
            assert.deepEqual(tiles.map((t) => t.label),
                ['Time', 'Pressure', 'Flow', 'Weight', 'Group', 'Steam', 'Milk', 'Tank'],
                'between Steam and Tank');
            assertRhythm(tiles, 'milk present');
        }));
    });
}
