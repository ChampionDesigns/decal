/**
 *.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-definition-card.entry.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertScrollFloor,
    DRILL_COLOUR,
    DRILL_LENGTH,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-definition-card.js'];

const GALLERY_MODULE = [...MODULE, '/src/components/ui-button.js'];

const ITEMS = JSON.stringify([
    { term: 'Model', value: 'Bengle' },
    { term: 'Firmware version', value: '282' },
    { term: 'Serial number', value: '888888' },
    { term: 'Group head controller', value: 'Enabled' },
    { term: 'Refill Kit', value: 'Enabled' },
    { term: 'Voltage', value: '245 V' },
]);

/** The four shapes absence arrives in, plus the one that is NOT absence. */
const ABSENCE_ITEMS = JSON.stringify([
    { term: 'Model', value: null },
    { term: 'Firmware version', value: '' },
    { term: 'Serial number', value: { noReading: true, reason: 'absent' } },
    { term: 'Refill Kit', value: { noReading: true, reason: 'permanent' } },
    { term: 'Voltage', value: 0 },
    { term: 'Group head controller', value: 'Enabled' },
]);

const MARKUP = `
    <style>
      #stage { inline-size: 900px; }
      button.action {
          font: inherit;
          color: inherit;
          background: none;
          border: 0;
          padding-inline: var(--ui-space-5);
          min-block-size: var(--ui-control-h);
      }
    </style>
    <div id="stage">
      <ui-definition-card id="defs" heading="Machine" items='${ITEMS}'>
        <button class="action" id="copy" slot="actions">Copy all</button>
      </ui-definition-card>
    </div>`;

const bare = (attrs = '', items = ITEMS) => `
    <style>#stage { inline-size: 900px; }</style>
    <div id="stage">
      <ui-definition-card id="defs" ${attrs} items='${items}'></ui-definition-card>
    </div>`;

const HOST = '#defs';
/** The composed #8 instance, and #8's own paint box one boundary further in. */
const CARD = '#defs >>> #surface';
const PAINT = '#defs >>> #surface >>> #card';
const STACK = '#defs >>> #stack';
const LIST = '#defs >>> #list';
const HEAD = '#defs >>> #head';
const HEADING = '#defs >>> #heading';
const row = (i) => `#defs >>> #row-${i}`;
const term = (i) => `#defs >>> #term-${i}`;
const value = (i) => `#defs >>> #value-${i}`;
const ACTION = '#copy';

/** Rendered lengths at dsf 1.5 are not string-comparable; whole CSS px are. */
const near = (got, want, what, tol = 0.51) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/** Everything a component could paint a state with. Read on every box, so a private
 *  treatment cannot hide on the one element the suite forgot to look at. */
const PAINT_PROPERTIES = [
    'background-color', 'background-image', 'color', 'box-shadow', 'text-shadow',
    'outline-color', 'outline-width', 'border-top-width', 'border-top-color',
    'font-weight', 'opacity',
];

const BOX_SELECTORS = ['#stack', '#head', '#list', '#row-0', '#term-0', '#value-0'];

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-definition-card @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn, markup = MARKUP, modules = MODULE) => browser.withPage(
            { geometry },
            async (page) => {
                await page.mount(markup, modules);
                assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
                return fn(page);
            },
        );

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.equal(env.dpr, geometry.deviceScaleFactor);
            assert.equal(env.w, geometry.width);
        }));

        test('the card renders exactly one ui-card and no surface of its own',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    return {
                        cards: root.querySelectorAll('ui-card').length,
                        lists: root.querySelectorAll('dl').length,
                        terms: root.querySelectorAll('dt').length,
                        details: root.querySelectorAll('dd').length,
                        groups: root.querySelectorAll('dl > div').length,
                        /* Anything of this component's OWN that could take a click or
                         * a key. One here would be a second widget inside a card. */
                        strays: root.querySelectorAll('button, input, a[href], [tabindex]').length,
                    };
                });
                assert.equal(shape.cards, 1, 'one #8, not a second surface');
                assert.equal(shape.lists, 1, 'one description list');
                assert.equal(shape.terms, 6);
                assert.equal(shape.details, 6);
                assert.equal(shape.groups, 6, 'div-wrapped dt/dd groups — the dl content model');
                assert.equal(shape.strays, 0,
                    'the header action is SLOTTED (Slate\'s "Copy all"); this component builds no control');
            }));

        test('the paint, the radius and the inset are #8\'s, not a second copy',
            () => mounted(async (page) => {
                const cardPaint = await page.computed(PAINT, [
                    'background-color', 'border-top-width', 'border-top-color',
                    'border-top-left-radius', 'padding-left', 'box-shadow',
                ]);
                assert.equal(cardPaint['background-color'], await page.resolveToken('--ui-key', 'background-color'));
                assert.equal(cardPaint['border-top-color'], await page.resolveToken('--ui-line', 'border-top-color'));
                near(parseFloat(cardPaint['border-top-width']), 1, 'the card hairline is --ui-border-w');
                near(parseFloat(cardPaint['border-top-left-radius']), 6, '--ui-radius');
                near(parseFloat(cardPaint['padding-left']), 24, '--ui-space-5, Slate\'s measured p-6');
                assert.equal(cardPaint['box-shadow'], 'none', 'the oracle reads box-shadow: none on every card');

                /* And the component's own boxes paint no surface of their own. */
                const own = await page.computed(STACK, ['border-top-left-radius', 'box-shadow']);
                near(parseFloat(own['border-top-left-radius']), 0, 'the stack draws no second radius');
                assert.equal(own['box-shadow'], 'none');
            }));

        test('term and value carry the measured type roles', () => mounted(async (page) => {
            const t = await page.computed(term(0), ['font-size', 'font-weight', 'color']);
            near(parseFloat(t['font-size']), 20, 'CITE .slate-heading [i=50] font-size = 20px');
            assert.equal(t['font-weight'], '500', 'CITE .slate-heading [i=50] font-weight = 500');
            assert.equal(t.color, await page.resolveToken('--ui-text', 'color'),
                'CITE .slate-heading [i=50] color ← var(--slate-text) = --ui-text');

            const v = await page.computed(value(0), ['font-size', 'font-weight', 'font-variant-numeric']);
            near(parseFloat(v['font-size']), 17, 'CITE .slate-body [i=51] font-size = 17px');
            assert.equal(v['font-weight'], '400', 'CITE .slate-body [i=51] font-weight = 400');
            assert.ok(v['font-variant-numeric'].includes('tabular-nums'),
                '.slate-numeric is on every value in the oracle card, "Bengle" included');
        }));

        test('the title is a real heading at the level it is given', () => mounted(async (page) => {
            const read = () => page.evalFn(() => {
                const h = document.getElementById('defs').shadowRoot.getElementById('heading');
                return h ? h.tagName : null;
            });
            assert.equal(await read(), 'H2', 'the default level');

            await page.evalFn(() => { document.getElementById('defs').level = 3; });
            await page.settle(2);
            assert.equal(await read(), 'H3');

            /* An unknown level falls back rather than blanking the heading — the same
             * shape base.js uses for focus-ring and #16 for level. */
            await page.evalFn(() => { document.getElementById('defs').level = 9; });
            await page.settle(2);
            assert.equal(await read(), 'H2');

            /* No heading, no heading element (#16's rule). */
            await page.evalFn(() => { document.getElementById('defs').heading = ''; });
            await page.settle(2);
            assert.equal(await read(), null);
        }));

        test('token drill: --ui-key is the row ground', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-key', value: DRILL_COLOUR, selector: row(0), property: 'background-color',
        })));

        test('token drill: --ui-line is the seam ink', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-line', value: DRILL_COLOUR, selector: LIST, property: 'background-color',
        })));

        test('token drill: --ui-seam is the divider width', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-seam', value: DRILL_LENGTH, selector: LIST, property: 'row-gap',
        })));

        test('token drill: --ui-space-4 is the row inset', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-space-4', value: DRILL_LENGTH, selector: row(0), property: 'padding-top',
        })));

        test('token drill: --ui-space-5 is the term/value gutter', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-space-5', value: DRILL_LENGTH, selector: row(0), property: 'column-gap',
        })));

        test('token drill: --ui-control-h is the header floor', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-control-h', value: DRILL_LENGTH, selector: HEAD, property: 'min-height',
        })));

        test('token drill: --ui-text-lg sizes the term', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-text-lg', value: DRILL_LENGTH, selector: term(0), property: 'font-size',
        })));

        test('token drill: --ui-text-base sizes the value', () => mounted((page) => assertTokenDrill(page, {
            token: '--ui-text-base', value: DRILL_LENGTH, selector: value(0), property: 'font-size',
        })));

        test('every box in the component has zero border on all four sides',
            () => mounted(async (page) => {
                const props = [
                    'border-top-width', 'border-right-width',
                    'border-bottom-width', 'border-left-width',
                ];
                for (const sel of BOX_SELECTORS) {
                    const got = await page.computed(`#defs >>> ${sel}`, props);
                    for (const p of props) {
                        near(parseFloat(got[p]), 0,
                            `${sel} { ${p} } — the divider is the grid gap; a per-row border is what T2 got wrong`);
                    }
                }
            }));

        test('the seams are grid gaps of --ui-seam over --ui-line, on both grids',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const ink = await page.resolveToken('--ui-line', 'background-color');

                for (const sel of [STACK, LIST]) {
                    const got = await page.computed(sel, ['row-gap', 'column-gap', 'background-color', 'display']);
                    assert.equal(got.display, 'grid', `${sel} is the seam grid itself`);
                    near(parseFloat(got['row-gap']), seam, `${sel} row-gap is --ui-seam`);
                    near(parseFloat(got['column-gap']), 0, `${sel} rules its rows, not its columns`);
                    assert.equal(got['background-color'], ink,
                        `${sel} ground is --ui-line — CITE .slate-hairline border-top-color, both themes`);
                }
            }));

        test('six rows give five seams, and each is exactly one --ui-seam wide',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const rects = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    return [...root.querySelectorAll('dl > div')]
                        .map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
                });
                assert.equal(rects.length, 6);
                for (let i = 1; i < rects.length; i++) {
                    near(rects[i].top - rects[i - 1].bottom, seam,
                        `the gap between row ${i - 1} and row ${i} IS the divider`);
                }
            }));

        test('departure 2: the header gets its seam too — six seams for seven rows',
            () => mounted(async (page) => {
                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const gap = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    const head = root.getElementById('head').getBoundingClientRect();
                    const first = root.querySelector('dl > div').getBoundingClientRect();
                    return first.top - head.bottom;
                });
                near(gap, seam, 'the header/first-row seam is drawn, and is the same one ink and width');
            }));

        test('a header with neither title nor action is removed from the grid, not left empty',
            () => mounted(async (page) => {
                const head = await page.computed(HEAD, ['display']);
                assert.equal(head.display, 'none', 'no phantom row, therefore no phantom seam');

                const seam = parseFloat(await page.resolveValue('var(--ui-seam)', 'width'));
                const gaps = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    const list = root.getElementById('list').getBoundingClientRect();
                    const stack = root.getElementById('stack').getBoundingClientRect();
                    return { listTop: list.top, stackTop: stack.top };
                });
                near(gaps.listTop - gaps.stackTop, 0, 'the list starts at the stack — the empty head takes no track');

                /* And it comes back the moment content arrives: the slot lives inside
                 * a display:none box, and slot assignment is a DOM operation, not a
                 * layout one, so slotchange still fires. */
                await page.evalFn(() => {
                    const b = document.createElement('button');
                    b.setAttribute('slot', 'actions');
                    b.id = 'late';
                    b.textContent = 'Copy all';
                    document.getElementById('defs').appendChild(b);
                });
                await page.settle(3);
                const after = await page.computed(HEAD, ['display']);
                assert.equal(after.display, 'flex', 'a slotted action alone is enough to make the header a row');
                assert.notEqual(seam, 0);
            }, bare('')));

        test('a data row is 62px and the pitch is 63px, from tokens rather than a literal',
            () => mounted(async (page) => {
                const first = await page.box(row(0));
                const second = await page.box(row(1));
                near(first.height, 62, 'the data row content box');
                near(second.top - first.top, 63, 'the row pitch — CITE 425 → 488 → 551 → 614 → 677');
            }));

        test('the whole card is 492px tall — the oracle\'s own number, reached from tokens',
            () => mounted(async (page) => {
                const host = await page.box(HOST);
                near(host.height, 492, 'the machine-info card\'s total height');
            }));

        test('the type carries to the pixel — six term widths and six value widths',
            () => mounted(async (page) => {
                const measured = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    const w = (el) => el.getBoundingClientRect().width;
                    return {
                        /* The dt fills its flex line, so the glyph run is measured on
                         * a range rather than on the box. */
                        terms: [...root.querySelectorAll('dt')].map((el) => {
                            const r = document.createRange();
                            r.selectNodeContents(el);
                            return r.getBoundingClientRect().width;
                        }),
                        values: [...root.querySelectorAll('dd .text')].map(w),
                    };
                });
                const ORACLE_TERMS = [58.1875, 159.688, 130.469, 203.781, 78.1875, 71.8594];
                const ORACLE_VALUES = [54.6406, 30.6094, 61.2031, 63.1406, 63.1406, 46.2031];
                for (let i = 0; i < ORACLE_TERMS.length; i++) {
                    near(measured.terms[i], ORACLE_TERMS[i], `term ${i} advance width`, 1);
                    near(measured.values[i], ORACLE_VALUES[i], `value ${i} advance width`, 1);
                }
            }));

        test('the header row holds --ui-control-h with or without an action',
            () => mounted(async (page) => {
                const withAction = await page.box(HEAD);
                near(withAction.height, 64, 'with the slotted action, as Slate measures it');
                near((await page.box(HEADING)).height, 26,
                    '.ui-heading is 20px at line-height 1.3 — CITE .slate-heading [i=48] h=26');
            }));

        test('departure 3: the floor holds when nothing is slotted into the header',
            () => mounted(async (page) => {
                const head = await page.box(HEAD);
                near(head.height, 64,
                    'Slate\'s 64 is a button\'s height leaking into a row; here it is a stated floor');
            }, bare('heading="Machine"')));

        test('the same stated container gives the same numbers whatever the viewport',
            () => mounted(async (page) => {
                const host = await page.box(HOST);
                near(host.width, 900, 'the host fills its stated container');
                const listBox = await page.box(LIST);
                near(listBox.width, 900 - 2 * 24 - 2 * 1,
                    'the rows are inset by #8\'s padding and border — CITE the 1150px rows in a 1200px card');
                near((await page.box(row(0))).height, 62, 'and the row height does not move with the window');
            }));

        test('no rule in the component is keyed to a viewport width', () => mounted(async (page) => {
            const before = await page.box(row(0));
            await page.setGeometry({ ...geometry, width: 640 });
            await page.settle(3);
            const after = await page.box(row(0));
            await page.setGeometry(geometry);
            near(after.width, before.width, 'row width followed the window instead of the container');
            near(after.height, before.height, 'row height followed the window instead of the container');
        }));

        test('null, empty and NO_READING all render the dash with a sentence beside it',
            () => mounted(async (page) => {
                const read = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    return [...root.querySelectorAll('dd')].map((dd) => ({
                        text: (dd.textContent || '').trim(),
                        glyph: (dd.querySelector('.text') || {}).textContent || '',
                        glyphHidden: dd.querySelector('.text')?.getAttribute('aria-hidden') === 'true',
                        a11y: (dd.querySelector('.a11y') || {}).textContent || '',
                    }));
                });

                for (const i of [0, 1, 2, 3]) {
                    assert.equal(read[i].glyph, '—',
                        `row ${i}: absence renders the em dash, never a recomputed number (A7)`);
                    assert.ok(read[i].glyphHidden,
                        `row ${i}: the dash is a glyph standing for a sentence, so it is hidden from the a11y tree`);
                    assert.equal(read[i].a11y.toLowerCase(), 'no reading',
                        `row ${i}: and the sentence is exposed instead`);
                }

                /* THE ONE THAT MUST NOT BE A DASH. reading.js:12 — "never … a zero
                 * that reads as a measurement" cuts both ways: a zero that reads as
                 * an absence is the same lie inverted. */
                assert.equal(read[4].glyph, '0', 'zero IS a reading');
                assert.equal(read[4].a11y, '', 'and takes no absence sentence');
                assert.equal(read[5].glyph, 'Enabled');
                assert.equal(read[5].a11y, '');
            }, bare('heading="Machine"', ABSENCE_ITEMS)));

        test('the absent sentence is announced, not hidden — the visuallyHidden treatment',
            () => mounted(async (page) => {
                const a11y = await page.computed('#defs >>> #value-0 .a11y', [
                    'position', 'width', 'height', 'display', 'visibility', 'clip-path',
                ]);
                assert.notEqual(a11y.display, 'none', 'display:none takes it out of the a11y tree');
                assert.notEqual(a11y.visibility, 'hidden');
                near(parseFloat(a11y.width), 1, 'the 1px box of the one visually-hidden treatment');
                assert.ok(a11y['clip-path'].includes('inset'), 'clipped, not sized to zero');
            }, bare('heading="Machine"', ABSENCE_ITEMS)));

        test('a slotted action takes the one ring and nothing clips it',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, ACTION);
            }));

        test('in scroll mode the card takes a tab stop and draws the ring inside its own box',
            () => mounted(async (page) => {
                await page.setStyle(HOST, { 'max-block-size': '160px' });
                await page.settle(2);
                await assertFocusUnclipped(page, PAINT);
            }, MARKUP.replace('id="defs"', 'id="defs" scroll')));

        test('container floor: squeezed to 200px the rows wrap, and nothing clips or scrolls sideways',
            () => mounted(async (page) => {
                await page.setStyle('#stage', { 'inline-size': '200px' });
                await page.settle(3);

                const host = await page.box(HOST);
                near(host.width, 200, 'the card tracks its container down — nothing here pins a width');

                for (const sel of [PAINT, STACK, LIST, row(0), row(3)]) {
                    const m = await page.metrics(sel);
                    assert.ok(m.scrollWidth <= m.clientWidth + 1,
                        `${sel} overflows sideways (scroll ${m.scrollWidth} vs client ${m.clientWidth}) — `
                        + 'spec §2.4 bans content silently removed, and a card must never scroll horizontally');
                }

                const wrapped = await page.box(row(3));
                assert.ok(wrapped.height > 62.5,
                    `the row must grow when it wraps, got ${wrapped.height}`);
                const t = await page.box(term(3));
                const v = await page.box(value(3));
                assert.ok(v.top >= t.bottom - 0.5,
                    'the value moved to its own line rather than overlapping the term');
            }));

        test('scroll floor: capped from outside it scrolls with a VISIBLE scrollbar, above a stated floor',
            () => mounted(async (page) => {
                const floor = parseFloat(await page.resolveValue('var(--ui-control-h)', 'height'));
                await assertScrollFloor(page, {
                    selector: PAINT,
                    squeezeSelector: HOST,
                    squeeze: { 'max-block-size': '140px' },
                    minBlockSize: floor,
                });
            }, MARKUP.replace('id="defs"', 'id="defs" scroll')));

        test('Slate\'s own selectors, with force, reach nothing inside the root',
            () => mounted(async (page) => {
                const before = {};
                for (const sel of BOX_SELECTORS) {
                    before[sel] = await page.computed(`#defs >>> ${sel}`, PAINT_PROPERTIES);
                }

                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.textContent = `
                        .slate-card, .slate-hairline, .border-t, .flex, .cell, .row,
                        .head, .list, .stack, .term, .value, .heading,
                        dl, dt, dd, #stage div, #stage span,
                        ui-definition-card * {
                            border-top-width: 9px !important;
                            border-top-style: solid !important;
                            background-color: rgb(255, 0, 0) !important;
                            padding-top: 3px !important;
                            font-weight: 900 !important;
                            box-shadow: 0 0 0 4px rgb(0, 255, 0) !important;
                        }`;
                    document.head.appendChild(s);
                });
                await page.settle(3);

                const slotted = await page.computed(ACTION, ['border-top-width']);
                near(parseFloat(slotted['border-top-width']), 9,
                    'the injected sheet is not in force — the rest of this test would be vacuous');

                for (const sel of BOX_SELECTORS) {
                    const after = await page.computed(`#defs >>> ${sel}`, PAINT_PROPERTIES);
                    assert.deepEqual(after, before[sel],
                        `${sel} moved under a document sheet — the shadow boundary is what ends the shell override`);
                }
            }));

        test('turning all four selection dials moves nothing — this component picks nothing',
            () => mounted(async (page) => {
                const before = {};
                for (const sel of BOX_SELECTORS) {
                    before[sel] = await page.computed(`#defs >>> ${sel}`, PAINT_PROPERTIES);
                }

                for (const dial of ['--ui-selected-face', '--ui-selected-ink']) {
                    await page.setToken(dial, DRILL_COLOUR);
                }
                await page.setToken('--ui-selected-led', DRILL_LENGTH);
                await page.setToken('--ui-selected-glow', '80%');
                await page.settle(2);

                /* THE CONTROL: the dials really are set, so "nothing moved" is the
                 * component's answer and not setToken's. */
                assert.equal(await page.tokenValue('--ui-selected-face'), DRILL_COLOUR);
                assert.equal(await page.tokenValue('--ui-selected-led'), DRILL_LENGTH);

                for (const sel of BOX_SELECTORS) {
                    const after = await page.computed(`#defs >>> ${sel}`, PAINT_PROPERTIES);
                    assert.deepEqual(after, before[sel],
                        `${sel} answered a selection dial — a definition card selects nothing, `
                        + 'and a private "selected" look is what the four dials exist to prevent');
                }

                const states = await page.evalFn(() => (
                    document.getElementById('defs').shadowRoot.querySelectorAll(
                        '[aria-pressed], [aria-selected], [aria-checked], [aria-current], .is-selected, [selected]',
                    ).length
                ));
                assert.equal(states, 0, 'and it carries no selection state to paint');
            }));

        test('the card is a named group and the list is a description list',
            () => mounted(async (page) => {
                const group = await page.evalFn(() => {
                    const card = document.getElementById('defs').shadowRoot.getElementById('surface');
                    const box = card.shadowRoot.getElementById('card');
                    return { role: box.getAttribute('role'), name: box.getAttribute('aria-label') };
                });
                assert.equal(group.role, 'group', 'a card with a name is a labelled group (#8\'s own rule)');
                assert.equal(group.name, 'Machine', 'the title names the group when no label is given');

                const dl = await page.evalFn(() => {
                    const root = document.getElementById('defs').shadowRoot;
                    const list = root.getElementById('list');
                    const groups = [...list.querySelectorAll(':scope > div')];
                    return {
                        tag: list.tagName,
                        pairs: groups.map((g) => [
                            g.querySelector('dt')?.textContent,
                            g.querySelector('dd') ? 1 : 0,
                        ]),
                    };
                });
                assert.equal(dl.tag, 'DL');
                assert.deepEqual(dl.pairs.map((p) => p[1]), [1, 1, 1, 1, 1, 1],
                    'every term has exactly one detail — the pairing IS the semantics here');
                assert.deepEqual(dl.pairs.map((p) => p[0]), [
                    'Model', 'Firmware version', 'Serial number',
                    'Group head controller', 'Refill Kit', 'Voltage',
                ]);
            }));

        test('an explicit label wins over the title for the group name', () => mounted(async (page) => {
            await page.evalFn(() => { document.getElementById('defs').label = 'Machine information'; });
            await page.settle(2);
            const name = await page.evalFn(() => (
                document.getElementById('defs').shadowRoot.getElementById('surface')
                    .shadowRoot.getElementById('card').getAttribute('aria-label')
            ));
            assert.equal(name, 'Machine information');
        }));

        test('a malformed row renders visibly rather than vanishing', () => mounted(async (page) => {
            await page.evalFn(() => {
                document.getElementById('defs').items = [
                    { term: 'Model', value: 'Bengle' },
                    null,
                    'Voltage',
                    { value: '245 V' },
                ];
            });
            await page.settle(2);
            const rows = await page.evalFn(() => (
                [...document.getElementById('defs').shadowRoot.querySelectorAll('dl > div')]
                    .map((g) => [g.querySelector('dt').textContent, g.querySelector('dd').textContent.trim()])
            ));
            assert.equal(rows.length, 4, 'four rows in, four rows out — nothing is silently removed');
            assert.deepEqual(rows[1][0], '', 'a hole keeps its place, with an empty term and a dash');
            assert.equal(rows[2][0], 'Voltage');
            assert.equal(rows[3][0], '', 'a row with no term is visible and fixable; a dropped one is not');
        }));

        test('every gallery state mounts and renders one card', () => mounted(async (page) => {
            assert.equal(galleryEntry.id, 'ui-definition-card');
            assert.ok(galleryEntry.states.length >= 6);
            const seen = new Set();
            for (const state of galleryEntry.states) {
                assert.ok(!seen.has(state.id), `duplicate gallery state id ${state.id}`);
                seen.add(state.id);
                await page.mount(`<div id="stage">${state.html}</div>`, GALLERY_MODULE);
                assert.deepEqual(page.pageErrors, [], `gallery state ${state.id} threw on mount`);
                const cards = await page.evalFn(() => (
                    [...document.querySelectorAll('ui-definition-card')]
                        .map((el) => el.shadowRoot.querySelectorAll('ui-card').length)
                ));
                assert.ok(cards.length > 0, `gallery state ${state.id} renders no card`);
                for (const n of cards) assert.equal(n, 1, `gallery state ${state.id}: one #8 per card`);
            }
        }, `<div id="stage"></div>`, GALLERY_MODULE));
    });
}
