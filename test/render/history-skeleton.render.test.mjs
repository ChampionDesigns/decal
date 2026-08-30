/**
 * history-skeleton.render.test.mjs — wave 5.6, the route-and-skeleton cluster:
 * `hist-skeleton`, `hist-scroll-floors`, `hist-ab-pickers`, and bugs H3, H6, H9's
 * skeleton half. (`hist-route-conversion` and H9's focus half are the OTHER suite,
 * `history-route.render.test.mjs`, because they need a shell and a route table and
 * this one needs neither.)
 *
 * ONE SUITE, FOUR ROWS, because they are claims about the same four boxes and
 * splitting them would mean mounting the screen four times to ask four questions about
 * one layout.
 *
 * A8, AND IT IS THE POINT OF THE FILE. Nothing here opens a file: every assertion is a
 * computed style or a rendered box. The header's priorities are SWEPT across four
 * widths rather than asserted at two convenient ones, the track lists are the USED ones
 * off getComputedStyle, the floor token is proved by moving a box rather than by being
 * present, and the H3 rule is proved LOAD-BEARING by taking it away and watching the
 * defect come back.
 *
 * BOTH GATE A GEOMETRIES: 1281x801 @ dsf 1.5 (the bench truth) and the 1000x600 design
 * floor. This screen's own responsive behaviour is the header's order of surrender, and
 * the two geometries sit either side of where it starts to bite.
 *
 * THE PAGES ARE STAND-INS, AND THAT IS DELIBERATE. `hist-flow-page` and `hist-data-page`
 * are another builder's rows; this suite owns the MOUNT REGION and the floors table, so
 * it mounts two stand-ins that follow the region's stated contract (§4.5's own row
 * lists, the floor token, and who owns overflow) and asserts the contract holds. What is
 * proved here is that a page written to the contract gets the box the contract promises
 * — the real pages are the pages cluster's to verify.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertScrollFloor, assertOneSelectionTreatment } from '../harness/assertions.js';

const MODULES = ['/src/screens/history-screen.js'];

const S = 'history-screen';
const HEADER = `${S} >>> history-header`;
const PICKER_A = `${HEADER} >>> #picker-a`;
const PICKER_B = `${HEADER} >>> #picker-b`;
const TABS = `${S} >>> #tabs`;
const TABLIST = `${TABS} >>> #tablist`;
const SELECT_A = `${S} >>> #select-a`;
const SELECT_B = `${S} >>> #select-b`;
const DISC_A = `${S} >>> #disc-a`;
const DISC_B = `${S} >>> #disc-b`;
const COMPARE = `${S} >>> #compare`;
const PAGE = `${S} >>> #page`;

const px = (value) => parseFloat(value);
const tracks = (value) => String(value).trim().split(/\s+/).map(px);
const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: ${got} is not within ${tol} of ${want}`,
);

/**
 * A realistic option label. Its width is what decides where the tab bank runs out of
 * give (M10 — "the shot-picker option-text width" — is the open measurement), so the
 * label is stated once, here, and the numbers this suite records are the numbers for
 * THIS label rather than for all labels.
 */
const SHOTS = [
    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
];

/**
 * The stage. Two stand-in pages, each written to the mount region's contract:
 *
 *   flow  grid-template-rows: 1.2fr 1fr, two plot regions each floored at
 *         --ui-chart-min-h, NO overflow anywhere — they resize (H1).
 *   data  grid-template-rows: auto auto minmax(0,1fr); two tables at their own
 *         min-content with no overflow; the shot list floored at
 *         --ui-history-list-min-h with overflow auto.
 *
 * Ratio tracks and tokens only: there is not a px plot height in this file, in source
 * or in a fixture, which is H1's standing rule.
 */
function stage({ height = '100dvh', width = '100%', rows = 12 } = {}) {
    const list = Array.from({ length: rows }, (_, i) =>
        `<div class="shot-row" data-row="${i}">shot ${i}</div>`).join('');
    /* The stand-ins' rules live in a sheet rather than in `style=` attributes for one
     * reason, and it is the contract talking: `hidden` is how #32 hides the page that
     * is not showing, and an INLINE display would outrank the UA's [hidden] rule (bug
     * P13's mechanism). A real page is a custom element and gets that for free from
     * base.js's :host([hidden]); a stand-in div has to say it. */
    return `<style>
        .page { min-block-size: 0; min-inline-size: 0; }
        .page[hidden] { display: none; }
        #flow-page { display: grid; grid-template-rows: 1.2fr 1fr; gap: var(--ui-space-3); }
        #flow-page > div { min-block-size: var(--ui-chart-min-h); }
        #data-page { display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
        #table-a, #table-b { block-size: min-content; }
        #table-a > div, #table-b > div { block-size: var(--ui-control-h); }
        #shot-list { min-block-size: var(--ui-history-list-min-h); overflow: auto; }
        .shot-row { block-size: var(--ui-list-row); }
    </style>
    <div id="stage" style="inline-size: ${width}; block-size: ${height}">
        <history-screen>
            <div id="flow-page" class="page" slot="page" data-page="flow">
                <div id="plot-a">plot A</div>
                <div id="plot-b">plot B</div>
            </div>
            <div id="data-page" class="page" slot="page" data-page="data">
                <div id="table-a"><div>table A row</div></div>
                <div id="table-b"><div>table B row</div></div>
                <div id="shot-list">${list}</div>
            </div>
        </history-screen>
    </div>`;
}

async function mountHistory(page, options = {}) {
    await page.mount(stage(options), MODULES);
    await page.evalFn((options) => {
        const screen = document.querySelector('history-screen');
        /* `shotOptions`, not `shots`: Gate D retires `/\.shots\b/` tree-wide (CB-21 —
         * the list answers {items,...} and the old skin read `.shots`), and a test that
         * kept the retired spelling alive would be the place it came back from. */
        screen.shotOptions = options;
        screen.shotA = options[0].value;
        screen.shotB = options[1].value;
    }, SHOTS);
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the history screen must mount without throwing');
    return page;
}

/**
 * Show a page THROUGH THE TAB BAR, which is the one owner of which page shows.
 *
 * The index is ASKED OF THE BAR rather than counted here. It used to be
 * `value === 'flow' ? 0 : 1`, which was true while History had two pages and silently
 * became "the power page" the moment it had three — the tab bar is the owner, so it is
 * the thing that knows where a page sits.
 */
async function showPage(page, value) {
    const index = await page.evalFn((v) => {
        const bar = window.__h.need('history-screen').shadowRoot.getElementById('tabs');
        return bar.tabs.findIndex((tab) => tab.value === v);
    }, value);
    assert.ok(index >= 0, `showPage: the bar has no "${value}" tab`);
    /* SCROLLED INTO VIEW BEFORE IT IS CLICKED, and that is a MEASUREMENT rather than a
     * convenience. `page.click` dispatches a real pointer at the element's centre, so a
     * control outside the viewport cannot be pressed — and at the 1000x600 design floor
     * the History band OVERFLOWS (27px with the short option label before the power page,
     * 77px with three tabs; 201px with the long label), which puts the last tab past the
     * right edge. That is the band's documented last resort — "the flanks overflow, never
     * shove" — and it is M10's open budget arriving at a control: the tabs are still above
     * --ui-hit-min in SIZE, which is what the L22 test below asserts, and what they are
     * not at the floor is on screen. Recorded as a deferred question with both numbers
     * rather than hidden by clicking through the DOM. */
    await page.evalFn((i) => {
        const bar = window.__h.need('history-screen').shadowRoot.getElementById('tabs');
        bar.shadowRoot.getElementById('tablist').shadowRoot
            .getElementById(`item-${i}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, index);
    await page.settle(2);
    await page.click(`${TABLIST} >>> #item-${index}`);
    await page.settle(4);
    return page.evalFn((s) => window.__h.need(s).getAttribute('page'), S);
}

/** Every rect the header walk needs, in one round trip. */
const headerRects = (page) => page.evalFn(() => {
    const w = (el) => Math.round(el.getBoundingClientRect().width * 100) / 100;
    const header = window.__h.need('history-screen >>> history-header');
    const root = header.shadowRoot;
    const screen = window.__h.need('history-screen').shadowRoot;
    return {
        back: w(root.getElementById('back')),
        pickerA: w(root.getElementById('picker-a')),
        pickerB: w(root.getElementById('picker-b')),
        tabs: w(root.getElementById('tabs')),
        selectA: w(screen.getElementById('select-a')),
        selectB: w(screen.getElementById('select-b')),
        overflow: header.scrollWidth - header.clientWidth,
    };
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`history skeleton @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, options) => browser.withPage({ geometry }, async (page) => {
            await mountHistory(page, options);
            return fn(page);
        });

        /* -- 1. the skeleton: §4.5's three rows ---------------------------- */

        test('the screen is three rows — band, compare bar, page — and the tracks are the declared ones',
            () => mounted(async (page) => {
                const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
                const seam = px(await page.resolveToken('--ui-seam', 'block-size'));

                const used = tracks(await page.prop(S, 'grid-template-rows'));
                assert.equal(used.length, 3,
                    'three ROWS — band, compare bar, page region — whatever the number of PAGES: '
                    + 'the power page added a tab and a panel, not a row');
                near(used[0], band, 'row 1 is var(--ui-band-h)');

                const screen = await page.box(S);
                const header = await page.box(HEADER);
                const bar = await page.box(COMPARE);
                const region = await page.box(PAGE);

                near(header.height, band, 'the band renders its token height');
                near(used[1], bar.height, 'row 2 is the compare bar\'s own height (auto) — H8');
                near(used[2], region.height, 'row 3 is the page region');

                /* The three rows and the two seams are the whole screen: nothing is
                 * unaccounted for, which is what "the track arithmetic belongs to the
                 * grid" means when it is true (H6). */
                near(used[0] + used[1] + used[2] + 2 * seam, screen.height, 'the rows sum to the screen');
            }));

        /* -- 2. H6: the used size IS the track size, at two heights -------- */

        test('H6: no box is over-constrained — the used size equals the track at two heights',
            () => mounted(async (page) => {
                for (const height of ['100dvh', '560px']) {
                    await page.setStyle('#stage', { 'block-size': height });
                    await page.settle(4);

                    const stageBox = await page.box('#stage');
                    const screen = await page.box(S);
                    const used = tracks(await page.prop(S, 'grid-template-rows'));
                    const region = await page.box(PAGE);

                    near(screen.height, stageBox.height, `the screen fills its track at ${height}`);
                    near(region.height, used[2], `the page region IS row 3 at ${height}`);

                    /* THE H6 SHAPE ITSELF: a flex item whose siblings already claim
                     * space, told it is 100% of something it is not. Read as a
                     * consequence rather than as a declaration — no child of a flex
                     * container may be taller than the container's content box. */
                    const overs = await page.evalFn(() => {
                        const out = [];
                        const walk = (root) => {
                            for (const el of root.querySelectorAll('*')) {
                                const parent = el.parentElement;
                                if (parent && getComputedStyle(parent).display.includes('flex')) {
                                    const p = parent.getBoundingClientRect();
                                    const c = el.getBoundingClientRect();
                                    if (c.height > p.height + 0.5) {
                                        out.push(`${el.tagName.toLowerCase()}#${el.id || '?'} ${c.height} > ${p.height}`);
                                    }
                                }
                                if (el.shadowRoot) walk(el.shadowRoot);
                            }
                        };
                        walk(window.__h.need('history-screen').shadowRoot);
                        return out;
                    });
                    assert.deepEqual(overs, [], `nothing over-constrains a flex line at ${height}`);
                }
            }));

        /* -- 3. H3: the header's priorities, swept ------------------------- */

        test('H3: the tab bank gives before the pickers collapse, and the floor is load-bearing',
            () => mounted(async (page) => {
                /* Four widths through the crossover. The pickers hold their measure;
                 * the bank is what shrinks, monotonically.
                 *
                 * THE WINDOW MOVED UP WITH THE THIRD TAB (fix run 6). At two tabs the
                 * crossover sat inside 1050-900; at three the bank's content is 257.56
                 * and its floor is 168 (one --ui-hit-min per page plus the gaps), so it
                 * is ALREADY ON ITS FLOOR at 1050 and there is nothing left to give in
                 * the old window. Re-measured, short label, both geometries:
                 *
                 *     width   pickerA   tab bank    band overflow
                 *     1200    380.81    257.56      0     <- the pickers still have slack
                 *     1150    373       223.2       0     <- the pickers freeze here
                 *     1100    373       173.2       0
                 *     1050    373       168         27    <- the bank is on its floor
                 *
                 * The sweep runs 1150-1050 rather than 1200-1050 so that every width in
                 * it has the pickers ON their measure: above the freeze they share the
                 * free space and the two of them differ by a flex remainder of 0.02px,
                 * which T9's exact equality would report as a difference in measure.
                 *
                 * Same shape, sixty pixels further right: the pickers take the room
                 * first, then hold their measure, then every pixel comes out of the
                 * bank until IT hits its floor, and then the band overflows. */
                const widths = [1150, 1130, 1100, 1050];
                const walk = [];
                for (const width of widths) {
                    await page.setStyle('#stage', { 'inline-size': `${width}px` });
                    await page.settle(3);
                    walk.push({ width, ...await headerRects(page) });
                }

                for (let i = 1; i < walk.length; i += 1) {
                    assert.ok(walk[i].tabs <= walk[i - 1].tabs + 0.5,
                        `the tab bank must not grow as the band narrows: ${JSON.stringify(walk)}`);
                }
                assert.ok(walk.at(-1).tabs < walk[0].tabs - 0.5,
                    `the tab bank must GIVE — H3 is 720px pinned flex: 0 0: ${JSON.stringify(walk)}`);

                const floor = Math.min(...walk.map((w) => w.pickerA));
                assert.ok(floor > walk.at(-1).tabs,
                    'the pickers keep a usable measure while the bank gives');
                for (const w of walk) {
                    assert.equal(w.pickerA, w.pickerB, `the two pickers stay equal at ${w.width}`);
                    assert.ok(w.selectA >= floor - w.pickerA + 1 || w.selectA > 0,
                        'the select is on screen at every width');
                }
                /* The pickers' own measure never moves while the bank is giving. */
                near(walk.at(-1).pickerA, walk.at(-2).pickerA, 'the pickers are at their floor and hold');

                /* AND THE RULE IS LOAD-BEARING. Take the floor away — §4.5's literal
                 * `min-inline-size: 0` — and H3 comes back with the labels swapped:
                 * the pickers give everything and the bank never moves. */
                await page.evalFn(() => {
                    const root = window.__h.need('history-screen >>> history-header').shadowRoot;
                    for (const id of ['picker-a', 'picker-b']) {
                        root.getElementById(id).style.minInlineSize = '0';
                    }
                });
                const collapsed = [];
                for (const width of widths) {
                    await page.setStyle('#stage', { 'inline-size': `${width}px` });
                    await page.settle(3);
                    collapsed.push({ width, ...await headerRects(page) });
                }
                assert.ok(collapsed.at(-1).pickerA < collapsed[0].pickerA - 0.5,
                    'without the floor the pickers are what gives — the defect');
                near(collapsed.at(-1).tabs, collapsed[0].tabs,
                    'without the floor the bank never moves — which is exactly H3');
            }));

        /* -- 3b. L22: the band's order of surrender has a floor ------------ */

        test('L22: nothing in the band shrinks under the hit floor, on either label set',
            () => mounted(async (page) => {
                /* THIS TEST EXISTS BECAUSE THE H3 FIX HAD A DEFECT AND A FRAME FOUND
                 * IT. The tab bank was written `flex: 0 1 auto` with no floor, on the
                 * reasoning that it would stop at #32's own min-content. It does not:
                 * #32 is inline-size: fit-content and shrinks its TABS with it, so at
                 * the 1000x600 design floor the bank rendered 2 wide with two 36 x 80
                 * tab buttons — L22, on the screen built to kill H3. Nothing in the
                 * suite asked, because the H3 sweep measured the bank's RECT and a rect
                 * of 2 reads as "the bank gave", which is exactly what it was asked to
                 * do. So the claim here is about the CONTROLS, not the boxes.
                 *
                 * BOTH LABEL SETS, because the option text is what drives the squeeze
                 * (M10) and a test that used only the short form would pass while the
                 * app shipped with the long one. */
                const min = px(await page.resolveToken('--ui-hit-min', 'width'));
                for (const label of ['13 Aug 14:32 · Extractamundo', '13 Aug 14:32 · Extractamundo Dos! (2)']) {
                    await page.evalFn((text) => {
                        const screen = document.querySelector('history-screen');
                        screen.shotOptions = [
                            { value: 'shot-1', label: text },
                            { value: 'shot-2', label: text },
                        ];
                    }, label);
                    await page.settle(4);

                    const small = await page.evalFn((floor) => {
                        const bad = [];
                        const walk = (root, path) => {
                            for (const el of root.querySelectorAll('*')) {
                                if (el.shadowRoot) walk(el.shadowRoot, `${path} ${el.tagName.toLowerCase()}`);
                                if (!/^(BUTTON|INPUT|A|SELECT)$/.test(el.tagName) || el.disabled) continue;
                                const r = el.getBoundingClientRect();
                                if (r.width === 0 && r.height === 0) continue;
                                if (r.width < floor - 0.5 || r.height < floor - 0.5) {
                                    bad.push(`${path} ${el.tagName.toLowerCase()} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
                                }
                            }
                        };
                        walk(window.__h.need('history-screen').shadowRoot, 'history-screen');
                        return bad;
                    }, min);
                    assert.deepEqual(small, [],
                        `a control in the band is under --ui-hit-min with label "${label}"`);
                }
            }));

        /* -- 4. the pickers: T9, and one selection treatment --------------- */

        test('T9: both pickers render the same width at three widths, and the disc is the dials',
            () => mounted(async (page) => {
                for (const width of [1200, 1050, 950]) {
                    await page.setStyle('#stage', { 'inline-size': `${width}px` });
                    await page.settle(3);
                    const rects = await headerRects(page);
                    assert.equal(rects.selectA, rects.selectB,
                        `T9: two selects on one screen must be one width (Slate: 250 and 213.578) at ${width}`);
                    assert.ok(rects.selectA > 0, 'and they are on screen');
                }
                await page.setStyle('#stage', { 'inline-size': '100%' });
                await page.settle(3);

                /* #45 is selection-family paint on a disc: the four dials and nothing
                 * else. A private selected look here is the defect that started the
                 * audit. */
                await assertOneSelectionTreatment(page, { selected: DISC_A, unselected: DISC_B });
            }));

        /* -- 5. the compare bar's presence rule ---------------------------- */

        test('the compare bar is on the flow page and takes no box on the data page',
            () => mounted(async (page) => {
                assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('page'), S), 'flow');
                const onFlow = await page.box(COMPARE);
                const regionOnFlow = await page.box(PAGE);
                assert.ok(onFlow.height > 0, 'a chart page has a time axis, so the bar is shown');
                assert.notEqual(await page.prop(COMPARE, 'display'), 'none');

                assert.equal(await showPage(page, 'data'), 'data');
                const onData = await page.box(COMPARE);
                const regionOnData = await page.box(PAGE);
                assert.equal(await page.prop(COMPARE, 'display'), 'none',
                    'a table has no time axis: the bar is not shown at all rather than shown dead');
                assert.equal(onData.height, 0, 'and the auto row measures zero');
                assert.ok(regionOnData.height > regionOnFlow.height + onFlow.height - 1,
                    'the page takes the pixels the bar gave back');

                assert.equal(await showPage(page, 'flow'), 'flow');
                assert.ok((await page.box(COMPARE)).height > 0, 'and it comes back with the chart page');
            }));

        /* -- 6. the floors table ------------------------------------------- */

        test('the shot list floor is 3 x --ui-list-row, as a token that moves the box',
            () => mounted(async (page) => {
                const row = px(await page.resolveToken('--ui-list-row', 'block-size'));
                const floor = px(await page.resolveToken('--ui-history-list-min-h', 'block-size'));
                near(floor, 3 * row, 'the floor is three rows of the shipped pitch, not a literal');

                await showPage(page, 'data');
                const before = (await page.box('#shot-list')).height;
                assert.ok(before > floor, 'with room to spare the list is bigger than its floor');

                /* Squeeze past the point where the track can pay, and the floor is
                 * what stops it. */
                await page.setStyle('#stage', { 'block-size': '420px' });
                await page.settle(3);
                const squeezed = (await page.box('#shot-list')).height;
                near(squeezed, floor, 'squeezed, the list sits exactly on its floor');

                /* AND IT GOVERNS: move the token and the box moves with it (E8's proof —
                 * a token that is declared, documented and connected to nothing is the
                 * recorded failure this shape exists to catch). */
                await page.setToken('--ui-history-list-min-h', `${floor + 40}px`);
                await page.settle(3);
                const moved = (await page.box('#shot-list')).height;
                await page.setToken('--ui-history-list-min-h', null);
                await page.settle(2);
                near(moved, floor + 40, 'the token moves the rendered box');
            }));

        test('the shot list scrolls with a VISIBLE scrollbar; the data tables do not scroll at all',
            () => mounted(async (page) => {
                await showPage(page, 'data');
                await assertScrollFloor(page, {
                    selector: '#shot-list',
                    squeezeSelector: '#stage',
                    squeeze: { 'block-size': '560px' },
                    minBlockSize: px(await page.resolveToken('--ui-history-list-min-h', 'block-size')),
                });

                /* The tables are fixed summaries: their own min-content, and NO
                 * overflow — a table that scrolled would be a second scroll region on
                 * a page whose one scroll region is the list. */
                for (const id of ['#table-a', '#table-b']) {
                    const m = await page.metrics(id);
                    assert.equal(m.overflowY, 'visible', `${id} declares no overflow`);
                    assert.ok(m.scrollHeight <= m.clientHeight + 0.5, `${id} does not scroll`);
                }

                /* And the region above them owns none of it (bug L24: overflow:auto
                 * makes a box a clipping ancestor, and a region that clipped would clip
                 * a focus ring it does not own). */
                const region = await page.metrics(PAGE);
                assert.equal(region.overflowY, 'visible', 'the mount region declares no overflow');
                assert.equal(region.overflowX, 'visible', 'in either axis');
            }));

        test('the chart page RESIZES and never scrolls, with each plot floored at --ui-chart-min-h',
            () => mounted(async (page) => {
                const chartMin = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));

                const tall = await page.evalFn(() => ({
                    a: window.__h.need('#plot-a').getBoundingClientRect().height,
                    b: window.__h.need('#plot-b').getBoundingClientRect().height,
                }));
                assert.ok(tall.a > chartMin && tall.b > chartMin, 'both plots start above the floor');
                assert.ok(tall.a > tall.b, '1.2fr over 1fr — a ratio track, not a px height');
                near(tall.a / tall.b, 1.2, 'and the ratio is the declared one', 0.02);

                /* 560px is below BOTH Gate A geometries, so this is a squeeze at
                 * each of them rather than a stretch at one — and it is still tall
                 * enough that the two floors do not bind, which is the state being
                 * measured (below that the page owes H1's one-plot branch, and that
                 * is the pages cluster's row). */
                await page.setStyle('#stage', { 'block-size': '560px' });
                await page.settle(4);
                const short = await page.evalFn(() => ({
                    a: window.__h.need('#plot-a').getBoundingClientRect().height,
                    b: window.__h.need('#plot-b').getBoundingClientRect().height,
                }));
                assert.ok(short.a < tall.a - 1, 'the plots RESIZE with the page (H1)');
                assert.ok(short.a >= chartMin - 0.5 && short.b >= chartMin - 0.5,
                    'and neither goes below --ui-chart-min-h');

                const flow = await page.metrics('#flow-page');
                assert.equal(flow.overflowY, 'visible', 'the chart page never scrolls — it resizes');
            }));

        /* -- 7. H9's skeleton half ----------------------------------------- */

        test('H9: a route is not modal — no aria-modal, and no inert left on a visible box',
            () => mounted(async (page) => {
                const found = await page.evalFn(() => {
                    const modal = [];
                    const inert = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            if (el.getAttribute('aria-modal') !== null) modal.push(el.tagName.toLowerCase());
                            if (el.hasAttribute('inert') && !el.hasAttribute('hidden')) {
                                inert.push(el.tagName.toLowerCase());
                            }
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document);
                    return { modal, inert };
                });
                assert.deepEqual(found.modal, [],
                    'H9 is aria-modal="true" with nothing inert; a route must not wear it at all');
                assert.deepEqual(found.inert, [],
                    'the only inert boxes are #32\'s hidden panels, and they are released when shown');

                /* Released, not left behind: the page that was inert is not inert when
                 * it is the page showing. */
                await showPage(page, 'data');
                const dataInert = await page.evalFn(() => window.__h.need('#data-page').hasAttribute('inert'));
                assert.equal(dataInert, false, 'the shown page is not inert');
            }));

        /* -- 8. PARITY SURFACE 6 ------------------------------------------
         *
         * Three assertions, and the third is a CLASS rather than a detail.
         *
         * THE SLOT BLIND SPOT (surface 5's hand-forward, carried here). The provenance
         * walk keeps an element only if it is a control, or paints, or has an OWN TEXT
         * NODE. A shadow-root box whose only content arrives through a <slot> has no
         * own text node, so if it paints nothing it is invisible to the corpus AT ANY
         * SIZE — and the corpus is what every parity gate reads. This band is full of
         * them: <ui-button>'s inner button carries the ground and the word arrives
         * through a slot (the corpus records its text as ""), and #45's letter is
         * slotted inside a span the walk records by its visually-hidden LABEL. A
         * render assertion is the only guard those four words have, so this is it.
         * ---------------------------------------------------------------- */

        test('parity 6 — the page region is inset --ui-space-6 on both flanks',
            () => mounted(async (page) => {
                const want = px(await page.resolveToken('--ui-space-6', 'inline-size'));
                const got = await page.computed(PAGE, ['padding-left', 'padding-right']);
                near(px(got['padding-left']), want, 'the page region pads --ui-space-6 at the lead');
                near(px(got['padding-right']), want, 'and the same at the trail');

                /* AGAINST THE RENDERED BOXES, not only the declaration: the mounted
                 * page's own box has to START inside the screen by exactly that much,
                 * or the padding is on a box the page does not sit in. The oracle
                 * insets all three of its History surfaces by 28 (CITE history-viewer
                 * #hv-page-flow [i=179] rect x=28 width=1864). */
                const screen = await page.box(S);
                const mountedPage = await page.box('#flow-page');
                near(mountedPage.x - screen.x, want, 'the page starts one inset inside the screen');
                near((screen.x + screen.width) - (mountedPage.x + mountedPage.width), want,
                    'and stops one inset short of its trailing edge');

                /* AND THE INSET IS INLINE ONLY. Block padding here would widen the data
                 * page's recorded overflow (ECM-1053) by 2 x 28, and that number is
                 * Ben's open question. */
                const block = await page.computed(PAGE, ['padding-top', 'padding-bottom']);
                assert.equal(px(block['padding-top']), 0, 'no block padding: the seam is the divider');
                assert.equal(px(block['padding-bottom']), 0, 'no block padding at the foot either');
            }));

        test('parity 6 — the band\'s way out is --ui-control-lg, not --ui-control-h',
            () => mounted(async (page) => {
                const lg = px(await page.resolveToken('--ui-control-lg', 'block-size'));
                const h = px(await page.resolveToken('--ui-control-h', 'block-size'));
                assert.notEqual(lg, h,
                    'the two control tokens must differ, or this test proves nothing');

                const back = await page.box(`${S} >>> #back >>> #btn`);
                near(back.height, lg,
                    'CITE history-viewer #hv-back [i=161] rect 82x82 — a band control is tall');

                /* The band's own derivation is what makes 82 the right number rather
                 * than a bigger one: --ui-band-h is (control-lg + 2 x band-inset) x
                 * density, so the control is exactly the band less its two insets, and
                 * the dead space above and below is one inset each. */
                const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
                const inset = px(await page.resolveToken('--ui-band-inset', 'block-size'));
                const density = parseFloat(await page.resolveValue('var(--ui-density)', 'opacity'));
                near(band, (lg + 2 * inset) * density, '--ui-band-h is the control plus two insets');
                const header = await page.box(HEADER);
                near(back.y - header.y, (band - back.height) / 2, 'and the control is centred in it');
            }));

        test('parity 6 — every slot-delivered word in the band actually paints',
            () => mounted(async (page) => {
                /* Painted text, measured as a BOX rather than read as a string: a word
                 * whose slot never got its content still reads back as the label the
                 * consumer set, and a zero-width box is exactly what surface 5 found
                 * when a slotted caption rendered 0px wide and no corpus could see it. */
                const boxes = await page.evalFn(() => {
                    const need = window.__h.need;
                    const screen = need('history-screen').shadowRoot;
                    const out = {};
                    const measure = (label, el) => {
                        const r = el ? el.getBoundingClientRect() : null;
                        out[label] = r
                            ? { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
                                text: (el.textContent || '').trim() }
                            : null;
                    };
                    const slotted = (host) => {
                        const slot = host.shadowRoot.querySelector('slot:not([name])');
                        const nodes = slot ? slot.assignedNodes({ flatten: true }) : [];
                        const range = document.createRange();
                        if (!nodes.length) return null;
                        range.setStartBefore(nodes[0]);
                        range.setEndAfter(nodes[nodes.length - 1]);
                        const r = range.getBoundingClientRect();
                        return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
                            text: nodes.map((n) => n.textContent || '').join('').trim() };
                    };
                    measure('back', screen.getElementById('back'));
                    out.backWord = slotted(screen.getElementById('back'));
                    out.discA = slotted(screen.getElementById('disc-a'));
                    out.discB = slotted(screen.getElementById('disc-b'));
                    const bar = screen.getElementById('compare');
                    out.resetWord = slotted(bar.shadowRoot.getElementById('reset'));
                    return out;
                });

                for (const [name, want] of [['backWord', 'Back'], ['discA', 'A'],
                    ['discB', 'B'], ['resetWord', 'Reset']]) {
                    const got = boxes[name];
                    assert.ok(got, `${name}: nothing is assigned to the slot at all`);
                    assert.equal(got.text, want, `${name}: the slot carries the word`);
                    assert.ok(got.w > 0 && got.h > 0,
                        `${name}: the word RENDERS — measured ${got.w}x${got.h}. This is the only `
                        + 'guard it has: slot-delivered content that paints nothing is invisible to '
                        + 'the provenance corpus at any size (surface 5\'s second blind spot).');
                }
            }));

        test('parity 6 — the band is a TOP BAR and paints --ui-bar, like every other band',
            () => mounted(async (page) => {
                const bar = await page.resolveToken('--ui-bar', 'background-color');
                const fascia = await page.resolveToken('--ui-fascia', 'background-color');
                assert.notEqual(bar, fascia,
                    'the two grounds must differ, or this test proves nothing');
                const got = await page.prop(HEADER, 'background-color');
                assert.equal(got, bar,
                    'ORACLE history-viewer .slate-hv-header background-color = rgb(17, 22, 26), '
                    + 'the same value Slate paints its Live header — and live-header.js and '
                    + 'ui-page-header.js already read --ui-bar');
                /* And the region BELOW it is still the page body's colour, so the two are
                 * a bar over a body rather than one flat field. */
                const page_ = await page.prop(PAGE, 'background-color');
                assert.equal(page_, fascia, 'the page region keeps --ui-fascia under the bar');
            }));

        test('parity 6 — the band\'s discs are TAGS: filled, not the shot list\'s hollow',
            () => mounted(async (page) => {
                for (const id of ['disc-a', 'disc-b']) {
                    const form = await page.evalFn((i) => window.__h
                        .need('history-screen').shadowRoot.getElementById(i).form, id);
                    assert.equal(form, 'tag',
                        `#${id} names a slot for the life of the screen, so it is a TAG`);
                }
                /* B is the RESTING one (A carries `selected`), so it is the one that
                 * shows the resting paint. CITE history-viewer .slate-hv-pick-tag
                 * [i=166]: --ui-key on a --ui-line-strong ring with --ui-text ink. */
                const got = await page.computed(`${DISC_B} >>> #disc`,
                    ['background-color', 'border-top-color', 'color']);
                assert.equal(got['background-color'], await page.resolveToken('--ui-key', 'background-color'),
                    'a hollow disc on the header bar is Slate\'s own recorded failure: '
                    + '"the circle vanished and left a faint letter floating in the header"');
                assert.equal(got['border-top-color'],
                    await page.resolveToken('--ui-line-strong', 'border-top-color'),
                    'CITE history-viewer .slate-hv-pick-tag [i=166] border-top-color');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'),
                    'ORACLE same element color -> --ui-text, never --ui-muted');
                /* And still pressable — the half the `interactive` attribute keeps.
                 * Read off the DOM: page.prop() answers a COMPUTED STYLE, so asking it
                 * for tagName reads back "" and would pass for a span. */
                const tag = await page.evalFn(() => window.__h.need('history-screen')
                    .shadowRoot.getElementById('disc-b').shadowRoot
                    .getElementById('disc').tagName);
                assert.equal(tag, 'BUTTON', 'the band\'s disc is still a real button');
            }));
    });
}
