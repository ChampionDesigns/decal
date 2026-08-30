
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_TEMP_UNIT,
    NO_READING_MARK,
    TEMP_UNIT,
    TEMP_UNITS,
    TEMP_UNIT_KEY,
    boundToDisplay,
    celsiusToFahrenheit,
    createUnitsStore,
    decimalsForStep,
    displayStepToCelsius,
    fahrenheitToCelsius,
    formatTemperature,
    formatToStep,
    fromDisplayTemp,
    normaliseUnit,
    toDisplayTemp,
    unitSymbol,
} from '../src/stores/units.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS, STORAGE_ROUTES } from '../src/lib/storage-routes.js';
import { NO_READING, noReading, ABSENCE } from '../src/data/reading.js';

const LIVE_LAYERS = [LAYERS.local, LAYERS.session, LAYERS.kv, LAYERS.kvNumpad];

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

function fixture({ failingLayer = null } = {}) {
    const backends = Object.fromEntries(LIVE_LAYERS.map((layer) => [layer, createMemoryBackend()]));
    if (failingLayer) {
        backends[failingLayer] = {
            kind: 'failing',
            get() { return undefined; },
            set() { throw new Error('quota exceeded'); },
            remove() {},
            size() { return 0; },
            snapshot() { return {}; },
        };
    }
    const logger = recordingLogger();
    const storage = createStorageRouter({ backends, logger });
    return { backends, storage, logger, store: createUnitsStore({ storage, logger }) };
}

describe('policy 1 — convert at the input edge', () => {
    test('round trips through the display unit', () => {
        assert.equal(celsiusToFahrenheit(100), 212);
        assert.equal(fahrenheitToCelsius(212), 100);
        assert.equal(toDisplayTemp(93, TEMP_UNIT.CELSIUS), 93);
        assert.equal(toDisplayTemp(0, TEMP_UNIT.FAHRENHEIT), 32);
        assert.equal(fromDisplayTemp(199.4, TEMP_UNIT.FAHRENHEIT).toFixed(1), '93.0');
        assert.equal(fromDisplayTemp(93, TEMP_UNIT.CELSIUS), 93);
    });
});

describe('policy 2 — a step delta has no offset', () => {
    test('one display degree is 5/9 C, not 1 C and not 33.8 C', () => {
        assert.equal(displayStepToCelsius(1, TEMP_UNIT.CELSIUS), 1);
        assert.equal(displayStepToCelsius(1, TEMP_UNIT.FAHRENHEIT), 5 / 9);
        // The offset bug would give 33.8 here; the whole point of the rule.
        assert.notEqual(displayStepToCelsius(1, TEMP_UNIT.FAHRENHEIT), fahrenheitToCelsius(1));
    });

    test('a step converted and applied moves the display by that many display degrees', () => {
        const celsius = 93;
        const stepped = celsius + displayStepToCelsius(1, TEMP_UNIT.FAHRENHEIT);
        const before = toDisplayTemp(celsius, TEMP_UNIT.FAHRENHEIT);
        const after = toDisplayTemp(stepped, TEMP_UNIT.FAHRENHEIT);
        assert.equal(Number((after - before).toFixed(6)), 1);
    });
});

describe('policy 3 — bounds round to whole display units', () => {
    test('a Fahrenheit bound is whole', () => {
        assert.equal(boundToDisplay(93.4, TEMP_UNIT.FAHRENHEIT), 200);
        assert.equal(boundToDisplay(93.4, TEMP_UNIT.CELSIUS), 93);
        assert.equal(Number.isInteger(boundToDisplay(88.8888, TEMP_UNIT.FAHRENHEIT)), true);
    });
});

describe('policy 4 — one absent mark', () => {
    test('the mark is the em dash and it is the only one', () => {
        assert.equal(NO_READING_MARK, '—');
    });

    test('every kind of absence prints the mark, never a zero and never a hyphen', () => {
        for (const value of [NO_READING, noReading(ABSENCE.NULL), noReading(ABSENCE.PERMANENT), NaN, Infinity, null, undefined, '93']) {
            assert.equal(formatTemperature(value, TEMP_UNIT.CELSIUS), NO_READING_MARK, `${String(value)} should be absent`);
        }
    });

    test('a real reading prints with its unit', () => {
        assert.equal(formatTemperature(93.24, TEMP_UNIT.CELSIUS), '93.2°C');
        assert.equal(formatTemperature(93, TEMP_UNIT.FAHRENHEIT), '199.4°F');
        assert.equal(formatTemperature(93, TEMP_UNIT.CELSIUS, { withSymbol: false, decimals: 0 }), '93');
        assert.equal(unitSymbol(TEMP_UNIT.FAHRENHEIT), '°F');
    });

    test('a caller may supply its own dash but gets the em dash by default', () => {
        assert.equal(formatTemperature(NO_READING, TEMP_UNIT.CELSIUS, { dash: '--' }), '--');
    });
});

describe('step formatting', () => {
    test('decimals follow the step', () => {
        assert.equal(decimalsForStep(1), 0);
        assert.equal(decimalsForStep(0.5), 1);
        assert.equal(decimalsForStep(0.05), 2);
        assert.equal(formatToStep(93.26, 0.1), '93.3');
        assert.equal(formatToStep(93.26, 1), '93');
    });

    test('a non-numeric value is absent, not zero', () => {
        assert.equal(formatToStep(undefined, 1), NO_READING_MARK);
    });
});

describe('unit validation', () => {
    test('C and F in either case; anything else is null, not a silent Celsius', () => {
        assert.deepEqual(TEMP_UNITS, ['C', 'F']);
        assert.equal(normaliseUnit('F'), 'F');
        assert.equal(normaliseUnit('f'), 'F', 'the settings bank stores lowercase');
        assert.equal(normaliseUnit('c'), 'C');
        assert.equal(normaliseUnit(' f '), 'F', 'and a stray space is not a different unit');
        assert.equal(normaliseUnit('K'), null);
        assert.equal(normaliseUnit('celsius'), null, 'a word is not a symbol');
        assert.equal(normaliseUnit(undefined), null);
        assert.equal(normaliseUnit(42), null, 'a number is not a unit either');
    });

    test('the bank\'s own stored values normalise, which is what joins the two halves', async () => {
        /* READ OFF THE REGISTRY rather than repeated here: if the bank's items ever change
         * spelling, this fails instead of the conversion going quietly inert again. */
        const { SETTINGS_ROWS } = await import('../src/lib/settings-leaves.js');
        const row = SETTINGS_ROWS.find((r) => r.key === TEMP_UNIT_KEY);
        assert.ok(row && row.items, 'the temperature bank is a registry row with items');
        for (const item of row.items) {
            assert.ok(normaliseUnit(item.value), `the bank offers ${item.value} and the module must know it`);
        }
    });
});

describe('the store owns the preference — one home, chosen by the table', () => {
    test('the routing table gives tempUnit exactly one layer', () => {
        const row = STORAGE_ROUTES[TEMP_UNIT_KEY];
        assert.ok(row, 'tempUnit has no row — every persisted key needs one');
        assert.notEqual(row.layer, LAYERS.none);
    });

    test('a write lands in one layer and no other', async () => {
        const { store, backends } = fixture();
        assert.equal(await store.set(TEMP_UNIT.FAHRENHEIT), true);
        const written = LIVE_LAYERS.filter((layer) => backends[layer].size() > 0);
        assert.deepEqual(written, [STORAGE_ROUTES[TEMP_UNIT_KEY].layer], 'the value reached more than one store — that is the dual-write bug');
    });

    test('load reads the stored value back', async () => {
        const { store, storage } = fixture();
        await storage.set(TEMP_UNIT_KEY, TEMP_UNIT.FAHRENHEIT);
        assert.deepEqual(await store.load(), { unit: 'F', source: 'stored' });
        assert.equal(store.get(), 'F');
        assert.equal(store.isLoaded, true);
    });

    test('load does NOT write — the boot-time write-back is what made the loss permanent', async () => {
        const { store, backends } = fixture();
        const result = await store.load();
        assert.deepEqual(result, { unit: DEFAULT_TEMP_UNIT, source: 'default' });
        for (const layer of LIVE_LAYERS) {
            assert.equal(backends[layer].size(), 0, `boot wrote to ${layer}`);
        }
    });

    test('an unreadable stored value falls to the default and SAYS SO', async () => {
        const { store, storage, logger } = fixture();
        await storage.set(TEMP_UNIT_KEY, 'kelvin');
        const result = await store.load();
        assert.deepEqual(result, { unit: DEFAULT_TEMP_UNIT, source: 'invalid' });
        assert.ok(logger.lines.some(([level]) => level === 'warn'), 'a bad stored value must be logged');
    });
});

describe('the silent revert cannot happen here', () => {
    test('a failed write does NOT change the displayed unit, and is logged', async () => {
        const { store, logger } = fixture({ failingLayer: STORAGE_ROUTES[TEMP_UNIT_KEY].layer });
        await store.load();
        const before = store.get();
        assert.equal(await store.set(TEMP_UNIT.FAHRENHEIT), false);
        assert.equal(store.get(), before, 'the store showed a unit it did not persist');
        assert.ok(logger.lines.some(([level]) => level === 'error'), 'a failed write must be loud');
    });

    test('a failed write reaches no other layer either', async () => {
        const { store, backends } = fixture({ failingLayer: STORAGE_ROUTES[TEMP_UNIT_KEY].layer });
        await store.set(TEMP_UNIT.FAHRENHEIT);
        for (const layer of LIVE_LAYERS) {
            assert.equal(backends[layer].size(), 0, `the failed write fell through to ${layer}`);
        }
    });

    test('an invalid unit is refused without touching storage', async () => {
        const { store, backends, logger } = fixture();
        assert.equal(await store.set('K'), false);
        assert.equal(store.get(), DEFAULT_TEMP_UNIT);
        for (const layer of LIVE_LAYERS) assert.equal(backends[layer].size(), 0);
        assert.ok(logger.lines.some(([level]) => level === 'error'));
    });

    test('the store refuses to exist without a storage router', () => {
        assert.throws(() => createUnitsStore(), /storage router must be injected/);
    });
});

describe('reactive, not a module singleton with a document event bus', () => {
    test('a late subscriber gets the current unit immediately', async () => {
        const { store } = fixture();
        await store.set(TEMP_UNIT.FAHRENHEIT);
        const seen = [];
        store.subscribe((unit) => seen.push(unit));
        assert.deepEqual(seen, ['F'], 'a late subscriber must receive the last frame');
    });

    test('subscribers see every change, and unsubscribing stops them', async () => {
        const { store } = fixture();
        const seen = [];
        const off = store.subscribe((unit) => seen.push(unit));
        await store.set(TEMP_UNIT.FAHRENHEIT);
        await store.set(TEMP_UNIT.FAHRENHEIT); // no change, no notify
        off();
        await store.set(TEMP_UNIT.CELSIUS);
        assert.deepEqual(seen, ['C', 'F']);
    });

    test('the bound helpers follow the current unit', async () => {
        const { store } = fixture();
        assert.equal(store.format(93), '93.0°C');
        assert.equal(store.bound(93.4), 93);
        await store.set(TEMP_UNIT.FAHRENHEIT);
        assert.equal(store.format(93), '199.4°F');
        assert.equal(store.bound(93.4), 200);
        assert.equal(store.fromDisplay(199.4).toFixed(1), '93.0');
        assert.equal(store.stepToCelsius(1), 5 / 9);
        assert.equal(store.symbol(), '°F');
    });

    test('a throwing subscriber does not starve the others', async () => {
        const { store, logger } = fixture();
        const seen = [];
        store.subscribe(() => { throw new Error('bad subscriber'); });
        store.subscribe((unit) => seen.push(unit));
        await store.set(TEMP_UNIT.FAHRENHEIT);
        assert.deepEqual(seen, ['C', 'F']);
        // Logged, not swallowed — the level is the store primitive's business.
        assert.ok(logger.lines.some(([level]) => level === 'warn' || level === 'error'));
    });
});
