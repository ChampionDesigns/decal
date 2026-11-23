import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { launch } from '../harness/index.js';
import { FLOOR, TABLET } from '../harness/geometry.js';
import { editorTab } from '../harness/editor.js';
import {
    CHART, PICKER, TITLE, USABLE_ID, DE1_ID, chartShotData, mountChartApp, showChartTab,
} from '../harness/chart-ux.js';
import {
    convertedShot, recordedShot, RECORDED_SHOT_IDS, withMachineModel, withShotFlag,
} from '../fixtures/chart-shots.js';

const E = 'app-root >>> editor-screen';
const tab = (i) => `app-root >>> ${editorTab(i)}`;
const row = (id) => `${CHART} >>> .shot-row[data-id="${id}"]`;

function shotData() {
    const data = chartShotData();
    const ids = data.items.map((item) => item.id);
    const reasons = {
        stepNotModelled: ids[3],
        noWeight: ids[4],
        noSamples: ids[5],
        de1Machine: ids[6],
        de1Profile: ids[8],
    };
    data.shots[reasons.stepNotModelled] = { ...convertedShot(RECORDED_SHOT_IDS[1]), id: reasons.stepNotModelled };
    data.shots[reasons.noWeight] = { ...recordedShot(USABLE_ID), id: reasons.noWeight };
    data.shots[reasons.noSamples] = { ...convertedShot(USABLE_ID), id: reasons.noSamples, measurements: [] };
    data.shots[reasons.de1Machine] = { ...withMachineModel(convertedShot(USABLE_ID), 'DE1'), id: reasons.de1Machine };
    const de1Profile = withShotFlag(convertedShot(DE1_ID), true);
    de1Profile.workflow = structuredClone(de1Profile.workflow);
    de1Profile.workflow.profile.de1_emulation = true;
    data.shots[reasons.de1Profile] = { ...de1Profile, id: reasons.de1Profile };
    data.reasons = reasons;
    return data;
}

const textSizes = (page, rootExpr, parts) => page.evalFn((expr, list) => {
    const root = (0, eval)(expr);
    const scale = parseFloat(getComputedStyle(__ux.root).getPropertyValue('--ui-app-scale')) || 1;
    return Object.fromEntries(list.map(([sel]) => {
        const e = root.querySelector(sel);
        return [sel, e ? +(parseFloat(getComputedStyle(e).fontSize) * scale).toFixed(2) : null];
    }));
}, rootExpr, parts);

const offBy = (seen, parts) => parts
    .filter(([sel, want]) => !(Math.abs(seen[sel] - want) <= 0.5))
    .map(([sel, want]) => `${sel} ${seen[sel]} not ${want}`);

const tokenColours = (page, rootExpr, checks) => page.evalFn((expr, list) => {
    const root = (0, eval)(expr);
    const probe = document.createElement('i');
    root.append(probe);
    const resolve = (token) => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
    const out = list.map(([sel, prop, token]) => {
        const e = root.querySelector(sel);
        return { sel, prop, seen: e ? getComputedStyle(e)[prop] : null, want: resolve(token) };
    });
    probe.remove();
    return out;
}, rootExpr, checks);

const STRIP_TEXT = [
    ['.grind-name', 12], ['.grind-ends', 11], ['#grind-word', 11], ['#grind-reset', 11],
    ['#shaping-entry', 12], ['.kn .lab', 10], ['#kn-peak-s', 11],
    ['#steps-entry .ui-microcap', 11], ['#steps-sum', 12],
];

const state = (page) => page.evalFn(() => {
    const s = __ux.screen().shadowRoot;
    const c = __ux.chart().shadowRoot;
    const txt = (root, id) => root.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
    return {
        tab: __ux.screen().tab,
        title: txt(s, 'editor-title'),
        titleLabel: s.getElementById('editor-title')?.getAttribute('aria-label') ?? null,
        pencil: Boolean(s.getElementById('title-pencil')),
        shotLine: txt(s, 'shot-line'),
        pickerOpen: c.getElementById('picker').open,
        noModel: txt(c, 'no-model'),
        reason: c.getElementById('no-model')?.dataset.reason ?? null,
        legendDisabled: ['lk-P', 'lk-Q', 'lk-G', 'lk-T', 'lg-edited', 'lg-shot'].map((id) => c.getElementById(id).disabled),
        readout: txt(c, 'readout'),
        draftTitle: __ux.screen()._draft?.title ?? null,
        recordId: __ux.boot.profileEditor.get().record?.id ?? null,
        changes: __ux.boot.profileEditor.changeCount(__ux.screen()._draft).count,
    };
});

const openPicker = async (page) => {
    await page.click(TITLE);
    assert.equal(await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.querySelectorAll(".shot-row").length > 0')), true);
    await page.evalFn(() => new Promise((r) => setTimeout(r, 300)));
};

const showRow = (page, id) => page.evalFn(async (rowId) => {
    __ux.chart().shadowRoot.querySelector(`.shot-row[data-id="${rowId}"]`).scrollIntoView({ block: 'center' });
    await __ux.settle();
}, id);

const loadRow = async (page, id) => {
    await openPicker(page);
    await showRow(page, id);
    await page.click(row(id));
    await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
};

const chartNote = (page) => page.evalFn(() => __ux.chart().shadowRoot.getElementById('chart-note').textContent.trim());

const evidence = process.env.DECAL_REVIEW_OUT;
async function capture(page, name) {
    if (!evidence) return;
    await fs.mkdir(evidence, { recursive: true });
    await fs.writeFile(path.join(evidence, name + '.png'), await page.screenshot());
}

const TOOLBAR_BUTTONS = ['lg-edited', 'lg-shot', 'lk-P', 'lk-Q', 'lk-G', 'lk-T'];

const buttonBoxes = (page) => page.evalFn((ids) => Object.fromEntries(ids.map((id) => {
    const r = __ux.chart().shadowRoot.getElementById(id).getBoundingClientRect();
    return [id, [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(2))];
})), TOOLBAR_BUTTONS);

const paths = (page) => page.evalFn(() => [...__ux.chart().shadowRoot.querySelectorAll('#main-chart path[data-run]')]
    .map((p) => ({ run: p.dataset.run, series: p.dataset.series, d: p.getAttribute('d') })));

const axisLabels = (page) => page.evalFn(() => [...__ux.chart().shadowRoot.querySelectorAll('#main-chart .axis text')]
    .map((n) => n.textContent));

async function withApp(geometry, fn, data = shotData()) {
    const browser = await launch();
    const page = await browser.newPage({ geometry });
    try {
        const mounted = await mountChartApp(page, data);
        assert.equal(mounted.route, 'editor');
        assert.equal(mounted.panel, true);
        await fn(page, data);
        assert.deepEqual(page.pageErrors, []);
    } finally {
        await browser.close();
    }
}

test('the Chart tab at 1280x800', async (t) => {
    await withApp(TABLET, async (page, data) => {
        await t.test('the tabs are Steps, Settings, Chart, Review and the Steps panel stays as before', async () => {
            const labels = await page.evalFn(() => [...__ux.screen().shadowRoot.getElementById('tabs').shadowRoot
                .getElementById('tablist').shadowRoot.querySelectorAll('[id^="item-"]')].map((n) => n.textContent.trim()));
            assert.deepEqual(labels.map((l) => l.toLowerCase()), ['steps', 'settings', 'chart', 'review']);
            const steps = await page.evalFn(() => {
                const s = __ux.screen().shadowRoot;
                return { visible: !s.getElementById('steps').hidden && s.getElementById('steps').getBoundingClientRect().height > 0,
                    matrix: Boolean(s.getElementById('matrix')) };
            });
            assert.deepEqual(steps, { visible: true, matrix: true });
            const before = await state(page);
            assert.equal(before.pencil, true);
            assert.equal(before.shotLine, null);
            await page.click(tab(2));
            const after = await state(page);
            assert.equal(after.tab, 'chart');
            assert.equal(await page.evalFn(() => __ux.chart().getBoundingClientRect().height > 0), true);
        });

        await t.test('on the Chart tab the title is a button with a left chevron and no pencil shows', async () => {
            const s = await state(page);
            assert.equal(s.pencil, false);
            assert.equal(s.shotLine, 'No shot loaded');
            assert.equal(s.title, s.draftTitle);
            assert.equal(s.titleLabel, `Pick a shot: ${s.draftTitle}`);
            const button = await page.evalFn(() => {
                const b = __ux.screen().shadowRoot.getElementById('editor-title');
                const svg = b.querySelector('svg');
                const box = b.getBoundingClientRect();
                const icon = svg?.getBoundingClientRect();
                const text = b.querySelector('.label').getBoundingClientRect();
                return { tag: b.localName, role: b.role ?? null, height: box.height, svgText: svg?.textContent ?? null,
                    svgHidden: svg?.getAttribute('aria-hidden'), iconLeft: icon ? icon.right <= text.left : false,
                    iconSize: icon ? Math.round(icon.width) : 0, border: getComputedStyle(b).borderTopWidth };
            });
            assert.equal(button.tag, 'button');
            assert.ok(button.height >= 47.5, `title button height ${button.height}`);
            assert.equal(button.svgText, '');
            assert.equal(button.svgHidden, 'true');
            assert.equal(button.iconLeft, true);
            assert.ok(button.iconSize >= 19, `chevron ${button.iconSize}`);
            assert.notEqual(button.border, '0px');
        });

        await t.test('on the Chart tab the profile totals of the other tabs follow Profile editor on one line', async () => {
            const read = () => page.evalFn(() => {
                const r = __ux.screen().shadowRoot;
                const eyebrow = r.getElementById('eyebrow').getBoundingClientRect();
                const totals = r.getElementById('totals');
                const box = totals.getBoundingClientRect();
                return {
                    text: totals.textContent.trim(),
                    sameLine: Math.abs(box.bottom - eyebrow.bottom) < 4 && box.left > eyebrow.right,
                };
            });
            const chart = await read();
            await page.evalFn(async () => { __ux.screen().tab = 'steps'; await __ux.settle(); });
            const steps = await read();
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
            assert.match(chart.text, /^\d+ steps? · /);
            assert.equal(chart.text, steps.text);
            assert.equal(chart.sameLine, true);
            assert.equal(steps.sameLine, false, 'Steps keeps its header');
        });

        await t.test('a tap on the title opens Pick a shot from the left edge, and Escape returns focus to the title', async () => {
            await openPicker(page);
            const geo = await page.evalFn(() => {
                const p = __ux.chart().shadowRoot.getElementById('picker').dialog.getBoundingClientRect();
                const b = __ux.screen().shadowRoot.getElementById('editor-title');
                return { left: p.left, width: p.width, height: p.height, vw: innerWidth, vh: innerHeight,
                    expanded: b.getAttribute('aria-expanded'), steel: getComputedStyle(b).borderTopColor,
                    focusInside: __ux.chart().shadowRoot.activeElement !== null };
            });
            assert.ok(Math.abs(geo.left) < 0.5, `left ${geo.left}`);
            assert.ok(Math.abs(geo.width - 480) < 0.5, `width ${geo.width}`);
            assert.equal(geo.height, geo.vh);
            assert.equal(geo.expanded, 'true');
            assert.equal(geo.focusInside, true);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.activeElement?.id), 'editor-title');
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.getElementById('editor-title').getAttribute('aria-expanded')), 'false');
        });

        await t.test('Close and a tap outside the panel close it', async () => {
            await openPicker(page);
            await page.click(`${CHART} >>> #picker-close`);
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            await openPicker(page);
            await page.mouse('mousePressed', 900, 400, { clickCount: 1 });
            await page.mouse('mouseReleased', 900, 400, { clickCount: 1 });
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            assert.equal(await page.evalFn(() => __ux.screen().shadowRoot.activeElement?.id), 'editor-title');
        });

        await t.test('the list is newest first with date, title, dose to yield, a dash for time and the tags', async () => {
            await openPicker(page);
            const rows = await page.evalFn(() => [...__ux.chart().shadowRoot.querySelectorAll('.shot-row')].map((r) => ({
                id: r.dataset.id,
                when: r.querySelector('.when').textContent.trim(),
                nums: r.querySelector('.nums').textContent.replace(/\s+/g, ' ').trim(),
                title: r.querySelector('.title').textContent.trim(),
                tags: [...r.querySelectorAll('.tag')].map((n) => n.textContent.trim()),
            })));
            assert.equal(rows.length, data.firstPage);
            assert.deepEqual(rows.map((r) => r.id), data.items.slice(0, data.firstPage).map((i) => i.id));
            assert.equal(rows[0].when, '13/08/26 10:15');
            assert.equal(rows[0].title, 'Extractamundo Dos! (2)');
            assert.equal(rows[0].nums, '17.0 g → – g · – s');
            assert.deepEqual(rows.find((r) => r.id === DE1_ID).tags, ['DE1']);
            assert.deepEqual(rows.find((r) => r.id === data.noTargetId).tags, ['No target weight']);
            assert.deepEqual(await page.evalFn(() => window.__shotReads.at(-1)), { limit: 20, offset: 0, order: 'desc' });
        });

        await t.test('the next page loads at the end of the list', async () => {
            await page.evalFn(async () => {
                const list = __ux.chart().shadowRoot.getElementById('shot-list');
                list.scrollTop = list.scrollHeight;
                list.dispatchEvent(new Event('scroll'));
            });
            assert.equal(await page.evalFn((n) => __ux.until(`__ux.chart().shadowRoot.querySelectorAll(".shot-row").length === ${n}`), data.items.length), true);
            assert.deepEqual(await page.evalFn(() => window.__shotReads.at(-1)), { limit: 20, offset: 20, order: 'desc' });
            const last = await page.evalFn(() => [...__ux.chart().shadowRoot.querySelectorAll('.shot-row')].at(-1).dataset.id);
            assert.equal(last, data.olderIds.at(-1));
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
        });

        await t.test('with no edits a row loads the shot at once and the model fits it', async () => {
            assert.equal((await state(page)).changes, 0);
            await loadRow(page, USABLE_ID);
            assert.equal(await page.evalFn(() => __ux.waitFit()), true);
            const s = await state(page);
            assert.equal(s.draftTitle, 'Extractamundo Dos! (2)');
            assert.equal(s.title, 'Extractamundo Dos! (2)');
            const matched = await page.evalFn((id) => __ux.records.find((r) => r.id === id)?.profile?.title ?? null, s.recordId);
            assert.equal(matched, 'Extractamundo Dos! (2)');
            assert.equal(s.changes, 0);
            assert.equal(s.shotLine, 'Shot 13/08/26 10:15 · 17.0 g → 1.7 g · 8.5 s');
            assert.equal(s.noModel, null);
            assert.deepEqual(s.legendDisabled, [false, false, false, false, false, false]);
            const series = await paths(page);
            for (const key of ['P', 'Q', 'G']) {
                assert.ok(series.some((p) => p.run === 'shot' && p.series === key && p.d), `shot ${key}`);
                assert.ok(series.some((p) => p.run === 'edited' && p.series === key && p.d), `edited ${key}`);
            }
            assert.equal(await page.evalFn(() => __ux.chart().spread.count >= 1), true);
        });

        await t.test('the row of the loaded shot has the numbers of the shot line', async () => {
            const line = (await state(page)).shotLine;
            await openPicker(page);
            await showRow(page, USABLE_ID);
            const nums = await page.evalFn((id) => __ux.chart().shadowRoot.querySelector(`.shot-row[data-id="${id}"] .nums`)
                .textContent.replace(/\s+/g, ' ').trim(), USABLE_ID);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            assert.equal(nums, '17.0 g → 1.7 g · 8.5 s');
            assert.equal(line, `Shot 13/08/26 10:15 · ${nums}`);
        });

        await t.test('the legend hides a series for both runs, keeps the scale, refuses the last one and Target hides only the dashed lines', async () => {
            const axes = await axisLabels(page);
            await page.click(`${CHART} >>> #lk-P`);
            let series = await paths(page);
            assert.equal(series.some((p) => p.series === 'P'), false);
            assert.ok(series.some((p) => p.series === 'Q'));
            assert.deepEqual(await axisLabels(page), axes);
            await page.click(`${CHART} >>> #lk-Q`);
            await page.click(`${CHART} >>> #lk-G`);
            const refused = {
                pressed: await page.evalFn(() => __ux.chart().shadowRoot.getElementById('lk-G').getAttribute('aria-pressed')),
                note: await chartNote(page),
            };
            assert.deepEqual(refused, { pressed: 'true', note: 'One series stays on. Show another series first.' });
            await page.click(`${CHART} >>> #lk-P`);
            await page.click(`${CHART} >>> #lk-Q`);
            series = await paths(page);
            const targets = series.filter((p) => p.series === 'tP' || p.series === 'tQ').length;
            const solid = series.filter((p) => p.series === 'P' || p.series === 'Q' || p.series === 'G').length;
            assert.equal(targets, 2);
            await page.click(`${CHART} >>> #lk-T`);
            series = await paths(page);
            assert.equal(series.filter((p) => p.series === 'tP' || p.series === 'tQ').length, 0);
            assert.equal(series.filter((p) => p.series === 'P' || p.series === 'Q' || p.series === 'G').length, solid);
            await page.click(`${CHART} >>> #lk-T`);
            assert.deepEqual(await axisLabels(page), axes);
        });

        await t.test('the note for the last series shows over the chart, lets taps through and moves no toolbar button', async () => {
            await page.click(`${CHART} >>> #lk-P`);
            await page.click(`${CHART} >>> #lk-Q`);
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("chart-note").textContent.trim()')), true);
            const before = await buttonBoxes(page);
            await capture(page, 'legend-before-note');
            await page.click(`${CHART} >>> #lk-G`);
            await page.evalFn(() => __ux.settle());
            const after = await buttonBoxes(page);
            const note = await chartNote(page);
            const place = await page.evalFn(() => {
                const c = __ux.chart().shadowRoot;
                const n = c.getElementById('chart-note');
                const b = n.getBoundingClientRect();
                const wrap = c.getElementById('chart-wrap').getBoundingClientRect();
                return {
                    shown: b.width > 0 && b.height > 0,
                    inChart: b.top >= wrap.top && b.bottom <= wrap.bottom && b.left >= wrap.left && b.right <= wrap.right,
                    tapGoesThrough: c.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) !== n,
                };
            });
            await capture(page, 'legend-with-note');
            await page.click(`${CHART} >>> #lk-P`);
            await page.click(`${CHART} >>> #lk-Q`);
            assert.deepEqual(after, before);
            assert.equal(note, 'One series stays on. Show another series first.');
            assert.deepEqual(place, { shown: true, inChart: true, tapGoesThrough: true });
        });

        await t.test('the legend names each series with its unit and a line mark, the axes have titles and each step has its number and name', async () => {
            const k = await page.evalFn(() => {
                const c = __ux.chart().shadowRoot;
                const mark = (id) => {
                    const line = c.querySelector(`#${id} .mark line`);
                    const cs = getComputedStyle(line);
                    return { stroke: cs.stroke, dash: cs.strokeDasharray, width: cs.strokeWidth };
                };
                const names = (__ux.chart().profile?.steps ?? []).map((st) => st.name);
                const labels = [...c.querySelectorAll('#main-chart .step-label')].map((n) => ({
                    k: Number(n.dataset.step), text: n.textContent.trim(), y: n.getBoundingClientRect().bottom,
                }));
                const plot = c.querySelector('#main-chart .grid line').getBoundingClientRect().top;
                const probe = (token) => {
                    const i = document.createElement('i');
                    i.style.color = `var(${token})`;
                    c.appendChild(i);
                    const v = getComputedStyle(i).color;
                    i.remove();
                    return v;
                };
                return {
                    text: ['lk-P', 'lk-Q', 'lk-G', 'lk-T'].map((id) => c.getElementById(id).textContent.replace(/\s+/g, ' ').trim()),
                    P: mark('lk-P'),
                    T: mark('lk-T'),
                    pressure: probe('--ui-channel-pressure'),
                    stroke: getComputedStyle(__ux.chart()).getPropertyValue('--ui-chart-stroke').trim(),
                    xTitle: c.getElementById('axis-x-title')?.textContent,
                    yTitle: c.getElementById('axis-y-title')?.textContent,
                    names,
                    labels,
                    plot,
                    lines: [...c.querySelectorAll('#main-chart .step-line')].map((n) => n.getAttribute('stroke-dasharray')),
                };
            });
            assert.deepEqual(k.text, ['Pressure bar', 'Flow mL/s', 'GFlow g/s', 'Target']);
            assert.equal(k.P.stroke, k.pressure);
            assert.equal(k.P.dash, 'none');
            assert.equal(k.P.width, k.stroke);
            assert.equal(k.T.dash, '16px, 10px', 'the dash of the target lines');
            assert.equal(k.xTitle, 'Time (s)');
            assert.equal(k.yTitle, 'bar · mL/s · g/s');
            assert.ok(k.labels.length >= 2, `labels ${JSON.stringify(k.labels)}`);
            assert.equal(k.labels[0].k, 0);
            for (const l of k.labels) {
                const full = `${l.k + 1} ${k.names[l.k]}`;
                assert.ok(l.text === full || l.text === String(l.k + 1), `${l.text} is ${full} or its number`);
                assert.ok(l.y <= k.plot, 'the step name sits above the plot');
            }
            assert.ok(k.labels.some((l) => l.text.includes(' ')), 'at least one step shows its name');
            assert.ok(k.lines.length >= 1 && k.lines.every((d) => d === '15 15'));
        });

        await t.test('the strip and header text render at the designed CSS px size', async () => {
            const strip = await textSizes(page, '__ux.chart().shadowRoot', STRIP_TEXT);
            const head = await textSizes(page, '__ux.screen().shadowRoot', [['#idline #totals', 11]]);
            assert.deepEqual([...offBy(strip, STRIP_TEXT), ...offBy(head, [['#idline #totals', 11]])], []);
        });

        await t.test('the plot area is the chart well with an axis edge and grid lines', async () => {
            for (const c of await tokenColours(page, '__ux.chart().shadowRoot', [
                ['#main-chart rect.well', 'fill', '--ui-chart-well'],
                ['#main-chart rect.well', 'stroke', '--ui-chart-axis'],
                ['#main-chart .grid line', 'stroke', '--ui-chart-grid'],
            ])) assert.equal(c.seen, c.want, `${c.sel} ${c.prop}`);
        });

        await t.test('grind changes the edited run only, and Reset returns it to x1.00', async () => {
            const before = await paths(page);
            const setGrind = (v) => page.evalFn(async (value) => {
                const slider = __ux.chart().shadowRoot.getElementById('grind');
                slider.value = value;
                slider.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                await __ux.settle();
                return __ux.chart().shadowRoot.getElementById('grind-x').textContent.trim();
            }, v);
            assert.equal(await setGrind(-1), 'x2.00');
            const finer = await paths(page);
            const pick = (list, run, key) => list.find((p) => p.run === run && p.series === key).d;
            assert.equal(pick(finer, 'shot', 'P'), pick(before, 'shot', 'P'));
            assert.notEqual(pick(finer, 'edited', 'P'), pick(before, 'edited', 'P'));
            assert.equal(await setGrind(1), 'x0.50');
            await page.click(`${CHART} >>> #grind-reset`);
            assert.equal(await page.evalFn(() => __ux.chart().shadowRoot.getElementById('grind-x').textContent.trim()), 'x1.00');
            assert.deepEqual(await paths(page), before);
        });

        await t.test('the peak pressure card shows both values and opens the six result rows; Step targets opens', async () => {
            const card = await page.evalFn(() => ({
                peak: __ux.chart().shadowRoot.getElementById('kn-peak').textContent.trim(),
                shot: __ux.chart().shadowRoot.getElementById('kn-peak-s').textContent.trim(),
            }));
            assert.match(card.peak, /^\d+\.\d\d bar$/);
            assert.match(card.shot, /^shot \d+\.\d\d bar$/);
            await page.click(`${CHART} >>> #keys-btn`);
            const results = await page.evalFn(() => {
                const d = __ux.chart().shadowRoot.getElementById('results');
                const rows = [...d.querySelectorAll('#results-table tbody tr')].map((r) => r.dataset.row);
                return { open: d.open, rows, text: d.textContent };
            });
            assert.equal(results.open, true);
            assert.deepEqual(results.rows, ['time', 'peak', 'flow', 'weight', 'ratio', 'ended']);
            assert.equal(results.text.includes('Time to 50 g'), false);
            await page.click(`${CHART} >>> #results-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("results").open'));
            await page.click(`${CHART} >>> #steps-entry`);
            const sheet = await page.evalFn(() => {
                const d = __ux.chart().shadowRoot.getElementById('steps-sheet');
                return { open: d.open, blocks: d.querySelectorAll('.step-block').length };
            });
            assert.equal(sheet.open, true);
            assert.equal(sheet.blocks, 3);
            await page.click(`${CHART} >>> #steps-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("steps-sheet").open'));
        });

        await t.test('the chart has the focus ring of the Grind slider', async () => {
            const RING = ['outline-width', 'outline-style', 'outline-color'];
            const grindInput = `${CHART} >>> #grind >>> input`;
            await page.focusVisible(grindInput);
            const grind = await page.computed(grindInput, RING);
            await page.focusVisible(`${CHART} >>> #main-chart`);
            const chart = await page.computed(`${CHART} >>> #main-chart`, RING);
            await page.evalFn(() => __ux.chart().shadowRoot.getElementById('main-chart').blur());
            assert.equal(grind['outline-style'], 'solid');
            assert.deepEqual(chart, grind);
        });

        await t.test('the cursor moves on a drag and on the arrow keys, Shift moves 2 s and Escape hides it', async () => {
            const idle = (await state(page)).readout;
            const box = await page.box(`${CHART} >>> #main-chart`);
            const y = box.top + box.height / 2;
            await page.mouse('mousePressed', box.left + box.width * 0.3, y, { clickCount: 1 });
            await page.mouse('mouseMoved', box.left + box.width * 0.4, y);
            await page.mouse('mouseReleased', box.left + box.width * 0.4, y, { clickCount: 1 });
            await page.evalFn(() => __ux.settle());
            const dragged = (await state(page)).readout;
            assert.notEqual(dragged, idle);
            assert.match(dragged, /^At \d+\.\d s\. Edited: .* Shot: /);
            await page.evalFn(() => {
                const c = __ux.chart();
                c._cursor = null;
                c.shadowRoot.getElementById('main-chart').focus();
            });
            await page.press('ArrowRight');
            assert.match((await state(page)).readout, /^At 0\.5 s\./);
            await page.press('ArrowRight', { modifiers: 8 });
            assert.match((await state(page)).readout, /^At 2\.5 s\./);
            await page.press('ArrowLeft');
            assert.match((await state(page)).readout, /^At 2\.0 s\./);
            await page.press('Escape');
            assert.equal((await state(page)).readout, idle);
            assert.equal(await page.evalFn(() => __ux.chart().shadowRoot.querySelector('#main-chart .cursor')), null);
        });

        await t.test('with unsaved edits a row asks first: Cancel keeps the edits and Load replaces them', async () => {
            await page.evalFn(async () => {
                __ux.screen().dispatchEvent(new CustomEvent('step-change', {
                    bubbles: true, composed: true, detail: { index: 0, field: 'seconds', value: 9 },
                }));
                await __ux.settle();
            });
            const edited = await state(page);
            assert.ok(edited.changes > 0);
            await openPicker(page);
            await showRow(page, DE1_ID);
            await page.click(row(DE1_ID));
            const asked = await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            assert.equal(asked, true);
            await page.click(`${CHART} >>> #load-cancel`);
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            const kept = await state(page);
            assert.equal(kept.changes, edited.changes);
            assert.equal(kept.pickerOpen, true);
            assert.equal(kept.shotLine, edited.shotLine);
            await showRow(page, DE1_ID);
            await page.click(row(DE1_ID));
            await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            await page.click(`${CHART} >>> #load-go`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
            const loaded = await state(page);
            assert.equal(loaded.changes, 0);
            assert.match(loaded.shotLine, /^Shot 13\/08\/26 10:06 · .* · DE1 emulation$/);
            await openPicker(page);
            await showRow(page, USABLE_ID);
            const earlier = await page.evalFn((id) => __ux.chart().shadowRoot
                .querySelector(`.shot-row[data-id="${id}"] .nums`).textContent.replace(/\s+/g, ' ').trim(), USABLE_ID);
            assert.equal(earlier, '17.0 g → 1.7 g · 8.5 s');
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
        });

        await t.test('each reason the model cannot run shows it, keeps the loaded profile and disables the legend', async () => {
            const cases = [
                [DE1_ID, 'de1Emulation', /DE1 emulation/],
                [data.noTargetId, 'noTargetWeight', /no target weight/],
                [data.reasons.noWeight, 'noWeight', /no cup weight/],
                [data.reasons.noSamples, 'noSamples', /no recorded samples/],
                [data.reasons.de1Machine, 'de1Machine', /a DE1 machine/],
                [data.reasons.stepNotModelled, 'stepNotModelled', /a step the model does not cover/],
            ];
            for (const [id, reason, words] of cases) {
                await loadRow(page, id);
                const s = await state(page);
                assert.equal(s.reason, reason, id);
                assert.match(s.noModel, words);
                assert.match(s.noModel, /The model cannot run this shot/);
                assert.equal(s.draftTitle, data.shots[id].workflow.profile.title);
                assert.equal(s.changes, 0);
                assert.deepEqual(s.legendDisabled, [true, true, true, true, true, true], id);
            }
        });

        await t.test('a shot that ran in DE1 emulation shows the refusal without the DE1 notice', async () => {
            await loadRow(page, data.reasons.de1Profile);
            const s = await state(page);
            assert.equal(s.reason, 'de1Emulation');
            assert.match(s.noModel, /The model cannot run this shot/);
            assert.equal(await page.evalFn(() => __ux.screen()._draft?.de1_emulation), true, 'the loaded profile has DE1 emulation on');
            assert.equal(await page.evalFn(() => Boolean(__ux.chart().shadowRoot.getElementById('de1-notice'))), false);
        });

        await t.test('DE1 emulation on the edited profile shows the notice over the model run of a native shot', async () => {
            await loadRow(page, USABLE_ID);
            await page.evalFn(() => __ux.waitFit());
            const has = await page.evalFn(async () => {
                __ux.boot.capabilities.de1Emulation = () => true;
                __ux.screen().requestUpdate();
                await __ux.settle();
                return Boolean(__ux.screen().shadowRoot.getElementById('field-de1-emulation'));
            });
            assert.equal(has, true, 'the DE1 emulation switch is offered on this machine');
            await page.evalFn(async () => {
                const sw = __ux.screen().shadowRoot.getElementById('field-de1-emulation');
                sw.dispatchEvent(new CustomEvent('change', { detail: { checked: true }, bubbles: true, composed: true }));
                await __ux.settle();
            });
            const s = await state(page);
            assert.equal(s.noModel, null, 'no refusal over the chart');
            assert.equal(s.reason, null);
            assert.equal(await page.evalFn(() => Boolean(__ux.chart().shadowRoot.getElementById('de1-notice'))), true);
            const tint = await page.evalFn(() => {
                const c = __ux.chart().shadowRoot;
                const n = c.getElementById('de1-notice');
                const probe = document.createElement('i');
                c.append(probe);
                probe.style.color = 'var(--ui-status-attention)';
                const attention = getComputedStyle(probe).color;
                probe.style.color = 'color-mix(in srgb, var(--ui-status-attention) 10%, transparent)';
                const fill = getComputedStyle(probe).color;
                probe.remove();
                return { border: getComputedStyle(n).borderTopColor, attention, background: getComputedStyle(n).backgroundColor, fill };
            });
            assert.equal(tint.border, tint.attention);
            assert.equal(tint.background, tint.fill);
            assert.deepEqual(s.legendDisabled, [false, false, false, false, false, false]);
            const runs = await paths(page);
            for (const series of ['P', 'Q', 'G', 'tP', 'tQ']) {
                const line = runs.find((p) => p.run === 'edited' && p.series === series);
                assert.ok(line && line.d.length > 20, `the edited run draws ${series}`);
            }
            const peak = await page.evalFn(() => __ux.chart().shadowRoot.getElementById('kn-peak').textContent.trim());
            assert.match(peak, /^\d+\.\d\d bar$/);
        });

        await t.test('on the Steps tab the title and the pencil keep the rename dialog and no shot line shows', async () => {
            await page.click(tab(0));
            const s = await state(page);
            assert.equal(s.pencil, true);
            assert.equal(s.shotLine, null);
            assert.equal(s.titleLabel, null);
            assert.equal(s.title, `B-DE1 · ${s.draftTitle}`);
            await page.click(`${E} >>> #editor-title`);
            assert.equal(await page.evalFn(() => __ux.until('__ux.screen().shadowRoot.getElementById("rename-dialog").open')), true);
            await page.click(`${E} >>> #rename-cancel`);
            await page.evalFn(() => __ux.until('!__ux.screen().shadowRoot.getElementById("rename-dialog").open'));
            assert.equal((await state(page)).pickerOpen, false);
        });
    });
});

for (const geometry of [TABLET, FLOOR]) {
    test(`the Chart tab fits at ${geometry.width}x${geometry.height}`, async (t) => {
        await withApp(geometry, async (page, data) => {
            await showChartTab(page);
            await loadRow(page, data.noTargetId);

            await t.test('every control is at least 48 rendered px and the page does not scroll', async () => {
                const seen = await page.evalFn(() => {
                    const scale = parseFloat(getComputedStyle(__ux.root).getPropertyValue('--ui-app-scale')) || 1;
                    const deep = (root, acc) => {
                        for (const e of root.querySelectorAll('*')) { acc.push(e); if (e.shadowRoot) deep(e.shadowRoot, acc); }
                        return acc;
                    };
                    const c = __ux.chart().shadowRoot;
                    const nodes = ['toolbar', 'strip', 'chart-wrap'].flatMap((id) => [c.getElementById(id), ...deep(c.getElementById(id), [])]);
                    nodes.push(__ux.screen().shadowRoot.getElementById('editor-title'));
                    const small = [];
                    let count = 0;
                    for (const e of nodes) {
                        const control = e.localName === 'button' || e.getAttribute('tabindex') === '0' || e.getAttribute('role') === 'slider';
                        if (!control) continue;
                        count++;
                        const b = e.getBoundingClientRect();
                        const pre = getComputedStyle(e, '::before');
                        const overlay = pre.content !== 'none' && pre.position === 'absolute';
                        const w = Math.max(b.width, overlay ? parseFloat(pre.width) * scale : 0);
                        const h = Math.max(b.height, overlay ? parseFloat(pre.height) * scale : 0);
                        if (w < 47.5 || h < 47.5) small.push(`${e.id || e.className} ${w.toFixed(1)}x${h.toFixed(1)}`);
                    }
                    const doc = document.scrollingElement;
                    return { count, small, scroll: [doc.scrollWidth - innerWidth, doc.scrollHeight - innerHeight] };
                });
                assert.ok(seen.count >= 12, `controls found ${seen.count}`);
                assert.deepEqual(seen.small, []);
                assert.deepEqual(seen.scroll, [0, 0]);
            });

            await t.test('the strip is one row: Grind on one line, Native shaping, Peak pressure and Step targets', async () => {
                const seen = await page.evalFn(() => {
                    const c = __ux.chart().shadowRoot;
                    const box = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
                    const strip = box(c.getElementById('strip'));
                    const ids = ['tip-grind-btn', 'grind', 'grind-value', 'grind-reset', 'shaping-entry', 'keys-btn', 'steps-entry'];
                    const parts = Object.fromEntries(ids.map((id) => [id, box(c.getElementById(id))]));
                    return { strip, parts,
                        sum: c.getElementById('steps-sum').textContent.trim(),
                        ends: c.querySelector('.grind-ends').textContent.trim() };
                });
                assert.ok(seen.strip.h >= 60 && seen.strip.h <= 70, `strip height ${seen.strip.h}`);
                for (const [id, b] of Object.entries(seen.parts)) {
                    assert.ok(b.top >= seen.strip.top - 0.5 && b.bottom <= seen.strip.bottom + 0.5, `${id} is inside the row`);
                }
                for (const id of ['tip-grind-btn', 'grind-reset', 'shaping-entry', 'keys-btn', 'steps-entry']) {
                    const b = seen.parts[id];
                    assert.ok(b.w >= 47.5 && b.h >= 47.5, `${id} ${b.w.toFixed(1)}x${b.h.toFixed(1)} CSS px`);
                }
                assert.ok(seen.parts.grind.h >= 47.5, `grind slider height ${seen.parts.grind.h}`);
                assert.equal(seen.ends, 'Finer (x2)Coarser (x0.5)');
                assert.match(seen.sum, /^[\d.]+ (mL\/s|bar)( · [\d.]+ (mL\/s|bar))+$/);
            });

            await t.test('the shot line is not cut', async () => {
                const line = await page.evalFn(() => {
                    const n = __ux.screen().shadowRoot.getElementById('shot-line');
                    const band = __ux.screen().shadowRoot.getElementById('band').getBoundingClientRect();
                    const b = n.getBoundingClientRect();
                    return { text: n.textContent.trim(), cut: n.scrollWidth - n.clientWidth, inside: b.bottom <= band.bottom + 0.5 };
                });
                assert.match(line.text, /no target weight$/);
                assert.equal(line.cut, 0);
                assert.equal(line.inside, true);
            });

            await t.test('the panel is 480 px or half the width, and no row text is cut with Loaded and No target weight', async () => {
                await openPicker(page);
                const seen = await page.evalFn((id) => {
                    const c = __ux.chart().shadowRoot;
                    const p = c.getElementById('picker').dialog.getBoundingClientRect();
                    const r = c.querySelector(`.shot-row[data-id="${id}"]`);
                    const box = r.getBoundingClientRect();
                    const cut = [];
                    for (const n of r.querySelectorAll('.when, .nums, .title, .tag')) {
                        const b = n.getBoundingClientRect();
                        if (n.scrollWidth > n.clientWidth + 0.5 || b.right > box.right + 0.5 || b.left < box.left - 0.5) {
                            cut.push(n.textContent.trim());
                        }
                    }
                    return { left: p.left, width: p.width, vw: innerWidth,
                        tags: [...r.querySelectorAll('.tag')].map((n) => n.textContent.trim()), cut };
                }, data.noTargetId);
                assert.ok(Math.abs(seen.left) < 0.5);
                assert.ok(Math.abs(seen.width - Math.min(480, seen.vw / 2)) < 0.5, `width ${seen.width}`);
                assert.deepEqual(seen.tags, ['Loaded', 'No target weight']);
                assert.deepEqual(seen.cut, []);
            });
        });
    });
}

const shotReadCount = (page, id) => page.evalFn((shotId) => __ux.calls
    .filter((c) => c.method === 'GET' && c.path === `/api/v1/shots/${shotId}`).length, id);

const pickerError = (page) => page.evalFn(() => {
    const c = __ux.chart().shadowRoot;
    const note = c.getElementById('load-error');
    return { text: note?.textContent.trim() ?? null, inPicker: Boolean(note && c.getElementById('picker').contains(note)),
        pickerOpen: __ux.chart().pickerOpen };
});

const editSeconds = (page, value) => page.evalFn(async (v) => {
    __ux.screen().dispatchEvent(new CustomEvent('step-change', {
        bubbles: true, composed: true, detail: { index: 0, field: 'seconds', value: v },
    }));
    await __ux.settle();
}, value);

const settleFor = (page, ms) => page.evalFn(async (wait) => {
    await new Promise((r) => setTimeout(r, wait));
    await __ux.settle();
}, ms);

test('the picker keeps the shared shot list, the save and newer edits', async (t) => {
    await withApp(TABLET, async (page, data) => {
        await showChartTab(page);
        const boot = await page.evalFn(async () => {
            await __ux.boot.shotHistory.readPage({ limit: 25, offset: 0, order: 'desc' });
            const s = __ux.boot.shotHistory.get();
            return { offset: s.offset, limit: s.limit, first: s.items[0]?.id ?? null, count: s.items.length };
        });

        await t.test('two picker pages leave the shared shot list on its first page', async () => {
            await openPicker(page);
            await page.evalFn(async () => {
                const list = __ux.chart().shadowRoot.getElementById('shot-list');
                list.scrollTop = list.scrollHeight;
                list.dispatchEvent(new Event('scroll'));
            });
            assert.equal(await page.evalFn((n) => __ux.until(`__ux.chart().shadowRoot.querySelectorAll(".shot-row").length === ${n}`), data.items.length), true);
            assert.deepEqual(await page.evalFn(() => window.__shotReads.at(-1)), { limit: 20, offset: 20, order: 'desc' });
            const after = await page.evalFn(() => {
                const s = __ux.boot.shotHistory.get();
                return { offset: s.offset, limit: s.limit, first: s.items[0]?.id ?? null, count: s.items.length };
            });
            assert.deepEqual(after, boot);
            assert.equal(after.offset, 0);
            assert.equal(after.limit, 25);
            assert.equal(after.first, data.items[0].id);
        });

        await t.test('a shot that does not load shows the error in the open picker', async () => {
            const missing = data.items[7].id;
            await showRow(page, missing);
            await page.click(row(missing));
            assert.equal(await page.evalFn(() => __ux.until('Boolean(__ux.chart().shadowRoot.getElementById("load-error"))')), true);
            assert.deepEqual(await pickerError(page), { text: 'The shot did not load.', inPicker: true, pickerOpen: true });
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
        });

        await t.test('a shot that arrives after Escape does not replace newer edits', async () => {
            assert.equal((await state(page)).changes, 0);
            await page.evalFn((id) => __ux.holdShot(id), USABLE_ID);
            await openPicker(page);
            await showRow(page, USABLE_ID);
            await page.click(row(USABLE_ID));
            await page.evalFn((id) => __ux.until(`__ux.calls.some((c) => c.path === "/api/v1/shots/${id}")`), USABLE_ID);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            await editSeconds(page, 9);
            const edited = await state(page);
            assert.ok(edited.changes > 0);
            await page.evalFn((id) => __ux.releaseShot(id), USABLE_ID);
            await settleFor(page, 300);
            const after = await state(page);
            assert.equal(after.changes, edited.changes);
            assert.equal(after.recordId, edited.recordId);
            assert.equal(after.shotLine, 'No shot loaded');
            assert.equal(await page.evalFn(() => __ux.screen()._draft.steps[0].seconds), 9);
            assert.equal(await page.evalFn(() => __ux.chart().loadedShot), null);
        });

        await t.test('a confirmed shot that arrives after the picker closed and opened again leaves both alone', async () => {
            const before = await state(page);
            await page.evalFn((id) => __ux.holdShot(id), DE1_ID);
            await openPicker(page);
            await showRow(page, DE1_ID);
            await page.click(row(DE1_ID));
            await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            await page.click(`${CHART} >>> #load-go`);
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen')), true);
            await openPicker(page);
            await page.evalFn((id) => __ux.releaseShot(id), DE1_ID);
            await settleFor(page, 300);
            const after = await state(page);
            assert.equal(after.pickerOpen, true);
            assert.equal(after.changes, before.changes);
            assert.equal(after.shotLine, 'No shot loaded');
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
        });

        await t.test('a confirmed shot that arrives after the draft changed is dropped', async () => {
            const other = data.reasons.stepNotModelled;
            await page.evalFn((id) => __ux.holdShot(id), other);
            await openPicker(page);
            await showRow(page, other);
            await page.click(row(other));
            await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.getElementById("load-confirm").open'));
            await page.click(`${CHART} >>> #load-go`);
            await page.evalFn((id) => __ux.until(`__ux.calls.some((c) => c.path === "/api/v1/shots/${id}")`), other);
            await editSeconds(page, 10);
            const edited = await state(page);
            await page.evalFn((id) => __ux.releaseShot(id), other);
            await settleFor(page, 300);
            const after = await state(page);
            assert.equal(after.pickerOpen, true);
            assert.equal(after.changes, edited.changes);
            assert.equal(after.shotLine, 'No shot loaded');
            assert.equal(await page.evalFn(() => __ux.screen()._draft.steps[0].seconds), 10);
            await editSeconds(page, 9);
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
        });

        await t.test('a row tap during a save does not read the shot, and says why in the picker', async () => {
            const before = await page.evalFn(() => ({
                record: __ux.boot.profileEditor.get().record?.id ?? null,
                favourites: JSON.stringify(__ux.kv.get('favouriteProfiles')),
            }));
            await page.evalFn(async () => {
                __ux.control.holdProfile = true;
                __ux.saving = __ux.boot.profileEditor.saveAsNewVersion(__ux.screen()._draft);
                await __ux.until('__ux.boot.profileEditor.get().save === "saving"');
            });
            const reads = await shotReadCount(page, USABLE_ID);
            await openPicker(page);
            await showRow(page, USABLE_ID);
            await page.click(row(USABLE_ID));
            await settleFor(page, 200);
            assert.equal(await page.evalFn(() => __ux.chart().shadowRoot.getElementById('load-confirm').open), false);
            assert.equal(await shotReadCount(page, USABLE_ID), reads);
            assert.deepEqual(await pickerError(page), { text: 'Still saving. One moment.', inPicker: true, pickerOpen: true });
            await page.click(`${CHART} >>> #picker-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
            assert.equal(await page.evalFn(() => __ux.boot.profileEditor.get().record?.id ?? null), before.record);
            await page.evalFn(async () => {
                __ux.control.holdProfile = false;
                __ux.control.release();
                await __ux.saving;
                await __ux.settle();
            });
            const saved = await page.evalFn(() => ({
                record: __ux.boot.profileEditor.get().record,
                favourites: __ux.kv.get('favouriteProfiles'),
            }));
            assert.equal(saved.record.profile.steps[0].seconds, 9);
            assert.equal(await page.evalFn(() => __ux.chart().loadedShot), null);
            assert.deepEqual(JSON.parse(before.favourites), { 0: before.record });
            assert.deepEqual(saved.favourites, { 0: saved.record.id });
        });

        await t.test('a shot that arrives while the editor saves is dropped', async () => {
            const before = await state(page);
            assert.equal(before.changes, 0);
            await page.evalFn((id) => __ux.holdShot(id), data.noTargetId);
            await openPicker(page);
            await showRow(page, data.noTargetId);
            await page.click(row(data.noTargetId));
            await page.evalFn((id) => __ux.until(`window.__shotHolds["${id}"] && __ux.calls.filter((c) => c.path === "/api/v1/shots/${id}").length > 0`), data.noTargetId);
            const favourites = await page.evalFn(() => JSON.stringify(__ux.kv.get('favouriteProfiles')));
            await page.evalFn(async () => {
                __ux.control.holdProfile = true;
                __ux.saving = __ux.boot.profileEditor.saveAsNewVersion(__ux.screen()._draft);
                await __ux.until('__ux.boot.profileEditor.get().save === "saving"');
            });
            await page.evalFn((id) => __ux.releaseShot(id), data.noTargetId);
            await settleFor(page, 300);
            assert.equal(await page.evalFn(() => __ux.boot.profileEditor.get().record?.id ?? null), before.recordId);
            assert.deepEqual(await pickerError(page), { text: 'Still saving. One moment.', inPicker: true, pickerOpen: true });
            await page.evalFn(async () => {
                __ux.control.holdProfile = false;
                __ux.control.release();
                await __ux.saving;
                await __ux.settle();
            });
            const after = await state(page);
            assert.equal(after.shotLine, 'No shot loaded');
            assert.equal(await page.evalFn(() => __ux.chart().loadedShot), null);
            const end = await page.evalFn(() => ({
                record: __ux.boot.profileEditor.get().record,
                favourites: __ux.kv.get('favouriteProfiles'),
            }));
            assert.equal(end.record.profile.title, before.draftTitle);
            assert.deepEqual(JSON.parse(favourites), { 0: before.recordId });
            assert.deepEqual(end.favourites, { 0: end.record.id });
        });
    });
});

test('the edited run stops where the fit stopped, and Step targets use the Steps ranges', async (t) => {
    const data = shotData();
    const shot = structuredClone(data.shots[USABLE_ID]);
    shot.workflow.context = { ...shot.workflow.context, targetYield: 36 };
    data.shots[USABLE_ID] = shot;
    await withApp(TABLET, async (page) => {
        await showChartTab(page);

        await t.test('before any edit the edited run stops at the weight the fit used', async () => {
            await loadRow(page, USABLE_ID);
            assert.equal(await page.evalFn(() => __ux.waitFit()), true);
            const loaded = await page.evalFn(() => ({
                fitWeight: __ux.chart().loadedShot.plan.targetWeight,
                draftWeight: __ux.screen()._draft.target_weight,
                changes: __ux.boot.profileEditor.changeCount(__ux.screen()._draft).count,
            }));
            assert.deepEqual(loaded, { fitWeight: 36, draftWeight: 40, changes: 0 });
            await page.click(`${CHART} >>> #keys-btn`);
            await page.click(`${CHART} >>> #tip-results-btn`);
            const tip = await page.evalFn(async () => {
                await __ux.until('__ux.chart().shadowRoot.getElementById("tip").open');
                return __ux.chart().shadowRoot.getElementById('tip').textContent.replace(/\s+/g, ' ');
            });
            assert.match(tip, /stops the run at 36\.0 g/);
            await page.press('Escape');
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("tip").open'));
            await page.click(`${CHART} >>> #results-close`);
            await page.evalFn(() => __ux.until('!__ux.chart().shadowRoot.getElementById("results").open'));
        });

        await t.test('Step targets use the flow and time ranges of the Steps editor', async () => {
            await page.evalFn(async () => {
                __ux.boot.capabilities.machineClass = () => 'bengle';
                for (const [field, value] of [['flow', 18], ['seconds', 200]]) {
                    __ux.screen().dispatchEvent(new CustomEvent('step-change', {
                        bubbles: true, composed: true, detail: { index: 0, field, value },
                    }));
                    await __ux.settle();
                }
                __ux.screen().requestUpdate();
                await __ux.settle();
            });
            assert.deepEqual(await page.evalFn(() => [__ux.screen()._draft.steps[0].flow, __ux.screen()._draft.steps[0].seconds]), [18, 200]);
            await page.click(`${CHART} >>> #steps-entry`);
            await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.getElementById("steps-sheet").open'));
            for (const cls of ['step-target', 'step-seconds']) {
                await page.click(`${CHART} >>> .step-block[data-step="0"] .${cls} >>> #decrement`);
                await page.evalFn(() => __ux.settle());
            }
            const step = await page.evalFn(() => __ux.screen()._draft.steps[0]);
            assert.ok(Math.abs(step.flow - 17.9) < 1e-9, `flow ${step.flow}`);
            assert.equal(step.seconds, 199);
            await page.click(`${CHART} >>> #steps-close`);
        });
    }, data);
});
