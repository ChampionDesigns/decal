/**
 * The wave-1 #17 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the states cover the range, not just one pretty number', () => {
    const html = entry.states.map((s) => s.html).join(' ');
    assert.match(html, /value="0"/, 'no empty state to catch a sliver at zero');
    assert.match(html, /value="1"/, 'no full state to catch a hairline at the end');
    assert.ok(
        entry.states.some((s) => s.hostStyle && s.hostStyle['inline-size']),
        'no narrow-container state — this is the one wave-1 primitive whose paint is a '
        + 'percentage of its container (spec §2.1 Rule 1)',
    );
});
