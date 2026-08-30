// Conditional GETs: If-None-Match / ETag / 304.
//
// THE FREE WIN THE COUNT FOUND (scope/e2-api.md, "Caching: keep two, delete three"):
// ReaPrime already serves an ETag and honours If-None-Match on every LIST route the skin
// reads, and **the old skin never sent If-None-Match anywhere** — 95 fetch call sites,
// zero conditional requests. The server side has been ready the whole time.
//
// The server implementation is one function, `jsonOkConditional` (`json_response.dart`),
// read at ReaPrime 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
//
//     final body   = jsonEncode(data);
//     final digest = sha256.convert(utf8.encode(body)).toString().substring(0, 16);
//     final etag   = '"$digest"';
//     if (ifNoneMatch == '*' || ifNoneMatch == etag) return Response.notModified(...);
//     return Response.ok(body, headers: {..., 'ETag': etag});
//
// Three things follow from reading it rather than assuming it:
//
//  1. The ETag is a CONTENT hash of the exact serialized body. It is strong (no `W/`
//     prefix) and quoted. Send back exactly what was received, quotes included.
//  2. The server compares the header VERBATIM against the one ETag. No list parsing, no
//     weak comparison. Sending `"a", "b"` matches nothing; sending `*` always matches, so
//     never send `*` — it would report "unchanged" against a body we do not hold.
//  3. The saving is only the body. The handler still does all of its work — the shots
//     list still runs its query and its count — so this buys bandwidth and parse time on
//     a tablet, not server load. Claiming otherwise would be folklore, which is the thing
//     DECISIONS.md's caching rule forbids.
//
// A 304 has no body, so revalidation is only useful if the last body is held. That store
// is below, and it is the one cache in this module: its named payoff is that it is what
// makes 304 legible at all, and it is bounded so it cannot become the old skin's
// `getAllShots` (a full-store deserialize of every shot ever mirrored, on every boot,
// with nothing evicting).
//
// THE ASYMMETRY, and it is the reason the IDB latest-shot mirror survives elsewhere:
// of the shots reads, ONLY the paginated list is conditional. `GET /shots/<id>` (~221 KB),
// `/shots/latest`, `/shots/ids` and the `ids=` batch form all return plain `jsonOk`
// (`shots_handler.dart`, `_getShot` / `_getLatestShot` / `_getIds` / the ids branch of
// `_getShots`). Sending If-None-Match to those is not wrong, it is inert — the response
// carries no ETag, so nothing is ever stored and nothing is ever revalidated. The
// registry below is therefore an executable statement of where the win exists, checked
// against the handler set by test/rea-conditional.test.mjs so an upstream change to
// `jsonOkConditional`'s call sites fails a test instead of silently costing bandwidth.

import { freezeDeep } from './rea-cache.js';

/**
 * Every `jsonOkConditional` call site in ReaPrime at 2b047d02, as a route.
 *
 * Seven call sites, six routes: `_getShots` calls it twice (the empty-bean-batch early
 * return and the main return) on the one path.
 */
export const CONDITIONAL_ROUTES = Object.freeze([
    Object.freeze({
        path: '/shots',
        handlerFile: 'lib/src/services/webserver/shots_handler.dart',
        handlerSymbol: 'ShotsHandler._getShots',
        callSites: 2,
        note: 'Paginated list only. The `ids=` batch branch returns plain jsonOk — see shotsListIsConditional.',
    }),
    Object.freeze({
        path: '/profiles',
        handlerFile: 'lib/src/services/webserver/profile_handler.dart',
        handlerSymbol: 'ProfileHandler._handleGetAll',
        callSites: 1,
        note: 'Covers every query form: visibility, includeHidden, parentId.',
    }),
    Object.freeze({
        path: '/beans',
        handlerFile: 'lib/src/services/webserver/beans_handler.dart',
        handlerSymbol: 'BeansHandler._getBeans',
        callSites: 1,
        note: 'includeArchived participates in the body, hence in the ETag.',
    }),
    Object.freeze({
        path: '/beans/<beanId>/batches',
        handlerFile: 'lib/src/services/webserver/beans_handler.dart',
        handlerSymbol: 'BeansHandler._getBatches',
        callSites: 1,
        note: null,
    }),
    Object.freeze({
        path: '/grinders',
        handlerFile: 'lib/src/services/webserver/grinders_handler.dart',
        handlerSymbol: 'GrindersHandler._getGrinders',
        callSites: 1,
        note: null,
    }),
    Object.freeze({
        path: '/store/<namespace>',
        handlerFile: 'lib/src/services/webserver/kv_store_handler.dart',
        handlerSymbol: 'KvStoreHandler.addRoutes (inline GET /store/<namespace>)',
        callSites: 1,
        note: 'ONLY with ?full=1. Without it the handler returns the key list via plain jsonOk.',
    }),
]);

/**
 * Shots reads that are deliberately NOT conditional, recorded because their absence is
 * load-bearing: it is the whole argument for keeping one IDB mirror (SCOPE Part 3 §4).
 */
export const NON_CONDITIONAL_SHOT_READS = Object.freeze([
    Object.freeze({ path: '/shots/<id>', handlerSymbol: 'ShotsHandler._getShot', why: 'plain jsonOk; ~221 KB per record' }),
    Object.freeze({ path: '/shots/latest', handlerSymbol: 'ShotsHandler._getLatestShot', why: 'plain jsonOk' }),
    Object.freeze({ path: '/shots/ids', handlerSymbol: 'ShotsHandler._getIds', why: 'plain jsonOk' }),
    Object.freeze({ path: '/shots?ids=', handlerSymbol: 'ShotsHandler._getShots (ids branch)', why: 'plain jsonOk' }),
]);

/** Match a concrete path against one template, `<param>` matching a single segment. */
function pathMatches(template, path) {
    const t = template.split('/');
    const p = path.split('/');
    if (t.length !== p.length) return false;
    return t.every((seg, i) => (seg.startsWith('<') && seg.endsWith('>') ? p[i].length > 0 : seg === p[i]));
}

/**
 * The `ids=` batch form of GET /shots takes the plain-jsonOk branch, but ONLY when no
 * filter is also present — with a filter the handler falls through to the paginated
 * branch, which IS conditional (`shots_handler.dart`, `hasFilters`). Transcribed rather
 * than guessed, because guessing it the other way costs nothing visible and quietly
 * disables revalidation for the one list that matters.
 */
const SHOT_FILTER_PARAMS = Object.freeze([
    'grinderId', 'grinderModel', 'beanId', 'beanBatchId',
    'coffeeName', 'coffeeRoaster', 'profileTitle', 'search',
]);

export function shotsListIsConditional(query = {}) {
    const rawIds = query.ids;
    const ids = Array.isArray(rawIds) ? rawIds.join(',') : rawIds;
    const hasIds = typeof ids === 'string' && ids.split(',').some((id) => id.length > 0);
    if (!hasIds) return true;
    return SHOT_FILTER_PARAMS.some((key) => query[key] !== undefined && query[key] !== null);
}

/**
 * Does ReaPrime serve ETag/304 for this GET?
 *
 * @param {string} path   API-relative, e.g. '/shots' or '/store/decal'
 * @param {object} [query]
 */
export function isConditionalRoute(path, query = {}) {
    const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
    if (pathMatches('/shots', clean)) return shotsListIsConditional(query);
    if (pathMatches('/store/<namespace>', clean)) return String(query.full) === '1';
    return CONDITIONAL_ROUTES.some((route) => route.path !== '/shots'
        && route.path !== '/store/<namespace>'
        && pathMatches(route.path, clean));
}

/**
 * The last body per conditional URL, so a 304 has something to mean.
 *
 * Bounded and LRU by insertion order. The cap exists because a History screen paging
 * through a long list mints a distinct URL per page: unbounded, this becomes the mirror
 * bug it is meant to avoid. 32 entries covers every list the skin reads several times
 * over; eviction costs one extra full body, never a wrong one.
 */
export function createEtagStore({ max = 32 } = {}) {
    const entries = new Map();
    // The stored body IS what a 304 means. Frozen deeply on the way in, for the reason
    // written out in rea-cache.js: it is handed to every later reader by reference, and a
    // caller that adapted it in place made the next 304 replay a body ReaPrime never sent.

    const touch = (key, value) => {
        entries.delete(key);
        entries.set(key, value);
        while (entries.size > max) entries.delete(entries.keys().next().value);
    };

    return {
        /** @returns {{etag: string, data: unknown}|null} */
        get(key) {
            const hit = entries.get(key);
            if (!hit) return null;
            touch(key, hit);
            return hit;
        },
        set(key, etag, data) {
            if (typeof etag !== 'string' || !etag) return;
            touch(key, Object.freeze({ etag, data: freezeDeep(data) }));
        },
        /** A write invalidates every stored body: the next read revalidates from scratch. */
        clear() {
            entries.clear();
        },
        /** Forget one URL. Used after a write that is known to change exactly that list. */
        forget(key) {
            entries.delete(key);
        },
        get size() {
            return entries.size;
        },
        keys() {
            return [...entries.keys()];
        },
    };
}
