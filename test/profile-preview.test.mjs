/**
 *.3, the profile-preview shaper.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    profilePreviewDerivation,
    emptyProfilePreview,
    PREVIEW_REFUSAL,
    PREVIEW_CHANNEL_KEYS,
    PROFILE_PREVIEW_KIND,
} from '../src/lib/profile-preview.js';
import { SERIES_KEYS } from '../src/lib/shot-derivation.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const FIXTURE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8',
));

const step = (over = {}) => ({
    name: 'a step', pump: 'flow', transition: 'fast', seconds: 10, flow: 4, limiter: null, ...over,
});

describe('the shape the chart card reads', () => {
    test('a refusal carries a reason and empty everything, like gate 6\'s own', () => {
        const empty = emptyProfilePreview();
        assert.equal(empty.ok, false);
        assert.equal(empty.reason, PREVIEW_REFUSAL.NO_PROFILE);
        assert.deepEqual([...empty.axis.t], []);
        assert.deepEqual([...empty.stepMarks], []);
        assert.equal(empty.kind, PROFILE_PREVIEW_KIND);
    });

    test('the three refusals are told apart', () => {
        assert.equal(profilePreviewDerivation(null).reason, PREVIEW_REFUSAL.NO_PROFILE);
        assert.equal(profilePreviewDerivation({ steps: [] }).reason, PREVIEW_REFUSAL.NO_STEPS);
        assert.equal(
            profilePreviewDerivation({ steps: [step({ seconds: 0 })] }).reason,
            PREVIEW_REFUSAL.NO_DURATION,
        );
    });

    test('every SERIES_KEYS channel exists, and only two of them speak', () => {
        const preview = profilePreviewDerivation({ steps: [step()] });
        assert.deepEqual(Object.keys(preview.series).sort(), [...SERIES_KEYS].sort());
        const speaking = SERIES_KEYS.filter((key) => preview.series[key].x.length > 0);
        assert.deepEqual(speaking, [...PREVIEW_CHANNEL_KEYS].filter((k) => speaking.includes(k)));
        assert.deepEqual(speaking.sort(), [...PREVIEW_CHANNEL_KEYS].sort());
    });

    test('nothing is invented for the fields a profile cannot answer', () => {
        const preview = profilePreviewDerivation({ steps: [step()] });
        assert.equal(preview.scalars.dose, null);
        assert.equal(preview.scalars.yield, null);
        assert.equal(preview.counts.samples, 0);
        assert.equal(preview.availability.scale, false);
        assert.equal(preview.lastSample, null);
        assert.equal(preview.kind, PROFILE_PREVIEW_KIND,
            'and `kind` is how a gate-6 consumer can refuse one of these by name');
    });
});

describe('the curve', () => {
    test('two points per step, at its start and its end', () => {
        const preview = profilePreviewDerivation({
            steps: [step({ seconds: 10 }), step({ seconds: 5, pump: 'pressure', pressure: 6 })],
        });
        assert.deepEqual([...preview.axis.t], [0, 10, 10, 15]);
        assert.equal(preview.programmedSeconds, 15);
    });

    test('a FAST transition holds flat and a SMOOTH one ramps from where the trace was', () => {
        const fast = profilePreviewDerivation({
            steps: [step({ pump: 'pressure', pressure: 2 }), step({ pump: 'pressure', pressure: 8 })],
        });
        assert.deepEqual([...fast.series.targetPressure.y], [2, 2, 8, 8],
            'fast: flat, and the riser is the segment between two points at the same x');

        const smooth = profilePreviewDerivation({
            steps: [
                step({ pump: 'pressure', pressure: 2 }),
                step({ pump: 'pressure', pressure: 8, transition: 'smooth' }),
            ],
        });
        assert.deepEqual([...smooth.series.targetPressure.y], [2, 2, 2, 8],
            'smooth: the second step starts where the first left it and ramps');
    });

    test('a channel a step does not command leaves a GAP, never a commanded zero', () => {
        const preview = profilePreviewDerivation({ steps: [step({ pump: 'pressure', pressure: 6 })] });
        assert.deepEqual([...preview.series.targetPressure.y], [6, 6]);
        assert.deepEqual([...preview.series.targetFlow.y], [null, null],
            'stepTargetOverlay returns null for the channel a pressure step does not command');
    });

    test('a Power step draws pressure AT THE CAP, which is profile-modes\' own rule', () => {
        const preview = profilePreviewDerivation({
            steps: [step({ pump: 'power', power: 5, limiter: { value: 7, range: 1 } })],
        });
        assert.deepEqual([...preview.series.targetPressure.y], [7, 7]);
        assert.deepEqual([...preview.series.targetFlow.y], [null, null]);
    });

    test('BOTH CHANNELS SHARE ONE X ARRAY — the coupling chart-align.js needs', () => {
        const preview = profilePreviewDerivation({ steps: [step(), step({ seconds: 3 })] });
        assert.equal(preview.series.targetPressure.x, preview.series.targetFlow.x,
            'the same array by reference, so alignChannels takes its fast path');
        assert.equal(preview.series.targetPressure.x, preview.axis.t,
            'and the axis is that array too — the cursor indexes into the drawn points');
        assert.equal(preview.series.targetPressure.y.length, preview.axis.t.length);
        assert.equal(preview.series.targetFlow.y.length, preview.axis.t.length);
    });

    test('a zero-length step contributes a MARK but no points', () => {
        const preview = profilePreviewDerivation({
            steps: [step({ seconds: 0, name: 'instant' }), step({ seconds: 4, name: 'real' })],
        });
        assert.deepEqual(preview.stepMarks.map((m) => m.name), ['instant', 'real'],
            'a boundary that exists in the profile exists on the chart, named');
        assert.deepEqual([...preview.axis.t], [0, 4]);
    });

    test('an unnamed step marks with a null name rather than an invented one', () => {
        const preview = profilePreviewDerivation({ steps: [step({ name: '' })] });
        assert.equal(preview.stepMarks[0].name, null);
    });
});

describe('against every recorded profile', () => {
    test('every fixture profile draws, and the marks match its steps', () => {
        const refused = [];
        let drawn = 0;
        for (const record of FIXTURE) {
            const preview = profilePreviewDerivation(record.profile);
            if (!preview.ok) { refused.push([record.profile.title, preview.reason]); continue; }
            drawn += 1;
            assert.equal(preview.stepMarks.length, record.profile.steps.length,
                `${record.profile.title}: one mark per step`);
            assert.equal(preview.axis.t.length, preview.series.targetPressure.y.length);
            assert.ok(preview.programmedSeconds > 0);
            assert.ok(preview.axis.t.every((t, i) => i === 0 || t >= preview.axis.t[i - 1]),
                `${record.profile.title}: the x axis never goes backwards`);
        }
        assert.equal(drawn + refused.length, FIXTURE.length);
        assert.ok(drawn > 0, 'the fixture has profiles that draw');
        /* A REFUSAL IS REPORTED, NOT SWALLOWED. If a real profile stops drawing, this
         * number moves and the reason names why — a blank chart on screen would not. */
        assert.deepEqual(refused, [], `profiles that could not be drawn: ${JSON.stringify(refused)}`);
    });
});
