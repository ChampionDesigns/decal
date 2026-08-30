/**
 * The wave-4 #47 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-stop-button.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-stop-button', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-stop-button'), `state ${state.id} mounts no ui-stop-button`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
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

test('a state that mounts a second component points at the demo module that imports it', () => {
    const usesStepper = entry.states.some((s) => s.html.includes('<ui-stepper'));
    assert.ok(usesStepper, 'the rail pair is the reason this entry has a demo module at all');
    assert.match(entry.module, /\.demo\.js$/,
        'a multi-component entry must load through a demo module, not straight at one component');
});

test('rail-idle and rail-running differ by exactly the running attribute', () => {
    const idle = entry.states.find((s) => s.id === 'rail-idle');
    const running = entry.states.find((s) => s.id === 'rail-running');
    assert.ok(idle && running, 'both halves of the pair exist');
    assert.deepEqual(idle.hostStyle, running.hostStyle, 'same stage width, or the diff is a resize');
    assert.equal(running.html.replace(' running', ''), idle.html,
        'the only difference between the two captures is the control being there');
});
