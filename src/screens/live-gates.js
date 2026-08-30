/**
 * live-gates.js — Live's capability gates. A3/A1, and never a machine name.
 *
 * ITEM `live-capability-gates-ghc`. SCOPE.md:1870-1879, verbatim: "Capability gates, never
 * name-sniffing (A3): the GHC strip renders only when the capability says the hardware
 * exists (today it shows on every machine without GHC hardware — L1) — and no GHC entry
 * exists in the served capability set (seven entries today, `de1handler.dart:42-50`,
 * verified), so that entry is R3 work. Overnight, the gate reads the R3-TAGGED CAPABILITY
 * ADAPTER — the decided interim … — until the entry ships; it never reads the machine name."
 *
 * ===========================================================================
 * THE ONE LEGAL ROUTE, AND WHY THIS FILE IS THIN
 * ===========================================================================
 *
 * `capabilities.groupHeadController()` → `r3GroupHeadControllerCapability(machineInfo)`
 * (`src/data/adapters-r.js`, the spec's own named example). That adapter reads the `GHC`
 * key off a `GET /api/v1/machine/info` body and NEVER coerces an absent key to `false`:
 * "an absent key is NOT a `false`: it is an older or different server, and the honest
 * answer is 'not known'". The capability store turns that into the tri-state
 * present/absent/UNKNOWN and attaches `tag: 'R3'` and `adapter:
 * 'r3GroupHeadControllerCapability'` to every answer.
 *
 * So this file adds exactly one thing the store cannot know: WHAT THE SCREEN DOES with a
 * three-valued answer. It computes no capability, holds no fallback, and reads no machine
 * name — `test/live-connection-gates.test.mjs` asserts that over this file's own source,
 * the same way `test/adapters-r.test.mjs` asserts it over the adapter module's.
 *
 * THE R-TAG IS GREPPABLE, twice over: it rides on every answer this module returns, and
 * `<live-screen>` writes it onto the rendered strip as `data-r-tag="R3"` /
 * `data-r-adapter="r3GroupHeadControllerCapability"`. The swap when R3 lands is a
 * DELETION: the store's `groupHeadController()` starts answering from a served entry, this
 * file stops seeing `provisional: true`, and the two data attributes go with it.
 *
 * ===========================================================================
 * FAIL-CLOSED, AND WHAT "CLOSED" MEANS FOR A STRIP
 * ===========================================================================
 *
 * UNKNOWN renders NOTHING, under either polarity below. The capability store is
 * "fail-closed by construction" (`capabilities-store.js:30-45`) and the shell leans on
 * that: "a screen rendered before the answer arrives hides gated hardware rather than
 * inventing it" (`app-boot.js:32-34`). A strip that appeared while the answer was in
 * flight and vanished when it landed is a worse picture than one that arrives late, and on
 * this screen it would also move the chart twice.
 *
 * ===========================================================================
 * THE POLARITY — ANSWERED BY BEN, 21 AUGUST 2026 (DQ-521)
 * ===========================================================================
 *
 * THE STRIP RENDERS WHEN THE CAPABILITY SAYS THE HARDWARE IS **ABSENT**, and is hidden on
 * a machine that has a group-head controller. Ben's ruling, verbatim in substance: "DQ-521
 * (GHC polarity): ABSENT — the strip renders ONLY when no GHC hardware is connected;
 * hidden when the hardware is present. One token: GHC_STRIP_SHOWS_WHEN =
 * CAPABILITY.ABSENT. (Flips the shipped PRESENT build.)"
 *
 * WHAT THE RULING PICKED, AND OVER WHAT. The build shipped `present`, which is
 * SCOPE.md:1870-1871 read literally plus §7.2 L1's "shown on every machine *without* GHC
 * hardware" read as part of the defect — two Step-0 documents, agreeing. The counter-
 * evidence was recorded here rather than acted on, and it is what Ben has now ruled for:
 *   * `slate-live.css:1085` comments the block "Non-GHC controls are a capability-gated
 *     horizontal strip" — the sheet's own words for what it is;
 *   * `app.js:1571-1573`: `if (machineInfo && machineInfo.GHC === false) { isNonGhcMachine
 *     = true; ui.showGhcControls(); }` — Slate shows it when the hardware is ABSENT, and
 *     with `=== false`, so an absent key already shows nothing (it fails closed too);
 *   * the strip's content is Coffee / Water / Steam / Flush / Stop (`index.html:306-325`),
 *     i.e. the buttons a machine with no group-head controller does not have in hardware;
 *   * §7.9 Unknown 11: "`#ghc-controls` was never observed rendered; L1 is arithmetic over
 *     measured rects" — the audit never saw this element, so its polarity claim is an
 *     inference from the id, while the CSS comment and the call site are the source.
 *
 * The asymmetry that decided it: under `present`, a machine with no group-head controller
 * loses the on-screen way to start a shot — a machine you cannot operate. Under `absent`,
 * a GHC machine at worst does without five buttons it already has in hardware.
 *
 * ONE TOKEN, AND IT IS STILL THE ONLY THING TO CHANGE. The gate, the fail-closed rule, the
 * layout and every test read `GHC_STRIP_SHOWS_WHEN` rather than a spelling of their own —
 * checked file by file when the flip landed (`test/live-connection-gates.test.mjs` §GHC
 * derives each expectation from the constant; the rendering suite imports it into the page
 * and picks the machine body from it), so reversing this line reverses the build and turns
 * nothing red. `GHC_POLARITY` below keeps both readings named.
 * Recorded in `waves/5.1/DEFERRED_QUESTIONS_gates.md`; answered in
 * `realine-run/BEN_DECISIONS_2026-08-21.md`.
 */

import { CAPABILITY } from '../stores/capabilities-store.js';

/**
 * THE ONE TOKEN. `'present'` = SCOPE.md:1870 read literally; `'absent'` = Slate's own
 * call site and the sheet's own comment. See THE POLARITY above.
 *
 * BEN RULED `absent`, 21 August 2026 (DQ-521). This line is the whole of the ruling.
 */
export const GHC_STRIP_SHOWS_WHEN = CAPABILITY.ABSENT;

/** The two readings, named, so the reversal is a choice between constants. */
export const GHC_POLARITY = Object.freeze({
    /** SCOPE.md:1870-1871, and §7.2 L1's "shown on every machine without GHC hardware". */
    SPEC_LITERAL: CAPABILITY.PRESENT,
    /** `slate-live.css:1085` "Non-GHC controls…"; `app.js:1571-1573` `GHC === false`. */
    SLATE_SOURCE: CAPABILITY.ABSENT,
});

/**
 * Turn a capability-store answer into a render decision.
 *
 * The answer object is the store's own (`capabilities-store.js` `fromAdapter`):
 * `{capability, value, reason, provisional, tag, adapter, basis, note, swapWhen}`.
 *
 * @param {object|null} answer
 * @returns {object} frozen `{render, capability, known, reason, provisional, tag,
 *                            adapter, basis, swapWhen, polarity}`
 */
export function ghcStripGate(answer) {
    const capability = answer && typeof answer === 'object' ? answer.capability : CAPABILITY.UNKNOWN;
    const known = capability === CAPABILITY.PRESENT || capability === CAPABILITY.ABSENT;
    return Object.freeze({
        // FAIL-CLOSED: an UNKNOWN never renders, whichever polarity is in force, because
        // `known` is false and the comparison below can only be reached through it.
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

/**
 * Every machine gate this screen has, bound to one capability store.
 *
 * One object, so a screen holds ONE thing and a later gate (the milk-probe steam UI, the
 * profile modes) is added here rather than as a second seam somewhere else — which is A3's
 * "single mechanism for machine differences" applied to the screen layer.
 *
 * @param {object} deps
 * @param {object} deps.capabilities  a `createCapabilitiesStore(...)`
 */
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
