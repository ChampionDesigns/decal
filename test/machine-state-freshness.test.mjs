// The staleness gate for src/data/machine-state.generated.js (SCOPE Part 2 §7: every
// committed generated file has its generator in scripts/ and a test that regenerates it
// and fails on a diff).
//
// The cautionary tale in this tree is app.css — a checked-in build artifact whose pipeline
// had quietly stopped running, so new work compiled to nothing. The cautionary tale for
// THIS artifact is sharper, because it already happened: the hand-copied enum drifted
// twice in one object and both drifts shipped.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
    check,
    render,
    parseEnum,
    screamingCase,
    readSource,
    resolveCommit,
    PINNED_COMMIT,
    REA_ROOT,
    REPO_ROOT,
    OUT_FILE,
    ENUMS,
} from '../scripts/generate-machine-state.js';
import { MACHINE_STATES, MACHINE_SUBSTATES } from '../src/data/machine-state.generated.js';

describe('the committed artifact is what the generator produces', () => {
    test('regenerating produces no diff', () => {
        const result = check();
        if (result.stale) {
            assert.fail('src/data/machine-state.generated.js is stale — run: node scripts/generate-machine-state.js');
        }
        assert.equal(result.ok, true);
    });

    test('the CLI check exits 0 on a fresh tree', () => {
        const out = execFileSync(process.execPath, ['scripts/generate-machine-state.js', '--check'],
            { cwd: REPO_ROOT, encoding: 'utf8' });
        assert.match(out, /is fresh/);
    });

    test('the generator is pinned to the commit every Wave 0b contract entry stamps', () => {
        assert.equal(resolveCommit(), PINNED_COMMIT);
    });

    test('the artifact matches the source enum member for member, not just byte for byte', () => {
        // Byte equality alone would pass if the generator and the artifact were both wrong
        // together. This reads the Dart file independently.
        const { source } = readSource();
        assert.deepEqual([...MACHINE_STATES], parseEnum(source, 'MachineState'));
        assert.deepEqual([...MACHINE_SUBSTATES], parseEnum(source, 'MachineSubstate'));
        assert.ok(MACHINE_STATES.includes('schedIdle'), 'the member the hand copy lost');
        assert.ok(!MACHINE_STATES.includes('ready'), 'the member the hand copy invented');
    });

    test('every enum the generator claims to emit is actually in the artifact', () => {
        const artifact = readFileSync(OUT_FILE, 'utf8');
        for (const e of ENUMS) {
            assert.match(artifact, new RegExp(`export const ${e.list} =`));
            assert.match(artifact, new RegExp(`export const ${e.map} =`));
        }
        assert.match(artifact, /GENERATED FILE — DO NOT EDIT/);
    });
});

describe('the generator fails loudly rather than producing half an answer', () => {
    test('a missing source is a hard error naming the remedy', () => {
        assert.throws(() => readSource({ reaRoot: '/nonexistent/rea' }), /ReaPrime source not found/);
    });

    test('an unpinned source tree is refused', () => {
        assert.throws(() => resolveCommit({ reaRoot: REPO_ROOT }), /not the pinned/);
    });

    test('an enum that stops being a plain enum is refused, not partially parsed', () => {
        assert.throws(() => parseEnum('enum MachineState { idle, busy(1); }', 'MachineState'), /no longer a plain enum/);
        assert.throws(() => parseEnum('enum Other { a }', 'MachineState'), /not found/);
        assert.throws(() => parseEnum('enum MachineState { }', 'MachineState'), /is empty/);
    });

    test('comments and trailing commas in the enum body are tolerated', () => {
        const parsed = parseEnum('enum MachineState {\n idle, // resting\n schedIdle,\n /* x */ busy,\n}', 'MachineState');
        assert.deepEqual(parsed, ['idle', 'schedIdle', 'busy']);
    });

    test('symbolic names are mechanical, including the acronym cases', () => {
        assert.equal(screamingCase('schedIdle'), 'SCHED_IDLE');
        assert.equal(screamingCase('hotWater'), 'HOT_WATER');
        assert.equal(screamingCase('errorTSensor'), 'ERROR_T_SENSOR');
        assert.equal(screamingCase('errorOOM'), 'ERROR_OOM');
        assert.equal(screamingCase('idle'), 'IDLE');
    });

    test('rendering is deterministic — the freshness check depends on it', () => {
        assert.equal(render(), render());
    });

    test('REA_ROOT points at the pinned reference worktree, read-only', () => {
        assert.equal(REA_ROOT.includes('rea-reanchor-v3'), true);
    });
});
