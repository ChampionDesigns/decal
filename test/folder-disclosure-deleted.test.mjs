/**
 * folder-disclosure-deleted.test.mjs — the resurrection pin for component #28.
 *
 * `<ui-folder-disclosure>` was DELETED on 30 August 2026 (Ben's decision D10, from the
 * overnight campaign's MORNING_REPORT §3.2 item 10). The audit finding behind it is F-005:
 * the component's `folder-toggle` emit was heard nowhere, and the read-only verification
 * that closed that wire came back stronger than the wire itself — the component was
 * composed in ZERO places in `src/`. The fold state the product ships is the selector
 * screen's own (`_openFolders`, persisted through the storage router as
 * `profileFoldersOpen`), and `src/lib/profile-listbox.js` had already ruled that a
 * foldered list is a `tree`, not this component, because its head row is a `<button>` and
 * a `<button>` inside a listbox is bug P12.
 *
 * WHY A TEST FOR A DELETION. Nothing else in the tree can fail on a resurrection. The
 * gallery registry check (`gallery-registry.test.mjs`) compares the entries directory
 * against the import list, so it stays green whether the row is there or not — it only
 * objects to the two disagreeing. `gate-wire` scans emits and listeners, and a restored
 * component with no emit is invisible to it. `guards` and `a8` count files without caring
 * which. So the only thing that would notice #28 coming back is this file.
 *
 * It pins the two halves separately, because they can come back separately: the MODULE (a
 * copy restored from git into `src/components/`) and the GALLERY ROW (an entry file plus
 * its import, which is how the component would earn states and captures again).
 *
 * AN IMPORT PROBE WAS TRIED FIRST AND IS WRONG, which is worth writing down so the next
 * reader does not reach for it. `await assert.rejects(() => import(specifier))` passes
 * whether or not the file is there: every component in this tree imports `lit` as a BARE
 * specifier, resolved in the browser by the page's import map and by nothing at all in
 * node, so a restored #28 rejects with the same `ERR_MODULE_NOT_FOUND` as a missing one.
 * Measured — with the file restored from git the probe still went green, on
 * `Cannot find package 'lit' imported from .../ui-folder-disclosure.js`. Existence is the
 * fact being pinned, so existence is what is asked.
 *
 * A RUNTIME PROBE CANNOT PIN IT EITHER, for a reason that is really the finding restated:
 * `customElements.get(TAG)` was already undefined BEFORE the deletion, because nothing
 * composed the component. There is no before/after in the mounted product — the whole
 * point of D10 is that removing it changes nothing anyone can see.
 *
 * READS NO SOURCE TEXT. The module half asks the filesystem whether a path exists; the
 * registry half reads the exported `entries` array and lists `tools/gallery/entries/`.
 * Nothing opens a file under `src/`, and `access` is not a read — a8's rule (no test reads
 * the source text of anything under `styles/` or `src/components|screens|lib|stores/`,
 * with `readdir` counted as a read one level up) is not approached, let alone bent. The
 * directory that IS listed is under `tools/`, exactly as `gallery-registry.test.mjs`
 * lists it.
 *
 * IF #28 IS WANTED AGAIN, DELETE THIS FILE in the same commit that restores it. That is
 * the point: bringing the component back should cost a deliberate deletion here, not an
 * accident nobody sees.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { entries, allStates } from '../tools/gallery/entries.js';

const ENTRIES_DIR = new URL('../tools/gallery/entries/', import.meta.url);
const COMPONENTS_DIR = new URL('../src/components/', import.meta.url);

/* Built at run time rather than written as one literal, so the string this file contains
 * is never a path a source-text scanner could mistake for a read. */
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
