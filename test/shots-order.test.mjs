/**
 * The shots page comes back in TIME order, whatever the wire says.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { orderShots, SHOT_ORDER } from '../src/stores/shots-store.js';

/** A list item as `toJsonWithoutMeasurements` sends it, trimmed to what ordering reads. */
const shot = (id, timestamp) => ({ id, timestamp, annotations: {}, stopReason: 'weight' });

/** ReaPrime's own spelling: local time, no `Z`, six decimal places. */
const NEWEST = shot('a', '2026-08-29T13:30:51.851461');
const MIDDLE = shot('b', '2026-08-29T11:38:24.999349');
const OLDEST = shot('c', '2026-08-28T07:48:26.608449');

const ids = (list) => list.map((s) => s.id);

describe('orderShots — the window in time order', () => {

    test('a shuffled page comes back newest first', () => {
        const wire = [MIDDLE, OLDEST, NEWEST];
        assert.deepEqual(ids(orderShots(wire, SHOT_ORDER.NEWEST_FIRST)), ['a', 'b', 'c']);
    });

    test('an ascending page asked for descending is turned round', () => {
        const wire = [OLDEST, MIDDLE, NEWEST];
        assert.deepEqual(ids(orderShots(wire, SHOT_ORDER.NEWEST_FIRST)), ['a', 'b', 'c']);
    });

    test('OLDEST_FIRST is the mirror, not a second rule', () => {
        const wire = [MIDDLE, NEWEST, OLDEST];
        assert.deepEqual(ids(orderShots(wire, SHOT_ORDER.OLDEST_FIRST)), ['c', 'b', 'a']);
    });

    test('a page the server already ordered passes through unchanged', () => {
        const wire = [NEWEST, MIDDLE, OLDEST];
        const out = orderShots(wire, SHOT_ORDER.NEWEST_FIRST);
        assert.deepEqual(ids(out), ['a', 'b', 'c']);
        assert.equal(out[0], NEWEST);
    });

    test('the default direction is newest first — the direction the store asks for', () => {
        assert.deepEqual(ids(orderShots([OLDEST, NEWEST, MIDDLE])), ['a', 'b', 'c']);
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * Ties — two shots claiming one instant
     * ═══════════════════════════════════════════════════════════════════════ */

    test('two shots at one instant keep the order the server gave them', () => {
        const first = shot('tie-first', '2026-08-29T08:40:00.000000');
        const second = shot('tie-second', '2026-08-29T08:40:00.000000');
        assert.deepEqual(
            ids(orderShots([NEWEST, first, second, OLDEST], SHOT_ORDER.NEWEST_FIRST)),
            ['a', 'tie-first', 'tie-second', 'c'],
        );
        /* And the same pair the other way round stays the other way round: the tie-break
         * is arrival, so it reports the server's order rather than imposing one. */
        assert.deepEqual(
            ids(orderShots([NEWEST, second, first, OLDEST], SHOT_ORDER.NEWEST_FIRST)),
            ['a', 'tie-second', 'tie-first', 'c'],
        );
    });

    test('a tie survives being reordered around — nothing is dropped or doubled', () => {
        const tie = ['x', 'y', 'z'].map((id) => shot(id, '2026-08-29T08:40:00.000000'));
        const out = orderShots([tie[2], OLDEST, tie[0], NEWEST, tie[1]], SHOT_ORDER.NEWEST_FIRST);
        assert.deepEqual(ids(out), ['a', 'z', 'x', 'y', 'c']);
        assert.equal(out.length, 5, 'every row survives the sort exactly once');
    });

    test('ties are not broken by the id — a content hash is not a clock', () => {
        const later = shot('zzz', '2026-08-29T08:40:00.000000');
        const earlier = shot('aaa', '2026-08-29T08:40:00.000000');
        assert.deepEqual(ids(orderShots([later, earlier])), ['zzz', 'aaa']);
    });

    test('sub-millisecond neighbours tie, and the tie is resolved by arrival', () => {
        const first = shot('us-first', '2026-08-29T08:40:00.000100');
        const second = shot('us-second', '2026-08-29T08:40:00.000900');
        assert.deepEqual(ids(orderShots([second, first])), ['us-second', 'us-first']);
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * Records that carry no readable instant
     * ═══════════════════════════════════════════════════════════════════════ */

    test('a shot with no readable stamp sorts last, never first', () => {
        /* The head of this list is the shot the Live band opens on and the one
         * `askShots()` spends 221 KB fetching. A row that cannot be placed in time must
         * not take that seat. */
        for (const bad of [null, '', 'not a date', undefined, 12345]) {
            const wire = [shot('bad', bad), NEWEST, OLDEST];
            assert.deepEqual(
                ids(orderShots(wire, SHOT_ORDER.NEWEST_FIRST)), ['a', 'c', 'bad'],
                `an unreadable stamp (${JSON.stringify(bad)}) belongs at the end`,
            );
        }
    });

    test('an unreadable stamp sorts last in OLDEST_FIRST too — not placeable is not oldest', () => {
        const wire = [shot('bad', 'not a date'), NEWEST, OLDEST];
        assert.deepEqual(ids(orderShots(wire, SHOT_ORDER.OLDEST_FIRST)), ['c', 'a', 'bad']);
    });

    test('several unreadable stamps keep their arrival order among themselves', () => {
        const wire = [shot('p', null), NEWEST, shot('q', null), shot('r', null)];
        assert.deepEqual(ids(orderShots(wire)), ['a', 'p', 'q', 'r']);
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * The shapes a page can arrive in
     * ═══════════════════════════════════════════════════════════════════════ */

    test('an empty page and a non-array are both an empty list, never a throw', () => {
        for (const input of [[], null, undefined, {}, 'items']) {
            assert.deepEqual(orderShots(input), [], `${JSON.stringify(input)} is no rows`);
        }
    });

    test('the input array is not mutated — the store publishes, it does not edit', () => {
        const wire = [MIDDLE, NEWEST, OLDEST];
        const before = ids(wire);
        orderShots(wire, SHOT_ORDER.NEWEST_FIRST);
        assert.deepEqual(ids(wire), before);
    });

    test('a row that is not an object is carried, not dropped', () => {
        /* It cannot be placed and it is not this function's business to censor the page:
         * a row the wire sent is a row the reader gets to see, at the end. */
        const out = orderShots([null, NEWEST], SHOT_ORDER.NEWEST_FIRST);
        assert.equal(out.length, 2);
        assert.equal(out[0], NEWEST);
        assert.equal(out[1], null);
    });
});
