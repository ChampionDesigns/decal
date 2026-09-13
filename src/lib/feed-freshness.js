/** One freshness verdict for the value a feed holds, so every surface answers it alike.
 *  Age is classified where the frames are; this module keeps no clock of its own. */

import { FEED_STATUS } from '../stores/feed-store.js';

export const READING_FRESHNESS = Object.freeze({
    FRESH: 'fresh',
    STALE: 'stale',
    ABSENT: 'absent',
});

export function freshnessOf(state) {
    if (!state || typeof state !== 'object') return READING_FRESHNESS.ABSENT;
    if (state.status === FEED_STATUS.LIVE) return READING_FRESHNESS.FRESH;
    if (state.status === FEED_STATUS.NEVER) return READING_FRESHNESS.ABSENT;
    /* Stale needs a held value: a feed that answered nothing is absent, not old. */
    return state.receivedAt === null || state.receivedAt === undefined
        ? READING_FRESHNESS.ABSENT
        : READING_FRESHNESS.STALE;
}
