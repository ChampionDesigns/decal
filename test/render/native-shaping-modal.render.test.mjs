import { test } from 'node:test';
import assert from 'node:assert/strict';

import { launch } from '../harness/index.js';
import { FLOOR, TABLET } from '../harness/geometry.js';
import { CHART, TITLE, USABLE_ID, chartShotData, mountChartApp } from '../harness/chart-ux.js';

const E = 'app-root >>> editor-screen';
const D = `${E} >>> #shaping-dialog`;
const ENTRY = `${CHART} >>> #shaping-entry`;
const SETTINGS_EDIT = `${E} >>> #shaping-edit-settings`;
const BAND_CANCEL = `${E} >>> #band >>> #cancel`;

const SPEC_EXAMPLE = Object.freeze({
    version: 1,
    pump_curve: [
        { pressure: 1, flow: 20 }, { pressure: 3, flow: 12 }, { pressure: 6, flow: 6 },
        { pressure: 9, flow: 5 }, { pressure: 12, flow: 4 },
    ],
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0,
    pressure_mode: 'both',
    ramp_factor: 1,
});

const block = (points, over = {}) => ({ ...SPEC_EXAMPLE, pump_curve: points, ...over });

const THREE = [{ pressure: 2, flow: 14 }, { pressure: 6, flow: 8 }, { pressure: 10, flow: 3 }];
const EIGHT = [1, 2.5, 4, 5.5, 7, 8.5, 10, 11.5].map((pressure, i) => ({ pressure, flow: 19 - i * 2 }));

async function setup(page) {
    await page.evalFn(async () => {
        __ux.dialog = () => __ux.screen().shadowRoot.getElementById('shaping-dialog');
        __ux.droot = () => __ux.dialog().shadowRoot;
        __ux.isOpen = () => __ux.droot().getElementById('shape-dialog').open === true;
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
    assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true, 'the modal opened');
    await page.evalFn(() => __ux.until('__ux.droot().getElementById("curve-chart")'));
};

const closeWith = async (page, id) => {
    await page.click(`${D} >>> #${id}`);
    assert.equal(await page.evalFn(() => __ux.until('!__ux.isOpen()')), true, 'the modal closed');
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
        const dialog = root.getElementById('shape-dialog');
        for (const el of dialog.querySelectorAll('button')) add(el, el.id || el.textContent.trim());
        for (const el of dialog.querySelectorAll('ui-icon-button')) add(el, el.id);
        for (const st of dialog.querySelectorAll('ui-stepper')) {
            for (const b of st.shadowRoot.querySelectorAll('button')) add(b, `${st.id} ${b.getAttribute('aria-label') ?? ''}`);
        }
        for (const g of root.querySelectorAll('.pt')) add(g, g.id);
        return out;
    });
}

async function layout(page) {
    return page.evalFn(() => {
        const root = __ux.droot();
        const box = (el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
        };
        const cards = ['ftau', 'ptau', 'rfac'].map((id) => ({
            id,
            card: box(root.getElementById(`${id}-sec`)),
            chart: box(root.getElementById(`${id}-chart`)),
            stepper: box(root.getElementById(id)),
            bank: root.querySelector(`#${id}-sec .bank`) ? box(root.querySelector(`#${id}-sec .bank`)) : null,
        }));
        const curveSec = root.getElementById('curve-sec');
        const kids = [...curveSec.children].map((el) => el.id || el.className);
        return {
            cards,
            curveKids: kids,
            curveBox: box(root.getElementById('curve-box')),
            dialog: box(root.getElementById('shape-dialog').dialog),
            text: root.getElementById('shape-dialog').textContent,
        };
    });
}

test('the native shaping modal at 1280x800', async (t) => {
    await withApp(TABLET, async (page) => {
        await t.test('the button sits between the Grind card and the key cards and opens the modal at once', async () => {
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

        await t.test('the Settings row opens the same modal', async () => {
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
                flow_tau: 0.5, flow_mode: 'both', pressure_tau: 0.5, pressure_mode: 'both', ramp_factor: 1,
            }));
            assert.deepEqual(both, {
                caption: 'Pump curve on, 5 points · flow τ 0.50 s, both · pressure τ 0.50 s, both · ramp 1.00',
                note: 'Bengle only; hidden in DE1 emulation.',
            });
            const other = await row(block([], {
                flow_tau: 2.5, flow_mode: 'rise', pressure_tau: 0, pressure_mode: 'fall', ramp_factor: 1.5,
            }));
            assert.equal(other.caption, 'Pump curve off · flow τ 2.50 s, rise · pressure τ 0.00 s · ramp 1.50');
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

        await t.test('Off then On inside one modal brings the points back; Off then Apply saves an empty curve', async () => {
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

        await t.test('the dialog text renders at the designed CSS px size', async () => {
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
                assert.ok(c.stepper.top - c.card.top < 64, `${c.id} stepper at the top of its card`);
            }
            for (const c of l.cards.slice(0, 2)) {
                assert.ok(c.bank.top >= c.stepper.bottom - 0.5, `${c.id} toggle under the stepper`);
                assert.ok(c.bank.right <= c.chart.left, `${c.id} toggle left of the chart`);
            }
            assert.ok(l.curveBox.height > 400, `curve chart ${l.curveBox.height}`);
            const small = (await controlSizes(page)).filter((c) => c.w < 47.5 || c.h < 47.5);
            assert.deepEqual(small, []);
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

test('the native shaping modal at 1000x600', async () => {
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

test('with no block in the profile the modal opens on the settings the loaded shot ran', async () => {
    const ran = block(THREE, { flow_tau: 1.25, flow_mode: 'rise', pressure_tau: 0.75, ramp_factor: 1.5 });
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
        assert.equal(draft.ramp, 1.5);
        await closeWith(page, 'shape-apply');
        assert.equal(await draftBlock(page), null, 'an untouched Apply sends no block');
        await page.evalFn(async () => { __ux.screen().tab = 'settings'; await __ux.settle(); });
        await page.click(SETTINGS_EDIT);
        assert.equal(await page.evalFn(() => __ux.until('__ux.isOpen()')), true);
        assert.equal(await page.evalFn(() => __ux.dialog().draft.flowTau), 1.25);
        await closeWith(page, 'shape-cancel');
    }, reportedShotData(ran));
});

test('with no block and no shot loaded the modal opens on the defaults', async () => {
    await withApp(TABLET, async (page) => {
        await page.evalFn(() => __ux.setBlock(null));
        await openFromChart(page);
        const draft = await page.evalFn(() => structuredClone(__ux.dialog().draft));
        assert.equal(draft.on, false);
        assert.deepEqual(draft.points, []);
        assert.equal(draft.flowTau, 0);
        assert.equal(draft.ramp, 1);
        await closeWith(page, 'shape-apply');
        assert.equal(await draftBlock(page), null);
    });
});

test('no shaping dialog opens while the profile saves', async () => {
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
