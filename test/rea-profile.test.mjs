// The one profile sanitizer, and the refusal philosophy (B9).
//
// The drift test is the one that matters: in the old skin the SAVE path and the ARM path
// ran different sanitizers, and a stop-at-weight target survived one and not the other.
// Here both bodies are built from the same function, so the test can assert the equality
// directly — which is what "inexpressible rather than fixed" means in practice.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    sanitizeProfileForRea,
    profileCreateBody,
    profileUpdateBody,
    profileArmBody,
    profileRefusal,
    workflowApplyBody,
    DEFAULT_DOSE_G,
    LEGACY_PROFILE_KEYS,
    REA_EXIT_TYPES, profileFailureSentence,
} from '../src/data/rea-profile.js';
import { REA_ROOT } from '../scripts/generate-machine-state.js';

const step = (over = {}) => ({
    name: 'infuse',
    pump: 'flow',
    transition: 'smooth',
    volume: 100,
    seconds: 30,
    temperature: 92,
    sensor: 'coffee',
    flow: 2,
    ...over,
});

const profile = (over = {}) => ({
    title: 'Test',
    steps: [step()],
    tank_temperature: 20,
    target_volume_count_start: 0,
    ...over,
});

describe('the three transformations', () => {
    test('version defaults to 2 and is not overwritten', () => {
        assert.equal(sanitizeProfileForRea(profile()).version, '2');
        assert.equal(sanitizeProfileForRea(profile({ version: '2.1' })).version, '2.1');
    });

    test('the six legacy TCL keys are dropped', () => {
        const legacy = Object.fromEntries(LEGACY_PROFILE_KEYS.map((k) => [k, 'x']));
        const out = sanitizeProfileForRea(profile(legacy));
        for (const key of LEGACY_PROFILE_KEYS) assert.ok(!(key in out), `${key} survived`);
        assert.equal(LEGACY_PROFILE_KEYS.length, 6);
    });

    test('a weight exit folds into step.weight and the exit goes', () => {
        const out = sanitizeProfileForRea(profile({ steps: [step({ exit: { type: 'weight', condition: 'over', value: 36 } })] }));
        assert.equal(out.steps[0].weight, 36);
        assert.ok(!('exit' in out.steps[0]));
    });

    test('an existing weight target wins over the exit value', () => {
        const out = sanitizeProfileForRea(profile({ steps: [step({ weight: 40, exit: { type: 'weight', value: 36 } })] }));
        assert.equal(out.steps[0].weight, 40);
    });

    test("an 'off' exit becomes ReaPrime's null", () => {
        const out = sanitizeProfileForRea(profile({ steps: [step({ exit: { type: 'off', value: 0 } })] }));
        assert.equal(out.steps[0].exit, null);
    });

    test('the input is never mutated', () => {
        const input = profile({ steps: [step({ exit: { type: 'weight', value: 36 } })], type: 'legacy' });
        const snapshot = JSON.stringify(input);
        sanitizeProfileForRea(input);
        assert.equal(JSON.stringify(input), snapshot);
    });
});

describe('B9 — send it, let the server refuse', () => {
    for (const type of REA_EXIT_TYPES) {
        test(`a ${type} exit passes through untouched`, () => {
            const exit = { type, condition: 'over', value: 4 };
            const out = sanitizeProfileForRea(profile({ steps: [step({ exit })] }));
            assert.deepEqual(out.steps[0].exit, exit);
        });
    }

    test('an exit type NEITHER model knows is sent, not silently dropped', () => {
        // The old sanitizer nulled everything outside pressure/flow/power. That turns an
        // unrecognised exit into a step with no exit at all — a silent behaviour change,
        // which is the thing B9 exists to prevent. ReaPrime answers 400 naming the value
        // (ExitType.values.byName throws ArgumentError; both handlers map it).
        const exit = { type: 'time', condition: 'over', value: 25 };
        const out = sanitizeProfileForRea(profile({ steps: [step({ exit })] }));
        assert.deepEqual(out.steps[0].exit, exit);
    });

    test('a power step keeps its limiter, including a zero one', () => {
        // Nulling a zero limiter converts one typed refusal into another for no gain:
        // ProfileStepPower.fromJson rejects a null limiter AND a zero-valued one.
        const limiter = { value: 0, range: 0.6 };
        const out = sanitizeProfileForRea(profile({ steps: [step({ pump: 'power', power: 40, limiter })] }));
        assert.deepEqual(out.steps[0].limiter, limiter);
    });

    test('mixed pump fields are not pruned', () => {
        const out = sanitizeProfileForRea(profile({ steps: [step({ pump: 'flow', flow: 2, pressure: 9 })] }));
        assert.equal(out.steps[0].pressure, 9, 'ProfileStep.fromJson dispatches on pump and ignores the rest');
    });
});

describe('the save path and the arm path cannot diverge', () => {
    test('both bodies carry the identical sanitized profile', () => {
        const input = profile({ steps: [step({ exit: { type: 'weight', condition: 'over', value: 36 } })], lang: 'en' });
        const saved = profileCreateBody(input).profile;
        const armed = profileArmBody(input);
        assert.deepEqual(saved, armed);
        assert.equal(armed.steps[0].weight, 36, 'the target that used to be lost at arm time');
    });

    test('POST /profiles wraps, POST /machine/profile does not', () => {
        const body = profileCreateBody(profile(), { parentId: 'p0', metadata: { note: 'x' } });
        assert.deepEqual(Object.keys(body).sort(), ['metadata', 'parentId', 'profile']);
        assert.ok(!('profile' in profileArmBody(profile())), 'the arm body IS the profile');
        assert.equal(profileArmBody(profile()).title, 'Test');
    });

    test('a metadata-only update sends no profile at all', () => {
        assert.deepEqual(profileUpdateBody({ metadata: { rating: 4 } }), { metadata: { rating: 4 } });
        assert.deepEqual(Object.keys(profileUpdateBody({ profile: profile() })), ['profile']);
    });
});

describe('surfacing the refusal', () => {
    test('the arm-time capability refusal is typed as unsupported', () => {
        const refusal = profileRefusal({
            ok: false, status: 400,
            problem: { error: 'Unsupported profile', message: 'Power steps require firmware >= 3' },
        });
        assert.deepEqual(refusal, { kind: 'unsupported', error: 'Unsupported profile', message: 'Power steps require firmware >= 3' });
    });

    test('a parse rejection is typed as invalid', () => {
        const refusal = profileRefusal({ ok: false, status: 400, problem: { error: 'Invalid profile', message: 'FormatException: power step requires a pressure limiter' } });
        assert.equal(refusal.kind, 'invalid');
    });

    test('a 500 or a success is not a refusal', () => {
        assert.equal(profileRefusal({ ok: false, status: 500, problem: { error: 'boom' } }), null);
        assert.equal(profileRefusal({ ok: true, data: null }), null);
        assert.equal(profileRefusal({ ok: false, status: 400, problem: 'plain text' }), null);
    });
});

describe('the premises, checked against ReaPrime', () => {
    const dart = (rel) => {
        const path = join(REA_ROOT, rel);
        assert.ok(existsSync(path), `ReaPrime source missing: ${path} (set REA_ROOT)`);
        return readFileSync(path, 'utf8');
    };

    test('ExitType is still the three the sanitizer passes through', () => {
        assert.match(dart('lib/src/models/data/profile.dart'), /enum ExitType \{ pressure, flow, power \}/);
        assert.deepEqual([...REA_EXIT_TYPES], ['pressure', 'flow', 'power']);
    });

    test('ProfileStep.fromJson still dispatches on pump alone', () => {
        const source = dart('lib/src/models/data/profile.dart');
        assert.match(source, /json\.containsKey\('pump'\) && json\['pump'\] == 'pressure'/);
        assert.match(source, /json\.containsKey\('pump'\) && json\['pump'\] == 'lever'/);
    });

    test('a power step still requires a non-zero limiter', () => {
        assert.match(dart('lib/src/models/data/profile.dart'), /limiter == null \|\| limiter\.value == 0[\s\S]{0,120}power step requires a pressure limiter/);
    });

    test('the workflow handler still answers a bad profile with a 400, not a hang', () => {
        const source = dart('lib/src/services/webserver/workflow_handler.dart');
        assert.match(source, /on ArgumentError catch \(e\) \{\s*return jsonBadRequest/);
        assert.match(source, /on FormatException catch \(e\) \{\s*return jsonBadRequest/);
        assert.match(source, /queueWaitTimeout, \(\) \{[\s\S]{0,200}jsonServiceUnavailable/);
    });

    test('the arm-time refusal is still a typed 400', () => {
        const source = dart('lib/src/services/webserver/de1handler.dart');
        assert.match(source, /on ProfileModeUnsupportedException catch \(e\)[\s\S]{0,700}'error': 'Unsupported profile'/);
    });

    test('POST /profiles still wraps and POST /machine/profile still does not', () => {
        assert.match(dart('lib/src/services/webserver/profile_handler.dart'), /Profile\.fromJson\(json\['profile'\] as Map<String, dynamic>\)/);
        assert.match(dart('lib/src/services/webserver/de1handler.dart'), /final Map<String, dynamic> json = jsonDecode\(payload\);\s*profile = Profile\.fromJson\(json\);/);
    });
});

/* ═════════════════════════════ loading a profile, and the numbers it carries ═════ */

describe('workflowApplyBody — what a profile load puts on the workflow', () => {
    const profile = Object.freeze({
        title: 'Extractamundo Dos!', version: '2', target_weight: 36,
        steps: [{ name: 'a', pump: 'flow', temperature: 92 }],
    });
    const record = (metadata) => ({ id: 'profile:abc', profile, metadata });

    test('the profile is sent WITH the context, because only the document carries both', () => {
        const body = workflowApplyBody(record(null));
        assert.equal(body.profile.title, 'Extractamundo Dos!');
        assert.deepEqual(Object.keys(body).sort(), ['context', 'profile']);
    });

    test('a record that remembers nothing falls to the profile\'s own yield and 18 g', () => {
        /* The old app's own floor (`profileManager.js:524`): ReaPrime's Profile model has
         * no dose field at all, so there is nothing else to fall to. */
        assert.deepEqual(workflowApplyBody(record(null)).context, {
            targetDoseWeight: DEFAULT_DOSE_G, targetYield: 36, grinderSetting: null,
        });
    });

    test('a record that remembers them wins over the profile\'s own numbers', () => {
        assert.deepEqual(workflowApplyBody(record({
            targetDoseWeight: 17, targetYield: 40, grinderSetting: '8.50',
        })).context, { targetDoseWeight: 17, targetYield: 40, grinderSetting: '8.50' });
    });

    test('THE YIELD IS FOLDED INTO THE PROFILE, or the machine stops at the wrong weight', () => {
        /* On a machine without autonomous stop-at-weight ReaPrime stops the shot on
         * `profile.target_weight`, so a yield held only in `context` is a number the rail
         * shows and the machine never reaches. */
        const body = workflowApplyBody(record({ targetYield: 40 }));
        assert.equal(body.profile.target_weight, 40);
        assert.equal(profile.target_weight, 36, 'and the caller\'s own record is untouched');
    });

    test('a yield of zero leaves the profile alone rather than writing a zero stop', () => {
        const body = workflowApplyBody({ id: 'x', profile: { ...profile, target_weight: 0 } });
        assert.equal(body.profile.target_weight, 0);
        assert.equal(body.context.targetYield, 0);
    });

    test('grinderSetting is NULL and not absent, so the last profile\'s grind is cleared', () => {
        /* `deepMergeJson` only overwrites keys the body carries. An absent key would leave
         * the previous profile's grind standing against this one. */
        assert.equal('grinderSetting' in workflowApplyBody(record(null)).context, true);
        assert.equal(workflowApplyBody(record(null)).context.grinderSetting, null);
    });

    test('a record with no profile on it is null, not a body with holes in it', () => {
        assert.equal(workflowApplyBody(null), null);
        assert.equal(workflowApplyBody({ id: 'x' }), null);
    });

    test('the profile goes through the ONE sanitizer, like every other write', () => {
        const legacy = { ...profile, hidden: true, lang: 'en' };
        const body = workflowApplyBody({ id: 'x', profile: legacy });
        for (const key of LEGACY_PROFILE_KEYS) assert.equal(key in body.profile, false, key);
    });
});

describe('the two routes a profile load takes, read at the pin', () => {
    const dart = (rel) => {
        const path = join(REA_ROOT, rel);
        assert.ok(existsSync(path), `ReaPrime source missing: ${path} (set REA_ROOT)`);
        return readFileSync(path, 'utf8');
    };

    test('POST /machine/profile arms and touches no document', () => {
        /* `_profileHandler` calls `de1.setProfile` and returns. There is no
         * WorkflowController write in it — which is why arming alone left the title,
         * the rail and every recorded shot naming the profile before. */
        const source = dart('lib/src/services/webserver/de1handler.dart');
        const handler = source.slice(source.indexOf('Future<Response> _profileHandler'));
        const body = handler.slice(0, handler.indexOf('Future<Response> _shotSettingsHandler'));
        assert.match(body, /await de1\.setProfile\(profile\)/);
        assert.equal(/_workflowController\.|setWorkflow/.test(body), false,
            'if this handler starts writing the workflow, the second call in arm() is redundant');
    });

    test('PUT /workflow stores the document, and the device sync arms from it', () => {
        assert.match(dart('lib/src/services/webserver/workflow_handler.dart'),
            /deepMergeJson\(currentJson, merge\)[\s\S]{0,400}setWorkflowIfRevision/);
        assert.match(dart('lib/src/controllers/workflow_device_sync.dart'),
            /runDeviceWrite\(\(device\) => device\.setProfile\(profile\)\)/);
    });

    test('deepMergeJson merges MAPS and replaces everything else', () => {
        /* Which is why a `profile` in the body replaces the profile whole — its steps
         * array included — while the blocks the body does not name are left alone. */
        const source = readFileSync(join(REA_ROOT, 'lib/src/models/data/json_utils.dart'), 'utf8');
        assert.match(source, /baseValue is Map<String, dynamic> &&\s*updateValue is Map<String, dynamic>\)?\s*\{?\s*result\[key\] = deepMergeJson/);
    });
});

describe('profileFailureSentence — what the server said, when it was not a refusal', () => {
    /* ReaPrime's create path answers a CLIENT error with a 500: `_handleCreate` maps
     * ArgumentError and FormatException to 400 and lets everything else fall to a generic
     * catch, so a profile it cannot parse comes back "Internal server error" with the real
     * reason in `message`. Measured against the bench machine 28 August 2026 — the two
     * strings below are verbatim answers it gave. The editor showed "The save failed
     * (500)." and dropped both. */
    test('takes the message out of a 500 body', () => {
        assert.equal(
            profileFailureSentence({
                ok: false, status: 500,
                problem: { error: 'Internal server error', message: 'Exception: Invalid step type. Must include either "pressure" or "flow".' },
            }),
            'Exception: Invalid step type. Must include either "pressure" or "flow".',
        );
    });

    test('takes it for a TypeError too, which is the other uncaught shape', () => {
        assert.equal(
            profileFailureSentence({
                ok: false, status: 500,
                problem: { error: 'Internal server error', message: "type 'Null' is not a subtype of type 'String'" },
            }),
            "type 'Null' is not a subtype of type 'String'",
        );
    });

    test('falls back to `error` when there is no message', () => {
        assert.equal(
            profileFailureSentence({ ok: false, status: 502, problem: { error: 'Bad gateway' } }),
            'Bad gateway',
        );
    });

    test('a body that was not JSON is the sentence, verbatim', () => {
        // parseProblem hands back the raw text when JSON.parse fails.
        assert.equal(
            profileFailureSentence({ ok: false, status: 500, problem: '  upstream closed the connection  ' }),
            'upstream closed the connection',
        );
    });

    test('says nothing rather than something empty', () => {
        for (const problem of [null, undefined, '', '   ', {}, { message: '  ' }, { error: '' }, 42]) {
            assert.equal(profileFailureSentence({ ok: false, status: 500, problem }), null,
                `problem ${JSON.stringify(problem)} must yield null, not an empty toast`);
        }
    });

    test('is not an answer about a success or a non-failure', () => {
        assert.equal(profileFailureSentence(null), null);
        assert.equal(profileFailureSentence({ ok: true, problem: { message: 'ignored' } }), null);
    });
});
