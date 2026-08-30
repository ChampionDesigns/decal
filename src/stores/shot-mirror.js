// The IDB latest-shot mirror, rebuilt — meta and full records can no longer poison
// each other.
//
// PROVISIONAL BY DECISION. This module ships ONLY if its payoff measures out on the bench:
// M11 in SCOPE's open-questions table, and Ben's standing rule in DECISIONS.md — "keep
// caching only where it measurably pays… so measure it, do not assume it". The claim to
// time is narrow and stated so it can be falsified: `GET /api/v1/shots/<id>` is NOT
// ETag-conditional (of the shots reads only the paginated list is —
// `shots_handler.dart` `_getShots` uses `jsonOkConditional`, every other shots route uses
// plain `jsonOk`), so the ~221 KB latest record re-downloads on every boot, and
// `latestFull()` through the by-time index paints the chart before the network answers. If
// the bench says the paint is not visibly earlier, this file is DELETED rather than kept
// "just in case" — a cache with no measured payoff is exactly what the rewrite is shedding.
//
// FIVE DEFECTS OF THE MODULE IT REPLACES (`idb.js`, 352 lines), each rebuilt against:
//
//  1. POISONING. `addShots()` blind-`put`s the paginated list's records into the SAME store
//     as full ones. Those records are `toJsonWithoutMeasurements()` — no `measurements` key
//     at all — so every list load STRIPPED the cache for the 20 newest shots, and the
//     post-shot refresh re-ran the stripping loop up to six times. The instant paint the
//     mirror exists for was the first thing the mirror broke. Here meta and full live in
//     TWO OBJECT STORES: a list load physically cannot reach the full one, and `putFull`
//     REFUSES a record with no measurements rather than silently degrading it.
//
//  2. A "LATEST TIMESTAMP" THAT WALKED THE PRIMARY KEY. The primary key is a UUID, so
//     `openCursor(null, 'prev')` on the store returned the lexicographically largest UUID's
//     timestamp — a number that is correct only by accident. Here every row carries `ts`, a
//     NUMBER (epoch ms parsed from the server's ISO stamp at write time), and the index is
//     on that. A record whose stamp does not parse is REFUSED, because an unindexed row is
//     invisible to the only read that matters.
//
//  3. A FULL-STORE DESERIALIZE ON EVERY BOOT. `getAllShots()` read and deserialized every
//     shot ever mirrored, with nothing evicting. There is no unbounded read in this file:
//     `recentMeta(limit)` requires a limit and walks a bounded cursor, and both stores are
//     capped, oldest-first, on write.
//
//  4. A VERSION BUMP THAT SILENTLY WIPED. The upgrade path dropped and recreated a store on
//     every bump. The migration here is ADDITIVE ONLY — it creates what is missing and
//     deletes nothing — and a test opens at v1, writes, reopens at v2 and asserts the rows
//     are still there.
//
//  5. A VERSION BUMP THAT SILENTLY HUNG. `onblocked` logged a warning and the open promise
//     never settled, so boot stopped with no console error; and `onversionchange` called
//     `alert()`. Here `blocked` is a bounded wait that ends in a typed failure, the open has
//     a deadline, and another connection's upgrade is answered by CLOSING, never by a modal.
//
// A7 runs through the read API: a read answers `hit`, `miss` or `unavailable`, and those are
// three different things. "The database is broken" must never arrive at a caller wearing
// "there is no cached shot", because that is how a dead cache becomes invisible.
//
// NOT REBUILT: the profiles-to-IDB cache. Its only read sits inside an API catch block that
// cannot fire — ReaPrime serves the skin and the API from one origin, so if the API is down
// nothing served the skin. The settings and email stores do not come across either: settings
// are the storage router's business (B7), and no Decal feature reads emails.
//
// DOM-free: `indexedDB` is injected, so the whole module runs under node:test against the
// fake in `test/fixtures/fake-indexeddb.js`.

import { IDB_DATABASE_NAME } from '../lib/storage-routes.js';

/** Schema version. Bumping it must only ever ADD — see defect 4 above. */
export const MIRROR_VERSION = 1;

/** Meta records: `ShotRecord.toJsonWithoutMeasurements()`. Cheap, many. */
export const META_STORE = 'shot_meta';

/** Full records: `ShotRecord.toJson()`, measurements included. Expensive, few. */
export const FULL_STORE = 'shot_full';

/** The by-time index on both stores. Keyed on a NUMBER, never on the UUID primary key. */
export const TIME_INDEX = 'by_time';

/** How many full records to keep. The payoff is the newest one; a few cover a back-step. */
export const DEFAULT_FULL_CAP = 5;

/** How many meta records to keep — one list page, several times over. */
export const DEFAULT_META_CAP = 200;

/** Read outcomes. `miss` and `unavailable` are different answers and never merge. */
export const MIRROR_RESULT = Object.freeze({
    HIT: 'hit',
    MISS: 'miss',
    UNAVAILABLE: 'unavailable',
});

/** Why the mirror could not answer. Closed set, so a caller can branch. */
export const MIRROR_ERROR = Object.freeze({
    /** No IndexedDB was injected, or the environment has none. */
    UNSUPPORTED: 'unsupported',
    /** Another connection holds an older version open past the grace period. */
    BLOCKED: 'blocked',
    /** The open did not settle within its deadline. */
    TIMEOUT: 'timeout',
    /** The stored version is NEWER than ours — a downgrade, which we refuse. */
    VERSION: 'version',
    /** IndexedDB reported an error. `cause` carries it. */
    FAILED: 'failed',
    /** The caller handed us something the mirror will not store. */
    REJECTED: 'rejected',
});

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/* ------------------------------------------------------------------ pure helpers */

/**
 * Is this the FULL record?
 *
 * Key presence, the address layer's rule, applied to the one distinction that matters here:
 * `toJson()` writes `measurements`, `toJsonWithoutMeasurements()` omits the key entirely.
 * An empty array is still a full record — a shot with no samples is a fact, not an absence.
 */
export function isFullShot(record) {
    return !!record && typeof record === 'object'
        && Object.hasOwn(record, 'measurements') && Array.isArray(record.measurements);
}

/**
 * The server's ISO stamp -> epoch milliseconds, or null when it does not parse.
 *
 * `ShotRecord.toJson` writes `timestamp.toIso8601String()`. Null is returned rather than a
 * substituted "now": a row indexed at the wrong time would sort ahead of real ones and the
 * mirror would confidently paint the wrong shot.
 */
export function shotTimeMs(record) {
    if (!record || typeof record !== 'object' || typeof record.timestamp !== 'string') return null;
    const ms = Date.parse(record.timestamp);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * The stored row. The server's record is kept VERBATIM under `record` — never merged into
 * the row, never patched — so what comes back out is what came off the wire.
 */
export function toRow(record, savedAt) {
    return { id: record.id, ts: shotTimeMs(record), savedAt, record };
}

/* ------------------------------------------------------------------ the mirror */

/**
 * Build the mirror.
 *
 * @param {object} options
 * @param {IDBFactory} options.indexedDB   injected; the module never reaches for a global
 * @param {string} [options.databaseName=IDB_DATABASE_NAME]  A10: derived from the skin id
 * @param {number} [options.version=MIRROR_VERSION]
 * @param {object} [options.logger]
 * @param {number} [options.openTimeoutMs=5000]   the deadline that replaces the silent hang
 * @param {number} [options.blockedGraceMs=2000]  how long a blocking connection gets to close
 * @param {number} [options.fullCap=DEFAULT_FULL_CAP]
 * @param {number} [options.metaCap=DEFAULT_META_CAP]
 * @param {Function} [options.now]
 * @param {Function} [options.setTimer]    injected one-shot timer; see below
 * @param {Function} [options.clearTimer]
 *
 * THE ONE TIME-SHAPED THING IN THIS LAYER, and it is injected for the same reason the rest
 * of the store layer injects its clock. It is not a ticker: two one-shot DEADLINES, both
 * cleared the moment the open settles, and they exist because the module they replace could
 * wait forever on `onblocked` with nothing in the console. A cache that hangs boot is worse
 * than a cache that says it is unavailable.
 */
export function createShotMirror({
    indexedDB,
    databaseName = IDB_DATABASE_NAME,
    version = MIRROR_VERSION,
    logger = NOOP_LOGGER,
    openTimeoutMs = 5000,
    blockedGraceMs = 2000,
    fullCap = DEFAULT_FULL_CAP,
    metaCap = DEFAULT_META_CAP,
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
} = {}) {
    const log = logger.scope ? logger.scope('mirror') : logger;
    let connection = null;
    let opening = null;
    let closed = false;

    /** The one place a failure is shaped. Always logged: a silent cache miss teaches nothing. */
    function unavailable(reason, cause = null) {
        if (cause) log.warn(`shot mirror unavailable (${reason})`, cause);
        else log.warn(`shot mirror unavailable (${reason})`);
        return { status: MIRROR_RESULT.UNAVAILABLE, record: null, reason, cause };
    }

    function open() {
        if (connection) return Promise.resolve({ ok: true, db: connection });
        if (opening) return opening;
        if (closed) return Promise.resolve({ ok: false, reason: MIRROR_ERROR.UNSUPPORTED });
        if (!indexedDB || typeof indexedDB.open !== 'function') {
            return Promise.resolve({ ok: false, reason: MIRROR_ERROR.UNSUPPORTED });
        }

        // THE SYNCHRONOUS THROW IS HANDLED OUTSIDE THE PROMISE, and that placement is the
        // whole fix. It used to sit inside the executor, where `finish` runs BEFORE
        // `opening = new Promise(...)` has completed: its `opening = null` cleared the
        // previous value and the assignment then cached the FAILED promise for the life of
        // the process, so `open()` never retried. Every other failure path — timeout,
        // blocked, onerror — clears `opening` after the assignment and does retry, which is
        // exactly the asymmetry that makes this one hard to see. A synchronous throw needs
        // no deadline: it cannot hang.
        let request;
        try {
            request = indexedDB.open(databaseName, version);
        } catch (error) {
            log.warn('indexedDB.open threw', error);
            return Promise.resolve({ ok: false, reason: MIRROR_ERROR.FAILED, cause: error });
        }

        opening = new Promise((resolve) => {
            let settled = false;
            let blockedTimer = null;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (blockedTimer) clearTimer(blockedTimer);
                clearTimer(deadline);
                opening = null;
                resolve(value);
            };

            // The deadline that defect 5 did not have. A wedged open fails; it never hangs.
            const deadline = setTimer(() => finish({ ok: false, reason: MIRROR_ERROR.TIMEOUT }), openTimeoutMs);

            request.onblocked = () => {
                // Another connection holds an older version. Give it a bounded moment to
                // close, then FAIL — visibly. Waiting forever is the silent hang.
                log.warn('an older connection is blocking the shot mirror upgrade');
                if (blockedTimer) return;
                blockedTimer = setTimer(
                    () => finish({ ok: false, reason: MIRROR_ERROR.BLOCKED }),
                    blockedGraceMs,
                );
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // ADDITIVE ONLY. Nothing here deletes an object store, an index or a record.
                for (const name of [META_STORE, FULL_STORE]) {
                    const store = db.objectStoreNames.contains(name)
                        ? event.target.transaction.objectStore(name)
                        : db.createObjectStore(name, { keyPath: 'id' });
                    if (!store.indexNames.contains(TIME_INDEX)) store.createIndex(TIME_INDEX, 'ts');
                }
                log.info(`shot mirror schema at v${version} (from v${event.oldVersion ?? 0})`);
            };

            request.onerror = () => {
                const error = request.error;
                // A stored version NEWER than ours is a downgrade: IndexedDB answers it with
                // a VersionError, and it is a different fact from "the database broke".
                const isVersionError = !!error && /version/i.test(String(error.name || error.message || ''));
                finish({
                    ok: false,
                    reason: isVersionError ? MIRROR_ERROR.VERSION : MIRROR_ERROR.FAILED,
                    cause: error,
                });
            };

            request.onsuccess = () => {
                const db = request.result;
                // Another tab wants a newer schema: close, so we do not become the blocker.
                // The old module opened a modal here, from a storage module.
                db.onversionchange = () => {
                    log.info('another connection needs a newer shot-mirror schema — closing');
                    connection = null;
                    try {
                        db.close();
                    } catch (error) {
                        log.warn('closing the shot mirror threw', error);
                    }
                };
                connection = db;
                finish({ ok: true, db });
            };
        });

        return opening;
    }

    /** Run `body` inside one transaction, resolving on COMMIT rather than on last request. */
    function transact(storeNames, mode, body) {
        return open().then((opened) => {
            if (!opened.ok) return { ok: false, reason: opened.reason, cause: opened.cause || null };
            return new Promise((resolve) => {
                let out;
                let tx;
                try {
                    tx = opened.db.transaction(storeNames, mode);
                } catch (error) {
                    return resolve({ ok: false, reason: MIRROR_ERROR.FAILED, cause: error });
                }
                tx.oncomplete = () => resolve({ ok: true, value: out });
                tx.onerror = () => resolve({ ok: false, reason: MIRROR_ERROR.FAILED, cause: tx.error });
                tx.onabort = () => resolve({ ok: false, reason: MIRROR_ERROR.FAILED, cause: tx.error });
                try {
                    body(tx, (value) => { out = value; });
                } catch (error) {
                    resolve({ ok: false, reason: MIRROR_ERROR.FAILED, cause: error });
                }
            });
        });
    }

    /** The newest row in `storeName`, read through the time index. One cursor step. */
    function newest(storeName) {
        return transact([storeName], 'readonly', (tx, emit) => {
            const cursorRequest = tx.objectStore(storeName).index(TIME_INDEX).openCursor(null, 'prev');
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                emit(cursor ? cursor.value : null);
            };
        });
    }

    /**
     * Trim `storeName` to `cap`, oldest first. Runs inside the caller's write transaction,
     * so a write and its eviction commit together or not at all.
     */
    function evict(tx, storeName, cap) {
        const store = tx.objectStore(storeName);
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            let over = countRequest.result - cap;
            if (over <= 0) return;
            const cursorRequest = store.index(TIME_INDEX).openCursor(null, 'next');
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor || over <= 0) return;
                cursor.delete();
                over -= 1;
                cursor.continue();
            };
        };
    }

    function readOne(storeName, id) {
        return transact([storeName], 'readonly', (tx, emit) => {
            const request = tx.objectStore(storeName).get(id);
            request.onsuccess = () => emit(request.result || null);
        });
    }

    function asResult(outcome) {
        if (!outcome.ok) return unavailable(outcome.reason, outcome.cause);
        const row = outcome.value;
        if (!row) return { status: MIRROR_RESULT.MISS, record: null, reason: null };
        return { status: MIRROR_RESULT.HIT, record: row.record, savedAt: row.savedAt, ts: row.ts };
    }

    function put(storeName, records, cap) {
        const rows = [];
        const savedAt = now();
        for (const record of records) {
            if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) {
                return Promise.resolve({ ok: false, reason: MIRROR_ERROR.REJECTED, why: 'a record has no id' });
            }
            const row = toRow(record, savedAt);
            if (row.ts === null) {
                // Defect 2: an unindexed row is invisible to the only read that matters, so
                // it is refused loudly rather than stored where nothing will find it.
                log.error(`shot ${record.id} has no parseable timestamp — not mirrored`);
                return Promise.resolve({ ok: false, reason: MIRROR_ERROR.REJECTED, why: 'timestamp does not parse' });
            }
            rows.push(row);
        }
        if (rows.length === 0) return Promise.resolve({ ok: true, written: 0 });

        return transact([storeName], 'readwrite', (tx) => {
            const store = tx.objectStore(storeName);
            for (const row of rows) store.put(row);
            evict(tx, storeName, cap);
        }).then((outcome) => (outcome.ok
            ? { ok: true, written: rows.length }
            : { ok: false, reason: outcome.reason, cause: outcome.cause || null }));
    }

    return {
        databaseName,
        version,

        /** Open (idempotent). Callers do not have to — every method opens on demand. */
        open,

        /**
         * The newest FULL record — the one read the mirror exists for. `hit` carries the
         * server's record verbatim; `miss` means nothing is cached; `unavailable` means the
         * mirror could not answer and the caller must go to the network as if empty (but
         * knowing the difference, and able to log it).
         */
        async latestFull() {
            return asResult(await newest(FULL_STORE));
        },

        /** The newest META record. Same three outcomes. */
        async latestMeta() {
            return asResult(await newest(META_STORE));
        },

        /** One full record by id. */
        async full(id) {
            return asResult(await readOne(FULL_STORE, id));
        },

        /** One meta record by id. */
        async meta(id) {
            return asResult(await readOne(META_STORE, id));
        },

        /**
         * The newest `limit` meta records, newest first.
         *
         * `limit` is REQUIRED and bounded — there is deliberately no "read everything" call
         * on this object, because that call is defect 3.
         */
        async recentMeta(limit) {
            if (!Number.isInteger(limit) || limit <= 0 || limit > DEFAULT_META_CAP) {
                throw new RangeError(`recentMeta: limit must be an integer in 1..${DEFAULT_META_CAP} — the mirror has no unbounded read`);
            }
            const outcome = await transact([META_STORE], 'readonly', (tx, emit) => {
                const rows = [];
                const cursorRequest = tx.objectStore(META_STORE).index(TIME_INDEX).openCursor(null, 'prev');
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (!cursor || rows.length >= limit) return emit(rows);
                    rows.push(cursor.value);
                    emit(rows);
                    cursor.continue();
                };
            });
            if (!outcome.ok) return { status: MIRROR_RESULT.UNAVAILABLE, records: [], reason: outcome.reason };
            const rows = outcome.value || [];
            return {
                status: rows.length ? MIRROR_RESULT.HIT : MIRROR_RESULT.MISS,
                records: rows.slice(0, limit).map((row) => row.record),
            };
        },

        /**
         * Mirror ONE full record. A meta-only record is refused: that silent degradation is
         * defect 1, and the whole point of two stores is that it cannot happen by accident.
         */
        putFull(record) {
            if (!isFullShot(record)) {
                log.error('putFull was handed a record with no measurements — that is the meta store\'s job');
                return Promise.resolve({ ok: false, reason: MIRROR_ERROR.REJECTED, why: 'not a full record' });
            }
            return put(FULL_STORE, [record], fullCap);
        },

        /** Mirror meta records — a list page, in ONE transaction. Never touches the full store. */
        putMetaList(records) {
            const list = Array.isArray(records) ? records : [records];
            return put(META_STORE, list, metaCap);
        },

        /** Forget one shot, in both stores, in one transaction. For a server-side delete. */
        forget(id) {
            return transact([META_STORE, FULL_STORE], 'readwrite', (tx) => {
                tx.objectStore(META_STORE).delete(id);
                tx.objectStore(FULL_STORE).delete(id);
            }).then((outcome) => (outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason }));
        },

        /** Empty both stores, keeping the schema. */
        clear() {
            return transact([META_STORE, FULL_STORE], 'readwrite', (tx) => {
                tx.objectStore(META_STORE).clear();
                tx.objectStore(FULL_STORE).clear();
            }).then((outcome) => (outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason }));
        },

        /**
         * Counts and the newest stamp — the numbers the M11 bench measurement is taken
         * against, so the decision to keep or delete this module has evidence.
         */
        async stats() {
            const outcome = await transact([META_STORE, FULL_STORE], 'readonly', (tx, emit) => {
                const counts = { meta: null, full: null };
                const metaCount = tx.objectStore(META_STORE).count();
                metaCount.onsuccess = () => { counts.meta = metaCount.result; emit(counts); };
                const fullCount = tx.objectStore(FULL_STORE).count();
                fullCount.onsuccess = () => { counts.full = fullCount.result; emit(counts); };
            });
            if (!outcome.ok) return { ok: false, reason: outcome.reason };
            return { ok: true, meta: outcome.value.meta, full: outcome.value.full, fullCap, metaCap };
        },

        /** Close the connection. Further calls report `unsupported` rather than reopening. */
        close() {
            closed = true;
            if (connection) {
                try {
                    connection.close();
                } catch (error) {
                    log.warn('closing the shot mirror threw', error);
                }
                connection = null;
            }
        },
    };
}
