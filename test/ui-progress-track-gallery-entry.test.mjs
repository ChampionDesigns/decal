/**
 * ui-progress-track-gallery-entry.test.mjs — the wave-1 #17 gallery entry,
 * checked against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared
 * array and the run's rule is whole-file writes; sixteen wave-1 builders appending
 * to it in parallel is fifteen lost entries. Each builder therefore writes
 * `tools/gallery/entries/<tag>.entry.js` and the GATE agent wires them in (import +
 * spread, or a manifest). This file is what makes that hand-off safe: it asserts
 * the shape the gallery needs BEFORE the wiring, so a malformed entry is a red test
 * here rather than a battery photographing an empty stage.
 *
 * `test/render/ui-progress-track.render.test.mjs` takes the other half — it mounts
 * every state in a real browser at both standard geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-progress-track.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-progress-track', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-progress-track'), `state ${state.id} mounts no ui-progress-track`);
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
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the
    // path is relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the states cover the range, not just one pretty number', () => {
    // A progress bar has exactly two interesting failure modes at the ends — a
    // zero-width fill that still paints a sliver, and a full fill that leaves a
    // hairline of trough showing — and neither is visible in a single mid state.
    const html = entry.states.map((s) => s.html).join(' ');
    assert.match(html, /value="0"/, 'no empty state to catch a sliver at zero');
    assert.match(html, /value="1"/, 'no full state to catch a hairline at the end');
    assert.ok(
        entry.states.some((s) => s.hostStyle && s.hostStyle['inline-size']),
        'no narrow-container state — this is the one wave-1 primitive whose paint is a '
        + 'percentage of its container (spec §2.1 Rule 1)',
    );
});
