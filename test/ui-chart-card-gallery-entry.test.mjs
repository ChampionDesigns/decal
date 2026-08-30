/**
 * The wave-3 #9 gallery entry, checked against the contract tools/gallery/entries.js documents.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

import { entry } from '../tools/gallery/entries/ui-chart-card.entry.js';

const repo = (path) => new URL(`../${path}`, import.meta.url);

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-chart-card', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.module, 'string');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.match(state.html, /<ui-chart-card(-shot)?[\s>]/,
            `state ${state.id} mounts no chart card`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique, because they are capture filenames', () => {
    const ids = entry.states.map((s) => `${entry.id}--${s.id}`);
    assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('every state gives the card a BLOCK size — uPlot sizes from clientHeight', () => {
    for (const state of entry.states) {
        assert.match(state.html, /block-size:\s*\d+px/,
            `state ${state.id} would build its plot at height 0`);
    }
});

test('the container state changes the HOST, not the viewport', () => {
    const narrow = entry.states.find((s) => s.id === 'narrow-container');
    assert.ok(narrow, 'the entry must show the card at a narrower container');
    assert.deepEqual(narrow.hostStyle, { 'inline-size': '380px' },
        'hostStyle is applied to the stage wrapper: same viewport, narrower host '
        + '(spec §2.1 Rule 1 — a component reads its own container)');
});

test('the empty state mounts the SHIPPING tag, and it is the only one that needs no shot', () => {
    const empty = entry.states.find((s) => s.id === 'no-shot');
    assert.ok(empty, 'the refusal is a photographable state');
    assert.match(empty.html, /<ui-chart-card\s/, 'the plain component, not the demo subclass');
    assert.match(empty.html, /slot="empty"/, 'with the consumer\'s own words in the empty slot');
    assert.doesNotMatch(empty.html, /ui-chart-card-shot/);
});

test('the module path resolves from tools/gallery/, which is where gallery.js imports it', async () => {
    const resolved = new URL(entry.module, new URL('../tools/gallery/', import.meta.url));
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${entry.module} does not resolve to a file`);
});

test('the demo drives a REAL recorded shot, and the fixture it names exists', async () => {
    const source = await readFile(repo('tools/gallery/entries/ui-chart-card.demo.js'), 'utf8');
    const match = source.match(/rea-fixtures\/(api__v1__shots__[\w-]+\.json)/);
    assert.ok(match, 'the demo must name a recorded shot from tools/rea-fixtures/');
    const fixture = await stat(repo(`tools/rea-fixtures/${match[1]}`));
    assert.ok(fixture.isFile(), `${match[1]} is missing`);

    assert.match(source, /deriveFromRecord/,
        'and it must go through gate 6\'s derivation — the card takes a derivation and '
        + 'nothing else, so a demo that hand-built series would be testing a different card');
    assert.doesNotMatch(source, /fetch\((?!SHOT_URL)/,
        'no endpoint: the only fetch is the fixture file');
});

test('the demo defers updateComplete until the shot has drawn', async () => {
    const source = await readFile(repo('tools/gallery/entries/ui-chart-card.demo.js'), 'utf8');
    assert.match(source, /async getUpdateComplete\s*\(/);
    assert.match(source, /await this\.#loaded/);

    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /await this\.updateComplete/,
        'awaiting updateComplete inside the promise getUpdateComplete awaits is a deadlock');
    assert.match(source, /this\.performUpdate\(\)/);
});
