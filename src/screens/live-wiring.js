/**
 * live-wiring.js — the Live screen's controller for the connection-and-gates cluster.
 *
 * Items `live-connection-states`, `live-refusal-surface`, `live-capability-gates-ghc`,
 * `live-bug-ghc-overlay` (L1) and `live-bug-dimming-owner` (L11) all need the same three
 * things: a store to read, a derivation to run, and a property on `<live-screen>` to set.
 * Written five times inside the screen's own class that would be five subscriptions, five
 * teardowns and five chances to leak one; written once here it is a Lit
 * ReactiveController, and `<live-screen>` gains one field.
 *
 * WHY A CONTROLLER AND NOT A SCREEN METHOD. `hostConnected`/`hostDisconnected` are the
 * platform's own guarantee that a route swap takes the subscriptions with it — the exact
 * property `app-root.js` leans on ("a custom element's own `disconnectedCallback` is the
 * browser's guarantee that the screen going away takes its listeners with it"). Bug S10 is
 * the counter-example this shape exists to avoid: `initScaling` imported twice, "a second
 * call would duplicate every resize listener".
 *
 * THE SCREEN STILL TALKS TO NO ENDPOINT. Everything here is a store or the devices link,
 * both handed down by the shell on `<live-screen>.boot`. There is no path, no verb, no
 * route id and no fetch in this file — `test/live-connection-gates.test.mjs` asserts that
 * over its source.
 *
 * WHAT IT SETS ON THE HOST, and nothing else:
 *   `ghc`           boolean — the capability gate's answer (A3, through the R3 adapter)
 *   `dim`           string|null — the ONE dimming owner's answer (L11)
 *   `machineState`  string — ReaPrime's own state name, off the machine feed
 *   `limits`        object — the R2 table for this machine class, through the R2 adapter
 *   `targets`       object — the rail's ten values, off the workflow document
 *   `profileName`   string — the loaded profile's title, off the SAME document
 *   `favourites`    array  — the five slots, off the profile library store
 *   `favourite`     string — which of the five is the loaded profile, off the same
 *   `storedDerivation` object — the last stored shot's gate-6 derivation
 *   `storedShot`    object — that shot's LIST row, for the band's date and title
 *   `shotId` / `rating` / `historyCount` — the same shot's identity, its ReaPrime
 *                   enjoyment score, and how many shots are stored
 *   `readings`      object — the gauge cluster's five channels, off the machine
 *                   snapshot and the scale
 * All eleven are declared properties of `<live-screen>`; this controller is their only
 * writer.
 *
 * THE LAST SIX ARRIVED WITH BEN'S 22 AUG RULING and they close DQ-1-D, which named the
 * gap in its own words: "profileName + favourites have NO OWNER … P-1's shape twice
 * more". Every one of them was a declared property of `<live-screen>` that nothing
 * under src/ ever wrote, so the header's favourite slots were five numbered blanks, the
 * chart card had no title, and the chart and the foot band said "no shot yet" on a
 * machine with 321 stored shots. The stores all existed; nobody had joined them up.
 *
 * THE LAST TWO ARRIVED LAST, AND THE RAIL DID NOT WORK WITHOUT THEM. `<live-screen>`
 * declared both from the day it was built and nothing ever set either, so `#valueOf`
 * answered `undefined` for every key, `railRows` marked every row unavailable, and every
 * stepper, every preset cell and the keypad's Confirm rendered DISABLED — on any machine,
 * in any state. The screen's own `#commit` had named the missing piece all along ("the
 * owner of the machine's settings answers by handing `targets` back") and nothing
 * listened to `target-change`, so the one line that writes `targets` sat behind the
 * controls that being unwritten had disabled. Both halves are here now: the values in
 * `hostUpdate`, the write in `#onTargetChange`.
 *
 * THE THIRD ONE ARRIVED WITH `live-15hz-loop`, and the reason it is here rather than
 * anywhere else is the reason the other two are: this controller already holds the
 * machine feed's subscription — `dim` is computed from that very state — so a second
 * reader of the same feed would be a second answer to one question, which is bug L11's
 * shape wearing a different property's name. The gates row reported the gap rather than
 * taking it ("if no row claims it, one line beside the dim assignment closes it"); the
 * loop row claims it, because the header band's status chip and the rail's mode are
 * exactly what "machine-state transitions drive the screen" means end to end.
 *
 * `''` RATHER THAN `null` WHEN THERE IS NO READING. The property is a reflected string
 * attribute, `''` is what the screen's own constructor starts it at, and every consumer
 * (`isRunning`, `modeFor`, `liveDim`) treats an unknown name as "not a mode, not
 * running, dim nothing". A snapshot that has not arrived must not recede the rail.
 *
 * AND A SNAPSHOT THAT STOPPED ARRIVING MUST NOT RECEDE IT FOR EVER. The fail-visible
 * property above covered only the never-arrived case: `dim` was computed from the VALUE
 * alone, so a feed holding `espresso` behind a source that had gone kept `dim="all"` —
 * every dimmable rail track at the dim token with `pointer-events: none` — with no frame
 * ever coming to lift it. After a socket blip mid-espresso the rail stayed receded and
 * stopped answering taps for the rest of the session; `<ui-stop-button>` is the one exempt
 * track (`RAIL_DIM_GROUP.mode`), so abort still worked and nothing else did. The dim owner
 * therefore reads the feed's STATUS as well as its value — see `dimState`.
 */

import { FEED } from 'src/stores/live-stores.js';
/* THE READOUTS' TWO SOURCES. `readMachineSnapshot` and `readScaleSnapshot` are gate
 * 2's, and they are the ONLY readers of those two wire shapes in the tree — the feed
 * stores publish what these return, so this controller reads the answer rather than
 * the frame. */
import { hasReading } from 'src/data/reading.js';
import { valueOf, FEED_STATUS } from 'src/stores/feed-store.js';
/* THE WARMER'S TWO ANSWERS, BOTH THE STORE'S OWN. `isWarmerOn` reads the `enabled`
 * field the handler serves and never infers on-ness from a setpoint, which is the
 * store's dead premise 1; `CUP_WARMER_STATUS.UNSUPPORTED` is the capability answer that
 * takes the control off the band. Neither is re-derived here. */
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
    CHART_MODE, chartModeFor, initialChartMode, isSteamHoldActive, isSteamPouring,
    steamHoldRemainingMs,
} from 'src/lib/steam-chart.js';
import { createSteamBuffer } from 'src/stores/steam-buffer.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
/* THE PLUGIN'S ID AND NOTHING ELSE. What arrives here is a name to match a manifest
 * against, which is data; `pageUrl` — the thing that turns that id into an address — is
 * the SCREEN's business, not this controller's. There is no path, no verb, no route id and
 * no fetch in this file, and `test/live-connection-gates.test.mjs` asserts that over its
 * source text. */
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
    /* THE MILK PROBE. Slate's gauge cluster has eight readings and this one had no feed
     * attached, which is the same shape the tank was in until 23 Aug. The feed exists
     * (`FEED.MILK_PROBE`, `readMilkProbeFrame`) and subscribing to it is what opens the
     * sensor socket, so a machine with no probe pays for one discovery pass and reads
     * the dash for ever after — which is what an absent reading is supposed to look
     * like (A7). */
    Object.freeze([FEED.MILK_PROBE, 'milk']),
    /* THE PUCK ESTIMATOR, for the expanded chart's compliance badge and nothing else yet.
     * Same shape as the milk probe above and the same cost: subscribing is what opens the
     * sensor socket, and a machine with no estimator pays one discovery pass and reads an
     * absence for ever after. The badge's own answer for that absence is "C —", which is
     * Slate's, so an unequipped machine draws the badge it should. */
    Object.freeze([FEED.ESTIMATOR, 'estimator']),
]);

/**
 * Which KV row each preset bank lives in — `storage-routes.js`'s own two names.
 *
 * A TABLE AND NOT A TEMPLATE STRING, because the rail's key ("drinkWeight") and the
 * storage row ("drinkOutPresets") are different words for the same bank and always were:
 * the row's name is Slate's element id and the key is the machine limit's. Deriving one
 * from the other would be a rule with two exceptions and no third case.
 */
/**
 * The headline for a rail write the machine refused.
 *
 * ONE STRING, HERE, because `<live-refusal>` "takes a message, it does not know the
 * message" and the store's own body is a transport result rather than a sentence. It goes
 * through the free `t()` rather than a controller: this row is not an element and has no
 * host to re-render on a language change, and the Live screen re-renders on every frame
 * the feeds deliver, so the sentence follows a language switch anyway. Slate's
 * wording is "Machine did not accept <what>"; the <what> is left off because the value
 * that snapped back is on screen a row away, and naming it twice is how a banner becomes
 * a paragraph.
 */
const WRITE_REFUSED = 'The machine did not accept that setting';

/**
 * ===========================================================================
 * AN ARM THAT NEVER REACHED THE MACHINE — THE ENDING THAT COULD NOT SPEAK
 * ===========================================================================
 *
 * Ben, 27 August 2026, machine disconnected: "now I cannot seem to select a favorite, do
 * I need a machine connected to pick one". Reproduced on his tablet: the slot highlights,
 * it snaps back a few seconds later, Edit profile opens the profile from before, and
 * NOTHING IS SAID ANYWHERE. The silence had its own cause, separate from the gate in
 * `profile-library-store.js` `arm()`:
 *
 *   `profileRefusal()` (`src/data/rea-profile.js:403`) returns a sentence only for a 400
 *   carrying a problem body — a profile the machine understood and rejected. A
 *   disconnected machine is not that: `withDe1` throws `DeviceNotConnectedException` and
 *   `de1handler.dart:608` maps it to a 500, so `profileRefusal` correctly returns null,
 *   the arm store correctly publishes FAILED with a raw transport result rather than
 *   REFUSED with a sentence — and `refusal` below read only the REFUSED half. Two
 *   endings, one of which had no voice.
 *
 * WHERE THE SENTENCE BELONGS, and why it is here and not in the two files it could have
 * gone in:
 *
 *   NOT `profileRefusal()`. Widening it to answer for a 500 would erase the distinction
 *   the whole fix rests on — a refusal blocks the workflow write, a transport failure does
 *   not — and it would put a message in `refusal` for something the server never made a
 *   statement about. That function's job is "read what the server typed", and the server
 *   typed nothing for a person here.
 *
 *   NOT the arm store. Its header is explicit: "NOTHING IN THIS FILE WORDS A REFUSAL", so
 *   that the server's own sentence can reach the screen intact. A sentence invented there
 *   would be the second vocabulary that note exists to prevent.
 *
 *   HERE, because this is already where a fault that carries no sentence of its own gets
 *   one: WRITE_REFUSED does exactly this for a rail write the machine would not take, and
 *   the precedent is three lines above. The banner "takes a message, it does not know the
 *   message" — so someone has to know it, and it is the surface's controller.
 *
 * WHAT IT SAYS, AND WHY IT IS NOT AN ERROR. The document HAS been written by the time this
 * is rendered — that is the point of the change in `arm()` — so the profile is chosen, it
 * is stored, and `WorkflowDeviceSync` pushes it the moment a DE1 finishes connecting
 * (`workflow_device_sync.dart` `_onInitSettled`). Telling a person their choice failed
 * would be false. What they cannot see, and what Ben asked for, is WHY the machine has not
 * got it: there is no machine.
 */
const ARM_UNDELIVERED = 'The machine has not been given this profile yet';

/** The common case, and the one Ben hit: ReaPrime answered, the machine is not there. */
const ARM_NO_MACHINE = 'No machine is connected. It is saved, and will be sent as soon as one is.';

/**
 * A machine IS connected and the upload still failed — a BLE write fault rather than an
 * absence. ReaPrime retries this one itself on a 3 s / 10 s / 30 s ladder
 * (`workflow_device_sync.dart` `_scheduleRetry`), so "it will be sent again" is a
 * statement about ReaPrime's behaviour rather than a hope.
 */
const ARM_RETRYING = 'It is saved, and the machine will be sent it again.';

const PRESET_ROWS = Object.freeze({
    drinkWeight: 'drinkOutPresets',
    steamFlow: 'steamFlowPresets',
});

/**
 * WHERE "WHICH CELL OF THIS BANK IS ARMED" IS RECORDED, by rail key (audit F-022).
 *
 * ONE ENTRY, BECAUSE THE REGISTRY DECLARES ONE. `steamFlowPresetIndex` is a real row in
 * `storage-routes.js` with an owner and a `why`; the drink bank has no such row anywhere
 * in the table, so this map has nothing to say about it and says nothing. A second entry
 * here would be this file inventing a key, which is the opposite of the fault being fixed
 * — the fault was a key the table declared and no code wrote.
 */
const PRESET_INDEX_ROWS = Object.freeze({
    steamFlow: 'steamFlowPresetIndex',
});

/** This file's name in the log — the same `scope()` seam every store uses. */
const log = logger.scope ? logger.scope('live') : logger;

/**
 * A STORED PRESET BANK, VALIDATED — never coerced (audit F-051, fixed 29 August 2026).
 *
 * =========================================================================
 * WHAT THIS USED TO BE, AND THE TWO WAYS IT LIED
 * =========================================================================
 *     const bank = (held) => (Array.isArray(held) && held.length
 *         ? Object.freeze(held.map(Number).filter(Number.isFinite))
 *         : null);
 *
 * `Number(null)` IS `0`, AND `0` IS FINITE. A stored `[30, null, 40, 50]` therefore drew
 * `30 · 0 · 40 · 50` — pixel-identical to a stored `[30, 0, 40, 50]`, and identical in the
 * model too, with nothing anywhere recording that the two documents differed. That is the
 * absent/null/zero collapse, on a bank whose cells are pressable: a stored `0` is a cell a
 * person can press, and pressing it would commit a drink weight of 0 against a band whose
 * floor is 1.
 *
 * `Number("x")` IS `NaN`, AND `filter` DROPPED IT. A four-cell bank silently became a
 * three-cell bank: a SHAPE change, not a value change, with nothing saying a preset had
 * been lost.
 *
 * =========================================================================
 * WHAT IT IS NOW: ONE BAD CELL INVALIDATES THE DOCUMENT
 * =========================================================================
 * The intent line is "a preset bank draws the four values it was given, OR the shipped
 * bank when it has none" — two states, and no third state where it draws some of them.
 * A document this function cannot fully believe is a document it does not use, so the row
 * falls back to `DEFAULT_PRESETS` exactly as an absent one does, and says so in the log.
 *
 * STRICTLY NUMBERS, NOT NUMBER-LIKE THINGS. `"30"` is refused with `null` and `"x"`,
 * because the whole finding is coercion standing in for validation and `Number("30")`
 * is the same call that made `Number(null)` a zero. The row is an untyped JSON blob
 * (`storage-routes.js:535`) with no schema anywhere in the stack, so this is the only
 * place the shape is checked at all.
 *
 * NOT REACHABLE BY ANY DECAL GESTURE TODAY, and that is stated so this is not read as
 * bigger than it is: `#onPresetEdit` only ever writes finite numbers. Both states are
 * reachable from a kv document written by anything else — another skin, a hand-edited
 * store, a partially-written array — and nothing on the server constrains the row either.
 */
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

/* THE SHELL'S STORES THIS CONTROLLER WATCHES, by the name each carries on the boot object.
 * The loop subscribes to every one and parks its state on `this[name]`.
 *
 * `appSettings` JOINED THEM ON 27 AUGUST 2026 AND IT IS HERE FOR ONE FIELD.
 * `stopHotWaterAtWeight` is what `hot_water_sequencer.dart:106` reads to decide whether a
 * hot-water pour ends on millilitres or on the scale, and it lives on ReaPrime's own
 * preferences document (`GET/POST /api/v1/settings`) rather than on the workflow. The rail
 * has to know it: it is what the stop caption SAYS and what the unit beside the number
 * MEANS. Until now the rail read a KV row of its own instead and the two surfaces could
 * disagree — measured on the mock, whose machine holds `stopHotWaterAtWeight: true` while
 * the rail printed "Volume stop" and "240 mL" over it. */
/* `plugins` JOINED THEM ON 27 AUGUST 2026 AND IT IS HERE FOR ONE BUTTON.
 *
 * Ben, 27 August 2026: "Have the button open the bean picker page for now, I need to do
 * more work on this though." The DYE2 handoff beside "All notes" is drawn only when this
 * machine actually has DYE2, and the only thing that knows is ReaPrime's installed-plugin
 * listing — `GET /api/v1/plugins`, one manifest per plugin with `loaded` and `autoLoad`.
 *
 * NOT A CAPABILITY AND NOT A PREFERENCE, which is why it is a store subscription and not a
 * gate or a KV read. A3's capability list is the MACHINE's seven-entry answer about
 * hardware; a plugin is ReaPrime's software, installed on the tablet's app, and it is
 * absent or present for entirely different reasons. And the tablet preference that used to
 * be proposed for this — `dye2Enabled` — is retired in `storage-routes.js`, because the
 * Plugins page's own switch is the one control for "does this machine offer DYE2" and a
 * second store for it is exactly B7's founding defect. */
const WATCHED_STORES = Object.freeze([
    'capabilities', 'machineInfo', 'arm', 'workflow', 'library', 'shotHistory', 'cupWarmer',
    'appSettings', 'plugins',
    /* THE WEATHER READING ARRIVES ON ITS OWN CLOCK, not the machine's. The plugin
     * republishes every thirty seconds whether or not a shot is running, so the corner
     * cannot wait for a machine frame to redraw it — an idle machine sends none. */
    'weather',
]);

/**
 * How often the mounted screen re-classifies feed staleness, in ms.
 *
 * WHY THERE IS A TIMER HERE AT ALL, in a tree that says a timer is usually a second clock
 * disagreeing with the first. `feed-store.js:255` asks its consumer for exactly this —
 * "Re-classify by age. Call from whatever already ticks (the render loop, a test)" — and
 * `live-stores.js:248` repeats it: "Driven by whatever already ticks — never by a timer
 * this layer owns." Nothing in `src/` was that caller, so the whole staleness mechanism
 * was live code no running app ever ran, and a machine channel that went quiet with its
 * socket open showed a frozen reading for ever. The screen is the right owner because it
 * is the thing that has to CHANGE when the answer changes, and because a controller's
 * timer dies with the host — S10's duplicated-listener shape cannot happen here.
 *
 * 500 ms against the machine feed's own 2 s budget: four ticks inside the budget, so the
 * worst case is half a second of "live" after a channel has actually gone, and the cost is
 * one comparison per feed per tick — `refreshStaleness` publishes only when the answer
 * CHANGED, so a quiet tick reaches no subscriber and causes no render. It is deliberately
 * NOT the 15 Hz render budget: this is the clock that has to keep running when frames have
 * stopped, which is the one condition the frame path cannot cover.
 */
export const STALENESS_TICK_MS = 500;

/**
 * The rail keys the LOADED PROFILE remembers, and the metadata field each is kept in.
 *
 * The names are ReaPrime's `WorkflowContext` field names, because that is what the load
 * path writes them back into (`rea-profile.js` `workflowApplyBody`). `grinderSetting` is
 * a string there and a number here, which is why the caller spells it.
 */
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

        /* The last state read off each source. Held rather than re-read in render so one
         * render pass sees one consistent picture. */
        this.connection = null;
        this.machine = null;
        this.capabilities = null;
        this.arm = null;
        /** The rail's document, off the workflow store. Its targets are the rail's values. */
        this.workflow = null;
        /** The profile listing and the five favourite slots. */
        this.library = null;
        /** The stored shot history: the list page and, for the newest, its derivation.
         *  Named `shotHistory` and not the obvious word — Gate D's CB-21 rule refuses
         *  the spelling `.shots` in client code; see the boot object's own note. */
        this.shotHistory = null;
        /** The cup warmer's frame — the header's Warmer control reads it. */
        this.cupWarmer = null;
        /** ReaPrime's own preferences document, whole. The rail reads ONE field of it —
         *  `stopHotWaterAtWeight`, which is what ends a hot-water pour. */
        this.appSettings = null;
        /** ReaPrime's installed-plugin listing, whole. This controller reads ONE fact out
         *  of it — whether DYE2 is loaded — and the screen draws one button on that. */
        this.plugins = null;
        /**
         * WHICH STORED SHOT THE BAND IS SHOWING. 0 is the newest, which is where it
         * starts and where a machine swap puts it back. Ben's arrows move it (23 Aug
         * 2026), and it is clamped on READ rather than here, because the list changes
         * underneath it: a shot finishing prepends a row, and an index that outlived
         * its page would blank the band rather than follow it.
         */
        this.shotIndex = 0;
        /** Whether the machine was running at the previous update — the shot-start edge. */
        this.wasRunning = false;
        /** The scale feed's published state — the gauge cluster's weight channel. */
        this.scale = null;
        /** The tank's level and refill threshold, in millimetres — the TANK tile. */
        this.water = null;
        this.milk = null;
        this.estimator = null;

        /* THE STEAM SESSION (Ben, 24 Aug 2026: "There is a steam chart that is shown in
         * the live view when steaming"). The MODE is a fold over machine frames and the
         * BUFFER is what those frames accumulate into; both live here because this row
         * already holds the machine feed and the milk feed the buffer needs, and a second
         * subscriber to either would be a second answer to what the machine is doing. */
        this.chartMode = initialChartMode();
        this.steam = createSteamBuffer({ logger: null });
        this.#steamHold = null;

        /* THE RAIL'S STORED PREFERENCES, held here because they are READ on every render
         * and WRITTEN once in a while. The KV router answers a promise, and a render pass
         * cannot await, so each is loaded on attach and again after a write, and a redraw is
         * what publishes it.
         *
         * THE TWO STOP MODES ARE NO LONGER AMONG THEM (27 August 2026), and their absence is
         * the point of this pass. `stopModes` sat here as `{steam, water}`, seeded from the
         * `steamStopMode` and `hotWaterStopMode` KV rows — a SECOND STORE for a fact the
         * machine already holds, beside a Settings page that reads the machine. Two stores
         * for one setting is B7's founding defect and it was shipping: on the mock's own
         * machine, which holds `stopHotWaterAtWeight: true`, the rail said "Volume stop" and
         * printed "240 mL" while Settings said Weight and "240 g", and the pour would have
         * ended at 240 grams. Both are derived in `hostUpdate` now, from the same fields
         * Settings derives them from, and neither is held here at all. */
        this.presets = null;
        /* NULL UNTIL THE PREFERENCE READ LANDS, and `#onKeyDown` reads the shipped
         * defaults meanwhile. Not seeded with the defaults here: `null` says "not read
         * yet", which is what the no-redraw comparison below needs to be true. */
        this.keyBindings = null;
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this.tankUnit = DEFAULT_TANK_UNIT;
        this.tempUnit = DEFAULT_TEMP_UNIT;
        /* THE CLOCK, AS A SEAM. `#pushReadings` is the one rate-limited thing in this
         * file, and a test that had to move real time to prove it would be a slow test
         * asserting on a sleep. Same shape `ui-screensaver.js` uses for the same reason. */
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
        /* `rating-change` IS THE COMPONENT'S OWN EVENT, HEARD WHERE IT ARRIVES. Every
         * other name in this list is one `<live-screen>` dispatches itself; this one is
         * raised by `<ui-rating-control>` and is `composed: true`, so it crosses the
         * screen's shadow boundary and arrives here. Re-dispatching it from the screen
         * first would be a second name for one fact and a second thing to keep in step. */
        this.host.addEventListener('rating-change', this.#onRatingChange);
        /* `notes-change` IS THE SCREEN'S OWN (D14). Unlike `rating-change` above it is
         * dispatched by `<live-screen>` rather than by a component, because the sheet's
         * Save reads the editor's text at the moment of the press — the editor owns the
         * document and nobody else holds a copy of it. */
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

        // NO BOOT, NO OPINION. With no shell attached this controller has no stores to
        // answer from, and writing `false`/`null` anyway would make it a SECOND owner of
        // two properties it cannot answer — which is L11's shape, in the file that exists
        // to kill L11. It also keeps the skeleton's own suite meaningful: that suite
        // mounts `<live-screen>` bare and sets `ghc` by hand to measure the strip's row.
        if (!this.boot) return;

        this.host.ghc = this.ghcGate().render;
        this.host.dim = liveDim(this.dimState);
        this.host.machineState = this.machineState ?? '';

        /* THE TWO THE RAIL RUNS ON, and the reason they are here rather than anywhere
         * else. `<live-screen>` declares `targets` and `limits` and its own `#commit`
         * names their owner — "the owner of the machine's settings answers by handing
         * `targets` back" — and no owner existed, so every rail control rendered disabled
         * and the one handler that writes `targets` sat behind the controls it needed.
         * They belong to this controller for the reason `machineState` does: it already
         * holds both subscriptions the answers come from, and a second reader of the same
         * stores would be a second answer to one question, which is L11's shape.
         *
         * THROUGH THE R2 DOOR, not `limitsFor` directly. The adapter is where "which
         * machine class is this" is decided from a SERVED answer rather than a model
         * string, and it is the door that will be deleted whole when ReaPrime serves the
         * table (R2/B2). Calling past it would leave a second place to fix that day. */
        this.host.limits = r2MachineLimits(this.capabilities ? this.capabilities.entries : null).value;
        const targets = this.workflow ? this.workflow.targets : Object.freeze({});
        this.host.targets = targets;

        /* THE THREE PROPERTIES THE RAIL DECLARED AND NOBODY EVER SET.
         *
         * `<live-screen>` has carried `offers`, `steamStop`, `waterStop` and `presets`
         * since the rail was built, and an audit of every property against its writer
         * found four with none. What that looked like on glass:
         *   offers      — the Milk and Weight options were disabled on EVERY machine,
         *                 because `stopModeRow` fails closed and nothing answered.
         *   steamStop   — the rail said "Timed stop" whatever Settings had been set to,
         *                 and stepped the duration when the machine stops on milk temp.
         *   waterStop   — the same, for volume against weight.
         *   presets     — the two banks were the shipped defaults for ever; the KV rows
         *                 `drinkOutPresets` / `steamFlowPresets` had no reader.
         * A declared property with no writer is this rewrite's signature defect, and it
         * is the same shape as the screensaver that was mounted nowhere. */
        /* THE CHART'S MODE AND, WHEN IT IS STEAM, THE SESSION ITSELF. The screen switches
         * its channels and its axes on the mode; it never asks what the machine is doing. */
        this.host.chartMode = this.chartMode.mode;
        this.host.steamDerivation = this.chartMode.mode === CHART_MODE.STEAM
            ? this.steam.get() : null;
        /* WHETHER THE STEAM SESSION HAS SETTLED, which is what decides the chart's end
         * labels. It is the hold — the window that keeps the steam graph up after the
         * valve closes — and `steam-chart.js` already computes it, so this reads the fold
         * rather than starting a second timer beside it. */
        this.host.steamSettled = isSteamHoldActive(this.chartMode);
        /* AND WHETHER THERE IS A MILK PROBE AT ALL. Slate omits the milk trace when there
         * is none; the feed's own presence is the answer and this is the only reader. */
        this.host.milkPresent = Boolean(this.milk && this.milk.status !== FEED_STATUS.STALE
            && valueOf(this.milk)?.ok === true
            && hasReading(valueOf(this.milk).temperature));

        this.host.offers = this.#offers;
        /* WHAT ENDS A STEAM SESSION AND WHAT ENDS A HOT-WATER POUR — DERIVED FROM THE
         * MACHINE'S OWN FIELDS, WHICH IS THE WHOLE OF THIS PASS (27 August 2026).
         *
         * WHAT IT WAS. Both came out of KV rows this controller loaded on attach and wrote
         * on a press — `steamStopMode` and `hotWaterStopMode` — while the Settings page had
         * already been moved onto ReaPrime's own fields. Two sources for one fact, and they
         * could disagree in both directions and did:
         *   choose Off for steam in Settings and the rail still said "Timed stop", because
         *   its KV copy had never heard of Off and normalised it onto the mode it could step;
         *   set hot water to stop at weight in Settings and the rail's caption did not know;
         *   press the rail's water toggle and the MACHINE never heard, because that branch
         *   wrote the KV row and nothing else — its own comment admitted as much.
         *
         * WHAT IT IS. `steamStopFrom` reads the two fields that ARE the steam stop
         * (`steamSettings.stopAtTemperature`, then `steamSettings.duration` — ordered, the
         * first positive one names the mode) off the workflow document the rail was already
         * showing. `waterStopFrom` reads `stopHotWaterAtWeight` off ReaPrime's preferences.
         * Both are the derivations `settings-leaf-model.js` runs for the same two banks, and
         * `test/live-targets.test.mjs` holds the two answers against each other.
         *
         * NULL IS A REAL ANSWER AND IS PASSED ON AS ONE (A7). A workflow that has not landed
         * and an app-settings document that has not landed both give null; the caption draws
         * the dash the steppers beside it are already drawing, rather than a claim about a
         * machine nobody has heard from. This is why `<live-screen>` stopped defaulting
         * these two properties on the same day. */
        this.host.steamStop = steamStopFrom(targets);
        this.host.waterStop = waterStopFrom(this.#stopHotWaterAtWeight);
        this.host.presets = this.presets;
        this.host.clockFormat = this.clockFormat;
        this.host.tankUnit = this.tankUnit;
        this.host.tempUnit = this.tempUnit;

        /* THE PROFILE'S NAME COMES OFF THE RAIL'S OWN DOCUMENT, not off a second read.
         * `GET /api/v1/workflow` carries `profile.title` beside the `context` block the
         * rail steps, and the workflow store holds the document whole ("Held whole:
         * `patchFor` needs the steps"). A second source for the same string is how two
         * boxes on one screen come to disagree about which profile is loaded.
         *   ORACLE live-ready #profile-name [i=92] "Extractamundo Dos! (2)" —
         *          the fixture document's own `profile.title`, exactly.
         * ABSENT IS ABSENT: no document, no name, and the heading collapses to the
         * status chip rather than reserving a box for a string nobody supplies. */
        this.host.profileName = this.#profileTitle;

        /* THE FIVE SLOTS. `favouriteEntries()` is the shape `<ui-favourites-bank>`
         * documents — five entries, `{value, name}` or null — and the selector's rail
         * already binds that same call, so this is a second READER of one answer rather
         * than a second answer. */
        this.host.favourites = this.#favourites;
        this.host.favourite = this.#loadedProfileId;

        /* THE LAST SHOT. The chart and the foot band are about the shot that is running
         * while one is; at rest they are about the last one stored, which is what Slate
         * draws and what Ben ruled. The screen composes the two (`#bandDerivation`,
         * `#chartDerivation`); this controller only says what the stored one IS. */
        const stored = this.#storedShot;
        this.host.storedDerivation = stored.derivation;
        this.host.storedShot = stored.record;
        this.host.shotId = stored.id ?? '';
        this.host.rating = stored.rating;
        this.host.historyCount = this.shotHistory && Number.isFinite(this.shotHistory.total)
            ? this.shotHistory.total : 0;
        /* WHETHER THIS MACHINE HAS DYE2. Read off the listing and off nothing else — see
         * `#dye2Loaded` for why `loaded` rather than `autoLoad`, and why an unread listing
         * is `false` here rather than a maybe. */
        this.host.dye2 = this.#dye2Loaded;

        /* WHAT THE ARROWS CAN REACH, answered here because the index and the page are
         * both this controller's. The band renders a disabled control; it decides
         * nothing. The reach is the PAGE the shell read, not `total` — the arrows walk
         * rows that are already in hand and stop at the end of them, and the whole
         * archive is the History screen's pager. */
        this.#resetShotIndexOnShotStart(this.machineState);

        const rows = this.shotHistory && this.shotHistory.items ? this.shotHistory.items.length : 0;
        const at = Math.min(Math.max(this.shotIndex, 0), Math.max(rows - 1, 0));
        this.host.canStepOlder = rows > 0 && at < rows - 1;
        this.host.canStepNewer = rows > 0 && at > 0;
        /* WHETHER THE BAND IS ABOUT A SHOT THE USER WENT LOOKING FOR. The screen needs it
         * to know whether the stored shot outranks the live buffer's last one — see
         * `<live-screen>` `#bandDerivation`. Read off the CLAMPED index, so a list that
         * shrank under the arrows does not leave the screen claiming to be browsing a row
         * that is no longer there. */
        this.host.browsingHistory = at > 0;

        /* THE GAUGE CLUSTER'S NUMBERS (Ben's ruling, 22 Aug 2026: "READOUTS AT IDLE
         * SHOW 0.0 in channel ink where the machine serves numbers … dashes only for a
         * channel genuinely absent"), AT 5 Hz RATHER THAN THE FEED'S OWN RATE. */
        this.#pushReadings();

        /* THE HEADER'S WARMER CONTROL. Three states, and the third is the one that
         * matters: on, off, or NO READING — never an assumed off. */
        this.host.warmer = this.#warmer;

        /* THE WEATHER CORNER'S READING. Null on a machine without the plugin, which is
         * what makes the corner absent rather than empty. */
        this.host.weather = this.boot && this.boot.weather ? this.boot.weather.get() : null;

        /* THE EXPANDED CHART'S COMPLIANCE BADGE. Its two channels come off the estimator
         * sensor's own frame, not off the machine snapshot: `compliance` and `flags` are
         * the puck estimator's, and `expanded-summary.js` owns the rule that reads them
         * together (the C-observed bit and a finite value, or the em dash). */
        this.host.compliance = this.#compliance;
    }

    /**
     * The cup warmer, as the header's control takes it: `{present, on}`.
     *
     * `present` FALSE MEANS HIDE THE CONTROL, and it is the capability's answer alone.
     * The store's own contract row is quoted in its header: "404 here means the feature
     * is absent — hide the control. It is not 'route missing' and not an error to show."
     * So UNSUPPORTED is the only state that takes the button off the band; every other
     * state keeps it, because a machine that HAS a mat and is not answering about it is
     * a machine whose mat you still want the button for.
     *
     * `on` IS A TRISTATE and null is a real answer. `isWarmerOn` is the store's own
     * predicate and it reads the `enabled` field, never `temperature > 0` — premise 1
     * of the store's four dead ones, and the bug it names is precisely "a machine
     * holding setpoint 60 with the warmer off painted as ON". With no frame at all
     * (loading, or an error with nothing read before it) there is no on/off to report
     * and this answers null, which the header draws as the dash.
     *
     * AT THIS PIN THAT IS THE MOCK'S ANSWER, deliberately: `tools/mock_rea.py` serves
     * `machine/cupWarmer` a 410 because its committed recording still carries the
     * retired `prewarm*` keys, so the capture shows Warmer over a dash. That is the
     * instrument being honest about a refuted fixture, not the control being broken.
     */
    get #warmer() {
        const frame = this.cupWarmer;
        if (!frame) return NO_WARMER;
        if (frame.status === CUP_WARMER_STATUS.UNSUPPORTED) return WARMER_ABSENT;
        return Object.freeze({
            present: true,
            on: frame.warmer ? isWarmerOn(frame.warmer) : null,
        });
    }

    /**
     * ===========================================================================
     * WHAT THE FIVE GAUGES READ — the feeds, not a placeholder
     * ===========================================================================
     * `<live-screen>` handed its tiles NO value in any state, and said why in its own
     * comment: five frozen digits had shipped once, the review measured them
     * byte-identical across 200 in-shot samples beside a live chart, and they were
     * pulled rather than left ("the number arrives with live-components-inventory's
     * row"). This is that row. Nothing here formats and nothing here defaults: the
     * feed's own reader has already decided what is a reading and what is an absence,
     * and `hasReading` is the one predicate that tells them apart.
     *
     *   pressure / flow / group / steam   `/ws/v1/machine/snapshot`, through
     *       `readMachineSnapshot` — key presence is the validity signal on that frame
     *       and the reader has already applied it.
     *   weight                            `/ws/v1/scale/snapshot`, through
     *       `readScaleSnapshot`. THE ONE GRAVIMETRIC CHANNEL, for every machine.
     *
     * A DEAD FEED READS AS AN ABSENCE, WHICH IS THE ONE THING A FROZEN NUMBER CANNOT
     * SAY. `machineStale` is already this controller's answer to "the reading is no
     * longer to be believed" (it is what turns the header chip to "No reading"), and a
     * gauge that went on showing 9.2 bar behind a socket that closed would be the same
     * defect the frozen placeholders were, arrived at from the other side.
     *
     * TIME IS NOT HERE. It is the SHOT's clock, not a channel — `<live-screen>` reads
     * it off the same derivation the chart and the phase table read, so the three
     * cannot disagree about how long the shot has been running.
     */
    /**
     * THE GAUGE CLUSTER, PUSHED AT 5 Hz INSTEAD OF THE MACHINE'S OWN RATE.
     *
     * Ben, 29 August 2026: "could we make it so they don't change at 15 Hz? Make it say
     * 5 Hz instead? Just the values in the data row above the chart, not anything else,
     * charts should still update at 15 Hz."
     *
     * THE THROTTLE IS SIMPLY NOT REASSIGNING. `#readings` builds a NEW frozen object on
     * every read, and a new identity is the whole of what makes Lit re-render the tiles.
     * So holding the last one for 200 ms is the rate limit, and it needs no timer, no
     * queue and no copy of the values. NOTHING ELSE IN THIS METHOD IS THROTTLED: the chart
     * takes its samples from the derivation, not from `readings`, so it keeps every frame.
     *
     * TWO FLUSHES ARE MANDATORY, and without them this is a bug rather than a fix.
     *
     * 1. A CHANNEL APPEARING OR DISAPPEARING. `#readings` distinguishes a number from a
     *    channel that is genuinely absent, and the tile draws the second as a dash — Ben's
     *    22 August ruling, quoted at the call site. A dash that arrives 200 ms late is a
     *    STALE NUMBER on screen, which is worse than a slow one: the reading it shows is
     *    not merely old, it is of a channel the machine has stopped serving. So the
     *    presence pattern is compared, not the values, and any change to it publishes at
     *    once.
     * 2. A MACHINE STATE CHANGE. Entering or leaving a shot must be crisp. This is the
     *    same frame the promotion and the chart mode turn on, and the cluster arriving up
     *    to 200 ms after them would read as the screen tearing.
     *
     * Values alone never force a flush — that is exactly the 15 Hz churn being removed.
     */
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
            /* THE TANK, AT LAST. Ben, 23 Aug 2026: "Tank just shows as -, no water level
             * being shown." The tile has been built and dashed since the band was made,
             * with its own note naming the gap — the channel was tabled and no feed
             * attached it. `readings.tank` is the millimetres the machine sends; the
             * mm -> mL table is Slate's own port of the TCL skin's 68 entries and is a
             * SETTING there, defaulting to mm, so mm is what this shows. */
            tank: from(this.water ? valueOf(this.water) : null, 'currentLevel'),
            /* MILK, off its own sensor socket rather than off the snapshot. ReaPrime
             * removed `milkTemperature` from MachineSnapshot in 633f6f68
             * (`rea-names.js` records the move), so reading it there would be reading a
             * field the machine stopped sending. */
            milk: from(this.milk ? valueOf(this.milk) : null, 'temperature'),
        });
    }

    /**
     * The compliance badge's two channels, as `complianceBadge` takes them.
     *
     * A STALE FRAME IS NOT A READING, which is the same rule `#readings` applies to the
     * machine snapshot: the estimator publishes at sample rate during a pour and goes
     * quiet between shots, so a frame past its budget is the last pour's C and not this
     * one's. The badge's absent form is what a quiet estimator should draw.
     */
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

    /** The five favourite slots, or null while the listing has not landed. `null`
     *  rather than five blanks: the bank draws its own empty slots either way, and a
     *  frozen empty array would claim the rail is known to be empty. */
    get #favourites() {
        const store = this.boot ? this.boot.library : null;
        if (!store || typeof store.favouriteEntries !== 'function' || !this.library) return null;
        return store.favouriteEntries();
    }

    /**
     * Which of the five the machine has loaded, or '' — R1's own answer, off the same
     * listing read, never re-derived from the workflow's title.
     *
     * WHILE ONE IS BEING LOADED, IT IS THE ONE BEING LOADED, and that is a fact off the
     * library store rather than a guess made here. Loading a profile is two writes and a
     * re-read; `loaded.id` is only true at the end of it, and for the second or so it
     * runs the honest answer to "which slot is the machine on" is the slot the person
     * just pressed. `armingId` is the store's own word for it and its header carries the
     * argument.
     *
     * THIS REPLACED A SECOND OWNER, not a missing one. `<live-screen>`'s `#onFavourite`
     * used to write `this.favourite` itself the instant the slot was pressed, and this
     * getter overwrote it from `loaded.id` on the next update — two writers, one
     * property, and the visible result was Ben's 27 August report: "it highlights but if
     * you then click edit profile it will show the previous one". The highlight was
     * asserting a wish; now it asserts what the app is doing, and then what it did.
     */
    get #loadedProfileId() {
        const arming = this.library ? this.library.armingId : null;
        if (typeof arming === 'string' && arming) return arming;
        const loaded = this.library ? this.library.loaded : null;
        return loaded && typeof loaded.id === 'string' ? loaded.id : '';
    }

    /**
     * The newest stored shot: its id, its derivation and its ReaPrime rating.
     *
     * READ OFF THE STORE'S OWN MAPS, never re-walked here. `derivationOf` is the walk
     * the store already ran once when the shell asked for the record ("ONE fetch and
     * ONE walk per id"), and running gate 6 again in a render path would be a second
     * walk over 221 KB per frame.
     */
    get #storedShot() {
        const store = this.boot ? this.boot.shotHistory : null;
        const state = this.shotHistory;
        const items = state && state.items ? state.items : [];
        /* THE SELECTED ROW, NOT ALWAYS THE NEWEST. Ben, 23 Aug 2026: "The history
         * pannel part on the left needs left and right arrows to allow navigating
         * between old shots in the history, this should update the chart etc." The
         * index is clamped on read rather than on write, because the LIST can change
         * underneath it — a shot finishing prepends a row — and an index that outlived
         * its page would otherwise read undefined and blank the band. */
        const index = Math.min(Math.max(this.shotIndex, 0), Math.max(items.length - 1, 0));
        const chosen = items.length ? items[index] : null;
        const id = chosen && typeof chosen.id === 'string' ? chosen.id : null;
        if (!id || !store) return NO_STORED_SHOT;
        const derivation = typeof store.derivationOf === 'function' ? store.derivationOf(id) : null;
        const enjoyment = chosen.annotations ? chosen.annotations.enjoyment : null;
        return {
            id,
            /* THE LIST ROW, not the 221 KB record: the band names the shot with its
             * timestamp and its profile title, and both are on the page already
             * (`shotClock` and `shotTitle` read exactly those two fields). Handing the
             * full record over would put every measurement in a render path for two
             * strings. */
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

    /**
     * Whether the machine's own channel has gone quiet or gone away.
     *
     * `STALE` is the one status that means "we hold a reading and it is no longer to be
     * believed" — reached by age past the feed's budget, by a socket CLOSE
     * (`feed-store.js:206-212` latches it), or by an error envelope. `NEVER` is not this:
     * nothing has arrived, the screen has nothing to un-say, and the boot state of every
     * feed must not paint the screen as broken.
     */
    get machineStale() { return this.machineFeedStatus === FEED_STATUS.STALE; }

    /**
     * THE STATE THE ONE DIMMING OWNER MAPS FROM: `machineState` while the feed is worth
     * believing, `null` the moment it is not. The decision itself is `dimStateFor`'s, in
     * the lib half, where it is testable without a browser and sits beside the map it
     * guards; this getter is the composition of the two facts this controller already
     * holds. `machineState` ITSELF IS UNTOUCHED on purpose — it drives `#running`, the
     * rail's mode and the chip text, and a stale feed must not withdraw the STOP target.
     *
     * BOTH DEAD STATUSES, NOT ONLY `UNAVAILABLE`: a blip that latches STALE never clears
     * itself, so gating on the source's verdict alone would leave the reported bug
     * standing in its own reproduction. The cost is one flap on a >2 s gap mid-shot, at
     * the SAME threshold the header chip already flips at, and it restores access rather
     * than removing it. REVERSAL, one line: drop `FEED_STATUS.STALE` from
     * `DIM_BLIND_STATUSES`. Recorded in `waves/5.1/DEFERRED_QUESTIONS_fix-3.md`.
     */
    get dimState() {
        return dimStateFor(this.machineState, this.machineFeedStatus);
    }

    /* ─────────────────────────────────────────────────────────── the staleness clock */

    /**
     * Re-classify every feed by age. Public because a test drives it directly rather than
     * waiting on wall-clock, and because the tick is a fact about this controller worth
     * naming; `now` is injectable for the same reason the stores take one.
     */
    tickStaleness(now) {
        const live = this.boot ? this.boot.live : null;
        if (!live || typeof live.refreshStaleness !== 'function') return;
        if (now === undefined) live.refreshStaleness();
        else live.refreshStaleness(now);
    }

    /**
     * The refusal to surface, or null (B9).
     *
     * TWO SOURCES, ONE SURFACE. The arm-time 400 (`Unsupported profile`) was the first;
     * `PUT /machine/state/espresso` has a typed 400 of its own —
     * `{details:'No scale detected, blocking espresso request', type:'block_no_scale'}`
     * — and a press that is refused with no word on screen is exactly the failure this
     * surface exists for. The STATE refusal is preferred because it is the newer event:
     * a person who just pressed Espresso is being told about that press.
     *
     * THE SHAPE IS `<live-refusal>`'s, and the state store's body is not it: ReaPrime
     * spells the two fields `type` and `details` there, against `error` and `message` on
     * the profile route. Translating at the read is what keeps one banner able to render
     * both without learning either route's spelling.
     */
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
        /* A RAIL WRITE THE MACHINE WOULD NOT TAKE. The store already reverts the number
         * and records `writeError`; nothing read it, so a refused press looked like a
         * stepper that would not step. Slate says it out loud — `railWriteFailed` toasts
         * "Machine did not accept <what>" — and this is the same sentence on the surface
         * this screen already has for a refusal. */
        const write = this.workflow ? this.workflow.writeError : null;
        if (write) {
            /* THE SERVER'S OWN SENTENCE WHEN IT SENT ONE, and nothing when it did not.
             * `problem` is ReaPrime's `{error, message}` kept verbatim by the transport;
             * `result.message` is the transport's own line ("PUT /workflow -> 400"),
             * which is a diagnostic and not something to put in front of a person. */
            const problem = write.problem && typeof write.problem === 'object' ? write.problem : null;
            const said = problem && typeof problem.message === 'string' ? problem.message : '';
            return Object.freeze({ kind: 'write', error: t(WRITE_REFUSED), message: said });
        }
        /* THE ARM'S TWO ENDINGS, IN ORDER. A refusal is the server's own statement and it
         * goes through untouched, exactly as B9 requires. A FAILURE carries no statement
         * about the profile at all, so this is where one is supplied — see ARM_UNDELIVERED
         * for why the words are in this file and not in the two layers below it. */
        const armed = this.arm ?? null;
        if (armed && armed.refusal) return armed.refusal;
        if (armed && armed.status === ARM_STATUS.FAILED) {
            /* WHY IS IT NOT THERE? Answered from the SAME derivation the connection band
             * on this screen renders from, so the banner and the band cannot disagree
             * about whether there is a machine. `quiet` is exactly `ready` — connected,
             * nothing to say — and anything else means the profile has nowhere to go.
             *
             * THIS BRANCH IS ONLY REACHED WHEN ReaPrime ITSELF ANSWERED. A tablet that
             * cannot reach ReaPrime fails the workflow PUT too, and the `write` branch
             * above it fires first — which is what makes "no machine is connected" an
             * honest reading of a failed arm rather than a guess. */
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

    /**
     * The machine's own state name, or null.
     *
     * `readMachineSnapshot` returns either the name or a no-reading object; an absence is
     * `null` here, and `liveDim(null)` dims nothing. Fail-visible on purpose — a snapshot
     * that has not arrived must not recede the rail.
     */
    get machineState() {
        const snapshot = this.machine ? valueOf(this.machine) : null;
        if (!snapshot || isNoReading(snapshot.state)) return null;
        return snapshot.state;
    }

    /**
     * THE TWO OFFERS THE STOP-MODE TOGGLES ARE GATED ON.
     *
     * `stopModeRow` reads `true | false | null` and enables on `true` alone, which is
     * the tri-state the capability store already speaks: PRESENT / ABSENT / UNKNOWN.
     * Translating here rather than in the row model keeps the model free of the store's
     * vocabulary, and keeps "we have not been told yet" distinct from "this machine
     * does not have one" — the difference between a disabled option with a reason and a
     * disabled option that looks broken.
     *
     * MILK PROBE IS AN R3 SENSOR ANSWER, not one of the served seven, so it comes
     * through `sensorCapability` and STOP AT WEIGHT through the served list. Two doors
     * because ReaPrime has two, not because this file chose to have two.
     */
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

    /**
     * WHETHER THIS MACHINE ENDS A HOT-WATER POUR ON THE SCALE — the one field the Live
     * rail reads off ReaPrime's own preferences document.
     *
     * THREE ANSWERS, AND THE THIRD IS THE ONE THAT MATTERS. `true` and `false` are the
     * machine's; `undefined` is "no document has arrived" and must NOT collapse into
     * `false`, because a rail that read an unanswered store as "stops on volume" would be
     * back to asserting a stop condition it was never told — the defect this whole pass is
     * about, wearing a different store's name. `waterStopFrom` is the one place that
     * mapping lives and it keeps all three apart.
     *
     * READ AT RENDER, NOT CACHED. The state is already parked on `this.appSettings` by the
     * subscription loop, so this is a lookup into a held frame rather than a second copy of
     * it — the same shape `machineState` and `#offers` above use, and for the same reason.
     */
    get #stopHotWaterAtWeight() {
        const document_ = this.appSettings ? this.appSettings.document : null;
        if (!document_ || typeof document_ !== 'object') return undefined;
        const held = document_.stopHotWaterAtWeight;
        return typeof held === 'boolean' ? held : undefined;
    }

    /**
     * IS DYE2 RUNNING ON THIS MACHINE? The one fact this controller takes off the plugin
     * listing, and the whole gate on the Live screen's DYE2 button.
     *
     * `loaded`, NOT `autoLoad`, AND THE TWO DISAGREE EXACTLY WHEN IT MATTERS. The Plugins
     * page reads `autoLoad` on its switch and says why: "`loaded` and `autoLoad` move
     * together because `/enable` sets both, so the switch reads `autoLoad`: it is the
     * PERSISTENT answer, and `loaded` can differ transiently while a plugin is being
     * reloaded". That is right for a SWITCH — a control must not flicker off while the
     * thing it commands restarts. It is wrong for a LINK. This button opens a page that
     * DYE2 itself serves (`GET /api/v1/plugins/dye2.reaplugin/bean-picker` is answered by
     * the plugin, not by ReaPrime), so a plugin that is enabled-but-not-yet-loaded would
     * hand the reader a new browser context showing an error. `loaded` is the question
     * "will that URL answer", which is the question the button is actually asking.
     *
     * AN UNREAD LISTING IS `false`, AND THAT IS NOT A DEFAULTED ANSWER (A7). It is the
     * honest one for this particular pixel: the button is an OFFER, and an offer that has
     * not been established is an offer this screen must not make. Nothing is lost by
     * waiting — the listing lands a few hundred milliseconds after the mount and the button
     * appears then, exactly as the favourites rail fills in when its own read lands. The
     * inverse — drawing the button and finding out afterwards — is a dead-end control,
     * which is the shape `ui-rating-control`'s own header records as the measured old-skin
     * defect: "button visible, window.openDye2ForShot undefined", where every tap did
     * nothing at all.
     *
     * READ AT RENDER, NOT CACHED, like the three getters above it.
     */
    get #dye2Loaded() {
        const listing = this.plugins ? this.plugins.plugins : null;
        if (!Array.isArray(listing)) return false;
        return listing.some((manifest) => manifest
            && manifest.id === DYE2_PLUGIN_ID
            && manifest.loaded === true);
    }

    /**
     * READ THE TWO PRESET BANKS AND THE REST OF THE RAIL'S STORED PREFERENCES out of the KV
     * rows that `storage-routes.js` declared for them, and publish by redraw.
     *
     * THE TWO STOP MODES HAVE LEFT THIS LIST, and the paragraph that used to stand here is
     * worth keeping as the record of why. It described a fix — "THE STEAM ROW HAS TWO
     * VOCABULARIES AND THAT IS A BUG THIS CLOSES … NORMALISING ON READ is the fix that
     * cannot drift: anything that means milk is MILK, everything else — including `off`,
     * which is not a stop CONDITION but the absence of one — is TIME, which is what the rail
     * can actually step." Every sentence of that is true about the KEY and the key was the
     * problem. Normalising Off onto Time made the two spellings agree at the cost of the
     * rail stating something false about the machine, and no amount of care at this end
     * could have fixed that, because the value being read was a copy. The mode is derived
     * from the machine's own fields in `hostUpdate` now and there is no copy to normalise.
     */
    async #loadRailPreferences() {
        const storage = this.boot ? this.boot.storage : null;
        if (!storage || typeof storage.get !== 'function') return;
        const generation = this.boot;
        /* THE ORDINALS BELOW COUNT FROM SIX BECAUSE TWO ROWS LEFT THIS READ (27 August
         * 2026): `steamStopMode` and `hotWaterStopMode` were the first and second, and both
         * are retired in `storage-routes.js` now — the rail derives both stop modes from the
         * machine. The numbering is left as written rather than renumbered, because each
         * ordinal names the finding that added its row and renumbering would break the trail
         * back to it. */
        const [drink, flow, bindings, clockFormat, tankUnit, tempUnit] = await Promise.all([
            storage.get('drinkOutPresets').catch(() => null),
            storage.get('steamFlowPresets').catch(() => null),
            /* THE FIFTH, AND IT IS THE OTHER HALF OF A CONTROL ON A SETTINGS PAGE. Until
             * 24 Aug 2026 `#onKeyDown` called `stateForKey(event.key)` with no map, so it
             * read `DEFAULT_KEY_BINDINGS` and a stored override could not have reached it.
             * Building the rebind editor without this read would have shipped a settings
             * page that showed a new key while the machine still answered the old one —
             * the finished-half-with-no-other-half shape, in the one place it is hardest
             * to notice, because both halves look right on their own screen. */
            storage.get('keyboardBindings').catch(() => null),
            /* THE SIXTH. The header's clock and the sleep screen's must not disagree
             * about how a time is written, so both read ONE preference — see
             * `wall-clock.js`, which was extracted for the same reason. */
            storage.get('clockFormat').catch(() => null),
            /* THE SEVENTH, AND IT IS ANOTHER SETTING THAT DID NOTHING. `waterTankUnit` has
             * offered mm | mL since the settings screen was built and had no reader
             * anywhere, so the Tank tile drew millimetres whichever the person picked.
             * Same shape as the key bindings above and found the same way — by asking of
             * every settings row whether anything is on the other end. */
            storage.get('waterTankUnit').catch(() => null),
            /* THE EIGHTH, AND IT IS THE LARGEST OF THESE. `units.js` carried the whole
             * temperature conversion and `createUnitsStore` had zero callers, so every
             * temperature in the skin was drawn in Celsius whatever the Temperature bank
             * said. It reaches the three gauge tiles AND the rail's three temperature
             * targets from here. */
            storage.get('tempUnit').catch(() => null),
        ]);
        /* A DIFFERENT MACHINE MAY HAVE ARRIVED WHILE THOSE WERE IN FLIGHT, and its
         * preferences are not this one's. The boot object is the identity. */
        if (this.boot !== generation) return;
        const drinkWeight = bank(drink, 'drinkOutPresets');
        const steamFlow = bank(flow, 'steamFlowPresets');
        /* NULL, NOT AN EMPTY OBJECT, when neither row is stored: `railRows` takes
         * `presets` per KEY and falls through to `DEFAULT_PRESETS` for a key it is not
         * given, so handing over nothing is how the shipped bank stays the answer. */
        const presets = (drinkWeight || steamFlow)
            ? Object.freeze({
                ...(drinkWeight ? { drinkWeight } : {}),
                ...(steamFlow ? { steamFlow } : {}),
            })
            : null;

        /* NOTHING STORED MEANS NOTHING CHANGED, AND THEN NOTHING IS REDRAWN.
         *
         * This read lands a few hundred milliseconds after the screen mounts, and on a
         * machine with no stored preferences its answer is the defaults the fields already
         * hold. An unconditional `requestUpdate()` there is a second full render of the
         * Live page for no difference — MEASURED as a second shot derivation on a screen
         * mounted mid-stream, by the loop suite's own reload test. */
        /* RESOLVED HERE AND HELD AS THE LOOKUP MAP. `resolveBindings` merges the stored
         * overrides onto the defaults, drops an unreadable one and refuses a duplicate —
         * so what this field holds is always a usable map, and `#onKeyDown` needs no
         * branch of its own. Nothing stored resolves to exactly the defaults. */
        const keyBindings = resolveBindings(bindings);

        /* AN UNKNOWN VALUE IS THE SHIPPED DEFAULT AND A KNOWN ONE IS ITSELF, which this
         * line got wrong for as long as the shipped default happened to be the else-branch.
         * It read `clockFormat === H12 ? H12 : DEFAULT_CLOCK_FORMAT`, so when the default
         * became Ben's 12-hour on 26 August an explicitly chosen '24h' was coerced back to
         * 12-hour and the Live header could never draw 24-hour again. The known set is named
         * once now, in `wall-clock.js`, where the screensaver's identical coercion reads it
         * too — two surfaces, one rule, which is why that module exists at all. */
        const clock = normaliseClockFormat(clockFormat);

        /* AND THE SAME RULE FOR THE TANK: an unrecognised value is the wire's own unit.
         * `normaliseTankUnit` answers null rather than coercing, so the fallback is chosen
         * here, where it can be read, instead of inside a parser. */
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




    /**
     * A SHOT WAS RATED — SEND IT (audit F-023, and the two dead wires under it, F-010).
     *
     * WHAT THIS WAS. The rating was set, was printed on the panel — "Rate this shot 60" —
     * and was never sent anywhere: the audit swept a whole run's request log and found
     * ZERO writes to any `/api/v1/shots/<id>` route, with `localStorage` and
     * `sessionStorage` both empty. After a reload the button read "Rate this shot —"
     * again. Fault kind 2 in its clearest form: written to the screen, never sent, gone.
     *
     * EVERY PIECE ALREADY EXISTED AND NOTHING JOINED THEM. `<ui-rating-control>` emits
     * `rating-change {score, shotId}` on its commit (Wave 0 reported it as a dead wire,
     * F-010). `CONTRACTS.json putShotsById` is a pin-verified row. `shots-store.js
     * setEnjoyment(id, value)` builds the PUT, sends the SMALLEST honest patch
     * (`{annotations:{enjoyment}}`, which the handler deep-merges over the stored record
     * so every other annotation and every sample survives), and updates the list row from
     * what was sent rather than re-reading 221 KB. The row's `consumedBy` even NAMED that
     * method. There was no listener. This is the listener.
     *
     * THE READ-BACK NEEDS NO CODE. `#storedShot` already reads `annotations.enjoyment` off
     * the list row, and `setEnjoyment` republishes the list with the new value, so the
     * store's own subscription redraws the panel — the same one-owner path every other
     * number on this band takes.
     *
     * NOT AWAITED AND NOT THROWN. `setEnjoyment` answers `{ok:false, failure}` on a refusal
     * and logs it; a rating is not an exception, and a rejection escaping here would be a
     * page error nobody can act on. `rating-input` (F-011) is deliberately NOT heard: it
     * fires under a moving thumb and the control's own header calls it LOCAL.
     */
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

    /**
     * A SHOT'S NOTE WAS SAVED — SEND IT (Ben's decision D14, 30 August 2026).
     *
     * The other half of `L0534`. Round 1 fixed the notes sheet's READING half (F-029): it
     * names the shot and prints what is stored against it, and the intent line's "and add
     * to" stayed owed because adding needs a writer, a route and a place to put it. All
     * three existed by the end of that night — `putShotsById` is pin-verified and the
     * rating fix above proved the route — so the writing half is this listener and
     * `shots-store.js setNotes`.
     *
     * THE SAME SEAM AS THE RATING, DELIBERATELY. `live-screen.js` renders and asks;
     * this owns the boot object and the store. A screen mounted in a fixture or the gallery
     * has no wiring above it and its Save is simply unheard, which is the honest behaviour
     * for a screen with no server rather than a branch that pretends.
     *
     * THE ANNOTATION, NEVER THE SHADOW. `setNotes` sends
     * `{annotations:{espressoNotes:text}}`; the handler rewrites the top-level `shotNotes`
     * from that annotation on every PUT, so a client that wrote the shadow would be writing
     * to a field the server is about to overwrite from somewhere else. The read-back needs
     * no code for the same reason the rating's did not — the store republishes the list
     * item from what was sent and the screen's subscription redraws.
     *
     * AN EMPTY STRING IS A STATEMENT, not an absence: a person who selects their note and
     * deletes it has said there is no note, and `''` is how that reaches the wire. The
     * store refuses anything that is not a string, so a malformed detail stops here.
     */
    #onNotesChange = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const store = this.boot ? this.boot.shotHistory : null;
        if (!detail || !store || typeof store.setNotes !== 'function') return;
        const { shotId, text } = detail;
        if (typeof shotId !== 'string' || shotId === '') return;
        if (typeof text !== 'string') return;
        Promise.resolve(store.setNotes(shotId, text)).catch(() => {});
    };

    /**
     * WHICH PRESET CELL IS ARMED ON THIS MACHINE — the key that had no writer (F-022).
     *
     * `storage-routes.js:504 steamFlowPresetIndex` declares the fact — "Which steam-flow
     * preset is armed on this machine" — and the audit found the string in exactly one
     * place in `src/`: its own row. It was READ four times per boot by the router
     * hydrating every machine-scope key, and written zero times, by anything, ever. This
     * is the writer.
     *
     * IT IS WRITTEN AND IT IS ALSO CLEARED, and the clear is the half that keeps it
     * honest. A press on a cell arms that cell; a press on the stepper or a number typed
     * into the keypad arms NO cell, and `#commit` says so by carrying `presetIndex: null`.
     * A key that only ever gained a value would go stale the first time somebody stepped
     * the dial and would then be a stored claim contradicting the row on the glass. The
     * router turns a null write into a delete (`storage-router.js:159-166`), so "no preset
     * armed" is the key's ABSENCE rather than a stored sentinel.
     *
     * ONLY THE BANKS THAT HAVE A KEY. `PRESET_INDEX_ROWS` is the map, and it has one entry
     * because the registry declares one: the drink bank's own armed-cell fact has no row
     * anywhere in the table, so there is nothing to write for it and nothing is invented.
     *
     * ===========================================================================
     * WHAT THIS DELIBERATELY DOES **NOT** DO: DRIVE THE HIGHLIGHT
     * ===========================================================================
     * The armed cell on the glass stays DERIVED FROM THE VALUE, which is what
     * `<ui-preset-bank>` is built to do and what its header already argues at length,
     * quoting Slate's own source (`steam-mode.js:57-75`, read-only) on the reason:
     *
     *     "The highlight is DERIVED from the current flow value, read-only in both
     *      directions … callers must never write one when applying it (the old boot path
     *      did the reverse, pushing the persisted tap-index's VALUE into the workflow,
     *      silently resetting a hand-dialed flow on every app load)."
     *
     * So the stored index is a RECORD of the last arming, not a source the row paints
     * from. Two representations of one fact are only safe while they agree, and the clear
     * above is what makes them agree: the key holds a cell exactly when the machine's own
     * value is that cell's, which is exactly when the bank marks it.
     */
    #recordArmedPreset(key, presetIndex) {
        const row = PRESET_INDEX_ROWS[key];
        if (!row) return;
        const storage = this.boot ? this.boot.storage : null;
        if (!storage || typeof storage.set !== 'function') return;
        const index = Number.isInteger(presetIndex) && presetIndex >= 0 ? presetIndex : null;
        Promise.resolve(storage.set(row, index)).catch(() => {});
    }

    /**
     * A PRESET WAS RE-CUT — write the bank where the next boot will read it.
     *
     * THE WHOLE BANK IS STORED, not the one cell, because that is what the row holds and
     * what `railRows` takes: a per-key array. The bank being written is the one on screen
     * (stored, else shipped), so re-cutting one cell of a default bank stores all four,
     * which is what makes the OTHER three survive the next `Revert`.
     */
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

    /**
     * A FAVOURITE SLOT'S MENU WAS USED.
     *
     * FOUR ACTIONS AND THREE OWNERS. `clear` is the library store's (`setFavourite` with
     * null — the call that had no caller in the whole skin). `edit` seats the record and
     * routes, which is the shell's two-step. `replace` and `browse` are the same trip
     * into the selector, and neither of them writes anything: the selector assigns to the
     * disc that gets pressed, so there is nothing to prepare and nothing to clear. See
     * the long note in the branch — clearing here is what emptied Ben's slot 3.
     *
     * CLEAR IS THE ONLY DESTRUCTIVE ACTION ON THIS MENU and it is the only one a person
     * presses meaning "empty this". That is the whole rule: a slot is emptied by the
     * gesture that says so, and by nothing else.
     *
     * THE MARK IS 1-BASED AND THE STORE IS 0-BASED, AND THIS ROW USED TO PASS ONE FOR THE
     * OTHER (audit F-027, fixed 29 August 2026). `<ui-favourites-bank>` answers with the
     * number a person reads off the disc — `favourite-hold` carries `slot = index + 1`
     * (ui-favourites-bank.js:244) — and `setFavourite` keys the assignments map by ARRAY
     * INDEX, refusing anything outside `0..4`. So "Clear button" on the FIFTH slot called
     * `setFavourite(5, null)`, was refused by the range guard, logged a warning nobody was
     * reading and sent no request at all: the audit measured 10.5 s of nothing after the
     * press and scored the only way this skin offers to empty a slot as DEAD. On slots one
     * to four it was worse than dead — it would have emptied the slot to the RIGHT of the
     * one that was held.
     *
     * THE CONVERSION IS HERE BECAUSE THIS IS WHERE THE TWO MEANINGS MEET, which is the
     * same placement and the same sentence as `selector-screen.js`'s own `#onFavouriteChange`
     * (":1147 — the mark is 1-based and the store is 0-based"). The EVENT keeps the disc's
     * number: it is a statement about the glass, the screen's own suite pins it ("the disc
     * a person reads is 1-based; cell 1 is slot 2"), and a controller is the right place to
     * translate a gesture into a store's vocabulary.
     */
    #onFavouriteAction = (event) => {
        const detail = event && event.detail ? event.detail : null;
        const library = this.boot ? this.boot.library : null;
        if (!detail || !library) return;
        /* NOT A COERCION. A mark that is not a whole number at or above one is not a slot,
         * and answering `0` for it would clear the FIRST slot on a gesture that named
         * none — the absent/zero collapse, on the destructive action. */
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
            /* =======================================================================
             * REPLACE OPENS THE SELECTOR AND DESTROYS NOTHING ON THE WAY
             * =======================================================================
             *
             * THIS IS THE BUG THAT EMPTIED BEN'S SLOT 3. Measured on his tablet on
             * 28 August 2026: `favouriteProfiles` came back
             * `{0:…, 1:…, 2:…, 3:null, 4:…}` and slot 3 had held "Rao Allongé" earlier
             * that day. His words: nothing anyone did intentionally cleared it.
             *
             * WHAT THIS BRANCH USED TO DO, and why it looked reasonable:
             *
             *     if (detail.action === 'replace') library.setFavourite(detail.slot, null);
             *     dispatch('library-open');
             *
             * with the comment "CLEAR FIRST FOR A REPLACE, so the selector's 'Add to
             * favourites' — which takes the first EMPTY slot — takes this one."
             *
             * TWO THINGS ARE WRONG WITH IT, AND THE SECOND ONE IS FATAL.
             *
             * FIRST, IT IS HALF A GESTURE. The clear is immediate, unconditional and
             * persisted; the assignment that was supposed to follow it is a separate
             * decision, on a different screen, that the person may simply not make. Press
             * Replace, look at the list, change your mind, press Back — and the profile
             * that was in that slot is gone, with nothing on screen having said so. The
             * destructive half runs on the press; the constructive half runs on a hope.
             * That is exactly the defect class this fork exists to remove.
             *
             * SECOND, THE CONSUMER IT CLEARS FOR DOES NOT EXIST. There is no "Add to
             * favourites" anywhere in this skin — grep the tree — and `firstEmptySlot()`,
             * the store method that would serve it, has no reader outside its own test.
             * The selector's ONLY assignment gesture is a press on a favourite disc with
             * a row selected (`selector-screen.js #onFavouriteChange` -> `#assign`), and
             * that call names its own slot and overwrites whatever is in it. It has never
             * needed the slot to be empty. So the clear bought nothing whatsoever: it
             * emptied a slot to satisfy a rule no code in this repo applies.
             *
             * BOTH ACTIONS USED TO DO THE SAME THING, AND THAT WAS THE HONEST STATE OF IT
             * rather than a shortcut: `browse` (from an empty slot) and `replace` (from a
             * filled one) were the same trip into the selector, and the selector assigned
             * to the disc you pressed. The paragraph that stood here ended by naming what
             * was missing — "the day an 'assign to the slot I came from' affordance is
             * built, this is where the slot would be carried — as a pending INTENT the
             * selector consumes, never as a write performed up front."
             *
             * =======================================================================
             * THAT DAY IS TODAY (audit F-001 / F-025, fixed 29 August 2026)
             * =======================================================================
             *
             * Ben, 29 August 2026: "I can select 'replace' which opens up the profile
             * selection page, but when I click confirm it doesn't change the favourite,
             * it just loads it like the normal profile page." Wave 3 reproduced it end to
             * end and added the fact that narrows it: the selector's OWN two assignment
             * routes both work — right key, right slot, right id — so nothing was broken
             * except that the slot never travelled. A person arriving from this menu met
             * Confirm, and Confirm does what Confirm always does.
             *
             * THE CARRY IS A SESSION ROW AND THE REGISTRY ALREADY DECLARED IT:
             * `storage-routes.js:311 pendingAssignmentIndex` — "Which favourite slot the
             * selector is filling. Dies with the tab by design." It had no writer. This is
             * the writer. It holds the 0-BASED index, because the only thing that ever
             * reads it hands it to `setFavourite`.
             *
             * IT IS AN INTENT, NOT A WRITE, AND THAT DISTINCTION IS THE 28 AUGUST RULE
             * STILL IN FORCE. Nothing on the rail is touched here. The rail changes when —
             * and only when — the person presses Confirm on a profile they picked; leaving
             * the selector any other way drops the intent and leaves the slot exactly as it
             * was. What must not come back is a destructive write issued in advance of the
             * decision it is preparing for, and this is not one.
             *
             * THE ORDER MATTERS: WRITE, THEN OPEN. The selector reads the key when Confirm
             * is pressed, so a dispatch that raced the write would be a slot that arrived
             * late. `library-open` is dispatched from the write's continuation on BOTH
             * endings — a storage failure loses the carry, never the trip, so the worst
             * case is the behaviour this branch had yesterday rather than a menu item that
             * does nothing. */
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

    /** The last frame's state and substate, so a repeat costs nothing. */
    #lastState = null;

    #lastSubstate = null;

    /**
     * FOLD ONE MACHINE FRAME INTO THE CHART MODE, and feed the buffer from the same frame.
     *
     * ONE CALL SITE, on the machine feed's own update, so the mode and the samples can
     * never be one frame apart. `chartModeFor` owns every rule about precedence and the
     * settle window; this is the wire.
     *
     * THE BACKSTOP TIMER IS WHY THE HOLD IS A DEADLINE. The mode only advances when a
     * frame arrives, and a machine that goes quiet mid-hold would leave the steam graph
     * up for ever. One timer, re-armed on every mode change and cleared with the screen.
     */
    #foldChartMode() {
        const snapshot = this.machine ? valueOf(this.machine) : null;
        const state = snapshot && !isNoReading(snapshot.state) ? snapshot.state : null;
        const substate = snapshot && snapshot.substate && !isNoReading(snapshot.substate)
            ? snapshot.substate : null;

        /* NOTHING TO FOLD WHEN NOTHING HAS MOVED.
         *
         * The machine feed publishes at 15 Hz and most frames say what the last one did.
         * A fold that ran on every one of them still cost a `take` and a mode object per
         * frame, and on the ESPRESSO path — which is every frame that is not a steam —
         * every one of those was work with no answer. MEASURED as a second shot
         * derivation on a screen mounted mid-stream, by the loop suite's own reload test:
         * the same shape the rail's stored preferences produced a wave earlier.
         *
         * THE HOLD IS THE EXCEPTION, and it is why this is not simply "same state, same
         * answer": a settle window ends on the CLOCK, so a mode with a deadline pending
         * has to be re-asked even when the machine is saying nothing new. */
        const still = state === this.#lastState && substate === this.#lastSubstate;
        if (still && this.chartMode.holdUntil === null && this.chartMode.mode === CHART_MODE.ESPRESSO) {
            return;
        }
        this.#lastState = state;
        this.#lastSubstate = substate;

        const at = Date.now();
        const next = chartModeFor(this.chartMode, { state, substate, now: at });
        this.chartMode = next;

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

    /**
     * B8's second half: send the choice. `PUT /api/v1/devices/connect {deviceId}` behind
     * `createDevicesLink`, which "checks `pendingAmbiguity` itself and routes to
     * `selectMachine`/`selectScale` when a selection session is open" — so the skin does
     * not need to know which it is, and cannot get it wrong.
     */
    #onConnectDevice = (event) => {
        const deviceId = event?.detail?.deviceId;
        const devices = this.boot?.devices;
        if (!deviceId || !devices || typeof devices.connect !== 'function') return;
        // Fire and forget at THIS layer: the outcome arrives as the next state frame on
        // the same socket, which is what the surface renders from. Awaiting it here would
        // add a second source of truth for a state the feed already publishes.
        Promise.resolve(devices.connect(deviceId)).catch(() => {});
    };

    /** The user acknowledged a refusal. The store owns the state; this only asks. */
    /**
     * A target the rail reported, written to the machine.
     *
     * THE OTHER HALF OF `#commit`. The screen shows the pressed value at once and reports
     * the intent; this is what answers. Nothing is awaited and nothing is thrown: the
     * store publishes the machine's own number when the write lands, reverts to the last
     * known document when it is refused, and records the failure as state — a rail press
     * is not an exception, and a rejection escaping here would be an error the page
     * reports and nobody can act on.
     */
    #onTargetChange = (event) => {
        const store = this.boot ? this.boot.workflow : null;
        if (!store || typeof store.setTarget !== 'function') return;
        const detail = event && event.detail ? event.detail : null;
        if (!detail || typeof detail.key !== 'string') return;
        Promise.resolve(store.setTarget(detail.key, detail.value)).catch(() => {});

        this.#recordArmedPreset(detail.key, detail.presetIndex);

        /* THREE OF THE RAIL'S KEYS BELONG TO THE PROFILE, NOT TO THE MACHINE.
         *
         * The workflow holds one dose, one drink weight and one grind, so writing them
         * there alone means loading any other profile discards the numbers this one was
         * dialled in with — and coming back to it brings back the defaults. The record's
         * own metadata is where they live between loads; `library.rememberContext` is the
         * metadata-only write, and `workflowApplyBody` reads them back at the next load.
         *
         * NOT AWAITED, and a failure is a warning in the store rather than a surface: the
         * value is already on the machine, which is what the press was about. */
        const remembered = REMEMBERED_TARGETS[detail.key];
        const library = this.boot ? this.boot.library : null;
        if (!remembered || !library || typeof library.rememberContext !== 'function') return;
        Promise.resolve(library.rememberContext({
            [remembered]: remembered === 'grinderSetting'
                ? Number(detail.value).toFixed(2) : detail.value,
        })).catch(() => {});
    };

    /**
     * THE WARMER'S WRITE HALF, and it is here for the reason the paragraph above
     * `#onTargetChange` records about `target-change`: a screen that dispatches an
     * intent nobody listens to is a control that looks live and is not. That was P-1's
     * whole shape, and adding a second dispatcher with no listener would be repeating
     * it while the fix was still on screen.
     *
     * `setEnabled(...)` IS THE ONLY WAY TO TURN IT OFF, and the store says why in its
     * own words: "`{temperature: 0}` would ENABLE the warmer at a 0 C setpoint, because
     * the handler calls setCupWarmerEnabled(true) whenever a temperature arrives
     * without an explicit enable". Nothing here sends a temperature, and nothing here
     * predicts the outcome — the store re-reads and republishes, so the button paints
     * what the machine actually did (B10).
     */
    /**
     * STEP TO AN OLDER OR NEWER STORED SHOT — Ben's arrows.
     *
     * `detail.delta` is +1 for older and -1 for newer, because the list is newest-first
     * and the control that sends it says "back" and "forward" in those words. Clamped
     * to the page: the arrows walk what the shell already read (SHOTS_PAGE rows) and
     * STOP at its end rather than fetching more, which is the limit the band's own
     * disabled state shows. The whole archive is the History screen's pager.
     *
     * THE RECORD IS FETCHED, ONCE, WHEN THE ARROWS LAND ON IT. The list rows carry an
     * id, a timestamp and a title; the 221 KB record and its gate-6 walk are the
     * store's `loadShot`, which memoises both ("ONE fetch and ONE walk per id"). So the
     * band's identity updates immediately from the row and the chart follows when the
     * derivation lands — the same two-step every other read on this screen makes, and
     * the reason `storedDerivation` may be null for a beat.
     */
    /**
     * A NEW SHOT PUTS THE ARROWS BACK ON THE NEWEST ROW.
     *
     * Browsing the history and then pulling a shot must not leave the band describing a
     * shot from last week while the machine runs one now. The screen already refuses to
     * hand the stored shot the plot while `#running`; this is the other half, so when the
     * shot ends the band is about THAT shot rather than about where the arrows were.
     */
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

        /* STEP FROM WHERE THE BAND IS, NOT FROM WHERE THE INDEX WAS LEFT.
         *
         * `#storedShot` clamps on READ and never writes back — deliberately, because the
         * page changes underneath the index — so after the window SHRINKS the two can
         * disagree: the band is drawing row 19 of a 20-row page while `shotIndex` still
         * holds the 24 it reached on the 25-row page the boot read. (Both windows exist
         * in one session: `app-boot.js askShots()` reads 25 and `history-viewer.js
         * start()` re-reads the same store at 20.) Adding the delta to the STALE number
         * then lands back on the row already showing, so the press moves nothing and the
         * arrow is simply dead once. Clamping first makes every press move exactly one
         * row, which is the whole of the control's promise. */
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

    /**
     * TARE THE SCALE — the WEIGHT tile's press.
     *
     * One line, because the store owns everything that is hard about it: the request,
     * ReaPrime's visible refusal, the firmware's silent one, and the watch on the weight
     * that is the only evidence a tare took. Not awaited, and it needs no catch — every
     * failure it can have is already state on the store.
     */
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

    /* ─────────────────────────────────────────────── running the machine (wave 5.8) */

    /**
     * THE HALF THAT WAS MISSING. `<live-screen>` now dispatches `machine-request` from
     * the strip's four keys, from `<ui-stop-button>` in the rail's stack and from the
     * keyboard; this is the row that turns it into `PUT /machine/state/<newState>`.
     *
     * NOTHING IS AWAITED AND NOTHING PREDICTS. The store publishes what it asked for and
     * what the route answered; the MACHINE'S state arrives on the snapshot feed like
     * every other reading, so the strip repaints from the feed and never from the press.
     * A 200 is not a state change — the store's own header says so.
     */
    #onMachineRequest = (event) => {
        const store = this.boot ? this.boot.machineState : null;
        const state = event && event.detail ? event.detail.state : null;
        if (!store || typeof store.request !== 'function' || typeof state !== 'string') return;
        Promise.resolve(store.request(state)).catch(() => {});
    };

    /**
     * SLATE'S SIX KEY BINDINGS, ON THE DOCUMENT, WHILE THIS SCREEN IS MOUNTED.
     *
     * ON THE DOCUMENT because a key press has no target inside a shadow root that did not
     * ask for focus, and Slate binds the same way (`app.js:1853`). It comes off in
     * `hostDisconnected`, so a route swap takes the bindings with the screen — Slate's
     * own listener is permanent and fires on its settings pages too.
     *
     * THREE GUARDS, ALL SLATE'S:
     *   1. a typing field wins (`INPUT`/`TEXTAREA`, plus `contenteditable`, which Slate
     *      does not check and this tree has in the notes editor),
     *   2. a modifier means the key belongs to the browser or the OS, not to us,
     *   3. only a machine WITHOUT a group-head controller takes keys — the same gate the
     *      strip is drawn behind, so the two cannot disagree about which machine this is.
     */
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
        /* THE STORED MAP WHEN THERE IS ONE, THE DEFAULTS UNTIL THE READ LANDS. The read
         * is a few hundred milliseconds after mount; a keystroke before it arrives is
         * answered by the shipped bindings, which is the same answer this skin gave
         * before the map existed. */
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

        /* THE THREE FEEDS THIS CONTROLLER READS, by the field each lands on.
         *
         * SCALE JOINED THEM WITH THE GAUGE CLUSTER'S WIRING: gate 4 has carried the
         * feed since wave 5.1 and nothing on the Live screen ever read it, which is
         * half of why the WEIGHT tile had never shown a number.
         *
         * A NAME THE BOOT DOES NOT SERVE IS SKIPPED, not thrown on — the same shape
         * `WATCHED_STORES` below already uses, and for a reason that cost a capture to
         * learn: `hostConnected` runs INSIDE `connectedCallback`, so a throw here takes
         * the rest of that method with it, including the two seam classes the screen's
         * whole grid hangs off. The screen then renders every band at its content size
         * down one column, which looks like a layout bug and is a missing subscription.
         * A boot that serves two of the three feeds gets a screen with two of the three
         * answered, which is what every other absence on this screen does. */
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

        /* THE STATE STORE IS SUBSCRIBED BY HAND AND NOT THROUGH `WATCHED_STORES`.
         *
         * That loop assigns `this[name] = state`, and `machineState` is already a GETTER
         * on this controller — the machine's own state name, off the snapshot feed. One
         * name, two meanings: the loop would shadow the getter with a request record and
         * the rail would dim on what the user last ASKED for rather than on what the
         * machine is doing. So the request record is never held here at all; `refusal`
         * reads it from the store at the moment it renders, and this subscription exists
         * only to say that something changed. */
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

        /* THE PLUGIN LISTING, ASKED FOR HERE BECAUSE THE SHELL DELIBERATELY DOES NOT.
         *
         * `app-boot.js` builds this store and does not read it: the listing reaches exactly
         * one pixel — whether the DYE2 button is drawn — so a boot-time request on every
         * machine would be a cost with no reader on most of them. The screen that wants the
         * answer asks, which is the same bargain `askLibrary` and `askShots` make in the
         * other direction.
         *
         * `load()` IS IDEMPOTENT AND THAT IS WHY THIS IS SAFE TO CALL ON EVERY MOUNT. The
         * store holds its in-flight promise and returns it to a second caller, so a person
         * moving between Live and Settings does not re-fetch, and the Settings screen's own
         * call on entering the Extensions leaves costs nothing after this one.
         *
         * NOT AWAITED, on the same terms as the preferences above: until it lands the
         * handoff is not drawn, which is what an unanswered listing should look like. */
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
        /* A DIFFERENT MACHINE IS A DIFFERENT SESSION. The samples go with the boot they
         * were taken from, and the mode goes back to espresso so the next machine's first
         * frame is folded against a clean state rather than against a hold that belonged
         * to the last one. */
        this.chartMode = initialChartMode();
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

/**
 * The answer before a boot arrives: unknown, and therefore nothing rendered.
 *
 * Shaped like `ghcStripGate`'s output rather than a bare `false`, so a caller reading
 * `.provisional` or `.tag` on it gets the same fields whether or not a store is attached —
 * and so "no store yet" is legible as `capability: null` instead of masquerading as an
 * answered `absent`.
 */
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
