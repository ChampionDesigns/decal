/**
 * live-shot-order-fixture — the Live band's shot arrows, over a shots route that can be
 * told what ORDER to answer in.
 *
 * Built 30 August 2026 for round 4 of the fix campaign, from Ben's report on the tablet:
 * "when I tap the previous shot button it doesn't show the previous but some other shot,
 * like the order is all messed up".
 *
 * WHAT THIS FIXTURE STAGES, AND WHY STAGING IS THE HONEST INSTRUMENT HERE. The arrows walk
 * a page of shots. Whether they walk it in TIME order is a claim about the join between
 * the server's sort and the client's indexing, and the only way to see that join is to
 * hold one side still and move the other. So `/api/v1/shots` below is a faithful small
 * handler — it honours `limit`, `offset` and `order` exactly as `shots_handler.dart`
 * `_getShots` does, clamping `limit` to 1..100 and treating anything that is not `asc` as
 * descending — with ONE addition a real server does not have: `serveOrder(mode)`, which
 * decides the order the page is emitted in. The measured tablet (192.168.1.73, 921 shots,
 * read-only, 30 Aug 2026) answers strict timestamp-descending across all ten pages, so
 * `desc` is the truthful mode and the others are the fault injection.
 *
 * `stale` IS NOT FAULT INJECTION — it is the tablet's own condition. `app-boot.js`
 * `askShots()` reads the page ONCE, at boot, and nothing re-reads it when a shot finishes,
 * so after a pull the window's first row is no longer the newest shot. `landShot()` below
 * reproduces exactly that: a shot arrives at the SERVER after the client has read its page.
 *
 * TIES ARE PART OF THE SUBJECT. Two of the staged shots carry the SAME timestamp, because
 * "next-older" has to be answerable when two shots claim one instant, and because the id is
 * a content hash — ordering by it would be ordering by noise.
 *
 * WHAT IS REAL: `createAppBoot`, `createReaTransport`, the shipping `createShotsStore`,
 * `<live-screen>` and its own `LiveWiring`. Only the fetch is a table, and everything it
 * does not name answers an honest 503 — the shape `live-selector-carry-fixture.js`
 * established for this campaign.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
await import('../../src/screens/live-screen.js');

/* ---------------------------------------------------------------------------
 * The shots this server holds
 * ------------------------------------------------------------------------- */

const PROFILE = {
    version: '2',
    title: 'Order fixture',
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
    id: 'wf-order',
    name: 'Order fixture',
    description: '',
    profile: PROFILE,
    context: { targetYield: 40, targetDoseWeight: 17, grinderSetting: '0.00' },
    steamSettings: { targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0 },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

const shotAt = (name, timestamp) => ({
    id: `shot-${name}`,
    timestamp,
    workflow: { ...WORKFLOW, profile: { ...PROFILE, title: `Shot ${name}` } },
    annotations: { actualDoseWeight: 18 },
    stopReason: 'weight',
});

/**
 * SEVEN SHOTS, NEWEST FIRST, with a deliberate TIE in the middle.
 *
 * `tie-a` and `tie-b` share one instant. In this array `tie-a` comes first, and a stable
 * ordering must keep it first however the server emits the page — which is the whole of
 * "stable across duplicates". Nothing here orders by id: the ids are content hashes on a
 * real machine and their order means nothing.
 */
const BASE_SHOTS = [
    shotAt('t0', '2026-08-29T13:30:00.000'),
    shotAt('t1', '2026-08-29T11:38:00.000'),
    shotAt('tie-a', '2026-08-29T08:40:00.000'),
    shotAt('tie-b', '2026-08-29T08:40:00.000'),
    shotAt('t4', '2026-08-29T08:30:00.000'),
    shotAt('t5', '2026-08-29T08:06:00.000'),
    shotAt('t6', '2026-08-28T07:48:00.000'),
];

/** The server's own list. Mutated only by `landShot`; re-seeded by `reset`. */
let serverShots = BASE_SHOTS.slice();

/** How the page is EMITTED. `desc` is what the measured tablet does. */
let emitMode = 'desc';

/** The orders a test can ask this server to answer in. */
const EMIT = {
    /** Strict timestamp-descending — the tablet's own answer, verified over 921 shots. */
    desc: (list) => list.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0)),
    /** Strict timestamp-ascending. */
    asc: (list) => list.slice().sort((a, b) => (a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0)),
    /**
     * A FIXED SHUFFLE, not a random one: a test that fails intermittently is a test that
     * says nothing. The permutation moves every row off its time-ordered position.
     */
    shuffled: (list) => {
        const desc = EMIT.desc(list);
        const order = [3, 0, 5, 1, 6, 2, 4];
        return order.filter((i) => i < desc.length).map((i) => desc[i]);
    },
    /** Insertion order — oldest first, as a naive `SELECT *` with no ORDER BY answers. */
    insertion: (list) => EMIT.asc(list),
};

/**
 * THE ONE MODE THAT SCRAMBLES THE PAGE INSTEAD OF THE ARCHIVE.
 *
 * The four modes above order the WHOLE archive and the handler then slices it, which is
 * what a server does — so under `asc` the window genuinely holds the OLDEST rows, and no
 * amount of client-side ordering can turn that into the newest ones. That is a wrong
 * WINDOW, not a wrong walk, and it is a server fault the client can only report.
 *
 * `page-shuffled` is the fault the client CAN and MUST fix: the window is the right rows —
 * the handler picked the newest `limit` of them, exactly as `order=desc` asks — and only
 * their order inside the response is wrong. Applied AFTER the slice, for that reason.
 */
const PAGE_SHUFFLE = [3, 0, 5, 1, 6, 2, 4];
const scramblePage = (page) => PAGE_SHUFFLE.filter((i) => i < page.length).map((i) => page[i]);

/* ---------------------------------------------------------------------------
 * The scripted fetch
 * ------------------------------------------------------------------------- */

const calls = [];

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
    calls.push({ method, path: url.pathname, query: url.search, body });

    const kvMatch = /^\/api\/v1\/store\/decal\/(.+)$/.exec(url.pathname);
    if (kvMatch) {
        const name = decodeURIComponent(kvMatch[1]);
        if (method === 'GET') return kv.has(name) ? json(kv.get(name)) : json({ error: 'absent' }, 404);
        if (method === 'POST' || method === 'PUT') { kv.set(name, body); return json({ ok: true }); }
        if (method === 'DELETE') { kv.delete(name); return json({ ok: true }); }
    }

    if (method === 'GET' && url.pathname === '/api/v1/profiles') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/workflow') return json(WORKFLOW);
    if (method === 'GET' && url.pathname === '/api/v1/settings') return json({ stopHotWaterAtWeight: false });
    if (method === 'GET' && url.pathname === '/api/v1/plugins') return json([]);

    if (method === 'GET' && url.pathname === '/api/v1/shots') {
        /* THE HANDLER'S OWN ARITHMETIC (`_getShots` :89-137 at pin 2b047d02): `limit` is
         * clamped 1..100 for the query and ECHOED UNCLAMPED in the body, `offset` is
         * clamped at zero, and anything that is not the literal `asc` is descending. */
        const params = url.searchParams;
        const asked = Number.parseInt(params.get('limit') ?? '20', 10);
        const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 100) : 20;
        const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);
        const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
        const ascending = params.get('order') === 'asc';
        const scramble = emitMode === 'page-shuffled';
        const base = scramble ? 'desc' : emitMode;
        const mode = base === 'desc' && ascending ? 'asc' : base;
        const ordered = EMIT[mode](serverShots);
        const page = ordered.slice(offset, offset + limit);
        return json({
            items: scramble ? scramblePage(page) : page,
            total: serverShots.length,
            limit: Number.isFinite(asked) ? asked : 20,
            offset,
        });
    }

    const shotMatch = /^\/api\/v1\/shots\/(.+)$/.exec(url.pathname);
    if (shotMatch) {
        const id = decodeURIComponent(shotMatch[1]);
        const at = serverShots.findIndex((s) => s.id === id);
        if (at < 0) return json({ error: 'Shot not found' }, 404);
        if (method === 'GET') return json({ ...serverShots[at], measurements: [] });
    }

    return json({ error: 'no recording' }, 503);
};

/** A socket factory that never dials. The arrows need no channel. */
const createSocket = () => ({
    addEventListener() {}, removeEventListener() {}, send() {}, close() {},
    readyState: 3,
});

/* ---------------------------------------------------------------------------
 * The stage
 * ------------------------------------------------------------------------- */

let boot = null;
let screen = null;

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** The row the band is currently about, named by id and by the instant it carries. */
function band() {
    const id = screen?.shotId ?? '';
    const held = serverShots.find((s) => s.id === id) ?? null;
    return {
        id,
        timestamp: held ? held.timestamp : null,
        /* THE PAINTED IDENTITY LINE, so a test can check the pixels agree with the
         * property rather than trusting the property alone. */
        when: screen?.shadowRoot?.querySelector('.shot-when')?.textContent?.trim() ?? null,
    };
}

async function press(id) {
    const control = screen.shadowRoot.getElementById(id);
    if (!control) throw new Error(`live-shot-order-fixture: no control #${id}`);
    control.click();
    await screen.updateComplete;
    await sleep(40);
    await screen.updateComplete;
    return band();
}

const api = {
    /** Which order the shots route answers in. Returns the emitted ids, for the record. */
    serveOrder(mode) {
        if (mode !== 'page-shuffled' && !Object.hasOwn(EMIT, mode)) {
            throw new Error(`live-shot-order-fixture: no emit mode "${mode}"`);
        }
        emitMode = mode;
        const full = EMIT[mode === 'page-shuffled' ? 'desc' : mode](serverShots);
        return (mode === 'page-shuffled' ? scramblePage(full) : full).map((s) => s.id);
    },

    /** Re-seed the server and drop the boot. Called before every mount. */
    reset() {
        serverShots = BASE_SHOTS.slice();
        emitMode = 'desc';
        calls.length = 0;
        kv.clear();
        boot = null;
        screen = null;
        return true;
    },

    /**
     * A SHOT LANDS ON THE SERVER AFTER THE CLIENT HAS READ ITS PAGE — the tablet's own
     * condition, not an injected fault: nothing in `src/` re-reads the shots page once
     * the boot has read it.
     */
    landShot(name, timestamp) {
        serverShots = [shotAt(name, timestamp), ...serverShots];
        return serverShots.length;
    },

    /** Build the boot, read the page the way `askShots()` does, and mount Live. */
    async mount({ limit = 25 } = {}) {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
        });
        /* `askShots()`'s own two reads, by hand — `boot.start()` opens six sockets and
         * routes a screen module, and neither is what the arrows are about. */
        const state = await boot.shotHistory.readPage({ limit, offset: 0 });
        const newest = state.items.length ? state.items[0] : null;
        if (newest && typeof newest.id === 'string') await boot.shotHistory.loadShot(newest.id);

        const stage = document.getElementById('stage');
        stage.replaceChildren();
        screen = document.createElement('live-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        await screen.updateComplete;
        await sleep(40);
        await screen.updateComplete;
        return { rows: state.items.length, total: state.total };
    },

    /**
     * RE-READ THE SAME STORE AT A DIFFERENT PAGE SIZE — what opening the History screen
     * does. `app-boot.js askShots()` reads 25 rows into this store; `history-viewer.js
     * start()` re-reads the same store at its own `HISTORY_PAGE_SIZE`. Both windows
     * therefore exist in one session, and the Live band's index can outlive the wider one.
     */
    async reread(limit) {
        await boot.shotHistory.readPage({ limit, offset: 0 });
        await screen.updateComplete;
        await sleep(30);
        await screen.updateComplete;
        return boot.shotHistory.get().items.length;
    },

    /** The ids the store is holding, in the order the arrows walk them. */
    heldIds() {
        return boot.shotHistory.get().items.map((s) => s.id);
    },

    /** The instants the store is holding, in that same order. */
    heldTimestamps() {
        return boot.shotHistory.get().items.map((s) => s.timestamp);
    },

    /** What the band is about right now. */
    band,

    /** Step one older, through the control a finger presses. */
    stepOlder() { return press('shot-older'); },

    /** Step one newer, through the same route. */
    stepNewer() { return press('shot-newer'); },

    /** Walk the arrows to the end and report every row visited, in order. */
    async walkOlder(times) {
        const seen = [band()];
        for (let i = 0; i < times; i += 1) seen.push(await press('shot-older'));
        return seen;
    },

    async walkNewer(times) {
        const seen = [band()];
        for (let i = 0; i < times; i += 1) seen.push(await press('shot-newer'));
        return seen;
    },

    /** Whether each arrow is live, read off the rendered controls. */
    reach() {
        const older = screen.shadowRoot.getElementById('shot-older');
        const newer = screen.shadowRoot.getElementById('shot-newer');
        return { older: !older.disabled, newer: !newer.disabled };
    },

    /** Every request this boot made, for the record. */
    calls() { return calls.map((c) => `${c.method} ${c.path}${c.query}`); },
};

window.__shotOrder = api;
ready = Promise.resolve(api);

}
