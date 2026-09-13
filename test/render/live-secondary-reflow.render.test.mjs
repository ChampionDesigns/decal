/**
 * The Live skeleton under pressure: rows are made taller from outside, and the rail must
 * scroll rather than shrink them, every row must stay reachable, the chart must keep its
 * height, and the foot band must scroll rather than lose rows when it is squeezed.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, FLOOR, BENCH } from '../harness/index.js';

/** Every region the skeleton is made of, measured in one pass. */
const REGIONS = () => {
    const all = [];
    const walk = (root) => {
        for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
    };
    walk(document);
    const find = (tag) => all.find((el) => el.tagName === tag) ?? null;
    const rail = find('LIVE-RAIL');
    const card = find('UI-CHART-CARD');
    const foot = find('LIVE-FOOT');
    const band = foot?.shadowRoot?.querySelector('.band') ?? null;
    const railRect = rail?.getBoundingClientRect();
    return {
        rail: rail ? {
            scrollHeight: rail.scrollHeight,
            clientHeight: rail.clientHeight,
            rows: [...rail.children].map((el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top - railRect.top, height: r.height };
            }),
        } : null,
        chart: card ? card.getBoundingClientRect().height : null,
        band: band ? {
            scrollHeight: band.scrollHeight,
            clientHeight: band.clientHeight,
            nodes: foot.querySelectorAll('*').length,
        } : null,
    };
};

/** Push the rail's rows past the rail, the way a floor on their own boxes would. */
const GROW = (value) => {
    document.documentElement.style.setProperty('--ui-control-h', value);
    return true;
};

/** How far the rail can actually be scrolled, asked of the engine rather than computed. */
const SCROLL_RANGE = () => {
    const all = [];
    const walk = (root) => {
        for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
    };
    walk(document);
    const rail = all.find((el) => el.tagName === 'LIVE-RAIL');
    rail.scrollTop = 1e6;
    const max = rail.scrollTop;
    rail.scrollTop = -1e6;
    const min = rail.scrollTop;
    rail.scrollTop = 0;
    return { max, min, scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight };
};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of [FLOOR, BENCH]) {
    describe(`the Live skeleton under pressure @ ${geometry.name}`, () => {
        const live = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.goto('/index.html#/live');
            await page.settle(12);
            return fn(page);
        });

        test('taller rows make the rail scroll instead of squeezing them', () => live(async (page) => {
            const before_ = await page.evalFn(REGIONS);
            assert.ok(before_.rail, 'the Live screen drew no rail');
            assert.equal(before_.rail.scrollHeight, before_.rail.clientHeight,
                'the rail already overflows at rest — this measurement has moved');

            await page.evalFn(GROW, '96px');
            await page.settle(6);
            const after_ = await page.evalFn(REGIONS);

            assert.equal(after_.rail.rows.length, before_.rail.rows.length,
                'a row went missing rather than moving below the fold');
            for (const [i, row] of after_.rail.rows.entries()) {
                assert.ok(row.height >= before_.rail.rows[i].height - 0.01,
                    `row ${i} was squeezed from ${before_.rail.rows[i].height} to ${row.height}`);
            }
            assert.ok(after_.rail.scrollHeight > after_.rail.clientHeight,
                `the rail absorbed ${after_.rail.scrollHeight - after_.rail.clientHeight}px without scrolling`);
        }));

        test('and every row is still reachable', () => live(async (page) => {
            await page.evalFn(GROW, '96px');
            await page.settle(6);
            const seen = await page.evalFn(REGIONS);
            const range = await page.evalFn(SCROLL_RANGE);

            assert.equal(range.min, 0, 'the first row is stranded above the scroll origin');
            const last = seen.rail.rows[seen.rail.rows.length - 1];
            assert.ok(range.max + range.clientHeight >= last.top + last.height,
                `the last row ends at ${last.top + last.height} and the rail only scrolls to `
                + `${range.max + range.clientHeight}`);
            assert.ok(range.max > 0, 'the rail reports an overflow it will not scroll');
        }));

        test('the chart does not pay for the rail getting taller', () => live(async (page) => {
            const before_ = await page.evalFn(REGIONS);
            assert.ok(before_.chart > 0, 'the Live screen drew no chart card');
            await page.evalFn(GROW, '96px');
            await page.settle(6);
            const after_ = await page.evalFn(REGIONS);
            assert.ok(Math.abs(after_.chart - before_.chart) < 1.5,
                `the chart went from ${before_.chart} to ${after_.chart} when the rail grew`);
            assert.ok(Math.abs(after_.band.clientHeight - before_.band.clientHeight) < 1.5,
                'the foot band moved when the rail grew');
        }));

        test('the foot band scrolls rather than losing rows when it is squeezed',
            () => live(async (page) => {
                const before_ = await page.evalFn(REGIONS);
                assert.ok(before_.band, 'the Live screen drew no foot band');
                assert.equal(before_.band.scrollHeight, before_.band.clientHeight,
                    'the band already overflows at rest — this measurement has moved');

                await page.evalFn(() => {
                    const all = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
                    };
                    walk(document);
                    const foot = all.find((el) => el.tagName === 'LIVE-FOOT');
                    foot.style.blockSize = '60px';
                    foot.style.minBlockSize = '60px';
                    return true;
                });
                await page.settle(4);
                const after_ = await page.evalFn(REGIONS);
                assert.ok(after_.band.scrollHeight > after_.band.clientHeight,
                    'the squeezed band did not become scrollable — its content was cut instead');
                /* Not a height comparison: the band's content reflows as it narrows, so the count is
                 * what separates a reflow from a dropped row. */
                assert.equal(after_.band.nodes, before_.band.nodes,
                    `the band held ${before_.band.nodes} nodes and holds ${after_.band.nodes} after the squeeze`);
            }));
    });
}
