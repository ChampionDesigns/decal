/**
 *.5, the step-matrix cluster: step-matrix-grid, step-matrix-scroll, compact-density, locked-value-box, exit-chip-sentence, exit-band-slots, action-key-rail, matrix-accessibility, step-name-input.
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

/** N plain steps. Values only — no fixture here states a bound. */
const steps = (n, over = () => ({})) => Array.from({ length: n }, (_, i) => matrixStep({
    name: `Step ${i + 1}`, ...over(i),
}));

/** The used track sizes of the matrix, as numbers. */
const usedColumns = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-columns'))
    .map(px)
    .slice(0, -1);

/** The filler's own track, for the one test that is about the filler. */
const fillerTrack = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-columns'))
    .map(px)
    .at(-1);
const usedRows = async (page) => tracks(await page.prop(EDITOR.matrix, 'grid-template-rows')).map(px);

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

        test('one grid: rail + N step columns, ten rows, and no literal track list',
            () => mounted(async (page) => {
                const authored = await matrixAuthored(page);
                assert.equal(authored.rows.length, 10);

                const columns = await usedColumns(page);
                assert.equal(columns.length, 1 + 3, 'the rail plus one track per step');

                const rows = await usedRows(page);
                assert.equal(rows.length, authored.rows.length,
                    'ten rows, and every one of them implicit — nothing declares a row track');

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

                await page.setStyle(EDITOR.matrix, { '--_ui-step-count': '2' });
                await page.settle(3);
                const after = await usedColumns(page);
                assert.equal(after.length, 3, 'the used track list follows the count');
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

        test('fill above, horizontal scroll below, and the flip happens exactly once',
            () => mounted(async (page) => {
                const sweep = await sweepFill(page, { from: 1400, to: 320, step: 8 });
                assert.equal(sweep.flips.length, 1,
                    `exactly one fill/scroll flip, got ${sweep.flips.length}`);

                const flip = sweep.flips[0];
                assert.equal(flip.scrolls, true, 'the flip is fill -> scroll as the width shrinks');

                await setEditorWidth(page, `${flip.w + 8}px`);
                const filled = await usedColumns(page);
                const seam = px(await page.resolveToken('--ui-seam', 'inline-size'));
                const need = filled.reduce((a, b) => a + b, 0) + seam * (filled.length - 1);
                const m = await page.metrics(EDITOR.matrix);
                assert.ok(need <= m.clientWidth + 1,
                    'one step above the flip the tracks still fit the scrollport');

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
                const fill = await matrixVar(page, '--_ui-step-w-fill');
                await setEditorWidth(page, `${geometry.width}px`);
                const stepColumns = (await usedColumns(page)).slice(1);
                for (const width of stepColumns) {
                    near(width, stepColumns[0], 'equal step columns', 1);
                    near(width, fill, 'at two steps every column is the fill width', 1);
                }

                await setEditorWidth(page, '1400px');
                const m = await page.metrics(EDITOR.matrix);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                    'given the width the tracks ask for, nothing scrolls horizontally');
            }, { steps: steps(2) }));

        test('the rail is sticky and stays put while the step columns scroll under it',
            () => mounted(async (page) => {
                const before = await page.box(matrixRail('pump'));
                assert.equal(await page.prop(matrixRail('pump'), 'position'), 'sticky');

                /* the rule's first leftover is "z-index: 2 on a position: static element". This
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

        test('the rail has the bar ground, not the cells\', and no label is clipped',
            () => mounted(async (page) => {
                assert.equal(await page.prop(matrixRail('duration'), 'background-color'),
                    await page.resolveToken('--ui-bar', 'background-color'),
                    'the rail ground is the bar token');
                assert.notEqual(await page.prop(matrixRail('duration'), 'background-color'),
                    await page.prop(matrixCell('duration', 0), 'background-color'),
                    'and it is not the cells\' ground, which is the point of it');

                for (const row of ['head', 'temperature', 'probe', 'pump', 'transition',
                    'target', 'limiter', 'duration', 'exits']) {
                    const m = await page.metrics(`${matrixRail(row)} > .rail-label`);
                    assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                        `${row}: the rail label is clipped (${m.scrollWidth} in ${m.clientWidth})`);
                }
            }));

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
                await page.setStyle('#stage', { 'block-size': '1600px' });
                await page.settle(4);
                assert.equal(await page.prop(EDITOR.matrix, 'align-content'), 'stretch');

                const rows = await usedRows(page);
                const total = rows.reduce((a, b) => a + b, 0);
                const m = await page.metrics(EDITOR.matrix);
                near(total, m.clientHeight, 'the rows fill the box exactly — no seam ground left over', 2);

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

        test('compact moves the vertical rhythm, and NOTHING else moves with it',
            () => mounted(async (page) => {
                const read = async () => ({
                    row: (await page.box(matrixCell('temperature', 0))).height,
                    control: (await page.box(matrixControl('temperature', 0, 'ui-stepper'))).height,
                    cap: await page.box(`${matrixControl('temperature', 0, 'ui-stepper')} >>> #decrement`),
                    padding: px(await page.prop(matrixCell('temperature', 0), 'padding-top')),
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

                /* NOR DOES THE TOUCH FLOOR. The cap is 's own re-declaration
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
                const root = parseFloat(await page.evalFn(
                    () => getComputedStyle(document.documentElement).getPropertyValue('--ui-density'),
                ));
                const inside = parseFloat(await page.evalFn(
                    (s) => getComputedStyle(window.__h.need(s)).getPropertyValue('--ui-density'),
                    EDITOR.matrix,
                ));
                assert.equal(inside, root, 'one --ui-density, and the matrix does not re-declare it');
            }, { steps: steps(2) }));

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
                    const words = record.sentence.replace(/\s+/g, '');
                    assert.equal(rendered.replace(/\s+/g, ''), words,
                        `slot ${record.slot}: the visible sentence and the seam are one value`);
                }

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
                const nodes = await accessibleNames(page);
                const groups = namesFor(nodes, 'group').filter((n) => /^(Exit when|Step actions), step/.test(n));
                assert.equal(groups.length, 3 * 2, 'one exit group and one action group per step');
                assert.equal(new Set(groups).size, groups.length, 'each named for its own step');
            }, { steps: steps(3) }));

        test('the keyboard reaches every step column, in order', () => mounted(async (page) => {

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

        test('a cell change leaves as one event with its coordinates, and mutates nothing',
            () => mounted(async (page) => {
                const authored = await matrixAuthored(page);
                await page.evalFn(() => { window.__recorded = []; });
                await page.evalFn((sel, type) => window.__h.record(sel, [type, 'change']),
                    EDITOR.matrix, authored.change);

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

        describe('the drawn half matches the oracle', () => {
            test('the head cell is the ordinal, the name and the MODE — Slate\'s three lines',
                () => mounted(async (page) => {
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
                    assert.equal(drawn.ordinal, '1.', 'the number and the full stop asked for');
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
                    const cols = await usedColumns(page);
                    assert.equal(cols.length, 3, 'the rail and two step columns');
                    const filler = await fillerTrack(page);
                    assert.ok(filler > 0,
                        'at a 1900px stage the filler must have a real width to cover');

                    const m = await page.metrics(EDITOR.matrix);
                    const seam = px(await page.resolveToken('--ui-seam', 'inline-size')) || 1;
                    const total = cols.reduce((a, b) => a + b, 0) + filler + seam * cols.length;
                    near(total, m.clientWidth, 'the tracks and their seams fill the scrollport', 3);

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
