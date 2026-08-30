// Families that nobody named with a slash.
//
// The folder rule was "the text before the first slash", which is the Decent
// convention and covers the bundled sets — A-Flow, Tea portafilter, Pour over
// basket. It covers nothing a person adds later. On Ben's machine that left
// four "Damian's …", four "Baseline • …", two "Espresso Forge …" and two
// "Filter 2.x" as loose rows in a 79-row list, all obviously families to a
// human and invisible to the rule.
//
// The cases below are taken from that machine's actual library, because the
// interesting failures are the ones a made-up example does not have.
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitProfileTitle, deriveTitleFamilies, folderLeaf, groupProfilesByFolder }
    from '../src/lib/profile-folders.js';

const REAL = [
    'Baseline • Ultra Low Contact', 'Baseline • Medium Contact • 6 Bar',
    'Baseline • Low Contact • 4 Bar', 'Baseline • High Contact • 8 Bar',
    "Damian's Q", "Damian's LRv3", "Damian's LRv2", "Damian's LM Leva",
    'Espresso Forge Light', 'Espresso Forge Dark',
    'Filter 2.1', 'Filter 2.0', 'Filter3',
    "I Can't Believe It's Not Filter", 'I got your back',
    'A-Flow / default-dark', 'A-Flow / default-light',
    'Tea portafilter/black tea', 'Tea/in a basket',
    'Flow profile for straight espresso', 'Flow profile for milky drinks',
    'Soup 58', 'PSPH',
];

const folders = (titles) => groupProfilesByFolder(titles, t => t)
    .filter(g => g.folder).map(g => [g.folder, g.entries.length]);

test('a bullet names a family the same way a slash does', () => {
    // The Baseline set is four profiles separated with "•". Nothing else about
    // it differs from the slash convention.
    assert.deepEqual(splitProfileTitle('Baseline • Medium Contact • 6 Bar'),
        { folder: 'Baseline', leaf: 'Medium Contact • 6 Bar' },
        'only the FIRST delimiter splits — the second bullet is part of the name');
});

test('families are found in the titles when nobody used a delimiter', () => {
    const found = Object.fromEntries(folders(REAL));
    assert.equal(found['Baseline'], 4);
    assert.equal(found["Damian's"], 4);
    assert.equal(found['Espresso Forge'], 2);
    assert.equal(found['Filter'], 2);
});

test('the longest shared prefix wins, so a family is as specific as it can be', () => {
    // "Espresso Forge Light" and "Espresso Forge Dark" share two words. Taking
    // the first word would file them under "Espresso" — a folder whose name
    // describes most of the library.
    const map = deriveTitleFamilies(['Espresso Forge Light', 'Espresso Forge Dark']);
    assert.equal(map.get('Espresso Forge Light'), 'Espresso Forge');
});

test('every member keeps a name of its own', () => {
    // "Temp test" and "Temp test 2" share both words of the shorter title, and
    // a folder called "Temp test" would leave one row with nothing to display.
    // Backing off one word gives "test" and "test 2", which are both real.
    const map = deriveTitleFamilies(['Temp test', 'Temp test 2']);
    assert.equal(map.get('Temp test'), 'Temp');
    assert.equal(folderLeaf('Temp test', 'Temp'), 'test');
    assert.equal(folderLeaf('Temp test 2', 'Temp'), 'test 2');
});

test('one weak word does not make a family', () => {
    // MEASURED failure, not a hypothetical: "I Can't Believe It's Not Filter"
    // and "I got your back" share their first word, and the first version of
    // this rule put both in a folder called "I".
    assert.deepEqual(folders(["I Can't Believe It's Not Filter", 'I got your back']), []);
    // And a family is words, never characters — otherwise "…Not Filter" files
    // under Filter, which is the one place nobody would look for it.
    const found = Object.fromEntries(folders(REAL));
    assert.equal(found['Filter'], 2, 'Filter 2.1 and 2.0, and nothing else');
});

test('an author-named family is never broken up by a coincidental shared word', () => {
    // "Tea portafilter/black tea" and "Tea/in a basket" both start with "Tea".
    // The delimiter said what the families are; the derived rule only ever
    // looks at what is left over.
    const found = Object.fromEntries(folders(REAL));
    assert.ok(!('Tea' in found),
        'the two slash-named Tea profiles must not be pulled into a derived "Tea" folder');
});

test('a folder of one is worse than no folder', () => {
    assert.deepEqual(folders(['Solo profile one', 'Something else entirely']), []);
});

test('leaves strip the folder however it was written', () => {
    assert.equal(folderLeaf('A-Flow / default-dark', 'A-Flow'), 'default-dark');
    assert.equal(folderLeaf('Baseline • Low Contact • 4 Bar', 'Baseline'), 'Low Contact • 4 Bar');
    assert.equal(folderLeaf("Damian's LRv3", "Damian's"), 'LRv3');
    assert.equal(folderLeaf('Soup 58', null), 'Soup 58', 'ungrouped rows keep their whole title');
});

test('grouping is display-only and never renames anything', () => {
    // The titles that come out are the titles that went in.
    const out = groupProfilesByFolder(REAL, t => t).flatMap(g => g.entries);
    assert.deepEqual([...out].sort(), [...REAL].sort());
});
