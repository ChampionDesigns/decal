/**
 * The temperature-unit PREFERENCE — one store, one home, no ambient singleton.
 */

import { createStore } from './store.js';

export * from '../lib/temperature.js';

import {
    TEMP_UNITS, DEFAULT_TEMP_UNIT, TEMP_UNIT_KEY, unitSymbol, normaliseUnit,
    toDisplayTemp, fromDisplayTemp, displayStepToCelsius, boundToDisplay, formatTemperature,
} from '../lib/temperature.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export function createUnitsStore({ storage, logger = NOOP_LOGGER, key = TEMP_UNIT_KEY, initial = DEFAULT_TEMP_UNIT } = {}) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('createUnitsStore: the storage router must be injected (see src/lib/storage-router.js)');
    }
    const log = logger.scope ? logger.scope('units') : logger;
    const unit = createStore(normaliseUnit(initial) || DEFAULT_TEMP_UNIT, { label: 'tempUnit', logger: log });
    let loaded = false;

    return {
        key,

        /** The current display unit. Always one of TEMP_UNITS. */
        get() {
            return unit.get();
        },

        /** True once `load()` has resolved — a screen can tell "default" from "read". */
        get isLoaded() {
            return loaded;
        },

        /** Subscribe; fires immediately with the current unit, then on every change. */
        subscribe(listener) {
            return unit.subscribe(listener);
        },

        async load() {
            const stored = await storage.get(key);
            loaded = true;
            if (stored === undefined) {
                log.debug(`no stored ${key}; using ${DEFAULT_TEMP_UNIT}`);
                unit.set(DEFAULT_TEMP_UNIT);
                return { unit: unit.get(), source: 'default' };
            }
            const valid = normaliseUnit(stored);
            if (!valid) {
                log.warn(`stored ${key} is ${JSON.stringify(stored)}, which is not one of ${TEMP_UNITS.join('/')} — using ${DEFAULT_TEMP_UNIT}`);
                unit.set(DEFAULT_TEMP_UNIT);
                return { unit: unit.get(), source: 'invalid' };
            }
            unit.set(valid);
            return { unit: valid, source: 'stored' };
        },

        async set(next) {
            const valid = normaliseUnit(next);
            if (!valid) {
                log.error(`refusing to set ${key} to ${JSON.stringify(next)} — expected one of ${TEMP_UNITS.join('/')}`);
                return false;
            }
            if (valid === unit.get() && loaded) return true;
            const stored = await storage.set(key, valid);
            if (!stored) {
                log.error(`${key} was not stored — the displayed unit stays ${unit.get()}`);
                return false;
            }
            loaded = true;
            unit.set(valid);
            return true;
        },

        /* The policy functions, bound to the current unit. A component calls these; the
         * pure exports above stay available for tests and for code that already knows the
         * unit it is working in. */

        toDisplay: (celsius) => toDisplayTemp(celsius, unit.get()),
        fromDisplay: (displayValue) => fromDisplayTemp(displayValue, unit.get()),
        stepToCelsius: (displayStep) => displayStepToCelsius(displayStep, unit.get()),
        bound: (celsius) => boundToDisplay(celsius, unit.get()),
        symbol: () => unitSymbol(unit.get()),
        format: (celsius, options) => formatTemperature(celsius, unit.get(), options),
    };
}
