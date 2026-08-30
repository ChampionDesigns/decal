/**
 * The wave-1 #43 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the container states are the point of this entry, and they carry a hostStyle', () => {
    const sized = entry.states.filter((s) => s.hostStyle && s.hostStyle['inline-size']);
    assert.ok(sized.length >= 3, 'at least three states must pin a container width');

    const widths = new Set(sized.map((s) => s.hostStyle['inline-size']));
    assert.ok(widths.size >= 3, `the sized states must differ: ${[...widths].join(', ')}`);
    assert.ok(widths.has('346px'), 'one state must be the editor column the oracle measured (346px)');
});
