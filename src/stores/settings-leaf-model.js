/**
 * settings-leaf-model.js — what a leaf pane needs in order to paint one leaf, and the
 * only place the registry, the routing table, the limits table and the capability array
 * are joined. Wave 5.4, rows `settings-row-thirty-leaves`, `d11-save-count`.
 *
 * DOM-FREE. No `document`, no lit, no colour. Every input is injected, so the whole join
 * — including "does this row's key resolve", "what is the hint", "is this surface shown"
 * and "how many changes are unsaved" — is a `node:test` unit test rather than a
 * photograph. `src/screens/settings-leaf.js` is the render of what this returns and
 * decides nothing.
 *
 * ===========================================================================
 * TWO SOURCES, AND THE DIFFERENCE IS THE WHOLE OF B7 AND OF D11
 * ===========================================================================
 *
 * SOURCE.ROUTE — a preference this skin stores. It goes through `settings-store.js` and
 * therefore through the routing table, which decides the LAYER. One store per setting,
 * by construction; there is no branch here that could pick a second. A route row is
 * written THE MOMENT IT CHANGES, because a preference that needs a Save is a preference
 * you can lose by walking away, and because the units.js defect was a write that failed
 * silently — here a failed write leaves the shown value alone and says so.
 *
 * SOURCE.MACHINE — a field of ReaPrime's own settings document. This skin stores nothing
 * and the machine owns the value. Machine fields are STAGED: changing one records an
 * intent, `changeCount` counts the intents, and one POST sends them together when the
 * band's Save is pressed. That is D11's count with something real behind it, and it is
 * Slate's own shape (`settings.html:7` `#save-settings-btn`, verified) rather than a
 * commit model invented here. The handler takes any subset of the nine keys, so a
 * three-change Save is one request carrying three keys.
 *
 * D11 IS WORDING AND THIS MODEL PRODUCES NONE. `changeCount` is a number. "Save (3)" is
 * `ui-page-header`'s sentence and is decided there, once, for the whole app.
 *
 * ===========================================================================
 * RANGES ARRIVE, THEY ARE NEVER DECLARED  (B2 / R2)
 * ===========================================================================
 *
 * `limits` is a CONSTRUCTOR ARGUMENT and the caller gets it from the R2 door
 * (`r2MachineLimits(entries)` in `src/data/adapters-r.js`, fed by the served capability
 * array). `machine-limits.js` exports no table — `BASE_LIMITS` is module-private — so a
 * second ranges table cannot be built by importing one; it would have to be typed out,
 * and `test/settings-leaves.test.mjs` asserts that no numeric range literal appears in
 * the registry or in this file.
 *
 * A row with no `limit` name is UNBOUNDED and says so by printing no hint. That is B2's
 * "unstated is unbounded — null, not a number this file picked", carried up one level:
 * the skin does not invent a range in order to have something to put beside a label.
 *
 * ===========================================================================
 * A3 FAIL-CLOSED, AND UNKNOWN IS THE ONE THAT MATTERS
 * ===========================================================================
 *
 * Gating is the settings store's `gate()` — the served array, never a model string — and
 * both ABSENT and UNKNOWN hide the surface. Against the mock, which answers
 * /api/v1/machine/capabilities with 503 by design, every gate reads UNKNOWN; a screen
 * that rendered its gated rows anyway would be a finding, not a nicety. A hidden row is
 * absent from `rows()` entirely: there is no disabled state to reason about, and the
 * store refuses the write as well, so a control that should not exist cannot post.
 */

import { createStore } from './store.js';
import { defaultFor, hasDefault, machineFallbackFor } from '../lib/settings-defaults.js';
import {
    SOURCE,
    ARCHETYPE,
    RESTORE,
    rowsForLeaf,
    noteForLeaf,
    pendingForLeaf,
    leafReadsMachineDoc,
} from '../lib/settings-leaves.js';
import { hasLimit, step as stepLimit, clamp, padBand } from '../lib/machine-limits.js';
import { rowShownOn } from '../lib/settings-nav.js';
import {
    TEMP_UNIT, TEMP_UNIT_KEY, DEFAULT_TEMP_UNIT, normaliseUnit, unitSymbol,
    toDisplayTemp, fromDisplayTemp, displayRange, displayRangeHint, decimalsForStep,
} from '../lib/temperature.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/**
 * THE PANEL SETTINGS — the third owner, and the one this model had no seam for.
 *
 * A ROUTE row's value belongs to this skin and a MACHINE row's belongs to the espresso
 * machine. The wake lock is neither: it belongs to the TABLET, ReaPrime holds it, and the
 * skin asks for it over the display socket. Until 26 August 2026 the row was declared as
 * an ordinary ROUTE row and that was the whole defect — `wakeLockEnabled` was written to
 * device storage, nothing in `src/` ever read the key back, and the screen slept exactly
 * as the operating system decided whichever way the switch was set.
 *
 * A TABLE, NOT A BRANCH ON A KEY NAME. A row declares `panel: '<name>'` and this table
 * says what reading and writing that name means; the model below never spells
 * `wakeLockEnabled`, and a second panel setting is an entry here rather than a second
 * `if`. Every entry must be named by a row — `test/settings-leaves.test.mjs` checks the
 * table against the registry in both directions, which is T7's law applied to a seam
 * rather than to an archetype.
 *
 * THE STORED KEY DOES NOT GO AWAY, and that is deliberate. The panel answers only once a
 * display frame has arrived, and a switch that rendered blank until the socket connected
 * would be a control that flickers on every boot. So the row keeps its route key as the
 * PRE-FRAME answer and as the preference that survives a reload, and the served value
 * outranks it the moment there is one.
 */
const PANEL_SETTINGS = Object.freeze({
    wakeLock: Object.freeze({
        /** What ReaPrime says THIS CLIENT asked for. `undefined` = no frame yet. */
        read: (panel) => panel.wakeLockOverride?.(),
        /** Take the override, or release it. Answers the `{ok, reason}` shape. */
        write: (panel, value) => panel.setWakeLock?.(value === true),
    }),
    /* SCREEN BRIGHTNESS IS THE SAME SHAPE AS THE WAKE LOCK, which is why it is here and
     * not a second mechanism: what the panel is actually showing outranks what this tablet
     * last stored, and the stored value is the answer before the first frame arrives. It
     * moved off the bespoke leaf on 28 Aug 2026 — the page existed only because a slider
     * had no archetype, and `ARCHETYPE.SLIDER` closed that. */
    brightness: Object.freeze({
        /** What the display frame reports. `undefined` = no frame yet, so the store answers. */
        read: (panel) => panel.brightnessServed?.(),
        /** Command the panel. Answers the `{ok, reason}` shape, so a refusal is reportable. */
        write: (panel, value) => panel.setBrightness?.(Number(value)),
    }),
});

/** Exported for the suite, which checks it names the same set the registry does. */
export const PANEL_SETTING_NAMES = Object.freeze(Object.keys(PANEL_SETTINGS));

/** What went wrong with a machine write. Reportable — the screen shows it, never a shrug. */
export const COMMIT_REFUSAL = Object.freeze({
    NO_MACHINE_PORT: 'noMachinePort',
    WRITE_FAILED: 'writeFailed',
});

/**
 * @param {object} options
 * @param {object} options.settings   `createSettingsStore(...)` — the B7 spine. Required.
 * @param {object} [options.machine]  `{ read(): Promise<object|null>, write(patch):
 *                                    Promise<boolean> }` over `POST /machine/settings`.
 *                                    Absent means the machine is not reachable, which is
 *                                    a state (no fixture, no connection), not an error:
 *                                    machine rows then read absent and refuse to commit.
 * @param {object|function} [options.limits]
 *                                    the limits table, FROM THE R2 DOOR, or a function
 *                                    returning it. Absent = no ranges are known, so no
 *                                    hint is printed and no stepper is bounded.
 *
 *                                    PASS THE FUNCTION IF THE TABLE CAN CHANGE, AND IT
 *                                    CAN. The steam row is in the table only once the
 *                                    machine class is known, and the class comes from
 *                                    the SERVED capability array — an asynchronous read.
 *                                    A table captured at construction is therefore the
 *                                    empty-class one on every normal boot, and MEASURED
 *                                    on 26 August 2026 that is what shipped: the steam
 *                                    Temperature row drew no band, no degree sign and no
 *                                    clamp for the whole session, whatever the machine
 *                                    answered a moment later. A function is re-read at
 *                                    every join, so the row gains its envelope the
 *                                    moment the answer lands.
 * @param {(function|string|null)} [options.machineClass]
 *                                    'bengle', 'de1', null, or a function returning one —
 *                                    the SERVED class, out of `capabilities.machineClass()`.
 *                                    A handful of registry rows declare `machines`, and
 *                                    this is what those rows are answered against.
 *
 *                                    PASS THE FUNCTION, FOR THE SAME REASON `limits` TAKES
 *                                    ONE. The class comes from an asynchronous capability
 *                                    read, so a value captured at construction is `null`
 *                                    on every normal boot — and `null` means "show
 *                                    everything", so a captured one would draw a DE1-only
 *                                    control on a Bengle for the whole session and never
 *                                    take it away. Re-read at every join, the row goes as
 *                                    soon as the answer lands.
 *
 *                                    ABSENT IS `null` IS "NOT YET", WHICH SHOWS EVERYTHING.
 *                                    That is deliberate and it is `shownOnMachine`'s rule,
 *                                    not this file's: hiding on an unknown class would hide
 *                                    a control on EVERY machine for as long as the read
 *                                    takes, including on the machine it belongs to.
 * @param {object} [options.panel]   the TABLET's own door — today `{setWakeLock(on),
 *                                    wakeLockOverride()}` over the display socket and the
 *                                    display feed (`settings-model.js` builds it). Absent
 *                                    means there is no live layer, which is a state and not
 *                                    an error: a panel row then reads its stored preference
 *                                    and its write is refused with a reason rather than
 *                                    silently appearing to work.
 * @param {object} [options.logger]
 */
export function createSettingsLeafModel({
    settings, machine = null, limits = null, machineClass = null, panel = null,
    logger = NOOP_LOGGER,
} = {}) {
    /* THE TABLE, RESOLVED AT EVERY USE. A plain object is still accepted and still
     * behaves as it did — it is simply a table that never changes. */
    const limitsNow = typeof limits === 'function' ? limits : () => limits;
    /* AND THE CLASS THE SAME WAY, for the same asynchronous reason — see the parameter. */
    const machineClassNow = typeof machineClass === 'function' ? machineClass : () => machineClass;
    if (!settings || typeof settings.value !== 'function' || typeof settings.set !== 'function') {
        throw new Error('createSettingsLeafModel: the settings store must be injected (src/stores/settings-store.js)');
    }
    const log = logger.scope ? logger.scope('settings-leaf') : logger;

    /* THE FOUR PIECES OF STATE, and only the last of them is a decision this file makes.
     *  - machineValues: what the machine last said. A read, never a guess.
     *  - staged:        what the user has asked for and not yet committed. D11's count.
     *  - stagedMemory:  the master switches' remembered values, waiting for the same Save.
     *  - version:       a change beacon, so a screen can re-render on one subscription
     *                   rather than one per row. */
    const machineValues = new Map();
    const staged = new Map();

    /**
     * THE REMEMBERED VALUE A MASTER SWITCH IS LEAVING BEHIND — STAGED, NOT WRITTEN.
     * (Audit F-049, 29 August 2026.)
     *
     * THE DEFECT. A `zeroSwitch` row turned off did `await settings.set(row.zeroSwitch,
     * current)` on the press, then staged the machine field at zero. So one gesture made
     * TWO writes with two different lifetimes: the machine half waited for Save and the
     * memory half was already on the server. Cancel undid the half it could reach and left
     * the other standing, which is the only control in settings that writes outside the
     * commit band — and the comment four lines above that call said the opposite, in as
     * many words: "so Cancel undoes the switch exactly as it undoes a stepper".
     *
     * THE MEASURED HARM IS NOT ONLY THE STRAY WRITE. S04c: step the Tank heater 44 → 47
     * (staged, nothing on the wire), toggle off — the kv write carries **47** — then
     * Cancel. The machine still holds 44, the row redraws 44, and the memory holds a 47
     * the machine was never given. That 47 is what the next "switch it back on" restores,
     * and the window is bounded only by the next OFF.
     *
     * SO IT IS A SECOND STAGING BUCKET, AND IT HAS TO BE SEPARATE FROM `staged`. `staged`
     * is the MACHINE patch — every key in it goes into one `POST /machine/settings` — and
     * these are kv keys on a different route entirely. Same band, same Save, same Cancel;
     * different wire.
     *
     * IT DOES NOT ADD TO THE COUNT. Turning a master switch off is ONE change to a person
     * and the machine field it stages is already counting it; a second increment would make
     * the band read "2 changes" for one press. `changeCount` therefore stays `staged.size`,
     * and the two buckets are always emptied together.
     */
    const stagedMemory = new Map();

    /**
     * A staged memory of `FORGET` means DELETE THIS KEY ON SAVE — audit F-049's face S03c,
     * Ben's decision D09 (30 August 2026).
     *
     * THE DEFECT: `steamTempWhenOn`, `tankTempWhenOn` and `cupWarmerTarget` were WRITE-ONLY
     * from the UI. Absent→set existed; set→absent did not, anywhere. The audit read the
     * whole leaf inventory to be sure, and checked the one plausible candidate on the
     * device: **"Restore defaults" moved the machine field and left the memory exactly
     * where it was — 0 DELETEs, 0 kv writes, `cupWarmerTarget` still 62 and
     * `tankTempWhenOn` still 47 afterwards.**
     *
     * SO THE ROUTE IS "RESTORE DEFAULTS", AND IT IS THE SMALLEST HONEST DESIGN. No new
     * control, no new wording (wording is Ben's), and no new gesture to learn — because a
     * restore that leaves a private memory behind is the restore LYING: the page reads as
     * shipped and the next switch-on resurrects a number from a session nobody remembers.
     * The rejected alternative was a per-row "forget" affordance, which is a second control
     * for a state most people will never know exists.
     *
     * IT IS STAGED, NOT SENT — which is the whole point of F-049. A DELETE fired on the
     * press would be the same fault the Cancel half fixed, in the other direction: a
     * memory destroyed outside the commit band and unrecoverable by Cancel. `null` rides in
     * the SAME bucket as a remembered value, so `discard()` takes it back and `commit()`
     * sends it — as a `remove`, once the machine half has been accepted.
     */
    const FORGET = null;
    const beacon = createStore({ version: 0, changeCount: 0, machineLoaded: false }, {
        label: 'settings-leaf', logger: log, freeze: false,
    });

    let machineLoaded = false;

    /** The machine read in flight, so concurrent page opens share one. */
    let inFlightMachineRead = null;

    const bump = () => beacon.set({
        version: beacon.get().version + 1,
        changeCount: staged.size,
        machineLoaded,
    });

    /* ---- the join --------------------------------------------------------- */

    /* ═══════════════════════════════════════════════════════════════════════
     * TEMPERATURE — shown in the unit the person chose, held in the machine's
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE PREFERENCE HAD NO READER. `units.js` has carried the whole conversion since it
     * was written — four policy functions, a store, a formatter — and `createUnitsStore`
     * had ZERO callers anywhere in `src/`. Every temperature in the skin was drawn in
     * Celsius whatever the Temperature bank said. Found on 26 August 2026 by sweeping every
     * settings row for something on the other end; Ben: "Convert all C to F with rounding
     * to same decimal place as the original value. With reverse conversion to go back to
     * the machine."
     *
     * THE WIRE IS ALWAYS CELSIUS. Nothing below this edge knows a unit exists: the staged
     * Map, the doors, the limits table and the machine all speak Celsius, and a value the
     * user typed becomes Celsius before it is staged. A conversion that survives past the
     * display edge is a conversion that eventually round-trips through a write.
     *
     * WHY A STEP IS THE MACHINE'S AND NOT THE DISPLAY'S — and this departs from the
     * module's own Policy 2, so it is argued rather than assumed. `units.js` says a step
     * delta should have no offset "so a +1 degree button feels like one degree in whichever
     * unit is showing". That was written before `machine-limits.js` grew a hole-aware
     * `step()`: the steam band is 0 OR 135-170, and stepping down from 135 has to land on 0
     * rather than inside the hole. Only `stepLimit` knows that, and it steps in Celsius.
     *
     * So a press moves ONE MACHINE STEP and the Fahrenheit reading moves 1.8, which reads
     * as 2, 2, 1, 2, 2 after rounding. Uneven — and every value a press can reach is a
     * value the machine can hold, and every hole in every band still works. The alternative
     * is even numbers on screen and a step function that walks into the hole.
     */

    /** The display unit right now: the stored preference, else Celsius. */
    function tempUnitNow() {
        return normaliseUnit(settings.value(TEMP_UNIT_KEY)) ?? DEFAULT_TEMP_UNIT;
    }

    /**
     * Is this row a temperature the person may want in Fahrenheit?
     *
     * THE LIMITS TABLE DECIDES, not a name. A row is a temperature when the range it
     * clamps against is declared in °C — which is one table, one spelling, and no list here
     * to fall out of date. A row with no limit falls back to its own declared unit.
     */
    function isTemperatureRow(row) {
        const limits = limitsNow();
        if (row.limit && limits && hasLimit(limits, row.limit)) return limits[row.limit].unit === '°C';
        return row.unit === '°C';
    }

    /**
     * A number formatter for a converted temperature, memoised by its decimal count.
     *
     * BEN'S RULE, VERBATIM: "rounding to same decimal place as the original value." The
     * original is the machine's own number and its precision is its STEP — a band that
     * steps by 1 °C has no tenths to show, and 321.8 °F on a control whose Celsius face
     * reads 161 is a precision the machine does not have. So the Fahrenheit face is
     * rounded to the Celsius step's decimals: 322.
     *
     * MEMOISED BECAUSE lit COMPARES PROPERTIES BY IDENTITY. A closure built fresh in the
     * join would be a new object every frame, so `.format` would be written on every
     * render even when nothing about it had changed — the same trap the live-reading
     * formatters in `settings-leaf.js` are memoised against, one layer up.
     */
    const tempFormatters = new Map();
    function tempFormatter(decimals) {
        if (!tempFormatters.has(decimals)) {
            tempFormatters.set(decimals, (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return String(value);
                return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
            });
        }
        return tempFormatters.get(decimals);
    }

    /** The unit to CONVERT INTO for this row, or null when nothing should move. */
    function displayUnitFor(row) {
        if (!isTemperatureRow(row)) return null;
        const unit = tempUnitNow();
        return unit === TEMP_UNIT.FAHRENHEIT ? unit : null;
    }

    /** The hint beside a label. A STRING the screen composed — #29 owns no range table. */
    function hintFor(row, variant = null) {
        const limits = limitsNow();
        if (!row.limit || !limits || !hasLimit(limits, row.limit)) return '';
        /* ONE CALL, AND NO SENTENCE ASSEMBLED HERE. Assembling one is what this function
         * used to do, and is why it is now a single expression.
         *
         * A VARIANT'S UNIT WINS OVER THE TABLE'S, and it has to, or one row prints two
         * units at once. MEASURED on the hot-water leaf, 26 August 2026: with the stop
         * mode set to weight the heading read "Weight", the stepper read "0 g" — and the
         * hint beside them read "0-255 mL · 0 = no volume cap", because the hint came
         * straight off the `hotWaterVolume` limits row, which is in millilitres. ONLY THE
         * WORD CHANGES: the machine holds ONE field for the two modes and the numbers do
         * not move between them (a millilitre of water weighs a gram, which is why the
         * machine can hold one field at all).
         *
         * THE BAND IS SHOWN IN THE UNIT THE VALUE IS SHOWN IN, or the label contradicts
         * the control beside it. `displayUnitFor` answers null when nothing should move,
         * and `displayRangeHint` hands a null unit straight through to the table's own
         * row — so there is no branch here on whether a conversion applies, and the
         * Celsius and Fahrenheit faces of a band cannot be two different sentences.
         *
         * WHAT WENT: this used to ask `rangeHint` for the sentence with its unit
         * suppressed, SPLIT THE RESULT ON THE MIDDLE DOT to salvage the zero-meaning
         * clause, and re-join it around the variant's word — in two branches, twice over.
         * That made this file a THIRD author of the sentence's shape, and the second one
         * had already drifted from the first (see `displayRangeHint`, which went on
         * printing a clause `rangeHint` had stopped printing). `bandHint` in
         * `machine-limits.js` is the only author of it now, and it reads both overrides
         * off the arguments below. */
        return displayRangeHint(limits[row.limit], displayUnitFor(row), variant?.unit
            ? { unit: variant.unit, zeroMeans: variant.zeroMeans }
            : undefined);
    }

    /** min / max / step / unit for a stepper. Absent limit -> unbounded, and it says so. */
    function boundsFor(row) {
        const limits = limitsNow();
        if (row.limit && limits && hasLimit(limits, row.limit)) {
            const range = limits[row.limit];
            /* THE FAHRENHEIT FACE OF THE SAME BAND. Everything the stepper is handed is in
             * the unit it draws; `next` and `clamp` convert back, do the machine's own
             * arithmetic against the machine's own table, and convert the answer forward.
             * The band, the holes and the step size are all still decided in one place. */
            const display = displayUnitFor(row);
            if (display) {
                const shown = displayRange(range, display);
                const inC = (value) => fromDisplayTemp(Number(value), display);
                const out = (celsius) => toDisplayTemp(celsius, display);
                return Object.freeze({
                    min: shown.min,
                    max: shown.max,
                    step: shown.step,
                    unit: shown.unit,
                    bounded: true,
                    /* THE HOLE TRAVELS WITH THE BAND, converted (audit F-021). The stepper
                     * ignores it — it has `next`, which walks through the hole on purpose —
                     * but the KEYPAD over the same row must know the band it prints is not
                     * the band its `clamp` would accept, or a below-floor number gets
                     * silently snapped to the off value. `displayRange` converts `floor`
                     * along with the two bounds; `padBand` is what spends it. */
                    floor: shown.floor,
                    /* THE SAME DECIMAL PLACES THE CELSIUS FACE HAS. Without this the
                     * stepper takes its precision from the STEP, and a 1 °C step is 1.8 °F
                     * — so every value would print a tenth the machine cannot hold.
                     *
                     * IT IS ALSO A NUMBER AND NOT ONLY A FORMATTER, because the numpad
                     * needs the COUNT rather than the printing: it decides whether the
                     * decimal key is live and how many characters the buffer may hold, and
                     * it cannot ask a closure either question. A keypad left to infer the
                     * count from a converted step would read 1.8 as fractional and offer a
                     * decimal point on a band that steps by a whole machine degree. */
                    decimals: shown.decimals,
                    format: tempFormatter(shown.decimals),
                    /* THE MACHINE'S OWN ARITHMETIC, against the machine's own table. In,
                     * step or clamp, out — so every hole in every band still works and the
                     * conversion never touches the rule. */
                    next: (value, direction) => out(stepLimit(limits, row.limit, inC(value), direction)),
                    clamp: (value) => out(clamp(limits, row.limit, inC(value))),
                });
            }
            return Object.freeze({
                min: range.min,
                max: range.max,
                step: range.step,
                unit: range.unit ?? '',
                bounded: true,
                /** The hole, where the row has one — the keypad's, not the stepper's. See
                 *  the converted branch above for why it is carried. */
                floor: range.floor,
                /** THE MACHINE'S OWN PRECISION, which for an unconverted band is simply
                 *  what its step carries. Derived rather than restated so the two branches
                 *  of this function answer the same question the same way. */
                decimals: decimalsForStep(range.step),
                /** Only a converted temperature needs one; the rest print their own step. */
                format: null,
                /* THE STEP FUNCTION, which is the other half of B2 and the only way a
                 * hole in a range survives contact with a plus button: stepping down
                 * from the bottom of the steam band lands on 0 (off), not inside the
                 * hole. `ui-stepper` takes it as a property; nothing here re-implements
                 * it and nothing here knows which ranges have holes. */
                next: (value, direction) => stepLimit(limits, row.limit, value, direction),
                clamp: (value) => clamp(limits, row.limit, value),
            });
        }
        /* AN UNBOUNDED ROW STILL HAS A UNIT, AND THE UNIT STILL FOLLOWS THE PREFERENCE.
         *
         * `accessories-cup-warmer-now` is the first row of this shape: a READING with no
         * band — nothing sets it, so there is nothing to clamp against and a `limit` would
         * be the second ranges table by another route — and a unit that must convert. It is
         * what `isTemperatureRow` falls through to (`row.unit === '°C'`), a branch no row
         * exercised until this one, and without the symbol moving with the value the page
         * printed "91.0 °C" beside a Target stepper reading "140 °F".
         *
         * `min`/`max`/`step` STAY NULL. Nothing here invents a band to have something to
         * convert — B2's "unstated is unbounded, null, not a number this file picked". */
        const display = displayUnitFor(row);
        return Object.freeze({
            min: null,
            max: null,
            step: null,
            unit: display ? unitSymbol(display) : (row.unit ?? ''),
            bounded: false,
            /** No band, no step, no precision to state. Null, never a number picked here. */
            decimals: null,
            next: null,
            clamp: null,
            format: null,
        });
    }

    /**
     * The value a row shows: the staged intent, else what the machine served, else the
     * decided fallback.
     *
     * THE ORDER IS THE WHOLE OF IT. A staged edit is what the user just did and must win
     * over everything. The machine's own answer comes next, because the machine holds the
     * value and is the truth teller (O2). Only when the machine has not answered — asleep,
     * unreachable, or a machine that does not carry the setting — does the fallback show,
     * and it is a value Ben decided rather than one this file invented
     * (settings-defaults.js).
     *
     * A FALLBACK NEVER OVERWRITES A SERVED VALUE, which is why `has` is asked rather than
     * whether the value is falsy: a machine that genuinely serves 0 must show 0, not the
     * fallback. That distinction is the reason MACHINE_FALLBACKS is a separate table from
     * STORED_DEFAULTS instead of one merged map.
     */
    /**
     * A MACHINE-SOURCED NUMBER, AT THE ROW'S OWN PRECISION — the read half of the rule
     * `step()` already applies to the write half. (Audit F-046, 29 August 2026.)
     *
     * THE DEFECT, MEASURED ON THE TABLET. The skin sent `{"heaterPh1Flow":4.1}`; ReaPrime
     * stored `4.1000000000000005`; the row then printed **`4.1000000000000005mL/s`**. No
     * layer between the wire and the glass rounded, and `ui-stepper`'s display rule is
     * "never fewer digits than the value actually has" — correct for a component that is
     * told nothing about the quantity, and exactly wrong for seventeen digits of float
     * residue.
     *
     * IT IS THE STEP'S DECIMALS, NOT THE STEP'S MULTIPLES, and the difference matters: a
     * row stepping by 0.05 whose machine holds 0.33 must go on reading 0.33, not snap to
     * 0.35. Rounding to the DECIMAL COUNT the step declares removes float residue and
     * nothing else — `machine-limits.js`'s `step()` computes its own arithmetic the same
     * way (`Number((current + delta).toFixed(decimals))`), so the read path and the write
     * path now answer at one precision instead of two.
     *
     * A ROW WITH NO DECLARED LIMIT IS LEFT ALONE. There is no step, so there is no stated
     * precision, and rounding to a number this function picked would be B2's defect wearing
     * a formatter. The value is handed back untouched — identity included, so nothing that
     * is not a finite number is coerced on the way past.
     *
     * TWO ROWS IT MUST NOT TOUCH, and both are the difference between a fix and a bug:
     *
     *   A CONVERTED TEMPERATURE ALREADY HAS A FORMATTER. `boundsFor` gives every Fahrenheit
     *   face `format: tempFormatter(shown.decimals)`, so residue never reaches the glass
     *   there and this rounding would only do harm: 300 °F is 148.9 °C, a legitimately
     *   fractional Celsius on a band that steps by a whole degree, and rounding it to 149
     *   would draw 300.2 °F back at somebody who typed 300. MEASURED — that is exactly what
     *   the first version of this function did to `settings-leaves.render.test.mjs`'s
     *   "a number typed on the pad is clamped against the band the pad SHOWED".
     *
     *   A STAGED EDIT IS THE USER'S OWN NUMBER and wins over everything, which is the
     *   ordering rule stated above this function. Rounding what somebody just typed is not
     *   removing residue, it is overruling them.
     *
     * So this only ever touches what the MACHINE served, on a row that prints its number
     * raw. It rounds in the machine's own unit, which is the only unit it ever sees.
     */
    function atRowPrecision(row, value) {
        const limits = limitsNow();
        if (!row.limit || !limits || !hasLimit(limits, row.limit)) return value;
        const n = Number(value);
        if (!Number.isFinite(n)) return value;
        const rounded = Number(n.toFixed(decimalsForStep(limits[row.limit].step)));
        return Object.is(rounded, n) ? value : rounded;
    }

    /** True when this row's number is the user's own staged intent rather than a read. */
    function isStagedEdit(row) {
        return row.source === SOURCE.MACHINE && !row.derivedFrom && staged.has(row.field);
    }

    function valueFor(row) {
        const raw = heldValueFor(row);
        const held = (displayUnitFor(row) || isStagedEdit(row)) ? raw : atRowPrecision(row, raw);
        /* A MACHINE FIELD THE PAGE SPELLS AS WORDS. `stopHotWaterAtWeight` is a boolean on
         * ReaPrime's own settings document and the control is a two-cell bank, so the row
         * carries the map between them and it is read in BOTH directions — here on the way
         * out and in `set()` on the way in. A second hand-written direction is how a value
         * comes to be read from one spelling and written as another. */
        if (row.fieldValues) return itemValueOf(row, held);
        /* THE ONE PLACE A TEMPERATURE BECOMES FAHRENHEIT. Everything above this line —
         * the staged Map, the machine document, the fallback table — is Celsius, and
         * `set()` converts back before any of them sees a number again. */
        const display = displayUnitFor(row);
        if (display && Number.isFinite(Number(held))) return toDisplayTemp(Number(held), display);
        return held;
    }

    /** The item value a held machine value names, or undefined when the machine is silent. */
    function itemValueOf(row, held) {
        if (held === undefined || held === null) return undefined;
        for (const [item, machineValue] of Object.entries(row.fieldValues)) {
            if (machineValue === held) return item;
        }
        return undefined;
    }

    /** The value as the machine holds it, in the machine's own unit. */
    function heldValueFor(row) {
        if (row.source === SOURCE.MACHINE) {
            /* A BANK THAT IS A VIEW OVER SEVERAL FIELDS ANSWERS FROM ALL OF THEM. See
             * `derivedValueFor` — the row names no single `field`, so there is nothing for
             * the three lines below to look up. */
            if (row.derivedFrom) return derivedValueFor(row);
            if (staged.has(row.field)) return staged.get(row.field);
            if (machineValues.has(row.field)) return machineValues.get(row.field);
            return machineFallbackFor(row.field);
        }
        if (row.source === SOURCE.ROUTE) {
            /* THE PANEL ANSWERS FIRST WHEN IT HAS ANSWERED AT ALL. O2's rule — where a
             * setting configures something outside this skin, that thing is the truth
             * teller — applied to the one owner this model had no seam for. `undefined`
             * means no frame has arrived, and only then does the stored preference speak. */
            if (row.panel && panel) {
                const served = PANEL_SETTINGS[row.panel]?.read(panel);
                if (served !== undefined) return served;
            }
            return settings.value(row.key);
        }
        return undefined;
    }

    /** One machine field, staged edit first — the lookup `heldValueFor` does, by name. */
    function fieldNow(field) {
        if (staged.has(field)) return staged.get(field);
        if (machineValues.has(field)) return machineValues.get(field);
        return machineFallbackFor(field);
    }

    /**
     * The number to put back when a stop is armed again.
     *
     * WHAT THE MACHINE ALREADY HOLDS WINS, exactly as `zeroSwitch` restores a remembered
     * temperature rather than a decided one: a person who set a 90 s steam and switched to
     * Off gets 90 s back, not the shipped default. Zero is not a value to come back to — it
     * IS the off state — so it falls through to `MACHINE_FALLBACKS`, which is where Ben's
     * "Time at 60 s" and Slate's own 60 °C milk target are written down with their
     * provenance.
     *
     * AND THEN THE DECLARED BAND'S FLOOR, which is the case the milk probe needs. There is
     * no fallback for `stopAtTemperature`: Ben was never asked for a milk temperature and
     * the machine holds none until somebody sets one, so A7 says the STEPPER shows the dash
     * — but arming the mode still has to write a number, and zero is the one number that
     * means "not armed". The lowest value the control offers is the honest choice: it is in
     * band by construction, it is the smallest thing the arming can be, and the stepper
     * directly below it is where the person changes it. The band is `machine-limits.js`'s,
     * found through the row that declares it, so no number is typed here or in the registry.
     *
     * A FIELD WITH NONE OF THE THREE STAGES ZERO rather than `undefined`: a patch key with
     * no value is a key the door would post as null.
     */
    function restoreValueFor(row, field) {
        const held = Number(fieldNow(field));
        if (Number.isFinite(held) && held > 0) return held;
        const fallback = Number(machineFallbackFor(field));
        if (Number.isFinite(fallback) && fallback > 0) return fallback;
        const floor = Number(bandFloorFor(row, field));
        return Number.isFinite(floor) && floor > 0 ? floor : 0;
    }

    /** The bottom of the band the leaf's own control for `field` offers, or undefined. */
    function bandFloorFor(row, field) {
        const owner = rowsForLeaf(row.leaf).find((other) => other.field === field && other.limit);
        const limits = limitsNow();
        if (!owner || !limits || !hasLimit(limits, owner.limit)) return undefined;
        return limits[owner.limit].min;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * A CHOICE THE MACHINE HOLDS AS SEVERAL NUMBERS, DERIVED RATHER THAN STORED
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Ben, 26 August 2026 (O3): "the current option should always be shown as selected,
     * READ FROM THE MACHINE." Some choices the machine has no single field for. Steam stop
     * is the one that forced this: the DE1 stops steaming on a TIMER
     * (`steamSettings.duration`) or on the MILK PROBE (`steamSettings.stopAtTemperature`)
     * or on neither, and the mode is which of those two numbers is non-zero. ReaPrime's own
     * `steam_sequencer.dart:134-140` reads it exactly that way — it returns immediately when
     * `stopAtTemperature <= 0`.
     *
     * WHAT THIS REPLACES IS THE DEFECT. The bank was `source: ROUTE` over a local key, so
     * choosing an option wrote a string to the tablet and NOTHING reached the machine. All
     * three options were false: "Off", whose caption promises "Steam runs until you stop
     * it", left the machine stopping on its timer; "Milk Temp" did not arm the probe.
     *
     * `derivedFrom` IS AN ORDERED LIST AND THE ORDER IS THE PRECEDENCE, not the display
     * order: the first field holding a positive number names the mode. `whenNone` is the
     * answer when they are all zero, which is a real state and not an absence.
     *
     * ABSENCE STILL SURVIVES (A7): if not one of the fields has an answer — no machine, no
     * fallback — the row resolves to `undefined` and the bank draws no selection, rather
     * than claiming the machine is in the `whenNone` state.
     */
    function derivedValueFor(row) {
        let anyKnown = false;
        for (const { field, is } of row.derivedFrom) {
            const value = fieldNow(field);
            if (value === undefined || value === null) continue;
            anyKnown = true;
            if (Number(value) > 0) return is;
        }
        return anyKnown ? row.whenNone : undefined;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * PER-ITEM GATING — an option the machine cannot honour is drawn and refused
     * ═══════════════════════════════════════════════════════════════════════
     *
     * A ROW-LEVEL `capability` HIDES THE WHOLE CONTROL, which is right when the control is
     * about a thing the machine does not have. It is wrong when ONE OPTION of several is:
     * hiding the row would take the working options with it, and leaving the option
     * offered is how a page comes to promise something that cannot happen. Ben stated the
     * rule for the hot-water half on 26 August 2026 — "weight grayed out if no scale is
     * connected and volume selected" — and `ui-bank` has painted per-item `disabled` since
     * it was built; nothing was passing one.
     *
     * TWO DOORS, BECAUSE REAPRIME HAS TWO. `capability` asks the served array (the seven
     * `de1handler.dart` puts in it); `sensor` asks an R3 adapter over the same array
     * through `settings.gateSensor`. `live-wiring.js` makes the same split for the same two
     * options on the Live rail, so the two surfaces ask one question per offer.
     *
     * FAIL-CLOSED, WHICH IS THE STORE'S RULE AND NOT A SECOND ONE: ABSENT and UNKNOWN both
     * disable. A machine whose capability read has not landed is not a machine with a probe.
     */
    function itemsFor(row) {
        const items = row.items ?? null;
        if (!items) return null;
        if (!items.some((item) => item.capability || item.sensor)) return items;
        return Object.freeze(items.map((item) => {
            if (!item.capability && !item.sensor) return item;
            const gate = item.sensor
                ? settings.gateSensor(item.sensor)
                : settings.gateCapability(item.capability);
            return Object.freeze({ ...item, disabled: gate.surface !== 'shown' });
        }));
    }

    /**
     * The value a bank shows, once a disabled option cannot be the answer.
     *
     * Ben's whole hot-water rule, 26 August 2026: "Weight for Bengle, Weight for the DE1
     * [if a] scale is connected, weight grayed out if no scale is connected and volume
     * selected." The last clause is this function. Without it a tablet with no scale
     * defaulted to Weight, offered Weight ungreyed, and a pour started that way had no stop
     * at all — which is the concrete cost the audit measured.
     *
     * `unavailable` NAMES THE FALLBACK OPTION and the row states it, so the answer is data
     * rather than a branch keyed on a row id. A row without one keeps the disabled value:
     * showing the machine's real state is still better than substituting one.
     */
    function resolveDisabled(row, items, value) {
        if (!items || row.unavailable === undefined) return value;
        const chosen = items.find((item) => String(item.value) === String(value));
        return chosen && chosen.disabled ? row.unavailable : value;
    }

    /**
     * THE VALUE THE PAGE IS ACTUALLY SHOWING, which is what every other row must reason
     * about. `valueFor` answers what is held; this answers what is SELECTED, after a
     * disabled option has fallen back. The distinction matters as soon as one row gates on
     * another: with no scale the hot-water bank shows Volume, so the stop-lookahead row
     * below it must read inert — gating on the held Weight would leave a live control
     * beside a mode nobody can choose.
     */
    function resolvedValueFor(row) {
        return resolveDisabled(row, itemsFor(row), valueFor(row));
    }

    /**
     * What the control shows for a switch.
     *
     * `invert` HAS NO USER TODAY AND THE FIELD SURVIVES, which is worth stating because
     * this codebase deletes mechanisms with no callers. It read a stored `true` as an OFF
     * control, and its one row — "Show help button" over `helpHidden` — was deleted on 26
     * August 2026 with the floating button it never had. The field stays for two reasons:
     * it costs one boolean read on a path that already reads the row, and the alternative
     * when the next inverted key arrives is a per-leaf branch, which is how two leaves come
     * to disagree about what true means. If it is still unused when the registry next
     * settles, delete it and the two lines that read it.
     *
     * A `zeroSwitch` ROW IS NOT A BOOLEAN AND IS NOT STORED. It is a view over a machine
     * field whose zero means "off" — the steam target temperature, the tank temperature —
     * so "on" is "the machine holds something other than zero". Boolean(0) already
     * answers that, but saying it in its own branch is what keeps the next reader from
     * adding a stored flag beside the field and giving the page two answers.
     */
    function checkedFor(row) {
        const value = valueFor(row);
        if (row.zeroSwitch) return Number(value) > 0;
        if (value === undefined) return false;
        return row.invert ? !value : Boolean(value);
    }

    /** A positive number, or undefined. Every rung of the ladder below is filtered by it. */
    function positiveNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : undefined;
    }

    /**
     * WHAT A MASTER SWITCH COMES BACK TO — five rungs, in the order Ben settled on 30
     * August 2026 (decision D09, from audit F-049's third face).
     *
     * THE RUNGS, and each one is a different question:
     *
     *   1. THE STAGED MEMORY. Off-then-on inside one band comes back to the number the off
     *      remembered, not the one a previous session left behind. Same staged-then-held
     *      order every other read in this file uses.
     *   2. THE STORED MEMORY, ALONE. `settings.storedValue()`, not `settings.value()` —
     *      the stored number with NO default behind it. This is where the defect was: the
     *      old ladder called `value()`, and an absent kv key is not absent to the settings
     *      store, so `STORED_DEFAULTS` answered in the same shape as a real memory and the
     *      two rungs below it were unreachable.
     *   3. THE MACHINE'S OWN HELD SETPOINT, via the row's `heldField`. MEASURED, and it is
     *      the case D09 is about: a warmer holding `{"temperature":70,"enabled":false}` —
     *      the real tablet's own closing state — switched on from the glass was written
     *      **60**, because `STORED_DEFAULTS.cupWarmerTarget = 60` answered first. **A real
     *      70 overwritten by a shipped 60, with no word on the glass.** Ben: the machine's
     *      held setpoint beats the shipped default. It sits BELOW the stored memory because
     *      a memory is what this skin was asked to remember and the machine's number is
     *      what it happens to be holding; where both exist the user's own last word wins.
     *   4. THE SHIPPED DEFAULT for the memory key — `STORED_DEFAULTS`, still consulted,
     *      just no longer first. It is a decided value with Ben's words beside it, and on a
     *      machine that has never been switched on it is the only number anybody has.
     *   5. `MACHINE_FALLBACKS` for the field, which is where the ladder always ended.
     *
     * EVERY RUNG MUST BE POSITIVE, because zero is not a temperature to come back to — it
     * IS the off state, and restoring it would turn the switch straight back off. That is
     * also what makes a staged FORGET (`null`) fall through rung 1 without a special case.
     */
    function restoreTargetFor(row) {
        if (stagedMemory.has(row.zeroSwitch)) {
            const staged1 = positiveNumber(stagedMemory.get(row.zeroSwitch));
            if (staged1 !== undefined) return staged1;
        }
        const stored = typeof settings.storedValue === 'function'
            ? positiveNumber(settings.storedValue(row.zeroSwitch))
            : undefined;
        if (stored !== undefined) return stored;

        if (row.heldField) {
            const held = positiveNumber(fieldNow(row.heldField));
            if (held !== undefined) return held;
        }

        const decided = positiveNumber(settings.value(row.zeroSwitch));
        if (decided !== undefined) return decided;

        return machineFallbackFor(row.field);
    }

    /**
     * The row that gates this one, or null. NAMED BY ROW ID, not by a storage key, so the
     * gate works the same whether the master switch is a machine field or a preference —
     * and so a page cannot gate on a key that has no control.
     */
    function masterFor(row) {
        if (!row.enabledBy) return null;
        const first = gatesOf(row)[0];
        return first ? gateMasterFor(row, first) : null;
    }

    /**
     * THE GATES ON A ROW, ALWAYS AS A LIST — because a row can have two of them.
     *
     * `enabledBy` was one gate for as long as every gated row had one master switch. The
     * steam page broke that on 26 August 2026: Duration is meaningful only while the steam
     * heater is ON *and* while the stop mode is Time, which is two conditions on one row and
     * neither of them optional. Writing it as an array is what lets both be stated; writing
     * the single form as an array of one is what keeps every existing row untouched.
     *
     * A ROW IS INERT IF ANY GATE SAYS SO. That is the only reading that composes: two gates
     * meaning "either will do" would make the second one incapable of disabling anything.
     */
    function gatesOf(row) {
        if (!row.enabledBy) return [];
        return Array.isArray(row.enabledBy) ? row.enabledBy : [row.enabledBy];
    }

    /** The row one gate names, or null. Gates name ROW IDS — see `masterFor`. */
    function gateMasterFor(row, gate) {
        const id = typeof gate === 'string' ? gate : gate.row;
        return rowsForLeaf(row.leaf).find((other) => other.id === id) ?? null;
    }

    /**
     * Is this row INERT — drawn, disabled, and reading as a dash?
     *
     * Ben, 26 August 2026, on the tank: "while it is off the settings below grey out and
     * read '−'". Inert is not hidden and it is not absent: the value is still real and is
     * still what the machine will use when the master is switched back on, so hiding it
     * would make the switch look as though it had deleted a setting.
     */
    /**
     * HAS THIS ROW'S SOURCE ANSWERED YET? (Audit F-042, 29 August 2026.)
     *
     * THE DEFECT, MEASURED TWICE ON THE TABLET. `machine-water-tank-unit` showed **mm** on
     * 7 of 9 immediate post-reload reads while the server and the app's own router already
     * held `"ml"`, correcting at about 8 s; Accessories › Cup Warmer booted with the
     * pre-warm switch reading FALSE, a dash and disabled controls for about 4 s while the
     * server held true and 30 minutes. In both cases the store was right and the first
     * paint was not.
     *
     * A FALLBACK IS NOT A READING, and this is the whole of the fix. `settings-store
     * .value()` answers `defaultFor(key)` when nothing is cached — correct once the read
     * has come back absent (Ben's O3: "the current option should always be shown as
     * selected"), and a lie while it is still in flight, because the two are the same
     * shape. The same is true of `machineFallbackFor` behind a machine field. Neither
     * store is wrong; what was missing is the question "has it answered?", and BOTH stores
     * could already answer it — `settings.isLoaded(key)` and `machineLoaded`.
     *
     * SO THE VALUE IS UNCHANGED AND ONLY ITS STANDING MOVES. `valueFor` still returns what
     * it always did; the row now says whether that is a reading or a placeholder, and the
     * renderer paints the placeholder as pending — disabled, dashed, asserting nothing —
     * instead of as an answer.
     *
     * A PANEL ROW IS NOT PENDING WHEN THE PANEL HAS SPOKEN: `heldValueFor` prefers the live
     * display frame over the stored preference, and a frame that has arrived is an answer
     * whether or not the kv read has come back.
     */
    function pendingFor(row) {
        if (row.source === SOURCE.MACHINE) {
            /* A DERIVED ROW READS SEVERAL FIELDS OF THE ONE DOCUMENT, so the document's own
             * state is the answer for it too. */
            return !machineLoaded;
        }
        if (row.source === SOURCE.ROUTE) {
            if (row.panel && panel && PANEL_SETTINGS[row.panel]?.read(panel) !== undefined) {
                return false;
            }
            return typeof settings.isLoaded === 'function' ? !settings.isLoaded(row.key) : false;
        }
        return false;
    }

    function inertFor(row) {
        /* THE MACHINE CAN VETO A ROW OUTRIGHT, and that is not the same question as a
         * master switch being off. `supportedBy` names a machine field that answers whether
         * the firmware can do this AT ALL — `cupWarmerPreheatSupported`, off the pre-heat
         * route's own 404. Only `false` is a verdict: an unanswered route is null, and the
         * rows stay live rather than accusing a machine of a fault before anybody has spoken
         * to it. See `unsupportedNoteFor` for the sentence that goes with it. */
        if (row.supportedBy && fieldNow(row.supportedBy) === false) return true;
        const gates = gatesOf(row);
        if (gates.length === 0) return false;
        return gates.some((gate) => gateSaysInert(row, gate));
    }

    /**
     * THE SENTENCES PRINTED UNDER A ROW — the option notes, and the firmware caveat.
     *
     * A NOTE USED TO BE AN ITEM'S ALONE, joined by the renderer straight off `view.items`.
     * That was right for the milk-probe note ("the note is present exactly when the option
     * is") and had nowhere to put a note about the ROW. The pre-warm pair needs one: Slate's
     * own sentence, printed whenever the firmware cannot pre-warm, which is the difference
     * between a greyed control and a greyed control that says why.
     *
     * THE MODEL DECIDES WHICH SENTENCES, THE RENDERER TRANSLATES THEM. Returning strings
     * rather than markup keeps D2 where it is — every visible string goes through `t()` at
     * render — and keeps this module DOM-free.
     */
    function notesFor(row) {
        const notes = (row.items ?? []).map((item) => item.note).filter(Boolean);
        if (row.unsupportedNote && row.supportedBy && fieldNow(row.supportedBy) === false) {
            notes.push(row.unsupportedNote);
        }
        /* AND A BANK THAT MATCHES NOTHING SAYS SO, WHICH IS A7 RATHER THAN A BREACH OF IT.
         *
         * A bank whose value names none of its items renders `value=''`, so no segment is
         * pressed and the control draws as a row of equal, unchosen keys. That is
         * INDISTINGUISHABLE FROM A BANK THAT FAILED TO RENDER, and the page says nothing
         * either way. The mains-voltage row is the case that forced this: `De1HeaterVoltage`
         * has a third member, `unset(-1)` (`de1_interface.dart:111`), and a machine nobody
         * has told answers -1 — a real and shipping state, not an error.
         *
         * NAMING AN ABSENCE IS WHAT A7 ASKS FOR. The rule forbids INVENTING a value — the
         * bank must not pre-select 110V because most supplies are one or the other — and it
         * requires the absence be visible rather than silent. A dash is how a reading says
         * it; a sentence is how a control says it, because the reader's next question is
         * "what do I do about it" and a dash cannot answer that.
         *
         * SLATE HAD THIS AND Decal DROPPED IT (`settings.js:5138`, `unsetNote`). On this
         * page in particular the cost of leaving it unset is a heater running on the wrong
         * assumption, which is the one thing the row's own caption warns about.
         *
         * MATCHED THE WAY THE CONTROL MATCHES — `String(a) === String(b)` — because the
         * value crosses to #3 as an ATTRIBUTE and comes back as a string. Comparing any
         * other way here would put a note on screen beside a segment that is lit. An INERT
         * row is excluded: it is disabled and dashed by its master switch, which is a
         * different absence with its own explanation already on the page. */
        if (row.emptyNote && row.archetype === ARCHETYPE.BANK && !inertFor(row)) {
            const value = resolvedValueFor(row);
            const items = itemsFor(row) ?? [];
            const matched = value !== undefined && value !== null
                && items.some((item) => String(item.value) === String(value));
            if (!matched) notes.push(row.emptyNote);
        }
        return Object.freeze(notes);
    }

    /** One gate's verdict. THREE SPELLINGS, and each one is a question a page had to ask. */
    function gateSaysInert(row, gate) {
        const master = gateMasterFor(row, gate);
        if (master === null) return false;
        /* A GATE ON A VALUE, NOT ONLY ON A SWITCH. `enabledBy: 'row-id'` asks whether the
         * master switch is on; `enabledBy: {row, value}` asks whether a CHOICE row holds
         * a particular value — which is what the screen saver needs, where the cycle
         * interval is only meaningful while the type is Image. One field, two spellings,
         * so a page does not need a second mechanism to say the same kind of thing. */
        if (typeof gate === 'object' && Object.hasOwn(gate, 'value')) {
            return resolvedValueFor(master) !== gate.value;
        }
        /* AND THE NEGATED FORM, `{row, not}`, which the USB charger page needed. ReaPrime's
         * `charging_logic.dart:123-129` returns early on `ChargingMode.disabled` with
         * `nightPhase: inactive` BEFORE it looks at the night-mode config at all — so with
         * Battery Saver off, Night mode and its two times change nothing on the machine.
         * Slate renders that whole section only when `chargingMode !== 'disabled'`
         * (settings.js:1643) and was right to. A setting that does nothing is the defect
         * this fork exists to remove; `not` is how a row says which value kills it. */
        if (typeof gate === 'object' && Object.hasOwn(gate, 'not')) {
            return resolvedValueFor(master) === gate.not;
        }
        return !checkedFor(master);
    }

    /**
     * The caption, which on some rows follows the SELECTION rather than the row.
     *
     * Slate's steam-stop block does this (`settings.js:3217-3221 stopDescriptions`) and
     * Ben asked for it: "What ends a steam session" says what the setting is FOR, and the
     * per-option sentence says what the current choice DOES. The row's own caption is the
     * fallback, so an unset value still reads.
     */
    function captionFor(row) {
        if (!row.captions) return row.caption ?? '';
        /* THE SENTENCE FOLLOWS WHAT IS SHOWN, not what is held: a bank whose selection has
         * fallen back off a disabled option must not keep describing the option it fell
         * off. */
        const value = resolvedValueFor(row);
        const found = value === undefined || value === null ? undefined : row.captions[value];
        return found ?? row.caption ?? '';
    }

    /**
     * The heading, which on ONE row so far follows another row's value.
     *
     * `machine-hot-water-volume` is one machine field read two ways: the stop mode decides
     * whether the number is millilitres or grams. `variesWith` names the ROUTE KEY that
     * decides and `variants` keys on its value, so the heading and the unit move together
     * and neither is spelled twice. An unrecognised value falls through to the row's own.
     */
    function variantFor(row) {
        if (!row.variesWith || !row.variants) return null;
        /* AND IT MAY NAME A ROW RATHER THAN A KEY, which is what `enabledBy` has always
         * done and for the same argument: "NAMED BY ROW ID, not by a storage key, so the
         * gate works the same whether the master switch is a machine field or a preference".
         * The hot-water stop mode moved to a machine field on 26 August 2026 and this row
         * had to follow it there; naming the row means it never has to be moved again. */
        const value = typeof row.variesWith === 'object'
            ? valueOfRow(row, row.variesWith.row)
            : settings.value(row.variesWith);
        return (value !== undefined && value !== null && row.variants[value]) || null;
    }

    /** The joined value of another row on the same leaf, or undefined. */
    function valueOfRow(row, id) {
        const other = rowsForLeaf(row.leaf).find((candidate) => candidate.id === id);
        return other ? resolvedValueFor(other) : undefined;
    }

    /**
     * THE LIVE READING, and only for a row that has no control.
     *
     * #29's `reading` is untyped on purpose and its three outcomes are already decided by
     * the component: unset renders NO element, an absence renders the dash, a value
     * renders. So this returns `undefined` for every row whose control shows the value
     * (a stepper showing 92 does not also need "92" printed above it), and for a READING
     * row it returns the empty string when nothing is stored — which is the attribute
     * form of an absence and renders the dash, never a blank.
     *
     * A stored object counts its entries rather than stringifying: `keyboardBindings` is
     * a map, and "[object Object]" is the failure mode this fork exists to avoid.
     */
    function readingFor(row) {
        /* A ROW WITH A CONTROL CAN STILL HAVE A READING, and `calibration-voltage-mains`
         * is the first: the measured mains is EVIDENCE for the choice the bank makes, not
         * the choice itself (Slate's P18, quoted at the row). `readingField` names a
         * machine field that no control on the page writes, so the value arrives with the
         * rest of the machine document and an unanswered machine reads as an absence —
         * the dash — rather than as a zero volts nobody measured. */
        if (row.readingField) {
            const value = machineValues.has(row.readingField)
                ? machineValues.get(row.readingField)
                : undefined;
            return value === undefined || value === null ? '' : value;
        }
        if (row.archetype !== ARCHETYPE.READING) return undefined;
        const value = valueFor(row);
        if (value === undefined || value === null || value === '') return '';
        if (typeof value === 'object') return Object.keys(value).length;
        return value;
    }

    /**
     * THE ROWS OF A LEAF THAT EXIST ON THIS MACHINE — the registry's list, minus anything
     * whose `machines` list does not name the connected class.
     *
     * NOT A SURFACE, AN ABSENCE, and the distinction is worth the paragraph. A `capability`
     * gate answers "this machine has not told us it can do this", which is provisional: the
     * verdict can be UNKNOWN, it fails closed, and the row exists in `allRows` so the A3
     * suite can see what was hidden and why. A `machines` gate answers something else
     * entirely — the setting does not apply to this hardware at all — and there is no
     * verdict to report, no capability to name and nothing for a person to fix. So such a
     * row is filtered out at the SOURCE and every consumer below sees a leaf that simply
     * does not have it, exactly as if the registry had never declared it here.
     *
     * WHICH CONSUMERS. Everything that answers "what is on this page": `rows`, `allRows`,
     * `navSummary`, `load`. NOT the three sibling look-ups (`restoreValueFor`'s limit owner,
     * `gateMasterFor`, `valueOfRow`), which ask "what does the row with this id hold" rather
     * than "what does this page show" — a value is still a value, and a master switch
     * resolving to null because it was filtered would leave its dependents reading as
     * ungated rather than as inert. No row is both a master and machine-gated today; when
     * one is, that is the paragraph to re-read.
     *
     * THE WRITE PATH IS GUARDED SEPARATELY, in `set()`. Filtering the read side stops a
     * control being drawn; only the write check stops a stale one posting.
     */
    function rowsHere(leafId) {
        const machineClassHere = machineClassNow();
        return rowsForLeaf(leafId).filter((row) => rowShownOn(row, machineClassHere));
    }

    /**
     * One row, joined. The shape `<settings-leaf>` renders and the shape the tests read.
     *
     * `surface` is A3's verdict for a ROUTE row and always shown for the others: a
     * machine field is gated by whether the machine answered at all, which is the read's
     * business, not a capability's.
     */
    function viewFor(row) {
        /* A3, AND THE ROW MAY NAME ITS OWN CAPABILITY.
         *
         * A ROUTE row's gate is the routing table's answer for its key. A MACHINE row has
         * no row in that table, so before 26 August 2026 it was ungated by construction —
         * fine while every gated control happened to be a stored preference, and a silent
         * hole the moment one moved. The cup-warmer rows moved that day.
         *
         * `capability` ON THE ROW is checked FIRST and for either source, so a gate is a
         * property of the control rather than a side effect of where its value is kept.
         * The verdict function is the settings store's, so fail-closed is still decided in
         * one place. */
        const gate = row.capability
            ? settings.gateCapability(row.capability)
            : (row.source === SOURCE.ROUTE
                ? settings.gate(row.key)
                : { surface: 'shown', capability: null, verdict: null });
        const variant = variantFor(row);
        const bounds = boundsFor(row);
        const items = itemsFor(row);
        return Object.freeze({
            row,
            id: row.id,
            archetype: row.archetype,
            heading: variant?.heading ?? row.heading,
            caption: captionFor(row),
            hint: hintFor(row, variant),
            bounds: variant?.unit
                ? Object.freeze({ ...bounds, unit: variant.unit })
                : bounds,
            /**
             * THE SAME BAND WITH ITS HOLE SPENT — what a NUMERIC PAD over this row may
             * accept, as against what the stepper may walk through. (Audit F-021.)
             *
             * TWO BANDS FOR ONE ROW, AND THE DIFFERENCE IS THE GESTURE. Stepping down past
             * `steamTemp`'s floor to zero is a real thing a person does and watches happen
             * — the row blanks, the switch above it flips — so `bounds` keeps `min: 0`.
             * TYPING 63 is not that gesture: it looks like setting a temperature, and the
             * clamp behind it turned it into `targetTemperature: 0` with nothing on the
             * glass to say so. So the pad is handed the working band and refuses the hole.
             *
             * COMPOSED HERE RATHER THAN AT THE SCREEN because `settings-screen.js` may
             * import no limits module (`settings-skeleton.test.mjs`, "no store, no
             * endpoint, no limit"), and because `padBand` is the ONE place a hole is spent.
             * Identical to `bounds` for every row without one.
             */
            padBounds: padBand(variant?.unit
                ? Object.freeze({ ...bounds, unit: variant.unit })
                : bounds),
            value: resolvedValueFor(row),
            reading: readingFor(row),
            checked: checkedFor(row),
            items,
            /** Drawn, but disabled and dashed: its master switch is off. */
            inert: inertFor(row),
            /**
             * Drawn, but asserting nothing: this row's source has not answered yet.
             *
             * A SEPARATE FLAG FROM `inert`, and the difference is what each one MEANS.
             * `inert` says the machine holds a value and this control is switched off;
             * `pending` says nobody knows what the value is. Collapsing them would let a
             * page explain a wait with a master switch's sentence. The RENDERING is the
             * same — disabled and dashed — because A7's answer to both is the same: draw
             * no number you cannot stand behind.
             */
            pending: pendingFor(row),
            /** The sentences printed under the row — option notes, and any firmware caveat. */
            notes: notesFor(row),
            /** The live machine channel this row shows beside its value, or null. */
            live: row.live ?? null,
            staged: row.source === SOURCE.MACHINE && staged.has(row.field),
            surface: gate.surface,
            capability: gate.capability,
            verdict: gate.verdict,
        });
    }

    return {
        /** Fires on every staged change, every write and every load. One subscription. */
        subscribe: (listener) => beacon.subscribe(listener),

        /** D11's number, and nothing else crosses that boundary. */
        get changeCount() { return staged.size; },

        /** True once the machine document has been read (or has failed to read). */
        get machineLoaded() { return machineLoaded; },

        /**
         * What the machine holds for ONE field — the staged edit if there is one, else the
         * machine's own answer, else undefined.
         *
         * NO FALLBACK. `valueFor` above ends in `machineFallbackFor`, which is right for a
         * CONTROL: a page has to show something. This is for a caller asking what the
         * machine actually says, and the honest answer to "the machine has not told us" is
         * nothing — the reset page prints a dash there rather than a decided default
         * dressed up as the machine's current value.
         */
        machineValue(field) {
            if (staged.has(field)) return staged.get(field);
            return machineValues.has(field) ? machineValues.get(field) : undefined;
        },

        /**
         * The staged machine patch, as data — for a test and for the commit.
         *
         * NAMED `pendingPatch`, NOT `pending`. It used to be `get pending()`, one key
         * above `pending: (leafId) => …` in this same object literal — a duplicate key,
         * so the later definition won and this getter was unreachable from the moment it
         * was written. Two documented API members, one silently gone, and no test caught
         * it because nothing read either. The two are not the same quantity and must not
         * share a name: this is what the USER has staged, `pending(leafId)` is what the
         * REGISTRY declared and nobody built.
         */
        get pendingPatch() { return Object.freeze(Object.fromEntries(staged)); },

        /**
         * Every VISIBLE row of a leaf, joined and in registry order.
         *
         * A gated row whose capability is not PRESENT is not in this list at all. That is
         * fail-closed as a shape rather than as a flag: there is no disabled control to
         * reason about, nothing to tab to, and nothing to screenshot.
         */
        rows(leafId) {
            return rowsHere(leafId).map(viewFor).filter((view) => view.surface === 'shown');
        },

        /**
         * Including the CAPABILITY-hidden ones — for the A3 test, which has to see what
         * was hidden and which verdict hid it.
         *
         * IT DOES NOT INCLUDE A ROW THAT IS NOT ON THIS MACHINE, and that is not an
         * oversight. A3 is about a machine that has not answered; a `machines` gate is
         * about a setting that does not exist here, which has no verdict to inspect. See
         * `rowsHere` for the full argument.
         */
        allRows(leafId) {
            return rowsHere(leafId).map(viewFor);
        },

        /**
         * ONE HEADLINE SCALAR FOR A LEAF'S NAV ROW, or null wherever there is not one.
         *
         * SLATE'S S20, AND SLATE WROTE DOWN WHY IT EXISTS: "Confirming what the machine is
         * set to cost six taps and six page loads" (`settings.js:6367-6382`). The data is
         * already here — every value on every leaf is one `viewFor` away — and Decal
         * rendered a bare label. That is a half with no other half, and this is the half.
         *
         * IT IS NOT D11. D11 governs what a SCREEN tells the commit band ("the count and
         * nothing else"); this is a nav row saying what a page it is not on holds. Different
         * channel, different question, no rule crossed.
         *
         * READ FROM THE PENDING STATE, WHICH IS SLATE'S OWN RULE AND THE LOAD-BEARING HALF.
         * `viewFor` resolves staged-then-machine, so a nav row AGREES with an unsaved Save
         * rather than contradicting it: stage 110V, and the row beside the page says 110V
         * before the write goes out. A summary read off the machine document would say
         * "220V" next to a control showing 110V, which is worse than no summary.
         *
         * NOMINATED BY THE ROW, so no second table exists. `navSummary: true` in the
         * registry is the whole declaration; a leaf with no nominated row has no summary,
         * and a leaf with two would be a registry error rather than a precedence rule here
         * (the first wins, and the suite counts them).
         *
         * TWO SHAPES AND NO THIRD. A BANK summarises as the LABEL of the item its value
         * names — '220V', not '230', because the label is the word the page itself uses and
         * a nav row printing a different number from the control it stands for is the
         * defect this is meant to close. A STEPPER summarises as its value in its declared
         * unit. Anything else returns null rather than inventing a rendering: a switch's
         * "On" and a select's collapsed label are Slate-absent and would be this file's
         * invention.
         *
         * NULL IS A REAL ANSWER (A7). A machine that has not answered, or a bank whose
         * value matches no item — the unset mains voltage — has no headline, and the row
         * draws NO summary element. Not a dash: a dash in a nav list would read as a page
         * that is broken rather than a page whose one number is not known yet.
         */
        navSummary(leafId) {
            const row = rowsHere(leafId).find((candidate) => candidate.navSummary === true);
            if (!row) return null;
            const view = viewFor(row);
            if (view.surface !== 'shown' || view.inert) return null;
            const value = view.value;
            if (value === undefined || value === null || value === '') return null;
            if (view.archetype === ARCHETYPE.BANK) {
                const item = (view.items ?? []).find((candidate) => String(candidate.value) === String(value));
                return item ? item.label : null;
            }
            if (view.archetype === ARCHETYPE.STEPPER) {
                if (!Number.isFinite(Number(value))) return null;
                const shown = view.bounds?.format ? view.bounds.format(value) : String(value);
                const unit = view.bounds?.unit ?? '';
                return unit ? `${shown} ${unit}` : String(shown);
            }
            return null;
        },

        /** The one-sentence note for a leaf whose emptiness is a decision (D4). */
        note: (leafId) => noteForLeaf(leafId),

        /**
         * Declared-but-not-built, each naming its owner. Renders nothing; reported.
         * Keeps the bare name because it mirrors `pendingForLeaf` in the registry; the
         * staged patch is `pendingPatch` above.
         */
        pending: (leafId) => pendingForLeaf(leafId),

        /**
         * Read everything one leaf needs. Route keys go through the router (a backend
         * failure reads as absent — a broken read must not take a screen down); machine
         * fields come from one document read, cached by the client behind it.
         */
        async load(leafId) {
            const rows = rowsHere(leafId);
            const keys = [...new Set(rows.filter((r) => r.source === SOURCE.ROUTE).map((r) => r.key))];
            /* AND THE MASTER SWITCHES' MEMORY KEYS, WHICH WERE NEVER READ AT ALL — found
             * while building D09's ladder, 30 August 2026, and it is a bigger fault than
             * the one D09 was asked to fix.
             *
             * `steamTempWhenOn`, `tankTempWhenOn` and `cupWarmerTarget` are kv keys that no
             * ROW names: they are a property of a `zeroSwitch` row, not a control. This
             * line only ever collected ROUTE row keys, so `settings.load()` was never
             * called for any of the three — and an unloaded key's cell is empty, so
             * `settings.value()` answered `STORED_DEFAULTS` **even when the server was
             * holding a real memory**. The remembered number therefore survived a Save,
             * survived a reload, sat in the store where the audit's device pass found and
             * read it back — and was invisible to the one piece of code written to consult
             * it. Switching a master switch on in a later session ALWAYS got the shipped
             * default.
             *
             * The audit could not see this from the glass because it looks exactly like the
             * S03 defect it did find: the wrong number appears either way. It shows up here
             * because the ladder now asks `storedValue()`, which cannot answer with a
             * default and so has nothing to hide behind. */
            const memoryKeys = [...new Set(rows.filter((r) => r.zeroSwitch).map((r) => r.zeroSwitch))];
            for (const key of memoryKeys) if (!keys.includes(key)) keys.push(key);
            /* A MACHINE ROW IS NOT THE ONLY REASON TO READ THE DOCUMENT. A bespoke leaf
             * can read machine fields through `machineValue()` and draw them itself, and
             * such a leaf may hold no registry rows at all — `rows.some(...)` then says
             * "no machine here" and the leaf renders every one of its values as the
             * absence dash. MEASURED on `calibration-default-load-settings`, whose whole
             * NOW column went blank. The registry names those leaves. */
            const needsMachine = rows.some((r) => r.source === SOURCE.MACHINE)
                || leafReadsMachineDoc(leafId);
            await Promise.all(keys.map((key) => settings.load(key)));
            /* EVERY TIME A MACHINE PAGE IS OPENED, not once a session.
             *
             * Ben, 26 August 2026 (O2): "Where a setting is something that configures a
             * machine[-]stored setting, we should always read the machine value when
             * loading setting ... The machine holds the value and is the truth teller."
             *
             * THE LATCH WAS `!machineLoaded`, so the document was read on the first machine
             * page of a session and never again. Anything that moved a setting afterwards —
             * the machine's own front panel, another tablet, a firmware default applied on
             * restart, or Decal's own Default load settings page — left every settings
             * page showing what was true when the screen first opened. The audit found the
             * reset case: after a restore, Fan, Voltage, Refill Kit and Flow Multiplier all
             * kept their pre-reset numbers for the rest of the session.
             *
             * IT IS ONE READ PER PAGE OPEN and nothing more. Not a poll: a settings page is
             * not a live readout, and re-reading while somebody is editing would fight
             * their staged change. The staged Map is untouched by a read (see the join),
             * so an edit in flight survives it. */
            if (needsMachine) await this.loadMachine();
            bump();
        },

        /** The machine's settings document, once. Absent port or a failed read = absent. */
        async loadMachine() {
            /* CONCURRENT CALLERS SHARE ONE READ. Since O2 removed the once-a-session latch
             * every machine page calls this on open, and two opens in quick succession — a
             * fast tap down the sub-nav — overlap. Each call clears `machineValues` before
             * repopulating it, so an overlap could clear the map belonging to a read that
             * had already finished and leave every control blank. MEASURED: steam
             * temperature and the fan threshold both went empty on the rig the moment the
             * latch came out. The in-flight promise is the same shape the plugins and
             * account stores already use, for the same reason. */
            if (inFlightMachineRead) return inFlightMachineRead;
            /* `machineLoaded` MEANS ANSWERED, AND UNTIL 29 AUGUST 2026 IT MEANT ASKED — it
             * was set on this line, BEFORE the await, as the once-a-session latch that
             * `inFlightMachineRead` replaced. Nothing outside this file read it, so the
             * change is free; what it buys is audit F-042's discriminator. A row whose
             * document is still in flight must not paint the fallback table as though the
             * machine had answered with it. */
            if (!machine || typeof machine.read !== 'function') {
                /* NO PORT IS AN ANSWER — the machine is not reachable, which is a state and
                 * not a wait. The rows read absent, exactly as they always have. */
                machineLoaded = true;
                bump();
                return null;
            }
            inFlightMachineRead = (async () => {
                let data = null;
                try {
                    data = await machine.read();
                } catch (error) {
                    log.error('the machine settings read threw', error);
                    data = null;
                }
                machineValues.clear();
                if (data && typeof data === 'object') {
                    for (const [field, value] of Object.entries(data)) machineValues.set(field, value);
                }
                /* ANSWERED — including a read that FAILED. A machine that refused is a
                 * machine that has spoken, and the rows then draw the absence dash rather
                 * than waiting for ever. */
                machineLoaded = true;
                bump();
                return data;
            })();
            try {
                return await inFlightMachineRead;
            } finally {
                inFlightMachineRead = null;
            }
        },

        /**
         * Change one row.
         *
         * ROUTE rows write immediately and report; MACHINE rows stage. The branch is on
         * the ROW'S DECLARED SOURCE, not on anything a call site chose — which is what
         * makes "one store per setting" a property of the table rather than a habit.
         */
        async set(row, value) {
            /* THE MASTER SWITCH WRITES THE FIELD IT IS A VIEW OF, and remembers the value
             * it is leaving. Turning steam off stages a target temperature of zero — the
             * machine's own way of saying "no steam" — after remembering the temperature
             * that was there, so turning it back on comes back to the same number rather
             * than to whatever a default says. BOTH HALVES ARE STAGED, so Cancel undoes the
             * switch exactly as it undoes a stepper and Save commits the pair — see
             * `stagedMemory`, and audit F-049 for what this sentence used to describe
             * rather than state. */
            if (row.zeroSwitch) {
                const on = Boolean(value);
                if (!on) {
                    /* THE HELD VALUE, NOT THE SHOWN ONE. What is remembered has to be the
                     * machine's own number — remembering 320 because the page was in
                     * Fahrenheit would come back as 320 °C when the switch went on again. */
                    const current = Number(heldValueFor(row));
                    if (Number.isFinite(current) && current > 0) {
                        stagedMemory.set(row.zeroSwitch, current);
                    }
                    return this.set({ ...row, zeroSwitch: null }, 0);
                }
                const restore = restoreTargetFor(row);
                if (restore === undefined) {
                    return Object.freeze({ ok: false, staged: false, key: row.field, reason: 'no value to restore' });
                }
                /* AN OFF UNDONE INSIDE THE SAME BAND LEAVES NOTHING TO COMMIT. The staged
                 * memory belongs to that off; the switch is back on and the field carries
                 * the number again, so writing the key on Save would be a kv write nobody
                 * asked for. A STORED memory is untouched — it belongs to a Save that
                 * already happened and is what an earlier session decided. */
                stagedMemory.delete(row.zeroSwitch);
                return this.set({ ...row, zeroSwitch: null }, restore);
            }
            /* A DISABLED OPTION IS REFUSED BEFORE ANY OF THE WRITE SHAPES BELOW SEE IT.
             *
             * FAIL-CLOSED COVERS THE WRITE, NOT JUST THE PAINT, and this is the per-ITEM
             * half of the rule the row-level `capability` check makes further down. Greying
             * a cell is what the user sees; refusing the write is what makes it true. A
             * control can be stale — rendered before the capability answer landed, or left
             * on screen while a probe was unplugged — and every branch under this line
             * stages something, so the check has to come first or a disabled option reaches
             * the next commit through whichever shape the row happens to use.
             *
             * IT IS CHECKED FOR EITHER SOURCE, exactly as `viewFor` gates for either: a
             * bank's options are gated by what the machine can do, not by where its value
             * is kept. */
            const chosenItem = (itemsFor(row) ?? []).find(
                (item) => String(item.value) === String(value));
            if (chosenItem && chosenItem.disabled) {
                return Object.freeze({
                    ok: false, staged: false, key: row.field ?? row.key ?? null, reason: 'capability',
                });
            }
            /* AND A ROW THAT IS NOT ON THIS MACHINE CANNOT WRITE, FOR EITHER SOURCE.
             *
             * `rowsHere` keeps such a row off the page; this keeps it off the wire. Both
             * halves are needed for the same reason the capability check needs both: a
             * caller holds a `view.row` object, not an index into a list, so a control
             * rendered before the class landed — or a bespoke leaf reaching the model with
             * a row it looked up itself — can still call `set` on something the page would
             * no longer draw. Every branch below this line stages or writes.
             *
             * IT IS ABOVE THE `SOURCE.MACHINE` CHECK RATHER THAN INSIDE IT because the gate
             * is a property of the CONTROL and not of where its value is kept — the same
             * argument `viewFor` makes for checking `capability` before the source, and the
             * same one the disabled-item refusal above makes. No ROUTE row declares
             * `machines` today; a check that only worked for machine rows would be a hole
             * waiting for the first one that does.
             *
             * `reason: 'machine'` AND NOT `'capability'`, because they are not the same
             * refusal and a caller that reported them as one would tell a DE1 owner their
             * machine had not advertised a feature it simply does not have. */
            if (!rowShownOn(row, machineClassNow())) {
                return Object.freeze({
                    ok: false, staged: false, key: row.field ?? row.key ?? null, reason: 'machine',
                });
            }
            /* A CHOICE THAT IS SEVERAL MACHINE NUMBERS. The read half is `derivedValueFor`;
             * this is the write half, and the two are the same table read in both
             * directions. Each option names the fields it sets and the value it sets them
             * to; `RESTORE` means "put back what the machine already had, and if that is
             * nothing or zero, the fallback" — because arming a stop needs a number and
             * zero is precisely what "not armed" means.
             *
             * IT STAGES, LIKE EVERY OTHER MACHINE CHANGE. Two fields for one press is still
             * one intent to the user, and Cancel undoes both because both are staged. */
            if (row.stages) {
                const plan = row.stages[value];
                if (!plan) {
                    return Object.freeze({ ok: false, staged: false, key: null, reason: 'not an option' });
                }
                for (const [field, wanted] of Object.entries(plan)) {
                    staged.set(field, wanted === RESTORE ? restoreValueFor(row, field) : wanted);
                }
                bump();
                return Object.freeze({ ok: true, staged: true, key: Object.keys(plan)[0] });
            }
            /* THE SAME MAP `valueFor` READ ON THE WAY OUT, read on the way in. A bank cell
             * announces a DOM string; the machine holds a boolean. */
            if (row.fieldValues) {
                if (!Object.hasOwn(row.fieldValues, value)) {
                    return Object.freeze({ ok: false, staged: false, key: row.field, reason: 'not an option' });
                }
                staged.set(row.field, row.fieldValues[value]);
                bump();
                return Object.freeze({ ok: true, staged: true, key: row.field });
            }
            /* THE REVERSE CONVERSION, AT THE INPUT EDGE. Ben, 26 August 2026: "With reverse
             * conversion to go back to the machine." A number that arrived from a stepper,
             * a numpad or a bank was read in whatever unit the page is drawing, and below
             * this line only Celsius exists.
             *
             * IT IS DONE ONCE, HERE, rather than at the three call sites that can produce a
             * temperature — which is the whole reason this is a model method and not a
             * handler on the leaf. */
            const display = displayUnitFor(row);
            if (display && Number.isFinite(Number(value))) {
                value = fromDisplayTemp(Number(value), display);
            }
            if (row.source === SOURCE.MACHINE) {
                /* FAIL-CLOSED COVERS THE WRITE, NOT JUST THE PAINT. The settings store
                 * refuses a gated ROUTE write for this reason — "a stale control left on
                 * screen can still post to a machine that never advertised the feature" —
                 * and a machine row is the same risk with a shorter path: staging it would
                 * put the field in the next commit. Checked here because this is where a
                 * machine write starts. */
                if (row.capability
                    && settings.gateCapability(row.capability).surface !== 'shown') {
                    return Object.freeze({
                        ok: false, staged: false, key: row.field, reason: 'capability',
                    });
                }
                staged.set(row.field, value);
                bump();
                return Object.freeze({ ok: true, staged: true, key: row.field });
            }
            if (row.source === SOURCE.ROUTE) {
                const stored = row.invert ? !value : value;
                const result = await settings.set(row.key, stored);
                /* BOTH HALVES, AND THE COMMAND IS THE HALF THAT WAS MISSING. The preference
                 * is stored so it survives a reload and so the row has something to draw
                 * before the first display frame; the command is what actually changes the
                 * tablet. A row with no `panel` skips this entirely and behaves exactly as
                 * every ROUTE row always has.
                 *
                 * A REFUSAL OUTRANKS THE STORED WRITE IN THE REPORT. The value is kept
                 * either way — a lock that could not be taken because the socket is shut is
                 * still what the user asked for, and it is taken on the next connect — but
                 * saying `ok` for a command that never left would be exactly the silent
                 * failure `live-stores.js` refuses to swallow. */
                let panelReason = null;
                if (row.panel && PANEL_SETTINGS[row.panel]) {
                    const sent = panel
                        ? PANEL_SETTINGS[row.panel].write(panel, stored)
                        : { ok: false, reason: 'the display feed is not attached' };
                    if (sent && sent.ok === false) panelReason = sent.reason ?? 'refused';
                }
                bump();
                return Object.freeze({
                    ok: result.ok && panelReason === null,
                    staged: false,
                    key: row.key,
                    reason: panelReason ?? result.reason ?? null,
                });
            }
            return Object.freeze({ ok: false, staged: false, key: null, reason: 'not a stored row' });
        },

        /**
         * Send the staged machine changes as ONE write, then re-read.
         *
         * The re-read is not politeness: the machine is the owner, a write is a request,
         * and showing the value we asked for rather than the value it holds is how a
         * settings page ends up lying about a machine that clamped or refused. Staged
         * intents are dropped only after a successful write — a failed commit leaves them
         * staged and the count non-zero, so nothing is silently lost.
         */
        async commit() {
            if (staged.size === 0 && stagedMemory.size === 0) {
                return Object.freeze({ ok: true, wrote: 0, reason: null });
            }
            if (staged.size > 0 && (!machine || typeof machine.write !== 'function')) {
                log.error('refusing to commit: there is no machine settings port');
                return Object.freeze({ ok: false, wrote: 0, reason: COMMIT_REFUSAL.NO_MACHINE_PORT });
            }
            const patch = Object.fromEntries(staged);
            const count = staged.size;
            let ok = true;
            if (staged.size > 0) {
                try {
                    ok = await machine.write(patch);
                } catch (error) {
                    log.error('the machine settings write threw', error);
                    ok = false;
                }
            }
            if (!ok) {
                bump();
                /* BOTH HALVES STAY STAGED. A master switch's remembered value must not
                 * reach the store on a commit whose machine half failed — that is the
                 * F-049 split by another route, with the same result: a memory of a state
                 * the machine is not in. */
                return Object.freeze({ ok: false, wrote: 0, reason: COMMIT_REFUSAL.WRITE_FAILED });
            }
            /* THE REMEMBERED VALUES, ON THE SAME SAVE (audit F-049). They are kv keys, so
             * they go out on their own route rather than in the patch above — but they go
             * out HERE, once the machine half has been accepted, and not on the press that
             * staged them. A refusal is reported and the key is KEPT staged rather than
             * dropped: the alternative is a memory that is silently lost. */
            let memoryReason = null;
            for (const [key, remembered] of [...stagedMemory]) {
                let result = null;
                try {
                    /* A STAGED `FORGET` IS A DELETE, and it takes the store's named door
                     * rather than `set(key, null)`. The router routes a null write to
                     * `remove()` for every layer, so the two would reach the same place —
                     * but `settings.remove()` is where the KV null trap is documented
                     * (ReaPrime's handler turns a JSON null body into the four-character
                     * string 'null', which reads back as a present, truthy setting), and a
                     * delete that says `remove` cannot be mistaken for one later. */
                    result = remembered === FORGET
                        ? await settings.remove(key)
                        : await settings.set(key, remembered);
                } catch (error) {
                    log.error('the remembered value write threw', error);
                    result = { ok: false, reason: 'threw' };
                }
                if (result && result.ok === false) {
                    memoryReason = result.reason ?? 'refused';
                } else {
                    stagedMemory.delete(key);
                }
            }
            staged.clear();
            await this.loadMachine();
            return Object.freeze({
                ok: memoryReason === null, wrote: count, reason: memoryReason,
            });
        },

        /**
         * Which rows on a leaf have a decided default, so a page can offer to restore them.
         *
         * Ben, 26 August 2026 (O7): "For many of the machine settings we should have a
         * button in on the right above the horizontal dividing line that says 'restore
         * defaults' where each page can get the default values from reaPrime."
         *
         * THE DEFAULTS ARE reaLINE'S, NOT ReaPrime'S, and that is worth saying plainly.
         * ReaPrime serves no per-page defaults: the only reset it has is
         * DELETE /machine/settings/reset, which puts back a fixed group of seven settings
         * spanning four different pages and would be wrong on any one of them. So the
         * button restores the values Ben decided (settings-defaults.js), which is the same
         * set the controls fall back to when nothing is stored.
         *
         * A LEAF WITH NO DECIDED DEFAULTS OFFERS NO BUTTON, which is why this returns the
         * rows rather than a boolean: the caller both decides whether to render and knows
         * exactly what pressing it would move.
         */
        restorableRows(leafId) {
            const seen = new Set();
            return this.rows(leafId).filter((view) => {
                const row = view.row;
                if (row.source === SOURCE.MACHINE) {
                    /* ONE FIELD, ONE RESTORE. A `zeroSwitch` row and the stepper below it
                     * are two controls over ONE machine field, so listing both would show
                     * the same value twice in the confirmation and write it twice on the
                     * way out. The first row that names the field keeps it. */
                    if (seen.has(row.field)) return false;
                    if (machineFallbackFor(row.field) === undefined) return false;
                    seen.add(row.field);
                    return true;
                }
                if (row.source === SOURCE.ROUTE) return hasDefault(row.key);
                return false;
            });
        },

        /**
         * Put this leaf's rows back to their decided defaults.
         *
         * MACHINE ROWS STAGE and route rows write, which is the same split every other
         * write on this screen follows — so a restore on a machine page shows up in the
         * band's count and is undone by Cancel, exactly as if the user had typed the
         * numbers in themselves. That is the point: a restore is an edit, not a command.
         */
        async restoreDefaults(leafId) {
            const rows = this.restorableRows(leafId);
            let moved = 0;
            for (const view of rows) {
                const row = view.row;
                const value = row.source === SOURCE.MACHINE
                    ? machineFallbackFor(row.field)
                    : defaultFor(row.key);
                if (value === undefined) continue;
                /* THE FIELD, NOT THE SWITCH. `restorableRows` already collapsed the pair
                 * to one entry, and that entry may be the switch — whose `set` takes a
                 * boolean. Restoring writes the machine field directly, so a default of
                 * 160 lands as 160 rather than as `Boolean(160)`. */
                const result = await this.set({ ...row, zeroSwitch: null }, value);
                if (result.ok) moved += 1;
            }
            /* AND THE LEAF FORGETS WHAT ITS MASTER SWITCHES REMEMBERED — audit F-049's
             * S03c, Ben's decision D09. See `FORGET`.
             *
             * WHY IT BELONGS TO THIS BUTTON. The three memory keys are invisible: no row
             * draws one, and until this line nothing in `src/` could remove one. So a
             * restore put the machine back to shipped values and left a private number
             * that the next switch-on would resurrect — measured on the device, 0 DELETEs
             * and `cupWarmerTarget` still 62 afterwards. A restore that leaves that behind
             * has not restored the page.
             *
             * IT WALKS `rows(leafId)`, NOT `restorableRows`. That list has already
             * collapsed the switch and the stepper below it into one entry per FIELD, and
             * the survivor may be the stepper — which carries no `zeroSwitch` and would
             * hide the memory key from this loop on exactly the leaves that have one.
             *
             * ONLY WHAT IS ACTUALLY THERE. Staging a delete for a key that holds nothing
             * would be a DELETE nobody asked for on every press of this button;
             * `storedValue()` reads the stored number with no default behind it, so an
             * unstored key is silent and a shipped default is never mistaken for a memory.
             *
             * IT NEEDS NO COUNT OF ITS OWN. Every leaf that has a `zeroSwitch` row also has
             * that row's field in `restorableRows` (all three carry a `MACHINE_FALLBACKS`
             * entry), so the loop above has already staged a machine change and the band is
             * open. `changeCount` therefore stays `staged.size`, exactly as the F-049
             * Cancel-half fix left it. */
            for (const view of this.rows(leafId)) {
                const key = view.row.zeroSwitch;
                if (!key || stagedMemory.has(key)) continue;
                if (typeof settings.storedValue !== 'function') continue;
                if (settings.storedValue(key) === undefined) continue;
                stagedMemory.set(key, FORGET);
                bump();
            }
            return Object.freeze({ ok: true, moved, of: rows.length });
        },

        /**
         * Throw the staged intents away. The band's Cancel, and nothing else.
         *
         * BOTH BUCKETS (audit F-049). The remembered value a master switch staged is part
         * of the same gesture as the zero it staged on the machine field, so Cancel takes
         * back both or it takes back neither. The COUNT is still `staged.size` — the memory
         * is not a second change to a person — which is why it is cleared without being
         * counted rather than added in.
         */
        discard() {
            if (staged.size === 0 && stagedMemory.size === 0) return 0;
            const count = staged.size;
            staged.clear();
            stagedMemory.clear();
            bump();
            return count;
        },

        /** Teardown — the beacon only. Neither injected store is this model's to destroy. */
        destroy() {
            staged.clear();
            stagedMemory.clear();
            machineValues.clear();
            beacon.destroy();
        },
    };
}

/**
 * The machine port, over the DE1 settings client.
 *
 * ONE PLACE THE ENDPOINT IS NAMED, and it names no path: `createDe1SettingsClient` owns
 * `/machine/settings`, both its contract rows are `consumed` and checked at the pin, and
 * the `usb` bool/'enable' asymmetry is encoded down there — "nothing above this module
 * should ever spell 'enable'", and nothing above it does.
 *
 * @param {object} client  `createDe1SettingsClient(transport)`
 */
export function machinePortFor(client) {
    if (!client || typeof client.readSettings !== 'function') return null;
    return Object.freeze({
        async read() {
            const result = await client.readSettings();
            return result && result.ok ? result.data : null;
        },
        async write(patch) {
            const result = await client.writeSettings(patch);
            return Boolean(result && result.ok);
        },
    });
}

/**
 * The ADVANCED machine port, over the same DE1 settings client.
 *
 * A SECOND FUNCTION RATHER THAN A FLAG on `machinePortFor`, because the two documents are
 * two doors and `machine-fields-port.js` splits a patch by door: a port that could be
 * either would put the decision back at the call site, which is the thing that file
 * exists to prevent.
 *
 * The client's `writeAdvancedSettings` already picks the six keys the handler reads, and
 * both routes invalidate both DE1 caches on success — so a heater write repaints the
 * flush temperatures beside it rather than showing a minute-old copy.
 *
 * @param {object} client  `createDe1SettingsClient(transport)`
 */
export function advancedPortFor(client) {
    if (!client || typeof client.readAdvancedSettings !== 'function') return null;
    return Object.freeze({
        async read() {
            const result = await client.readAdvancedSettings();
            return result && result.ok ? result.data : null;
        },
        async write(patch) {
            const result = await client.writeAdvancedSettings(patch);
            return Boolean(result && result.ok);
        },
    });
}

export { ARCHETYPE, SOURCE };
