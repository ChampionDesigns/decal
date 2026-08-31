/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-favourites-bank.entry.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = [
    '/src/components/ui-favourites-bank.js',
    '/src/components/ui-tab-bar.js',
];

const FAVOURITES = JSON.stringify([
    { value: 'p1', name: 'Extractamundo Dos!' },
    { value: 'p2', name: 'Temp test' },
    { value: 'p3', name: 'Extract Blooming Espresso' },
    null,
    null,
]);

const BANKS = `
    <ui-favourites-bank id="favs" label="Favourite profiles" value="p1"
        favourites='${FAVOURITES}'></ui-favourites-bank>
    <ui-tab-bar id="tabs" label="Chart" value="flow"
        tabs='["flow","power","data"]'></ui-tab-bar>`;

const MARKUP = `
    <style>
      #stage { display: grid; gap: 24px; inline-size: 900px; }
    </style>
    <div id="stage">${BANKS}</div>`;

const BANK = '#favs >>> #bank';
/** The bank's own cell button, two boundaries deep. */
const cell = (i) => `#favs >>> #bank >>> #item-${i}`;
/** The slotted mark for one cell, and the disc button inside it. */
const mark = (value) => `#favs >>> [slot="item-${value}"] .mark`;
const disc = (value) => `${mark(value)} >>> #slot`;
const TAB_SELECTED = '#tabs >>> #tablist >>> #item-0';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

const SLATE_ATTACK = `
    #profile-fav-nav > button,
    #profile-fav-nav > button[aria-pressed="true"],
    [id^="fav-profile-btn-"],
    .slate-bank, .slate-bank-item, .cell, .mark, .name, .item, button {
        width: 20% !important;
        min-width: 300px !important;
        height: 300px !important;
        min-height: 300px !important;
        padding-left: 99px !important;
        background-color: rgb(1, 2, 3) !important;
        color: rgb(4, 5, 6) !important;
        font-weight: 900 !important;
    }`;

const attack = (page) => page.evalFn((cssText) => {
    const el = document.createElement('style');
    el.id = 'slate-attack';
    el.textContent = cssText;
    document.head.append(el);
    return true;
}, SLATE_ATTACK);

/** Is the deep-active element inside the favourites bank? */
const ACTIVE_INSIDE_FAVS = () => {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    const favs = document.getElementById('favs');
    let node = el;
    while (node) {
        if (node === favs) return true;
        node = node.parentNode;
        if (node && node.nodeType === 11 && node.host) node = node.host;
    }
    return false;
};

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-favourites-bank @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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

        test('the row renders exactly one ui-bank and no control of its own', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const root = document.getElementById('favs').shadowRoot;
                const banks = [...root.querySelectorAll('ui-bank')];
                return {
                    banks: banks.length,
                    mode: banks[0]?.getAttribute('mode'),
                    role: banks[0]?.getAttribute('role'),
                    marks: root.querySelectorAll('ui-favourite-slot').length,
                    cells: root.querySelectorAll('.cell').length,
                    /* Anything of this component's OWN that could take a click or a
                     * key. One here would be a second implementation of the widget. */
                    strays: root.querySelectorAll('button, input, a[href], [tabindex]').length,
                };
            });
            assert.equal(shape.banks, 1, 'one bank, not a hand-built copy of one (bug L8)');
            assert.equal(shape.mode, 'toolbar',
                'Slate spells the favourites\' state aria-pressed and arrowing must not load a profile');
            assert.equal(shape.role, 'group');
            assert.equal(shape.cells, 5, 'P25: five cells regardless of how many are filled');
            assert.equal(shape.marks, 5, 'every cell carries a #35 mark, filled or not');
            assert.equal(shape.strays, 0,
                'no control of this component\'s own — the cells are the bank\'s buttons');
        }));

        test('every mark is inert and carries the occupancy state, never a private one',
            () => mounted(async (page) => {
                const marks = await page.evalFn(() => (
                    [...document.getElementById('favs').shadowRoot.querySelectorAll('ui-favourite-slot')]
                        .map((el) => ({
                            inert: el.hasAttribute('inert'),
                            filled: el.hasAttribute('filled'),
                            selected: el.hasAttribute('selected'),
                            index: el.getAttribute('index'),
                        }))
                ));
                assert.deepEqual(marks.map((m) => m.inert), [true, true, true, true, true],
                    'a button inside a button is two tab stops and two accessible controls — inert is what makes the composition legal');
                assert.deepEqual(marks.map((m) => m.filled), [true, true, true, false, false],
                    'occupancy is DATA here, not Slate\'s :empty/:blank selector pair (bug L6)');
                assert.deepEqual(marks.map((m) => m.selected), [true, false, false, false, false]);
                assert.deepEqual(marks.map((m) => m.index), ['1', '2', '3', '4', '5']);
            }));

        test('L7: the five cells are one box, equal and token-sized — no second implementation to disagree with',
            () => mounted(async (page) => {
                const boxes = [];
                for (let i = 0; i < 5; i++) boxes.push(await page.box(cell(i)));
                const widths = boxes.map((b) => b.width);
                near(Math.max(...widths) - Math.min(...widths), 0,
                    'L7: cells disagree on width — Slate\'s five measure 264.094/180/234/180/180 in a 1040px box');

                const pad = await page.resolveValue('var(--ui-space-4)', 'padding-left');
                const inner = await page.resolveValue('var(--ui-control-inner)', 'min-height');
                const got = await page.computed(cell(0), ['padding-left', 'padding-right', 'min-height']);
                assert.equal(got['padding-left'], pad,
                    'L7 second half: Slate\'s cell padding is a 14px !important literal and its --slate-space-4 paints nothing');
                assert.equal(got['padding-right'], pad);
                assert.equal(got['min-height'], inner);
            }));

        test('L7: --ui-space-4 DRILLS the cell padding — the token Slate declares and cannot turn',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-space-4',
                    value: DRILL_LENGTH,
                    selector: cell(0),
                    property: 'padding-left',
                });
            }));

        test('L7: a document sheet carrying all three of Slate\'s selectors, with !important, reaches nothing',
            () => mounted(async (page) => {
                const before = {
                    box: await page.box(cell(1)),
                    style: await page.computed(cell(1), ['padding-left', 'min-height', 'background-color']),
                    markBox: await page.box(mark('p2')),
                };
                await attack(page);
                await page.settle(2);
                const after = {
                    box: await page.box(cell(1)),
                    style: await page.computed(cell(1), ['padding-left', 'min-height', 'background-color']),
                    markBox: await page.box(mark('p2')),
                };
                near(after.box.width, before.box.width, 'L7: a document rule moved the cell width');
                near(after.box.height, before.box.height, 'L7: a document rule moved the cell height');
                assert.deepEqual(after.style, before.style,
                    'L7: a document rule reached inside ui-bank — the box would have two owners again');
                near(after.markBox.width, before.markBox.width,
                    'P4/L7: a document min-width reached the mark — that clamp IS bug P4\'s mechanism');
            }));

        test('L7/P4: the mark IS --ui-hit-min, with no min-* clamp behind it', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-hit-min',
                value: DRILL_LENGTH,
                selector: disc('p2'),
                property: 'width',
            });
            const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
            const box = await page.box(disc('p2'));
            near(box.width, floor, 'the mark\'s ink is the token');
            near(box.height, floor, 'the mark\'s ink is the token');
        }));

        test('L8: the selected cell is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                await assertOneSelectionTreatment(page, {
                    selected: cell(0),
                    unselected: cell(1),
                });
            }));

        test('L8: ONE turn of --ui-selected-face moves the favourites bank AND the tab bar together',
            () => mounted(async (page) => {
                const drilled = await page.resolveValue(DRILL_COLOUR, 'background-color');
                const before = {
                    fav: await page.prop(cell(0), 'background-color'),
                    tab: await page.prop(TAB_SELECTED, 'background-color'),
                };
                assert.equal(before.fav, before.tab,
                    'L8: the favourites bank and the tab bar do not even start from the same selected face');

                await page.setToken('--ui-selected-face', DRILL_COLOUR);
                const after = {
                    fav: await page.prop(cell(0), 'background-color'),
                    tab: await page.prop(TAB_SELECTED, 'background-color'),
                };
                assert.equal(after.fav, drilled,
                    'L8 exactly: re-skinning selection left the favourites alone');
                assert.equal(after.tab, drilled);

                await page.setToken('--ui-selected-face', null);
                assert.equal(await page.prop(cell(0), 'background-color'), before.fav);
            }));

        test('L8: with all five dials neutral a selected cell is indistinguishable from a resting one',
            () => mounted(async (page) => {
                for (const [token, value] of [
                    ['--ui-selected-face', 'var(--ui-key)'],
                    ['--ui-selected-ink', 'var(--ui-muted)'],
                    ['--ui-selected-led', '0px'],
                    ['--ui-selected-glow', '0%'],
                    ['--ui-selected-weight', 'var(--ui-weight-regular)'],
                ]) await page.setToken(token, value);
                await page.settle(2);

                const compared = [...NON_DIAL_PROPERTIES, 'font-weight'];
                const selected = await page.computed(cell(0), compared);
                const resting = await page.computed(cell(1), compared);
                assert.deepEqual(selected, resting,
                    'a property outside the five dials distinguishes selected from resting — that is a private "selected" look, which #36 forbids by name');
                await page.setToken('--ui-selected-weight', null);
            }));

        test('the selected cell carries Slate\'s medium weight, through the fifth dial',
            () => mounted(async (page) => {
                const dial = await page.resolveToken('--ui-selected-weight', 'font-weight');
                assert.equal(await page.prop(cell(0), 'font-weight'), dial,
                    'the selected cell reads --ui-selected-weight');
                assert.equal(await page.prop(cell(1), 'font-weight'),
                    await page.resolveValue('var(--ui-weight-regular)', 'font-weight'),
                    'a resting cell keeps --ui-weight-regular');
            }));

        test('L8: occupancy is not selection — a filled, unselected mark is --ui-primary',
            () => mounted(async (page) => {
                const primary = await page.resolveToken('--ui-primary', 'background-color');
                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                const filled = await page.prop(disc('p2'), 'background-color');
                const empty = await page.prop(disc('#empty-4'), 'background-color');
                assert.equal(filled, primary,
                    '"Occupancy is now the difference between an outlined slot and a filled one"');
                assert.notEqual(filled, face, 'occupancy and selection must not be the same paint');
                assert.equal(empty, 'rgba(0, 0, 0, 0)', 'an empty slot is outlined, not filled');
            }));

        test('L8: the SELECTED mark takes the dials too, and the bank seam does not leak into it',
            () => mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                assert.equal(await page.prop(disc('p1'), 'background-color'), face,
                    'the selected mark is painted by the same dial as its cell — #35\'s :host(:is(...)) block');

                await page.setStyle('#favs', { '--ui-selected-led': '4px' });
                const first = await page.prop(disc('p1'), 'box-shadow');
                await page.evalFn(() => {
                    document.getElementById('favs').value = 'p2';
                    return true;
                });
                await page.settle(2);
                const second = await page.prop(disc('p2'), 'box-shadow');
                assert.equal(second, first,
                    'the second mark carries a seam the first does not — the bank\'s resting shadow leaked across the slot');
            }));

        test('exactly one cell carries aria-pressed=true, empty cells are disabled, and the name is on the group',
            () => mounted(async (page) => {
                const aria = await page.evalFn(() => {
                    const favs = document.getElementById('favs');
                    const bank = favs.shadowRoot.querySelector('#bank');
                    return {
                        items: [...bank.shadowRoot.querySelectorAll('.item')].map((el) => ({
                            role: el.getAttribute('role'),
                            pressed: el.getAttribute('aria-pressed'),
                            selected: el.getAttribute('aria-selected'),
                            checked: el.getAttribute('aria-checked'),
                            disabled: el.disabled,
                            name: el.textContent.replace(/\s+/g, ' ').trim(),
                        })),
                        groupRole: bank.getAttribute('role'),
                        groupName: bank.getAttribute('aria-label'),
                        hostName: favs.getAttribute('aria-label'),
                        tabStops: [...bank.shadowRoot.querySelectorAll('[tabindex="0"]')].length,
                    };
                });
                assert.deepEqual(aria.items.map((i) => i.pressed), ['true', 'false', 'false', 'false', 'false']);
                for (const i of aria.items) {
                    assert.equal(i.selected, null, 'a toolbar speaks ONE aria spelling, not three');
                    assert.equal(i.checked, null);
                    assert.equal(i.role, null, 'toolbar mode leaves the buttons as buttons');
                }
                assert.deepEqual(aria.items.map((i) => i.disabled), [false, false, false, true, true],
                    'an empty slot cannot be chosen: there is no profile there to load');
                assert.equal(aria.groupRole, 'group');
                assert.equal(aria.groupName, 'Favourite profiles',
                    'the name is on the element that carries the role');
                assert.equal(aria.hostName, null, 'no second announcement on a role-less generic (bug L23 symptom 1)');
                assert.equal(aria.tabStops, 1, 'roving tabindex: one tab stop per bank (Appendix 10)');
                assert.equal(aria.items[3].name, '4',
                    'an empty cell is still named — its slot number, not English this component invented');
            }));

        test('the marks are out of the tab order — Tab from the row leaves the component',
            () => mounted(async (page) => {
                await page.focusVisible(cell(0));
                assert.equal(await page.evalFn(ACTIVE_INSIDE_FAVS), true);
                await page.press('Tab');
                assert.equal(await page.evalFn(ACTIVE_INSIDE_FAVS), false,
                    'a second tab stop inside the row — the mark\'s own button is reachable, which is what inert exists to prevent');
            }));

        test('a real click on the inert mark arrives at its cell and changes the value',
            () => mounted(async (page) => {
                await page.recordEvents('#favs', ['change']);
                await page.click(disc('p2'));
                const events = await page.recordedEvents();
                assert.equal(events.length, 1,
                    'one press must produce exactly one change — a re-dispatch would make two');
                assert.equal(events[0].detail.value, 'p2');
                assert.equal(events[0].detail.index, 1);
                const state = await page.evalFn(() => ({
                    value: document.getElementById('favs').value,
                    attr: document.getElementById('favs').getAttribute('value'),
                }));
                assert.equal(state.value, 'p2', 'the compound mirrors the bank, so the marks follow');
                assert.equal(state.attr, 'p2', 'value is reflected');
            }));

        test('an empty cell cannot be chosen, and a disabled row refuses every press',
            () => mounted(async (page) => {
                await page.recordEvents('#favs', ['change']);
                await page.click(cell(3));
                assert.deepEqual(await page.recordedEvents(), [],
                    'an empty slot fired a change — there is no profile there to load');

                await page.evalFn(() => { document.getElementById('favs').disabled = true; return true; });
                await page.settle(2);
                await page.click(cell(1));
                assert.deepEqual(await page.recordedEvents(), []);

                const dim = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                assert.equal(await page.prop(BANK, 'opacity'), dim);
                assert.equal(await page.prop(cell(1), 'opacity'), '1',
                    'the dial must be applied once — .38 × .38 renders at .14');
            }));

        test('toolbar keyboard: arrows move the tab stop without loading a profile, Space chooses',
            () => mounted(async (page) => {
                await page.focusVisible(cell(0));
                await page.press('ArrowRight');
                assert.equal(
                    await page.evalFn(() => document.getElementById('favs').value), 'p1',
                    'arrowing past a favourite must not load it — that is why the bank is in toolbar mode',
                );
                await page.press(' ');
                assert.equal(await page.evalFn(() => document.getElementById('favs').value), 'p2');
            }));

        test('the ground and the resting ink are tokens, drilled', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key',
                selector: BANK,
                property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                selector: cell(1),
                property: 'color',
            });
        }));

        test('the focus ring is the one ring, inset, and nothing clips it (bug L24)',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, cell(0));
            }));

        test('a cell reaches the hit floor on both axes', () => mounted(async (page) => {
            await assertHitFloor(page, cell(0), { mode: 'box' });
        }));

        test('container floor: squeezed to 200px the row states its floor rather than clipping its marks',
            () => mounted(async (page) => {
                const floorToken = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
                const gutter = parseFloat(await page.resolveValue('var(--ui-space-4)', 'width'));
                const expected = 5 * (floorToken + 2 * gutter);

                await page.setStyle('#stage', { 'inline-size': '200px' });
                await page.settle(2);

                const host = await page.box('#favs');
                near(host.width, expected,
                    'the row must hold its ergonomic floor: below it the bank\'s overflow:hidden clips the marks, and spec §2.4 bans content silently removed');

                const overflow = await page.evalFn(() => {
                    const bank = document.getElementById('favs').shadowRoot.querySelector('#bank');
                    return { scroll: bank.scrollWidth, client: bank.clientWidth };
                });
                assert.ok(overflow.scroll <= overflow.client + 1,
                    `the bank clips its own content: scrollWidth ${overflow.scroll} against clientWidth ${overflow.client}`);

                const markBox = await page.box(mark('p1'));
                near(markBox.width, floorToken, 'the mark shrank — ergonomics is physical (spec §2.2)');
            }));

        test('the same stated container gives the same numbers whatever the viewport',
            () => mounted(async (page) => {
                const box = await page.box(cell(0));
                near(box.width, 179.6, 'cell width from a 900px stage', 0.6);
                const markBox = await page.box(mark('p1'));
                near(markBox.width, 48, 'mark width from a 900px stage');
            }));

        const GALLERY_MODULE = ['/tools/gallery/entries/ui-favourites-bank.demo.js'];

        test('every gallery state mounts and renders a bank', () => mounted(async (page) => {
            assert.equal(galleryEntry.id, 'ui-favourites-bank');
            for (const state of galleryEntry.states) {
                await page.mount(`<div id="stage">${state.html}</div>`, GALLERY_MODULE);
                assert.deepEqual(page.pageErrors, [],
                    `gallery state ${state.id} threw on mount`);

                const undefinedTags = await page.evalFn(() => {
                    const all = [];
                    const walk = (root) => {
                        for (const el of root.querySelectorAll('*')) {
                            all.push(el.tagName.toLowerCase());
                            if (el.shadowRoot) walk(el.shadowRoot);
                        }
                    };
                    walk(document);
                    return [...new Set(all)]
                        .filter((t) => t.includes('-') && !customElements.get(t));
                });
                assert.deepEqual(undefinedTags, [],
                    `gallery state ${state.id}: the entry's module leaves `
                    + `${undefinedTags.join(', ')} undefined — gallery.js awaits `
                    + 'whenDefined on it and never settles');

                const banks = await page.evalFn(() => (
                    [...document.querySelectorAll('ui-favourites-bank')]
                        .map((el) => el.shadowRoot.querySelectorAll('ui-bank').length)
                ));
                assert.ok(banks.length > 0, `gallery state ${state.id} renders no bank`);
                for (const n of banks) assert.equal(n, 1, `gallery state ${state.id}: one bank per row`);
            }
        }));
    });
}
