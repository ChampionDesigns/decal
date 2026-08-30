

import test from 'node:test';
import assert from 'node:assert/strict';

import { splitProfileTitle, groupProfilesByFolder } from '../src/lib/profile-folders.js';

const titleOf = (t) => t;
const shape = (entries) => groupProfilesByFolder(entries, titleOf)
    .map(g => [g.folder, g.entries]);

test('a slash splits into folder and leaf', () => {
    assert.deepEqual(splitProfileTitle('A-Flow / default-dark'),
        { folder: 'A-Flow', leaf: 'default-dark' });
    // No space around the slash is just as common in the bundled set.
    assert.deepEqual(splitProfileTitle('Tea portafilter/oolong'),
        { folder: 'Tea portafilter', leaf: 'oolong' });
});

test('only the FIRST slash splits', () => {
    assert.deepEqual(splitProfileTitle('a/b/c'), { folder: 'a', leaf: 'b/c' });
});

test('a half-empty split is not a family', () => {
    for (const t of ['Trailing/', '/Leading', '/', 'no slash']) {
        assert.equal(splitProfileTitle(t).folder, null, t);
    }
});

test('a folder holding one profile stays a plain row', () => {
    // Same row count, one more tap: strictly worse than the profile itself.
    assert.deepEqual(shape(['Solo / only', 'Plain']), [[null, ['Solo / only']], [null, ['Plain']]]);
});

test('two or more fold', () => {
    const groups = shape(['A-Flow / dark', 'A-Flow / light', 'Plain']);
    assert.deepEqual(groups[0], ['A-Flow', ['A-Flow / dark', 'A-Flow / light']]);
    assert.deepEqual(groups[1], [null, ['Plain']]);
});

test('a folder appears where its first member would have sorted', () => {
    const groups = shape(['Aaa', 'M-Fam / one', 'Nnn', 'M-Fam / two', 'Zzz']);
    assert.deepEqual(groups.map(g => g[0]), [null, 'M-Fam', null, null]);
    assert.deepEqual(groups[1][1], ['M-Fam / one', 'M-Fam / two']);
});

test('members are collected even when the list interleaves them', () => {
    const groups = shape(['X / a', 'other', 'X / b']);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0], ['X', ['X / a', 'X / b']]);
});
