/**
 * The Live screen's controller for the connection-and-gates cluster.
 */

import { FEED } from 'src/stores/live-stores.js';
import { hasReading } from 'src/data/reading.js';
import { valueOf, FEED_STATUS } from 'src/stores/feed-store.js';
import { CUP_WARMER_STATUS, isWarmerOn } from 'src/stores/cup-warmer.js';
import { isNoReading } from 'src/data/reading.js';
import { createLiveGates } from 'src/screens/live-gates.js';
import { dimStateFor, liveDim } from 'src/screens/live-dimming.js';
import { r2MachineLimits } from 'src/data/adapters-r.js';
import {
    isRunning, stateForKey, DEFAULT_PRESETS,
    steamStopFrom, waterStopFrom, armValueFor,
} from 'src/lib/live-targets.js';
import { resolveBindings } from 'src/lib/key-bindings.js';
import { DEFAULT_CLOCK_FORMAT, normaliseClockFormat } from 'src/lib/wall-clock.js';

import { READINGS_MIN_MS, presenceOf, readingsDue } from 'src/lib/readings-rate.js';
import {
    CHART_MODE, chartModeFor, initialChartMode, initialSteamGuard, isSteamHoldActive,
    isSteamPouring, steamGuardFor, steamGuardRemainingMs, steamHoldRemainingMs,
} from 'src/lib/steam-chart.js';
import { createSteamBuffer } from 'src/stores/steam-buffer.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
import { DYE2_PLUGIN_ID } from 'src/lib/plugin-pages.js';
import { MACHINE_STATE } from 'src/data/machine-state.js';
import { ARM_STATUS } from 'src/stores/profile-arm-store.js';
import { connectionSurface } from 'src/lib/connection-surface.js';
import { logger } from 'src/lib/logger.js';
import { t } from 'src/lib/i18n.js';
import { normaliseTankUnit, DEFAULT_TANK_UNIT } from 'src/lib/tank-volume.js';
import { normaliseUnit, DEFAULT_TEMP_UNIT } from 'src/lib/temperature.js';

/** The stores this controller watches, by the name they carry on the boot object. */
/** The feeds this controller subscribes to, and the field each one's state lands on. */
const WATCHED_FEEDS = Object.freeze([
    Object.freeze([FEED.CONNECTION, 'connection']),
    Object.freeze([FEED.MACHINE, 'machine']),
    Object.freeze([FEED.SCALE, 'scale']),
    Object.freeze([FEED.WATER, 'water']),
    Object.freeze([FEED.MILK_PROBE, 'milk']),
    Object.freeze([FEED.ESTIMATOR, 'estimator']),
]);

const WRITE_REFUSED = 'The machine did not accept that setting';

const ARM_UNDELIVERED = 'The machine has not been given this profile yet';

const ARM_NO_MACHINE = 'No machine is connected. It is saved, and will be sent as soon as one is.';

const ARM_RETRYING = 'It is saved, and the machine will be sent it again.';

const PRESET_ROWS = Object.freeze({
    drinkWeight: 'drinkOutPresets',
    steamFlow: 'steamFlowPresets',
});

const PRESET_INDEX_ROWS = Object.freeze({
    steamFlow: 'steamFlowPresetIndex',
});

const log = logger.scope ? logger.scope('live') : logger;

function bank(held, rowName = 'preset bank') {
    if (!Array.isArray(held) || held.length === 0) return null;
    const bad = held.findIndex((cell) => typeof cell !== 'number' || !Number.isFinite(cell));
    if (bad >= 0) {
        log.warn(`${rowName}: cell ${bad} is ${JSON.stringify(held[bad])}, which is not a number — `
            + 'the stored bank is ignored and the shipped one is drawn. '
            + 'Coercing it would draw a zero, or one cell fewer, with nothing saying so.');
        return null;
    }
    return Object.freeze([...held]);
}

const WATCHED_STORES = Object.freeze([
    'capabilities', 'machineInfo', 'arm', 'workflow', 'library', 'shotHistory', 'cupWarmer',
    'appSettings', 'plugins',
    'weather',
]);

export const STALENESS_TICK_MS = 500;

const REMEMBERED_TARGETS = Object.freeze({
    dose: 'targetDoseWeight',
    drinkWeight: 'targetYield',
    grind: 'grinderSetting',
});

export class LiveWiring {
    /**
     * @param {import('lit').ReactiveControllerHost & {boot?: object}} host
     */
    constructor(host) {
        this.host = host;
        this.boot = null;
        /** Unsubscribes, in the order they were made. Emptied on detach. */
        this.subscriptions = [];
        this.gates = null;
        /** The staleness tick's interval id while a boot is attached, else null. */
        this.ticker = null;

        this.connection = null;
        this.machine = null;
        this.capabilities = null;
        this.arm = null;
        /** The rail's document, off the workflow store. Its targets are the rail's values. */
        this.workflow = null;
        /** The profile listing and the five favourite slots. */
        this.library = null;
        this.shotHistory = null;
        /** The cup warmer's frame — the header's Warmer control reads it. */
        this.cupWarmer = null;
        /** ReaPrime's own preferences document, whole. The rail reads ONE field of it —
         *  `stopHotWaterAtWeight`, which is what ends a hot-water pour. */
        this.appSettings = null;
        /** ReaPrime's installed-plugin listing, whole. This controller reads ONE fact out
         *  of it — whether DYE2 is loaded — and the screen draws one button on that. */
        this.plugins = null;
        this.shotIndex = 0;
        /** Whether the machine was running at the previous update — the shot-start edge. */
        this.wasRunning = false;
        /** The scale feed's published state — the gauge cluster's weight channel. */
        this.scale = null;
        /** The tank's level and refill threshold, in millimetres — the TANK tile. */
        this.water = null;
        this.milk = null;
        this.estimator = null;

        this.chartMode = initialChartMode();
        this.steamGuard = initialSteamGuard();
        this.steam = createSteamBuffer({ logger: null });
        this.#steamHold = null;
        this.#steamGuardTimer = null;

        this.presets = null;
        this.keyBindings = null;
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this.tankUnit = DEFAULT_TANK_UNIT;
        this.tempUnit = DEFAULT_TEMP_UNIT;
        this.now = () => Date.now();

        host.addController(this);
    }

    hostConnected() {
        this.#attach(this.host.boot ?? null);
        this.host.addEventListener('connect-device', this.#onConnectDevice);
        this.host.addEventListener('refusal-dismiss', this.#onRefusalDismiss);
        this.host.addEventListener('target-change', this.#onTargetChange);
        this.host.addEventListener('warmer-toggle', this.#onWarmerToggle);
        this.host.addEventListener('shot-step', this.#onShotStep);
        this.host.addEventListener('scale-tare', this.#onScaleTare);
        this.host.addEventListener('machine-request', this.#onMachineRequest);
        this.host.addEventListener('preset-edit', this.#onPresetEdit);
        this.host.addEventListener('favourite-action', this.#onFavouriteAction);
        this.host.addEventListener('rating-change', this.#onRatingChange);
        this.host.addEventListener('notes-change', this.#onNotesChange);
        this.#installKeys();
    }

    hostDisconnected() {
        this.host.removeEventListener('connect-device', this.#onConnectDevice);
        this.host.removeEventListener('refusal-dismiss', this.#onRefusalDismiss);
        this.host.removeEventListener('target-change', this.#onTargetChange);
        this.host.removeEventListener('warmer-toggle', this.#onWarmerToggle);
        this.host.removeEventListener('shot-step', this.#onShotStep);
        this.host.removeEventListener('scale-tare', this.#onScaleTare);
        this.host.removeEventListener('machine-request', this.#onMachineRequest);
        this.host.removeEventListener('preset-edit', this.#onPresetEdit);
        this.host.removeEventListener('favourite-action', this.#onFavouriteAction);
        this.host.removeEventListener('rating-change', this.#onRatingChange);
        this.host.removeEventListener('notes-change', this.#onNotesChange);
        this.#removeKeys();
        this.#detach();
    }

    /**
     * Re-attach when the shell hands over a different boot, and derive the two host
     * properties. Runs before `render()`, so what it sets lands in THIS update rather than
     * scheduling another one.
     */
    hostUpdate() {
        const boot = this.host.boot ?? null;
        if (boot !== this.boot) this.#attach(boot);

        if (!this.boot) return;

        this.host.ghc = this.ghcGate().render;
        this.host.dim = liveDim(this.dimState);
        this.host.machineState = this.machineState ?? '';

        this.host.limits = r2MachineLimits(this.capabilities ? this.capabilities.entries : null).value;
        const targets = this.workflow ? this.workflow.targets : Object.freeze({});
        this.host.targets = targets;

        /* THE CHART'S MODE AND, WHEN IT IS STEAM, THE SESSION ITSELF. The screen switches
         * its channels and its axes on the mode; it never asks what the machine is doing. */
        this.host.chartMode = this.chartMode.mode;
        this.host.steamDerivation = this.chartMode.mode === CHART_MODE.STEAM
            ? this.steam.get() : null;
        this.host.steamSettled = isSteamHoldActive(this.chartMode);
        this.host.steamGuard = this.steamGuard.shown;
        this.host.milkPresent = Boolean(this.milk && this.milk.status !== FEED_STATUS.STALE
            && valueOf(this.milk)?.ok === true
            && hasReading(valueOf(this.milk).temperature));

        this.host.offers = this.#offers;
        this.host.steamStop = steamStopFrom(targets);
        this.host.waterStop = waterStopFrom(this.#stopHotWaterAtWeight);
        this.host.presets = this.presets;
        this.host.clockFormat = this.clockFormat;
        this.host.tankUnit = this.tankUnit;
        this.host.tempUnit = this.tempUnit;

        this.host.profileName = this.#profileTitle;

        this.host.favourites = this.#favourites;
        this.host.favourite = this.#loadedProfileId;

        const stored = this.#storedShot;
        this.host.storedDerivation = stored.derivation;
        this.host.storedShot = stored.record;
        this.host.shotId = stored.id ?? '';
        this.host.rating = stored.rating;
        this.host.historyCount = this.shotHistory && Number.isFinite(this.shotHistory.total)
            ? this.shotHistory.total : 0;
        this.host.dye2 = this.#dye2Loaded;

        this.#resetShotIndexOnShotStart(this.machineState);

        const rows = this.shotHistory && this.shotHistory.items ? this.shotHistory.items.length : 0;
        const at = Math.min(Math.max(this.shotIndex, 0), Math.max(rows - 1, 0));
        this.host.canStepOlder = rows > 0 && at < rows - 1;
        this.host.canStepNewer = rows > 0 && at > 0;
        this.host.browsingHistory = at > 0;

        this.#pushReadings();

        /* THE HEADER'S WARMER CONTROL. Three states, and the third is the one that
         * matters: on, off, or NO READING — never an assumed off. */
        this.host.warmer = this.#warmer;

        /* THE WEATHER CORNER'S READING. Null on a machine without the plugin, which is
         * what makes the corner absent rather than empty. */
        this.host.weather = this.boot && this.boot.weather ? this.boot.weather.get() : null;

        this.host.compliance = this.#compliance;
    }

    get #warmer() {
        const frame = this.cupWarmer;
        if (!frame) return NO_WARMER;
        if (frame.status === CUP_WARMER_STATUS.UNSUPPORTED) return WARMER_ABSENT;
        return Object.freeze({
            present: true,
            on: frame.warmer ? isWarmerOn(frame.warmer) : null,
        });
    }

    #pushReadings() {
        const next = this.#readings;
        const now = {
            at: this.now(),
            presence: presenceOf(next),
            state: this.machineState,
        };
        if (!readingsDue(this.#readingsLast, now, READINGS_MIN_MS)) return;
        this.#readingsLast = now;
        this.host.readings = next;
    }

    get #readings() {
        const snapshot = this.machineStale ? null : (this.machine ? valueOf(this.machine) : null);
        const scale = this.scale && this.scale.status !== FEED_STATUS.STALE
            ? valueOf(this.scale) : null;
        const from = (source, key) => {
            if (!source || source.ok !== true) return null;
            const value = source[key];
            return hasReading(value) ? value : null;
        };
        return Object.freeze({
            pressure: from(snapshot, 'pressure'),
            flow: from(snapshot, 'flow'),
            weight: from(scale, 'weight'),
            group: from(snapshot, 'groupTemperature'),
            steam: from(snapshot, 'steamTemperature'),
            tank: from(this.water ? valueOf(this.water) : null, 'currentLevel'),
            milk: from(this.milk ? valueOf(this.milk) : null, 'temperature'),
        });
    }

    get #compliance() {
        const frame = this.estimator && this.estimator.status !== FEED_STATUS.STALE
            ? valueOf(this.estimator) : null;
        if (!frame || frame.ok !== true) return null;
        const read = (key) => (hasReading(frame[key]) ? frame[key] : null);
        return Object.freeze({ compliance: read('compliance'), flags: read('flags') });
    }

    /* ─────────────────────────────────── what the composition rows read from */

    /** The loaded profile's title, or '' — off the workflow document, one owner. */
    get #profileTitle() {
        const document_ = this.workflow ? this.workflow.workflow : null;
        const title = document_ && document_.profile ? document_.profile.title : null;
        return typeof title === 'string' ? title : '';
    }

    get #favourites() {
        const store = this.boot ? this.boot.library : null;
        if (!store || typeof store.favouriteEntries !== 'function' || !this.library) return null;
        return store.favouriteEntries();
    }

    get #loadedProfileId() {
        const arming = this.library ? this.library.armingId : null;
        if (typeof arming === 'string' && arming) return arming;
        const loaded = this.library ? this.library.loaded : null;
        return loaded && typeof loaded.id === 'string' ? loaded.id : '';
    }

    get #storedShot() {
        const store = this.boot ? this.boot.shotHistory : null;
        const state = this.shotHistory;
        const items = state && state.items ? state.items : [];
        const index = Math.min(Math.max(this.shotIndex, 0), Math.max(items.length - 1, 0));
        const chosen = items.length ? items[index] : null;
        const id = chosen && typeof chosen.id === 'string' ? chosen.id : null;
        if (!id || !store) return NO_STORED_SHOT;
        const derivation = typeof store.derivationOf === 'function' ? store.derivationOf(id) : null;
        const enjoyment = chosen.annotations ? chosen.annotations.enjoyment : null;
        return {
            id,
            record: chosen,
            derivation: derivation && derivation.ok ? derivation : null,
            rating: Number.isFinite(enjoyment) ? enjoyment : null,
        };
    }

    /* ───────────────────────────────────────────────── what the screen renders from */

    /** The parsed devices frame, or null — three different nulls, see connection-surface. */
    get connectionFrame() { return this.connection ? valueOf(this.connection) : null; }

    /** The connection feed's `FEED_STATUS`, which is what tells the three nulls apart. */
    get connectionFeedStatus() { return this.connection ? this.connection.status : null; }

    /** The MACHINE feed's own `FEED_STATUS`, or null when no boot is attached. */
    get machineFeedStatus() { return this.machine ? this.machine.status : null; }

    get machineStale() { return this.machineFeedStatus === FEED_STATUS.STALE; }

    get dimState() {
        return dimStateFor(this.machineState, this.machineFeedStatus);
    }

    /* ─────────────────────────────────────────────────────────── the staleness clock */

    tickStaleness(now) {
        const live = this.boot ? this.boot.live : null;
        if (!live || typeof live.refreshStaleness !== 'function') return;
        if (now === undefined) live.refreshStaleness();
        else live.refreshStaleness(now);
    }

    get refusal() {
        const asked = this.boot ? this.boot.machineState : null;
        const state = asked && typeof asked.get === 'function' ? asked.get() : null;
        const problem = state && state.status === 'refused' ? state.problem : null;
        if (problem && typeof problem === 'object') {
            return Object.freeze({
                kind: typeof problem.type === 'string' ? problem.type : 'refused',
                error: typeof problem.details === 'string' ? problem.details : null,
                message: '',
            });
        }
        const write = this.workflow ? this.workflow.writeError : null;
        if (write) {
            const problem = write.problem && typeof write.problem === 'object' ? write.problem : null;
            const said = problem && typeof problem.message === 'string' ? problem.message : '';
            return Object.freeze({ kind: 'write', error: t(WRITE_REFUSED), message: said });
        }
        const armed = this.arm ?? null;
        if (armed && armed.refusal) return armed.refusal;
        if (armed && armed.status === ARM_STATUS.FAILED) {
            const surface = connectionSurface(this.connectionFrame,
                { feedStatus: this.connectionFeedStatus });
            return Object.freeze({
                kind: 'undelivered',
                error: t(ARM_UNDELIVERED),
                message: t(surface.quiet ? ARM_RETRYING : ARM_NO_MACHINE),
            });
        }
        return null;
    }

    get machineState() {
        const snapshot = this.machine ? valueOf(this.machine) : null;
        if (!snapshot || isNoReading(snapshot.state)) return null;
        return snapshot.state;
    }

    get #offers() {
        const store = this.boot ? this.boot.capabilities : null;
        if (!store) return Object.freeze({ milkProbe: null, stopAtWeight: null });
        const tri = (capability) => {
            if (capability === CAPABILITY.PRESENT) return true;
            if (capability === CAPABILITY.ABSENT) return false;
            return null;
        };
        const probe = typeof store.sensorCapability === 'function'
            ? store.sensorCapability('milkProbe').capability
            : CAPABILITY.UNKNOWN;
        const weight = typeof store.capability === 'function'
            ? store.capability('stopAtWeight')
            : CAPABILITY.UNKNOWN;
        return Object.freeze({ milkProbe: tri(probe), stopAtWeight: tri(weight) });
    }

    get #stopHotWaterAtWeight() {
        const document_ = this.appSettings ? this.appSettings.document : null;
        if (!document_ || typeof document_ !== 'object') return undefined;
        const held = document_.stopHotWaterAtWeight;
        return typeof held === 'boolean' ? held : undefined;
    }

    get #dye2Loaded() {
        const listing = this.plugins ? this.plugins.plugins : null;
        if (!Array.isArray(listing)) return false;
        return listing.some((manifest) => manifest
            && manifest.id === DYE2_PLUGIN_ID
            && manifest.loaded === true);
    }

    async #loadRailPreferences() {
        const storage = this.boot ? this.boot.storage : null;
        if (!storage || typeof storage.get !== 'function') return;
        const generation = this.boot;
        const [drink, flow, bindings, clockFormat, tankUnit, tempUnit] = await Promise.all([
            storage.get('drinkOutPresets').catch(() => null),
            storage.get('steamFlowPresets').catch(() => null),
            storage.get('keyboardBindings').catch(() => null),
            storage.get('clockFormat').catch(() => null),
            storage.get('waterTankUnit').catch(() => null),
            storage.get('tempUnit').catch(() => null),
        ]);
        /* A DIFFERENT MACHINE MAY HAVE ARRIVED WHILE THOSE WERE IN FLIGHT, and its
         * preferences are not this one's. The boot object is the identity. */
        if (this.boot !== generation) return;
        const drinkWeight = bank(drink, 'drinkOutPresets');
        const steamFlow = bank(flow, 'steamFlowPresets');
        const presets = (drinkWeight || steamFlow)
            ? Object.freeze({
                ...(drinkWeight ? { drinkWeight } : {}),
                ...(steamFlow ? { steamFlow } : {}),
            })
            : null;

        const keyBindings = resolveBindings(bindings);

        const clock = normaliseClockFormat(clockFormat);

        const tank = normaliseTankUnit(tankUnit) ?? DEFAULT_TANK_UNIT;
        /* AND THE SAME RULE AGAIN: an unrecognised value is the wire's own unit. */
        const temp = normaliseUnit(tempUnit) ?? DEFAULT_TEMP_UNIT;

        const same = JSON.stringify(this.presets ?? null) === JSON.stringify(presets)
            && JSON.stringify(this.keyBindings ?? null) === JSON.stringify(keyBindings)
            && this.clockFormat === clock
            && this.tankUnit === tank
            && this.tempUnit === temp;
        this.presets = presets;
        this.keyBindings = keyBindings;
        this.clockFormat = clock;
        this.tankUnit = tank;
        this.tempUnit = temp;
        if (!same) this.host.requestUpdate();
    }

    #onRatingChange = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const store = this.boot ? this.boot.shotHistory : null;
        if (!detail || !store || typeof store.setEnjoyment !== 'function') return;
        const { shotId, score } = detail;
        if (typeof shotId !== 'string' || shotId === '') return;
        /* THE WIRE TAKES A NULLABLE DOUBLE and `null` CLEARS the rating — the store's own
         * guard throws on anything else, so an unset draft is turned into the clear rather
         * than into an exception. */
        const value = Number.isFinite(score) ? Number(score) : null;
        Promise.resolve(store.setEnjoyment(shotId, value)).catch(() => {});
    };

    #onNotesChange = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const store = this.boot ? this.boot.shotHistory : null;
        if (!detail || !store || typeof store.setNotes !== 'function') return;
        const { shotId, text } = detail;
        if (typeof shotId !== 'string' || shotId === '') return;
        if (typeof text !== 'string') return;
        Promise.resolve(store.setNotes(shotId, text)).catch(() => {});
    };

    #recordArmedPreset(key, presetIndex) {
        const row = PRESET_INDEX_ROWS[key];
        if (!row) return;
        const storage = this.boot ? this.boot.storage : null;
        if (!storage || typeof storage.set !== 'function') return;
        const index = Number.isInteger(presetIndex) && presetIndex >= 0 ? presetIndex : null;
        Promise.resolve(storage.set(row, index)).catch(() => {});
    }

    #onPresetEdit = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const storage = this.boot ? this.boot.storage : null;
        if (!detail || !storage || typeof storage.set !== 'function') return;
        const { key, index, value } = detail;
        const row = PRESET_ROWS[key];
        if (!row || !Number.isInteger(index) || typeof value !== 'number') return;
        const held = (this.presets && Array.isArray(this.presets[key]))
            ? this.presets[key] : DEFAULT_PRESETS[key];
        if (!Array.isArray(held) || index < 0 || index >= held.length) return;
        const next = held.slice();
        next[index] = value;
        this.presets = Object.freeze({ ...(this.presets ?? {}), [key]: Object.freeze(next) });
        this.host.requestUpdate();
        Promise.resolve(storage.set(row, next)).catch(() => {});
    };

    #onFavouriteAction = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const library = this.boot ? this.boot.library : null;
        if (!detail || !library) return;
        const index = Number.isInteger(detail.slot) && detail.slot >= 1 ? detail.slot - 1 : null;
        if (detail.action === 'clear') {
            if (index !== null && typeof library.setFavourite === 'function') {
                Promise.resolve(library.setFavourite(index, null)).catch(() => {});
            }
            return;
        }
        if (detail.action === 'edit') {
            /* THE SHELL SEATS THE RECORD, not this row: `app-root` owns the two-step
             * (seat, then route) and doing half of it here would leave two writers for
             * one hand-off. The id is what travels. */
            if (!detail.value) return;
            this.host.dispatchEvent(new CustomEvent('header-action', {
                detail: { action: 'Edit profile', profileId: detail.value },
                bubbles: true,
                composed: true,
            }));
            return;
        }
        if (detail.action === 'replace' || detail.action === 'browse') {
            const storage = this.boot ? this.boot.storage : null;
            const open = () => this.host.dispatchEvent(new CustomEvent('library-open', {
                bubbles: true, composed: true,
            }));
            if (index === null || !storage || typeof storage.set !== 'function') { open(); return; }
            Promise.resolve(storage.set('pendingAssignmentIndex', index))
                .catch(() => false)
                .then(open);
        }
    };

    /**
     * What `#pushReadings` last published: `{at, presence, state}`, or null before the
     * first frame. `readings-rate.js` owns every rule about when the next one is allowed.
     */
    #readingsLast = null;

    /** The timer that ends the steam hold when machine frames stop arriving. */
    #steamHold = null;

    /** The timer that shows the puff guard when machine frames stop arriving. */
    #steamGuardTimer = null;

    /** The last frame's state and substate, so a repeat costs nothing. */
    #lastState = null;

    #lastSubstate = null;

    #foldChartMode() {
        const snapshot = this.machine ? valueOf(this.machine) : null;
        const state = snapshot && !isNoReading(snapshot.state) ? snapshot.state : null;
        const substate = snapshot && snapshot.substate && !isNoReading(snapshot.substate)
            ? snapshot.substate : null;

        const still = state === this.#lastState && substate === this.#lastSubstate;
        if (still && this.chartMode.holdUntil === null && this.chartMode.mode === CHART_MODE.ESPRESSO) {
            return;
        }
        this.#lastState = state;
        this.#lastSubstate = substate;

        const at = Date.now();
        const next = chartModeFor(this.chartMode, { state, substate, now: at });
        this.chartMode = next;
        this.steamGuard = steamGuardFor(this.steamGuard, { state, substate, now: at });

        this.steam.take({
            mode: next.mode,
            pouring: state === MACHINE_STATE.STEAM && isSteamPouring(substate),
            machine: snapshot,
            milk: this.#milkTemperature,
            at,
        });

        const remaining = steamHoldRemainingMs(next, at);
        if (this.#steamHold !== null) { clearTimeout(this.#steamHold); this.#steamHold = null; }
        if (remaining !== null) {
            this.#steamHold = setTimeout(() => {
                this.#steamHold = null;
                /* THE SAME FOLD, with no frame behind it: `chartModeFor` reads the
                 * deadline against the clock and answers espresso, which is exactly what
                 * a late frame would have produced. */
                this.#foldChartMode();
                this.host.requestUpdate();
            }, remaining + 16);
        }

        /* THE GUARD KEEPS A CLOCK OF ITS OWN, so it still appears when the machine frames
         * stop arriving. A frame folds it too, and the two agree because both read the
         * one armed moment against the clock rather than counting frames. */
        const untilGuard = steamGuardRemainingMs(this.steamGuard, at);
        if (this.#steamGuardTimer !== null) {
            clearTimeout(this.#steamGuardTimer);
            this.#steamGuardTimer = null;
        }
        if (untilGuard !== null) {
            this.#steamGuardTimer = setTimeout(() => {
                this.#steamGuardTimer = null;
                this.steamGuard = steamGuardFor(this.steamGuard, {
                    state: this.#lastState, substate: this.#lastSubstate, now: Date.now(),
                });
                this.host.requestUpdate();
            }, untilGuard + 16);
        }
    }

    /** The milk probe's temperature right now, or null. */
    get #milkTemperature() {
        const frame = this.milk ? valueOf(this.milk) : null;
        if (!frame || frame.ok !== true) return null;
        const value = frame.temperature;
        return hasReading(value) ? value : null;
    }

    /** The GHC gate answer, with its R3 provenance attached. Always an object. */
    ghcGate() {
        return this.gates ? this.gates.ghc() : FALLBACK_GATE;
    }

    /* ────────────────────────────────────────────────────────────── the answer path */

    #onConnectDevice = (event) => {
        const deviceId = event?.detail?.deviceId;
        const devices = this.boot?.devices;
        if (!deviceId || !devices || typeof devices.connect !== 'function') return;
        Promise.resolve(devices.connect(deviceId)).catch(() => {});
    };

    /** The user acknowledged a refusal. The store owns the state; this only asks. */
    #onTargetChange = (event) => {
        const store = this.boot ? this.boot.workflow : null;
        if (!store || typeof store.setTarget !== 'function') return;
        const detail = event && event.detail ? event.detail : null;
        if (!detail || typeof detail.key !== 'string') return;
        Promise.resolve(store.setTarget(detail.key, detail.value)).catch(() => {});

        this.#recordArmedPreset(detail.key, detail.presetIndex);

        const remembered = REMEMBERED_TARGETS[detail.key];
        const library = this.boot ? this.boot.library : null;
        if (!remembered || !library || typeof library.rememberContext !== 'function') return;
        Promise.resolve(library.rememberContext({
            [remembered]: remembered === 'grinderSetting'
                ? Number(detail.value).toFixed(2) : detail.value,
        })).catch(() => {});
    };

    #resetShotIndexOnShotStart(state) {
        const running = isRunning(state);
        if (running && !this.wasRunning && this.shotIndex !== 0) this.shotIndex = 0;
        this.wasRunning = running;
    }

    #onShotStep = (event) => {
        const delta = Number(event?.detail?.delta);
        if (!Number.isFinite(delta) || delta === 0) return;
        const items = this.shotHistory && this.shotHistory.items ? this.shotHistory.items : [];
        if (!items.length) return;

        const from = Math.min(Math.max(this.shotIndex, 0), items.length - 1);
        const next = Math.min(Math.max(from + delta, 0), items.length - 1);
        this.shotIndex = from;
        if (next === this.shotIndex) return;
        this.shotIndex = next;
        this.host.requestUpdate();

        const store = this.boot ? this.boot.shotHistory : null;
        const id = items[next] && items[next].id;
        if (!store || !id || typeof store.loadShot !== 'function') return;
        if (typeof store.derivationOf === 'function' && store.derivationOf(id)) return;
        /* Not awaited, and it needs no catch: every failure this read can have is
         * already state on the store, which the band reads like any other. */
        store.loadShot(id);
    };

    #onScaleTare = () => {
        this.boot?.scaleTare?.tare();
    };

    #onWarmerToggle = (event) => {
        const store = this.boot ? this.boot.cupWarmer : null;
        if (!store || typeof store.setEnabled !== 'function') return;
        const detail = event && event.detail ? event.detail : null;
        if (!detail || typeof detail.enabled !== 'boolean') return;
        Promise.resolve(store.setEnabled(detail.enabled)).catch(() => {});
    };

    #onRefusalDismiss = () => {
        const arm = this.boot?.arm;
        if (arm && typeof arm.clear === 'function') arm.clear();
        const workflow = this.boot?.workflow;
        if (workflow && typeof workflow.clearWriteError === 'function') workflow.clearWriteError();
        const machineState = this.boot?.machineState;
        if (machineState && typeof machineState.clear === 'function') machineState.clear();
    };

    #onMachineRequest = (event) => {
        const store = this.boot ? this.boot.machineState : null;
        const state = event && event.detail ? event.detail.state : null;
        if (!store || typeof store.request !== 'function' || typeof state !== 'string') return;
        Promise.resolve(store.request(state)).catch(() => {});
    };

    #installKeys() {
        const doc = this.host.ownerDocument ?? null;
        if (!doc || this.#keysOn) return;
        doc.addEventListener('keydown', this.#onKeyDown);
        this.#keysOn = doc;
    }

    #removeKeys() {
        if (!this.#keysOn) return;
        this.#keysOn.removeEventListener('keydown', this.#onKeyDown);
        this.#keysOn = null;
    }

    #keysOn = null;

    #onKeyDown = (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
        if (!this.ghcGate().render) return;
        const target = event.composedPath ? event.composedPath()[0] : event.target;
        const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;
        const state = stateForKey(event.key, this.keyBindings ?? undefined);
        if (!state) return;
        event.preventDefault();
        this.#onMachineRequest({ detail: { state } });
    };

    /* ──────────────────────────────────────────────────────────────── subscriptions */

    #attach(boot) {
        this.#detach();
        this.boot = boot;
        /* A DIFFERENT MACHINE IS A DIFFERENT HISTORY. The band goes back to the newest
         * shot rather than to whatever row the arrows were on, which would be a row
         * from the machine that just went away. */
        this.shotIndex = 0;
        if (!boot) return;

        const redraw = () => this.host.requestUpdate();

        if (boot.live && typeof boot.live.feed === 'function') {
            for (const [name, field] of WATCHED_FEEDS) {
                const feed = boot.live.feed(name);
                if (!feed || typeof feed.subscribe !== 'function') continue;
                this.subscriptions.push(feed.subscribe((state) => {
                    this[field] = state;
                    /* THE CHART MODE IS A FOLD OVER MACHINE FRAMES, so it advances here
                     * rather than on a timer of its own — one frame, one answer. */
                    if (field === 'machine') this.#foldChartMode();
                    redraw();
                }));
            }
        }

        for (const name of WATCHED_STORES) {
            const store = boot[name];
            if (!store || typeof store.subscribe !== 'function') continue;
            this.subscriptions.push(store.subscribe((state) => {
                this[name] = state;
                redraw();
            }));
        }

        if (boot.machineState && typeof boot.machineState.subscribe === 'function') {
            this.subscriptions.push(boot.machineState.subscribe(redraw));
        }

        /* THE STEAM SESSION REDRAWS THE SCREEN. It is this controller's own store rather
         * than the shell's — nothing else reads a steam — so it is subscribed here and
         * cleared when the boot goes. */
        this.subscriptions.push(this.steam.subscribe(redraw));

        /* THE STORED RAIL PREFERENCES, once per boot. Not awaited: a screen that waited
         * for four KV reads before its first paint would show nothing while the machine
         * was already pouring. */
        Promise.resolve(this.#loadRailPreferences()).catch(() => {});

        if (boot.plugins && typeof boot.plugins.load === 'function') {
            Promise.resolve(boot.plugins.load()).catch(() => {});
        }

        if (boot.capabilities && typeof boot.capabilities.groupHeadController === 'function') {
            this.gates = createLiveGates({ capabilities: boot.capabilities });
        }

        /* THE TICK. Started with the subscriptions and stopped with them, so it exists for
         * exactly as long as there is a screen to change and a boot to ask. */
        if (this.ticker === null && boot.live && typeof boot.live.refreshStaleness === 'function') {
            this.ticker = setInterval(() => this.tickStaleness(), STALENESS_TICK_MS);
        }
    }

    #detach() {
        if (this.ticker !== null) {
            clearInterval(this.ticker);
            this.ticker = null;
        }
        if (this.#steamHold !== null) {
            clearTimeout(this.#steamHold);
            this.#steamHold = null;
        }
        if (this.#steamGuardTimer !== null) {
            clearTimeout(this.#steamGuardTimer);
            this.#steamGuardTimer = null;
        }
        this.chartMode = initialChartMode();
        this.steamGuard = initialSteamGuard();
        this.#lastState = null;
        this.#lastSubstate = null;
        this.steam.clear();
        for (const unsubscribe of this.subscriptions) unsubscribe();
        this.subscriptions = [];
        this.gates = null;
        this.connection = null;
        this.machine = null;
        this.capabilities = null;
        this.arm = null;
        this.workflow = null;
        this.library = null;
        this.shotHistory = null;
        this.cupWarmer = null;
        this.appSettings = null;
        this.plugins = null;
        this.scale = null;
        this.milk = null;
        this.estimator = null;
        this.boot = null;
    }
}

/** No shot stored, or none read yet. Frozen so the three consumers cannot be handed a
 *  fresh object per render and re-render each other for ever. */
const NO_STORED_SHOT = Object.freeze({ id: null, record: null, derivation: null, rating: null });

/** The warmer before anything has been read: the control is there, its state is not.
 *  Frozen and hoisted for the same reason `NO_STORED_SHOT` is. */
const NO_WARMER = Object.freeze({ present: true, on: null });

/** The machine does not have one. The control comes off the band entirely — the
 *  contract row's own instruction, not this controller's choice. */
const WARMER_ABSENT = Object.freeze({ present: false, on: null });

const FALLBACK_GATE = Object.freeze({
    render: false,
    capability: null,
    known: false,
    reason: 'noBoot',
    provisional: true,
    tag: null,
    adapter: null,
    basis: 'no boot object on the screen yet',
    swapWhen: null,
    polarity: null,
});
