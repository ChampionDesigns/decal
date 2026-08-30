/**
 * seams-gallery-entry.test.mjs — the wave-1 #14 gallery entry, checked against the
 * contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; sixteen wave-1 builders appending to it in
 * parallel is fifteen lost entries. Each builder therefore writes
 * `tools/gallery/entries/<id>.entry.js` and the GATE agent wires them in (import +
 * spread, or a manifest). This file is what makes that hand-off safe: it asserts the
 * shape the gallery needs BEFORE the wiring, so a malformed entry is a red test here
 * rather than a battery photographing an empty stage.
 *
 * ITEM #14 SHIPS NO ELEMENT, so the assertions differ from a component entry's in one
 * way: the states mount plain markup wearing the utility's classes, not a tag. The
 * module is the adoption hook (`seams.demo.js` → `adoptSeams(document)`), which is the
 * documented light-DOM path for a fragment a component would otherwise get through
 * `static styles`.
 *
 * `test/render/seams.render.test.mjs` takes the other half — it measures the seam in a
 * real browser at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/seams.entry.js';

/** The classes the fragment defines; the states may use no others. */
const CLASSES = ['seam-grid', 'seam-cols', 'seam-rows', 'seam-zone', 'seam-line', 'seam-strong', 'seam-cell'];

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'seams', 'the entry id is the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('class="seam-'), `state ${state.id} mounts nothing wearing the utility`);
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
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path
    // is relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the module is the adoption hook, because item #14 has no element to mount', async () => {
    // SCOPE Part 4: the row "becomes a documented layout utility, not an element", so
    // gallery.js's `await loadModule(entry)` is what has to make the classes mean
    // something. If the demo module stops adopting, every state below renders as
    // unstyled divs and the battery photographs it happily.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const source = await readFile(resolved, 'utf8');
    assert.match(source, /adoptSeams\s*\(\s*document\s*\)/, 'the demo module must adopt the fragment');
    assert.match(source, /from '\.\.\/\.\.\/\.\.\/src\/components\/seams\.js'/,
        'the demo module must import the ONE fragment, not a copy of its rules');
});

test('no state invents a class the fragment does not define', () => {
    // The failure this catches is the one the utility exists to prevent: a screen
    // hand-rolling `seam-thin` because it did not read the three weights, which is how
    // Slate ended up with five focus treatments and thirteen selection looks.
    for (const state of entry.states) {
        for (const match of state.html.matchAll(/class="([^"]*)"/g)) {
            for (const cls of match[1].split(/\s+/).filter(Boolean)) {
                assert.ok(CLASSES.includes(cls), `state ${state.id} uses undefined class .${cls}`);
            }
        }
    }
});

test('no raw colour literal and no !important in the stage scaffolding', () => {
    // tools/ is inside Gate C's scan roots and a gallery entry's inline `style="…"` is
    // authored CSS as far as scripts/lib/authored-css.js is concerned. Cheaper to fail
    // here, with the state id in the message, than in the wave gate.
    // Only the `html` is scanned, never the prose: the notes quote the oracle's own
    // rgb() values, and a whole-file grep would read those citations as violations.
    for (const state of entry.states) {
        const html = state.html.replace(/&#[0-9]+;/g, '');
        assert.ok(
            !/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(html),
            `state ${state.id} carries a raw colour literal; scaffolding uses --ui-* tokens`,
        );
        assert.ok(!/!important/.test(html), `state ${state.id} carries !important`);
    }
});
