/**
 * ui-sheet-header.render.test.mjs — Gate A for component #16 (wave 2, item #16).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — eight tokens, each retargeted on :root with the rendered value
 *      asserted to move AND to land on the token, plus the oracle's literals asserted
 *      once in each theme;
 *   2. the four selection dials — this component has no selected state, so the
 *      obligation runs BOTH ways: retargeting every dial must move nothing this file
 *      paints (there is no private "selected" look to find), and a selectable control
 *      placed in the `trail` slot must still be painted by the dials, through the
 *      slot, unaltered. `assertOneSelectionTreatment` on the rig fixture is what
 *      proves the second half;
 *   3. focus geometry from --ui-focus-*, unclipped — on slotted controls, which is
 *      where every focusable in a sheet header lives, plus the inset variant, plus
 *      the --ui-hit-min floor those controls must still reach inside the row;
 *   4. container behaviour — the header reads its own container and not the viewport
 *      (identical box at both geometries for the same container), the row floor, the
 *      narrow-container ellipsis, and the INTRINSIC-SIZING slot where there is no
 *      container inline size to fill;
 *   5. the bugs, asserted dead: O13 (one name, one job — twice over), A10 (the title
 *      type cannot be re-declared from outside, and there is no slot to smuggle one
 *      in through), O1's mechanism (an outside `padding: 0` cannot reach the inset);
 *   6. the aria contract — a real heading element at the level asked for, with a
 *      documented fallback, and an accessible name that keeps the author's case.
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
    assertOneSelectionTreatment,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

/* ui-button is wave 1, delivered and stamped (waves/1/DONE.json) — item #16's row
 * names it as a dependency ("Depends on: #1, #2"), so the composition is the subject
 * here rather than a coupling to work in flight. base-fixture is the wave-0a rig
 * fixture, not a sibling builder's component: it is the only thing in the tree that
 * carries a selectionSurface-painted selected state, which class 2 needs. */
const MODULE = [
    '/src/components/ui-sheet-header.js',
    '/src/components/ui-button.js',
    '/test/fixtures/base-fixture.js',
];

/* THE THREE RULES THAT MAKE THE THREE DEFECTS, written in the LIGHT tree exactly as
 * the sheets that carry them write them, and aimed at every name Slate uses:
 *
 *   O13  slate-shell.css:2227-2232 — `#subpage-host .slate-sheet-actions` is a
 *        FOOTER: justify-content: flex-end; gap: var(--slate-space-4);
 *        margin-top: var(--slate-space-7). Loaded after the library, so it restyles
 *        every header cluster in the app.
 *   O1   slate-shell.css:961-965 — `height: 118px; padding: 0`, unscoped, later than
 *        notes-modal.css, on an element carrying .slate-sheet-header.
 *   A10  time-picker-modal.css:74-75 — `font-size: 20px; font-weight: 800`, plus
 *        notes' letter-spacing: .01em over the component's .04em.
 *
 * They are aimed at the Slate class names, at the Decal class names, and at
 * descendants of the host, so the test cannot pass merely because the names moved.
 * `!important` is used here ON PURPOSE and it is not a violation of CONVENTIONS §6:
 * this is the hostile document, not component CSS. If any of it could reach in, an
 * important declaration is what would make it reach hardest. */
const HOSTILE_CSS = `
<style>
    .slate-sheet-actions, .trail, ui-sheet-header .trail, ui-sheet-header > * {
        justify-content: flex-end !important;
        margin-top: 40px !important;
        gap: 18px !important;
    }
    .slate-sheet-header, .head, ui-sheet-header .head {
        padding: 0 !important;
        height: 118px !important;
    }
    .slate-sheet-title, .title, ui-sheet-header .title, ui-sheet-header h2 {
        font-size: 20px !important;
        font-weight: 800 !important;
        letter-spacing: 0.01em !important;
        text-transform: none !important;
    }
</style>`;

/* A slotted focusable with the base's own ring re-created in the LIGHT tree, the same
 * stand-in ui-card.render.test.mjs uses and for the same reason: `.child` inherits
 * --_ui-focus-offset from its light-tree parent (the host), `.child.resets`
 * re-declares it on itself the way a slotted UiElement's :host does. */
const RING_CSS = `
<style>
    .child:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    .resets { --_ui-focus-offset: var(--ui-focus-offset); }
    button.child { margin: 0; padding: 0 12px; border: 0; background: none; font: inherit; min-block-size: 64px; }

    /* #shrink's header is a bare flex item and therefore intrinsically sized: every
     * UiElement host carries container-type: inline-size, so it contributes zero and
     * resolves to 0 wide. That collapse is asserted deliberately on #shrink; every
     * OTHER header in this fixture is in a block container with a stated inline size,
     * so it has something to fill. */
</style>`;

const MARKUP = `${RING_CSS}
<div id="wide" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="pair" heading="Drink out">
        <button class="child" slot="trail" id="cancel" type="button">Cancel</button>
        <button class="child" slot="trail" id="confirm" type="button">Confirm</button>
    </ui-sheet-header>
</div>
<div id="wide-2" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="bare" heading="Add schedule"></ui-sheet-header>
</div>
<div id="wide-3" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="levels" heading="Set time" level="4"></ui-sheet-header>
</div>
<div id="wide-4" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="bogus" heading="Notes" level="9"></ui-sheet-header>
</div>
<div id="wide-5" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="composed" heading="Confirm">
        <ui-button slot="trail" id="ui-cancel">Cancel</ui-button>
        <ui-button slot="trail" id="ui-ok" variant="primary">Confirm</ui-button>
    </ui-sheet-header>
</div>
<div id="wide-6" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="inset" heading="Inset ring" focus-ring="inset">
        <button class="child" slot="trail" id="inset-kid" type="button">Close</button>
    </ui-sheet-header>
</div>
<div id="wide-7" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="dropped" heading="Dropped content">
        <span id="no-slot">a title of my own</span>
        <button id="footer-slot" slot="actions" type="button">OK</button>
    </ui-sheet-header>
</div>
<div id="wide-8" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="selectable" heading="Dials through the slot">
        <base-fixture id="fx" slot="trail" style="padding: 0"></base-fixture>
    </ui-sheet-header>
</div>
<div id="narrow" style="inline-size: 320px; padding: 24px">
    <ui-sheet-header id="squeezed" heading="Sleep and wake schedules for this machine">
        <button class="child" slot="trail" id="squeezed-out" type="button">Save</button>
    </ui-sheet-header>
</div>
<div id="narrow-2" style="inline-size: 320px; padding: 24px">
    <ui-sheet-header id="bare-narrow" heading="Sleep and wake schedules for this machine"></ui-sheet-header>
</div>
<div id="shrink-row" style="display: flex; align-items: flex-start; padding: 24px">
    <ui-sheet-header id="shrink" heading="Nothing to fill"></ui-sheet-header>
</div>
<!--
  NO HEADING AT ALL (c3-7). Both spellings of the empty string, because heading has an
  empty-string default: the attribute absent, and the attribute present and empty.
  Neither may put an empty h1-h6 in the accessibility tree.
-->
<div id="wide-9" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="untitled">
        <button class="child" slot="trail" id="untitled-out" type="button">Close</button>
    </ui-sheet-header>
</div>
<div id="wide-10" style="inline-size: 680px; padding: 24px">
    <ui-sheet-header id="empty-title" heading="">
        <button class="child" slot="trail" id="empty-out" type="button">Close</button>
    </ui-sheet-header>
</div>
`;

/* The oracle's own numbers, named once.
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] font-size =
 *        28px  <-  slate-shell.css  `#subpage-host #settings-content-area :is(h1, h2,
 *        h3, h4), ...`  authored `var(--slate-text-xl)`  !important=yes (token-driven)
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] font-weight =
 *        500  <-  same rule, authored `500`  !important=yes  (FROZEN/hardcoded)
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] text-transform
 *        = uppercase  <-  slate-components.css  `.slate-sheet-title`  authored
 *        `uppercase`  !important=no  (FROZEN/hardcoded)
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] letter-spacing
 *        = 1.12px  <-  slate-components.css  `.slate-sheet-title`  authored `0.04em`
 *        !important=no  (a LITERAL, not the token)
 *        SLATE-INCONSISTENT, and this is one of only two elements in the 49 baseline
 *        states that render .04em. Slate declares `--slate-tracking-cap: .12em` and
 *        then hand-writes .08em on the live status chip, .04em here, .01em in
 *        notes-modal and slate-shell, and .11/.09/.08/.06/.03/.02em across the editor.
 *        Rendered census: .12em on 190 elements against .04em on 2.
 *        Decal draws every uppercase title through ONE token, and the value is
 *        Slate's own declared .12em — its majority and the Live page's own microcap
 *        value, which is the tie-break Ben set. So this title tracks 3.36px at 28px
 *        rather than the oracle's 1.12px, and it now agrees with every other uppercase
 *        title in the skin instead of being one of two exceptions.
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] color: dark
 *        rgb(244, 247, 248) / light rgb(23, 26, 28)  <-  slate-shell.css
 *        `#subpage-host #settings-content-area :is(h1, h2, h3, h4), ...`  authored
 *        `var(--slate-text)`  !important=yes
 *   CITE modal-numpad #numpad-modal-title [i=167] color: dark rgb(244, 247, 248) /
 *        light rgb(23, 26, 28)  <-  numpad-modal.css, authored `var(--slate-text)`
 *
 * The row geometry has NO oracle answer — `prov_query.py find --cls
 * slate-sheet-header` returns "0 elements matched anywhere in this corpus", as do
 * slate-sheet-actions, numpad-modal-header, tpm-header and notes-modal-header — so
 * these four are read-only source reads of slate-components.css:665-695 with
 * slate-tokens.css:30/117/118/119 substituted.
 */
const ORACLE = {
    titleSize: 28,
    titleWeight: '500',
    titleTransform: 'uppercase',
    titleTracking: 3.36,    // ONE token, .12em x 28px (parity surface 0; see the CITE above)
    ink: { dark: 'rgb(244, 247, 248)', light: 'rgb(23, 26, 28)' },
    rowFloor: 64,      // slate-components.css:670 min-height: var(--slate-control-height)
    rowInset: 18,      // :671 padding-bottom: var(--slate-space-4)
    titleGap: 24,      // :669 gap: var(--slate-space-5)
    clusterGap: 12,    // :693 gap: var(--slate-space-3)
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
    describe(`ui-sheet-header @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-sheet-header must mount without throwing');
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

        test('every measured header has a container to fill', () => mounted(async (page) => {
            // A GUARD ON THE FIXTURE ITSELF. Each header below sits in a block box with
            // a stated inline-size; if one ever loses it, the host collapses (see
            // #shrink) and every geometric assertion silently measures a 0-wide row.
            for (const id of ['pair', 'bare', 'levels', 'bogus', 'composed', 'dropped']) {
                const host = await page.box(`#${id}`);
                assert.ok(host.width > 400, `#${id} is in a collapsed slot: ${host.width}px`);
            }
        }));

        /* -- 1. tokens are consumed, not copied ------------------------------ */

        test('drill: --ui-text-xl is the title size', () => mounted(async (page) => {
            // ORACLE settings-machine-sleep---wake-schedules .slate-heading [i=74]
            //        font-size = 28px <- authored var(--slate-text-xl)
            await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: DRILL_LENGTH,
                selector: '#pair >>> #title',
                property: 'font-size',
            });
        }));

        test('drill: --ui-weight-medium is the title weight', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-weight-medium',
                value: '900',
                selector: '#pair >>> #title',
                property: 'font-weight',
            });
        }));

        test('drill: --ui-tracking-cap is the title tracking', () => mounted(async (page) => {
            // ORACLE ... letter-spacing = 1.12px <- slate-components.css
            //        `.slate-sheet-title` authored `0.04em` as a LITERAL. The title now
            //        reads --ui-tracking-cap (.12em) like every other uppercase title;
            //        the drill is what proves it is the token and not a second literal.
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap',
                value: DRILL_LENGTH,
                selector: '#pair >>> #title',
                property: 'letter-spacing',
            });
        }));

        test('drill: --ui-text is the title ink', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#pair >>> #title',
                property: 'color',
            });
        }));

        test('drill: --ui-control-h is the row floor', () => mounted(async (page) => {
            // slate-components.css:670 `min-height: var(--slate-control-height)`.
            // The floor is a token and not a literal, which is the half bug P4's class
            // is about: a hard-coded box cannot move when the token does.
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'min-height',
            });
        }));

        test('drill: --ui-space-4 is the bottom inset', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'padding-bottom',
            });
        }));

        test('drill: --ui-space-5 is the gap to the cluster', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: DRILL_LENGTH,
                selector: '#pair >>> #head',
                property: 'column-gap',
            });
        }));

        test('drill: --ui-space-3 is the gap inside the cluster', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                selector: '#pair >>> #trail',
                property: 'column-gap',
            });
        }));

        test('the oracle values render, in both themes', () => mounted(async (page) => {
            const type = await page.computed('#pair >>> #title',
                ['font-size', 'font-weight', 'text-transform', 'letter-spacing']);
            near(type['font-size'], ORACLE.titleSize, 'title font-size');
            assert.equal(type['font-weight'], ORACLE.titleWeight);
            assert.equal(type['text-transform'], ORACLE.titleTransform);
            near(type['letter-spacing'], ORACLE.titleTracking, 'title letter-spacing', 0.02);

            const geom = await page.computed('#pair >>> #head',
                ['min-height', 'padding-bottom', 'column-gap']);
            near(geom['min-height'], ORACLE.rowFloor, 'row floor');
            near(geom['padding-bottom'], ORACLE.rowInset, 'bottom inset');
            near(geom['column-gap'], ORACLE.titleGap, 'gap to the cluster');
            near(await page.prop('#pair >>> #trail', 'column-gap'),
                ORACLE.clusterGap, 'gap inside the cluster');

            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                assert.equal(
                    await page.prop('#pair >>> #title', 'color'), ORACLE.ink[theme],
                    `title ink in ${theme}`,
                );
            }
        }));

        /* -- 2. the four selection dials ------------------------------------- */

        test('wave law: no dial reaches anything this component paints', () => mounted(async (page) => {
            /* THE NEGATIVE HALF OF CROSS-8. A sheet header has no selected state, so
             * the obligation is to prove there is no private "selected" look hiding in
             * it — the defect that started the audit was thirteen components with six
             * treatments, and a treatment nobody asked for is how the seventh arrives.
             * Every dial is moved to a value no palette would pick; nothing this file
             * paints may notice. */
            const parts = ['#pair >>> #head', '#pair >>> #title', '#pair >>> #trail'];
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
                        'no selected state, so nothing in it may read a dial ' +
                        '(wave 2 law, CONVENTIONS §4).',
                    );
                }
            } finally {
                for (const t of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) await page.setToken(t, null);
            }
        }));

        test('a selectable control in the trail slot is still painted by the four dials',
            () => mounted(async (page) => {
                /* THE POSITIVE HALF. The one selection treatment has to survive being
                 * slotted into another component — a favourites bank, a tab bank or a
                 * segmented pick in a sheet header is exactly what #36/#37/#32 will
                 * do. The subject is the rig fixture's selectionSurface-painted pair,
                 * measured THROUGH this component's slot. */
                await assertOneSelectionTreatment(page, {
                    selected: '#fx >>> #tab',
                    unselected: '#fx >>> #tab-off',
                });
            }));

        /* -- 3. focus geometry, unclipped ------------------------------------ */

        test('a slotted control keeps the one ring, unclipped', () => mounted(async (page) => {
            // L24's class: "focus rings clipped on all four sides by the components
            // they sit inside". The header declares no overflow on the row or on the
            // cluster, so a 64px control's outset ring has room on every side.
            await assertFocusUnclipped(page, '#cancel');
            await assertFocusUnclipped(page, '#confirm');
        }));

        test('a composed ui-button keeps its own ring through the slot', () => mounted(async (page) => {
            // #1 is a real UiElement: its ring is declared on its own host and the
            // header neither doubles it nor blanks it (CONVENTIONS §3a).
            await assertFocusUnclipped(page, '#ui-ok >>> button');
        }));

        test('the header does not squeeze a slotted control below the hit floor',
            () => mounted(async (page) => {
                /* Appendix 5 / CONVENTIONS §5: --ui-hit-min is 48px because "a wet
                 * fingertip is about 9 mm; at this panel's density that is ~48px".
                 * The header owns no hit area of its own — every focusable in it is
                 * slotted — but a row that constrained its children would take the
                 * floor away from a component that has it, which is bug P4's and L22's
                 * shape one level up. align-items: center on the row is what keeps a
                 * control at its own height rather than stretching or shrinking it. */
                await assertHitFloor(page, '#ui-ok >>> button', { mode: 'box' });
                await assertHitFloor(page, '#ui-cancel >>> button', { mode: 'box' });
            }));

        test('focus-ring="inset" on the host reaches a slotted child', () => mounted(async (page) => {
            // One treatment, two offsets. The private property inherits from the host
            // through the flattened tree, so a consumer whose sheet clips can switch
            // the whole header without a second ring being authored anywhere.
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            const outset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
            assert.notEqual(inset, outset, 'the two offsets must differ for this to prove anything');

            await page.focusVisible('#inset-kid');
            assert.equal(await page.prop('#inset-kid', 'outline-offset'), inset);

            await page.focusVisible('#cancel');
            assert.equal(await page.prop('#cancel', 'outline-offset'), outset);
        }));

        /* -- 4. container behaviour ------------------------------------------ */

        test('the header fills its container and reads no viewport', () => mounted(async (page) => {
            const host = await page.box('#pair');
            const holder = await page.box('#wide');
            near(host.width, holder.width - 48, 'the header fills its 680px container');
            acrossGeometries[geometry.name] = {
                host: Math.round(host.width * 10) / 10,
                row: Math.round((await page.box('#pair >>> #head')).height * 10) / 10,
                narrowTrail: Math.round((await page.box('#squeezed-out')).width * 10) / 10,
            };
        }));

        test('the row floor holds, and only when nothing taller is in it', () => mounted(async (page) => {
            // slate-components.css:665-671 — box-sizing: border-box, so the floor is
            // the WHOLE band including its 18px inset, exactly as Slate renders it.
            // A title-only header is therefore 64px, not 64 + 18.
            const bare = await page.box('#bare >>> #head');
            near(bare.height, ORACLE.rowFloor, 'a title-only row sits on the floor');

            // With 64px controls in the cluster the row grows by the inset instead of
            // clipping them — the floor is a minimum, never a cap.
            const pair = await page.box('#pair >>> #head');
            assert.ok(
                pair.height >= ORACLE.rowFloor + ORACLE.rowInset - 0.5,
                `a row holding 64px controls is ${pair.height}px; expected at least ` +
                `${ORACLE.rowFloor + ORACLE.rowInset}px (control + inset)`,
            );
        }));

        test('an empty cluster takes no space at all (departure 4)', () => mounted(async (page) => {
            /* Slate keeps .slate-sheet-actions in the markup always, so a title-only
             * header pays the 24px flex gap for a cluster with nothing in it. The cost
             * is only visible where width is scarce, so it is measured where it bites:
             * a long title in a 320px container, which fills every pixel the row will
             * give it. Removing the cluster from layout and putting it back is a 24px
             * difference in the title's box — --ui-space-5, exactly. */
            assert.equal(await page.prop('#bare-narrow >>> #trail', 'display'), 'none');

            const host = await page.box('#bare-narrow');
            const withoutIt = await page.box('#bare-narrow >>> #title');
            near(withoutIt.width, host.width, 'the title has the whole row', 1);

            await page.setStyle('#bare-narrow >>> #trail', { display: 'flex' });
            const withIt = await page.box('#bare-narrow >>> #title');
            await page.setStyle('#bare-narrow >>> #trail', { display: null });

            near(withoutIt.width - withIt.width, ORACLE.titleGap,
                'an empty cluster in the layout costs the title exactly the flex gap', 1);
        }));

        test('in a narrow container the title gives way and the way out does not',
            () => mounted(async (page) => {
                /* Departure 5, and Slate's own behaviour: min-width 0 + nowrap +
                 * ellipsis on the title, flex-shrink 0 on the cluster. The audit's
                 * H3 is the opposite failure on another header — "720px of tab bank
                 * pinned flex: 0 0 … so the shot pickers collapse before the tabs
                 * give up a pixel" — and this is the arrangement that avoids it. */
                const title = await page.metrics('#squeezed >>> #title');
                assert.ok(
                    title.scrollWidth > title.clientWidth + 0.5,
                    `the long title is not actually overflowing (${title.scrollWidth} vs ` +
                    `${title.clientWidth}) — the assertion would pass vacuously`,
                );
                const style = await page.computed('#squeezed >>> #title',
                    ['text-overflow', 'white-space', 'overflow-x']);
                assert.equal(style['text-overflow'], 'ellipsis');
                assert.equal(style['white-space'], 'nowrap');

                // The cluster is whole and inside the header's own box.
                const host = await page.box('#squeezed');
                const trail = await page.box('#squeezed-out');
                assert.ok(
                    trail.right <= host.right + 0.5 && trail.left >= host.left - 0.5,
                    `the cluster is outside the header box: cluster ${trail.left}→${trail.right}, ` +
                    `header ${host.left}→${host.right}`,
                );
                assert.ok(trail.width > 40, `the cluster was squeezed to ${trail.width}px`);
            }));

        test('an INTRINSIC-SIZING slot leaves the header nothing to fill', () => mounted(async (page) => {
            /* Stated rather than defended against, the same as ui-card.js:104-124. The
             * base puts container-type: inline-size on every host, so a bare flex item
             * contributes zero and the host resolves to 0 wide. The remedy is one
             * declaration at the call site. It is asserted so the fixture can never
             * quietly start measuring the collapsed box somewhere else. */
            const host = await page.box('#shrink');
            assert.ok(host.width < 1, `expected a collapsed host, measured ${host.width}px`);

            await page.setStyle('#shrink', { flex: '1 1 0' });
            const fixed = await page.box('#shrink');
            assert.ok(fixed.width > 400,
                `one declaration at the call site should fix it; measured ${fixed.width}px`);
            await page.setStyle('#shrink', { flex: null });
        }));

        /* -- 5. the bugs ------------------------------------------------------ */

        test('O13: the cluster has one name and it is not "actions"', () => mounted(async (page) => {
            /* §7.7 O13: ".slate-sheet-actions means two different things — a header
             * cluster in the library, a dialog footer in the shell". The repair the row
             * asks for is two jobs, two names. `actions` belongs to the dialog footer
             * (SCOPE.md:1591; spec §4.6's skeleton at LAYOUT_SPEC_DRAFT.md:809-813),
             * so a child sent to `actions` here is assigned to no slot and is not
             * rendered at all — a zero box, not a mis-placed one. */
            const trailBox = await page.box('#cancel');
            assert.ok(trailBox.width > 0 && trailBox.height > 0,
                'a child in the trail slot must render');

            const footer = await page.box('#footer-slot');
            assert.ok(
                footer.width === 0 && footer.height === 0,
                `slot="actions" rendered a ${footer.width}x${footer.height} box — this ` +
                'component must not answer to the dialog footer\'s name (O13).',
            );

            const slots = await page.evalFn(() => [...document.getElementById('pair')
                .shadowRoot.querySelectorAll('slot')].map((s) => s.name));
            assert.deepEqual(slots, ['trail'],
                'exactly one named slot, so there is no second cluster to confuse with a footer');
        }));

        test('O13: the shell\'s footer rule cannot reach the header cluster',
            () => mounted(async (page) => {
                /* The mechanism half, and the one that cannot decay: the shell's three
                 * footer declarations are aimed at every name Slate and Decal use,
                 * with !important, from the document — the outermost tree. None of
                 * them can name a class inside this root. */
                const clean = await page.computed('#pair >>> #trail',
                    ['justify-content', 'margin-top', 'column-gap']);
                await page.evalFn((css) => {
                    document.body.insertAdjacentHTML('beforeend', css);
                }, HOSTILE_CSS);
                await page.settle(2);

                assert.deepEqual(
                    await page.computed('#pair >>> #trail',
                        ['justify-content', 'margin-top', 'column-gap']),
                    clean,
                    'slate-shell.css:2227-2232 reached the header cluster — O13 is alive',
                );
                near(clean['column-gap'], ORACLE.clusterGap, 'the cluster gap is the library\'s');
                assert.equal(clean['margin-top'], '0px');
            }));

        test('O1: an outside `padding: 0` cannot reach the inset', () => mounted(async (page) => {
            /* §7.7 O1: "slate-shell.css silently re-imposes the 118px notes header
             * that notes-modal.css deleted, and kills the shared header's bottom
             * padding — the fix landed in one file and was reverted by another."
             * The inset is on .head inside this root; the host's own height is the
             * consumer's business and stays theirs. */
            await page.evalFn((css) => {
                document.body.insertAdjacentHTML('beforeend', css);
            }, HOSTILE_CSS);
            await page.settle(2);

            near(await page.prop('#pair >>> #head', 'padding-bottom'),
                ORACLE.rowInset, 'the shared inset survived the shell rule');
            near(await page.prop('#pair >>> #head', 'min-height'),
                ORACLE.rowFloor, 'the row floor survived the shell rule');
        }));

        test('A10: the title type cannot be re-declared from outside', () => mounted(async (page) => {
            /* layout/overlays.md A10: "every one of its three consumers re-declares
             * the title type, and one of them diverges … time picker: 20px / 800 — a
             * different title entirely. So the 'one shared header' still renders two
             * title treatments across three dialogs." */
            await page.evalFn((css) => {
                document.body.insertAdjacentHTML('beforeend', css);
            }, HOSTILE_CSS);
            await page.settle(2);

            const type = await page.computed('#pair >>> #title',
                ['font-size', 'font-weight', 'letter-spacing', 'text-transform']);
            near(type['font-size'], ORACLE.titleSize, 'the time picker\'s 20px reached the title');
            assert.equal(type['font-weight'], ORACLE.titleWeight,
                'the time picker\'s 800 reached the title');
            near(type['letter-spacing'], ORACLE.titleTracking,
                'the notes editor\'s .01em reached the title', 0.02);
            assert.equal(type['text-transform'], ORACLE.titleTransform);
        }));

        test('A10: there is no slot to hang a second title treatment on', () => mounted(async (page) => {
            /* The enforcement half. The title is a string property, so a consumer
             * cannot supply its own element for a document rule to style — a child
             * with no slot attribute is assigned nowhere and renders nothing. */
            const smuggled = await page.box('#no-slot');
            assert.ok(
                smuggled.width === 0 && smuggled.height === 0,
                `unslotted light content rendered a ${smuggled.width}x${smuggled.height} box; ` +
                'the title must be the component\'s and only the component\'s',
            );
            const named = await page.evalFn(() => [...document.getElementById('dropped')
                .shadowRoot.querySelectorAll('slot')].filter((s) => !s.name).length);
            assert.equal(named, 0, 'a default slot would re-open A10');
        }));

        /* -- 6. the aria contract -------------------------------------------- */

        test('the title is a real heading at the level asked for', () => mounted(async (page) => {
            /* Departure 2. Two of Slate's four sheet titles are <span>s
             * (time-picker-modal.js:137, notes-modal.js:54), so half the dialogs
             * announce their title as ordinary text. TYPE_ROLES.md rule 2: "A heading
             * is structure, and a screen reader reads <h2>". */
            const tags = await page.evalFn(() => ['pair', 'levels', 'bogus'].map(
                (id) => document.getElementById(id).shadowRoot.querySelector('#title').tagName,
            ));
            assert.deepEqual(tags, ['H2', 'H4', 'H2'],
                'default 2, the level asked for, and a documented fallback for level="9"');
            assert.equal(await page.evalFn(() => document.getElementById('bogus').level), 2,
                'an out-of-range level normalises to the default rather than rendering a non-heading');
        }));

        test('an EMPTY heading renders no heading element at all', () => mounted(async (page) => {
            /* Wave-2 review c3-7. `heading` defaults to '' and every level rendered
             * anyway, so a header built without a title announced an EMPTY h2 — a
             * heading with nothing in it, which is departure 2's own defect seen from
             * the other side. The test is #31's, byte for byte (ui-page-header.js:463,
             * `const titled = Boolean(this.heading)`), so the wave's two headers answer
             * the empty string identically instead of each inventing a rule.
             *
             * Asserted on the WHOLE root, not on `#title`: an assertion that only
             * `#title` is absent would still pass if the element came back under
             * another id, and it is the h1…h6 in the accessibility tree that is the
             * defect. */
            const headings = await page.evalFn(() => ['untitled', 'empty-title'].map(
                (id) => document.getElementById(id).shadowRoot
                    .querySelectorAll('h1, h2, h3, h4, h5, h6').length,
            ));
            assert.deepEqual(headings, [0, 0],
                'an empty heading must not put an empty h1…h6 in the accessibility tree');

            /* The cluster is still there and still measurable — a cluster-only header
             * is a real shape (a sheet whose one control is the way out), not a
             * degenerate one, and the row floor is unaffected. */
            assert.equal(await page.prop('#untitled >>> #trail', 'display'), 'flex');
            const row = await page.box('#untitled >>> #head');
            assert.ok(row.height >= ORACLE.rowFloor - 0.5,
                `the row floor is gone without a title: ${row.height}px`);

            /* AND IT STAYS THE WAY OUT — at the TRAILING edge, not the leading one.
             * `justify-content: space-between` alone does not survive the removal: with
             * a title it holds the cluster right because there are two items, and with
             * ONE item it puts that item at the START. The empty <h2> was accidentally
             * doing this job, so deleting it moved every cluster-only header's control
             * to the left. `.trail { margin-inline-start: auto }` does it on purpose and
             * changes nothing in the titled case (an auto margin absorbs the same free
             * space space-between distributes). */
            const trail = await page.box('#untitled >>> #trail');
            near(trail.x + trail.width, row.x + row.width,
                'the way out must sit at the trailing edge of a title-less row', 1);

            /* THE CONVERSE, so the guard cannot go vacuous: give it a title and the
             * heading appears, at the level asked for. */
            const after = await page.evalFn(async () => {
                const el = document.getElementById('untitled');
                el.heading = 'Later';
                await el.updateComplete;
                const h = el.shadowRoot.querySelector('#title');
                return [h.tagName, h.textContent];
            });
            assert.deepEqual(after, ['H2', 'Later']);
        }));

        test('the accessible name keeps the case the author wrote', () => mounted(async (page) => {
            /* slate-components.css:679-681, carried: "Capitals belong to the type, not
             * the string: typed in, they were an English-only effect." text-transform
             * is paint; the accessibility tree reads the text node. */
            const text = await page.evalFn(() => document.getElementById('pair')
                .shadowRoot.querySelector('#title').textContent);
            assert.equal(text, 'Drink out');
            assert.equal(await page.prop('#pair >>> #title', 'text-transform'), 'uppercase');
        }));

        test('the cluster appears and disappears with its content', () => mounted(async (page) => {
            /* Filled is defined on ELEMENTS, not on text: a close button whose label
             * is a glyph carries no text, and counting text would hide the way out of
             * any dialog. slotchange alone covers this, because adding or removing a
             * child re-runs assignment. */
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'none');
            await page.evalFn(() => {
                const b = document.createElement('button');
                b.id = 'late';
                b.setAttribute('slot', 'trail');
                b.textContent = 'Later';
                document.getElementById('bare').append(b);
            });
            await page.settle(2);
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'flex');

            await page.evalFn(() => document.getElementById('late').remove());
            await page.settle(2);
            assert.equal(await page.prop('#bare >>> #trail', 'display'), 'none');
        }));
    });
}

describe('ui-sheet-header across geometries', () => {
    test('the same container renders the same header at both geometries', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have recorded their measurements');
        const [a, b] = names.map((n) => acrossGeometries[n]);
        assert.deepEqual(a, b,
            'the header changed with the VIEWPORT rather than with its container ' +
            '(spec §2.1 Rule 1) — there is no @media in this component and there must ' +
            `not be: ${JSON.stringify(acrossGeometries)}`);
    });
});
