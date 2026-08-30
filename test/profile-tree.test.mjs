/**
 * profile-tree.test.mjs — the family tree's own arithmetic.
 *
 * WHY IT IS A TREE AND NOT A LISTBOX. Ben, 24 August 2026: "Make families collapse."
 * `role="listbox"` owns options and groups and nothing else — the selector's own P12 test
 * names "a folder disclosure's head row" as the failure it exists to catch — so a
 * collapsible grouped single-select list has to be a tree. What is proved here is the two
 * pure pieces that made that cheap: which nodes are VISIBLE, and what the two sideways
 * keys mean from each kind of node. The rendering is
 * `test/render/selector-core-loop.render.test.mjs`'s.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { treeNodes, treeSideStep, nextActiveIndex } from '../src/lib/profile-listbox.js';

/** Three families of three, plus two records that group with nothing. */
const record = (title) => ({ id: `p:${title}`, profile: { title } });
const RECORDS = [
    record('Blooming espresso'), record('Blooming filter'), record('Blooming long'),
    record('Londinium one'), record('Londinium two'), record('Londinium three'),
    record('Best practice'),
];

describe('what the tree shows', () => {
    test('with nothing open, a family is one row and its members are absent', () => {
        const nodes = treeNodes(RECORDS, new Set());
        const folders = nodes.filter((n) => n.kind === 'folder');
        assert.ok(folders.length >= 2, 'the fixture groups into families');
        assert.equal(nodes.filter((n) => n.kind === 'profile' && n.folder).length, 0,
            'no member of a shut family is in the walk — folding that only hides is not folding');
        assert.ok(folders.every((f) => f.open === false));
    });

    test('a family carries its own count, so the row can say what folding costs', () => {
        const nodes = treeNodes(RECORDS, new Set());
        const blooming = nodes.find((n) => n.kind === 'folder' && n.folder === 'Blooming');
        assert.ok(blooming);
        assert.equal(blooming.count, 3);
    });

    test('opening one family adds exactly its members, in order', () => {
        const nodes = treeNodes(RECORDS, new Set(['Blooming']));
        const members = nodes.filter((n) => n.kind === 'profile' && n.folder === 'Blooming');
        assert.equal(members.length, 3);
        assert.deepEqual(members.map((n) => n.record.profile.title),
            ['Blooming espresso', 'Blooming filter', 'Blooming long']);
        assert.equal(nodes.filter((n) => n.kind === 'profile' && n.folder === 'Londinium').length, 0);
    });

    test('a record that groups with nothing is a bare row with no family above it', () => {
        const nodes = treeNodes(RECORDS, new Set());
        const loose = nodes.filter((n) => n.kind === 'profile' && n.folder === null);
        assert.ok(loose.some((n) => n.record.profile.title === 'Best practice'),
            'profile-folders.js declines to make a folder of one, and the tree follows it');
    });

    test('an empty listing is an empty walk, not a family of nothing', () => {
        assert.deepEqual(treeNodes([], new Set()), []);
    });

    test('the open set may arrive as an array — a stored value is JSON', () => {
        const nodes = treeNodes(RECORDS, ['Londinium']);
        assert.ok(nodes.some((n) => n.kind === 'profile' && n.folder === 'Londinium'));
    });
});

describe('what Left and Right mean, from each kind of node', () => {
    const shut = treeNodes(RECORDS, new Set());
    const open = treeNodes(RECORDS, new Set(['Blooming']));

    test('the two keys reach the walk at all', () => {
        assert.equal(nextActiveIndex('ArrowRight', 0, 5), 'open');
        assert.equal(nextActiveIndex('ArrowLeft', 0, 5), 'close');
    });

    test('Right on a shut family opens it', () => {
        const at = shut.findIndex((n) => n.kind === 'folder');
        assert.deepEqual(treeSideStep('open', shut, at), { open: shut[at].folder });
    });

    test('Right on an open family steps to its first member', () => {
        const at = open.findIndex((n) => n.kind === 'folder' && n.open);
        assert.deepEqual(treeSideStep('open', open, at), { index: at + 1 });
    });

    test('Left on an open family shuts it', () => {
        const at = open.findIndex((n) => n.kind === 'folder' && n.open);
        assert.deepEqual(treeSideStep('close', open, at), { close: open[at].folder });
    });

    test('Left on a member steps out to its family', () => {
        const family = open.findIndex((n) => n.kind === 'folder' && n.open);
        assert.deepEqual(treeSideStep('close', open, family + 2), { index: family });
    });

    test('and the four cases have no fifth', () => {
        /* Right on a profile has nothing to step into; Left on a top-level profile has no
         * parent to step out to; a shut family cannot be shut again. */
        const loose = shut.findIndex((n) => n.kind === 'profile' && n.folder === null);
        assert.equal(treeSideStep('open', shut, loose), null);
        assert.equal(treeSideStep('close', shut, loose), null);
        const family = shut.findIndex((n) => n.kind === 'folder');
        assert.equal(treeSideStep('close', shut, family), null);
        assert.equal(treeSideStep('open', shut, 9999), null);
        assert.equal(treeSideStep('sideways', shut, family), null);
    });
});
