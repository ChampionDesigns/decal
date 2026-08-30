// CANARY. Not part of the app. This file deliberately ports dead surface, so the scan in
// test/rea-excluded.test.mjs must reject it. If it ever passes, the scan has stopped
// covering its target.
export async function signalHeartbeat(fetchImpl) {
    return fetchImpl('/api/v1/machine/heartbeat', { method: 'POST' });
}

export async function previewLedStrip(fetchImpl, front, back) {
    return fetchImpl('/api/v1/machine/ledStrip/preview', {
        method: 'POST',
        body: JSON.stringify({ front, back }),
    });
}

export function getShots(fetchImpl, { orderBy = 'timestamp' } = {}) {
    return fetchImpl(`/api/v1/shots?orderBy=${orderBy}`);
}
