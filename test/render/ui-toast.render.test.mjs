/**
 * ui-toast.render.test.mjs — Wave 3 item #22's rendering suite.
 *
 * Gate A: headless Chrome over CDP, computed styles and box geometry only, never
 * source text, at BOTH standard geometries — 1281×801 @ dsf 1.5 and the 1000×600
 * floor (CONVENTIONS §10).
 *
 * WHAT THIS SUITE IS REALLY FOR. #22 is a NEW SURFACE: the corpus has no answer for
 * it, mechanically —
 *
 *     prov_query.py find --cls toast     → 0 element(s) in 0 state(s), all 49 searched
 *     prov_query.py find --id app-toast  → 0 element(s) in 0 state(s), all 49 searched
 *
 * — because Slate ships both toast containers `display: none` in markup
 * (index.html:645, :657) and shows them only from script, so the capture battery never
 * caught either. There is therefore nothing to compare a screenshot against, and no
 * measured value to reproduce. Every assertion below is either (a) a SOURCE READ from
 * Slate with a file:line, (b) a token from the Step 0 spec, or (c) a BEHAVIOUR — and
 * (c) is the half that matters here, because a toast surface fails in ways a picture
 * cannot show: a region that eats every press underneath it, a clock that never fires,
 * a stack that silently drops the message you needed, an exit animation that leaves the
 * node in the DOM forever. All four are asserted.
 *
 * The wave's own review addition (Part 10 §9) asks w3 to assert that no `@font-face`
 * sits in component styles; that is the last describe block, run against this
 * component's own adopted sheet rather than against its source text.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-toast.entry.js';
import { assertTokenDrill, assertFocusUnclipped, DRILL_LENGTH } from '../harness/assertions.js';

const MODULE = ['/src/components/ui-toast.js'];

/**
 * One sticky notice of each tone, plus a plain one. `duration="0"` = never expires
 * (ui.js:3307 `if (duration > 0)`), and `max-visible="0"` lifts the default cap of
 * three — otherwise mounting four would retire the first before any assertion ran,
 * which is itself asserted, on its own markup, further down.
 */
const TONES = `
<ui-toast id="t1" max-visible="0">
  <div id="n-info" duration="0">Shot stopped: 27.4s</div>
  <div id="n-ok" tone="ok" duration="0">Scale tared</div>
  <div id="n-warn" tone="warn" duration="0">Offline: displaying cached profiles</div>
  <div id="n-danger" tone="danger" duration="0">Scale lost - stop at weight disabled</div>
</ui-toast>`;

/** The fullscreen-prompt shape (index.html:645-656): rich content and two controls. */
const RICH = `
<ui-toast id="t1" max-visible="0">
  <div id="n-rich" duration="0">
    <strong>Fullscreen Recommended</strong>
    <button id="b-go">Enter Fullscreen</button>
    <button id="b-later" data-ui-toast-dismiss>Later</button>
  </div>
</ui-toast>`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/**
 * Pull THIS component's own stylesheet out of the shadow root's adopted sheets and
 * report what it declares. Identified by the private property only this file writes,
 * so the base's sheet (which is prepended to every component) is never mistaken for it.
 * Read from the CSSOM, not from the file — Gate A asserts on the rendered result, and
 * a rule that was renamed in the template but not in the CSS is caught the same way as
 * one that was never carried.
 */
const SHEET_AUDIT = `(() => {
    const host = document.getElementById('t1');
    const sheets = Array.from(host.shadowRoot.adoptedStyleSheets);
    const own = sheets.filter((s) => Array.from(s.cssRules)
        .some((r) => (r.cssText || '').indexOf('--_ui-toast-inset') !== -1));
    const selectors = [];
    const atRules = [];
    const declares = {};
    const important = [];
    const walk = (rules) => {
        for (const r of rules) {
            if (r.constructor && /FontFace/.test(r.constructor.name)) atRules.push('font-face');
            if (typeof r.conditionText === 'string') atRules.push(r.conditionText);
            if (typeof r.selectorText === 'string' && r.style) {
                selectors.push(r.selectorText);
                for (const prop of r.style) {
                    declares[prop] = (declares[prop] || 0) + 1;
                    if (r.style.getPropertyPriority(prop)) important.push(r.selectorText + ' { ' + prop + ' }');
                }
            }
            if (r.cssRules) walk(r.cssRules);
        }
    };
    for (const s of own) walk(s.cssRules);
    return JSON.stringify({ sheets: sheets.length, ownSheets: own.length, selectors, atRules, declares, important });
})()`;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-toast @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = TONES) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        const inset = async (page) => parseFloat(await page.resolveToken('--ui-space-4', 'margin-top'));

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
         * THE LAYER. Item #22's row: "Transient notice on the --ui-z-toast layer."
         * ----------------------------------------------------------------- */

        test('the region is pinned bottom-centre on the --ui-z-toast layer',
            () => mounted(async (page) => {
                const got = await page.computed('#t1', ['position', 'z-index', 'pointer-events']);
                assert.equal(got.position, 'fixed',
                    'the toast layer pins itself; a screen does not have to wrap it');
                /* §3.7: --ui-z-toast is 300, replacing index.html:645/:657 (10000/10001).
                 * Asserted as the token so a literal creeping back in fails here. */
                assert.equal(got['z-index'], await page.resolveToken('--ui-z-toast', 'z-index'));
                assert.equal(got['z-index'], '300');
                /* DEPARTURE 5 — an empty toast layer is physically not there. */
                assert.equal(got['pointer-events'], 'none');

                const box = await page.box('#t1');
                const pad = await inset(page);
                /* The LAYOUT viewport, which is what a fixed box is inset from — not
                 * innerWidth, which counts a scrollbar the layout viewport does not. */
                const vp = JSON.parse(await page.eval(
                    'JSON.stringify({w: document.documentElement.clientWidth, h: document.documentElement.clientHeight})',
                ));
                near(box.left, pad, 'inset-inline-start is --ui-space-4');
                near(box.width, vp.w - 2 * pad, 'the region spans the viewport less both insets');
                near(box.bottom, vp.h - pad, 'the region is pinned to the bottom edge');
            }));

        test('the notices are pressable even though the region is not',
            () => mounted(async (page) => {
                assert.equal(await page.prop('#n-info', 'pointer-events'), 'auto');
                /* The real hit test, not the computed value: CDP dispatches at viewport
                 * coordinates and Chrome decides what is under them. This is the half a
                 * screenshot cannot see — a region that swallows presses looks perfect. */
                const under = await page.eval(`(() => {
                    const r = document.getElementById('t1').getBoundingClientRect();
                    const el = document.elementFromPoint(r.left + 4, r.top + 4);
                    return el ? el.id || el.tagName.toLowerCase() : null;
                })()`);
                assert.notEqual(under, 't1',
                    'a point inside the region but outside a notice must fall through to the page');
            }));

        test('placement="top" moves the pin and reverses the column, so the newest is still nearest the edge',
            () => mounted(async (page) => {
                await page.evalFn(() => document.getElementById('t1').setAttribute('placement', 'top'));
                await page.settle(2);
                const pad = await inset(page);
                const box = await page.box('#t1');
                near(box.top, pad, 'inset-block-start is --ui-space-4');
                assert.equal(await page.prop('#t1 >>> .stack', 'flex-direction'), 'column-reverse');
                /* The last child in the DOM is the newest; at the top it must be the
                 * highest box on screen. */
                const first = await page.box('#n-info');
                const last = await page.box('#n-danger');
                assert.ok(last.top < first.top,
                    `newest (${last.top}) must sit above oldest (${first.top}) at placement="top"`);
            }));

        test('anchor="container" hands the layer to a positioned ancestor',
            () => mounted(async (page) => {
                const got = await page.computed('#t1', ['position']);
                assert.equal(got.position, 'absolute');
                const panel = await page.box('#panel');
                const region = await page.box('#t1');
                const pad = await inset(page);
                near(region.left, panel.left + pad, 'inset from the PANEL, not the window');
                near(region.bottom, panel.bottom - pad, 'pinned to the PANEL bottom');
                assert.ok(region.width < geometry.width,
                    'a container-anchored region must not span the viewport');
            }, `<div id="panel" style="position: relative; inline-size: 420px; block-size: 300px">
                  <ui-toast id="t1" anchor="container"><div id="n1" duration="0">Cup warmer on</div></ui-toast>
                </div>`));

        /* -------------------------------------------------------------------
         * STACKING — DEPARTURE 3. Slate's showToast has one element and does
         * `messageEl.textContent = message` (ui.js:3290), so the second toast in a
         * burst destroys the first and restarts its clock.
         * ----------------------------------------------------------------- */

        test('four notices stack in a column at the --ui-space-2 gap, none overlapping',
            () => mounted(async (page) => {
                const gap = parseFloat(await page.resolveToken('--ui-space-2', 'margin-top'));
                near(gap, 8, 'DaisyUI .toast gap: .5rem');
                assert.equal(await page.prop('#t1 >>> .stack', 'flex-direction'), 'column');
                near(parseFloat(await page.prop('#t1 >>> .stack', 'row-gap')), gap, 'the stack gap');

                const boxes = [];
                for (const id of ['#n-info', '#n-ok', '#n-warn', '#n-danger']) boxes.push(await page.box(id));
                for (let i = 1; i < boxes.length; i++) {
                    assert.ok(boxes[i].top >= boxes[i - 1].bottom - 0.51,
                        `notice ${i} overlaps the one above it (${boxes[i].top} < ${boxes[i - 1].bottom})`);
                    near(boxes[i].top - boxes[i - 1].bottom, gap, `gap between notice ${i - 1} and ${i}`);
                }
                /* All four are still on screen: the whole point of stacking. */
                assert.ok(boxes[0].top > 0, 'the stack has not run off the top of the window');
            }));

        /* CHANGED 29 AUGUST 2026, audit F-014 — one of six in this file. Each asserted
         * the dismissal REASON off a `ui-toast-dismiss` event that nothing in `src/`
         * heard; the emit is removed and the assertion is re-anchored on the DOM, which
         * is where a person reads the same fact. The old line here was:
         *
         *     const reasons = (await page.recordedEvents()).map((e) => e.detail.reason);
         *     assert.deepEqual(reasons, ['overflow']);
         *
         * The behaviour it labelled — the OLDEST of three goes when a fourth arrives —
         * is asserted three lines above it and is untouched. What is added in its place
         * is the F-014 assertion proper: the region announces NOTHING. */
        test('the default cap is three, the OLDEST goes, and nothing is announced',
            () => mounted(async (page) => {
                assert.equal(await page.evalFn(() => document.getElementById('t1').maxVisible), 3,
                    'DEFAULT_MAX_VISIBLE, with no attribute written');
                await page.recordEvents('#t1', ['ui-toast-dismiss']);
                await page.evalFn(() => document.getElementById('t1').show('newest', { duration: 0 }));
                /* The retired notice plays out first — DEPARTURE 9's exit is
                 * --ui-dur-slow — so the DOM is read after that, not after a raf. */
                await sleep(400);
                await page.settle(2);

                const state = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    return {
                        live: t.notices.length,
                        ids: [...t.children].map((c) => c.id || c.textContent.trim()),
                    };
                });
                assert.equal(state.live, 3, `cap is 3; saw ${JSON.stringify(state.ids)}`);
                assert.ok(!state.ids.includes('n-a'), 'the oldest goes first');
                assert.ok(state.ids.includes('newest'), 'the newest is the one being read');
                /* THE DEFECT THIS REPLACES, ui.js:3287-3290: one element, so the second
                 * toast in a burst overwrites the first and restarts its clock. The drop
                 * this region makes instead is visible in the three ids above — and it
                 * is not announced, because nothing was ever listening (F-014). */
                assert.deepEqual(await page.recordedEvents(), [],
                    'a retirement is the region\'s own business: no ui-toast-dismiss');
            }, `<ui-toast id="t1">
                  <div id="n-a" duration="0">Scale Not Found</div>
                  <div id="n-b" duration="0">Scale tared</div>
                  <div id="n-c" duration="0">Cup warmer on</div>
                </ui-toast>`));

        test('max-visible="0" is no cap at all', () => mounted(async (page) => {
            const live = await page.evalFn(() => {
                const t = document.getElementById('t1');
                t.setAttribute('max-visible', '0');
                for (let i = 0; i < 6; i++) t.show(`m${i}`, { duration: 0 });
                return t.notices.length;
            });
            assert.equal(live, 10, 'four mounted plus six shown, none retired');
        }));

        /* -------------------------------------------------------------------
         * THE CLOCK. ui.js:3283 `duration = 2400`; :3307 `if (duration > 0)`.
         * ----------------------------------------------------------------- */

        test('duration="0" is sticky — Slate\'s own `if (duration > 0)`',
            () => mounted(async (page) => {
                await sleep(600);
                assert.equal(await page.count('#n-info'), 1, 'a sticky notice does not expire');
            }));

        /* CHANGED 29 AUGUST 2026, audit F-014. Old title: "a notice with a duration
         * leaves on its own, and says why". Old last two lines:
         *
         *     const reasons = (await page.recordedEvents()).map((e) => e.detail.reason);
         *     assert.deepEqual(reasons, ['timeout']);
         *
         * "Leaves on its own" is the whole claim and it is asserted by the count above,
         * which is the fact the clock is responsible for. */
        test('a notice with a duration leaves on its own, silently',
            () => mounted(async (page) => {
                await page.recordEvents('#t1', ['ui-toast-dismiss']);
                await page.evalFn(() => document.getElementById('t1').show('Shot uploaded successfully!', { duration: 120 }));
                assert.equal(await page.evalFn(() => document.getElementById('t1').notices.length), 5);
                await sleep(700);
                await page.settle(2);
                assert.equal(await page.evalFn(() => document.getElementById('t1').notices.length), 4,
                    'the timed notice is gone and the four sticky ones are not');
                assert.deepEqual(await page.recordedEvents(), [],
                    'the clock expiring is not an announcement (F-014)');
            }));

        test('an unreadable duration falls back rather than becoming sticky',
            () => mounted(async (page) => {
                /* The failure this guards: `duration="soon"` → Number() → NaN → a timer
                 * that never fires → an overlay that never leaves. */
                await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    const n = document.createElement('div');
                    n.setAttribute('duration', 'soon');
                    n.textContent = 'bad duration';
                    /* appendChild, not show(): adoption then runs through the
                     * MutationObserver, whose callback is a microtask, so the count is
                     * read after a settle rather than on the next line. */
                    t.appendChild(n);
                });
                await page.settle(2);
                assert.equal(await page.evalFn(() => document.getElementById('t1').notices.length), 5);
                /* 2400ms is the fallback, so it is still here at 700ms and the assertion
                 * costs no more wall clock than the test above. */
                await sleep(700);
                assert.equal(await page.evalFn(
                    () => [...document.getElementById('t1').children].some((c) => c.textContent === 'bad duration'),
                ), true, 'still showing at 700ms, so the fallback is 2400 and not 0');
            }));

        test('DEPARTURE 7 — the clock pauses while focus is inside the notice',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    const n = document.createElement('div');
                    n.setAttribute('duration', '600');
                    n.innerHTML = '<button id="pause-me">Later</button>';
                    t.appendChild(n);
                    document.getElementById('pause-me').focus();
                });
                await sleep(1000);
                assert.equal(await page.count('#pause-me'), 1,
                    'a 600ms notice has outlived its clock twice over, because focus is in it');

                await page.evalFn(() => document.getElementById('pause-me').blur());
                await sleep(900);
                await page.settle(2);
                assert.equal(await page.count('#pause-me'), 0,
                    'and it leaves once focus does — the remaining time, not a fresh clock');
            }));

        /* -------------------------------------------------------------------
         * DISMISSAL — DEPARTURE 6. Slate's #app-toast has no affordance at all, and
         * the machine is a wall panel with no keyboard.
         * ----------------------------------------------------------------- */

        /* CHANGED 29 AUGUST 2026, audit F-014. Old last line:
         *     assert.deepEqual((await page.recordedEvents()).map((e) => e.detail.reason), ['tap']);
         * The dismissal itself is the line above it — the node is gone from the DOM. */
        test('pressing the card dismisses it', () => mounted(async (page) => {
            await page.recordEvents('#t1', ['ui-toast-dismiss']);
            await page.click('#n-info', { offset: { x: 8, y: 8 } });
            await sleep(400);
            await page.settle(2);
            assert.equal(await page.count('#n-info'), 0);
            assert.deepEqual(await page.recordedEvents(), [],
                'the press is answered by the node leaving, not by an event (F-014)');
        }));

        test('pressing a control INSIDE the card does not', () => mounted(async (page) => {
            await page.recordEvents('#t1', ['ui-toast-dismiss']);
            await page.click('#b-go');
            await page.settle(2);
            assert.equal(await page.count('#n-rich'), 1,
                'index.html:653 "Enter Fullscreen" must still be pressable — that is the '
                + 'whole reason the toast takes content rather than a string');
            /* Held after F-014 rather than deleted with the emit: it is now two claims
             * in one — nothing is dismissed, AND nothing is announced. */
            assert.deepEqual(await page.recordedEvents(), []);
        }, RICH));

        /* CHANGED 29 AUGUST 2026, audit F-014. Old last line:
         *     assert.deepEqual((await page.recordedEvents()).map((e) => e.detail.reason), ['action']);
         * The attribute's whole job is that the notice goes, which the count asserts. */
        test('and a control marked data-ui-toast-dismiss does — Slate\'s "Later" button',
            () => mounted(async (page) => {
                await page.recordEvents('#t1', ['ui-toast-dismiss']);
                await page.click('#b-later');
                await sleep(400);
                await page.settle(2);
                assert.equal(await page.count('#n-rich'), 0);
                assert.deepEqual(await page.recordedEvents(), [],
                    'the marked control dismisses; it does not report (F-014)');
            }, RICH));

        test('dismiss() and clear() are the programmatic half, and both empty the DOM',
            () => mounted(async (page) => {
                await page.recordEvents('#t1', ['ui-toast-dismiss']);
                /* CHANGED 29 AUGUST 2026, audit F-014: was `t.dismiss(el, 'api')`. The
                 * second parameter went with the announcement it filled in. An extra
                 * argument would still be harmless — this is written the way the API
                 * now reads. */
                const ok = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    return t.dismiss(document.getElementById('n-ok'));
                });
                assert.equal(ok, true);
                await sleep(400);
                await page.settle(2);
                assert.equal(await page.count('#n-ok'), 0);

                await page.evalFn(() => document.getElementById('t1').clear());
                await sleep(400);
                await page.settle(2);
                const left = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    return { notices: t.notices.length, children: t.children.length };
                });
                /* THE FAILURE THIS EXISTS FOR: a component that plays an exit animation
                 * and forgets to remove the node leaves an invisible, press-eating box on
                 * the top layer forever. children, not just notices. */
                assert.deepEqual(left, { notices: 0, children: 0 });

                /* F-014, the fifth and last of the departures that used to carry a
                 * reason ('api'). FIVE notices left the DOM in this test and the region
                 * said nothing about any of them — which is the whole disposition, on
                 * the path a consumer drives DELIBERATELY rather than by a clock or a
                 * finger. If a consumer ever does need to know, it asked for these
                 * removals itself and already knows. */
                assert.deepEqual(await page.recordedEvents(), [],
                    'dismiss() and clear() do what they are told and report nothing back');
            }));

        /* RETITLED 29 AUGUST 2026, audit F-014 — was "a notice the consumer takes back
         * is not reported as a dismissal". Nothing is reported as a dismissal any more,
         * so the old title read as a claim about this case when it is now true of every
         * case. What is specific to THIS case, and what the test was always really for,
         * is that the clock is released with the node. */
        test('a notice the consumer takes back releases its clock',
            () => mounted(async (page) => {
                await page.recordEvents('#t1', ['ui-toast-dismiss']);
                await page.evalFn(() => document.getElementById('n-warn').remove());
                await page.settle(2);
                const state = await page.evalFn(() => document.getElementById('t1').notices.length);
                assert.equal(state, 3, 'the clock goes with the node');
                assert.deepEqual(await page.recordedEvents(), [],
                    'and it is silent, as every departure now is (F-014)');
            }));

        test('moving the region in the DOM does not orphan the notices it is holding',
            () => mounted(async (page) => {
                /* THE FAILURE THIS EXISTS FOR: a DOM move is a disconnect followed by a
                 * connect, and adoption is idempotent by the state attribute — so a
                 * region that left its marks on disconnect would come back holding
                 * nothing, pace nothing and dismiss nothing, while the notices sat there
                 * looking perfectly correct. Invisible to every screenshot. */
                const after = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    const box = document.createElement('section');
                    document.getElementById('mount').appendChild(box);
                    box.appendChild(t);
                    return { notices: t.notices.length, children: t.children.length };
                });
                await page.settle(2);
                assert.deepEqual(after, { notices: 4, children: 4 },
                    'every notice is still paced after the move');
                assert.equal(await page.prop('#n-info', 'opacity'), '1',
                    'and none of them came back mid-transition');
            }));

        /* -------------------------------------------------------------------
         * TONE — DEPARTURE 1, the measured one.
         * ----------------------------------------------------------------- */

        test('every tone is ink and edge from a token, in both themes',
            () => mounted(async (page) => {
                for (const theme of ['dark', 'light']) {
                    await page.setTheme(theme);
                    const pairs = [
                        ['#n-info', '--ui-text', '--ui-line'],
                        ['#n-ok', '--ui-status-ok', '--ui-status-ok'],
                        ['#n-warn', '--ui-tint-power', '--ui-tint-power'],
                        ['#n-danger', '--ui-status-danger', '--ui-status-danger'],
                    ];
                    for (const [sel, ink, edge] of pairs) {
                        const got = await page.computed(sel, ['color', 'border-top-color', 'background-color']);
                        assert.equal(got.color, await page.resolveToken(ink, 'color'), `${theme} ${sel} ink`);
                        assert.equal(got['border-top-color'], await page.resolveToken(edge, 'color'), `${theme} ${sel} edge`);
                        /* The card face is the SAME in every tone. Slate fills it with the
                         * status colour and writes --slate-on-primary on top, which in dark
                         * measures 1.83 / 3.13 / 2.07 against a 4.5 floor. */
                        assert.equal(got['background-color'], await page.resolveToken('--ui-surface', 'color'),
                            `${theme} ${sel}: tone must not change the card face`);
                    }
                }
                await page.setTheme('dark');
            }));

        test('an unknown tone is the info treatment, not an unpainted card',
            () => mounted(async (page) => {
                await page.evalFn(() => document.getElementById('n-ok').setAttribute('tone', 'catastrophe'));
                await page.settle(2);
                const got = await page.computed('#n-ok', ['color', 'background-color']);
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                assert.equal(got['background-color'], await page.resolveToken('--ui-surface', 'color'));
            }));

        test('the tone ink is read from the token, not copied', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-status-danger', selector: '#n-danger', property: 'color',
            });
        }));

        test('the layer number and the stack gap are read from tokens, not copied',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-z-toast', value: '37', expected: '37',
                    selector: '#t1', property: 'z-index',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-2', value: DRILL_LENGTH,
                    selector: '#t1 >>> .stack', property: 'row-gap',
                });
            }));

        /* -------------------------------------------------------------------
         * THE CARD — source reads, and DEPARTURE 2.
         * ----------------------------------------------------------------- */

        test('the card is the source reads: 22px type, hairline edge, floating radius, elevation',
            () => mounted(async (page) => {
                const got = await page.computed('#n-info', [
                    'font-size', 'border-top-width', 'border-top-left-radius', 'box-shadow',
                    'padding-left', 'box-sizing',
                ]);
                /* index.html:658 `class="text-[22px] font-['Inter']"`. The family is NOT
                 * carried: styles/document.css owns the one face (CONVENTIONS §7). */
                assert.equal(got['font-size'], await page.resolveToken('--ui-text-nav', 'font-size'));
                near(parseFloat(got['font-size']), 22, 'text-[22px]');
                /* DaisyUI .alert border-width: 1px → --ui-border-w, itself
                 * var(--ui-hairline). Resolved through margin-top and NOT through
                 * border-top-width: the harness's probe declares no border-style, and a
                 * border width with no style computes to 0px however it was authored —
                 * so the naive form asserts 1px === 0px and reads as a missing edge. */
                near(parseFloat(got['border-top-width']),
                    parseFloat(await page.resolveToken('--ui-border-w', 'margin-top')),
                    'the edge is --ui-border-w');
                near(parseFloat(got['border-top-width']), 1, 'DaisyUI .alert border-width: 1px');
                /* DaisyUI --rounded-box 1rem → the scale's floating-surface step, §3.4. */
                assert.equal(got['border-top-left-radius'],
                    await page.resolveToken('--ui-radius-xl', 'border-top-left-radius'));
                near(parseFloat(got['border-top-left-radius']), 12, '--ui-radius-xl');
                assert.notEqual(got['box-shadow'], 'none', 'index.html:646 shadow-lg → --ui-elev-2');
                /* DEPARTURE 8: DaisyUI 1rem = 16px, and the scale has no 16. */
                assert.equal(got['padding-left'], await page.resolveToken('--ui-space-4', 'padding-left'));
                near(parseFloat(got['padding-left']), 18, '--ui-space-4');
                /* The base's inherit chain covers the SHADOW tree; a slotted node is in
                 * the document tree, so this is declared rather than inherited. */
                assert.equal(got['box-sizing'], 'border-box');
            }));

        test('DEPARTURE 2 — a long message wraps instead of leaving the window',
            () => mounted(async (page) => {
                await page.evalFn(() => document.getElementById('t1').show(
                    'Machine did not accept the target temperature, and the value shown on the '
                    + 'rail has been corrected from the machine snapshot; pull a shot to confirm.',
                    { duration: 0 },
                ));
                await page.settle(4);
                const region = await page.box('#t1');
                const long = await page.box('#t1 > div:last-child');
                const one = await page.box('#n-ok');
                assert.equal(await page.prop('#t1 > div:last-child', 'overflow-wrap'), 'anywhere');
                assert.ok(long.width <= region.width + 0.51,
                    `the notice (${long.width}) must not exceed the region (${region.width})`);
                assert.ok(long.height > one.height,
                    'a long message gets taller — DaisyUI is white-space: nowrap, which gets WIDER');
                assert.ok(long.left >= region.left - 0.51 && long.right <= region.right + 0.51,
                    'and stays inside the inset box at both geometries');
            }));

        /* -------------------------------------------------------------------
         * ARIA — DEPARTURE 4.
         * ----------------------------------------------------------------- */

        test('the region is a persistent polite live region and the danger notice is the alert',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    return {
                        role: t.getAttribute('role'),
                        live: t.getAttribute('aria-live'),
                        atomic: t.getAttribute('aria-atomic'),
                        danger: document.getElementById('n-danger').getAttribute('role'),
                        info: document.getElementById('n-info').getAttribute('role'),
                        ok: document.getElementById('n-ok').getAttribute('role'),
                    };
                });
                /* ui.js:3298-3305, carried: error|alert → assertive, everything else
                 * polite. Applied per notice, because the container's own politeness
                 * cannot be rewritten per message once messages stack. */
                assert.deepEqual(got, {
                    role: 'status', live: 'polite', atomic: 'false',
                    danger: 'alert', info: null, ok: null,
                });
            }));

        test('the region never rewrites its own politeness, however the stack changes',
            () => mounted(async (page) => {
                const after = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    t.clear();
                    t.show('Scale tared', { tone: 'ok', duration: 0 });
                    return { role: t.getAttribute('role'), live: t.getAttribute('aria-live') };
                });
                assert.deepEqual(after, { role: 'status', live: 'polite' },
                    'swapping a live region\'s role as its contents change is the one thing '
                    + 'assistive technology handles worst; Slate does it on every toast');
            }));

        /* finding cmodality-9. An assertive announcement is triggered by the INSERTION
         * of a role="alert" element, or by a content change inside one already in the
         * document. show() used to append the notice and THEN write the role, which
         * makes it a polite node that acquired an assertive role afterwards — the
         * ordering assistive technology handles least reliably, on the one tone the
         * assertive path exists for. Read at the DOM operation itself, because the role
         * is identical a microtask later either way and nothing in the suite's 68
         * render tests or its 6 entry tests could tell the two apart. */
        test('a danger notice carries role=alert BEFORE it is inserted into the live region',
            () => mounted(async (page) => {
                const got = await page.eval(`(() => {
                    const t = document.getElementById('t1');
                    const seen = [];
                    const original = t.appendChild;
                    t.appendChild = function (node) {
                        seen.push({
                            role: node.getAttribute ? node.getAttribute('role') : null,
                            connected: node.isConnected,
                        });
                        return original.call(this, node);
                    };
                    const danger = t.show('Scale lost', { tone: 'danger', duration: 0 });
                    const info = t.show('Scale tared', { tone: 'info', duration: 0 });
                    t.appendChild = original;
                    return JSON.stringify({
                        seen,
                        after: [danger.getAttribute('role'), info.getAttribute('role')],
                    });
                })()`);
                const { seen, after } = JSON.parse(got);
                assert.equal(seen.length, 2, 'both notices went in through appendChild');
                assert.deepEqual(seen[0], { role: 'alert', connected: false },
                    'the assertive role rides in WITH the insertion, on a node that is still detached');
                assert.deepEqual(seen[1], { role: null, connected: false },
                    'and no other tone is promoted on the way in');
                assert.deepEqual(after, ['alert', null], 'the settled state is unchanged');
            }));

        test('an author who chose a role keeps it, and gets no live-region attributes either',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => {
                    const t = document.getElementById('t1');
                    return { role: t.getAttribute('role'), live: t.getAttribute('aria-live') };
                });
                assert.deepEqual(got, { role: 'log', live: null });
            }, '<ui-toast id="t1" role="log"><div id="n1" duration="0">x</div></ui-toast>'));

        /* -------------------------------------------------------------------
         * MOTION — DEPARTURES 9 and 10.
         * ----------------------------------------------------------------- */

        test('notices present at mount are shown, with no entrance to photograph',
            () => mounted(async (page) => {
                const states = await page.evalFn(() => [...document.getElementById('t1').children]
                    .map((c) => c.getAttribute('data-ui-toast')));
                assert.deepEqual(states, ['shown', 'shown', 'shown', 'shown']);
                assert.equal(await page.prop('#n-info', 'opacity'), '1');
                /* scale(1) serialises as an identity matrix, not `none` - which is the
                 * point: the resting frame is DECLARED, so a notice cannot be left
                 * holding the enter frame by a transition that never ran. */
                assert.equal(await page.prop('#n-info', 'transform'), 'matrix(1, 0, 0, 1, 0, 0)');
            }));

        test('a notice that ARRIVES starts at the DaisyUI toast-pop frame and settles',
            () => mounted(async (page) => {
                const first = await page.eval(`(() => {
                    const n = document.getElementById('t1').show('Cup warmer on', { duration: 0 });
                    return JSON.stringify({
                        state: n.getAttribute('data-ui-toast'),
                        opacity: getComputedStyle(n).opacity,
                    });
                })()`);
                /* @keyframes toast-pop { 0% { transform: scale(.9); opacity: 0 } } */
                assert.deepEqual(JSON.parse(first), { state: 'enter', opacity: '0' });

                /* --ui-dur-slow is 200ms and settle() is a handful of frames, so this
                 * waits out the transition rather than sampling it mid-flight. */
                await sleep(400);
                await page.settle(2);
                const settled = await page.evalFn(() => {
                    const n = document.getElementById('t1').lastElementChild;
                    return { state: n.getAttribute('data-ui-toast'), opacity: getComputedStyle(n).opacity };
                });
                assert.deepEqual(settled, { state: 'shown', opacity: '1' });
            }));

        test('the motion is the motion tokens, and nothing that moves the layout',
            () => mounted(async (page) => {
                const got = await page.computed('#n-info', [
                    'transition-duration', 'transition-timing-function', 'transition-property',
                ]);
                /* .25s ease-out → --ui-dur-slow (200ms) + --ui-ease. */
                const dur = await page.resolveToken('--ui-dur-slow', 'transition-duration');
                assert.ok(got['transition-duration'].split(',').every((d) => d.trim() === dur.trim()),
                    `expected every leg at ${dur}, got ${got['transition-duration']}`);
                const ease = await page.resolveToken('--ui-ease', 'transition-timing-function');
                assert.ok(got['transition-timing-function'].split(/,(?![^(]*\))/)
                    .every((f) => f.trim() === ease.trim()),
                    `expected every leg at ${ease}, got ${got['transition-timing-function']}`);
                assert.match(ease, /cubic-bezier\(0\.2, 0, 0, 1\)/,
                    '--ui-ease is cubic-bezier(.2,0,0,1)');
                /* Composited properties only: a mid-flight frame must never move the
                 * notice below it, or a burst of toasts becomes a jitter. */
                const props = got['transition-property'].split(',').map((s) => s.trim()).sort();
                assert.deepEqual(props, ['opacity', 'transform']);
            }));

        test('prefers-reduced-motion removes the transition, and a dismissal still completes',
            () => mounted(async (page) => {
                await page.send('Emulation.setEmulatedMedia', {
                    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
                });
                await page.settle(2);
                assert.equal(await page.prop('#n-info', 'transition-duration'), '0s');

                /* THE FAILURE THIS EXISTS FOR: a 0s transition fires no transitionend in
                 * Chrome, so an implementation that waits for one leaves every notice in
                 * the DOM forever — for the users who can least afford a stuck overlay.
                 * The component reads the duration instead of listening for the end. */
                await page.evalFn(() => document.getElementById('t1').clear());
                await page.settle(4);
                assert.equal(await page.evalFn(() => document.getElementById('t1').children.length), 0);
            }));

        /* -------------------------------------------------------------------
         * CONVENTIONS.
         * ----------------------------------------------------------------- */

        test('a focusable notice takes the base\'s one ring, unclipped',
            () => mounted(async (page) => {
                await page.focusVisible('#n-focusable');
                /* The notice is the top-level assigned node, which is exactly what
                 * ::slotted() reaches, so the base's ring applies unmodified from
                 * --ui-focus-w / --ui-focus-offset, and nothing here clips it: the
                 * region declares no overflow rule at all (bug L24's class).
                 *
                 * THE BOUNDARY, which CONVENTIONS §3a states rather than this component
                 * inventing an answer to: "::slotted() matches only top-level assigned
                 * nodes. A focusable buried inside a slotted wrapper is not reached, and
                 * is the light tree's own business." A notice IS a wrapper, so a bare
                 * <button> inside one is unringed — and the consumer this surface is for
                 * slots ui-button, which carries the same fragment inside its own shadow
                 * root. Authoring a second ring here to close that gap is the one thing
                 * §3 forbids ("Do not author a second one"). */
                await assertFocusUnclipped(page, '#n-focusable');
            }, `<ui-toast id="t1" max-visible="0">
                  <div id="n-focusable" tabindex="0" duration="0">Shot stopped: 27.4s</div>
                </ui-toast>`));

        test('this component\'s own sheet declares no @font-face, no !important and no width query',
            () => mounted(async (page) => {
                const a = JSON.parse(await page.eval(SHEET_AUDIT));
                assert.equal(a.ownSheets, 1,
                    `expected exactly one sheet of this component's own; saw ${a.ownSheets} of ${a.sheets}`);
                /* Part 10 §9, the wave's own review addition. Spec §6.3 Rule 2: canvas
                 * text resolves fonts against the DOCUMENT registry, and a shadow-declared
                 * face measurably never registers (105.00 vs 118.50 at 20px). */
                assert.ok(!a.atRules.includes('font-face'),
                    'a @font-face inside a shadow root never registers (spec §6.3 Rule 2)');
                assert.deepEqual(a.important, [], 'CONVENTIONS §6: zero !important');
                const widthQueries = a.atRules.filter((c) => /\b(min|max)-width\b|\bwidth\s*[<>:]/.test(c));
                assert.deepEqual(widthQueries, [],
                    'CONVENTIONS §2: no component writes @media (width…); a container query or nothing');
                /* The one at-rule this file is allowed, and the one CONVENTIONS §11 puts
                 * in each animating component rather than in the base. */
                assert.ok(a.atRules.some((c) => c.includes('prefers-reduced-motion')));
            }));

        /* -------------------------------------------------------------------
         * The gallery entry renders. Its shape is checked without a browser in
         * test/ui-toast-gallery-entry.test.mjs; this is the half that needs one.
         * ----------------------------------------------------------------- */

        test('every gallery state mounts, paints and survives the battery\'s settle',
            () => browser.withPage({ geometry }, async (page) => {
                for (const state of galleryEntry.states) {
                    const wrap = Object.entries(state.hostStyle ?? {})
                        .map(([k, v]) => `${k}: ${v}`).join('; ');
                    await page.mount(`<div id="stage" style="${wrap}">${state.html}</div>`, MODULE);
                    assert.deepEqual(page.pageErrors, [], `${state.id} threw on mount`);
                    await page.settle(6);
                    const seen = await page.evalFn(() => {
                        const t = document.querySelector('ui-toast');
                        return t ? { notices: t.notices.length, opacity: t.firstElementChild
                            ? getComputedStyle(t.firstElementChild).opacity : null } : null;
                    });
                    assert.ok(seen && seen.notices > 0, `${state.id}: nothing left to photograph`);
                    /* DEPARTURE 10 in the place it was written for: every gallery notice is
                     * duration="0" AND present at mount, so the battery never shoots a
                     * half-faded card and never shoots an empty stage. */
                    assert.equal(seen.opacity, '1', `${state.id}: caught mid-transition`);
                }
            }));
    });
}
