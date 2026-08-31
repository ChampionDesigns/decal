/**
 * The check that makes an.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { entries, allStates } from '../tools/gallery/entries.js';

const GALLERY_DIR = new URL('../tools/gallery/', import.meta.url);
const ENTRIES_DIR = new URL('entries/', GALLERY_DIR);
const REGISTRY = new URL('entries.js', GALLERY_DIR);

const INLINE_ROWS = new Set(['base-fixture']);

/** Every entry file on disk. The `.demo.js` sidecars are helpers, not entries. */
async function entryFilesOnDisk() {
    const names = await readdir(fileURLToPath(ENTRIES_DIR));
    return names.filter((name) => name.endsWith('.entry.js')).sort();
}

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
    const ids = allStates().map((state) => state.id);
    const seen = new Set();
    const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    assert.deepEqual(duplicates, [], `duplicate capture filenames: ${duplicates.join(', ')}`);
});
