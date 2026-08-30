/**
 * workflow-targets.js — the Live rail's values, read off the workflow, and the partial
 * payload that writes one back.
 *
 * WHY THIS FILE EXISTS AT ALL. `<live-screen>` declares `targets` and `limits` as
 * properties and says, at its `#commit`, that "the owner of the machine's settings answers
 * by handing `targets` back". No owner was ever built. The consequence was not a missing
 * number: `#valueOf` returns `undefined` for every key, `railRows` marks every row
 * `unavailable`, and every stepper, every preset cell and the keypad's Confirm render
 * DISABLED — and the only code that writes `targets` is the change handler on the controls
 * that are disabled. The rail could not come alive on any machine, in any state. This
 * module is half of the owner; `stores/workflow-store.js` is the other half.
 *
 * WHY THE WORKFLOW AND NOT `/machine/settings`. The rail's ten keys live on ONE document,
 * and it is the workflow — confirmed against a real machine at 192.168.1.73, whose
 * `GET /api/v1/workflow` answers with exactly the four blocks read below. This is the same
 * answer wave 2's review reached from the other side when it found `steamDuration` absent
 * from `/machine/settings` and workflow-side instead (DQ-707); the rail is that finding's
 * other half. The old app agrees, and is the oracle for every mapping here — it reads
 * `context.targetDoseWeight` / `context.targetYield` for the two weights and writes
 * `temperature` onto EVERY step for brew temperature (`slate/app/src/modules/ui.js`
 * :120-135, :191-207).
 *
 * PURE, AND THAT IS LOAD-BEARING. A7 forbids the skin deriving a machine value it was not
 * served: nothing here computes a target, defaults one, or invents a unit. A field the
 * workflow does not carry is `undefined`, which is the state the rail already renders as
 * the dash — never a zero, which would be a setting the machine is not holding.
 *
 * `fanThreshold` and `calibrationWeight` are in `LIMIT_KEYS` and are deliberately NOT here:
 * neither is a rail row, and neither is on the workflow. A key this module cannot source is
 * absent rather than guessed.
 */

/** A number, or undefined. Anything else the document holds is not a target. */
function numberOrUndefined(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The codec for a field ReaPrime models as a decimal STRING.
 *
 * `read` accepts the string the server sends AND a bare number, because a document
 * written by something else is still a document this rail has to show. `write` spells
 * two decimals, which is the old app's own spelling.
 */
const STRING_2DP = Object.freeze({
    read: (value) => {
        if (typeof value === 'number') return numberOrUndefined(value);
        if (typeof value !== 'string' || value.trim() === '') return undefined;
        return numberOrUndefined(Number(value));
    },
    write: (value) => value.toFixed(2),
});

/**
 * Where each rail key lives on the workflow document.
 *
 * Written as a table rather than a switch because it is read in BOTH directions — the
 * value out, and the patch in — and two hand-written directions is how a key comes to be
 * read from one field and written to another. `brewTemp` is the one key that is not a
 * scalar at a path, so it is absent here and handled on its own below.
 */
const SCALAR_FIELDS = Object.freeze({
    /**
     * THE GRINDER SETTING, AND THE ONE FIELD ON THIS DOCUMENT THAT IS NOT A NUMBER.
     *
     * `WorkflowContext.grinderSetting` is a `String?` on ReaPrime
     * (`lib/src/models/data/workflow_context.dart:9`), and `toJson` OMITS it when it is
     * null — so a machine that has never been told a grind setting serves no key at all
     * and the row dashes, which is A7 and is right.
     *
     * The rail's control is numeric, so the value is parsed on the way out and spelled
     * on the way back in. The old app writes `parseFloat(v).toFixed(2)`
     * (`ui.js:210-215`), and this writes the same shape for the same reason: two skins
     * writing "8.5" and "8.50" into one field would each read the other's value as a
     * different number the moment a `toFixed` moved.
     */
    grind: Object.freeze(['context', 'grinderSetting', STRING_2DP]),
    dose: Object.freeze(['context', 'targetDoseWeight']),
    drinkWeight: Object.freeze(['context', 'targetYield']),
    steamTemp: Object.freeze(['steamSettings', 'targetTemperature']),
    steamFlow: Object.freeze(['steamSettings', 'flow']),
    steamDuration: Object.freeze(['steamSettings', 'duration']),
    milkStopTemp: Object.freeze(['steamSettings', 'stopAtTemperature']),
    hotWaterTemp: Object.freeze(['hotWaterData', 'targetTemperature']),
    hotWaterVolume: Object.freeze(['hotWaterData', 'volume']),
    flushTemp: Object.freeze(['rinseData', 'targetTemperature']),
    flushFlow: Object.freeze(['rinseData', 'flow']),
    flushDuration: Object.freeze(['rinseData', 'duration']),
});

/** Every key this module can source. `brewTemp` rides on the profile, not on a block. */
export const WORKFLOW_TARGET_KEYS = Object.freeze([...Object.keys(SCALAR_FIELDS), 'brewTemp']);

/**
 * The brew temperature the rail shows: THE FIRST STEP'S, which is the old app's rule.
 *
 * `app.js:1479` and `profileManager.js:552` both read `profile.steps[0].temperature` and
 * hand it straight to the display. Unconditionally — no agreement test, no aggregate.
 *
 * THIS WAS WRITTEN THE OTHER WAY FIRST, AND THE OTHER WAY WAS A REGRESSION. The first
 * version required every step to agree and answered `undefined` otherwise, reasoning that
 * a profile whose steps differ has no single brew temperature. It is a defensible rule and
 * it is not this skin's to make: the shipped fixture's own steps read 83.5 / 75 / 75, so
 * the old app prints 83.5 and that version would have printed the dash — a control that
 * reads empty where the thing it replaces reads a number. Parity is the default and a
 * departure has to be asked for, not reasoned into.
 *
 * THE ASYMMETRY IS REAL AND IS NOT HIDDEN: this reads step ONE and `patchFor` writes ALL
 * (which is also the old app's rule, `ui.js:194-196`), so pressing + on a profile whose
 * steps differ flattens them to one temperature. The old app does exactly this. It is
 * worth Ben's eye — not worth a silent divergence.
 */
export function brewTempOf(workflow) {
    const steps = workflow && workflow.profile && Array.isArray(workflow.profile.steps)
        ? workflow.profile.steps : null;
    if (!steps || steps.length === 0) return undefined;
    return numberOrUndefined(steps[0].temperature);
}

/**
 * The rail's values, keyed the way `live-targets.js` keys its rows.
 *
 * Absent keys are ABSENT, not null: `#valueOf` tests `typeof held === 'number'`, and the
 * screen's own contract is that a key it cannot answer renders unavailable.
 */
export function targetsFrom(workflow) {
    if (!workflow || typeof workflow !== 'object') return Object.freeze({});
    const out = {};
    for (const [key, [block, field, codec]] of Object.entries(SCALAR_FIELDS)) {
        const raw = workflow[block] ? workflow[block][field] : undefined;
        const value = codec ? codec.read(raw) : numberOrUndefined(raw);
        if (value !== undefined) out[key] = value;
    }
    const brew = brewTempOf(workflow);
    if (brew !== undefined) out.brewTemp = brew;
    return Object.freeze(out);
}

/**
 * The PARTIAL body that writes one target back, or null when the key is not ours.
 *
 * PARTIAL ON PURPOSE, and the old app does the same: it sends `{ profile }` alone for a
 * temperature and `{ context }` alone for the weights. Sending the whole document back
 * would make every rail press a rewrite of the profile, the steam block and the rinse
 * block as well — so a stale read anywhere in the document becomes a write everywhere in
 * it, and two rails pressed a second apart would each undo the other.
 *
 * The current document is needed for `brewTemp` only, because that patch has to carry the
 * steps it is not changing.
 */
export function patchFor(workflow, key, value) {
    if (numberOrUndefined(value) === undefined) return null;

    if (key === 'brewTemp') {
        const steps = workflow && workflow.profile && Array.isArray(workflow.profile.steps)
            ? workflow.profile.steps : null;
        if (!steps || steps.length === 0) return null;
        /* EVERY STEP, which is the old app's rule verbatim (`ui.js:194-196`). A profile
         * carries a temperature per step and the rail carries one control; writing only
         * the first would leave a profile the rail cannot describe and the next read would
         * show the dash. */
        return {
            profile: {
                ...workflow.profile,
                steps: steps.map((step) => ({ ...step, temperature: value })),
            },
        };
    }

    const field = SCALAR_FIELDS[key];
    if (!field) return null;
    const [block, name, codec] = field;
    const current = workflow && workflow[block] && typeof workflow[block] === 'object'
        ? workflow[block] : {};
    const written = codec ? codec.write(Number(value)) : value;
    return { [block]: { ...current, [name]: written } };
}
