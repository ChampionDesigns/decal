/**
 * ui-alert-banner.render.test.mjs — Gate A for component #49 (wave 1, item #49).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 floor — asserting only on computed style, box geometry and
 * behaviour, never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — nine tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token, plus the whole-palette drill that
 *      is L12's death certificate;
 *   2. focus geometry from --ui-focus-*, unclipped — on the host when a screen makes
 *      it focusable, and on a focusable slotted into the message;
 *   3. container behaviour at both geometries — the headline's clamp reads THIS
 *      component's container, reproducing the oracle's 52px at the oracle's 1375px
 *      and shrinking to its floor below that, identically at both viewports;
 *   4. the bugs asserted dead: L24 (rings clipped by the component they sit inside),
 *      L12 (a private palette shadowing the public one), and P8's family (a screen
 *      sheet reaching into a component and repainting it);
 *   5. the aria contract — role="alert" per Slate's own markup (index.html:271) and
 *      spec Appendix 15's aria-driven state contract, with the author's own role kept.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every
 * literal below carries its CITE line.
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

/* A slotted focusable, with the base's own focus ring re-created in the LIGHT tree —
 * `focusRing` from base.js, verbatim. The base's ring reaches focusables inside a
 * shadow tree; a node slotted in from the light tree is the consumer's own element and
 * keeps the consumer's styling, so the stand-in has to exist for the L24 case to be
 * about the banner rather than about the link.
 *
 * Written here rather than by slotting a real <ui-button>: "Sixteen entries, all
 * independent of each other" (SCOPE Part 4, Wave 1), and a suite that imports a
 * sibling builder's component makes this one red when theirs moves.
 */
const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    a.child { color: inherit; }
</style>`;

/* Slate's own disconnected alert, ui.js:3515:
 *   disconnected: ['Disconnected', 'Check the machine is powered on and paired.'] */
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

/* The oracle's own numbers, named once.
 *   CITE find --cls slate-live-alert → 3 element(s) in 3 state(s)
 *        (history-shotdata, live-pulling, modal-numpad), all 1375 x 130,
 *        <div id="live-alert" class="slate-live-alert" role="alert">
 *   CITE live-pulling #live-alert [i=92] background-color = rgb(14, 19, 23) dark /
 *        rgb(242, 243, 243) light  <-  slate-live.css `#main-page .slate-live-alert`
 *        authored `(NOT CAPTURED — set via a CSS shorthand)` !important=no
 *        (token-driven); the shorthand is `background: var(--slate-fascia)`
 *   CITE live-pulling #live-alert [i=92] gap = 4px  <-  authored `var(--slate-space-1)`
 *   CITE live-pulling #live-alert [i=92] padding-left = 28px  <-  the shorthand
 *        `padding: 0 var(--slate-space-6)`
 *   CITE live-pulling #live-alert [i=92] box-shadow = none, border-top-width = 0px,
 *        border-top-left-radius = 0px, opacity = 1  (themes table, both themes)
 *   CITE live-pulling #live-alert-state [i=93] font-size = 52px  <-  authored
 *        `var(--slate-display-xl)`;  color = rgb(230, 102, 97) dark /
 *        rgb(181, 28, 35) light  <-  authored `var(--slate-danger)`;
 *        font-weight = 500  <-  authored `var(--slate-weight-medium)`;
 *        height = 54.5938px  (= 52 × the 1.05 leading at slate-live.css:2046)
 *   CITE live-pulling #live-alert-remedy [i=94] font-size = 20px  <-  authored
 *        `var(--slate-text-lg)`;  color = rgb(186, 196, 202) dark /
 *        rgb(63, 71, 76) light  <-  authored `var(--slate-text-2)`;
 *        font-weight = 400  <-  (no declaration — inherited or initial value)
 */
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

/** At dsf 1.5 lengths snap to device pixels, so compare whole CSS px (CONVENTIONS §10). */
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

        /* -- 1. tokens are consumed, not copied ----------------------------- */

        test('drill: --ui-fascia is the ground', () => mounted(async (page) => {
            // ORACLE live-pulling #live-alert [i=92] background-color = rgb(14, 19, 23)
            //        <- slate-live.css `#main-page .slate-live-alert` via the shorthand
            //           `background: var(--slate-fascia)` (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#plain >>> #banner',
                property: 'background-color',
            });
        }));

        test('drill: --ui-status-danger is the headline ink', () => mounted(async (page) => {
            // ORACLE live-pulling #live-alert-state [i=93] color = rgb(230, 102, 97)
            //        <- slate-live.css `#main-page .slate-live-alert strong` authored
            //           `var(--slate-danger)` !important=no (token-driven)
            // styles/tokens.css cites THIS element as the source for the token.
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: '#plain >>> #headline',
                property: 'color',
            });
        }));

        test('drill: --ui-text-2 is the remedy ink', () => mounted(async (page) => {
            // ORACLE live-pulling #live-alert-remedy [i=94] color = rgb(186, 196, 202)
            //        <- slate-live.css `#main-page .slate-live-alert span` authored
            //           `var(--slate-text-2)` !important=no (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-text-2',
                value: DRILL_COLOUR,
                selector: '#plain >>> #remedy',
                property: 'color',
            });
        }));

        test('drill: --ui-display-xl is the headline size, --ui-text-lg the remedy size', () => mounted(async (page) => {
            // ORACLE ... [i=93] font-size = 52px <- authored `var(--slate-display-xl)`
            // ORACLE ... [i=94] font-size = 20px <- authored `var(--slate-text-lg)`
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
            // ORACLE ... [i=93] font-weight = 500 <- authored `var(--slate-weight-medium)`
            // The declaration also stops the UA stylesheet's `bolder` on <strong>
            // leaking in, which the resting-value test below pins at 500.
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '800',
                selector: '#plain >>> #headline',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-space-1 is the gap, --ui-space-6 the inline inset', () => mounted(async (page) => {
            // ORACLE ... [i=92] gap = 4px <- authored `var(--slate-space-1)`
            // ORACLE ... [i=92] padding-left = 28px <- `padding: 0 var(--slate-space-6)`
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#plain >>> #banner',
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
            // Slate authors ZERO here — `padding: 0 var(--slate-space-6)` — because
            // inset:0 stretched the box to the band's 130px and justify-content:center
            // did the work. The measured centring leaves 21px (host y=168 h=130,
            // headline y=189, remedy bottom 277); in flow that has to be authored, and
            // the tie between --ui-space-4 (18) and --ui-space-5 (24) goes to the
            // smaller. It is a token, not a number, which is what makes it reversible.
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
            // Bug L12 (spec §7.2, LAYOUT_SPEC_DRAFT.md:1111): "A private palette
            // duplicating the public tokens value-for-value, declared THREE times, with
            // one member (--slate-live-track) having zero consumers."
            // (slate-live.css:7-22, :57-72 — the sheet this component is ported FROM.)
            //
            // The mechanical death certificate: move the three public tokens this
            // component paints from, all at once, and assert that EVERY colour on the
            // rendered result moved. A shadow palette would leave one behind.
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

        /* -- the measured starting values, both themes ---------------------- */

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
                near(banner['row-gap'], ORACLE.gap, `${theme}: --ui-space-1`);
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
            // CITE live-pulling #live-alert-state [i=93] height = 54.5938px, identical
            // in both themes. line-height is OUTSIDE the 18-property probe (carve-out),
            // so 1.05 is a read of slate-live.css:2046 — and 52 × 1.05 = 54.6 is that
            // read measuring itself against the corpus. A unitless line-height is a
            // ratio of font-size, so this holds whatever font the rig resolved.
            const box = await page.box('#oracle-width >>> #headline');
            near(box.height, ORACLE.headlineHeight, 'the 1.05 leading at 52px', 0.6);
        }));

        /* -- 3. container behaviour ----------------------------------------- */

        test('the headline is the oracle\'s 52px and holds it at every container width', () => mounted(async (page) => {
            // PARITY SURFACE 0 INVERTED THIS TEST. --ui-display-xl was
            // clamp(38px, 4.2cqi, 52px), so this headline reproduced the oracle's 52px
            // only at the oracle's own 1375px and shrank below it — spec §4.1's "order
            // of surrender". It is now the flat 52px Slate declares
            // (--slate-display-xl, slate-tokens.css:146), which was already the clamp's
            // ceiling, so the oracle's value is reproduced at EVERY width instead of one.
            const wide = await page.prop('#oracle-width >>> #headline', 'font-size');
            near(wide, ORACLE.headlineSize, 'the oracle\'s 52px is reproduced at the oracle\'s width');

            const tight = await page.prop('#tight >>> #headline', 'font-size');
            near(tight, ORACLE.headlineSize, 'and in a 320px container it is still 52px');
            assert.equal(tight, wide, 'one headline, one size — the display type no longer gives way');

            // The container is moved anyway, because the claim "nothing here reads the
            // viewport OR the container" is exactly as unverifiable by screenshot as the
            // clamp was, and a re-clamp would show up here first.
            await page.setStyle('#holder', { 'inline-size': '1100px' });
            const mid = await page.prop('#oracle-width >>> #headline', 'font-size');
            assert.equal(mid, wide, 'a container width between the old clamp stops changes nothing');
            await page.setStyle('#holder', { 'inline-size': '1375px' });
            assert.equal(await page.prop('#oracle-width >>> #headline', 'font-size'), wide,
                'and it is unchanged on the way back');

            // The insets and the gap are physical tokens: they do not scale with it.
            const insets = await page.computed('#tight >>> #banner', ['padding-left', 'padding-top', 'row-gap']);
            near(insets['padding-left'], ORACLE.padInline, '--ui-space-6 does not shrink');
            near(insets['padding-top'], 18, '--ui-space-4 does not shrink');
            near(insets['row-gap'], ORACLE.gap, '--ui-space-1 does not shrink');

            acrossGeometries[geometry.name] = {
                wide: parseFloat(wide),
                tight: parseFloat(tight),
                padInline: insets['padding-left'],
                padBlock: insets['padding-top'],
                gap: insets['row-gap'],
            };
        }));

        test('the banner fills its container and never escapes it', () => mounted(async (page) => {
            const holder = await page.box('#narrow');
            const banner = await page.box('#tight >>> #banner');
            assert.ok(Math.abs(banner.width - holder.width) < 1,
                `the strip should fill its container: ${banner.width} in ${holder.width}`);
            assert.ok(banner.left >= holder.left - 0.5 && banner.right <= holder.right + 0.5,
                `the strip escaped its container: [${banner.left}, ${banner.right}]`);
            // The long remedy wraps rather than spilling — §2.4, silent clipping is the
            // inherited default the rewrite removes.
            const m = await page.metrics('#tight >>> #banner');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                `content overflowed the strip horizontally: ${m.scrollWidth} > ${m.clientWidth}`);
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // Part 4 ground rule 2 / spec §2.1 Rule 1, on the rendered result: resizing
            // an unrelated sibling container must not move this banner. The
            // cross-geometry comparison at the end of the file is the other half.
            const a = await page.box('#tight >>> #banner');
            const aSize = await page.prop('#tight >>> #headline', 'font-size');
            await page.setStyle('#plain-holder', { 'inline-size': '400px' });
            await page.setStyle('#holder', { 'inline-size': '600px' });
            const b = await page.box('#tight >>> #banner');
            assert.deepEqual([a.width, a.height], [b.width, b.height]);
            assert.equal(await page.prop('#tight >>> #headline', 'font-size'), aSize);
        }));

        /* -- 4. the bugs, asserted dead ------------------------------------- */

        test('L24: the host\'s own ring is --ui-focus-* and nothing clips it', () => mounted(async (page) => {
            // Bug L24 (spec §7.2, LAYOUT_SPEC_DRAFT.md:1123): "A11Y: focus rings clipped
            // on all four sides by the components they sit inside."
            // (slate-live.css:78-87; slate-components.css:549, :352.)
            // A screen that moves focus to the alert gives the host a tab stop; the ring
            // is the base's one treatment, and this component adds no overflow to cut it.
            const g = await assertFocusUnclipped(page, '#focusable');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset, 'the default offset, from the token');
        }));

        test('L24: a focusable slotted into the message keeps its ring', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#link');
        }));

        test('L24 cannot express: the banner declares no clipping overflow', () => mounted(async (page) => {
            // The assertions above would pass vacuously if nothing clipped for an
            // unrelated reason, so this is the mechanical half: every element this
            // component renders is overflow: visible, in both axes, at both geometries.
            // A component with no clip cannot cut a ring.
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
            // The mechanism is not weak specificity, it is REACH. In Slate a screen
            // sheet names the library's own class and wins — the whole reason
            // slate-shell.css carries 268 !important declarations and
            // slate-components.css 96 (spec §2.1 Rule 3). Nothing can reach into a
            // shadow root, so the component's paint is its own.
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
            // Slate needs slate-live.css:2040 `#main-page .slate-live-alert[hidden] {
            // display: none !important }` because its own `display: flex` at (1,1,0)
            // outranks the UA's [hidden] rule. Here the flex is on an element INSIDE the
            // shadow root, so :host([hidden]) { display: none } in the base wins on
            // ordinary specificity. Asserted as a rendered fact, not a source grep.
            assert.equal(await page.prop('#gone', 'display'), 'none');
            const box = await page.box('#gone');
            assert.ok(box.width === 0 && box.height === 0, `a hidden banner rendered ${box.width}×${box.height}`);

            // …and it comes back, so the rule is a rule and not a mount-time accident.
            await page.evalFn(() => { document.getElementById('gone').hidden = false; return true; });
            await page.settle(2);
            assert.notEqual(await page.prop('#gone', 'display'), 'none');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // Spec §2.1 Rule 3 as a RENDERED fact rather than a source grep (Gate C owns
            // the grep): every declaration this component makes is beatable by an
            // ordinary rule inside its own root.
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

        /* -- 5. the aria contract and the API -------------------------------- */

        test('the host is role="alert", and an authored role is kept', () => mounted(async (page) => {
            // Slate carries it in markup — index.html:271, `<div id="live-alert"
            // class="slate-live-alert" role="alert" hidden>` — which is correct and one
            // hand-written attribute away from being forgotten at the next call site.
            // Appendix 15 keeps Slate's aria-driven contract; this is the half of it a
            // component can guarantee.
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
            // Slate writes both children by id every time (ui.js:3534-3535), so an alert
            // with no remedy still spends the 4px gap on an empty box. Here the part is
            // not there at all — which is the shape a machine-side refusal arrives in
            // before R7 can say which step type was rejected.
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
            // The way a live alert actually arrives: the screen mounts the surface once
            // and fills it when the condition appears. `slotchange` does not fire when
            // an already-assigned node's text changes, so a strip that only listened to
            // it stayed collapsed forever — MEASURED before the observer existed: the
            // host held "Disconnected" and #headline computed `none`, banner 860×36.
            // The one component whose job is to interrupt, failing silently.
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
            // The direction a real alert uses most, and the one DEPARTURE 3 claims as
            // its benefit. Also measured failing before the observer: emptying a filled
            // remedy left it displayed.
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
            // SCOPE.md:1530 "In-flow warning strip on Live" and spec §4.1:520
            // "Skeleton. One grid. No absolutely-positioned structure." — so this file
            // sets no position, inset or z-index. Slate's own placement
            // (slate-live.css:2029-2031 `position: absolute; inset: 0; z-index: 5`) is
            // outside the oracle's 18-property surface anyway.
            const placement = await page.computed('#plain', ['position', 'z-index']);
            assert.deepEqual(placement, { position: 'static', 'z-index': 'auto' },
                'the component must not place itself');
            const inner = await page.computed('#plain >>> #banner', ['position', 'z-index']);
            assert.deepEqual(inner, { position: 'static', 'z-index': 'auto' });

            // …and the consumer's placement works: #overlay is absolute inset:0 over a
            // 1375×130 band, which is the oracle's own rect. min-block-size: 100% fills
            // it and justify-content: center reproduces the measured air — host y=168
            // h=130, headline y=189 → 21px above; remedy bottom 277 → 21px below.
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
    // The entry lives in its own file (tools/gallery/entries/ui-alert-banner.entry.js)
    // because sixteen wave-1 builders cannot all append to one array under a
    // whole-file-write rule; the GATE agent wires it into tools/gallery/entries.js. The
    // entry's own correctness is this builder's problem, so every state's markup is
    // mounted here, at the bench geometry, before it is handed over.

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
        // Two viewports 281×201 apart at two device pixel ratios. A component keyed on
        // the viewport moves here; one keyed on its own container does not. The headline
        // is the sharp end: it used to size itself in cqi, so a stray @media or a
        // container-type opt-out showed up as a different number at the two geometries.
        // Parity surface 0 made --ui-display-xl the flat 52px Slate declares, so BOTH
        // the wide and the tight container now read 52 — and a re-introduced clamp, an
        // @media or a viewport read would each still break one of the three lines below.
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        near(acrossGeometries.bench.wide, ORACLE.headlineSize, 'the oracle\'s 52px, at both geometries');
        near(acrossGeometries.bench.tight, ORACLE.headlineSize,
            'and the same 52px in a 320px container, at both geometries');
    });
});
