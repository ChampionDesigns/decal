/**
 * ui-subnav-row.render.test.mjs — Gate A for component #25 (wave 2, item #25).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. the token drill — nine tokens retargeted on :root with the rendered value
 *      asserted to move, to land, and to come back;
 *   2. THE DIAL DRILL — assertOneSelectionTreatment, which is wave 2's headline
 *      obligation and had zero subjects in wave 1. Face, ink, LED and glow, each
 *      proved by moving it;
 *   3. focus geometry from --ui-focus-*, unclipped, in BOTH offsets (bug L24's class);
 *   4. container floor behaviour — the row reads its own container and REFUSES to
 *      shrink with it (spec §2.2: ergonomics is physical); the label clips instead;
 *   5. one assertion per bug id on row #25 — T2, T3, T5 — each written so the defect
 *      is INEXPRESSIBLE rather than merely absent, and each citing its §7 text;
 *   6. the aria contract (spec Appendix 15) and the hit floor (spec §2.3 / Appendix 5).
 *
 * Plus the one this component owes the wave: SELECTION MOVES NOTHING BUT THE FIVE
 * DIALS' OWN PROPERTIES. Slate's selected sub-nav row also lifts the type weight
 * 400 → 500, and since parity surface 2 so does this one — through
 * --ui-selected-weight, the fifth dial (base.js), never through a rule of its own.
 * The comparison is made property by property across the corpus's whole 18-property
 * appearance surface.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY in both themes, because "measured from the
 * oracle" should be checkable rather than claimed — and only where the oracle is
 * qualified. This element is on the §7 bug list three times, so its HEIGHT, PITCH,
 * SEPARATORS, RADIUS and SELECTED BOX-SHADOW come from the layout spec and are
 * asserted AGAINST the corpus. Every literal carries its CITE.
 *
 * A NOTE ON --ui-nav-row AND THE DENSITY BAND. styles/tokens.css:220 is
 * calc((--ui-control-h + 2 × --ui-space-3) × --ui-density) and :928 drops --ui-density
 * to 0.875 below 700px of window height — so the row is 88px at BENCH and 77px at the
 * FLOOR, by design and not by drift. Nothing below hardcodes 88: every geometric
 * assertion resolves the token first, and the two numbers are pinned once, at the end,
 * as the band's own signature.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-subnav-row.js'];

/* The seven-row column T2 measures. Row 7 is where its 4px-per-row drift reaches the
 * 24px it names, so seven is the length that makes the assertion the bug's own.
 *   CITE prov_query.py find --cls settings-subnav-btn → "found 173 element(s) in 38
 *        state(s)"; settings-machine-machine-info rects [261,219,338,89]
 *        [261,312,338,89] [261,405,338,89] [261,498,338,89] [261,591,338,89]
 *        [261,684,338,89] [261,777,338,89] — height 89 on a pitch of 93. */
const LABELS = ['Cup Warmer', 'Lighting', 'USB Charger', 'Steam', 'Hot Water', 'Flush', 'Advanced'];
const N = LABELS.length;

/* A seam grid, written the way CONVENTIONS §13 describes it and the way spec §4.4's
 * skeleton draws it — display:grid, gap: var(--ui-seam), a coloured ground showing
 * through the gap. The classes live in src/components/seams.js for a shadow root; a
 * test document that does not adopt that sheet expresses the same two declarations
 * inline, from the same tokens. */
const COLUMN_STYLE = 'display:grid; align-content:start; gap:var(--ui-seam);'
    + ' background-color:var(--ui-line);';

const subRows = LABELS.map((label, i) =>
    `<ui-subnav-row id="s${i}" value="v${i}"${i === 1 ? ' current' : ''}>${label}</ui-subnav-row>`,
).join('');

/* The category column, simulated as plain cells of the SAME token. #24 is another
 * builder's file in this wave and may not exist on disk while this suite runs, so the
 * reference is the token itself — which is the whole of T2's fix: one owner, one
 * dimension, two columns that cannot drift because neither holds a number. */
const catRows = LABELS.map((_, i) =>
    `<div id="c${i}" style="block-size:var(--ui-nav-row); background-color:var(--ui-fascia)"></div>`,
).join('');

const MARKUP = `
<div id="columns" style="display:flex; align-items:flex-start; gap:var(--ui-space-5)">
    <div id="cat" style="${COLUMN_STYLE} inline-size:260px">${catRows}</div>
    <div id="sub" style="${COLUMN_STYLE} inline-size:338px">${subRows}</div>
</div>
<div id="stack" style="inline-size:338px">
    <ui-subnav-row id="p0">Machine</ui-subnav-row>
    <ui-subnav-row id="p1">Display</ui-subnav-row>
    <ui-subnav-row id="p2">Calibration</ui-subnav-row>
</div>
<div id="clipper" style="overflow-y:auto; block-size:200px; inline-size:338px; ${COLUMN_STYLE}">
    <ui-subnav-row id="d0">Descaling</ui-subnav-row>
    <ui-subnav-row id="d1">Water hardness</ui-subnav-row>
    <ui-subnav-row id="d2">Steam</ui-subnav-row>
    <ui-subnav-row id="d3">Rinse</ui-subnav-row>
</div>
<div id="open-holder" style="inline-size:338px">
    <ui-subnav-row id="outset" focus-ring="outset">Descaling</ui-subnav-row>
</div>
<div id="narrow" style="inline-size:180px">
    <ui-subnav-row id="cramped">Default load settings and other long words</ui-subnav-row>
</div>
<div id="misc" style="inline-size:338px">
    <ui-subnav-row id="off" disabled>Transport Mode</ui-subnav-row>
    <ui-subnav-row id="gone" hidden>Hidden</ui-subnav-row>
</div>
`;

const HOST = (id) => `ui-subnav-row#${id}`;
const ROW = (id) => `ui-subnav-row#${id} >>> #row`;
const LABEL = (id) => `ui-subnav-row#${id} >>> #label`;

/* The oracle's own numbers, named once. Only the QUALIFIED ones are here; the
 * disqualified five (height, pitch, separators, radius, selected box-shadow) appear in
 * the bug section below as the values this component must NOT reproduce.
 *
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=32] color:
 *        dark rgb(148, 161, 169) / light rgb(90, 101, 108) ← slate-shell.css
 *        `#subpage-host .settings-subnav-btn` authored `var(--slate-muted)`
 *        !important=yes (token-driven)
 *   CITE settings-accessories-cup-warmer #sub-categories-panel [i=29] background-color:
 *        dark rgb(14, 19, 23) / light rgb(242, 243, 243) ← slate-shell.css
 *        `#subpage-host … #sub-categories-panel` authored (NOT CAPTURED — shorthand)
 *        !important=yes (token-driven)
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=30] background-color:
 *        dark rgb(176, 196, 206) / light rgb(49, 92, 112) ← slate-shell.css
 *        `… .slate-nav-selected, … [aria-current="true"], … [aria-selected` authored
 *        (NOT CAPTURED — shorthand) !important=yes (token-driven)
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=30] color:
 *        dark rgb(18, 24, 28) / light rgb(248, 252, 253) ← same rule, authored
 *        `var(--slate-selected-ink)` !important=yes (token-driven)
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=32] font-size = 22px
 *        authored `var(--slate-text-nav)`; font-weight = 400 authored
 *        `var(--slate-weight-regular)`; [i=34] padding-left = 24px (shorthand
 *        `padding: 0 var(--slate-space-5)`); letter-spacing = normal;
 *        text-transform = none; opacity = 1; border-top-width = 0px
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34] box-shadow = none
 *        ← (no declaration — inherited or initial value) (FROZEN/hardcoded) */
const ORACLE = {
    dark: {
        ink: 'rgb(148, 161, 169)',
        ground: 'rgb(14, 19, 23)',
        selectedFace: 'rgb(176, 196, 206)',
        selectedInk: 'rgb(18, 24, 28)',
        hoverInk: 'rgb(244, 247, 248)',   // --ui-text, styles/tokens.css:847
        hoverFace: 'rgb(26, 33, 39)',     // --ui-key,  styles/tokens.css:843
    },
    light: {
        ink: 'rgb(90, 101, 108)',
        ground: 'rgb(242, 243, 243)',
        selectedFace: 'rgb(49, 92, 112)',
        selectedInk: 'rgb(248, 252, 253)',
        hoverInk: 'rgb(23, 26, 28)',      // --ui-text, styles/tokens.css:726
        hoverFace: 'rgb(248, 249, 249)',  // --ui-key,  styles/tokens.css:722
    },
    fontSize: '22px',
    fontWeight: '400',
    paddingLeft: '24px',
    gap: '4px',            // Slate's 2px snapped to the scale, spec §3.3 → --ui-space-1
    /* The four numbers this component is here to NOT reproduce. */
    bug: { height: 89, pitch: 93, radius: '6px', led: '-4px' },
};

/** Whole CSS px — the comparison CONVENTIONS §10 mandates at dsf 1.5. */
const roundPx = (v) => Math.round(parseFloat(v));

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

/* A DEVICE THAT HOVERS, and why this suite asks for one.
 *
 * Headless Chrome has no pointing device: MEASURED in this rig,
 * matchMedia('(hover: hover)') is FALSE and '(hover: none)' is true. DEPARTURE 6 puts
 * the hover face inside @media (hover: hover) — the guard #24 carries — so under the
 * default launch that rule is DEAD and every hover assertion below would pass by
 * measuring the resting paint three times. This flag gives the browser a hovering,
 * fine pointer; the touch panel is then emulated per test with
 * Emulation.setEmulatedMedia, which can take the feature away but cannot hand it over.
 * MEASURED with the flag: (hover: hover), (any-hover: hover) and (pointer: fine) all
 * match. Nothing else in the suite is sensitive to it — :hover matches nothing until
 * a mouse event is dispatched, and every test opens its own page. */
const HOVER_CAPABLE = ['--blink-settings=primaryHoverType=2,availableHoverTypes=2,'
    + 'primaryPointerType=4,availablePointerTypes=4'];

/* THE TOUCH PANEL IS THE DEFAULT LAUNCH, and that is not a convenience — it is the
 * device. Headless Chrome with no flag has NO pointing device: (hover: none) and
 * (pointer: none) both match, which is what the wall panel this skin ships on reports
 * as well. MEASURED that CDP cannot emulate the other direction: with the flag above
 * live, Emulation.setEmulatedMedia({features:[{name:'hover',value:'none'}]}) does NOT
 * move the rule (the face stayed lit at rgb(26, 33, 39)) — 'hover' is not one of the
 * media features that command supports. So the guard is asserted with a SECOND
 * browser rather than an override, and the two launches are the two devices. */
let browser;        // a device that hovers — everything except the guard assertion
let touchPanel;     // no pointing device — DEPARTURE 6's only honest witness
before(async () => {
    browser = await launch({ extraArgs: HOVER_CAPABLE });
    touchPanel = await launch();
});
after(async () => {
    await browser?.close();
    await touchPanel?.close();
});

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-subnav-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mountedOn = (which, fn) => which.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-subnav-row must mount without throwing');
            return fn(page);
        });

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-subnav-row must mount without throwing');
            return fn(page);
        });

        /** The pitch token, resolved rather than assumed — see the header note. */
        const navRow = (page) => page.resolveToken('--ui-nav-row', 'width').then(parseFloat);
        const seam = (page) => page.resolveToken('--ui-seam', 'width').then(parseFloat);

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

        test('drill: --ui-nav-row is the pitch, and the ONLY owner of it', () => mounted(async (page) => {
            // T2 is a dimension with two owners — the row's height and the column's
            // leftover margin. Moving the token has to move the whole row box, or
            // some other declaration is contributing and the drift can come back.
            await assertTokenDrill(page, {
                token: '--ui-nav-row', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'height',
            });
            const drilled = await assertTokenDrill(page, {
                token: '--ui-nav-row', value: DRILL_LENGTH,
                selector: HOST('s0'), property: 'height',
                expectLanding: false,
            });
            assert.equal(
                roundPx(drilled.after), roundPx(DRILL_LENGTH),
                'the HOST box is the pitch too — a row whose control is the token and whose '
                + 'host is something else is exactly T2 with the numbers swapped',
            );
        }));

        test('drill: the pitch derives from --ui-control-h through the token', () => mounted(async (page) => {
            // spec §3.2: --ui-nav-row = calc(--ui-control-h + 2 × --ui-space-3) × density.
            // The row never does that arithmetic (CONVENTIONS §11); it consumes the
            // result, so moving the base moves the row through the chain.
            const before = parseFloat(await page.prop(ROW('s0'), 'height'));
            await page.setToken('--ui-control-h', '100px');
            const expected = await navRow(page);
            const after = parseFloat(await page.prop(ROW('s0'), 'height'));
            await page.setToken('--ui-control-h', null);
            const restored = parseFloat(await page.prop(ROW('s0'), 'height'));

            assert.notEqual(after, before, '--ui-control-h did not reach the row');
            assert.equal(after, expected, 'the row is --ui-nav-row, whatever the arithmetic behind it');
            assert.equal(restored, before, 'the drill did not restore');
        }));

        test('drill: --ui-fascia is the cell ground (the host paints itself)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia', value: DRILL_COLOUR,
                selector: HOST('s0'), property: 'background-color',
            });
        }));

        test('drill: --ui-muted is the resting ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted', value: DRILL_COLOUR,
                selector: ROW('s0'), property: 'color',
            });
        }));

        test('drill: --ui-space-5 is the inline padding', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'padding-left',
            });
        }));

        test('drill: --ui-text-nav is the type size', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-nav', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'font-size',
            });
        }));

        test('drill: --ui-weight-regular is the resting weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-regular', value: '800',
                selector: ROW('s0'), property: 'font-weight',
            });
        }));

        test('drill: --ui-space-1 is the slot gap', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-1', value: DRILL_LENGTH,
                selector: ROW('s0'), property: 'column-gap',
            });
        }));

        test('drill: --ui-key and --ui-text are the hover face and ink', () => mounted(async (page) => {
            // `prepare` re-establishes the hover between reads: the drill sets the
            // token, and the pointer has to still be over the row when the value is
            // read or the assertion measures the resting paint three times and passes
            // for the wrong reason.
            const hover = async (p) => {
                const b = await p.box(ROW('s2'));
                await p.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await p.settle(1);
            };
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR,
                selector: ROW('s2'), property: 'background-color', prepare: hover,
            });
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR,
                selector: ROW('s2'), property: 'color', prepare: hover,
            });
        }));

        test('DEPARTURE 6: the hover face is guarded by (hover: hover)', () => mounted(async (page) => {
            // Slate's rule is unguarded (slate-shell.css:541-544). On a touch panel
            // :hover STICKS to the last element tapped, so an ordinary sub-nav row keeps
            // the --ui-key face under a finger that has already lifted — and nothing
            // repaints a NON-current row, so the stale face survives until the next tap
            // lands somewhere else. This is a wall panel; #24 carries the same guard and
            // says why (ui-nav-row.js:503-506).
            //
            // The guard is a media FEATURE, so it is asserted the only way computed style
            // can see it: the SAME markup and the SAME pointer coordinates on two
            // devices. Part 8 §2 holds — computed style, never source text.
            const settle = async (p) => {
                const b = await p.box(ROW('s2'));
                await p.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await p.settle(1);
                return b;
            };

            // A device that hovers: the face lights, so the negative below is not vacuous.
            const rest = await page.prop(ROW('s2'), 'background-color');
            await settle(page);
            assert.notEqual(await page.prop(ROW('s2'), 'background-color'), rest,
                'the hover face must exist for this assertion to mean anything');

            // The panel this skin ships on. Slate leaves the last row tapped lit here.
            await mountedOn(touchPanel, async (touch) => {
                assert.equal(await touch.eval('matchMedia("(hover: hover)").matches'), false,
                    'the second browser must really be a device that cannot hover');
                const b = await settle(touch);
                assert.equal(await touch.prop(ROW('s2'), 'background-color'),
                    'rgba(0, 0, 0, 0)',
                    'a touch panel lit the hover face — the last row tapped stays lit');
                assert.equal(await touch.prop(ROW('s2'), 'color'),
                    await touch.prop(ROW('s0'), 'color'),
                    'and the hover ink came with it');

                // :active is DELIBERATELY outside the guard — a press has a real end, so
                // the press face is the one face a touch user should ever see.
                await touch.mouse('mousePressed', b.left + b.width / 2, b.top + b.height / 2,
                    { clickCount: 1 });
                await touch.settle(1);
                const pressed = await touch.prop(ROW('s2'), 'background-color');
                await touch.mouse('mouseReleased', b.left + b.width / 2, b.top + b.height / 2,
                    { clickCount: 1 });
                assert.equal(pressed,
                    await touch.resolveValue('var(--ui-key-on)', 'background-color'),
                    'the press face must survive the guard');
            });
        }));

        test('drill: --ui-opacity-disabled is the one dim dial, applied ONCE', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled', value: '0.5',
                selector: HOST('off'), property: 'opacity',
            });
            // The base paints both spellings — :host(:is([disabled],…)) and
            // :where([disabled],…) inside the tree. The control DOES carry the
            // attribute (it is a real disabled button, so the press is refused rather
            // than looking refused), so .38 compounds to .38 × .38 = .14 unless the
            // component says otherwise. MEASURED at 0.38 on the control before
            // .row:where(:disabled) { opacity: 1 } existed — this assertion is the
            // reason that rule is in the file.
            const inner = await page.prop(ROW('off'), 'opacity');
            assert.equal(
                inner, '1',
                `double-dim: the control inside a disabled ui-subnav-row computes opacity ${inner}.`,
            );
            // And the row really is dimmed once, by the dial, on the host.
            assert.equal(await page.prop(HOST('off'), 'opacity'), '0.38');
        }));

        /* == 2. THE DIAL DRILL — wave 2's headline obligation ================ */

        test('one selection treatment: face, ink, LED and glow are the four dials', () => mounted(async (page) => {
            // spec §3.9 + CONVENTIONS §4. Every dial is proved by MOVING it, because
            // reading a 0px LED off a 0px token proves nothing — which is precisely
            // how Slate shipped a 4px LED under a dial that said 0 (T5).
            await assertOneSelectionTreatment(page, {
                selected: ROW('s1'),
                unselected: ROW('s0'),
            });
        }));

        test('the dials reach the row through the shadow boundary and nothing else does', () => mounted(async (page) => {
            // A6 / Part 4 ground rule 1: theming crosses the boundary through custom
            // properties ONLY. Retarget the two colour dials on :root and the selected
            // row moves; the unselected rows do not.
            const before = await page.computed(ROW('s0'), ['background-color', 'color']);
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            const movedSel = await page.computed(ROW('s1'), ['background-color', 'color']);
            const movedOther = await page.computed(ROW('s0'), ['background-color', 'color']);
            await page.setToken('--ui-selected-face', null);
            await page.setToken('--ui-selected-ink', null);

            assert.equal(movedSel['background-color'], DRILL_COLOUR);
            assert.equal(movedSel.color, DRILL_COLOUR);
            assert.deepEqual(movedOther, before, 'the dials reached an unselected row');
        }));

        test('selection moves the DIALS and nothing else — no sixth treatment', () => mounted(async (page) => {
            /* Parity surface 2 REVERSED what was departure 3, and the citation is the
             * reason:
             *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=30]
             *        font-weight = 500 ← slate-components.css `.slate-nav-selected`
             *        authored `var(--slate-weight-medium)` !important=yes (token-driven)
             *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=32]
             *        font-weight = 400 (resting)
             * Slate renders that 500 on all 76 selected nav rows and all 47 selected
             * sub-nav rows in the corpus, with no exception — and it renders it from a
             * RULE, which is exactly what a fork of the dials cannot retarget. So the
             * weight became the FIFTH DIAL rather than staying refused: this component
             * still writes no weight rule of its own, and the 500 arrives through
             * --ui-selected-weight from base.js's shared fragment. font-weight
             * therefore leaves the compared surface below and is asserted against the
             * dial instead. */
            const SURFACE = [
                'background-image', 'border-top-left-radius',
                'border-top-width', 'font-family', 'font-size',
                'gap', 'height', 'letter-spacing', 'min-height', 'opacity',
                'padding-left', 'text-transform', 'width',
            ];
            const current = await page.computed(ROW('s1'), SURFACE);
            const ordinary = await page.computed(ROW('s0'), SURFACE);
            assert.deepEqual(
                current, ordinary,
                'a property outside the five dials moved with the selected state. That is a '
                + 'private selected look, which is the defect that started the audit.',
            );
            const weights = await page.computed(ROW('s1'), ['font-weight']);
            const restingWeights = await page.computed(ROW('s0'), ['font-weight']);
            assert.equal(weights['font-weight'], '500', 'CITE [i=30] the current row is Slate\'s 500');
            assert.equal(restingWeights['font-weight'], ORACLE.fontWeight, 'CITE [i=32] resting is 400');
            assert.equal(weights['font-weight'],
                await page.resolveToken('--ui-selected-weight', 'font-weight'),
                'the 500 is READ from the dial, not written in this component');

            /* border-top-color is the corpus's eighteenth property and it is
             * deliberately NOT in the list above: nothing declares a border colour
             * here, so it is `currentColor`, so it follows the INK dial by
             * definition. It paints nothing at all — the width is 0 in both states,
             * asserted here so "it only follows the dial" cannot quietly become "it
             * draws a selected edge". */
            const edges = await page.computed(ROW('s1'), ['border-top-color', 'color', 'border-top-width']);
            assert.equal(edges['border-top-color'], edges.color, 'the border ink is currentColor, not a rule');
            assert.equal(edges['border-top-width'], '0px', 'and it draws nothing');
        }));

        /* == 3. FOCUS — one ring, unclipped, both offsets ==================== */

        test('the focus ring is the base ring, and it is INSET by default (DEPARTURE 7)', () => mounted(async (page) => {
            // The default spelling is the one that has to be right: a plain
            // <ui-subnav-row>, written by a consumer who has never read L24.
            await assertFocusUnclipped(page, ROW('s0'));
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(await page.prop(ROW('s0'), 'outline-offset'), inset,
                'a bare row must ring inset — the column it is specified to live in scrolls');
            assert.equal(await page.evalFn(() => document.getElementById('s0').getAttribute('focus-ring')),
                'inset', 'the REAL attribute is set, so focusVariant stays honest');
        }));

        test('DEPARTURE 7: a default row keeps its whole ring inside a SCROLLING column (L24)', () => mounted(async (page) => {
            // Bug L24's class, quoted: "focus rings clipped on all four sides by the
            // components they sit inside". The settings sub-category column scrolls —
            // spec §4.4's skeleton is "<subnav-column>  list (1fr, overflow-y:auto,
            // VISIBLE scrollbar)" and LAYOUT_SPEC_DRAFT.md:724-727 says it again, "The
            // nav columns scroll with a visible scrollbar" — so #clipper is that column,
            // not a decorative box: four 88px rows in a 200px overflow-y:auto grid.
            //
            // MEASURED before the default existed: outline-offset 2px, outline-width 3px,
            // ring left edge at -5 against a column left edge of 0 — clipped on the
            // INLINE axis for every row, not merely top and bottom for the ends. Every
            // row is checked for that reason.
            const scrolls = await page.metrics('#clipper');
            assert.ok(scrolls.scrollHeight > scrolls.clientHeight + 0.5,
                'the fixture column must really scroll, or this assertion is vacuous');
            for (const id of ['d0', 'd1', 'd2', 'd3']) {
                const g = await assertFocusUnclipped(page, ROW(id));
                assert.ok(g.clippers.length >= 1,
                    `#${id}: the column must really clip, or this assertion is vacuous`);
            }
        }));

        test('a consumer can still ask for the outset ring, and gets exactly one', () => mounted(async (page) => {
            // connectedCallback fills the attribute in only when it is ABSENT, so the
            // opt-out survives — the same contract as #24 (ui-nav-row.js:548-551).
            const g = await assertFocusUnclipped(page, ROW('outset'));
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.equal(g.outlineOffset, outset, 'focus-ring="outset" was overwritten');
            assert.notEqual(g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'the two offsets must really be two values');
            assert.equal(
                await page.evalFn(() => document.getElementById('outset').focusVariant),
                'outset', 'focusVariant reports the truth because the attribute is real');
        }));

        test('DEPARTURE 7: the inset default reaches a row built in script, too', () => mounted(async (page) => {
            // The attribute is set in connectedCallback and never in the constructor (a
            // custom element constructor must not gain attributes), so a row created with
            // createElement gets it on insertion like any other.
            const rings = await page.evalFn(async () => {
                const host = document.getElementById('stack');
                const made = [];
                for (const label of ['A', 'B']) {
                    const el = document.createElement('ui-subnav-row');
                    el.textContent = label;
                    host.appendChild(el);
                    made.push(el);
                }
                const opted = document.createElement('ui-subnav-row');
                opted.setAttribute('focus-ring', 'outset');
                host.appendChild(opted);
                await Promise.all([...made, opted].map((el) => el.updateComplete));
                return [...made, opted].map((el) => el.getAttribute('focus-ring'));
            });
            assert.deepEqual(rings, ['inset', 'inset', 'outset'],
                'every row rings the same way unless the consumer said otherwise');
        }));

        test('the row itself clips nothing — only the label does', () => mounted(async (page) => {
            // The component never sets overflow on the control, which is why the ring
            // above can be outset at all. If this changes, L24 comes back from inside.
            const row = await page.computed(ROW('s0'), ['overflow-x', 'overflow-y']);
            assert.deepEqual(row, { 'overflow-x': 'visible', 'overflow-y': 'visible' });
            const label = await page.prop(LABEL('s0'), 'overflow-x');
            assert.equal(label, 'hidden');
        }));

        /* == 4. THE CONTAINER FLOOR ========================================= */

        test('a narrow container clips the label and never the row height', () => mounted(async (page) => {
            // The oracle is disqualified for responsive behaviour (Slate is frozen at
            // 1920×1200), so spec §2.2 governs: "Control heights, touch targets,
            // hairlines | Fixed token. Never fluid." A row that shrank with its column
            // would be a row whose column has no pitch — T2's family.
            const h = await navRow(page);
            const box = await page.box(HOST('cramped'));
            assert.equal(Math.round(box.height), Math.round(h), 'the row shrank with its container');
            assert.equal(Math.round(box.width), 180, 'the row fills the narrow column');

            const label = await page.metrics(LABEL('cramped'));
            assert.ok(
                label.scrollWidth > label.clientWidth,
                'the long label was not clipped — it either wrapped (which would break the '
                + 'pitch) or the container query the spec gives to the COLUMN got written here',
            );
            assert.equal(await page.prop(LABEL('cramped'), 'text-overflow'), 'ellipsis');
        }));

        test('the row does not overflow its own container', () => mounted(async (page) => {
            const m = await page.metrics('#narrow');
            assert.ok(
                m.scrollWidth <= m.clientWidth + 0.5,
                `a 180px column scrolls horizontally: scrollWidth ${m.scrollWidth} against `
                + `clientWidth ${m.clientWidth}`,
            );
        }));

        test('no component-level width query exists to be wrong', () => mounted(async (page) => {
            // Every dimension in this component is a fixed ergonomic token, so the row
            // renders identically at both Gate A geometries except for the density band
            // — which is a :root height query in styles/tokens.css, not a rule here.
            const wide = await page.computed(ROW('s0'), ['padding-left', 'font-size']);
            const narrow = await page.computed(ROW('cramped'), ['padding-left', 'font-size']);
            assert.deepEqual(narrow, wide, 'the row changed shape with its container');
        }));

        /* == 5. THE BUGS, MADE INEXPRESSIBLE ================================ */

        test('T2(a): the pitch IS the row — no margin, in a plain stack', () => mounted(async (page) => {
            /* T2: "Measured pitch 89 vs 93, 24px out by row 7" — 89px rows carrying 4px
             * of Tailwind margin the shell rule could not reach, because
             * `#sub-categories-panel > * + *` has one <ul> to match and nothing after
             * it (settings.js:6426). Here the outer box IS the pitch. */
            const h = await navRow(page);
            const boxes = await Promise.all(['p0', 'p1', 'p2'].map((id) => page.box(HOST(id))));
            for (let i = 1; i < boxes.length; i++) {
                const pitch = boxes[i].top - boxes[i - 1].top;
                assert.equal(
                    Math.round(pitch), Math.round(h),
                    `row ${i} sits on a ${pitch}px pitch against a ${h}px row. Slate's numbers `
                    + `were ${ORACLE.bug.height} and ${ORACLE.bug.pitch}; the difference was margin.`,
                );
            }
        }));

        test('T2(a): seven rows of two columns stay aligned to the pixel at row 7', () => mounted(async (page) => {
            /* The bug as its own assertion: "The sub-category column does not align with
             * the category column … 24px out by row 7". Both columns take the same
             * token and neither holds a number, so the drift has nowhere to come from. */
            const cat = await Promise.all(LABELS.map((_, i) => page.box(`#c${i}`)));
            const sub = await Promise.all(LABELS.map((_, i) => page.box(HOST(`s${i}`))));
            for (let i = 0; i < N; i++) {
                assert.equal(
                    Math.round(sub[i].top - cat[i].top), 0,
                    `row ${i + 1} of the sub-category column is ${sub[i].top - cat[i].top}px off the `
                    + 'category column. T2 measured 24px by row 7.',
                );
                assert.equal(Math.round(sub[i].height), Math.round(cat[i].height));
            }
            assert.equal(Math.round(sub[N - 1].top - cat[N - 1].top), 0, 'row 7, the one T2 names');
        }));

        test('T2(a): the pitch survives a retarget of the token, on both columns at once', () => mounted(async (page) => {
            await page.setToken('--ui-nav-row', '120px');
            const cat = await page.box(`#c${N - 1}`);
            const sub = await page.box(HOST(`s${N - 1}`));
            await page.setToken('--ui-nav-row', null);
            assert.equal(Math.round(sub.top - cat.top), 0, 'the two columns drifted apart under a retarget');
            assert.equal(Math.round(sub.height), 120);
        }));

        test('T2(b): N rows give N-1 separators, and the row draws none of them', () => mounted(async (page) => {
            /* T2's second half: "the same mistake means the sub-nav has no row
             * separators at all (measured box-shadow: none)".
             *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34]
             *        box-shadow = none ← (no declaration — inherited or initial value)
             *        (FROZEN/hardcoded)
             * CONVENTIONS §13: "a gap needs no sibling selector, so N cells give N-1
             * seams". The count is structural — there is no selector to fail to match. */
            const s = await seam(page);
            assert.ok(s > 0, `--ui-seam resolved to ${s}px`);

            const boxes = await Promise.all(LABELS.map((_, i) => page.box(HOST(`s${i}`))));
            let gaps = 0;
            for (let i = 1; i < boxes.length; i++) {
                const gap = boxes[i].top - boxes[i - 1].bottom;
                assert.equal(
                    Math.round(gap * 10) / 10, s,
                    `the seam between rows ${i} and ${i + 1} is ${gap}px, not --ui-seam (${s}px)`,
                );
                gaps++;
            }
            assert.equal(gaps, N - 1, 'N cells did not give N-1 seams');

            // And the anti-pattern is absent rather than unused: a divider is a gap,
            // never a per-cell border (CONVENTIONS §13, checklist).
            const edges = await page.computed(ROW('s0'), [
                'border-top-width', 'border-right-width', 'border-bottom-width',
                'border-left-width', 'box-shadow',
            ]);
            assert.deepEqual(edges, {
                'border-top-width': '0px',
                'border-right-width': '0px',
                'border-bottom-width': '0px',
                'border-left-width': '0px',
                'box-shadow': 'none',
            });
        }));

        test('T3: the corner is square, and no document rule of any weight can round it', () => mounted(async (page) => {
            /* T3: "Nav rows are rounded despite `border-radius: 0` in two places — an
             * attribute-selector rule later in the same file wins. Measured 6px."
             *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34]
             *        border-top-left-radius = 6px ← slate-shell.css
             *        `#subpage-host [class*="rounded-[67.5px]"], … [class*="rounded-full"]
             *        :not(.slate-keep-round):not([class*="si` (NOT CAPTURED — shorthand)
             *        !important=yes (token-driven)
             * The fix is not a bigger selector. It is that the declaration lives inside
             * a shadow root, where the document cannot reach it at all. */
            const corners = [
                'border-top-left-radius', 'border-top-right-radius',
                'border-bottom-right-radius', 'border-bottom-left-radius',
            ];
            const before = await page.computed(ROW('s0'), corners);
            assert.deepEqual(before, Object.fromEntries(corners.map((c) => [c, '0px'])),
                `the row rendered a radius. Slate measured ${ORACLE.bug.radius} against an authored 0.`);

            await page.evalFn((cssText) => {
                const s = document.createElement('style');
                s.id = 'reach-in';
                s.textContent = cssText;
                document.head.appendChild(s);
                return true;
            }, 'ui-subnav-row, ui-subnav-row *, [class*="row"], [id="row"], .row '
             + '{ border-radius: 6px !important; }');
            await page.settle(1);
            const after = await page.computed(ROW('s0'), corners);
            await page.evalFn(() => (document.getElementById('reach-in')?.remove(), true));

            assert.deepEqual(
                after, before,
                'a document rule reached inside the shadow root and rounded the row — which is '
                + 'T3 exactly, and everything this architecture rests on is that it cannot.',
            );
        }));

        test('T5: the selected row draws NO LED, and the only thing that can is the dial', () => mounted(async (page) => {
            /* T5: "The selected nav row still draws a 4px LED it is explicitly not
             * supposed to … The fork dial --slate-selected-led is bypassed entirely."
             *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=30]
             *        box-shadow = rgba(0, 0, 0, 0) 0px -4px 0px 0px inset,
             *        color(srgb 0.690196 0.768627 0.807843 / 0.72) 0px -4px 0px 0px inset
             *        ← slate-components.css `.slate-nav-selected` … !important=yes */
            const resting = await page.prop(ROW('s0'), 'box-shadow');
            assert.equal(resting, 'none', 'the component declares a shadow of its own');

            const selected = await page.prop(ROW('s1'), 'box-shadow');
            const dial = shadowSegments(selected).at(-1) ?? '';
            const lengths = (dial.match(/-?\d+(\.\d+)?px/g) ?? []).map(parseFloat);
            assert.ok(lengths.length > 0, `no LED segment to measure in ${selected}`);
            assert.deepEqual(
                lengths.map(Math.abs).filter((n) => n !== 0), [],
                `the selected row draws a ${dial} strip with --ui-selected-led at its Slate `
                + `default of 0px. Slate drew ${ORACLE.bug.led} here without being asked.`,
            );

            // And the 4px strip is expressible — through the dial, which is the whole
            // point: Radian turns it on by changing one value, touching no rule.
            await page.setToken('--ui-selected-led', '4px');
            const lit = shadowSegments(await page.prop(ROW('s1'), 'box-shadow')).at(-1) ?? '';
            await page.setToken('--ui-selected-led', null);
            assert.match(
                lit, /-4px/,
                `with the dial at 4px the LED segment was ${lit}; Slate's accidental strip was `
                + 'exactly this shape, drawn by a sheet that never consulted the dial.',
            );
        }));

        /* == 6. THE ARIA CONTRACT AND THE HIT FLOOR ========================= */

        test('aria: selection is the aria state, and one property renders both', () => mounted(async (page) => {
            // spec Appendix 15: "The aria-*-driven state selectors … the right contract
            // for a Lit component's reflected properties." Accessibility state and
            // visual state are the same state, so they cannot drift.
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s1')), 'true');
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s0')), null,
                'an ordinary row must carry no aria-current at all, not aria-current="false"');
            assert.equal(await page.evalFn((s) => window.__h.need(s).hasAttribute('current'), HOST('s1')), true,
                'the property reflects to the host, so a consumer can see the state it set');

            // Flip it and watch both halves move together.
            await page.evalFn((s) => { window.__h.need(s).current = true; return true; }, HOST('s0'));
            await page.settle(2);
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s0')), 'true');
            assert.equal(await page.prop(ROW('s0'), 'background-color'), face);
        }));

        test('aria: it is a real button — keyboard-activated, focus moves with the press', () => mounted(async (page) => {
            // T15 records what the settings screen does today: "navigation driven by
            // synthetic .click() so focus never moves". A button is the fix.
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).tagName.toLowerCase(), ROW('s0')),
                'button',
            );
            await page.recordEvents(HOST('s0'), ['navigate']);
            await page.focusVisible(ROW('s0'));
            await page.press('Enter');
            await page.press(' ');
            const events = await page.recordedEvents();
            assert.equal(events.length, 2, 'Enter and Space must each activate the row');
            assert.deepEqual(events[0].detail, { value: 'v0' }, 'the event carries the row value');
        }));

        test('a press emits navigate and does NOT make the row current', () => mounted(async (page) => {
            // Size small: "no internal model". Which row is current is the router's
            // fact, and a row that decides for itself is a row that disagrees with the
            // screen the moment navigation fails.
            await page.recordEvents(HOST('s3'), ['navigate']);
            await page.click(ROW('s3'));
            const events = await page.recordedEvents();
            assert.equal(events.length, 1);
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).current, HOST('s3')), false,
                'the row set its own current state',
            );
            assert.equal(
                await page.evalFn((s) => window.__h.need(s).getAttribute('aria-current'), ROW('s3')), null,
            );
        }));

        test('a disabled row emits nothing and is out of the tab order', () => mounted(async (page) => {
            await page.recordEvents(HOST('off'), ['navigate']);
            await page.click(ROW('off'));
            assert.deepEqual(await page.recordedEvents(), []);
            assert.equal(await page.evalFn((s) => window.__h.need(s).disabled, ROW('off')), true);
        }));

        test('[hidden] really hides, with no !important anywhere', () => mounted(async (page) => {
            // slate-components.css:230-239: "A component sets `display`, which outranks
            // the [hidden] attribute — so hiding one by script silently did nothing."
            // Here :host([hidden]) is (0,2,0) and the base's :host is (0,1,0).
            assert.equal(await page.prop(HOST('gone'), 'display'), 'none');
        }));

        test('hit floor: the row box clears --ui-hit-min on both axes', () => mounted(async (page) => {
            // spec §2.3 case 2 / Appendix 5. The row is far taller than the floor, so
            // it needs no hit-area utility — but P4 is "a floor the comment claims and
            // the box does not have", so the box is measured rather than reasoned about.
            await assertHitFloor(page, ROW('s0'), { mode: 'pad' });
        }));

        /* == 7. ORACLE PARITY, both themes ================================== */

        for (const theme of ['dark', 'light']) {
            test(`oracle parity in ${theme}: resting ink, cell ground, and both selected colours`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const o = ORACLE[theme];

                assert.equal(await page.prop(ROW('s0'), 'color'), o.ink, 'resting ink is --ui-muted');
                assert.equal(await page.prop(HOST('s0'), 'background-color'), o.ground,
                    'the cell ground is the colour Slate painted on the panel behind the row');
                assert.equal(await page.prop(ROW('s0'), 'background-color'), 'rgba(0, 0, 0, 0)',
                    'the control itself is transparent, exactly as Slate authored it');

                assert.equal(await page.prop(ROW('s1'), 'background-color'), o.selectedFace);
                assert.equal(await page.prop(ROW('s1'), 'color'), o.selectedInk);
            }));

            test(`hover parity in ${theme}: --ui-key face, --ui-text ink, and not on the current row`, () => mounted(async (page) => {
                await page.setTheme(theme);
                const o = ORACLE[theme];

                const b = await page.box(ROW('s2'));
                await page.mouse('mouseMoved', b.left + b.width / 2, b.top + b.height / 2);
                await page.settle(1);
                const hovered = await page.computed(ROW('s2'), ['background-color', 'color']);
                assert.equal(hovered['background-color'], o.hoverFace);
                assert.equal(hovered.color, o.hoverInk);

                // The touch-panel bug Slate needed six selectors and !important for:
                // "on a touch panel the last row tapped keeps :hover, so the current
                // page would lose its fill the moment you chose it". Here the hover
                // rule is written .row:where(:hover) — same (0,1,0) as the fragment,
                // losing on source order.
                const s = await page.box(ROW('s1'));
                await page.mouse('mouseMoved', s.left + s.width / 2, s.top + s.height / 2);
                await page.settle(1);
                const stuck = await page.computed(ROW('s1'), ['background-color', 'color']);
                assert.equal(stuck['background-color'], o.selectedFace, 'hover repainted the current row');
                assert.equal(stuck.color, o.selectedInk);
            }));
        }

        test('oracle parity: the theme-invariant values', () => mounted(async (page) => {
            const got = await page.computed(ROW('s0'), [
                'font-size', 'font-weight', 'padding-left', 'padding-right', 'column-gap',
                'letter-spacing', 'text-transform', 'opacity', 'box-shadow', 'text-align',
            ]);
            assert.equal(got['font-size'], ORACLE.fontSize);
            assert.equal(got['font-weight'], ORACLE.fontWeight);
            assert.equal(got['padding-left'], ORACLE.paddingLeft);
            assert.equal(got['padding-right'], ORACLE.paddingLeft, 'the padding is symmetric, as the shorthand wrote it');
            assert.equal(got['column-gap'], ORACLE.gap);
            assert.equal(got['letter-spacing'], 'normal');
            assert.equal(got['text-transform'], 'none');
            assert.equal(got.opacity, '1');
            assert.equal(got['box-shadow'], 'none');
            assert.equal(got['text-align'], 'start', 'a nav row is read left to right; the UA centres button text');
        }));

        test('DEPARTURE 1: the pitch is the token, not Slate\'s 89', () => mounted(async (page) => {
            const h = await navRow(page);
            const box = await page.box(ROW('s0'));
            assert.equal(Math.round(box.height), Math.round(h));
            assert.notEqual(
                Math.round(box.height), ORACLE.bug.height,
                'the row reproduced Slate\'s 89px, which T18 records as a derivation "wrong on '
                + 'both halves" and spec §3.2 resolves to calc(--ui-control-h + 2 × --ui-space-3)',
            );

            acrossGeometries[geometry.name] = {
                navRow: h,
                rowHeight: Math.round(box.height),
                fontSize: await page.prop(ROW('s0'), 'font-size'),
                paddingLeft: await page.prop(ROW('s0'), 'padding-left'),
                density: await page.tokenValue('--ui-density'),
            };
        }));
    });
}

/* ===========================================================================
 * ACROSS THE TWO GEOMETRIES
 * =========================================================================== */

describe('ui-subnav-row across both Gate A geometries', () => {
    test('the paint is identical and only the density band moves the pitch', () => {
        const bench = acrossGeometries.bench;
        const floor = acrossGeometries.floor;
        assert.ok(bench && floor, `both geometry blocks must have run: ${Object.keys(acrossGeometries)}`);

        assert.equal(bench.fontSize, floor.fontSize, 'type size is a fixed token, not a fluid one');
        assert.equal(bench.paddingLeft, floor.paddingLeft);

        // styles/tokens.css:220 × :928. 88 × 0.875 = 77. The band is a :root height
        // query in the token sheet — the component holds no density arithmetic at all
        // (CONVENTIONS §11), which is why this is the only number that moves.
        assert.equal(bench.rowHeight, 88, 'the bench pitch is spec §3.2\'s 88');
        assert.equal(floor.rowHeight, 77, 'the 1000x600 floor is below 700px of height: 88 x 0.875');
        assert.equal(bench.rowHeight, bench.navRow);
        assert.equal(floor.rowHeight, floor.navRow);
        assert.equal(bench.density.trim(), '1');
        assert.equal(floor.density.trim(), '0.875');
    });
});
