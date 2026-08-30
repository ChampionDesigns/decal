/**
 * ui-locked-value.render.test.mjs — Gate A for component #43 (wave 1, item #43).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 floor — asserting only on computed style, box geometry and
 * behaviour, never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — eleven tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token. This is also bug L12's class ("a
 *      private palette duplicating the public tokens value-for-value, declared three
 *      times"): a component holding its own copy would paint the same and NOT move.
 *      Pinned twice over, because the sheet itself is inspected for a private --ui-*
 *      declaration;
 *   2. focus geometry from --ui-focus-*, unclipped, in both offsets — bug L24's class.
 *      The box takes no focus of its own; what is asserted is that it does not BREAK
 *      the ring when a consumer makes it focusable, which is exactly what
 *      `.slate-stepper { overflow: hidden }` does to its caps (slate-components.css:549);
 *   3. container behaviour at both geometries — the box owns no width, tracks its
 *      container exactly, and measures the same at 1281×801 and at the 1000×600 floor
 *      for the same container. That last comparison is the "reads its own container,
 *      never the viewport" proof (Part 4 ground rule 2, spec §2.1 Rule 1);
 *   4. bugs asserted dead. Row #43 cites NONE — grepping LAYOUT_SPEC_DRAFT.md §7 for
 *      "locked" and "dashed" returns §5.2's own row and nothing else, which is why the
 *      sources are trusted for the appearance values here. Four defect CLASSES are
 *      pinned anyway, because this component is shaped exactly like their victims:
 *        · E11 — "25 literal 64px and 18 literal 62px in the editor sheet, while
 *          --slate-control-height is used once (inside a dead rule)";
 *        · E15 + spec §2.3 — "One owner per dimension", the width `!important` that
 *          discards its own call site's computed width;
 *        · E7 — "the step-name input clips its own descenders — 28.8px of line box in
 *          a 28px box", the fixed-height class;
 *        · E19/E16 — nowrap-or-not with no stated overflow, so the copy spills;
 *        · L24 and L12 as above, and P8's mechanism (a sheet from outside reaching in
 *          and flattening the paint) as the shadow-boundary wall test;
 *   5. aria contract. Row #43 cites no Appendix 15 rule — Appendix 15 is the
 *      aria-*-driven STATE selector for .slate-bank / .slate-stepper, and a locked cell
 *      has no state a user can change. What is asserted is the accessible NAME contract
 *      the component does define, plus the negative: it is NON-INTERACTIVE
 *      (profile_editor.js:1097-1098) and must never grow a control;
 *   6. hit-area floor: DELIBERATELY NOT ASSERTED, and asserted not to apply. spec §2.3
 *      case 2 and Appendix 5 govern touch TARGETS and the shared utility's three
 *      consumers are #15, #23 and #35 (CONVENTIONS §5). Nothing here is pressable, so
 *      there is no ::before overlay — asserted, because a hit box with nothing behind
 *      it would sit on top of whatever IS the target in that row.
 *
 * WHERE THE NUMBERS COME FROM. `prov_query.py find --cls pe-value-locked` returns
 * "0 elements matched anywhere in this corpus" — the captured editor state has no HOLD
 * step, so the box never rendered. That is the documented carve-out, so the appearance
 * values are read READ-ONLY from profile-editor-v3.css:639-655 and the ORACLE below
 * supplies what it can: the neighbouring geometry this cell must match, and the
 * computed value of every token it borrows, in both themes. Every literal carries its
 * CITE line. The five DEPARTURES are asserted AS departures, with both numbers named,
 * so a silent drift back to Slate's value is a red test too.
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

const MODULE = ['/src/components/ui-locked-value.js'];

const HELD = 'Holds 02 Preinfusion 84.0 °C';

const MARKUP = `
<div id="cell" style="inline-size: 346px; padding: 24px 0">
    <ui-locked-value id="sized">${HELD}</ui-locked-value>
</div>
<div id="wide-cell" style="inline-size: 640px">
    <ui-locked-value id="wide">Holds previous target</ui-locked-value>
</div>
<div id="narrow-cell" style="inline-size: 200px">
    <ui-locked-value id="narrow">${HELD}</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="named" label="Held target, 84.0 degrees Celsius">84.0 °C</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="plain">Holds previous target</ui-locked-value>
    <ui-locked-value id="gone" hidden>Holds previous target</ui-locked-value>
    <ui-locked-value id="dimmed" disabled>Holds previous target</ui-locked-value>
</div>
<div style="inline-size: 346px">
    <ui-locked-value id="focusable" tabindex="0">Holds previous target</ui-locked-value>
</div>
<div id="band" style="overflow: hidden; inline-size: 360px; display: flex; padding: 8px">
    <ui-locked-value id="clipped" tabindex="0" focus-ring="inset"
        style="flex: 1 1 auto">Holds previous target</ui-locked-value>
</div>
`;

/* The oracle's own numbers and the source record, so the code that asserts them names
 * them once.
 *
 *   SOURCE profile-editor-v3.css:639-655 (.pe-value-locked), read read-only because
 *   the corpus has no record of this element:
 *       width: var(--pe-control-width) !important;  height: 64px;
 *       display: inline-flex; align-items: center; justify-content: center;
 *       padding: 0 14px;  border: 1px dashed var(--slate-line-strong);
 *       border-radius: var(--slate-radius);  background: var(--slate-surface);
 *       color: var(--slate-muted);  font-family: var(--slate-font-ui);
 *       font-size: var(--slate-text-note);  font-weight: 400;
 *       letter-spacing: 0;  text-align: center;
 *
 *   CITE editor-steps .pe-stepper [i=33] width = 346px <- profile-editor-v3.css
 *        `.pe-grid .pe-stepper` authored `var(--pe-control-width)` !important=yes
 *        (FROZEN/hardcoded)
 *   CITE editor-steps .pe-stepper [i=33] height = 64px <- profile-editor-v3.css
 *        `.pe-stepper` authored `64px` !important=no (FROZEN/hardcoded)
 *   CITE editor-steps .pe-stepper [i=33] min-height = 64px <- profile-editor-v3.css
 *        `.pe-stepper` authored `64px` !important=no (FROZEN/hardcoded)
 *   CITE editor-steps .pe-stepper [i=33] border-top-left-radius = 6px <-
 *        profile-editor-v3.css `.pe-stepper` authored (NOT CAPTURED - set via a CSS
 *        shorthand) !important=no (token-driven)
 *   CITE editor-steps .pe-stepper [i=33] font-weight = 400 <- (no declaration -
 *        inherited or initial value) (FROZEN/hardcoded)
 *   CITE editor-steps .pe-stepper [i=33] letter-spacing = normal <- (no declaration -
 *        inherited or initial value) (FROZEN/hardcoded)
 *   CITE settings-help-keyboard-shortcuts #kb-current-sleeping [i=58] border-top-color:
 *        dark rgb(82, 97, 107) / light rgb(170, 178, 183) <- slate-components.css
 *        `.slate-keycap` authored (NOT CAPTURED - set via a CSS shorthand) !important=no
 *   CITE settings-help-keyboard-shortcuts #kb-current-sleeping [i=58]
 *        border-top-width = 1px <- slate-components.css `.slate-keycap` authored
 *        (NOT CAPTURED - set via a CSS shorthand) !important=no (token-driven)
 *   CITE profile-selector #profile_notes [i=189] background-color: dark rgb(24, 30, 35)
 *        / light rgb(255, 255, 255) <- slate-shell.css `#subpage-host
 *        #profile-editor-grid #profile-chart-wrap, #subpage-host #profile-editor-grid
 *        #profile_notes` authored (NOT CAPTURED - set via a CSS shorthand) !important=no
 *   CITE editor-steps .pe-value-unit [i=37] color: dark rgb(148, 161, 169) / light
 *        rgb(90, 101, 108) <- profile-editor-v3.css `.pe-value-unit, .pe-value-feel`
 *        authored `var(--slate-muted)` !important=no (token-driven)
 *   CITE modal-numpad #numpad-confirm [i=169] font-size = 16px <- numpad-modal.css
 *        `.numpad-modal-cancel, .numpad-modal-confirm` authored `var(--slate-text-note)`
 *        !important=no (token-driven)
 *   CITE modal-numpad #numpad-confirm [i=169] height = 64px <- numpad-modal.css
 *        `.numpad-modal-cancel, .numpad-modal-confirm` authored
 *        `var(--slate-control-height)` !important=no (token-driven)
 */
const ORACLE = {
    dark: {
        edge: 'rgb(82, 97, 107)',        // --slate-line-strong / --ui-line-strong
        face: 'rgb(24, 30, 35)',         // --slate-surface     / --ui-surface
        ink: 'rgb(148, 161, 169)',       // --slate-muted       / --ui-muted
    },
    light: {
        edge: 'rgb(170, 178, 183)',
        face: 'rgb(255, 255, 255)',
        ink: 'rgb(90, 101, 108)',
    },
    /* Theme-independent, from the same records. */
    edgeWidth: '1px',
    edgeStyle: 'dashed',
    radius: '6px',
    fontSize: '16px',
    fontWeight: '400',
    tracking: 'normal',
    controlH: 64,
    controlInner: 62,          // = --ui-control-inner, derived (spec §3.1)
    /* The three values this build deliberately does NOT reproduce — see DEPARTURES. */
    slatePadding: '14px',      // off the spacing scale
    slateWidth: 346,           // pinned with !important, one owner too many
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-locked-value @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-locked-value must mount without throwing');
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

        test('drill: the three colour tokens are the edge, the face and the ink', () => mounted(async (page) => {
            // Bug L12's class: a component carrying its own copy of the palette would
            // paint identically and NOT move when the public token moves.
            await assertTokenDrill(page, {
                token: '--ui-line-strong',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'border-top-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-surface',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#sized >>> #box',
                property: 'color',
            });
        }));

        test('drill: --ui-control-h is the floor, and it is a FLOOR', () => mounted(async (page) => {
            // Bug E11's class, as a drill: Slate authors this as a literal 64px (one of
            // "25 literal 64px ... while --slate-control-height is used once, inside a
            // dead rule"), and the oracle reads it back as FROZEN/hardcoded. A literal
            // here would not move.
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'min-height',
            });
        }));

        test('drill: --ui-space-3, --ui-radius, --ui-border-w and --ui-hairline', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: '#sized >>> #box',
                property: 'border-top-left-radius',
            });
            // `expected` is supplied rather than left to resolveValue, because
            // border-width's USED value is 0 when border-style is none — the probe the
            // helper resolves against has no style, so `border-top-width: 5px` computes
            // to 0px there and to 5px here. Naming the number keeps the landing check.
            await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: '5px',
                expected: '5px',
                selector: '#sized >>> #box',
                property: 'border-top-width',
            });
            // --ui-border-w is `var(--ui-hairline)` (styles/tokens.css:409), so moving
            // the hairline must move the edge too — that derivation is the whole reason
            // the hairline is a token ("kept as a token so it can go to 0.5px/dpr",
            // spec §3.1) and a component reading a literal 1px would break it.
            await assertTokenDrill(page, {
                token: '--ui-hairline',
                value: '5px',
                expected: '5px',
                selector: '#sized >>> #box',
                property: 'border-top-width',
            });
        }));

        test('drill: --ui-text-note, --ui-weight-regular and --ui-font-family', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note',
                value: '31px',
                selector: '#sized >>> #box',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-regular',
                value: '800',
                selector: '#sized >>> #box',
                property: 'font-weight',
            });
            // Restated deliberately against CONVENTIONS §11's default, because Slate
            // names the UI family here on purpose: this box sits in a column of
            // numeric-family value cells and its content is prose. A token, never an
            // @font-face in a component (spec §6.3 Rule 2).
            await assertTokenDrill(page, {
                token: '--ui-font-family',
                value: '"DrillFace", monospace',
                selector: '#sized >>> #box',
                property: 'font-family',
            });
        }));

        test('the component declares no tokens of its own — bug L12 by construction', () => mounted(async (page) => {
            // L12 is "a private palette duplicating the public tokens value-for-value,
            // declared three times". The drills above prove the tokens are READ; this
            // proves none are DECLARED, which is the other half. Internals are --_ui-*
            // by convention precisely so this scan cannot confuse them (CONVENTIONS §7).
            const declared = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return [...text.matchAll(/(^|[^r(])(--ui-[a-z0-9-]+)\s*:/g)].map((m) => m[2]);
            }, '#sized');
            assert.deepEqual(declared, [], `this component declares public tokens: ${declared}`);
        }));

        test('zero !important in the component\'s own rules — spec §2.1 Rule 3', () => mounted(async (page) => {
            // Slate's one rule for this element opens with `width: var(--pe-control-width)
            // !important`. CONVENTIONS §6: "Nothing can reach into a shadow root, so the
            // only remaining reason to write one would be to beat the base rules", and
            // both legs of that are removed. Gate C scans the source; this scans what
            // the browser actually adopted, which is the same claim one step later.
            const bangs = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return (text.match(/!\s*important/g) || []).length;
            }, '#sized');
            assert.equal(bangs, 0, 'the adopted rules carry an !important');
        }));

        /* -- the measured starting values, both themes ---------------------- */

        test('the resting paint is the sources\' measured values, in both themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];
                const c = await page.computed('#sized >>> #box',
                    ['border-top-color', 'background-color', 'color']);
                assert.equal(c['border-top-color'], want.edge, `${theme}: --ui-line-strong`);
                assert.equal(c['background-color'], want.face, `${theme}: --ui-surface`);
                assert.equal(c.color, want.ink, `${theme}: --ui-muted`);
            }
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const c = await page.computed('#sized >>> #box', [
                'border-top-width', 'border-top-style', 'border-top-left-radius',
                'font-size', 'font-weight', 'letter-spacing', 'text-align', 'min-height',
            ]);
            assert.equal(c['border-top-width'], ORACLE.edgeWidth, 'CITE [i=58] 1px');
            assert.equal(c['border-top-style'], ORACLE.edgeStyle,
                'SOURCE profile-editor-v3.css:646 — dashed is the whole signal that this cell is locked');
            assert.equal(c['border-top-left-radius'], ORACLE.radius, 'CITE [i=33] 6px');
            assert.equal(c['font-size'], ORACLE.fontSize, 'CITE [i=169] 16px = --slate-text-note');
            assert.equal(c['font-weight'], ORACLE.fontWeight, 'CITE [i=33] 400');
            // Slate's own rule authors `letter-spacing: 0` (SOURCE :653) and the
            // neighbouring stepper computes `normal` (CITE [i=33]). They render the same;
            // the keyword is preferred so this box does not pin a different one from the
            // column it sits in.
            assert.equal(c['letter-spacing'], ORACLE.tracking, 'CITE editor-steps .pe-stepper [i=33] normal');
            assert.equal(c['text-align'], 'center', 'SOURCE profile-editor-v3.css:654');
            assert.equal(c['min-height'], `${ORACLE.controlH}px`, 'CITE [i=169] 64px = --slate-control-height');
        }));

        test('the edge is dashed on all four sides, and it is one hairline', () => mounted(async (page) => {
            const c = await page.computed('#sized >>> #box', [
                'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
                'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
            ]);
            assert.deepEqual(
                [c['border-top-style'], c['border-right-style'], c['border-bottom-style'], c['border-left-style']],
                ['dashed', 'dashed', 'dashed', 'dashed'],
            );
            assert.deepEqual(
                [c['border-top-width'], c['border-right-width'], c['border-bottom-width'], c['border-left-width']],
                ['1px', '1px', '1px', '1px'],
            );
        }));

        /* -- DEPARTURE 1: one owner per dimension (E15, spec §2.3) ----------- */

        test('DEPARTURE 1: the box owns no width — the container does', () => mounted(async (page) => {
            // CITE editor-steps .pe-stepper [i=33] width = 346px ... !important=yes.
            // Slate's `width: var(--pe-control-width) !important` exists to beat
            // `el.style.width = width + 'px'` written by its own call site
            // (profile_editor.js:1104), so the width threaded through
            // makeValueLocked(text, width = 260, plain) is computed and discarded —
            // spec §2.3, "Layout computed in JS and then overridden in CSS. ONE OWNER
            // PER DIMENSION", and E15's 346-in-a-372px-column is the same number.
            for (const width of [346, 260, 640, 200]) {
                await page.setStyle('#cell', { 'inline-size': `${width}px` });
                const box = await page.box('#sized >>> #box');
                assert.ok(
                    Math.abs(box.width - width) < 0.5,
                    `at a ${width}px container the box measured ${box.width}px — something pins its width`,
                );
            }
            await page.setStyle('#cell', { 'inline-size': '346px' });

            // And the specific failure named: nothing anywhere reproduces the 346.
            await page.setStyle('#cell', { 'inline-size': '260px' });
            const pinned = await page.box('#sized >>> #box');
            assert.notEqual(Math.round(pinned.width), ORACLE.slateWidth,
                'the box fell back to Slate\'s pinned 346px in a 260px container');
            await page.setStyle('#cell', { 'inline-size': '346px' });
        }));

        test('DEPARTURE 1: two containers, two widths, one component', () => mounted(async (page) => {
            const narrow = await page.box('#narrow >>> #box');
            const wide = await page.box('#wide >>> #box');
            assert.ok(Math.abs(narrow.width - 200) < 0.5, `narrow cell: ${narrow.width}px`);
            assert.ok(Math.abs(wide.width - 640) < 0.5, `wide cell: ${wide.width}px`);
        }));

        /* -- DEPARTURE 2: the height is the token, and it is a floor (E11, E7) -- */

        test('DEPARTURE 2: 64px comes from --ui-control-h, not from a literal', () => mounted(async (page) => {
            // E11: "25 literal 64px and 18 literal 62px in the editor sheet, while
            // --slate-control-height is used once (inside a dead rule)". The oracle reads
            // this box's neighbour as `authored 64px (FROZEN/hardcoded)` and the numpad's
            // buttons — the same 64px — as `authored var(--slate-control-height)
            // (token-driven)`. One of those two is the bug.
            const token = await page.resolveValue('var(--ui-control-h)', 'min-height');
            const got = await page.prop('#sized >>> #box', 'min-height');
            assert.equal(got, token);
            const box = await page.box('#sized >>> #box');
            assert.ok(Math.abs(box.height - ORACLE.controlH) < 0.5,
                `resting height ${box.height}px against the record's ${ORACLE.controlH}px`);
        }));

        test('DEPARTURE 2: the content box IS --ui-control-inner, derived not declared', () => mounted(async (page) => {
            // spec §3.1: "--ui-control-inner ... DERIVED, not declared. Today it is a
            // literal, and the editor writes it out 18 times as 62px while using the
            // token ZERO times." Nothing in this component says 62; border-box plus one
            // hairline produces it.
            const m = await page.metrics('#sized >>> #box');
            assert.ok(Math.abs(m.clientHeight - ORACLE.controlInner) < 0.5,
                `content box ${m.clientHeight}px against --ui-control-inner's ${ORACLE.controlInner}px`);
            const derived = await page.resolveValue('var(--ui-control-inner)', 'height');
            assert.equal(parseFloat(derived), ORACLE.controlInner,
                'the token itself must still derive to 62px');
        }));

        test('DEPARTURE 2: the floor GROWS rather than clipping — bug E7\'s class', () => mounted(async (page) => {
            // E7: "The step-name input clips its own descenders — 28.8px of line box in a
            // 28px box". A fixed `height` clips; a `min-block-size` floor grows. spec §2.3
            // case 4 makes minimum floors required, not merely permitted.
            const before = await page.box('#sized >>> #box');
            await page.setToken('--ui-text-note', '72px');
            const after = await page.box('#sized >>> #box');
            const inner = await page.metrics('#sized >>> #box');
            await page.setToken('--ui-text-note', null);
            const restored = await page.box('#sized >>> #box');

            assert.ok(after.height > before.height + 10,
                `at 72px type the box stayed ${after.height}px — a fixed height would clip the line box`);
            assert.ok(inner.scrollHeight <= inner.clientHeight + 0.5,
                `the text overflows its own box by ${inner.scrollHeight - inner.clientHeight}px`);
            assert.ok(Math.abs(restored.height - before.height) < 0.5, 'and it comes back');
        }));

        /* -- DEPARTURE 3: the padding snaps to the scale (spec §3.3) --------- */

        test('DEPARTURE 3: inline padding is --ui-space-3, not Slate\'s off-scale 14px', () => mounted(async (page) => {
            // styles/tokens.css:242-244: "The seven steps are the WHOLE vocabulary;
            // off-scale values snap to the nearest step (§3.3). Today
            // 30/32/26/20/16/14/9/6/10/36/48 are all in live use." 14 is nearer 12 than 18.
            const c = await page.computed('#sized >>> #box', ['padding-left', 'padding-right',
                'padding-top', 'padding-bottom']);
            const step = await page.resolveValue('var(--ui-space-3)', 'padding-left');
            assert.equal(c['padding-left'], step);
            assert.equal(c['padding-right'], step);
            assert.notEqual(c['padding-left'], ORACLE.slatePadding,
                'the off-scale 14px came back');
            assert.equal(c['padding-top'], '0px', 'SOURCE profile-editor-v3.css:645 — 0 on the block axis');
            assert.equal(c['padding-bottom'], '0px');
        }));

        /* -- DEPARTURE 4: one line, with an ellipsis (E19/E16's class) ------- */

        test('DEPARTURE 4: long copy clamps on one line instead of spilling', () => mounted(async (page) => {
            // Slate's rule states no white-space and no overflow, so held-target copy
            // wraps and leaves a fixed 64px box — E19's class ("white-space: nowrap ...
            // with no overflow") and E16's ("neither the cell nor .pe-exit-cell sets
            // overflow, so the excess spills symmetrically into the rows above and
            // below"). The treatment is the same sheet's own value cell,
            // profile-editor-v3.css:568-578 and :593-604.
            const box = await page.box('#narrow >>> #box');
            const text = await page.box('#narrow >>> #text');
            const c = await page.computed('#narrow >>> #text',
                ['overflow-x', 'text-overflow', 'white-space']);

            assert.equal(c['overflow-x'], 'hidden');
            assert.equal(c['text-overflow'], 'ellipsis');
            assert.equal(c['white-space'], 'nowrap');

            assert.ok(Math.abs(box.height - ORACLE.controlH) < 0.5,
                `the copy wrapped: the box grew to ${box.height}px in a 200px container`);
            assert.ok(text.right <= box.right + 0.5 && text.left >= box.left - 0.5,
                `the text spilled out of its box: text [${text.left}, ${text.right}] vs box [${box.left}, ${box.right}]`);

            const m = await page.metrics('#narrow >>> #text');
            assert.ok(m.scrollWidth > m.clientWidth + 0.5,
                'the assertion is vacuous — this copy is not actually too long for a 200px cell');
        }));

        test('DEPARTURE 4: it is a clamp, not a truncation — the text stays whole', () => mounted(async (page) => {
            // The ellipsis is visual only. A screen reader and a copy-paste both still
            // get the sentence, which is what separates this from cutting the string.
            const said = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), '#narrow');
            assert.equal(said, HELD);
        }));

        /* -- 2 / DEPARTURE 5: focus geometry, unclipped (bug L24) ------------ */

        test('DEPARTURE 5: made focusable, it gets THE ring, unclipped', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#focusable');
        }));

        test('DEPARTURE 5: inside an overflow:hidden band, the inset offset keeps it whole', () => mounted(async (page) => {
            // L24 is "focus rings clipped on all four sides by the components they sit
            // inside", and its named mechanism is `.slate-stepper { overflow: hidden }`
            // (slate-components.css:549) — the very component this box is a
            // stepper-with-no-caps of.
            const g = await assertFocusUnclipped(page, '#clipped');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset, 'focus-ring="inset" must select the inset offset');
        }));

        test('nothing in this component clips a ring of its own', () => mounted(async (page) => {
            // The box sets no overflow at all — the ellipsis clip is one span INSIDE it
            // and contains nothing focusable. That is the difference between this and
            // the stepper it replaces.
            const c = await page.computed('#focusable >>> #box', ['overflow-x', 'overflow-y']);
            assert.equal(c['overflow-x'], 'visible');
            assert.equal(c['overflow-y'], 'visible');
        }));

        /* -- 3. container behaviour ------------------------------------------ */

        test('the box reads its container, never the viewport', () => mounted(async (page) => {
            // Part 4 ground rule 2 / spec §2.1 Rule 1. Recorded here and compared across
            // geometries at the end of the file: same container, same box, two viewports.
            const box = await page.box('#sized >>> #box');
            acrossGeometries[geometry.name] = {
                width: Math.round(box.width * 100) / 100,
                height: Math.round(box.height * 100) / 100,
            };
            assert.ok(Math.abs(box.width - 346) < 0.5);
        }));

        test('the host is a container, and no rule here is keyed on a media query', () => mounted(async (page) => {
            // CONVENTIONS §2: container-type: inline-size stays at the base default,
            // which is right for anything filling a slot. There is no
            // `:host { container-type: normal }` opt-out in this component, and no
            // @media (width…) anywhere — the wave law's one global-query exception is
            // the two height bands on :root in styles/tokens.css.
            assert.equal(await page.prop('#sized', 'container-type'), 'inline-size');
            const widthQueries = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = [...host.shadowRoot.adoptedStyleSheets]
                    .flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
                return (text.match(/@media[^{]*\b(width|min-width|max-width)\b/g) || []).length;
            }, '#sized');
            assert.equal(widthQueries, 0, 'a component wrote a viewport width query');
        }));

        test('at the floor container the box still clears the touch floor it inherits', () => mounted(async (page) => {
            // Not a hit-area claim (see below) — a legibility one. The block floor is
            // --ui-control-h, which is above --ui-hit-min at every container width, so a
            // cell squeezed by its column never becomes a 32px sliver (bug L22's shape).
            await page.setStyle('#cell', { 'inline-size': '120px' });
            const box = await page.box('#sized >>> #box');
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'height'));
            await page.setStyle('#cell', { 'inline-size': '346px' });
            assert.ok(box.height >= floor - 0.5,
                `at a 120px container the box is ${box.height}px tall, under the ${floor}px floor`);
        }));

        /* -- 4. the shadow boundary is the wall (P8's mechanism) -------------- */

        test('a sheet from outside cannot reach in and flatten the paint', () => mounted(async (page) => {
            // P8: "the one affirmative action on the screen has no primary treatment;
            // measured transparent, identical to Cancel beside it. The comment above the
            // rule states the intent the rule defeats." The mechanism is one sheet
            // reaching an element another sheet owns. Nothing can reach into a shadow
            // root — asserted rather than assumed, with !important for good measure.
            const before = await page.computed('#sized >>> #box',
                ['background-color', 'border-top-color', 'color', 'border-top-style']);
            await page.eval(`(() => {
                const s = document.createElement('style');
                s.textContent = '.box, #box, ui-locked-value div, div { background-color: rgb(1, 2, 3) !important;'
                    + ' border-color: rgb(1, 2, 3) !important; color: rgb(1, 2, 3) !important;'
                    + ' border-style: solid !important }';
                document.head.appendChild(s);
                return true;
            })()`);
            await page.settle(2);
            const after = await page.computed('#sized >>> #box',
                ['background-color', 'border-top-color', 'color', 'border-top-style']);
            assert.deepEqual(after, before, 'a document sheet repainted the shadow tree');
        }));

        /* -- 5. the aria / interaction contract ------------------------------- */

        test('it is NON-INTERACTIVE, and there is no control inside it', () => mounted(async (page) => {
            // profile_editor.js:1097-1098: "intentionally NON-INTERACTIVE (no numpad,
            // no +/-): a HOLD step carries no authored target." #4 Stepper is a separate
            // wave-2 item; this is not a variant of it (ITEMS.json #43).
            const state = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                return {
                    tabIndex: host.tabIndex,
                    hasTabindexAttr: host.hasAttribute('tabindex'),
                    role: host.getAttribute('role'),
                    innerRole: host.shadowRoot.querySelector('[role]') ? 'yes' : null,
                    tag: host.shadowRoot.getElementById('box').tagName,
                };
            }, '#plain');
            assert.equal(state.tabIndex, -1, 'the box must not put itself in the tab order');
            assert.equal(state.hasTabindexAttr, false);
            assert.equal(state.role, null, 'a locked cell has no role of its own');
            assert.equal(state.innerRole, null);
            assert.equal(state.tag, 'DIV', 'the box is a div — never a button, never an input');

            assert.equal(
                await page.count('#plain >>> :is(button, input, select, textarea, a, [tabindex])'), 0,
                'a control appeared inside a cell whose whole point is that there is none',
            );
        }));

        test('focusability is the consumer\'s to grant, and it works when granted', () => mounted(async (page) => {
            // A wave-4 grid with a roving tabindex may well want the cell reachable so it
            // can be read. The primitive neither grabs that nor blocks it.
            assert.equal(await page.evalFn((s) => window.__h.need(s).tabIndex, '#focusable'), 0);
        }));

        test('the label escape hatch names a bare reading without showing it twice', () => mounted(async (page) => {
            const a = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                const text = host.shadowRoot.getElementById('text');
                const a11y = host.shadowRoot.getElementById('a11y');
                return {
                    hidden: text.getAttribute('aria-hidden'),
                    said: a11y ? a11y.textContent : null,
                };
            }, '#named');
            assert.equal(a.hidden, 'true', 'the visible glyphs must not be read as well as the label');
            assert.equal(a.said, 'Held target, 84.0 degrees Celsius');

            const hiddenBox = await page.box('#named >>> #a11y');
            assert.ok(hiddenBox.width <= 1.5 && hiddenBox.height <= 1.5,
                `the label is visible: ${hiddenBox.width}×${hiddenBox.height}`);
        }));

        test('without a label the visible text IS the accessible content', () => mounted(async (page) => {
            const a = await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                return {
                    hidden: host.shadowRoot.getElementById('text').getAttribute('aria-hidden'),
                    extra: host.shadowRoot.getElementById('a11y'),
                };
            }, '#plain');
            assert.equal(a.hidden, null, 'nothing must be hidden when there is no replacement name');
            assert.equal(a.extra, null);
        }));

        /* -- 6. the hit floor, asserted NOT to apply -------------------------- */

        test('no hit overlay: the shared utility is not this component\'s (CONVENTIONS §5)', () => mounted(async (page) => {
            // spec §2.3 case 2 / Appendix 5 govern touch TARGETS, and the utility's three
            // consumers are #15, #23 and #35. Nothing here is pressable, so a ::before
            // hit box would sit on top of whatever IS the target in that row — the
            // inverse of bugs P4 and L22, which are floors claimed and not met.
            const before = await page.computed('#plain >>> #box', ['content'], { pseudo: '::before' });
            assert.equal(before.content, 'none', 'a hit overlay appeared on a non-target');
        }));

        /* -- the two base states this component leans on ---------------------- */

        test('[hidden] beats layout, because state beats layout', () => mounted(async (page) => {
            // slate-components.css:230-239: "A component sets `display`, which outranks
            // the [hidden] attribute — so hiding one by script silently did nothing."
            // Slate's answer was `display: none !important`; the base's :host([hidden])
            // is (0,2,0) and wins on specificity with zero !important.
            assert.equal(await page.prop('#gone', 'display'), 'none');
            assert.equal(await page.prop('#plain', 'display'), 'block');
        }));

        test('disabled dims from the one dial, and dims the whole box', () => mounted(async (page) => {
            // Compared as numbers: the token is AUTHORED `.38` (spec §3.7, settling
            // Slate's three live values) and Chrome computes `0.38`. String equality
            // would be asserting the serialisation, not the dial.
            const dial = await page.tokenValue('--ui-opacity-disabled');
            assert.equal(
                parseFloat(await page.prop('#dimmed', 'opacity')),
                parseFloat(dial),
                `the dimmed box is not on --ui-opacity-disabled (${dial})`,
            );
            assert.equal(await page.prop('#plain', 'opacity'), '1');
        }));
    });
}

test('the same container gives the same box at both standard geometries', () => {
    // The proof that this component reads its container and not the viewport: 1281×801
    // @ dsf 1.5 and 1000×600 @ dsf 1 are 281 CSS px and one device-pixel ratio apart,
    // and a 346px cell is a 346px box in both. A component keyed on @media would not
    // survive this (spec §2.1 Rule 1; Part 4 ground rule 2).
    const names = Object.keys(acrossGeometries);
    assert.ok(names.length >= 2, `only ran at ${names.join(', ')}`);
    const [first, ...rest] = names;
    for (const name of rest) {
        assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
            `${name} vs ${first}: ${JSON.stringify(acrossGeometries)}`);
    }
});
