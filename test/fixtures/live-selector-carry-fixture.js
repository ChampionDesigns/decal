/**
 * live-selector-carry-fixture — the Live rail's favourite hold-menu and the selector it
 * sends you to, on ONE real boot, driven end to end.
 *
 * Built for the fix campaign, cluster L: findings **F-027** (the "Clear
 * button" that did nothing), **F-025 / F-001** (the held slot never carried into the
 * selector) and **F-022 / F-026** (the two preset banks' hold menus). All four are faults
 * of the JOIN between two screens and a store, so a fixture that mounts one screen with a
 * hand-written double cannot see them: the whole point of F-001 is that every part worked
 * and the trip between them did not.
 *
 * WHAT IS REAL HERE, which is nearly everything: `createAppBoot`, `createReaTransport`,
 * `createProfileLibraryStore`, `createStorageRouter` over real memory backends,
 * `profile-rules.js`, `<live-screen>` with its own `LiveWiring` controller, and
 * `<selector-screen>`. The two screens share ONE boot, exactly as `<app-root>` gives them
 * one, because "the slot survived the trip" is a claim about state held between them.
 *
 * TWO THINGS ARE SUBSTITUTED, and both are stated here rather than discovered later:
 *
 * 1. THE FETCH IS A TABLE, with no server behind it. Every route this pair touches is
 *    answered from `ANSWERS` below and anything else is an honest 503 — which is what a
 *    tablet with half a ReaPrime looks like, and what the router and the stores are
 *    written to absorb. The transport itself is the shipping one, so the request LOG this
 *    fixture reports is the real thing on the wire: method, path and parsed body.
 * 2. NOTHING IS SUBSTITUTED IN THE STORAGE STACK, and that is deliberate. `createAppBoot`
 *    defaults `local` and `session` to memory and points `kv` at `createReaKvBackend` over
 *    the injected fetch, so `pendingAssignmentIndex` (a `session` row) is real memory and
 *    `favouriteProfiles` (a `kv` row) is a real POST to `/api/v1/store/decal/…` that the
 *    table above stores and serves back. The carry crosses two layers and both are the
 *    shipping ones; a test that injected a memory `kv` could not tell a write that reached
 *    the wire from one that did not, which is the whole of F-027's evidence.
 *
 * THE SCREENS ARE SWAPPED, NOT BOTH MOUNTED. `show('live')` and `show('selector')` put one
 * element in the stage and take the other out, so a listener left behind by a disconnect
 * would show up here as a doubled request rather than as nothing.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
await import('../../src/screens/live-screen.js');
await import('../../src/screens/selector-screen.js');

/* ---------------------------------------------------------------------------
 * The listing
 * ------------------------------------------------------------------------- */

/**
 * Six records, so the rail's five slots auto-populate and one profile is left OFF the
 * rail — which is the profile every assignment test picks, because assigning one that is
 * already on a slot is refused by the store's own duplicate guard.
 *
 * The shape is `ProfileRecord.toJson`'s, trimmed to the fields the adapter reads. One
 * step apiece: nothing here is about a profile's body.
 */
const TITLES = [
    'Alpha bloom', 'Beta ristretto', 'Baseline classic',
    'Baseline high contact', 'Delta turbo', 'Epsilon lever',
];

const RECORDS = TITLES.map((title, i) => ({
    id: `profile:carry${String(i).padStart(4, '0')}`,
    profile: {
        version: '2',
        title,
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
    },
    filename: `carry-${i}.json`,
    visibility: 'visible',
}));

/** The profile that is NOT on the rail — six records, five slots. */
const OFF_RAIL = RECORDS[5];

const WORKFLOW = {
    id: 'wf-carry',
    name: 'Carry fixture',
    description: '',
    profile: RECORDS[0].profile,
    /* THE FIELD NAMES ARE `workflow-targets.js`'s, not invented: `drinkWeight` reads
     * `context.targetYield` and `dose` reads `context.targetDoseWeight`. A context with
     * plausible-looking wrong names produces a rail of dashes and a suite that cannot tell
     * "the control did nothing" from "the fixture said nothing". */
    context: { targetYield: 40, targetDoseWeight: 17, grinderSetting: '0.00' },
    steamSettings: {
        targetTemperature: 155, duration: 45, flow: 2.1, stopAtTemperature: 0,
    },
    hotWaterData: { targetTemperature: 98, volume: 240, duration: 30 },
    rinseData: { targetTemperature: 90, flow: 4, duration: 5 },
};

/** The workflow document as the server now holds it — every PUT merges into this. */
let workflow = WORKFLOW;

/**
 * TWO STORED SHOTS, so the band has something to name and the arrows have somewhere to go.
 *
 * The NEWEST carries an `espressoNotes` annotation and no rating; the older carries
 * neither. That pair is what the notes sheet's two faces need (F-029) and what a rating
 * write needs a clean the previous skin for (F-023). The shape is
 * `ShotRecord.toJsonWithoutMeasurements`: id, timestamp, workflow, annotations, and the
 * legacy `shotNotes` shadow the handler keeps in step with the annotation.
 */
const SHOT_NOTE = 'Ethiopia Guji, 18 g in.\nTasted like apricot; pull again one step finer.';

const shots = [
    {
        id: 'shot-carry-newest',
        timestamp: '2026-08-28T10:15:00.000Z',
        workflow: { ...WORKFLOW, profile: { ...RECORDS[0].profile, title: 'Alpha bloom' } },
        annotations: { espressoNotes: SHOT_NOTE, actualDoseWeight: 18 },
        shotNotes: SHOT_NOTE,
        stopReason: 'weight',
    },
    {
        id: 'shot-carry-older',
        timestamp: '2026-08-27T08:02:00.000Z',
        workflow: { ...WORKFLOW, profile: { ...RECORDS[1].profile, title: 'Beta ristretto' } },
        annotations: {},
        stopReason: 'weight',
    },
];

/** The note the newest shot carries, so no test types it twice. */
const SHOT_NOTE_TEXT = SHOT_NOTE;

/* ---------------------------------------------------------------------------
 * The scripted fetch — a table, and an honest 503 for everything else
 * ------------------------------------------------------------------------- */

const calls = [];
const overrides = new Map();
const key = (method, pathname) => `${String(method).toUpperCase()} ${pathname}`;

/** The KV documents this boot has been told about, by logical key. */
const kv = new Map();

const json = (body, status = 200) => new Response(
    body === undefined ? '' : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json' } },
);

const scriptedFetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const url = new URL(href, globalThis.location.href);
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    if (typeof init.body === 'string' && init.body !== '') {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
    }
    calls.push({ method, path: url.pathname, query: url.search, body });

    const override = overrides.get(key(method, url.pathname));
    if (override) return json(override.body, override.status);

    /* The KV store, kept here so a write can be READ BACK — which is what every
     * "still so after a reload" proof in an earlier run actually asks for. */
    const kvMatch = /^\/api\/v1\/store\/decal\/(.+)$/.exec(url.pathname);
    if (kvMatch) {
        const name = decodeURIComponent(kvMatch[1]);
        if (method === 'GET') {
            return kv.has(name) ? json(kv.get(name)) : json({ error: 'absent' }, 404);
        }
        if (method === 'POST' || method === 'PUT') { kv.set(name, body); return json({ ok: true }); }
        if (method === 'DELETE') { kv.delete(name); return json({ ok: true }); }
    }

    if (method === 'GET' && url.pathname === '/api/v1/profiles') return json(RECORDS);
    if (method === 'GET' && url.pathname === '/api/v1/workflow') return json(workflow);
    if (method === 'PUT' && url.pathname === '/api/v1/workflow') {
        /* THE HANDLER MERGES AND ANSWERS THE MERGED DOCUMENT, and this has to as well or
         * every rail write LOOKS like it was refused: the store re-reads its answer, so a
         * fixture that echoed the original constant would hand the old number straight
         * back and the screen would repaint the value the press had just changed. Two
         * levels is what the rail's patches reach (`{context:{…}}`,
         * `{steamSettings:{…}}`). */
        if (body && typeof body === 'object') {
            for (const [block, patch] of Object.entries(body)) {
                workflow = (patch && typeof patch === 'object' && !Array.isArray(patch))
                    ? { ...workflow, [block]: { ...(workflow[block] || {}), ...patch } }
                    : { ...workflow, [block]: patch };
            }
        }
        return json(workflow);
    }
    if (method === 'POST' && url.pathname === '/api/v1/machine/profile') return json(null);
    if (method === 'GET' && url.pathname === '/api/v1/settings') return json({ stopHotWaterAtWeight: false });
    if (method === 'GET' && url.pathname === '/api/v1/plugins') return json([]);
    if (method === 'GET' && url.pathname === '/api/v1/shots') {
        return json({ items: shots, total: shots.length, limit: 20, offset: 0 });
    }
    const shotMatch = /^\/api\/v1\/shots\/(.+)$/.exec(url.pathname);
    if (shotMatch) {
        const id = decodeURIComponent(shotMatch[1]);
        const at = shots.findIndex((s) => s.id === id);
        if (at < 0) return json({ error: 'Shot not found' }, 404);
        if (method === 'GET') return json({ ...shots[at], measurements: [] });
        if (method === 'PUT') {
            /* THE HANDLER DEEP-MERGES AND THIS DOES TOO, for the one level the skin's
             * only patch reaches — `{annotations:{…}}`. A shallow merge here would let a
             * patch that drops every other annotation pass, which is the exact hazard
             * `putShotsById`'s own gate row is about. */
            const held = shots[at];
            const patched = { ...held, ...body };
            if (body && typeof body.annotations === 'object' && body.annotations !== null) {
                patched.annotations = { ...(held.annotations || {}), ...body.annotations };
            }
            shots[at] = patched;
            return json({ ...patched, measurements: [] });
        }
    }

    /* : an absence is an absence. Nothing here invents a route. */
    return json({ error: 'no recording' }, 503);
};

/** A socket factory that never dials. Neither screen needs a channel to prove a carry. */
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

/** Press and hold a cell, the way a finger does: down, wait past the threshold, up. */
async function pressHold(cell, ms = 750) {
    const box = cell.getBoundingClientRect();
    const at = (type) => new PointerEvent(type, {
        bubbles: true, composed: true, cancelable: true, pointerId: 1, button: 0,
        clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
    });
    cell.dispatchEvent(at('pointerdown'));
    await sleep(ms);
    cell.dispatchEvent(at('pointerup'));
}

const api = {
    /**
     * Put a document in the KV store BEFORE a boot reads it — the read-only leg every
     * "what does a stored document draw" question needs. `null` deletes.
     */
    seedKv(name, value) {
        if (value === null) kv.delete(name); else kv.set(name, value);
        return true;
    },

    /** Build the boot and mount the Live screen on it. */
    async mount({ loadWorkflow = false } = {}) {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port: '8080' },
        });
        /* THE TWO READS `boot.start()` MAKES THAT THIS PAIR OF SCREENS DRAWS FROM, made
         * by hand because `start()` is not called here: it opens six sockets and loads a
         * screen module through the route table, and neither is what any of this is
         * about. The boot OBJECT is what the screens take. */
        await boot.library.load();
        await boot.shotHistory.readPage({ limit: 20, offset: 0 });
        if (loadWorkflow) await boot.workflow.load();
        await api.show('live');
        return {
            records: RECORDS.length,
            favourites: boot.library.favouriteEntries().length,
            shots: boot.shotHistory.get().items.length,
        };
    },

    /** Swap the stage to one screen, sharing the one boot. */
    async show(which) {
        const stage = document.getElementById('stage');
        stage.replaceChildren();
        screen = document.createElement(which === 'live' ? 'live-screen' : 'selector-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        await screen.updateComplete;
        await sleep(30);
        await screen.updateComplete;
        return which;
    },

    /** The route the shell takes when a screen asks for the library. */
    armLibraryOpen() {
        const seen = [];
        screen.addEventListener('library-open', () => seen.push(Date.now()));
        api._libraryOpen = seen;
        return true;
    },

    libraryOpens() { return (api._libraryOpen || []).length; },

    /* ---- the Live rail ------------------------------------------------- */

    /** The five favourite cells, as the rail draws them. */
    favourites() {
        return (screen.favourites || []).map((slot) => (slot ? slot.name : null));
    },

    /** Hold favourite cell `i` (0-based on the strip; slot i+1 on the glass). */
    async holdFavourite(i) {
        const bank = screen.shadowRoot.querySelector('ui-favourites-bank');
        const cell = bank.shadowRoot.querySelector('ui-bank').shadowRoot.querySelectorAll('.item')[i];
        await pressHold(cell);
        await screen.updateComplete;
        const menu = screen.shadowRoot.getElementById('hold-menu');
        return {
            open: menu.open,
            items: (menu.items || []).map((item) => (item.separator ? '---' : item.id)),
            /* THE WORDS, NOT ONLY THE IDS (round 2, decisions). An id is what the
             * screen routes on and a label is what a person reads; the two renames of 29
             * August changed only the second, so a suite that reads ids alone cannot see
             * them at all. `holdPreset` below has reported both since it was written. */
            labels: (menu.items || []).map((item) => (item.separator ? '---' : item.label)),
        };
    },

    /** Hold cell `i` of a preset bank, named by its rail key. */
    async holdPreset(railKey, i) {
        const bank = screen.shadowRoot.querySelector(`ui-preset-bank[data-key="${railKey}"]`);
        const cell = bank.shadowRoot.querySelector('ui-bank').shadowRoot.querySelectorAll('.item')[i];
        await pressHold(cell);
        await screen.updateComplete;
        const menu = screen.shadowRoot.getElementById('hold-menu');
        return {
            open: menu.open,
            items: (menu.items || []).map((item) => (item.separator ? '---' : item.id)),
            labels: (menu.items || []).map((item) => (item.separator ? '---' : item.label)),
        };
    },

    /**
     * PUT THE MACHINE IN A STATE, down the road the dimming owner actually reads.
     *
     * Added for F-038. The one thing the fix needs a fixture to do that
     * this one could not: `<live-screen>`'s `dim` attribute is written by `LiveWiring`
     * from `liveDim(dimStateFor(machineState, machineFeedStatus))`, so the honest way to
     * stage a live shot is to put a frame on the MACHINE FEED and let the controller
     * publish the answer — not to set `dim` by hand, which would prove the paint against a
     * state the app never produces.
     *
     * IT SETS `machineState` TOO, exactly as `live-gates-fixture.js` does and for the
     * reason recorded there: the wiring writes the same property from the same feed, so
     * this is belt and braces rather than a second source of truth — and the rail
     * recomposes by mode from the property.
     *
     * The frame carries `state` and nothing else, which is `rea-address.js` rule 2 (an
     * omitted channel is a gated absence; an invented temperature would be a lie).
     */
    async pushMachineState(state, substate = 'pouring') {
        /* `accept(frame)`, NOT a hand-set state object. This fixture holds the SHIPPING
         * feed store (`live-gates-fixture.js` builds its own fakes, which is why its
         * `pushMachineState` can write a value straight in), and the shipping store's only
         * way in is a frame read through the address layer — which is the road a real
         * socket message takes. */
        boot.live.feed('machineSnapshot').accept({ state: { state, substate } });
        if (screen) screen.machineState = state;
        await screen?.updateComplete;
        await sleep(40);
        await screen?.updateComplete;
        return screen ? screen.getAttribute('dim') : null;
    },

    /** Tap cell `i` of a preset bank — the plain press, not the hold. */
    async tapPreset(railKey, i) {
        const bank = screen.shadowRoot.querySelector(`ui-preset-bank[data-key="${railKey}"]`);
        const cell = bank.shadowRoot.querySelector('ui-bank').shadowRoot.querySelectorAll('.item')[i];
        cell.click();
        await screen.updateComplete;
        await sleep(30);
        return true;
    },

    /** Which cell of a bank is drawn as the armed one, by index, or null. */
    markedCell(railKey) {
        const bank = screen.shadowRoot.querySelector(`ui-preset-bank[data-key="${railKey}"]`);
        const inner = bank.shadowRoot.querySelector('ui-bank');
        const cells = [...inner.shadowRoot.querySelectorAll('.item')];
        const at = cells.findIndex((cell) => cell.getAttribute('aria-pressed') === 'true'
            || cell.hasAttribute('data-selected') || cell.classList.contains('selected'));
        return at < 0 ? null : at;
    },

    /** The four numbers a bank prints, in order. */
    bankCells(railKey) {
        const bank = screen.shadowRoot.querySelector(`ui-preset-bank[data-key="${railKey}"]`);
        const inner = bank.shadowRoot.querySelector('ui-bank');
        return [...inner.shadowRoot.querySelectorAll('.item')].map((el) => el.textContent.trim());
    },

    /** Press a hold-menu item BY ID — a separator is an item and is not a `.item`. */
    async serveSteplessProfile() {
        workflow = { ...workflow, profile: { ...workflow.profile, steps: [] } };
        await boot.workflow.refresh();
        await screen.updateComplete;
        await sleep(40);
        await screen.updateComplete;
        return { steps: workflow.profile.steps.length };
    },
    rail(railKey) {
        const stepper = screen.shadowRoot.querySelector(`ui-stepper[data-key="${railKey}"]`);
        if (!stepper) return null;
        return {
            held: screen.targets ? screen.targets[railKey] ?? null : null,
            value: stepper.value,
            disabled: stepper.disabled,
            drawn: (stepper.shadowRoot.querySelector('.value, #value, output')?.textContent ?? '').trim(),
        };
    },
    async pressRail(railKey) {
        const stepper = screen.shadowRoot.querySelector(`ui-stepper[data-key="${railKey}"]`);
        stepper.shadowRoot.getElementById('increment').click();
        const atOnce = screen.targets ? screen.targets[railKey] ?? null : null;
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return { atOnce, rail: api.rail(railKey), puts: api.workflowPuts() };
    },
    async reportRailStep(railKey, value) {
        const stepper = screen.shadowRoot.querySelector(`ui-stepper[data-key="${railKey}"]`);
        stepper.dispatchEvent(new CustomEvent('change', {
            detail: { value }, bubbles: true, composed: true,
        }));
        const atOnce = screen.targets ? screen.targets[railKey] ?? null : null;
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return { atOnce, rail: api.rail(railKey), puts: api.workflowPuts() };
    },
    workflowPuts() {
        return calls
            .filter((call) => call.method === 'PUT' && call.path === '/api/v1/workflow')
            .map((call) => call.body);
    },
    async pressMenuItem(id) {
        const menu = screen.shadowRoot.getElementById('hold-menu');
        const item = (menu.items || []).find((row) => row.id === id);
        if (!item) return { pressed: false, offered: (menu.items || []).map((r) => r.id ?? '---') };
        const row = [...menu.shadowRoot.querySelectorAll('.item')]
            .find((el) => el.textContent.trim() === item.label);
        row.click();
        await screen.updateComplete;
        await sleep(30);
        return { pressed: true };
    },

    /* ---- the keypad, which both the rail and the hold menu open --------- */

    keypad() {
        const pad = screen.shadowRoot.querySelector('ui-numeric-keypad');
        return pad ? { open: !!pad.open, heading: pad.heading ?? '', value: String(pad.value ?? '') } : null;
    },

    /** Type a number into the open keypad and confirm it. */
    async keypadConfirm(text) {
        const pad = screen.shadowRoot.querySelector('ui-numeric-keypad');
        pad.value = String(text);
        pad.dispatchEvent(new CustomEvent('confirm', {
            detail: { value: Number(text), limitKey: pad.limitKey ?? '' },
            bubbles: true, composed: true,
        }));
        await screen.updateComplete;
        await sleep(30);
        return true;
    },

    /* ---- the selector --------------------------------------------------- */

    /** The id of the record that is deliberately NOT on the rail. */
    offRailId() { return OFF_RAIL.id; },
    offRailTitle() { return OFF_RAIL.profile.title; },

    /** How many profile rows the listing is showing, and the first few titles. */
    listing() {
        const rows = [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')];
        return {
            count: rows.length,
            titles: rows.map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim()),
        };
    },

    /**
     * Type into the filter one character at a time, reading the listing after EVERY one.
     *
     * The keystroke is delivered to the inner `input` and then the native composed `input`
     * event is raised on it, which is what a keyboard does; nothing here dispatches the
     * field's own `search`, because the whole question is what happens WITHOUT Enter.
     */
    async typeFilter(text) {
        const field = screen.shadowRoot.getElementById('filter');
        const inner = field.shadowRoot.querySelector('ui-text-field');
        const input = inner.shadowRoot.querySelector('input');
        const perKeystroke = [];
        for (let i = 1; i <= text.length; i += 1) {
            input.value = text.slice(0, i);
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            await screen.updateComplete;
            perKeystroke.push(api.listing().count);
        }
        return { perKeystroke, field: field.value, query: screen._query };
    },

    /** Press Enter in the filter — the route that used to be the ONLY one. */
    async submitFilter() {
        const field = screen.shadowRoot.getElementById('filter');
        const inner = field.shadowRoot.querySelector('ui-text-field');
        const input = inner.shadowRoot.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', bubbles: true, composed: true,
        }));
        await screen.updateComplete;
        return api.listing().count;
    },

    /**
     * The overflow trigger on one row, as the F-016 probe measured it: the plan's own
     * name cascade is aria-label → aria-labelledby → label → title → visible text, and
     * this reports the two attributes that decide the first and last of those.
     */
    rowTrigger(id) {
        const row = screen.shadowRoot.getElementById(`opt-${id}`);
        const span = row?.querySelector('ui-menu > span[slot="trigger"]');
        if (!span) return null;
        return {
            label: span.getAttribute('aria-label'),
            hidden: span.getAttribute('aria-hidden'),
            role: span.getAttribute('role'),
            tabindex: span.getAttribute('tabindex'),
            glyphHidden: span.querySelector('[aria-hidden="true"]') !== null,
        };
    },

    /** Press the overflow trigger and report what the menu offered. */
    async pressRowTrigger(id) {
        const row = screen.shadowRoot.getElementById(`opt-${id}`);
        const menu = row.querySelector('ui-menu');
        const span = menu.querySelector('span[slot="trigger"]');
        span.click();
        await screen.updateComplete;
        await sleep(30);
        return { open: !!menu.open, items: (menu.items || []).map((i) => i.id ?? '---') };
    },

    /** Pick a row in the listing by record id. */
    async selectRow(id) {
        const row = screen.shadowRoot.getElementById(`opt-${id}`);
        if (!row) return { picked: false };
        row.click();
        await screen.updateComplete;
        await sleep(30);
        return { picked: true, selected: screen.store.get().selectedId };
    },

    /** Which row the picker currently holds, or null. */
    selectedId() { return screen.store.get().selectedId ?? null; },

    /** Press the selector's own Confirm. */
    async confirm() {
        const button = screen.shadowRoot.getElementById('confirm');
        button.click();
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return true;
    },

    /** Leave the selector the way Back does — disconnect it without confirming. */
    async leave() {
        return api.show('live');
    },

    /** Where the screen asked to go, if it asked. */
    armNavigate() {
        const seen = [];
        screen.addEventListener('navigate', (e) => seen.push(e.detail?.route ?? null));
        api._navigate = seen;
        return true;
    },

    navigations() { return [...(api._navigate || [])]; },

    /* ---- what was written, and where ------------------------------------ */

    /** Read one logical key back through the app's OWN router. */
    async stored(logicalKey) {
        const held = await boot.storage.get(logicalKey);
        return held === undefined ? null : held;
    },

    /** The favourite assignments as the store holds them: slot index -> id. */
    assignments() { return { ...boot.library.get().favourites.assignments }; },

    /** Every request, or only those to a path. Bodies included — this is the wire. */
    requests(pathFragment = null) {
        return calls
            .filter((c) => pathFragment === null || c.path.includes(pathFragment))
            .map((c) => ({ method: c.method, path: c.path, body: c.body }));
    },

    /** Forget the log, so a test can say "and nothing was sent AFTER this point". */
    clearRequests() { calls.length = 0; return true; },

    /** Script one route for one test — a refusal, a 500, an absence. */
    answer(method, pathname, status, body) {
        overrides.set(key(method, pathname), { status, body });
        return true;
    },

    /* ---- the shot panel -------------------------------------------------- */

    /** Which shot the band is about, and what it says about it. */
    shotPanel() {
        return {
            id: screen.shotId ?? '',
            rating: screen.rating,
            index: shots.findIndex((s) => s.id === screen.shotId),
        };
    },

    /** The note the newest shot ships with, so no test types it twice. */
    shotNoteText() { return SHOT_NOTE_TEXT; },

    /**
     * The record as the SERVER now holds it — the table above, after every write that
     * reached it. Not `fetch()`: the scripted fetch is injected into the app's transport
     * and is not `globalThis.fetch`, so a raw fetch from a test reaches the harness's
     * static file server and gets a 404 page.
     */
    serverShot(id) {
        const held = shots.find((s) => s.id === id);
        return held ? JSON.parse(JSON.stringify(held)) : null;
    },

    /** Step the band to the older shot, through the control that does it. */
    async stepOlder() {
        screen.shadowRoot.getElementById('shot-older').click();
        await screen.updateComplete;
        await sleep(40);
        return screen.shotId;
    },

    /** What the "Rate this shot" button prints — the cap and the number, as drawn. */
    ratingFace() {
        const control = screen.shadowRoot.querySelector('ui-rating-control');
        const score = control?.shadowRoot.querySelector('#rate .score');
        return score ? score.textContent.replace(/\s+/g, ' ').trim() : null;
    },

    /**
     * Rate the shot the way a person does: press the score to open the sheet, move the
     * slider, release (`change` — the control's ONE commit per gesture), press Done.
     */
    async rate(score) {
        const control = screen.shadowRoot.querySelector('ui-rating-control');
        control.shadowRoot.getElementById('rate').click();
        await control.updateComplete;
        const slider = control.shadowRoot.getElementById('slider');
        const input = slider.shadowRoot.querySelector('input[type="range"]');
        input.value = String(score);
        /* THE PLATFORM'S OWN SHAPES, and `change` being `composed: false` is the whole
         * reason `ui-slider` re-dispatches it (ui-slider.js:410-412). A composed `change`
         * fired here would ESCAPE the shadow root as well as being re-dispatched, and the
         * control would commit twice for one release — a test artefact that reads exactly
         * like a double write. */
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, composed: false }));
        await control.updateComplete;
        await sleep(60);
        control.shadowRoot.getElementById('sheet-done')?.click();
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return true;
    },

    /** Open the notes sheet through its own button, and read what it composed. */
    async openNotes() {
        const control = screen.shadowRoot.querySelector('ui-rating-control');
        control.shadowRoot.getElementById('notes').click();
        await screen.updateComplete;
        await sleep(40);
        const sheet = screen.shadowRoot.getElementById('notes-sheet');
        if (!sheet) return { open: false };
        const body = sheet.querySelector('[slot="body"]');
        const empty = body.querySelector('#notes-empty');
        /* THE EDITOR IS THE BODY NOW. Its `text` getter is the live document
         * `value` is only the seed — so the sheet's note is read off the component
         * rather than off a paragraph the screen used to print. */
        const editor = body.querySelector('#notes-editor');
        const save = sheet.querySelector('#notes-save');
        return {
            open: true,
            heading: sheet.getAttribute('heading') ?? '',
            identity: body.querySelector('#notes-identity')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
            notes: editor ? editor.text : null,
            editable: !!editor,
            placeholder: editor?.getAttribute('placeholder') ?? null,
            dirty: editor ? editor.dirty : null,
            save: save ? { present: true, disabled: !!save.disabled } : null,
            empty: empty ? { heading: empty.getAttribute('heading'), body: empty.getAttribute('body') } : null,
            /* THE AUDIT'S OWN MEASUREMENT: "the sheet's whole text is 'Close'". */
            text: sheet.textContent.replace(/\s+/g, ' ').trim(),
        };
    },

    /**
     * Type into the open notes editor, through EasyMDE's own document.
     *
     * The component's `value` property is the SEED and writing it would not move the live
     * text; `editor.codemirror` is what a finger reaches, and it is the seam
     * `ui-notes-editor.render.test.mjs` uses for the same reason.
     */
    async typeNote(text) {
        const sheet = screen.shadowRoot.getElementById('notes-sheet');
        const editor = sheet?.querySelector('#notes-editor');
        if (!editor?.editorReady) return false;
        editor.editor.codemirror.focus();
        editor.editor.codemirror.setValue(String(text));
        await screen.updateComplete;
        await sleep(40);
        await screen.updateComplete;
        return editor.dirty;
    },

    /** Press Save on the open notes sheet. */
    async saveNote() {
        const sheet = screen.shadowRoot.getElementById('notes-sheet');
        const save = sheet?.querySelector('#notes-save');
        if (!save || save.disabled) return { pressed: false, disabled: !!save?.disabled };
        save.click();
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return { pressed: true, disabled: false };
    },

    /** Is the notes sheet on the glass? */
    notesOpen() {
        return !!screen.shadowRoot.getElementById('notes-sheet');
    },

    /** What the notes BUTTON on the panel prints (: it and the sheet must agree). */
    notesFace() {
        const control = screen.shadowRoot.querySelector('ui-rating-control');
        const button = control?.shadowRoot.getElementById('notes');
        return button ? button.textContent.replace(/\s+/g, ' ').trim() : null;
    },

    /** Leave the sheet by its Close button — the ending that must write nothing. */
    async closeNotes() {
        const sheet = screen.shadowRoot.getElementById('notes-sheet');
        const buttons = [...(sheet?.querySelectorAll('[slot="actions"]') ?? [])];
        const close = buttons.find((el) => el.id !== 'notes-save');
        close?.click();
        await screen.updateComplete;
        await sleep(60);
        await screen.updateComplete;
        return !screen.shadowRoot.getElementById('notes-sheet');
    },
};

window.__carry = api;
ready = Promise.resolve(true);

}
