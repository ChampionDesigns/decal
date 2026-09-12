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

/** How the leave was asked for. NAVIGATE and UNLOAD are asked before the address moves. */
export const LEAVE_KIND = Object.freeze({
    NAVIGATE: 'navigate',
    HISTORY: 'history',
    UNLOAD: 'unload',
});

/** What the shell must do about the answer. STAY leaves the address alone; RESTORE puts it back. */
export const LEAVE_ACTION = Object.freeze({
    LEAVE: 'leave',
    STAY: 'stay',
    RESTORE: 'restore',
});

/**
 * The guards a screen registers to refuse a route change, and the one place their answers
 * become an action. A guard answers `false`, or `{allow: false, reason}` to have the
 * refusal reported in words; anything else allows the leave.
 */
export function createLeaveContract({ logger = null } = {}) {
    const guards = new Set();
    let armed = null;

    /** Register a guard. Returns its own removal. */
    function guard(fn) {
        if (typeof fn !== 'function') return () => {};
        guards.add(fn);
        return () => { guards.delete(fn); };
    }

    /* A guard that throws ALLOWS the navigation: a broken guard that refused would lock
     * the app on one screen. */
    function ask(details) {
        for (const fn of guards) {
            let answer;
            try {
                answer = fn(details);
            } catch (error) {
                logger?.warn?.('a route-leave guard threw; the navigation is allowed', error);
                continue;
            }
            if (answer === false) return { refused: true, reason: null };
            if (answer && typeof answer === 'object' && answer.allow === false) {
                return {
                    refused: true,
                    reason: typeof answer.reason === 'string' && answer.reason !== '' ? answer.reason : null,
                };
            }
        }
        return { refused: false, reason: null };
    }

    /**
     * May we leave `from` for `to`? Answers an action, the reason a guard gave, and the
     * address a RESTORE must be corrected back to.
     */
    function request({ from = null, to = null, kind = LEAVE_KIND.NAVIGATE } = {}) {
        const base = { kind, from, to, reason: null, restoreTo: null, consulted: false };

        /* Our own correction arriving back as an event. Consumed first, and it disarms
         * itself, or the correction loops. */
        if (armed !== null && kind === LEAVE_KIND.HISTORY && to === armed) {
            armed = null;
            return { ...base, action: LEAVE_ACTION.LEAVE };
        }

        /* Re-asserting the address we are already on is not a leave, and asking a guard
         * about it would have a screen refuse its own address. */
        if (from !== null && from === to) {
            return { ...base, action: LEAVE_ACTION.LEAVE };
        }

        armed = null;

        const { refused, reason } = ask({ from, to, kind });
        if (!refused) return { ...base, action: LEAVE_ACTION.LEAVE, consulted: true };

        /* Only a traversal owes a correction: the address has already moved. */
        if (kind === LEAVE_KIND.HISTORY && typeof from === 'string' && from !== '') {
            armed = from;
            return {
                ...base, action: LEAVE_ACTION.RESTORE, reason, restoreTo: from, consulted: true,
            };
        }
        return { ...base, action: LEAVE_ACTION.STAY, reason, consulted: true };
    }

    return Object.freeze({
        guard,
        request,
        pendingRestore: () => armed,
        size: () => guards.size,
    });
}
