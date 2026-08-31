/**
 *.
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

const STEPS = JSON.stringify(['Zero', 'Left cell', 'Right cell', 'Verify']);

const STAGE_W = 720;

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

/** The same walk with nothing slotted into actions — the F3 hole as a state. */
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

        test('the chips are 44x44, and the number is --ui-control-sm', () => mounted(async (page) => {
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
                const want = await page.resolveToken('--ui-radius', 'border-top-left-radius');
                const got = await page.computed(chip(3), ['border-top-left-radius', 'border-bottom-right-radius']);
                assert.equal(got['border-top-left-radius'], want);
                assert.equal(got['border-bottom-right-radius'], want);
            }));

        test('the glyph and the caption are the measured type roles', () => mounted(async (page) => {
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
                const text = await page.eval(
                    'document.getElementById("walk").shadowRoot.getElementById("caption")'
                    + '.textContent.replace(/\\s+/g, " ").trim()',
                );
                assert.equal(text, 'Step 3 of 4·Right cell');
            }));

        test('SELECTION: the current chip is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                const measured = await assertOneSelectionTreatment(page, {
                    selected: chip(3),
                    unselected: chip(4),
                });

                const steel = await page.resolveToken('--ui-steel', 'background-color');
                const onSteel = await page.resolveToken('--ui-on-steel', 'color');
                assert.equal(measured.face, steel, '--ui-selected-face ships as --ui-steel');
                assert.equal(measured.ink, onSteel, '--ui-selected-ink ships as --ui-on-steel');
            }));

        test('SELECTION: no chip owns a private selected look — turn the dial off and the '
            + 'current chip stops looking current', () => mounted(async (page) => {
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

                /* Every state keeps the same 44x44 box — the appendix, "state changes
                 * weight, never position". The transparent border in the resting rule is
                 * what buys that. */
                const rects = await page.eval(`JSON.stringify(${CHIP_RECTS})`).then(JSON.parse);
                for (const r of rects) near(r.w, 44, `${r.id} keeps its box`);
            }));

        test('the connectors mark the walk by weight, and take --ui-space-7 as their length',
            () => mounted(async (page) => {
                const strong = await page.resolveToken('--ui-line-strong', 'background-color');
                const line = await page.resolveToken('--ui-line', 'background-color');
                const walked = await page.computed(rule(1), ['background-color', 'block-size', 'inline-size']);
                const aheadRule = await page.computed(rule(3), ['background-color']);

                assert.equal(walked['background-color'], strong, 'behind the walk: --ui-line-strong');
                assert.equal(aheadRule['background-color'], line, 'ahead of the walk: --ui-line');
                near(parseFloat(walked['inline-size']), 40, 'the connector is --ui-space-7 long');
                near(parseFloat(walked['block-size']), 2, 'the connector is --ui-border-w-strong thick');
            }));

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
                await assertTokenDrill(page, {
                    token: '--ui-space-4', value: '36px', selector: '#walk >>> #progress', property: 'row-gap',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-6', value: '36px', selector: '#walk >>> #column', property: 'row-gap',
                });
                const gap = await page.computed('#walk >>> #progress', ['row-gap']);
                near(parseFloat(gap['row-gap']), 18, 'strip-to-caption is the measured 18px');
            }));

        test('T1: the wizard is exactly as wide as every other leaf, at two container widths',
            () => mounted(async (page) => {
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
                const caps = await page.eval(`JSON.stringify(${CAPS})`).then(JSON.parse);
                const capped = caps.filter((c) => c.max && c.max !== 'none');
                assert.deepEqual(capped, [],
                    'a width cap in the wizard column is T1 (and T21) by construction: '
                    + JSON.stringify(capped));
            }));

        test('T1: the slotted card is the column\'s width, not a 760px island',
            () => mounted(async (page) => {
                const wizard = await page.box('#walk');
                const card = await page.box('#body');
                near(card.width, wizard.width, 'the slotted card must be the column\'s width');
                near(card.left, wizard.left, 'and share its left edge');
            }));

        test('CONTAINER FLOOR: at 320px the strip wraps and the chips keep their 44',
            () => mounted(async (page) => {
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
                const caps = await page.eval(`JSON.stringify(${CAPS})`).then(JSON.parse);
                const hiding = caps.filter((c) => c.overflowX && c.overflowX !== 'visible'
                    && !String(c.where).includes('a11y'));
                assert.deepEqual(hiding, [],
                    'a hidden overflow in this column clips the slotted buttons\' focus '
                    + 'rings (L24) and silently truncates the card: ' + JSON.stringify(hiding));
            }));

        test('CONTAINER FLOOR: an empty actions cluster draws no row', () => mounted(async (page) => {
            const empty = await page.box('#walk');
            const actions = await page.computed('#walk >>> #actions', ['display']);
            assert.equal(actions.display, 'none', 'an empty actions cluster must not draw');

            await page.mount(MARKUP, MODULES);
            const filled = await page.box('#walk');
            assert.ok(filled.height > empty.height,
                `slotting two buttons must make the column taller (${filled.height} vs ${empty.height})`);
        }, NO_ACTIONS));

        test('FOCUS: the slotted ui-button\'s ring is the token ring and nothing clips it',
            () => mounted(async (page) => {
                const g = await assertFocusUnclipped(page, '#go >>> #btn');
                const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
                assert.equal(g.outlineWidth, width);
            }));

        test('FOCUS: a BARE slotted button gets the same one ring (CONVENTIONS §3a)',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#bare');
            }));

        test('FOCUS: the ring survives a squeezed column', () => mounted(async (page) => {
            /* the rule is rings clipped by the component they sit inside, and a narrow column
             * is where a hidden overflow would first be reached for. */
            await page.setStyle('#stage', { 'inline-size': '320px' });
            await page.settle();
            await assertFocusUnclipped(page, '#go >>> #btn');
        }));

        test('ARIA: exactly one chip is current, it says "step", and the class agrees',
            () => mounted(async (page) => {
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
            const focusables = await page.count('#walk >>> #steps :is(a, button, input, [tabindex])');
            assert.equal(focusables, 0, 'a step chip is not a control');
        }));

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
