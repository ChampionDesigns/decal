/**
 * ui-card-grid-gallery-entry.test.mjs — the wave-4 #51 gallery entry, checked against
 * the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single hand-written
 * array and the run's rule is whole-file writes; parallel builders appending to it is
 * lost entries. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the
 * wave's single cross-cutting writer wires them in. This file makes that hand-off safe:
 * a malformed entry is a red test HERE rather than a capture battery photographing an
 * empty stage.
 *
 * `test/render/ui-card-grid.render.test.mjs` takes the other half — it mounts every
 * state in a real browser at both standard geometries and measures the widths these
 * notes claim.
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
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path is
    // relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the states straddle the crossover, because that is the whole component', () => {
    // A card grid that is only ever photographed wide is photographed as a div. The
    // crossover is 2 x 280 + 12 = 572 (the floor is Appendix 14's, the gap is
    // --ui-space-3 after spec §3.3 snaps Slate's 14), so the battery needs a state on
    // each side of it and one exactly on it.
    const widths = entry.states
        .map((s) => parseFloat(s.hostStyle?.['inline-size'] ?? ''))
        .filter((w) => Number.isFinite(w));

    assert.ok(widths.length === entry.states.length, 'every state states its container width');
    assert.ok(widths.some((w) => w > 572), 'no 2-up state');
    assert.ok(widths.some((w) => w === 572), 'no state at the crossover itself');
    assert.ok(widths.some((w) => w < 572), 'no collapsed 1-up state');
    assert.ok(
        entry.states.some((s) => s.html.includes('columns="1"')),
        'no update-list state — LAYOUT_SPEC_DRAFT.md:922 gives the row two uses, not one',
    );
});
