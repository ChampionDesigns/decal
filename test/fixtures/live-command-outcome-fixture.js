/**
 * live-command-outcome-fixture — the Live screen over a machine that says no: every
 * ending a machine command or a tare can have, against the shipped path. Only the fetch
 * and the sockets are doubles, and the scale is a real feed because tare confirmation is
 * a question about frames.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { WS_CHANNELS } = await import('../../src/data/rea-ws-channels.js');
await import('../../src/screens/live-screen.js');

const PROFILE = {
    version: '2',
    title: 'Extractamundo Dos!',
    notes: '',
    author: 'Decal fixture',
    beverage_type: 'espresso',
    steps: [{
        name: 'pour', pump: 'pressure', transition: 'fast', exit: null,
        volume: 0, seconds: 30, weight: 0, temperature: 92,
        sensor: 'coffee', flow: 0, limiter: null,
    }],
    tank_temperature: 0,
    target_weight: 36,
    target_volume: 0,
    target_volume_count_start: 0,
};

const WORKFLOW = {
    id: 'wf-command',
    name: 'Command outcome fixture',
    description: '',
    profile: PROFILE,
    context: { targetYield: 36, targetDoseWeight: 17, grinderSetting: '5.50' },
    steamSettings: { targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

/** `MachineInfo.toJson` with the one key the GHC gate reads. `GHC: false` draws the strip. */
const MACHINE_INFO = { name: 'Fixture DE1', GHC: false, firmware: '1.0', serial: 'FIXTURE' };

/**
 * How the next state request and the next tare are answered: a function per route, so a
 * rejected fetch and a request that never answers are failures the test can stage too.
 */
let stateAnswer = null;
let tareAnswer = null;

/** Every command the server was asked for, as `{state}`, in order. */
const commands = [];
const tares = [];

const json = (body, status = 200) => new Response(
    body === undefined ? '' : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json' } },
);

/** ReaPrime's own refusal body on this route. */
const BLOCK_NO_SCALE = {
    details: 'No scale detected, blocking espresso request', type: 'block_no_scale',
};

const kv = new Map();

const scriptedFetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const url = new URL(href, globalThis.location.href);
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    if (typeof init.body === 'string' && init.body !== '') {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
    }

    const kvMatch = /^\/api\/v1\/store\/[^/]+\/(.+)$/.exec(url.pathname);
    if (kvMatch) {
        const name = decodeURIComponent(kvMatch[1]);
        if (method === 'GET') return kv.has(name) ? json(kv.get(name)) : json({ error: 'absent' }, 404);
        if (method === 'POST' || method === 'PUT') { kv.set(name, body); return json({ ok: true }); }
        if (method === 'DELETE') { kv.delete(name); return json({ ok: true }); }
    }

    const stateMatch = /^\/api\/v1\/machine\/state\/(.+)$/.exec(url.pathname);
    if (stateMatch && method === 'PUT') {
        const state = decodeURIComponent(stateMatch[1]);
        commands.push({ state });
        return stateAnswer ? stateAnswer(state) : json(null);
    }

    if (url.pathname === '/api/v1/scale/tare' && method === 'PUT') {
        tares.push({ at: Date.now() });
        return tareAnswer ? tareAnswer() : json(null);
    }

    if (method === 'GET' && url.pathname === '/api/v1/machine/info') return json(MACHINE_INFO);
    if (method === 'GET' && url.pathname === '/api/v1/machine/capabilities') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/profiles') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/plugins') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/settings') return json({ stopHotWaterAtWeight: false });
    if (method === 'GET' && url.pathname === '/api/v1/workflow') return json(WORKFLOW);
    if (method === 'GET' && url.pathname === '/api/v1/shots') {
        return json({ items: [], total: 0, limit: 20, offset: 0 });
    }

    return json({ error: 'no recording' }, 503);
};

const dialled = new Map();

const createSocket = (url) => {
    const listeners = new Map();
    const socket = {
        url,
        readyState: 1,
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        send() {},
        close() {},
        emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
    };
    dialled.set(new URL(url, globalThis.location.href).pathname, socket);
    return socket;
};

const channel = (name) => dialled.get(WS_CHANNELS[name].path) ?? null;

const push = (name, frame) => {
    const socket = channel(name);
    if (!socket) throw new Error(`live-command-outcome: the ${name} channel was never dialled`);
    socket.emit('open', {});
    socket.emit('message', { data: JSON.stringify(frame) });
};

/** A `/ws/v1/machine/snapshot` frame, every key the handler writes. */
const snapshot = (state, { weight = 0, pressure = 0, flow = 0 } = {}) => ({
    timestamp: new Date().toISOString(),
    state: { state, substate: state === 'idle' ? 'ready' : 'pouring' },
    flow,
    pressure,
    targetFlow: 0,
    targetPressure: 0,
    mixTemperature: 92,
    groupTemperature: 92,
    targetMixTemperature: 92,
    targetGroupTemperature: 92,
    profileFrame: 0,
    steamTemperature: 150,
    weight,
    weightFlow: 0,
});

let boot = null;
let screen = null;

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

async function settled(ms = 120) {
    await screen.updateComplete;
    await sleep(ms);
    await screen.updateComplete;
}

const shadow = (selector) => screen.shadowRoot.querySelector(selector);
const text = (selector) => shadow(selector)?.textContent?.trim() ?? null;

/** Everything the notices column is saying, as strings a person could read off the glass. */
const notices = () => ({
    note: text('#command-note'),
    outcome: shadow('#command-note')?.dataset?.outcome
        ?? shadow('#command-error')?.dataset?.outcome ?? null,
    error: text('#command-error'),
    kind: shadow('#command-error')?.dataset?.kind ?? null,
    retry: shadow('#command-retry') !== null,
    refusal: shadow('live-refusal')?.getAttribute('kind') ?? null,
    tare: text('#tare-note') ?? text('#tare-error'),
    tareStatus: shadow('#tare-note')?.dataset?.status
        ?? shadow('#tare-error')?.dataset?.status ?? null,
    tareRetry: shadow('#tare-retry') !== null,
});

const readings = () => Array.from(screen.shadowRoot.querySelectorAll('.gauges ui-stat-tile'))
    .map((tile) => ({ label: tile.getAttribute('label'), value: tile.getAttribute('value') }));

const api = {
    reset() {
        stateAnswer = null;
        tareAnswer = null;
        commands.length = 0;
        tares.length = 0;
        kv.clear();
        dialled.clear();
        boot = null;
        screen = null;
        return true;
    },

    /** Build the boot, open its feeds and mount Live on it. */
    async mount() {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
            importModule: async () => ({}),
            wait: async () => {},
        });
        await boot.start();
        const stage = document.getElementById('stage');
        stage.replaceChildren();
        screen = document.createElement('live-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        push('machineSnapshot', snapshot('idle'));
        await settled(160);
        return { ghc: screen.ghc, machineState: screen.machineState };
    },

    refuseCommands() { stateAnswer = () => json(BLOCK_NO_SCALE, 400); return true; },

    /** Answer every state request with a status. */
    failCommands(status = 503) { stateAnswer = () => json({ error: 'busy' }, status); return true; },

    /** The network is not there: the fetch itself rejects. */
    dropNetwork() {
        stateAnswer = () => { throw new TypeError('Failed to fetch'); };
        return true;
    },

    /** The request never answers; the store's own timeout ends it. */
    hangCommands() { stateAnswer = () => new Promise(() => {}); return true; },

    acceptCommands() { stateAnswer = null; return true; },

    refuseTare(details = 'Tare blocked: a shot is in progress') {
        tareAnswer = () => json({ details, type: 'block_tare_during_shot' }, 400);
        return true;
    },
    failTare(status = 500) { tareAnswer = () => json({ error: 'no scale' }, status); return true; },
    acceptTare() { tareAnswer = null; return true; },

    /** Press a machine-strip key by its id, on the rendered `<ui-button>`. */
    async pressKey(id, { wait = 220 } = {}) {
        const button = shadow(`.ghc-strip ui-button[data-key="${id}"]`);
        if (!button) throw new Error(`live-command-outcome: no machine key "${id}" is drawn`);
        button.click();
        await settled(wait);
        return notices();
    },

    async pressStop({ wait = 220 } = {}) {
        const stop = shadow('.ghc-strip ui-stop-button') ?? shadow('ui-stop-button');
        if (!stop) throw new Error('live-command-outcome: there is no stop button to press');
        stop.shadowRoot.querySelector('button').click();
        await settled(wait);
        return notices();
    },

    /** The wake, as the shell sends it: the screen is not in that path at all. */
    async wake({ wait = 220 } = {}) {
        await boot.machineState.request('idle');
        await settled(wait);
        return notices();
    },

    async typeKey(key, { wait = 200 } = {}) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await settled(wait);
        return { commands: commands.map((call) => call.state), notices: notices() };
    },

    /**
     * Type a key while a dialog-owned control has the focus. The target is the focused
     * button inside the open keypad, which is what the typing guard sees.
     */
    async typeKeyInKeypad(key, { wait = 200 } = {}) {
        const pad = shadow('ui-numeric-keypad');
        if (!pad) throw new Error('live-command-outcome: the keypad is not open');
        const digit = pad.shadowRoot.querySelector('button');
        digit.focus();
        digit.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
        await settled(wait);
        return { commands: commands.map((call) => call.state), padOpen: shadow('ui-numeric-keypad') !== null };
    },

    /** Open the rail's numeric keypad on one setting, through the stepper's readout button. */
    async openKeypad(key = 'drinkWeight') {
        const stepper = shadow(`ui-stepper[data-key="${key}"]`);
        if (!stepper) throw new Error(`live-command-outcome: no rail row "${key}"`);
        const readout = stepper.shadowRoot.getElementById('value');
        if (!readout) throw new Error(`live-command-outcome: rail row "${key}" is not editable`);
        readout.click();
        await settled(120);
        return { open: shadow('ui-numeric-keypad') !== null, modalOpen: screen.modalOpen };
    },

    async closeKeypad() {
        const pad = shadow('ui-numeric-keypad');
        if (pad) pad.dispatchEvent(new CustomEvent('open-change', { detail: { open: false }, bubbles: true, composed: true }));
        await settled(120);
        return { open: shadow('ui-numeric-keypad') !== null, modalOpen: screen.modalOpen };
    },

    async pressTare({ wait = 260 } = {}) {
        const tile = shadow('.gauges ui-stat-tile[data-press="tare"]');
        if (!tile) throw new Error('live-command-outcome: the weight tile is not drawn');
        tile.click();
        await settled(wait);
        return notices();
    },

    async retry(which = 'command', { wait = 220 } = {}) {
        const button = shadow(which === 'tare' ? '#tare-retry' : '#command-retry');
        if (!button) throw new Error(`live-command-outcome: no ${which} retry is offered`);
        button.click();
        await settled(wait);
        return { notices: notices(), commands: commands.map((call) => call.state), tares: tares.length };
    },

    async dismiss(which = 'command', { wait = 160 } = {}) {
        const button = shadow(which === 'tare' ? '#tare-dismiss' : '#command-dismiss');
        if (!button) throw new Error(`live-command-outcome: no ${which} dismissal is offered`);
        button.shadowRoot.querySelector('button').click();
        await settled(wait);
        return notices();
    },

    async pushMachine(state, channels = {}) {
        push('machineSnapshot', snapshot(state, channels));
        await settled(120);
        return { machineState: screen.machineState, notices: notices() };
    },

    async pushScale(weight, { wait = 60 } = {}) {
        push('scaleSnapshot', {
            timestamp: new Date().toISOString(),
            weight,
            weightFlow: 0,
            battery: 90,
            timerValue: 0,
        });
        await sleep(wait);
        return true;
    },

    notices,
    readings,
    commandsSeen() { return commands.map((call) => call.state); },
    taresSeen() { return tares.length; },
    /** The store's own record, so a case can say the surface and the record agree. */
    record() { return { ...boot.machineState.get() }; },
    tareRecord() { const held = boot.scaleTare.get(); return { status: held.status, weight: held.weight }; },
    modalOpen() { return screen.modalOpen === true; },
};

window.__command = api;
ready = Promise.resolve(api);

}
