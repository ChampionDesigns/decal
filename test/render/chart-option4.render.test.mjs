/**
 * Render tests for the A/B comparison stroke on the History chart pages.
 *
 * Reads the drawn uPlot series and compares their widths and dash rhythms against the
 * named comparison strokes, in both themes and at two device pixel ratios, including
 * the single-shot fallback when there is no comparison.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, BENCH } from '../harness/index.js';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const mountPair = async (page, tag = 'history-flow-page') => {
    await page.mount(`<${tag} style="display:block;height:780px"></${tag}>`, [`/src/screens/${tag}.js`]);
    await page.evalFn(async tag => {
        const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
        const record = await (await fetch('/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json')).json();
        const base = deriveFromRecord(record);
        const x = [0, .1, .2, .3];
        const y = { pressure: 8, targetPressure: 9, flow: 2, targetFlow: 2.2, weightFlow: 1.4,
            power: 1.6, groupTemp: 92, targetTemp: 93, mixTemp: 93, targetMixTemp: 94,
            resistance: 2, impedance: 4 };
        const series = Object.fromEntries(Object.entries(y).map(([key, value]) => [key, { x, y: x.map(() => value) }]));
        const axis = { ...base.axis, t: x };
        const a = { ...base, axis, series }, b = { ...base, axis, series: structuredClone(series) };
        window.__pair = { a, b };
        const el = document.querySelector(tag);
        el.derivationA = a; el.derivationB = b;
        await el.updateComplete;
        await Promise.all([...el.shadowRoot.querySelectorAll('ui-chart-card')].map(c => c.ready));
    }, tag);
    await page.settle(8);
};

const inspect = page => page.evalFn(async () => {
    const { default: UPlot } = await import('uplot');
    const el = document.querySelector('history-flow-page');
    return [...el.shadowRoot.querySelectorAll('ui-chart-card')].map(card => {
        const u = card.plotHandle.raw, legend = card.querySelector('ui-chart-legend');

        const chips = [...legend.shadowRoot.querySelectorAll('.chip')].map(chip => ({
            key: chip.dataset.key, colour: getComputedStyle(chip.querySelector('line')).stroke,
        }));
        const normaliseColour = colour => { const span = document.createElement('span'); span.style.color = colour; document.body.append(span); const value = getComputedStyle(span).color; span.remove(); return value; };
        return { id: card.id, chips, dpr: UPlot.pxRatio,
            series: u.series.slice(1).map((s, i) => ({ key: s.label, width: s.width, alpha: s.alpha, cap: s.cap,
                colour: normaliseColour(typeof s.stroke === 'function' ? s.stroke(u, i + 1) : s.stroke),
                dash: s.dash?.map(v => v / UPlot.pxRatio) ?? null, show: s.show,
                samples: u.data[i + 1]?.filter(Number.isFinite) ?? [] })) };
    });
});

function assertRoles(cards, dark = false) {
    for (const card of cards) {
        for (const series of card.series) {
            const target = series.key.replace(/^b:/, '').startsWith('target'), b = series.key.startsWith('b:');
            assert.equal(series.width, target ? (b ? 1.05 : 3.5) : (b ? 1.35 : 4.5));
            assert.deepEqual(series.dash, target ? (b ? [6, 8] : [16, 10]) : null);
            assert.equal(series.alpha, 1);
            assert.equal(series.cap, 'round');
        }

        for (const chip of card.chips.filter(c => !c.key.startsWith('target'))) {
            const series = card.series.find(s => s.key === chip.key);
            assert.ok(series, chip.key);
            assert.equal(chip.colour, series.colour, `${chip.key} swatch agrees with A's trace`);
        }
    }
    const top = cards.find(c => c.id === 'plot-top');
    const by = Object.fromEntries(top.series.map(s => [s.key, s]));
    assert.equal(by.pressure.colour, 'rgb(46, 194, 126)');
    assert.equal(by['b:pressure'].colour, dark ? 'rgb(181, 255, 210)' : 'rgb(0, 115, 70)');
    assert.equal(by.targetPressure.colour, by.pressure.colour);
    assert.equal(by['b:targetPressure'].colour, by['b:pressure'].colour);
}

test('all four roles agree with native canvas in both themes and after DPR changes', () => browser.withPage({ geometry: BENCH, theme: 'light' }, async page => {
    await mountPair(page);
    assertRoles(await inspect(page));
    await page.setTheme('dark'); await page.settle(8);
    assertRoles(await inspect(page), true);
    await page.setGeometry({ ...BENCH, deviceScaleFactor: 2 }); await page.settle(12);
    const moved = await inspect(page);
    assert.equal(moved[0].dpr, 2);
    assertRoles(moved, true);
    assert.deepEqual(page.pageErrors, []);
}));

test('quantity toggles survive a palette flip; same-timestamp replacements and absent targets stay truthful', () => browser.withPage({ geometry: BENCH }, async page => {
    await mountPair(page);
    await page.evalFn(() => document.querySelector('history-flow-page').shadowRoot.querySelector('ui-chart-legend').setVisible('pressure', false));
    await page.setTheme('dark'); await page.settle(8);
    let cards = await inspect(page);
    for (const key of ['pressure', 'b:pressure']) assert.equal(cards[0].series.find(s => s.key === key).show, false);
    assert.equal(cards[0].series.find(s => s.key === 'targetPressure').show, true);
    await page.evalFn(async () => {
        const el = document.querySelector('history-flow-page');
        const a = { ...__pair.a, series: structuredClone(__pair.a.series) };
        a.series.pressure.y = [6, 6, 6, 6];
        const b = { ...__pair.b, series: structuredClone(__pair.b.series) };
        delete b.series.targetPressure;
        el.derivationA = a; el.derivationB = b;
        await el.updateComplete;
    });
    await page.settle(8); cards = await inspect(page);
    assert.equal(cards[0].series.length, 12, 'replacement retained A/B composition');
    assert.ok(cards[0].series.find(s => s.key === 'pressure').samples.every(v => v === 6));
    assert.equal(cards[0].series.find(s => s.key === 'b:targetPressure').samples.length, 0, 'no fabricated target for B');
    assert.ok(cards[1].series.find(s => s.key === 'b:groupTemp').samples.length > 0, 'temperature comparison survives');
    await page.evalFn(async () => { const el = document.querySelector('history-flow-page'); el.derivationB = null; await el.updateComplete; });
    await page.settle(8);
    cards = await inspect(page);
    assert.equal(cards[0].series.length, 6);
    assert.equal(cards[0].series.find(s => s.key === 'pressure').width, 3, 'single-shot measured width restored');
    assert.deepEqual(cards[0].series.find(s => s.key === 'targetPressure').dash, [9, 9], 'single-shot target remains dashed');
    assert.deepEqual(page.pageErrors, []);
}));

test('Power comparison keeps derived measurements solid and the time-coloured trajectory key truthful', () => browser.withPage({ geometry: BENCH, theme: 'dark' }, async page => {
    await mountPair(page, 'history-power-page');
    const read = () => page.evalFn(() => {
        const el = document.querySelector('history-power-page');
        const derived = el.shadowRoot.getElementById('plot-derived');
        const pq = el.shadowRoot.querySelector('[data-plot="trajectory"]');
        return {
            traces: derived.plotHandle.raw.series.slice(1).map(s => ({ key: s.label, dash: s.dash ?? null, width: s.width, colour: s._stroke, alpha: s.alpha })),
            paths: pq.plotHandle.state.bands.filter(s => s.points.length > 2).map(s => ({ width: s.width, dash: s.dash ?? null, alpha: s.alpha ?? 1 })),
            key: pq.querySelector('.trajectory-group-key')?.textContent,
        };
    });
    let result = await read();
    for (const s of result.traces) {
        assert.equal(s.dash, null); assert.equal(s.alpha, 1);
        assert.equal(s.width, s.key.startsWith('b:') ? 1.35 : 4.5);
    }
    const a = result.traces.find(s => s.key === 'resistance'), b = result.traces.find(s => s.key === 'b:resistance');
    assert.notEqual(a.colour, b.colour);
    assert.deepEqual(result.paths, [{ width: 4.5, dash: null, alpha: 1 }, { width: 1.35, dash: null, alpha: 1 }]);
    assert.match(result.key, /A wide.*B narrow.*both measured/);
    await page.evalFn(async () => { const el = document.querySelector('history-power-page'); el.derivationA = { ...__pair.a, series: structuredClone(__pair.a.series) }; await el.updateComplete; });
    await page.settle(8); result = await read();
    assert.equal(result.traces.filter(s => s.key.startsWith('b:')).length, 2, 'same-timestamp replacement retained derived comparison');
    assert.equal(result.paths.length, 2);
    const widths = await page.evalFn(async () => {
        const { default: UPlot } = await import('uplot');
        const pq = document.querySelector('history-power-page').shadowRoot.querySelector('[data-plot="trajectory"]');

        pq.pixelRatio = .75;
        await pq.updateComplete;
        const ctx = pq.plotHandle.raw.ctx, stroke = ctx.stroke, widths = [];
        ctx.stroke = function (...args) { widths.push(this.lineWidth / UPlot.pxRatio); return stroke.apply(this, args); };
        try { pq.drawNow(); } finally { ctx.stroke = stroke; }
        return [...new Set(widths)];
    });

    const paints = (want) => widths.some((w) => Math.abs(w - want) < .01);
    assert.ok(paints(4.5), 'A trajectory paints at the same CSS width as its key');
    assert.ok(paints(1.35), 'B trajectory paints at the same CSS width as its key');
    assert.deepEqual(page.pageErrors, []);
}));
