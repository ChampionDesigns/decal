/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-select.js'];

/* Two options of very different lengths, on purpose: the control's own max-content
 * width depends on them, which is what makes the "stated width is held" assertions
 * bite rather than coincide. */
const UNITS = '[&quot;Celsius (°C)&quot;,&quot;Fahrenheit (°F)&quot;]';
const LONG = '[&quot;Everything (ALL)&quot;,&quot;Trace (FINEST) and every packet on the bus&quot;]';

const MARKUP = `<ui-select id="units" label="Temperature unit" options="${UNITS}"></ui-select>`;

const ROW = `
<style>
  #row { display: flex; align-items: center; gap: 18px; inline-size: 420px; }
  #row .label { flex: none; inline-size: 320px; }
  #row ui-select { inline-size: 260px; }
</style>
<div id="row">
  <span class="label">Temperature unit</span>
  <ui-select id="a" label="Temperature unit" options="${UNITS}"></ui-select>
  <ui-select id="b" label="Log level" options="${LONG}"></ui-select>
</div>`;

/* The same control inside a box narrower than its own content. */
const BOXED = `
<style>
  #narrow { inline-size: 240px; }
  #roomy  { inline-size: 600px; }
</style>
<div id="narrow"><ui-select id="squeezed" label="Log level" options="${LONG}"></ui-select></div>
<div id="roomy"><ui-select id="free" label="Log level" options="${LONG}"></ui-select></div>`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const px = (value) => parseFloat(value);

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-select @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (markup, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });
        const one = (fn) => mounted(MARKUP, fn);

        test('the emulated geometry is the one the suite asked for', () => one(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('drill: --ui-control-h moves the control height', () => one(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: 'ui-select >>> #control',
                property: 'min-block-size',
            });
            assert.equal(drill.after, '91px');

            const box = await page.box('ui-select >>> #control');
            assert.equal(box.height, 64, 'the resting height is --ui-control-h itself');
        }));

        test('drill: --ui-key moves the control face', () => one(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: 'ui-select >>> #control',
                property: 'background-color',
            });
        }));

        test('drill: --ui-text moves the control ink', () => one(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: 'ui-select >>> #control',
                property: 'color',
            });
        }));

        test('drill: --ui-line moves the control edge', () => one(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: 'ui-select >>> #control',
                property: 'border-top-color',
            });
        }));

        test('the measured resting appearance is the oracle\'s, through tokens', () => one(async (page) => {
            const got = await page.computed('ui-select >>> #control', [
                'border-top-width', 'border-top-left-radius', 'font-size', 'font-weight',
                'padding-left', 'box-shadow', 'opacity', 'appearance',
            ]);
            assert.equal(
                px(got['border-top-width']),
                px(await page.resolveToken('--ui-border-w', 'padding-left')),
            );
            assert.equal(got['border-top-left-radius'], await page.resolveToken('--ui-radius', 'border-top-left-radius'));
            assert.equal(got['font-size'], await page.resolveToken('--ui-text-base', 'font-size'));
            assert.equal(got['font-weight'], await page.resolveToken('--ui-weight-regular', 'font-weight'));
            assert.equal(got['padding-left'], await page.resolveToken('--ui-space-4', 'padding-left'));
            assert.equal(got['box-shadow'], 'none', 'the oracle reads no shadow on a select');
            assert.equal(px(got.opacity), 1);
            assert.equal(got.appearance, 'none', 'the platform chrome is suppressed, or there are two carets');
        }));

        test('the type is inherited, not restated, and no face is declared here', () => one(async (page) => {
            const control = await page.prop('ui-select >>> #control', 'font-family');
            const document_ = await page.resolveToken('--ui-font-family', 'font-family');
            assert.equal(control, document_);
        }));

        test('both themes are painted, and from the same token names', () => one(async (page) => {
            const props = ['background-color', 'color', 'border-top-color'];
            const read = async () => ({
                got: await page.computed('ui-select >>> #control', props),
                key: await page.resolveToken('--ui-key', 'background-color'),
                text: await page.resolveToken('--ui-text', 'color'),
                line: await page.resolveToken('--ui-line', 'border-top-color'),
            });

            await page.setTheme('light');
            const light = await read();
            await page.setTheme('dark');
            const dark = await read();

            for (const state of [light, dark]) {
                assert.equal(state.got['background-color'], state.key);
                assert.equal(state.got.color, state.text);
                assert.equal(state.got['border-top-color'], state.line);
            }
            assert.notDeepEqual(dark.got, light.got, 'the theme stamp moved nothing - a literal is hiding somewhere');
        }));

        test('drill: --ui-muted moves the caret ink', () => one(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: 'ui-select >>> #control',
                property: 'background-image',
                // A colour is not itself a background-image; the shape check is below.
                expectLanding: false,
            });
            assert.ok(
                drill.after.includes(DRILL_COLOUR),
                `the caret does not read --ui-muted: ${drill.after}`,
            );
            assert.equal(
                (drill.after.match(/linear-gradient/g) ?? []).length, 2,
                'the caret is still two gradients - no asset, no data URI',
            );
        }));

        test('the caret geometry is derived from two numbers, not six', () => one(async (page) => {
            const got = await page.computed('ui-select >>> #control', [
                'background-size', 'background-repeat', 'background-position', 'padding-right',
            ]);
            assert.equal(got['background-size'], '7px 7px, 7px 7px');
            // One value per layer, so Chrome serialises the repeat twice.
            assert.equal(got['background-repeat'], 'no-repeat, no-repeat');

            const space = px(await page.resolveToken('--ui-space-4', 'padding-left'));
            assert.equal(px(got['padding-right']), space + 2 * 7 - 1 + space);

            const outer = space + 7 - 1;
            const inner = space;
            assert.equal(
                got['background-position'],
                `calc(100% - ${outer}px) 50%, calc(100% - ${inner}px) 50%`,
                'the two layers are placed from the SAME two numbers the band is derived from',
            );
            assert.equal(outer, inner + 7 - 1);
        }));

        test('both caret layers are painted INSIDE the control, in the band they reserve', () => one(async (page) => {
            const box = await page.box('ui-select >>> #control');
            const paint = await page.computed('ui-select >>> #control', [
                'background-position-x', 'padding-right',
            ]);
            const offsets = paint['background-position-x'].split(',').map((layer) => {
                const m = /calc\(100% - ([\d.]+)px\)/.exec(layer.trim());
                assert.ok(m, `a caret layer is not an inset from the trailing edge: ${layer}`);
                return parseFloat(m[1]);
            });
            assert.equal(offsets.length, 2, 'two gradient layers, two positions');
            for (const offset of offsets) {
                assert.ok(offset > 0, `a caret layer is painted outside the trailing edge: ${offset}`);
                assert.ok(
                    offset + 7 <= px(paint['padding-right']),
                    `the glyph overruns the band reserved for it: ${offset} + 7 vs ${paint['padding-right']}`,
                );
                assert.ok(offset < box.width, 'a caret layer is painted off the leading edge');
            }
            assert.ok(offsets[0] > offsets[1], 'the layers are ordered outer tile then inner tile');
        }));

        test('the caret overlap does NOT follow --ui-hairline', () => one(async (page) => {
            const before = await page.computed('ui-select >>> #control', [
                'padding-right', 'background-position', 'background-size', 'border-top-width',
            ]);
            await page.setToken('--ui-hairline', '3px');
            const during = await page.computed('ui-select >>> #control', [
                'padding-right', 'background-position', 'background-size', 'border-top-width',
            ]);
            await page.setToken('--ui-hairline', null);

            assert.equal(
                px(during['border-top-width']), 3,
                'the hairline token must still reach the border through --ui-border-w',
            );
            assert.equal(
                during['padding-right'], before['padding-right'],
                'the caret band moved with --ui-hairline: the overlap is spelled as the hairline token',
            );
            assert.equal(during['background-position'], before['background-position']);
            assert.equal(during['background-size'], before['background-size']);
        }));

        test('retargeting --ui-space-4 moves the caret and the text inset together', () => one(async (page) => {
            const probe = ['padding-left', 'padding-right', 'background-position'];
            const before = await page.computed('ui-select >>> #control', probe);
            await page.setToken('--ui-space-4', '30px');
            const after = await page.computed('ui-select >>> #control', probe);
            await page.setToken('--ui-space-4', null);
            const restored = await page.computed('ui-select >>> #control', probe);

            assert.equal(px(after['padding-left']), 30);
            assert.equal(px(after['padding-right']), 30 + 13 + 30, 'the caret band moved with the token');
            assert.equal(
                after['background-position'], 'calc(100% - 36px) 50%, calc(100% - 30px) 50%',
                'the reserved band moved but the chevron did not - two owners for one number',
            );
            assert.deepEqual(restored, before, 'the drill restores - the value is read, not copied');
        }));

        test('the caret sits inside the control, clear of the text', () => one(async (page) => {
            const got = await page.computed('ui-select >>> #control', ['padding-right']);
            const space = px(await page.resolveToken('--ui-space-4', 'padding-left'));
            const band = space + 2 * 7 - 1;
            assert.ok(px(got['padding-right']) >= band, 'the text would overlap the caret');
        }));

        test('T9: a stated width is HELD in a squeezing flex row', () => mounted(ROW, async (page) => {
            const shrink = await page.prop('#a', 'flex-shrink');
            assert.equal(px(shrink), 0, 'T9: the host is a shrinkable flex item again');

            for (const id of ['#a', '#b']) {
                const host = await page.box(id);
                assert.equal(
                    host.width, 260,
                    `T9: ${id} did not hold its stated 260px - measured ${host.width}`,
                );
                const control = await page.box(`${id} >>> #control`);
                assert.equal(control.width, 260, `T9: ${id}'s control does not fill the stated box`);
            }
        }));

        test('T9: two selects stating one width render one number', () => mounted(ROW, async (page) => {
            const a = await page.box('#a');
            const b = await page.box('#b');
            assert.equal(a.width, b.width, `two stated 260px selects rendered ${a.width} and ${b.width}`);
        }));

        test('T9: the stated width survives a token change that resizes the caret', () => mounted(ROW, async (page) => {
            await page.setToken('--ui-space-4', '40px');
            const held = await page.box('#a');
            await page.setToken('--ui-space-4', null);
            assert.equal(held.width, 260);
        }));

        test('the focus ring is the token ring, unclipped, outset', () => one(async (page) => {
            const g = await assertFocusUnclipped(page, 'ui-select >>> #control');
            assert.equal(
                g.outlineOffset,
                await page.resolveToken('--ui-focus-offset', 'outline-offset'),
                'the outset offset - nothing in this component clips, so nothing needs inset',
            );
            assert.deepEqual(g.clippers, [], 'L24: a select in an open row has no clipping ancestor');
        }));

        test('drill: --ui-steel moves the focus ring, and there is only one', () => one(async (page) => {
            const sel = 'ui-select >>> #control';
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: sel,
                property: 'outline-color',
                prepare: (p) => p.focusVisible(sel),
            });
            // The host must not paint a second ring behind the control's own.
            await page.focusVisible(sel);
            const host = await page.computed('ui-select', ['outline-style']);
            assert.equal(host['outline-style'], 'none', 'two rings on one control (spec section 3.6)');
        }));

        test('focus() lands on the control, so there is one ring and one target', () => one(async (page) => {
            const landed = await page.evalFn(() => {
                window.__h.need('#units').focus();
                const root = window.__h.need('#units').shadowRoot;
                return root.activeElement ? root.activeElement.id : null;
            });
            assert.equal(landed, 'control');
        }));

        test('the control clamps to its own container, not to the window', () => mounted(BOXED, async (page) => {
            const squeezed = await page.box('#squeezed');
            const free = await page.box('#free');

            assert.ok(squeezed.width <= 240.5, `overflowed its 240px box: ${squeezed.width}`);
            assert.ok(free.width > 240.5, `the roomy box should show the full control: ${free.width}`);

            const box = await page.box('#narrow');
            const control = await page.box('#squeezed >>> #control');
            assert.ok(
                control.right <= box.right + 0.5,
                `the control paints outside its container: ${control.right} vs ${box.right}`,
            );
        }));

        test('the control never falls below the hit floor', () => one(async (page) => {
            const floor = px(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box('ui-select >>> #control');
            assert.ok(box.height >= floor, `${box.height}px against a ${floor}px floor`);
        }));

        test('the control carries an accessible name and the native role', () => one(async (page) => {
            const state = await page.evalFn(() => {
                const control = window.__h.need('ui-select >>> #control');
                return {
                    tag: control.tagName.toLowerCase(),
                    name: control.getAttribute('aria-label'),
                    options: [...control.options].map((o) => o.textContent.trim()),
                };
            });
            assert.equal(state.tag, 'select', 'a native select, styled - not a re-implementation');
            assert.equal(state.name, 'Temperature unit');
            assert.deepEqual(state.options, ['Celsius (°C)', 'Fahrenheit (°F)']);
        }));

        test('an unnamed select carries no empty aria-label', () => browser.withPage({ geometry }, async (page) => {
            await page.mount('<ui-select id="bare" options="[&quot;a&quot;,&quot;b&quot;]"></ui-select>', MODULE);
            assert.deepEqual(page.pageErrors, []);
            const has = await page.evalFn(
                () => window.__h.need('#bare >>> #control').hasAttribute('aria-label'),
            );
            assert.equal(has, false);
        }));

        test('the value round trips and change crosses the shadow boundary', () => one(async (page) => {
            const initial = await page.evalFn(() => window.__h.need('#units').value);
            assert.equal(initial, 'Celsius (°C)', 'the value is adopted from the control at first render');

            await page.recordEvents('#units', ['change']);
            await page.evalFn(() => {
                const control = window.__h.need('ui-select >>> #control');
                control.value = 'Fahrenheit (°F)';
                control.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await page.settle(1);

            const events = await page.recordedEvents();
            assert.equal(events.length, 1, 'exactly one change reaches the host - native change is not composed');
            assert.deepEqual(events[0].detail, { value: 'Fahrenheit (°F)' });
            assert.equal(await page.evalFn(() => window.__h.need('#units').value), 'Fahrenheit (°F)');
        }));

        test('options assigned as a PROPERTY after mount still set the value', () => browser.withPage({ geometry }, async (page) => {
            await page.mount('<ui-select id="late" label="Temperature unit"></ui-select>', MODULE);
            assert.deepEqual(page.pageErrors, []);

            const empty = await page.evalFn(() => ({
                host: window.__h.need('#late').value,
                options: window.__h.need('#late >>> #control').options.length,
            }));
            assert.deepEqual(empty, { host: '', options: 0 }, 'nothing to adopt yet, and no invented value');

            const after = await page.evalFn(async () => {
                const el = window.__h.need('#late');
                el.options = ['Celsius (°C)', 'Fahrenheit (°F)'];
                await el.updateComplete;
                await el.updateComplete;
                const control = el.shadowRoot.getElementById('control');
                return { host: el.value, control: control.value, index: control.selectedIndex };
            });
            assert.deepEqual(
                after,
                { host: 'Celsius (°C)', control: 'Celsius (°C)', index: 0 },
                'the host must report what the control displays and would submit',
            );
        }));

        test('a value stated BEFORE a late option list still wins', () => browser.withPage({ geometry }, async (page) => {
            await page.mount('<ui-select id="late2" value="Fahrenheit (°F)"></ui-select>', MODULE);
            assert.deepEqual(page.pageErrors, []);
            const after = await page.evalFn(async () => {
                const el = window.__h.need('#late2');
                el.options = ['Celsius (°C)', 'Fahrenheit (°F)'];
                await el.updateComplete;
                await el.updateComplete;
                const control = el.shadowRoot.getElementById('control');
                return { host: el.value, control: control.value, index: control.selectedIndex };
            });
            assert.deepEqual(after, { host: 'Fahrenheit (°F)', control: 'Fahrenheit (°F)', index: 1 });
        }));

        test('a stated value selects that option, whatever order the parts commit in', () => browser.withPage({ geometry }, async (page) => {
            await page.mount(
                `<ui-select id="preset" value="Fahrenheit (°F)" options="${UNITS}"></ui-select>`,
                MODULE,
            );
            assert.deepEqual(page.pageErrors, []);
            const chosen = await page.evalFn(() => {
                const control = window.__h.need('#preset >>> #control');
                return { value: control.value, index: control.selectedIndex };
            });
            assert.deepEqual(chosen, { value: 'Fahrenheit (°F)', index: 1 });
        }));

        test('the disabled dial is painted once, not compounded', () => browser.withPage({ geometry }, async (page) => {
            await page.mount(
                `<ui-select id="off" disabled label="Log level" options="${UNITS}"></ui-select>`
                + `<ui-select id="on" label="Log level" options="${UNITS}"></ui-select>`,
                MODULE,
            );
            assert.deepEqual(page.pageErrors, []);
            const dial = px(await page.resolveToken('--ui-opacity-disabled', 'opacity'));

            assert.equal(px(await page.prop('#on', 'opacity')), 1);
            assert.equal(px(await page.prop('#off', 'opacity')), dial, 'the host takes the dial');
            assert.equal(
                px(await page.prop('#off >>> #control', 'opacity')), 1,
                `the control must not take it a second time - ${dial} x ${dial} is a control `
                + 'three times fainter than every other disabled control in the skin',
            );
            assert.equal(
                await page.evalFn(() => window.__h.need('#off >>> #control').disabled), true,
                'paint is not the same as behaviour: the native attribute is what stops input',
            );
        }));

        test('this primitive invents no selection treatment', () => one(async (page) => {
            const before = await page.computed('ui-select >>> #control', ['background-color', 'color', 'box-shadow']);
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', '37px');
            const during = await page.computed('ui-select >>> #control', ['background-color', 'color', 'box-shadow']);
            for (const token of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led']) {
                await page.setToken(token, null);
            }
            assert.deepEqual(during, before, 'the four dials must not reach this component');
        }));
    });
}

test('the bench and the floor render the same control', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(ROW, MODULE);
        return {
            dpr: await page.eval('devicePixelRatio'),
            stated: (await page.box('#a')).width,
            height: (await page.box('#a >>> #control')).height,
            padRight: await page.prop('#a >>> #control', 'padding-right'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.equal(bench.stated, floor.stated, 'T9: a stated width does not depend on the window');
    assert.equal(bench.height, floor.height, 'the control height is a token - 64px at both');
    assert.equal(bench.padRight, floor.padRight, 'the caret band is a token derivation, not a fraction');
});
