/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-bank.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-bank.js'];

const RADIO = `<ui-bank id="radio" label="On disconnect" value="display-off"
    items='[{"value":"nothing","label":"Nothing"},
            {"value":"display-off","label":"Display Off"},
            {"value":"disconnect","label":"Disconnect"}]'></ui-bank>`;

const TABS = `<ui-bank id="tabs" mode="tablist" label="Chart" value="flow"
    items='[{"value":"flow","label":"Pressure / Flow"},
            {"value":"power","label":"Resistance / Impedance"},
            {"value":"data","label":"Shot data"}]'></ui-bank>`;

const TOOLS = `<ui-bank id="tools" mode="toolbar" label="Lighting" value="Awake"
    items='["Awake","Asleep"]'></ui-bank>`;

/* A stated stage width, so every measured box is the container's answer and not the
 * viewport's — the two geometries must produce identical numbers. */
const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 720px; }
    </style>
    <div id="stage">${RADIO}${TABS}${TOOLS}</div>`;

const item = (bank, i) => `#${bank} >>> #item-${i}`;

const ORACLE_RESTING_WEIGHT = '400';

const SLATE_SELECTED_WEIGHT = '500';

const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const SELECTION_PROPERTIES = /\b(background|background-color|color|border|box-shadow|outline)\s*:/;
const SELECTION_STATE = /\[(aria-checked|aria-selected|aria-pressed)/;

async function sourceOffenders(root = new URL('../../src', import.meta.url).pathname) {
    const files = [];
    (function walk(dir) {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (path.endsWith('.js')) files.push(path);
        }
    })(root);

    const offenders = [];
    for (const file of files) {
        const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
        for (const match of source.matchAll(/([^{}\n]*::part\(item\)[^{]*)\{([^}]*)\}/g)) {
            const [, selector, body] = match;
            if (SELECTION_PROPERTIES.test(body) || SELECTION_STATE.test(selector)) {
                offenders.push(`${file.split('/src/')[1]}: ${selector.trim()}`);
            }
        }
    }
    return offenders;
}

const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The dial's own shadow segment is always the LAST one (assertions.js, shadowSegments). */
const lastSegment = (value) => shadowSegments(value).at(-1) ?? '';

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-bank @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
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

        test('the bank is one hairline of --ui-line around a --ui-key ground, at --ui-radius', () => mounted(async (page) => {
            const got = await page.computed('#radio', [
                'border-top-width', 'border-top-color', 'border-top-left-radius',
                'background-color', 'display', 'overflow-x', 'min-height',
            ]);

            near(
                parseFloat(got['border-top-width']),
                parseFloat(await page.resolveToken('--ui-border-w', 'width')),
                'the bank is one --ui-border-w hairline',
            );
            assert.equal(got['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'));
            assert.equal(got['border-top-left-radius'], await page.resolveToken('--ui-radius', 'border-top-left-radius'));
            assert.equal(got['background-color'], await page.resolveToken('--ui-key', 'background-color'));
            assert.equal(got['min-height'], await page.resolveToken('--ui-control-h', 'min-height'));
            assert.equal(got['overflow-x'], 'hidden');
            assert.equal(got.display, 'grid', 'one piece: the host IS the bank, and it is n equal columns');
        }));

        test('the bank measures 64 outside and 62 inside, which is the oracle\'s settings bank', () => mounted(async (page) => {
            const bank = await page.box('#radio');
            const cell = await page.box(item('radio', 0));
            near(bank.height, 64, 'the bank floor is --ui-control-h');
            near(cell.height, 62, 'the item is --ui-control-inner = 64 - 2 hairlines');
            near(bank.width, 720, 'the bank fills its stated container');
            /* Three equal cells inside one border pair: 720 - 2 = 718 / 3. */
            near(cell.width, 718 / 3, 'flex: 1 1 0 gives equal cells');
        }));

        test('an unselected item is transparent, --ui-muted, 17px/400, 18px inset', () => mounted(async (page) => {
            const got = await page.computed(item('radio', 0), [
                'background-color', 'color', 'font-size', 'font-weight',
                'padding-left', 'padding-right', 'padding-top', 'min-height', 'border-top-width',
            ]);
            assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)', 'the bank ground shows through');
            assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'));
            assert.equal(got['font-size'], await page.resolveToken('--ui-text-base', 'font-size'));
            assert.equal(got['font-weight'], '400');
            const inset = await page.resolveToken('--ui-space-4', 'padding-left');
            assert.equal(got['padding-left'], inset);
            assert.equal(got['padding-right'], inset);
            assert.equal(got['padding-top'], '0px', 'SOURCE slate-components.css:363 padding: 0 var(--slate-space-4)');
            assert.equal(got['border-top-width'], '0px', 'SOURCE slate-components.css:364 border: 0');
            assert.equal(got['min-height'], await page.resolveToken('--ui-control-inner', 'min-height'));
        }));

        test('the item takes its family and line-height by inheritance, not by restating them', () => mounted(async (page) => {
            const bankFamily = await page.prop('#radio', 'font-family');
            const cell = await page.computed(item('radio', 0), ['font-family', 'line-height', 'font-size']);
            assert.equal(cell['font-family'], bankFamily, 'font-family: inherit, not a second --ui-font-family');
            const ratio = parseFloat(cell['line-height']) / parseFloat(cell['font-size']);
            near(ratio, 1.5, 'the item consumes document.css\'s ratio (DQ-216)', 0.02);
        }));

        test('every item but the first draws the --ui-seam-ink inset seam, and the first draws none', () => mounted(async (page) => {
            const first = await page.prop(item('radio', 0), 'box-shadow');
            assert.equal(first, 'none', 'a bank of N items has N-1 seams');

            const ink = await page.resolveToken('--ui-seam-ink', 'color');
            for (const i of [2]) {
                /* Item 1 is the selected one in this fixture; item 2 is the plain seam. */
                const shadow = await page.prop(item('radio', i), 'box-shadow');
                assert.equal(shadow, `${ink} 1px 0px 0px 0px inset`,
                    'the seam is --ui-seam-ink at --ui-seam, inset, on the inline-start edge');
            }
        }));

        test('the seam SURVIVES selection — the composition slot, not a replacement', () => mounted(async (page) => {
            const ink = await page.resolveToken('--ui-seam-ink', 'color');
            await page.setToken('--ui-selected-led', '4px');
            const shadow = await page.prop(item('radio', 1), 'box-shadow');
            await page.setToken('--ui-selected-led', null);

            const segments = shadowSegments(shadow);
            assert.equal(segments.length, 2,
                `a selected middle item must carry seam AND LED, got ${shadow}`);
            assert.equal(segments[0], `${ink} 1px 0px 0px 0px inset`,
                'segment 1 is the resting seam, arriving through --_ui-rest-shadow');
            assert.match(segments[1], /inset/, 'segment 2 is the dial\'s LED');
            assert.match(segments[1], /-4px/, 'and it carries the dial\'s length');
        }));

        for (const [bank, spelling] of [['radio', 'aria-checked'], ['tabs', 'aria-selected'], ['tools', 'aria-pressed']]) {
            test(`the ${spelling} bank paints its selected item from the four dials and nothing else`, () => mounted(async (page) => {
                const selected = bank === 'radio' ? item(bank, 1) : item(bank, 0);
                const unselected = bank === 'radio' ? item(bank, 0) : item(bank, 1);
                await assertOneSelectionTreatment(page, { selected, unselected });
            }));
        }

        test('the selected cell LIFTS to Slate\'s medium weight, and it does so through the fifth dial',
            () => mounted(async (page) => {
                for (const [bank, sel, unsel] of [['radio', 1, 0], ['tabs', 0, 1], ['tools', 0, 1]]) {
                    const selected = await page.prop(item(bank, sel), 'font-weight');
                    const resting = await page.prop(item(bank, unsel), 'font-weight');
                    assert.equal(selected, SLATE_SELECTED_WEIGHT,
                        `${bank}: CITE [i=164] the selected cell is Slate's 500`);
                    assert.equal(resting, ORACLE_RESTING_WEIGHT,
                        `${bank}: CITE [i=165] the resting cell is Slate's 400`);
                    assert.equal(selected, await page.resolveToken('--ui-selected-weight', 'font-weight'),
                        `${bank}: the 500 is READ from the dial, not written in this component`);
                }
            }));

        test('NO PRIVATE SELECTED LOOK: with all five dials neutral, selected and resting are indistinguishable',
            () => mounted(async (page) => {
                await page.setToken('--ui-selected-face', 'transparent');
                await page.setToken('--ui-selected-ink', 'currentColor');
                await page.setToken('--ui-selected-led', '0px');
                await page.setToken('--ui-selected-glow', '0%');
                await page.setToken('--ui-selected-weight', 'var(--ui-weight-regular)');
                try {
                    for (const [bank, sel, unsel] of [['radio', 1, 0], ['tabs', 0, 1], ['tools', 0, 1]]) {
                        const selected = await page.computed(item(bank, sel), NON_DIAL_PROPERTIES);
                        const resting = await page.computed(item(bank, unsel), NON_DIAL_PROPERTIES);
                        const differing = Object.keys(selected).filter((k) => selected[k] !== resting[k]);

                        assert.deepEqual(differing.filter((k) => k !== 'border-top-color'), [],
                            `${bank}: a selected cell differs from a resting one with every dial `
                            + 'turned off — that is a fifth selection treatment, the founding '
                            + `defect (Part 10 §12). Differing: ${JSON.stringify(
                                Object.fromEntries(differing.map((k) => [k, [selected[k], resting[k]]])))}`);

                        for (const [name, cell] of [['selected', selected], ['resting', resting]]) {
                            for (const edge of ['border-top-width', 'border-bottom-width', 'border-left-width']) {
                                assert.equal(cell[edge], '0px',
                                    `${bank}: the ${name} cell has no border to colour `
                                    + '(SOURCE slate-components.css:364 border: 0)');
                            }
                        }
                        for (const [i, cell] of [[sel, selected], [unsel, resting]]) {
                            const ink = await page.prop(item(bank, i), 'color');
                            assert.equal(cell['border-top-color'], ink,
                                `${bank}: border-top-color is the initial currentColor, not a declaration`);
                        }
                    }
                } finally {
                    for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                        '--ui-selected-led', '--ui-selected-glow', '--ui-selected-weight']) {
                        await page.setToken(dial, null);
                    }
                }
            }));

        test('the selected face is --ui-steel and the ink --ui-on-steel, as Slate ships them', () => mounted(async (page) => {
            const got = await page.computed(item('radio', 1), ['background-color', 'color']);
            assert.equal(got['background-color'], await page.resolveToken('--ui-steel', 'background-color'));
            assert.equal(got.color, await page.resolveToken('--ui-on-steel', 'color'));
        }));

        test('L8: one turn of --ui-selected-face moves all three banks at once', () => mounted(async (page) => {
            const selected = [item('radio', 1), item('tabs', 0), item('tools', 0)];
            const before = await Promise.all(selected.map((s) => page.prop(s, 'background-color')));

            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            const during = await Promise.all(selected.map((s) => page.prop(s, 'background-color')));
            await page.setToken('--ui-selected-face', null);
            const after = await Promise.all(selected.map((s) => page.prop(s, 'background-color')));

            assert.deepEqual(during, [DRILL_COLOUR, DRILL_COLOUR, DRILL_COLOUR],
                'every selection surface in the page reads the same dial');
            assert.deepEqual(after, before, 'and every one of them restores');
        }));

        test('E10: a document sheet aimed at every competing class name reaches nothing', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            const selected = item('radio', 1);
            const before = await page.computed(selected, ['background-color', 'color', 'font-weight']);
            assert.equal(before['background-color'], face);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.textContent = `
                    .item, .pe-seg, .pe-segmented > *, .slate-bank-item,
                    .is-active, .is-selected, [aria-checked="true"], [aria-selected="true"],
                    ui-bank *, ui-bank > * {
                        background-color: rgb(1, 2, 3) !important;
                        color: rgb(4, 5, 6) !important;
                        font-weight: 900 !important;
                        box-shadow: none !important;
                    }`;
                document.head.append(s);
                return true;
            });
            await page.settle(2);

            const after = await page.computed(selected, ['background-color', 'color', 'font-weight']);
            assert.deepEqual(after, before,
                'a document sheet — !important, appended last, aimed at both implementations\' ' +
                'class names — cannot reach the selected paint. Load order stops being a mechanism.');
        }));

        test('E10: two banks either side of that sheet are painted identically', () => mounted(async (page) => {
            const a = await page.computed(item('radio', 1), ['background-color', 'color', 'box-shadow']);
            const b = await page.computed(item('tabs', 0), ['background-color', 'color', 'box-shadow']);
            assert.equal(a['background-color'], b['background-color']);
            assert.equal(a.color, b.color);
            assert.equal(lastSegment(a['box-shadow']), lastSegment(b['box-shadow']),
                'the dial\'s own shadow segment is the same in both, whatever precedes it');
        }));

        test('T5: the LED is off because the dial is 0px, and it comes back when the dial moves', () => mounted(async (page) => {
            const selected = item('radio', 1);
            const off = lastSegment(await page.prop(selected, 'box-shadow'));
            assert.match(off, /inset/, 'the strip is always an inset shadow');
            assert.ok(/(^|\s)-?0px(\s|$)/.test(off), `the shipped dial draws no LED: ${off}`);

            await page.setToken('--ui-selected-led', '4px');
            const on = lastSegment(await page.prop(selected, 'box-shadow'));
            await page.setToken('--ui-selected-led', null);
            assert.match(on, /-4px/, `--ui-selected-led: 4px draws a 4px strip, got ${on}`);

            const restored = lastSegment(await page.prop(selected, 'box-shadow'));
            assert.equal(restored, off);
        }));

        test('T5: one instance can turn the LED off while :root has it on, with no !important', () => mounted(async (page) => {
            await page.setToken('--ui-selected-led', '4px');
            await page.setStyle('#tabs', { '--ui-selected-led': '0px' });

            const rooted = lastSegment(await page.prop(item('radio', 1), 'box-shadow'));
            const scoped = lastSegment(await page.prop(item('tabs', 0), 'box-shadow'));
            await page.setToken('--ui-selected-led', null);

            assert.match(rooted, /-4px/, 'the :root dial still reaches every other bank');
            assert.ok(/(^|\s)-?0px(\s|$)/.test(scoped),
                `one instance turned its own LED off with a value: ${scoped}`);
        }));

        test('the general token drill: every value the bank paints follows its token', () => mounted(async (page) => {
            await assertTokenDrill(page, { token: '--ui-key', selector: '#radio', property: 'background-color' });
            await assertTokenDrill(page, { token: '--ui-line', selector: '#radio', property: 'border-top-color' });
            await assertTokenDrill(page, { token: '--ui-muted', selector: item('radio', 0), property: 'color' });
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH,
                selector: '#radio', property: 'border-top-left-radius',
            });
            await assertTokenDrill(page, {
                token: '--ui-control-h', value: DRILL_LENGTH,
                selector: '#radio', property: 'min-height',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-4', value: DRILL_LENGTH,
                selector: item('radio', 0), property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH,
                selector: item('radio', 0), property: 'font-size',
            });
        }));

        test('the seam drills on both of its tokens — the ink and the width', () => mounted(async (page) => {
            /* A length is not a legal box-shadow on its own, so the landing check is
             * off and the shape is asserted here (assertTokenDrill, expectLanding). */
            const ink = await assertTokenDrill(page, {
                token: '--ui-seam-ink', selector: item('radio', 2),
                property: 'box-shadow', expectLanding: false,
            });
            assert.equal(ink.after, `${DRILL_COLOUR} 1px 0px 0px 0px inset`);

            const width = await assertTokenDrill(page, {
                token: '--ui-seam', value: DRILL_LENGTH, selector: item('radio', 2),
                property: 'box-shadow', expectLanding: false,
            });
            assert.match(width.after, /37px 0px 0px 0px inset/,
                'the seam width is --ui-seam, not a literal hairline');
        }));

        test('--ui-control-inner is derived, so the item floor follows the control height', () => mounted(async (page) => {
            const before = parseFloat(await page.prop(item('radio', 0), 'min-height'));
            near(before, 62, 'the shipped inner floor');
            await page.setToken('--ui-hairline', '5px');
            const after = parseFloat(await page.prop(item('radio', 0), 'min-height'));
            await page.setToken('--ui-hairline', null);
            near(after, 64 - 10, 'min-block-size re-derives as control-h - 2 x hairline');
        }));

        test('the focus ring is the one ring, drawn INSIDE the bank that clips it', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, item('radio', 0));
            assert.equal(
                g.outlineOffset,
                await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'a bank always clips, so the inset offset is the component\'s answer and not the consumer\'s to remember',
            );
        }));

        test('the ring is unclipped on the first and last cells too, which is where a clip shows first', () => mounted(async (page) => {
            await assertFocusUnclipped(page, item('tabs', 0));
            await assertFocusUnclipped(page, item('tabs', 2));
        }));

        test('the focus geometry drills on --ui-focus-w', () => mounted(async (page) => {
            await page.focusVisible(item('radio', 0));
            await assertTokenDrill(page, {
                token: '--ui-focus-w', value: '7px',
                selector: item('radio', 0), property: 'outline-width',
                prepare: (p) => p.focusVisible(item('radio', 0)),
            });
        }));

        test('an item clears --ui-hit-min on the block axis with its own ink', () => mounted(async (page) => {
            await assertHitFloor(page, item('radio', 0), { mode: 'box', axes: ['block'] });
            await assertHitFloor(page, item('tools', 0), { mode: 'box', axes: ['block'] });
        }));

        test('a narrow container shrinks the cells and ellipsises, and clips nothing', () => mounted(async (page) => {
            await page.setStyle('#stage', { 'inline-size': '240px' });
            const m = await page.metrics('#radio');

            near(m.rect.width, 240, 'the bank is its container, not the viewport');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                `the bank clips nothing: scrollWidth ${m.scrollWidth} against clientWidth ${m.clientWidth}`);

            const cell = await page.box(item('radio', 0));
            near(cell.width, 238 / 3, 'three equal cells inside one border pair');

            const label = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { scroll: el.scrollWidth, client: el.clientWidth, overflow: getComputedStyle(el).textOverflow };
            }, `${item('radio', 2)} >>> .label`);
            assert.equal(label.overflow, 'ellipsis');
            assert.ok(label.scroll > label.client, 'the long label is ellipsised rather than pushing the bank wide');
        }));

        test('each mode speaks exactly one aria spelling, on the host and on the items', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const read = (id) => {
                    const host = document.getElementById(id);
                    const items = [...host.shadowRoot.querySelectorAll('.item')];
                    return {
                        host: host.getAttribute('role'),
                        label: host.getAttribute('aria-label'),
                        item: items[0].getAttribute('role'),
                        states: items.map((el) => ['aria-checked', 'aria-selected', 'aria-pressed']
                            .filter((a) => el.hasAttribute(a))
                            .map((a) => `${a}=${el.getAttribute(a)}`)),
                    };
                };
                return { radio: read('radio'), tabs: read('tabs'), tools: read('tools') };
            });

            assert.deepEqual(shape.radio, {
                host: 'radiogroup', label: 'On disconnect', item: 'radio',
                states: [['aria-checked=false'], ['aria-checked=true'], ['aria-checked=false']],
            });
            assert.deepEqual(shape.tabs, {
                host: 'tablist', label: 'Chart', item: 'tab',
                states: [['aria-selected=true'], ['aria-selected=false'], ['aria-selected=false']],
            });
            assert.deepEqual(shape.tools, {
                host: 'group', label: 'Lighting', item: null,
                states: [['aria-pressed=true'], ['aria-pressed=false']],
            });
        }));

        test('the group name can be taken away again — a cleared label removes aria-label', () => mounted(async (page) => {
            const seen = await page.evalFn(async () => {
                const el = document.getElementById('radio');
                const read = () => el.getAttribute('aria-label');
                const withLabel = read();
                el.label = '';
                await el.updateComplete;
                const cleared = read();
                el.label = 'New';
                await el.updateComplete;
                const renamed = read();
                el.label = null;
                await el.updateComplete;
                return { withLabel, cleared, renamed, nulled: read(), role: el.getAttribute('role') };
            });
            assert.deepEqual(seen, {
                withLabel: 'On disconnect',
                cleared: null,
                renamed: 'New',
                nulled: null,
                role: 'radiogroup',
            }, 'a radiogroup whose name was cleared must not keep announcing the old one');
        }));

        test('an aria-label the SCREEN wrote survives this component clearing its own', () => mounted(async (page) => {
            const seen = await page.evalFn(async () => {
                const el = document.createElement('ui-bank');
                el.setAttribute('aria-label', 'Screen wrote this');
                el.items = ['a', 'b'];
                el.value = 'a';
                document.getElementById('stage').append(el);
                await el.updateComplete;
                const authored = el.getAttribute('aria-label');
                el.label = 'Component wrote this';
                await el.updateComplete;
                const overridden = el.getAttribute('aria-label');
                el.label = '';
                await el.updateComplete;
                const restored = el.getAttribute('aria-label');
                el.remove();
                return { authored, overridden, restored };
            });
            assert.deepEqual(seen, {
                authored: 'Screen wrote this',
                overridden: 'Component wrote this',
                restored: 'Screen wrote this',
            });
        }));

        test('the aria state and the painted state are the same state, so they cannot drift', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            await page.evalFn(() => { document.getElementById('radio').value = 'disconnect'; return true; });
            await page.settle(2);

            const moved = await page.evalFn(() => {
                const items = [...document.getElementById('radio').shadowRoot.querySelectorAll('.item')];
                return items.map((el) => el.getAttribute('aria-checked'));
            });
            assert.deepEqual(moved, ['false', 'false', 'true']);
            assert.equal(await page.prop(item('radio', 2), 'background-color'), face);
            assert.notEqual(await page.prop(item('radio', 1), 'background-color'), face);
        }));

        test('exactly one item is the tab stop — the roving contract (Appendix 10)', () => mounted(async (page) => {
            const stops = await page.evalFn(() => {
                const out = {};
                for (const id of ['radio', 'tabs', 'tools']) {
                    out[id] = [...document.getElementById(id).shadowRoot.querySelectorAll('.item')]
                        .map((el) => el.getAttribute('tabindex'));
                }
                return out;
            });
            assert.deepEqual(stops.radio, ['-1', '0', '-1'], 'the tab stop follows the selection');
            assert.deepEqual(stops.tabs, ['0', '-1', '-1']);
            assert.deepEqual(stops.tools, ['0', '-1']);
        }));

        test('ArrowRight/ArrowLeft move selection and focus, wrapping', () => mounted(async (page) => {
            await page.focusVisible(item('tabs', 0));
            await page.press('ArrowRight');
            await page.settle(2);
            assert.equal(await page.prop(item('tabs', 1), 'background-color'),
                await page.resolveToken('--ui-selected-face', 'background-color'));
            assert.equal(await page.evalFn(() =>
                document.getElementById('tabs').shadowRoot.activeElement?.id), 'item-1');

            await page.press('ArrowLeft');
            await page.settle(2);
            await page.press('ArrowLeft');
            await page.settle(2);
            assert.equal(await page.evalFn(() =>
                document.getElementById('tabs').shadowRoot.activeElement?.id), 'item-2',
            'ArrowLeft from the first wraps to the last, modulo, exactly as profile_editor.js:3592 does');
        }));

        test('Home and End go to the ends', () => mounted(async (page) => {
            await page.focusVisible(item('tabs', 1));
            await page.press('End');
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('tabs').value), 'data');
            await page.press('Home');
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('tabs').value), 'flow');
        }));

        test('a disabled item is skipped on both the arrow path and the Home/End path', () => mounted(async (page) => {
            await page.evalFn(() => {
                const el = document.getElementById('tabs');
                el.items = [
                    { value: 'flow', label: 'Pressure / Flow' },
                    { value: 'power', label: 'Resistance / Impedance', disabled: true },
                    { value: 'data', label: 'Shot data' },
                ];
                el.value = 'flow';
                return true;
            });
            await page.settle(2);

            await page.focusVisible(item('tabs', 0));
            await page.press('ArrowRight');
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('tabs').value), 'data',
                'the disabled tab is stepped over, not landed on');

            await page.press('End');
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('tabs').value), 'data');
        }));

        test('toolbar mode moves the tab stop without pressing anything, and Space chooses', () => mounted(async (page) => {
            await page.focusVisible(item('tools', 0));
            await page.press('ArrowRight');
            await page.settle(2);

            assert.equal(await page.evalFn(() => document.getElementById('tools').value), 'Awake',
                'arrowing did not press anything');
            assert.equal(await page.evalFn(() =>
                document.getElementById('tools').shadowRoot.activeElement?.id), 'item-1');
            const stops = await page.evalFn(() => [...document.getElementById('tools').shadowRoot
                .querySelectorAll('.item')].map((el) => el.getAttribute('tabindex')));
            assert.deepEqual(stops, ['-1', '0'], 'the roving tab stop followed the focus');

            await page.press(' ');
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('tools').value), 'Asleep');
        }));

        test('a click changes the value and fires change once; re-clicking fires nothing', () => mounted(async (page) => {
            await page.recordEvents('#radio', ['change']);
            await page.click(item('radio', 2));
            await page.settle(2);

            assert.equal(await page.evalFn(() => document.getElementById('radio').value), 'disconnect');
            let events = await page.recordedEvents();
            assert.equal(events.length, 1, 'exactly one change per user choice');

            await page.click(item('radio', 2));
            await page.settle(2);
            events = await page.recordedEvents();
            assert.equal(events.length, 1, 'choosing what is already chosen is not a change');
        }));

        test('a programmatic write does not fire change — the native contract', () => mounted(async (page) => {
            await page.recordEvents('#radio', ['change']);
            await page.evalFn(() => { document.getElementById('radio').value = 'nothing'; return true; });
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), []);
        }));

        test('a disabled bank takes the dial once and refuses input', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('radio').disabled = true; return true; });
            await page.settle(2);

            const dim = await page.resolveToken('--ui-opacity-disabled', 'opacity');
            assert.equal(await page.prop('#radio', 'opacity'), dim, 'the host carries the one dial');
            assert.equal(await page.prop(item('radio', 0), 'opacity'), '1',
                'the items opt out, or the two would compound to .14');
            assert.equal(
                await page.evalFn(() => document.getElementById('radio').getAttribute('aria-disabled')),
                'true',
                'the disabled state is announced as well as painted (Appendix 15)',
            );

            await page.recordEvents('#radio', ['change']);
            await page.click(item('radio', 2));
            await page.settle(2);
            assert.equal(await page.evalFn(() => document.getElementById('radio').value), 'display-off');
            assert.deepEqual(await page.recordedEvents(), []);
        }));

        test('a single disabled item still dims inside a live bank', () => mounted(async (page) => {
            await page.evalFn(() => {
                const el = document.getElementById('tools');
                el.items = [{ value: 'Awake', label: 'Awake' }, { value: 'Asleep', label: 'Asleep', disabled: true }];
                return true;
            });
            await page.settle(2);
            const dim = await page.resolveToken('--ui-opacity-disabled', 'opacity');
            assert.equal(await page.prop(item('tools', 1), 'opacity'), dim);
            assert.equal(await page.prop(item('tools', 0), 'opacity'), '1');
        }));

        test('a stuck :hover cannot repaint the selected item as unselected', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            const ink = await page.resolveToken('--ui-selected-ink', 'color');
            const box = await page.box(item('radio', 1));
            await page.mouse('mouseMoved', box.left + box.width / 2, box.top + box.height / 2);
            await page.settle(2);

            const hovered = await page.computed(item('radio', 1), ['background-color', 'color']);
            assert.equal(hovered['background-color'], face, 'the selected cell keeps its face under the finger');
            assert.equal(hovered.color, ink, 'and its ink');

            /* And the hover affordance is real on an unselected cell — an ink lift and
             * no face, so hover can never be mistaken for selection across a kitchen. */
            const other = await page.box(item('radio', 0));
            await page.mouse('mouseMoved', other.left + other.width / 2, other.top + other.height / 2);
            await page.settle(2);
            const unselected = await page.computed(item('radio', 0), ['background-color', 'color']);
            assert.equal(unselected['background-color'], 'rgba(0, 0, 0, 0)', 'hover paints no face');
            assert.equal(unselected.color, await page.resolveToken('--ui-text-2', 'color'));
        }));

        test('slotted cell content inherits the selected ink instead of painting itself', () => mounted(async (page) => {
            const markup = `<ui-bank id="slotted" mode="tablist" label="Preset" value="p2"
                items='[{"value":"p1","label":"1"},{"value":"p2","label":"2"}]'>
                  <span id="s1" slot="item-p1">18 g</span>
                  <span id="s2" slot="item-p2">20 g</span>
                </ui-bank>`;
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, []);
            assert.equal(await page.prop('#s2', 'color'), await page.resolveToken('--ui-selected-ink', 'color'),
                'the BUTTON owns the paint, so the slotted content is simply currentColor');
            assert.equal(await page.prop('#s1', 'color'), await page.resolveToken('--ui-muted', 'color'));
        }));

        test('the component paints with no !important anywhere in its own sheet', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('radio').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const s = rule.style;
                        if (!s) continue;
                        for (let i = 0; i < s.length; i++) {
                            if (s.getPropertyPriority(s[i]) === 'important') hits.push(rule.selectorText + ' { ' + s[i] + ' }');
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));

        test('the ONE part is a type seam, not a hole in the selection treatment', () => mounted(async (page) => {
            const parts = await page.evalFn(() =>
                [...document.getElementById('radio').shadowRoot.querySelectorAll('*')]
                    .filter((el) => el.hasAttribute('part'))
                    .map((el) => el.getAttribute('part')));
            assert.deepEqual([...new Set(parts)], ['item'],
                'one part, named `item`; a second is a second hole and has to be argued first');

            const offenders = await sourceOffenders();
            assert.deepEqual(offenders, [],
                'a ::part(item) rule may set type and size; ground, ink and a selected-state '
                + 'selector are the treatment this component owns');
        }));
    });
}

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-bank', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-bank.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('every gallery state mounts and renders a bank with items', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-bank--${state.id} threw`);
            assert.ok(await page.count('ui-bank') >= 1, `gallery state ui-bank--${state.id} mounted nothing`);
            const cells = await page.evalFn(() => [...document.querySelectorAll('ui-bank')]
                .map((el) => el.shadowRoot.querySelectorAll('.item').length));
            assert.ok(cells.every((n) => n >= 2), `ui-bank--${state.id} rendered a bank with fewer than two cells`);
        }
    });
});

test('every gallery state paints its selected cell from the dials — including the fork\'s', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            const painted = await page.evalFn(() => {
                const out = [];
                for (const bank of document.querySelectorAll('ui-bank')) {
                    for (const el of bank.shadowRoot.querySelectorAll('.item')) {
                        const on = ['aria-checked', 'aria-selected', 'aria-pressed']
                            .some((a) => el.getAttribute(a) === 'true');
                        if (!on) continue;
                        out.push([
                            getComputedStyle(el).backgroundColor,
                            getComputedStyle(el).color,
                            getComputedStyle(bank).getPropertyValue('--ui-selected-face').trim(),
                            getComputedStyle(bank).getPropertyValue('--ui-selected-ink').trim(),
                        ]);
                    }
                }
                return out;
            });
            for (const [face, ink, faceToken, inkToken] of painted) {
                const wantFace = await page.resolveValue(faceToken, 'background-color');
                const wantInk = await page.resolveValue(inkToken, 'color');
                assert.equal(face, wantFace, `ui-bank--${state.id}: selected face is not --ui-selected-face`);
                assert.equal(ink, wantInk, `ui-bank--${state.id}: selected ink is not --ui-selected-ink`);
            }
        }
    });
});

test('the bank renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        const bank = await page.box('#radio');
        const cell = await page.box(item('radio', 1));
        return {
            dpr: await page.eval('devicePixelRatio'),
            bank: [Math.round(bank.width), Math.round(bank.height)],
            cell: [Math.round(cell.width), Math.round(cell.height)],
            face: await page.prop(item('radio', 1), 'background-color'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual([bench.bank, bench.cell, bench.face], [floor.bank, floor.cell, floor.face],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same bank');
    assert.deepEqual(bench.bank, [720, 64], 'and it is the oracle\'s 64px bank at its stated width');
    assert.deepEqual(bench.cell, [239, 62], 'with the oracle\'s 62px inner cell');
});
