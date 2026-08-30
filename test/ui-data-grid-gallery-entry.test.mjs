/**
 * The wave-4 #34 gallery entry, checked against the contract tools/gallery/entries.js documents.
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
    assert.match(entry.module, /ui-data-grid\.demo\.js$/,
        'the entry must point at the demo sidecar, not at src/components/ui-data-grid.js');

    const source = await readFile(
        new URL(entry.module, new URL('../tools/gallery/', import.meta.url)), 'utf8',
    );
    for (const tag of DEMO_TAGS) {
        assert.ok(source.includes(`customElements.define('${tag}'`),
            `the sidecar does not define <${tag}>, so a state mounting it is an unknown element`);
    }
    assert.ok(source.includes('ui-empty-state.js'),
        'the sidecar must import #38 for the empty state, or the slot photographs as bare text');
});

test('every slot name a state writes is a cell slot the grid can offer', () => {
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
