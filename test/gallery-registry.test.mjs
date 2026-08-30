/**
 * gallery-registry.test.mjs — the check that makes an ORPHAN ENTRY FILE go red.
 *
 * THE HOLE THIS CLOSES. `tools/gallery/entries.js` is a hand-written registry: adding a
 * component is one import line plus one array slot, and the wave's single cross-cutting
 * writer does both, once, serially (that is the whole-file-write rule's price). The
 * gallery's own meta-suite — `test/render/gallery.render.test.mjs:32-41` — asserts over
 * `window.__gallery.states()`, and that enumerates only what the array already holds. So
 * a builder who writes `tools/gallery/entries/<tag>.entry.js` and stops has produced a
 * file that NOTHING in the tree can fail on: not the render suite, not the per-entry
 * suites (each imports its own file directly), not the capture battery, which walks the
 * same registered list. The states are simply dark.
 *
 * It has happened three waves running: cross-2 in wave 2 (twelve rows unwired), the
 * first-pass wave-3 gap, and cross-1 in wave 4 — ALL TWENTY-TWO components, 139 states,
 * with every entry file individually green. The omission is invisible precisely because
 * the only thing that could see it is the list that is missing the row.
 *
 * So this suite checks the registry against the DIRECTORY, which is the one source the
 * array cannot silently disagree with:
 *
 *   1. readdir(tools/gallery/entries/) === the import list in entries.js — an orphan file
 *      fails, and so does an import of a file somebody deleted;
 *   2. every entry file's `entry.id` has a slot in the exported array — an import with no
 *      array slot is just as dark as no import at all, and lint alone would not say so;
 *   3. any row in the array that is NOT backed by an entry file is a documented
 *      exception, listed here by name rather than tolerated by shape.
 *
 * It runs in node with no browser: `node --test test/` covers it, so it is green or red
 * before the render suites are even launched. Deliberately it reads entries.js as TEXT
 * for the import list — the point is to compare what the file literally declares against
 * what is on disk, and an import that resolves is not evidence that it was written down.
 *
 * SCOPE Part 10 §13: "the gallery gives them subjects from the first component on".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { entries, allStates } from '../tools/gallery/entries.js';

const GALLERY_DIR = new URL('../tools/gallery/', import.meta.url);
const ENTRIES_DIR = new URL('entries/', GALLERY_DIR);
const REGISTRY = new URL('entries.js', GALLERY_DIR);

/* Rows that legitimately have no `entries/<id>.entry.js`, each with the reason it is
 * inline. `base-fixture` is wave 0a item #2's fixture, imported from test/fixtures/ and
 * written out in the registry itself; entries.js documents the precedent ("a fixture may
 * be a gallery subject"). A new name here is a decision, not a formatting choice. */
const INLINE_ROWS = new Set(['base-fixture']);

/** Every `<id>.entry.js` on disk. `.demo.js` sidecars are helpers, not entries. */
async function entryFilesOnDisk() {
    const names = await readdir(fileURLToPath(ENTRIES_DIR));
    return names.filter((name) => name.endsWith('.entry.js')).sort();
}

/** Every `./entries/<file>` the registry literally imports, in source order. */
async function importedFileNames() {
    const source = await readFile(fileURLToPath(REGISTRY), 'utf8');
    return [...source.matchAll(/from '\.\/entries\/([^']+)'/g)].map((match) => match[1]);
}

test('every entry file on disk is imported by the registry, and every import exists', async () => {
    const onDisk = await entryFilesOnDisk();
    const imported = await importedFileNames();

    const orphans = onDisk.filter((name) => !imported.includes(name));
    assert.deepEqual(
        orphans, [],
        `entry files nobody imports — their states are dark and no other check can see them: ${orphans.join(', ')}`,
    );

    const dangling = imported.filter((name) => !onDisk.includes(name));
    assert.deepEqual(dangling, [], `entries.js imports files that are not on disk: ${dangling.join(', ')}`);

    assert.equal(new Set(imported).size, imported.length, 'an entry file is imported twice');
    assert.equal(imported.length, onDisk.length);
});

test('every imported entry also has a slot in the exported array', async () => {
    const onDisk = await entryFilesOnDisk();
    const slotted = new Set(entries.map((entry) => entry.id));

    const missing = [];
    for (const name of onDisk) {
        const { entry } = await import(new URL(name, ENTRIES_DIR));
        assert.equal(
            entry.id, name.replace(/\.entry\.js$/, ''),
            `${name}: entry.id is the capture prefix and must equal the file stem`,
        );
        if (!slotted.has(entry.id)) missing.push(entry.id);
    }

    assert.deepEqual(
        missing, [],
        `imported but never added to \`entries\` — equally dark, and equally invisible to the `
        + `render suite, which only walks the array: ${missing.join(', ')}`,
    );
});

test('every row in the array is backed by an entry file, or is a documented inline row', async () => {
    const stems = new Set((await entryFilesOnDisk()).map((name) => name.replace(/\.entry\.js$/, '')));
    const unbacked = entries.map((entry) => entry.id).filter((id) => !stems.has(id) && !INLINE_ROWS.has(id));
    assert.deepEqual(unbacked, [], `rows with no entry file and no documented exception: ${unbacked.join(', ')}`);
});

test('state ids are unique across the whole registry, because they are capture filenames', () => {
    /* The render suite asserts this in a browser over the mounted states; the battery
     * writes one PNG per id per theme per geometry, so a collision silently overwrites a
     * baseline. Cheap enough to catch here first, before anything is launched. */
    const ids = allStates().map((state) => state.id);
    const seen = new Set();
    const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    assert.deepEqual(duplicates, [], `duplicate capture filenames: ${duplicates.join(', ')}`);
});
