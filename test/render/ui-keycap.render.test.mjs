/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-keycap.js'];

const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
    <ui-keycap id="plain">E</ui-keycap>
    <ui-keycap id="w">W</ui-keycap>
    <ui-keycap id="space">Space</ui-keycap>
    <ui-keycap id="named" label="Backspace">&#9003;</ui-keycap>
    <ui-keycap id="off" disabled>P</ui-keycap>
    <ui-keycap id="gone" hidden>P</ui-keycap>
    <ui-keycap id="focusable" tabindex="0">7</ui-keycap>
</div>
<div id="clipper" style="overflow: hidden; inline-size: 112px; display: flex; gap: 8px">
    <ui-keycap id="inset" tabindex="0" focus-ring="inset">8</ui-keycap>
</div>
<div id="narrow" style="inline-size: 36px">
    <ui-keycap id="cramped">Space</ui-keycap>
</div>
`;

const CAP = (id) => `ui-keycap#${id} >>> #cap`;

const ORACLE = {
    dark: { face: 'rgb(26, 33, 39)', ink: 'rgb(244, 247, 248)', edge: 'rgb(82, 97, 107)' },
    light: { face: 'rgb(248, 249, 249)', ink: 'rgb(23, 26, 28)', edge: 'rgb(170, 178, 183)' },
    fontSize: '17px',
    fontWeight: '500',
    paddingLeft: '8px',
    radius: '6px',
    borderWidth: 1,
    skirt: 3,
    floor: 48,
    spaceWidth: 68,
};

const roundPx = (v) => Math.round(parseFloat(v));

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-keycap @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-keycap must mount without throwing');
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

        test('drill: --ui-hit-min is the floor, on BOTH axes and on the hit box too', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'height',
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'width',
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'height',
                pseudo: '::before',
            });
        }));

        test('drill: --ui-key is the face', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'background-color',
            });
        }));

        test('drill: --ui-text is the ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'color',
            });
        }));

        test('drill: --ui-line-strong is the edge', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line-strong', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'border-top-color',
            });
        }));

        test('drill: --ui-radius is the corner', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-space-2 is the inline padding', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-2', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'padding-left',
            });
        }));

        test('drill: --ui-text-base is the type size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'font-size',
            });
        }));

        test('drill: --ui-weight-medium is the weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-medium', value: '800',
                selector: CAP('plain'), property: 'font-weight',
            });
        }));

        test('drill: --ui-font-family is the family — the ONE family, not a numeric fork', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-font-family', value: 'cursive',
                selector: CAP('plain'), property: 'font-family',
            });
        }));

        test('drill: --ui-hairline reaches the border THROUGH --ui-border-w', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-hairline', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-width',
                expectLanding: false,
            });
            assert.equal(
                roundPx(drill.after), roundPx(DRILL_LENGTH),
                `--ui-hairline drill landed on ${drill.after}, not ${DRILL_LENGTH}. ` +
                '--ui-border-w is declared as var(--ui-hairline) (styles/tokens.css:409); ' +
                'if this fails the border stopped reading the chain.',
            );
        }));

        test('drill: --ui-border-w is the border directly too', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-border-w', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-width',
                expectLanding: false,
            });
            assert.equal(roundPx(drill.after), roundPx(DRILL_LENGTH));
        }));

        test('drill: --ui-opacity-disabled is the one dim dial, applied ONCE', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: 'ui-keycap#off', property: 'opacity',
            });
            const inner = await page.prop(CAP('off'), 'opacity');
            assert.equal(
                inner, '1',
                `double-dim: the face inside a disabled ui-keycap computes opacity ${inner}. ` +
                'Only the host carries [disabled]; the face must be untouched.',
            );
        }));

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: face, ink and edge are exact`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const got = await page.computed(CAP('plain'), [
                    'background-color', 'color', 'border-top-color',
                ]);
                assert.equal(got['background-color'], ORACLE[theme].face);
                assert.equal(got.color, ORACLE[theme].ink);
                assert.equal(got['border-top-color'], ORACLE[theme].edge);
            }));
        }

        test('oracle parity: the theme-invariant fifteen', () => mounted(async (page) => {
            const got = await page.computed(CAP('plain'), [
                'font-size', 'font-weight', 'padding-left', 'border-top-left-radius',
                'box-shadow', 'letter-spacing', 'text-transform', 'opacity', 'min-height',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.equal(got['padding-left'], ORACLE.paddingLeft);
            assert.equal(got['border-top-left-radius'], ORACLE.radius);
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(got['min-height'], 'auto');
        }));

        test('oracle parity: 48×48 for a single glyph, wider for a word', () => mounted(async (page) => {
            const one = await page.box(CAP('plain'));
            assert.equal(Math.round(one.width), ORACLE.floor);
            assert.equal(Math.round(one.height), ORACLE.floor);

            const w = await page.box(CAP('w'));
            assert.equal(Math.round(w.width), ORACLE.floor, 'every one-glyph face is the same width');

            const space = await page.box(CAP('space'));
            assert.ok(
                space.width > ORACLE.floor,
                `the "Space" face is ${space.width}px — min-inline-size floored it instead of ` +
                'letting the word set the width.',
            );
            assert.equal(
                Math.round(space.height), ORACLE.floor,
                'a key that is tall for one binding and short for the next is not a keyboard',
            );

            acrossGeometries[geometry.name] = {
                one: { w: Math.round(one.width), h: Math.round(one.height) },
                space: { h: Math.round(space.height) },
                fontSize: await page.prop(CAP('plain'), 'font-size'),
            };
        }));

        test('the bottom edge is a 3× hairline skirt, derived from the token', () => mounted(async (page) => {
            const rest = await page.computed(CAP('plain'), ['border-top-width', 'border-bottom-width']);
            assert.equal(
                roundPx(rest['border-top-width']), ORACLE.borderWidth,
                '#kb-current-espresso [i=43] border-top-width = 1px',
            );
            assert.equal(
                roundPx(rest['border-bottom-width']), ORACLE.skirt,
                'Slate writes border-bottom-width: 3px Decal ' +
                'derives it as calc(3 * var(--ui-border-w)) and it must still render 3px.',
            );
            assert.ok(
                parseFloat(rest['border-bottom-width']) > parseFloat(rest['border-top-width']),
                'without a heavier bottom edge a keycap is a rectangle, not a key',
            );

            await page.setToken('--ui-hairline', '10px');
            const drilled = await page.computed(CAP('plain'), ['border-top-width', 'border-bottom-width']);
            await page.setToken('--ui-hairline', null);
            assert.equal(roundPx(drilled['border-top-width']), 10);
            assert.equal(
                roundPx(drilled['border-bottom-width']), 30,
                `the skirt is not 3× the hairline: 10px hairline gave ${drilled['border-bottom-width']}.`,
            );

            const restored = await page.prop(CAP('plain'), 'border-bottom-width');
            assert.equal(roundPx(restored), ORACLE.skirt, 'the drill did not restore');
        }));

        test('focus: the ONE ring, outset, unclipped', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, 'ui-keycap#focusable');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(
                g.outlineOffset, outset,
                'an unclipped keycap uses the OUTSET offset; the inset one is for clipping parents',
            );
        }));

        test('focus: inside an overflow:hidden band, focus-ring="inset" is not clipped — L24 dead', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, 'ui-keycap#inset');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(
                g.outlineOffset, inset,
                'the inset variant must use --ui-focus-offset-inset, or the ring is drawn ' +
                'outside a box that clips it — which is L24 rebuilt.',
            );
            assert.ok(g.clippers.length > 0, 'the clipping ancestor is missing: the test is vacuous');
        }));

        test('focus: an unrecognised focus-ring value falls back to a ring, never to none', () => mounted(async (page) => {
            await page.evalFn((s) => (window.__h.need(s).setAttribute('focus-ring', 'sideways'), true), 'ui-keycap#focusable');
            await page.settle(1);
            const g = await assertFocusUnclipped(page, 'ui-keycap#focusable');
            assert.notEqual(g.outlineStyle, 'none', 'an invisible ring is an a11y defect; a wrong offset is cosmetic');
        }));

        test('hit floor: 48px on both axes through the ONE shared utility', () => mounted(async (page) => {
            const got = await assertHitFloor(page, CAP('plain'), { mode: 'overlay' });
            assert.equal(got.floor, ORACLE.floor);
            await assertHitFloor(page, CAP('plain'), { mode: 'box' });
        }));

        test('hit floor: squeezing the ink to 32×35 does not shrink the hit box — L22 dead', () => mounted(async (page) => {
            const before = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            assert.equal(Math.round(parseFloat(before.width)), ORACLE.floor);

            await page.setStyle(CAP('plain'), {
                'min-inline-size': '32px',
                'inline-size': '32px',
                'block-size': '35px',
            });
            const ink = await page.box(CAP('plain'));
            const hit = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            await page.setStyle(CAP('plain'), {
                'min-inline-size': null, 'inline-size': null, 'block-size': null,
            });

            assert.equal(Math.round(ink.width), 32, 'the squeeze did not take — the test would be vacuous');
            assert.equal(Math.round(ink.height), 35);
            assert.ok(
                parseFloat(hit.width) >= ORACLE.floor - 0.5,
                `L22: ink squeezed to 32px and the hit box followed it to ${hit.width}. ` +
                'The shared utility must hold --ui-hit-min on the inline axis regardless of ink.',
            );
            assert.ok(
                parseFloat(hit.height) >= ORACLE.floor - 0.5,
                `L22: ink squeezed to 35px and the hit box followed it to ${hit.height}.`,
            );

            const after = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            assert.equal(Math.round(parseFloat(after.height)), ORACLE.floor, 'the squeeze did not restore');
        }));

        test('the host opts OUT of container hosting, because it must fit its glyph', () => mounted(async (page) => {
            const ct = await page.prop('ui-keycap#space', 'container-type');
            assert.equal(
                ct, 'normal',
                'the base sets container-type: inline-size on every :host; a keycap must ' +
                'override it, and the override only works because base rules come FIRST ' +
                '(CONVENTIONS §1 — do not let the base styles land last).',
            );
            assert.equal(await page.prop('ui-keycap#cramped', 'display'), 'inline-grid');
            assert.equal(await page.prop('ui-keycap#space', 'display'), 'grid');
        }));

        test('a container narrower than the floor does not shrink the face', () => mounted(async (page) => {
            const cramped = await page.box(CAP('cramped'));
            assert.ok(
                cramped.width >= ORACLE.floor - 0.5,
                `the face shrank to ${cramped.width}px inside a 36px container. ` +
                'Overflowing is the intended behaviour; shrinking a touch target is not.',
            );
            assert.equal(Math.round(cramped.height), ORACLE.floor);

            // …and it stays one line while doing it.
            const glyph = await page.box(`ui-keycap#cramped >>> #glyph`);
            assert.ok(
                glyph.height <= ORACLE.floor,
                `the label wrapped: the glyph box is ${glyph.height}px tall inside a 48px face.`,
            );
        }));

        test('shrinking the container moves nothing at all', () => mounted(async (page) => {
            const before = await page.box(CAP('plain'));
            await page.setStyle('#row', { 'inline-size': '90px' });
            const during = await page.box(CAP('plain'));
            await page.setStyle('#row', { 'inline-size': null });
            assert.equal(Math.round(during.width), Math.round(before.width));
            assert.equal(Math.round(during.height), Math.round(before.height));
        }));

        test('no selection treatment: all six spellings leave the paint alone', () => mounted(async (page) => {
            const rest = await page.computed(CAP('plain'), ['background-color', 'color', 'box-shadow']);
            const spellings = [
                ['aria-pressed', 'true'], ['aria-selected', 'true'], ['aria-checked', 'true'],
                ['aria-current', 'true'], ['selected', ''],
            ];
            for (const [name, value] of spellings) {
                await page.evalFn(
                    (s, n, v) => (window.__h.need(s).setAttribute(n, v), true),
                    'ui-keycap#plain', name, value,
                );
            }
            await page.evalFn((s) => (window.__h.need(s).classList.add('is-selected'), true), CAP('plain'));
            await page.settle(1);

            const after = await page.computed(CAP('plain'), ['background-color', 'color', 'box-shadow']);
            assert.deepEqual(
                after, rest,
                'ui-keycap painted a selection state. It is not a selection surface: ' +
                'selectionSurface is deliberately not imported (CONVENTIONS §4).',
            );
        }));

        test('an !important universal rule in the document cannot repaint the face', () => mounted(async (page) => {
            const before = await page.computed(CAP('plain'), ['font-family', 'background-color']);
            await page.evalFn((css) => {
                const s = document.createElement('style');
                s.id = 'reach-in';
                s.textContent = css;
                document.head.appendChild(s);
                return true;
            }, '* , ui-keycap, ui-keycap * { font-family: cursive !important; background-color: rgb(255, 0, 170) !important; }');
            await page.settle(1);
            const after = await page.computed(CAP('plain'), ['font-family', 'background-color']);
            await page.evalFn(() => (document.getElementById('reach-in')?.remove(), true));

            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root. Everything this ' +
                'architecture rests on is that it cannot.',
            );
        }));

        test('label exposes a name and hides the glyph; no label leaves the text alone', () => mounted(async (page) => {
            const named = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const r = el.shadowRoot;
                return {
                    hidden: r.getElementById('glyph').getAttribute('aria-hidden'),
                    name: r.getElementById('a11y')?.textContent ?? null,
                };
            }, 'ui-keycap#named');
            assert.equal(named.hidden, 'true', 'the glyph must leave the accessibility tree when named');
            assert.equal(named.name, 'Backspace');

            // Visually hidden, still in the tree — 1×1, clipped, not display:none.
            const box = await page.box('ui-keycap#named >>> #a11y');
            assert.ok(box.width <= 2 && box.height <= 2, `the a11y text is ${box.width}×${box.height}, i.e. visible`);
            assert.equal(await page.prop('ui-keycap#named >>> #a11y', 'display'), 'block');

            const plain = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('glyph').getAttribute('aria-hidden'),
                    a11y: r.getElementById('a11y') !== null,
                };
            }, 'ui-keycap#plain');
            assert.equal(plain.hidden, null, 'an unlabelled keycap must NOT hide its own text');
            assert.equal(plain.a11y, false);
        }));

        test('the element is a kbd, and the kbd is the paint surface', () => mounted(async (page) => {
            const tag = await page.evalFn(
                (s) => window.__h.need(s).shadowRoot.getElementById('cap').tagName,
                'ui-keycap#plain',
            );
            assert.equal(tag, 'KBD');
        }));

        test('[hidden] really hides, even though :host declares display', () => mounted(async (page) => {
            assert.equal(await page.prop('ui-keycap#gone', 'display'), 'none');
            assert.equal(await page.prop('ui-keycap#plain', 'display'), 'grid');
            assert.equal(await page.prop('ui-keycap#cramped', 'display'), 'inline-grid');
        }));
    });
}

describe('ui-keycap across both geometries', () => {
    test('the face is identical at 1281×801 @ dsf 1.5 and at the 1000×600 floor', () => {
        assert.deepEqual(
            acrossGeometries.bench, acrossGeometries.floor,
            `bench ${JSON.stringify(acrossGeometries.bench)} vs floor ${JSON.stringify(acrossGeometries.floor)}`,
        );
        assert.equal(acrossGeometries.bench.one.w, 48);
        assert.equal(acrossGeometries.bench.one.h, 48);
    });
});
