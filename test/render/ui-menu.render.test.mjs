/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { launch, sleep, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-menu.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    assertScrollFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

/* #1's button is the trigger the row names, so it is loaded with the menu. */
const MODULE = ['/src/components/ui-menu.js', '/src/components/ui-button.js'];

/** Items as the gallery declares them — through the attribute, JSON-parsed by Lit. */
const attr = (items) => JSON.stringify(items).replaceAll('"', '&quot;');

const ITEMS = [
    { id: 'rename', label: 'Rename' },
    { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
    { id: 'locked', label: 'Locked', disabled: true },
    { separator: true },
    { id: 'delete', label: 'Delete', danger: true },
];

/** Forty rows: O11's menu, and taller than either standard geometry. */
const MANY = Array.from({ length: 40 }, (_, i) => ({ id: `row-${i}`, label: `Row ${i + 1}` }));

const MARKUP = `
<div id="page" style="padding: 120px 260px">
  <ui-menu id="m" label="Profile actions" items="${attr(ITEMS)}">
    <ui-button id="trig" slot="trigger">Actions</ui-button>
  </ui-menu>
  <button id="after" style="margin-inline-start: 24px">After</button>
  <div style="margin-block-start: 40px"><button id="beneath">Beneath</button></div>
  <div style="margin-block-start: 40px"><button id="dialogish">Dialogish</button></div>
</div>`;

/** A trigger pinned near the bottom of the window, at either geometry. */
const LOW = `
<div style="position: fixed; inset-block-end: 10px; inset-inline-start: 200px">
  <ui-menu id="m" items="${attr(ITEMS)}"><button id="trig" slot="trigger">Actions</button></ui-menu>
</div>`;

/** A trigger pinned against the right edge, so the clamp has to fire. */
const RIGHT = `
<div style="position: fixed; inset-block-start: 90px; inset-inline-end: 2px">
  <ui-menu id="m" items="${attr(ITEMS)}"><button id="trig" slot="trigger">Actions</button></ui-menu>
</div>`;

/** The menu inside a 380px column — "anchor positioning inside a container". */
const NARROW = `
<div id="col" style="inline-size: 380px; margin: 100px 60px">
  <ui-menu id="m" items="${attr(ITEMS)}"><button id="trig" slot="trigger" style="inline-size: 100%">Actions</button></ui-menu>
</div>`;

const CONTAINED = `
<div id="stage" style="contain: layout; position: relative; margin: 140px 90px; block-size: 320px">
  <ui-menu id="m" items="${attr(ITEMS)}"><button id="trig" slot="trigger">Actions</button></ui-menu>
</div>`;

/** An ancestor that clips. A fixed popover must not be inside its clip. */
const CLIPPED = `
<div id="box" style="overflow: hidden; block-size: 90px; inline-size: 300px; margin: 120px 80px">
  <ui-menu id="m" items="${attr(ITEMS)}"><button id="trig" slot="trigger">Actions</button></ui-menu>
</div>`;

const surfaceOf = (host = 'm') => `#${host} >>> #surface`;
const listOf = (host = 'm') => `#${host} >>> #list`;
const itemsOf = (host = 'm') => `#${host} >>> .item`;

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Every `.item` box in document order, with its label — one round trip. */
const itemBoxes = (page, host = 'm') => page.evalFn((sel) => {
    const out = [];
    for (const el of window.__h.qAll(sel)) {
        const r = el.getBoundingClientRect();
        out.push({
            label: (el.querySelector('.label') || el).textContent.trim(),
            disabled: el.disabled,
            top: r.top, bottom: r.bottom, left: r.left, right: r.right,
            width: r.width, height: r.height,
        });
    }
    return out;
}, itemsOf(host));

/** The focused row's LABEL — the .label span, because an icon glyph is in there too. */
const focusedLabel = (page) => page.eval(
    '(window.__h.deepActiveElement().querySelector(".label") || window.__h.deepActiveElement())'
    + '.textContent.trim()',
);

/** Where the caret is, through every shadow root, as a readable path. */
const activePath = (page) => page.eval('window.__h.anchorPath(window.__h.deepActiveElement())');

const isOpen = (page, host = 'm') => page.evalFn((s) => window.__h.need(s).open === true, `#${host}`);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-menu @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        /** Open the way a finger does: a real CDP click, hit-tested by the browser. */
        const openByPress = async (page) => {
            await page.click('#trig');
            assert.equal(await page.exists(surfaceOf()), true, 'the press did not open the menu');
        };

        /** Open the way the gallery does: the property, which must NOT take focus. */
        const openByProperty = async (page) => {
            await page.evalFn((s) => { window.__h.need(s).open = true; return true; }, '#m');
            await page.settle(2);
            assert.equal(await page.exists(surfaceOf()), true, 'the property did not open the menu');
        };

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

        test('at rest there is no surface, no backdrop, and nothing fixed on the page', () => mounted(async (page) => {
            assert.equal(await page.exists(surfaceOf()), false, 'a closed menu renders no surface');
            assert.equal(await page.exists('#m >>> #backdrop'), false, 'a closed menu renders no backdrop');
            assert.equal(await page.count(itemsOf()), 0, 'a closed menu renders no rows');
        }));

        test('the trigger announces the popup on #1\'s inner control, and NOT on its role-less host', () => mounted(async (page) => {
            const read = () => page.evalFn((s) => {
                const host = window.__h.need(s);
                const inner = host.control;
                return {
                    hostPopup: host.getAttribute('aria-haspopup'),
                    hostExpanded: host.getAttribute('aria-expanded'),
                    innerPopup: inner ? inner.getAttribute('aria-haspopup') : null,
                    innerExpanded: inner ? inner.getAttribute('aria-expanded') : null,
                };
            }, '#trig');

            assert.deepEqual(await read(), {
                hostPopup: null, hostExpanded: null,
                innerPopup: 'menu', innerExpanded: 'false',
            }, 'a closed menu announces aria-expanded=false, once, on the button');

            await openByPress(page);
            assert.deepEqual(await read(), {
                hostPopup: null, hostExpanded: null,
                innerPopup: 'menu', innerExpanded: 'true',
            }, 'the open state must reach the element that carries the button role');
        }));

        test('the accessibility tree announces exactly ONE popup and one expanded state', () => mounted(async (page) => {
            await openByPress(page);
            await page.send('Accessibility.enable');
            const { nodes } = await page.send('Accessibility.getFullAXTree');

            const carrying = (name) => nodes
                .filter((n) => (n.properties || []).some((p) => p.name === name))
                .map((n) => ({
                    role: n.role?.value ?? null,
                    name: n.name?.value ?? null,
                }));

            const popups = carrying('hasPopup');
            assert.equal(popups.length, 1,
                `exactly one node may announce the popup, got ${JSON.stringify(popups)} — a second, `
                + 'unnamed generic carrying hasPopup is bug L23\'s shape');
            assert.equal(popups[0].role, 'button', 'and it is the button');
            assert.equal(popups[0].name, 'Actions', 'named by the trigger\'s own label');

            const expanded = carrying('expanded');
            assert.equal(expanded.length, 1,
                `exactly one node may carry the expanded state, got ${JSON.stringify(expanded)}`);
            assert.equal(expanded[0].role, 'button');
        }));

        test('a trigger that upgrades LATE leaves no attributes behind on its host', () => mounted(async (page) => {
            const state = await page.evalFn((s) => {
                const host = window.__h.need(s);
                // Force the pre-upgrade shape the timing produces, then re-sync.
                const real = Object.getOwnPropertyDescriptor(
                    Object.getPrototypeOf(host), 'control',
                );
                Object.defineProperty(host, 'control', { configurable: true, get: () => undefined });
                const menu = host.closest('ui-menu');
                menu.requestUpdate();
                return menu.updateComplete.then(() => {
                    const before = {
                        hostPopup: host.getAttribute('aria-haspopup'),
                        hostExpanded: host.getAttribute('aria-expanded'),
                    };
                    // Now the element upgrades: `control` starts answering.
                    delete host.control;
                    if (real) Object.defineProperty(host, 'control', real);
                    menu.requestUpdate();
                    return menu.updateComplete.then(() => ({
                        before,
                        after: {
                            hostPopup: host.getAttribute('aria-haspopup'),
                            hostExpanded: host.getAttribute('aria-expanded'),
                            innerPopup: host.control?.getAttribute('aria-haspopup') ?? null,
                        },
                    }));
                });
            }, '#trig');

            assert.deepEqual(state.before, { hostPopup: 'menu', hostExpanded: 'false' },
                'with no control to write to, the host is the button and does carry them');
            assert.deepEqual(state.after, { hostPopup: null, hostExpanded: null, innerPopup: 'menu' },
                'once the control answers, the host copy must be REMOVED, not merely stopped');
        }));

        test('the surface sits one --ui-space-2 below the trigger, centred on it', () => mounted(async (page) => {
            await openByPress(page);
            const gap = parseFloat(await page.resolveValue('var(--ui-space-2)', 'width'));
            near(gap, 8, 'SOURCE context-menu.js:3 MARGIN = 8 -> --ui-space-2');

            const trigger = await page.box('#trig');
            const surface = await page.box(surfaceOf());

            near(surface.top, trigger.bottom + gap, 'the surface hangs one gap below the anchor');
            near(
                surface.left + surface.width / 2,
                trigger.left + trigger.width / 2,
                'SOURCE context-menu.js:41 — centred on the anchor',
            );
            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('placed'), '#m'), 'below');
        }));

        test('a trigger with no room below flips above it', () => mounted(async (page) => {
            await openByPress(page);
            const gap = parseFloat(await page.resolveValue('var(--ui-space-2)', 'width'));
            const trigger = await page.box('#trig');
            const surface = await page.box(surfaceOf());

            assert.equal(await page.evalFn((s) => window.__h.need(s).getAttribute('placed'), '#m'), 'above',
                'SOURCE context-menu.js:35 — flip when below cannot hold the menu and above has more room');
            near(surface.bottom, trigger.top - gap, 'the flipped surface sits one gap above the anchor');
            assert.ok(surface.top >= 0, `the flipped surface starts off-screen at ${surface.top}`);
        }, LOW));

        test('a trigger at the right edge clamps by --ui-space-3, and the arrow follows', () => mounted(async (page) => {
            await openByPress(page);
            const edge = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));
            near(edge, 12, 'SOURCE context-menu.js:4 VIEWPORT_PADDING = 12 -> --ui-space-3');

            const trigger = await page.box('#trig');
            const surface = await page.box(surfaceOf());
            near(surface.right, geometry.width - edge, 'the clamp holds the surface inside the window');

            // The arrow keeps pointing at the anchor even though the box moved.
            const arrow = await page.computed(surfaceOf(), ['inset-inline-start', 'width'], { pseudo: '::before' });
            const arrowCentre = surface.left + parseFloat(arrow['inset-inline-start']);
            const anchorCentre = trigger.left + trigger.width / 2;
            assert.ok(
                Math.abs(arrowCentre - anchorCentre) <= parseFloat(arrow.width),
                `the arrow at ${arrowCentre} does not point at the anchor centre ${anchorCentre}`,
            );
        }, RIGHT));

        test('the anchor gap is read from --ui-space-2, not written into the JS', () => mounted(async (page) => {
            const reopen = async (p) => {
                await p.evalFn((sel) => { window.__h.need(sel).open = false; return true; }, '#m');
                await p.settle(1);
                await p.evalFn((sel) => { window.__h.need(sel).open = true; return true; }, '#m');
                await p.settle(2);
            };
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '37px',
                read: async (p) => {
                    const trigger = await p.box('#trig');
                    const surface = await p.box(surfaceOf());
                    return Math.round(surface.top - trigger.bottom);
                },
                expected: 37,
                prepare: reopen,
            });
        }));

        test('the edge padding is read from --ui-space-3, and the clamp moves with it', () => mounted(async (page) => {
            const reopen = async (p) => {
                await p.evalFn((sel) => { window.__h.need(sel).open = false; return true; }, '#m');
                await p.settle(1);
                await p.evalFn((sel) => { window.__h.need(sel).open = true; return true; }, '#m');
                await p.settle(2);
            };
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: '37px',
                read: async (p) => Math.round(geometry.width - (await p.box(surfaceOf())).right),
                expected: 37,
                prepare: reopen,
            });
        }, RIGHT));

        test('inside a 380px container the menu keeps its own minimum and its anchor', () => mounted(async (page) => {
            await openByPress(page);
            const trigger = await page.box('#trig');
            const surface = await page.box(surfaceOf());
            const gap = parseFloat(await page.resolveValue('var(--ui-space-2)', 'width'));

            near(surface.top, trigger.bottom + gap, 'the anchor still owns the vertical position');
            assert.ok(surface.width >= 220 - 0.5, `the surface shrank to ${surface.width} inside its column`);
            assert.ok(surface.width <= 320 + 0.5, `the surface grew past its 320px cap: ${surface.width}`);
        }, NARROW));

        test('inside a contain: layout stage the menu still lands under its anchor', () => mounted(async (page) => {
            await openByPress(page);
            const gap = parseFloat(await page.resolveValue('var(--ui-space-2)', 'width'));
            const edge = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));
            const trigger = await page.box('#trig');
            const surface = await page.box(surfaceOf());
            const stage = await page.box('#stage');

            near(surface.top, trigger.bottom + gap, 'a contained ancestor moved the menu off its anchor');

            near(surface.left, stage.left + edge, 'the clamp did not follow the containing block');
            assert.ok(surface.right <= stage.right - edge + 0.5,
                `the surface runs past its stage: ${surface.right} vs ${stage.right - edge}`);
        }, CONTAINED));

        test('an ancestor with overflow: hidden does not clip the popover', () => mounted(async (page) => {
            await openByPress(page);
            const box = await page.box('#box');
            const surface = await page.box(surfaceOf());
            assert.ok(
                surface.bottom > box.bottom + 1,
                `the menu ends at ${surface.bottom} inside a box ending at ${box.bottom} — it is being clipped`,
            );
            const items = await itemBoxes(page);
            assert.equal(items.length, 4, 'all four rows render');
            assert.ok(items[3].height >= 1, 'the last row has no height, so something is clipping it');
        }, CLIPPED));

        test('O2: the floating surface carries --ui-elev-2, and it is the token', () => mounted(async (page) => {
            await openByPress(page);
            const rendered = await page.prop(surfaceOf(), 'box-shadow');
            assert.notEqual(rendered, 'none',
                'O2 is exactly this: "box-shadow: none kills its elevation — a floating menu with no shadow"');
            assert.equal(rendered, await page.resolveToken('--ui-elev-2', 'box-shadow'),
                'SOURCE context-menu.css:21 is the token sheet\'s own SOURCE line for --ui-elev-2 '
                + '(styles/tokens.css:797-798)');

            await assertTokenDrill(page, {
                token: '--ui-elev-2',
                value: `0px 0px 0px 5px ${DRILL_COLOUR}`,
                selector: surfaceOf(),
                property: 'box-shadow',
            });
        }));

        test('the surface paints on the token surface, line, radius and z scale', () => mounted(async (page) => {
            await openByPress(page);
            const got = await page.computed(surfaceOf(), [
                'background-color', 'border-top-color', 'border-top-width',
                'border-top-left-radius', 'z-index', 'color', 'position',
            ]);
            assert.equal(got['background-color'], await page.resolveToken('--ui-surface', 'background-color'),
                'SOURCE slate-shell.css:938 background: var(--slate-surface)');
            assert.equal(got['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'),
                'SOURCE slate-shell.css:936 border-color: var(--slate-line)');
            near(parseFloat(got['border-top-width']),
                parseFloat(await page.resolveValue('var(--ui-border-w)', 'width')),
                'SOURCE context-menu.css:19 border: 1px -> --ui-border-w');
            assert.equal(got['border-top-left-radius'], await page.resolveValue('var(--ui-radius-xl)', 'border-top-left-radius'),
                'DEPARTURE 1: tokens.css:293 names the step in its own comment — '
                + '"a floating SURFACE: modal, sheet, menu"');
            assert.equal(got.color, await page.resolveToken('--ui-text', 'color'),
                'SOURCE slate-shell.css:939 color: var(--slate-text)');
            assert.equal(got.position, 'fixed', 'SOURCE context-menu.css:13');
            assert.equal(got['z-index'], (await page.tokenValue('--ui-z-menu')).trim(),
                'spec §3.7: --ui-z-menu is 200, replacing context-menu.css:4/:14\'s 9998/9999');
        }));

        test('the z-index is read from --ui-z-menu, not written', () => mounted(async (page) => {
            await openByPress(page);
            await assertTokenDrill(page, {
                token: '--ui-z-menu',
                value: '4242',
                selector: surfaceOf(),
                property: 'z-index',
                expected: '4242',
            });
            assert.equal(
                await page.prop('#m >>> #backdrop', 'z-index'),
                await page.prop(surfaceOf(), 'z-index'),
            );
        }));

        const withMany = (fn) => mounted(async (page) => {
            await page.evalFn((s, items) => { window.__h.need(s).items = items; return true; }, '#m', MANY);
            await page.settle(2);
            await openByPress(page);
            return fn(page);
        });

        test('O11: forty rows stay inside the window, and the LAST one is reachable', () => withMany(async (page) => {
            const edge = parseFloat(await page.resolveValue('var(--ui-space-3)', 'width'));
            const surface = await page.box(surfaceOf());

            assert.ok(
                surface.bottom <= geometry.height - edge + 0.5,
                `O11: the surface ends at ${surface.bottom} in a ${geometry.height}px window — `
                + 'Slate clamps top and lets the bottom run off the screen (context-menu.js:44)',
            );
            assert.ok(surface.top >= edge - 0.5, `the surface starts at ${surface.top}, above the edge padding`);

            const metrics = await page.metrics(listOf());
            assert.ok(metrics.scrollHeight > metrics.clientHeight + 0.5,
                'forty rows must overflow, or this assertion is vacuous');
            assert.equal(metrics.overflowY, 'auto', 'spec §2.4: a stated overflow, never a silent clip');
            assert.ok(metrics.scrollbarInline > 0,
                `the scroll region shows no scrollbar (gutter ${metrics.scrollbarInline}px) — spec §2.4 bans hiding it`);

            await page.press('End');
            const path = await activePath(page);
            assert.match(path, /button$/, `End did not land on a row: ${path}`);
            const label = await focusedLabel(page);
            assert.equal(label, `Row ${MANY.length}`, 'End must reach the fortieth row, not the last VISIBLE row');

            const port = await page.metrics(listOf());
            const row = await page.eval(`(() => {
                const r = window.__h.deepActiveElement().getBoundingClientRect();
                return JSON.stringify({top: r.top, bottom: r.bottom});
            })()`);
            const { top, bottom } = JSON.parse(row);
            assert.ok(top >= port.rect.top - 0.5 && bottom <= port.rect.bottom + 0.5,
                `the fortieth row [${top}, ${bottom}] is outside the scrollport `
                + `[${port.rect.top}, ${port.rect.bottom}] — this is O11`);
        }));

        test('spec §2.4: the scroll region has an explicit floor as well as an overflow', () => withMany(async (page) => {
            const control = await page.resolveValue('var(--ui-control-h)', 'min-height');
            const metrics = await page.metrics(listOf());
            assert.equal(metrics.minHeight, control,
                'the list keeps a one-row floor so a squeezed menu shows a row and scrolls');

            await assertScrollFloor(page, {
                selector: listOf(),
                squeezeSelector: surfaceOf(),
                squeeze: { 'max-block-size': '200px' },
                minBlockSize: control,
            });
        }));

        test('the cap is computed from the space beside the anchor, not from a constant', () => withMany(async (page) => {
            const before = (await page.box(surfaceOf())).height;
            await page.press('Escape');
            await page.setStyle('#page', { 'padding-block-start': `${Math.round(geometry.height / 2)}px` });
            await page.click('#trig');
            const after = (await page.box(surfaceOf())).height;
            assert.ok(after < before - 1,
                `the cap did not follow the anchor: ${before}px then ${after}px with half the window gone`);
        }));

        test('a row is a control-height row on the token type scale', () => mounted(async (page) => {
            await openByPress(page);
            const first = `${itemsOf()}`;
            const got = await page.computed(first, [
                'min-height', 'font-size', 'font-weight', 'font-family',
                'border-top-left-radius', 'padding-left', 'padding-top', 'column-gap', 'text-align',
            ]);
            assert.equal(got['min-height'], await page.resolveValue('var(--ui-control-h)', 'min-height'),
                'SOURCE slate-shell.css:945 min-height: 64px, which is --ui-control-h exactly');
            assert.equal(got['font-size'], await page.resolveValue('var(--ui-text-base)', 'font-size'),
                'SOURCE slate-shell.css:947 var(--slate-text-base) = 17px = --ui-text-base');
            assert.equal(got['font-weight'], '400', 'SOURCE slate-shell.css:948 -> --ui-weight-regular');
            assert.equal(got['border-top-left-radius'], await page.resolveValue('var(--ui-radius)', 'border-top-left-radius'),
                'SOURCE context-menu.css:79 var(--slate-radius) = 6px');
            assert.equal(got['padding-left'], await page.resolveValue('var(--ui-space-3)', 'padding-left'),
                'SOURCE context-menu.css:71 padding: 12px 14px -> --ui-space-3 on both axes');
            assert.equal(got['column-gap'], await page.resolveValue('var(--ui-space-3)', 'column-gap'),
                'SOURCE context-menu.css:69 gap: 12px -> --ui-space-3 exactly');
            assert.equal(got['text-align'], 'start', 'SOURCE context-menu.css:78');
        }));

        test('every row clears the --ui-hit-min floor with the paint alone', () => mounted(async (page) => {
            await openByPress(page);
            await assertHitFloor(page, itemsOf(), { mode: 'box', axes: ['block'] });
            const boxes = await itemBoxes(page);
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            for (const box of boxes) {
                assert.ok(box.height >= floor - 0.5,
                    `"${box.label}" is ${box.height}px against a ${floor}px floor — bug P4's shape`);
            }
        }));

        test('the row geometry does not move between the two standard geometries', () => mounted(async (page) => {
            await openByPress(page);
            const boxes = await itemBoxes(page);
            const control = parseFloat(await page.resolveValue('var(--ui-control-h)', 'width'));
            for (const box of boxes) near(box.height, control, `"${box.label}" is off the control height`);
        }));

        test('a danger row takes --ui-status-danger, and only the ink moves', () => mounted(async (page) => {
            await openByPress(page);
            const plain = await page.computed(`${itemsOf()}:not(.danger)`, ['color', 'background-color']);
            const danger = await page.computed(`#m >>> .item.danger`, ['color', 'background-color']);
            assert.equal(danger.color, await page.resolveToken('--ui-status-danger', 'color'),
                'SOURCE context-menu.css:90 color: var(--slate-danger)');
            assert.notEqual(danger.color, plain.color);
            assert.equal(danger['background-color'], plain['background-color'],
                'a resting danger row is not a filled row — only its ink differs');

            await assertTokenDrill(page, {
                token: '--ui-status-danger',
                selector: '#m >>> .item.danger',
                property: 'color',
            });
        }));

        test('a disabled row is dimmed by the base\'s one dial and refuses the press', () => mounted(async (page) => {
            await openByPress(page);
            const dimmed = await page.computed('#m >>> .item[disabled]', ['opacity', 'cursor']);
            near(parseFloat(dimmed.opacity), parseFloat(await page.tokenValue('--ui-opacity-disabled')),
                'the base paints one disabled dial (base.js:509-511); no component copy', 0.001);
            assert.equal(dimmed.cursor, 'not-allowed');

            await page.eval('window.__sel = []; document.getElementById("m").addEventListener("select", '
                + '(e) => window.__sel.push(e.detail.id)); true');
            await page.click('#m >>> .item[disabled]');
            assert.deepEqual(await page.eval('window.__sel'), [], 'a disabled row must not select');
            assert.equal(await isOpen(page), true, 'a disabled row must not close the menu either');
        }));

        test('a separator draws the seam utility\'s 1px gap, not a bordered element', () => mounted(async (page) => {
            await openByPress(page);
            assert.equal(await page.count('#m >>> .group'), 2, 'the separator splits the rows into two groups');

            const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
            const gap = await page.prop(listOf(), 'row-gap');
            near(parseFloat(gap), seam, 'the divider IS the grid gap (CONVENTIONS §13)');

            assert.equal(await page.prop(listOf(), 'background-color'),
                await page.resolveToken('--ui-line', 'background-color'),
                'the ground showing through the gap is the seam utility\'s .seam-line ink');

            const groups = await page.evalFn((s) => {
                const out = [];
                for (const el of window.__h.qAll(s)) {
                    const r = el.getBoundingClientRect();
                    out.push({ top: r.top, bottom: r.bottom });
                }
                return out;
            }, '#m >>> .group');
            near(groups[1].top - groups[0].bottom, seam, 'the measured gap between groups is one seam');
        }));

        test('a press opens the menu and puts the caret on the first row', () => mounted(async (page) => {
            await openByPress(page);
            const label = await focusedLabel(page);
            assert.equal(label, 'Rename', 'SOURCE context-menu.js:184-185 — the first row takes focus');
        }));

        test('ArrowDown from the trigger opens downward, ArrowUp opens onto the last row', () => mounted(async (page) => {
            await page.evalFn((s) => { window.__h.need(s).control.focus(); return true; }, '#trig');
            await page.press('ArrowDown');
            assert.equal(await isOpen(page), true, 'ArrowDown on a closed trigger opens the menu');
            assert.equal(await focusedLabel(page), 'Rename');

            await page.press('Escape');
            await page.press('ArrowUp');
            assert.equal(await isOpen(page), true, 'ArrowUp on a closed trigger opens the menu');
            assert.equal(await focusedLabel(page), 'Delete',
                'ArrowUp opens onto the LAST enabled row');
        }));

        test('the walk wraps, skips the disabled row, and Home/End reach the ends', () => mounted(async (page) => {
            await openByPress(page);
            const label = () => focusedLabel(page);

            assert.equal(await label(), 'Rename');
            await page.press('ArrowDown');
            assert.equal(await label(), 'Duplicate');
            await page.press('ArrowDown');
            assert.equal(await label(), 'Delete',
                'SOURCE context-menu.js:124-126 — the disabled row is not in the walk');
            await page.press('ArrowDown');
            assert.equal(await label(), 'Rename', 'SOURCE context-menu.js:138 — the walk wraps');
            await page.press('ArrowUp');
            assert.equal(await label(), 'Delete', 'SOURCE context-menu.js:142 — and wraps the other way');
            await page.press('Home');
            assert.equal(await label(), 'Rename');
            await page.press('End');
            assert.equal(await label(), 'Delete');
        }));

        test('the focus ring is the base\'s one ring, in the inset offset, unclipped', () => mounted(async (page) => {
            await openByProperty(page);
            const g = await assertFocusUnclipped(page, itemsOf());
            assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                'a scrolling list needs the inset offset — an outset ring on the first row is '
                + 'clipped by its own scrollport, which is bug L24\'s class');
        }));

        test('the focus fill is --ui-key-on, and it is a token', () => mounted(async (page) => {
            const prepare = async (p) => {
                if (!(await p.exists(surfaceOf()))) await openByProperty(p);
                await p.evalFn((s) => { const t = window.__h.need(s); (t.control || t).focus(); return true; }, '#trig');
                await p.press('ArrowDown');
            };
            await openByProperty(page);
            await prepare(page);
            assert.equal(await page.prop(itemsOf(), 'background-color'),
                await page.resolveToken('--ui-key-on', 'background-color'),
                'SOURCE slate-shell.css:952 background: var(--slate-key-on). The hover half of '
                + 'this rule cannot be tested on this rig — headless Chrome reports (hover:none) — '
                + 'so the rule keeps both states in one selector list');
            await assertTokenDrill(page, {
                token: '--ui-key-on',
                selector: itemsOf(),
                property: 'background-color',
                prepare,
            });
        }));

        test('Escape closes the menu and gives the caret back to the trigger', () => mounted(async (page) => {
            await openByPress(page);
            await page.press('Escape');
            assert.equal(await isOpen(page), false);
            assert.equal(await page.exists(surfaceOf()), false);
            const path = await activePath(page);
            assert.match(path, /ui-button#trig/,
                `focus was not returned to the trigger — it is at ${path}. Spec §4.6: `
                + '"no focus trap, no focus restore ... Escape is not the gap; isolation and focus are"');
        }));

        test('the Escape the menu acted on does not travel any further', () => mounted(async (page) => {
            await page.eval('window.__keys = []; window.addEventListener("keydown", '
                + '(e) => window.__keys.push(e.key)); true');
            await openByPress(page);
            await page.press('Escape');
            assert.deepEqual(await page.eval('window.__keys'), [],
                'an overlay consumes the Escape it acted on. Slate handles it on document in the '
                + 'CAPTURE phase (context-menu.js:152), so a menu inside a dialog closes both');

            // And the discriminator: with the menu closed, Escape is nobody's business.
            await page.press('Escape');
            assert.deepEqual(await page.eval('window.__keys'), ['Escape'],
                'a closed menu must not swallow the key');
        }));

        test('an outside press closes the menu, restores focus, and is swallowed', () => mounted(async (page) => {
            await page.eval('window.__hits = []; document.getElementById("after").addEventListener('
                + '"click", () => window.__hits.push("after")); true');
            await openByPress(page);

            const after = await page.box('#after');
            const surface = await page.box(surfaceOf());
            const cx = after.left + after.width / 2;
            const cy = after.top + after.height / 2;
            const insideSurface = cx >= surface.left && cx <= surface.left + surface.width
                && cy >= surface.top && cy <= surface.top + surface.height;
            assert.equal(insideSurface, false,
                'the press point is inside the open surface, so this would press a ROW, not outside');

            const deepHit = await page.evalFn((x, y) => {
                let node = document.elementFromPoint(x, y);
                while (node?.shadowRoot) {
                    const inner = node.shadowRoot.elementFromPoint(x, y);
                    if (!inner || inner === node) break;
                    node = inner;
                }
                return node ? `${node.tagName.toLowerCase()}#${node.id || ''}.${node.className || ''}` : 'null';
            }, cx, cy);
            assert.match(deepHit, /backdrop/,
                `the thing over #after is ${deepHit}, not the backdrop — this test would prove nothing`);

            await page.click('#after');
            assert.equal(await isOpen(page), false, 'a press outside the menu closes it');
            assert.deepEqual(await page.eval('window.__hits'), [],
                'the dismissing press is swallowed by the backdrop — on a wall panel the control '
                + 'under a menu is often Sleep or a shot control');
            assert.match(await activePath(page), /ui-button#trig/, 'and the caret comes back');
        }));

        test('a press on a row selects it rather than dismissing', () => mounted(async (page) => {
            await page.eval('window.__oc = []; window.__sel = [];'
                + 'const m = document.getElementById("m");'
                + 'm.addEventListener("open-change", (e) => window.__oc.push(e.detail.reason));'
                + 'm.addEventListener("select", (e) => window.__sel.push(e.detail.id)); true');
            await openByPress(page);
            await page.click(`${itemsOf()}`);
            assert.deepEqual(await page.eval('window.__sel'), ['rename']);
            assert.deepEqual(await page.eval('window.__oc'), ['trigger', 'select']);
        }));

        test('Tab closes the menu and the walk continues after the trigger', () => mounted(async (page) => {
            await openByPress(page);
            await page.press('Tab');
            assert.equal(await isOpen(page), false, 'Tab out of a menu closes it');
            assert.match(await activePath(page), /button#after/,
                'the sequential walk must continue from the trigger, not from a row in a shadow root');
        }));

        test('selecting a row closes FIRST, then reports — with the caret already home', () => mounted(async (page) => {
            await page.eval(`(() => {
                window.__sel = [];
                const menu = document.getElementById('m');
                menu.addEventListener('select', (e) => window.__sel.push({
                    id: e.detail.id,
                    index: e.detail.index,
                    openAtDispatch: menu.open,
                    focusAtDispatch: window.__h.anchorPath(window.__h.deepActiveElement()),
                }));
                return true;
            })()`);
            await openByPress(page);
            await page.click('#m >>> .item.danger');

            const seen = await page.eval('window.__sel');
            assert.equal(seen.length, 1, 'exactly one select event');
            assert.equal(seen[0].id, 'delete');
            assert.equal(seen[0].index, 4, 'the index is the position in the ITEMS array, separators included');
            assert.equal(seen[0].openAtDispatch, false,
                'SOURCE context-menu.js:116-117 — close() runs before onSelect, so a handler that '
                + 'opens a dialog moves focus LAST and nothing races it');
            assert.match(seen[0].focusAtDispatch, /ui-button#trig/);
        }));

        test('a select handler that moves focus KEEPS it — no second focus afterwards', () => mounted(async (page) => {
            await page.eval(`(() => {
                const menu = document.getElementById('m');
                menu.addEventListener('select', () => {
                    // What a real handler does: opens something and focuses it.
                    document.getElementById('dialogish').focus();
                    window.__handlerFocus = window.__h.anchorPath(window.__h.deepActiveElement());
                });
                return true;
            })()`);
            await openByPress(page);
            await page.click('#m >>> .item.danger');
            await page.settle(4);

            assert.match(await page.eval('window.__handlerFocus'), /button#dialogish/,
                'the handler must be able to take the caret at all');
            assert.match(await activePath(page), /button#dialogish/,
                'and it must still have it four frames later — the menu must not steal it back');
        }));

        test('hide() restores the caret DURING the call, so the caller writes last', () => mounted(async (page) => {
            await openByPress(page);
            const during = await page.eval(`(() => {
                const menu = document.getElementById('m');
                menu.hide('api');
                const afterHide = window.__h.anchorPath(window.__h.deepActiveElement());
                document.getElementById('dialogish').focus();
                return afterHide;
            })()`);
            assert.match(during, /ui-button#trig/,
                'hide() must have put the caret back before it returned, not a microtask later');

            await page.settle(4);
            assert.match(await activePath(page), /button#dialogish/,
                'a consumer that moves focus after hide() keeps it: one restore, not two');
        }));

        test('open-change reports both directions with a reason', () => mounted(async (page) => {
            await page.eval('window.__oc = []; document.getElementById("m").addEventListener('
                + '"open-change", (e) => window.__oc.push(e.detail)); true');
            await openByPress(page);
            await page.press('Escape');
            assert.deepEqual(await page.eval('window.__oc'), [
                { open: true, reason: 'trigger' },
                { open: false, reason: 'escape' },
            ]);
        }));

        test('a second press on the trigger closes it, and says so', () => mounted(async (page) => {
            await page.eval('window.__oc = []; document.getElementById("m").addEventListener('
                + '"open-change", (e) => window.__oc.push(e.detail)); true');
            await openByPress(page);

            const trig = await page.box('#trig');
            const topmost = await page.evalFn(
                (x, y) => window.__h.anchorPath(document.elementFromPoint(x, y)),
                trig.left + trig.width / 2, trig.top + trig.height / 2,
            );
            assert.match(topmost, /ui-menu/,
                `the backdrop is not over the trigger (${topmost}), so this test would prove nothing`);

            await page.click('#trig');
            assert.equal(await isOpen(page), false, 'a second press on the trigger closes the menu');
            assert.deepEqual(await page.eval('window.__oc'), [
                { open: true, reason: 'trigger' },
                { open: false, reason: 'trigger' },
            ], 'the toggle-close reports the trigger, not an outside dismissal');
            assert.match(await activePath(page), /ui-button#trig/, 'and the caret is on the trigger');
        }));

        test('a press outside still reports an outside dismissal', () => mounted(async (page) => {
            await page.eval('window.__oc = []; document.getElementById("m").addEventListener('
                + '"open-change", (e) => window.__oc.push(e.detail)); true');
            await openByPress(page);

            const trig = await page.box('#trig');
            const surface = await page.box(surfaceOf());
            const x = 8;
            const y = 8;
            const clears = (b) => x < b.left || x > b.left + b.width || y < b.top || y > b.top + b.height;
            assert.ok(clears(trig) && clears(surface),
                'the press point must be outside both the trigger and the surface');

            await page.mouse('mousePressed', x, y, { clickCount: 1 });
            await page.mouse('mouseReleased', x, y, { clickCount: 1 });
            await page.settle(2);

            assert.equal(await isOpen(page), false, 'a press outside closes the menu');
            assert.deepEqual(await page.eval('window.__oc'), [
                { open: true, reason: 'trigger' },
                { open: false, reason: 'outside' },
            ]);
        }));

        test('a declarative open does not steal the caret', () => mounted(async (page) => {
            await page.evalFn((s) => { window.__h.need(s).control.focus(); return true; }, '#trig');
            const before = await activePath(page);
            await openByProperty(page);
            assert.equal(await activePath(page), before, 'the property-driven open moved focus');
        }));
    });
}

test('the gallery entry has the shape entries.js documents', () => {
    assert.equal(galleryEntry.id, 'ui-menu', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, './entries/ui-menu.demo.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('every gallery state mounts, and every open one draws a surface', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-menu--${state.id} threw`);
            assert.ok(await page.count('ui-menu') >= 1, `gallery state ui-menu--${state.id} mounted nothing`);

            const open = await page.evalFn(() => [...document.querySelectorAll('ui-menu')]
                .filter((m) => m.open).length);
            const surfaces = await page.evalFn(() => [...document.querySelectorAll('ui-menu')]
                .filter((m) => m.shadowRoot.querySelector('#surface')).length);
            assert.equal(surfaces, open,
                `gallery state ui-menu--${state.id}: ${open} open menus but ${surfaces} surfaces`);
        }
    });
});

test('the entry\'s module defines every custom tag its states mount', async () => {
    const galleryDir = new URL('../../tools/gallery/', import.meta.url);
    const source = await readFile(new URL(galleryEntry.module, galleryDir), 'utf8');

    const tags = new Set();
    for (const state of galleryEntry.states) {
        for (const [, tag] of state.html.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]*)\b/g)) tags.add(tag);
    }
    assert.ok(tags.has('ui-menu') && tags.has('ui-button'), `states mount ${[...tags].join(', ')}`);

    for (const tag of tags) {
        assert.ok(
            source.includes(`/${tag}.js'`),
            `${galleryEntry.module} must import ${tag}.js — the gallery gives the entry one `
            + 'import and then waits forever on any tag that import did not define',
        );
    }
});

test('every state settles on the real gallery page, inside the battery\'s patience', async () => {
    await browser.withPage({ geometry: BENCH, theme: 'dark' }, async (page) => {
        for (const state of galleryEntry.states) {
            const id = `${galleryEntry.id}--${state.id}`;
            await page.goto(`/tools/gallery/index.html?state=${id}&theme=dark`);

            const deadline = Date.now() + 8000;
            let settled = null;
            while (Date.now() < deadline && !settled) {
                settled = await page.evalFn(() => document.body.dataset.gallerySettled ?? null);
                if (!settled) await sleep(100);
            }
            assert.equal(settled, '1', `${id} never reached gallerySettled — the battery records unsettled`);
            assert.equal(await page.evalFn(() => document.body.dataset.galleryState ?? null), id);
            assert.deepEqual(page.pageErrors, [], `${id} threw`);
        }
    });
});
