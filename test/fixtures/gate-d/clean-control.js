// CONTROL — every Gate D check must pass on this file.
//
// It deliberately DISCUSSES both a route that is not tabled (`/machine/wakeUp`) and a
// retired spelling (`response.shots`, CB-21) in prose. A scan that cannot tell a name used
// from a name discussed fires here, and the fix for that false positive would be an
// exemption, and an exemption is how coverage dies.
import { callRoute } from '../../../src/data/rea-routes.js';

export const SHOTS = '/shots';

export function latest(transport) {
    return callRoute(transport, 'getShotsLatest');
}

export function list(transport, query) {
    return callRoute(transport, 'getShots', { query });
}

/** The paginated body: read `items`, never `shots`. */
export const readItems = (body) => body.items;
