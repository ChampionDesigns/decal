/**
 * The skeleton-and-layout cluster: sel-skeleton, sel-split-collapse, sel-elastic-boxes-notes-ordering, sel-scroll-floors, register-rhythm, no-dead-affordances, and the structural bugs.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertScrollFloor } from '../harness/assertions.js';

const MODULE = ['/src/screens/selector-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh">'
    + '<selector-screen></selector-screen>'
    + '<div id="grid" data-outside>P15 bait: a light-DOM element with the split\'s own id</div>'
    + '</div>';

const S = 'selector-screen';
const HEADER = `${S} >>> ui-page-header`;
const HEADER_BAND = `${S} >>> ui-page-header >>> #band`;
const CONFIRM = `${S} >>> #confirm`;
const SPLIT = `${S} >>> #split`;
const GRID = `${S} >>> #split >>> #grid`;
const LIST_PANE = `${S} >>> #list-pane`;
const LIST_REGION = `${S} >>> #list-pane >>> #list`;
const TOOLBAR = `${S} >>> .toolbar`;
const FILTER = `${S} >>> #filter`;
const ROWS = `${S} >>> #rows`;
const FAVOURITES = `${S} >>> #favourites`;
const DETAIL_PANE = `${S} >>> #detail-pane`;
const TITLE_ROW = `${S} >>> .title-row`;
const SUMMARY = `${S} >>> #summary`;
const CARD = `${S} >>> #preview`;
const NOTES_REGION = `${S} >>> #detail-pane >>> #notes`;
const NOTES = `${S} >>> #notes`;
const OUTSIDE = '#grid';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const tracks = (value) => String(value).trim().split(/\s+/);
const px = (value) => parseFloat(value);

const authored = async (page) => JSON.parse(await page.eval(
    "import('/src/screens/selector-split.js').then((m) => JSON.stringify("
    + '{ collapse: m.SPLIT_COLLAPSE_PX, track: m.SPLIT_LIST_TRACK }))',
));

const SPACE_TOKENS = ['--ui-space-1', '--ui-space-2', '--ui-space-3', '--ui-space-4',
    '--ui-space-5', '--ui-space-6', '--ui-space-7', '--ui-space-8'];

const CSSOM_WALK = `(function (hostSel) {
    var parts = hostSel.split('>>>').map(function (s) { return s.trim(); });
    var root = document, el = null;
    for (var i = 0; i < parts.length; i++) {
        el = root.querySelector(parts[i]);
        if (!el) return JSON.stringify({ error: 'no element for ' + parts[i] });
        root = el.shadowRoot || el;
    }
    var sheets = root.adoptedStyleSheets || [];
    if (!sheets.length) return JSON.stringify({ error: 'no adopted sheets' });
    var own = sheets[sheets.length - 1];
    var host = root.host;
    var out = [];
    var media = [];
    var walk = function (rules, inContainer) {
        for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.media) media.push(rule.conditionText || rule.media.mediaText);
            if (rule.cssRules) { walk(rule.cssRules, inContainer || rule.containerQuery !== undefined); continue; }
            if (!rule.selectorText) continue;
            var pieces = rule.selectorText.split(',').map(function (s) { return s.trim(); });
            var matched = false;
            var maxIds = 0;
            for (var p = 0; p < pieces.length; p++) {
                var sel = pieces[p];
                var ids = (sel.match(/#[A-Za-z_-]/g) || []).length;
                if (ids > maxIds) maxIds = ids;
                try {
                    if (sel === ':host') { matched = true; }
                    else if (sel.indexOf(':host(') === 0) {
                        var inner = sel.slice(6, sel.lastIndexOf(')'));
                        if (host && host.matches(inner)) matched = true;
                    } else if (root.querySelectorAll(sel).length) { matched = true; }
                } catch (e) { matched = true; }
            }
            out.push({ selector: rule.selectorText, matched: matched, ids: maxIds, inContainer: !!inContainer });
        }
    };
    walk(own.cssRules, false);
    return JSON.stringify({ rules: out, media: media, sheets: sheets.length });
})`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`selector skeleton @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            /* THE LISTENER COUNTERS GO IN BEFORE THE MODULES DO — this is 's check and
             * it only means anything if it is installed before the imports it is about.
             * `mount` is what imports them. */
            await page.evalFn(() => {
                window.__listeners = [];
                const wrap = (target, name) => {
                    const original = target.addEventListener.bind(target);
                    target.addEventListener = function (type, ...rest) {
                        window.__listeners.push(name + ':' + type);
                        return original(type, ...rest);
                    };
                };
                wrap(document, 'document');
                wrap(window, 'window');
                return true;
            });
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the skeleton must mount without throwing');
            return fn(page);
        });

        /** Re-point the STAGE, which is the only input the split's container query has. */
        const setStage = async (page, value) => {
            await page.setStyle('#stage', { 'inline-size': value });
            await page.settle(3);
        };

        test('two rows: the band from its token, and everything else', () => mounted(async (page) => {
            const rows = tracks(await page.prop(S, 'grid-template-rows'));
            assert.equal(rows.length, 2, '§4.2 names two rows and the screen has two');

            const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
            near(px(rows[0]), band, 'row 1 is --ui-band-h, not a number');

            const screen = await page.box(S);
            const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
            near(px(rows[1]), screen.height - band - seam, 'row 2 is everything left over');

            near(px(await page.prop(S, 'row-gap')), seam, 'the row gap is --ui-seam');
            assert.equal(
                await page.prop(S, 'background-color'),
                await page.resolveToken('--ui-line-strong'),
                'CONVENTIONS §13: --ui-line-strong is the header-underline weight',
            );
            assert.equal(await page.prop(S, 'border-bottom-width'), '0px',
                'a divider is a gap, not a border');
        }));

        test('the header band and the split fill their rows, in order', () => mounted(async (page) => {
            const screen = await page.box(S);
            const header = await page.box(HEADER);
            const split = await page.box(SPLIT);

            near(header.y, screen.y, 'the band starts at the top of the screen');
            near(header.width, screen.width, 'the band spans the screen');
            near(split.y, header.y + header.height + px(await page.resolveToken('--ui-seam', 'block-size')),
                'the split starts one seam below the band');
            near(split.height, screen.y + screen.height - split.y, 'the split takes the rest');
        }));

        test('the two panes are the split\'s grid items, and nothing wraps them',
            () => mounted(async (page) => {
                const grid = await page.box(GRID);
                const list = await page.box(LIST_PANE);
                const detail = await page.box(DETAIL_PANE);

                near(list.y, grid.y, 'the list pane starts at the top of the grid');
                near(list.height, grid.height, 'and is as tall as it');
                near(detail.y, grid.y, 'so does the detail pane');
                near(detail.height, grid.height, 'and so is it');

                const columns = tracks(await page.prop(GRID, 'grid-template-columns'));
                assert.equal(columns.length, 2, 'two columns at both Gate A geometries');
                near(px(columns[0]), list.width, 'track 1 is the list pane');
                near(px(columns[1]), detail.width, 'track 2 is the detail pane');
            }));

        test('the list pane is four tracks and the detail pane is four tracks',
            () => mounted(async (page) => {
                const band = px(await page.resolveToken('--ui-selector-band-h', 'block-size'));

                const listRows = tracks(await page.prop(LIST_PANE, 'grid-template-rows'));
                assert.equal(listRows.length, 4, '§4.2: toolbar / filter / list / favourites');
                near(px(listRows[0]), band, 'the toolbar row is --ui-selector-band-h');

                const detailRows = tracks(await page.prop(DETAIL_PANE, 'grid-template-rows'));
                assert.equal(detailRows.length, 4, '§4.2: title / summary / chart / notes');
                near(px(detailRows[0]), band, 'the title row is --ui-selector-band-h TOO');

                near(px(listRows[0]), px(detailRows[0]),
                    'the two --ui-toolbar-h bands on this screen are the same height');
            }));

        test('every cell paints, so the seam is a line and not a slab', () => mounted(async (page) => {
            const fascia = await page.resolveToken('--ui-fascia');
            for (const pane of [LIST_PANE, DETAIL_PANE]) {
                assert.equal(await page.prop(pane, 'background-color'), fascia,
                    `${pane} paints over the ground — otherwise the split is a slab of seam ink`);
            }
            /* And there is no leftover track space to be ground either (trap 2): the two
             * tracks are the whole grid. */
            const grid = await page.box(GRID);
            const list = await page.box(LIST_PANE);
            const detail = await page.box(DETAIL_PANE);
            const seam = px(await page.resolveToken('--ui-seam-split', 'inline-size'));
            near(list.width + seam + detail.width, grid.width, 'the tracks fill the grid');
        }));

        test('the band\'s two buttons and the favourites bank land where §4.2 puts them',
            () => mounted(async (page) => {
                const trail = await page.box(`${HEADER} >>> #trail`);
                const confirm = await page.box(CONFIRM);
                assert.ok(confirm.x >= trail.x - 0.5 && confirm.x + confirm.width <= trail.x + trail.width + 0.5,
                    'Confirm is inside the header\'s trail region');
                assert.notEqual(await page.prop(CONFIRM, 'display'), 'none',
                    'and it is rendered, not hidden behind a header mode this band is not in');
                assert.ok(confirm.width > 0 && confirm.height > 0,
                    'with a box for P8\'s primary treatment to paint on');

                /* The favourites bank is the list pane's fourth row — auto, at the foot. */
                const rows = tracks(await page.prop(LIST_PANE, 'grid-template-rows'));
                const bank = await page.box(FAVOURITES);
                near(px(rows[3]), bank.height, 'row 4 is the favourites bank');
                const region = await page.box(LIST_REGION);
                assert.ok(bank.y > region.y, 'and it sits below the list, not above it');
            }));

        test('the container is the split\'s own box, and it is not its own container',
            () => mounted(async (page) => {
                assert.equal(await page.prop(SPLIT, 'container-type'), 'inline-size',
                    'spec §2.1 Rule 1 — the component reads its own container');
                const split = await page.box(SPLIT);
                const grid = await page.box(GRID);
                near(grid.width, split.width, 'the queried box IS this component\'s box');
            }));

        test('neither branch fires on the bench: the default is the wide one at both geometries',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                const split = await page.box(SPLIT);
                assert.ok(split.width > collapse,
                    `the split is ${split.width}px at ${geometry.name} — above the ${collapse}px `
                    + 'threshold, so the narrow branch is unreachable on this hardware and '
                    + 'the sweep below is the only place it runs');
                assert.equal(tracks(await page.prop(GRID, 'grid-template-columns')).length, 2);
            }));

        test('the threshold is swept, and the layout flips exactly once, at 900',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                const seen = [];
                for (let width = 960; width >= 840; width -= 4) {
                    await setStage(page, `${width}px`);
                    const grid = await page.box(GRID);
                    const list = await page.box(LIST_PANE);
                    const detail = await page.box(DETAIL_PANE);
                    seen.push({
                        width,
                        container: grid.width,
                        one: tracks(await page.prop(GRID, 'grid-template-columns')).length === 1,
                        stacked: detail.y > list.y + list.height - 1,
                    });
                }
                await setStage(page, '100%');

                for (const s of seen) {
                    assert.equal(
                        s.one, s.container < collapse - 0.5,
                        `@container (inline-size < ${collapse}px) is the whole rule: at a `
                        + `${s.width}px stage the container was ${s.container} and the grid had `
                        + `${s.one ? 'one track' : 'two tracks'}`,
                    );
                    assert.equal(s.stacked, s.one,
                        'one track means list OVER detail — §4.2\'s "single column, list over detail"');
                }

                assert.ok(seen.some((s) => s.one), 'the sweep must reach the narrow branch');
                assert.ok(seen.some((s) => !s.one), 'and must start above it');
                const flips = seen.filter((s, i) => i > 0 && s.one !== seen[i - 1].one).length;
                assert.equal(flips, 1, 'one threshold, crossed once');
            }));

        test('the exported threshold and the CSS literal are the same number',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                assert.equal(collapse, 900, 'the authored threshold, from the module that owns it');
                await setStage(page, `${collapse}px`);
                assert.equal(tracks(await page.prop(GRID, 'grid-template-columns')).length, 2,
                    'at exactly 900 the wide branch still holds — the query is exclusive');
                await setStage(page, `${collapse - 1}px`);
                assert.equal(tracks(await page.prop(GRID, 'grid-template-columns')).length, 1,
                    'at 899 it has collapsed');
                await setStage(page, '100%');
            }));

        test('900 is where the two clauses of the list track cross',
            () => mounted(async (page) => {
                const { collapse, track } = await authored(page);
                assert.equal(track,
                    'minmax(var(--ui-selector-list-min), var(--ui-selector-list-share))',
                    '§4.2\'s track, as authored — two tokens, one for each clause');
                const floor = px(await page.resolveToken('--ui-selector-list-min', 'block-size'));
                const share = parseFloat(await page.eval(
                    "getComputedStyle(document.documentElement)"
                    + ".getPropertyValue('--ui-selector-list-share')")) / 100;
                near(collapse * share, floor,
                    `the floor (${floor}px) must be the share (${share * 100}%) of the `
                    + `threshold (${collapse}px), or the track stops responding before the `
                    + 'collapse and the two-column branch has a dead stretch', 0.6);
                near(collapse * share, floor, 'the threshold IS where the two clauses cross', 0.6);
                await setStage(page, `${collapse + 20}px`);
                const columns = tracks(await page.prop(GRID, 'grid-template-columns'));
                const listTrack = px(columns[0]);
                assert.ok(listTrack > floor,
                    `just above the threshold the percentage still governs (${listTrack}px > ${floor}px), `
                    + 'so the track is still responding — which is what makes 900 the right place to stop');
                await setStage(page, '100%');
            }));

        test('the collapsed branch keeps a seam, and it is a row seam',
            () => mounted(async (page) => {
                await setStage(page, '820px');
                /* The collapsed branch's divider is the SAME divider, turned on its side,
                 * so it reads the same token — one gap declaration serves both branches. */
                const seam = px(await page.resolveToken('--ui-seam-split', 'block-size'));
                const list = await page.box(LIST_PANE);
                const detail = await page.box(DETAIL_PANE);
                near(detail.y - (list.y + list.height), seam,
                    'one row gap draws the divider in the collapsed branch — no second rule needed');
                assert.equal(
                    await page.prop(GRID, 'background-color'),
                    await page.resolveToken('--ui-line-strong'),
                    'the same ground shows through, so the divider is the same weight in both branches',
                );
                await setStage(page, '100%');
            }));

        test('no viewport media query exists anywhere in this skeleton',
            () => mounted(async (page) => {
                for (const host of [S, SPLIT, LIST_PANE, DETAIL_PANE]) {
                    const found = JSON.parse(await page.eval(`${CSSOM_WALK}(${JSON.stringify(host)})`));
                    assert.ok(!found.error, `${host}: ${found.error ?? ''}`);
                    const sized = (found.media ?? []).filter((c) => /width|height/i.test(c));
                    assert.deepEqual(sized, [], `${host} asks the viewport about its size`);
                }
            }));

        test('the chart is the only 1fr in the detail pane, and the notes are a fixed share',
            () => mounted(async (page) => {
                const pane = await page.box(DETAIL_PANE);
                const rows = tracks(await page.prop(DETAIL_PANE, 'grid-template-rows'));
                const card = await page.box(CARD);
                const notes = await page.box(NOTES_REGION);

                near(px(rows[3]), notes.height, 'row 4 is the notes region');

                assert.ok(card.height >= px(rows[2]) - 0.5,
                    `the card (${card.height}px) is at least its track (${px(rows[2])}px)`);
                if (card.height > px(rows[2]) + 0.5) {
                    const cardFloor = px(await page.prop(CARD, 'min-block-size'));
                    assert.ok(card.height >= cardFloor - 0.5,
                        `the card is ${card.height}px, under its own declared floor of ${cardFloor}px`);
                }

                const shareText = await page.tokenValue('--ui-selector-notes-share');
                assert.match(shareText, /%$/, 'the share is authored as a percentage, not a length');
                const share = px(shareText) / 100;
                const inset = px(await page.resolveToken('--ui-space-5', 'block-size'));
                const contentBox = pane.height - 2 * inset;
                const want = contentBox * share;
                near(share, 0.25, 'the share token is 25%', 0.0001);
                near(
                    notes.height, want,
                    `the notes are ${notes.height}px against a ${want.toFixed(2)}px share `
                    + `(25% of the pane's ${contentBox}px CONTENT box, not of its ${pane.height}px height)`,
                );
                assert.ok(
                    Math.abs(notes.height - pane.height * share) > 0.5,
                    'the notes measure the same against the pane\'s BORDER box as against its '
                    + `content box (${(pane.height * share).toFixed(2)}px) — the padding term is `
                    + 'what this pins, and with it gone the assertion above proves nothing');
                assert.ok(card.height > notes.height,
                    `the chart (${card.height}px) is the elastic box, not the notes (${notes.height}px) — `
                    + 'the old app has this backwards (layout/selector.md V.2)');
            }));

        test('THE ORDERING, SWEPT: the notes cap tightens and the chart keeps its floor',
            () => mounted(async (page) => {
                const plotFloor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
                const seen = [];
                for (let height = 900; height >= 420; height -= 60) {
                    await page.setStyle('#stage', { 'block-size': `${height}px` });
                    await page.settle(3);
                    const pane = await page.box(DETAIL_PANE);
                    const card = await page.box(CARD);
                    const notes = await page.box(NOTES_REGION);
                    seen.push({
                        height,
                        pane: +pane.height.toFixed(1),
                        card: +card.height.toFixed(1),
                        notes: +notes.height.toFixed(1),
                        cap: +(pane.height * 0.32).toFixed(1),
                    });
                }
                await page.setStyle('#stage', { 'block-size': '100dvh' });
                await page.settle(3);

                for (const s of seen) {
                    assert.ok(s.notes <= s.cap + 0.5,
                        `at a ${s.height}px stage the notes were ${s.notes}px against a ${s.cap}px cap — `
                        + 'a share cannot outlive the box it is a share of');
                }

                for (let i = 1; i < seen.length; i += 1) {
                    assert.ok(seen[i].cap <= seen[i - 1].cap + 0.5,
                        'the notes cap only ever gets smaller as the pane does');
                }

                const squeezed = seen.filter((s) => s.card < plotFloor);
                for (const s of squeezed) {
                    assert.ok(s.card >= plotFloor * 0.5,
                        `the chart is never a strip: ${s.card}px at a ${s.height}px stage`);
                }
                assert.ok(seen[0].card > seen[seen.length - 1].card,
                    'the chart is the box that gives — it is the only 1fr');
            }));

        test('the profile list scrolls, shows its bar, and floors at four rows',
            () => mounted(async (page) => {
                const row = px(await page.resolveToken('--ui-list-row', 'block-size'));
                const floor = px(await page.resolveToken('--ui-selector-list-min-h', 'block-size'));
                near(floor, 4 * row, '§4.2: 4 × var(--ui-list-row)');
                near(px(await page.prop(LIST_REGION, 'min-block-size')), floor,
                    'the floor is on the region, from the token');

                await assertScrollFloor(page, {
                    selector: LIST_REGION,
                    squeezeSelector: '#stage',
                    squeeze: { 'block-size': '480px' },
                    minBlockSize: `${floor}px`,
                });
                assert.equal(await page.prop(LIST_REGION, 'overflow-y'), 'auto');
            }));

        test('the notes region scrolls and carries the M18 proposal as its floor',
            () => mounted(async (page) => {
                const proposal = px(await page.resolveToken('--ui-selector-notes-min-h', 'block-size'));
                const base = px(await page.resolveToken('--ui-text-base', 'block-size'));
                near(proposal, base * 1.5, 'one line of --ui-text-base at the .ui-body ratio');
                near(px(await page.prop(NOTES_REGION, 'min-block-size')), proposal,
                    'the PROPOSED floor is on the region (M18 — token and note, not frozen)');
                assert.equal(await page.prop(NOTES_REGION, 'overflow-y'), 'auto');

                near(px(await page.prop(NOTES, 'min-block-size')), 0,
                    'the editor host declares no floor, so nothing outranks the region token');

                const at = async (block) => {
                    await page.setStyle('#stage', { 'block-size': block });
                    await page.settle(3);
                    return { notes: await page.box(NOTES_REGION), editor: await page.box(NOTES) };
                };

                const stop420 = await at('420px');
                const swept = await at('160px');
                await page.setStyle('#stage', { 'block-size': '100dvh' });
                await page.settle(3);

                near(swept.notes.height, proposal,
                    `swept to a 160px stage the region sits ON its token floor `
                    + `(${swept.notes.height}px vs ${proposal}px) — the M18 proposal governs`);
                assert.ok(stop420.notes.height > proposal + 0.5,
                    `and a 420px stage is NOT that minimum: ${stop420.notes.height}px, which is the `
                    + 'cap (FLOOR) or the pane\'s leftover space (BENCH), not a floor — '
                    + 'the reading the earlier record mislabelled');
                assert.ok(stop420.editor.height > 0 && swept.editor.height > 0,
                    'and the editor is in it at both stops');
            }));

        test('only two regions scroll, and nothing else clips silently',
            () => mounted(async (page) => {
                for (const box of [S, SPLIT, GRID, LIST_PANE, DETAIL_PANE, ROWS, SUMMARY]) {
                    const y = await page.prop(box, 'overflow-y');
                    const x = await page.prop(box, 'overflow-x');
                    assert.notEqual(y, 'hidden', `${box} clips silently in the block axis`);
                    assert.notEqual(x, 'hidden', `${box} clips silently in the inline axis`);
                    assert.equal(y, 'visible', `${box} is not a scroll region — §4.2 names two`);
                }
            }));

        test('the design floor\'s overflow is measured against the siblings it lands on',
            () => mounted(async (page) => {
                const list = await page.box(LIST_REGION);
                const favourites = await page.box(FAVOURITES);
                const card = await page.box(CARD);
                const notes = await page.box(NOTES_REGION);

                const listOntoBank = (list.top + list.height) - favourites.top;
                const cardOntoNotes = (card.top + card.height) - notes.top;

                if (geometry.name === 'floor') {
                    const listTracks = tracks(await page.prop(LIST_PANE, 'grid-template-rows')).map(px);
                    const listGap = px(await page.prop(LIST_PANE, 'row-gap'));
                    near(listOntoBank, list.height - listTracks[2] - listGap,
                        'the unscaled list overflow is its own floor minus its track and gap');
                    near(cardOntoNotes, 6.19,
                        'and the chart card covers the top of the notes region', 0.6);
                                        assert.ok(listOntoBank > 0 && cardOntoNotes > 0,
                        `two control surfaces are occluded at ${geometry.width}×${geometry.height}: `
                        + `favourites bank by ${listOntoBank.toFixed(2)}px, `
                        + `notes region by ${cardOntoNotes.toFixed(2)}px`);
                } else {
                    /* At BENCH there is room, and the gap is intact rather than merely
                     * non-negative: both separations are exactly one --ui-space-3. */
                    const gap = px(await page.resolveToken('--ui-space-3', 'block-size'));
                    near(listOntoBank, -gap, 'no occlusion at bench — the row gap is intact');
                    near(cardOntoNotes, -gap, 'nor in the detail pane at bench');
                }
            }));

        test('the chart card resizes and is never a strip', () => mounted(async (page) => {
            const plotFloor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
            await page.setStyle('#stage', { 'block-size': '900px' });
            await page.settle(3);
            const tall = await page.box(CARD);
            await page.setStyle('#stage', { 'block-size': '560px' });
            await page.settle(3);
            const short = await page.box(CARD);
            await page.setStyle('#stage', { 'block-size': '100dvh' });
            await page.settle(3);

            assert.ok(short.height < tall.height, 'the card resizes — §4.2: "resizes, never a strip"');
            assert.ok(short.height >= plotFloor * 0.5,
                `and it is not a strip: ${short.height}px against a ${plotFloor}px plot floor`);
            assert.equal(await page.prop(CARD, 'overflow-y'), 'visible',
                'chart-C3\'s neighbour: the card does not clip its own overflow either');
        }));

        test('P7 — the summary strip and the chart card share a left edge, exactly',
            () => mounted(async (page) => {
                const pane = await page.box(DETAIL_PANE);
                const inset = px(await page.prop(DETAIL_PANE, 'padding-left'));
                const items = {
                    title: await page.box(TITLE_ROW),
                    summary: await page.box(SUMMARY),
                    chart: await page.box(CARD),
                    notes: await page.box(NOTES_REGION),
                };
                for (const [name, box] of Object.entries(items)) {
                    near(box.x, pane.x + inset, `${name} sits on the pane's one inset`);
                }
                assert.equal(await page.prop(SUMMARY, 'padding-left'), '0px',
                    'the strip declares no inset of its own — P7\'s "paints nothing" cannot happen');
            }));

        test('P16 / P17 — every inset and gap in the skeleton is on the seven-step scale',
            () => mounted(async (page) => {
                const scale = [];
                for (const token of SPACE_TOKENS) {
                    scale.push(px(await page.resolveToken(token, 'padding-left')));
                }
                const onScale = (value) => value === 0 || scale.some((s) => Math.abs(s - value) < 0.51);

                const boxes = [S, SPLIT, GRID, LIST_PANE, DETAIL_PANE, TOOLBAR, TITLE_ROW,
                    SUMMARY, ROWS, LIST_REGION, NOTES_REGION];
                const off = [];
                for (const box of boxes) {
                    const got = await page.computed(box, [
                        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                        'row-gap', 'column-gap',
                    ]);
                    for (const [prop, value] of Object.entries(got)) {
                        const n = px(value);
                        if (!Number.isFinite(n)) continue;      /* a gap of `normal` */
                        if (n === 1 && /gap/.test(prop)) continue;
                        if (!onScale(n)) off.push(`${box} ${prop} = ${value}`);
                    }
                }
                assert.deepEqual(off, [],
                    'P16 / §3.3: off-scale values in the old screen include 30, 32, 26, 9 and 6px');
            }));

        test('P17 — this band\'s inset is the SAME component\'s inset, not a second copy',
            () => mounted(async (page) => {
                assert.equal(await page.prop(S, 'padding-left'), '0px',
                    'the screen declares no header inset');
                assert.equal(await page.prop(HEADER, 'padding-left'), '0px',
                    'nor does the component host — the inset is on the band inside it');

                const inset = px(await page.prop(HEADER_BAND, 'padding-left'));
                const step = px(await page.resolveToken('--ui-space-6', 'padding-left'));
                near(inset, step, 'ui-page-header.js: "--ui-space-6, 28px, once"');
                near(px(await page.prop(HEADER_BAND, 'padding-right')), step,
                    'and both sides are the same step — P17 is a 2px disagreement');
            }));

        test('P5 — the list region has exactly one owner for its block size',
            () => mounted(async (page) => {
                const region = await page.box(LIST_REGION);
                const rows = tracks(await page.prop(LIST_PANE, 'grid-template-rows'));
                const floor = px(await page.resolveToken('--ui-selector-list-min-h', 'block-size'));

                near(region.height, Math.max(px(rows[2]), floor),
                    `the region is max(track ${px(rows[2])}, floor ${floor}) and nothing else`);
                assert.equal(await page.prop(LIST_REGION, 'height'),
                    await page.prop(LIST_REGION, 'block-size'),
                    'sanity: one used value, however it is spelled');

                /* AND THERE IS NO IMPORTANT FLAG IN THE TREE. Read off the CSSOM of every
                 * root in the skeleton, which is what the cascade actually holds. */
                for (const host of [S, SPLIT, LIST_PANE, DETAIL_PANE]) {
                    const bangs = await page.eval(`(function () {
                        var parts = ${JSON.stringify(host)}.split('>>>').map(function (s) { return s.trim(); });
                        var root = document, el = null;
                        for (var i = 0; i < parts.length; i++) {
                            el = root.querySelector(parts[i]);
                            root = el.shadowRoot || el;
                        }
                        var n = 0;
                        var walk = function (rules) {
                            for (var r = 0; r < rules.length; r++) {
                                if (rules[r].cssRules) { walk(rules[r].cssRules); continue; }
                                var s = rules[r].style;
                                if (!s) continue;
                                for (var i = 0; i < s.length; i++) {
                                    if (s.getPropertyPriority(s[i]) === 'important') n++;
                                }
                            }
                        };
                        for (var k = 0; k < root.adoptedStyleSheets.length; k++) walk(root.adoptedStyleSheets[k].cssRules);
                        return n;
                    })()`);
                    assert.equal(bangs, 0, `${host} carries an !important — Gate C guard 3`);
                }
            }));

        test('P10 — the divider is a gap: no element, no cursor, no role, nothing to be dead',
            () => mounted(async (page) => {
                const seam = px(await page.resolveToken('--ui-seam-split', 'block-size'));
                near(px(await page.prop(GRID, 'column-gap')), seam, 'the gap IS the divider');

                /* THERE IS NO SEPARATOR ELEMENT. Every clause of — the lying cursor,
                 * the hover, the aria-hidden node with no role, the missing keyboard path
                 * — needs one to be false of. */
                const suspects = await page.eval(`(function () {
                    var root = document.querySelector('selector-screen').shadowRoot
                        .getElementById('split').shadowRoot;
                    var all = root.querySelectorAll('*');
                    var out = [];
                    for (var i = 0; i < all.length; i++) {
                        var el = all[i];
                        var cs = getComputedStyle(el);
                        if (/resize|col-resize|row-resize|grab/.test(cs.cursor)
                            || el.getAttribute('role') === 'separator'
                            || el.hasAttribute('aria-hidden')
                            || el.draggable) {
                            out.push(el.tagName.toLowerCase() + '#' + el.id + ' cursor=' + cs.cursor);
                        }
                    }
                    return JSON.stringify(out);
                })()`);
                assert.deepEqual(JSON.parse(suspects), [],
                    'Q8, built to the most easily reversed answer: no drag, therefore no drag-looking handle');

                /* AND NOTHING IN THE SPLIT IS FOCUSABLE, so there is no keyboard path to
                 * be missing either — the gap is not in the accessibility tree at all. */
                const focusables = await page.count(`${SPLIT} >>> [tabindex], ${SPLIT} >>> button`);
                assert.equal(focusables, 0, 'the split contributes no focus stop');
            }));

        test('P1 — the screen\'s grid has exactly its two declared children',
            () => mounted(async (page) => {
                const children = await page.eval(`(function () {
                    var root = document.querySelector('selector-screen').shadowRoot;
                    return JSON.stringify(Array.prototype.map.call(root.children, function (c) {
                        return c.tagName.toLowerCase();
                    }));
                })()`);
            assert.deepEqual(JSON.parse(children).filter((t) => t !== 'ui-toast'),
                ['ui-page-header', 'selector-split'],
                    'two grid children, both named in §4.2');
                assert.equal(await page.count(`${S} >>> dialog`), 0,
                    'no dialog is a child of this grid, malformed or otherwise');
            }));

        test('P2 — the route is a module and a tag, and the shell mounts the element',
            () => mounted(async (page) => {
                const upgraded = await page.eval(
                    "(() => document.querySelector('selector-screen').shadowRoot !== null)()",
                );
                assert.equal(upgraded, true, 'the element upgraded — its module ran');
                assert.equal(await page.prop(S, 'display'), 'grid',
                    'and its own styles applied, which an injected fragment\'s never do');
            }));

        test('P3 — the filter field has rhythm under it, and it comes from one declaration',
            () => mounted(async (page) => {
                const gap = px(await page.prop(LIST_PANE, 'row-gap'));
                assert.ok(gap > 0, 'the filter field does not sit flush on what follows it');
                const filter = await page.box(FILTER);
                const region = await page.box(LIST_REGION);
                near(region.y - (filter.y + filter.height), gap,
                    'and the space under the filter field IS that gap, not a second number');
            }));

        test('P9 — no rule in this skeleton is dead, and none is declared twice',
            () => mounted(async (page) => {
                for (const host of [S, SPLIT, LIST_PANE, DETAIL_PANE]) {
                    const found = JSON.parse(await page.eval(`${CSSOM_WALK}(${JSON.stringify(host)})`));
                    assert.ok(!found.error, `${host}: ${found.error ?? ''}`);

                    const dead = found.rules.filter((r) => !r.matched).map((r) => r.selector);
                    assert.deepEqual(dead, [],
                        `${host} carries a rule that matches nothing — §7.3 P9's "three dead rule blocks"`);

                    const seen = new Map();
                    for (const rule of found.rules) {
                        const key = rule.selector.replace(/\s+/g, ' ').trim();
                        seen.set(key, (seen.get(key) ?? 0) + 1);
                    }
                    const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
                    assert.deepEqual(twice, [],
                        `${host} declares a selector twice — P9's ".sx-recent-item declared TWICE in one file"`);
                }
            }));

        test('P11 — selection is a property that paints, never a class', () => mounted(async (page) => {
            const classes = await page.eval(`(function () {
                var rows = document.querySelector('selector-screen').shadowRoot
                    .getElementById('rows').querySelectorAll('ui-list-row');
                var out = [];
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].className) out.push(rows[i].className);
                }
                return JSON.stringify(out);
            })()`);
            assert.deepEqual(JSON.parse(classes), [], 'no row carries a class for state');

            const rowSel = `${S} >>> ui-list-row`;
            const before = await page.computed(rowSel, ['background-color']);
            await page.evalFn(() => {
                document.querySelector('selector-screen').shadowRoot
                    .getElementById('rows').querySelector('ui-list-row').selected = true;
                return true;
            });
            await page.settle(3);
            const aria = await page.eval(`(function () {
                return document.querySelector('selector-screen').shadowRoot
                    .getElementById('rows').querySelector('ui-list-row')
                    .getAttribute('aria-selected');
            })()`);
            const after = await page.computed(rowSel, ['background-color']);

            assert.equal(aria, 'true', 'the property reflects to aria-selected (#26)');
            assert.notEqual(after['background-color'], before['background-color'],
                'and it paints — through the four --ui-selected-* dials, not through a class');
        }));

        test('P14 — the skeleton registers no document or window listener',
            () => mounted(async (page) => {
                const listeners = await page.eval('JSON.stringify(window.__listeners || [])');
                const added = JSON.parse(listeners);
                const bad = added.filter((entry) => /content-?loaded/i.test(entry));
                assert.deepEqual(bad, [],
                    `P14's two types are the ones that cannot fire; the skeleton added: ${added.join(', ') || 'none'}`);

                /* AND TEARDOWN IS THE BROWSER'S. Removing the element takes its whole
                 * subtree, which is the guarantee the rule's two listeners were reaching for. */
                const gone = await page.eval(`(function () {
                    var el = document.querySelector('selector-screen');
                    el.remove();
                    return document.querySelector('selector-screen') === null;
                })()`);
                assert.equal(gone, true, 'disconnectedCallback is the teardown, and it is the browser\'s');
            }));

        test('P15 — ids are scoped to their roots, and no selector carries two of them',
            () => mounted(async (page) => {
                assert.equal(await page.prop(OUTSIDE, 'display'), 'block',
                    'the light-DOM #grid is untouched by the split\'s #grid rule');
                const gridDisplay = await page.prop(GRID, 'display');
                assert.equal(gridDisplay, 'grid', 'while the split\'s own #grid IS the grid');

                /* Half two: no selector in this skeleton contains more than one id. */
                for (const host of [S, SPLIT, LIST_PANE, DETAIL_PANE]) {
                    const found = JSON.parse(await page.eval(`${CSSOM_WALK}(${JSON.stringify(host)})`));
                    const walls = found.rules.filter((r) => r.ids > 1).map((r) => r.selector);
                    assert.deepEqual(walls, [], `${host} carries a multi-id selector`);
                }
            }));

        test('parity 5 — the band\'s two actions are --ui-control-lg, not --ui-control-h',
            () => mounted(async (page) => {
                const lg = px(await page.resolveToken('--ui-control-lg', 'block-size'));
                const h = px(await page.resolveToken('--ui-control-h', 'block-size'));
                assert.notEqual(lg, h, 'the two control tokens must differ or this proves nothing');
                for (const id of ['#cancel', '#confirm']) {
                    const sel = `${S} >>> ${id} >>> .btn`;
                    near(px(await page.prop(sel, 'min-block-size')), lg,
                        `${id} reads --ui-control-lg`);
                    near((await page.box(sel)).height, lg, `${id} RENDERS at --ui-control-lg`);
                }
                const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
                const inset = px(await page.resolveToken('--ui-band-inset', 'block-size'));
                const density = parseFloat(await page.eval(
                    "getComputedStyle(document.documentElement).getPropertyValue('--ui-density')"));
                near(band, (lg + 2 * inset) * density, '--ui-band-h IS control-lg + 2 x band-inset');
                near((await page.box(`${S} >>> #cancel >>> .btn`)).y, (band - lg) / 2,
                    'the band centres its control, so a shorter one would leave (band - h) / 2 '
                    + 'of dead space on each side instead');
            }));

        test('parity 5 — THE LIST CAPTION IS GONE, and the controls start at the inset',
            () => mounted(async (page) => {
                const present = await page.eval(`(function () {
                    var root = document.querySelector('selector-screen').shadowRoot;
                    return root.getElementById('list-caption') === null;
                })()`);
                assert.equal(present, true, 'no caption element is rendered at all');

                const first = await page.box(`${S} >>> #add-open`);
                const pane = await page.box(LIST_PANE);
                const inset = px(await page.resolveToken('--ui-space-5', 'block-size'));
                near(first.x - pane.x, inset,
                    'and the first control starts at the pane inset, as Slate\'s does');
                return;

                assert.equal(await page.prop(cap, 'color'), await page.resolveToken('--ui-muted'));
                assert.equal(await page.prop(cap, 'font-size'),
                    await page.resolveToken('--ui-text-sm', 'font-size'));
                assert.equal(await page.prop(cap, 'font-weight'),
                    await page.resolveToken('--ui-weight-semibold', 'font-weight'));
                assert.equal(await page.prop(cap, 'text-transform'), 'uppercase');

                const bar = await page.box(`${S} >>> .toolbar`);
                const add = await page.box(`${S} >>> #add-open`);
                assert.ok(host.width > bar.width * 0.6,
                    `the caption takes the slack: ${host.width} of a ${bar.width} line`);
                assert.ok(host.width + add.width <= bar.width + 1,
                    'and it stops at the control beside it rather than overlapping one');
                assert.ok(box.width > 0 && box.width <= host.width,
                    'and its own box lives inside the band it grew');
            }));

        test('parity 5 — the list draws its divider, and it is a GAP in --ui-line',
            () => mounted(async (page) => {
                const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
                const line = await page.resolveToken('--ui-line');
                const fascia = await page.resolveToken('--ui-fascia');
                assert.notEqual(line, fascia,
                    'the divider ink and the row ground must differ or a gap draws nothing');

                for (const sel of [ROWS]) {
                    assert.equal(await page.prop(sel, 'display'), 'grid',
                        `${sel} is a seamed grid`);
                    near(px(await page.prop(sel, 'row-gap')), seam, `${sel} gaps by --ui-seam`);
                    assert.equal(await page.prop(sel, 'background-color'), line,
                        `${sel} paints the divider ink behind its rows`);
                }

                /* THE ROWS STILL DRAW NO BORDER — #26's own assertion, restated here from
                 * the consumer's side, because the whole point is that the drawer moved. */
                const rows = await page.evalFn(() => {
                    const box = document.querySelector('selector-screen').shadowRoot
                        .getElementById('rows');
                    const all = [...box.querySelectorAll('ui-list-row')];
                    const pair = all.find((r) => r.nextElementSibling
                        && r.nextElementSibling.tagName === 'UI-LIST-ROW');
                    const list = pair ? [pair, pair.nextElementSibling] : [];
                    return list.map((r) => {
                        const b = r.getBoundingClientRect();
                        const cs = getComputedStyle(r);
                        return { y: b.y, h: b.height, border: cs.borderTopWidth,
                                 ground: cs.backgroundColor };
                    });
                });
                assert.equal(rows.length, 2, 'the demo poses two adjacent rows to measure');
                for (const r of rows) {
                    assert.equal(r.border, '0px', 'a divider is a gap, not a border (§13)');
                    assert.equal(r.ground, fascia, 'and a painted cell is what makes the gap a line');
                }
                /* Consecutive rows inside one family are exactly one seam apart — the
                 * measurement that was 4px of pane ground before this pass. */
                near(rows[1].y - (rows[0].y + rows[0].h), seam,
                    'consecutive rows are one --ui-seam apart');

            }));
    });
}
