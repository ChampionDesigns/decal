/**
 * step-matrix-rows.js — THE STEP MATRIX'S ROW MODEL, and nothing else.
 *
 * Wave 5.5 (wf-w5p5-editor), rows `step-matrix-grid`, `compact-density`,
 * `locked-value-box`, `matrix-accessibility`, `step-name-input`.
 * `LAYOUT_SPEC_DRAFT.md` §4.3; SCOPE Part 5 §5.
 *
 * ===========================================================================
 * WHY THE ROW LIST IS A MODULE AND NOT A LIST INSIDE THE COMPONENT
 * ===========================================================================
 * §4.3's structural sentence is "one grid holds the sticky row-label rail AND every
 * step column, so a row and its label share a track and align by construction". The
 * half that makes that true is that a row is ONE THING: a label, a primitive, a step
 * key and (when it has bounds) one range field id. Written here, `node:test` can ask
 * what a HOLD step's Target cell is without a browser, and the component is left
 * holding only boxes.
 *
 * Slate's own row order is carried verbatim — `profile_editor.js:535`,
 * `GRID_ROW_KEYS = ['temperature','tempProbe','pump','transition','target','limiter',
 * 'maxDuration','exits']`, with the head row above them and the action row below, and
 * `GRID_GROUP_END = new Set(['tempProbe','limiter'])` (`:580`) as the two group seams.
 * What does NOT come across is the ten `!important` row TRACKS that summed to exactly
 * 1082 (`profile-editor-v3.css:291`, bug E1): a row here declares no height at all.
 *
 * ===========================================================================
 * NO RANGE, NO NUMBER, NO SECOND TABLE  (B2/B3)
 * ===========================================================================
 * NOT ONE BOUND IS WRITTEN HERE. A ranged row carries a `rangeField` — an id from
 * `src/lib/editor-ranges.js`'s `EDITOR_RANGE_FIELDS` — and the component takes the
 * entry through that door, which is itself a door onto `machine-limits.js` and
 * `AUTHORING_RANGES`. `profile_editor.js:489-495` (`targetMaxFor`/`limiterMaxFor`)
 * was the second copy and is not transcribed in any form. A default min/max on a row
 * here would be exactly that copy under a new name.
 *
 * The one number-shaped thing in the file is an ENUM of two strings (`PROBE_OPTIONS`,
 * coffee/water) — a step key's legal values, not a bound.
 *
 * ===========================================================================
 * D2 — EVERY LABEL IS A KEY, AND THE KEY IS ITS ENGLISH TEXT
 * ===========================================================================
 * `i18n/source/README.md`'s rule, so a row's `label` is passed to `t()` at the call
 * site and never rendered raw. The per-cell accessible name is a TEMPLATE with
 * placeholders (`'{label}, step {n}'`), because a name built by concatenating two
 * translated fragments cannot survive a word-order change — the placeholder rule in
 * `i18n/source/strings.json`'s own meta block.
 *
 * DOM-free, framework-free, pure.
 */

import {
    MODE_TABLE,
    PUMP_MODE_LABEL,
    getModeConfig,
    pumpChipsFor,
    transitionSegments,
} from './profile-modes.js';

/* ===========================================================================
 * The primitives a cell can be — each one an inventory component, composed
 * =========================================================================== */

/**
 * WHICH LIBRARY COMPONENT FILLS A CELL. `layout/editor.md` §1.5 measured Slate's three
 * ("Segmented bank | Probe, Pump, Transition", "Stepper | Temperature, Target, Limiter,
 * Max Duration", "Locked box | Target on a HOLD step") and this wave adds the two
 * compounds wave 4 built for the same grid.
 *
 *   head     #6  ui-text-field  — the step name (E7's line-box clearance)
 *   stepper  #4  ui-stepper     — density="compact" (C3)
 *   locked   #43 ui-locked-value — the read-only counterpart of the stepper cell
 *   bank     #3  ui-bank        — the segmented selector
 *   exits    #41 ui-exit-sentence — the exit band (C8)
 *   actions  #42 ui-action-key-rail — five keys, no drag (C7)
 */
export const CELL_KINDS = Object.freeze(['head', 'stepper', 'locked', 'bank', 'exits', 'actions']);

/**
 * The temperature probe's two legal values, with their labels. A step key's ENUM, read
 * off the 147-record fixture (`sensor` is 'coffee' 563 times and 'water' 327, and never
 * anything else) rather than invented, and not a range: `machine-limits.js` and
 * `AUTHORING_RANGES` both declare nothing for it because there is nothing to bound.
 */
export const PROBE_OPTIONS = Object.freeze([
    Object.freeze({ value: 'coffee', label: 'Coffee' }),
    Object.freeze({ value: 'water', label: 'Water' }),
]);

/**
 * What the Target cell says when the step HOLDS the previous one's target.
 * The i18n key IS the English text, and it is Slate's own sentence
 * (`profile_editor.js:1097-1106`, the `makeValueLocked` cell).
 */
export const HELD_TARGET_TEXT = 'Holds previous target';

/** The per-cell accessible-name template (D2, E14). `{label}` is already translated. */
export const CELL_NAME_KEY = '{label}, step {n}';

/** The step-name field's accessible-name template (D2, E7). */
export const STEP_NAME_KEY = 'Step {n} name';

/** The head cell's ordinal line. An existing key whose own note names this screen. */
export const STEP_ORDINAL_KEY = 'Step {n} of {total}';

/* ===========================================================================
 * The ten rows
 * =========================================================================== */

/**
 * THE ROWS, IN SLATE'S ORDER.
 *
 *   key        the row id — this module's own name for the row, and the DOM hook
 *   label      the rail's text, an i18n KEY (D2)
 *   kind       which primitive fills a data cell (see CELL_KINDS)
 *   field      the STEP KEY an edit writes, or null for a row that edits nothing
 *              directly (the head row writes `name`; `target` is mode-dependent and
 *              resolved by `fieldFor`)
 *   rangeField the `editor-ranges.js` field id the bounds come through, or null
 *   groupEnd   does a group seam fall under this row (Slate's GRID_GROUP_END, plus
 *              the head row's own rule at `profile-editor-v3.css:333-338`)
 *
 * The `limiter` row's value lives at `step.limiter.value` — the shape the 147-record
 * fixture carries on all 890 steps (`{value, range}`) and the shape
 * `profile-modes.js describeModeParts` reads. `readValue` unwraps it; a `step-change`
 * event for this row therefore carries the limiter's VALUE, and the draft owner writes
 * `{...step, limiter: {...step.limiter, value}}`.
 */
export const STEP_MATRIX_ROWS = Object.freeze([
    Object.freeze({
        key: 'head',
        label: 'Step',
        kind: 'head',
        field: 'name',
        rangeField: null,
        groupEnd: true,
    }),
    Object.freeze({
        key: 'temperature',
        label: 'Temperature',
        kind: 'stepper',
        field: 'temperature',
        rangeField: 'stepTemperature',
        groupEnd: false,
    }),
    Object.freeze({
        key: 'probe',
        label: 'Probe',
        kind: 'bank',
        field: 'sensor',
        rangeField: null,
        groupEnd: true,
    }),
    Object.freeze({
        key: 'pump',
        label: 'Pump',
        kind: 'bank',
        field: 'pump',
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'transition',
        label: 'Transition',
        kind: 'bank',
        field: 'transition',
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'target',
        label: 'Target',
        kind: 'target',
        field: null,
        rangeField: 'stepTarget',
        groupEnd: false,
    }),
    Object.freeze({
        key: 'limiter',
        label: 'Limiter',
        kind: 'stepper',
        field: 'limiter',
        rangeField: 'stepLimiter',
        groupEnd: true,
        /* OFF IS A STATE, NOT A NUMBER, and this row is the only one that has one.
         *
         * MEASURED 25 AUGUST 2026: Slate draws the limiter cell as
         * `<span class="pe-value-number pe-limiter-off">OFF</span><span
         * class="pe-value-unit">bar</span>`, and the step it drew that for carries
         * `limiter: null`. This matrix drew `0.0 bar` for the same step — a number
         * where the profile states none, and the one reading that says "the limit is
         * set, to zero" when what is true is "there is no limit". `readValue` already
         * answers null here; this is the other half, on the way out.
         *
         * ZERO AND ABSENT ARE THE SAME STATE for this field and that is the authoring
         * range's own note: `stepPressureLimit` min 0 with "0 = no limit", and the
         * same for `stepFlowLimit`. So the label is keyed on the VALUE, which is what
         * both a null and a typed 0 arrive as. */
        zeroLabel: 'OFF',
    }),
    Object.freeze({
        key: 'duration',
        /* THE ONE RAIL LABEL THE CORPUS RECORDS VERBATIM, and it is recorded twice:
         * LAYOUT_SPEC_DRAFT.md §4.3 ("a longer translation of 'Max Duration' spills onto
         * the first data cell") and layout/editor.md §1.5's primitive table. Wording is
         * verbatim per surface (profile-modes.js:140-143); casing is wording. */
        label: 'Max Duration',
        kind: 'stepper',
        field: 'seconds',
        rangeField: 'stepSeconds',
        groupEnd: false,
        /* THE MATRIX SAYS "s" AND THE REVIEW SAYS "sec", and BOTH are Slate's.
         *
         * MEASURED 25 AUGUST 2026, one page, two surfaces: the matrix cell is
         * `<span class="pe-value-number">10</span><span class="pe-value-unit">s</span>`
         * and the review sentence on the same profile reads "for 10 sec". The
         * authoring range carries `sec`, the sentence reads it, and this overrides it
         * for the cell alone.
         *
         * IT IS AN OVERRIDE AND NOT A SECOND RANGE. The bounds, the step and the clamp
         * all still come from `AUTHORING_RANGES.seconds`; what is stated here is the
         * WORD, and profile-modes.js's own ranges table already draws that line —
         * "Units are the measure only ... wording is verbatim per surface". */
        unit: 's',
    }),
    Object.freeze({
        key: 'exits',
        /* SLATE'S OWN WORDS, MEASURED 25 AUGUST 2026: `.pe-grid-label.pe-exits` reads
         * "Exit when". This said "Exit conditions", which is a drift of the same class
         * as the transition rename and is worth more than a word: uppercased, "EXIT
         * CONDITIONS" is 155px and was the single label that would not fit the rail at
         * Slate's small caps (step-matrix.js, DQ-4-A). "EXIT WHEN" fits, so Slate's
         * wording and Slate's typography arrive together. */
        label: 'Exit when',
        kind: 'exits',
        field: null,
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'actions',
        /* SPOKEN, NOT DRAWN. Slate's rail cell for this row is EMPTY
         * (`.pe-grid-label.pe-action`, measured 25 August 2026, no text node), and the
         * row beneath it is five icon buttons that say what they are. The label stays
         * in the table because the accessible name for the row is built from it
         * (`CELL_NAME_KEY`); `step-matrix.js` is what stops drawing it.
         *
         * A LABEL REMOVED FROM THE TABLE WOULD TAKE THE NAME WITH IT — the row would
         * then be an unnamed group of five unlabelled-by-context buttons, which is a
         * worse outcome than the one word this hides. */
        label: 'Step actions',
        railHidden: true,
        kind: 'actions',
        field: null,
        rangeField: null,
        groupEnd: false,
    }),
]);

/** The row ids, in order. */
export const STEP_MATRIX_ROW_KEYS = Object.freeze(STEP_MATRIX_ROWS.map((row) => row.key));

const ROW_BY_KEY = new Map(STEP_MATRIX_ROWS.map((row) => [row.key, row]));

/**
 * One row by id. THERE IS NO FALLBACK (A7): an unknown row is a programming error, and
 * a module that answered with a plausible row would put the caller's typo on screen.
 */
export function matrixRow(key) {
    const row = ROW_BY_KEY.get(key);
    if (!row) {
        throw new Error(
            `step-matrix-rows: "${key}" is not a matrix row (${STEP_MATRIX_ROW_KEYS.join(', ')}).`,
        );
    }
    return row;
}

/* ===========================================================================
 * What one cell of a row is, for one step
 * =========================================================================== */

/** Does this step hold the previous step's target? Slate's locked-box case. */
export function isHeldTarget(step) {
    return Boolean(step) && step.transition === 'hold';
}

/**
 * The primitive this row's cell uses FOR THIS STEP. Only the Target row varies:
 * `layout/editor.md` §1.5, "Locked box | .pe-value-locked | Target on a HOLD step".
 */
export function cellKindFor(row, step) {
    if (row.kind !== 'target') return row.kind;
    return isHeldTarget(step) ? 'locked' : 'stepper';
}

/**
 * The STEP KEY an edit in this cell writes. The Target row is mode-dependent and its
 * key comes from `MODE_TABLE` (`targetKey`) — flow steps write `flow`, pressure and
 * LEVER steps write `pressure` (the lever's target is P0, stored in the pressure key),
 * power steps write `power`. `getModeConfig` throws on an unrecognised mode rather than
 * reading it as flow (A7), and that throw is the honest answer here too.
 */
export function fieldFor(row, step) {
    if (row.kind !== 'target') return row.field;
    const pump = step && step.pump;
    if (!pump) return null;
    return getModeConfig(pump).targetKey;
}

/** The value this cell shows, read off the step. Never a default that stands in. */
export function readValue(row, step) {
    if (!step) return null;
    if (row.key === 'limiter') {
        const held = step.limiter;
        return held && typeof held === 'object' ? held.value ?? null : null;
    }
    const field = fieldFor(row, step);
    if (!field) return null;
    const value = step[field];
    return value === undefined ? null : value;
}

/* ===========================================================================
 * WHICH CHANNEL A CELL'S NUMBER SPEAKS FOR  (parity surface 4)
 * ===========================================================================
 * SLATE INKS EVERY NUMBER IN THE EDITOR IN THE COLOUR OF THE CHANNEL IT BELONGS TO, and
 * the step matrix is where it does it most. This is the same rule surface 1 carried onto
 * the Live rail (`live-targets.js`, "Slate paints a rail target's NUMBER in the colour of
 * the channel that target commands"); the matrix is its second home and was rendering
 * every value in the plain ink.
 *
 * THE ORACLE, `.pe-value-number` across the corpus's three editor states — every value
 * lands on a `--ui-channel-*` name this tree ALREADY SHIPS (chart-channels.css), which is
 * why this is a wiring change and not a palette one:
 *   CITE editor-steps [i=36,43,50] Temperature "84.0"/"68.0"/"75.0"
 *        color = rgb(221, 98, 84)  = #dd6254 = --ui-channel-target-group-temperature
 *   CITE editor-steps [i=97,104]   Target on a FLOW step "12.0"/"0.0"
 *        color = rgb(96, 149, 213) = #6095d5 = --ui-channel-target-flow
 *   CITE editor-steps [i=111]      Target on a PRESSURE step "6.0"
 *        color = rgb(93, 210, 132) = #5dd284 = --ui-channel-target-pressure
 *   CITE editor-steps [i=133]      Limiter on a PRESSURE step "1.0" (unit mL/s)
 *        color = rgb(57, 123, 206) = #397bce = --ui-channel-flow          <- PLAIN
 *   CITE editor-steps [i=141,148,155] Max Duration "20"/"40"/"60"
 *        color = rgb(244, 247, 248) — the plain ink: a duration commands no channel
 *
 * TARGETS TAKE THE TARGET VARIANT, LIMITS TAKE THE PLAIN ONE, and that is the oracle's
 * own distinction rather than a reading of it: [i=111] and [i=133] are both on step 3 and
 * one is #5dd284 while the other is #397bce. chart-channels.css states the reason from
 * the other end — "Targets stay separate channels because their dotted/dashed form
 * represents a COMMAND rather than a measurement" — and a limiter is a ceiling, not a
 * command.
 *
 * THE MAPPING IS DERIVED FROM `MODE_TABLE`, NOT RESTATED. The target's quantity is the
 * mode's `targetKey` and the limiter's is its `limiterRange`, which the port's own table
 * already names ("the opposite-channel limiter (flow steps limit pressure, etc.)"); so a
 * mode added upstream arrives here with its channel rather than needing a second edit.
 * The corpus photographs only flow and pressure steps and the derivation covers all four
 * modes — lever included, whose target IS a pressure (P0, stored in the pressure key).
 *
 * POWER'S TARGET IS DELIBERATELY UNTINTED, and it is the one entry the derivation
 * refuses. There is no `--ui-channel-target-power` in the palette and no Power step in
 * the corpus, so an ink here would be invented at both ends; a power target keeps the
 * plain ink until one of the two answers. Its LIMITER is tinted, because `powerPressureCap`
 * names the quantity outright.
 *
 * THIS FILE NAMES A CHANNEL AND NEVER A COLOUR — `step-matrix.js`'s own sheet turns the
 * name into an ink through `<ui-stepper>`'s declared `--_ui-stepper-number-ink` seam,
 * exactly as `live-screen.js` does for the rail. Not an inline style: bug L11 is "inline
 * wins".
 */

/** The quantity-and-role names a matrix cell can carry. `null` = the plain ink. */
export const MATRIX_CHANNELS = Object.freeze([
    'temperature', 'flow', 'pressure', 'flow-limit', 'pressure-limit',
]);

/** `limiterRange` -> the quantity the limiter caps. The table's own names, read. */
const LIMIT_CHANNEL = Object.freeze({
    stepPressureLimit: 'pressure-limit',
    stepFlowLimit: 'flow-limit',
    powerPressureCap: 'pressure-limit',
    leverFlowCap: 'flow-limit',
});

/** `targetKey` -> the quantity the target commands. `power` is absent on purpose. */
const TARGET_CHANNEL = Object.freeze({ flow: 'flow', pressure: 'pressure' });

/**
 * The channel this cell's number speaks for, or `null` for the plain ink.
 * A step whose pump the table does not know answers `null` rather than guessing (A7).
 */
export function matrixChannel(row, step) {
    if (!row) return null;
    if (row.key === 'temperature') return 'temperature';
    const pump = step && step.pump;
    if (!pump || !(pump in MODE_TABLE)) return null;
    const cfg = MODE_TABLE[pump];
    if (row.key === 'target') return TARGET_CHANNEL[cfg.targetKey] ?? null;
    if (row.key === 'limiter') return LIMIT_CHANNEL[cfg.limiterRange] ?? null;
    return null;
}

/**
 * The segmented bank's options and selection for a bank row.
 *
 * Pump and Transition are the ports' own decisions — `pumpChipsFor(step, offered)` and
 * `transitionSegments(step, index, holdOffered)`, both of which take a CAPABILITY
 * ANSWER the caller computes (B9: a hint from the screen, never an authority invented
 * here). Probe is the two-value enum above.
 *
 * `readOnly` is `transitionSegments`' own: a LEVER step pins JUMP, and a foreign HOLD
 * on a machine that does not offer HOLD is shown read-only rather than rewritten.
 */
export function bankOptionsFor(row, step, index, { pumpModesOffered = false, holdOffered = false } = {}) {
    if (row.key === 'probe') {
        return {
            options: PROBE_OPTIONS.map((option) => ({ ...option, disabled: false })),
            value: (step && step.sensor) || null,
            readOnly: false,
        };
    }
    if (row.key === 'pump') {
        return {
            options: pumpChipsFor(step, pumpModesOffered)
                .map((pump) => ({ value: pump, label: PUMP_MODE_LABEL[pump], disabled: false })),
            value: (step && step.pump) || null,
            readOnly: false,
        };
    }
    if (row.key === 'transition') {
        const segments = transitionSegments(step, index, holdOffered);
        return {
            options: segments.options.map((option) => ({
                value: option.value,
                label: option.label,
                disabled: Boolean(option.disabled),
            })),
            value: segments.active,
            readOnly: segments.readOnly,
        };
    }
    throw new Error(`step-matrix-rows: "${row.key}" is not a bank row`);
}

/**
 * Every (row, step) pair the matrix renders, as data — the enumeration a totality check
 * walks so "every cell resolves to one primitive and at most one range field" is a
 * property of a list rather than of a suite's imagination.
 */
export function enumerateMatrixCells(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const out = [];
    for (const row of STEP_MATRIX_ROWS) {
        list.forEach((step, index) => {
            out.push({
                row: row.key,
                index,
                kind: cellKindFor(row, step),
                field: fieldFor(row, step),
                rangeField: row.rangeField,
            });
        });
    }
    return out;
}
