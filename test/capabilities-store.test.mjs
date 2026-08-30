
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    createCapabilitiesStore,
    readCapabilityEntries,
    readFeedbackAvailability,
    SERVED_CAPABILITIES,
    CAPABILITY,
    CAPABILITY_REASON,
    CAPABILITY_GAPS,
    FEEDBACK_SCREENSHOTS_ATTACH,
    PROFILE_MODE_BIT,
} from '../src/stores/capabilities-store.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const SEVEN = Object.freeze([
    'cupWarmer', 'integratedScale', 'stopAtWeight', 'ledStrip', 'scaleCalibration', 'preheat', 'wakeSchedule',
]);

const ok = (data) => ({ ok: true, status: 200, data, notModified: false });
const fail = (status, message) => ({ ok: false, kind: 'http', status, message, problem: null });

function storeWith(...answers) {
    const calls = [];
    const queue = [...answers];
    const routes = {
        capabilities: async () => {
            calls.push('capabilities');
            return queue.length > 1 ? queue.shift() : queue[0];
        },
    };
    return { store: createCapabilitiesStore({ routes, now: () => 1234 }), calls };
}

const machineInfo = (over = {}) => ({
    version: '1293',
    model: 'decentDe1',
    serialNumber: '12345',
    GHC: true,
    extra: { refillKit: true, voltage: 230, profileModeCaps: 0x3 },
    ...over,
});

describe('the seven, as the handler writes them', () => {
    test('SEVEN here is a FIXTURE, and the staleness gate lives where it can see the Dart', () => {
        assert.deepEqual([...SERVED_CAPABILITIES], [...SEVEN]);
    });

    test('the body reader accepts the served shape and refuses anything else', () => {
        assert.deepEqual([...readCapabilityEntries({ capabilities: SEVEN })], [...SEVEN]);
        assert.deepEqual([...readCapabilityEntries({ capabilities: [] })], []);
        for (const bad of [null, {}, { capabilities: null }, { capabilities: [1] }, 'x']) {
            assert.equal(readCapabilityEntries(bad), null);
        }
    });
});

describe('nothing happens until it is asked', () => {
    test('construction issues no request', async () => {
        const { calls } = storeWith(ok({ capabilities: SEVEN }));
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(calls, []);
    });

    test('every capability is UNKNOWN before the first load, and offering fails closed', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN);
        assert.equal(store.offers('cupWarmer'), false);
        assert.equal(store.reason(), CAPABILITY_REASON.NOT_LOADED);
    });

    test('a transport must be injected', () => {
        assert.throws(() => createCapabilitiesStore({}), /routes must be injected/);
    });
});

describe('a served answer', () => {
    test('the seven become present, and anything else absent', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        await store.load();
        assert.equal(store.state.status, 'ready');
        for (const name of SEVEN) {
            assert.equal(store.capability(name), CAPABILITY.PRESENT, name);
            assert.equal(store.offers(name), true, name);
        }
        assert.equal(store.capability('groupHeadController'), CAPABILITY.ABSENT);
        assert.equal(store.offers('groupHeadController'), false);
        assert.equal(store.reason(), null);
    });

    test('[] is a REAL answer: every feature absent, nothing unknown', async () => {
        const { store } = storeWith(ok({ capabilities: [] }));
        await store.load();
        assert.equal(store.state.status, 'ready');
        assert.equal(store.capability('cupWarmer'), CAPABILITY.ABSENT);
        assert.equal(store.reason(), null);
        assert.deepEqual([...store.entries()], []);
    });

    test('a newer server\'s extra entries are reported, not discarded', async () => {
        const { store } = storeWith(ok({ capabilities: [...SEVEN, 'puckEstimator'] }));
        await store.load();
        assert.equal(store.capability('puckEstimator'), CAPABILITY.PRESENT);
        assert.deepEqual([...store.unknownEntries()], ['puckEstimator']);
    });

    test('concurrent loads share one request', async () => {
        const { store, calls } = storeWith(ok({ capabilities: SEVEN }));
        await Promise.all([store.load(), store.load(), store.load()]);
        assert.equal(calls.length, 1);
    });

    test('subscribers see the new state, and a late one gets it replayed', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        const seen = [];
        store.subscribe((state) => seen.push(state.status));
        await store.load();
        assert.deepEqual(seen, ['idle', 'loading', 'ready']);
        const late = [];
        store.subscribe((state) => late.push(state.status));
        assert.deepEqual(late, ['ready']);
    });
});

describe('a FAILED read is not an empty capability set', () => {
    test('500 (no machine connected) leaves every answer UNKNOWN', async () => {
        const { store } = storeWith(fail(500, 'GET /machine/capabilities -> 500'));
        await store.load();
        assert.equal(store.state.status, 'error');
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN);
        assert.notEqual(store.capability('cupWarmer'), CAPABILITY.ABSENT);
        assert.equal(store.reason(), CAPABILITY_REASON.FAILED);
        assert.equal(store.entries(), null);
        assert.equal(store.state.error.status, 500);
    });

    test('offering still fails closed on a failed read — unknown never offers', async () => {
        const { store } = storeWith(fail(503, 'unavailable'));
        await store.load();
        assert.equal(store.offers('ledStrip'), false);
    });

    test('a shape this build cannot read is its own reason', async () => {
        const { store } = storeWith(ok({ capabilities: 'seven' }));
        await store.load();
        assert.equal(store.reason(), CAPABILITY_REASON.UNREADABLE);
    });

    test('a failure after a good read does not leave the old answer standing', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }), fail(500, 'gone'));
        await store.load();
        assert.equal(store.offers('cupWarmer'), true);
        await store.refresh();
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN);
    });

    test('forget() drops the answer when the machine goes away', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        await store.load();
        store.forget();
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN);
        assert.equal(store.reason(), CAPABILITY_REASON.NOT_LOADED);
    });
});

describe('the R3 sensor gate', () => {
    test('closed while unknown — a 15 s poll never starts on a guess', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        assert.equal(store.sensorGate('puckEstimator'), false);
        assert.equal(store.sensorCapability('puckEstimator').capability, CAPABILITY.UNKNOWN);
        assert.equal(store.sensorCapability('puckEstimator').reason, CAPABILITY_REASON.NOT_LOADED);
    });

    test('closed on a machine that answered []', async () => {
        const { store } = storeWith(ok({ capabilities: [] }));
        await store.load();
        assert.equal(store.sensorGate('puckEstimator'), false);
        assert.equal(store.sensorGate('milkProbe'), false);
        assert.equal(store.sensorCapability('milkProbe').capability, CAPABILITY.ABSENT);
    });

    test('open once the served set says the machine can carry it', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        await store.load();
        assert.equal(store.sensorGate('puckEstimator'), true);
        assert.equal(store.sensorGate('milkProbe'), true);
    });

    test('the answer carries its R-number and its swap instruction', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        await store.load();
        const answer = store.sensorCapability('puckEstimator');
        assert.equal(answer.tag, 'R3');
        assert.equal(answer.provisional, true);
        assert.match(answer.swapWhen, /puckEstimator entry/);
    });

    test('an unknown sensor kind throws rather than answering false', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        assert.throws(() => store.sensorGate('thermometer'), /no R3 sensor adapter/);
    });
});

describe('the R3 gaps the served seven do not cover', () => {
    test('the gaps are enumerated, each naming its R-item', () => {
        assert.ok(CAPABILITY_GAPS.length >= 4);
        for (const gap of CAPABILITY_GAPS) {
            assert.match(gap.item, /^R[123]/);
            assert.ok(gap.via.length > 5);
        }
        const text = CAPABILITY_GAPS.map((g) => g.gap).join(' | ');
        for (const expected of ['profile modes', 'flow ranges', 'milk-probe', 'steam-power']) {
            assert.match(text, new RegExp(expected));
        }
    });

    test('GHC is UNKNOWN until a machine-info answer arrives — never false', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        assert.equal(store.groupHeadController().capability, CAPABILITY.UNKNOWN);
        assert.equal(store.groupHeadController().reason, CAPABILITY_REASON.NOT_LOADED);
    });

    test('GHC follows the served flag once the info answer is fed in', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        store.applyMachineInfo(machineInfo({ GHC: true }));
        assert.equal(store.groupHeadController().capability, CAPABILITY.PRESENT);
        store.applyMachineInfo(machineInfo({ GHC: false }));
        assert.equal(store.groupHeadController().capability, CAPABILITY.ABSENT);
    });

    test('profile modes are a hint with the bits decoded, and unknown without info', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        assert.equal(store.profileModes().capability, CAPABILITY.UNKNOWN);
        store.applyMachineInfo(machineInfo({ extra: { profileModeCaps: PROFILE_MODE_BIT.lever } }));
        const modes = store.profileModes();
        assert.equal(modes.capability, CAPABILITY.PRESENT);
        assert.deepEqual(modes.value.offers, { power: false, lever: true, hold: false, powerExit: false });
        assert.match(modes.note, /authority/i);
    });

    test('R2: the limits table is not-known and steam-less until capabilities land', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        const limits = store.machineLimits();
        assert.equal(limits.tag, 'R2');
        assert.equal(limits.known, false);
        assert.equal(Object.hasOwn(limits.value, 'steamTemp'), false,
            'A7: no stand-in ceiling while the machine class is unknown');
        assert.ok(limits.value.hotWaterVolume, 'the machine-independent rows are always there');
    });

    test('R2: the steam ceiling follows the served capability answer, both ways', async () => {
        const bengle = storeWith(ok({ capabilities: SEVEN })).store;
        await bengle.load();
        const de1 = storeWith(ok({ capabilities: [] })).store;
        await de1.load();
        for (const store of [bengle, de1]) {
            assert.equal(store.machineLimits().known, true);
            assert.equal(store.machineLimits().value.steamTemp.floor, 135);
        }
        assert.equal(bengle.machineLimits().value.steamTemp.max, 170);
        assert.equal(de1.machineLimits().value.steamTemp.max, 160);
        assert.equal(bengle.machineClass(), 'bengle');
        assert.equal(de1.machineClass(), 'de1');
        assert.equal(bengle.machineLimits().value.steamTemp.machineClass, 'bengle');
        assert.equal(de1.machineLimits().value.steamTemp.machineClass, 'de1');
        assert.equal(bengle.machineLimits().provisional, true, 'B2: interim until R2 serves it');
        assert.match(bengle.machineLimits().swapWhen, /limits endpoint/);
    });

    test('caps 0 is a present answer of NO modes, not an unknown', () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        store.applyMachineInfo(machineInfo({ extra: { profileModeCaps: 0 } }));
        assert.equal(store.profileModes().capability, CAPABILITY.ABSENT);
        assert.equal(store.profileModes().value.mask, 0);
    });
});

describe('route registered is weaker than feature available', () => {
    test('feedback 503 is FEATURE ABSENT — hide the form, do not retry', () => {
        assert.equal(readFeedbackAvailability(fail(503, 'not configured')).available, CAPABILITY.ABSENT);
        assert.equal(readFeedbackAvailability(fail(503, 'not configured')).reason, null);
    });

    test('a 201 is present; any other failure is unknown, not absent', () => {
        assert.equal(readFeedbackAvailability({ ok: true, status: 201 }).available, CAPABILITY.PRESENT);
        assert.equal(readFeedbackAvailability(fail(500, 'boom')).available, CAPABILITY.UNKNOWN);
        assert.equal(readFeedbackAvailability(null).available, CAPABILITY.UNKNOWN);
    });

    test('screenshots do not attach today, and the store says so', () => {
        assert.equal(FEEDBACK_SCREENSHOTS_ATTACH, false);
    });
});

describe('A3 — the store reads no machine name', () => {
    const SOURCE = readFileSync(fileURLToPath(new URL('../src/stores/capabilities-store.js', import.meta.url)), 'utf8');
    const IDENTIFIERS = stripComments(SOURCE, { dropStrings: true });

    test('no model read, no machine name in code', () => {
        assert.ok(!/bengle/i.test(IDENTIFIERS), 'the capability store names the machine model in code');
        assert.ok(!/\.model\b/.test(IDENTIFIERS), 'the capability store reads a model field');
    });

    test('the store owns exactly one route, through the injected helper', () => {
        assert.ok(!/\/api\/v1/.test(stripComments(SOURCE)), 'a path is spelled in code');
        const helperCalls = [...IDENTIFIERS.matchAll(/routes\.(\w+)/g)].map((m) => m[1]);
        assert.deepEqual([...new Set(helperCalls)], ['capabilities']);
    });
});

describe('forget() drops the machine INFO too', () => {
    test('the two info-backed gates stop answering from the machine that left', async () => {
        const { store } = storeWith(ok({ capabilities: SEVEN }));
        await store.load();
        store.applyMachineInfo({ version: '1', model: 'Bengle', serialNumber: 'x', GHC: true, extra: { profileModeCaps: 3 } });
        assert.equal(store.groupHeadController().capability, CAPABILITY.PRESENT);
        assert.equal(store.profileModes().capability, CAPABILITY.PRESENT);

        store.forget();
        assert.equal(store.groupHeadController().capability, CAPABILITY.UNKNOWN, 'the GHC strip must not render');
        assert.equal(store.profileModes().capability, CAPABILITY.UNKNOWN);
        assert.equal(store.state.machineInfo, null);
    });
});

describe('a read in flight cannot outlive the machine it was asked of', () => {
    /** A capabilities route the test resolves by hand. */
    function deferredStore() {
        let release;
        const pending = new Promise((resolve) => { release = resolve; });
        const routes = { capabilities: () => pending };
        return { store: createCapabilitiesStore({ routes, now: () => 1234 }), release };
    }

    test('an answer that lands after forget() is discarded, not published as current', async () => {
        const { store, release } = deferredStore();
        const loading = store.load();
        store.forget();
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN);

        release(ok({ capabilities: SEVEN }));
        await loading;
        assert.equal(store.capability('cupWarmer'), CAPABILITY.UNKNOWN,
            'the departed machine\'s capability set must not come back as the current one');
        assert.equal(store.state.status, 'idle');
        assert.equal(store.reason(), CAPABILITY_REASON.NOT_LOADED);
    });

    test('a FAILED answer in flight across a forget is discarded too', async () => {
        const { store, release } = deferredStore();
        const loading = store.load();
        store.forget();
        release(fail(500, 'gone'));
        await loading;
        assert.equal(store.state.status, 'idle', 'not "error" for a machine nobody is asking about');
        assert.equal(store.state.error, null);
    });

    test('and the ordinary path still publishes', async () => {
        const { store, release } = deferredStore();
        const loading = store.load();
        release(ok({ capabilities: SEVEN }));
        await loading;
        assert.equal(store.state.status, 'ready');
        assert.equal(store.offers('cupWarmer'), true);
    });
});

describe('a machine swap can be read afresh, not joined to the departed one', () => {
    test('load() after forget() issues a NEW request, not the old one', async () => {
        let release;
        const calls = [];
        const queue = [new Promise((resolve) => { release = resolve; })];
        const routes = {
            capabilities: () => {
                calls.push('capabilities');
                return queue.length > 1 ? queue.shift() : queue[0];
            },
        };
        const store = createCapabilitiesStore({ routes, now: () => 1234 });
        queue.push(Promise.resolve(ok({ capabilities: [] })));

        const first = store.load();
        assert.equal(calls.length, 1);
        store.forget();
        const second = store.load();
        assert.equal(calls.length, 2, 'the new machine gets its own read');
        release(ok({ capabilities: SEVEN }));
        await Promise.all([first, second]);
        assert.equal(store.capability('cupWarmer'), CAPABILITY.ABSENT, 'the NEW machine\'s answer: not a Bengle');
    });
});
