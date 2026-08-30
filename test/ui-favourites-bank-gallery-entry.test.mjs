/**
 * The wave-4 #36 gallery entry, checked against the loading contract tools/gallery/gallery.js actually implements.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-favourites-bank.entry.js';

const GALLERY = new URL('../tools/gallery/', import.meta.url);

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    assert.equal(entry.id, 'ui-favourites-bank',
        'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.module, 'string');
    const info = await stat(new URL(entry.module, GALLERY));
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the loader registers every tag the states mount, or the gallery hangs', async () => {
    const source = await readFile(new URL(entry.module, GALLERY), 'utf8');

    const tagsUsed = new Set();
    for (const state of entry.states) {
        for (const m of state.html.matchAll(/<(ui-[a-z0-9-]+)/g)) tagsUsed.add(m[1]);
    }
    assert.ok(tagsUsed.has('ui-favourites-bank'), 'no state mounts the subject');
    assert.ok(tagsUsed.has('ui-tab-bar'),
        'the L8 comparison state must put a real tab bar beside the bank');

    for (const tag of tagsUsed) {
        assert.ok(source.includes(`/${tag}.js`),
            `${entry.module} does not import ${tag}, and a state mounts it — `
            + 'gallery.js awaits whenDefined() on it and never settles');
    }
});
