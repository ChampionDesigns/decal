/**
 * ui-card.render.test.mjs — Gate A for component #8 (wave 1, item #8).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 floor — asserting only on computed style, box geometry and
 * behaviour, never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — seven tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token. --ui-hairline gets its own, because
 *      the defect this component retires is exactly a card whose border width stopped
 *      reading it;
 *   2. focus geometry from --ui-focus-*, unclipped — on the card's own tab stop
 *      (scroll mode), on a slotted child, and with the counter-proof at pad="none";
 *   3. container behaviour — the card fills its container at both geometries and
 *      reads no viewport; the INTRINSIC-SIZING slot where there is no container inline
 *      size to fill (CONVENTIONS §2's containment, pinned and stated rather than
 *      discovered); plus the §2.4 scroll floor with a visible scrollbar;
 *   4. the bugs, asserted dead: L24 (rings clipped by the component they sit inside)
 *      and P8's family (a screen sheet reaching into a component and repainting it —
 *      here the shell-716 override that freezes 14 of Slate's 20 card borders);
 *   5. the aria contract — a labelled card is a labelled group, an unlabelled one is
 *      not a role at all, and only a scrolling card takes a tab stop.
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
    assertScrollFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

/* base-fixture is the wave-0a rig fixture, not a sibling builder's component: a
 * UiElement with its own shadow root that re-declares --_ui-focus-offset on :host
 * exactly as every component does. The pad="none" ring test below needs a stand-in
 * whose declaration lives in a SHADOW tree, because the cascade question there is
 * which tree a declaration comes from — see RING_CSS's `.resets` note. */
const MODULE = ['/src/components/ui-card.js', '/test/fixtures/base-fixture.js'];

/* A slotted focusable, with the base's own focus ring re-created in the LIGHT tree —
 * `focusRing` from base.js, verbatim. Two classes, because the two cases differ:
 *
 *   .child        a plain element with no shadow root of its own: it INHERITS
 *                 --_ui-focus-offset from whatever it is slotted into;
 *   .child.resets a stand-in for a slotted UiElement, which re-declares the offset on
 *                 its own :host (base.js baseStyles) and therefore does NOT inherit
 *                 the card's. This is the harder case and the one the pad has to
 *                 protect, so it is what the L24 assertions use.
 *
 * Written here rather than by slotting a real <ui-button>: "Sixteen entries, all
 * independent of each other" (SCOPE Part 4, Wave 1), and a suite that imports a
 * sibling builder's component makes this one red when theirs moves.
 *
 * It also carries the one FIXTURE rule the row needs — see the comment on it.
 */
const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    .resets { --_ui-focus-offset: var(--ui-focus-offset); }
    .tall { block-size: 400px; }
    button.child { margin: 0; padding: 0; border: 0; background: none; font: inherit; }

    /* THE ROW'S CARDS ARE FLEX ITEMS, AND A FLEX ITEM IS INTRINSICALLY SIZED. Every
     * UiElement host carries container-type: inline-size (base.js, CONVENTIONS §2:
     * "the host's inline size can no longer depend on its contents"), so a bare flex
     * item contributes ZERO and the host resolves to 0 wide. Without this line the
     * whole of #row is measured in that collapsed state - host 0, .card 50 (the inset
     * plus the border), the text hanging out of the surface - and every geometric
     * assertion made on a #row card is made on a box that is not the component doing
     * its job. flex: 1 1 0 is the consumer contract the card documents: whoever puts
     * a card in a shrink-to-fit slot gives it an inline size.
     * The collapse itself is not swept up, it is asserted deliberately, on #shrink. */
    #row > ui-card { flex: 1 1 0; }
</style>`;

const MARKUP = `${RING_CSS}
<div id="row" style="padding: 24px; display: flex; gap: 16px; align-items: flex-start">
    <ui-card id="plain">Plain surface</ui-card>
    <ui-card id="tight" pad="tight">Tight</ui-card>
    <ui-card id="bare" pad="none">Bare</ui-card>
    <ui-card id="bogus" pad="Nope">Fallback</ui-card>
    <ui-card id="named" label="Machine">Named</ui-card>
</div>
<div id="shrink-row" style="padding: 24px; display: flex; align-items: flex-start">
    <ui-card id="shrink">Plain surface</ui-card>
</div>
<div id="holder" style="inline-size: 600px; padding: 24px">
    <ui-card id="fill">In a container</ui-card>
</div>
<div id="cap-holder" style="inline-size: 600px; padding: 24px">
    <ui-card id="capped" scroll style="max-block-size: 200px">
        Notes<div class="tall"></div>
    </ui-card>
</div>
<div id="scroll-holder" style="inline-size: 400px; padding: 24px">
    <ui-card id="scroller" scroll>
        <button class="child resets" id="kid">Inside</button>
        <button class="child" id="inherits">Plain child</button>
        <div class="tall"></div>
    </ui-card>
</div>
<div id="bare-holder" style="inline-size: 400px; padding: 24px">
    <ui-card id="bare-scroller" scroll pad="none">
        <button class="child resets" id="edge">Flush</button>
        <div class="tall"></div>
    </ui-card>
</div>
<div id="component-holder" style="inline-size: 400px; padding: 24px">
    <ui-card id="component-scroller" scroll pad="none">
        <base-fixture id="fixture-kid" style="padding: 0"></base-fixture>
        <div class="tall"></div>
    </ui-card>
</div>
<div id="loose-holder" style="inline-size: 400px; padding: 24px">
    <base-fixture id="fixture-loose" style="padding: 0"></base-fixture>
</div>
`;

/* The oracle's own numbers, named once.
 *   CITE settings-machine-machine-info .slate-card [i=47] background-color: dark
 *        rgb(26, 33, 39) / light rgb(248, 249, 249)  <-  slate-components.css
 *        `.slate-card` authored `var(--slate-key)` !important=yes (token-driven)
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-color: dark
 *        rgb(58, 72, 82) / light rgb(203, 208, 211)  <-  slate-components.css
 *        `.slate-card` authored `(NOT CAPTURED — set via a CSS shorthand)`
 *        !important=yes (token-driven)
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-width = 1px
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-left-radius = 6px
 *   CITE settings-machine-machine-info .slate-card [i=47] box-shadow = none
 */
const ORACLE = {
    dark: { face: 'rgb(26, 33, 39)', edge: 'rgb(58, 72, 82)' },
    light: { face: 'rgb(248, 249, 249)', edge: 'rgb(203, 208, 211)' },
    hairline: 1,
    radius: 6,
    pad: 24,
    shadow: 'none',
};

/** At dsf 1.5 lengths snap to device pixels, so compare whole CSS px (CONVENTIONS §10). */
const near = (got, want, what, tol = 0.4) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/* THE RECTANGLE A SCROLLING CARD REALLY CLIPS TO, measured rather than taken from
 * focusGeometry().clippers: that walk is `node.parentElement || hostOf(node)`
 * (page-helpers.js:198, :220), i.e. it climbs the LIGHT tree — and a slotted
 * element's light-tree parent is the HOST, so the shadow-internal box that actually
 * clips it is never visited. Reported for the rig in this builder's digest; asserting
 * through it would pass vacuously, which is the one thing an L24 test must not do.
 * Hoisted because three tests need it. */
const scrollportOf = (page, hostId) => page.evalFn((id) => {
    const el = document.getElementById(id).shadowRoot.querySelector('#card');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const top = r.top + parseFloat(cs.borderTopWidth || '0');
    const left = r.left + parseFloat(cs.borderLeftWidth || '0');
    // clientWidth/Height exclude the scrollbar gutter, so this IS the rectangle the
    // browser clips to — the same correction clipRect() makes.
    return {
        top, left, right: left + el.clientWidth, bottom: top + el.clientHeight,
        overflowY: cs.overflowY,
    };
}, hostId);

/** Which sides of a ring fall outside a clip rectangle. [] means unclipped. */
const cutSides = (ring, clip) => ['top', 'left', 'bottom', 'right'].filter((side) => (
    side === 'top' || side === 'left'
        ? ring[side] < clip[side] - 0.5
        : ring[side] > clip[side] + 0.5
));

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-card @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-card must mount without throwing');
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

        /* -- 0. the fixture is not measuring a collapsed box ------------------ */

        test('the row fixture gives every card a real container to fill', () => mounted(async (page) => {
            // A GUARD ON THE FIXTURE ITSELF. Everything below measures a #row card, and
            // a #row card is a flex item: if the `flex: 1 1 0` rule above is ever lost,
            // all five hosts silently go to 0 wide and the whole block starts asserting
            // on a 50px padding box with its content hanging out (host 0 / .card 50 /
            // clientWidth 48 / scrollWidth 79, measured). Paint assertions would still
            // pass, which is exactly what makes it worth one explicit check.
            for (const id of ['plain', 'tight', 'bare', 'bogus', 'named']) {
                const host = await page.box(`#${id}`);
                assert.ok(host.width > 100,
                    `#${id} is in a collapsed slot: the fixture measures ${host.width}px`);
            }
        }));

        /* -- 1. tokens are consumed, not copied ----------------------------- */

        test('drill: --ui-key is the surface', () => mounted(async (page) => {
            // ORACLE settings-machine-machine-info .slate-card [i=47] background-color
            //        = rgb(26, 33, 39) <- slate-components.css `.slate-card` authored
            //        `var(--slate-key)` !important=yes (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: '#plain >>> #card',
                property: 'background-color',
            });
        }));

        test('drill: --ui-line is the edge', () => mounted(async (page) => {
            // ORACLE ... [i=47] border-top-color = rgb(58, 72, 82) <- the same rule,
            //        authored via the border shorthand (token-driven).
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#plain >>> #card',
                property: 'border-top-color',
            });
        }));

        test('drill: --ui-hairline reaches the border width — on EVERY card', () => mounted(async (page) => {
            // THE DEFECT, quoted: the same class renders a token-driven hairline on the
            // six div cards and a frozen literal on the fourteen button cards.
            //   CITE settings-accessories-usb-charger .slate-card [i=44] border-top-width
            //        = 1px <- slate-shell.css `#subpage-host #settings-content-area
            //        :is(button, [role="button"]):not(.toggle):not(.slate-stepper > *)
            //        :not(.slate-bank-item)` authored `1px` !important=yes
            //        (FROZEN/hardcoded)
            // So in Slate a fork moving the hairline moves 6 of 20 borders. Here the
            // deep token moves all of them, and the drill is on the plain card AND on
            // the two that differ most from it.
            //
            // expectLanding: false, and the landing checked here instead. A probe
            // element carrying only `border-top-width: 4px` computes 0px, because
            // border-width collapses without a border-style — so the helper's
            // resolveValue() landing target is meaningless for this property, and the
            // honest check is the rendered number.
            for (const id of ['plain', 'tight', 'bare']) {
                const drill = await assertTokenDrill(page, {
                    token: '--ui-hairline',
                    value: '4px',
                    selector: `#${id} >>> #card`,
                    property: 'border-top-width',
                    expectLanding: false,
                });
                near(drill.before, ORACLE.hairline, `#${id}: the resting border is the oracle's 1px`);
                near(drill.after, 4, `#${id}: the border width must land on --ui-hairline`);
            }
            // --ui-border-w is the layer the component actually names; the chain
            // --ui-border-w -> --ui-hairline must be live in both directions.
            const viaBorderW = await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: '5px',
                selector: '#plain >>> #card',
                property: 'border-top-width',
                expectLanding: false,
            });
            near(viaBorderW.after, 5, 'the component names --ui-border-w, which reads --ui-hairline');
        }));

        test('drill: --ui-radius is the radius', () => mounted(async (page) => {
            // ORACLE ... [i=47] border-top-left-radius = 6px (token-driven, = --ui-radius)
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '30px',
                selector: '#plain >>> #card',
                property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-space-5 is the default inset, --ui-space-4 the tight one', () => mounted(async (page) => {
            // DEPARTURE 1 (see the component header): Slate's card declares no padding
            // and its nine call sites supply four different insets —
            //   CITE settings-updates-firmware-update .slate-card [i=37] padding-left =
            //        24px <- app.css `.p-6` authored `1.5rem` (FROZEN/hardcoded)
            //   CITE settings-machine-sleep---wake-schedules .slate-card [i=65]
            //        padding-left = 16px <- app.css `.p-4` authored `1rem`
            //        (FROZEN/hardcoded)
            // Here it is one token, and 16 snaps to 18 by spec §3.3's own table.
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '36px',
                selector: '#plain >>> #card',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: '37px',
                selector: '#tight >>> #card',
                property: 'padding-left',
            });
            // …and the tight card must not read the regular token, or "two pads" is
            // one pad with extra steps.
            const space5 = await page.resolveToken('--ui-space-5', 'padding-left');
            const space4 = await page.resolveToken('--ui-space-4', 'padding-left');
            assert.notEqual(space4, space5);
            assert.equal(await page.prop('#tight >>> #card', 'padding-left'), space4);
        }));

        test('drill: --ui-control-h is the scroll floor (spec §2.4)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '90px',
                selector: '#scroller >>> #card',
                property: 'min-block-size',
            });
            // And a card that does not scroll has no floor at all: the oracle reads
            //   CITE settings-machine-machine-info .slate-card [i=47] min-height = auto
            assert.equal(await page.prop('#plain >>> #card', 'min-block-size'), 'auto',
                'a plain surface is content-sized; the floor belongs to the scroll region');
        }));

        /* -- the measured starting values, both themes ---------------------- */

        test('the resting paint is the oracle\'s measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];
                const got = await page.computed('#plain >>> #card', [
                    'background-color', 'border-top-color', 'border-top-width',
                    'border-top-left-radius', 'box-shadow', 'padding-left', 'padding-top',
                ]);
                assert.equal(got['background-color'], want.face, `${theme}: --ui-key`);
                assert.equal(got['border-top-color'], want.edge, `${theme}: --ui-line`);
                near(got['border-top-width'], ORACLE.hairline, `${theme}: --ui-hairline`);
                near(got['border-top-left-radius'], ORACLE.radius, `${theme}: --ui-radius`);
                assert.equal(got['box-shadow'], ORACLE.shadow,
                    `${theme}: the oracle reads box-shadow: none on every card in the corpus`);
                near(got['padding-left'], ORACLE.pad, `${theme}: --ui-space-5`);
                near(got['padding-top'], ORACLE.pad, `${theme}: the inset is symmetric`);
            }
        }));

        test('the border is one hairline on all four sides, and the radius one value', () => mounted(async (page) => {
            // slate-components.css:31-35 is `border: var(--slate-hairline) solid
            // var(--slate-line)` + `border-radius: var(--slate-radius)` — one edge, one
            // radius. Asserted per side because the shorthand is where a three-sided
            // border hides.
            const sides = await page.computed('#plain >>> #card', [
                'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
                'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
                'border-top-left-radius', 'border-top-right-radius',
                'border-bottom-left-radius', 'border-bottom-right-radius',
            ]);
            const widths = new Set(Object.entries(sides)
                .filter(([k]) => k.endsWith('-width')).map(([, v]) => v));
            const colours = new Set(Object.entries(sides)
                .filter(([k]) => k.endsWith('-color')).map(([, v]) => v));
            const radii = new Set(Object.entries(sides)
                .filter(([k]) => k.endsWith('-radius')).map(([, v]) => v));
            assert.equal(widths.size, 1, `four different border widths: ${[...widths]}`);
            assert.equal(colours.size, 1, `four different border colours: ${[...colours]}`);
            assert.equal(radii.size, 1, `four different corner radii: ${[...radii]}`);
        }));

        /* -- 4. the bugs, asserted dead ------------------------------------- */

        test('P8\'s family: no rule from OUTSIDE can reach the card\'s paint', () => mounted(async (page) => {
            // The mechanism is not weak specificity, it is REACH. In Slate a screen
            // sheet names the library's own class and wins:
            //   CITE settings-accessories-usb-charger .slate-card [i=44] border-top-width
            //        = 1px <- slate-shell.css `#subpage-host #settings-content-area
            //        :is(button, [role="button"]):not(.toggle)…` authored `1px`
            //        !important=yes (FROZEN/hardcoded)
            //   CITE settings-display-skin .slate-card [i=88] box-shadow = none <- the
            //        same rule, authored `none` !important=yes (FROZEN/hardcoded)
            // findings-digest.md:2251: "The library layer cannot win inside Settings …
            // .slate-btn-primary, .slate-card, .slate-field and the stepper components
            // are decoration on Settings markup — the shell decides."
            // This injects that rule's own shape, at higher specificity than the shell
            // used and with !important on top, and asserts nothing moves.
            const before = await page.computed('#plain >>> #card', [
                'background-color', 'border-top-color', 'border-top-width',
                'border-top-left-radius', 'padding-left',
            ]);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'shell-716-shape';
                s.textContent = [
                    '#row ui-card, #row ui-card *, #mount div, #mount * {',
                    '  border: 1px solid red !important;',
                    '  border-radius: 0 !important;',
                    '  background-color: transparent !important;',
                    '  padding: 0 !important;',
                    '  box-shadow: none !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            const after = await page.computed('#plain >>> #card', [
                'background-color', 'border-top-color', 'border-top-width',
                'border-top-left-radius', 'padding-left',
            ]);
            assert.deepEqual(after, before,
                'a screen sheet reached into the component and repainted it');
        }));

        test('L24: the scrolling card\'s OWN ring is inset, and its overflow cannot cut it', () => mounted(async (page) => {
            // Bug L24 (spec §7.2): "A11Y: focus rings clipped on all four sides by the
            // components they sit inside." A scroll container clips at its padding edge,
            // so a card in scroll mode would cut the ring on its own tab stop. One
            // treatment, second offset (CONVENTIONS §3).
            const g = await assertFocusUnclipped(page, '#scroller >>> #card');
            assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset, 'from the token, not a literal');

            // The ring is drawn INSIDE the card's own border box, which is what makes
            // the clip impossible rather than merely absent here.
            const box = await page.box('#scroller >>> #card');
            assert.ok(
                g.ringRect.top >= box.top - 0.5 && g.ringRect.left >= box.left - 0.5
                && g.ringRect.bottom <= box.bottom + 0.5 && g.ringRect.right <= box.right + 0.5,
                `the ring escapes the card's own box: ring ${JSON.stringify(g.ringRect)} vs ${JSON.stringify(box)}`,
            );
        }));

        test('L24: the consumer\'s focus-ring attribute still decides', () => mounted(async (page) => {
            // The inset default is `:host([scroll]:not([focus-ring]))`, so it is a
            // default and not an override: an explicit attribute wins. An unrecognised
            // value falls back to outset (base.js), which is the documented behaviour.
            await page.evalFn(() => {
                document.getElementById('scroller').setAttribute('focus-ring', 'outset');
                return true;
            });
            await page.focusVisible('#scroller >>> #card');
            const g = await page.focusGeometry('#scroller >>> #card');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset,
                'focus-ring="outset" on the host must beat the scroll default');
        }));

        test('L24: a slotted control\'s ring survives the card — because the pad leaves room', () => mounted(async (page) => {
            // #kid carries `.resets`, i.e. it re-declares --_ui-focus-offset the way
            // every UiElement does on its own :host, so it draws an OUTSET ring inside a
            // scrolling (therefore clipping) card. That is L24's exact geometry, and the
            // 24px inset is what makes it survive.
            //
            // THE CLIP RECT IS MEASURED, not taken from focusGeometry().clippers —
            // see the note on scrollportOf() at the top of this file.
            const scrollport = (id) => scrollportOf(page, id);

            await page.focusVisible('#kid');
            const g = await page.focusGeometry('#kid');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset, 'the harder case: an outset ring inside the card');
            const padded = await scrollport('scroller');
            assert.equal(padded.overflowY, 'auto', 'the card must really clip, or this is vacuous');
            assert.deepEqual(cutSides(g.ringRect, padded), [],
                'L24: the card clipped a slotted control\'s focus ring');

            // COUNTER-PROOF: the same child in a pad="none" card IS clipped — so the
            // pass above is the padding doing work, not a roomy container.
            //
            // AND THE CARD'S OWN pad="none" RULE DOES NOT RESCUE THIS ONE, on purpose.
            // `.resets` is a DOCUMENT-tree rule, and the document is the outermost
            // tree, so it outranks `:host([scroll][pad="none"]) ::slotted(…)` from the
            // card's shadow — a consumer that has stated the treatment in the light
            // tree keeps it, and the documented escape hatch below is still theirs.
            // The component case, where the child's declaration lives in ITS OWN
            // shadow tree and the card's rule does win, is the next test.
            await page.focusVisible('#edge');
            const bare = await page.focusGeometry('#edge');
            const bareClip = await scrollport('bare-scroller');
            assert.deepEqual(cutSides(bare.ringRect, bareClip).sort(), ['left', 'top'],
                'a flush child in an unpadded scroll card should be clipped — if it is not, ' +
                'the padded case proves nothing');

            // …AND THE DOCUMENTED ESCAPE HATCH: the child goes inset, one property,
            // same treatment (CONVENTIONS §3).
            await page.setStyle('#edge', { '--_ui-focus-offset': 'var(--ui-focus-offset-inset)' });
            await page.focusVisible('#edge');
            const fixed = await page.focusGeometry('#edge');
            assert.deepEqual(cutSides(fixed.ringRect, await scrollport('bare-scroller')), [],
                'the inset offset must rescue the flush child');
        }));

        test('L24 at pad="none": the card closes the ring case it CREATES', () => mounted(async (page) => {
            // A scrolling card with no inset clips a flush child's outset ring on top
            // and left — L24's exact wording ("focus rings clipped on all four sides by
            // the components they sit inside", spec §7.2 L24), on a ring this component
            // is responsible for. The card retires it from inside rather than leaving
            // every consumer to rediscover it:
            //   :host([scroll][pad="none"]) ::slotted(:not([focus-ring])).
            //
            // THE STAND-IN MUST BE A REAL SHADOW-DOM ELEMENT, because the cascade
            // question here is which TREE a declaration comes from: a slotted UiElement
            // re-declares --_ui-focus-offset on its own :host (base.js), which is an
            // INNER tree, and for two normal declarations the outer tree wins whatever
            // the specificity (CSS Scoping §3.3). base-fixture is wave 0a's rig fixture
            // — a UiElement, not a sibling builder's component, so this suite stays
            // independent of the other fifteen entries.
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');

            // The same fixture outside any card draws the OUTSET ring, so the change
            // below is the card's rule and not the fixture's own idea.
            await page.focusVisible('#fixture-loose >>> #plain');
            const free = await page.focusGeometry('#fixture-loose >>> #plain');
            assert.equal(free.outlineOffset, outset,
                'the stand-in declares the outset ring on its own :host, like every component');

            // EVERY RECTANGLE BELOW IS READ AFTER THIS FOCUS, and that ordering is
            // load-bearing: focusVisible() scrolls the element into view, so a clip
            // rect measured before it is in a different scroll position from the ring
            // measured after it, and the comparison silently comes out wrong.
            await page.focusVisible('#fixture-kid >>> #plain');
            const held = await page.focusGeometry('#fixture-kid >>> #plain');
            const clip = await scrollportOf(page, 'component-scroller');
            const ink = await page.box('#fixture-kid >>> #plain');
            assert.equal(clip.overflowY, 'auto', 'the card must really clip, or this is vacuous');
            assert.ok(ink.left <= clip.left + 0.5 && ink.top <= clip.top + 0.5,
                'the child must sit flush with the scrollport, or an outset ring would ' +
                `not have been cut and this proves nothing: ink ${JSON.stringify(ink)} ` +
                `in ${JSON.stringify(clip)}`);
            assert.equal(held.outlineOffset, inset,
                'an outer-tree ::slotted rule must beat the child\'s own :host declaration');
            assert.deepEqual(cutSides(held.ringRect, clip), [],
                'L24: the unpadded scrolling card still cuts a slotted component\'s ring');

            // …and only there. A child that STATES its treatment keeps it, exactly as
            // the host rule leaves `focus-ring` to the consumer.
            await page.evalFn(() => {
                document.getElementById('fixture-kid').setAttribute('focus-ring', 'outset');
                return true;
            });
            await page.settle(2);
            await page.focusVisible('#fixture-kid >>> #plain');
            const stated = await page.focusGeometry('#fixture-kid >>> #plain');
            assert.equal(stated.outlineOffset, outset,
                ':not([focus-ring]) — a consumer that states the child\'s treatment decides');
            assert.deepEqual(cutSides(stated.ringRect, await scrollportOf(page, 'component-scroller')).sort(),
                ['left', 'top'],
                'and then it IS clipped — which is what proves the rule above did the work');
        }));

        test('the padded cards do NOT reach into their slotted children', () => mounted(async (page) => {
            // The other half of keying the rule on pad="none": at 18px or 24px of inset
            // the outset ring (2px offset + 3px width) already clears the scrollport, so
            // reaching into a child that is in no danger would be the reach-in this
            // component exists to end (P8's family, asserted above).
            const offsets = await page.evalFn(() => {
                const read = (hostId) => {
                    const host = document.getElementById(hostId);
                    const kid = document.createElement('base-fixture');
                    host.append(kid);
                    const v = getComputedStyle(kid).getPropertyValue('--_ui-focus-offset').trim();
                    kid.remove();
                    return v;
                };
                return { padded: read('scroller'), bare: read('component-scroller') };
            });
            const inset = (await page.tokenValue('--ui-focus-offset-inset')).trim();
            const outset = (await page.tokenValue('--ui-focus-offset')).trim();
            assert.equal(offsets.padded, outset, 'a padded scrolling card leaves its children alone');
            assert.equal(offsets.bare, inset, 'the unpadded one hands them the inset offset');
        }));

        test('a plain slotted element inherits the card\'s offset; a component does not', () => mounted(async (page) => {
            // Recorded because it is the thing an author will get wrong. Custom
            // properties inherit, so a bare focusable slotted into a scrolling card gets
            // the inset offset for free — but every UiElement re-declares
            // --_ui-focus-offset on its own :host (base.js baseStyles), so a slotted
            // COMPONENT keeps its own. Hence the pad, and hence the escape hatch above.
            await page.focusVisible('#inherits');
            const plain = await page.focusGeometry('#inherits');
            await page.focusVisible('#kid');
            const resets = await page.focusGeometry('#kid');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(plain.outlineOffset, inset, 'a plain child inherits the card\'s inset');
            assert.equal(resets.outlineOffset, outset, 'a component child keeps its own');
        }));

        /* -- 3. container behaviour and the scroll floor -------------------- */

        test('the card fills its CONTAINER and follows it, at an unchanged viewport', () => mounted(async (page) => {
            // The oracle is DISQUALIFIED here (Part 10 §4): its 20 cards measure
            // 593/594/760/1150/1200 wide because the canvas is frozen at 1920×1200.
            // Spec §2.2 governs — panes are fr/minmax, never px.
            const holder = await page.box('#holder');
            const wide = await page.box('#fill >>> #card');
            assert.ok(Math.abs(wide.width - (holder.width - 48)) < 1,
                `the card should fill its container's content box: ${wide.width} in ${holder.width}`);

            await page.setStyle('#holder', { 'inline-size': '300px' });
            const tight = await page.box('#fill >>> #card');
            const tightHolder = await page.box('#holder');
            assert.ok(tight.width < wide.width, 'it narrowed with the container');
            assert.ok(
                tight.right <= tightHolder.right + 0.5 && tight.left >= tightHolder.left - 0.5,
                `the card escaped its container: [${tight.left}, ${tight.right}]`,
            );
            // The inset and the radius are physical, not fractions of the width.
            const shrunk = await page.computed('#fill >>> #card', ['padding-left', 'border-top-left-radius']);
            near(shrunk['padding-left'], ORACLE.pad, 'the inset does not shrink with the container');
            near(shrunk['border-top-left-radius'], ORACLE.radius, 'nor does the radius');

            await page.setStyle('#holder', { 'inline-size': '600px' });
            assert.equal((await page.box('#fill >>> #card')).width, wide.width,
                'and it comes back — the size was read from the container, not remembered');

            acrossGeometries[geometry.name] = {
                width: wide.width,
                padding: shrunk['padding-left'],
                radius: shrunk['border-top-left-radius'],
                narrowContained: tight.right <= tightHolder.right + 0.5,
            };
        }));

        test('an INTRINSIC-SIZING slot leaves the card nothing to fill — stated, not discovered', () => mounted(async (page) => {
            // The other half of departure 4's sentence "the card fills its container",
            // and the half a rendering test has to say out loud. base.js puts
            // `container-type: inline-size` on every UiElement host — CONVENTIONS §2,
            // "the host's inline size can no longer depend on its contents" — so in a
            // shrink-to-fit slot (a bare flex item, a column flex with
            // align-items: flex-start, a grid cell with justify-items: start) there is
            // no container inline size to read, the host resolves to 0, and the card is
            // exactly its own inset plus its own border with the content hanging out.
            //
            // PINNED RATHER THAN "FIXED", for two reasons. The containment is what makes
            // the card fill a slot correctly everywhere else and is the base's by
            // design; and a card cannot invent an inline size nobody gave it — dropping
            // the containment would only trade this for shrink-wrapping the text, which
            // is not what a surface does. So the behaviour is a fact with a test on it,
            // and the remedy is the consumer's, asserted at the end of this test.
            const host = await page.box('#shrink');
            const card = await page.box('#shrink >>> #card');
            near(host.width, 0, 'a shrink-to-fit slot gives the host no inline size');
            near(card.width, 2 * ORACLE.pad + 2 * ORACLE.hairline,
                'so the card is exactly --ui-space-5 twice plus --ui-hairline twice');

            // It overflows VISIBLY. §2.4's "no silent clip" holds even in the degenerate
            // case, so this is a failure a builder can see rather than one that eats text.
            const m = await page.metrics('#shrink >>> #card');
            assert.ok(m.scrollWidth > m.clientWidth + 0.5,
                `the content should be overflowing the collapsed surface: ${m.scrollWidth} vs ${m.clientWidth}`);
            assert.equal(m.overflowX, 'visible', 'and it must not clip silently (spec §2.4)');

            // THE REMEDY IS ONE DECLARATION AT THE CALL SITE — flex: 1, align-self:
            // stretch, a width, a grid track. Nothing in the component changes.
            await page.setStyle('#shrink', { flex: '1 1 0' });
            const grownHost = await page.box('#shrink');
            const grown = await page.box('#shrink >>> #card');
            assert.ok(grown.width > card.width + 100,
                `the card did not take the slot it was finally given: ${grown.width}`);
            near(grown.width, grownHost.width, 'and it fills it exactly');
            const settled = await page.metrics('#shrink >>> #card');
            assert.ok(settled.scrollWidth <= settled.clientWidth + 0.51,
                'with a real container the content is back inside the surface');
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // Part 4 ground rule 2 / spec §2.1 Rule 1, on the rendered result: resizing
            // an unrelated sibling container must not move this card. The cross-geometry
            // comparison at the end of the file is the other half.
            await page.setStyle('#holder', { 'inline-size': '420px' });
            const a = await page.box('#fill >>> #card');
            await page.setStyle('#row', { 'inline-size': '520px' });
            const b = await page.box('#fill >>> #card');
            assert.deepEqual([a.width, a.height], [b.width, b.height]);
        }));

        test('scroll mode: a floor, a stated overflow, a visible scrollbar (spec §2.4)', () => mounted(async (page) => {
            // "an explicit min-height … an explicit overflow behaviour — auto with a
            // VISIBLE scrollbar … Hiding the scrollbar is banned" (spec §2.4). Squeezed
            // to 40px against a 64px floor: the floor must win and the overflow must
            // become a scrollbar rather than a silent clip.
            const m = await assertScrollFloor(page, {
                selector: '#scroller >>> #card',
                squeezeSelector: '#scroller',
                squeeze: { 'block-size': '40px' },
                minBlockSize: '64px',
            });
            assert.ok(m.scrollbarInline >= 1, `expected a scrollbar gutter, got ${m.scrollbarInline}px`);
            assert.equal(m.overflowY, 'auto');
        }));

        test('a card that does not scroll does not clip either', () => mounted(async (page) => {
            // The other half of §2.4: scroll is opt-in, and the default must not be the
            // old app's silent `hidden`. "In the old app hidden is the default answer
            // everywhere except the numpad."
            const m = await page.metrics('#plain >>> #card');
            assert.equal(m.overflowX, 'visible');
            assert.equal(m.overflowY, 'visible');
        }));

        test('the cap comes from OUTSIDE, and the card scrolls inside it (SCOPE.md:1702)', () => mounted(async (page) => {
            // "Notes pane → #8 card + type roles with a max-block-size cap (spec §4.2)."
            // The cap is written on the host by whoever owns the layout; the card turns
            // it into a scroll region rather than spilling.
            const box = await page.box('#capped >>> #card');
            near(box.height, 200, 'the card honours the cap set on its host', 1);
            const m = await page.metrics('#capped >>> #card');
            assert.ok(m.scrollHeight > m.clientHeight + 0.5,
                'the capped card should be scrolling its content, not clipping it');

            // Move the cap: the card follows, with no JS anywhere in the path.
            await page.setStyle('#capped', { 'max-block-size': '320px' });
            near((await page.box('#capped >>> #card')).height, 320, 'the cap is live', 1);
            // Remove it: back to content height, which is taller than either cap.
            await page.setStyle('#capped', { 'max-block-size': null });
            assert.ok((await page.box('#capped >>> #card')).height > 320,
                'with no cap the card is content-sized');
        }));

        /* -- 5. the aria contract and the API -------------------------------- */

        test('a labelled card is a labelled group; an unlabelled one is not a role', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const inner = (id) => document.getElementById(id).shadowRoot.querySelector('#card');
                return {
                    namedRole: inner('named').getAttribute('role'),
                    namedLabel: inner('named').getAttribute('aria-label'),
                    plainRole: inner('plain').getAttribute('role'),
                    plainLabel: inner('plain').getAttribute('aria-label'),
                    plainTabindex: inner('plain').getAttribute('tabindex'),
                    scrollTabindex: inner('scroller').getAttribute('tabindex'),
                    tag: inner('plain').tagName,
                };
            });
            assert.deepEqual(shape, {
                namedRole: 'group',
                namedLabel: 'Machine',
                plainRole: null,
                plainLabel: null,
                plainTabindex: null,
                scrollTabindex: '0',
                tag: 'DIV',
            });
        }));

        test('only a scrolling card takes a tab stop, and it really takes one', () => mounted(async (page) => {
            // A scroll region a keyboard cannot reach is the same defect as a hit target
            // a finger cannot hit (the class of L22/P4). A plain surface takes no stop.
            const focused = await page.evalFn(() => {
                const card = document.getElementById('scroller').shadowRoot.querySelector('#card');
                card.focus();
                return document.getElementById('scroller').shadowRoot.activeElement === card;
            });
            assert.equal(focused, true, 'the scrolling card must be focusable');

            const plainFocus = await page.evalFn(() => {
                const card = document.getElementById('plain').shadowRoot.querySelector('#card');
                card.focus();
                return document.getElementById('plain').shadowRoot.activeElement === card;
            });
            assert.equal(plainFocus, false, 'a plain surface must not be in the tab order');
        }));

        test('Element.prototype.scroll() survives on the host: the state is `scrollable`', () => mounted(async (page) => {
            // A reactive property named `scroll` is defined by Lit as an accessor on
            // UiCard.prototype — the prototype has no own `scroll`, so Lit takes the
            // name — and that SHADOWS the standard Element.prototype.scroll(). Measured
            // before this fix: typeof card.scroll === 'boolean' and card.scroll(0, 0)
            // threw "TypeError: el.scroll is not a function", on the one component in
            // the wave that is a scroll container. The attribute is unchanged (`scroll`,
            // as documented and as SCOPE.md:1702 uses it); only the JS spelling moved.
            const probe = await page.evalFn(() => {
                const el = document.getElementById('capped');
                const out = {
                    typeofScroll: typeof el.scroll,
                    typeofScrollTo: typeof el.scrollTo,
                    prop: el.scrollable,
                    attr: el.hasAttribute('scroll'),
                    shadowsProto: Object.prototype.hasOwnProperty.call(
                        Object.getPrototypeOf(el), 'scroll'),
                };
                try { el.scroll(0, 0); el.scrollTo(0, 0); out.threw = null; } catch (e) { out.threw = String(e); }
                return out;
            });
            assert.deepEqual(probe, {
                typeofScroll: 'function',
                typeofScrollTo: 'function',
                prop: true,
                attr: true,
                shadowsProto: false,
                threw: null,
            }, 'the standard scroll methods must reach the host, and the state must be on `scrollable`');

            // Both directions of the reflection, so `scroll` stays the authored spelling.
            const round = await page.evalFn(() => {
                const el = document.createElement('ui-card');
                document.getElementById('mount').append(el);
                el.scrollable = true;
                return el.updateComplete.then(() => {
                    const afterProp = {
                        attr: el.hasAttribute('scroll'),
                        tabindex: el.shadowRoot.querySelector('#card').getAttribute('tabindex'),
                    };
                    el.removeAttribute('scroll');
                    return el.updateComplete.then(() => {
                        const afterAttr = {
                            prop: el.scrollable,
                            tabindex: el.shadowRoot.querySelector('#card').getAttribute('tabindex'),
                        };
                        el.remove();
                        return { afterProp, afterAttr };
                    });
                });
            });
            assert.deepEqual(round, {
                afterProp: { attr: true, tabindex: '0' },
                afterAttr: { prop: false, tabindex: null },
            }, 'property → attribute → property: one state, two spellings');
        }));

        test('an unrecognised pad falls back rather than collapsing the inset', () => mounted(async (page) => {
            const bogus = await page.prop('#bogus >>> #card', 'padding-left');
            const plain = await page.prop('#plain >>> #card', 'padding-left');
            assert.equal(bogus, plain);
            assert.equal(
                await page.evalFn(() => document.getElementById('bogus').getAttribute('pad')),
                'regular',
                'and it normalises, so the DOM says what it paints',
            );
            near(await page.prop('#bare >>> #card', 'padding-left'), 0, 'pad="none" is Slate-identical');
        }));

        test('the slot carries content through, and the surface wraps it', () => mounted(async (page) => {
            const inside = await page.evalFn(() => {
                const host = document.getElementById('plain');
                const slot = host.shadowRoot.querySelector('slot');
                return slot.assignedNodes().map((n) => (n.textContent || '').trim()).join('');
            });
            assert.equal(inside, 'Plain surface');

            // WRAPS IT, as geometry rather than as an inequality a COLLAPSED card also
            // satisfies. This assertion used to read `card.width > 48 && card.height >
            // 24`, which a card in an intrinsic-sizing slot passes at 50×92 with its
            // text hanging out of the surface — the very state the fixture was in.
            // Two facts pin it now: the card fills its host exactly, and the content is
            // inside the painted box.
            const host = await page.box('#plain');
            const card = await page.box('#plain >>> #card');
            near(card.width, host.width, 'the card fills the host it was given');
            assert.ok(card.height > 24, `the card rendered ${card.width}×${card.height}`);
            const m = await page.metrics('#plain >>> #card');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                `the slotted content is not inside the surface: scrollWidth ${m.scrollWidth} `
                + `> clientWidth ${m.clientWidth}`);
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // Spec §2.1 Rule 3 as a RENDERED fact rather than a source grep (Gate C owns
            // the grep): every declaration this component makes is beatable by an
            // ordinary rule inside its own root.
            const beaten = await page.evalFn(() => {
                const root = document.getElementById('plain').shadowRoot;
                const s = document.createElement('style');
                s.textContent = 'div.card { background-color: rgb(1, 2, 3); }';
                root.appendChild(s);
                return getComputedStyle(root.querySelector('#card')).backgroundColor;
            });
            assert.equal(beaten, 'rgb(1, 2, 3)',
                'a plain rule in the same root must win — no !important anywhere in the component');
        }));
    });
}

describe('the gallery entry this component ships', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-card.entry.js) because
    // sixteen wave-1 builders cannot all append to one array under a whole-file-write
    // rule; the GATE agent wires it into tools/gallery/entries.js. The entry's own
    // correctness is this builder's problem, so every state's markup is mounted here,
    // at the bench geometry, before it is handed over.

    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-card.entry.js');

        assert.equal(entry.id, 'ui-card', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-card.js',
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
                    await page.exists('ui-card >>> #card'),
                    `${entry.id}--${state.id} mounted no card`,
                );
                const box = await page.box('ui-card >>> #card');
                assert.ok(box.width > 0 && box.height > 0,
                    `${entry.id}--${state.id} rendered ${box.width}×${box.height}`);
                // EVERY GALLERY STAGE MUST BE A REAL CONTAINER. A card in a
                // shrink-to-fit stage collapses to its own inset (see the
                // intrinsic-sizing test above), and a capture battery would then
                // baseline the collapsed box as if it were the component.
                const stage = await page.box('#stage');
                assert.ok(box.width > stage.width / 2,
                    `${entry.id}--${state.id} is staged in a collapsed slot: `
                    + `${box.width} inside ${stage.width}`);
            }
        });
    });
});

describe('ui-card across both Gate A geometries', () => {
    test('the same card in the same container renders the same surface', () => {
        // Two viewports 281×201 apart at two device pixel ratios. A component keyed on
        // the viewport moves here; one keyed on its own container does not.
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        near(acrossGeometries.bench.padding, ORACLE.pad, '--ui-space-5');
        near(acrossGeometries.bench.radius, ORACLE.radius, '--ui-radius');
    });
});
