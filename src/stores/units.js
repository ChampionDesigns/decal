// The temperature-unit PREFERENCE — one store, one home, no ambient singleton.
//
// THE CONVERSION MOVED TO `lib/temperature.js` on 26 August 2026, and the split is a layer
// boundary rather than a tidy-up: `live-targets.js` is a lib whose own suite forbids it to
// import from `src/stores/`, and the Live rail needs the arithmetic. What is left here is
// the part that is genuinely a store — a key, a load, a write and a failure mode.
//
// EVERY NAME IS STILL EXPORTED FROM HERE, so no existing caller had to move.
//
// TWO DEFECTS THIS FILE IS SHAPED AGAINST, both verified in the module it replaces:
//
//  1. THE DUAL-WRITE SILENT REVERT. `setTempUnit` wrote localStorage AND the IDB settings
//     store with a swallowed `.catch(() => {})`, and `initUnits` read IDB FIRST, then wrote
//     the IDB answer back over localStorage. A rejected put therefore lost the preference
//     with no error anywhere, and then overwrote the good copy on next boot. B7 kills the
//     mechanism rather than the symptom: there is exactly ONE home for this key, chosen by
//     the routing table (`storage-routes.js` row `tempUnit`, layer `kv`), and this module
//     never names a backend. `set()` below writes once, reports the outcome, and — the part
//     that matters — does NOT change the in-memory value when the write failed.
//
//  2. THE MODULE SINGLETON + DOCUMENT EVENT BUS. `let currentTempUnit` was shared by
//     ES-module semantics, and changes were announced with a `document.dispatchEvent(...)`
//     — which does not cross a shadow boundary, and is named for a different skin. Here the
//     unit is a reactive value: subscribe, get the last frame immediately, unsubscribe when
//     the component detaches.
//
// A7: there is no second source for this preference. A failed read yields the DEFAULT and
// says so in the returned `source` field — it never falls through to another store, and it
// never writes on boot (a boot-time write is what let the bad copy win).
//
// DOM-free: no `document`, no `localStorage`, no `window`. The storage router is injected.

import { createStore } from './store.js';

export * from '../lib/temperature.js';

import {
    TEMP_UNITS, DEFAULT_TEMP_UNIT, TEMP_UNIT_KEY, unitSymbol, normaliseUnit,
    toDisplayTemp, fromDisplayTemp, displayStepToCelsius, boundToDisplay, formatTemperature,
} from '../lib/temperature.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export function createUnitsStore({ storage, logger = NOOP_LOGGER, key = TEMP_UNIT_KEY, initial = DEFAULT_TEMP_UNIT } = {}) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        // Fatal, not defaulted. A store that quietly persists nowhere is the failure this
        // module exists to remove, and it must not be reachable by forgetting an argument.
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
