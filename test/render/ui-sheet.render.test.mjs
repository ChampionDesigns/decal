/**
 * ui-sheet.render.test.mjs — Gate A for component #20 (wave 4, item #20).
 *
 * Runs at BOTH standard geometries — 1281x801 @ dsf 1.5 (the bench truth) and the
 * 1000x600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — the two rhythms and the label/caption type, each retargeted on
 *      :root with the rendered value asserted to move AND to land on the token, plus
 *      the oracle's literals asserted once in each theme;
 *   2. the four selection dials — a sheet body has no selected state, so the
 *      obligation runs BOTH ways: retargeting every dial must move nothing this file
 *      paints, and a selectable control placed in a FIELD slot must still be painted
 *      by the dials, through the slot, unaltered;
 *   3. focus geometry from --ui-focus-*, unclipped — on slotted controls in both
 *      arrangements, which is where every focusable in a sheet lives, and the
 *      overflow assertion that is the mechanism behind it;
 *   4. container behaviour — the sheet reads its own container and not the viewport
 *      (identical boxes at both geometries for the same container), the narrow
 *      container where the inline cluster wraps rather than overflowing, and the
 *      ONE-SCROLLPORT rule that keeps §4.6's floor on #18's body;
 *   5. O13 asserted dead, four ways — the row's carried repair (ITEMS.json #20
 *      notes: ".slate-sheet-actions currently means a header cluster in the library
 *      and a dialog footer in the shell (O13) - the two jobs get two names, so the
 *      sheet must not re-conflate them");
 *   6. the aria contract — a labelled field is a named group, its caption describes
 *      it, an unlabelled field is nothing at all, and no aria is written onto slotted
 *      light DOM (T15's "aria-label on role-less divs" in the making).
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every
 * literal below carries its CITE line; the two that depart from the oracle
 * (microcap weight and tracking) cite the upstream decision instead.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertOneSelectionTreatment,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

/* #18 and #16 are wave 3, delivered and stamped (waves/3/DONE.json); ui-button is
 * wave 1. Item #20's row names #18 and #16 as its dependencies, so the composition is
 * the subject here rather than a coupling to work in flight. ui-dialog.js imports
 * ui-sheet-header.js itself. base-fixture is the wave-0a rig fixture, not a sibling
 * builder's component: it is the only thing in the tree carrying a
 * selectionSurface-painted selected state, which class 2 needs. */
const MODULE = [
    '/src/components/ui-sheet.js',
    '/src/components/ui-button.js',
    '/test/fixtures/base-fixture.js',
];

const DIALOG_MODULE = [
    '/src/components/ui-sheet.js',
    '/src/components/ui-dialog.js',
    '/src/components/ui-button.js',
];

/* The schedule editor's three fields, in Slate's order (settings.js:2610-2650).
 * `layout: inline` on the third is Slate's `.slate-sheet-duration`. */
const FIELDS = JSON.stringify([
    { name: 'time', label: 'Wake Time' },
    { name: 'days', label: 'Days of Week' },
    {
        name: 'awake',
        label: 'Keep Awake For',
        layout: 'inline',
        caption: 'Duration to keep machine awake after schedule starts.',
    },
]).replace(/"/g, '&quot;');

/* A second sheet whose first field has NO label — the "control only" row — and whose
 * tail slot has content, so both edges of the render are measured. */
const PLAIN_FIELDS = JSON.stringify([
    { name: 'bare' },
    { name: 'named', label: 'Named' },
]).replace(/"/g, '&quot;');

/* THE RULE THAT MAKES THE DEFECT, written in the LIGHT tree exactly as the sheet that
 * carries it writes it:
 *
 *   O13  slate-shell.css:2227-2232 — `#subpage-host .slate-sheet-actions` is a
 *        FOOTER: justify-content: flex-end; gap: var(--slate-space-4);
 *        margin-top: var(--slate-space-7). It is loaded after the library, so in
 *        Slate it restyles every header cluster in the app.
 *
 * It is aimed at the Slate class names, at this component's class names, and at
 * descendants of the host, so the test cannot pass merely because the names moved.
 * `!important` is used here ON PURPOSE and is not a violation of CONVENTIONS §6:
 * this is the hostile document, not component CSS. If any of it could reach in, an
 * important declaration is what would make it reach hardest. */
const HOSTILE_CSS = `
<style>
    .slate-sheet-actions, .slate-sheet-body, .slate-sheet-row, .slate-sheet-duration,
    .stack, .field, .control, .control-inline, .label, .caption,
    ui-sheet .stack, ui-sheet .field, ui-sheet > * {
        justify-content: flex-end !important;
        margin-top: 40px !important;
        gap: 40px !important;
        overflow: hidden !important;
        padding: 40px !important;
    }
    .slate-microcap, .label, ui-sheet .label, ui-sheet span {
        font-size: 20px !important;
        font-weight: 800 !important;
        letter-spacing: 0.12em !important;
        text-transform: none !important;
    }
</style>`;

/* A slotted focusable with the base's own ring re-created in the LIGHT tree — the
 * stand-in ui-sheet-header.render.test.mjs and ui-card.render.test.mjs both use, for
 * the same reason: `.child` inherits --_ui-focus-offset from its light-tree parent. */
const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    button.child, input.child {
        margin: 0; padding: 0 12px; border: 0; background: none; font: inherit;
        min-block-size: 64px; box-sizing: border-box;
    }
    input.child { inline-size: 120px; }
    .unit { font-size: 17px; }
</style>`;

/* 644px is the content measure of a 680px sheet dialog, and it is MEASURED rather
 * than assumed: 680 is INSIDE #18's one container query — §4.6's surviving real
 * breakpoint, `numpad-modal.css:411 max-width: 720px`, carried as
 * `@container (max-width: 720px) { .cell { --_ui-dialog-pad: var(--ui-space-4) } }` —
 * so the cell inset is --ui-space-4 (18px) and the body measure is 680 - 36 = 644,
 * NOT the 680 - 2 x --ui-space-5 = 632 this file's first draft assumed. The test
 * "the sheet is the dialog body and inherits its inset" below asserts that from the
 * token against the real composition, and the gallery stages the same number
 * (tools/gallery/entries/ui-sheet.entry.js hostStyle `inline-size: 644px`). The
 * standalone stages carry it so the bulk of this suite measures the body at the
 * width the battery photographs, not 12px narrower. SHEET_DIALOG_INLINE and the
 * departure are documented in ui-sheet.js's header; here it is only a container with
 * a stated width, so the geometry assertions measure real boxes. */
const MARKUP = `${RING_CSS}
<div id="wide" style="inline-size: 644px">
    <ui-sheet id="solo" fields="${FIELDS}">
        <input class="child" slot="time" id="time-in" type="text" value="05:30">
        <base-fixture id="fx" slot="days" style="padding: 0"></base-fixture>
        <input class="child" slot="awake" id="hours-in" type="text" value="1">
        <span class="unit" slot="awake" id="hours-unit">hr</span>
        <input class="child" slot="awake" id="mins-in" type="text" value="0">
        <span class="unit" slot="awake" id="mins-unit">min</span>
    </ui-sheet>
</div>
<div id="wide-2" style="inline-size: 644px">
    <ui-sheet id="composed" fields="${FIELDS}">
        <ui-button id="ui-pick" slot="time">05:30</ui-button>
    </ui-sheet>
</div>
<div id="wide-3" style="inline-size: 644px">
    <ui-sheet id="plain" fields="${PLAIN_FIELDS}">
        <button class="child" slot="bare" id="bare-ctl" type="button">No label</button>
        <button class="child" slot="named" id="named-ctl" type="button">Named</button>
        <p id="tail" style="margin: 0">The tail, after the last field.</p>
        <button id="stray-footer" slot="actions" type="button">Save</button>
    </ui-sheet>
</div>
<div id="narrow" style="inline-size: 320px">
    <ui-sheet id="squeezed" fields="${FIELDS}">
        <input class="child" slot="time" id="sq-time" type="text" value="05:30">
        <input class="child" slot="awake" id="sq-hours" type="text" value="1">
        <span class="unit" slot="awake">hr</span>
        <input class="child" slot="awake" id="sq-mins" type="text" value="0">
        <span class="unit" slot="awake">min</span>
    </ui-sheet>
</div>
<div id="wide-4" style="inline-size: 644px">
    <ui-sheet id="empty"></ui-sheet>
</div>
${HOSTILE_CSS}
`;

/* Two fields, no caption: the FLOOR geometry is 600px tall and a dialog whose body
 * outgrows `calc(100% - 2 * --ui-space-5)` starts scrolling, which would put the
 * body's border box below the footer and make the O13 geometry assertion measure the
 * scroll overflow rather than the grid. The composition is what is under test here,
 * not the field count. */
const DIALOG_FIELDS = JSON.stringify([
    { name: 'time', label: 'Wake Time' },
    { name: 'awake', label: 'Keep Awake For', layout: 'inline' },
]).replace(/"/g, '&quot;');

/* The dialog composition gets its own mount: an open modal marks every sibling inert
 * (ui-dialog's focus trap), so it cannot share a page with the focus and geometry
 * fixtures above. */
const DIALOG_MARKUP = `${RING_CSS}
<ui-dialog id="d" open heading="Add schedule" style="--_ui-dialog-inline: 680px">
    <ui-sheet id="sheet" slot="body" fields="${DIALOG_FIELDS}">
        <input class="child" slot="time" id="d-time" type="text" value="05:30">
        <input class="child" slot="awake" id="d-hours" type="text" value="1">
        <span class="unit" slot="awake">hr</span>
    </ui-sheet>
    <ui-button id="cancel" slot="actions">Cancel</ui-button>
    <ui-button id="save" slot="actions" variant="primary">Save</ui-button>
</ui-dialog>
`;

/**
 * The oracle's own numbers, named once.
 *
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75] font-size =
 *        15px <- slate-components.css `.slate-microcap` authored
 *        `var(--slate-text-cap)` !important=yes (token-driven)
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75]
 *        text-transform = uppercase <- slate-components.css `.slate-microcap`
 *        authored `uppercase` !important=no (FROZEN/hardcoded)
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75] color =
 *        rgb(148, 161, 169) <- slate-components.css `.slate-microcap` authored
 *        `var(--slate-muted)` !important=yes (token-driven)
 *   CITE settings-machine-sleep---wake-schedules [prov-light] .slate-microcap [i=75]
 *        color = rgb(90, 101, 108) <- slate-components.css `.slate-microcap`
 *        authored `var(--slate-muted)` !important=yes (token-driven)
 *
 * ONE ORACLE ANSWER IS DISQUALIFIED, by a decision upstream of this component
 * (a decision beats every other source — prov_query.py's disqualification banner):
 *   font-weight 600 -> 700    styles/tokens.css:368-372, three weights not five
 * The letter-spacing departure (.12em -> .04em) was REVERSED at parity surface 0: the
 * spec clause it rested on writes ".04em" while citing the slate-tokens.css lines that
 * declare .12em, so the oracle's 1.8px stands and this label renders it.
 * type-roles.js carries both, and this component takes the label from that role rather
 * than restating any of it.
 *
 * THE RHYTHM has no oracle answer at all — `find --cls slate-sheet-body`,
 * `--cls slate-sheet-row` and `--cls slate-sheet-duration` each return "0 elements
 * matched anywhere in this corpus" — so the three gaps are read-only source reads of
 * slate-shell.css:2205-2222, each corroborated by the capture at the DaisyUI closed
 * scale of 0.9 (see ui-sheet.js's RHYTHM block for the six measured pairs).
 */
const ORACLE = {
    labelSize: 15,
    labelTransform: 'uppercase',
    labelWeight: '600',       // Slate's own semibold; the 700 departure closed at parity surface 1
    labelTracking: 1.8,       // the oracle's own .12em x 15px (parity surface 0)
    muted: { dark: 'rgb(148, 161, 169)', light: 'rgb(90, 101, 108)' },
    stackGap: 28,             // slate-shell.css:2208 gap: var(--slate-space-6)
    fieldGap: 12,             // slate-shell.css:2213 gap: var(--slate-space-3)
    clusterGap: 12,           // slate-shell.css:2221 gap: var(--slate-space-3)
    captionSize: 16,          // type-roles .ui-caption, --ui-text-note
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
    describe(`ui-sheet @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet must mount without throwing');
            return fn(page);
        });

        const inDialog = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(DIALOG_MARKUP, DIALOG_MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet in a dialog must mount without throwing');
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

        /* -- 0. the fixture is measuring real boxes -------------------------- */

        test('every measured sheet has a container to fill', () => mounted(async (page) => {
            // A GUARD ON THE FIXTURE ITSELF. Each sheet below sits in a block box with
            // a stated inline-size; if one ever loses it, every geometric assertion
            // silently measures a collapsed row.
            for (const id of ['solo', 'composed', 'plain']) {
                const host = await page.box(`#${id}`);
                assert.ok(host.width > 600, `#${id} is in a collapsed container: ${host.width}px`);
            }
            const squeezed = await page.box('#squeezed');
            near(squeezed.width, 320, '#squeezed fills the narrow container', 1);
        }));

        /* -- 1. tokens are consumed, not copied ------------------------------ */

        test('drill: --ui-space-6 is the stack rhythm', () => mounted(async (page) => {
            // SOURCE slate-shell.css:2208 `.slate-sheet-body { gap: var(--slate-space-6) }`,
            // corroborated twice in the capture at 0.9 (25px and 26px against 25.2).
            await assertTokenDrill(page, {
                token: '--ui-space-6',
                value: DRILL_LENGTH,
                selector: '#solo >>> #stack',
                property: 'row-gap',
            });
        }));

        test('drill: --ui-space-3 is the rhythm inside a field', () => mounted(async (page) => {
            // SOURCE slate-shell.css:2213 `.slate-sheet-row { gap: var(--slate-space-3) }`,
            // corroborated three times in the capture at 0.9 (11, 11, 10 against 10.8).
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#solo >>> #field-0',
                property: 'row-gap',
            });
        }));

        test('drill: --ui-space-3 is the inline cluster gap', () => mounted(async (page) => {
            // SOURCE slate-shell.css:2221 `.slate-sheet-duration { gap: var(--slate-space-3) }`,
            // corroborated in the capture at 0.9 (11px between [i=94] and [i=95]).
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#solo >>> #control-2',
                property: 'column-gap',
            });
        }));

        test('drill: --ui-text-sm is the label size', () => mounted(async (page) => {
            // ORACLE settings-machine-sleep---wake-schedules .slate-microcap [i=75]
            //        font-size = 15px <- authored var(--slate-text-cap)
            await assertTokenDrill(page, {
                token: '--ui-text-sm',
                value: DRILL_LENGTH,
                selector: '#solo >>> #lbl-0',
                property: 'font-size',
            });
        }));

        test('drill: --ui-muted is the label ink', () => mounted(async (page) => {
            // ORACLE ... .slate-microcap [i=75] color = rgb(148, 161, 169)
            //        <- authored var(--slate-muted)
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#solo >>> #lbl-0',
                property: 'color',
            });
        }));

        test('drill: --ui-tracking-cap is the label tracking', () => mounted(async (page) => {
            // The oracle says 1.8px here and the token now carries it. The drill is
            // what proves the value is READ from --ui-tracking-cap rather than frozen at
            // whichever number happens to be right today.
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: DRILL_LENGTH,
                selector: '#solo >>> #lbl-0',
                property: 'letter-spacing',
            });
        }));

        test('drill: --ui-text-note is the caption size', () => mounted(async (page) => {
            // The caption is #13's role, not a treatment declared here — the drill is
            // what proves it: one caption treatment, in one file.
            await assertTokenDrill(page, {
                token: '--ui-text-note',
                value: DRILL_LENGTH,
                selector: '#solo >>> #cap-2',
                property: 'font-size',
            });
        }));

        test('the label lands on the oracle literals in both themes', () => mounted(async (page) => {
            const read = async () => page.computed('#solo >>> #lbl-0', [
                'font-size', 'font-weight', 'text-transform', 'letter-spacing', 'color',
            ]);

            const dark = await read();
            near(dark['font-size'], ORACLE.labelSize, 'label font-size');
            assert.equal(dark['text-transform'], ORACLE.labelTransform);
            assert.equal(dark['font-weight'], ORACLE.labelWeight,
                'the microcap is Slate\'s own 600 (parity surface 1 reversed the 700 departure: '
                + 'LAYOUT_SPEC_DRAFT §3.5 cites slate-tokens.css:148-153, which declares four weights)');
            near(dark['letter-spacing'], ORACLE.labelTracking,
                'the microcap tracks Slate\'s .12em (parity surface 0 reversed the .04em departure)');
            assert.equal(dark.color, ORACLE.muted.dark);

            await page.setTheme('light');
            const light = await read();
            assert.equal(light.color, ORACLE.muted.light,
                'the label ink follows the theme through --ui-muted, not a literal');
            near(light['font-size'], ORACLE.labelSize, 'label font-size (light)');
        }));

        test('the rhythms land on the oracle literals', () => mounted(async (page) => {
            const stack = await page.computed('#solo >>> #stack', ['row-gap', 'display', 'flex-direction']);
            near(stack['row-gap'], ORACLE.stackGap, 'stack gap');
            assert.equal(stack.display, 'flex');
            assert.equal(stack['flex-direction'], 'column');

            const field = await page.computed('#solo >>> #field-0', ['row-gap', 'flex-direction']);
            near(field['row-gap'], ORACLE.fieldGap, 'field gap');
            assert.equal(field['flex-direction'], 'column');

            const cluster = await page.computed('#solo >>> #control-2',
                ['column-gap', 'display', 'align-items', 'flex-wrap']);
            near(cluster['column-gap'], ORACLE.clusterGap, 'inline cluster gap');
            assert.equal(cluster.display, 'flex');
            assert.equal(cluster['align-items'], 'center');
            assert.equal(cluster['flex-wrap'], 'wrap',
                'the cluster wraps rather than overflowing its dialog — the container decides');

            const caption = await page.computed('#solo >>> #cap-2', ['font-size']);
            near(caption['font-size'], ORACLE.captionSize, 'caption font-size');
        }));

        test('the sheet paints no card of its own', () => mounted(async (page) => {
            // The card is #18's cell: --ui-surface, --_ui-dialog-pad, --ui-radius-xl.
            // A body that repainted any of them would be the second card in one box.
            const host = await page.computed('#solo', [
                'background-color', 'border-top-width', 'border-top-left-radius',
                'padding-top', 'padding-left', 'box-shadow',
            ]);
            assert.equal(host['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(host['border-top-width'], '0px');
            assert.equal(host['border-top-left-radius'], '0px');
            assert.equal(host['padding-top'], '0px');
            assert.equal(host['padding-left'], '0px');
            assert.equal(host['box-shadow'], 'none');

            const stack = await page.computed('#solo >>> #stack',
                ['background-color', 'padding-top', 'padding-left', 'margin-top']);
            assert.equal(stack['background-color'], 'rgba(0, 0, 0, 0)');
            assert.equal(stack['padding-top'], '0px');
            assert.equal(stack['padding-left'], '0px');
            assert.equal(stack['margin-top'], '0px',
                'slate-shell.css:2231 margin-top: var(--slate-space-7) is #18s inset now');
        }));

        /* -- 2. the four selection dials ------------------------------------- */

        test('wave law: no dial reaches anything this component paints', () => mounted(async (page) => {
            /* THE NEGATIVE HALF. A sheet body has no selected state, so the obligation
             * is to prove there is no private "selected" look hiding in it — the
             * defect that started the audit was thirteen components with six
             * treatments, and a treatment nobody asked for is how the seventh
             * arrives. Every dial is moved to a value no palette would pick; nothing
             * this file paints may notice. */
            const parts = [
                '#solo >>> #stack', '#solo >>> #field-0', '#solo >>> #lbl-0',
                '#solo >>> #control-2', '#solo >>> #cap-2',
            ];
            const props = ['background-color', 'color', 'box-shadow', 'text-shadow'];
            const before = {};
            for (const p of parts) before[p] = await page.computed(p, props);

            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', DRILL_COLOUR);
            await page.setToken('--ui-selected-led', DRILL_LENGTH);
            await page.setToken('--ui-selected-glow', '60%');
            try {
                for (const p of parts) {
                    assert.deepEqual(
                        await page.computed(p, props), before[p],
                        `${p} moved when the selection dials moved — this component owns ` +
                        'no selected state, so nothing in it may read a dial (CONVENTIONS §4).',
                    );
                }
            } finally {
                for (const t of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) await page.setToken(t, null);
            }
        }));

        test('a selectable control in a field slot is still painted by the four dials',
            () => mounted(async (page) => {
                /* THE POSITIVE HALF. The one selection treatment has to survive being
                 * slotted into a field — the schedule sheet's own "Days of Week" row
                 * is a segmented bank (#3), so this is the real case and not a
                 * hypothetical. The subject is the rig fixture's selectionSurface pair,
                 * measured THROUGH this component's slot. */
                await assertOneSelectionTreatment(page, {
                    selected: '#fx >>> #tab',
                    unselected: '#fx >>> #tab-off',
                });
            }));

        /* -- 3. focus geometry, unclipped ------------------------------------ */

        test('a slotted control in a stacked field keeps the one ring, unclipped',
            () => mounted(async (page) => {
                // L24's class: "focus rings clipped on all four sides by the components
                // they sit inside". The sheet declares no overflow anywhere, so a 64px
                // control's outset ring has room on every side.
                await assertFocusUnclipped(page, '#time-in');
            }));

        test('a slotted control in the inline cluster keeps the one ring, unclipped',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#hours-in');
                await assertFocusUnclipped(page, '#mins-in');
            }));

        test('a composed ui-button keeps its own ring through the slot', () => mounted(async (page) => {
            // #1 is a real UiElement: its ring is declared on its own host and the
            // sheet neither doubles it nor blanks it (CONVENTIONS §3a).
            await assertFocusUnclipped(page, '#ui-pick >>> button');
        }));

        test('the tail slot content still gets the ring', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#named-ctl');
        }));

        /* -- 4. container behaviour ------------------------------------------ */

        test('the sheet opens no second scrollport', () => mounted(async (page) => {
            /* §4.6: "body 1fr overflow-y: auto <- mandatory", and ui-dialog.js puts
             * the floor and the order of surrender on ITS body cell. A scrollport here
             * would give a short dialog two scrollbars, and one of them would be the
             * wrong one. It is also the mechanism behind the four focus tests above. */
            for (const sel of ['#solo', '#solo >>> #stack', '#solo >>> #field-0',
                '#solo >>> #control-2']) {
                const box = await page.computed(sel, ['overflow-x', 'overflow-y']);
                assert.equal(box['overflow-x'], 'visible', `${sel} declares an overflow`);
                assert.equal(box['overflow-y'], 'visible', `${sel} declares an overflow`);
            }
        }));

        test('nothing overflows a 320px container; the cluster wraps instead',
            () => mounted(async (page) => {
                const host = await page.box('#squeezed');
                for (const sel of ['#squeezed >>> #stack', '#squeezed >>> #field-0',
                    '#squeezed >>> #control-2', '#squeezed >>> #cap-2']) {
                    const box = await page.box(sel);
                    assert.ok(box.width <= host.width + 0.5,
                        `${sel} is ${box.width}px wide inside a ${host.width}px sheet`);
                }
                // Two 120px fields and two unit words cannot sit on one 320px line, so
                // the cluster is taller than one control row. That is the container
                // deciding — there is no width query anywhere in this component.
                const cluster = await page.box('#squeezed >>> #control-2');
                assert.ok(cluster.height > 64,
                    `the inline cluster did not wrap at 320px (height ${cluster.height})`);
            }));

        test('the rhythm is the same at 320px as at 644px', () => mounted(async (page) => {
            // §2.1 Rule 1: the component reads its own container. A narrower container
            // may change the arrangement; it may not change the rhythm, because there
            // is no breakpoint here to change it.
            const wide = await page.computed('#solo >>> #stack', ['row-gap']);
            const narrow = await page.computed('#squeezed >>> #stack', ['row-gap']);
            assert.equal(narrow['row-gap'], wide['row-gap']);
        }));

        test('an empty sheet renders an empty stack and takes no height', () => mounted(async (page) => {
            const box = await page.box('#empty >>> #stack');
            assert.equal(box.height, 0, 'an empty sheet must not reserve a row of space');
            assert.equal(await page.count('#empty >>> .field'), 0);
        }));

        test('the same container gives the same boxes at both geometries', () => mounted(async (page) => {
            // The record is keyed by geometry and compared after both blocks have run.
            const record = {};
            for (const sel of ['#solo >>> #stack', '#solo >>> #field-0', '#solo >>> #lbl-0',
                '#solo >>> #control-2', '#solo >>> #cap-2']) {
                const b = await page.box(sel);
                record[sel] = { width: Math.round(b.width), height: Math.round(b.height) };
            }
            acrossGeometries[geometry.name] = record;
        }));

        /* -- 5. O13, asserted dead four ways --------------------------------- */

        test('O13: the sheet has no actions slot', () => mounted(async (page) => {
            // "`.slate-sheet-actions` means two different things — a header cluster in
            // the library, a dialog footer in the shell" (§7.7 O13,
            // slate-components.css:690-695 vs slate-shell.css:2227-2232). #16 took the
            // header half as `trail`; #18 took the footer half as `actions`. The sheet
            // takes neither, so there is no third meaning to collide with.
            assert.equal(await page.count('#solo >>> slot[name="actions"]'), 0);
            assert.equal(await page.count('#solo >>> slot[name="trail"]'), 0);
        }));

        test('O13: nothing in the sheet is a flex-end cluster', () => mounted(async (page) => {
            // The footer's shape is justify-content: flex-end + margin-top: space-7.
            // Neither may exist in this shadow root, at any depth, in any theme.
            const found = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var bad = [];
                    root.querySelectorAll('*').forEach(function (el) {
                        var cs = getComputedStyle(el);
                        if (cs.justifyContent === 'flex-end') bad.push(el.id || el.className);
                        if (parseFloat(cs.marginTop) !== 0) bad.push('margin:' + (el.id || el.className));
                    });
                    return JSON.stringify(bad);
                })()`));
            assert.deepEqual(found, [],
                'a flex-end cluster or a top margin appeared in the sheet body — that is O13 arriving again');
        }));

        test('O13: a stray slot="actions" child renders nowhere', () => mounted(async (page) => {
            /* A consumer that puts the footer buttons inside the sheet instead of on
             * the dialog gets nothing rendered, not a second footer inside the body.
             * The default slot only takes nodes with NO slot attribute, and no named
             * slot answers to "actions". */
            const box = await page.box('#stray-footer');
            assert.equal(box.width, 0, 'a slot="actions" child of the sheet was rendered');
            assert.equal(box.height, 0, 'a slot="actions" child of the sheet was rendered');
        }));

        test('O13: in the real composition the footer is the dialog\'s, below the body',
            () => inDialog(async (page) => {
                const sheet = await page.box('#sheet');
                const save = await page.box('#save');
                const cancel = await page.box('#cancel');
                assert.ok(sheet.width > 0 && save.width > 0, 'the composition did not render');
                assert.ok(save.top >= sheet.bottom - 0.5,
                    `Save (top ${save.top}) is not below the sheet body (bottom ${sheet.bottom}) — ` +
                    'the footer is the dialog\'s last grid row, not a cluster inside the body');
                assert.ok(cancel.top >= sheet.bottom - 0.5);
                // And the buttons are in the DIALOG's tree, not the sheet's.
                const owner = await page.eval(`
                    document.getElementById('save').assignedSlot
                        ? document.getElementById('save').assignedSlot.name : 'none'`);
                assert.equal(owner, 'actions');
            }));

        test('the sheet is the dialog body and inherits its inset, not a second one',
            () => inDialog(async (page) => {
                /* MEASURED, and it corrects the arithmetic in this file's first draft.
                 * A sheet asks for a 680px dialog, and 680 is INSIDE #18's one
                 * container query — the surviving real breakpoint of §4.6,
                 * numpad-modal.css:411 `max-width: 720px`, carried as
                 * `@container (max-width: 720px) { .cell { --_ui-dialog-pad:
                 * var(--ui-space-4) } }`. So a sheet dialog runs at the 18px inset,
                 * not the 24px one, and the body measure is 680 - 36 = 644.
                 *
                 * That is the answer to Slate's 40px sheet padding being dropped: at
                 * the sheet's own width the dialog is already at its tighter inset,
                 * and the ONE DEPARTURE recorded in ui-sheet.js costs 44px of measure
                 * rather than 8px of padding. The assertion reads the token so the
                 * number cannot be frozen here. */
                const pad = await page.resolveValue('var(--ui-space-4)', 'padding-left');
                const sheet = await page.box('#sheet');
                near(sheet.width, 680 - 2 * parseFloat(pad), 'the sheet body measure at 680px', 1);

                const cell = await page.computed('#d >>> #body', ['padding-left']);
                assert.equal(cell['padding-left'], pad,
                    'the dialog cell is not at --ui-space-4: the one container query did not fire at 680px');

                const own = await page.computed('#sheet', ['padding-left', 'padding-right']);
                assert.equal(own['padding-left'], '0px');
                assert.equal(own['padding-right'], '0px');
            }));

        /* -- 6. the aria contract -------------------------------------------- */

        test('a labelled field is a group named by its own label', () => mounted(async (page) => {
            /* An IDREF does not cross a shadow boundary (ui-sheet-header.js:277-281
             * hit the same wall). Both the group and the label are in THIS root and
             * the control is a flat-tree descendant, so the association is made with
             * nothing leaving the root. */
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var field = root.getElementById('field-0');
                    var ref = field.getAttribute('aria-labelledby');
                    return JSON.stringify({
                        role: field.getAttribute('role'),
                        ref: ref,
                        resolved: ref ? (root.getElementById(ref) || {}).textContent : null
                    });
                })()`));
            assert.equal(aria.role, 'group');
            assert.ok(aria.ref, 'the field is not labelled');
            assert.equal(aria.resolved, 'Wake Time',
                'the label element the group points at is not in the same root');
        }));

        test('a caption describes its own group', () => mounted(async (page) => {
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var root = document.getElementById('solo').shadowRoot;
                    var field = root.getElementById('field-2');
                    var ref = field.getAttribute('aria-describedby');
                    return JSON.stringify({
                        ref: ref,
                        resolved: ref ? (root.getElementById(ref) || {}).textContent : null
                    });
                })()`));
            assert.equal(aria.ref, 'cap-2');
            assert.equal(aria.resolved, 'Duration to keep machine awake after schedule starts.');
        }));

        test('a field with no label is no group at all', () => mounted(async (page) => {
            // An empty group with no name is worse than no group: it is a landmark
            // announcing nothing. The whole aria triple goes with the label.
            const aria = JSON.parse(await page.eval(`
                (function () {
                    var f = document.getElementById('plain').shadowRoot.getElementById('field-0');
                    return JSON.stringify({
                        role: f.getAttribute('role'),
                        labelledby: f.getAttribute('aria-labelledby'),
                        describedby: f.getAttribute('aria-describedby'),
                        labels: f.querySelectorAll('.label').length
                    });
                })()`));
            assert.deepEqual(aria, { role: null, labelledby: null, describedby: null, labels: 0 });
        }));

        test('the sheet writes no aria onto slotted light DOM', () => mounted(async (page) => {
            /* §7.6 T15's other symptom in the making — "aria-label on role-less divs".
             * The sheet cannot know whether what it was handed has a role to hang a
             * name on, so it supplies the visible label and the group context and
             * writes nothing. The control keeps its own name. */
            const attrs = JSON.parse(await page.eval(`
                (function () {
                    var el = document.getElementById('time-in');
                    return JSON.stringify(Array.prototype.map.call(el.attributes, function (a) {
                        return a.name;
                    }).filter(function (n) { return n.indexOf('aria-') === 0 || n === 'role'; }));
                })()`));
            assert.deepEqual(attrs, []);
        }));

        test('the visible label keeps the case the author wrote', () => mounted(async (page) => {
            // text-transform is PAINT (type-roles.js:280-282): the accessible name is
            // "Wake Time", not "WAKE TIME", however it renders.
            const text = await page.eval(
                'document.getElementById("solo").shadowRoot.getElementById("lbl-0").textContent');
            assert.equal(text, 'Wake Time');
        }));

        /* -- 7. the slot contract -------------------------------------------- */

        test('the tail slot renders after the last field', () => mounted(async (page) => {
            const lastField = await page.box('#plain >>> #field-1');
            const tail = await page.box('#tail');
            assert.ok(tail.width > 0, 'the tail content did not render');
            assert.ok(tail.top >= lastField.bottom - 0.5,
                `the tail (${tail.top}) is not after the last field (${lastField.bottom})`);
        }));

        test('each field slot places its own controls, in markup order', () => mounted(async (page) => {
            const hours = await page.box('#hours-in');
            const unit = await page.box('#hours-unit');
            const mins = await page.box('#mins-in');
            const cluster = await page.box('#solo >>> #control-2');
            for (const [name, box] of [['hours', hours], ['unit', unit], ['mins', mins]]) {
                assert.ok(box.left >= cluster.left - 0.5 && box.right <= cluster.right + 0.5,
                    `${name} is outside its own field's control area`);
            }
            assert.ok(unit.left >= hours.right - 0.5, 'the unit word is not after its field');
            assert.ok(mins.left >= unit.right - 0.5, 'the second field is not after the unit word');
        }));

        /* -- 8. the hostile document ----------------------------------------- */

        test('no outside sheet can reach the rhythm, the inset or the label type',
            () => mounted(async (page) => {
                /* HOSTILE_CSS is on the page and every declaration in it is important.
                 * Shadow DOM is the wall (A8, "the platform enforces it") — this is the
                 * assertion that the wall is the only thing being relied on. */
                const stack = await page.computed('#solo >>> #stack',
                    ['row-gap', 'padding-top', 'overflow-y', 'justify-content']);
                near(stack['row-gap'], ORACLE.stackGap, 'stack gap under hostile CSS');
                assert.equal(stack['padding-top'], '0px');
                assert.equal(stack['overflow-y'], 'visible');
                assert.notEqual(stack['justify-content'], 'flex-end');

                const label = await page.computed('#solo >>> #lbl-0',
                    ['font-size', 'font-weight', 'text-transform']);
                near(label['font-size'], ORACLE.labelSize, 'label size under hostile CSS');
                assert.equal(label['font-weight'], ORACLE.labelWeight);
                assert.equal(label['text-transform'], ORACLE.labelTransform);
            }));
    });
}

describe('ui-sheet across geometries', () => {
    test('the same container inline-size gives the same boxes at 1281 and at 1000', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            `both geometry blocks must have recorded (got ${names.join(', ')})`);
        const [first, ...rest] = names;
        for (const other of rest) {
            assert.deepEqual(
                acrossGeometries[other], acrossGeometries[first],
                'the sheet read the viewport: the same 644px container produced different ' +
                'boxes at two window sizes (§2.1 Rule 1).',
            );
        }
    });
});
