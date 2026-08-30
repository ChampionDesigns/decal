/**
 * Gate A for.
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

        test('the box IS --ui-hit-min and the ink stays 8px (spec §2.3 case 2, Appendix 5)', () => plain(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box(TRACK);
            assert.equal(box.height, floor, 'the hit box is the token floor, not Slate\'s 32px');

            const s = await page.computed(TRACK, [
                'block-size', 'padding-block-start', 'padding-block-end', 'background-clip',
            ]);
            assert.equal(parseFloat(s['block-size']), 48);
            assert.equal(parseFloat(s['padding-block-start']), 20, '(48 - 8) / 2');
            assert.equal(parseFloat(s['padding-block-end']), 20);

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
            const box = await page.box(TRACK);
            const before = await page.eval('document.querySelector("ui-slider").value');
            await page.click(TRACK, { offset: { x: box.width * 0.75, y: 3 } });
            const after = await page.eval('document.querySelector("ui-slider").value');

            assert.notEqual(after, before, 'a press in the hit padding did nothing');
            assert.ok(after > 55 && after < 95, `expected roughly three quarters along, got ${after}`);
        }));

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

                assert.equal(parseFloat(await page.prop(TRACK, 'opacity')), 1);

                await assertTokenDrill(page, {
                    token: '--ui-opacity-disabled',
                    value: '0.17',
                    selector: HOST,
                    property: 'opacity',
                });
            });
        });

        test('T22: the thumb is 26px = --ui-icon + 2 hairlines, drawn from tokens', () => plain(async (page) => {
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
                assert.equal(inputs[0].value, 51);
            });
        });

        test('change is re-dispatched, because a native change cannot leave a shadow root', () => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount('<ui-slider value="50" label="Rating"></ui-slider>', MODULE);
                await page.recordEvents(HOST, ['change']);
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
            await page.setStyle(HOST, { 'inline-size': '120px' });
            const m = await page.metrics(HOST);
            assert.equal(m.scrollWidth, m.clientWidth, 'nothing overflows the host');
            assert.equal(m.rect.height, 48);
            await page.setStyle(HOST, { 'inline-size': null });
        }));
    });
}

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
