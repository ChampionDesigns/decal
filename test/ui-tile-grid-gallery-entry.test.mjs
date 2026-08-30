/**
 * ui-tile-grid-gallery-entry.test.mjs — the wave-4 #40 gallery entry, checked against
 * the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single hand-written
 * array and the run's rule is whole-file writes; parallel builders appending to it is
 * lost entries. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the
 * wave's single cross-cutting writer wires them in. This file makes that hand-off safe:
 * a malformed entry is a red test HERE rather than a capture battery photographing an
 * empty stage.
 *
 * `test/render/ui-tile-grid.render.test.mjs` takes the other half — it mounts every
 * state in a real browser at both standard geometries and measures the column counts
 * these notes claim.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-tile-grid.entry.js';

/** The component's two constants, and the only place this file states them.
 *  ORACLE both are read off the 30 language tiles:
 *  `prov_query.py find --cls slate-lang-tile` → 291x84 at x = 629 / 932 / 1235 / 1538
 *  inside a 1200px leaf → gutter 12px (--ui-space-3), 4 tracks of exactly the 291 the
 *  authored `minmax(280px, 1fr)` predicts. */
const MIN = 280;
const GAP = 12;

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-tile-grid', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-tile-grid'), `state ${state.id} mounts no ui-tile-grid`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path is
    // relative to THAT directory, not to the entry file's own. It is the .demo.js
    // sidecar because the states stage real #8 cards as the tiles, and mount() waits
    // forever on a hyphenated tag whose module never loaded.
    assert.equal(entry.module, './entries/ui-tile-grid.demo.js');
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('every state states its container width, because the container IS the input', () => {
    // #40 has no attribute, no property and no media query that changes what it does:
    // the stage width is the entire question (spec §2.1 Rule 1). A state with no
    // hostStyle is a state that asks nothing.
    for (const state of entry.states) {
        const width = parseFloat(state.hostStyle?.['inline-size'] ?? '');
        assert.ok(Number.isFinite(width), `state ${state.id} does not state its container width`);
    }
});

test('the states straddle every column count the pattern produces', () => {
    // A fluid grid photographed at one width is photographed as a div. The counts are
    // floor((W + GAP) / (MIN + GAP)), floored at 1 — so the battery needs states that
    // land on 4, 3, 2 and the collapsed 1, and one of the 1s must be BELOW the 280
    // floor, which is where this component departs from Slate.
    const columnsAt = (w) => Math.max(1, Math.floor((w + GAP) / (MIN + GAP)));
    const widths = entry.states
        .filter((s) => !s.html.includes('--_ui-tile-grid-min'))
        .map((s) => parseFloat(s.hostStyle['inline-size']));

    const counts = new Set(widths.map(columnsAt));
    for (const n of [4, 3, 2, 1]) {
        assert.ok(counts.has(n), `no state renders ${n} column(s); widths ${widths.join(', ')}`);
    }
    assert.ok(widths.some((w) => w < MIN),
        'no state is narrower than one tile — that is where min(280px, 100%) earns its place');
    assert.ok(widths.includes(1200),
        'no state at Slate\'s own 1200px leaf, which is the one width the oracle answers');
});

test('the knob has a state of its own, set on the host and not on an ancestor', () => {
    // --_ui-tile-grid-min is read, not baked in; the state proves it, and the placement
    // matters — a :host default beats an inherited value, so the knob only works when
    // it names the host.
    const knobbed = entry.states.filter((s) => s.html.includes('--_ui-tile-grid-min'));
    assert.equal(knobbed.length, 1, 'exactly one state should demonstrate the knob');
    assert.match(knobbed[0].html, /<ui-tile-grid[^>]*style="--_ui-tile-grid-min:/,
        'the knob must be set on the ui-tile-grid host, not on a wrapper');
});

test('no state paints a selected look on the grid', () => {
    // The wave law: "No component in this wave may own a private selected look."
    // aria-checked belongs on the TILE; the grid may carry the group role the screen
    // wrote, and nothing else.
    for (const state of entry.states) {
        const openTag = state.html.slice(state.html.indexOf('<ui-tile-grid'));
        const attrs = openTag.slice(0, openTag.indexOf('>'));
        assert.ok(!/aria-checked|aria-selected|aria-pressed|is-selected/.test(attrs),
            `state ${state.id} puts a selection state on the grid itself`);
    }
});
