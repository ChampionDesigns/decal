/**
 * ui-progress-track.render.test.mjs — Wave 1 item #17's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles and box geometry only, never
 * source text, at BOTH standard geometries — 1281x801 @ dsf 1.5 and the 1000x600
 * floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. This row carries no bug ids and the oracle has
 * no record of the element at all —
 *
 *   $ prov_query.py find --cls slate-progress-track
 *   searched  49 state(s) ... found 0 element(s) in 0 state(s)
 *   "The corpus has no answer for this element: read the Slate source read-only"
 *
 * — because the bar only exists while phase === 'downloading' and no capture was
 * taken mid-download. So the usual "match the measurement" gate has nothing to
 * bite on, and the two things that CAN go wrong here are both invisible to a
 * screenshot:
 *
 *   1. A fill nobody can see. Slate's fill class computes to --ui-primary
 *      (CITE settings-help-send-feedback #feedback-submit-btn [i=65]
 *      background-color = rgb(23, 59, 77) <- slate-components.css
 *      `.slate-accent-bg` authored `var(--slate-primary)` !important=yes), which
 *      against this component's trough is 1.11:1 in the dark theme. A dark
 *      capture of that renders as a bar with no fill — indistinguishable from a
 *      download that has not started. The contrast tests below are the only
 *      mechanism that can tell those two apart, and they run in BOTH themes.
 *   2. A fraction that is right at one width and wrong at another. The bar is
 *      the only wave-1 primitive whose paint is a percentage of its container,
 *      so the container tests assert the RATIO, not a pixel count.
 *
 * And a third, added after review: a bar with NO container inline size to fill.
 * The container block below asserts both halves of that — the bar takes what it
 * is given, and renders 0 when it is given nothing — because a test that hands
 * the host `flex-grow: 1` before measuring is asserting the fixture, not the
 * component.
 *
 * Everything else is the source read, quoted at its assertion:
 *   settings.js:6240              w-full, h-[10px], overflow-hidden, duration-200
 *   slate-components.css:723-726  border-radius var(--slate-radius);
 *                                 background-color var(--slate-key-on) !important
 *
 * Colours are asserted against the RESOLVED TOKEN, never a hex, so every
 * assertion is true in both themes.
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

/**
 * MEASURE THE SETTLED STATE, NOT THE FLIGHT. The fill transitions at
 * --ui-dur-slow (200ms) — Slate's own `transition-[width] duration-200`, which
 * this component is the first to actually run (settings.js re-renders the panel
 * with innerHTML, so every frame there is a brand-new div and the transition can
 * never fire). A drill or a value change therefore leaves 200ms in which every
 * width read is an interpolated number. Sleeping would work and would be flaky;
 * instead the page is put into prefers-reduced-motion: reduce, which this
 * component honours. The two motion tests at the end run with no emulation, so
 * the transition is real there and nowhere else.
 */
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

        /* ================================================================
         * THE SOURCE READ, REPRODUCED. The oracle is silent (0 elements in 49
         * states), so these are quoted from the Slate source, read-only.
         * ============================================================== */

        test('the trough is 10px tall, DERIVED from --ui-space-2 + 2 x --ui-hairline', () => mounted(async (page) => {
            const px = async (v) => parseFloat(await page.resolveValue(v, 'width'));
            const space2 = await px('var(--ui-space-2)');
            const hairline = await px('var(--ui-hairline)');

            const track = await page.box('#mid >>> .track');
            near(track.height, space2 + 2 * hairline, 'thickness is the derivation, not a literal');
            // SOURCE settings.js:6240 — class h-[10px] on .slate-progress-track.
            near(track.height, 10, 'SOURCE settings.js:6240 h-[10px]');
            // The fill spans the whole thickness: SOURCE h-full on the inner div.
            const fill = await page.box('#mid >>> .fill');
            near(fill.height, track.height, 'SOURCE settings.js:6240 inner div class h-full');
        }));

        test('the trough is --ui-key-on at --ui-radius', () => mounted(async (page) => {
            const track = await page.computed('#mid >>> .track', [
                'background-color', 'border-top-left-radius', 'border-bottom-right-radius',
            ]);
            assert.equal(
                track['background-color'],
                await page.resolveToken('--ui-key-on', 'background-color'),
                'SOURCE slate-components.css:723-726 .slate-progress-track background-color: '
                + 'var(--slate-key-on) !important — the token carried, the !important dropped',
            );
            const radius = await page.resolveValue('var(--ui-radius)', 'border-top-left-radius');
            assert.equal(track['border-top-left-radius'], radius,
                'SOURCE slate-components.css:724 border-radius: var(--slate-radius)');
            assert.equal(track['border-bottom-right-radius'], radius, 'all four corners, one token');
        }));

        test('the fill carries no radius of its own — the trough clips it', () => mounted(async (page) => {
            // SOURCE settings.js:6240 puts overflow-hidden on the trough and no radius
            // on the fill, so a part-filled bar has one rounded end and one square one.
            // A radius on the fill would round BOTH ends and read as a pill floating in
            // a trough. Here the clip is `overflow: clip` rather than `hidden` (no scroll
            // container for a region that can never scroll, spec §2.4).
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
                'CITE themes live-ready #shot-rating-slider [i=157] background-image: '
                + 'dark linear-gradient(to right, rgb(176, 196, 206) 0%, ... rgb(58, 72, 82) 100%) / '
                + 'light linear-gradient(to right, rgb(49, 92, 112) 0%, ... rgb(203, 208, 211) 100%) '
                + 'DIFF <- slate-live.css `#main-page .slate-rate-slider` — dark rgb(176,196,206) and '
                + 'light rgb(49,92,112) are both --ui-steel, so the FILL of a filled track is the token, '
                + 'in both themes',
            );
        }));

        /* ================================================================
         * THE VALUE. A percentage of the trough, in the author's own units.
         * ============================================================== */

        test('the fill is value/max of the trough', () => mounted(async (page) => {
            near(await fraction(page, '#empty'), 0, 'value=0 paints nothing', 0.002);
            near(await fraction(page, '#mid'), 0.42, 'value=0.42 of max=1', 0.002);
            near(await fraction(page, '#full'), 1, 'value=1 fills the trough', 0.002);
        }));

        test('the limit arrives from outside: 42/100 and 0.42/1 are one fraction', () => mounted(async (page) => {
            // Part 10 §12 — "Ranges/limits arrive as attributes/properties from
            // outside; a primitive never owns them."
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

        /* ================================================================
         * THE UNCATALOGUED DEFECT THIS COMPONENT DOES NOT REPRODUCE.
         *
         * §7 has no progress-bar bug because no capture ever caught the bar on
         * screen — not because the bar is clean. Slate's fill class is
         * .slate-accent-bg = var(--slate-primary), which against .slate-progress-
         * track's var(--slate-key-on) is 1.11:1 in the dark theme: WCAG 1.4.11
         * asks 3:1 of any non-text part you must see to understand the control,
         * and the fill IS the control. Asserted in both themes, so the departure
         * cannot be undone without a red test.
         * ============================================================== */

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
                    // The measurement that decided it, re-taken here rather than quoted:
                    // if this ever comes out >= 3:1 the departure is no longer needed.
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

        /* ================================================================
         * STANDING ASSERTION 1 — TOKENS ARE CONSUMED, NOT COPIED.
         * ============================================================== */

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
            // The half a screenshot cannot see. A component shipping the literal
            // `block-size: 10px` renders pixel-identically today and does not move
            // here — which is the whole reason 10px is written as a calc.
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

        /* ================================================================
         * STANDING ASSERTION 4 — FOCUS GEOMETRY, UNCLIPPED (bug L24's class).
         *
         * A progressbar is not in the tab order and this component adds no
         * tabindex — but a screen may put focus on a live region, and the base
         * paints :host(:focus-visible) for every component. The point of the
         * test is L24 itself: the trough clips (overflow: clip) and the ring is
         * drawn on the HOST, outside that box, so the clip can never eat it.
         * ============================================================== */

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
            // [T22's class] A native <progress> is painted through per-engine
            // pseudo-elements, which is how Slate ended up with an un-overridden
            // Gecko thumb on its sliders. Two divs render the same in both engines.
            assert.equal(shape.natives, 0, 'no native progress element, so no per-engine pseudo paint [T22 class]');
            assert.equal(shape.focusable, 0, 'the accessible object is the host');
            assert.equal(shape.elements, 2, 'exactly a trough and a fill');
            assert.equal(shape.hostTabIndex, null, 'a progressbar is not in the tab order unless a screen puts it there');
        }));

        /* ================================================================
         * CONTAINER BEHAVIOUR — the bar is `w-full` (SOURCE settings.js:6240)
         * and reads its own CONTAINER, never the viewport (§2.1 Rule 1).
         * Responsive behaviour has no Slate answer (98.4% frozen).
         * ============================================================== */

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
            // Asserted as an absolute number at each geometry, so the two runs of
            // this describe block together prove the viewport is not read: 1281x801
            // @ dsf 1.5 and 1000x600 @ dsf 1 must both answer 320.
            await page.setStyle('#mount', { 'inline-size': '320px' });
            const track = await page.box('#mid >>> .track');
            near(track.width, 320, 'container-driven, at every viewport');
            near(track.height, 10, 'and the thickness is a constant');
            near(await fraction(page, '#mid'), 0.42, 'as is the fraction', 0.004);
        }));

        test('a bar TOLD to grow takes the leftover space, not zero and not the whole row', () => mounted(async (page) => {
            // T9 is "select.slate-select does not hold its stated 250px — it is a flex
            // item with default shrink. Measured 214 in one leaf and 250 two rows
            // below, inside a single screen" (spec §7, settings). A full-width bar has
            // the OPPOSITE obligation to a fixed-width select: it must take what it is
            // given. So what this asserts is the CONSUMER CONTRACT, named as such —
            // `flex-grow: 1` is the call site's declaration, not the component's, and
            // the next test is the other half of the same fact. Do not read the pass
            // here as "the bar cannot silently shrink": it can, if it is handed
            // nothing, and that is asserted below.
            await page.setStyle('#mount', { display: 'flex', 'inline-size': '400px' });
            await page.setStyle('#rigid', { 'inline-size': '150px', 'flex-shrink': '0' });
            await page.setStyle('#mid', { 'flex-grow': '1' });
            const track = await page.box('#mid >>> .track');
            near(track.width, 250, 'the bar took the 250px left over, not zero and not 400');
            near(await fraction(page, '#mid'), 0.42, 'and the fill is still 42% of it', 0.006);

            // AND `min-inline-size: 0` IS NOT WHAT DID IT, which is the T9 discriminator
            // itself: a select's min-content contribution is its widest option, and that
            // is what stops it shrinking to its stated track. This host carries
            // inline-size containment (base.js, CONVENTIONS §2), so its min-content
            // contribution is already 0 and the automatic minimum size cannot floor it.
            // Pinning the property to its own effective value must therefore change
            // nothing — if it ever does, the containment is gone.
            await page.setStyle('#mid', { 'min-inline-size': '0' });
            near((await page.box('#mid >>> .track')).width, 250,
                'min-inline-size: 0 changed the result, so the host is no longer size-contained');
        }, `${MID}<div id="rigid"></div>`));

        test('a bar given NOTHING to fill renders 0 wide — stated, in both flex axes', () => mounted(async (page) => {
            // THE OTHER HALF, and the one a consumer meets by accident. `container-type:
            // inline-size` on the host (base.js, CONVENTIONS §2: "the host's inline size
            // can no longer depend on its contents") means the host contributes ZERO to
            // intrinsic sizing, and `.track` is inline-size: 100% of the host
            // (ui-progress-track.js). So in any shrink-to-fit slot the bar is 0 wide:
            // present, correct, accessible and invisible.
            //
            // PINNED RATHER THAN "FIXED". A 10px indicator cannot invent a width nobody
            // gave it, and dropping the containment would not help — a 100%-wide child
            // of a shrink-to-fit box is still 0. The remedy is one declaration at the
            // call site and is asserted in each half below.

            // (a) COLUMN, align-items: flex-start. This is the LIVE USE SITE's own shape
            //     with one word changed: settings.js:6247 is `flex flex-col`, and it
            //     survives only because align-items defaults to stretch.
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

            // (b) ROW, a bare flex item. Now the inline axis is the MAIN axis, and the
            //     same containment zeroes the flex base size instead of the cross size.
            await page.setStyle('#mount', { 'flex-direction': 'row' });
            near((await page.box('#mid >>> .track')).width, 0,
                'row, no flex-grow — the flex base size is 0 for the same reason');
            await page.setStyle('#mid', { 'flex-grow': '1' });
            near((await page.box('#mid >>> .track')).width, 400, 'flex-grow: 1 restores it');
            near(await fraction(page, '#mid'), 0.42, 'with the fraction intact', 0.006);
        }, MID));

        test('no width query anywhere: the bar is identical in a fixed container at both geometries', () => mounted(async (page) => {
            // §2.1 Rule 1 as a measurement rather than a code review. If the file
            // carried @media (width...) the two describe blocks would disagree here.
            await page.setStyle('#mount', { 'inline-size': '500px' });
            const before = await page.box('#mid >>> .fill');
            await page.setGeometry({ ...geometry, width: 700, height: 500 });
            await page.settle(2);
            const after = await page.box('#mid >>> .fill');
            await page.setGeometry(geometry);
            near(after.width, before.width, 'the fill moved when only the VIEWPORT changed');
            near(after.height, before.height, 'so did the thickness');
        }));

        /* ================================================================
         * ARIA — spec Appendix 15. Accessibility state and visual state are the
         * SAME state, so they cannot drift.
         * ============================================================== */

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

        /* ================================================================
         * MOTION — real transitions, no emulation. SOURCE settings.js:6240
         * `transition-[width] duration-200`; 200ms is --ui-dur-slow (§3.7).
         * ============================================================== */

        test('the fill animates its inline size at --ui-dur-slow', () => animated(async (page) => {
            const slow = await page.resolveValue('var(--ui-dur-slow)', 'transition-duration');
            const style = await page.computed('#mid >>> .fill', [
                'transition-duration', 'transition-property', 'transition-timing-function',
            ]);
            assert.equal(style['transition-duration'], slow, 'SOURCE settings.js:6240 duration-200');
            assert.match(style['transition-property'], /inline-size|width/,
                'SOURCE settings.js:6240 transition-[width], written logically');
            assert.equal(
                style['transition-timing-function'],
                await page.resolveValue('var(--ui-ease)', 'transition-timing-function'),
                'the one easing token (§3.7)',
            );
            // And the trough does not animate: only the fill moves.
            assert.equal(await page.prop('#mid >>> .track', 'transition-duration'), '0s');
        }));

        test('the transition actually runs — the thing Slate authored and defeated', () => animated(async (page) => {
            // settings.js re-renders the whole panel with
            // `section.innerHTML = renderAppUpdateBlock(data)` on every state change,
            // so every frame of a download is a brand-new div starting at its final
            // width and `transition-[width] duration-200` can never fire. A Lit
            // element persists across updates, so it fires here for the first time.
            //
            // Asserted through the Web Animations API rather than by sampling a
            // width: a rect read taken right after the change measures t=0 of the
            // transition (0%, indistinguishable from no transition at all) and a
            // read taken later is a race with the 200ms. getAnimations() answers
            // "is a transition in flight on this property" with no timing at all.
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
                'the running transition is the fill\'s own size, SOURCE settings.js:6240 transition-[width]');
            assert.equal(running[0].duration, 200, 'at --ui-dur-slow, SOURCE duration-200');

            // And it lands. `settle()` waits on frames and updateComplete, not on a
            // 200ms transition — measured, it returns with the fill at 73% — so the
            // wait is the animation's own `finished`, never a sleep.
            await page.evalFn(async () => {
                const fill = document.getElementById('empty').shadowRoot.querySelector('.fill');
                await Promise.all(fill.getAnimations().map((a) => a.finished.catch(() => {})));
            });
            near(await fraction(page, '#empty'), 1, 'and it lands', 0.005);
        }));

        test('prefers-reduced-motion turns the animation off', () => mounted(async (page) => {
            // `mounted` already emulates reduce, which is why every other assertion
            // in this file reads a settled value.
            assert.equal(await page.prop('#mid >>> .fill', 'transition-duration'), '0s',
                'CONVENTIONS §11 — the animating component owns its own reduced-motion rule');
        }));

        /* ================================================================
         * THE GALLERY ENTRY, MOUNTED. Its shape is checked without a browser in
         * test/ui-progress-track-gallery-entry.test.mjs; this proves every state
         * it declares actually renders, at both geometries, before the GATE
         * agent wires it into entries.js.
         * ============================================================== */

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
