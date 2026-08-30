/**
 * ui-stop-button.render.test.mjs — Wave 4 item #47's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles, box geometry and BEHAVIOUR, never
 * source text, at BOTH standard geometries — 1281x801 @ dsf 1.5 and the 1000x600 floor
 * (CONVENTIONS §10, SCOPE Part 8 §2).
 *
 * WHAT THIS SUITE IS REALLY FOR. #47 is a safety control, and the two ways a safety
 * control fails are both invisible in a screenshot: it is there when it should not be,
 * or it is there and the press goes nowhere. So the load-bearing tests are the presence
 * contract (§1), the press contract (§7) and the four standing assertions — and each one
 * is written so that it could not pass against the implementations this row replaces:
 *
 *   §1  ABSENT, not hidden. Slate's own words for why: "no cost at all when nothing is
 *       running: the control does not exist then" (ui.js:3559-3561). A `display: none`
 *       button is still a focusable in the tree — P13's shape, "16 focusables reachable
 *       inside closed dialogs".
 *   §3  the token drill on all five values the Slate rule names, so a hard-coded red or
 *       a hard-coded 64 turns red here rather than at a fork.
 *   §4  the four selection dials driven to drill values move ZERO pixels. A momentary
 *       command has no selected state; the founding defect was thirteen selection
 *       components and six looks.
 *   §5  the one focus ring, unclipped, in both offsets — bug L24's class, and the reason
 *       the inset offset exists at all.
 *   §6  the container floor and the fluid display step, measured at both viewports and
 *       identical, which is what "reads its own container, never the viewport" means
 *       (spec §2.1 Rule 1).
 *   §8  a document sheet with !important aimed at every selector either implementation
 *       uses reaches NOTHING. Slate's entire look for this control lived in a SCREEN
 *       sheet (`#main-page .slate-rail-stop`, slate-live.css:1775-1795); the shadow
 *       boundary is what ends that, and it is asserted rather than assumed.
 *   §9  state is an attribute, never an inline style — bug L11's mechanism ("Two dimming
 *       systems fight over the rail … Inline wins"), made inexpressible.
 *
 * ORACLE. `prov_query.py find --cls slate-rail-stop`, `--id ghc-stop-btn-rail` and
 * `--id ghc-stop-btn` each return "found 0 element(s) in 0 state(s)" across all 49
 * states: the abort target ships `hidden` and no capture ever ran a machine. That is the
 * documented carve-out ("states outside the 49 … have no corpus answer at all"), so the
 * paint is a read-only source read of slate-live.css:1773-1797 whose TOKENS are cited
 * from elsewhere in the corpus — see the component header for the five CITE lines. Every
 * colour here is asserted against a resolved token, never a hex, so the suite is true in
 * both themes.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-stop-button.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-stop-button.js'];

/* The gallery's own loader, imported by absolute URL exactly as the harness server
 * serves it. Its relative imports resolve to /src/components/, so this is the one
 * module that defines every tag the entry's states put on a stage. */
const GALLERY_MODULE = ['/tools/gallery/entries/ui-stop-button.demo.js'];

/* Slate's rail is 430px wide at its frozen 1920x1200 capture and the rows it covers are
 * 268x64 (`find --cls slate-stepper` -> 85 elements in 16 states, every one 268x64 at
 * x=134). 430 is quoted as a real point on --ui-rail-w's clamp(320px, 26%, 460px), never
 * as a target: the stage states a width so that every measured number is the CONTAINER's
 * answer and the two viewport geometries must produce identical ones. */
const RAIL = 430;

const MARKUP = `
    <style>
      #stage { inline-size: ${RAIL}px; }
      /* A clipping band, for the L24 pair in §5. Nothing paints it: what matters is
         that it is overflow: hidden, which is what clips a ring. */
      #band { overflow: hidden; inline-size: ${RAIL}px; }
    </style>
    <div id="stage">
        <ui-stop-button id="live" running></ui-stop-button>
        <ui-stop-button id="idle"></ui-stop-button>
    </div>
    <div id="band">
        <ui-stop-button id="clipped" running focus-ring="inset"></ui-stop-button>
    </div>`;

const btn = (id) => `#${id} >>> button`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Everything a selection treatment could possibly move, plus the resting paint it would
 *  have to beat. Carried from ui-preset-bank / ui-tab-bar / ui-stepper on purpose: one
 *  library, one list, so the components that HAVE no selection are held to the same
 *  standard as the ones that do. */
const SELECTION_SURFACE_PROPERTIES = [
    'background-color', 'background-image', 'color', 'box-shadow', 'text-shadow',
    'opacity', 'border-top-width', 'border-top-color', 'border-top-left-radius',
    'font-weight', 'letter-spacing', 'min-height', 'outline-style', 'transform',
];

/** The shape of the shadow tree, read in one round trip. */
const SHAPE = (id) => `(${((hostId) => {
    const host = document.getElementById(hostId);
    const root = host.shadowRoot;
    const buttons = [...root.querySelectorAll('button')];
    const b = buttons[0] ?? null;
    return {
        buttons: buttons.length,
        /* Anything at all that could take a press or a tab stop. A second control in
         * here would be a second abort target, which is the bug this row retires. */
        interactive: root.querySelectorAll(
            'button, input, a[href], select, textarea, summary, [tabindex], [role]',
        ).length,
        hostRole: host.getAttribute('role'),
        hostAria: host.getAttribute('aria-label'),
        hostRunning: host.hasAttribute('running'),
        hostStyle: host.getAttribute('style'),
        text: b ? b.textContent.trim() : null,
        ariaLabel: b ? b.getAttribute('aria-label') : null,
        type: b ? b.getAttribute('type') : null,
        pressed: b ? b.getAttribute('aria-pressed') : null,
        selected: b ? b.getAttribute('aria-selected') : null,
        checked: b ? b.getAttribute('aria-checked') : null,
        current: b ? b.getAttribute('aria-current') : null,
        isSelected: b ? b.classList.contains('is-selected') : null,
        disabled: b ? b.hasAttribute('disabled') : null,
        /* Any inline style anywhere under this component — bug L11's mechanism. */
        inlineStyles: [...root.querySelectorAll('[style]')].length,
        accessibleName: host.accessibleName,
    };
}).toString()})(${JSON.stringify(id)})`;

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-stop-button @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
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
         * 1. PRESENCE — the control does not exist while nothing is running
         * =================================================================== */

        test('idle: no button, no focusable, no box — absent rather than hidden',
            () => mounted(async (page) => {
                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('idle')})`));
                assert.equal(shape.buttons, 0,
                    'Slate: "no cost at all when nothing is running: the control does not exist '
                    + 'then" (ui.js:3559-3561). A hidden-but-present button is still a tab stop.');
                assert.equal(shape.interactive, 0, 'nothing focusable is left behind');

                const host = await page.computed('#idle', ['display']);
                assert.equal(host.display, 'none',
                    'and the host takes no space either — a removed button in a live grid box '
                    + 'would still push the rail rows apart');
                const box = await page.box('#idle');
                near(box.height, 0, 'the idle host occupies no rows');
            }));

        test('running: exactly one button, and it is the only control in the component',
            () => mounted(async (page) => {
                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('live')})`));
                assert.equal(shape.buttons, 1, 'one abort target, not two');
                assert.equal(shape.interactive, 1, 'and nothing else here can be pressed or tabbed to');
                assert.equal(shape.type, 'button',
                    'type="button" as Slate wrote it (index.html:131) — a bare <button> in a form '
                    + 'is a submit button');
                assert.equal(shape.disabled, false,
                    'never disabled: "a dimmed Coffee button still took the tap" was the defect '
                    + '(ui.js:3566-3570); this control is present or absent');
            }));

        test('presence follows `running` in both directions, at runtime',
            () => mounted(async (page) => {
                await page.evalFn(() => { document.getElementById('idle').running = true; });
                await page.settle(2);
                assert.equal(await page.exists(btn('idle')), true, 'it appears when a run starts');

                await page.evalFn(() => { document.getElementById('idle').running = false; });
                await page.settle(2);
                assert.equal(await page.exists(btn('idle')), false, 'and is gone when the run ends');

                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('idle')})`));
                assert.equal(shape.hostRunning, false, 'the property reflects to the attribute');
                assert.equal(shape.inlineStyles, 0);
            }));

        /* ===================================================================
         * 2. THE PAINT IS THE MEASURED PAINT, EXPRESSED IN TOKENS
         * =================================================================== */

        test('the fill and the ink are --ui-status-danger on --ui-on-primary',
            () => mounted(async (page) => {
                /* CITE settings-machine-sleep---wake-schedules .slate-btn [i=72]
                 *      color = rgb(230, 102, 97) <- slate-components.css .slate-btn-danger
                 *      authored var(--slate-danger) (token-driven)
                 *      [prov-light: rgb(181, 28, 35)]  = --ui-status-danger
                 * CITE settings-machine-sleep---wake-schedules .slate-btn [i=100]
                 *      color = rgb(246, 251, 253) <- slate-components.css .slate-btn-primary
                 *      authored var(--slate-on-primary) [prov-light: rgb(248, 252, 253)]
                 * and slate-live.css:1787-1788 pairs exactly those two on this control. */
                const got = await page.computed(btn('live'), ['background-color', 'color']);
                assert.equal(got['background-color'], await page.resolveToken('--ui-status-danger', 'background-color'));
                assert.equal(got.color, await page.resolveToken('--ui-on-primary', 'color'));
            }));

        test('the box is --ui-control-h tall, square-cornered and borderless',
            () => mounted(async (page) => {
                /* CITE settings-maintenance-machine-descaling .slate-btn [i=43]
                 *      min-height = 64px <- slate-components.css .slate-btn authored
                 *      var(--slate-control-height) (token-driven) = --ui-control-h.
                 * slate-live.css:1783-1786: height: var(--slate-control-height);
                 * border: 0; border-radius: 0. */
                const got = await page.computed(btn('live'), [
                    'min-height', 'border-top-width', 'border-bottom-width',
                    'border-left-width', 'border-top-left-radius', 'border-top-right-radius',
                ]);
                assert.equal(got['min-height'], await page.resolveToken('--ui-control-h', 'min-height'));
                for (const [prop, value] of Object.entries(got)) {
                    if (prop === 'min-height') continue;
                    near(parseFloat(value), 0, `${prop} — a control that spans a band edge to edge takes the band's corners`);
                }
                const box = await page.box(btn('live'));
                near(box.height, 64, 'the rendered height is the control height');
            }));

        test('the type is the display step at --ui-weight-medium, tracked by --ui-tracking-cap',
            () => mounted(async (page) => {
                /* CITE expanded-charts #grind-value [i=21] font-size = 27px <-
                 *      slate-components.css .slate-stepper-value authored
                 *      var(--slate-display-xs) (token-driven) = --ui-display-xs.
                 * The .04em departure was reversed at parity surface 0; the tracking is
                 * Slate's own .12em, read from --ui-tracking-cap. */
                const got = await page.computed(btn('live'), ['font-size', 'font-weight', 'letter-spacing', 'text-transform']);
                assert.equal(got['font-weight'], await page.tokenValue('--ui-weight-medium'));
                const size = parseFloat(got['font-size']);
                near(parseFloat(got['letter-spacing']), size * 0.12,
                    'letter-spacing is --ui-tracking-cap (.12em), not a second hard-coded number');
                assert.equal(got['text-transform'], 'none',
                    'the caps are the translated word, not a transform that would shout in a '
                    + 'language whose casing rules say otherwise (D2)');
            }));

        /* ===================================================================
         * 3. TOKEN DRILL — five values, five tokens (Gate A standing assertion 1)
         * =================================================================== */

        test('every value in the Slate rule is drilled from its token', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-status-danger', value: DRILL_COLOUR,
                selector: btn('live'), property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-on-primary', value: DRILL_COLOUR,
                selector: btn('live'), property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-control-h', value: DRILL_LENGTH,
                selector: btn('live'), property: 'min-height',
            });
            await assertTokenDrill(page, {
                token: '--ui-display-xs', value: DRILL_LENGTH,
                selector: btn('live'), property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-tracking-cap', value: DRILL_LENGTH,
                selector: btn('live'), property: 'letter-spacing',
            });
        }));

        /* ===================================================================
         * 4. NO SELECTION TREATMENT — the dial drill, in its negative form
         * =================================================================== */

        test('the four selection dials move ZERO pixels here, and no aria selection state exists',
            () => mounted(async (page) => {
                /* The row has no selection: a momentary command is pressed, never chosen.
                 * The drill is still run, because "we did not add one" is a claim a
                 * screenshot cannot check and a fourteenth idiom is how the first
                 * thirteen happened (CONVENTIONS §4, spec §3.9). */
                const before = await page.computed(btn('live'), SELECTION_SURFACE_PROPERTIES);
                for (const [token, value] of [
                    ['--ui-selected-face', DRILL_COLOUR],
                    ['--ui-selected-ink', DRILL_COLOUR],
                    ['--ui-selected-led', DRILL_LENGTH],
                    ['--ui-selected-glow', '100%'],
                ]) await page.setToken(token, value);
                const after = await page.computed(btn('live'), SELECTION_SURFACE_PROPERTIES);
                for (const [token] of [
                    ['--ui-selected-face'], ['--ui-selected-ink'],
                    ['--ui-selected-led'], ['--ui-selected-glow'],
                ]) await page.setToken(token, null);

                assert.deepEqual(after, before,
                    'a selection dial changed this control — it has grown a selection surface it '
                    + 'has no state for');

                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('live')})`));
                assert.equal(shape.pressed, null, 'aria-pressed is a toggle contract; this is not a toggle');
                assert.equal(shape.selected, null);
                assert.equal(shape.checked, null);
                assert.equal(shape.current, null);
                assert.equal(shape.isSelected, false);
            }));

        /* ===================================================================
         * 5. FOCUS — one ring, two offsets, unclipped (standing assertion 4, bug L24)
         * =================================================================== */

        test('the focus ring is the token ring and nothing clips it', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, btn('live'));
            assert.ok(g.focusVisible);
        }));

        test('inside an overflow: hidden band the inset offset keeps the ring whole (bug L24)',
            () => mounted(async (page) => {
                /* L24 is "focus rings clipped on all four sides by the components they sit
                 * inside", and a control that spans its container edge to edge is the exact
                 * shape that meets it. The escape hatch is the base's, unmodified — one
                 * treatment in two offsets, never a second ring (CONVENTIONS §3). */
                const g = await assertFocusUnclipped(page, btn('clipped'));
                const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
                assert.equal(g.outlineOffset, inset,
                    'focus-ring="inset" is what the host asked for, and the base is what answers');
            }));

        /* ===================================================================
         * 6. THE CONTAINER DECIDES — floor, full width, fluid type
         * =================================================================== */

        test('it fills the container it is given and clears the touch floor',
            () => mounted(async (page) => {
                const stage = await page.box('#stage');
                const box = await page.box(btn('live'));
                near(box.width, stage.width, 'the full-width shot-abort control fills its box');
                await assertHitFloor(page, btn('live'), { mode: 'box' });
            }));

        test('squeezed to 200px it holds its floor and does not clip its word',
            () => mounted(async (page) => {
                /* The container floor. Slate never meets a narrow container — its geometry
                 * is frozen at 1920x1200 — so responsive behaviour has no oracle answer and
                 * LAYOUT_SPEC_DRAFT governs: §2.4, silent clipping is the inherited default
                 * the rewrite exists to stop; §3.7/§2.3, "ergonomics is physical", so the
                 * height floor never scales with the box. */
                await page.setStyle('#stage', { 'inline-size': '200px' });
                const box = await page.box(btn('live'));
                const m = await page.metrics(btn('live'));
                near(box.width, 200, 'still full width of whatever holds it');
                assert.ok(box.height >= 64 - 0.51,
                    `the control height floor held: ${box.height}px against 64px`);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                    `the word wraps rather than overflowing: scrollWidth ${m.scrollWidth} vs client ${m.clientWidth}`);
                await assertHitFloor(page, btn('live'), { mode: 'box' });
                await page.setStyle('#stage', { 'inline-size': null });
            }));

        test('the display step holds at 27px whatever the container and the viewport do',
            () => mounted(async (page) => {
                /* --ui-display-xs was clamp(22px, 2.2cqi, 27px), so this button typed
                 * itself at the 22px floor on a 430px rail and at 27px in a wide pane —
                 * the same control, two sizes, in the one place a STOP must not become
                 * quieter. Parity surface 0 made the token Slate's fixed 27px (its own
                 * declared --slate-display-xs, which was already the clamp's ceiling).
                 * The probe is kept and inverted: the size must now be identical at both
                 * container widths AND at both viewports, which is the stronger claim. */
                await page.setStyle('#stage', { 'inline-size': `${RAIL}px` });
                const atRail = parseFloat(await page.prop(btn('live'), 'font-size'));
                near(atRail, 27, 'on a 430px rail the STOP still types at 27px');

                await page.setStyle('#stage', { 'inline-size': '1240px' });
                const wide = parseFloat(await page.prop(btn('live'), 'font-size'));
                near(wide, 27, 'and at 1240px it is the same 27px — Slate\'s --slate-display-xs');
                near(wide, atRail, 'one control, one size');

                await page.setStyle('#stage', { 'inline-size': `${RAIL}px` });
            }));

        /* ===================================================================
         * 7. THE PRESS — what a screen actually consumes
         * =================================================================== */

        test('a real press leaves exactly one stop-request, composed and bubbling',
            () => mounted(async (page) => {
                /* Recorded on the STAGE, not on the host: an event only arrives there if it
                 * both bubbles and is composed, so the listener placement is the assertion. */
                await page.recordEvents('#stage', [ 'stop-request', 'click' ]);
                await page.click(btn('live'));
                const events = await page.recordedEvents();
                const stops = events.filter((e) => e.type === 'stop-request');
                assert.equal(stops.length, 1, 'one press, one ask');
                assert.deepEqual(stops[0].detail, { reason: 'press' });
                assert.ok(events.some((e) => e.type === 'click'),
                    'the native click composes and retargets on its own — a screen may listen to '
                    + 'either, and stop-request is the one that says what it means');
            }));

        test('a second press is a second request — no debounce, nothing swallowed',
            () => mounted(async (page) => {
                await page.recordEvents('#stage', ['stop-request']);
                await page.click(btn('live'));
                await page.click(btn('live'));
                const stops = (await page.recordedEvents()).filter((e) => e.type === 'stop-request');
                assert.equal(stops.length, 2,
                    '"I pressed stop and nothing happened" must never become "I pressed stop twice '
                    + 'and nothing happened"; coalescing belongs to the transport, not here');
            }));

        test('the keyboard presses it too, through the native button', () => mounted(async (page) => {
            await page.recordEvents('#stage', ['stop-request']);
            await page.focusVisible(btn('live'));
            await page.press('Enter');
            await page.press(' ');
            const stops = (await page.recordedEvents()).filter((e) => e.type === 'stop-request');
            assert.equal(stops.length, 2, 'Enter and Space, from the element being a real <button>');
        }));

        test('focus() goes inward to the control, and is a no-op while the control is absent',
            () => mounted(async (page) => {
                const focused = await page.evalFn(() => {
                    const host = document.getElementById('live');
                    host.focus();
                    const active = host.shadowRoot.activeElement;
                    return active ? active.tagName.toLowerCase() : null;
                });
                assert.equal(focused, 'button', 'CONVENTIONS §11: forwarded, not delegatesFocus');

                const threw = await page.evalFn(() => {
                    try { document.getElementById('idle').focus(); return false; } catch { return true; }
                });
                assert.equal(threw, false, 'focusing an absent control is a no-op, not a throw');
            }));

        /* ===================================================================
         * 8. THE LOOK IS UNREACHABLE FROM OUTSIDE
         * =================================================================== */

        test('a screen sheet with !important on every selector either implementation uses reaches nothing',
            () => mounted(async (page) => {
                /* Slate's whole rule for this control is a SCREEN sheet rule —
                 * `#main-page .slate-rail-stop` in slate-live.css — which is why the look and
                 * the screen could never be separated, and why P8's "a screen sheet reached a
                 * component and flattened its fill" was possible at all. The mechanism that
                 * ends it is not a stronger selector; it is the boundary. */
                const before = await page.computed(btn('live'), [
                    'background-color', 'color', 'min-height', 'letter-spacing', 'font-size',
                ]);
                await page.evalFn(() => {
                    const sheet = document.createElement('style');
                    sheet.textContent = `
                        button, .stop, #stop, .slate-rail-stop,
                        ui-stop-button button, ui-stop-button .stop {
                            background-color: rgb(0, 255, 0) !important;
                            color: rgb(0, 255, 0) !important;
                            min-height: 5px !important;
                            letter-spacing: 9px !important;
                            font-size: 9px !important;
                        }
                        ui-stop-button { color: rgb(0, 255, 0) !important; }
                    `;
                    document.head.append(sheet);
                });
                await page.settle(2);
                const after = await page.computed(btn('live'), [
                    'background-color', 'color', 'min-height', 'letter-spacing', 'font-size',
                ]);
                assert.deepEqual(after, before,
                    'a document rule reached inside the shadow root — including the inherited '
                    + '`color`, which crosses the boundary and is answered by the component '
                    + 'stating its own ink');
            }));

        /* ===================================================================
         * 9. STATE IS AN ATTRIBUTE, NEVER AN INLINE STYLE  (bug L11's mechanism)
         * =================================================================== */

        test('nothing here writes an inline style for state (bug L11 cannot express)',
            () => mounted(async (page) => {
                /* L11: "Two dimming systems fight over the rail: the class rule deliberately
                 * exempts #dose-section, and ui.js:3490-3491 then writes inline opacity: 0.25
                 * onto it during espresso. Inline wins." The rewrite's rule is one owner per
                 * visual state, expressed as a reflected attribute; an inline style for state
                 * is banned (SCOPE Part 5 §1). */
                for (const running of [false, true, false, true]) {
                    await page.evalFn((r) => { document.getElementById('live').running = r; }, running);
                    await page.settle(1);
                    const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('live')})`));
                    assert.equal(shape.hostStyle, null, 'no inline style on the host');
                    assert.equal(shape.inlineStyles, 0, 'and none anywhere inside it');
                    assert.equal(shape.hostRunning, running, 'the state IS the attribute');
                }
            }));

        /* ===================================================================
         * 10. NAME AND TRANSLATION
         * =================================================================== */

        test('the accessible name is Slate\'s own string, on the button, and the host keeps none',
            () => mounted(async (page) => {
                /* index.html:131 aria-label="Stop the machine". The visible word is "STOP",
                 * so the name contains the label (WCAG label-in-name) and says what the
                 * machine does rather than shouting a verb at a screen reader. */
                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('live')})`));
                assert.equal(shape.text, 'STOP');
                assert.equal(shape.ariaLabel, 'Stop the machine');
                assert.equal(shape.hostRole, null, 'the host takes no role of its own');
                assert.equal(shape.hostAria, null,
                    'and carries no second copy of the name — bug L23 symptom 1 is "aria-label '
                    + 'on role-less <div>s"');
                assert.equal(shape.accessibleName, 'Stop the machine');
            }));

        test('a screen-written aria-label is MOVED onto the button, and label="" hands the name to the words',
            () => mounted(async (page) => {
                await page.mount(
                    `<div id="stage">
                        <ui-stop-button id="named" running aria-label="Stop the steam"></ui-stop-button>
                        <ui-stop-button id="wordy" running label="">Abort</ui-stop-button>
                     </div>`,
                    MODULE,
                );
                await page.settle(3);
                const named = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('named')})`));
                assert.equal(named.ariaLabel, 'Stop the steam', 'moved to the element carrying the role');
                assert.equal(named.hostAria, null, 'and not left on the role-less host to announce twice');
                assert.equal(named.accessibleName, 'Stop the steam');

                const wordy = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('wordy')})`));
                assert.equal(wordy.ariaLabel, null,
                    'label="" is a real answer: the visible words become the name');
                assert.equal(wordy.accessibleName, '');
                const slotted = await page.evalFn(() => document
                    .getElementById('wordy').shadowRoot.querySelector('slot')
                    .assignedNodes().map((n) => n.textContent.trim()).join(''));
                assert.equal(slotted, 'Abort', 'and the slotted verb is what renders');
            }));

        test('D2: the word and the name are translated values, not a document walk',
            () => mounted(async (page) => {
                /* "translation as a value each component reads, per-language files generated
                 * at build time" (SCOPE Part 5, D2). The old mechanism was
                 * document.querySelectorAll('[data-i18n-key]'), which cannot cross a shadow
                 * boundary at all — so this is not a nicety, it is the only thing that works. */
                await page.eval(`(async () => {
                    const m = await import('/src/lib/i18n.js');
                    m.translations.set('xx', { 'STOP': 'ARRET', 'Stop the machine': 'Arreter la machine' });
                    return true;
                })()`);
                await page.settle(3);
                const shape = JSON.parse(await page.eval(`JSON.stringify(${SHAPE('live')})`));
                assert.equal(shape.text, 'ARRET', 'the visible word followed the language');
                assert.equal(shape.ariaLabel, 'Arreter la machine', 'and so did the accessible name');
            }));

        /* ===================================================================
         * 11. THE GALLERY'S SUBJECTS ARE REAL
         * =================================================================== */

        test('every gallery state mounts and leaves something to photograph',
            () => browser.withPage({ geometry }, async (page) => {
                /* Loaded through the DEMO module, which is what the gallery itself imports —
                 * and the reason the demo module exists. gallery.js awaits
                 * customElements.whenDefined() on every hyphenated tag on the stage, so the
                 * rail states mounted with only ui-stop-button.js loaded do not render a
                 * plain box: they never settle at all. (Measured here first: the suite hung
                 * until this line named the module that imports ui-stepper too.) */
                for (const state of galleryEntry.states) {
                    await page.mount(`<div id="stage">${state.html}</div>`, GALLERY_MODULE);
                    await page.settle(3);
                    assert.deepEqual(page.pageErrors, [], `${galleryEntry.id}--${state.id} threw`);
                    const children = await page.evalFn(() =>
                        document.getElementById('stage').childElementCount);
                    assert.ok(children > 0, `${state.id} mounted nothing`);
                }
            }));
    });
}
