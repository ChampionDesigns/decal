/**
 * ui-stat-tile.render.test.mjs — Gate A for component #33 (wave 2, item #33).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth)
 * and the 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. TOKEN DRILL — thirteen tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token. Bug L12's class ("a private palette
 *      duplicating the public tokens value-for-value, declared three times"): a component
 *      holding its own copy paints the same and does NOT move. Pinned twice over, because
 *      the shadow sheet is also scanned for a private --ui-* declaration;
 *   2. THE FOUR SELECTION DIALS — the wave's headline obligation, in its NEGATIVE form.
 *      This component paints no selection, so what is asserted is that it CANNOT: all four
 *      dials are drilled at once and nothing in the tile moves, and the five state
 *      spellings from Appendix 15 are put on the host and on the shadow tree and paint
 *      nothing. Wave law: "NO private 'selected' look anywhere in this wave";
 *   3. FOCUS GEOMETRY from --ui-focus-*, unclipped, in both offsets — bug L24's class.
 *      The tile takes no focus of its own; what is asserted is that it does not BREAK the
 *      ring when a consumer makes it focusable, and that it has no clipping surface of its
 *      own to clip one with;
 *   4. CONTAINER FLOOR BEHAVIOUR at both geometries — the digits track an ANCESTOR
 *      container, never the viewport and never the tile's own width, and the same
 *      container gives the same rendering at 1281×801 and at the 1000×600 floor. That last
 *      comparison is the "reads its own container, never the viewport" proof (Part 4
 *      ground rule 2, spec §2.1 Rule 1);
 *   5. BUG L2, DEAD, in Slate's own numbers — the one bug id row #33 cites. See below;
 *   6. ARIA. Row #33 cites no Appendix 15 rule (Appendix 15 is the aria-*-driven STATE
 *      selector for .slate-bank / .slate-stepper, and a readout has no state a user can
 *      change). What is asserted is the accessible NAME of an ABSENT reading, and the
 *      "zero is a measurement" rule that decides when a reading is absent at all;
 *   7. HIT-AREA FLOOR: deliberately not asserted, and asserted not to apply. Appendix 5's
 *      three consumers are #15, #23 and #35 (CONVENTIONS §5); nothing here is pressable,
 *      so there is no ::before overlay — asserted, because a hit box with nothing behind
 *      it would sit on top of whatever IS the target in that row.
 *
 * =========================================================================================
 * BUG L2, AND WHAT "INEXPRESSIBLE" MEANS HERE
 * =========================================================================================
 *   L2 | "The gauge cluster's value track is 44px against numbers at 45px and 52px.
 *        Measured #slate-live-time [488,248,69,52]; the cluster ends at 297, the chart
 *        begins at 298, so the promoted digits are clipped by the plot canvas."
 *        (LAYOUT_SPEC_DRAFT.md:1101; slate-live.css:919-931, 959-968, 978, 2100-2107)
 *
 * Three numbers make that bug: a track of 44, a resting digit of 45 and a promoted digit
 * of 52, all three authored in different places. The oracle states all three —
 *   CITE live-ready #slate-live-time [i=97] font-size = 52px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *   CITE live-ready #slate-live-pressure [i=100] font-size = 45px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *   CITE live-pulling #slate-live-pressure [i=103] font-size = 52px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *   CITE live-ready #slate-live-time [i=97] rect x=488 y=248 w=69 h=52
 *        (248 + 52 = 300, against a cluster ending at 297)
 *   CITE      geometry above is Slate (captured at 1920x1200) and is FROZEN - quote it
 *   CITE      as what Slate does, never as Decal's responsive target.
 *
 * The tests below drill --ui-display-lg to 45px and --ui-display-xl to 52px — Slate's own
 * upper bounds, which is what Slate rendered at 1920 — and then assert the value track is
 * at least as tall as the digits in it. It is the SAME TOKEN in both places, so it cannot
 * not be. Then the tokens are drilled to 120px, far past anything the scale can produce,
 * and the assertion still holds: the track is a floor that grows, not a constant that
 * clips (spec §2.3 case 4, "minimum floors REQUIRED"). Slate needed the cluster's
 * `height: 84px; min-height: 84px` to produce L2; this component declares no height at
 * all, and that is asserted directly.
 *
 * Bug L3 is the same element's other bug and is NOT row #33's, but a build that re-grew it
 * would be a build that reproduced it, so the live-ness of both alignment declarations is
 * asserted too: L3 is "align-items: flex-end on .slate-gauge > strong is dead — same
 * specificity, later baseline wins" (LAYOUT_SPEC_DRAFT.md:1102).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-stat-tile.js'];

/* U+2014 EM DASH — units.js:67's NO_READING_MARK, written as the escape so an en dash
 * cannot masquerade as it in a diff. That confusion is the bug units.js's own header
 * comment was written about: "The Live readout row wrote an em dash and the derived list
 * eight inches under it wrote an en dash - one idea, two marks, on one screen." */
const EM_DASH = '—';

/* Explicit pixel widths, so the SAME container measures the same at 1281×801 and at the
 * 1000×600 floor. That equality is the viewport-independence proof, and it only means
 * something if the container itself is not viewport-derived. */
const WIDE = 1120;
const NARROW = 480;

/**
 * The promotion is a REAL TRANSITION on font-size (--ui-dur-slow, 200ms), so every
 * assertion that moves a display token has to let it land or it samples the tween.
 * Measured while writing this suite: drilling --ui-display-lg from 40.32px to 37px and
 * reading one settle() later gives 38.9727px — a mid-flight value that looks exactly
 * like a component reading a stale token. Worth stating plainly, because "the drill
 * moved the value but not to the token" is otherwise a very convincing false positive.
 */
const SETTLE_MS = 320;
const landed = async (page) => { await sleep(SETTLE_MS); await page.settle(1); };

const MARKUP = `
<div id="cluster" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="flow" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="time" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
    <ui-stat-tile id="promoted" label="Pressure" value="9.0" unit="bar"
        size="lg" reserve="xl"></ui-stat-tile>
    <ui-stat-tile id="promoted-now" label="Pressure" value="9.0" unit="bar"
        size="xl" reserve="xl"></ui-stat-tile>
</div>

<div id="narrow-cluster" style="container-type: inline-size; inline-size: ${NARROW}px;
     display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="narrow-flow" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="narrow-time" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
</div>

<!--
  SOLO TILES, each alone in its own container at the SAME width. A cluster stretches
  every tile to the tallest of them (slate-live.css:904-908, align-items: stretch, and
  it is right), so a height comparison between siblings measures the row and not the
  tile. These four are how the tile's OWN block size is measured.
-->
<div id="solo-lg-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-lg" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
</div>
<div id="solo-xl-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-xl" label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
</div>
<div id="solo-rest-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-rest" label="Pressure" value="9.0" unit="bar"
        size="lg" reserve="xl"></ui-stat-tile>
</div>
<div id="solo-pulling-c" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="solo-pulling" label="Pressure" value="9.0" unit="bar"
        size="xl" reserve="xl"></ui-stat-tile>
</div>

<!-- Same container, two very different tile widths: the digits must not care. -->
<div id="uneven" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: 4fr 1fr; column-gap: 24px">
    <ui-stat-tile id="fat" label="Weight" value="36.2" unit="g"></ui-stat-tile>
    <ui-stat-tile id="thin" label="Weight" value="36.2" unit="g"></ui-stat-tile>
</div>

<div id="states" style="container-type: inline-size; inline-size: ${WIDE}px;
     display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 24px">
    <ui-stat-tile id="absent" label="Ratio"></ui-stat-tile>
    <ui-stat-tile id="zero" label="Weight" value="0" unit="g"></ui-stat-tile>
    <ui-stat-tile id="no-unit" label="Ratio" value="1:2.1"></ui-stat-tile>
    <ui-stat-tile id="long-label" label="Peak flow after first drop"
        value="3.4" unit="ml/s"></ui-stat-tile>
    <ui-stat-tile id="dimmed" label="Flow" value="2.1" unit="ml/s" disabled></ui-stat-tile>
</div>

<!-- Selection is inexpressible: every spelling Appendix 15 lists, on the host. -->
<div id="selection" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="sel-pressed" label="Flow" value="2.1" aria-pressed="true"></ui-stat-tile>
    <ui-stat-tile id="sel-selected" label="Flow" value="2.1" aria-selected="true"></ui-stat-tile>
    <ui-stat-tile id="sel-checked" label="Flow" value="2.1" aria-checked="true"></ui-stat-tile>
    <ui-stat-tile id="sel-current" label="Flow" value="2.1" aria-current="true"></ui-stat-tile>
    <ui-stat-tile id="sel-class" class="is-selected" label="Flow" value="2.1"></ui-stat-tile>
    <ui-stat-tile id="sel-attr" selected label="Flow" value="2.1"></ui-stat-tile>
    <ui-stat-tile id="sel-none" label="Flow" value="2.1"></ui-stat-tile>
</div>

<div id="ink" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="tinted" label="Flow" value="2.1" unit="ml/s"
        style="--_ui-stat-ink: var(--ui-channel-flow)"></ui-stat-tile>
</div>

<div id="slotting" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="slotted" label="Weight">
        <button slot="value" type="button">Retry</button>
    </ui-stat-tile>
</div>

<div id="focus-host" style="container-type: inline-size; inline-size: ${WIDE}px">
    <ui-stat-tile id="focusable" label="Flow" value="2.1" tabindex="0"></ui-stat-tile>
</div>
<div id="band" style="container-type: inline-size; inline-size: ${WIDE}px;
     overflow: hidden; padding: 8px">
    <ui-stat-tile id="clipped" label="Flow" value="2.1" tabindex="0"
        focus-ring="inset"></ui-stat-tile>
</div>
`;

/**
 * Slate's own numbers, named once, so every assertion that quotes them quotes the same
 * three. All three are the oracle's, verbatim in the header above.
 */
const SLATE = {
    /** --slate-display-lg, the resting gauge. CITE live-ready #slate-live-pressure [i=100]. */
    restingDigits: 45,
    /** --slate-display-xl, the promoted gauge. CITE live-pulling #slate-live-pressure [i=103]. */
    promotedDigits: 52,
    /** The residual value track, LAYOUT_SPEC_DRAFT.md:1101. This is the bug. */
    valueTrack: 44,
    /** The microcap line box. CITE live-ready <span> [i=102] height = 18px. */
    labelTrack: 18,
    /** --slate-space-1, slate-live.css:940 row-gap. */
    rowGap: 4,
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

const near = (a, b, tol = 0.75) => Math.abs(a - b) <= tol;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-stat-tile @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-stat-tile must mount without throwing');
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

        test('drill: the label reads --ui-muted, --ui-text-sm, --ui-weight-semibold, --ui-tracking-cap', () => mounted(async (page) => {
            //   CITE live-ready <span> [i=102] color = rgb(148, 161, 169) <- slate-live.css
            //        {#main-page .slate-microcap, ...} authored var(--slate-muted)
            //        !important=yes (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#flow >>> #label',
                property: 'color',
            });
            //   CITE live-ready <span> [i=102] font-size = 15px <- slate-live.css
            //        {#main-page .slate-gauge > span:first-child} authored
            //        var(--slate-text-cap) !important=yes (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                selector: '#flow >>> #label',
                property: 'font-size',
            });
            // DEPARTURE 3a. Oracle: font-weight = 600, authored 600 (FROZEN/hardcoded).
            // styles/tokens.css:368-369 moved the ~50 semibold elements to 700, and a
            // component reading the token moves with them.
            await assertTokenDrill(page, {
                token: '--ui-weight-semibold',
                value: '800',
                selector: '#flow >>> #label',
                property: 'font-weight',
            });
            // DEPARTURE 3b IS GONE — parity surface 0. The oracle's letter-spacing is
            // 1.8px, authored 0.12em, and --ui-tracking-cap now carries exactly that.
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: '3px',
                expected: '3px',
                selector: '#flow >>> #label',
                property: 'letter-spacing',
            });
        }));

        test('drill: the reading reads --ui-display-lg/-xl, --ui-weight-light and --ui-text', () => mounted(async (page) => {
            //   CITE live-ready #slate-live-pressure [i=100] font-size = 45px <- (no
            //        declaration - inherited or initial value) (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-display-lg',
                value: DRILL_LENGTH,
                selector: '#flow >>> #value',
                property: 'font-size',
                prepare: landed,          // the promotion transition — see SETTLE_MS
            });
            //   CITE live-ready #slate-live-time [i=97] font-size = 52px <- (no
            //        declaration - inherited or initial value) (token-driven)
            await assertTokenDrill(page, {
                token: '--ui-display-xl',
                value: DRILL_LENGTH,
                selector: '#time >>> #value',
                property: 'font-size',
                prepare: landed,
            });
            // DEPARTURE 2. Oracle: font-weight = 300 (FROZEN/hardcoded). tokens.css:368-369
            // "the 300 'light' numeric readouts land on 400".
            await assertTokenDrill(page, {
                /* --ui-weight-light since parity surface 1: the reading IS Slate's light
                 * numeric-readout role (300), which the token sheet had folded into 400
                 * while it carried three weights. */
                token: '--ui-weight-light',
                value: '800',
                selector: '#flow >>> #value',
                property: 'font-weight',
            });
            //   CITE live-ready #slate-live-time [i=97] color = rgb(244, 247, 248) <- (no
            //        declaration - inherited or initial value) (token-driven)
            // Reached through --_ui-stat-ink, whose default is var(--ui-text): the private
            // property is the seam a cluster hangs a channel colour on, and it must not
            // break the plain case.
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#flow >>> #value',
                property: 'color',
            });
        }));

        test('drill: --ui-font-family, --ui-space-1 and the unit tokens', () => mounted(async (page) => {
            // Never an @font-face in a component (spec §6.3 Rule 2, measured): a
            // shadow-declared face never registers with the document, so canvas text
            // silently falls back. The family is a token, in both rows of the tile.
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#flow >>> #value',
                property: 'font-family',
            });
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#flow >>> #label',
                property: 'font-family',
            });
            // SOURCE slate-live.css:940 row-gap: var(--slate-space-1). Slate ALSO writes
            // margin-bottom: 4px on the label, so its real gap is 8px expressed as two 4s
            // in two rules; here the gap is the gap (spec §2.3, one owner per dimension) —
            // which is why drilling the token moves the WHOLE gap and the label carries no
            // margin of its own.
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#flow',
                property: 'row-gap',
            });
            //   SOURCE slate-live.css:971 margin-left: 4px
            await assertTokenDrill(page, {
                token: '--ui-space-1',
                value: DRILL_LENGTH,
                selector: '#flow >>> #unit',
                property: 'margin-left',
            });
            const labelMargin = await page.computed('#flow >>> #label',
                ['margin-top', 'margin-bottom']);
            assert.deepEqual(
                labelMargin, { 'margin-top': '0px', 'margin-bottom': '0px' },
                'the label must carry no margin of its own — Slate expresses one 8px gap as ' +
                'row-gap: 4px plus margin-bottom: 4px, two owners for one dimension (spec §2.3)',
            );
        }));

        test('drill: the promotion transition reads --ui-dur-slow and --ui-ease', () => mounted(async (page) => {
            // DEPARTURE 6. Slate: transition: font-size .25s ease (slate-live.css:2106).
            await assertTokenDrill(page, {
                token: '--ui-dur-slow',
                value: '450ms',
                expected: '0.45s',
                selector: '#flow >>> #value',
                property: 'transition-duration',
            });
            await assertTokenDrill(page, {
                token: '--ui-ease',
                value: 'linear',
                expected: 'linear',
                selector: '#flow >>> #value',
                property: 'transition-timing-function',
            });
            const which = await page.prop('#flow >>> #value', 'transition-property');
            assert.equal(
                which, 'font-size',
                'the promotion animates SIZE only — Appendix item 3, "State changes weight, ' +
                'never position ... nothing appears, disappears or slides mid-pull"',
            );
        }));

        test('drill: a channel tint arrives from OUTSIDE, through --_ui-stat-ink', () => mounted(async (page) => {
            //   CITE live-ready #slate-live-flow [i=103] color = rgb(57, 123, 206) <-
            //        slate-live.css {#main-page .slate-gauge-flow strong > span} authored
            //        var(--slate-data-flow, var(--slate-live-flow)) !important=no
            //        (FROZEN/hardcoded)
            //   [= --ui-channel-flow #397bce, styles/chart-channels.css:103, byte-identical
            //    in both themes]
            // Slate hard-codes seven per-gauge tint rules. This component owns no channel
            // table at all: the cluster hangs the channel on the private property, so
            // adding a channel never edits a primitive.
            const tinted = await page.prop('#tinted >>> #value', 'color');
            const plain = await page.prop('#flow >>> #value', 'color');
            assert.notEqual(tinted, plain,
                'the tinted tile must not paint the plain ink');
            assert.equal(
                tinted, await page.resolveToken('--ui-channel-flow', 'color'),
                'the tint must land on --ui-channel-flow, not on a copy of its value',
            );
            await assertTokenDrill(page, {
                token: '--ui-channel-flow',
                value: DRILL_COLOUR,
                selector: '#tinted >>> #value',
                property: 'color',
            });
            // And the unit is NOT tinted: it is the label's register, not the reading's.
            //   SOURCE slate-live.css:972 color: var(--slate-muted)
            assert.equal(
                await page.prop('#tinted >>> #unit', 'color'),
                await page.resolveToken('--ui-muted', 'color'),
                'the unit keeps --ui-muted whatever the reading is tinted',
            );
        }));

        test('the component declares no public tokens of its own — bug L12 by construction', () => mounted(async (page) => {
            // L12 is "a private palette duplicating the public tokens value-for-value,
            // declared three times". The drills prove the tokens are READ; this proves
            // none are DECLARED. Internals are --_ui-* precisely so this scan cannot
            // confuse them (CONVENTIONS §7).
            const declared = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return [...text.matchAll(/(^|[^r(])(--ui-[a-z0-9-]+)\s*:/g)].map((m) => m[2]);
            }, '#flow');
            assert.deepEqual(declared, [], `this component declares public tokens: ${declared}`);
        }));

        test('zero !important, and no raw colour literal, in the authored sheet', () => mounted(async (page) => {
            // Slate's own rules for this element carry FIVE !important between the
            // microcap and the gauge label (slate-live.css). Nothing can reach into a
            // shadow root, so none of them has a reason to exist here (CONVENTIONS §6).
            const found = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const rules = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules]);
                const out = { bangs: 0, literals: [] };
                const walk = (list) => {
                    for (const r of list) {
                        if (r.cssRules) { walk([...r.cssRules]); continue; }
                        const st = r.style;
                        if (!st) continue;
                        for (const p of st) {
                            if (st.getPropertyPriority(p) === 'important') out.bangs += 1;
                            const v = st.getPropertyValue(p);
                            if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(v)) out.literals.push(`${p}: ${v}`);
                        }
                    }
                };
                walk(rules);
                return out;
            }, '#flow');
            assert.equal(found.bangs, 0, 'component styles must carry zero !important');
            assert.deepEqual(found.literals, [],
                `raw colour literals in component CSS (A8, guard 3): ${found.literals.join(' | ')}`);
        }));

        /* -- 2. the four selection dials: inexpressible ---------------------- */

        test('WAVE LAW: the four dials move nothing — this component has no selected look', () => mounted(async (page) => {
            // The wave's headline obligation in its negative form. A readout is not in the
            // founding-defect callout's list and must never grow the fourteenth selection
            // implementation. Drilling all four dials at once is the strongest form: if any
            // rule in this sheet read one, something here would move.
            const READ = ['background-color', 'color', 'box-shadow', 'text-shadow', 'outline-color'];
            const probes = ['#sel-none', '#sel-none >>> #label', '#sel-none >>> #value'];

            const snapshot = async () => {
                const out = {};
                for (const p of probes) out[p] = await page.computed(p, READ);
                return out;
            };

            const before = await snapshot();
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', '9px');
            await page.setToken('--ui-selected-glow', '90%');
            const after = await snapshot();
            for (const t of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(t, null);
            }

            assert.deepEqual(
                after, before,
                'a selection dial moved something in ui-stat-tile.\n' +
                '  Wave law: "NO private selected look anywhere in this wave — a component ' +
                'expresses selection ONLY via the dial tokens", and a readout expresses none ' +
                'at all. selectionSurface is deliberately not imported here (CONVENTIONS §4).',
            );
        }));

        test('WAVE LAW: every Appendix 15 state spelling paints nothing', () => mounted(async (page) => {
            // aria-pressed / aria-selected / aria-checked / aria-current / .is-selected /
            // [selected] — slate-components.css:389-392 and the selectionSurface fragment's
            // own selector list. Accessibility state and visual state are the same state,
            // so a tile that has no selected state must announce none and paint none.
            const READ = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const baseline = await page.computed('#sel-none >>> #value', READ);
            const baselineHost = await page.computed('#sel-none', READ);

            for (const id of ['sel-pressed', 'sel-selected', 'sel-checked', 'sel-current',
                'sel-class', 'sel-attr']) {
                assert.deepEqual(
                    await page.computed(`#${id} >>> #value`, READ), baseline,
                    `#${id}: a selection state spelling painted the reading`,
                );
                assert.deepEqual(
                    await page.computed(`#${id}`, READ), baselineHost,
                    `#${id}: a selection state spelling painted the host`,
                );
            }

            // And the resting paint is not a background at all, so there is nothing for a
            // selection surface to sit on even by accident.
            assert.equal(
                baselineHost['background-color'], 'rgba(0, 0, 0, 0)',
                'the tile paints no ground of its own',
            );
        }));

        /* -- 3. bug L2, dead, in Slate's own numbers ------------------------- */

        /** Drill the two display steps to Slate's own upper bounds and measure. */
        const atSlateBounds = async (page, fn) => {
            await page.setToken('--ui-display-lg', `${SLATE.restingDigits}px`);
            await page.setToken('--ui-display-xl', `${SLATE.promotedDigits}px`);
            await landed(page);
            try { return await fn(); } finally {
                await page.setToken('--ui-display-lg', null);
                await page.setToken('--ui-display-xl', null);
                await landed(page);
            }
        };

        const tileMetrics = async (page, id) => {
            const host = await page.box(`#${id}`);
            const value = await page.box(`#${id} >>> #value`);
            const label = await page.box(`#${id} >>> #label`);
            const size = parseFloat(await page.prop(`#${id} >>> #value`, 'font-size'));
            return { host, value, label, size };
        };

        test('L2 DEAD: the value track is never smaller than the digits in it', () => mounted(async (page) => {
            // L2 | "The gauge cluster's value track is 44px against numbers at 45px and
            //       52px ... the promoted digits are clipped by the plot canvas."
            //       (LAYOUT_SPEC_DRAFT.md:1101)
            // Row #33's fix, verbatim: "Value track sized by the display type clamp()
            // scale". Track and type are ONE token here, so 44-against-45 cannot arise.
            await atSlateBounds(page, async () => {
                for (const [id, expected] of [['flow', SLATE.restingDigits],
                    ['time', SLATE.promotedDigits]]) {
                    const m = await tileMetrics(page, id);

                    assert.ok(near(m.size, expected),
                        `#${id}: digits should be ${expected}px at Slate's own bound, got ${m.size}px`);

                    // (a) the value box is at least as tall as its own type
                    assert.ok(
                        m.value.height >= m.size - 0.5,
                        `#${id}: value box ${m.value.height}px against ${m.size}px of type. ` +
                        `Slate's was ${SLATE.valueTrack}px against ${expected}px — that is L2.`,
                    );

                    // (b) the value box is INSIDE the host, on both edges. This is the
                    // exact failure: Slate's digits ran from y=248 to y=300 out of a
                    // cluster ending at 297, into the plot canvas that began at 298.
                    assert.ok(
                        m.value.bottom <= m.host.bottom + 0.5 && m.value.top >= m.host.top - 0.5,
                        `#${id}: the reading escapes its own tile — value ` +
                        `[${m.value.top.toFixed(1)}, ${m.value.bottom.toFixed(1)}] against host ` +
                        `[${m.host.top.toFixed(1)}, ${m.host.bottom.toFixed(1)}]. ` +
                        'That overhang IS L2: Slate\'s CITE live-ready #slate-live-time [i=97] ' +
                        'rect y=248 h=52 ends at 300 in a cluster ending at 297.',
                    );

                    // (c) the whole tile is label track + gap + digits, with nothing
                    // squeezed. Slate's cluster was 84px total with 14px of padding, so the
                    // value track was whatever was left: 44px.
                    const gap = parseFloat(await page.prop(`#${id}`, 'row-gap'));
                    assert.ok(
                        m.host.height >= m.label.height + gap + m.size - 0.5,
                        `#${id}: tile ${m.host.height}px cannot hold label ${m.label.height}px ` +
                        `+ gap ${gap}px + digits ${m.size}px`,
                    );
                }
            });
        }));

        test('L2 DEAD: the track is a FLOOR — it grows past anything the scale can produce', () => mounted(async (page) => {
            // spec §2.3 case 4: minimum floors are REQUIRED, not merely permitted. A fixed
            // track smaller than its line box clips (E7's class); a floor grows. 120px is
            // far past the display scale's 52px ceiling, so nothing but a real floor
            // survives this.
            await page.setToken('--ui-display-xl', '120px');
            // The promotion is a REAL transition on font-size (--ui-dur-slow), so the
            // drill has to LAND or this samples the tween — measured mid-flight at
            // 54.34px on the way from 52px to 120px, which reads exactly like a
            // component holding a stale token. See SETTLE_MS.
            await landed(page);
            const m = await tileMetrics(page, 'time');
            await page.setToken('--ui-display-xl', null);

            assert.ok(near(m.size, 120), `expected 120px of type, got ${m.size}px`);
            assert.ok(
                m.value.height >= 120 - 0.5,
                `value box ${m.value.height}px against 120px of type — the track is not a floor`,
            );
            assert.ok(
                m.value.bottom <= m.host.bottom + 0.5,
                'the reading escaped its tile at 120px — the tile has a fixed height somewhere',
            );
        }));

        test('L2 DEAD: the tile declares no height, and nothing on the value path clips', () => mounted(async (page) => {
            // L2 needs BOTH halves: a fixed box AND a clipping surface. Slate's cluster
            // had `height: 84px; min-height: 84px` (slate-live.css:920-921) and the plot
            // canvas painted over the overflow. Neither half exists here.
            const host = await page.computed('#flow',
                ['max-height', 'overflow-x', 'overflow-y']);
            assert.equal(host['max-height'], 'none', 'the tile must declare no maximum height');
            assert.equal(host['overflow-x'], 'visible', 'the tile must not clip');
            assert.equal(host['overflow-y'], 'visible', 'the tile must not clip');

            const value = await page.computed('#flow >>> #value',
                ['overflow-x', 'overflow-y', 'white-space']);
            assert.equal(value['overflow-x'], 'visible',
                'a reading is never clipped — a clipped number is a WRONG number');
            assert.equal(value['overflow-y'], 'visible', 'a reading is never clipped');
            //   SOURCE slate-live.css:965 white-space: nowrap
            assert.equal(value['white-space'], 'nowrap', 'a reading never wraps');

            // The tile grows with a taller reading rather than pinning a constant: the
            // negative of `height: 84px; min-height: 84px`.
            //
            // MEASURED ON THE SOLO TILES, NOT ON TWO SIBLINGS IN #cluster. A cluster
            // stretches every tile to the tallest of them — slate-live.css:904-908,
            // "STRETCH, so every gauge spans the cluster and its two internal tracks
            // line up with its neighbours'", carried forward deliberately — so a
            // height comparison between siblings measures THE ROW and not the tile,
            // and returns equal for any component whatsoever. #solo-lg and #solo-xl
            // are alone in containers of the same width for exactly this measurement.
            const lg = await page.box('#solo-lg');
            const xl = await page.box('#solo-xl');
            assert.ok(
                xl.height > lg.height,
                `a promoted tile must be taller than a resting one when nothing is reserved — ` +
                `xl ${xl.height}px against lg ${lg.height}px`,
            );
        }));

        test('the label track is FIXED and derived, so a bigger number never drags its label', () => mounted(async (page) => {
            // Appendix item 4, carried forward whole: "The label row is a row — a per-gauge
            // two-row grid with a fixed label track, so promoting a number does not drag
            // its own label up". Slate's own comment records what it cost: "TIME sat 7px
            // above the other six in the resting state, and in the pulling state the
            // promoted four sat 22px above the rest."
            const resting = await page.box('#flow >>> #label');
            const promoted = await page.box('#time >>> #label');
            const cluster = await page.box('#cluster');

            assert.ok(
                near(resting.height, promoted.height),
                `label tracks differ between a resting and a promoted tile: ` +
                `${resting.height}px vs ${promoted.height}px`,
            );
            assert.ok(
                near(resting.top - cluster.top, promoted.top - cluster.top),
                `labels sit on different lines — resting at +${(resting.top - cluster.top).toFixed(1)}px, ` +
                `promoted at +${(promoted.top - cluster.top).toFixed(1)}px. This is exactly the ` +
                '7px/22px misalignment Slate\'s two-row grid was written to remove.',
            );

            //   CITE live-ready <span> [i=102] height = 18px — and here it is DERIVED from
            //   --ui-text-sm rather than authored as a literal line-height, so the track
            //   follows the cap under a drill instead of stranding an 18px box around it.
            const sm = parseFloat(await page.resolveToken('--ui-text-sm', 'width'));
            assert.ok(
                near(resting.height, sm * 1.2),
                `the label track should be 1.2 x --ui-text-sm (${(sm * 1.2).toFixed(1)}px), ` +
                `got ${resting.height}px`,
            );
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                expected: `${37 * 1.2}px`,
                selector: '#flow >>> #label',
                property: 'line-height',
            });
        }));

        test('RESERVE: a promoted tile does not reflow — nothing slides mid-pull', () => mounted(async (page) => {
            // Appendix item 3: "State changes weight, never position. [data-live-state]
            // recomposes WITHIN the existing tracks: nothing appears, disappears or slides
            // mid-pull ... This is why the screen is readable during a shot. Keep the rule."
            // Slate bought that with the fixed 84px cluster that CAUSES L2. Here the
            // reserve buys it: the track is already xl-tall at rest, and the digits grow
            // into space that was always there.
            // SOLO CONTAINERS, for the same reason the L2 height test uses them: a
            // cluster stretches its tiles to the tallest of them, so two siblings
            // report equal heights whatever the component does. #solo-rest (size=lg
            // reserve=xl), #solo-pulling (size=xl reserve=xl) and #solo-lg (no
            // reserve) are alone in containers of identical width, so these three
            // heights are the TILE's and the comparison can fail.
            const rest = await page.box('#solo-rest');          // size=lg reserve=xl
            const pulling = await page.box('#solo-pulling');    // size=xl reserve=xl
            assert.ok(
                near(rest.height, pulling.height),
                `a reserved tile changed height on promotion: ${rest.height}px -> ${pulling.height}px`,
            );

            // The reserved resting tile is taller than an unreserved one — that is what
            // "reserved" means, and it is opt-in so a summary tile strip reserves nothing.
            const unreserved = await page.box('#solo-lg');
            assert.ok(
                rest.height > unreserved.height,
                `reserve="xl" must hold xl-sized space at rest: ${rest.height}px against ` +
                `an unreserved ${unreserved.height}px`,
            );

            // And the digits are still not clipped in the reserved tile, in either
            // state — checked both alone and inside a stretching cluster.
            for (const id of ['solo-rest', 'solo-pulling', 'promoted', 'promoted-now']) {
                const m = await tileMetrics(page, id);
                assert.ok(m.value.bottom <= m.host.bottom + 0.5,
                    `#${id}: the reading escapes its reserved tile`);
            }
        }));

        test('L3 STAYS DEAD: one live alignment declaration per axis', () => mounted(async (page) => {
            // L3 | "align-items: flex-end on .slate-gauge > strong is dead — same
            //       specificity, later baseline wins." (LAYOUT_SPEC_DRAFT.md:1102)
            // Not row #33's bug, but it is this element's, so a build that re-grew a dead
            // alignment rule would have reproduced it. Both declarations below are live and
            // there is no later rule in the sheet that could shadow either.
            const v = await page.computed('#flow >>> #value', ['align-items', 'align-self']);
            //   SOURCE slate-live.css:960 align-items: baseline — the surviving half of
            //   L3's pair. The reading and its unit share a baseline.
            assert.equal(v['align-items'], 'baseline');
            //   What slate-live.css:950's dead flex-end was reaching for: the value box
            //   sits at the BOTTOM of its own track, so readings of different sizes share a
            //   line across a cluster.
            assert.equal(v['align-self'], 'end');

            // Measured, not merely declared: the unit's baseline is the reading's baseline.
            const reading = await page.box('#flow >>> #reading');
            const unit = await page.box('#flow >>> #unit');
            assert.ok(
                unit.bottom <= reading.bottom + 0.5 && unit.bottom > reading.top,
                `the unit does not sit on the reading's baseline — unit bottom ` +
                `${unit.bottom.toFixed(1)}, reading ${reading.top.toFixed(1)}..${reading.bottom.toFixed(1)}`,
            );

            // And the readings across a cluster share a bottom line.
            const a = await page.box('#flow >>> #reading');
            const b = await page.box('#time >>> #reading');
            assert.ok(
                near(a.bottom, b.bottom, 1.5),
                `readings of different sizes do not share a line: ${a.bottom.toFixed(1)} vs ${b.bottom.toFixed(1)}`,
            );
        }));

        /* -- 4. container floor behaviour ------------------------------------ */

        test('the tile is NOT its own container — the cluster is', () => mounted(async (page) => {
            // LAYOUT_SPEC_DRAFT.md:368: "Upper bounds are the current values
            // (slate-tokens.css:142-146); cqi resolves against the gauge cluster's own
            // container." CONVENTIONS §2's one-line opt-out, and it is load-bearing: seven
            // tiles in a cluster are each ~1/7 of it, so a per-tile container would resolve
            // 4.2cqi against ~170px and pin every reading in the skin at the clamp's 38px
            // floor forever.
            assert.equal(
                await page.prop('#flow', 'container-type'), 'normal',
                'the tile must not establish its own inline-size container',
            );

            // Same container, two very different tile widths: the digits must not care.
            const fat = await page.box('#fat');
            const thin = await page.box('#thin');
            assert.ok(fat.width > thin.width * 2,
                `the fixture must actually make the tiles uneven: ${fat.width} vs ${thin.width}`);
            assert.equal(
                await page.prop('#fat >>> #value', 'font-size'),
                await page.prop('#thin >>> #value', 'font-size'),
                'two tiles in ONE cluster must size their digits together — that is the whole ' +
                'reason the tile is not its own container',
            );
        }));

        test('the digits HOLD their size in a narrow container, and still fit', () => mounted(async (page) => {
            // PARITY SURFACE 0 INVERTED THIS TEST, deliberately. The display scale used
            // to be the only fluid type in the system — clamp(34px, 3.6cqi, 45px) and
            // clamp(38px, 4.2cqi, 52px) — so a narrow container was absorbed by the TYPE.
            // Slate has no fluid type anywhere: --slate-display-lg/-xl are the flat
            // 45px/52px this token family now carries, and the clamp's floors were
            // LAYOUT_SPEC_DRAFT §3.5 proposals it says "want a look on the bench" and
            // never got one. A shot readout that quietly shrinks is the opposite of what
            // a readout is for.
            //
            // So the assertion is now: the reading is the SAME SIZE at 480px as at
            // 1120px, it is Slate's number, and — the half the old clamp was buying —
            // it still does not escape its tile at the narrow end.
            const wide = parseFloat(await page.prop('#flow >>> #value', 'font-size'));
            const narrow = parseFloat(await page.prop('#narrow-flow >>> #value', 'font-size'));
            assert.equal(narrow, wide,
                `a ${NARROW}px container must give the SAME digits as a ${WIDE}px one: ` +
                `${narrow}px vs ${wide}px`);
            assert.ok(near(wide, 45), `lg is Slate's flat --slate-display-lg 45px, got ${wide}px`);

            const wideXl = parseFloat(await page.prop('#time >>> #value', 'font-size'));
            const narrowXl = parseFloat(await page.prop('#narrow-time >>> #value', 'font-size'));
            assert.equal(narrowXl, wideXl, 'and the xl step holds too');
            assert.ok(near(wideXl, 52), `xl is Slate's flat --slate-display-xl 52px, got ${wideXl}px`);

            // THE THING THE CLAMP WAS ACTUALLY BUYING, kept as the assertion: a reading
            // that holds its size must still not escape its tile at the narrow end. If
            // this ever fails, that is a FINDING for Ben — the readout has outgrown its
            // container at Slate's own number — and not a licence to re-clamp.
            for (const id of ['narrow-flow', 'narrow-time']) {
                const m = await tileMetrics(page, id);
                assert.ok(m.value.bottom <= m.host.bottom + 0.5,
                    `#${id}: the reading escapes its tile at the narrow container`);
            }

            acrossGeometries[geometry.name] = { wide, narrow, wideXl, narrowXl };
        }));

        test('a long label ellipsises; the reading never does', () => mounted(async (page) => {
            // DEPARTURE 7. Slate's microcap is nowrap with no overflow stated, so a long
            // cap spills sideways into its neighbour (E19's class). The oracle is
            // disqualified here anyway: a container narrower than 1920 is responsive
            // behaviour and Slate has no answer (LAYOUT_SPEC_DRAFT.md governs).
            const label = await page.computed('#long-label >>> #label',
                ['overflow-x', 'text-overflow', 'white-space']);
            assert.equal(label['overflow-x'], 'hidden');
            assert.equal(label['text-overflow'], 'ellipsis');
            assert.equal(label['white-space'], 'nowrap');

            const host = await page.box('#long-label');
            const box = await page.box('#long-label >>> #label');
            assert.ok(
                box.width <= host.width + 0.5,
                `the label spilled out of its tile: ${box.width}px in ${host.width}px`,
            );
            const scrolls = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return el.scrollWidth > el.clientWidth;
            }, '#long-label >>> #label');
            assert.ok(scrolls, 'the fixture must actually overflow the label for this to mean anything');
        }));

        test('the tile has an explicit floor and never scrolls itself', () => mounted(async (page) => {
            // spec §2.4: a scroll region needs an explicit floor and a stated overflow, and
            // hiding the scrollbar is banned. This is NOT a scroll region, which is a
            // stronger statement, so it is asserted as one: squeeze the container hard and
            // the tile still does not become a scroller.
            await page.setStyle('#narrow-cluster', { 'inline-size': '160px' });
            const m = await page.metrics('#narrow-flow');
            assert.equal(m.overflow?.x ?? 'visible', 'visible');
            const host = await page.box('#narrow-flow');
            const value = await page.box('#narrow-flow >>> #value');
            assert.ok(
                value.bottom <= host.bottom + 0.5,
                'the reading escaped its tile in a 160px cluster',
            );
            // The tile keeps its block floor: label + gap + the clamped digits.
            const size = parseFloat(await page.prop('#narrow-flow >>> #value', 'font-size'));
            const label = await page.box('#narrow-flow >>> #label');
            const gap = parseFloat(await page.prop('#narrow-flow', 'row-gap'));
            assert.ok(host.height >= label.height + gap + size - 0.5,
                `tile ${host.height}px cannot hold ${label.height} + ${gap} + ${size}`);
        }));

        /* -- 5. focus, unclipped -------------------------------------------- */

        test('a consumer-focusable tile gets THE ring, unclipped, at both offsets', () => mounted(async (page) => {
            // The tile takes no focus of its own — a readout is not a control. What is
            // asserted is that it does not BREAK the one ring when a wave-4 cluster with a
            // roving tabindex makes it reachable, which is exactly what
            // `.slate-stepper { overflow: hidden }` does to its caps (bug L24, "focus rings
            // clipped on all four sides by the components they sit inside").
            await assertFocusUnclipped(page, '#focusable');
            await assertFocusUnclipped(page, '#clipped');
        }));

        test('no hit-area overlay — nothing here is pressable', () => mounted(async (page) => {
            // Row #33 cites no Appendix 5 rule and the utility's three consumers are #15,
            // #23 and #35 (CONVENTIONS §5). A ::before overlay on a non-target would sit on
            // top of whatever IS the target in that row, which is a worse defect than the
            // one it would be imitating.
            for (const sel of ['#flow >>> #value', '#flow >>> #label']) {
                const before = await page.computed(sel, ['content'], { pseudo: '::before' });
                assert.equal(before.content, 'none',
                    `${sel} grew a pseudo-element — the hit-area utility is not this row's`);
            }
            assert.equal(
                await page.prop('#flow', 'cursor'), 'auto',
                'a readout must not present as pressable',
            );
        }));

        /* -- 6. absence, and "zero is a measurement" ------------------------- */

        test('an absent reading is the ONE mark, and it is named for a screen reader', () => mounted(async (page) => {
            // NO_READING_MARK, units.js:67 — "the one absent-value mark", and units.js's
            // own header comment on why it is one: "The Live readout row wrote an em dash
            // and the derived list eight inches under it wrote an en dash — one idea, two
            // marks, on one screen."
            const text = await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading');
            assert.equal(text, EM_DASH,
                'the absent mark must be U+2014 EM DASH, byte-identical to units.js:67');

            // The dash is a glyph standing for a sentence, so the sentence is what reaches
            // the accessibility tree — see ACCESSIBILITY in the component header.
            assert.equal(await page.prop('#absent >>> #reading', 'visibility'), 'visible');
            const hidden = await page.evalFn(
                (s) => window.__h.need(s).getAttribute('aria-hidden'), '#absent >>> #reading');
            assert.equal(hidden, 'true', 'the dash must be hidden from the accessibility tree');

            const spoken = await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #a11y');
            assert.equal(spoken, 'no reading');
            // The SHARED visuallyHidden treatment (CONVENTIONS §5a), never display:none —
            // all three of the banned spellings take the text out of the accessibility
            // tree, which is the one thing it must not do.
            const a11y = await page.computed('#absent >>> #a11y',
                ['display', 'visibility', 'clip-path', 'position']);
            assert.notEqual(a11y.display, 'none');
            assert.notEqual(a11y.visibility, 'hidden');
            assert.equal(a11y['clip-path'], 'inset(50%)');
        }));

        test('the absent sentence is TRANSLATED (D2), and has no per-instance knob (D11)',
            () => mounted(async (page) => {
            /* Wave-2 review c3-6. The sentence used to be an `absent-label` attribute with
             * an English default — a per-consumer surface for a skin-wide constant, which
             * is the shape D11 spends #31's save button removing: "the shared component
             * decides the wording — never per screen" (SCOPE.md:2220). Seven tiles sit in
             * one Live cluster, so that surface let seven announcements of one absence
             * differ, in the tree nobody can see. Both halves are asserted here, because
             * only asserting the new wiring would leave the old attribute free to come
             * back as a silent second source. */
            const inert = await page.evalFn(async () => {
                const el = window.__h.need('#absent');
                el.setAttribute('absent-label', 'CUSTOM WORDING');
                el.absentLabel = 'CUSTOM WORDING';
                await el.updateComplete;
                return el.shadowRoot.querySelector('#a11y').textContent;
            });
            assert.equal(inert, 'no reading',
                'a per-instance wording attribute must be inert — D11, and seven tiles in '
                + 'one cluster must not be able to announce one absence seven ways');

            /* D2 (SCOPE.md:1772-1775): "translation as a value each component reads …
             * EVERY COMPONENT ON EVERY SCREEN BELOW IS BUILT THAT WAY FROM ITS FIRST
             * COMMIT." The store is the module-level instance src/lib/i18n.js exports, and
             * the importmap resolves the component's `src/lib/i18n.js` to the same URL, so
             * this is the very object the tile subscribes to — not a second copy. */
            const [translated, restored] = await page.evalFn(async () => {
                const { translations } = await import('/src/lib/i18n.js');
                const el = window.__h.need('#absent');
                translations.set('xx', { 'no reading': 'keine Anzeige' });
                await el.updateComplete;
                const after = el.shadowRoot.querySelector('#a11y').textContent;
                translations.set('en', {});
                await el.updateComplete;
                return [after, el.shadowRoot.querySelector('#a11y').textContent];
            });
            assert.equal(translated, 'keine Anzeige',
                'a language change must re-render the announcement through the template — '
                + 'the old skin translated by walking the document, which cannot cross a '
                + 'shadow boundary at all (src/lib/i18n.js header)');
            /* Key-as-fallback, and the reason a primitive may hold the key: an empty store
             * answers with the key, which IS the English text, so the announcement can
             * never go blank or become a bare identifier (i18n/source/README.md). */
            assert.equal(restored, 'no reading');
        }));

        test('ZERO IS A MEASUREMENT — 0 renders as 0, not as the dash', () => mounted(async (page) => {
            // reading.js:12-15, A7: "NEVER PORT A FALLBACK PATH. A missing channel renders
            // as a gap or a dash, never as a locally-recomputed ratio, a delta-plus-EMA
            // flow, or A ZERO THAT READS AS A MEASUREMENT. Those three are exactly how
            // seven renames hid for months on a live bench: every one of them produced a
            // plausible number." The inverse is just as load-bearing on a readout: a real
            // zero that renders as a dash is a lost measurement.
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#zero >>> #reading'),
                '0',
            );
            assert.equal(await page.exists('#zero >>> #a11y'), false,
                'a zero is not absent and must not be announced as one');
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-hidden'),
                    '#zero >>> #reading'),
                null,
                'a real reading is not hidden from the accessibility tree',
            );

            // The same, driven through the property rather than the attribute, because
            // that is how a live screen will write it fifteen times a second.
            await page.evalFn((s) => { window.__h.need(s).value = 0; return true; }, '#absent');
            await page.settle(2);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading'),
                '0',
            );
            await page.evalFn((s) => { window.__h.need(s).value = null; return true; }, '#absent');
            await page.settle(2);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).textContent, '#absent >>> #reading'),
                EM_DASH,
            );
        }));

        test('the unit is omitted when there is none, and the dash carries none', () => mounted(async (page) => {
            assert.equal(await page.exists('#no-unit >>> #unit'), false);
            assert.equal(await page.exists('#absent >>> #unit'), false,
                'an absent reading has no unit to qualify');
            assert.equal(await page.exists('#flow >>> #unit'), true);
        }));

        test('a slotted control REPLACES the reading — no private action pill', () => mounted(async (page) => {
            // Slate paints one inside the gauge: `.slate-gauge strong > span
            // .slate-gauge-action`, a hairline pill with `color: ... !important`, "so it
            // stops reading as a weight and starts reading as a button"
            // (slate-live.css:983-996). It IS a button, so it is #1 ui-button slotted in.
            // A private button treatment inside a readout is the founding defect's shape in
            // a different family. Wave law: compose, never re-implement.
            assert.equal(await page.exists('#slotted >>> #reading'), false,
                'the slotted control must replace the reading, not sit beside it');
            const slot = await page.computed('#slotted >>> slot[name="value"]', ['display']);
            assert.equal(slot.display, 'contents',
                'the slot must add no box between the flex line and the control');
            // Nothing is painted ON the slotted control by this component.
            //
            // SCOPED TO THE AUTHORED SHEET. finalizeStyles() PREPENDS the base sheet
            // into every component's adoptedStyleSheets (CONVENTIONS §1), and the base
            // is where the one ::slotted(:focus-visible) rule lives BY DESIGN — §3a:
            // "a focusable can be in exactly three places, and the base rings all
            // three". Scanning the whole array therefore always matches and asserts
            // nothing about this component. The base sheet is excluded by OBJECT
            // IDENTITY through UiElement.baseStyles.styleSheet — Lit caches one
            // CSSStyleSheet per CSSResult, so this is the same object the shadow root
            // adopted — rather than by position, so it stays correct if the prepend
            // order ever moves.
            const painted = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const ctor = customElements.get(el.localName);
                const baseSheet = ctor?.baseStyles?.styleSheet ?? null;
                const own = [...el.shadowRoot.adoptedStyleSheets]
                    .filter((sh) => sh !== baseSheet);
                if (own.length === el.shadowRoot.adoptedStyleSheets.length) {
                    throw new Error('the base sheet was not identified — this scan would ' +
                        'be checking the base rather than the component');
                }
                const rules = own.flatMap((sh) => [...sh.cssRules])
                    .map((r) => r.cssText).join('\n');
                return /::slotted/.test(rules);
            }, '#slotted');
            assert.equal(painted, false,
                'this component must not restyle what is slotted into it (and must not ' +
                'carry a ::slotted focus-ring copy — CONVENTIONS §3a)');
        }));

        test('disabled is the base dial, paint only', () => mounted(async (page) => {
            // CONVENTIONS §4: one dial, --ui-opacity-disabled. The host attribute dims; it
            // does not disable, and there is nothing here to disable in any case.
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.11',
                expected: '0.11',
                selector: '#dimmed',
                property: 'opacity',
            });
            assert.equal(await page.prop('#flow', 'opacity'), '1');
        }));

        /* -- 8. the gallery entry is real markup ----------------------------- */

        test('every gallery state mounts, settles and renders a tile', () => mounted(async (page) => {
            // "It can be looked at" is half of Part 10 §10's definition of done, and the
            // entry file is the half a test can reach: tools/gallery/entries.js is a
            // SHARED single-writer file, so this entry is not wired into the registry
            // until the wave's cross-cutting writer adds it. Until then nothing else
            // would notice a typo in a state's markup — gallery.render.test.mjs drives
            // the REGISTERED entries. So the states are mounted here, in the Gate A rig,
            // at both geometries, with the same two modules ui-stat-tile.demo.js loads.
            //
            // The entry file is pure data with no imports, so node can read it directly.
            const { entry } = await import('../../tools/gallery/entries/ui-stat-tile.entry.js');

            assert.equal(entry.id, 'ui-stat-tile', 'the entry id is the capture-filename stem');
            assert.equal(entry.module, './entries/ui-stat-tile.demo.js',
                'module stays relative to tools/gallery/ (README) and points at the loader ' +
                'that imports ui-button too — gallery.js:86-88 waits forever on an ' +
                'undefined custom element rather than rendering a plain one');
            const ids = entry.states.map((s) => s.id);
            assert.equal(new Set(ids).size, ids.length,
                `state ids are capture filenames and must be unique: ${ids}`);

            for (const state of entry.states) {
                // hostStyle sizes the CONTAINER, not the viewport (README). Every state
                // here declares container-type, because this is the one component that
                // opts out of hosting its own container.
                assert.ok(state.hostStyle?.['container-type'] === 'inline-size',
                    `${state.id}: a stat-tile state must declare the ancestor container, ` +
                    'or every reading in it pins at the clamp floor');

                const style = Object.entries(state.hostStyle)
                    .map(([k, v]) => `${k}:${v}`).join('; ');
                await page.mount(
                    `<div id="stage-host" style="${style}">${state.html}</div>`,
                    ['/src/components/ui-stat-tile.js', '/src/components/ui-button.js'],
                );
                assert.deepEqual(page.pageErrors, [],
                    `${state.id}: the state threw while mounting`);

                const tiles = await page.count('#stage-host ui-stat-tile');
                assert.ok(tiles > 0, `${state.id}: mounted no tile at all`);

                // Every tile in every state renders a label and a value box with real
                // area — the shape a capture is worth taking of.
                const empty = await page.evalFn((sel) => {
                    const out = [];
                    for (const el of document.querySelectorAll(sel)) {
                        const label = el.shadowRoot.getElementById('label');
                        const value = el.shadowRoot.getElementById('value');
                        if (!label || !value) { out.push(`${el.getAttribute('label')}: no parts`); continue; }
                        const lr = label.getBoundingClientRect();
                        const vr = value.getBoundingClientRect();
                        if (lr.height <= 0 || vr.height <= 0) {
                            out.push(`${el.getAttribute('label')}: ${lr.height}x${vr.height}`);
                        }
                    }
                    return out;
                }, '#stage-host ui-stat-tile');
                assert.deepEqual(empty, [], `${state.id}: tiles with no rendered box: ${empty}`);
            }
        }));
    });
}

describe('ui-stat-tile across geometries', () => {
    test('the same container renders the same tile at both geometries', () => {
        // Part 4 ground rule 2 / spec §2.1 Rule 1, as a measurement rather than a claim:
        // the containers in the fixture are fixed pixel widths, so if anything in this
        // component read the VIEWPORT the two rows below would differ.
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, 2, `expected both geometries to have run, got ${names}`);
        const [a, b] = names;
        assert.deepEqual(
            acrossGeometries[a], acrossGeometries[b],
            `ui-stat-tile renders differently at ${a} and ${b} for the SAME container — ` +
            'something is reading the viewport (spec §2.1 Rule 1, no @media (width...)).',
        );
    });
});
