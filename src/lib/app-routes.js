/**
 * The route table, and the whole of the router that is not the DOM.
 */

/** `#/live`. The prefix is written once, here. */
export const ROUTE_HASH_PREFIX = '#/';

export const ROUTES = Object.freeze({
    live: Object.freeze({
        id: 'live',
        tag: 'live-screen',
        module: 'src/screens/live-screen.js',
        label: 'Live',
    }),

    selector: Object.freeze({
        id: 'selector',
        tag: 'selector-screen',
        module: 'src/screens/selector-screen.js',
        label: 'Profiles',
    }),

    settings: Object.freeze({
        id: 'settings',
        tag: 'settings-screen',
        module: 'src/screens/settings-screen.js',
        label: 'Settings',
    }),

    editor: Object.freeze({
        id: 'editor',
        tag: 'editor-screen',
        module: 'src/screens/editor-screen.js',
        label: 'Profile editor',
    }),

    history: Object.freeze({
        id: 'history',
        tag: 'history-screen',
        module: 'src/screens/history-screen.js',
        label: 'Shot history',
    }),
});

export const DEFAULT_ROUTE_ID = 'live';

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

export function routeIdFromHash(hash) {
    if (typeof hash !== 'string') return null;
    const trimmed = hash.trim().replace(/^#/, '').replace(/^\/+/, '');
    if (trimmed === '') return null;
    const first = trimmed.split(/[/?]/)[0];
    return /^[a-z][a-z0-9-]*$/i.test(first) ? first : null;
}

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
