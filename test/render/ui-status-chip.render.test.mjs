/**
 * ui-status-chip.render.test.mjs — Wave 1 item #48's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles and box geometry only, never
 * source text, at BOTH standard geometries — 1281×801 @ dsf 1.5 and the 1000×600
 * floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. The chip's defect is bug L13 (spec §7.2,
 * LAYOUT_SPEC_DRAFT.md:1112): "`.slate-chart-state` styles a class no element
 * carries" (slate-live.css:1738-1745). That is the hardest class of defect to see,
 * because dead CSS renders exactly like no CSS: a screenshot gate cannot tell a
 * second design from an absent one, and a reviewer reading the sheet sees a rule
 * that looks fine. The oracle proves it in one query —
 *
 *     prov_query.py find --cls slate-chart-state
 *       corpus prov-baseline (dark); searched 49 state(s); found 0 element(s)
 *       in 0 state(s); "0 elements matched anywhere in this corpus."  exit=1
 *
 * — against the chip that IS on screen:
 *
 *     prov_query.py find --id machine-status
 *       found 7 element(s) in 7 state(s); one distinct geometry, 161 x 22  x7
 *
 * So the headline assertion here is the literal inverse of the bug: every class
 * this component's own stylesheet authors is carried by a rendered node. That is
 * checkable, mechanical, and it is what "build one, not two" (SCOPE.md:1524) means
 * as a test rather than as an intention.
 *
 * EVERY STARTING VALUE IS THE ORACLE'S, quoted in ui-status-chip.js's header block.
 * Colours are asserted against the resolved token, never against a hex, so the suite
 * is true in both themes — which matters here because the oracle's themes table says
 * "17 of 18 properties identical across themes; 1 differ (color)".
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-status-chip.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-status-chip.js'];

const READY = '<ui-status-chip id="ready">Ready</ui-status-chip>';
const DISCONNECTED = '<ui-status-chip id="off">Disconnected</ui-status-chip>';
const LIVE = '<ui-status-chip id="live" live>Live</ui-status-chip>';
const MARKUP = `${READY} ${DISCONNECTED} ${LIVE}`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/**
 * The pulse runs forever, so every opacity read on the dot is a value in flight.
 * Nothing in this suite asserts opacity except the two motion tests at the end,
 * which read the ANIMATION rather than a frame of it; the reduced-motion test uses
 * the emulation below, which the component honours (CONVENTIONS §11).
 */
async function reduceMotion(page) {
    await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await page.settle(1);
}

/**
 * The L13 audit, done in the page: pull THIS component's own stylesheet out of the
 * shadow root's adopted sheets (the base prepends its own, so identify ours by the
 * keyframes name only this file declares), collect every class token every selector
 * in it names — inside @media too — and report which of them match a rendered node.
 *
 * Selector text is read from the CSSOM, not from the file, so a class that is
 * renamed in the template and not in the CSS is caught the same way as one that was
 * never carried at all.
 */
const CLASS_AUDIT = `(() => {
    const hosts = Array.from(document.querySelectorAll('ui-status-chip'));
    const root = hosts[0].shadowRoot;
    const sheets = Array.from(root.adoptedStyleSheets);
    const own = sheets.filter((s) => Array.from(s.cssRules)
        .some((r) => (r.cssText || '').indexOf('ui-status-chip-pulse') !== -1));
    const selectorTexts = [];
    const declares = {};
    const walk = (rules) => {
        for (const r of rules) {
            if (typeof r.selectorText === 'string' && r.style) {
                selectorTexts.push(r.selectorText);
                for (const prop of r.style) {
                    declares[prop] = (declares[prop] || 0) + 1;
                }
            }
            if (r.cssRules && !(r.name)) walk(r.cssRules);
        }
    };
    for (const s of own) walk(s.cssRules);

    const classes = new Set();
    for (const sel of selectorTexts) {
        const m = sel.match(/\\.[A-Za-z_-][A-Za-z0-9_-]*/g) || [];
        for (const c of m) classes.add(c.slice(1));
    }
    const carried = [];
    const orphaned = [];
    for (const c of classes) {
        const hit = hosts.some((h) => h.shadowRoot.querySelector('.' + c) !== null);
        (hit ? carried : orphaned).push(c);
    }
    return JSON.stringify({
        sheets: sheets.length,
        ownSheets: own.length,
        selectors: selectorTexts.length,
        classes: Array.from(classes).sort(),
        carried: carried.sort(),
        orphaned: orphaned.sort(),
        declares,
    });
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-status-chip @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /** Real animation, no emulation — only the two motion tests want this. */
        const animated = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, []);
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

        /* -------------------------------------------------------------------
         * L13 — the bug, asserted dead.
         * ----------------------------------------------------------------- */

        test('L13 cannot express: every class this component styles is carried by a node',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(CLASS_AUDIT));

                assert.equal(a.ownSheets, 1,
                    'the audit must find exactly one sheet of this component\'s own; ' +
                    `saw ${a.ownSheets} of ${a.sheets} adopted`);
                assert.ok(a.classes.length >= 3,
                    `expected the chip, label and dot classes at least; saw ${JSON.stringify(a.classes)}`);
                assert.deepEqual(a.orphaned, [],
                    'L13 (spec §7.2, slate-live.css:1738-1745): ' +
                    `${JSON.stringify(a.orphaned)} is styled here and carried by no element. ` +
                    'That is the defect verbatim — prov_query.py find --cls slate-chart-state ' +
                    'returned "0 elements matched anywhere in this corpus" across all 49 states.');
                assert.deepEqual(a.carried.slice().sort(), a.classes.slice().sort());
            }));

        test('L13 cannot express: the chip\'s type is declared once, not twice',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(CLASS_AUDIT));
                /* Slate's two chips disagreed on every line of type: the live rule is
                 * --slate-text-md / 600 / .08em, the dead one --slate-text-cap /
                 * --slate-weight-semibold / --slate-tracking-cap. Two designs for one
                 * job is what made the dead one invisible. One declaration site each. */
                for (const prop of ['font-size', 'font-weight', 'letter-spacing',
                    'line-height', 'text-transform']) {
                    assert.equal(a.declares[prop], 1,
                        `${prop} is declared ${a.declares[prop]} times in this component; ` +
                        'one job, one rule (L13).');
                }
            }));

        test('L13 cannot express: the dot is absent, not merely unpainted, when not live',
            () => mounted(async (page) => {
                assert.equal(await page.count('#ready >>> .dot'), 0,
                    'a resting chip must render no dot node at all');
                assert.equal(await page.count('#live >>> .dot'), 1,
                    'a live chip renders exactly one dot');
                /* Departure 4: a real element rather than Slate\'s ::before, so the
                 * dot\'s absence is structural and the class audit above can see it. */
                assert.equal(await page.prop('#live >>> .dot', 'content', { pseudo: '::before' }), 'none',
                    'the dot is a real element; nothing here leans on a generated box');
            }));

        /* -------------------------------------------------------------------
         * Oracle parity — the measured starting values.
         * ----------------------------------------------------------------- */

        test('the resting chip is the oracle\'s: muted ink, 18px, uppercase',
            () => mounted(async (page) => {
                const got = await page.computed('#ready >>> .chip',
                    ['color', 'font-size', 'text-transform', 'letter-spacing', 'font-weight']);

                /* CITE live-ready #machine-status [i=94] color = rgb(148, 161, 169)
                   <- slate-live.css `#main-page #machine-status` authored
                      `var(--slate-muted)` !important=no (token-driven);
                   themes: dark rgb(148, 161, 169) / light rgb(90, 101, 108). */
                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'),
                    'the ink is --ui-muted, so it is right in both themes by construction');

                /* CITE live-ready #machine-status [i=94] font-size = 18px
                   <- authored `var(--slate-text-md)` !important=yes (token-driven). */
                assert.equal(got['font-size'], await page.resolveToken('--ui-text-md', 'font-size'));
                near(parseFloat(got['font-size']), 18, 'font-size is the oracle\'s 18px');

                /* CITE live-ready #machine-status [i=94] text-transform = uppercase
                   <- authored `uppercase` !important=no (FROZEN/hardcoded). */
                assert.equal(got['text-transform'], 'uppercase');

                /* SLATE-INCONSISTENT, and this chip is one of the elements that proves
                   it. Slate declares ONE `--slate-tracking-cap: .12em`
                   (slate-tokens.css:153) and then hand-writes a different value
                   wherever it feels like it: the oracle reads 1.44px here from a
                   hardcoded .08em (live-ready #machine-status [i=94]), .04em on
                   .slate-sheet-title, .01em in notes-modal and slate-shell, and
                   .11/.09/.08/.06/.03/.02em across profile-editor-v3. Rendered census
                   over the 49 baseline states: .12em on 190 elements, .1em on 68,
                   .09em on 38, and single-figure counts for the rest.

                   ONE COMPONENT, ONE TOKEN, and the value picked is Slate's own
                   --slate-tracking-cap .12em — its declared token, its 190-element
                   majority, and the Live page's own microcap value (the rail labels
                   render 2.04px at 17px and the gauge labels 1.8px at 15px, both .12em,
                   on the same screen as this chip). Cross-screen consistency is the one
                   improvement Ben named; reproducing Slate's per-element drift would be
                   the opposite of it. So this chip gains 0.72px of tracking and now
                   agrees with every other microcap in the skin.

                   MEASURED, and a trap for the next builder with an em-valued token:
                   resolveToken('--ui-tracking-cap', 'letter-spacing') resolves against a
                   neutral probe at the document's 16px, and an em tracking is relative
                   to the ELEMENT's font size, 18px here. So an em token is asserted as
                   arithmetic against the rendered font-size, and the drill below is what
                   proves the token is actually read. */
                near(parseFloat(got['letter-spacing']),
                    0.12 * parseFloat(got['font-size']),
                    'tracking is --ui-tracking-cap (.12em) against the rendered 18px');
                near(parseFloat(got['letter-spacing']), 2.16, 'which is 2.16px');

                /* DEPARTURE 1 IS CLOSED (parity surface 1) — the oracle reads a hardcoded
                   600 and the chip now renders 600. The scale had 400/500/700 on the
                   authority of spec §3.5, whose own citation (slate-tokens.css:148-153)
                   declares four weights with --slate-weight-semibold: 600, and whose
                   same sentence surface 0 had already caught mis-transcribing
                   --slate-tracking-cap. Asserted as the TOKEN as well as the value, so
                   the role and the number cannot drift apart. */
                assert.equal(got['font-weight'], '600');
                assert.equal(got['font-weight'], await page.resolveToken('--ui-weight-semibold', 'font-weight'));
            }));

        test('the chip\'s line box is the oracle\'s 21.5938px, in both themes',
            () => mounted(async (page) => {
                /* CITE live-ready #machine-status [i=94] height = 21.5938px
                     <- (no declaration — inherited or initial value) (token-driven)
                   `height` is one of the eighteen properties the corpus probes, and
                   the themes table says 17 of 18 are identical across themes (only
                   color differs), so this is a FROZEN measurement.
                   Slate produces it with slate-live.css:912 `line-height: 1.2
                   !important` on 18px type; this component declares the same ratio
                   with no !important. Drop that one declaration and the chip renders
                   at the UA's `normal` — 23px — because Decal's document layer has
                   no leading of its own (Slate inherits Tailwind's preflight 1.5,
                   output.css:53-54). Asserted on the HOST as well as the chip: the
                   host is inline-flex around it, so a regression in either shows. */
                const ORACLE_HEIGHT = 21.5938;
                for (const theme of ['dark', 'light']) {
                    await page.setTheme(theme);
                    near((await page.box('#ready >>> .chip')).height, ORACLE_HEIGHT,
                        `${theme}: the chip's line box`, 0.05);
                    near((await page.box('#ready')).height, ORACLE_HEIGHT,
                        `${theme}: the host is exactly its chip`, 0.05);
                }
                await page.setTheme('dark');

                /* The ratio, not just the outcome: 1.2 × the rendered font size, so a
                   font-size change keeps the proportion and a re-drop of the leading
                   (computed `normal`) fails even if some other change happens to land
                   the box near 21.6px. */
                const cs = await page.computed('#ready >>> .chip', ['line-height', 'font-size']);
                assert.notEqual(cs['line-height'], 'normal',
                    'the leading is declared here, or Slate\'s frozen height is not reproduced');
                near(parseFloat(cs['line-height']), 1.2 * parseFloat(cs['font-size']),
                    'slate-live.css:912 line-height: 1.2 on the oracle\'s 18px', 0.05);

                /* The live chip is the same box: the 10px dot is shorter than the line
                   box and flex-centred, so the pulse must not move the header band. */
                near((await page.box('#live')).height, ORACLE_HEIGHT,
                    'the pulse does not change the chip\'s height', 0.05);
            }));

        test('the chip is not a pill: every decoration the oracle measures is zero',
            () => mounted(async (page) => {
                const got = await page.computed('#ready >>> .chip', [
                    'background-color', 'box-shadow',
                    'border-top-width', 'border-top-left-radius',
                    'padding-left', 'padding-top',
                ]);
                /* CITE live-ready #machine-status [i=94] background-color = rgba(0, 0, 0, 0)
                   / box-shadow = none / border-top-left-radius = 0px / border-top-width = 0px
                   / padding-left = 0px  <- (no declaration — inherited or initial value),
                   identical in prov-light. Inventing a fill here would be inventing a
                   design, not porting one. */
                assert.deepEqual(got, {
                    'background-color': 'rgba(0, 0, 0, 0)',
                    'box-shadow': 'none',
                    'border-top-width': '0px',
                    'border-top-left-radius': '0px',
                    'padding-left': '0px',
                    'padding-top': '0px',
                });
            }));

        test('the dot is Slate\'s: 10px, pill, --ui-status-danger, --ui-space-2 away',
            () => mounted(async (page) => {
                const dot = await page.box('#live >>> .dot');
                near(dot.width, 10, 'dot inline size');
                near(dot.height, 10, 'dot block size');
                assert.equal(dot.width, dot.height, 'the dot is square, so the pill radius is a circle');

                const style = await page.computed('#live >>> .dot', ['background-color', 'border-top-left-radius']);
                assert.equal(style['background-color'],
                    await page.resolveToken('--ui-status-danger', 'background-color'),
                    'slate-live.css:1839 background: var(--slate-danger) -> --ui-status-danger');
                assert.ok(parseFloat(style['border-top-left-radius']) >= dot.width / 2 - 0.51,
                    'spec §3.4: any radius >= half the height is the same circle; ' +
                    `got ${style['border-top-left-radius']} on a ${dot.width}px box`);

                const gap = await page.prop('#live >>> .chip', 'column-gap');
                assert.equal(gap, await page.resolveToken('--ui-space-2', 'column-gap'));
                near(parseFloat(gap), 8, 'slate-live.css:1837 margin-right: var(--slate-space-2) = 8px');

                /* One dot, one label, in that order — the pulse leads the words the
                 * way Slate's ::before did. Placement is outside the oracle's
                 * 18-property surface, so this is the source read, asserted. */
                const label = await page.box('#live >>> .label');
                assert.ok(dot.left < label.left, 'the dot leads the words');
            }));

        /* -------------------------------------------------------------------
         * Token drills — the standing Gate A assertion, seven of them.
         * ----------------------------------------------------------------- */

        test('token drill: --ui-muted moves the ink', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-muted', value: DRILL_COLOUR,
            selector: '#ready >>> .chip', property: 'color',
        })));

        test('token drill: --ui-text-md moves the type size', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-text-md', value: DRILL_LENGTH,
            selector: '#ready >>> .chip', property: 'font-size',
        })));

        test('token drill: --ui-tracking-cap moves the tracking', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-tracking-cap', value: DRILL_LENGTH,
            selector: '#ready >>> .chip', property: 'letter-spacing',
        })));

        test('token drill: --ui-weight-semibold moves the weight', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-weight-semibold', value: '250',
            selector: '#ready >>> .chip', property: 'font-weight',
        })));

        test('token drill: --ui-space-2 moves the dot-to-word gap', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-space-2', value: DRILL_LENGTH,
            selector: '#live >>> .chip', property: 'column-gap',
        })));

        test('token drill: --ui-status-danger moves the pulse ink', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-status-danger', value: DRILL_COLOUR,
            selector: '#live >>> .dot', property: 'background-color',
        })));

        test('token drill: --ui-radius-pill moves the dot\'s corner', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-radius-pill', value: '2px',
            selector: '#live >>> .dot', property: 'border-top-left-radius',
        })));

        test('the private geometry is a --_ui- knob, not a token and not a literal',
            () => mounted(async (page) => {
                /* CONVENTIONS §7: internals are --_ui-*, so the token-integrity scan
                 * for var(--ui- can never mistake one for a missing token. It is still
                 * a knob: a document-tree rule on the host beats the :host declaration
                 * by CSS Scoping, whatever the specificity. */
                await page.setStyle('#live', { '--_ui-dot-size': '18px' });
                const grown = await page.box('#live >>> .dot');
                near(grown.width, 18, 'an outside rule retunes --_ui-dot-size');
                await page.setStyle('#live', { '--_ui-dot-size': '' });
                near((await page.box('#live >>> .dot')).width, 10, 'and it goes back to 10px');
            }));

        /* -------------------------------------------------------------------
         * Focus geometry from --ui-focus-*, unclipped (bug L24's class).
         * ----------------------------------------------------------------- */

        test('the ring is --ui-focus-* and nothing here clips it', () => mounted(async (page) => {
            /* The chip takes no focus of its own — it is a readout, and its row cites
             * neither Appendix 5 nor a hit floor. When a screen makes it focusable the
             * base ring applies unmodified; what this asserts is that the component
             * puts nothing in its way. Bug L24 is rings "clipped on all four sides by
             * the components they sit inside" (spec §3.6). */
            await assertFocusUnclipped(page, '#focusable');
        }, `<ui-status-chip id="focusable" tabindex="0" live>Live</ui-status-chip>`));

        test('the ring is the outset offset: nothing here is an overflow: hidden band',
            () => mounted(async (page) => {
                /* Focus FIRST. Chrome computes outline-offset: 0px on an unfocused
                 * element whatever the :focus-visible rule says, so a read without
                 * focusVisible() measures the resting outline and a broken ring looks
                 * like a passing test — CONVENTIONS §10's measured fact 1, in the
                 * shape it actually bites. */
                await page.focusVisible('#focusable');
                const g = await page.focusGeometry('#focusable');
                assert.ok(g.focusVisible, 'the host takes focus when a screen gives it a tabindex');
                assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'),
                    'no reason for the inset variant: this component clips nothing');
            }, `<ui-status-chip id="focusable" tabindex="0">Ready</ui-status-chip>`));

        /* -------------------------------------------------------------------
         * Container behaviour — read your own box, never the viewport.
         * ----------------------------------------------------------------- */

        test('the host shrinks to its words rather than filling its slot',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '600px' });
                const mount = await page.box('#mount');
                const host = await page.box('#ready');
                assert.ok(host.width < mount.width - 100,
                    'CONVENTIONS §2: container-type: normal, because a chip that must ' +
                    `shrink to fit its glyph cannot be size-contained. host ${host.width} ` +
                    `in ${mount.width}`);
                const chip = await page.box('#ready >>> .chip');
                near(chip.width, host.width, 'the host is exactly its chip');
            }));

        test('at a narrow container the words wrap and nothing overflows',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '120px' });
                const wide = await page.box('#off');

                const host = await page.box('#off');
                const m = await page.metrics('#mount');
                assert.ok(host.width <= m.clientWidth + 0.51,
                    'DEPARTURE 3: max-inline-size: 100% — the chip may become taller, ' +
                    `never wider than what holds it. host ${host.width} in ${m.clientWidth}`);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                    `nothing spills sideways: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`);
                assert.ok(host.height > 24,
                    'the word wrapped rather than being clipped — §2.4 removes the ' +
                    `inherited hidden default. height ${host.height}`);
                assert.ok(wide, 'read taken');
            }));

        test('the dot never shrinks and never wraps away from the words',
            () => mounted(async (page) => {
                await page.setStyle('#mount', { 'inline-size': '90px' });
                const dot = await page.box('#live >>> .dot');
                near(dot.width, 10, 'flex: none — the dot is not words');
                near(dot.height, 10, 'flex: none, both axes');
                const label = await page.box('#live >>> .label');
                assert.ok(dot.top < label.bottom && dot.bottom > label.top,
                    'the dot stays on the first line beside the first word');
            }));

        test('no width media query anywhere: the chip is identical at both geometries',
            () => mounted(async (page) => {
                /* The real cross-geometry comparison is the test at the end of the
                 * file; this one asserts the mechanism — the component reads its own
                 * container, so a fixed container gives a fixed answer whatever the
                 * viewport is (SCOPE Part 4 ground rule 2). */
                await page.setStyle('#mount', { 'inline-size': '400px' });
                const host = await page.box('#ready');
                assert.ok(host.width > 0 && host.width < 400);
                const cs = await page.prop('#ready', 'container-type');
                assert.equal(cs, 'normal', 'the documented one-line opt-out, CONVENTIONS §2');
            }));

        /* -------------------------------------------------------------------
         * The aria contract (Appendix 15's half of the state model).
         * ----------------------------------------------------------------- */

        test('the host is a polite live region, and the dot is not announced',
            () => mounted(async (page) => {
                assert.equal(await page.prop('#ready', 'display'), 'inline-flex');
                const roles = JSON.parse(await page.eval(`JSON.stringify({
                    ready: document.getElementById('ready').getAttribute('role'),
                    live: document.getElementById('live').getAttribute('role'),
                    dot: document.getElementById('live').shadowRoot.querySelector('.dot').getAttribute('aria-hidden'),
                })`));
                /* DEPARTURE 5. Slate's chip is a bare div rewritten in place, so
                 * READY -> DISCONNECTED reaches nobody — the class of defect logged as
                 * O9 and C14 ("the display is updated by innerHTML with no aria-live").
                 * Appendix 15 keeps Slate's aria-driven state contract; this is its
                 * missing half. role="status" carries polite + atomic implicitly. */
                assert.equal(roles.ready, 'status');
                assert.equal(roles.live, 'status');
                assert.equal(roles.dot, 'true', 'the pulse is decoration; the words carry the meaning');
            }));

        test('an author-chosen role is left alone', () => mounted(async (page) => {
            const role = await page.eval(
                'document.getElementById("quiet").getAttribute("role")',
            );
            assert.equal(role, 'presentation',
                'a chip beside a heading that already announces should stay silent');
        }, '<ui-status-chip id="quiet" role="presentation">Ready</ui-status-chip>'));

        test('the live flag reflects, so a screen can lay it out from outside',
            () => mounted(async (page) => {
                const state = JSON.parse(await page.eval(`(() => {
                    const el = document.getElementById('ready');
                    const before = el.hasAttribute('live');
                    el.live = true;
                    return el.updateComplete.then(() => JSON.stringify({
                        before,
                        after: el.hasAttribute('live'),
                        dots: el.shadowRoot.querySelectorAll('.dot').length,
                    }));
                })()`));
                assert.deepEqual(state, { before: false, after: true, dots: 1 });
            }));

        /* -------------------------------------------------------------------
         * Motion — the two tests with no emulation, so the animation is real.
         * ----------------------------------------------------------------- */

        test('the pulse is Slate\'s 1.6s ease-in-out breathe', () => animated(async (page) => {
            const got = await page.computed('#live >>> .dot',
                ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count']);
            /* slate-live.css:1840, read read-only: the corpus never captured the pulse
               (all seven #machine-status records read text "Disconnected", live-pulling
               included), so this is the source, not a measurement. */
            assert.equal(got['animation-name'], 'ui-status-chip-pulse');
            assert.equal(got['animation-duration'], '1.6s');
            assert.equal(got['animation-timing-function'], 'ease-in-out');
            assert.equal(got['animation-iteration-count'], 'infinite');
        }));

        test('reduced motion stops the pulse and keeps the dot', () => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            await page.mount(MARKUP, MODULE);
            /* CONVENTIONS §11 hands this to "each animating component" and this is the
             * first one. It needs no !important — the later rule wins the tie (§6). */
            assert.equal(await page.prop('#live >>> .dot', 'animation-name'), 'none');
            const dot = await page.box('#live >>> .dot');
            near(dot.width, 10, 'the dot stays: it is the only mark that says a shot is happening');
            assert.equal(await page.prop('#live >>> .dot', 'opacity'), '1');
        }));

        /* -------------------------------------------------------------------
         * The gallery entry.
         * ----------------------------------------------------------------- */

        test('every gallery state mounts and renders a chip', () => browser.withPage({ geometry }, async (page) => {
            await reduceMotion(page);
            for (const state of galleryEntry.states) {
                await page.mount(state.html, MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ui-status-chip--${state.id} threw`);
                assert.ok(await page.count('ui-status-chip') >= 1,
                    `gallery state ui-status-chip--${state.id} mounted nothing`);
                assert.ok(await page.exists('ui-status-chip >>> .chip'),
                    `gallery state ui-status-chip--${state.id} rendered no chip`);
            }
        }));
    });
}

/* ---------------------------------------------------------------------------
 * Node-side: the entry's shape. tools/gallery/entries.js is a SHARED file and
 * sixteen builders doing whole-file writes on it would clobber each other, so this
 * entry lives in its own file and the gate wires it in. That hand-off is the moment
 * a malformed entry would first be noticed — unless it is checked here, where the
 * builder can still fix it.
 * ------------------------------------------------------------------------- */

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-status-chip', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-status-chip.js',
        'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

/* ---------------------------------------------------------------------------
 * Cross-geometry: the chip is tokens, not a fraction of the viewport.
 * ------------------------------------------------------------------------- */

test('the chip renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await reduceMotion(page);
        await page.mount(MARKUP, MODULE);
        await page.setStyle('#mount', { 'inline-size': '400px' });
        const host = await page.box('#ready');
        const dot = await page.box('#live >>> .dot');
        const type = await page.computed('#ready >>> .chip', ['font-size', 'letter-spacing', 'font-weight']);
        return {
            dpr: await page.eval('devicePixelRatio'),
            width: Math.round(host.width * 100) / 100,
            height: Math.round(host.height * 100) / 100,
            dot: [dot.width, dot.height],
            type,
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        [bench.width, bench.height, bench.dot, bench.type],
        [floor.width, floor.height, floor.dot, floor.type],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same chip',
    );
    assert.deepEqual(bench.dot, [10, 10]);
    assert.equal(bench.type['font-size'], '18px', 'the oracle\'s 18px at both geometries');
});
