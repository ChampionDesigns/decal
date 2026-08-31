/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-preset-bank.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-preset-bank.js'];

const DOSE = `<ui-preset-bank id="dose" label="Drink weight presets" value="40"
    presets='[30,36,40,50]'></ui-preset-bank>`;

const FLOW = `<ui-preset-bank id="flow" label="Steam flow presets" value="0.9"
    presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>`;

const STEAM = `<ui-preset-bank id="steam" label="Steam temperature presets" value="145"
    presets='[135,145,155,165]'></ui-preset-bank>`;

/* A row with no value at all — the absence case. No fallback, no computed default:
 * an absent reading highlights nothing. */
const ABSENT = `<ui-preset-bank id="absent" label="Flush volume presets"
    presets='[20,30,40,60]'></ui-preset-bank>`;

const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 400px; }
    </style>
    <div id="stage">${DOSE}${FLOW}${STEAM}${ABSENT}</div>`;

/** The bank a preset row renders, and its cells — two boundaries deep. */
const bank = (row) => `#${row} >>> #presets`;
const cell = (row, i) => `#${row} >>> #presets >>> #item-${i}`;

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

/** Every cell's aria state and label, read from inside the bank. */
const CELLS = (rowId) => `(${((id) => {
    const row = document.getElementById(id);
    const b = row.shadowRoot.querySelector('#presets');
    return [...b.shadowRoot.querySelectorAll('.item')].map((el) => ({
        text: el.textContent.trim(),
        role: el.getAttribute('role'),
        pressed: el.getAttribute('aria-pressed'),
        selected: el.getAttribute('aria-selected'),
        checked: el.getAttribute('aria-checked'),
        tabindex: el.getAttribute('tabindex'),
        disabled: el.hasAttribute('disabled'),
    }));
}).toString()})(${JSON.stringify(rowId)})`;

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-preset-bank @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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

        test('a preset row renders exactly one ui-bank and no control of its own',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('dose').shadowRoot;
                    const banks = [...root.querySelectorAll('ui-bank')];
                    return {
                        banks: banks.length,
                        mode: banks[0]?.getAttribute('mode'),
                        role: banks[0]?.getAttribute('role'),
                        /* Anything else that could take a click or a key. A second
                         * control here would be a fourth idiom starting again. */
                        strays: [...root.querySelectorAll('button, input, a[href], [role]')]
                            .filter((el) => el.tagName !== 'UI-BANK').length,
                    };
                });
                assert.equal(shape.banks, 1, 'one bank, not a hand-built copy of one (spec §5.2 #37)');
                assert.equal(shape.mode, 'toolbar');
                assert.equal(shape.role, 'group',
                    'the element carrying the group role is the bank, so the accessible group and '
                    + 'the painted box are one element');
                assert.equal(shape.strays, 0, 'no control of this component\'s own — the presets are the bank\'s buttons');
            }));

        test('APPENDIX 15: the cells speak ONE aria spelling, aria-pressed, and exactly one is true',
            () => mounted(async (page) => {
                const cells = await page.eval(CELLS('dose'));
                assert.equal(cells.length, 4, 'four presets, four cells');
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'the active cell is the one the VALUE matches (40 is preset index 2)');
                for (const c of cells) {
                    assert.equal(c.role, null, 'no role on the cell: a toolbar button is a button');
                    assert.equal(c.selected, null, 'one spelling, not three');
                    assert.equal(c.checked, null);
                }
                assert.deepEqual(cells.map((c) => c.tabindex), ['-1', '-1', '0', '-1'],
                    'one tab stop for the row, on the active cell — the roving contract');
            }));

        test('the group takes the row\'s name, and the role-less host gives its own up (bug L23 symptom 1)',
            () => mounted(async (page) => {
                await page.mount(
                    `<ui-preset-bank id="named" aria-label="Steam flow presets" value="0.8"
                        presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>`,
                    MODULE,
                );
                await page.settle(3);
                const got = await page.evalFn(() => {
                    const row = document.getElementById('named');
                    return {
                        host: row.getAttribute('aria-label'),
                        hostRole: row.getAttribute('role'),
                        bank: row.shadowRoot.querySelector('#presets').getAttribute('aria-label'),
                        name: row.accessibleName,
                    };
                });
                assert.equal(got.bank, 'Steam flow presets', 'the name lands on the element carrying the group role');
                assert.equal(got.host, null, 'and does not stay on the role-less host as a second announcement');
                assert.equal(got.hostRole, null, 'the host takes no role of its own');
                assert.equal(got.name, 'Steam flow presets', 'and the component can still say what its name is');
            }));

        test('`label` is the API and it reaches the group', () => mounted(async (page) => {
            const got = await page.prop(bank('dose'), 'display');
            assert.equal(got, 'grid', 'the bank is there to be named');
            const name = await page.evalFn(() =>
                document.getElementById('dose').shadowRoot.querySelector('#presets').getAttribute('aria-label'));
            assert.equal(name, 'Drink weight presets');
        }));

        test('four equal cells across the container — the stepper\'s shape without the stepper\'s numbers',
            () => mounted(async (page) => {
                const stage = await page.box('#stage');
                const host = await page.box('#dose');
                const cells = await Promise.all([0, 1, 2, 3].map((i) => page.box(cell('dose', i))));
                near(host.width, stage.width, 'the row fills the column it is given');
                near(cells[0].width, cells[1].width, 'equal cells');
                near(cells[1].width, cells[2].width, 'equal cells');
                near(cells[2].width, cells[3].width, 'equal cells');
                const border = parseFloat(await page.resolveValue('var(--ui-border-w)', 'width'));
                near(cells.reduce((sum, c) => sum + c.width, 0), stage.width - 2 * border,
                    'four cells and the bank\'s two hairlines are the whole row');
            }));

        test('THE DEPARTURE, measured: the cell IS the hit box, and it clears --ui-hit-min',
            () => mounted(async (page) => {

                const hitMin = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'height'));
                const box = await page.box(cell('dose', 0));
                near(box.height, hitMin, 'the cell is --ui-hit-min tall, from #3\'s plain form');
                await assertHitFloor(page, cell('dose', 0), { mode: 'box' });
                const generated = await page.computed(cell('dose', 0), ['content'], { pseudo: '::before' });
                assert.equal(generated.content, 'none',
                    'and there is no hit overlay pretending otherwise — the box is the whole answer');
            }));

        test('CONTAINER FLOOR: squeezed to 240px the row shrinks its cells, clips nothing and keeps the touch floor',
            () => mounted(async (page) => {
                await page.setStyle('#stage', { 'inline-size': '240px' });
                await page.settle(2);
                const host = await page.metrics('#dose');
                const b = await page.metrics(bank('dose'));
                near(host.rect.width, 240, 'the row is the container');
                assert.ok(host.scrollWidth <= host.clientWidth + 0.5,
                    `nothing is silently removed from the host: scrollWidth ${host.scrollWidth} vs clientWidth ${host.clientWidth}`);
                assert.ok(b.scrollWidth <= b.clientWidth + 0.5,
                    `nor from the bank: scrollWidth ${b.scrollWidth} vs clientWidth ${b.clientWidth}`);
                await assertHitFloor(page, cell('dose', 0), { mode: 'box', axes: ['block'] });
                const cells = await Promise.all([0, 3].map((i) => page.box(cell('dose', i))));
                near(cells[0].width, cells[1].width, 'still equal cells at the floor');
            }));

        test('TOKEN DRILL: the resting ink and the bank ground are read through two shadow boundaries',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-muted', selector: cell('dose', 0), property: 'color',
                });
                const ground = await page.computed(bank('dose'), ['background-color', 'border-top-color']);
                assert.equal(ground['background-color'], 'rgba(0, 0, 0, 0)',
                    'the preset row still paints a container: "just numbers" means the rail shows through');
                assert.equal(ground['border-top-color'], 'rgba(0, 0, 0, 0)',
                    'the preset row still draws a frame');
            }));

        test('DIAL DRILL: the active preset is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: cell('dose', 2),
                    unselected: cell('dose', 1),
                    scope: '#dose',
                    /* THE LED IS THE DIFFERENTIATOR HERE, not the face: this row's
                     * selected cell is an underlined number on a transparent ground. */
                    contrast: 'led',
                });
            }));

        test('the active preset is an UNDERLINED number, not a filled cell — Slate\'s own idiom',
            () => mounted(async (page) => {
                const got = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'box-shadow']);
                assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)',
                    'the selected preset is still a filled cell');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));

                const led = parseFloat(await page.resolveToken('--ui-toggle-led', 'padding-top'));
                assert.ok(led > 0, `--ui-toggle-led did not resolve to a length: ${led}`);
                const inset = /0px -([\d.]+)px 0px 0px inset/.exec(got['box-shadow']);
                assert.ok(inset, `no underline on the selected preset: ${got['box-shadow']}`);
                assert.equal(parseFloat(inset[1]), led,
                    'the underline is not --ui-toggle-led deep — a second number entered the row');
            }));

        test('the active preset gains a weight step, as Slate\'s own idiom does — but through the dial',
            () => mounted(async (page) => {
                const active = await page.prop(cell('dose', 2), 'font-weight');
                const resting = await page.prop(cell('dose', 3), 'font-weight');
                assert.equal(active, await page.resolveToken('--ui-selected-weight', 'font-weight'),
                    'the active cell reads --ui-selected-weight');
                assert.equal(resting, await page.resolveValue('var(--ui-weight-regular)', 'font-weight'),
                    'a resting cell keeps the bank\'s --ui-weight-regular');
                assert.notEqual(active, resting, 'the active cell is one step up, as Slate\'s is');
            }));

        test('WITH ALL FIVE DIALS NEUTRAL, an active preset and a resting one are indistinguishable',
            () => mounted(async (page) => {

                await page.setToken('--ui-selected-face', 'transparent');
                await page.setToken('--ui-selected-ink', 'currentColor');
                await page.setToken('--ui-selected-led', '0px');
                await page.setToken('--ui-selected-glow', '0%');
                await page.setToken('--ui-selected-weight', 'var(--ui-weight-regular)');
                await page.setStyle('#dose', {
                    '--ui-selected-face': 'transparent',
                    '--ui-selected-ink': 'currentColor',
                    '--ui-selected-led': '0px',
                });
                try {
                    const active = await page.computed(cell('dose', 2), NON_DIAL_PROPERTIES);
                    const resting = await page.computed(cell('dose', 3), NON_DIAL_PROPERTIES);
                    const differing = Object.keys(active).filter((k) => active[k] !== resting[k]);
                    assert.deepEqual(differing.filter((k) => k !== 'border-top-color'), [],
                        'an active preset differs from a resting one with every dial turned off — that is '
                        + 'the fourth idiom, alive. Differing: '
                        + JSON.stringify(Object.fromEntries(differing.map((k) => [k, [active[k], resting[k]]]))));

                    const shadows = await page.computed(cell('dose', 2), ['box-shadow', 'text-shadow']);
                    assert.match(lastSegment(shadows['box-shadow']), /(^|\s)0px 0px 0px 0px(\s|$)/,
                        `the LED dial at 0px must leave a zero-extent segment: ${shadows['box-shadow']}`);
                } finally {
                    for (const dial of ['--ui-selected-face', '--ui-selected-ink',
                        '--ui-selected-led', '--ui-selected-glow', '--ui-selected-weight']) {
                        await page.setToken(dial, null);
                    }
                    await page.setStyle('#dose', {
                        '--ui-selected-face': null,
                        '--ui-selected-ink': null,
                        '--ui-selected-led': null,
                    });
                }
            }));

        test('the 42px underline is inexpressible: neither cell generates a pseudo-element',
            () => mounted(async (page) => {
                for (const [row, index] of [['dose', 2], ['dose', 1]]) {
                    const after = await page.computed(cell(row, index), ['content'], { pseudo: '::after' });
                    assert.equal(after.content, 'none',
                        `cell ${index} generates an ::after — the fourth idiom's underline is back`);
                }
            }));

        test('one turn of the row\'s own dial moves every preset row in the page together',
            () => mounted(async (page) => {
                const sheet = await page.evalFn((value) => {
                    const el = document.createElement('style');
                    el.id = 'fork-retarget';
                    el.textContent = `ui-preset-bank { --ui-selected-led: ${value}; }`;
                    document.head.append(el);
                    return true;
                }, DRILL_LENGTH);
                assert.ok(sheet);
                await page.settle(2);
                const dose = await page.prop(cell('dose', 2), 'box-shadow');
                const steam = await page.prop(cell('steam', 1), 'box-shadow');
                await page.evalFn(() => (document.getElementById('fork-retarget').remove(), true));
                const want = new RegExp(`-${parseFloat(DRILL_LENGTH)}px`);
                assert.match(dose, want, 'the drink row followed the dial');
                assert.match(steam, want, 'and so did the steam row, with no per-instance rule');
            }));

        test('E10\'s mechanism: a document sheet aimed at every Slate class reaches nothing',
            () => mounted(async (page) => {
                const before = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = `
                        .item, .presets, .preset-active, .slate-preset-bank,
                        .slate-bank-item, .is-selected, [aria-pressed="true"],
                        ui-preset-bank *, ui-preset-bank > *, ui-bank * {
                            background-color: rgb(1, 2, 3) !important;
                            color: rgb(4, 5, 6) !important;
                            font-weight: 900 !important;
                            box-shadow: none !important;
                        }`;
                    document.head.append(s);
                    return true;
                });
                await page.settle(2);
                const after = await page.computed(cell('dose', 2),
                    ['background-color', 'color', 'font-weight', 'box-shadow']);
                assert.deepEqual(after, before,
                    'load order stops being a mechanism once there is one implementation behind a boundary');
            }));

        test('the component paints with no !important anywhere in its own sheets', () => mounted(async (page) => {
            const bad = await page.evalFn(() => {
                const sheets = document.getElementById('dose').shadowRoot.adoptedStyleSheets || [];
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
                    const sheets = document.getElementById('dose').shadowRoot.adoptedStyleSheets || [];
                    const own = sheets[sheets.length - 1];
                    const colourish = /(^|-)(color|background|box-shadow|text-shadow|fill|stroke|opacity)$/;
                    const out = { colour: [], selection: [], rules: 0 };
                    for (const rule of own.cssRules) {
                        if (!rule.style) continue;
                        out.rules++;
                        if (/aria-pressed|aria-selected|aria-checked|aria-current|\.item|\bselected\b|preset-active/
                            .test(rule.selectorText || '')) {
                            out.selection.push(rule.selectorText);
                        }
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (!colourish.test(prop)) continue;
                            if (prop === 'opacity' && rule.style.getPropertyValue(prop).trim() === '1') continue;
                            if (rule.style.getPropertyValue(prop).trim() === 'transparent') continue;
                            out.colour.push(`${rule.selectorText} { ${prop}: ${rule.style.getPropertyValue(prop)} }`);
                        }
                    }
                    return out;
                });
                assert.deepEqual(found.colour, [],
                    'a preset bank that declares a colour has restarted the fourth idiom');
                assert.deepEqual(found.selection, [],
                    'and one that can select is one that can select DIFFERENTLY');
                assert.ok(found.rules > 0, 'the sheet under test is this component\'s, not an empty one');
            }));

        test('a press does NOT light the pressed cell — it publishes an intent and waits for the value',
            () => mounted(async (page) => {
                await page.recordEvents('#dose', ['preset-select', 'change']);
                await page.click(cell('dose', 3));
                await page.settle(2);

                const cells = await page.eval(CELLS('dose'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'the pressed cell did not light and the active one did not move — value is still 40');

                const events = await page.recordedEvents();
                assert.equal(events.length, 1, `exactly one event leaves the host: ${JSON.stringify(events)}`);
                assert.equal(events[0].type, 'preset-select', 'the bank\'s own change is stopped, not re-fired');
                assert.equal(events[0].detail.value, 50, 'the intent carries the preset NUMBER');
                assert.equal(typeof events[0].detail.value, 'number',
                    'a number, never the rendered label — reading numbers back out of printed strings is '
                    + 'the worst coupling the audit found ');
                assert.equal(events[0].detail.index, 3);
                assert.equal(events[0].detail.label, '50');
            }));

        test('the highlight moves when, and only when, the value comes back changed',
            () => mounted(async (page) => {
                await page.evalFn(() => { document.getElementById('dose').value = 50; return true; });
                await page.settle(2);
                const cells = await page.eval(CELLS('dose'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'true'],
                    'the machine took 50, so now 50 is lit');
            }));

        test('pressing the already-active preset asks for nothing', () => mounted(async (page) => {
            await page.recordEvents('#dose', ['preset-select', 'change']);
            await page.click(cell('dose', 2));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [],
                'the value is already what that press would ask for; a second write would be noise');
        }));

        test('a keyboard walk moves the tab stop without pressing anything (toolbar, not radio)',
            () => mounted(async (page) => {
                await page.recordEvents('#dose', ['preset-select']);
                await page.focusVisible(cell('dose', 2));
                await page.press('ArrowRight');
                await page.settle(2);

                const after = await page.eval(CELLS('dose'));
                assert.deepEqual(after.map((c) => c.tabindex), ['-1', '-1', '-1', '0'],
                    'the tab stop moved to the next cell');
                assert.deepEqual(after.map((c) => c.pressed), ['false', 'false', 'true', 'false'],
                    'and nothing was pressed on the way');
                assert.deepEqual(await page.recordedEvents(), [], 'so the machine was not asked for anything');

                await page.press(' ');
                await page.settle(2);
                const events = await page.recordedEvents();
                assert.equal(events.length, 1, 'Space is what chooses');
                assert.equal(events[0].detail.value, 50);
            }));

        test('a hand-dialled value lights nothing — Slate\'s own live-ready state',
            () => mounted(async (page) => {
                const cells = await page.eval(CELLS('flow'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false'],
                    '0.9 matches no preset, so nothing is lit');
                const index = await page.evalFn(() => document.getElementById('flow').activeIndex);
                assert.equal(index, -1, 'and the component says so: -1, the honest state');
                assert.deepEqual(cells.map((c) => c.tabindex), ['0', '-1', '-1', '-1'],
                    'the row is still reachable by keyboard — the tab stop falls to the first cell');
            }));

        test('an absent value highlights nothing and invents nothing (A7)', () => mounted(async (page) => {
            const cells = await page.eval(CELLS('absent'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false']);
            const index = await page.evalFn(() => document.getElementById('absent').activeIndex);
            assert.equal(index, -1, 'absence is a state, not a prompt to compute a default');
        }));

        test('an absence object from the address layer is an absence, not a zero', () => mounted(async (page) => {
            await page.evalFn(() => {
                document.getElementById('flow').value = { noReading: true, reason: 'absent' };
                return true;
            });
            await page.settle(2);
            const cells = await page.eval(CELLS('flow'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'false', 'false'],
                'hasReading() is the whole policy: an absence never coerces to a number');
        }));

        test('labels are printed at the row\'s step, so 1.0 is not 1', () => mounted(async (page) => {
            const dose = await page.eval(CELLS('dose'));
            const flow = await page.eval(CELLS('flow'));
            assert.deepEqual(dose.map((c) => c.text), ['30', '36', '40', '50']);
            assert.deepEqual(flow.map((c) => c.text), ['0.6', '0.8', '1.0', '1.2']);
        }));

        test('the match is at display precision, not at float equality', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('flow').value = 0.7999999999; return true; });
            await page.settle(2);
            const cells = await page.eval(CELLS('flow'));
            assert.deepEqual(cells.map((c) => c.pressed), ['false', 'true', 'false', 'false'],
                'a value that PRINTS as 0.8 is 0.8 — "matching is at the tile\'s '
                + '0.1 ml/s display precision"');
        }));

        test('THE STEAM TABLE: this row carries no limits, and the values it shows clear the 135 floor',
            () => mounted(async (page) => {
                const cells = await page.eval(CELLS('steam'));
                assert.deepEqual(cells.map((c) => c.text), ['135', '145', '155', '165']);
                const numbers = cells.map((c) => Number(c.text));
                assert.ok(numbers.every((n) => n >= 135 && n <= 165),
                    'every steam preset in this suite sits inside the corrected range');
                assert.ok(!numbers.includes(130) && !numbers.includes(170),
                    'the 130/170 table is B3\'s retired defect and does not appear here');
            }));

        test('FOCUS UNCLIPPED: the ring is the token ring and the bank\'s overflow does not cut it',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, cell('dose', 0));
                await assertFocusUnclipped(page, cell('dose', 3));
            }));

        test('DISABLED: one fade, not two multiplied', () => mounted(async (page) => {
            /* ui-bank.js:496-505's arithmetic, one level up: without the opt-out the base
             * dims the host AND the bank and they compound to .38 x .38 = .14. */
            await page.evalFn(() => { document.getElementById('dose').disabled = true; return true; });
            await page.settle(2);
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            const host = await page.prop('#dose', 'opacity');
            const inner = await page.prop(bank('dose'), 'opacity');
            assert.equal(host, dial, 'the host a screen disabled keeps the dial');
            assert.equal(inner, '1', 'the bank inside it opts out, so the two do not multiply');

            await page.recordEvents('#dose', ['preset-select']);
            await page.click(cell('dose', 0));
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [],
                'and the press is refused by the native disabled attribute, not only dimmed');
        }));

        test('a disabled PRESET is still matched — the highlight reports what the value is',
            () => mounted(async (page) => {
                await page.mount(
                    `<ui-preset-bank id="mixed" label="Hot water volume presets" value="400"
                        presets='[{"value":50},{"value":150},{"value":400,"disabled":true}]'></ui-preset-bank>`,
                    MODULE,
                );
                await page.settle(3);
                const cells = await page.eval(CELLS('mixed'));
                assert.deepEqual(cells.map((c) => c.pressed), ['false', 'false', 'true'],
                    'the machine is at 400, so 400 is lit even though the row will not take the press');
                assert.deepEqual(cells.map((c) => c.disabled), [false, false, true]);
            }));
    });
}

test('the gallery entry has the shape entries.js documents', () => {
    assert.equal(galleryEntry.id, 'ui-preset-bank', 'the entry id is the tag name and the capture prefix');
    assert.equal(galleryEntry.module, '../../src/components/ui-preset-bank.js', 'module is relative to tools/gallery/');
    assert.ok(galleryEntry.title && galleryEntry.notes);
    assert.ok(galleryEntry.states.length >= 1);
    const ids = galleryEntry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, 'state ids are capture filenames, so they must be unique');
    for (const s of galleryEntry.states) {
        assert.match(s.id, /^[a-z0-9-]+$/, `state id ${s.id} must be a kebab-case identifier, not a label`);
        assert.ok(s.title && s.html, `state ${s.id} needs a title and markup`);
    }
});

test('no gallery state ships the retired steam table', () => {
    for (const s of galleryEntry.states) {
        assert.ok(!/\b130\b|\b170\b/.test(s.html),
            `gallery state ui-preset-bank--${s.id} carries a 130/170 steam value`);
    }
});

test('every gallery state mounts and renders a bank with cells', async () => {
    await browser.withPage({ geometry: BENCH }, async (page) => {
        for (const state of galleryEntry.states) {
            await page.mount(state.html, MODULE);
            assert.deepEqual(page.pageErrors, [], `gallery state ui-preset-bank--${state.id} threw`);
            const shape = await page.evalFn(() => [...document.querySelectorAll('ui-preset-bank')].map((row) => {
                const b = row.shadowRoot.querySelector('#presets');
                return {
                    bank: Boolean(b),
                    role: b?.getAttribute('role'),
                    cells: b ? b.shadowRoot.querySelectorAll('.item').length : 0,
                    pressed: b ? [...b.shadowRoot.querySelectorAll('.item')]
                        .filter((el) => el.getAttribute('aria-pressed') === 'true').length : 0,
                };
            }));
            assert.ok(shape.length >= 1, `state ${state.id} rendered no preset bank`);
            for (const row of shape) {
                assert.ok(row.bank, `state ${state.id} rendered a row with no bank`);
                assert.equal(row.role, 'group');
                assert.ok(row.cells >= 3, `state ${state.id} rendered ${row.cells} cells`);
                assert.ok(row.pressed <= 1, `state ${state.id} lit ${row.pressed} cells — a row has at most one`);
            }
        }
    });
});
