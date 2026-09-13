/**
 * "Edit profile" pressed on Live, against a machine whose recipe is not in the library.
 *
 * Mounts the real app boot, transport, library and profile-editor stores and `<app-root>`
 * over a two-route fetch table (the profile listing and the workflow document), with
 * `probe-screen` standing in for the Live and Editor screens.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { ROUTES } = await import('../../src/lib/app-routes.js');
await import('../../src/components/app-root.js');
await import('./probe-screen.js');

const ACTIVE = {
    version: '1.0',
    title: 'Default',
    notes: 'Default notes',
    author: 'Decent',
    beverage_type: 'espresso',
    steps: [{
        name: 'Free flow',
        pump: 'pressure',
        transition: 'fast',
        exit: null,
        volume: 0,
        seconds: 120,
        weight: 0,
        temperature: 90,
        sensor: 'coffee',
        pressure: 7.5,
        limiter: null,
    }],
    tank_temperature: 0,
    target_weight: 0,
    target_volume: 0,
    target_volume_count_start: 0,
};

const LIBRARY = {
    ...ACTIVE,
    version: '2',
    steps: [1, 2, 3, 4, 5, 6].map((n) => ({
        name: `step ${n}`,
        pump: 'flow',
        transition: 'fast',
        exit: null,
        volume: 0,
        seconds: n + 4,
        weight: 0,
        temperature: 92,
        sensor: 'coffee',
        flow: 2,
        limiter: null,
    })),
};

const RECORD = {
    id: 'profile:librarydefault000000',
    profile: LIBRARY,
    metadataHash: 'meta',
    compoundHash: 'compound',
    parentId: null,
    visibility: 'visible',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { source: 'bundled', filename: 'default.json' },
};

const WORKFLOW = {
    id: 'wf-edit-active',
    name: 'Workflow',
    description: 'Description',
    profile: ACTIVE,
    context: { targetDoseWeight: 18, targetYield: 36 },
    steamSettings: { targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
});

const calls = [];

async function scriptedFetch(url, options = {}) {
    const target = new URL(url);
    const method = (options.method ?? 'GET').toUpperCase();
    calls.push({ method, path: target.pathname });
    if (method === 'GET' && target.pathname === '/api/v1/profiles') return json([RECORD]);
    if (method === 'GET' && target.pathname === '/api/v1/workflow') return json(WORKFLOW);
    return json({ error: 'this fixture has no answer for that path', path: target.pathname }, 503);
}

function fakeSocketFactory() {
    return (url) => ({
        url,
        addEventListener() {},
        removeEventListener() {},
        close() {},
        send() {},
    });
}

const STUB = { tag: 'probe-screen', module: '/test/fixtures/probe-screen.js' };
const TABLE = Object.freeze({
    ...ROUTES,
    live: Object.freeze({ ...ROUTES.live, ...STUB }),
    editor: Object.freeze({ ...ROUTES.editor, ...STUB }),
});

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

let boot = null;
let root = null;

function seated() {
    const record = boot?.profileEditor?.get()?.record ?? null;
    if (!record) return null;
    const profile = record.profile ?? {};
    return {
        id: record.id ?? null,
        parentId: record.parentId ?? null,
        title: profile.title ?? null,
        steps: (profile.steps ?? []).map((step) => ({ name: step.name, seconds: step.seconds })),
    };
}

globalThis.__editIntent = {
    async mount() {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket: fakeSocketFactory(),
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
            importModule: (specifier) => import(specifier),
            routes: TABLE,
        });
        root = document.createElement('app-root');
        root.boot = boot;
        document.getElementById('mount').appendChild(root);
        await root.updateComplete;
        await boot.library.load();
        await root.updateComplete;
        const state = boot.library.get();
        return {
            loadedId: state.loaded.id,
            loadedReason: state.loaded.reason,
            loadedTitle: state.loaded.title,
            records: state.records.length,
        };
    },

    async pressEdit() {
        const screen = root.shadowRoot.querySelector('probe-screen');
        if (!screen) throw new Error('no screen is mounted to press Edit from');
        screen.dispatchEvent(new CustomEvent('header-action', {
            detail: { action: 'Edit profile' }, bubbles: true, composed: true,
        }));
        await sleep(30);
        await root.updateComplete;
        return { route: root.getAttribute('route'), hash: location.hash, seated: seated() };
    },

    seated,
    calls: () => calls.slice(),
};

ready = true;

}
