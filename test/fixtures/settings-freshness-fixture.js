export let ready;

if (typeof HTMLElement !== 'undefined') {

const [{ createAppBoot }, { FEED }] = await Promise.all([
    import('../../src/lib/app-boot.js'),
    import('../../src/stores/live-stores.js'),
]);
await import('../../src/screens/settings-screen.js');

const WORKFLOW = {
    profile: { id: 'p1', title: 'Fixture', steps: [] },
    context: { targetDoseWeight: 18, targetYield: 36 },
    steamSettings: { targetTemperature: 150, flow: 0.8, duration: 30, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 90, duration: 20, volume: 100 },
    rinseData: { targetTemperature: 90, flow: 6, duration: 5 },
};

const answer = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body ?? null),
    json: async () => body ?? null,
});

const fetchImpl = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    if (path === '/api/v1/workflow' && method === 'GET') return answer(200, WORKFLOW);
    if (path.includes('/store/')) return answer(200, null);
    return answer(503, { error: 'not part of this case' });
};

const sockets = [];
const createSocket = (url) => {
    const listeners = new Map();
    const socket = {
        url,
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        close() { socket.emit('close', {}); },
        send() {},
        emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
    };
    sockets.push(socket);
    return socket;
};
const socketFor = (needle) => sockets.find((s) => String(s.url).includes(needle)) ?? null;

let now = 1_000_000;
const tickers = [];

const boot = createAppBoot({
    fetch: fetchImpl,
    createSocket,
    location: { hostname: '127.0.0.1', protocol: 'http:' },
    clock: () => now,
    repeat: (fn) => {
        tickers.push(fn);
        return () => {
            const at = tickers.indexOf(fn);
            if (at >= 0) tickers.splice(at, 1);
        };
    },
});

await boot.start();

const stage = document.getElementById('stage') ?? document.body;
const screen = document.createElement('settings-screen');
screen.boot = boot;
screen.setAttribute('category-id', 'machine');
screen.setAttribute('leaf-id', 'machine-steam');
stage.appendChild(screen);

async function settle() {
    await screen.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await screen.updateComplete;
    const leaf = screen.shadowRoot.getElementById('leaf');
    await leaf?.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

await settle();

globalThis.__freshness = {

    async frame(patch) {
        socketFor('/ws/v1/machine/snapshot')?.emit('message', {
            data: JSON.stringify({
                state: 'idle', substate: 'ready', profileFrame: 0, timestamp: 1,
                targetGroupTemperature: 92, groupTemperature: 90, mixTemperature: 90,
                targetMixTemperature: 92, targetGroupFlow: 0, groupFlow: 0,
                targetGroupPressure: 0, groupPressure: 0,
                ...patch,
            }),
        });
        await settle();
        return true;
    },

    async quietFor(ms) {
        now += ms;
        for (const tick of [...tickers]) tick();
        await settle();
        return true;
    },

    async closeSocket() {
        socketFor('/ws/v1/machine/snapshot')?.close();
        await settle();
        return true;
    },

    tickers: () => tickers.length,

    feedStatus: () => boot.live.feed(FEED.MACHINE).get().status,

    async selectLeaf(leafId) {
        screen.setAttribute('leaf-id', leafId);
        await settle();
        return true;
    },

    readingOf(rowId) {
        const leaf = screen.shadowRoot.getElementById('leaf');
        const row = leaf?.shadowRoot?.querySelector(`ui-settings-row[data-row="${rowId}"]`);
        if (!row) return null;
        return {
            text: row.readingText,
            printed: row.shadowRoot?.getElementById('reading')?.textContent?.trim() ?? null,
            dash: row.dash,
        };
    },

    settle,
};

ready = Promise.resolve(true);

}
