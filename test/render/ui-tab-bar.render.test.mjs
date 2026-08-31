/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-tab-bar.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-tab-bar.js'];

const EDITOR = `<ui-tab-bar id="editor" label="Profile editor" value="Settings"
    tabs='["Steps","Settings","Review"]'></ui-tab-bar>`;

const CHARTS = `<ui-tab-bar id="charts" label="Chart" value="flow"
      tabs='[{"value":"flow","label":"Pressure / Flow"},
             {"value":"power","label":"Resistance / Impedance"},
             {"value":"data","label":"Shot data"}]'>
      <div class="panel" data-tab="flow"><button id="in-flow">flow control</button></div>
      <div class="panel" data-tab="power"><button id="in-power">power control</button></div>
      <div class="panel" data-tab="data"><button id="in-data">data control</button></div>
    </ui-tab-bar>`;

const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 900px; }
    </style>
    <div id="stage">${EDITOR}${CHARTS}</div>`;

/** The bank a tab bar renders, and the tab buttons inside it — two boundaries deep. */
const bank = (bar) => `#${bar} >>> #tablist`;
const tab = (bar, i) => `#${bar} >>> #tablist >>> #item-${i}`;

const DQ_2_A_SHIFT = { bench: 13.359375, floor: 13.359375 };

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** The dial's own shadow segment is always the LAST one (assertions.js, shadowSegments). */
const lastSegment = (value) => shadowSegments(value).at(-1) ?? '';

const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

/** The shape of one panel, read from the page — the tabpanel contract in five values. */
const PANEL_PROBE = (barId) => `(${((id) => {
    const bar = document.getElementById(id);
    const out = [];
    for (const el of bar.querySelectorAll('[data-tab]')) {
        out.push({
            tab: el.dataset.tab,
            role: el.getAttribute('role'),
            tabindex: el.getAttribute('tabindex'),
            label: el.getAttribute('aria-label'),
            hidden: el.hasAttribute('hidden'),
            inert: el.hasAttribute('inert'),
            display: getComputedStyle(el).display,
        });
    }
    return out;
}).toString()})(${JSON.stringify(barId)})`;

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-tab-bar @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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

        test('a tab bar renders exactly one ui-bank, in the tablist spelling, and nothing else that is a control',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('editor').shadowRoot;
                    const banks = [...root.querySelectorAll('ui-bank')];
                    return {
                        banks: banks.length,
                        mode: banks[0]?.getAttribute('mode'),
                        role: banks[0]?.getAttribute('role'),
                        /* Anything else that could take a click or a key. A second
                         * control here would be a second implementation of the widget. */
                        strays: [...root.querySelectorAll('button, input, a[href], [role="tab"]')].length,
                    };
                });
                assert.equal(shape.banks, 1, 'one bank, not a hand-built copy of one (bugs L8, E10)');
                assert.equal(shape.mode, 'tablist');
                assert.equal(shape.role, 'tablist',
                    'the element carrying role=tablist is the bank, so the accessible group and the painted box are one element');
                assert.equal(shape.strays, 0, 'no control of this component\'s own — the tabs are the bank\'s buttons');
            }));

        test('every tab is a role=tab button and exactly one carries aria-selected=true (Appendix 15)',
            () => mounted(async (page) => {
                const aria = await page.evalFn(() => {
                    const b = document.getElementById('charts').shadowRoot.querySelector('#tablist');
                    return [...b.shadowRoot.querySelectorAll('.item')].map((el) => ({
                        role: el.getAttribute('role'),
                        selected: el.getAttribute('aria-selected'),
                        checked: el.getAttribute('aria-checked'),
                        pressed: el.getAttribute('aria-pressed'),
                    }));
                });
                assert.equal(aria.length, 3);
                assert.deepEqual(aria.map((a) => a.role), ['tab', 'tab', 'tab']);
                assert.deepEqual(aria.map((a) => a.selected), ['true', 'false', 'false']);
                for (const a of aria) {
                    assert.equal(a.checked, null, 'a tablist speaks ONE aria spelling, not three');
                    assert.equal(a.pressed, null);
                }
            }));

        test('the tablist takes its name, and the role-less host gives its own up (bug L23 symptom 1)',
            () => mounted(async (page) => {
                await page.mount(
                    `<ui-tab-bar id="named" aria-label="Shot chart" value="a" tabs='["a","b"]'></ui-tab-bar>`,
                    MODULE,
                );
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const bar = document.getElementById('named');
                    return {
                        host: bar.getAttribute('aria-label'),
                        hostRole: bar.getAttribute('role'),
                        bank: bar.shadowRoot.querySelector('#tablist').getAttribute('aria-label'),
                        name: bar.accessibleName,
                    };
                });
                assert.equal(got.bank, 'Shot chart', 'the name lands on the element that carries role=tablist');
                assert.equal(got.host, null, 'and does not stay on the role-less host as a second announcement');
                assert.equal(got.hostRole, null, 'the host takes no role of its own');
                assert.equal(got.name, 'Shot chart', 'and the component can still say what its name is');
            }));

        test('`label` beats the host attribute, and the tablist is never left anonymous mid-swap',
            () => mounted(async (page) => {
                const got = await page.evalFn(() =>
                    document.getElementById('editor').shadowRoot.querySelector('#tablist').getAttribute('aria-label'));
                assert.equal(got, 'Profile editor');
            }));

        test('the tablist is --ui-control-lg tall — the token whose provenance IS this element',
            () => mounted(async (page) => {
                const want = parseFloat(await page.resolveValue('var(--ui-control-lg)', 'height'));
                const box = await page.box(bank('editor'));
                near(box.height, want, 'the tablist takes the token, not the literal 82');
                assert.equal(want, 82, 'and the token still ships at the oracle\'s value');
            }));

        test('the tabs inside it are the oracle\'s 80px, one border pair in', () => mounted(async (page) => {
            const outer = await page.box(bank('editor'));
            const cell = await page.box(tab('editor', 0));
            const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));
            near(cell.height, outer.height - 2 * border, 'the tab is the bank\'s box less its hairline');
            near(cell.height, 80, 'which is the oracle\'s 80');
        }));

        test('WIDTH IS INTRINSIC: the tablist takes its own width, not the container\'s (§4.3, bug H3)',
            () => mounted(async (page) => {
                const stage = await page.box('#stage');
                const list = await page.box(bank('editor'));
                near(stage.width, 900, 'the stage is the stated container');
                assert.ok(list.width < stage.width - 100,
                    `the tablist is its own width (${list.width}) inside a ${stage.width} container, ` +
                    'not stretched to it — otherwise a header\'s auto centre track means nothing');
                assert.ok(list.width > 100, 'and it is not collapsed either');
            }));

        test('the three tabs are equal cells, so the width is the widest label × 3', () => mounted(async (page) => {
            const cells = await Promise.all([0, 1, 2].map((i) => page.box(tab('editor', i))));
            near(cells[0].width, cells[1].width, 'equal cells');
            near(cells[1].width, cells[2].width, 'equal cells');
        }));

        test('EVERY LABEL FITS ITS CELL: n x the WIDEST label, never n x the mean', () => mounted(async (page) => {
            const read = await page.evalFn(() => {
                const out = {};
                for (const id of ['editor', 'charts']) {
                    const list = document.getElementById(id).renderRoot.getElementById('tablist');
                    const items = [...list.shadowRoot.querySelectorAll('.item')];
                    const rows = items.map((button) => {
                        const label = button.querySelector('.label') ?? button;
                        const range = document.createRange();
                        range.selectNodeContents(label);
                        const style = getComputedStyle(button);
                        return {
                            text: (label.textContent ?? '').trim(),
                            needs: range.getBoundingClientRect().width,
                            box: label.getBoundingClientRect().width,
                            cell: button.getBoundingClientRect().width,
                            chrome: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
                        };
                    });
                    out[id] = { bank: list.getBoundingClientRect().width, rows };
                }
                return out;
            });
            const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));

            for (const [id, { bank: width, rows }] of Object.entries(read)) {
                for (const row of rows) {
                    assert.ok(row.needs <= row.box + 0.01,
                        `${id}: "${row.text}" needs ${row.needs}px and was given ${row.box}px — `
                        + 'a label ellipsised at full width, with no space pressure on the bank');
                }
                const widest = Math.max(...rows.map((r) => r.needs));
                const chrome = rows[0].chrome;
                near(width, rows.length * (widest + chrome) + 2 * border,
                    `${id}: the bank is n x (widest label + chrome)`);
                for (const row of rows) near(row.cell, rows[0].cell, `${id}: equal cells`);
            }
        }));

        test('stretch fills the container — Slate\'s 720 bank without writing 720', () => mounted(async (page) => {
            const before = await page.box(bank('charts'));
            await page.evalFn(() => { document.getElementById('charts').stretch = true; return true; });
            await page.settle(2);
            const after = await page.box(bank('charts'));
            const stage = await page.box('#stage');
            assert.ok(after.width > before.width, 'stretch widened it');
            near(after.width, stage.width, 'to the container, whatever the container is');
        }));

        test('APPENDIX 7: in a three-column header the AUTO centre track is the tablist\'s own width',
            () => mounted(async (page) => {
                await page.mount(`
                    <style>
                      #hdr { display: grid; align-items: center; inline-size: 1100px;
                             grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
                      .flank { min-inline-size: 0; overflow: hidden; white-space: nowrap; }
                    </style>
                    <div id="hdr">
                      <span class="flank">Londinium — a long profile name that must ellipsise</span>
                      <ui-tab-bar id="centre" label="Profile editor" value="Steps"
                        tabs='["Steps","Settings","Review"]'></ui-tab-bar>
                      <span class="flank">Save</span>
                    </div>`, MODULE);
                await page.settle(3);

                const host = await page.box('#centre');
                const list = await page.box(bank('centre'));
                const tracks = (await page.prop('#hdr', 'grid-template-columns'))
                    .split(' ').map(parseFloat);

                assert.equal(tracks.length, 3);
                near(tracks[1], list.width, 'the centre track IS the tablist, not a 2px collapse');
                assert.ok(tracks[1] > 150,
                    `the centre track collapsed to ${tracks[1]}px — the host's container-type: normal ` +
                    'opt-out has gone, and with it the tablist\'s intrinsic width');
                near(host.width, list.width, 'and the tab bar host is exactly its tablist, adding no box');
                near(tracks[0], tracks[2], 'the two flanks share what is left, equally');
                assert.ok(tracks[0] > 300, 'and they are the ones that absorbed the header, as Appendix 7 asks');
            }));

        test('a narrow container shrinks the bank and clips nothing (spec §2.4)', () => mounted(async (page) => {
            await page.setStyle('#stage', { 'inline-size': '280px' });
            const m = await page.metrics(bank('charts'));
            near(m.rect.width, 280, 'fit-content has nothing left to give, so the bank is the container');
            assert.ok(m.scrollWidth <= m.clientWidth + 0.5,
                `nothing is silently removed: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`);

            const host = await page.metrics('#charts');
            assert.ok(host.scrollWidth <= host.clientWidth + 0.5,
                'and the tab bar does not overflow its own host — the half of H3 a component can own');
        }));

        test('--ui-control-lg drills: the height follows the token, on this instance', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-control-lg', value: '111px',
                selector: bank('editor'), property: 'block-size',
            });
        }));

        test('the selected tab is painted by the four dials and nothing else', () => mounted(async (page) => {
            await assertOneSelectionTreatment(page, {
                selected: tab('charts', 0),
                unselected: tab('charts', 1),
            });
        }));

        test('the selected face is --ui-steel and the ink --ui-on-steel, as Slate ships them',
            () => mounted(async (page) => {
                const got = await page.computed(tab('charts', 0), ['background-color', 'color']);
                assert.equal(got['background-color'], await page.resolveToken('--ui-steel', 'background-color'));
                assert.equal(got.color, await page.resolveToken('--ui-on-steel', 'color'));
            }));

        test('DQ-2-A: the bar\'s own width MOVES with which tab is selected, and by how much',
            () => mounted(async (page) => {
                const widthOf = async () => (await page.box(bank('charts'))).width;
                const withFlow = await widthOf();
                await page.evalFn(() => { document.getElementById('charts').value = 'power'; return true; });
                await page.settle(2);
                const withPower = await widthOf();
                await page.evalFn(() => { document.getElementById('charts').value = 'flow'; return true; });
                await page.settle(2);
                const backToFlow = await widthOf();

                assert.ok(withPower > withFlow,
                    'the widest-when-bold tab is Resistance / Impedance, so selecting it must '
                    + `widen the bar (${withFlow} -> ${withPower})`);
                near(withPower - withFlow, DQ_2_A_SHIFT[geometry.name], 'DQ-2-A shift', 0.6);
                near(backToFlow, withFlow, 'the bar returns to its resting width', 0.02);
            }));

        test('WITH ALL FIVE DIALS NEUTRAL, a selected tab and a resting one are indistinguishable',
            () => mounted(async (page) => {
                await page.evalFn(() => { document.getElementById('charts').value = 'power'; return true; });
                await page.settle(2);
                await page.setToken('--ui-selected-face', 'transparent');
                await page.setToken('--ui-selected-ink', 'currentColor');
                await page.setToken('--ui-selected-led', '0px');
                await page.setToken('--ui-selected-glow', '0%');
                await page.setToken('--ui-selected-weight', 'var(--ui-weight-regular)');
                try {
                    const compared = [...NON_DIAL_PROPERTIES, 'font-weight'];
                    const selected = await page.computed(tab('charts', 1), compared);
                    const resting = await page.computed(tab('charts', 2), compared);
                    const differing = Object.keys(selected).filter((k) => selected[k] !== resting[k]);
                    assert.deepEqual(differing.filter((k) => k !== 'border-top-color'), [],
                        'a selected tab differs from a resting one with every one of the five dials '
                        + 'turned off — that is a private selected look, the founding defect '
                        + '(bugs L8/E10). Differing: '
                        + JSON.stringify(Object.fromEntries(
                            differing.map((k) => [k, [selected[k], resting[k]]]))));

                    const shadows = await page.computed(tab('charts', 1), ['box-shadow', 'text-shadow']);
                    assert.match(lastSegment(shadows['box-shadow']), /(^|\s)0px 0px 0px 0px(\s|$)/,
                        `the LED dial at 0px must leave a zero-extent segment: ${shadows['box-shadow']}`);
                } finally {
                    for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                        '--ui-selected-led', '--ui-selected-glow', '--ui-selected-weight']) {
                        await page.setToken(dial, null);
                    }
                }
            }));

        test('L8: one turn of --ui-selected-face moves the tab bar and a bare bank together',
            () => mounted(async (page) => {
                const drilled = await page.resolveValue(DRILL_COLOUR, 'background-color');
                await page.setToken('--ui-selected-face', DRILL_COLOUR);
                await page.settle(2);
                const barTab = await page.prop(tab('charts', 0), 'background-color');
                const editorTab = await page.prop(tab('editor', 1), 'background-color');
                await page.setToken('--ui-selected-face', null);
                assert.equal(barTab, drilled, 'the chart tab bar followed the dial');
                assert.equal(editorTab, drilled, 'and so did the editor\'s, with no per-instance rule');
            }));

        test('E10: a document sheet aimed at both Slate implementations reaches nothing',
            () => mounted(async (page) => {
                const before = await page.computed(tab('charts', 0),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = `
                        .item, .tabs, .panels, .pe-seg, .slate-bank-item, .slate-editor-tabs,
                        .is-active, .is-selected, [aria-selected="true"], [role="tab"],
                        ui-tab-bar *, ui-tab-bar > *, ui-bank * {
                            background-color: rgb(1, 2, 3) !important;
                            color: rgb(4, 5, 6) !important;
                            font-weight: 900 !important;
                            box-shadow: none !important;
                        }`;
                    document.head.append(s);
                    return true;
                });
                await page.settle(2);
                const after = await page.computed(tab('charts', 0),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                assert.deepEqual(after, before,
                    'load order stops being a mechanism once there is one implementation behind a boundary');
            }));

        test('the component paints with no !important anywhere in its own sheet', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('editor').shadowRoot.adoptedStyleSheets || [];
                const hits = [];
                const walk = (rules) => {
                    for (const rule of rules) {
                        if (rule.cssRules) { walk(rule.cssRules); continue; }
                        const s = rule.style;
                        if (!s) continue;
                        for (let i = 0; i < s.length; i++) {
                            if (s.getPropertyPriority(s[i]) === 'important') hits.push(`${rule.selectorText} { ${s[i]} }`);
                        }
                    }
                };
                for (const sheet of sheets) walk(sheet.cssRules);
                return hits;
            });
            assert.deepEqual(bad, [], 'zero !important, base rules included (spec §2.1 Rule 3)');
        }));

        test('this component\'s own sheet declares no colour and no selection state at all',
            () => mounted(async (page) => {
                const found = await page.evalFn(() => {
                    const sheets = document.getElementById('editor').shadowRoot.adoptedStyleSheets || [];
                    /* The LAST sheet is this component's own; the base rules are first
                     * (base.js finalizeStyles) and they are the library's, not this row's. */
                    const own = sheets[sheets.length - 1];
                    const colourish = /(^|-)(color|background|box-shadow|text-shadow|fill|stroke|opacity)$/;
                    const out = { colour: [], selection: [] };
                    for (const rule of own.cssRules) {
                        if (!rule.style) continue;
                        if (/aria-selected|aria-checked|aria-pressed|aria-current|\.item|\bselected\b/.test(rule.selectorText || '')) {
                            out.selection.push(rule.selectorText);
                        }
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (!colourish.test(prop)) continue;
                            if (prop === 'opacity' && rule.style.getPropertyValue(prop).trim() === '1') continue;
                            out.colour.push(`${rule.selectorText} { ${prop}: ${rule.style.getPropertyValue(prop)} }`);
                        }
                    }
                    return out;
                });
                assert.deepEqual(found.colour, [],
                    'a tab bar that declares a colour has begun a fourth selection idiom');
                assert.deepEqual(found.selection, [],
                    'and one that can select an item has begun to disagree with #3 about which item that is');
            }));

        test('the ONE part is forwarded for type, not for the selection treatment',
            () => mounted(async (page) => {
                const seam = await page.evalFn(() => {
                    const bar = document.getElementById('editor');
                    const list = bar.shadowRoot.querySelector('#tablist');
                    const deep = [...list.shadowRoot.querySelectorAll('*')];
                    return {
                        forwarded: list.getAttribute('exportparts'),
                        inner: [...new Set(deep.filter((el) => el.hasAttribute('part'))
                            .map((el) => el.getAttribute('part')))],
                        ownParts: [...bar.shadowRoot.querySelectorAll('*')]
                            .filter((el) => el.hasAttribute('part')).map((el) => el.getAttribute('part')),
                    };
                });
                assert.equal(seam.forwarded, 'item', 'the bank\'s one part is passed through by name');
                assert.deepEqual(seam.inner, ['item'], 'and there is exactly one to pass');
                assert.deepEqual(seam.ownParts, [],
                    'this component adds no part of its own — it forwards the bank\'s and stops');
            }));

        test('the focus ring is unclipped on the first and last tabs, where a clip shows first',
            () => mounted(async (page) => {
                const g = await assertFocusUnclipped(page, tab('charts', 0));
                assert.equal(g.outlineOffset,
                    await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                    'a bank clips for its radius, so the ring goes inside — and the tab bar inherits that answer');
                await assertFocusUnclipped(page, tab('charts', 2));
            }));

        test('a tab clears --ui-hit-min on the block axis with its own ink', () => mounted(async (page) => {
            await assertHitFloor(page, tab('editor', 0), { mode: 'box', axes: ['block'] });
        }));

        test('every slotted panel becomes a named role=tabpanel, and all but one are hidden AND inert',
            () => mounted(async (page) => {
                const panels = await page.eval(PANEL_PROBE('charts'));
                assert.equal(panels.length, 3);
                assert.deepEqual(panels.map((p) => p.role), ['tabpanel', 'tabpanel', 'tabpanel'],
                    'L23: "tabs with no tabpanels" — this is the half of it a component can close');
                assert.deepEqual(panels.map((p) => p.tabindex), ['0', '0', '0'],
                    'a panel is a scroll region, and a scroll region reachable only by mouse is the bug this rewrite keeps finding');
                assert.deepEqual(panels.map((p) => p.label),
                    ['Pressure / Flow', 'Resistance / Impedance', 'Shot data'],
                    'named, not pointed at: an IDREF cannot cross a shadow boundary');
                assert.deepEqual(panels.map((p) => p.hidden), [false, true, true]);
                assert.deepEqual(panels.map((p) => p.inert), [false, true, true]);
                assert.deepEqual(panels.map((p) => p.display), ['block', 'none', 'none']);
            }));

        test('a tab points at its panel BY REFERENCE, across the shadow boundary an IDREF cannot cross',
            () => mounted(async (page) => {
                const got = await page.evalFn(() => {
                    const b = document.getElementById('charts').shadowRoot.querySelector('#tablist');
                    const items = [...b.shadowRoot.querySelectorAll('.item')];
                    return {
                        supported: 'ariaControlsElements' in Element.prototype,
                        /* The identity of the element pointed at, read back out of the
                         * platform rather than out of our own bookkeeping. */
                        points: items.map((el) => (el.ariaControlsElements ?? []).map((p) => p.dataset.tab)),
                        /* IDENTITY, not a label that happens to match: the referenced
                         * node must BE the screen's own panel element. */
                        identical: items.map((el, i) => (el.ariaControlsElements ?? [])[0]
                            === document.getElementById('charts').querySelectorAll('[data-tab]')[i]),
                        attribute: items.map((el) => el.getAttribute('aria-controls')),
                    };
                });
                assert.equal(got.supported, true,
                    'the rig has ARIA element reflection; a browser without it makes no association and writes nothing');
                assert.deepEqual(got.points, [['flow'], ['power'], ['data']],
                    'L23: "tabs with no tabpanels and no aria-controls" — this is the second half of it');
                assert.deepEqual(got.identical, [true, true, true],
                    'the reference is the screen\'s panel element itself, read back out of the platform');
                assert.deepEqual(got.attribute, ['', '', ''],
                    'an empty marker, never an id: an IDREF written here would name an element Chrome cannot see');
            }));

        test('the reference is dropped when the tab bar leaves the document',
            () => mounted(async (page) => {
                const after = await page.evalFn(() => {
                    const host = document.getElementById('charts');
                    const b = host.shadowRoot.querySelector('#tablist');
                    const items = [...b.shadowRoot.querySelectorAll('.item')];
                    host.remove();
                    return items.map((el) => (el.ariaControlsElements ?? []).length);
                });
                assert.deepEqual(after, [0, 0, 0],
                    'a detached tab bar holding a live pointer at a screen\'s panel is the same litter as an inert mark left behind');
            }));

        test('P13\'s MECHANISM: a hidden panel stays out of the tab order even when a sheet defeats [hidden]',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = '[data-tab] { display: block !important; }';
                    document.head.append(s);
                    return true;
                });
                await page.settle(2);

                const after = await page.eval(PANEL_PROBE('charts'));
                assert.deepEqual(after.map((p) => p.display), ['block', 'block', 'block'],
                    'the sheet DID defeat [hidden] — that is the precondition, not the failure');

                const reached = await page.evalFn(() => {
                    const out = {};
                    for (const id of ['in-flow', 'in-power', 'in-data']) {
                        const el = document.getElementById(id);
                        el.focus();
                        out[id] = document.activeElement === el;
                    }
                    return out;
                });
                assert.deepEqual(reached, { 'in-flow': true, 'in-power': false, 'in-data': false },
                    'the showing panel is reachable and the hidden ones are not, with [hidden] beaten');
            }));

        test('a panel keyed to no tab is left completely alone — a findable typo, not a silent hide',
            () => mounted(async (page) => {
                await page.mount(`
                    <ui-tab-bar id="typo" label="Chart" value="flow" tabs='["flow","power"]'>
                      <div id="ok" data-tab="flow">yes</div>
                      <div id="oops" data-tab="Flow">typo</div>
                    </ui-tab-bar>`, MODULE);
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const el = document.getElementById('oops');
                    return {
                        role: el.getAttribute('role'),
                        hidden: el.hasAttribute('hidden'),
                        inert: el.hasAttribute('inert'),
                        display: getComputedStyle(el).display,
                    };
                });
                assert.deepEqual(got, { role: null, hidden: false, inert: false, display: 'block' },
                    'a panel this component quietly hid because it did not recognise it would be an unfindable bug');
            }));

        test('a screen\'s own panel name survives — this component only ever ADDS one',
            () => mounted(async (page) => {
                await page.mount(`
                    <ui-tab-bar id="named-panels" label="Chart" value="a" tabs='["a","b"]'>
                      <div id="p-a" data-tab="a" aria-label="Pressure over the whole shot">A</div>
                      <div id="p-b" data-tab="b">B</div>
                    </ui-tab-bar>`, MODULE);
                await page.settle(3);
                const got = await page.evalFn(() => ({
                    a: document.getElementById('p-a').getAttribute('aria-label'),
                    b: document.getElementById('p-b').getAttribute('aria-label'),
                }));
                assert.equal(got.a, 'Pressure over the whole shot', 'the screen said something more specific');
                assert.equal(got.b, 'b', 'and the one that said nothing gets the tab\'s label');
            }));

        test('and so does one the screen writes AFTER adoption — neither overruled nor deleted (cmodality-8)',
            () => mounted(async (page) => {
                await page.mount(`
                    <ui-tab-bar id="late" label="Chart" value="a" tabs='["a","b"]'>
                      <div id="l-a" data-tab="a">A</div>
                      <div id="l-b" data-tab="b">B</div>
                    </ui-tab-bar>`, MODULE);
                await page.settle(3);
                assert.equal(
                    await page.evalFn(() => document.getElementById('l-b').getAttribute('aria-label')),
                    'b', 'the tab\'s own label still lands first, exactly as before');

                await page.evalFn(() => {
                    document.getElementById('l-b')
                        .setAttribute('aria-label', 'Resistance over the whole shot');
                    /* Any state change re-runs the sync; a selection is the honest one. */
                    document.getElementById('late').value = 'b';
                    return true;
                });
                await page.settle(3);
                assert.equal(
                    await page.evalFn(() => document.getElementById('l-b').getAttribute('aria-label')),
                    'Resistance over the whole shot',
                    'the sync after a late write must not overrule the screen');

                const afterRemoval = await page.evalFn(() => {
                    const bar = document.getElementById('late');
                    const panel = document.getElementById('l-b');
                    bar.remove();
                    return panel.getAttribute('aria-label');
                });
                assert.equal(afterRemoval, 'Resistance over the whole shot',
                    'and the release must not delete a name this component never wrote');
            }));

        test('the discriminator is the last value WE wrote, so it is not a special case for the name',
            () => mounted(async (page) => {
                await page.mount(`
                    <ui-tab-bar id="late2" label="Chart" value="a" tabs='["a","b"]'>
                      <div id="g-a" data-tab="a">A</div>
                      <div id="g-b" data-tab="b">B</div>
                    </ui-tab-bar>`, MODULE);
                await page.settle(3);
                const after = await page.evalFn(() => {
                    const bar = document.getElementById('late2');
                    const panel = document.getElementById('g-b');
                    panel.setAttribute('tabindex', '-1');
                    bar.remove();
                    return {
                        tabindex: panel.getAttribute('tabindex'),
                        role: panel.getAttribute('role'),
                        inert: panel.hasAttribute('inert'),
                    };
                });
                assert.equal(after.tabindex, '-1', 'the screen\'s later value is the one restored');
                assert.equal(after.role, null,
                    'while an attribute the screen never wrote is still removed — ownership is not surrendered');
                assert.equal(after.inert, false, 'and no panel is left inert behind a component that has gone');
            }));

        test('the panels PROPERTY reaches panels that are nowhere near the tab bar — the editor\'s shape',
            () => mounted(async (page) => {
                await page.mount(`
                    <div id="hdr"><ui-tab-bar id="split" label="Profile editor" value="steps"
                        tabs='[{"value":"steps","label":"Steps"},{"value":"review","label":"Review"}]'>
                      <div id="decoy" data-tab="steps">a slotted panel that must be ignored</div>
                    </ui-tab-bar></div>
                    <div id="body">
                      <div id="far-steps">steps</div>
                      <div id="far-review">review</div>
                    </div>`, MODULE);
                await page.evalFn(() => {
                    document.getElementById('split').panels = new Map([
                        ['steps', document.getElementById('far-steps')],
                        ['review', document.getElementById('far-review')],
                    ]);
                    return true;
                });
                await page.settle(3);
                const got = await page.evalFn(() => ({
                    farSteps: document.getElementById('far-steps').getAttribute('role'),
                    farStepsHidden: document.getElementById('far-steps').hasAttribute('hidden'),
                    farReviewHidden: document.getElementById('far-review').hasAttribute('hidden'),
                    decoyRole: document.getElementById('decoy').getAttribute('role'),
                }));
                assert.equal(got.farSteps, 'tabpanel', 'a panel in another part of the screen is still adopted');
                assert.equal(got.farStepsHidden, false);
                assert.equal(got.farReviewHidden, true);
                assert.equal(got.decoyRole, null,
                    'explicit wins outright: two sources of truth for one pairing is the divergence this row ends');
            }));

        test('a removed tab bar puts every panel back exactly as it found it', () => mounted(async (page) => {
            /* A component that decorates someone else's element and cannot undo it is how a
             * screen ends up with a permanently inert region and no way to find out why. */
            const restored = await page.evalFn(() => {
                const bar = document.getElementById('charts');
                const panels = [...bar.querySelectorAll('[data-tab]')];
                bar.remove();
                return panels.map((el) => ({
                    role: el.getAttribute('role'),
                    tabindex: el.getAttribute('tabindex'),
                    label: el.getAttribute('aria-label'),
                    hidden: el.hasAttribute('hidden'),
                    inert: el.hasAttribute('inert'),
                }));
            });
            for (const p of restored) {
                assert.deepEqual(p, { role: null, tabindex: null, label: null, hidden: false, inert: false },
                    'nothing this component wrote onto a panel it does not own survives its removal');
            }
        }));

        test('and a re-parented tab bar claims them again, rather than showing all three at once',
            () => mounted(async (page) => {
                const after = await page.evalFn(() => {
                    const bar = document.getElementById('charts');
                    const holder = document.createElement('section');
                    document.body.append(holder);
                    holder.append(bar);
                    return [...bar.querySelectorAll('[data-tab]')].map((el) => el.hasAttribute('hidden'));
                });
                assert.deepEqual(after, [false, true, true],
                    'connectedCallback re-syncs: Lit does not request an update on reconnect');
            }));

        test('exactly one tab is the tab stop, and it is the selected one (the roving contract)',
            () => mounted(async (page) => {
                const stops = await page.evalFn(() => {
                    const b = document.getElementById('charts').shadowRoot.querySelector('#tablist');
                    return [...b.shadowRoot.querySelectorAll('.item')].map((el) => el.getAttribute('tabindex'));
                });
                assert.deepEqual(stops, ['0', '-1', '-1'],
                    'Appendix 10, "exactly as implemented" — and implemented once, in #3');
            }));

        test('ArrowRight moves the selection, the focus, the tab stop AND the panels together',
            () => mounted(async (page) => {
                await page.focusVisible(tab('charts', 0));
                await page.press('ArrowRight');
                await page.settle(3);

                const state = await page.evalFn(() => {
                    const bar = document.getElementById('charts');
                    const b = bar.shadowRoot.querySelector('#tablist');
                    return {
                        value: bar.value,
                        attr: bar.getAttribute('value'),
                        focused: b.shadowRoot.activeElement?.id,
                        stops: [...b.shadowRoot.querySelectorAll('.item')].map((el) => el.getAttribute('tabindex')),
                        selected: [...b.shadowRoot.querySelectorAll('.item')].map((el) => el.getAttribute('aria-selected')),
                        hidden: [...bar.querySelectorAll('[data-tab]')].map((el) => el.hasAttribute('hidden')),
                        inert: [...bar.querySelectorAll('[data-tab]')].map((el) => el.hasAttribute('inert')),
                    };
                });
                assert.equal(state.value, 'power', 'selection follows focus, as the editor does');
                assert.equal(state.attr, 'power', 'and `value` reflects, so a screen can read it off the DOM');
                assert.equal(state.focused, 'item-1', 'focus moved with it');
                assert.deepEqual(state.stops, ['-1', '0', '-1'], 'and so did the single tab stop');
                assert.deepEqual(state.selected, ['false', 'true', 'false']);
                assert.deepEqual(state.hidden, [true, false, true], 'the PANEL followed the arrow key');
                assert.deepEqual(state.inert, [true, false, true]);

                assert.equal(await page.prop(tab('charts', 1), 'background-color'),
                    await page.resolveToken('--ui-selected-face', 'background-color'),
                    'and the paint followed too, from the dial');
            }));

        test('ArrowLeft wraps modulo, exactly as does', () => mounted(async (page) => {
            await page.focusVisible(tab('charts', 0));
            await page.press('ArrowLeft');
            await page.settle(3);
            const state = await page.evalFn(() => {
                const bar = document.getElementById('charts');
                return {
                    value: bar.value,
                    focused: bar.shadowRoot.querySelector('#tablist').shadowRoot.activeElement?.id,
                    shown: [...bar.querySelectorAll('[data-tab]')].filter((el) => !el.hasAttribute('hidden')).map((el) => el.dataset.tab),
                };
            });
            assert.equal(state.value, 'data');
            assert.equal(state.focused, 'item-2');
            assert.deepEqual(state.shown, ['data'], 'exactly one panel is showing after the wrap');
        }));

        test('Home and End go to the ends, and the panel goes with them', () => mounted(async (page) => {
            await page.focusVisible(tab('charts', 1));
            await page.press('End');
            await page.settle(3);
            assert.equal(await page.evalFn(() => document.getElementById('charts').value), 'data');
            assert.deepEqual(
                await page.evalFn(() => [...document.getElementById('charts').querySelectorAll('[data-tab]')]
                    .map((el) => el.hasAttribute('hidden'))),
                [true, true, false]);

            await page.press('Home');
            await page.settle(3);
            assert.equal(await page.evalFn(() => document.getElementById('charts').value), 'flow');
            assert.deepEqual(
                await page.evalFn(() => [...document.getElementById('charts').querySelectorAll('[data-tab]')]
                    .map((el) => el.hasAttribute('hidden'))),
                [false, true, true]);
        }));

        test('the arrows walk the whole ring and come home — four presses, three tabs',
            () => mounted(async (page) => {
                await page.focusVisible(tab('charts', 0));
                const walk = [];
                for (let i = 0; i < 4; i++) {
                    await page.press('ArrowRight');
                    await page.settle(2);
                    walk.push(await page.evalFn(() => document.getElementById('charts').value));
                }
                assert.deepEqual(walk, ['power', 'data', 'flow', 'power'],
                    'wrapping modulo, with no key handler in this component to get it wrong');
            }));

        test('a disabled tab is stepped over on the arrow path, and the panel never appears',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const bar = document.getElementById('charts');
                    bar.tabs = [
                        { value: 'flow', label: 'Pressure / Flow' },
                        { value: 'power', label: 'Resistance / Impedance', disabled: true },
                        { value: 'data', label: 'Shot data' },
                    ];
                    bar.value = 'flow';
                    return true;
                });
                await page.settle(3);
                await page.focusVisible(tab('charts', 0));
                await page.press('ArrowRight');
                await page.settle(3);
                const got = await page.evalFn(() => ({
                    value: document.getElementById('charts').value,
                    shown: [...document.getElementById('charts').querySelectorAll('[data-tab]')]
                        .filter((el) => !el.hasAttribute('hidden')).map((el) => el.dataset.tab),
                }));
                assert.equal(got.value, 'data', 'the disabled tab is stepped over, not landed on');
                assert.deepEqual(got.shown, ['data'], 'and its panel is never the showing one');
            }));

        test('a real click swaps the tab and the panel, and fires change EXACTLY once at the host',
            () => mounted(async (page) => {
                await page.recordEvents('#charts', ['change']);
                await page.click(tab('charts', 2));
                await page.settle(3);

                const events = await page.recordedEvents();
                assert.equal(events.length, 1,
                    'the bank\'s change is composed and already on its way out; re-dispatching would deliver it twice');
                assert.equal(events[0].detail.value, 'data');
                assert.equal(events[0].detail.index, 2, 'detail passes through unchanged');
                assert.equal(events[0].value, 'data',
                    'and the retargeted event.target — the ui-tab-bar — already carries the new value');

                assert.deepEqual(
                    await page.evalFn(() => [...document.getElementById('charts').querySelectorAll('[data-tab]')]
                        .map((el) => el.hasAttribute('hidden'))),
                    [true, true, false],
                    'a consumer reading the DOM inside its own change handler must not see the previous panel');
            }));

        test('a programmatic write swaps the panel and fires nothing — the native contract',
            () => mounted(async (page) => {
                await page.recordEvents('#charts', ['change']);
                await page.evalFn(() => { document.getElementById('charts').value = 'power'; return true; });
                await page.settle(3);
                assert.deepEqual(await page.recordedEvents(), []);
                assert.deepEqual(
                    await page.evalFn(() => [...document.getElementById('charts').querySelectorAll('[data-tab]')]
                        .map((el) => el.hasAttribute('hidden'))),
                    [true, false, true]);
            }));

        test('NO SELECTION INVENTED: a value matching no tab selects nothing and shows no panel',
            () => mounted(async (page) => {
                await page.evalFn(() => { document.getElementById('charts').value = 'nope'; return true; });
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const bar = document.getElementById('charts');
                    const b = bar.shadowRoot.querySelector('#tablist');
                    return {
                        selected: [...b.shadowRoot.querySelectorAll('.item')].map((el) => el.getAttribute('aria-selected')),
                        hidden: [...bar.querySelectorAll('[data-tab]')].map((el) => el.hasAttribute('hidden')),
                    };
                });
                assert.deepEqual(got.selected, ['false', 'false', 'false']);
                assert.deepEqual(got.hidden, [true, true, true], 'and no panel is showing either');
            }));

        test('a disabled tab bar takes the dial once and refuses every input', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('editor').disabled = true; return true; });
            await page.settle(3);
            const dim = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            assert.equal(await page.prop('#editor', 'opacity'), dim, 'the host dims once, from the base');
            assert.equal(await page.prop(bank('editor'), 'opacity'), '1',
                'and the bank does not dim again on top of it — the two must not compound');

            await page.recordEvents('#editor', ['change']);
            await page.click(tab('editor', 0));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), []);
            assert.equal(await page.evalFn(() => document.getElementById('editor').value), 'Settings');
        }));

        test('no @font-face in this component\'s styles — the chart\'s canvas resolves against the document registry',
            () => mounted(async (page) => {
                const faces = await page.evalFn(() => {
                    const roots = [document.getElementById('editor').shadowRoot];
                    roots.push(roots[0].querySelector('#tablist').shadowRoot);
                    let n = 0;
                    for (const root of roots) {
                        for (const sheet of root.adoptedStyleSheets || []) {
                            for (const rule of sheet.cssRules) if (rule.constructor.name === 'CSSFontFaceRule') n++;
                        }
                    }
                    return n;
                });
                assert.equal(faces, 0);
            }));

        test('the tab text is the document\'s registered face, by inheritance', () => mounted(async (page) => {
            const family = await page.prop(tab('editor', 0), 'font-family');
            const doc = await page.prop('#stage', 'font-family');
            assert.equal(family, doc, 'inherited, not restated');
            assert.equal(family, await page.resolveValue('var(--ui-font-family)', 'font-family'));
        }));
    });
}

test('the gallery entry is the documented shape', () => {
    assert.equal(galleryEntry.id, 'ui-tab-bar', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-tab-bar.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('every gallery state mounts and renders a tablist with tabs', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-tab-bar--${state.id} threw`);
            const shape = await page.evalFn(() => [...document.querySelectorAll('ui-tab-bar')].map((bar) => {
                const b = bar.shadowRoot.querySelector('#tablist');
                return { role: b.getAttribute('role'), tabs: b.shadowRoot.querySelectorAll('.item').length };
            }));
            assert.ok(shape.length >= 1, `ui-tab-bar--${state.id} mounted nothing`);
            for (const s of shape) {
                assert.equal(s.role, 'tablist', `ui-tab-bar--${state.id} is not a tablist`);
                assert.ok(s.tabs >= 2, `ui-tab-bar--${state.id} rendered fewer than two tabs`);
            }
        }
    });
});

test('every gallery state selects EXACTLY ONE tab, and paints it from the dials', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            const painted = await page.evalFn(() => {
                const out = [];
                for (const bar of document.querySelectorAll('ui-tab-bar')) {
                    const b = bar.shadowRoot.querySelector('#tablist');
                    const on = [...b.shadowRoot.querySelectorAll('.item')]
                        .filter((el) => el.getAttribute('aria-selected') === 'true');
                    out.push({
                        count: on.length,
                        face: on[0] ? getComputedStyle(on[0]).backgroundColor : null,
                        ink: on[0] ? getComputedStyle(on[0]).color : null,
                        faceToken: getComputedStyle(b).getPropertyValue('--ui-selected-face').trim(),
                        inkToken: getComputedStyle(b).getPropertyValue('--ui-selected-ink').trim(),
                    });
                }
                return out;
            });
            for (const p of painted) {
                assert.equal(p.count, 1,
                    `ui-tab-bar--${state.id}: ${p.count} tabs are selected. A state that photographs `
                    + 'nothing selected proves nothing — check that `value` matches a tab\'s VALUE '
                    + '(the string shorthand makes the value the label, capital included).');
                assert.equal(p.face, await page.resolveValue(p.faceToken, 'background-color'),
                    `ui-tab-bar--${state.id}: the selected face is not --ui-selected-face`);
                assert.equal(p.ink, await page.resolveValue(p.inkToken, 'color'),
                    `ui-tab-bar--${state.id}: the selected ink is not --ui-selected-ink`);
            }
        }
    });
});

test('the tab bar renders identically at the bench and at the floor', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(MARKUP, MODULE);
        const list = await page.box(bank('editor'));
        const cell = await page.box(tab('editor', 1));
        return {
            dpr: await page.eval('devicePixelRatio'),
            list: [Math.round(list.width), Math.round(list.height)],
            cell: [Math.round(cell.width), Math.round(cell.height)],
            face: await page.prop(tab('editor', 1), 'background-color'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual([bench.list, bench.cell, bench.face], [floor.list, floor.cell, floor.face],
        'no viewport reading anywhere: 1281×801 @ 1.5 and 1000×600 @ 1 give the same tablist');
    assert.equal(bench.list[1], 82, 'and it is the oracle\'s 82px tablist');
    assert.equal(bench.cell[1], 80, 'with the oracle\'s 80px tab inside it');
});
