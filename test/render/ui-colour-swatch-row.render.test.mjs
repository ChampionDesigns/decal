/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-colour-swatch-row.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-colour-swatch-row.js'];

const PALETTE = '[{"hex":"#000000","label":"Off"},{"hex":"#FFAA55","label":"Warm White"},'
    + '{"hex":"#FF7A00","label":"Amber"},{"hex":"#0CA581","label":"Green"},'
    + '{"hex":"#7A3FF2","label":"Purple"}]';

const LIT = `<ui-colour-swatch-row id="lit" label="LED colour presets" value="#ff7a00"
    swatches='${PALETTE}'></ui-colour-swatch-row>`;

const NONE = `<ui-colour-swatch-row id="none" label="LED colour presets" value="#1b9e5a"
    swatches='${PALETTE}'></ui-colour-swatch-row>`;

/* No colour has arrived at all — the absence case. No fallback, no computed default (A7). */
const ABSENT = `<ui-colour-swatch-row id="absent" label="LED colour presets"
    swatches='${PALETTE}'></ui-colour-swatch-row>`;

const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 700px; padding: 24px; }
    </style>
    <div id="stage">${LIT}${NONE}${ABSENT}</div>`;

const group = (row) => `#${row} >>> #row`;
const swatch = (row, i) => `#${row} >>> #swatch-${i}`;
const chip = (row, i) => `#${row} >>> #swatch-${i} .chip`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Every swatch's aria state and name, read from inside the row. */
const SWATCHES = (rowId) => `(${((id) => {
    const root = document.getElementById(id).shadowRoot;
    return [...root.querySelectorAll('.swatch')].map((el) => ({
        id: el.id,
        pressed: el.getAttribute('aria-pressed'),
        selected: el.getAttribute('aria-selected'),
        checked: el.getAttribute('aria-checked'),
        current: el.getAttribute('aria-current'),
        classes: el.className,
        name: el.textContent.trim(),
        tabindex: el.getAttribute('tabindex'),
        disabled: el.hasAttribute('disabled'),
        type: el.getAttribute('type'),
    }));
}).toString()})(${JSON.stringify(rowId)})`;

const NON_DIAL_PROPERTIES = [
    'font-weight', 'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-color', 'border-top-left-radius', 'border-bottom-left-radius',
    'padding-left', 'padding-top', 'inline-size', 'block-size',
    'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'position', 'cursor', 'user-select',
];

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-colour-swatch-row @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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

        test('APPENDIX 15: one aria spelling, aria-pressed, and exactly one is true',
            () => mounted(async (page) => {
                const swatches = await page.eval(SWATCHES('lit'));
                assert.equal(swatches.length, 5, 'five presets, five swatches');
                assert.deepEqual(
                    swatches.map((s) => s.pressed),
                    ['false', 'false', 'true', 'false', 'false'],
                    'the pressed swatch is the one the machine COLOUR matches (#ff7a00 is index 2)',
                );
                for (const s of swatches) {
                    assert.equal(s.selected, null, 'one spelling, not four');
                    assert.equal(s.checked, null);
                    assert.equal(s.current, null);
                    assert.equal(s.type, 'button', 'never a submit button by default');
                    assert.equal(s.tabindex, null,
                        'each swatch is its own tab stop: this is a group of buttons, not a toolbar');
                }
            }));

        test('every swatch has an accessible name, and it is the caller\'s or the colour',
            () => mounted(async (page) => {
                const swatches = await page.eval(SWATCHES('lit'));
                assert.deepEqual(
                    swatches.map((s) => s.name),
                    ['Off', 'Warm White', 'Amber', 'Green', 'Purple'],
                );
                const box = await page.box(`${swatch('lit', 0)} .a11y`);
                assert.ok(box.width <= 1.5 && box.height <= 1.5,
                    `the name is visually hidden, not laid out: measured ${box.width}x${box.height}`);
            }));

        test('the group carries the row\'s name, and the role-less host gives its own up',
            () => mounted(async (page) => {
                await page.mount(
                    `<ui-colour-swatch-row id="named" aria-label="LED colour presets"
                        value="#ff7a00" swatches='${PALETTE}'></ui-colour-swatch-row>`,
                    MODULE,
                );
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const row = document.getElementById('named');
                    return {
                        host: row.getAttribute('aria-label'),
                        hostRole: row.getAttribute('role'),
                        groupRole: row.shadowRoot.querySelector('#row').getAttribute('role'),
                        groupName: row.shadowRoot.querySelector('#row').getAttribute('aria-label'),
                        name: row.accessibleName,
                    };
                });
                assert.equal(got.groupRole, 'group');
                assert.equal(got.groupName, 'LED colour presets', 'the name lands on the element carrying the role');
                assert.equal(got.host, null, 'and does not stay on the role-less host as a second announcement');
                assert.equal(got.hostRole, null);
                assert.equal(got.name, 'LED colour presets');
            }));

        test('nothing but the swatches is interactive — no second control, no second machinery',
            () => mounted(async (page) => {
                const strays = await page.evalFn(() => {
                    const root = document.getElementById('lit').shadowRoot;
                    return [...root.querySelectorAll('button, input, a[href], [role], [tabindex]')]
                        .filter((el) => !el.classList.contains('swatch') && el.id !== 'row')
                        .map((el) => el.tagName + (el.id ? `#${el.id}` : ''));
                });
                assert.deepEqual(strays, [], 'the swatches are the row');
            }));

        test('the swatch carries Slate\'s measured 64 x 64, from --ui-control-h',
            () => mounted(async (page) => {
                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));
                near(controlH, 64, '--ui-control-h is Slate\'s swatch size');
                for (const i of [0, 2, 4]) {
                    const box = await page.box(swatch('lit', i));
                    near(box.width, controlH, `swatch ${i} width`);
                    near(box.height, controlH, `swatch ${i} height`);
                }
            }));

        test('the hit floor is reached by the ink itself — no overlay needed', () => mounted(async (page) => {
            await assertHitFloor(page, swatch('lit', 0), { mode: 'box' });
            await assertHitFloor(page, swatch('lit', 4), { mode: 'box' });
        }));

        test('the touch floor survives a fork shrinking the control token', () => mounted(async (page) => {
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            await page.setToken('--ui-control-h', '20px');
            await page.settle(2);
            const box = await page.box(swatch('lit', 0));
            await page.setToken('--ui-control-h', null);
            near(box.width, floor, 'the swatch stops at --ui-hit-min, not at the control token');
            near(box.height, floor, 'on both axes');
        }));

        test('T20: the gap is --ui-space-3, not Slate\'s 14px literal', () => mounted(async (page) => {
            const space3 = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));
            near(space3, 12, '--ui-space-3');
            const gap = await page.computed(group('lit'), ['column-gap', 'row-gap']);
            assert.equal(gap['column-gap'], `${space3}px`);
            assert.equal(gap['row-gap'], `${space3}px`);

            const boxes = await Promise.all([0, 1, 2].map((i) => page.box(swatch('lit', i))));
            near(boxes[1].left - boxes[0].left, boxes[0].width + space3, 'the rendered pitch is size + token gap');
            near(boxes[2].left - boxes[1].left, boxes[0].width + space3, 'and it is uniform');
        }));

        test('CONTAINER FLOOR: in a narrow leaf it wraps — it does not shrink and does not scroll',
            () => mounted(async (page) => {
                await page.setStyle('#stage', { 'inline-size': '300px' });
                await page.settle(2);

                const stage = await page.metrics('#stage');
                const host = await page.metrics('#lit');
                const row = await page.metrics(group('lit'));
                near(host.rect.width, stage.clientWidth - 48, 'the row is the container, less the stage padding');
                assert.ok(host.scrollWidth <= host.clientWidth + 0.5,
                    `nothing overflows the host: scrollWidth ${host.scrollWidth} vs clientWidth ${host.clientWidth}`);
                assert.ok(row.scrollWidth <= row.clientWidth + 0.5,
                    `nor the group: scrollWidth ${row.scrollWidth} vs clientWidth ${row.clientWidth}`);
                assert.equal(await page.prop(group('lit'), 'overflow-x'), 'visible',
                    'no hidden scroller: the row wraps instead');

                const boxes = await Promise.all([0, 1, 2, 3, 4].map((i) => page.box(swatch('lit', i))));
                const controlH = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));
                for (const [i, box] of boxes.entries()) near(box.width, controlH, `swatch ${i} keeps its size`);
                assert.ok(boxes.some((b) => b.top > boxes[0].top + 1),
                    'and the row has wrapped onto a second line rather than overflowing');
                await assertHitFloor(page, swatch('lit', 4), { mode: 'box' });
            }));

        test('no component rule uses a viewport query', () => mounted(async (page) => {
            const media = await page.evalFn(() => {
                const sheets = document.getElementById('lit').shadowRoot.adoptedStyleSheets || [];
                const out = [];
                for (const sheet of sheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.media) out.push(rule.conditionText || rule.media.mediaText);
                    }
                }
                return out;
            });
            assert.deepEqual(media.filter((m) => /width/.test(m)), [],
                'container queries only — the two height bands live on :root');
        }));

        test('TOKEN DRILL: the ring, its weight, the radius, the gap and the size are all tokens',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-line-strong', selector: swatch('lit', 0), property: 'border-top-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-border-w', value: DRILL_LENGTH, expected: DRILL_LENGTH,
                    selector: swatch('lit', 0), property: 'border-top-width',
                });
                await assertTokenDrill(page, {
                    token: '--ui-border-w-strong', value: DRILL_LENGTH, expected: DRILL_LENGTH,
                    selector: swatch('lit', 2), property: 'border-top-width',
                });
                await assertTokenDrill(page, {
                    token: '--ui-radius-pill', value: DRILL_LENGTH,
                    selector: swatch('lit', 0), property: 'border-top-left-radius',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3', value: DRILL_LENGTH,
                    selector: group('lit'), property: 'column-gap',
                });
                await assertTokenDrill(page, {
                    token: '--ui-control-h', value: '96px',
                    selector: swatch('lit', 0), property: 'width',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-1', value: DRILL_LENGTH,
                    selector: swatch('lit', 0), property: 'padding-top',
                });
            }));

        test('P30 APPLIED: the resting ring is --ui-line-strong, which Slate\'s measures is not',
            () => mounted(async (page) => {
                const strong = await page.resolveToken('--ui-line-strong', 'border-top-color');
                const line = await page.resolveToken('--ui-line', 'border-top-color');
                assert.notEqual(strong, line, 'the two weights are different inks, or this test proves nothing');
                for (const i of [0, 1, 2, 3, 4]) {
                    assert.equal(await page.prop(swatch('lit', i), 'border-top-color'), strong,
                        `swatch ${i}'s ring is --ui-line-strong — including the black one, which is P30's case`);
                }
            }));

        test('the selected ring is STRICTLY heavier than the resting one — Slate\'s is not',
            () => mounted(async (page) => {

                const rest = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));
                const strong = parseFloat(await page.resolveValue('var(--ui-border-w-strong)', 'width'));
                assert.ok(strong > rest, `--ui-border-w-strong (${strong}) must be heavier than --ui-border-w (${rest})`);

                const pressed = parseFloat(await page.prop(swatch('lit', 2), 'border-top-width'));
                const resting = parseFloat(await page.prop(swatch('lit', 1), 'border-top-width'));
                near(pressed, strong, 'the pressed swatch takes --ui-border-w-strong');
                near(resting, rest, 'the resting one takes --ui-border-w');
                assert.ok(pressed > resting, 'and the difference is visible, which is the whole of row #52');
            }));

        test('the radius is the pill token, not the 6px the reset imposes', () => mounted(async (page) => {
            const pill = await page.resolveValue('var(--ui-radius-pill)', 'border-top-left-radius');
            const six = await page.resolveValue('var(--ui-radius)', 'border-top-left-radius');
            assert.notEqual(pill, six);
            assert.equal(await page.prop(swatch('lit', 0), 'border-top-left-radius'), pill);
            assert.equal(await page.prop(chip('lit', 0), 'border-top-left-radius'), pill,
                'and the sample follows the ring, so the two are concentric');
        }));

        test('DIAL DRILL: the pressed swatch is painted by the five dials and nothing else',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: swatch('lit', 2),
                    unselected: swatch('lit', 1),
                });
            }));

        test('WITH ALL FIVE DIALS NEUTRAL, only the border weight separates pressed from resting',
            () => mounted(async (page) => {
                await page.setToken('--ui-selected-face', 'transparent');
                await page.setToken('--ui-selected-ink', 'currentColor');
                await page.setToken('--ui-selected-led', '0px');
                await page.setToken('--ui-selected-glow', '0%');
                await page.setToken('--ui-selected-weight', 'var(--ui-weight-regular)');
                await page.settle(2);
                try {
                    const pressed = await page.computed(swatch('lit', 2), NON_DIAL_PROPERTIES);
                    const resting = await page.computed(swatch('lit', 1), NON_DIAL_PROPERTIES);
                    assert.deepEqual(pressed, resting,
                        'a property outside the dials and outside --ui-border-w-strong separates the two states');

                    const after = await page.computed(swatch('lit', 2), ['content'], { pseudo: '::after' });
                    const before = await page.computed(swatch('lit', 2), ['content'], { pseudo: '::before' });
                    assert.equal(after.content, 'none', 'no generated underline or halo on the pressed swatch');
                    assert.equal(before.content, 'none', 'nor a generated ring');
                } finally {
                    for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                        '--ui-selected-led', '--ui-selected-glow', '--ui-selected-weight']) {
                        await page.setToken(dial, null);
                    }
                }
            }));

        test('one turn of --ui-selected-face moves every swatch row on the page together',
            () => mounted(async (page) => {
                const drilled = await page.resolveValue(DRILL_COLOUR, 'background-color');
                await page.setToken('--ui-selected-face', DRILL_COLOUR);
                await page.settle(2);
                const lit = await page.prop(swatch('lit', 2), 'background-color');
                await page.setToken('--ui-selected-face', null);
                assert.equal(lit, drilled, 'the row followed the dial, with no per-instance rule');
            }));

        test('SLATE\'S MECHANISM, RUN HERE: a document sheet of !important reaches nothing',
            () => mounted(async (page) => {
                const props = ['background-color', 'color', 'border-top-width',
                    'border-top-color', 'border-top-left-radius', 'box-shadow'];
                const before = await page.computed(swatch('lit', 2), props);
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = `
                        .swatch, .chip, .row, .slate-swatch, .is-selected,
                        [aria-pressed="true"], ui-colour-swatch-row *,
                        ui-colour-swatch-row > * {
                            border-width: 1px !important;
                            border-color: rgb(58, 72, 82) !important;
                            border-radius: 6px !important;
                            box-shadow: none !important;
                            background-color: rgb(1, 2, 3) !important;
                            color: rgb(4, 5, 6) !important;
                        }`;
                    document.head.append(s);
                    return true;
                });
                await page.settle(2);
                const after = await page.computed(swatch('lit', 2), props);
                assert.deepEqual(after, before,
                    'the swatch keeps its own treatment: the defect is inexpressible from outside');
            }));

        test('the component paints with no !important anywhere in its own sheets', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('lit').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const style = rule.style;
                        if (!style) continue;
                        for (let i = 0; i < style.length; i++) {
                            if (style.getPropertyPriority(style[i]) === 'important') {
                                hits.push(`${rule.selectorText} { ${style[i]} }`);
                            }
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));

        test('a press publishes an intent carrying the HEX, and moves no paint',
            () => mounted(async (page) => {
                await page.recordEvents('#lit', ['swatch-select', 'change']);
                await page.click(swatch('lit', 4));
                await page.settle(2);

                const events = await page.recordedEvents();
                const selects = events.filter((e) => e.type === 'swatch-select');
                assert.equal(selects.length, 1, 'exactly one intent per press');
                assert.deepEqual(selects[0].detail, { hex: '#7a3ff2', label: 'Purple', index: 4 },
                    'the event carries the colour, not the rendered label alone');
                assert.equal(events.filter((e) => e.type === 'change').length, 0,
                    'and no second event with a different payload for the same press');

                const swatches = await page.eval(SWATCHES('lit'));
                assert.deepEqual(swatches.map((s) => s.pressed),
                    ['false', 'false', 'true', 'false', 'false'],
                    'the paint did not follow the finger — the machine has not answered yet');
            }));

        test('the row issues no request of its own, so no route can be wrong here',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    window.__net = [];
                    const realFetch = window.fetch;
                    window.fetch = function (...args) {
                        window.__net.push(String(args[0]));
                        return realFetch.apply(window, args);
                    };
                    const realOpen = XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open = function (method, url) {
                        window.__net.push(String(url));
                        return realOpen.apply(this, arguments);
                    };
                    return true;
                });
                await page.click(swatch('lit', 3));
                await page.settle(3);
                assert.deepEqual(await page.evalFn(() => window.__net), [],
                    'a swatch press reaches the network only through the screen that owns the transport');
            }));

        test('the highlight moves only when the value comes back changed', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('lit').value = '#7A3FF2'; });
            await page.settle(3);
            const swatches = await page.eval(SWATCHES('lit'));
            assert.deepEqual(swatches.map((s) => s.pressed),
                ['false', 'false', 'false', 'false', 'true'],
                'and case is not a difference: #7A3FF2 in, #7a3ff2 in the palette');
        }));

        test('nothing is lit when the machine\'s colour matches no preset', () => mounted(async (page) => {
            const swatches = await page.eval(SWATCHES('none'));
            assert.deepEqual(swatches.map((s) => s.pressed), ['false', 'false', 'false', 'false', 'false']);
            const index = await page.evalFn(() => document.getElementById('none').activeIndex);
            assert.equal(index, -1, 'a first-class state, reported as one');
        }));

        test('A7: an absent colour highlights nothing, with no computed fallback', () => mounted(async (page) => {
            const swatches = await page.eval(SWATCHES('absent'));
            assert.deepEqual(swatches.map((s) => s.pressed), ['false', 'false', 'false', 'false', 'false']);
            const answers = await page.evalFn(() => {
                const row = document.getElementById('absent');
                const out = { none: row.activeIndex };
                row.value = { noReading: true, reason: 'absent' };
                out.absence = row.activeIndex;
                row.value = 'not-a-colour';
                out.malformed = row.activeIndex;
                return out;
            });
            assert.deepEqual(answers, { none: -1, absence: -1, malformed: -1 },
                'absence, an absence object and a malformed string all mean "nothing", never "the first one"');
        }));

        test('a disabled swatch and a disabled row publish nothing', () => mounted(async (page) => {
            await page.mount(
                `<div id="stage" style="padding:24px">
                    <ui-colour-swatch-row id="one" label="LED colour presets" value="#ff7a00"
                        swatches='[{"hex":"#000000","label":"Off"},{"hex":"#FFAA55","label":"Warm White","disabled":true},{"hex":"#FF7A00","label":"Amber"}]'></ui-colour-swatch-row>
                    <ui-colour-swatch-row id="all" label="LED colour presets" value="#ff7a00" disabled
                        swatches='${PALETTE}'></ui-colour-swatch-row>
                 </div>`,
                MODULE,
            );
            await page.settle(3);
            await page.recordEvents('#one', ['swatch-select']);
            await page.click(swatch('one', 1));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [], 'a disabled swatch refuses the press');

            await page.recordEvents('#all', ['swatch-select']);
            await page.click(swatch('all', 0));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [], 'and so does a disabled row');

            const dimmed = await page.computed(swatch('all', 0), ['opacity']);
            const host = await page.computed('#all', ['opacity']);
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            assert.equal(host.opacity, dial, 'the host carries the one disabled dial');
            assert.equal(dimmed.opacity, '1',
                'and the buttons inside do not carry it a second time: .38 x .38 = .14 is the trap');
        }));

        test('the sample carries the caller\'s colour, through the boundary as a property',
            () => mounted(async (page) => {
                const wanted = await Promise.all(['#000000', '#FFAA55', '#FF7A00', '#0CA581', '#7A3FF2']
                    .map((hex) => page.resolveValue(hex, 'background-color')));
                for (const [i, want] of wanted.entries()) {
                    assert.equal(await page.prop(chip('lit', i), 'background-color'), want,
                        `sample ${i} shows the colour it was given`);
                }
            }));

        test('selection paints the seat, never the sample', () => mounted(async (page) => {
            /* The reason the button and the chip are two elements: --ui-selected-face on a
             * colour swatch would erase the row's subject. */
            const amber = await page.resolveValue('#FF7A00', 'background-color');
            const drilled = await page.resolveValue(DRILL_COLOUR, 'background-color');
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.settle(2);
            const seat = await page.prop(swatch('lit', 2), 'background-color');
            const sample = await page.prop(chip('lit', 2), 'background-color');
            await page.setToken('--ui-selected-face', null);
            assert.equal(seat, drilled, 'the seat between ring and sample takes the dial');
            assert.equal(sample, amber, 'the sample is still the machine\'s colour');
        }));

        test('the sample is inset by --ui-space-1, so the seat is visible at all', () => mounted(async (page) => {
            const seat = parseFloat(await page.resolveValue('var(--ui-space-1)', 'padding-top'));
            assert.ok(seat > 0, 'a zero seat would make the face dial invisible');
            const outer = await page.box(swatch('lit', 2));
            const inner = await page.box(chip('lit', 2));
            const border = parseFloat(await page.prop(swatch('lit', 2), 'border-top-width'));
            near(inner.width, outer.width - 2 * (seat + border), 'the sample sits inside seat + ring');
        }));

        test('FOCUS UNCLIPPED: the ring is the token ring and nothing clips it',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, swatch('lit', 0));
                await assertFocusUnclipped(page, swatch('lit', 2));
                await assertFocusUnclipped(page, swatch('lit', 4));
            }));

        test('and it is still unclipped after the row has wrapped', () => mounted(async (page) => {
            await page.setStyle('#stage', { 'inline-size': '300px' });
            await page.settle(2);
            await assertFocusUnclipped(page, swatch('lit', 4));
        }));

        test('one ring, not two: the swatch paints no outline of its own', () => mounted(async (page) => {
            const resting = await page.computed(swatch('lit', 0), ['outline-style', 'outline-width']);
            assert.equal(resting['outline-style'], 'none', 'no resting outline to become a second treatment');
        }));
    });
}

test('the gallery entry has the shape entries.js documents', () => {
    assert.equal(galleryEntry.id, 'ui-colour-swatch-row', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-colour-swatch-row.js',
        'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const state of galleryEntry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} must be a kebab-case identifier`);
        assert.ok(state.title && state.html, `state ${state.id} needs a title and markup`);
    }
});

test('no gallery state names a route, and none carries the retired steam table', () => {
    for (const state of galleryEntry.states) {
        assert.ok(!/\/api\/|fetch\(|ledStrip/i.test(state.html),
            `gallery state ui-colour-swatch-row--${state.id} names a route`);
        assert.ok(!/\b130\b|\b170\b/.test(state.html),
            `gallery state ui-colour-swatch-row--${state.id} carries a 130/170 steam value`);
    }
});

test('every gallery state mounts and renders its swatches', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [],
                `gallery state ui-colour-swatch-row--${state.id} threw`);
            const shape = await page.evalFn(() =>
                [...document.querySelectorAll('ui-colour-swatch-row')].map((row) => ({
                    swatches: row.shadowRoot.querySelectorAll('.swatch').length,
                    count: row.swatchCount,
                    pressed: row.shadowRoot.querySelectorAll('[aria-pressed="true"]').length,
                    role: row.shadowRoot.querySelector('#row').getAttribute('role'),
                })));
            assert.ok(shape.length >= 1, `state ${state.id} rendered no row`);
            for (const row of shape) {
                assert.ok(row.swatches >= 1, `state ${state.id} rendered no swatches`);
                assert.equal(row.swatches, row.count, 'swatchCount reports what rendered');
                assert.ok(row.pressed <= 1, `state ${state.id} lit more than one swatch`);
                assert.equal(row.role, 'group');
            }
        }
    });
});
