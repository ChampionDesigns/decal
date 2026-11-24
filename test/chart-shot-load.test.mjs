import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    CHART_NOT_USABLE, NOT_USABLE_WORDS, editorRecordForShot, shotFacts, shotPlan, shotRowFacts,
} from '../src/lib/chart-shot-load.js';
import { SHOT_NOT_USABLE } from '../src/lib/puck-fit.js';
import {
    convertedShot, recordedShot, recordedShotList, RECORDED_SHOT_IDS, withMachineModel, withoutTarget,
    withProfile, withShotFlag,
} from './fixtures/chart-shots.js';

const SHOT = convertedShot(RECORDED_SHOT_IDS[2]);

test('a shot whose recipe is a listed record opens that record', () => {
    const stored = { id: 'stored-1', profile: structuredClone(SHOT.workflow.profile) };
    const other = { id: 'other', profile: { ...structuredClone(SHOT.workflow.profile), title: 'Other' } };
    assert.equal(editorRecordForShot(SHOT, [other, stored]), stored);
});

test('a shot with no matching record opens a new unsaved profile with the shot title', () => {
    const other = { id: 'other', profile: { ...structuredClone(SHOT.workflow.profile), title: 'Other' } };
    const opened = editorRecordForShot(SHOT, [other]);
    assert.equal(opened.id, null);
    assert.deepEqual(opened.profile, SHOT.workflow.profile);
    assert.equal(opened.profile.title, 'Extractamundo Dos! (2)');
    assert.notEqual(opened.profile, SHOT.workflow.profile);
    assert.equal(editorRecordForShot({ workflow: {} }, [other]), null);
});

test('a usable shot gives the fit input, the model steps and the settings', () => {
    const plan = shotPlan(SHOT);
    assert.equal(plan.usable, true);
    assert.equal(plan.reason, null);
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.targetWeight, 40);
    assert.equal(plan.dose, 17);
    assert.equal(plan.flow.t.length, plan.shot.t.length);
    assert.deepEqual(plan.profile, SHOT.workflow.profile);
});

test('every reason the model cannot run a shot keeps the profile of the shot', () => {
    const cases = [
        [null, CHART_NOT_USABLE.NO_RECORD, null],
        [{ ...SHOT, measurements: [] }, SHOT_NOT_USABLE.NO_SAMPLES, SHOT.workflow.profile],
        [withShotFlag(SHOT, true), SHOT_NOT_USABLE.DE1_EMULATION, SHOT.workflow.profile],
        [recordedShot(RECORDED_SHOT_IDS[2]), SHOT_NOT_USABLE.NO_WEIGHT, SHOT.workflow.profile],
        [withoutTarget(SHOT), SHOT_NOT_USABLE.NO_TARGET_WEIGHT, SHOT.workflow.profile],
        [withMachineModel(SHOT, 'DE1XL'), CHART_NOT_USABLE.DE1_MACHINE, SHOT.workflow.profile],
        [convertedShot(RECORDED_SHOT_IDS[1]), CHART_NOT_USABLE.STEP_NOT_MODELLED, null],
    ];
    for (const [record, reason, profile] of cases) {
        const plan = shotPlan(record);
        assert.equal(plan.usable, false, reason);
        assert.equal(plan.reason, reason);
        assert.equal(typeof NOT_USABLE_WORDS[reason], 'string');
        if (profile) assert.deepEqual(plan.profile, record.workflow.profile);
        if (record) assert.ok(plan.profile, `${reason} keeps a profile`);
    }
    assert.equal(Object.keys(NOT_USABLE_WORDS).length, 7);
});

test('a Bengle model name or an absent one keeps the shot usable', () => {
    assert.equal(shotPlan(withMachineModel(SHOT, 'Bengle')).usable, true);
    assert.equal(shotPlan(withMachineModel(SHOT, 'Unknown')).usable, true);
    assert.equal(shotPlan(withMachineModel(SHOT, 'DE1')).reason, CHART_NOT_USABLE.DE1_MACHINE);
});

test('a profile step the model does not cover is a reason of its own', () => {
    const plan = shotPlan(withProfile(SHOT, (p) => ({
        ...p, steps: p.steps.map((s, i) => (i === 0 ? { ...s, transition: 'unknown' } : s)),
    })));
    assert.equal(plan.reason, CHART_NOT_USABLE.STEP_NOT_MODELLED);
});

test('the list row shows dose, yield, the DE1 tag and the no target tag', () => {
    const list = recordedShotList().items;
    const row = shotRowFacts(list[0]);
    assert.equal(row.id, list[0].id);
    assert.equal(row.title, 'Extractamundo Dos! (2)');
    assert.equal(row.dose, 17);
    assert.equal(row.yield, null);
    assert.equal(row.de1, false);
    assert.equal(row.noTarget, false);
    assert.equal(row.clock.ok, true);
    assert.equal(shotRowFacts(withShotFlag(list[1], true)).de1, true);
    assert.equal(shotRowFacts(withoutTarget(list[2])).noTarget, true);
    const yielded = { ...list[3], annotations: { ...list[3].annotations, actualYield: 36.4 } };
    assert.equal(shotRowFacts(yielded).yield, 36.4);
    const noActual = { ...list[4], annotations: {} };
    assert.equal(shotRowFacts(noActual).dose, 17);
});

test('the shot line facts use the last measured cup weight and the shot time', () => {
    const plan = shotPlan(SHOT);
    const facts = shotFacts(SHOT, plan);
    assert.equal(facts.dose, 17);
    assert.equal(facts.yield, plan.shot.W.filter((v) => v !== null).at(-1));
    assert.equal(facts.time, plan.shot.t.at(-1));
    assert.equal(facts.de1, false);
    assert.equal(facts.noTarget, false);
    assert.equal(shotFacts(withoutTarget(SHOT), shotPlan(withoutTarget(SHOT))).noTarget, true);
});

test('the shot line and the shot row read a stored yield first, as one rule', () => {
    const stored = { ...SHOT, annotations: { ...SHOT.annotations, actualYield: 36.4 } };
    const facts = shotFacts(stored, shotPlan(stored));
    const row = shotRowFacts(stored);
    assert.equal(facts.yield, 36.4);
    assert.deepEqual([row.dose, row.yield], [facts.dose, facts.yield]);
    const none = shotFacts(SHOT, shotPlan(SHOT));
    assert.equal(shotRowFacts(SHOT).yield, null);
    assert.notEqual(none.yield, null);
});

test('the shot line facts keep the last cup weight of a shot the model cannot run', () => {
    const usable = shotFacts(SHOT, shotPlan(SHOT));
    for (const record of [withoutTarget(SHOT), withShotFlag(SHOT, true)]) {
        const plan = shotPlan(record);
        assert.equal(plan.usable, false);
        const facts = shotFacts(record, plan);
        assert.equal(facts.yield, usable.yield);
        assert.equal(facts.time, usable.time);
    }
});
