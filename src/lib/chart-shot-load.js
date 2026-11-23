import {
    flowSamplesFromRecord, SHOT_NOT_USABLE, shotFromRecord, shotRanDe1Emulation, shotTargetWeight,
} from './puck-fit.js';
import { settingsFromNativeShaping, stepsFromProfile, NATIVE_SHAPING_KEY } from './shot-model.js';
import { shotClock } from './shot-summary.js';
import { lastValue } from './chart-series.js';
import { holdsActiveRecipe } from '../stores/profile-library-store.js';

export const CHART_NOT_USABLE = Object.freeze({
    ...SHOT_NOT_USABLE,
    DE1_MACHINE: 'de1Machine',
    STEP_NOT_MODELLED: 'stepNotModelled',
});

export const NOT_USABLE_WORDS = Object.freeze({
    [CHART_NOT_USABLE.NO_RECORD]: 'no shot record',
    [CHART_NOT_USABLE.NO_SAMPLES]: 'no recorded samples',
    [CHART_NOT_USABLE.DE1_EMULATION]: 'DE1 emulation',
    [CHART_NOT_USABLE.NO_WEIGHT]: 'no cup weight',
    [CHART_NOT_USABLE.NO_TARGET_WEIGHT]: 'no target weight',
    [CHART_NOT_USABLE.DE1_MACHINE]: 'a DE1 machine',
    [CHART_NOT_USABLE.STEP_NOT_MODELLED]: 'a step the model does not cover',
});

const DE1_MODEL_PREFIX = 'DE1';

const isBody = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function finite(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

function shotRanOnDe1Machine(record) {
    const model = record?.workflow?.machine?.model;
    return typeof model === 'string' && model.startsWith(DE1_MODEL_PREFIX);
}

function shotDoseGrams(record) {
    const actual = record?.annotations?.actualDoseWeight;
    if (finite(actual) && actual > 0) return actual;
    const target = record?.workflow?.context?.targetDoseWeight;
    return finite(target) && target > 0 ? target : null;
}

export function shotRowFacts(summary) {
    const yieldWeight = summary?.annotations?.actualYield;
    return {
        id: typeof summary?.id === 'string' ? summary.id : null,
        clock: shotClock(summary?.timestamp),
        title: typeof summary?.workflow?.profile?.title === 'string' ? summary.workflow.profile.title : '',
        dose: shotDoseGrams(summary),
        yield: finite(yieldWeight) ? yieldWeight : null,
        de1: shotRanDe1Emulation(summary),
        noTarget: shotTargetWeight(summary) === null,
    };
}

export function shotPlan(record) {
    const profile = isBody(record?.workflow?.profile) ? record.workflow.profile : null;
    const base = {
        usable: false,
        reason: null,
        profile,
        shot: null,
        flow: null,
        steps: null,
        settings: null,
        targetWeight: null,
        dose: shotDoseGrams(record),
        de1: isBody(record) && shotRanDe1Emulation(record),
        noTarget: shotTargetWeight(record) === null,
    };
    if (!isBody(record)) return { ...base, reason: CHART_NOT_USABLE.NO_RECORD };
    const fit = shotFromRecord(record);
    const flow = flowSamplesFromRecord(record);
    if (fit.usable) {
        base.shot = fit.shot;
        base.targetWeight = fit.shot.targetWeight;
    }
    base.flow = flow;
    if (fit.reason === CHART_NOT_USABLE.DE1_EMULATION) return { ...base, reason: fit.reason };
    if (shotRanOnDe1Machine(record)) return { ...base, reason: CHART_NOT_USABLE.DE1_MACHINE };
    if (!fit.usable) return { ...base, reason: fit.reason };
    const steps = stepsFromProfile(profile);
    if (!steps) return { ...base, reason: CHART_NOT_USABLE.STEP_NOT_MODELLED };
    return {
        ...base,
        usable: true,
        steps,
        settings: settingsFromNativeShaping(profile?.[NATIVE_SHAPING_KEY]),
    };
}

export function shotFacts(record, plan) {
    const shot = plan?.shot ?? null;
    const flow = plan?.flow ?? null;
    const t = shot?.t ?? flow?.t ?? [];
    return {
        clock: shotClock(record?.timestamp),
        dose: shotDoseGrams(record),
        yield: shot ? lastValue(shot.W) : null,
        time: t.length ? t[t.length - 1] : null,
        de1: Boolean(plan?.de1),
        noTarget: Boolean(plan?.noTarget),
    };
}

export function editorRecordForShot(record, listed) {
    const profile = isBody(record?.workflow?.profile) ? record.workflow.profile : null;
    if (!profile) return null;
    const records = Array.isArray(listed) ? listed : [];
    const match = records.find((r) => holdsActiveRecipe(r, profile));
    if (match) return match;
    return { id: null, profile: structuredClone(profile) };
}
