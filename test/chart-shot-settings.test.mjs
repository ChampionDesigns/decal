import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SHOT_SETTINGS_SOURCE, shotPlan, shotShapingSettings } from '../src/lib/chart-shot-load.js';
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
