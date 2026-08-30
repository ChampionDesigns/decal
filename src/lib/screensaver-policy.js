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

/**
 * THE BLACK SAVER'S PANEL LEVEL — not the saver's, and the distinction is 26 August's.
 *
 * D10's number, as an integer because ReaPrime's display handler drops a `setBrightness`
 * that is not an int 0..100 with a log line and no reply (`rea-ws-channels.js`
 * `WS_CHANNELS.display.validateCommand`). Named here so the screensaver component sends a
 * decision rather than a literal, and so "fully black" has one home.
 *
 * IT IS 0, IT MUST STAY 0, AND THE REASON IS STRONGER THAN "WE CHOSE NOT TO" (28 August
 * 2026). Zero is the whole point of the Black saver — it is what costs the panel nothing,
 * and it is what ARMS ReaPrime's own restore. What was not written down until now is that
 * a non-zero blank does not merely fail to arm that restore: it DESTROYS the value the
 * restore would come back to. `display_controller.dart:277-285` is nine lines and both
 * halves matter:
 *
 *     if (_currentMachineState == MachineState.sleeping) {
 *       if (_requestedBrightness > 0) {
 *         _preSleepBrightness = _requestedBrightness;      // <- 1
 *       }
 *     } else if (_requestedBrightness == 0 && _preSleepBrightness > 0) {
 *       setBrightness(_preSleepBrightness);                 // <- 2
 *     }
 *
 * That runs on EVERY DE1 snapshot (`_onSnapshot`), at the machine's own frame rate, for as
 * long as the machine is asleep. So a saver that dimmed to, say, 10 would be recorded by
 * line 1 on the very next frame — `_preSleepBrightness` becomes 10, and the level the user
 * actually chose is gone, unrecoverable, in about a tenth of a second. Then line 2 never
 * fires, because `_requestedBrightness` is 10 and not 0. The wake edge loses both halves
 * at once: nothing restores, and there is nothing left to restore TO. Zero is the only
 * value that passes line 1 without overwriting anything and satisfies line 2 on the way
 * back out.
 *
 * MEASURED ON BEN'S BENCH TABLET, 28 August 2026, with the skin's own `setBrightness` and
 * the live `/ws/v1/display` feed both instrumented over CDP. The saver was driven to Black
 * while the machine was AWAKE, which is the same `_syncBrightnessForMachineState` branch a
 * wake edge takes and is the only way to watch it without commanding the machine:
 *
 *     t +  1 ms   the skin sends setBrightness(0)          <- SCREENSAVER_BRIGHTNESS
 *     t + 11 ms   ReaPrime reports brightness 0, requested 0
 *     t + 49 ms   ReaPrime reports brightness 100, requested 100   <- ITS OWN RESTORE
 *
 * Nobody asked for that third line. It is line 2 above firing, and it came back to 100
 * because 100 was still what `_preSleepBrightness` held — which is line 1 above NOT firing,
 * because the only level this skin ever sends while sleeping is zero. The whole wake edge,
 * both halves, in 48 ms and with no restore path in this codebase at all.
 *
 * THE OTHER TWO SAVERS DO NOT SCALE THIS NUMBER DOWN — they send nothing at all, which is
 * the only other value with that property. An Image or a Clock painted onto a panel at
 * this level is invisible; a partial dim is destructive for the reason above; so the panel
 * is left exactly where the user put it and there is nothing to come back from.
 * `ui-screensaver.js` `#applyDisplay()` is where that gate lives, and it carries the cost
 * of the choice.
 *
 * SLATE DOES DIM ITS IMAGE SAVER, TO 10 (`api.js:2008` `SAVER_BRIGHTNESS_DEFAULT`, spent
 * by `getSaverBrightness()` at `:2027`), and it is the reference rather than the authority
 * — what it shows is the PRICE of that 10 rather than an argument for it. Slate can send a
 * non-zero dim only because it owns the restore itself: `dimDisplay()` captures
 * `brightnessBeforeDim` first and `restoreDisplay()` spends
 * `brightnessBeforeDim ?? rememberedBrightness ?? 100` (`:2061`) — the three-deep fallback
 * ladder ending in an invented number that A7 refuses and that `CARRY_FORWARD.md:703`
 * records as UNCLEAR #2. It even carries a guard against recording its own saver level as
 * the thing to restore (`:2038`), which is the clobbering above, met from the other side.
 * The two decisions are ONE decision: a skin that hands ReaPrime the restore (Q13, decided
 * in `ui-screensaver.js`) has thereby chosen 0-or-nothing, and a skin that wants a dimmed
 * picture has thereby taken the restore back. Decal took the first branch.
 */
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

/**
 * Is this a CONFIRMED sleeping machine?
 *
 * Exact, against the generated name. Three inputs are deliberately NOT sleep:
 *
 *   * an absence — a NO_READING from the address layer, `null`, `undefined`: the feed told
 *     us nothing, and nothing is not a confirmation. The skin blanks the screen only on a
 *     state the machine actually reported.
 *   * an unrecognised name — the server knows a state this build's enum does not. A machine
 *     doing something we have no name for is still a machine doing something.
 *   * a differently-cased name. See the port note above: folding case here would blank the
 *     screen on a name ReaPrime never sent.
 *
 * All three fall on the same side, and it is the safe side: never blank, and release a
 * blanking that is already up.
 *
 * @param {string|{noReading: true}|null|undefined} machineState
 * @returns {boolean}
 */
export function isMachineAsleep(machineState) {
    return machineState === MACHINE_STATE.SLEEPING;
}

/**
 * Did the machine report a state at all? Distinguishes "we have never seen a frame" from
 * "we saw a frame and it carried no state" — only the first is the boot case in
 * `deriveDisplayAction`. An address-layer absence is a state we DID see.
 *
 * DELIBERATELY NOT `isMachineState`, and this is the one place where that reads like an
 * oversight. A name this build's enum does not carry is, by the rule `isMachineAsleep`
 * states above, "a machine doing something we have no name for" — and every branch in this
 * file puts that on the RELEASE side: `deriveScreensaverAction` hides the overlay for it,
 * and the boot rescue below is the only other release there is. Gating the rescue on the
 * generated list would mean one state name added to ReaPrime after this build shipped boots
 * the tablet black with the brightness slider invisible on it — the reaprime#519 harm,
 * re-created by the check that looks stricter. Gate 2 forbids SPELLING a state name here,
 * and this spells none: it asks whether a frame carried one, never which one it was.
 */
function stateReported(machineState) {
    return typeof machineState === 'string' && machineState !== '';
}

/**
 * How long a wake WE asked for may go unconfirmed before we stop believing in it.
 *
 * A wake round-trips in ~100-300 ms (PUT, then the machine's next snapshot). This is
 * deliberately far longer, because the only cost of being generous is that a genuinely
 * refused wake leaves the overlay down a little longer; and the only cost of being stingy
 * is the flicker this exists to remove.
 */
export const WAKE_CONFIRM_GRACE_MS = 3000;

/**
 * Is a wake we requested still in flight?
 *
 * Bounded on purpose. If the PUT is lost, or the machine refuses it, the grace expires and
 * the screensaver goes back to being a pure function of the machine's confirmed state —
 * which, if the machine really is still asleep, means the overlay comes back. The
 * suppression can never latch the overlay off.
 *
 * @param {number} wakeRequestedAt - Date.now() when the wake was sent; 0 = none.
 * @param {number} [now]
 * @param {number} [graceMs]
 */
export function isWakePending(wakeRequestedAt, now = Date.now(), graceMs = WAKE_CONFIRM_GRACE_MS) {
    if (!wakeRequestedAt) return false;
    return (now - wakeRequestedAt) < graceMs;
}

/**
 * What the screensaver overlay should do, given the machine's CONFIRMED state.
 *
 * Never returns a machine command — a snapshot arriving, or an overlay being torn down, is
 * not a user asking for anything.
 *
 * @param {object} [input]
 * @param {string|{noReading: true}|null|undefined} [input.machineState]
 * @param {boolean} [input.screensaverActive]   is the overlay up right now
 * @param {boolean} [input.screensaverEnabled]  the user's setting (`screensaverEnabled`,
 *   local/device in `storage-routes.js`). Black-vs-dimmed is no longer a setting; on-vs-off
 *   still is.
 * @param {boolean} [input.wakePending]  we sent a wake and the machine has not confirmed it
 * @returns {'show'|'hide'|'none'} a member of SCREENSAVER_ACTION
 */
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

        /* SWITCHED OFF WHILE IT IS UP MUST TAKE IT DOWN, and it did not (found 24 Aug
         * 2026, driving the settings pages against a sleeping machine).
         *
         * This branch was `(enabled && !active) ? SHOW : NONE`, and NONE means "leave the
         * paint alone" — so with the blank already raised, turning the feature off did
         * nothing at all. The switch worked in one direction only: it could stop the next
         * blank and never the one on screen. A person switching a thing off while looking
         * at it is owed the thing going away.
         *
         * It is a PAINT, like every other release in this file, and never a command: the
         * machine is still asleep and nothing here asks it to wake. */
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

/**
 * What the sleep button should do, given the machine's CONFIRMED state.
 *
 * `command` is the only machine command in this file, and it is only ever a wake when the
 * machine is genuinely asleep and the user pressed the button to wake it — an explicit,
 * user-initiated wake. Hiding the overlay is reported separately (`hideScreensaver`)
 * precisely so that hiding can never smuggle a wake along with it.
 *
 * There is no "show the screensaver" outcome: the button does not raise the overlay
 * optimistically. The overlay goes up when the machine CONFIRMS 'sleeping', which is the
 * 46 ms race closed at the source.
 *
 * An absence takes the sleep half, never the wake half: with no confirmed sleep to act on,
 * the only thing this may derive is a request to sleep, which is the half that cannot
 * surprise anyone. Both names are the generated ones, so the caller's
 * `PUT /api/v1/machine/state/{newState}` cannot carry a name ReaPrime does not accept.
 *
 * @param {object} [input]
 * @returns {{ command: string, hideScreensaver: boolean }}
 */
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

/**
 * What the panel brightness should do on a machine-state TRANSITION.
 *
 * A DIM MUST ALWAYS HAVE SOMETHING THAT UNDOES IT. reaprime#519: the DE1 dropped off BLE
 * while asleep; the dim was applied on the 'sleeping' transition and only an 'idle'
 * transition released it — which a machine that is no longer there never sends. The tablet
 * stayed dark for the rest of the session, recoverable only by the settings brightness
 * slider the user could not see on a dark panel.
 *
 * The old module answered that with a two-name allow-list ('idle' or 'error'). This releases
 * on ANY exit from a confirmed sleep, which is the same intent stated as a rule instead of
 * as an enumeration, and it covers two cases the list does not:
 *
 *   * the generated enum has 21 states. A machine that wakes on its own schedule, or into
 *     'heating' or 'booting', left the old list dimmed with nothing to undo it.
 *   * under the address layer the BLE drop this was written for now arrives as an ABSENCE —
 *     the feed stops, no state at all — rather than as an 'error' frame. An absence after a
 *     dim releases it, for exactly the reason the 'error' branch existed.
 *
 * IT ALSO NARROWS, and that half is a behaviour CHANGE rather than a generalisation, so it
 * is stated here rather than left to be read off the code. The old allow-list was tested
 * against the CURRENT state alone (`currentState === 'idle' || currentState === 'error'`),
 * so it restored on every arrival at those two names from ANY state: espresso -> idle, the
 * end of every shot, lit the panel, and so did espresso -> error. Both return 'none' here.
 * A shot ending is not a wake edge, and restoring on one overwrites the brightness the user
 * chose while it was pulling. What this module dimmed, the rule above releases; a dim it did
 * not apply was never its to release — and ReaPrime itself restores an awake machine holding
 * `requestedBrightness == 0` (`display_controller.dart:276-285`, the Q13 note in the header),
 * which is the second path that case actually has. Pinned by test in both directions.
 *
 * Transition-only by design — the snapshot feed repeats the same state at ~10 Hz, and
 * re-dimming (or re-restoring) on every frame would clobber a brightness the user just
 * chose. An awake-to-awake transition therefore returns 'none': it is not a wake edge.
 *
 * @param {string|{noReading: true}|null|undefined} previousState  `undefined` = no frame has
 *   arrived yet, which is the boot case. An address-layer absence is NOT that: it is a frame
 *   we saw that carried no state.
 * @param {string|{noReading: true}|null|undefined} currentState
 * @returns {'dim'|'restore'|'none'} a member of DISPLAY_ACTION
 */
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
