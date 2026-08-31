/**
 * The wave-4 #51 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-card-grid.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-card-grid', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-card-grid'), `state ${state.id} mounts no ui-card-grid`);
        assert.ok(state.html.includes('<ui-card'), `state ${state.id} uses no #8 cell — the row is "small | #8"`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the states straddle the crossover, because that is the whole component', () => {
    const widths = entry.states
        .map((s) => parseFloat(s.hostStyle?.['inline-size'] ?? ''))
        .filter((w) => Number.isFinite(w));

    assert.ok(widths.length === entry.states.length, 'every state states its container width');
    assert.ok(widths.some((w) => w > 572), 'no 2-up state');
    assert.ok(widths.some((w) => w === 572), 'no state at the crossover itself');
    assert.ok(widths.some((w) => w < 572), 'no collapsed 1-up state');
    assert.ok(
        entry.states.some((s) => s.html.includes('columns="1"')),
        'no update-list state — gives the row two uses, not one',
    );
});
