/**
 * ui-card-grid.render.test.mjs — Gate A for component #51 (wave 4, settings compounds).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — and asserts only on computed style, box geometry and behaviour,
 * never on source text.
 *
 * THIS ROW CARRIES NO BUG IDS. `waves/4/ITEMS.json` #51 has `"bugs": []`, so there is
 * no "assertion per row bug id" to write and none is invented. What IS written is the
 * defect class this compound's territory can no longer express, cited: Slate builds the
 * same 2-up card grid twice in one screen with two different gaps (14px on
 * settings-display-skin, 12px on settings-accessories-usb-charger — rect arithmetic
 * quoted in ui-card-grid.js), which is §7.5 T20 ("Fourteen distinct gap-[Npx] literals
 * pass through the shell's rhythm rules untouched") and T14 ("Seven contradictory
 * declaration pairs"). Sections 6 and 7 below make both inexpressible by measurement
 * rather than by assertion-on-source: two instances in one page, two column modes and
 * two geometries all produce one gap, and that gap tracks one token.
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. structure — one box, no cell constructed, no control of its own;
 *   2. token drill — the one gap token, on both axes, and the track expression proved
 *      to read the same slot rather than a second copy of the number;
 *   3. dial drill, in its NEGATIVE form — selection does not exist in this component,
 *      so the drill is that the four dials move nothing here and still reach the cell;
 *   4. focus-unclipped — a slotted cell's ring, which the grid must not clip;
 *   5. container floor — the §2.3-case-4 cell floor, the 2-up → 1-up crossover derived
 *      from tokens, and no overflow at any width;
 *   6. T20 / T14 dead: one gap, everywhere, from one token;
 *   7. T1 / T21 dead: the grid declares no measure of its own;
 *   8. the aria contract, and the `columns` fallback.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, assertFocusUnclipped, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/ui-card-grid.entry.js';

/* #8 is wave 1 and long finished, so mounting real cards as the cells is safe here in
 * a way importing a SIBLING builder's wave-4 component would not be. The row is
 * "small | #8" (SCOPE.md:1643) and the cells are what makes that dependency real. */
const MODULE = ['/src/components/ui-card-grid.js', '/src/components/ui-card.js'];

const SKINS = '#skins';
const UPDATES = '#updates';
const GRID = '#skins >>> #grid';
const UPDATES_GRID = '#updates >>> #grid';

/* A DEFINITE CONTAINER IS THE WHOLE FIXTURE. The component reads its own container
 * (spec §2.1 Rule 1), so every number below is a function of #wrap's inline size and of
 * nothing else — which is exactly what the geometry loop is here to prove. #page's
 * padding exists so a focus ring drawn OUTSIDE a cell at the grid's edge has somewhere
 * to be: without it the ring at the left column would sit at a negative x and the
 * clipping check would be measuring the document, not this component. */
const MARKUP = `
<style>
    #page { padding: 24px; }
    #wrap { inline-size: 900px; }
    .pick { font: inherit; color: inherit; background: none; border: 0; padding: 24px; text-align: left; }
    #flexrow { display: flex; margin-block-start: 24px; }
    .remedied { flex: 1 1 0; }
</style>
<div id="page">
    <div id="wrap">
        <ui-card-grid id="skins" label="Installed skins">
            <ui-card id="c0">Streamline.js v0.1.88</ui-card>
            <ui-card id="c1">Beanie v0.3.5 — update available, and this caption is long
                enough to wrap onto a second and very likely a third line at every
                container width this suite measures.</ui-card>
            <ui-card id="c2">NSX v0.4.0</ui-card>
            <button type="button" class="pick" id="pick">Radian v0.1.0</button>
        </ui-card-grid>

        <ui-card-grid id="updates" columns="1">
            <ui-card id="u0">Streamline.js v0.1.88 → v0.1.95</ui-card>
            <ui-card id="u1">Beanie v0.3.5 → v0.3.6</ui-card>
        </ui-card-grid>

        <ui-card-grid id="single">
            <ui-card id="s0">The only skin installed</ui-card>
        </ui-card-grid>
    </div>

    <div id="flexrow">
        <ui-card-grid id="collapsed"><ui-card>An intrinsic-sizing slot</ui-card></ui-card-grid>
        <ui-card-grid id="remedied" class="remedied"><ui-card>flex: 1 1 0</ui-card></ui-card-grid>
    </div>
</div>`;

/** At dsf 1.5 lengths snap to device pixels (CONVENTIONS §10), so rendered lengths are
 *  compared as numbers with a tolerance, never by string equality. */
function near(got, want, what, tol = 0.75) {
    assert.ok(
        Math.abs(got - want) <= tol,
        `${what}: measured ${got}, expected ${want} (tolerance ${tol})`,
    );
}

/** The used track sizes, in order — '594px 594px' → [594, 594]. */
const tracks = (value) => String(value).trim().split(/\s+/).filter(Boolean).map(parseFloat);

/** A custom property's computed value on one element, through the shadow steps. */
const cssVar = (page, selector, name) => page.evalFn(
    (s, n) => getComputedStyle(window.__h.need(s)).getPropertyValue(n).trim(),
    selector, name,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-card-grid @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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

        /* ===================================================================
         * 1. IT IS A LAYOUT AND NOTHING ELSE
         * =================================================================== */

        test('the shadow tree is one grid box and a slot — no cell, no control, no surface',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const root = document.getElementById('skins').shadowRoot;
                    return {
                        boxes: root.querySelectorAll('div').length,
                        slots: root.querySelectorAll('slot').length,
                        cards: root.querySelectorAll('ui-card').length,
                        /* Anything of this component's OWN that could take a click or a
                         * key. One here would be a widget hiding inside a layout. */
                        strays: root.querySelectorAll('button, input, a[href], [tabindex]').length,
                        assigned: root.querySelector('slot').assignedElements().length,
                        hostTabStop: document.getElementById('skins').hasAttribute('tabindex'),
                    };
                });
                assert.equal(shape.boxes, 1, 'one box: the grid');
                assert.equal(shape.slots, 1);
                assert.equal(shape.cards, 0, 'the component constructs no cell — the screen slots them');
                assert.equal(shape.strays, 0);
                assert.equal(shape.assigned, 4, 'the four light-tree cells are the grid items');
                assert.equal(shape.hostTabStop, false, 'a layout takes no tab stop');
            }));

        test('it paints nothing — the surface is #8, and a second one here would be the fork',
            () => mounted(async (page) => {
                for (const sel of [SKINS, GRID]) {
                    const paint = await page.computed(sel, [
                        'background-color', 'background-image', 'border-top-width',
                        'border-top-left-radius', 'box-shadow',
                    ]);
                    assert.equal(paint['background-color'], 'rgba(0, 0, 0, 0)', `${sel} paints no ground`);
                    assert.equal(paint['background-image'], 'none', `${sel} paints no image`);
                    near(parseFloat(paint['border-top-width']), 0, `${sel} border`);
                    near(parseFloat(paint['border-top-left-radius']), 0, `${sel} radius`);
                    assert.equal(paint['box-shadow'], 'none', `${sel} casts nothing`);
                }
            }));

        test('the slot is display: contents, so the CELLS are the grid items',
            () => mounted(async (page) => {
                assert.equal(await page.prop('#skins >>> slot', 'display'), 'contents');
                /* The proof that matters is geometric: if the slot were a box, all four
                 * cells would sit in one track and share one y. */
                const [c0, c1] = [await page.box('#c0'), await page.box('#c1')];
                assert.ok(c1.x > c0.x + 100, 'the first two cells are side by side, in two tracks');
            }));

        /* ===================================================================
         * 2. TOKEN DRILL — ONE GAP TOKEN, BOTH AXES, ONE SLOT
         * =================================================================== */

        test('the column gap is --ui-space-3', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3', value: DRILL_LENGTH,
                selector: GRID, property: 'column-gap',
            });
        }));

        test('the row gap is the same --ui-space-3', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3', value: DRILL_LENGTH,
                selector: GRID, property: 'row-gap',
            });
        }));

        test('the track expression reads the gap SLOT, not a second copy of the number',
            () => mounted(async (page) => {
                /* If the crossover arithmetic carried its own 12, the tracks would not
                 * move when the token does — and the grid would be 2px wrong forever
                 * after any spacing change. (900 - 12) / 2 = 444; (900 - 37) / 2 = 431.5. */
                const before = tracks(await page.prop(GRID, 'grid-template-columns'));
                await page.setToken('--ui-space-3', DRILL_LENGTH);
                const after = tracks(await page.prop(GRID, 'grid-template-columns'));
                await page.setToken('--ui-space-3', null);
                const restored = tracks(await page.prop(GRID, 'grid-template-columns'));

                assert.equal(before.length, 2);
                near(before[0], 444, 'track at the 12px gap');
                assert.equal(after.length, 2);
                near(after[0], 431.5, 'track at the 37px drill gap');
                near(restored[0], 444, 'track after restoring the token');
            }));

        /* ===================================================================
         * 3. DIAL DRILL, NEGATIVE FORM — selection does not exist here
         * =================================================================== */

        test('the four dials move nothing in this component', () => mounted(async (page) => {
            const props = ['background-color', 'color', 'box-shadow', 'text-shadow', 'border-top-width'];
            const dials = ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow'];
            for (const dial of dials) {
                const before = await page.computed(GRID, props);
                await page.setToken(dial, DRILL_COLOUR);
                const after = await page.computed(GRID, props);
                await page.setToken(dial, null);
                assert.deepEqual(
                    after, before,
                    `${dial} moved the grid's own paint — a layout must own no selected look ` +
                    '(wave-4 notes; DECISIONS.md:244, spec §3.9)',
                );
            }
        }));

        test('the dials still reach the CELL through the grid', () => mounted(async (page) => {
            /* The grid host sits in the inheritance path :root → body → #wrap →
             * ui-card-grid → the cell. Declaring a dial on :host would cut the cell off
             * from the one selection mechanism; this is the assertion that it does not. */
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            const seen = await cssVar(page, '#c0', '--ui-selected-face');
            await page.setToken('--ui-selected-face', null);
            assert.equal(seen, DRILL_COLOUR, 'the cell sees the dial the grid never touched');
        }));

        /* ===================================================================
         * 4. FOCUS, UNCLIPPED — bug L24's class
         * =================================================================== */

        test('a slotted cell keeps the one focus ring and the grid does not clip it',
            () => mounted(async (page) => {
                await assertFocusUnclipped(page, '#pick');
            }));

        /* ===================================================================
         * 5. CONTAINER FLOOR — spec §2.3 case 4, and the crossover
         * =================================================================== */

        test('the cell floor holds, the crossover is 2 × floor + gap, and nothing ever overflows',
            () => mounted(async (page) => {
                const gap = parseFloat(await page.prop(GRID, 'column-gap'));
                const floor = parseFloat(await cssVar(page, SKINS, '--_ui-card-grid-min'));
                near(gap, 12, 'the resting gap is --ui-space-3');
                near(floor, 280, 'the resting floor is Appendix 14\'s 280px');

                const crossover = 2 * floor + gap;              /* 572 */
                const widths = [1200, 900, 600, crossover, crossover - 1, floor, floor - 20];

                for (const w of widths) {
                    await page.setStyle('#wrap', { 'inline-size': `${w}px` });
                    const got = tracks(await page.prop(GRID, 'grid-template-columns'));
                    const m = await page.metrics(GRID);

                    if (w >= crossover) {
                        assert.equal(got.length, 2, `${w}px: two tracks — the row's 2-up`);
                        near(got[0], (w - gap) / 2, `${w}px: track width`);
                        assert.ok(got[0] >= floor - 0.75, `${w}px: the cell floor holds (${got[0]} vs ${floor})`);
                    } else {
                        assert.equal(got.length, 1, `${w}px: collapsed to one track`);
                        near(got[0], w, `${w}px: the single track fills the container`);
                    }

                    assert.ok(
                        m.scrollWidth <= m.clientWidth + 0.75,
                        `${w}px: the grid overflows its own container (scroll ${m.scrollWidth} vs client ${m.clientWidth}).\n` +
                        '  min(100%, floor) is the clause that stops a narrow leaf pane growing a ' +
                        'horizontal scrollbar; if this fails, that clause is gone.',
                    );
                }
                await page.setStyle('#wrap', { 'inline-size': '900px' });
            }));

        test('the floor is a documented hook: moving --_ui-card-grid-min moves the crossover',
            () => mounted(async (page) => {
                /* At 900 the resting floor (280) leaves two 444px tracks. Raise the floor
                 * above half the container and the same container is 1-up — the consumer
                 * contract for a cell that needs more room than a skin card. */
                await page.setStyle(SKINS, { '--_ui-card-grid-min': '460px' });
                const raised = tracks(await page.prop(GRID, 'grid-template-columns'));
                await page.setStyle(SKINS, { '--_ui-card-grid-min': null });
                const restored = tracks(await page.prop(GRID, 'grid-template-columns'));

                assert.equal(raised.length, 1, 'a 460px floor does not fit twice in 900px');
                near(raised[0], 900, 'the single track fills the container');
                assert.equal(restored.length, 2, 'and the hook restores');
            }));

        test('the column count is the CONTAINER\'s answer, never the item count',
            () => mounted(async (page) => {
                /* auto-fill, not auto-fit: one card in a 900px container is still a 2-up
                 * grid with an empty second track. auto-fit would collapse it, making the
                 * layout change meaning when somebody adds a sibling — the shape spec
                 * §2.3 bans by name for selectors, for this reason. */
                const one = tracks(await page.prop('#single >>> #grid', 'grid-template-columns'));
                assert.equal(one.length, 2, 'a single cell still sits in a 2-up grid');
                near(one[0], 444, 'and the tracks are the container\'s halves');
            }));

        test('the intrinsic-sizing slot collapses visibly, and the documented remedy fixes it',
            () => mounted(async (page) => {
                /* #8's departure 4, inherited with the base's container-type: a bare flex
                 * item offers no inline size to fill, so the host resolves to 0 and the
                 * content overflows VISIBLY rather than being clipped (spec §2.4). One
                 * declaration at the call site is the whole remedy. */
                const collapsed = await page.box('#collapsed');
                const remedied = await page.box('#remedied');
                near(collapsed.width, 0, 'a bare flex item has no container inline size to fill');
                assert.equal(await page.prop('#collapsed >>> #grid', 'overflow-x'), 'visible',
                    'the degenerate case is visible, never a silent clip');
                assert.ok(remedied.width > 200, `flex: 1 1 0 gives the grid a container (${remedied.width}px)`);
            }));

        /* ===================================================================
         * 6. T20 / T14 — one gap, and two instances cannot disagree
         * =================================================================== */

        test('one gap value: both axes, both column modes, both instances',
            () => mounted(async (page) => {
                const read = async (sel) => {
                    const g = await page.computed(sel, ['column-gap', 'row-gap']);
                    return [parseFloat(g['column-gap']), parseFloat(g['row-gap'])];
                };
                const [skinCol, skinRow] = await read(GRID);
                const [updCol, updRow] = await read(UPDATES_GRID);

                near(skinCol, skinRow, 'the 2-up grid\'s two axes');
                near(updCol, updRow, 'the 1-up list\'s two axes');
                near(skinCol, updCol,
                    'the two instances disagree — this is exactly Slate\'s 14px skin grid ' +
                    'against its 12px charger grid, one screen apart (T20/T14)');
                near(skinCol, 12, 'and the agreed value is --ui-space-3, the §3.3 snap of Slate\'s 14');
            }));

        test('the rendered row pitch is the cell plus one gap and nothing else',
            () => mounted(async (page) => {
                /* Slate's measured pitch is 110 for a 96 card (14) and 96 for an 84 card
                 * (12). Here the pitch is whatever the cells need plus the one gap. */
                const gap = parseFloat(await page.prop(GRID, 'column-gap'));
                const c0 = await page.box('#c0');
                const c2 = await page.box('#c2');
                near(c2.y - (c0.y + c0.height), gap, 'row pitch = cell height + the one gap');
            }));

        test('cells in a row are equal height by construction', () => mounted(async (page) => {
            /* #c1 wraps to several lines and #c0 does not. Slate's ten skin cards are all
             * h=96 only because their content is uniform; align-items: stretch is what
             * makes that a contract rather than a coincidence. */
            const c0 = await page.box('#c0');
            const c1 = await page.box('#c1');
            assert.ok(c1.height > 40, 'the long cell really is the taller content');
            near(c0.height, c1.height, 'the short cell stretches to its row band', 1);
        }));

        test('the flow is row-major, as the oracle measures it', () => mounted(async (page) => {
            /* CITE settings-display-skin .slate-card [i=49] rect x=629 y=479 …
             * CITE settings-display-skin .slate-card [i=54] rect x=1236 y=479 …
             * CITE settings-display-skin .slate-card [i=59] rect x=629 y=589 …
             * across, then down. Geometry FROZEN at 1920×1200 — quoted as reading order,
             * never as a width target. */
            const [c0, c1, c2] = [await page.box('#c0'), await page.box('#c1'), await page.box('#c2')];
            near(c0.y, c1.y, 'the first two cells share a row');
            assert.ok(c1.x > c0.x, 'the second cell is to the right of the first');
            assert.ok(c2.y > c0.y, 'the third cell starts a new row');
            near(c2.x, c0.x, 'and returns to the first column');
        }));

        test('columns="1" is one full-width track, same gap, same flow',
            () => mounted(async (page) => {
                const got = tracks(await page.prop(UPDATES_GRID, 'grid-template-columns'));
                assert.equal(got.length, 1, 'the update list is one column');
                const u0 = await page.box('#u0');
                const u1 = await page.box('#u1');
                near(u0.width, 900, 'the row fills the container');
                near(u0.x, u1.x, 'stacked, not staggered');
                assert.ok(u1.y > u0.y);
            }));

        /* ===================================================================
         * 7. T1 / T21 — no silent second measure
         * =================================================================== */

        test('the grid declares no measure of its own', () => mounted(async (page) => {
            /* T1 is a leaf 63px wider than every other leaf and T21 a third live width
             * "documented nowhere". The leaf measure belongs to the leaf pane (spec §4.4);
             * a layout that also capped its width would be the fourth. */
            for (const sel of [SKINS, GRID, UPDATES, UPDATES_GRID]) {
                const box = await page.computed(sel, ['max-inline-size', 'inline-size', 'margin-inline-start']);
                assert.equal(box['max-inline-size'], 'none', `${sel} caps nothing`);
            }
            const skins = await page.box(SKINS);
            const updates = await page.box(UPDATES);
            near(skins.width, 900, 'the grid is exactly its container');
            near(updates.width, 900, 'and so is the second one');
        }));

        /* ===================================================================
         * 8. THE ARIA CONTRACT AND THE `columns` FALLBACK
         * =================================================================== */

        test('a label makes it a named group; without one it is not a role at all',
            () => mounted(async (page) => {
                const named = await page.evalFn(() => {
                    const g = document.getElementById('skins').shadowRoot.getElementById('grid');
                    return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
                });
                assert.equal(named.role, 'group');
                assert.equal(named.label, 'Installed skins');

                const bare = await page.evalFn(() => {
                    const g = document.getElementById('updates').shadowRoot.getElementById('grid');
                    return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
                });
                assert.equal(bare.role, null, 'an unnamed group is noise in the accessibility tree');
                assert.equal(bare.label, null);
            }));

        test('columns falls back to 2 rather than to a layout nobody chose',
            () => mounted(async (page) => {
                const results = await page.evalFn(async (values) => {
                    const el = document.getElementById('skins');
                    const out = [];
                    for (const v of values) {
                        el.setAttribute('columns', v);
                        await el.updateComplete;
                        out.push({ set: v, got: el.columns, attr: el.getAttribute('columns') });
                    }
                    el.setAttribute('columns', '2');
                    await el.updateComplete;
                    return out;
                }, ['3', '0', 'two', '1', '2']);

                assert.deepEqual(results.map((r) => r.got), [2, 2, 2, 1, 2]);
                assert.deepEqual(results.map((r) => r.attr), ['2', '2', '2', '1', '2'],
                    'the fallback is reflected, so the DOM never disagrees with the layout');
            }));

        test('`columns` shadows nothing standard — the trap #8 documents for `scroll`',
            () => mounted(async (page) => {
                const probe = JSON.parse(await page.eval(
                    'JSON.stringify({onProto: ("columns" in HTMLElement.prototype), '
                    + 'onDiv: typeof document.createElement("div").columns, '
                    + 'onGrid: typeof document.getElementById("skins").columns})',
                ));
                assert.equal(probe.onProto, false);
                assert.equal(probe.onDiv, 'undefined');
                assert.equal(probe.onGrid, 'number', 'the component owns a name nothing standard does');
            }));

        /* ===================================================================
         * 9. THE GALLERY ENTRY IS THE COMPONENT, and its numbers are measured
         * =================================================================== */

        test('every gallery state mounts, and the widths its notes claim are the widths it renders',
            () => mounted(async (page) => {
                /* The entry's states are the capture battery's filenames, so a state
                 * that throws or lies about its own geometry becomes a wrong baseline
                 * rather than a red test. Expected track counts come from the state's
                 * own hostStyle against the crossover, not from a table written twice. */
                for (const state of galleryEntry.states) {
                    const width = parseFloat(state.hostStyle?.['inline-size'] ?? '900px');
                    await page.mount(
                        `<div id="stage" style="inline-size: ${width}px">${state.html}</div>`,
                        MODULE,
                    );
                    assert.deepEqual(page.pageErrors, [], `gallery state ${state.id} threw on mount`);

                    const grids = await page.count('ui-card-grid');
                    assert.equal(grids, 1, `gallery state ${state.id}: one grid`);

                    const gap = parseFloat(await page.prop('ui-card-grid >>> #grid', 'column-gap'));
                    const got = tracks(await page.prop('ui-card-grid >>> #grid', 'grid-template-columns'));
                    const oneUp = state.id === 'update-list' || width < 2 * 280 + gap;

                    assert.equal(got.length, oneUp ? 1 : 2, `gallery state ${state.id}: track count at ${width}px`);
                    near(got[0], oneUp ? width : (width - gap) / 2, `gallery state ${state.id}: track width`);

                    const m = await page.metrics('ui-card-grid >>> #grid');
                    assert.ok(m.scrollWidth <= m.clientWidth + 0.75,
                        `gallery state ${state.id} overflows its stage`);
                }
            }));

        test('no @media and no viewport unit can be at work — the same container gives the same layout at both geometries',
            () => mounted(async (page) => {
                /* The loop runs this at 1281 and at 1000 wide. A 900px container answers
                 * 444|444 at both, so nothing here reads the viewport (spec §2.1 Rule 1). */
                const got = tracks(await page.prop(GRID, 'grid-template-columns'));
                assert.equal(got.length, 2);
                near(got[0], 444, `two 444px tracks at a 900px container, viewport ${geometry.width}`);
            }));
    });
}
