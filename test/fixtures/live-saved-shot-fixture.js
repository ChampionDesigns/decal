/**
 * live-saved-shot-fixture — the Live screen after a shot, over a server that persists a
 * shot the way ReaPrime does: the frame first, the record afterwards. `pullShot` decides
 * how many looks at the list the record takes to appear.
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
    id: 'wf-saved',
    name: 'Saved shot fixture',
    description: '',
    profile: PROFILE,
    context: { targetYield: 40, targetDoseWeight: 17, grinderSetting: '5.50' },
    steamSettings: { targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

let armedTitle = PROFILE.title;

/** A pouring sample in the recorded shape, as `measurements[n]` of a stored shot. */
const sample = (index) => ({
    machine: {
        timestamp: new Date(Date.UTC(2026, 8, 9, 8, 0, index)).toISOString(),
        state: { state: 'espresso', substate: 'pouring' },
        flow: 2.1,
        pressure: 6 + index * 0.1,
        targetFlow: 2.4,
        targetPressure: 6,
        mixTemperature: 92,
        groupTemperature: 92,
        targetMixTemperature: 92,
        targetGroupTemperature: 92,
        profileFrame: 1,
        steamTemperature: 150,
        weight: index * 2,
        weightFlow: 1.9,
    },
    scale: null,
    volume: index * 2,
});

const MEASUREMENTS = Array.from({ length: 12 }, (unused, index) => sample(index));

const shotRecord = (id, timestamp, title) => ({
    id,
    timestamp,
    measurements: MEASUREMENTS,
    workflow: { ...WORKFLOW, profile: { ...PROFILE, title } },
    annotations: { actualDoseWeight: 17 },
    stopReason: 'weight',
});

/** The list row: the record without its measurements. */
const rowOf = (record) => {
    const { measurements, ...row } = record;
    return row;
};

const OLD_SHOT = shotRecord('shot-old', '2026-09-09T07:48:00.000', 'Extractamundo Dos!');
const OLDER_SHOT = shotRecord('shot-older', '2026-09-09T07:20:00.000', 'Lever Classic demo');

let stored = [OLD_SHOT, OLDER_SHOT];
let pendingShot = null;
let landAfter = 1;
let pageReads = 0;
/** Every annotation write the server received, as `{id, body}`. */
const writes = [];
/** Whether the server refuses an annotation write. A refused write is still recorded. */
let writesRefused = false;

const json = (body, status = 200) => new Response(
    body === undefined ? '' : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json' } },
);

const kv = new Map();

const scriptedFetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const url = new URL(href, globalThis.location.href);
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    if (typeof init.body === 'string' && init.body !== '') {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
    }

    const kvMatch = /^\/api\/v1\/store\/decal\/(.+)$/.exec(url.pathname);
    if (kvMatch) {
        const name = decodeURIComponent(kvMatch[1]);
        if (method === 'GET') return kv.has(name) ? json(kv.get(name)) : json({ error: 'absent' }, 404);
        if (method === 'POST' || method === 'PUT') { kv.set(name, body); return json({ ok: true }); }
        if (method === 'DELETE') { kv.delete(name); return json({ ok: true }); }
    }

    if (method === 'GET' && url.pathname === '/api/v1/profiles') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/plugins') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/settings') return json({ stopHotWaterAtWeight: false });
    if (method === 'GET' && url.pathname === '/api/v1/workflow') {
        return json({ ...WORKFLOW, profile: { ...PROFILE, title: armedTitle } });
    }

    if (method === 'GET' && url.pathname === '/api/v1/shots') {
        pageReads += 1;
        if (pendingShot && pageReads > landAfter) {
            stored = [pendingShot, ...stored];
            pendingShot = null;
        }
        const params = url.searchParams;
        const asked = Number.parseInt(params.get('limit') ?? '20', 10);
        const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 100) : 20;
        const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);
        const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
        return json({
            items: stored.slice(offset, offset + limit).map(rowOf),
            total: stored.length,
            limit: Number.isFinite(asked) ? asked : 20,
            offset,
        });
    }

    const shotMatch = /^\/api\/v1\/shots\/(.+)$/.exec(url.pathname);
    if (shotMatch) {
        const id = decodeURIComponent(shotMatch[1]);
        const at = stored.findIndex((shot) => shot.id === id);
        if (at < 0) return json({ error: 'Shot not found' }, 404);
        if (method === 'GET') return json(stored[at]);
        if (method === 'PUT') {
            writes.push({ id, body });
            if (writesRefused) return json({ error: 'the machine refused the write' }, 500);
            const merged = {
                ...stored[at],
                annotations: { ...(stored[at].annotations || {}), ...(body?.annotations || {}) },
            };
            stored = stored.map((shot, index) => (index === at ? merged : shot));
            return json(merged);
        }
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

/** A `/ws/v1/machine/shotState` frame, every key written. */
const shotStateFrame = (state, shotId) => ({
    event: 'state',
    timestamp: new Date().toISOString(),
    shotId,
    state,
    machineState: state === 'idle' ? 'idle' : 'espresso',
    machineSubstate: state === 'idle' ? 'ready' : 'pouring',
    profileFrame: 1,
    scaleConnected: false,
    scaleLost: false,
    machineHasAutonomousSAW: false,
    decision: null,
});

const push = (name, frame) => {
    const socket = channel(name);
    if (!socket) throw new Error(`live-saved-shot: the ${name} channel was never dialled`);
    socket.emit('open', {});
    socket.emit('message', { data: JSON.stringify(frame) });
};

let boot = null;
let screen = null;

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

async function settled(ms = 120) {
    await screen.updateComplete;
    await sleep(ms);
    await screen.updateComplete;
}

const shadow = (selector) => screen.shadowRoot.querySelector(selector);

const api = {
    reset() {
        stored = [OLD_SHOT, OLDER_SHOT];
        pendingShot = null;
        landAfter = 1;
        pageReads = 0;
        writes.length = 0;
        writesRefused = false;
        armedTitle = PROFILE.title;
        kv.clear();
        dialled.clear();
        boot = null;
        screen = null;
        return true;
    },

    /**
     * Build the boot, open its feeds and mount Live. `instantRetry` spends the shell's
     * whole re-read window at once, leaving the number of asks where it is.
     */
    async mount({ instantRetry = false } = {}) {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
            importModule: async () => ({}),
            ...(instantRetry ? { wait: async () => {} } : {}),
        });
        await boot.start();
        const stage = document.getElementById('stage');
        stage.replaceChildren();
        screen = document.createElement('live-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        await settled(160);
        return { shotId: screen.shotId, rows: boot.shotHistory.get().items.length };
    },

    /** Remove the screen and mount a new one on the same shell, as a route change does. */
    async remount() {
        const stage = document.getElementById('stage');
        stage.replaceChildren();
        await sleep(60);
        screen = document.createElement('live-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        await settled(160);
        return { shotId: screen.shotId, saving: screen.shotSaving };
    },

    refuseWrites(on = true) {
        writesRefused = Boolean(on);
        return writesRefused;
    },

    /** What the sheet shows: whether it is open, the editor's text and dirty flag, any refusal. */
    notesSheet() {
        const editor = shadow('#notes-editor');
        const refusal = shadow('#notes-refusal');
        return {
            open: shadow('#notes-sheet') !== null,
            text: editor ? editor.text : null,
            dirty: editor ? editor.dirty : null,
            refusal: refusal ? refusal.textContent.trim() : '',
        };
    },

    emptyHistory() {
        stored = [];
        return true;
    },

    /** Arm a profile title on the workflow document. Returns the name the screen shows. */
    async armProfile(title) {
        armedTitle = title;
        await boot.workflow.refresh();
        await settled(60);
        return screen.profileName;
    },

    /**
     * Pull a shot: the samples, the frame that ends it, then the record. `landAfter` is
     * how many looks at the list the record takes to appear.
     */
    async pullShot({ id, title, landAfter: after = 1, samples = 12 } = {}) {
        landAfter = after;
        push('shotState', shotStateFrame('preheating', id));
        for (let index = 0; index < samples; index += 1) {
            push('machineSnapshot', sample(index).machine);
        }
        push('shotState', shotStateFrame('pouring', id));
        for (let index = 0; index < samples; index += 1) {
            push('machineSnapshot', sample(index).machine);
        }
        await settled(60);
        pendingShot = shotRecord(id, new Date().toISOString(), title ?? armedTitle);
        push('shotState', shotStateFrame('finished', id));
        push('machineSnapshot', {
            timestamp: new Date().toISOString(),
            state: { state: 'idle', substate: 'ready' },
            flow: 0,
            pressure: 0,
            mixTemperature: 92,
            groupTemperature: 92,
            steamTemperature: 150,
            weight: 36,
            weightFlow: 0,
        });
        await settled(200);
        return { shotId: screen.shotId, saving: screen.shotSaving };
    },

    async startShot({ id, samples = 12 } = {}) {
        push('shotState', shotStateFrame('pouring', id));
        for (let index = 0; index < samples; index += 1) {
            push('machineSnapshot', sample(index).machine);
        }
        await settled(80);
        return { shotId: screen.shotId };
    },

    /** Ask the list again the way the retry does. Returns the ids the store holds. */
    async letItLand(times = 3) {
        for (let i = 0; i < times; i += 1) {
            await boot.shotHistory.readPage({ limit: 25, offset: 0 });
            await settled(40);
        }
        return boot.shotHistory.get().items.map((shot) => shot.id);
    },

    /** What the band is about right now, as the screen holds it. */
    band() {
        const control = shadow('ui-rating-control');
        return {
            shotId: screen.shotId,
            saving: screen.shotSaving,
            rating: screen.rating,
            hasRatingControl: control !== null,
            waitingLine: shadow('.rating-waiting')?.textContent?.trim() ?? null,
            unsavedLine: shadow('.rating-unsaved')?.textContent?.trim() ?? null,
            when: shadow('.shot-when')?.textContent?.trim() ?? null,
            profile: shadow('.shot-profile')?.textContent?.trim() ?? null,
            armed: shadow('#profile-name')?.textContent?.trim() ?? null,
        };
    },

    heldIds() { return boot.shotHistory.get().items.map((shot) => shot.id); },

    saved() { return boot.savedShot.get(); },

    /** Rate the shot through the control. Returns every annotation write the server has seen. */
    async rate(score) {
        const control = shadow('ui-rating-control');
        if (!control) throw new Error('live-saved-shot: there is no rating control to press');
        control.shadowRoot.getElementById('rate').click();
        await control.updateComplete;
        const slider = control.shadowRoot.getElementById('slider');
        const range = slider.shadowRoot.querySelector('input[type="range"]');
        range.value = String(score);
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
        await settled(120);
        return writes.map((write) => ({ id: write.id, enjoyment: write.body?.annotations?.enjoyment ?? null }));
    },

    /** Write a note through the sheet. Returns the identity block's text and every write seen. */
    async note(text) {
        const control = shadow('ui-rating-control');
        if (!control) throw new Error('live-saved-shot: there is no rating control to open notes from');
        control.shadowRoot.getElementById('notes').click();
        await settled(100);
        const identity = shadow('#notes-identity .shot-profile')?.textContent?.trim() ?? null;
        const editor = shadow('#notes-editor');
        if (!editor) throw new Error('live-saved-shot: the sheet offers no editor');
        await editor.ready;
        editor.editor.codemirror.focus();
        editor.editor.codemirror.replaceSelection(text);
        await settled(100);
        shadow('#notes-save').click();
        await settled(140);
        return {
            identity,
            writes: writes.map((write) => ({
                id: write.id,
                notes: write.body?.annotations?.espressoNotes ?? null,
            })),
        };
    },

    /** Press Save again on the open sheet. Returns every annotation write the server has seen. */
    async saveNote() {
        const save = shadow('#notes-save');
        if (!save) throw new Error('live-saved-shot: the sheet offers no Save');
        save.click();
        await settled(140);
        return writes.map((write) => ({
            id: write.id,
            notes: write.body?.annotations?.espressoNotes ?? null,
        }));
    },

    async stepOlder() {
        shadow('#shot-older').click();
        await settled(80);
        return api.band();
    },

    /** Whether each arrow is live. */
    reach() {
        return {
            older: !shadow('#shot-older').disabled,
            newer: !shadow('#shot-newer').disabled,
        };
    },

    /** Open the full-screen chart and read the one line in its header. */
    async expand() {
        shadow('ui-chart-card').shadowRoot.querySelector('.well').click();
        await settled(120);
        const overlay = shadow('live-expanded-chart');
        return {
            open: overlay.open,
            identity: overlay.shadowRoot.getElementById('identity')?.textContent?.trim() ?? null,
            profileName: overlay.profileName,
            shotId: overlay.derivation ? overlay.derivation.shotId : null,
            samples: overlay.derivation && overlay.derivation.ok
                ? overlay.derivation.counts.inShot : 0,
        };
    },

    async collapse() {
        const overlay = shadow('live-expanded-chart');
        overlay.shadowRoot.getElementById('back').click();
        await settled(60);
        return overlay.open;
    },
};

window.__savedShot = api;
ready = Promise.resolve(api);

}
