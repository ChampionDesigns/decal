/**
 * Gate A for.
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

const MODULE = ['/src/components/ui-locked-value.js'];

const HELD = 'Holds 02 Preinfusion 84.0 °C';

const MARKUP = `
<div id="cell" style="inline-size: 346px; padding: 24px 0">
    <ui-locked-value id="sized">${HELD}</ui-locked-value>
</div>
<div id="wide-cell" style="inline-size: 640px">
    <ui-locked-value id="wide">Holds previous target</ui-locked-value>
</div>
<div id="narrow-cell" style="inline-size: 200px">
    <ui-locked-value id="narrow">${HELD}</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="named" label="Held target, 84.0 degrees Celsius">84.0 °C</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="plain">Holds previous target</ui-locked-value>
    <ui-locked-value id="gone" hidden>Holds previous target</ui-locked-value>
    <ui-locked-value id="dimmed" disabled>Holds previous target</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="focusable" tabindex="0">Holds previous target</ui-locked-value>
</div>
<div id="band" style="overflow: hidden; inline-size: 360px; display: flex; padding: 8px">
    <ui-locked-value id="clipped" tabindex="0" focus-ring="inset"
        style="flex: 1 1 auto">Holds previous target</ui-locked-value>
</div>
`;

const ORACLE = {
    dark: {
        edge: 'rgb(82, 97, 107)',
        face: 'rgb(24, 30, 35)',
        ink: 'rgb(148, 161, 169)',
    },
    light: {
        edge: 'rgb(170, 178, 183)',
        face: 'rgb(255, 255, 255)',
        ink: 'rgb(90, 101, 108)',
    },
    /* Theme-independent, from the same records. */
    edgeWidth: '1px',
    edgeStyle: 'dashed',
    radius: '6px',
    fontSize: '16px',
    fontWeight: '400',
    tracking: 'normal',
    controlH: 64,
    controlInner: 62,
    /* The three values this build deliberately does NOT reproduce — see DEPARTURES. */
    slatePadding: '14px',      // off the spacing scale
    slateWidth: 346,           // pinned with !important, one owner too many
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-locked-value @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-locked-value must mount without throwing');
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

        test('drill: the three colour tokens are the edge, the face and the ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line-strong',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-surface',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'color',
            });
        }));

        test('drill: --ui-control-h is the floor, and it is a FLOOR', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'min-height',
            });
        }));

        test('drill: --ui-space-3, --ui-radius, --ui-border-w and --ui-hairline', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'border-top-left-radius',
            });
            await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: '5px',
                expected: '5px',
                selector: '#sized >>> #box',
                property: 'border-top-width',
            });
            await assertTokenDrill(page, {
                token: '--ui-hairline',
                value: '5px',
                expected: '5px',
                selector: '#sized >>> #box',
                property: 'border-top-width',
            });
        }));

        test('drill: --ui-text-note, --ui-weight-regular and --ui-font-family', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note',
                value: '31px',
                selector: '#sized >>> #box',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-regular',
                value: '800',
                selector: '#sized >>> #box',
                property: 'font-weight',
            });
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#sized >>> #box',
                property: 'font-family',
            });
        }));

        test('the component declares no tokens of its own — bug L12 by construction', () => mounted(async (page) => {
            const declared = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return [...text.matchAll(/(^|[^r(])(--ui-[a-z0-9-]+)\s*:/g)].map((m) => m[2]);
            }, '#sized');
            assert.deepEqual(declared, [], `this component declares public tokens: ${declared}`);
        }));

        test('zero !important in the component\'s own rules — spec §2.1 Rule 3', () => mounted(async (page) => {
            const bangs = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return (text.match(/!\s*important/g) || []).length;
            }, '#sized');
            assert.equal(bangs, 0, 'the adopted rules carry an !important');
        }));

        test('the resting paint is the sources\' measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];
                const c = await page.computed('#sized >>> #box',
                    ['border-top-color', 'background-color', 'color']);
                assert.equal(c['border-top-color'], want.edge, `${theme}: --ui-line-strong`);
                assert.equal(c['background-color'], want.face, `${theme}: --ui-surface`);
                assert.equal(c.color, want.ink, `${theme}: --ui-muted`);
            }
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const c = await page.computed('#sized >>> #box', [
                'border-top-width', 'border-top-style', 'border-top-left-radius',
                'font-size', 'font-weight', 'letter-spacing', 'text-align', 'min-height',
            ]);
            assert.equal(c['border-top-width'], ORACLE.edgeWidth, 'CITE [i=58] 1px');
            assert.equal(c['border-top-style'], ORACLE.edgeStyle,
                'SOURCE profile-editor-v3.css:646 — dashed is the whole signal that this cell is locked');
            assert.equal(c['border-top-left-radius'], ORACLE.radius, 'CITE [i=33] 6px');
            assert.equal(c['font-size'], ORACLE.fontSize, 'CITE [i=169] 16px = --slate-text-note');
            assert.equal(c['font-weight'], ORACLE.fontWeight, 'CITE [i=33] 400');
            assert.equal(c['letter-spacing'], ORACLE.tracking, 'CITE editor-steps .pe-stepper [i=33] normal');
            assert.equal(c['text-align'], 'center', 'SOURCE profile-editor-v3.css:654');
            assert.equal(c['min-height'], `${ORACLE.controlH}px`, 'CITE [i=169] 64px = --slate-control-height');
        }));

        test('the edge is dashed on all four sides, and it is one hairline', () => mounted(async (page) => {
            const c = await page.computed('#sized >>> #box', [
                'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
                'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
            ]);
            assert.deepEqual(
                [c['border-top-style'], c['border-right-style'], c['border-bottom-style'], c['border-left-style']],
                ['dashed', 'dashed', 'dashed', 'dashed'],
            );
            assert.deepEqual(
                [c['border-top-width'], c['border-right-width'], c['border-bottom-width'], c['border-left-width']],
                ['1px', '1px', '1px', '1px'],
            );
        }));

        test('DEPARTURE 1: the box owns no width — the container does', () => mounted(async (page) => {
            for (const width of [346, 260, 640, 200]) {
                await page.setStyle('#cell', { 'inline-size': `${width}px` });
                const box = await page.box('#sized >>> #box');
                assert.ok(
                    Math.abs(box.width - width) < 0.5,
                    `at a ${width}px container the box measured ${box.width}px — something pins its width`,
                );
            }
            await page.setStyle('#cell', { 'inline-size': '346px' });

            // And the specific failure named: nothing anywhere reproduces the 346.
            await page.setStyle('#cell', { 'inline-size': '260px' });
            const pinned = await page.box('#sized >>> #box');
            assert.notEqual(Math.round(pinned.width), ORACLE.slateWidth,
                'the box fell back to Slate\'s pinned 346px in a 260px container');
            await page.setStyle('#cell', { 'inline-size': '346px' });
        }));

        test('DEPARTURE 1: two containers, two widths, one component', () => mounted(async (page) => {
            const narrow = await page.box('#narrow >>> #box');
            const wide = await page.box('#wide >>> #box');
            assert.ok(Math.abs(narrow.width - 200) < 0.5, `narrow cell: ${narrow.width}px`);
            assert.ok(Math.abs(wide.width - 640) < 0.5, `wide cell: ${wide.width}px`);
        }));

        test('DEPARTURE 2: 64px comes from --ui-control-h, not from a literal', () => mounted(async (page) => {
            const token = await page.resolveValue('var(--ui-control-h)', 'min-height');
            const got = await page.prop('#sized >>> #box', 'min-height');
            assert.equal(got, token);
            const box = await page.box('#sized >>> #box');
            assert.ok(Math.abs(box.height - ORACLE.controlH) < 0.5,
                `resting height ${box.height}px against the record's ${ORACLE.controlH}px`);
        }));

        test('DEPARTURE 2: the content box IS --ui-control-inner, derived not declared', () => mounted(async (page) => {
            const m = await page.metrics('#sized >>> #box');
            assert.ok(Math.abs(m.clientHeight - ORACLE.controlInner) < 0.5,
                `content box ${m.clientHeight}px against --ui-control-inner's ${ORACLE.controlInner}px`);
            const derived = await page.resolveValue('var(--ui-control-inner)', 'height');
            assert.equal(parseFloat(derived), ORACLE.controlInner,
                'the token itself must still derive to 62px');
        }));

        test('DEPARTURE 2: the floor GROWS rather than clipping — bug E7\'s class', () => mounted(async (page) => {
            const before = await page.box('#sized >>> #box');
            await page.setToken('--ui-text-note', '72px');
            const after = await page.box('#sized >>> #box');
            const inner = await page.metrics('#sized >>> #box');
            await page.setToken('--ui-text-note', null);
            const restored = await page.box('#sized >>> #box');

            assert.ok(after.height > before.height + 10,
                `at 72px type the box stayed ${after.height}px — a fixed height would clip the line box`);
            assert.ok(inner.scrollHeight <= inner.clientHeight + 0.5,
                `the text overflows its own box by ${inner.scrollHeight - inner.clientHeight}px`);
            assert.ok(Math.abs(restored.height - before.height) < 0.5, 'and it comes back');
        }));

        test('DEPARTURE 3: inline padding is --ui-space-3, not Slate\'s off-scale 14px', () => mounted(async (page) => {
            const c = await page.computed('#sized >>> #box', ['padding-left', 'padding-right',
                'padding-top', 'padding-bottom']);
            const step = await page.resolveValue('var(--ui-space-3)', 'padding-left');
            assert.equal(c['padding-left'], step);
            assert.equal(c['padding-right'], step);
            assert.notEqual(c['padding-left'], ORACLE.slatePadding,
                'the off-scale 14px came back');
            assert.equal(c['padding-top'], '0px', 'SOURCE profile-editor-v3.css:645 — 0 on the block axis');
            assert.equal(c['padding-bottom'], '0px');
        }));

        test('DEPARTURE 4: long copy clamps on one line instead of spilling', () => mounted(async (page) => {
            const box = await page.box('#narrow >>> #box');
            const text = await page.box('#narrow >>> #text');
            const c = await page.computed('#narrow >>> #text',
                ['overflow-x', 'text-overflow', 'white-space']);

            assert.equal(c['overflow-x'], 'hidden');
            assert.equal(c['text-overflow'], 'ellipsis');
            assert.equal(c['white-space'], 'nowrap');

            assert.ok(Math.abs(box.height - ORACLE.controlH) < 0.5,
                `the copy wrapped: the box grew to ${box.height}px in a 200px container`);
            assert.ok(text.right <= box.right + 0.5 && text.left >= box.left - 0.5,
                `the text spilled out of its box: text [${text.left}, ${text.right}] vs box [${box.left}, ${box.right}]`);

            const m = await page.metrics('#narrow >>> #text');
            assert.ok(m.scrollWidth > m.clientWidth + 0.5,
                'the assertion is vacuous — this copy is not actually too long for a 200px cell');
        }));

        test('DEPARTURE 4: it is a clamp, not a truncation — the text stays whole', () => mounted(async (page) => {
            const said = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), '#narrow');
            assert.equal(said, HELD);
        }));

        test('DEPARTURE 5: made focusable, it gets THE ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#focusable');
        }));

        test('DEPARTURE 5: inside an overflow:hidden band, the inset offset keeps it whole', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#clipped');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset, 'focus-ring="inset" must select the inset offset');
        }));

        test('nothing in this component clips a ring of its own', () => mounted(async (page) => {
            const c = await page.computed('#focusable >>> #box', ['overflow-x', 'overflow-y']);
            assert.equal(c['overflow-x'], 'visible');
            assert.equal(c['overflow-y'], 'visible');
        }));

        test('the box reads its container, never the viewport', () => mounted(async (page) => {
            const box = await page.box('#sized >>> #box');
            acrossGeometries[geometry.name] = {
                width: Math.round(box.width * 100) / 100,
                height: Math.round(box.height * 100) / 100,
            };
            assert.ok(Math.abs(box.width - 346) < 0.5);
        }));

        test('the host is a container, and no rule here is keyed on a media query', () => mounted(async (page) => {
            assert.equal(await page.prop('#sized', 'container-type'), 'inline-size');
            const widthQueries = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return (text.match(/@media[^{]*\b(width|min-width|max-width)\b/g) || []).length;
            }, '#sized');
            assert.equal(widthQueries, 0, 'a component wrote a viewport width query');
        }));

        test('at the floor container the box still clears the touch floor it inherits', () => mounted(async (page) => {
            await page.setStyle('#cell', { 'inline-size': '120px' });
            const box = await page.box('#sized >>> #box');
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'height'));
            await page.setStyle('#cell', { 'inline-size': '346px' });
            assert.ok(box.height >= floor - 0.5,
                `at a 120px container the box is ${box.height}px tall, under the ${floor}px floor`);
        }));

        test('a sheet from outside cannot reach in and flatten the paint', () => mounted(async (page) => {
            const before = await page.computed('#sized >>> #box',
                ['background-color', 'border-top-color', 'color', 'border-top-style']);
            await page.eval(`(() => {
                const s = document.createElement('style');
                s.textContent = '.box, #box, ui-locked-value div, div { background-color: rgb(1, 2, 3) !important;'
                    + ' border-color: rgb(1, 2, 3) !important; color: rgb(1, 2, 3) !important;'
                    + ' border-style: solid !important }';
                document.head.appendChild(s);
                return true;
            })()`);
            await page.settle(2);
            const after = await page.computed('#sized >>> #box',
                ['background-color', 'border-top-color', 'color', 'border-top-style']);
            assert.deepEqual(after, before, 'a document sheet repainted the shadow tree');
        }));

        test('it is NON-INTERACTIVE, and there is no control inside it', () => mounted(async (page) => {
            const state = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                return {
                    tabIndex: host.tabIndex,
                    hasTabindexAttr: host.hasAttribute('tabindex'),
                    role: host.getAttribute('role'),
                    innerRole: host.shadowRoot.querySelector('[role]') ? 'yes' : null,
                    tag: host.shadowRoot.getElementById('box').tagName,
                };
            }, '#plain');
            assert.equal(state.tabIndex, -1, 'the box must not put itself in the tab order');
            assert.equal(state.hasTabindexAttr, false);
            assert.equal(state.role, null, 'a locked cell has no role of its own');
            assert.equal(state.innerRole, null);
            assert.equal(state.tag, 'DIV', 'the box is a div — never a button, never an input');

            assert.equal(
                await page.count('#plain >>> :is(button, input, select, textarea, a, [tabindex])'), 0,
                'a control appeared inside a cell whose whole point is that there is none',
            );
        }));

        test('focusability is the consumer\'s to grant, and it works when granted', () => mounted(async (page) => {
            assert.equal(await page.evalFn((s) => window.__h.need(s).tabIndex, '#focusable'), 0);
        }));

        test('the label escape hatch names a bare reading without showing it twice', () => mounted(async (page) => {
            const a = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = host.shadowRoot.getElementById('text');
                const a11y = host.shadowRoot.getElementById('a11y');
                return {
                    hidden: text.getAttribute('aria-hidden'),
                    said: a11y ? a11y.textContent : null,
                };
            }, '#named');
            assert.equal(a.hidden, 'true', 'the visible glyphs must not be read as well as the label');
            assert.equal(a.said, 'Held target, 84.0 degrees Celsius');

            const hiddenBox = await page.box('#named >>> #a11y');
            assert.ok(hiddenBox.width <= 1.5 && hiddenBox.height <= 1.5,
                `the label is visible: ${hiddenBox.width}×${hiddenBox.height}`);
        }));

        test('without a label the visible text IS the accessible content', () => mounted(async (page) => {
            const a = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                return {
                    hidden: host.shadowRoot.getElementById('text').getAttribute('aria-hidden'),
                    extra: host.shadowRoot.getElementById('a11y'),
                };
            }, '#plain');
            assert.equal(a.hidden, null, 'nothing must be hidden when there is no replacement name');
            assert.equal(a.extra, null);
        }));

        test('no hit overlay: the shared utility is not this component\'s (CONVENTIONS §5)', () => mounted(async (page) => {
            const before = await page.computed('#plain >>> #box', ['content'], { pseudo: '::before' });
            assert.equal(before.content, 'none', 'a hit overlay appeared on a non-target');
        }));

        test('[hidden] beats layout, because state beats layout', () => mounted(async (page) => {
            assert.equal(await page.prop('#gone', 'display'), 'none');
            assert.equal(await page.prop('#plain', 'display'), 'block');
        }));

        test('disabled dims from the one dial, and dims the whole box', () => mounted(async (page) => {
            const dial = await page.tokenValue('--ui-opacity-disabled');
            assert.equal(
                parseFloat(await page.prop('#dimmed', 'opacity')),
                parseFloat(dial),
                `the dimmed box is not on --ui-opacity-disabled (${dial})`,
            );
            assert.equal(await page.prop('#plain', 'opacity'), '1');
        }));
    });
}

test('the same container gives the same box at both standard geometries', () => {
    const names = Object.keys(acrossGeometries);
    assert.ok(names.length >= 2, `only ran at ${names.join(', ')}`);
    const [first, ...rest] = names;
    for (const name of rest) {
        assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
            `${name} vs ${first}: ${JSON.stringify(acrossGeometries)}`);
    }
});
