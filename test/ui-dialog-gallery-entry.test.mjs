/**
 * The wave-3 #18 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
