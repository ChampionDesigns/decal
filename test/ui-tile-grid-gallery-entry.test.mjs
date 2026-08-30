/**
 * The wave-4 #40 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-tile-grid.entry.js';

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
    assert.equal(entry.module, './entries/ui-tile-grid.demo.js');
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('every state states its container width, because the container IS the input', () => {
    for (const state of entry.states) {
        const width = parseFloat(state.hostStyle?.['inline-size'] ?? '');
        assert.ok(Number.isFinite(width), `state ${state.id} does not state its container width`);
    }
});

test('the states straddle every column count the pattern produces', () => {
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
    const knobbed = entry.states.filter((s) => s.html.includes('--_ui-tile-grid-min'));
    assert.equal(knobbed.length, 1, 'exactly one state should demonstrate the knob');
    assert.match(knobbed[0].html, /<ui-tile-grid[^>]*style="--_ui-tile-grid-min:/,
        'the knob must be set on the ui-tile-grid host, not on a wrapper');
});

test('no state paints a selected look on the grid', () => {
    for (const state of entry.states) {
        const openTag = state.html.slice(state.html.indexOf('<ui-tile-grid'));
        const attrs = openTag.slice(0, openTag.indexOf('>'));
        assert.ok(!/aria-checked|aria-selected|aria-pressed|is-selected/.test(attrs),
            `state ${state.id} puts a selection state on the grid itself`);
    }
});
