/**
 * ui-locked-value-gallery-entry.test.mjs — the wave-1 #43 gallery entry, checked
 * against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; sixteen wave-1 builders appending to it in
 * parallel is fifteen lost entries. Each builder therefore writes
 * `tools/gallery/entries/<tag>.entry.js` and the GATE agent wires them in (import +
 * spread, or a manifest). This file is what makes that hand-off safe: it asserts the
 * shape the gallery needs BEFORE the wiring, so a malformed entry is a red test here
 * rather than a battery photographing an empty stage.
 *
 * `test/render/ui-locked-value.render.test.mjs` takes the other half — it mounts the
 * component in a real browser at both standard geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-locked-value.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-locked-value', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-locked-value'), `state ${state.id} mounts no ui-locked-value`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path
    // is relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the container states are the point of this entry, and they carry a hostStyle', () => {
    // The component owns no width (departure 1), so "what does it look like" is a
    // question about its CONTAINER. An entry whose narrow/wide states lost their
    // hostStyle would photograph the same box three times and prove nothing.
    const sized = entry.states.filter((s) => s.hostStyle && s.hostStyle['inline-size']);
    assert.ok(sized.length >= 3, 'at least three states must pin a container width');

    const widths = new Set(sized.map((s) => s.hostStyle['inline-size']));
    assert.ok(widths.size >= 3, `the sized states must differ: ${[...widths].join(', ')}`);
    assert.ok(widths.has('346px'), 'one state must be the editor column the oracle measured (346px)');
});
