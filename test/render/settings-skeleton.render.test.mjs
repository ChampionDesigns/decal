/**
 *.4, the skeleton-and-navigation cluster: settings-shell-skeleton, nav-columns-shared-pitch, c4-derived-nav-row-pitch, c5-single-gap-divider, leaf-pane-one-measure, settings-search, scroll-regions-floors.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertScrollFloor } from '../harness/assertions.js';

const MODULE = ['/src/screens/settings-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh">'
    + '<settings-screen></settings-screen>'
    + '</div>';

const S = 'settings-screen';
const HEADER = `${S} >>> #band`;
const BODY = `${S} >>> #body`;
const GRID = `${S} >>> #body >>> #grid`;
const CRUMB_BOX = `${S} >>> #body >>> #crumb`;
const CRUMB_UP = `${S} >>> #crumb-up`;
const NAV = `${S} >>> #nav`;
const NAV_LIST = `${S} >>> #nav >>> #list`;
const NAV_ROWS_BOX = `${S} >>> #nav >>> #rows`;
const SUBNAV = `${S} >>> #subnav`;
const SUBNAV_LIST = `${S} >>> #subnav >>> #list`;
const LEAF_PANE = `${S} >>> #leaf-pane`;
const LEAF = `${S} >>> #leaf-pane >>> #leaf`;
const SEARCH = `${S} >>> #search`;
const NAV_ROWS = `${S} >>> #nav ui-nav-row`;
const SUBNAV_ROWS = `${S} >>> #subnav ui-subnav-row`;
const CURRENT_NAV_ROW = `${S} >>> #nav ui-nav-row[current] >>> #row`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const tracks = (value) => String(value).trim().split(/\s+/);
const px = (value) => parseFloat(value);

const authored = async (page) => JSON.parse(await page.eval(
    "import('/src/screens/settings-master-detail.js').then((m) => JSON.stringify("
    + '{ collapse: m.MASTER_DETAIL_COLLAPSE_PX }))',
));

/** Every row's rect in a column, in DOM order. */
const rowRects = (page, selector) => page.evalFn((s) => window.__h.qAll(s).map(function (el) {
    var r = el.getBoundingClientRect();
    return { y: r.y, height: r.height, x: r.x, width: r.width };
}), selector);

/** Every row's visible text, in DOM order — the rendered name, not the model's. */
const rowNames = (page, selector) => page.evalFn(
    (s) => window.__h.qAll(s).map(function (el) { return el.textContent.trim(); }),
    selector,
);

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
    var walk = function (rules, condition) {
        for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.media) media.push(rule.conditionText || rule.media.mediaText);
            if (rule.cssRules) {
                walk(rule.cssRules, condition + '{' + (rule.conditionText || '') + '}');
                continue;
            }
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
            out.push({
                selector: rule.selectorText, matched: matched, ids: maxIds,
                condition: condition,
            });
        }
    };
    walk(own.cssRules, '');
    return JSON.stringify({ rules: out, media: media, sheets: sheets.length });
})`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`settings skeleton @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(6);
            assert.deepEqual(page.pageErrors, [], 'the skeleton must mount without throwing');
            return fn(page);
        });

        /** Re-point the STAGE, which is the only input the body's container query has. */
        const setStage = async (page, value) => {
            await page.setStyle('#stage', { 'inline-size': value });
            await page.settle(3);
        };

        /** Both nav columns are only on screen together in the wide branch. */
        const widen = (page) => setStage(page, '1200px');

        test('two rows: the band from its token, and everything else', () => mounted(async (page) => {
            const rows = tracks(await page.prop(S, 'grid-template-rows'));
            assert.equal(rows.length, 2, '§4.4 names two rows and the screen has two');

            const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
            near(px(rows[0]), band, 'row 1 is --ui-band-h, not a number');

            const screen = await page.box(S);
            const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
            near(px(rows[1]), screen.height - band - seam, 'row 2 is everything left over');

            /* The seam between the rows IS the header's underline: ground shows through
             * the gap, so there is no border anywhere. */
            near(px(await page.prop(S, 'row-gap')), seam, 'the row gap is --ui-seam');
            assert.equal(
                await page.prop(S, 'background-color'),
                await page.resolveToken('--ui-line-strong'),
                'CONVENTIONS §13: --ui-line-strong is the header-underline weight',
            );
            assert.equal(await page.prop(S, 'border-bottom-width'), '0px',
                'a divider is a gap, not a border');
        }));

        test('the band and the body fill their rows, in order', () => mounted(async (page) => {
            const screen = await page.box(S);
            const header = await page.box(HEADER);
            const body = await page.box(BODY);
            const seam = px(await page.resolveToken('--ui-seam', 'block-size'));

            near(header.y, screen.y, 'the band starts at the top of the screen');
            near(header.width, screen.width, 'the band spans the screen');
            near(body.y, header.y + header.height + seam, 'the body starts one seam below it');
            near(body.height, screen.y + screen.height - body.y, 'and takes the rest');
        }));

        test('D11: the band is in commit mode and the wording is not this screen\'s',
            () => mounted(async (page) => {
                const commit = `${HEADER} >>> #save`;
                assert.ok(await page.exists(commit), 'the commit cluster is rendered');
                const label = (await page.evalFn(
                    (s) => window.__h.need(s).textContent.trim(), commit,
                ));
                assert.equal(label, 'Save', 'zero changes: Save, with no count beside it');
                assert.equal(await page.count(`${HEADER} >>> #cancel`), 1,
                    'and Cancel beside it — the decided pair');
            }));

        test('Close ASKS THE SHELL and never moves the screen behind the address',
            () => mounted(async (page) => {
                const said = await page.evalFn(async () => {
                    const screen = document.querySelector('settings-screen');
                    const seen = [];
                    const listener = (event) => seen.push({
                        route: event.detail?.route ?? null,
                        composed: event.composed,
                        bubbles: event.bubbles,
                    });
                    document.addEventListener('navigate', listener);

                    const calls = [];
                    screen.boot = { ...(screen.boot ?? {}), goto: (id) => { calls.push(id); } };
                    await screen.updateComplete;

                    const header = screen.shadowRoot.getElementById('band');
                    header.shadowRoot.getElementById('save').click();
                    await new Promise((r) => setTimeout(r, 0));
                    document.removeEventListener('navigate', listener);
                    return { seen, calls, hash: location.hash };
                });

                assert.equal(said.calls.length, 0, 'Close must not move the screen behind the address');
                assert.equal(said.seen.length, 1, 'it asks the shell, once');
                assert.equal(said.seen[0].route, 'live');
                assert.equal(said.seen[0].composed, true, 'or the shell above a shadow root never hears it');
                assert.equal(said.seen[0].bubbles, true);
            }));

            const pressBand = (page, button, { staged = false } = {}) => page.evalFn(async (which, stage) => {
                const screen = document.querySelector('settings-screen');
                const seen = [];
                const listener = (event) => seen.push(event.detail?.route ?? null);
                document.addEventListener('navigate', listener);
                screen.changeCount = stage ? 2 : 0;
                await screen.updateComplete;
                const header = screen.shadowRoot.getElementById('band');
                header.shadowRoot.getElementById(which).click();
                await new Promise((r) => setTimeout(r, 0));
                document.removeEventListener('navigate', listener);
                return seen;
            }, button, staged);

            test('Cancel leaves, with nothing staged and with something staged',
                () => mounted(async (page) => {
                    assert.deepEqual(await pressBand(page, 'cancel'), ['live'],
                        'a Cancel that stays put is a button with no observable effect');
                    assert.deepEqual(await pressBand(page, 'cancel', { staged: true }), ['live'],
                        'and it leaves after throwing the staged changes away');
                }));

            test('Save leaves when there is nothing to save', () => mounted(async (page) => {
                assert.deepEqual(await pressBand(page, 'save'), ['live']);
            }));

        test('the columns are grid gaps, not three flex children plus two 1px divs',
            () => mounted(async (page) => {
                await widen(page);
                const seam = px(await page.resolveToken('--ui-seam', 'inline-size'));
                near(px(await page.prop(GRID, 'column-gap')), seam, 'one gap, one token');
                assert.equal(
                    await page.prop(GRID, 'background-color'),
                    await page.resolveToken('--ui-line-strong'),
                    'one ink showing through it — T19 is two greys',
                );

                /* the rule's arithmetic, the right way round: the seam comes OUT of the grid,
                 * so the tracks plus the gaps are the whole width and no pane measures
                 * 599 because something ate a pixel. */
                const grid = await page.box(GRID);
                const nav = await page.box(NAV);
                const subnav = await page.box(SUBNAV);
                const leaf = await page.box(LEAF_PANE);
                near(nav.width + seam + subnav.width + seam + leaf.width, grid.width,
                    'the tracks and the two gaps fill the grid exactly');
            }));

        test('T4: there is no separator element for a dead drag to live on',
            () => mounted(async (page) => {
                const shape = await page.evalFn((s) => {
                    var root = window.__h.need(s).shadowRoot;
                    var all = Array.from(root.querySelectorAll('*'));
                    return {
                        tags: all.map(function (e) { return e.tagName.toLowerCase(); }),
                        cursors: all.map(function (e) { return getComputedStyle(e).cursor; }),
                        ariaHidden: all.filter(function (e) {
                            return e.hasAttribute('aria-hidden');
                        }).length,
                    };
                }, BODY);
                assert.deepEqual(shape.tags,
                    ['div', 'div', 'slot', 'div', 'slot', 'slot', 'slot', 'slot'],
                    'the grid, the search head and its slot, the crumb box and its slot, and '
                    + 'the three panes — nothing that could be a handle');
                assert.deepEqual(shape.cursors.filter((c) => /resize/.test(c)), [],
                    'T4: "the cursor changes, so it LOOKS live"');
                assert.equal(shape.ariaHidden, 0, 'T4: "two aria-hidden drag handles that respond to pointer input"');
            }));

        test('every cell paints, so the seam is a line and not a slab', () => mounted(async (page) => {
            await widen(page);
            const fascia = await page.resolveToken('--ui-fascia');
            for (const pane of [NAV, SUBNAV, LEAF_PANE]) {
                assert.equal(await page.prop(pane, 'background-color'), fascia,
                    `${pane} paints over the ground — seams.js trap 1`);
            }
            const rows = await page.box(NAV_ROWS_BOX);
            const rects = await rowRects(page, NAV_ROWS);
            const content = (rects[rects.length - 1].y + rects[rects.length - 1].height) - rects[0].y;
            near(rows.height, content, 'the seamed grid is exactly its rows, stretched by nothing');
            /* The region itself paints nothing and shows the column's fascia through:
             * what it must NOT be is the seamed grid, because then the leftover would
             * be divider ink. */
            assert.notEqual(await page.prop(NAV_LIST, 'background-color'),
                await page.resolveToken('--ui-line'),
                'the scroll region is not the seamed grid — seams.js trap 2');
        }));

        test('the container is the body\'s own box, and it is not its own container',
            () => mounted(async (page) => {
                assert.equal(await page.prop(BODY, 'container-type'), 'inline-size',
                    'spec §2.1 Rule 1 — the component reads its own container');
                const body = await page.box(BODY);
                const grid = await page.box(GRID);
                near(grid.width, body.width, 'the queried box IS this component\'s box');
            }));

        test('the branch that fires here is the one the geometry asks for',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                const body = await page.box(BODY);
                const columns = tracks(await page.prop(GRID, 'grid-template-columns'));
                if (body.width >= collapse) {
                    assert.equal(columns.length, 3,
                        `${body.width}px is at or above ${collapse} — three columns`);
                    assert.equal(await page.prop(CRUMB_BOX, 'display'), 'none',
                        'and nothing is collapsed, so there is nowhere to have come from');
                } else {
                    assert.equal(columns.length, 2,
                        `${body.width}px is below ${collapse} — two columns`);
                    assert.notEqual(await page.prop(CRUMB_BOX, 'display'), 'none',
                        '§4.4: nav collapses to one, BREADCRUMBED');
                }
            }));

        test('the threshold is swept, and the layout flips exactly once, at 1100',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                const seen = [];
                for (let width = collapse + 60; width >= collapse - 60; width -= 4) {
                    await setStage(page, `${width}px`);
                    seen.push({
                        width,
                        columns: tracks(await page.prop(GRID, 'grid-template-columns')).length,
                    });
                }
                const flips = seen.filter((row, i) => i > 0 && row.columns !== seen[i - 1].columns);
                assert.equal(flips.length, 1, `the layout flips once, not ${flips.length} times`);

                await setStage(page, `${collapse}px`);
                assert.equal(tracks(await page.prop(GRID, 'grid-template-columns')).length, 3,
                    '< 1100px is exclusive, so 1100 belongs to the wide branch');
                await setStage(page, `${collapse - 1}px`);
                assert.equal(tracks(await page.prop(GRID, 'grid-template-columns')).length, 2,
                    'and 1099 is the collapsed one');
            }));

        test('collapsed, the crumb steps back up and the nav column takes column 1',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                await setStage(page, `${collapse - 1}px`);

                /* Default: the leaves. The nav column has no box at all. */
                assert.equal(await page.count(`${NAV_ROWS}`) > 0, true, 'the rows are rendered');
                const navBox = await page.box(NAV);
                assert.equal(navBox.width, 0, 'but the nav column has no box in the leaves level');
                const subnavBox = await page.box(SUBNAV);
                assert.ok(subnavBox.width > 0, 'and the sub-nav column has column 1');

                const searchBox = await page.box(SEARCH);
                assert.ok(searchBox.width > 0,
                    'the field is the grid\'s own item now, so hiding a column cannot hide it');

                await page.click(CRUMB_UP);
                await page.settle(3);

                const searchAfter = await page.box(SEARCH);
                near(searchAfter.width, searchBox.width,
                    'and it is the same field at the same size at both levels');
                const navAfter = await page.box(NAV);
                const subnavAfter = await page.box(SUBNAV);
                assert.ok(navAfter.width > 0, 'pressing the crumb reveals the categories');
                assert.equal(subnavAfter.width, 0, 'and the leaves give the column back');
                near(navAfter.x, subnavBox.x, 'in the same column, at the same edge');

                const leaf = await page.box(LEAF_PANE);
                const search = await page.box(SEARCH);
                const crumb = await page.box(CRUMB_BOX);
                assert.ok(leaf.y < crumb.y, 'the pane starts above the crumb, not level with it');
                near(leaf.y, search.y - px(await page.resolveToken('--ui-space-3', 'block-size')),
                    'the leaf pane starts where the search row does, allowing the field\'s own margin');
            }));

        test('the collapse is inert in the wide branch — nav-level selects nothing',
            () => mounted(async (page) => {
                await widen(page);
                const before = await page.box(NAV);
                await page.evalFn((s, v) => {
                    window.__h.need(s).setAttribute('nav-level', v);
                }, BODY, 'categories');
                await page.settle(3);
                const after = await page.box(NAV);
                near(after.width, before.width, 'three columns are three columns');
                assert.ok(after.width > 0 && (await page.box(SUBNAV)).width > 0,
                    'both nav columns are on screen whatever the level says');
            }));

        test('the two columns step at the same pitch for seven rows',
            () => mounted(async (page) => {
                /* Both columns are only on screen together in the wide branch, so the
                 * stage is widened at BOTH geometries — this is a claim about the two
                 * columns, not about the window. */
                await widen(page);
                const pitch = px(await page.resolveToken('--ui-nav-row', 'block-size'));

                const nav = await rowRects(page, NAV_ROWS);
                const subnav = await rowRects(page, SUBNAV_ROWS);
                assert.ok(nav.length >= 7, `ten categories, got ${nav.length}`);
                assert.ok(subnav.length >= 7, `the Machine category has seven leaves, got ${subnav.length}`);

                const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
                const steps = (rects) => rects.slice(1, 7).map((r, i) => r.y - rects[i].y);

                const navSteps = steps(nav);
                const subnavSteps = steps(subnav);
                for (let i = 0; i < navSteps.length; i += 1) {
                    near(navSteps[i], pitch + seam, `nav row ${i + 2} sits one pitch below row ${i + 1}`);
                    near(subnavSteps[i], pitch + seam, `sub-nav row ${i + 2} likewise`);
                    near(navSteps[i], subnavSteps[i], 'and the two columns agree at every row');
                }

                const navRun = nav[6].y - nav[0].y;
                const subnavRun = subnav[6].y - subnav[0].y;
                near(navRun, subnavRun,
                    'row 7: the corpus measures 89-pitch against 93-pitch, 24px apart');
                near(navRun, 6 * (pitch + seam), 'and both are six pitches, not a tuned number');
            }));

        test('C4: the pitch is the derived token, and every row is exactly it',
            () => mounted(async (page) => {
                await widen(page);
                const pitch = px(await page.resolveToken('--ui-nav-row', 'block-size'));
                const control = px(await page.resolveToken('--ui-control-h', 'block-size'));
                assert.ok(pitch > control,
                    'C4: --ui-nav-row is derived from --ui-control-h, not pinned at 89');

                for (const rects of [await rowRects(page, NAV_ROWS), await rowRects(page, SUBNAV_ROWS)]) {
                    for (const rect of rects) near(rect.height, pitch, 'every row is one pitch tall');
                }
            }));

        test('T2(b): the sub-nav has separators, and they are the column\'s gaps',
            () => mounted(async (page) => {
                await widen(page);
                const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
                const rows = await rowRects(page, SUBNAV_ROWS);
                for (let i = 1; i < rows.length; i += 1) {
                    near(rows[i].y - (rows[i - 1].y + rows[i - 1].height), seam,
                        `one seam between sub-nav rows ${i} and ${i + 1} — measured box-shadow: none in Slate`);
                }
                assert.equal(
                    await page.prop(`${SUBNAV} >>> #rows`, 'background-color'),
                    await page.resolveToken('--ui-line'),
                    'and the ink showing through is the divider weight',
                );
            }));

        test('T5/T3: the LED is the dial and no outside rule can reach either',
            () => mounted(async (page) => {
                const led = await page.resolveToken('--ui-selected-led', 'block-size');
                const before = await page.computed(CURRENT_NAV_ROW, ['box-shadow', 'border-radius']);
                assert.ok(before['box-shadow'].includes(px(led) + 'px'),
                    `the current row's strip is var(--ui-selected-led) (${led}), got ${before['box-shadow']}`);
                assert.equal(before['border-radius'], '0px', 'T3: rows touch, so the corners are square');

                await page.evalFn(() => {
                    const sheet = document.createElement('style');
                    sheet.textContent = 'html body * , html body ui-nav-row { '
                        + 'border-radius: 6px !important; '
                        + 'box-shadow: inset 0 -4px 0 0 rgb(255, 0, 170) !important; }';
                    document.head.appendChild(sheet);
                });
                await page.settle(3);

                const after = await page.computed(CURRENT_NAV_ROW, ['box-shadow', 'border-radius']);
                assert.deepEqual(after, before,
                    'nothing outside a shadow root can reach in, so there is no fight to lose');
            }));

        test('selection is a property, never a class', () => mounted(async (page) => {
            const state = await page.evalFn((navSel, subSel) => {
                const read = (sel) => window.__h.qAll(sel).map(function (el) {
                    return {
                        cls: el.className,
                        current: el.hasAttribute('current'),
                        aria: el.shadowRoot.getElementById('row').getAttribute('aria-current'),
                    };
                });
                return { nav: read(navSel), subnav: read(subSel) };
            }, NAV_ROWS, SUBNAV_ROWS);

            for (const rows of [state.nav, state.subnav]) {
                assert.deepEqual(rows.map((r) => r.cls).filter(Boolean), [],
                    'T15: "selection is class-only with no aria-current/aria-selected"');
                assert.equal(rows.filter((r) => r.current).length, 1, 'exactly one current row');
                for (const row of rows) {
                    assert.equal(row.aria, row.current ? 'true' : null,
                        'the state IS the aria state');
                }
            }
        }));

        test('the leaf fills the pane between its two insets, whichever leaf it is',
            () => mounted(async (page) => {
                const pane = await page.box(LEAF_PANE);
                const padStart = px(await page.prop(LEAF_PANE, 'padding-left'));
                const padEnd = px(await page.prop(LEAF_PANE, 'padding-right'));
                assert.ok(padStart < padEnd,
                    `O4: the start inset (${padStart}) is the smaller of the two (${padEnd})`);
                const expected = pane.width - padStart - padEnd;

                const widths = [];
                for (const leafId of ['machine-steam', 'machine-machine-info', 'machine-advanced']) {
                    await page.evalFn((s, id) => {
                        window.__h.need(s).setAttribute('leaf-id', id);
                    }, S, leafId);
                    await page.settle(3);

                    const leaf = await page.box(LEAF);
                    widths.push(leaf.width);
                    near(leaf.width, expected, `${leafId}: the pane minus its two insets`);

                    const lead = leaf.x - pane.x;
                    const trail = (pane.x + pane.width) - (leaf.x + leaf.width);
                    near(lead, padStart, `${leafId}: the leading gap is the start inset`);
                    near(trail, padEnd, `${leafId}: the trailing gap is the end inset`);
                }

                assert.equal(new Set(widths.map((w) => w.toFixed(2))).size, 1,
                    'T1/T21: 1200, 885 and 760 are three widths; this is one');
            }));

        test('all three regions scroll, with a visible scrollbar and a floor from a token',
            () => mounted(async (page) => {
                await widen(page);
                const navFloor = await page.resolveToken('--ui-settings-nav-min-h', 'block-size');
                const leafFloor = await page.resolveToken('--ui-settings-leaf-min-h', 'block-size');

                near(px(await page.prop(NAV_LIST, 'min-block-size')), px(navFloor),
                    'the nav list floor is the token');
                near(px(await page.prop(SUBNAV_LIST, 'min-block-size')), px(navFloor),
                    'and the sub-nav list is the SAME token — one component, one floor');
                near(px(await page.prop(LEAF_PANE, 'min-block-size')), px(leafFloor),
                    'the leaf pane floor is its own token');

                await assertScrollFloor(page, {
                    selector: NAV_LIST, squeezeSelector: '#stage', squeeze: { 'block-size': '240px' },
                });
                await assertScrollFloor(page, {
                    selector: SUBNAV_LIST, squeezeSelector: '#stage', squeeze: { 'block-size': '240px' },
                });
                const filler = async (on) => page.evalFn((add) => {
                    const pane = document.querySelector('settings-screen').shadowRoot.getElementById('leaf-pane');
                    const existing = pane.querySelector('#scroll-filler');
                    if (!add) { if (existing) existing.remove(); return false; }
                    if (existing) return true;
                    const el = document.createElement('div');
                    el.id = 'scroll-filler';
                    el.style.blockSize = '900px';
                    pane.append(el);
                    return true;
                }, on);

                await filler(true);
                try {
                    await assertScrollFloor(page, {
                        selector: LEAF_PANE, squeezeSelector: '#stage', squeeze: { 'block-size': '240px' },
                    });
                } finally {
                    await filler(false);
                }
            }));

        test('the nav floor is three rows of the derived pitch, not a number',
            () => mounted(async (page) => {
                const floor = px(await page.resolveToken('--ui-settings-nav-min-h', 'block-size'));
                const pitch = px(await page.resolveToken('--ui-nav-row', 'block-size'));
                near(floor, 3 * pitch, 'Part 5 §4: 3 x var(--ui-nav-row), a proposal carried as a token');
            }));

        test('a search that finds nothing says so, and names what was typed',
            () => mounted(async (page) => {
                await page.evalFn((sel) => { window.__h.need(sel).value = 'zzzz'; }, SEARCH);
                await page.dispatch(SEARCH, 'search', { bubbles: true, composed: true });
                await page.settle(3);

                assert.equal(await page.count(NAV_ROWS), 0, 'nothing matched');
                const said = await page.evalFn((s) => {
                    const empty = window.__h.need(s).shadowRoot.querySelector('#search-empty');
                    return empty ? empty.shadowRoot.textContent.replace(/\s+/g, ' ').trim() : null;
                }, S);
                assert.ok(said, 'the column says something rather than nothing');
                assert.match(said, /zzzz/,
                    '"nothing matched" and "nothing matched THAT" are different sentences to '
                    + 'a person who has just mistyped');

                /* AND IT GOES AWAY. An empty state that outlives the query it describes is
                 * the same defect the other way round. */
                await page.evalFn((sel) => { window.__h.need(sel).value = ''; }, SEARCH);
                await page.dispatch(SEARCH, 'search', { bubbles: true, composed: true });
                await page.settle(3);
                assert.ok(await page.count(NAV_ROWS) > 0, 'clearing the query brings the list back');
            }));

        test('a searched name is the browsed name, through the same row component',
            () => mounted(async (page) => {
                const browsed = await rowNames(page, NAV_ROWS);
                assert.ok(browsed.includes('Machine'), `the browse list names Machine: ${browsed}`);

                await page.evalFn((s) => { window.__h.need(s).value = 'machine'; }, SEARCH);
                await page.dispatch(SEARCH, 'search', { bubbles: true, composed: true });
                await page.settle(3);

                const found = await rowNames(page, NAV_ROWS);
                assert.ok(found.length > 0, 'the search narrowed to something');
                assert.ok(found.includes('Machine'),
                    `T12: "Machine" becomes "1. Machine" in the old skin — got ${found}`);
                for (const name of found) {
                    assert.doesNotMatch(name, /^\s*\d+\s*[.)]/, `search re-added an ordinal to ${name}`);
                }

                assert.equal(await page.count(`${NAV} > *`), found.length,
                    'the rows, and nothing else in the column');

                /* And the category rows that survive the filter are still selectable
                 * into the same state the browse path selects. */
                const first = `${S} >>> #nav ui-nav-row`;
                await page.click(first);
                await page.settle(3);
                assert.equal(await page.count(`${S} >>> #subnav ui-subnav-row`) > 0, true,
                    'pressing a result fills the sub-nav column');
            }));

        test('T6: every rule matches something in at least one of the four states',
            () => mounted(async (page) => {
                const { collapse } = await authored(page);
                const hosts = [S, BODY, NAV, SUBNAV, LEAF_PANE];
                const matched = new Map();
                const seen = new Map();

                for (const width of [`${collapse + 100}px`, `${collapse - 1}px`]) {
                    for (const level of ['leaves', 'categories']) {
                        await setStage(page, width);
                        await page.evalFn((s, v) => {
                            window.__h.need(s).setAttribute('nav-level', v);
                        }, BODY, level);
                        await page.settle(3);

                        for (const host of hosts) {
                            const found = JSON.parse(await page.eval(`${CSSOM_WALK}(${JSON.stringify(host)})`));
                            assert.ok(!found.error, `${host}: ${found.error ?? ''}`);
                            assert.deepEqual(found.media, [],
                                `${host} carries an @media query — the collapse is a CONTAINER question`);
                            for (const rule of found.rules) {
                                const key = `${host} ${rule.condition} ${rule.selector.replace(/\s+/g, ' ').trim()}`;
                                matched.set(key, (matched.get(key) ?? false) || rule.matched);
                                seen.set(key, (seen.get(key) ?? 0) + 1);
                                assert.ok(rule.ids <= 1,
                                    `${host}: ${rule.selector} holds two ids — P15's class`);
                            }
                        }
                    }
                }

                const dead = [...matched.entries()].filter(([, ok]) => !ok).map(([k]) => k);
                assert.deepEqual(dead, [],
                    'T6: "twelve selectors in can never match — ~90 lines, '
                    + 'several documented as fixes for real defects"');

                /* And no selector is declared twice at the same condition (the rule's
                 * ".sx-recent-item declared TWICE in one file"). Four passes, so each
                 * key is expected exactly four times. */
                const twice = [...seen.entries()].filter(([, n]) => n !== 4).map(([k]) => k);
                assert.deepEqual(twice, [], 'a selector is declared twice under one condition');
            }));
    });
}
