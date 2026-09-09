/**
 * history-route-fixture — the rendering subject for the OVERLAY→ROUTE conversion
 * (`hist-route-conversion`, and H9's surviving half).
 *
 * IT DRIVES THE REAL SHELL WITH THE REAL ROUTE TABLE. `test/fixtures/app-shell-fixture.js`
 * adds a `probe` row so a swap can be measured against a screen that does nothing; this
 * one adds nothing at all, because the claim under test is that `history` is a row in
 * `src/lib/app-routes.js` like the other four and that `<app-root>` mounts it like the
 * other four. A fixture that supplied its own row would be testing the fixture.
 *
 * THE REST MOCK, WITHOUT A SECOND PROCESS — the same construction, and the same reasons,
 * as `app-shell-fixture.js`: `tools/rea-fixtures/` served through the harness's own
 * static server with `mock_rea.py`'s own `_key`, and the mock's own 503 for a path with
 * no recording. `tools/mock_rea.py` itself is a Python process on a fixed port shared
 * with the capture battery, and a rendering suite must not start one.
 *
 * THE SOCKETS ARE FAKE AND THAT IS DOCUMENTED, NOT PAPERED OVER: nothing in this tree
 * can push a WebSocket frame at the stores. Live opens its six channels, this records
 * what was dialled, and nothing here claims a real socket behaves this way.
 *
 * WHAT IT MEASURES THAT NOTHING ELSE CAN: where the caret is, across a route swap, with
 * the composed path resolved through every shadow root — `deepActiveElement` from
 * `src/lib/focus-trap.js`, the tree's own primitive, so the answer is the one the
 * dialog contract is written against rather than a second implementation of it.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { ROUTES } = await import('../../src/lib/app-routes.js');
const { deepActiveElement } = await import('../../src/lib/focus-trap.js');
await import('../../src/components/app-root.js');

/* Window listener accounting, installed before any shell exists — bug S10's
 * measurement, and here it also proves a route swap adds nothing. */
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

/**
 * REAPRIME'S OWN RECOMPUTE-ON-READ, TRANSCRIBED — the second rule this file states in two
 * languages, beside `fixtureKey` below, and the one that gives the power page a subject.
 *
 * THE DATA TRUTH, at pin 42f67f69 (`lib/src/models/device/machine.dart:64-140`, read-only):
 * the three derived channels are "computed on read from the raw pressure and flow fields
 * never stored — so already-recorded history shots gain these channels with zero migration
 * (fromJson does not read them; toJson recomputes them)". A recorded shot therefore DOES
 * carry them: `ShotsHandler._getShot` answers `jsonOk(shot.toJson())`, which maps every
 * measurement through `ShotSnapshot.toJson`, which calls `machine.toJson()`, which writes
 * the three keys whenever `flow >= 0.3 && pressure >= 0.3` and OMITS them below it.
 *
 * THE FIXTURES PREDATE THE GETTERS. All three recorded shots in `tools/rea-fixtures/` were
 * captured off an older ReaPrime: 923 measurements between them, zero `*Derived` keys and
 * zero `sensors` maps. That is a STALE RECORDING, not a server that lacks the feature, and
 * the mock's own ledger states the standing rule for exactly this case: "A recorded fixture
 * is evidence and never authority: when the two disagree the handler decides which is
 * stale, and the fixture is never edited to agree" (`tools/mock-fixture-ledger.json`).
 *
 * So the bytes on disk are untouched and their hashes still hold; what this does is apply
 * the PINNED HANDLER'S OWN PURE FUNCTION to the recorded raw pressure and flow, at read
 * time, exactly as a ReaPrime at the pin would when serving these same records. It invents
 * no value: every number here is `p / (f * f)`, `p / f` or `0.1 * p * f` over bytes that
 * were recorded off a real machine, under the server's own gate, with the server's own
 * omit-don't-null rule. `tools/mock_rea.py` does the same thing on the same route, and
 * `tools/mock-fixture-ledger.json` declares both.
 *
 * IT IS NOT A DERIVATION IN THE SKIN. This is an INSTRUMENT standing in for a server;
 * nothing under `src/` computes any of the three, and `shot-derivation.js` reads them
 * through the source choice like any other channel.
 */
function upgradeRecordedShot(record) {
    if (!record || !Array.isArray(record.measurements)) return record;
    const gate = (p, f, value) => {
        if (!(f >= 0.3) || !(p >= 0.3)) return null;
        if (!Number.isFinite(f) || !Number.isFinite(p) || !Number.isFinite(value)) return null;
        return value;
    };
    const measurements = record.measurements.map((measurement) => {
        const machine = measurement && measurement.machine;
        if (!machine) return measurement;
        const p = machine.pressure;
        const f = machine.flow;
        if (typeof p !== 'number' || typeof f !== 'number') return measurement;
        const next = { ...machine };
        /* OMITTED, NOT NULL — key presence IS the validity signal (`rea-names.js:48-53`),
         * and a null would read as "the server said there is no puck", which is a
         * different claim from "the server did not say". */
        const R = gate(p, f, p / (f * f));
        const Z = gate(p, f, p / f);
        const W = gate(p, f, 0.1 * p * f);
        if (R !== null) next.puckResistanceDerived = R;
        if (Z !== null) next.loadImpedanceDerived = Z;
        if (W !== null) next.hydraulicPowerDerived = W;
        return { ...measurement, machine: next };
    });
    return { ...record, measurements };
}

/** True for `/api/v1/shots/<id>` — the by-id route, whose body carries measurements. */
function isShotByIdPath(pathWithQuery) {
    return /^\/api\/v1\/shots\/[^/?]+$/.test(pathWithQuery)
        && !pathWithQuery.endsWith('/latest');
}

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
    /* THE SERVE-TIME UPGRADE, on the one route that carries measurements — see
     * `upgradeRecordedShot`. It sits here rather than at the two call sites below so that
     * the SHELL's own path (viewer -> shots store -> transport) sees exactly what a
     * staged page sees, which is the whole point of a mock that stands in for a server. */
    if (response.ok && isShotByIdPath(pathWithQuery)) {
        const body = upgradeRecordedShot(await response.json());
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    }
    if (response.ok) return response;
    return new Response(
        JSON.stringify({ error: 'this instrument has no recording of that page', path: pathWithQuery }),
        { status: 503, headers: { 'content-type': 'application/json' } },
    );
}

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
        };
        sockets.push(socket);
        return socket;
    };
}

let boot = null;
let root = null;

/** Every custom element in the document, through every shadow root. */
function deepAll(from = document, acc = []) {
    for (const el of from.querySelectorAll('*')) {
        acc.push(el);
        if (el.shadowRoot) deepAll(el.shadowRoot, acc);
    }
    return acc;
}

/**
 * The nearest id at or above an element, crossing shadow hosts.
 *
 * WHY THIS AND NOT `activeElement.id`: focus goes INWARD. `<ui-button>` forwards
 * `focus()` to the native button in its own shadow root (CONVENTIONS  — the host
 * carries no `delegatesFocus`), so the deep active element is a `<button>` with no id
 * and the AFFORDANCE that holds the caret is its host. The invoker contract is written
 * about the affordance, so that is what this reports.
 */
function invokerOf(el) {
    let node = el;
    while (node) {
        /* A CUSTOM ELEMENT with an id, so the answer is the affordance a screen named
         * and not the private box inside it: #1 renders a native <button id="btn"> in
         * its own shadow root, and "btn" is not what the invoker contract is about. */
        if (node.id && node.tagName?.includes('-')) return node.id;
        node = node.parentElement ?? (node.getRootNode()?.host ?? null);
    }
    return null;
}

/**
 * Everything between an element and the document that would make it unreachable
 * `inert`, `aria-hidden="true"` or `hidden`, on the element or on anything containing
 * it, through every shadow host. Empty is the only correct answer for a screen.
 */
function blockers(el) {
    const out = [];
    let node = el;
    while (node) {
        if (node.hasAttribute?.('inert')) out.push(`inert:${node.tagName.toLowerCase()}`);
        if (node.getAttribute?.('aria-hidden') === 'true') out.push(`aria-hidden:${node.tagName.toLowerCase()}`);
        if (node.hasAttribute?.('hidden')) out.push(`hidden:${node.tagName.toLowerCase()}`);
        node = node.parentElement ?? (node.getRootNode()?.host ?? null);
    }
    return out;
}

/** The host chain down to an element, so a focus assertion names a place. */
function pathOf(el) {
    const parts = [];
    let node = el;
    while (node) {
        let label = node.tagName ? node.tagName.toLowerCase() : '?';
        if (node.id) label += `#${node.id}`;
        parts.unshift(label);
        const parent = node.parentElement;
        node = parent ?? (node.getRootNode()?.host ?? null);
    }
    return parts.join(' > ');
}

/** Real readings per derived channel, for the staging report. Counts, never values. */
function derivedCounts(derivation) {
    const out = {};
    for (const key of ['resistance', 'impedance', 'power']) {
        const ys = derivation?.ok ? (derivation.series?.[key]?.y ?? []) : [];
        out[key] = ys.reduce((n, v) => n + (typeof v === 'number' ? 1 : 0), 0);
    }
    return out;
}

globalThis.__history = {
    /** Build a boot, put an `<app-root>` on the page with it, and let it settle. */
    async mount() {
        boot = createAppBoot({
            fetch: mockFetch,
            createSocket: fakeSocketFactory(),
            location: { hostname: '127.0.0.1', protocol: 'http:' },
            importModule: (specifier) => import(specifier),
            routes: ROUTES,
        });

        root = document.createElement('app-root');
        root.boot = boot;
        document.getElementById('mount').appendChild(root);
        await root.updateComplete;
        return globalThis.__history.settled();
    },

    /** Wait for the boot to have settled — `ready` or `error` — and the screen to be up. */
    async settled(timeoutMs = 15000) {
        const started = performance.now();
        while (boot && boot.state.phase === 'connecting' && performance.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 5));
        }
        await root.updateComplete;
        return globalThis.__history.state();
    },

    /** Wait until the mounted screen is `tag`, however the navigation was started. */
    async waitForScreen(tag, timeoutMs = 15000) {
        const started = performance.now();
        while (globalThis.__history.screenTag() !== tag && performance.now() - started < timeoutMs) {
            await new Promise((r) => setTimeout(r, 5));
        }
        await root.updateComplete;
        /* One more frame: the incoming screen's own first update is what places the
         * caret, and a state read taken in the same tick would be reading the frame
         * before the one under test. */
        await new Promise((r) => requestAnimationFrame(r));
        await root.updateComplete;
        return globalThis.__history.state();
    },

    screenTag() {
        const screen = root?.shadowRoot?.querySelector('live-screen, history-screen') ?? null;
        return screen ? screen.tagName.toLowerCase() : null;
    },

    /**
     * NAVIGATE IN THE WAY A PERSON DOES, for the capture battery and for any driver
     * that wants the History route rather than the round trip.
     *
     * It CLICKS THE REAL AFFORDANCE rather than assigning the hash, because the claim a
     * frame of this screen carries is that the route is reachable — a fixture that set
     * `location.hash` would photograph a screen that might have no way in.
     */
    async open() {
        const live = root?.shadowRoot?.querySelector('live-screen');
        const entry = live?.shadowRoot?.getElementById('history-entry');
        if (!entry) throw new Error('open: the Live screen carries no #history-entry');
        entry.click();
        return globalThis.__history.waitForScreen('history-screen');
    },

    /**
     * Hand the screen its picker options and the page to show. The skeleton takes data
     * as properties and fetches nothing (its own file says so), so this is the whole of
     * staging it — and the LABELS are the caller's, which is what M10's open
     * option-text-width measurement is about.
     */
    async stage({ shotOptions = [], shotA = null, shotB = null, page = null, offset = null } = {}) {
        const screen = root?.shadowRoot?.querySelector('history-screen');
        if (!screen) throw new Error('stage: no <history-screen> is mounted');
        /* `shotOptions`, never `shots`: gate-d retires `/\.shots\b/` tree-wide. */
        screen.shotOptions = shotOptions;
        if (shotA !== null) screen.shotA = shotA;
        if (shotB !== null) screen.shotB = shotB;
        if (page !== null) screen.page = page;
        /* THE OFFSET IS A STAGEABLE INPUT, because the power page's correspondence marks
         * are the one thing on the History route that a non-zero alignment MOVES rather
         * than slides, and a frame of them at zero would photograph the feature switched
         * off. The screen holds the number; the pages read it. */
        if (offset !== null) {
            screen.offset = offset;
            for (const el of screen.querySelectorAll('[data-page]')) {
                if ('offset' in el) el.offset = offset;
            }
        }
        await screen.updateComplete;
        return screen.page;
    },

    /**
     * MOUNT THE THREE REAL PAGES AND ARM THEM (  pages cluster, plus fix run 6's
     * power page).
     *
     * The skeleton is a mount REGION and the pages are its content, so a frame of this
     * screen with an empty region is a frame of half the screen. This is the other half:
     * the two page elements arrive as light-DOM children exactly as  draws them
     * with no `slot` or `data-page` written here, because each page fills those in for
     * itself and a fixture that wrote them would be testing the fixture.
     *
     * ARMED WITH REAL RECORDS, and with the SAME-PROFILE PAIR: 5fc3f631 (3.26 s) and
     * d5139a1f (8.54 s) are both "Extractamundo Dos! (2)", which is what an alignment
     * offset is for. They are read through the same `tools/rea-fixtures/` road the mock
     * serves them on, derived through gate 6 ONCE each, and handed to both pages — one
     * walk, two surfaces, which is the derivation's own contract.
     *
     * The list rows come from the recorded `/shots` page, through `shotRows()`. Every one
     * of the twenty dashes its duration, peak pressure and average flow, because no
     * fixture carries an `actualYield` and no fixture is downloaded to find one.
     */
    async stagePages({ page = 'flow', offset = 0 } = {}) {
        const screen = root?.shadowRoot?.querySelector('history-screen');
        if (!screen) throw new Error('stagePages: no <history-screen> is mounted');

        await import('../../src/screens/history-flow-page.js');
        await import('../../src/screens/history-power-page.js');
        await import('../../src/screens/history-data-page.js');
        const { deriveFromRecord } = await import('../../src/lib/shot-derivation.js');
        const { shotRows } = await import('../../src/lib/shot-summary.js');

        const shot = async (id) => upgradeRecordedShot(await (await fetch(
            `${location.origin}/tools/rea-fixtures/api__v1__shots__${id}.json`,
            { cache: 'no-store' },
        )).json());
        const [recordA, recordB, list] = await Promise.all([
            shot('5fc3f631-6b18-471b-9800-00d552dbbecb'),
            shot('d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3'),
            fetch(`${location.origin}/tools/rea-fixtures/${fixtureKey('/api/v1/shots?limit=20&offset=0&order=desc')}`,
                { cache: 'no-store' }).then((r) => r.json()),
        ]);
        const a = deriveFromRecord(recordA);
        const b = deriveFromRecord(recordB);

        const flow = document.createElement('history-flow-page');
        flow.derivationA = a;
        flow.derivationB = b;
        /* THE POWER PAGE TAKES THE SAME TWO DERIVATIONS AND THE SAME OFFSET. One walk,
         * three surfaces — the derivation's own contract, and the reason the derived
         * channels need no second read: `deriveFromRecord` already emits `resistance`,
         * `impedance` and `power` as SERIES_KEYS, read through the source choice. */
        const power = document.createElement('history-power-page');
        power.derivationA = a;
        power.derivationB = b;
        /* THE OFFSET ARRIVES WITH THE PAGE, not after it. On this page a non-zero
         * alignment is what makes the rule's correspondence marks say anything: staged at zero
         * and set afterwards, the first frame photographs the feature switched off. */
        power.offset = offset;
        flow.offset = offset;
        const data = document.createElement('history-data-page');
        data.derivationA = a;
        data.derivationB = b;
        data.rows = shotRows(list.items);
        data.shotA = recordA.id ?? '';
        data.shotB = recordB.id ?? '';
        screen.append(flow, power, data);
        screen.page = page;
        screen.offset = offset;

        await screen.updateComplete;
        await flow.updateComplete;
        await power.updateComplete;
        await data.updateComplete;
        /* A PLOT MUST BE ARMED BEFORE IT IS MEASURED OR PHOTOGRAPHED, and `ready` is the
         * gate that says the mount finished — the sheet adopted, the fonts loaded and the
         * plot built from whatever channels were set. */
        const cards = [
            ...flow.renderRoot.querySelectorAll('ui-chart-card'),
            ...power.renderRoot.querySelectorAll('ui-chart-card'),
        ];
        await Promise.all(cards.map((card) => card.ready));
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
        return {
            page: screen.page,
            derived: { a: a.ok, b: b.ok },
            durations: [a.scalars.durationSeconds, b.scalars.durationSeconds],
            rows: data.rows.length,
            plots: cards.length,
            /* WHAT THE POWER PAGE ACTUALLY GOT — the count of real readings per derived
             * channel, so a driver can tell "the page is drawing three channels" from
             * "the page is honestly saying the server served none". */
            derivedChannels: derivedCounts(a),
        };
    },

    /**
     * Choose which plot a chart page shows — the single-plot branch's own state.
     *
     * `plot` is a REFLECTED property on both chart pages, so this is one assignment and
     * the CSS branch reads the attribute; nothing here knows whether the branch is live.
     * It exists because at the design floor the page shows one plot of two, and a walk
     * state that could only ever photograph the first one would leave the second
     * unphotographable at the only geometry where it has a full track.
     */
    async setPlot(tag, value) {
        const screen = root?.shadowRoot?.querySelector('history-screen');
        const page = screen?.querySelector(tag);
        if (!page) throw new Error(`setPlot: no <${tag}> is mounted`);
        page.plot = value;
        await page.updateComplete;
        const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
        await Promise.all(cards.map((card) => card.ready));
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
        return page.getAttribute('plot');
    },

    /** Focus one element by a deep path of ids, keyboard-modality aside. */
    focusIn(hostTag, id) {
        const host = root?.shadowRoot?.querySelector(hostTag);
        const target = host?.shadowRoot?.getElementById(id);
        if (!target) throw new Error(`focusIn: no #${id} in <${hostTag}>`);
        target.focus();
        return pathOf(deepActiveElement());
    },

    /** Everything a test asserts on, in one round trip. */
    state() {
        const active = deepActiveElement();
        const all = deepAll();
        return {
            route: root?.getAttribute('route') ?? null,
            hash: location.hash,
            screenTag: globalThis.__history.screenTag(),
            /* THE OVERLAY QUESTION, ASKED OF THE WHOLE DOCUMENT rather than of the
             * shell's shadow root: an always-mounted screen hidden by a style would be
             * the overlay again wearing a route's name, and it would be found here. */
            historyScreens: all.filter((el) => el.tagName === 'HISTORY-SCREEN').length,
            liveScreens: all.filter((el) => el.tagName === 'LIVE-SCREEN').length,
            /* H9's four halves, each asked precisely.
             *
             * `aria-modal` is asked of the WHOLE document because there is no innocent
             * use of it: it is a claim that everything else is unreachable.
             *
             * `inert` and `aria-hidden` are NOT, and that is a measurement rather than
             * a softening. Both have legitimate uses in this library that have nothing
             * to do with modality — measured on the Live screen: five inert
             * `<ui-favourite-slot>`s (an empty slot is inert by its own state) and eight
             * `aria-hidden` decorations (an svg glyph, a caret, a readout's shadow
             * copy). What H9 describes is an overlay declaring itself modal while the
             * app BEHIND it stays reachable, so the honest question is about the SCREEN
             * and the boxes that contain it: is the thing on screen blocked, and is any
             * screen present-but-suppressed? */
            ariaModal: all.filter((el) => el.getAttribute('aria-modal') !== null)
                .map((el) => `${el.tagName.toLowerCase()}:${el.hasAttribute('open') ? 'open' : 'closed'}`),
            screenBlockedBy: blockers(root?.shadowRoot?.querySelector('live-screen, history-screen') ?? null),
            suppressedScreens: all
                .filter((el) => /^(LIVE|HISTORY|SELECTOR|SETTINGS|EDITOR)-SCREEN$/.test(el.tagName))
                .filter((el) => el.hasAttribute('inert') || el.hasAttribute('hidden')
                    || el.getAttribute('aria-hidden') === 'true')
                .map((el) => el.tagName.toLowerCase()),
            activeId: active?.id ?? null,
            activeInvoker: invokerOf(active),
            activePath: active ? pathOf(active) : null,
            hashListeners: listenerLedger.get('hashchange') ?? 0,
            historyLength: history.length,
            sockets: sockets.length,
        };
    },

    /** Every REST call the shell made, in order. */
    calls() { return calls.slice(); },

    /** Take the shell off the page. Everything it added must go with it. */
    async teardown() {
        root?.remove();
        await new Promise((r) => requestAnimationFrame(r));
        const after = globalThis.__history.state();
        boot?.destroy();
        boot = null;
        root = null;
        return after;
    },
};

ready = true;

}
