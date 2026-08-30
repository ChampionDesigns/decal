/**
 * profile-modes.js — the pump-mode tables and every PURE decision the profile
 * editor makes about a step (Gate 7 port of slate `app/src/modules/profile_modes.js`,
 * 579 lines; `CARRY_FORWARD.md` §3d).
 *
 * WHAT CARRIES UNCHANGED, because none of it has or should have a backend
 * counterpart: chip ordering, the sliding-indicator geometry, the review
 * sentences as data, the preview-graph channel values, and the LEVER PRESET
 * INVARIANT — a feel preset sets SPRING and GIVE and never touches P0, because
 * P0 is the barista's recipe choice. That invariant is the design, not an
 * implementation detail: an earlier version carried a `pressure` leg in the
 * preset table and `Object.assign` clobbered P0 on every preset pick.
 *
 * FOUR CHANGES, per the carry-forward verdict:
 *
 *  1. ONE RANGE TABLE (B2). The source carried three disagreeing copies of the
 *     same authoring ranges inside one file — a pressure target ceiling of 12 on
 *     the Steps grid (`:56`) and 16 in the Review sentence (`:464`); a flow step's
 *     pressure limit 12 (`:49`) vs 16 (`:476`); a pressure step's flow limit 8
 *     (`:58`) vs 15 (`:476`) — so the same field had a different ceiling depending
 *     on which surface you edited it through. `AUTHORING_RANGES` below is the one
 *     declaration; `MODE_TABLE`, `describeModeParts` and `reviewStepSpec` all read
 *     it by name and no number is written twice. B2 is "exactly one table in the
 *     skin until ReaPrime serves the limits (R2)".
 *
 *     THE MACHINE'S OWN LIMITS ARE NOT HERE. A step's brew temperature is
 *     `machine-limits.js`'s `brewTemp` — the same field, and declaring a second
 *     range for it here is the very thing B2 forbids. `reviewStepSpec` therefore
 *     takes it by INJECTION and refuses to run without it (A7: no fallback, and
 *     no quietly-wrong default).
 *
 *  2. `normalizeImportedStep` is narrowed to the IMPORT BOUNDARY (renamed from
 *     `normalizeStep`). Every branch in it is unreachable for a record fetched
 *     from ReaPrime — `ProfileStepPressure.toJson` emits `pressure` with no `flow`
 *     and vice versa, `ProfileStepPower.fromJson` throws on a null limiter, and
 *     `StepExitCondition.fromJson` uses `ExitType.values.byName`, which throws
 *     outside pressure|flow|power. It stays load-bearing for locally-authored,
 *     imported and legacy-TCL JSON, and the name now says so.
 *
 *  3. NO PAINT. The source re-exported `POWER_TRACE_COLOR` from `chart-palette.js`,
 *     contradicting its own "no imports" header; the power trace's colour is the
 *     `--ui-channel-power` token (A6/A8, `chart-tokens.js`). The lever decline
 *     overlay's dash is likewise not stated here — the dash table is one exported
 *     constant in `chart-axis.js` (LAYOUT_SPEC_DRAFT.md §6.2).
 *
 *  4. `segmentGeometry` MEASURES REAL TEXT. The source weighted each slice by
 *     `String(label).length + 2`, which works only because the four labels are
 *     known and Latin; it is wrong for i18n and for any variable-width face. The
 *     caller now supplies a measurer and the breathing room it wants, both in
 *     pixels of the face it is actually rendering.
 *
 * DOM-free and framework-free, so `node:test` exercises it directly. It has TWO
 * imports and neither is a table:
 *
 *   * the exit-type list from the address layer's profile module, so the set of exit
 *     types ReaPrime's model can express is stated in exactly one place;
 *   * `MACHINE_CLASSES` from `machine-limits.js` (added 27 August 2026 with the Bengle
 *     flow-ceiling lift below). THE VOCABULARY IS SHARED, THE TABLES ARE NOT. Not one
 *     row of `machine-limits.js` is read here and not one of its keys is declared here;
 *     what is imported is the two-element list of names a machine class can have, so
 *     that the day a third machine exists there is one place to add it rather than two
 *     that agree until they do not. `firmware-image.js:147` imports it for the same
 *     reason and says so in the same words.
 *
 * Stored step keys stay LOWERCASE, matching the DE1 v2 profile shape:
 *   flow     -> step.flow      (mL/s)
 *   pressure -> step.pressure  (bar)
 *   power    -> step.power     (hydraulic watts) + step.limiter = pressure cap
 *   lever    -> step.pressure  (P0 bar, reuses the pressure key)
 *               + step.leverSpring (bar per 10 mL) + step.leverGive (bar per mL/s)
 *               + step.limiter = OPTIONAL flow cap
 *
 * Lever presets are EDITOR-ONLY, never persisted: ReaPrime stores only the raw
 * `leverSpring`/`leverGive` doubles and the preset name is inferred from the feel
 * legs on load, else CUSTOM.
 */

import { REA_EXIT_TYPES } from '../data/rea-profile.js';
import { MACHINE_CLASSES } from './machine-limits.js';

/* ===========================================================================
 * Small numeric helpers (private)
 * =========================================================================== */

/** Coerce a possibly-string / possibly-missing JSON value to a finite number, else 0. */
function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

/** Exact (0.1-quantised) equality with a small tolerance, string-tolerant. */
function nEq(a, b) {
    return Math.abs(num(a) - num(b)) < 1e-6;
}

/** Clamp x into [lo, hi]. */
function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}

/* ===========================================================================
 * THE ONE AUTHORING-RANGE TABLE (B2)
 * =========================================================================== */

/**
 * Every range a profile step's own fields may be authored within, declared ONCE.
 *
 * One entry per FIELD, and every surface — the Steps grid, its ± steppers, the
 * numpad and the Review sentence — reads the entry rather than restating the
 * number. A ceiling can still be wrong; it can no longer be wrong on one surface
 * and right on another, which is the defect this table exists to kill.
 *
 * WHERE THE THREE DISAGREEMENTS LANDED (the grid's value won in all three; the
 * Review path was the un-gated outlier, and the reversal is one number here):
 *
 *   pressureTarget     grid 12  /  review 16   -> 12
 *   stepPressureLimit  grid 12  /  review 16   -> 12
 *   stepFlowLimit      grid  8  /  review 15   ->  8
 *
 * THOSE THREE NUMBERS ARE THE DE1'S. Since 27 August 2026 two rows resolve per machine
 * class (`flowTarget` and `stepFlowLimit` — see `authoringRangesFor` below), so the 8
 * above is what a DE1, and an unresolved machine, are offered; a Bengle is offered 20.
 * The reconciliation itself is unchanged: the grid's value won, on BOTH machines, and
 * the review sentence reads the same entry the stepper does on both.
 *
 * NOT HERE, deliberately:
 *   * `temperature` — a step's brew temperature is `machine-limits.js`'s
 *     `brewTemp`. One table per field, and that field's table is the machine's.
 *
 * THE BENGLE FLOW-CEILING LIFT IS NOW HERE, AND IT ARRIVED IN THE SHAPE THIS PARAGRAPH
 * DEMANDED (27 August 2026). What stood here until that date was a refusal:
 *
 *     "the Bengle flow-ceiling lift (flow target/limit 15/8 -> 20). It was gated on
 *      a machine-NAME test in the old editor, which A3 forbids; when it returns it
 *      is a capability answer applied to THIS table, never a second table."
 *
 * Ben, in the profile editor, 27 August 2026: "why is flow limited to 15ml/s" — and,
 * told that the old editor gave a Bengle 20 and that the lift had been dropped on the
 * way in: "flow limit goes with it to 20 as well." So both ceilings move on a Bengle,
 * and the DE1's do not. It is a CAPABILITY answer (`capabilities.machineClass()`, which
 * is `machineClassFromServedSet` over the served array, never a model string) applied
 * to THIS table through `authoringRangesFor` below — one table, resolved per class,
 * exactly as `machine-limits.js limitsFor()` resolves its own two machine-dependent
 * rows. There is no second table and no second copy of either number.
 *
 * WHAT IS STILL NOT HERE:
 *   * `exitFlow` — a flow EXIT threshold, ceiling 8, untouched. Ben asked about the flow
 *     step's target and the pressure step's flow limit and named no third field, and a
 *     ceiling is a safety envelope: widening one nobody asked about is inventing an
 *     answer. Recorded as a deferred question rather than settled — if a Bengle can pour
 *     at 20 mL/s then "move on when flow rises above 8" is arguably narrow too, and that
 *     is a question for Ben and not for this file.
 *   * `leverFlowCap`, already 20 on every machine, because its own comment reads "the
 *     ceiling is the machine's max flow". That number and the Bengle's 20 agree today
 *     and are NOT the same fact: one is a lever step's optional cap on a machine whose
 *     pump range was written down once, the other is a per-class ceiling. R2 will
 *     overwrite both, and it will overwrite them separately.
 *
 * IS THIS A SECOND B2 TABLE? ADJUDICATED: NO — and the reasoning is written down
 * because the question is worth asking and was asked (wave 4 review, cports-1).
 *   * B2's rule is stated per FIELD, by the scope that set it: "one table until the
 *     server serves them, BECAUSE TODAY THE SAME FIELD HAS DIFFERENT MAXIMA
 *     DEPENDING ON WHERE YOU TOUCH IT" (SCOPE.md:1185), and the one machine table
 *     says the same in its own header ("it can no longer be wrong in one place and
 *     right in another", `machine-limits.js:8-20`). The wave-4 must-not is worded
 *     "R2 (the one interim limits table, NEVER A SECOND COPY)" (SCOPE.md:4552).
 *   * Nothing here is a copy. Not one key of `machine-limits.js`'s `LIMIT_KEYS` is
 *     declared in this file, the one field both surfaces touch (brew temperature)
 *     is INJECTED from that module rather than restated, and
 *     `test/profile-modes.test.mjs` pins both — including a pin on the two key sets
 *     themselves, so a NEW row in either table fails until someone decides which
 *     table owns it.
 *   * The audit itself directs this table into this file, citing B2 to do it:
 *     `CARRY_FORWARD.md:296` and SCOPE.md:2708 ("collapse to one range table … per
 *     B2's 'exactly one table' rule"), and `ITEMS.json` `port-profile-modes`. A
 *     reading of B2 under which this file may not hold a range table contradicts
 *     the instruction that created it.
 *   * WHAT IS STILL OPEN, and it is recorded as a deferred question rather than
 *     settled here: several ceilings below ARE the machine's envelope (leverFlowCap
 *     20, powerTarget 10), so R2's served answer will OVERWRITE them. R2 lands as a
 *     rewrite of this table's machine-envelope rows, never as a second table.
 *   * AND RESOLVING TWO OF ITS ROWS PER MACHINE CLASS DOES NOT MAKE IT TWO TABLES
 *     (27 August 2026). `authoringRangesFor('bengle')` and `authoringRangesFor('de1')`
 *     are two RESULTS of one declaration, in exactly the sense `limitsFor('bengle')` and
 *     `limitsFor('de1')` have always been: each ceiling is written down once, in one map,
 *     beside the other machine's, where the two can be compared in one glance. B2's
 *     defect is one field having different maxima depending on WHICH SURFACE you touch
 *     it through — the grid against the review sentence — and that is unchanged here:
 *     both surfaces resolve the same row for the same machine, and the review path takes
 *     the class from the same door the grid does.
 *
 * Units are the measure only. Prose that wants "bar per mL/s **of give**" writes
 * its own suffix — wording is verbatim per surface, ranges are not.
 */
const BASE_AUTHORING_RANGES = Object.freeze({
    /** A pressure step's setpoint. 0 bar is a valid step (stock pause/flush semantics). */
    pressureTarget: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    /* `flowTarget` IS NOT HERE — it is machine-dependent and `authoringRangesFor` below
     * composes it, the same way `machine-limits.js BASE_LIMITS` holds no `steamTemp` row
     * and `limitsFor` composes that one. A flow step's setpoint reaches 20 mL/s on a
     * Bengle and 15 on a DE1. */
    /** A power step's target, in hydraulic watts — the firmware shaper's authored maximum. */
    powerTarget: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'W' }),
    /** A lever step's P0, stored in the pressure key. */
    leverP0: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),

    /**
     * A flow step's PRESSURE LIMIT. `min: 0` is load-bearing: the limit can be
     * switched fully off (0 = no limit), and a min of 1 made it impossible to
     * turn off from the − button or the numpad.
     */
    stepPressureLimit: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    /* `stepFlowLimit` IS NOT HERE either, and for the same reason: a pressure step's FLOW
     * LIMIT is 20 mL/s on a Bengle and 8 on a DE1. `authoringRangesFor` composes it, and
     * its `min: 0` — the limit switched fully off — is machine-independent and stated
     * there once. */
    /**
     * A power step's PRESSURE CAP — soft-mandatory, so its floor is 1 bar and not
     * 0: `ProfileStepPower.fromJson` throws for a null OR zero limiter.
     */
    powerPressureCap: Object.freeze({ min: 1, max: 12, step: 0.1, unit: 'bar', mandatory: true }),
    /**
     * A lever step's OPTIONAL flow cap. The ceiling is the machine's max flow, so
     * the cap can span the full pump range; the floor stays 0 (cap off).
     */
    leverFlowCap: Object.freeze({ min: 0, max: 20, step: 0.1, unit: 'mL/s' }),

    /** Lever feel: the spring rate. */
    leverSpring: Object.freeze({ min: 0, max: 3, step: 0.1, unit: 'bar per 10 mL' }),
    /** Lever feel: the give. */
    leverGive: Object.freeze({ min: 0, max: 6, step: 0.1, unit: 'bar per mL/s' }),

    /** Exit thresholds, one per exit type ReaPrime's model can express. */
    exitPressure: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    exitFlow: Object.freeze({ min: 0, max: 8, step: 0.1, unit: 'mL/s' }),
    exitPower: Object.freeze({ min: 0, max: 25.5, step: 0.1, unit: 'W' }),

    /** The step's own stop conditions. */
    seconds: Object.freeze({ min: 0, max: 300, step: 1, unit: 'sec' }),
    volume: Object.freeze({ min: 0, max: 500, step: 1, unit: 'mL' }),
    weight: Object.freeze({ min: 0, max: 500, step: 1, unit: 'g' }),
});

/* ===========================================================================
 * THE TWO MACHINE-DEPENDENT ROWS (A3 — a capability answer, never a machine name)
 * =========================================================================== */

/**
 * THE FLOW CEILINGS, PER MACHINE CLASS. Ben, 27 August 2026, in the profile editor:
 *
 *   "why is flow limited to 15ml/s"
 *
 * and, told that the old editor gave a Bengle 20 and that the lift had been dropped in
 * the port:
 *
 *   "flow limit goes with it to 20 as well."
 *
 * So a Bengle authors a flow step up to 20 mL/s and caps a pressure step's flow at up to
 * 20 mL/s; a DE1 keeps 15 and 8. Two classes, two bands — which is the same argument
 * `machine-limits.js` makes twice over for making its steam ceiling and its fan threshold
 * maps instead of constants: two classes with the same number would be a distinction that
 * makes no difference, and two classes with two numbers is the whole reason
 * `machineClass` is an argument.
 *
 * TWO MAPS AND NOT ONE, even though the Bengle's answer is 20 in both. They are two
 * FIELDS: a flow step's setpoint and a pressure step's flow limit are edited by different
 * controls, were reconciled from different pairs of disagreeing copies (15 vs nothing;
 * 8 vs 15), and only one of them has ever had a floor argument written about it. One map
 * carrying both would be a claim that the two must move together, and nobody has decided
 * that. The 20s agreeing today is a coincidence of the pump's range, not a shared fact.
 *
 * IT IS A CAPABILITY ANSWER AND NEVER A NAME (A3). The class arrives from
 * `capabilities.machineClass()`, which is `machineClassFromServedSet` over ReaPrime's
 * served capability array — `de1handler.dart` emits its seven entries inside a single
 * `if (de1 is BengleInterface)`, so a non-empty set is ReaPrime's own "this is a Bengle".
 * The old editor got its 20 by testing the machine's NAME, which is exactly what this
 * port refused on the way in; the answer is the same and the route is not.
 *
 * THE NUMBER IS NOT VERIFIED AGAINST THE FIRMWARE AND THAT IS STATED, NOT HIDDEN. What is
 * known is that the old editor offered a Bengle 20 and that Ben, at his own machine,
 * asked for 20 back. No firmware constant was read for this and ReaPrime declares no flow
 * ceiling anywhere — checked: neither the DE1 model nor any handler carries one, which is
 * why this table is the only authority for it and why R2 will overwrite it.
 */
const FLOW_TARGET_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 20, de1: 15 });
const STEP_FLOW_LIMIT_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 20, de1: 8 });

/**
 * The rows whose ceiling depends on the machine class. Exported because it is the list
 * `authoringRange` refuses to answer without a class for, and because a test can then
 * pin the list itself rather than pin two names it typed out again.
 */
export const MACHINE_DEPENDENT_AUTHORING_RANGES = Object.freeze(['flowTarget', 'stepFlowLimit']);

/**
 * WHAT AN UNKNOWN MACHINE CLASS IS OFFERED, AND WHY IT IS NOT WHAT STEAM DOES.
 *
 * `machine-limits.js` answers an unknown class by making its two machine-dependent rows
 * ABSENT: "absence is the answer, not a stand-in (A7)". This table answers it with the
 * NARROWER band instead, and the difference is not a relaxation of that rule — it is that
 * the two cases are not alike.
 *
 * STEAM'S TWO BANDS DO NOT NEST. Its ceiling is 170 on a Bengle and 160 on a DE1, and its
 * fan threshold is 40-60 against 0-50 — bands that overlap without either containing the
 * other, so there is no third band that is safe on both machines. Standing either one in
 * would offer somebody a value their machine refuses. Absence is then the only honest
 * answer, and the steam control renders unavailable until the capability read lands.
 *
 * THESE TWO NEST EXACTLY. 0-15 is inside 0-20 and 0-8 is inside 0-20, so the DE1's band
 * is a SUBSET of the Bengle's: nothing it lets a person author can be refused by either
 * machine. Choosing it is picking the safe end of two KNOWN bands, which is a different
 * act from inventing a stand-in for an unknown one — A7 forbids the second, not the first.
 *
 * AND ABSENCE WOULD COST MORE HERE THAN IT DOES THERE. A missing steam row disables one
 * settings control on one page for one asynchronous read. A missing `flowTarget` row
 * would leave the profile editor's TARGET cell — the thing the screen exists to edit —
 * unbounded or unavailable on every step of every profile, for anyone whose capability
 * answer has not arrived or whose machine serves none at all. The editor stays usable,
 * and the cost of the choice is that a Bengle owner who opens the editor before the
 * capability read settles is offered 15 for a moment rather than 20. That is a ceiling
 * that is too LOW, which is recoverable; the other direction is not.
 */
const UNKNOWN_MACHINE_CLASS_IS_OFFERED = 'de1';

/** The whole table, for one machine class. Built once per class, so identity is stable. */
function buildAuthoringRanges(machineClass) {
    return Object.freeze({
        ...BASE_AUTHORING_RANGES,
        /**
         * A flow step's setpoint. 0 mL/s is the bloom people already author, and the
         * ceiling is the machine's — 20 on a Bengle, 15 on a DE1.
         */
        flowTarget: Object.freeze({
            min: 0, max: FLOW_TARGET_CEILING_BY_MACHINE_CLASS[machineClass],
            step: 0.1, unit: 'mL/s',
        }),
        /**
         * A pressure step's FLOW LIMIT. `min: 0` is load-bearing and machine-independent:
         * the limit can be switched fully off (0 = no limit), and a min of 1 made it
         * impossible to turn off from the - button or the numpad.
         */
        stepFlowLimit: Object.freeze({
            min: 0, max: STEP_FLOW_LIMIT_CEILING_BY_MACHINE_CLASS[machineClass],
            step: 0.1, unit: 'mL/s',
        }),
    });
}

const AUTHORING_RANGES_BY_MACHINE_CLASS = Object.freeze(Object.fromEntries(
    MACHINE_CLASSES.map((machineClass) => [machineClass, buildAuthoringRanges(machineClass)]),
));

/**
 * THE ONE TABLE, RESOLVED FOR ONE MACHINE CLASS — the exact counterpart of
 * `machine-limits.js limitsFor(machineClass)`, and deliberately built the same way.
 *
 * Every row is the same object for the same class on every call, so a caller may compare
 * ranges by identity; that is what `test/editor-ranges.test.mjs` counts on to prove no
 * surface holds a COPY of a range (a copy compares equal on min/max and is a second
 * table). Building three frozen tables at module load costs nothing and buys that.
 *
 * @param {'bengle'|'de1'|null} machineClass  the class, or null when it is not known
 * @returns {Readonly<object>} every row, with the two machine-dependent ceilings resolved.
 *   Unlike `limitsFor`, NO ROW IS EVER ABSENT — see `UNKNOWN_MACHINE_CLASS_IS_OFFERED`
 *   above for why the two modules answer an unknown class differently.
 */
export function authoringRangesFor(machineClass) {
    if (machineClass === null || machineClass === undefined) {
        return AUTHORING_RANGES_BY_MACHINE_CLASS[UNKNOWN_MACHINE_CLASS_IS_OFFERED];
    }
    if (!MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(
            `profile-modes: unknown machine class "${machineClass}". The classes are `
            + `${MACHINE_CLASSES.join(', ')} and null (not known yet); the answer comes from `
            + 'capabilities.machineClass(), never from a model name (A3).',
        );
    }
    return AUTHORING_RANGES_BY_MACHINE_CLASS[machineClass];
}

/**
 * THE TABLE AS AN UNRESOLVED MACHINE SEES IT, which is the DE1's numbers.
 *
 * Kept as a plain export because fifteen of its seventeen rows are machine-independent and
 * every one of those callers is right to read it. For the two that are not — `flowTarget`
 * and `stepFlowLimit` — this is the class-unknown answer and it is a real answer, not a
 * placeholder; a caller that has a class must go through `authoringRangesFor` or
 * `authoringRange(name, machineClass)` to get theirs.
 */
export const AUTHORING_RANGES = authoringRangesFor(null);

/** The sentinel for "the caller did not state a machine class", distinct from stating null. */
const MACHINE_CLASS_NOT_STATED = Symbol('profile-modes: machine class not stated');

/**
 * A range by name, refusing to guess. Undeclared is a programming error, not a
 * value: an unbounded control is how a field ends up with a ceiling nobody
 * decided (`machine-limits.js` takes the same stance for the same reason).
 *
 * A MACHINE-DEPENDENT ROW MUST BE ASKED FOR WITH A CLASS, AND OMITTING ONE THROWS.
 * `null` is a perfectly good answer to pass — it means "not known yet" and returns the
 * narrower band — but it has to be PASSED. The failure this guards against is the one
 * that produced the bug in the first place: a call site that never thought about the
 * machine, silently answered with one machine's ceiling, and looked completely correct
 * at the call site. A default here would restore exactly that, so the two rows are
 * unreadable without a stated class and the other fifteen are unaffected.
 *
 * @param {string} name
 * @param {'bengle'|'de1'|null} [machineClass]  REQUIRED for a row in
 *   `MACHINE_DEPENDENT_AUTHORING_RANGES`; ignored, and safely omitted, for every other row.
 */
export function authoringRange(name, machineClass = MACHINE_CLASS_NOT_STATED) {
    const stated = machineClass !== MACHINE_CLASS_NOT_STATED;
    if (!stated && MACHINE_DEPENDENT_AUTHORING_RANGES.includes(name)) {
        /* THE UNIT IS SPELLED IN A PLAIN FRAGMENT, NOT AN INTERPOLATED ONE, and that is
         * not fussiness: Gate D reads every interpolated template literal containing a
         * slash as a route assembled from fragments, and "mL" over "s" has one. The
         * number stays derived from the map above — an error message quoting a ceiling
         * it typed out itself is a second copy of it, one scale smaller. */
        throw new Error(
            `profile-modes: "${name}" is MACHINE-DEPENDENT — its ceiling is `
            + `${FLOW_TARGET_CEILING_BY_MACHINE_CLASS.bengle}`
            + ' mL/s on a Bengle and lower on a DE1, so it cannot be read without stating '
            + 'the machine class. Pass '
            + `${MACHINE_CLASSES.join(', ')} or null as the second argument; null means `
            + '"not known yet" and answers with the narrower band. The class comes from '
            + 'capabilities.machineClass() (adapters-r.js machineClassFromServedSet), never '
            + 'from a model name (A3).',
        );
    }
    const range = authoringRangesFor(stated ? machineClass : null)[name];
    if (!range) throw new Error(`profile-modes: no authoring range declared for "${name}"`);
    return range;
}

/** The exit-threshold range for an exit type, or null for a type with no threshold. */
export function exitRange(type) {
    if (type === 'pressure') return AUTHORING_RANGES.exitPressure;
    if (type === 'flow') return AUTHORING_RANGES.exitFlow;
    if (type === 'power') return AUTHORING_RANGES.exitPower;
    return null;
}

/* ===========================================================================
 * Per-mode tables
 * =========================================================================== */

/**
 * Per-mode configuration. Ranges are NAMED, never restated:
 *   targetKey    — which lowercase step key stores this mode's primary target
 *   targetRange  — the `AUTHORING_RANGES` entry that range/unit/step come from
 *   seed         — the value a switch INTO this mode seeds
 *   limiterRange — the opposite-channel limiter (flow steps limit pressure, etc.);
 *                  for Power the limiter IS the mandatory pressure cap
 *   numpadTitle / limiterTitle — the control faces (English; the editor localises)
 */
export const MODE_TABLE = Object.freeze({
    flow: Object.freeze({
        pump: 'flow', targetKey: 'flow', targetRange: 'flowTarget', seed: 6.0,
        numpadTitle: 'FLOW',
        limiterRange: 'stepPressureLimit', limiterTitle: 'PRESSURE LIMIT',
    }),
    pressure: Object.freeze({
        pump: 'pressure', targetKey: 'pressure', targetRange: 'pressureTarget', seed: 6.0,
        numpadTitle: 'PRESSURE',
        limiterRange: 'stepFlowLimit', limiterTitle: 'FLOW LIMIT',
    }),
    power: Object.freeze({
        pump: 'power', targetKey: 'power', targetRange: 'powerTarget', seed: 2.0,
        numpadTitle: 'POWER',
        limiterRange: 'powerPressureCap', limiterTitle: 'PRESSURE CAP',
        limiterForced: true,
    }),
    lever: Object.freeze({
        // The lever's target is P0, stored in the existing pressure key.
        pump: 'lever', targetKey: 'pressure', targetRange: 'leverP0', seed: 9.0,
        numpadTitle: 'PRESSURE (P0)',
        limiterRange: 'leverFlowCap', limiterTitle: 'FLOW CAP',
    }),
});

/** The four offerable pump modes, in cycle order. */
export const PUMP_MODE_CYCLE = Object.freeze(['flow', 'pressure', 'power', 'lever']);

/**
 * Display order for the direct-pick segmented selector — Pressure / Flow / Power /
 * Lever. DISPLAY order only; the stored `pump` keys stay lowercase. The faces are
 * Title Case: the in-grid segmented values read as words, not shouted caps.
 */
export const PUMP_MODE_DISPLAY_ORDER = Object.freeze(['pressure', 'flow', 'power', 'lever']);
export const PUMP_MODE_LABEL = Object.freeze({
    flow: 'Flow', pressure: 'Pressure', power: 'Power', lever: 'Lever',
});

/**
 * The pump string ReaPrime cannot express, coerced ONCE where foreign JSON enters.
 *
 * Slate's DE1 v2 default. It is declared here so the coercion has a name and exactly
 * one site (`normalizeImportedStep`); everywhere else an unrecognised mode is refused.
 */
export const DEFAULT_IMPORTED_PUMP = 'flow';

/**
 * The mode config for a pump string. THERE IS NO FALLBACK (A7).
 *
 * The source read an unknown pump as flow (`profile_modes.js:115-117`, "an unknown
 * pump string falls back to flow (legacy)"). That is the fallback class A7 exists
 * for, in the profile domain rather than the snapshot one: a step of a mode this
 * build does not know is silently RE-TYPED, takes flow's ranges, and — because the
 * review sentence's own default was pressure, not flow — words itself as a third
 * thing again. A mode ReaPrime grows next is then invisible instead of loud.
 *
 * So the interior is strict and the tolerance lives at the import boundary, exactly
 * as `normalizeImportedStep` does for an unrepresentable exit type.
 */
export function getModeConfig(pump) {
    const cfg = MODE_TABLE[pump];
    if (!cfg) {
        throw new Error(
            `profile-modes: "${pump}" is not a pump mode (${PUMP_MODE_CYCLE.join(', ')}). `
            + 'Foreign JSON is coerced by normalizeImportedStep at the import boundary; '
            + 'A7 forbids reading an unrecognised mode as flow here.',
        );
    }
    return cfg;
}

/**
 * The target and limiter ranges for a mode, resolved from the one table.
 * Every control that edits a step reads its bounds through here.
 *
 * THE MACHINE CLASS IS AN ARGUMENT, AND IT DEFAULTS TO "NOT KNOWN" RATHER THAN THROWING.
 * Two of the eight (mode, slot) pairs this resolves are machine-dependent — a flow step's
 * target and a pressure step's limiter — and `authoringRange` refuses to answer for those
 * without a stated class. This function states one on every call, so passing nothing here
 * is a deliberate "not known yet" and answers with the narrower band, exactly as an
 * unresolved capability read does. The profile editor's door always passes the real one
 * (`editor-ranges.js createEditorRanges({machineClass})`).
 *
 * @param {'flow'|'pressure'|'power'|'lever'} pump
 * @param {'bengle'|'de1'|null} [machineClass]  from `capabilities.machineClass()` (A3)
 */
export function modeRanges(pump, machineClass = null) {
    const cfg = getModeConfig(pump);
    return {
        target: authoringRange(cfg.targetRange, machineClass),
        limiter: authoringRange(cfg.limiterRange, machineClass),
    };
}

/**
 * Which pump chips to render for a step's selector (pure decision; DOM lives in
 * the component). `offered` = are the advanced Power/Lever modes offered for
 * authoring — a capability answer the caller computes. Gating:
 *   • offered  -> the full Pressure / Flow / Power / Lever row.
 *   • !offered -> Pressure / Flow only — UNLESS this step is ALREADY power/lever,
 *     in which case its own chip is included so a loaded advanced profile stays
 *     full-fidelity (selected, and switchable back to flow/pressure).
 * Returned keys are always in `PUMP_MODE_DISPLAY_ORDER`.
 */
export function pumpChipsFor(step, offered) {
    if (offered) return PUMP_MODE_DISPLAY_ORDER.slice();
    const base = ['pressure', 'flow'];
    const pump = step && step.pump;
    if (pump && !base.includes(pump)) {
        return PUMP_MODE_DISPLAY_ORDER.filter((p) => base.includes(p) || p === pump);
    }
    return base;
}

/* ===========================================================================
 * Lever presets (editor-only)
 * =========================================================================== */

/**
 * PRESET INVARIANT: a feel preset sets the SPRING CHARACTER ONLY — Spring
 * (`leverSpring`, bar per 10 mL) plus Give (`leverGive`, bar per mL/s). It NEVER
 * touches P0 (`step.pressure`): P0 is the barista's recipe choice and changing the
 * feel must not silently move the peak pressure.
 */
export const LEVER_PRESETS = Object.freeze({
    CLASSIC: Object.freeze({ leverSpring: 0.9, leverGive: 1.5 }),  // traditional strong-then-easing
    GENTLE: Object.freeze({ leverSpring: 0.6, leverGive: 2.5 }),   // high give — forgiving of prep
    FIRM: Object.freeze({ leverSpring: 0.4, leverGive: 0.8 }),     // low give — precise, dialed-in
});

/** Human feel-word for a preset (used by the review sentence). */
export const LEVER_FEEL_WORD = Object.freeze({ CLASSIC: 'classic', GENTLE: 'gentle', FIRM: 'firm' });

/**
 * Infer the preset name from a step's SPRING+GIVE (feel) alone, else CUSTOM.
 * Inference is on the feel legs only — a CLASSIC-feel step authored at P0 = 8 bar
 * must still read CLASSIC. P0 is not part of the feel.
 */
export function inferLeverPreset(step) {
    if (!step) return 'CUSTOM';
    // A step with no feel legs at all cannot match a named preset.
    if (!('leverSpring' in step) || !('leverGive' in step)) return 'CUSTOM';
    for (const [name, preset] of Object.entries(LEVER_PRESETS)) {
        if (nEq(step.leverSpring, preset.leverSpring) && nEq(step.leverGive, preset.leverGive)) {
            return name;
        }
    }
    return 'CUSTOM';
}

/* ===========================================================================
 * Mode-switch mutation, and the mandatory power cap
 * =========================================================================== */

/**
 * The default power pressure cap, written ONCE — the source stated `{9.0, 0.6}`
 * in three places. `range` is the limiter's soft-knee width, not a bound.
 */
export const POWER_CAP_DEFAULT = Object.freeze({ value: 9.0, range: 0.6 });

/** A fresh copy of the default cap (the step owns its limiter object). */
function powerCapDefault() {
    return { value: POWER_CAP_DEFAULT.value, range: POWER_CAP_DEFAULT.range };
}

/* ===========================================================================
 * A BRAND-NEW STEP — Ben's own six values, 27 August 2026
 * =========================================================================== */

/**
 * WHAT A STEP LOOKS LIKE WHEN NOBODY HAS AUTHORED IT YET, declared ONCE.
 *
 * WHY IT EXISTS AT ALL. Two surfaces needed a blank step on 27 August 2026 and neither
 * had one. Ben, on the selector's + button: "in profile selector, if I press the button
 * to make a new profile it loads the profile editor but there is no steps, wich means
 * there is not + button to add a new step etc, ie I cannot add any steps." And the step
 * matrix's five footer keys — one of which is INSERT STEP AFTER — dispatched an event no
 * listener in the tree ever heard, so the other caller did not exist yet either. Both
 * halves are answered from this one object, because a blank step written twice is a blank
 * step that will disagree with itself the first time either copy is corrected.
 *
 * THE VALUES ARE BEN'S, VERBATIM, 27 August 2026: "Please make it so when I make a new
 * profile the profile editor starts with a single step. It can be a pressure profile step
 * with a target of 8bar, flow limit of 8ml/s and a target temperature of 85c at the coffee
 * duration of 30s, no exit conditions."
 *
 *   pump 'pressure' + pressure 8      the mode and its target key (MODE_TABLE.pressure
 *                                     targetKey), so the Target cell reads 8 bar
 *   limiter {value: 8, ...}           "flow limit of 8ml/s" — a pressure step's limiter
 *                                     IS its flow limit (MODE_TABLE.pressure limiterRange
 *                                     = stepFlowLimit), so the number needs no second name
 *   temperature 85 + sensor 'coffee'  "a target temperature of 85c at the coffee ..."
 *   seconds 30                        "... duration of 30s"
 *   exit null                         "no exit conditions"
 *
 * EIGHT BAR, NOT MODE_TABLE.pressure.seed's SIX, AND THE SIX STAYS WHERE IT IS. The two
 * numbers answer different questions and collapsing them would be a silent behaviour
 * change nobody asked for. `MODE_TABLE[...].seed` is documented in this file as "the value
 * a switch INTO this mode seeds" — it is what `seedStepForPump` writes when an EXISTING
 * step changes pump mode and the target key it lands on is absent or zero, and it is
 * Slate's own PUMP_SEED_PRESSURE = 6.0 (`profile_editor.js:507`). Moving it to 8 would
 * re-seed every flow-to-pressure switch in every profile anyone edits, on a machine, for
 * a request that was about the FIRST step of a NEW profile. Ben's 8 wins here, where he
 * put it, and the mode table's 6 is left alone. (Slate draws exactly the same line: its
 * PUMP_SEED_* pair and its DEFAULT_STEP are separate declarations, and its own comment on
 * the seeds says "Not part of the persisted step shape — see makeNewStep()".)
 *
 * THE OTHER FIVE KEYS ARE THE SHAPE, NOT A CHOICE. `transition: 'fast'` is what
 * `transitionSegments` already treats as the absent-value default ("active: ... ||
 * 'fast'"), and it is the only legal transition for a first step anyway — HOLD is
 * disabled at index 0 because it has no previous step to latch. `volume` and `weight` are
 * 0, which is how the 147-record fixture spells "this step does not stop on that", and
 * they are part of "no exit conditions" as much as `exit: null` is. `name` is EMPTY and
 * that is deliberate — see NEW_STEP_NAME_KEY.
 *
 * THE LIMITER'S `range` IS NOT A SIXTH NUMBER OF BEN'S. It is the soft-knee width, which
 * this file already declares exactly once (POWER_CAP_DEFAULT.range, "the limiter's
 * soft-knee width, not a bound") and which `limiterOnClear` already re-uses for every
 * non-power mode. Reading it from there rather than typing 0.6 again is the same rule the
 * cap itself was written under: "the source stated {9.0, 0.6} in three places".
 *
 * NO BOUND IS DECLARED HERE (B2). Every value above is a VALUE. The ranges these values
 * have to sit inside are `AUTHORING_RANGES` and `machine-limits.js` and stay there;
 * `test/profile-modes.test.mjs` asserts the seed lands inside them rather than restating
 * one of them, so a ceiling that moves is caught here instead of being re-typed here.
 */
export const NEW_STEP = Object.freeze({
    name: '',
    pump: 'pressure',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 85,
    sensor: 'coffee',
    pressure: 8,
    limiter: Object.freeze({ value: 8, range: POWER_CAP_DEFAULT.range }),
});

/**
 * THE NAME A NEW STEP IS SHOWN UNDER, as an i18n KEY and not as text.
 *
 * D2 says every string a person reads is a translated value, and this module is DOM-free
 * — it has no `t()` and must never grow one. So the WORD lives here as a key (the key IS
 * its English text, `i18n/source/README.md`'s rule) and the translation happens at the
 * two call sites that have an I18nController: the selector's new-profile door and the
 * editor's insert-after. That is exactly how `step-matrix-rows.js` carries
 * HELD_TARGET_TEXT and CELL_NAME_KEY across the same boundary.
 *
 * `newStep()` DEFAULTS TO THE EMPTY STRING rather than to this key, because a step name
 * is PERSISTED CONTENT — it goes to the machine inside the profile — and a caller with no
 * translator must not write an untranslated English word into somebody's saved profile.
 * An empty name renders as the head cell's ordinal alone ("1.") and reads as an unnamed
 * step, which is honest; Slate seeds the literal "New Step" and the person then has to
 * clear it before typing their own.
 */
export const NEW_STEP_NAME_KEY = 'New step';

/**
 * A FRESH, MUTABLE blank step — the same pattern, and for the same reason, as
 * `powerCapDefault()` above: the step owns its own limiter object.
 *
 * NEW_STEP is frozen and its `limiter` is frozen with it, so handing the constant itself
 * to a draft would put ONE object into a list that may end up holding several of them. The
 * draft writer copies a step before changing it, so nothing would break today — but
 * `seedStepForPump` writes THROUGH a step's limiter (`step.limiter.value = clamp(...)`),
 * and the day two inserted steps share one limiter object is the day editing one of them
 * silently edits the other. Copy at the door, always.
 *
 * @param {{name?: string}} over  the caller's own translated name, when it has one
 */
export function newStep({ name = '' } = {}) {
    return {
        ...NEW_STEP,
        name: typeof name === 'string' ? name : '',
        limiter: { value: NEW_STEP.limiter.value, range: NEW_STEP.limiter.range },
    };
}

/**
 * Switch a step into `newPump`, seeding it. Mutates in place and returns the step:
 * sets `pump`, deletes stale target/lever keys, seeds the new target, and applies
 * the forced Power cap / CLASSIC lever triple.
 */
export function seedStepForPump(step, newPump) {
    const cfg = MODE_TABLE[newPump];
    if (!step || !cfg) return step;
    const keep = cfg.targetKey;
    step.pump = newPump;

    // Delete the sibling target keys. Note lever and pressure share 'pressure'.
    for (const k of ['flow', 'pressure', 'power']) {
        if (k !== keep && (k in step)) delete step[k];
    }
    // Lever-only params are stale on any non-lever mode.
    if (newPump !== 'lever') {
        delete step.leverSpring;
        delete step.leverGive;
    }

    if (newPump === 'lever') {
        // A mode SWITCH seeds a fresh lever step: P0 = the lever seed and the
        // CLASSIC feel. (A preset PICK later never re-touches P0 — the preset
        // invariant — but the switch itself is a reset, so it seeds P0.)
        step.pressure = cfg.seed;
        step.leverSpring = LEVER_PRESETS.CLASSIC.leverSpring;
        step.leverGive = LEVER_PRESETS.CLASSIC.leverGive;
        // LEVER defines its own P0 − spring·V − give·F trajectory, so the
        // frame-spanning JUMP/RAMP/HOLD transition does not apply: force JUMP at
        // switch time. Lever is the ONLY mode that seeds a forced transition.
        step.transition = 'fast';
    } else {
        // Seed the target if absent or zero (preserve a shared key's prior value).
        if (!num(step[keep])) step[keep] = cfg.seed;
        if (newPump === 'power') {
            // The transition is deliberately NOT forced: the firmware honours a
            // watts-domain ramp, so an authored Ramp must survive a switch into
            // Power exactly like flow/pressure.
            //
            // The pressure cap is soft-mandatory. Force the default when unset OR
            // zeroed — the same value>0 test `normalizeImportedStep` uses, not a
            // truthy guard that would let a carried-over {value: 0} limiter through.
            const cap = authoringRange('powerPressureCap');
            if (!step.limiter || !(num(step.limiter.value) > 0)) {
                step.limiter = powerCapDefault();
            } else {
                // A carried-over limiter (a flow step's mL/s soft-knee, say) must not
                // survive as a sub-min or over-ceiling bar cap, so a 0.5 mL/s flow
                // limit cannot become a 0.5 bar pressure cap.
                step.limiter.value = clamp(num(step.limiter.value), cap.min, cap.max);
            }
        }
    }
    return step;
}

/**
 * The limiter a step's clear gesture (the editor's long-press) should produce.
 * Power's pressure cap is soft-mandatory — the editor must never let it reach 0 —
 * so clearing a power step RESEEDS the default cap; every other mode clears to 0.
 */
export function limiterOnClear(pump) {
    if (pump === 'power') return powerCapDefault();
    return { value: 0, range: POWER_CAP_DEFAULT.range };
}

/* ===========================================================================
 * Load-time normalisation — THE IMPORT BOUNDARY ONLY
 * =========================================================================== */

/**
 * Coerce a step onto its mode's shape WITHOUT demoting Power or Lever to flow.
 * Mutates in place; returns the step. A pump string this build does not know is
 * rewritten to `DEFAULT_IMPORTED_PUMP` HERE and nowhere else (A7 — see below).
 *
 * RUN THIS ONLY WHERE A PROFILE ENTERS THE SKIN FROM SOMEWHERE THAT IS NOT
 * ReaPrime — locally-authored JSON, a file import, a legacy TCL profile. For a
 * record fetched from ReaPrime every branch below is unreachable, because the
 * server's own model already guarantees the shape (`ProfileStepPressure.toJson`
 * emits `pressure` with no `flow`; `ProfileStepPower.fromJson` throws on a null
 * limiter; `StepExitCondition.fromJson` throws outside pressure|flow|power). A
 * "normalisation" applied to a fetched record is a fallback path with a long fuse:
 * it looks harmless right up until the server changes and it silently rewrites.
 *
 * ORDERING at the import boundary: `sanitizeProfileForRea` (src/data/rea-profile.js)
 * owns the two translations between the skin's DE1 v2 spelling and ReaPrime's —
 * a `weight` exit folded into `step.weight`, and an `off` exit as a missing one —
 * and it must run BEFORE this, because what is left afterwards is exactly the set
 * of exit types ReaPrime can express and anything else is genuinely unrepresentable.
 */
export function normalizeImportedStep(step) {
    if (!step || typeof step !== 'object') return step;
    // THE ONE SITE where an unrecognised pump becomes a known one, and it is a
    // WRITE on the step so the coercion is visible in the record afterwards. The
    // source did this implicitly on every read instead (`MODE_TABLE[pump] ||
    // MODE_TABLE.flow`), which re-typed the step differently on different surfaces
    // and left nothing behind to see. A7: coerce at the boundary, once, or not at all.
    if (!MODE_TABLE[step.pump]) step.pump = DEFAULT_IMPORTED_PUMP;
    const cfg = MODE_TABLE[step.pump];
    {
        const keep = cfg.targetKey;
        for (const k of ['flow', 'pressure', 'power']) {
            if (k !== keep && (k in step)) delete step[k];
        }
        if (step.pump !== 'lever') {
            delete step.leverSpring;
            delete step.leverGive;
        }
    }
    // Power's pressure cap is mandatory and must never be 0.
    if (step.pump === 'power') {
        if (!step.limiter || !(num(step.limiter.value) > 0)) {
            step.limiter = powerCapDefault();
        }
    } else if (step.limiter && step.limiter.value === 0) {
        step.limiter = null;
    }
    // A power exit ROUND-TRIPS on load, so a profile authored on a capable machine
    // stays full-fidelity everywhere: degrade visibly, never silently.
    if (step.exit && !REA_EXIT_TYPES.includes(step.exit.type)) {
        step.exit = null;
    }
    return step;
}

/* ===========================================================================
 * Review-sentence part builders (templates as data)
 * =========================================================================== */

/**
 * Returns `{ main: [seg…], limiter: [seg…]|null }` for Power/Lever steps, else
 * null (flow/pressure keep the editor's existing sentences). A seg is either
 *   { t:'text', text }                              — literal prose
 *   { t:'num', field, value, step, unit, min, max } — an editable number slot
 * where `field` is the step key to write. Prose is verbatim; every bound is read
 * from `AUTHORING_RANGES`, so a slot cannot disagree with the control beside it.
 */
export function describeModeParts(step) {
    const pump = step && step.pump;
    if (pump === 'power') {
        const cap = num(step.limiter && step.limiter.value);
        const target = authoringRange('powerTarget');
        const capRange = authoringRange('powerPressureCap');
        return {
            main: [
                { t: 'text', text: 'to a constant hydraulic power of' },
                { t: 'num', field: 'power', value: num(step.power), step: target.step, unit: target.unit, min: target.min, max: target.max },
                { t: 'text', text: '— pressure and flow find their own balance on the puck' },
            ],
            limiter: cap > 0 ? [
                { t: 'text', text: '. Never exceed' },
                { t: 'num', field: 'limiter', value: cap, step: capRange.step, unit: capRange.unit, min: capRange.min, max: capRange.max },
                { t: 'text', text: '(hard pressure cap)' },
            ] : null,
        };
    }
    if (pump === 'lever') {
        const preset = inferLeverPreset(step);
        const cap = num(step.limiter && step.limiter.value);
        const p0 = authoringRange('leverP0');
        const spring = authoringRange('leverSpring');
        const give = authoringRange('leverGive');
        const capRange = authoringRange('leverFlowCap');
        let main;
        if (preset === 'CUSTOM') {
            main = [
                // No leading "to " — the review prepends "Engage" (lever carries no
                // transition verb): "Engage a custom spring-lever source…".
                { t: 'text', text: 'a custom spring-lever source: start at' },
                { t: 'num', field: 'pressure', value: num(step.pressure), step: p0.step, unit: p0.unit, min: p0.min, max: p0.max },
                { t: 'text', text: ', dropping' },
                { t: 'num', field: 'leverSpring', value: num(step.leverSpring), step: spring.step, unit: 'bar per 10 mL delivered', min: spring.min, max: spring.max },
                { t: 'text', text: 'with' },
                { t: 'num', field: 'leverGive', value: num(step.leverGive), step: give.step, unit: 'bar per mL/s of give', min: give.min, max: give.max },
            ];
        } else {
            const feel = LEVER_FEEL_WORD[preset] || 'classic';
            main = [
                { t: 'text', text: `a ${feel} spring-lever feel, starting near` },
                { t: 'num', field: 'pressure', value: num(step.pressure), step: p0.step, unit: p0.unit, min: p0.min, max: p0.max },
                { t: 'text', text: 'and easing as the shot pours' },
            ];
        }
        return {
            main,
            limiter: cap > 0 ? [
                { t: 'text', text: '. Cap flow at' },
                { t: 'num', field: 'limiter', value: cap, step: capRange.step, unit: capRange.unit, min: capRange.min, max: capRange.max },
            ] : null,
        };
    }
    return null;
}

/* ===========================================================================
 * Segmented-control geometry
 * =========================================================================== */

/** 4+ options are sized to their labels; 2–3 stay equal, which reads as a toggle. */
export const PROPORTIONAL_FROM = 4;

/**
 * Slice widths for the one-pill segmented control with a sliding indicator.
 *
 * On a 4-way row (Pressure/Flow/Power/Lever) equal slices overflow — "Pressure"
 * spills into its neighbour — so 4+ options are weighted by how wide their label
 * ACTUALLY renders, plus a fixed gutter of breathing room. 2–3 options stay equal.
 *
 * The measurement is the caller's because this module has no DOM and no face: a
 * component passes `measure` (a canvas `measureText` or a cached advance table)
 * and `gutter` in pixels of the face it is rendering. Both are REQUIRED for the
 * proportional case and there is no default — the old `label.length + 2` was a
 * per-character measurer with a two-character gutter baked in, correct only for
 * four known Latin words and wrong for every translation of them.
 *
 *   labels  — the visible segment faces (strings)
 *   totalW  — the pill's pixel width
 *   pad     — inner padding each side (indicator and segments live inside it)
 *   equal   — force uniform slices (the lever-preset row)
 *
 * Returns per-segment widths, cumulative offsets, and the active indicator's
 * left/width. `tightFont` flags the 4+ case so a long face can take a tighter
 * face; it is a flag, not a size.
 */
export function segmentGeometry(labels, totalW, { pad = 4, equal = false, measure = null, gutter = null } = {}) {
    const n = labels.length;
    const inner = totalW - pad * 2;
    const proportional = !equal && n >= PROPORTIONAL_FROM;

    let weights;
    if (proportional) {
        if (typeof measure !== 'function' || !Number.isFinite(gutter) || gutter < 0) {
            throw new Error(
                `profile-modes: segmentGeometry needs a text measurer and a pixel gutter for ${n} `
                + 'segments — pass { measure, gutter } from the component that owns the face. '
                + 'Sizing by character count truncates the moment the labels are translated.',
            );
        }
        weights = labels.map((label) => {
            const width = measure(String(label));
            if (!Number.isFinite(width) || width < 0) {
                throw new Error(`profile-modes: measure("${label}") returned ${width}; expected a pixel width`);
            }
            return width + gutter;
        });
    } else {
        weights = labels.map(() => 1);
    }

    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const widths = weights.map((w) => (w / wSum) * inner);
    const offsets = widths.reduce(
        (acc, _w, i) => (acc.push(i ? acc[i - 1] + widths[i - 1] : 0), acc), []);
    return {
        pad, inner, weights, widths, offsets, proportional, tightFont: n >= PROPORTIONAL_FROM,
        indicatorLeft: (i) => pad + (offsets[Math.max(0, i)] || 0),
        indicatorWidth: (i) => widths[Math.max(0, i)] || 0,
    };
}

/* ===========================================================================
 * Transition toggle — options and the disabled RULES
 * =========================================================================== */

/**
 * Unavailable transitions render GREYED-BUT-VISIBLE, because an option vanishing
 * reads worse than an option refusing. `holdOffered` = is HOLD authorable on this
 * machine (a capability answer the caller computes). Returns:
 *   options  — [{label, value, disabled}] (English; the component localises)
 *   readOnly — grey ALL segments (LEVER pins JUMP; a foreign HOLD on a machine
 *              that does not offer HOLD is shown read-only, never rewritten)
 *   active   — the value the indicator sits on (LEVER pins on JUMP)
 *
 * GATING and GREYING stay distinct: HOLD is only PRESENT when the machine offers
 * it or the step already carries it; when present it may still be greyed by rule.
 */
export function transitionSegments(step, index, holdOffered) {
    const isLever = (step && step.pump) === 'lever';
    const isHold = (step && step.transition) === 'hold';
    const holdShown = !!holdOffered || isHold;
    /* SLATE'S OWN TWO WORDS, and they are the wire's two words as well.
     *
     * MEASURED 25 AUGUST 2026 against the running Slate: `.pe-grid-cell` on the
     * Transition row reads "Fast" and "Smooth". This table said "Jump" and "Ramp",
     * and the earlier comparison run had already caught it — cmp-seh-2, "Transition
     * vocabulary Fast|Smooth -> Jump|Ramp UNDECLARED". An undeclared rename is the
     * one kind this port does not keep.
     *
     * THE REVIEW SENTENCE STILL SAYS "Jump", AND SO DOES SLATE'S. Its review tab
     * reads "Jump to a flow rate of 12 mL/s", so the two surfaces genuinely use two
     * words for one wire value — which is this file's own rule, stated at the ranges
     * table: "wording is verbatim per surface". `describeModeParts` below is
     * untouched. */
    const options = [
        { label: 'Fast', value: 'fast' },
        { label: 'Smooth', value: 'smooth' },
    ];
    if (holdShown) options.push({ label: 'Hold', value: 'hold', disabled: index === 0 });
    return {
        options,
        readOnly: isLever || (isHold && !holdOffered),
        active: isLever ? 'fast' : ((step && step.transition) || 'fast'),
    };
}

/* ===========================================================================
 * The review sentence, verbatim
 * =========================================================================== */

/**
 * Returns an array of LINES; each line is an array of SEGMENTS, a tuple whose
 * first element is its kind:
 *   ['t', text]                                  — literal prose, carrying its own
 *                                                  spacing, so joining with NO
 *                                                  separator reproduces the exact
 *                                                  sentence (this is what kills the
 *                                                  "puck . Never exceed" flex gap)
 *   ['num', field, value, step, unit, min, max]  — an editable number slot
 *   ['tog', kind, label]                         — a toggle word
 *   ['lev', label]                               — a lever value routed to the modal
 *
 * WORDING IS VERBATIM except the documented HOLD-power deviation ("pressure" ->
 * "power"): a HOLD-power step holds the previous POWER, since the firmware latches
 * watts for it — semantic truth over template.
 *
 * `machineRanges.temperature` is REQUIRED and comes from `machine-limits.js`
 * (`brewTemp`). A step's brew temperature is a MACHINE limit, this module declares
 * none, and B2 allows exactly one table per field: a default here would be the
 * second copy. It throws rather than guessing (A7).
 *
 * `machineClass` IS OPTIONAL AND IS NOT THE SAME KIND OF THING, so it does not throw.
 * The brew range is a table this module does not have; the class is an input to a table
 * it does have, and "not known yet" is a real value for it that answers with the narrower
 * of two known bands (see `UNKNOWN_MACHINE_CLASS_IS_OFFERED` above). What it MUST NOT be
 * is silently different from what the grid stepper beside the sentence is using — the two
 * flow ceilings became machine-dependent on 27 August 2026, and a review sentence reading
 * 15 mL/s next to a stepper that goes to 20 would be the very defect (a per-surface
 * disagreement about one field) that collapsing the three copies into this table cured.
 * So the editor screen passes the door's own class here, from the one place it enters.
 */
export function reviewStepSpec(step, { machineRanges, machineClass = null } = {}) {
    const temperature = machineRanges && machineRanges.temperature;
    if (!temperature || !Number.isFinite(temperature.min) || !Number.isFinite(temperature.max)) {
        throw new Error(
            'profile-modes: reviewStepSpec needs { machineRanges: { temperature } } — the brew '
            + 'temperature is a MACHINE limit (machine-limits.js `brewTemp`), and B2 allows '
            + 'exactly one table per field, so this module declares no range for it.',
        );
    }

    const lines = [];
    // A7: the mode is taken as given or REFUSED — never re-typed. The source
    // defaulted to flow here and then worded an unrecognised step as a PRESSURE
    // step below, so the same unknown mode read as two different steps. The branches
    // that follow are exhaustive because this throws for anything outside the table.
    const pump = getModeConfig(step && step.pump).pump;
    const isRamp = step.transition === 'smooth';
    const isHold = step.transition === 'hold';
    const probe = step.sensor === 'water' ? 'water' : 'coffee';

    // Line 1 — temperature. The step is the machine range's own, so integers read
    // clean ("93") while a 92.5 stays accurate.
    lines.push([
        ['t', 'Set '],
        ['tog', 'probe', probe],
        ['t', ' temperature to '],
        ['num', 'temperature', num(step.temperature), temperature.step, '°C', temperature.min, temperature.max],
    ]);

    // Exit mapping: TIME folds into the rate line and the pressure/flow condition
    // plus volume/weight combine into one "Move on if…" line.
    const secondsRange = authoringRange('seconds');
    const seconds = num(step.seconds);
    const volume = num(step.volume);
    const weight = num(step.weight);
    const exit = step.exit && step.exit.type !== 'off' ? step.exit : null;
    const exitVal = exit ? num(exit.value) : 0;
    const timeClause = seconds > 0
        ? [['t', isRamp ? ' over ' : ' for '],
           ['num', 'seconds', seconds, secondsRange.step, secondsRange.unit, secondsRange.min, secondsRange.max]]
        : [];

    // Line 2 — the rate, with time and limiter appended as one string so
    // punctuation attaches with no gap.
    const rate = [];
    const lim = num(step.limiter && step.limiter.value);
    if (isHold) {
        // DEVIATION (documented): the base template's held word is
        // flow ? 'flow rate' : 'pressure'; a HOLD-power step says "power" because
        // the firmware latches watts for it.
        const what = pump === 'flow' ? 'flow rate' : pump === 'power' ? 'power' : 'pressure';
        rate.push(['tog', 'trans', 'Hold'], ['t', ' the previous '], ['tog', 'pumpword', what], ...timeClause);
    } else if (pump === 'power') {
        const target = authoringRange('powerTarget');
        rate.push(
            ['tog', 'trans', isRamp ? 'Ramp' : 'Jump'], ['t', ' to a constant '],
            ['tog', 'pumpword', 'hydraulic power'], ['t', ' of '],
            ['num', 'power', num(step.power), target.step, target.unit, target.min, target.max],
            ['t', ' — pressure and flow find their own balance on the puck'], ...timeClause);
    } else if (pump === 'lever') {
        const preset = inferLeverPreset(step);
        const p0 = authoringRange('leverP0');
        const spring = authoringRange('leverSpring');
        const give = authoringRange('leverGive');
        if (preset === 'CUSTOM') {
            rate.push(
                ['t', 'Engage a '], ['tog', 'pumpword', 'custom spring-lever source'], ['t', ': start at '],
                ['lev', `${revFmt(num(step.pressure), p0.step)} ${p0.unit}`], ['t', ', dropping '],
                ['lev', `${revFmt(num(step.leverSpring), spring.step)} bar per 10 mL delivered`], ['t', ' with '],
                ['lev', `${revFmt(num(step.leverGive), give.step)} ${give.unit}`], ['t', ' of give'], ...timeClause);
        } else {
            const feel = LEVER_FEEL_WORD[preset] || 'classic';
            rate.push(
                ['t', 'Engage a '], ['lev', feel], ['t', ' '], ['tog', 'pumpword', 'spring-lever'],
                ['t', ' feel, starting near '], ['lev', `${revFmt(num(step.pressure), p0.step)} ${p0.unit}`],
                ['t', ' and easing as the shot pours'], ...timeClause);
        }
    } else {
        // flow or pressure — the only modes left, because getModeConfig refused
        // anything outside the table above. One rule for the word, the unit and the bound.
        const target = authoringRange(pump === 'flow' ? 'flowTarget' : 'pressureTarget', machineClass);
        const pumpWord = pump === 'flow' ? 'flow rate' : 'pressure';
        const field = pump === 'flow' ? 'flow' : 'pressure';
        rate.push(
            ['tog', 'trans', isRamp ? 'Ramp' : 'Jump'], ['t', ' to a '],
            ['tog', 'pumpword', pumpWord], ['t', ' of '],
            ['num', field, num(step[field]), target.step, target.unit, target.min, target.max], ...timeClause);
    }
    if (lim > 0) {
        // Every limiter slot reads the SAME entry its stepper does — this is where
        // the Review path used to carry its own, larger ceilings (16 bar / 15 mL/s).
        const limiter = authoringRange(MODE_TABLE[pump].limiterRange, machineClass);
        if (pump === 'power') {
            rate.push(['t', '. Never exceed '],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max],
                ['t', ' (hard pressure cap)']);
        } else if (pump === 'lever') {
            rate.push(['t', '. Cap flow at '],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max]);
        } else {
            const targetKind = pump === 'flow' ? 'flow' : 'pressure';
            const limiterKind = pump === 'flow' ? 'pressure' : 'flow';
            rate.push(['t', `. Limit ${targetKind} if ${limiterKind} approaches `],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max]);
        }
    }
    lines.push(rate);

    // Line 3 — the combined exit conditions ("Move on if …, or if we reach …").
    const triggerParts = [];
    const exitBounds = exit ? exitRange(exit.type) : null;
    if (exit && exitVal > 0 && exitBounds) {
        const dir = exit.condition === 'under' ? 'falls below' : 'rises above';
        triggerParts.push([
            ['t', `${exit.type} `], ['tog', 'exitcmp', dir], ['t', ' '],
            ['num', 'exitValue', exitVal, exitBounds.step, exitBounds.unit, exitBounds.min, exitBounds.max],
        ]);
    }
    const reachParts = [];
    const volumeRange = authoringRange('volume');
    const weightRange = authoringRange('weight');
    if (volume > 0) reachParts.push(['num', 'volume', volume, volumeRange.step, volumeRange.unit, volumeRange.min, volumeRange.max]);
    if (weight > 0) reachParts.push(['num', 'weight', weight, weightRange.step, weightRange.unit, weightRange.min, weightRange.max]);
    if (reachParts.length) {
        const reach = [['t', 'we reach ']];
        reachParts.forEach((part, i) => { if (i) reach.push(['t', ' or ']); reach.push(part); });
        triggerParts.push(reach);
    }
    if (triggerParts.length) {
        const line = [['t', 'Move on if ']];
        triggerParts.forEach((part, i) => { if (i) line.push(['t', ', or if ']); line.push(...part); });
        lines.push(line);
    }

    return lines;
}

/** Integers show bare ("9", "93"); fractions take one decimal when the step is < 1. */
export function revFmt(v, step) {
    if (v === null || v === undefined) return '';
    return Number.isInteger(v) ? String(v) : v.toFixed(step < 1 ? 1 : 0);
}

/**
 * Flatten one `reviewStepSpec` line to its plain-text sentence (segments carry
 * their own spacing). For the wording pin; never for app rendering.
 */
export function reviewLineText(line) {
    return line.map((seg) => {
        if (seg[0] === 't') return seg[1];
        if (seg[0] === 'num') return `${revFmt(seg[2], seg[3])} ${seg[4]}`;
        return seg[2] !== undefined && seg[0] === 'tog' ? seg[2] : seg[1];
    }).join('');
}

/* ===========================================================================
 * Preview-graph and overlay derivation
 * =========================================================================== */

/**
 * Per-step channel values for the editor's preview graph. Flow/pressure keep the
 * opposite-channel-0 shape; Power draws flow 0 and pressure AT THE CAP; Lever
 * draws pressure flat at P0 and flow at the flow cap (or 0).
 */
export function stepGraphValues(step) {
    const pump = step && step.pump;
    const cap = num(step && step.limiter && step.limiter.value);
    switch (pump) {
        case 'pressure': return { pressure: num(step.pressure), flow: 0, power: 0 };
        case 'flow': return { pressure: 0, flow: num(step.flow), power: 0 };
        case 'power': return { pressure: cap, flow: 0, power: num(step.power) };
        case 'lever': return { pressure: num(step.pressure), flow: cap, power: 0 };
        default: return { pressure: 0, flow: 0, power: 0 };
    }
}

/**
 * Target-overlay values for the live/history chart's commanded-target traces.
 * Mirrors `stepGraphValues` so the editor preview and the chart cannot disagree,
 * but returns NULL for a channel the step does not command, so the trace shows a
 * GAP rather than a commanded zero:
 *   pressure -> { pressure: P,   flow: null }
 *   flow     -> { pressure: null, flow: F }
 *   power    -> { pressure: cap, flow: null }
 *   lever    -> { pressure: P0,  flow: flowCap || null }
 *   other    -> { pressure: null, flow: null }
 */
export function stepTargetOverlay(step) {
    const pump = step && step.pump;
    if (pump === 'pressure') return { pressure: num(step.pressure), flow: null };
    if (pump === 'flow') return { pressure: null, flow: num(step.flow) };
    if (pump === 'power' || pump === 'lever') {
        const g = stepGraphValues(step);
        return { pressure: g.pressure, flow: g.flow > 0 ? g.flow : null };
    }
    return { pressure: null, flow: null };
}

/**
 * The lever's volume-decline endpoint: P0 dropped over ~30 mL delivered (three
 * times the per-10-mL spring), clamped at 0. Drives the decline overlay — whose
 * dash pattern comes from the chart's one dash table, not from here.
 */
export function leverDeclineP1(step) {
    return Math.max(0, num(step && step.pressure) - 3 * num(step && step.leverSpring));
}

/** True when any step in the list is a Power step (gates the power trace). */
export function anyPowerStep(steps) {
    return Array.isArray(steps) && steps.some((s) => s && s.pump === 'power');
}
