// CANARY — deliberately violates the dead-name rule. Never imported by the app.
//
// This is what a ported module looks like when it re-bakes a name ReaPrime deleted, and it
// is exactly the shape the old skin shipped: a dead name plus a fallback that manufactures
// a plausible number, so the miss never surfaces on a bench.
//
// test/rea-dead-names.test.mjs asserts the scanner FAILS on this file. A guard that has
// quietly stopped covering its target is the failure mode this fixture exists to prevent.
export function readPuckResistance(data) {
    if (typeof data.puckResistanceDerived === 'number') return data.puckResistanceDerived;
    if (typeof data.puckResistance === 'number') return data.puckResistance;
    return data.pressure / (data.flow * data.flow);
}

export function readFused(data) {
    return { r2: data.fusedR2, flags: data['estFlags'], events: data.detEventCount };
}
