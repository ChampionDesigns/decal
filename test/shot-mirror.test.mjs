// The rebuilt IDB latest-shot mirror, executed against a fake IndexedDB.
//
// SCOPE Part 6 lists the `idb.js` successor under "Untested today and must not stay that
// way in this wave's reach" — the old module had NO executing test, which is how a mirror
// whose whole purpose is an instant paint shipped for months stripping its own cache on
// every list load, and how a version bump hung boot with nothing in the console.
//
// Every describe block below is one of the five named defects.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    FULL_STORE,
    META_STORE,
    MIRROR_ERROR,
    MIRROR_RESULT,
    MIRROR_VERSION,
    createShotMirror,
    isFullShot,
    shotTimeMs,
} from '../src/stores/shot-mirror.js';
import { createFakeIndexedDB } from './fixtures/fake-indexeddb.js';
import { IDB_DATABASE_NAME } from '../src/lib/storage-routes.js';

/** `ShotRecord.toJson()` — the full record, measurements included. */
function fullShot(id, timestamp, samples = 3) {
    return {
        id,
        timestamp,
        measurements: Array.from({ length: samples }, (_, i) => ({ timestamp, groupPressure: i })),
        workflow: { doseWeight: 18 },
    };
}

/** `ShotRecord.toJsonWithoutMeasurements()` — what the paginated list serves. NO key. */
function metaShot(id, timestamp) {
    return { id, timestamp, workflow: { doseWeight: 18 } };
}

function recordingLogger() {
    const lines = [];
    const self = {
        debug: (...a) => lines.push(['debug', ...a]),
        info: (...a) => lines.push(['info', ...a]),
        warn: (...a) => lines.push(['warn', ...a]),
        error: (...a) => lines.push(['error', ...a]),
        scope: () => self,
        lines,
    };
    return self;
}

function fixture(options = {}) {
    const indexedDB = options.indexedDB || createFakeIndexedDB();
    const logger = recordingLogger();
    const mirror = createShotMirror({
        indexedDB,
        logger,
        openTimeoutMs: 200,
        blockedGraceMs: 20,
        ...options,
    });
    return { mirror, indexedDB, logger };
}

describe('defect 1 — meta records can no longer poison full ones', () => {
    test('a list load does not strip the cached full record', async () => {
        const { mirror } = fixture();
        const shot = fullShot('a-1', '2026-08-17T08:00:00.000Z');
        assert.equal((await mirror.putFull(shot)).ok, true);

        // The exact shape of the old bug: the 20 newest, meta-only, same ids.
        const page = [metaShot('a-1', '2026-08-17T08:00:00.000Z'), metaShot('a-2', '2026-08-17T07:00:00.000Z')];
        assert.equal((await mirror.putMetaList(page)).ok, true);
        // ...six times over, as the post-shot refresh did.
        for (let i = 0; i < 6; i += 1) await mirror.putMetaList(page);

        const latest = await mirror.latestFull();
        assert.equal(latest.status, MIRROR_RESULT.HIT);
        assert.equal(latest.record.measurements.length, 3, 'the list load stripped the measurements — the poisoning bug');
    });

    test('putFull REFUSES a meta-only record instead of degrading one silently', async () => {
        const { mirror, logger } = fixture();
        const result = await mirror.putFull(metaShot('a-1', '2026-08-17T08:00:00.000Z'));
        assert.equal(result.ok, false);
        assert.equal(result.reason, MIRROR_ERROR.REJECTED);
        assert.ok(logger.lines.some(([level]) => level === 'error'));
        assert.equal((await mirror.latestFull()).status, MIRROR_RESULT.MISS);
    });

    test('the two stores are separate, and a full record is stored verbatim', async () => {
        const { mirror, indexedDB } = fixture();
        const shot = fullShot('a-1', '2026-08-17T08:00:00.000Z');
        await mirror.putFull(shot);
        await mirror.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]);
        assert.deepEqual(indexedDB.storeNames(IDB_DATABASE_NAME), [META_STORE, FULL_STORE].sort());
        assert.deepEqual((await mirror.full('a-1')).record, shot, 'the record must come back exactly as it went in');
        assert.equal(Object.hasOwn((await mirror.meta('a-1')).record, 'measurements'), false);
    });

    test('the full/meta test is key presence, so an empty measurement list is still full', () => {
        assert.equal(isFullShot(fullShot('a', '2026-08-17T08:00:00.000Z', 0)), true);
        assert.equal(isFullShot(metaShot('a', '2026-08-17T08:00:00.000Z')), false);
        assert.equal(isFullShot({ id: 'a', measurements: null }), false);
        assert.equal(isFullShot(null), false);
    });
});

describe('defect 2 — the newest shot by TIME, not by the largest UUID', () => {
    test('the lexicographically largest id is not the answer', async () => {
        const { mirror } = fixture();
        // 'ffff…' sorts last as a string but is the OLDEST shot.
        await mirror.putFull(fullShot('ffffffff-0000-4000-8000-000000000000', '2026-08-01T06:00:00.000Z'));
        await mirror.putFull(fullShot('00000000-0000-4000-8000-000000000000', '2026-08-17T06:00:00.000Z'));

        const latest = await mirror.latestFull();
        assert.equal(latest.record.id, '00000000-0000-4000-8000-000000000000',
            'this is the primary-key walk that returned the largest UUID');
        assert.equal(latest.ts, Date.parse('2026-08-17T06:00:00.000Z'));
    });

    test('the meta store answers the same way', async () => {
        const { mirror } = fixture();
        await mirror.putMetaList([
            metaShot('zzz', '2026-08-01T06:00:00.000Z'),
            metaShot('aaa', '2026-08-17T06:00:00.000Z'),
        ]);
        assert.equal((await mirror.latestMeta()).record.id, 'aaa');
    });

    test('a shot whose stamp does not parse is REFUSED, never stored unindexed', async () => {
        const { mirror, logger } = fixture();
        const result = await mirror.putFull({ ...fullShot('a-1', 'not a date') });
        assert.equal(result.ok, false);
        assert.equal(result.reason, MIRROR_ERROR.REJECTED);
        assert.ok(logger.lines.some(([level]) => level === 'error'));
        assert.equal(shotTimeMs({ timestamp: 'not a date' }), null);
        assert.equal(shotTimeMs({ timestamp: '2026-08-17T08:00:00.000Z' }), Date.parse('2026-08-17T08:00:00.000Z'));
    });

    test('a record with no id is refused', async () => {
        const { mirror } = fixture();
        assert.equal((await mirror.putMetaList([{ timestamp: '2026-08-17T08:00:00.000Z' }])).ok, false);
    });
});

describe('defect 3 — nothing reads the whole store, and nothing grows forever', () => {
    test('there is no unbounded read: recentMeta demands a sane limit', async () => {
        const { mirror } = fixture();
        await assert.rejects(async () => mirror.recentMeta(), RangeError);
        await assert.rejects(async () => mirror.recentMeta(0), RangeError);
        await assert.rejects(async () => mirror.recentMeta(10_000), RangeError);
    });

    test('recentMeta returns the newest N, newest first', async () => {
        const { mirror } = fixture();
        await mirror.putMetaList([
            metaShot('a', '2026-08-14T06:00:00.000Z'),
            metaShot('b', '2026-08-15T06:00:00.000Z'),
            metaShot('c', '2026-08-16T06:00:00.000Z'),
        ]);
        const page = await mirror.recentMeta(2);
        assert.equal(page.status, MIRROR_RESULT.HIT);
        assert.deepEqual(page.records.map((r) => r.id), ['c', 'b']);
    });

    test('an empty store is a MISS, which is not the same as unavailable', async () => {
        const { mirror } = fixture();
        assert.equal((await mirror.recentMeta(5)).status, MIRROR_RESULT.MISS);
        assert.equal((await mirror.latestFull()).status, MIRROR_RESULT.MISS);
    });

    test('the full store is capped, oldest evicted first', async () => {
        const { mirror } = fixture({ fullCap: 2 });
        for (const day of ['11', '12', '13', '14']) {
            await mirror.putFull(fullShot(`shot-${day}`, `2026-08-${day}T06:00:00.000Z`));
        }
        const stats = await mirror.stats();
        assert.equal(stats.full, 2, 'nothing evicted — the store grows forever again');
        assert.equal((await mirror.full('shot-11')).status, MIRROR_RESULT.MISS);
        assert.equal((await mirror.full('shot-14')).status, MIRROR_RESULT.HIT);
    });

    test('the meta store is capped too', async () => {
        const { mirror } = fixture({ metaCap: 3 });
        await mirror.putMetaList([1, 2, 3, 4, 5].map((n) => metaShot(`m-${n}`, `2026-08-1${n}T06:00:00.000Z`)));
        assert.equal((await mirror.stats()).meta, 3);
        assert.equal((await mirror.meta('m-1')).status, MIRROR_RESULT.MISS);
        assert.equal((await mirror.meta('m-5')).status, MIRROR_RESULT.HIT);
    });
});

describe('defect 4 — a version bump cannot silently wipe', () => {
    test('data written at v1 is still there after opening at v2', async () => {
        const indexedDB = createFakeIndexedDB();
        const first = createShotMirror({ indexedDB, version: 1, logger: recordingLogger() });
        await first.putFull(fullShot('a-1', '2026-08-17T08:00:00.000Z'));
        await first.putMetaList([metaShot('a-2', '2026-08-16T08:00:00.000Z')]);
        first.close();

        const second = createShotMirror({ indexedDB, version: 2, logger: recordingLogger() });
        const latest = await second.latestFull();
        assert.equal(latest.status, MIRROR_RESULT.HIT, 'the upgrade wiped the store');
        assert.equal(latest.record.measurements.length, 3);
        assert.equal((await second.meta('a-2')).status, MIRROR_RESULT.HIT);
        second.close();
    });

    test('the shipped version is the one the module declares', () => {
        const { mirror } = fixture();
        assert.equal(mirror.version, MIRROR_VERSION);
        assert.equal(mirror.databaseName, IDB_DATABASE_NAME, 'the database name derives from the skin id (A10)');
    });
});

describe('defect 5 — a version bump cannot silently hang', () => {
    test('a blocked upgrade fails with a typed reason inside the grace period', async () => {
        const indexedDB = createFakeIndexedDB();
        // A connection that does NOT step aside — another tab running an older build, which
        // is the case the real `onblocked` exists for. Our own connections close on
        // `onversionchange` (the test below), so the block has to come from outside.
        const holder = await new Promise((resolve) => {
            const request = indexedDB.open(IDB_DATABASE_NAME, 1);
            request.onsuccess = () => resolve(request.result);
        });
        assert.ok(holder);

        const blocked = createShotMirror({
            indexedDB, version: 2, logger: recordingLogger(), blockedGraceMs: 20, openTimeoutMs: 500,
        });
        const opened = await blocked.open();
        assert.equal(opened.ok, false);
        assert.equal(opened.reason, MIRROR_ERROR.BLOCKED, 'the old module waited here forever');

        // ...and the read that follows says UNAVAILABLE, not "no cached shot".
        const read = await blocked.latestFull();
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.BLOCKED);
        holder.close();
    });

    test('a blocking connection that closes in time lets the upgrade through', async () => {
        const indexedDB = createFakeIndexedDB();
        const seed = createShotMirror({ indexedDB, version: 1, logger: recordingLogger() });
        await seed.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]);
        seed.close();

        const holder = await new Promise((resolve) => {
            const request = indexedDB.open(IDB_DATABASE_NAME, 1);
            request.onsuccess = () => resolve(request.result);
        });

        const upgrading = createShotMirror({
            indexedDB, version: 2, logger: recordingLogger(), blockedGraceMs: 500, openTimeoutMs: 1000,
        });
        const pending = upgrading.open();
        setTimeout(() => holder.close(), 5);
        const opened = await pending;
        assert.equal(opened.ok, true, 'the open must resume once the blocker goes away');
        assert.equal((await upgrading.meta('a-1')).status, MIRROR_RESULT.HIT, 'and the rows survived the bump');
        upgrading.close();
    });

    test('an open that never answers ends at the deadline, not in a hang', async () => {
        const stuck = { open: () => ({ onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null }) };
        const { mirror } = fixture({ indexedDB: stuck, openTimeoutMs: 25 });
        const read = await mirror.latestFull();
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.TIMEOUT);
    });

    test('another connection asking for a newer schema closes ours — it does not open a modal', async () => {
        const indexedDB = createFakeIndexedDB();
        const { mirror } = fixture({ indexedDB, version: 1 });
        await mirror.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]);
        const other = createShotMirror({ indexedDB, version: 2, logger: recordingLogger(), blockedGraceMs: 100 });
        const opened = await other.open();
        assert.equal(opened.ok, true, 'our connection did not step aside for the upgrade');
        other.close();
    });

    // The two below exist to earn the declaration in `test/store.test.mjs`, which permits
    // exactly one `setTimeout` under `src/stores/` — this module's injected default. An
    // exemption nobody tests is a hole with a comment on it, so the seam is exercised: the
    // caller's timer is the one used, and the deadline does not outlive the open.
    test('the deadline is an injected seam — a caller that supplies one is never on the platform clock', async () => {
        const scheduled = [];
        const cleared = [];
        const stuck = { open: () => ({ onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null }) };
        const mirror = createShotMirror({
            indexedDB: stuck,
            logger: recordingLogger(),
            // Far longer than this suite could ever wait: if the module reached for the
            // platform `setTimeout` instead of ours, this test would hang, not pass.
            openTimeoutMs: 3_600_000,
            setTimer: (fn, ms) => { scheduled.push(ms); queueMicrotask(fn); return scheduled.length; },
            clearTimer: (id) => cleared.push(id),
        });

        const read = await mirror.latestFull();
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.TIMEOUT);
        assert.deepEqual(scheduled, [3_600_000], 'one deadline, taken from the injected timer');
        assert.deepEqual(cleared, [1], 'and released when the open settled');
    });

    test('a successful open leaves nothing scheduled', async () => {
        const live = new Map();
        const mirror = createShotMirror({
            indexedDB: createFakeIndexedDB(),
            logger: recordingLogger(),
            // A timer that never fires: the open must settle on its own and clear it.
            setTimer: (fn, ms) => { live.set(live.size + 1, ms); return live.size; },
            clearTimer: (id) => live.delete(id),
        });

        const opened = await mirror.open();
        assert.equal(opened.ok, true);
        assert.deepEqual([...live.keys()], [], 'the deadline is cleared the moment the open settles');
        mirror.close();
    });
});

describe('a broken mirror says unavailable — it never masquerades as an empty cache', () => {
    test('an injected read failure is UNAVAILABLE with a reason, and is logged', async () => {
        const { mirror, indexedDB, logger } = fixture();
        await mirror.putFull(fullShot('a-1', '2026-08-17T08:00:00.000Z'));
        indexedDB.failNext('get', FULL_STORE);
        const read = await mirror.full('a-1');
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.FAILED);
        assert.ok(logger.lines.some(([level]) => level === 'warn'));
    });

    test('a failed write reports the failure rather than resolving true', async () => {
        const { mirror, indexedDB } = fixture();
        indexedDB.failNext('put', FULL_STORE);
        const result = await mirror.putFull(fullShot('a-1', '2026-08-17T08:00:00.000Z'));
        assert.equal(result.ok, false);
        assert.equal(result.reason, MIRROR_ERROR.FAILED);
    });

    test('no IndexedDB at all is UNSUPPORTED, not a miss', async () => {
        const mirror = createShotMirror({ indexedDB: null, logger: recordingLogger() });
        const read = await mirror.latestFull();
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.UNSUPPORTED);
    });

    test('after close, the mirror reports unsupported rather than silently reopening', async () => {
        const { mirror } = fixture();
        await mirror.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]);
        mirror.close();
        const read = await mirror.latestMeta();
        assert.equal(read.status, MIRROR_RESULT.UNAVAILABLE);
        assert.equal(read.reason, MIRROR_ERROR.UNSUPPORTED);
    });
});

describe('housekeeping', () => {
    test('the database is opened once, however many calls arrive', async () => {
        const { mirror, indexedDB } = fixture();
        await Promise.all([
            mirror.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]),
            mirror.latestFull(),
            mirror.stats(),
        ]);
        await mirror.latestMeta();
        assert.equal(indexedDB.openCount, 1);
    });

    test('forget removes a shot from both stores in one transaction', async () => {
        const { mirror } = fixture();
        await mirror.putFull(fullShot('a-1', '2026-08-17T08:00:00.000Z'));
        await mirror.putMetaList([metaShot('a-1', '2026-08-17T08:00:00.000Z')]);
        assert.equal((await mirror.forget('a-1')).ok, true);
        assert.equal((await mirror.full('a-1')).status, MIRROR_RESULT.MISS);
        assert.equal((await mirror.meta('a-1')).status, MIRROR_RESULT.MISS);
    });

    test('clear empties both stores but keeps the schema', async () => {
        const { mirror, indexedDB } = fixture();
        await mirror.putFull(fullShot('a-1', '2026-08-17T08:00:00.000Z'));
        assert.equal((await mirror.clear()).ok, true);
        assert.deepEqual(await mirror.stats(), { ok: true, meta: 0, full: 0, fullCap: 5, metaCap: 200 });
        assert.deepEqual(indexedDB.storeNames(IDB_DATABASE_NAME), [META_STORE, FULL_STORE].sort());
    });
});

/* ────────────────────────────────────────────────────────────────────────────────────
 * DEFECT 5's LAST CORNER: the one failure that was PERMANENT.
 *
 * Timeout, blocked and onerror all clear `opening` and retry. A synchronous throw from
 * `indexedDB.open` did not: `finish` ran while `opening = new Promise(...)` was still being
 * evaluated, so its `opening = null` cleared the PREVIOUS value and the assignment then
 * cached the failed promise for the life of the process. `open()` never asked again — and
 * the asymmetry with every other path is what made it invisible.
 */
describe('defect 5 — a synchronous open failure is not cached for ever', () => {
    test('a throwing indexedDB.open is retried, not remembered', async () => {
        let opens = 0;
        const throwsOnce = {
            open: (...args) => {
                opens += 1;
                if (opens === 1) throw new DOMException('SecurityError', 'SecurityError');
                return createFakeIndexedDB().open(...args);
            },
        };
        const { mirror } = fixture({ indexedDB: throwsOnce });

        const first = await mirror.open();
        assert.equal(first.ok, false);
        assert.equal(first.reason, MIRROR_ERROR.FAILED);

        const second = await mirror.open();
        assert.equal(opens, 2, 'the second call must reach indexedDB.open again');
        assert.equal(second.ok, true, 'a transient failure is not a permanent verdict');
    });

    test('a permanently throwing open reports every time, and never wedges silently', async () => {
        let opens = 0;
        const alwaysThrows = { open: () => { opens += 1; throw new Error('quota'); } };
        const { mirror, logger } = fixture({ indexedDB: alwaysThrows });
        for (let i = 0; i < 3; i += 1) {
            const result = await mirror.open();
            assert.equal(result.ok, false);
            assert.equal(result.reason, MIRROR_ERROR.FAILED);
        }
        assert.equal(opens, 3, 'each attempt really tried');
        assert.ok(logger.lines.some((l) => /indexedDB\.open threw/.test(l.join(' '))), 'and each one is logged');
    });
});
