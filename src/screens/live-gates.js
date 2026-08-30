/**
 * Live's capability gates.
 */

import { CAPABILITY } from '../stores/capabilities-store.js';

export const GHC_STRIP_SHOWS_WHEN = CAPABILITY.ABSENT;

/** The two readings, named, so the reversal is a choice between constants. */
export const GHC_POLARITY = Object.freeze({
    SPEC_LITERAL: CAPABILITY.PRESENT,
    SLATE_SOURCE: CAPABILITY.ABSENT,
});

export function ghcStripGate(answer) {
    const capability = answer && typeof answer === 'object' ? answer.capability : CAPABILITY.UNKNOWN;
    const known = capability === CAPABILITY.PRESENT || capability === CAPABILITY.ABSENT;
    return Object.freeze({
        render: known && capability === GHC_STRIP_SHOWS_WHEN,
        capability,
        known,
        reason: answer && answer.reason ? answer.reason : null,
        /** True while the answer comes from an R3 adapter rather than a served entry. */
        provisional: !!(answer && answer.provisional),
        tag: answer && answer.tag ? answer.tag : null,
        adapter: answer && answer.adapter ? answer.adapter : null,
        basis: answer && answer.basis ? answer.basis : null,
        swapWhen: answer && answer.swapWhen ? answer.swapWhen : null,
        polarity: GHC_STRIP_SHOWS_WHEN,
    });
}

export function createLiveGates({ capabilities } = {}) {
    if (!capabilities || typeof capabilities.groupHeadController !== 'function') {
        throw new Error('createLiveGates: the capabilities store must be injected');
    }
    return Object.freeze({
        /** The GHC strip. R3, the named example. */
        ghc() { return ghcStripGate(capabilities.groupHeadController()); },

        /**
         * Every gate as one frozen map, for a render pass that wants a single read and for
         * a suite that wants to assert the whole surface at once.
         */
        all() { return Object.freeze({ ghc: this.ghc() }); },
    });
}
