/**
 *.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-confirm-dialog.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-confirm-dialog', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-confirm-dialog'), `state ${state.id} mounts no ui-confirm-dialog`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('every state declares itself OPEN — a closed dialog is display: none', () => {
    for (const state of entry.states) {
        assert.match(state.html, /<ui-confirm-dialog[^>]*\sopen[\s>]/,
            `state ${state.id} would photograph as an empty stage`);
    }
});

test('every state has a question, which is also the modal\'s accessible name', () => {
    for (const state of entry.states) {
        assert.match(state.html, /<ui-confirm-dialog[^>]*\squestion=/,
            `state ${state.id} opens a modal with nothing to announce it by`);
    }
});

/* The row is "question + DESTRUCTIVE/AFFIRMATIVE pair", so the gallery has to show
 * both — a battery that only ever photographs one tone cannot regress the other. */
test('both tones are on the stage somewhere', () => {
    const destructive = entry.states.filter((s) => /tone="destructive"/.test(s.html));
    const affirmative = entry.states.filter((s) => !/tone=/.test(s.html));
    assert.ok(destructive.length > 0, 'no destructive state');
    assert.ok(affirmative.length > 0, 'no affirmative state (the default tone)');
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
