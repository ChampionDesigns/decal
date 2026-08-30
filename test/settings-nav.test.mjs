
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    SETTINGS_TREE,
    NAV_KIND,
    navName,
    categoryFor,
    categoryOf,
    leafFor,
    allLeaves,
    isSearching,
    searchSettings,
    shownOnMachine,
    leafShownOn,
    rowShownOn,
    leavesFor,
} from '../src/lib/settings-nav.js';

const SOURCE = readFileSync(
    fileURLToPath(new URL('../src/lib/settings-nav.js', import.meta.url)), 'utf8',
);

describe('the settings tree', () => {
    test('ten categories and thirty-two leaves', () => {
        assert.equal(SETTINGS_TREE.length, 10);
        assert.equal(allLeaves().length, 32,
            'SCOPE Part 5 §4 cut 37; three merges on 28 Aug 2026 took it to 32');
    });

    test('every id is unique and every leaf is reachable from exactly one category', () => {
        const ids = [...SETTINGS_TREE.map((c) => c.id), ...allLeaves().map((l) => l.id)];
        assert.equal(new Set(ids).size, ids.length, `duplicate id in the tree: ${ids}`);

        for (const leaf of allLeaves()) {
            const owners = SETTINGS_TREE.filter((c) => c.leaves.some((l) => l.id === leaf.id));
            assert.equal(owners.length, 1, `${leaf.id} is reachable from ${owners.length} categories`);
            assert.equal(categoryOf(leaf.id).id, owners[0].id);
        }
    });

    test('the tree is frozen all the way down', () => {
        assert.ok(Object.isFrozen(SETTINGS_TREE));
        for (const category of SETTINGS_TREE) {
            assert.ok(Object.isFrozen(category), category.id);
            assert.ok(Object.isFrozen(category.leaves), category.id);
            for (const leaf of category.leaves) assert.ok(Object.isFrozen(leaf), leaf.id);
        }
    });

    test('lookups answer, and an unknown id is a null rather than a throw', () => {
        assert.equal(categoryFor('machine').name, 'Machine');
        assert.equal(leafFor('machine-steam').name, 'Steam');
        assert.equal(categoryFor('nope'), null);
        assert.equal(leafFor('nope'), null);
        assert.equal(categoryOf('nope'), null);
    });

    test('a leaf row carries a name, an id, and at most the machines it belongs to', () => {
        const ALLOWED = ['id', 'machines', 'name'];
        let withMachines = 0;
        for (const leaf of allLeaves()) {
            const keys = Object.keys(leaf).sort();
            assert.ok(keys.every((k) => ALLOWED.includes(k)),
                `${leaf.id} carries a key the tree does not define: ${keys}`);
            assert.ok(keys.includes('id') && keys.includes('name'), `${leaf.id} lacks id or name`);
            if (keys.includes('machines')) withMachines += 1;
        }
        assert.equal(withMachines, 0,
            'no leaf is machine-dependent since the flow-multiplier gate moved to its rows');
    });

    describe('the machine-class gate is one rule, whatever level it is asked at', () => {
        const GATED = { id: 'x', machines: ['de1'] };
        const UNGATED = { id: 'y' };

        test('a node with no machines list is shown everywhere', () => {
            for (const cls of ['bengle', 'de1', null, undefined]) {
                assert.equal(shownOnMachine(UNGATED, cls), true);
            }
        });

        test('a gated node is shown to the classes it names, and to nobody else', () => {
            assert.equal(shownOnMachine(GATED, 'de1'), true);
            assert.equal(shownOnMachine(GATED, 'bengle'), false);
        });

        test('AN UNKNOWN CLASS SHOWS EVERYTHING, and it is the half that is easy to get wrong', () => {
            assert.equal(shownOnMachine(GATED, null), true);
            assert.equal(shownOnMachine(GATED, undefined), true);
        });

        test('the leaf name and the row name are the same rule, over the same inputs', () => {
            for (const node of [GATED, UNGATED, null, undefined]) {
                for (const cls of ['bengle', 'de1', null]) {
                    const base = shownOnMachine(node, cls);
                    assert.equal(leafShownOn(node, cls), base,
                        'leafShownOn must not answer its own way');
                    assert.equal(rowShownOn(node, cls), base,
                        'rowShownOn must not answer its own way');
                }
            }
        });

        test('every leaf is on every machine, which is what leavesFor now reports', () => {
            for (const category of SETTINGS_TREE) {
                for (const cls of ['bengle', 'de1', null]) {
                    assert.equal(leavesFor(category, cls).length, category.leaves.length,
                        `${category.id} hides a leaf on ${cls}`);
                }
            }
        });

        test('search hides nothing by class either, for the same reason', () => {
            const onBengle = searchSettings('flow', SETTINGS_TREE, 'bengle');
            const onDe1 = searchSettings('flow', SETTINGS_TREE, 'de1');
            assert.deepEqual(onBengle.map((r) => r.node.id), onDe1.map((r) => r.node.id));
            assert.ok(onBengle.some((r) => r.node.id === 'calibration-flow-multiplier'),
                'the Flow Multiplier page is reachable from search on a Bengle now');
        });
    });
});

describe('T12: search names and browse names cannot differ', () => {
    test('navName takes one argument, so an ordinal has nowhere to come from', () => {
        assert.equal(navName.length, 1,
            'a second parameter is where "1. " came from: an index in scope at naming time');
    });

    test('no name in the model carries an ordinal or a numeric prefix', () => {
        for (const node of [...SETTINGS_TREE, ...allLeaves()]) {
            assert.doesNotMatch(navName(node), /^\s*\d+\s*[.)]/,
                `${node.id} carries the prefix T12 resurrects`);
        }
    });

    test('a search result IS the tree node, not a copy of it', () => {
        // The assertion no reformatting can slip past.
        const results = searchSettings('machine');
        assert.ok(results.length > 0);
        for (const row of results) {
            const original = row.kind === NAV_KIND.CATEGORY
                ? categoryFor(row.node.id)
                : leafFor(row.node.id);
            assert.ok(Object.is(row.node, original),
                `${row.node.id}: the search path built a new object, which is where a prefix goes`);
        }
    });

    const NAME_INSIDE_ITS_CATEGORY = new Set(['units-language-units']);

    test('every leaf and every category names identically on both paths', () => {
        for (const node of [...SETTINGS_TREE, ...allLeaves()]) {
            const browsed = navName(node);
            const results = searchSettings(browsed);
            const mine = results.find((result) => result.node.id === node.id);
            assert.ok(mine, `${node.id} is not findable by its own name`);
            assert.equal(navName(mine.node), browsed);

            if (NAME_INSIDE_ITS_CATEGORY.has(node.id)) {
                assert.notEqual(navName(results[0].node), browsed,
                    `${node.id} no longer collides — take it out of NAME_INSIDE_ITS_CATEGORY`);
                continue;
            }
            assert.equal(navName(results[0].node), browsed,
                `searching "${browsed}" offers "${navName(results[0].node)}" first — a new name `
                + 'collision. Rename it, rank exact matches first, or add it above with a reason.');
        }
    });

    test('the module names no index and formats no name', () => {
        assert.doesNotMatch(SOURCE, /\$\{\s*(i|index|n|ordinal)\s*\+/,
            'a name is being assembled from a position');
        assert.equal((SOURCE.match(/function navName/g) ?? []).length, 1,
            'exactly one naming function');
    });
});

describe('searchSettings', () => {
    test('a blank query is not a search', () => {
        for (const query of ['', '   ', null, undefined, 7]) {
            assert.equal(isSearching(query), false, JSON.stringify(query));
            assert.deepEqual(searchSettings(query), []);
        }
    });

    test('it matches categories and leaves alike, and says which is which', () => {
        const kinds = new Set(searchSettings('machine').map((r) => r.kind));
        assert.deepEqual([...kinds].sort(), ['category', 'leaf'],
            'Part 5 §4: search across categories AND leaves');
    });

    test('every result carries the category to select when it is pressed', () => {
        for (const row of searchSettings('e')) {
            assert.ok(SETTINGS_TREE.includes(row.category));
            if (row.kind === NAV_KIND.LEAF) {
                assert.equal(categoryOf(row.node.id).id, row.category.id);
            } else {
                assert.equal(row.category.id, row.node.id, 'a category result is its own category');
            }
        }
    });

    test('results come back in browse order — search does not reshuffle the app', () => {
        const order = [];
        for (const category of SETTINGS_TREE) {
            order.push(category.id);
            for (const leaf of category.leaves) order.push(leaf.id);
        }
        const results = searchSettings('a').map((r) => r.node.id);
        const positions = results.map((id) => order.indexOf(id));
        assert.deepEqual([...positions].sort((x, y) => x - y), positions,
            'a second order is a second presentation of the same list');
    });

    test('matching is case-insensitive and on the name only', () => {
        assert.equal(searchSettings('STEAM')[0].node.id, 'machine-steam');
        assert.equal(searchSettings('steam')[0].node.id, 'machine-steam');
        assert.deepEqual(searchSettings('machine-steam'), []);
    });

    test('a query nothing matches is an empty list, not a throw and not everything', () => {
        assert.deepEqual(searchSettings('zzzzz'), []);
    });
});

describe('a category names its leaves in one voice', () => {
    const MINOR = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'up']);

    /** Title case = every significant word starts upper. A word with no letters abstains. */
    const isTitleCase = (name) => name
        .split(/\s+/)
        .filter((word) => /[a-z]/i.test(word))
        .filter((word, index) => index === 0 || !MINOR.has(word.toLowerCase()))
        .every((word) => word[0] === word[0].toUpperCase());

    for (const category of SETTINGS_TREE) {
        test(`${category.name}: every leaf name reads in the same case as its siblings`, () => {
            const cased = category.leaves.map((leaf) => ({ name: leaf.name, title: isTitleCase(leaf.name) }));
            const odd = cased.filter((row) => row.title !== cased[0].title);
            assert.deepEqual(odd, [],
                `${category.name} mixes casing: ${JSON.stringify(cased)}`);
        });
    }
});
