import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NumericInputHistory } from '../src/lib/numeric-input-history.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { LAYERS } from '../src/lib/storage-routes.js';

function memoryStorage() {
    const data = new Map();
    const writes = [];
    return {
        data, writes,
        async get(key, { params, fallback }) { return data.get(params.field) ?? fallback; },
        async set(key, value, { params }) { writes.push({ key, field: params.field, value }); data.set(params.field, value); return true; },
    };
}

test('equivalent targets share four recent entries without sharing other input purposes or units', () => {
    const history = new NumericInputHistory();
    for (const value of [3, 4, 5, 6, 7, 5]) history.remember('target', 'bar', value);
    history.remember('target', 'mL/s', 2);
    history.remember('temperature', '°C', 93);
    history.remember('limit', 'bar', 9);
    assert.deepEqual(history.values('target', 'bar'), [5, 7, 6, 4]);
    assert.deepEqual(history.values('target', 'mL/s'), [2]);
    assert.deepEqual(history.values('temperature', '°C'), [93]);
    assert.deepEqual(history.values('limit', 'bar'), [9]);
    for (const invalid of [null, undefined, '', ' ', true, NaN, Infinity, {}, []]) {
        assert.equal(history.remember('target', 'bar', invalid), false);
    }
    assert.equal(history.remember('', 'bar', 5), false);
    assert.equal(history.remember('value', 'bar', 5), false);
});

test('temperature recents convert between units and deduplicate the same physical value', () => {
    const history = new NumericInputHistory();
    history.remember('temperature', '°C', 90);
    history.remember('temperature', '°F', 194);
    history.remember('temperature', '°F', 199.4);
    assert.deepEqual(history.values('temperature', '°C'), [93, 90]);
    assert.deepEqual(history.values('temperature', '°F'), [199.4, 194]);
    assert.deepEqual(history.values('target', 'bar'), []);
});

test('confirmed entries survive a new history instance through the existing numpad storage route', async () => {
    const storage = memoryStorage();
    const first = new NumericInputHistory();
    first.attach(storage);
    first.remember('target', 'bar', 5);
    first.remember('target', 'bar', 7);
    await first.flush();
    assert(storage.writes.every(write => write.key === 'numpadRecents'));
    const second = new NumericInputHistory();
    second.attach(storage);
    await second.load('target', 'bar');
    assert.deepEqual(second.values('target', 'bar'), [7, 5]);
});

test('entries made during a delayed read remain ahead of restored values', async () => {
    let resolveRead;
    const storage = memoryStorage();
    storage.get = () => new Promise(resolve => { resolveRead = resolve; });
    const history = new NumericInputHistory();
    history.attach(storage);
    const loaded = history.load('target', 'bar');
    await Promise.resolve();
    history.remember('target', 'bar', 5);
    history.remember('target', 'bar', 7);
    resolveRead([9, 8, 6, 4]);
    await loaded;
    await history.flush();
    assert.deepEqual(history.values('target', 'bar'), [7, 5, 9, 8]);
    assert.deepEqual(storage.writes.at(-1).value, [7, 5, 9, 8]);
});

test('a failed read does not replace stored history with an incomplete list', async () => {
    const storage = memoryStorage();
    let notifyFailure;
    storage.onReadFailure = listener => { notifyFailure = listener; return () => {}; };
    storage.get = async (key, { params }) => { notifyFailure({ key, params }); return []; };
    const history = new NumericInputHistory();
    history.attach(storage);
    history.remember('target', 'bar', 5);
    await history.flush();
    assert.equal(storage.writes.length, 0);
    assert.deepEqual(history.values('target', 'bar'), [5]);
    storage.get = async () => [9, 8];
    await history.load('target', 'bar');
    await history.flush();
    assert.deepEqual(history.values('target', 'bar'), [5, 9, 8]);
    assert.equal(storage.writes.length, 1);
    assert.deepEqual(storage.writes[0].value, [5, 9, 8]);
});

test('a detached history ignores late reads and queued writes', async () => {
    let resolveRead;
    const storage = memoryStorage();
    storage.get = () => new Promise(resolve => { resolveRead = resolve; });
    const history = new NumericInputHistory();
    const detach = history.attach(storage);
    const loaded = history.load('target', 'bar');
    await Promise.resolve();
    history.remember('target', 'bar', 5);
    detach();
    const next = memoryStorage();
    history.attach(next);
    history.remember('target', 'bar', 3);
    resolveRead([9]);
    await loaded;
    await history.flush();
    assert.deepEqual(history.values('target', 'bar'), [3]);
    assert.equal(storage.writes.length, 0);
    assert.deepEqual(next.writes.at(-1).value, [3]);
});

test('a failed field read does not discard another field whose read succeeded', async () => {
    const pending = new Map();
    const router = createStorageRouter({ backends: {
        [LAYERS.kvNumpad]: {
            get: key => new Promise((resolve, reject) => pending.set(key, { resolve, reject })),
            set() {}, remove() {},
        },
    } });
    const history = new NumericInputHistory();
    history.attach(router);
    const pressure = history.load('target', 'bar');
    const temperature = history.load('temperature', '°C');
    await Promise.resolve();
    [...pending.entries()].find(([key]) => key.includes('temperature'))[1].reject(new Error('Read failed'));
    [...pending.entries()].find(([key]) => key.includes('target'))[1].resolve([9, 8, 7]);
    assert.deepEqual(await Promise.all([pressure, temperature]), [true, false]);
    assert.deepEqual(history.values('target', 'bar'), [9, 8, 7]);
    assert.deepEqual(history.values('temperature', '°C'), []);
});
