/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-list-row.js'];

const STAGE_CSS = `
<style>
    #list {
        inline-size: 520px;
        block-size: 200px;
        overflow: auto;
    }
    #narrow { inline-size: 240px; }
    #wide   { inline-size: 720px; }
    .disc {
        display: inline-grid;
        place-items: center;
        inline-size: 48px;
        block-size: 48px;
    }
    /* A CONSUMER'S ROW-ACTIONS TRIGGER, which is the only kind there is since D11.
     * Sized to --ui-hit-min so the row's job — not squeezing it — is measurable.
     * It declares NO color, deliberately: the ink-dial test's whole claim is that
     * color reaches slotted content from the host through the flattened tree with
     * no rule in the component and none here. */
    .rowaction {
        display: inline-grid;
        place-items: center;
        inline-size: 48px;
        block-size: 48px;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
    }
</style>`;

const MARKUP = `${STAGE_CSS}
<div id="list">
    <ui-list-row id="plain" tabindex="0">Lever Classic demo<button id="plain-act" slot="actions" class="rowaction" type="button" aria-label="More actions">⋯</button></ui-list-row>
    <ui-list-row id="chip" provenance="from Adaptive v2">Adaptive v3</ui-list-row>
    <ui-list-row id="picked" aria-selected="true">Power<span slot="actions" class="rowaction">⋯</span></ui-list-row>
    <ui-list-row id="unpicked">Default<span slot="actions" class="rowaction">⋯</span></ui-list-row>
    <ui-list-row id="bare" no-overflow>Cleaning / forward flush x5</ui-list-row>
    <ui-list-row id="favoured"><span>Best practice (light roast)</span><span slot="favourite" class="disc">3</span><span slot="actions" class="rowaction">⋯</span></ui-list-row>
</div>
<div id="narrow">
    <ui-list-row id="squeezed">Easy blooming — active pressure decline, long enough to need the clamp<span slot="actions" class="rowaction">⋯</span></ui-list-row>
</div>
<div id="wide">
    <ui-list-row id="open" tabindex="0">Extractamundo Dos!</ui-list-row>
</div>
<div id="routes"></div>`;

/**
 * Every measured value in the component header, in one place, so a drift shows up as
 * one failing assertion with its citation attached rather than as a mystery.
 */
const ORACLE = {
    dark: {
        rowInk: 'rgb(244, 247, 248)',
        ground: 'rgb(14, 19, 23)',
        seam: 'rgb(58, 72, 82)',
    },
    light: {
        rowInk: 'rgb(23, 26, 28)',
        ground: 'rgb(242, 243, 243)',
        seam: 'rgb(203, 208, 211)',
    },
    /* Theme-independent, from the same records. */
    rowMinHeight: '64px',
    rowPaddingLeft: '24px',
    rowFontSize: '20px',
    rowFontWeight: '400',
    rowRadius: '0px',
    rowBorderWidth: '0px',
    titleLineBox: 30,

    selectedWeight: '500',
};

const DIAL_PROPERTIES = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];

/** Everything else worth comparing between a selected row and an unselected one. */
const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-list-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-list-row must mount without throwing');
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

        test('drill: the row geometry reads --ui-list-row and --ui-space-5', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-list-row',
                value: '37px',
                selector: '#plain',
                property: 'min-height',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#plain',
                property: 'padding-left',
            });
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '37px',
                selector: '#plain',
                property: 'min-height',
            });
        }));

        test('drill: --ui-fascia is the row ground', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#plain',
                property: 'background-color',
            });
        }));

        test('drill: the title reads --ui-text-lg and --ui-weight-regular', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-lg',
                value: '37px',
                selector: '#plain >>> #title',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-regular',
                value: '700',
                selector: '#plain >>> #title',
                property: 'font-weight',
            });
        }));

        test('drill: the two gaps are --ui-space-3 (row) and --ui-space-2 (lead)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: '37px',
                selector: '#chip',
                property: 'gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '37px',
                selector: '#chip >>> #lead',
                property: 'gap',
            });
        }));

        test('the selected row is painted by the four dials and nothing else', () => mounted(async (page) => {
            const result = await assertOneSelectionTreatment(page, {
                selected: '#picked',
                unselected: '#unpicked',
            });
            assert.ok(result.face && result.ink, 'the dials must resolve to real values');
        }));

        test('NO PRIVATE SELECTED LOOK: the only differences are the five dial properties',
            () => mounted(async (page) => {
                const picked = await page.computed('#picked', NON_DIAL_PROPERTIES);
                const unpicked = await page.computed('#unpicked', NON_DIAL_PROPERTIES);
                const differing = Object.keys(picked).filter((k) => picked[k] !== unpicked[k]);

                assert.deepEqual(differing, ['border-top-color'],
                    'a selected row differs from an unselected one somewhere other than the '
                    + 'five dials — that is a sixth selection treatment starting');
                for (const [name, row] of [['selected', picked], ['unselected', unpicked]]) {
                    assert.equal(row['border-top-width'], '0px',
                        `the ${name} row has no border to colour`);
                    assert.equal(row['border-left-width'], '0px');
                    assert.equal(row['border-bottom-width'], '0px');
                }
                const inks = await Promise.all(['#picked', '#unpicked'].map((s) => page.computed(s, ['color', 'border-top-color'])));
                for (const ink of inks) {
                    assert.equal(ink['border-top-color'], ink.color,
                        'border-top-color is the initial currentColor, not a declaration');
                }

                const weight = await page.prop('#picked >>> #title', 'font-weight');
                const restingWeight = await page.prop('#unpicked >>> #title', 'font-weight');
                assert.equal(weight, ORACLE.selectedWeight,
                    'the selected title is Slate\'s 500');
                assert.equal(restingWeight, ORACLE.rowFontWeight,
                    '[i=21] — an unselected title is Slate\'s 400');
                assert.equal(weight, await page.resolveToken('--ui-selected-weight', 'font-weight'),
                    'the 500 is READ from the dial, not written in this component');

                // And the leading bar: no pseudo-element paints anything on a selected row.
                for (const pseudo of ['::before', '::after']) {
                    const p = await page.computed('#picked', ['content', 'background-color'], { pseudo });
                    assert.equal(p.content, 'none',
                        `draws a ${pseudo} steel bar on the selected row; `
                        + 'the LED dial is the sanctioned expression of that and Slate ships it at 0px');
                }
            }));

        test('the ink dial reaches a slotted row action, by inheritance and by no rule at all',
            () => mounted(async (page) => {
                const ink = await page.resolveToken('--ui-selected-ink', 'color');
                assert.equal(await page.prop('#picked .rowaction', 'color'), ink,
                    'a slotted control on a selected row takes --ui-selected-ink');
                assert.notEqual(await page.prop('#unpicked .rowaction', 'color'), ink,
                    'and an unselected row does not — so this is the dial, not a default');
                assert.equal(
                    await page.prop('#unpicked .rowaction', 'color'),
                    await page.prop('#unpicked', 'color'),
                    'the resting case is inheritance too: the control is exactly the row\'s ink',
                );

                await assertTokenDrill(page, {
                    token: '--ui-selected-ink',
                    value: DRILL_COLOUR,
                    selector: '#picked .rowaction',
                    property: 'color',
                });
            }));

        test('the LED dial draws on the row, composed with a transparent resting slot',
            () => mounted(async (page) => {
                await page.setToken('--ui-selected-led', '37px');
                const shadow = await page.prop('#picked', 'box-shadow');
                await page.setToken('--ui-selected-led', null);

                const segments = shadowSegments(shadow);
                assert.equal(segments.length, 2,
                    'two segments: the resting slot, then the dial');
                assert.match(segments.at(-1), /inset/, 'the LED strip is an inset shadow');
                assert.match(segments.at(-1), /-?37px/, "and it carries the dial's length");
            }));

        test('both spellings of the state select the row, and they are one attribute',
            () => mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');

                // The Lit spelling.
                await page.evalFn(() => {
                    document.getElementById('unpicked').selected = true;
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#unpicked', 'background-color'), face,
                    '.selected = true must select');
                assert.equal(
                    await page.evalFn(() => document.getElementById('unpicked').getAttribute('aria-selected')),
                    'true',
                    'and it must reflect to the aria state — accessibility state and visual '
                    + 'state are the same state (spec Appendix 15)');

                await page.evalFn(() => {
                    document.getElementById('plain').setAttribute('aria-selected', 'true');
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#plain', 'background-color'), face,
                    'aria-selected="true" written by a screen must select too');
                assert.equal(
                    await page.evalFn(() => document.getElementById('plain').selected),
                    true,
                    'and it must arrive back on the property');
            }));

        test("the resting paint is the oracle's measured values, in both themes", () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const row = await page.computed('#plain', ['background-color', 'color']);
                assert.equal(row['background-color'], want.ground,
                    `${theme}: --ui-fascia IS the ground Slate's transparent row sat on `
                    + '(#profile-editor-grid [i=6])');
                assert.equal(row.color, want.rowInk, `${theme}: --ui-text ([i=21] color)`);

                assert.equal(await page.resolveToken('--ui-line', 'color'), want.seam,
                    `${theme}: [i=21] border-top-color — the ink survives the move to a gap`);
            }
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const row = await page.computed('#plain', [
                'min-height', 'padding-left', 'padding-right', 'font-size', 'font-weight',
                'border-top-left-radius', 'border-top-width', 'box-shadow',
            ]);
            assert.equal(row['min-height'], ORACLE.rowMinHeight, '[i=21] 64px');
            assert.equal(row['padding-left'], ORACLE.rowPaddingLeft, '[i=21] 24px');
            assert.equal(row['padding-right'], ORACLE.rowPaddingLeft, 'symmetrical: padding: 0 24px');
            assert.equal(row['font-size'], ORACLE.rowFontSize, '[i=21] 20px');
            assert.equal(row['font-weight'], ORACLE.rowFontWeight, '[i=21] 400');
            assert.equal(row['border-top-left-radius'], ORACLE.rowRadius,
                '[i=21] 0px — rows touch, so the corners are square');
            assert.equal(row['border-top-width'], ORACLE.rowBorderWidth,
                'DEPARTURE 2: the 1px separator is the container gap, not a per-row border');
            assert.equal(row['box-shadow'], 'none', '[i=21] box-shadow = none');

            const rendered = await page.box('#plain');
            assert.equal(Math.round(rendered.height), 64,
                '[i=21] height = 64px — the rendered box, not the rule');

            const title = await page.box('#plain >>> #title');
            assert.equal(Math.round(title.height), ORACLE.titleLineBox,
                '<span> [i=22] height = 30px — 20px × the 1.5 in styles/document.css:64');

        }));

        test('no row in the list draws a separator — the gap does (CONVENTIONS §13)',
            () => mounted(async (page) => {
                const widths = await page.evalFn(() => {
                    const out = [];
                    for (const row of document.querySelectorAll('#list ui-list-row')) {
                        const cs = getComputedStyle(row);
                        out.push([cs.borderTopWidth, cs.borderBottomWidth].join('/'));
                    }
                    return out;
                });
                assert.deepEqual(widths, Array(6).fill('0px/0px'),
                    'bug T2\'s shape — "the > * + * half of the rule can never match" — needs a '
                    + 'per-cell border to exist at all, and there is not one');
            }));

        test('a row inside a clipping list keeps its whole ring (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#plain');
            assert.equal(g.outlineOffset, '-3px',
                '--ui-focus-offset-inset: a list row is flush with its neighbours, so the '
                + 'ring is drawn inside its own box or the list clips it');
            assert.ok(g.clippers.length >= 1,
                'the list must really clip, or this assertion is vacuous');
        }));

        test('the inset offset is one mechanism, and the attribute is the whole of it',
            () => mounted(async (page) => {
                const inset = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return { attr: el.getAttribute('focus-ring'), variant: el.focusVariant };
                });
                assert.deepEqual(inset, { attr: 'inset', variant: 'inset' },
                    'set on connect, and focusVariant reads the real attribute back');

                const g = await assertFocusUnclipped(page, '#plain');
                assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');

                await assertTokenDrill(page, {
                    token: '--ui-focus-offset-inset',
                    value: '-37px',
                    selector: '#plain',
                    property: 'outline-offset',
                    prepare: (p) => p.focusVisible('#plain'),
                });
            }));

        test('a consumer can still ask for the outset ring, and gets exactly one',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    document.getElementById('open').setAttribute('focus-ring', 'outset');
                    return true;
                });
                await page.settle(1);
                const g = await assertFocusUnclipped(page, '#open');
                assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
                assert.equal(
                    await page.evalFn(() => document.getElementById('open').focusVariant),
                    'outset',
                    'focusVariant reports the truth because the attribute is real');
            }));

        test('drill: --ui-steel and --ui-focus-w move the ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#plain',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#plain'),
            });
            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '37px',
                selector: '#plain',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#plain'),
            });
        }));

        test('the row fills its container and reads no viewport', () => mounted(async (page) => {
            const wide = await page.box('#open');
            assert.equal(Math.round(wide.width), 720, 'the row is as wide as #wide');

            const narrow = await page.box('#squeezed');
            assert.equal(Math.round(narrow.width), 240, 'and as wide as #narrow');

            acrossGeometries[geometry.name] = {
                rowHeight: Math.round((await page.box('#plain')).height),
                titleLineBox: await page.box('#plain >>> #title')
                    .then((r) => Math.round(r.height)),
                narrowRowHeight: Math.round(narrow.height),
                paddingLeft: await page.prop('#plain', 'padding-left'),
                titleFontSize: await page.prop('#plain >>> #title', 'font-size'),
            };
        }));

        test('DEPARTURE 4: the title ellipsises rather than shoving a slotted control out',
            () => mounted(async (page) => {
                const title = await page.computed('#squeezed >>> #title',
                    ['overflow-x', 'text-overflow', 'white-space']);
                assert.equal(title['overflow-x'], 'hidden');
                assert.equal(title['text-overflow'], 'ellipsis');
                assert.equal(title['white-space'], 'nowrap');

                const row = await page.box('#squeezed');
                const action = await page.box('#squeezed .rowaction');
                assert.ok(action.right <= row.right + 0.5,
                    `the slotted control was pushed out of the row: row right ${row.right}, `
                    + `control right ${action.right}`);
                assert.ok(action.left >= row.left,
                    'and it is still inside the row on the leading side');
                assert.equal(Math.round(row.height), 64,
                    'one line, always — a list row that wraps stops being a row');
            }));

        test('the row does not squeeze a slotted control below the 48px hit floor',
            () => mounted(async (page) => {
                const got = await assertHitFloor(page, '#squeezed .rowaction', { mode: 'box' });
                assert.equal(got.inline, 48,
                    'the control is exactly the size the stage gave it — the row shrank '
                    + 'the title instead');
                assert.equal(got.block, 48);
            }));

        test('the row grows past its floor rather than clipping a two-line title',
            () => mounted(async (page) => {
                await page.setStyle('#squeezed >>> #title', { 'white-space': 'normal' });
                const grown = await page.box('#squeezed');
                assert.ok(grown.height >= 64,
                    'min-block-size is a FLOOR, not a height — a row with more in it grows');
                const inner = await page.box('#squeezed >>> #lead');
                assert.ok(inner.bottom <= grown.bottom + 0.5,
                    'and nothing is clipped out of the bottom of the row');
            }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            const before = await page.computed('#open', ['min-height', 'padding-left', 'gap']);
            await page.setStyle('#wide', { 'inline-size': '300px' });
            const after = await page.computed('#open', ['min-height', 'padding-left', 'gap']);
            assert.deepEqual(after, before,
                'nothing in this component is size-keyed, so a container change moves the '
                + 'box and not the paint');
            const box = await page.box('#open');
            assert.equal(Math.round(box.width), 300, 'and the box did follow the container');
        }));

        test('P6: four rows built four different ways are one row',
            () => mounted(async (page) => {
                const built = await page.evalFn(() => {
                    const host = document.getElementById('routes');
                    host.innerHTML = '<ui-list-row id="r1">One</ui-list-row>';
                    const r2 = document.createElement('ui-list-row');
                    r2.id = 'r2';
                    r2.textContent = 'Two';
                    host.appendChild(r2);
                    const r3 = document.getElementById('r1').cloneNode(true);
                    r3.id = 'r3';
                    host.appendChild(r3);
                    const r4 = document.createElement('ui-list-row');
                    r4.id = 'r4';
                    r4.setAttribute('aria-selected', 'false');
                    r4.textContent = 'Four';
                    host.appendChild(r4);
                    return ['r1', 'r2', 'r3', 'r4'];
                });
                await page.settle(3);
                assert.deepEqual(built, ['r1', 'r2', 'r3', 'r4']);

                const shapes = await page.evalFn(() => {
                    const out = [];
                    for (const id of ['r1', 'r2', 'r3', 'r4']) {
                        const el = document.getElementById(id);
                        const box = el.getBoundingClientRect();
                        out.push({
                            ids: [...el.shadowRoot.querySelectorAll('[id]')].map((n) => n.id).join(','),
                            slots: [...el.shadowRoot.querySelectorAll('slot')]
                                .map((n) => n.getAttribute('name') ?? '(default)').join(','),
                            h: Math.round(box.height),
                            role: el.getAttribute('role'),
                            focusRing: el.getAttribute('focus-ring'),
                            tabindex: el.getAttribute('tabindex'),
                        });
                    }
                    return out;
                });
                const [first, ...rest] = shapes;
                for (const [i, shape] of rest.entries()) {
                    assert.deepEqual(shape, first,
                        `route ${i + 2} built a row that differs from route 1 — that is P6, and `
                        + 'it should not be reachable through a single component');
                }
                assert.equal(first.slots, '(default),favourite,actions',
                    'every row offers the same three slots in the same order — a screen '
                    + 'cannot get a row with nowhere to put its actions');
                assert.ok(!first.ids.includes('overflow'),
                    'and no row draws a built-in affordance any more (D11)');

                const shared = await page.evalFn(() => {
                    const sheetsOf = (id) => document.getElementById(id).shadowRoot.adoptedStyleSheets;
                    const a = sheetsOf('r1');
                    const b = sheetsOf('r4');
                    const c = document.getElementById('plain').shadowRoot.adoptedStyleSheets;
                    return {
                        count: a.length,
                        sameAsR4: a.length === b.length && a.every((s, i) => s === b[i]),
                        sameAsMarkupRow: a.length === c.length && a.every((s, i) => s === c[i]),
                        ctorShared: document.getElementById('r1').constructor
                            === document.getElementById('plain').constructor
                            && document.getElementById('r1').constructor === customElements.get('ui-list-row'),
                    };
                });
                assert.ok(shared.count >= 2, 'base styles plus the component styles at least');
                assert.ok(shared.sameAsR4 && shared.sameAsMarkupRow,
                    'all rows must share the same CSSStyleSheet objects');
                assert.ok(shared.ctorShared, 'and the same constructor');
            }));

        test('P8/P11 class: no rule from OUTSIDE can repaint the row', () => mounted(async (page) => {
            const props = ['background-color', 'color', 'font-weight', 'min-height', 'padding-left'];
            const beforeRow = await page.computed('#picked', props);
            const beforeTitle = await page.computed('#picked >>> #title', props);
            const beforeLead = await page.computed('#picked >>> #lead', props);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'p11-shell-rule';
                s.textContent = [
                    '#list ui-list-row *, #list ui-list-row span, #list ui-list-row button {',
                    '  background: transparent !important;',
                    '  background-color: transparent !important;',
                    '  color: inherit !important;',
                    '  font-weight: 500 !important;',
                    '  min-height: 89px !important;',
                    '  padding-left: 30px !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            assert.deepEqual(await page.computed('#picked >>> #title', props), beforeTitle,
                'a screen sheet reached into the component and repainted its title');
            assert.deepEqual(await page.computed('#picked >>> #lead', props), beforeLead,
                'a screen sheet reached into the component and repainted its leading group');
            assert.ok(beforeRow['background-color'], 'the host reading is taken for the record');
        }));

        test('DEPARTURE 7: the row states NO role — the list owns the pattern, so it owns the role',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return {
                        role: el.getAttribute('role'),
                        selectedAttr: el.getAttribute('aria-selected'),
                        selectedProp: el.selected,
                        pickedAttr: document.getElementById('picked').getAttribute('aria-selected'),
                        pickedProp: document.getElementById('picked').selected,
                        hostTabindex: el.getAttribute('tabindex'),
                        shadowButtons: el.shadowRoot.querySelectorAll('button').length,
                    };
                });
                assert.deepEqual(shape, {
                    role: null,
                    selectedAttr: 'false',
                    selectedProp: false,
                    pickedAttr: 'true',
                    pickedProp: true,
                    hostTabindex: '0',
                    shadowButtons: 0,
                }, 'Slate\'s role="option" is DISQUALIFIED: that line '
                    + 'is inside bug P12, whose complaint is "non-option children inside the '
                    + 'listbox". The row used to render one itself '
                    + 'and since D11 renders none — but a consumer may still SLOT one, so the '
                    + 'role stays the list\'s to state. aria-selected is reflected in BOTH '
                    + 'states for whatever role arrives.');
            }));

        test('a role the consumer states is left exactly alone, in either direction',
            () => mounted(async (page) => {
                const got = await page.evalFn(async () => {
                    const stage = document.getElementById('list');
                    const made = (attrs) => {
                        const el = document.createElement('ui-list-row');
                        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
                        el.textContent = 'Stated';
                        stage.append(el);
                        return el;
                    };
                    const asOption = made({ role: 'option' });
                    const asRow = made({ role: 'row' });
                    await Promise.all([asOption.updateComplete, asRow.updateComplete]);
                    const out = { option: asOption.getAttribute('role'), row: asRow.getAttribute('role') };
                    asOption.remove();
                    asRow.remove();
                    return out;
                });
                assert.deepEqual(got, { option: 'option', row: 'row' },
                    'the list that built the pattern states the role and the component never argues');
            }));

        test('WHY: stating role="option" over a row carrying an operable slotted control is not free',
            () => mounted(async (page) => {
                await page.send('Accessibility.enable');
                const read = async () => {
                    const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                    const btn = nodes.find((n) => (n.name?.value ?? '') === 'More actions');
                    const option = nodes.find((n) => !n.ignored && n.role?.value === 'option');
                    return {
                        btnIgnored: btn ? btn.ignored === true : true,
                        ownerRole: option?.role?.value ?? null,
                        ownerName: option?.name?.value ?? '',
                    };
                };

                await page.evalFn(() => {
                    document.getElementById('plain').setAttribute('role', 'option');
                    return true;
                });
                await page.settle(2);
                const asOption = await read();
                await page.evalFn(() => {
                    document.getElementById('plain').removeAttribute('role');
                    return true;
                });
                await page.settle(2);
                const asShipped = await read();

                assert.equal(asOption.ownerName, 'Lever Classic demo',
                    'the option announces its own title and nothing else: a labelled '
                    + `affordance no longer folds into it (F-016 #8). Measured: ${JSON.stringify(asOption)}`);
                assert.equal(asOption.btnIgnored, false,
                    'and the slotted control is still a real exposed control with its own '
                    + 'name — the row was named, not the button silenced. THE TAB-STOP COST '
                    + 'IS UNTOUCHED: a focusable non-option child is still P12, which is why '
                    + 'selector-screen slots a <span> with no tabindex and not a <button>');
                assert.equal(asShipped.btnIgnored, false,
                    'as shipped — no role stated — the slotted control is a real exposed button');
                assert.equal(asShipped.ownerName, '',
                    'and no ancestor takes its name over: the row announces its title, once. '
                    + `Measured: ${JSON.stringify(asShipped)}`);
            }));

        test('F-016 #8: a labelled trigger in the actions slot does not enter the row\'s name',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    el.setAttribute('role', 'treeitem');
                    el.setAttribute('provenance', 'Loaded');
                    const trigger = document.createElement('span');
                    trigger.slot = 'actions';
                    trigger.id = 'trigger';
                    trigger.setAttribute('aria-label', 'More actions for Lever Classic demo');
                    trigger.textContent = '⋯';
                    el.append(trigger);
                    return true;
                });
                await page.settle(3);

                await page.send('Accessibility.enable');
                const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                const named = nodes.filter((n) => !n.ignored)
                    .map((n) => ({ role: n.role?.value ?? '', name: n.name?.value ?? '' }));
                const row = named.find((n) => n.role === 'treeitem');

                /* THE ROW'S OWN NAME STAYS CLEAN — the whole point. It is exactly the
                 * string the engine composed before anything was labelled: the title,
                 * then the provenance chip. */
                assert.ok(row, `the row must be exposed as a treeitem — saw ${JSON.stringify(named)}`);
                assert.equal(row.name, 'Lever Classic demo Loaded',
                    'the row announces its own content and nothing else; the affordance\'s '
                    + `name must not be folded in (F-016 #8). Saw ${JSON.stringify(named)}`);
                assert.ok(!row.name.includes('More actions'),
                    'this is the exact string the selector measured and parked on');

                const everyString = nodes.filter((n) => !n.ignored)
                    .flatMap((n) => [n.name?.value, n.value?.value])
                    .filter((s) => typeof s === 'string' && s.trim());
                assert.ok(everyString.includes('More actions for Lever Classic demo'),
                    `the trigger must carry a name of its own — saw ${JSON.stringify(everyString)}`);
            }));

        test('F-016 #8: the row keeps a name a consumer wrote, and stays silent with no role',
            () => mounted(async (page) => {
                const got = await page.evalFn(async () => {
                    const stage = document.getElementById('list');

                    /* A consumer's own label is never overwritten. */
                    const mine = document.createElement('ui-list-row');
                    mine.setAttribute('role', 'treeitem');
                    mine.setAttribute('aria-label', 'The name the screen chose');
                    mine.textContent = 'Something else entirely';
                    stage.append(mine);

                    /* An unroled row is a generic box; naming it would announce a
                     * container on top of the text inside it. */
                    const unroled = document.createElement('ui-list-row');
                    unroled.textContent = 'No role here';
                    stage.append(unroled);

                    await Promise.all([mine.updateComplete, unroled.updateComplete]);
                    const out = {
                        consumerLabel: mine.getAttribute('aria-label'),
                        unroledLabel: unroled.getAttribute('aria-label'),
                    };

                    /* …and the moment a list DOES state a role, the row names itself. */
                    unroled.setAttribute('role', 'treeitem');
                    await new Promise((r) => { setTimeout(r, 0); });
                    out.afterRole = unroled.getAttribute('aria-label');

                    mine.remove();
                    unroled.remove();
                    return out;
                });
                assert.equal(got.consumerLabel, 'The name the screen chose',
                    'a name the consumer wrote is left alone');
                assert.equal(got.unroledLabel, null,
                    'an unroled row writes no aria-label: a name on a generic is announced '
                    + 'on top of the text it already contains');
                assert.equal(got.afterRole, 'No role here',
                    'and it names itself as soon as the list gives it a role');
            }));

        test('the opener state lives on the slotted control, and the host is not a relay',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    // What a menu actually does: write on its own trigger.
                    el.querySelector('#plain-act').setAttribute('aria-expanded', 'true');
                    // And the retired API, written by a consumer that never updated.
                    el.setAttribute('overflow-expanded', 'true');
                    el.setAttribute('overflow-label', 'More actions for Lever Classic demo');
                    return true;
                });
                await page.settle(2);
                const got = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return {
                        triggerExpanded: el.querySelector('#plain-act').getAttribute('aria-expanded'),
                        triggerName: el.querySelector('#plain-act').getAttribute('aria-label'),
                        shadowButtons: el.shadowRoot.querySelectorAll('button').length,
                        hostName: el.getAttribute('aria-label'),
                    };
                });
                assert.deepEqual(got, {
                    triggerExpanded: 'true',
                    triggerName: 'More actions',
                    shadowButtons: 0,
                    hostName: null,
                }, 'the trigger carries its own state and its own name; the retired '
                    + 'attributes are INERT — they render nothing and, critically, the '
                    + 'stale `overflow-label` did NOT become the row\'s own name');
            }));

        test('the retired opt-out is inert, not broken, and a bare row is the default',
            () => mounted(async (page) => {
                assert.equal(await page.exists('#plain >>> #overflow'), false,
                    'no row draws a built-in affordance any more');
                assert.equal(await page.exists('#bare >>> #overflow'), false,
                    'including the one that still asks not to');

                const bare = await page.evalFn(() => {
                    const el = document.getElementById('bare');
                    return {
                        attr: el.hasAttribute('no-overflow'),
                        propDeclared: 'noOverflow' in el,
                        actionsAssigned: el.shadowRoot
                            .querySelector('slot[name="actions"]').assignedNodes().length,
                    };
                });
                assert.deepEqual(bare, { attr: true, propDeclared: false, actionsAssigned: 0 },
                    'the attribute sits on the host doing nothing: Lit observes no property '
                    + 'for it, so a consumer that never updated is INERT rather than broken');

                // And it is not load-bearing geometry in either direction.
                assert.equal(Math.round((await page.box('#bare')).height), 64);
                assert.equal(
                    Math.round((await page.box('#bare')).height),
                    Math.round((await page.box('#unpicked')).height),
                    'a row with a slotted control and one without measure the same',
                );
            }));

        test('a press on a slotted row action announces nothing, and still reaches the list',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    window.__seen = [];
                    window.__clicks = 0;
                    const list = document.getElementById('list');
                    list.addEventListener('overflow', (e) => {
                        window.__seen.push({ target: e.target.id });
                    });
                    list.addEventListener('click', () => { window.__clicks += 1; });
                    return true;
                });
                await page.click('#plain #plain-act');
                await page.settle(2);
                const got = await page.evalFn(() => ({ seen: window.__seen, clicks: window.__clicks }));
                assert.deepEqual(got.seen, [],
                    'no `overflow` event exists to hear — the emit went with F-009 and the '
                    + 'affordance that raised it with D11');
                assert.equal(got.clicks, 1,
                    'and the press is NOT swallowed: it reaches the list, which is how the '
                    + 'row a menu acts on gets selected. The row adds no listener and no '
                    + 'stopPropagation to a slotted control, so this is bubbling and nothing '
                    + 'else — the same behaviour the built-in button had, for the same reason');
            }));

        test('the favourite disc is slotted, placed by the row, and rings itself',
            () => mounted(async (page) => {
                const row = await page.box('#favoured');
                const disc = await page.box('#favoured .disc');
                const action = await page.box('#favoured .rowaction');
                assert.ok(disc.left > row.left, 'the disc is not crowding the title');
                assert.ok(disc.right <= action.left + 0.5,
                    'and it sits before the row actions, as Slate orders them '
                    + 'then :886)');
                assert.equal(Math.round(action.right), Math.round(row.right - 24),
                    'row actions end on the row\'s own 24px inset ([i=21] padding) — '
                    + 'the row owns the placement even though it does not own the control');

                // An empty favourite slot must not leave a gap behind it.
                const plainLead = await page.box('#plain >>> #lead');
                const plainAction = await page.box('#plain #plain-act');
                assert.equal(
                    Math.round(plainAction.left - plainLead.right), 12,
                    'exactly one --ui-space-3 gap when there is no disc — the slot is '
                    + 'display: contents, so an unassigned slot contributes no flex item');
            }));

        test('the provenance chip is a ui-badge and keeps the badge treatment', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const el = document.getElementById('chip').shadowRoot.getElementById('provenance');
                return { tag: el ? el.tagName : null, text: el ? el.textContent.trim() : null };
            });
            assert.deepEqual(shape, { tag: 'UI-BADGE', text: 'from Adaptive v2' });

            const badge = await page.computed('#chip >>> #provenance >>> #badge',
                ['background-color', 'border-left-width', 'border-top-left-radius']);
            assert.notEqual(badge['background-color'], 'rgba(0, 0, 0, 0)',
                'a badge is its face — background: transparent !important '
                + 'cannot reach it');
            assert.equal(badge['border-left-width'], '0px',
                'and border-left: 1px solid var(--slate-line-strong) cannot either');
            assert.equal(badge['border-top-left-radius'], '6px', '--ui-radius, the badge\'s own');

            assert.equal(await page.exists('#plain >>> #provenance'), false,
                'a row with no provenance renders no chip at all');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            await page.evalFn(() => {
                const root = document.getElementById('plain').shadowRoot;
                const s = document.createElement('style');
                s.textContent = '#title.title { text-overflow: clip }';
                root.appendChild(s);
                return true;
            });
            await page.settle(2);
            assert.equal(await page.prop('#plain >>> #title', 'text-overflow'), 'clip',
                'a later plain rule in the same root must win — no !important in the component');
        }));
    });
}

describe('the same box at both geometries', () => {
    test('every measured width and height is geometry-independent', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have run before this comparison means anything');
        const [first, ...rest] = names;
        for (const name of rest) {
            assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
                `ui-list-row renders differently at ${name} than at ${first} — `
                + 'something read the viewport (spec §2.1 Rule 1)');
        }
    });
});

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-list-row.entry.js');

        assert.equal(entry.id, 'ui-list-row', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-list-row.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const el = document.querySelector('ui-list-row');
                    if (!el || !el.shadowRoot) return null;
                    const title = el.shadowRoot.getElementById('title');
                    if (!title) return null;
                    const r = el.getBoundingClientRect();
                    return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor };
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no row at all`);
                assert.ok(painted.w > 0 && painted.h >= 64,
                    `${entry.id}--${state.id} rendered a ${painted.w}×${painted.h} box`);
                assert.notEqual(painted.bg, 'rgba(0, 0, 0, 0)',
                    `${entry.id}--${state.id} paints no ground — CONVENTIONS §13 trap 1, `
                    + 'a cell that paints nothing is a hole');
            }
        });
    });
});
