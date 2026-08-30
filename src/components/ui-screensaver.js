/**
 * ui-screensaver.js — inventory #57, the Live compound that blanks the screen.
 *
 * SCOPE Part 4 Wave 4, row 57 (`SCOPE.md:1629`): "The sleep overlay: fully black, and
 * the skin is the only thing allowed to blank the screen (D10). Logic is the
 * `screensaver-policy.js` port, whose return-a-paint-action-never-a-machine-command
 * shape is the value (`CARRY_FORWARD.md` §3e)."
 *
 * ===========================================================================
 * WHAT THIS COMPONENT IS
 * ===========================================================================
 *
 * All of the thinking is already done and it lives in `src/lib/screensaver-policy.js`
 * (the Wave 4 port). This file is the SURFACE: a black box that covers the screen, one
 * press target on it, and the wiring that turns the port's three derivations into paint.
 * It adds no policy of its own — every branch below is a call into the port, and the two
 * places where it decides something (D10 ownership, Q13's wake edge) are marked and
 * explained.
 *
 * THE SHAPE THE PORT IS FOR, INHERITED HERE. `deriveScreensaverAction` returns only
 * `'show' | 'hide' | 'none'` and is therefore *incapable* of asking for a machine
 * command — that is what closed the 46 ms sleep/wake race where hiding an overlay
 * smuggled `setMachineState('idle')` along with it (`CARRY_FORWARD.md:304`,
 * `screensaver-policy.js:8-17`). A component that took that module and then sent a
 * machine state on its own initiative would hand the defect straight back. So:
 *
 *   * this component NEVER calls a route and NEVER opens a socket. It emits
 *     `ui-screensaver-wake` and the screen performs the one PUT
 *     (`putMachineStateByNewState`, per the port digest). The state name in that event
 *     comes from `deriveSleepButtonAction`, never spelled here;
 *   * the only thing that emits a wake is a user press on a CONFIRMED sleeping machine.
 *     A press on an overlay that is up over an awake machine takes the overlay down and
 *     sends nothing — "nothing that is not a wake may emit a wake"
 *     (`screensaver-policy.js:23-25`);
 *   * the overlay is never raised optimistically. It goes up when the machine CONFIRMS
 *     `sleeping`, which is the 46 ms race closed at the source.
 *
 * ===========================================================================
 * D10 — ONE BLANKING OWNER, AND HOW THAT IS ENFORCED RATHER THAN DOCUMENTED
 * ===========================================================================
 *
 * "Screensaver: fully black, one owner — the skin (D10). The second half is the real
 * decision: exactly one piece of software is entitled to blank the screen"
 * (`SCOPE.md:218-219`; the register entry is `decisions/capdiff.md:435`, and Part 5 §2
 * lands it on this component at `SCOPE.md:2046-2048`).
 *
 * Two mechanisms, because "one owner" has two halves:
 *
 *   1. ACROSS THE SKIN — `BLANK_OWNER` below is a single-slot module-level array, the
 *      same idiom as `ui-dialog`'s `OPEN_DIALOGS` (`ui-dialog.js:260`). A second
 *      viewport-anchored `<ui-screensaver>` that derives SHOW while another holds the
 *      blank does not blank and does not dim: it leaves `active` false, so the refusal
 *      is readable on the element itself, and `blankingOwner()` names the one that did
 *      take it. Two blankers is inexpressible rather than discouraged. (Until 29 Aug
 *      2026 the refusal was also announced, as `ui-screensaver-blank` with
 *      `reason: 'not-owner'`; nothing heard it — audit F-013.)
 *   2. THE OVERLAY AND THE PANEL ARE ONE DECISION. The black box and the panel dim are
 *      emitted from the same branch, so the skin cannot end up with a dimmed panel and
 *      no overlay (a black screen the user cannot press) or an overlay over a lit panel.
 *      A screensaver the user has switched off (`screensaverEnabled`) dims nothing:
 *      no overlay, no blank, one feature.
 *
 * D10 WAS REVERSED ON 26 AUGUST 2026 AND THE SECOND HALF SURVIVED IT. Ben: "Row 2 should
 * be the screen saver type: Black, Image or Clock." So "fully black" is now the BLACK
 * saver rather than the saver, `screensaverImages` is live again in `storage-routes.js`,
 * and `#applyDisplay()` sends the panel dim only for Black — see its own note. What did
 * NOT change is the half that mattered: exactly one piece of software is entitled to blank
 * the screen, and it is this one. `blackScreenSaver` stays retired; the three-way
 * `screensaverType` replaced it, because two switches for three states has an unreachable
 * combination and no name for what is showing.
 *
 * ===========================================================================
 * Q13 — THE WAKE EDGE. DECIDED HERE, AT BUILD TIME, AND IT IS "THE SKIN BACKS OFF"
 * ===========================================================================
 *
 * `SCOPE.md:5152`: "ReaPrime restores brightness autonomously on awake-with-brightness-0,
 * so only one side may drive brightness on the wake edge — which side backs off. D10
 * settled ownership of *blanking* (the skin); this is the remaining implementation call."
 * `rea-ws-channels.js`'s display row says the same and names this component as its home.
 *
 * THE DECISION: the skin drives the DIM and stands back on the RESTORE.
 * `deriveDisplayAction` returning `'restore'` is computed, recorded on `displayAction`
 * and OBSERVABLE — and no event asks anyone to act on it. ReaPrime's
 * `_syncBrightnessForMachineState()` (`display_controller.dart:276-285`) is the single
 * restore path.
 *
 * Three reasons, in the order they mattered:
 *
 *   1. A7. The old skin's restore value was `brightnessBeforeDim ?? rememberedBrightness
 *      ?? 100` (`CARRY_FORWARD.md:703`, UNCLEAR #2) — a three-deep fallback ladder
 *      ending in an invented number. Backing off means the skin never needs a remembered
 *      value at all, so the ladder has nothing to come back for. The only honest
 *      pre-sleep brightness is ReaPrime's own `_preSleepBrightness`
 *      (`display_controller.dart:279`, restored at `:281-283`), which the skin cannot
 *      read and which survives a skin reload that an in-memory field does not.
 *   2. ONE OWNER PER EDGE is D10's own argument, applied to the half D10 did not settle.
 *   3. THE SKIN'S DIM IS WHAT ARMS ReaPrime'S RESTORE. ReaPrime restores when it sees an
 *      awake machine at requested brightness 0, and 0 is exactly what our dim asked for.
 *      The two halves are already one mechanism; making the skin drive both would be the
 *      second copy, not the complete one.
 *
 * REVERSAL, if the bench shows ReaPrime's restore is absent or late: one line in
 * `#applyDisplay()` — emit `ui-screensaver-dim` for the RESTORE case too, with the
 * brightness the display feed already reports. Recorded as a deferred question, with the
 * derived action left visible on the element precisely so the reversal has something to
 * measure first.
 *
 * WHAT BACKING OFF COSTS, stated rather than hidden: if this element is torn down while
 * it holds the blank and the machine is STILL asleep, the panel stays at 0 and nothing
 * in the skin puts it back — ReaPrime restores on the machine's next awake frame, which
 * is the machine's own power button. That is a narrower window than reaprime#519 (which
 * needed only a BLE drop) and it is the residual the deferred question names.
 *
 * ===========================================================================
 * A HARDWARE KEY DOES NOT DISMISS THE BLANK, AND IT CANNOT — MEASURED 28 AUG 2026
 * ===========================================================================
 *
 * Ben's black screen came with a second observation: `adb shell input keyevent
 * KEYCODE_WAKEUP` did nothing to it. On a tablet whose panel is at 0 under a Black saver
 * that is a frightening state — the device is Awake, the app is focused, and the only
 * thing that clears it is a touch nobody has told the user about. The obvious repair is a
 * `keydown` listener on this element. It would be a listener nothing ever calls.
 *
 * MEASURED ON THE BENCH TABLET, over CDP into the live WebView, with capture-phase
 * `keydown`/`keyup` listeners armed on `window` and a black saver up:
 *
 *     adb shell input keyevent KEYCODE_WAKEUP      -> 0 events in the page
 *     adb shell input keyevent KEYCODE_VOLUME_DOWN -> 0 events in the page
 *     adb shell input keyevent KEYCODE_VOLUME_UP   -> 0 events in the page
 *     adb shell input keyevent KEYCODE_BACK        -> 0 events in the page, and the
 *                                                     FLUTTER shell popped to its own
 *                                                     "Return to Skin" menu
 *
 * Three of those are eaten by the platform before any app sees them — `KEYCODE_WAKEUP` on
 * an already-awake device is consumed by the window manager, and the volume keys by the
 * system UI. The fourth is eaten by ReaPrime: BACK is a Flutter navigation event and never
 * reaches the WebView at all, which is also why it destroyed this page's devtools target
 * mid-measurement. So there is no key this element could listen for, and adding one would
 * be a control that writes to nothing — the exact shape this fork exists to remove, built
 * as the fix for an instance of it.
 *
 * THE SECOND REASON IS THE POLICY'S, AND IT WOULD APPLY EVEN IF A KEY ARRIVED. The blank
 * is a pure function of the machine's CONFIRMED sleep. A key that only HID the overlay
 * would be an optimistic hide, undone by the next `sleeping` frame ~100 ms later — the
 * 46 ms race, inverted. So a key would have to emit a WAKE, exactly as a press does, and
 * it would then be a third way to command the machine that a person can trigger without
 * looking at the screen. A deliberate touch on a screen that says "Wake the machine" is a
 * better gesture than a volume rocker.
 *
 * WHAT IS OWED INSTEAD, and it is not this component's: the panel goes to 0 only for the
 * BLACK saver, and after the 28 August fix below a tablet nobody has configured no longer
 * gets that saver by accident. A user who chooses Black is choosing a screen that looks
 * off, which is the point of it. If waking by key is ever wanted it belongs in ReaPrime's
 * own Flutter layer, where the key events actually land.
 *
 * ===========================================================================
 * GATE 2 — WHERE THE SERVER DATA COMES FROM
 * ===========================================================================
 *
 * Not one server key string appears in this file, and no frame is read here. The two
 * inputs are values the address layer produced, and `attachScreensaver()` at the bottom
 * is the supported way to deliver them — it subscribes to `src/stores/` feeds and never
 * fetches anything:
 *
 *   machineState        <- `readMachineSnapshot(frame).state`   (FEED.MACHINE)
 *   brightnessSupported <- `readDisplayFrame(frame).platformSupported.brightness === true`
 *                                                              (FEED.DISPLAY)
 *
 * An ABSENCE is a legal input on both and has a defined answer: the port treats a
 * non-string state as "not a confirmed sleep" (never blank; release a blank that is up),
 * and a capability that is a `noReading` is not a capability, so no dim is asked for.
 * There is no `??` anywhere in this file.
 *
 * ===========================================================================
 * THE LAYER, AND WHAT IT DOES NOT SOLVE
 * ===========================================================================
 *
 * `ui.js:1403-1415` builds the old one as `position: fixed; top/left 0; 100vw x 100vh;
 * z-index: 10000` (`:1405`, `:1408-1409`, `:1412`) with a `click` handler bound straight
 * on the bare div (`:1431`), plus an `rgba(40, 40, 40, 0.55)` grey child for "browser
 * mode" (`:1422`) — the dim overlay D10 retires. This one is `position: fixed; inset: 0`
 * on `--ui-z-blackout`, and it promotes itself into the TOP LAYER with `popover="manual"`
 * (the same mechanism, and the same `SUPPORTS_POPOVER` guard, as `ui-toast`), so a
 * dialog card cannot paint on a blanked screen.
 *
 * ENTRY ORDER IS NOT A SCALE, and wave 5.2 measured what that costs. The token file puts
 * `--ui-z-blackout` (400) ABOVE `--ui-z-toast` (300) precisely so a notice cannot paint on
 * a blanked screen — Slate's own numbers make the toast 10001 over the screensaver's
 * 10000 (`index.html:657` vs `ui.js:1412`) and that is the defect the scale was written to
 * kill. But `ui-toast` is a top-layer box too, and THE TOP LAYER IS ORDERED BY ENTRY, not
 * by z-index: a notice raised while the blank is up enters after it and paints over it.
 * MEASURED (BENCH, real CDP, full-frame screenshot): a blank alone is 0 non-black pixels;
 * a `danger` notice raised after it put 24,031 non-black pixels on a screen D10 says is
 * black. Both components' own suites passed throughout — the defect only exists between
 * them, which is what this wave is for.
 *
 * THE REPAIR IS ON THIS SIDE, because this is the side the scale puts on top: while the
 * blank is up, `#watchLayer()` listens for any OTHER element entering the top layer and
 * re-enters immediately after it, restoring the order the tokens declare. See
 * `#onForeignToggle()` for why it is `beforetoggle` + a microtask and not `toggle`.
 *
 * IT IS A LISTENER, SO IT HAS A PRECONDITION, and stating it unconditionally cost this
 * wave a finding (c-surfaces-1). The blank re-takes the layer only for an entry it can
 * HEAR: `beforetoggle` is `composed: false` and never leaves the tree it fired in, so a
 * surface in a shadow tree this element does not share is heard only through the library's
 * composed `open-change`. #18 and #21 emitted it already; `ui-toast` did NOT until the
 * wave-5.2 fix pass, and a `<ui-toast>` inside a screen's own shadow template — the
 * ordinary composition once a screen owns its toast — put the same 24,031 non-black pixels
 * back on a blanked screen. `ui-toast.js`'s `#syncLayer()` now announces its layer entry,
 * and `test/render/overlay-surfaces.render.test.mjs` drives that arrangement. Any FUTURE
 * top-layer surface owes the same announcement; nothing here can compel it, which is why
 * this paragraph exists rather than a promise.
 *
 * WHAT THE TOP LAYER DOES NOT BUY, and `ui-toast` already wrote it down: a MODAL dialog
 * blocks interaction with the whole document outside itself, and no layer beats that. If
 * a `ui-dialog` is open with `showModal()` when the machine confirms sleep, this overlay
 * paints over it and its press target is inert. Making the screensaver a modal of its
 * own would be a second copy of #18's machinery, which this wave forbids; deciding what
 * an open dialog should do when the machine sleeps is a screen decision, and Part 5 §2
 * (wf-w5p2-overlays) has D10 on its own spec line for exactly that integration. Recorded,
 * not improvised.
 *
 * `anchor="container"` is the gallery's and the panel's escape, identical in purpose to
 * `ui-toast`'s: without it every gallery state would blank the whole window and the
 * capture battery would shoot the same black rectangle for all of them. A
 * container-anchored instance is not the screen and therefore does not take the
 * single-owner slot.
 *
 * ===========================================================================
 * THE ORACLE HAS NOTHING TO SAY ABOUT THIS COMPONENT, mechanically
 * ===========================================================================
 *
 *   prov_query.py find --cls slate-screensaver
 *     -> corpus prov-baseline (dark); searched 49 state(s); found 0 element(s) in 0 state(s)
 *     -> "The corpus has no answer for this element"
 *
 * Slate never captured it: the div is built from script and lives at `display: none`
 * (`ui.js:1413`) until a sleeping frame arrives, so none of the 49 states contains it.
 * Every value below is therefore either a token from the Step 0 spec, a source read from
 * Slate with a file:line, or a decision named above. Nothing here is matched to a picture.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    DISPLAY_ACTION,
    SCREENSAVER_ACTION,
    SCREENSAVER_BRIGHTNESS,
    WAKE_CONFIRM_GRACE_MS,
    deriveDisplayAction,
    deriveScreensaverAction,
    deriveSleepButtonAction,
    isMachineAsleep,
    isWakePending,
} from 'src/lib/screensaver-policy.js';
import { defaultFor } from 'src/lib/settings-defaults.js';
import {
    CLOCK_TICK_MS, DEFAULT_CLOCK_FORMAT, normaliseClockFormat, wallClock,
} from 'src/lib/wall-clock.js';

/* -------------------------------------------------------------- the vocabulary */

/**
 * The events this element emits. TWO, and the vocabulary is the point: each one ASKS
 * THE SHELL FOR SOMETHING. Nothing here merely reports.
 *
 *   WAKE — the ONLY one that carries a machine command, and it is only ever emitted
 *          from a user press on a confirmed sleeping machine. `detail.state` comes from
 *          `deriveSleepButtonAction`, so the screen's
 *          `PUT /api/v1/machine/state/{newState}` cannot carry a name ReaPrime does not
 *          accept.
 *   DIM  — D10's panel half. `detail.brightness` is the port's SCREENSAVER_BRIGHTNESS,
 *          an int, which is what `WS_CHANNELS.display.validateCommand` requires: the
 *          display handler drops a non-int silently, with no reply at all.
 *
 * THERE WAS A THIRD, `BLANK`, AND IT WAS A REPORT RATHER THAN A REQUEST — "the paint
 * changed", in both directions, with a `BLANK_REASON`. Nothing in `src/` ever bound it;
 * `app-root.js`, which mounts the one screensaver this skin has, says beside its other
 * two bindings that "nothing here needs to act on it". Retired 29 August 2026, audit
 * F-013, with the reason table that only it used. `#lower()` carries the argument.
 *
 * FOLLOW THE PAINT THROUGH `active` — a reflected property — and the owner slot through
 * the exported `blankingOwner()`. Both were always the load-bearing route; the event was
 * a convenience nobody took up.
 *
 * THERE IS NO RESTORE EVENT. That is Q13, above, expressed as an absence in the
 * vocabulary rather than as a flag somebody could set — the same move the port makes by
 * having no machine command in `SCREENSAVER_ACTION`.
 */
export const SCREENSAVER_EVENT = Object.freeze({
    WAKE: 'ui-screensaver-wake',
    DIM: 'ui-screensaver-dim',
});

/** The press target's name, as an i18n KEY — keys are English text (`src/lib/i18n.js`). */
const WAKE_LABEL_KEY = 'Wake the machine';

/**
 * Popover promotion, feature-detected once. Identical to `ui-toast`'s guard and for the
 * identical reason: a WebView without the API keeps painting where it always did (the
 * `--ui-z-blackout` box), and only the top layer is lost. This is a capability check on
 * a browser API, not an A7 data fallback — there is no second source of truth for a
 * machine state anywhere near it.
 */
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.showPopover === 'function';

/**
 * The two ways this element learns that something else has entered the top layer —
 * see `#watchLayer()` for why it takes two and not one.
 *
 * `beforetoggle` is the platform's own, and covers every popover and every `<dialog>`
 * in the same tree. `open-change` is the library's, `composed: true`, and is the only
 * one that survives a shadow boundary — which is where #18's native `<dialog>` lives, and
 * which is also the ONLY thing that reaches a `<ui-toast>` mounted in another tree
 * (c-surfaces-1). #18, #21 and #22 all emit it.
 */
const LAYER_ENTRY_EVENTS = Object.freeze(['beforetoggle', 'open-change']);

/**
 * THE ONE BLANKING OWNER (D10). Module scope, ONE slot, viewport-anchored elements only.
 *
 * A `const` array with room for one entry, never a module-scope `let` holding the
 * element: a top-level `let` is `CARRY_FORWARD.md` §6 pattern C — the singleton with no
 * owner — and `test/store.test.mjs` fails the whole tree on one, anywhere under `src/`.
 * `ui-dialog`'s `OPEN_DIALOGS` (`ui-dialog.js:260`) is the same idiom, for cross-instance
 * arbitration that genuinely cannot live on an instance.
 *
 * Deliberately not a stack. `ui-dialog` keeps a stack because dialogs legitimately nest;
 * a second screen blanking is not a nested case, it is the bug D10 names, so the second
 * claimant is refused rather than queued and the array never holds two.
 */
const BLANK_OWNER = [];

function claimBlank(element) {
    if (BLANK_OWNER.length > 0) return BLANK_OWNER[0] === element;
    BLANK_OWNER.push(element);
    return true;
}

function releaseBlank(element) {
    if (BLANK_OWNER[0] === element) BLANK_OWNER.length = 0;
}

/** For tests and for a screen that wants to assert on it. Never a setter. */
export function blankingOwner() {
    return BLANK_OWNER.length > 0 ? BLANK_OWNER[0] : null;
}

/* ------------------------------------------------------------------ the element */

export class UiScreensaver extends UiElement {
    static properties = {
        /**
         * The machine's CONFIRMED state — `readMachineSnapshot(frame).state`, handed in
         * by `attachScreensaver()` or by a screen. An absence (a `noReading`, `null`,
         * `undefined`) is a legal value with a defined answer and must NOT be turned
         * into a string on the way in.
         *
         * The attribute exists for the gallery and for a static demo; the app path is
         * the property, because an absence has no attribute form.
         */
        machineState: { attribute: 'machine-state' },

        /**
         * The user's `screensaverEnabled` setting (local/device, `storage-routes.js`).
         * Black-vs-dimmed is no longer a setting under D10; on-vs-off still is.
         *
         * DEFAULT TRUE, and the converter is why the attribute can still say otherwise:
         * a plain Boolean attribute cannot express "off" by absence, and absence is the
         * common case in markup. `enabled="false"` turns it off; anything else present,
         * or absent altogether, leaves it on.
         */
        enabled: {
            attribute: 'enabled',
            converter: { fromAttribute: (value) => value !== null && value !== 'false' },
        },

        /**
         * `readDisplayFrame(frame).platformSupported.brightness === true`. Default FALSE:
         * a platform that has not said it can set brightness has not said it can, and an
         * absence is not a capability. A dim asked of a platform with no brightness
         * control is a command that vanishes (the handler logs and does not reply).
         */
        brightnessSupported: { type: Boolean, attribute: 'brightness-supported' },

        /** The blank is up. Reflected so a screen can style around it and a test can see it. */
        active: { type: Boolean, reflect: true },

        /**
         * The last `deriveDisplayAction` answer — `dim`, `restore` or `none`. Reflected
         * and NOT acted on for `restore`: this is Q13's evidence surface, so the reversal
         * has something to measure before it changes anything.
         */
        displayAction: { attribute: 'display-action', reflect: true },

        /** `viewport` (default) or `container` — see the header. Read by CSS and by the layer. */
        anchor: { type: String, reflect: true },

        /** The press target's accessible name. Overrides the translated default. */
        label: { type: String },

        /**
         * The port's own `graceMs` parameter, surfaced so a test does not have to wait
         * three seconds. Not a policy knob: the default IS the policy
         * (`WAKE_CONFIRM_GRACE_MS`), and the port already takes this argument.
         */
        graceMs: { type: Number, attribute: 'grace-ms' },

        /**
         * Show a faint clock on the blank. Set when `screensaverType` is `clock`.
         *
         * Ben, 24 Aug 2026: "In settings I want an option for this black screen to have a
         * faint clock showing the time in the same font the skin uses."
         *
         * OFF BY DEFAULT, and the default is the point: black costs the panel nothing, so
         * a lit element is a choice the user makes rather than one the skin makes for
         * them. It is now one of THREE kinds of saver rather than a switch over the blank
         * — see `image` below and `screensaverType` in the routing table.
         */
        clock: { type: Boolean, reflect: true },

        /**
         * The picture to show, as a data URL, or the empty string for none.
         *
         * ONE IMAGE, NOT THE LIST. Which of the stored pictures is showing, and when it
         * changes, is `attachScreensaver`'s to decide — this element paints what it is
         * given and owns no timer of its own beyond the clock's. A component that held
         * the list would be a component that had to know the cycle interval, the storage
         * key and the bundled default, none of which is paint.
         *
         * AN EMPTY STRING PAINTS NOTHING, so an image saver whose pictures have not
         * loaded yet is a black screen rather than a broken-image glyph.
         */
        image: { type: String },

        /**
         * The language the time is spelled in — this skin's `language` setting, not the
         * browser's. A module reaching for `navigator` would be a second answer to a
         * question the user has already been asked (`wall-clock.js`).
         */
        language: { type: String },

        /**
         * How the time is written — `24h` or `12h`, the `clockFormat` preference.
         *
         * ONE PREFERENCE FOR BOTH CLOCKS. The Live header writes a time too, and a
         * per-surface format would let one say 21:40 while the other says 9:40 PM — the
         * drift `wall-clock.js` was extracted to prevent, arriving by the other door.
         */
        clockFormat: { type: String, attribute: 'clock-format' },

        /** Internal: the time as it is currently PAINTED. Written only when the spelling
         *  moves, so a one-second tick costs one render a minute. */
        _time: { state: true },
    };

    static styles = [
        visuallyHidden,
        css`
            /* THE BLANK IS THE HOST. position: fixed + inset: 0 is Slate's own geometry
             * (ui.js:1405 sets position fixed, :1406-1407 top/left 0, :1408-1409
             * 100vw x 100vh) written with the two properties that do not need a viewport
             * UNIT — 100vw is wider than the layout viewport whenever a scrollbar exists,
             * which is how an overlay gets a horizontal scrollbar of its own.
             *
             * NO WIDTH QUERY ANYWHERE IN THIS FILE (CONVENTIONS §2). A blank that covers
             * the screen needs no breakpoint: it is the same box at 1281x801 and at
             * 1000x600, and both are asserted. */
            :host {
                position: fixed;
                inset: 0;
                z-index: var(--ui-z-blackout);

                /* Not painted until the policy says so. (0,2,0) below turns it on, which
                 * beats the base's :host { display: block } (0,1,0) and the popover UA
                 * sheet's display rule alike, so the two states cannot disagree. */
                display: none;

                background-color: var(--ui-blackout);
            }

            /* THE POPOVER UA SHEET, answered per property. A promoted element gets
             * margin: auto, a solid border, .25em padding, overflow: auto, fit-content
             * sizing and Canvas/CanvasText colours — all of which would turn the blank
             * into a small bordered card in the middle of the screen. Position and inset
             * are NOT restated: :host above already states both, and an author rule beats
             * the UA sheet per property whatever its specificity. */
            :host([popover]) {
                margin: 0;
                border: 0;
                padding: 0;
                overflow: visible;
                inline-size: auto;
                block-size: auto;
                color: inherit;
                background-color: var(--ui-blackout);
            }

            :host([active]) {
                display: block;
            }

            /* THE ESCAPE FROM THE VIEWPORT — the gallery, and a panel-scoped demo. The
             * blank then fills its nearest positioned ancestor instead of the screen.
             * Such an instance is not the screen and never takes the D10 owner slot. */
            :host([anchor="container"]) {
                position: absolute;
            }

            /* THE PRESS TARGET IS THE WHOLE BLANK — the hit floor is the screen, so
             * the .hit-overlay utility has nothing to add here. The button's own UA
             * paint (border, padding, ButtonFace, buttontext) is answered per property;
             * the ground is stated a second time so a blank whose host rule ever loses
             * is still black rather than grey. */
            .blank {
                display: block;
                inline-size: 100%;
                block-size: 100%;

                margin: 0;
                border: 0;
                padding: 0;
                background-color: var(--ui-blackout);
                color: inherit;
                font: inherit;

                /* THE RING IS DRAWN INSIDE (CONVENTIONS §3, bug L24's other half). The
                 * outset offset would put the ring outside the screen on all four sides,
                 * which is the same defect as a clipped ring with a different cause. One
                 * treatment, the other offset — no second ring is authored here. */
                --_ui-focus-offset: var(--ui-focus-offset-inset);

                /* The clock sits in the middle of the press target, which is the whole
                 * screen. display: grid on the button rather than a wrapper: there is
                 * one child, and a wrapper would be a box between the finger and the
                 * button for no reason. */
                display: grid;
                place-items: center;
            }

            /* ---- the faint clock ------------------------------------------
             * THE SKIN'S OWN TYPE, which is what Ben asked for: --ui-font-family
             * inherits from the document, so the time is set in the same face as
             * every other word in the app rather than in a face this file chose.
             *
             * FAINT IS AN OPACITY ON THE INK, not a grey. A grey would be a colour
             * literal in a component (Gate C's own rule) and would stop being faint
             * the day the palette moves.
             *
             * THE INK IS --ui-blackout-ink AND NOT --ui-text, and the first build got
             * that wrong. --ui-blackout is deliberately the SAME in both themes ("a
             * blanked screen does not follow the theme, which is the whole content of
             * the decision"), and --ui-text is NEAR-BLACK in the light theme — so a
             * 22%-alpha clock was invisible, and invisible only for the half of users
             * on a light theme. A ground that does not follow the theme cannot carry an
             * ink that does. Measured on the bench: oklab lightness 0.215 at 22% alpha,
             * on black.
             *
             * --_ui-clock-* are PRIVATE (the leading underscore): they are this
             * element's own dials and not an API surface, which is the same rule
             * .chip follows one screen over. */
            /* THE PICTURE FILLS THE BLANK AND IS NOT ALLOWED TO CHANGE ITS SHAPE.
             *
             * object-fit: cover crops to the panel rather than letterboxing, which is
             * what every screen saver does; a letterboxed picture would put two black
             * bars on a screen whose whole subject is what it shows.
             *
             * IT SITS UNDER THE CLOCK, not instead of it: the type picks one or the
             * other today, and an image with a clock over it is what the two would look
             * like if that ever changes. The press target is the button around both. */
            .saver-image {
                position: absolute;
                inset: 0;
                inline-size: 100%;
                block-size: 100%;
                object-fit: cover;
                pointer-events: none;
            }

            .clock {
                --_ui-clock-alpha: 0.22;
                --_ui-clock-size: clamp(3rem, 12cqi, 9rem);

                font-family: var(--ui-font-family);
                font-size: var(--_ui-clock-size);
                font-weight: var(--ui-weight-regular);
                font-variant-numeric: tabular-nums;
                letter-spacing: 0.02em;
                line-height: 1;

                /* TABULAR FIGURES AND A FIXED WIDTH ARE THE SAME DECISION. h23 gives
                 * a leading zero, so the string is five characters at every hour; with
                 * tabular figures it is also the same WIDTH at every minute, and the
                 * clock does not shuffle sideways once a minute on a still screen. */
                color: color-mix(in oklab, var(--ui-blackout-ink) calc(var(--_ui-clock-alpha) * 100%), transparent);

                /* ANNOUNCED BY THE BUTTON, NOT BY ITSELF. The press target's accessible
                 * name is what a reader needs here ("wake the machine"); a time read out
                 * on top of it is noise on a screen whose only action is a wake. */
                pointer-events: none;
            }

            /* ---- the drift -------------------------------------------------
             * Ben, 24 Aug 2026: "make it drift a little please. it should start in
             * the very centre of the screen then drift up 1.2x the text height, then
             * back down to centre."
             *
             * IT IS A BURN-IN MITIGATION AND IT IS ALSO WHY THE CLOCK IS ALLOWED TO
             * EXIST. A lit element on a screen that stays black for hours can mark
             * the panel; a clock that never occupies one pixel for long cannot. So
             * the drift is not decoration, and that decides every value below.
             *
             * PURE CSS, NO JS TIMER. The clock already owns one interval and writes
             * its property only when the MINUTE changes, which is what keeps a
             * blanked screen at one render a minute. Driving the drift from
             * JavaScript would put that back to sixty renders a second for a
             * movement the compositor does for free.
             *
             * 1.2em IS 1.2x THE TEXT HEIGHT because line-height is 1 on this
             * element: its box is exactly its font-size, so an em and a text height
             * are the same length. Written in em rather than in pixels so it stays
             * 1.2x at every clamp step of the clock size.
             *
             * LINEAR, NOT EASE. An eased cycle lingers at the two extremes, which is
             * exactly where a static clock would sit and exactly what this is for.
             * Linear spreads the dwell evenly over the whole travel.
             *
             * FOUR MINUTES, and it is slow on purpose: 1.2 x 144px over 120 seconds
             * of travel is about 1.4 px per second, under the threshold at which a
             * glance sees movement. "Drift a little" is the requirement, and a clock
             * that visibly slides is a different thing.
             *
             * ALTERNATE, so the return is the same path in reverse and the element
             * is at the centre at the start of every cycle - which is the position
             * Ben named as the starting one.
             */
            @keyframes ui-screensaver-drift {
                from { transform: translateY(0); }
                to   { transform: translateY(calc(var(--_ui-clock-drift) * -1)); }
            }

            .clock {
                --_ui-clock-drift: 1.2em;
                --_ui-clock-drift-dur: 240s;

                animation: ui-screensaver-drift var(--_ui-clock-drift-dur) linear infinite alternate;
            }

            /* A USER WHO ASKED FOR LESS MOTION GETS THE CENTRE, not an animation
             * stopped part-way up. CONVENTIONS §11: the base carries no
             * reduced-motion rule and says it belongs in each animating component.
             *
             * THE PANEL COST IS STATED RATHER THAN HIDDEN: holding the clock still
             * gives back the burn-in mitigation the drift exists for. That is the
             * correct trade - a movement preference is a person telling you what
             * they need, and a screen mark is a risk to a device - but it is a trade
             * and not a free choice, so a reader can see it here. */
            @media (prefers-reduced-motion: reduce) {
                .clock {
                    animation: none;
                    transform: translateY(0);
                }
            }
        `,
    ];

    constructor() {
        super();
        this.enabled = true;
        this.brightnessSupported = false;
        this.active = false;
        this.displayAction = DISPLAY_ACTION.NONE;
        this.anchor = 'viewport';
        this.label = '';
        this.graceMs = WAKE_CONFIRM_GRACE_MS;
        this.clock = false;
        /* THE EMPTY STRING IS "NO PICTURE", which the property's own doc says and the
         * constructor did not. It mattered the day `#applyDisplay` started asking which
         * saver is showing: an uninitialised `image` is `undefined`, and every honest test
         * for "no picture" then has to spell out both spellings. One initialiser is
         * cheaper than that, and it matches `clock` two lines up. */
        this.image = '';
        this.language = '';
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this._time = '';

        /* Per-instance so a screen can inject a clock; the port takes `now` for the same
         * reason. Never a timer this component owns beyond the one grace timeout. */
        this.now = () => Date.now();

        /* Language changes re-render the press target's name. Same controller every
         * component uses; querySelectorAll cannot cross a shadow boundary. */
        this.i18n = new I18nController(this);
    }

    /**
     * `undefined` = no frame has arrived yet, which is the port's BOOT case and is
     * different from an absence (a frame we saw that carried no state). Left uninitialised
     * on purpose: an initialised field would appear in the first `changedProperties` and
     * turn every mount into a transition.
     */
    #previousState;

    /** `Date.now()` when we emitted a wake; 0 = none. The port's bounded suppression. */
    #wakeRequestedAt = 0;

    /**
     * A DIM this sleep episode has earned and not yet spent.
     *
     * Not the same thing as `displayAction === 'dim'`, and the difference is a real bug:
     * `displayAction` is a record of the last TRANSITION and survives until the next one,
     * so a blank that comes back after an unconfirmed wake — same sleep, no transition —
     * would read it and dim a panel that was never restored. Set on the transition,
     * spent when the command actually goes out.
     */
    #dimPending = false;

    /** The one timeout: re-derive when the grace expires, so the blank can come back. */
    #graceTimer = null;

    /** The nodes `#watchLayer()` is currently listening on; empty when the blank is down. */
    #watching = [];

    /** True while THIS element is driving its own popover, so its own events are ignored. */
    #reentering = false;

    /* ---- the layer --------------------------------------------------------- */

    get #viewportAnchored() {
        return this.anchor !== 'container';
    }

    /**
     * D10 ACROSS A RE-PARENT, which is the half `disconnectedCallback` cannot do alone.
     *
     * Disconnecting releases the slot and deliberately leaves `active` alone (see
     * below), so an element that is moved rather than destroyed comes back still
     * painting a full-screen blank it no longer owns — and the next claimant is then
     * granted the empty slot and raises beside it. Two blankers, reached by an ordinary
     * `appendChild`, which is precisely the state D10 says is inexpressible.
     *
     * So the claim is RE-MADE here, on the same terms `#raise()` makes it:
     *
     *   * slot free (the usual move — remove and append run back to back) -> keep the
     *     blank, and re-enter the top layer, because a removed popover loses
     *     `:popover-open` and `updated()` will not fire for a property that did not
     *     change;
     *   * slot taken by someone else while this one was detached -> put the blank DOWN,
     *     the same refusal `#raise()` makes, rather than paint over the element that
     *     legitimately holds it.
     *
     * Neither branch announces anything, and since 29 August 2026 (audit F-013) neither
     * does any other paint change. A successful re-claim was ALWAYS silent, for a reason
     * worth keeping in view: the paint never changed, and an event for a transition that
     * did not happen is a screen's cue to act on nothing.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.active) return;
        if (this.#viewportAnchored && !claimBlank(this)) {
            this.#lower();
            return;
        }
        this.#syncLayer();
    }

    disconnectedCallback() {
        /* Ownership is released even though `active` is left alone: a disconnected
         * element is not blanking anything, and holding the slot would stop the screen's
         * next screensaver from ever taking it. `active` survives because the machine is
         * still asleep and a move is not a wake — `connectedCallback` above is what
         * makes that safe. */
        releaseBlank(this);
        this.#clearGrace();
        /* A DISCONNECTED ELEMENT PAINTS NOTHING, so its timer is waste — and this one is
         * an interval, which outlives the tree it was started in. `connectedCallback`'s
         * own re-claim does not restart it; the next `updated()` does, which is the same
         * edge that started it in the first place. */
        this.#stopClock();
        /* The listener roots go with the tree: a re-parent changes getRootNode(), and
         * connectedCallback's #syncLayer() re-takes them on the way back in. */
        this.#unwatchLayer();
        super.disconnectedCallback();
    }

    /* ---- the policy, once per update --------------------------------------- */

    willUpdate(changed) {
        if (changed.has('machineState')) {
            /* THE TRANSITION, and only on a real change. The snapshot feed repeats the
             * same state at ~10 Hz; the port is transition-only by design because
             * re-dimming on every frame would clobber a brightness the user just chose. */
            this.displayAction = deriveDisplayAction(this.#previousState, this.machineState);
            this.#previousState = this.machineState;
            this.#dimPending = this.displayAction === DISPLAY_ACTION.DIM;
        }
        this.#applyScreensaverAction();
        /* The panel half, after the overlay half, so the two always leave in that order
         * and a listener sees the blank before the command that follows it. Outside
         * `#raise()` on purpose: the capability can arrive on a LATER display frame than
         * the sleeping machine snapshot, and a dim that was earned is not lost because
         * two sockets delivered out of order. */
        if (this.active) this.#applyDisplay();
    }

    updated(changed) {
        if (changed.has('active') || changed.has('anchor')) this.#syncLayer();
        /* THE CLOCK'S TIMER FOLLOWS THE PAINT, and it is re-evaluated on every update
         * rather than only on a change to `active`: switching the option off while the
         * blank is up must stop the timer, and `clock` is the property that moved. */
        if (changed.has('active') || changed.has('clock')
            || changed.has('language') || changed.has('clockFormat')) this.#syncClock();
    }

    /**
     * The port decides; this applies. Three outcomes and none of them is a command.
     */
    #applyScreensaverAction() {
        const action = deriveScreensaverAction({
            machineState: this.machineState,
            screensaverActive: this.active,
            screensaverEnabled: this.enabled,
            wakePending: isWakePending(this.#wakeRequestedAt, this.now(), this.graceMs),
        });

        if (action === SCREENSAVER_ACTION.SHOW) this.#raise();
        else if (action === SCREENSAVER_ACTION.HIDE) this.#lower();
        /* NONE is the commonest answer by far and is exactly what it says: leave the
         * paint alone. It is also what a pending wake returns, which is what stops the
         * overlay flashing back into the user's face for the 100-300 ms the PUT takes. */
    }

    /**
     * Take the blank — if this element is entitled to it.
     *
     * D10's two halves are both here: the owner slot, and the overlay and the panel
     * leaving from the same branch so they can never disagree.
     */
    #raise() {
        if (this.#viewportAnchored && !claimBlank(this)) {
            /* Refused. `active` is left alone, so the refusal is READABLE on the element
             * — it is not painting, and `blankingOwner()` names the one that is. It used
             * to be announced as well; see `#lower` for why it no longer is. */
            return;
        }
        this.active = true;
    }

    /**
     * Put the blank down. A PAINT — never a command, whatever brought us here.
     *
     * THE `ui-screensaver-blank` REPORT WAS RETIRED 29 AUGUST 2026, audit F-013 — from
     * here, from `#raise()`, and from the `SCREENSAVER_EVENT` table. All three emits
     * went together, because two of the three are the same fact in opposite directions
     * and removing one would have left the vocabulary lopsided.
     *
     * THE COMPOSING SHELL HAD ALREADY RULED ON IT, IN WRITING. `app-root.js`'s
     * `render()`, beside the two bindings it does make: "The element emits three events
     * and exactly two of them ask the shell for anything: the WAKE, and the DIM. […]
     * The third, `-blank`, is a report that the paint changed and nothing here needs to
     * act on it." That note was written on 26 August 2026 by the same pass that found
     * `@ui-screensaver-dim` MISSING and fixed it — so this is a considered decline
     * sitting next to a genuine omission that was repaired, not an oversight of the
     * same kind. The gate found the emit three days later; the answer was already
     * there.
     *
     * WHAT THE REPORT CLAIMED TO BE FOR, and where each claim actually landed:
     *   * "so a screen can pause a chart" — no screen does, and none can be given one
     *     tonight without a cross-screen wire this fix has no remit for. If that is
     *     ever built it brings its listener with it, which is the whole point of the
     *     gate that found this.
     *   * "so 'the blank was refused' is visible rather than silent" — D10's refusal is
     *     visible without it: the refused element never sets `active`, so it paints
     *     nothing, and `blankingOwner()` is an exported getter naming the element that
     *     legitimately holds the slot. In the product the question cannot arise at all:
     *     `app-root.js` hoists exactly ONE `<ui-screensaver>` above its three bodies,
     *     precisely so there is only ever one.
     *
     * `BLANK_REASON` WENT WITH IT for the same reason the toast's dismissal reason did
     * (audit F-014, same night): it was threaded into four call sites for the sole
     * purpose of riding in that detail, and nothing ever branched on it. Each call site
     * still says why in the code around it — the `HIDE` action, the press on an awake
     * machine, `decision.hideScreensaver`, the failed `claimBlank`.
     */
    #lower() {
        this.active = false;
        releaseBlank(this);
    }

    /**
     * The panel half of the blank. Q13 lives in the shape of this function.
     *
     * DIM goes out. RESTORE does not, and there is nowhere here to make it: the
     * vocabulary has no restore. `displayAction` still carries it, so the reversal has
     * evidence to read.
     *
     * Gated on `#dimPending`, so a blank that comes back after an unconfirmed wake does
     * not dim a panel that was never restored: one dim per entry into sleep, and asking
     * for the same brightness twice is a command the machine did not need.
     *
     * The capability is checked BEFORE the dim is spent, so a display feed that arrives
     * late still gets its dim — an absent capability is a "not yet", never a "no".
     *
     * ONLY THE BLACK SAVER DIMS, AND THAT IS THE 26 AUGUST REVERSAL OF D10 ARRIVING HERE.
     *
     * D10 said the saver is fully black, so `SCREENSAVER_BRIGHTNESS` is 0 and this function
     * sent it unconditionally — which was correct for as long as black was the only saver
     * there was. Ben reversed that on 26 August 2026 ("Row 2 should be the screen saver
     * type: Black, Image or Clock"), the image list came back in `storage-routes.js`, and
     * this function was not revisited. The moment the shell actually BOUND the dim, an
     * Image saver would have painted a JPEG onto a panel at zero brightness and a Clock
     * saver a faint clock onto the same — both invisible, both drawn, both costing the
     * panel exactly what a lit screen costs.
     *
     * BLACK STILL SENDS 0, and `SCREENSAVER_BRIGHTNESS`'s own note now carries the proof
     * that 0 is not merely the tidy choice but the only safe one: any non-zero level is
     * recorded by ReaPrime as the pre-sleep brightness on its very next snapshot
     * (`display_controller.dart:277-285`), which destroys the level the user actually chose
     * AND leaves `requestedBrightness != 0` so the restore never fires. Both halves of the
     * wake edge die together.
     *
     * IMAGE AND CLOCK SEND NOTHING AT ALL — not a smaller number, for that same reason and
     * for A7's: a partial dim would need a RESTORE to come back from, and this component
     * deliberately has no restore and no remembered pre-sleep brightness (the Q13 section
     * above). So the panel is left exactly where the user put it.
     *
     * WHAT THAT COSTS, stated rather than assumed, because "send nothing" is not free: a
     * tablet asleep in Image or Clock mode holds the user's daytime brightness all night.
     * The panel is lit for as long as the machine sleeps, which is the trade Ben made when
     * he chose a saver that shows something — the row's own caption says so ("A fully black
     * screen is the kindest to the panel"), and the clock's drift animation is this
     * component's other answer to the same risk. The alternative is not a dimmer picture,
     * it is a destroyed brightness setting.
     *
     * THE GATE READS THE PAINT, NOT THE PREFERENCE, and that is deliberate: the honest
     * question is "would this dim make something invisible", and the two properties below
     * are what is actually on screen. It also makes the dim self-correcting when the type
     * arrives late — the dim is EARNED on the sleep edge and `#dimPending` holds it until a
     * saver can use it, so a stored `black` landing after the decided `image` still spends
     * it (pinned by the switching test).
     *
     * THE RESIDUAL IS THE OTHER DIRECTION AND IT IS NOT REACHABLE TODAY. If the dim has
     * already been spent and the saver then becomes something visible mid-sleep, the panel
     * is at 0 under a picture and nothing here raises it — there is no restore to raise it
     * with. That needs the DECIDED default to be `black` and a stored value of `image` to
     * arrive afterwards; the decided default is `image` (`settings-defaults.js`), so the
     * transition cannot happen. It is written down because the thing that makes it
     * unreachable is a value in another file, and a value in another file can change.
     */
    #applyDisplay() {
        if (!this.#dimPending) return;
        if (this.brightnessSupported !== true) return;
        const showsSomething = this.clock === true
            || (typeof this.image === 'string' && this.image !== '');
        if (showsSomething) return;
        this.#dimPending = false;
        this.#emit(SCREENSAVER_EVENT.DIM, { brightness: SCREENSAVER_BRIGHTNESS });
    }

    /* ---- the one user gesture ---------------------------------------------- */

    /**
     * A press on the blank.
     *
     * On a CONFIRMED sleeping machine this is one of exactly two wakes in the skin (the
     * other is the header's sleep button), and the command name comes from the port.
     * On anything else it is paint only — an overlay coming down is not a user asking
     * for a machine state, which is the rule the 46 ms race broke.
     */
    /* ═══════════════════════════════════════════════════════════════════════
     * THE CLOCK'S ONE TIMER
     * ═══════════════════════════════════════════════════════════════════════
     *
     * IT RUNS ONLY WHILE THE BLANK IS UP AND THE OPTION IS ON. A screensaver that ticked
     * on an awake machine would be a timer running for the life of the app to paint
     * something nobody is looking at — and this element is mounted by the SHELL, so it is
     * never torn down by a route change. The two conditions are re-evaluated on every
     * update, so switching the option off stops the timer rather than leaving it running
     * against a hidden element.
     *
     * THE TICK IS A SECOND AND THE READING IS A MINUTE, which is `live-screen.js`'s own
     * reasoning carried over: a minute-long interval shows the wrong minute for up to 59
     * seconds of every one, and re-arming to the boundary would be two mechanisms where
     * one will do. `_time` is written only when the SPELLING moves, so the element
     * re-renders once a minute and not sixty times.
     */
    #clockTimer = null;

    #syncClock() {
        const wanted = this.active && this.clock === true;
        if (!wanted) {
            this.#stopClock();
            /* CLEARED, NOT LEFT BEHIND. A stale time painted the moment the blank comes
             * back up is a clock that is wrong for exactly as long as the first tick
             * takes — the one second a person is most likely to be looking at it. */
            if (this._time !== '') this._time = '';
            return;
        }
        this.#readClock();
        if (this.#clockTimer !== null) return;
        this.#clockTimer = setInterval(() => this.#readClock(), CLOCK_TICK_MS);
    }

    #readClock() {
        const next = wallClock(new Date(this.now()), this.language, this.clockFormat);
        if (next !== this._time) this._time = next;
    }

    #stopClock() {
        if (this.#clockTimer === null) return;
        clearInterval(this.#clockTimer);
        this.#clockTimer = null;
    }

    #onPress() {
        if (!isMachineAsleep(this.machineState)) {
            this.#lower();
            return;
        }

        const decision = deriveSleepButtonAction({
            machineState: this.machineState,
            screensaverActive: this.active,
        });

        /* Set BEFORE the paint, so the re-derive that `active` triggers already sees the
         * wake in flight and answers NONE instead of raising the overlay again. */
        this.#wakeRequestedAt = this.now();
        this.#scheduleGrace();

        if (decision.hideScreensaver) this.#lower();
        this.#emit(SCREENSAVER_EVENT.WAKE, {
            state: decision.command,
            requestedAt: this.#wakeRequestedAt,
        });
    }

    /**
     * The suppression is time-bounded, so something has to come back and look.
     *
     * Without this the overlay would stay down after a lost or refused wake until some
     * other input changed, and the snapshot feed repeating `sleeping` at 10 Hz is not a
     * change Lit can see. One timeout, cleared on disconnect and replaced on each press.
     */
    #scheduleGrace() {
        this.#clearGrace();
        this.#graceTimer = setTimeout(() => {
            this.#graceTimer = null;
            this.#wakeRequestedAt = 0;
            this.requestUpdate();
        }, this.graceMs);
    }

    #clearGrace() {
        if (this.#graceTimer !== null) {
            clearTimeout(this.#graceTimer);
            this.#graceTimer = null;
        }
    }

    /* ---- plumbing ---------------------------------------------------------- */

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: Object.freeze(detail),
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * Into the top layer, or out of it.
     *
     * Re-entered on every raise rather than once at connect: the top layer is ordered by
     * ENTRY, so a box promoted at mount sits BELOW a dialog that opened afterwards.
     * Entering it at the moment the machine confirms sleep is what puts the blank above
     * whatever is on screen then. See the header for what this does NOT buy.
     */
    #syncLayer() {
        if (!SUPPORTS_POPOVER || !this.isConnected) {
            this.#unwatchLayer();
            return;
        }

        if (!this.#viewportAnchored) {
            this.#unwatchLayer();
            if (this.hasAttribute('popover')) {
                if (this.matches(':popover-open')) this.hidePopover();
                this.removeAttribute('popover');
            }
            return;
        }

        if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
        this.#enterTopLayer();
        if (this.active) this.#watchLayer(); else this.#unwatchLayer();
    }

    /**
     * Leave and re-enter, which is how a box gets to the TOP of an entry-ordered layer.
     *
     * `#reentering` is up for the whole of it: `hidePopover()` and `showPopover()` each
     * fire `beforetoggle` on this element SYNCHRONOUSLY, and `#onForeignToggle()` would
     * otherwise answer its own event and schedule another pass forever.
     */
    #enterTopLayer() {
        this.#reentering = true;
        try {
            if (this.matches(':popover-open')) this.hidePopover();
            if (this.active) this.showPopover();
        } catch {
            /* An element mid-removal, or one whose popover state the page is driving
             * itself. The blank still paints on --ui-z-blackout; only the layer is lost,
             * and a throw here would take the blank with it. */
        } finally {
            this.#reentering = false;
        }
    }

    /**
     * HOLD THE TOP OF THE TOP LAYER while the blank is up — the wave-5.2 repair described
     * in the header.
     *
     * `beforetoggle`, not `toggle`, and a microtask rather than a callback: `beforetoggle`
     * is dispatched SYNCHRONOUSLY, before the other element enters, so a microtask queued
     * from it runs after `showPopover()`/`showModal()` returns — with the other element
     * already in the layer — and microtasks are drained before the next rendering
     * opportunity. So the order is repaired with no frame in between. `toggle` is queued
     * as a task and would let one frame of a notice paint on a black screen.
     *
     * BOTH ROOTS, because `beforetoggle` is `composed: false` and stops at the root of the
     * tree it was fired in: `document` catches the page's own overlays, `getRootNode()`
     * catches siblings when a screen puts the blank inside its own shadow root. They are
     * the same node in the common case and the set is de-duplicated.
     *
     * AND `open-change`, which is the library's own announcement and the only thing that
     * crosses a shadow boundary. MEASURED: `ui-dialog`'s `showModal()` runs on the native
     * `<dialog>` INSIDE #18's shadow root, so its `beforetoggle` never leaves that root and
     * a document listener sees nothing — a dialog opened over a blank painted 385,308
     * non-black pixels with the `beforetoggle` half alone. THE SAME IS TRUE OF #22 the
     * moment a screen mounts its toast in its own shadow template: 24,031 non-black pixels,
     * finding c-surfaces-1. #18, #21 and #22 all dispatch
     * `open-change` `{open, reason}` `bubbles: true, composed: true`, AFTER the surface is
     * in the layer (`ui-dialog.js:783-804` — `#present()` first, the event second;
     * `ui-toast.js` `#syncLayer()` — `showPopover()` first, the event second), so the
     * same microtask repair works. This element does not know or care WHICH component
     * announced: the contract it consumes is "a library surface says it opened".
     */
    #watchLayer() {
        const roots = [document, this.getRootNode()].filter(
            (node, i, all) => node && typeof node.addEventListener === 'function' && all.indexOf(node) === i,
        );
        if (roots.length === this.#watching.length && roots.every((r, i) => r === this.#watching[i])) return;

        this.#unwatchLayer();
        for (const root of roots) {
            for (const type of LAYER_ENTRY_EVENTS) root.addEventListener(type, this.#onForeignToggle, true);
        }
        this.#watching = roots;
    }

    #unwatchLayer() {
        for (const root of this.#watching) {
            for (const type of LAYER_ENTRY_EVENTS) root.removeEventListener(type, this.#onForeignToggle, true);
        }
        this.#watching = [];
    }

    /**
     * Another element is about to enter the top layer. Re-enter after it.
     *
     * An arrow field so the same reference removes, and so `this` is the element on a
     * capture listener that fires for a target somewhere else entirely.
     */
    #onForeignToggle = (event) => {
        if (this.#reentering || !this.active || !this.#viewportAnchored) return;
        if (event.target === this) return;
        const opening = event.type === 'open-change'
            ? event.detail?.open === true
            : event.newState === 'open';
        if (!opening) return;
        queueMicrotask(() => {
            if (!this.isConnected || !this.active || !this.#viewportAnchored) return;
            if (!this.matches(':popover-open')) return;
            this.#enterTopLayer();
        });
    };

    render() {
        /* ONE PRESS TARGET, and it is a real button: the whole screen is the wake
         * affordance, so the whole screen must be reachable from a keyboard and must
         * announce what pressing it does. Slate binds `click` on a bare div
         * (ui.js:1431) — no name, no role, no keyboard.
         *
         * The name is visually hidden rather than absent: "fully black" is D10, and a
         * screen-reader name costs no pixels (CONVENTIONS §5a — one treatment, never a
         * fourth copy). */
        return html`
            <button
                id="blank"
                class="blank"
                type="button"
                @click=${this.#onPress}
            ><span class="a11y">${this.label || this.i18n.t(WAKE_LABEL_KEY)}</span
            >${this.image
                    ? html`<img id="saver-image" class="saver-image" src=${this.image} alt="">`
                    : nothing}${this.clock && this._time
                    ? html`<span id="clock" class="clock" aria-hidden="true">${this._time}</span>`
                    : nothing}</button>
        `;
    }
}

customElements.define('ui-screensaver', UiScreensaver);

/* ------------------------------------------------- the store seam (Gate 2) */

/**
 * The picture that ships with the skin.
 *
 * Slate does the same and says why in its own comment (O15): the empty state SHOWS what
 * the saver is currently using instead of describing it. An image saver with no chosen
 * pictures is therefore a picture, not a black screen with a sentence about pictures.
 *
 * A PATH, NOT A DATA URL. It is 30 KB of JPEG; inlining it would put those 30 KB into
 * every parse of this module whether the saver is ever shown or not.
 */
export const SCREENSAVER_DEFAULT_IMAGE = 'src/assets/screensaver-default.jpg';

/**
 * How long a picture stays up when nothing has said. Ben's own default, in minutes.
 *
 * READ FROM THE DECISION TABLE, NOT STATED A SECOND TIME HERE — the move `wall-clock.js`
 * made for `DEFAULT_CLOCK_FORMAT` on 26 August 2026, and for the same reason. This line
 * used to be a literal `10`, which happened to agree with `settings-defaults.js`'s
 * `screensaverCycleMinutes: 10`; two copies of one number that agree today are a
 * disagreement waiting for whichever one gets changed, and B7's "one store per setting"
 * covers the value a setting reads before anyone has set it just as much as it covers
 * where the chosen value is written. The stepper on Settings > Display > Screen saver
 * draws its default through `settings.value('screensaverCycleMinutes')`; this is the same
 * question, so it gets the same answer from the same table.
 *
 * THE GUARD IN `setCycle` STAYS, and it is not the same thing as the default. A key that
 * nobody has set resolves through the table; a key holding a STORED value that is not a
 * positive finite number — a hand-edited localStorage entry, a value written by an older
 * build — still has to land somewhere, and it lands here.
 */
const DEFAULT_CYCLE_MINUTES = defaultFor('screensaverCycleMinutes');

/**
 * The slideshow: one image on the host at a time, and one timer at most.
 *
 * THREE INPUTS ARRIVE INDEPENDENTLY — the mode, the list and the interval — each on its
 * own subscription, each able to fire at any moment and in any order. Everything below
 * exists to make that safe: every setter writes its field and then re-runs ONE function
 * that decides what should be showing and whether a timer should be running. There is no
 * path that starts a second interval, and none that leaves one running after the mode
 * goes back to black.
 *
 * @param {HTMLElement} host  the `<ui-screensaver>`
 */
function createSlideshow(host) {
    let mode = false;
    let images = [];
    let minutes = DEFAULT_CYCLE_MINUTES;
    let index = 0;
    let timer = 0;

    const shown = () => (images.length > 0 ? images : [SCREENSAVER_DEFAULT_IMAGE]);

    const paint = () => {
        const list = shown();
        if (index >= list.length) index = 0;
        host.image = mode ? (list[index] ?? '') : '';
    };

    const apply = () => {
        if (timer) { clearInterval(timer); timer = 0; }
        paint();
        /* NO TIMER FOR ONE PICTURE. A cycle over a list of one is a repaint that changes
         * nothing, once every ten minutes, for as long as the tablet is asleep. */
        if (!mode || shown().length < 2) return;
        timer = setInterval(() => {
            index = (index + 1) % shown().length;
            paint();
        }, Math.max(1, minutes) * 60_000);
    };

    return {
        setMode(next) { mode = next === true; apply(); },
        setImages(next) { images = Array.isArray(next) ? next : []; index = 0; apply(); },
        /* NAMED `setCycle`, NOT `setInterval`. The lexical scope inside `apply` reaches
         * the global timer function and not this object, so the two never collide — but a
         * reader should not have to work that out to be sure. */
        setCycle(next) { minutes = Number.isFinite(next) && next > 0 ? next : DEFAULT_CYCLE_MINUTES; apply(); },
        stop() { if (timer) { clearInterval(timer); timer = 0; } host.image = ''; },
    };
}


/**
 * Feed a `<ui-screensaver>` from the live stores.
 *
 * This is the supported wiring, and it is what keeps the compound on the address layer
 * without giving it a transport: it subscribes to two `src/stores/` feeds and copies
 * their ALREADY-READ values onto two properties. It never fetches, never opens a socket,
 * and never touches a route.
 *
 *     import { createLiveStores, FEED } from 'src/stores/live-stores.js';
 *     const detach = attachScreensaver(el, {
 *         machine: stores.feed(FEED.MACHINE),
 *         display: stores.feed(FEED.DISPLAY),
 *     });
 *
 * Both feeds are optional and independent: a screen with no display feed simply never
 * reports a brightness capability, and the blank is then the overlay alone.
 *
 * ABSENCES TRAVEL WHOLE. `state.value` is `null` until the first frame — that is the
 * port's BOOT case and it must arrive as `undefined`, not as a string. After a frame,
 * `value.state` may be a `noReading`; it is passed through untouched, because the port
 * has a defined answer for it and coercing it here would be the fallback A7 forbids.
 *
 * @param {{machineState: unknown, brightnessSupported: boolean}} host
 * @param {{machine?: {subscribe: Function}, display?: {subscribe: Function}}} feeds
 * @returns {() => void} detach — unsubscribes both.
 */
export function attachScreensaver(host, { machine = null, display = null, settings = null } = {}) {
    if (!host) throw new Error('attachScreensaver: an element is required');
    const offs = [];

    if (machine) {
        offs.push(machine.subscribe((state) => {
            host.machineState = state && state.value ? state.value.state : undefined;
        }));
    }

    /* THE THREE PREFERENCES, AND TWO OF THEM WERE DEAD (24 Aug 2026).
     *
     * This file's own header said "`attachScreensaver` fills both from the feeds when a
     * boot arrives", and it filled `machineState` and `brightnessSupported` — never
     * `enabled`. So `screensaverEnabled` had a switch on the Screen Saver page, a row in
     * the routing table and a store behind it, and the value reached nothing: the blank
     * went up on a sleeping machine whether or not the user had turned it off. A finished
     * half with no other half, in the same element as the one Ben found.
     *
     * `screensaverType` arrives with the saver and is fed here from the start, which is
     * the whole reason the other one is worth fixing in the same change: a second
     * preference wired the same wrong way would have been the third.
     *
     * `language` IS NOT A SCREENSAVER SETTING and is read for the same reason the Live
     * header reads it — the time is spelled in the skin's language, never the browser's.
     *
     * AN ABSENT KEY IS `undefined`, WHICH IS NOT `false`. `enabled` defaults ON, so an
     * absence must leave it on rather than blank-disable the feature for anyone who has
     * never opened the page; `clock` defaults OFF, so an absence leaves it off. Each
     * strict compare states its own default rather than sharing one. */
    /* THE SLIDESHOW LIVES HERE AND NOT IN THE ELEMENT, for the reason the `image`
     * property states: which picture is showing, and when it changes, is a decision over
     * a stored list and a stored interval, and the element paints what it is given.
     *
     * ONE TIMER, AND ONLY WHILE THERE IS SOMETHING TO CYCLE. A single image never starts
     * one; a saver in Black or Clock mode never starts one; and every change of mode,
     * list or interval restarts it from a clean state rather than leaving a second
     * interval running beside the first. That last part is the actual bug this shape
     * avoids — three independent subscriptions, each able to fire at any time.
     *
     * THE BUNDLED DEFAULT is what shows when the user has chosen nothing, which is Slate's
     * own behaviour ("Using the built-in image. Choose your own to replace it.") and is
     * why an empty list is not an empty screen. */
    const slides = createSlideshow(host);

    if (settings) {
        /* A PARTIAL STORE FAILS LOUDLY, because the way it used to fail was by painting a
         * black screen. `decided()` below needs three methods and the old guard checked
         * one; a double carrying only `subscribe` would have gone on working, silently,
         * with every saver preference back at whatever a missing value coerces to. That is
         * the exact failure this whole block is a fix for, so it is the one failure this
         * function must not be able to reach quietly. */
        for (const method of ['subscribe', 'value', 'load']) {
            if (typeof settings[method] !== 'function') {
                throw new Error(
                    `attachScreensaver: the settings store must provide ${method}() — `
                    + 'the saver reads its preferences through the store\'s own '
                    + 'default-resolving reader, and a partial store would paint the Black '
                    + 'saver on a tablet whose decided type is Image.',
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════
         * THE DECIDED DEFAULT HAS TO BE ASKED FOR, AND THIS FILE DID NOT ASK
         * ═══════════════════════════════════════════════════════════════════════
         *
         * FOUND ON BEN'S BENCH TABLET, 28 August 2026, against Decal 0.1.41. He asked
         * for "the screen saver bug" and the panel was fully black while the device was
         * awake — `mWakefulness=Awake`, the app focused, `adb exec-out screencap` returning
         * 2,304,000 pixels of which ZERO were non-black. A tap cleared it to Live, normally.
         *
         * WHAT THE LIVE PAGE SAID, read over CDP through the WebView's devtools socket
         * while that black screen was up:
         *
         *     <ui-screensaver>   active: true   machineState: 'sleeping'
         *                        clock: false   image: ''        <- painting nothing
         *                        brightnessSupported: true       displayAction: 'dim'
         *     ReaPrime /ws/v1/display   brightness: 0   requestedBrightness: 0
         *     settings.value('screensaverType')       -> 'image'
         *     settings.storedValue('screensaverType') -> undefined
         *
         * So the Settings page drew Image selected — `settings-bespoke-leaf.js` reads
         * `settings?.value?.('screensaverType')`, which resolves the decided default — and
         * the saver painted Black and spent the Black saver's dim to 0 underneath it. One
         * preference, two readers, opposite answers, and the losing reader is the one that
         * owns the screen. A control whose displayed value is not the value that runs is
         * this fork's own defect class, arriving through the door nobody had checked.
         *
         * THE MISTAKE WAS IN THE COMMENT THAT USED TO BE HERE, and it is worth quoting
         * because it read as a citation: "AN UNKNOWN OR ABSENT TYPE IS THE DECIDED DEFAULT
         * (settings-defaults.js, Ben's 'Screen saver type: image'), and the settings store
         * resolves that for us — a subscriber sees the default, not undefined." The second
         * clause is FALSE and the store says so in as many words:
         *
         *     value(key)       -> stored, else `defaultFor(key)`   (settings-store.js:250-271)
         *     storedValue(key) -> stored, and nothing else                            (:274)
         *     subscribe(key,f) -> `cell(key).subscribe(...)` — the STORED value        (:284)
         *
         * `defaultFor` is called in exactly one place in that file, and it is not
         * `subscribe`. There is no subscribe-shaped reader of the resolved value at all,
         * which is why this is a trap rather than a typo: the asymmetry is invisible from
         * the call site and the wrong half is the one whose name looks neutral.
         *
         * IT WAS ALREADY KNOWN, ONE KEY OVER. `wall-clock.js:70-71` writes down this exact
         * mechanism — "`ui-screensaver.js` subscribes to the settings store, whose
         * `subscribe` publishes the STORED value only and never `defaultFor`, so an
         * unwritten key arrives as `undefined`" — and fixes it for `clockFormat` alone, by
         * importing `defaultFor('clockFormat')`. The same subscription list, two lines
         * apart, kept five other keys on the broken side. A fix applied to the key that was
         * noticed is not a fix applied to the mechanism.
         *
         * THE REPAIR IS TO ASK THE RIGHT READER, not to hold a second copy of the answer.
         * `settings.value(key)` IS the store's "stored, else the decision Ben made", so
         * routing every subscription through it makes the saver and the Settings page read
         * the same number from the same table by construction. B7 is intact: nothing here
         * names a default, and `settings-defaults.js` is still the one place any of them
         * lives.
         *
         * RE-READING INSIDE THE CALLBACK IS NOT A RACE, and that is a property of the cell
         * rather than of luck: `store.js`'s `set()` assigns `state` and THEN calls
         * `publish()`, so a subscriber running is a subscriber running after the write it
         * was told about. `settings.value(key)` therefore sees the value that caused the
         * notification, never the one before it. The pushed argument is ignored on purpose —
         * taking it would be taking the unresolved half again.
         *
         * WHAT THIS CHANGES ON A TABLET NOBODY HAS TOUCHED, which is every tablet until
         * somebody opens the page: the saver becomes Image (the bundled picture), the panel
         * is no longer driven to 0 under it, the clock is spelled in 'en' rather than in the
         * empty string, and the slideshow cycles at Ben's ten minutes. All four were already
         * decided; none of them had ever run. */
        const decided = (key, apply) => {
            offs.push(settings.subscribe(key, () => apply(settings.value(key))));
        };

        decided('screensaverEnabled', (value) => {
            /* STILL A STRICT COMPARE AGAINST `false`, and it is no longer carrying the
             * default on its own. `value()` hands back Ben's `true` for a key nobody has
             * set, so this line now only has to recognise the one stored value that means
             * off — which is all a coercion should ever do. */
            host.enabled = value !== false;
        });

        /* THE TYPE PICKS THE PAINT, and the two properties it sets are the two the
         * element already had. `black` sets neither, which is what it means. */
        decided('screensaverType', (value) => {
            host.clock = value === 'clock';
            slides.setMode(value === 'image');
        });

        /* NO ROW IN `settings-defaults.js`, AND THAT IS CORRECT rather than an omission:
         * the pictures are the user's own files and there is no picture to decide on their
         * behalf. `value()` answers `undefined` for a key with no decided default, the
         * empty list follows, and `shown()` falls to the ONE bundled image — which is where
         * the "there is always something to paint" promise actually lives. */
        decided('screensaverImages', (value) => {
            slides.setImages(Array.isArray(value) ? value : []);
        });

        decided('screensaverCycleMinutes', (value) => {
            slides.setCycle(Number.isFinite(value) && value > 0 ? value : null);
        });
        offs.push(() => slides.stop());

        /* THE EMPTY STRING IS NO LONGER REACHABLE FROM AN UNSET KEY, and it was never a
         * good value to reach: `wallClock` passes the language straight to `Intl`, and ''
         * is not a locale — it is the argument that makes Intl fall back to the BROWSER's,
         * which is the second answer to a question the user has already been asked. Ben's
         * `language: 'en'` now arrives instead. The guard stays for a stored non-string. */
        decided('language', (value) => {
            host.language = typeof value === 'string' ? value : '';
        });

        decided('clockFormat', (value) => {
            /* AN UNKNOWN VALUE IS THE SHIPPED DEFAULT, and a KNOWN one is itself — which
             * this line got wrong for as long as the shipped default happened to be the
             * else-branch. It read `value === H12 ? H12 : DEFAULT_CLOCK_FORMAT`, so when the
             * default became Ben's 12-hour on 26 August an explicitly chosen '24h' was
             * coerced back to 12-hour and this clock could never draw 24-hour again. The
             * known set is named once now, in `wall-clock.js`, where the two readers share
             * it.
             *
             * IT IS THE ONE KEY THAT WAS ALREADY RIGHT before `decided()` existed, because
             * `normaliseClockFormat` reaches `defaultFor` itself. Routed through the same
             * helper anyway: six keys read one way is a rule, five plus a special case is a
             * thing to remember. */
            host.clockFormat = normaliseClockFormat(value);
        });

        /* SUBSCRIBING PUBLISHES WHAT IS HELD, AND NOTHING IS HELD UNTIL A READ. The
         * settings store's `subscribe` fires immediately with the cell's current value,
         * which is `undefined` for a key nobody has loaded — so without these, a tablet
         * with a STORED answer would sit on the decided default for ever.
         *
         * The two halves are complementary and both are needed: `decided()` makes the
         * first, synchronous delivery correct for a key with nothing stored, and these
         * reads are what make a stored value arrive at all. */
        for (const key of [
            'screensaverEnabled', 'screensaverType', 'screensaverImages',
            'screensaverCycleMinutes', 'language', 'clockFormat',
        ]) {
            Promise.resolve(settings.load(key)).catch(() => {});
        }
    }

    if (display) {
        offs.push(display.subscribe((state) => {
            /* `readFlag` answers `true`, `false`, or a `noReading`. Only `true` is a
             * capability; the strict compare is the whole check, and there is no `??`
             * turning an absence into a default. */
            const platform = state && state.value ? state.value.platformSupported : null;
            host.brightnessSupported = !!platform && platform.brightness === true;
        }));
    }

    return () => {
        for (const off of offs) off();
        offs.length = 0;
    };
}
