/**
 * An annotation a person confirmed is not un-written by a read that predates it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShotsStore } from '../src/stores/shots-store.js';
import { createReaTransport } from '../src/data/rea-transport.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const BASE = 'http://machine.local:8080/api/v1';
const fixture = (name) => JSON.parse(readFileSync(path.join(REPO, 'tools/rea-fixtures', name), 'utf8'));

const PAGE = fixture('api__v1__shots~limit=20~offset=0~order=desc.json');
const RECORD = fixture('api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json');
const ID = RECORD.id;
const OTHER = PAGE.items.find((item) => item.id !== ID).id;

const served = (shot, annotations) => ({
    ...shot,
    annotations: { ...(shot.annotations || {}), ...annotations },
    ...(annotations.espressoNotes === undefined ? {} : { shotNotes: annotations.espressoNotes }),
});

const page = (rows) => ({ ...PAGE, items: PAGE.items.map((item) => rows[item.id] ?? item) });

const body = (payload) => ({
    status: 200,
    ok: true,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
});

function harness() {
    const open = [];
    const fetchImpl = (url, init = {}) => new Promise((resolve) => {
        open.push({
            url,
            method: init.method ?? 'GET',
            sent: init.body ? JSON.parse(init.body) : null,
            answer: (payload) => resolve(body(payload)),
        });
    });
    const transport = createReaTransport({ fetch: fetchImpl, baseUrl: BASE, timeoutMs: 0 });
    const store = createShotsStore({ transport });
    const waiting = (match) => {
        const found = open.find((call) => match(call) && !call.done);
        assert.ok(found, `no open request matched; saw ${JSON.stringify(open.map((c) => `${c.method} ${c.url}`))}`);
        found.done = true;
        return found;
    };
    const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
    return { store, open, waiting, settle };
}

const GET_RECORD = (call) => call.method === 'GET' && call.url.includes(`/shots/${ID}`);
const GET_PAGE = (call) => call.method === 'GET' && call.url.includes('/shots?');
const PUT = (call) => call.method === 'PUT';

const rowFor = (store, id) => store.get().items.find((item) => item.id === id);

describe('a rating outranks the record fetch it raced', () => {

    test('the rating survives a record already on the wire', async () => {
        const { store, waiting, settle } = harness();

        const read = store.loadShot(ID);
        await settle();
        const fetchCall = waiting(GET_RECORD);

        const write = store.setEnjoyment(ID, 72);
        await settle();
        waiting(PUT).answer({});
        await write;

        fetchCall.answer(served(RECORD, { enjoyment: 10 }));
        await read;
        await settle();

        assert.equal(store.recordOf(ID).annotations.enjoyment, 72,
            'the fetched document put the old rating back over the one the machine took');
        assert.equal(store.recordOf(ID).annotations.actualDoseWeight, 17,
            'only the annotation the write owns is put back — the rest of the document is the server\'s');
        assert.ok(store.derivationOf(ID), 'the document still landed, walked and all');
    });

    test('the other order needs no guard, and still ends on the new rating', async () => {
        const { store, waiting, settle } = harness();

        const read = store.loadShot(ID);
        await settle();
        waiting(GET_RECORD).answer(served(RECORD, { enjoyment: 10 }));
        await read;

        const write = store.setEnjoyment(ID, 72);
        await settle();
        waiting(PUT).answer({});
        await write;

        assert.equal(store.recordOf(ID).annotations.enjoyment, 72);
    });

    test('a read issued AFTER the write settles is the newer answer and wins', async () => {
        const { store, waiting, settle } = harness();

        const write = store.setEnjoyment(ID, 72);
        await settle();
        waiting(PUT).answer({});
        await write;

        const read = store.readPage();
        await settle();
        waiting(GET_PAGE).answer(page({ [ID]: served(RECORD, { enjoyment: 80 }) }));
        await read;

        assert.equal(rowFor(store, ID).annotations.enjoyment, 80);
    });
});

describe('a page read lands whole, minus the annotations it is too old to speak for', () => {

    test('an annotation on a row in the page survives that page', async () => {
        const { store, waiting, settle } = harness();

        const read = store.readPage();
        await settle();
        const pageCall = waiting(GET_PAGE);

        const write = store.setEnjoyment(ID, 72);
        await settle();
        waiting(PUT).answer({});
        await write;

        pageCall.answer(page({
            [ID]: served(RECORD, { enjoyment: 10 }),
            [OTHER]: served(PAGE.items.find((i) => i.id === OTHER), { enjoyment: 44 }),
        }));
        await read;
        await settle();

        assert.equal(rowFor(store, ID).annotations.enjoyment, 72,
            'the page put the old rating back on the row that was annotated');
        assert.equal(rowFor(store, OTHER).annotations.enjoyment, 44,
            'and every other row is the page\'s own — the document is not discarded to protect one value');
        assert.equal(store.get().items.length, PAGE.items.length);
        assert.equal(store.get().total, PAGE.total);
    });
});

describe('two presses on one annotation, and two annotations on one shot', () => {

    test('the LATER press wins however the two answers interleave', async () => {
        const { store, waiting, settle } = harness();

        const read = store.readPage();
        await settle();
        waiting(GET_PAGE).answer(PAGE);
        await read;

        const first = store.setEnjoyment(ID, 10);
        await settle();
        const firstCall = waiting(PUT);
        const second = store.setEnjoyment(ID, 90);
        await settle();
        const secondCall = waiting(PUT);

        secondCall.answer({});
        await second;
        firstCall.answer({});
        await first;
        await settle();

        assert.equal(rowFor(store, ID).annotations.enjoyment, 90,
            'the answer that arrived last was the press that was made first');
    });

    test('a note and a rating do not outrank each other', async () => {
        const { store, waiting, settle } = harness();

        const read = store.readPage();
        await settle();
        waiting(GET_PAGE).answer(PAGE);
        await read;

        const rating = store.setEnjoyment(ID, 72);
        await settle();
        const ratingCall = waiting(PUT);
        const note = store.setNotes(ID, 'grind one finer');
        await settle();
        const noteCall = waiting(PUT);

        noteCall.answer({});
        await note;
        ratingCall.answer({});
        await rating;
        await settle();

        const row = rowFor(store, ID);
        assert.equal(row.annotations.enjoyment, 72, 'the note\'s press must not drop the rating');
        assert.equal(row.annotations.espressoNotes, 'grind one finer');
    });
});

describe('a note outranks the record fetch it raced, shadow and all', () => {

    test('the note survives, and the top-level shadow moves with it', async () => {
        const { store, waiting, settle } = harness();

        const read = store.loadShot(ID);
        await settle();
        const fetchCall = waiting(GET_RECORD);

        const write = store.setNotes(ID, 'keep this one');
        await settle();
        waiting(PUT).answer({});
        await write;

        fetchCall.answer(served(RECORD, { espressoNotes: 'the old note' }));
        await read;
        await settle();

        const held = store.recordOf(ID);
        assert.equal(held.annotations.espressoNotes, 'keep this one');
        assert.equal(held.shotNotes, 'keep this one',
            'the server rewrites the shadow from the annotation, so a held record whose two '
            + 'copies disagree answers a reader with a value that exists nowhere');
    });
});
