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
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-favourite-slot.js'];

const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
    <ui-favourite-slot id="empty" index="4"></ui-favourite-slot>
    <ui-favourite-slot id="fill" index="1" filled label="Cremina"></ui-favourite-slot>
    <ui-favourite-slot id="pick" index="2" filled selected label="Londinium"></ui-favourite-slot>
    <ui-favourite-slot id="bare" index="3" selected></ui-favourite-slot>
    <ui-favourite-slot id="off" index="5" disabled></ui-favourite-slot>
    <ui-favourite-slot id="gone" index="5" hidden></ui-favourite-slot>
    <ui-favourite-slot id="mark" index="1">C</ui-favourite-slot>
</div>
<div id="bank" style="display: flex; gap: 8px; align-items: center">
    <ui-favourite-slot id="b1" index="1" filled></ui-favourite-slot>
    <ui-favourite-slot id="b2" index="2" filled></ui-favourite-slot>
    <ui-favourite-slot id="b3" index="3" filled></ui-favourite-slot>
    <ui-favourite-slot id="b4" index="4"></ui-favourite-slot>
    <ui-favourite-slot id="b5" index="5"></ui-favourite-slot>
</div>
<div id="clipper" style="overflow: hidden; inline-size: 112px; display: flex; gap: 8px">
    <ui-favourite-slot id="inset" index="1" focus-ring="inset"></ui-favourite-slot>
</div>
<div id="narrow" style="inline-size: 36px">
    <ui-favourite-slot id="cramped" index="1"></ui-favourite-slot>
</div>
<div id="dense" style="--_ui-fav-slot-size: 32px; padding: 8px">
    <ui-favourite-slot id="small" index="1"></ui-favourite-slot>
</div>
`;

const HOST = (id) => `ui-favourite-slot#${id}`;
const SLOT = (id) => `ui-favourite-slot#${id} >>> #slot`;

const ORACLE = {
    dark: {
        empty: { face: 'rgba(0, 0, 0, 0)', ink: 'rgb(148, 161, 169)', edge: 'rgb(82, 97, 107)' },
        filled: { face: 'rgb(23, 59, 77)', ink: 'rgb(246, 251, 253)', edge: 'color(srgb 0.258196 0.381804 0.443608)' },
    },
    light: {
        empty: { face: 'rgba(0, 0, 0, 0)', ink: 'rgb(90, 101, 108)', edge: 'rgb(170, 178, 183)' },
        filled: { face: 'rgb(35, 79, 99)', ink: 'rgb(248, 252, 253)', edge: 'color(srgb 0.152627 0.324078 0.40251)' },
    },
    fontSize: '17px',
    fontWeight: '500',
    floor: 48,
    slateBox: 64,
};

const roundPx = (v) => Math.round(parseFloat(v));

function srgb(value) {
    const nums = String(value).match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number) ?? [];
    if (/^color\(/.test(String(value))) return nums.slice(0, 3);
    return nums.slice(0, 3).map((n) => n / 255);
}

function assertColourEqual(got, want, message) {
    const a = srgb(got);
    const b = srgb(want);
    assert.equal(a.length, 3, `${message}\n  unreadable colour: ${got}`);
    const off = a.map((n, i) => Math.abs(n - b[i]));
    assert.ok(
        off.every((d) => d < 0.003),
        `${message}\n  expected ${want}\n  computed ${got}\n  channel deltas ${off.map((d) => d.toFixed(5)).join(', ')}`,
    );
}

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-favourite-slot @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-favourite-slot must mount without throwing');
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

        test('drill: --ui-hit-min IS the box, and the hit overlay with it — P4 (a)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                read: async (p) => Math.round((await p.box(SLOT('empty'))).width),
                expected: parseFloat(DRILL_LENGTH),
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                read: async (p) => Math.round((await p.box(SLOT('empty'))).height),
                expected: parseFloat(DRILL_LENGTH),
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: SLOT('empty'),
                property: 'width',
                pseudo: '::before',
                expected: DRILL_LENGTH,
            });
        }));

        test('drill: the empty disc reads --ui-muted and --ui-line-strong', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted', selector: SLOT('empty'), property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong', selector: SLOT('empty'), property: 'border-top-color',
            });
        }));

        test('drill: the filled disc reads --ui-primary and --ui-on-primary', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-primary', selector: SLOT('fill'), property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-on-primary', selector: SLOT('fill'), property: 'color',
            });
            const edge = await page.prop(SLOT('fill'), 'border-top-color');
            await page.setToken('--ui-steel', DRILL_COLOUR);
            const mixed = await page.prop(SLOT('fill'), 'border-top-color');
            await page.setToken('--ui-steel', null);
            assert.notEqual(
                mixed, edge,
                'the filled rim is color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel)); ' +
                'moving --ui-steel must move it, or the mix has been flattened to a literal.',
            );
        }));

        test('drill: type is --ui-text-base / --ui-weight-medium, radius is --ui-radius-pill', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: SLOT('empty'), property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-medium', value: '800',
                selector: SLOT('empty'), property: 'font-weight',
            });
            await assertTokenDrill(page, {
                token: '--ui-radius-pill', value: DRILL_LENGTH,
                selector: SLOT('empty'), property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-opacity-disabled dims the host, exactly once', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: HOST('off'), property: 'opacity',
            });
            const inner = await page.prop(SLOT('off'), 'opacity');
            assert.equal(inner, '1', `double-dim: the disc inside a disabled slot computes opacity ${inner}`);
        }));

        test('the four dials are the whole of the selected state', () => mounted(async (page) => {
            await assertOneSelectionTreatment(page, {
                selected: SLOT('pick'),
                unselected: SLOT('fill'),
            });
        }));

        test('occupancy is NOT selection: --ui-primary and --ui-selected-face stay apart', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            const primary = await page.resolveToken('--ui-primary', 'background-color');
            assert.notEqual(
                primary, face,
                'a filled slot and a selected slot would be the same block of colour, which is ' +
                'how "the favourites bank bypasses the dials" (L8) looks from the outside.',
            );

            const filled = await page.prop(SLOT('fill'), 'background-color');
            assert.equal(filled, primary, 'a filled, unselected slot paints --ui-primary');

            const both = await page.prop(SLOT('pick'), 'background-color');
            assert.equal(
                both, face,
                'a filled AND selected slot must paint --ui-selected-face. Getting --ui-primary ' +
                'here means the occupancy rule out-specifies selectionSurface (0,1,0).',
            );

            assert.equal(await page.prop(SLOT('bare'), 'background-color'), face);
        }));

        test('nothing but the four dial properties differs between selected and unselected', () => mounted(async (page) => {
            const props = [
                'border-top-color', 'border-top-width', 'border-top-left-radius',
                'border-bottom-right-radius', 'font-size', 'font-weight', 'font-family',
                'letter-spacing', 'text-transform', 'opacity', 'width', 'height',
                'padding-left', 'padding-top', 'cursor', 'outline-style', 'outline-width',
                'display', 'text-align',
            ];
            const selected = await page.computed(SLOT('pick'), props);
            const unselected = await page.computed(SLOT('fill'), props);
            assert.deepEqual(
                selected, unselected,
                'a property outside the four dials changes with the selection state.',
            );
        }));

        test('the dials retarget without a rule change — Radian on Slate rules', () => mounted(async (page) => {
            await page.setToken('--ui-selected-led', '4px');
            await page.setToken('--ui-selected-glow', '55%');
            const led = await page.prop(SLOT('pick'), 'box-shadow');
            const glow = await page.prop(SLOT('pick'), 'text-shadow');
            await page.setToken('--ui-selected-led', null);
            await page.setToken('--ui-selected-glow', null);

            assert.match(led, /inset/, `the LED strip did not appear at 4px: ${led}`);
            assert.match(led, /-4px/, `the LED strip is not the dial's length: ${led}`);
            assert.ok(
                !/rgba\([^)]*,\s*0\)\s*$/.test(glow.trim()),
                `the glow stayed fully transparent at 55%: ${glow}`,
            );
        }));

        test('the ring is --ui-focus-*, unclipped, in both offsets', () => mounted(async (page) => {
            await assertFocusUnclipped(page, SLOT('empty'));
            await assertFocusUnclipped(page, SLOT('inset'));
        }));

        test('a selected disc still shows the one ring', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, SLOT('pick'));
            assert.equal(g.outlineColor, await page.resolveValue('var(--ui-steel)', 'outline-color'));
        }));

        test('the hit box reaches --ui-hit-min on both axes', () => mounted(async (page) => {
            const got = await assertHitFloor(page, SLOT('empty'));
            assert.equal(got.floor, ORACLE.floor);
            assert.ok(got.inline >= ORACLE.floor - 0.5 && got.block >= ORACLE.floor - 0.5);
        }));

        test('ink is separate from the hit floor: a 32px disc still presses 48px', () => mounted(async (page) => {
            const ink = await page.box(SLOT('small'));
            assert.equal(Math.round(ink.width), 32, 'the ink did not follow --_ui-fav-slot-size');
            assert.equal(Math.round(ink.height), 32);

            const hit = await assertHitFloor(page, SLOT('small'));
            assert.ok(
                hit.inline >= ORACLE.floor - 0.5 && hit.block >= ORACLE.floor - 0.5,
                `a 32px disc must still accept a 48px press; measured ${hit.inline}×${hit.block}`,
            );

            // The paint did not move with the hit box: that is the whole separation.
            assert.equal(
                await page.prop(SLOT('small'), 'background-color'),
                await page.prop(SLOT('empty'), 'background-color'),
            );
        }));

        test('P4 (a): the disc is --ui-hit-min and declares no min-* clamp', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box(SLOT('empty'));
            assert.equal(Math.round(box.width), floor);
            assert.equal(Math.round(box.height), floor);
            assert.notEqual(
                Math.round(box.width), ORACLE.slateBox,
                'the disc measures Slate\'s 64 — the disqualified geometry has been copied.',
            );

            const clamps = await page.computed(SLOT('empty'), ['min-width', 'min-height']);
            assert.deepEqual(clamps, { 'min-width': 'auto', 'min-height': 'auto' });
        }));

        test('P4 (b): the second rule cannot reach in, even with !important', () => mounted(async (page) => {
            const before = await page.box(SLOT('empty'));
            await page.evalFn((rules) => {
                const s = document.createElement('style');
                s.id = 'p4-reach-in';
                s.textContent = rules;
                document.head.appendChild(s);
                return true;
            }, '*, ui-favourite-slot, ui-favourite-slot * {'
             + ' width: 64px !important; min-width: 64px !important;'
             + ' height: 64px !important; min-height: 64px !important; }');
            await page.settle(1);
            const after = await page.box(SLOT('empty'));
            await page.evalFn(() => (document.getElementById('p4-reach-in')?.remove(), true));

            assert.equal(
                Math.round(after.width), Math.round(before.width),
                'P4\'s own rule shape, injected from the document, resized the disc. The whole ' +
                'remedy is that geometry has one owner and nothing outside can add a second.',
            );
            assert.equal(Math.round(after.height), Math.round(before.height));
        }));

        test('P4 (c): a row of five slots is 48 tall, not 64', () => mounted(async (page) => {
            const bank = await page.box('#bank');
            assert.equal(
                Math.round(bank.height), ORACLE.floor,
                `five slots make a ${Math.round(bank.height)}px row; Slate's is 113 because the ` +
                'slots are 64x64, not 48 (spec §4.2, "Measured today").',
            );
            const first = await page.box(SLOT('b1'));
            const last = await page.box(SLOT('b5'));
            assert.equal(Math.round(first.height), ORACLE.floor);
            assert.equal(Math.round(last.height), ORACLE.floor);
            // Filled and empty are the same box — occupancy is paint, never geometry.
            assert.equal(Math.round(first.width), Math.round(last.width));

            acrossGeometries[geometry.name] = {
                disc: { w: Math.round(first.width), h: Math.round(first.height) },
                row: Math.round(bank.height),
                fontSize: await page.prop(SLOT('b1'), 'font-size'),
                hit: (await assertHitFloor(page, SLOT('b1'))).block,
            };
        }));

        test('in a 36px container the disc overflows rather than shrinking', () => mounted(async (page) => {
            const box = await page.box(SLOT('cramped'));
            assert.equal(Math.round(box.width), ORACLE.floor);
            assert.equal(Math.round(box.height), ORACLE.floor);
            const host = await page.box(HOST('cramped'));
            assert.ok(
                host.width >= ORACLE.floor - 0.5,
                `the host shrank to ${host.width}px — the container-hosting opt-out is gone and ` +
                'inline-size containment has frozen the disc at its parent\'s width.',
            );
        }));

        test('no @container/@media dependence: the disc is identical in every container', () => mounted(async (page) => {
            const wide = await page.box(SLOT('empty'));
            await page.setStyle('#row', { 'inline-size': '200px' });
            const narrow = await page.box(SLOT('empty'));
            await page.setStyle('#row', { 'inline-size': null });
            assert.equal(Math.round(narrow.width), Math.round(wide.width));
            assert.equal(Math.round(narrow.height), Math.round(wide.height));
        }));

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: empty and filled, face ink and edge`, () => mounted(async (page) => {
                await page.setTheme(theme);

                const empty = await page.computed(SLOT('empty'), ['background-color', 'color', 'border-top-color']);
                assert.equal(empty['background-color'], ORACLE[theme].empty.face);
                assertColourEqual(empty.color, ORACLE[theme].empty.ink, 'empty slot ink');
                assertColourEqual(empty['border-top-color'], ORACLE[theme].empty.edge, 'empty slot edge');

                const filled = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
                assertColourEqual(filled['background-color'], ORACLE[theme].filled.face, 'filled slot face');
                assertColourEqual(filled.color, ORACLE[theme].filled.ink, 'filled slot ink');
                // The 72%/steel mix, reproduced to the measurement's six decimals.
                assertColourEqual(filled['border-top-color'], ORACLE[theme].filled.edge, 'filled slot rim');
            }));
        }

        test('oracle parity: the theme-invariant properties', () => mounted(async (page) => {
            const got = await page.computed(SLOT('empty'), [
                'font-size', 'font-weight', 'font-family', 'box-shadow',
                'letter-spacing', 'text-transform', 'opacity', 'border-top-width',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.match(got['font-family'], /Geist/);
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(roundPx(got['border-top-width']), 1, 'the rim is one --ui-border-w hairline');
        }));

        test('the disc is round, from --ui-radius-pill', () => mounted(async (page) => {
            const r = await page.prop(SLOT('empty'), 'border-top-left-radius');
            assert.ok(
                parseFloat(r) >= ORACLE.floor / 2,
                `the radius is ${r}; a disc needs at least half the box (${ORACLE.floor / 2}px).`,
            );
            await page.setStyle(HOST('empty'), { '--_ui-fav-slot-radius': '6px' });
            const square = await page.prop(SLOT('empty'), 'border-top-left-radius');
            await page.setStyle(HOST('empty'), { '--_ui-fav-slot-radius': null });
            assert.equal(square, '6px', 'the radius knob is not wired — the square is not one property away');
        }));

        test('selection is the aria state, on the control the eye sees', () => mounted(async (page) => {
            const read = (id) => page.evalFn((s) => {
                const el = window.__h.need(s);
                const btn = el.shadowRoot.getElementById('slot');
                return {
                    pressed: btn.getAttribute('aria-pressed'),
                    hostAttr: el.hasAttribute('selected'),
                    tag: btn.tagName,
                };
            }, HOST(id));

            assert.deepEqual(await read('pick'), { pressed: 'true', hostAttr: true, tag: 'BUTTON' });
            assert.deepEqual(await read('fill'), { pressed: 'false', hostAttr: false, tag: 'BUTTON' });

            await page.evalFn((s) => (window.__h.need(s).selected = true, true), HOST('fill'));
            await page.settle(1);
            const after = await read('fill');
            assert.equal(after.pressed, 'true');
            assert.equal(after.hostAttr, true, 'the property is reflected, so a bank can select by attribute');
            assert.equal(
                await page.prop(SLOT('fill'), 'background-color'),
                await page.resolveToken('--ui-selected-face', 'background-color'),
            );
        }));

        test('a consumer may spell selection on the host and still get the one treatment', () => mounted(async (page) => {
            await page.setStyle(HOST('empty'), {});
            await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('empty'));
            await page.settle(1);
            const host = await page.prop(HOST('empty'), 'background-color');
            const radius = await page.prop(HOST('empty'), 'border-top-left-radius');
            await page.evalFn((s) => (window.__h.need(s).removeAttribute('aria-selected'), true), HOST('empty'));
            assert.equal(host, await page.resolveToken('--ui-selected-face', 'background-color'));
            assert.ok(
                parseFloat(radius) >= ORACLE.floor / 2,
                `the host paints a square (${radius}) behind a round disc.`,
            );
        }));

        test('…and the DISC gets out of the way of it — both spellings paint the same slot',
            () => mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                const ink = await page.resolveToken('--ui-selected-ink', 'color');
                const primary = await page.resolveToken('--ui-primary', 'background-color');

                const painted = (id) => page.evalFn((s) => {
                    const el = window.__h.need(s);
                    const stack = [el.shadowRoot.getElementById('slot'), el];
                    for (const node of stack) {
                        const bg = getComputedStyle(node).backgroundColor;
                        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
                    }
                    return 'rgba(0, 0, 0, 0)';
                }, HOST(id));

                for (const spelling of ['aria-selected', 'aria-checked', 'aria-current', 'aria-pressed']) {
                    await page.evalFn(
                        (s, a) => (window.__h.need(s).setAttribute(a, 'true'), true),
                        HOST('fill'), spelling,
                    );
                    await page.settle(1);

                    assert.equal(await painted('fill'), face,
                        `[${spelling}] on the host leaves the slot painted ${await painted('fill')} — `
                        + `--ui-primary is ${primary} and --ui-selected-face is ${face}; dial 1 is hidden`);
                    assert.notEqual(await page.prop(SLOT('fill'), 'background-color'), primary,
                        `[${spelling}] the disc keeps its occupancy fill ON TOP of the selected face`);
                    assert.equal(await page.prop(SLOT('fill'), 'color'), ink,
                        `[${spelling}] the disc keeps its own ink over the selected face — dial 2 is dead`);

                    await page.evalFn(
                        (s, a) => (window.__h.need(s).removeAttribute(a), true),
                        HOST('fill'), spelling,
                    );
                    await page.settle(1);
                    assert.equal(await painted('fill'), primary,
                        `[${spelling}] removing it must restore the occupancy fill exactly`);
                    assert.equal(await page.prop(SLOT('fill'), 'color'),
                        await page.resolveToken('--ui-on-primary', 'color'));
                }

                await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('fill'));
                await page.settle(1);
                assert.equal(await painted('fill'), await painted('pick'),
                    'the host spelling and the property spelling must render one face');
                assert.equal(await page.prop(SLOT('fill'), 'color'), await page.prop(SLOT('pick'), 'color'),
                    'and one ink');

                assert.equal(await page.prop(SLOT('fill'), 'background-color'), 'rgba(0, 0, 0, 0)',
                    'the disc must let the ONE painted surface through, LED included');
                const led = await assertTokenDrill(page, {
                    token: '--ui-selected-led',
                    value: DRILL_LENGTH,
                    selector: HOST('fill'),
                    property: 'box-shadow',
                    expectLanding: false,
                });
                assert.match(led.after, /inset/,
                    'moving --ui-selected-led must move a real inset strip on the painted surface');
                assert.notEqual(led.before, led.after, 'the LED dial is inert on the host spelling');
            }));

        test('DEPARTURE 6: selection replaces the occupancy FILL and keeps the occupancy RIM',
            () => mounted(async (page) => {
                const edge = await page.prop(SLOT('fill'), 'border-top-color');
                await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('fill'));
                await page.settle(1);
                assert.equal(await page.prop(SLOT('fill'), 'border-top-color'), edge,
                    'the host spelling repainted the rim — border-color is not a fifth dial');
                assert.equal(await page.prop(SLOT('pick'), 'border-top-color'), edge,
                    'and neither did the property spelling');
            }));

        test('label names the disc; without one the mark is the name', () => mounted(async (page) => {
            const named = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('mark').getAttribute('aria-hidden'),
                    name: r.getElementById('a11y')?.textContent ?? null,
                };
            }, HOST('fill'));
            assert.equal(named.hidden, 'true', 'the numeral must leave the accessibility tree when named');
            assert.equal(named.name, 'Cremina');

            const box = await page.box(`${HOST('fill')} >>> #a11y`);
            assert.ok(box.width <= 2 && box.height <= 2, `the a11y text is ${box.width}×${box.height}, i.e. visible`);

            const plain = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('mark').getAttribute('aria-hidden'),
                    a11y: r.getElementById('a11y') === null,
                    text: r.getElementById('slot').textContent.trim(),
                };
            }, HOST('empty'));
            assert.equal(plain.hidden, null, 'an unnamed disc must keep its numeral in the tree');
            assert.equal(plain.a11y, true);
            assert.equal(plain.text, '4', 'index is the fallback content of the mark slot');
        }));

        test('slotted content wins over index, and the disc keeps its box', () => mounted(async (page) => {
            const marked = await page.evalFn((s) => {
                const slotEl = window.__h.need(s).shadowRoot.querySelector('slot');
                const shown = slotEl.assignedNodes({ flatten: true });
                return {
                    assigned: slotEl.assignedNodes().length,
                    text: shown.map((x) => x.textContent).join('').trim(),
                };
            }, HOST('mark'));
            assert.deepEqual(marked, { assigned: 1, text: 'C' }, 'the slotted mark must replace the index fallback');

            const plain = await page.evalFn((s) => {
                const slotEl = window.__h.need(s).shadowRoot.querySelector('slot');
                const shown = slotEl.assignedNodes({ flatten: true });
                return {
                    assigned: slotEl.assignedNodes().length,
                    text: shown.map((x) => x.textContent).join('').trim(),
                };
            }, HOST('empty'));
            assert.deepEqual(plain, { assigned: 0, text: '4' }, 'index is the fallback content');

            const box = await page.box(SLOT('mark'));
            assert.equal(Math.round(box.width), ORACLE.floor);
        }));

        test('the press: click composes out of the shadow root, and disabled refuses it', () => mounted(async (page) => {
            const arm = (id) => page.evalFn((s) => {
                const el = window.__h.need(s);
                el.__clicks = 0;
                el.addEventListener('click', () => { el.__clicks += 1; });
                return true;
            }, HOST(id));
            const count = (id) => page.evalFn((s) => window.__h.need(s).__clicks, HOST(id));

            await arm('empty');
            await page.click(SLOT('empty'));
            assert.equal(await count('empty'), 1, 'the native button\'s click must retarget to the host');

            await arm('off');
            await page.click(SLOT('off'));
            assert.equal(
                await count('off'), 0,
                'a disabled slot fired a click. The host attribute dims; the NATIVE attribute on the ' +
                'real button is what refuses (CONVENTIONS §4).',
            );
            const nativelyDisabled = await page.evalFn((s) => window.__h.need(s).shadowRoot
                .getElementById('slot').disabled, HOST('off'));
            assert.equal(nativelyDisabled, true);
        }));

        test('[hidden] really hides, with no !important', () => mounted(async (page) => {
            assert.equal(await page.prop(HOST('gone'), 'display'), 'none');
            assert.equal(await page.prop(HOST('cramped'), 'display'), 'inline-grid');
            assert.equal(await page.prop(HOST('empty'), 'display'), 'grid');
        }));

        test('a document rule cannot repaint the disc', () => mounted(async (page) => {
            const before = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
            await page.evalFn((rules) => {
                const s = document.createElement('style');
                s.id = 'repaint-reach-in';
                s.textContent = rules;
                document.head.appendChild(s);
                return true;
            }, '*, ui-favourite-slot, ui-favourite-slot * { background-color: rgb(255, 0, 170) !important;'
             + ' color: rgb(255, 0, 170) !important; border-color: rgb(255, 0, 170) !important; }');
            await page.settle(1);
            const after = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
            await page.evalFn(() => (document.getElementById('repaint-reach-in')?.remove(), true));
            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root — the paint half of P4 (two rules, ' +
                'one element) is back.',
            );
        }));
    });
}

describe('ui-favourite-slot gallery entry', () => {
    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-favourite-slot.entry.js');

        assert.equal(entry.id, 'ui-favourite-slot', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-favourite-slot.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const els = [...document.querySelectorAll('ui-favourite-slot')]
                        .filter((el) => !el.hasAttribute('hidden'));
                    if (!els.length) return null;
                    return els.map((el) => {
                        const disc = el.shadowRoot && el.shadowRoot.getElementById('slot');
                        if (!disc) return null;
                        const r = disc.getBoundingClientRect();
                        return { w: Math.round(r.width), h: Math.round(r.height) };
                    });
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no slot at all`);
                for (const box of painted) {
                    assert.ok(box && box.w > 0 && box.h > 0,
                        `${entry.id}--${state.id} rendered a ${JSON.stringify(box)} box`);
                    assert.equal(box.w, box.h,
                        `${entry.id}--${state.id} rendered a ${box.w}×${box.h} slot — it is a square shortcut`);
                }
            }
        });
    });
});

describe('ui-favourite-slot across both geometries', () => {
    test('the disc is the same physical size at the bench and at the floor', () => {
        assert.deepEqual(
            acrossGeometries.bench, acrossGeometries.floor,
            `bench ${JSON.stringify(acrossGeometries.bench)} vs floor ${JSON.stringify(acrossGeometries.floor)}`,
        );
        assert.equal(acrossGeometries.bench.disc.w, 48);
        assert.equal(acrossGeometries.bench.disc.h, 48);
        assert.equal(acrossGeometries.bench.row, 48);
        assert.ok(acrossGeometries.bench.hit >= 48);
    });
});
