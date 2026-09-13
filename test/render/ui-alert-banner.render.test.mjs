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
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-alert-banner.js'];

const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    a.child { color: inherit; }
</style>`;

const HEADLINE = 'Disconnected';
const REMEDY = 'Check the machine is powered on and paired.';

const MARKUP = `${RING_CSS}
<div id="holder" style="inline-size: 1375px">
    <ui-alert-banner id="oracle-width">${HEADLINE}<span slot="remedy">${REMEDY}</span></ui-alert-banner>
</div>
<div id="narrow" style="inline-size: 320px">
    <ui-alert-banner id="tight">${HEADLINE}<span slot="remedy">${REMEDY}</span></ui-alert-banner>
</div>
<div id="plain-holder" style="inline-size: 860px">
    <ui-alert-banner id="plain">${HEADLINE}<span slot="remedy">${REMEDY}</span></ui-alert-banner>
    <ui-alert-banner id="lone">Profile refused</ui-alert-banner>
    <ui-alert-banner id="blank-remedy">Profile refused<span slot="remedy">   </span></ui-alert-banner>
    <ui-alert-banner id="late"><span id="late-head"></span><span id="late-remedy" slot="remedy"></span></ui-alert-banner>
    <ui-alert-banner id="authored-role" role="status">${HEADLINE}</ui-alert-banner>
    <ui-alert-banner id="gone" hidden>${HEADLINE}</ui-alert-banner>
    <ui-alert-banner id="focusable" tabindex="0">${HEADLINE}</ui-alert-banner>
    <ui-alert-banner id="linked">${HEADLINE}<span slot="remedy">Read the <a class="child" id="link" href="#pairing">pairing guide</a>.</span></ui-alert-banner>
</div>
<div id="band" style="position: relative; inline-size: 1375px; block-size: 130px">
    <ui-alert-banner id="overlay" style="position: absolute; inset: 0">${HEADLINE}<span slot="remedy">${REMEDY}</span></ui-alert-banner>
</div>
`;

const ORACLE = {
    dark: { ground: 'rgb(14, 19, 23)', headline: 'rgb(230, 102, 97)', remedy: 'rgb(186, 196, 202)' },
    light: { ground: 'rgb(242, 243, 243)', headline: 'rgb(181, 28, 35)', remedy: 'rgb(63, 71, 76)' },
    width: 1375,
    headlineSize: 52,
    headlineWeight: '500',
    headlineHeight: 54.5938,
    remedySize: 20,
    remedyWeight: '400',
    gap: 4,
    padInline: 28,
    shadow: 'none',
    borderWidth: 0,
    radius: 0,
};

const near = (got, want, what, tol = 0.4) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-alert-banner @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-alert-banner must mount without throwing');
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

        test('drill: --ui-fascia is the ground', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#plain >>> #banner',
                property: 'background-color',
            });
        }));

        test('drill: --ui-status-danger is the headline ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: '#plain >>> #headline',
                property: 'color',
            });
        }));

        test('drill: --ui-text-2 is the remedy ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-2',
                value: DRILL_COLOUR,
                selector: '#plain >>> #remedy',
                property: 'color',
            });
        }));

        test('drill: --ui-display-xl is the headline size, --ui-text-lg the remedy size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-display-xl',
                value: DRILL_LENGTH,
                selector: '#plain >>> #headline',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-lg',
                value: DRILL_LENGTH,
                selector: '#plain >>> #remedy',
                property: 'font-size',
            });
        }));

        test('drill: --ui-weight-medium is the headline weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '800',
                selector: '#plain >>> #headline',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-space-1 is the gap, --ui-space-6 the inline inset', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#plain >>> #text',
                property: 'row-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: DRILL_LENGTH,
                selector: '#plain >>> #banner',
                property: 'padding-left',
            });
        }));

        test('drill: --ui-space-4 is the block inset (DEPARTURE 2)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                selector: '#plain >>> #banner',
                property: 'padding-top',
            });
            const space5 = await page.resolveToken('--ui-space-5', 'padding-top');
            assert.notEqual(await page.prop('#plain >>> #banner', 'padding-top'), space5,
                'the block inset must be its own token, not the regular one by accident');
        }));

        test('L12: no colour survives a drill of the public palette', () => mounted(async (page) => {
            const props = { ground: '#plain >>> #banner', headline: '#plain >>> #headline', remedy: '#plain >>> #remedy' };
            const read = async () => ({
                ground: await page.prop(props.ground, 'background-color'),
                headline: await page.prop(props.headline, 'color'),
                remedy: await page.prop(props.remedy, 'color'),
            });
            const before = await read();
            for (const t of ['--ui-fascia', '--ui-status-danger', '--ui-text-2']) {
                await page.setToken(t, DRILL_COLOUR);
            }
            await page.settle(2);
            const after = await read();
            for (const key of Object.keys(before)) {
                assert.equal(after[key], DRILL_COLOUR,
                    `L12: ${key} did not follow the public token — it is painted from somewhere else`);
            }
            for (const t of ['--ui-fascia', '--ui-status-danger', '--ui-text-2']) {
                await page.setToken(t, null);
            }
            await page.settle(2);
            assert.deepEqual(await read(), before, 'and the palette restores');
        }));

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const banner = await page.computed('#oracle-width >>> #banner', [
                    'background-color', 'background-image', 'box-shadow',
                    'border-top-width', 'border-top-left-radius', 'opacity',
                    'row-gap', 'padding-left', 'padding-right',
                ]);
                assert.equal(banner['background-color'], want.ground, `${theme}: --ui-fascia`);
                assert.equal(banner['background-image'], 'none', `${theme}: oracle background-image = none`);
                assert.equal(banner['box-shadow'], ORACLE.shadow, `${theme}: oracle box-shadow = none`);
                near(banner['border-top-width'], ORACLE.borderWidth, `${theme}: a strip has no edge`);
                near(banner['border-top-left-radius'], ORACLE.radius, `${theme}: a strip has no radius`);
                assert.equal(banner.opacity, '1', `${theme}: oracle opacity = 1`);
                const words = await page.computed('#oracle-width >>> #text', ['row-gap']);
                near(words['row-gap'], ORACLE.gap, `${theme}: --ui-space-1`);
                near(banner['padding-left'], ORACLE.padInline, `${theme}: --ui-space-6`);
                near(banner['padding-right'], ORACLE.padInline, `${theme}: the inline inset is symmetric`);

                const headline = await page.computed('#oracle-width >>> #headline', [
                    'color', 'font-size', 'font-weight', 'letter-spacing', 'text-transform',
                ]);
                assert.equal(headline.color, want.headline, `${theme}: --ui-status-danger`);
                near(headline['font-size'], ORACLE.headlineSize,
                    `${theme}: --ui-display-xl at the oracle's own 1375px`);
                assert.equal(headline['font-weight'], ORACLE.headlineWeight, `${theme}: --ui-weight-medium`);
                assert.equal(headline['letter-spacing'], 'normal', `${theme}: oracle letter-spacing = normal`);
                assert.equal(headline['text-transform'], 'none', `${theme}: oracle text-transform = none`);

                const remedy = await page.computed('#oracle-width >>> #remedy', [
                    'color', 'font-size', 'font-weight',
                ]);
                assert.equal(remedy.color, want.remedy, `${theme}: --ui-text-2`);
                near(remedy['font-size'], ORACLE.remedySize, `${theme}: --ui-text-lg`);
                assert.equal(remedy['font-weight'], ORACLE.remedyWeight,
                    `${theme}: the oracle reads (no declaration), so this file declares none`);
            }
        }));

        test('the headline\'s leading reproduces the oracle\'s measured height', () => mounted(async (page) => {
            const box = await page.box('#oracle-width >>> #headline');
            near(box.height, ORACLE.headlineHeight, 'the 1.05 leading at 52px', 0.6);
        }));

        test('the headline is the oracle\'s 52px and holds it at every container width', () => mounted(async (page) => {
            const wide = await page.prop('#oracle-width >>> #headline', 'font-size');
            near(wide, ORACLE.headlineSize, 'the oracle\'s 52px is reproduced at the oracle\'s width');

            const tight = await page.prop('#tight >>> #headline', 'font-size');
            near(tight, ORACLE.headlineSize, 'and in a 320px container it is still 52px');
            assert.equal(tight, wide, 'one headline, one size — the display type no longer gives way');

            await page.setStyle('#holder', { 'inline-size': '1100px' });
            const mid = await page.prop('#oracle-width >>> #headline', 'font-size');
            assert.equal(mid, wide, 'a container width between the old clamp stops changes nothing');
            await page.setStyle('#holder', { 'inline-size': '1375px' });
            assert.equal(await page.prop('#oracle-width >>> #headline', 'font-size'), wide,
                'and it is unchanged on the way back');

            // The insets and the gap are physical tokens: they do not scale with it.
            const insets = await page.computed('#tight >>> #banner', ['padding-left', 'padding-top']);
            const wordGap = await page.computed('#tight >>> #text', ['row-gap']);
            near(insets['padding-left'], ORACLE.padInline, '--ui-space-6 does not shrink');
            near(insets['padding-top'], 18, '--ui-space-4 does not shrink');
            near(wordGap['row-gap'], ORACLE.gap, '--ui-space-1 does not shrink');

            acrossGeometries[geometry.name] = {
                wide: parseFloat(wide),
                tight: parseFloat(tight),
                padInline: insets['padding-left'],
                padBlock: insets['padding-top'],
                gap: wordGap['row-gap'],
            };
        }));

        test('the banner fills its container and never escapes it', () => mounted(async (page) => {
            const holder = await page.box('#narrow');
            const banner = await page.box('#tight >>> #banner');
            assert.ok(Math.abs(banner.width - holder.width) < 1,
                `the strip should fill its container: ${banner.width} in ${holder.width}`);
            assert.ok(banner.left >= holder.left - 0.5 && banner.right <= holder.right + 0.5,
                `the strip escaped its container: [${banner.left}, ${banner.right}]`);
            const m = await page.metrics('#tight >>> #banner');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                `content overflowed the strip horizontally: ${m.scrollWidth} > ${m.clientWidth}`);
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            const a = await page.box('#tight >>> #banner');
            const aSize = await page.prop('#tight >>> #headline', 'font-size');
            await page.setStyle('#plain-holder', { 'inline-size': '400px' });
            await page.setStyle('#holder', { 'inline-size': '600px' });
            const b = await page.box('#tight >>> #banner');
            assert.deepEqual([a.width, a.height], [b.width, b.height]);
            assert.equal(await page.prop('#tight >>> #headline', 'font-size'), aSize);
        }));

        test('L24: the host\'s own ring is --ui-focus-* and nothing clips it', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#focusable');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset, 'the default offset, from the token');
        }));

        test('L24: a focusable slotted into the message keeps its ring', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#link');
        }));

        test('L24 cannot express: the banner declares no clipping overflow', () => mounted(async (page) => {
            for (const sel of ['#plain >>> #banner', '#plain >>> #headline', '#plain >>> #remedy']) {
                const m = await page.metrics(sel);
                assert.equal(m.overflowX, 'visible', `${sel} clips horizontally`);
                assert.equal(m.overflowY, 'visible', `${sel} clips vertically`);
            }
            const hostOverflow = await page.computed('#plain', ['overflow-x', 'overflow-y']);
            assert.equal(hostOverflow['overflow-x'], 'visible', 'the host clips horizontally');
            assert.equal(hostOverflow['overflow-y'], 'visible', 'the host clips vertically');
        }));

        test('P8\'s family: no rule from OUTSIDE can reach the banner\'s paint', () => mounted(async (page) => {
            const props = ['background-color', 'padding-left', 'padding-top', 'row-gap'];
            const before = await page.computed('#plain >>> #banner', props);
            const headBefore = await page.computed('#plain >>> #headline', ['color', 'font-size', 'font-weight']);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'shell-shape';
                s.textContent = [
                    '#plain-holder ui-alert-banner, #plain-holder ui-alert-banner *,',
                    '#mount div, #mount *, .banner, .headline, .remedy {',
                    '  background-color: red !important;',
                    '  color: red !important;',
                    '  padding: 0 !important;',
                    '  gap: 0 !important;',
                    '  font-size: 9px !important;',
                    '  font-weight: 900 !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            assert.deepEqual(await page.computed('#plain >>> #banner', props), before,
                'a screen sheet reached into the component and repainted it');
            assert.deepEqual(await page.computed('#plain >>> #headline', ['color', 'font-size', 'font-weight']), headBefore,
                'a screen sheet reached into the headline and repainted it');
        }));

        test('DEPARTURE 5: [hidden] hides with no !important anywhere', () => mounted(async (page) => {
            assert.equal(await page.prop('#gone', 'display'), 'none');
            const box = await page.box('#gone');
            assert.ok(box.width === 0 && box.height === 0, `a hidden banner rendered ${box.width}×${box.height}`);

            // …and it comes back, so the rule is a rule and not a mount-time accident.
            await page.evalFn(() => { document.getElementById('gone').hidden = false; return true; });
            await page.settle(2);
            assert.notEqual(await page.prop('#gone', 'display'), 'none');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            const beaten = await page.evalFn(() => {
                const root = document.getElementById('plain').shadowRoot;
                const s = document.createElement('style');
                s.textContent = 'div.banner { background-color: rgb(1, 2, 3); } strong.headline { color: rgb(4, 5, 6); }';
                root.appendChild(s);
                const cs = (sel) => getComputedStyle(root.querySelector(sel));
                return [cs('#banner').backgroundColor, cs('#headline').color];
            });
            assert.deepEqual(beaten, ['rgb(1, 2, 3)', 'rgb(4, 5, 6)'],
                'a plain rule in the same root must win — no !important anywhere in the component');
        }));

        test('the host is role="alert", and an authored role is kept', () => mounted(async (page) => {
            const shape = await page.evalFn(() => ({
                plain: document.getElementById('plain').getAttribute('role'),
                lone: document.getElementById('lone').getAttribute('role'),
                authored: document.getElementById('authored-role').getAttribute('role'),
                innerRole: document.getElementById('plain').shadowRoot.querySelector('#banner').getAttribute('role'),
                headTag: document.getElementById('plain').shadowRoot.querySelector('#headline').tagName,
            }));
            assert.deepEqual(shape, {
                plain: 'alert',
                lone: 'alert',
                authored: 'status',
                innerRole: null,
                headTag: 'STRONG',
            });
        }));

        test('DEPARTURE 3: a part with nothing slotted into it collapses, gap and all', () => mounted(async (page) => {
            assert.equal(await page.prop('#lone >>> #remedy', 'display'), 'none');
            assert.equal(await page.prop('#blank-remedy >>> #remedy', 'display'), 'none',
                'whitespace is not content — and neither is the wrapper element holding it, '
                + 'which is the shape a Lit consumer writes: <span slot="remedy">${remedy ?? \'\'}</span>');
            assert.equal(await page.prop('#plain >>> #remedy', 'display'), 'block',
                'and a real remedy is present');
            assert.equal(await page.prop('#plain >>> #headline', 'display'), 'block');

            // The gap is not spent: the lone banner is exactly its headline plus insets.
            const banner = await page.box('#lone >>> #banner');
            const headline = await page.box('#lone >>> #headline');
            const pad = parseFloat(await page.prop('#lone >>> #banner', 'padding-top'));
            near(banner.height, headline.height + 2 * pad,
                'a collapsed remedy must not leave its gap behind', 0.6);
        }));

        test('DEPARTURE 3: a message that arrives AFTER mount raises the part', () => mounted(async (page) => {
            const before = await page.evalFn(() => {
                const r = document.getElementById('late').shadowRoot;
                return {
                    headline: getComputedStyle(r.getElementById('headline')).display,
                    remedy: getComputedStyle(r.getElementById('remedy')).display,
                };
            });
            assert.deepEqual(before, { headline: 'none', remedy: 'none' }, 'empty at rest');

            await page.evalFn(() => {
                document.getElementById('late-head').textContent = 'Disconnected';
                document.getElementById('late-remedy').textContent =
                    'Check the machine is powered on and paired.';
                return true;
            });
            await page.settle(3);

            const after = await page.evalFn(() => {
                const r = document.getElementById('late').shadowRoot;
                return {
                    headline: getComputedStyle(r.getElementById('headline')).display,
                    remedy: getComputedStyle(r.getElementById('remedy')).display,
                };
            });
            assert.deepEqual(after, { headline: 'block', remedy: 'block' },
                'the message is in the host and the strip shows nothing');

            const headline = await page.box('#late >>> #headline');
            assert.ok(headline.height > 20, `the raised headline has no box: ${headline.height}px`);
        }));

        test('DEPARTURE 3: a condition that CLEARS collapses its part again', () => mounted(async (page) => {
            assert.equal(await page.prop('#plain >>> #remedy', 'display'), 'block', 'filled at rest');

            await page.evalFn(() => {
                document.querySelector('#plain [slot="remedy"]').textContent = '   ';
                return true;
            });
            await page.settle(3);
            assert.equal(await page.prop('#plain >>> #remedy', 'display'), 'none',
                'whitespace is not content in this direction either');

            // And the gap goes with it, exactly as it does for a never-filled part.
            const banner = await page.box('#plain >>> #banner');
            const headline = await page.box('#plain >>> #headline');
            const pad = parseFloat(await page.prop('#plain >>> #banner', 'padding-top'));
            near(banner.height, headline.height + 2 * pad,
                'a cleared remedy must not leave its gap behind', 0.6);
        }));

        test('the slots carry content through, unmodified', () => mounted(async (page) => {
            const inside = await page.evalFn(() => {
                const root = document.getElementById('plain').shadowRoot;
                const text = (sel) => root.querySelector(sel).assignedNodes({ flatten: true })
                    .map((n) => (n.textContent || '').trim()).join('');
                return { head: text('slot:not([name])'), remedy: text('slot[name="remedy"]') };
            });
            assert.deepEqual(inside, {
                head: 'Disconnected',
                remedy: 'Check the machine is powered on and paired.',
            });
        }));

        test('DEPARTURE 1: the component sets no position, and the overlay is still one rule away', () => mounted(async (page) => {
            const placement = await page.computed('#plain', ['position', 'z-index']);
            assert.deepEqual(placement, { position: 'static', 'z-index': 'auto' },
                'the component must not place itself');
            const inner = await page.computed('#plain >>> #banner', ['position', 'z-index']);
            assert.deepEqual(inner, { position: 'static', 'z-index': 'auto' });

            const host = await page.box('#overlay');
            near(host.width, ORACLE.width, 'the overlay fills the band horizontally', 1);
            near(host.height, 130, 'and vertically', 1);
            const filled = await page.box('#overlay >>> #banner');
            near(filled.height, 130, 'min-block-size: 100% makes the strip cover the band', 1);

            const head = await page.box('#overlay >>> #headline');
            const rem = await page.box('#overlay >>> #remedy');
            const above = head.top - host.top;
            const below = host.bottom - rem.bottom;
            assert.ok(Math.abs(above - below) < 1.2,
                `the content is not centred in the band: ${above} above, ${below} below`);
            assert.ok(above >= 18 - 0.5,
                `the block inset is the floor, not the whole story: ${above}px above`);
        }));
    });
}

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-alert-banner.entry.js');

        assert.equal(entry.id, 'ui-alert-banner', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-alert-banner.js',
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
                    await page.exists('ui-alert-banner >>> #banner'),
                    `${entry.id}--${state.id} mounted no banner`,
                );
                const box = await page.box('ui-alert-banner >>> #banner');
                assert.ok(box.width > 0 && box.height > 0,
                    `${entry.id}--${state.id} rendered ${box.width}×${box.height}`);
            }
        });
    });
});

describe('ui-alert-banner across both Gate A geometries', () => {
    test('the same banner in the same container renders the same strip', () => {
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        near(acrossGeometries.bench.wide, ORACLE.headlineSize, 'the oracle\'s 52px, at both geometries');
        near(acrossGeometries.bench.tight, ORACLE.headlineSize,
            'and the same 52px in a 320px container, at both geometries');
    });
});
