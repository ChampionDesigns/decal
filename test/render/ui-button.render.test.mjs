/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-button.js'];

const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap">
    <ui-button id="default">Cancel</ui-button>
    <ui-button id="primary" variant="primary">Confirm</ui-button>
    <ui-button id="ghost" variant="ghost">Descaling instructions</ui-button>
    <ui-button id="danger" variant="danger">Delete</ui-button>
    <ui-button id="tall" tall>Close</ui-button>
    <ui-button id="tall-primary" tall variant="primary">Save</ui-button>
    <ui-button id="off" disabled>Start over</ui-button>
    <ui-button id="off-primary" disabled variant="primary">Zero</ui-button>
    <ui-button id="bogus" variant="Nope">Fallback</ui-button>
    <ui-button id="labelled" label="Close">&#10005;</ui-button>
</div>
<div id="narrow" style="inline-size: 900px; padding: 24px">
    <ui-button id="wide" variant="primary">Load factory calibration settings</ui-button>
</div>
<div id="band" style="overflow: hidden; inline-size: 300px; display: flex">
    <ui-button id="clipped" focus-ring="inset">Inset ring</ui-button>
</div>
`;

const ORACLE = {
    dark: { ink: 'rgb(186, 196, 202)', primaryFace: 'rgb(23, 59, 77)', primaryInk: 'rgb(246, 251, 253)', dangerInk: 'rgb(230, 102, 97)' },
    light: { ink: 'rgb(63, 71, 76)', primaryFace: 'rgb(35, 79, 99)', primaryInk: 'rgb(248, 252, 253)', dangerInk: 'rgb(181, 28, 35)' },
    transparent: 'rgba(0, 0, 0, 0)',
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-button @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-button must mount without throwing');
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

        test('drill: --ui-control-h is the resting height floor', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '90px',
                selector: '#default >>> button',
                property: 'min-block-size',
            });
            const box = await page.box('#default >>> button');
            assert.equal(box.height, 64, 'the resting height is --ui-control-h itself');
        }));

        test('drill: --ui-control-lg is the TALL height floor, and only the tall one', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-lg',
                value: '90px',
                selector: '#tall >>> button',
                property: 'min-block-size',
            });
            assert.equal((await page.box('#tall >>> button')).height, 82);
            assert.equal((await page.box('#default >>> button')).height, 64,
                'tall must be orthogonal: the plain button does not move');
        }));

        test('drill: --ui-primary is the primary FILL', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-primary',
                value: DRILL_COLOUR,
                selector: '#primary >>> button',
                property: 'background-color',
            });
        }));

        test('drill: --ui-on-primary is the primary INK', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-on-primary',
                value: DRILL_COLOUR,
                selector: '#primary >>> button',
                property: 'color',
            });
        }));

        test('drill: --ui-status-danger is the danger ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: '#danger >>> button',
                property: 'color',
            });
        }));

        test('drill: --ui-text-2 is the default ink and --ui-line the default edge', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-2',
                value: DRILL_COLOUR,
                selector: '#default >>> button',
                property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#default >>> button',
                property: 'border-top-color',
            });
        }));

        test('drill: --ui-radius, --ui-space-5, --ui-text-base, --ui-weight-medium', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '30px',
                selector: '#default >>> button',
                property: 'border-top-left-radius',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '36px',
                selector: '#default >>> button',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-base',
                value: '31px',
                selector: '#default >>> button',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '800',
                selector: '#default >>> button',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-opacity-disabled, applied EXACTLY ONCE', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.17',
                selector: '#off',
                property: 'opacity',
            });
            const inner = await page.prop('#off >>> button', 'opacity');
            assert.equal(inner, '1',
                'the inner control must NOT dim a second time — 0.38 × 0.38 = 0.14');

            const dial = await page.resolveToken('--ui-opacity-disabled', 'opacity');
            assert.equal(await page.prop('#off', 'opacity'), dial);
            assert.equal(await page.prop('#off-primary', 'opacity'), dial,
                'one dial for every variant, not a per-variant disabled repaint');
        }));

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const plain = await page.computed('#default >>> button', ['background-color', 'color']);
                assert.equal(plain['background-color'], ORACLE.transparent,
                    `${theme}: .slate-btn's face is transparent (oracle: rgba(0, 0, 0, 0))`);
                assert.equal(plain.color, want.ink, `${theme}: --ui-text-2`);

                const primary = await page.computed('#primary >>> button', ['background-color', 'color']);
                assert.equal(primary['background-color'], want.primaryFace, `${theme}: --ui-primary`);
                assert.equal(primary.color, want.primaryInk, `${theme}: --ui-on-primary`);

                assert.equal(await page.prop('#danger >>> button', 'color'), want.dangerInk,
                    `${theme}: --ui-status-danger`);

                const ghost = await page.computed('#ghost >>> button', ['background-color', 'border-top-color']);
                assert.equal(ghost['background-color'], ORACLE.transparent, `${theme}: ghost face`);
                assert.equal(ghost['border-top-color'], ORACLE.transparent, `${theme}: ghost edge`);
            }
        }));

        test('the two derived edges are Slate\'s own colour arithmetic', () => mounted(async (page) => {
            const primaryEdge = await page.resolveValue(
                'color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel))', 'border-top-color');
            assert.equal(await page.prop('#primary >>> button', 'border-top-color'), primaryEdge);

            const dangerEdge = await page.resolveValue(
                'color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-line))', 'border-top-color');
            assert.equal(await page.prop('#danger >>> button', 'border-top-color'), dangerEdge);

            const dangerFace = await page.resolveValue(
                'color-mix(in srgb, var(--ui-status-danger) 14%, transparent)', 'background-color');
            assert.equal(await page.prop('#danger >>> button', 'background-color'), dangerFace);
            assert.notEqual(dangerFace, ORACLE.transparent, 'the danger wash must actually be a wash');
        }));

        test('P8 (a): the primary variant actually paints, and is not Cancel', () => mounted(async (page) => {
            const cancel = await page.prop('#default >>> button', 'background-color');
            const confirm = await page.prop('#primary >>> button', 'background-color');
            const token = await page.resolveToken('--ui-primary', 'background-color');

            assert.equal(cancel, ORACLE.transparent, 'the neutral action is the transparent one');
            assert.equal(confirm, token, 'P8: the affirmative action must paint --ui-primary');
            assert.notEqual(confirm, cancel,
                'P8: the affirmative action renders identical to Cancel beside it');
        }));

        test('P8 (b): no rule from OUTSIDE can flatten the primary treatment', () => mounted(async (page) => {
            const before = await page.computed('#primary >>> button',
                ['background-color', 'color', 'border-top-color']);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'p8-shell-rule';
                s.textContent = [
                    '#row ui-button, #row ui-button *, #mount button, #mount * {',
                    '  background: transparent !important;',
                    '  background-color: transparent !important;',
                    '  color: inherit !important;',
                    '  border-color: transparent !important;',
                    '  min-height: 0 !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            const after = await page.computed('#primary >>> button',
                ['background-color', 'color', 'border-top-color']);
            assert.deepEqual(after, before,
                'P8: a screen sheet reached into the component and repainted it');
            assert.equal((await page.box('#primary >>> button')).height, 64,
                'P8\'s sibling failure: an outside rule must not resize the control either');
        }));

        test('the focus ring is the token ring, outset and unclipped', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#default >>> button');
            assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
            assert.deepEqual(g.clippers, [], 'nothing clips a button in an open row');
        }));

        test('drill: --ui-steel moves the ring, on the inner control', () => mounted(async (page) => {
            const sel = '#default >>> button';
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: sel,
                property: 'outline-color',
                prepare: (p) => p.focusVisible(sel),
            });
        }));

        test('the same ring survives a clipping band by going inset (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#clipped >>> button');
            assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
            assert.ok(g.clippers.length >= 1, 'the band must really clip, or this is vacuous');
            assert.equal(g.clippers[0].overflowX, 'hidden');

            await page.evalFn(() => {
                document.getElementById('clipped').removeAttribute('focus-ring');
                return true;
            });
            await page.focusVisible('#clipped >>> button');
            const outset = await page.focusGeometry('#clipped >>> button');
            assert.equal(outset.outlineOffset, '2px', '--ui-focus-offset');
            const clip = outset.clippers[0];
            const escapes = ['top', 'left', 'bottom'].filter((side) => (
                side === 'bottom'
                    ? outset.ringRect.bottom > clip.bottom + 0.5
                    : outset.ringRect[side] < clip[side] - 0.5
            ));
            assert.deepEqual(escapes, ['top', 'left', 'bottom'],
                'the band does not actually clip an outset ring, so the inset pass proves nothing');
        }));

        test('the button reads its CONTAINER: it wraps in, never out of it', () => mounted(async (page) => {
            const wide = await page.box('#wide >>> button');
            const roomy = await page.box('#narrow');
            assert.ok(wide.width < roomy.width, 'at 900px the button is sized by its label');

            await page.setStyle('#narrow', { 'inline-size': '260px' });
            const tight = await page.box('#narrow');
            const inTight = await page.box('#wide >>> button');

            assert.ok(
                inTight.right <= tight.right + 0.5 && inTight.left >= tight.left - 0.5,
                `the button escaped its container: [${inTight.left}, ${inTight.right}] ` +
                `outside [${tight.left}, ${tight.right}]`,
            );
            assert.ok(inTight.width < wide.width, 'it narrowed with the container');
            assert.ok(inTight.height >= 64,
                `the height floor is a token, not a casualty of a narrow container ` +
                `(got ${inTight.height})`);

            await page.setStyle('#narrow', { 'inline-size': '900px' });
            assert.equal((await page.box('#wide >>> button')).width, wide.width,
                'and it comes back — the size was read from the container, not remembered');

            acrossGeometries[geometry.name] = {
                restingHeight: (await page.box('#default >>> button')).height,
                tallHeight: (await page.box('#tall >>> button')).height,
                narrowHeightFloorMet: inTight.height >= 64,
                narrowContained: inTight.right <= tight.right + 0.5,
            };
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            await page.setStyle('#narrow', { 'inline-size': '400px' });
            const a = await page.box('#wide >>> button');
            await page.setStyle('#row', { 'inline-size': '520px' });
            const b = await page.box('#wide >>> button');
            assert.deepEqual(
                [a.width, a.height], [b.width, b.height],
                'resizing an unrelated sibling container moved this button',
            );
        }));

        test('every button clears the --ui-hit-min floor on both axes', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            assert.equal(floor, 48, '--ui-hit-min: a wet fingertip is about 9mm (spec §2.3)');

            for (const id of ['default', 'primary', 'ghost', 'danger', 'tall', 'labelled', 'off']) {
                const box = await page.box(`#${id} >>> button`);
                assert.ok(
                    box.width >= floor - 0.5 && box.height >= floor - 0.5,
                    `hit floor: #${id} renders ${box.width}×${box.height} against ${floor}px`,
                );
            }
        }));

        test('the control is a real button, and disabled is a refusal not a look', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const inner = (id) => document.getElementById(id).shadowRoot.querySelector('button');
                return {
                    tag: inner('default').tagName,
                    type: inner('default').getAttribute('type'),
                    liveDisabled: inner('default').disabled,
                    offDisabled: inner('off').disabled,
                    label: inner('labelled').getAttribute('aria-label'),
                    unlabelled: inner('default').getAttribute('aria-label'),
                    // The host is what a screen writes the state on; both spellings agree.
                    hostAttr: document.getElementById('off').hasAttribute('disabled'),
                };
            });
            assert.deepEqual(shape, {
                tag: 'BUTTON', type: 'button',
                liveDisabled: false, offDisabled: true,
                label: 'Close', unlabelled: null,
                hostAttr: true,
            });
        }));

        test('a press composes out to the host; a disabled press does not happen', () => mounted(async (page) => {
            await page.recordEvents('#default', ['click']);
            await page.click('#default >>> button');
            assert.equal((await page.recordedEvents()).length, 1,
                'the inner button\'s click must retarget to the host — that IS the API');

            await page.recordEvents('#off', ['click']);
            await page.click('#off >>> button');
            assert.deepEqual(await page.recordedEvents(), [],
                'the native disabled attribute is the refusal; the dial is only paint');
        }));

        test('focus() reaches the control, so a dialog can put focus on Confirm', () => mounted(async (page) => {
            const landed = await page.evalFn(() => {
                document.getElementById('primary').focus();
                const deep = window.__h.deepActiveElement();
                return {
                    inner: deep ? deep.tagName.toLowerCase() : null,
                    host: document.activeElement === document.getElementById('primary'),
                    ring: deep ? deep.matches(':focus') : false,
                };
            });
            assert.deepEqual(landed, { inner: 'button', host: true, ring: true });

            await page.focusVisible('#primary >>> button');
            const rings = await page.evalFn(() => ({
                host: document.getElementById('primary').matches(':focus-visible'),
                inner: document.getElementById('primary').shadowRoot
                    .querySelector('button').matches(':focus-visible'),
            }));
            assert.deepEqual(rings, { host: false, inner: true });

            const blurred = await page.evalFn(() => {
                document.getElementById('primary').blur();
                const deep = window.__h.deepActiveElement();
                return deep ? deep.tagName.toLowerCase() : null;
            });
            assert.equal(blurred, 'body', 'blur() is focus()\'s pair and lets go of the control');
        }));

        test('a disabled button refuses focus as well as the press', () => mounted(async (page) => {
            const where = await page.evalFn(() => {
                document.getElementById('off').focus();
                const deep = window.__h.deepActiveElement();
                return deep ? deep.tagName.toLowerCase() : null;
            });
            assert.equal(where, 'body',
                'the native disabled attribute refuses focus too — forwarding must not route around it');
        }));

        test('an unrecognised variant falls back rather than blanking the control', () => mounted(async (page) => {
            const bogus = await page.computed('#bogus >>> button', ['background-color', 'color']);
            const plain = await page.computed('#default >>> button', ['background-color', 'color']);
            assert.deepEqual(bogus, plain);
            assert.equal(
                await page.evalFn(() => document.getElementById('bogus').getAttribute('variant')),
                'default',
                'and it normalises, so the DOM says what it paints',
            );
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            const beaten = await page.evalFn(() => {
                const root = document.getElementById('default').shadowRoot;
                const s = document.createElement('style');
                s.textContent = 'button.btn { background-color: rgb(1, 2, 3); }';
                root.appendChild(s);
                return getComputedStyle(root.querySelector('button')).backgroundColor;
            });
            assert.equal(beaten, 'rgb(1, 2, 3)',
                'a plain rule in the same root must win — no !important anywhere in the component');
        }));
    });
}

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-button.entry.js');

        assert.equal(entry.id, 'ui-button', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-button.js',
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
                assert.ok(
                    await page.exists('ui-button >>> button'),
                    `${entry.id}--${state.id} mounted no button`,
                );
                const box = await page.box('ui-button >>> button');
                assert.ok(box.width > 0 && box.height >= 64,
                    `${entry.id}--${state.id} rendered ${box.width}×${box.height}`);
            }
        });
    });
});

describe('ui-button across both Gate A geometries', () => {
    test('the same component in the same container renders the same control', () => {
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        assert.equal(acrossGeometries.bench.restingHeight, 64, '--ui-control-h');
        assert.equal(acrossGeometries.bench.tallHeight, 82, '--ui-control-lg');
    });
});
