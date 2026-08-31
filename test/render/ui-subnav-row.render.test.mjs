/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-subnav-row.js'];

const LABELS = ['Cup Warmer', 'Lighting', 'USB Charger', 'Steam', 'Hot Water', 'Flush', 'Advanced'];
const N = LABELS.length;

const COLUMN_STYLE = 'display:grid; align-content:start; gap:var(--ui-seam);'
    + ' background-color:var(--ui-line);';

const subRows = LABELS.map((label, i) =>
    `<ui-subnav-row id="s${i}" value="v${i}"${i === 1 ? ' current' : ''}>${label}</ui-subnav-row>`,
).join('');

const catRows = LABELS.map((_, i) =>
    `<div id="c${i}" style="block-size:var(--ui-nav-row); background-color:var(--ui-fascia)"></div>`,
).join('');

const MARKUP = `
<div id="columns" style="display:flex; align-items:flex-start; gap:var(--ui-space-5)">
    <div id="cat" style="${COLUMN_STYLE} inline-size:260px">${catRows}</div>
    <div id="sub" style="${COLUMN_STYLE} inline-size:338px">${subRows}</div>
</div>
<div id="stack" style="inline-size:338px">
    <ui-subnav-row id="p0">Machine</ui-subnav-row>
    <ui-subnav-row id="p1">Display</ui-subnav-row>
    <ui-subnav-row id="p2">Calibration</ui-subnav-row>
</div>
<div id="clipper" style="overflow-y:auto; block-size:200px; inline-size:338px; ${COLUMN_STYLE}">
    <ui-subnav-row id="d0">Descaling</ui-subnav-row>
    <ui-subnav-row id="d1">Water hardness</ui-subnav-row>
    <ui-subnav-row id="d2">Steam</ui-subnav-row>
    <ui-subnav-row id="d3">Rinse</ui-subnav-row>
</div>
<div id="open-holder" style="inline-size:338px">
    <ui-subnav-row id="outset" focus-ring="outset">Descaling</ui-subnav-row>
</div>
<div id="narrow" style="inline-size:180px">
    <ui-subnav-row id="cramped">Default load settings and other long words</ui-subnav-row>
</div>
<div id="misc" style="inline-size:338px">
    <ui-subnav-row id="off" disabled>Transport Mode</ui-subnav-row>
    <ui-subnav-row id="gone" hidden>Hidden</ui-subnav-row>
</div>
`;

const HOST = (id) => `ui-subnav-row#${id}`;
const ROW = (id) => `ui-subnav-row#${id} >>> #row`;
const LABEL = (id) => `ui-subnav-row#${id} >>> #label`;

const ORACLE = {
    dark: {
        ink: 'rgb(148, 161, 169)',
        ground: 'rgb(14, 19, 23)',
        selectedFace: 'rgb(176, 196, 206)',
        selectedInk: 'rgb(18, 24, 28)',
        hoverInk: 'rgb(244, 247, 248)',   // --ui-text, styles/tokens.css:847
        hoverFace: 'rgb(26, 33, 39)',     // --ui-key,  styles/tokens.css:843
    },
    light: {
        ink: 'rgb(90, 101, 108)',
        ground: 'rgb(242, 243, 243)',
        selectedFace: 'rgb(49, 92, 112)',
        selectedInk: 'rgb(248, 252, 253)',
        hoverInk: 'rgb(23, 26, 28)',      // --ui-text, styles/tokens.css:726
        hoverFace: 'rgb(248, 249, 249)',  // --ui-key,  styles/tokens.css:722
    },
    fontSize: '22px',
    fontWeight: '400',
    paddingLeft: '24px',
    gap: '4px',
    /* The four numbers this component is here to NOT reproduce. */
    bug: { height: 89, pitch: 93, radius: '6px', led: '-4px' },
};

const roundPx = (v) => Math.round(parseFloat(v));

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

const HOVER_CAPABLE = ['--blink-settings=primaryHoverType=2,availableHoverTypes=2,'
    + 'primaryPointerType=4,availablePointerTypes=4'];

let browser;        // a device that hovers — everything except the guard assertion
let touchPanel;
before(async () => {
    browser = await launch({ extraArgs: HOVER_CAPABLE });
    touchPanel = await launch();
});
after(async () => {
    await browser?.close();
    await touchPanel?.close();
});

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-subnav-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mountedOn = (which, fn) => which.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-subnav-row must mount without throwing');
            return fn(page);
        });

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-subnav-row must mount without throwing');
            return fn(page);
        });

        /** The pitch token, resolved rather than assumed — see the header note. */
        const navRow = (page) => page.resolveToken('--ui-nav-row', 'width').then(parseFloat);
        const seam = (page) => page.resolveToken('--ui-seam', 'width').then(parseFloat);

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

        test('drill: --ui-nav-row is the pitch, and the ONLY owner of it', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-nav-row', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'height',
            });
            const drilled = await assertTokenDrill(page, {
                token: '--ui-nav-row', value: DRILL_LENGTH,
                selector: HOST('s0'), property: 'height',
                expectLanding: false,
            });
            assert.equal(
                roundPx(drilled.after), roundPx(DRILL_LENGTH),
                'the HOST box is the pitch too — a row whose control is the token and whose '
                + 'host is something else is exactly T2 with the numbers swapped',
            );
        }));

        test('drill: the pitch derives from --ui-control-h through the token', () => mounted(async (page) => {
            const before = parseFloat(await page.prop(ROW('s0'), 'height'));
            await page.setToken('--ui-control-h', '100px');
            const expected = await navRow(page);
            const after = parseFloat(await page.prop(ROW('s0'), 'height'));
            await page.setToken('--ui-control-h', null);
            const restored = parseFloat(await page.prop(ROW('s0'), 'height'));

            assert.notEqual(after, before, '--ui-control-h did not reach the row');
            assert.equal(after, expected, 'the row is --ui-nav-row, whatever the arithmetic behind it');
            assert.equal(restored, before, 'the drill did not restore');
        }));

        test('drill: --ui-fascia is the cell ground (the host paints itself)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia', value: DRILL_COLOUR,
                selector: HOST('s0'), property: 'background-color',
            });
        }));

        test('drill: --ui-muted is the resting ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted', value: DRILL_COLOUR,
                selector: ROW('s0'), property: 'color',
            });
        }));

        test('drill: --ui-space-5 is the inline padding', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'padding-left',
            });
        }));

        test('drill: --ui-text-nav is the type size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-nav', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'font-size',
            });
        }));

        test('drill: --ui-weight-regular is the resting weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-regular', value: '800',
                selector: ROW('s0'), property: 'font-weight',
            });
        }));

        test('drill: --ui-space-1 is the slot gap', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-1', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'column-gap',
            });
        }));

        test('drill: --ui-key and --ui-text are the hover face and ink', () => mounted(async (page) => {
            const hover = async (p) => {
                const b = await p.box(ROW('s2'));
                await p.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await p.settle(1);
            };
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR,
                selector: ROW('s2'), property: 'background-color', prepare: hover,
            });
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR,
                selector: ROW('s2'), property: 'color', prepare: hover,
            });
        }));

        test('DEPARTURE 6: the hover face is guarded by (hover: hover)', () => mounted(async (page) => {
            const settle = async (p) => {
                const b = await p.box(ROW('s2'));
                await p.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await p.settle(1);
                return b;
            };

            // A device that hovers: the face lights, so the negative below is not vacuous.
            const rest = await page.prop(ROW('s2'), 'background-color');
            await settle(page);
            assert.notEqual(await page.prop(ROW('s2'), 'background-color'), rest,
                'the hover face must exist for this assertion to mean anything');

            await mountedOn(touchPanel, async (touch) => {
                assert.equal(await touch.eval('matchMedia("(hover: hover)").matches'), false,
                    'the second browser must really be a device that cannot hover');
                const b = await settle(touch);
                assert.equal(await touch.prop(ROW('s2'), 'background-color'),
                    'rgba(0, 0, 0, 0)',
                    'a touch panel lit the hover face — the last row tapped stays lit');
                assert.equal(await touch.prop(ROW('s2'), 'color'),
                    await touch.prop(ROW('s0'), 'color'),
                    'and the hover ink came with it');

                await touch.mouse('mousePressed', b.left + b.width / 2, b.top + b.height / 2,
                    { clickCount: 1 });
                await touch.settle(1);
                const pressed = await touch.prop(ROW('s2'), 'background-color');
                await touch.mouse('mouseReleased', b.left + b.width / 2, b.top + b.height / 2,
                    { clickCount: 1 });
                assert.equal(pressed,
                    await touch.resolveValue('var(--ui-key-on)', 'background-color'),
                    'the press face must survive the guard');
            });
        }));

        test('drill: --ui-opacity-disabled is the one dim dial, applied ONCE', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: HOST('off'), property: 'opacity',
            });
            const inner = await page.prop(ROW('off'), 'opacity');
            assert.equal(
                inner, '1',
                `double-dim: the control inside a disabled ui-subnav-row computes opacity ${inner}.`,
            );
            // And the row really is dimmed once, by the dial, on the host.
            assert.equal(await page.prop(HOST('off'), 'opacity'), '0.38');
        }));

        test('one selection treatment: face, ink, LED and glow are the four dials', () => mounted(async (page) => {
            await assertOneSelectionTreatment(page, {
                selected: ROW('s1'),
                unselected: ROW('s0'),
            });
        }));

        test('the dials reach the row through the shadow boundary and nothing else does', () => mounted(async (page) => {
            const before = await page.computed(ROW('s0'), ['background-color', 'color']);
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            const movedSel = await page.computed(ROW('s1'), ['background-color', 'color']);
            const movedOther = await page.computed(ROW('s0'), ['background-color', 'color']);
            await page.setToken('--ui-selected-face', null);
            await page.setToken('--ui-selected-ink', null);

            assert.equal(movedSel['background-color'], DRILL_COLOUR);
            assert.equal(movedSel.color, DRILL_COLOUR);
            assert.deepEqual(movedOther, before, 'the dials reached an unselected row');
        }));

        test('selection moves the DIALS and nothing else — no sixth treatment', () => mounted(async (page) => {
            const SURFACE = [
                'background-image', 'border-top-left-radius',
                'border-top-width', 'font-family', 'font-size',
                'gap', 'height', 'letter-spacing', 'min-height', 'opacity',
                'padding-left', 'text-transform', 'width',
            ];
            const current = await page.computed(ROW('s1'), SURFACE);
            const ordinary = await page.computed(ROW('s0'), SURFACE);
            assert.deepEqual(
                current, ordinary,
                'a property outside the five dials moved with the selected state. That is a '
                + 'private selected look, which is the defect that started the audit.',
            );
            const weights = await page.computed(ROW('s1'), ['font-weight']);
            const restingWeights = await page.computed(ROW('s0'), ['font-weight']);
            assert.equal(weights['font-weight'], '500', '[i=30] the current row is Slate\'s 500');
            assert.equal(restingWeights['font-weight'], ORACLE.fontWeight, '[i=32] resting is 400');
            assert.equal(weights['font-weight'],
                await page.resolveToken('--ui-selected-weight', 'font-weight'),
                'the 500 is READ from the dial, not written in this component');

            const edges = await page.computed(ROW('s1'), ['border-top-color', 'color', 'border-top-width']);
            assert.equal(edges['border-top-color'], edges.color, 'the border ink is currentColor, not a rule');
            assert.equal(edges['border-top-width'], '0px', 'and it draws nothing');
        }));

        test('the focus ring is the base ring, and it is INSET by default (DEPARTURE 7)', () => mounted(async (page) => {
            await assertFocusUnclipped(page, ROW('s0'));
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(await page.prop(ROW('s0'), 'outline-offset'), inset,
                'a bare row must ring inset — the column it is specified to live in scrolls');
            assert.equal(await page.evalFn(() => document.getElementById('s0').getAttribute('focus-ring')),
                'inset', 'the REAL attribute is set, so focusVariant stays honest');
        }));

        test('DEPARTURE 7: a default row keeps its whole ring inside a SCROLLING column (L24)', () => mounted(async (page) => {
            const scrolls = await page.metrics('#clipper');
            assert.ok(scrolls.scrollHeight > scrolls.clientHeight + 0.5,
                'the fixture column must really scroll, or this assertion is vacuous');
            for (const id of ['d0', 'd1', 'd2', 'd3']) {
                const g = await assertFocusUnclipped(page, ROW(id));
                assert.ok(g.clippers.length >= 1,
                    `#${id}: the column must really clip, or this assertion is vacuous`);
            }
        }));

        test('a consumer can still ask for the outset ring, and gets exactly one', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, ROW('outset'));
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset, 'focus-ring="outset" was overwritten');
            assert.notEqual(g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'the two offsets must really be two values');
            assert.equal(
                await page.evalFn(() => document.getElementById('outset').focusVariant),
                'outset', 'focusVariant reports the truth because the attribute is real');
        }));

        test('DEPARTURE 7: the inset default reaches a row built in script, too', () => mounted(async (page) => {
            const rings = await page.evalFn(async () => {
                const host = document.getElementById('stack');
                const made = [];
                for (const label of ['A', 'B']) {
                    const el = document.createElement('ui-subnav-row');
                    el.textContent = label;
                    host.appendChild(el);
                    made.push(el);
                }
                const opted = document.createElement('ui-subnav-row');
                opted.setAttribute('focus-ring', 'outset');
                host.appendChild(opted);
                await Promise.all([...made, opted].map((el) => el.updateComplete));
                return [...made, opted].map((el) => el.getAttribute('focus-ring'));
            });
            assert.deepEqual(rings, ['inset', 'inset', 'outset'],
                'every row rings the same way unless the consumer said otherwise');
        }));

        test('the row itself clips nothing — only the label does', () => mounted(async (page) => {
            const row = await page.computed(ROW('s0'), ['overflow-x', 'overflow-y']);
            assert.deepEqual(row, { 'overflow-x': 'visible', 'overflow-y': 'visible' });
            const label = await page.prop(LABEL('s0'), 'overflow-x');
            assert.equal(label, 'hidden');
        }));

        test('a narrow container clips the label and never the row height', () => mounted(async (page) => {
            const h = await navRow(page);
            const box = await page.box(HOST('cramped'));
            assert.equal(Math.round(box.height), Math.round(h), 'the row shrank with its container');
            assert.equal(Math.round(box.width), 180, 'the row fills the narrow column');

            const label = await page.metrics(LABEL('cramped'));
            assert.ok(
                label.scrollWidth > label.clientWidth,
                'the long label was not clipped — it either wrapped (which would break the '
                + 'pitch) or the container query the spec gives to the COLUMN got written here',
            );
            assert.equal(await page.prop(LABEL('cramped'), 'text-overflow'), 'ellipsis');
        }));

        test('the row does not overflow its own container', () => mounted(async (page) => {
            const m = await page.metrics('#narrow');
            assert.ok(
                m.scrollWidth <= m.clientWidth + 0.5,
                `a 180px column scrolls horizontally: scrollWidth ${m.scrollWidth} against `
                + `clientWidth ${m.clientWidth}`,
            );
        }));

        test('no component-level width query exists to be wrong', () => mounted(async (page) => {
            const wide = await page.computed(ROW('s0'), ['padding-left', 'font-size']);
            const narrow = await page.computed(ROW('cramped'), ['padding-left', 'font-size']);
            assert.deepEqual(narrow, wide, 'the row changed shape with its container');
        }));

        test('T2(a): the pitch IS the row — no margin, in a plain stack', () => mounted(async (page) => {
            const h = await navRow(page);
            const boxes = await Promise.all(['p0', 'p1', 'p2'].map((id) => page.box(HOST(id))));
            for (let i = 1; i < boxes.length; i++) {
                const pitch = boxes[i].top - boxes[i - 1].top;
                assert.equal(
                    Math.round(pitch), Math.round(h),
                    `row ${i} sits on a ${pitch}px pitch against a ${h}px row. Slate's numbers `
                    + `were ${ORACLE.bug.height} and ${ORACLE.bug.pitch}; the difference was margin.`,
                );
            }
        }));

        test('T2(a): seven rows of two columns stay aligned to the pixel at row 7', () => mounted(async (page) => {
            const cat = await Promise.all(LABELS.map((_, i) => page.box(`#c${i}`)));
            const sub = await Promise.all(LABELS.map((_, i) => page.box(HOST(`s${i}`))));
            for (let i = 0; i < N; i++) {
                assert.equal(
                    Math.round(sub[i].top - cat[i].top), 0,
                    `row ${i + 1} of the sub-category column is ${sub[i].top - cat[i].top}px off the `
                    + 'category column. T2 measured 24px by row 7.',
                );
                assert.equal(Math.round(sub[i].height), Math.round(cat[i].height));
            }
            assert.equal(Math.round(sub[N - 1].top - cat[N - 1].top), 0, 'row 7, the one T2 names');
        }));

        test('T2(a): the pitch survives a retarget of the token, on both columns at once', () => mounted(async (page) => {
            await page.setToken('--ui-nav-row', '120px');
            const cat = await page.box(`#c${N - 1}`);
            const sub = await page.box(HOST(`s${N - 1}`));
            await page.setToken('--ui-nav-row', null);
            assert.equal(Math.round(sub.top - cat.top), 0, 'the two columns drifted apart under a retarget');
            assert.equal(Math.round(sub.height), 120);
        }));

        test('T2(b): N rows give N-1 separators, and the row draws none of them', () => mounted(async (page) => {
            const s = await seam(page);
            assert.ok(s > 0, `--ui-seam resolved to ${s}px`);

            const boxes = await Promise.all(LABELS.map((_, i) => page.box(HOST(`s${i}`))));
            let gaps = 0;
            for (let i = 1; i < boxes.length; i++) {
                const gap = boxes[i].top - boxes[i - 1].bottom;
                assert.equal(
                    Math.round(gap * 10) / 10, s,
                    `the seam between rows ${i} and ${i + 1} is ${gap}px, not --ui-seam (${s}px)`,
                );
                gaps++;
            }
            assert.equal(gaps, N - 1, 'N cells did not give N-1 seams');

            const edges = await page.computed(ROW('s0'), [
                'border-top-width', 'border-right-width', 'border-bottom-width',
                'border-left-width', 'box-shadow',
            ]);
            assert.deepEqual(edges, {
                'border-top-width': '0px',
                'border-right-width': '0px',
                'border-bottom-width': '0px',
                'border-left-width': '0px',
                'box-shadow': 'none',
            });
        }));

        test('T3: the corner is square, and no document rule of any weight can round it', () => mounted(async (page) => {
            const corners = [
                'border-top-left-radius', 'border-top-right-radius',
                'border-bottom-right-radius', 'border-bottom-left-radius',
            ];
            const before = await page.computed(ROW('s0'), corners);
            assert.deepEqual(before, Object.fromEntries(corners.map((c) => [c, '0px'])),
                `the row rendered a radius. Slate measured ${ORACLE.bug.radius} against an authored 0.`);

            await page.evalFn((cssText) => {
                const s = document.createElement('style');
                s.id = 'reach-in';
                s.textContent = cssText;
                document.head.appendChild(s);
                return true;
            }, 'ui-subnav-row, ui-subnav-row *, [class*="row"], [id="row"], .row '
             + '{ border-radius: 6px !important; }');
            await page.settle(1);
            const after = await page.computed(ROW('s0'), corners);
            await page.evalFn(() => (document.getElementById('reach-in')?.remove(), true));

            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root and rounded the row — which is '
                + 'T3 exactly, and everything this architecture rests on is that it cannot.',
            );
        }));

        test('T5: the selected row draws NO LED, and the only thing that can is the dial', () => mounted(async (page) => {
            const resting = await page.prop(ROW('s0'), 'box-shadow');
            assert.equal(resting, 'none', 'the component declares a shadow of its own');

            const selected = await page.prop(ROW('s1'), 'box-shadow');
            const dial = shadowSegments(selected).at(-1) ?? '';
            const lengths = (dial.match(/-?\d+(\.\d+)?px/g) ?? []).map(parseFloat);
            assert.ok(lengths.length > 0, `no LED segment to measure in ${selected}`);
            assert.deepEqual(
                lengths.map(Math.abs).filter((n) => n !== 0), [],
                `the selected row draws a ${dial} strip with --ui-selected-led at its Slate `
                + `default of 0px. Slate drew ${ORACLE.bug.led} here without being asked.`,
            );

            await page.setToken('--ui-selected-led', '4px');
            const lit = shadowSegments(await page.prop(ROW('s1'), 'box-shadow')).at(-1) ?? '';
            await page.setToken('--ui-selected-led', null);
            assert.match(
                lit, /-4px/,
                `with the dial at 4px the LED segment was ${lit}; Slate's accidental strip was `
                + 'exactly this shape, drawn by a sheet that never consulted the dial.',
            );
        }));

        test('aria: selection is the aria state, and one property renders both', () => mounted(async (page) => {
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s1')), 'true');
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s0')), null,
                'an ordinary row must carry no aria-current at all, not aria-current="false"');
            assert.equal(await page.evalFn((s) => window.__h.need(s).hasAttribute('current'), HOST('s1')), true,
                'the property reflects to the host, so a consumer can see the state it set');

            // Flip it and watch both halves move together.
            await page.evalFn((s) => { window.__h.need(s).current = true; return true; }, HOST('s0'));
            await page.settle(2);
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s0')), 'true');
            assert.equal(await page.prop(ROW('s0'), 'background-color'), face);
        }));

        test('aria: it is a real button — keyboard-activated, focus moves with the press', () => mounted(async (page) => {
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).tagName.toLowerCase(), ROW('s0')),
                'button',
            );
            await page.recordEvents(HOST('s0'), ['navigate']);
            await page.focusVisible(ROW('s0'));
            await page.press('Enter');
            await page.press(' ');
            const events = await page.recordedEvents();
            assert.equal(events.length, 2, 'Enter and Space must each activate the row');
            assert.deepEqual(events[0].detail, { value: 'v0' }, 'the event carries the row value');
        }));

        test('a press emits navigate and does NOT make the row current', () => mounted(async (page) => {
            await page.recordEvents(HOST('s3'), ['navigate']);
            await page.click(ROW('s3'));
            const events = await page.recordedEvents();
            assert.equal(events.length, 1);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).current, HOST('s3')), false,
                'the row set its own current state',
            );
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s3')), null,
            );
        }));

        test('a disabled row emits nothing and is out of the tab order', () => mounted(async (page) => {
            await page.recordEvents(HOST('off'), ['navigate']);
            await page.click(ROW('off'));
            assert.deepEqual(await page.recordedEvents(), []);
            assert.equal(await page.evalFn((s) => window.__h.need(s).disabled, ROW('off')), true);
        }));

        test('[hidden] really hides, with no !important anywhere', () => mounted(async (page) => {
            assert.equal(await page.prop(HOST('gone'), 'display'), 'none');
        }));

        test('hit floor: the row box clears --ui-hit-min on both axes', () => mounted(async (page) => {
            await assertHitFloor(page, ROW('s0'), { mode: 'pad' });
        }));

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: resting ink, cell ground, and both selected colours`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const o = ORACLE[theme];

                assert.equal(await page.prop(ROW('s0'), 'color'), o.ink, 'resting ink is --ui-muted');
                assert.equal(await page.prop(HOST('s0'), 'background-color'), o.ground,
                    'the cell ground is the colour Slate painted on the panel behind the row');
                assert.equal(await page.prop(ROW('s0'), 'background-color'), 'rgba(0, 0, 0, 0)',
                    'the control itself is transparent, exactly as Slate authored it');

                assert.equal(await page.prop(ROW('s1'), 'background-color'), o.selectedFace);
                assert.equal(await page.prop(ROW('s1'), 'color'), o.selectedInk);
            }));

            test(`hover parity in ${theme}: --ui-key face, --ui-text ink, and not on the current row`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const o = ORACLE[theme];

                const b = await page.box(ROW('s2'));
                await page.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await page.settle(1);
                const hovered = await page.computed(ROW('s2'), ['background-color', 'color']);
                assert.equal(hovered['background-color'], o.hoverFace);
                assert.equal(hovered.color, o.hoverInk);

                const s = await page.box(ROW('s1'));
                await page.mouse('mouseMoved', s.left + s.width / 2, s.top + s.height / 2);
                await page.settle(1);
                const stuck = await page.computed(ROW('s1'), ['background-color', 'color']);
                assert.equal(stuck['background-color'], o.selectedFace, 'hover repainted the current row');
                assert.equal(stuck.color, o.selectedInk);
            }));
        }

        test('oracle parity: the theme-invariant values', () => mounted(async (page) => {
            const got = await page.computed(ROW('s0'), [
                'font-size', 'font-weight', 'padding-left', 'padding-right', 'column-gap',
                'letter-spacing', 'text-transform', 'opacity', 'box-shadow', 'text-align',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.equal(got['padding-left'], ORACLE.paddingLeft);
            assert.equal(got['padding-right'], ORACLE.paddingLeft, 'the padding is symmetric, as the shorthand wrote it');
            assert.equal(got['column-gap'], ORACLE.gap);
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['text-align'], 'start', 'a nav row is read left to right; the UA centres button text');
        }));

        test('DEPARTURE 1: the pitch is the token, not Slate\'s 89', () => mounted(async (page) => {
            const h = await navRow(page);
            const box = await page.box(ROW('s0'));
            assert.equal(Math.round(box.height), Math.round(h));
            assert.notEqual(
                Math.round(box.height), ORACLE.bug.height,
                'the row reproduced Slate\'s 89px, which T18 records as a derivation "wrong on '
                + 'both halves" and spec §3.2 resolves to calc(--ui-control-h + 2 × --ui-space-3)',
            );

            acrossGeometries[geometry.name] = {
                navRow: h,
                rowHeight: Math.round(box.height),
                fontSize: await page.prop(ROW('s0'), 'font-size'),
                paddingLeft: await page.prop(ROW('s0'), 'padding-left'),
                density: await page.tokenValue('--ui-density'),
            };
        }));
    });
}

describe('ui-subnav-row across both Gate A geometries', () => {
    test('the paint is identical and only the density band moves the pitch', () => {
        const bench = acrossGeometries.bench;
        const floor = acrossGeometries.floor;
        assert.ok(bench && floor, `both geometry blocks must have run: ${Object.keys(acrossGeometries)}`);

        assert.equal(bench.fontSize, floor.fontSize, 'type size is a fixed token, not a fluid one');
        assert.equal(bench.paddingLeft, floor.paddingLeft);

        assert.equal(bench.rowHeight, 88, 'the bench pitch is spec §3.2\'s 88');
        assert.equal(floor.rowHeight, 77, 'the 1000x600 floor is below 700px of height: 88 x 0.875');
        assert.equal(bench.rowHeight, bench.navRow);
        assert.equal(floor.rowHeight, floor.navRow);
        assert.equal(bench.density.trim(), '1');
        assert.equal(floor.density.trim(), '0.875');
    });
});
