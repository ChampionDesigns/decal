// B6 — THE DUPLICATED CHANNELS: CHOOSE AT SHOT START AND HOLD.
//
// Three quantities exist twice. The machine's fused estimator (Bengle only, the better
// number) arrives on the puck-estimator sensor as `r1` / `r2` and — on rev >= 3 firmware —
// `hydraulicPowerMeasured`. ReaPrime's computed ratios (every machine, every historical
// shot, recomputed on read) arrive on the machine snapshot as the three `*Derived` keys.
// `machine.dart`'s own doc comments name the measured twin for each derived getter and say
// "PREFER THE MEASURED VALUE WHEN THE MACHINE OFFERS IT".
//
// ── THE DEFECT THIS MODULE EXISTS TO NOT REBUILD ─────────────────────────────────────
//
// `fused.js`'s `select*` functions re-pick their source PER SAMPLE, silently. The two
// sources go absent at DIFFERENT MOMENTS and for different reasons:
//
//   * the derived channels gate on the CURRENT OPERATING POINT — ReaPrime returns null,
//     and `toJson` omits the key, below its flow/pressure threshold. That threshold is
//     ReaPrime's and appears NOWHERE in this skin: `test/shot-source-selector.test.mjs`
//     asserts this file contains no copy of it. Two copies of a threshold is two things
//     to drift.
//   * the estimator's sentinel is NOT YET OBSERVED — a per-field wire sentinel that
//     decodes to an omitted key and has nothing to do with the operating point.
//
// So a per-sample pick produces a trace whose gap lands somewhere different every shot,
// which reads as a machine glitch rather than as a data state. `machine.dart` warns
// exactly this: "Switching source mid-shot will look like a glitch unless the client
// expects it."
//
// ── THE RULE (B6) ────────────────────────────────────────────────────────────────────
//
// Prefer the estimator when present, fall back to the derived channel, DECIDE ONCE FROM THE
// FIRST EVIDENCE, HOLD THAT CHOICE FOR THE WHOLE SHOT, AND MARK WHICH SOURCE IS IN USE.
//
// "From the first evidence", not "from the first sample": at t=0 of an espresso ReaPrime has
// gated every derived key away (flow and pressure are both under its 0.3 threshold) and the
// estimator has observed nothing, so the first sample carries neither twin. Deciding there
// decides nothing and freezes it — see `beginShot`.
//
// "Fall back" here is a decision made once, from evidence, and recorded — not a per-sample
// `??`. Once the shot starts, a sample missing its chosen source renders a GAP. It never
// silently borrows the other source: the two are computed from different flows (Q_puck vs
// reported group flow Q_in), so they agree in steady state and diverge exactly during the
// compliance transients a reader is looking at.
//
// PRESENCE IS KEY-PRESENCE. The readings this module consumes come from the address layer
// (`readEstimatorFrame`, `readMachineSnapshot`), which has already applied that rule. A
// channel reading 0 is PRESENT. `!= null` is not the test and does not appear here.
//
// D1 keeps these channels out of the v1 baseline entirely — they are capability-gated and
// additive, so nothing is lost by waiting. The rule is built now because the source
// selector is data-layer plumbing that gets built ONCE, and building it without the
// hold-at-shot-start rule bakes the glitch in.
//
// NOT PORTED, deliberately: `derived-channels.js`'s computation half. The R/Z/W formulas
// and their gate are byte-for-byte what ReaPrime computes on read, so a local copy is a
// second implementation of a server truth. This module SELECTS; it never computes.
//
// ReaPrime read AS WRITTEN at 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3: `machine.dart`
// (`_derivedOrNull`, the three `*Derived` getters and their doc comments, `toJson`'s
// conditional keys) and `bengle_puck_estimator.dart` (`info.dataChannels`, `encodeSample`).
// It reads frames only and declares no route.

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
            // Settled means every quantity has decided, and a decision never re-opens: the
            // held object is returned by identity, so a repeated "shot started" signal is
            // free and visibly a no-op.
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
