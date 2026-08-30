/**
 * ui-dialog-gallery-entry.test.mjs — the wave-3 #18 gallery entry, checked against the
 * contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array and
 * the run's rule is whole-file writes; N builders appending to it in parallel is N−1
 * entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the wave's
 * reviewer wires them in serially. This file is what makes that hand-off safe: it asserts
 * the shape the gallery needs BEFORE the wiring, so a malformed entry is a red test here
 * rather than a battery photographing an empty stage.
 *
 * `test/render/ui-dialog.render.test.mjs` takes the other half — it mounts every state in
 * a real browser at both Gate A geometries and checks each one is OPEN and has a card big
 * enough to photograph, which for this component is the failure that matters: a dialog
 * that mounts closed is `display: none` and the battery would record a blank stage with
 * no error anywhere.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-dialog.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-dialog', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-dialog'), `state ${state.id} mounts no ui-dialog`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('every state declares itself OPEN — a closed dialog is display: none', () => {
    for (const state of entry.states) {
        assert.match(state.html, /<ui-dialog[^>]*\sopen[\s>]/,
            `state ${state.id} would photograph as an empty stage`);
    }
});

test('every state has an accessible name, from `heading` or from `label`', () => {
    for (const state of entry.states) {
        assert.match(state.html, /<ui-dialog[^>]*\s(heading|label)=/,
            `state ${state.id} opens a modal dialog with nothing to announce it by`);
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
