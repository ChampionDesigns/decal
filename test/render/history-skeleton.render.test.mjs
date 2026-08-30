/**
 *.6, the route-and-skeleton cluster: hist-skeleton, hist-scroll-floors, hist-ab-pickers, and bugs H3, H6, H9's skeleton half.
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

const SHOTS = [
    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
];

function stage({ height = '100dvh', width = '100%', rows = 12 } = {}) {
    const list = Array.from({ length: rows }, (_, i) =>
        `<div class="shot-row" data-row="${i}">shot ${i}</div>`).join('');
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
        screen.shotOptions = options;
        screen.shotA = options[0].value;
        screen.shotB = options[1].value;
    }, SHOTS);
    await page.settle(6);
    assert.deepEqual(page.pageErrors, [], 'the history screen must mount without throwing');
    return page;
}

async function showPage(page, value) {
    const index = await page.evalFn((v) => {
        const bar = window.__h.need('history-screen').shadowRoot.getElementById('tabs');
        return bar.tabs.findIndex((tab) => tab.value === v);
    }, value);
    assert.ok(index >= 0, `showPage: the bar has no "${value}" tab`);
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

        test('H3: the tab bank gives before the pickers collapse, and the floor is load-bearing',
            () => mounted(async (page) => {
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

        test('L22: nothing in the band shrinks under the hit floor, on either label set',
            () => mounted(async (page) => {
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

        test('parity 6 — the page region is inset --ui-space-6 on both flanks',
            () => mounted(async (page) => {
                const want = px(await page.resolveToken('--ui-space-6', 'inline-size'));
                const got = await page.computed(PAGE, ['padding-left', 'padding-right']);
                near(px(got['padding-left']), want, 'the page region pads --ui-space-6 at the lead');
                near(px(got['padding-right']), want, 'and the same at the trail');

                const screen = await page.box(S);
                const mountedPage = await page.box('#flow-page');
                near(mountedPage.x - screen.x, want, 'the page starts one inset inside the screen');
                near((screen.x + screen.width) - (mountedPage.x + mountedPage.width), want,
                    'and stops one inset short of its trailing edge');

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

                const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
                const inset = px(await page.resolveToken('--ui-band-inset', 'block-size'));
                const density = parseFloat(await page.resolveValue('var(--ui-density)', 'opacity'));
                near(band, (lg + 2 * inset) * density, '--ui-band-h is the control plus two insets');
                const header = await page.box(HEADER);
                near(back.y - header.y, (band - back.height) / 2, 'and the control is centred in it');
            }));

        test('parity 6 — every slot-delivered word in the band actually paints',
            () => mounted(async (page) => {
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
                const tag = await page.evalFn(() => window.__h.need('history-screen')
                    .shadowRoot.getElementById('disc-b').shadowRoot
                    .getElementById('disc').tagName);
                assert.equal(tag, 'BUTTON', 'the band\'s disc is still a real button');
            }));
    });
}
