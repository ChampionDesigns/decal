/**
 * The wave-1 #14 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the module is the adoption hook, because item #14 has no element to mount', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const source = await readFile(resolved, 'utf8');
    assert.match(source, /adoptSeams\s*\(\s*document\s*\)/, 'the demo module must adopt the fragment');
    assert.match(source, /from '\.\.\/\.\.\/\.\.\/src\/components\/seams\.js'/,
        'the demo module must import the ONE fragment, not a copy of its rules');
});

test('no state invents a class the fragment does not define', () => {
    for (const state of entry.states) {
        for (const match of state.html.matchAll(/class="([^"]*)"/g)) {
            for (const cls of match[1].split(/\s+/).filter(Boolean)) {
                assert.ok(CLASSES.includes(cls), `state ${state.id} uses undefined class .${cls}`);
            }
        }
    }
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
