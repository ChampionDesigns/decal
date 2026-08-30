// Screensaver policy — who may command the machine, and who may only paint.
//
// PORTED from the old skin's `screensaver-policy.js` (139 lines) under CARRY_FORWARD.md §3e:
// "Explicit keep — there is no screensaver-overlay concept anywhere in ReaPrime". The value
// is the SHAPE, not the arithmetic, and the shape is this: the derive functions return paint
// instructions, so they are structurally incapable of asking for a machine command.
//
// The bug that shape closed: one tap on the sleep button slept the machine and woke it again
// 46 ms later.
//
//   PUT /machine/state/sleeping  15:53:55.035
//   PUT /machine/state/idle      15:53:55.081   <- the screensaver's own teardown
//
// `ui.deactivateScreensaver()` hid the overlay AND sent `setMachineState('idle')`. The sleep
// button raised the overlay optimistically, before the machine had confirmed the sleep; the
// next (still stale) snapshot said 'idle', so the "machine is awake, tidy the overlay away"
// branch tore the overlay down — and the teardown woke the machine.
//
// The two rules that follow, and that every function here obeys:
//
//   1. The screensaver is a pure function of the machine's CONFIRMED state. The skin never
//      raises it optimistically, so a stale frame can never "undo" it.
//   2. Nothing that is not a wake may emit a wake. Hiding an overlay, changing a display
//      setting or receiving a snapshot must never send a machine state. Only the user
//      tapping the screensaver, or pressing the sleep button on a sleeping machine, wakes it.
//
// WHAT CHANGED IN THE PORT
//
// * Gate 2 addressing. Every state name comes from the GENERATED enum
//   (`src/data/machine-state.generated.js`, from ReaPrime's `machine.dart`). The old module
//   spelled 'sleeping', 'idle' and 'error' by hand; a hand-spelled state name is precisely
//   the defect `machine-state.js` exists to prevent (the old skin's hand copy invented
//   `'ready'` and lost `schedIdle`, and both shipped).
// * A7 — the lenient matcher is gone. `String(machineState || '').toLowerCase() ===
//   'sleeping'` matched names ReaPrime cannot send and folded every absence into the empty
//   string. Case-folding is a fallback: it makes an off-contract name match, and the thing
//   it would have matched on is BLANKING THE SCREEN. Comparison is now exact, against the
//   generated name, and an absence is handled as itself (see `isMachineAsleep`).
// * `deriveDisplayAction` no longer enumerates the two states that release a dim. It
//   releases on ANY exit from a confirmed sleep — see the note on that function; the old
//   two-name list is a dead-end dim waiting for a third name, and under the address layer
//   the BLE drop it was written for now arrives as an absence rather than as 'error'.
//
// WHAT IS DECIDED, AND WHAT IS NOT
//
// D10 (accepted, then HALF REVERSED on 26 August 2026): the skin is the single owner of
// screen blanking — that half stands and is what `SCREENSAVER_BRIGHTNESS` below is for.
// The other half, "the screensaver is FULLY BLACK", did not survive the day Ben asked for
// a type bank: "Row 2 should be the screen saver type: Black, Image or Clock." The
// `screensaverImages` list is live again in `storage-routes.js`, `settings-leaves.js`
// offers the three types, and `blackScreenSaver` stays retired because the bank replaced
// it rather than because black won.
//
// WHAT THAT COSTS THIS MODULE IS NOTHING, and that is worth saying rather than assuming.
// Nothing here knows which saver is showing; the three derivations answer "should the
// overlay be up", "should the panel dim", "what does a press mean", and all three are the
// same for a black screen, a picture and a clock. The one place the type matters is where
// the DIM is spent, and that is `ui-screensaver.js`'s `#applyDisplay()` — see its note.
//
// Q13 (SETTLED IN THE COMPONENT, still not settled here): ReaPrime restores brightness
// autonomously when it sees an awake machine with `requestedBrightness == 0`
// (`display_controller.dart:277-285`), so with a black saver two restore paths exist on the
// wake edge and exactly one side must drive it. This module states the INTENT ('restore');
// #57 has since been built and it stands back — `ui-screensaver.js`'s Q13 section carries
// the decision and its three reasons, and there is no restore in its event vocabulary at
// all. There is still deliberately no switch here: a policy knob nobody has decided how to
// set is worse than the open question, and this module was right not to grow one while the
// answer lived somewhere else. What that answer COSTS is now written down beside
// `SCREENSAVER_BRIGHTNESS` below — a skin that hands the restore to ReaPrime has thereby
// chosen 0-or-nothing for every saver it draws, because any other number destroys
// ReaPrime's remembered pre-sleep level on the next snapshot.
//
// DOM-free on purpose — `node --test test/` imports it directly, with no browser.

import { MACHINE_STATE } from '../data/machine-state.js';

export const SCREENSAVER_BRIGHTNESS = 0;

/** What the overlay should do. Paint only — there is no command in this vocabulary. */
export const SCREENSAVER_ACTION = Object.freeze({
    SHOW: 'show',
    HIDE: 'hide',
    NONE: 'none',
});

/** What the panel brightness should do. Also paint only. */
export const DISPLAY_ACTION = Object.freeze({
    DIM: 'dim',
    RESTORE: 'restore',
    NONE: 'none',
});

export function isMachineAsleep(machineState) {
    return machineState === MACHINE_STATE.SLEEPING;
}

function stateReported(machineState) {
    return typeof machineState === 'string' && machineState !== '';
}

export const WAKE_CONFIRM_GRACE_MS = 3000;

export function isWakePending(wakeRequestedAt, now = Date.now(), graceMs = WAKE_CONFIRM_GRACE_MS) {
    if (!wakeRequestedAt) return false;
    return (now - wakeRequestedAt) < graceMs;
}

export function deriveScreensaverAction({
    machineState,
    screensaverActive = false,
    screensaverEnabled = true,
    wakePending = false,
} = {}) {
    if (isMachineAsleep(machineState)) {
        // The mirror of the original race. That one was an optimistic SHOW undone by a stale
        // frame; this is an optimistic HIDE undone by one. The user tapped to wake, so we
        // took the overlay down and sent the wake — but for the next frame or three the
        // machine still honestly reports 'sleeping', because the PUT has not round-tripped.
        // Raising the overlay on those frames flashes it back into the user's face for
        // ~100-300 ms, right as they are reaching for the machine.
        //
        // "Confirmed state is the only source of truth" is untouched: we are not painting a
        // state we invented, we are declining to repaint one we have already asked the
        // machine to leave. The wake is still the ONLY thing that commands, and the
        // suppression is time-bounded, so an unconfirmed wake cannot hold the overlay down.
        if (wakePending) return SCREENSAVER_ACTION.NONE;

        if (!screensaverEnabled) {
            return screensaverActive ? SCREENSAVER_ACTION.HIDE : SCREENSAVER_ACTION.NONE;
        }

        // Only raise it if it is not already up.
        return screensaverActive ? SCREENSAVER_ACTION.NONE : SCREENSAVER_ACTION.SHOW;
    }

    // Not a confirmed sleep: awake, an unrecognised name, or nothing readable at all. Take
    // the overlay down if it is up — as a PAINT, not a command. Every one of those three
    // releases the blanking and none of them raises it, which is the same rule the display
    // action follows: a screen this skin blanked must never be left blanked on a machine it
    // can no longer see.
    return screensaverActive ? SCREENSAVER_ACTION.HIDE : SCREENSAVER_ACTION.NONE;
}

export function deriveSleepButtonAction({ machineState, screensaverActive = false } = {}) {
    if (isMachineAsleep(machineState)) {
        // Asleep -> the user wants it awake. One command, and take the overlay down
        // ourselves (the hide is a paint; the wake is this explicit command).
        return Object.freeze({ command: MACHINE_STATE.IDLE, hideScreensaver: screensaverActive });
    }
    // Awake -> the user wants it asleep. No overlay work: the overlay goes up when the
    // machine confirms it is sleeping.
    return Object.freeze({ command: MACHINE_STATE.SLEEPING, hideScreensaver: false });
}

export function deriveDisplayAction(previousState, currentState) {
    const wasAsleep = isMachineAsleep(previousState);
    const isAsleep = isMachineAsleep(currentState);

    if (isAsleep) return wasAsleep ? DISPLAY_ACTION.NONE : DISPLAY_ACTION.DIM;
    if (wasAsleep) return DISPLAY_ACTION.RESTORE;

    // The dark-tablet rescue: the app died while the saver had the panel at 0, and the first
    // frame of the new session shows a machine that is not asleep. Restore, or the tablet
    // boots black with the only recovery control invisible. Strictly the FIRST frame — a
    // mid-session feed hiccup is not a boot, and restoring on one would override a
    // brightness the user had just set.
    if (previousState === undefined || previousState === null) {
        return stateReported(currentState) ? DISPLAY_ACTION.RESTORE : DISPLAY_ACTION.NONE;
    }

    return DISPLAY_ACTION.NONE;
}
