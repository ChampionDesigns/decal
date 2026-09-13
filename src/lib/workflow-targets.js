/**
 * The Live rail's values, read off the workflow, and the partial payload that writes one back.
 */

/** A number, or undefined. Anything else the document holds is not a target. */
function numberOrUndefined(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

const STRING_2DP = Object.freeze({
    read: (value) => {
        if (typeof value === 'number') return numberOrUndefined(value);
        if (typeof value !== 'string' || value.trim() === '') return undefined;
        return numberOrUndefined(Number(value));
    },
    write: (value) => value.toFixed(2),
});

const SCALAR_FIELDS = Object.freeze({
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

export const WORKFLOW_TARGET_KEYS = Object.freeze([...Object.keys(SCALAR_FIELDS), 'brewTemp']);

export function isWritableTarget(key, value) {
    if (numberOrUndefined(value) === undefined) return false;
    return key === 'brewTemp' || Object.prototype.hasOwnProperty.call(SCALAR_FIELDS, key);
}

export function brewTempOf(workflow) {
    const steps = workflow && workflow.profile && Array.isArray(workflow.profile.steps)
        ? workflow.profile.steps : null;
    if (!steps || steps.length === 0) return undefined;
    return numberOrUndefined(steps[0].temperature);
}

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

export function patchFor(workflow, key, value) {
    if (numberOrUndefined(value) === undefined) return null;

    if (key === 'brewTemp') {
        const steps = workflow && workflow.profile && Array.isArray(workflow.profile.steps)
            ? workflow.profile.steps : null;
        if (!steps || steps.length === 0) return null;
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
    const written = codec ? codec.write(Number(value)) : value;
    return { [block]: { [name]: written } };
}
