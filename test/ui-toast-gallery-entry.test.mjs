/**
 * The wave-3 #22 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-toast.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-toast', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-toast'), `state ${state.id} mounts no ui-toast`);
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

/**
 * THE TWO THINGS THIS COMPONENT NEEDS FROM ITS STAGE, and the reason they are asserted
 * rather than trusted: both failures are invisible in review and loud in the baseline.
 */
test('every state anchors to its stage, and the stage is positioned', () => {
    for (const state of entry.states) {
        assert.ok(
            /<ui-toast[^>]*\banchor="container"/.test(state.html),
            `state ${state.id}: a position: fixed layer without anchor="container" lands in the `
            + 'window corner on top of the gallery chrome, identically for every state',
        );
        assert.equal(
            state.hostStyle?.position, 'relative',
            `state ${state.id}: anchor="container" needs a positioned ancestor, and hostStyle `
            + 'is applied to the STAGE WRAPPER — that is what makes it one',
        );
        assert.ok(state.hostStyle?.['block-size'],
            `state ${state.id}: the stage needs a height, or a bottom-pinned layer has nothing to pin to`);
    }
});

test('every notice in every state is sticky, or the battery photographs an empty stage', () => {
    for (const state of entry.states) {
        const notices = state.html.match(/<div\b[^>]*>/g) ?? [];
        assert.ok(notices.length > 0, `state ${state.id} has no notice`);
        for (const tag of notices) {
            assert.match(
                tag, /\bduration="0"/,
                `state ${state.id}: ${tag} has no duration="0" — the default is 2400ms `
                + '(ui.js:3283) and the capture battery drives three geometries over the '
                + 'same state, so a clocked notice is gone before the shutter opens',
            );
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
        for (const value of Object.values(state.hostStyle ?? {})) {
            assert.ok(
                !/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(String(value)),
                `state ${state.id} hostStyle carries a raw colour literal`,
            );
        }
    }
});
