/**
 * The LED strip, and its write pattern.
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
    dirty: false,
});

/** A zone/bank pair that exists. Anything else is a caller bug, refused rather than sent. */
const isTarget = (zone, bank) => LED_ZONES.includes(zone) && LED_BANKS.includes(bank);

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

function withBank(strip, bank, pick) {
    const next = {};
    for (const name of LED_ZONES) {
        next[name] = Object.freeze({ ...strip[name], [bank]: pick(name, strip[name][bank]) });
    }
    return Object.freeze(next);
}

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

    let pendingColour = null;

    /** The promise of the running drain, or null. Its existence IS "a write in flight". */
    let pump = null;

    /** How many PUTs are on the wire. Never above 1; the drill asserts the maximum. */
    let inFlight = 0;
    let peakInFlight = 0;

    /** How many PUTs were actually sent — the drop count is (intents - sent). */
    let sent = 0;
    let intents = 0;

    const lastLit = new Map();

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

    /**
     * The two colours the preview route takes, or null when there is no strip yet.
     *
     * THE LIVE REGISTERS ARE FRONT AND REAR. `frontSwitch` has none, so it is never
     * sent and never darkened; it catches up when the colour is saved.
     *
     * THE COLOUR COMES FROM THE BANK BEING EDITED, not from the machine's current one.
     * That is the whole point: it is what makes an ASLEEP colour visible while the
     * machine is awake, which a stored write cannot do.
     *
     * A wire colour IS the 12-hex spelling the route takes, so nothing is converted.
     */
    function previewBody(strip, bank) {
        if (!strip || !LED_BANKS.includes(bank)) return null;
        return { frontStrip: strip.frontStrip[bank], backStrip: strip.backStrip[bank] };
    }

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
            /* THE PREVIEW ROUTE, NOT THE SAVE. `putMachineLedStrip` writes the four
             * STORED registers and every one of them is a flash write, so dragging
             * against it wrote flash on every frame and saved a colour the finger only
             * passed over. This route writes the two LIVE registers: nothing is stored,
             * nothing reaches flash, and it is the only way to show an ASLEEP colour on
             * an awake machine — the firmware applies a stored colour only when it is
             * already in the state that colour belongs to.
             *
             * A STRIP THE BODY DOES NOT NAME IS LEFT ALONE, so a zone group that moves
             * one strip must not darken the other. `frontSwitch` has no live register
             * and is therefore never sent; it catches up on the save. */
            const body = previewBody(next, intent.bank);
            if (!body) return true;
            const result = await callRoute(transport, 'postMachineLedStripPreview', { body });
            if (!result.ok) {
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

        /** Instrumentation for the write drill. Numbers, not behaviour. */
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

        preview(zone, bank, hex) {
            intents += 1;
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
                    bank,
                    strip: withBank(strip, bank, (one, current) => (
                        zones.includes(one) ? wire : current)),
                };
            markDirty();
            if (pump) return pump;
            pump = drain().finally(() => { pump = null; });
            return pump;
        },

        isOn(bank) {
            const strip = store.get().strip;
            if (!strip || !LED_BANKS.includes(bank)) return null;
            return bankIsLit(strip, bank);
        },

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
                if (current !== COLOUR16_OFF) return current;
                const remembered = lastLit.get(`${zone}:${bank}`);
                return isColour16(remembered) ? remembered : LED_DEFAULT_ON;
            });

            pendingColour = { kind: 'strip', bank, strip: next };
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
         * SAVE. The preview showed the colour; this is what stores it.
         *
         * TWO CALLS, AND THE FIRST IS THE ONE THAT MATTERS. `putMachineLedStrip` writes
         * the four stored registers — the awake and asleep colours the firmware applies
         * on every transition — and the app writes only the ones that changed, so a
         * palette re-saved unchanged costs no flash write at all. `commit` follows it
         * because the route exists and a machine whose save IS a separate step would
         * need it; on this firmware it is an accepted no-op.
         */
        async commit() {
            const strip = store.get().strip;
            if (!strip) {
                publish({ refusal: LED_REFUSAL.NO_STATE });
                return false;
            }
            const saved = await callRoute(transport, 'putMachineLedStrip', { body: strip });
            if (!saved.ok) {
                if (saved.status === 404) publish({ status: LED_STATUS.UNSUPPORTED });
                else publish({ refusal: LED_REFUSAL.WRITE_FAILED });
                return false;
            }
            const result = await callRoute(transport, 'postMachineLedStripCommit', { body: {} });
            if (!result.ok && result.status === 404) publish({ status: LED_STATUS.UNSUPPORTED });
            if (result.ok) publish({ dirty: false });
            return Boolean(result.ok);
        },

        /**
         * END THE PREVIEW. The strips go back to the stored palette for the state the
         * machine is actually in — the firmware picks the bank, because it is the only
         * place that knows. A preview otherwise stands until the next sleep or wake.
         */
        async clearPreview() {
            const result = await callRoute(transport, 'postMachineLedStripPreviewClear', { body: {} });
            if (!result.ok && result.status === 404) publish({ status: LED_STATUS.UNSUPPORTED });
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
