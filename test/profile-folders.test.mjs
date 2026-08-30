// PORTED from Slate test/profile-folders.test.mjs (w0a-port-as-is).
//
// The Slate file is MIXED: its first 62 lines execute profile-folders.js (7
// tests); its remaining 132 lines are 12 text-scan tests that readFileSync
// `src/modules/profile_selector.js` and `src/css/slate-shell.css` and match
// regexes against their source text. Neither file exists in Decal and neither
// will: profile_selector.js is a DOM module being rewritten, slate-shell.css
// dies with the markup. CARRY_FORWARD.md §7 rules the text-scan style out
// wholesale -- "Text-scan only ... none ports ... Every one of them dies with
// the markup" -- and test/README.md restates it as a decision (A8, executing
// tests only). So the executing half ports verbatim and the text-scan half is
// dropped; `import { readFileSync }` goes with the tests that used it.
//
// The 12 dropped assertions are RENDERING rules, not logic rules, and they are
// re-owned rather than lost: 8 belong to the rewritten profile-list component
// (force-open on filter, non-persistence of a force-open, list-wide selection
// clear, leaf text + whole title in data, folder row is a <button> with
// aria-expanded, collapsed count, chevron rotation + reduced-motion, open
// folder is a container not a row) and 4 to the favourite slot (tap not hold,
// badge refresh on every row, badge is the slot one size down, badge at the row
// edge). Gate A asserts those on computed styles and behaviour, not source
// text. Itemised in realine-run/waves/0a/w0a-port-as-is.md.

// Collapsible families in the profile list.
//
// ReaPrime seeds ~70 bundled profiles and a third of them are families whose
// titles all start with the same words. The grouping is the title's own
// structure -- the text before the first slash -- so nothing has to be tagged
// and a profile that does not use the convention is simply not in a folder.
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
    // "Pour over basket/V60 22g in, 375g out" must not become a three-level
    // tree, and a leaf containing a slash keeps it.
    assert.deepEqual(splitProfileTitle('a/b/c'), { folder: 'a', leaf: 'b/c' });
});

test('a half-empty split is not a family', () => {
    // "Half/" and "/half" produce either a folder you cannot label or a row
    // with no name.
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
    // Turning folders on must not re-order the list around them: the row you
    // were reaching for should not move somewhere else alphabetically.
    const groups = shape(['Aaa', 'M-Fam / one', 'Nnn', 'M-Fam / two', 'Zzz']);
    assert.deepEqual(groups.map(g => g[0]), [null, 'M-Fam', null, null]);
    assert.deepEqual(groups[1][1], ['M-Fam / one', 'M-Fam / two']);
});

test('members are collected even when the list interleaves them', () => {
    const groups = shape(['X / a', 'other', 'X / b']);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0], ['X', ['X / a', 'X / b']]);
});
