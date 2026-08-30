/**
 * Gate A for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';
import { DASH_PATTERNS } from '../../src/lib/chart-axis.js';
import { entry as ENTRY } from '../../tools/gallery/entries/ui-chart-legend.entry.js';

const MODULE = ['/src/components/ui-chart-legend.js'];
const WITH_CARD = ['/src/components/ui-chart-legend.js', '/src/components/ui-chart-card.js'];

/**
 * The same recorded shot `ui-chart-card.render.test.mjs` uses — 426 measurements / 336
 * in-shot samples / 22.3s / two profile steps. One fixture, so the card's suite and this
 * one describe the same thing.
 */
const SHOT_URL = '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json';

const ITEMS = [
    { key: 'pressure', label: 'Pressure (bar)' },
    { key: 'targetPressure', label: 'Target Pressure', minor: true, dash: 'dash' },
    { key: 'flow', label: 'Flow (mL/s)' },
    { key: 'targetFlow', label: 'Target Flow', minor: true, dash: 'dashdot' },
    { key: 'weightFlow', label: 'GFlow (g/s)', minor: true },
];

const TEN = [
    ...ITEMS,
    { key: 'power', label: 'Power (W)' },
    { key: 'groupTemp', label: 'Group °C' },
    { key: 'mixTemp', label: 'Mix °C' },
    { key: 'targetTemp', label: 'Group Target °C', minor: true, dash: 'dash' },
    { key: 'targetMixTemp', label: 'Mix Target °C', minor: true, dash: 'dash' },
];

const attr = (items) => JSON.stringify(items).replace(/'/g, '&#39;');

const MARKUP = `
<div id="stage" style="padding: 24px; inline-size: 900px">
    <ui-chart-legend id="legend" label="Chart key" items='${attr(ITEMS)}'></ui-chart-legend>
</div>
<div id="narrow" style="padding: 24px; inline-size: 320px">
    <ui-chart-legend id="tight" label="Chart key" items='${attr(TEN)}'></ui-chart-legend>
</div>
<div id="authored-stage" style="padding: 24px">
    <ui-chart-legend id="authored" role="list" aria-label="The screen's own name"
        items='${attr(ITEMS)}'></ui-chart-legend>
</div>
<div id="readout-stage" style="padding: 24px">
    <ui-chart-legend id="readout" label="Chart key" items='${attr(ITEMS)}'></ui-chart-legend>
</div>
<div id="bogus-stage" style="padding: 24px">
    <ui-chart-legend id="bogus" label="Chart key"
        items='[{"key":"weightflow","label":"Not a channel"}]'></ui-chart-legend>
</div>
`;

const CARD_ITEMS = ITEMS.slice(0, 3);

/** A card with the legend in its own reserved row — the layout contract, assembled. */
const CARD_MARKUP = (stageWidth = 760) => `
<div id="stage" style="inline-size: ${stageWidth}px; block-size: 360px; margin: 24px">
    <ui-chart-card id="c" label="Shot chart" style="display: block; block-size: 360px">
        <ui-chart-legend id="key" slot="legend" label="Chart key" chart="c"
            items='${attr(CARD_ITEMS)}'></ui-chart-legend>
    </ui-chart-card>
</div>
<div id="bare-stage" style="inline-size: ${stageWidth}px; block-size: 360px; margin: 24px">
    <ui-chart-card id="bare" label="Shot chart" style="display: block; block-size: 360px"></ui-chart-card>
</div>
`;

/** Feed the card the way a screen does: one derivation, nothing else. */
const FEED = (id) => `(async () => {
    const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
    const record = await (await fetch('${SHOT_URL}')).json();
    const el = document.getElementById('${id}');
    await el.ready;
    el.derivation = deriveFromRecord(record);
    await el.updateComplete;
    el.drawNow();
    return { ok: el.derivation.ok, channels: el.channels.map((c) => c.key) };
})()`;

const near = (got, want, what, tol = 1.01) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const px = (value) => Number.parseFloat(value);

/** How many pixels on the card's canvas carry the drill colour. */
const countDrill = (page) => page.evalFn((s) => {
    const canvas = window.__h.need(s);
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
    }
    return n;
}, '#c >>> canvas');

const chip = (key, host = '#legend') => `${host} >>> #chip-${key}`;
const swatchLine = (key, host = '#legend') => `${host} >>> #chip-${key} line`;

/**
 * Mount one gallery state exactly as `gallery.js` does — `hostStyle` on the STAGE
 * wrapper, the state's markup inside it (gallery.js:81-84) — and read back what it drew.
 */
async function mountState(page, state) {
    const style = Object.entries(state.hostStyle ?? {})
        .map(([prop, value]) => `${prop}: ${value}`).join('; ');
    await page.mount(`<div id="stage" style="padding: 24px; ${style}">${state.html}</div>`, WITH_CARD);
    return page.evalFn(() => {
        const legend = document.querySelector('ui-chart-legend');
        const chips = [...legend.renderRoot.querySelectorAll('button')];
        return {
            items: legend.series.length,
            chips: chips.length,
            labels: chips.map((c) => c.querySelector('.label').textContent.trim()),
            readouts: legend.renderRoot.querySelectorAll('.value').length,
            inCardRow: Boolean(legend.closest('ui-chart-card')?.hasAttribute('has-legend')),
        };
    });
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    const dsf = geometry.deviceScaleFactor;

    describe(`ui-chart-legend @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${dsf})`, () => {

        const mounted = (fn, markup = MARKUP, modules = MODULE) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, modules);
            assert.deepEqual(page.pageErrors, [], 'the legend must mount without throwing');
            return fn(page);
        });

        const withCard = (fn, stageWidth = 760) => mounted(async (page) => {
            const fed = await page.eval(FEED('c'));
            assert.equal(fed.ok, true, 'the recorded shot derives');
            await page.eval(FEED('bare'));
            await page.settle();
            return fn(page);
        }, CARD_MARKUP(stageWidth), WITH_CARD);

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, { dpr: dsf, w: geometry.width, h: geometry.height });
        }));

        test('ONE drill on --ui-channel-pressure moves the swatch AND the canvas', () => withCard(async (page) => {
            const both = async (p) => {
                await p.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
                return {
                    swatch: await p.prop(swatchLine('pressure', '#key'), 'stroke'),
                    canvasHasDrill: (await countDrill(p)) > 0,
                };
            };

            const before = await both(page);
            assert.equal(before.canvasHasDrill, false, 'the drill colour must not already be painted');

            await assertTokenDrill(page, {
                token: '--ui-channel-pressure',
                value: DRILL_COLOUR,
                read: both,
                expected: { swatch: DRILL_COLOUR, canvasHasDrill: true },
            });
        }));

        test('the swatch reads the channel token, not a copy of a colour', () => mounted(async (page) => {
            /* Each channel independently: drilling ONE must not move the others. That is
             * what tells "reads var(--ui-channel-<name>)" apart from "reads whatever the
             * first channel resolved to". */
            const resolved = await page.resolveToken('--ui-channel-flow', 'stroke');
            assert.equal(await page.prop(swatchLine('flow'), 'stroke'), resolved,
                'the flow swatch is --ui-channel-flow');

            const pressureBefore = await page.prop(swatchLine('pressure'), 'stroke');
            await page.setToken('--ui-channel-flow', DRILL_COLOUR);
            assert.equal(await page.prop(swatchLine('flow'), 'stroke'), DRILL_COLOUR);
            assert.equal(await page.prop(swatchLine('pressure'), 'stroke'), pressureBefore,
                'drilling one channel must not move another — eighteen tokens, not one');
            await page.setToken('--ui-channel-flow', null);
        }));

        test('a derivation KEY and a channel NAME resolve to the same colour', () => mounted(async (page) => {
            const expected = await page.resolveToken('--ui-channel-weight-flow', 'stroke');
            assert.equal(await page.prop(swatchLine('weightFlow'), 'stroke'), expected);
            assert.notEqual(expected, 'rgb(0, 0, 0)', 'and it is a real colour, not the initial value');
        }));

        test('an unknown channel is REPORTED, not silently blank', () => mounted(async (page) => {
            const unresolved = await page.evalFn((s) => [...window.__h.need(s).unresolvedChannels], '#bogus');
            assert.deepEqual(unresolved, ['weightflow (--ui-channel-weightflow)'],
                'a key with no token is named — resolveChannels\'s own wording');
            const known = await page.evalFn((s) => [...window.__h.need(s).unresolvedChannels], '#legend');
            assert.deepEqual(known, [], 'and a legend whose channels all resolve reports nothing');
            /* It still draws, in the chip's own ink: a swatch that vanished would take
             * the label with it and the row would silently lose an entry. */
            assert.equal(await page.prop('#bogus >>> #chip-weightflow line', 'stroke'),
                await page.prop('#bogus >>> #chip-weightflow', 'color'),
                'the fallback is currentColor, so the mark is still there');
        }));

        test('a major swatch is --ui-chart-stroke and a minor one --ui-chart-stroke-minor', () => mounted(async (page) => {
            const major = await page.prop(swatchLine('pressure'), 'stroke-width');
            const minor = await page.prop(swatchLine('targetPressure'), 'stroke-width');

            assert.equal(major, '3px', 'the major stroke token');
            assert.equal(minor, '2px', 'the minor stroke token');
            assert.notEqual(major, minor,
                'THE §6.2 DEFECT: Slate draws border-top: 3px for every entry regardless '
                + 'of the series weight it stands for (slate-components.css:868). Two '
                + 'tokens, two weights, or the key cannot be checked against the plot.');
        }));

        test('both stroke tokens drill independently', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-chart-stroke',
                value: DRILL_LENGTH,
                selector: swatchLine('pressure'),
                property: 'stroke-width',
                expected: DRILL_LENGTH,
            });
            await assertTokenDrill(page, {
                token: '--ui-chart-stroke-minor',
                value: DRILL_LENGTH,
                selector: swatchLine('weightFlow'),
                property: 'stroke-width',
                expected: DRILL_LENGTH,
            });
        }));

        test('the swatch carries the plot\'s OWN dash table, not a CSS keyword', () => mounted(async (page) => {
            const asCss = (pattern) => pattern.map((n) => `${n}px`).join(', ');

            assert.equal(await page.prop(swatchLine('targetPressure'), 'stroke-dasharray'),
                asCss(DASH_PATTERNS.dash), 'dash -> [9,9]');
            assert.equal(await page.prop(swatchLine('targetFlow'), 'stroke-dasharray'),
                asCss(DASH_PATTERNS.dashdot), 'dashdot -> [9,3,3,3], which CSS `dashed` cannot say');
            assert.equal(await page.prop(swatchLine('pressure'), 'stroke-dasharray'), 'none',
                'and a solid series is solid');
        }));

        test('the swatch is --ui-legend-swatch-w wide and butt-capped like the trace', () => mounted(async (page) => {
            const box = await page.box(`${chip('pressure')} .swatch`);
            near(box.width, 30, 'SOURCE slate-tokens.css:76 / styles/tokens.css:538 — 30px', 0.6);
            assert.equal(await page.prop(swatchLine('pressure'), 'stroke-linecap'), 'butt',
                'bug chart-C7: round caps exist only inside bandsPlugin, so every ordinary '
                + 'series is butt-capped and the key must be too');
            await assertTokenDrill(page, {
                token: '--ui-legend-swatch-w',
                value: DRILL_LENGTH,
                selector: `${chip('pressure')} .swatch`,
                property: 'width',
                expected: DRILL_LENGTH,
            });
        }));

        test('the chip is Slate\'s chip, token for token', () => mounted(async (page) => {
            const got = await page.computed(chip('pressure'), [
                'font-size', 'font-weight', 'border-top-left-radius', 'border-top-width',
                'padding-left', 'padding-right', 'column-gap', 'box-shadow', 'text-transform',
                'letter-spacing', 'min-height', 'opacity',
            ]);

            assert.equal(got['font-size'], '17px');
            assert.equal(got['font-weight'], '500');
            assert.equal(got['border-top-left-radius'], '6px');
            assert.equal(got['border-top-width'], '1px');
            assert.equal(got['padding-left'], '12px');
            assert.equal(got['padding-right'], '12px');
            assert.equal(got['column-gap'], '8px');
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got.opacity, '1');
            assert.equal(got['min-height'], '44px', 'the oracle\'s 44px, as a floor');
        }));

        test('the chip renders at Slate\'s 44px when the words fit', () => mounted(async (page) => {
            const box = await page.box(chip('pressure'));
            near(box.height, 44, 'CITE expanded-charts .slate-chart-legend-item height = 44px', 0.6);
            const wide = await page.box(chip('targetPressure'));
            assert.ok(wide.width > box.width,
                'a longer label makes a wider chip: the oracle reads nine distinct widths '
                + 'and one height across twenty chips');
        }));

        test('face, ink, edge and radius all drill', () => mounted(async (page) => {
            for (const [token, property] of [
                ['--ui-key', 'background-color'],
                ['--ui-text-2', 'color'],
                ['--ui-line', 'border-top-color'],
            ]) {
                await assertTokenDrill(page, { token, selector: chip('pressure'), property });
            }
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: chip('pressure'),
                property: 'border-top-left-radius',
                expected: DRILL_LENGTH,
            });
            await assertTokenDrill(page, {
                token: '--ui-chart-legend',
                value: DRILL_LENGTH,
                selector: chip('pressure'),
                property: 'font-size',
                expected: DRILL_LENGTH,
            });
            await assertTokenDrill(page, {
                token: '--ui-legend-chip-h',
                value: DRILL_LENGTH,
                selector: chip('pressure'),
                property: 'min-height',
                expected: DRILL_LENGTH,
            });
        }));

        test('the paint is the same in both themes, because it is all tokens', () => mounted(async (page) => {
            const props = ['background-color', 'color', 'border-top-color', 'font-size',
                'font-weight', 'border-top-left-radius', 'padding-left', 'min-height'];
            const start = await page.evalFn(() => document.documentElement.getAttribute('data-theme'));
            const before = await page.computed(chip('pressure'), props);

            await page.setTheme(start === 'dark' ? 'light' : 'dark');
            const after = await page.computed(chip('pressure'), props);

            for (const prop of ['font-size', 'font-weight', 'border-top-left-radius',
                'padding-left', 'min-height']) {
                assert.equal(after[prop], before[prop], `${prop} is theme-independent`);
            }
            for (const prop of ['background-color', 'color', 'border-top-color']) {
                assert.notEqual(after[prop], before[prop], `${prop} is one of the three that move`);
            }
            await page.setTheme(start);
        }));

        test('every chip is a pressed button in a named group', () => mounted(async (page) => {
            const host = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const chips = [...el.renderRoot.querySelectorAll('button')];
                return {
                    role: el.getAttribute('role'),
                    name: el.getAttribute('aria-label'),
                    chips: chips.length,
                    types: [...new Set(chips.map((c) => c.type))],
                    pressed: [...new Set(chips.map((c) => c.getAttribute('aria-pressed')))],
                    swatchesHidden: chips.every((c) => c.querySelector('svg').getAttribute('aria-hidden') === 'true'),
                    labels: chips.map((c) => c.textContent.trim()),
                };
            }, '#legend');

            assert.equal(host.role, 'group');
            assert.equal(host.name, 'Chart key');
            assert.equal(host.chips, ITEMS.length);
            assert.deepEqual(host.types, ['button'], 'a real button, not a div with a handler');
            assert.deepEqual(host.pressed, ['true'], 'and every series starts drawn');
            assert.deepEqual(host.labels, ITEMS.map((i) => i.label),
                'the words are the consumer\'s, in the plot\'s draw order');
            assert.equal(host.swatchesHidden, true);
        }));

        test('a screen\'s own role and name are never overwritten', () => mounted(async (page) => {
            const aria = (s) => page.evalFn((sel) => {
                const el = window.__h.need(sel);
                return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
            }, s);

            /* The markup gives #authored a role and a name and NO `label`. */
            assert.deepEqual(await aria('#authored'),
                { role: 'list', name: 'The screen\'s own name' },
                'the author\'s role and name both stand (ui-bank.js:520-540)');

            /* `label` is this component's own API for the name and wins while it has one. */
            await page.evalFn((s) => {
                const el = window.__h.need(s);
                el.label = 'Chart key';
                return el.updateComplete;
            }, '#authored');
            assert.deepEqual(await aria('#authored'), { role: 'list', name: 'Chart key' });

            /* Clearing it gives the SCREEN's back rather than deleting it — "remove the
             * name I added" and "remove the name the screen added" are not the same call. */
            await page.evalFn((s) => {
                const el = window.__h.need(s);
                el.label = '';
                return el.updateComplete;
            }, '#authored');
            assert.deepEqual(await aria('#authored'),
                { role: 'list', name: 'The screen\'s own name' });
        }));

        test('a real click through the browser\'s hit test turns a series off', () => mounted(async (page) => {
            await page.recordEvents('#legend', ['legend-change']);
            await page.click(chip('pressure'));
            await page.settle();

            const state = await page.computed(chip('pressure'), ['background-color', 'color']);
            const pressed = await page.evalFn((s) => window.__h.need(s).getAttribute('aria-pressed'),
                chip('pressure'));
            assert.equal(pressed, 'false');

            assert.equal(state['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(state.color, await page.resolveToken('--ui-muted', 'color'));
            assert.equal(await page.prop(`${chip('pressure')} .swatch`, 'opacity'), '0.35');

            const events = await page.recordedEvents();
            assert.equal(events.length, 1, 'one press, one event');
            assert.deepEqual(events[0].detail, {
                key: 'pressure', visible: false, reason: 'toggle', hidden: ['pressure'],
            });

            await page.click(chip('pressure'));
            const back = await page.evalFn((s) => window.__h.need(s).getAttribute('aria-pressed'),
                chip('pressure'));
            assert.equal(back, 'true', 'and pressing again puts it back');
        }));

        test('the off chip is NOT painted with the four selection dials', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            const resting = await page.computed(chip('pressure'), ['background-color', 'box-shadow']);
            assert.notEqual(resting['background-color'], face,
                'a pressed chip at rest must not carry --ui-selected-face');
            assert.equal(resting['box-shadow'], 'none', 'and no LED');

            await page.click(chip('flow'));
            const off = await page.computed(chip('flow'), ['background-color', 'box-shadow']);
            assert.equal(off['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(off['box-shadow'], 'none');
        }));

        test('a double tap isolates, and a second one restores', () => mounted(async (page) => {
            const pressed = () => page.evalFn((s) => [...window.__h.need(s).renderRoot.querySelectorAll('button')]
                .map((b) => b.getAttribute('aria-pressed')), '#legend');

            /* Two pointer clicks inside DOUBLE_TAP_MS (uplot-legend.js:19, 320ms).
             * `detail: 1` is what makes them pointer clicks — see the keyboard test. */
            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            assert.deepEqual(await pressed(), ['false', 'false', 'true', 'false', 'false'],
                'isolate: everything but flow goes off');

            await sleep(420);
            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            assert.deepEqual(await pressed(), ['true', 'true', 'true', 'true', 'true'],
                'SOURCE uplot-legend.js:68-73 — "Without the second half, an isolating '
                + 'double tap is a one-way trip that needs five taps to undo."');
        }));

        test('a rapid CHAIN keeps Slate\'s own behaviour exactly', () => mounted(async (page) => {
            const pressed = () => page.evalFn((s) => [...window.__h.need(s).renderRoot.querySelectorAll('button')]
                .map((b) => b.getAttribute('aria-pressed')), '#legend');

            for (let i = 0; i < 3; i += 1) await page.dispatch(chip('flow'), 'click', { detail: 1 });
            assert.deepEqual(await pressed(), ['true', 'true', 'true', 'true', 'true']);
        }));

        test('two taps FURTHER APART than the window are two toggles', () => mounted(async (page) => {
            const pressed = () => page.evalFn((s) => [...window.__h.need(s).renderRoot.querySelectorAll('button')]
                .map((b) => b.getAttribute('aria-pressed')), '#legend');

            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            await sleep(420);
            await page.dispatch(chip('flow'), 'click', { detail: 1 });
            assert.deepEqual(await pressed(), ['true', 'true', 'true', 'true', 'true'],
                'off then on, not isolate — the 320ms window is a window, not a counter');
        }));

        test('DEPARTURE 6: keyboard activation toggles and never isolates', () => mounted(async (page) => {
            const pressed = () => page.evalFn((s) => [...window.__h.need(s).renderRoot.querySelectorAll('button')]
                .map((b) => b.getAttribute('aria-pressed')), '#legend');

            await page.focusVisible(chip('flow'));
            await page.press('Enter');
            await page.press('Enter');
            assert.deepEqual(await pressed(), ['true', 'true', 'true', 'true', 'true'],
                'two Enters are two toggles: off, then on');
        }));

        test('the focus ring is the base\'s one, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, chip('pressure'));
        }));

        test('DEPARTURE 3: the chip reaches --ui-hit-min without moving its ink', () => mounted(async (page) => {
            const ink = await page.box(chip('pressure'));
            const hit = await assertHitFloor(page, chip('pressure'), { mode: 'overlay' });

            near(ink.height, 44, 'the ink stays Slate\'s 44px', 0.6);
            assert.ok(hit.block >= 48 - 0.5,
                `and the hit box reaches ${hit.floor}px — Slate leaves this chip 4px short`);
            assert.ok(hit.inline >= ink.width - 2.5,
                `the inline axis covers the ink (${hit.inline} vs ${ink.width})`);
        }));

        test('setVisible / isolate / reset are the same state the chips show', () => mounted(async (page) => {
            const state = () => page.evalFn((s) => {
                const el = window.__h.need(s);
                return {
                    hidden: el.hiddenKeys,
                    pressed: [...el.renderRoot.querySelectorAll('button')]
                        .map((b) => b.getAttribute('aria-pressed')),
                };
            }, '#legend');

            await page.evalFn((s) => { window.__h.need(s).setVisible('flow', false); return true; }, '#legend');
            await page.settle();
            let got = await state();
            assert.deepEqual(got.hidden, ['flow']);
            assert.deepEqual(got.pressed, ['true', 'true', 'false', 'true', 'true']);

            await page.evalFn((s) => { window.__h.need(s).isolate('pressure'); return true; }, '#legend');
            await page.settle();
            got = await state();
            assert.deepEqual(got.hidden, ['targetPressure', 'flow', 'targetFlow', 'weightFlow']);

            await page.evalFn((s) => { window.__h.need(s).reset(); return true; }, '#legend');
            await page.settle();
            got = await state();
            assert.deepEqual(got.hidden, []);
            assert.deepEqual(got.pressed, ['true', 'true', 'true', 'true', 'true']);
        }));

        test('a new series set prunes the state instead of resurrecting chips', () => mounted(async (page) => {
            await page.evalFn((s) => { window.__h.need(s).setVisible('flow', false); return true; }, '#legend');
            await page.settle();

            const after = await page.evalFn((s) => {
                const el = window.__h.need(s);
                el.items = [
                    { key: 'pressure', label: 'Pressure (bar)' },
                    { key: 'flow', label: 'Flow (mL/s)' },
                ];
                return el.updateComplete.then(() => ({
                    hidden: el.hiddenKeys,
                    chips: el.renderRoot.querySelectorAll('button').length,
                }));
            }, '#legend');

            assert.equal(after.chips, 2, 'the row follows the plot');
            assert.deepEqual(after.hidden, ['flow'],
                'a channel that is still drawn keeps the state the user gave it; '
                + 'the four that left take theirs with them');
        }));

        test('a readout is rendered when a consumer has one, and not before', () => mounted(async (page) => {
            const count = (s) => page.evalFn((sel) => window.__h.need(sel).renderRoot
                .querySelectorAll('.value').length, s);
            assert.equal(await count('#readout'), 0, 'no cursor, no readout');

            const text = await page.evalFn((s) => {
                const el = window.__h.need(s);
                el.values = { pressure: '9.1 bar', flow: '2.4 mL/s' };
                return el.updateComplete.then(() => [...el.renderRoot.querySelectorAll('.value')]
                    .map((v) => v.textContent));
            }, '#readout');
            assert.deepEqual(text, ['9.1 bar', '2.4 mL/s'],
                'already formatted, at the card\'s own index (ui-chart-card.js:645)');
            assert.equal(await page.prop(`${chip('pressure', '#readout')} .value`, 'font-variant-numeric'),
                'lining-nums tabular-nums',
                'type-roles.js\'s .ui-numeric modifier, composed rather than re-declared');
        }));

        test('the row wraps rather than clipping, and no chip escapes its container', () => mounted(async (page) => {
            const container = await page.box('#narrow');
            const chips = await page.evalFn((s) => [...window.__h.need(s).renderRoot.querySelectorAll('button')]
                .map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, t: r.top }; }),
                '#tight');

            assert.equal(chips.length, 10, 'Slate\'s own count per expanded page');
            for (const [i, c] of chips.entries()) {
                assert.ok(c.r <= container.right + 0.5,
                    `chip ${i} overflows its 320px container by ${(c.r - container.right).toFixed(1)}px — `
                    + '§2.4: a legend may wrap, it may never spill');
                assert.ok(c.h >= 44 - 0.5, `chip ${i} is ${c.h}px, below the 44px floor`);
            }
            const rows = new Set(chips.map((c) => Math.round(c.t)));
            assert.ok(rows.size > 1, 'at 320px this legend is more than one row — that is the point');
        }));

        test('a wrapped row costs whole chip rows, and says so in the flow', () => mounted(async (page) => {
            const wide = await page.box('#legend');
            near(wide.height, 44, 'one row of chips is one chip tall', 0.6);

            const tight = await page.box('#tight');
            const chipRows = await page.evalFn((s) => new Set([...window.__h.need(s).renderRoot
                .querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top))).size, '#tight');
            const expected = chipRows * 44 + (chipRows - 1) * 8;
            assert.ok(Math.abs(tight.height - expected) <= 2 * chipRows,
                `${chipRows} rows of 44px chips with 8px gaps ≈ ${expected}px, measured ${tight.height}px`);
        }));

        test('the gaps are the spacing tokens, and they drill', () => mounted(async (page) => {
            const row = await page.computed('#legend >>> .row', ['column-gap', 'row-gap', 'flex-wrap']);
            assert.equal(row['column-gap'], '12px', 'SOURCE slate-components.css:836 var(--slate-space-3)');
            assert.equal(row['row-gap'], '8px', 'and var(--slate-space-2)');
            assert.equal(row['flex-wrap'], 'wrap');

            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#legend >>> .row',
                property: 'column-gap',
                expected: DRILL_LENGTH,
            });
        }));

        test('DEPARTURE 4: the legend spends no outer spacing of its own', () => mounted(async (page) => {
            const host = await page.computed('#legend', ['padding-top', 'padding-bottom',
                'margin-top', 'margin-bottom', 'display', 'position']);
            assert.deepEqual(host, {
                'padding-top': '0px', 'padding-bottom': '0px',
                'margin-top': '0px', 'margin-bottom': '0px',
                display: 'block', position: 'static',
            }, 'Slate spends 8px+8px of padding here and 18px of margin on its host, inside '
             + 'a card that also pads (§6.1 rule 4\'s 78px). The row\'s owner owns the row\'s '
             + 'spacing; a plain static block is also what makes the card\'s ResizeObserver '
             + 'able to see this component grow.');
        }));

        test('the card reserves the row, and the plot is sized to what it actually has', () => withCard(async (page) => {
            const filled = await page.evalFn((s) => window.__h.need(s).hasAttribute('has-legend'), '#c');
            const empty = await page.evalFn((s) => window.__h.need(s).hasAttribute('has-legend'), '#bare');
            assert.equal(filled, true, 'a filled slot says so out loud (ui-chart-card.js:551-556)');
            assert.equal(empty, false);

            const plot = await page.box('#c >>> .plot');
            const canvas = await page.box('#c >>> canvas');
            near(canvas.width, plot.width, 'the canvas matches the plot box it was measured against', 1.5);
            near(canvas.height, plot.height, 'on both axes — bug chart-C10 is the height half', 1.5);

            const legend = await page.box('#key');
            const barePlot = await page.box('#bare >>> .plot');
            near(legend.height, 44, 'three chips are one row at this stage width', 0.6);
            assert.ok(barePlot.height > plot.height,
                'the legend costs the plot real height rather than overlapping it');
            const cost = barePlot.height - plot.height;
            assert.ok(cost >= legend.height - 1,
                `the plot gave up ${cost.toFixed(1)}px for a ${legend.height.toFixed(1)}px legend`);
            near(cost, 52, 'one row of legend costs 52px against Slate\'s 78', 1.5);
        }));

        test('a legend that WRAPS re-sizes the plot, and the canvas follows', () => withCard(async (page) => {
            const before = await page.box('#c >>> canvas');
            const beforePlot = await page.box('#c >>> .plot');
            near(before.width, beforePlot.width, 'starting sized correctly', 1.5);

            await page.evalFn((s, items) => {
                document.getElementById('stage').style.inlineSize = '380px';
                window.__h.need(s).items = items;
                return window.__h.need(s).updateComplete;
            }, '#key', TEN);
            await page.settle();
            await page.settle();

            const legend = await page.box('#key');
            const plot = await page.box('#c >>> .plot');
            const canvas = await page.box('#c >>> canvas');

            assert.ok(legend.height > 44 + 1, `the legend wrapped (${legend.height.toFixed(1)}px)`);
            assert.ok(plot.height < beforePlot.height,
                'the plot row gave way — the legend is in the layout, not over it');
            near(canvas.width, plot.width,
                'AND THE CANVAS FOLLOWED: bug chart-C10 is a plot "born sized to a box it '
                + 'no longer occupies", which is precisely this measurement failing', 1.5);
            near(canvas.height, plot.height, 'on the height axis too', 1.5);
            assert.deepEqual(page.pageErrors, []);
        }));

        test('the hit overlay never reaches the plot', () => withCard(async (page) => {
            const overlay = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const button = el.renderRoot.querySelector('button');
                const r = button.getBoundingClientRect();
                const style = getComputedStyle(button, '::before');
                const h = parseFloat(style.height);
                return { bottom: r.bottom + (h - r.height) / 2 };
            }, '#key');
            const plot = await page.box('#c >>> .plot');
            assert.ok(overlay.bottom <= plot.top + 0.5,
                `the overlay reaches ${overlay.bottom.toFixed(1)}px and the plot starts at `
                + `${plot.top.toFixed(1)}px — the 2px spill must land in the card's own 8px gap`);
        }));

        test('a bound legend hides the TRACE, not just the chip', () => withCard(async (page) => {
            await page.setToken('--ui-channel-pressure', DRILL_COLOUR);
            await page.settle();
            await page.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
            const drawn = await countDrill(page);
            assert.ok(drawn > 0, 'the pressure trace is on the canvas to begin with');

            await page.click(chip('pressure', '#key'));
            await page.settle();
            await page.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
            assert.equal(await countDrill(page), 0,
                'pressing the chip took the trace off the plot (uplot-plot.js:485, '
                + 'setSeriesVisible) — matched by KEY, never by position');

            await page.click(chip('pressure', '#key'));
            await page.settle();
            await page.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, '#c');
            assert.ok(await countDrill(page) > 0, 'and pressing again brings it back');
            await page.setToken('--ui-channel-pressure', null);
        }));

        test('every gallery state mounts and shows what it claims', () => browser.withPage({ geometry }, async (page) => {
            for (const state of ENTRY.states) {
                const got = await mountState(page, state);
                assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);
                assert.equal(got.chips, got.items,
                    `state ${state.id} rendered ${got.chips} chips for ${got.items} items`);
                assert.ok(got.labels.every((l) => l.length > 0),
                    `state ${state.id} has a chip with no words`);
                if (state.id === 'with-readout') {
                    assert.equal(got.readouts, got.items,
                        'the values attribute is parsed by Lit\'s Object converter, or the '
                        + 'gallery photographs a legend with no readout in the readout state');
                }
                if (state.id === 'in-the-cards-row') {
                    assert.equal(got.inCardRow, true,
                        'the card must report has-legend, or the reserved row is not reserved');
                }
            }
        }));

        test('an UNBOUND legend still keeps its state and still reports it', () => mounted(async (page) => {
            /* The gallery, the profile editor's preview, any key without a plot: the chip
             * is still a control and `legend-change` is still the road in. */
            await page.recordEvents('#legend', ['legend-change']);
            await page.click(chip('flow'));
            const events = await page.recordedEvents();
            assert.equal(events.length, 1);
            assert.deepEqual(events[0].detail.hidden, ['flow']);
        }));
    });
}
