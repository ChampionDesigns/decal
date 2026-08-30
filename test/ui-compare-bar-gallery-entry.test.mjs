/**
 * ui-compare-bar-gallery-entry.test.mjs — wave 4 item #44's gallery entry, checked
 * against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared,
 * hand-written array and the run's rule is whole-file writes; N builders appending to it
 * in parallel is N-1 lost entries. Each builder writes
 * `tools/gallery/entries/<tag>.entry.js` and the wave's cross-cutting writer wires it in
 * (one import line, one array slot). This file is what makes that hand-off safe: it
 * asserts the shape the gallery needs BEFORE the wiring, so a malformed entry is a red
 * test here rather than a capture battery photographing an empty stage.
 *
 * `test/render/ui-compare-bar.render.test.mjs` takes the other half — it mounts every
 * state in a real browser, at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-compare-bar.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-compare-bar', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-compare-bar'), `state ${state.id} mounts no ui-compare-bar`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the states cover the three things a reviewer has to see', () => {
    const ids = new Set(entry.states.map((s) => s.id));
    /* The strip only means anything as a set: with a comparison and without one (the
     * dimmed-not-missing rule), at zero and off zero (the signed readout and the
     * centre-origin fill), and in a container narrow enough to drop the caption. */
    for (const required of ['comparing', 'offset-positive', 'no-comparison', 'narrow-container']) {
        assert.ok(ids.has(required), `the entry is missing its ${required} state`);
    }
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path
    // is relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});
