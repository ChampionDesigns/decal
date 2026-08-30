/**
 * app-routes.js — the route table, and the whole of the router that is not the DOM.
 *
 * ONE DOCUMENT. A route change swaps WHICH SCREEN COMPONENT is mounted inside
 * `<app-root>`; there are no HTML fragments and no `innerHTML`-injected pages
 * (`src/screens/README.md`; `index.html:87-89`). That single sentence is three of the
 * shell's recorded bugs at once, and they are bugs of MECHANISM, not of care:
 *
 *   P1  a fragment that is malformed parses four `<dialog>`s as children of a CSS grid
 *       — because it is parsed as a fragment, in a context it was not written for;
 *   P2  a fragment's own `<script>` never runs, because `innerHTML` does not run
 *       scripts, so `profile_selector.html:129-132`'s `initScaling()` could never fire;
 *   S10 a second `initScaling()` would duplicate every resize listener — the two call
 *       sites are inert only by accident (`layout/shell.md` BUG-9).
 *
 * A route that resolves to a MODULE plus a TAG NAME has none of those failure modes:
 * the module is a real ES module (its top-level code runs, once, through the importmap),
 * and the screen is a custom element whose `disconnectedCallback` is the browser's own
 * guarantee that swapping it away tears its listeners down.
 *
 * WHY THIS FILE HAS NO DOM IN IT. `src/lib/` is "plain ES modules with no DOM access"
 * (SCOPE Part 2 §2), so everything here is string-in / object-out and runs under
 * `node:test`. `src/components/app-root.js` owns the two things that genuinely need a
 * document — reading `location.hash` and creating the element — and nothing else.
 *
 * HASH ROUTING, DELIBERATELY. ReaPrime serves this tree as static files, so a path
 * route (`/settings`) would 404 on reload and needs a server rewrite this project does
 * not control; `#/settings` cannot. The choice is isolated to `hashFor()` and
 * `routeIdFromHash()` — a path router is those two functions plus a `history.pushState`
 * in the element, and nothing else moves. Recorded as reversible in the wave digest.
 *
 * WHAT IS IN THE TABLE. Five rows, one per screen, each added by the wave that built the
 * screen it names: `live` (5.1), `selector` (5.3), `settings` (5.4), `editor` (5.5),
 * `history` (5.6). Wave 5.1's own constraint was "must not do: later screens", so a row
 * is added here by the wave that builds the screen it names — a row whose module does not
 * exist would resolve to a boot error, which is a worse answer than "that route does not
 * exist yet". `PLANNED_ROUTE_IDS` carried the names `src/screens/README.md` already
 * spells but no wave had built, as NAMES ONLY, so a link to a screen that was not built
 * yet stayed distinguishable from a typo; wave 5.6 emptied it by building the last one.
 */

/** `#/live`. The prefix is written once, here. */
export const ROUTE_HASH_PREFIX = '#/';

/**
 * The routes that exist. Each row is `{id, tag, module, label}`:
 *
 *   id      the route's name, and what goes in the hash
 *   tag     the custom element the screen defines — the element the shell mounts
 *   module  the specifier the shell imports to get that element defined. A BARE
 *           `src/...` specifier, resolved by `index.html`'s importmap (`"src/": "./src/"`),
 *           which is how every component in the tree already imports its neighbours.
 *   label   the screen's name in English. D2: v1 ships English only, but the label is a
 *           VALUE the shell passes to `t()`, never text baked into a template.
 */
export const ROUTES = Object.freeze({
    live: Object.freeze({
        id: 'live',
        tag: 'live-screen',
        module: 'src/screens/live-screen.js',
        label: 'Live',
    }),

    /* Wave 5.3 (wf-w5p3-selector). Added by the wave that built the screen it names,
     * per the rule stated above — the row and `src/screens/selector-screen.js` land
     * together, so `resolveRoute('#/selector')` never points at a file nobody wrote.
     *
     * THIS ROW IS BUG P2's DEATH CERTIFICATE. §7.3: "The page's own initScaling() can
     * never run — the router injects via innerHTML, and the fragment has no <head>
     * either" (`profile_selector.html:129-132`, `router.js:150`). A route that is a
     * MODULE plus a TAG has no such state: the module's top-level code runs once
     * through the importmap, and `<app-root>` calls `document.createElement(tag)`.
     * P1 goes with it — a fragment cannot be malformed when there is no fragment. */
    selector: Object.freeze({
        id: 'selector',
        tag: 'selector-screen',
        module: 'src/screens/selector-screen.js',
        label: 'Profiles',
    }),

    /* Wave 5.4 (wf-w5p4-settings), by the same rule: the row and
     * `src/screens/settings-screen.js` land together, and `settings` leaves
     * `PLANNED_ROUTE_IDS` in the same change so `planned` keeps meaning something. */
    settings: Object.freeze({
        id: 'settings',
        tag: 'settings-screen',
        module: 'src/screens/settings-screen.js',
        label: 'Settings',
    }),

    /* Wave 5.5 (wf-w5p5-editor), by the same rule: the row and
     * `src/screens/editor-screen.js` land together, and `editor` leaves
     * `PLANNED_ROUTE_IDS` in the same change so `planned` keeps meaning something. */
    editor: Object.freeze({
        id: 'editor',
        tag: 'editor-screen',
        module: 'src/screens/editor-screen.js',
        label: 'Profile editor',
    }),

    /* Wave 5.6 (wf-w5p6-history), by the same rule, and it is the LAST application
     * of it: `history` was the last name in `PLANNED_ROUTE_IDS`, so this row and the
     * empty list below land in one change and the list is now empty for good.
     *
     * THIS ROW IS THE OVERLAY→ROUTE CONVERSION (SCOPE Part 5 §6; §4.5 "A **route**,
     * not a `display:flex` toggle"). History was a panel toggled over the Live DOM,
     * which is why it had no navigation state to go back to and why both of its
     * overlays carried `aria-modal="true"` with nothing inert behind them (H9). A
     * route has real navigation state by construction: the address is the state, a
     * hash assignment pushes a session-history entry, and the screen that is not
     * mounted is not in the document at all — there is no hidden copy to be modal
     * over. What is left of H9 is focus handling on navigation, which is
     * `<history-screen>`'s and `<app-root>`'s two lines, not a second machinery. */
    history: Object.freeze({
        id: 'history',
        tag: 'history-screen',
        module: 'src/screens/history-screen.js',
        label: 'Shot history',
    }),
});

/** The route the app boots into (SCOPE Part 5 §1 — Live is screen one). */
export const DEFAULT_ROUTE_ID = 'live';

/**
 * Named, not built — AND AS OF WAVE 5.6 THERE ARE NONE. All five screens
 * `src/screens/README.md` lists are built and each has a row above.
 *
 * The rule that emptied it is the one it was written for: a name LEAVES this list in
 * the same commit that adds its row to `ROUTES` — `selector` did so in wave 5.3,
 * `settings` in 5.4, `editor` in 5.5 and `history` in 5.6 — because a route that is
 * both built and planned would make `planned` mean nothing.
 *
 * WHAT AN EMPTY LIST MEANS, STATED RATHER THAN LEFT TO BE INFERRED, because "empty"
 * and "the mechanism is gone" are different things and only one of them is true:
 *
 *   - `resolveRoute()` still reads this list and still reports `planned`. With no
 *     names in it the answer is `false` for every input, so today a stale link and a
 *     typo are the same event — both default to Live and both say `planned: false`.
 *     That is the honest answer now that nothing is planned, not a regression.
 *   - THE LIST IS NOT DELETED. A sixth screen is named here first and built second,
 *     which is the order that keeps a link to it distinguishable from a typo in
 *     between. Deleting the export would make the next wave re-invent it, and the
 *     one-line reversal is adding a string.
 *   - `test/app-shell.test.mjs` pins THREE things now, not two: the disjointness rule (now
 *     vacuously true, and it says so), the fact that `history` — the last name to
 *     leave — now MATCHES rather than answering `planned`, and THE BRANCH ITSELF, on a
 *     table and a list of the test's own. That last one is why `resolveRoute` takes the
 *     list as an argument (see it): with this export empty, a test that could only reach
 *     the module-level list could not reach `planned: true` at all, and the mechanism
 *     this comment says is preserved would be preserved only in prose.
 */
export const PLANNED_ROUTE_IDS = Object.freeze([]);

/** How a resolution ended. `defaulted` is not an error — it is where an app boots. */
export const ROUTE_MATCH = Object.freeze({
    MATCHED: 'matched',
    DEFAULTED: 'defaulted',
});

/** Every id in a table, in declaration order. */
export function routeIds(routes = ROUTES) {
    return Object.keys(routes);
}

/** One row by id, or `null`. Never throws: an unknown route is a state, not a crash. */
export function routeFor(id, routes = ROUTES) {
    if (typeof id !== 'string' || id === '') return null;
    return Object.prototype.hasOwnProperty.call(routes, id) ? routes[id] : null;
}

/** The hash that selects a route. `hashFor('live')` -> `'#/live'`. */
export function hashFor(id) {
    return `${ROUTE_HASH_PREFIX}${id}`;
}

/**
 * The route id a hash asks for, or `null` for "no opinion" (empty hash, `#`, `#/`).
 *
 * Tolerant on the way in and strict about what it returns: a leading `#`, a leading `/`
 * and a trailing `/` are all accepted spellings of the same route, a query or a nested
 * segment is ignored (`#/live/foo?x=1` is the Live route), and anything that is not a
 * plain identifier answers `null` rather than being passed on to a table lookup.
 */
export function routeIdFromHash(hash) {
    if (typeof hash !== 'string') return null;
    const trimmed = hash.trim().replace(/^#/, '').replace(/^\/+/, '');
    if (trimmed === '') return null;
    const first = trimmed.split(/[/?]/)[0];
    return /^[a-z][a-z0-9-]*$/i.test(first) ? first : null;
}

/**
 * Resolve a hash against a table.
 *
 * ALWAYS ANSWERS A ROUTE. An unknown or not-yet-built route falls back to the default
 * one rather than leaving the app blank — a blank app is the failure mode a router must
 * not have — and says so in `match` and `planned`, so the shell can render the fallback
 * honestly instead of pretending the user asked for it.
 *
 * BOTH TABLES ARE ARGUMENTS, and the second one is an argument for the same reason the
 * first one is. `routes` has always been injectable; `planned` was read off the module,
 * so the two answers this function gives came from one place a caller could substitute
 * and one it could not. That asymmetry stopped mattering the day `PLANNED_ROUTE_IDS`
 * emptied and started mattering the moment after: with nothing planned in the shipping
 * list there is no input to this function that reaches `planned: true`, so the branch
 * could not be exercised at all without passing a list in. Defaults are the shipping
 * pair, so every existing call site is unchanged and the app still resolves against the
 * one real table.
 *
 * @param {string} hash
 * @param {object} [routes]                the route table to resolve against
 * @param {object} [options]
 * @param {string} [options.defaultId]     the route an unknown hash falls back to
 * @param {string[]} [options.planned]     names that are declared but not yet built
 * @returns {{id: string, route: object, match: string, requested: string|null, planned: boolean}}
 */
export function resolveRoute(
    hash,
    routes = ROUTES,
    { defaultId = DEFAULT_ROUTE_ID, planned = PLANNED_ROUTE_IDS } = {},
) {
    const requested = routeIdFromHash(hash);
    const matched = routeFor(requested, routes);
    if (matched) {
        return { id: matched.id, route: matched, match: ROUTE_MATCH.MATCHED, requested, planned: false };
    }
    const fallback = routeFor(defaultId, routes);
    if (!fallback) {
        // A table with no default is a programming error, and a silent one would show as
        // an empty screen with no message. Fail where the mistake is.
        throw new Error(`app-routes: the route table has no default route '${defaultId}'`);
    }
    return {
        id: fallback.id,
        route: fallback,
        match: ROUTE_MATCH.DEFAULTED,
        requested,
        planned: requested !== null && Array.isArray(planned) && planned.includes(requested),
    };
}

/**
 * Check a table's shape. Called by `createAppBoot` at construction, so a malformed row
 * is reported when the table is handed over rather than at the moment a user navigates.
 */
export function assertRouteTable(routes = ROUTES) {
    const ids = routeIds(routes);
    if (ids.length === 0) throw new Error('app-routes: the route table is empty');
    for (const id of ids) {
        const row = routes[id];
        if (!row || typeof row !== 'object') throw new Error(`app-routes: route '${id}' is not an object`);
        if (row.id !== id) throw new Error(`app-routes: route '${id}' carries id '${row.id}'`);
        if (typeof row.tag !== 'string' || !row.tag.includes('-')) {
            throw new Error(`app-routes: route '${id}' needs a custom-element tag (a name with a hyphen), got '${row.tag}'`);
        }
        if (typeof row.module !== 'string' || row.module === '') {
            throw new Error(`app-routes: route '${id}' needs a module specifier`);
        }
    }
    return routes;
}
