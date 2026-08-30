/**
 * ui-slider.render.test.mjs — Gate A for Wave 1 item #23 (Slider).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (bench truth) and the
 * 1000×600 floor — and asserts only on computed style, box geometry and behaviour.
 *
 * The five classes Gate A asks every Wave 1 suite for, and where they are:
 *   token drill        — six of them: the hit floor, the ink, the two track colours,
 *                        the radius, the thumb's size and its face.
 *   focus geometry     — the ONE ring from --ui-focus-*, unclipped, plus the inset
 *                        variant inside a clipping band (bug L24's class).
 *   container floor    — the control reads its own container, never the viewport:
 *                        the same host width renders identically at both geometries.
 *   bugs asserted dead — T22 (`LAYOUT_SPEC_DRAFT.md:1198`), and the 32px hit box the
 *                        oracle is disqualified for (CONVENTIONS §5, spec §2.3).
 *   aria + hit floor   — the native slider contract, and Appendix 5's 48px floor
 *                        proved by a real CDP click in the padding, not in the ink.
 *
 * HOW THE THUMB IS MEASURED, because it is not obvious and it is the heart of T22.
 * `getComputedStyle(input, '::-webkit-slider-thumb')` LIES: Chrome returns the
 * originating element's own box (measured: 300×48 for a 26px thumb) and the UA's
 * default colours, so an assertion built on it passes on a component with no thumb
 * rules at all. What is real is the input's user-agent shadow tree, which CDP exposes
 * with `DOM.getDocument({pierce: true})` — three nested DIVs: the runnable track, the
 * thumb's row, the thumb. `CSS.getComputedStyleForNode` on those nodes returns the
 * engine's actual numbers. That is still "computed style, real layout engine, never
 * source text" (Part 8 §2) — it is simply the only door into a UA shadow root.
 *
 * The Gecko half of T22 cannot be measured in Chrome at all: Chrome DROPS
 * `::-moz-range-thumb` rules at parse time (verified — the rule is absent from
 * `sheet.cssRules`). That half is `test/ui-slider-thumb-parity.test.mjs`, which
 * compares the two declaration blocks statically.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-slider.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-slider.js'];
const HOST = 'ui-slider';
const TRACK = 'ui-slider >>> #track';

/* ---------------------------------------------------------------------------
 * Reading the input's USER-AGENT shadow tree over CDP.
 * ------------------------------------------------------------------------- */

/** Every node in the pierced tree, flattened, with its depth inside its own root. */
function flatten(node, depth, out) {
    out.push({ node, depth });
    for (const child of node.children ?? []) flatten(child, depth + 1, out);
    for (const root of node.shadowRoots ?? []) flatten(root, depth + 1, out);
    for (const pseudo of node.pseudoElements ?? []) flatten(pseudo, depth + 1, out);
    return out;
}

function attr(node, name) {
    const a = node.attributes ?? [];
    for (let i = 0; i < a.length; i += 2) if (a[i] === name) return a[i + 1];
    return null;
}

/**
 * The three nodes the engine builds inside `<input type="range">`:
 * `track` (the runnable track — its box IS the 8px ink) and `thumb` (the disc).
 * nodeIds are invalidated by DOM mutation, so this re-reads the document every call.
 */
async function sliderParts(page) {
    const doc = await page.send('DOM.getDocument', { depth: -1, pierce: true });
    const all = flatten(doc.root, 0, []);
    const input = all.find(({ node }) => node.nodeName === 'INPUT' && attr(node, 'id') === 'track');
    assert.ok(input, 'no <input id="track"> in the pierced tree — did the component render?');

    const ua = (input.node.shadowRoots ?? []).find((r) => r.shadowRootType === 'user-agent');
    assert.ok(ua, 'the range input has no user-agent shadow root');

    const divs = flatten(ua, 0, []).filter(({ node }) => node.nodeName === 'DIV');
    assert.ok(divs.length >= 2, `expected the UA track + thumb, found ${divs.length} DIVs`);
    const sorted = [...divs].sort((a, b) => a.depth - b.depth);

    return {
        input: input.node.nodeId,
        track: sorted[0].node.nodeId,
        thumb: sorted[sorted.length - 1].node.nodeId,
    };
}

async function computedForNode(page, nodeId, props) {
    const res = await page.send('CSS.getComputedStyleForNode', { nodeId });
    const map = new Map(res.computedStyle.map((p) => [p.name, p.value]));
    return Object.fromEntries(props.map((p) => [p, map.get(p)]));
}

/** One property of the rendered thumb, as a number where it is a length. */
async function thumbProp(page, property, { numeric = false } = {}) {
    const parts = await sliderParts(page);
    const got = await computedForNode(page, parts.thumb, [property]);
    return numeric ? parseFloat(got[property]) : got[property];
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-slider @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (markup, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        const plain = (fn) => mounted('<ui-slider value="40" label="Rating"></ui-slider>', fn);

        /* -- geometry sanity, so a mis-set emulation cannot pass silently ---- */

        test('the emulated geometry is the one the suite asked for', () => plain(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        /* ================================================================
         * 1. THE HIT FLOOR — and the bug the oracle is disqualified for
         * ============================================================== */

        test('the box IS --ui-hit-min and the ink stays 8px (spec §2.3 case 2, Appendix 5)', () => plain(async (page) => {
            // ORACLE DISQUALIFIED. The measurement exists —
            //   CITE live-ready #shot-rating-slider [i=157] height = 32px
            //        <- slate-live.css `#main-page .slate-rate-slider` authored `32px`
            //   CITE find --cls slate-rate-slider -> 7 elements in 7 states, all 147x32
            // — and it is the defect CONVENTIONS §5 names: "the rating slider is 32px
            // tall against the same 48px floor". The floor comes from the token.
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box(TRACK);
            assert.equal(box.height, floor, 'the hit box is the token floor, not Slate\'s 32px');

            const s = await page.computed(TRACK, [
                'block-size', 'padding-block-start', 'padding-block-end', 'background-clip',
            ]);
            assert.equal(parseFloat(s['block-size']), 48);
            assert.equal(parseFloat(s['padding-block-start']), 20, '(48 - 8) / 2');
            assert.equal(parseFloat(s['padding-block-end']), 20);

            // THE ONE TRAP (base.js; slate-live.css:1565-1567). The component paints
            // with background-image, never the `background` shorthand — which would
            // reset this to border-box and swell the 8px track into a 48px slab.
            assert.equal(s['background-clip'], 'content-box');

            // And the ink really is 8px: the UA runnable track's box is the content box.
            const parts = await sliderParts(page);
            const ink = await computedForNode(page, parts.track, ['height']);
            assert.equal(parseFloat(ink.height), 8, 'the painted track reads as 8px');
        }));

        test('the hit floor is met on both axes', () => plain(async (page) => {
            const hit = await assertHitFloor(page, TRACK, { mode: 'pad' });
            assert.equal(hit.block, hit.floor);
            assert.ok(hit.inline >= hit.floor);
        }));

        test('a press 3px from the top edge — outside the ink — moves the value', () => plain(async (page) => {
            // The whole point of Appendix 5, as a real CDP hit test rather than a
            // number: the ink occupies y 20..28 of a 48px box, so this press lands in
            // the padding. On Slate's 8px-ink-only geometry it would hit nothing.
            const box = await page.box(TRACK);
            const before = await page.eval('document.querySelector("ui-slider").value');
            await page.click(TRACK, { offset: { x: box.width * 0.75, y: 3 } });
            const after = await page.eval('document.querySelector("ui-slider").value');

            assert.notEqual(after, before, 'a press in the hit padding did nothing');
            assert.ok(after > 55 && after < 95, `expected roughly three quarters along, got ${after}`);
        }));

        /* ================================================================
         * 2. TOKEN DRILLS — tokens consumed, not copied
         * ============================================================== */

        test('drill: --ui-hit-min moves the hit box', () => plain(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: '91px',
                selector: TRACK,
                property: 'block-size',
            });
            assert.equal(drill.after, '91px');
            assert.equal(drill.before, '48px');
        }));

        test('drill: --ui-space-2 moves the ink, not the box', () => plain(async (page) => {
            // The ink is --_ui-hit-ink: var(--ui-space-2) — 8px, the thickness both
            // Slate sliders derive (32 - 2x12, 44 - 2x18). The padding is what carries
            // it, so the box stays on the floor while the track thins.
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '20px',
                selector: TRACK,
                property: 'padding-block-start',
                expected: '14px', // (48 - 20) / 2
            });
            const box = await page.box(TRACK);
            assert.equal(box.height, 48, 'the hit floor did not move with the ink');
        }));

        test('both hit-area escape hatches actually open from the host', () => {
            return browser.withPage({ geometry }, async (page) => {
                // base.js documents two knobs on a .hit-pad element — "Set
                // --_ui-hit-ink to the ink's thickness; the box itself is the floor,
                // and --_ui-hit-box overrides that where a control needs a taller one"
                // — and they must behave alike. They did not: with --_ui-hit-ink
                // declared on .track, a value set from outside was shadowed by the
                // component's own declaration on the very element the utility reads.
                // Measured then: ink 12px + box 44px gave padding 18px = (44-8)/2, the
                // ink knob silently dead while its sibling worked. Declared on :host,
                // an inline style outranks it and both take.
                await page.mount(
                    '<ui-slider id="hatched" style="--_ui-hit-ink:12px;--_ui-hit-box:44px" '
                    + 'value="40" label="Rating"></ui-slider>',
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);
                const s = await page.computed('#hatched >>> #track', [
                    'block-size', 'padding-block-start', 'padding-block-end',
                ]);
                assert.equal(parseFloat(s['block-size']), 44, '--_ui-hit-box did not reach the utility');
                assert.equal(parseFloat(s['padding-block-start']), 16, '(44 - 12) / 2 — the INK knob is live');
                assert.equal(parseFloat(s['padding-block-end']), 16);
                assert.equal((await page.box('#hatched >>> #track')).height, 44);
            });
        });

        test('drill: --ui-steel moves the FILL', () => plain(async (page) => {
            // CITE live-ready #shot-rating-slider [i=157] background-image =
            //      linear-gradient(to right, rgb(176, 196, 206) 0%, rgb(176, 196, 206) 0%,
            //      rgb(58, 72, 82) 0%, rgb(58, 72, 82) 100%)
            //      <- slate-live.css `#main-page .slate-rate-slider` (token-driven)
            //      light: rgb(49, 92, 112) / rgb(203, 208, 211)  DIFF
            // dark rgb(176,196,206) and light rgb(49,92,112) are both --ui-steel, which
            // is how the corpus proves the fill is the TOKEN and not a colour.
            const drill = await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: TRACK,
                property: 'background-image',
                expectLanding: false,
            });
            assert.ok(drill.after.includes(DRILL_COLOUR), `fill did not take the token: ${drill.after}`);

            const steel = await page.resolveToken('--ui-steel', 'color');
            assert.ok(drill.before.includes(steel), `resting fill is not --ui-steel: ${drill.before}`);
        }));

        test('drill: --ui-line moves the REST of the track', () => plain(async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: TRACK,
                property: 'background-image',
                expectLanding: false,
            });
            assert.ok(drill.after.includes(DRILL_COLOUR), `rest did not take the token: ${drill.after}`);

            const line = await page.resolveToken('--ui-line', 'color');
            assert.ok(drill.before.includes(line), `resting rest colour is not --ui-line: ${drill.before}`);
        }));

        test('drill: --ui-radius-lg moves the track radius', () => plain(async (page) => {
            // CITE live-ready #shot-rating-slider [i=157] border-top-left-radius = 8px
            //      <- slate-live.css `#main-page .slate-rate-slider` (token-driven)
            //      (identical dark and light) ; 8px = --ui-radius-lg.
            const drill = await assertTokenDrill(page, {
                token: '--ui-radius-lg',
                value: DRILL_LENGTH,
                selector: TRACK,
                property: 'border-top-left-radius',
            });
            assert.equal(parseFloat(drill.before), 8, 'the oracle\'s 8px, as a token');
        }));

        test('drill: --ui-opacity-disabled dims a disabled slider exactly once', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider value="40" label="Rating" disabled></ui-slider>', MODULE);
                assert.deepEqual(page.pageErrors, []);

                const dial = parseFloat(await page.resolveToken('--ui-opacity-disabled', 'opacity'));
                assert.ok(dial > 0 && dial < 1);
                assert.equal(parseFloat(await page.prop(HOST, 'opacity')), dial, 'the host carries the dim');

                // ONE dim, not two: the native `disabled` attribute is on the real
                // input (it is what stops the control accepting input), and the base
                // dials BOTH spellings. Without the component's one-line override the
                // control would render at .38 x .38 = .14.
                assert.equal(parseFloat(await page.prop(TRACK, 'opacity')), 1);

                await assertTokenDrill(page, {
                    token: '--ui-opacity-disabled',
                    value: '0.17',
                    selector: HOST,
                    property: 'opacity',
                });
            });
        });

        /* ================================================================
         * 3. BUG T22 — one thumb spec, on token values
         * ============================================================== */

        test('T22: the thumb is 26px = --ui-icon + 2 hairlines, drawn from tokens', () => plain(async (page) => {
            // ORACLE CARVE-OUT: pseudo-elements were never probed, so this falls
            // through to the Slate source read-only — slate-live.css:1574-1580 and
            // :2376-2383, both 26x26 with `border: var(--slate-hairline) solid
            // var(--slate-line-strong)` over `background: var(--slate-surface)`.
            // T22 is that Slate then carries a FOURTH spec nobody maintains:
            // `::-moz-range-thumb` at 24x24 `#385a92` (main.css:386-395).
            const parts = await sliderParts(page);
            const thumb = await computedForNode(page, parts.thumb, [
                'width', 'height', 'background-color', 'border-top-color',
                'border-top-width', 'border-top-left-radius', 'box-sizing',
            ]);

            const icon = parseFloat(await page.resolveValue('var(--ui-icon)', 'width'));
            const hair = parseFloat(await page.resolveValue('var(--ui-hairline)', 'width'));
            assert.equal(parseFloat(thumb.width), icon + 2 * hair, 'the derivation, rendered');
            assert.equal(parseFloat(thumb.height), icon + 2 * hair);
            assert.equal(parseFloat(thumb.width), 26, 'and 26px is what Slate draws');

            assert.equal(thumb['background-color'], await page.resolveToken('--ui-surface', 'background-color'));
            assert.equal(thumb['border-top-color'], await page.resolveToken('--ui-line-strong', 'color'));
            assert.equal(parseFloat(thumb['border-top-width']), hair);
            assert.equal(thumb['box-sizing'], 'border-box', 'the hairline is inside the 26px');
        }));

        test('T22 drill: the thumb size follows --ui-icon', () => plain(async (page) => {
            const hair = parseFloat(await page.resolveValue('var(--ui-hairline)', 'width'));
            await assertTokenDrill(page, {
                token: '--ui-icon',
                value: '37px',
                selector: TRACK,
                property: 'width',
                read: (p) => thumbProp(p, 'width', { numeric: true }),
                expected: 37 + 2 * hair,
            });
        }));

        test('T22 drill: the thumb face follows --ui-surface', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-surface',
                value: DRILL_COLOUR,
                selector: TRACK,
                property: 'background-color',
                read: (p) => thumbProp(p, 'background-color'),
                expected: DRILL_COLOUR,
            });
        }));

        /* ================================================================
         * 4. THE FILL — value, and the origin-anchored variant
         * ============================================================== */

        test('the fill runs from the low end to the value', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider min="0" max="100" value="25" label="Rating"></ui-slider>', MODULE);
                const paint = await page.prop(TRACK, 'background-image');
                const steel = await page.resolveToken('--ui-steel', 'color');
                const line = await page.resolveToken('--ui-line', 'color');

                assert.equal(
                    paint,
                    `linear-gradient(to right, ${line} 0%, ${line} 0%, ${steel} 0%, `
                    + `${steel} 25%, ${line} 25%, ${line} 100%)`,
                    'the fill is --ui-steel up to the value and --ui-line after it',
                );
            });
        });

        test('origin anchors the fill away from the end (slate-live.css:2350-2356)', () => {
            return browser.withPage({ geometry }, async (page) => {
                // The HV align slider's centre-zero behaviour, as one property instead
                // of a second hand-rolled gradient: "a slider sitting at 0.0 s reads as
                // centred rather than as 60% of something".
                await page.mount(
                    '<ui-slider min="-5" max="5" step=".1" origin="0" value="2.5" label="Align"></ui-slider>',
                    MODULE,
                );
                const paint = await page.prop(TRACK, 'background-image');
                const steel = await page.resolveToken('--ui-steel', 'color');
                const line = await page.resolveToken('--ui-line', 'color');

                assert.equal(
                    paint,
                    `linear-gradient(to right, ${line} 0%, ${line} 50%, ${steel} 50%, `
                    + `${steel} 75%, ${line} 75%, ${line} 100%)`,
                    'a -5..+5 range at +2.5 fills the right-hand quarter of its own middle',
                );
            });
        });

        /* ================================================================
         * 5. FOCUS GEOMETRY (bug L24's class)
         * ============================================================== */

        test('the focus ring is the token ring, unclipped, outset', () => plain(async (page) => {
            const g = await assertFocusUnclipped(page, TRACK);
            assert.equal(
                parseFloat(g.outlineOffset),
                parseFloat(await page.resolveValue('var(--ui-focus-offset)', 'outline-offset')),
            );
            assert.deepEqual(g.clippers, [], 'nothing clips a slider in an open row');
        }));

        test('inside a clipping band the same ring goes inset and survives (L24)', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    // A BLOCK band, which is the plain case for a ring test. The FLEX
                    // case is covered on its own in §7 below — the host opts out of
                    // `container-type: inline-size` (CONVENTIONS §2) precisely so that a
                    // flex row is a real, asserted layout rather than one this suite
                    // steps around.
                    '<div id="band" style="overflow:hidden;inline-size:320px">'
                    + '<ui-slider focus-ring="inset" value="40" label="Rating"></ui-slider></div>',
                    MODULE,
                );
                const g = await assertFocusUnclipped(page, TRACK);
                assert.equal(
                    parseFloat(g.outlineOffset),
                    parseFloat(await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset')),
                );
                assert.ok(g.clippers.length >= 1, 'the band must really clip, or this is vacuous');
                assert.equal(g.clippers[0].overflowY, 'hidden');
            });
        });

        /* ================================================================
         * 6. ARIA AND BEHAVIOUR — the control is really a slider
         * ============================================================== */

        test('the aria contract is the native slider contract', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(
                    '<ui-slider min="1" max="5" step="1" value="3" label="Rating" value-text="3 of 5"></ui-slider>',
                    MODULE,
                );
                const a = await page.evalFn((sel) => {
                    const el = window.__h.need(sel);
                    return {
                        tag: el.tagName,
                        type: el.type,
                        min: el.min,
                        max: el.max,
                        step: el.step,
                        value: el.value,
                        label: el.getAttribute('aria-label'),
                        text: el.getAttribute('aria-valuetext'),
                        disabled: el.disabled,
                    };
                }, TRACK);

                // role=slider, aria-valuemin/max/now come free and cannot drift from
                // the rendered position, because they ARE the rendered position.
                assert.equal(a.tag, 'INPUT');
                assert.equal(a.type, 'range');
                assert.deepEqual([a.min, a.max, a.step, a.value], ['1', '5', '1', '3']);
                assert.equal(a.label, 'Rating');
                assert.equal(a.text, '3 of 5');
                assert.equal(a.disabled, false);
            });
        });

        test('step="any" survives as itself — a continuous control is not quantised', () => {
            return browser.withPage({ geometry }, async (page) => {
                // `step="any"` is HTML's whole answer for a continuous range, and a
                // Number-typed reactive property destroys it: Number('any') is NaN, the
                // attribute renders as step="NaN", the input falls back to step 1 and
                // the control quantises in silence. Measured before the fix: inner
                // input step "NaN", input.value "1" against host.value 1.234, with the
                // gradient painted at 62.34% while the thumb sat at 60%.
                await page.mount(
                    '<ui-slider id="any" min="-5" max="5" step="any" value="1.234" label="Align"></ui-slider>',
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);

                const a = await page.evalFn((sel) => {
                    const el = window.__h.need(sel);
                    return { attr: el.getAttribute('step'), step: el.step, value: el.value };
                }, TRACK);
                assert.equal(a.attr, 'any', 'the attribute is carried verbatim, not through Number()');
                assert.equal(a.step, 'any');
                assert.equal(a.value, '1.234', 'the input kept the value it was given');
                assert.equal(await page.eval('document.querySelector("ui-slider").value'), 1.234);

                // The thumb and the fill agree, which is the visible half of the bug.
                const steel = await page.resolveToken('--ui-steel', 'color');
                assert.match(
                    await page.prop(TRACK, 'background-image'),
                    new RegExp(`${steel.replace(/[()]/g, '\\$&')} 62\\.34%`),
                    'the fill must stop where the value is',
                );

                // And a stated discrete step still quantises, so this is not a licence
                // to ignore step altogether.
                await page.mount(
                    '<ui-slider id="one" min="0" max="10" step="1" value="4" label="Rating"></ui-slider>',
                    MODULE,
                );
                assert.equal(
                    await page.evalFn((sel) => window.__h.need(sel).step, TRACK), '1',
                    'a numeric step is still a numeric step',
                );
            });
        });

        test('a keyboard arrow moves the value and the input event crosses the boundary', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider value="50" label="Rating"></ui-slider>', MODULE);
                await page.recordEvents(HOST, ['input', 'change']);
                await page.focusVisible(TRACK);
                await page.press('ArrowRight');

                assert.equal(await page.eval('document.querySelector("ui-slider").value'), 51);

                const events = await page.recordedEvents();
                const inputs = events.filter((e) => e.type === 'input');
                assert.equal(inputs.length, 1, `expected exactly one input event, got ${JSON.stringify(events)}`);
                // `input` is composed, so it crosses on its own, retargeted to the host —
                // and the host's value is ALREADY the new one when it does.
                assert.equal(inputs[0].value, 51);
            });
        });

        test('change is re-dispatched, because a native change cannot leave a shadow root', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider value="50" label="Rating"></ui-slider>', MODULE);
                await page.recordEvents(HOST, ['change']);
                // composed: false — exactly what the browser fires on commit. Without
                // the component's re-dispatch nothing outside would ever hear it.
                await page.dispatch(TRACK, 'change', { composed: false });

                const changes = (await page.recordedEvents()).filter((e) => e.type === 'change');
                assert.equal(changes.length, 1, 'exactly one change event should reach the host');
            });
        });

        test('a disabled slider does not accept a press', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider value="10" label="Rating" disabled></ui-slider>', MODULE);
                const box = await page.box(TRACK);
                await page.click(TRACK, { offset: { x: box.width * 0.8, y: 24 } });
                assert.equal(
                    await page.eval('document.querySelector("ui-slider").value'), 10,
                    'the host attribute dims; the native attribute disables (CONVENTIONS §4)',
                );
            });
        });

        /* ================================================================
         * 7. THE CONTAINER, NOT THE VIEWPORT
         * ============================================================== */

        test('the control fills its own container and keeps its token height', () => plain(async (page) => {
            for (const width of ['380px', '900px', '200px']) {
                await page.setStyle(HOST, { 'inline-size': width });
                const box = await page.box(TRACK);
                assert.equal(box.width, parseFloat(width), `the track fills a ${width} host`);
                assert.equal(box.height, 48, 'height is a token, never a fraction of the container');
            }
            await page.setStyle(HOST, { 'inline-size': null });
        }));

        test('as a FLEX item the control has a real width, not a zero one', () => {
            return browser.withPage({ geometry }, async (page) => {
                // Both of Slate's own consumers are flex rows (slate-live.css:1551
                // `flex: 0 0 auto`, :2348 `flex: 1 1 auto`), and with the base's
                // `container-type: inline-size` the host's max-content size is ZERO —
                // measured, a content-sized slider in a 400px flex row laid out
                // {width: 0, height: 48}: an invisible control still eating a 48px row.
                // The host opts out (CONVENTIONS §2), so an unsized slider falls back to
                // its intrinsic width instead of vanishing.
                await page.mount(
                    '<div id="row" style="display:flex;align-items:center;gap:18px;inline-size:400px">'
                    + '<span id="lab">A</span><ui-slider id="s" value="40" label="Rating"></ui-slider></div>',
                    MODULE,
                );
                assert.deepEqual(page.pageErrors, []);

                const host = await page.box('#s');
                const track = await page.box('#s >>> #track');
                assert.ok(host.width > 0, 'the slider laid out 0px wide as a flex item');
                assert.equal(track.width, host.width, 'the track fills whatever the host got');
                assert.equal(track.height, 48, 'and the hit floor is unaffected by the row');

                // A consumer that states its sizing still gets exactly what it stated —
                // the primitive owns no width and no flex of its own (wave law: ranges
                // and limits arrive from outside).
                await page.setStyle('#s', { flex: '1 1 auto', 'min-inline-size': '0' });
                const grown = await page.box('#s');
                const label = await page.box('#lab');
                assert.equal(Math.round(grown.width + label.width + 18), 400, 'flex: 1 fills the row');

                await page.setStyle('#s', { flex: 'none', 'inline-size': '260px' });
                assert.equal((await page.box('#s')).width, 260, 'a stated width is HELD in a flex row');

                const m = await page.metrics('#row');
                assert.equal(m.scrollWidth, m.clientWidth, 'nothing overflows the row');
            });
        });

        test('squeezed to 120px the control neither overflows nor scrolls', () => plain(async (page) => {
            // Spec §2.4: no silent clip anywhere. A one-part control has nothing to
            // surrender, so the honest contract is that it simply fits.
            await page.setStyle(HOST, { 'inline-size': '120px' });
            const m = await page.metrics(HOST);
            assert.equal(m.scrollWidth, m.clientWidth, 'nothing overflows the host');
            assert.equal(m.rect.height, 48);
            await page.setStyle(HOST, { 'inline-size': null });
        }));
    });
}

/* ---------------------------------------------------------------------------
 * Cross-geometry: the container decides, the viewport does not
 * ------------------------------------------------------------------------- */

test('the same host width renders the same control at both geometries', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount('<ui-slider value="40" label="Rating"></ui-slider>', MODULE);
        await page.setStyle(HOST, { 'inline-size': '420px' });
        const box = await page.box(TRACK);
        const parts = await sliderParts(page);
        const thumb = await computedForNode(page, parts.thumb, ['width', 'height']);
        return {
            dpr: await page.eval('devicePixelRatio'),
            width: box.width,
            height: box.height,
            thumb: parseFloat(thumb.width),
            paint: await page.prop('ui-slider >>> #track', 'background-image'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    // The viewport differs by 281 CSS px and 0.5 dpr; nothing about the control does.
    assert.deepEqual(
        { w: bench.width, h: bench.height, t: bench.thumb },
        { w: floor.width, h: floor.height, t: floor.thumb },
    );
    assert.equal(bench.paint, floor.paint);
});

/* ---------------------------------------------------------------------------
 * The gallery entry, driven the way the capture battery will drive it
 *
 * The entry lives in its own file (tools/gallery/entries/ui-slider.entry.js) because
 * tools/gallery/entries.js is ONE shared array and sixteen wave-1 builders writing
 * whole files would clobber each other; the GATE agent wires it in. That hand-off is
 * exactly where a state can quietly stop mounting, so every state in it is mounted
 * here, from the entry object itself rather than from a copy of its markup.
 * ------------------------------------------------------------------------- */

test('every gallery state mounts, settles and renders a slider', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            if (state.hostStyle) await page.setStyle('#mount', state.hostStyle);

            assert.deepEqual(page.pageErrors, [], `${galleryEntry.id}--${state.id} threw`);
            assert.ok(await page.exists(TRACK), `${galleryEntry.id}--${state.id} rendered no track`);

            const box = await page.box(TRACK);
            assert.equal(box.height, 48, `${galleryEntry.id}--${state.id} lost the hit floor`);
            assert.ok(box.width > 0, `${galleryEntry.id}--${state.id} has no width`);

            await page.setStyle('#mount', { 'inline-size': null });
        }
    });
});
