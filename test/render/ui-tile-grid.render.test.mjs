/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, assertFocusUnclipped, DRILL_COLOUR } from '../harness/assertions.js';

const MODULE = ['/src/components/ui-tile-grid.js'];

const GALLERY_MODULE = [...MODULE, '/src/components/ui-card.js'];

const FIXTURE_CSS = `
<style>
    .tile {
        display: block;
        min-height: 80px;
        margin: 0;
        padding: 12px 18px;
        border: 1px solid #cbd0d3;
        background: #f8f9f9;
        font: inherit;
        text-align: left;
    }
    .tile:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    .holder { padding: 24px; }
</style>`;

const tilesFor = (prefix) => Array.from({ length: 8 }, (_, i) =>
    `<button type="button" class="tile" id="${prefix}-t${i}">Tile ${i}</button>`).join('');

const MARKUP = `${FIXTURE_CSS}
<div class="holder" style="inline-size: 1200px"><ui-tile-grid id="g1200">${tilesFor('g1200')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 900px"><ui-tile-grid id="g900">${tilesFor('g900')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 600px"><ui-tile-grid id="g600">${tilesFor('g600')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 300px"><ui-tile-grid id="g300">${tilesFor('g300')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 200px"><ui-tile-grid id="g200">${tilesFor('g200')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="labelled" label="Display language">${tilesFor('labelled')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="authored" role="radiogroup" aria-label="Written by the screen">${tilesFor('authored')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="selection">
        <button type="button" class="tile" id="picked" aria-checked="true" role="radio">Picked</button>
        <button type="button" class="tile" id="unpicked" aria-checked="false" role="radio">Not picked</button>
    </ui-tile-grid>
</div>
<div class="holder" style="inline-size: 300px; block-size: 500px">
    <ui-tile-grid id="tall" style="block-size: 100%">
        <button type="button" class="tile" id="only">Only tile</button>
    </ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="knob" style="--_ui-tile-grid-min: 200px">${tilesFor('knob')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px; --_ui-tile-grid-min: 120px">
    <ui-tile-grid id="inherited">${tilesFor('inherited')}</ui-tile-grid>
</div>
`;

const ORACLE = Object.freeze({
    container: 1200,
    columns: 4,
    track: 291,
    pitch: 303,
    gap: 12,
    min: 280,
});

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

const tracks = async (page, selector) => {
    const value = await page.prop(selector, 'grid-template-columns');
    return value.trim().split(/\s+/).map(parseFloat);
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-tile-grid @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-tile-grid must mount without throwing');
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

        /* -- 0. the fixture is measuring the component, not a collapsed box ---- */

        test('every grid fills the container it was given', () => mounted(async (page) => {
            for (const [id, want] of [['g1200', 1200], ['g900', 900], ['g600', 600], ['g300', 300], ['g200', 200]]) {
                near((await page.box(`#${id}`)).width, want, `#${id} host inline size`);
            }
        }));

        test('at the 1200px leaf the grid is the oracle: 4 tracks of 291 at a 303 pitch', () => mounted(async (page) => {
            const t = await tracks(page, '#g1200');
            assert.equal(t.length, ORACLE.columns, `expected 4 tracks, got ${t.join(' ')}`);
            for (const width of t) near(width, ORACLE.track, 'track width');

            const a = await page.box('#g1200-t0');
            const b = await page.box('#g1200-t1');
            near(b.x - a.x, ORACLE.pitch, 'column pitch');
            near(a.width, ORACLE.track, 'tile inline size');

            const rowTwo = await page.box('#g1200-t4');
            near(rowTwo.y - a.y, a.height + ORACLE.gap, 'row pitch is tile height + gutter');

            acrossGeometries[geometry.name] = {
                tracks: t.map((n) => Math.round(n)),
                pitch: Math.round(b.x - a.x),
                columns900: (await tracks(page, '#g900')).length,
                columns600: (await tracks(page, '#g600')).length,
                columns300: (await tracks(page, '#g300')).length,
                columns200: (await tracks(page, '#g200')).length,
            };
        }));

        test('drill: --ui-space-3 is the gutter, on both axes', () => mounted(async (page) => {
            for (const property of ['column-gap', 'row-gap']) {
                const drill = await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#g1200',
                    property,
                });
                near(drill.before, ORACLE.gap, `resting ${property} is the measured 12px`);
                near(drill.after, 37, `${property} must land on --ui-space-3`);
            }
        }));

        test('drill: the gutter token also moves the LAYOUT, not just the gap property', () => mounted(async (page) => {
            const before = await tracks(page, '#g1200');
            await page.setToken('--ui-space-3', '60px');
            const after = await tracks(page, '#g1200');
            await page.setToken('--ui-space-3', null);
            const restored = await tracks(page, '#g1200');

            assert.equal(before.length, 4, `resting tracks ${before.join(' ')}`);
            // floor((1200 + 60) / (280 + 60)) = 3 tracks of (1200 − 120) / 3 = 360.
            assert.equal(after.length, 3, `at a 60px gutter the grid must re-track, got ${after.join(' ')}`);
            for (const width of after) near(width, 360, 'track width at a 60px gutter');
            assert.deepEqual(restored.map(Math.round), before.map(Math.round), 'the drill must restore');
        }));

        test('drill: --_ui-tile-grid-min is read, not baked in — from the light tree', () => mounted(async (page) => {
            const dflt = await tracks(page, '#g600');
            const knob = await tracks(page, '#knob');

            // 600px, 12px gutter, 280 floor → floor(612/292) = 2 tracks of 294.
            assert.equal(dflt.length, 2, `default min: expected 2 tracks, got ${dflt.join(' ')}`);
            for (const width of dflt) near(width, 294, 'track width at the 280 default');

            assert.equal(knob.length, 2, `200 floor at 600px: expected 2 tracks, got ${knob.join(' ')}`);

            await page.setStyle('#g600', { 'inline-size': '450px' });
            await page.setStyle('#knob', { 'inline-size': '450px' });
            const dfltNarrow = await tracks(page, '#g600');
            const knobNarrow = await tracks(page, '#knob');
            await page.setStyle('#g600', { 'inline-size': null });
            await page.setStyle('#knob', { 'inline-size': null });

            assert.equal(dfltNarrow.length, 1,
                `280 floor at 450px must give one track, got ${dfltNarrow.join(' ')}`);
            assert.equal(knobNarrow.length, 2,
                `200 floor at 450px must give two tracks, got ${knobNarrow.join(' ')}`);
        }));

        test('drill: --_ui-tile-grid-gap is a knob of its own', () => mounted(async (page) => {
            const before = await page.prop('#g600', 'column-gap');
            await page.setStyle('#g600', { '--_ui-tile-grid-gap': '30px' });
            const after = await page.prop('#g600', 'column-gap');
            await page.setStyle('#g600', { '--_ui-tile-grid-gap': null });
            const restored = await page.prop('#g600', 'column-gap');

            near(before, ORACLE.gap, 'the resting gutter');
            near(after, 30, 'the knob moves the gutter');
            near(restored, ORACLE.gap, 'and it restores');
        }));

        test('the knob is NOT inherited from an ancestor — a :host default beats inheritance', () => mounted(async (page) => {
            const outer = await tracks(page, '#inherited');
            assert.equal(outer.length, 2,
                'setting the knob on an ANCESTOR must not reach the host: expected the '
                + `280 default's 2 tracks at 600px, got ${outer.join(' ')}`);
        }));

        test('dial drill, inverted: a slotted aria-checked tile takes nothing from the grid', () => mounted(async (page) => {
            const picked = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
            const unpicked = await page.computed('#unpicked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
            assert.deepEqual(picked, unpicked,
                'the grid contributes paint to a selected child — that is a private selection look');

            // And the four dials move nothing anywhere in the component.
            for (const dial of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                const value = dial === '--ui-selected-glow' ? '60%'
                    : dial === '--ui-selected-led' ? '37px' : DRILL_COLOUR;
                const before = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
                await page.setToken(dial, value);
                const after = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
                await page.setToken(dial, null);
                assert.deepEqual(after, before, `${dial} reached a tile through the grid`);
            }
        }));

        test('the grid declares no colour of its own', () => mounted(async (page) => {
            const got = await page.computed('#g1200', ['background-color', 'background-image', 'border-top-width', 'box-shadow']);
            assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)', 'the grid paints no ground');
            assert.equal(got['background-image'], 'none');
            near(got['border-top-width'], 0, 'the grid draws no border');
            assert.equal(got['box-shadow'], 'none');
        }));

        test('focus-unclipped: a slotted tile keeps the one ring, and nothing clips it', () => mounted(async (page) => {
            await assertFocusUnclipped(page, '#g1200-t0');   // first column, left edge
            await assertFocusUnclipped(page, '#g1200-t3');   // last column, right edge
            await assertFocusUnclipped(page, '#g1200-t4');   // second row
        }));

        test('the gutter is wider than a ring, so two rings never touch', () => mounted(async (page) => {
            const width = parseFloat(await page.resolveValue('var(--ui-focus-w)', 'outline-width'));
            const offset = parseFloat(await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'));
            const gap = parseFloat(await page.prop('#g1200', 'column-gap'));
            assert.ok(gap >= 2 * (width + offset) - 0.5,
                `gutter ${gap}px does not clear two rings of ${width}px at +${offset}px`);
        }));

        test('the grid itself is not a tab stop', () => mounted(async (page) => {
            // A layout box that takes focus puts a stop between every row of tiles.
            const stops = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                return { host: g.getAttribute('tabindex'), inRoot: g.shadowRoot.querySelectorAll('[tabindex]').length };
            });
            assert.equal(stops.host, null);
            assert.equal(stops.inRoot, 0);
        }));

        /* -- 5. the container floor — this component IS its responsive rule ---- */

        test('container floor: the column count is a function of the container, and only of it', () => mounted(async (page) => {
            const expected = [
                ['g1200', 4, 291],
                ['g900', 3, 292],
                ['g600', 2, 294],
                ['g300', 1, 300],
                ['g200', 1, 200],
            ];
            for (const [id, columns, width] of expected) {
                const t = await tracks(page, `#${id}`);
                assert.equal(t.length, columns,
                    `#${id}: expected ${columns} track(s), got ${t.length} (${t.join(' ')})`);
                for (const w of t) near(w, width, `#${id} track width`);
            }
        }));

        test('container floor: below the 280px minimum the grid does not overflow its container', () => mounted(async (page) => {
            for (const id of ['g300', 'g200']) {
                const m = await page.metrics(`#${id}`);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                    `#${id} overflows itself: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`);
                const host = await page.box(`#${id}`);
                const tile = await page.box(`#${id}-t0`);
                assert.ok(tile.x >= host.x - 0.51 && tile.x + tile.width <= host.x + host.width + 0.51,
                    `#${id}: a tile [${tile.x}, ${tile.width}] escapes the grid [${host.x}, ${host.width}]`);

                const t = await tracks(page, `#${id}`);
                assert.equal(t.length, 1, `#${id}: expected one collapsed track, got ${t.join(' ')}`);
                near(t[0], host.width, `#${id}: the collapsed track is the container width`);
            }
        }));

        test('container floor: overflow stays visible — there is no scroll region here', () => mounted(async (page) => {
            const m = await page.metrics('#g1200');
            assert.equal(m.overflowX, 'visible');
            assert.equal(m.overflowY, 'visible');
            const clips = await page.evalFn(() => {
                const root = document.getElementById('g1200').shadowRoot;
                return [...root.querySelectorAll('*')]
                    .map((el) => getComputedStyle(el).overflow)
                    .filter((o) => o !== 'visible');
            });
            assert.deepEqual(clips, [], 'something inside the grid clips');
        }));

        test('container floor: surplus block space does not stretch the rows', () => mounted(async (page) => {
            const grid = await page.box('#tall');
            const tile = await page.box('#only');
            near(grid.height, 500, 'the tall grid fills its holder');
            assert.ok(tile.height < 200,
                `the row track stretched: one tile is ${tile.height}px inside a ${grid.height}px grid`);
            assert.equal(await page.prop('#tall', 'align-content'), 'start');
        }));

        test('the slot is display: contents, so the tiles are the grid items', () => mounted(async (page) => {
            assert.equal(await page.prop('#g1200 >>> slot', 'display'), 'contents');
            const a = await page.box('#g1200-t0');
            const b = await page.box('#g1200-t1');
            near(b.y, a.y, 'the first two tiles are on one row, so they are grid items');
        }));

        test('aria: a bare grid has no role, a labelled one is a named group', () => mounted(async (page) => {
            const bare = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(bare, { role: null, label: null });

            const named = await page.evalFn(() => {
                const g = document.getElementById('labelled');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(named, { role: 'group', label: 'Display language' });
        }));

        test('aria: an author-written role and name survive, and clearing the label restores the name', () => mounted(async (page) => {
            const kept = await page.evalFn(() => {
                const g = document.getElementById('authored');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(kept, { role: 'radiogroup', label: 'Written by the screen' });

            const cycled = await page.evalFn(async () => {
                const g = document.getElementById('authored');
                g.label = 'Set by the component';
                await g.updateComplete;
                const during = { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
                g.label = '';
                await g.updateComplete;
                return { during, after: { role: g.getAttribute('role'), label: g.getAttribute('aria-label') } };
            });
            assert.deepEqual(cycled.during, { role: 'radiogroup', label: 'Set by the component' });
            assert.deepEqual(cycled.after, { role: 'radiogroup', label: 'Written by the screen' },
                'clearing this component\'s label must restore the screen\'s, not delete it');
        }));

        test('aria: clearing a label the component set removes the role it set', () => mounted(async (page) => {
            const cycled = await page.evalFn(async () => {
                const g = document.getElementById('labelled');
                g.label = '';
                await g.updateComplete;
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(cycled, { role: null, label: null },
                'a group with no name is noise; the component must take both back');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            const beaten = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                g.style.gap = '41px';
                g.style.alignContent = 'end';
                g.style.display = 'flex';
                const cs = getComputedStyle(g);
                const out = { gap: cs.columnGap, align: cs.alignContent, display: cs.display };
                g.removeAttribute('style');
                return out;
            });
            assert.deepEqual(beaten, { gap: '41px', align: 'end', display: 'flex' },
                'an ordinary declaration must win — no !important anywhere in the component');
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            await page.setStyle('#g1200', { 'inline-size': '600px' });
            const forced = await tracks(page, '#g1200');
            await page.setStyle('#g1200', { 'inline-size': null });
            const native = await tracks(page, '#g600');
            assert.deepEqual(forced.map(Math.round), native.map(Math.round),
                'two grids at the same container width must track identically');
        }));
    });
}

describe('the gallery entry this component ships', () => {
    test('every declared state mounts, settles and lays out', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-tile-grid.entry.js');

        assert.equal(entry.id, 'ui-tile-grid', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, './entries/ui-tile-grid.demo.js',
            'module is relative to tools/gallery/, and it is the sidecar because the '
            + 'states stage real #8 cards as the tiles');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, GALLERY_MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);
                assert.ok(await page.exists('ui-tile-grid'), `${entry.id}--${state.id} mounted no grid`);

                const stage = await page.box('#stage');
                const grid = await page.box('ui-tile-grid');
                assert.ok(grid.width > stage.width / 2,
                    `${entry.id}--${state.id} is staged in a collapsed slot: ${grid.width} inside ${stage.width}`);

                const t = await page.prop('ui-tile-grid', 'grid-template-columns');
                assert.ok(/px/.test(t), `${entry.id}--${state.id} resolved no tracks (${t})`);
                assert.ok(grid.height > 0, `${entry.id}--${state.id} rendered ${grid.width}×${grid.height}`);
            }
        });
    });
});

describe('ui-tile-grid across both Gate A geometries', () => {
    test('the same containers give the same columns at 1281×801 and at 1000×600', () => {
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        assert.deepEqual(acrossGeometries.bench.tracks, [291, 291, 291, 291]);
        assert.equal(acrossGeometries.bench.pitch, 303);
        assert.equal(acrossGeometries.bench.columns900, 3);
        assert.equal(acrossGeometries.bench.columns600, 2);
        assert.equal(acrossGeometries.bench.columns300, 1);
        assert.equal(acrossGeometries.bench.columns200, 1);
    });
});
