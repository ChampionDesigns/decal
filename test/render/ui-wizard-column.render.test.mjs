/**
 * ui-wizard-column.render.test.mjs — Wave 4 item #39's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles, box geometry and behaviour, never
 * source text, at BOTH standard geometries — 1281x801 @ dsf 1.5 and the 1000x600 floor
 * (CONVENTIONS §10, Part 8 §2).
 *
 * WHAT THIS SUITE IS REALLY FOR. Row #39 carries one bug id, and it is a bug about a
 * NUMBER THAT IS NOT THERE:
 *
 *   T1 (§7.5) — "The load-cell wizard is 63px wider than every other leaf — measured
 *   1263 against 1200, right edge 1892 against 1829 on all 37 others. The comment says
 *   the LEFT edge was fixed so paging no longer jolts; the right edge still jumps."
 *   (`slate-shell.css:2290-2295` vs `:1285-1288`)
 *
 * The oracle has both halves of that measurement, and they came out of prov_query rather
 * than out of the bug list:
 *   CITE `prov_query.py find --cls slate-cal-step-label` -> found 1 element in 1 state:
 *        settings-calibration-load-cells .text-[24px] [i=50] rect x=629 y=321 w=1263 h=27
 *   CITE `prov_query.py find --cls slate-cal-card` -> settings-calibration-load-cells
 *        .slate-card [i=51] rect x=629 y=384 w=760 h=296
 * — a leaf 63px wider than the 1200px cap, with a card 440px narrower than the leaf
 * inside it. Two of T21's three undocumented live measures, in one screen.
 *
 * A defect of omission cannot be tested by looking for its absence in the source, so §4
 * measures the CONSEQUENCE instead: the wizard's rendered inline size against a sibling
 * leaf's, in the same stage, at two stage widths, at both geometries — plus
 * `max-inline-size` on every box in the column, host and slotted card included, because
 * a single cap anywhere is how 1263 and 760 both happened.
 *
 * The other four sections are the standing assertions in the shapes this component makes
 * them take:
 *   §2  THE DIALS. The chips are selection-family members (SCOPE.md:1577 names #39 in the
 *       list that may not own a private selected look), and the dials are not a stand-in
 *       for Slate's paint — they ARE Slate's paint:
 *         CITE settings-calibration-load-cells .rounded-full [i=46] background-color =
 *              rgb(176, 196, 206)   (--slate-steel)
 *         CITE settings-calibration-load-cells .rounded-full [i=46] color =
 *              rgb(18, 24, 28)  <- <inline> authored `var(--slate-on-steel)`
 *       against shipped dials of --ui-steel / --ui-on-steel (`styles/tokens.css:834-835` dark / `:903-904` light),
 *       whose dark values are #b0c4ce and #12181c. Same pixels, reachable by a fork.
 *   §5  THE CONTAINER FLOOR. 44x44 is a touch floor (spec §2.3 case 2, §2.2 row 1: "never
 *       fluid"), so the chip is the thing that must NOT respond; the strip wraps, and
 *       below one whole chip+connector unit it overflows visibly rather than clip. The
 *       suite squeezes the stage to 320px, to the stated 92px floor and below it, and
 *       measures what moved.
 *   §6  FOCUS, UNCLIPPED — bug L24's class, on the slotted buttons, because a wizard's
 *       only focusables are slotted and a component with an overflow: hidden anywhere in
 *       the column would clip their rings.
 *   §7  ARIA per Appendix 15 ("the aria-*-driven state selectors … the right contract for
 *       a Lit component's reflected properties").
 *
 * Slate's rects are frozen 1920x1200 captures, quoted as what Slate does and never as a
 * responsive target — LAYOUT_SPEC_DRAFT.md governs responsive behaviour and the oracle
 * has no vote there (Part 10 §4). Colours are asserted against resolved tokens, never
 * hexes, so every assertion is true in both themes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-wizard-column.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
} from '../harness/assertions.js';

const MODULES = [
    '/src/components/ui-wizard-column.js',
    '/src/components/ui-card.js',
    '/src/components/ui-button.js',
];

/* Slate's own four steps (`settings.js:4867`, read-only). They are DATA — what the
 * machine's calibration walk does — passed in by the screen, not strings the component
 * owns. */
const STEPS = JSON.stringify(['Zero', 'Left cell', 'Right cell', 'Verify']);

/** The stage's stated width, so every measured box is the CONTAINER's answer and not the
 *  viewport's — the two geometries must produce identical numbers (spec §2.1 Rule 1). */
const STAGE_W = 720;

/**
 * The wizard mid-walk (two steps behind, one current, one ahead) beside a REFERENCE LEAF
 * in the same stage. The reference is what T1 is a difference from: in Slate every one of
 * the other 37 leaves is capped at 1200 and the wizard is not, so the assertion is a
 * comparison and not a magic number.
 */
const MARKUP = `
    <style>
      /* border-box stated here, not assumed: styles/document.css declares no global
         box-sizing, so the stage's content width is ${STAGE_W} - 2*24 = ${STAGE_W - 48}. */
      #stage { box-sizing: border-box; inline-size: ${STAGE_W}px; padding: 24px;
               display: grid; gap: 24px; }
      #leaf  { min-block-size: 40px; }
    </style>
    <div id="stage">
      <ui-wizard-column id="walk" label="Load cell calibration steps"
                        steps='${STEPS}' current="3">
        <ui-card id="body">Place the calibration weight over the RIGHT cell.</ui-card>
        <ui-button id="go" slot="actions" variant="primary">Calibrate</ui-button>
        <button id="bare" slot="actions">Start over</button>
      </ui-wizard-column>
      <div id="leaf">every other leaf</div>
    </div>`;

/** The same walk with nothing slotted into actions — the F3 hole (Q1), as a state. */
const NO_ACTIONS = `
    <style> #stage { box-sizing: border-box; inline-size: ${STAGE_W}px; padding: 24px; } </style>
    <div id="stage">
      <ui-wizard-column id="walk" label="Load cell calibration steps"
                        steps='${STEPS}' current="4">
        <ui-card id="body">Calibration complete.</ui-card>
      </ui-wizard-column>
    </div>`;

const chip = (n) => `#walk >>> #chip-${n}`;
const rule = (n) => `#walk >>> #rule-${n}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Every chip's state, read from inside the component in one round trip. */
const CHIPS = `(${(() => {
    const root = document.getElementById('walk').shadowRoot;
    return [...root.querySelectorAll('.chip')].map((el) => ({
        id: el.id,
        classes: el.className,
        current: el.getAttribute('aria-current'),
        pressed: el.getAttribute('aria-pressed'),
        selected: el.getAttribute('aria-selected'),
        checked: el.getAttribute('aria-checked'),
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        glyph: el.querySelector('.glyph')?.textContent.trim(),
        glyphHidden: el.querySelector('.glyph')?.getAttribute('aria-hidden'),
    }));
}).toString()})()`;

/** Where each chip sits, for the wrap assertions. */
const CHIP_RECTS = `(${(() => {
    const root = document.getElementById('walk').shadowRoot;
    return [...root.querySelectorAll('.chip')].map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.id, x: r.left, y: r.top, w: r.width, h: r.height };
    });
}).toString()})()`;

/** Anything in the column that could cap the width, host and slotted card included. */
const CAPS = `(${(() => {
    const host = document.getElementById('walk');
    const out = [{ where: 'host', max: getComputedStyle(host).maxInlineSize }];
    for (const el of host.shadowRoot.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        out.push({
            where: el.id || el.className || el.tagName.toLowerCase(),
            max: cs.maxInlineSize,
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
        });
    }
    for (const el of host.children) {
        out.push({ where: `slotted:${el.id || el.tagName.toLowerCase()}`, max: getComputedStyle(el).maxInlineSize });
    }
    return out;
}).toString()})()`;

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-wizard-column @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULES);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.equal(env.dpr, geometry.deviceScaleFactor);
            assert.equal(env.w, geometry.width);
        }));

        /* ===================================================================
         * 1. THE MEASURED CHIP — 44x44, square, --ui-text-md
         * =================================================================== */

        test('the chips are 44x44, and the number is --ui-control-sm', () => mounted(async (page) => {
            /* CITE `prov_query.py find --cls rounded-full` -> settings-calibration-
             * load-cells, 4 elements: [629,259,44,44] [733,259,44,44] [837,259,44,44]
             * [941,259,44,44] — the real chips, against the dead [data-wizard-step] rule
             * that sizes them var(--slate-control-height) = 64 (BUG-6/T6: "the load-cell
             * step chips are div.rounded-full…, measured 44x44, not 64"). Spec §3.1's
             * --ui-control-sm row cites this very measurement. */
            const floor = parseFloat(await page.resolveToken('--ui-control-sm', 'width'));
            near(floor, 44, '--ui-control-sm');

            const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
            assert.equal(rects.length, 4, 'four steps, four chips');
            for (const r of rects) {
                near(r.w, 44, `${r.id} inline size`);
                near(r.h, 44, `${r.id} block size`);
            }
            /* One row at 720px: same y, ascending x. */
            assert.equal(new Set(rects.map((r) => Math.round(r.y))).size, 1,
                'at a 720px column the strip is one row');
        }));

        test('the chips are squares with --ui-radius corners, not the discs the class says',
            () => mounted(async (page) => {
                /* CITE settings-calibration-load-cells .rounded-full [i=46]
                 * border-top-left-radius = 6px  <-  slate-shell.css
                 * `#subpage-host [class*="rounded-full"]:not(.slate-keep-round)…`
                 * !important=yes (token-driven) — the shell hands every rounded-full in
                 * settings --slate-radius, so the authored Tailwind class never renders.
                 * 6px is --ui-radius. Matching the CLASS instead of the RENDER would have
                 * shipped a disc Slate does not draw. */
                const want = await page.resolveToken('--ui-radius', 'border-top-left-radius');
                const got = await page.computed(chip(3), ['border-top-left-radius', 'border-bottom-right-radius']);
                assert.equal(got['border-top-left-radius'], want);
                assert.equal(got['border-bottom-right-radius'], want);
            }));

        test('the glyph and the caption are the measured type roles', () => mounted(async (page) => {
            /* CITE settings-calibration-load-cells .rounded-full [i=46] font-size = 18px
             *      <- slate-shell.css `[class*="text-[22px]"]` authored
             *      `var(--slate-text-md)` !important=yes — the authored 22px never renders
             * CITE settings-calibration-load-cells .rounded-full [i=46] font-weight = 500
             *      <- slate-shell.css `[class*="font-bold"]` authored `500` !important=yes
             * CITE settings-calibration-load-cells .text-[24px] [i=50] font-size = 18px,
             *      color = rgb(148, 161, 169) (--slate-muted), font-weight = 400 */
            const md = await page.resolveToken('--ui-text-md', 'font-size');
            const muted = await page.resolveToken('--ui-muted', 'color');
            const medium = await page.tokenValue('--ui-weight-medium');
            const regular = await page.tokenValue('--ui-weight-regular');

            const chipStyle = await page.computed(chip(3), ['font-size', 'font-weight']);
            assert.equal(chipStyle['font-size'], md, 'the chip glyph is --ui-text-md');
            assert.equal(chipStyle['font-weight'], medium.trim(), 'the chip glyph is --ui-weight-medium');

            const caption = await page.computed('#walk >>> #caption', ['font-size', 'color', 'font-weight']);
            assert.equal(caption['font-size'], md, 'the caption is --ui-text-md');
            assert.equal(caption.color, muted, 'the caption is --ui-muted');
            assert.equal(caption['font-weight'], regular.trim(), 'the caption is --ui-weight-regular');
        }));

        test('the caption reads "Step 3 of 4 · Right cell", from the shared string table',
            () => mounted(async (page) => {
                /* Slate's own key and separator (`settings.js:4888-4890`), which
                 * `i18n/en.json:446` already carries: "Step {n} of {total}". D2 — one
                 * table, no component-local strings. */
                const text = await page.eval(
                    'document.getElementById("walk").shadowRoot.getElementById("caption")'
                    + '.textContent.replace(/\\s+/g, " ").trim()',
                );
                assert.equal(text, 'Step 3 of 4·Right cell');
            }));

        /* ===================================================================
         * 2. THE FOUR DIALS — the chips are selection-family members
         * =================================================================== */

        test('SELECTION: the current chip is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                /* SCOPE Part 4's founding-defect callout (SCOPE.md:1577): "the wizard
                 * chips in #39 … are all expressed through #3 or its four
                 * --slate-selected-* dials". This is the whole-shape assertion: face, ink,
                 * LED and glow all move with their dial, and the ahead chip does not. */
                const measured = await assertOneSelectionTreatment(page, {
                    selected: chip(3),
                    unselected: chip(4),
                });

                /* And the dials land on SLATE'S OWN PIXELS, which is the point of taking
                 * this route rather than inventing a look:
                 *   CITE …[i=46] background-color = rgb(176, 196, 206)  (--slate-steel)
                 *   CITE …[i=46] color = rgb(18, 24, 28)   (var(--slate-on-steel)) */
                const steel = await page.resolveToken('--ui-steel', 'background-color');
                const onSteel = await page.resolveToken('--ui-on-steel', 'color');
                assert.equal(measured.face, steel, '--ui-selected-face ships as --ui-steel');
                assert.equal(measured.ink, onSteel, '--ui-selected-ink ships as --ui-on-steel');
            }));

        test('SELECTION: no chip owns a private selected look — turn the dial off and the '
            + 'current chip stops looking current', () => mounted(async (page) => {
            /* The test that would have caught Slate: L8/E10/T5 are all "the paint stayed
             * when the dial moved". Point both colour dials at the resting values and the
             * current chip must become indistinguishable from an ahead one. */
            const before = await page.computed(chip(3), ['background-color', 'color']);
            const ahead = await page.computed(chip(4), ['background-color', 'color']);
            assert.notDeepEqual(before, ahead, 'the states must differ to begin with');

            await page.setToken('--ui-selected-face', 'transparent');
            await page.setToken('--ui-selected-ink', 'var(--ui-muted)');
            const flattened = await page.computed(chip(3), ['background-color', 'color']);
            await page.setToken('--ui-selected-face', null);
            await page.setToken('--ui-selected-ink', null);

            assert.deepEqual(
                flattened, ahead,
                'with both colour dials pointed at the resting values the current chip '
                + 'still differs from an ahead one — something in this component is '
                + 'painting selection outside the dials.',
            );
        }));

        test('the three chip states are three treatments, and only one of them is a dial',
            () => mounted(async (page) => {
                /* CITE …[i=47] background-color = rgba(0, 0, 0, 0) authored `transparent`
                 * CITE …[i=47] color = rgb(148, 161, 169)  (var(--slate-muted))
                 * CITE …[i=47] border-top-width = 1px, border-top-color = rgb(58, 72, 82)
                 *      (--slate-line) — the AHEAD chip, measured.
                 * DONE is unmeasured: no capture in the 49 has a step behind the walk. */
                const line = await page.resolveToken('--ui-line', 'border-top-color');
                const muted = await page.resolveToken('--ui-muted', 'color');
                const keyOn = await page.resolveToken('--ui-key-on', 'background-color');
                const text = await page.resolveToken('--ui-text', 'color');

                const aheadChip = await page.computed(chip(4),
                    ['background-color', 'color', 'border-top-color', 'border-top-width']);
                assert.equal(aheadChip['background-color'], 'rgba(0, 0, 0, 0)', 'ahead is transparent');
                assert.equal(aheadChip.color, muted);
                assert.equal(aheadChip['border-top-color'], line);
                near(parseFloat(aheadChip['border-top-width']), 1, 'the ahead hairline');

                const doneChip = await page.computed(chip(1), ['background-color', 'color']);
                assert.equal(doneChip['background-color'], keyOn, 'done is a filled quiet chip');
                assert.equal(doneChip.color, text);

                /* Every state keeps the same 44x44 box — Appendix 3, "state changes
                 * weight, never position". The transparent border in the resting rule is
                 * what buys that. */
                const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
                for (const r of rects) near(r.w, 44, `${r.id} keeps its box`);
            }));

        test('the connectors mark the walk by weight, and take --ui-space-7 as their length',
            () => mounted(async (page) => {
                /* Slate draws a 40x3 div between chips and recolours it once the walk is
                 * past (`settings.js:4883`, read-only; the connectors are not in the
                 * corpus's 18-property capture, so this is a source read, not a CITE).
                 * 40 is --ui-space-7; 3px has no token, so the emphasised rule weight
                 * --ui-border-w-strong carries it. */
                const strong = await page.resolveToken('--ui-line-strong', 'background-color');
                const line = await page.resolveToken('--ui-line', 'background-color');
                const walked = await page.computed(rule(1), ['background-color', 'block-size', 'inline-size']);
                const aheadRule = await page.computed(rule(3), ['background-color']);

                assert.equal(walked['background-color'], strong, 'behind the walk: --ui-line-strong');
                assert.equal(aheadRule['background-color'], line, 'ahead of the walk: --ui-line');
                near(parseFloat(walked['inline-size']), 40, 'the connector is --ui-space-7 long');
                near(parseFloat(walked['block-size']), 2, 'the connector is --ui-border-w-strong thick');
            }));

        /* ===================================================================
         * 3. TOKEN DRILLS — consumed, not copied
         * =================================================================== */

        test('TOKEN DRILL: --ui-control-sm moves the chip', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-sm',
                value: '60px',
                selector: chip(3),
                property: 'inline-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-control-sm',
                value: '60px',
                selector: chip(3),
                property: 'block-size',
            });
        }));

        test('TOKEN DRILL: --ui-line, --ui-line-strong, --ui-muted and --ui-key-on',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line', selector: chip(4), property: 'border-top-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-line-strong', selector: rule(1), property: 'background-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-muted', selector: '#walk >>> #caption', property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-key-on', selector: chip(1), property: 'background-color',
                });
            }));

        test('TOKEN DRILL: --ui-radius, --ui-text-md and --ui-space-7', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius', value: '10px', selector: chip(3), property: 'border-top-left-radius',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-md', value: '30px', selector: '#walk >>> #caption', property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-7', value: '70px', selector: rule(1), property: 'inline-size',
            });
        }));

        test('TOKEN DRILL: the column rhythm is --ui-space-6 and --ui-space-4',
            () => mounted(async (page) => {
                /* MEASURED, and the one gap Slate has on the scale: chips bottom out at
                 * 259 + 44 = 303 and the caption starts at y = 321, so strip-to-caption is
                 * 18px = --ui-space-4. The column gap replaces an untokenised gap-[30px]
                 * (`settings.js:5015`) with --ui-space-6 = 28. */
                await assertTokenDrill(page, {
                    token: '--ui-space-4', value: '36px', selector: '#walk >>> #progress', property: 'row-gap',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-6', value: '36px', selector: '#walk >>> #column', property: 'row-gap',
                });
                const gap = await page.computed('#walk >>> #progress', ['row-gap']);
                near(parseFloat(gap['row-gap']), 18, 'strip-to-caption is the measured 18px');
            }));

        /* ===================================================================
         * 4. T1 — THE COLUMN IS THE LEAF'S WIDTH, AND OWNS NO CAP
         * =================================================================== */

        test('T1: the wizard is exactly as wide as every other leaf, at two container widths',
            () => mounted(async (page) => {
                /* T1 is a DIFFERENCE — "63px wider than every other leaf … 1263 against
                 * 1200" — so the assertion is a difference, measured against a sibling in
                 * the same stage rather than against a remembered number. */
                const stage = await page.box('#stage');
                const first = {
                    wizard: await page.box('#walk'),
                    leaf: await page.box('#leaf'),
                };
                near(first.wizard.width, first.leaf.width,
                    'T1: the wizard is not the same width as its sibling leaf', 0.51);
                near(first.wizard.width, STAGE_W - 48,
                    'T1: the wizard is not the stage\'s content width');
                assert.ok(stage.width >= first.wizard.width,
                    'the wizard may never be wider than the pane that holds it');

                /* Narrow the pane. A bespoke cap shows up here as a wizard that stops
                 * tracking its container — which is exactly what 1263-against-1200 is. */
                await page.setStyle('#stage', { 'inline-size': '520px' });
                await page.settle();
                const second = {
                    wizard: await page.box('#walk'),
                    leaf: await page.box('#leaf'),
                };
                near(second.wizard.width, second.leaf.width,
                    'T1: the wizard stops tracking its container at 520px');
                near(second.wizard.width, 520 - 48, 'T1: the wizard is the pane\'s width at 520px');
                assert.ok(second.wizard.width < first.wizard.width,
                    'the wizard must follow the pane, not a number of its own');
            }));

        test('T1: nothing in the column carries a max-inline-size — not the 1263, not the 760',
            () => mounted(async (page) => {
                /* The mechanism half. T1 is a cap that beat the leaf cap
                 * (`slate-shell.css:2290-2295` vs `:1285-1288`) and T21's 760 is a second
                 * cap inside the first (CITE find --cls slate-cal-card -> [i=51] rect
                 * 629,384,760,296). SCOPE.md:2252: "the wizard … asks for it explicitly via
                 * its own container, not via a bespoke cap." There is no cap here to ask
                 * with, on the host, on any box in the shadow tree, or on the slotted card. */
                const caps = await page.eval(`JSON.stringify(${CAPS})`).then(JSON.parse);
                const capped = caps.filter((c) => c.max && c.max !== 'none');
                assert.deepEqual(capped, [],
                    'a width cap in the wizard column is T1 (and T21) by construction: '
                    + JSON.stringify(capped));
            }));

        test('T1: the slotted card is the column\'s width, not a 760px island',
            () => mounted(async (page) => {
                /* Slate's card is 760 inside a 1263 leaf, left-aligned, which is the
                 * "three things that each chose their own alignment" its own comment
                 * complains about (`slate-shell.css:2281-2289`). Here the body is a bare
                 * slot, so the card is a grid item of the column and stretches. */
                const wizard = await page.box('#walk');
                const card = await page.box('#body');
                near(card.width, wizard.width, 'the slotted card must be the column\'s width');
                near(card.left, wizard.left, 'and share its left edge');
            }));

        /* ===================================================================
         * 5. THE CONTAINER FLOOR — what gives way, in what order
         * =================================================================== */

        test('CONTAINER FLOOR: at 320px the strip wraps and the chips keep their 44',
            () => mounted(async (page) => {
                /* Slate is frozen at 1263 and has no answer here (Part 10 §4); spec §2.2
                 * row 1 does — a touch target is "fixed token, never fluid". */
                await page.setStyle('#stage', { 'inline-size': '320px' });
                await page.settle();

                const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
                for (const r of rects) {
                    near(r.w, 44, `${r.id} shrank at 320px — a touch floor is never fluid`);
                    near(r.h, 44, `${r.id} shrank at 320px`);
                }
                assert.ok(new Set(rects.map((r) => Math.round(r.y))).size > 1,
                    'the strip must WRAP rather than overflow at 320px');

                const host = await page.box('#walk');
                for (const r of rects) {
                    assert.ok(r.x >= host.left - 0.5 && r.x + r.w <= host.right + 0.5,
                        `${r.id} is outside the column at 320px: [${r.x}, ${r.x + r.w}] `
                        + `against [${host.left}, ${host.right}]`);
                }
            }));

        test('CONTAINER FLOOR: the floor is one chip+connector unit, and at it the strip '
            + 'still fits', () => mounted(async (page) => {
            /* §2.4 asks for "an explicit floor and a defined order of surrender". The
             * floor is --ui-control-sm + --ui-space-2 + --ui-space-7 = 44 + 8 + 40 = 92,
             * the strip's min-content width — one whole unit per line. Computed from the
             * tokens rather than written as 92, so a token change moves the assertion. */
            const sum = (names) => Promise.all(names.map((n) => page.resolveToken(n, 'width')))
                .then((v) => v.reduce((a, x) => a + parseFloat(x), 0));
            const floor = await sum(['--ui-control-sm', '--ui-space-2', '--ui-space-7']);
            near(floor, 92, 'the stated floor');

            await page.setStyle('#stage', { 'inline-size': `${floor + 48}px` });
            await page.settle();

            const host = await page.box('#walk');
            near(host.width, floor, 'the column is the floor its container gives it');

            const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
            assert.equal(new Set(rects.map((r) => Math.round(r.y))).size, 4,
                'at the floor every unit is on its own line');
            for (const r of rects) {
                near(r.w, 44, `${r.id} shrank at the floor — a touch floor is never fluid`);
                assert.ok(r.x + r.w <= host.right + 0.5,
                    `${r.id} spills past the column at the floor: ${r.x + r.w} > ${host.right}`);
            }
        }));

        test('CONTAINER FLOOR: below the floor it overflows VISIBLY — never clipped, never '
            + 'a hidden scrollbar', () => mounted(async (page) => {
            /* The order of surrender's last step, and the one §2.4 cares about: "hiding
             * the scrollbar is banned" (T16 is the counter-example — both settings nav
             * columns scroll with scrollbar-width: none). Below one unit the strip has
             * nothing left to give, and it says so rather than shrinking the target or
             * quietly cutting a chip off. */
            await page.setStyle('#stage', { 'inline-size': '112px' });   /* a 64px column */
            await page.settle();

            const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
            for (const r of rects) near(r.w, 44, `${r.id} shrank below the floor`);

            const caps = await page.eval(`JSON.stringify(${CAPS})`).then(JSON.parse);
            const hiding = caps.filter((c) => c.overflowX && c.overflowX !== 'visible'
                && !String(c.where).includes('a11y'));
            assert.deepEqual(hiding, [],
                'below the floor the overflow must stay visible: ' + JSON.stringify(hiding));
        }));

        test('CONTAINER FLOOR: nothing in the column hides overflow, and that is stated',
            () => mounted(async (page) => {
                /* Spec §2.4 wants a floor and a STATED overflow for every scroll region.
                 * This component is not one — the leaf pane scrolls (spec §4.4) — so the
                 * statement is that every box here is `visible`. The `.a11y` 1px box is
                 * the base fragment's and is exempt by construction: it is 1x1 and clipped
                 * on purpose (CONVENTIONS §5a). */
                const caps = await page.eval(`JSON.stringify(${CAPS})`).then(JSON.parse);
                const hiding = caps.filter((c) => c.overflowX && c.overflowX !== 'visible'
                    && !String(c.where).includes('a11y'));
                assert.deepEqual(hiding, [],
                    'a hidden overflow in this column clips the slotted buttons\' focus '
                    + 'rings (L24) and silently truncates the card: ' + JSON.stringify(hiding));
            }));

        test('CONTAINER FLOOR: an empty actions cluster draws no row', () => mounted(async (page) => {
            /* The F3 hole is a STATE, not a gap: with nothing slotted the cluster is
             * hidden, so the column does not reserve 28px for a control that is not
             * there. Compared against the same walk WITH actions, which must be taller. */
            const empty = await page.box('#walk');
            const actions = await page.computed('#walk >>> #actions', ['display']);
            assert.equal(actions.display, 'none', 'an empty actions cluster must not draw');

            await page.mount(MARKUP, MODULES);
            const filled = await page.box('#walk');
            assert.ok(filled.height > empty.height,
                `slotting two buttons must make the column taller (${filled.height} vs ${empty.height})`);
        }, NO_ACTIONS));

        /* ===================================================================
         * 6. FOCUS, UNCLIPPED — bug L24's class, on slotted controls
         * =================================================================== */

        test('FOCUS: the slotted ui-button\'s ring is the token ring and nothing clips it',
            () => mounted(async (page) => {
                const g = await assertFocusUnclipped(page, '#go >>> #btn');
                const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
                assert.equal(g.outlineWidth, width);
            }));

        test('FOCUS: a BARE slotted button gets the same one ring (CONVENTIONS §3a)',
            () => mounted(async (page) => {
                /* Review finding cross-3: a bare button slotted into a component took
                 * Chrome's own outline: auto — a sixth treatment inside the layer that
                 * exists to end the five. The base's ::slotted rule closes it; this is the
                 * proof for THIS component's slots. */
                await assertFocusUnclipped(page, '#bare');
            }));

        test('FOCUS: the ring survives a squeezed column', () => mounted(async (page) => {
            /* L24 is rings clipped by the component they sit inside, and a narrow column
             * is where a hidden overflow would first be reached for. */
            await page.setStyle('#stage', { 'inline-size': '320px' });
            await page.settle();
            await assertFocusUnclipped(page, '#go >>> #btn');
        }));

        /* ===================================================================
         * 7. ARIA — Appendix 15, and T15's absences
         * =================================================================== */

        test('ARIA: exactly one chip is current, it says "step", and the class agrees',
            () => mounted(async (page) => {
                /* Appendix 15: "the aria-*-driven state selectors … the right contract for
                 * a Lit component's reflected properties". Accessibility state and visual
                 * state are the same state. T15's settings finding is the counter-example:
                 * "selection is class-only with no aria-current/aria-selected". */
                const chips = await page.eval(`JSON.stringify(${CHIPS})`).then(JSON.parse);
                assert.equal(chips.length, 4);
                assert.deepEqual(chips.map((c) => c.current), [null, null, 'step', null],
                    'one current chip, spelled aria-current="step"');
                for (const c of chips) {
                    assert.equal(c.pressed, null, 'one spelling, not four');
                    assert.equal(c.selected, null);
                    assert.equal(c.checked, null);
                }
                assert.ok(chips[2].classes.includes('is-selected'),
                    'the current chip carries the class selectionSurface paints');
                assert.ok(!chips[3].classes.includes('is-selected'));
            }));

        test('ARIA: the strip is a named list and the glyphs are hidden from it',
            () => mounted(async (page) => {
                const list = await page.eval(
                    'JSON.stringify((() => { const ol = document.getElementById("walk")'
                    + '.shadowRoot.getElementById("steps");'
                    + 'return { role: ol.getAttribute("role"), label: ol.getAttribute("aria-label"),'
                    + ' items: ol.querySelectorAll("li").length, tag: ol.tagName }; })())',
                ).then(JSON.parse);
                assert.equal(list.tag, 'OL');
                assert.equal(list.role, 'list', 'restated: Safari drops list semantics from list-style: none');
                assert.equal(list.label, 'Load cell calibration steps');
                assert.equal(list.items, 4);

                const chips = await page.eval(`JSON.stringify(${CHIPS})`).then(JSON.parse);
                for (const c of chips) {
                    assert.equal(c.glyphHidden, 'true', 'the numeral/check is decorative');
                }
                assert.equal(chips[0].glyph, '✓', 'a step behind the walk shows a check');
                assert.equal(chips[2].glyph, '3', 'the current step shows its number');
            }));

        test('ARIA: each chip announces the step NAME, visually hidden, not its number',
            () => mounted(async (page) => {
                /* CONVENTIONS §5a: one visually-hidden treatment, still in the
                 * accessibility tree. The strip reads "Zero, Left cell, Right cell,
                 * Verify" with one of them current, rather than "1 2 3 4". */
                const chips = await page.eval(`JSON.stringify(${CHIPS})`).then(JSON.parse);
                assert.deepEqual(
                    chips.map((c) => c.text),
                    ['✓ Zero Done', '✓ Left cell Done', '3 Right cell', '4 Verify'],
                );
                const box = await page.box(`${chip(3)} .a11y`);
                assert.ok(box.width <= 1.5 && box.height <= 1.5,
                    `the name is visually hidden, not laid out: measured ${box.width}x${box.height}`);
            }));

        test('ARIA: nothing in the strip is focusable or clickable', () => mounted(async (page) => {
            /* The chips are an INDICATOR. Slate's are inert divs; jumping to an arbitrary
             * calibration step is not a thing the machine supports, and inventing
             * navigation would be inventing semantics. Recorded as a deferred question. */
            const focusables = await page.count('#walk >>> #steps :is(a, button, input, [tabindex])');
            assert.equal(focusables, 0, 'a step chip is not a control');
        }));

        /* ===================================================================
         * 8. THE GALLERY ENTRY IS THIS COMPONENT
         * =================================================================== */

        test('every gallery state mounts and renders four chips', () => mounted(async (page) => {
            /* The battery photographs these ids; a state that throws or renders nothing is
             * a silent hole in the baseline. */
            for (const state of galleryEntry.states) {
                await page.mount(`<div id="stage" style="inline-size:${
                    state.hostStyle?.['inline-size'] ?? '760px'}">${state.html}</div>`, MODULES);
                assert.deepEqual(page.pageErrors, [],
                    `gallery state ${galleryEntry.id}--${state.id} threw on mount`);
                const chips = await page.count('ui-wizard-column >>> .chip');
                assert.equal(chips, 4, `gallery state ${state.id} renders ${chips} chips`);
            }
        }));
    });
}
