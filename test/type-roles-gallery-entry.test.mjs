/**
 * type-roles-gallery-entry.test.mjs - the wave-1 #13 gallery entry, checked against the
 * contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array and
 * the run's rule is whole-file writes; sixteen wave-1 builders appending to it in
 * parallel is fifteen lost entries. Each builder therefore writes
 * `tools/gallery/entries/<id>.entry.js` and the GATE agent wires them in. This file is
 * what makes that hand-off safe: it asserts the shape the gallery needs BEFORE the
 * wiring, so a malformed entry is a red test here rather than a battery photographing an
 * empty stage.
 *
 * `test/render/type-roles.render.test.mjs` takes the other half - it mounts the roles on
 * plain elements in a real browser at both Gate A geometries.
 *
 * ROW #13 SHIPS NO ELEMENT (SCOPE.md:1531), so the subject is
 * `test/fixtures/type-roles-fixture.js` and the entry id is the ROLE FAMILY's name
 * rather than a tag. Both facts are asserted below, because "there is no <ui-title>" is a
 * design decision the inventory depends on, not an omission.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/type-roles.entry.js';

const repo = (p) => new URL(`../${p}`, import.meta.url);

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'type-roles', 'the entry id is the capture-filename prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<type-roles-fixture'), `state ${state.id} mounts no subject`);
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
    // gallery.js does `import(entry.module)` and lives in tools/gallery/, so the path is
    // relative to THAT directory, not to the entry file's own.
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('no raw colour literal and no !important in the stage scaffolding', () => {
    // tools/ is inside Gate C's scan roots and a gallery entry's inline `style="…"` is
    // authored CSS as far as scripts/lib/authored-css.js is concerned. Cheaper to fail
    // here, with the state id in the message, than in the wave gate. Only the `html` is
    // scanned, never the prose: the notes DISCUSS !important (the departure from Slate),
    // and a whole-file grep would read that sentence as a violation.
    for (const state of entry.states) {
        const html = state.html.replace(/&#[0-9]+;/g, '');
        assert.ok(
            !/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(html),
            `state ${state.id} carries a raw colour literal; scaffolding uses --ui-* tokens`,
        );
        assert.ok(!/!important/.test(html), `state ${state.id} carries !important`);
    }
});

test('row #13 defines no custom element - that is the row, not an omission', async () => {
    // SCOPE.md:1531: "Dissolves into the token layer plus a shared style module rather
    // than an element - recorded here so the inventory stays 57-for-57." A <ui-title>
    // appearing later would be a defect, and this is the cheapest place to catch it.
    const module = await readFile(repo('src/components/type-roles.js'), 'utf8');

    // Comments stripped first, and for the reason scripts/lib/authored-css.js gives for
    // doing the same: this file's own prose EXPLAINS that there is no
    // customElements.define here, and a grep over the raw text fails on the sentence
    // that documents the rule.
    const code = module.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/customElements\s*\.\s*define\s*\(/.test(code),
        'src/components/type-roles.js must not define a custom element');
    assert.ok(/export const typeRoles/.test(module), 'the deliverable is the shared fragment');

    // The subject is a fixture, in test/, alongside wave 0a's base-fixture - not a
    // shipping component in src/components/.
    assert.ok(entry.module.includes('test/fixtures/'),
        `the gallery subject must be a fixture, got ${entry.module}`);
});

test('the module consumes only §3.5 tokens, and declares none of its own', async () => {
    const module = await readFile(repo('src/components/type-roles.js'), 'utf8');
    const body = module.slice(module.indexOf('export const typeRoles'));

    // Every token the fragment reads must exist in styles/tokens.css. The check is
    // textual on purpose: the rendering test proves the values, this proves there is no
    // silently-undefined var() whose fallback is "nothing at all".
    const tokens = [...new Set([...body.matchAll(/var\((--ui-[a-z0-9-]+)/g)].map((m) => m[1]))];
    assert.ok(tokens.length >= 10, `expected the fragment to read the type tokens, found ${tokens.length}`);

    const sheet = await readFile(repo('styles/tokens.css'), 'utf8');
    for (const token of tokens) {
        assert.ok(new RegExp(`^\\s*${token}\\s*:`, 'm').test(sheet),
            `${token} is read by type-roles.js but never declared in styles/tokens.css`);
    }

    // Tokens in, nothing out (CONVENTIONS §7): a shared layer that declared its own
    // palette would be bug L12's shape.
    assert.ok(!/^\s*--ui-[a-z0-9-]+\s*:/m.test(body),
        'the fragment must declare no --ui-* token of its own');
});
