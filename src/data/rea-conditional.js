/**
 * Conditional GETs: If-None-Match / ETag / 304.
 */

import { freezeDeep } from './rea-cache.js';

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

export function createEtagStore({ max = 32 } = {}) {
    const entries = new Map();
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
