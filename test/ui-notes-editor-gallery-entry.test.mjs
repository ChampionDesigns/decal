/**
 * ui-notes-editor-gallery-entry.test.mjs — wave 4 #55's gallery entry, checked
 * against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; N builders appending to it in parallel is
 * N−1 entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the
 * wave's cross-cutting writer wires them in serially. This file makes that hand-off
 * safe: a malformed entry is a red test here rather than a battery photographing an
 * empty stage.
 *
 * `test/render/ui-notes-editor.render.test.mjs` takes the other half — it mounts every
 * state in a real browser at both Gate A geometries and counts the bank's keys.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-notes-editor.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-notes-editor', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-notes-editor'), `state ${state.id} mounts no ui-notes-editor`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

/* #55 is a BODY, and a body has no intrinsic height: without a stage size every state
 * photographs as the bank plus the editor's own 164px floor in a box of whatever the
 * stage happens to be. `hostStyle` sizes the STAGE, which is the only honest way to
 * show a component that reads its container and never the viewport (spec §2.1 Rule 1). */
test('every state sizes its stage, because a dialog body has no size of its own', () => {
    for (const state of entry.states) {
        assert.ok(state.hostStyle, `state ${state.id} has no hostStyle`);
        assert.ok(state.hostStyle['block-size'], `state ${state.id} gives the body no block size`);
        assert.ok(state.hostStyle['inline-size'], `state ${state.id} gives the body no inline size`);
    }
});

/* The row is "EasyMDE inside a dialog" and the two states that matter to the capture
 * battery are the seeded surface and the empty one — the placeholder is the only paint
 * in the component that a full document hides completely. */
test('both the seeded and the empty surface are on the stage', () => {
    const seeded = entry.states.filter((s) => /\svalue="/.test(s.html));
    const empty = entry.states.filter((s) => !/\svalue="/.test(s.html));
    assert.ok(seeded.length > 0, 'no seeded state — the 18px editing step is never photographed');
    assert.ok(empty.length > 0, 'no empty state — the placeholder is never photographed');
});

/* O11's class, one component over: a bank that runs out of room must scroll, not
 * truncate. The narrow state is what makes that visible in a screenshot diff. */
test('a narrow container is one of the states', () => {
    const widths = entry.states
        .map((s) => parseFloat(s.hostStyle?.['inline-size'] ?? '0'))
        .filter((n) => Number.isFinite(n) && n > 0);
    assert.ok(widths.length > 1);
    assert.ok(
        Math.min(...widths) < 640,
        `no narrow state: the smallest stage is ${Math.min(...widths)}px, and nine 64px keys `
        + 'plus three separators need 627px — the bank never has to scroll for the battery.',
    );
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

/* gallery.js:86-88 waits on customElements.whenDefined() for EVERY hyphenated tag on
 * the stage. A tag whose module was never imported never resolves, show() never sets
 * gallerySettled, and the battery burns its per-state timeout with no page error —
 * measured for ui-menu (ui-dialog.demo.js). So: every custom tag any state mounts must
 * be registered by the one module this entry declares. */
test('the demo module registers every custom tag the states mount', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const source = await readFile(resolved, 'utf8');

    const tags = new Set();
    for (const state of entry.states) {
        for (const m of state.html.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]*)/g)) tags.add(m[1]);
    }
    assert.ok(tags.has('ui-notes-editor'));

    for (const tag of tags) {
        assert.ok(
            source.includes(`/${tag}.js`),
            `${tag} is mounted by a state and ${entry.module} does not import it — `
            + 'the gallery will hang on customElements.whenDefined().',
        );
    }
});
