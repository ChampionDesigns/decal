/**
 *.5, the shell-and-panels cluster: editor-skeleton, settings-panel, review-panel, tablist-and-selection.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertScrollFloor, assertOneSelectionTreatment } from '../harness/assertions.js';
import {
    EDITOR, editorTab, near, tracks, px,
    mountEditor, setEditorWidth, selectPanel,
    assertTokenMovesBox, assertNoSilentClip, visiblePanels, sweepCollapse,
    ruleCensus, scanRules, assertScanIsLive, seatProfile, textOf,
    editingProfile, matrixStep, editorCalls, editorStoreState,
} from '../harness/editor.js';
import { assertHitFloor } from '../harness/assertions.js';

const authored = async (page) => JSON.parse(await page.eval(
    'Promise.all(['
    + "import('/src/screens/editor-settings-panel.js'),"
    + "import('/src/screens/editor-review-panel.js'),"
    + "import('/src/screens/editor-screen.js')"
    + ']).then(function (m) { return JSON.stringify({'
    + ' trackMin: m[0].EDITOR_FIELD_TRACK_MIN_PX,'
    + ' settings2up: m[0].EDITOR_SETTINGS_COLLAPSE_2UP_PX,'
    + ' settings1up: m[0].EDITOR_SETTINGS_COLLAPSE_1UP_PX,'
    + ' review: m[1].EDITOR_REVIEW_COLLAPSE_PX,'
    + ' tabs: m[2].EDITOR_TABS.map(function (t) { return t.value; }),'
    + ' defaultTab: m[2].DEFAULT_EDITOR_TAB'
    + '}); })',
));

const CSSOM_WALK = `(function (hostSel) {
    var parts = hostSel.split('>>>').map(function (s) { return s.trim(); });
    var root = document, el = null;
    for (var i = 0; i < parts.length; i++) {
        el = root.querySelector(parts[i]);
        if (!el) return JSON.stringify({ error: 'no element for ' + parts[i] });
        root = el.shadowRoot || el;
    }
    var sheets = root.adoptedStyleSheets || [];
    var own = sheets.length ? sheets[sheets.length - 1] : { cssRules: [] };
    var selectors = [], containers = [], media = [];
    var walk = function (rules) {
        for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.media) media.push(rule.conditionText || rule.media.mediaText);
            if (rule.containerQuery !== undefined) containers.push(rule.containerQuery);
            if (rule.cssRules) { walk(rule.cssRules); continue; }
            if (rule.selectorText) selectors.push(rule.selectorText);
        }
    };
    walk(own.cssRules);
    return JSON.stringify({ selectors: selectors, containers: containers, media: media });
})`;

const sheetOf = (page, host) => page.eval(`${CSSOM_WALK}(${JSON.stringify(host)})`)
    .then((raw) => JSON.parse(raw));

async function fillReview(page) {
    await page.evalFn(async (sel) => {
        const [rangesMod, adapters] = await Promise.all([
            import('/src/lib/editor-ranges.js'),
            import('/src/data/adapters-r.js'),
        ]);
        const ranges = rangesMod.createEditorRanges({
            machineLimits: adapters.r2MachineLimits([{ id: 'machine' }]).value,
            machineClass: adapters.machineClassFromServedSet([{ id: 'machine' }]),
        });
        const num = (slot, field, value, ctx) => {
            const r = ranges.rangeFor(field, ctx);
            return ['num', slot, value, r.step, r.unit, r.min, r.max];
        };
        const panel = window.__h.need(sel);
        const block = (i) => ({
            id: `b${i}`,
            heading: `Step ${i + 1}`,
            lines: [
                [['t', 'Set '], ['tog', 'probe', 'coffee'], ['t', ' temperature to '],
                    num('temperature', 'stepTemperature', 93)],
                [['t', 'Hold pressure at '],
                    num('pressure', 'stepTarget', 9, { pump: 'pressure' })],
                [['t', 'Lever profile '], ['lev', 'spring 4.0 bar']],
                [['t', 'Move on after '], num('seconds', 'stepSeconds', 25)],
            ],
        });
        panel.columns = [
            { id: 'a', blocks: Array.from({ length: 8 }, (_, i) => block(i)) },
            { id: 'b', blocks: Array.from({ length: 8 }, (_, i) => block(i + 8)) },
        ];
    }, EDITOR.review);
    await page.settle(4);
}

async function assertReadsOwnBox(page, { panel, grid, branchFor, widths, label }) {
    const branchAt = (w) => branchFor(Math.round(w));
    let discriminated = null;

    for (const w of widths) {
        await page.setStyle(panel, { 'inline-size': `${w}px` });
        await page.settle(3);

        const host = await page.box(panel);
        near(host.width, w, `${label}: the panel's own box is the ${w}px we set on it`);

        const ancestor = await page.box(EDITOR.screen);
        const n = tracks(await page.prop(grid, 'grid-template-columns')).length;
        assert.equal(n, branchFor(w),
            `${label}: a ${w}px PANEL reads as ${branchFor(w)}-up `
            + `(the ancestor <editor-screen> is ${Math.round(ancestor.width)}px, `
            + `which is the ${branchAt(ancestor.width)}-up branch)`);

        if (branchAt(ancestor.width) !== n) {
            discriminated = { w, n, ancestor: Math.round(ancestor.width) };
        }
    }

    assert.ok(discriminated,
        `${label}: not one case separated the panel's box from its ancestor's, so this `
        + 'test would still pass with the query bound to <editor-screen> — widen the case '
        + 'list until one branch disagrees');

    /* Hand the box back, so a later assertion in the same page measures the real one. */
    await page.setStyle(panel, { 'inline-size': '' });
    await page.settle(3);
    return discriminated;
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`editor skeleton @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, options) => browser.withPage({ geometry }, async (page) => {
            await mountEditor(page, options);
            return fn(page);
        });

        test('two rows: the band from its token, and everything else', () => mounted(async (page) => {
            const rows = tracks(await page.prop(EDITOR.screen, 'grid-template-rows'));
            assert.equal(rows.length, 2, '§4.3 names two rows and the screen has two');

            const band = px(await page.resolveToken('--ui-band-h', 'block-size'));
            near(px(rows[0]), band, 'row 1 is --ui-band-h, not a number');

            const screen = await page.box(EDITOR.screen);
            const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
            near(px(rows[1]), screen.height - band - seam, 'row 2 is everything left over');

            /* The seam between the rows IS the header's underline: ground shows through
             * the gap, so there is no border anywhere. */
            near(px(await page.prop(EDITOR.screen, 'row-gap')), seam, 'the row gap is --ui-seam');
            assert.equal(
                await page.prop(EDITOR.screen, 'background-color'),
                await page.resolveToken('--ui-line-strong'),
                'CONVENTIONS §13: --ui-line-strong is the header-underline weight',
            );
            assert.equal(await page.prop(EDITOR.screen, 'border-bottom-width'), '0px',
                'a divider is a gap, not a border');
        }));

        test('the band and the body fill their rows, in order', () => mounted(async (page) => {
            const screen = await page.box(EDITOR.screen);
            const band = await page.box(EDITOR.band);
            const body = await page.box(EDITOR.body);
            const seam = px(await page.resolveToken('--ui-seam', 'block-size'));

            near(band.y, screen.y, 'the band starts at the top of the screen');
            near(band.width, screen.width, 'the band spans the screen');
            near(body.y, band.y + band.height + seam, 'the body starts one seam below it');
            near(body.height, screen.y + screen.height - body.y, 'and takes the rest');
        }));

        test('E9: the root grows with the canvas, and takes its height from its parent',
            () => mounted(async (page) => {
                const seam = px(await page.resolveToken('--ui-seam', 'block-size'));
                const seen = [];
                for (const height of [600, 801, 1200, 1400]) {
                    await page.setGeometry({ ...geometry, height });
                    await page.settle(4);

                    const screen = await page.box(EDITOR.screen);
                    const band = await page.box(EDITOR.band);
                    const body = await page.box(EDITOR.body);

                    near(screen.height, height,
                        `E9: a ${height}px canvas must give a ${height}px root — Slate's stayed put`);
                    near(body.height, screen.height - band.height - seam,
                        `E9: at ${height} the body is everything the band left, not a fixed track`);
                    seen.push({ height, band: band.height, body: body.height });
                }

                const moved = seen.slice(1).filter((row, i) => row.band === seen[i].band);
                assert.ok(moved.length >= 2,
                    'E9: fewer than two comparable canvases — widen the sweep');
                for (const row of moved) {
                    const prev = seen[seen.indexOf(row) - 1];
                    near(row.body - prev.body, row.height - prev.height,
                        `E9: ${prev.height} -> ${row.height} moved the body by ${row.body - prev.body}, `
                        + 'not by the canvas delta — something between them is fixed');
                }

                /* AND THE PARENT, NOT THE CANVAS, IS WHAT IT READS. A height keyed on an
                 * ancestor SELECTOR — E9's actual defect — cannot follow a parent whose
                 * box the canvas does not explain. */
                await page.setGeometry(geometry);
                await page.settle(3);
                for (const value of ['900px', '540px']) {
                    await page.setStyle('#stage', { 'block-size': value });
                    await page.settle(3);
                    const stage = await page.box('#stage');
                    const screen = await page.box(EDITOR.screen);
                    near(stage.height, px(value), `the stage took the ${value} we set on it`);
                    near(screen.height, stage.height,
                        `E9: the root is ${screen.height} inside a ${stage.height} parent — `
                        + 'it is not filling its parent, it is reading something else');
                }
                await page.setStyle('#stage', { 'block-size': '100dvh' });
                await page.settle(3);
            }));

        test('the centre track IS the tablist, and it is auto rather than a literal',
            () => mounted(async (page) => {
                const columns = tracks(await page.prop(EDITOR.bandGrid, 'grid-template-columns'));
                assert.equal(columns.length, 3, '#31 in layout="flanks" — three tracks');

                const centre = await page.box(EDITOR.bandCentre);
                const bar = await page.box(EDITOR.tabs);
                near(centre.width, bar.width, 'the centre track is the tablist\'s own width');
                assert.notEqual(Math.round(centre.width), 430,
                    'and never Slate\'s 430px literal (profile-editor-v3.css:98)');

                near(px(await page.prop(EDITOR.tabs, 'inline-size')), centre.width,
                    'fit-content: the bar is exactly its tabs', 0.01);
            }));

        test('a long flank overflows and does NOT shove the centre track',
            () => mounted(async (page) => {
                const before = await page.box(EDITOR.bandCentre);
                const beforeBar = await page.box(EDITOR.tabs);

                await page.evalFn((s, v) => { window.__h.need(s).heading = v; },
                    EDITOR.band, 'Profile editor '.repeat(40));
                await page.evalFn((s) => { window.__h.need(s).changeCount = 3; }, EDITOR.screen);
                await page.settle(4);

                const after = await page.box(EDITOR.bandCentre);
                const afterBar = await page.box(EDITOR.tabs);
                near(after.width, before.width, 'the centre track keeps its width');
                near(after.x, before.x, 'and its position — "never shove"');
                near(afterBar.width, beforeBar.width, 'so the tablist is untouched');

                /* AND THE FLANK OVERFLOWS RATHER THAN WIDENING THE BAND. The title's own
                 * box is clamped by the track; the band is still exactly the screen. */
                const screen = await page.box(EDITOR.screen);
                const band = await page.box(EDITOR.band);
                near(band.width, screen.width, 'the band did not grow');
                const lead = await page.box(EDITOR.bandLead);
                const title = await page.metrics(EDITOR.bandTitle);
                assert.ok(title.rect.width <= lead.width + 0.5,
                    `the title stays inside its flank (${title.rect.width} in ${lead.width})`);
                assert.ok(title.scrollWidth > title.clientWidth + 0.5,
                    'and it is genuinely overflowing, so the assertion is not vacuous');
            }));

        test('D11: the band is in commit mode and the wording is not this screen\'s',
            () => mounted(async (page) => {
                assert.ok(await page.exists(EDITOR.save), 'the commit cluster is rendered');
                const clean = await page.evalFn(
                    (s) => window.__h.need(s).textContent.trim(), EDITOR.save,
                );
                assert.equal(clean, 'Save', 'zero changes: Save, with no count beside it');
                assert.equal(await page.count(EDITOR.cancel), 1,
                    'and Cancel beside it — Slate\'s pair, on Ben\'s ruling');

                await page.evalFn((s) => { window.__h.need(s).changeCount = 3; }, EDITOR.screen);
                await page.settle(4);
                const dirty = await page.evalFn(
                    (s) => window.__h.need(s).textContent.trim(), EDITOR.save,
                );
                assert.equal(dirty, 'Save (3)', 'the count crosses and #31 writes the sentence');
                assert.equal(await page.count(EDITOR.cancel), 1, 'and Cancel appears');
            }));

        test('the steps region is the body\'s whole cell and owns no overflow',
            () => mounted(async (page) => {
                const stack = await page.box(EDITOR.stack);
                const steps = await page.box(EDITOR.steps);
                near(steps.width, stack.width, 'the region is the cell, in the inline axis');
                near(steps.height, stack.height, 'and in the block axis');

                for (const box of [EDITOR.body, EDITOR.stack, EDITOR.steps]) {
                    const m = await assertNoSilentClip(page, box);
                    assert.equal(m.overflowX, 'visible', `${box} declares no inline overflow`);
                    assert.equal(m.overflowY, 'visible', `${box} declares no block overflow`);
                }
            }));

        test('the slotted matrix IS the grid item, so its own floor binds',
            () => mounted(async (page) => {
                const steps = await page.box(EDITOR.steps);
                const matrix = await page.box('#matrix');
                near(matrix.x, steps.x, 'the mounted element sits in the cell');
                near(matrix.y, steps.y, 'at its origin');
                assert.ok(matrix.height >= 2400 - 0.5,
                    `the 2400px floor binds through display: contents (got ${matrix.height})`);
                assert.ok(matrix.height > steps.height + 0.5,
                    'and it is genuinely taller than the cell, so nothing is vacuous');
            }));

        test('E10: one selected treatment, and it is the four dials',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: editorTab(0),
                    unselected: editorTab(1),
                });
            }));

        test('E10: the tablist and a plain segmented bank paint selection identically',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const bank = document.createElement('ui-bank');
                    bank.id = 'bare-bank';
                    bank.items = ['steps', 'settings', 'review'];
                    bank.value = 'steps';
                    bank.label = 'a plain segmented bank';
                    document.getElementById('stage').append(bank);
                });
                await page.settle(4);

                const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
                const tab = await page.computed(editorTab(0), props);
                const bank = await page.computed('#bare-bank >>> #item-0', props);
                assert.deepEqual(bank, tab,
                    'the tablist and the bank paint selected differently — that is E10');

                /* And they move together on the one dial, rather than agreeing by
                 * coincidence at the resting value. */
                await page.setToken('--ui-selected-face', 'rgb(255, 0, 170)');
                await page.settle(2);
                const tabDrilled = await page.prop(editorTab(0), 'background-color');
                const bankDrilled = await page.prop('#bare-bank >>> #item-0', 'background-color');
                await page.setToken('--ui-selected-face', null);
                assert.equal(bankDrilled, tabDrilled, 'one dial reaches both surfaces');
                assert.equal(tabDrilled, 'rgb(255, 0, 170)', 'and it is the dial doing it');
            }));

        test('E10: the editor declares no selected rule anywhere — inexpressible, not absent',
            () => mounted(async (page) => {
                for (const host of [
                    EDITOR.screen, EDITOR.body, EDITOR.settings, EDITOR.review, EDITOR.tabs,
                ]) {
                    const sheet = await sheetOf(page, host);
                    assert.equal(sheet.error, undefined, `${host}: ${sheet.error}`);
                    const guilty = sheet.selectors.filter(
                        (s) => /aria-selected|\bselected\b|\bcurrent\b|\bactive\b/i.test(s),
                    );
                    assert.deepEqual(guilty, [],
                        `${host} declares a selection look of its own — E10 is two competing `
                        + 'segmented implementations with opposite selected treatments');
                }
            }));

        test('the roving tabindex carries over: one tab stop, and the arrows move it',
            () => mounted(async (page) => {
                const stops = () => page.evalFn(
                    (s) => window.__h.qAll(s).map((el) => el.getAttribute('tabindex')),
                    `${EDITOR.tablist} >>> button`,
                );

                const before = await stops();
                assert.equal(before.length, 3, 'three tabs');
                assert.equal(before.filter((t) => t === '0').length, 1,
                    'exactly one tab stop in the tablist (APG roving tabindex)');
                assert.equal(before[0], '0', 'and it is the selected tab');

                await page.click(editorTab(0));
                await page.press('ArrowRight');
                await page.settle(4);

                const after = await stops();
                assert.equal(after.filter((t) => t === '0').length, 1,
                    'still exactly one tab stop after the arrow');
                assert.equal(after[1], '0', 'and it has moved to the next tab');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).getAttribute('tab'), EDITOR.screen),
                    'settings', 'the arrow selected it, and the screen followed the bar',
                );
            }));

        test('selecting a tab shows exactly one panel, and the bar owns which',
            () => mounted(async (page) => {
                const { tabs, defaultTab } = await authored(page);
                assert.equal(defaultTab, 'steps', '§4.3 lists steps first');

                assert.deepEqual(await visiblePanels(page), ['steps'], 'steps opens');

                await selectPanel(page, 'settings');
                assert.deepEqual(await visiblePanels(page), ['settings']);
                assert.equal(await page.prop(EDITOR.screen, 'container-type'), 'inline-size',
                    'and the screen is still a container, not a viewport reader');

                await selectPanel(page, 'review');
                assert.deepEqual(await visiblePanels(page), ['review']);

                /* The hidden ones are hidden AND inert — ui-tab-bar writes both, so a
                 * screen rule that outranks [hidden] cannot leave a focusable ghost
                 * (bug P13's mechanism). */
                for (const panel of [EDITOR.steps, EDITOR.settings]) {
                    assert.equal(
                        await page.evalFn((s) => window.__h.need(s).hasAttribute('inert'), panel),
                        true, `${panel} is inert while hidden`,
                    );
                }

                /* And the screen's own reflected attribute agrees — one owner. */
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).getAttribute('tab'), EDITOR.screen),
                    tabs[2], 'the screen mirrors the bar, and the bar was the source',
                );
            }));

        test('the settings collapse is this panel\'s own container, swept, flipping once each',
            () => mounted(async (page) => {
                const { settings2up, settings1up } = await authored(page);
                await selectPanel(page, 'settings');

                assert.equal(await page.prop(EDITOR.settings, 'container-type'), 'inline-size',
                    'spec §2.1 Rule 1 — the component reads its own container');
                const host = await page.box(EDITOR.settings);
                const grid = await page.box(EDITOR.settingsGrid);
                near(grid.width, host.width, 'the queried box IS this component\'s box');

                const { flips } = await sweepCollapse(page, {
                    selector: EDITOR.settingsGrid,
                    from: settings2up + 40,
                    to: settings1up - 40,
                });
                assert.equal(flips.length, 2, `two collapses, not ${flips.length} flips`);
                assert.deepEqual(flips.map((f) => f.n), [2, 1], 'three columns, then two, then one');

                for (const [w, n, why] of [
                    [settings2up, 3, '< is exclusive, so the threshold belongs to 3-up'],
                    [settings2up - 1, 2, 'and one below it is 2-up'],
                    [settings1up, 2, 'likewise at the second threshold'],
                    [settings1up - 1, 1, 'and one below it is 1-up'],
                ]) {
                    await setEditorWidth(page, `${w}px`);
                    assert.equal(
                        tracks(await page.prop(EDITOR.settingsGrid, 'grid-template-columns')).length,
                        n, `${w}px: ${why}`,
                    );
                }
            }));

        test('the settings query reads THIS PANEL\'S box, not the stage it sits in',
            () => mounted(async (page) => {
                const { settings2up, settings1up } = await authored(page);
                await selectPanel(page, 'settings');
                await assertReadsOwnBox(page, {
                    label: 'settings',
                    panel: EDITOR.settings,
                    grid: EDITOR.settingsGrid,
                    branchFor: (w) => (w < settings1up ? 1 : w < settings2up ? 2 : 3),
                    widths: [settings2up - 1, settings1up - 1],
                });
            }));

        test('at the threshold the narrowest track is exactly the stated minimum',
            () => mounted(async (page) => {
                const { settings2up, trackMin } = await authored(page);
                await selectPanel(page, 'settings');
                await page.evalFn((s) => window.__h.qAll(s).forEach((el) => el.remove()), '.row');
                await setEditorWidth(page, `${settings2up}px`);

                const used = tracks(await page.prop(EDITOR.settingsGrid, 'grid-template-columns'));
                assert.equal(used.length, 3, 'the 3-up branch');
                near(px(used[0]), trackMin, 'track 1 is one stepper band');
                near(px(used[1]), trackMin, 'track 2 likewise');
                near(px(used[2]), trackMin * 2, 'and the 2fr track is two of them');
            }));

        test('the settings panel scrolls, has a floor, and shows a scrollbar',
            () => mounted(async (page) => {
                await selectPanel(page, 'settings');
                const floor = await page.resolveToken('--ui-editor-field-min-h', 'block-size');
                await assertScrollFloor(page, {
                    selector: EDITOR.settingsGrid,
                    squeezeSelector: '#stage',
                    squeeze: { 'block-size': '260px' },
                    minBlockSize: floor,
                });
            }));

        test('the settings floor is consulted: moving the token moves the box',
            () => mounted(async (page) => {
                await selectPanel(page, 'settings');
                await page.setStyle('#stage', { 'block-size': '160px' });
                await page.settle(3);
                const floor = px(await page.resolveToken('--ui-editor-field-min-h', 'block-size'));
                near((await page.box(EDITOR.settingsGrid)).height, floor,
                    'squeezed, the region sits exactly on its floor');
                await assertTokenMovesBox(page, {
                    token: '--ui-editor-field-min-h',
                    selector: EDITOR.settingsGrid,
                    by: 120,
                });
            }));

        test('the review collapse is swept and flips exactly once', () => mounted(async (page) => {
            const { review } = await authored(page);
            await selectPanel(page, 'review');

            assert.equal(await page.prop(EDITOR.review, 'container-type'), 'inline-size',
                'the component reads its own container');

            const { flips } = await sweepCollapse(page, {
                selector: EDITOR.reviewGrid, from: review + 40, to: review - 40,
            });
            assert.equal(flips.length, 1, `one collapse, not ${flips.length} flips`);

            await setEditorWidth(page, `${review}px`);
            assert.equal(tracks(await page.prop(EDITOR.reviewGrid, 'grid-template-columns')).length,
                2, '< is exclusive, so the threshold belongs to the two-column branch');
            await setEditorWidth(page, `${review - 1}px`);
            assert.equal(tracks(await page.prop(EDITOR.reviewGrid, 'grid-template-columns')).length,
                1, 'and one below it is 1-up');
            assert.equal(await page.count(EDITOR.reviewColumns), 2,
                'both columns still exist collapsed — the tracks changed, not the content');
        }));

        test('the review query reads THIS PANEL\'S box, not the stage it sits in',
            () => mounted(async (page) => {
                const { review } = await authored(page);
                await selectPanel(page, 'review');
                await assertReadsOwnBox(page, {
                    label: 'review',
                    panel: EDITOR.review,
                    grid: EDITOR.reviewGrid,
                    branchFor: (w) => (w < review ? 1 : 2),
                    widths: [review - 1, review + 40],
                });
            }));

        test('each review COLUMN is the scroll region, and the panel scrolls nothing',
            () => mounted(async (page) => {
                await selectPanel(page, 'review');
                const panel = await assertNoSilentClip(page, EDITOR.reviewGrid);
                assert.equal(panel.overflowY, 'visible',
                    '§4.3 gives the overflow to each column, not to the panel');

                const columns = await page.evalFn(
                    (s) => window.__h.qAll(s).map((el) => getComputedStyle(el).overflowY),
                    EDITOR.reviewColumns,
                );
                assert.deepEqual(columns, ['auto', 'auto'], 'each column: overflow-y auto');
            }));

        test('a review column scrolls, has a floor, and shows a scrollbar',
            () => mounted(async (page) => {
                await selectPanel(page, 'review');
                await fillReview(page);
                const floor = await page.resolveToken('--ui-editor-review-min-h', 'block-size');
                await assertScrollFloor(page, {
                    selector: EDITOR.reviewColumns,
                    squeezeSelector: '#stage',
                    squeeze: { 'block-size': '220px' },
                    minBlockSize: floor,
                });
            }));

        test('the review floor is consulted: moving the token moves the box',
            () => mounted(async (page) => {
                await selectPanel(page, 'review');
                await page.setStyle('#stage', { 'block-size': '150px' });
                await page.settle(3);
                const floor = px(await page.resolveToken('--ui-editor-review-min-h', 'block-size'));
                near((await page.box(EDITOR.reviewColumns)).height, floor,
                    'squeezed, a column sits exactly on its floor');
                await assertTokenMovesBox(page, {
                    token: '--ui-editor-review-min-h',
                    selector: EDITOR.reviewColumns,
                    by: 90,
                });
            }));

        test('E6: scroll restore targets the element that ACTUALLY scrolls',
            () => mounted(async (page) => {
                await selectPanel(page, 'review');
                await fillReview(page);
                await page.setStyle('#stage', { 'block-size': '320px' });
                await page.settle(3);

                /* (a) The panel host is NOT a scroller. This is the element the old code
                 *     wrote scrollTop to — "so the fix labelled E2 does nothing". */
                const host = await page.metrics(EDITOR.review);
                assert.ok(host.scrollHeight <= host.clientHeight + 0.5,
                    'the panel host has nothing to scroll — writing scrollTop here is E6');

                /* (b) The column is, and by enough to be worth restoring. */
                const column = await page.metrics(EDITOR.reviewColumns);
                assert.ok(column.scrollHeight > column.clientHeight + 40,
                    `the column overflows by ${column.scrollHeight - column.clientHeight}px`);

                await page.evalFn((s) => { window.__h.need(s).scrollTop = 180; },
                    EDITOR.reviewColumns);
                await page.settle(3);
                const parked = await page.evalFn(
                    (s) => window.__h.need(s).scrollTop, EDITOR.reviewColumns,
                );
                assert.ok(parked > 100, `the column really scrolled (${parked})`);

                /* (c) Away, and back — through the tab bar, which is how a user does it. */
                await selectPanel(page, 'steps');
                assert.equal(
                    await page.evalFn((s) => window.__h.need(s).hasAttribute('hidden'), EDITOR.review),
                    true, 'the review panel is hidden while the steps tab is showing',
                );
                await selectPanel(page, 'review');

                const restored = await page.evalFn(
                    (s) => window.__h.need(s).scrollTop, EDITOR.reviewColumns,
                );
                assert.equal(restored, parked,
                    'E6: the offset came back — and it came back on the scrolling element');
            }));

        test('the editor holds no width media query — every branch is a container query',
            () => mounted(async (page) => {
                for (const host of [EDITOR.screen, EDITOR.body, EDITOR.settings, EDITOR.review]) {
                    const sheet = await sheetOf(page, host);
                    assert.equal(sheet.error, undefined, `${host}: ${sheet.error}`);
                    const widthMedia = sheet.media.filter((m) => /width/i.test(m));
                    assert.deepEqual(widthMedia, [],
                        `${host} carries a width media rule — Part 2 §5 rule 1 forbids one`);
                }
                const settings = await sheetOf(page, EDITOR.settings);
                assert.equal(settings.containers.length, 2, 'the settings panel: two collapses');
                const review = await sheetOf(page, EDITOR.review);
                assert.equal(review.containers.length, 1, 'the review panel: one');
            }));

        test('cmp-seh-3: the band carries the profile\'s identity, on every tab',
            () => mounted(async (page) => {
                assert.equal(await page.exists(EDITOR.bandTitle), true,
                    'with nothing open the band still carries #31\'s own heading');
                assert.equal(await page.exists(EDITOR.identity), false);

                await seatProfile(page, { profile: editingProfile() });

                /* ONE TITLE, NOT TWO: the heading is dropped exactly when the identity
                 * replaces it, so #31 renders no <h1> beside the name. */
                assert.equal(await page.exists(EDITOR.bandTitle), false,
                    'the identity replaces the heading rather than sitting beside it');

                for (const tab of ['steps', 'settings', 'review']) {
                    await selectPanel(page, tab);
                    assert.equal(await textOf(page, EDITOR.eyebrow), 'Profile editor',
                        `${tab}: the eyebrow is what the heading used to say`);
                    assert.equal(await textOf(page, EDITOR.profileTitle), 'Morning ristretto',
                        `${tab}: the title is the loaded profile's name`);
                    assert.equal(await page.exists(EDITOR.pencil), true, `${tab}: the pencil`);
                    assert.ok((await textOf(page, EDITOR.totals)).startsWith('2 steps'),
                        `${tab}: the totals line`);
                }

                assert.equal(await page.prop(EDITOR.pencil, 'display') !== 'none', true);
                const label = await page.evalFn((s) => window.__h.need(s).label, EDITOR.pencil);
                assert.equal(label, 'Edit profile name');
            }));

        test('the identity fits the band, and every control in it clears the hit floor (L22)',
            () => mounted(async (page) => {
                await seatProfile(page, { profile: editingProfile() });

                const band = await page.box(EDITOR.band);
                const identity = await page.box(EDITOR.identity);
                const token = px(await page.resolveToken('--ui-band-h', 'block-size'));

                assert.ok(identity.height <= band.height + 0.5,
                    `the identity is taller than the band (${identity.height} in ${band.height})`);
                near(band.height, token,
                    'the band is still exactly --ui-band-h — the identity did not grow it');

                await assertHitFloor(page, EDITOR.pencil, { mode: 'box' });
                const title = await page.box(EDITOR.profileTitle);
                const floor = px(await page.resolveToken('--ui-hit-min', 'block-size'));
                assert.ok(title.height >= floor - 0.5,
                    `the title button is ${title.height}px against a ${floor}px floor`);

                /* AND THE BAND DOES NOT SCROLL. A second totals line, or a name that
                 * wrapped, would show up here first. */
                const metrics = await page.metrics(EDITOR.band);
                assert.ok(metrics.scrollHeight <= metrics.clientHeight + 0.5,
                    `the band overflows its own box (${metrics.scrollHeight} > ${metrics.clientHeight})`);
            }));

        test('M10: a long profile name ellipsises in the flank and never shoves the tablist',
            () => mounted(async (page) => {
                await seatProfile(page, { profile: editingProfile() });
                const before = await page.box(EDITOR.bandCentre);

                await seatProfile(page, {
                    profile: { ...editingProfile(), title: 'Extractamundo Dos! '.repeat(12) },
                });

                const after = await page.box(EDITOR.bandCentre);
                near(after.x, before.x, 'the tablist did not move');
                near(after.width, before.width, 'and it did not change width');

                const screen = await page.box(EDITOR.screen);
                const band = await page.box(EDITOR.band);
                near(band.width, screen.width, 'the band did not grow');

                const title = await page.metrics(EDITOR.profileTitle);
                assert.ok(title.scrollWidth > title.clientWidth + 0.5,
                    'the name is clipped rather than laid out at its full width');
                assert.equal(await page.prop(EDITOR.profileTitle, 'text-overflow'), 'ellipsis');

                const totals = await page.metrics(EDITOR.totals);
                assert.ok(totals.rect.height < 40,
                    `the totals stayed on one line (${totals.rect.height}px)`);
            }));

        test('the totals are the profile\'s own ceilings, and the peak is not a limiter',
            () => mounted(async (page) => {
                await seatProfile(page, {
                    profile: editingProfile([
                        matrixStep({ seconds: 40, volume: 100 }),
                        matrixStep({ seconds: 40, pump: 'pressure', pressure: 6 }),
                        matrixStep({ seconds: 40 }),
                    ]),
                });
                assert.equal(await textOf(page, EDITOR.totals),
                    '3 steps \u00b7 max 2:00 \u00b7 cap 100 mL \u00b7 peak 6.0 bar');
            }));

        test('dec-A-B-1: an edit counts, and Save takes B11\'s path with the parent link',
            () => mounted(async (page) => {
                await seatProfile(page, { profile: editingProfile() });

                await page.evalFn((sel) => {
                    window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
                        detail: { index: 0, row: 'temperature', field: 'temperature', value: 88 },
                        bubbles: true,
                        composed: true,
                    }));
                }, EDITOR.screen);
                await page.settle(3);

                const label = await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.save);
                assert.equal(label, 'Save (1)', 'D11: the count is the store\'s, and it reached the band');

                await page.click(EDITOR.save);
                await page.settle(6);

                const calls = await editorCalls(page);
                assert.equal(calls.length, 2, 'one save: the profile write, then the row it replaces');
                assert.equal(calls[1].method, 'PUT');
                assert.equal(calls[1].path, '/profiles/profile%3Aseated/visibility',
                    'the record the editor opened from — never the one just saved');
                assert.deepEqual(calls[1].body, { visibility: 'hidden' },
                    'hidden, not deleted: the version stays in the lineage and in the '
                    + 'Previous versions dialog, it just leaves the list');
                assert.equal(calls[0].method, 'POST');
                assert.equal(calls[0].path, '/profiles');
                assert.deepEqual(Object.keys(calls[0].body).sort(), ['parentId', 'profile'],
                    'the body is WRAPPED and carries the parent — B11\'s path, DQ-629\'s default');
                assert.equal(calls[0].body.parentId, 'profile:seated');
                assert.equal(calls[0].body.profile.steps[0].temperature, 88,
                    'the edit is on the wire, so the draft the screen holds is what was saved');

                const state = await editorStoreState(page);
                assert.equal(state.save, 'saved');
                assert.equal(state.version.kept, 'linked',
                    'the server linked the two records, so the editor may say the old one is kept');

                /* AND THE PERSON IS TOLD. A save that reported nothing is the silence the
                 * finding is about. */
                const notices = await page.evalFn((sel) => [...window.__h.need(sel).children]
                    .map((n) => ({ tone: n.getAttribute('tone'), text: n.textContent.trim() })), EDITOR.notice);
                assert.deepEqual(notices, [{ tone: 'ok', text: 'Saved. The previous version is kept.' }]);

                /* The saved record is the new baseline, so the count is spent. */
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.save),
                    'Save', 'nothing is unsaved after a save: the COUNT is gone, and the '
                    + 'word at zero is "Save" (Ben, 25 Aug 2026 — Slate\'s pair on both '
                    + 'committing screens)');
            }));

        test('the rename takes the PUT, carrying the SERVED content and only a new name',
            () => mounted(async (page) => {
                await seatProfile(page, { profile: editingProfile() });

                /* An unsaved content edit is standing when the rename happens. It must not
                 * ride along under a label edit's name, and it must not be lost either. */
                await page.evalFn((sel) => {
                    window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
                        detail: { index: 0, row: 'temperature', field: 'temperature', value: 88 },
                        bubbles: true,
                        composed: true,
                    }));
                }, EDITOR.screen);
                await page.settle(3);

                await page.click(EDITOR.pencil);
                await page.settle(4);
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.renameDialog), true,
                    'the pencil opens the name editor');
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).value, EDITOR.renameField),
                    'Morning ristretto', 'seeded with the name it is about to change');

                await page.evalFn((sel) => { window.__h.need(sel).value = 'Evening ristretto'; }, EDITOR.renameField);
                await page.click(EDITOR.renameSave);
                await page.settle(6);

                const calls = await editorCalls(page);
                assert.equal(calls.length, 1);
                assert.equal(calls[0].method, 'PUT');
                assert.equal(calls[0].path, '/profiles/profile%3Aseated');
                assert.deepEqual(Object.keys(calls[0].body), ['profile'],
                    'the body carries the PROFILE: `metadata` is ProfileRecord\'s free-form map '
                    + 'and cannot carry a name, so a rename through saveMetadata would be a '
                    + 'silent no-op the user is told succeeded');
                assert.equal(calls[0].body.profile.title, 'Evening ristretto');
                assert.equal(calls[0].body.profile.steps[0].temperature, 92,
                    'built from the BASELINE — the unsaved 88 did not ride along');

                /* AND THE UNSAVED EDIT SURVIVED THE RE-SEAT, still counted. */
                assert.equal(await textOf(page, EDITOR.profileTitle), 'Evening ristretto',
                    'the header shows the new name, live');
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.save),
                    'Save (1)', 'the step edit is still unsaved, and still counted');
            }));

        test('at a clean count the band closes rather than saving, and asks the shell to go back',
            () => mounted(async (page) => {
                await seatProfile(page, { profile: editingProfile() });
                await page.evalFn(() => {
                    window.__nav = [];
                    document.addEventListener('navigate', (e) => window.__nav.push({ ...e.detail }));
                });
                await page.click(EDITOR.save);
                await page.settle(4);

                assert.deepEqual(await editorCalls(page), [],
                    'Close saves nothing — a version nobody asked for is worse than no save');
                assert.deepEqual(await page.evalFn(() => window.__nav), [{ back: true }],
                    'the shell owns navigation, so the screen ASKS (app-root.js:375)');
            }));

        test('a FAILED save keeps the draft — the edit stays counted, so the person can retry',
            () => mounted(async (page) => {
                await seatProfile(page, {
                    profile: editingProfile(),
                    answers: { 'POST /profiles': { ok: false, status: 501, message: 'no stateable response' } },
                });
                await page.evalFn((sel) => {
                    window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
                        detail: { index: 0, row: 'temperature', field: 'temperature', value: 88 },
                        bubbles: true,
                        composed: true,
                    }));
                }, EDITOR.screen);
                await page.settle(3);

                await page.click(EDITOR.save);
                await page.settle(6);

                const state = await editorStoreState(page);
                assert.equal(state.save, 'failed');
                assert.equal(await page.evalFn((sel) => window.__h.need(sel)._draft.steps[0].temperature,
                    EDITOR.screen), 88, 'the unsaved edit is still in the draft');
                assert.equal(await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.save),
                    'Save (1)', 'still counted, so the retry is one press');
                const notices = await page.evalFn((sel) => [...window.__h.need(sel).children]
                    .map((n) => n.getAttribute('tone')), EDITOR.notice);
                assert.deepEqual(notices, ['danger'], 'and the person was told');
            }));

        test('E4: no rule in the shell\'s four sheets is unmatchable, in any panel state',
            () => mounted(async (page) => {
                const HOSTS = [EDITOR.screen, EDITOR.body, EDITOR.settings, EDITOR.review];

                await assertScanIsLive(page, HOSTS);

                const census = ruleCensus();
                census.add(await scanRules(page, HOSTS), 'steps');
                await selectPanel(page, 'settings');
                census.add(await scanRules(page, HOSTS), 'settings');
                await selectPanel(page, 'review');
                census.add(await scanRules(page, HOSTS), 'review');
                await fillReview(page);
                census.add(await scanRules(page, HOSTS), 'review+segments');
                await seatProfile(page);
                census.add(await scanRules(page, HOSTS), 'profile-open');

                await page.evalFn(() => {
                    for (const el of [...document.querySelectorAll('[slot="settings"]')]) el.remove();
                    return true;
                });
                await page.settle(4);
                await selectPanel(page, 'settings');
                census.add(await scanRules(page, HOSTS), 'settings-composed');

                const sheets = census.sheets();
                assert.equal(sheets.length, HOSTS.length,
                    'the four shell roots must each end on their own sheet');

                for (const sheet of sheets) {
                    const where = sheet.hosts.join(' + ');
                    assert.ok(sheet.rules > 0,
                        `${where}: the scan found no rule at all — it is walking the wrong sheet`);
                    assert.deepEqual(sheet.dead, [],
                        `${where} carries a selector that matches nothing in any state — `
                        + 'E4\'s "eight CSS rules whose selectors cannot match"');
                    assert.deepEqual(sheet.duplicated, [],
                        `${where} declares a selector twice at the same condition — P9's `
                        + '".sx-recent-item declared TWICE in one file"');
                }
            }));
    });
}
