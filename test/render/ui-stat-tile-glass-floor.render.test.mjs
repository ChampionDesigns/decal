/**
 * The smallest a readout's words may be on glass: a DESIGN unit is not a rendered pixel
 * once the fit scales the page, so the tile floors the label, the unit and the track.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, FLOOR, BENCH } from '../harness/index.js';

const MODULE = ['/src/components/ui-stat-tile.js'];

const MARKUP = `
<div id="stage" style="inline-size: 640px">
    <ui-stat-tile id="flow" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="time" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
</div>`;

/** The label's and the unit's authored size, in DESIGN units. */
const sizes = (page) => page.evalFn(() => {
    const px = (sel) => parseFloat(getComputedStyle(window.__h.need(sel)).fontSize);
    return {
        label: px('#flow >>> #label'),
        unit: px('#flow >>> #unit'),
        labelBox: window.__h.need('#flow >>> #label').getBoundingClientRect().height,
    };
});

/** The floor, read out of the component rather than retyped here. */
const floorOf = (page) => page.evalFn(
    () => parseFloat(getComputedStyle(window.__h.need('#flow'))
        .getPropertyValue('--_ui-stat-min-glass-text')),
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-stat-tile's glass floor @ ${geometry.name}`, () => {
        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, []);
            return fn(page);
        });

        test('at scale 1 the type is exactly the token it always was', () => mounted(async (page) => {
            await page.setToken('--ui-app-scale', '1');
            await page.settle(2);
            const seen = await sizes(page);
            const cap = parseFloat(await page.resolveToken('--ui-text-sm', 'font-size'));
            const unit = parseFloat(await page.resolveToken('--ui-text-2xs', 'font-size'));
            assert.equal(seen.label, cap, 'scale 1 is unfitted, and nothing about it may move');
            assert.equal(seen.unit, unit, 'and the unit keeps its own step');
        }));

        test('under the fit, neither the label nor the unit renders below the floor',
            () => mounted(async (page) => {
                const floor = await floorOf(page);
                assert.ok(floor > 0, `the component publishes its floor (${floor})`);

                for (const scale of [0.6675, 0.5]) {
                    await page.setToken('--ui-app-scale', String(scale));
                    await page.settle(2);
                    const seen = await sizes(page);
                    const labelGlass = seen.label * scale;
                    const unitGlass = seen.unit * scale;
                    assert.ok(labelGlass >= floor - 0.02,
                        `label at scale ${scale}: ${labelGlass.toFixed(2)} rendered px, floor ${floor}`);
                    assert.ok(unitGlass >= floor - 0.02,
                        `unit at scale ${scale}: ${unitGlass.toFixed(2)} rendered px, floor ${floor}`);
                }
            }));

        test('the label track follows the floored size, so nothing is clipped',
            () => mounted(async (page) => {
                await page.setToken('--ui-app-scale', '0.5');
                await page.settle(2);
                const seen = await sizes(page);
                assert.ok(seen.labelBox >= seen.label,
                    `the line box holds the type (${seen.labelBox} against ${seen.label})`);
                /* Both are integers rounded off the same fractional box in opposite
                 * directions, so one pixel of overflow is not clipping. */
                const over = await page.evalFn(() => {
                    const el = window.__h.need('#flow >>> #label');
                    return el.scrollHeight - el.clientHeight;
                });
                assert.ok(over <= 1,
                    `the cap is not cut off top or bottom (${over}px of overflow)`);
            }));

        test('the floor is a dial, not a literal', () => mounted(async (page) => {
            await page.setToken('--ui-app-scale', '0.5');
            await page.settle(2);
            const before = (await sizes(page)).label;
            await page.setStyle('#flow', { '--_ui-stat-min-glass-text': '20px' });
            await page.settle(2);
            const after = (await sizes(page)).label;
            assert.ok(after > before,
                `moving the floor moves the type (${before} then ${after})`);
        }));
    });
}

describe('the shipped page, measured', () => {
    for (const geometry of [BENCH, FLOOR]) {
        test(`Live's readouts clear the floor on glass @ ${geometry.name}`, async () => {
            const page = await browser.newPage({ geometry });
            try {
                await page.goto('/index.html');
                const ready = await page.evalFn(async () => {
                    const deadline = performance.now() + 5000;
                    while (performance.now() < deadline) {
                        const live = window.__h.q('app-root >>> live-screen');
                        const tiles = live ? window.__h.qAll('app-root >>> live-screen >>> ui-stat-tile') : [];
                        if (tiles.length) {
                            await Promise.all(tiles.map(tile => tile.updateComplete));
                            return true;
                        }
                        await new Promise(requestAnimationFrame);
                    }
                    return false;
                });
                assert.ok(ready, 'the Live screen mounts before its readouts are measured');
                const seen = await page.evalFn(() => {
                    const app = document.querySelector('app-root');
                    const found = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            if (el.tagName === 'UI-STAT-TILE') found.push(el);
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document);
                    const scale = parseFloat(getComputedStyle(document.documentElement)
                        .getPropertyValue('--ui-app-scale')) || 1;
                    const zoom = parseFloat(getComputedStyle(app).zoom) || 1;
                    return {
                        scale,
                        zoom,
                        tiles: found.map((t) => {
                            const label = t.shadowRoot.querySelector('#label');
                            const unit = t.shadowRoot.querySelector('#unit');
                            const size = (el) => (el
                                ? parseFloat(getComputedStyle(el).fontSize) * scale : null);
                            return {
                                name: t.getAttribute('label'),
                                label: size(label),
                                unit: size(unit),
                                floor: parseFloat(getComputedStyle(t)
                                    .getPropertyValue('--_ui-stat-min-glass-text')),
                            };
                        }),
                    };
                });
                assert.ok(seen.tiles.length > 0, 'the Live screen drew its readouts');
                assert.ok(Math.abs(seen.zoom - seen.scale) < 0.001,
                    `the page is drawn at the published scale (zoom ${seen.zoom}, scale ${seen.scale})`);
                for (const tile of seen.tiles) {
                    /* An undeclared property parses to NaN, which arrives here as null. */
                    assert.ok(Number.isFinite(tile.floor) && tile.floor > 0,
                        `${tile.name}: the tile publishes no glass floor (${tile.floor})`);
                    assert.ok(tile.label >= tile.floor - 0.02,
                        `${tile.name}: label ${tile.label.toFixed(2)} rendered px against a floor of ${tile.floor}`);
                    if (tile.unit !== null) {
                        assert.ok(tile.unit >= tile.floor - 0.02,
                            `${tile.name}: unit ${tile.unit.toFixed(2)} rendered px against a floor of ${tile.floor}`);
                    }
                }
            } finally {
                await page.close();
            }
        });
    }
});
