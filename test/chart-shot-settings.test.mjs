import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CHART_NOT_USABLE, SHOT_SETTINGS_SOURCE, shotPlan, shotShapingBlock, shotShapingSettings } from '../src/lib/chart-shot-load.js';
import { FIRMWARE_DEFAULT_SETTINGS, settingsFromNativeShaping } from '../src/lib/shot-model.js';
import { parseYaml } from '../scripts/lib/yaml-subset.js';
import { REA_ROOT } from '../scripts/lib/rea-source.js';
import { REST_REL } from '../scripts/generate-rea-routes.js';
import { convertedShot, RECORDED_SHOT_IDS, withProfile } from './fixtures/chart-shots.js';

const SPEC = parseYaml(readFileSync(join(REA_ROOT, REST_REL), 'utf8'), { file: REST_REL });
const SPEC_BLOCK = SPEC.components.schemas.NativeShaping.example;

const PROFILE_BLOCK = Object.freeze({
    version: 1,
    pump_curve: [{ pressure: 2, flow: 15 }, { pressure: 8, flow: 6 }],
    flow_tau: 1.2,
    flow_mode: 'rise',
    pressure_tau: 0.4,
    pressure_mode: 'fall',
    ramp_factor: 2,
});

function report(settings, source = 'cli') {
    const out = {
        source,
        sourceCode: source === 'profile' ? 1 : 0,
        refusal: 'none',
        refusalCode: 0,
        latchCount: 7,
        settingsRounded: settings === null,
    };
    if (settings !== undefined) out.settings = settings;
    return out;
}

function withReport(record, nativeShaping) {
    const workflow = structuredClone(record.workflow);
    workflow.machine = { ...(workflow.machine ?? {}), nativeShaping };
    return { ...record, workflow };
}

function withBlock(record, block) {
    return withProfile(record, (profile) => ({ ...profile, native_shaping: structuredClone(block) }));
}

const BASE = convertedShot(RECORDED_SHOT_IDS[2]);

test('the recorded shots carry no report and no block, so they use the firmware defaults', () => {
    for (const id of RECORDED_SHOT_IDS) {
        const r = shotShapingSettings(convertedShot(id));
        assert.equal(r.source, SHOT_SETTINGS_SOURCE.DEFAULT, id);
        assert.deepEqual(r.settings, { ...FIRMWARE_DEFAULT_SETTINGS });
    }
});

test('the report settings win over the profile block', () => {
    const record = withReport(withBlock(BASE, PROFILE_BLOCK), report(SPEC_BLOCK));
    const r = shotShapingSettings(record);
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.REPORT);
    assert.deepEqual(r.settings, settingsFromNativeShaping(SPEC_BLOCK));
    const plan = shotPlan(record);
    assert.equal(plan.usable, true);
    assert.equal(plan.settingsSource, SHOT_SETTINGS_SOURCE.REPORT);
    assert.deepEqual(plan.settings, settingsFromNativeShaping(SPEC_BLOCK));
});

test('a report with settings null falls to the profile block', () => {
    const record = withReport(withBlock(BASE, PROFILE_BLOCK), report(null));
    const r = shotShapingSettings(record);
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.PROFILE);
    assert.deepEqual(r.settings, settingsFromNativeShaping(PROFILE_BLOCK));
    assert.equal(shotPlan(record).settingsSource, SHOT_SETTINGS_SOURCE.PROFILE);
});

test('a report without settings falls to the profile block', () => {
    const record = withReport(withBlock(BASE, PROFILE_BLOCK), report(undefined, 'inactive'));
    assert.equal(shotShapingSettings(record).source, SHOT_SETTINGS_SOURCE.PROFILE);
});

test('a report whose settings break a rule falls to the profile block', () => {
    const record = withReport(withBlock(BASE, PROFILE_BLOCK), report({ ...SPEC_BLOCK, ramp_factor: 9 }));
    assert.equal(shotShapingSettings(record).source, SHOT_SETTINGS_SOURCE.PROFILE);
    for (const bad of [{ ...SPEC_BLOCK, flow_tau: 9 }, { ...SPEC_BLOCK, version: 1 }, { ...PROFILE_BLOCK, ramp_factor: 9 },
        { ...PROFILE_BLOCK, pressure_tau: 6 }, { ...PROFILE_BLOCK, pressure_ramp_tau: 1 }]) {
        const r = withReport(withBlock(BASE, PROFILE_BLOCK), report(bad));
        assert.equal(shotShapingSettings(r).source, SHOT_SETTINGS_SOURCE.PROFILE, JSON.stringify(bad));
    }
});

test('a profile block that breaks a rule gives the defaults', () => {
    for (const bad of [{ ...PROFILE_BLOCK, ramp_factor: 4.02 }, { ...SPEC_BLOCK, ramp_factor: 1 }, { ...SPEC_BLOCK, flow_ramp_tau: 5.02 }]) {
        const record = withBlock(BASE, bad);
        const r = shotShapingSettings(record);
        assert.equal(r.source, SHOT_SETTINGS_SOURCE.DEFAULT, JSON.stringify(bad));
        assert.deepEqual(r.settings, { ...FIRMWARE_DEFAULT_SETTINGS });
        assert.equal(shotShapingBlock(record), null);
    }
});

test('a version 1 report maps its ramp factor to ramp times of factor times tau', () => {
    const v1 = { ...PROFILE_BLOCK, flow_tau: 0.62, pressure_tau: 0.34, ramp_factor: 1.5 };
    const record = withReport(BASE, report(v1));
    const r = shotShapingSettings(record);
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.REPORT);
    assert.equal(r.settings.pRamp, 1.5 * 0.34);
    assert.equal(r.settings.fRamp, 1.5 * 0.62);
    assert.equal(r.settings.pFilt, 0);
    assert.equal(shotShapingBlock(record), record.workflow.machine.nativeShaping.settings);
    const plan = shotPlan(record);
    assert.equal(plan.usable, true);
    assert.equal(plan.settingsSource, SHOT_SETTINGS_SOURCE.REPORT);
    assert.equal(plan.settings.pRamp, 1.5 * 0.34);
    assert.equal(plan.settings.fRamp, 1.5 * 0.62);
});

test('a version 1 profile block maps its ramp factor the same way', () => {
    const record = withBlock(BASE, PROFILE_BLOCK);
    const r = shotShapingSettings(record);
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.PROFILE);
    assert.equal(r.settings.pRamp, 2 * 0.4);
    assert.equal(r.settings.fRamp, 2 * 1.2);
    assert.deepEqual(shotShapingBlock(record), PROFILE_BLOCK);
    assert.equal(shotPlan(record).settings.fRamp, 2 * 1.2);
});

test('a mapped ramp time is not rounded and not held to 5 s', () => {
    const r = shotShapingSettings(withBlock(BASE, { ...PROFILE_BLOCK, flow_tau: 5, pressure_tau: 4.98, ramp_factor: 4 }));
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.PROFILE);
    assert.equal(r.settings.fRamp, 20);
    assert.equal(r.settings.pRamp, 4 * 4.98);
});

test('a version 1 block without a ramp factor takes the factor 1', () => {
    const { ramp_factor: _, ...noFactor } = PROFILE_BLOCK;
    const r = shotShapingSettings(withBlock(BASE, noFactor));
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.PROFILE);
    assert.equal(r.settings.pRamp, 0.4);
    assert.equal(r.settings.fRamp, 1.2);
});

test('a version 2 block reads an absent ramp time as 0', () => {
    const v2 = { version: 2, flow_tau: 1.2, pressure_tau: 0.4, pressure_ramp_tau: 1 };
    const r = shotShapingSettings(withReport(BASE, report(v2)));
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.REPORT);
    assert.equal(r.settings.pRamp, 1);
    assert.equal(r.settings.fRamp, 0);
    const bare = settingsFromNativeShaping({ version: 2, flow_tau: 1.2, pressure_tau: 0.4 });
    assert.equal(bare.pRamp, 0);
    assert.equal(bare.fRamp, 0);
    const keyOnly = settingsFromNativeShaping({ flow_tau: 1.2, pressure_tau: 0.4, pressure_filter_tau: 0.5 });
    assert.equal(keyOnly.pRamp, 0);
    assert.equal(keyOnly.fRamp, 0);
    assert.equal(keyOnly.pFilt, 0.5);
});

test('the profile block is used when there is no report', () => {
    const r = shotShapingSettings(withBlock(BASE, PROFILE_BLOCK));
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.PROFILE);
    assert.deepEqual(r.settings.curve, [[2, 15], [8, 6]]);
    assert.equal(r.settings.fMode, 'rise');
    assert.equal(r.settings.pMode, 'fall');
});

test('with no report settings and no profile block the defaults are used', () => {
    const record = withReport(BASE, report(null));
    const r = shotShapingSettings(record);
    assert.equal(r.source, SHOT_SETTINGS_SOURCE.DEFAULT);
    assert.deepEqual(r.settings, { ...FIRMWARE_DEFAULT_SETTINGS });
    assert.equal(shotPlan(record).settingsSource, SHOT_SETTINGS_SOURCE.DEFAULT);
});

test('a report that is not an object is ignored', () => {
    for (const bad of [null, 'x', [], 3]) {
        assert.equal(shotShapingSettings(withReport(withBlock(BASE, PROFILE_BLOCK), bad)).source, SHOT_SETTINGS_SOURCE.PROFILE);
    }
});

test('the report settings change the shot fit input', () => {
    const plain = shotPlan(BASE);
    const shaped = shotPlan(withReport(BASE, report(SPEC_BLOCK)));
    assert.notDeepEqual(shaped.settings, plain.settings);
    assert.deepEqual(shaped.steps, plain.steps);
});

test('a shot whose report says the shaping was inactive is a DE1 emulation shot', () => {
    assert.equal(shotPlan(BASE).usable, true);
    assert.notEqual(BASE.workflow?.machine?.de1Emulation, true);
    const inactive = { ...report(undefined, 'inactive'), sourceCode: 3 };
    const byName = { ...report(undefined, 'inactive'), sourceCode: 0 };
    const byCode = { ...report(undefined, 'unknown'), sourceCode: 3 };
    for (const r of [inactive, byName, byCode]) {
        const plan = shotPlan(withReport(BASE, r));
        assert.equal(plan.usable, false);
        assert.equal(plan.reason, CHART_NOT_USABLE.DE1_EMULATION);
        assert.equal(plan.de1, true);
    }
    assert.equal(shotPlan(withReport(BASE, report(SPEC_BLOCK))).usable, true);
});
