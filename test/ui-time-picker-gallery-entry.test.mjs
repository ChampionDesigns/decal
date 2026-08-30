/**
 * ui-time-picker-gallery-entry.test.mjs — Wave 4 #54's gallery entry, checked against
 * the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; N builders appending to it in parallel is
 * N−1 entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the
 * wave's cross-cutting writer wires them in serially. This file is what makes that
 * hand-off safe: it asserts the shape the gallery needs BEFORE the wiring, so a
 * malformed entry is a red test here rather than a battery photographing an empty
 * stage 45 seconds at a time.
 *
 * The other half is `test/render/ui-time-picker.render.test.mjs`, which mounts every
 * state below in a real browser at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-time-picker.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-time-picker', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-time-picker'), `state ${state.id} mounts no ui-time-picker`);
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
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('a state that mounts a second tag goes through the demo sidecar', () => {
    // gallery.js does ONE import per entry and then waits on customElements.whenDefined()
    // for every hyphenated tag on the stage. A state mounting <ui-dialog> without
    // ui-dialog's module having been imported hangs forever with no page error.
    const extraTags = new Set();
    for (const state of entry.states) {
        for (const m of state.html.matchAll(/<([a-z]+-[a-z-]+)/g)) {
            if (m[1] !== 'ui-time-picker') extraTags.add(m[1]);
        }
    }
    if (extraTags.size > 0) {
        assert.match(
            entry.module, /\.demo\.js$/,
            `states mount ${[...extraTags].join(', ')} as well, so the entry needs a demo sidecar`,
        );
    }
});

test('the dialog state declares itself OPEN — a closed dialog is display: none', () => {
    for (const state of entry.states) {
        if (!state.html.includes('<ui-dialog')) continue;
        assert.match(state.html, /<ui-dialog[^>]*\sopen[\s>]/,
            `state ${state.id} would photograph as an empty stage`);
        assert.match(state.html, /<ui-dialog[^>]*\s(heading|label)=/,
            `state ${state.id} opens a modal dialog with nothing to announce it by`);
        assert.match(state.html, /<ui-time-picker[^>]*\sslot="body"/,
            `state ${state.id} must put the body in the body slot — #18 owns the shell`);
    }
});
