/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-progress-track.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-progress-track.js'];

const EMPTY = '<ui-progress-track id="empty" value="0" label="Nothing yet"></ui-progress-track>';
const MID = '<ui-progress-track id="mid" value="0.42" value-text="42%" label="Downloading update"></ui-progress-track>';
const FULL = '<ui-progress-track id="full" value="1" label="Done"></ui-progress-track>';
const SCALED = '<ui-progress-track id="scaled" value="42" max="100" label="Downloading update"></ui-progress-track>';
const MARKUP = `${EMPTY}${MID}${FULL}${SCALED}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

async function reduceMotion(page) {
    await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await page.settle(1);
}

/** The fill's share of its own trough, 0..1 — the number the component exists to draw. */
async function fraction(page, host) {
    const track = await page.box(`${host} >>> .track`);
    const fill = await page.box(`${host} >>> .fill`);
    return track.width > 0 ? fill.width / track.width : 0;
}

/** WCAG 2.1 relative luminance, from a computed rgb()/rgba() string. */
function luminance(colour) {
    const parts = colour.match(/[\d.]+/g)?.map(Number) ?? [];
    assert.ok(parts.length >= 3, `not a colour this test can read: ${colour}`);
    const [r, g, b] = parts.slice(0, 3).map((c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two computed colour strings. */
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-progress-track @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /** No motion emulation: the two tests that assert the transition itself. */
        const animated = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
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

        test('the trough is 10px tall, DERIVED from --ui-space-2 + 2 x --ui-hairline', () => mounted(async (page) => {
            const px = async (v) => parseFloat(await page.resolveValue(v, 'width'));
            const space2 = await px('var(--ui-space-2)');
            const hairline = await px('var(--ui-hairline)');

            const track = await page.box('#mid >>> .track');
            near(track.height, space2 + 2 * hairline, 'thickness is the derivation, not a literal');
            near(track.height, 10, 'h-[10px]');
            const fill = await page.box('#mid >>> .fill');
            near(fill.height, track.height, 'inner div class h-full');
        }));

        test('the trough is --ui-key-on at --ui-radius', () => mounted(async (page) => {
            const track = await page.computed('#mid >>> .track', [
                'background-color', 'border-top-left-radius', 'border-bottom-right-radius',
            ]);
            assert.equal(
                track['background-color'],
                await page.resolveToken('--ui-key-on', 'background-color'),
                '.slate-progress-track background-color: '
                + 'var(--slate-key-on) !important — the token carried, the !important dropped',
            );
            const radius = await page.resolveValue('var(--ui-radius)', 'border-top-left-radius');
            assert.equal(track['border-top-left-radius'], radius,
                'border-radius: var(--slate-radius)');
            assert.equal(track['border-bottom-right-radius'], radius, 'all four corners, one token');
        }));

        test('the fill carries no radius of its own — the trough clips it', () => mounted(async (page) => {
            const fill = await page.computed('#mid >>> .fill', ['border-top-left-radius']);
            assert.equal(fill['border-top-left-radius'], '0px');
            const overflow = await page.computed('#mid >>> .track', ['overflow-x', 'overflow-y']);
            assert.deepEqual(overflow, { 'overflow-x': 'clip', 'overflow-y': 'clip' });

            const m = await page.metrics('#mid >>> .track');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                `the trough must never actually scroll: scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}`);
        }));

        test('the fill is --ui-steel — the oracle answer for a filled track in this skin', () => mounted(async (page) => {
            assert.equal(
                await page.prop('#mid >>> .fill', 'background-color'),
                await page.resolveToken('--ui-steel', 'background-color'),
                'themes live-ready #shot-rating-slider [i=157] background-image: '
                + 'dark linear-gradient(to right, rgb(176, 196, 206) 0%, ... rgb(58, 72, 82) 100%) / '
                + 'light linear-gradient(to right, rgb(49, 92, 112) 0%, ... rgb(203, 208, 211) 100%) '
                + 'DIFF <- `#main-page .slate-rate-slider` — dark rgb(176,196,206) and '
                + 'light rgb(49,92,112) are both --ui-steel, so the FILL of a filled track is the token, '
                + 'in both themes',
            );
        }));

        test('the fill is value/max of the trough', () => mounted(async (page) => {
            near(await fraction(page, '#empty'), 0, 'value=0 paints nothing', 0.002);
            near(await fraction(page, '#mid'), 0.42, 'value=0.42 of max=1', 0.002);
            near(await fraction(page, '#full'), 1, 'value=1 fills the trough', 0.002);
        }));

        test('the limit arrives from outside: 42/100 and 0.42/1 are one fraction', () => mounted(async (page) => {
            near(await fraction(page, '#scaled'), await fraction(page, '#mid'),
                'max is read, not assumed', 0.002);
        }));

        test('out-of-range values clamp instead of overflowing the trough', () => mounted(async (page) => {
            const markup = '<ui-progress-track id="over" value="9" max="1"></ui-progress-track>'
                + '<ui-progress-track id="under" value="-4" max="1"></ui-progress-track>'
                + '<ui-progress-track id="degenerate" value="3" max="0"></ui-progress-track>'
                + '<ui-progress-track id="junk" value="banana" max="1"></ui-progress-track>';
            await page.mount(markup, MODULE);
            near(await fraction(page, '#over'), 1, 'over-range clamps to full', 0.002);
            near(await fraction(page, '#under'), 0, 'negative clamps to empty', 0.002);
            near(await fraction(page, '#degenerate'), 0, 'a zero range reports zero, never NaN', 0.002);
            near(await fraction(page, '#junk'), 0, 'a non-number is zero, not a broken layout', 0.002);
            // And the trough itself never grows to accommodate an over-range fill.
            const track = await page.box('#over >>> .track');
            const fill = await page.box('#over >>> .fill');
            near(fill.width, track.width, 'the fill stops at the trough');
        }, EMPTY));

        for (const theme of ['dark', 'light']) {
            test(`[contrast] the fill reads against its trough in the ${theme} theme`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const fill = await page.prop('#mid >>> .fill', 'background-color');
                const trough = await page.prop('#mid >>> .track', 'background-color');
                const ratio = contrast(fill, trough);
                assert.ok(
                    ratio >= 3,
                    `${theme}: fill ${fill} on trough ${trough} is ${ratio.toFixed(2)}:1, under the 3:1 `
                    + 'floor for a non-text part (WCAG 1.4.11). Slate\'s own pairing — .slate-accent-bg '
                    + '(--ui-primary) on --ui-key-on — measures 1.11:1 in dark; that is the value this '
                    + 'assertion exists to keep out.',
                );
            }));

            test(`[contrast] --ui-primary is NOT what the fill uses (${theme})`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const fill = await page.prop('#mid >>> .fill', 'background-color');
                const primary = await page.resolveToken('--ui-primary', 'background-color');
                if (theme === 'dark') {
                    const trough = await page.prop('#mid >>> .track', 'background-color');
                    assert.ok(
                        contrast(primary, trough) < 3,
                        'the reason for the departure has gone away — --ui-primary now clears 3:1 '
                        + 'against --ui-key-on in dark, so revisit .fill in ui-progress-track.js',
                    );
                }
                assert.notEqual(fill, primary,
                    'the fill must not be the primary-action fill; see DEPARTURES 1');
            }));
        }

        test('drill: --ui-key-on moves the trough', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key-on',
                value: DRILL_COLOUR,
                selector: '#mid >>> .track',
                property: 'background-color',
            });
        }));

        test('drill: --ui-steel moves the fill', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#mid >>> .fill',
                property: 'background-color',
            });
        }));

        test('drill: --ui-radius moves the trough\'s corners', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '13px',
                selector: '#mid >>> .track',
                property: 'border-top-left-radius',
            });
        }));

        test('drill: the thickness re-derives from --ui-space-2 and --ui-hairline', () => mounted(async (page) => {
            const px = async (v) => parseFloat(await page.resolveValue(v, 'width'));
            const hairline = await px('var(--ui-hairline)');
            const before = (await page.box('#mid >>> .track')).height;

            await page.setToken('--ui-space-2', '30px');
            const onSpace = (await page.box('#mid >>> .track')).height;
            await page.setToken('--ui-space-2', null);

            await page.setToken('--ui-hairline', '5px');
            const onHairline = (await page.box('#mid >>> .track')).height;
            await page.setToken('--ui-hairline', null);

            const restored = (await page.box('#mid >>> .track')).height;

            near(onSpace, 30 + 2 * hairline, 'the ink term did not follow --ui-space-2');
            near(onSpace, 32, 'derived: 30 + 2 x 1');
            near(onHairline, 8 + 2 * 5, 'the trough term did not follow --ui-hairline');
            near(onHairline, 18, 'derived: 8 + 2 x 5');
            near(restored, before, 'the drill did not restore');
            near(restored, 10, 'back to the source read');
        }));

        test('drill: --ui-dur-slow owns the fill\'s timing', () => animated(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-dur-slow',
                value: '740ms',
                selector: '#mid >>> .fill',
                property: 'transition-duration',
                expected: '0.74s',
            });
        }));

        const FOCUSABLE = '<ui-progress-track id="focusable" tabindex="0" value="0.42" '
            + 'label="Downloading update"></ui-progress-track>';

        test('[L24] the ring is the token ring, outset, and nothing clips it', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#focusable');
            assert.equal(
                g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                'an open bar takes the outset offset',
            );
            assert.deepEqual(g.clippers, [],
                'the clipping box is the trough INSIDE the shadow root, and the ring is on the host');
        }, FOCUSABLE));

        test('[L24] focus-ring="inset" is available for a bar inside a clipping band', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#focusable');
            assert.equal(
                g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'one treatment, two offsets — the base attribute, not a second ring',
            );
        }, FOCUSABLE.replace('tabindex="0"', 'tabindex="0" focus-ring="inset"')));

        test('drill: --ui-steel moves the ring too, so there is ONE ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#focusable',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#focusable'),
            });
        }, FOCUSABLE));

        test('nothing inside the shadow root is focusable, and there is no native <progress>', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const el = document.getElementById('mid');
                const root = el.shadowRoot;
                return {
                    focusable: root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
                    natives: root.querySelectorAll('progress').length,
                    elements: root.querySelectorAll('*').length,
                    hostTabIndex: el.getAttribute('tabindex'),
                };
            });
            assert.equal(shape.natives, 0, 'no native progress element, so no per-engine pseudo paint [T22 class]');
            assert.equal(shape.focusable, 0, 'the accessible object is the host');
            assert.equal(shape.elements, 2, 'exactly a trough and a fill');
            assert.equal(shape.hostTabIndex, null, 'a progressbar is not in the tab order unless a screen puts it there');
        }));

        test('the trough fills its container and the fill holds its fraction', () => mounted(async (page) => {
            for (const width of [200, 320, 640, 900]) {
                await page.setStyle('#mount', { 'inline-size': `${width}px` });
                const track = await page.box('#mid >>> .track');
                near(track.width, width, `the trough is w-full at ${width}px`);
                near(await fraction(page, '#mid'), 0.42, `the fraction survives ${width}px`, 0.006);
                near(track.height, 10, 'the thickness does not respond to width');
            }
        }));

        test('the same container gives the same box at BOTH geometries', () => mounted(async (page) => {
            await page.setStyle('#mount', { 'inline-size': '320px' });
            const track = await page.box('#mid >>> .track');
            near(track.width, 320, 'container-driven, at every viewport');
            near(track.height, 10, 'and the thickness is a constant');
            near(await fraction(page, '#mid'), 0.42, 'as is the fraction', 0.004);
        }));

        test('a bar TOLD to grow takes the leftover space, not zero and not the whole row', () => mounted(async (page) => {
            await page.setStyle('#mount', { display: 'flex', 'inline-size': '400px' });
            await page.setStyle('#rigid', { 'inline-size': '150px', 'flex-shrink': '0' });
            await page.setStyle('#mid', { 'flex-grow': '1' });
            const track = await page.box('#mid >>> .track');
            near(track.width, 250, 'the bar took the 250px left over, not zero and not 400');
            near(await fraction(page, '#mid'), 0.42, 'and the fill is still 42% of it', 0.006);

            await page.setStyle('#mid', { 'min-inline-size': '0' });
            near((await page.box('#mid >>> .track')).width, 250,
                'min-inline-size: 0 changed the result, so the host is no longer size-contained');
        }, `${MID}<div id="rigid"></div>`));

        test('a bar given NOTHING to fill renders 0 wide — stated, in both flex axes', () => mounted(async (page) => {
            await page.setStyle('#mount', {
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'flex-start',
                'inline-size': '400px',
            });
            near((await page.box('#mid')).width, 0,
                'column + align-items: flex-start — the HOST is what has no inline size');
            near((await page.box('#mid >>> .track')).width, 0, 'so the bar is invisible');
            near((await page.box('#mid >>> .track')).height, 10,
                'the thickness is the component\'s own and survives the collapse');

            await page.setStyle('#mid', { 'align-self': 'stretch' });
            near((await page.box('#mid >>> .track')).width, 400, 'align-self: stretch restores it');
            near(await fraction(page, '#mid'), 0.42, 'with the fraction intact', 0.006);
            await page.setStyle('#mid', { 'align-self': null });

            await page.setStyle('#mount', { 'flex-direction': 'row' });
            near((await page.box('#mid >>> .track')).width, 0,
                'row, no flex-grow — the flex base size is 0 for the same reason');
            await page.setStyle('#mid', { 'flex-grow': '1' });
            near((await page.box('#mid >>> .track')).width, 400, 'flex-grow: 1 restores it');
            near(await fraction(page, '#mid'), 0.42, 'with the fraction intact', 0.006);
        }, MID));

        test('no width query anywhere: the bar is identical in a fixed container at both geometries', () => mounted(async (page) => {
            await page.setStyle('#mount', { 'inline-size': '500px' });
            const before = await page.box('#mid >>> .fill');
            await page.setGeometry({ ...geometry, width: 700, height: 500 });
            await page.settle(2);
            const after = await page.box('#mid >>> .fill');
            await page.setGeometry(geometry);
            near(after.width, before.width, 'the fill moved when only the VIEWPORT changed');
            near(after.height, before.height, 'so did the thickness');
        }));

        test('the host is the progressbar and carries the whole value contract', () => mounted(async (page) => {
            const a = await page.evalFn(() => {
                const read = (id) => {
                    const el = document.getElementById(id);
                    return {
                        role: el.getAttribute('role'),
                        min: el.getAttribute('aria-valuemin'),
                        max: el.getAttribute('aria-valuemax'),
                        now: el.getAttribute('aria-valuenow'),
                        text: el.getAttribute('aria-valuetext'),
                        label: el.getAttribute('aria-label'),
                    };
                };
                return { mid: read('mid'), scaled: read('scaled'), empty: read('empty') };
            });
            assert.deepEqual(a.mid, {
                role: 'progressbar', min: '0', max: '1', now: '0.42',
                text: '42%', label: 'Downloading update',
            });
            assert.deepEqual(a.scaled, {
                role: 'progressbar', min: '0', max: '100', now: '42',
                text: null, label: 'Downloading update',
            });
            assert.equal(a.empty.now, '0');
            assert.equal(a.empty.text, null, 'no aria-valuetext unless one was given');
        }));

        test('aria and the paint move together, never separately', () => mounted(async (page) => {
            const aria = () => page.evalFn(() => document.getElementById('mid').getAttribute('aria-valuenow'));

            assert.equal(await aria(), '0.42');
            near(await fraction(page, '#mid'), 0.42, 'starting point', 0.002);

            await page.evalFn(() => { document.getElementById('mid').value = 0.8; });
            await page.settle(2);
            assert.equal(await aria(), '0.8', 'the aria state must follow the property');
            near(await fraction(page, '#mid'), 0.8, 'and so must the paint — one state, two readers', 0.002);

            await page.evalFn(() => { document.getElementById('mid').max = 4; });
            await page.settle(2);
            assert.equal(await aria(), '0.8', 'the value did not change');
            assert.equal(
                await page.evalFn(() => document.getElementById('mid').getAttribute('aria-valuemax')),
                '4',
                'but the range did',
            );
            near(await fraction(page, '#mid'), 0.2, 'and the paint re-derived from it', 0.002);
        }));

        test('aria clamps exactly where the paint clamps', () => mounted(async (page) => {
            const a = await page.evalFn(() => {
                const el = document.getElementById('over');
                return { now: el.getAttribute('aria-valuenow'), max: el.getAttribute('aria-valuemax') };
            });
            assert.deepEqual(a, { now: '1', max: '1' },
                'a screen reader must not be told 9 of 1 while the bar shows full');
            near(await fraction(page, '#over'), 1, 'and the bar shows full', 0.002);
        }, '<ui-progress-track id="over" value="9" max="1"></ui-progress-track>'));

        test('an author\'s own aria-labelledby survives', () => mounted(async (page) => {
            // The reason the role lives on the host: a light-DOM heading can name it.
            const named = await page.evalFn(() => {
                const el = document.getElementById('named');
                return { by: el.getAttribute('aria-labelledby'), label: el.getAttribute('aria-label') };
            });
            assert.deepEqual(named, { by: 'panel-heading', label: null },
                'the component adds a name, it never replaces one');
        }, '<h2 id="panel-heading">App Update</h2>'
            + '<ui-progress-track id="named" aria-labelledby="panel-heading" value="0.4"></ui-progress-track>'));

        test('the fill animates its inline size at --ui-dur-slow', () => animated(async (page) => {
            const slow = await page.resolveValue('var(--ui-dur-slow)', 'transition-duration');
            const style = await page.computed('#mid >>> .fill', [
                'transition-duration', 'transition-property', 'transition-timing-function',
            ]);
            assert.equal(style['transition-duration'], slow, 'duration-200');
            assert.match(style['transition-property'], /inline-size|width/,
                'transition-[width], written logically');
            assert.equal(
                style['transition-timing-function'],
                await page.resolveValue('var(--ui-ease)', 'transition-timing-function'),
                'the one easing token (§3.7)',
            );
            // And the trough does not animate: only the fill moves.
            assert.equal(await page.prop('#mid >>> .track', 'transition-duration'), '0s');
        }));

        test('the transition actually runs — the thing Slate authored and defeated', () => animated(async (page) => {
            const running = await page.evalFn(async () => {
                const el = document.getElementById('empty');
                const fill = el.shadowRoot.querySelector('.fill');
                el.value = 1;
                await el.updateComplete;
                return fill.getAnimations().map((a) => ({
                    property: a.transitionProperty ?? null,
                    duration: a.effect?.getTiming?.().duration ?? null,
                }));
            });
            assert.equal(running.length, 1,
                `the fill jumped instead of animating (animations in flight: ${JSON.stringify(running)})`);
            assert.match(String(running[0].property), /inline-size|width/,
                'the running transition is the fill\'s own size transition-[width]');
            assert.equal(running[0].duration, 200, 'at --ui-dur-slow, duration-200');

            await page.evalFn(async () => {
                const fill = document.getElementById('empty').shadowRoot.querySelector('.fill');
                await Promise.all(fill.getAnimations().map((a) => a.finished.catch(() => {})));
            });
            near(await fraction(page, '#empty'), 1, 'and it lands', 0.005);
        }));

        test('prefers-reduced-motion turns the animation off', () => mounted(async (page) => {
            assert.equal(await page.prop('#mid >>> .fill', 'transition-duration'), '0s',
                'CONVENTIONS §11 — the animating component owns its own reduced-motion rule');
        }));

        test('every gallery state mounts and paints', () => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ${state.id} threw on mount`);
                const count = await page.count('ui-progress-track');
                assert.ok(count >= 1, `gallery state ${state.id} mounted no component`);
                const track = await page.box('ui-progress-track >>> .track');
                assert.ok(track.width > 0 && track.height > 0,
                    `gallery state ${state.id} rendered a zero-area trough`);
            }
        }));
    });
}
