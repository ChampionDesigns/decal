/**
 * ui-action-key-rail.render.test.mjs — Wave 4 item #42's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles and box geometry only, never
 * source text, at BOTH standard geometries — 1281x801 @ dsf 1.5 and the 1000x600
 * floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS FOR. Row #42 carries no bug id and one decision, C7 (five
 * buttons, no drag). Three things are therefore worth measuring rather than reading:
 *
 *  1. THAT THE WHOLE KEY IS PRESSABLE. The composition is five #1 ui-buttons inside
 *     the seam utility, and the obvious way to make a composed #1 fill its cell —
 *     #1's own documented `ui-button { display: block }` lever — silently breaks it:
 *     a <button> in a block container is shrink-to-fit in Chrome whatever its
 *     display, so the control came out 74px inside a 255px key with 181px of dead
 *     fascia beside it. That is the defect ui-icon-button.js:104-117 names ("a 64px
 *     button in a 96px host with a dead strip beside it") and nothing in a screenshot
 *     shows it. §2 measures the control box against the key box on all five keys.
 *
 *  2. THAT DISABLED IS A DIMMED GLYPH ON THE SAME GROUND. Slate's own sheet states
 *     that intent at profile-editor-v3.css:1076-1081 and a shell rule 1000 lines away
 *     beats it with !important (measured — see the CITEs in the component header). The
 *     structure here makes the intent free: the FACE is the seam cell, the GLYPH is
 *     the ghost button, and the one dial fades only the second. §4 measures both
 *     halves against a live sibling.
 *
 *  3. THAT NOTHING IS CUT. §7.4 E1 is "overflow-y: hidden CUTS THE ACTION ROW" — this
 *     component is that row, and it uses `overflow: hidden` for its radius. §6
 *     squeezes the container to 120px and asserts the rank holds its floor and the
 *     clip still has nothing to clip.
 *
 * ============================ ORACLE ==========================================
 * Disqualification check first (prov_query.py --help, SCOPE Part 10 §4). C7 settles
 * the control type and the count; responsive behaviour has no Slate answer (frozen at
 * 1920x1200, layout spec governs); and TWO of §7.4's bugs land on the elements this
 * component is built from, so the oracle is disqualified for exactly two values:
 *   E13 — CITE editor-steps .pe-action-btn [i=214] color: dark rgb(149, 149, 149) /
 *         light rgb(90, 101, 108)  <-  dark dark-mode.css `[data-theme="dark"]
 *         .pe-action-btn` authored `rgb(149, 149, 149)` !important=no ; light
 *         profile-editor-v3.css `.pe-action-btn` authored `var(--slate-muted)`. The
 *         neutral key's ink is a literal in dark and a token in light. §3 asserts
 *         --ui-muted in BOTH themes and asserts the literal absent.
 *   E1  — the clip; §6.
 * Everything else is quoted and reproduced:
 *   CITE prov_query.py find --cls pe-action-cell -> "found 3 element(s) in 1 state(s)",
 *        "distinct geometries (w x h), all matched elements: 316 x 64 x3"
 *   CITE prov_query.py find --cls pe-action-btn -> "found 15 element(s) in 1 state(s)",
 *        "distinct geometries (w x h), all matched elements: 62 x 62 x15" — five keys
 *        per rail, three rails.
 *   CITE editor-steps .pe-action-cell [i=210] background-color: dark rgb(58, 72, 82) /
 *        light rgb(203, 208, 211)  (= --ui-line, both themes exactly)
 *   CITE editor-steps .pe-action-cell [i=210] gap = 1px, padding-left = 1px,
 *        border-top-left-radius = 6px, height = 64px
 *   CITE editor-steps .pe-action-btn [i=213] background-color: dark rgb(14, 19, 23) /
 *        light rgb(242, 243, 243)  (= --ui-fascia, both themes exactly)
 *   CITE editor-steps .pe-action-btn [i=213] color: dark rgb(176, 196, 206) / light
 *        rgb(49, 92, 112)  <-  `.pe-action-btn.pe-act-add` authored `var(--slate-steel)`
 *   CITE editor-steps .pe-action-btn [i=212] color: dark
 *        color(srgb 0.811922 0.464784 0.459451) / light
 *        color(srgb 0.609882 0.189961 0.217412)  <-  `.pe-action-btn.pe-act-del`
 *        authored `color-mix(in srgb, var(--slate-danger) 72%, var(--slate-muted))`
 *   CITE editor-steps .pe-action-btn [i=211] background-color: dark rgb(14, 19, 23) /
 *        light rgb(242, 243, 243)  <-  `.pe-action-btn.pe-act-disabled` — the disabled
 *        key's ground IS the live key's ground, in both themes.
 * Colours are asserted against RESOLVED TOKENS, never against a hex, so every
 * assertion below is true in both themes; the two theme-specific ones say so.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-action-key-rail.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

/* One module. It side-effect imports src/components/ui-button.js — item #1, the row's
 * stated dependency — and if that import is ever dropped this file fails first, with
 * <ui-button> never upgrading and every key box coming out wrong. */
const MODULE = ['/src/components/ui-action-key-rail.js'];

/** C7's five, in Slate's footer order (profile_editor.js:2119-2123). */
const ACTIONS = ['move-left', 'delete', 'insert-after', 'duplicate', 'move-right'];

/** Slate's own aria-label strings, the translation keys carried unchanged. */
const NAMES = {
    'move-left': 'Move step left',
    delete: 'Delete step',
    'insert-after': 'Insert step after',
    duplicate: 'Duplicate step',
    'move-right': 'Move step right',
};

/* A four-step profile sitting on step 2 (0-based 1): every key live, which is the
 * state most assertions want. The edge cases get their own mounts. */
const MID = '<ui-action-key-rail id="rail" index="1" count="4"></ui-action-key-rail>';
const FIRST = '<ui-action-key-rail id="rail" index="0" count="4"></ui-action-key-rail>';
const LAST = '<ui-action-key-rail id="rail" index="3" count="4"></ui-action-key-rail>';
const ONLY = '<ui-action-key-rail id="rail" index="0" count="1"></ui-action-key-rail>';
const OFF = '<ui-action-key-rail id="rail" index="1" count="4" disabled></ui-action-key-rail>';

const key = (action) => `#rail >>> #key-${action}`;
const control = (action) => `${key(action)} >>> .btn`;
const glyph = (action) => `#rail >>> #key-${action} .glyph`;
const cell = (action) => `#rail >>> #key-${action}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The cell that paints a key's face is the key's parent — the .seam-cell wrapper. */
async function faceColour(page, action) {
    return page.evalFn((a) => {
        const el = document.getElementById('rail').shadowRoot.getElementById(`key-${a}`);
        return getComputedStyle(el.parentElement).backgroundColor;
    }, action);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-action-key-rail @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MID, opts = {}) => browser.withPage(
            { geometry, ...opts },
            async (page) => {
                await page.mount(markup, MODULE);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

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

        /* -----------------------------------------------------------------
         * 1. C7 — FIVE KEYS, BUTTONS, NO DRAG
         * ----------------------------------------------------------------- */

        test('C7: five keys, in Slate\'s footer order, and every one is a #1 ui-button',
            () => mounted(async (page) => {
                const found = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const keys = [...root.querySelectorAll('.rail > .cell > *')];
                    return {
                        count: keys.length,
                        tags: keys.map((k) => k.tagName.toLowerCase()),
                        actions: keys.map((k) => k.dataset.action),
                        variants: keys.map((k) => k.getAttribute('variant')),
                        /* Every key's real control is #1's own <button>, in #1's
                         * shadow root — not a <button> this component authored. */
                        controls: keys.map((k) => k.shadowRoot?.querySelector('button')?.tagName ?? null),
                        railOwnsNoButton: root.querySelector('button') === null,
                    };
                });
                assert.equal(found.count, 5, 'C7: the five footer buttons (SCOPE.md:2327)');
                assert.deepEqual(found.tags, Array(5).fill('ui-button'),
                    'the press control is #1, composed, never re-implemented');
                assert.deepEqual(found.actions, ACTIONS);
                assert.deepEqual(found.variants, Array(5).fill('ghost'),
                    'ghost is the variant whose border and face are transparent, so the '
                    + 'key contributes no second border inside a seam grid (L9\'s shape)');
                assert.deepEqual(found.controls, Array(5).fill('BUTTON'));
                assert.equal(found.railOwnsNoButton, true,
                    'a bare <button> in this shadow root would be a second press control');
            }));

        test('C7: no drag affordance of any kind (OQ-9 says do not add one)',
            () => mounted(async (page) => {
                const drag = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const all = [...root.querySelectorAll('*')];
                    return {
                        draggable: all.filter((el) => el.getAttribute?.('draggable') === 'true').length,
                        handles: all.filter((el) => /handle|drag|grip/i.test(el.className?.baseVal
                            ?? (typeof el.className === 'string' ? el.className : ''))).length,
                        cursors: [...new Set(all.map((el) => getComputedStyle(el).cursor))],
                    };
                });
                assert.equal(drag.draggable, 0);
                assert.equal(drag.handles, 0);
                for (const c of drag.cursors) {
                    assert.ok(!['grab', 'grabbing', 'move', 'all-scroll'].includes(c),
                        `a drag cursor (${c}) on a control that cannot be dragged is P10's `
                        + 'dead affordance, one screen over');
                }
            }));

        /* -----------------------------------------------------------------
         * 2. THE RANK — every key pressable end to end, no dead strip
         * ----------------------------------------------------------------- */

        test('every key\'s control fills its key, on all five', () => mounted(async (page) => {
            for (const action of ACTIONS) {
                const k = await page.box(key(action));
                const c = await page.box(control(action));
                near(c.width, k.width, `${action}: control width vs key width`);
                near(c.height, k.height, `${action}: control height vs key height`);
                near(c.left, k.left, `${action}: control left vs key left`);
            }
        }));

        test('a STRETCHED key stretches its control — the dead-strip trap, measured',
            () => mounted(async (page) => {
                /* The shipped rail is sized by its keys, so control-box == key-box is
                 * nearly free and the assertion above cannot bite on its own. This one
                 * can: it re-sizes the tracks to 1fr in a 900px rail — the shape any
                 * future editor layout would reach for — and re-measures. Under
                 * `.key { display: block }` (#1's own documented full-width lever, and
                 * the wrong tool here) the control comes back 74px inside a 179px key
                 * and this test is the only thing in the suite that notices. */
                await page.setStyle('#rail >>> .rail', {
                    'inline-size': '900px',
                    'grid-auto-columns': 'minmax(var(--ui-control-h), 1fr)',
                });
                try {
                    for (const action of ACTIONS) {
                        const k = await page.box(key(action));
                        const c = await page.box(control(action));
                        assert.ok(k.width > 120, `${action}: the key really was stretched (${k.width})`);
                        near(c.width, k.width, `${action}: the control follows the key`);
                    }
                } finally {
                    await page.setStyle('#rail >>> .rail', {
                        'inline-size': null, 'grid-auto-columns': null,
                    });
                }
            }));

        test('the five keys are one rank — identical boxes, one seam apart',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const boxes = [];
                for (const action of ACTIONS) boxes.push(await page.box(key(action)));

                for (const b of boxes) {
                    near(b.width, boxes[0].width, 'key width is uniform across the rank');
                    near(b.height, boxes[0].height, 'key height is uniform across the rank');
                    near(b.top, boxes[0].top, 'the rank is one row');
                }
                for (let i = 1; i < boxes.length; i += 1) {
                    near(boxes[i].left - boxes[i - 1].right, seam,
                        `the gap between key ${i - 1} and key ${i} is exactly one --ui-seam`);
                }
            }));

        test('the rail is its five keys plus four seams plus two border edges',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const border = parseFloat(await page.prop('#rail >>> .rail', 'border-top-width'));
                const rail = await page.box('#rail >>> .rail');
                const keyBox = await page.box(key('delete'));
                near(rail.width, 5 * keyBox.width + 4 * seam + 2 * border, 'rail inline size');
                near(rail.height, keyBox.height + 2 * border, 'rail block size');
            }));

        test('the key clears --ui-hit-min on both axes with paint alone', () => mounted(async (page) => {
            for (const action of ACTIONS) {
                await assertHitFloor(page, control(action), { mode: 'paint' });
            }
        }));

        test('the rank TAKES the width it is given, and its keys divide it',
            () => mounted(async (page) => {
                /* IT USED TO REFUSE THE WIDTH, and Ben changed that on 25 August 2026:
                 * "tweak the bottom buttons so the 4 buttons are the same total width as
                 * say the slider ... Then make all the controls 350px wide? This should
                 * get it pixel perfect width."
                 *
                 * A rank sized to its own keys can only line up with the stepper above it
                 * by arithmetic that happens to agree. A rank sized to its container does
                 * it by construction, and that is what this now measures: the rail is its
                 * container, the five keys are equal shares of it, and the SQUARE-key
                 * claim moves to the floor below rather than to the resting width. */
                const key = () => page.evalFn(() => {
                    const rail = document.getElementById('rail').shadowRoot.querySelector('.rail');
                    const cells = [...rail.children].map((c) => c.getBoundingClientRect().width);
                    return { rail: rail.getBoundingClientRect().width, cells };
                });

                for (const width of [350, 600, 1600]) {
                    await page.setStyle('#rail', { 'inline-size': `${width}px` });
                    await page.settle(2);
                    const got = await key();
                    near(got.rail, width, `the rank is its container at ${width}px`);
                    for (const cell of got.cells) {
                        near(cell, got.cells[0], 'and the keys are equal shares of it', 1);
                    }
                    /* AND NOTHING IS CUT AT ANY OF THEM. The slab clips its own corners,
                     * so an overflow here is invisible — which is why it is measured at
                     * every width rather than only at the floor. */
                    const m = await page.metrics('#rail >>> .rail');
                    near(m.scrollWidth, m.clientWidth, `nothing cut inside the slab at ${width}px`, 1);
                }
                await page.setStyle('#rail', { 'inline-size': null });
            }));

        /* -----------------------------------------------------------------
         * 3. TOKEN DRILLS — nothing in this file is a number or a colour
         * ----------------------------------------------------------------- */

        test('token drill: the seam ground is --ui-line (the oracle\'s .pe-action-cell)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .rail',
                    property: 'background-color',
                });
            }));

        test('token drill: the enclosure is --ui-line too — one ink, two jobs',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .rail',
                    property: 'border-top-color',
                });
            }));

        test('token drill: the enclosure width is --ui-border-w', () => mounted(async (page) => {
            /* expectLanding: false — the harness resolves a drill value on a bare probe
             * element, and `border-top-width: 37px` with no border-style computes to
             * 0px there, so the generic landing check would compare against 0. The
             * landing is checked here instead, in whole CSS px, because a rendered
             * length at dsf 1.5 is not string-comparable (CONVENTIONS §10). */
            const drilled = await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'border-top-width',
                expectLanding: false,
            });
            near(parseFloat(drilled.after), parseFloat(DRILL_LENGTH),
                'the enclosure width lands on the drilled token');
        }));

        test('token drill: the seam width is --ui-seam', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'column-gap',
            });
        }));

        test('token drill: the slab corner is --ui-radius (oracle 6px)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'border-top-left-radius',
            });
        }));

        test('token drill: the key face is --ui-fascia (the oracle\'s .pe-action-btn)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-fascia',
                    value: DRILL_COLOUR,
                    selector: '#rail >>> .cell',
                    property: 'background-color',
                });
            }));

        test('token drill: the neutral glyph is --ui-muted — E13\'s literal cannot express',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-muted',
                    value: DRILL_COLOUR,
                    selector: glyph('duplicate'),
                    property: 'color',
                });
            }));

        test('token drill: the add key is --ui-steel', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: glyph('insert-after'),
                property: 'color',
            });
        }));

        test('token drill: the delete key is --ui-status-danger, 72% of it', () => mounted(async (page) => {
            /* expectLanding: false — the token is a COMPONENT of a color-mix, so the
             * rendered value is the mix and not the drill colour. The shape check is
             * the next test, which reproduces Slate's own arithmetic. */
            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                value: DRILL_COLOUR,
                selector: glyph('delete'),
                property: 'color',
                expectLanding: false,
            });
        }));

        test('the delete key is Slate\'s arithmetic, not Slate\'s computed value',
            () => mounted(async (page) => {
                /* CITE .pe-action-btn.pe-act-del authored
                 * `color-mix(in srgb, var(--slate-danger) 72%, var(--slate-muted))`.
                 * Carried as arithmetic so it stays true when either token moves;
                 * resolved here through the engine rather than written as a hex. */
                const want = await page.resolveValue(
                    'color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted))', 'color');
                assert.equal(await page.prop(glyph('delete'), 'color'), want);
                /* And it is genuinely a MIX, not one end of it. */
                assert.notEqual(want, await page.resolveValue('var(--ui-status-danger)', 'color'));
                assert.notEqual(want, await page.resolveValue('var(--ui-muted)', 'color'));
            }));

        test('token drill: the glyph box is --ui-icon (Slate\'s bare 23px is gone)',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-icon',
                    value: DRILL_LENGTH,
                    selector: glyph('move-left'),
                    property: 'width',
                });
                assert.notEqual(await page.prop(glyph('move-left'), 'width'), '23px',
                    'E11\'s family: .pe-action-btn svg { width: 23px } was a bare literal');
            }));

        test('token drill: the rank\'s floor is --ui-control-h', () => mounted(async (page) => {
            /* Squeeze the host so the rank is at its floor, then move the token and
             * watch the floor move with it. The floor is read from min-inline-size, which
             * is where this file states it — the rendered width is the CONTAINER's now
             * (Ben, 25 August 2026), so it is not the thing that reports the floor.
             *
             * --ui-control-h AND NOT --ui-hit-min. For one release this read the hit
             * minimum, 48, and a 48px track cannot hold one of #1's keys: 24 + 24 of
             * padding plus a hairline enclosure is 50px of border box before any glyph.
             * Every key stood out of its track and the slab cut it. */
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: DRILL_LENGTH,
                selector: '#rail >>> .rail',
                property: 'min-inline-size',
                expectLanding: false,
            });
        }));

        /* -----------------------------------------------------------------
         * 4. DISABLED — one dial, dimmed glyph, same ground
         * ----------------------------------------------------------------- */

        test('the edge keys are the two C7 disables, and only those', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return [...root.querySelectorAll('ui-button')].map((b) => ({
                    action: b.dataset.action,
                    host: b.hasAttribute('disabled'),
                    native: !!b.shadowRoot.querySelector('button')?.disabled,
                }));
            });
            assert.deepEqual(state.map((s) => s.host), [false, false, false, false, false],
                'index 1 of 4: neither end, so nothing is disabled');
            assert.deepEqual(state.map((s) => s.native), [false, false, false, false, false]);
        }));

        test('first step: move-left is disabled, the other four are not', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': true,
                delete: false,
                'insert-after': false,
                duplicate: false,
                'move-right': false,
            });
        }, FIRST));

        test('last step: move-right is disabled, the other four are not', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': false,
                delete: false,
                'insert-after': false,
                duplicate: false,
                'move-right': true,
            });
        }, LAST));

        /**
         * A ONE-STEP PROFILE DISABLES THREE KEYS, AND THE THIRD IS A DECLARED DEPARTURE.
         *
         * THIS ASSERTION USED TO READ `delete: false`, justified as "the only step is
         * still deletable — Slate's behaviour". It was measured correctly and reasoned
         * wrongly, and it was inverted on 27 August 2026 rather than weakened: the claim
         * is now the opposite claim, held just as tightly, because the tree's own rule
         * says so somewhere else. `step-matrix.js render()` refuses to draw a matrix with
         * no steps — "A profile with zero steps is not an editing surface" — and assigns
         * the other half by name: "'never delete the last step' is the draft owner's rule
         * to keep". `editor-draft.js applyStepAction` keeps it, so the press was going to
         * be refused; the only question was whether the person could SEE that before
         * pressing.
         *
         * THE DEAD END IS REAL AND BEN WALKED INTO IT FROM THE OTHER SIDE the same day, on
         * a new profile the selector seated with an empty step list: "there is not + button
         * to add a new step etc, ie I cannot add any steps." With no steps there are no
         * step columns; with no step columns there are no action rails; the action rail is
         * the only route to a new step. Slate has the same dead end and has never been
         * driven into it, because its own new-profile seed is a four-step worked example.
         *
         * THE TWO LIVE KEYS ARE INSERT-AFTER AND DUPLICATE, which is the whole point: from
         * one step you can always get to two, and from two you can delete again.
         */
        test('a one-step profile disables both arrows AND delete', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const root = document.getElementById('rail').shadowRoot;
                return Object.fromEntries([...root.querySelectorAll('ui-button')]
                    .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]));
            });
            assert.deepEqual(state, {
                'move-left': true,
                delete: true,
                'insert-after': false,
                duplicate: false,
                'move-right': true,
            }, 'the only two live keys are the two that GROW the list');
        }, ONLY));

        /* THE DEPARTURE IS BOUNDED: at two steps delete comes back, on both of them. A
         * `minCount` that leaked upwards would make delete unreachable on a two-step
         * profile, which is a different bug wearing the same fix. */
        test('at two steps, delete is live again on both of them', () => mounted(async (page) => {
            const state = await page.evalFn(() => {
                const rail = document.getElementById('rail');
                const read = () => Object.fromEntries(
                    [...rail.shadowRoot.querySelectorAll('ui-button')]
                        .map((b) => [b.dataset.action, !!b.shadowRoot.querySelector('button')?.disabled]),
                );
                rail.count = 2;
                rail.index = 0;
                return rail.updateComplete.then(() => {
                    const first = read();
                    rail.index = 1;
                    return rail.updateComplete.then(() => ({ first, second: read() }));
                });
            });
            assert.equal(state.first.delete, false, 'step 1 of 2');
            assert.equal(state.second.delete, false, 'step 2 of 2');
            assert.equal(state.first['move-left'], true, 'and the edge rule is untouched');
            assert.equal(state.second['move-right'], true);
        }, ONLY));

        test('DEPARTURE 4: a dimmed glyph on the SAME ground as its live siblings',
            () => mounted(async (page) => {
                /* Slate's own words, profile-editor-v3.css:1076-1081, and the thing its
                 * shell rule then defeated with !important. Here it is structural. */
                const dimmedFace = await faceColour(page, 'move-left');
                const liveFace = await faceColour(page, 'delete');
                assert.equal(dimmedFace, liveFace,
                    'the face is painted by the seam cell UNDER the button, so the dial '
                    + 'cannot reach it — a faded face is what made Slate\'s two inert '
                    + 'arrows read as the skin\'s SELECTED treatment');
                assert.equal(dimmedFace, await page.resolveValue('var(--ui-fascia)', 'color'));
            }, FIRST));

        test('DEPARTURE 4: the dim is exactly --ui-opacity-disabled, applied once',
            () => mounted(async (page) => {
                const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                assert.equal(await page.prop(key('move-left'), 'opacity'), dial);
                assert.equal(await page.prop(key('delete'), 'opacity'), '1');
                /* Applied ONCE: #1 neutralises the inner control so .38 x .38 = .14
                 * cannot happen (ui-button.js). Measured on the rendered control. */
                assert.equal(await page.prop(control('move-left'), 'opacity'), '1');
            }, FIRST));

        test('token drill: the dim is the dial, not a fourth value', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.5',
                selector: key('move-left'),
                property: 'opacity',
                expected: '0.5',
            });
        }, FIRST));

        test('DEPARTURE 5: a disabled key refuses the press and leaves the tab order',
            () => mounted(async (page) => {
                await page.recordEvents('#rail', ['step-action']);
                await page.click(control('move-left'));
                await page.settle();
                assert.deepEqual(await page.recordedEvents(), [],
                    'the native disabled attribute refuses it — no pointer-events: none needed');
                const focusable = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    return [...root.querySelectorAll('ui-button')]
                        .filter((b) => !b.shadowRoot.querySelector('button').disabled)
                        .map((b) => b.dataset.action);
                });
                assert.deepEqual(focusable, ['delete', 'insert-after', 'duplicate', 'move-right']);
            }, FIRST));

        test('the whole rail can be disabled, and then all five are', () => mounted(async (page) => {
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            for (const action of ACTIONS) {
                assert.equal(await page.prop(key(action), 'opacity'), dial, action);
                assert.equal(await faceColour(page, action),
                    await page.resolveValue('var(--ui-fascia)', 'color'),
                    `${action}: still on the ground`);
            }
        }, OFF));

        /* -----------------------------------------------------------------
         * 5. NO SELECTION TREATMENT — the four dials belong to #3
         * ----------------------------------------------------------------- */

        test('selection cannot express: every spelling, on the host and on a key, moves nothing',
            () => mounted(async (page) => {
                const props = ['background-color', 'color', 'box-shadow', 'text-shadow',
                    'border-top-color', 'opacity'];
                const readAll = async () => ({
                    rail: await page.computed('#rail >>> .rail', props),
                    cell: await page.computed('#rail >>> .cell', props),
                    control: await page.computed(control('delete'), props),
                    glyph: await page.computed(glyph('delete'), props),
                });
                const before = await readAll();

                await page.evalFn(() => {
                    const rail = document.getElementById('rail');
                    const target = rail.shadowRoot.getElementById('key-delete');
                    for (const el of [rail, target]) {
                        el.setAttribute('aria-pressed', 'true');
                        el.setAttribute('aria-selected', 'true');
                        el.setAttribute('aria-checked', 'true');
                        el.setAttribute('aria-current', 'true');
                        el.classList.add('is-selected');
                    }
                });
                await page.settle();
                assert.deepEqual(await readAll(), before,
                    'CONVENTIONS §4: the four dials mean something only because there is '
                    + 'ONE selection component (#3). A key is pressed, not selected — and '
                    + 'Slate hit this from the other side, its inert arrows "looked filled, '
                    + 'which is the skin\'s selected treatment"');

                /* And the dials themselves are untouched by anything in this file. */
                for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                    '--ui-selected-led', '--ui-selected-glow']) {
                    const root = await page.tokenValue(dial);
                    const here = await page.evalFn((d) => getComputedStyle(
                        document.getElementById('rail').shadowRoot.querySelector('.rail'),
                    ).getPropertyValue(d).trim(), dial);
                    assert.equal(here, String(root).trim(), `${dial} is inherited, not re-pointed`);
                }
            }));

        /* -----------------------------------------------------------------
         * 6. E1's CLASS — the clip never has anything to clip
         * ----------------------------------------------------------------- */

        test('E1 cannot express: the slab clips for its radius and nothing overflows it',
            () => mounted(async (page) => {
                const m = await page.metrics('#rail >>> .rail');
                assert.equal(m.overflowX, 'hidden', 'the clip is deliberate — square keys, round slab');
                near(m.scrollWidth, m.clientWidth, 'nothing is cut horizontally');
                near(m.scrollHeight, m.clientHeight, 'nothing is cut vertically');
                /* The fifth key is inside the clip, not behind it — E1's actual symptom
                 * was a row you could not see. */
                const rail = await page.box('#rail >>> .rail');
                const lastKey = await page.box(key('move-right'));
                assert.ok(lastKey.right <= rail.right + 0.5,
                    `the last key ends at ${lastKey.right}, the slab at ${rail.right}`);
            }));

        test('container floor: squeezed to 120px the rank holds and still does not clip',
            () => mounted(async (page) => {
                const floorValue = await page.prop('#rail >>> .rail', 'min-inline-size');
                const floor = parseFloat(floorValue);
                await page.setStyle('#rail', { 'inline-size': '120px' });
                try {
                    const rail = await page.box('#rail >>> .rail');
                    assert.ok(rail.width >= floor - 0.5,
                        `the rank shrank past its stated floor — ${rail.width} against ${floor}. `
                        + 'T9: a control holds its stated size and a row that runs out of '
                        + 'space gives up where a reader can see');
                    const m = await page.metrics('#rail >>> .rail');
                    near(m.scrollWidth, m.clientWidth, 'still nothing cut inside the slab');
                    for (const action of ACTIONS) {
                        await assertHitFloor(page, control(action), { mode: 'paint' });
                    }
                } finally {
                    await page.setStyle('#rail', { 'inline-size': null });
                }
            }));

        /* -----------------------------------------------------------------
         * 7. FOCUS — one ring, inset, unclipped on all five (L24's class)
         * ----------------------------------------------------------------- */

        test('focus-unclipped: every key\'s ring survives the slab\'s overflow: hidden',
            () => mounted(async (page) => {
                for (const action of ACTIONS) {
                    await assertFocusUnclipped(page, control(action));
                }
            }));

        test('the ring is the INSET offset, which is why it survives', () => mounted(async (page) => {
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            await page.focusVisible(control('delete'));
            const g = await page.focusGeometry(control('delete'));
            assert.equal(g.outlineOffset, inset,
                'focus-ring="inset" on the host, because base.js declares '
                + '--_ui-focus-offset on :host and a value inherited from the rail '
                + 'would be overridden at each ui-button (base.js:436)');
        }));

        test('exactly one focus treatment: no second outline is authored anywhere',
            () => mounted(async (page) => {
                const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
                const ink = await page.resolveValue('var(--ui-steel)', 'outline-color');
                for (const action of ACTIONS) {
                    await page.focusVisible(control(action));
                    const g = await page.focusGeometry(control(action));
                    assert.equal(g.outlineWidth, width, action);
                    assert.equal(g.outlineColor, ink, action);
                }
            }));

        /* -----------------------------------------------------------------
         * 8. THE EVENT
         * ----------------------------------------------------------------- */

        test('a press fires step-action with the action, the index and the count',
            () => mounted(async (page) => {
                /* Recorded ONCE, before the loop: page.recordEvents() adds a listener
                 * every time it is called and clears only the log, so re-arming inside
                 * the loop doubles each subsequent event (measured — the second key
                 * reported two). One listener, five presses, one comparison. */
                await page.recordEvents('#rail', ['step-action']);
                for (const action of ACTIONS) {
                    await page.click(control(action));
                    await page.settle();
                }
                const events = await page.recordedEvents();
                assert.deepEqual(
                    events.map((e) => e.detail),
                    ACTIONS.map((action) => ({ action, index: 1, count: 4 })),
                    'one event per press, in press order, carrying the step it came from',
                );
            }));

        test('step-action is composed, bubbling and cancelable', () => mounted(async (page) => {
            const shape = await page.evalFn(async () => {
                const rail = document.getElementById('rail');
                let seen = null;
                document.addEventListener('step-action', (e) => { seen = e; }, { once: true });
                rail.shadowRoot.getElementById('key-duplicate')
                    .shadowRoot.querySelector('button').click();
                await new Promise((r) => setTimeout(r, 0));
                return seen && {
                    composed: seen.composed,
                    bubbles: seen.bubbles,
                    cancelable: seen.cancelable,
                    /* Retargeted to the host: a screen never sees the inner button. */
                    target: seen.target.tagName.toLowerCase(),
                };
            });
            assert.deepEqual(shape, {
                composed: true, bubbles: true, cancelable: true, target: 'ui-action-key-rail',
            }, 'cancelable so a screen can put #19 in front of delete, the shape #18 uses');
        }));

        /* -----------------------------------------------------------------
         * 9. ARIA
         * ----------------------------------------------------------------- */

        test('the rail is a named group and every key carries a name on the real control',
            () => mounted(async (page) => {
                const aria = await page.evalFn(() => {
                    const root = document.getElementById('rail').shadowRoot;
                    const rail = root.getElementById('rail');
                    return {
                        role: rail.getAttribute('role'),
                        name: rail.getAttribute('aria-label'),
                        keys: [...root.querySelectorAll('ui-button')].map((b) => ({
                            action: b.dataset.action,
                            /* #1 puts `label` on the inner <button>, where ARIA allows a
                             * name; the host stays an unnamed generic. */
                            onControl: b.shadowRoot.querySelector('button').getAttribute('aria-label'),
                            onHost: b.getAttribute('aria-label'),
                        })),
                        glyphsHidden: [...root.querySelectorAll('svg')]
                            .every((s) => s.getAttribute('aria-hidden') === 'true'),
                    };
                });
                assert.equal(aria.role, 'group');
                assert.equal(aria.name, 'Step actions');
                assert.deepEqual(aria.keys.map((k) => k.onControl), ACTIONS.map((a) => NAMES[a]),
                    'Slate names these already (profile_editor.js:2119-2123) — carried, and '
                    + 'the counterexample two rows over is E14, "32 grid +/- buttons share '
                    + 'two aria-labels, both UNTRANSLATED"');
                assert.deepEqual(aria.keys.map((k) => k.onHost), Array(5).fill(null));
                assert.equal(aria.glyphsHidden, true, 'the artwork is not the name');
            }));

        test('the group name is overridable, for "Step 3 actions"', () => mounted(async (page) => {
            const name = await page.evalFn(() => document.getElementById('rail')
                .shadowRoot.getElementById('rail').getAttribute('aria-label'));
            assert.equal(name, 'Step 3 actions');
        }, '<ui-action-key-rail id="rail" index="2" count="6" label="Step 3 actions"></ui-action-key-rail>'));

        /* -----------------------------------------------------------------
         * 10. THEME — E13 is the one oracle value not copied
         * ----------------------------------------------------------------- */

        for (const theme of ['dark', 'light']) {
            test(`E13 cannot express: the neutral key is --ui-muted in ${theme}`, () => mounted(
                async (page) => {
                    const muted = await page.resolveValue('var(--ui-muted)', 'color');
                    for (const action of ['move-left', 'duplicate', 'move-right']) {
                        assert.equal(await page.prop(glyph(action), 'color'), muted, action);
                    }
                    /* dark-mode.css:46-48's literal, written the way Chrome serialises
                     * it. It is not here in either theme, and in dark it is what Slate
                     * renders. */
                    for (const action of ACTIONS) {
                        assert.notEqual(await page.prop(glyph(action), 'color'), 'rgb(149, 149, 149)');
                    }
                },
                MID,
                { theme },
            ));

            test(`the measured Slate pairs reproduce in ${theme}`, () => mounted(
                async (page) => {
                    assert.equal(await page.prop('#rail >>> .rail', 'background-color'),
                        await page.resolveValue('var(--ui-line)', 'color'),
                        'CITE .pe-action-cell [i=210] background-color dark rgb(58, 72, 82) '
                        + '/ light rgb(203, 208, 211)');
                    assert.equal(await faceColour(page, 'delete'),
                        await page.resolveValue('var(--ui-fascia)', 'color'),
                        'CITE .pe-action-btn [i=213] background-color dark rgb(14, 19, 23) '
                        + '/ light rgb(242, 243, 243)');
                    assert.equal(await page.prop(glyph('insert-after'), 'color'),
                        await page.resolveValue('var(--ui-steel)', 'color'),
                        'CITE .pe-action-btn [i=213] color <- `.pe-act-add` authored '
                        + 'var(--slate-steel)');
                },
                MID,
                { theme },
            ));
        }

        /* -----------------------------------------------------------------
         * 11. THE GALLERY ENTRY, MOUNTED
         * ----------------------------------------------------------------- */

        test('every gallery state mounts, upgrades and renders five keys', () => mounted(async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `${state.id} must mount without throwing`);
                const rails = await page.evalFn(() => [...document.querySelectorAll('ui-action-key-rail')]
                    .map((r) => r.shadowRoot.querySelectorAll('ui-button').length));
                assert.ok(rails.length >= 1, `${state.id} renders at least one rail`);
                for (const n of rails) assert.equal(n, 5, `${state.id}: C7's five keys`);
            }
        }));
    });
}

/* One geometry-independent block: the entry's own shape. The render half above proves
 * the states work; this proves the hand-off to the gallery's single cross-cutting
 * writer is well formed. */
describe('ui-action-key-rail gallery entry', () => {
    test('the entry has the documented shape', () => {
        assert.equal(galleryEntry.id, 'ui-action-key-rail', 'the id is the tag and the capture prefix');
        assert.equal(galleryEntry.module, '../../src/components/ui-action-key-rail.js',
            'module is relative to tools/gallery/');
        assert.ok(galleryEntry.title && galleryEntry.notes);
        const ids = galleryEntry.states.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames and must be unique');
        for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
    });
});
