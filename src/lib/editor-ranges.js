/**
 * The bounds for every editable field, derived from the machine's own limits.
 */

import { authoringRange, modeRanges, getModeConfig, PUMP_MODE_CYCLE } from './profile-modes.js';
import { rangeForSlot, EXIT_SLOT_ORDER } from './exit-sentence.js';
import { hasLimit, MACHINE_CLASSES } from './machine-limits.js';

/**
 * The R2 gap, as data rather than as a comment, so the manifest entry and the screen's
 * own "provisional" marking read from the same place.
 */
export const R2_INTERIM = Object.freeze({
    upstream: 'R2',
    landed: false,
    checkedCommit: '42f67f69334197a08cc0f4138ca05302616e977a',
    basis: 'no route registered at the pin matches limit/range/bound/envelope/constraint '
        + 'across the 149 registrations in lib/src/services/webserver/*.dart, and the three '
        + 'nearest candidates all refuse: capabilities answers feature names with no numbers, '
        + 'stopAtWeight answers the current target rather than a bound, and calibration '
        + 'answers measured values rather than a permitted range',
    note: 'limits from the interim single table pending R2',
});

export const RANGE_SOURCES = Object.freeze([
    'machine', 'authoring', 'mode-target', 'mode-limiter', 'exit-slot',
]);

export const EDITOR_RANGE_FIELDS = Object.freeze([
    Object.freeze({
        field: 'stepTarget',
        surface: 'matrix',
        source: 'mode-target',
        needs: Object.freeze(['pump']),
        why: 'the pump mode decides which of the four target rows applies; MODE_TABLE names it',
    }),
    Object.freeze({
        field: 'stepLimiter',
        surface: 'matrix',
        source: 'mode-limiter',
        needs: Object.freeze(['pump']),
        why: 'the opposite-channel limiter — and on a power step the MANDATORY pressure cap, '
            + 'whose floor is 1 because ProfileStepPower.fromJson throws on a null OR zero limiter',
    }),
    Object.freeze({
        field: 'stepTemperature',
        surface: 'matrix',
        source: 'machine',
        limitKey: 'brewTemp',
        why: 'a step’s brew temperature is a MACHINE limit, not an authoring one — '
            + 'profile-modes.js:111-112 says so and refuses to word a review line without it',
    }),
    Object.freeze({
        field: 'stepSeconds',
        surface: 'matrix',
        source: 'authoring',
        rangeName: 'seconds',
        why: 'the step’s own timed stop',
    }),
    Object.freeze({
        field: 'stepVolume',
        surface: 'matrix',
        source: 'authoring',
        rangeName: 'volume',
        why: 'the step’s own volume stop',
    }),
    Object.freeze({
        field: 'stepWeight',
        surface: 'matrix',
        source: 'authoring',
        rangeName: 'weight',
        why: 'the step’s own weight stop — the field sanitizeProfileForRea folds a weight EXIT into',
    }),
    Object.freeze({
        field: 'stepLeverSpring',
        surface: 'lever-dialog',
        source: 'authoring',
        rangeName: 'leverSpring',
        why: 'lever feel, half one. A preset writes spring AND give and nothing else',
    }),
    Object.freeze({
        field: 'stepLeverGive',
        surface: 'lever-dialog',
        source: 'authoring',
        rangeName: 'leverGive',
        why: 'lever feel, half two. The step target is not touched by a preset',
    }),
    Object.freeze({
        field: 'exitCondition',
        surface: 'exit-band',
        source: 'exit-slot',
        slot: 'condition',
        needs: Object.freeze(['exitType']),
        why: 'exitPressure / exitFlow / exitPower, chosen by the exit type — through the '
            + 'band’s own door so the sentence and the numpad cannot drift',
    }),
    Object.freeze({
        field: 'exitVolume',
        surface: 'exit-band',
        source: 'exit-slot',
        slot: 'volume',
        why: 'the band’s volume slot, same entry as the matrix’s volume — one entry, two fields',
    }),
    Object.freeze({
        field: 'exitWeight',
        surface: 'exit-band',
        source: 'exit-slot',
        slot: 'weight',
        why: 'the band’s weight slot. Stop-at-weight survives the save AND the arm path',
    }),
    Object.freeze({
        field: 'targetWeight',
        surface: 'settings-panel',
        source: 'machine',
        limitKey: 'drinkWeight',
        why: 'the drink out of the machine. machine-limits.js names THE PROFILE EDITOR’S own '
            + 'answer as one of the three that disagreed before drinkWeight existed',
    }),
    Object.freeze({
        field: 'tankTemperature',
        surface: 'settings-panel',
        source: 'machine',
        limitKey: 'tankTemp',
        why: 'the profile\u2019s own tank_temperature, and it is the same physical quantity as '
            + 'the machine row it reads: same water, same sensor, same degrees. Whether the '
            + 'profile should carry it at all is a separate question this entry does not '
            + 'answer \u2014 every profile load writes it to the machine, so it overwrites '
            + 'whatever the settings page holds',
    }),
    Object.freeze({
        field: 'targetVolume',
        surface: 'settings-panel',
        source: 'authoring',
        rangeName: 'volume',
        why: 'the profile’s volume stop. The SAME entry as a step’s volume stop — same measure, '
            + 'same band, and resolving two fields to one entry is what a door is for. '
            + 'Recorded as a deferred question: R2 may serve a machine row for it, which '
            + 'would move this line and change nothing else',
    }),
    Object.freeze({
        field: 'pressureLimitTolerance',
        surface: 'settings-panel',
        source: 'authoring',
        rangeName: 'pressureLimitTolerance',
        why: 'the soft-knee width beside every pressure limit in the profile. An authoring '
            + 'band and not a machine row: it is a shape the author chooses, and the machine '
            + 'states no limit on how wide a knee may be',
    }),
    Object.freeze({
        field: 'flowLimitTolerance',
        surface: 'settings-panel',
        source: 'authoring',
        rangeName: 'flowLimitTolerance',
        why: 'the same width beside every flow limit. TWO entries and not one because the '
            + 'width is measured in the limit’s own unit — bar over a pressure limit, mL/s '
            + 'over a flow limit — so one entry would print one unit over both controls',
    }),
]);

/**
 * THE FIELDS WITH NO ENTRY, and why each absence is a decision rather than an oversight.
 *
 * `rangeFor()` throws for these by name. Neither may be given a literal.
 */
export const UNRANGED_EDITOR_FIELDS = Object.freeze([
    Object.freeze({
        field: 'targetVolumeCountStart',
        surface: 'settings-panel',
        why: 'an INDEX into the profile’s own step list, not a measured quantity. Its bound is '
            + 'steps.length, which is content the editor already holds; a table entry would be a '
            + 'second authority that goes stale the moment a step is added.',
    }),
]);

const FIELD_BY_NAME = new Map(EDITOR_RANGE_FIELDS.map((row) => [row.field, row]));
const UNRANGED_BY_NAME = new Map(UNRANGED_EDITOR_FIELDS.map((row) => [row.field, row]));

/** Every field id this module answers for, in declaration order. */
export const EDITOR_RANGE_FIELD_IDS = Object.freeze(EDITOR_RANGE_FIELDS.map((r) => r.field));

function refuse(field) {
    const declared = UNRANGED_BY_NAME.get(field);
    if (declared) {
        throw new Error(
            `editor-ranges: "${field}" has no range ON PURPOSE — ${declared.why} `
            + 'Do not give it a literal: there is exactly one table, and a stepper default is a '
            + 'second one. Render it unbounded, or unavailable, and say why.',
        );
    }
    throw new Error(
        `editor-ranges: "${field}" is not an editor field with a range. `
        + `Declared: ${EDITOR_RANGE_FIELD_IDS.join(', ')}. `
        + `Declared unranged: ${[...UNRANGED_BY_NAME.keys()].join(', ')}. `
        + 'A field that needs bounds gets a ROW here naming its one entry — never a number '
        + 'at the call site.',
    );
}

export function createEditorRanges({ machineLimits, machineClass = null } = {}) {
    if (!machineLimits || typeof machineLimits !== 'object') {
        throw new Error(
            'createEditorRanges: the machine limits table must be injected — '
            + 'capabilities-store.js machineLimits().value, which is r2MachineLimits() behind '
            + 'the R2 door. There is no default: a hand-written fallback here would be the '
            + 'second table, which is forbidden.',
        );
    }
    if (machineClass !== null && machineClass !== undefined
        && !MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(
            `createEditorRanges: "${machineClass}" is not a machine class. The classes are `
            + `${MACHINE_CLASSES.join(', ')}, or null for "not known yet". It comes from `
            + 'capabilities-store.js machineClass() — a served capability answer, never a '
            + 'model name.',
        );
    }
    const resolvedClass = machineClass ?? null;

    /** The machine row for a field, refusing rather than substituting when it is absent. */
    function machineRow(row) {
        if (!hasLimit(machineLimits, row.limitKey)) {
            throw new Error(
                `editor-ranges: the machine limits table carries no "${row.limitKey}" row, so `
                + `"${row.field}" has no bounds, and absence is the honest answer — `
                + 'render the control unavailable. Never stand a plausible band in for it.',
            );
        }
        return machineLimits[row.limitKey];
    }

    const api = {
        /** Every declared field id. */
        fields() { return EDITOR_RANGE_FIELD_IDS; },

        /** True when this module answers for `field`. Declared-unranged reads FALSE. */
        has(field) { return FIELD_BY_NAME.has(field); },

        rowFor(field) { return FIELD_BY_NAME.get(field) ?? null; },

        rangeFor(field, { pump = null, exitType = null } = {}) {
            const row = FIELD_BY_NAME.get(field);
            if (!row) return refuse(field);

            if (row.source === 'machine') return machineRow(row);
            if (row.source === 'authoring') return authoringRange(row.rangeName, resolvedClass);

            if (row.source === 'mode-target' || row.source === 'mode-limiter') {
                if (!pump) {
                    throw new Error(
                        `editor-ranges: "${field}" is mode-dependent — pass {pump}. `
                        + `getModeConfig refuses an unknown mode rather than reading it as flow; `
                        + `the four are ${PUMP_MODE_CYCLE.join(', ')}.`,
                    );
                }
                // getModeConfig throws for an unrecognised pump; modeRanges is built on it.
                getModeConfig(pump);
                const both = modeRanges(pump, resolvedClass);
                return row.source === 'mode-target' ? both.target : both.limiter;
            }

            // 'exit-slot' — the band's own door. `rangeForSlot('condition')` needs the type.
            if (row.slot === 'condition' && !exitType) {
                throw new Error(
                    'editor-ranges: "exitCondition" is exit-type dependent — pass {exitType}. '
                    + 'The three ReaPrime can express are pressure, flow, power (REA_EXIT_TYPES); '
                    + 'weight is folded into step.weight by the one sanitizer, not typed here.',
                );
            }
            const range = rangeForSlot(row.slot, exitType);
            if (!range) {
                throw new Error(
                    `editor-ranges: the exit band's door returned no range for slot "${row.slot}"`
                    + `${exitType ? ` and type "${exitType}"` : ''}. That is exit-sentence.js's `
                    + 'answer and this module does not second-guess it.',
                );
            }
            return range;
        },

        machineRangesForReview() {
            return Object.freeze({ temperature: api.rangeFor('stepTemperature') });
        },

        numpadLimitsFor(field, ctx = {}) {
            const range = api.rangeFor(field, ctx);
            return Object.freeze({
                min: range.min,
                max: range.max,
                step: range.step,
                unit: range.unit ?? null,
                ...(range.floor === undefined ? {} : { floor: range.floor }),
            });
        },

        machineClass() { return resolvedClass; },

        /** The R2 marking, so a caller can say "provisional" without knowing why. */
        provenance() { return R2_INTERIM; },
    };

    return api;
}

export function enumerateEditorRangeRequests() {
    const out = [];
    for (const row of EDITOR_RANGE_FIELDS) {
        if (row.source === 'mode-target' || row.source === 'mode-limiter') {
            for (const pump of PUMP_MODE_CYCLE) out.push({ field: row.field, ctx: { pump } });
        } else if (row.slot === 'condition') {
            for (const exitType of ['pressure', 'flow', 'power']) {
                out.push({ field: row.field, ctx: { exitType } });
            }
        } else {
            out.push({ field: row.field, ctx: {} });
        }
    }
    return out;
}

/** The exit band's slot order, re-exported so a caller needs one import for the band. */
export { EXIT_SLOT_ORDER };
