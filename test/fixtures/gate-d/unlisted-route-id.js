// CANARY — coverage-route-id.
// Addressing by generated-table id never spells a path, so a path-only scan sees nothing.
// `getSteams` is a real row in the generated table and NOT a row in the contract table:
// documented by ReaPrime, never checked against its handler here, therefore not callable.
import { callRoute } from '../../../src/data/rea-routes.js';

export const steams = (transport) => callRoute(transport, 'getSteams');
