/**
 * The resurrection pin for.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { entries, allStates } from '../tools/gallery/entries.js';

const ENTRIES_DIR = new URL('../tools/gallery/entries/', import.meta.url);
const COMPONENTS_DIR = new URL('../src/components/', import.meta.url);

const TAG = ['ui', 'folder', 'disclosure'].join('-');

/** True when the path is there at all. No handle is opened, no byte is read. */
async function exists(url) {
    try {
        await access(fileURLToPath(url));
        return true;
    } catch {
        return false;
    }
}

test('the component module is gone from src/components/', async () => {
    assert.equal(
        await exists(new URL(`${TAG}.js`, COMPONENTS_DIR)), false,
        `${TAG}.js is back in src/components/. Component #28 was deleted on 30 Aug 2026 `
        + '(F-005 / D10) because nothing in src/ composed it; if it has been restored '
        + 'deliberately, delete this test file in the same change.',
    );
});

test('the gallery holds no row and no entry file for it', async () => {
    const slotted = entries.map((entry) => entry.id);
    assert.ok(
        !slotted.includes(TAG),
        `the gallery registry still lists ${TAG}. The entry file went with the component `
        + '(F-005 / D10); a row without one is caught by gallery-registry.test.mjs, and a '
        + 'row WITH one is a resurrection this test exists to name.',
    );

    const onDisk = await readdir(fileURLToPath(ENTRIES_DIR));
    assert.ok(
        !onDisk.includes(`${TAG}.entry.js`),
        `${TAG}.entry.js is back on disk in tools/gallery/entries/.`,
    );

    /* The capture battery walks allStates(); a restored entry would put PNG baselines
     * back into the run under this prefix, which is the visible cost of a quiet return. */
    const prefixed = allStates().map((state) => state.id).filter((id) => id.startsWith(TAG));
    assert.deepEqual(prefixed, [], `capture states still registered for ${TAG}`);
});
