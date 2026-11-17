import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    DE1_EMULATION_BLOCK, DE1_EMULATION_KEY, de1EmulationBlockOf, de1EmulationOf,
    de1EmulationSupported, withDe1Emulation,
} from '../src/lib/de1-emulation.js';
import { changeCountOf } from '../src/lib/editor-commit.js';

const step = (over = {}) => ({ name: 'Pour', pump: 'pressure', transition: 'fast', pressure: 9, ...over });

describe('the DE1 emulation value on a profile', () => {
    test('the key is de1_emulation', () => {
        assert.equal(DE1_EMULATION_KEY, 'de1_emulation');
    });

    test('a profile without the key reads as off', () => {
        assert.equal(de1EmulationOf({ title: 'A', steps: [] }), false);
        assert.equal(de1EmulationOf(null), false);
    });

    test('only a stored true reads as on', () => {
        assert.equal(de1EmulationOf({ de1_emulation: true }), true);
        assert.equal(de1EmulationOf({ de1_emulation: 1 }), false);
        assert.equal(de1EmulationOf({ de1_emulation: 'true' }), false);
    });

    test('on and then off round-trips on the profile object, and keeps every other key', () => {
        const profile = { title: 'A', steps: [step()] };
        const on = withDe1Emulation(profile, true);
        assert.equal(on.de1_emulation, true);
        assert.equal(de1EmulationOf(on), true);
        assert.deepEqual(on.steps, profile.steps);
        assert.equal(on.title, 'A');
        const off = withDe1Emulation(on, false);
        assert.equal(off.de1_emulation, false);
        assert.equal(de1EmulationOf(off), false);
        assert.equal('de1_emulation' in profile, false, 'the input is not changed');
    });
});

describe('the steps that block DE1 emulation', () => {
    test('pressure and flow steps do not block it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ pump: 'flow', flow: 4 })]), DE1_EMULATION_BLOCK.NONE);
        assert.equal(de1EmulationBlockOf([]), DE1_EMULATION_BLOCK.NONE);
        assert.equal(de1EmulationBlockOf(undefined), DE1_EMULATION_BLOCK.NONE);
    });

    test('a power step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ pump: 'power' })]), DE1_EMULATION_BLOCK.POWER);
    });

    test('a lever step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step({ pump: 'lever' })]), DE1_EMULATION_BLOCK.LEVER);
    });

    test('a hold step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ transition: 'hold' })]), DE1_EMULATION_BLOCK.HOLD);
    });
});

describe('whether the machine offers DE1 emulation', () => {
    test('no answer is not supported', () => {
        assert.equal(de1EmulationSupported(null), false);
        assert.equal(de1EmulationSupported({ machineLimits: () => null }), false);
    });

    test('only a true answer is supported', () => {
        assert.equal(de1EmulationSupported({ de1Emulation: () => true }), true);
        assert.equal(de1EmulationSupported({ de1Emulation: () => false }), false);
        assert.equal(de1EmulationSupported({ de1Emulation: () => 1 }), false);
    });
});

describe('the change count sees the DE1 emulation value', () => {
    const baseline = { title: 'A', steps: [step()] };

    test('switching it on is one change', () => {
        const answer = changeCountOf(withDe1Emulation(baseline, true), baseline);
        assert.equal(answer.count, 1);
        assert.deepEqual(answer.fields, ['de1_emulation']);
    });

    test('switching it on and off again is no change, though the key is now stored', () => {
        const draft = withDe1Emulation(withDe1Emulation(baseline, true), false);
        assert.equal(changeCountOf(draft, baseline).count, 0);
    });
});
