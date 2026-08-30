/**
 * step-matrix.render.test.mjs — wave 5.5, the step-matrix cluster:
 * `step-matrix-grid`, `step-matrix-scroll`, `compact-density`, `locked-value-box`,
 * `exit-chip-sentence`, `exit-band-slots`, `action-key-rail`, `matrix-accessibility`,
 * `step-name-input`.
 *
 * ONE SUITE, NINE ROWS, because they are claims about the same grid. Splitting them
 * would mean mounting the matrix nine times to ask nine questions about one layout —
 * and splitting the OWNER is the defect class this screen exists to retire (E2/E3/E5/E8:
 * one owner per dimension).
 *
 * A8, AND IT IS THE POINT OF THIS FILE. "The old editor is pinned by tests that
 * regex-match the stylesheet's SOURCE TEXT for the 1920x1200 lock and the 64px literals
 * — tests that made the defects UNREMOVABLE." Nothing here opens a file. Every
 * assertion is a computed style, a rendered box, a scroll metric or an accessible name
 * Chrome itself computed. The two suites that pinned Slate's editor
 * (`slate-editor-view-contract.test.mjs`, `review-tab-fixes.test.mjs`) have no
 * counterpart here by construction.
 *
 * EVERY NUMBER IS EITHER MEASURED OR RESOLVED FROM A TOKEN. There is no expected track
 * list in this file: the tracks are read off `getComputedStyle` and compared with the
 * tokens they were written from, and the fill/scroll threshold is SWEPT rather than
 * asserted at two convenient widths — a threshold asserted at two points is right at two
 * points and unproven in between.
 *
 * BOTH GATE A GEOMETRIES, AND BOTH SIDES OF THE FILL THRESHOLD. The matrix fills its
 * cell, so its inline size is ~1266 at BENCH and ~985 at FLOOR; the step count and the
 * stage width are driven so that each geometry sees both regimes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, near, tracks, px,
    setEditorWidth, assertTokenMovesBox, assertNoSilentClip,
    matrixRail, matrixCell, matrixControl, matrixStep,
    mountStepMatrix, seedMatrix, matrixAuthored, scrollMatrix, sweepFill,
    accessibleNames, namesFor,
    matrixNameField, openStepName,
} from '../harness/editor.js';

/** N plain steps. Values only — no fixture here states a bound (B2). */
const steps = (n, over = () => ({})) => Array.from({ length: n }, (_, i) => matrixStep({
    name: `Step ${i + 1}`, ...over(i),
}));

/** The used track sizes of the matrix, as numbers. */
/**
 * The used column tracks — WITHOUT the trailing filler.
 *
 * Since 25 August 2026 the grid ends in a 1fr track holding one presentational element
 * that paints the fascia over the space the capped step columns leave. It is a paint and
 * not a column of the table: nothing addresses it, no cell sits in it, and every
 * assertion here is about the rail and the step columns. Dropping it in ONE place is why
 * the twenty-odd `columns.length === steps + 1` claims below still read as they did.
 */
const usedColumns = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-columns'))
    .map(px)
    .slice(0, -1);

/** The filler's own track, for the one test that is about the filler. */
const fillerTrack = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-columns'))
    .map(px)
    .at(-1);
const usedRows = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-rows')).map(px);

/**
 * A custom property declared on the MATRIX rather than on :root.
 *
 * --_ui-step-w-fill and its neighbours live on this component's own :host, so the
 * document-level probe `page.resolveValue` reads them as empty and every comparison
 * against one silently becomes "expected 0". Read where they are declared.
 */
const matrixVar = async (page, name) => px(await page.evalFn(
    (sel, n) => getComputedStyle(window.__h.need(sel)).getPropertyValue(n).trim(),
    EDITOR.matrix, name,
));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`step matrix @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, options) => browser.withPage({ geometry }, async (page) => {
            await mountStepMatrix(page, options);
            return fn(page);
        });

        /* =================================================================
         * 1. ONE GRID — the rail and every step column share it, and a row
         *    and its label share a track BY CONSTRUCTION  (§4.3)
         * ================================================================= */

        test('one grid: rail + N step columns, ten rows, and no literal track list',
            () => mounted(async (page) => {
                const authored = await matrixAuthored(page);
                assert.equal(authored.rows.length, 10);

                const columns = await usedColumns(page);
                assert.equal(columns.length, 1 + 3, 'the rail plus one track per step');

                const rows = await usedRows(page);
                assert.equal(rows.length, authored.rows.length,
                    'ten rows, and every one of them implicit — nothing declares a row track');

                /* E1's shape, stated as a measurement: the row tracks must NOT sum to the
                 * scrollport. Slate's ten summed to exactly 1082 = the canvas height. */
                const m = await page.metrics(EDITOR.matrix);
                const total = rows.reduce((a, b) => a + b, 0);
                assert.notEqual(Math.round(total), Math.round(m.clientHeight),
                    'the row tracks must not sum to the container: that IS E1');
            }, { steps: steps(3) }));

        for (const count of [2, 3, 6]) {
            test(`a row and its label share a track at ${count} steps — measured, not synced`,
                () => mounted(async (page) => {
                    const authored = await matrixAuthored(page);
                    for (const row of authored.rows) {
                        const rail = await page.box(matrixRail(row));
                        for (let i = 0; i < count; i += 1) {
                            const cell = await page.box(matrixCell(row, i));
                            near(cell.y, rail.y, `${row}/${i}: top edge shares the rail's track`);
                            near(cell.height, rail.height, `${row}/${i}: and its height`);
                        }
                    }
                }, { steps: steps(count) }));
        }

        test('the columns come from ONE count property, and moving it moves the grid (E8)',
            () => mounted(async (page) => {
                const before = await usedColumns(page);
                assert.equal(before.length, 5);

                /* --_ui-step-count is the one value that crosses from JS to CSS. E8 is a
                 * declared, documented, exported and TESTED value wired to nothing, so the
                 * proof is that moving it changes the rendered grid — not that it exists. */
                await page.setStyle(EDITOR.matrix, { '--_ui-step-count': '2' });
                await page.settle(3);
                const after = await usedColumns(page);
                assert.equal(after.length, 3, 'the used track list follows the count');
                /* Put it back the way the component does — by rendering. The count is
                 * written on the host in updated(), so an outside write is overwritten by
                 * the next render rather than fought over: one owner, and it is the
                 * element whose content the count describes. */
                await page.evalFn((s) => {
                    const el = window.__h.need(s);
                    el.style.removeProperty('--_ui-step-count');
                    el.requestUpdate();
                    return el.updateComplete;
                }, EDITOR.matrix);
                await page.settle(3);
                assert.equal((await usedColumns(page)).length, 5,
                    'and the next render restores it from the step list');
            }, { steps: steps(4) }));

        /* =================================================================
         * 2. THE FILL THRESHOLD — derived from the container, swept
         * ================================================================= */

        test('fill above, horizontal scroll below, and the flip happens exactly once',
            () => mounted(async (page) => {
                /* THE SWEEP STARTS ABOVE THE FIT WIDTH, NOT AT THE VIEWPORT'S.
                 *
                 * It used to start at `geometry.width`, which worked while the step tracks
                 * were minmax(auto, 1fr) and two steps fitted in 792px. Since 0.1.18 they
                 * are Slate's constants, so two steps need 192 + 431 + 431 = 1054 plus
                 * seams — MORE than the 1000x600 floor's 975px scrollport. Started there
                 * the matrix is already scrolling and the sweep reports no flip at all,
                 * which reads as "the threshold is gone" when it has simply moved.
                 *
                 * 1400 is above the fit width at both geometries, and the stage is set
                 * independently of the viewport (setEditorWidth), so the claim stays what
                 * it always was: the threshold is the CONTAINER'S, not the step count's
                 * and not the window's. */
                const sweep = await sweepFill(page, { from: 1400, to: 320, step: 8 });
                assert.equal(sweep.flips.length, 1,
                    `exactly one fill/scroll flip, got ${sweep.flips.length}`);

                const flip = sweep.flips[0];
                assert.equal(flip.scrolls, true, 'the flip is fill -> scroll as the width shrinks');

                /* AND THE THRESHOLD IS THE CONTAINER'S OWN ARITHMETIC: at the flip the
                 * client width is one seam-and-track short of holding the rail plus N
                 * step minima. Read from the used tracks, never from 1920 and never from
                 * a steps.length comparison. */
                await setEditorWidth(page, `${flip.w + 8}px`);
                const filled = await usedColumns(page);
                const seam = px(await page.resolveToken('--ui-seam', 'inline-size'));
                const need = filled.reduce((a, b) => a + b, 0) + seam * (filled.length - 1);
                const m = await page.metrics(EDITOR.matrix);
                assert.ok(need <= m.clientWidth + 1,
                    'one step above the flip the tracks still fit the scrollport');

                /* AND THE STEP COLUMN IS A CONSTANT ON BOTH SIDES OF THE FLIP.
                 *
                 * IT USED TO GROW, AND SINCE 0.1.18 IT DOES NOT. The matrix is built to
                 * Slate's own two widths — profile_editor.js:2160-2161,
                 * `steps.length <= 4 ? 431 : 372` — because the computed equal-share
                 * width it had before produced 576px columns at two steps, which is where
                 * Ben saw the steppers stretch. So what the container buys above the flip
                 * is the FILLER track, not a wider column, and the flip is the one place
                 * the difference is visible. */
                const stepW = await matrixVar(page, '--_ui-step-w-fill');
                await setEditorWidth(page, `${flip.w - 60}px`);
                const pinnedA = (await usedColumns(page))[1];
                await setEditorWidth(page, `${flip.w - 240}px`);
                const pinnedB = (await usedColumns(page))[1];
                near(pinnedA, pinnedB, 'below the flip the column is pinned', 0.6);
                near(pinnedA, stepW, 'and it is pinned at Slate\'s own fill width');

                await setEditorWidth(page, `${flip.w + 200}px`);
                near((await usedColumns(page))[1], stepW,
                    'above the flip the column is the SAME constant — the filler takes the width');
                assert.ok(await fillerTrack(page) > 1,
                    'and the filler is what grew, so no seam ground is left uncovered');

                /* The pinned minimum holds the widest control this grid composes: #42's
                 * five-key rank, whose own header says a narrower container makes it
                 * overflow where a reader can see. Here it never gets one. */
                await setEditorWidth(page, `${flip.w - 240}px`);
                const overhang = await page.evalFn((sel) => {
                    const el = window.__h.need(sel);
                    const cell = el.shadowRoot.querySelector('[data-cell="actions-0"]');
                    const rank = cell.querySelector('ui-action-key-rail')
                        .shadowRoot.getElementById('rail');
                    return rank.getBoundingClientRect().right - cell.getBoundingClientRect().right;
                }, EDITOR.matrix);
                assert.ok(overhang <= 0.5,
                    `the five-key rank stays inside its cell at the pinned minimum (${overhang}px over)`);
            }, { steps: steps(2) }));

        test('the step columns are equal, and they are Slate\'s constant, not a share',
            () => mounted(async (page) => {
                /* SLATE'S CONSTANTS, NOT AN EQUAL SHARE. A share is what made the
                 * steppers stretch at two steps (576px columns); the renderer Slate ships
                 * picks between two numbers and never divides. */
                const fill = await matrixVar(page, '--_ui-step-w-fill');
                await setEditorWidth(page, `${geometry.width}px`);
                const stepColumns = (await usedColumns(page)).slice(1);
                for (const width of stepColumns) {
                    near(width, stepColumns[0], 'equal step columns', 1);
                    near(width, fill, 'at two steps every column is the fill width', 1);
                }

                /* AND GIVEN THE ROOM THEY ASK FOR, NOTHING SCROLLS. The 1000x600 floor is
                 * NARROWER than a rail plus two of Slate's columns (192 + 431 + 431 =
                 * 1054), so it scrolls there by design — that is the declared scroll mode
                 * and the test above measures the flip into it. This one measures the
                 * other side, at a stage that fits. */
                await setEditorWidth(page, '1400px');
                const m = await page.metrics(EDITOR.matrix);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                    'given the width the tracks ask for, nothing scrolls horizontally');
            }, { steps: steps(2) }));

        /* =================================================================
         * 3. THE RAIL — sticky, capped, ellipsised  (E19)
         * ================================================================= */

        test('the rail is sticky and stays put while the step columns scroll under it',
            () => mounted(async (page) => {
                const before = await page.box(matrixRail('pump'));
                assert.equal(await page.prop(matrixRail('pump'), 'position'), 'sticky');

                /* E17's first leftover is "z-index: 2 on a position: static element". This
                 * one is on a positioned box, so it is consulted. */
                assert.notEqual(await page.prop(matrixRail('pump'), 'z-index'), 'auto');

                await setEditorWidth(page, '600px');
                await scrollMatrix(page, { left: 400 });
                const after = await page.box(matrixRail('pump'));
                near(after.x, before.x, 'the rail keeps its place at the scrollport edge');

                const matrix = await page.box(EDITOR.matrix);
                near(after.x, matrix.x, 'which is the matrix\'s own left edge');
            }, { steps: steps(6) }));

        test('E19: a long row label is clipped to the rail and never reaches the first cell',
            () => mounted(async (page) => {
                /* Written into the RENDERED label rather than through a translation file:
                 * the claim is about what a longer word does to the box, and D2's own
                 * requirement is that a longer translation of "Max Duration" cannot spill.
                 * A8 — this is a live DOM write, not a file read. */
                const long = 'Maximale Dauer dieses Schrittes in Sekunden'.repeat(3);
                await page.evalFn((sel, text) => {
                    window.__h.need(`${sel} .rail-label`).textContent = text;
                }, matrixRail('duration'), long);
                await page.settle(3);

                const rail = await page.box(matrixRail('duration'));
                const first = await page.box(matrixCell('duration', 0));
                assert.ok(rail.right <= first.x + 0.5,
                    `the rail (right ${rail.right}) must not reach the first data cell (${first.x})`);

                const label = await page.metrics(`${matrixRail('duration')} .rail-label`);
                assert.ok(label.scrollWidth > label.clientWidth,
                    'the label is longer than its box, so the ellipsis is the visible answer');
                assert.equal(await page.prop(`${matrixRail('duration')} .rail-label`, 'text-overflow'),
                    'ellipsis');

                /* AND THE RAIL IS CAPPED: it may grow with its content, but never past one
                 * step column's own minimum — otherwise a translation buys itself width
                 * out of the data. */
                const columns = await usedColumns(page);
                assert.ok(columns[0] <= columns[1] + 0.5,
                    `the rail (${columns[0]}) is capped at one step column (${columns[1]})`);
            }, { steps: steps(2) }));

        test('a short label leaves the rail at its floor, and the floor is a real minimum',
            () => mounted(async (page) => {
                const columns = await usedColumns(page);
                const rail = await page.box(matrixRail('pump'));
                near(rail.width, columns[0], 'the rail cell fills its track');
                assert.ok(columns[0] >= 160 - 0.5, 'the rail holds its floor');
                assert.ok(columns[0] < columns[1], 'and is narrower than a step column');
            }, { steps: steps(2) }));

        /* =================================================================
         * THE RAIL'S OWN GROUND  (parity surface 4)
         *
         * The rail is sticky and the step columns scroll UNDER it, so a rail
         * on the same fascia as the cells has nothing separating it from what
         * is passing behind. Slate gives it the bar ground on all ten label
         * cells and this matrix had the fascia. THE TYPE HALF LANDED ON
         * 25 AUGUST 2026 and DQ-4-A is closed: the caps are on, and the
         * "nothing is clipped" assertion below is what keeps them honest.
         *
         * WHAT UNBLOCKED IT WAS A WORD, NOT A WIDTH. The label that would not
         * fit was EXIT CONDITIONS at 155px — and that was never Slate's word
         * for the row. Slate reads "Exit when". With the wording corrected the
         * widest label is MAX DURATION, the actions row draws none at all
         * (also Slate's), and every label fits the 160px rail with the floor
         * geometry untouched.
         * ================================================================= */
        test('the rail has the bar ground, not the cells\', and no label is clipped',
            () => mounted(async (page) => {
                assert.equal(await page.prop(matrixRail('duration'), 'background-color'),
                    await page.resolveToken('--ui-bar', 'background-color'),
                    'the rail ground is the bar token');
                assert.notEqual(await page.prop(matrixRail('duration'), 'background-color'),
                    await page.prop(matrixCell('duration', 0), 'background-color'),
                    'and it is not the cells\' ground, which is the point of it');

                /* NOTHING ELLIPSISES, AT EITHER GATE A GEOMETRY, WITH THE CAPS ON.
                 * This is what DQ-4-A turned on and it is measured in scroll mode too,
                 * where every track sits at its minimum and the rail is 160px.
                 *
                 * THE ACTIONS ROW IS NOT IN THIS LIST because its label is not drawn:
                 * it is a visually-hidden 1px box, so measuring it would compare a
                 * word against a clip rectangle and always fail. Its NAME is asserted
                 * in the E14 group test instead, which is the half that still matters. */
                for (const row of ['head', 'temperature', 'probe', 'pump', 'transition',
                    'target', 'limiter', 'duration', 'exits']) {
                    const m = await page.metrics(`${matrixRail(row)} > .rail-label`);
                    assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                        `${row}: the rail label is clipped (${m.scrollWidth} in ${m.clientWidth})`);
                }
            }));

        /* =================================================================
         * 4. THE SCROLL REGION, THE FLOOR AND E1's TRAP
         * ================================================================= */

        test('both axes scroll, visibly, and nothing clips silently',
            () => mounted(async (page) => {
                await setEditorWidth(page, '600px');
                const m = await assertNoSilentClip(page, EDITOR.matrix);
                assert.equal(m.overflowX, 'auto');
                assert.equal(m.overflowY, 'auto');
                assert.ok(m.scrollWidth > m.clientWidth, 'it scrolls horizontally here');
                assert.ok(m.scrollHeight > m.clientHeight, 'and vertically');
                assert.ok(m.scrollbarInline > 0 && m.scrollbarBlock > 0,
                    'with scrollbars that take layout space — T16 is a hidden live scrollbar');
            }, { steps: steps(6) }));

        test('E1: with a horizontal scrollbar stealing height, the ACTION ROW is not clipped',
            () => mounted(async (page) => {
                await setEditorWidth(page, '600px');
                const m = await page.metrics(EDITOR.matrix);
                assert.ok(m.scrollbarBlock > 0,
                    'the trap needs a classic horizontal scrollbar to be live at all');
                assert.ok(m.scrollHeight > m.clientHeight,
                    'and the stolen height must be what makes the matrix scroll vertically');

                await scrollMatrix(page, { top: 'max' });
                const host = await page.box(EDITOR.matrix);
                const port = host.bottom - m.scrollbarBlock;
                for (let i = 0; i < 6; i += 1) {
                    const action = await page.box(matrixCell('actions', i));
                    assert.ok(action.bottom <= port + 0.5,
                        `step ${i}: the action row (bottom ${action.bottom}) is inside the `
                        + `scrollport (${port}) — E1 is the horizontal scrollbar cutting it`);
                    assert.ok(action.height > 0, 'and it has a box at all');
                }
            }, { steps: steps(6) }));

        test('as height shrinks the matrix scrolls vertically — new behaviour, measured',
            () => mounted(async (page) => {
                const tall = await page.metrics(EDITOR.matrix);
                await page.setStyle('#stage', { 'block-size': '520px' });
                await page.settle(4);
                const short = await page.metrics(EDITOR.matrix);
                assert.ok(short.clientHeight < tall.clientHeight, 'the cell got shorter');
                assert.ok(short.scrollHeight > short.clientHeight,
                    'so the matrix scrolls rather than clipping its footer');
                assert.ok(short.scrollbarInline > 0, 'and the scrollbar is visible');
            }, { steps: steps(3) }));

        test('rows keep their own heights, and the BOX keeps the rows\' height',
            () => mounted(async (page) => {
                /* A cell TALLER than the ten rows need: they must not stretch to fill it,
                 * because stretch is what makes "the tracks sum to the container" true by
                 * accident. The stage is driven past the window on purpose — the claim is
                 * about the grid's own block sizing and not about what fits on screen.
                 *
                 * THE SECOND HALF LANDED 25 AUGUST 2026 and it is what Ben saw: this used
                 * to assert `total < clientHeight`, i.e. that the box was TALLER than its
                 * rows. That gap was real and it was visible — this host paints the seam
                 * ground, so the leftover was a bar of --ui-line across the full width
                 * with no cell over it, reading as an eleventh empty row. align-self:
                 * start closed it.
                 *
                 * AND align-content IS `stretch` NOW, WHICH IS THE SAME RULING'S OTHER
                 * HALF. Ben, 25 August 2026: "The buttons on the bottom of the editor
                 * should be at the bottom of the screen with a gap above, not below." Only
                 * ONE row can grow into the slack — the exits track is
                 * minmax(--_ui-exit-cell-min, 1fr) and the other nine are min-content — so
                 * "rows keep their own heights" is asserted per row below rather than by
                 * pinning a keyword that now means the opposite of what it did. */
                await page.setStyle('#stage', { 'block-size': '1600px' });
                await page.settle(4);
                assert.equal(await page.prop(EDITOR.matrix, 'align-content'), 'stretch');

                const rows = await usedRows(page);
                const total = rows.reduce((a, b) => a + b, 0);
                const m = await page.metrics(EDITOR.matrix);
                near(total, m.clientHeight, 'the rows fill the box exactly — no seam ground left over', 2);

                /* NINE ROWS DO NOT MOVE AND ONE DOES. Shrink the stage by 200px: every
                 * min-content track keeps its height to the pixel and the whole difference
                 * comes off the exits track. A grid where the slack were spread would show
                 * ten small changes instead. */
                const exitsAt = px(await page.evalFn((sel) => getComputedStyle(window.__h.need(sel))
                    .getPropertyValue('--_ui-rows-before-exits'), EDITOR.matrix));
                await page.setStyle('#stage', { 'block-size': '1400px' });
                await page.settle(4);
                const shorter = await usedRows(page);
                assert.equal(shorter.length, rows.length);
                for (let i = 0; i < rows.length; i += 1) {
                    if (i === exitsAt) continue;
                    near(shorter[i], rows[i], `row ${i} moved when only the exits row may`, 1);
                }
                near(rows[exitsAt] - shorter[exitsAt], 200,
                    'the whole 200px came off the exits track', 2);

                await page.setStyle('#stage', { 'block-size': '1600px' });
                await page.settle(4);

                const host = await page.box(EDITOR.matrix);
                const cell = await page.box('#stage');
                assert.ok(host.height < cell.height - 1,
                    'and the box is shorter than the cell it sits in, which is the fix');

                const last = await page.box(matrixCell('actions', 0));
                near(last.bottom, host.bottom, 'the last row ends where the matrix ends', 2);
            }, { steps: steps(1) }));

        test('the floor is a token, and moving the token moves the box (§2.4, M18, E8)',
            () => mounted(async (page) => {
                /* The floor only binds when the cell is shorter than it, so the stage is
                 * squeezed first — otherwise the token would be real and invisible, which
                 * is E8 with the polarity reversed. */
                await page.setStyle('#stage', { 'block-size': '260px' });
                await page.settle(4);
                const floor = px(await page.resolveToken('--ui-editor-matrix-min-h', 'block-size'));
                const box = await page.box(EDITOR.matrix);
                near(box.height, floor, 'the matrix holds its floor and overflows the cell');

                await assertTokenMovesBox(page, {
                    token: '--ui-editor-matrix-min-h',
                    selector: EDITOR.matrix,
                    by: 90,
                });
            }, { steps: steps(3) }));

        /* =================================================================
         * 5. C3 — the named compact density
         * ================================================================= */

        test('compact moves the vertical rhythm, and NOTHING else moves with it',
            () => mounted(async (page) => {
                const read = async () => ({
                    row: (await page.box(matrixCell('temperature', 0))).height,
                    control: (await page.box(matrixControl('temperature', 0, 'ui-stepper'))).height,
                    cap: await page.box(`${matrixControl('temperature', 0, 'ui-stepper')} >>> #decrement`),
                    padding: px(await page.prop(matrixCell('temperature', 0), 'padding-top')),
                    /* BOTH EDGES, because this row's are NOT equal. `temperature` opens a
                     * group, so it pays 2 x --_ui-matrix-rhythm at the top and one at the
                     * bottom (step-matrix.js, the group-start rule). A test that doubled
                     * the top edge predicted 8px of movement where the row moves 6. */
                    pad: (await page.computed(matrixCell('temperature', 0),
                        ['padding-top', 'padding-bottom'])),
                });

                assert.equal(await page.prop(EDITOR.matrix, 'padding-top'), '0px');
                const compact = await read();
                assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('density'),
                    EDITOR.matrix), 'compact', 'this screen\'s matrix ships compact');

                await page.evalFn((s) => { window.__h.need(s).density = 'regular'; }, EDITOR.matrix);
                await page.settle(4);
                const regular = await read();

                /* THE RHYTHM MOVES. */
                assert.ok(regular.padding > compact.padding,
                    `compact tightens the rhythm (${compact.padding} vs ${regular.padding})`);
                assert.ok(regular.row > compact.row,
                    `and therefore the row (${compact.row} vs ${regular.row})`);
                const block = (r) => px(r.pad['padding-top']) + px(r.pad['padding-bottom']);
                near(regular.row - compact.row, block(regular) - block(compact),
                    'the row moves by exactly its own padding, and nothing else changed');

                /* THE CONTROL HEIGHT DOES NOT. "Density multiplies band heights and row
                 * gaps ONLY ... ergonomics is physical" (tokens.css). */
                const controlH = px(await page.resolveToken('--ui-control-h', 'block-size'));
                near(compact.control, controlH, 'compact keeps the control height');
                near(regular.control, controlH, 'and so does regular');

                /* NOR DOES THE TOUCH FLOOR. The cap is C3's own re-declaration
                 * (--ui-stepper-cap 78 -> --ui-control-h 64) and both clear --ui-hit-min. */
                const hit = px(await page.resolveToken('--ui-hit-min', 'inline-size'));
                assert.ok(compact.cap.width >= hit, `compact cap ${compact.cap.width} >= ${hit}`);
                assert.ok(compact.cap.height >= hit - 14, 'and its ink stays a real target');
                assert.ok(regular.cap.width > compact.cap.width,
                    'the cap is what compact re-declares — 78 to 64, never --ui-density');
                near(regular.cap.width, px(await page.resolveToken('--ui-stepper-cap', 'inline-size')),
                    'and regular is the standardised cap token');
                near(compact.cap.width, controlH, 'compact is the square cap, derived from a token');
            }, { steps: steps(3) }));

        test('the matrix declares no --ui-density arithmetic of its own',
            () => mounted(async (page) => {
                /* The mechanism constraint, as a measurement: --ui-density computes to the
                 * SAME number inside the matrix as on the root, because C3 re-declares the
                 * cap it wants and never the multiplier. A subtree that re-declared
                 * --ui-density would show a different number here and change nothing on
                 * screen — the exact silent failure tokens.css:1176-1182 describes. */
                const root = parseFloat(await page.evalFn(
                    () => getComputedStyle(document.documentElement).getPropertyValue('--ui-density'),
                ));
                const inside = parseFloat(await page.evalFn(
                    (s) => getComputedStyle(window.__h.need(s)).getPropertyValue('--ui-density'),
                    EDITOR.matrix,
                ));
                assert.equal(inside, root, 'one --ui-density, and the matrix does not re-declare it');
            }, { steps: steps(2) }));

        /* =================================================================
         * 6. THE CELLS — #43 against #4, E7, and E15's slack
         * ================================================================= */

        test('#43 locked box and the compact stepper agree on cell metrics',
            () => mounted(async (page) => {
                const stepper = await page.box(matrixControl('target', 0, 'ui-stepper'));
                const locked = await page.box(matrixControl('target', 1, 'ui-locked-value'));
                near(locked.width, stepper.width, 'the read-only counterpart fills the same cell');
                near(locked.height, stepper.height, 'and stands the same height');

                const box = await page.box(`${matrixControl('target', 1, 'ui-locked-value')} >>> #box`);
                near(box.height, stepper.height, 'right down to its own painted box');

                const cellA = await page.box(matrixCell('target', 0));
                const cellB = await page.box(matrixCell('target', 1));
                near(cellA.height, cellB.height, 'and the row does not notice which one it holds');
            }, { steps: steps(2, (i) => (i === 1 ? { transition: 'hold' } : {})) }));

        /* =================================================================
         * THE VALUE'S INK IS ITS CHANNEL'S  (parity surface 4)
         *
         * Slate inks every matrix value in the colour of the channel it
         * belongs to — target variant for a setpoint, plain for a limit — and
         * this matrix painted all of them --ui-text. The oracle lines and the
         * derivation are in src/lib/step-matrix-rows.js (matrixChannel).
         *
         * Asserted against the TOKENS rather than against hex, and then
         * drilled: a rule that had copied a literal would pass the first half
         * and fail the second, which is bug L12's shape.
         * ================================================================= */
        test('every matrix value is inked by the channel it speaks for, and the ink is a token',
            () => mounted(async (page) => {
                const num = (row, index) => `${matrixControl(row, index, 'ui-stepper')} >>> #number`;
                const ink = (name) => page.resolveToken(name, 'color');

                /* Step 1 is a FLOW step, step 2 a PRESSURE step, so both halves of the
                 * target/limit pair are in one mount. */
                assert.equal(await page.prop(num('temperature', 0), 'color'),
                    await ink('--ui-channel-target-group-temperature'),
                    'a temperature is a target temperature');
                assert.equal(await page.prop(num('target', 0), 'color'),
                    await ink('--ui-channel-target-flow'),
                    'the target of a flow step is a target flow');
                assert.equal(await page.prop(num('target', 1), 'color'),
                    await ink('--ui-channel-target-pressure'),
                    'the target of a pressure step is a target pressure');

                /* THE DISTINCTION THAT MAKES THIS A RULE AND NOT A PALETTE: on one step
                 * the target and the limiter are two different channels AND two
                 * different variants of them. */
                assert.equal(await page.prop(num('limiter', 0), 'color'),
                    await ink('--ui-channel-pressure'),
                    'a flow step limits PRESSURE, and a limit is not a command');
                assert.equal(await page.prop(num('limiter', 1), 'color'),
                    await ink('--ui-channel-flow'),
                    'a pressure step limits FLOW, plain channel again');

                /* And the ones that speak for no channel keep the cell's ink — Slate's
                 * own treatment of a duration. */
                assert.equal(await page.prop(num('duration', 0), 'color'),
                    await page.prop(matrixCell('duration', 0), 'color'),
                    'a duration commands nothing, so it inherits');

                /* THE DRILL. Retarget one channel on :root; the number must follow it
                 * and land on the new value, then come back. */
                const before = await page.prop(num('target', 0), 'color');
                await page.setToken('--ui-channel-target-flow', 'rgb(1, 2, 3)');
                assert.equal(await page.prop(num('target', 0), 'color'), 'rgb(1, 2, 3)',
                    'the ink is the token, not a copy of its value');
                assert.equal(await page.prop(num('temperature', 0), 'color'),
                    await ink('--ui-channel-target-group-temperature'),
                    'and only that channel moved');
                await page.setToken('--ui-channel-target-flow', null);
                assert.equal(await page.prop(num('target', 0), 'color'), before, 'restored');
            }, {
                steps: [
                    matrixStep({ name: 'Preinfusion' }),
                    matrixStep({ name: 'Extract', pump: 'pressure', pressure: 6 }),
                ],
            }));

        test('E7: the step-name input keeps its line box with the type scale raised',
            () => mounted(async (page) => {
                /* THE FIELD IS BEHIND A PRESS SINCE 0.1.18. At rest the head cell draws
                 * the name as a button; the ui-text-field is rendered only for the step
                 * being edited, so E7's box has to be brought on screen the way a person
                 * brings it on screen. */
                await openStepName(page, 0);
                const input = `${matrixNameField(0)} >>> #control`;
                assert.equal(await page.exists(input), true,
                    'pressing the name must open the field E7 is about');
                const clean = async () => {
                    const m = await page.metrics(input);
                    const style = await page.computed(input, ['font-size', 'line-height']);
                    return { m, style };
                };
                const before = await clean();
                assert.ok(before.m.scrollHeight <= before.m.clientHeight,
                    'nothing is clipped at the desk harness scale');

                /* THE TABLET RENDERS TEXT ABOUT 10% LARGER AND THAT MARGIN IS SPOKEN FOR
                 * (Part 2 §5 rule 3), so the box is proved against the raised scale rather
                 * than against the harness's own numbers. E7 is 28.8px of line box in a
                 * 28px box — about 31.7 on the tablet. */
                await page.setToken('--ui-type-scale', '1.1');
                await page.settle(4);
                const after = await clean();
                assert.ok(px(after.style['font-size']) > px(before.style['font-size']),
                    'the scale actually moved the type');
                assert.ok(after.m.scrollHeight <= after.m.clientHeight + 0.5,
                    `the line box still fits: ${after.m.scrollHeight} in ${after.m.clientHeight}`);

                const lineBox = after.style['line-height'] === 'normal'
                    ? px(after.style['font-size']) * 1.5
                    : px(after.style['line-height']);
                assert.ok(after.m.clientHeight >= lineBox,
                    `the box (${after.m.clientHeight}) clears the line box (${lineBox})`);
                await page.setToken('--ui-type-scale', null);
                await page.settle(2);
            }, { steps: steps(2) }));

        test('E15: at the narrowest column no control overflows its own cell',
            () => mounted(async (page) => {
                /* E15 is 2px of slack nobody connected: "cell padding 12 + control 346 =
                 * 370 in a 372px column". Here the three numbers are read back at the
                 * width where the column is exactly its minimum. */
                await setEditorWidth(page, '600px');
                await page.settle(3);
                const authored = await matrixAuthored(page);
                for (const row of authored.rows) {
                    const cell = await page.box(matrixCell(row, 0));
                    const inner = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const kid = el.firstElementChild;
                        if (!kid) return null;
                        const r = kid.getBoundingClientRect();
                        return { left: r.left, right: r.right };
                    }, matrixCell(row, 0));
                    if (!inner) continue;
                    assert.ok(inner.left >= cell.x - 0.5 && inner.right <= cell.right + 0.5,
                        `${row}: the control (${inner.left}..${inner.right}) stays inside its cell `
                        + `(${cell.x}..${cell.right})`);
                }
            }, { steps: steps(6) }));

        /* =================================================================
         * 7. THE EXIT BAND — three stable slots, contained  (C8, E16)
         * ================================================================= */

        test('the exit row keeps ONE height across add and remove',
            () => mounted(async (page) => {
                const heights = [];
                const measure = async () => {
                    const cells = [];
                    for (let i = 0; i < 3; i += 1) cells.push((await page.box(matrixCell('exits', i))).height);
                    heights.push(cells);
                    return cells;
                };
                await measure();

                /* Add a condition to step 0, then a volume, then take both away. Each
                 * write is a new step object — the matrix never mutates the draft. */
                for (const patch of [
                    { exit: { type: 'pressure', condition: 'over', value: 4 } },
                    { exit: { type: 'pressure', condition: 'over', value: 4 }, volume: 30, weight: 36 },
                    { exit: null, volume: 0, weight: 0 },
                ]) {
                    await seedMatrix(page, {
                        steps: steps(3, (i) => (i === 0 ? patch : {})),
                    });
                    await measure();
                }

                const first = heights[0][0];
                for (const [i, row] of heights.entries()) {
                    for (const [j, height] of row.entries()) {
                        near(height, first,
                            `exit cell ${j} at state ${i}: the band never changes height (Appendix 9)`);
                    }
                }
            }, { steps: steps(3) }));

        test('E16: an uncapped dead-exit note is CONTAINED, and the row does not grow',
            () => mounted(async (page) => {
                const plain = (await page.box(matrixCell('exits', 0))).height;

                /* A "falls below 0" exit is dead by exit-validity.js's own rule, and the
                 * note is the uncapped wrapping <p> that spilled into the rows above and
                 * below in Slate. */
                await seedMatrix(page, {
                    steps: steps(2, (i) => (i === 0
                        ? { exit: { type: 'pressure', condition: 'under', value: 0 }, volume: 30, weight: 36 }
                        : {})),
                });
                const dead = await page.box(matrixCell('exits', 0));
                near(dead.height, plain, 'the note does not take the row with it');

                const band = await page.metrics(`${matrixCell('exits', 0)} ui-exit-sentence >>> #band`);
                assert.ok(band.scrollHeight > band.clientHeight,
                    'the note is really there and really longer than the band');
                assert.equal(band.overflowY, 'auto',
                    'so the band scrolls and shows it — never clips, never spills');

                const rows = await usedRows(page);
                const cells = [];
                for (let i = 0; i < 2; i += 1) cells.push((await page.box(matrixCell('exits', i))).height);
                near(cells[0], cells[1], 'and the neighbouring column is untouched');
                assert.equal(rows.length, 10, 'ten rows, still');
            }, { steps: steps(2) }));

        test('C8: the rendered sentence IS the model seam\'s value, so the two cannot drift',
            () => mounted(async (page) => {
                /* THIS READ IS THE SUITE SET'S ONE FLAKE, AND THE PIN IS IN THE HARNESS
                 * (parity surface 2). It failed intermittently with `Runtime.evaluate:
                 * Promise was collected` — 6 red in 9 runs at the floor geometry by
                 * parity surface 1's review. Two page-side theories were tried and
                 * measured out: parking the chain on `window` so the page holds a
                 * reference (2 red in 6) and removing `awaitPromise` from this
                 * expression entirely, reading the result off a polled property
                 * (2 red in 6 again). Neither is the mechanism. It is the CDP round
                 * trip losing the remote object it was told to await, so the fix is one
                 * scoped retry in `Page.eval` (test/harness/index.js) and this
                 * expression is left as the plain read it should be. 0 red in 6 after. */
                const seam = JSON.parse(await page.eval(
                    "import('/src/lib/exit-sentence.js').then(function (m) {"
                    + ' var step = window.__h.need("step-matrix").steps[0];'
                    + ' return JSON.stringify(m.serializeExitSlots(step, {}));'
                    + ' })',
                ));
                assert.ok(seam.length >= 2, 'two occupied slots on this step');

                for (const record of seam) {
                    const rendered = await page.evalFn((sel, slot) => {
                        const el = window.__h.need(`${sel} ui-exit-sentence`);
                        const button = el.shadowRoot.getElementById(`sentence-${slot}`);
                        return button ? button.textContent.replace(/\s+/g, ' ').trim() : null;
                    }, matrixCell('exits', 0), record.slot);
                    assert.ok(rendered, `slot ${record.slot} is on screen`);
                    /* Compared without spacing: the sentence's parts are laid out with a
                     * flex gap rather than joined by space characters, so the CHARACTERS
                     * on screen are the seam's and the gaps between them are geometry. */
                    const words = record.sentence.replace(/\s+/g, '');
                    assert.equal(rendered.replace(/\s+/g, ''), words,
                        `slot ${record.slot}: the visible sentence and the seam are one value`);
                }

                /* AND THE HIDDEN CONTROL SET IS NOT BACK. C8 replaced the decomposed
                 * comparator/value/bounds inputs with this function; a shadow tree holding
                 * inputs nobody can see would be the thing the decision retired. */
                const hidden = await page.evalFn((sel) => {
                    const el = window.__h.need(`${sel} ui-exit-sentence`);
                    return [...el.shadowRoot.querySelectorAll('input, select')]
                        .map((node) => node.tagName.toLowerCase());
                }, matrixCell('exits', 0));
                assert.deepEqual(hidden, [], 'no hidden control set, in any form');
            }, {
                steps: steps(2, (i) => (i === 0
                    ? { exit: { type: 'pressure', condition: 'over', value: 4 }, volume: 30 }
                    : {})),
            }));

        /* =================================================================
         * 8. C7 — the action key rail is buttons, and there is no drag
         * ================================================================= */

        test('five keys per step, all buttons, with the reorder pair disabled at the ends',
            () => mounted(async (page) => {
                const keys = await page.evalFn((sel) => {
                    const rail = window.__h.need(`${sel} ui-action-key-rail`);
                    return [...rail.shadowRoot.querySelectorAll('ui-button')].map((b) => ({
                        id: b.id, disabled: b.disabled,
                    }));
                }, matrixCell('actions', 0));
                assert.equal(keys.length, 5, 'five, as shipped — measured, not quoted');
                assert.deepEqual(keys.map((k) => k.id), [
                    'key-move-left', 'key-delete', 'key-insert-after', 'key-duplicate', 'key-move-right',
                ]);
                assert.equal(keys[0].disabled, true, 'move-left is refused on the first step');
                assert.equal(keys[4].disabled, false, 'move-right is not');

                const last = await page.evalFn((sel) => {
                    const rail = window.__h.need(`${sel} ui-action-key-rail`);
                    return [...rail.shadowRoot.querySelectorAll('ui-button')].map((b) => b.disabled);
                }, matrixCell('actions', 2));
                assert.equal(last[4], true, 'and move-right is refused on the last');
            }, { steps: steps(3) }));

        test('C7: nothing in the matrix drags, and nothing looks like it does',
            () => mounted(async (page) => {
                const found = await page.evalFn((sel) => {
                    const host = window.__h.need(sel);
                    const all = window.__h.deepAll(host.shadowRoot, []);
                    const out = { draggable: [], cursors: [], userDrag: [] };
                    for (const el of all) {
                        if (el.hasAttribute && el.hasAttribute('draggable')) out.draggable.push(el.tagName);
                        const cs = getComputedStyle(el);
                        if (['grab', 'grabbing', 'move'].includes(cs.cursor)) out.cursors.push(cs.cursor);
                        if (cs.webkitUserDrag === 'element') out.userDrag.push(el.tagName);
                    }
                    return out;
                }, EDITOR.matrix);
                assert.deepEqual(found.draggable, [], 'no draggable attribute anywhere');
                assert.deepEqual(found.cursors, [], 'and no grab cursor — a dead affordance is worse');
                assert.deepEqual(found.userDrag, []);

                /* A pointer drag across two step columns changes nothing: no reorder path
                 * exists to fire, and the step list is untouched. */
                await page.evalFn(() => { window.__recorded = []; });
                await page.evalFn((sel) => window.__h.record(sel,
                    ['dragstart', 'drop', 'step-action', 'step-change']), EDITOR.matrix);
                const from = await page.box(matrixCell('head', 0));
                const to = await page.box(matrixCell('head', 2));
                await page.mouse('mousePressed', from.x + 20, from.y + 20);
                await page.mouse('mouseMoved', to.x + 20, to.y + 20);
                await page.mouse('mouseReleased', to.x + 20, to.y + 20);
                await page.settle(3);
                assert.deepEqual(await page.recordedEvents(), [], 'a drag emits nothing at all');

                const names = await page.evalFn((sel) => window.__h.need(sel).steps.map((s) => s.name),
                    EDITOR.matrix);
                assert.deepEqual(names, ['Step 1', 'Step 2', 'Step 3'], 'and the order is untouched');
            }, { steps: steps(3) }));

        /* =================================================================
         * 9. E14 — table semantics and per-cell names, from Chrome's own tree
         * ================================================================= */

        test('the matrix is a TABLE with rows, headers and cells — not a div with a role',
            () => mounted(async (page) => {
                const nodes = await accessibleNames(page);
                const authored = await matrixAuthored(page);

                assert.equal(namesFor(nodes, 'table').length, 1, 'one table');
                assert.equal(namesFor(nodes, 'table')[0], 'Profile steps', 'and it is named');
                assert.equal(nodes.filter((n) => n.role === 'row').length, authored.rows.length,
                    'every row is a row — H4 is a role=grid with no rows at all');
                assert.equal(nodes.filter((n) => n.role === 'rowheader').length, 9,
                    'nine row headers: the rail, minus the head row\'s own column header');
                assert.equal(nodes.filter((n) => n.role === 'columnheader').length, 1 + 3,
                    'and the head row is column headers');
            }, { steps: steps(3) }));

        test('E14: every cell has a distinct, translated accessible name',
            () => mounted(async (page) => {
                const nodes = await accessibleNames(page);
                const cells = nodes.filter((n) => ['cell', 'columnheader', 'rowheader'].includes(n.role));
                assert.ok(cells.length >= 10 * 3, 'every cell reached the tree');
                for (const cell of cells) {
                    assert.ok(cell.name.trim().length > 0, `an unnamed ${cell.role}`);
                }
                const names = cells.map((c) => c.name);
                assert.equal(new Set(names).size, names.length,
                    `every cell name is distinct: ${names.length - new Set(names).size} repeat`);
            }, { steps: steps(3) }));

        test('E14: the 32 ± buttons do not share two labels — each is distinct and translated',
            () => mounted(async (page) => {
                const nodes = await accessibleNames(page);
                const steppers = namesFor(nodes, 'button')
                    .filter((name) => /^(Decrease|Increase) /.test(name));
                assert.ok(steppers.length >= 8, 'the stepper caps are in the tree');
                assert.equal(new Set(steppers).size, steppers.length,
                    'and no two of them share a name — E14 is 32 buttons sharing two');
                for (const name of steppers) {
                    assert.match(name, /, step \d+$/, 'each carries its own cell, translated');
                }
            }, { steps: steps(4) }));

        test('E14: a control whose own name repeats is inside a NAMED group',
            () => mounted(async (page) => {
                /* #41 and #42 name their own buttons ("Remove Volume", "Move step left"),
                 * which is right inside one band and repeats across columns. The context
                 * that separates them is the group each cell wraps, named per step. */
                const nodes = await accessibleNames(page);
                /* "Exit when" is Slate's own wording, measured 25 August 2026; this
                 * read "Exit conditions" until then. The ACTIONS row's label is no
                 * longer drawn — Slate draws none — but it is still SPOKEN, and this
                 * assertion is the one that proves it: hiding the rail label must not
                 * cost the group its accessible name. */
                const groups = namesFor(nodes, 'group').filter((n) => /^(Exit when|Step actions), step/.test(n));
                assert.equal(groups.length, 3 * 2, 'one exit group and one action group per step');
                assert.equal(new Set(groups).size, groups.length, 'each named for its own step');
            }, { steps: steps(3) }));

        test('the keyboard reaches every step column, in order', () => mounted(async (page) => {
            /* Walked with a real Tab through CDP, which is also what puts the page into
             * keyboard modality. The claim is reachability and ORDER: the matrix is one
             * grid in row-major DOM order, so tabbing crosses a row before it descends. */
            /* TWO STOPS PER HEAD CELL SINCE 0.1.18 — the name is a button that opens the
             * field, and the pen beside it opens the same field. There is no ui-text-field
             * to focus at rest, so the walk starts on the first name button, and the claim
             * is about the ORDER the cells are reached in rather than the count of stops
             * inside each one. */
            await page.evalFn(() => {
                const el = window.__h.need('step-matrix');
                el.shadowRoot.querySelector('[data-cell="head-0"] .name-display').focus();
            });
            const seen = [];
            for (let i = 0; i < 8; i += 1) {
                seen.push(await page.evalFn(() => {
                    const active = window.__h.deepActiveElement();
                    const cell = active?.getRootNode?.()?.host?.closest?.('[data-cell]')
                        ?? active?.closest?.('[data-cell]');
                    return cell ? cell.dataset.cell : null;
                }));
                await page.press('Tab');
            }
            const order = seen.filter((cell, i) => cell && cell !== seen[i - 1]);
            assert.deepEqual(order.slice(0, 3), ['head-0', 'head-1', 'head-2'],
                'the head row is crossed left to right before the next row starts');
        }, { steps: steps(3) }));

        /* =================================================================
         * 10. THE EVENTS OUT — the draft is the screen's
         * ================================================================= */

        test('a cell change leaves as one event with its coordinates, and mutates nothing',
            () => mounted(async (page) => {
                const authored = await matrixAuthored(page);
                await page.evalFn(() => { window.__recorded = []; });
                await page.evalFn((sel, type) => window.__h.record(sel, [type, 'change']),
                    EDITOR.matrix, authored.change);

                /* BRING THE COLUMN INTO THE SCROLLPORT FIRST. Since 0.1.18 the step tracks
                 * are Slate's constants, so two steps need 1054px and the 1000x600 floor's
                 * scrollport is 975 — the second column's increment key is CLIPPED there,
                 * and a hit-tested click on a clipped control lands on nothing. That is the
                 * declared scroll mode working, not a defect, so the test scrolls the way a
                 * finger would. */
                await scrollMatrix(page, { left: 'max' });
                await page.settle(2);
                await page.click(`${matrixControl('temperature', 1, 'ui-stepper')} >>> #increment`);
                await page.settle(3);

                const events = await page.recordedEvents();
                const changes = events.filter((e) => e.type === authored.change);
                assert.equal(changes.length, 1, 'one event, with coordinates');
                assert.equal(changes[0].detail.index, 1);
                assert.equal(changes[0].detail.row, 'temperature');
                assert.equal(changes[0].detail.field, 'temperature');
                assert.equal(events.filter((e) => e.type === 'change').length, 0,
                    'and the bare `change` is stopped rather than crossing the screen');

                const steps0 = await page.evalFn((sel) => window.__h.need(sel).steps.map((s) => s.temperature),
                    EDITOR.matrix);
                assert.deepEqual(steps0, [92, 92], 'the draft is not touched here — the screen owns it');
            }, { steps: steps(2) }));

        test('the step name leaves as the same event, carrying its own index',
            () => mounted(async (page) => {
                const authored = await matrixAuthored(page);
                await page.evalFn(() => { window.__recorded = []; });
                await page.evalFn((sel, type) => window.__h.record(sel, [type]),
                    EDITOR.matrix, authored.change);

                /* #6 re-dispatches a COMPOSED change, because the native one is
                 * composed:false and would stop at its own shadow boundary — the matrix
                 * listens on the host and would otherwise never hear a rename. */
                /* The field is behind a press since 0.1.18 — open step 2's the way a person
                 * does, then type into it. */
                await openStepName(page, 1);
                await page.evalFn((sel) => {
                    const field = window.__h.need(sel);
                    const input = field.shadowRoot.getElementById('control');
                    input.value = 'Bloom';
                    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }, matrixNameField(1));
                await page.settle(3);

                const changes = (await page.recordedEvents()).filter((e) => e.type === authored.change);
                assert.equal(changes.length, 1);
                assert.equal(changes[0].detail.index, 1);
                assert.equal(changes[0].detail.field, 'name');
                assert.equal(changes[0].detail.value, 'Bloom');
                assert.equal(changes[0].detail.previous, 'Step 2', 'and what it was before');
            }, { steps: steps(2) }));

        test('a refused range renders the control UNAVAILABLE, never a plausible band (A7)',
            () => mounted(async (page) => {
                /* No capability answer means no machine class, and machine-limits.js
                 * serves no steam row — but brewTemp is machine-independent, so the
                 * refusal has to be provoked at the door itself: a matrix with no ranges
                 * at all is what a screen that has not received the table yet holds. */
                await page.evalFn((sel) => { window.__h.need(sel).ranges = null; }, EDITOR.matrix);
                await page.settle(4);

                const disabled = await page.evalFn((sel) => {
                    const el = window.__h.need(sel);
                    return [...el.shadowRoot.querySelectorAll('ui-stepper')].map((s) => ({
                        disabled: s.disabled,
                        min: s.min,
                        max: s.max,
                        title: s.getAttribute('title'),
                        reason: s.getAttribute('data-refusal'),
                    }));
                }, EDITOR.matrix);
                assert.ok(disabled.length > 0);
                for (const stepper of disabled) {
                    assert.equal(stepper.disabled, true, 'unavailable, and it looks unavailable');
                    assert.equal(stepper.min, null, 'and no invented floor');
                    assert.equal(stepper.max, null, 'and no invented ceiling');
                    assert.equal(stepper.title, 'Unavailable',
                        'the visible word is a translated value (D2), not developer prose');
                    assert.ok((stepper.reason ?? '').length > 0,
                        'and the door\'s own reason rides on data-refusal for whoever mis-wired it');
                }
            }, { steps: steps(2) }));

        /* =================================================================
         * SLATE PARITY, MEASURED 25 AUGUST 2026 — Ben: "can you compare the
         * profile editor page between slate and Decal, check 2 step profile
         * and 5 step profile. Make [it] match slate"
         *
         * The oracle for every number and word below is the running Slate,
         * driven through CDP on the two profiles he named. The MODEL half of
         * this is in step-matrix-rows.test.mjs; what is asserted here is what
         * is DRAWN, which is where three of the four differences lived.
         * ================================================================= */
        describe('the drawn half matches the oracle', () => {
            test('the head cell is the ordinal, the name and the MODE — Slate\'s three lines',
                () => mounted(async (page) => {
                    /* ORACLE:
                     *   <div class="pe-step-header">
                     *     <span class="pe-step-num">01</span>
                     *     <input class="pe-step-name">
                     *     <span class="pe-step-summary" data-tone="flow">Flow</span>
                     *   </div>
                     * This drew "Step 1 of 2" and no mode line at all.
                     *
                     * THE ORDINAL IS "1." AND NOT "01", AND THAT IS BEN'S, NOT A DRIFT.
                     * 25 August 2026 he moved the number INSIDE the name line — "The step
                     * number needs to be smaller, maybe around 75% of the title size" —
                     * and asked for the full stop and the space. A number on its own line
                     * can be zero-padded because it is a column of numbers; a label on the
                     * front of a name is not, and "01. Preinfusion" reads as a version.
                     * Ben's ruling outranks the oracle wherever the two disagree. */
                    const drawn = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const cell = el.shadowRoot.querySelector('[data-cell="head-0"]');
                        const mode = cell.querySelector('.mode');
                        return {
                            ordinal: cell.querySelector('.ordinal').textContent.trim(),
                            mode: mode ? mode.textContent.trim() : null,
                            tone: mode ? mode.dataset.tone : null,
                            spoken: cell.querySelector('.a11y').textContent.trim(),
                        };
                    }, 'step-matrix');
                    assert.equal(drawn.ordinal, '1.', 'the number and the full stop Ben asked for');
                    assert.equal(drawn.mode, 'Flow', 'the mode table\'s own word');
                    assert.equal(drawn.tone, 'flow', 'and the tint is data, not a colour in a template');
                    assert.equal(drawn.spoken, 'Step 1 of 2',
                        'the sentence is not lost — it is spoken, with both placeholders');
                }, { steps: steps(2) }));

            test('the limiter draws OFF, not a number the profile does not carry',
                () => mounted(async (page) => {
                    const cells = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const read = (i) => {
                            const s = el.shadowRoot.querySelector(`[data-cell="limiter-${i}"] ui-stepper`);
                            const r = s.shadowRoot;
                            return {
                                number: r.getElementById('number').textContent.trim(),
                                unit: r.getElementById('unit')?.textContent.trim() ?? null,
                                spoken: r.getElementById('value')?.getAttribute('aria-label'),
                            };
                        };
                        return [read(0), read(1), read(2)];
                    }, 'step-matrix');
                    assert.equal(cells[0].number, 'OFF', 'a null limiter is OFF, not 0.0');
                    assert.equal(cells[1].number, 'OFF', 'and so is a typed zero — one state');
                    assert.equal(cells[2].number, '9.0', 'a set limit is still its number');
                    assert.equal(cells[2].unit, 'bar', 'a set limit prints its measure');

                    /* THE ONE PLACE THIS CELL DOES NOT FOLLOW THE ORACLE, and it is a
                     * decision rather than a drift — made in the same commit as the rest of
                     * this parity work (0.1.18), with its reason written where it is made
                     * (ui-stepper.js): Slate draws "OFF" and then "bar", which reads as a
                     * QUANTITY IN BAR. "OFF" on its own reads as what it is.
                     *
                     * AND "OFF" IS THE WHOLE ANSWER. The row is named `Limiter` and the
                     * measure only means anything once there is a number in it — a limit
                     * that is switched off is not switched off IN BAR. So nothing has to
                     * carry the unit here, and the editable cell that does carry it (in its
                     * accessible name) is asserted below rather than assumed. */
                    assert.equal(cells[0].unit, null, 'an OFF value prints no unit beside it');
                    assert.equal(cells[1].unit, null, 'and a typed zero is the same state');
                }, {
                    steps: [
                        matrixStep({ limiter: null }),
                        matrixStep({ limiter: { value: 0, range: 0.6 } }),
                        matrixStep({ limiter: { value: 9, range: 0.6 } }),
                    ],
                }));

            test('an EDITABLE limiter still speaks its measure, off or not',
                () => mounted(async (page) => {
                    /* ui-stepper names its value button `<label>, <value> <unit>` and the
                     * unit is dropped from the PAINT only — so an editable OFF limiter
                     * announces the measure even though nothing is drawn beside it. The
                     * read-only cell above has no such name and does not need one: its
                     * announcement is its text, and "OFF" is the whole answer there.
                     *
                     * ui-stepper's own note claims this for every stepper. It is true for
                     * the editable branch, which is the one that has a name to put it in. */
                    const spoken = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const read = (i) => el.shadowRoot
                            .querySelector(`[data-cell="limiter-${i}"] ui-stepper`)
                            .shadowRoot.getElementById('value').getAttribute('aria-label');
                        return [read(0), read(2)];
                    }, 'step-matrix');
                    assert.match(spoken[0], /bar/, 'an OFF limiter still says which measure is off');
                    assert.match(spoken[0], /OFF/, 'and says that it is off');
                    assert.match(spoken[1], /9\.0 bar/, 'and a set one says its number and measure');
                }, {
                    editable: true,
                    steps: [
                        matrixStep({ limiter: null }),
                        matrixStep({ limiter: { value: 0, range: 0.6 } }),
                        matrixStep({ limiter: { value: 9, range: 0.6 } }),
                    ],
                }));

            test('Max Duration draws "s" in the cell', () => mounted(async (page) => {
                const unit = await page.evalFn((sel) => window.__h.need(sel).shadowRoot
                    .querySelector('[data-cell="duration-0"] ui-stepper')
                    .shadowRoot.getElementById('unit').textContent.trim(), 'step-matrix');
                assert.equal(unit, 's', 'ORACLE .pe-value-unit; the range still says sec');
            }, { steps: steps(2) }));

            test('the rail is in Slate\'s small caps', () => mounted(async (page) => {
                assert.equal(await page.prop(`${matrixRail('duration')} > .rail-label`, 'text-transform'),
                    'uppercase',
                    'ORACLE .pe-grid-label text-transform uppercase, on all ten label cells');
                const authored = await page.evalFn((sel) => window.__h.need(sel)
                    .shadowRoot.querySelector('[data-rail="exits"] .rail-label')
                    .textContent.trim(), 'step-matrix');
                assert.equal(authored, 'Exit when',
                    'and the CASE is paint — the accessible name keeps the author\'s wording');
            }, { steps: steps(2) }));

            test('the tracks FILL the region, so no seam ground is left beside them',
                () => mounted(async (page) => {
                    /* SLATE'S STEP TRACK IS FIXED — grid-template-columns "192px 431px
                     * 431px" on a two-step profile — and ours is 1fr. That difference is
                     * OPEN, deliberately: see the track list in step-matrix.js for the two
                     * things a fixed track cost when it was measured in place (a 900px
                     * slab of uncovered --ui-line, and a box that would not shrink to its
                     * own tracks, clipping the last column at 864px of 1022).
                     *
                     * THE DIFFERENCE IS CLOSED NOW, AND IT IS CLOSED THE WAY THIS COMMENT
                     * ASKED FOR: the step tracks ARE Slate's constants (0.1.18), and a
                     * trailing minmax(0, 1fr) FILLER track carries the remainder. So the
                     * property asserted here is unchanged — the tracks sum to the
                     * scrollport and this host's seam ground is covered edge to edge — and
                     * the filler is counted rather than sliced off, because the filler is
                     * what does the covering. */
                    const cols = await usedColumns(page);
                    assert.equal(cols.length, 3, 'the rail and two step columns');
                    const filler = await fillerTrack(page);
                    assert.ok(filler > 0,
                        'at a 1900px stage the filler must have a real width to cover');

                    const m = await page.metrics(EDITOR.matrix);
                    const seam = px(await page.resolveToken('--ui-seam', 'inline-size')) || 1;
                    const total = cols.reduce((a, b) => a + b, 0) + filler + seam * cols.length;
                    near(total, m.clientWidth, 'the tracks and their seams fill the scrollport', 3);

                    /* AND THE FILLER IS PAINTED, not a gap with a track in it. E1's class
                     * is a declared thing wired to nothing; a filler track with no cell
                     * over it is the same bar of --ui-line this test exists to forbid. */
                    const covered = await page.evalFn((sel) => {
                        const el = window.__h.need(sel);
                        const node = el.shadowRoot.querySelector('.filler');
                        if (!node) return null;
                        const r = node.getBoundingClientRect();
                        return { width: r.width, right: r.right, hostRight: el.getBoundingClientRect().right };
                    }, EDITOR.matrix);
                    assert.ok(covered, 'the filler track must have a cell over it');
                    near(covered.width, filler, 'and the cell is the width of its track', 2);

                    for (const width of cols.slice(1)) {
                        assert.ok(width >= 300, `and no column collapses under E15's floor: ${width}`);
                    }
                }, { steps: steps(2), stage: 'inline-size: 1900px; block-size: 100dvh' }));
        });
    });
}
