import { test } from 'node:test';
import assert from 'node:assert/strict';

import { launch } from '../harness/index.js';
import { FLOOR, TABLET } from '../harness/geometry.js';
import { CHART, TITLE, USABLE_ID, chartShotData, mountChartApp } from '../harness/chart-ux.js';

const E = 'app-root >>> editor-screen';
const D = `${E} >>> #shaping-page`;
const ENTRY = `${CHART} >>> #shaping-entry`;
const SETTINGS_EDIT = `${E} >>> #shaping-edit-settings`;
const BAND_CANCEL = `${E} >>> #band >>> #cancel`;

const SPEC_EXAMPLE = Object.freeze({
    version: 2,
    pump_curve: [
        { pressure: 1, flow: 20 }, { pressure: 3, flow: 12 }, { pressure: 6, flow: 6 },
        { pressure: 9, flow: 5 }, { pressure: 12, flow: 4 },
    ],
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0,
    pressure_mode: 'both',
    pressure_filter_tau: 0,
    pressure_ramp_tau: 1,
    flow_ramp_tau: 0,
});

const block = (points, over = {}) => ({ ...SPEC_EXAMPLE, pump_curve: points, ...over });

const V2_ONLY = ['pressure_filter_tau', 'pressure_ramp_tau', 'flow_ramp_tau'];

const recordedV1 = (points, over = {}) => ({
    ...Object.fromEntries(Object.entries(block(points)).filter(([key]) => !V2_ONLY.includes(key))),
    version: 1,
    ...over,
});

const THREE = [{ pressure: 2, flow: 14 }, { pressure: 6, flow: 8 }, { pressure: 10, flow: 3 }];
const EIGHT = [1, 2.5, 4, 5.5, 7, 8.5, 10, 11.5].map((pressure, i) => ({ pressure, flow: 19 - i * 2 }));

async function setup(page) {
    await page.evalFn(async () => {
        __ux.dialog = () => __ux.screen().shadowRoot.getElementById('shaping-page');
        __ux.droot = () => __ux.dialog().shadowRoot;
        __ux.isOpen = () => __ux.dialog().open === true;
        __ux.setBlock = async (value) => {
            const s = __ux.screen();
            const next = { ...s._draft };
            if (value === null) delete next.native_shaping;
            else next.native_shaping = value;
            s._draft = next;
            await __ux.settle();
        };
        __ux.points = () => (__ux.dialog().draft?.points ?? []).map((p) => [p.pressure, p.flow]);
    });
}

const openFromChart = async (page) => {
    await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
    await page.click(ENTRY);
    assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true, 'the page opened');
    await page.evalFn(() => __ux.until('__ux.droot().getElementById("curve-chart")'));
};

const closeWith = async (page, id) => {
    await page.click(`${D} >>> #${id}`);
    assert.equal(await page.evalFn(() => __ux.until('!__ux.isOpen()')), true, 'the page closed');
};

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

const MODAL_TEXT = [
    ['#shape-cancel', 12], ['#shape-apply', 12], ['#curve-on', 11], ['#curve-off', 11],
    ['#ftau-sec .bank button', 11], ['#ftau-u', 12], ['#ftau-h', 13.33],
];

const draftBlock = (page) => page.evalFn(() => structuredClone(__ux.screen()._draft.native_shaping ?? null));

async function withApp(geometry, fn, data = chartShotData()) {
    const browser = await launch();
    const page = await browser.newPage({ geometry });
    try {
        const mounted = await mountChartApp(page, data);
        assert.equal(mounted.route, 'editor');
        await setup(page);
        await fn(page);
        assert.deepEqual(page.pageErrors, []);
    } finally {
        await browser.close();
    }
}

async function loadUsableShot(page) {
    await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
    await page.click(TITLE);
    await page.evalFn(() => __ux.until('__ux.chart().shadowRoot.querySelectorAll(".shot-row").length > 0'));
    await page.evalFn(async (id) => {
        __ux.chart().shadowRoot.querySelector(`.shot-row[data-id="${id}"]`).scrollIntoView({ block: 'center' });
        await __ux.settle();
    }, USABLE_ID);
    await page.click(`${CHART} >>> .shot-row[data-id="${USABLE_ID}"]`);
    await page.evalFn(() => __ux.until('!__ux.chart().pickerOpen'));
    assert.equal(await page.evalFn(() => __ux.waitFit()), true, 'the fit finished');
}

async function pointCentre(page, n) {
    return page.evalFn((index) => {
        const c = __ux.droot().getElementById(`pt-${index}`).querySelector('circle');
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, n);
}

async function focusPoint(page, n) {
    await page.evalFn(async (index) => {
        __ux.droot().getElementById(`pt-${index}`).focus();
        await __ux.settle();
    }, n);
}

async function pressTimes(page, key, times, modifiers = 0) {
    for (let i = 0; i < times; i++) await page.press(key, { modifiers });
}

const SHIFT = 8;

async function controlSizes(page) {
    return page.evalFn(() => {
        const root = __ux.droot();
        const out = [];
        const add = (el, name) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            out.push({ name, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
        };
        for (const el of root.querySelectorAll('button')) add(el, el.id || el.textContent.trim());
        for (const el of root.querySelectorAll('ui-icon-button')) add(el, el.id);
        for (const g of root.querySelectorAll('.pt')) add(g, g.id);
        return out;
    });
}

async function stepperSizes(page) {
    return page.evalFn(async () => {
        const root = __ux.droot();
        const ref = document.createElement('ui-stepper');
        Object.assign(ref, { min: 0, max: 5, step: 0.02, value: 0, label: 'ref' });
        root.append(ref);
        await ref.updateComplete;
        const cap = ref.shadowRoot.querySelector('button').getBoundingClientRect();
        const normal = { w: cap.width, h: cap.height };
        ref.remove();
        const out = [];
        for (const st of root.querySelectorAll('ui-stepper')) {
            if (st.hasAttribute('size')) out.push(`${st.id} size=${st.getAttribute('size')}`);
            for (const b of st.shadowRoot.querySelectorAll('button')) {
                const r = b.getBoundingClientRect();
                if (r.height < normal.h - 0.5 || r.width < normal.w - 0.5) {
                    out.push(`${st.id} ${b.getAttribute('aria-label') ?? ''} ${r.width}x${r.height}`);
                }
            }
        }
        return { normal, off: out };
    });
}

async function layout(page) {
    return page.evalFn(() => {
        const root = __ux.droot();
        const box = (el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
        };
        const cards = [['ftau', 'ftau'], ['ptau', 'ptau'], ['ramp', 'pramp-l']].map(([id, stepper]) => ({
            id,
            card: box(root.getElementById(`${id}-sec`)),
            chart: box(root.getElementById(`${id}-chart`)),
            stepper: box(root.getElementById(stepper)),
            bank: root.querySelector(`#${id}-sec .bank`) ? box(root.querySelector(`#${id}-sec .bank`)) : null,
        }));
        const curveSec = root.getElementById('curve-sec');
        const kids = [...curveSec.children].map((el) => el.id || el.className);
        return {
            cards,
            curveKids: kids,
            curveBox: box(root.getElementById('curve-box')),
            dialog: box(__ux.dialog()),
            text: root.textContent,
        };
    });
}

test('the native shaping page at 1280x800', async (t) => {
    await withApp(TABLET, async (page) => {
        await t.test('the button sits between the Grind card and the key cards and opens the page at once', async () => {
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
            const order = await page.evalFn(() => [...__ux.chart().shadowRoot.getElementById('strip').children].map((n) => n.id));
            assert.deepEqual(order, ['grind-card', 'shaping-entry', 'keys']);
            const keys = await page.evalFn(() => [...__ux.chart().shadowRoot.getElementById('keys').children].map((n) => n.id));
            assert.deepEqual(keys, ['keys-btn', 'steps-entry']);
            const size = await page.evalFn(() => {
                const r = __ux.chart().shadowRoot.getElementById('shaping-entry').getBoundingClientRect();
                return { w: r.width, h: r.height };
            });
            assert.ok(size.h >= 47.5 && size.w >= 47.5, `button ${size.w}x${size.h}`);
            await openFromChart(page);
            const l = await layout(page);
            assert.ok(Math.abs(l.dialog.width - 1280) <= 1 && Math.abs(l.dialog.height - 800) <= 1,
                `full screen ${l.dialog.width}x${l.dialog.height}`);
            assert.equal(await page.evalFn(() => __ux.droot().activeElement?.id ?? null), 'shape-cancel');
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the Settings row opens the same page', async () => {
            await page.evalFn(async () => { __ux.screen().tab = 'settings'; await __ux.settle(); });
            const row = await page.evalFn(() => {
                const r = __ux.screen().shadowRoot.querySelector('[data-row="native-shaping"]');
                return r ? r.getAttribute('heading') : null;
            });
            assert.equal(row, 'Native shaping');
            await page.click(SETTINGS_EDIT);
            assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the Settings row says what the block sets and that it is for the Bengle only', async () => {
            const FIVE = [[1, 20], [3, 12], [6, 6], [9, 5], [12, 4]].map(([pressure, flow]) => ({ pressure, flow }));
            const row = async (value) => page.evalFn(async (b) => {
                await __ux.setBlock(b);
                __ux.screen().tab = 'settings';
                await __ux.settle();
                const r = __ux.screen().shadowRoot.querySelector('[data-row="native-shaping"]');
                return { caption: r.getAttribute('caption'), note: r.getAttribute('note') };
            }, value);
            const both = await row(block(FIVE, {
                flow_tau: 0.5, flow_mode: 'both', pressure_tau: 0.5, pressure_mode: 'both',
                pressure_filter_tau: 0, pressure_ramp_tau: 1, flow_ramp_tau: 0,
            }));
            assert.deepEqual(both, {
                caption: 'Pump curve on, 5 points · flow τ 0.50 s, both · pressure τ 0.50 s, both · τ₂ 0.00 s · ramp pressure 1.00 s, flow 0.00 s',
                note: 'Bengle only; hidden in DE1 emulation.',
            });
            const other = await row(block([], {
                flow_tau: 2.5, flow_mode: 'rise', pressure_tau: 0, pressure_mode: 'fall',
                pressure_filter_tau: 0.8, pressure_ramp_tau: 1.5, flow_ramp_tau: 4.98,
            }));
            assert.equal(other.caption,
                'Pump curve off · flow τ 2.50 s, rise · pressure τ 0.00 s · τ₂ 0.80 s · ramp pressure 1.50 s, flow 4.98 s');
            await page.evalFn(async () => { await __ux.setBlock(null); __ux.screen().tab = 'chart'; await __ux.settle(); });
        });

        await t.test('Apply with no change on a profile with no block leaves no block', async () => {
            const stored = await page.evalFn(() => __ux.boot.profileEditor.get().record?.profile?.native_shaping ?? null);
            assert.equal(stored, null);
            await page.evalFn(() => __ux.setBlock(null));
            const countNow = () => page.evalFn(() => __ux.boot.profileEditor.changeCount(__ux.screen()._draft));
            const before = await countNow();
            await openFromChart(page);
            await closeWith(page, 'shape-apply');
            assert.equal(await draftBlock(page), null);
            const after = await countNow();
            assert.equal(after.fields.includes('native_shaping'), false);
            assert.equal(after.count, before.count);
        });

        await t.test('Curve on then Curve off on a profile with no block saves a block with every default value', async () => {
            await page.evalFn(() => __ux.setBlock(null));
            await openFromChart(page);
            await page.click(`${D} >>> #curve-on`);
            await page.click(`${D} >>> #curve-off`);
            await closeWith(page, 'shape-apply');
            const defaults = await page.evalFn(async () => {
                const { checkNativeShaping } = await import('/src/lib/native-shaping-rules.js');
                return checkNativeShaping({}).block;
            });
            const saved = await draftBlock(page);
            assert.deepEqual(saved, defaults);
            assert.deepEqual(saved.pump_curve, []);
            const fields = await page.evalFn(() => __ux.boot.profileEditor.changeCount(__ux.screen()._draft).fields);
            assert.equal(fields.includes('native_shaping'), true);
            await page.evalFn(() => __ux.setBlock(null));
        });

        await t.test('in DE1 emulation the button and the row are hidden and the Grind card takes the width', async () => {
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
            const before = await page.box(`${CHART} >>> #grind-card`);
            await page.evalFn(async () => {
                const s = __ux.screen();
                s._draft = { ...s._draft, de1_emulation: true };
                await __ux.settle();
            });
            const hidden = await page.evalFn(() => ({
                entry: Boolean(__ux.chart().shadowRoot.getElementById('shaping-entry')),
                row: Boolean(__ux.screen().shadowRoot.querySelector('[data-row="native-shaping"]')),
            }));
            assert.deepEqual(hidden, { entry: false, row: false });
            const after = await page.box(`${CHART} >>> #grind-card`);
            assert.ok(after.width > before.width + 40, `grind ${before.width} -> ${after.width}`);
            await page.evalFn(async () => {
                const s = __ux.screen();
                const next = { ...s._draft };
                delete next.de1_emulation;
                s._draft = next;
                await __ux.settle();
            });
        });

        await t.test('a loaded shot shows as pale dots and the chart has the reference lines', async () => {
            await loadUsableShot(page);
            await page.evalFn(() => __ux.setBlock(null));
            await openFromChart(page);
            const chart = await page.evalFn(() => {
                const root = __ux.droot();
                const svg = root.getElementById('curve-chart');
                const order = [...svg.children].map((n) => n.id || n.getAttribute('class') || n.localName);
                return {
                    dots: root.querySelectorAll('.shot-dot').length,
                    pumpLabel: root.getElementById('bengle-pump-label').textContent,
                    de1Label: root.getElementById('de1-label').textContent,
                    de1Dash: root.getElementById('de1-curve').getAttribute('stroke-dasharray'),
                    de1Width: getComputedStyle(root.getElementById('de1-curve')).strokeWidth,
                    de1Stroke: getComputedStyle(root.getElementById('de1-curve')).stroke,
                    chartStroke: getComputedStyle(root.host).getPropertyValue('--ui-chart-stroke').trim(),
                    muted: (() => {
                        const probe = document.createElement('i');
                        probe.style.color = 'var(--ui-muted)';
                        root.appendChild(probe);
                        const c = getComputedStyle(probe).color;
                        probe.remove();
                        return c;
                    })(),
                    pumpIndex: order.indexOf('bengle-pump'),
                    firstPoint: order.findIndex((id) => /^pt-/.test(id)),
                    curveOff: root.getElementById('curve-off').getAttribute('aria-pressed'),
                    points: root.querySelectorAll('.pt').length,
                };
            });
            assert.ok(chart.dots > 10, `dots ${chart.dots}`);
            assert.equal(chart.pumpLabel, 'Bengle pump');
            assert.equal(chart.de1Label, 'DE1 240 V');
            assert.equal(chart.de1Dash, '9 9', 'the dash pattern of the chart legend');
            assert.equal(chart.de1Width, chart.chartStroke);
            assert.equal(chart.de1Stroke, chart.muted);
            assert.equal(chart.curveOff, 'true');
            assert.equal(chart.points, 0);
            assert.ok(chart.pumpIndex >= 0);
        });

        await t.test('Curve on with an empty curve gives the 5 default points, drawn over the Bengle pump line', async () => {
            await page.click(`${D} >>> #curve-on`);
            assert.deepEqual(await page.evalFn(() => __ux.points()), [[1, 20], [3, 12], [6, 6], [9, 5], [12, 4]]);
            const order = await page.evalFn(() => [...__ux.droot().getElementById('curve-chart').children]
                .map((n) => n.id || n.getAttribute('class') || n.localName));
            const pump = order.indexOf('bengle-pump');
            const first = order.findIndex((id) => /^pt-/.test(id));
            assert.ok(pump >= 0 && first > pump, 'the points are drawn after the line');
        });

        await t.test('the Bengle pump line runs through its corners on the chart', async () => {
            const check = await page.evalFn(() => {
                const root = __ux.droot();
                const d = root.getElementById('bengle-pump').getAttribute('d');
                const pts = [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
                const rect = root.querySelector('#curve-chart rect');
                const x0 = Number(rect.getAttribute('x'));
                const y0 = Number(rect.getAttribute('y'));
                const w = Number(rect.getAttribute('width'));
                const h = Number(rect.getAttribute('height'));
                return pts.map(([x, y]) => [Math.round((x - x0) / w * 14 * 10) / 10, Math.round((y0 + h - y) / h * 21 * 10) / 10]);
            });
            assert.deepEqual(check, [[0, 20], [5.5, 20], [13.5, 0]]);
        });

        await t.test('a drag moves a point and a key moves it by 0.1', async () => {
            const c = await pointCentre(page, 3);
            await page.mouse('mousePressed', c.x, c.y, { clickCount: 1 });
            await page.mouse('mouseMoved', c.x + 40, c.y - 30);
            await page.mouse('mouseReleased', c.x + 40, c.y - 30, { clickCount: 1 });
            await page.settle(2);
            const moved = await page.evalFn(() => __ux.points()[2]);
            assert.ok(moved[0] > 6 && moved[1] > 6, `dragged to ${moved}`);
            await focusPoint(page, 3);
            const before = await page.evalFn(() => __ux.points()[2]);
            await page.press('ArrowLeft');
            await page.press('ArrowDown');
            const after = await page.evalFn(() => __ux.points()[2]);
            assert.equal(Math.round((before[0] - after[0]) * 10), 1);
            assert.equal(Math.round((before[1] - after[1]) * 10), 1);
        });

        await t.test('only the selected point shows its number, up and to the right of it', async () => {
            await focusPoint(page, 3);
            const num = await page.evalFn(() => {
                const root = __ux.droot();
                const nums = [...root.querySelectorAll('.pt-num')];
                const dot = root.querySelector('#pt-3 .dot').getBoundingClientRect();
                const r = nums[0]?.getBoundingClientRect();
                return {
                    count: nums.length,
                    text: nums[0]?.textContent,
                    owner: nums[0]?.closest('.pt')?.id,
                    right: r && r.left > dot.right,
                    above: r && r.bottom < dot.top + dot.height / 2,
                };
            });
            assert.deepEqual(num, { count: 1, text: '3', owner: 'pt-3', right: true, above: true });
        });

        await t.test('a move stops at each rule limit', async () => {
            await focusPoint(page, 2);
            await pressTimes(page, 'ArrowRight', 20, SHIFT);
            let pts = await page.evalFn(() => __ux.points());
            assert.equal(Math.round((pts[2][0] - pts[1][0]) * 10), 5, 'at least 0.5 bar under the next point');
            await pressTimes(page, 'ArrowUp', 25, SHIFT);
            pts = await page.evalFn(() => __ux.points());
            assert.equal(pts[1][1], pts[0][1], 'flow stops at the point before');
            await pressTimes(page, 'ArrowDown', 30, SHIFT);
            pts = await page.evalFn(() => __ux.points());
            assert.equal(pts[1][1], pts[2][1], 'flow stops at the point after');
            await focusPoint(page, 1);
            await pressTimes(page, 'ArrowLeft', 10, SHIFT);
            await pressTimes(page, 'ArrowUp', 5, SHIFT);
            pts = await page.evalFn(() => __ux.points());
            assert.deepEqual(pts[0], [0.5, 20]);
            await focusPoint(page, 5);
            await pressTimes(page, 'ArrowRight', 10, SHIFT);
            await pressTimes(page, 'ArrowDown', 10, SHIFT);
            pts = await page.evalFn(() => __ux.points());
            assert.deepEqual(pts[4], [13.5, 0]);
            const valid = await page.evalFn(() => __ux.dialog().result.ok);
            assert.equal(valid, true);
        });

        await t.test('no control adds or removes a point and none sits under the chart', async () => {
            const l = await layout(page);
            assert.deepEqual(l.curveKids, ['head', 'curve-box']);
            for (const word of ['Add point', 'Remove point', 'Load first test values', 'wire bytes']) {
                assert.equal(l.text.includes(word), false, word);
            }
            assert.equal(await page.evalFn(() => __ux.droot().querySelectorAll('.pt').length), 5);
        });

        await t.test('Off then On inside one page brings the points back; Off then Apply saves an empty curve', async () => {
            const before = await page.evalFn(() => __ux.points());
            await page.click(`${D} >>> #curve-off`);
            assert.equal(await page.evalFn(() => __ux.droot().querySelectorAll('.pt').length), 0);
            await page.click(`${D} >>> #curve-on`);
            assert.deepEqual(await page.evalFn(() => __ux.points()), before);
            await closeWith(page, 'shape-apply');
            assert.equal((await draftBlock(page)).pump_curve.length, 5);
            await openFromChart(page);
            await page.evalFn(async () => {
                __ux.droot().getElementById('ftau-sec').querySelector('ui-stepper')
                    .dispatchEvent(new CustomEvent('change', { detail: { value: 1 }, bubbles: true, composed: true }));
                await __ux.settle();
            });
            await page.click(`${D} >>> #curve-off`);
            await closeWith(page, 'shape-apply');
            const saved = await draftBlock(page);
            assert.deepEqual(saved.pump_curve, []);
            assert.equal(saved.flow_tau, 1);
        });

        await t.test('a 3-point and an 8-point block keep their count after a move and Apply', async () => {
            for (const points of [THREE, EIGHT]) {
                await page.evalFn((b) => __ux.setBlock(b), block(points));
                await openFromChart(page);
                assert.equal(await page.evalFn(() => __ux.droot().querySelectorAll('.pt').length), points.length);
                await focusPoint(page, 2);
                await page.press('ArrowLeft');
                await closeWith(page, 'shape-apply');
                const out = await draftBlock(page);
                assert.equal(out.pump_curve.length, points.length);
                assert.equal(Math.round(out.pump_curve[1].pressure * 10), Math.round(points[1].pressure * 10) - 1);
                const ok = await page.evalFn(async (b) => {
                    const { checkNativeShaping } = await import('/src/lib/native-shaping-rules.js');
                    return checkNativeShaping(b).ok;
                }, out);
                assert.equal(ok, true);
            }
        });

        await t.test('the page text renders at the designed CSS px size', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            const seen = await textSizes(page, '__ux.droot()', MODAL_TEXT);
            assert.deepEqual(offBy(seen, MODAL_TEXT), []);
            for (const c of await tokenColours(page, '__ux.droot()', [
                ['#curve-chart rect', 'fill', '--ui-chart-well'],
                ['#curve-chart rect', 'stroke', '--ui-chart-axis'],
                ['#ftau-chart rect', 'fill', '--ui-chart-well'],
            ])) assert.equal(c.seen, c.want, `${c.sel} ${c.prop}`);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the layout at 1280x800', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await page.settle(4);
            const l = await layout(page);
            const heights = l.cards.map((c) => c.chart.height);
            assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `chart heights ${heights}`);
            const tops = l.cards.map((c) => c.chart.top - c.card.top);
            const bottoms = l.cards.map((c) => c.card.bottom - c.chart.bottom);
            assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `top edges ${tops}`);
            assert.ok(Math.max(...bottoms) - Math.min(...bottoms) <= 1, `bottom edges ${bottoms}`);
            for (const c of l.cards) {
                assert.ok(c.stepper.top - c.card.top < 64, `${c.id} first control at the top of its card`);
            }
            for (const c of l.cards.slice(0, 2)) {
                assert.ok(c.bank.top >= c.stepper.bottom - 0.5, `${c.id} toggle under the stepper`);
                assert.ok(c.bank.right <= c.chart.left, `${c.id} toggle left of the chart`);
            }
            assert.ok(l.curveBox.height > 400, `curve chart ${l.curveBox.height}`);
            const small = (await controlSizes(page)).filter((c) => c.w < 47.5 || c.h < 47.5);
            assert.deepEqual(small, []);
            assert.deepEqual((await stepperSizes(page)).off, []);
        });

        await t.test('Cancel and Escape leave the profile as before', async () => {
            const before = await draftBlock(page);
            await page.evalFn(async () => {
                __ux.droot().getElementById('ftau-sec').querySelector('ui-stepper')
                    .dispatchEvent(new CustomEvent('change', { detail: { value: 2 }, bubbles: true, composed: true }));
                await __ux.settle();
            });
            assert.equal(await page.evalFn(() => __ux.dialog().draft.flowTau), 2);
            await closeWith(page, 'shape-cancel');
            assert.deepEqual(await draftBlock(page), before);
            await openFromChart(page);
            await page.click(`${D} >>> #curve-off`);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.isOpen()')), true);
            assert.deepEqual(await draftBlock(page), before);
        });

        await t.test('Apply updates the Edited run of the Chart', async () => {
            const edited = () => page.evalFn(() => [...__ux.chart().shadowRoot
                .querySelectorAll('#main-chart path[data-run="edited"]')].map((p) => p.getAttribute('d')).join('|'));
            const before = await edited();
            assert.ok(before.length > 0);
            await openFromChart(page);
            await page.evalFn(async () => {
                __ux.droot().getElementById('ptau-sec').querySelector('ui-stepper')
                    .dispatchEvent(new CustomEvent('change', { detail: { value: 1.5 }, bubbles: true, composed: true }));
                await __ux.settle();
            });
            await closeWith(page, 'shape-apply');
            await page.settle(4);
            assert.equal((await draftBlock(page)).pressure_tau, 1.5);
            assert.notEqual(await edited(), before);
        });

        await t.test('the editor Cancel discards an applied block that is not saved', async () => {
            const stored = await page.evalFn(() => structuredClone(__ux.boot.profileEditor.get().record?.profile?.native_shaping ?? null));
            assert.equal(await page.evalFn(() => __ux.boot.profileEditor.changeCount(__ux.screen()._draft).fields.includes('native_shaping')), true);
            await page.click(BAND_CANCEL);
            await page.settle(6);
            await page.click(`${E} >>> #discard-confirm`);
            await page.settle(6);
            const after = await page.evalFn(() => structuredClone(__ux.boot.profileEditor.get().record?.profile?.native_shaping ?? null));
            assert.deepEqual(after, stored);
            const reopened = await page.evalFn(async () => {
                __ux.boot.profileEditor.open(__ux.loaded);
                __ux.root.goto('editor');
                await __ux.until('__ux.root.route === "editor" && __ux.screen()?._draft');
                return structuredClone(__ux.screen()._draft.native_shaping ?? null);
            });
            assert.deepEqual(reopened, stored);
        });
    });
});

test('the native shaping page at 1000x600', async () => {
    await withApp(FLOOR, async (page) => {
        await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
        await openFromChart(page);
        await page.settle(4);
        const l = await layout(page);
        assert.ok(Math.abs(l.dialog.width - 1000) <= 1 && Math.abs(l.dialog.height - 600) <= 1);
        const heights = l.cards.map((c) => c.chart.height);
        assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `chart heights ${heights}`);
        assert.deepEqual(l.curveKids, ['head', 'curve-box']);
        const small = (await controlSizes(page)).filter((c) => c.w < 47.5 || c.h < 47.5);
        assert.deepEqual(small, []);
        assert.deepEqual((await stepperSizes(page)).off, []);
        const entry = await page.evalFn(() => __ux.chart().shadowRoot.getElementById('shaping-entry').getBoundingClientRect().height);
        assert.ok(entry >= 47.5);
    });
});

function reportedShotData(settings) {
    const data = chartShotData();
    const record = structuredClone(data.shots[USABLE_ID]);
    const workflow = record.workflow ?? {};
    workflow.machine = { ...(workflow.machine ?? {}), nativeShaping: { source: 1, settings } };
    record.workflow = workflow;
    data.shots[USABLE_ID] = record;
    return data;
}

test('with no block in the profile the Edited run uses the settings the shot ran with', async () => {
    await withApp(TABLET, async (page) => {
        await page.evalFn(() => __ux.setBlock(null));
        await loadUsableShot(page);
        const edited = () => page.evalFn(() => [...__ux.chart().shadowRoot
            .querySelectorAll('#main-chart path[data-run="edited"]')].map((p) => p.getAttribute('d')).join('|'));
        const noBlock = await edited();
        assert.ok(noBlock.length > 0);
        const preview = await page.evalFn(() => structuredClone(__ux.chart().shapingPreview(null)));
        assert.ok(preview);
        assert.deepEqual(preview.edited, preview.saved);
        await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
        await page.settle(4);
        assert.equal(await edited(), noBlock);
        await page.evalFn((b) => __ux.setBlock(b), { ...SPEC_EXAMPLE, flow_tau: 2 });
        await page.settle(4);
        assert.notEqual(await edited(), noBlock);
        await page.evalFn(() => __ux.setBlock(null));
        await page.settle(4);
        assert.equal(await edited(), noBlock);
    }, reportedShotData(SPEC_EXAMPLE));
});

test('with no block in the profile the page opens on the settings the loaded shot ran', async () => {
    const ran = recordedV1(THREE, { flow_tau: 1.25, flow_mode: 'rise', pressure_tau: 0.75, ramp_factor: 1.5 });
    await withApp(TABLET, async (page) => {
        await page.evalFn(() => __ux.setBlock(null));
        await loadUsableShot(page);
        await openFromChart(page);
        const draft = await page.evalFn(() => structuredClone(__ux.dialog().draft));
        assert.equal(draft.on, true);
        assert.deepEqual(draft.points, THREE);
        assert.equal(draft.flowTau, 1.25);
        assert.equal(draft.flowMode, 'rise');
        assert.equal(draft.pressureTau, 0.75);
        assert.equal(draft.pressureFilter, 0);
        assert.equal(draft.pressureRamp, 1.14);
        assert.equal(draft.flowRamp, 1.9);
        await closeWith(page, 'shape-apply');
        assert.equal(await draftBlock(page), null, 'an untouched Apply sends no block');
        await page.evalFn(async () => { __ux.screen().tab = 'settings'; await __ux.settle(); });
        await page.click(SETTINGS_EDIT);
        assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true);
        assert.equal(await page.evalFn(() => __ux.dialog().draft.flowTau), 1.25);
        await closeWith(page, 'shape-cancel');
    }, reportedShotData(ran));
});

const NOT_SET = 'Not set: the machine uses its own settings.';

const settingsCaption = (page) => page.evalFn(async () => {
    __ux.screen().tab = 'settings';
    await __ux.settle();
    return __ux.screen().shadowRoot.querySelector('[data-row="native-shaping"]').getAttribute('caption');
});

const clearState = (page) => page.evalFn(() => {
    const el = __ux.droot().getElementById('shape-clear');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { disabled: el.disabled, text: el.textContent.trim(), w: r.width, h: r.height };
});

test('Clear in the native shaping page', async (t) => {
    const ran = recordedV1(THREE, { flow_tau: 1.25, flow_mode: 'rise', pressure_tau: 0.75, ramp_factor: 1.5 });
    const own = block(EIGHT, { flow_tau: 2, pressure_tau: 0.5, pressure_ramp_tau: 0.5, flow_ramp_tau: 0.5 });
    await withApp(TABLET, async (page) => {
        await page.evalFn(() => __ux.setBlock(null));
        await loadUsableShot(page);
        const edited = () => page.evalFn(() => [...__ux.chart().shadowRoot
            .querySelectorAll('#main-chart path[data-run="edited"]')].map((p) => p.getAttribute('d')).join('|'));
        const noBlock = await edited();
        assert.ok(noBlock.length > 0);

        await t.test('Clear is not shown on a profile with no block', async () => {
            await openFromChart(page);
            assert.equal(await clearState(page), null);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('Clear is shown on a profile with a block, at least 48 px, left of Cancel', async () => {
            await page.evalFn((b) => __ux.setBlock(b), own);
            await openFromChart(page);
            const seen = await clearState(page);
            assert.equal(seen.disabled, false);
            assert.equal(seen.text, 'Clear');
            assert.ok(seen.w >= 47.5 && seen.h >= 47.5, `Clear ${seen.w}x${seen.h}`);
            const order = await page.evalFn(() => [...__ux.droot().querySelector('.top').children]
                .map((n) => n.id).filter(Boolean));
            assert.deepEqual(order.slice(-3), ['shape-clear', 'shape-cancel', 'shape-apply']);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('Clear shows the settings of the loaded shot, then shows as disabled', async () => {
            await openFromChart(page);
            assert.deepEqual(await page.evalFn(() => __ux.points()), EIGHT.map((p) => [p.pressure, p.flow]));
            await page.click(`${D} >>> #shape-clear`);
            await page.settle(2);
            const draft = await page.evalFn(() => structuredClone(__ux.dialog().draft));
            assert.equal(draft.on, true);
            assert.deepEqual(draft.points, THREE);
            assert.equal(draft.flowTau, 1.25);
            assert.equal(draft.flowMode, 'rise');
            assert.equal(draft.pressureTau, 0.75);
            assert.equal(draft.pressureRamp, 1.14);
            assert.equal(draft.flowRamp, 1.9);
            assert.equal(await page.evalFn(() => __ux.isOpen()), true, 'Clear does not close the page');
            assert.deepEqual(await draftBlock(page), own, 'Clear does not change the draft by itself');
            assert.equal((await clearState(page)).disabled, true);
            assert.equal(await page.evalFn(() => __ux.droot().activeElement?.id ?? null), 'shape-cancel');
            await closeWith(page, 'shape-cancel');
        });

        await t.test('Cancel after Clear keeps the block', async () => {
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            await closeWith(page, 'shape-cancel');
            assert.deepEqual(await draftBlock(page), own);
        });

        await t.test('Escape after Clear keeps the block', async () => {
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('!__ux.isOpen()')), true, 'the page closed');
            assert.deepEqual(await draftBlock(page), own);
        });

        await t.test('Clear, a change, then Clear again shows the settings of the loaded shot again', async () => {
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            await page.click(`${D} >>> #fmode-fall`);
            assert.equal(await page.evalFn(() => __ux.dialog().draft.flowMode), 'fall');
            assert.equal((await clearState(page)).disabled, false);
            await page.click(`${D} >>> #shape-clear`);
            await page.settle(2);
            assert.equal(await page.evalFn(() => __ux.dialog().draft.flowMode), 'rise');
            assert.equal((await clearState(page)).disabled, true);
            await closeWith(page, 'shape-apply');
            assert.equal(await draftBlock(page), null);
            await page.evalFn((b) => __ux.setBlock(b), own);
        });

        await t.test('Clear during a point drag ends the drag', async () => {
            await openFromChart(page);
            const at = await pointCentre(page, 2);
            await page.mouse('mousePressed', at.x, at.y, { clickCount: 1 });
            await page.mouse('mouseMoved', at.x + 30, at.y + 30);
            await page.settle(2);
            assert.notDeepEqual(await page.evalFn(() => __ux.points()[1]), [EIGHT[1].pressure, EIGHT[1].flow], 'the drag moved the point');
            await page.evalFn(async () => { __ux.droot().getElementById('shape-clear').click(); await __ux.settle(); });
            await page.mouse('mouseMoved', at.x + 60, at.y + 60);
            await page.mouse('mouseReleased', at.x + 60, at.y + 60, { clickCount: 1 });
            await page.settle(2);
            assert.deepEqual(await page.evalFn(() => __ux.points()), THREE.map((p) => [p.pressure, p.flow]));
            assert.equal((await clearState(page)).disabled, true);
            await closeWith(page, 'shape-cancel');
            assert.deepEqual(await draftBlock(page), own);
        });

        await t.test('the preview after Clear is the run with no block', async () => {
            await openFromChart(page);
            await page.evalFn(() => {
                const d = __ux.dialog();
                const real = d.previewer;
                __ux.previewArgs = [];
                d.previewer = (b) => { __ux.previewArgs.push(b === null ? null : structuredClone(b)); return real(b); };
            });
            await page.click(`${D} >>> #shape-clear`);
            await page.click(`${D} >>> #preview-btn`);
            await page.evalFn(() => __ux.until('__ux.droot().getElementById("preview-chart")'));
            const seen = await page.evalFn(() => {
                const edited = [...__ux.droot().querySelectorAll('#preview-chart path.edited')].map((p) => p.getAttribute('d'));
                const saved = [...__ux.droot().querySelectorAll('#preview-chart path.saved')].map((p) => p.getAttribute('d'));
                return { last: __ux.previewArgs.at(-1), same: edited.length > 0 && edited.join('|') === saved.join('|') };
            });
            await page.click(`${D} >>> #preview-btn`);
            await closeWith(page, 'shape-cancel');
            assert.deepEqual(seen, { last: null, same: true });
        });

        await t.test('a control touched after Clear makes a block from the values shown', async () => {
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            await page.evalFn(async () => {
                __ux.droot().getElementById('ptau-sec').querySelector('ui-stepper')
                    .dispatchEvent(new CustomEvent('change', { detail: { value: 2 }, bubbles: true, composed: true }));
                await __ux.settle();
            });
            assert.equal((await clearState(page)).disabled, false, 'Clear is enabled again after a change');
            await closeWith(page, 'shape-apply');
            const shown = await page.evalFn(async (b) => {
                const { checkNativeShaping } = await import('/src/lib/native-shaping-rules.js');
                return checkNativeShaping(b).block;
            }, block(THREE, {
                flow_tau: 1.25, flow_mode: 'rise', pressure_tau: 2, pressure_ramp_tau: 1.14, flow_ramp_tau: 1.9,
            }));
            assert.deepEqual(await draftBlock(page), shown);
            assert.deepEqual(shown.pump_curve, THREE);
            await page.evalFn((b) => __ux.setBlock(b), own);
        });

        await t.test('Apply after Clear removes the block: Not set, and the Edited run of no block', async () => {
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
            await page.settle(4);
            assert.notEqual(await edited(), noBlock);
            assert.notEqual(await settingsCaption(page), NOT_SET);
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            await closeWith(page, 'shape-apply');
            const keys = await page.evalFn(() => Object.keys(__ux.screen()._draft));
            assert.equal(keys.includes('native_shaping'), false);
            assert.equal(await settingsCaption(page), NOT_SET);
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
            await page.settle(4);
            assert.equal(await edited(), noBlock);
            await openFromChart(page);
            assert.equal(await clearState(page), null, 'Clear is not shown once the block is gone');
            await closeWith(page, 'shape-cancel');
        });
    }, reportedShotData(ran));
});

test('Save after Clear and Apply sends the profile and the workflow with no block', async () => {
    await withApp(TABLET, async (page) => {
        await page.evalFn(async (b) => {
            const record = structuredClone(__ux.loaded);
            record.profile = { ...record.profile, native_shaping: b };
            __ux.boot.profileEditor.open(record);
            await __ux.settle();
        }, SPEC_EXAMPLE);
        assert.deepEqual(await draftBlock(page), SPEC_EXAMPLE);
        await openFromChart(page);
        await page.click(`${D} >>> #shape-clear`);
        await closeWith(page, 'shape-apply');
        const fields = await page.evalFn(() => __ux.boot.profileEditor.changeCount(__ux.screen()._draft).fields);
        assert.deepEqual(fields, ['native_shaping']);
        await page.evalFn(() => { __ux.calls.length = 0; });
        await page.click(`${E} >>> #band >>> #save`);
        assert.equal(await page.evalFn(async () => {
            for (let i = 0; i < 250; i++) {
                if (__ux.calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/workflow')) return true;
                await new Promise((r) => setTimeout(r, 20));
            }
            return false;
        }), true, 'the save armed the workflow');
        const sent = await page.evalFn(() => structuredClone(__ux.calls.filter((c) => c.method !== 'GET')));
        const post = sent.find((c) => c.method === 'POST' && c.path === '/api/v1/profiles');
        assert.ok(post, sent.map((c) => `${c.method} ${c.path}`).join(','));
        assert.ok(post.body.profile && typeof post.body.profile === 'object');
        assert.equal(Object.hasOwn(post.body.profile, 'native_shaping'), false);
        const armed = sent.find((c) => c.method === 'PUT' && c.path === '/api/v1/workflow');
        assert.ok(armed.body.profile && typeof armed.body.profile === 'object');
        assert.equal(Object.hasOwn(armed.body.profile, 'native_shaping'), false);
    });
});

test('with no block and no shot loaded the page opens on the defaults', async () => {
    await withApp(TABLET, async (page) => {
        await page.evalFn(() => __ux.setBlock(null));
        await openFromChart(page);
        const draft = await page.evalFn(() => structuredClone(__ux.dialog().draft));
        assert.equal(draft.on, false);
        assert.deepEqual(draft.points, []);
        assert.equal(draft.flowTau, 0);
        assert.equal(draft.pressureFilter, 0);
        assert.equal(draft.pressureRamp, 0);
        assert.equal(draft.flowRamp, 0);
        await closeWith(page, 'shape-apply');
        assert.equal(await draftBlock(page), null);
    });
});

test('no shaping page opens while the profile saves', async () => {
    await withApp(TABLET, async (page) => {
        await page.evalFn(async () => {
            __ux.screen().shadowRoot.getElementById('notice')?.clear?.();
            __ux.control.holdProfile = true;
            __ux.saving = __ux.boot.profileEditor.saveAsNewVersion(__ux.screen()._draft);
            await __ux.until('__ux.boot.profileEditor.get().save === "saving"');
        });
        const notice = () => page.evalFn(() => (__ux.screen().shadowRoot.getElementById('notice')?.textContent ?? '').trim());
        await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
        await page.click(ENTRY);
        await page.settle(4);
        assert.equal(await page.evalFn(() => __ux.isOpen()), false);
        assert.match(await notice(), /Still saving\. One moment\./);
        await page.evalFn(async () => {
            __ux.screen().shadowRoot.getElementById('notice')?.clear?.();
            __ux.screen().tab = 'settings';
            await __ux.settle();
        });
        await page.click(SETTINGS_EDIT);
        await page.settle(4);
        assert.equal(await page.evalFn(() => __ux.isOpen()), false);
        assert.match(await notice(), /Still saving\. One moment\./);
        await page.evalFn(async () => {
            __ux.control.holdProfile = false;
            __ux.control.release();
            await __ux.saving;
            await __ux.settle();
        });
    });
});

const deepFocus = (page) => page.evalFn(() => {
    const path = [];
    let el = document.activeElement;
    while (el) {
        path.push(el.id || el.tagName.toLowerCase());
        el = el.shadowRoot?.activeElement ?? null;
    }
    return path;
});

const padState = (page) => page.evalFn(() => {
    const pad = __ux.droot().getElementById('shape-pad');
    const confirm = pad.shadowRoot.getElementById('confirm');
    return {
        open: pad.open === true,
        heading: pad.heading,
        unit: pad.unit,
        value: pad.value,
        range: pad.range ? { min: pad.range.min, max: pad.range.max, step: pad.range.step } : null,
        rangeText: pad.rangeText,
        outOfBand: pad.outOfBand,
        confirmDisabled: confirm?.disabled === true || confirm?.hasAttribute('disabled') === true,
    };
});

const openPad = async (page, id) => {
    await page.click(`${D} >>> #${id} >>> #value`);
    assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-pad").open === true')), true, `${id} pad opened`);
    await page.settle(2);
};

const typeKeys = async (page, keys) => {
    for (const key of keys) await page.press(key);
};

const padConfirm = async (page) => {
    await page.click(`${D} >>> #shape-pad >>> #confirm`);
    assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-pad").open === false')), true, 'the pad closed');
};

const editorInert = (page) => page.evalFn(() => {
    const root = __ux.screen().shadowRoot;
    return {
        band: root.getElementById('band')?.inert === true,
        body: root.getElementById('body')?.inert === true,
    };
});

const STEPPERS = Object.freeze([
    { id: 'ftau', field: 'flow_tau', heading: 'Flow τ', unit: 's', limits: { min: 0, max: 5, step: 0.02 }, range: '0–5 s' },
    { id: 'ptau', field: 'pressure_tau', heading: 'Pressure τ', unit: 's', limits: { min: 0, max: 5, step: 0.02 }, range: '0–5 s' },
    { id: 'pfilt', field: 'pressure_filter_tau', heading: 'Second filter τ₂', unit: 's', limits: { min: 0, max: 5, step: 0.02 }, range: '0–5 s' },
    { id: 'pramp', field: 'pressure_ramp_tau', heading: 'Pressure ramp time', unit: 's', limits: { min: 0, max: 5, step: 0.02 }, range: '0–5 s' },
    { id: 'framp', field: 'flow_ramp_tau', heading: 'Flow ramp time', unit: 's', limits: { min: 0, max: 5, step: 0.02 }, range: '0–5 s' },
]);

test('the native shaping page and its number pad at 1280x800', async (t) => {
    await withApp(TABLET, async (page) => {
        await t.test('the page covers the editor, shows its title and content, and keeps the editor out of reach', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            assert.deepEqual(await editorInert(page), { band: false, body: false });
            await openFromChart(page);
            const seen = await page.evalFn(() => {
                const host = __ux.dialog();
                const root = __ux.droot();
                const r = host.getBoundingClientRect();
                return {
                    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
                    title: root.getElementById('dlg-title')?.textContent.trim(),
                    role: host.getAttribute('role'),
                    modal: host.getAttribute('aria-modal'),
                    name: host.getAttribute('aria-label'),
                    back: root.getElementById('shape-back')?.getAttribute('label'),
                    parts: ['tip-modal-btn', 'preview-btn', 'shape-clear', 'shape-cancel', 'shape-apply', 'curve-sec',
                        'curve-chart', 'ftau-sec', 'ptau-sec', 'ramp-sec', 'ftau-chart', 'ptau-chart', 'ramp-chart',
                        'pfilt', 'pramp', 'framp']
                        .filter((id) => !root.getElementById(id)),
                    head: [...root.getElementById('shape-head').children].map((n) => n.id || n.className),
                    dialogs: (() => {
                        const found = [];
                        const walk = (node) => {
                            for (const el of node.querySelectorAll('*')) {
                                if (el.tagName === 'DIALOG') found.push(el);
                                if (el.shadowRoot) walk(el.shadowRoot);
                            }
                        };
                        walk(root);
                        return found.map((el) => `${el.getRootNode().host.tagName}#${el.getRootNode().host.id}:${el.open}`);
                    })(),
                };
            });
            assert.deepEqual(seen, {
                box: [0, 0, 1280, 800],
                title: 'Native shaping',
                role: 'dialog',
                modal: 'true',
                name: 'Native shaping',
                back: 'Back to the profile editor',
                parts: [],
                head: ['shape-back', 'title', 'spacer', 'preview-btn', 'shape-clear', 'shape-cancel', 'shape-apply'],
                dialogs: ['UI-DIALOG#shape-tip:false', 'UI-DIALOG#dialog:false'],
            });
            assert.deepEqual(await editorInert(page), { band: true, body: true });
        });

        await t.test('Back closes the page and returns focus to the Chart tab button', async () => {
            await closeWith(page, 'shape-back');
            assert.deepEqual(await editorInert(page), { band: false, body: false });
            assert.equal(await page.evalFn(() => __ux.dialog().getAttribute('role')), null);
            assert.equal((await deepFocus(page)).at(-1), 'shaping-entry');
        });

        await t.test('Back from the Settings row returns focus to Edit', async () => {
            await page.evalFn(async () => { __ux.screen().tab = 'settings'; await __ux.settle(); });
            await page.click(SETTINGS_EDIT);
            assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true);
            await closeWith(page, 'shape-back');
            assert.deepEqual((await deepFocus(page)).slice(-2), ['shaping-edit-settings', 'btn']);
            await page.evalFn(async () => { __ux.screen().tab = 'chart'; await __ux.settle(); });
        });

        await t.test('Back and Cancel keep the draft, with a block and with none, and ask nothing', async () => {
            const discardOpen = () => page.evalFn(() => __ux.screen().shadowRoot.getElementById('discard-dialog').open === true);
            for (const [start, closer] of [
                [SPEC_EXAMPLE, 'shape-back'], [SPEC_EXAMPLE, 'shape-cancel'], [null, 'shape-back'], [null, 'shape-cancel'],
            ]) {
                await page.evalFn((b) => __ux.setBlock(b), start);
                await openFromChart(page);
                await page.click(`${D} >>> #ftau >>> #increment`);
                await page.click(`${D} >>> #curve-${start ? 'off' : 'on'}`);
                assert.equal(await page.evalFn(() => __ux.dialog().draft.on), start === null);
                await closeWith(page, closer);
                assert.equal(await discardOpen(), false, `${closer} asked nothing`);
                assert.deepEqual(await draftBlock(page), start, `${closer} from ${start ? 'a block' : 'no block'}`);
            }
        });

        for (const s of STEPPERS) {
            await t.test(`a tap on the ${s.heading} value opens the number pad with its limits; a typed value goes to the block`, async () => {
                await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
                await openFromChart(page);
                const shown = await page.evalFn((id) => __ux.droot().getElementById(id).value, s.id);
                await openPad(page, s.id);
                const pad = await padState(page);
                assert.deepEqual({ ...pad, confirmDisabled: undefined }, {
                    open: true,
                    heading: s.heading,
                    unit: s.unit,
                    value: shown.toFixed(2),
                    range: s.limits,
                    rangeText: s.range,
                    outOfBand: false,
                    confirmDisabled: undefined,
                });
                assert.equal(await page.evalFn(() => __ux.isOpen()), true, 'the page stays open under the pad');
                const stepperLimits = await page.evalFn((id) => {
                    const st = __ux.droot().getElementById(id);
                    return { min: st.min, max: st.max, step: st.step };
                }, s.id);
                assert.deepEqual(stepperLimits, s.limits);
                await page.click(`${D} >>> #shape-pad >>> #key-1`);
                await page.click(`${D} >>> #shape-pad >>> #key-decimal`);
                await page.click(`${D} >>> #shape-pad >>> #key-2`);
                await padConfirm(page);
                assert.equal(await page.evalFn(() => __ux.isOpen()), true, 'Confirm closes only the pad');
                const after = await page.evalFn((id) => {
                    const st = __ux.droot().getElementById(id);
                    return { value: st.value, text: st.shadowRoot.getElementById('value').textContent.trim() };
                }, s.id);
                assert.deepEqual(after, { value: 1.2, text: '1.20' });
                assert.deepEqual((await deepFocus(page)).slice(-2), [s.id, 'value']);
                await closeWith(page, 'shape-apply');
                const saved = await draftBlock(page);
                assert.equal(saved[s.field], 1.2);
                for (const other of STEPPERS.filter((o) => o !== s)) {
                    assert.equal(saved[other.field], SPEC_EXAMPLE[other.field], `${other.field} unchanged`);
                }
            });
        }

        await t.test('a typed value takes the same step as the stepper', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await openPad(page, 'ftau');
            await typeKeys(page, ['1', '.', '2', '3']);
            await padConfirm(page);
            const value = await page.evalFn(() => __ux.dialog().draft.flowTau);
            assert.ok(Math.abs(value * 50 - Math.round(value * 50)) < 1e-9, `on the 0.02 step: ${value}`);
            assert.ok(Math.abs(value - 1.23) <= 0.01 + 1e-9, `next to the typed value: ${value}`);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('pad Cancel and Escape close only the pad and keep the value', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await openPad(page, 'ftau');
            await typeKeys(page, ['3']);
            await page.click(`${D} >>> #shape-pad >>> #cancel`);
            assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-pad").open === false')), true);
            assert.equal(await page.evalFn(() => __ux.isOpen()), true, 'pad Cancel leaves the page open');
            assert.equal(await page.evalFn(() => __ux.dialog().draft.flowTau), 0.5);
            await openPad(page, 'pramp');
            await typeKeys(page, ['2']);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-pad").open === false')), true);
            await page.settle(4);
            assert.equal(await page.evalFn(() => __ux.isOpen()), true, 'pad Escape leaves the page open');
            assert.equal(await page.evalFn(() => __ux.dialog().draft.pressureRamp), 1);
            assert.deepEqual((await deepFocus(page)).slice(-2), ['pramp', 'value']);
            await closeWith(page, 'shape-apply');
            assert.deepEqual(await draftBlock(page), SPEC_EXAMPLE);
        });

        await t.test('an entry out of range cannot be confirmed, as on the other screens', async () => {
            await openFromChart(page);
            await openPad(page, 'ptau');
            await typeKeys(page, ['9']);
            const pad = await padState(page);
            assert.equal(pad.outOfBand, true);
            assert.equal(pad.confirmDisabled, true);
            assert.equal(await page.evalFn(() => __ux.droot().getElementById('shape-pad').confirm('press')), false);
            await page.press('Escape');
            assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-pad").open === false')), true);
            assert.equal(await page.evalFn(() => __ux.dialog().draft.pressureTau), 0);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('a pad entry after Clear makes a block from the values shown', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await page.click(`${D} >>> #shape-clear`);
            const shown = await page.evalFn(() => structuredClone(__ux.dialog().draft));
            await openPad(page, 'framp');
            await typeKeys(page, ['2']);
            await padConfirm(page);
            assert.equal(await page.evalFn(() => __ux.droot().getElementById('shape-clear').disabled), false, 'the entry undoes the cleared state');
            await closeWith(page, 'shape-apply');
            const saved = await draftBlock(page);
            assert.notEqual(saved, null);
            assert.equal(saved.flow_ramp_tau, 2);
            assert.equal(saved.pressure_ramp_tau, shown.pressureRamp);
            assert.equal(saved.pressure_filter_tau, shown.pressureFilter);
            assert.equal(Object.hasOwn(saved, 'ramp_factor'), false);
            assert.equal(saved.flow_tau, shown.flowTau);
            assert.equal(saved.pressure_tau, shown.pressureTau);
            assert.equal(saved.flow_mode, shown.flowMode);
            assert.equal(saved.pressure_mode, shown.pressureMode);
            assert.deepEqual(saved.pump_curve, shown.on ? shown.points : []);
        });

        await t.test('a confirmed entry on a profile with no block makes a block, even of the value shown', async () => {
            await page.evalFn(() => __ux.setBlock(null));
            await openFromChart(page);
            const shown = await page.evalFn(() => __ux.dialog().draft.flowTau);
            await openPad(page, 'ftau');
            await padConfirm(page);
            await closeWith(page, 'shape-apply');
            const saved = await draftBlock(page);
            assert.notEqual(saved, null);
            assert.equal(saved.flow_tau, shown);
            await page.evalFn(() => __ux.setBlock(null));
        });

        await t.test('the readouts on the page do not open the pad', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await page.click(`${D} >>> #preview-btn`);
            await page.settle(4);
            const editable = await page.evalFn(() => [...__ux.droot().querySelectorAll('ui-stepper')]
                .map((st) => [st.id, st.editable === true, st.shadowRoot.getElementById('value').tagName]));
            assert.deepEqual(editable, [
                ['ftau', true, 'BUTTON'], ['ptau', true, 'BUTTON'], ['pfilt', true, 'BUTTON'],
                ['pramp', true, 'BUTTON'], ['framp', true, 'BUTTON'],
            ]);
            await page.click(`${D} >>> #preview-sum`);
            await page.click(`${D} >>> #ftau-chart`);
            await page.settle(2);
            assert.equal((await padState(page)).open, false);
            await page.click(`${D} >>> #preview-btn`);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the page keeps the editor out of reach when the editor is moved while it is open', async () => {
            await page.evalFn((b) => __ux.setBlock(b), SPEC_EXAMPLE);
            await openFromChart(page);
            await page.evalFn(async () => {
                const screen = __ux.screen();
                const parent = screen.parentNode;
                const next = screen.nextSibling;
                parent.removeChild(screen);
                parent.insertBefore(screen, next);
                await __ux.settle();
            });
            assert.equal(await page.evalFn(() => __ux.isOpen()), true);
            assert.deepEqual(await editorInert(page), { band: true, body: true });
            assert.equal(await page.evalFn(() => __ux.dialog().getAttribute('role')), 'dialog');
            await closeWith(page, 'shape-back');
            assert.deepEqual(await editorInert(page), { band: false, body: false });
        });
    });
});

const EVERY_FIELD = Object.freeze(block(SPEC_EXAMPLE.pump_curve, {
    pressure_tau: 0.5, pressure_filter_tau: 0.8, pressure_ramp_tau: 1.2, flow_ramp_tau: 0.9,
}));

const openWith = async (page, value) => {
    await page.evalFn((b) => __ux.setBlock(b), value);
    await openFromChart(page);
    await page.settle(4);
};

const miniPaths = (page, id) => page.evalFn((chart) => Object.fromEntries([...__ux.droot()
    .querySelectorAll(`#${chart} path`)].map((p) => [p.getAttribute('class'), p.getAttribute('d')])), id);

test('the native shaping page with every field above 0', async (t) => {
    await withApp(TABLET, async (page) => {
        await t.test('the page and each card fit at 1280x800 with no scroll', async () => {
            await openWith(page, EVERY_FIELD);
            const fit = await page.evalFn(() => {
                const root = __ux.droot();
                const scroll = Object.fromEntries(['shape-slot', 'shape-body', 'm-right']
                    .map((id) => {
                        const el = root.getElementById(id);
                        return [id, el.scrollHeight - el.clientHeight];
                    }));
                const out = [];
                for (const id of ['ftau', 'ptau', 'ramp']) {
                    const sec = root.getElementById(`${id}-sec`);
                    const box = sec.getBoundingClientRect();
                    if (sec.scrollHeight !== sec.clientHeight) out.push(`${id} scrolls ${sec.scrollHeight - sec.clientHeight}`);
                    const parts = [...sec.querySelector('.ctl-side').querySelectorAll('*'), root.getElementById(`${id}-chart`)];
                    for (const el of parts) {
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) continue;
                        if (r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5) {
                            out.push(`${id} ${el.id || el.className || el.tagName} ${Math.round(r.bottom - box.bottom)} px`);
                        }
                    }
                }
                return { scroll, out };
            });
            assert.deepEqual(fit, { scroll: { 'shape-slot': 0, 'shape-body': 0, 'm-right': 0 }, out: [] });
            const l = await layout(page);
            const heights = l.cards.map((c) => c.chart.height);
            assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `chart heights ${heights}`);
            const small = (await controlSizes(page)).filter((c) => c.w < 47.5 || c.h < 47.5);
            assert.deepEqual(small, []);
            assert.deepEqual((await stepperSizes(page)).off, []);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the new steppers show the block values and the captions, with one tip per card', async () => {
            await openWith(page, EVERY_FIELD);
            const seen = await page.evalFn(() => {
                const root = __ux.droot();
                return {
                    values: ['pfilt', 'pramp', 'framp'].map((id) => root.getElementById(id).value),
                    captions: ['pfilt-l', 'pramp-l', 'framp-l'].map((id) => root.getElementById(id).textContent.trim()),
                    tips: ['tip-pfilt-btn', 'tip-pramp-btn', 'tip-framp-btn'].map((id) => root.getElementById(id) !== null),
                    perCard: ['ftau-sec', 'ptau-sec', 'ramp-sec'].map((id) => [...root.getElementById(id).querySelectorAll('ui-icon-button')].map((b) => b.id)),
                    unit: [...root.querySelector('#ramp-sec .card-head .tt').children].map((n) => n.textContent.trim()),
                    follows: root.getElementById('ramp-follows').textContent.trim(),
                    modeBanks: root.querySelectorAll('#ramp-sec .bank').length,
                };
            });
            assert.deepEqual(seen, {
                values: [0.8, 1.2, 0.9],
                captions: ['Second filter τ₂ · 0 = off', 'Pressure', 'Flow'],
                tips: [false, false, false],
                perCard: [['tip-ftau-btn'], ['tip-ptau-btn'], ['tip-ramp-btn']],
                unit: ['Ramp time', 's · 0 to 5 · 0 = plain ramp'],
                follows: 'Each ramp follows the mode of its kind.',
                modeBanks: 0,
            });
            const tipText = async (id) => {
                await page.click(`${D} >>> #tip-${id}-btn`);
                assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-tip").open === true')), true, `${id} tip opened`);
                const parts = await page.evalFn(() => [...__ux.droot().querySelectorAll('#shape-tip .tip > *')]
                    .map((n) => `${n.tagName} ${n.textContent.trim()}`));
                await page.press('Escape');
                assert.equal(await page.evalFn(() => __ux.until('__ux.droot().getElementById("shape-tip").open === false')), true);
                return parts;
            };
            assert.deepEqual(await tipText('ptau'), [
                'P Time constant of a pressure step, 0 to 5 s, in steps of 0.02 s. 0 = a plain step. Both, Rise, Fall: the step directions it acts on.',
                'P Chart: a pressure step up at 0 s and down at 2.5 s. Dashed: the step. Solid: the shaped target.',
                'H4 Second filter τ₂',
                'P A second filter on the pressure target of a fast pressure step, after the first. Time constant 0 to 5 s, in steps of 0.02 s. 0 = off. It follows the Pressure τ mode.',
                'P Chart: dotted, the first filter only. Solid: both filters.',
            ]);
            assert.deepEqual((await tipText('ramp')).slice(3), [
                'H4 Pressure ramp time',
                'P Time constant of the filter after a smooth pressure ramp, 0 to 5 s, in steps of 0.02 s. 0 = the plain ramp. It follows the Pressure τ mode.',
                'H4 Flow ramp time',
                'P Time constant of the filter after a smooth flow ramp, 0 to 5 s, in steps of 0.02 s. 0 = the plain ramp. It follows the Flow τ mode.',
            ]);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the Pressure τ card has τ, then τ₂, then the mode selector', async () => {
            await openWith(page, EVERY_FIELD);
            const order = await page.evalFn(() => {
                const card = __ux.droot().getElementById('ptau-sec');
                const want = ['ptau', 'pfilt-l', 'pfilt', 'pmode-both'];
                return want.map((id) => [id, card.querySelector(`#${id}`).getBoundingClientRect().top])
                    .sort((a, b) => a[1] - b[1]).map(([id]) => id);
            });
            assert.deepEqual(order, ['ptau', 'pfilt-l', 'pfilt', 'pmode-both']);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('every stepper is as wide as the mode selector', async () => {
            await openWith(page, EVERY_FIELD);
            const widths = await page.evalFn(() => {
                const root = __ux.droot();
                const w = (el) => el.getBoundingClientRect().width;
                const bank = { ftau: w(root.querySelector('#ftau-sec .bank')), ptau: w(root.querySelector('#ptau-sec .bank')) };
                return {
                    bank,
                    steppers: { ftau: w(root.getElementById('ftau')), ptau: w(root.getElementById('ptau')), pfilt: w(root.getElementById('pfilt')),
                        pramp: w(root.getElementById('pramp')), framp: w(root.getElementById('framp')) },
                };
            });
            const against = { ftau: 'ftau', ptau: 'ptau', pfilt: 'ptau', pramp: 'ptau', framp: 'ptau' };
            for (const [id, w] of Object.entries(widths.steppers)) {
                assert.ok(Math.abs(w - widths.bank[against[id]]) <= 1, `${id} ${w} against the selector ${widths.bank[against[id]]}`);
            }
            assert.deepEqual((await stepperSizes(page)).off, []);
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the pad heading keeps the Greek letters in lower case', async () => {
            await openWith(page, EVERY_FIELD);
            await openPad(page, 'pfilt');
            const greek = await page.evalFn(() => {
                const found = [];
                const walk = (node) => {
                    for (const el of node.querySelectorAll('*')) {
                        if (el.classList.contains('as-is')) found.push([el.textContent, getComputedStyle(el).textTransform]);
                        if (el.shadowRoot) walk(el.shadowRoot);
                    }
                };
                walk(__ux.droot().getElementById('shape-pad').shadowRoot);
                return found;
            });
            assert.deepEqual(greek, [['τ', 'none']]);
            assert.equal((await padState(page)).heading, 'Second filter τ₂');
            await page.press('Escape');
            await closeWith(page, 'shape-cancel');
        });

        await t.test('the dotted first-filter line shows only when τ₂ is above 0', async () => {
            await openWith(page, EVERY_FIELD);
            const on = await miniPaths(page, 'ptau-chart');
            assert.ok(on['first pressure'], Object.keys(on).join(','));
            assert.notEqual(on['first pressure'], on['shaped pressure']);
            const note = () => page.evalFn(() => [...__ux.droot().querySelectorAll('#ptau-chart text.note')].map((n) => n.textContent));
            assert.deepEqual(await note(), ['dotted: first filter only']);
            await closeWith(page, 'shape-cancel');
            await openWith(page, { ...EVERY_FIELD, pressure_filter_tau: 0 });
            const off = await miniPaths(page, 'ptau-chart');
            assert.deepEqual(Object.keys(off).sort(), ['raw pressure', 'shaped pressure']);
            assert.deepEqual(await note(), []);
            await openPad(page, 'pfilt');
            await typeKeys(page, ['1']);
            await padConfirm(page);
            await page.settle(2);
            assert.ok((await miniPaths(page, 'ptau-chart'))['first pressure'], 'the line comes back after an entry');
            await closeWith(page, 'shape-apply');
            assert.equal((await draftBlock(page)).pressure_filter_tau, 1);
        });

        await t.test('the Ramp time chart follows the pressure mode and the flow mode', async () => {
            const ramps = async (over) => {
                await openWith(page, { ...EVERY_FIELD, ...over });
                const p = await miniPaths(page, 'ramp-chart');
                await closeWith(page, 'shape-cancel');
                return {
                    pressure: p['shaped pressure'] === p['raw pressure'] ? 'plain' : 'shaped',
                    flow: p['shaped flow'] === p['raw flow'] ? 'plain' : 'shaped',
                    p: p['shaped pressure'],
                    f: p['shaped flow'],
                };
            };
            const both = await ramps({ pressure_mode: 'both', flow_mode: 'both' });
            const off = await ramps({ pressure_mode: 'fall', flow_mode: 'rise' });
            const on = await ramps({ pressure_mode: 'rise', flow_mode: 'fall' });
            const plain = await ramps({ pressure_ramp_tau: 0, flow_ramp_tau: 0 });
            assert.deepEqual([both.pressure, both.flow], ['shaped', 'shaped']);
            assert.deepEqual([off.pressure, off.flow], ['plain', 'plain']);
            assert.deepEqual([on.pressure, on.flow], ['shaped', 'shaped']);
            assert.deepEqual([plain.pressure, plain.flow], ['plain', 'plain']);
            assert.equal(on.p, both.p);
            assert.equal(on.f, both.f);
        });
    });
});
