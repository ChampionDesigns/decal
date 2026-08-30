/**
 * live-targets.js — WHICH control the Live rail's tracks carry, and WHAT the foot
 * band's phase table says. Pure policy: no DOM, no Lit, no store, no fetch, and no
 * number of its own.
 *
 * WHY THIS IS A MODULE AND NOT PART OF `live-screen.js`. Three of wave 5.1's rows
 * meet in the rail — `live-mode-recomposition`, `live-steam-envelope-clamp` and
 * `live-bug-mode-toggles` (L25) — and every one of them is a question about WHICH
 * row is where, not about how a row paints. Answering them in a module that node can
 * import without a browser makes them testable in milliseconds instead of in a
 * screenshot, and keeps the screen file to composition. `src/screens/` is also
 * asserted to hold exactly the five skeleton files (`test/live-screen.test.mjs` §1),
 * so a sixth screen file is not available even if it were the better shape.
 *
 * ===========================================================================
 * 1. THE MODE IS THE MACHINE'S STATE FIRST, AND A CHOICE ONLY WHEN IT IS NOT
 * ===========================================================================
 *
 * Spec Appendix item 3, carried over deliberately: "**State changes weight, never
 * position.** `[data-live-state]` recomposes *within* the existing tracks: nothing
 * appears, disappears or slides mid-pull (`slate-live.css:2085-2140`). This is why
 * the screen is readable during a shot. Keep the rule."
 *
 * The subject of that sentence is `[data-live-state]` — the MACHINE's state, not a
 * picker. So the mode this module resolves is:
 *
 *   machine state names one of the four working states  ->  that is the mode,
 *                                                           and the picker is inert;
 *   anything else (idle, heating, sleeping, cleaning…)  ->  the mode the user chose.
 *
 * The machine wins because the machine is the truth (the store's, never the screen's)
 * and because a screen that showed espresso rows while the group was steaming is the
 * failure this rule exists to prevent. The picker exists because at idle every target
 * must still be reachable: Slate solved that by putting nine rows in a 1082px rail,
 * which the rewrite's 1000x600 design floor cannot hold. MEASURED at that floor:
 * `<live-rail>` is 495.75px tall with 460px inside its 18px inset, a track is
 * --ui-control-h (64px) and the gap is --ui-space-3 (12px), so n tracks cost
 * 64n + 12(n-1) — five is 368, six is 444 (15.75px clear), SEVEN is 520 and does not
 * fit. Recomposition is how the same four modes fit in four tracks; the ceiling the
 * floor actually pays for is six, and `test/live-targets.test.mjs` asserts it over
 * presets, which is the only input that reaches it.
 *
 * (This paragraph read "404px against ~445px of rail — a sixth row does not fit" until
 * wave 5.1 measured it: 404 counted the inset into the content, ~445 was neither the
 * rail nor its interior, and a sixth track fits with room to spare. Finding
 * c-layout-controls-5.)
 *
 * ONE-LINE REVERSAL, recorded for the morning: delete `MACHINE_MODES.has(...)` in
 * `modeFor()` and the picker always wins. Nothing else reads the machine state.
 *
 * ===========================================================================
 * 2. THE TRACKS, AND WHY NOTHING SLIDES
 * ===========================================================================
 *
 * The rail is an ordered list of tracks, all of one height (--ui-control-h is the
 * floor every control in the library shares). Track 1 is the mode bank in every mode.
 * Tracks 2..n are the mode's own controls, in a fixed order, filled top-down. A mode
 * with fewer controls leaves the SPARE AT THE BOTTOM, so no row above it ever moves:
 * that is "within existing tracks" expressed in a fluid layout, and it is checked by
 * measuring the tops of the rows across a mode change rather than asserted in prose.
 *
 * ===========================================================================
 * 3. L25 — THE TWO MODE TOGGLES COME BACK, AS REAL CONTROLS
 * ===========================================================================
 *
 * L25: "The steam and hot-water mode toggles are `display: none !important` with no
 * replacement affordance, so Time/Milk and Temp/Vol have no visible control on Live."
 * (`slate-live.css:553-554`; `index.html:191, 238`.) They come back as `<ui-bank>`
 * rows — THE selection component, so they cannot grow a private selected look (L8) —
 * each on its own track at the hit floor.
 *
 *   STEAM, "Time / Milk": the two things a steam pour can stop on. Time is
 *   `steamDuration`; Milk is `milkStopTemp`, the milk probe's target. The SAME TRACK
 *   carries whichever the toggle names, which is what Slate was doing inside one row:
 *   CITE live-ready .slate-stepper [i=50] text "45s seconds · time" rect [134,602,268,64]
 *   — the value and the (hidden) toggle's own words in one 268x64 box.
 *
 *   HOT WATER, "Volume / Weight": both arm the SAME field. `machine-limits.js` states
 *   why, from the bench: `hotWaterVolume` "is also the ceiling in WEIGHT mode.
 *   Stopping at weight is real — ReaPrime's HotWaterSequencer arms on this same field
 *   and stops against the scale". Slate's own rendered words are the volume half:
 *   CITE live-ready .slate-stepper [i=76] text "240mL mL · volume" rect [134,980,268,64]
 *   The audit's shorthand for this toggle is "Temp/Vol"; the machine's two stop
 *   conditions are volume and weight, and the rail already carries the water
 *   temperature on its own track (CITE live-ready .slate-stepper [i=83] text
 *   "− 98°C water target +"), so a Temp/Vol toggle would name a target the row above
 *   it already sets. Built to the machine's two conditions; recorded as a deferral,
 *   and it is one `items` array to reverse.
 *
 * BOTH SECOND OPTIONS ARE CAPABILITY-GATED, FAIL-CLOSED. Milk needs the probe
 * (R3 `r3MilkProbeCapability`); Weight needs the scale (`stopAtWeight`, one of the
 * seven SERVED entries). This module never asks: it takes the answers as `offers`,
 * a plain object of `true | false | null`, and only `true` enables the option —
 * `null` ("not known") disables it exactly like `false` does, which is A7's rule and
 * the capability store's own `offers()` contract. No name is read anywhere.
 *
 * ===========================================================================
 * 4. EVERY RANGE COMES FROM THE ONE TABLE, AND NO NUMBER LIVES HERE
 * ===========================================================================
 *
 * B2/B3. The rows below name LIMIT KEYS — `steamTemp`, `dose`, `flushFlow` — and
 * nothing else. The table itself arrives from `r2MachineLimits` (the only door to
 * `machine-limits.js`) as a value the screen is handed, and the min/max/step/unit of
 * every stepper is read off it at render time. `hasLimit()` decides whether a control
 * can be offered at all: with the machine class unresolved the table carries NO steam
 * row, so the steam temperature row renders unavailable rather than inventing a
 * ceiling. That is the whole of the B3 defect's cure — the old skin's 130..170 table
 * clamped users into the dead band where the heater is off — and the numbers 135 /
 * 165 / 160 appear in this file only in this comment, never in its code.
 */

import { MACHINE_STATE } from '../data/machine-state.js';
import { hasLimit, step as stepLimit, clamp as clampLimit, bandHint } from './machine-limits.js';
/* BEN'S OWN NUMBERS, READ FROM THE ONE TABLE THAT HOLDS THEM. `armValueFor` needs a
 * duration to put back when a person arms a timed stop on a machine holding zero, and
 * "Time at 60 s" is his answer — written down once, in `settings-defaults.js`, with its
 * provenance. Importing it is how this file states the rule without restating the number;
 * see `armValueFor` for why the rule is here and the number is not. */
import { machineFallbackFor } from './settings-defaults.js';
import {
    TEMP_UNIT, displayRange, toDisplayTemp, fromDisplayTemp, decimalsForStep,
} from './temperature.js';

/* ═══════════════════════════════════════════════════════════════ the four modes */

/**
 * The four working modes, named by ReaPrime's own enum rather than by strings this
 * file made up. `machine-state.generated.js` is generated from `machine.dart` and
 * checked for staleness by its own suite, so these ids cannot drift from the frames
 * the machine sends — which is the defect the old skin's hand copy shipped
 * (`READY: 'ready'`, a state in neither direction).
 */
export const LIVE_MODES = Object.freeze([
    Object.freeze({ id: MACHINE_STATE.ESPRESSO, label: 'Espresso' }),
    Object.freeze({ id: MACHINE_STATE.STEAM, label: 'Steam' }),
    Object.freeze({ id: MACHINE_STATE.HOT_WATER, label: 'Hot water' }),
    Object.freeze({ id: MACHINE_STATE.FLUSH, label: 'Flush' }),
]);

export const DEFAULT_MODE = MACHINE_STATE.ESPRESSO;

const MACHINE_MODES = new Set(LIVE_MODES.map((mode) => mode.id));

/**
 * Steam's stop conditions — THREE STATES THE RAIL CAN SHOW, TWO IT CAN ARM.
 *
 * `TIME` and `MILK` are L25's "Time / Milk", and they are the pair a press moves between.
 * `OFF` joined them on 27 August 2026 and it is deliberately NOT one of the toggle's
 * options: it is a state the MACHINE can be in and the rail must be able to say so.
 *
 * WHY THE ASYMMETRY IS THE POINT AND NOT AN OVERSIGHT. The DE1 expresses "nothing stops
 * the steam" as BOTH `steamSettings.duration` and `steamSettings.stopAtTemperature`
 * holding zero, which is exactly what the Settings bank's `off` option writes
 * (`settings-leaves.js machine-steam-stop`, `stages.off`). Before this the rail read that
 * state as TIME — normalising "off" onto the mode it could step — and painted "Timed stop"
 * over a machine that stops on nothing. That is a sentence the code does not keep, so the
 * state is named here and drawn.
 *
 * WRITING IT BACK IS A DIFFERENT QUESTION AND THE ANSWER IS NO. Coming back OUT of Off
 * means putting a duration back, and the number to come back to is one the machine no
 * longer holds — the Settings model spends a whole `RESTORE` symbol and a three-step
 * ladder on it (`settings-leaf-model.js restoreValueFor`), against a staged edit a person
 * can Cancel. The rail commits every press immediately and has no Cancel, so a caption tap
 * that silently zeroed both fields would be a destructive, unconfirmed setting hidden in a
 * two-word microcap. `stopModeRow` therefore never puts `OFF` in `items` and never answers
 * it as `next`: the rail SHOWS three and ARMS two, and Off is left to the page that offers
 * it beside its own explanation.
 *
 * The way OUT of Off from the rail is the row directly underneath the caption: stepping
 * the steam duration up from zero gives the machine a positive duration, and the same
 * derivation that read Off then reads Time. One fact, one source, and the control that
 * changes it is the one that shows it.
 */
export const STEAM_STOP = Object.freeze({ OFF: 'off', TIME: 'time', MILK: 'milk' });
/** Hot water's two stop conditions — both arm `hotWaterVolume`. */
export const WATER_STOP = Object.freeze({ VOLUME: 'volume', WEIGHT: 'weight' });

/**
 * WHAT THE MACHINE'S OWN FIELDS SAY THE STEAM STOPS ON — the rail's half of Ben's O3
 * ("the current option should always be shown as selected, READ FROM THE MACHINE").
 *
 * THIS IS THE SETTINGS BANK'S DERIVATION, DELIBERATELY THE SAME ONE. `machine-steam-stop`
 * declares `derivedFrom: [{milkStopTemp, 'milk-temp'}, {steamDuration, 'time'}]` with
 * `whenNone: 'off'`, and `settings-leaf-model.js derivedValueFor` reads it: an ORDERED
 * list where the first field holding a positive number names the mode, all-zero is `off`,
 * and nothing known at all is `undefined` so the control draws no claim (A7). ReaPrime
 * itself reads the machine the same way — `steam_sequencer.dart:134-140` returns
 * immediately when `stopAtTemperature <= 0`.
 *
 * WHY IT IS SPELLED AGAIN HERE RATHER THAN IMPORTED. The two surfaces must read ONE
 * SOURCE, and they now do: both answer from `steamSettings.duration` and
 * `steamSettings.stopAtTemperature` on the workflow document. What is not shared is the
 * MODEL around it — the settings side derives inside a staged, cancellable leaf model that
 * takes a machine PORT, a registry row and a `staged` Map, and none of those three exist on
 * the Live rail, which has the two numbers already in hand as `targets`. Importing the leaf
 * model to reach a private function would drag the whole staging machine onto a screen that
 * commits every press; restating the RULE against the same two fields is eight lines, and
 * `test/live-targets.test.mjs` pins the two answers against each other so they cannot part.
 *
 * THE VOCABULARY IS THE RAIL'S, and that is the one difference on purpose: the bank spells
 * the milk mode `milk-temp` and the rail spells it `milk` (`STEAM_STOP.MILK`), because the
 * rail's word is the switch position and the bank's is the option id. They never meet on a
 * wire any more — the shared thing is the two NUMBERS, not a string — so the spellings
 * cannot drift into each other the way they did while a KV row carried one of them.
 *
 * @param {object|null} targets  the rail's values, off the workflow (`workflow-targets.js`)
 * @returns {string|null} a STEAM_STOP member, or null when the machine has answered neither
 */
export function steamStopFrom(targets) {
    const held = targets && typeof targets === 'object' ? targets : null;
    let known = false;
    for (const [field, mode] of [['milkStopTemp', STEAM_STOP.MILK], ['steamDuration', STEAM_STOP.TIME]]) {
        const value = held ? held[field] : undefined;
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        known = true;
        if (value > 0) return mode;
    }
    return known ? STEAM_STOP.OFF : null;
}

/**
 * WHAT ENDS A HOT-WATER POUR, off ReaPrime's own boolean.
 *
 * `stopHotWaterAtWeight` is a field of `GET/POST /api/v1/settings` and it is the field
 * `hot_water_sequencer.dart:106` actually reads. `machine-water-stop` maps the two words
 * onto it in one place (`fieldValues: {volume: false, weight: true}`) and this is the same
 * map read the same direction — the settings model calls it `itemValueOf`.
 *
 * NULL IS NOT FALSE. An app-settings document that has not arrived is not a machine that
 * stops on volume; it is a machine we have not asked yet, and the caption says so with the
 * dash rather than with a claim (A7).
 *
 * @param {boolean|undefined|null} stopAtWeight
 * @returns {string|null} a WATER_STOP member, or null when nothing has been served
 */
export function waterStopFrom(stopAtWeight) {
    if (stopAtWeight === true) return WATER_STOP.WEIGHT;
    if (stopAtWeight === false) return WATER_STOP.VOLUME;
    return null;
}

/**
 * THE NUMBER THAT ARMS A STOP — what to write into a field whose zero IS the off state.
 *
 * A stop mode on the DE1 is not a flag, it is a POSITIVE NUMBER in the field that owns
 * that mode: arming the milk probe means giving `stopAtTemperature` a temperature, and
 * arming the timer means giving `duration` a duration. Zero is not a value to come back
 * to — it is the absence of the stop — so a press that arms has to decide what number to
 * put there, and it cannot be one this file made up.
 *
 * THE LADDER IS THE SETTINGS MODEL'S, STEP FOR STEP (`settings-leaf-model.js
 * restoreValueFor`, which its own `RESTORE` symbol documents):
 *
 *   1. WHAT THE MACHINE ALREADY HOLDS, if it is positive. A person who set a 90 s steam,
 *      switched to the milk probe and switched back gets 90 s, not a decided default.
 *   2. BEN'S DECIDED FALLBACK for that field (`MACHINE_FALLBACKS`) — "Time at 60 s" is his
 *      sentence and `settings-defaults.js` is where it is written down, once.
 *   3. THE FLOOR OF THE BAND THE CONTROL OFFERS, which is the case the milk probe needs:
 *      `MACHINE_FALLBACKS` deliberately has no `milkStopTemp` (Ben was never asked for a
 *      milk temperature and A7 forbids inventing one), but arming the mode still has to
 *      write a number, and the lowest the control will accept is in band by construction
 *      and is the smallest the arming can be. The stepper directly below the caption is
 *      where the person changes it.
 *
 * ZERO MEANS REFUSE, NOT WRITE ZERO. If none of the three answers, the caller must not
 * write: zero is the DISARMED spelling, so writing it would turn a press that meant "stop
 * on the milk probe" into "stop on nothing at all" — the loudest possible version of the
 * defect this whole change is about. The caller drops the press and the caption goes on
 * reporting what the machine actually holds.
 *
 * WHY THE RULE IS RESTATED AND THE NUMBERS ARE NOT. `restoreValueFor` is a closure inside
 * the settings leaf model, over that model's `staged` Map, its registry row and its
 * `rowsForLeaf` lookup — none of which exist on a rail that has the value in hand and
 * commits on the press. What must not be duplicated is the DATA, and none is: the fallback
 * comes from `settings-defaults.js` and the floor from the R2 limits table the rail was
 * already handed.
 *
 * @param {string} field    the machine field being armed
 * @param {number|undefined} held  what the machine holds for it now
 * @param {object|null} limits     the R2 table, in the MACHINE's units
 * @returns {number} a positive number to write, or 0 meaning "there is nothing to write"
 */
export function armValueFor(field, held, limits) {
    const now = Number(held);
    if (Number.isFinite(now) && now > 0) return now;
    const fallback = Number(machineFallbackFor(field));
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    const floor = hasLimit(limits, field) ? Number(limits[field].min) : Number.NaN;
    return Number.isFinite(floor) && floor > 0 ? floor : 0;
}

/** The row kinds a rail track can hold. The screen switches on these, never on a label. */
export const RAIL_ROW = Object.freeze({
    TARGET: 'target',
    STOP_MODE: 'stopMode',
    PRESETS: 'presets',
});

/**
 * Is the machine doing something a STOP would abort?
 *
 * #47's own file says it "does not decide when a shot is running (that is #48's rule
 * / MACHINE_STATE)", so the decision is here, over the enum, and the component is
 * told. All four working states are abortable — a steam pour and a flush need the
 * abort target as much as an espresso does.
 */
export function isRunning(machineState) {
    return MACHINE_MODES.has(machineState);
}

/**
 * The mode the screen is in: the machine's, when the machine names one; otherwise the
 * chosen one. See §1 above for why that order, and for the one-line reversal.
 */
export function modeFor(machineState, chosen = DEFAULT_MODE) {
    if (MACHINE_MODES.has(machineState)) return machineState;
    return MACHINE_MODES.has(chosen) ? chosen : DEFAULT_MODE;
}

/** True while the mode is the machine's to decide — the picker is inert then. */
export function modeIsMachines(machineState) {
    return MACHINE_MODES.has(machineState);
}

/* ════════════════════════════════════════ running the machine */

/**
 * THE FOUR THINGS A PERSON ASKS THE MACHINE TO DO, and the keys that ask for them.
 *
 * WHY THIS TABLE EXISTS AT ALL. Until now Decal could not start or stop the machine.
 * `<live-screen>` rendered the GHC strip as a placeholder div reading "Group head", and
 * `<ui-stop-button>` dispatched `stop-request` into a tree with no listener — so the one
 * control on the screen whose job is stopping did not stop anything. Slate has both:
 * five buttons in `#ghc-controls` (`app.js` GHC_STATE_MAP) and a rail-spanning abort
 * (`#ghc-stop-btn-rail`), plus six keyboard bindings (`DEFAULT_KEY_BINDINGS`).
 *
 * SLATE'S OWN MAP, read off `app.js:1801-1812` and `:1827-1834`:
 *   ghc-coffee-btn  ESPRESSO   e
 *   ghc-water-btn   HOT_WATER  w
 *   ghc-steam-btn   STEAM      s
 *   ghc-flush-btn   FLUSH      f
 *   ghc-stop-btn    IDLE       (space)
 *                   SLEEPING   p     — a key with no button
 *
 * SLEEP HAS NO BUTTON HERE EITHER, and for a different reason than Slate's: Ben removed
 * the Sleep button from this band on 23 Aug 2026 ("We dont need the sleep button OR the
 * full sreen button"), and the note where it used to live records that. The KEY is not
 * the button — a binding on a keyboard nobody has attached costs the band nothing — so
 * it stays in the bindings and out of `MACHINE_KEYS`.
 *
 * THE STATE NAMES ARE THE GENERATED ENUM'S. `MachineState.values.byName` parses what
 * `PUT /machine/state/<newState>` is given, and a name it does not know is a 500, so a
 * literal must never appear here (`machine-state-store.js` says the same at its caller).
 */
export const MACHINE_KEYS = Object.freeze([
    Object.freeze({ id: 'espresso', state: MACHINE_STATE.ESPRESSO, label: 'Espresso' }),
    Object.freeze({ id: 'hot-water', state: MACHINE_STATE.HOT_WATER, label: 'Hot Water' }),
    Object.freeze({ id: 'steam', state: MACHINE_STATE.STEAM, label: 'Steam' }),
    Object.freeze({ id: 'flush', state: MACHINE_STATE.FLUSH, label: 'Flush' }),
]);

/** The abort, which is a state request like any other and is drawn as its own control. */
export const STOP_STATE = MACHINE_STATE.IDLE;

/**
 * Slate's six bindings, as key -> state.
 *
 * SPACE IS ' ', which is what `KeyboardEvent.key` reports for the space bar; Slate's own
 * table spells it the same way. A lookup lower-cases the key first, so a caps-locked
 * keyboard still stops the machine.
 */
export const DEFAULT_KEY_BINDINGS = Object.freeze({
    e: MACHINE_STATE.ESPRESSO,
    w: MACHINE_STATE.HOT_WATER,
    s: MACHINE_STATE.STEAM,
    f: MACHINE_STATE.FLUSH,
    ' ': MACHINE_STATE.IDLE,
    p: MACHINE_STATE.SLEEPING,
});

/**
 * The state a key asks for, or null.
 *
 * NULL FOR EVERY KEY THAT IS NOT BOUND, so a caller has one comparison and never a
 * `in`-check against an object it did not build.
 */
export function stateForKey(key, bindings = DEFAULT_KEY_BINDINGS) {
    if (typeof key !== 'string' || key === '') return null;
    const found = bindings[key === ' ' ? key : key.toLowerCase()];
    return typeof found === 'string' ? found : null;
}

/**
 * WHICH MACHINE CONTROLS MAY BE PRESSED, given what the machine is doing.
 *
 * SLATE'S RULE, and it is `disabled` rather than dimmed on purpose: "The 20% opacity was
 * the whole treatment, so a dimmed Coffee button still took the tap and asked a running
 * machine for espresso" (`ui.js updateGhcStopButton`). Running: the four actions refuse
 * and Stop is live. Not running: the four are live and Stop is absent — `<ui-stop-button>`
 * renders nothing when it is not running, so there is no disabled Stop to reach.
 *
 * @param {string} machineState  ReaPrime's own state name
 * @returns {{actions: boolean, stop: boolean}} whether each half accepts a press
 */
export function machineKeyGate(machineState) {
    const running = isRunning(machineState);
    return Object.freeze({ actions: !running, stop: running });
}


/* ═══════════════════════════════════════════════════════ the stop-mode toggles */

/** Every state the caption may REPORT. Anything else is "not answered yet", never a mode. */
const STEAM_STATES = new Set([STEAM_STOP.OFF, STEAM_STOP.TIME, STEAM_STOP.MILK]);
const WATER_STATES = new Set([WATER_STOP.VOLUME, WATER_STOP.WEIGHT]);

/**
 * WHAT A PRESS ARMS, FROM WHERE THE MACHINE IS — the whole of the toggle's behaviour,
 * written as a table so there is nowhere for a fourth answer to hide.
 *
 * TWO-POSITION FROM EITHER WORKING MODE, which is Slate's own control (`toggleSteamMode`,
 * `toggleHotWaterMode`) and what a caption with room for two words can honestly offer.
 *
 * FROM OFF THE PRESS ARMS TIME, and never the other way round — see `STEAM_STOP`'s own
 * paragraph for why `OFF` is a state and not an option. Time is the right destination
 * rather than Milk because the row directly under the caption is ALREADY the steam
 * duration, so the press's effect is visible in the control beneath it; and because the
 * button names what it will do ("Stop on Time"), so nothing about it is silent.
 *
 * AN UNANSWERED MACHINE ARMS NOTHING. A press that meant "the other one" cannot mean
 * anything when we do not know which one we are on, so the control is drawn disabled
 * rather than guessing — the same rule the steppers beside it already follow.
 */
const STEAM_NEXT = Object.freeze({
    [STEAM_STOP.OFF]: STEAM_STOP.TIME,
    [STEAM_STOP.TIME]: STEAM_STOP.MILK,
    [STEAM_STOP.MILK]: STEAM_STOP.TIME,
});
const WATER_NEXT = Object.freeze({
    [WATER_STOP.VOLUME]: WATER_STOP.WEIGHT,
    [WATER_STOP.WEIGHT]: WATER_STOP.VOLUME,
});

/**
 * The stop-mode toggle for a mode, with each option's gate resolved, or null for the
 * two modes that have no such choice.
 *
 * `offers` is `{ milkProbe, stopAtWeight }` with `true | false | null` values —
 * PRESENT, ABSENT and "no answer held yet". Only `true` enables. The option is never
 * removed: L25 is a bug about a control being invisible, so an unavailable option
 * stays visible and disabled, and the reason travels with it as `unavailable`.
 *
 * THREE FIELDS AND THEY ARE NOT THE SAME FIELD (27 August 2026):
 *
 *   `value`  what the MACHINE is doing, derived from its own numbers by `steamStopFrom`
 *            and `waterStopFrom`. It may be `STEAM_STOP.OFF`, which is not one of
 *            `items`, and it may be NULL, which is "nothing served yet".
 *   `items`  what the rail can ARM. Two, always, and `OFF` is never among them.
 *   `next`   which of `items` a press asks for, or null when nothing can be asked.
 *
 * `value` USED TO BE COERCED ONTO `items` and that coercion was the defect this split
 * closes: it read `steamStop === MILK ? MILK : TIME`, so a machine stopping on nothing and
 * a machine nobody had asked yet both came out as "Timed stop" — a caption stating a fact
 * about a machine that was not true and, in the second case, not even known. A caller
 * reading `value` now gets the machine's answer or nothing, and a caller writing back
 * reads `next`, which cannot name a state the rail has no honest way to restore.
 */
export function stopModeRow(mode, { steamStop, waterStop, offers = {} } = {}) {
    if (mode === MACHINE_STATE.STEAM) {
        const value = STEAM_STATES.has(steamStop) ? steamStop : null;
        return Object.freeze({
            kind: RAIL_ROW.STOP_MODE,
            id: 'steam-stop',
            label: 'Steam stops on',
            value,
            next: STEAM_NEXT[value] ?? null,
            items: Object.freeze([
                Object.freeze({ value: STEAM_STOP.TIME, label: 'Time' }),
                Object.freeze({
                    value: STEAM_STOP.MILK,
                    label: 'Milk',
                    disabled: offers.milkProbe !== true,
                    unavailable: offers.milkProbe !== true ? 'milkProbe' : null,
                }),
            ]),
        });
    }
    if (mode === MACHINE_STATE.HOT_WATER) {
        const value = WATER_STATES.has(waterStop) ? waterStop : null;
        return Object.freeze({
            kind: RAIL_ROW.STOP_MODE,
            id: 'water-stop',
            label: 'Hot water stops on',
            value,
            next: WATER_NEXT[value] ?? null,
            items: Object.freeze([
                Object.freeze({ value: WATER_STOP.VOLUME, label: 'Volume' }),
                Object.freeze({
                    value: WATER_STOP.WEIGHT,
                    label: 'Weight',
                    disabled: offers.stopAtWeight !== true,
                    unavailable: offers.stopAtWeight !== true ? 'stopAtWeight' : null,
                }),
            ]),
        });
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════ the rail's tracks */

const target = (id, limitKey, label, extra = {}) =>
    Object.freeze({ kind: RAIL_ROW.TARGET, id, limitKey, label, ...extra });

/**
 * The per-mode control order. Fixed, top-down, and deliberately short: the design floor
 * pays for six tracks including the mode bank and any preset row (the arithmetic is in
 * the header), so no mode may need seven. Deepest today is steam — five tracks, six once
 * steam-flow presets are handed in.
 *
 * The ORDER is the same shape in every mode — what the pour is made of, then what
 * stops it — so a hand moving down the rail is moving through the same question in
 * every mode rather than learning four layouts.
 */
/**
 * THE TARGET NUMBER'S INK — SLATE'S RULE, THROUGH THE CANONICAL NAMES (parity surface 1).
 *
 * Slate paints a rail target's NUMBER in the colour of the channel that target commands,
 * and leaves the ones that command no channel (a dose, a drink weight, a volume, a
 * duration) in the plain ink. Four rules, all in slate-live.css:
 *     :657  #main-page #temp-value [data-rail-number]
 *              { color: var(--slate-data-target-group-temperature) !important }
 *     :652  #main-page #steam-duration-value…, #hot-water-temp-value,
 *           .slate-temperature-value { color: var(--slate-live-heat) !important }
 *     :653  #main-page #steam-flow-value { color: var(--slate-live-flow) !important }
 *   ORACLE live-ready [i=45] "84" (brew temperature) color = rgb(221, 98, 84) = #dd6254,
 *          winning rule the first of those — a --slate-data-* name, i.e. the CANONICAL
 *          chart-palette map, the same one the readouts and the traces read.
 *   ORACLE live-ready [i=60] "2.1" (steam flow) = rgb(70, 142, 246) and [i=53] "45"
 *          (steam duration) = rgb(233, 145, 103) — the legacy --slate-live-* family.
 *
 * ONE RULE, ONE FAMILY. Slate names four of these from --slate-live-*, which is the same
 * legacy family whose --slate-live-pressure / -flow the audit measured as dead and
 * prescribes deleting in favour of --slate-data-* (findings-digest; parity surface 0's
 * finding F-9 is the readout half of exactly this). So the rule is carried and the names
 * are the canonical ones: a TARGET temperature takes --ui-channel-target-group-temperature
 * and a TARGET flow takes --ui-channel-target-flow, which on the one row the corpus
 * photographs at the reference geometry is Slate's own rendered value, exactly.
 * A target is a COMMAND, which is why these are the target channels and not the
 * measurement ones (chart-channels.css: "Targets stay separate channels because their
 * dotted/dashed form represents a COMMAND rather than a measurement").
 *
 * WHAT THIS TABLE CARRIES IS THE CHANNEL'S NAME, NOT A COLOUR. The row model says which
 * quantity a target commands; live-screen.js's own sheet turns that into an ink through
 * the two --ui-channel-* names above. Deliberately not an inline style on the track:
 * bug L11 is "inline wins", and the Live screen's dimming suite bans a style attribute
 * on any rail track by name — a rule that would still be true if this ink were harmless,
 * because the ban is on the MECHANISM.
 */
const TEMPERATURE = 'temperature';
const FLOW = 'flow';

/**
 * ===========================================================================
 * THE RAIL STANDS. EVERY ROW, EVERY TIME — BEN'S RULING, 22 AUG 2026 (ECM-772)
 * ===========================================================================
 *
 * Ben, after the Live side-by-side: "THE RAIL = SLATE'S RAIL. All rows standing,
 * dimmed per mode exactly as the oracle shows, top-down: GRIND, DOSE, DRINK
 * (+preset row 30/36/40/50), BREW, STEAM (its stop-mode + 45s), FLOW (+presets),
 * FLUSH, HOT WATER (volume stop), TEMPERATURE — with Slate's own SHORT labels."
 *
 * WHAT THAT REPLACES, and why the replaced thing was right until it was not. This
 * table used to be four per-mode lists and `railRows` returned ONE of them, because
 * "at idle every target must still be reachable: Slate solved that by putting nine
 * rows in a 1082px rail, which the rewrite's 1000x600 design floor cannot hold".
 * Recomposition was the answer to a floor constraint, and it cost the mode PICKER —
 * a control Slate does not have — plus long invented labels ("Brew temperature")
 * that wrapped mid-word in an 88px column (DQ-735). Ben has ruled the constraint the
 * other way: the rail is Slate's, the picker's reason to exist is gone with it, and
 * the floor is paid for by `<live-rail>` scrolling when the rows outrun it (its own
 * file carries that arithmetic and the §4.1 exception it forces).
 *
 * THE ORDER AND THE LABELS ARE READ OFF THE ORACLE, NOT INVENTED:
 *   [i=18] #grind-label       "Grind"        [i=19] .slate-stepper y=143
 *   [i=23] #dose-label        "Dose"         [i=24] y=234
 *   [i=30] #drink-label       "Drink"        [i=31] y=325  + presets [i=37..40] y=395
 *   [i=41] #brew-label        "Brew"         [i=42] y=483
 *   [i=48] #steam-label       "Steam"        [i=49] #steam-capability "Timed stop"
 *                                            [i=50] y=602 value "45" s
 *   [i=56] .slate-continuation-label "Flow"  [i=57] y=694 value "2.1" mL/s
 *                                            + presets [i=63..66] y=764
 *   [i=67] #flush-label       "Flush"        [i=68] y=853 value "5" s
 *   [i=74] #hotwater-label    "Hot Water"    [i=75] #hot-water-capability "Volume stop"
 *                                            [i=76] y=980 value "240" mL
 *   [i=82] .slate-continuation-label "Temperature" [i=83] y=1080 value "98" °C
 *
 * THE TWO STOP-MODE TOGGLES STAY REAL CONTROLS (L25), and Ben's own wording keeps
 * them: "STEAM (its stop-mode + 45s)", "HOT WATER (volume stop)". Slate draws the
 * stop condition as a 12px caption under the label and hides the toggle that would
 * change it (`slate-live.css:553-554`, `display: none !important`, which is L25);
 * Decal draws it as the `<ui-bank>` above the row it governs. That is one extra
 * track per toggle against Slate and it is the L25 fix, not drift.
 *
 * THREE TARGETS SLATE'S LIVE RAIL DOES NOT CARRY ARE NOT HERE EITHER — steam
 * temperature, flush temperature and flush flow. They were Decal's per-mode lists
 * paying for tracks recomposition made free; Ben's enumeration is closed ("top-down:
 * … TEMPERATURE") and each of the three has a home on the Settings machine leaves.
 * Recorded as an expected change rather than a silent drop.
 *
 * GRIND IS PRESENT AND DASHED, WHICH IS A7 AND BEN'S OWN CAVEAT ("a row whose key
 * the machine does not serve renders present + dashed"). No workflow field carries a
 * grind setting (`workflow-targets.js` names ten keys and grind is not one) and no
 * R2 limit row does either, so `withRange` marks it `unavailable: 'limits'` and the
 * stepper draws the dash it draws for every value the machine has not sent. Nothing
 * here invents a range for it.
 */

/**
 * THE PRESET BANKS SLATE SHIPS, AND WHY THEY ARE HERE RATHER THAN INVENTED AT RENDER.
 *
 * Ben's ruling names both banks by their values — "DRINK (+preset row 30/36/40/50)"
 * and "FLOW (+presets)" — and the oracle draws them:
 *   ORACLE live-ready #drink-out-preset-1..4 [i=37..40] "30" "36" "40" "50",
 *          rect [134,395,67,34] .. [335,395,67,34]; [i=39] "40" is the armed one
 *          (font-weight 400 and the plain ink against 300 and the muted one).
 *   ORACLE live-ready #steam-flow-preset-1..4 [i=63..66] "0.6" "0.8" "1.0" "1.2",
 *          rect [134,764,67,34] .. [335,764,67,34], none armed.
 *
 * THESE ARE PREFERENCES, NOT MACHINE READINGS, so A7 is not what governs them: the
 * rail's TARGETS come off the workflow document and dash when the machine has not
 * sent one, and a preset is the user's own shortcut to a target. `storage-routes.js`
 * already declares where an edited bank lives (`drinkOutPresets`, `steamFlowPresets`
 * — KV, machine-scoped, v1) and no store reads those rows yet, so what a screen sees
 * today is the shipped bank. `railRows`'s `presets` argument still wins whole, per
 * key, the moment an owner hands one over.
 */
export const DEFAULT_PRESETS = Object.freeze({
    drinkWeight: Object.freeze([30, 36, 40, 50]),
    steamFlow: Object.freeze([0.6, 0.8, 1.0, 1.2]),
});

/**
 * THE FIVE SECTIONS, AND WHY THEY ARE IN THE MODEL RATHER THAN IN A SELECTOR.
 *
 * Slate rules the rail into five blocks with four hairlines, and the blocks are not
 * the six dim groups: grind, dose and drink share one. Read off the oracle capture
 * — the lines fall after the drink presets [i=40] y=395+34, after brew [i=42]
 * y=483+64, after the steam-flow presets [i=66] y=764+34 and after flush [i=68]
 * y=853+64, and nowhere else.
 *
 *   [grind, dose, drink, drink presets] | [brew] | [steam, flow, flow presets]
 *   | [flush] | [hot water, temperature]
 *
 * A row says which section it is in; `railRows` marks the first row of each section
 * after the first, so the screen's sheet has one rule to write and never has to ask
 * "is this the first of its kind" in a selector. That is the same reason
 * `data-dim-group` is an attribute a row declares about itself rather than a
 * positional child selector — L17's trap, wearing a nth-child.
 */
const SECTION = Object.freeze({
    ESPRESSO: 'espresso',
    BREW: 'brew',
    STEAM: 'steam',
    FLUSH: 'flush',
    HOTWATER: 'hotwater',
});

/** Slate's nine rows, top-down, with Slate's own short labels. */
const STANDING_ROWS = Object.freeze([
    /* AUTHORED, NOT SERVED — the one row on this rail whose value is the USER'S.
     *
     * Every other target is a machine setting, and A7's rule for those is right: a value
     * the machine has not sent renders as the dash and its control stays disabled,
     * because there is nothing to step away FROM. A grind number is a note about a
     * grinder the machine has never heard of; a machine that has never been told one
     * serves no `grinderSetting` at all, and under the served rule that made the rail's
     * FIRST control permanently dead on a fresh machine — a dash nobody can fill in.
     * `authored` is the difference: absent means NOT SET YET, so the dash stays and the
     * control works. `<live-screen>` reads it at the one place that decides. */
    target('grind', 'grind', 'Grind', { section: SECTION.ESPRESSO, authored: true }),
    target('dose', 'dose', 'Dose', { section: SECTION.ESPRESSO }),
    target('drink-weight', 'drinkWeight', 'Drink', { presets: true, section: SECTION.ESPRESSO }),
    target('brew-temp', 'brewTemp', 'Brew', { channel: TEMPERATURE, section: SECTION.BREW }),
    /* STEAM: the stop-mode toggle, then the target it names. */
    Object.freeze({ kind: RAIL_ROW.STOP_MODE, id: 'steam-stop', of: MACHINE_STATE.STEAM, section: SECTION.STEAM }),
    /* CONTINUATION ROWS take Slate's quiet 12px name rather than the 17px one — the
     * row is a second target under the block's heading, not a heading of its own.
     * ORACLE live-ready [i=56] .slate-continuation-label "Flow" font-size 12px against
     * [i=48] #steam-label "Steam" at 17px, and [i=82] "Temperature" 12px against
     * [i=74] #hotwater-label at 17px. It is also what makes TEMPERATURE fit the 88px
     * name column on one line instead of breaking mid-word (DQ-735's shape). */
    target('steam-flow', 'steamFlow', 'Flow', {
        presets: true, channel: FLOW, section: SECTION.STEAM, continuation: true,
    }),
    target('flush-duration', 'flushDuration', 'Flush', { section: SECTION.FLUSH }),
    /* HOT WATER: the same pair, then the water temperature Slate labels "Temperature". */
    Object.freeze({ kind: RAIL_ROW.STOP_MODE, id: 'water-stop', of: MACHINE_STATE.HOT_WATER, section: SECTION.HOTWATER }),
    target('water-temp', 'hotWaterTemp', 'Temperature', {
        channel: TEMPERATURE, section: SECTION.HOTWATER, continuation: true,
    }),
]);

/**
 * The stop TARGET each stop-mode names — the row the toggle above it governs.
 *
 * THE LABELS ARE SLATE'S ROW NAMES, not the toggle's word. Slate labels the row
 * "Steam" / "Hot Water" and says what it stops on in the caption beneath; the
 * toggle above carries the two words. A row labelled "Steam time" would be Decal
 * naming the stop condition twice.
 *
 * AND THE CASE IS SLATE'S TOO (review, 7-live-polish): the oracle's own record is
 * "Hot Water" (#hotwater-label [i=74]), the sentence above already quoted it, and
 * the first draft still shipped "Hot water" — a one-letter drift the text-exact
 * instrument reads as a real difference. It also puts the label on the i18n
 * table's existing "Hot Water" entry (settings-nav spells it the same way) instead
 * of an untabled key the gate cannot see.
 */
const STOP_TARGET = Object.freeze({
    /* OFF SHOWS THE DURATION, AND THAT IS NOT A FALLBACK — it is the row that gets the
     * machine out of Off. Under an Off stop the DE1 holds zero in both fields, so there is
     * no "more relevant" number to show; what there is, is one control whose value the
     * derivation reads. Stepping this row up from zero puts a positive duration on the
     * machine and the caption above it becomes "Timed stop" by itself, because both are
     * reading the same field. Pointing Off at the milk temperature instead would give the
     * rail a control that cannot leave the state it is drawn in. */
    [STEAM_STOP.OFF]: target('steam-stop-target', 'steamDuration', 'Steam', {
        section: SECTION.STEAM,
    }),
    [STEAM_STOP.TIME]: target('steam-stop-target', 'steamDuration', 'Steam', {
        section: SECTION.STEAM,
    }),
    [STEAM_STOP.MILK]: target('steam-stop-target', 'milkStopTemp', 'Steam', {
        channel: TEMPERATURE, section: SECTION.STEAM,
    }),
    [WATER_STOP.VOLUME]: target('water-stop-target', 'hotWaterVolume', 'Hot Water', {
        section: SECTION.HOTWATER,
    }),
    /* ONE FIELD, TWO UNITS, AND THE UNIT FOLLOWS THE STOP (27 August 2026).
     *
     * Both modes arm `hotWaterVolume` — ReaPrime carries ONE hot-water target and
     * `stopHotWaterAtWeight` decides how the sequencer reads it — so the limit key, the
     * band and the track are the same either way. What is NOT the same is the word beside
     * the number: under a weight stop the machine cuts the pour at 240 GRAMS, and the rail
     * printed "240 mL" because the unit came from the limits row and the limits row is
     * written for millilitres.
     *
     * THE SETTINGS PAGE ALREADY SAYS THIS, in the same words, one surface along:
     * `machine-hot-water-volume` carries `variants: {volume: {unit: 'mL'}, weight: {unit:
     * 'g'}}` over the very same `limit: 'hotWaterVolume'`. It moves WITH the caption for the
     * same reason it moves there — a caption reading "Weight target" over a well reading
     * "mL" is the rail contradicting itself, which is worse than the disagreement it was
     * fixing.
     *
     * IT IS ON THE ROW AND NOT ON THE RANGE, deliberately. `withRange` hands the stepper
     * "the table's own range" BY IDENTITY and the rail's suite asserts exactly that, because
     * the point of the assertion is that no layer between the R2 table and the control
     * invents a BOUND. A unit is not a bound and this does not touch one: the row restates
     * the symbol, the range object is still the table's, and `#renderRow` prefers the row's
     * word when it has one. */
    [WATER_STOP.WEIGHT]: target('water-stop-target', 'hotWaterVolume', 'Hot Water', {
        section: SECTION.HOTWATER, unit: 'g',
    }),
});

/**
 * The rail, as an ordered list of tracks. ONE list, in every state — see the block
 * above for Ben's ruling and the oracle rows it is read from.
 *
 * @param {object} opts
 * @param {object} opts.limits      the R2 table, as handed to the screen. A control
 *                                  whose key the table does not carry is returned
 *                                  with `unavailable: 'limits'` and rendered as such:
 *                                  absence is an answer, never a stand-in ceiling (A7).
 * @param {string} opts.steamStop   STEAM_STOP member
 * @param {string} opts.waterStop   WATER_STOP member
 * @param {object} opts.offers      `{ milkProbe, stopAtWeight }`, fail-closed
 * @param {object} opts.presets     limit key -> array of preset values, or absent
 * @returns {Array<object>} frozen row descriptors, track order
 */
export function railRows({
    limits = null,
    /* NULL IS THE DEFAULT AND IT USED TO BE A MODE. `steamStop = STEAM_STOP.TIME` meant a
     * caller who said nothing got a rail asserting that this machine stops its steam on a
     * timer — the same invented answer `stopModeRow` used to bake into `value`, one layer
     * up, where it was harder to see. Null reaches `stopModeRow` as "not answered", the
     * caption draws its dash, and the TRACK IS UNCHANGED: the fallback below still puts the
     * duration row in the steam slot and the volume row in the hot-water slot, so a rail
     * built with no answer has exactly the rows a rail built with one has. */
    steamStop = null,
    waterStop = null,
    offers = {},
    presets = {},
    /* THE DISPLAY UNIT FOR A TEMPERATURE TARGET. Defaulted, so every existing caller and
     * every test keeps the behaviour it had; the Live screen passes the stored preference.
     * The rail's three temperature targets — brew, steam and hot water — were drawn in
     * Celsius whatever the Temperature bank said, because nothing read the preference at
     * all until 26 August 2026. */
    tempUnit = TEMP_UNIT.CELSIUS,
} = {}) {
    /* THE ABORT TARGET RIDES THE FIRST ROW'S TRACK, and does not get one of its own.
     *
     * It used to share a track with the mode picker, and with the picker gone the
     * obvious move was to keep that track and render it empty at rest. MEASURED AND
     * REFUSED: an empty track is either a 76px hole above GRIND at rest (where the
     * oracle's rail opens straight on it) or, if the row is dropped instead, a rail
     * that slides 76px down the moment a shot starts — and "state changes weight,
     * never position … this is why the screen is readable during a shot" is Appendix
     * item 3, kept deliberately. Slate solves it by absolutely positioning its own
     * abort target over the top of the rail (slate-live.css, top: 25px, z-index 6);
     * this screen refuses positioning, so the first row's track is a one-cell grid and
     * both controls sit in it — same geometry, nothing positioned, and NOTHING MOVES.
     *
     * <ui-stop-button> is --ui-control-h tall, the same as the stepper underneath it,
     * so the track does not grow either. `abortSlot` says which row carries it; the
     * screen switches on that rather than on an id, and the row's dim group is `grind`
     * — which is EXEMPT (live-dimming.js), so the one dimming bug worse than L11 stays
     * impossible. */
    const rows = [];

    for (const row of STANDING_ROWS) {
        if (row.kind === RAIL_ROW.STOP_MODE) {
            const built = stopModeRow(row.of, { steamStop, waterStop, offers });
            if (!built) continue;
            /* THE DESCRIPTOR'S OWN ANSWER, not the argument — one normalisation, not two.
             * `stopModeRow` is where a value becomes a state or becomes null, and reading
             * the raw argument here again would be a second place for that rule to live
             * and a second place for it to go wrong. */
            const chosen = built.value;
            const fallback = row.of === MACHINE_STATE.STEAM ? STEAM_STOP.TIME : WATER_STOP.VOLUME;
            /* ===============================================================
             * THE STOP CONDITION RIDES THE TARGET'S OWN ROW — SLATE'S COMPOSITION,
             * L25's CONTROL (parity 7-live-polish, it14)
             * ===============================================================
             * It had a TRACK of its own: a full-width <ui-bank> reading Time | Milk
             * above the steam row and Volume | Weight above hot water. Two extra
             * tracks, and the rail below them sat ~76px lower than the oracle's at
             * every row — the single largest layout difference left on the screen,
             * and Ben's ruling enumerates NINE rows, not eleven, naming these two by
             * their contents rather than as rows: "STEAM (its stop-mode + 45s)",
             * "HOT WATER (volume stop)".
             *
             * SLATE PUTS THE WORDS IN THE LABEL CELL, as a second line under the
             * block heading, and hides the toggle that would change them:
             *   ORACLE live-ready #steam-label [i=48] "Steam" rect [28,613,68,20]
             *          with #steam-capability [i=49] .slate-service-capability
             *          "Timed stop" rect [28,640,81,14], 12px / 600 / 1.08px;
             *          #hotwater-label [i=74] "Hot Water" [28,991,108,41] with
             *          #hot-water-capability [i=75] "Volume stop" [28,1037,96,14].
             *   L25    slate-live.css:553-554 puts `display: none !important` on the
             *          real toggles, "with NO REPLACEMENT AFFORDANCE, so Time/Milk
             *          and Temp/Vol have no visible control on Live"; Slate's own
             *          route to changing it is a Settings field (settings.js:3108).
             *
             * SO THE CAPTION BECOMES THE CONTROL, which is L25's fix at Slate's own
             * geometry rather than beside it: SCOPE's wording is "v1 restores a
             * visible control for Time/Milk and Temp/Vol", and a caption that is a
             * real button — hit-tested over the whole 88px name column, in the tab
             * order, carrying the two options — is a visible control. It costs the
             * rail NO track, so Slate's nine rows are nine rows.
             *
             * The descriptor travels ON the target row (`stopMode`) rather than as a
             * row of its own; the screen reads it there and renders it in the
             * stepper's caption slot. `id`, `items` and `value` are unchanged, so the
             * gates, the dim map and the change event all still address the same
             * thing by the same name. */
            const built_ = Object.freeze({ ...built, section: row.section });
            const targetRow = STOP_TARGET[chosen] ?? STOP_TARGET[fallback];
            rows.push(withRange(Object.freeze({ ...targetRow, stopMode: built_ }), limits, tempUnit));
            continue;
        }
        rows.push(withRange(row, limits, tempUnit));
    }

    const banks = { ...DEFAULT_PRESETS, ...(presets || null) };
    for (const row of [...rows]) {
        if (row.presets && Array.isArray(banks[row.limitKey]) && banks[row.limitKey].length > 0) {
            rows.splice(rows.indexOf(row) + 1, 0, Object.freeze({
                kind: RAIL_ROW.PRESETS,
                id: `${row.id}-presets`,
                label: `${row.label} presets`,
                limitKey: row.limitKey,
                section: row.section ?? null,
                presets: Object.freeze([...banks[row.limitKey]]),
            }));
        }
    }

    if (rows.length) rows[0] = Object.freeze({ ...rows[0], abortSlot: true });

    /* THE FOUR HAIRLINES, DERIVED FROM THE SECTIONS RATHER THAN COUNTED. The first
     * row of every section but the first opens a block; the screen's sheet draws one
     * line above such a row and nothing else knows how many blocks there are. */
    let seen = null;
    return Object.freeze(rows.map((row) => {
        if (!row.section || row.section === seen) return row;
        const first = seen !== null;
        seen = row.section;
        return first ? Object.freeze({ ...row, sectionStart: true }) : row;
    }));
}

/**
 * The step function for one target, as `<ui-stepper>`'s `next` property wants it —
 * `next(value, direction) -> number`.
 *
 * THIS IS THE STEAM HOLE, AND IT IS WHY THE STEPPER TAKES A FUNCTION AT ALL. The
 * stepper's own file says the knowledge "must not be contained here and must not be
 * prevented", so the consumer supplies it; `machine-limits.js` owns it ("stepping
 * down from the bottom of the working band goes to the off value, and stepping up
 * from off goes to the bottom of the band"). The screen therefore never does limit
 * arithmetic and never sees a bound: it passes this function through.
 *
 * Null when the table declares no range for the key — a control with nothing to step
 * inside is rendered unavailable, not given a made-up range (A7).
 */
export function stepFor(limits, key, tempUnit = TEMP_UNIT.CELSIUS) {
    if (!hasLimit(limits, key)) return null;
    /* A FAHRENHEIT FACE STEPS IN CELSIUS AND ANSWERS IN FAHRENHEIT.
     *
     * The hole is the reason this function exists, and the hole is declared in Celsius:
     * the steam band is 0 OR 135-170, and stepping down from 135 has to land on 0 rather
     * than inside it. So a converted control converts IN, lets `machine-limits.js` do the
     * arithmetic it owns, and converts the answer back OUT. The rule is never touched and
     * every value a press reaches is one the machine can hold.
     *
     * Not a temperature, or not converted? The closure below is the one it always was. */
    const range = limits[key];
    if (range.unit === '°C' && tempUnit === TEMP_UNIT.FAHRENHEIT) {
        return (value, direction) => toDisplayTemp(
            stepLimit(limits, key, fromDisplayTemp(Number(value), tempUnit), direction),
            tempUnit,
        );
    }
    return (value, direction) => stepLimit(limits, key, value, direction);
}

/**
 * ONE TARGET'S BAND, AS THE NUMPAD WANTS TO BE TOLD IT — `{min, max, step, decimals,
 * unit, label, clamp}`, or null when the table declares no range for the key.
 *
 * WHY IT EXISTS AT ALL. `<ui-numeric-keypad>` used to be handed the RAW R2 table and
 * left to derive its own hint and its own clamp from it, which is right on a Celsius
 * tablet and wrong on every other one — and wrong under a WEIGHT stop in either unit.
 * `live-screen.js` named both instances out loud in `unitForRow`'s comment and left them
 * for one pass: the hint "reads the RAW R2 row and says '0–255 mL' under a weight stop
 * while the well beside it says g … the louder instance is temperature: in Fahrenheit the
 * same hint reads '70–110 °C' beside a well reading °F, on every temperature row, today.
 * Both want the same fix — a display unit the port is TOLD rather than one a screen
 * substitutes." This is the rail's half of that fix (27 August 2026).
 *
 * IT IS THE ROW'S OWN FACE AND NOTHING NEW. `row.range` is what `withRange` already
 * attached and what the STEPPER beside the numpad is already drawing — the table's own
 * object for anything unconverted, its Fahrenheit face for a temperature — so the two
 * controls over one target cannot describe it differently. `row.unit` is the row's
 * restatement of the word, when it has one, and is exactly what `#renderRow` prefers.
 *
 * THE CLAMP IS `stepFor`'s SHAPE, for the same reason. The hole is declared in Celsius
 * and only `machine-limits.js` knows it, so a converted band converts IN, lets the port
 * do the arithmetic it owns, and converts the answer back OUT. The screen therefore still
 * never does limit arithmetic and still never sees a bound.
 *
 * @param {object|null} row       a rail row descriptor from `railRows`
 * @param {object|null} limits    the R2 table
 * @param {string} tempUnit       the display unit for a temperature target
 */
export function numpadBandFor(row, limits, tempUnit = TEMP_UNIT.CELSIUS) {
    const key = row?.limitKey;
    if (!key || !hasLimit(limits, key)) return null;
    /* THE ROW'S RANGE WHEN IT HAS ONE, else the table's own face of it. A row always has
     * one after `withRange`; the fallback is for a caller holding a bare descriptor. */
    const shown = row.range ?? displayRange(limits[key], tempUnit);
    const converted = limits[key].unit === '°C' && tempUnit === TEMP_UNIT.FAHRENHEIT;
    const word = row.unit ?? shown.unit;
    return Object.freeze({
        min: shown.min,
        max: shown.max,
        step: shown.step,
        /* THE MACHINE'S PRECISION, NOT THE CONVERTED STEP'S. `displayRange` states it on
         * a converted band precisely because 1 °C is 1.8 °F and the tenth is an artefact
         * of the arithmetic rather than a value the machine can hold. An unconverted range
         * is the table's own object and carries none, so it is read off the step — the
         * same derivation `#railFormatter` does one file along, and the same answer. */
        decimals: shown.decimals ?? decimalsForStep(shown.step),
        unit: word,
        /* THE SENTENCE, FROM THE ONE COMPOSER, over the band being drawn and with the
         * row's own word for it. Nothing is assembled here. */
        label: bandHint(shown, { unit: word }),
        clamp: converted
            ? (value) => toDisplayTemp(
                clampLimit(limits, key, fromDisplayTemp(Number(value), tempUnit)), tempUnit)
            : (value) => clampLimit(limits, key, value),
    });
}

/**
 * Attach the table's own range to a target row, or say why there is none.
 *
 * THE RANGE IS THE ROW'S WHOLE FACE — the stepper reads its min, max, step and unit off
 * this one object — so converting HERE converts the control, the band and the symbol
 * together. `displayRange` is the same function the settings rows use; two copies of the
 * arithmetic is how the rail and the settings page come to disagree about where a band
 * ends. A range that is not a temperature comes back untouched.
 */
function withRange(row, limits, tempUnit = TEMP_UNIT.CELSIUS) {
    if (!row) return row;
    if (!hasLimit(limits, row.limitKey)) {
        return Object.freeze({ ...row, range: null, unavailable: 'limits' });
    }
    return Object.freeze({
        ...row,
        range: displayRange(limits[row.limitKey], tempUnit),
        unavailable: null,
    });
}

/**
 * WHICH SHOT THE BAND AND THE PLOT ARE ABOUT — one decision, in one place.
 *
 * The Live page draws the running shot while there is one and the last stored shot at
 * rest, and the History arrows let a person walk back through the archive without leaving
 * the page. Three inputs, and the order between them is the whole of it:
 *
 *   1. A RUNNING SHOT WINS OVER EVERYTHING. It is what the screen is for, and the stored
 *      one must never take the plot away from a pour in progress.
 *   2. BROWSING WINS OVER A SHOT THAT IS OVER. The live buffer holds the last shot until
 *      the next one starts, so `live.ok` stays true for as long as the machine sits idle
 *      after a pull. Preferring it unconditionally is what made the arrows move the date
 *      and the title — which read the list row — and change nothing else: the plot, the
 *      phase table and the four derived readings all went on describing the shot that had
 *      just finished. Ben, 23 Aug 2026.
 *   3. OTHERWISE THE LIVE ONE IF IT HAS SAMPLES, else the stored one, else whatever the
 *      live side has to say about why it has nothing (its `reason`), because that is the
 *      message the empty plot prints.
 *
 * @param {object|null} live     the buffer's derivation, or null
 * @param {object|null} stored   the selected stored shot's, or null
 * @param {object} [state]
 * @param {boolean} [state.browsing]  the arrows are on a row that is not the newest
 * @param {boolean} [state.running]   the machine is pulling a shot now
 */
export function bandDerivationFor(live, stored, { browsing = false, running = false } = {}) {
    if (running) return (live && live.ok) ? live : (live ?? stored ?? null);
    if (browsing) return stored ?? null;
    if (live && live.ok) return live;
    return stored ?? live ?? null;
}

/* ═══════════════════════════════════════════════════ the foot band's phase table */

/**
 * The phase table's columns: Time, Weight, Volume — Slate's own three
 * (`index.html:359-400`, quoted by `ui-data-grid.demo.js`), and D1's three.
 *
 * D1 REMOVES THE DERIVED LIST FROM v1, so there is no R / Z / W column, no fused
 * estimator column, and no fourth `<ui-data-grid>` variant to hold them. The
 * derivation serves those channels; this table does not read them, and a test asserts
 * the column keys are exactly these three.
 *
 * WHICH COLUMN CARRIES A CHANNEL INK — SLATE'S, NOT A GUESS (parity surface 1). This
 * table used to tint VOLUME and leave WEIGHT plain, which is Slate's assignment
 * exactly inverted:
 *   ORACLE  live-ready #shot-data-pi-weight [i=135] color = rgb(139, 99, 67)
 *           <- slate-live.css {#main-page #shot-data-panel :is(#shot-data-pi-weight,
 *           #shot-data-ex-weight, #shot-data-total-weight)} authored
 *           `var(--slate-data-weight-flow, var(--slate-text))` !important=yes
 *           [= --ui-channel-weight-flow #8b6343, chart-channels.css:142]
 *   ORACLE  live-ready #shot-data-pi-volume [i=136] color = rgb(244, 247, 248) — the
 *           plain ink, no rule: Slate has no volume channel to paint it with, and
 *           #shot-data-total-volume [i=144] and #shot-data-ex-volume [i=140] agree.
 *   SOURCE  slate-live.css:1953-1954, the History page's own two: `[data-col="temp"]`
 *           and `[data-col="weight"]` take channel inks and nothing else does.
 * Decal DOES have a volume channel (--ui-channel-volume, a documented ladder-4
 * addition in chart-channels.css for a trace Slate never drew), but having one is not
 * a reason to paint a column Slate paints plain: Slate is the default and a difference
 * has to be an improvement. The channel that Slate itself paints here is weight, so
 * weight is what this table tints. `ink` stays a per-column capability of
 * <ui-data-grid> either way — the token drill in its own suite is what proves it.
 */
/*
 * `grow: 0` ON ALL THREE — the columns keep their floor and the band keeps the slack
 * (parity 7-live-polish). Slate's own arithmetic: ORACLE live-ready #shot-data-panel
 * [i=126] rect [902,944,1018,256] holds three value columns of 80 / 88 / 94
 * (#shot-data-pi-time [i=134] w=80, -pi-weight [i=135] w=88, -pi-volume [i=136] w=94),
 * so the table reads as a compact block at the left of a wide panel with the four
 * derived scalars beside it. Sharing the band's whole width gave Decal three 334px
 * columns and pushed the scalars against the end of the row.
 */
export const PHASE_COLUMNS = Object.freeze([
    /* ONE ALIGNMENT FOR THREE COLUMNS OF DIGITS (parity 7-live-polish, it16).
     *
     * This table read `align: 'end'` on WEIGHT and nothing — i.e. 'start' — on TIME and
     * VOLUME, so one numeric column lined its digits up and the two either side of it
     * did not. That is Decal disagreeing with itself inside one table, which is the
     * defect class this whole rewrite exists to end.
     *
     * SLATE CENTRES ALL THREE and no value here can match it: the component offers
     * 'start' and 'end' (DATA_GRID_ALIGNMENTS), and adding a third for one caller would
     * be a component change made to copy a treatment that is worse than either option
     * — centred digits do not line up column-wise, which is the entire reason numeric
     * tables are set flush right.
     *   ORACLE live-ready #shot-data-pi-time [i=134] rect [1080,1018,80,34] holding "0"
     *          centred in its 80px column, with its heading [i=127] "Time" [1101,980,38]
     *          centred over it; -weight [i=135] and -volume [i=136] the same.
     * So: 'end' on all three, which is the nearest of the two available, is what the
     * weight column already did, and is the one that makes a column of numbers readable.
     * Recorded as a KEEP rather than left as a silent divergence. */
    Object.freeze({ key: 'time', label: 'Time', unit: 's', align: 'end', grow: 0 }),
    Object.freeze({
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        align: 'end',
        grow: 0,
        ink: 'var(--ui-channel-weight-flow)',
    }),
    Object.freeze({ key: 'volume', label: 'Volume', unit: 'mL', align: 'end', grow: 0 }),
]);

const PHASE_ORDER = Object.freeze([
    Object.freeze({ key: 'preinfusion', header: 'Preinfusion' }),
    Object.freeze({ key: 'extraction', header: 'Extraction' }),
    Object.freeze({ key: 'total', header: 'Total', emphasis: true }),
]);

/**
 * THE HISTORY VIEWER'S OWN COLUMNS — the Live panel's three, plus three more.
 *
 * Ben, 25 August 2026, on the chart audit's finding 6 (the shot-data table): "Copy Slate".
 * Slate's history table carries TIME, WEIGHT, VOLUME, TEMP, FLOW and PRESSURE
 * (`history-viewer.js` `DATA_COLUMNS`), and Decal's carried the first three.
 *
 * AND THE LIVE PANEL KEEPS ITS THREE, which is Slate's split too and not an oversight:
 * `index.html`'s `#shot-data-panel` states `grid-template-columns: 80px 88px 94px` and
 * holds `-time`, `-weight`, `-volume` and nothing else. The Live panel is read from across
 * a kitchen while a shot is pouring; the history table is read leaning over the machine
 * afterwards. Two surfaces, two column counts, one derivation behind both.
 *
 * `grow: 0` ON EVERY COLUMN, as `PHASE_COLUMNS` has it: these are numbers, and a numeric
 * column that stretches puts its digits somewhere different in every table.
 */
export const HISTORY_PHASE_COLUMNS = Object.freeze([
    ...PHASE_COLUMNS,
    Object.freeze({ key: 'temp', label: 'Temp', unit: '°', align: 'end', grow: 0 }),
    Object.freeze({
        key: 'flow',
        label: 'Flow',
        unit: 'mL' + '/' + 's',
        align: 'end',
        grow: 0,
        ink: 'var(--ui-channel-flow)',
    }),
    Object.freeze({
        key: 'pressure',
        label: 'Pressure',
        unit: 'bar',
        align: 'end',
        grow: 0,
        ink: 'var(--ui-channel-pressure)',
    }),
]);

/**
 * THE ARROW BETWEEN A PHASE'S ENDS — Slate's `formatStartPeakEnd` and `formatRange`.
 *
 * Slate prints a range as `4.5➔12.0➔4.7`, and its shape carries a fact one number cannot:
 * a preinfusion that rose to 4 bar and stayed there and one that rose to 12 and fell back
 * have the same peak and are not the same shot. The rules are Slate's exactly:
 *
 *   - one value, or a start equal to its end, prints as one number;
 *   - a peak that IS the start or the end prints as two;
 *   - otherwise all three.
 *
 * A MIN-MAX RANGE FOR TEMPERATURE, because a group temperature has no meaningful start or
 * end within a phase — it drifts, and what a reader wants is the band it drifted across.
 * That is Slate's split too: `formatRange` for temp, `formatStartPeakEnd` for flow and
 * pressure.
 *
 * THE ARROW IS U+2794, which is the character Slate uses. Not a hyphen and greater-than:
 * a table of numbers with `->` between them reads as source code.
 */
export const PHASE_RANGE_ARROW = '\u2794';

function spellRange(parts, places) {
    const spelled = parts
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
        .map((v) => v.toFixed(places));
    if (!spelled.length) return null;
    const [first] = spelled;
    const last = spelled[spelled.length - 1];
    if (spelled.length === 1 || first === last) return first;
    const unique = [first];
    for (const value of spelled.slice(1)) {
        if (value !== unique[unique.length - 1]) unique.push(value);
    }
    return unique.join(PHASE_RANGE_ARROW);
}

/**
 * The same three phases, with Slate's three extra columns.
 *
 * `phaseRows` IS CALLED RATHER THAN RE-IMPLEMENTED, so the three shared columns can never
 * disagree between the Live panel and this table — which is the failure the shared
 * `PHASE_COLUMNS` exists to prevent, one layer up.
 *
 * THE TOTAL ROW HAS NO RANGES, and that is a fact about the derivation rather than a
 * choice here: `shot-derivation.js` builds `total` from `phaseRow(0, last)` and then
 * OVERWRITES its weight and volume, so its `groupTemp`, `flow` and `pressure` describe the
 * whole shot including the fill. Slate drops them for the same reason and its own note
 * says so: "Total has no per-channel ranges".
 */
export function historyPhaseRows(derivation) {
    const phases = derivation && derivation.ok ? derivation.phases : null;
    return Object.freeze(phaseRows(derivation).map((row) => {
        const phase = phases ? phases[row.key] : null;
        if (!phase || row.key === 'total') return row;
        const extra = {
            temp: spellRange([phase.groupTemp?.min, phase.groupTemp?.max], 0),
            flow: spellRange([phase.flow?.start, phase.flow?.peak, phase.flow?.end], 1),
            pressure: spellRange([phase.pressure?.start, phase.pressure?.peak, phase.pressure?.end], 1),
        };
        const cells = { ...row.cells };
        for (const [key, value] of Object.entries(extra)) {
            if (value !== null) cells[key] = value;
        }
        return Object.freeze({ ...row, cells: Object.freeze(cells) });
    }));
}

/**
 * A phase-table cell, spelled.
 *
 * ONE DECIMAL MEANS ONE DECIMAL, INCLUDING WHEN IT IS A ZERO. `Number(v.toFixed(1))`
 * rounds correctly and then throws the spelling away: 8.0 becomes the number 8, which the
 * grid renders as "8" in a column whose other cells read "21.7" and "0.4". Measured in the
 * loop proof's own output — `"total.weight":"8"` beside `"extraction.time":"8.7"`. A
 * ragged decimal column is harder to read at a glance than a steady one, which on a wall
 * panel is the whole job, so the string is the value: rounding and spelling happen once,
 * here, and the grid keeps rendering exactly what it is handed (`cellText` takes a string
 * and `''`/null is still the dash).
 *
 * The DERIVATION still holds numbers; this is the screen's layer spelling them.
 */
const cell = (value, places) => (typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(places)
    : null);

/**
 * The gate-6 derivation's `phases` as data-grid rows.
 *
 * WHAT IT DOES NOT DO: compute, substitute or zero. A phase the derivation returns as
 * `null` is a row with no cells, and the grid draws its dash — "an em dash says not
 * applicable here; an empty cell says we forgot" (`history-viewer.js:827-830`, quoted
 * by the grid's own demo). A shot that never left preinfusion has an Extraction row
 * and no Extraction numbers, which is the truth about it.
 *
 * @param {object|null} derivation  `deriveFromBuffer(...)` / `emptyShotDerivation()`
 */
export function phaseRows(derivation) {
    const phases = derivation && derivation.ok ? derivation.phases : null;
    return Object.freeze(PHASE_ORDER.map((row) => {
        const phase = phases ? phases[row.key] : null;
        const cells = phase
            ? {
                time: cell(phase.seconds, 1),
                weight: cell(phase.weight, 1),
                volume: cell(phase.volume, 1),
            }
            : {};
        for (const key of Object.keys(cells)) {
            if (cells[key] === null) delete cells[key];
        }
        return Object.freeze({ ...row, cells: Object.freeze(cells) });
    }));
}
