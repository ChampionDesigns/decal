/**
 * settings-nav.js — the Settings navigation model, and THE ONE NAMING PATH (T12).
 *
 * SCOPE Part 5 §4 ("Master–detail navigation (category → sub-category → leaf),
 * **search**, and the ~30 one-primitive leaves plus the nine bespoke ones");
 * `LAYOUT_SPEC_DRAFT.md` §4.4 and §7.5 T12.
 *
 * NO DOM, NO LIT, NO COLOUR, NO LENGTH. `src/lib/` is "plain ES modules with no DOM
 * access" (SCOPE Part 2 §2), so this file tests under `node:test` without a browser —
 * which is the only reason the T12 assertion below can be a cheap unit test instead of
 * a render test that has to photograph two lists.
 *
 * ===========================================================================
 * T12, AND WHY IT IS INEXPRESSIBLE HERE RATHER THAN MERELY ABSENT
 * ===========================================================================
 *
 * §7.5 T12, in full: "Searching **restores the ordinals the design removed** —
 * 'Machine' becomes '1. Machine' — and re-adds numeric prefixes to leaf names that the
 * non-search path strips." (`settings.js:8353-8358, 8487` vs `:6409-6411`.)
 *
 * Two code paths built one name each. The browse path stripped a prefix off a string it
 * had been handed; the search path rebuilt the string from a list index. The names could
 * differ because there were two writers and one of them could see a POSITION.
 *
 * The remedy is not "remember to call the same helper". It is that there is only one
 * function that turns a node into a name, and IT TAKES NO INDEX:
 *
 *     navName(node) -> node.name
 *
 * A caller cannot pass an ordinal to it, and `searchSettings()` hands back the SAME
 * FROZEN NODE OBJECTS the tree holds — not copies, not projections — so the browse row
 * and the search row are two renders of one object. `test/settings-nav.test.mjs` asserts
 * that identity with `Object.is`, which is an assertion no reformatting can slip past:
 * a search path that wanted to prepend "1. " would have to build a new object first, and
 * the test would see it.
 *
 * ===========================================================================
 * WHERE THE NAMES COME FROM — MECHANICAL, NOT TYPED FROM A SCREENSHOT
 * ===========================================================================
 *
 * Every name below was read out of the Slate provenance corpus, from the rendered
 * `settings-nav-btn` / `settings-subnav-btn` elements across the 37 `settings-*` states
 * (`prov-baseline`, the same corpus `prov_query.py` reads). The category list is one
 * query:
 *
 *   CITE settings-machine-machine-info #machine-btn [i=9] text = "Machine"
 *        rect [0, 219, 260, 89]      <- .settings-nav-btn
 *   CITE settings-machine-machine-info #accessories-btn [i=11] text = "Accessories"
 *        rect [0, 308, 260, 89]
 *   ... ten in all, ending #help-btn [i=27] "Help" rect [0, 1020, 260, 89].
 *
 * THAT SAME READING IS T2 AND T18 MEASURED, and it is why the oracle is DISQUALIFIED for
 * every geometry on this screen (Part 10 §4: "the element is on the 140 layout bugs …
 * matching Slate there reproduces the bug"). The category rows step 89px — 219, 308,
 * 397 … 1020 — while the sub-category rows in the SAME capture step 93px — 219, 312,
 * 405, 498, 591, 684, 777 — so by row 7 the two columns are 24px out (753 against 777).
 * That is T2 to the pixel. The corpus is quoted here for the NAMES, which are content;
 * not one number from it reaches the layout.
 *
 * NAMES ARE CARRIED AS MEASURED, and two of them were carried with a caveat. Both caveats
 * were re-judged on 27 August 2026 and both moved:
 *
 *   - "Default load settings" was sentence case where its five siblings are title case,
 *     and this said "carried verbatim; renaming it is a content decision and nobody has
 *     taken it". THE DECISION HAS BEEN TAKEN and it was forced by a contradiction inside
 *     the oracle: Slate's nav says "Default load settings" (`settings.js:577`) and Slate's
 *     own page title for the same leaf says "Default Load Settings" (`:5072`). Decal
 *     draws the title FROM the nav name, so the two cannot be kept apart the way Slate
 *     keeps them, and one of the two readings had to be chosen. Where Slate disagrees with
 *     Slate the tie goes to the reading that makes Decal's own list coherent. It is
 *     title case now, and the calibration list reads in one voice.
 *
 *   - "Flow Multiplier ×1" renders in Slate with a live value beside the name, and this
 *     said no: "the multiplier is a READING … a nav row that re-renders when a machine
 *     value changes is the same class of mistake as an ordinal in a name: the label stops
 *     being the thing that names the page."
 *
 *     THE OBJECTION WAS RIGHT AND THE CONCLUSION WAS WRONG, and the difference is
 *     structural rather than a change of mind. What must not happen is a value welded INTO
 *     the name — a name that is a different string on Tuesday is not a name, and this file
 *     still returns "Flow Multiplier" and nothing else. What Slate is actually doing is
 *     drawing a SECOND thing on the same row, in its own element (`settings.js:6413-6421`,
 *     `.settings-subnav-value`), and its own note says why it exists: "Confirming what the
 *     machine is set to cost six taps and six page loads."
 *
 *     So the value is `summary` on #25, filled by `navSummary(leafId)` on the leaf model
 *     and never by this table. The name stays a name, this file stays free of machine
 *     values, and the row still says what the page holds. See `ui-subnav-row.js` for the
 *     three rules that keep the number out of the label's track.
 *
 * ===========================================================================
 * WHAT THIS FILE IS NOT
 * ===========================================================================
 *
 * NOT the leaves. A row here is `{id, name}` and nothing else — no component, no
 * storage key, no capability, no limit. Which of the 37 collapse onto #29 and which are
 * the nine bespoke ones is `settings-row-thirty-leaves` / `bespoke-leaves-nine`; which
 * store a leaf reads is `b7-storage-routing` and it resolves through
 * `src/lib/storage-routes.js`. Those rows ADD FIELDS to these nodes or key their own
 * tables by `id`; this file stays the spine.
 *
 * NOT a scope boundary. `updates-firmware-update` is in the tree because Slate's
 * navigation has it; D4 ("no firmware-update feature, and the hand-picked file upload is
 * removed, not carried") is `d4-d5-d6-scope-boundary`'s row and its owner decides
 * whether the ENTRY survives. Deleting it here would be this cluster deciding someone
 * else's accepted decision by omission.
 *
 * NOT reachability policy either — but it does make T7 checkable. §7.5 T7 is "76 lines
 * of `:has()` stepper CSS written for a page that is **unreachable** — its renderer is
 * dispatched for two cases no `settingsTree` entry uses, and there is a second, live Fan
 * implementation." Here every leaf is reachable from exactly one category, ids are
 * unique, and the suite asserts both — so "a page no tree entry names" is a state the
 * model cannot be in.
 */

/**
 * The ten categories and the thirty-seven leaves, deep-frozen.
 *
 * ORDER IS THE RENDERED ORDER in the corpus, top to bottom, and it is the order both
 * the browse list and the search results present (see `searchSettings`). Ten categories
 * — T18's own arithmetic got this wrong ("10 categories, not 11; 890, not 981"), which
 * is half of why C4 stopped pinning the pitch to a row count.
 *
 * IDS are `<category>-<leaf>`, matching the corpus state name with the `settings-`
 * prefix dropped and `&` / `/` collapsed, so a state in the audit corpus and a node here
 * can be lined up by eye without a mapping table.
 */
export const SETTINGS_TREE = Object.freeze([
    Object.freeze({
        id: 'machine',
        name: 'Machine',
        leaves: Object.freeze([
            Object.freeze({ id: 'machine-steam', name: 'Steam' }),
            Object.freeze({ id: 'machine-hot-water', name: 'Hot Water' }),
            Object.freeze({ id: 'machine-flush', name: 'Flush' }),
            Object.freeze({ id: 'machine-water-tank', name: 'Water Tank' }),
            /* 'SLEEP & WAKE SCHEDULES' UNTIL 26 AUGUST 2026, and the rename bought two
             * things. Ben asked for equal, narrower nav columns and then asked this:
             * "'Sleep & Wake Schedules' what can we call this to reduce the text length?"
             * Measured at the rendered type it was 255 wide against the next-longest leaf's
             * 214, so it alone was setting the column width — 303 to hold it, against 262
             * without it.
             *
             * AND THE SHORTER NAME IS THE TRUER ONE. Only half this page is schedules:
             * Automatic sleep and Sleep after are a POLICY, and the wake list is the
             * schedule. The page's own description has always read "When the machine puts
             * itself to sleep, and when it wakes" — the title is now those words. */
            Object.freeze({ id: 'machine-sleep-wake-schedules', name: 'Sleep & Wake' }),
            /* "PRE SHOT", NOT "ADVANCED" — Ben, 26 August 2026: "Advanced is not a good
             * name, these settings are what happens before a shot is pulled, so maybe
             * 'Pre Shot'." The ID does not move: it is the corpus state name and the
             * registry's foreign key, and renaming it would orphan every row, every
             * capture and every finding that cites it. */
            Object.freeze({ id: 'machine-advanced', name: 'Pre Shot' }),
            Object.freeze({ id: 'machine-machine-info', name: 'Machine Info' }),
        ]),
    }),
    Object.freeze({
        id: 'accessories',
        name: 'Accessories',
        leaves: Object.freeze([
            Object.freeze({ id: 'accessories-cup-warmer', name: 'Cup Warmer' }),
            Object.freeze({ id: 'accessories-lighting', name: 'Lighting' }),
            Object.freeze({ id: 'accessories-usb-charger', name: 'USB Charger' }),
        ]),
    }),
    Object.freeze({
        id: 'connection',
        name: 'Connection',
        leaves: Object.freeze([
            Object.freeze({ id: 'connection-machine', name: 'Machine' }),
            Object.freeze({ id: 'connection-scale', name: 'Scale' }),
        ]),
    }),
    Object.freeze({
        id: 'calibration',
        name: 'Calibration',
        leaves: Object.freeze([
            Object.freeze({ id: 'calibration-load-cells', name: 'Load Cells' }),
            /* THIS LEAF WAS THE ONE MACHINE-DEPENDENT PAGE AND IS NOT ANY MORE — THE GATE
             * MOVED DOWN TO ITS ROWS ON 27 AUGUST 2026, AND NO LEAF CARRIES ONE TODAY.
             *
             * It read `machines: ['de1']` on Ben's 26 August answer, "Flow multiplier is
             * not needed for the Bengle, but keep it for the DE1 as slate has it", and his
             * reasoning on the 27th says exactly which setting he meant: "Bengle's pumps
             * dont have any need for flow calibration, its delievers perfect accurate flow,
             * the DE1 didn't and needed these calibration values to get it running."
             *
             * HE IS RIGHT ABOUT TWO OF THE THREE ROWS AND THE THIRD IS NOT A FLOW
             * CALIBRATION AT ALL. `weightFlowMultiplier` is stop-lag lookahead — how far
             * ahead of the target the shot is cut — and `shot_sequencer.dart` calls
             * `_handleStepWeightExit` with it ABOVE the autonomous-SAW gate, so it drives
             * per-step weight exits on a Bengle too. Hiding the whole page would have taken
             * a live control away from every Bengle owner on the strength of a sentence
             * about the two beside it. The argument is written out in full at those rows in
             * `settings-leaves.js`, where the gate now lives.
             *
             * SO THE PAGE STAYS ON BOTH MACHINES AND CARRIES ONE ROW ON A BENGLE. Its name
             * survives the change intact: the row it keeps there is Slate's own "Weight flow
             * multiplier", so a page called Flow Multiplier holding exactly that is not a
             * title writing a cheque its contents cannot cash. It also keeps the leaf's
             * headline scalar — `navSummary` is on the weight row — so the nav entry still
             * shows a number rather than going blank on a Bengle.
             *
             * THE CLASS COMES FROM THE SERVED CAPABILITY SET (`machineClassFromServedSet`),
             * never from a model string: sniffing `model.includes('bengle')` is exactly what
             * the served array replaced. That has not changed with the level. */
            Object.freeze({ id: 'calibration-flow-multiplier', name: 'Flow Multiplier' }),
            /* ONE PAGE FOR THE THREE MACHINE FACTS (Ben, 28 Aug 2026). Refill Kit,
             * Voltage and Fan Threshold were three pages of one control each. None of
             * them is a calibration in the sense its two siblings are — they state what
             * this machine HAS and what it RUNS AT, which is why "Hardware" and not
             * "Machine Setup": the latter reads as configuration and collides with the
             * Machine category.
             *
             * THE ROW IDS DID NOT MOVE, only their `leaf`. `calibration-fan-threshold`
             * still carries Slate's own wording (point 126) as its row heading, so the
             * distinction that comment drew — a threshold, not fan control — survives
             * where it is actually read. */
            Object.freeze({ id: 'calibration-hardware', name: 'Hardware' }),
            /* "DEFAULT LOAD SETTINGS", TITLE CASE, AND SLATE CONTRADICTS ITSELF HERE.
             * Its nav reads "Default load settings" (`settings.js:577`) while its own page
             * title reads "Default Load Settings" (`:5072`). Decal's title IS its nav name
             * — one string, so a page and its row cannot disagree — which means Slate's
             * inconsistency had to be resolved rather than mirrored, and it landed as the
             * one sentence-case name among five title-case siblings: Load Cells, Flow
             * Multiplier, Refill Kit, Voltage, Fan Threshold, and then this. Where Slate
             * disagrees with Slate the tie goes to the reading that makes Decal's own list
             * coherent, and Slate's page title supplies it. */
            Object.freeze({ id: 'calibration-default-load-settings', name: 'Default Load Settings' }),
        ]),
    }),
    Object.freeze({
        id: 'maintenance',
        name: 'Maintenance',
        leaves: Object.freeze([
            Object.freeze({ id: 'maintenance-machine-descaling', name: 'Machine Descaling' }),
            Object.freeze({ id: 'maintenance-transport-mode', name: 'Transport Mode' }),
        ]),
    }),
    Object.freeze({
        id: 'display',
        name: 'Display',
        leaves: Object.freeze([
            Object.freeze({ id: 'display-skin', name: 'Skin' }),
            /* THREE PAGES OF ONE CONTROL, MADE ONE (Ben, 28 Aug 2026). Brightness was a
             * single slider on a page of its own; Display Size and Wake Lock were one row
             * each. All three answer a question about THIS SCREEN — how bright, how large,
             * whether it stays awake — so they read as one page and not as three.
             *
             * "SCREEN", NOT "DISPLAY": the category is already Display, and a nav that
             * reads Display > Display names nothing. It sits beside Screen Saver, which
             * keeps its own page because it carries three rows AND the image set.
             *
             * STILL BESPOKE. The brightness slider has no archetype — there is no SLIDER
             * in `ARCHETYPE` — so this leaf stays in `BESPOKE_LEAVES` and the registry
             * rows render above it, exactly as `display-screen-saver` already does. */
            Object.freeze({ id: 'display-screen', name: 'Screen' }),
            Object.freeze({ id: 'display-screen-saver', name: 'Screen Saver' }),
        ]),
    }),
    Object.freeze({
        id: 'units-language',
        name: 'Units & Language',
        leaves: Object.freeze([
            Object.freeze({ id: 'units-language-select-language', name: 'Select Language' }),
            /* TEMPERATURE AND TIME ON ONE PAGE (Ben, 28 Aug 2026), AND THIS ANSWERS THE
             * OBJECTION THAT KEPT THEM APART RATHER THAN IGNORING IT.
             *
             * The clock format arrived on 24 Aug as its own leaf, and the reason recorded
             * here was: "A LEAF RATHER THAN A ROW ON `Temperature` ... that leaf's NAME is
             * the quantity it sets, so a clock format on it is a control nobody would look
             * for." That was right about a page called Temperature. It is not an argument
             * for two pages of one control — it is an argument against that NAME.
             *
             * So the page is "Units". Both rows are the same question about a number —
             * Celsius or Fahrenheit, 12 hour or 24 — and neither is now hiding under the
             * name of the other. */
            Object.freeze({ id: 'units-language-units', name: 'Units' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions',
        name: 'Extensions',
        leaves: Object.freeze([
            Object.freeze({ id: 'extensions-visualizer', name: 'Visualizer' }),
            Object.freeze({ id: 'extensions-plugins', name: 'Plugins' }),
            /* "DECAID" — the app's name since it was renamed (Ben, 26 Aug 2026). The id
             * stays: it is the corpus state name and the registry's foreign key. */
            Object.freeze({ id: 'extensions-decent-app-settings', name: 'Decaid' }),
        ]),
    }),
    Object.freeze({
        id: 'updates',
        name: 'Updates',
        leaves: Object.freeze([
            Object.freeze({ id: 'updates-skin-app', name: 'Skin / App' }),
            Object.freeze({ id: 'updates-firmware-update', name: 'Firmware Update' }),
        ]),
    }),
    Object.freeze({
        id: 'help',
        name: 'Help',
        leaves: Object.freeze([
            Object.freeze({ id: 'help-quickstart-guide', name: 'Quickstart Guide' }),
            Object.freeze({ id: 'help-keyboard-shortcuts', name: 'Keyboard Shortcuts' }),
            Object.freeze({ id: 'help-talk-to-decent', name: 'Talk to Decent' }),
            Object.freeze({ id: 'help-send-feedback', name: 'Send Feedback' }),
        ]),
    }),
]);

/** What a result is. Both kinds render through the SAME nav row (#24). */
export const NAV_KIND = Object.freeze({ CATEGORY: 'category', LEAF: 'leaf' });

/**
 * THE NAMING FUNCTION. One argument, no index, no list, no position — so the ordinal
 * T12 resurrects cannot be assembled here, and there is nowhere else it could be
 * assembled because both paths call this.
 *
 * D2: the RESULT is a value the caller hands to `t()`. This function does not translate
 * (it is DOM-free and has no controller), and it must not: a translated string is a
 * render-time value and the model is not a render.
 */
export function navName(node) {
    return node?.name ?? '';
}

/** The category a leaf id belongs to, or null. */
export function categoryOf(leafId, tree = SETTINGS_TREE) {
    for (const category of tree) {
        if (category.leaves.some((leaf) => leaf.id === leafId)) return category;
    }
    return null;
}

/** One category by id, or null. Never throws — an unknown id is a state, not a crash. */
export function categoryFor(id, tree = SETTINGS_TREE) {
    return tree.find((category) => category.id === id) ?? null;
}

/** One leaf by id, or null. */
export function leafFor(id, tree = SETTINGS_TREE) {
    for (const category of tree) {
        const leaf = category.leaves.find((node) => node.id === id);
        if (leaf) return leaf;
    }
    return null;
}

/** Every leaf, in browse order. 37 of them. */
export function allLeaves(tree = SETTINGS_TREE) {
    return tree.flatMap((category) => category.leaves);
}

/**
 * IS THIS NODE SHOWN ON THIS MACHINE? — the ONE machine-class rule, for a leaf or a row.
 *
 * A node with no `machines` list is shown on every machine, which is all but a handful of
 * them — the list is an EXCEPTION, not a gate every node has to answer.
 *
 * AN UNKNOWN CLASS SHOWS EVERYTHING, and that is the deliberate half. The capability read
 * is asynchronous, so `null` is "not yet" rather than "not a Bengle": hiding on it would
 * hide the control on every machine for as long as the read takes, and something that
 * appears a second after the screen opens reads as a glitch. The cost of showing it on a
 * Bengle for one read is a control that then goes away; the cost the other way is a DE1
 * owner who never sees something that belongs to them.
 *
 * IT TAKES A NODE AND NOT A LEAF, SINCE 27 AUGUST 2026, AND THAT IS THE WHOLE CHANGE.
 * `machines` used to live only on nav leaves, because the only machine-dependent thing in
 * the tree was a whole page. Then the Flow Multiplier page turned out to be two DE1-only
 * rows and one that belongs on every machine (see `calibration-flow-multiplier-weight` in
 * `settings-leaves.js`), so the gate had to work one level down as well. The registry
 * already gates a bank's ITEMS on `capability` and `sensor`; a row-level `machines` is the
 * same idea one level up, and the RULE is deliberately not duplicated to reach it. Two
 * copies of "unknown shows everything" is exactly how one of them comes to fail closed
 * while the other fails open, and nobody notices until a page is empty on one machine.
 *
 * @param {object|null|undefined} node   any node carrying an optional `machines` array —
 *                                       a nav leaf, or a registry row.
 * @param {'bengle'|'de1'|null} machineClass
 */
export function shownOnMachine(node, machineClass) {
    if (!node?.machines) return true;
    if (machineClass === null || machineClass === undefined) return true;
    return node.machines.includes(machineClass);
}

/**
 * Is this LEAF shown on this machine? `shownOnMachine` under its original name.
 *
 * KEPT AS ITS OWN EXPORT rather than folded away, because six call sites read as questions
 * about a PAGE — the sub-nav, the search, the screen's own leaf resolution — and
 * `leafShownOn(leaf, class)` says which question is being asked at each of them. It
 * delegates, so there is still exactly one rule.
 *
 * @param {object} leaf              a leaf node from the tree
 * @param {'bengle'|'de1'|null} machineClass
 */
export function leafShownOn(leaf, machineClass) {
    return shownOnMachine(leaf, machineClass);
}

/**
 * Is this REGISTRY ROW shown on this machine? `shownOnMachine` under a row's name.
 *
 * THE SAME DELEGATION AND THE SAME ARGUMENT AS `leafShownOn` — and it is worth one more
 * sentence here, because a row-level gate is the newer of the two and the wrong instrument
 * for most of what looks like it needs one. A row is gated by `machines` only when the
 * SETTING does not exist on a machine at all. A row whose BAND differs by machine is the
 * limits table's business (`fanThreshold`, `steamTemp`); a row whose HARDWARE may be
 * missing is `capability`'s or `sensor`'s; a row the FIRMWARE may be too old for is
 * `supportedBy`'s. Reaching for `machines` where one of those three belongs would hide a
 * control from a machine that has it, which no other gate here can do.
 *
 * @param {object} row               a row from `SETTINGS_ROWS`
 * @param {'bengle'|'de1'|null} machineClass
 */
export function rowShownOn(row, machineClass) {
    return shownOnMachine(row, machineClass);
}

/** One category's leaves, filtered for this machine. The tree itself never changes. */
export function leavesFor(category, machineClass) {
    return (category?.leaves ?? []).filter((leaf) => leafShownOn(leaf, machineClass));
}

/** True when a query is worth running. Whitespace is not a search. */
export function isSearching(query) {
    return typeof query === 'string' && query.trim() !== '';
}

/**
 * Search across categories AND leaves.
 *
 * THE RESULT ROWS CARRY THE TREE'S OWN NODES — `{ kind, node, category }`, where `node`
 * is the frozen object out of `SETTINGS_TREE` and `category` is the category to select
 * when the row is pressed (itself, for a category hit). Nothing here builds a string,
 * which is the whole of T12: `navName(row.node)` in the search list and
 * `navName(node)` in the browse list are the same call on the same object.
 *
 * ORDER IS BROWSE ORDER, walked once: each category, then its matching leaves. Search
 * that reshuffles is a second presentation of the same list and would need its own
 * justification; this one has none, so it does not.
 *
 * MATCHING is a case-insensitive substring of the name, and only of the name. It is
 * deliberately the dumbest thing that works: a fuzzy matcher is a ranking function, a
 * ranking function is a second order, and a second order is the thing above.
 */
export function searchSettings(query, tree = SETTINGS_TREE, machineClass = null) {
    if (!isSearching(query)) return [];
    const needle = query.trim().toLowerCase();
    const hit = (node) => navName(node).toLowerCase().includes(needle);

    const results = [];
    for (const category of tree) {
        if (hit(category)) {
            results.push({ kind: NAV_KIND.CATEGORY, node: category, category });
        }
        for (const leaf of category.leaves) {
            /* A HIDDEN LEAF IS NOT SEARCHABLE EITHER. A search result that navigates to a
             * page the sub-nav does not list is a page with no way back to it. */
            if (!leafShownOn(leaf, machineClass)) continue;
            if (hit(leaf)) results.push({ kind: NAV_KIND.LEAF, node: leaf, category });
        }
    }
    return results;
}
