/**
 * editor-draft-limiter-tolerance.test.mjs — THE PROFILE-WIDE LIMITER TOLERANCE.
 *
 * WHAT IT IS. `StepLimiter` carries `{value, range}`. `value` is the limit; `range` is the
 * soft-knee WIDTH beside it. Until now nothing in the editor could reach `range`, so every
 * step in every profile this skin wrote carried the one width a new step is born with, and
 * a profile authored elsewhere kept whatever it arrived with whether the author meant it
 * or not.
 *
 * WHY IT IS ONE CONTROL FOR THE WHOLE PROFILE AND NOT A MATRIX ROW. The two reference
 * skins both put it on the editor's settings tab as a pair of steppers, one per unit, and
 * both write the chosen width to every step of the matching kind. A per-step row would be
 * a twelfth matrix row for a number that is almost never authored per step.
 *
 * TWO STEPPERS AND NOT ONE, because the width is measured in the LIMIT'S own unit — bar
 * over a pressure limit, mL/s over a flow limit. Which pump modes land on which is
 * DERIVED from the mode table, so a flow step and a POWER step share the bar tolerance
 * and a pressure step and a LEVER step share the mL/s one; neither reference skin knows
 * about the second pair.
 *
 * THE ONE PLACE THIS PARTS COMPANY WITH BOTH REFERENCE SKINS. They write
 * `{value: 0, range}` onto a step whose limiter is `null`. `limiter: null` is how a step
 * says it has no limit, so this door leaves it alone and refuses when no step in the
 * profile carries such a limiter at all — a control that moves and writes nothing is the
 * fault the settings tab was rebuilt to remove.
 *
 * Every assertion is about a returned value. Nothing here reads a source file.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { applyLimiterTolerance } from '../src/lib/editor-draft.js';
/* The soft-knee width has ONE declaration in this tree; retyping 0.6 here would make this
 * file the second one. `LIMITER_TOLERANCES` is imported for the same reason: the two names
 * are the module's, not this file's. */
import {
    POWER_CAP_DEFAULT, LIMITER_TOLERANCES, limiterToleranceOf, limiterToleranceOfStep,
    limiterToleranceIn,
} from '../src/lib/profile-modes.js';

const PRESSURE = 'pressureLimitTolerance';
const FLOW = 'flowLimitTolerance';

const step = (over = {}) => ({
    name: 'preinfusion',
    pump: 'flow',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    flow: 4,
    limiter: { value: 9, range: POWER_CAP_DEFAULT.range },
    ...over,
});

const profile = (steps) => ({ version: 2, title: 'four steps', steps });

describe('which tolerance a mode uses', () => {
    test('the two tolerances are named once, in panel order', () => {
        assert.deepEqual([...LIMITER_TOLERANCES], [PRESSURE, FLOW]);
    });

    test('a pressure-shaped limiter takes the bar tolerance', () => {
        assert.equal(limiterToleranceOf('flow'), PRESSURE);
        assert.equal(limiterToleranceOf('power'), PRESSURE);
    });

    test('a flow-shaped limiter takes the mL/s tolerance', () => {
        assert.equal(limiterToleranceOf('pressure'), FLOW);
        assert.equal(limiterToleranceOf('lever'), FLOW);
    });

    test('a pump this build does not know answers nothing rather than flow', () => {
        assert.equal(limiterToleranceOfStep({ pump: 'sparkle' }), null);
        assert.equal(limiterToleranceOfStep({}), null);
        assert.equal(limiterToleranceOfStep(null), null);
    });
});

describe('the tolerance a profile is already authored with', () => {
    test('is the first matching step\'s', () => {
        const body = profile([
            step({ pump: 'pressure', limiter: { value: 8, range: 1.2 } }),
            step({ limiter: { value: 9, range: 2.4 } }),
        ]);
        assert.equal(limiterToleranceIn(body.steps, FLOW), 1.2);
        assert.equal(limiterToleranceIn(body.steps, PRESSURE), 2.4);
    });

    test('a step with no limiter object is skipped, not defaulted', () => {
        const body = profile([step({ limiter: null }), step({ limiter: { value: 9, range: 3.1 } })]);
        assert.equal(limiterToleranceIn(body.steps, PRESSURE), 3.1);
    });

    test('a profile with no such limiter answers null, which is not a width', () => {
        const body = profile([step({ limiter: null })]);
        assert.equal(limiterToleranceIn(body.steps, PRESSURE), null);
        assert.equal(limiterToleranceIn(body.steps, FLOW), null);
        assert.equal(limiterToleranceIn(null, PRESSURE), null);
    });
});

describe('writing the tolerance', () => {
    test('reaches every step of the matching kind and nothing else', () => {
        const body = profile([
            step(),
            step({ pump: 'power', power: 2, limiter: { value: 9, range: POWER_CAP_DEFAULT.range } }),
            step({ pump: 'pressure', pressure: 9, limiter: { value: 8, range: POWER_CAP_DEFAULT.range } }),
        ]);

        const out = applyLimiterTolerance(body, { tolerance: PRESSURE, value: 1.5 });

        assert.equal(out.applied, true);
        assert.equal(out.reason, null);
        assert.equal(out.draft.steps[0].limiter.range, 1.5, 'the flow step');
        assert.equal(out.draft.steps[1].limiter.range, 1.5, 'and the power step');
        assert.equal(out.draft.steps[2].limiter.range, POWER_CAP_DEFAULT.range,
            'the pressure step keeps its own, which is measured in the other unit');
    });

    test('leaves the limit itself alone', () => {
        const body = profile([step({ limiter: { value: 9, range: POWER_CAP_DEFAULT.range } })]);
        const out = applyLimiterTolerance(body, { tolerance: PRESSURE, value: 2.2 });
        assert.deepEqual(out.draft.steps[0].limiter, { value: 9, range: 2.2 });
    });

    test('does not invent a limiter on a step that has none', () => {
        const body = profile([step({ limiter: null }), step()]);
        const out = applyLimiterTolerance(body, { tolerance: PRESSURE, value: 2.2 });
        assert.equal(out.applied, true);
        assert.equal(out.draft.steps[0].limiter, null, 'no limit means no knee to widen');
        assert.equal(out.draft.steps[1].limiter.range, 2.2);
    });

    test('writes a NEW profile and new step objects, which is what Lit re-renders on', () => {
        const body = profile([step()]);
        const out = applyLimiterTolerance(body, { tolerance: PRESSURE, value: 2.2 });
        assert.notEqual(out.draft, body);
        assert.notEqual(out.draft.steps, body.steps);
        assert.notEqual(out.draft.steps[0], body.steps[0]);
        assert.equal(body.steps[0].limiter.range, POWER_CAP_DEFAULT.range, 'the source is untouched');
    });

    test('an unchanged step keeps its identity, so nothing re-renders for nothing', () => {
        const body = profile([step()]);
        const out = applyLimiterTolerance(body, {
            tolerance: PRESSURE, value: POWER_CAP_DEFAULT.range,
        });
        assert.equal(out.applied, true);
        assert.equal(out.draft.steps[0], body.steps[0]);
    });

    test('a step whose pump this build does not know is left alone', () => {
        const body = profile([step({ pump: 'sparkle' }), step()]);
        const out = applyLimiterTolerance(body, { tolerance: PRESSURE, value: 2.2 });
        assert.equal(out.draft.steps[0].limiter.range, POWER_CAP_DEFAULT.range);
        assert.equal(out.draft.steps[1].limiter.range, 2.2);
    });
});

describe('what it refuses, and says why', () => {
    const refused = (draft, detail) => {
        const out = applyLimiterTolerance(draft, detail);
        assert.equal(out.applied, false);
        assert.equal(out.draft, draft, 'a refusal leaves the draft exactly where it was');
        assert.ok(typeof out.reason === 'string' && out.reason.length > 0, 'and says why');
        return out.reason;
    };

    test('a profile in which no step carries such a limiter', () => {
        const body = profile([step({ limiter: null }), step({ pump: 'pressure', pressure: 9 })]);
        const reason = refused(body, { tolerance: PRESSURE, value: 1.1 });
        assert.match(reason, /no step/);
    });

    test('a tolerance nobody declared', () => {
        const body = profile([step()]);
        const reason = refused(body, { tolerance: 'temperatureTolerance', value: 1.1 });
        assert.match(reason, /not a limiter tolerance/);
        refused(body, {});
    });

    test('a value that is not a number', () => {
        const body = profile([step()]);
        refused(body, { tolerance: PRESSURE, value: Number.NaN });
        refused(body, { tolerance: PRESSURE, value: '1.4' });
    });

    test('a draft that is not a profile, and one with no steps', () => {
        refused(null, { tolerance: PRESSURE, value: 1.1 });
        refused({ title: 'no steps' }, { tolerance: PRESSURE, value: 1.1 });
    });
});
