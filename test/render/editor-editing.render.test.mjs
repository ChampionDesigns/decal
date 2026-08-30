/**
 * editor-editing.render.test.mjs — wave 5.5, rows `chart-preview`, `editor-dialogs` and
 * `numpad-flows`, at both Gate A geometries (BENCH 1281×801 @ dsf 1.5, FLOOR 1000×600 @
 * dsf 1).
 *
 * ===========================================================================
 * A8 — NOTHING HERE READS A FILE
 * ===========================================================================
 * Part 5 §5: "the old editor is pinned by tests that regex-match the stylesheet's source
 * text for the 1920×1200 lock and the 64px literals — tests that made the defects
 * UNREMOVABLE … no test anywhere may match source text." Every claim below is a computed
 * style, a measured box, a counter the component itself keeps, a real hit-tested press,
 * a real CDP key, or Chrome's own accessibility tree. The assertions go through
 * `test/harness/editor.js`, which opens no file either.
 *
 * ===========================================================================
 * WHAT EACH BLOCK PROVES
 * ===========================================================================
 * 1. E12, and it is the one that needs an INSTRUMENT rather than an opinion. #9 keeps
 *    two counters — `buildCount` (uPlot constructions) and `paintCount` (draws that
 *    actually ran) — so "no rebuild on every ± press" is countable. The block drives N
 *    edits with the preview showing (zero constructions, the data different each time),
 *    N more with the preview on a HIDDEN tab (zero constructions AND zero paints), and
 *    then proves the instrument is alive by making a theme change rebuild. A counter
 *    that cannot move is E8's defect wearing a test. The theme is E12's OTHER rebuild
 *    trigger — uPlot bakes its colours in at construction — and it reaches the card
 *    without passing through <editor-preview> at all, so it gets its own block: a
 *    retheme on a hidden tab must cost zero builds, zero paints and no reallocated
 *    canvas, and must land, in the theme on screen, the moment the panel has a box.
 *
 * 2. chart-C6 as a CENSUS: every canvas in the mounted editor lives inside a
 *    `ui-chart-card`, and the editor contributes exactly one chart. The tree has no
 *    "guard that lists them all" to add a row to — Gate C ships four guards
 *    (colour-literal, font-face, important, private-palette) and none is chart-shaped —
 *    so the census is the enforcement this screen carries, and the absence is a recorded
 *    deferred question rather than a silently skipped item.
 *
 * 3. chart-C5: the palette is read from CSS. Every channel colour the plot was BUILT
 *    from equals the computed value of its token on the card, and moving a token moves
 *    what the next build reads. Slate's six hex literals have no way in.
 *
 * 4. O6/O8 per dialog INSTANCE: one native <dialog> in the composed tree, a scrolling
 *    body, a background that is really inert (a press on the matrix behind the dialog
 *    changes nothing), a trap the Tab key cannot walk out of, Escape closing through the
 *    shell's own stack, and the caret restored to the control that was pressed. Plus the
 *    ARBITRATION, driven through the three public routes because no gesture can reach a
 *    second overlay: opening one closes whatever else the region had open, a refused
 *    open closes nothing, and O5 — the exit dialog may not seed or permit a threshold
 *    `exit-validity.js` proves can never end its step.
 *
 * 5. The lever preset invariant: P0 is unchanged across EVERY preset — the locked box's
 *    reading is identical, the draft has exactly two keys, and the emitted event carries
 *    no pressure of any spelling.
 *
 * 6. B2 through the numpad: the keypad's own range hint is `numpadRange()` of the entry
 *    the door handed it, for a matrix cell and for a settings field, and a field the door
 *    refuses opens nothing and reports why. Plus O9 (the backspace has a real accessible
 *    name) and O10 (the title's size is a token and there is no inline size on it),
 *    asserted on an ARMED keypad — an unarmed #53 renders its unavailable panel and
 *    measuring that would prove nothing about the pad.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { DRILL_COLOUR } from '../harness/assertions.js';
import {
    EDITOR, matrixCell, near, px,
    mountEditing, selectPanel, editorEvents, eventsNamed,
    chartCounts, chartData, numpadRangeReport, typeNumpad, accessibleNames, accessibleText,
    matrixStep, ruleCensus, scanRules, assertScanIsLive,
} from '../harness/editor.js';

/** A lever step, for the dialog block. Values only; no bound is stated here (B2). */
const LEVER_STEP = Object.freeze({
    name: 'Lever pull',
    pump: 'lever',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 25,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    pressure: 8,
    leverSpring: 0.4,
    leverGive: 0.8,
    limiter: { value: 0, range: 0.6 },
});

/** The value cell of one matrix row, which is the control that opens the keypad. */
const valueCell = (row, index) => `${matrixCell(row, index)} > ui-stepper >>> #value`;

/** Where the caret is, as an anchor path — the harness's own deep walk. */
const activePath = (page) => page.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

/**
 * The plot's canvas, in both coordinate systems. DEVICE px is what a rebuild bakes in
 * (uPlot sizes from the host it is constructed into), so a construction with no box is
 * visible here as a canvas that collapses to a couple of pixels; CSS px is what the
 * viewer sees. Both are read off the engine — nothing here reads a file (A8).
 */
const canvasSize = (page) => page.evalFn((sel) => {
    const canvas = window.__h.need(sel).renderRoot.querySelector('canvas');
    if (!canvas) return null;
    return {
        device: [canvas.width, canvas.height],
        css: [canvas.clientWidth, canvas.clientHeight],
    };
}, EDITOR.previewCard);

/** What this overlay region currently has open — one row per overlay, plus the census. */
const overlayState = (page) => page.evalFn((sel) => {
    const overlays = window.__h.need(sel);
    const dialogs = window.__h.deepAll().filter((el) => el.tagName === 'DIALOG');
    const flag = (id) => overlays.renderRoot.querySelector(id)?.open === true;
    return {
        total: dialogs.length,
        open: dialogs.filter((el) => el.open).length,
        numpad: flag('#numpad'),
        exit: flag('#exit'),
        lever: flag('#lever'),
    };
}, EDITOR.overlays);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`editor editing surfaces @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {
        const mounted = (fn, options = {}) => browser.withPage({ geometry }, async (page) => {
            await mountEditing(page, options);
            return fn(page);
        });

        /* =====================================================================
         * 1. THE PREVIEW IS A #9 INSTANCE, AND IT IS THE ONLY CHART (chart-C6)
         * =================================================================== */

        describe('the preview chart', () => {
            test('chart-C6 — every canvas in the editor is inside a ui-chart-card, and there is one card',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const census = await page.evalFn(() => {
                        const all = window.__h.deepAll();
                        const canvases = all.filter((el) => el.tagName === 'CANVAS');
                        const cards = all.filter((el) => el.tagName === 'UI-CHART-CARD');
                        /* An ancestor walk that CROSSES SHADOW BOUNDARIES: a canvas in a
                         * private plot would have no card above it in any tree. */
                        const housed = canvases.filter((canvas) => {
                            let node = canvas;
                            while (node) {
                                if (node.tagName === 'UI-CHART-CARD') return true;
                                node = node.parentElement ?? node.parentNode?.host ?? null;
                            }
                            return false;
                        });
                        return { canvases: canvases.length, cards: cards.length, housed: housed.length };
                    });
                    assert.ok(census.canvases > 0, 'the preview must actually have drawn a canvas');
                    assert.equal(census.housed, census.canvases,
                        'chart-C6: a canvas outside a chart card is a second chart implementation');
                    assert.equal(census.cards, 1, 'the editor contributes exactly one chart');
                }));

            test('the card is a real plot at its own floor, and the plot host has no padding',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const counts = await chartCounts(page);
                    assert.equal(counts.hasPlot, true, 'the preview built a plot when it was shown');
                    assert.equal(counts.empty, false, 'a profile with steps is not an empty chart');

                    const floor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
                    const box = await page.box(EDITOR.previewCard);
                    assert.ok(box.height >= floor,
                        `the card is below its own floor: ${box.height} < ${floor}`);

                    /* chart-C3's rule, inherited by MOUNTING the card rather than building
                     * a well around it: a plot host has no padding. */
                    const plot = await page.computed(EDITOR.previewPlot,
                        ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']);
                    for (const [side, value] of Object.entries(plot)) {
                        assert.equal(px(value), 0, `the plot host has ${side} ${value}`);
                    }
                }));

            test('E12 — N edits with the preview showing rebuild the plot ZERO times, and the data moves each time',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const before = await chartCounts(page);
                    const seen = [];
                    for (let i = 0; i < 8; i += 1) {
                        await page.evalFn((v) => window.__editor.apply(0, 'seconds', v), 12 + i * 3);
                        await page.settle(3);
                        seen.push({
                            counts: await chartCounts(page),
                            data: await chartData(page),
                        });
                    }
                    const last = seen[seen.length - 1];
                    assert.equal(last.counts.build - before.build, 0,
                        'E12: the plot was CONSTRUCTED during editing — "a fresh 1×1 canvas per edit"');
                    assert.ok(last.counts.paint > before.paint,
                        'the chart must still be drawing; zero paints here would mean a dead preview');

                    const xs = seen.map((row) => row.data.lastX);
                    assert.equal(new Set(xs).size, xs.length,
                        `the data did not change on every edit: ${xs.join(', ')}`);
                    for (const row of seen) {
                        assert.equal(row.data.derivationOk, true, 'the card kept a real derivation');
                    }
                }));

            test('E12 — with the preview on a hidden tab, N edits cost ZERO paints and ZERO builds, and showing it again catches up',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    await page.settle(3);
                    /* Back to the tab the editing happens on. The tab bar owns `hidden`;
                     * this suite never writes it. */
                    await selectPanel(page, 'steps');
                    await page.settle(4);

                    const before = await chartCounts(page);
                    const beforeData = await chartData(page);
                    for (let i = 0; i < 8; i += 1) {
                        await page.evalFn((v) => window.__editor.apply(0, 'seconds', v), 40 + i * 5);
                        await page.settle(3);
                    }
                    const during = await chartCounts(page);
                    assert.equal(during.build - before.build, 0,
                        'E12: the hidden preview was rebuilt — this is the "no activeTab guard" defect');
                    assert.equal(during.paint - before.paint, 0,
                        'E12: the hidden preview DREW — a background tab must not render at all');
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).deferred, EDITOR.preview), true,
                        'the preview should be holding a derivation it could not draw');

                    await selectPanel(page, 'review');
                    await page.settle(5);
                    const after = await chartCounts(page);
                    const afterData = await chartData(page);
                    assert.equal(after.build - before.build, 0,
                        'coming back into view must not construct a new plot either');
                    assert.ok(after.paint > during.paint, 'the preview must catch up when it is shown');
                    assert.notEqual(afterData.lastX, beforeData.lastX,
                        'the preview came back showing the data from before the edits');
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).deferred, EDITOR.preview), false,
                        'nothing should still be held back once the panel has a box',
                    );
                }));

            test('the rebuild counter is ALIVE — a theme change does construct a new plot',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const before = await chartCounts(page);
                    /* FLIP AWAY FROM WHATEVER THE PAGE IS ON. The harness mounts on the
                     * dark theme, so asking for dark again is a no-op that would make
                     * this test pass for the wrong reason if it asserted the inverse. */
                    const current = await page.eval("document.documentElement.getAttribute('data-theme')");
                    await page.setTheme(current === 'light' ? 'dark' : 'light');
                    await page.settle(6);
                    const after = await chartCounts(page);
                    assert.ok(after.build > before.build,
                        'uPlot bakes its axis colours in at construction, so a retheme MUST rebuild — '
                        + 'a counter that never moves would make the zeroes above meaningless');
                    await page.setTheme(current);
                }));

            test('E12 — a theme change while the preview is HIDDEN neither rebuilds nor paints, and lands when it is shown',
                () => mounted(async (page) => {
                    /* THE OTHER REBUILD TRIGGER. The data gate above covers ± presses,
                     * numpad commits and mode changes; uPlot also bakes its axis and grid
                     * colours in AT CONSTRUCTION, so a retheme is a construction too —
                     * and it reaches the card through the surface's own observer on the
                     * document root, without passing through <editor-preview> at all.
                     * Ungated it allocated a 2×2 device / 0×0 CSS canvas on a hidden tab,
                     * which is §7.4 E12's "fresh 1×1 canvas" down the theme path. */
                    await selectPanel(page, 'review');
                    await page.settle(3);
                    await selectPanel(page, 'steps');
                    await page.settle(4);

                    const before = await chartCounts(page);
                    const beforeCanvas = await canvasSize(page);
                    assert.ok(beforeCanvas, 'the preview must have a canvas before this proves anything');

                    const current = await page.eval("document.documentElement.getAttribute('data-theme')");
                    await page.setTheme(current === 'light' ? 'dark' : 'light');
                    await page.settle(6);

                    const during = await chartCounts(page);
                    const duringCanvas = await canvasSize(page);
                    assert.equal(during.build - before.build, 0,
                        'E12: a theme change REBUILT the hidden preview — that is a uPlot construction into a box that is not there');
                    assert.equal(during.paint - before.paint, 0,
                        'E12: the hidden preview PAINTED on a theme change');
                    assert.deepEqual(duringCanvas.device, beforeCanvas.device,
                        `the hidden retheme reallocated the canvas: ${beforeCanvas.device.join('×')} -> ${duringCanvas.device.join('×')}`);
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).paletteDeferred, EDITOR.previewCard), true,
                        'the palette move must be HELD, not dropped — a stale chart is the other failure',
                    );

                    await selectPanel(page, 'review');
                    await page.settle(6);
                    const after = await chartCounts(page);
                    assert.ok(after.build > during.build,
                        'the deferred theme change must land the moment the panel has a box');
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).paletteDeferred, EDITOR.previewCard), false,
                        'nothing may still be held once there is a box',
                    );
                    const shownCanvas = await canvasSize(page);
                    assert.ok(shownCanvas.css[0] > 0 && shownCanvas.css[1] > 0,
                        `the plot came back at ${shownCanvas.css.join('×')} CSS px`);

                    /* AND IT REBUILT IN THE THEME THAT IS ACTUALLY ON SCREEN, which is
                     * the whole reason a retheme is a construction. */
                    const palette = await page.evalFn(async (sel) => {
                        const card = window.__h.need(sel);
                        const mod = await import('/src/lib/chart-tokens.js');
                        const style = getComputedStyle(card);
                        const built = card.chartTokens?.channels ?? {};
                        return Object.keys(built).map((name) => ({
                            name, built: built[name], token: style.getPropertyValue(mod.channelToken(name)).trim(),
                        }));
                    }, EDITOR.previewCard);
                    assert.ok(palette.length > 0, 'the card read no channel colours at all');
                    for (const row of palette) {
                        assert.equal(row.built, row.token,
                            `channel ${row.name} is still on the previous theme: ${row.built} vs ${row.token}`);
                    }
                    await page.setTheme(current);
                }));

            test('chart-C5 — every channel colour the plot was built from is the token, not a literal',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const report = await page.evalFn(async (sel) => {
                        const card = window.__h.need(sel);
                        const mod = await import('/src/lib/chart-tokens.js');
                        const style = getComputedStyle(card);
                        const built = card.chartTokens?.channels ?? {};
                        const rows = Object.keys(built).map((name) => ({
                            name,
                            built: built[name],
                            token: style.getPropertyValue(mod.channelToken(name)).trim(),
                        }));
                        return { rows, drawn: card.channels.map((c) => c.key) };
                    }, EDITOR.previewCard);

                    assert.ok(report.rows.length > 0, 'the card read no channel colours at all');
                    for (const row of report.rows) {
                        assert.equal(row.built, row.token,
                            `channel ${row.name} was built with ${row.built} but its token computes to ${row.token}`);
                        assert.ok(row.built.length > 0, `channel ${row.name} resolved to nothing`);
                    }
                    assert.deepEqual(report.drawn, ['targetPressure', 'targetFlow'],
                        'the preview draws the two channels its own producer declares');
                }));

            test('chart-C5 — moving a channel token moves what the next build reads',
                () => mounted(async (page) => {
                    await selectPanel(page, 'review');
                    const before = await page.evalFn((sel) => window.__h.need(sel).chartTokens.channels['target-pressure'], EDITOR.previewCard);
                    await page.setToken('--ui-channel-target-pressure', DRILL_COLOUR);
                    await page.evalFn((sel) => window.__h.need(sel).refreshPalette(), EDITOR.previewCard);
                    await page.settle(4);
                    const after = await page.evalFn((sel) => window.__h.need(sel).chartTokens.channels['target-pressure'], EDITOR.previewCard);
                    await page.setToken('--ui-channel-target-pressure', '');
                    assert.notEqual(after, before, 'the palette is not read from CSS at all');
                    assert.equal(after, DRILL_COLOUR,
                        'A6: the chart must paint what the token says, so a fork retargets the sheet');
                }));
        });

        /* =====================================================================
         * 2. THE TWO DIALOGS — O6, O8, AND THE PRESET INVARIANT
         * =================================================================== */

        describe('the editor dialogs', () => {
            const openLever = async (page) => {
                await page.evalFn((sel) => window.__h.need(sel).openLever({ index: 0 }), EDITOR.overlays);
                await page.settle(4);
            };

            test('O6 — one native dialog per overlay, and exactly one of them is OPEN',
                () => mounted(async (page) => {
                    await openLever(page);
                    const count = await page.evalFn(() => {
                        const all = window.__h.deepAll().filter((el) => el.tagName === 'DIALOG');
                        const hostOf = (el) => el.getRootNode()?.host?.tagName ?? '';
                        return {
                            total: all.length,
                            open: all.filter((el) => el.open).length,
                            /* THE O6 CLAIM ITSELF, asked directly: every native dialog on
                             * the page is inside a #18. Seven implementations became one
                             * component, and a <dialog> whose shadow host is anything else
                             * is the second machinery coming back. */
                            foreign: all.filter((el) => hostOf(el) !== 'UI-DIALOG')
                                .map((el) => `${hostOf(el) || 'document'}#${el.id}`),
                        };
                    });
                    assert.deepEqual(count.foreign, [],
                        'a native dialog that is not inside a ui-dialog is a second machinery (O6)');
                    /* THE OVERLAY REGION HOLDS THREE OVERLAYS — the keypad and the two
                     * dialogs — and each contributes exactly ONE native dialog, closed
                     * until it is asked for. O6's defect is seven IMPLEMENTATIONS, not
                     * three instances of one: every one of these is #18. */
                    const overlays = await page.evalFn((sel) => (
                        window.__h.need(sel).renderRoot.querySelectorAll('*').length > 0
                            ? [...window.__h.need(sel).renderRoot.children].length
                            : 0
                    ), EDITOR.overlays);
                    /* THE OVERLAYS' THREE, PLUS THE SCREEN'S OWN ONE. `<editor-screen>`
                     * gained a rename dialog with the header's identity block (cmp-seh-3,
                     * fix run 4) — the pencil's minimal name editor, driving the same save
                     * path the band does. It is a #18 like the other three (asserted
                     * above), it is closed until the pencil is pressed, and it lives in
                     * the screen rather than in the overlay region because it is the
                     * screen's own affordance and takes no track either way. */
                    /* AND ITS SECOND, 23 Aug 2026: the DISCARD guard. Cancel appears only
                     * at a dirty count and used to do nothing at all, which left a dirty
                     * editor with no way out except saving a version nobody wanted. The
                     * guard is what makes Cancel safe to wire, and it is a #18 like the
                     * other four. */
                    /* AND ITS THIRD, 24 Aug 2026: PREVIOUS VERSIONS. Ben — "Can we add it
                     * to the editor as well, could be useful to be able to undo a change
                     * etc." It is a #18 like the other five, closed until the header
                     * control is pressed, and it reads the LIBRARY store rather than
                     * calling the lineage route itself. */
                    assert.equal(count.total, overlays + 3,
                        `each overlay must own one #18 and no second machinery, and the screen owns `
                        + `the rename and the discard guard: ${count.total} dialogs for ${overlays} `
                        + `overlays + 2`);
                    assert.equal(count.open, 1, 'exactly one modal may be open at a time');
                    assert.equal(await page.exists(EDITOR.leverCard), true, 'and the open one is #18\'s');
                }, { steps: [{ ...LEVER_STEP }] }));

            test('the dialog body is a real scroll region and the card is bounded by the viewport',
                () => mounted(async (page) => {
                    await openLever(page);
                    const body = await page.computed(`${EDITOR.leverShell} >>> #body`, ['overflow-y']);
                    assert.equal(body['overflow-y'], 'auto', '§4.6: the body overflow is mandatory');
                    const card = await page.box(EDITOR.leverCard);
                    assert.ok(card.height <= geometry.height,
                        `the dialog card is taller than the screen: ${card.height} > ${geometry.height}`);
                    assert.ok(card.width <= geometry.width,
                        `the dialog card is wider than the screen: ${card.width} > ${geometry.width}`);
                }, { steps: [{ ...LEVER_STEP }] }));

            test('O8 — the page behind the dialog is really inert: a press on the matrix changes nothing',
                () => mounted(async (page) => {
                    const cell = `${matrixCell("temperature", 0)} > ui-stepper >>> #increment`;
                    await openLever(page);
                    const before = await editorEvents(page);
                    await page.click(cell);
                    await page.settle(3);
                    const after = await editorEvents(page);
                    assert.deepEqual(after, before,
                        'O8: the background took a press while a modal was open — inert is not doing its job');
                }, { steps: [{ ...LEVER_STEP }] }));

            test('O8 — the trap holds under real Tab presses, and Escape closes through the shell',
                () => mounted(async (page) => {
                    await openLever(page);
                    const inside = [];
                    for (let i = 0; i < 12; i += 1) {
                        await page.press('Tab');
                        inside.push(await activePath(page));
                    }
                    for (const path of inside) {
                        assert.match(path, /editor-lever-dialog/,
                            `the caret left the dialog: ${path}`);
                    }
                    await page.press('Escape');
                    await page.settle(3);
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.leverDialog), false,
                        'Escape must close the dialog — #18 owns it and O8 is the dialog that had none',
                    );
                }, { steps: [{ ...LEVER_STEP }] }));

            test('the caret comes back to the control that opened the keypad',
                () => mounted(async (page) => {
                    const cell = valueCell('temperature', 0);
                    await page.click(cell);
                    await page.settle(4);
                    assert.match(await activePath(page), /ui-numeric-keypad|ui-dialog/,
                        'the caret should be inside the keypad while it is open');
                    await page.press('Escape');
                    await page.settle(4);
                    const back = await activePath(page);
                    assert.match(back, /step-matrix/,
                        `the caret did not return to the matrix cell that opened it: ${back}`);
                }));

            test('THE PRESET INVARIANT — every lever preset moves spring and give, and P0 not at all',
                () => mounted(async (page) => {
                    await openLever(page);
                    const p0Before = await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.leverP0);
                    const seen = [];
                    for (const index of [0, 1, 2]) {
                        await page.click(`${EDITOR.leverPresetBank} >>> #item-${index}`);
                        await page.settle(3);
                        seen.push({
                            draft: await page.evalFn((sel) => window.__h.need(sel).draft, EDITOR.leverDialog),
                            preset: await page.evalFn((sel) => window.__h.need(sel).preset, EDITOR.leverDialog),
                            p0: await page.evalFn((sel) => window.__h.need(sel).textContent.trim(), EDITOR.leverP0),
                            step: await page.evalFn(() => window.__editor.draft.steps[0].pressure),
                        });
                    }

                    for (const row of seen) {
                        assert.deepEqual(Object.keys(row.draft).sort(), ['leverGive', 'leverSpring'],
                            `a preset wrote something other than the two feel legs: ${JSON.stringify(row.draft)}`);
                        assert.equal(row.p0, p0Before,
                            'P0 moved when a feel preset was picked — "P0 is the barista\'s recipe"');
                        assert.equal(row.step, 8, 'the draft\'s own P0 moved');
                    }
                    const feels = seen.map((row) => `${row.draft.leverSpring}/${row.draft.leverGive}`);
                    assert.equal(new Set(feels).size, 3, `the three presets are not distinct: ${feels.join(' ')}`);
                    assert.deepEqual(seen.map((row) => row.preset), ['CLASSIC', 'GENTLE', 'FIRM'],
                        'the inferred feel must follow the pick, and inference is on spring+give alone');

                    await page.click(`${EDITOR.leverDialog} >>> #confirm`);
                    await page.settle(3);
                    const events = await editorEvents(page);
                    const change = events.filter((e) => e.event === 'lever-change').pop();
                    assert.ok(change, 'confirming the lever dialog must report the change');
                    assert.deepEqual(Object.keys(change).sort(),
                        ['event', 'index', 'leverGive', 'leverSpring'],
                        `the lever event carries more than the feel: ${JSON.stringify(change)}`);
                }, { steps: [{ ...LEVER_STEP }] }));

            /* THE READING IS ANNOUNCED, not merely displayed — the half the invariant
             * above cannot see. #43 makes its slotted glyphs aria-hidden the instant a
             * `label` is set, so a label repeating the caption ALREADY beside the box
             * announced that caption and hid the one value this dialog exists to protect.
             * The invariant above reads `textContent`, which stayed correct the whole
             * time; only Chrome's tree is a witness to what a screen reader is told.
             *
             * NOT a role-filtered walk: a visually-hidden reading is StaticText inside a
             * generic box and carries no role of its own, so `accessibleNames` — right for
             * "what is this control called" — cannot see it either way, which is exactly
             * how this survived. The expected string is READ OFF THE RENDERED BOX rather
             * than typed, so the number stays the step's and the unit stays the door's. */
            test('the P0 reading reaches the accessibility tree, not just the screen',
                () => mounted(async (page) => {
                    await openLever(page);
                    const shown = await page.evalFn(
                        (sel) => window.__h.need(sel).textContent.trim(), EDITOR.leverP0,
                    );
                    assert.match(shown, /\d/,
                        `the P0 box is showing no reading at all: "${shown}"`);

                    const spoken = await accessibleText(page);
                    assert.ok(spoken.some((text) => text.includes(shown)),
                        `the P0 reading "${shown}" appears in NO accessible name or value: the box's `
                        + 'glyphs are aria-hidden and its label carries a caption instead of the '
                        + `reading, so the value is announced to nobody. Tree: ${JSON.stringify(spoken)}`);
                }, { steps: [{ ...LEVER_STEP }] }));

            test('THE ROUTES ARBITRATE — opening one overlay closes whatever else this region had open',
                () => mounted(async (page) => {
                    /* "Exactly one open" was a property of the DRIVE and not of the code:
                     * the three public routes each showed their own overlay, so a
                     * composition root could stack three simultaneously-open native
                     * dialogs. #18 survives that state, but this region must not permit
                     * it. Driven through the public routes, which is the only way in — the
                     * page under an open #18 is inert, so no gesture can reach a second. */
                    await page.evalFn((sel) => window.__h.need(sel).openLever({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);
                    let state = await overlayState(page);
                    assert.equal(state.open, 1, 'the lever route did not leave exactly one dialog open');
                    assert.equal(state.lever, true, 'and the open one is the lever dialog');

                    await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);
                    state = await overlayState(page);
                    assert.equal(state.open, 1,
                        `the exit route stacked a dialog on the lever one: ${JSON.stringify(state)}`);
                    assert.equal(state.exit, true);
                    assert.equal(state.lever, false, 'the lever dialog was left open underneath');

                    await page.evalFn(
                        (sel) => window.__h.need(sel).openNumpad({ field: 'targetWeight' }), EDITOR.overlays,
                    );
                    await page.settle(4);
                    state = await overlayState(page);
                    assert.equal(state.open, 1,
                        `the numpad route stacked a third open dialog: ${JSON.stringify(state)}`);
                    assert.equal(state.numpad, true);
                    assert.equal(state.exit, false);

                    /* ONE Escape, not three: with one overlay open there is one to unwind,
                     * and the background comes back usable. */
                    await page.press('Escape');
                    await page.settle(4);
                    state = await overlayState(page);
                    assert.equal(state.open, 0, 'one Escape must leave the region with nothing open');

                    const before = await editorEvents(page);
                    await page.click(`${matrixCell('temperature', 0)} > ui-stepper >>> #increment`);
                    await page.settle(3);
                    assert.ok((await editorEvents(page)).length > before.length,
                        'the background never came back: something is still holding the page inert');
                }, { steps: [{ ...LEVER_STEP }] }));

            test('a REFUSED numpad leaves the open dialog alone — the arbitration follows the decision to open',
                () => mounted(async (page) => {
                    await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);
                    const opened = await page.evalFn(
                        (sel) => window.__h.need(sel).openNumpad({ field: 'tankTemperature' }), EDITOR.overlays,
                    );
                    await page.settle(3);
                    assert.equal(opened, false, 'the door was supposed to refuse this field');
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.exitDialog), true,
                        'a refusal that opens nothing must not close the edit already in progress (A7)',
                    );
                }));

            test('O5 — the dialog seeds a LIVE exit, and the falls-below floor is the door\'s own increment',
                () => mounted(async (page) => {
                    await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);

                    /* THE STEP HAS NO EXIT, so every number below is one this dialog
                     * INVENTED. `exit-validity.js` is the module its own header cites:
                     * "a falls-below threshold floors at one increment rather than zero,
                     * so the dead state cannot be dialled in at all". No bound and no
                     * increment is typed here — both are read from the door (B2). */
                    const seeded = await page.evalFn(async (sel) => {
                        const dialog = window.__h.need(sel);
                        const stepper = dialog.renderRoot.querySelector('#value');
                        const validity = await import('/src/lib/exit-validity.js');
                        const modes = await import('/src/lib/profile-modes.js');
                        const declared = modes.exitRange(dialog.draft.type);
                        return {
                            draft: dialog.draft,
                            dead: validity.deadExitReason(dialog.draft),
                            min: stepper.min,
                            declaredMin: declared.min,
                        };
                    }, EDITOR.exitDialog);

                    assert.equal(seeded.draft.condition, 'over',
                        'a step with no exit seeds the rising direction');
                    assert.equal(seeded.dead, null,
                        `O5: the dialog SEEDED a provably dead exit — "${seeded.dead}"`);
                    assert.equal(seeded.min, seeded.declaredMin,
                        '"rises past" keeps the door\'s own zero: the value is reachable and the flag explains it');

                    await page.click(`${EDITOR.exitDialog} >>> #direction >>> #item-1`);
                    await page.settle(4);
                    const under = await page.evalFn(async (sel) => {
                        const dialog = window.__h.need(sel);
                        const stepper = dialog.renderRoot.querySelector('#value');
                        const validity = await import('/src/lib/exit-validity.js');
                        const modes = await import('/src/lib/profile-modes.js');
                        const declared = modes.exitRange(dialog.draft.type);
                        return {
                            draft: dialog.draft,
                            dead: validity.deadExitReason(dialog.draft),
                            min: stepper.min,
                            expected: validity.exitValueMin('under', declared.step),
                        };
                    }, EDITOR.exitDialog);

                    assert.equal(under.draft.condition, 'under', 'the direction bank did not move the draft');
                    assert.equal(under.min, under.expected,
                        'the falls-below floor is not the door\'s own increment — "under 0" is still dialable');
                    assert.ok(under.draft.value >= under.min,
                        `the draft sits below its own floor: ${under.draft.value} < ${under.min}`);
                    assert.equal(under.dead, null,
                        `O5: switching direction dialled in the dead state — "${under.dead}"`);

                    await page.click(`${EDITOR.exitDialog} >>> #confirm`);
                    await page.settle(3);
                    /* BY THE EVENT NAME, which is now a field no payload can reach. This
                     * filtered on `slot` while the recorder's discriminator lived under
                     * `type` and this event's detail carried its own `type` (the exit
                     * channel) that won the spread — `slot` was the part of the address
                     * that survived. The recorder now writes `event` last (harness
                     * `record()`), so the row is addressable by what it IS, and `type`
                     * below is unambiguously the channel. */
                    const change = (await editorEvents(page))
                        .filter((e) => e.event === 'exit-condition-change').pop();
                    assert.ok(change, 'confirming the exit dialog reported nothing');
                    const emitted = await page.evalFn(async (payload) => {
                        const validity = await import('/src/lib/exit-validity.js');
                        return validity.deadExitReason(payload);
                    }, { type: change.type, condition: change.condition, value: change.value });
                    assert.equal(emitted, null,
                        `O5: the dialog emitted an exit that can never fire — ${JSON.stringify(change)}`);
                }));

            test('the exit dialog takes its bounds from the door, and they move with the exit type',
                () => mounted(async (page) => {
                    await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);

                    const report = await page.evalFn(async (sel) => {
                        const dialog = window.__h.need(sel);
                        const stepper = dialog.renderRoot.querySelector('#value');
                        const bank = dialog.renderRoot.querySelector('#type');
                        const mod = await import('/src/lib/profile-modes.js');
                        const type = dialog.draft.type;
                        const declared = mod.exitRange(type);
                        return {
                            type,
                            offered: bank.items.map((item) => item.value),
                            control: { min: stepper.min, max: stepper.max, step: stepper.step, unit: stepper.unit },
                            declared: { min: declared.min, max: declared.max, step: declared.step, unit: declared.unit },
                        };
                    }, EDITOR.exitDialog);

                    assert.deepEqual(report.control, report.declared,
                        'B2: the exit threshold control disagrees with the one table');
                    assert.ok(report.offered.length > 0, 'a step with no offered exit type is not editable');
                }));

            /* THE ONE OUTCOME, ASSERTED AS ITSELF, and nothing in this wave did that.
             * The suite tested the dialog's bounds and its dead-state seeding; the event
             * it reports was reachable only SIDEWAYS, by `slot`, because the recorder's
             * discriminator lived under `type` and this detail carries its own `type`
             * (the exit channel) that won the spread. A filter on the event name matched
             * nothing and matched it silently. Both halves are pinned here: the frame
             * field survives the payload, and `type` is the CHANNEL, not the event name.
             * If the recorder ever regresses, the length check below is what goes red. */
            test('the exit dialog reports ONE outcome, and it carries the whole address',
                () => mounted(async (page) => {
                    await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                    await page.settle(4);

                    /* The channel and the threshold come off the dialog's OWN draft. A
                     * spelling typed here would be this cluster restating what the door
                     * and profile-modes.js already own. */
                    const draft = await page.evalFn(
                        (sel) => ({ ...window.__h.need(sel).draft }), EDITOR.exitDialog,
                    );

                    await page.click(`${EDITOR.exitDialog} >>> #confirm`);
                    await page.settle(3);

                    const rows = await eventsNamed(page, 'exit-condition-change');
                    assert.equal(rows.length, 1,
                        `confirming the exit dialog recorded ${rows.length} rows under its own event `
                        + 'name, not one — a name filter that matches nothing is the defect this pins');

                    const [change] = rows;
                    assert.deepEqual(Object.keys(change).sort(),
                        ['condition', 'event', 'index', 'slot', 'type', 'value'],
                        `the outcome's address changed shape: ${JSON.stringify(change)}`);
                    assert.equal(change.type, draft.type,
                        'the exit CHANNEL did not survive the recorder: the payload key was being '
                        + 'overwritten by the event name, so every row read back as the same channel');
                    assert.equal(change.slot, 'condition', 'the address lost its slot');
                    assert.equal(change.index, 0, 'the outcome names the wrong step');
                    assert.equal(change.condition, draft.condition, 'the direction did not travel');
                    assert.equal(change.value, draft.value, 'the threshold did not travel');
                }));
        });

        /* =====================================================================
         * 3. THE NUMPAD FLOWS — B2 THROUGH THE KEYPAD, O9, O10
         * =================================================================== */

        describe('the numpad flows', () => {
            test('a matrix value cell opens an ARMED keypad whose hint is the table\'s own entry',
                () => mounted(async (page) => {
                    await page.click(valueCell('temperature', 0));
                    await page.settle(4);

                    assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad), true,
                        'the value cell did not open the keypad');
                    const report = await numpadRangeReport(page);
                    assert.equal(report.ranged, true,
                        'the keypad opened UNARMED — its unavailable panel is not an editing surface');
                    assert.equal(report.hint, report.declaredLabel,
                        'the hint is not the range the keypad was handed');

                    /* AND THE ENTRY IS THE DOOR'S. The cell beside it is bounded by the
                     * same object, which is the whole of B2: one table, one entry. */
                    const door = await page.evalFn(async (sel) => {
                        const cell = window.__h.need(sel);
                        return { min: cell.min, max: cell.max, step: cell.step };
                    }, `${matrixCell('temperature', 0)} > ui-stepper`);
                    assert.deepEqual(
                        { min: report.min, max: report.max, step: report.step }, door,
                        'B2: the keypad and the stepper disagree about the same field',
                    );
                }));

            test('the routes survive a RE-PARENT: reconnecting re-attaches the listeners',
                () => mounted(async (page) => {
                    /* `updated()` attaches only when `source` CHANGES and the disconnect
                     * detaches unconditionally, so a re-parent with `source` untouched
                     * left every editing gesture unrouted — `source` still truthy, the
                     * press opening nothing, and no error anywhere to find it by. */
                    const cell = valueCell('temperature', 0);
                    await page.click(cell);
                    await page.settle(4);
                    assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad), true,
                        'the first press did not open the keypad');
                    await page.press('Escape');
                    await page.settle(4);

                    const state = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const parent = el.parentElement;
                        el.remove();
                        parent.appendChild(el);
                        return { hasSource: Boolean(el.source), connected: el.isConnected };
                    }, EDITOR.overlays);
                    await page.settle(4);
                    assert.equal(state.hasSource, true, 'the re-parent was supposed to leave `source` alone');
                    assert.equal(state.connected, true, 'the element did not come back into the document');

                    await page.click(cell);
                    await page.settle(4);
                    assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad), true,
                        'a reconnected overlay region routes nothing: every editing gesture is dead, silently');
                }));

            test('the round trip lands: type a value, confirm, and the commit carries its address',
                () => mounted(async (page) => {
                    await page.click(valueCell('temperature', 0));
                    await page.settle(4);
                    await typeNumpad(page, '93');

                    const events = await editorEvents(page);
                    const commit = events.filter((e) => e.event === 'value-commit').pop();
                    assert.ok(commit, 'confirming the keypad reported nothing');
                    assert.equal(commit.value, 93, 'the clamped value did not arrive');
                    assert.equal(commit.origin, 'matrix');
                    assert.equal(commit.index, 0);
                    assert.equal(commit.row, 'temperature');
                    assert.equal(
                        await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad), false,
                        'the keypad stayed open after a confirm',
                    );
                }));

            test('a settings field row opens the same keypad, through the same door',
                () => mounted(async (page) => {
                    await selectPanel(page, 'settings');
                    await page.click(`${EDITOR.settingsField} >>> #value`);
                    await page.settle(4);

                    const report = await numpadRangeReport(page);
                    assert.equal(report.ranged, true, 'the settings field opened an unarmed keypad');
                    assert.equal(report.limitKey, 'targetWeight',
                        'the keypad is editing a field nobody named');
                    assert.equal(report.hint, report.declaredLabel);

                    const declared = await page.evalFn(async () => {
                        const ranges = await import('/src/lib/editor-ranges.js');
                        const adapters = await import('/src/data/adapters-r.js');
                        const door = ranges.createEditorRanges({
                            machineLimits: adapters.r2MachineLimits([{ id: 'machine' }]).value,
                            machineClass: adapters.machineClassFromServedSet([{ id: 'machine' }]),
                        });
                        const entry = door.rangeFor('targetWeight');
                        return { min: entry.min, max: entry.max, step: entry.step };
                    });
                    assert.deepEqual({ min: report.min, max: report.max, step: report.step }, declared,
                        'B2: the settings keypad states a bound the door does not');

                    await typeNumpad(page, '40');
                    const commit = (await editorEvents(page)).filter((e) => e.event === 'value-commit').pop();
                    assert.equal(commit.origin, 'field');
                    assert.equal(commit.field, 'targetWeight');
                    assert.equal(commit.value, 40);
                }));

            test('a field the door refuses opens nothing and says why (A7)',
                () => mounted(async (page) => {
                    const opened = await page.evalFn(
                        (sel) => window.__h.need(sel).openNumpad({ field: 'tankTemperature' }),
                        EDITOR.overlays,
                    );
                    await page.settle(2);
                    assert.equal(opened, false, 'a refused field must not open a keypad');
                    assert.equal(await page.evalFn((sel) => window.__h.need(sel).open, EDITOR.numpad), false);
                    const refusal = (await editorEvents(page)).filter((e) => e.event === 'numpad-refused').pop();
                    assert.ok(refusal, 'the refusal was swallowed');
                    assert.ok(refusal.reason.length > 0, 'a refusal with no reason is not a report');
                }));

            test('O9 — the backspace key has an accessible name in Chrome\'s own tree',
                () => mounted(async (page) => {
                    await page.click(valueCell('temperature', 0));
                    await page.settle(4);
                    const named = await page.evalFn((sel) => {
                        const pad = window.__h.need(sel);
                        const key = pad.renderRoot.querySelector('#key-backspace');
                        return { label: key.getAttribute('aria-label') ?? '' };
                    }, EDITOR.numpad);
                    assert.ok(named.label.length > 0, 'O9: the backspace key is unlabelled');

                    const buttons = await accessibleNames(page, ['button']);
                    assert.ok(buttons.some((node) => node.name === named.label),
                        `O9: the engine computes no name for the backspace: ${JSON.stringify(buttons.slice(0, 8))}`);
                }));

            test('O10 — the keypad title\'s size is a token, and nothing writes an inline size on it',
                () => mounted(async (page) => {
                    await page.click(valueCell('temperature', 0));
                    await page.settle(4);

                    const title = await page.computed(EDITOR.numpadTitle, ['font-size']);
                    const token = await page.resolveToken('--ui-text-xl', 'font-size');
                    near(px(title['font-size']), px(token), 'O10: the keypad title is not on the type token');

                    const inline = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        return { fontSize: el.style.fontSize, attr: el.getAttribute('style') ?? '' };
                    }, EDITOR.numpadTitle);
                    assert.equal(inline.fontSize, '',
                        'O10: the title carries an inline font-size — "the one piece of type whose size is not a token"');
                }));

            test('the armed keypad card is the same box at both geometries',
                () => mounted(async (page) => {
                    await page.click(valueCell('temperature', 0));
                    await page.settle(4);
                    assert.equal((await numpadRangeReport(page)).ranged, true,
                        'measure an ARMED keypad or measure nothing');
                    const card = await page.box(EDITOR.numpadCard);
                    near(card.width, 820, 'the armed keypad card width');
                    assert.ok(card.height > 400,
                        `the armed card collapsed to ${card.height} — that is the unavailable panel's height`);
                }));
        });

        /* =====================================================================
         * 5. NO DEAD RULE IN THE EDITING SURFACES' OWN SHEETS  (E4, and P9)
         *
         * §7.4 E4: "Eight CSS rules whose selectors cannot match, eight
         * emitted-but-unstyled classes, and a dead `data-pe-mode` attribute hook."
         *
         * The five roots this stage mounts — the matrix, the preview, the overlay
         * region and the two dialogs. The shell's other four are scanned in
         * `editor-skeleton.render.test.mjs`; together the two cover all nine of
         * the editor's components, which is E4's whole surface.
         *
         * THE STATES ARE ENTERED, NOT ASSUMED. `.cell > ui-locked-value` matches
         * only on a step that HOLDS its target, so the stage below is seeded with
         * one; the dialogs' rows only exist while a dialog is open, so both are
         * opened. A rule judged at rest is a live rule reported dead, and a
         * deletion is the next thing that happens to it.
         *
         * THE TWO DIALOGS SHARE ONE SHEET (`dialogRows`, in
         * `editor-dialog-parts.js`), and the scan keys sheets by identity — so
         * `.note`, which only the lever dialog emits, counts as live for both
         * rather than reading as dead in the exit dialog.
         *
         * OUT OF SCOPE, DELIBERATELY: `ui-numeric-keypad`'s own sheet. The keypad
         * is #53, a wave-4 library component rather than one of the editor's nine,
         * and its `.previous` block is armed by a `previous` property this screen
         * never sets. Scanning it here would report a wave-4 component's
         * unarmed state as an editor defect.
         * =================================================================== */

        test('E4: no rule in the five editing sheets is unmatchable, in any state',
            () => mounted(async (page) => {
                const HOSTS = [
                    EDITOR.matrix, EDITOR.preview, EDITOR.overlays,
                    EDITOR.exitDialog, EDITOR.leverDialog,
                ];

                /* THE CANARY FIRST — E8's lesson pointed at the test. A scan walking
                 * nothing finds nothing dead and passes. */
                await assertScanIsLive(page, HOSTS);

                const census = ruleCensus();
                census.add(await scanRules(page, HOSTS), 'steps');
                await selectPanel(page, 'review');
                census.add(await scanRules(page, HOSTS), 'review');
                await selectPanel(page, 'steps');

                await page.evalFn((sel) => window.__h.need(sel).openLever({ index: 0 }), EDITOR.overlays);
                await page.settle(4);
                census.add(await scanRules(page, HOSTS), 'lever-open');
                await page.press('Escape');
                await page.settle(3);

                await page.evalFn((sel) => window.__h.need(sel).openExitCondition({ index: 0 }), EDITOR.overlays);
                await page.settle(4);
                census.add(await scanRules(page, HOSTS), 'exit-open');
                await page.press('Escape');
                await page.settle(3);

                /* AND THE STEP NAME BEING EDITED, which is the state this sweep did not
                 * enter — so `.head-line > .name` and `.cell > ui-text-field` were reported
                 * dead while the field they style is live the moment a name is tapped.
                 * That is the exact failure mode the paragraph above warns about ("a rule
                 * judged at rest is a live rule reported dead, and a deletion is the next
                 * thing that happens to it"), and it very nearly was. */
                await page.evalFn((sel) => { window.__h.need(sel)._editing = 0; }, EDITOR.matrix);
                await page.settle(4);
                census.add(await scanRules(page, HOSTS), 'name-editing');
                await page.evalFn((sel) => { window.__h.need(sel)._editing = null; }, EDITOR.matrix);
                await page.settle(3);

                /* AND THE MATRIX WITH NO STEPS AT ALL (audit F-033). `button.filler.empty`
                 * is the add door's zero-step face: on a profile with no steps there is no
                 * column, no action rail and therefore no "Insert step after" key, so that
                 * one rule styles the ONLY control on the screen and the only way out of
                 * the dead end Ben reported on 27 August. It can match in no other state.
                 * Exactly the case the paragraph above is about. */
                await page.evalFn((sel) => {
                    const matrix = window.__h.need(sel);
                    window.__heldSteps = matrix.steps;
                    matrix.steps = [];
                    return true;
                }, EDITOR.matrix);
                await page.settle(4);
                census.add(await scanRules(page, HOSTS), 'no-steps');
                await page.evalFn((sel) => {
                    window.__h.need(sel).steps = window.__heldSteps;
                    return true;
                }, EDITOR.matrix);
                await page.settle(3);

                const sheets = census.sheets();
                assert.equal(sheets.length, 4,
                    'four sheets for five roots: the two dialogs share `dialogRows` and nothing else does');

                for (const sheet of sheets) {
                    const where = sheet.hosts.join(' + ');
                    assert.ok(sheet.rules > 0,
                        `${where}: the scan found no rule at all — it is walking the wrong sheet`);
                    assert.deepEqual(sheet.dead, [],
                        `${where} carries a selector that matches nothing in any state — `
                        + 'E4\'s "eight CSS rules whose selectors cannot match"');
                    assert.deepEqual(sheet.duplicated, [],
                        `${where} declares a selector twice at the same condition (P9)`);
                }
            }, {
                /* A HOLDING STEP, so the locked-value rule has something to select, and
                 * a lever step so the lever dialog opens onto its own rows. Values only
                 * — B2: no bound is stated here.
                 *
                 * AND A PLAIN FLOW STEP, added at parity surface 4 and by this test's
                 * own instruction. The matrix now carries five channel-ink rules keyed
                 * on data-channel, and the four steps above reach only four of them: a
                 * HOLDING step draws #43 in the Target cell rather than a stepper, so
                 * the seed had no flow TARGET anywhere and E4 reported
                 * ui-stepper[data-channel="flow"] dead. It is the commonest cell in the
                 * screen — editor--steps photographs two of them — which is exactly the
                 * case this test's own header warns about: "a rule judged at rest is a
                 * live rule reported dead, and a deletion is the next thing that happens
                 * to it". The state set gets the step; the rule stays.
                 *
                 * AND A POWER STEP, 25 August 2026, by the same instruction and the same
                 * mechanism. The head cell gained a mode line with a tone per pump, so
                 * `.mode[data-tone="power"]` became a real rule — and POWER was the one
                 * mode no seeded step carried, so E4 reported it dead the first time the
                 * suite ran after the wiring. It is authorable on this machine (the
                 * served caps are 15, all four bits), so the seed grows rather than the
                 * rule going. Its limiter is soft-MANDATORY: ProfileStepPower.fromJson
                 * throws for a null or zero one. */
                steps: [
                    matrixStep({ transition: 'hold' }),
                    matrixStep({ pump: 'pressure', pressure: 9 }),
                    matrixStep(),
                    matrixStep({ pump: 'power', power: 4, limiter: { value: 9, range: 0.6 } }),
                    { ...LEVER_STEP },
                ],
            }));
    });
}
