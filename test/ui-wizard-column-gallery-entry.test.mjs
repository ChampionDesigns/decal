/**
 * The wave-4 #39 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-wizard-column.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-wizard-column', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-wizard-column'),
            `state ${state.id} mounts no ui-wizard-column`);
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

test('the sidecar imports every tag the states put on the stage', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const src = await readFile(resolved, 'utf8');
    for (const tag of ['ui-wizard-column', 'ui-card', 'ui-button']) {
        assert.ok(src.includes(`/src/components/${tag}.js`), `the sidecar never imports ${tag}`);
    }
});

test('T1 is photographed at two container widths, which is the only way a cap shows up', () => {
    const widths = entry.states.map((s) => s.hostStyle?.['inline-size']).filter(Boolean);
    assert.ok(new Set(widths).size >= 2,
        `the states must be photographed at more than one container width: ${widths.join(', ')}`);
    assert.ok(entry.states.some((s) => s.id === 'narrow'),
        'the narrow state is the one a reviewer looks at for the wrap');
});

test('the walk is photographed with a step BEHIND it, which Slate never captured', () => {
    const midWalk = entry.states.find((s) => s.id === 'mid-walk');
    assert.ok(midWalk, 'the mid-walk state is where the done/current/ahead trio is visible');
    assert.match(midWalk.html, /current="3"/);
});

test('one state ships no action at all — the F3 hole, as a state rather than a TODO', () => {
    const bare = entry.states.find((s) => s.id === 'no-actions');
    assert.ok(bare, 'the no-actions state records the hole');
    assert.ok(!bare.html.includes('slot="actions"'), 'the state must slot no action');
    for (const state of entry.states) {
        assert.ok(!/reset|default/i.test(state.html),
            `state ${state.id} puts a reset control on the stage — F3 is blocked on Ben `
            + 'and the run does no work of any kind on it');
    }
});
