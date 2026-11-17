export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
await import('../../src/screens/live-screen.js');
await import('../../src/screens/selector-screen.js');
await import('../../src/screens/history-screen.js');

const step = (over = {}) => ({
    name: 'pour', pump: 'pressure', transition: 'fast', exit: null,
    volume: 0, seconds: 30, weight: 0, temperature: 92,
    sensor: 'coffee', pressure: 9, flow: 0, limiter: null, ...over,
});

const profile = (title, over = {}) => ({
    version: '2',
    title,
    notes: '',
    author: 'Decal fixture',
    beverage_type: 'espresso',
    steps: [step()],
    tank_temperature: 0,
    target_weight: 36,
    target_volume: 0,
    target_volume_count_start: 0,
    ...over,
});

const record = (i, body) => ({
    id: `profile:name${String(i).padStart(4, '0')}`,
    profile: body,
    filename: `name-${i}.json`,
    visibility: 'visible',
});

const RECORDS = [
    record(0, profile('Alpha bloom', { de1_emulation: true })),
    record(1, profile('Beta power', { de1_emulation: true, steps: [step(), step({ pump: 'power', power: 4 })] })),
    record(2, profile('Gamma classic')),
];

const WORKFLOW = {
    id: 'wf-name',
    name: 'Name fixture',
    description: '',
    profile: RECORDS[0].profile,
    context: { targetYield: 40, targetDoseWeight: 18, grinderSetting: '0.00' },
    steamSettings: { targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

const SHOTS = [
    {
        id: 'shot-name-emulated',
        timestamp: '2026-08-28T10:15:00.000Z',
        workflow: { ...WORKFLOW, profile: RECORDS[0].profile },
        annotations: { actualDoseWeight: 18, actualYield: 36.4 },
        stopReason: 'weight',
        de1Emulation: true,
    },
    {
        id: 'shot-name-plain',
        timestamp: '2026-08-27T08:02:00.000Z',
        workflow: { ...WORKFLOW, profile: { ...RECORDS[0].profile, title: 'Gamma classic', de1_emulation: true } },
        annotations: { actualDoseWeight: 18, actualYield: 38.1 },
        stopReason: 'weight',
    },
];

const json = (body, status = 200) => new Response(
    body === undefined ? '' : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json' } },
);

const scriptedFetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const url = new URL(href, globalThis.location.href);
    const method = (init.method || 'GET').toUpperCase();
    if (/^\/api\/v1\/store\/decal\//.test(url.pathname)) {
        return method === 'GET' ? json({ error: 'absent' }, 404) : json({ ok: true });
    }
    if (method === 'GET' && url.pathname === '/api/v1/profiles') return json(RECORDS);
    if (method === 'GET' && url.pathname === '/api/v1/workflow') return json(WORKFLOW);
    if (method === 'GET' && url.pathname === '/api/v1/settings') return json({ stopHotWaterAtWeight: false });
    if (method === 'GET' && url.pathname === '/api/v1/plugins') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/shots') {
        return json({ items: SHOTS, total: SHOTS.length, limit: 20, offset: 0 });
    }
    const shotMatch = /^\/api\/v1\/shots\/(.+)$/.exec(url.pathname);
    if (method === 'GET' && shotMatch) {
        const found = SHOTS.find((s) => s.id === decodeURIComponent(shotMatch[1]));
        return found ? json({ ...found, measurements: [] }) : json({ error: 'Shot not found' }, 404);
    }
    return json({ error: 'no recording' }, 503);
};

const createSocket = () => ({
    addEventListener() {}, removeEventListener() {}, send() {}, close() {},
    readyState: 3,
});

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

const TAGS = { live: 'live-screen', selector: 'selector-screen', history: 'history-screen' };

let boot = null;
let screen = null;

function deepText(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
    if (node.nodeType === Node.ELEMENT_NODE && ['STYLE', 'SCRIPT'].includes(node.tagName)) return '';
    let text = '';
    if (node.shadowRoot) text += deepText(node.shadowRoot);
    const children = node.tagName === 'SLOT' ? node.assignedNodes({ flatten: true }) : node.childNodes;
    for (const child of children) text += ` ${deepText(child)}`;
    return text;
}

const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

const api = {
    async mount({ supported = true } = {}) {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
        });
        if (supported !== null) boot.capabilities.de1Emulation = () => supported;
        await boot.library.load();
        await boot.shotHistory.readPage({ limit: 20, offset: 0 });
        await boot.workflow.load();
        return { records: RECORDS.length, shots: boot.shotHistory.get().items.length };
    },

    async show(which, { page = null } = {}) {
        const stage = document.getElementById('stage');
        stage.replaceChildren();
        screen = document.createElement(TAGS[which]);
        screen.boot = boot;
        if (page !== null) screen.page = page;
        stage.appendChild(screen);
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return which;
    },

    async select(id) {
        const row = [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')].find((r) => r.dataset.id === id);
        row?.click();
        await sleep(60);
        await screen.updateComplete;
        return Boolean(row);
    },

    selectorRows() {
        return [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')]
            .filter((row) => row.dataset.id)
            .map((row) => ({ id: row.dataset.id, text: squash(row.textContent) }));
    },

    detailTitle() {
        return squash(screen.shadowRoot.getElementById('detail-title')?.textContent);
    },

    liveName() {
        return squash(screen.shadowRoot.getElementById('profile-name')?.textContent);
    },

    shotList() {
        const data = screen.shadowRoot.querySelector('history-data-page');
        const grid = data?.shadowRoot?.getElementById('shot-list') ?? null;
        return squash(deepText(grid));
    },

    pickerOptions() {
        return [...screen.shadowRoot.querySelectorAll('ui-select')]
            .map((select) => (select.options ?? []).map((option) => option.label));
    },

    pageText() {
        return squash(deepText(screen));
    },
};

window.__names = api;
ready = Promise.resolve(true);

}
