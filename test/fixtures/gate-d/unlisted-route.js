// CANARY — coverage-route-string.
// A route-shaped literal that no contract row covers. This is the shape of the load-cell
// calibration bug: a path hand-written at the call site that has never existed server-side.
export const WAKE_ROUTE = '/machine/wakeUp';

export function wake(transport) {
    return transport.request(WAKE_ROUTE, { method: 'POST' });
}
