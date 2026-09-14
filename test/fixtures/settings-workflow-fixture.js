/**
 * settings-workflow-fixture — a real boot and a settings model over a server that holds
 * one workflow document.
 *
 * The boot is `createAppBoot`, the model is `settingsModelFor(boot)`, and only the server
 * and the socket are faked. It lives under test/fixtures because it needs the mount
 * document's importmap.
 */
export let ready;

if (typeof window !== 'undefined') {

const [{ createAppBoot }, { settingsModelFor, settingsBespokeFor }] = await Promise.all([
    import('../../src/lib/app-boot.js'),
    import('../../src/screens/settings-model.js'),
]);

const STARTING = () => ({
    profile: { id: 'p1', title: 'Fixture', steps: [] },
    context: { targetDoseWeight: 18, targetYield: 36 },
    steamSettings: { targetTemperature: 150, flow: 0.8, duration: 30, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 90, duration: 20, volume: 100 },
    rinseData: { targetTemperature: 90, flow: 6, duration: 5 },
});

let workflow = STARTING();
let refuse = false;

function mergeInto(target, patch) {
    for (const [key, value] of Object.entries(patch)) {
        const into = target[key];
        if (value && typeof value === 'object' && !Array.isArray(value)
            && into && typeof into === 'object' && !Array.isArray(into)) {
            mergeInto(into, value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

const answer = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body ?? null),
    json: async () => body ?? null,
});

const calls = [];

const fetchImpl = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    calls.push(`${method} ${path}`);
    if (path === '/api/v1/workflow' && method === 'GET') return answer(200, workflow);
    if (path === '/api/v1/workflow' && method === 'PUT') {
        if (refuse) return answer(503, { error: 'the fixture was told to refuse this' });
        mergeInto(workflow, JSON.parse(options.body));
        return answer(200, workflow);
    }

    return answer(503, { error: 'not part of this case' });
};

const createSocket = () => ({
    addEventListener() {}, removeEventListener() {}, close() {}, send() {},
});

const boot = createAppBoot({
    fetch: fetchImpl,
    createSocket,
    location: { hostname: '127.0.0.1', protocol: 'http:' },
});
const model = settingsModelFor(boot);
const bespoke = settingsBespokeFor(boot);

const rowFor = (leafId, field) => {
    const view = model.rows(leafId).find((row) => row.row.field === field);
    return view ? view.row : null;
};

globalThis.__wf = {
    boot: () => boot,

    sharesStore: () => bespoke.workflow === boot.workflow,

    async openLeaf(leafId) {
        await model.load(leafId);
        return true;
    },

    async stage(leafId, field, value) {
        const row = rowFor(leafId, field);
        if (!row) return { ok: false, reason: 'no row' };
        return model.set(row, value);
    },

    async commit() { return model.commit(); },

    async railPress(key, value) {
        await boot.workflow.setTarget(key, value);
        return boot.workflow.targets();
    },

    railTargets: () => boot.workflow.targets(),

    settingsValue: (field) => model.machineValue(field),
    changeCount: () => model.changeCount,

    served: () => JSON.parse(JSON.stringify(workflow)),
    refuse(on = true) { refuse = Boolean(on); },
    calls: () => [...calls],
    async reset() {
        workflow = STARTING();
        refuse = false;
        calls.length = 0;
        model.discard();
        await boot.workflow.refresh();
        await model.loadMachine();
        return true;
    },
};

ready = Promise.resolve(true);

}
