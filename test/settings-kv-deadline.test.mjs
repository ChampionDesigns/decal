/**
 * A KV preference write has a deadline, and a late answer never lands over a newer one.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppBoot } from '../src/lib/app-boot.js';
import { OPERATION, WRITE_REFUSAL } from '../src/stores/settings-store.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

const KEY = 'waterTankUnit';

const body = (value) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(value),
    json: async () => value,
});

function serverBoot({ timeoutMs } = {}) {
    const stored = new Map();
    const requests = [];
    let held = null;
    let hang = false;

    const fetchImpl = async (url, options = {}) => {
        const method = options.method ?? 'GET';
        const path = String(url).replace(/^https?:\/\/[^/]+/, '');
        const record = { method, path, signal: options.signal ?? null, aborted: false };
        requests.push(record);
        if (!path.includes('/store/')) return { ...body(null), ok: false, status: 503 };
        const key = decodeURIComponent(path.split('/').pop());

        const serve = () => {
            if (method === 'GET') return body(stored.has(key) ? stored.get(key) : null);
            if (method === 'POST') { stored.set(key, JSON.parse(options.body)); return body({}); }
            if (method === 'DELETE') { stored.delete(key); return body({}); }
            return { ...body(null), ok: false, status: 405 };
        };

        if (!hang) return serve();
        return new Promise((resolve, reject) => {
            held = () => resolve(serve());
            options.signal?.addEventListener('abort', () => {
                record.aborted = true;
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });
    };

    const createSocket = () => ({
        addEventListener() {}, removeEventListener() {}, close() {}, send() {},
    });

    const boot = createAppBoot({
        fetch: fetchImpl, createSocket, location: LOCATION, ...(timeoutMs ? { timeoutMs } : null),
    });
    return {
        boot,
        stored,
        requests,
        hang(on = true) { hang = Boolean(on); },
        release() { const go = held; held = null; go?.(); },
        kvRequests: () => requests.filter((r) => r.path.includes('/store/')),
    };
}

function watchOperations(settings) {
    const seen = [];
    const stop = settings.onOperation((operation) => seen.push(operation));
    return { seen, stop };
}

describe('a KV preference write has a deadline and says what it is doing', () => {
    test('a blackholed write ends, aborts its request, and keeps the confirmed value', async () => {
        const rig = serverBoot({ timeoutMs: 40 });
        const settings = rig.boot.settings;
        rig.stored.set(KEY, 'mm');
        await settings.load(KEY);
        assert.equal(settings.value(KEY), 'mm');

        const operations = watchOperations(settings);
        const failures = [];
        settings.onWriteFailure((failure) => failures.push(failure));

        rig.hang(true);
        const result = await settings.set(KEY, 'mL');

        assert.equal(result.ok, false, 'a write that never landed is not a success');
        assert.equal(result.reason, WRITE_REFUSAL.BACKEND_FAILED);
        assert.equal(settings.value(KEY), 'mm',
            'the confirmed value is what is stored, not what was hoped for');
        assert.equal(rig.stored.get(KEY), 'mm', 'and the server never took it');

        const write = rig.kvRequests().find((r) => r.method === 'POST');
        assert.ok(write, 'the write did reach the wire');
        assert.equal(write.aborted, true,
            'a deadline that abandons a request rather than cancelling it leaves it running on the server');

        assert.deepEqual(operations.seen.map((op) => op.status),
            [OPERATION.PENDING, OPERATION.FAILED],
            'pending while it was out, failed when it did not land');
        assert.equal(operations.seen[1].key, KEY);
        assert.equal(failures.length, 1, 'and the refusal is announced, never swallowed');
        operations.stop();
        rig.boot.destroy();
    });

    test('choosing again once the server is back writes, and clears the state', async () => {
        const rig = serverBoot({ timeoutMs: 40 });
        const settings = rig.boot.settings;
        rig.stored.set(KEY, 'mm');
        await settings.load(KEY);

        rig.hang(true);
        await settings.set(KEY, 'mL');
        assert.equal(settings.value(KEY), 'mm');

        const operations = watchOperations(settings);
        rig.hang(false);
        const retry = await settings.set(KEY, 'mL');

        assert.equal(retry.ok, true, 'the retry is an ordinary write');
        assert.equal(settings.value(KEY), 'mL');
        assert.equal(rig.stored.get(KEY), 'mL', 'and the server holds it');
        assert.deepEqual(operations.seen.map((op) => op.status),
            [OPERATION.PENDING, OPERATION.IDLE],
            'the failed state is not left standing over a write that worked');
        operations.stop();
        rig.boot.destroy();
    });

    test('a slow answer cannot overwrite a newer choice', async () => {
        const rig = serverBoot({ timeoutMs: 5000 });
        const settings = rig.boot.settings;
        rig.stored.set(KEY, 'mm');
        await settings.load(KEY);

        rig.hang(true);
        const slow = settings.set(KEY, 'mL');
        rig.hang(false);
        const quick = await settings.set(KEY, 'L');
        assert.equal(quick.ok, true);
        assert.equal(settings.value(KEY), 'L', 'the newer choice is the one on screen');

        rig.release();
        const late = await slow;

        assert.equal(late.ok, false, 'an answer nobody is waiting for is not published as one');
        assert.equal(late.reason, WRITE_REFUSAL.SUPERSEDED, 'and it says why it was dropped');
        assert.equal(settings.value(KEY), 'L',
            'the abandoned choice must not come back when its request finally answers');
        rig.boot.destroy();
    });

    test('an older write that fails does not put its state over a newer one that worked', async () => {
        const rig = serverBoot({ timeoutMs: 40 });
        const settings = rig.boot.settings;
        rig.stored.set(KEY, 'mm');
        await settings.load(KEY);

        rig.hang(true);
        const abandoned = settings.set(KEY, 'mL');
        rig.hang(false);
        const chosen = await settings.set(KEY, 'L');
        assert.equal(chosen.ok, true);

        const operations = watchOperations(settings);
        const failures = [];
        settings.onWriteFailure((failure) => failures.push(failure));
        const late = await abandoned;

        assert.equal(late.ok, false, 'it did fail');
        assert.equal(failures.length, 1,
            'and a refusal is a fact about the request, so it is still announced');
        assert.deepEqual(operations.seen, [],
            'but the visible state belongs to what is happening now, and the newer write '
            + 'already succeeded');
        assert.equal(settings.value(KEY), 'L', 'the newer choice stands');
        operations.stop();
        rig.boot.destroy();
    });

    test('a blackholed READ ends too, and is cancelled rather than abandoned', async () => {
        const rig = serverBoot({ timeoutMs: 40 });
        const settings = rig.boot.settings;
        rig.stored.set(KEY, 'mm');

        rig.hang(true);
        const answer = await settings.load(KEY);

        assert.equal(answer.value, undefined,
            'a read that did not answer reads absent — the router logs it and a broken read '
            + 'must not take a screen down');
        const read = rig.kvRequests().find((r) => r.method === 'GET');
        assert.ok(read, 'the read did reach the wire');
        assert.equal(read.aborted, true, 'and the deadline cancelled it');
        rig.boot.destroy();
    });
});
