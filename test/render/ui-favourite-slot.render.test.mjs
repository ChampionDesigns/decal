/**
 * ui-favourite-slot.render.test.mjs — Gate A for component #35 (wave 2, item #35).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — ten tokens, each retargeted on :root with the rendered value
 *      asserted to move, to land, and to come back;
 *   2. ONE SELECTION TREATMENT — `assertOneSelectionTreatment`, the four-dial drill.
 *      Wave 1 ran this assertion zero times ("no wave-1 primitive paints a selection
 *      state", waves/1/DONE.json carriedForward[2] / REPORT.md cross-8); this row is
 *      one of the five in wave 2 that does. Plus the harder half, which is this
 *      component's own: OCCUPANCY IS NOT SELECTION, and the only rendered difference
 *      between a selected slot and an identical unselected one is the four dials'
 *      four properties;
 *   3. focus geometry from --ui-focus-*, unclipped, in BOTH offsets (bug L24's class);
 *   4. container behaviour at the floor — the disc reads its own container and
 *      REFUSES to shrink with it (spec §2.2: ergonomics is physical);
 *   5. hit-area floor (spec §2.3 case 2, Appendix 5) through the ONE shared utility,
 *      including the case that makes the utility do work: ink 32px, floor still 48px;
 *   6. BUG P4, asserted dead in all three of its halves (see below);
 *   7. the aria contract (spec Appendix 15) — the selection state IS the aria state,
 *      and a disc showing "3" has an accessible name.
 *
 * ============================================================================
 * P4, AND THE MISREADING THIS SUITE EXISTS TO NOT REPEAT
 * ============================================================================
 * §7.3: "P4 | The favourite slots take their GEOMETRY from one rule and their PAINT
 * from another 1300 lines away; measured 64x64, so --slate-hit-min is silently not
 * applied where the comment says it is, and the favourites row is 113px rather than
 * ~96."
 *
 * 64 is LARGER than the 48px floor. P4 is not "the target is too small" — wave 1's
 * item #2 read it that way and withdrew the claim in the fix phase (waves/1/
 * REPORT.md:146-153), and the misreading is still live in five files, the shared one
 * being test/harness/assertions.js:467, whose message reads "a floor the comment
 * claims and the box does not have". That file is single-writer and not this row's to
 * edit, so `assertHitFloor` is used here for the half it really does check — the
 * rendered floor — and P4's own half is asserted separately, three ways:
 *
 *   P4 (a) THE TOKEN IS THE BOX. Slate's `width: var(--slate-hit-min)` wins its
 *          source-order tie and the box is still 64, because `min-width: 64px` from
 *          1300 lines up is a DIFFERENT PROPERTY and clamps the used value. So: the
 *          disc measures --ui-hit-min, it MOVES when the token moves, and it declares
 *          no min-inline-size / min-block-size at all — one owner per dimension
 *          (spec §2.3).
 *   P4 (b) THE SECOND RULE IS UNREACHABLE. The defect's exact shape, injected from
 *          the document with `!important` — width/height/min-width/min-height at 64px
 *          — moves nothing, because it cannot cross the shadow boundary.
 *   P4 (c) THE ROW ARITHMETIC. "the favourites row is 113px rather than ~96": a row
 *          of five slots is 48 tall, not 64. (The row itself is #36's, wave 4; what
 *          this element owes it is the 48.)
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY in both themes, because "measured from the
 * oracle" should be checkable rather than claimed. Every literal carries its CITE.
 * The oracle's GEOMETRY is disqualified here and quoted only as what Slate does —
 * the element is on the 140-bug list, at P4 (SCOPE Part 10 §4 disqualification).
 *
 * TWO MEASUREMENT NOTES.
 *   - `box-sizing` is border-box (base.js:426 + the `:where(*)` inherit at :456), so
 *     getComputedStyle().width is the CONTENT box (46px inside a 48px disc) while
 *     getBoundingClientRect is the border box. Every box assertion below reads the
 *     rect; the one drill that must land on a length uses a custom reader for the
 *     same reason.
 *   - color-mix serialises as `color(srgb …)` in Chrome and the corpus recorded it
 *     that way. Colours are compared numerically with a tolerance rather than by
 *     string, so the assertion survives a serialisation change and still fails on a
 *     wrong colour.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-favourite-slot.js'];

/* The profile-selector row the oracle measured, rebuilt in Decal terms: five slots,
 * the first three occupied and the last two empty.
 *   CITE prov_query.py find --cls ps-fav-slot → "found 5 element(s) in 1 state(s)";
 *        profile-selector, rects [207,1112,64,64] [293,1112,64,64] [379,1112,64,64]
 *        [465,1112,64,64] [551,1112,64,64]; "distinct geometries (w x h), all matched
 *        elements: 64 x 64 x5" — DISQUALIFIED as a target (this is P4 itself), quoted
 *        as what Slate does. */
const MARKUP = `
<div id="row" style="padding: 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
    <ui-favourite-slot id="empty" index="4"></ui-favourite-slot>
    <ui-favourite-slot id="fill" index="1" filled label="Cremina"></ui-favourite-slot>
    <ui-favourite-slot id="pick" index="2" filled selected label="Londinium"></ui-favourite-slot>
    <ui-favourite-slot id="bare" index="3" selected></ui-favourite-slot>
    <ui-favourite-slot id="off" index="5" disabled></ui-favourite-slot>
    <ui-favourite-slot id="gone" index="5" hidden></ui-favourite-slot>
    <ui-favourite-slot id="mark" index="1">C</ui-favourite-slot>
</div>
<div id="bank" style="display: flex; gap: 8px; align-items: center">
    <ui-favourite-slot id="b1" index="1" filled></ui-favourite-slot>
    <ui-favourite-slot id="b2" index="2" filled></ui-favourite-slot>
    <ui-favourite-slot id="b3" index="3" filled></ui-favourite-slot>
    <ui-favourite-slot id="b4" index="4"></ui-favourite-slot>
    <ui-favourite-slot id="b5" index="5"></ui-favourite-slot>
</div>
<div id="clipper" style="overflow: hidden; inline-size: 112px; display: flex; gap: 8px">
    <ui-favourite-slot id="inset" index="1" focus-ring="inset"></ui-favourite-slot>
</div>
<div id="narrow" style="inline-size: 36px">
    <ui-favourite-slot id="cramped" index="1"></ui-favourite-slot>
</div>
<div id="dense" style="--_ui-fav-slot-size: 32px; padding: 8px">
    <ui-favourite-slot id="small" index="1"></ui-favourite-slot>
</div>
`;

const HOST = (id) => `ui-favourite-slot#${id}`;
const SLOT = (id) => `ui-favourite-slot#${id} >>> #slot`;

/* The oracle's own numbers, named once. Paint only — the geometry is disqualified.
 *   CITE profile-selector #assign-fav-btn-3 [i=170] background-color = rgba(0, 0, 0, 0)
 *        ← slate-shell.css `#subpage-host .ps-fav-slot` authored `transparent`
 *        !important=no (FROZEN/hardcoded)
 *   CITE profile-selector #assign-fav-btn-3 [i=170] color = rgb(148, 161, 169)
 *        ← `#subpage-host .ps-fav-slot` authored `var(--slate-muted)` (token-driven)
 *        [prov-light rgb(90, 101, 108)]
 *   CITE profile-selector #assign-fav-btn-3 [i=170] border-top-color = rgb(82, 97, 107)
 *        ← `#subpage-host .ps-fav-slot` authored `(NOT CAPTURED — shorthand)`
 *        (token-driven)  [prov-light rgb(170, 178, 183); slate-shell.css:1671
 *        `border: var(--slate-hairline) solid var(--slate-line-strong)`]
 *   CITE profile-selector #assign-fav-btn-0 [i=167] background-color = rgb(23, 59, 77)
 *        ← `#subpage-host .ps-fav-slot[data-occupied="true"]` authored `(NOT CAPTURED
 *        — shorthand)` (token-driven)   [prov-light rgb(35, 79, 99)]
 *   CITE profile-selector #assign-fav-btn-0 [i=167] color = rgb(246, 251, 253)
 *        ← same rule, authored `var(--slate-on-primary)`  [prov-light rgb(248, 252, 253)]
 *   CITE profile-selector #assign-fav-btn-0 [i=167] border-top-color =
 *        color(srgb 0.258196 0.381804 0.443608)  [prov-light color(srgb 0.152627
 *        0.324078 0.40251)] ← same rule, authored `(NOT CAPTURED — shorthand)`
 *        [slate-shell.css:1680 color-mix(in srgb, var(--slate-primary) 72%,
 *        var(--slate-steel))]
 *   CITE profile-selector #assign-fav-btn-0 [i=167] font-size = 17px ←
 *        `var(--slate-text-base)`; font-weight = 500 ← `var(--slate-weight-medium)`;
 *        box-shadow = none (FROZEN); letter-spacing = normal; text-transform = none;
 *        opacity = 1; font-family = Geist, system-ui, sans-serif */
const ORACLE = {
    dark: {
        empty: { face: 'rgba(0, 0, 0, 0)', ink: 'rgb(148, 161, 169)', edge: 'rgb(82, 97, 107)' },
        filled: { face: 'rgb(23, 59, 77)', ink: 'rgb(246, 251, 253)', edge: 'color(srgb 0.258196 0.381804 0.443608)' },
    },
    light: {
        empty: { face: 'rgba(0, 0, 0, 0)', ink: 'rgb(90, 101, 108)', edge: 'rgb(170, 178, 183)' },
        filled: { face: 'rgb(35, 79, 99)', ink: 'rgb(248, 252, 253)', edge: 'color(srgb 0.152627 0.324078 0.40251)' },
    },
    fontSize: '17px',
    fontWeight: '500',
    /* The floor, from the token Slate's own rule already names (slate-shell.css:1669-
     * 1670 `width: var(--slate-hit-min)`), NOT from the disqualified 64. */
    floor: 48,
    /* What Slate renders, quoted so the departure is checkable rather than claimed. */
    slateBox: 64,
};

/** Whole CSS px — the comparison CONVENTIONS §10 mandates at dsf 1.5. */
const roundPx = (v) => Math.round(parseFloat(v));

/**
 * A computed colour as [r,g,b] in 0..1, whatever serialisation Chrome chose.
 * `color(srgb 0.25 0.38 0.44)` and `rgb(64, 97, 112)` become comparable, so a
 * color-mix assertion cannot be defeated by a serialisation change.
 */
function srgb(value) {
    const nums = String(value).match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number) ?? [];
    if (/^color\(/.test(String(value))) return nums.slice(0, 3);
    return nums.slice(0, 3).map((n) => n / 255);
}

function assertColourEqual(got, want, message) {
    const a = srgb(got);
    const b = srgb(want);
    assert.equal(a.length, 3, `${message}\n  unreadable colour: ${got}`);
    const off = a.map((n, i) => Math.abs(n - b[i]));
    assert.ok(
        off.every((d) => d < 0.003),
        `${message}\n  expected ${want}\n  computed ${got}\n  channel deltas ${off.map((d) => d.toFixed(5)).join(', ')}`,
    );
}

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-favourite-slot @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-favourite-slot must mount without throwing');
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

        test('drill: --ui-hit-min IS the box, and the hit overlay with it — P4 (a)', () => mounted(async (page) => {
            // The honest form of "the comment is true". Slate's rule cites the token
            // and the box is 64 anyway; here, moving the token moves the disc.
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                // The rect, not getComputedStyle().width: box-sizing is border-box, so
                // the computed width is the 46px content box inside a 48px disc.
                read: async (p) => Math.round((await p.box(SLOT('empty'))).width),
                expected: parseFloat(DRILL_LENGTH),
            });
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                read: async (p) => Math.round((await p.box(SLOT('empty'))).height),
                expected: parseFloat(DRILL_LENGTH),
            });
            // …and the shared utility's transparent ::before moves with it, which is
            // what makes the floor a floor rather than a comment (Appendix 5).
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: SLOT('empty'),
                property: 'width',
                pseudo: '::before',
                expected: DRILL_LENGTH,
            });
        }));

        test('drill: the empty disc reads --ui-muted and --ui-line-strong', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted', selector: SLOT('empty'), property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong', selector: SLOT('empty'), property: 'border-top-color',
            });
        }));

        test('drill: the filled disc reads --ui-primary and --ui-on-primary', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-primary', selector: SLOT('fill'), property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-on-primary', selector: SLOT('fill'), property: 'color',
            });
            // The occupancy rim is Slate's own mix, so it must move with EITHER input.
            const edge = await page.prop(SLOT('fill'), 'border-top-color');
            await page.setToken('--ui-steel', DRILL_COLOUR);
            const mixed = await page.prop(SLOT('fill'), 'border-top-color');
            await page.setToken('--ui-steel', null);
            assert.notEqual(
                mixed, edge,
                'the filled rim is color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel)); ' +
                'moving --ui-steel must move it, or the mix has been flattened to a literal.',
            );
        }));

        test('drill: type is --ui-text-base / --ui-weight-medium, radius is --ui-radius-pill', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: SLOT('empty'), property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-medium', value: '800',
                selector: SLOT('empty'), property: 'font-weight',
            });
            await assertTokenDrill(page, {
                token: '--ui-radius-pill', value: DRILL_LENGTH,
                selector: SLOT('empty'), property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-opacity-disabled dims the host, exactly once', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: HOST('off'), property: 'opacity',
            });
            // The base paints BOTH spellings — :host(:is([disabled],…)) and
            // :where([disabled],…) inside the tree — and this control legitimately
            // carries both. .38 × .38 = .14 is a control three times fainter than the
            // one dial says (ui-button.js:221-231 makes the same correction).
            const inner = await page.prop(SLOT('off'), 'opacity');
            assert.equal(inner, '1', `double-dim: the disc inside a disabled slot computes opacity ${inner}`);
        }));

        /* == 2. ONE SELECTION TREATMENT ===================================== */

        test('the four dials are the whole of the selected state', () => mounted(async (page) => {
            // cross-8's first subjects: wave 1 ran this assertion zero times.
            // `unselected` is the FILLED-but-unselected disc, not the empty one — the
            // stronger claim, because occupancy is the paint most easily mistaken for
            // selection (bug L8/BUG-12 is exactly that mistake, in the favourites bank).
            await assertOneSelectionTreatment(page, {
                selected: SLOT('pick'),
                unselected: SLOT('fill'),
            });
        }));

        test('occupancy is NOT selection: --ui-primary and --ui-selected-face stay apart', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            const primary = await page.resolveToken('--ui-primary', 'background-color');
            assert.notEqual(
                primary, face,
                'a filled slot and a selected slot would be the same block of colour, which is ' +
                'how "the favourites bank bypasses the dials" (L8) looks from the outside.',
            );

            const filled = await page.prop(SLOT('fill'), 'background-color');
            assert.equal(filled, primary, 'a filled, unselected slot paints --ui-primary');

            // A slot that is BOTH: selection is a STATE treatment and beats the resting
            // paint (CONVENTIONS §4 rule 1). This is the assertion the private-property
            // indirection in the component exists to pass — the obvious spelling,
            // `:host([filled]) .slot { … }` at (0,3,0), fails it silently.
            const both = await page.prop(SLOT('pick'), 'background-color');
            assert.equal(
                both, face,
                'a filled AND selected slot must paint --ui-selected-face. Getting --ui-primary ' +
                'here means the occupancy rule out-specifies selectionSurface (0,1,0).',
            );

            // And an unfilled selected slot is painted by the dials too — selection is
            // not a modifier of occupancy.
            assert.equal(await page.prop(SLOT('bare'), 'background-color'), face);
        }));

        test('nothing but the four dial properties differs between selected and unselected', () => mounted(async (page) => {
            // The founding defect, stated as a measurement: two discs identical in every
            // respect except the state. If anything else moves — a border, a radius, a
            // weight, an outline — a second selection treatment has been born, which is
            // "the seventh" the standing assertion exists to stop (Part 8 §2).
            const props = [
                'border-top-color', 'border-top-width', 'border-top-left-radius',
                'border-bottom-right-radius', 'font-size', 'font-weight', 'font-family',
                'letter-spacing', 'text-transform', 'opacity', 'width', 'height',
                'padding-left', 'padding-top', 'cursor', 'outline-style', 'outline-width',
                'display', 'text-align',
            ];
            const selected = await page.computed(SLOT('pick'), props);
            const unselected = await page.computed(SLOT('fill'), props);
            assert.deepEqual(
                selected, unselected,
                'a property outside the four dials changes with the selection state.',
            );
        }));

        test('the dials retarget without a rule change — Radian on Slate rules', () => mounted(async (page) => {
            // "Four values, zero rule changes" (spec §3.9). Slate ships led 0px / glow
            // 0%; Radian moves the two, and this component's CSS does not change.
            await page.setToken('--ui-selected-led', '4px');
            await page.setToken('--ui-selected-glow', '55%');
            const led = await page.prop(SLOT('pick'), 'box-shadow');
            const glow = await page.prop(SLOT('pick'), 'text-shadow');
            await page.setToken('--ui-selected-led', null);
            await page.setToken('--ui-selected-glow', null);

            assert.match(led, /inset/, `the LED strip did not appear at 4px: ${led}`);
            assert.match(led, /-4px/, `the LED strip is not the dial's length: ${led}`);
            assert.ok(
                !/rgba\([^)]*,\s*0\)\s*$/.test(glow.trim()),
                `the glow stayed fully transparent at 55%: ${glow}`,
            );
        }));

        /* == 3. FOCUS GEOMETRY, UNCLIPPED (bug L24's class) ================= */

        test('the ring is --ui-focus-*, unclipped, in both offsets', () => mounted(async (page) => {
            await assertFocusUnclipped(page, SLOT('empty'));
            // The same ring drawn INSIDE the box, for a slot in an overflow:hidden row —
            // L24 is "focus rings clipped on all four sides by the components they sit
            // inside", and a favourites bank is exactly such a row.
            await assertFocusUnclipped(page, SLOT('inset'));
        }));

        test('a selected disc still shows the one ring', () => mounted(async (page) => {
            // Selection paints background, ink and two shadows; it must not eat the
            // outline, and the ring must not become a second selected look.
            const g = await assertFocusUnclipped(page, SLOT('pick'));
            assert.equal(g.outlineColor, await page.resolveValue('var(--ui-steel)', 'outline-color'));
        }));

        /* == 4. THE HIT FLOOR — ONE UTILITY, INK SEPARATE FROM THE FLOOR ==== */

        test('the hit box reaches --ui-hit-min on both axes', () => mounted(async (page) => {
            const got = await assertHitFloor(page, SLOT('empty'));
            assert.equal(got.floor, ORACLE.floor);
            assert.ok(got.inline >= ORACLE.floor - 0.5 && got.block >= ORACLE.floor - 0.5);
        }));

        test('ink is separate from the hit floor: a 32px disc still presses 48px', () => mounted(async (page) => {
            // Appendix 5's actual claim, and what makes the shared utility do work here
            // rather than tie. spec §4.2's list row wants "the favourite disc" and
            // Slate's own .ps-fav-badge is "the SAME disc, one size down" at 44px
            // (slate-shell.css:1685-1694) — one custom property, and the floor holds.
            const ink = await page.box(SLOT('small'));
            assert.equal(Math.round(ink.width), 32, 'the ink did not follow --_ui-fav-slot-size');
            assert.equal(Math.round(ink.height), 32);

            const hit = await assertHitFloor(page, SLOT('small'));
            assert.ok(
                hit.inline >= ORACLE.floor - 0.5 && hit.block >= ORACLE.floor - 0.5,
                `a 32px disc must still accept a 48px press; measured ${hit.inline}×${hit.block}`,
            );

            // The paint did not move with the hit box: that is the whole separation.
            assert.equal(
                await page.prop(SLOT('small'), 'background-color'),
                await page.prop(SLOT('empty'), 'background-color'),
            );
        }));

        /* == 5. BUG P4, ASSERTED DEAD ======================================= */

        test('P4 (a): the disc is --ui-hit-min and declares no min-* clamp', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box(SLOT('empty'));
            assert.equal(Math.round(box.width), floor);
            assert.equal(Math.round(box.height), floor);
            assert.notEqual(
                Math.round(box.width), ORACLE.slateBox,
                'the disc measures Slate\'s 64 — the disqualified geometry has been copied.',
            );

            // P4's MECHANISM: `min-width: 64px` in a rule 1300 lines from the one that
            // sets `width: var(--slate-hit-min)`. A min-* is a different property, so it
            // clamps the used value without ever losing a cascade fight. There is no
            // min-* here at all — one owner per dimension (spec §2.3).
            const clamps = await page.computed(SLOT('empty'), ['min-width', 'min-height']);
            assert.deepEqual(clamps, { 'min-width': 'auto', 'min-height': 'auto' });
        }));

        test('P4 (b): the second rule cannot reach in, even with !important', () => mounted(async (page) => {
            const before = await page.box(SLOT('empty'));
            await page.evalFn((rules) => {
                const s = document.createElement('style');
                s.id = 'p4-reach-in';
                s.textContent = rules;
                document.head.appendChild(s);
                return true;
            }, '*, ui-favourite-slot, ui-favourite-slot * {'
             + ' width: 64px !important; min-width: 64px !important;'
             + ' height: 64px !important; min-height: 64px !important; }');
            await page.settle(1);
            const after = await page.box(SLOT('empty'));
            await page.evalFn(() => (document.getElementById('p4-reach-in')?.remove(), true));

            assert.equal(
                Math.round(after.width), Math.round(before.width),
                'P4\'s own rule shape, injected from the document, resized the disc. The whole ' +
                'remedy is that geometry has one owner and nothing outside can add a second.',
            );
            assert.equal(Math.round(after.height), Math.round(before.height));
        }));

        test('P4 (c): a row of five slots is 48 tall, not 64', () => mounted(async (page) => {
            // "…and the favourites row is 113px rather than ~96." The row is #36's
            // (wave 4); what this element owes it is the 48.
            const bank = await page.box('#bank');
            assert.equal(
                Math.round(bank.height), ORACLE.floor,
                `five slots make a ${Math.round(bank.height)}px row; Slate's is 113 because the ` +
                'slots are 64x64, not 48 (spec §4.2, "Measured today").',
            );
            const first = await page.box(SLOT('b1'));
            const last = await page.box(SLOT('b5'));
            assert.equal(Math.round(first.height), ORACLE.floor);
            assert.equal(Math.round(last.height), ORACLE.floor);
            // Filled and empty are the same box — occupancy is paint, never geometry.
            assert.equal(Math.round(first.width), Math.round(last.width));

            acrossGeometries[geometry.name] = {
                disc: { w: Math.round(first.width), h: Math.round(first.height) },
                row: Math.round(bank.height),
                fontSize: await page.prop(SLOT('b1'), 'font-size'),
                hit: (await assertHitFloor(page, SLOT('b1'))).block,
            };
        }));

        /* == 6. CONTAINER BEHAVIOUR AT THE FLOOR ============================ */

        test('in a 36px container the disc overflows rather than shrinking', () => mounted(async (page) => {
            // The oracle has no vote — Slate is frozen at 1920x1200 and never meets a
            // narrow container — so §2.2 governs: "Control heights, touch targets,
            // hairlines | Fixed token. Never fluid … A control that shrinks with the
            // window becomes unusable exactly when the window is small."
            const box = await page.box(SLOT('cramped'));
            assert.equal(Math.round(box.width), ORACLE.floor);
            assert.equal(Math.round(box.height), ORACLE.floor);
            const host = await page.box(HOST('cramped'));
            assert.ok(
                host.width >= ORACLE.floor - 0.5,
                `the host shrank to ${host.width}px — the container-hosting opt-out is gone and ` +
                'inline-size containment has frozen the disc at its parent\'s width.',
            );
        }));

        test('no @container/@media dependence: the disc is identical in every container', () => mounted(async (page) => {
            const wide = await page.box(SLOT('empty'));
            await page.setStyle('#row', { 'inline-size': '200px' });
            const narrow = await page.box(SLOT('empty'));
            await page.setStyle('#row', { 'inline-size': null });
            assert.equal(Math.round(narrow.width), Math.round(wide.width));
            assert.equal(Math.round(narrow.height), Math.round(wide.height));
        }));

        /* == 7. ORACLE PARITY, both themes ================================= */

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: empty and filled, face ink and edge`, () => mounted(async (page) => {
                await page.setTheme(theme);

                const empty = await page.computed(SLOT('empty'), ['background-color', 'color', 'border-top-color']);
                assert.equal(empty['background-color'], ORACLE[theme].empty.face);
                assertColourEqual(empty.color, ORACLE[theme].empty.ink, 'empty slot ink');
                assertColourEqual(empty['border-top-color'], ORACLE[theme].empty.edge, 'empty slot edge');

                const filled = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
                assertColourEqual(filled['background-color'], ORACLE[theme].filled.face, 'filled slot face');
                assertColourEqual(filled.color, ORACLE[theme].filled.ink, 'filled slot ink');
                // The 72%/steel mix, reproduced to the corpus's six decimals.
                assertColourEqual(filled['border-top-color'], ORACLE[theme].filled.edge, 'filled slot rim');
            }));
        }

        test('oracle parity: the theme-invariant properties', () => mounted(async (page) => {
            const got = await page.computed(SLOT('empty'), [
                'font-size', 'font-weight', 'font-family', 'box-shadow',
                'letter-spacing', 'text-transform', 'opacity', 'border-top-width',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.match(got['font-family'], /Geist/);
            // CITE … box-shadow = none ← (no declaration) (FROZEN/hardcoded). Also the
            // standing proof that selectionSurface reaches only a selected element: the
            // fragment puts a two-item list here the moment a state matches.
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(roundPx(got['border-top-width']), 1, 'the rim is one --ui-border-w hairline');
        }));

        test('the disc is round, from --ui-radius-pill', () => mounted(async (page) => {
            // CARVE-OUT, stated: "prov_query: property not probed: border-radius", so
            // the corpus has no answer and the fall-through source is P4's own pair,
            // disagreeing with itself (slate-shell.css:357 var(--slate-radius) vs :1672
            // 50%, the later winning the source-order tie). Shipped as the disc, behind
            // --_ui-fav-slot-radius; recorded as a deferred question.
            const r = await page.prop(SLOT('empty'), 'border-top-left-radius');
            assert.ok(
                parseFloat(r) >= ORACLE.floor / 2,
                `the radius is ${r}; a disc needs at least half the box (${ORACLE.floor / 2}px).`,
            );
            await page.setStyle(HOST('empty'), { '--_ui-fav-slot-radius': '6px' });
            const square = await page.prop(SLOT('empty'), 'border-top-left-radius');
            await page.setStyle(HOST('empty'), { '--_ui-fav-slot-radius': null });
            assert.equal(square, '6px', 'the radius knob is not wired — the square is not one property away');
        }));

        /* == 8. THE ARIA CONTRACT (spec Appendix 15) ======================== */

        test('selection is the aria state, on the control the eye sees', () => mounted(async (page) => {
            const read = (id) => page.evalFn((s) => {
                const el = window.__h.need(s);
                const btn = el.shadowRoot.getElementById('slot');
                return {
                    pressed: btn.getAttribute('aria-pressed'),
                    hostAttr: el.hasAttribute('selected'),
                    tag: btn.tagName,
                };
            }, HOST(id));

            assert.deepEqual(await read('pick'), { pressed: 'true', hostAttr: true, tag: 'BUTTON' });
            assert.deepEqual(await read('fill'), { pressed: 'false', hostAttr: false, tag: 'BUTTON' });

            // Visual state and accessibility state are the SAME state, so they cannot
            // drift (Appendix 15). Setting the property must move both.
            await page.evalFn((s) => (window.__h.need(s).selected = true, true), HOST('fill'));
            await page.settle(1);
            const after = await read('fill');
            assert.equal(after.pressed, 'true');
            assert.equal(after.hostAttr, true, 'the property is reflected, so a bank can select by attribute');
            assert.equal(
                await page.prop(SLOT('fill'), 'background-color'),
                await page.resolveToken('--ui-selected-face', 'background-color'),
            );
        }));

        test('a consumer may spell selection on the host and still get the one treatment', () => mounted(async (page) => {
            // #36 composes #3 with this element; if the bank puts aria-selected on the
            // host, selectionSurface's :host(:is(…)) block paints it — same four dials.
            await page.setStyle(HOST('empty'), {});
            await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('empty'));
            await page.settle(1);
            const host = await page.prop(HOST('empty'), 'background-color');
            const radius = await page.prop(HOST('empty'), 'border-top-left-radius');
            await page.evalFn((s) => (window.__h.need(s).removeAttribute('aria-selected'), true), HOST('empty'));
            assert.equal(host, await page.resolveToken('--ui-selected-face', 'background-color'));
            assert.ok(
                parseFloat(radius) >= ORACLE.floor / 2,
                `the host paints a square (${radius}) behind a round disc.`,
            );
        }));

        test('…and the DISC gets out of the way of it — both spellings paint the same slot',
            () => mounted(async (page) => {
                // Fix-phase finding c2-3, and the test above is exactly why it survived
                // 92 green tests: it used the EMPTY slot and asserted only the HOST's
                // background-color, so it never looked at the disc that covers the host
                // pixel for pixel (`:host { display: inline-grid }`, sized to a 48×48
                // disc). MEASURED before the fix, `<ui-favourite-slot filled
                // aria-selected="true">`: host rgb(176, 196, 206) = --ui-selected-face,
                // disc rgb(23, 59, 77) = --ui-primary, ink rgb(246, 251, 253) — a
                // filled+selected slot rendering pixel-identical to an unselected one on
                // the exact composition path #36 is documented to take.
                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                const ink = await page.resolveToken('--ui-selected-ink', 'color');
                const primary = await page.resolveToken('--ui-primary', 'background-color');

                // What a VIEWER sees: the first opaque ground in the disc→host stack.
                // Neither element alone is the answer, which is the whole defect.
                const painted = (id) => page.evalFn((s) => {
                    const el = window.__h.need(s);
                    const stack = [el.shadowRoot.getElementById('slot'), el];
                    for (const node of stack) {
                        const bg = getComputedStyle(node).backgroundColor;
                        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
                    }
                    return 'rgba(0, 0, 0, 0)';
                }, HOST(id));

                for (const spelling of ['aria-selected', 'aria-checked', 'aria-current', 'aria-pressed']) {
                    await page.evalFn(
                        (s, a) => (window.__h.need(s).setAttribute(a, 'true'), true),
                        HOST('fill'), spelling,
                    );
                    await page.settle(1);

                    assert.equal(await painted('fill'), face,
                        `[${spelling}] on the host leaves the slot painted ${await painted('fill')} — `
                        + `--ui-primary is ${primary} and --ui-selected-face is ${face}; dial 1 is hidden`);
                    assert.notEqual(await page.prop(SLOT('fill'), 'background-color'), primary,
                        `[${spelling}] the disc keeps its occupancy fill ON TOP of the selected face`);
                    assert.equal(await page.prop(SLOT('fill'), 'color'), ink,
                        `[${spelling}] the disc keeps its own ink over the selected face — dial 2 is dead`);

                    await page.evalFn(
                        (s, a) => (window.__h.need(s).removeAttribute(a), true),
                        HOST('fill'), spelling,
                    );
                    await page.settle(1);
                    assert.equal(await painted('fill'), primary,
                        `[${spelling}] removing it must restore the occupancy fill exactly`);
                    assert.equal(await page.prop(SLOT('fill'), 'color'),
                        await page.resolveToken('--ui-on-primary', 'color'));
                }

                // THE TWO SPELLINGS AGREE. #pick is `selected` (the property, which
                // renders aria-pressed onto the button); #fill carries aria-selected on
                // the host. Different rules, one rendered slot.
                await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('fill'));
                await page.settle(1);
                assert.equal(await painted('fill'), await painted('pick'),
                    'the host spelling and the property spelling must render one face');
                assert.equal(await page.prop(SLOT('fill'), 'color'), await page.prop(SLOT('pick'), 'color'),
                    'and one ink');

                // Dial 3 stays reachable on this path, which is why the disc is
                // TRANSPARENT rather than repainted with the face: an opaque disc would
                // cover the host's inset LED even when it matched the face exactly.
                assert.equal(await page.prop(SLOT('fill'), 'background-color'), 'rgba(0, 0, 0, 0)',
                    'the disc must let the ONE painted surface through, LED included');
                const led = await assertTokenDrill(page, {
                    token: '--ui-selected-led',
                    value: DRILL_LENGTH,
                    selector: HOST('fill'),
                    property: 'box-shadow',
                    expectLanding: false,
                });
                assert.match(led.after, /inset/,
                    'moving --ui-selected-led must move a real inset strip on the painted surface');
                assert.notEqual(led.before, led.after, 'the LED dial is inert on the host spelling');
            }));

        test('DEPARTURE 6: selection replaces the occupancy FILL and keeps the occupancy RIM',
            () => mounted(async (page) => {
                // Slate has no rendered answer — its five slots have occupancy and no
                // selected state at all — so this is the wave law resolving a case the
                // oracle never met. border-color is not one of the four dials, so the rim
                // survives and goes on carrying "something lives here" once the face
                // cannot. Asserted on BOTH spellings, because the fix routes them
                // through different rules and only one of them was ever checked.
                const edge = await page.prop(SLOT('fill'), 'border-top-color');
                await page.evalFn((s) => (window.__h.need(s).setAttribute('aria-selected', 'true'), true), HOST('fill'));
                await page.settle(1);
                assert.equal(await page.prop(SLOT('fill'), 'border-top-color'), edge,
                    'the host spelling repainted the rim — border-color is not a fifth dial');
                assert.equal(await page.prop(SLOT('pick'), 'border-top-color'), edge,
                    'and neither did the property spelling');
            }));

        test('label names the disc; without one the mark is the name', () => mounted(async (page) => {
            const named = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('mark').getAttribute('aria-hidden'),
                    name: r.getElementById('a11y')?.textContent ?? null,
                };
            }, HOST('fill'));
            assert.equal(named.hidden, 'true', 'the numeral must leave the accessibility tree when named');
            assert.equal(named.name, 'Cremina');

            // Visually hidden, still in the tree — 1×1, clipped, not display:none
            // (the SHARED visuallyHidden fragment, CONVENTIONS §5a).
            const box = await page.box(`${HOST('fill')} >>> #a11y`);
            assert.ok(box.width <= 2 && box.height <= 2, `the a11y text is ${box.width}×${box.height}, i.e. visible`);

            const plain = await page.evalFn((s) => {
                const r = window.__h.need(s).shadowRoot;
                return {
                    hidden: r.getElementById('mark').getAttribute('aria-hidden'),
                    a11y: r.getElementById('a11y') === null,
                    text: r.getElementById('slot').textContent.trim(),
                };
            }, HOST('empty'));
            assert.equal(plain.hidden, null, 'an unnamed disc must keep its numeral in the tree');
            assert.equal(plain.a11y, true);
            assert.equal(plain.text, '4', 'index is the fallback content of the mark slot');
        }));

        test('slotted content wins over index, and the disc keeps its box', () => mounted(async (page) => {
            // The flattened tree is the truth here, not textContent: the fallback text
            // node lives in the shadow tree whether or not anything is assigned, and is
            // simply not rendered once something is. Asserting on textContent would read
            // "1" for a disc that displays "C".
            // `flatten: true` renders the fallback when nothing is assigned, so the two
            // questions need the two spellings: assignedNodes() answers "did the light
            // tree supply a mark", flattened answers "what does the disc show".
            const marked = await page.evalFn((s) => {
                const slotEl = window.__h.need(s).shadowRoot.querySelector('slot');
                const shown = slotEl.assignedNodes({ flatten: true });
                return {
                    assigned: slotEl.assignedNodes().length,
                    text: shown.map((x) => x.textContent).join('').trim(),
                };
            }, HOST('mark'));
            assert.deepEqual(marked, { assigned: 1, text: 'C' }, 'the slotted mark must replace the index fallback');

            const plain = await page.evalFn((s) => {
                const slotEl = window.__h.need(s).shadowRoot.querySelector('slot');
                const shown = slotEl.assignedNodes({ flatten: true });
                return {
                    assigned: slotEl.assignedNodes().length,
                    text: shown.map((x) => x.textContent).join('').trim(),
                };
            }, HOST('empty'));
            assert.deepEqual(plain, { assigned: 0, text: '4' }, 'index is the fallback content');

            const box = await page.box(SLOT('mark'));
            assert.equal(Math.round(box.width), ORACLE.floor);
        }));

        test('the press: click composes out of the shadow root, and disabled refuses it', () => mounted(async (page) => {
            const arm = (id) => page.evalFn((s) => {
                const el = window.__h.need(s);
                el.__clicks = 0;
                el.addEventListener('click', () => { el.__clicks += 1; });
                return true;
            }, HOST(id));
            const count = (id) => page.evalFn((s) => window.__h.need(s).__clicks, HOST(id));

            await arm('empty');
            await page.click(SLOT('empty'));
            assert.equal(await count('empty'), 1, 'the native button\'s click must retarget to the host');

            await arm('off');
            await page.click(SLOT('off'));
            assert.equal(
                await count('off'), 0,
                'a disabled slot fired a click. The host attribute dims; the NATIVE attribute on the ' +
                'real button is what refuses (CONVENTIONS §4).',
            );
            const nativelyDisabled = await page.evalFn((s) => window.__h.need(s).shadowRoot
                .getElementById('slot').disabled, HOST('off'));
            assert.equal(nativelyDisabled, true);
        }));

        test('[hidden] really hides, with no !important', () => mounted(async (page) => {
            // slate-components.css:230-239: "A component sets display, which outranks
            // the [hidden] attribute — so hiding one by script silently did nothing."
            // Here the base's :host([hidden]) is (0,2,0) and this file's :host is
            // (0,1,0), so state beats layout on specificity (CONVENTIONS §6).
            assert.equal(await page.prop(HOST('gone'), 'display'), 'none');
            // The container-hosting opt-out is `display: inline-grid`, and a host in a
            // plain block context computes exactly that. In the flex row above it
            // computes `grid` instead — CSS blockifies a flex item — which is the
            // engine's doing, not a second declaration.
            assert.equal(await page.prop(HOST('cramped'), 'display'), 'inline-grid');
            assert.equal(await page.prop(HOST('empty'), 'display'), 'grid');
        }));

        test('a document rule cannot repaint the disc', () => mounted(async (page) => {
            const before = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
            await page.evalFn((rules) => {
                const s = document.createElement('style');
                s.id = 'repaint-reach-in';
                s.textContent = rules;
                document.head.appendChild(s);
                return true;
            }, '*, ui-favourite-slot, ui-favourite-slot * { background-color: rgb(255, 0, 170) !important;'
             + ' color: rgb(255, 0, 170) !important; border-color: rgb(255, 0, 170) !important; }');
            await page.settle(1);
            const after = await page.computed(SLOT('fill'), ['background-color', 'color', 'border-top-color']);
            await page.evalFn(() => (document.getElementById('repaint-reach-in')?.remove(), true));
            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root — the paint half of P4 (two rules, ' +
                'one element) is back.',
            );
        }));
    });
}

describe('ui-favourite-slot gallery entry', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-favourite-slot.entry.js)
    // because twelve wave-2 builders cannot all append to one array under a whole-file-
    // write rule; the cross-cutting writer wires it into tools/gallery/entries.js. That
    // wiring is a one-line import — but the ENTRY's own correctness is this builder's
    // problem, so every state's markup is mounted here, at the bench geometry, before it
    // is handed over ("a gallery that stops mounting fails a test rather than
    // photographing an empty stage").

    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-favourite-slot.entry.js');

        assert.equal(entry.id, 'ui-favourite-slot', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-favourite-slot.js',
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

                const painted = await page.evalFn(() => {
                    const els = [...document.querySelectorAll('ui-favourite-slot')]
                        .filter((el) => !el.hasAttribute('hidden'));
                    if (!els.length) return null;
                    return els.map((el) => {
                        const disc = el.shadowRoot && el.shadowRoot.getElementById('slot');
                        if (!disc) return null;
                        const r = disc.getBoundingClientRect();
                        return { w: Math.round(r.width), h: Math.round(r.height) };
                    });
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no slot at all`);
                for (const box of painted) {
                    // Not a face check: an EMPTY slot is transparent by design (the oracle
                    // reads rgba(0, 0, 0, 0)), so what must be true of every state is that
                    // there is a box on screen and it is square.
                    assert.ok(box && box.w > 0 && box.h > 0,
                        `${entry.id}--${state.id} rendered a ${JSON.stringify(box)} box`);
                    assert.equal(box.w, box.h,
                        `${entry.id}--${state.id} rendered a ${box.w}×${box.h} slot — it is a square shortcut`);
                }
            }
        });
    });
});

describe('ui-favourite-slot across both geometries', () => {
    test('the disc is the same physical size at the bench and at the floor', () => {
        assert.deepEqual(
            acrossGeometries.bench, acrossGeometries.floor,
            `bench ${JSON.stringify(acrossGeometries.bench)} vs floor ${JSON.stringify(acrossGeometries.floor)}`,
        );
        assert.equal(acrossGeometries.bench.disc.w, 48);
        assert.equal(acrossGeometries.bench.disc.h, 48);
        assert.equal(acrossGeometries.bench.row, 48);
        assert.ok(acrossGeometries.bench.hit >= 48);
    });
});
