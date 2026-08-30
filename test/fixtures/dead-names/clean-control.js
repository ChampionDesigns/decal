// The clean counter-example. Reads only current names, mentions the dead ones only in
// prose — which is where a comment-blind scanner would produce a false positive, and a
// false positive is how an exemption gets added, and an exemption is how coverage dies.
//
// Prose, deliberately naming the dead: puckResistance, fusedR1, fusedR2, fusedC, estFlags,
// detEventCount, detLastEventT, detLastEventMag, detLastEventConc, loadImpedance,
// hydraulicPower, fusedConf, estLag, vAbs. None of them is read below.
/* A block comment naming fusedR2 and detEventCount as well. */
export function readEstimator(frame) {
    return { r1: frame.r1, r2: frame.r2, compliance: frame.compliance, flags: frame.flags };
}

export function readDerived(data) {
    return Object.hasOwn(data, 'puckResistanceDerived') ? data.puckResistanceDerived : null;
}
