/**
 * ui-sheet-gallery-entry.test.mjs — wave 4 #20's gallery entry and its demo sidecar,
 * checked against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE, and why it needs its own test. `tools/gallery/entries.js`
 * is a single shared array and the run's rule is whole-file writes, so N builders appending
 * to it in parallel is N−1 entries lost. Each builder writes
 * `tools/gallery/entries/<tag>.entry.js` and the wave's cross-cutting writer wires them in
 * serially. `test/ui-confirm-dialog-gallery-entry.test.mjs:1-13` states what that hand-off
 * needs from a test: "a malformed entry is a red test here rather than a battery
 * photographing an empty stage". #20 shipped with no such file — its entry and its demo were
 * the only two of the four delivered artefacts no test in the tree touched.
 *
 * #20 has THREE ways to photograph an empty stage, and each has an assertion below:
 *   * `fields` is a JSON attribute and `ui-sheet.js:400` renders a malformed one as EMPTY,
 *     in silence — no page error for the battery to notice;
 *   * the composed state is a MODAL, and a `<ui-dialog>` without `open` is `display: none`;
 *   * `gallery.js` waits on `customElements.whenDefined()` for every hyphenated tag on the
 *     stage, so a tag the demo forgets to import hangs the capture for its full 45 s timeout
 *     with zero page errors (measured for ui-menu, `ui-sheet.demo.js:9-15`).
 *
 * `test/render/ui-sheet.render.test.mjs` takes the other half — it mounts the component in
 * a real browser at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-sheet.entry.js';

const DEMO = new URL('../tools/gallery/entries/ui-sheet.demo.js', import.meta.url);

/** The `fields='...'` attributes of one state, in source order. */
const fieldAttributes = (html) => [...html.matchAll(/fields='([^']*)'/g)].map((m) => m[1]);

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-sheet', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-sheet'), `state ${state.id} mounts no ui-sheet`);
        if (state.hostStyle !== undefined) {
            assert.equal(typeof state.hostStyle, 'object');
        }
    }
});

test('every fields attribute is valid JSON — a malformed one renders EMPTY, in silence', () => {
    // `ui-sheet.js:400` — "Never null: a malformed attribute renders empty". Lit's Array
    // converter swallows the parse error, so a stray comma here costs a screenshot of
    // nothing at all, with no page error against it.
    for (const state of entry.states) {
        const attributes = fieldAttributes(state.html);
        assert.ok(attributes.length > 0, `state ${state.id} declares no fields`);
        for (const raw of attributes) {
            const parsed = JSON.parse(raw);
            assert.ok(Array.isArray(parsed) && parsed.length > 0, `state ${state.id}: fields is not a non-empty array`);
            for (const field of parsed) {
                assert.match(field.name, /^[a-z0-9-]+$/, `state ${state.id}: ${field.name} is a slot name`);
                if (field.label !== undefined) assert.equal(typeof field.label, 'string');
                if (field.layout !== undefined) assert.equal(field.layout, 'inline');
                if (field.caption !== undefined) assert.equal(typeof field.caption, 'string');
            }
        }
    }
});

test('every declared field is answered by a slotted control — an unanswered field is a gap', () => {
    for (const state of entry.states) {
        for (const raw of fieldAttributes(state.html)) {
            for (const field of JSON.parse(raw)) {
                assert.match(
                    state.html, new RegExp(`slot="${field.name}"`),
                    `state ${state.id}: field ${field.name} has no control, so it photographs as an empty row`,
                );
            }
        }
    }
});

test('the composed state declares the dialog OPEN — a closed #18 dialog is display: none', () => {
    const modal = entry.states.filter((s) => s.html.includes('<ui-dialog'));
    assert.ok(modal.length > 0, 'the state that matters most is the sheet inside a #18 dialog');
    for (const state of modal) {
        assert.match(state.html, /<ui-dialog[^>]*\sopen[\s>]/, `state ${state.id} would photograph as an empty stage`);
    }
});

/* O13, the row's carried repair: ".slate-sheet-actions means two different things — a header
 * cluster in the library, a dialog footer in the shell". The footer is the DIALOG's, one
 * level out, and the capture is the evidence. Both halves are pinned: the real composition
 * puts the buttons outside the sheet, and one state deliberately puts one inside to show it
 * renders nowhere at all. */
const sheetMarkup = (html) => html.slice(html.indexOf('<ui-sheet'), html.lastIndexOf('</ui-sheet>'));

test('in the composed state the actions are the DIALOG\'s, not the sheet\'s', () => {
    const composed = entry.states.find((s) => s.html.includes('<ui-dialog'));
    assert.ok(composed.html.includes('slot="actions"'), 'the composition has a footer to place');
    assert.ok(
        !sheetMarkup(composed.html).includes('slot="actions"'),
        'a footer inside the sheet is the second card in one box — the seam O13 exists to show',
    );
});

test('the tail state keeps its deliberate counter-example: slot="actions" inside a sheet renders nowhere', () => {
    const tail = entry.states.find((s) => s.id === 'unlabelled-and-tail');
    assert.ok(tail, 'the tail state is the one that demonstrates an unanswered slot name');
    assert.ok(
        sheetMarkup(tail.html).includes('slot="actions"'),
        'the demonstration is the button INSIDE the sheet; without it the state proves nothing',
    );
    assert.ok(!tail.html.includes('<ui-dialog'), 'and it is not in a dialog, so nothing answers that slot');
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

test('the demo imports EVERY hyphenated tag the states mount — a missing one hangs the battery', async () => {
    // gallery.js waits on `customElements.whenDefined()` for every custom tag it finds on the
    // stage. A tag whose module was never imported never resolves: `show()` never sets
    // `gallerySettled`, the battery burns its 45 s per-state timeout, and there is no page
    // error to show for it. That is why the entry needs a demo module at all.
    const source = await readFile(DEMO, 'utf8');
    const tags = new Set();
    for (const state of entry.states) {
        for (const match of state.html.matchAll(/<([a-z]+(?:-[a-z]+)+)/g)) tags.add(match[1]);
    }
    assert.ok(tags.size >= 2, 'the states mount composed markup, not a bare component');
    for (const tag of tags) {
        // The IMPORT, not a mention of the path: this file's own docblock names modules in
        // prose, and so does the demo's.
        assert.match(
            source, new RegExp(`import\\s+'[^']*components/${tag}\\.js'`),
            `${tag} is on the stage and the demo never imports it`,
        );
    }
});
