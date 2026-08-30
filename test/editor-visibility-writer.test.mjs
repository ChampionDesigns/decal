/**
 * editor-visibility-writer.test.mjs — THE EDITOR STORE'S PUBLIC VISIBILITY WRITER (D20).
 *
 * Ben, 30 August 2026: *"a store writer (profile-store/shots-store pattern — setVisibility
 * exists internally for the supersede path; expose a deliberate public method)."*
 *
 * The internal one already existed and is NOT this: it serves the B11 supersede path, where
 * a failed write is advisory because the save it follows has already succeeded, so it
 * answers "the record, or null" and swallows the ending. A person pressing a switch is the
 * opposite case — the write IS the gesture — so the public method turns every ending into
 * published state a screen can paint.
 *
 * WHAT IS PINNED HERE, and each one is a way the write could be wrong rather than absent:
 *   1. the REQUEST — route, method, and the BARE `{visibility}` body the pinned handler
 *      requires (`profile_handler.dart:184-192` at `2b047d02`: a missing key is a 400);
 *   2. the ANSWER is what the state carries — never the value that was asked for;
 *   3. a REFUSAL and a FAULT are separated, because the screen prints one verbatim and
 *      words the other itself;
 *   4. `record` is NOT re-published — the editor screen re-seats its draft on record
 *      identity, so a new record object here would discard unsaved step edits;
 *   5. the slice resets with the record, so one profile's answer cannot be read as another's;
 *   6. an id-less draft and an unknown visibility value write nothing at all.
 *
 * A8: every assertion is about a returned value or a recorded call. Nothing reads a source
 * file.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createProfileEditorStore, VISIBILITY_WRITE, SAVE_STATUS,
} from '../src/stores/profile-editor-store.js';
import { PROFILE_VISIBILITY } from '../src/data/rea-profile.js';

/** A transport that records every call and answers from a scripted map. */
function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        request: async (reqPath, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path: reqPath, method, body: options.body ?? null });
            const answer = script[`${method} ${reqPath}`] ?? script[reqPath];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const recordOf = (visibility, over = {}) => ({
    id: 'profile:abc',
    profile: { title: 'Gentle and sweet', steps: [] },
    metadataHash: 'meta-0',
    compoundHash: 'compound-0',
    parentId: null,
    visibility,
    isDefault: false,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    metadata: null,
    ...over,
});

/** The path `callRoute` spells — the id is percent-encoded into the segment. */
const PATH = `/profiles/${encodeURIComponent('profile:abc')}/visibility`;
const KEY = `PUT ${PATH}`;

describe('the editor store writes library visibility (D20)', () => {
    test('the REQUEST is the route, the method and the BARE field', async () => {
        const transport = recordingTransport({
            [KEY]: { ok: true, status: 200, data: recordOf('hidden') },
        });
        const store = createProfileEditorStore({ transport });
        store.open(recordOf('visible'));

        await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);

        assert.equal(transport.calls.length, 1, 'one request, and nothing else');
        assert.equal(transport.calls[0].method, 'PUT');
        assert.equal(transport.calls[0].path, PATH);
        assert.deepEqual(transport.calls[0].body, { visibility: 'hidden' },
            'not wrapped in a profile key — unlike both save routes, this one takes it bare');
    });

    test('the state carries what the SERVER answered, not what was asked for', async () => {
        const store = createProfileEditorStore({
            transport: recordingTransport({
                /* Asked for hidden; the server stored visible. */
                [KEY]: { ok: true, status: 200, data: recordOf('visible') },
            }),
        });
        store.open(recordOf('visible'));

        const state = await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);
        assert.equal(state.visibility.status, VISIBILITY_WRITE.DONE);
        assert.equal(state.visibility.value, 'visible',
            'the answer states the new state — a store that echoed the request would be '
            + 'reporting a thing that did not happen');
        assert.equal(state.visibility.wanted, null, 'nothing is in flight any more');
    });

    test('the RECORD is not re-published, and that is what protects the draft', async () => {
        const seated = recordOf('visible');
        const store = createProfileEditorStore({
            transport: recordingTransport({
                [KEY]: { ok: true, status: 200, data: recordOf('hidden') },
            }),
        });
        store.open(seated);
        const before = store.get();

        const after = await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);
        assert.equal(after.record, before.record,
            'the SAME object — <editor-screen> re-seats its draft whenever this identity '
            + 'changes, so publishing the answer here would discard unsaved step edits');
        assert.equal(after.baseline, before.baseline, 'and the dirty-state baseline holds');
        assert.equal(after.save, SAVE_STATUS.IDLE,
            'a visibility write is not a save and must not enter the save vocabulary — at '
            + 'saved the screen closes itself');
    });

    test('a REFUSAL is kept as a refusal, with the server\'s own words', async () => {
        const store = createProfileEditorStore({
            transport: recordingTransport({
                [KEY]: {
                    ok: false,
                    kind: 'http',
                    status: 400,
                    message: 'refused',
                    problem: {
                        error: 'Invalid request',
                        message: 'Invalid argument(s): Cannot delete default profiles, only hide them',
                    },
                },
            }),
        });
        store.open(recordOf('visible'));

        const state = await store.setVisibility(PROFILE_VISIBILITY.DELETED);
        assert.equal(state.visibility.status, VISIBILITY_WRITE.FAILED);
        assert.equal(state.visibility.refusal.kind, 'invalid');
        assert.match(state.visibility.refusal.message, /Cannot delete default profiles/);
        assert.equal(state.visibility.error, null,
            'a refusal is the server working correctly, so it is not filed as a fault');
        assert.equal(state.visibility.value, null,
            'and nothing was confirmed, so the switch still reads the record');
    });

    test('a FAULT is kept as a fault, with no sentence invented for it', async () => {
        const store = createProfileEditorStore({
            transport: recordingTransport({
                [KEY]: { ok: false, kind: 'http', status: 500, message: 'boom', problem: null },
            }),
        });
        store.open(recordOf('visible'));

        const state = await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);
        assert.equal(state.visibility.status, VISIBILITY_WRITE.FAILED);
        assert.equal(state.visibility.refusal, null, 'a 500 is not a typed refusal');
        assert.equal(state.visibility.error.status, 500, 'the result is kept verbatim');
    });

    test('the slice RESETS with the record', async () => {
        const store = createProfileEditorStore({
            transport: recordingTransport({
                [KEY]: { ok: true, status: 200, data: recordOf('hidden') },
            }),
        });
        store.open(recordOf('visible'));
        await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);
        assert.equal(store.get().visibility.value, 'hidden');

        const next = store.open(recordOf('visible', { id: 'profile:other' }));
        assert.equal(next.visibility.status, VISIBILITY_WRITE.IDLE);
        assert.equal(next.visibility.value, null,
            'an answer about one record must not be read as an answer about the next');
    });

    test('no id and no such visibility both write NOTHING', async () => {
        const transport = recordingTransport();
        const store = createProfileEditorStore({ transport });

        /* A draft that has never been saved: a record object with a null id, which is
         * exactly what selector-screen's "new profile" seats. */
        store.open(recordOf('visible', { id: null }));
        await store.setVisibility(PROFILE_VISIBILITY.HIDDEN);
        assert.deepEqual(transport.calls, [], 'there is no record to address');
        assert.equal(store.get().visibility.status, VISIBILITY_WRITE.IDLE,
            'and no failure is invented for a request nobody could make');

        store.open(recordOf('visible'));
        await store.setVisibility('archived');
        assert.deepEqual(transport.calls, [],
            'a value the enum does not hold is refused HERE rather than sent to be 400ed');
    });

    test('the supersede path still answers the way it always did', async () => {
        /* The internal writer's contract is unchanged by the public one: a save that
         * supersedes still un-hides its answer and hides its parent, and a failure there
         * is still swallowed. Driven through the real save so the refactor is proven at
         * the call site rather than asserted about it. */
        const parent = recordOf('visible');
        const savedPath = `/profiles/${encodeURIComponent('profile:saved')}/visibility`;
        const transport = recordingTransport({
            'POST /profiles': { ok: true, status: 201, data: recordOf('hidden', { id: 'profile:saved', parentId: 'profile:abc' }) },
            [`PUT ${savedPath}`]: { ok: true, status: 200, data: recordOf('visible', { id: 'profile:saved', parentId: 'profile:abc' }) },
            [KEY]: { ok: true, status: 200, data: recordOf('hidden') },
        });
        const store = createProfileEditorStore({ transport });
        store.open(parent);

        await store.saveAsNewVersion({ title: 'Gentle and sweet', steps: [] });

        const writes = transport.calls.filter((c) => c.path.endsWith('/visibility'));
        assert.deepEqual(writes.map((c) => [c.path, c.body.visibility]), [
            [savedPath, 'visible'],
            [PATH, 'hidden'],
        ], 'un-hide the answer first, then hide the parent — never the other way round');
        assert.equal(store.get().save, SAVE_STATUS.SAVED);
        assert.equal(store.get().visibility.status, VISIBILITY_WRITE.IDLE,
            'the supersede path publishes nothing into the switch\'s slice — those writes '
            + 'are the save\'s, and no person pressed anything');
    });
});
