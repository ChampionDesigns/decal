/**
 * led-strip-store.js — the LED strip, and D7's decided write pattern.
 * Wave 5.4, row `d7-led-live-preview`.
 *
 * SCOPE Part 5 §4: "**D7 (overruled -> in v1): the LED live preview works.** All four
 * endpoints exist and the old skin's failure was a trailing-edge debounce that could
 * never fire mid-drag (`settings.js:4114`, verified). The rewrite's pattern is decided:
 * no timer — one write in flight, `pendingColour`, latest-wins."
 *
 * ===========================================================================
 * THE PATTERN, AND WHY EVERY TIMER IS A BLOCK
 * ===========================================================================
 *
 * The old skin debounced colour writes on the TRAILING edge. A trailing-edge debounce
 * fires `wait` ms after the last event, so during a drag — which is a continuous stream
 * of events closer together than `wait` — it never fires at all. The preview appeared to
 * do nothing until the finger came off, which is precisely when a preview is useless.
 * Raising or lowering `wait` cannot fix that; the shape is wrong.
 *
 * What replaces it has no clock in it:
 *
 *     pendingColour   the LATEST intent the user has expressed, or null
 *     one write in flight   a second PUT is never issued while one is on the wire
 *     latest-wins     when the running write resolves, the pending intent — whatever it
 *                     has become by then — is sent, and everything between is DROPPED
 *
 * Part 1: "That self-limits to what the BLE path can sustain, with no magic number and
 * no backlog." A fast machine gets every frame; a slow one gets the newest colour it can
 * take and never a queue of stale ones. There is no number to tune and nothing to get
 * wrong at a different bitrate.
 *
 * THERE IS NO `setTimeout`, NO `setInterval`, NO DEBOUNCE AND NO THROTTLE IN THIS FILE
 * OR ANYWHERE DOWNSTREAM OF `preview()`. `test/settings-bespoke.test.mjs` greps the path
 * for all four spellings and the render suite instruments the client and counts, so the
 * claim is checked twice: once against the source and once against behaviour. A timer
 * added here fails the build.
 *
 * ===========================================================================
 * THE FOUR ROUTES, RE-VERIFIED AT THE PIN ON THE DAY THIS WAS WRITTEN
 * ===========================================================================
 *
 * Part 7's D7 warning — "no finding in any audit document is acted on without opening
 * both sides first" — so both sides were opened. ReaPrime `2b047d02`,
 * `lib/src/services/webserver/de1handler.dart`:
 *
 *   :186  GET  /api/v1/machine/ledStrip         200 LedStripState | 503 hydration | 404 gate
 *   :202  PUT  /api/v1/machine/ledStrip         200 {status:'accepted'}  <- jsonOk, NOT 202
 *   :221  POST /api/v1/machine/ledStrip/commit  202 with a NULL BODY
 *   :230  POST /api/v1/machine/ledStrip/reset   200 the reloaded NVM state | 503 read failed
 *
 * TWO HANDLER FACTS THIS FILE IS BUILT ON:
 *
 *   (a) PUT PUSHES LIVE AND DOES NOT PERSIST; `commit` writes NVM; `reset` reloads NVM
 *       and RETURNS the new state, so nothing has to re-GET after a reset. That is what
 *       makes a live preview safe: nothing the user drags past is written to the machine
 *       permanently until they commit.
 *   (b) `jsonAccepted()` (`json_response.dart:26`) sends `body: data != null ? ... : null`
 *       with `Content-Type: application/json`. The commit route calls it with NO data, so
 *       it is a 202 whose body is empty while claiming to be JSON — `response.json()` on
 *       it throws. `rea-transport.js` already reads the body as text first and maps an
 *       empty one to `data: null` on an ok status, so this arrives correctly; it is
 *       recorded here because a future client that reaches for `.json()` will not.
 *
 * `POST /machine/ledStrip/preview` and `.../preview/clear` DO NOT EXIST. Re-verified on
 * the day: `grep -rn 'ledStrip/preview|previewLedStrip|preview/clear' lib/` over the
 * worktree at the pin returns NOTHING, against 30 hits for `ledStrip`. They are
 * `src/data/EXCLUDED.md:28`'s upstream ask. Q5 is answered accordingly and reversibly —
 * see the DQ in this wave's digest.
 *
 * ===========================================================================
 * FAIL-CLOSED, AND THE TWO 503s THAT MEAN DIFFERENT THINGS
 * ===========================================================================
 *
 * 404 on any of the four is `_bengleFirmwareGate(de1, 'ledStrip')` — the FEATURE IS
 * ABSENT and the controls must not render. 503 on GET is "hydration not yet complete",
 * which is TRANSIENT: the contract row says in as many words "retry or wait; do not
 * conclude the feature is absent". They are different statuses in this store for that
 * reason, and neither is smoothed into the other.
 *
 * The screen gates on the SERVED CAPABILITY ARRAY as well (A3, `ledStrip` is one of the
 * seven `SERVED_CAPABILITIES`), and that gate is the one that decides whether the surface
 * exists at all. This store's statuses decide what a surface that DOES exist shows.
 *
 * NO DOM. A store, in `src/stores`, over the generated route table — never a spelled path.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';
import { ledColour16ToHex8, ledHex8ToColour16, isColour16, COLOUR16_OFF } from '../lib/led-colour.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/**
 * The three zones ReaPrime's `LedStripState` carries, in its own key order
 * (`led_strip.dart:73-79`). Not a display list — the ORDER a payload is built in, so a
 * round trip cannot reorder the document.
 */
export const LED_ZONES = Object.freeze(['frontStrip', 'backStrip', 'frontSwitch']);

/** The two banks of `ZoneLedState` (`led_strip.dart:44-47`). */
export const LED_BANKS = Object.freeze(['awake', 'sleeping']);

/**
 * The colour a zone comes back on to when nothing remembers what it was.
 *
 * SOURCE settings.js:3827 `const LED_DEFAULT_ON = 'FFFFAAAA5555'; // warm white —
 * default colour when powering a zone on with no history`. Carried verbatim: it is the
 * one value in the power path that is a CHOICE rather than a consequence, and inventing
 * a second warm white here would make the two skins disagree about what "on" looks like
 * on a machine whose strip has never been lit in this session.
 */
export const LED_DEFAULT_ON = 'FFFFAAAA5555';

/** What the store knows about the strip. */
export const LED_STATUS = Object.freeze({
    NOT_LOADED: 'notLoaded',
    LOADING: 'loading',
    READY: 'ready',
    /** 404 — `_bengleFirmwareGate` says this machine has no LED strip. */
    UNSUPPORTED: 'unsupported',
    /** 503 hydration, or the request never landed. Transient; `load()` again. */
    UNAVAILABLE: 'unavailable',
});

/** Why a preview did not go out. Reportable — the leaf says which, never a shrug. */
export const LED_REFUSAL = Object.freeze({
    NO_STATE: 'noState',
    BAD_COLOUR: 'badColour',
    BAD_TARGET: 'badTarget',
    WRITE_FAILED: 'writeFailed',
});

const EMPTY_STATE = Object.freeze({
    status: LED_STATUS.NOT_LOADED,
    /** The strip as last read or last written, in wire form. Null until READY. */
    strip: null,
    /** The last refusal, or null. */
    refusal: null,
    /** Bumped on every change, so one subscription re-renders a leaf. */
    version: 0,
    /** True while a PUT is on the wire. The leaf may show it; nothing depends on it. */
    writing: false,
    /**
     * TRUE WHEN THE STRIP IS SHOWING SOMETHING NVM DOES NOT HOLD.
     *
     * THE TRAP THIS CLOSES, and it is a real one. `PUT /machine/ledStrip` PUSHES LIVE AND
     * DOES NOT PERSIST — this file's own contract note says so — so every wheel drag and
     * every preset press lights the machine and writes nothing that survives a power cycle.
     * Only `POST /machine/ledStrip/commit` writes NVM. The Lighting leaf carries no registry
     * rows, so the settings screen's change count was ALWAYS ZERO on it, and the header's
     * primary Save therefore took the not-dirty branch and simply left the screen. A person
     * picked colours, pressed the big Save at the top right, walked away, and lost them at
     * the next power cycle.
     *
     * SO AN UNCOMMITTED PREVIEW IS A PENDING CHANGE, counted and committed like any other,
     * which is the one-Save model the screen already states (D11: a count crosses to the
     * header). Set by `preview` and `power`, cleared by `commit` and `reset` — reset being
     * "reload NVM", which is Cancel's semantics exactly.
     */
    dirty: false,
});

/** A zone/bank pair that exists. Anything else is a caller bug, refused rather than sent. */
const isTarget = (zone, bank) => LED_ZONES.includes(zone) && LED_BANKS.includes(bank);

/**
 * Read a `LedStripState` body into the shape this store holds: every zone present, every
 * bank a readable 12-char colour, black where the server said nothing.
 *
 * `Color16.fromJson` returns `off` for anything under 12 characters, so black IS the
 * server's answer for a malformed colour and this agrees with it rather than inventing an
 * absence the write side could not express.
 */
export function readLedStrip(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const out = {};
    for (const zone of LED_ZONES) {
        const served = body[zone];
        const bank = {};
        for (const name of LED_BANKS) {
            const value = served && typeof served === 'object' ? served[name] : null;
            bank[name] = isColour16(value) ? value.toUpperCase() : COLOUR16_OFF;
        }
        out[zone] = Object.freeze(bank);
    }
    return Object.freeze(out);
}

/** The strip with ONE zone/bank replaced. A new object — nothing here is mutated. */
function withColour(strip, zone, bank, wire) {
    const next = {};
    for (const name of LED_ZONES) {
        next[name] = name === zone
            ? Object.freeze({ ...strip[name], [bank]: wire })
            : strip[name];
    }
    return Object.freeze(next);
}

/**
 * The strip with ONE BANK rewritten across EVERY zone, by a function of what is there.
 *
 * The power switch is the only caller: it is not three colour writes, it is one strip.
 * `pick(zone, current)` returns the wire colour that zone's bank should hold.
 */
function withBank(strip, bank, pick) {
    const next = {};
    for (const name of LED_ZONES) {
        next[name] = Object.freeze({ ...strip[name], [bank]: pick(name, strip[name][bank]) });
    }
    return Object.freeze(next);
}

/** Is this bank lit anywhere? Slate's `isOn`, which reads the colour and stores nothing. */
const bankIsLit = (strip, bank) => LED_ZONES.some((zone) => strip[zone][bank] !== COLOUR16_OFF);

/**
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} [deps.logger]
 */
export function createLedStripStore({ transport, logger = NOOP_LOGGER } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createLedStripStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger.scope ? logger.scope('ledStrip') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'ledStrip', logger: log, freeze: false });

    /* ---- THE WHOLE OF THE WRITE PATTERN. Three variables, no clock. -------- */

    /**
     * The LATEST intent, or null. Overwritten, never queued — that is "latest-wins".
     *
     * TWO SHAPES, ONE SLOT, and the slot is what makes the pattern hold:
     *
     *     { kind: 'colour', zone, bank, wire }   one cell, from the picker
     *     { kind: 'strip',  strip }              a whole strip, already computed
     *
     * The power switch needs the second, and needs it for a mechanical reason rather
     * than a tidy one. It changes THREE zones at once, and three back-to-back
     * `preview()` calls would be three intents into one slot: the first two are
     * overwritten and never sent, and the strip that goes out has one zone black and
     * two unchanged. Latest-wins is correct and the unit was wrong — a PUT carries the
     * WHOLE strip either way (see sendOne), so "one intent" has to mean "one strip".
     */
    let pendingColour = null;

    /** The promise of the running drain, or null. Its existence IS "a write in flight". */
    let pump = null;

    /** How many PUTs are on the wire. Never above 1; the drill asserts the maximum. */
    let inFlight = 0;
    let peakInFlight = 0;

    /** How many PUTs were actually sent — the drop count is (intents - sent). */
    let sent = 0;
    let intents = 0;


    /**
     * THE LAST LIT COLOUR PER `zone:bank`, so a zone switched off can come back.
     *
     * SOURCE settings.js:3819 `let ledLastLit = {}; // last lit colour per
     * 'zoneKey:state', restored on power-on`, and the rest of Slate's power semantics
     * follows from it: OFF remembers what was there and writes black, ON puts the
     * remembered colour back, and POWER ITSELF IS NEVER STORED — it is read off the
     * colour (settings.js:3880 `const isOn = ledCurrentColor16() !== '000000000000'`),
     * which is why a value slider dragged to zero reads as Off with no state to
     * reconcile.
     *
     * IN THE STORE'S MEMORY, NOT IN A STORAGE ROUTE, and it is a judgement call taken
     * on reversibility (see the wave's deferred question). A Map here has no key in
     * the routing table, no scope decision (is "what colour it was" a property of the
     * machine or of this tablet?), no shape to version and nothing to migrate; the
     * cold-start case is already answered by LED_DEFAULT_ON, which is the answer Slate
     * gives too. Persisting it later is a load-and-save pair around this one Map.
     *
     * It is filled by `remember()` below on EVERY write rather than only by the power
     * switch, so the picker's own drag to black is remembered as well — which is what
     * Slate's ledApplyPreset does (settings.js:4333) and is why powering back on after
     * choosing black by hand restores the colour before it.
     */
    const lastLit = new Map();

    /**
     * Note every cell that is about to go dark, before it does.
     *
     * Called with the strip as it IS and the strip as it WILL BE, on the one path every
     * write goes through, so no caller has to remember to do this and no second caller
     * can forget.
     */
    function remember(before, after) {
        for (const zone of LED_ZONES) {
            for (const bank of LED_BANKS) {
                const was = before[zone][bank];
                if (after[zone][bank] === COLOUR16_OFF && was !== COLOUR16_OFF) {
                    lastLit.set(`${zone}:${bank}`, was);
                }
            }
        }
    }

    const publish = (patch) => store.set({ ...store.get(), ...patch, version: store.get().version + 1 });

    /** Say the strip is showing something NVM does not hold. See `dirty` on the state. */
    const markDirty = () => { if (!store.get().dirty) publish({ dirty: true }); };

    async function sendOne(intent) {
        const strip = store.get().strip;
        if (!strip) {
            publish({ refusal: LED_REFUSAL.NO_STATE });
            return false;
        }
        const next = intent.kind === 'strip'
            ? intent.strip
            : withColour(strip, intent.zone, intent.bank, intent.wire);
        remember(strip, next);
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        publish({ strip: next, writing: true, refusal: null });
        try {
            sent += 1;
            const result = await callRoute(transport, 'putMachineLedStrip', { body: next });
            if (!result.ok) {
                /* THE PAINTED COLOUR IS NOT ROLLED BACK, and that is deliberate for a
                 * PREVIEW: the user is dragging, the next write is already coming, and
                 * snapping the swatch back mid-drag would fight the finger. The refusal is
                 * reported and `load()` is the way back to the machine's truth. This is
                 * the opposite of the settings store's rule for a STORED value, and the
                 * difference is that this write is not persistence — `commit` is. */
                log.warn(`ledStrip preview refused: ${result.status ?? 'no status'}`);
                publish({ refusal: LED_REFUSAL.WRITE_FAILED, status: result.status === 404
                    ? LED_STATUS.UNSUPPORTED
                    : store.get().status });
                return false;
            }
            return true;
        } finally {
            inFlight -= 1;
            if (inFlight === 0) publish({ writing: pendingColour !== null });
        }
    }

    /**
     * Drain the pending intent until there is none left.
     *
     * The loop condition IS the pattern: while a colour is pending, take it (clearing the
     * slot so a newer one can land while this write is on the wire), send it, and look
     * again. Everything that arrived during the await was overwritten in place and is
     * never sent — dropped frames, on purpose, with no queue to grow.
     */
    async function drain() {
        while (pendingColour !== null) {
            const intent = pendingColour;
            pendingColour = null;
            await sendOne(intent);
        }
    }

    return {
        subscribe: (listener) => store.subscribe(listener),
        get: () => store.get(),

        /** The strip as wire colours, or null. */
        strip: () => store.get().strip,

        /** One zone/bank as '#RRGGBB', or null when there is no state to read. */
        hex(zone, bank) {
            const strip = store.get().strip;
            if (!strip || !isTarget(zone, bank)) return null;
            return ledColour16ToHex8(strip[zone][bank]);
        },

        /** Instrumentation for the D7 drill. Numbers, not behaviour. */
        counters: () => Object.freeze({ intents, sent, peakInFlight, dropped: intents - sent }),

        /**
         * Read the strip. 404 is the feature gate; 503 is hydration and is transient.
         */
        async load() {
            publish({ status: LED_STATUS.LOADING, refusal: null });
            const result = await callRoute(transport, 'getMachineLedStrip');
            if (!result.ok) {
                const status = result.status === 404 ? LED_STATUS.UNSUPPORTED : LED_STATUS.UNAVAILABLE;
                log.info(`ledStrip read: ${status} (${result.status ?? 'no status'})`);
                return publish({ status, strip: null });
            }
            const strip = readLedStrip(result.data);
            if (strip === null) {
                log.warn('ledStrip answered a body that is not a strip state');
                return publish({ status: LED_STATUS.UNAVAILABLE, strip: null });
            }
            return publish({ status: LED_STATUS.READY, strip, refusal: null });
        },

        /**
         * THE LIVE PREVIEW. One call per user intent, however fast they arrive.
         *
         * Returns the drain promise so a test — and only a test — can wait for quiet.
         * Nothing in the screen awaits it: the paint has already happened by the time
         * this returns, which is the whole point of a preview.
         */
        preview(zone, bank, hex) {
            intents += 1;
            /* MANY ZONES, ONE INTENT (Ben, 24 Aug 2026). The leaf's Zone bank is no longer
             * one wire zone per cell: "the power button should follow the front LED
             * colour, make the 3 option 'Both' and it changes the front (and switch) and
             * back at the same time keeping the colours the same." So Front is TWO wire
             * zones and Both is THREE.
             *
             * IT MUST BE ONE INTENT AND THE REASON IS THIS SLOT. `pendingColour`'s own
             * paragraph says it: three back-to-back `preview()` calls are three intents
             * into one latest-wins slot, "the first two are overwritten and never sent,
             * and the strip that goes out has one zone black and two unchanged". The power
             * switch already had to solve this and solved it by composing a whole strip;
             * this takes the same road rather than a second one.
             *
             * A SINGLE ZONE STILL TAKES THE SINGLE-ZONE PATH, so nothing about the
             * existing intent shape moves and the drill that counts drops is unchanged. */
            const zones = Array.isArray(zone) ? zone : [zone];
            if (zones.length === 0 || !zones.every((one) => isTarget(one, bank))) {
                publish({ refusal: LED_REFUSAL.BAD_TARGET });
                return Promise.resolve(false);
            }
            const strip = store.get().strip;
            if (!strip) {
                publish({ refusal: LED_REFUSAL.NO_STATE });
                return Promise.resolve(false);
            }
            const wire = ledHex8ToColour16(hex);
            if (!isColour16(wire)) {
                publish({ refusal: LED_REFUSAL.BAD_COLOUR });
                return Promise.resolve(false);
            }

            pendingColour = zones.length === 1
                ? { kind: 'colour', zone: zones[0], bank, wire }
                : {
                    kind: 'strip',
                    strip: withBank(strip, bank, (one, current) => (
                        zones.includes(one) ? wire : current)),
                };
            /* THE INTENT IS WHAT MAKES IT DIRTY, not the PUT landing. Latest-wins can DROP
             * a send — that is the point of the slot — and a strip whose intent was dropped
             * is still a strip showing something NVM does not hold, because the one that
             * did go out was later. Marking here rather than in `drain` means the count
             * cannot go stale behind a drop. */
            markDirty();
            if (pump) return pump;
            pump = drain().finally(() => { pump = null; });
            return pump;
        },

        /**
         * IS THIS BANK LIT? Derived, never stored — Slate's `isOn` (settings.js:3880).
         *
         * A bank is on when ANY zone in it is showing a colour, which is the reading a
         * person gives the machine across the kitchen: some light, or none. `null` when
         * there is no state to read, so a leaf can tell "off" from "not known yet"
         * rather than painting a switch that is guessing.
         */
        isOn(bank) {
            const strip = store.get().strip;
            if (!strip || !LED_BANKS.includes(bank)) return null;
            return bankIsLit(strip, bank);
        },

        /**
         * THE POWER SWITCH. Off writes black to every zone of one bank; on restores what
         * each of them was last showing.
         *
         * ONE INTENT, NOT THREE. It goes through the same latest-wins slot as the
         * picker, as one whole-strip intent — see `pendingColour` for why three
         * `preview()` calls would send one zone and silently drop two. No timer, here
         * or anywhere downstream; that is this file's header law.
         *
         * THE BANK IS THE LEAF'S CURRENT ONE, and the zones are all of them. Slate
         * scoped the toggle to the selected zone AND the selected state
         * (settings.js:4344-4356); Decal's zone bank picks exactly one zone at a
         * time where Slate's had a "Both", so a per-zone power switch would be a
         * control that turns off a third of the lights. All zones, one bank: the awake
         * and asleep palettes stay separate, which is the whole reason there are two.
         *
         * @param {boolean} on
         * @param {string} bank  an LED_BANKS member
         * @returns {Promise<boolean>} the drain promise, for a test
         */
        power(on, bank) {
            intents += 1;
            if (!LED_BANKS.includes(bank)) {
                publish({ refusal: LED_REFUSAL.BAD_TARGET });
                return Promise.resolve(false);
            }
            const strip = store.get().strip;
            if (!strip) {
                publish({ refusal: LED_REFUSAL.NO_STATE });
                return Promise.resolve(false);
            }

            const next = withBank(strip, bank, (zone, current) => {
                if (!on) return COLOUR16_OFF;
                /* Already lit stays exactly as it is: powering on must never repaint a
                 * zone the user can see, and a bank is "on" when ANY zone is lit, so
                 * this branch runs for the dark ones in a partly-lit bank too. */
                if (current !== COLOUR16_OFF) return current;
                const remembered = lastLit.get(`${zone}:${bank}`);
                return isColour16(remembered) ? remembered : LED_DEFAULT_ON;
            });

            pendingColour = { kind: 'strip', strip: next };
            /* THE POWER SWITCH DIRTIES TOO. Turning the strip off is as much a change to
             * what the machine will show at the next power cycle as picking a colour is. */
            markDirty();
            if (pump) return pump;
            pump = drain().finally(() => { pump = null; });
            return pump;
        },

        /** Resolves when nothing is pending and nothing is on the wire. Tests only. */
        settled: () => pump ?? Promise.resolve(),

        /**
         * Persist what the strip is currently showing to NVM.
         *
         * The route takes no body the handler reads (`Request _`), but the generated table
         * declares one as required, so an empty object goes out: satisfying the declared
         * contract costs nothing and does not depend on the handler staying lenient.
         */
        async commit() {
            const result = await callRoute(transport, 'postMachineLedStripCommit', { body: {} });
            if (!result.ok && result.status === 404) publish({ status: LED_STATUS.UNSUPPORTED });
            /* ONLY A SUCCESSFUL COMMIT CLEARS IT, which is the same rule the settings
             * model's own commit follows: a refused write leaves the intent staged and the
             * count non-zero, so the person can see there is still something to save. */
            if (result.ok) publish({ dirty: false });
            return Boolean(result.ok);
        },

        /**
         * Reload NVM and take the answer. The route RETURNS the reloaded state, so this
         * never re-GETs — the contract row says so in as many words.
         */
        async reset() {
            const result = await callRoute(transport, 'postMachineLedStripReset', { body: {} });
            if (!result.ok) {
                const status = result.status === 404 ? LED_STATUS.UNSUPPORTED : LED_STATUS.UNAVAILABLE;
                publish({ status });
                return false;
            }
            const strip = readLedStrip(result.data);
            if (strip === null) return false;
            /* RELOADING NVM IS DISCARDING THE PREVIEW, so the strip is by definition
             * showing exactly what NVM holds and there is nothing left to save. */
            publish({ status: LED_STATUS.READY, strip, refusal: null, dirty: false });
            return true;
        },

        /** The machine went away. No timer to clear, because there is none. */
        forget() {
            pendingColour = null;
            /* The memory goes with it: "what colour the front strip was" is a fact
             * about a machine, and carrying it across a machine change would restore
             * one machine's colour onto another's strip. */
            lastLit.clear();
            store.set({ ...EMPTY_STATE });
        },

        stop() { store.destroy(); },
    };
}
