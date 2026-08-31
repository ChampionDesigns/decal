/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-compare-bar.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';
import {
    ALIGNMENT_OFFSET_LIMIT_S,
    ALIGNMENT_OFFSET_STEP_S,
    ALIGNMENT_SLOT,
    formatAlignmentOffset,
} from '../../src/lib/alignment-offset.js';

const MODULE = ['/src/components/ui-compare-bar.js'];

const COMPARING = '<ui-compare-bar id="bar" has-comparison></ui-compare-bar>';
const ALONE = '<ui-compare-bar id="bar"></ui-compare-bar>';
const OFFSET = '<ui-compare-bar id="bar" has-comparison offset="1.4"></ui-compare-bar>';
const DATA_PAGE = '<ui-compare-bar id="bar" has-comparison has-time-axis="false"></ui-compare-bar>';

const BAR = '#bar >>> #bar';
const CAPTION = '#bar >>> #caption';
const READOUT = '#bar >>> #readout';
const SLIDER = '#bar >>> #slider';
const TRACK = '#bar >>> #slider >>> #track';
const RESET = '#bar >>> #reset';
const RESET_BUTTON = '#bar >>> #reset >>> .btn';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-compare-bar @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = COMPARING, opts = {}) => browser.withPage(
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

        test('H8: slider and Reset are the SAME height, and it is the stated row',
            () => mounted(async (page) => {
                const row = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const [slider, reset, track] = await Promise.all([
                    page.box(SLIDER), page.box(RESET), page.box(TRACK),
                ]);

                near(slider.height, row, 'the align slider is the row', 1);
                near(reset.height, row, 'the Reset button is the row', 1);
                assert.ok(
                    Math.abs(slider.height - reset.height) <= 1,
                    'H8: the two siblings must agree. Slate measured 44px of slider '
                    + `(#hv-align [i=176]) beside 64px of Reset (#hv-align-reset [i=178]); `
                    + `here they are ${slider.height} and ${reset.height}.`,
                );
                const ink = parseFloat(await page.resolveValue('var(--ui-space-2)', 'block-size'));
                const pad = parseFloat(await page.prop(TRACK, 'padding-top'));
                near(track.height, row, 'the range input IS the hit box', 1);
                near(row - 2 * pad, ink, 'the painted track stays --ui-space-2', 1);
            }));

        test('H8: a taller Reset cannot grow the strip — the defect is inexpressible',
            () => mounted(async (page) => {
                const before = (await page.box(BAR)).height;

                await page.setStyle(RESET, { 'block-size': '200px' });
                const withGiant = (await page.box(BAR)).height;
                await page.setStyle(RESET, { 'block-size': null });

                near(withGiant, before, 'a 200px Reset must not move the bar', 0.51);

                await page.setStyle(RESET, { display: 'none' });
                const without = (await page.box(BAR)).height;
                await page.setStyle(RESET, { display: null });
                near(without, before, 'removing the Reset must not move the bar', 0.51);
            }));

        test('H8: the strip is the row plus its own padding and border, from tokens',
            () => mounted(async (page) => {
                const [row, pad, border] = await Promise.all([
                    page.resolveValue('var(--ui-control-h)', 'block-size'),
                    page.resolveValue('var(--ui-space-3)', 'block-size'),
                    page.resolveValue('var(--ui-border-w)', 'block-size'),
                ]);
                const expected = parseFloat(row) + 2 * parseFloat(pad) + 2 * parseFloat(border);
                near((await page.box(BAR)).height, expected, 'the stated strip height', 1);
            }));

        test('H8: the strip height is a token drill, not a literal',
            () => mounted(async (page) => {
                const drilled = await assertTokenDrill(page, {
                    token: '--ui-control-h',
                    value: DRILL_LENGTH,
                    selector: BAR,
                    property: 'block-size',
                    expectLanding: false,
                });
                const pad = parseFloat(await page.resolveValue('var(--ui-space-3)', 'block-size'));
                const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'block-size'));
                near(
                    parseFloat(drilled.after),
                    parseFloat(DRILL_LENGTH) + 2 * pad + 2 * border,
                    'the drilled strip is row + padding + border',
                    1,
                );
            }));

        test('the range, the step and the centre origin are the port\'s, on the real input',
            () => mounted(async (page) => {
                const range = JSON.parse(await page.eval(`(() => {
                    const s = document.getElementById('bar').shadowRoot.getElementById('slider');
                    const i = s.shadowRoot.getElementById('track');
                    return JSON.stringify({
                        min: i.min, max: i.max, step: i.step, type: i.type,
                        origin: s.getAttribute('origin'),
                        tag: s.tagName.toLowerCase(),
                        barOwnsNoRange: document.getElementById('bar').shadowRoot
                            .querySelector('input[type=range]') === null,
                    });
                })()`));
                assert.equal(range.tag, 'ui-slider', 'the control is #23, composed');
                assert.equal(range.type, 'range');
                assert.equal(Number(range.min), -ALIGNMENT_OFFSET_LIMIT_S);
                assert.equal(Number(range.max), ALIGNMENT_OFFSET_LIMIT_S);
                assert.equal(Number(range.step), ALIGNMENT_OFFSET_STEP_S,
                    'step must survive as 0.1 — #23 carries it as a STRING because '
                    + 'Number("any") is NaN and a NaN step silently becomes 1');
                assert.equal(range.origin, '0',
                    'the fill runs from the midpoint (#23 origin), not from the left end');
                assert.equal(range.barOwnsNoRange, true,
                    'a bare input[type=range] in this shadow root would be a second slider');
            }));

        test('a value past the limit is clamped on the way in, and the readout says so',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(async () => {
                    const bar = document.getElementById('bar');
                    bar.offset = 9;
                    await bar.updateComplete;
                    const i = bar.shadowRoot.getElementById('slider').shadowRoot.getElementById('track');
                    return JSON.stringify({
                        offset: bar.offset,
                        readout: bar.shadowRoot.getElementById('readout').textContent,
                        input: i.value,
                    });
                })()`));
                assert.equal(seen.offset, ALIGNMENT_OFFSET_LIMIT_S);
                assert.equal(seen.readout, formatAlignmentOffset(ALIGNMENT_OFFSET_LIMIT_S));
                assert.equal(Number(seen.input), ALIGNMENT_OFFSET_LIMIT_S,
                    'the number printed is the number applied (history-viewer.js:1146)');
            }));

        test('sliding emits ONE offset-change carrying the offset, not a trace rewrite',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(async () => {
                    const bar = document.getElementById('bar');
                    const events = [];
                    bar.addEventListener('offset-change', (e) => events.push(e.detail));
                    const i = bar.shadowRoot.getElementById('slider').shadowRoot.getElementById('track');
                    i.value = '-2.5';
                    i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    await bar.updateComplete;
                    return JSON.stringify({
                        events,
                        offset: bar.offset,
                        readout: bar.shadowRoot.getElementById('readout').textContent,
                    });
                })()`));
                assert.equal(seen.events.length, 1, 'exactly one event per move');
                assert.deepEqual(seen.events[0], { offset: -2.5, reason: 'slide' });
                assert.equal(seen.offset, -2.5);
                assert.equal(seen.readout, '-2.5 s');
            }));

        test('Reset is disabled at zero, live off zero, and returns to zero',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(async () => {
                    const bar = document.getElementById('bar');
                    const btn = () => bar.shadowRoot.getElementById('reset');
                    const inner = () => btn().shadowRoot.querySelector('button');
                    const events = [];
                    bar.addEventListener('offset-change', (e) => events.push(e.detail));
                    const atZero = { host: btn().hasAttribute('disabled'), inner: inner().disabled };
                    bar.offset = 1.4;
                    await bar.updateComplete;
                    const offZero = { host: btn().hasAttribute('disabled'), inner: inner().disabled };
                    inner().click();
                    await bar.updateComplete;
                    return JSON.stringify({ atZero, offZero, events, offset: bar.offset });
                })()`));
                assert.deepEqual(seen.atZero, { host: true, inner: true },
                    'reset is only ever an undo — at 0 there is nothing to undo');
                assert.deepEqual(seen.offZero, { host: false, inner: false });
                assert.equal(seen.offset, 0);
                assert.deepEqual(seen.events.at(-1), { offset: 0, reason: 'reset' });
            }));

        test('no comparison: the slider refuses input and the static text takes the dial',
            () => mounted(async (page) => {
                const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                const state = JSON.parse(await page.eval(`(() => {
                    const bar = document.getElementById('bar');
                    const slider = bar.shadowRoot.getElementById('slider');
                    return JSON.stringify({
                        sliderHost: slider.hasAttribute('disabled'),
                        sliderInput: slider.shadowRoot.getElementById('track').disabled,
                        resetInput: bar.shadowRoot.getElementById('reset')
                            .shadowRoot.querySelector('button').disabled,
                    });
                })()`));
                assert.deepEqual(state, { sliderHost: true, sliderInput: true, resetInput: true },
                    'without a second shot there is nothing to move');
                assert.equal(await page.prop(CAPTION, 'opacity'), dial,
                    'ONE disabled dial — Slate\'s .45 on the caption was a fifth value');
            }, ALONE));

        test('a slot change on the moving shot resets the offset; the reference does not',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(async () => {
                    const bar = document.getElementById('bar');
                    const events = [];
                    bar.addEventListener('offset-change', (e) => events.push(e.detail));
                    const afterA = bar.applySlotChange(${JSON.stringify(ALIGNMENT_SLOT.REFERENCE)});
                    const afterB = bar.applySlotChange(${JSON.stringify(ALIGNMENT_SLOT.MOVING)});
                    await bar.updateComplete;
                    return JSON.stringify({ afterA, afterB, events, readout:
                        bar.shadowRoot.getElementById('readout').textContent });
                })()`));
                assert.equal(seen.afterA, 1.4, 'changing A leaves the offset in force');
                assert.equal(seen.afterB, 0, 'sliding B then choosing a different B drops it');
                assert.deepEqual(seen.events, [{ offset: 0, reason: 'slot-change' }]);
                assert.equal(seen.readout, '0.0 s');
            }, OFFSET));

        test('the readout and the slider\'s aria-valuetext are the same string',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(async () => {
                    const bar = document.getElementById('bar');
                    const read = () => {
                        const slider = bar.shadowRoot.getElementById('slider');
                        return {
                            readout: bar.shadowRoot.getElementById('readout').textContent,
                            valueText: slider.shadowRoot.getElementById('track')
                                .getAttribute('aria-valuetext'),
                        };
                    };
                    const out = [];
                    for (const v of [0, 1.4, -2.5, 5]) {
                        bar.offset = v;
                        await bar.updateComplete;
                        out.push(read());
                    }
                    return JSON.stringify(out);
                })()`));
                const want = [0, 1.4, -2.5, 5].map(formatAlignmentOffset);
                assert.deepEqual(seen.map((s) => s.readout), want);
                assert.deepEqual(seen.map((s) => s.valueText), want,
                    'one formatAlignmentOffset call feeds both — they cannot drift');
                assert.equal(seen[0].readout, '0.0 s',
                    'the zero form is Slate\'s own: history-viewer '
                    + '.slate-compare-offset [i=174] text "Align B 0.0 s"');
            }));

        test('token drill: the strip\'s ground is --ui-fascia', () => mounted(
            (page) => assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: BAR,
                property: 'background-color',
            }),
        ));

        test('token drill: the strip\'s hairline is --ui-line', () => mounted(
            (page) => assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: BAR,
                property: 'border-top-color',
            }),
        ));

        test('token drill: the caption ink is --ui-muted (the .ui-microcap role)',
            () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: CAPTION,
                property: 'color',
            })));

        test('token drill: the readout ink is --ui-text', () => mounted(
            (page) => assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: READOUT,
                property: 'color',
            }),
        ));

        test('token drill: the strip\'s rhythm is --ui-space-5, not a literal 24',
            () => mounted((page) => assertTokenDrill(page, {
                token: '--ui-space-5',
                value: DRILL_LENGTH,
                selector: BAR,
                property: 'column-gap',
            })));

        test('the quoted Slate values are reproduced from tokens, in both themes',
            () => mounted(async (page) => {
                const [gap, padInline, padBlock, radius, ground, ink, captionSize, readSize]
                    = await Promise.all([
                        page.prop(BAR, 'column-gap'),
                        page.prop(BAR, 'padding-left'),
                        page.prop(BAR, 'padding-top'),
                        page.prop(BAR, 'border-top-left-radius'),
                        page.prop(BAR, 'background-color'),
                        page.prop(READOUT, 'color'),
                        page.prop(CAPTION, 'font-size'),
                        page.prop(READOUT, 'font-size'),
                    ]);
                assert.equal(gap, '24px', '#hv-align-bar [i=172] gap = 24px');
                assert.equal(padInline, '24px', '#hv-align-bar [i=172] padding-left = 24px');
                assert.equal(padBlock, '12px', 'var(--slate-space-3)');
                assert.equal(radius, '6px', '#hv-align-bar [i=172] radius = 6px');
                assert.equal(ground, await page.resolveToken('--ui-fascia', 'background-color'));
                assert.equal(ink, await page.resolveToken('--ui-text', 'color'));
                assert.equal(captionSize, '15px', '[i=175] font-size = 15px (--ui-text-sm)');
                assert.equal(readSize, '17px', '[i=177] font-size = 17px (--ui-text-base)');
                assert.equal(await page.prop(CAPTION, 'text-transform'), 'uppercase',
                    '[i=175] text-transform = uppercase');
                near(
                    parseFloat(await page.prop(READOUT, 'min-width')), 84,
                    '#hv-align-value [i=177] width = 84px', 0.51,
                );
            }));

        test('focus ring on the slider is the one ring and nothing clips it',
            () => mounted((page) => assertFocusUnclipped(page, TRACK), OFFSET));

        test('focus ring on Reset is the one ring and nothing clips it',
            () => mounted((page) => assertFocusUnclipped(page, RESET_BUTTON), OFFSET));

        test('no selection treatment exists here — a slider has a value, not a state',
            () => mounted(async (page) => {
                const found = await page.eval(`(() => {
                    const root = document.getElementById('bar').shadowRoot;
                    return root.querySelectorAll(
                        '[aria-pressed],[aria-selected],[aria-checked],[aria-current],.is-selected'
                    ).length;
                })()`);
                assert.equal(Number(found), 0,
                    'Appendix 15\'s contract binds a SELECTED state; there is none in a '
                    + 'compare bar, so a dial drill here would be asserting a treatment '
                    + 'that must not exist');
            }));

        test('the slider carries an accessible name and the readout does not double it',
            () => mounted(async (page) => {
                const a11y = JSON.parse(await page.eval(`(() => {
                    const bar = document.getElementById('bar');
                    const input = bar.shadowRoot.getElementById('slider')
                        .shadowRoot.getElementById('track');
                    const out = bar.shadowRoot.getElementById('readout');
                    return JSON.stringify({
                        name: input.getAttribute('aria-label'),
                        readoutHidden: out.getAttribute('aria-hidden'),
                        tag: out.tagName.toLowerCase(),
                    });
                })()`));
                assert.equal(a11y.name, 'Slide shot B along the time axis',
                    'Slate\'s own aria-label (index.html:584), carried');
                assert.equal(a11y.tag, 'output');
                assert.equal(a11y.readoutHidden, 'true',
                    'an <output> is an implicit live region; announcing it alongside the '
                    + 'slider\'s aria-valuetext would read the same number twice per step');
            }));

        test('no time axis: the bar takes no box at all rather than sitting there dead',
            () => mounted(async (page) => {
                const seen = JSON.parse(await page.eval(`(() => {
                    const bar = document.getElementById('bar');
                    return JSON.stringify({
                        available: bar.hasAttribute('available'),
                        display: getComputedStyle(bar).display,
                        rect: bar.getBoundingClientRect().height,
                        empty: bar.shadowRoot.getElementById('bar') === null,
                    });
                })()`));
                assert.equal(seen.available, false);
                assert.equal(seen.display, 'none');
                assert.equal(seen.rect, 0, 'a table has no time axis to slide');
                assert.equal(seen.empty, true, 'and nothing is rendered behind the display: none');
            }, DATA_PAGE));

        test('the key slot costs no gap when nothing is assigned', () => mounted(async (page) => {
            const withoutKey = await page.eval(`(() => {
                const root = document.getElementById('bar').shadowRoot;
                return getComputedStyle(root.getElementById('key')).display;
            })()`);
            assert.equal(withoutKey, 'none', 'a slot with no assigned node is still a flex item');

            const withKey = JSON.parse(await page.eval(`(async () => {
                const bar = document.getElementById('bar');
                const span = document.createElement('span');
                span.slot = 'key';
                span.textContent = 'A solid B dashed';
                bar.appendChild(span);
                /* slotchange lands at the microtask checkpoint, and the reflected
                 * has-key it sets schedules one more update after that. */
                await new Promise((r) => requestAnimationFrame(r));
                await bar.updateComplete;
                const root = bar.shadowRoot;
                return JSON.stringify({
                    hasKey: bar.hasAttribute('has-key'),
                    display: getComputedStyle(root.getElementById('key')).display,
                });
            })()`));
            assert.deepEqual(withKey, { hasKey: true, display: 'flex' });
        }));

        test('the container rule reads the HOST, not the viewport', () => mounted(async (page) => {
            const wide = await page.prop(CAPTION, 'display');
            assert.notEqual(wide, 'none', 'at full width the caption is drawn');

            await page.setStyle('#bar', { 'inline-size': '520px' });
            const tight = await page.prop(CAPTION, 'display');
            await page.setStyle('#bar', { 'inline-size': null });

            assert.equal(tight, 'none',
                'below 640px of CONTAINER the caption drops — and the same viewport '
                + 'proves it is a container query, not a media query');
            assert.equal(await page.prop(CAPTION, 'display'), wide, 'and it comes back');
        }));

        test('squeezed to 360px the strip holds its floor and clips nothing',
            () => mounted(async (page) => {
                await page.setStyle('#bar', { 'inline-size': '360px' });
                const [bar, slider, reset, metrics] = await Promise.all([
                    page.box(BAR), page.box(SLIDER), page.box(RESET), page.metrics(BAR),
                ]);
                const row = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'inline-size'));
                await page.setStyle('#bar', { 'inline-size': null });

                near(bar.height, row + 2 * 12 + 2, 'the strip keeps its stated height', 1);
                assert.ok(slider.width >= floor - 0.51,
                    `the track keeps a fingertip of width: ${slider.width} < ${floor}`);
                assert.ok(reset.width > 0 && reset.height > 0, 'Reset is still drawn');
                assert.equal(metrics.overflowX, 'visible',
                    'the strip states its overflow rather than hiding a squeezed control '
                    + '(spec §2.4; "the old app\'s default answer everywhere was hidden")');
            }));

        test('every gallery state mounts, and every one is a strip of the stated height',
            () => browser.withPage({ geometry }, async (page) => {
                const row = parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size'));
                for (const state of galleryEntry.states) {
                    await page.mount(
                        `<div id="stage" style="inline-size: ${state.hostStyle?.['inline-size'] ?? '900px'}">`
                        + `${state.html.replace('<ui-compare-bar', '<ui-compare-bar id="bar"')}</div>`,
                        MODULE,
                    );
                    assert.deepEqual(page.pageErrors, [], `${state.id} must mount without throwing`);
                    const box = await page.box(BAR);
                    near(box.height, row + 26, `${state.id}: the strip is the stated height`, 1);
                    assert.ok(box.width > 0, `${state.id}: the strip is drawn`);
                }
                assert.equal(galleryEntry.id, 'ui-compare-bar');
                assert.equal(new Set(galleryEntry.states.map((s) => s.id)).size,
                    galleryEntry.states.length, 'state ids are capture filenames — unique');
            }));
    });
}
