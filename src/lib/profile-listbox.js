/**
 * profile-listbox.js — THE REAL LISTBOX: its keys, its ids, its grouping (bug P12).
 *
 * Wave 5.3, `bug-P12-real-listbox`, `bug-P6-list-row-built-once`,
 * `bug-P4-hit-floor-one-owner`, `sel-highlight-by-id`.
 *
 * ===========================================================================
 * WHY THIS IS A MODULE AND NOT A `<selector-list>` ELEMENT
 * ===========================================================================
 * `aria-activedescendant` IS AN IDREF, AND AN IDREF DOES NOT CROSS A SHADOW BOUNDARY.
 * The listbox element and the option it points at must live in ONE tree. So either the
 * options are rendered inside a list component's own root — and then the screen cannot
 * put a favourite mark or a provenance badge on a row without piercing it — or the
 * listbox lives in the screen's root with the options beside it. The second is the one
 * that works, and it is why P12 is answered by a module of rules-and-keys rather than by
 * a fourth custom element.
 *
 * What is here, therefore, is everything about the pattern that ISN'T a DOM node: the
 * key arithmetic, the option-id spelling, the grouping call and R1's marking — all of it
 * pure, so each is one `node:test` assertion rather than a browser round trip. `src/lib/`
 * is "plain ES modules with no DOM access" (SCOPE Part 2 §2) and that is the whole
 * reason this file imports no `lit`: a module that does cannot be imported under node at
 * all, because the bare `lit` specifier resolves through `index.html`'s importmap and
 * nowhere else. THE STYLESHEET IS THEREFORE ITS OWN FILE, `src/screens/selector-list.js`,
 * which is the same split `seams.js` and `type-roles.js` already are: a css fragment a
 * root adopts, owned in one place.
 *
 * ===========================================================================
 * P12, QUOTED, AND THE FOUR THINGS IT IS
 * ===========================================================================
 * §7.3: "The profile list is keyboard- and AT-inaccessible: `role='listbox'` with
 * `role='option'` divs, no `tabindex`, no `aria-activedescendant`, NO KEYDOWN HANDLER
 * ANYWHERE IN THE MODULE — and non-option children inside the listbox."
 * (`profile_selector.html:34`; `profile_selector.js:774-786, 1342-1354, 743, 663`)
 *
 * Four defects wearing one number, and each dies against a different mechanism:
 *
 *   NO TABINDEX          The listbox is the tab stop, once, and no option carries one.
 *                        That is the ACTIVEDESCENDANT pattern rather than a roving
 *                        tabindex, and the choice is forced by size: a roving tabindex
 *                        over ~78 rows moves DOM focus on every arrow press, and every
 *                        move re-runs the browser's focus-visible heuristics and scrolls
 *                        the scrollport. Moving one attribute does not.
 *
 *   NO ACTIVEDESCENDANT  `aria-activedescendant` always names a real option id while
 *                        there is any option at all — `activeDescendantId` returns null
 *                        only for an empty list, and Lit's `nothing` then removes the
 *                        attribute rather than writing an id that resolves to nobody.
 *
 *   NO KEYDOWN HANDLER   `nextActiveIndex` below is the whole of it, and it is a pure
 *                        function: Down / Up / Home / End / PageDown / PageUp move,
 *                        Enter and Space choose, everything else travels. The old module
 *                        has NO handler anywhere, so every one of these is new — and
 *                        being pure, each is one `node:test` assertion rather than a
 *                        browser round trip.
 *
 *   NON-OPTION CHILDREN  The listbox holds `role="option"` elements and `role="group"`
 *                        wrappers, and nothing else. Both are legal listbox children
 *                        (ARIA 1.2: listbox -> option | group; group -> option). The
 *                        suite walks the FLATTENED subtree and asserts the role set is
 *                        exactly those two.
 *                        FLATTENED IS THE LOAD-BEARING WORD, and it was not true of the
 *                        probe until the 5.3 fix pass: `querySelectorAll` does not cross a
 *                        shadow boundary, so a walk built on it could never see what a row
 *                        puts INSIDE ITSELF, and the assertion passed vacuously over the
 *                        exact children it exists to police — 78 exposed, operable
 *                        `button "More actions"` nodes, measured through CDP
 *                        Accessibility.getFullAXTree. Two things changed together: every
 *                        option row took #26's listbox pairing `no-overflow` (later made
 *                        unnecessary — the affordance itself was deleted on 30 August
 *                        2026, audit D11), and the fixture's `listboxRoles()`
 *                        walks shadow roots and reports the IMPLICIT role of a natively
 *                        interactive element, so a <button> anywhere under the listbox
 *                        shows up as `button` rather than as nothing at all.
 *
 * ===========================================================================
 * THE FOLDER QUESTION, DECIDED HERE, AND WHY #28 IS NOT IN THE LISTBOX
 * ===========================================================================
 * COMPONENT #28 NO LONGER EXISTS — it was DELETED on 30 Aug 2026 (audit F-005, Ben's
 * decision D10) because it was composed in zero places in `src/`. The ruling below is kept
 * because it is the REASON, and the reason is what a later wave needs; only the two-line
 * reversal at the foot has lost its component. `<ui-folder-disclosure>` (#28) wrote its
 * head row as a `<button>`, and its own header had already ruled on what that means for
 * this screen:
 *
 *     "NO ROLE ON THE HOST … this component's head row is a `<button>`, so a list that
 *      made itself `role='listbox'` would contain a non-option child — which is literally
 *      bug P12's complaint … A foldered list is a `list`/`tree`, not a listbox, and that
 *      is the screen's call to make in wave 5."
 *
 * The screen law for wave 5.3 is "aria per Appendix 15 (P12: a REAL listbox)", so the
 * call is LISTBOX. The accessibility tree is computed over the FLATTENED tree, so putting
 * #28 inside a shadow root would not have hidden its button: it would have been P12 with
 * a component in place of a div.
 *
 * FOLDERS STILL SHIP, from the same grouping module. `profile-folders.js`
 * `groupProfilesByFolder` (PORT-AS-IS) decides the families and each becomes a
 * `role="group"` with `aria-label` — which is EXACTLY the announcement #28's own body
 * gives ("the rows inside are announced as a family rather than as a run of unrelated
 * list rows"). What v1 does not offer is COLLAPSE, because collapse needs a control and a
 * control inside a listbox is the defect. Recorded as a deferred question whose reversal
 * used to be two lines — wrap each group in `<ui-folder-disclosure>` and change
 * `listbox`/`option` to `tree`/`treeitem`. With #28 deleted the second line stands and the
 * first now means "build the disclosure head". The key arithmetic below already walks a
 * flat VISIBLE order, which is what a tree needs.
 *
 * ===========================================================================
 * P6 — THE ROW IS BUILT ONCE
 * ===========================================================================
 * §7.3: "The profile row is implemented TWICE (177 and 126 lines, byte-identical class
 * strings) — and the module's own comment records the cost: the affordance added to the
 * first never reached the second."
 *
 * MECHANISM: no row markup exists in this cluster at all. An option is one
 * `<ui-list-row>` element made by one template function in `selector-screen.js`, and
 * there is no second branch for a bundled row, a loaded row or a selected row — those are
 * PROPERTIES on the one element. The suite asserts every option in the list has the same
 * constructor and that every one gets the SAME ANSWER about row actions — which is the
 * half that went missing in the old tree, where the affordance added to the first
 * implementation never reached the second.
 *
 * THE ANSWER THIS LIST GIVES IS NOW STRUCTURAL, AND THAT IS THE POINT. It used to be an
 * attribute — `no-overflow`, on all 78 rows — because #26 drew a built-in `<button>` that
 * a listbox could not carry (P12's fourth half: a real button inside a `role="option"`).
 * That button was deleted on 30 August 2026 (audit D11), so there is no answer left to
 * give: a row draws no actions control unless a screen slots one.
 *
 * P6's pin survives the change unharmed, because P6 is about UNIFORMITY — one template
 * cannot disagree with itself. The pin was never "the attribute has a particular value";
 * it was that all 78 rows are built from one template, so whatever the answer is, it is
 * the same answer everywhere and changing it changes every row at once. That is exactly
 * what the old tree could not do, and it is now true with nothing to write down.
 *
 * ===========================================================================
 * P4 — HIT FLOOR AND GEOMETRY FROM ONE COMPONENT
 * ===========================================================================
 * §7.3: "The favourite slots take their GEOMETRY from one rule and their PAINT from
 * another 1300 lines away; measured 64x64, so `--slate-hit-min` is silently not applied
 * where the comment says it is."
 *
 * MECHANISM: THE RULES BELOW DECLARE NO HEIGHT, NO MIN-HEIGHT AND NO PADDING ON AN
 * OPTION. `<ui-list-row>` owns its box (`--ui-list-row`) and its hit floor
 * (`--ui-hit-min`, via `hitArea` in `base.js`) in the same shadow root as its paint, and
 * `<ui-favourite-slot>` does the same for the rail. A second owner cannot be added from
 * here: a rule in this sheet cannot reach inside either root, and no `::part` is used.
 * The suite reads `--ui-hit-min` off the document at run time and asserts the measured
 * boxes meet it, so the number is never written twice.
 */

import { groupProfilesByFolder } from './profile-folders.js';

/** The option id prefix. Ids live inside one shadow root, so a short one is enough. */
export const OPTION_ID_PREFIX = 'opt-';

/** `profile:5ae9…` -> `opt-profile:5ae9…`. One spelling, both directions. */
export const optionIdFor = (recordId) => `${OPTION_ID_PREFIX}${recordId}`;

/** `opt-profile:5ae9…` -> `profile:5ae9…`, or null for anything else. */
export const recordIdFromOptionId = (optionId) => (
    typeof optionId === 'string' && optionId.startsWith(OPTION_ID_PREFIX)
        ? optionId.slice(OPTION_ID_PREFIX.length)
        : null
);

/** How far PageUp / PageDown move. Ten rows is the old list's own visible run. */
export const PAGE_STEP = 10;

/** The two keys that CHOOSE the active option — a click and Enter are the same act. */
export const CHOOSE_KEYS = Object.freeze(['Enter', ' ']);

/**
 * Where a key press moves the active option.
 *
 * PURE, so P12's new behaviour is proved in `node:test` rather than only through a
 * browser: index in, index out, clamped to the list. Returns:
 *
 *   a number   move the active option there
 *   'choose'   Enter or Space — the caller chooses the currently active option
 *   null       this key is not ours; let it travel (Tab, modifier chords, everything)
 *
 * CLAMPED, NOT WRAPPED. Down on the last row stays on the last row. Wrapping a 78-row
 * list from the bottom to the top is a jump the user did not ask for and cannot see the
 * start of, and neither ARIA's listbox pattern nor the old screen implies one.
 */
export function nextActiveIndex(key, index, length) {
    if (!Number.isInteger(length) || length <= 0) return null;
    if (CHOOSE_KEYS.includes(key)) return 'choose';
    const at = Number.isInteger(index) && index >= 0 ? index : 0;
    const clamp = (value) => Math.min(Math.max(value, 0), length - 1);
    switch (key) {
        case 'ArrowDown': return clamp(at + 1);
        case 'ArrowUp': return clamp(at - 1);
        case 'Home': return 0;
        case 'End': return length - 1;
        case 'PageDown': return clamp(at + PAGE_STEP);
        case 'PageUp': return clamp(at - PAGE_STEP);
        /* THE TWO KEYS A TREE ADDS, and they are answers rather than indices because
         * what they do depends on the node the caller is standing on: Right opens a shut
         * family or steps into an open one, Left shuts an open family or steps out to the
         * parent of a profile. The caller has the node; this has the key. */
        case 'ArrowRight': return 'open';
        case 'ArrowLeft': return 'close';
        default: return null;
    }
}

/**
 * The families, or one ungrouped run.
 *
 * A thin call, deliberately: `profile-folders.js` is PORT-AS-IS and owns every hard part
 * (explicit ' / ' families, derived first-word families, the "a folder of one is worse
 * than the profile" minimum). Restating any of it here is how two groupings appear.
 */
export function listboxGroups(records, { folders = true } = {}) {
    const rows = sortByTitle(Array.isArray(records) ? records.filter(Boolean) : []);
    if (!folders || rows.length === 0) return [{ folder: null, entries: rows }];
    return groupProfilesByFolder(rows, (record) => (record.profile && record.profile.title) || '');
}

/**
 * Order a listing by title, the way Slate does.
 *
 * BEN'S CALL, 25 August 2026, on the behaviour audit's one open difference: "Order: copy
 * slates order." Decal showed records in the order the server served them, on 93
 * profiles, which is the difference between finding a name and hunting for it.
 *
 * SLATE'S COMPARATOR EXACTLY - profile_selector.js:726-731 and :1314-1319, the same two
 * lines in both its render path and its filter path:
 *
 *     if (a.profile && a.profile.title && b.profile && b.profile.title) {
 *         return a.profile.title.localeCompare(b.profile.title);
 *     }
 *     return 0;
 *
 * A record with no title compares equal to everything, so it keeps its arrival position
 * rather than being swept to one end. Array.prototype.sort is stable, so "equal" means
 * "unmoved" - which is the behaviour Slate's `return 0` gets by the same route.
 *
 * IT SORTS BEFORE GROUPING, and that is what makes one sort enough. groupProfilesByFolder
 * preserves the order it is handed and emits each folder at its first member's position,
 * so sorted input yields loose rows in title order, folders in the title order of their
 * first member, and members in title order inside each folder. Sorting after the split
 * would need three sorts and would still leave the folders themselves unordered.
 *
 * EVERY LIST ON THE SCREEN COMES THROUGH HERE, filtered or not, so Slate's "on every
 * render and every filter" holds without a second call site.
 */
function sortByTitle(rows) {
    const titleOf = (record) => (record && record.profile && record.profile.title) || '';
    return rows.slice().sort((a, b) => {
        const left = titleOf(a);
        const right = titleOf(b);
        if (!left || !right) return 0;
        return left.localeCompare(right);
    });
}

/**
 * THE VISIBLE NODES OF THE FAMILY TREE, flattened, top to bottom.
 *
 * WHY A FLAT LIST. Everything the keyboard does is an index step over what a person can
 * SEE, and a shut family's members are not visible. Flattening here means
 * `nextActiveIndex` keeps working exactly as it did over a flat listbox, and the screen
 * still holds one active index rather than a path.
 *
 * WHY A TREE AT ALL. Ben, 24 August 2026: "Make families collapse." A listbox cannot hold
 * a disclosure — `role="listbox"` owns options and groups and nothing else, and the
 * selector's own P12 test names "a folder disclosure's head row" as the failure it exists
 * to catch. A collapsible grouped single-select list IS a tree, so the wrapper becomes
 * one: a family is a `treeitem` with `aria-expanded` owning a `group` of `treeitem`s.
 *
 * AN UNGROUPED RUN STAYS FLAT. `profile-folders.js` already declines to make a folder of
 * one, and a filtered list is usually one run; those records come back as bare profile
 * nodes with no family above them, and the tree is then a list with the same keys.
 *
 * @param {Array} records   the rows to show, already filtered
 * @param {Set<string>|Array<string>} open  which families are expanded
 * @returns {Array<object>} frozen nodes:
 *   `{kind:'folder', folder, count, open}` | `{kind:'profile', record, folder}`
 */
export function treeNodes(records, open = null) {
    const isOpen = open instanceof Set
        ? (name) => open.has(name)
        : (name) => Array.isArray(open) && open.includes(name);
    const out = [];
    for (const group of listboxGroups(records)) {
        if (group.folder === null) {
            for (const record of group.entries) {
                out.push(Object.freeze({ kind: 'profile', record, folder: null }));
            }
            continue;
        }
        const expanded = isOpen(group.folder);
        out.push(Object.freeze({
            kind: 'folder', folder: group.folder, count: group.entries.length, open: expanded,
        }));
        if (!expanded) continue;
        for (const record of group.entries) {
            out.push(Object.freeze({ kind: 'profile', record, folder: group.folder }));
        }
    }
    return out;
}

/**
 * Where Right or Left takes you from one node, as a whole answer.
 *
 * FOUR CASES AND NO FIFTH, which is the APG's tree pattern read literally:
 *   Right on a shut family      open it            {open: folder}
 *   Right on an open family     step to its first  {index}
 *   Left  on an open family     shut it            {close: folder}
 *   Left  on a member           step to its family {index}
 * Anything else is `null` — including Left on a top-level profile, which has no parent to
 * step out to, and Right on a profile, which has nothing to step into.
 */
export function treeSideStep(direction, nodes, index) {
    const node = Array.isArray(nodes) ? nodes[index] : null;
    if (!node) return null;
    if (direction === 'open') {
        if (node.kind !== 'folder') return null;
        if (!node.open) return { open: node.folder };
        const next = nodes[index + 1];
        return next && next.kind === 'profile' ? { index: index + 1 } : null;
    }
    if (direction !== 'close') return null;
    if (node.kind === 'folder') return node.open ? { close: node.folder } : null;
    if (!node.folder) return null;
    for (let at = index - 1; at >= 0; at -= 1) {
        if (nodes[at].kind === 'folder' && nodes[at].folder === node.folder) return { index: at };
    }
    return null;
}

/* ═══════════════════════════════════ R1 · THE PROVISIONAL LOADED-PROFILE HIGHLIGHT
 *
 * THIS MARKING IS A SHIPPING REQUIREMENT AND MUST NOT SURVIVE v1 SIGN-OFF UNMARKED.
 *
 * Part 10 §12, wf-w5p3-selector: "R1 has NOT landed — the loaded-profile highlight is BY
 * ID where the server gives one, and the title-match fallback ships VISIBLY MARKED
 * PROVISIONAL IN CODE (a named constant / commented block carrying the R1 tag)."
 *
 * THE DEFECT (B1), from `sel-highlight-by-id`: the old skin highlights by TITLE
 * (`profileManager.js:546` — `workflowResponse.profile.title === profile.title`; and
 * `app.js:1391`), and ~70 bundled profiles of which 34 share a prefix is exactly the
 * population where that breaks. Measured on this build's own fixture: 14 duplicate titles
 * covering 84 of 147 records overall, and 2 duplicate titles covering 4 records among the
 * 78 VISIBLE ones — mostly unambiguous on a visible listing, and badly broken the moment
 * hidden records are in scope.
 *
 * THE TRAP, also quoted: the workflow report ALREADY carries a top-level `id` — the
 * WORKFLOW's own uuid (`workflow.dart:87`), not the profile's. Reading it is the same
 * defect with a different key, and `adapters-r.js` exports `R1_WRONG_KEY` to say so.
 *
 * WHAT SHIPS TONIGHT, and where each half lives:
 *   `adapters-r.js` `r1LoadedProfileId`  resolves the id — from `profile.id` if the report
 *                                        ever carries one (R1 HAS LANDED; the adapter says
 *                                        so and asks to be deleted), otherwise by title
 *                                        match, marked `provisional: true` with basis
 *                                        "title match against the profile listing —
 *                                        PROVISIONAL (R1)". Duplicate titles yield NO id
 *                                        and a reason, never the first match.
 *   `profile-library-store.js`           carries `provisional`, `basis` and `reason`
 *                                        through verbatim, un-summarised.
 *   `selector-screen.js`                 paints the highlight BY ID and writes
 *                                        `R1_PROVISIONAL_ATTR` on the row while the id
 *                                        came from the match — so the marking is
 *                                        observable in the rendered tree, not only in a
 *                                        comment, which is what the review confirms.
 *
 * THE SWAP, in one sentence (`adapters-r.js` R1 row, `swapWhen`): "GET /api/v1/workflow
 * carries the ProfileRecord id: read report.profile.id and delete the match." When that
 * lands, `provisional` goes false, this attribute stops appearing, and a grep for the tag
 * below finds every line that has to come out.
 * ═════════════════════════════════════════════════════════════════════════════════ */

/** Written on the highlighted row while its id came from R1's title match. */
export const R1_PROVISIONAL_ATTR = 'data-r1-provisional';

/** The tag a grep finds when R1 lands and the provisional path comes out. */
export const R1_PROVISIONAL_HIGHLIGHT = Object.freeze({
    ask: 'R1',
    decision: 'B1',
    what: 'the loaded-profile highlight falls back to a title match against the listing',
    marking: R1_PROVISIONAL_ATTR,
    mustNotSurvive: 'v1 sign-off',
    swapWhen: 'GET /api/v1/workflow carries profile.id — read it and delete the match',
    owner: 'src/data/adapters-r.js r1LoadedProfileId',
});

/**
 * SPLIT A TITLE AROUND THE FILTER'S MATCH — the pieces a highlight is painted from.
 *
 * Ben, 25 August 2026, on the selector audit's finding 7: "Highlight the match." Slate
 * marks the matched letters in yellow; Decal drew the same seven rows and marked
 * nothing.
 *
 * IT RETURNS PIECES, NOT MARKUP, and that is the whole of why it is here rather than in
 * the screen: this module is pure and testable, and a function that returned a template
 * could not be either. `[{text, hit}]` in order; joining the texts reproduces the title
 * exactly, which is the property a test can hold onto.
 *
 * THE COMPARISON IS THE FILTER'S OWN, case-insensitively, and every occurrence is marked
 * rather than only the first — `matchProfiles` accepts a row on any occurrence, so
 * marking one of three would leave two matches a reader can see and the highlight cannot.
 *
 * AN EMPTY QUERY IS ONE PIECE and no hits, so a caller never has to test for it.
 */
export function highlightParts(title, query) {
    const text = String(title ?? '');
    const wanted = String(query ?? '').trim();
    if (text === '' || wanted === '') return Object.freeze([Object.freeze({ text, hit: false })]);

    const haystack = text.toLowerCase();
    const needle = wanted.toLowerCase();
    const parts = [];
    let at = 0;
    for (;;) {
        const found = haystack.indexOf(needle, at);
        if (found < 0) break;
        if (found > at) parts.push(Object.freeze({ text: text.slice(at, found), hit: false }));
        parts.push(Object.freeze({ text: text.slice(found, found + needle.length), hit: true }));
        at = found + needle.length;
    }
    if (at < text.length) parts.push(Object.freeze({ text: text.slice(at), hit: false }));
    return Object.freeze(parts);
}
