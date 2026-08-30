/**
 * app-shell-fixture — the rendering subject for the application shell (wave 5.1,
 * `live-app-shell`).
 *
 * WHAT IT DRIVES THE SHELL WITH, and why each choice is the honest one:
 *
 * THE REST MOCK, WITHOUT A SECOND PROCESS. `tools/mock_rea.py` answers from
 * `tools/rea-fixtures/`, keyed by the request path with `/` -> `__` and `?`/`&` -> `~`
 * (`mock_rea.py` `_key`), on the fixed port 8080 the capture battery reuses. A rendering
 * suite cannot start it: it is a Python process, the port is shared with whatever battery
 * run is in flight, and wave 3 recorded browser/port contention as an intermittency
 * hazard. So this fixture serves THE SAME CORPUS through the harness's own static server,
 * with the same key function — the recordings are the mock's, byte for byte, and the only
 * thing left behind is the process. A path with no recording answers 503 with the mock's
 * own sentence ("this instrument has no recording of that page"), because a MISS IS AN
 * ANSWER and the shell must survive it: there is no `machine/capabilities` recording in
 * the corpus today, and the shell booting anyway is the point of the test, not an
 * accident of it.
 *
 * THE SOCKETS ARE FAKE AND THAT IS DOCUMENTED, NOT PAPERED OVER. Nothing in this tree can
 * push a WebSocket frame at the stores — `mock_rea.py` speaks no WebSocket at all, and the
 * nine `ws__*.json` fixtures are each 226 bytes of the 404 HTML page ReaPrime answers when
 * a socket path is fetched over plain HTTP (waves/0b/REPORT.md:255-261: "Gate B rule 4 is
 * closed for REST and open for sockets"). The factory here records what was dialled and
 * lets the test push a frame in, which is enough to prove the shell OPENS the six channels
 * and MIRRORS the connection feed. It is not a claim that a real socket behaves this way.
 *
 * THE SCREEN MODULES ARE REAL. `importModule` is the browser's own dynamic import through
 * `index.html`'s importmap, so the Live route loads `src/screens/live-screen.js` exactly
 * as it will in the app. Only when a test asks for the failure paths is it replaced.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { ROUTES } = await import('../../src/lib/app-routes.js');
const { createThemeController } = await import('../../src/lib/theme.js');
await import('../../src/components/app-root.js');

/* ---------------------------------------------------------------------------
 * WINDOW LISTENER ACCOUNTING — installed before any shell exists, so the shell's
 * own hashchange listener is inside the count. This is bug S10's measurement:
 * "a second call would duplicate every resize listener".
 * ------------------------------------------------------------------------- */

const listenerLedger = new Map();
const realAdd = window.addEventListener.bind(window);
const realRemove = window.removeEventListener.bind(window);
window.addEventListener = function counted(type, ...rest) {
    listenerLedger.set(type, (listenerLedger.get(type) ?? 0) + 1);
    return realAdd(type, ...rest);
};
window.removeEventListener = function counted(type, ...rest) {
    listenerLedger.set(type, (listenerLedger.get(type) ?? 0) - 1);
    return realRemove(type, ...rest);
};

/* ---------------------------------------------------------------------------
 * The mock's corpus, through the harness's static server
 * ------------------------------------------------------------------------- */

/** `mock_rea.py`'s `_key`, transcribed. One rule, two languages. */
function fixtureKey(pathWithQuery) {
    const safe = pathWithQuery.replace(/^\/+|\/+$/g, '').replace(/\//g, '__').replace(/\?/g, '~').replace(/&/g, '~');
    return `${(safe || 'root').slice(0, 180)}.json`;
}

const calls = [];

async function mockFetch(url, options = {}) {
    const target = new URL(url);
    const pathWithQuery = `${target.pathname}${target.search}`;
    calls.push({ path: pathWithQuery, method: options.method ?? 'GET' });

    const response = await fetch(`${location.origin}/tools/rea-fixtures/${fixtureKey(pathWithQuery)}`, {
        method: 'GET',
        cache: 'no-store',
    });
    if (response.ok) return response;

    /* The mock's own miss. 503 rather than 404 because that is what `mock_rea.py`
     * answers, and a screen that behaves differently against the instrument than
     * against the recording is a screen tested against the wrong thing. */
    return new Response(
        JSON.stringify({ error: 'this instrument has no recording of that page', path: pathWithQuery }),
        { status: 503, headers: { 'content-type': 'application/json' } },
    );
}

/* ---------------------------------------------------------------------------
 * The socket factory
 * ------------------------------------------------------------------------- */

const sockets = [];

function fakeSocketFactory() {
    return (url) => {
        const listeners = new Map();
        const socket = {
            url,
            closed: false,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
            close() { this.closed = true; },
            send() {},
            emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
            listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
        };
        sockets.push(socket);
        return socket;
    };
}

/**
 * The minimum `/ws/v1/machine/snapshot` frame `readMachineSnapshot` accepts.
 *
 * `state` is overwritten per push; the rest is a resting machine. Nothing here is a
 * range or a reading a screen asserts on — it exists so the FEED has something to
 * publish, which is what the screensaver reads.
 */
const MACHINE_FRAME = {
    timestamp: '2026-08-24T00:00:00.000Z',
    /* A NESTED BLOCK, and it is the shape `readMachineSnapshot` reads: the name lives at
     * `frame.state.state`, not at `frame.state`. A flat frame reads as a machine that
     * reported no state at all — which is a legal answer and therefore silent. */
    state: { state: 'idle', substate: 'idle' },
};

/**
 * The minimum `/ws/v1/display` frame `readDisplayFrame` accepts.
 *
 * COPIED FROM THE BENCH TABLET rather than invented: this is the shape its live
 * `/ws/v1/display` socket was publishing on 28 August 2026, brightness values and all,
 * read over CDP while a black saver was up. The two brightness fields differ in general —
 * `requestedBrightness` is what somebody asked for and `brightness` is what ReaPrime
 * applied after its low-battery cap — and they are both here so a reader can see that the
 * distinction exists.
 */
const DISPLAY_FRAME = {
    wakeLockEnabled: true,
    wakeLockOverride: false,
    brightness: 100,
    requestedBrightness: 100,
    lowBatteryBrightnessActive: false,
    platformSupported: { brightness: true, wakeLock: true },
};

/** The minimum `/ws/v1/devices` frame `readDevicesFrame` accepts (B8's own shape). */
const DEVICES_FRAME = {
    devices: [],
    scanning: false,
    connectionStatus: { phase: 'connecting', foundMachines: [], foundScales: [], pendingAmbiguity: null },
};

/* ---------------------------------------------------------------------------
 * The harness surface
 * ------------------------------------------------------------------------- */

/** The route table the fixture uses: the shipping one plus a second screen to swap to. */
const TABLE = Object.freeze({
    ...ROUTES,
    probe: Object.freeze({
        id: 'probe',
        tag: 'probe-screen',
        module: '/test/fixtures/probe-screen.js',
        label: 'Probe',
    }),
});

let boot = null;
let root = null;
let gate = null;

globalThis.__shell = {
    DEVICES_FRAME,

    /**
     * Build a boot, put an `<app-root>` on the page with it, and wait for the shell to
     * settle. The boot is assigned BEFORE the element is connected, which is the seam the
     * element documents: a shell that built its own would reach for `window` instead.
     *
     * @param {object} [options]
     * @param {'real'|'blocked'|'failing'} [options.screens]  how screen modules load
     */
    async mount({ screens = 'real', backends = null } = {}) {
        const importModule = screens === 'real'
            ? (specifier) => import(specifier)
            : screens === 'failing'
                ? async () => { throw new Error('the screen module could not be fetched'); }
                : (specifier) => new Promise((resolve, reject) => {
                    gate = { resolve: () => resolve(import(specifier)), reject };
                });

        boot = createAppBoot({
            fetch: mockFetch,
            createSocket: fakeSocketFactory(),
            location: { hostname: '127.0.0.1', protocol: 'http:' },
            importModule,
            routes: TABLE,
            /* A CASE MAY BRING ITS OWN STORED PREFERENCES. The display size is put back at
             * boot like the theme is, and a shell with nothing stored cannot show that. */
            ...(backends ? { backends } : null),
        });

        root = document.createElement('app-root');
        root.boot = boot;
        document.getElementById('mount').appendChild(root);
        await root.updateComplete;
        return globalThis.__shell.state();
    },

    /** Let a blocked screen module through, and wait for the shell to settle on it. */
    async releaseScreen(timeoutMs = 15000) {
        gate?.resolve();
        gate = null;
        const started = performance.now();
        while (globalThis.__shell.screenTag() === null && performance.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 5));
            await root.updateComplete;
        }
        await root.updateComplete;
        return globalThis.__shell.state();
    },

    /**
     * Change route the way the app does: through the address.
     *
     * The deadline is generous ON PURPOSE. A route swap loads a module, and this suite
     * runs beside every other rendering suite in the tree — wave 3 recorded browser
     * contention as an intermittency hazard, and a poll loop tuned to an idle machine is
     * how a real assertion becomes a flaky one. Waiting longer costs nothing when the
     * swap is fast, which it is.
     */
    async goto(id, timeoutMs = 15000) {
        const before = globalThis.__shell.screenTag();
        const started = performance.now();
        location.hash = `#/${id}`;
        while (globalThis.__shell.screenTag() === before && performance.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 5));
        }
        await root.updateComplete;
        return globalThis.__shell.state();
    },

    /**
     * Push one machine snapshot into the MACHINE feed.
     *
     * THE FEED, NOT THE ELEMENT. The screensaver test used to set
     * `saver.machineState` by hand, which proves the component reacts and proves nothing
     * about whether the shell FEEDS it — and that is exactly the half that was broken
     * from the day the saver was mounted: `render()` returned three separate templates,
     * so Lit rebuilt the element on every phase change and the shell's one-shot attach
     * stayed bound to the element from the phase before. Driving the socket is the only
     * way a test can tell the two apart.
     */
    pushMachineFrame(state = 'sleeping') {
        const socket = sockets.find((s) => s.url.endsWith('/ws/v1/machine/snapshot'));
        if (!socket) throw new Error('the machine snapshot socket was never dialled');
        socket.emit('open', {});
        socket.emit('message', {
            data: JSON.stringify({ ...MACHINE_FRAME, state: { ...MACHINE_FRAME.state, state } }),
        });
        return state;
    },

    /**
     * Push one `/ws/v1/display` frame into the display feed.
     *
     * ADDED 28 AUGUST 2026, and the reason is a hole this file's own comment above
     * describes for the machine socket: the screensaver's PANEL half reads
     * `readDisplayFrame(frame).platformSupported.brightness`, and with no way to push a
     * display frame `brightnessSupported` stayed FALSE for the whole of every shell test.
     * That is not a neutral default — `#applyDisplay()` returns early on an absent
     * capability, so EVERY assertion of the form "no dim was sent" passed in this file
     * whether the component would have sent one or not. A test that cannot fail is not
     * evidence, and the 28 August saver bug is exactly a wrong dim.
     *
     * THE DEFAULT SAYS THE PLATFORM CAN, because that is what the bench tablet says: its
     * live `/ws/v1/display` frame carries `platformSupported: {brightness: true,
     * wakeLock: true}` (read over CDP, 28 Aug). A test that wants the other answer passes
     * it — an absent capability has its own test and it needs to be asked for.
     */
    pushDisplayFrame(frame = DISPLAY_FRAME) {
        const socket = sockets.find((s) => s.url.endsWith('/ws/v1/display'));
        if (!socket) throw new Error('the display socket was never dialled');
        socket.emit('open', {});
        socket.emit('message', { data: JSON.stringify(frame) });
        return frame;
    },

    /** Push one devices frame into the connection feed. */
    pushDevicesFrame(frame = DEVICES_FRAME) {
        const socket = sockets.find((s) => s.url.endsWith('/ws/v1/devices'));
        if (!socket) throw new Error('the devices socket was never dialled');
        socket.emit('open', {});
        socket.emit('message', { data: JSON.stringify(frame) });
        return boot.state.connection;
    },

    /** Everything a test wants to assert on, in one round trip. */
    state() {
        const screen = root?.shadowRoot?.querySelector('live-screen, probe-screen') ?? null;
        return {
            phase: root?.getAttribute('phase') ?? null,
            route: root?.getAttribute('route') ?? null,
            ariaBusy: root?.getAttribute('aria-busy') ?? null,
            screenTag: screen ? screen.tagName.toLowerCase() : null,
            screenCount: root?.shadowRoot?.querySelectorAll('live-screen, probe-screen').length ?? 0,
            bootPhase: boot?.state.phase ?? null,
            connection: boot?.state.connection ?? null,
            capabilities: boot?.state.capabilities ?? null,
            capabilityStatus: boot?.capabilities.state.status ?? null,
            capabilityEntries: boot?.capabilities.state.entries ?? null,
            offersCupWarmer: boot?.capabilities.offers('cupWarmer') ?? null,
            watchers: boot?.watchers() ?? null,
            attachments: boot?.attachments() ?? null,
            sockets: sockets.map((s) => s.url),
            probe: { connects: globalThis.__probe?.connects ?? 0, disconnects: globalThis.__probe?.disconnects ?? 0 },
            hashListeners: listenerLedger.get('hashchange') ?? 0,
        };
    },

    screenTag() {
        const screen = root?.shadowRoot?.querySelector('live-screen, probe-screen') ?? null;
        return screen ? screen.tagName.toLowerCase() : null;
    },

    /** Every REST call the shell made, in order. */
    calls() { return calls.slice(); },

    /**
     * Wait for the boot to have SETTLED — `ready` or `error`. The screen module is
     * loaded asynchronously, so `mount()` returning is not the same event as the screen
     * being on screen, and a test that conflated the two would be a flaky test that
     * passed on a fast machine.
     */
    async settled(timeoutMs = 15000) {
        const started = performance.now();
        while (boot && boot.state.phase === 'connecting' && performance.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 5));
        }
        await root.updateComplete;
        return globalThis.__shell.state();
    },

    /** Settled, AND the capability read has answered — whatever it answered. */
    async capabilitiesSettled() {
        await globalThis.__shell.settled();
        await boot.capabilitiesSettled();
        await root.updateComplete;
        return globalThis.__shell.state();
    },

    /** A theme controller on the real document root — the shell's own mechanism, driven
     *  by hand so a test can prove the store-driven switch after the pre-paint stamp. */
    theme(options = {}) {
        return createThemeController({ root: document.documentElement, ...options });
    },

    /** Take the shell off the page. Everything it added must go with it. */
    async teardown() {
        root?.remove();
        await new Promise((r) => requestAnimationFrame(r));
        const after = globalThis.__shell.state();
        boot?.destroy();
        boot = null;
        root = null;
        return { hashListeners: listenerLedger.get('hashchange') ?? 0, ...after };
    },
};

ready = true;

}
