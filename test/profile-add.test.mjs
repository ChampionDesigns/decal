/**
 * The three ways a profile can arrive.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { readProfileFile, newProfile, PROFILE_FILE_KEYS } from '../src/data/rea-profile.js';
import { NEW_STEP, newStep } from '../src/lib/profile-modes.js';
import {
    createProfileLibraryStore, ADD_STATUS, VISUALIZER_PLUGIN, GENERATOR_PLUGIN,
} from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = JSON.parse(readFileSync(
    join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8'));
const WORKFLOW = JSON.parse(readFileSync(
    join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8'));

/** A profile file that passes: every one of the ten keys, and steps as an array. */
const GOOD_FILE = Object.freeze({
    title: 'From a file',
    author: 'Ben',
    notes: '',
    beverage_type: 'espresso',
    steps: [{ name: 'a', temperature: 92, seconds: 10, pump: 'pressure', pressure: 6 }],
    version: '2',
    target_volume: 0,
    target_weight: 36,
    target_volume_count_start: 0,
    tank_temperature: 0,
});

function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        baseUrl: 'http://machine.local/api/v1',
        request: async (path, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path, method, body: options.body ?? null });
            const answer = script[`${method} ${path}`] ?? script[path];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const ok = (data, status = 200) => ({ ok: true, status, data, notModified: false });
const memoryRouter = () => createStorageRouter({
    backends: { [LAYERS.local]: createMemoryBackend(), [LAYERS.session]: createMemoryBackend(),
        [LAYERS.kv]: createMemoryBackend() },
});

function build(script = {}) {
    const transport = recordingTransport({
        '/profiles': ok(FIXTURE),
        '/workflow': ok(WORKFLOW),
        'POST /machine/profile': ok(null),
        ...script,
    });
    const arm = createProfileArmStore({ transport });
    const store = createProfileLibraryStore({ transport, storage: memoryRouter(), arm });
    return { transport, store };
}

describe('the shape a profile file must have', () => {
    test('Slate\'s ten keys, in Slate\'s own order', () => {
        assert.deepEqual([...PROFILE_FILE_KEYS], [
            'title', 'author', 'notes', 'beverage_type', 'steps',
            'version', 'target_volume', 'target_weight',
            'target_volume_count_start', 'tank_temperature',
        ]);
    });

    test('a real profile passes', () => {
        const read = readProfileFile(GOOD_FILE);
        assert.equal(read.ok, true);
        assert.equal(read.profile, GOOD_FILE);
    });

    test('anything that is not an object is refused, arrays included', () => {
        for (const value of [null, undefined, 7, 'a profile', [], [GOOD_FILE]]) {
            assert.equal(readProfileFile(value).ok, false, String(value));
        }
    });

    test('a missing key is named, so a person can be told which', () => {
        const { author, steps, ...rest } = GOOD_FILE;
        const read = readProfileFile(rest);
        assert.equal(read.ok, false);
        assert.equal(read.reason, 'missing-fields');
        assert.deepEqual([...read.missing], ['author', 'steps']);
    });

    test('steps must be an array, not merely present', () => {
        const read = readProfileFile({ ...GOOD_FILE, steps: { one: 1 } });
        assert.equal(read.ok, false);
        assert.equal(read.reason, 'steps-not-an-array');
    });
});

describe('upload — a file becomes a record', () => {
    test('it POSTs /profiles with the profile WRAPPED, and no parentId', async () => {
        const { store, transport } = build({ 'POST /profiles': ok({ id: 'profile:new' }, 201) });
        await store.load();
        await store.createFromFile(JSON.stringify(GOOD_FILE));
        const post = transport.calls.find((c) => c.method === 'POST' && c.path === '/profiles');
        assert.ok(post, 'the route was reached');
        assert.equal(post.body.profile.title, 'From a file');
        assert.equal(post.body.parentId, undefined,
            'a file is not a version of anything this library holds');
        assert.equal(store.get().add.status, ADD_STATUS.ADDED);
    });

    test('and re-reads the listing, because the answer is what is on the list', async () => {
        const { store, transport } = build({ 'POST /profiles': ok({ id: 'profile:new' }, 201) });
        await store.load();
        const before = transport.calls.filter((c) => c.path === '/profiles' && c.method === 'GET').length;
        await store.createFromFile(JSON.stringify(GOOD_FILE));
        assert.equal(transport.calls.filter((c) => c.path === '/profiles' && c.method === 'GET').length,
            before + 1);
    });

    test('a file that is not JSON never reaches the wire', async () => {
        const { store, transport } = build();
        await store.load();
        const before = transport.calls.length;
        await store.createFromFile('this is not json');
        assert.equal(transport.calls.length, before);
        assert.deepEqual(
            { status: store.get().add.status, reason: store.get().add.reason },
            { status: ADD_STATUS.REFUSED, reason: 'not-json' },
        );
    });

    test('nor does JSON that is not a profile', async () => {
        const { store, transport } = build();
        await store.load();
        const before = transport.calls.length;
        await store.createFromFile(JSON.stringify({ title: 'nearly' }));
        assert.equal(transport.calls.length, before);
        assert.equal(store.get().add.reason, 'missing-fields');
    });
});

describe('import — a share code goes through the plugin', () => {
    const IMPORT = `/plugins/${VISUALIZER_PLUGIN}/import`;

    test('it POSTs the code to the Visualizer plugin\'s own endpoint', async () => {
        const { store, transport } = build({
            [`POST ${IMPORT}`]: ok({ success: true, profileTitle: 'Shared' }),
        });
        await store.load();
        await store.importShareCode(' AB12 ');
        const post = transport.calls.find((c) => c.path === IMPORT);
        assert.deepEqual(post.body, { shareCode: 'AB12' }, 'trimmed, because a pasted code carries space');
        assert.equal(store.get().add.status, ADD_STATUS.ADDED);
    });

    test('a 401 is "not signed in" and a 400 is "bad code" — two different sentences', async () => {
        for (const [status, reason] of [[401, 'not-signed-in'], [400, 'bad-code']]) {
            const { store } = build({
                [`POST ${IMPORT}`]: { ok: false, kind: 'http', status, message: 'no', problem: null },
            });
            await store.load();
            await store.importShareCode('AB12');
            assert.deepEqual(
                { status: store.get().add.status, reason: store.get().add.reason },
                { status: ADD_STATUS.REFUSED, reason }, `HTTP ${status}`,
            );
        }
    });

    test('and everything else is a FAILURE, not a wrong code', async () => {
        /* A plugin that is not loaded answers 404 here. Telling a person their share code
         * is wrong when the plugin is not even running sends them to fix the one thing
         * that was fine. */
        const { store } = build({
            [`POST ${IMPORT}`]: { ok: false, kind: 'http', status: 404, message: 'not loaded', problem: null },
        });
        await store.load();
        await store.importShareCode('AB12');
        assert.equal(store.get().add.status, ADD_STATUS.FAILED);
        assert.equal(store.get().add.reason, null);
    });

    test('an empty code reaches nothing', async () => {
        const { store, transport } = build();
        await store.load();
        const before = transport.calls.length;
        await store.importShareCode('   ');
        assert.equal(transport.calls.length, before);
        assert.equal(store.get().add.reason, 'no-code');
    });
});

describe('generate — a link, and only when the plugin is running', () => {
    test('a loaded plugin answers with its page on THIS machine', async () => {
        const { store } = build({
            '/plugins': ok([{ id: GENERATOR_PLUGIN, loaded: true }]),
        });
        const url = await store.generatorUrl();
        assert.equal(url, `http://machine.local/api/v1/plugins/${GENERATOR_PLUGIN}/ui?layout=baseline`);
    });

    test('an INSTALLED but not loaded plugin answers null', async () => {
        const { store } = build({ '/plugins': ok([{ id: GENERATOR_PLUGIN, loaded: false }]) });
        assert.equal(await store.generatorUrl(), null,
            'its endpoints 404 while it is not running — the row must be absent, not broken');
    });

    test('so does a plugin list without it, and a list that could not be read', async () => {
        const { store } = build({ '/plugins': ok([{ id: 'something.else', loaded: true }]) });
        assert.equal(await store.generatorUrl(), null);
        const { store: broken } = build();
        assert.equal(await broken.generatorUrl(), null);
    });
});

describe('an add can be forgotten', () => {
    test('clearAdd puts the state back and does not republish when idle', async () => {
        const { store } = build();
        await store.load();
        await store.createFromFile('nope');
        assert.equal(store.get().add.status, ADD_STATUS.REFUSED);
        store.clearAdd();
        assert.equal(store.get().add.status, ADD_STATUS.IDLE);
        const held = store.get();
        assert.equal(store.clearAdd(), held, 'a second clear is a no-op, not a republish');
    });
});

describe('a brand-new profile', () => {
    test('is never seated with zero steps', () => {
        const profile = newProfile({ title: 'New profile' });
        assert.ok(Array.isArray(profile.steps));
        assert.ok(profile.steps.length >= 1,
            'no steps means no step columns, no action rail, and no way to add one');
    });

    test('opens with exactly ONE step, which is what Ben asked for', () => {
        assert.equal(newProfile().steps.length, 1);
    });

    test('that step is the shared blank step, not a second answer', () => {
        const seeded = newProfile({ stepName: 'New step' }).steps[0];
        assert.deepEqual(seeded, newStep({ name: 'New step' }));
        assert.equal(seeded.pressure, NEW_STEP.pressure, 'Ben\'s 8 bar reaches the editor');
        assert.equal(seeded.limiter.value, NEW_STEP.limiter.value);
        assert.equal(seeded.temperature, NEW_STEP.temperature);
        assert.equal(seeded.seconds, NEW_STEP.seconds);
        assert.equal(seeded.sensor, NEW_STEP.sensor);
        assert.equal(seeded.exit, null);
    });

    test('is a complete profile document by rea-profile\'s own reader', () => {
        const read = readProfileFile(newProfile({ title: 'New profile' }));
        assert.equal(read.ok, true, read.reason);
        assert.deepEqual(read.missing ?? [], []);
    });

    test('carries every one of the ten keys, and nothing else', () => {
        assert.deepEqual(Object.keys(newProfile()).sort(), [...PROFILE_FILE_KEYS].sort());
    });

    test('the title and the step name are the caller\'s, because D2 puts them there', () => {
        assert.equal(newProfile({ title: 'Neues Profil' }).title, 'Neues Profil');
        assert.equal(newProfile({ stepName: 'Neuer Schritt' }).steps[0].name, 'Neuer Schritt');
        assert.equal(newProfile().title, '', 'a data module invents no English');
    });

    test('every call is a fresh, mutable profile — two + presses cannot share a step', () => {
        const a = newProfile();
        const b = newProfile();
        assert.notEqual(a, b);
        assert.notEqual(a.steps, b.steps);
        assert.notEqual(a.steps[0], b.steps[0]);
        a.steps[0].temperature = 1;
        assert.equal(b.steps[0].temperature, NEW_STEP.temperature);
    });

    test('its preinfusion marker is None, which is what 0 means', () => {
        assert.equal(newProfile().target_volume_count_start, 0);
    });
});
