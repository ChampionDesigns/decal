/**
 * The route layer: the generated table, bound to the injected transport.
 */

import {
    REST_ROUTES,
    REST_ROUTE_BY_ID,
    REST_ROUTE_BY_KEY,
    SOCKET_CHANNELS,
    SOCKET_CHANNEL_BY_ROUTE,
    REA_ROUTE_EXCEPTIONS,
    REA_ROUTES_SOURCE,
} from './rea-routes.generated.js';

export {
    REST_ROUTES,
    REST_ROUTE_BY_ID,
    REST_ROUTE_BY_KEY,
    SOCKET_CHANNELS,
    SOCKET_CHANNEL_BY_ROUTE,
    REA_ROUTE_EXCEPTIONS,
    REA_ROUTES_SOURCE,
};

export class ReaRouteError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReaRouteError';
    }
}

/** The row for a generated id, or a hard failure. An unknown id is never a soft miss. */
export function routeById(id) {
    const route = REST_ROUTE_BY_ID[id];
    if (!route) {
        throw new ReaRouteError(
            `no route "${id}" in the generated table. ReaPrime does not document it at `
            + `${REA_ROUTES_SOURCE.commit.slice(0, 8)}; hand-writing a path at the call site is how a route drifts `
            + 'shipped a load-cell calibration wizard addressing an endpoint that has never existed in '
            + "ReaPrime's history (see src/data/EXCLUDED.md).",
        );
    }
    return route;
}

/** The row for a transport-relative template, e.g. `('GET', '/shots/<id>')`. */
export function routeFor(method, template) {
    const route = REST_ROUTE_BY_KEY[`${method.toUpperCase()} ${template}`];
    if (!route) throw new ReaRouteError(`no route ${method.toUpperCase()} ${template} in the generated table`);
    return route;
}

/** Does this template segment stand for a parameter? Both spellings are accepted. */
const isParamSegment = (segment) => (segment.startsWith('<') && segment.endsWith('>'))
    || (segment.startsWith('{') && segment.endsWith('}'));

/** Match a CONCRETE path (`/shots/2026-08-17T…`) against a template (`/shots/<id>`). */
export function pathMatchesTemplate(template, path) {
    const t = template.split('/');
    const p = path.split('?')[0].split('/');
    if (t.length !== p.length) return false;
    return t.every((segment, i) => (isParamSegment(segment) ? p[i].length > 0 : segment === p[i]));
}

export function findRoute(method, path) {
    const wanted = method.toUpperCase();
    const bare = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) : path;
    return REST_ROUTES.find((r) => r.method === wanted && pathMatchesTemplate(r.route, bare)) || null;
}

/** True when ReaPrime documents this method and path at the pinned commit. */
export const isDocumentedRoute = (method, path) => findRoute(method, path) !== null;

/** The socket channel for a transport-relative address, or a hard failure. */
export function channelFor(route) {
    const channel = SOCKET_CHANNEL_BY_ROUTE[route];
    if (!channel) throw new ReaRouteError(`no socket channel ${route} in the generated table`);
    return channel;
}

export function buildPath(route, params = {}) {
    const given = Object.keys(params);
    const unknown = given.filter((name) => !route.pathParams.includes(name));
    if (unknown.length) {
        throw new ReaRouteError(`${route.id}: unknown path parameter(s) ${unknown.join(', ')}`);
    }
    return route.route.replace(/<([^>]+)>/g, (_, name) => {
        const value = params[name];
        if (value === undefined || value === null || value === '') {
            throw new ReaRouteError(`${route.id}: path parameter "${name}" is required`);
        }
        return encodeURIComponent(String(value));
    });
}

export function buildQuery(route, query = null) {
    if (!query) return null;
    const declared = new Set(route.query.map((q) => q.name));
    for (const name of Object.keys(query)) {
        if (declared.has(name)) continue;
        const exception = REA_ROUTE_EXCEPTIONS.find(
            (e) => e.routes.includes(route.id) && e.effect.includes(`"${name}"`),
        );
        throw new ReaRouteError(
            `${route.id}: "${name}" is not a documented query parameter`
            + (exception ? ` (see exception ${exception.id}: ${exception.effect})` : '')
            + `. Documented: ${route.query.map((q) => q.name).join(', ') || 'none'}.`,
        );
    }
    for (const param of route.query) {
        if (param.required && (query[param.name] === undefined || query[param.name] === null)) {
            throw new ReaRouteError(`${route.id}: query parameter "${param.name}" is required`);
        }
    }
    return query;
}

export function callRoute(transport, id, { params = {}, query = null, body = undefined, ...options } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new ReaRouteError('callRoute: a transport must be injected (see createReaTransport)');
    }
    const route = routeById(id);
    if (body !== undefined && route.method === 'GET') {
        throw new ReaRouteError(`${route.id}: GET takes no request body`);
    }
    return transport.request(buildPath(route, params), {
        method: route.method,
        query: buildQuery(route, query),
        body,
        ...options,
    });
}

/** Compose a socket URL from the channel table. Throws if the transport has no socket base. */
export function socketUrl(transport, channelRoute, params = {}) {
    const channel = channelFor(channelRoute);
    const path = channel.route.replace(/<([^>]+)>/g, (_, name) => {
        const value = params[name];
        if (value === undefined || value === null || value === '') {
            throw new ReaRouteError(`${channel.id}: socket parameter "${name}" is required`);
        }
        return encodeURIComponent(String(value));
    });
    return transport.socketUrl(path);
}

export const HELPER_DEMAND = Object.freeze([
    Object.freeze({ helper: 'capabilities', routeId: 'getMachineCapabilities', wantedBy: 'gate4-capabilities-store', consumer: 'src/stores/capabilities-store.js' }),
    Object.freeze({ helper: 'cupWarmer', routeId: 'getMachineCupWarmer', wantedBy: 'gate4-cupwarmer-store', consumer: 'src/stores/cup-warmer.js' }),
    Object.freeze({ helper: 'setCupWarmer', routeId: 'putMachineCupWarmer', wantedBy: 'gate4-cupwarmer-store', consumer: 'src/stores/cup-warmer.js' }),
    Object.freeze({ helper: 'cupWarmerPreheat', routeId: 'getMachineCupWarmerPreheat', wantedBy: 'gate4-cupwarmer-store (the two named pre-warm warning states)', consumer: 'src/stores/cup-warmer.js' }),
    Object.freeze({ helper: 'setCupWarmerPreheat', routeId: 'putMachineCupWarmerPreheat', wantedBy: 'gate4-cupwarmer-store', consumer: 'src/stores/cup-warmer.js' }),
]);

export const RETIRED_HELPERS = Object.freeze([
    Object.freeze({ helper: 'sensors', id: 'getSensors', reachedBy: 'by id from src/data/rea-sensors.js' }),
    Object.freeze({ helper: 'connectDevice', id: 'putDevicesConnect', reachedBy: 'by id from src/data/rea-devices.js' }),
    Object.freeze({ helper: 'shots', id: 'getShots', reachedBy: 'by id, when a shots reader exists' }),
    Object.freeze({ helper: 'latestShot', id: 'getShotsLatest', reachedBy: 'by id, when a shots reader exists' }),
    Object.freeze({ helper: 'shot', id: 'getShotsById', reachedBy: 'by id with the shot id as a path parameter, when a shots reader exists' }),
]);

/**
 * Bind the demand surface to a transport.
 *
 * @param {object} transport a `createReaTransport(...)` client
 */
export function createReaRoutes(transport) {
    if (!transport || typeof transport.request !== 'function') {
        throw new ReaRouteError('createReaRoutes: a transport must be injected (see createReaTransport)');
    }
    const call = (id, options) => callRoute(transport, id, options);

    return Object.freeze({
        /** The seven-entry capability list, or [] on a machine that is not a Bengle —
         *  ReaPrime's own answer, never inferred from a model string here. */
        capabilities: () => call('getMachineCapabilities'),

        cupWarmer: () => call('getMachineCupWarmer'),
        /** `{temperature?, enabled?}` — at least one, whole °C 0–80. The handler refuses
         *  anything else with a typed 400; the refusal is the server's to make. */
        setCupWarmer: (body) => call('putMachineCupWarmer', { body }),

        cupWarmerPreheat: () => call('getMachineCupWarmerPreheat'),
        /** `{enabled?, leadMinutes?}`. */
        setCupWarmerPreheat: (body) => call('putMachineCupWarmerPreheat', { body }),
    });
}
