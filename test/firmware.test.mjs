/**
 * Sending the machine a new image.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    createFirmwareStore, FIRMWARE_STATUS, FLASH_STATE,
} from '../src/stores/firmware-store.js';

/** A transport that records every call and answers from a scripted map. */
function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        request: async (path, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path, method, body: options.body ?? null, raw: options.raw ?? null,
                onLine: options.onLine ?? null, timeoutMs: options.timeoutMs });
            const answer = script[`${method} ${path}`] ?? script[path];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const ok = (data, status = 200) => ({ ok: true, status, data, notModified: false });

/** A scripted answer that plays a progress stream at the caller, then resolves. */
const streams = (lines) => (options) => {
    for (const line of lines) options.onLine?.(line);
    return ok(lines[lines.length - 1] ?? null);
};

const CATALOG = Object.freeze({
    artifacts: [
        { id: 'de1-1352', build: 1352, eligibility: { status: 'superseded' } },
        { id: 'de1-1358', build: 1358, eligibility: { status: 'applicable' } },
    ],
    machine: { model: 'DE1', build: 1352 },
    recommendedArtifactId: 'de1-1358',
    updateAvailable: true,
    operation: { state: 'idle' },
});

describe('the store refuses to be built half-wired', () => {
    test('a transport is required', () => {
        assert.throws(() => createFirmwareStore({}), /transport must be injected/);
    });
});

describe('reading the catalog', () => {
    test('one GET, and the body is published verbatim', async () => {
        const transport = recordingTransport({ 'GET /machine/firmware': ok(CATALOG) });
        const store = createFirmwareStore({ transport });
        await store.load();
        assert.deepEqual(transport.calls.map((c) => `${c.method} ${c.path}`), ['GET /machine/firmware']);
        assert.equal(store.get().status, FIRMWARE_STATUS.READY);
        assert.deepEqual(store.get().catalog, CATALOG);
    });

    test('a failed read holds no catalog and says so', async () => {
        const transport = recordingTransport();
        const store = createFirmwareStore({ transport });
        await store.load();
        assert.equal(store.get().status, FIRMWARE_STATUS.FAILED);
        assert.equal(store.get().catalog, null);
        assert.equal(store.get().error.status, 503);
    });
});

describe('"latest" is the server\'s recommendation and nothing else', () => {
    test('it installs recommendedArtifactId, by id', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware/apply': streams([
                { status: 'erasing', progress: 0 },
                { status: 'uploading', progress: 0.5 },
                { status: 'done', progress: 1 },
            ]),
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        const apply = transport.calls.find((c) => c.path === '/machine/firmware/apply');
        assert.deepEqual(apply.body, { artifactId: 'de1-1358' });
        assert.equal(store.get().flash.state, FLASH_STATE.DONE);
    });

    test('with no recommendation it sends nothing at all', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok({ ...CATALOG, recommendedArtifactId: null, updateAvailable: false }),
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        assert.equal(transport.calls.filter((c) => c.path.includes('apply')).length, 0,
            'a request that can only 404 is not made');
        assert.equal(store.get().flash.state, FLASH_STATE.REFUSED);
    });

    test('the progress lines become state, in order, with the machine\'s own fraction', async () => {
        const seen = [];
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware/apply': streams([
                { status: 'erasing', progress: 0 },
                { status: 'uploading', progress: 0.25 },
                { status: 'uploading', progress: 0.75 },
                { status: 'done', progress: 1 },
            ]),
        });
        const store = createFirmwareStore({ transport });
        const off = store.subscribe((state) => seen.push([state.flash.state, state.flash.progress]));
        await store.load();
        await store.installLatest();
        off();
        const flash = seen.filter(([state]) => state !== FLASH_STATE.IDLE);
        assert.deepEqual(flash, [
            ['erasing', 0], ['erasing', 0], ['uploading', 0.25], ['uploading', 0.75], ['done', 1],
        ], 'the first erasing is this store opening the operation; the rest are the machine');
    });

    test('a refusal never becomes a flash, and its reason is a SENTENCE', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware/apply': {
                ok: false, kind: 'http', status: 422, message: 'not applicable',
                problem: { error: 'artifact_not_applicable', message: 'this build is not newer' },
            },
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        const flash = store.get().flash;
        assert.equal(flash.state, FLASH_STATE.REFUSED);
        assert.equal(typeof flash.error, 'string');
        assert.equal(flash.error, 'artifact_not_applicable: this build is not newer');
        assert.equal(flash.detail.status, 422);
        assert.deepEqual(flash.detail.problem,
            { error: 'artifact_not_applicable', message: 'this build is not newer' });
    });

    test('a refusal with no body at all still says something a person can read', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware/apply': {
                ok: false, kind: 'network', status: null,
                message: 'the machine did not answer', problem: null,
            },
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        const flash = store.get().flash;
        assert.equal(flash.error, 'the machine did not answer');
        assert.equal(flash.detail, null, 'no status and no body is nothing to diagnose from');
    });

    test('a refusal whose body is a plain string is taken as the string', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware/apply': {
                ok: false, kind: 'http', status: 503,
                message: 'HTTP 503', problem: 'no machine connected',
            },
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        assert.equal(store.get().flash.error, 'no machine connected');
        assert.equal(store.get().flash.detail.status, 503);
    });
});

describe('a file goes up as bytes', () => {
    test('through `raw`, with an octet-stream type, and never as JSON', async () => {
        const transport = recordingTransport({
            'POST /machine/firmware': streams([{ status: 'done', progress: 1 }]),
        });
        const store = createFirmwareStore({ transport });
        const image = new Uint8Array([1, 2, 3, 4]);
        await store.installFile(image);
        const call = transport.calls.find((c) => c.path === '/machine/firmware' && c.method === 'POST');
        assert.equal(call.body, null, 'JSON.stringify of a Uint8Array is an object of numbered keys');
        assert.equal(call.raw, image, 'the bytes go up untouched');
        assert.equal(store.get().flash.state, FLASH_STATE.DONE);
    });

    test('an empty file is refused here rather than on the wire', async () => {
        const transport = recordingTransport();
        const store = createFirmwareStore({ transport });
        await store.installFile(new Uint8Array([]));
        assert.equal(transport.calls.length, 0);
        assert.equal(store.get().flash.state, FLASH_STATE.REFUSED);
    });

    test('neither install carries a deadline', async () => {
        const transport = recordingTransport({
            'GET /machine/firmware': ok(CATALOG),
            'POST /machine/firmware': streams([{ status: 'done', progress: 1 }]),
            'POST /machine/firmware/apply': streams([{ status: 'done', progress: 1 }]),
        });
        const store = createFirmwareStore({ transport });
        await store.load();
        await store.installLatest();
        await store.installFile(new Uint8Array([9]));
        for (const call of transport.calls.filter((c) => c.method === 'POST')) {
            assert.equal(call.timeoutMs, 0, `${call.path} must not be given a deadline`);
        }
    });
});

describe('cancelling asks and does not claim', () => {
    test('it reaches DELETE and reports nothing of its own', async () => {
        const transport = recordingTransport({
            'DELETE /machine/firmware': ok({ operation: { state: 'idle' } }, 202),
        });
        const store = createFirmwareStore({ transport });
        await store.cancel();
        assert.deepEqual(transport.calls.map((c) => c.method), ['DELETE']);
        /* The 202 says the ask was received. What happened is the open stream's to say. */
        assert.equal(store.get().flash.state, FLASH_STATE.IDLE);
    });
});
