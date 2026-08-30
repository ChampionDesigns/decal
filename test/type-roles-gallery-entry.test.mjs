/**
 * The wave-1 #13 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('no raw colour literal and no !important in the stage scaffolding', () => {
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
    const module = await readFile(repo('src/components/type-roles.js'), 'utf8');

    const code = module.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/customElements\s*\.\s*define\s*\(/.test(code),
        'src/components/type-roles.js must not define a custom element');
    assert.ok(/export const typeRoles/.test(module), 'the deliverable is the shared fragment');

    assert.ok(entry.module.includes('test/fixtures/'),
        `the gallery subject must be a fixture, got ${entry.module}`);
});

test('the module consumes only §3.5 tokens, and declares none of its own', async () => {
    const module = await readFile(repo('src/components/type-roles.js'), 'utf8');
    const body = module.slice(module.indexOf('export const typeRoles'));

    const tokens = [...new Set([...body.matchAll(/var\((--ui-[a-z0-9-]+)/g)].map((m) => m[1]))];
    assert.ok(tokens.length >= 10, `expected the fragment to read the type tokens, found ${tokens.length}`);

    const sheet = await readFile(repo('styles/tokens.css'), 'utf8');
    for (const token of tokens) {
        assert.ok(new RegExp(`^\\s*${token}\\s*:`, 'm').test(sheet),
            `${token} is read by type-roles.js but never declared in styles/tokens.css`);
    }

    assert.ok(!/^\s*--ui-[a-z0-9-]+\s*:/m.test(body),
        'the fragment must declare no --ui-* token of its own');
});
