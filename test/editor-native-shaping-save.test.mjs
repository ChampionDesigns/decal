import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppBoot } from '../src/lib/app-boot.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { FAVOURITES_KEY, FAVOURITES_SEEDED_KEY } from '../src/lib/profile-rules.js';
import { SAVE_STATUS } from '../src/stores/profile-editor-store.js';
import {
    CHANGE_TELL, COMMIT_GESTURE, SAVE_OPERATION, changeCountOf, commitPlan,
} from '../src/lib/editor-commit.js';
import { withDe1Emulation } from '../src/lib/de1-emulation.js';
import { checkNativeShaping } from '../src/lib/native-shaping-rules.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

const SPEC_BLOCK = Object.freeze({
    version: 2,
    pump_curve: [
        { pressure: 1, flow: 20 }, { pressure: 3, flow: 12 }, { pressure: 6, flow: 6 },
        { pressure: 9, flow: 5 }, { pressure: 12, flow: 4 },
    ],
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0,
    pressure_mode: 'both',
    pressure_filter_tau: 0,
    pressure_ramp_tau: 1,
    flow_ramp_tau: 0,
});

const V1_BLOCK = Object.freeze({
    version: 1,
    pump_curve: SPEC_BLOCK.pump_curve,
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0.5,
    pressure_mode: 'both',
    ramp_factor: 2,
});

const recipe = (extra = {}) => ({
    version: '2',
    title: 'Shaped',
    author: 'Decal',
    notes: '',
    beverage_type: 'espresso',
    steps: [{
        name: 'pour',
        pump: 'pressure',
        transition: 'fast',
        exit: { type: 'pressure', condition: 'over', value: 6 },
        pressure: 9,
        temperature: 93,
        seconds: 30,
    }],
    target_volume: 0,
    target_weight: 36,
    target_volume_count_start: 0,
    tank_temperature: 0,
    ...extra,
});

const record = (id, profile) => ({
    id,
    profile,
    metadataHash: `meta-${id}`,
    compoundHash: `compound-${id}`,
    parentId: null,
    visibility: 'visible',
    isDefault: false,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    metadata: null,
});

function profileServer(records) {
    const held = new Map(records.map((r) => [r.id, structuredClone(r)]));
    const posts = [];
    const workflowPuts = [];
    let serial = 0;
    let workflowDoc = { profile: null, context: null };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
        status, headers: { 'content-type': 'application/json' },
    });
    const impl = async (url, options = {}) => {
        const target = new URL(url);
        const method = (options.method ?? 'GET').toUpperCase();
        const visibility = target.pathname.match(/^\/api\/v1\/profiles\/(.+)\/visibility$/);
        if (visibility && method === 'PUT') {
            const found = held.get(decodeURIComponent(visibility[1]));
            if (!found) return json({ error: 'Invalid request' }, 400);
            found.visibility = JSON.parse(options.body).visibility;
            return json(found);
        }
        if (target.pathname === '/api/v1/profiles' && method === 'POST') {
            const body = JSON.parse(options.body);
            posts.push(body);
            serial += 1;
            const made = { ...record(`new-${serial}`, body.profile), parentId: body.parentId ?? null };
            held.set(made.id, made);
            return json(made, 201);
        }
        if (target.pathname === '/api/v1/profiles' && method === 'GET') return json([...held.values()]);
        if (target.pathname === '/api/v1/machine/profile' && method === 'POST') return new Response(null, { status: 200 });
        if (target.pathname === '/api/v1/workflow' && method === 'GET') return json(workflowDoc);
        if (target.pathname === '/api/v1/workflow' && method === 'PUT') {
            const body = JSON.parse(options.body);
            workflowPuts.push(body);
            workflowDoc = { ...workflowDoc, ...body };
            return json(workflowDoc);
        }
        return json({ error: 'no recording' }, 503);
    };
    impl.posts = posts;
    impl.workflowPuts = workflowPuts;
    return impl;
}

const fakeSocket = () => (url) => ({
    url, addEventListener() {}, removeEventListener() {}, send() {}, close() {},
});

async function settle(times = 8) {
    for (let round = 0; round < times; round += 1) {
        await new Promise((done) => { setImmediate(done); });
    }
}

async function withEditor(profile, fn) {
    const server = profileServer([record('open-1', profile)]);
    const boot = createAppBoot({
        fetch: server,
        createSocket: fakeSocket(),
        location: LOCATION,
        importModule: async () => ({}),
        wait: async () => {},
        backends: {
            [LAYERS.kv]: createMemoryBackend({ [FAVOURITES_KEY]: { 0: 'open-1' }, [FAVOURITES_SEEDED_KEY]: true }),
        },
    });
    await boot.library.load();
    boot.profileEditor.open(boot.library.recordFor('open-1'));
    try {
        await fn({ boot, server });
    } finally {
        boot.library.stop();
    }
}

async function save(boot, server, draft) {
    const change = changeCountOf(draft, boot.profileEditor.get().record.profile);
    const plan = commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: change.count > 0, tell: change.tell });
    assert.equal(plan.operation, SAVE_OPERATION.NEW_VERSION, plan.reason);
    const state = await boot.profileEditor.saveAsNewVersion(draft);
    assert.equal(state.save, SAVE_STATUS.SAVED);
    await settle();
    return { change, sent: server.posts.at(-1), record: state.record };
}

const editedBlock = () => {
    const points = SPEC_BLOCK.pump_curve.map((pt) => ({ ...pt }));
    points[2] = { pressure: 6.31, flow: 6.49 };
    const result = checkNativeShaping({
        ...SPEC_BLOCK, pump_curve: points, pressure_tau: 1.239, pressure_mode: 'rise',
        pressure_filter_tau: 0.71, pressure_ramp_tau: 4.999, flow_ramp_tau: 2.5,
    });
    assert.equal(result.ok, true);
    return result.block;
};

describe('the native shaping block is saved with the profile', () => {
    test('a shaping edit is one change, Save makes a new version, and the body carries the rounded block', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const block = editedBlock();
            const draft = { ...boot.profileEditor.get().record.profile, native_shaping: block };
            const { change, sent, record: saved } = await save(boot, server, draft);
            assert.equal(change.count, 1);
            assert.equal(change.tell, CHANGE_TELL.COMPARED);
            assert.deepEqual(sent.profile.native_shaping, block);
            assert.equal(sent.profile.native_shaping.pressure_tau, 1.24);
            assert.equal(sent.profile.native_shaping.version, 2);
            assert.equal(sent.profile.native_shaping.pressure_filter_tau, 0.72);
            assert.equal(sent.profile.native_shaping.pressure_ramp_tau, 5);
            assert.equal(sent.profile.native_shaping.flow_ramp_tau, 2.5);
            assert.equal(Object.hasOwn(sent.profile.native_shaping, 'ramp_factor'), false);
            assert.deepEqual(sent.profile.native_shaping.pump_curve[2], { pressure: 6.3, flow: 6.5 });
            assert.equal(sent.parentId, 'open-1');
            assert.notEqual(saved.id, 'open-1');
            const armed = server.workflowPuts.at(-1);
            assert.ok(armed, 'the saved record was armed');
            assert.deepEqual(armed.profile.native_shaping, block);
        });
    });

    test('a curve turned off is sent as an empty curve', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const block = { ...SPEC_BLOCK, pump_curve: [] };
            const draft = { ...boot.profileEditor.get().record.profile, native_shaping: block };
            const { sent } = await save(boot, server, draft);
            assert.deepEqual(sent.profile.native_shaping.pump_curve, []);
            assert.equal(server.workflowPuts.at(-1).profile.native_shaping.pump_curve.length, 0);
        });
    });

    test('the block survives a Save of another edit with no shaping edit', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const draft = { ...boot.profileEditor.get().record.profile, target_weight: 40 };
            const { change, sent } = await save(boot, server, draft);
            assert.deepEqual(change.fields.includes('native_shaping'), false);
            assert.deepEqual(sent.profile.native_shaping, SPEC_BLOCK);
            assert.deepEqual(server.workflowPuts.at(-1).profile.native_shaping, SPEC_BLOCK);
        });
    });

    test('the block survives a step edit', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const open = boot.profileEditor.get().record.profile;
            const steps = open.steps.map((step) => ({ ...step, pressure: 8 }));
            const { sent } = await save(boot, server, { ...open, steps });
            assert.equal(sent.profile.steps[0].pressure, 8);
            assert.deepEqual(sent.profile.native_shaping, SPEC_BLOCK);
            assert.deepEqual(server.workflowPuts.at(-1).profile.native_shaping, SPEC_BLOCK);
        });
    });

    test('the block survives the DE1 emulation switch, on and off', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const on = withDe1Emulation(boot.profileEditor.get().record.profile, true);
            const first = await save(boot, server, on);
            assert.equal(first.sent.profile.de1_emulation, true);
            assert.deepEqual(first.sent.profile.native_shaping, SPEC_BLOCK);
            assert.deepEqual(server.workflowPuts.at(-1).profile.native_shaping, SPEC_BLOCK);
            const off = withDe1Emulation(boot.profileEditor.get().record.profile, false);
            const second = await save(boot, server, off);
            assert.equal(second.sent.profile.de1_emulation, false);
            assert.deepEqual(second.sent.profile.native_shaping, SPEC_BLOCK);
        });
    });

    test('the body has the version 2 keys and no ramp_factor', async () => {
        await withEditor(recipe({ native_shaping: SPEC_BLOCK }), async ({ boot, server }) => {
            const draft = { ...boot.profileEditor.get().record.profile, native_shaping: editedBlock() };
            const { sent } = await save(boot, server, draft);
            assert.deepEqual(Object.keys(sent.profile.native_shaping).sort(), [
                'flow_mode', 'flow_ramp_tau', 'flow_tau', 'pressure_filter_tau', 'pressure_mode',
                'pressure_ramp_tau', 'pressure_tau', 'pump_curve', 'version',
            ]);
            assert.equal(Object.hasOwn(server.workflowPuts.at(-1).profile.native_shaping, 'ramp_factor'), false);
        });
    });

    test('a block with the retired ramp_factor is never sent', async () => {
        await withEditor(recipe({ native_shaping: V1_BLOCK }), async ({ boot, server }) => {
            const draft = { ...boot.profileEditor.get().record.profile, target_weight: 40 };
            const { sent } = await save(boot, server, draft);
            assert.equal(sent.profile.target_weight, 40);
            assert.equal(Object.hasOwn(sent.profile, 'native_shaping'), false);
            const armed = server.workflowPuts.at(-1);
            assert.ok(armed, 'the saved record was armed');
            assert.equal(Object.hasOwn(armed.profile, 'native_shaping'), false);
        });
    });

    test('a profile with no block is sent with no block when shaping is not edited', async () => {
        await withEditor(recipe(), async ({ boot, server }) => {
            const draft = { ...boot.profileEditor.get().record.profile, target_weight: 40 };
            const { sent } = await save(boot, server, draft);
            assert.equal(Object.hasOwn(sent.profile, 'native_shaping'), false);
        });
    });
});
