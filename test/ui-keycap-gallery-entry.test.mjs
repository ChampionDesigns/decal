/**
 * ui-keycap-gallery-entry.test.mjs — the wave-1 #15 gallery entry, checked against
 * the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; sixteen wave-1 builders appending to it in
 * parallel is fifteen lost entries. Each builder therefore writes
 * `tools/gallery/entries/<tag>.entry.js` and the GATE agent wires them in (import +
 * spread, or a manifest). This file is what makes that hand-off safe: it asserts the
 * shape the gallery needs BEFORE the wiring, so a malformed entry is a red test here
 * rather than a battery photographing an empty stage.
 *
 * `test/render/ui-keycap.render.test.mjs` takes the other half — it mounts the
 * component in a real browser at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-keycap.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-keycap', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-keycap'), `state ${state.id} mounts no ui-keycap`);
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

test('no raw colour literal and no !important in the stage scaffolding', () => {
    // tools/ is inside Gate C's scan roots and a gallery entry's inline `style="…"` is
    // authored CSS as far as scripts/lib/authored-css.js is concerned. Cheaper to fail
    // here, with the state id in the message, than in the wave gate.
    // Only the `html` is scanned, never the prose: the notes below DISCUSS !important
    // (Slate's fix for the [hidden] collision), and a whole-file grep would read that
    // sentence as a violation.
    for (const state of entry.states) {
        // Numeric character references (&#9003; — the backspace glyph) are not hex
        // colours, and a naive /#[0-9a-f]{3,8}/ reads one as #9003. Blank them first.
        const html = state.html.replace(/&#[0-9]+;/g, '');
        assert.ok(
            !/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(html),
            `state ${state.id} carries a raw colour literal; scaffolding uses --ui-* tokens`,
        );
        assert.ok(!/!important/.test(html), `state ${state.id} carries !important`);
    }
});
