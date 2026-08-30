

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

export function isFullShot(record) {
    return !!record && typeof record === 'object'
        && Object.hasOwn(record, 'measurements') && Array.isArray(record.measurements);
}

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
                const isVersionError = !!error && /version/i.test(String(error.name || error.message || ''));
                finish({
                    ok: false,
                    reason: isVersionError ? MIRROR_ERROR.VERSION : MIRROR_ERROR.FAILED,
                    cause: error,
                });
            };

            request.onsuccess = () => {
                const db = request.result;
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
