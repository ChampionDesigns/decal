/**
 * live-loop-fixture — the REAL application, booted against the REAL WebSocket mock, so a
 * test can drive a whole recorded shot through it (`live-15hz-loop`).
 *
 * This is the only fixture in the tree that starts nothing and fakes nothing on the data
 * road. `test/fixtures/app-shell-fixture.js` had to fake the sockets, and said so, because
 * when it was written `tools/mock_rea.py` spoke no WebSocket at all. It does now (wave
 * 5.1, `mock-ws`), so this fixture uses:
 *
 * the real `createAppBoot` — the shell's own assembly, not a hand-built store set;
 * the real `<app-root>` — including its route swap, which is how the mid-shot
 * subscriber test takes the screen away and brings it
 * back;
 * the real `WebSocket` — six channels, to the mock's own port;
 * the real `fetch` — `GET /api/v1/machine/capabilities` and `machine/info`
 * answered by the mock process, not by a corpus copy;
 * the real `src/screens/live-screen.js` through `index.html`'s importmap.
 *
 * WHY `createAppBoot` AND NOT `bootFromWindow`. One reason, and it is the harness's:
 * `bootFromWindow` deliberately does not read `location.port` (ReaPrime is on 8080
 * whatever port served the page), and a rendering suite may not use a fixed port
 * recorded browser/port contention as an intermittency hazard, so the mock is started on
 * an ephemeral one. `createAppBoot` takes the location it is given, which is the seam
 * `bootFromWindow` exists to fill from ambient state. Everything below that line is the
 * app's.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO THINGS THIS FIXTURE DOES THAT THE APP DOES NOT, both deliberate:
 *
 * 1. IT HOLDS THE SIX SOCKETS UNTIL THE TEST SAYS GO (`DeferredSocket`).
 *
 * The mock starts each channel's playback clock AT CONNECT — "a second subscriber gets
 * its own shot from the beginning rather than the first one's backlog"
 * (`tools/WS_FRAMES.md`). Six channels dialled at six slightly different moments would
 * therefore play six slightly different shots: the shot-state channel would call
 * `pouring` at a moment the machine channel had not reached yet, and the buffer would
 * open around the wrong samples. Dialling them together is not a convenience, it is
 * what keeps the recording coherent.
 *
 * It also buys the one thing the proof needs and the run cannot otherwise have: a
 * window BEFORE the stream, long enough to assert what an idle screen looks like. The
 * channel is open and silent in that window, which is exactly what an idle machine's
 * snapshot channel is.
 *
 * 2. IT CAN PUSH ONE CONSTRUCTED `idle` SNAPSHOT (`pushMachineFrame`).
 *
 * NOT ONE FRAME IN THE FIXTURE SET CARRIES A MACHINE STATE OF `idle` — every recorded
 * sample is mid-espresso — and the mock refuses to relabel a recorded espresso frame as
 * idle, which is right ( _mock-the socket notes: "a screen that needs an
 * idle machine should be driven from a store fake, not from this instrument"). So the
 * two ends of the `idle -> espresso -> idle` sequence are constructed HERE, by the
 * test, to `MachineSnapshot.toJson`'s shape, and they travel the same road as every
 * recorded frame: socket message -> `readMachineSnapshot` -> feed store -> screen.
 *
 * The frame carries `timestamp` and `state` and NOTHING ELSE. `rea-address.js` rule 2
 * is "written -> valid, omitted -> gated", so an omitted channel is a gated absence and
 * an invented temperature would be a lie; this fixture writes no measurement at all.
 * `idle` is a real `MACHINE_STATE` (`machine-state.generated.js`), generated from
 * ReaPrime's own enum — the recording lacks it, the protocol does not.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { ROUTES } = await import('../../src/lib/app-routes.js');
const { WS_CHANNELS } = await import('../../src/data/rea-ws-channels.js');
const { deriveFromBuffer } = await import('../../src/lib/shot-derivation.js');
const { phaseRows } = await import('../../src/lib/live-targets.js');
await import('../../src/components/app-root.js');

/* ---------------------------------------------------------------------------
 * The transport: real sockets, dialled on command
 * ------------------------------------------------------------------------- */

/**
 * A WebSocket that is OPEN from the application's side and connected on demand.
 *
 * `rea-sockets.js` asks four things of whatever `createSocket` returns
 * `addEventListener`, `removeEventListener`, `close`, `send` — so an `EventTarget` is the
 * whole of the contract. The synthetic `open` is dispatched at construction because the
 * channel IS available to the app from that moment: the far end simply has nothing to say
 * yet, which is the state this fixture exists to be able to hold still.
 */
class DeferredSocket extends EventTarget {
    constructor(url) {
        super();
        this.url = url;
        this.real = null;
        this.injected = 0;
        queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }

    /** Dial the mock. From here on every frame is the server's. */
    connect() {
        if (this.real) return this;
        const socket = new WebSocket(this.url);
        this.real = socket;
        socket.addEventListener('message', (event) => {
            this.dispatchEvent(new MessageEvent('message', { data: event.data }));
        });
        socket.addEventListener('close', () => this.dispatchEvent(new Event('close')));
        socket.addEventListener('error', () => this.dispatchEvent(new Event('error')));
        return this;
    }

    /** One frame the TEST wrote, down the same channel. See the header, note 2. */
    inject(payload) {
        this.injected += 1;
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
        return this;
    }

    send(data) { this.real?.send(data); }

    close() { this.real?.close(); }
}

/** Every socket the app dialled, by the channel path — `/ws/v1/machine/snapshot` etc. */
const dialled = new Map();

function createSocket(url) {
    const socket = new DeferredSocket(url);
    dialled.set(new URL(url).pathname, socket);
    return socket;
}

const socketFor = (channel) => dialled.get(WS_CHANNELS[channel].path);

/* ---------------------------------------------------------------------------
 * The route table: the shipping one, plus somewhere to swap to and back
 * ------------------------------------------------------------------------- */

const TABLE = Object.freeze({
    ...ROUTES,
    probe: Object.freeze({
        id: 'probe',
        tag: 'probe-screen',
        module: '/test/fixtures/probe-screen.js',
        label: 'Probe',
    }),
});

/* ---------------------------------------------------------------------------
 * The surface
 * ------------------------------------------------------------------------- */

let boot = null;
let root = null;

/** One-decimal rounding, exactly as `phaseRows` does it — see `live-targets.js`. */
const round1 = (value) => (typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(1))
    : null);

const screenEl = () => root?.shadowRoot?.querySelector('live-screen') ?? null;
const cardEl = () => screenEl()?.shadowRoot?.querySelector('ui-chart-card') ?? null;
const gridEl = () => screenEl()?.shadowRoot?.querySelector('ui-data-grid') ?? null;
const chipEl = () => screenEl()?.shadowRoot?.querySelector('ui-status-chip') ?? null;

async function until(predicate, ms, what) {
    const deadline = performance.now() + ms;
    for (;;) {
        let value;
        try { value = predicate(); } catch { value = false; }
        if (value) return { waitedMs: Math.round(performance.now() - (deadline - ms)), value };
        if (performance.now() > deadline) {
            throw new Error(`live-loop: timed out after ${ms} ms waiting for ${what}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
    }
}

globalThis.__loop = {
    /** Build the real boot against the mock on `port`, mount `<app-root>`, wait for it. */
    async mount({ port }) {
        boot = createAppBoot({
            fetch: (...args) => window.fetch(...args),
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port },
            importModule: (specifier) => import(specifier),
            routes: TABLE,
        });
        root = document.createElement('app-root');
        root.boot = boot;
        document.getElementById('mount').appendChild(root);
        await root.updateComplete;
        await until(() => screenEl() !== null, 20000, 'the Live screen to be mounted');
        await until(() => cardEl()?.ready !== undefined, 20000, 'the chart card');
        await cardEl().ready;
        await screenEl().updateComplete;
        return {
            phase: root.getAttribute('phase'),
            route: root.getAttribute('route'),
            sockets: [...dialled.keys()].sort(),
            /* THE ASSERTION THIS WHOLE ITEM IS ABOUT: nothing in this fixture sets
             * `screen.shot`. If the screen has a buffer, it took it off `boot.live`. */
            screenShotIsLiveShot: screenEl().shot === boot.live.shot,
            fixtureSetShot: false,
        };
    },

    /** Dial all six channels at once. Returns the page clock at that instant. */
    startStream() {
        const t0 = performance.now();
        for (const socket of dialled.values()) socket.connect();
        return { at: t0, dialled: dialled.size };
    },

    /**
     * Push one constructed machine snapshot. Two keys, no measurement — see the header.
     * @param {string} state a `MACHINE_STATE` name
     */
    pushMachineFrame(state, substate = 'idle') {
        const socket = socketFor('machineSnapshot');
        if (!socket) throw new Error('the machine snapshot channel was never dialled');
        socket.inject({ timestamp: new Date().toISOString(), state: { state, substate } });
        return socket.injected;
    },

    /** Wait until the screen's own chart has at least `n` in-shot samples. */
    async untilInShot(n, ms = 40000) {
        const got = await until(() => {
            const derivation = screenEl()?.derivation;
            return derivation && derivation.ok && derivation.counts.inShot >= n
                ? derivation.counts.inShot
                : false;
        }, ms, `${n} in-shot samples`);
        return got.value;
    },

    /** Wait until the machine feed's last frame carries `state`. */
    async untilMachineState(state, ms = 40000) {
        await until(() => screenEl()?.machineState === state, ms, `machine state '${state}'`);
        return screenEl().machineState;
    },

    /** Wait until the shot buffer has closed (the mock's `finished` frame). */
    async untilShotClosed(ms = 60000) {
        await until(() => boot.live.shot.get().open === false && boot.live.shot.get().shotId, ms,
            'the shot to close');
        return boot.live.shot.get().phase;
    },

    /** Wait until the machine channel has been silent for `quietMs`. */
    async untilQuiet(quietMs = 700, ms = 20000) {
        let last = -1;
        let lastChangeAt = performance.now();
        await until(() => {
            const frames = boot.live.status().machineSnapshot.frames;
            if (frames !== last) { last = frames; lastChangeAt = performance.now(); return false; }
            return performance.now() - lastChangeAt > quietMs;
        }, ms, 'the machine channel to fall silent');
        return boot.live.status().machineSnapshot.frames;
    },

    /**
     * WHO RE-CLASSIFIES STALENESS WHEN THE FRAMES STOP — AND WHETHER IT REACHES A PIXEL.
     *
     * `live-stores.js:248` is explicit that the layer owns no timer — "driven by whatever
     * already ticks" — and the feed store classifies on ARRIVAL. So a channel that simply
     * stops has nothing to re-classify it unless a consumer ticks it, and until fix-1
     * nothing under `src/` did: the mechanism was whole and unreachable, which is the
     * worst of the three possible states. `LiveWiring` now owns a 500 ms tick that lives
     * and dies with the mounted screen (`live-wiring.js` STALENESS_TICK_MS).
     *
     * So this probe waits past the machine feed's own budget
     * (`DEFAULT_STALE_AFTER_MS.machineSnapshot`, 2 s) and then reads THREE things, in the
     * order that separates the two failures: the store's status with nobody helping it
     * (`beforeTick` — this is now the assertion, not the diagnostic), what the SCREEN
     * says while it is that (`chip`), and the status after a hand call (`afterTick`),
     * which is the old mechanism check and must agree.
     */
    async stalenessProbe(waitMs = 2400) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const before = boot.live.status();
        const screen = screenEl();
        await screen.updateComplete;
        const chip = chipEl();
        const seen = {
            text: chip ? chip.textContent.trim() : null,
            tone: chip ? chip.getAttribute('tone') : null,
            dots: chip ? chip.shadowRoot.querySelectorAll('.dot').length : null,
            feed: chip ? chip.getAttribute('data-feed') : null,
            /* The controls the stale reading must NOT withdraw: an unreachable abort
             * target and an absent one fail the same person the same way (cross-1). */
            stopButtons: screen.shadowRoot.querySelectorAll('ui-stop-button').length,
            machineStateProperty: screen.machineState,
        };
        boot.live.refreshStaleness(Date.now());
        const after = boot.live.status();
        return {
            waitedMs: waitMs,
            beforeTick: { machine: before.machineSnapshot.status, scale: before.scale.status },
            afterTick: { machine: after.machineSnapshot.status, scale: after.scale.status },
            machineAgeMs: Math.round(before.machineSnapshot.ageMs ?? -1),
            chip: seen,
        };
    },

    /**
     * THE COALESCING WINDOW. Counts arrivals against redraws over a wall-clock interval,
     * mid-shot, with no `await` between the two reads of each counter — the whole point is
     * the RATIO, so both ends must be read the same way.
     */
    async rateWindow(ms) {
        const read = () => ({
            at: performance.now(),
            frames: boot.live.status().machineSnapshot.frames,
            samples: boot.live.shot.get().samples.length,
            derivations: screenEl().chartDerivations,
            paints: cardEl().paintCount,
        });
        const before = read();
        await new Promise((resolve) => setTimeout(resolve, ms));
        const after = read();
        const seconds = (after.at - before.at) / 1000;
        return {
            seconds: Number(seconds.toFixed(3)),
            frames: after.frames - before.frames,
            samples: after.samples - before.samples,
            derivations: after.derivations - before.derivations,
            paints: after.paints - before.paints,
            framesPerSecond: Number(((after.frames - before.frames) / seconds).toFixed(2)),
            derivationsPerSecond: Number(((after.derivations - before.derivations) / seconds).toFixed(2)),
            paintsPerSecond: Number(((after.paints - before.paints) / seconds).toFixed(2)),
        };
    },

    /** What is drawn right now: the plot's own x scale, plus a checksum of the pixels. */
    canvasSample() {
        const card = cardEl();
        card.drawNow();
        const canvas = card.shadowRoot.querySelector('canvas');
        const context = canvas.getContext('2d');
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let checksum = 0;
        let ink = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                ink += 1;
                checksum = (checksum + data[i] * 3 + data[i + 1] * 5 + data[i + 2] * 7 + i) % 4294967296;
            }
        }
        const raw = card.plotHandle?.raw ?? null;
        return {
            checksum,
            ink,
            width: canvas.width,
            height: canvas.height,
            xMax: raw ? raw.scales.x.max : null,
            xMin: raw ? raw.scales.x.min : null,
            inShot: card.derivation?.ok ? card.derivation.counts.inShot : 0,
            lastT: card.derivation?.ok ? card.derivation.axis.t[card.derivation.axis.t.length - 1] : null,
        };
    },

    /**
     * Count drilled pixels in the column band a shot-time RANGE occupies right now.
     * The instrument, aimed: `[from, to]` are values on the plot's own x scale.
     */
    drillBand(from, to) {
        const card = cardEl();
        card.drawNow();
        const canvas = card.shadowRoot.querySelector('canvas');
        const over = card.plotHandle.raw.over;
        const canvasRect = canvas.getBoundingClientRect();
        const overRect = over.getBoundingClientRect();
        /* THREE SPACES, NOT TWO, SINCE THE FIT LANDED (src/lib/app-fit.js). The rects are
         * PAINTED px, `valToPos` answers the plot's own LAYOUT px, and `getImageData`
         * wants BACKING px. While the app was drawn at scale 1 the first two were the
         * same number and adding them was harmless; at the bench tablet's 0.6675 the sum
         * put the whole band in the wrong place and it measured 1px of new time. So the
         * layout offset is converted to painted first, and the painted total to backing
         * second — both ratios measured, so a transformed ancestor counts too. */
        const paintedPerLayout = canvasRect.width / canvas.clientWidth;
        const ratio = canvas.width / canvasRect.width;
        const at = (t) => Math.round(
            (overRect.left - canvasRect.left
             + card.plotHandle.raw.valToPos(t, 'x') * paintedPerLayout) * ratio);
        const x0 = Math.max(0, Math.min(at(from), at(to)));
        const x1 = Math.min(canvas.width, Math.max(at(from), at(to)));
        const width = Math.max(1, x1 - x0);
        if (x0 + width > canvas.width) return { drilled: -1, width };
        const { data } = canvas.getContext('2d').getImageData(x0, 0, width, canvas.height);
        let drilled = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) drilled += 1;
        }
        return { drilled, width, x0, x1 };
    },

    /** The cursor's own state, for the mid-shot sweep. */
    cursor() {
        const card = cardEl();
        return { ...card.cursor, values: { ...card.cursor.values } };
    },

    /**
     * THE PLOT AREA in page coordinates, for the sweep — `.u-over` and not `.plot`.
     *
     * `.plot` is the HOST, and it contains uPlot's axis gutters: the y-axis labels down
     * its left and the x-axis under it. A pointer in a gutter is outside the cursor's
     * range by design and reads as `active: false`, so a sweep across the host's own
     * width samples a point that is correctly dead and then fails for it.
     *
     * IT ONLY BIT AT THE FLOOR, and only once the Live band's inset became the previous skin's 57px
     * (parity 7-live-polish): the plot narrowed while the y-axis gutter stayed as wide
     * as its labels need, and the first of eight samples moved from just inside the
     * plot to just inside the gutter. `.u-over` is uPlot's own name for the box the
     * cursor is bound to, and `uplot-plot.js`'s header already points at it ("a sweep
     * across `.u-over` at BOTH the render harness geometries"). The fallback keeps the old answer
     * if the plot has not drawn yet, so a caller gets a box either way.
     */
    plotBox() {
        const plot = cardEl().shadowRoot.querySelector('.plot');
        const over = plot.shadowRoot
            ? plot.shadowRoot.querySelector('.u-over')
            : plot.querySelector('.u-over');
        const rect = (over ?? plot).getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    },

    /**
     * THE FOOT BAND AGAINST GATE 6, in ONE synchronous turn.
     *
     * The rendered cell text is read out of `<ui-data-grid>`'s shadow root and the
     * derivation is run over the buffer in the same turn — no `await` between them, so no
     * socket frame can land in the middle and no re-render can move the DOM under the
     * comparison. What comes back is both halves; the test does the comparing.
     */
    footBandVsGate6() {
        const grid = gridEl();
        const cellText = (row, column) => {
            const cell = grid.shadowRoot.querySelector(`#cell-${row}-${column}`);
            return cell ? cell.textContent.trim() : null;
        };
        const rendered = {};
        for (const row of ['preinfusion', 'extraction', 'total']) {
            for (const column of ['time', 'weight', 'volume']) {
                rendered[`${row}.${column}`] = cellText(row, column);
            }
        }
        const derivation = deriveFromBuffer(boot.live.shot, { record: null });
        const rows = phaseRows(derivation);
        const gate6 = {};
        for (const row of rows) {
            for (const column of ['time', 'weight', 'volume']) {
                const value = row.cells[column];
                gate6[`${row.key}.${column}`] = value === undefined ? null : String(value);
            }
        }
        const phases = derivation.ok ? derivation.phases : null;
        return {
            rendered,
            gate6,
            dash: grid.dash,
            derivationOk: derivation.ok === true,
            inShot: derivation.ok ? derivation.counts.inShot : 0,
            revision: boot.live.shot.revision(),
            samples: boot.live.shot.get().samples.length,
            raw: phases && phases.total
                ? { totalSeconds: phases.total.seconds, totalWeight: phases.total.weight, totalVolume: phases.total.volume }
                : null,
            rounded: phases && phases.total
                ? { totalSeconds: round1(phases.total.seconds), totalWeight: round1(phases.total.weight) }
                : null,
        };
    },

    /**
     * THE MID-SHOT SUBSCRIBER. Take the screen away and bring it back the way the app
     * does — through the route — while the stream keeps running into the stores.
     *
     * The old element's `disconnectedCallback` runs at removal (`app-root.js`: "remove
     * first, then create"), so its chart controller unsubscribes from the buffer; the new
     * one is created, handed `boot`, and must render the shot SO FAR. Nothing replays: the
     * buffer is the only memory the shot has.
     */
    async reloadScreen({ dwellMs = 800 } = {}) {
        const outgoing = screenEl();
        const before = {
            inShot: outgoing.derivation?.ok ? outgoing.derivation.counts.inShot : 0,
            firstT: outgoing.derivation?.ok ? outgoing.derivation.axis.t[0] : null,
            derivations: outgoing.chartDerivations,
            subscribers: boot.live.shot.subscriberCount(),
            samples: boot.live.shot.get().samples.length,
        };
        const t0 = performance.now();
        location.hash = '#/probe';
        await until(() => screenEl() === null, 20000, 'the Live screen to be taken away');
        /* STAY AWAY LONG ENOUGH TO MISS FRAMES. At 15 Hz this is ~12 samples that arrive
         * while NO screen exists — which is the whole of the trap. A swap fast enough to
         * miss nothing would prove only that the swap is fast. */
        await new Promise((resolve) => setTimeout(resolve, dwellMs));
        const away = {
            at: performance.now(),
            subscribers: boot.live.shot.subscriberCount(),
            frames: boot.live.status().machineSnapshot.frames,
            samples: boot.live.shot.get().samples.length,
        };
        location.hash = '#/live';
        await until(() => screenEl() !== null, 20000, 'the Live screen to come back');
        const incoming = screenEl();
        await incoming.updateComplete;
        await cardEl().ready;
        await incoming.updateComplete;
        return {
            before,
            away,
            sameElement: incoming === outgoing,
            wallMs: Math.round(performance.now() - t0),
            after: {
                inShot: incoming.derivation?.ok ? incoming.derivation.counts.inShot : 0,
                firstT: incoming.derivation?.ok ? incoming.derivation.axis.t[0] : null,
                /* ONE. The new screen derived once, at `watch`, off the buffer it was
                 * handed — it did not wait for the next publish, and it did not replay. */
                derivations: incoming.chartDerivations,
                shotIsLiveShot: incoming.shot === boot.live.shot,
                subscribers: boot.live.shot.subscriberCount(),
                samples: boot.live.shot.get().samples.length,
            },
        };
    },

    /** Everything the header band's state is made of, in one round trip. */
    header() {
        const screen = screenEl();
        const chip = chipEl();
        const header = screen.shadowRoot.querySelector('live-header');
        const rect = header.getBoundingClientRect();
        return {
            machineStateProperty: screen.machineState,
            machineStateAttribute: screen.getAttribute('machine-state'),
            chipText: chip ? chip.textContent.trim() : null,
            chipTone: chip ? chip.getAttribute('tone') : null,
            dim: screen.getAttribute('dim'),
            mode: screen.getAttribute('mode'),
            stopButtons: screen.shadowRoot.querySelectorAll('ui-stop-button').length,
            headerHeight: Number(rect.height.toFixed(2)),
            feedStatus: boot.live.status().machineSnapshot.status,
            frames: boot.live.status().machineSnapshot.frames,
        };
    },

    /** The whole picture, for a diagnostic line. */
    state() {
        const screen = screenEl();
        const card = cardEl();
        const shot = boot.live.shot.get();
        const status = boot.live.status();
        return {
            phase: root.getAttribute('phase'),
            route: root.getAttribute('route'),
            machineState: screen ? screen.machineState : null,
            dim: screen ? screen.getAttribute('dim') : null,
            shotOpen: shot.open,
            shotId: shot.shotId,
            shotPhase: shot.phase,
            samples: shot.samples.length,
            joinedLate: shot.joinedLate,
            dropped: boot.live.shot.dropped(),
            inShot: card?.derivation?.ok ? card.derivation.counts.inShot : 0,
            derivations: screen ? screen.chartDerivations : null,
            paints: card ? card.paintCount : null,
            machineFrames: status.machineSnapshot.frames,
            machineStatus: status.machineSnapshot.status,
            scaleFrames: status.scale.frames,
            scaleStatus: status.scale.status,
            shotStateFrames: status.shotState.frames,
            connectionFrames: status.connection.frames,
            injectedFrames: socketFor('machineSnapshot')?.injected ?? 0,
        };
    },

    /** Take the app off the page. */
    async teardown() {
        const final = globalThis.__loop.state();
        root?.remove();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        boot?.destroy();
        for (const socket of dialled.values()) socket.close();
        dialled.clear();
        boot = null;
        root = null;
        return final;
    },
};

ready = true;

}
