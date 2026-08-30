/**
 * ui-keycap.render.test.mjs — Gate A for component #15 (wave 1, item #15).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — eleven tokens, each retargeted on :root with the rendered value
 *      asserted to move, to land, and to come back;
 *   2. focus geometry from --ui-focus-*, unclipped, in BOTH offsets (bug L24's class);
 *   3. container behaviour at the floor — the face reads its own container and
 *      REFUSES to shrink with it (spec §2.2: ergonomics is physical);
 *   4. bugs asserted dead: L22 (a hit box that is the glyphs, 32×35 against a 48px
 *      floor), P4 (a floor the comment claims and the box does not have), L24;
 *   5. hit-area floor (spec §2.3 / Appendix 5) through the ONE shared utility;
 *   6. the aria contract for `label` — row #15 cites no Appendix 15 state contract
 *      (Appendix 15 is the aria-*-driven STATE selector rule, and a keycap has no
 *      state a user can change), so what is tested is the accessible NAME instead.
 *
 * Plus three this component earns on its own: the SKIRT is a derived 3× hairline and
 * not a literal; the shadow boundary refuses an `!important` universal rule from the
 * document (which is exactly what beat Slate's own font-family here); and there is NO
 * selection treatment, asserted by trying all six spellings.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY in both themes, because "measured from the
 * oracle" should be checkable rather than claimed. Every literal carries its CITE.
 *
 * A NOTE ON BORDER WIDTHS AND dsf 1.5. Chrome snaps border widths to device pixels
 * (CONVENTIONS §10: "a 3px outline computes to 2.66667px"), so a 1px hairline is not
 * the string '1px' at the bench geometry and the 3× skirt ratio does not survive the
 * snapping either. Every border assertion below therefore either rounds to whole CSS
 * px or drills the token to a value whose 1× and 3× multiples are both integral in
 * device pixels (10px → 15 and 45 device px at dsf 1.5). `resolveValue` cannot be
 * used as the landing target for a border width at all: its probe div has no
 * border-style, so the used width is 0 whatever is asked for — hence expectLanding:
 * false on those two drills, with the landing owned here.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-keycap.js'];

/* The six faces the oracle measured, plus the cases only Decal has.
 *   CITE prov_query.py find --cls slate-keycap → "found 6 element(s) in 1 state(s)",
 *        settings-help-keyboard-shortcuts: [1655,333,48,48] [1655,422,48,48]
 *        [1655,511,48,48] [1655,600,48,48] [1635,689,68,48] [1655,778,48,48];
 *        "distinct geometries (w x h), all matched elements: 48 x 48 x5, 68 x 48 x1". */
const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
    <ui-keycap id="plain">E</ui-keycap>
    <ui-keycap id="w">W</ui-keycap>
    <ui-keycap id="space">Space</ui-keycap>
    <ui-keycap id="named" label="Backspace">&#9003;</ui-keycap>
    <ui-keycap id="off" disabled>P</ui-keycap>
    <ui-keycap id="gone" hidden>P</ui-keycap>
    <ui-keycap id="focusable" tabindex="0">7</ui-keycap>
</div>
<div id="clipper" style="overflow: hidden; inline-size: 112px; display: flex; gap: 8px">
    <ui-keycap id="inset" tabindex="0" focus-ring="inset">8</ui-keycap>
</div>
<div id="narrow" style="inline-size: 36px">
    <ui-keycap id="cramped">Space</ui-keycap>
</div>
`;

const CAP = (id) => `ui-keycap#${id} >>> #cap`;

/* The oracle's own numbers, named once.
 *   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43] background-color:
 *        dark rgb(26, 33, 39) / light rgb(248, 249, 249) ← slate-components.css
 *        `.slate-keycap` authored (NOT CAPTURED — set via a CSS shorthand) !important=no
 *        (token-driven)   [the shorthand is slate-components.css:787 `background:
 *        var(--slate-key)`, read read-only from the Slate source]
 *   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43] color:
 *        dark rgb(244, 247, 248) / light rgb(23, 26, 28) ← slate-components.css
 *        `.slate-keycap` authored `var(--slate-text)` !important=no (token-driven)
 *   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43] border-top-color:
 *        dark rgb(82, 97, 107) / light rgb(170, 178, 183) ← slate-components.css
 *        `.slate-keycap` authored (NOT CAPTURED — shorthand) !important=no (token-driven)
 *   CITE themes: "15 of 18 properties identical across themes; 3 differ." */
const ORACLE = {
    dark: { face: 'rgb(26, 33, 39)', ink: 'rgb(244, 247, 248)', edge: 'rgb(82, 97, 107)' },
    light: { face: 'rgb(248, 249, 249)', ink: 'rgb(23, 26, 28)', edge: 'rgb(170, 178, 183)' },
    /* CITE ... font-size = 17px ← authored `var(--slate-text-base)` (token-driven)
     * CITE ... font-weight = 500 ← authored `var(--slate-weight-medium)` (token-driven)
     * CITE ... padding-left = 8px, border-top-left-radius = 6px, border-top-width = 1px
     * CITE ... box-shadow = none (FROZEN/hardcoded), letter-spacing = normal,
     *          min-height = auto, text-transform = none, opacity = 1 */
    fontSize: '17px',
    fontWeight: '500',
    paddingLeft: '8px',
    radius: '6px',
    borderWidth: 1,
    skirt: 3,
    floor: 48,
    /* CITE ... the "Space" face is [1635,689,68,48] — 68 wide, 48 tall. */
    spaceWidth: 68,
};

/** Whole CSS px — the comparison CONVENTIONS §10 mandates at dsf 1.5. */
const roundPx = (v) => Math.round(parseFloat(v));

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-keycap @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-keycap must mount without throwing');
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

        /* == 1. TOKENS ARE CONSUMED, NOT COPIED ============================== */

        test('drill: --ui-hit-min is the floor, on BOTH axes and on the hit box too', () => mounted(async (page) => {
            // This is bug P4's class as a drill. P4 is "measured 64×64, so
            // --slate-hit-min is silently not applied where the comment says it is":
            // the geometry rule and the paint rule were 1300 lines apart, so nothing
            // downstream noticed the token had stopped reaching the box. Moving the
            // token here must move the FACE and the HIT BOX together, or the same
            // silence has been rebuilt.
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'height',
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'width',
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: CAP('plain'),
                property: 'height',
                pseudo: '::before',
            });
        }));

        test('drill: --ui-key is the face', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'background-color',
            });
        }));

        test('drill: --ui-text is the ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'color',
            });
        }));

        test('drill: --ui-line-strong is the edge', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line-strong', value: DRILL_COLOUR,
                selector: CAP('plain'), property: 'border-top-color',
            });
        }));

        test('drill: --ui-radius is the corner', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-space-2 is the inline padding', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-2', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'padding-left',
            });
        }));

        test('drill: --ui-text-base is the type size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'font-size',
            });
        }));

        test('drill: --ui-weight-medium is the weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-medium', value: '800',
                selector: CAP('plain'), property: 'font-weight',
            });
        }));

        test('drill: --ui-font-family is the family — the ONE family, not a numeric fork', () => mounted(async (page) => {
            // Slate authored var(--slate-font-numeric) here and LOST the declaration to
            //   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
            //        font-family = Geist, system-ui, sans-serif ← slate-shell.css
            //        `#subpage-host #settings-content-area *` authored `var(--slate-font-ui)`
            //        !important=yes (token-driven)
            // Nothing visible changed only because slate-tokens.css:125 defines
            // --slate-font-numeric AS --slate-font-ui. styles/tokens.css:346-347 merges
            // them deliberately; this drill pins that there is exactly one family token.
            await assertTokenDrill(page, {
                token: '--ui-font-family', value: 'cursive',
                selector: CAP('plain'), property: 'font-family',
            });
        }));

        test('drill: --ui-hairline reaches the border THROUGH --ui-border-w', () => mounted(async (page) => {
            // expectLanding: false — resolveValue's probe div has no border-style, so
            // its used border width is 0px whatever value is asked for. The landing is
            // asserted here instead, rounded to whole CSS px per CONVENTIONS §10.
            const drill = await assertTokenDrill(page, {
                token: '--ui-hairline', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-width',
                expectLanding: false,
            });
            assert.equal(
                roundPx(drill.after), roundPx(DRILL_LENGTH),
                `--ui-hairline drill landed on ${drill.after}, not ${DRILL_LENGTH}. ` +
                '--ui-border-w is declared as var(--ui-hairline) (styles/tokens.css:409); ' +
                'if this fails the border stopped reading the chain.',
            );
        }));

        test('drill: --ui-border-w is the border directly too', () => mounted(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-border-w', value: DRILL_LENGTH,
                selector: CAP('plain'), property: 'border-top-width',
                expectLanding: false,
            });
            assert.equal(roundPx(drill.after), roundPx(DRILL_LENGTH));
        }));

        test('drill: --ui-opacity-disabled is the one dim dial, applied ONCE', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: 'ui-keycap#off', property: 'opacity',
            });
            // The base paints BOTH spellings — :host(:is([disabled],…)) and
            // :where([disabled],…) inside the tree. Nothing in this shadow tree carries
            // the attribute, so .38 must not compound to .38 × .38 = .14.
            const inner = await page.prop(CAP('off'), 'opacity');
            assert.equal(
                inner, '1',
                `double-dim: the face inside a disabled ui-keycap computes opacity ${inner}. ` +
                'Only the host carries [disabled]; the face must be untouched.',
            );
        }));

        /* == ORACLE PARITY, both themes ===================================== */

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: face, ink and edge are exact`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const got = await page.computed(CAP('plain'), [
                    'background-color', 'color', 'border-top-color',
                ]);
                assert.equal(got['background-color'], ORACLE[theme].face);
                assert.equal(got.color, ORACLE[theme].ink);
                assert.equal(got['border-top-color'], ORACLE[theme].edge);
            }));
        }

        test('oracle parity: the theme-invariant fifteen', () => mounted(async (page) => {
            const got = await page.computed(CAP('plain'), [
                'font-size', 'font-weight', 'padding-left', 'border-top-left-radius',
                'box-shadow', 'letter-spacing', 'text-transform', 'opacity', 'min-height',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.equal(got['padding-left'], ORACLE.paddingLeft);
            assert.equal(got['border-top-left-radius'], ORACLE.radius);
            // CITE ... box-shadow = none ← (no declaration) (FROZEN/hardcoded).
            // Also the standing proof that selectionSurface is not imported: the
            // fragment would put a two-item list here the moment a state matched.
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(got['min-height'], 'auto');
        }));

        test('oracle parity: 48×48 for a single glyph, wider for a word', () => mounted(async (page) => {
            const one = await page.box(CAP('plain'));
            assert.equal(Math.round(one.width), ORACLE.floor);
            assert.equal(Math.round(one.height), ORACLE.floor);

            const w = await page.box(CAP('w'));
            assert.equal(Math.round(w.width), ORACLE.floor, 'every one-glyph face is the same width');

            // CITE ... the Space face is [1635,689,68,48]. The exact 68 is a Geist
            // metric at 1920×1200 and is NOT asserted — width is content here, and the
            // corpus's own banner says its geometry is Slate's, never Decal's target.
            // What IS the contract: wider than the floor, and exactly as tall.
            const space = await page.box(CAP('space'));
            assert.ok(
                space.width > ORACLE.floor,
                `the "Space" face is ${space.width}px — min-inline-size floored it instead of ` +
                'letting the word set the width.',
            );
            assert.equal(
                Math.round(space.height), ORACLE.floor,
                'a key that is tall for one binding and short for the next is not a keyboard',
            );

            acrossGeometries[geometry.name] = {
                one: { w: Math.round(one.width), h: Math.round(one.height) },
                space: { h: Math.round(space.height) },
                fontSize: await page.prop(CAP('plain'), 'font-size'),
            };
        }));

        /* == THE SKIRT — derived, not a literal ============================== */

        test('the bottom edge is a 3× hairline skirt, derived from the token', () => mounted(async (page) => {
            const rest = await page.computed(CAP('plain'), ['border-top-width', 'border-bottom-width']);
            assert.equal(
                roundPx(rest['border-top-width']), ORACLE.borderWidth,
                'CITE #kb-current-espresso [i=43] border-top-width = 1px',
            );
            assert.equal(
                roundPx(rest['border-bottom-width']), ORACLE.skirt,
                'Slate writes border-bottom-width: 3px (slate-components.css:783); Decal ' +
                'derives it as calc(3 * var(--ui-border-w)) and it must still render 3px.',
            );
            assert.ok(
                parseFloat(rest['border-bottom-width']) > parseFloat(rest['border-top-width']),
                'without a heavier bottom edge a keycap is a rectangle, not a key',
            );

            // The ratio itself, at a drill value chosen so 1× and 3× are BOTH integral
            // in device pixels at dsf 1.5 (15 and 45) — the snapping that makes
            // 1px/3px read as 0.667/2.667 at the bench cannot hide a wrong multiplier.
            await page.setToken('--ui-hairline', '10px');
            const drilled = await page.computed(CAP('plain'), ['border-top-width', 'border-bottom-width']);
            await page.setToken('--ui-hairline', null);
            assert.equal(roundPx(drilled['border-top-width']), 10);
            assert.equal(
                roundPx(drilled['border-bottom-width']), 30,
                `the skirt is not 3× the hairline: 10px hairline gave ${drilled['border-bottom-width']}.`,
            );

            const restored = await page.prop(CAP('plain'), 'border-bottom-width');
            assert.equal(roundPx(restored), ORACLE.skirt, 'the drill did not restore');
        }));

        /* == 2. FOCUS GEOMETRY, UNCLIPPED (bug L24's class) ================== */

        test('focus: the ONE ring, outset, unclipped', () => mounted(async (page) => {
            // The face is not focusable by itself — Slate's is a <kbd>, a rendered
            // binding. A consumer that needs it focusable puts tabindex on the HOST and
            // the base's :host(:focus-visible) draws the ring. No second treatment.
            const g = await assertFocusUnclipped(page, 'ui-keycap#focusable');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(
                g.outlineOffset, outset,
                'an unclipped keycap uses the OUTSET offset; the inset one is for clipping parents',
            );
        }));

        test('focus: inside an overflow:hidden band, focus-ring="inset" is not clipped — L24 dead', () => mounted(async (page) => {
            // L24 (LAYOUT_SPEC_DRAFT.md §7.2): "A11Y: focus rings clipped on all four
            // sides by the components they sit inside" — slate-live.css:78-87,
            // slate-components.css:549, :352. #clipper is exactly that shape.
            const g = await assertFocusUnclipped(page, 'ui-keycap#inset');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(
                g.outlineOffset, inset,
                'the inset variant must use --ui-focus-offset-inset, or the ring is drawn ' +
                'outside a box that clips it — which is L24 rebuilt.',
            );
            assert.ok(g.clippers.length > 0, 'the clipping ancestor is missing: the test is vacuous');
        }));

        test('focus: an unrecognised focus-ring value falls back to a ring, never to none', () => mounted(async (page) => {
            await page.evalFn((s) => (window.__h.need(s).setAttribute('focus-ring', 'sideways'), true), 'ui-keycap#focusable');
            await page.settle(1);
            const g = await assertFocusUnclipped(page, 'ui-keycap#focusable');
            assert.notEqual(g.outlineStyle, 'none', 'an invisible ring is an a11y defect; a wrong offset is cosmetic');
        }));

        /* == 4/5. THE HIT FLOOR, AND BUG L22 ================================= */

        test('hit floor: 48px on both axes through the ONE shared utility', () => mounted(async (page) => {
            // spec §2.3 case 2 names this component first: "load-bearing in three
            // components today, not one (layout/overlays.md A1: .slate-keycap
            // slate-components.css:780-781, .ps-fav-slot slate-shell.css:1669-1670,
            // .slate-preset-bank > button::before slate-live.css:787)".
            const got = await assertHitFloor(page, CAP('plain'), { mode: 'overlay' });
            assert.equal(got.floor, ORACLE.floor);
            // And the ink is at the floor too, which is what Slate got right here.
            await assertHitFloor(page, CAP('plain'), { mode: 'box' });
        }));

        test('hit floor: squeezing the ink to 32×35 does not shrink the hit box — L22 dead', () => mounted(async (page) => {
            // L22 (LAYOUT_SPEC_DRAFT.md §7.2, app.js:91 / slate-live.css:663-676):
            // "A11Y: rail value cells are tabindex=-1, and five of the nine numpad
            // targets are inline spans whose hit box is the glyphs — measured 32 × 35
            // against a 48px floor, on a wall panel operated with a wet hand."
            // That is the defect the numpad face exists to make unbuildable, so the
            // test forces the ink to L22's exact measurement and reads the hit extent.
            const before = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            assert.equal(Math.round(parseFloat(before.width)), ORACLE.floor);

            await page.setStyle(CAP('plain'), {
                'min-inline-size': '32px',
                'inline-size': '32px',
                'block-size': '35px',
            });
            const ink = await page.box(CAP('plain'));
            const hit = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            await page.setStyle(CAP('plain'), {
                'min-inline-size': null, 'inline-size': null, 'block-size': null,
            });

            assert.equal(Math.round(ink.width), 32, 'the squeeze did not take — the test would be vacuous');
            assert.equal(Math.round(ink.height), 35);
            assert.ok(
                parseFloat(hit.width) >= ORACLE.floor - 0.5,
                `L22: ink squeezed to 32px and the hit box followed it to ${hit.width}. ` +
                'The shared utility must hold --ui-hit-min on the inline axis regardless of ink.',
            );
            assert.ok(
                parseFloat(hit.height) >= ORACLE.floor - 0.5,
                `L22: ink squeezed to 35px and the hit box followed it to ${hit.height}.`,
            );

            const after = await page.computed(CAP('plain'), ['width', 'height'], { pseudo: '::before' });
            assert.equal(Math.round(parseFloat(after.height)), ORACLE.floor, 'the squeeze did not restore');
        }));

        /* == 3. CONTAINER BEHAVIOUR ========================================= */

        test('the host opts OUT of container hosting, because it must fit its glyph', () => mounted(async (page) => {
            // CONVENTIONS §2, and base.js names this very component in the comment that
            // explains the opt-out. With inline-size containment the host could never
            // be the 68px "Space" face.
            const ct = await page.prop('ui-keycap#space', 'container-type');
            assert.equal(
                ct, 'normal',
                'the base sets container-type: inline-size on every :host; a keycap must ' +
                'override it, and the override only works because base rules come FIRST ' +
                '(CONVENTIONS §1 — do not let the base styles land last).',
            );
            // MEASURED, and worth stating because it looks like a failure: a keycap
            // inside a flex or grid parent computes `grid`, not `inline-grid` — the
            // engine blockifies every flex/grid ITEM. #cramped sits in a plain block
            // container, so it is where the authored value is actually observable.
            assert.equal(await page.prop('ui-keycap#cramped', 'display'), 'inline-grid');
            assert.equal(await page.prop('ui-keycap#space', 'display'), 'grid');
        }));

        test('a container narrower than the floor does not shrink the face', () => mounted(async (page) => {
            // spec §2.2 sizing table: "Control heights, touch targets, hairlines |
            // Fixed token. Never fluid. | Ergonomics is physical … A control that
            // shrinks with the window becomes unusable exactly when the window is
            // small." #narrow is 36px against a 48px floor. The oracle has NO vote on
            // this (Part 10 §4 — responsive behaviour; Slate is frozen at 1920×1200).
            const cramped = await page.box(CAP('cramped'));
            assert.ok(
                cramped.width >= ORACLE.floor - 0.5,
                `the face shrank to ${cramped.width}px inside a 36px container. ` +
                'Overflowing is the intended behaviour; shrinking a touch target is not.',
            );
            assert.equal(Math.round(cramped.height), ORACLE.floor);

            // …and it stays one line while doing it.
            const glyph = await page.box(`ui-keycap#cramped >>> #glyph`);
            assert.ok(
                glyph.height <= ORACLE.floor,
                `the label wrapped: the glyph box is ${glyph.height}px tall inside a 48px face.`,
            );
        }));

        test('shrinking the container moves nothing at all', () => mounted(async (page) => {
            const before = await page.box(CAP('plain'));
            await page.setStyle('#row', { 'inline-size': '90px' });
            const during = await page.box(CAP('plain'));
            await page.setStyle('#row', { 'inline-size': null });
            assert.equal(Math.round(during.width), Math.round(before.width));
            assert.equal(Math.round(during.height), Math.round(before.height));
        }));

        /* == NO SELECTION TREATMENT ========================================= */

        test('no selection treatment: all six spellings leave the paint alone', () => mounted(async (page) => {
            // CONVENTIONS §4: the four dials mean something only because there is ONE
            // selection component (#3, the segmented bank). A key is pressed, not
            // selected — and the oracle agrees:
            //   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
            //        box-shadow = none ← (no declaration — inherited or initial value)
            //        (FROZEN/hardcoded)
            // If a later edit imports selectionSurface by habit, this goes red.
            const rest = await page.computed(CAP('plain'), ['background-color', 'color', 'box-shadow']);
            const spellings = [
                ['aria-pressed', 'true'], ['aria-selected', 'true'], ['aria-checked', 'true'],
                ['aria-current', 'true'], ['selected', ''],
            ];
            for (const [name, value] of spellings) {
                await page.evalFn(
                    (s, n, v) => (window.__h.need(s).setAttribute(n, v), true),
                    'ui-keycap#plain', name, value,
                );
            }
            await page.evalFn((s) => (window.__h.need(s).classList.add('is-selected'), true), CAP('plain'));
            await page.settle(1);

            const after = await page.computed(CAP('plain'), ['background-color', 'color', 'box-shadow']);
            assert.deepEqual(
                after, rest,
                'ui-keycap painted a selection state. It is not a selection surface: ' +
                'selectionSurface is deliberately not imported (CONVENTIONS §4).',
            );
        }));

        /* == THE SHADOW BOUNDARY ============================================ */

        test('an !important universal rule in the document cannot repaint the face', () => mounted(async (page) => {
            // This is not hypothetical here. Slate's keycap authored
            // font-family: var(--slate-font-numeric) and LOST it to
            //   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
            //        font-family = Geist, system-ui, sans-serif ← slate-shell.css
            //        `#subpage-host #settings-content-area *` !important=yes
            // — a universal selector in another sheet, reaching a component's internals
            // from 1000 lines away. That is what the boundary removes (CONVENTIONS §6),
            // and it is why this component needs zero `!important` of its own.
            const before = await page.computed(CAP('plain'), ['font-family', 'background-color']);
            await page.evalFn((css) => {
                const s = document.createElement('style');
                s.id = 'reach-in';
                s.textContent = css;
                document.head.appendChild(s);
                return true;
            }, '* , ui-keycap, ui-keycap * { font-family: cursive !important; background-color: rgb(255, 0, 170) !important; }');
            await page.settle(1);
            const after = await page.computed(CAP('plain'), ['font-family', 'background-color']);
            await page.evalFn(() => (document.getElementById('reach-in')?.remove(), true));

            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root. Everything this ' +
                'architecture rests on is that it cannot.',
            );
        }));

        /* == 6. THE ACCESSIBLE NAME ========================================= */

        test('label exposes a name and hides the glyph; no label leaves the text alone', () => mounted(async (page) => {
            const named = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const r = el.shadowRoot;
                return {
                    hidden: r.getElementById('glyph').getAttribute('aria-hidden'),
                    name: r.getElementById('a11y')?.textContent ?? null,
                };
            }, 'ui-keycap#named');
            assert.equal(named.hidden, 'true', 'the glyph must leave the accessibility tree when named');
            assert.equal(named.name, 'Backspace');

            // Visually hidden, still in the tree — 1×1, clipped, not display:none.
            const box = await page.box('ui-keycap#named >>> #a11y');
            assert.ok(box.width <= 2 && box.height <= 2, `the a11y text is ${box.width}×${box.height}, i.e. visible`);
            assert.equal(await page.prop('ui-keycap#named >>> #a11y', 'display'), 'block');

            const plain = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('glyph').getAttribute('aria-hidden'),
                    a11y: r.getElementById('a11y') !== null,
                };
            }, 'ui-keycap#plain');
            assert.equal(plain.hidden, null, 'an unlabelled keycap must NOT hide its own text');
            assert.equal(plain.a11y, false);
        }));

        test('the element is a kbd, and the kbd is the paint surface', () => mounted(async (page) => {
            // Slate renders <kbd id="kb-current-…" class="slate-keycap"> at
            // src/settings/settings.js:9434. The element carries the meaning "user
            // input"; a <div> would throw that away for nothing.
            const tag = await page.evalFn(
                (s) => window.__h.need(s).shadowRoot.getElementById('cap').tagName,
                'ui-keycap#plain',
            );
            assert.equal(tag, 'KBD');
        }));

        /* == [hidden] BEATS THE COMPONENT'S OWN display ====================== */

        test('[hidden] really hides, even though :host declares display', () => mounted(async (page) => {
            // slate-components.css:230-239: "A component sets `display`, which outranks
            // the [hidden] attribute — so hiding one by script silently did nothing.
            // State beats layout." Slate's fix was display: none !important. Here the
            // base's :host([hidden]) is (0,2,0) against this file's (0,1,0) :host, so
            // state beats layout on specificity with zero !important.
            assert.equal(await page.prop('ui-keycap#gone', 'display'), 'none');
            // The visible sibling still lays out. (`grid`, not `inline-grid`: #row is a
            // flex container and the engine blockifies every flex item — see the
            // container-hosting test.)
            assert.equal(await page.prop('ui-keycap#plain', 'display'), 'grid');
            assert.equal(await page.prop('ui-keycap#cramped', 'display'), 'inline-grid');
        }));
    });
}

describe('ui-keycap across both geometries', () => {
    test('the face is identical at 1281×801 @ dsf 1.5 and at the 1000×600 floor', () => {
        // Ergonomics is physical (spec §2.2). Nothing about this component is keyed on
        // viewport OR container size, so the two geometry blocks must agree exactly —
        // and this is the assertion that would catch an @media sneaking in.
        assert.deepEqual(
            acrossGeometries.bench, acrossGeometries.floor,
            `bench ${JSON.stringify(acrossGeometries.bench)} vs floor ${JSON.stringify(acrossGeometries.floor)}`,
        );
        assert.equal(acrossGeometries.bench.one.w, 48);
        assert.equal(acrossGeometries.bench.one.h, 48);
    });
});
