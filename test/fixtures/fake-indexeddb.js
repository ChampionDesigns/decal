// A fake IndexedDB — enough of the real one to execute the shot mirror under node:test.
//
// SCOPE Part 6, "Untested today and must not stay that way in this wave's reach": the
// `idb.js` successor needs an executing test with a fake IndexedDB. The old module had none,
// which is how a version bump shipped that dropped a store on every upgrade and how a
// blocked open could hang boot with nothing in the console.
//
// It implements the subset the mirror actually uses, and NOTHING else — an over-complete
// fake is a second implementation to keep true:
//
//   open(name, version) with onupgradeneeded / onsuccess / onerror / onblocked,
//   request.transaction during the upgrade, event.oldVersion;
//   db.objectStoreNames.contains, createObjectStore({keyPath}), transaction(names, mode),
//   close(), onversionchange;
//   store.createIndex(name, keyPath), indexNames.contains, put/get/delete/clear/count,
//   index(name).openCursor(null, 'prev' | 'next') with cursor.value / continue() / delete();
//   transaction oncomplete / onerror / onabort.
//
// Two deliberate behaviours, because the mirror's hardest cases are exactly these:
//
//   BLOCKED — an upgrade with another connection still open fires `onblocked` and then
//   WAITS. It completes only when that connection closes. That is what lets a test prove the
//   mirror's bounded wait ends in a typed failure rather than a silent hang.
//
//   PERSISTENCE ACROSS CONNECTIONS — the data lives in the factory, not in the connection,
//   so closing and reopening at a higher version is a real migration and a test can assert
//   nothing was wiped.
//
// Events are delivered asynchronously via `queueMicrotask`, and a transaction commits when
// its request queue drains — the ordering property real code depends on.

function schedule(fn) {
    queueMicrotask(fn);
}

/** IndexedDB compares numbers before strings; within a type, natural order. */
function compareKeys(a, b) {
    if (a === b) return 0;
    const rank = (v) => (typeof v === 'number' ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a < b ? -1 : 1;
}

class FakeRequest {
    constructor(source, transaction) {
        this.source = source;
        this.transaction = transaction;
        this.result = undefined;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
    }

    _succeed(result) {
        this.result = result;
        if (this.onsuccess) this.onsuccess({ target: this, type: 'success' });
    }

    _fail(error) {
        this.error = error;
        if (this.onerror) this.onerror({ target: this, type: 'error' });
    }
}

class FakeCursor {
    constructor(rows, position, store, request) {
        this._rows = rows;
        this._position = position;
        this._store = store;
        this._request = request;
        this.value = rows[position];
        this.primaryKey = this.value ? this.value[store.keyPath] : undefined;
    }

    continue() {
        const next = this._position + 1;
        this._request.transaction._enqueue(() => {
            if (next >= this._rows.length) return this._request._succeed(null);
            this._request._succeed(new FakeCursor(this._rows, next, this._store, this._request));
        });
    }

    delete() {
        const key = this.value[this._store.keyPath];
        this._request.transaction._enqueue(() => {
            this._store.records.delete(key);
        });
    }
}

class FakeIndex {
    constructor(store, name, keyPath) {
        this.store = store;
        this.name = name;
        this.keyPath = keyPath;
    }

    /** Rows sorted by the index key; records with a null/undefined key are NOT indexed. */
    _sorted(direction) {
        const rows = [...this.store.records.values()].filter(
            (row) => row[this.keyPath] !== null && row[this.keyPath] !== undefined,
        );
        rows.sort((a, b) => compareKeys(a[this.keyPath], b[this.keyPath])
            || compareKeys(a[this.store.keyPath], b[this.store.keyPath]));
        return direction === 'prev' ? rows.reverse() : rows;
    }

    openCursor(_range = null, direction = 'next') {
        const tx = this.store._transaction;
        const request = new FakeRequest(this, tx);
        tx._enqueue(() => {
            const rows = this._sorted(direction);
            if (rows.length === 0) return request._succeed(null);
            request._succeed(new FakeCursor(rows, 0, this.store, request));
        });
        return request;
    }
}

class FakeObjectStore {
    constructor(data, transaction) {
        this._data = data;
        this._transaction = transaction;
        this.name = data.name;
        this.keyPath = data.keyPath;
        this.records = data.records;
        this.indexNames = {
            contains: (name) => data.indexes.has(name),
        };
    }

    createIndex(name, keyPath) {
        this._data.indexes.set(name, { name, keyPath });
        return new FakeIndex(this, name, keyPath);
    }

    index(name) {
        const meta = this._data.indexes.get(name);
        if (!meta) throw new Error(`fake-indexeddb: no index '${name}' on '${this.name}'`);
        return new FakeIndex(this, meta.name, meta.keyPath);
    }

    put(value) {
        const request = new FakeRequest(this, this._transaction);
        this._transaction._enqueue(() => {
            const failure = this._transaction._factory._takeFailure('put', this.name);
            if (failure) {
                request._fail(failure);
                this._transaction._abort(failure);
                return;
            }
            this.records.set(value[this.keyPath], structuredClone(value));
            request._succeed(value[this.keyPath]);
        });
        return request;
    }

    get(key) {
        const request = new FakeRequest(this, this._transaction);
        this._transaction._enqueue(() => {
            const failure = this._transaction._factory._takeFailure('get', this.name);
            if (failure) {
                request._fail(failure);
                this._transaction._abort(failure);
                return;
            }
            request._succeed(this.records.has(key) ? structuredClone(this.records.get(key)) : undefined);
        });
        return request;
    }

    delete(key) {
        const request = new FakeRequest(this, this._transaction);
        this._transaction._enqueue(() => {
            this.records.delete(key);
            request._succeed(undefined);
        });
        return request;
    }

    clear() {
        const request = new FakeRequest(this, this._transaction);
        this._transaction._enqueue(() => {
            this.records.clear();
            request._succeed(undefined);
        });
        return request;
    }

    count() {
        const request = new FakeRequest(this, this._transaction);
        this._transaction._enqueue(() => request._succeed(this.records.size));
        return request;
    }
}

class FakeTransaction {
    constructor(connection, storeNames, mode) {
        this._connection = connection;
        this._factory = connection._factory;
        this._names = storeNames;
        this.mode = mode;
        this.error = null;
        this.oncomplete = null;
        this.onerror = null;
        this.onabort = null;
        this._queue = [];
        this._running = false;
        this._done = false;
        this._drainScheduled = false;
        this._scheduleDrain();
    }

    objectStore(name) {
        if (!this._names.includes(name)) {
            throw new Error(`fake-indexeddb: '${name}' is not in this transaction's scope`);
        }
        const data = this._connection._db.stores.get(name);
        if (!data) throw new Error(`fake-indexeddb: no object store '${name}'`);
        return new FakeObjectStore(data, this);
    }

    _enqueue(task) {
        if (this._done) throw new Error('fake-indexeddb: the transaction has finished');
        this._queue.push(task);
        this._scheduleDrain();
    }

    _scheduleDrain() {
        if (this._drainScheduled || this._done) return;
        this._drainScheduled = true;
        schedule(() => {
            this._drainScheduled = false;
            this._drain();
        });
    }

    /** Run every queued request; commit when the queue drains without new work. */
    _drain() {
        if (this._done) return;
        while (this._queue.length) {
            const task = this._queue.shift();
            try {
                task();
            } catch (error) {
                return this._abort(error);
            }
            if (this._done) return;
        }
        // A request handler may have enqueued more work (a cursor continuing); give it a
        // turn before committing.
        schedule(() => {
            if (this._done) return;
            if (this._queue.length) return this._drain();
            this._done = true;
            if (this.oncomplete) this.oncomplete({ target: this, type: 'complete' });
        });
    }

    _abort(error) {
        if (this._done) return;
        this._done = true;
        this.error = error;
        if (this.onerror) this.onerror({ target: this, type: 'error' });
        if (this.onabort) this.onabort({ target: this, type: 'abort' });
    }

    abort() {
        this._abort(new Error('AbortError'));
    }
}

class FakeDatabase {
    constructor(factory, db) {
        this._factory = factory;
        this._db = db;
        this.name = db.name;
        this.version = db.version;
        this.onversionchange = null;
        this._closed = false;
        this.objectStoreNames = {
            contains: (name) => db.stores.has(name),
        };
    }

    createObjectStore(name, { keyPath }) {
        const data = { name, keyPath, records: new Map(), indexes: new Map() };
        this._db.stores.set(name, data);
        return new FakeObjectStore(data, this._upgradeTransaction);
    }

    transaction(names, mode = 'readonly') {
        if (this._closed) throw new Error('fake-indexeddb: the connection is closed');
        const list = Array.isArray(names) ? names : [names];
        for (const name of list) {
            if (!this._db.stores.has(name)) throw new Error(`fake-indexeddb: no object store '${name}'`);
        }
        return new FakeTransaction(this, list, mode);
    }

    close() {
        if (this._closed) return;
        this._closed = true;
        this._factory._closed(this);
    }
}

class FakeOpenRequest extends FakeRequest {
    constructor() {
        super(null, null);
        this.onupgradeneeded = null;
        this.onblocked = null;
    }
}

/**
 * A fake `indexedDB` factory.
 *
 * @param {object} [options]
 * @param {object} [options.databases]  seed state, `{[name]: {version, stores}}` (rare)
 * @returns {IDBFactory & {failNext(op, store): void, snapshot(name): object, openCount: number}}
 */
export function createFakeIndexedDB() {
    const databases = new Map();
    const connections = new Map(); // name -> Set<FakeDatabase>
    const pending = [];
    const failures = [];
    let openCount = 0;

    const factory = {
        get openCount() {
            return openCount;
        },

        /** Fail the NEXT matching request once — how the tests reach the error paths. */
        failNext(op, storeName, error = new Error('injected IndexedDB failure')) {
            failures.push({ op, storeName, error });
        },

        _takeFailure(op, storeName) {
            const index = failures.findIndex((f) => f.op === op && (!f.storeName || f.storeName === storeName));
            if (index === -1) return null;
            return failures.splice(index, 1)[0].error;
        },

        /** The raw record map of one store — for asserting what a migration preserved. */
        snapshot(name, storeName) {
            const db = databases.get(name);
            if (!db) return null;
            const store = db.stores.get(storeName);
            return store ? Object.fromEntries(store.records) : null;
        },

        /** Which stores exist right now. */
        storeNames(name) {
            const db = databases.get(name);
            return db ? [...db.stores.keys()].sort() : [];
        },

        _closed(connection) {
            const set = connections.get(connection.name);
            if (set) set.delete(connection);
            // A close may unblock a waiting upgrade.
            for (const attempt of [...pending]) {
                if (attempt.name === connection.name) attempt.retry();
            }
        },

        open(name, version = 1) {
            openCount += 1;
            const request = new FakeOpenRequest();

            const attempt = {
                name,
                retry: () => schedule(() => run()),
            };

            function run() {
                if (attempt.settled) return;
                let db = databases.get(name);
                if (!db) {
                    db = { name, version: 0, stores: new Map() };
                    databases.set(name, db);
                }
                if (version < db.version) {
                    attempt.settled = true;
                    const index = pending.indexOf(attempt);
                    if (index !== -1) pending.splice(index, 1);
                    const error = new Error('VersionError');
                    error.name = 'VersionError';
                    return request._fail(error);
                }

                const open = [...(connections.get(name) || [])].filter((c) => !c._closed);
                if (version > db.version && open.length > 0) {
                    for (const connection of open) {
                        if (connection.onversionchange) {
                            connection.onversionchange({ target: connection, oldVersion: db.version, newVersion: version });
                        }
                    }
                    const stillOpen = [...(connections.get(name) || [])].filter((c) => !c._closed);
                    if (stillOpen.length > 0) {
                        if (!attempt.blocked) {
                            attempt.blocked = true;
                            if (!pending.includes(attempt)) pending.push(attempt);
                            if (request.onblocked) request.onblocked({ target: request, type: 'blocked' });
                        }
                        return; // WAIT — this is the hang the mirror must survive.
                    }
                }

                attempt.settled = true;
                const index = pending.indexOf(attempt);
                if (index !== -1) pending.splice(index, 1);

                const oldVersion = db.version;
                const connection = new FakeDatabase(factory, db);
                if (!connections.has(name)) connections.set(name, new Set());
                connections.get(name).add(connection);

                if (version > oldVersion) {
                    db.version = version;
                    connection.version = version;
                    const upgrade = new FakeTransaction(connection, [], 'versionchange');
                    // The upgrade transaction may touch any store, including ones it creates.
                    upgrade._names = { includes: () => true };
                    connection._upgradeTransaction = upgrade;
                    request.transaction = upgrade;
                    request.result = connection;
                    if (request.onupgradeneeded) {
                        request.onupgradeneeded({ target: request, oldVersion, newVersion: version });
                    }
                    upgrade.oncomplete = () => {
                        request.result = connection;
                        request._succeed(connection);
                    };
                    return;
                }

                connection.version = db.version;
                request.result = connection;
                schedule(() => request._succeed(connection));
            }

            schedule(run);
            return request;
        },
    };

    return factory;
}
