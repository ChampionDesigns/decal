/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-stat-tile.js'];

const EM_DASH = '—';

const WIDE = 1120;
const NARROW = 480;

const SETTLE_MS = 320;
const landed = async (page) => { await sleep(SETTLE_MS); await page.settle(1); };

const MARKUP = `
<div id="cluster" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="flow" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="time" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
    <ui-stat-tile id="promoted" label="Pressure" value="9.0" unit="bar"
        size="lg" reserve="xl"></ui-stat-tile>
    <ui-stat-tile id="promoted-now" label="Pressure" value="9.0" unit="bar"
        size="xl" reserve="xl"></ui-stat-tile>
</div>

<div id="narrow-cluster" style="container-type: inline-size; inline-size: ${NARROW}px;
     display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="narrow-flow" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="narrow-time" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
</div>

<!--
  SOLO TILES, each alone in its own container at the SAME width. A cluster stretches
  every tile to the tallest of them (align-items: stretch, and
  it is right), so a height comparison between siblings measures the row and not the
  tile. These four are how the tile's OWN block size is measured.
-->
<div id="solo-lg-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-lg" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
</div>
<div id="solo-xl-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-xl" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
</div>
<div id="solo-rest-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-rest" label="Pressure" value="9.0" unit="bar"
        size="lg" reserve="xl"></ui-stat-tile>
</div>
<div id="solo-pulling-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-pulling" label="Pressure" value="9.0" unit="bar"
        size="xl" reserve="xl"></ui-stat-tile>
</div>

<!-- Same container, two very different tile widths: the digits must not care. -->
<div id="uneven" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: 4fr 1fr; column-gap: 24px">
    <ui-stat-tile id="fat" label="Weight" value="36.2" unit="g"></ui-stat-tile>
    <ui-stat-tile id="thin" label="Weight" value="36.2" unit="g"></ui-stat-tile>
</div>

<div id="states" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="absent" label="Ratio"></ui-stat-tile>
    <ui-stat-tile id="zero" label="Weight" value="0" unit="g"></ui-stat-tile>
    <ui-stat-tile id="no-unit" label="Ratio" value="1:2.1"></ui-stat-tile>
    <ui-stat-tile id="long-label" label="Peak flow after first drop"
        value="3.4" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="dimmed" label="Flow" value="2.1" unit="ml/s" disabled></ui-stat-tile>
</div>

<!-- Selection is inexpressible: every spelling Appendix 15 lists, on the host. -->
<div id="selection" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="sel-pressed" label="Flow" value="2.1" aria-pressed="true"></ui-stat-tile>
    <ui-stat-tile id="sel-selected" label="Flow" value="2.1" aria-selected="true"></ui-stat-tile>
    <ui-stat-tile id="sel-checked" label="Flow" value="2.1" aria-checked="true"></ui-stat-tile>
    <ui-stat-tile id="sel-current" label="Flow" value="2.1" aria-current="true"></ui-stat-tile>
    <ui-stat-tile id="sel-class" class="is-selected" label="Flow" value="2.1"></ui-stat-tile>
    <ui-stat-tile id="sel-attr" selected label="Flow" value="2.1"></ui-stat-tile>
    <ui-stat-tile id="sel-none" label="Flow" value="2.1"></ui-stat-tile>
</div>

<div id="ink" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="tinted" label="Flow" value="2.1" unit="ml/s"
        style="--_ui-stat-ink: var(--ui-channel-flow)"></ui-stat-tile>
</div>

<div id="slotting" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="slotted" label="Weight">
        <button slot="value" type="button">Retry</button>
    </ui-stat-tile>
</div>

<div id="focus-host" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="focusable" label="Flow" value="2.1" tabindex="0"></ui-stat-tile>
</div>
<div id="band" style="container-type: inline-size; inline-size: ${WIDE}px;
     overflow: hidden; padding: 8px">
    <ui-stat-tile id="clipped" label="Flow" value="2.1" tabindex="0"
        focus-ring="inset"></ui-stat-tile>
</div>
`;

const SLATE = {
    restingDigits: 45,
    promotedDigits: 52,
    valueTrack: 44,
    labelTrack: 18,
    rowGap: 4,
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

const near = (a, b, tol = 0.75) => Math.abs(a - b) <= tol;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-stat-tile @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-stat-tile must mount without throwing');
            return fn(page);
        });

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

        test('drill: the label reads --ui-muted, --ui-text-sm, --ui-weight-semibold, --ui-tracking-cap', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#flow >>> #label',
                property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                selector: '#flow >>> #label',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-semibold',
                value: '800',
                selector: '#flow >>> #label',
                property: 'font-weight',
            });
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: '3px',
                expected: '3px',
                selector: '#flow >>> #label',
                property: 'letter-spacing',
            });
        }));

        test('drill: the reading reads --ui-display-lg/-xl, --ui-weight-light and --ui-text', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-display-lg',
                value: DRILL_LENGTH,
                selector: '#flow >>> #value',
                property: 'font-size',
                prepare: landed,          // the promotion transition — see SETTLE_MS
            });
            await assertTokenDrill(page, {
                token: '--ui-display-xl',
                value: DRILL_LENGTH,
                selector: '#time >>> #value',
                property: 'font-size',
                prepare: landed,
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-light',
                value: '800',
                selector: '#flow >>> #value',
                property: 'font-weight',
            });
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#flow >>> #value',
                property: 'color',
            });
        }));

        test('drill: --ui-font-family, --ui-space-1 and the unit tokens', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#flow >>> #value',
                property: 'font-family',
            });
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#flow >>> #label',
                property: 'font-family',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#flow',
                property: 'row-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#flow >>> #unit',
                property: 'margin-left',
            });
            const labelMargin = await page.computed('#flow >>> #label',
                ['margin-top', 'margin-bottom']);
            assert.deepEqual(
                labelMargin, { 'margin-top': '0px', 'margin-bottom': '0px' },
                'the label must carry no margin of its own — Slate expresses one 8px gap as ' +
                'row-gap: 4px plus margin-bottom: 4px, two owners for one dimension (spec §2.3)',
            );
        }));

        test('drill: the promotion transition reads --ui-dur-slow and --ui-ease', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-dur-slow',
                value: '450ms',
                expected: '0.45s',
                selector: '#flow >>> #value',
                property: 'transition-duration',
            });
            await assertTokenDrill(page, {
                token: '--ui-ease',
                value: 'linear',
                expected: 'linear',
                selector: '#flow >>> #value',
                property: 'transition-timing-function',
            });
            const which = await page.prop('#flow >>> #value', 'transition-property');
            assert.equal(
                which, 'font-size',
                'the promotion animates SIZE only — Appendix item 3, "State changes weight, ' +
                'never position ... nothing appears, disappears or slides mid-pull"',
            );
        }));

        test('drill: a channel tint arrives from OUTSIDE, through --_ui-stat-ink', () => mounted(async (page) => {
            const tinted = await page.prop('#tinted >>> #value', 'color');
            const plain = await page.prop('#flow >>> #value', 'color');
            assert.notEqual(tinted, plain,
                'the tinted tile must not paint the plain ink');
            assert.equal(
                tinted, await page.resolveToken('--ui-channel-flow', 'color'),
                'the tint must land on --ui-channel-flow, not on a copy of its value',
            );
            await assertTokenDrill(page, {
                token: '--ui-channel-flow',
                value: DRILL_COLOUR,
                selector: '#tinted >>> #value',
                property: 'color',
            });
            assert.equal(
                await page.prop('#tinted >>> #unit', 'color'),
                await page.resolveToken('--ui-muted', 'color'),
                'the unit keeps --ui-muted whatever the reading is tinted',
            );
        }));

        test('the component declares no public tokens of its own — bug L12 by construction', () => mounted(async (page) => {
            const declared = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return [...text.matchAll(/(^|[^r(])(--ui-[a-z0-9-]+)\s*:/g)].map((m) => m[2]);
            }, '#flow');
            assert.deepEqual(declared, [], `this component declares public tokens: ${declared}`);
        }));

        test('zero !important, and no raw colour literal, in the authored sheet', () => mounted(async (page) => {
            const found = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const rules = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules]);
                const out = { bangs: 0, literals: [] };
                const walk = (list) => {
                    for (const r of list) {
                        if (r.cssRules) { walk([...r.cssRules]); continue; }
                        const st = r.style;
                        if (!st) continue;
                        for (const p of st) {
                            if (st.getPropertyPriority(p) === 'important') out.bangs += 1;
                            const v = st.getPropertyValue(p);
                            if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(v)) out.literals.push(`${p}: ${v}`);
                        }
                    }
                };
                walk(rules);
                return out;
            }, '#flow');
            assert.equal(found.bangs, 0, 'component styles must carry zero !important');
            assert.deepEqual(found.literals, [],
                `raw colour literals in component CSS (A8, guard 3): ${found.literals.join(' | ')}`);
        }));

        test('WAVE LAW: the four dials move nothing — this component has no selected look', () => mounted(async (page) => {
            const READ = ['background-color', 'color', 'box-shadow', 'text-shadow', 'outline-color'];
            const probes = ['#sel-none', '#sel-none >>> #label', '#sel-none >>> #value'];

            const snapshot = async () => {
                const out = {};
                for (const p of probes) out[p] = await page.computed(p, READ);
                return out;
            };

            const before = await snapshot();
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', '9px');
            await page.setToken('--ui-selected-glow', '90%');
            const after = await snapshot();
            for (const t of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(t, null);
            }

            assert.deepEqual(
                after, before,
                'a selection dial moved something in ui-stat-tile.\n' +
                '  Wave law: "NO private selected look anywhere in this wave — a component ' +
                'expresses selection ONLY via the dial tokens", and a readout expresses none ' +
                'at all. selectionSurface is deliberately not imported here (CONVENTIONS §4).',
            );
        }));

        test('WAVE LAW: every Appendix 15 state spelling paints nothing', () => mounted(async (page) => {
            const READ = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const baseline = await page.computed('#sel-none >>> #value', READ);
            const baselineHost = await page.computed('#sel-none', READ);

            for (const id of ['sel-pressed', 'sel-selected', 'sel-checked', 'sel-current',
                'sel-class', 'sel-attr']) {
                assert.deepEqual(
                    await page.computed(`#${id} >>> #value`, READ), baseline,
                    `#${id}: a selection state spelling painted the reading`,
                );
                assert.deepEqual(
                    await page.computed(`#${id}`, READ), baselineHost,
                    `#${id}: a selection state spelling painted the host`,
                );
            }

            assert.equal(
                baselineHost['background-color'], 'rgba(0, 0, 0, 0)',
                'the tile paints no ground of its own',
            );
        }));

        const atSlateBounds = async (page, fn) => {
            await page.setToken('--ui-display-lg', `${SLATE.restingDigits}px`);
            await page.setToken('--ui-display-xl', `${SLATE.promotedDigits}px`);
            await landed(page);
            try { return await fn(); } finally {
                await page.setToken('--ui-display-lg', null);
                await page.setToken('--ui-display-xl', null);
                await landed(page);
            }
        };

        const tileMetrics = async (page, id) => {
            const host = await page.box(`#${id}`);
            const value = await page.box(`#${id} >>> #value`);
            const label = await page.box(`#${id} >>> #label`);
            const size = parseFloat(await page.prop(`#${id} >>> #value`, 'font-size'));
            return { host, value, label, size };
        };

        test('L2 DEAD: the value track is never smaller than the digits in it', () => mounted(async (page) => {
            await atSlateBounds(page, async () => {
                for (const [id, expected] of [['flow', SLATE.restingDigits],
                    ['time', SLATE.promotedDigits]]) {
                    const m = await tileMetrics(page, id);

                    assert.ok(near(m.size, expected),
                        `#${id}: digits should be ${expected}px at Slate's own bound, got ${m.size}px`);

                    // (a) the value box is at least as tall as its own type
                    assert.ok(
                        m.value.height >= m.size - 0.5,
                        `#${id}: value box ${m.value.height}px against ${m.size}px of type. ` +
                        `Slate's was ${SLATE.valueTrack}px against ${expected}px — that is L2.`,
                    );

                    assert.ok(
                        m.value.bottom <= m.host.bottom + 0.5 && m.value.top >= m.host.top - 0.5,
                        `#${id}: the reading escapes its own tile — value ` +
                        `[${m.value.top.toFixed(1)}, ${m.value.bottom.toFixed(1)}] against host ` +
                        `[${m.host.top.toFixed(1)}, ${m.host.bottom.toFixed(1)}]. ` +
                        'That overhang IS L2: Slate\'s live-ready #slate-live-time [i=97] ' +
                        'rect y=248 h=52 ends at 300 in a cluster ending at 297.',
                    );

                    const gap = parseFloat(await page.prop(`#${id}`, 'row-gap'));
                    assert.ok(
                        m.host.height >= m.label.height + gap + m.size - 0.5,
                        `#${id}: tile ${m.host.height}px cannot hold label ${m.label.height}px ` +
                        `+ gap ${gap}px + digits ${m.size}px`,
                    );
                }
            });
        }));

        test('L2 DEAD: the track is a FLOOR — it grows past anything the scale can produce', () => mounted(async (page) => {
            await page.setToken('--ui-display-xl', '120px');
            await landed(page);
            const m = await tileMetrics(page, 'time');
            await page.setToken('--ui-display-xl', null);

            assert.ok(near(m.size, 120), `expected 120px of type, got ${m.size}px`);
            assert.ok(
                m.value.height >= 120 - 0.5,
                `value box ${m.value.height}px against 120px of type — the track is not a floor`,
            );
            assert.ok(
                m.value.bottom <= m.host.bottom + 0.5,
                'the reading escaped its tile at 120px — the tile has a fixed height somewhere',
            );
        }));

        test('L2 DEAD: the tile declares no height, and nothing on the value path clips', () => mounted(async (page) => {
            const host = await page.computed('#flow',
                ['max-height', 'overflow-x', 'overflow-y']);
            assert.equal(host['max-height'], 'none', 'the tile must declare no maximum height');
            assert.equal(host['overflow-x'], 'visible', 'the tile must not clip');
            assert.equal(host['overflow-y'], 'visible', 'the tile must not clip');

            const value = await page.computed('#flow >>> #value',
                ['overflow-x', 'overflow-y', 'white-space']);
            assert.equal(value['overflow-x'], 'visible',
                'a reading is never clipped — a clipped number is a WRONG number');
            assert.equal(value['overflow-y'], 'visible', 'a reading is never clipped');
            assert.equal(value['white-space'], 'nowrap', 'a reading never wraps');

            const lg = await page.box('#solo-lg');
            const xl = await page.box('#solo-xl');
            assert.ok(
                xl.height > lg.height,
                `a promoted tile must be taller than a resting one when nothing is reserved — ` +
                `xl ${xl.height}px against lg ${lg.height}px`,
            );
        }));

        test('the label track is FIXED and derived, so a bigger number never drags its label', () => mounted(async (page) => {
            const resting = await page.box('#flow >>> #label');
            const promoted = await page.box('#time >>> #label');
            const cluster = await page.box('#cluster');

            assert.ok(
                near(resting.height, promoted.height),
                `label tracks differ between a resting and a promoted tile: ` +
                `${resting.height}px vs ${promoted.height}px`,
            );
            assert.ok(
                near(resting.top - cluster.top, promoted.top - cluster.top),
                `labels sit on different lines — resting at +${(resting.top - cluster.top).toFixed(1)}px, ` +
                `promoted at +${(promoted.top - cluster.top).toFixed(1)}px. This is exactly the ` +
                '7px/22px misalignment Slate\'s two-row grid was written to remove.',
            );

            const sm = parseFloat(await page.resolveToken('--ui-text-sm', 'width'));
            assert.ok(
                near(resting.height, sm * 1.2),
                `the label track should be 1.2 x --ui-text-sm (${(sm * 1.2).toFixed(1)}px), ` +
                `got ${resting.height}px`,
            );
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                expected: `${37 * 1.2}px`,
                selector: '#flow >>> #label',
                property: 'line-height',
            });
        }));

        test('RESERVE: a promoted tile does not reflow — nothing slides mid-pull', () => mounted(async (page) => {
            const rest = await page.box('#solo-rest');          // size=lg reserve=xl
            const pulling = await page.box('#solo-pulling');    // size=xl reserve=xl
            assert.ok(
                near(rest.height, pulling.height),
                `a reserved tile changed height on promotion: ${rest.height}px -> ${pulling.height}px`,
            );

            const unreserved = await page.box('#solo-lg');
            assert.ok(
                rest.height > unreserved.height,
                `reserve="xl" must hold xl-sized space at rest: ${rest.height}px against ` +
                `an unreserved ${unreserved.height}px`,
            );

            for (const id of ['solo-rest', 'solo-pulling', 'promoted', 'promoted-now']) {
                const m = await tileMetrics(page, id);
                assert.ok(m.value.bottom <= m.host.bottom + 0.5,
                    `#${id}: the reading escapes its reserved tile`);
            }
        }));

        test('L3 STAYS DEAD: one live alignment declaration per axis', () => mounted(async (page) => {
            const v = await page.computed('#flow >>> #value', ['align-items', 'align-self']);
            assert.equal(v['align-items'], 'baseline');
            assert.equal(v['align-self'], 'end');

            // Measured, not merely declared: the unit's baseline is the reading's baseline.
            const reading = await page.box('#flow >>> #reading');
            const unit = await page.box('#flow >>> #unit');
            assert.ok(
                unit.bottom <= reading.bottom + 0.5 && unit.bottom > reading.top,
                `the unit does not sit on the reading's baseline — unit bottom ` +
                `${unit.bottom.toFixed(1)}, reading ${reading.top.toFixed(1)}..${reading.bottom.toFixed(1)}`,
            );

            // And the readings across a cluster share a bottom line.
            const a = await page.box('#flow >>> #reading');
            const b = await page.box('#time >>> #reading');
            assert.ok(
                near(a.bottom, b.bottom, 1.5),
                `readings of different sizes do not share a line: ${a.bottom.toFixed(1)} vs ${b.bottom.toFixed(1)}`,
            );
        }));

        test('the tile is NOT its own container — the cluster is', () => mounted(async (page) => {
            assert.equal(
                await page.prop('#flow', 'container-type'), 'normal',
                'the tile must not establish its own inline-size container',
            );

            // Same container, two very different tile widths: the digits must not care.
            const fat = await page.box('#fat');
            const thin = await page.box('#thin');
            assert.ok(fat.width > thin.width * 2,
                `the fixture must actually make the tiles uneven: ${fat.width} vs ${thin.width}`);
            assert.equal(
                await page.prop('#fat >>> #value', 'font-size'),
                await page.prop('#thin >>> #value', 'font-size'),
                'two tiles in ONE cluster must size their digits together — that is the whole ' +
                'reason the tile is not its own container',
            );
        }));

        test('the digits HOLD their size in a narrow container, and still fit', () => mounted(async (page) => {
            const wide = parseFloat(await page.prop('#flow >>> #value', 'font-size'));
            const narrow = parseFloat(await page.prop('#narrow-flow >>> #value', 'font-size'));
            assert.equal(narrow, wide,
                `a ${NARROW}px container must give the SAME digits as a ${WIDE}px one: ` +
                `${narrow}px vs ${wide}px`);
            assert.ok(near(wide, 45), `lg is Slate's flat --slate-display-lg 45px, got ${wide}px`);

            const wideXl = parseFloat(await page.prop('#time >>> #value', 'font-size'));
            const narrowXl = parseFloat(await page.prop('#narrow-time >>> #value', 'font-size'));
            assert.equal(narrowXl, wideXl, 'and the xl step holds too');
            assert.ok(near(wideXl, 52), `xl is Slate's flat --slate-display-xl 52px, got ${wideXl}px`);

            for (const id of ['narrow-flow', 'narrow-time']) {
                const m = await tileMetrics(page, id);
                assert.ok(m.value.bottom <= m.host.bottom + 0.5,
                    `#${id}: the reading escapes its tile at the narrow container`);
            }

            acrossGeometries[geometry.name] = { wide, narrow, wideXl, narrowXl };
        }));

        test('a long label ellipsises; the reading never does', () => mounted(async (page) => {
            const label = await page.computed('#long-label >>> #label',
                ['overflow-x', 'text-overflow', 'white-space']);
            assert.equal(label['overflow-x'], 'hidden');
            assert.equal(label['text-overflow'], 'ellipsis');
            assert.equal(label['white-space'], 'nowrap');

            const host = await page.box('#long-label');
            const box = await page.box('#long-label >>> #label');
            assert.ok(
                box.width <= host.width + 0.5,
                `the label spilled out of its tile: ${box.width}px in ${host.width}px`,
            );
            const scrolls = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return el.scrollWidth > el.clientWidth;
            }, '#long-label >>> #label');
            assert.ok(scrolls, 'the fixture must actually overflow the label for this to mean anything');
        }));

        test('the tile has an explicit floor and never scrolls itself', () => mounted(async (page) => {
            await page.setStyle('#narrow-cluster', { 'inline-size': '160px' });
            const m = await page.metrics('#narrow-flow');
            assert.equal(m.overflow?.x ?? 'visible', 'visible');
            const host = await page.box('#narrow-flow');
            const value = await page.box('#narrow-flow >>> #value');
            assert.ok(
                value.bottom <= host.bottom + 0.5,
                'the reading escaped its tile in a 160px cluster',
            );
            // The tile keeps its block floor: label + gap + the clamped digits.
            const size = parseFloat(await page.prop('#narrow-flow >>> #value', 'font-size'));
            const label = await page.box('#narrow-flow >>> #label');
            const gap = parseFloat(await page.prop('#narrow-flow', 'row-gap'));
            assert.ok(host.height >= label.height + gap + size - 0.5,
                `tile ${host.height}px cannot hold ${label.height} + ${gap} + ${size}`);
        }));

        test('a consumer-focusable tile gets THE ring, unclipped, at both offsets', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#focusable');
            await assertFocusUnclipped(page, '#clipped');
        }));

        test('no hit-area overlay — nothing here is pressable', () => mounted(async (page) => {
            for (const sel of ['#flow >>> #value', '#flow >>> #label']) {
                const before = await page.computed(sel, ['content'], { pseudo: '::before' });
                assert.equal(before.content, 'none',
                    `${sel} grew a pseudo-element — the hit-area utility is not this row's`);
            }
            assert.equal(
                await page.prop('#flow', 'cursor'), 'auto',
                'a readout must not present as pressable',
            );
        }));

        test('an absent reading is the ONE mark, and it is named for a screen reader', () => mounted(async (page) => {
            const text = await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading');
            assert.equal(text, EM_DASH,
                'the absent mark must be U+2014 EM DASH, byte-identical to units.js:67');

            assert.equal(await page.prop('#absent >>> #reading', 'visibility'), 'visible');
            const hidden = await page.evalFn(
                (s) => window.__h.need(s).getAttribute('aria-hidden'), '#absent >>> #reading');
            assert.equal(hidden, 'true', 'the dash must be hidden from the accessibility tree');

            const spoken = await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #a11y');
            assert.equal(spoken, 'no reading');
            const a11y = await page.computed('#absent >>> #a11y',
                ['display', 'visibility', 'clip-path', 'position']);
            assert.notEqual(a11y.display, 'none');
            assert.notEqual(a11y.visibility, 'hidden');
            assert.equal(a11y['clip-path'], 'inset(50%)');
        }));

        test('the absent sentence is TRANSLATED (D2), and has no per-instance knob (D11)',
            () => mounted(async (page) => {
            const inert = await page.evalFn(async () => {
                const el = window.__h.need('#absent');
                el.setAttribute('absent-label', 'CUSTOM WORDING');
                el.absentLabel = 'CUSTOM WORDING';
                await el.updateComplete;
                return el.shadowRoot.querySelector('#a11y').textContent;
            });
            assert.equal(inert, 'no reading',
                'a per-instance wording attribute must be inert — D11, and seven tiles in '
                + 'one cluster must not be able to announce one absence seven ways');

            const [translated, restored] = await page.evalFn(async () => {
                const { translations } = await import('/src/lib/i18n.js');
                const el = window.__h.need('#absent');
                translations.set('xx', { 'no reading': 'keine Anzeige' });
                await el.updateComplete;
                const after = el.shadowRoot.querySelector('#a11y').textContent;
                translations.set('en', {});
                await el.updateComplete;
                return [after, el.shadowRoot.querySelector('#a11y').textContent];
            });
            assert.equal(translated, 'keine Anzeige',
                'a language change must re-render the announcement through the template — '
                + 'the old skin translated by walking the document, which cannot cross a '
                + 'shadow boundary at all (src/lib/i18n.js header)');
            assert.equal(restored, 'no reading');
        }));

        test('ZERO IS A MEASUREMENT — 0 renders as 0, not as the dash', () => mounted(async (page) => {
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#zero >>> #reading'),
                '0',
            );
            assert.equal(await page.exists('#zero >>> #a11y'), false,
                'a zero is not absent and must not be announced as one');
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-hidden'),
                    '#zero >>> #reading'),
                null,
                'a real reading is not hidden from the accessibility tree',
            );

            await page.evalFn((s) => { window.__h.need(s).value = 0; return true; }, '#absent');
            await page.settle(2);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading'),
                '0',
            );
            await page.evalFn((s) => { window.__h.need(s).value = null; return true; }, '#absent');
            await page.settle(2);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading'),
                EM_DASH,
            );
        }));

        test('the unit is omitted when there is none, and the dash carries none', () => mounted(async (page) => {
            assert.equal(await page.exists('#no-unit >>> #unit'), false);
            assert.equal(await page.exists('#absent >>> #unit'), false,
                'an absent reading has no unit to qualify');
            assert.equal(await page.exists('#flow >>> #unit'), true);
        }));

        test('a slotted control REPLACES the reading — no private action pill', () => mounted(async (page) => {
            assert.equal(await page.exists('#slotted >>> #reading'), false,
                'the slotted control must replace the reading, not sit beside it');
            const slot = await page.computed('#slotted >>> slot[name="value"]', ['display']);
            assert.equal(slot.display, 'contents',
                'the slot must add no box between the flex line and the control');
            const painted = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const ctor = customElements.get(el.localName);
                const baseSheet = ctor?.baseStyles?.styleSheet ?? null;
                const own = [...el.shadowRoot.adoptedStyleSheets]
                    .filter((sh) => sh !== baseSheet);
                if (own.length === el.shadowRoot.adoptedStyleSheets.length) {
                    throw new Error('the base sheet was not identified — this scan would ' +
                        'be checking the base rather than the component');
                }
                const rules = own.flatMap((sh) => [...sh.cssRules])
                    .map((r) => r.cssText).join('\n');
                return /::slotted/.test(rules);
            }, '#slotted');
            assert.equal(painted, false,
                'this component must not restyle what is slotted into it (and must not ' +
                'carry a ::slotted focus-ring copy — CONVENTIONS §3a)');
        }));

        test('disabled is the base dial, paint only', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.11',
                expected: '0.11',
                selector: '#dimmed',
                property: 'opacity',
            });
            assert.equal(await page.prop('#flow', 'opacity'), '1');
        }));

        test('every gallery state mounts, settles and renders a tile', () => mounted(async (page) => {
            const { entry } = await import('../../tools/gallery/entries/ui-stat-tile.entry.js');

            assert.equal(entry.id, 'ui-stat-tile', 'the entry id is the capture-filename stem');
            assert.equal(entry.module, './entries/ui-stat-tile.demo.js',
                'module stays relative to tools/gallery/ (README) and points at the loader ' +
                'that imports ui-button too — gallery.js:86-88 waits forever on an ' +
                'undefined custom element rather than rendering a plain one');
            const ids = entry.states.map((s) => s.id);
            assert.equal(new Set(ids).size, ids.length,
                `state ids are capture filenames and must be unique: ${ids}`);

            for (const state of entry.states) {
                assert.ok(state.hostStyle?.['container-type'] === 'inline-size',
                    `${state.id}: a stat-tile state must declare the ancestor container, ` +
                    'or every reading in it pins at the clamp floor');

                const style = Object.entries(state.hostStyle)
                    .map(([k, v]) => `${k}:${v}`).join('; ');
                await page.mount(
                    `<div id="stage-host" style="${style}">${state.html}</div>`,
                    ['/src/components/ui-stat-tile.js', '/src/components/ui-button.js'],
                );
                assert.deepEqual(page.pageErrors, [],
                    `${state.id}: the state threw while mounting`);

                const tiles = await page.count('#stage-host ui-stat-tile');
                assert.ok(tiles > 0, `${state.id}: mounted no tile at all`);

                const empty = await page.evalFn((sel) => {
                    const out = [];
                    for (const el of document.querySelectorAll(sel)) {
                        const label = el.shadowRoot.getElementById('label');
                        const value = el.shadowRoot.getElementById('value');
                        if (!label || !value) { out.push(`${el.getAttribute('label')}: no parts`); continue; }
                        const lr = label.getBoundingClientRect();
                        const vr = value.getBoundingClientRect();
                        if (lr.height <= 0 || vr.height <= 0) {
                            out.push(`${el.getAttribute('label')}: ${lr.height}x${vr.height}`);
                        }
                    }
                    return out;
                }, '#stage-host ui-stat-tile');
                assert.deepEqual(empty, [], `${state.id}: tiles with no rendered box: ${empty}`);
            }
        }));
    });
}

describe('ui-stat-tile across geometries', () => {
    test('the same container renders the same tile at both geometries', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, 2, `expected both geometries to have run, got ${names}`);
        const [a, b] = names;
        assert.deepEqual(
            acrossGeometries[a], acrossGeometries[b],
            `ui-stat-tile renders differently at ${a} and ${b} for the SAME container — ` +
            'something is reading the viewport (spec §2.1 Rule 1, no @media (width...)).',
        );
    });
});
