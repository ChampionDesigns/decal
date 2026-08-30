/**
 * editor-ranges.js — THE PROFILE EDITOR'S ONE DOOR TO THE ONE RANGES TABLE (B2/B3).
 *
 * Wave 5.5, item `one-ranges-table`.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE DECLARES NO RANGE. Not one number.
 * ---------------------------------------------------------------------------
 *
 * B2 is "exactly one limits table in the skin until ReaPrime serves them (R2)", and the
 * editor is the screen the decision was written about: `profile_editor.js:489-495`
 * (`targetMaxFor` / `limiterMaxFor`) was the SECOND copy, so the same field had a
 * different ceiling depending on which surface you reached it through. That copy is not
 * transcribed here in any form. What this module does is the opposite of holding a table:
 * it ENUMERATES the editor's ranged fields and shows each one resolving to exactly one
 * entry of somebody else's.
 *
 * The two tables it resolves into are DISJOINT BY FIELD, which is what B2 actually says:
 *
 *   THE MACHINE'S OWN LIMITS   `machine-limits.js` (wave-4 port `port-machine-limits`),
 *                              reached ONLY through the R2 door — `r2MachineLimits()` in
 *                              `src/data/adapters-r.js`, published as
 *                              `capabilities-store.js machineLimits()`. Two editor fields
 *                              live here: a step's brew TEMPERATURE and the profile's
 *                              TARGET WEIGHT.
 *   THE AUTHORING RANGES       `profile-modes.js` `AUTHORING_RANGES` (wave-4 port
 *                              `port-profile-modes`, which collapsed the source's three
 *                              disagreeing copies to one). Everything else.
 *
 * Not one key of `LIMIT_KEYS` appears in `AUTHORING_RANGES` and `profile-modes.js:125`
 * states that as a checked claim, so "one table per field" is a property of the pair, not
 * a hope.
 *
 * ---------------------------------------------------------------------------
 * THE TABLE TRAVELS AS AN ARGUMENT
 * ---------------------------------------------------------------------------
 *
 * `createEditorRanges({machineLimits})` takes the machine table as a VALUE, because it is
 * genuinely per-machine — its steam ceiling is 170 on a Bengle and 160 on a DE1 and the
 * row is ABSENT until the class is known (A7) — and because a module-level import of it
 * would let a second caller quietly hold a different one. It arrives from the R2 door and
 * from nowhere else; the day R2 serves the ranges, the adapter changes and this file does
 * not.
 *
 * The authoring half is reached through the ACCESSORS `authoringRange(name, machineClass)`,
 * `modeRanges(pump, machineClass)` and `rangeForSlot(slot, type)` rather than through the
 * table object. That is deliberate and it is the stronger containment of the two: an
 * accessor cannot be substituted with a different table, and `authoringRange` THROWS on an
 * undeclared name ("Undeclared is a programming error, not a value"), so a field this
 * module names wrongly fails loudly instead of resolving to a plausible band.
 *
 * ---------------------------------------------------------------------------
 * THE AUTHORING HALF IS PER-MACHINE TOO, SINCE 27 AUGUST 2026
 * ---------------------------------------------------------------------------
 *
 * Ben, in the profile editor: "why is flow limited to 15ml/s", and then "flow limit goes
 * with it to 20 as well." A Bengle authors a flow step's TARGET and a pressure step's FLOW
 * LIMIT up to 20 mL/s; a DE1 keeps 15 and 8. So `createEditorRanges` now takes a second
 * input, `machineClass`, and it is the SAME input the machine table already resolved
 * against — `capabilities.machineClass()`, which is `machineClassFromServedSet` over
 * ReaPrime's served capability array. Never a model name (A3): the old editor's lift was
 * gated on a machine-NAME test, which is exactly why it was refused on the way into this
 * port and had to come back through a capability answer instead.
 *
 * IT IS A SECOND ARGUMENT AND NOT A SECOND SOURCE. One class, entering this module once,
 * reaching both halves: the machine table was resolved with it before it arrived here, and
 * the authoring accessors are handed it below. `machineClass()` is exposed on the door for
 * the one caller that needs it downstream — `editor-screen.js` hands it to
 * `reviewStepSpec`, so the review sentence and the grid stepper cannot print two ceilings
 * for one field. Reading the class from anywhere else in the editor would be the second
 * source; there is deliberately nowhere else to read it from.
 *
 * NULL IS ALLOWED AND MEANS "NOT KNOWN YET". It answers with the DE1's numbers, which are
 * a SUBSET of the Bengle's (0-15 inside 0-20, 0-8 inside 0-20) and so cannot let anyone
 * author a value either machine refuses. That is not the call the steam row makes for an
 * unknown class — it goes absent — and `profile-modes.js` states at length why the two
 * differ: steam's bands do not nest, these do.
 *
 * ---------------------------------------------------------------------------
 * A FIELD WITH NO ENTRY IS REFUSED, NEVER DEFAULTED
 * ---------------------------------------------------------------------------
 *
 * Two editor fields have no range and that is a decision each of them can cite. They are
 * listed in `UNRANGED_EDITOR_FIELDS` with the reason, and `rangeFor()` throws for them by
 * name — a longer, ruder error than for a field nobody declared, because the tempting fix
 * is exactly the one B2 forbids. The alternative is a literal typed into a stepper, which
 * is how `profile_editor.js` grew its second table in the first place.
 *
 * ---------------------------------------------------------------------------
 * R2 IS NOT LANDED AND THAT IS DECLARED, NOT PAPERED OVER
 * ---------------------------------------------------------------------------
 *
 * There is no limits endpoint at the pin. Checked mechanically at
 * 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3: 149 `app.get|put|post|delete('/api/v1/…')`
 * registrations across `lib/src/services/webserver/*.dart`, and ZERO whose path matches
 * limit / range / bound / envelope / constraint. So the editor ships on the interim single
 * table, `R2_INTERIM` below says so as data, and the wave declares it on the manifest
 * (Part 10 §7's own example is this case — ECM-041, "limits from the interim single table
 * pending R2"). A stub route would be a fabricated endpoint (Part 10 §9).
 *
 * DOM-free, framework-free, pure. `node:test` exercises it directly.
 */

import { authoringRange, modeRanges, getModeConfig, PUMP_MODE_CYCLE } from './profile-modes.js';
import { rangeForSlot, EXIT_SLOT_ORDER } from './exit-sentence.js';
import { hasLimit, MACHINE_CLASSES } from './machine-limits.js';

/**
 * The R2 gap, as data rather than as a comment, so the manifest entry and the screen's
 * own "provisional" marking read from the same place.
 */
export const R2_INTERIM = Object.freeze({
    decision: 'B2',
    upstream: 'R2',
    landed: false,
    checkedCommit: '2b047d02e42e29bf2d96a2aa964ef94e4a4daba3',
    basis: 'no route registered at the pin matches limit/range/bound/envelope/constraint '
        + 'across the 140 registrations in lib/src/services/webserver/*.dart',
    note: 'limits from the interim single table pending R2',
});

/**
 * WHERE A RANGE COMES FROM. Five resolutions, and each names a real accessor:
 *
 *   'machine'       machine-limits row, off the injected R2-door table
 *   'authoring'     a fixed `AUTHORING_RANGES` row, by name
 *   'mode-target'   the pump mode's TARGET row — pressureTarget / flowTarget /
 *                   powerTarget / leverP0, chosen by `modeRanges(pump).target`
 *   'mode-limiter'  the pump mode's opposite-channel limiter, `modeRanges(pump).limiter`
 *   'exit-slot'     the exit band's own door, `rangeForSlot(slot, type)` — which is where
 *                   the #41 compound and the #53 numpad already take their bounds, so the
 *                   band and the matrix cannot disagree
 */
export const RANGE_SOURCES = Object.freeze([
    'machine', 'authoring', 'mode-target', 'mode-limiter', 'exit-slot',
]);

/**
 * EVERY RANGED FIELD IN THE PROFILE EDITOR, and the one entry each resolves to.
 *
 * `surface` is which part of the screen edits it, and it is here because B2's defect is a
 * per-SURFACE disagreement: the same field reached through the matrix, the settings panel
 * and the numpad had three ceilings. A field appearing twice in this list with two sources
 * would be that defect written down, and `test/editor-ranges.test.mjs` fails on it.
 */
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
        why: 'lever feel, half two. P0 is stepTarget and a preset never touches it',
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
        field: 'targetVolume',
        surface: 'settings-panel',
        source: 'authoring',
        rangeName: 'volume',
        why: 'the profile’s volume stop. The SAME entry as a step’s volume stop — same measure, '
            + 'same band, and resolving two fields to one entry is what a door is for. '
            + 'Recorded as a deferred question: R2 may serve a machine row for it, which '
            + 'would move this line and change nothing else',
    }),
]);

/**
 * THE FIELDS WITH NO ENTRY, and why each absence is a decision rather than an oversight.
 *
 * `rangeFor()` throws for these by name. Neither may be given a literal.
 */
export const UNRANGED_EDITOR_FIELDS = Object.freeze([
    Object.freeze({
        field: 'tankTemperature',
        surface: 'settings-panel',
        why: 'THE LIMITS TABLE NOW CARRIES tankTemp AND THIS FIELD IS STILL UNRANGED, which '
            + 'is a deliberate split rather than an oversight (24 Aug 2026). The machine row '
            + 'was added for the Settings page: `unified_de1.profile.dart` ends every '
            + '_sendProfile with a _writeMMRInt(MMRItem.tankTemp), so every profile load '
            + 'clobbers whatever a control set — still true, and answered there by a CAPTION '
            + 'saying so rather than by an empty leaf. THIS field is the other side of that '
            + 'same write: the PROFILE\u2019s own tank_temperature, the value doing the '
            + 'clobbering. Giving the editor a range would be a second surface writing one '
            + 'MMR through two doors, and deciding whether the profile should own it at all '
            + 'is the upstream question neither range answers. Ben has not ruled on it.',
    }),
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
            + 'Do not give it a literal: B2 is exactly one table, and a stepper default is a '
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

/**
 * The door.
 *
 * @param {object} deps
 * @param {object} deps.machineLimits  the R2 door's table — `capabilities-store.machineLimits().value`
 *   (or `r2MachineLimits(entries).value`). Required: A7 forbids a stand-in, and a missing
 *   table is a different thing from a table with no steam row.
 * @param {'bengle'|'de1'|null} [deps.machineClass]  `capabilities-store.machineClass()` —
 *   the SAME served answer `machineLimits` was resolved against, and the input the two
 *   machine-dependent authoring ceilings need (a flow step's target and a pressure step's
 *   flow limit: 20 mL/s on a Bengle, 15 and 8 on a DE1). Omitted or null means "not known
 *   yet" and resolves the narrower band; a class the vocabulary does not know is REFUSED
 *   rather than read as unknown, because a typo that silently narrows every flow control
 *   on a Bengle is precisely the failure this whole argument exists to prevent.
 */
export function createEditorRanges({ machineLimits, machineClass = null } = {}) {
    if (!machineLimits || typeof machineLimits !== 'object') {
        throw new Error(
            'createEditorRanges: the machine limits table must be injected — '
            + 'capabilities-store.js machineLimits().value, which is r2MachineLimits() behind '
            + 'the R2 door. There is no default: a hand-written fallback here would be the '
            + 'second table B2 forbids.',
        );
    }
    if (machineClass !== null && machineClass !== undefined
        && !MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(
            `createEditorRanges: "${machineClass}" is not a machine class. The classes are `
            + `${MACHINE_CLASSES.join(', ')}, or null for "not known yet". It comes from `
            + 'capabilities-store.js machineClass() — a served capability answer, never a '
            + 'model name (A3).',
        );
    }
    const resolvedClass = machineClass ?? null;

    /** The machine row for a field, refusing rather than substituting when it is absent. */
    function machineRow(row) {
        if (!hasLimit(machineLimits, row.limitKey)) {
            throw new Error(
                `editor-ranges: the machine limits table carries no "${row.limitKey}" row, so `
                + `"${row.field}" has no bounds. Absence is the R2 door's real answer (A7) — `
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

        /** The row (source, why, what it needs) without resolving it. */
        rowFor(field) { return FIELD_BY_NAME.get(field) ?? null; },

        /**
         * The one range entry for one editor field.
         *
         * @param {string} field   an id from `EDITOR_RANGE_FIELD_IDS`
         * @param {object} [ctx]
         * @param {string} [ctx.pump]      required for the two mode-dependent fields
         * @param {string} [ctx.exitType]  required for `exitCondition`
         * @returns {object} the frozen `{min,max,step,unit,…}` entry, AS DECLARED by its
         *   owning table — never copied, never widened, never rounded here.
         */
        rangeFor(field, { pump = null, exitType = null } = {}) {
            const row = FIELD_BY_NAME.get(field);
            if (!row) return refuse(field);

            if (row.source === 'machine') return machineRow(row);
            /* THE CLASS IS PASSED FOR EVERY AUTHORING ROW, not only for the two that use
             * it. None of the rows this branch names is machine-dependent today, and
             * passing the class anyway costs nothing and means the day one of them becomes
             * machine-dependent this line is already right — where omitting it would make
             * `authoringRange` throw, which is loud, but only at run time on the surface
             * that happened to ask. */
            if (row.source === 'authoring') return authoringRange(row.rangeName, resolvedClass);

            if (row.source === 'mode-target' || row.source === 'mode-limiter') {
                if (!pump) {
                    throw new Error(
                        `editor-ranges: "${field}" is mode-dependent — pass {pump}. `
                        + `getModeConfig refuses an unknown mode rather than reading it as flow (A7); `
                        + `the four are ${PUMP_MODE_CYCLE.join(', ')}.`,
                    );
                }
                // getModeConfig throws for an unrecognised pump; modeRanges is built on it.
                getModeConfig(pump);
                /* WHERE THE FLOW CEILINGS LAND. `modeRanges('flow').target` IS
                 * `flowTarget` and `modeRanges('pressure').limiter` IS `stepFlowLimit`,
                 * the two rows Ben's 27 August lift moved, so this one call is the whole
                 * of the editor's grid, steppers and numpad reading 20 on a Bengle. */
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

        /**
         * What `reviewStepSpec(step, {machineRanges})` requires by INJECTION. It throws
         * without it and names why: the brew temperature is a machine limit and B2 allows
         * one table per field, so `profile-modes.js` declares no range for it.
         */
        machineRangesForReview() {
            return Object.freeze({ temperature: api.rangeFor('stepTemperature') });
        },

        /**
         * The `limits` object #53 `<ui-numeric-keypad>` takes as DATA — the same entry,
         * reshaped, never re-decided. The numpad's own header says "RANGES ARRIVE AS DATA";
         * this is the only place the editor builds that object.
         */
        numpadLimitsFor(field, ctx = {}) {
            const range = api.rangeFor(field, ctx);
            return Object.freeze({
                min: range.min,
                max: range.max,
                step: range.step,
                unit: range.unit ?? null,
                // The steam-style hole is carried through verbatim where a row has one, so
                // the typed path knows what the clamp knows. No editor field has one today.
                ...(range.floor === undefined ? {} : { floor: range.floor }),
            });
        },

        /**
         * The machine class this door resolved against — 'bengle', 'de1', or null for
         * "not known yet".
         *
         * IT IS EXPOSED FOR ONE CALLER AND ONE REASON. `reviewStepSpec` resolves its own
         * ranges out of `profile-modes.js` rather than through this door (its `num`
         * segments are built inside the sentence, where the wording lives), so it needs
         * the class as an argument — and `editor-screen.js` reads it from HERE rather
         * than from the capability store a second time. One class, one entry point into
         * the editor: the review sentence and the grid stepper are then bound to print
         * the same ceiling for the same field, which is the property B2 is about.
         */
        machineClass() { return resolvedClass; },

        /** The R2 marking, so a caller can say "provisional" without knowing why. */
        provenance() { return R2_INTERIM; },
    };

    return api;
}

/**
 * Every (field, context) pair the editor can ask for — the enumeration the totality check
 * walks, exported so the check is over THIS list rather than over a list the test wrote.
 *
 * A field that grows a context this does not enumerate stops being covered, which is the
 * failure mode worth catching: the second table always arrives as "just this one case".
 */
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
