/**
 * ui-data-grid-gallery-entry.test.mjs — the wave-4 #34 gallery entry, checked against
 * the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array and
 * the run's rule is whole-file writes; N builders appending to it in parallel is N−1
 * entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the wave's
 * cross-cutting writer wires them in serially. This file is what makes that hand-off
 * safe: it asserts the shape the gallery needs BEFORE the wiring, so a malformed entry is
 * a red test here rather than a battery photographing an empty stage.
 *
 * `test/render/ui-data-grid.render.test.mjs` takes the other half — it mounts every state
 * in a real browser at both Gate A geometries and checks each one still has a table to
 * photograph after the settle.
 *
 * THE ONE THING THIS ENTRY NEEDS THAT MOST DO NOT, asserted rather than trusted: its
 * `module` must be the DEMO sidecar, not the component. `columns` and `rows` are
 * properties and a state's markup is a string assigned to `innerHTML` (gallery.js:81),
 * so a state mounting the bare tag photographs the empty state whatever its title says.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-data-grid.entry.js';

/** Every custom element the demo sidecar defines, and therefore every tag a state may
 *  mount without becoming an unknown element. */
const DEMO_TAGS = ['ui-data-grid-phase', 'ui-data-grid-absent', 'ui-data-grid-list',
    'ui-data-grid-empty'];

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-data-grid', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(
            DEMO_TAGS.some((tag) => state.html.includes(`<${tag}`)),
            `state ${state.id} mounts no data grid — one of ${DEMO_TAGS.join(', ')} is required`,
        );
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

test('the module is the demo sidecar, and the sidecar defines every tag the states use', async () => {
    // gallery.js does ONE import per entry, and the data are properties. A state that
    // mounted the bare component would photograph the empty state — silently, and
    // identically for every state that did it.
    assert.match(entry.module, /ui-data-grid\.demo\.js$/,
        'the entry must point at the demo sidecar, not at src/components/ui-data-grid.js');

    const source = await readFile(
        new URL(entry.module, new URL('../tools/gallery/', import.meta.url)), 'utf8',
    );
    for (const tag of DEMO_TAGS) {
        assert.ok(source.includes(`customElements.define('${tag}'`),
            `the sidecar does not define <${tag}>, so a state mounting it is an unknown element`);
    }
    // #38 is slotted into the empty state's empty region, and the same one-import rule
    // applies to it.
    assert.ok(source.includes('ui-empty-state.js'),
        'the sidecar must import #38 for the empty state, or the slot photographs as bare text');
});

test('every slot name a state writes is a cell slot the grid can offer', () => {
    // A slot name that does not match `cell-<rowKey>-<colKey>` is assigned to nothing and
    // renders nowhere — which is the same silent hole as an unknown element, and is the
    // mechanism this component relies on to make an unowned cell impossible.
    const ROW_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];
    for (const state of entry.states) {
        for (const [, name] of state.html.matchAll(/slot="([^"]+)"/g)) {
            if (name === 'empty') continue;
            const match = /^cell-(.+)-([a-z]+)$/.exec(name);
            assert.ok(match, `state ${state.id}: slot="${name}" is not a cell slot`);
            assert.ok(ROW_KEYS.includes(match[1]),
                `state ${state.id}: slot="${name}" names row ${match[1]}, which the demo does not render`);
            assert.equal(match[2], 'ab',
                `state ${state.id}: slot="${name}" names a column that is not the control column`);
        }
    }
});

test('no state carries a colour, a font or a pixel track of its own', () => {
    // The stage sizes the CONTAINER (spec §2.1 Rule 1) and the component reads it. A
    // state that painted would be theming from outside the token layer, which is the one
    // thing the shadow boundary exists to prevent (A6, CONVENTIONS §7) — and it would
    // also make the capture battery's diff a picture of the fixture.
    for (const state of entry.states) {
        for (const [, decl] of state.html.matchAll(/style="([^"]*)"/g)) {
            assert.doesNotMatch(decl, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i,
                `state ${state.id}: a colour literal in a fixture style — ${decl}`);
            assert.doesNotMatch(decl, /font-family|font-size/i,
                `state ${state.id}: a font declaration in a fixture style — ${decl}`);
            assert.doesNotMatch(decl, /grid-template-columns/i,
                `state ${state.id}: a hand-written track list — the tracks come from `
                + '`columns`, which is the whole of spec §4.5');
        }
    }
});
