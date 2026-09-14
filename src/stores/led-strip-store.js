/**
 * The LED strip, and its write pattern.
 *
 * A picked colour stages a draft and shows it on the live registers; only Save writes the
 * stored palette. No timer anywhere on the path.
 */
import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';
import { ledColour16ToHex8, ledHex8ToColour16, isColour16, COLOUR16_OFF } from '../lib/led-colour.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/**
 * The three zones ReaPrime's `LedStripState` carries, in its own key order. Not a display
 * list — the ORDER a payload is built in, so a round trip cannot reorder the document.
 */
export const LED_ZONES = Object.freeze(['frontStrip', 'backStrip', 'frontSwitch']);

/** The two banks of `ZoneLedState`. */
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

/** Why a write did not go out. Reportable — the leaf says which, never a shrug. */
export const LED_REFUSAL = Object.freeze({
    NO_STATE: 'noState',
    BAD_COLOUR: 'badColour',
    BAD_TARGET: 'badTarget',
    WRITE_FAILED: 'writeFailed',
    PREVIEW_FAILED: 'previewFailed',
});

const EMPTY_STATE = Object.freeze({
    status: LED_STATUS.NOT_LOADED,
    /** The strip as last read or last written, in wire form. Null until READY. */
    strip: null,
    /** The unsaved palette, or null. What the picker and the grid read. */
    draft: null,
    /** The last refusal, or null. */
    refusal: null,
    /** Bumped on every change, so one subscription re-renders a leaf. */
    version: 0,
    /** True while a save is on the wire. The picker refuses while it is. */
    writing: false,
    dirty: false,
    /** True while the live registers hold something the stored palette does not. */
    previewing: false,
});

const looksLikeStrip = (body) => !!body && typeof body === 'object' && !Array.isArray(body)
    && LED_ZONES.some((zone) => body[zone] && typeof body[zone] === 'object');

/** A zone/bank pair that exists. Anything else is a caller bug, refused rather than sent. */
const isTarget = (zone, bank) => LED_ZONES.includes(zone) && LED_BANKS.includes(bank);

/**
 * The two zones with live registers. `frontSwitch` has none, so it is never previewed and
 * never darkened; it catches up when the colour is saved.
 */
const PREVIEW_ZONES = Object.freeze(['frontStrip', 'backStrip']);

/** The preview route's flat body for the zones being edited, or null when none of them show. */
function previewBodyFor(strip, zones, bank) {
    const body = {};
    for (const zone of PREVIEW_ZONES) {
        if (zones.includes(zone)) body[zone] = strip[zone][bank];
    }
    return Object.keys(body).length === 0 ? null : body;
}

/** A served body as a frozen strip state, or null when it is not one. */
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

const bankIsLit = (strip, bank, zones) => zones.some((zone) => strip[zone][bank] !== COLOUR16_OFF);

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

    let sent = 0;
    let intents = 0;
    let inFlight = 0;
    let peakInFlight = 0;
    let previews = 0;
    let coalesced = 0;
    let previewPeak = 0;
    /** The next preview body, or null. The latest-wins slot: all but the last are dropped. */
    let pendingPreview = null;
    /** Bumped by `forget()`, so an answer from the machine that went away is discarded. */
    let previewEpoch = 0;
    /** The promise of the running preview loop, or null. */
    let showing = null;
    let previewSent = null;
    /** The promise of the running save, or null. Its existence IS "a write in flight". */
    let saving = null;
    let issued = 0;
    let newestAnswer = 0;
    const asked = () => ++issued;
    const outranked = (op) => op < newestAnswer;
    const answered = (op) => { newestAnswer = op; return op; };
    const arrived = () => answered(++issued);
    let displacedStatus = EMPTY_STATE.status;

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
    /** The draft if there is one, otherwise the stored strip. Everything reads through this. */
    const shown = () => { const held = store.get(); return held.draft ?? held.strip; };

    function stage(next) {
        remember(shown(), next);
        publish({ draft: next, dirty: true, refusal: null });
        return true;
    }

    function showOnStrip(body) {
        if (!body) return;
        if (pendingPreview !== null) coalesced += 1;
        pendingPreview = body;
        if (showing) return;
        showing = (async () => {
            try {
                while (pendingPreview !== null) {
                    const next = pendingPreview;
                    pendingPreview = null;
                    const spelling = JSON.stringify(next);
                    if (spelling === previewSent) continue;
                    previews += 1;
                    previewPeak = Math.max(previewPeak, 1);
                    const epoch = previewEpoch;
                    const result = await callRoute(transport, 'postMachineLedStripPreview', { body: next });
                    if (epoch !== previewEpoch) continue;
                    if (!result.ok) {
                        log.warn(`ledStrip preview refused: ${result.status ?? 'no status'}`);
                        publish({ refusal: LED_REFUSAL.PREVIEW_FAILED });
                        continue;
                    }
                    previewSent = spelling;
                    if (store.get().previewing !== true) publish({ previewing: true });
                }
            } finally {
                showing = null;
            }
        })();
    }

    /**
     * END THE PREVIEW. The strips go back to the stored palette for the state the machine
     * is actually in — the firmware picks the bank, because it is the only place that
     * knows. A preview otherwise stands until the next sleep or wake.
     */
    async function endPreview() {
        pendingPreview = null;
        await (showing ?? Promise.resolve());
        previewSent = null;
        if (store.get().previewing !== true) return true;
        const result = await callRoute(transport, 'postMachineLedStripPreviewClear');
        if (!result.ok) {
            log.warn(`ledStrip preview clear refused: ${result.status ?? 'no status'}`);
            return false;
        }
        if (pendingPreview === null && showing === null) publish({ previewing: false });
        return true;
    }

    return {
        subscribe: (listener) => store.subscribe(listener),
        get: () => store.get(),

        /** One zone/bank as '#RRGGBB', read from the draft, or null when there is nothing to read. */
        hex(zone, bank) {
            const strip = shown();
            if (!strip || !isTarget(zone, bank)) return null;
            return ledColour16ToHex8(strip[zone][bank]);
        },

        /** Instrumentation for the write drill. Numbers, not behaviour. */
        counters: () => Object.freeze({
            intents, sent, peakInFlight, dropped: intents - sent, previews, coalesced, previewPeak,
        }),

        /**
         * Read the strip. 404 is the feature gate; 503 is hydration and is transient. An
         * answer a later save has already superseded is discarded.
         */
        async load() {
            const op = asked();
            const standing = store.get().status;
            if (standing !== LED_STATUS.LOADING) displacedStatus = standing;
            publish({ status: LED_STATUS.LOADING });
            const result = await callRoute(transport, 'getMachineLedStrip');
            if (outranked(op)) {
                log.info('discarding a strip a save has already answered for');
                if (store.get().status === LED_STATUS.LOADING) publish({ status: displacedStatus });
                return store.get();
            }
            answered(op);
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
            return publish({ status: LED_STATUS.READY, strip });
        },

        /**
         * Stage a colour on one zone or several and show it on the live registers.
         *
         * @param {string|string[]} zone
         * @param {string} bank
         * @param {string} hex  '#RRGGBB'
         */
        preview(zone, bank, hex) {
            intents += 1;
            const zones = Array.isArray(zone) ? zone : [zone];
            if (zones.length === 0 || !zones.every((one) => isTarget(one, bank))) {
                publish({ refusal: LED_REFUSAL.BAD_TARGET });
                return Promise.resolve(false);
            }
            if (store.get().writing) return Promise.resolve(false);
            const strip = shown();
            if (!strip) {
                publish({ refusal: LED_REFUSAL.NO_STATE });
                return Promise.resolve(false);
            }
            const wire = ledHex8ToColour16(hex);
            if (!isColour16(wire)) {
                publish({ refusal: LED_REFUSAL.BAD_COLOUR });
                return Promise.resolve(false);
            }
            const next = zones.length === 1
                ? withColour(strip, zones[0], bank, wire)
                : withBank(strip, bank, (one, current) => (zones.includes(one) ? wire : current));
            stage(next);
            showOnStrip(previewBodyFor(next, zones, bank));
            return Promise.resolve(true);
        },

        /** Whether any of `zones` is lit on this bank. Null when the target does not exist. */
        isOn(bank, zones) {
            const strip = shown();
            const scope = Array.isArray(zones) ? zones : [zones];
            if (!strip || !LED_BANKS.includes(bank)) return null;
            if (scope.length === 0 || !scope.every((one) => LED_ZONES.includes(one))) return null;
            return bankIsLit(strip, bank, scope);
        },

        /** Black out `zones` on this bank, or restore what each one last was. */
        power(on, bank, zones) {
            intents += 1;
            const scope = Array.isArray(zones) ? zones : [zones];
            if (!LED_BANKS.includes(bank)
                || scope.length === 0 || !scope.every((one) => LED_ZONES.includes(one))) {
                publish({ refusal: LED_REFUSAL.BAD_TARGET });
                return Promise.resolve(false);
            }
            if (store.get().writing) return Promise.resolve(false);
            const strip = shown();
            if (!strip) {
                publish({ refusal: LED_REFUSAL.NO_STATE });
                return Promise.resolve(false);
            }
            const next = withBank(strip, bank, (zone, current) => {
                if (!scope.includes(zone)) return current;
                if (!on) return COLOUR16_OFF;
                if (current !== COLOUR16_OFF) return current;
                const remembered = lastLit.get(`${zone}:${bank}`);
                return isColour16(remembered) ? remembered : LED_DEFAULT_ON;
            });
            stage(next);
            showOnStrip(previewBodyFor(next, scope, bank));
            return Promise.resolve(true);
        },

        /** Resolves when the save is off the wire. Tests only. */
        settled: () => saving ?? Promise.resolve(),

        /** Resolves when the preview loop has drained. Tests only. */
        previewSettled: () => showing ?? Promise.resolve(),

        endPreview,

        /**
         * SAVE. The preview showed the colour; this is what stores it. The answer is the
         * read-back state, so the store holds what the firmware kept rather than what was
         * sent, and the preview ends once it is safely stored.
         */
        commit() {
            if (saving) return saving;
            const draft = store.get().draft;
            if (!draft) return Promise.resolve(true);
            inFlight += 1;
            peakInFlight = Math.max(peakInFlight, inFlight);
            publish({ writing: true, refusal: null });
            saving = (async () => {
                sent += 1;
                const put = await callRoute(transport, 'putMachineLedStrip', { body: draft });
                arrived();
                if (!put.ok) {
                    log.warn(`ledStrip save refused: ${put.status ?? 'no status'}`);
                    publish({
                        refusal: LED_REFUSAL.WRITE_FAILED,
                        status: put.status === 404 ? LED_STATUS.UNSUPPORTED : store.get().status,
                    });
                    return false;
                }
                const settled = (looksLikeStrip(put.data) ? readLedStrip(put.data) : null) ?? draft;
                publish({
                    status: LED_STATUS.READY,
                    strip: settled,
                    draft: null,
                    dirty: false,
                    refusal: null,
                });
                await endPreview();
                return true;
            })().finally(() => {
                inFlight -= 1;
                saving = null;
                publish({ writing: false });
            });
            return saving;
        },

        /**
         * Drop the draft, end the preview and reload NVM. The route RETURNS the reloaded
         * state, so this never re-GETs — the contract row says so in as many words.
         */
        async reset() {
            await endPreview();
            if (store.get().draft !== null) publish({ draft: null, dirty: false, refusal: null });
            const result = await callRoute(transport, 'postMachineLedStripReset', { body: {} });
            arrived();
            if (!result.ok) {
                const status = result.status === 404 ? LED_STATUS.UNSUPPORTED : LED_STATUS.UNAVAILABLE;
                publish({ status });
                return false;
            }
            const strip = readLedStrip(result.data);
            if (strip === null) return false;
            publish({
                status: LED_STATUS.READY, strip, draft: null, refusal: null, dirty: false,
            });
            return true;
        },

        /** The machine went away. No timer to clear, because there is none. */
        forget() {
            pendingPreview = null;
            previewSent = null;
            previewEpoch += 1;
            /* The memory goes with it: "what colour the front strip was" is a fact about a
             * machine, and carrying it across a machine change would restore one machine's
             * colour onto another's strip. */
            lastLit.clear();
            newestAnswer = ++issued;
            displacedStatus = EMPTY_STATE.status;
            store.set({ ...EMPTY_STATE });
        },

        stop() { store.destroy(); },
    };
}
