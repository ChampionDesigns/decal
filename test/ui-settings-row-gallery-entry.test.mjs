/**
 * The wave-4 #29 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-settings-row.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-settings-row', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-settings-row'),
            `state ${state.id} mounts no ui-settings-row`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it',
    async () => {
        const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
        const info = await stat(resolved);
        assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
    });

test('the sidecar loads the five control archetypes the row exists to hold', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const src = await readFile(resolved, 'utf8');
    for (const tag of ['ui-settings-row', 'ui-stepper', 'ui-switch', 'ui-bank', 'ui-select', 'ui-button']) {
        assert.ok(src.includes(`/src/components/${tag}.js`), `the sidecar never imports ${tag}`);
    }
});

test('the battery photographs T13 with the hazard LIVE, not merely absent', () => {
    const t13 = entry.states.find((s) => s.id === 't13');
    assert.ok(t13, 'the T13 state is the one a reviewer looks at first');
    assert.match(t13.html, /\.content-stretch\.flex\.items-center\.justify-between/,
        'the state must carry \'s class-shape selector');
    assert.match(t13.html, /padding-block:\s*var\(--ui-space-3\)/,
        'and the declaration that displaces the Brightness title');
    assert.match(t13.html, /\[data-settings-row\]/,
        'including line 1292\'s explicit opt-in, which zero elements in Slate use');

    const shaped = t13.html.match(/<ui-settings-row class="content-stretch/g) ?? [];
    assert.equal(shaped.length, 1,
        'exactly one row in the state wears the class shape, so the picture is an A/B: '
        + 'a div displaced by 12px, and two rows that agree to the pixel');
});

test('the states cover every part of the row anatomy spec §4.4 names', () => {
    const html = entry.states.map((s) => s.html).join('\n');
    assert.match(html, /heading="/, 'heading');
    assert.match(html, /hint="/, 'optional range hint');
    assert.match(html, /reading="/, 'optional live reading');
    assert.match(html, /caption="/, 'optional caption');
    assert.match(html, /<ui-switch/, 'and the control slot, with a real control in it');
});

test('no steam limit table, and none of B3\'s retired numbers, anywhere in the entry', () => {
    const html = entry.states.map((s) => `${s.html} ${s.notes ?? ''}`).join('\n');
    assert.ok(!/\b130\b/.test(html), 'the 130 °C dead band is B3\'s retired floor');
    assert.ok(!/\b170\b/.test(html), 'and 170 its retired ceiling');
});
