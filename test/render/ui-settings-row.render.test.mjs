/**
 * ui-settings-row.render.test.mjs — Gate A for component #29 (wave 4, item #29).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry, the accessibility
 * tree and behaviour, never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. TOKEN DRILL — sixteen tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token;
 *   2. THE DIAL DRILL, IN ITS NEGATIVE FORM. A settings row has no selection state, so
 *      the obligation flips: retargeting all four dials must move NOTHING. That is the
 *      wave law read literally ("no component in this wave may own a private selected
 *      look", Part 10 §12 / spec §3.9) for a component that does not choose;
 *   3. FOCUS UNCLIPPED — a slotted control inside the spec's own leaf-pane skeleton
 *      (§4.4: overflow-y:auto, padding var(--ui-space-6)), which is a real clipper;
 *   4. CONTAINER FLOOR — the row fills its container and reads no viewport; the control
 *      holds its stated size and the row WRAPS rather than crushing it (T9/T10's class);
 *      the 64px floor and the 48px hit floor both hold at 380px;
 *   5. THE BUG, ASSERTED INEXPRESSIBLE — T13, in the three legs the component header
 *      sets out: an imposter wearing Slate's exact class shape gets no padding, the same
 *      classes on the host change nothing, and the spread of heading offsets across four
 *      construction routes is ZERO;
 *   6. ARIA — the accessible-name bridge, measured in the engine's own AX tree, with the
 *      author's name winning, the opt-out honoured, and a role-less generic never named
 *      (bug T15's second clause).
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every literal
 * carries its CITE line; the component header carries the full set with its winning rules.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-settings-row.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

/* The row plus the five control archetypes it exists to hold — #4 stepper, #5 switch,
 * #3 segmented bank, #7 select, #1 button (SCOPE L1641 "depends on #4, #5, #3, #7, #1").
 * The component imports none of them: it slots them, which is why every one has to be
 * loaded here by the mount contract rather than arriving through the module graph. */
const MODULE = [
    '/src/components/ui-settings-row.js',
    '/src/components/ui-switch.js',
    '/src/components/ui-button.js',
    '/src/components/ui-stepper.js',
    '/src/components/ui-select.js',
    '/src/components/ui-bank.js',
];

/**
 * #pane is spec §4.4's own leaf-pane skeleton, verbatim:
 *     "<leaf-pane>  overflow-y:auto; padding: var(--ui-space-6)"
 * so the focus assertions below are not vacuous — it really clips — and the ring really
 * has the room the spec says it has. #leaf is the measure inside it. The seamed column
 * is CONVENTIONS §13: a settings leaf is rows over a 1px gap, which is what replaces
 * Slate's 43 identical <hr class="border-t slate-hairline w-full" />.
 */
const STAGE_CSS = `
<style>
    #pane {
        block-size: 320px;
        overflow-y: auto;
        padding: var(--ui-space-6);
    }
    #leaf, #narrow, #wide, #tight {
        display: grid;
        gap: var(--ui-seam);
        background: var(--ui-line);
    }
    #narrow { inline-size: 380px; }
    #wide   { inline-size: 820px; }
    /* The clipper. §2.4's own inherited behaviour — "hidden is the default answer
     * everywhere except the numpad" — reproduced so that a row that spills really does
     * lose the text, rather than growing a scrollbar the test could not see either. */
    #tight  { inline-size: 300px; overflow: hidden; }
</style>`;

/* IMPOSTER is settings.js:2390-2396 read read-only and reproduced byte-for-byte in its
 * class strings — the Brightness leaf's PAGE TITLE wrapped in the row primitive's class
 * shape. In Slate this element takes 12px of padding-block from slate-shell.css:1295 and
 * the title lands at y=193 against every other leaf's 181. Here it is a plain div. */
const IMPOSTER = `
<div id="imposter" class="content-stretch flex items-center justify-between relative w-full">
    <div class="w-full">
        <p id="imposter-title" class="slate-title">Screen Brightness</p>
    </div>

</div>`;

const MARKUP = `${STAGE_CSS}
<div id="pane">
    <div id="leaf">
        ${IMPOSTER}
        <ui-settings-row id="plain" heading="Enable cup warmer"
                         caption="Warm your cups on the top plate">
            <ui-switch id="sw" checked></ui-switch>
        </ui-settings-row>
        <ui-settings-row id="hinted" heading="Target temperature" hint="30-80 °C">
            <ui-stepper id="step" value="70"></ui-stepper>
        </ui-settings-row>
        <ui-settings-row id="read" heading="Current temperature"
                         caption="Live temperature of the cup-warming plate"
                         reading="38.5°C"></ui-settings-row>
        <ui-settings-row id="shaped" class="content-stretch flex items-center justify-between relative w-full"
                         heading="Enable cup warmer"
                         caption="Warm your cups on the top plate">
            <ui-switch id="sw2"></ui-switch>
        </ui-settings-row>
        <ui-settings-row id="bare" heading="App Version"></ui-settings-row>
        <ui-settings-row id="named" heading="Charging mode">
            <ui-button id="btn" label="Open the charger log">Open</ui-button>
        </ui-settings-row>
        <ui-settings-row id="texted" heading="Descale the machine">
            <ui-button id="btn2">Start</ui-button>
        </ui-settings-row>
        <ui-settings-row id="optout" heading="Web UI path" no-auto-label>
            <ui-switch id="sw3"></ui-switch>
        </ui-settings-row>
        <ui-settings-row id="generic" heading="Charging status">
            <div id="wrapper"><span>Battery 84%</span></div>
        </ui-settings-row>
        <!-- RULE 0's real boundary. A native <select> ALWAYS has textContent (its
             options) and a <textarea> with content always has textContent, and neither
             role — combobox, textbox — takes its name from contents. A textContent test
             skips both and ships them anonymous; a role test names them. These are the
             two native controls rule 2 itself lists. -->
        <ui-settings-row id="native-select" heading="Measurement units">
            <select id="nsel"><option>Celsius</option><option>Fahrenheit</option></select>
        </ui-settings-row>
        <ui-settings-row id="native-area" heading="Descaling notes">
            <textarea id="narea">Ran a descale on the 3rd.</textarea>
        </ui-settings-row>
        <!-- And the same over-fire from the other side: a glyph in a NAMED slot is part
             of the control, not the control's name. -->
        <ui-settings-row id="slotted-stepper" heading="Shot volume">
            <ui-stepper id="step3" value="36"
            ><span slot="decrement">&#8722;</span><span slot="increment">&#43;</span></ui-stepper>
        </ui-settings-row>
        <ui-settings-row id="slotted-bank" heading="Water source">
            <ui-bank id="bank2" value="Tank" items='["Tank","Plumbed"]'
            ><span slot="item-Tank">Tank</span></ui-bank>
        </ui-settings-row>
    </div>
</div>
<div id="tight">
    <!-- The reviewer's probe, as a fixture. A multi-clause range hint and a heading with
         no break opportunity in it — the two shapes #squeezed's "5-95 °C" and its
         all-breakable heading never produce. -->
    <ui-settings-row id="longhint" heading="Target temperature"
                     hint="30-80 °C (Celsius), 86-176 °F (Fahrenheit)"></ui-settings-row>
    <ui-settings-row id="longword" heading="Thermoblockrecalibrationprocedure"
                     hint="Steuerungstemperaturbereichsbegrenzungswert"></ui-settings-row>
</div>
<div id="narrow">
    <ui-settings-row id="squeezed" heading="Temperature for flush cycles" hint="5-95 °C"
                     caption="Applies to every flush the machine runs on its own">
        <ui-stepper id="step2" value="80"></ui-stepper>
    </ui-settings-row>
</div>
<div id="wide">
    <ui-settings-row id="open" heading="Measurement units">
        <ui-select id="sel" label="Measurement units"
                   options='["Metric","Imperial"]'></ui-select>
    </ui-settings-row>
    <ui-settings-row id="banked" heading="On disconnect">
        <ui-bank id="bank" value="Disconnect"
                 items='["Nothing","Display Off","Disconnect"]'></ui-bank>
    </ui-settings-row>
</div>
<div id="routes"></div>`;

/**
 * Every measured value in the component header, in one place, so a drift shows up as one
 * failing assertion with its citation attached rather than as a mystery. The reference
 * state is `settings-accessories-cup-warmer` — the one leaf of the 49 carrying all four
 * label-block parts at once.
 */
const ORACLE = {
    dark: {
        /* CITE settings-accessories-cup-warmer .slate-heading [i=39] color =
         *      rgb(244, 247, 248)  <- slate-components.css `.slate-heading` authored
         *      `var(--slate-text)`   [= --ui-text, tokens.css:847 #f4f7f8] */
        headingInk: 'rgb(244, 247, 248)',
        /* CITE settings-accessories-cup-warmer .slate-caption [i=40] color =
         *      rgb(148, 161, 169)  <- authored `var(--slate-muted)`
         *      [= --ui-muted, tokens.css:849 #94a1a9] */
        captionInk: 'rgb(148, 161, 169)',
        /* CITE settings-accessories-cup-warmer #cupWarmerCurrentTemp [i=54] color =
         *      rgb(244, 247, 248)  <- app.css `.text-\[var\(--text-primary\)\]`
         * RECORDED, NOT TARGETED — see DEPARTURE 7 below. The reading takes --ui-muted,
         * which is the CAPTION's ink, so the row's three secondary texts are one grey. */
        readingInk: 'rgb(148, 161, 169)',
        /* CITE settings-accessories-cup-warmer #right-panel [i=36] background-color =
         *      rgb(14, 19, 23)  <- slate-shell.css — the ground a settings leaf sits on,
         *      = --ui-fascia exactly (tokens.css:841 #0e1317) */
        ground: 'rgb(14, 19, 23)',
        /* The seam a leaf draws between rows: --ui-line. Never drawn by this component. */
        seam: 'rgb(58, 72, 82)',
    },
    light: {
        headingInk: 'rgb(23, 26, 28)',
        captionInk: 'rgb(90, 101, 108)',
        readingInk: 'rgb(90, 101, 108)',
        ground: 'rgb(242, 243, 243)',
        seam: 'rgb(203, 208, 211)',
    },
    /* Theme-independent, from the same records plus slate-shell.css:1293-1296. */
    rowMinHeight: '64px',       // SOURCE :1294 min-height: var(--slate-control-height)
    rowPaddingBlock: '12px',    // SOURCE :1295 padding-block: var(--slate-space-3) — T13's 12
    rowGap: '24px',             // SOURCE :1296 gap: var(--slate-space-5)
    headingSize: '20px',        // CITE .slate-heading [i=39] font-size <- var(--slate-text-lg)
    headingWeight: '500',       // CITE .slate-heading [i=39] font-weight <- var(--slate-weight-medium)
    headingLineBox: 26,         // CITE .slate-heading [i=39] rect h=26 = 20 × 1.3
    hintSize: '17px',           // CITE .text-[20px] [i=45] font-size <- var(--slate-text-base)
    hintWeight: '400',          // CITE .text-[20px] [i=45] font-weight <- authored 400
    hintLineBox: 25.5,          // 17 × 1.5, and the measured rect is h=26
    captionSize: '16px',        // CITE .slate-caption [i=40] font-size <- var(--slate-text-note)
    captionWeight: '400',       // CITE .slate-caption [i=40] font-weight
    captionLineBox: 24,         // CITE .slate-caption [i=40] rect h=24 = 16 × 1.5
    /* DEPARTURE 7 — THE LIVE READING IS AN ASIDE, AND SLATE GIVES ONE THING TWO LOOKS.
     *
     * What Slate does, both times:
     *   CITE settings-accessories-cup-warmer #cupWarmerCurrentTemp [i=54]
     *        font-size 18px <- var(--slate-text-md), font-weight 500, color --slate-text
     *   ...and on the Machine › Steam page the same kind of line — the live machine
     *   temperature beside the setting — is a quiet aside at 16 / 400 in the secondary
     *   ink. One kind of line, two treatments, inside one skin.
     *
     * This component followed the Cup Warmer one, and the type audit of 26 August 2026
     * caught what that costs: at 18 / 500 in the PRIMARY ink the reading competes with
     * the value in the stepper beside it, which is 27 / 300 in the same ink. A number
     * you cannot change must never out-weigh the number you can.
     *
     * So the reading takes .ui-body and --ui-muted — the HINT's own treatment. The range
     * beside the label is the same class of thing (context for the value, not the value)
     * and the audit calls Decal's secondary ink there "the better call: a range is not
     * a value". A live reading is not a value either. One rule for one kind of line.
     *
     * The Slate numbers are kept above as the record of what was measured. */
    readingSize: '17px',        // .ui-body, --ui-text-base — the hint's size
    readingWeight: '400',       // .ui-body — the hint's weight
    readingLineBox: 25.5,       // 17 × 1.5, the same line box the hint reports
    labelGap: '4px',            // measured: caption y=295 − (heading y=265 + h=26) = 4
    lineGap: '12px',            // DEPARTURE 4: settings.js:3632 gap-[14px] → --ui-space-3
    /* T13, as two numbers. CITE settings-display-brightness .slate-title rect y=193;
     * CITE settings-accessories-cup-warmer .slate-title rect y=181 (and 30 more states). */
    slateBrightnessTitleY: 193,
    slateOtherTitleY: 181,
    slateT13Delta: 12,          // = --slate-space-3 (slate-tokens.css:117)
};

/** The four dials, and the whole of the selection treatment anywhere in the skin. */
const DIALS = [
    '--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow',
];

/** Everything worth comparing when the dials are retargeted under a row. */
const PAINTED = [
    'background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight', 'font-size',
    'border-top-width', 'border-top-color', 'border-bottom-width', 'border-left-width',
    'padding-top', 'padding-bottom', 'padding-left', 'min-height', 'opacity', 'outline-style',
    'background-image', 'display', 'align-items', 'justify-content', 'gap', 'flex-wrap',
];

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-settings-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-settings-row must mount without throwing');
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

        /* -- 1. TOKEN DRILL: tokens are consumed, not copied ------------------ */

        test('drill: the row box reads --ui-control-h, --ui-space-3 and --ui-space-5',
            () => mounted(async (page) => {
                // SOURCE slate-shell.css:1293-1296 — the same three declarations, moved
                // from a class shape to a tag. A component holding its own copy of the
                // numbers would paint the same and NOT move when the token moves.
                await assertTokenDrill(page, {
                    token: '--ui-control-h',
                    value: '37px',
                    selector: '#open',
                    property: 'min-height',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#open',
                    property: 'padding-top',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#open',
                    property: 'padding-bottom',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-5',
                    value: '37px',
                    selector: '#open',
                    property: 'column-gap',
                });
            }));

        test('drill: --ui-fascia is the row ground', () => mounted(async (page) => {
            // Bug L12's class: a component with a private copy of the palette paints the
            // same colour and does not follow the token sheet.
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#plain',
                property: 'background-color',
            });
        }));

        test('drill: the label block reads --ui-space-1 and --ui-space-3',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-space-1',
                    value: '37px',
                    selector: '#plain >>> #label',
                    property: 'row-gap',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#hinted >>> #line',
                    property: 'column-gap',
                });
            }));

        test('drill: the heading reads --ui-text-lg, --ui-weight-medium and --ui-text',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-text-lg',
                    value: '37px',
                    selector: '#plain >>> #heading',
                    property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-medium',
                    value: '700',
                    selector: '#plain >>> #heading',
                    property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text',
                    value: DRILL_COLOUR,
                    selector: '#plain >>> #heading',
                    property: 'color',
                });
            }));

        test('drill: the hint reads --ui-text-base and --ui-muted', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base',
                value: '37px',
                selector: '#hinted >>> #hint',
                property: 'font-size',
            });
            // DEPARTURE 2: Slate paints this --slate-text under .opacity-60. Here it is
            // the named secondary ink, so it moves with the token and never with a
            // fourth opacity literal.
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#hinted >>> #hint',
                property: 'color',
            });
        }));

        test('drill: the caption reads --ui-text-note and --ui-muted', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note',
                value: '37px',
                selector: '#plain >>> #caption',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#plain >>> #caption',
                property: 'color',
            });
        }));

        test('drill: the live reading reads the BODY role and --ui-muted, like the hint',
            () => mounted(async (page) => {
                /* DEPARTURE 7 (see the ORACLE record). The reading used to declare its own
                 * 18 / 500 and was the only type this component stated; it now takes
                 * .ui-body and --ui-muted, which is exactly what the hint beside it takes.
                 * Drilling both proves it is the ROLE doing the work rather than two
                 * numbers that happen to agree today. */
                await assertTokenDrill(page, {
                    token: '--ui-text-base',
                    value: '37px',
                    selector: '#read >>> #reading',
                    property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-muted',
                    value: DRILL_COLOUR,
                    selector: '#read >>> #reading',
                    property: 'color',
                });

                /* AND IT IS THE SAME TREATMENT AS THE HINT, not merely a similar one. */
                const reading = await page.computed('#read >>> #reading',
                    ['font-size', 'font-weight', 'color']);
                const hint = await page.computed('#hinted >>> #hint',
                    ['font-size', 'font-weight', 'color']);
                assert.deepEqual(reading, hint,
                    'the two asides in this row are one treatment, so neither can drift');
            }));

        test('drill: the control track reads --ui-space-3 for a two-control row',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#plain >>> #control',
                    property: 'column-gap',
                });
            }));

        /* -- the measured starting values, both themes ------------------------ */

        test("the resting paint is the oracle's measured values, in both themes",
            () => mounted(async (page) => {
                for (const theme of ['dark', 'light']) {
                    await page.setTheme(theme);
                    const want = ORACLE[theme];

                    assert.equal(await page.prop('#plain', 'background-color'), want.ground,
                        `${theme}: --ui-fascia IS the ground a settings leaf sits on `
                        + '(CITE #right-panel [i=36])');
                    assert.equal(await page.prop('#plain >>> #heading', 'color'), want.headingInk,
                        `${theme}: CITE .slate-heading [i=39] color <- var(--slate-text)`);
                    assert.equal(await page.prop('#plain >>> #caption', 'color'), want.captionInk,
                        `${theme}: CITE .slate-caption [i=40] color <- var(--slate-muted)`);
                    assert.equal(await page.prop('#read >>> #reading', 'color'), want.readingInk,
                        `${theme}: DEPARTURE 7 — the reading is an aside, in --ui-muted`);

                    // DEPARTURE 2 stated as a value: the hint takes the CAPTION's ink, so
                    // the row's two secondary texts are one grey and not two.
                    assert.equal(await page.prop('#hinted >>> #hint', 'color'), want.captionInk,
                        `${theme}: DEPARTURE 2 — --ui-muted, not --ui-text at opacity 0.6`);
                    assert.equal(await page.prop('#hinted >>> #hint', 'opacity'), '1',
                        `${theme}: and no opacity literal survives (CITE .text-[20px] [i=45] `
                        + 'opacity = 0.6 <- app.css .opacity-60)');

                    // The seam ink is unchanged even though this component never draws it.
                    assert.equal(await page.resolveToken('--ui-line', 'color'), want.seam,
                        `${theme}: the divider's ink survives the move from 43 <hr> elements `
                        + 'to the container gap (CONVENTIONS §13)');
                }
            }));

        test('the theme-independent half of the record is carried exactly',
            () => mounted(async (page) => {
                const row = await page.computed('#open', [
                    'min-height', 'padding-top', 'padding-bottom', 'column-gap',
                    'border-top-width', 'border-bottom-width', 'box-shadow',
                ]);
                assert.equal(row['min-height'], ORACLE.rowMinHeight,
                    'SOURCE slate-shell.css:1294 min-height: var(--slate-control-height)');
                assert.equal(row['padding-top'], ORACLE.rowPaddingBlock,
                    'SOURCE slate-shell.css:1295 padding-block: var(--slate-space-3) — T13\'s 12px');
                assert.equal(row['padding-bottom'], ORACLE.rowPaddingBlock, 'symmetrical');
                assert.equal(row['column-gap'], ORACLE.rowGap,
                    'SOURCE slate-shell.css:1296 gap: var(--slate-space-5)');
                assert.equal(row['border-top-width'], '0px',
                    'the divider is the container gap, never a per-row border (CONVENTIONS §13)');
                assert.equal(row['border-bottom-width'], '0px');
                assert.equal(row['box-shadow'], 'none');

                const type = await page.computed('#plain >>> #heading', ['font-size', 'font-weight']);
                assert.equal(type['font-size'], ORACLE.headingSize, 'CITE [i=39] 20px');
                assert.equal(type['font-weight'], ORACLE.headingWeight, 'CITE [i=39] 500');

                const hint = await page.computed('#hinted >>> #hint',
                    ['font-size', 'font-weight', 'white-space', 'overflow-wrap']);
                assert.equal(hint['font-size'], ORACLE.hintSize, 'CITE [i=45] 17px');
                assert.equal(hint['font-weight'], ORACLE.hintWeight, 'CITE [i=45] 400');
                assert.equal(hint['white-space'], 'normal',
                    'DEPARTURE 6: settings.js:1455\'s whitespace-nowrap is NOT carried. It '
                    + 'is a frozen-viewport choice — with nowrap and the flex default '
                    + 'min-width:auto the hint can neither wrap nor shrink, so it leaves '
                    + 'the row and any pane with overflow:hidden eats it, which is what '
                    + 'LAYOUT_SPEC_DRAFT.md §2.4 forbids. Normal wrapping is identical at '
                    + 'every width Slate was captured at');
                assert.equal(hint['overflow-wrap'], 'anywhere',
                    '§2.4 at the level of one word — the same rule and the same reason as '
                    + 'ui-definition-card.js:390-396 in this wave');
                assert.equal(
                    (await page.computed('#plain >>> #heading', ['overflow-wrap']))['overflow-wrap'],
                    'anywhere', 'and the heading takes it too');

                const caption = await page.computed('#plain >>> #caption', ['font-size', 'font-weight']);
                assert.equal(caption['font-size'], ORACLE.captionSize, 'CITE [i=40] 16px');
                assert.equal(caption['font-weight'], ORACLE.captionWeight, 'CITE [i=40] 400');

                const reading = await page.computed('#read >>> #reading', ['font-size', 'font-weight']);
                assert.equal(reading['font-size'], ORACLE.readingSize, 'DEPARTURE 7 — .ui-body 17px');
                assert.equal(reading['font-weight'], ORACLE.readingWeight, 'DEPARTURE 7 — .ui-body 400');

                const gaps = await page.computed('#plain >>> #label', ['row-gap']);
                assert.equal(gaps['row-gap'], ORACLE.labelGap,
                    'measured: caption y=295 − (heading y=265 + h=26) = 4');
                assert.equal(await page.prop('#hinted >>> #line', 'column-gap'), ORACLE.lineGap,
                    'DEPARTURE 4: settings.js:3632 gap-[14px] snaps to --ui-space-3 (bug T20\'s class)');
            }));

        test('every measured LINE BOX is reproduced by the type roles, not by a declaration',
            () => mounted(async (page) => {
                // The four rects are the strongest evidence that the roles are the right
                // ones: 20×1.3=26, 17×1.5=25.5, 16×1.5=24, 18×1.5=27, all four measured in
                // Slate and all four arriving here from type-roles.js plus document.css.
                const near = (got, want, what) => assert.ok(
                    Math.abs(got - want) <= 0.6,
                    `${what}: rendered ${got.toFixed(2)}px against the measured ${want}px`,
                );
                near((await page.box('#plain >>> #heading')).height, ORACLE.headingLineBox,
                    'CITE .slate-heading [i=39] rect h=26');
                near((await page.box('#hinted >>> #hint')).height, ORACLE.hintLineBox,
                    'CITE .text-[20px] [i=45] rect h=26 (17 × 1.5 = 25.5)');
                near((await page.box('#plain >>> #caption')).height, ORACLE.captionLineBox,
                    'CITE .slate-caption [i=40] rect h=24');
                near((await page.box('#read >>> #reading')).height, ORACLE.readingLineBox,
                    'CITE #cupWarmerCurrentTemp [i=54] rect h=27 — the DOCUMENT leading, '
                    + 'not the markup\'s leading-[1.2]');
            }));

        test('a row with everything in it still clears the 64px floor and grows past it',
            () => mounted(async (page) => {
                const floor = await page.box('#bare');
                assert.equal(Math.round(floor.height), 64,
                    'a heading-only row is exactly the floor: 26 + 2×12 = 50, floored to '
                    + 'the 64px of slate-shell.css:1294');

                const full = await page.box('#read');
                assert.ok(full.height > 64,
                    'min-block-size is a FLOOR, not a height: heading + reading + caption '
                    + `grows the row (measured ${full.height.toFixed(1)}px)`);
                const label = await page.box('#read >>> #label');
                assert.ok(label.bottom <= full.bottom + 0.5,
                    'and nothing is clipped out of the bottom of the row');
            }));

        /* -- 2. THE DIAL DRILL, IN ITS NEGATIVE FORM -------------------------- */

        test('NO PRIVATE SELECTED LOOK: the four dials move nothing on a settings row',
            () => mounted(async (page) => {
                // Part 10 §12 / spec §3.9. A settings row does not choose among
                // alternatives — the bank inside it does — so the correct amount of
                // selection treatment here is none, and the way to prove "none" is to
                // move all four dials to loud values and measure that nothing followed.
                const targets = ['#plain', '#plain >>> #label', '#plain >>> #heading',
                    '#plain >>> #caption', '#plain >>> #control'];
                const before = {};
                for (const t of targets) before[t] = await page.computed(t, PAINTED);

                for (const dial of DIALS) await page.setToken(dial, DRILL_COLOUR);
                await page.setToken('--ui-selected-led', '37px');
                await page.setToken('--ui-selected-glow', '90%');
                await page.settle(2);

                const after = {};
                for (const t of targets) after[t] = await page.computed(t, PAINTED);
                for (const dial of DIALS) await page.setToken(dial, null);

                for (const t of targets) {
                    const differing = Object.keys(before[t]).filter((k) => before[t][k] !== after[t][k]);
                    assert.deepEqual(differing, [],
                        `${t} followed a selection dial — that is a private selected look `
                        + 'starting in a component that has no selection state');
                }

                // And it does not import the fragment at all: the aria spellings the
                // fragment matches on a host are inert here.
                await page.evalFn(() => {
                    document.getElementById('plain').setAttribute('aria-selected', 'true');
                    return true;
                });
                await page.settle(2);
                assert.equal(
                    await page.prop('#plain', 'background-color'),
                    await page.resolveToken('--ui-fascia', 'background-color'),
                    'aria-selected on a settings row must paint nothing: the row is not a '
                    + 'selection surface and never states that it is',
                );
            }));

        /* -- 3. FOCUS GEOMETRY, UNCLIPPED (bug L24's class) ------------------- */

        test('a switch slotted into a row keeps its whole ring inside the leaf pane',
            () => mounted(async (page) => {
                // The pane is spec §4.4's own skeleton — overflow-y:auto with
                // padding: var(--ui-space-6) — so it is a real clipper AND it is the
                // reason the outset ring has room. L24 is "focus rings clipped on all four
                // sides by the components they sit inside"; a settings row is one of them.
                const g = await assertFocusUnclipped(page, '#sw');
                assert.ok(g.clippers.length >= 1,
                    'the pane must really clip, or this assertion is vacuous');
                assert.equal(g.outlineOffset, '2px',
                    '--ui-focus-offset: the row adds no second offset of its own');
            }));

        test('a button and a stepper slotted into rows keep the same one ring',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#btn >>> #btn');
                await assertFocusUnclipped(page, '#step >>> #decrement');
            }));

        test('drill: --ui-steel and --ui-focus-w move a slotted control\'s ring',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-steel',
                    value: DRILL_COLOUR,
                    selector: '#sw',
                    property: 'outline-color',
                    prepare: (p) => p.focusVisible('#sw'),
                });
                await assertTokenDrill(page, {
                    token: '--ui-focus-w',
                    value: '37px',
                    selector: '#sw',
                    property: 'outline-width',
                    prepare: (p) => p.focusVisible('#sw'),
                });
            }));

        /* -- 4. CONTAINER BEHAVIOUR, AND THE FLOOR ---------------------------- */

        test('the row fills its container and reads no viewport', () => mounted(async (page) => {
            const wide = await page.box('#open');
            assert.equal(Math.round(wide.width), 820, 'the row is as wide as #wide');
            const narrow = await page.box('#squeezed');
            assert.equal(Math.round(narrow.width), 380, 'and as wide as #narrow');

            acrossGeometries[geometry.name] = {
                rowMinHeight: await page.prop('#open', 'min-height'),
                paddingBlock: await page.prop('#open', 'padding-top'),
                gap: await page.prop('#open', 'column-gap'),
                headingSize: await page.prop('#plain >>> #heading', 'font-size'),
                narrowWraps: (await page.box('#squeezed')).height > 64,
                narrowControl: await page.box('#step2')
                    .then((r) => [Math.round(r.width), Math.round(r.height)].join('x')),
            };
        }));

        test('DEPARTURE 5: the control holds its stated size and the ROW wraps (T9/T10)',
            () => mounted(async (page) => {
                // The oracle is DISQUALIFIED for responsive behaviour (Part 10 §4) — Slate
                // is frozen at 1920×1200 — so LAYOUT_SPEC_DRAFT.md governs. SCOPE L2288
                // is the rule being kept: "controls hold their stated size ... a control
                // cluster never overflows its own track" (T9: a select measured 214 in one
                // leaf and 250 two rows below, inside a single screen).
                const wideControl = await page.box('#step');
                const narrowControl = await page.box('#step2');
                assert.equal(Math.round(narrowControl.width), Math.round(wideControl.width),
                    'the stepper is the same width in a 380px row as in the leaf column — '
                    + 'that is what flex: none on the control track buys');

                const row = await page.box('#squeezed');
                assert.ok(narrowControl.right <= row.right + 0.5,
                    `the control was pushed out of the row: row right ${row.right.toFixed(1)}, `
                    + `control right ${narrowControl.right.toFixed(1)}`);
                assert.ok(narrowControl.left >= row.left - 0.5,
                    'and it is still inside the row on the leading side');

                const label = await page.box('#squeezed >>> #label');
                assert.ok(narrowControl.top >= label.bottom - 0.5,
                    'the control DROPPED to its own line rather than being crushed beside '
                    + `the label (label bottom ${label.bottom.toFixed(1)}, control top `
                    + `${narrowControl.top.toFixed(1)})`);
            }));

        test('the label floor is a THEMING HOOK: a screen can retune one row', () => mounted(async (page) => {
            // --_ui-settings-row-label-min is declared on :host precisely so a screen's
            // own declaration wins (for normal declarations the outer tree beats :host,
            // CSS Scoping §3.3). Declared on .label it would be unreachable, and the row
            // would have a number no leaf could adjust — one owner per dimension
            // (spec §2.3), with the owner being the wrong one.
            const read = async () => {
                const label = await page.box('#squeezed >>> #label');
                const control = await page.box('#step2');
                return { labelWidth: label.width, wrapped: control.top >= label.bottom - 0.5 };
            };

            const before = await read();
            assert.equal(before.wrapped, true,
                'at the default floor the 380px row wraps — that is DEPARTURE 5');

            await page.setStyle('#squeezed', { '--_ui-settings-row-label-min': '40px' });
            await page.settle(2);
            const after = await read();
            assert.ok(after.labelWidth < before.labelWidth - 1,
                'the screen\'s value must reach the label block: measured '
                + `${before.labelWidth.toFixed(1)}px -> ${after.labelWidth.toFixed(1)}px`);
            assert.equal(after.wrapped, false,
                'and with a 40px floor the control comes back onto the label\'s line');

            await page.setStyle('#squeezed', { '--_ui-settings-row-label-min': null });
            await page.settle(2);
            const restored = await read();
            assert.equal(restored.wrapped, true, 'removing it restores the default');
            assert.ok(Math.abs(restored.labelWidth - before.labelWidth) < 0.51);
        }));

        test('the row never overflows its container horizontally', () => mounted(async (page) => {
            const m = await page.metrics('#squeezed');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                `a settings row must not be wider than the column it is in: scroll `
                + `${m.scrollWidth} against client ${m.clientWidth}`);
            const label = await page.box('#squeezed >>> #label');
            const row = await page.box('#squeezed');
            assert.ok(label.right <= row.right + 0.5, 'the label block stays inside the row');
        }));

        test('DEPARTURE 6: no label text spills out of the row — §2.4, no silent clip',
            () => mounted(async (page) => {
                // The guarantee above was fixture-shaped: #squeezed's hint is "5-95 °C"
                // and its heading is all-breakable, so it meets neither case that made a
                // nowrap hint leave the row. #tight is a 300px `overflow: hidden` column,
                // which is §2.4's own inherited default, so a spill really is a SILENT
                // one. Both shapes are asserted: a multi-clause range, and a single token
                // with no break opportunity in it at all.
                for (const id of ['#longhint', '#longword']) {
                    const m = await page.metrics(id);
                    assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                        `${id} spills: scrollWidth ${m.scrollWidth} against clientWidth `
                        + `${m.clientWidth}. With white-space: nowrap and min-width: auto `
                        + 'the hint can neither wrap nor shrink and the parent eats the '
                        + 'overflow with no scrollbar and no mark');
                    const row = await page.box(id);
                    for (const part of ['#heading', '#hint']) {
                        const box = await page.box(`${id} >>> ${part}`);
                        assert.ok(box.right <= row.right + 0.5,
                            `${id} ${part} ends at ${box.right.toFixed(1)}, outside the row's `
                            + `right edge ${row.right.toFixed(1)}`);
                        assert.ok(box.left >= row.left - 0.5, `${id} ${part} spills leading-side`);
                    }
                }

                // And the departure is a departure, not a silent loss of Slate's intent:
                // at a width where the range fits, it is still on ONE line. That is what
                // makes "normal wrapping instead of nowrap" free at every captured width.
                const oneLine = await page.evalFn(() => {
                    const hint = document.getElementById('hinted').shadowRoot.getElementById('hint');
                    return hint.getClientRects().length;
                });
                assert.equal(oneLine, 1,
                    'a range that fits still sits on one line — settings.js:1455\'s intent '
                    + 'survives at every width Slate was captured at');
            }));

        test('the slotted control holds the 48px hit floor in a 380px container',
            () => mounted(async (page) => {
                // Appendix 5 / spec §2.3: the floor is physical — "a wet fingertip is
                // about 9mm; at this panel's density that is ~48px". The row must not be
                // able to squeeze a control below it, which is bug P4's and L22's shape.
                const got = await assertHitFloor(page, '#sw', { mode: 'box' });
                assert.ok(got.inline >= 48 && got.block >= 48);
                await assertHitFloor(page, '#step2 >>> #decrement', { mode: 'box' });
            }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // The row keeps the base's container-type: inline-size and asks no width
            // question of its own — there is no @container rule and no @media (width...)
            // in the component, so what changes its layout is only its CONTAINER's size.
            const props = ['min-height', 'padding-top', 'column-gap', 'flex-wrap'];
            const before = await page.computed('#open', props);
            await page.setStyle('#wide', { 'inline-size': '340px' });
            await page.settle(2);
            const after = await page.computed('#open', props);
            assert.deepEqual(after, before,
                'nothing in this component is size-keyed, so a container change moves the '
                + 'box and not the paint');
            assert.equal(Math.round((await page.box('#open')).width), 340,
                'and the box did follow the container');
        }));

        test('the leaf pane scrolls with a visible scrollbar, and the row does not scroll',
            () => mounted(async (page) => {
                // Spec §2.4: "hiding the scrollbar is banned", and T16 is the
                // counter-example — both Settings nav columns scroll with
                // scrollbar-width: none. The SCROLL REGION is the pane, not the row; the
                // row states no overflow at all and therefore cannot hide anything.
                const pane = await page.metrics('#pane');
                assert.ok(pane.scrollHeight > pane.clientHeight + 0.5,
                    'the stage must really overflow or this is vacuous');
                assert.notEqual(pane.overflowY, 'hidden');
                assert.ok(pane.scrollbarInline > 0,
                    'a region the user cannot tell is scrollable is T16 one step later');

                const row = await page.computed('#plain', ['overflow-x', 'overflow-y']);
                assert.deepEqual(row, { 'overflow-x': 'visible', 'overflow-y': 'visible' },
                    'the row clips nothing — "hidden is the default answer everywhere but '
                    + 'the numpad" is the inherited behaviour spec §2.4 exists to stop');
            }));

        /* -- 5. THE BUG, ASSERTED INEXPRESSIBLE: T13 -------------------------- */

        test('T13 leg (a): the rule that CAUSES T13, live in this page, cannot reach a row',
            () => mounted(async (page) => {
                // LAYOUT_SPEC_DRAFT.md:1189 — "One leaf's header sits 12px lower than the
                // other 36, because it wraps its title in a row that picks up the row
                // primitive's padding-block. Measured y 158/193 against 146/181."
                //   CITE settings-display-brightness .slate-title rect y=193
                //   CITE settings-accessories-cup-warmer .slate-title rect y=181
                //   193 − 181 = 12 = --slate-space-3 (slate-tokens.css:117)
                //
                // This is an A/B, not an absence. slate-shell.css:1291-1297 is injected
                // VERBATIM (only its two #id ancestors re-pointed at this stage), so the
                // hazard is genuinely live on the page. #imposter is settings.js:2391
                // reproduced byte-for-byte in its class strings, and it is displaced by
                // exactly the 12px the audit measured — T13, reproduced here on demand.
                // The two ui-settings-rows next to it, one of them wearing the identical
                // class shape, do not move at all: their heading lives in a shadow root
                // and no selector outside one reaches into it.
                const read = () => page.evalFn(() => {
                    const off = (child, host) => child.getBoundingClientRect().top
                        - host.getBoundingClientRect().top;
                    const imp = document.getElementById('imposter');
                    const plain = document.getElementById('plain');
                    const shaped = document.getElementById('shaped');
                    return {
                        imposter: off(document.getElementById('imposter-title'), imp),
                        imposterPad: getComputedStyle(imp).paddingTop,
                        plain: off(plain.shadowRoot.getElementById('heading'), plain),
                        shaped: off(shaped.shadowRoot.getElementById('heading'), shaped),
                    };
                });

                const before = await read();
                assert.equal(before.imposterPad, '0px', 'no rule is live yet');

                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.id = 't13-row-primitive';
                    /* slate-shell.css:1290-1297, verbatim. Its two id ancestors
                     * (#subpage-host #settings-content-area) become this stage's, and its
                     * --slate-* tokens become the --ui-* ones carrying the same numbers:
                     *   1291  .content-stretch.flex.items-center.justify-between,
                     *   1292  [data-settings-row] {
                     *   1293      box-sizing: border-box;
                     *   1294      min-height: var(--slate-control-height);
                     *   1295      padding-block: var(--slate-space-3);
                     *   1296      gap: var(--slate-space-5);
                     *   1297  } */
                    s.textContent = [
                        '#pane #leaf .content-stretch.flex.items-center.justify-between,',
                        '#pane #leaf [data-settings-row] {',
                        '  box-sizing: border-box;',
                        '  min-height: var(--ui-control-h);',
                        '  padding-block: var(--ui-space-3);',
                        '  gap: var(--ui-space-5);',
                        '}',
                    ].join('\n');
                    document.head.appendChild(s);
                    return true;
                });
                await page.settle(3);
                const after = await read();

                assert.equal(after.imposterPad, ORACLE.rowPaddingBlock,
                    'the injected rule must really match the imposter, or this whole test '
                    + 'is vacuous — settings.js:2391 wears exactly these four classes');
                assert.ok(Math.abs((after.imposter - before.imposter) - ORACLE.slateT13Delta) < 0.51,
                    'T13 reproduced: the imposter title moved '
                    + `${(after.imposter - before.imposter).toFixed(2)}px, against the `
                    + `${ORACLE.slateT13Delta}px the audit measured `
                    + `(y ${ORACLE.slateBrightnessTitleY} against ${ORACLE.slateOtherTitleY})`);

                assert.ok(Math.abs(after.plain - before.plain) < 0.51,
                    'the SAME rule moved a real row\'s heading — the padding-block is '
                    + 'authored against :host inside a shadow root and nothing outside it '
                    + 'can select there');
                assert.ok(Math.abs(after.shaped - before.shaped) < 0.51,
                    'and it did not move the heading of a row WEARING the class shape '
                    + 'either: a row is a tag, and a class shape is decoration');
                assert.ok(Math.abs(after.plain - after.shaped) < 0.51,
                    'with the hazard live, the two rows still agree to the pixel — which is '
                    + '"36 leaves at 181 and one at 193" made unreachable');

                await page.evalFn(() => {
                    document.getElementById('t13-row-primitive').remove();
                    return true;
                });
            }));

        test('T13 leg (b): the same class shape ON a row changes nothing about it',
            () => mounted(async (page) => {
                // #shaped wears `content-stretch flex items-center justify-between relative
                // w-full` on the HOST and is otherwise identical to #plain. In Slate a
                // class shape is the contract; here it is decoration.
                const props = ['padding-top', 'padding-bottom', 'min-height', 'column-gap',
                    'display', 'flex-wrap', 'align-items', 'justify-content', 'background-color'];
                const plain = await page.computed('#plain', props);
                const shaped = await page.computed('#shaped', props);
                assert.deepEqual(shaped, plain,
                    'a light-tree class reached into the component and changed its box — '
                    + 'that is T13\'s mechanism arriving from the other direction');

                const plainBox = await page.box('#plain');
                const shapedBox = await page.box('#shaped');
                assert.equal(Math.round(shapedBox.height), Math.round(plainBox.height),
                    'and the rendered height is identical too');
            }));

        test('T13 leg (c): the spread of heading offsets across four build routes is ZERO',
            () => mounted(async (page) => {
                // This is the arithmetic form of the bug: "36 leaves at y=181 and one at
                // y=193". Four rows, four construction routes, one of them wearing the
                // imposter class shape and one nested inside a wrapper that wears it. If
                // any route could pick up stray padding, its heading would sit lower than
                // its own row's top by a different amount.
                const offsets = await page.evalFn(() => {
                    const host = document.getElementById('routes');
                    host.innerHTML = '<ui-settings-row id="t1" heading="Screen Brightness"></ui-settings-row>';

                    const t2 = document.createElement('ui-settings-row');
                    t2.id = 't2';
                    t2.heading = 'Screen Brightness';
                    host.appendChild(t2);

                    const t3 = document.getElementById('t1').cloneNode(true);
                    t3.id = 't3';
                    t3.className = 'content-stretch flex items-center justify-between relative w-full';
                    host.appendChild(t3);

                    const wrap = document.createElement('div');
                    wrap.className = 'content-stretch flex items-center justify-between relative w-full';
                    wrap.innerHTML = '<ui-settings-row id="t4" heading="Screen Brightness"></ui-settings-row>';
                    host.appendChild(wrap);
                    return ['t1', 't2', 't3', 't4'];
                });
                await page.settle(4);
                assert.deepEqual(offsets, ['t1', 't2', 't3', 't4']);

                const measured = await page.evalFn(() => {
                    const out = [];
                    for (const id of ['t1', 't2', 't3', 't4']) {
                        const row = document.getElementById(id);
                        const heading = row.shadowRoot.getElementById('heading');
                        out.push({
                            id,
                            offset: heading.getBoundingClientRect().top - row.getBoundingClientRect().top,
                            padTop: getComputedStyle(row).paddingTop,
                        });
                    }
                    return out;
                });
                const tops = measured.map((m) => m.offset);
                const spread = Math.max(...tops) - Math.min(...tops);
                assert.ok(spread < 0.51,
                    'T13 is a 12px spread across 37 leaves. Measured spread here: '
                    + `${spread.toFixed(2)}px — ${JSON.stringify(measured)}`);
                assert.notEqual(Math.round(spread), ORACLE.slateT13Delta,
                    `Slate's spread is ${ORACLE.slateBrightnessTitleY} − ${ORACLE.slateOtherTitleY} `
                    + `= ${ORACLE.slateT13Delta}px, which is --slate-space-3 exactly`);
                for (const m of measured) {
                    assert.equal(m.padTop, ORACLE.rowPaddingBlock,
                        `${m.id} has a different padding-block from its siblings`);
                }

                // The mechanical half: every row shares ONE stylesheet object and ONE
                // constructor, so there is no second copy of the anatomy to disagree.
                const shared = await page.evalFn(() => {
                    const sheets = (id) => document.getElementById(id).shadowRoot.adoptedStyleSheets;
                    const a = sheets('t1');
                    const b = sheets('t4');
                    const c = document.getElementById('plain').shadowRoot.adoptedStyleSheets;
                    return {
                        count: a.length,
                        sameAsT4: a.length === b.length && a.every((s, i) => s === b[i]),
                        sameAsMarkupRow: a.length === c.length && a.every((s, i) => s === c[i]),
                        ctorShared: document.getElementById('t1').constructor
                            === customElements.get('ui-settings-row'),
                    };
                });
                assert.ok(shared.count >= 2, 'base styles plus the component styles at least');
                assert.ok(shared.sameAsT4 && shared.sameAsMarkupRow,
                    'all rows must share the same CSSStyleSheet objects — that is why one '
                    + 'padding-block is a mechanism and not a convention');
                assert.ok(shared.ctorShared);
            }));

        test('T13 leg (d): a rule written from OUTSIDE cannot reach the row anatomy',
            () => mounted(async (page) => {
                // slate-shell.css:1291's selector, transplanted into the document at the
                // highest specificity it can reach, with the important flag on top. Nothing
                // outside a shadow root can select into one, so REACH is what stops it —
                // not specificity, which is why Slate needed 268 important flags.
                const props = ['padding-top', 'padding-bottom', 'min-height', 'column-gap'];
                const before = await page.computed('#plain', props);
                const beforeHeading = await page.computed('#plain >>> #heading', ['font-size', 'color']);

                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.id = 't13-shell-rule';
                    s.textContent = [
                        'html body #pane #leaf .content-stretch.flex.items-center.justify-between,',
                        'html body #pane #leaf ui-settings-row, html body #pane #leaf ui-settings-row * {',
                        '  padding-block: 48px !important;',
                        '  min-height: 200px !important;',
                        '  gap: 96px !important;',
                        '  font-size: 44px !important;',
                        '}',
                    ].join('\n');
                    document.head.appendChild(s);
                    return true;
                });
                await page.settle(2);

                const after = await page.computed('#plain >>> #heading', ['font-size', 'color']);
                assert.deepEqual(after, beforeHeading,
                    'a document rule repainted the row\'s INSIDES — the shadow boundary is '
                    + 'the whole mechanism T13 dies to');

                // The HOST is in the outer tree, so the host's own box IS reachable — and
                // that is correct and worth stating: a screen owns where a row sits, the
                // component owns what a row is. The heading's offset from the row top is
                // the part that must not move, and it is the part T13 is about.
                const hostAfter = await page.computed('#plain', props);
                assert.notDeepEqual(hostAfter, before,
                    'the host box is deliberately reachable from the screen (that is how a '
                    + 'leaf lays rows out); if this ever stops being true the assertion '
                    + 'above stops being interesting');
                await page.evalFn(() => {
                    document.getElementById('t13-shell-rule').remove();
                    return true;
                });
            }));

        test('the reading is a READING: absence renders the dash, never an invented number',
            () => mounted(async (page) => {
                // A7 and the address layer's own contract: absence is a state. There is no
                // `?? compute` in the component, so an absent reading cannot become a zero.
                const cases = await page.evalFn(() => {
                    const row = document.getElementById('read');
                    const out = {};
                    const read = () => row.shadowRoot.getElementById('reading')?.textContent ?? null;
                    row.reading = { noReading: true, reason: 'absent' };
                    return Promise.resolve(row.updateComplete).then(() => {
                        out.absence = read();
                        row.reading = Number.NaN;
                        return row.updateComplete;
                    }).then(() => {
                        out.nonFinite = read();
                        row.reading = 38.5;
                        row.readingFormat = (c) => `${c.toFixed(1)}°C`;
                        return row.updateComplete;
                    }).then(() => {
                        out.number = read();
                        row.reading = null;
                        return row.updateComplete;
                    }).then(() => {
                        out.unset = read();
                        row.setAttribute('reading', '');
                        return row.updateComplete;
                    }).then(() => {
                        out.emptyAttribute = read();
                        return out;
                    });
                });
                assert.equal(cases.absence, '—',
                    'an absence from the address layer renders the dash');
                assert.equal(cases.nonFinite, '—',
                    'and `toText` turns a non-finite number into the dash, not into "NaN"');
                assert.equal(cases.number, '38.5°C', 'a reading renders through its formatter');
                assert.equal(cases.unset, null,
                    'unset renders no reading element at all — "this row has no reading" and '
                    + '"this row\'s reading has not arrived" are different states');
                assert.equal(cases.emptyAttribute, '—',
                    'and the attribute form of an absence — `reading` written with no value '
                    + '— renders the dash, which is how a static leaf declares a channel it '
                    + 'has not received yet');
            }));

        /* -- 6. ARIA: the accessible-name bridge ------------------------------ */

        test('T15\'s class: the row names the control it holds, measured in the AX tree',
            () => mounted(async (page) => {
                // Slate names a settings control with aria-labelledby pointing at the row's
                // label (settings.js:1452 / :1465) and gets it wrong four times in twenty
                // (T15: "four of twenty switches have no accessible name"). A cross-root
                // IDREF cannot work here, so the row hands the name over instead — and
                // ui-switch.js:27-33 says in its own header that this is where its name
                // comes from.
                await page.send('Accessibility.enable');
                const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                const named = (role, name) => nodes.some(
                    (n) => n.role?.value === role && (n.name?.value ?? '') === name && !n.ignored,
                );
                assert.ok(named('switch', 'Enable cup warmer'),
                    'the switch in #plain takes the row\'s heading as its accessible name');
                const anonymous = nodes.filter((n) => n.role?.value === 'switch' && !n.ignored
                    && !(n.name?.value ?? '').trim()).length;
                assert.equal(anonymous, 1,
                    'exactly one switch on this page is anonymous — #sw3, whose row states '
                    + 'no-auto-label. Every other switch is named by its row, which is T15\'s '
                    + '"four of twenty switches have no accessible name" turned into an opt-out');

                const attr = await page.evalFn(() => ({
                    switchLabel: document.getElementById('sw').getAttribute('aria-label'),
                    stepperLabel: document.getElementById('step').label,
                    selectLabel: document.getElementById('sel').label,
                    bankLabel: document.getElementById('bank').label,
                }));
                assert.equal(attr.switchLabel, 'Enable cup warmer',
                    'rule 2 — a host with role="switch" is named with aria-label');
                assert.equal(attr.stepperLabel, 'Target temperature',
                    'rule 1 — a ui-* control with a `label` property is named through it, '
                    + 'which is the route its own code already uses');
                assert.equal(attr.selectLabel, 'Measurement units',
                    'the author had already set this one and it is unchanged');
                assert.equal(attr.bankLabel, 'On disconnect');
            }));

        test('RULE 0 IS A ROLE TEST: a control with contents that do not name it is still named',
            () => mounted(async (page) => {
                // The check above only ever mounted controls with EMPTY light DOM, so it
                // could not see the over-fire. These four all HAVE textContent, and none
                // of them is named by it:
                //   <select>   role combobox — its <option> children are its value list
                //   <textarea> role textbox  — its contents are its VALUE
                //   ui-stepper / ui-bank — the glyphs are in NAMED slots, and each lands
                //                          inside a sub-part that has its own aria-label
                // A textContent gate skips all four and the row ships an unnamed control:
                // T15's "four of twenty switches have no accessible name", re-created
                // inside the primitive built to end it.
                await page.send('Accessibility.enable');
                const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                const nameOf = (role, name) => nodes.some(
                    (n) => n.role?.value === role && (n.name?.value ?? '') === name && !n.ignored,
                );
                assert.ok(nameOf('combobox', 'Measurement units'),
                    'the native <select> in #native-select is named in the AX TREE — a '
                    + 'combobox is named by its author and never by its options');
                assert.ok(nameOf('textbox', 'Descaling notes'),
                    'and the <textarea> in #native-area — its contents are its value');

                const got = await page.evalFn(() => ({
                    selectLabel: document.getElementById('nsel').getAttribute('aria-label'),
                    areaLabel: document.getElementById('narea').getAttribute('aria-label'),
                    stepperLabel: document.getElementById('step3').label,
                    bankLabel: document.getElementById('bank2').label,
                    buttonLabel: document.getElementById('btn2').label,
                }));
                assert.equal(got.selectLabel, 'Measurement units', 'rule 2 reaches the select');
                assert.equal(got.areaLabel, 'Descaling notes', 'and the textarea');
                assert.equal(got.stepperLabel, 'Shot volume',
                    'a glyph in slot="increment" is part of the control, not its name — it '
                    + 'is rendered inside ui-stepper\'s own aria-labelled <button>');
                assert.equal(got.bankLabel, 'Water source',
                    'and a glyph in ui-bank\'s slot="item-Tank" is one item\'s label, not '
                    + 'the bank\'s');
                assert.equal(got.buttonLabel, '',
                    'while the ONE case rule 0 exists for is untouched: <ui-button>Start'
                    + '</ui-button> projects its own light DOM into a <button>, so "Start" '
                    + 'is its accessible name and WCAG 2.5.3 says it keeps it');

                const anonymous = nodes.filter(
                    (n) => ['combobox', 'textbox'].includes(n.role?.value)
                        && !n.ignored && !(n.name?.value ?? '').trim(),
                ).length;
                assert.equal(anonymous, 0,
                    'no combobox and no textbox on this page is anonymous');
            }));

        test('an author\'s own name always wins, and the opt-out is honoured',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => ({
                    authored: document.getElementById('btn').label,
                    visibleText: document.getElementById('btn2').label,
                    optedOut: document.getElementById('sw3').getAttribute('aria-label'),
                    generic: document.getElementById('wrapper').getAttribute('aria-label'),
                }));
                assert.equal(got.authored, 'Open the charger log',
                    'the row must never overwrite a name the screen stated');
                assert.equal(got.visibleText, '',
                    'RULE 0 — a control with visible text keeps it. A button reading "Start" '
                    + 'in a row headed "Descale the machine" must not be renamed to the '
                    + 'heading: that is WCAG 2.5.3 Label in Name');
                assert.equal(got.optedOut, null, 'no-auto-label turns the bridge off entirely');
                assert.equal(got.generic, null,
                    'a role-less wrapper is NEVER given an aria-label — that is bug T15\'s '
                    + 'own second clause, "aria-label on role-less divs"');
            }));

        test('the name follows the heading, and is withdrawn when the heading goes',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => {
                    const row = document.getElementById('plain');
                    const sw = document.getElementById('sw');
                    const out = {};
                    row.heading = 'Enable the cup warmer plate';
                    return row.updateComplete.then(() => {
                        out.renamed = sw.getAttribute('aria-label');
                        row.heading = '';
                        return row.updateComplete;
                    }).then(() => {
                        out.withdrawn = sw.getAttribute('aria-label');
                        row.heading = 'Enable cup warmer';
                        return row.updateComplete;
                    }).then(() => {
                        out.restored = sw.getAttribute('aria-label');
                        return out;
                    });
                });
                assert.equal(got.renamed, 'Enable the cup warmer plate');
                assert.equal(got.withdrawn, null,
                    'what the row wrote, the row removes — it never leaves a stale name behind');
                assert.equal(got.restored, 'Enable cup warmer');
            }));

        test('a control slotted in later is named too', () => mounted(async (page) => {
            const got = await page.evalFn(() => {
                const row = document.getElementById('read');
                row.heading = 'Current temperature';
                const sw = document.createElement('ui-switch');
                sw.id = 'late';
                row.appendChild(sw);
                return new Promise((resolve) => requestAnimationFrame(
                    () => requestAnimationFrame(() => resolve(sw.getAttribute('aria-label'))),
                ));
            });
            assert.equal(got, 'Current temperature',
                'the bridge is on slotchange as well as on render, so a screen that fills '
                + 'a row after mount does not get an anonymous control');
        }));
    });
}

describe('the gallery states are capture inputs, so they have to render', () => {
    // The capture battery photographs these six states by id; a state whose markup does
    // not mount photographs as an empty stage and the diff is silently green. Mount each
    // one for real, once, at the bench geometry.
    for (const state of galleryEntry.states) {
        test(`${galleryEntry.id}--${state.id} mounts and renders a row`, () =>
            browser.withPage({ geometry: BENCH }, async (page) => {
                await page.mount(state.html, ['/tools/gallery/entries/ui-settings-row.demo.js']);
                assert.deepEqual(page.pageErrors, [], `${state.id} threw on mount`);
                const rows = await page.count('ui-settings-row');
                assert.ok(rows >= 1, `${state.id} mounted no ui-settings-row`);
                const upgraded = await page.evalFn(() => [...document.querySelectorAll('ui-settings-row')]
                    .every((r) => !!r.shadowRoot && !!r.shadowRoot.getElementById('label')));
                assert.equal(upgraded, true,
                    `${state.id} has a ui-settings-row that never upgraded — the sidecar is `
                    + 'the only module gallery.js imports for this entry');
                const heading = await page.evalFn(() => {
                    const row = document.querySelector('ui-settings-row');
                    const h = row.shadowRoot.getElementById('heading');
                    return h ? h.getBoundingClientRect().height : 0;
                });
                assert.ok(heading > 0, `${state.id}'s first row paints no heading`);
            }));
    }

    test('the t13 state really displaces its imposter and really leaves the rows alone', () =>
        browser.withPage({ geometry: BENCH }, async (page) => {
            // The picture only means something if the injected rule fires. Measured here
            // so the battery's screenshot is evidence rather than decoration.
            const state = galleryEntry.states.find((s) => s.id === 't13');
            await page.mount(state.html, ['/tools/gallery/entries/ui-settings-row.demo.js']);
            assert.deepEqual(page.pageErrors, []);
            const got = await page.evalFn(() => {
                const imp = document.querySelector('.t13-mark');
                const rows = [...document.querySelectorAll('ui-settings-row')];
                const off = (child, host) => child.getBoundingClientRect().top
                    - host.getBoundingClientRect().top;
                return {
                    imposterPad: getComputedStyle(imp).paddingTop,
                    headings: rows.map((r) => off(r.shadowRoot.getElementById('heading'), r)),
                };
            });
            assert.equal(got.imposterPad, '12px',
                'slate-shell.css:1295 must actually match the imposter in this state');
            assert.equal(got.headings.length, 2, 'two rows, one of them wearing the shape');
            assert.ok(Math.abs(got.headings[0] - got.headings[1]) < 0.51,
                `the two rows disagree by ${(got.headings[0] - got.headings[1]).toFixed(2)}px — `
                + 'that is T13 appearing in the very state that exists to show it cannot');
        }));
});

describe('ui-settings-row across geometries', () => {
    test('the UI scale is never fluid, and neither is the row anatomy', () => {
        // Spec §2.2: "The UI scale is never fluid ... legibility is a floor". The two
        // geometries must agree on every token-derived number; what may differ is only
        // what the CONTAINER decides, and the containers here are fixed px.
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            `both geometries must have recorded: ${names.join(', ')}`);
        const [first, ...rest] = names;
        for (const name of rest) {
            assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
                `${name} and ${first} disagree about the row anatomy — something in this `
                + 'component is keyed to the viewport');
        }
        assert.equal(acrossGeometries[first].rowMinHeight, ORACLE.rowMinHeight);
        assert.equal(acrossGeometries[first].paddingBlock, ORACLE.rowPaddingBlock);
        assert.equal(acrossGeometries[first].narrowWraps, true,
            'the 380px container wraps at BOTH geometries — the wrap is intrinsic, so it '
            + 'cannot be right at one viewport and wrong at the other');
    });
});
