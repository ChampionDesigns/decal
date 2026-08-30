// THE SETTINGS NAV MODEL, AND T12 — wave 5.4, rows `settings-search` and
// `settings-shell-skeleton`.
//
// §7.5 T12: "Searching restores the ordinals the design removed — 'Machine' becomes
// '1. Machine' — and re-adds numeric prefixes to leaf names that the non-search path
// strips" (`settings.js:8353-8358, 8487` vs `:6409-6411`).
//
// The defect was two writers, one of which could see a POSITION. So the assertions here
// are about the SHAPE of the naming path, not about a pair of strings that happen to
// match today:
//
//   1. `navName` takes one argument. An arity of 1 means no caller can hand it an index.
//   2. `searchSettings` returns the tree's OWN frozen node objects, asserted with
//      Object.is — a search path that wanted to prepend "1. " would have to build a new
//      object first, and that is the assertion it would fail.
//   3. No name in the model matches /^\d+\./ to begin with, so the browse path has
//      nothing to "strip" and cannot fall out of step with a path that does not strip.
//
// SOURCE-LEVEL, DELIBERATELY. This module is DOM-free (SCOPE Part 2 §2), so T12 is a
// node test rather than a render test that has to photograph two lists. The render
// suite still checks the RENDERED names, because a screen could always re-decorate what
// the model handed it — the two together are what make the claim hold.
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

/* ===========================================================================
 * 1. THE TREE — ten categories, thirty-seven leaves, every one reachable once
 * =========================================================================== */

describe('the settings tree', () => {
    test('ten categories and thirty-two leaves', () => {
        // T18's own arithmetic got the first number wrong ("10 categories, not 11"),
        // which is half of why C4 stopped pinning the row pitch to a row count.
        assert.equal(SETTINGS_TREE.length, 10);
        // THIRTY-SEVEN AGAIN, and back to the number SCOPE states. The tree was cut at
        // 37, gained a DYE2 leaf when the plugin pages were built, and lost it again on
        // 26 August 2026 — Ben: "delete the DYE2 leaf and move what it does into
        // Plugins". A page for one plugin, beside a page that lists every plugin.
        /* THIRTY-TWO SINCE 28 AUGUST 2026. SCOPE's 37 was the shape at the cut; three
         * merges took out five pages that each asked one question spread over two or
         * three. The categories did not move — Ben kept enough pages apart that none
         * drops below two leaves. */
        assert.equal(allLeaves().length, 32,
            'SCOPE Part 5 §4 cut 37; three merges on 28 Aug 2026 took it to 32');
    });

    test('every id is unique and every leaf is reachable from exactly one category', () => {
        // T7 is "76 lines of :has() stepper CSS written for a page that is UNREACHABLE —
        // its renderer is dispatched for two cases no settingsTree entry uses". A leaf
        // that no category names is that state, and the model cannot be in it.
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
        // The spine, not the leaves: which of the 37 compose #29 and which are the
        // bespoke ones is another row's, and it ADDS fields to these nodes.
        //
        // ONE OPTIONAL THIRD KEY, AND NO LEAF CARRIES IT TODAY — which is a change of
        // COUNT, not of shape, and is worth reading rather than skimming.
        //
        // `calibration-flow-multiplier` was the one machine-dependent page, gated
        // `machines: ['de1']` on Ben's 26 August answer. On 27 August that gate moved DOWN
        // to the two rows his reasoning was actually about, because the third row on that
        // page — the weight flow multiplier, which is stop-lag lookahead and not a flow
        // calibration at all — is live on a Bengle and would have gone with the page. So
        // the page is on both machines now and two of its three rows are not.
        //
        // THE COUNT IS ASSERTED AT ZERO RATHER THAN THE ASSERTION BEING DELETED. A leaf
        // gate that quietly grew back would mean a whole page had been hidden from a
        // machine without anyone arguing for it, and this is the line that would say so.
        // The `machines` KEY stays in the allowed set and `leafShownOn` stays exported:
        // both still work, both are still called on every leaf by the sub-nav and the
        // search, and a genuinely machine-only PAGE is the thing they are for. What has no
        // instance today is the data, not the mechanism.
        //
        // The assertion still refuses a fourth key: a leaf that starts carrying its own
        // behaviour is the tree growing a second registry.
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

    /* ═══════════════════════════════════════════════════════════════════════════════
     * THE MACHINE-CLASS RULE, WHICH IS NOW ASKED ABOUT ROWS AS WELL AS PAGES
     * ═══════════════════════════════════════════════════════════════════════════════
     *
     * ONE RULE, THREE NAMES, AND THAT IS THE ASSERTION WORTH HAVING. `leafShownOn` and
     * `rowShownOn` both delegate to `shownOnMachine`; the danger of two gates at two levels
     * is that one of them comes to fail closed on an unknown class while the other fails
     * open, and nobody notices until a page is empty on one machine. Asserting the three
     * answer identically over the same inputs is what makes "one rule" checkable rather
     * than merely written down.
     */
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
            // The capability read is asynchronous, so null is "not yet" rather than "not a
            // Bengle". Failing closed here would hide the control on EVERY machine for as
            // long as the read takes — including on the machine it belongs to, where it
            // would then appear a second later and read as a glitch.
            //
            // THIS IS THE OPPOSITE OF A3's RULE AND THE DIFFERENCE IS DELIBERATE. A3 fails
            // closed on UNKNOWN because a capability answer is a claim about what the
            // machine can DO, and drawing a control for a thing it cannot do is a promise
            // the machine will not keep. A machine CLASS is not a claim about hardware
            // capability at all; the worst an unknown class costs is a control shown for
            // one read, and the worst failing closed costs is a control never shown.
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
            // The consequence of the gate having moved, asserted through the function the
            // sub-nav actually calls rather than through the tree it reads.
            for (const category of SETTINGS_TREE) {
                for (const cls of ['bengle', 'de1', null]) {
                    assert.equal(leavesFor(category, cls).length, category.leaves.length,
                        `${category.id} hides a leaf on ${cls}`);
                }
            }
        });

        test('search hides nothing by class either, for the same reason', () => {
            // `searchSettings` filters by `leafShownOn` so a result cannot navigate to a
            // page the sub-nav does not list. With no leaf gated, the three answers agree —
            // and if a leaf gate ever comes back, this is where its search half is checked.
            const onBengle = searchSettings('flow', SETTINGS_TREE, 'bengle');
            const onDe1 = searchSettings('flow', SETTINGS_TREE, 'de1');
            assert.deepEqual(onBengle.map((r) => r.node.id), onDe1.map((r) => r.node.id));
            assert.ok(onBengle.some((r) => r.node.id === 'calibration-flow-multiplier'),
                'the Flow Multiplier page is reachable from search on a Bengle now');
        });
    });
});

/* ===========================================================================
 * 2. T12 — ONE NAMING PATH
 * =========================================================================== */

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

    /* ONE NAME IS A SUBSTRING OF ITS OWN CATEGORY, AND IT IS ALLOWED — ONCE.
     *
     * `searchSettings` is a substring filter walked in tree order, so a category is
     * offered before its own leaves. That never mattered until 28 August 2026, when
     * Temperature and Time merged into one page and Ben named it "Units" — which is
     * inside "Units & Language". Searching "Units" therefore offers the category first.
     *
     * BEN'S CALL, PUT TO HIM WITH THE ALTERNATIVES: rank exact matches above substring
     * matches, rename the page, or accept it. He accepted it.
     *
     * SO THE RULE IS NARROWED, NOT DROPPED. Every node must still be findable by its own
     * name, and every node but the listed exception must still come back FIRST. A second
     * collision fails here rather than passing quietly, which is the whole value of the
     * assertion — relaxing it to "found somewhere" would have retired the guard instead
     * of recording the exception. */
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
            /* THE FIRST RESULT NAMES THE SAME THING. Deliberately a name check and not an
             * id check: `connection-machine` is called "Machine" and so is the Machine
             * CATEGORY, and that pair is harmless precisely because the two names are
             * identical — whichever comes back first, the word the person typed is the
             * word they see. "Units" is the case that is NOT harmless, because the first
             * result reads "Units & Language". */
            assert.equal(navName(results[0].node), browsed,
                `searching "${browsed}" offers "${navName(results[0].node)}" first — a new name `
                + 'collision. Rename it, rank exact matches first, or add it above with a reason.');
        }
    });

    test('the module names no index and formats no name', () => {
        // A second naming path would have to be written somewhere, and there is only
        // one place it could be. No template literal builds a name; no index reaches one.
        assert.doesNotMatch(SOURCE, /\$\{\s*(i|index|n|ordinal)\s*\+/,
            'a name is being assembled from a position');
        assert.equal((SOURCE.match(/function navName/g) ?? []).length, 1,
            'exactly one naming function');
    });
});

/* ===========================================================================
 * 3. SEARCH — across categories AND leaves, in browse order
 * =========================================================================== */

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
        // The id is not searched: 'machine-steam' as a query finds nothing, because no
        // NAME contains it. Ids are plumbing and are not shown, so searching them would
        // return rows whose match the user cannot see.
        assert.deepEqual(searchSettings('machine-steam'), []);
    });

    test('a query nothing matches is an empty list, not a throw and not everything', () => {
        assert.deepEqual(searchSettings('zzzzz'), []);
    });
});

/* ===========================================================================
 * NAV NAME CASING — one voice per category (point 137)
 * =========================================================================== */

describe('a category names its leaves in one voice', () => {
    /* THE CALIBRATION LIST READ "Load Cells / Flow Multiplier / Refill Kit / Voltage /
     * Fan Threshold / Default load settings" — five title case and one sentence case,
     * sitting under each other in a column.
     *
     * SLATE IS THE SOURCE OF THE INCONSISTENCY AND SLATE CONTRADICTS ITSELF: its nav says
     * "Default load settings" (`settings.js:577`) while its own page title for the same
     * leaf says "Default Load Settings" (`:5072`). Decal draws the page title FROM the
     * nav name, so the two cannot be kept apart the way Slate keeps them and one of the two
     * readings had to be chosen. Where Slate disagrees with Slate the tie goes to the
     * reading that makes Decal's own list coherent.
     *
     * THE STRING TABLE HAD ALREADY CHOSEN. `i18n/source/strings.json` has carried the key
     * "Default Load Settings", title case, since before this was noticed — so the nav's
     * sentence-case string matched no entry, fell through `t()` untranslated, and the table
     * entry had no reader at all. One name, one key, one voice.
     *
     * WHAT IS ASSERTED IS CONSISTENCY WITHIN A CATEGORY, not a house style across the tree:
     * a category is what a person reads as one column, and this is where a stray case is
     * visible. Small joining words are not significant words in any title-case convention,
     * so they are excluded rather than being counted as evidence either way.
     */
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
