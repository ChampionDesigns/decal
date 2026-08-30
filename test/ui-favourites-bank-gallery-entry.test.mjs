/**
 * ui-favourites-bank-gallery-entry.test.mjs — the wave-4 #36 gallery entry, checked
 * against the loading contract `tools/gallery/gallery.js` actually implements.
 *
 * The rendering half lives in `test/render/ui-favourites-bank.render.test.mjs`, which
 * mounts every state in a real browser. This file exists for the one failure that half
 * cannot photograph: a state whose tags the entry's module does not register does not
 * render badly, it HANGS. gallery.js does one `import(entry.module)` per entry
 * (gallery.js:46-51) and then awaits `customElements.whenDefined` for every custom tag
 * on the stage, shadow roots included (gallery.js:86-88); a tag whose module was never
 * imported never settles, `data-gallery-settled` is never set, and Gate B's capture
 * battery waits on that flag.
 *
 * #36's `beside-the-tabs` state mounts a real `<ui-tab-bar>` beside the bank — it is the
 * L8 comparison the audit started from — so the entry has to load two modules. Entries
 * are imported LAZILY and per entry, so "ui-tab-bar is registered by its own entry" is
 * not a load-bearing fact: a battery that navigates straight to `?state=…` has shown no
 * other entry.
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
