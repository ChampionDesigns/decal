import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShotsStore } from '../src/stores/shots-store.js';
import { shotRow } from '../src/lib/shot-summary.js';
import { ENJOYMENT_MAX, ENJOYMENT_MIN } from '../src/data/rea-shot-record.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const PAGE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__shots~limit=20~offset=0~order=desc.json'), 'utf8'));
const ID = PAGE.items[0].id;

function recordingTransport({ page = PAGE } = {}) {
    const calls = [];
    return {
        calls,
        request: async (reqPath, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path: reqPath, method, body: options.body ?? null });
            if (method === 'PUT') return { ok: true, status: 200, notModified: false, data: {} };
            return { ok: true, status: 200, notModified: false, data: page };
        },
    };
}

function withEnjoyment(value) {
    return {
        ...PAGE,
        items: PAGE.items.map((item, index) => (index === 0
            ? { ...item, annotations: { ...(item.annotations || {}), enjoyment: value } }
            : item)),
    };
}

describe('the enjoyment scale is the one Decaid serves and accepts', () => {
    test('the bounds are 0 and 10', () => {
        assert.equal(ENJOYMENT_MIN, 0);
        assert.equal(ENJOYMENT_MAX, 10);
    });

    for (const value of [10.5, 11, 72, 100, -0.5]) {
        test(`setEnjoyment refuses ${value} and sends no request`, async () => {
            const transport = recordingTransport();
            const store = createShotsStore({ transport });
            await assert.rejects(() => store.setEnjoyment(ID, value), /from 0 to 10/);
            assert.deepEqual(transport.calls, []);
        });
    }

    test('null still clears the rating', async () => {
        const transport = recordingTransport();
        const store = createShotsStore({ transport });
        const result = await store.setEnjoyment(ID, null);
        assert.equal(result.ok, true);
        assert.deepEqual(transport.calls.map((c) => c.body), [{ annotations: { enjoyment: null } }]);
    });

    test('a value in range is sent as is', async () => {
        const transport = recordingTransport();
        const store = createShotsStore({ transport });
        const result = await store.setEnjoyment(ID, 4.5);
        assert.equal(result.ok, true);
        assert.deepEqual(transport.calls.map((c) => c.body), [{ annotations: { enjoyment: 4.5 } }]);
    });

    test('the two ends of the scale are sent as is', async () => {
        const transport = recordingTransport();
        const store = createShotsStore({ transport });
        await store.setEnjoyment(ID, 0);
        await store.setEnjoyment(ID, 10);
        assert.deepEqual(transport.calls.map((c) => c.body.annotations.enjoyment), [0, 10]);
    });
});

describe('a served rating is shown on the scale it is served on', () => {
    test('the shot summary shows 7.5 as 7.5 out of 10', () => {
        const row = shotRow({ summary: { id: 'a', annotations: { enjoyment: 7.5 } } });
        assert.equal(row.cells.enjoyment.value, 7.5);
        assert.equal(row.cells.enjoyment.text, '7.5/10');
    });

    test('the shot summary shows a whole rating with its one decimal', () => {
        const row = shotRow({ summary: { id: 'a', annotations: { enjoyment: 8 } } });
        assert.equal(row.cells.enjoyment.text, '8.0/10');
    });

    test('a list read from the mock with 7.5 shows 7.5 out of 10, not rescaled', async () => {
        const transport = recordingTransport({ page: withEnjoyment(7.5) });
        const store = createShotsStore({ transport });
        await store.readPage();
        const row = store.get().rows.find((r) => r.id === ID);
        assert.equal(row.cells.enjoyment.value, 7.5);
        assert.equal(row.cells.enjoyment.text, '7.5/10');
    });

    test('an unrated shot still shows the dash', () => {
        const row = shotRow({ summary: { id: 'a', annotations: {} } });
        assert.equal(row.cells.enjoyment.text, '—');
    });
});
