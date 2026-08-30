
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CUP_WARMER_CAPABILITY,
    CUP_WARMER_STATUS,
    PREHEAT_CAPABILITY,
    PREHEAT_WARNING,
    createCupWarmerStore,
    emptyCupWarmerState,
    hasEnabledWakeSchedule,
    hasSetpoint,
    isWarmerOn,
    preheatWarnings,
    readPreheat,
    readWarmer,
} from '../src/stores/cup-warmer.js';
import { ABSENCE, hasReading, isNoReading } from '../src/data/reading.js';

const ok = (data, status = 200) => ({ ok: true, status, data });
const fail = (status, error = 'nope') => ({ ok: false, kind: 'http', status, message: `-> ${status}`, problem: { error } });
const netFail = () => ({ ok: false, kind: 'network', status: null, message: 'connection refused', problem: null });

/** The body the handler serves: three keys, no pre-heat key of any kind. */
const WARMER = Object.freeze({ temperature: 60, enabled: true, currentTemperature: 42.0 });
/** `CupWarmerPreheatState.toJson`. Its own route. */
const PREHEAT = Object.freeze({ enabled: true, leadMinutes: 30, active: false });

function recordingLogger() {
    const lines = [];
    const self = {
        debug: (...a) => lines.push(['debug', ...a]),
        info: (...a) => lines.push(['info', ...a]),
        warn: (...a) => lines.push(['warn', ...a]),
        error: (...a) => lines.push(['error', ...a]),
        scope: () => self,
        lines,
    };
    return self;
}

function fixture({
    warmer = ok(WARMER),
    preheat = ok(PREHEAT),
    capabilities = [CUP_WARMER_CAPABILITY, PREHEAT_CAPABILITY],
    schedules = null,
    write = ok({ status: 'accepted' }),
} = {}) {
    const calls = [];
    const answers = { warmer, preheat };
    const routes = {
        cupWarmer: async () => { calls.push(['GET', 'cupWarmer']); return answers.warmer; },
        cupWarmerPreheat: async () => { calls.push(['GET', 'preheat']); return answers.preheat; },
        setCupWarmer: async (body) => { calls.push(['PUT', 'cupWarmer', body]); return write; },
        setCupWarmerPreheat: async (body) => { calls.push(['PUT', 'preheat', body]); return write; },
    };
    const logger = recordingLogger();
    const store = createCupWarmerStore({
        routes,
        readCapabilities: capabilities === undefined ? null : async () => capabilities,
        readSchedules: schedules === undefined ? null : async () => schedules,
        logger,
        now: () => 1_700_000_000_000,
    });
    return { store, calls, logger, routes, answers };
}

describe('dead premise 1 — on/off is READ, never inferred from the setpoint', () => {
    test('a machine holding 60 C with the warmer OFF reads as off', () => {
        const warmer = readWarmer({ temperature: 60, enabled: false, currentTemperature: null });
        assert.equal(isWarmerOn(warmer), false, 'the old `temperature > 0` oracle painted this ON');
        assert.equal(hasSetpoint(warmer), true, 'and it keeps its target, which is why the skin stores none');
    });

    test('an absent enable is UNKNOWN, not off', () => {
        const warmer = readWarmer({ temperature: 60 });
        assert.equal(isWarmerOn(warmer), null);
        assert.equal(isNoReading(warmer.enabled), true);
    });

    test('no warmer state at all is unknown, not off', () => {
        assert.equal(isWarmerOn(null), null);
        assert.equal(hasSetpoint(null), null);
    });
});

describe('null and absent both mean no reading, never fabricated data', () => {
    test('a null currentTemperature is an absence carrying its reason', () => {
        const warmer = readWarmer({ temperature: 60, enabled: false, currentTemperature: null });
        assert.equal(isNoReading(warmer.currentTemperature), true);
        assert.equal(warmer.currentTemperature.reason, ABSENCE.NULL);
        assert.equal(hasReading(warmer.currentTemperature), false);
        assert.ok(Number.isNaN(Number(warmer.currentTemperature)), 'arithmetic on an absence must be loud');
    });

    test('an absent currentTemperature is an absence too, with a different reason', () => {
        const warmer = readWarmer({ temperature: 60, enabled: true });
        assert.equal(warmer.currentTemperature.reason, ABSENCE.ABSENT);
    });

    test('a real reading stays a number', () => {
        const warmer = readWarmer(WARMER);
        assert.equal(warmer.currentTemperature, 42);
        assert.equal(warmer.temperature, 60);
        assert.equal(warmer.enabled, true);
    });

    test('no body is null — "not loaded" is not "loaded and off"', () => {
        assert.equal(readWarmer(null), null);
        assert.equal(readWarmer(undefined), null);
        assert.equal(readPreheat(null), null);
    });
});

describe('the two named warning states', () => {
    const preheatOn = readPreheat(PREHEAT);

    test('an enabled pre-heat with the warmer off is named', () => {
        const warnings = preheatWarnings({
            preheat: preheatOn,
            warmer: readWarmer({ temperature: 60, enabled: false, currentTemperature: null }),
            schedules: [{ enabled: true }],
        });
        assert.deepEqual(warnings, [PREHEAT_WARNING.NO_SETPOINT]);
    });

    test('an enabled pre-heat with a zero setpoint is named too', () => {
        const warnings = preheatWarnings({
            preheat: preheatOn,
            warmer: readWarmer({ temperature: 0, enabled: true, currentTemperature: null }),
            schedules: [{ enabled: true }],
        });
        assert.deepEqual(warnings, [PREHEAT_WARNING.NO_SETPOINT]);
    });

    test('an enabled pre-heat with every wake window disabled is named', () => {
        const warnings = preheatWarnings({
            preheat: preheatOn,
            warmer: readWarmer(WARMER),
            schedules: [{ enabled: false }, { enabled: false }],
        });
        assert.deepEqual(warnings, [PREHEAT_WARNING.NO_SCHEDULE]);
    });

    test('both at once', () => {
        const warnings = preheatWarnings({
            preheat: preheatOn,
            warmer: readWarmer({ temperature: 0, enabled: false }),
            schedules: [],
        });
        assert.deepEqual(warnings, [PREHEAT_WARNING.NO_SETPOINT, PREHEAT_WARNING.NO_SCHEDULE]);
    });

    test('a disabled pre-heat warns about nothing', () => {
        assert.deepEqual(preheatWarnings({
            preheat: readPreheat({ enabled: false, leadMinutes: 30, active: false }),
            warmer: readWarmer({ temperature: 0, enabled: false }),
            schedules: [],
        }), []);
    });

    test('an UNKNOWN schedule list never cries wolf', () => {
        assert.equal(hasEnabledWakeSchedule(null), null);
        assert.equal(hasEnabledWakeSchedule(undefined), null);
        assert.equal(hasEnabledWakeSchedule('nope'), null);
        assert.deepEqual(preheatWarnings({ preheat: preheatOn, warmer: readWarmer(WARMER), schedules: null }), []);
    });

    test('an unknown warmer state never cries wolf either', () => {
        assert.deepEqual(preheatWarnings({ preheat: preheatOn, warmer: null, schedules: [{ enabled: true }] }), []);
    });

    test('a wake window without an explicit enable counts as enabled (the spec default)', () => {
        assert.equal(hasEnabledWakeSchedule([{}]), true);
        assert.equal(hasEnabledWakeSchedule([{ enabled: false }]), false);
        assert.equal(hasEnabledWakeSchedule([]), false);
    });
});

describe('the loading / ready / error trichotomy', () => {
    test('it starts loading, with nothing invented', () => {
        const { store } = fixture();
        const state = store.get();
        assert.equal(state.status, CUP_WARMER_STATUS.LOADING);
        assert.equal(state.warmer, null);
        assert.equal(state.supported, null);
        assert.deepEqual(state, emptyCupWarmerState());
    });

    test('a good read is ready, with both routes consulted', async () => {
        const { store, calls } = fixture();
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.READY);
        assert.equal(state.supported, true);
        assert.equal(state.preheatSupported, true);
        assert.equal(state.warmer.temperature, 60);
        assert.equal(state.preheat.leadMinutes, 30);
        assert.equal(state.fetchedAt, 1_700_000_000_000);
        assert.deepEqual(calls, [['GET', 'cupWarmer'], ['GET', 'preheat']]);
    });

    test('A FAILED FETCH IS AN ERROR, NEVER A SNAPSHOT — the whole reason this survives', async () => {
        const { store, logger } = fixture({ warmer: netFail() });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.ERROR);
        assert.equal(state.warmer, null, 'a failed fetch must not become a {temperature: 0} snapshot');
        assert.equal(state.error.kind, 'network');
        assert.equal(state.refreshing, false);
        assert.ok(logger.lines.some(([level]) => level === 'error'));
    });

    test('a 500 is an error, and pre-heat is never asked', async () => {
        const { store, calls } = fixture({ warmer: fail(500) });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.ERROR);
        assert.deepEqual(calls, [['GET', 'cupWarmer']]);
    });

    test('a failed refresh keeps the last good frame and flags it, rather than blanking', async () => {
        const { store, answers } = fixture();
        await store.refresh();
        answers.warmer = netFail();
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.ERROR);
        assert.equal(state.warmer.temperature, 60, 'last-known value survives');
        assert.equal(state.fetchedAt, 1_700_000_000_000, 'and carries the age it was read at');
    });

    test('invalidate returns to loading, not to a synthetic off', () => {
        const { store } = fixture();
        assert.deepEqual(store.invalidate(), emptyCupWarmerState());
    });
});

describe('support is the capability list, then the handler 404 — never a payload shape', () => {
    test('a machine that does not list the cup warmer is unsupported, with no fetch', async () => {
        const { store, calls } = fixture({ capabilities: [] });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.UNSUPPORTED);
        assert.equal(state.supported, false);
        assert.deepEqual(calls, [], 'a DE1 must not be asked for a Bengle route');
    });

    test('a 404 from the gate means the feature is absent, not an error to show', async () => {
        const { store } = fixture({ capabilities: null, warmer: fail(404, 'cupWarmer not supported') });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.UNSUPPORTED);
        assert.equal(state.error, null, 'a feature gate is not an error banner');
    });

    test('unknown capabilities are not "absent" — the read still happens', async () => {
        const { store, calls } = fixture({ capabilities: null });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.READY);
        assert.deepEqual(calls, [['GET', 'cupWarmer'], ['GET', 'preheat']]);
    });

    test('a machine without the preheat capability is not asked for it', async () => {
        const { store, calls } = fixture({ capabilities: [CUP_WARMER_CAPABILITY] });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.READY);
        assert.equal(state.preheatSupported, false);
        assert.deepEqual(calls, [['GET', 'cupWarmer']]);
    });

    test('a pre-heat 404 disables pre-heat alone; the warmer stays ready', async () => {
        const { store } = fixture({ preheat: fail(404, 'cupWarmer/preheat not supported') });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.READY);
        assert.equal(state.preheatSupported, false);
        assert.equal(state.preheat, null);
        assert.equal(state.preheatError, null);
    });

    test('a pre-heat 500 is recorded separately and does not fabricate a pre-heat state', async () => {
        const { store } = fixture({ preheat: fail(500) });
        const state = await store.refresh();
        assert.equal(state.status, CUP_WARMER_STATUS.READY);
        assert.equal(state.preheat, null);
        assert.equal(state.preheatSupported, null, 'unknown, not "your firmware lacks it"');
        assert.equal(state.preheatError.status, 500);
    });
});

describe('writes go to the right route with the right body, and never predict the result', () => {
    test('turning the warmer OFF sends {enabled:false}, never {temperature:0}', async () => {
        const { store, calls } = fixture();
        await store.setEnabled(false);
        assert.deepEqual(calls[0], ['PUT', 'cupWarmer', { enabled: false }]);
    });

    test('a write is followed by a re-read rather than an assumed state', async () => {
        const { store, calls } = fixture();
        await store.setEnabled(true);
        assert.deepEqual(calls.map((c) => c.slice(0, 2)), [
            ['PUT', 'cupWarmer'], ['GET', 'cupWarmer'], ['GET', 'preheat'],
        ]);
    });

    test('setTarget sends the temperature and may state the enable explicitly', async () => {
        const { store, calls } = fixture();
        await store.setTarget(65);
        assert.deepEqual(calls[0], ['PUT', 'cupWarmer', { temperature: 65 }]);
        await store.setTarget(65, { enabled: false });
        assert.deepEqual(calls[3], ['PUT', 'cupWarmer', { temperature: 65, enabled: false }]);
    });

    test('the 0-80 range is NOT re-validated in the skin — the server refuses', async () => {
        const { store, calls } = fixture({ write: fail(400, 'temperature must be a whole degree from 0 to 80') });
        const result = await store.setTarget(999);
        assert.deepEqual(calls[0], ['PUT', 'cupWarmer', { temperature: 999 }], 'the request must be SENT, not pre-judged');
        assert.equal(result.ok, false);
        assert.equal(store.get().error.problem.error, 'temperature must be a whole degree from 0 to 80');
    });

    test('pre-heat writes carry only what changed', async () => {
        const { store, calls } = fixture();
        await store.setPreheat({ leadMinutes: 45 });
        assert.deepEqual(calls[0], ['PUT', 'preheat', { leadMinutes: 45 }]);
        await store.setPreheat({ enabled: false });
        assert.deepEqual(calls[3], ['PUT', 'preheat', { enabled: false }]);
    });

    test('an empty pre-heat write is refused locally instead of sending a body the handler 400s', async () => {
        const { store, calls, logger } = fixture();
        const result = await store.setPreheat({});
        assert.deepEqual(result, { ok: false, empty: true });
        assert.deepEqual(calls, []);
        assert.ok(logger.lines.some(([level]) => level === 'error'));
    });

    test('a failed write leaves no optimistic state behind', async () => {
        const { store, answers } = fixture({ write: netFail() });
        await store.refresh();
        answers.warmer = ok({ ...WARMER, enabled: true });
        const before = store.get().warmer.enabled;
        const result = await store.setEnabled(false);
        assert.equal(result.ok, false);
        assert.equal(store.get().warmer.enabled, before, 'the store showed a change the machine never made');
        assert.equal(store.get().status, CUP_WARMER_STATUS.ERROR);
    });

    test('the store refuses to exist without its route helpers', () => {
        assert.throws(() => createCupWarmerStore({ routes: {} }), /routes\.cupWarmer\(\) must be injected/);
    });
});

describe('reactive, and frozen', () => {
    test('a late subscriber gets the last frame', async () => {
        const { store } = fixture();
        await store.refresh();
        const seen = [];
        store.subscribe((state) => seen.push(state.status));
        assert.deepEqual(seen, [CUP_WARMER_STATUS.READY]);
    });

    test('every frame is a new frozen object — no in-place mutation for Lit to miss', async () => {
        const { store } = fixture();
        const first = store.get();
        await store.refresh();
        const second = store.get();
        assert.notEqual(first, second);
        assert.equal(Object.isFrozen(second), true);
        assert.throws(() => { second.status = 'tampered'; }, TypeError);
    });

    test('warnings are recomputed on every refresh', async () => {
        const { store, answers } = fixture({ schedules: [] });
        await store.refresh();
        assert.deepEqual(store.get().warnings, [PREHEAT_WARNING.NO_SCHEDULE]);
        answers.warmer = ok({ ...WARMER, enabled: false });
        await store.refresh();
        assert.deepEqual(store.get().warnings, [PREHEAT_WARNING.NO_SETPOINT, PREHEAT_WARNING.NO_SCHEDULE]);
    });
});
