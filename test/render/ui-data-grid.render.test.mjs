/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-data-grid.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-data-grid.js'];

/** Live's shot-data panel / the HV data page: a row-header column and three channels. */
const PHASE_COLUMNS = [
    { key: 'time', label: 'Time', unit: 's' },
    { key: 'weight', label: 'Weight', unit: 'g', align: 'end' },
    { key: 'volume', label: 'Volume', unit: 'mL', ink: 'var(--ui-channel-volume)' },
];
const PHASE_ROWS = [
    { key: 'preinfusion', header: 'Preinfusion', cells: { time: 15, weight: 10, volume: 17 } },
    { key: 'extraction', header: 'Extraction', cells: { time: 30, weight: 29 } },
    { key: 'total', header: 'Total', emphasis: true, cells: { time: 45, weight: 39, volume: 57 } },
];

/** The HV shot list: no row-header column, one control column, and a wide name track. */
const LIST_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'name', label: 'Profile', grow: 2 },
    { key: 'yield', label: 'Yield', unit: 'g', align: 'end' },
    { key: 'ab', label: 'A / B', slot: true, align: 'end' },
];
const LIST_ROWS = Array.from({ length: 8 }, (_, i) => ({
    key: `s${i}`,
    cells: { date: '12 Aug', name: 'Londinium classic', yield: (36 + i).toFixed(1) },
}));

const AB_BUTTONS = LIST_ROWS
    .map((row, i) => `<button id="ab-${i}" slot="cell-${row.key}-ab">A</button>`)
    .join('');

const MARKUP = `
<div id="phase-host" style="inline-size: 760px">
    <ui-data-grid id="phase" label="Shot data by phase" row-header-label="Phase"></ui-data-grid>
</div>

<div id="list-host" style="inline-size: 620px; block-size: 200px; display: grid; grid-template-rows: minmax(0, 1fr)">
    <ui-data-grid id="list" label="Stored shots">${AB_BUTTONS}</ui-data-grid>
</div>

<div id="narrow-host" style="inline-size: 240px">
    <ui-data-grid id="narrow" label="Narrow"></ui-data-grid>
</div>

<div id="empty-host" style="inline-size: 480px">
    <ui-data-grid id="empty" label="No shots">
        <p slot="empty" id="empty-copy">No shots stored yet.</p>
        <div id="stowaway" role="gridcell">a cell with nowhere to go</div>
    </ui-data-grid>
</div>
`;

const ORACLE = {
    dark: {
        ground: 'rgb(14, 19, 23)',
        muted: 'rgb(148, 161, 169)',
        text: 'rgb(244, 247, 248)',
        lineStrong: 'rgb(82, 97, 107)',
    },
    light: {
        ground: 'rgb(242, 243, 243)',
        muted: 'rgb(90, 101, 108)',
        text: 'rgb(23, 26, 28)',
        lineStrong: 'rgb(170, 178, 183)',
    },
    /* Theme-independent, from the same records. */
    colFontSize: '14px',
    rowHeadFontSize: '15px',
    cellFontSize: '17px',
    unitWeight: '400',
    unitTracking: 'normal',
    unitTransform: 'none',
    transform: 'uppercase',
    /* The values this build deliberately does NOT reproduce — see DEPARTURES. */
    slateSemibold: '600',
    slateLight: '300',
    slateColTracking: '1.4px',
    slateRowHeadTracking: '1.8px',
    slateHvRowHeadSize: '20px',
    slateHvRowHeadTrackWidth: 210,
    slateCellHeight: 34,
    slatePanelEdge: '1px',
    slateColGap: '6px',
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-data-grid @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-data-grid must mount without throwing');
            await page.evalFn((phaseCols, phaseRows, listCols, listRows) => {
                const set = (id, columns, rows) => {
                    const el = document.getElementById(id);
                    el.columns = columns;
                    el.rows = rows;
                };
                set('phase', phaseCols, phaseRows);
                set('list', listCols, listRows);
                set('narrow', listCols, listRows);
                set('empty', phaseCols, []);
                return true;
            }, PHASE_COLUMNS, PHASE_ROWS, LIST_COLUMNS, LIST_ROWS);
            await page.settle();
            return fn(page);
        });

        /** Every track of a grid, as numbers. */
        const tracks = async (page, selector) => (await page.prop(selector, 'grid-template-columns'))
            .split(' ')
            .map((t) => parseFloat(t));

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('drill: --ui-fascia is the ground (L12\'s class)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#phase >>> #frame',
                property: 'background-color',
            });
        }));

        test('drill: --ui-space-5 / --ui-space-3 are the column and row gaps', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#phase >>> #table',
                property: 'column-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: '37px',
                selector: '#phase >>> #table',
                property: 'row-gap',
            });
        }));

        test('drill: --ui-space-1 is the label/unit gap and the cell\'s block padding', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: '37px',
                selector: '#phase >>> #col-time',
                property: 'column-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: '37px',
                selector: '#phase >>> #cell-total-time',
                property: 'padding-top',
            });
        }));

        test('drill: --ui-seam and --ui-line are the header rule (departure 2)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam',
                value: '37px',
                selector: '#phase >>> #rule',
                property: 'height',
            });
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#phase >>> #rule',
                property: 'background-color',
            });
        }));

        test('drill: the column header is the shared role at --ui-text-2xs', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-2xs',
                value: '31px',
                selector: '#phase >>> #col-time',
                property: 'font-size',
            });
            for (const token of ['--ui-muted', '--ui-weight-semibold', '--ui-tracking-cap']) {
                await assertTokenDrill(page, {
                    token,
                    value: token === '--ui-muted' ? DRILL_COLOUR
                        : token === '--ui-weight-semibold' ? '300' : '5px',
                    selector: '#phase >>> #col-time',
                    property: token === '--ui-muted' ? 'color'
                        : token === '--ui-weight-semibold' ? 'font-weight' : 'letter-spacing',
                    expected: token === '--ui-weight-semibold' ? '300' : null,
                });
            }
        }));

        test('drill: the row header is the shared role at --ui-text-sm', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: '31px',
                selector: '#phase >>> #rowhead-preinfusion',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#phase >>> #rowhead-preinfusion',
                property: 'color',
            });
        }));

        test('drill: the cell is --ui-text-base / --ui-weight-light / --ui-text', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base',
                value: '31px',
                selector: '#phase >>> #cell-preinfusion-time',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-light',
                value: '200',
                selector: '#phase >>> #cell-preinfusion-time',
                property: 'font-weight',
                expected: '200',
            });
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#phase >>> #cell-preinfusion-time',
                property: 'color',
            });
        }));

        test('drill: --ui-weight-regular is the emphasised row', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-regular',
                value: '200',
                selector: '#phase >>> #cell-total-time',
                property: 'font-weight',
                expected: '200',
            });
        }));

        test('drill: a column\'s ink is a --ui-channel-* token, and only a token', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-channel-volume',
                value: DRILL_COLOUR,
                selector: '#phase >>> #cell-preinfusion-volume',
                property: 'color',
            });

            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#phase >>> #cell-preinfusion-time',
                property: 'color',
            });

            const before = await page.prop('#phase >>> #cell-preinfusion-volume', 'color');
            await page.evalFn(() => {
                const el = document.getElementById('phase');
                el.columns = el.columns.map((c) => (c.key === 'volume'
                    ? { ...c, ink: 'rgb(255, 0, 170)' }
                    : c));
                return true;
            });
            await page.settle();
            const after = await page.prop('#phase >>> #cell-preinfusion-volume', 'color');
            assert.notEqual(after, DRILL_COLOUR,
                'a raw colour literal passed as a column ink was obeyed — it must be '
                + 'ignored (CONVENTIONS §7, "tokens in, nothing out")');
            assert.notEqual(after, before,
                'the literal was ignored, so the column must fall back rather than keep '
                + 'the ink it had — an ignored value that leaves the old paint in place '
                + 'is indistinguishable from an accepted one');
            assert.equal(after, await page.resolveToken('--ui-text', 'color'),
                'and the fallback is the cell ink the oracle measured: live-ready '
                + '#shot-data-pi-time [i=134] color <- authored var(--slate-text)');
        }));

        test('drill: --ui-focus-offset-inset reaches a slotted control (L24\'s fix)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-focus-offset-inset',
                value: '-9px',
                selector: '#ab-0',
                property: 'outline-offset',
                expected: '-9px',
                prepare: (p) => p.focusVisible('#ab-0'),
            });
        }));

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                assert.equal(await page.prop('#phase >>> #frame', 'background-color'), want.ground,
                    `${theme}: live-ready #shot-data-panel [i=126] background-color (= --ui-fascia)`);

                assert.equal(await page.prop('#phase >>> #rowhead-preinfusion', 'color'), want.muted,
                    `${theme}: live-ready .h-9 [i=133] role=rowheader color <- authored var(--slate-muted)`);
                assert.equal(await page.prop('#phase >>> #col-time', 'color'), want.muted,
                    `${theme}: history-shotdata .sx-data-col [i=178] color <- authored var(--slate-muted)`);
                assert.equal(await page.prop('#phase >>> #col-time .unit', 'color'), want.muted,
                    `${theme}: live-ready .shot-data-col-unit [i=128] color <- authored var(--slate-muted)`);

                assert.equal(await page.prop('#phase >>> #cell-preinfusion-time', 'color'), want.text,
                    `${theme}: live-ready #shot-data-pi-time [i=134] color <- authored var(--slate-text)`);
            }
            await page.setTheme('dark');
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const col = await page.computed('#phase >>> #col-time',
                ['font-size', 'text-transform', 'align-items']);
            assert.equal(col['font-size'], ORACLE.colFontSize,
                'live-ready <span> [i=127] font-size = 14px  (= --ui-text-2xs)');
            assert.equal(col['text-transform'], ORACLE.transform,
                'history-shotdata .sx-data-col [i=178] text-transform = uppercase');
            assert.equal(col['align-items'], 'baseline',
                '.sx-data-col { display: flex; align-items: baseline }');

            const unit = await page.computed('#phase >>> #col-time .unit',
                ['font-size', 'font-weight', 'letter-spacing', 'text-transform']);
            assert.equal(unit['font-size'], ORACLE.colFontSize,
                'live-ready .shot-data-col-unit [i=128] font-size = 14px');
            assert.equal(unit['font-weight'], ORACLE.unitWeight,
                'live-ready .shot-data-col-unit [i=128] font-weight = 400 <- var(--slate-weight-regular)');
            assert.equal(unit['letter-spacing'], ORACLE.unitTracking,
                'live-ready .shot-data-col-unit [i=128] letter-spacing = normal');
            assert.equal(unit['text-transform'], ORACLE.unitTransform,
                'verbatim: "Not uppercased: mL is a unit, and ML is a different one"');

            const rowhead = await page.computed('#phase >>> #rowhead-preinfusion',
                ['font-size', 'text-transform']);
            assert.equal(rowhead['font-size'], ORACLE.rowHeadFontSize,
                'live-ready .h-9 [i=133] font-size = 15px  (= --ui-text-sm, the .ui-microcap role)');
            assert.equal(rowhead['text-transform'], ORACLE.transform,
                'live-ready .h-9 [i=133] text-transform = uppercase');

            assert.equal(await page.prop('#phase >>> #cell-preinfusion-time', 'font-size'),
                ORACLE.cellFontSize,
                'live-ready #shot-data-pi-time [i=134] font-size = 17px <- var(--slate-text-base)');
            assert.equal(await page.prop('#phase >>> #cell-preinfusion-time', 'font-family'),
                await page.resolveToken('--ui-font-family', 'font-family'),
                'live-ready #shot-data-pi-time [i=134] font-family <- var(--slate-font-numeric), '
                + 'which styles/tokens.css:346-347 records was already var(--slate-font-ui) — one family');
            assert.deepEqual(
                (await page.prop('#phase >>> #cell-preinfusion-time', 'font-variant-numeric'))
                    .split(' ').sort(),
                ['lining-nums', 'tabular-nums'],
                'the .ui-numeric modifier: a column of numbers must line up (bug L10 is a '
                + 'value left OUT of Slate\'s tabular-nums list)');
        }));

        test('DEPARTURE 1: no border on any side, ever (CONVENTIONS §13)', () => mounted(async (page) => {
            for (const selector of ['#phase', '#phase >>> #frame', '#phase >>> #table']) {
                const edges = await page.computed(selector,
                    ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']);
                assert.deepEqual(edges, {
                    'border-top-width': '0px',
                    'border-right-width': '0px',
                    'border-bottom-width': '0px',
                    'border-left-width': '0px',
                }, `${selector} draws an edge — a divider is a gap, not a border`);
            }
            assert.notEqual(ORACLE.slatePanelEdge, '0px',
                'for the record: Slate\'s panel DID carry 1px of --ui-line-strong — the '
                + 'divider changed owner, it did not disappear');

            assert.equal(await page.prop('#phase >>> #frame', 'background-color'),
                await page.resolveToken('--ui-fascia', 'background-color'));
        }));

        test('DEPARTURE 2: the header rule is ONE line across every track, not a border per cell', () => mounted(async (page) => {
            const table = await page.box('#phase >>> #table');
            const rule = await page.box('#phase >>> #rule');
            assert.ok(Math.abs(rule.width - table.width) < 0.5,
                `the rule spans ${rule.width} of a ${table.width} table — it must span 1 / -1`);
            assert.equal(await page.prop('#phase >>> #rule', 'height'),
                await page.resolveToken('--ui-seam', 'height'));

            // No header cell draws its own bottom edge — that is the anti-pattern.
            for (const id of ['#corner', '#col-time', '#col-weight', '#col-volume']) {
                assert.equal(await page.prop(`#phase >>> ${id}`, 'border-bottom-width'), '0px',
                    `${id} drew its own underline; a divider is the seam utility (§13), `
                    + 'never a per-cell border');
            }

            // It sits between the header row and the first body row, not somewhere else.
            const header = await page.box('#phase >>> #col-time');
            const first = await page.box('#phase >>> #cell-preinfusion-time');
            assert.ok(rule.top >= header.bottom - 0.5 && rule.bottom <= first.top + 0.5,
                `the rule at ${rule.top}–${rule.bottom} is not between the header `
                + `(ends ${header.bottom}) and the first row (starts ${first.top})`);
        }));

        test('DEPARTURE 3: the total row is emphasised, and on Live that emphasis was DEAD', () => mounted(async (page) => {
            const plain = await page.prop('#phase >>> #cell-preinfusion-time', 'font-weight');
            const total = await page.prop('#phase >>> #cell-total-time', 'font-weight');
            assert.notEqual(total, plain,
                'the emphasised row renders exactly like the others — which is Slate\'s '
                + 'measured state, and the thing this departure exists to end');
            assert.equal(plain, await page.resolveToken('--ui-weight-light', 'font-weight'));
            assert.equal(total, await page.resolveToken('--ui-weight-regular', 'font-weight'));
            assert.notEqual(total, ORACLE.slateSemibold,
                'not semibold either: 600 is the microcap role and no data cell in the '
                + 'corpus renders it');
            assert.equal(plain, ORACLE.slateLight,
                'the base cell IS Slate\'s 300 — parity surface 1 restored --ui-weight-light, '
                + 'so the pair is Slate\'s own 300 -> 400 rather than a synthesised 400 -> 500');

            assert.equal(await page.prop('#phase >>> #rowhead-total', 'color'),
                await page.resolveToken('--ui-text', 'color'));
            assert.equal(await page.prop('#phase >>> #rowhead-preinfusion', 'color'),
                await page.resolveToken('--ui-muted', 'color'));
        }));

        test('DEPARTURE 4: one row-header treatment, and it is Live\'s microcap', () => mounted(async (page) => {
            const rowhead = await page.computed('#phase >>> #rowhead-preinfusion',
                ['font-size', 'letter-spacing', 'text-transform']);
            assert.notEqual(rowhead['font-size'], ORACLE.slateHvRowHeadSize,
                'history-shotdata .sx-data-row [i=190] font-size = 20px — the HV '
                + 'page\'s own row label, which loses to the shared role');
            assert.equal(rowhead['font-size'], ORACLE.rowHeadFontSize);
            assert.notEqual(rowhead['text-transform'], ORACLE.unitTransform,
                'history-shotdata .sx-data-row [i=190] text-transform = none');
            assert.equal(rowhead['text-transform'], ORACLE.transform);

            assert.equal(rowhead['letter-spacing'], ORACLE.slateRowHeadTracking,
                'Slate measured 1.8px (.12em at 15px) and --ui-tracking-cap now carries it');
            assert.equal(Math.round(parseFloat(rowhead['letter-spacing']) * 100) / 100, 1.8,
                '.12em at 15px is 1.8px');
            const colTracking = await page.prop('#phase >>> #col-time', 'letter-spacing');
            assert.notEqual(colTracking, ORACLE.slateColTracking,
                'Slate tracks the column head .1em against the row head\'s .12em; one token ends that');
            assert.equal(Math.round(parseFloat(colTracking) * 100) / 100, 1.68,
                '.12em at 14px is 1.68px');
        }));

        test('DEPARTURE 5: the row height is a derivation, not 34px', () => mounted(async (page) => {
            const cell = await page.box('#phase >>> #cell-preinfusion-time');
            const fontSize = parseFloat(await page.prop('#phase >>> #cell-preinfusion-time', 'font-size'));
            const pad = parseFloat(await page.prop('#phase >>> #cell-preinfusion-time', 'padding-top'));
            const expected = fontSize * 1.5 + 2 * pad;
            assert.ok(Math.abs(cell.height - expected) < 0.5,
                `the cell is ${cell.height}px against a derivation of ${expected}px — `
                + 'the height must follow the type scale, not a literal');
            assert.ok(Math.abs(cell.height - ORACLE.slateCellHeight) < 1.5,
                `and it must land beside Slate's ${ORACLE.slateCellHeight}px, not somewhere `
                + `else entirely (measured ${cell.height})`);
        }));

        test('DEPARTURE 6: the unit sits beside its label, on one line', () => mounted(async (page) => {
            const label = await page.box('#phase >>> #col-time .col-label');
            const unit = await page.box('#phase >>> #col-time .unit');
            assert.ok(Math.abs(label.bottom - unit.bottom) < 1.5,
                `label bottom ${label.bottom} vs unit bottom ${unit.bottom} — they are `
                + 'stacked, which is Live\'s form, and §4.5 deleted its reason');
            assert.ok(unit.left >= label.right - 0.5,
                'the unit follows the label in the inline direction');
            assert.equal(await page.prop('#phase >>> #col-time', 'column-gap'),
                await page.resolveToken('--ui-space-1', 'column-gap'));
            assert.notEqual(await page.prop('#phase >>> #col-time', 'column-gap'), ORACLE.slateColGap,
                'history-shotdata .sx-data-col [i=178] gap = 6px — off the seven-step '
                + 'scale (§3.3), snapped to --ui-space-1');
        }));

        test('DEPARTURE 7: the frame states its overflow and never hides a scrollbar', () => mounted(async (page) => {
            const frame = await page.computed('#phase >>> #frame',
                ['overflow-x', 'overflow-y', 'min-block-size']);
            assert.equal(frame['overflow-x'], 'auto', 'spec §2.4: a stated overflow');
            assert.equal(frame['overflow-y'], 'auto');
            assert.equal(frame['min-block-size'], '0px',
                'NO BLOCK FLOOR: C2\'s five-phase measurement was never taken '
                + 'so this number is not this component\'s to invent');

            const frameBox = await page.box('#phase >>> #frame');
            const tableBox = await page.box('#phase >>> #table');
            assert.ok(Math.abs(frameBox.height - tableBox.height) < 0.5,
                `the frame is ${frameBox.height} against a ${tableBox.height} table in a `
                + 'parent with no height — a maximum that bit here would clip rows in '
                + 'ordinary flow');
            const metrics = await page.metrics('#phase >>> #frame');
            assert.ok(metrics.scrollHeight <= metrics.clientHeight + 0.5,
                'and nothing is scrolled out of sight when there is room for it');
        }));

        const SELECTION_READS = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];
        const SELECTION_PARTS = ['#frame', '#table', '#rule', '#corner', '#col-time',
            '#rowhead-total', '#cell-total-time'];

        const readSelectionSurface = async (page) => {
            const out = {};
            for (const part of SELECTION_PARTS) {
                out[part] = await page.computed(`#phase >>> ${part}`, SELECTION_READS);
            }
            out.host = await page.computed('#phase', SELECTION_READS);
            return out;
        };

        test('the four dials reach NOTHING here — there is no selection surface to move', () => mounted(async (page) => {
            const before = await readSelectionSurface(page);
            for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                '--ui-selected-led', '--ui-selected-glow']) {
                const value = dial === '--ui-selected-led' ? '37px'
                    : dial === '--ui-selected-glow' ? '60%' : DRILL_COLOUR;
                await page.setToken(dial, value);
                const during = await readSelectionSurface(page);
                await page.setToken(dial, null);
                assert.deepEqual(during, before,
                    `${dial} moved something on a component that has no selected state.`);
            }
        }));

        test('every selection spelling paints nothing — including one set INSIDE the shadow root', () => mounted(async (page) => {
            const before = await readSelectionSurface(page);

            for (const [name, value] of [
                ['selected', ''],
                ['aria-selected', 'true'],
                ['aria-pressed', 'true'],
                ['aria-checked', 'true'],
                ['aria-current', 'true'],
            ]) {
                await page.evalFn((n, v) => {
                    document.getElementById('phase').setAttribute(n, v);
                    return true;
                }, name, value);
                const during = await readSelectionSurface(page);
                await page.evalFn((n) => {
                    document.getElementById('phase').removeAttribute(n);
                    return true;
                }, name);
                assert.deepEqual(during, before,
                    `[${name}] on the host painted a selected look.`);
            }

            await page.evalFn((parts) => {
                const root = document.getElementById('phase').shadowRoot;
                for (const id of parts) {
                    const el = root.getElementById(id);
                    if (!el) continue;
                    el.classList.add('is-selected');
                    el.setAttribute('aria-current', 'true');
                }
                return true;
            }, SELECTION_PARTS.map((s) => s.slice(1)));
            await page.settle();
            const withInside = await readSelectionSurface(page);
            assert.deepEqual(withInside, before,
                '.is-selected / aria-current inside the shadow root painted something — '
                + 'selectionSurface must not be in this component\'s styles at all');
        }));

        test('a slotted control takes the ONE ring, and the scroll frame does not clip it (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#ab-0');
            assert.equal(g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'inside an overflow: auto frame the ring must be the INSET offset, or it '
                + 'is drawn outside the scrollport and clipped');

            await assertFocusUnclipped(page, `#ab-${LIST_ROWS.length - 1}`);
        }));

        test('the component itself takes no focus and offers no hit target', () => mounted(async (page) => {
            const focusables = await page.evalFn(() => {
                const root = document.getElementById('phase').shadowRoot;
                return root.querySelectorAll(
                    'a[href], button, input, select, textarea, summary, [tabindex]',
                ).length;
            });
            assert.equal(focusables, 0,
                'the shadow tree grew a focusable; the only interactive thing in a data '
                + 'grid is what a screen slots into a control column');
        }));

        test('equal columns are equal, and a grow: 2 column is twice its neighbours (§4.5 "become fr")', () => mounted(async (page) => {
            const phase = await tracks(page, '#phase >>> #table');
            assert.equal(phase.length, PHASE_COLUMNS.length + 1,
                'one track per column, plus the row-label track');
            const [, ...values] = phase;
            for (const width of values) {
                assert.ok(Math.abs(width - values[0]) < 1.5,
                    `value tracks disagree: ${values.join(' / ')} — "the columns are equal `
                    + 'because the channels are peers" ');
            }

            const list = await tracks(page, '#list >>> #table');
            assert.equal(list.length, LIST_COLUMNS.length, 'no row-label track without a corner');
            assert.ok(Math.abs(list[1] - 2 * list[0]) < 1.5,
                `grow: 2 gave ${list[1]} against a neighbour's ${list[0]} — the shot list's `
                + 'six fixed tracks totalling 554px become fr (spec §4.5)');

            assert.notEqual(Math.round(phase[0]), ORACLE.slateHvRowHeadTrackWidth,
                'history-shotdata .sx-data-row [i=190] width = 210px — the fixed '
                + 'row-label track §4.5 replaces');
        }));

        test('the row-label track is max-content ACROSS ALL ROWS — the one-grid proof (L20)', () => mounted(async (page) => {
            const before = (await tracks(page, '#phase >>> #table'))[0];
            const firstBefore = await page.box('#phase >>> #cell-preinfusion-time');

            await page.evalFn(() => {
                const el = document.getElementById('phase');
                el.rows = el.rows.map((r) => (r.key === 'total'
                    ? { ...r, header: 'Total including preinfusion' }
                    : r));
                return true;
            });
            await page.settle();

            const after = (await tracks(page, '#phase >>> #table'))[0];
            const firstAfter = await page.box('#phase >>> #cell-preinfusion-time');
            assert.ok(after > before + 1,
                `the row-label track stayed ${before}px when a LATER row's label grew — `
                + 'the rows are not sharing one grid');
            assert.ok(firstAfter.x > firstBefore.x + 1,
                'and the first row\'s cells must move with it, which is what "the columns '
                + 'line up by construction" means');
        }));

        test('below the sum of the ch minimums the frame scrolls inline, with a gutter', () => mounted(async (page) => {
            const at240 = await tracks(page, '#narrow >>> #table');
            const wide = await page.metrics('#narrow >>> #frame');
            assert.ok(wide.scrollWidth > wide.clientWidth + 0.5,
                `the grid fits in ${wide.clientWidth}px with ${LIST_COLUMNS.length} columns `
                + '— squeeze the fixture harder or the floor is not being reached');

            await page.setStyle('#narrow-host', { 'inline-size': '200px' });
            const at200 = await tracks(page, '#narrow >>> #table');
            await page.setStyle('#narrow-host', { 'inline-size': '240px' });

            for (const [i, width] of at200.entries()) {
                assert.ok(Math.abs(width - at240[i]) < 0.5,
                    `track ${i} went ${at240[i]} -> ${width} when the container lost 40px `
                    + '— the ch minimums are not holding, so a column can collapse to nothing');
            }

            await assertScrollFloor(page, {
                selector: '#narrow >>> #frame',
                squeeze: { 'inline-size': '200px' },
                squeezeSelector: '#narrow-host',
                axis: 'inline',
            });
        }));

        test('in a definite block track the frame scrolls in the block axis (§4.5, "the list scrolls")', () => mounted(async (page) => {
            await assertScrollFloor(page, {
                selector: '#list >>> #frame',
                squeeze: { 'block-size': '120px' },
                squeezeSelector: '#list-host',
                axis: 'block',
            });
        }));

        test('an empty grid keeps its column legend and hands the space to #38', () => mounted(async (page) => {
            assert.ok(await page.exists('#empty >>> #head'), 'the header survives');
            assert.ok(!(await page.exists('#empty >>> #body')), 'and there is no body rowgroup');
            assert.ok(await page.exists('#empty >>> #empty'), 'the empty region is there');
            const copy = await page.box('#empty-copy');
            assert.ok(copy.height > 0, 'the slotted empty state is laid out');
            const rule = await page.box('#empty >>> #rule');
            assert.ok(copy.top >= rule.bottom - 0.5,
                'and it sits under the header rule, not over it');
        }));

        const STRUCTURELESS = new Set(['none', 'generic', 'GenericContainer', 'InlineTextBox']);

        const axTree = async (page, name) => {
            await page.send('Accessibility.enable');
            const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
            const byId = new Map(nodes.map((n) => [n.nodeId, n]));
            const parent = new Map();
            for (const n of nodes) {
                for (const child of n.childIds ?? []) parent.set(child, n.nodeId);
            }
            const table = nodes.find((n) => n.role?.value === 'table' && n.name?.value === name);
            const role = (id) => byId.get(id)?.role?.value ?? null;
            const kids = (n) => (n?.childIds ?? []).map((id) => byId.get(id)).filter(Boolean);

            /** The nearest ancestor that means something structurally. */
            const owner = (nodeId) => {
                let at = parent.get(nodeId);
                while (at !== undefined && STRUCTURELESS.has(role(at))) at = parent.get(at);
                return at;
            };
            /** The subtree under one table — the page carries four grids at once. */
            const within = (root) => {
                const out = [];
                const walk = (node) => {
                    if (!node) return;
                    out.push(node);
                    for (const child of kids(node)) walk(child);
                };
                walk(root);
                return out;
            };
            return { nodes, byId, parent, table, role, kids, owner, within };
        };

        test('H4 is inexpressible: every cell is inside a row, and the table\'s children are rowgroups only', () => mounted(async (page) => {
            const ax = await axTree(page, 'Shot data by phase');
            assert.ok(ax.table, 'the table must be in the accessibility tree at all');

            const children = ax.kids(ax.table).map((n) => n.role?.value);
            assert.deepEqual(children, ['rowgroup', 'rowgroup'],
                `the table's AX children are ${children.join(', ')} — a table may own only `
                + 'rows and rowgroups, and Slate owned 27 role-bearing cells directly');

            const CELL_ROLES = ['cell', 'gridcell', 'columnheader', 'rowheader'];
            const cells = ax.within(ax.table).filter((n) => CELL_ROLES.includes(n.role?.value));
            assert.equal(cells.length, (PHASE_COLUMNS.length + 1) * (PHASE_ROWS.length + 1),
                'every column of every row, header row included, is a cell in the AX tree');
            for (const cell of cells) {
                assert.equal(ax.role(ax.owner(cell.nodeId)), 'row',
                    `a ${cell.role.value} named "${cell.name?.value}" is owned by `
                    + `${ax.role(ax.owner(cell.nodeId))}, not by a row — H4 exactly`);
            }
        }));

        test('L23 is inexpressible: rows are owned, and the only aria-label is on the roled element', () => mounted(async (page) => {
            const ax = await axTree(page, 'Shot data by phase');
            const rows = ax.within(ax.table).filter((n) => n.role?.value === 'row');
            assert.equal(rows.length, PHASE_ROWS.length + 1);
            for (const row of rows) {
                const owner = ax.owner(row.nodeId);
                assert.equal(ax.role(owner), 'rowgroup',
                    `a row is owned by ${ax.role(owner)} — L23 exactly`);
                assert.equal(ax.role(ax.owner(owner)), 'table',
                    'and its rowgroup must be owned by the table itself');
            }

            const labelled = await page.evalFn(() => {
                const root = document.getElementById('phase').shadowRoot;
                return [...root.querySelectorAll('[aria-label]')].map((el) => ({
                    id: el.id, role: el.getAttribute('role'),
                }));
            });
            assert.deepEqual(labelled, [{ id: 'table', role: 'table' }],
                'an aria-label landed on something without a role — L23\'s first clause');

            assert.equal(await page.evalFn(
                () => document.getElementById('phase').hasAttribute('aria-label'),
            ), false);
        }));

        test('a consumer cannot inject an unowned cell: there is no default slot', () => mounted(async (page) => {
            const stowaway = await page.evalFn(() => {
                const el = document.getElementById('stowaway');
                return { assigned: el.assignedSlot ? el.assignedSlot.name : null, rect: el.getBoundingClientRect().height };
            });
            assert.equal(stowaway.assigned, null,
                'a role="gridcell" div slotted into nothing found a slot — a default slot '
                + 'inside the table would be exactly Slate\'s appendChild');
            assert.equal(stowaway.rect, 0, 'and it must not be laid out at all');

            const ax = await axTree(page, 'No shots');
            const strays = ax.nodes.filter((n) => (n.name?.value ?? '').includes('nowhere to go')
                && n.ignored !== true);
            assert.deepEqual(strays.map((n) => n.role?.value), [],
                'the unassigned cell reached the accessibility tree');
        }));

        test('a control slotted into a cell keeps its own AX node, inside its row', () => mounted(async (page) => {
            const ax = await axTree(page, 'Stored shots');
            const button = ax.within(ax.table).find((n) => n.role?.value === 'button');
            assert.ok(button, 'the slotted button is gone from the accessibility tree');
            assert.equal(button.ignored, false);
            const cell = ax.owner(button.nodeId);
            assert.equal(ax.role(cell), 'cell', 'the button must be inside its cell');
            assert.equal(ax.role(ax.owner(cell)), 'row', 'and that cell inside a row');
        }));

        test('the accessible name is `label`, it moves, and the unit is part of a header\'s name', () => mounted(async (page) => {
            const ax = await axTree(page, 'Shot data by phase');
            assert.ok(ax.table);

            const header = ax.nodes.find((n) => n.role?.value === 'columnheader'
                && (n.name?.value ?? '').startsWith('WEIGHT'));
            assert.ok(header, 'the weight column header is not in the accessibility tree');
            assert.match(header.name.value, /\bg\b/,
                'the unit must be part of the header\'s accessible name, so a reader '
                + 'announcing a cell says "Weight g" — the unit belongs to the column, '
                + 'not to every cell in it ');

            assert.equal(await page.evalFn(
                () => window.__h.q('#phase >>> #col-weight .col-label').textContent,
            ), 'Weight', 'text-transform is paint: the markup keeps the author\'s case');
            assert.equal(header.name.value.slice(0, 6), 'WEIGHT',
                'while Chrome\'s AX name is the rendered text — recorded, not fixed here');

            // The name is the property, and it moves with it.
            await page.evalFn(() => {
                document.getElementById('phase').label = 'Shot B data by phase';
                return true;
            });
            await page.settle();
            const moved = await axTree(page, 'Shot B data by phase');
            assert.ok(moved.table, 'label did not reach the accessible name');
        }));

        test('the corner is a columnheader and the header rule is not in the tree at all', () => mounted(async (page) => {
            const ax = await axTree(page, 'Shot data by phase');
            const corner = ax.within(ax.table).find((n) => n.role?.value === 'columnheader'
                && n.name?.value === 'PHASE');
            assert.ok(corner, 'the corner must be a columnheader carrying the row-header label');
            assert.equal(await page.evalFn(
                () => window.__h.q('#phase >>> #corner .col-label').textContent,
            ), 'Phase', 'and the markup keeps the author\'s case — the uppercase is paint');
            assert.equal(await page.prop('#phase >>> #corner', 'font-size'),
                await page.prop('#phase >>> #col-time', 'font-size'),
                'the corner is a header like the others, not a fourth type treatment');

            const ruleNode = await page.evalFn(() => {
                const el = document.getElementById('phase').shadowRoot.getElementById('rule');
                return { role: el.getAttribute('role'), hidden: el.getAttribute('aria-hidden') };
            });
            assert.deepEqual(ruleNode, { role: 'presentation', hidden: 'true' });
        }));

        test('an absence renders the dash, and nothing else ever happens to it (A7)', () => mounted(async (page) => {
            const text = (selector) => page.evalFn((s) => window.__h.q(s).textContent.trim(), selector);
            assert.equal(await text('#phase >>> #cell-extraction-volume'), '—');
            assert.equal(await text('#phase >>> #cell-extraction-time'), '30');

            await page.evalFn(() => {
                const el = document.getElementById('phase');
                el.rows = el.rows.map((r) => (r.key === 'total'
                    ? { ...r, cells: { ...r.cells, time: { noReading: true, reason: 'permanent' } } }
                    : r));
                return true;
            });
            await page.settle();
            assert.equal(await text('#phase >>> #cell-total-time'), '—',
                'an absence object rendered as something other than the dash');

            await page.evalFn(() => {
                document.getElementById('phase').dash = '·';
                return true;
            });
            await page.settle();
            assert.equal(await text('#phase >>> #cell-extraction-volume'), '·');
        }));

        test('every gallery state mounts, paints and survives the battery\'s settle',
            () => browser.withPage({ geometry }, async (page) => {
                const DEMO = ['/tools/gallery/entries/ui-data-grid.demo.js'];
                for (const state of galleryEntry.states) {
                    const wrap = Object.entries(state.hostStyle ?? {})
                        .map(([k, v]) => `${k}: ${v}`).join('; ');
                    await page.mount(`<div id="stage" style="${wrap}">${state.html}</div>`, DEMO);
                    assert.deepEqual(page.pageErrors, [], `${state.id} threw on mount`);
                    await page.settle(6);

                    const seen = await page.evalFn(() => {
                        const el = document.querySelector('#stage > *');
                        if (!el || !el.shadowRoot) return null;
                        const frame = el.shadowRoot.getElementById('frame');
                        const rect = el.getBoundingClientRect();
                        return {
                            headers: el.shadowRoot.querySelectorAll('[role="columnheader"]').length,
                            cells: el.shadowRoot.querySelectorAll('[role="cell"]').length,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            clipped: frame
                                ? frame.scrollWidth > frame.clientWidth + 0.5
                                    || frame.scrollHeight > frame.clientHeight + 0.5
                                : null,
                            overflow: frame ? getComputedStyle(frame).overflowX : null,
                        };
                    });
                    assert.ok(seen, `${state.id}: no shadow root — the demo sidecar did not define the tag`);
                    assert.ok(seen.headers > 0, `${state.id}: nothing left to photograph`);
                    assert.ok(seen.width > 0 && seen.height > 0, `${state.id}: zero box`);

                    if (seen.clipped) {
                        assert.equal(seen.overflow, 'auto',
                            `${state.id}: content overflows a frame that is not scrollable`);
                    }

                    if (state.id === 'empty') {
                        assert.equal(seen.cells, 0, 'the empty state must have no cells');
                    } else {
                        assert.ok(seen.cells > 0, `${state.id}: a table with no cells`);
                    }
                }
            }));

        test('record the geometry-independent facts for the cross-check', () => mounted(async (page) => {
            acrossGeometries[geometry.name] = {
                colFontSize: await page.prop('#phase >>> #col-time', 'font-size'),
                cellFontSize: await page.prop('#phase >>> #cell-preinfusion-time', 'font-size'),
                rowHeadFontSize: await page.prop('#phase >>> #rowhead-preinfusion', 'font-size'),
                trackCount: (await tracks(page, '#phase >>> #table')).length,
                overflow: await page.prop('#phase >>> #frame', 'overflow-x'),
                cellRole: await page.evalFn(
                    () => window.__h.q('#phase >>> #cell-total-time').getAttribute('role'),
                ),
            };
            assert.ok(acrossGeometries[geometry.name].colFontSize);
        }));
    });
}

describe('ui-data-grid — across both geometries', () => {
    test('the type scale and the structure are the same at the bench and at the floor', () => {
        const names = GATE_A_GEOMETRIES.map((g) => g.name);
        assert.deepEqual(Object.keys(acrossGeometries).sort(), [...names].sort(),
            'both geometry blocks must have recorded their facts');
        const [first, ...rest] = names.map((n) => acrossGeometries[n]);
        for (const other of rest) {
            assert.deepEqual(other, first,
                'the UI scale is never fluid (spec §2.2) and the table\'s structure does '
                + 'not depend on the viewport — a component reads its own container '
                + '(§2.1 Rule 1), and there is no @media in this component at all');
        }
    });
});
