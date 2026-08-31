/**
 * The Live skeleton in a real engine, at THREE sizes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR, C1 } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** The three sizes this screen is judged at. first, because it is the decided one. */
const GEOMETRIES = [C1, ...GATE_A_GEOMETRIES];

const S = 'live-screen';
const HEADER = `${S} >>> live-header`;
const RAIL = `${S} >>> live-rail`;
const MAIN = `${S} >>> live-main`;
const FOOT = `${S} >>> live-foot`;
const CARD = `${S} >>> ui-chart-card`;
const BAND = `${S} >>> live-foot >>> .band`;

const px = (value) => parseFloat(value);

/** Every box in the screen's own shadow root and its four regions' - deliberately NOT
 *  descending into library components, whose insides are their own suites' business. */
const REGION_TREE = `(() => {
    const screen = window.__h.q('live-screen');
    const roots = [screen.shadowRoot];
    for (const tag of ['live-header', 'live-rail', 'live-main', 'live-foot']) {
        const el = screen.shadowRoot.querySelector(tag);
        if (el && el.shadowRoot) roots.push(el.shadowRoot);
    }
    const out = [];
    for (const root of roots) {
        for (const el of root.querySelectorAll('*')) {
            if (el.tagName.startsWith('UI-')) continue;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            out.push({
                tag: el.tagName.toLowerCase(),
                cls: el.className && typeof el.className === 'string' ? el.className : '',
                placeholder: el.hasAttribute('data-placeholder'),
                position: cs.position,
                overflowX: cs.overflowX,
                overflowY: cs.overflowY,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                height: r.height,
                width: r.width,
            });
        }
    }
    return out;
})()`;

const TYPE_STRESS = Object.freeze({
    '--ui-text-base': '18.7px',
    '--ui-text-md': '19.8px',
    '--ui-display-lg': '49.5px',
    '--ui-display-xl': '57.2px',
});

const clipping = (tree) => tree
    .filter((n) => (/hidden|auto|scroll|clip/.test(n.overflowY) && n.scrollHeight > n.clientHeight + 1)
        || (/hidden|auto|scroll|clip/.test(n.overflowX) && n.scrollWidth > n.clientWidth + 1))
    .map((n) => `${n.tag}.${n.cls}`);

const RAIL_NODE = 'live-rail.';
const withoutRail = (names) => names.filter((name) => name !== RAIL_NODE);
const railScrolls = (names) => names.includes(RAIL_NODE);

/** A placeholder box shorter than its own text: the skeleton's boxes are floors. */
const shortPlaceholders = (tree) => tree
    .filter((n) => n.placeholder && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1))
    .map((n) => `${n.tag}.${n.cls}`);

const fillGauges = (page) => page.evalFn(() => {
    const values = ['24.6', '9.0', '2.1', '36.2', '92.4'];
    const tiles = [...window.__h.q('live-screen').shadowRoot.querySelectorAll('.gauges > ui-stat-tile')];
    tiles.forEach((tile, i) => { tile.value = values[i] ?? '0.0'; });
    return Promise.all(tiles.map((tile) => tile.updateComplete)).then(() => tiles.length);
});

/** Distance from the gauge cluster's lowest INK to the top of the chart card. */
const inkClearance = (page) => page.evalFn(() => {
    const gauges = window.__h.q('live-screen >>> .gauges');
    const well = window.__h.q('live-screen >>> ui-chart-card >>> .well');
    const ink = gauges.getBoundingClientRect().bottom + (gauges.scrollHeight - gauges.clientHeight);
    return +(well.getBoundingClientRect().top - ink).toFixed(2);
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GEOMETRIES) {
    describe(`live skeleton @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            return fn(page);
        });

        test('the screen is the §4.1 grid, and the tracks are the ones it asks for', () => mounted(async (page) => {
            const style = await page.computed(S, [
                'display', 'grid-template-rows', 'grid-template-columns', 'row-gap', 'column-gap',
                'background-color',
            ]);
            assert.equal(style.display, 'grid');

            const rows = style['grid-template-rows'].split(' ').map(px);
            const cols = style['grid-template-columns'].split(' ').map(px);
            assert.equal(rows.length, 3, 'three rows: band, body, foot band');
            assert.equal(cols.length, 2, 'two columns: rail, everything else');

            const bandH = px(await page.resolveValue('var(--ui-band-h)', 'block-size'));
            assert.ok(Math.abs(rows[0] - bandH) < 0.51, `band row ${rows[0]} against --ui-band-h ${bandH}`);

            const railW = px(await page.resolveValue('var(--ui-rail-w)', 'inline-size'));
            assert.ok(Math.abs(cols[0] - railW) < 0.51, `rail column ${cols[0]} against --ui-rail-w ${railW}`);

            // The seam IS the divider, and the ground shows through it.
            const seam = px(await page.resolveValue('var(--ui-seam)', 'block-size'));
            assert.deepEqual([px(style['row-gap']), px(style['column-gap'])], [seam, seam]);
            assert.equal(style['background-color'], await page.resolveToken('--ui-line-strong', 'background-color'));

            const screen = await page.box(S);
            assert.equal(Math.round(screen.height), geometry.height, 'height: 100% of the stage');
        }));

        test('the four regions sit in the four §4.1 cells', () => mounted(async (page) => {
            const [screen, header, rail, main, foot] = await Promise.all(
                [S, HEADER, RAIL, MAIN, FOOT].map((s) => page.box(s)),
            );
            const seam = px(await page.resolveValue('var(--ui-seam)', 'block-size'));
            const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1.01, `${what}: ${a} vs ${b}`);

            // Header: row 1, both columns.
            near(header.x, screen.x, 'header starts at the screen');
            near(header.width, screen.width, 'header spans both columns');
            near(header.y, screen.y, 'header is the first row');

            // Rail: column 1, rows 2-3 - from the header's underline to the foot.
            near(rail.x, screen.x, 'rail is column 1');
            near(rail.y, header.y + header.height + seam, 'rail starts under the header');
            near(rail.y + rail.height, screen.y + screen.height, 'rail runs to the foot of the screen');

            // Main and foot: column 2, rows 2 and 3, main above foot with one seam.
            near(main.x, rail.x + rail.width + seam, 'main is column 2');
            near(main.width, foot.width, 'the band is as wide as the region above it');
            near(foot.y, main.y + main.height + seam, 'one seam between the chart column and the band');
            near(foot.y + foot.height, screen.y + screen.height, 'the band ends the screen');
        }));

        test('nothing in the skeleton is positioned - §4.1: "no absolutely-positioned structure"',
            () => mounted(async (page) => {
                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                const positioned = tree.filter((n) => n.position === 'absolute' || n.position === 'fixed');
                assert.deepEqual(positioned, [], 'an absolute box in the skeleton is bug L1s mechanism');
                assert.ok(tree.length > 8, 'the walk found the skeleton, not an empty root');
            }));

        test('the header is three flex clusters and the middle one is the 1fr', () => mounted(async (page) => {
            const header = await page.computed(HEADER, ['display', 'flex-direction']);
            assert.equal(header.display, 'flex');
            assert.equal(header['flex-direction'], 'row');

            const mid = await page.computed(`${HEADER} >>> .favourites`, ['flex-grow', 'flex-shrink', 'min-inline-size']);
            assert.equal(mid['flex-grow'], '1', 'the favourites bank is the cluster that flexes');
            assert.equal(px(mid['min-inline-size']), 0, 'and it may shrink - the other half of the rule');

            const ends = await Promise.all([`${HEADER} >>> .lead`, `${HEADER} >>> .actions`]
                .map((s) => page.computed(s, ['flex-grow'])));
            assert.deepEqual(ends.map((e) => e['flex-grow']), ['0', '0']);
        }));

        test('the clusters cannot collide, and the band does not overflow', () => mounted(async (page) => {
            const [lead, mid, actions, band] = await Promise.all(
                [`${HEADER} >>> .lead`, `${HEADER} >>> .favourites`, `${HEADER} >>> .actions`, HEADER]
                    .map((s) => page.box(s)),
            );
            assert.ok(lead.x + lead.width <= mid.x + 0.51, 'lead cluster overlaps the favourites bank');
            assert.ok(mid.x + mid.width <= actions.x + 0.51, 'favourites bank overlaps the action cluster');
            assert.ok(actions.x + actions.width <= band.x + band.width + 0.51, 'the action cluster runs off the band');

            const m = await page.metrics(HEADER);
            assert.ok(m.scrollWidth <= m.clientWidth + 1, `the header overflows: ${m.scrollWidth} vs ${m.clientWidth}`);
            assert.ok(m.scrollHeight <= m.clientHeight + 1, 'the header band clips its own contents');
        }));

        test('L2/L4/L18: no box clips its content, and the gauge ink clears the chart',
            () => mounted(async (page) => {
                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                assert.deepEqual(withoutRail(clipping(tree)), [],
                    'a box that clips content it is smaller than is the L2 / L4 / L18 class');
                assert.equal(railScrolls(clipping(tree)), geometry.name !== 'desktop',
                    'the rail is the ONE region allowed to outrun its box, and only below the '
                    + 'reference geometry — see RAIL_NODE');
                assert.deepEqual(shortPlaceholders(tree), [],
                    'a placeholder box is shorter than its own text - the boxes are floors, not fixed heights');

                const clearance = await inkClearance(page);
                if (geometry.name === 'floor') {
                    assert.ok(clearance > -120,
                        `the design floor's shortfall grew past its recorded size: ${clearance}px`);
                } else {
                    assert.ok(clearance > 2,
                        `the gauge cluster's ink is ${clearance}px from the plot`);
                }
            }));

        test('L2: the gauge value track is the display type s own box, and grows with it',
            () => mounted(async (page) => {
                const before = await page.box(`${S} >>> .gauges`);
                const tile = await page.box(`${S} >>> ui-stat-tile`);
                assert.ok(before.height >= tile.height - 0.51, 'the cluster is at least as tall as a tile');

                for (const [token, value] of Object.entries(TYPE_STRESS)) await page.setToken(token, value);
                await page.settle(4);
                const after = await page.box(`${S} >>> .gauges`);
                assert.ok(after.height > before.height,
                    `the gauge cluster did not grow with its type (${before.height} -> ${after.height}) - `
                    + 'a fixed track under a larger render is exactly bug L2');

                const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
                assert.deepEqual(withoutRail(clipping(tree)), [],
                    'something clipped once the text was 10% larger - "two pixels of clearance is a fix '
                    + 'that only works on the desk" (§1.4)');
                assert.equal(railScrolls(clipping(tree)), true,
                    'the rail did not scroll at +10% type — the standing rail cannot fit it');
                assert.deepEqual(shortPlaceholders(tree), [], 'a placeholder box did not grow with its text');
                const clearance = await inkClearance(page);
                if (geometry.name === 'floor') {
                    assert.ok(clearance > -120,
                        `the design floor's shortfall grew past its recorded size: ${clearance}px`);
                } else {
                    assert.ok(clearance > 2, `at +10% type the gauge ink is ${clearance}px from the plot`);
                }
                for (const token of Object.keys(TYPE_STRESS)) await page.setToken(token, null);
            }));

        test('§2.4: at +10% type no region lands inside another - and where the floors do not fit, by how much',
            (t) => mounted(async (page) => {
                await fillGauges(page);
                for (const [token, value] of Object.entries(TYPE_STRESS)) await page.setToken(token, value);
                await page.settle(4);

                const fit = await page.evalFn(() => {
                    const root = window.__h.q('live-screen').shadowRoot;
                    const main = root.querySelector('live-main');
                    const card = root.querySelector('ui-chart-card');
                    const foot = root.querySelector('live-foot');
                    const gauges = root.querySelector('.gauges');
                    const rows = new Set([...gauges.children].map((el) => Math.round(el.getBoundingClientRect().top)));
                    return {
                        overflowY: getComputedStyle(main).overflowY,
                        mainScroll: main.scrollHeight,
                        mainClient: main.clientHeight,
                        gaugeRows: rows.size,
                        gaugeHeight: +gauges.getBoundingClientRect().height.toFixed(2),
                        cardHeight: +card.getBoundingClientRect().height.toFixed(2),
                        intoFoot: +(card.getBoundingClientRect().bottom - foot.getBoundingClientRect().top).toFixed(2),
                    };
                });
                for (const token of Object.keys(TYPE_STRESS)) await page.setToken(token, null);

                t.diagnostic(`${geometry.name} at +10% type: gauges ${fit.gaugeHeight} in ${fit.gaugeRows} row(s), `
                    + `chart ${fit.cardHeight}, live-main ${fit.mainScroll} of content in ${fit.mainClient}, `
                    + `chart card ${fit.intoFoot > 0 ? `${fit.intoFoot}px INSIDE the foot band` : `${-fit.intoFoot}px clear of the foot band`}`);

                assert.equal(fit.overflowY, 'visible',
                    'a region that hides what does not fit is the §2.4 default this rewrite exists to end');

                if (geometry === FLOOR) {
                    // The recorded shortfall. Not blessed: bounded, named and printed.
                    assert.ok(fit.intoFoot < 200,
                        `the design floor's +10% shortfall grew past its recorded size: ${fit.intoFoot}px into the band`);
                    return;
                }

                assert.ok(fit.mainScroll <= fit.mainClient + 1,
                    `<live-main> holds ${fit.mainScroll} of content in ${fit.mainClient}`);
                assert.ok(fit.intoFoot < 0,
                    `the chart card is ${fit.intoFoot}px inside the foot band - two regions, one place`);
            }));

        test('L5: one uniform whole-pixel gap, no correction margins', () => mounted(async (page) => {
            const rail = await page.computed(RAIL, ['display', 'flex-direction', 'justify-content', 'row-gap']);
            assert.equal(rail.display, 'flex');
            assert.equal(rail['flex-direction'], 'column');
            assert.equal(rail['justify-content'], 'space-between');

            const gapToken = px(await page.resolveValue('var(--ui-space-6)', 'block-size'));
            assert.equal(px(rail['row-gap']), gapToken, 'the gap is one token, not a solved number');
            assert.equal(px(rail['row-gap']) % 1, 0, 'and it is a whole pixel - L5 started at 26.75px');

            const rows = await page.eval(`JSON.stringify([...window.__h.q('live-screen').shadowRoot
                .querySelector('live-rail').children].map((el) => {
                    const cs = getComputedStyle(el);
                    const r = el.getBoundingClientRect();
                    /* The KIND is what the sheet keys its two constants on: an opening
                     * row, a preset row, or an ordinary one. Read from the DOM rather
                     * than assumed, so a row that changed kind fails here. */
                    const kind = el.hasAttribute('data-section-start') ? 'opening'
                        : (el.tagName.toLowerCase() === 'ui-preset-bank' ? 'preset' : 'row');
                    return { top: r.top, bottom: r.bottom, kind,
                             margins: [cs.marginTop, cs.marginBottom, cs.marginLeft, cs.marginRight] };
                }))`).then(JSON.parse);

            assert.ok(rows.length >= 4, 'the rail has rows to measure');

            const presetPull = -0.8 * gapToken;
            const openingPull = px(await page.resolveValue('var(--ui-space-5)', 'block-size')) - gapToken;
            const ALLOWED_TOP = new Set([0, presetPull, openingPull].map((v) => +v.toFixed(2)));

            const byKind = new Map();
            for (const row of rows) {
                const [top, bottom, left, right] = row.margins;
                assert.deepEqual([bottom, left, right], ['0px', '0px', '0px'],
                    'a rail row carries a margin on an axis nothing asked for — L5 starts here');
                const value = +px(top).toFixed(2);
                assert.ok(ALLOWED_TOP.has(value),
                    `a rail row's top margin is ${value}, which is not one of the two declared `
                    + `constants ${[...ALLOWED_TOP].join(' / ')} — a solved number in the rail is bug L5`);
                const kind = row.kind ?? 'row';
                if (!byKind.has(kind)) byKind.set(kind, new Set());
                byKind.get(kind).add(value);
            }
            for (const [kind, values] of byKind) {
                assert.equal(values.size, 1,
                    `rows of kind "${kind}" carry ${values.size} different top margins `
                    + `(${[...values].join(', ')}) — one kind, one constant, or it is a correction`);
            }

            const gaps = rows.slice(1).map((row, i) => +(row.top - rows[i].bottom).toFixed(2));
            const declared = [gapToken, +(gapToken + presetPull).toFixed(2),
                +(gapToken + openingPull).toFixed(2)];
            const deltas = gaps.map((gap) => {
                const over = declared.map((d) => gap - d).filter((d) => d > -0.51);
                assert.ok(over.length > 0,
                    `a rail gap of ${gap} is UNDER every constant the sheet declares `
                    + `(${declared.join(' / ')}): ${gaps.join(', ')} — space-between cannot `
                    + 'tighten a gap, so this is a correction margin or a lost declaration');
                return +Math.min(...over).toFixed(2);
            });
            const spread = Math.max(...deltas) - Math.min(...deltas);
            assert.ok(spread < 0.51,
                `the rail's leftover height is not shared equally: gaps ${gaps.join(', ')} sit `
                + `${deltas.join(', ')} above their constants — one of them has a number of its own`);
        }));

        test('L5: deleting a row shares one remainder equally - no row gets a number of its own',
            () => mounted(async (page) => {
                const geom = () => page.eval(`JSON.stringify((() => {
                    const rows = [...window.__h.q('live-screen').shadowRoot
                        .querySelector('live-rail').children]
                        .map((el) => el.getBoundingClientRect());
                    return {
                        tops: rows.map((r) => +r.top.toFixed(2)),
                        gaps: rows.slice(1).map((r, i) => +(r.top - rows[i].bottom).toFixed(2)),
                    };
                })())`).then(JSON.parse);

                const before = await geom();
                await page.evalFn(() => {
                    const rail = window.__h.q('live-screen').shadowRoot.querySelector('live-rail');
                    rail.removeChild(rail.lastElementChild);
                    return true;
                });
                await page.settle(3);
                const after = await geom();

                assert.equal(after.tops.length, before.tops.length - 1);
                assert.equal(after.tops[0], before.tops[0],
                    'the rail\'s first row moved when a row was deleted below it - the top of the '
                    + 'rail is its inset, not a number its contents negotiate');

                /* One delta per surviving gap, and they must agree. Compared as a SET
                 * rather than gap by gap, because the claim is about the rule and not
                 * about which row happens to be where. */
                const deltas = after.gaps.map((gap, i) => +(gap - before.gaps[i]).toFixed(2));
                const spread = Math.max(...deltas) - Math.min(...deltas);
                assert.ok(spread < 0.51,
                    `a row was removed and the rail's gaps moved by different amounts `
                    + `(${deltas.join(', ')}) - that is the emergent-alignment chain (L5)`);
                assert.ok(Math.min(...deltas) >= -0.51,
                    `a gap TIGHTENED when a row was removed (${deltas.join(', ')}) - space-between `
                    + 'can only ever open the rail up, so this is something else sizing it');
            }));

        test('at and above the design floor NOTHING on Live scrolls', () => mounted(async (page) => {
            const tree = await page.eval(`JSON.stringify(${REGION_TREE})`).then(JSON.parse);
            const scrolling = tree.filter((n) => /auto|scroll/.test(n.overflowY) && n.scrollHeight > n.clientHeight + 1);
            assert.deepEqual(withoutRail(scrolling.map((n) => `${n.tag}.${n.cls}`)), [],
                '"a scroll affordance on a wall tablet is worse than the crowding it fixes"');
            assert.equal(railScrolls(scrolling.map((n) => `${n.tag}.${n.cls}`)),
                geometry.height < 1200,
                `the rail's scroll state changed at ${geometry.name}`);

            const doc = await page.evalFn(() => ({
                scroll: document.documentElement.scrollHeight,
                client: document.documentElement.clientHeight,
            }));
            assert.ok(doc.scroll <= doc.client + 1, `the document scrolls: ${doc.scroll} vs ${doc.client}`);
        }));

        test('the chart is above its own floor and the band is above its token floor',
            () => mounted(async (page) => {
                const card = await page.box(CARD);
                const cardFloor = px(await page.prop(CARD, 'min-block-size'));
                assert.ok(card.height >= cardFloor - 0.51,
                    `the chart is under its floor: ${card.height} vs ${cardFloor}`);

                const foot = await page.box(FOOT);
                const footFloor = px(await page.resolveValue('var(--ui-live-foot-min-h)', 'block-size'));
                assert.ok(foot.height >= footFloor - 0.51,
                    `the band is under its floor: ${foot.height} vs ${footFloor}`);

                // The chart is the only 1fr: it, and nothing else, has the spare height.
                const main = await page.box(MAIN);
                const gauges = await page.box(`${S} >>> .gauges`);
                assert.ok(card.height > gauges.height, 'the chart is the region that absorbs the height');
                assert.ok(card.height < main.height, 'and it is inside main, not equal to it');
            }));

        test('the M3 token is the band s floor, and drilling it moves the band', () => mounted(async (page) => {
            const before = await page.box(FOOT);
            const cardBefore = await page.box(CARD);

            await page.setToken('--ui-live-foot-min-h', '320px');
            await page.settle(3);
            const after = await page.box(FOOT);
            const cardAfter = await page.box(CARD);

            assert.ok(after.height >= 319.5, `the band ignored its floor token: ${after.height}`);
            assert.ok(after.height > before.height, 'the floor did not move the band');

            const chartFloor = px(await page.prop(CARD, 'min-block-size'));
            if (cardBefore.height > chartFloor + 0.51) {
                assert.ok(cardAfter.height < cardBefore.height,
                    'and the height came out of the chart, as the 1fr');
            } else {
                assert.ok(Math.abs(cardAfter.height - chartFloor) < 0.51,
                    `the chart was already on its ${chartFloor}px floor and must stay there, `
                    + `not shrink past it: ${cardAfter.height} (DQ-0-A)`);
            }

            await page.setToken('--ui-live-foot-min-h', null);
        }));

        test('the GHC strip lands IN FLOW and takes its height from the chart', (t) => mounted(async (page) => {
            const chartBefore = await page.box(CARD);
            const floorBefore = px(await page.prop(CARD, 'min-block-size'));

            await page.evalFn(() => { window.__h.q('live-screen').ghc = true; return true; });
            await page.settle(4);

            const strip = await page.box(`${S} >>> .ghc-strip`);
            const chartAfter = await page.box(CARD);
            const stripStyle = await page.computed(`${S} >>> .ghc-strip`, ['position']);
            const main = await page.metrics(MAIN);
            const foot = await page.box(FOOT);
            /* How far the strip's box reaches back INSIDE the chart card's. Negative is the
             * healthy answer and equals the gap. */
            const overlap = +(chartAfter.y + chartAfter.height - strip.y).toFixed(2);

            t.diagnostic(`${geometry.name} with ghc: chart ${chartBefore.height.toFixed(2)} -> `
                + `${chartAfter.height.toFixed(2)} (floor ${floorBefore}), strip ${strip.height.toFixed(2)}, `
                + `band ${foot.height.toFixed(2)}, strip ${overlap > 0 ? `${overlap}px INSIDE the chart card`
                    : `${-overlap}px clear of it`}`);

            assert.equal(stripStyle.position, 'static', 'L1 is an absolutely positioned strip');
            assert.ok(strip.height > 0, 'the strip rendered');
            assert.ok(strip.y > chartAfter.y, 'the strip is a row under the chart, not a layer over it');
            assert.ok(chartAfter.height < chartBefore.height + 0.51,
                'the chart did not give the strip its space, so the space came from somewhere else');

            if (chartAfter.height > floorBefore + 0.51) {
                assert.ok(strip.y >= chartAfter.y + chartAfter.height - 0.51,
                    'the strip overlaps the chart - bug L1, measured 855...933 over a chart bottom of 900');
                assert.ok(main.scrollHeight <= main.clientHeight + 1, 'main clipped its own rows');
            } else {
                assert.ok(Math.abs(chartAfter.height - floorBefore) < 0.51,
                    'the chart is not on its floor, so something else absorbed the strip');
                assert.notEqual(await page.prop(MAIN, 'overflow-y'), 'hidden',
                    'the shortfall is hidden rather than shown - that is the defect §2.4 exists to end');

                assert.ok(overlap < 175,
                    `the strip's overlap of the chart card grew past its recorded size: `
                    + `${overlap}px, recorded 158.14px at the 1000x600 floor (DQ-0-A)`);
            }
        }));
    });
}

describe('C1 / C2: the order of surrender', () => {
    const HEIGHTS = [1080, 900, 801, 700, 600, 560, 520, 480];

    /** One row of the trace, in the page. */
    const SAMPLE = `(() => {
        const q = (s) => window.__h.q(s);
        const h = (s) => +q(s).getBoundingClientRect().height.toFixed(2);
        const band = q('live-screen >>> live-foot >>> .band');
        const rail = q('live-screen >>> live-rail');
        return {
            screen: h('live-screen'),
            chart: h('live-screen >>> ui-chart-card'),
            foot: h('live-screen >>> live-foot'),
            chartFloor: parseFloat(getComputedStyle(q('live-screen >>> ui-chart-card')).minBlockSize),
            footFloor: parseFloat(getComputedStyle(q('live-screen >>> live-foot')).minBlockSize),
            bandScrolls: band.scrollHeight > band.clientHeight + 1,
            bandOverflow: getComputedStyle(band).overflowY,
            railScrolls: rail.scrollHeight > rail.clientHeight + 1 && getComputedStyle(rail).overflowY !== 'visible',
        };
    })()`;

    const trace = async (page, heights) => {
        const out = [];
        for (const height of heights) {
            await page.setGeometry({ ...BENCH, height, deviceScaleFactor: 1 });
            await page.settle(4);
            out.push({ height, ...JSON.parse(await page.eval(`JSON.stringify(${SAMPLE})`)) });
        }
        return out;
    };

    test('the chart absorbs the height, stops dead at its floor, and the band gives its share',
        () => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const rows = await trace(page, HEIGHTS);

            for (const [i, row] of rows.entries()) {
                assert.ok(row.chart >= row.chartFloor - 0.51,
                    `at ${row.height} the chart is under --ui-chart-min-h plus chrome: ${row.chart} vs ${row.chartFloor}`);
                assert.ok(row.foot >= row.footFloor - 0.51,
                    `at ${row.height} the band is under its M3 floor: ${row.foot} vs ${row.footFloor}`);
                if (i > 0) {
                    assert.ok(row.chart <= rows[i - 1].chart + 0.51,
                        'the chart grew as the window shrank');
                    assert.ok(row.foot <= rows[i - 1].foot + 0.51,
                        'the band grew as the window shrank');
                }
            }

            const first = rows[0];
            const last = rows[rows.length - 1];
            assert.ok(first.chart > last.chart, 'the chart never absorbed anything');
            assert.equal(Math.round(last.chart), Math.round(last.chartFloor),
                'at the smallest window the chart sits exactly on its floor');

            assert.ok(first.footFloor > last.footFloor,
                `the band's floor did not scale with the screen: ${first.footFloor} -> ${last.footFloor}`);
            assert.ok(first.foot > last.foot,
                'the band never gave anything - before DQ-541 it was content-sized at every height');

            for (const [i, row] of rows.entries()) {
                if (i > 0 && rows[i - 1].railScrolls) {
                    assert.equal(row.railScrolls, true,
                        `at ${row.height} the rail stopped scrolling while the window kept shrinking — `
                        + 'a rail that stops scrolling has dropped a row');
                }
            }
            assert.equal(rows[rows.length - 1].railScrolls, true,
                'the rail did not scroll at the smallest window — nine standing rows do not fit it');
        }));

    test('DQ-541: above its content the band is a share of the screen, and gives it back',
        (t) => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const rows = await trace(page, [1400, 1200, 1080, 800]);

            for (const row of rows) {
                assert.ok(row.foot >= row.footFloor - 0.51,
                    `at ${row.height} the band is under its floor: ${row.foot} vs ${row.footFloor}`);
                assert.equal(row.bandScrolls, false,
                    `at ${row.height} the band scrolls - C2's last resort is for BELOW the design floor`);
            }

            const [tall, twelve, c1, bench] = rows;

            const content = bench.foot;
            for (const row of rows) {
                const want = Math.max(content, row.footFloor);
                assert.ok(Math.abs(row.foot - want) < 0.51,
                    `at ${row.height} the band is ${row.foot}, and max(content ${content}, `
                    + `floor ${row.footFloor}) is ${want.toFixed(2)} - the band is being sized `
                    + 'by something other than its content and its share');
            }

            assert.ok(content < tall.footFloor,
                `the band's content (${content}px) has outgrown its share even at ${tall.height} rows `
                + `(${tall.footFloor}px) - --ui-live-foot-share now decides nothing anywhere`);
            assert.ok(Math.abs(tall.foot - tall.footFloor) < 0.51,
                `at ${tall.height} the band is ${tall.foot} against a floor of ${tall.footFloor} - the share `
                + 'is not what is sizing it, so the proportionality below is a coincidence');

            assert.ok(tall.foot > twelve.foot,
                `the band did not give when the screen shrank ${tall.height} -> ${twelve.height}: `
                + `${tall.foot} -> ${twelve.foot}`);
            const bandRatio = twelve.foot / tall.foot;
            const screenRatio = twelve.height / tall.height;
            t.diagnostic(`the band gave ${(bandRatio * 100).toFixed(1)} % against a screen at `
                + `${(screenRatio * 100).toFixed(1)} %`);
            assert.ok(bandRatio < 1,
                `the band gave nothing: ${(bandRatio * 100).toFixed(1)} %`);
            assert.ok(bandRatio >= screenRatio - 0.01,
                `the band gave ${(bandRatio * 100).toFixed(1)} %, MORE than the screen's `
                + `${(screenRatio * 100).toFixed(1)} % - DQ-541 asks it to scale, not to collapse`);
            assert.ok(tall.chart > twelve.chart, 'and the chart gave with it, which is the other half of the ask');

            const share = (twelve.footFloor / twelve.height);
            const crossover = content / share;
            t.diagnostic(`the band stops scaling below ${crossover.toFixed(0)} rows `
                + `(content ${content}px / share ${(share * 100).toFixed(1)} %); at the bench `
                + `1200 / 1080 / 800 it is content-sized at ${twelve.foot} / ${c1.foot} / ${bench.foot}`);
            assert.ok(content - twelve.footFloor < 20,
                `at ${twelve.height} the band is ${(content - twelve.footFloor).toFixed(2)}px above its share - `
                + 'the content has run away from the share rather than shadowing it, and the '
                + 'crossover is climbing out of the range of screens this skin runs on');

            assert.ok(bench.foot >= bench.footFloor - 0.51,
                `at ${bench.height} rows the band is under its floor: ${bench.foot} vs ${bench.footFloor}`);
            for (const [i, row] of rows.entries()) {
                if (i === 0) continue;
                assert.ok(row.foot <= rows[i - 1].foot + 0.51,
                    `the band GREW as the screen shrank: ${rows[i - 1].foot} -> ${row.foot}`);
            }

            const footMin = px(await page.resolveValue('var(--ui-live-foot-min-h)', 'block-size'));
            for (const row of [tall, c1]) {
                assert.ok(Math.abs(row.footFloor / twelve.footFloor - row.height / twelve.height) < 0.01,
                    `the floor itself is not a share of the screen: ${twelve.footFloor} at ${twelve.height} `
                    + `-> ${row.footFloor} at ${row.height}`);
            }
            assert.ok(Math.abs(bench.footFloor - footMin) < 0.51,
                `at ${bench.height} rows the floor should be M3's own --ui-live-foot-min-h `
                + `(${footMin}px), not the ${(share * bench.height).toFixed(2)}px share: got ${bench.footFloor}`);
        }));

    test('C2: with a band that has rows to lose, the share cap makes the BAND the giver '
        + 'and the band is the only region that scrolls', () => browser.withPage({ geometry: C1 }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);

        await page.evalFn(() => {
            const foot = window.__h.q('live-screen').shadowRoot.querySelector('live-foot');
            for (let i = 0; i < 6; i += 1) {
                const row = document.createElement('div');
                row.setAttribute('data-placeholder', '');
                row.className = 'foot-row';
                row.textContent = 'Phase ' + (i + 1);
                foot.appendChild(row);
            }
            return true;
        });
        await page.settle(4);

        const rows = await trace(page, [1080, 801, 600, 460]);
        const share = 0.40;   // --ui-live-foot-max-share

        for (const row of rows) {
            assert.ok(row.foot <= row.screen * share + 1.01,
                `at ${row.height} the band took more than its share: ${row.foot} of ${row.screen}`);
            assert.ok(row.foot >= row.footFloor - 0.51, 'and never less than its floor');
            assert.ok(row.chart >= row.chartFloor - 0.51, 'the chart is still above its floor');
        }

        assert.ok(rows[0].foot > rows[rows.length - 1].foot, 'the capped band did not give anything');

        // ...and 's last resort: it scrolls, visibly, rather than clipping.
        const squeezed = rows[rows.length - 1];
        assert.equal(squeezed.bandScrolls, true, 'the band did not scroll once squeezed under its content');
        assert.notEqual(squeezed.bandOverflow, 'hidden', 'the band clips silently - §2.4 exists to end that');

        const m = await page.metrics(BAND);
        assert.ok(m.scrollbarInline > 0,
            'the band scrolls with no scrollbar - a region the user cannot tell is scrollable is the same '
            + 'defect one step later ');

        assert.ok(rows.every((r) => r.railScrolls),
            'the rail did not scroll at these heights — nine standing rows do not fit them');
    }));

    test('C1 at exactly 1920 x 1080: the numbers the morning review starts from',
        () => browser.withPage({ geometry: C1 }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            const got = JSON.parse(await page.eval(`JSON.stringify(${SAMPLE})`));

            assert.equal(got.screen, 1080, 'the screen is exactly the C1 geometry');
            assert.ok(got.chart > 500, `the chart should own most of the body at 1080: ${got.chart}`);
            assert.ok(got.foot >= got.footFloor - 0.51);
            assert.equal(got.bandScrolls, false, 'nothing scrolls at C1');

            // The four bands add up to the window, with two seams and nothing left over.
            const header = await page.box(`live-screen >>> live-header`);
            const main = await page.box(`live-screen >>> live-main`);
            const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'block-size'));
            const total = header.height + seam + main.height + seam + got.foot;
            assert.ok(Math.abs(total - 1080) < 1.01, `the rows do not fill the window: ${total}`);
        }));
});

describe('the Live screen draws temperatures in the unit the person chose', () => {
    const drive = (page, unit) => page.evalFn(async (u) => {
        const lm = await import('/src/lib/machine-limits.js');
        const el = document.querySelector('live-screen');
        el.limits = lm.limitsFor('bengle');
        el.tempUnit = u;
        el.readings = { group: 92.3, steam: 148.6, milk: 61.1 };
        el.targets = { brewTemp: 92, steamTemp: 160 };
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const root = el.shadowRoot;
        const tile = (label) => [...root.querySelectorAll('ui-stat-tile')].find((t) => t.label === label);
        const step = (key) => root.querySelector(`ui-stepper[data-key="${key}"]`);
        const drawn = (el_) => (el_?.shadowRoot?.querySelector('.value, #value, output')?.textContent ?? '').trim();
        return {
            group: { unit: tile('Group')?.unit, drawn: drawn(tile('Group')) },
            steamTile: { unit: tile('Steam')?.unit, drawn: drawn(tile('Steam')) },
            brew: step('brewTemp') ? {
                unit: step('brewTemp').unit, min: step('brewTemp').min,
                max: step('brewTemp').max, drawn: drawn(step('brewTemp')),
            } : null,
        };
    }, unit);

    test('Celsius is the wire\'s own unit and nothing moves', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        const shown = await drive(page, 'c');
        assert.equal(shown.group.unit, '°C');
        assert.match(shown.group.drawn, /92\.3/);
        assert.equal(shown.brew.unit, '°C');
        assert.equal(shown.brew.min, 70);
        assert.equal(shown.brew.max, 110);
    }));

    test('Fahrenheit moves the tiles, the band and the symbol together', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        const shown = await drive(page, 'f');
        /* SAME DECIMAL PLACE AS THE ORIGINAL. The tiles have always drawn one decimal and
         * still do; 92.3 C is 198.14 F, which prints as 198.1. */
        assert.equal(shown.group.unit, '°F');
        assert.match(shown.group.drawn, /198\.1/);
        assert.equal(shown.steamTile.unit, '°F');
        assert.match(shown.steamTile.drawn, /299\.5/);
        /* AND THE BAND UNDER THE CONTROL, rounded to whole display units — a bound printed
         * as 157.98 invites a value the band would refuse. */
        assert.equal(shown.brew.unit, '°F');
        assert.equal(shown.brew.min, 158);
        assert.equal(shown.brew.max, 230);
    }));

    test('a press sends the MACHINE\'s number, not the drawn one', () => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(6);
        await drive(page, 'f');
        const sent = await page.evalFn(async () => {
            const el = document.querySelector('live-screen');
            const seen = [];
            el.addEventListener('target-change', (e) => seen.push(e.detail));
            const stepper = el.shadowRoot.querySelector('ui-stepper[data-key="brewTemp"]');
            stepper.dispatchEvent(new CustomEvent('change', {
                detail: { value: stepper.next(stepper.value, 1) }, bubbles: true, composed: true,
            }));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return seen;
        });
        assert.equal(sent.length, 1, 'one press, one event');
        assert.equal(sent[0].key, 'brewTemp');
        /* ONE MACHINE STEP: brewTemp steps by 0.5 °C, so 92 becomes 92.5 on the wire
         * not 92.2777…, which is what a one-Fahrenheit-degree step would have sent. */
        assert.equal(sent[0].value, 92.5);
    }));
});
