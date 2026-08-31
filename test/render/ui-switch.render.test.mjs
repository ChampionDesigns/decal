/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-switch.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-switch.js'];

const OFF = '<ui-switch id="off" aria-label="Cup warmer"></ui-switch>';
const ON = '<ui-switch id="on" checked aria-label="Wake lock"></ui-switch>';
const DISABLED = '<ui-switch id="dis" disabled aria-label="Stop at weight"></ui-switch>';
const MARKUP = `${OFF}${ON}${DISABLED}`;

async function reduceMotion(page) {
    await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await page.settle(1);
}

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The knob's offset from its host's left edge — the whole of in one number. */
async function knobDx(page, host) {
    const h = await page.box(host);
    const k = await page.box(`${host} >>> .knob`);
    return k.left - h.left;
}

async function knobDy(page, host) {
    const h = await page.box(host);
    const k = await page.box(`${host} >>> .knob`);
    return k.top - h.top;
}

/** The four geometry tokens as numbers, read from the page rather than assumed. */
async function switchTokens(page) {
    const px = async (name) => parseFloat(await page.resolveValue(`var(${name})`, 'width'));
    return {
        trackW: await px('--ui-switch-track-w'),
        trackH: await px('--ui-switch-track-h'),
        knob: await px('--ui-switch-knob'),
        inset: await px('--ui-switch-inset'),
        borderStrong: await px('--ui-border-w-strong'),
    };
}

const PAINT = [
    'background-color', 'border-top-color', 'border-top-width', 'border-top-style',
    'border-right-color', 'border-bottom-color', 'border-left-color',
    'width', 'height', 'opacity', 'box-shadow', 'text-shadow', 'color',
    'position', 'translate', 'inset-inline-start', 'inset-block-start',
    'transition-duration', 'transition-property',
];

const RADII = [
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
];

/** Paint + radii + box for one switch's two painted parts, by deep selector. */
async function switchSurface(page, sel) {
    return {
        host: await page.computed(sel, [...PAINT, ...RADII]),
        track: await page.computed(`${sel} >>> .track`, [...PAINT, ...RADII]),
        knob: await page.computed(`${sel} >>> .knob`, [...PAINT, ...RADII]),
        hostBox: await page.box(sel),
        knobBox: await page.box(`${sel} >>> .knob`),
        dx: await knobDx(page, sel),
    };
}

const paintOnly = (surface) => ({
    host: Object.fromEntries(PAINT.map((p) => [p, surface.host[p]])),
    track: Object.fromEntries(PAINT.map((p) => [p, surface.track[p]])),
    knob: Object.fromEntries(PAINT.map((p) => [p, surface.knob[p]])),
});

const radiiOnly = (surface) => ({
    track: Object.fromEntries(RADII.map((p) => [p, surface.track[p]])),
    knob: Object.fromEntries(RADII.map((p) => [p, surface.knob[p]])),
});

const derivedThrow = (t) => t.trackW - t.knob - 2 * t.inset - 2 * t.borderStrong;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-switch @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /** The two motion tests: real transitions, no emulation. */
        const animated = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, []);
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

        test('the host is the oracle\'s 100 × 50 track box', () => mounted(async (page) => {
            const t = await switchTokens(page);
            const box = await page.box('#off');
            near(box.width, t.trackW, 'host inline size is --ui-switch-track-w');
            near(box.height, t.trackH, 'host block size is --ui-switch-track-h');
            near(box.width, 100, 'ORACLE settings-display-wake-lock[46] width=100px');
            near(box.height, 50, 'ORACLE settings-display-wake-lock[46] height=50px');
        }));

        test('the knob is 40 × 40 at +5,+5 when off', () => mounted(async (page) => {
            const t = await switchTokens(page);
            const knob = await page.box('#off >>> .knob');
            near(knob.width, t.knob, 'knob inline size is --ui-switch-knob');
            near(knob.height, t.knob, 'knob block size is --ui-switch-knob');
            near(knob.width, 40, 'ORACLE settings-display-wake-lock[48] width=40px');

            near(await knobDx(page, '#off'), t.inset, 'off knob sits at --ui-switch-inset');
            near(await knobDx(page, '#off'), 5, 'ORACLE off knob measured dx=5 on 24 of 24');
            near(await knobDy(page, '#off'), (t.trackH - t.knob) / 2, 'knob is vertically centred');
            near(await knobDy(page, '#off'), 5, 'ORACLE knob dy=5');
        }));

        test('the checked knob has travelled the derived throw, landing on the oracle\'s dx=51', () => mounted(async (page) => {
            const t = await switchTokens(page);
            const dx = await knobDx(page, '#on');
            near(dx, t.inset + derivedThrow(t), 'checked dx is inset + derived throw');
            near(dx, 51, 'ORACLE checked knob measured dx=51 on 24 of 24 elements');
            // And the knob has not changed size or vertical position by moving.
            const knob = await page.box('#on >>> .knob');
            near(knob.width, t.knob, 'the knob does not resize when it travels');
            near(await knobDy(page, '#on'), 5, 'only the knob moves, and only sideways');
        }));

        test('the OFF track is --ui-key inside a --ui-line hairline at --ui-radius', () => mounted(async (page) => {
            const track = await page.computed('#off >>> .track', [
                'background-color', 'border-top-color', 'border-top-width', 'border-top-left-radius',
            ]);
            assert.equal(track['background-color'], await page.resolveToken('--ui-key', 'background-color'),
                'ORACLE settings-connection-scale .slate-switch track background-color=rgb(26, 33, 39) '
                + 'winning rule= {.slate-switch input[type="checkbox"] + div} authored `var(--slate-key)`');
            assert.equal(track['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'),
                'ORACLE same element border-top-color=rgb(58, 72, 82) authored `var(--slate-line)`');
            near(parseFloat(track['border-top-width']),
                parseFloat(await page.resolveValue('var(--ui-border-w)', 'width')),
                'ORACLE border-top-width=1px authored `var(--slate-hairline)`');
            assert.equal(track['border-top-left-radius'],
                await page.resolveValue('var(--ui-radius)', 'border-top-left-radius'),
                'ORACLE border-top-left-radius=6px authored `var(--slate-radius)` — square-cornered, '
                + 'not the `rounded-full` the markup asks for');
        }));

        test('the OFF knob is --ui-line-strong at --ui-radius-sm', () => mounted(async (page) => {
            const knob = await page.computed('#off >>> .knob', ['background-color', 'border-top-left-radius']);
            assert.equal(knob['background-color'], await page.resolveToken('--ui-line-strong', 'background-color'),
                'ORACLE knob background-color=rgb(82, 97, 107) winning rule= '
                + '{.slate-switch input[type="checkbox"] + div + div} authored `var(--slate-line-strong)`');
            assert.equal(knob['border-top-left-radius'],
                await page.resolveValue('var(--ui-radius-sm)', 'border-top-left-radius'),
                'ORACLE knob border-top-left-radius=4px authored `4px !important` — the token that number is');
        }));

        test('the ON track fills with --ui-primary and the knob turns --ui-on-primary', () => mounted(async (page) => {
            assert.equal(
                await page.prop('#on >>> .track', 'background-color'),
                await page.resolveToken('--ui-primary', 'background-color'),
                'ORACLE settings-display-wake-lock[47] background-color=rgb(23, 59, 77) winning rule='
                + '{.slate-switch input[type="checkbox"]:checked + div} authored `var(--slate-primary)`',
            );
            assert.equal(
                await page.prop('#on >>> .knob', 'background-color'),
                await page.resolveToken('--ui-on-primary', 'background-color'),
                'ORACLE settings-display-wake-lock[48] background-color=rgb(246, 251, 253) authored `var(--slate-on-primary)`',
            );
            assert.equal(
                await page.prop('#on >>> .track', 'border-top-color'),
                await page.resolveValue('color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel))', 'border-top-color'),
                'ORACLE settings-display-wake-lock[47] border-top-color=color(srgb 0.258196 0.381804 0.443608) '
                + 'authored `color-mix(in srgb, var(--slate-primary) 72%, var(--slate-steel))`',
            );
        }));

        test('polarity is fixed: only the track fills and only the knob moves', () => mounted(async (page) => {
            const offTrack = await page.box('#off >>> .track');
            const onTrack = await page.box('#on >>> .track');
            assert.deepEqual(
                [offTrack.width, offTrack.height], [onTrack.width, onTrack.height],
                'the track box must not change with state',
            );
            const offKnob = await page.box('#off >>> .knob');
            const onKnob = await page.box('#on >>> .knob');
            assert.deepEqual(
                [offKnob.width, offKnob.height], [onKnob.width, onKnob.height],
                'the knob box must not change with state — it travels, it does not grow',
            );
        }));

        test('drill: --ui-switch-track-w moves the track AND re-derives the throw [T17]', () => mounted(async (page) => {
            const t = await switchTokens(page);

            await assertTokenDrill(page, {
                token: '--ui-switch-track-w',
                value: '140px',
                selector: '#off',
                property: 'width',
            });

            await page.setToken('--ui-switch-track-w', '140px');
            const drilled = await knobDx(page, '#on');
            await page.setToken('--ui-switch-track-w', null);
            const restored = await knobDx(page, '#on');

            const expected = t.inset + derivedThrow({ ...t, trackW: 140 });
            near(drilled, expected, 'the throw did not re-derive from --ui-switch-track-w [T17]');
            near(drilled, 91, 'derived: 5 + (140 − 40 − 2×5 − 2×2)');
            near(restored, t.inset + derivedThrow(t), 'the drill did not restore');
        }));

        test('drill: --ui-switch-knob moves the knob AND re-derives the throw [T17]', () => mounted(async (page) => {
            const t = await switchTokens(page);

            await assertTokenDrill(page, {
                token: '--ui-switch-knob',
                value: '28px',
                selector: '#off >>> .knob',
                property: 'width',
            });

            await page.setToken('--ui-switch-knob', '28px');
            const drilled = await knobDx(page, '#on');
            await page.setToken('--ui-switch-knob', null);

            near(drilled, t.inset + derivedThrow({ ...t, knob: 28 }),
                'the throw did not re-derive from --ui-switch-knob [T17]');
            near(drilled, 63, 'derived: 5 + (100 − 28 − 2×5 − 2×2)');
        }));

        test('drill: --ui-switch-inset moves both ends of the travel [T17]', () => mounted(async (page) => {
            const t = await switchTokens(page);

            await page.setToken('--ui-switch-inset', '9px');
            const off = await knobDx(page, '#off');
            const on = await knobDx(page, '#on');
            await page.setToken('--ui-switch-inset', null);
            const restoredOff = await knobDx(page, '#off');

            near(off, 9, 'the resting inset is --ui-switch-inset');
            near(on, 9 + derivedThrow({ ...t, inset: 9 }), 'the throw did not re-derive from --ui-switch-inset [T17]');
            near(on, 47, 'derived: 9 + (100 − 40 − 2×9 − 2×2)');
            near(restoredOff, t.inset, 'the drill did not restore');
        }));

        test('drill: --ui-switch-track-h moves the box and keeps the knob centred', () => mounted(async (page) => {
            const t = await switchTokens(page);

            await assertTokenDrill(page, {
                token: '--ui-switch-track-h',
                value: '70px',
                selector: '#off',
                property: 'height',
            });

            await page.setToken('--ui-switch-track-h', '70px');
            const dy = await knobDy(page, '#off');
            await page.setToken('--ui-switch-track-h', null);

            near(dy, (70 - t.knob) / 2, 'the knob is centred by derivation, not by a literal offset');
            near(dy, 15, 'derived: (70 − 40) / 2');
        }));

        test('drill: the palette tokens move the paint in both states', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: '#off >>> .track',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-primary',
                value: DRILL_COLOUR,
                selector: '#on >>> .track',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong',
                value: DRILL_COLOUR,
                selector: '#off >>> .knob',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-on-primary',
                value: DRILL_COLOUR,
                selector: '#on >>> .knob',
                property: 'background-color',
            });
        }));

        test('[T17] the geometry has exactly ONE owner: all four tokens at once', () => mounted(async (page) => {
            const before = {
                host: await page.box('#off'),
                knob: await page.box('#off >>> .knob'),
                dxOff: await knobDx(page, '#off'),
                dxOn: await knobDx(page, '#on'),
            };

            await page.setToken('--ui-switch-track-w', '160px');
            await page.setToken('--ui-switch-track-h', '64px');
            await page.setToken('--ui-switch-knob', '48px');
            await page.setToken('--ui-switch-inset', '8px');

            const host = await page.box('#off');
            const knob = await page.box('#off >>> .knob');
            near(host.width, 160, 'track width');
            near(host.height, 64, 'track height');
            near(knob.width, 48, 'knob size');
            near(await knobDx(page, '#off'), 8, 'off inset');
            near(await knobDy(page, '#off'), 8, 'centred: (64 − 48) / 2');
            // 160 − 48 − 2×8 − 2×2 = 92, so the checked knob is at 8 + 92 = 100.
            near(await knobDx(page, '#on'), 100, 'the throw is arithmetic over all four tokens [T17]');

            for (const name of ['--ui-switch-track-w', '--ui-switch-track-h', '--ui-switch-knob', '--ui-switch-inset']) {
                await page.setToken(name, null);
            }
            near((await page.box('#off')).width, before.host.width, 'restore');
            near(await knobDx(page, '#on'), before.dxOn, 'restore');
        }));

        test('the focus ring is the token ring, unclipped, outset', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#off');
            assert.equal(
                g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                'the switch is not inside a clipping band, so it takes the outset offset',
            );
            assert.deepEqual(g.clippers, [], 'nothing clips a switch sitting in an open row');
        }));

        test('drill: --ui-steel moves the ring, so the ring is the ONE ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#off',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#off'),
            });
        }));

        test('the host takes focus at all — the control is the host, not a sealed input', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const el = document.getElementById('off');
                return { tabindex: el.getAttribute('tabindex'), inner: el.shadowRoot.querySelectorAll('input, button').length };
            });
            assert.equal(state.tabindex, '0');
            assert.equal(state.inner, 0,
                'nothing focusable inside: the accessible name has to come from the light DOM '
                + '(bug T15 — "four of twenty switches have no accessible name")');
        }));

        test('the switch is the same size in a 200px container and a 900px one', () => mounted(async (page) => {
            const read = async () => {
                const b = await page.box('#off');
                return [b.width, b.height, await knobDx(page, '#off')];
            };
            await page.setStyle('#mount', { 'inline-size': '200px' });
            const narrow = await read();
            await page.setStyle('#mount', { 'inline-size': '900px' });
            const wide = await read();
            assert.deepEqual(narrow, wide, 'a fixed control must not read its container either');
            near(narrow[0], 100, 'still the oracle 100px');
        }));

        test('a squeezed FLEX row cannot shrink it — the T9 failure mode, foreclosed', () => mounted(async (page) => {
            await page.setStyle('#mount', { display: 'flex', 'inline-size': '140px' });
            await page.setStyle('#pressure', { 'inline-size': '400px', 'flex-shrink': '0' });
            const box = await page.box('#off');
            near(box.width, 100, 'the switch held its width against 400px of sibling in a 140px row');
        }, `${MARKUP}<div id="pressure"></div>`));

        test('the whole control is the hit target and it clears --ui-hit-min', () => mounted(async (page) => {
            const hit = await assertHitFloor(page, '#off', { mode: 'element' });
            near(hit.inline, 100, 'the ink IS the hit box here — no overlay needed');
            near(hit.block, 50, '50 against a 48px floor');
            assert.ok(hit.inline >= hit.floor && hit.block >= hit.floor);
        }));

        test('role, aria-checked and the accessible name are all on the host', () => mounted(async (page) => {
            const a = await page.evalFn(() => {
                const off = document.getElementById('off');
                const on = document.getElementById('on');
                return {
                    role: off.getAttribute('role'),
                    offChecked: off.getAttribute('aria-checked'),
                    onChecked: on.getAttribute('aria-checked'),
                    label: off.getAttribute('aria-label'),
                };
            });
            assert.deepEqual(a, { role: 'switch', offChecked: 'false', onChecked: 'true', label: 'Cup warmer' });
        }));

        test('aria-checked and the paint move together, never separately', () => mounted(async (page) => {
            const face = async () => page.prop('#off >>> .track', 'background-color');
            const aria = async () => page.evalFn(() => document.getElementById('off').getAttribute('aria-checked'));

            const keyFace = await page.resolveToken('--ui-key', 'background-color');
            const primaryFace = await page.resolveToken('--ui-primary', 'background-color');

            assert.equal(await aria(), 'false');
            assert.equal(await face(), keyFace);

            await page.click('#off');
            assert.equal(await aria(), 'true', 'the aria state must follow the property');
            assert.equal(await face(), primaryFace, 'and so must the paint — one state, two readers');

            await page.click('#off');
            assert.equal(await aria(), 'false');
            assert.equal(await face(), keyFace);
        }));

        test('a disabled switch is dimmed, out of the tab order, and refuses input', () => mounted(async (page) => {
            const a = await page.evalFn(() => {
                const el = document.getElementById('dis');
                return { ariaDisabled: el.getAttribute('aria-disabled'), tabindex: el.getAttribute('tabindex') };
            });
            assert.deepEqual(a, { ariaDisabled: 'true', tabindex: '-1' });

            const dial = parseFloat(await page.resolveToken('--ui-opacity-disabled', 'opacity'));
            assert.equal(parseFloat(await page.prop('#dis', 'opacity')), dial,
                'the ONE disabled dial, on the host (CONVENTIONS §4)');

            await page.click('#dis');
            assert.equal(
                await page.evalFn(() => document.getElementById('dis').getAttribute('aria-checked')),
                'false',
                'a disabled control does not toggle',
            );
        }));

        test('a disabled switch that is re-parented returns to the tab order when enabled', () => mounted(async (page) => {
            const state = await page.evalFn(async () => {
                const el = document.getElementById('dis');
                const before = el.getAttribute('tabindex');
                document.getElementById('elsewhere').appendChild(el);   // re-parent
                el.disabled = false;
                await el.updateComplete;
                return {
                    whileDisabled: before,
                    afterMove: el.getAttribute('tabindex'),
                    ariaDisabled: el.getAttribute('aria-disabled'),
                    connected: el.isConnected,
                };
            });
            assert.deepEqual(state, {
                whileDisabled: '-1',
                afterMove: '0',
                ariaDisabled: null,
                connected: true,
            });
        }, `${MARKUP}<div id="elsewhere"></div>`));

        test('an owner\'s roving tabindex survives the next update (Appendix 10)', () => mounted(async (page) => {
            const state = await page.evalFn(async () => {
                const el = document.getElementById('off');
                el.setAttribute('tabindex', '-1');          // the owner rovers away
                el.checked = true;                          // any reactive update
                await el.updateComplete;
                const afterToggle = el.getAttribute('tabindex');

                el.setAttribute('tabindex', '0');           // the owner rovers back
                el.disabled = true;
                await el.updateComplete;
                const whileDisabled = el.getAttribute('tabindex');
                el.disabled = false;
                await el.updateComplete;
                return { afterToggle, whileDisabled, restored: el.getAttribute('tabindex') };
            });
            assert.deepEqual(state, { afterToggle: '-1', whileDisabled: '-1', restored: '0' },
                'the roving owner\'s number is adopted, suspended while disabled, and given back');
        }));

        test('a tabindex written in the markup is what disabled gives back', () => mounted(async (page) => {
            const state = await page.evalFn(async () => {
                const el = document.getElementById('rove');
                const initial = el.getAttribute('tabindex');
                el.disabled = true;
                await el.updateComplete;
                const off = el.getAttribute('tabindex');
                el.disabled = false;
                await el.updateComplete;
                return { initial, off, back: el.getAttribute('tabindex') };
            });
            assert.deepEqual(state, { initial: '-1', off: '-1', back: '-1' },
                'a switch parked at -1 by its author does not silently become tabbable');
        }, '<ui-switch id="rove" tabindex="-1" aria-label="Cup warmer"></ui-switch>'));

        test('disabled fades the switch as ONE object, not track and knob separately', () => mounted(async (page) => {
            assert.equal(parseFloat(await page.prop('#dis >>> .track', 'opacity')), 1,
                'the track must not carry its own fade');
            assert.equal(parseFloat(await page.prop('#dis >>> .knob', 'opacity')), 1,
                'nor the knob — one composite fade, on the host');
        }));

        test('drill: --ui-opacity-disabled is the only dial the fade reads', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.17',
                selector: '#dis',
                property: 'opacity',
            });
        }));

        test('a real click toggles, and says so with a change event', () => mounted(async (page) => {
            await page.recordEvents('#off', ['change']);
            await page.click('#off');
            const events = await page.recordedEvents();
            assert.equal(events.length, 1, 'exactly one change event per click');
            near(await knobDx(page, '#off'), 51, 'the knob travelled to the checked position');
        }));

        test('Space toggles from the keyboard', () => mounted(async (page) => {
            await page.focusVisible('#off');
            await page.press(' ');
            assert.equal(
                await page.evalFn(() => document.getElementById('off').getAttribute('aria-checked')),
                'true',
                'Space is the required key for role="switch"',
            );
        }));

        test('the travel and both fills run at --ui-dur-slow', () => animated(async (page) => {
            const slow = await page.resolveValue('var(--ui-dur-slow)', 'transition-duration');
            for (const sel of ['#off >>> .track', '#off >>> .knob']) {
                const d = await page.prop(sel, 'transition-duration');
                for (const one of d.split(',')) {
                    assert.equal(one.trim(), slow, `${sel} must animate at --ui-dur-slow, got ${d}`);
                }
            }
            assert.match(await page.prop('#off >>> .knob', 'transition-property'), /translate/,
                'the knob travels on the independent transform property');
        }));

        test('prefers-reduced-motion: reduce stops the animation, with no !important', () => animated(async (page) => {
            await reduceMotion(page);
            for (const sel of ['#off >>> .track', '#off >>> .knob']) {
                const d = await page.prop(sel, 'transition-duration');
                for (const one of d.split(',')) {
                    assert.equal(one.trim(), '0s', `${sel} still animates under reduced motion: ${d}`);
                }
            }
        }));

        test('the component paints with no !important anywhere in its own sheet', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('off').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const s = rule.style;
                        if (!s) continue;
                        for (let i = 0; i < s.length; i++) {
                            if (s.getPropertyPriority(s[i]) === 'important') hits.push(rule.selectorText + ' { ' + s[i] + ' }');
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));

        test('the pill is the corners and NOTHING else', () => browser.withPage({ geometry }, async (page) => {
            await page.mount(
                '<ui-switch id="pill" shape="pill" checked aria-label="Pill"></ui-switch>'
                + '<ui-switch id="plain" checked aria-label="Plain"></ui-switch>',
                MODULE,
            );
            await reduceMotion(page);

            const a = await switchSurface(page, '#pill');
            const b = await switchSurface(page, '#plain');

            assert.deepEqual(paintOnly(a), paintOnly(b),
                'shape="pill" changed something other than the corner — geometry, fill, '
                + 'travel and the disabled dial are all #5\'s and the attribute may not '
                + 'touch any of them');
            assert.deepEqual(
                [a.hostBox.width, a.hostBox.height, a.knobBox.width, a.knobBox.height, a.dx],
                [b.hostBox.width, b.hostBox.height, b.knobBox.width, b.knobBox.height, b.dx],
                'and no box moves either');
            assert.notDeepEqual(radiiOnly(a), radiiOnly(b),
                'the corner is the one difference there is; if it disappears the attribute '
                + 'is a no-op and should be deleted outright');

            const pillRadius = await page.resolveValue('var(--ui-radius-pill)', 'border-top-left-radius');
            for (const part of ['track', 'knob']) {
                for (const corner of RADII) {
                    assert.equal(a[part][corner], pillRadius,
                        `the pill's ${part} ${corner} is not --ui-radius-pill`);
                    assert.notEqual(a[part][corner], '2617.374px',
                        `'s machine-generated radius reached the ${part}`);
                }
            }
        }));

        test('removing the attribute restores 6/4, exactly — two hooks and not one',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<ui-switch id="pill" shape="pill" checked aria-label="Pill"></ui-switch>'
                    + '<ui-switch id="plain" checked aria-label="Plain"></ui-switch>',
                    MODULE,
                );
                await reduceMotion(page);
                await page.evalFn(() => { window.__h.need('#pill').shape = ''; });
                await page.settle(2);

                const a = await switchSurface(page, '#pill');
                const b = await switchSurface(page, '#plain');
                assert.deepEqual(radiiOnly(a), radiiOnly(b),
                    'the reversal is exact: the track goes back to --ui-radius and the knob '
                    + 'to --ui-radius-sm. A SINGLE shape hook renders the same pill and '
                    + 'reverses to 6/6 against this 6/4 — which is why there are two.');
                const track = await page.resolveValue('var(--ui-radius)', 'border-top-left-radius');
                const knob = await page.resolveValue('var(--ui-radius-sm)', 'border-top-left-radius');
                assert.equal(a.track['border-top-left-radius'], track);
                assert.equal(a.knob['border-top-left-radius'], knob);
                assert.notEqual(track, knob, 'the two tokens are a step apart — that is the point');
            }));

        test('an unknown shape is the plain switch, not a third look',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<ui-switch id="odd" shape="lozenge" checked aria-label="Odd"></ui-switch>'
                    + '<ui-switch id="plain" checked aria-label="Plain"></ui-switch>',
                    MODULE,
                );
                await reduceMotion(page);
                assert.deepEqual(
                    radiiOnly(await switchSurface(page, '#odd')),
                    radiiOnly(await switchSurface(page, '#plain')),
                    'only [shape="pill"] matches; anything else falls through to the default');
            }));
    });
}

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-switch', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-switch.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('every gallery state mounts and renders a switch', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-switch--${state.id} threw`);
            assert.ok(await page.count('ui-switch') >= 1, `gallery state ui-switch--${state.id} mounted nothing`);
            // hostStyle sizes the STAGE, not the component: the switch is unmoved.
            const box = await page.box('ui-switch');
            assert.deepEqual([box.width, box.height], [100, 50], `ui-switch--${state.id} is off-geometry`);
        }
    });
});

test('the switch renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        const host = await page.box('#off');
        return {
            dpr: await page.eval('devicePixelRatio'),
            width: host.width,
            height: host.height,
            dxOff: await knobDx(page, '#off'),
            dxOn: await knobDx(page, '#on'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        [bench.width, bench.height, bench.dxOff, bench.dxOn],
        [floor.width, floor.height, floor.dxOff, floor.dxOn],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same control',
    );
    assert.deepEqual([bench.width, bench.height, bench.dxOff, bench.dxOn], [100, 50, 5, 51],
        'and both are the oracle\'s measurement');
});
