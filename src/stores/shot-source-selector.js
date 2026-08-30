/**
 * B6 — THE DUPLICATED CHANNELS.
 */

import { hasReading, noReading, ABSENCE } from '../data/reading.js';
import { ESTIMATOR_CHANNELS, SNAPSHOT_DERIVED_KEYS } from '../data/rea-names.js';

export const SOURCE = Object.freeze({
    ESTIMATOR: 'estimator',
    DERIVED: 'derived',
    NONE: 'none',
});

export const DUPLICATED_QUANTITIES = Object.freeze([
    Object.freeze({
        quantity: 'resistance',
        estimatorChannel: 'r2',
        derivedKey: 'puckResistanceDerived',
        unit: 'bar·s²/mL²',
        note: "the firmware's n=2 resistance fit; the derived twin is P/F²",
    }),
    Object.freeze({
        quantity: 'impedance',
        estimatorChannel: 'r1',
        derivedKey: 'loadImpedanceDerived',
        unit: 'bar·s/mL',
        note: "the firmware's n=1 resistance fit; the derived twin is P/F",
    }),
    Object.freeze({
        quantity: 'power',
        estimatorChannel: 'hydraulicPowerMeasured',
        derivedKey: 'hydraulicPowerDerived',
        unit: 'W',
        note: 'estimator side needs BengleEstSample rev >= 3; derived twin is 0.1·P·F',
    }),
]);

for (const row of DUPLICATED_QUANTITIES) {
    if (!ESTIMATOR_CHANNELS.includes(row.estimatorChannel)) {
        throw new Error(
            `shot-source: "${row.estimatorChannel}" is not an estimator channel in rea-names.js — `
            + `the B6 pairing for "${row.quantity}" names a key ReaPrime does not serve.`,
        );
    }
    if (!SNAPSHOT_DERIVED_KEYS.includes(row.derivedKey)) {
        throw new Error(
            `shot-source: "${row.derivedKey}" is not a derived snapshot key in rea-names.js — `
            + `the B6 pairing for "${row.quantity}" names a key ReaPrime does not serve.`,
        );
    }
}

const QUANTITY_BY_KEY = new Map(DUPLICATED_QUANTITIES.map((row) => [row.quantity, row]));

/** @param {string} quantity */
export function quantityRow(quantity) {
    const row = QUANTITY_BY_KEY.get(quantity);
    if (!row) throw new Error(`shot-source: unknown quantity "${quantity}"`);
    return row;
}

function estimatorReading(sample, row) {
    const channels = sample && sample.estimator && sample.estimator.channels;
    if (!channels) return noReading(ABSENCE.NO_SOURCE);
    const value = channels[row.estimatorChannel];
    return value === undefined ? noReading(ABSENCE.NO_SOURCE) : value;
}

function derivedReading(sample, row) {
    const machine = sample && sample.machine;
    if (!machine) return noReading(ABSENCE.NO_SOURCE);
    const value = machine[row.derivedKey];
    return value === undefined ? noReading(ABSENCE.NO_SOURCE) : value;
}

export function chooseSource(sample, quantity) {
    const row = quantityRow(quantity);
    if (hasReading(estimatorReading(sample, row))) return SOURCE.ESTIMATOR;
    if (hasReading(derivedReading(sample, row))) return SOURCE.DERIVED;
    return SOURCE.NONE;
}

/** The decision for all three quantities, from the first sample of a shot. */
export function chooseSources(sample) {
    return Object.freeze(Object.fromEntries(
        DUPLICATED_QUANTITIES.map((row) => [row.quantity, chooseSource(sample, row.quantity)]),
    ));
}

export function readThroughSource(sample, quantity, source) {
    const row = quantityRow(quantity);
    if (source === SOURCE.ESTIMATOR) return estimatorReading(sample, row);
    if (source === SOURCE.DERIVED) return derivedReading(sample, row);
    if (source === SOURCE.NONE) return noReading(ABSENCE.NO_SOURCE);
    throw new Error(`shot-source: unknown source "${source}"`);
}

export function createShotSourceSelector({ now = () => Date.now() } = {}) {
    let selection = null;

    return {
        /** The frozen decision, or null between shots. */
        get selection() { return selection; },

        /** True while a shot's decision is held. */
        get active() { return selection !== null; },

        beginShot(sample, { shotId = null } = {}) {
            const held = selection;
            if (held && held.settled) return held;
            const sources = {};
            for (const row of DUPLICATED_QUANTITIES) {
                const previous = held ? held.sources[row.quantity] : SOURCE.NONE;
                sources[row.quantity] = previous !== SOURCE.NONE
                    ? previous
                    : chooseSource(sample, row.quantity);
            }
            const undecided = DUPLICATED_QUANTITIES
                .filter((row) => sources[row.quantity] === SOURCE.NONE)
                .map((row) => row.quantity);
            const at = now();
            selection = Object.freeze({
                shotId: held ? held.shotId : shotId,
                /** When the shot's selection was opened. */
                decidedAt: held ? held.decidedAt : at,
                settledAt: undecided.length === 0 ? (held && held.settledAt !== null ? held.settledAt : at) : null,
                sources: Object.freeze(sources),
                /** Quantities with no evidence either way YET. Visible, never a guess. */
                undecided: Object.freeze(undecided),
                settled: undecided.length === 0,
            });
            return selection;
        },

        /** Discard. The next `beginShot` decides afresh — a new shot, a new machine state. */
        endShot() {
            const ended = selection;
            selection = null;
            return ended;
        },

        sourceOf(quantity) {
            quantityRow(quantity);
            return selection ? selection.sources[quantity] : SOURCE.NONE;
        },

        read(sample, quantity) {
            if (!selection) return noReading(ABSENCE.NO_SOURCE);
            return readThroughSource(sample, quantity, selection.sources[quantity]);
        },

        readAll(sample) {
            return Object.freeze(Object.fromEntries(DUPLICATED_QUANTITIES.map((row) => [
                row.quantity,
                Object.freeze({
                    source: this.sourceOf(row.quantity),
                    value: this.read(sample, row.quantity),
                }),
            ])));
        },
    };
}
