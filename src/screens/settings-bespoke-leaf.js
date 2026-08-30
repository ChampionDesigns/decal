/**
 * settings-bespoke-leaf.js — <settings-bespoke-leaf>, the NINE leaves of §4.4.
 * Wave 5.4, rows `bespoke-leaves-nine`, `d7-led-live-preview`, `d9-calibration-surfaces`,
 * `q14-toggle-pill`, and the F3/Q1 hole (which is an ABSENCE — see the bottom).
 *
 * `LAYOUT_SPEC_DRAFT.md` §4.4, verbatim: "Nine leaves need their own layout, not seven:
 * machine-info, sleep/wake, skin (2-up cards), skin/app (update list), select-language
 * (tile grid), load-cells (wizard), brightness (slider row), **accessories-lighting**
 * (two-column, `min-w-[420px]`, `settings.js:3916`) and **extensions-decent-app-settings**
 * (the 885px group) — the last two added by the verifier."
 *
 * THE GATEWAY GROUP IS NOT ONE OF THEM ANY MORE (26 Aug 2026). Its 885px was T21's
 * FINDING — "a third live measure, documented nowhere" — rather than a requirement, and
 * the page is four registry rows now. A leaf leaves this list the moment its content is
 * rows.
 *
 * ===========================================================================
 * ONE ELEMENT, NINE SECTIONS, AND NO HEADING
 * ===========================================================================
 *
 * This is the second half of a pair, not a rival to the first. `<settings-leaf>` renders
 * EVERY leaf: the one heading element (T13 dead for all thirty-seven, including these
 * nine) and whatever registry rows the leaf owns. This element renders what §4.4 says
 * those nine need on top of that, and it renders NOTHING ELSE — no heading, no row shape,
 * no gap of its own beyond the one below.
 *
 * The consequence is worth stating because it is what keeps the wave's headline true:
 * a bespoke leaf is a leaf with an EXTRA SECTION, never a leaf that opted out of the
 * primitive. `display-skin` still gets D8's Leave button as a #29 row from the registry;
 * this element adds the 2-up cards. Two mechanisms, one pane, no duplication — and the
 * suite checks that this file renders no `ui-settings-row` at all.
 *
 * NINE SECTIONS AND NINE COMPONENT COMPOSITIONS. Every one is a component the 57-item
 * inventory already carries (Part 10 §9: a component not on the inventory is scope
 * invention). Nothing here is a new control, a new dialog or a new row.
 *
 *   machine-info                    #50 ui-definition-card + #1 in its actions slot
 *   sleep/wake                      two flat groups + #38 ui-empty-state
 *   skin                            #51 ui-card-grid columns=2 + #8 ui-card + #3 ui-bank
 *   skin / app                      #51 columns=1 + #17 ui-progress-track
 *   select-language                 #40 ui-tile-grid
 *   load-cells                      #39 ui-wizard-column + #8 + #4 + #1   (D9)
 *   brightness                      #23 ui-slider                          (Q14)
 *   accessories-lighting            #3 ui-bank x2 + #52 ui-colour-swatch-row + #5 + #1  (D7)
 *
 * ===========================================================================
 * THE MEASURE — T1 AND T21 DIE HERE BY DECLARING NOTHING
 * ===========================================================================
 *
 * §7.5 T1: "The load-cell wizard is 63px wider than every other leaf — measured 1263
 * against 1200". §7.5 T21: "A third live measure at 885px, sitting between the 1200 cap
 * and the 760 wizard and documented nowhere."
 *
 * NOT ONE OF THE NINE SECTIONS BELOW DECLARES AN INLINE-SIZE. Part 5 §4 keeps an escape —
 * "the wizard and any leaf needing more width asks for it explicitly via its own
 * container" — and none of them needed it, which is the finding rather than the absence
 * of one: the wizard was 63px wider because a sheet said so, and the gateway group was
 * 885px wide because a class said so, and here neither has anywhere to say it. The pane's
 * `min(100%, var(--ui-measure-wide))` is the only width in the column and the render
 * suite asserts all nine boxes land on it.
 *
 * The two-column lighting leaf is the one place a width-shaped number appears, and it is
 * a TRACK MINIMUM rather than a cap: `--_ui-lighting-col-min`, private, carrying Slate's
 * own `min-w-[420px]` (`settings.js:3916`) as an auto-fit floor. It makes the leaf one
 * column when there is not room for two and never makes it wider than the pane.
 *
 * ===========================================================================
 * A3 — THREE OF THE NINE ARE GATED, AND THEY FAIL CLOSED ON UNKNOWN TOO
 * ===========================================================================
 *
 * `SERVED_CAPABILITIES` carries `ledStrip`, `scaleCalibration` and `wakeSchedule`, so
 * three of these leaves are capability-gated on the SERVED ARRAY (never a model string):
 * accessories-lighting, calibration-load-cells and machine-sleep-wake-schedules.
 *
 * ABSENT AND UNKNOWN BOTH RENDER NOTHING. Not a disabled control, not an "unavailable"
 * card — nothing, exactly as the settings store drops a gated row from `rows()` rather
 * than dimming it. The mock answers `/api/v1/machine/capabilities` with 503 BY DESIGN, so
 * `entries` stays null and every gate reads UNKNOWN; a screen that rendered its machine
 * pages against that would be a finding (wave 5.1 REPORT). The render suite asserts the
 * three sections are absent under exactly that condition.
 *
 * ===========================================================================
 * F3 / Q1 — WHAT IS NOT IN THIS FILE
 * ===========================================================================
 *
 * There is no reset-to-default control on the load-cell wizard: no button, no disabled
 * button, no placeholder, no TODO and no spelling of the words in any string, comment or
 * test. Part 10 §12: "F3 — no work of any kind on reset-to-default". The wizard ships
 * without it and the hole is recorded as this wave's deferred question. The "Start over"
 * the wizard does carry is `command: 'abort'`, which is one of the three the handler
 * declares and is how a walk is abandoned — it writes no machine state of its own.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';

/* THE LIBRARY, COMPOSED. Every one shipped in waves 1-4. */
import 'src/components/ui-card.js';
import 'src/components/ui-card-grid.js';
import 'src/components/ui-definition-card.js';
import 'src/components/ui-tile-grid.js';
import 'src/components/ui-wizard-column.js';
import 'src/components/ui-colour-swatch-row.js';
import 'src/components/ui-progress-track.js';
import 'src/components/ui-empty-state.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-switch.js';
import 'src/components/ui-button.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-file-button.js';
import 'src/components/ui-colour-wheel.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-icon-button.js';

import { gearIcon } from 'src/lib/icons.js';
import 'src/components/ui-time-picker.js';
import 'src/components/ui-list-row.js';
import 'src/components/ui-confirm-dialog.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-notes-editor.js';
import 'src/components/ui-status-chip.js';
import 'src/components/ui-keycap.js';
import 'src/components/ui-select.js';
import 'src/components/ui-numeric-keypad.js';
import 'src/components/ui-badge.js';

import { LED_BANKS, LED_STATUS } from 'src/stores/led-strip-store.js';
import { CAL_STEP, CAL_LOAD, CAL_STATUS_NONE, isCalibrationInProgress } from 'src/stores/calibration-store.js';
import { KEEP_AWAKE_RANGE, PRESENCE_STATUS } from 'src/stores/presence-store.js';
import { PLUGINS_STATUS, VISUALIZER_PLUGIN_ID, pluginHasSettings, settingFields } from 'src/stores/plugins-store.js';
import { ACCOUNT_STATUS } from 'src/stores/decent-account-store.js';
import { SUPPORT_STATUS, SUPPORT_REFUSAL, SEND_STATUS } from 'src/stores/decent-support-store.js';
import { FEEDBACK_STATUS, FEEDBACK_REFUSAL, FEEDBACK_TYPES } from 'src/stores/feedback-store.js';
import { SCAN_STATUS } from 'src/stores/scale-connect-store.js';
import { DEVICE_STATE, DEVICE_TYPE } from 'src/data/rea-devices.js';
/* THE TWO HALVES OF READING A FEED HONESTLY, and the calibration walk is this file's only
 * feed consumer that shows a NUMBER. `valueOf` unwraps the address layer's reading of the
 * last frame; `hasReading` is the predicate that tells a channel with no value from a
 * channel reading zero. `FEED_STATUS` is here for the third: a held value whose source has
 * gone is not a current reading. See `#watch`'s scale block. */
import { hasReading } from 'src/data/reading.js';
import { valueOf, FEED_STATUS } from 'src/stores/feed-store.js';
/* THE REGISTRY AND THE NAV, READ AS DATA. The reset page names each setting by the PAGE it
 * lives on, and the only honest source for that is the registry row that carries the same
 * field. Nothing here renders a settings ROW — the suite checks that — and reading the
 * table is not drawing from it. */
/* WHICH MACHINE A FIRMWARE IMAGE IS FOR — the guard Ben asked for on 27 August 2026, and
 * the reason it is a module rather than four lines here: the DE1 and Bengle board markers
 * differ by one hex digit, ReaPrime's RAW upload route validates nothing at all, and the
 * skin's file picker is the only thing standing in front of it. All of the evidence, read
 * at the pin, is in `src/lib/firmware-image.js`. */
import { checkFirmwareImage, catalogCarriesNothingFor, IMAGE_VERDICT, FIRMWARE_HEADER_BYTES, MACHINE_CLASS_NAMES } from 'src/lib/firmware-image.js';
import { SETTINGS_ROWS } from 'src/lib/settings-leaves.js';
import { leafFor, leafShownOn, navName, shownOnMachine } from 'src/lib/settings-nav.js';
import { REQUEST_STATUS } from 'src/stores/machine-state-store.js';
import { SCREENSAVER_DEFAULT_IMAGE } from 'src/components/ui-screensaver.js';
import { MACHINE_STATE } from 'src/data/machine-state.js';
import { BINDABLE_ACTIONS, bindingsByAction, conflictFor, keyLabel, normaliseKey, withBinding } from 'src/lib/key-bindings.js';
/* THE SERVED DATE, SPELLED ONCE. `reaMetadata.lastChecked` is a full ISO timestamp and the
 * skin list used to reduce it to the word "Checked" — a word that becomes constant the
 * moment "Update all skins" has been pressed once, and therefore stops distinguishing
 * anything. `short-date.js` says why it is not in `wall-clock.js`. */
import { shortDate, shortDateTime } from 'src/lib/short-date.js';
/* THE ONE SPELLING OF A TIME OF DAY (audit F-043). Two surfaces on this leaf print one —
 * the night-mode openers and the schedule rows — and both used to write it themselves, in
 * a shape that disagreed with the picker the press opens. */
import { clockTime, clockTimeFromMinutes, normaliseClockFormat } from 'src/lib/wall-clock.js';
/* The wire's own "HH:MM" -> {h24, m}, from the module that owns that parse. A schedule's
 * `time` arrives as that string and the label above needs the pair. */
import { parseTime24 } from 'src/lib/time-picker-core.js';

/* ===========================================================================
 * THE STEPPERS ON THIS PANE THAT A TAP ON THE NUMBER OPENS THE KEYPAD FOR.
 *
 * Ben, 24 August 2026: "In all settings I cannot seem to open the number pad when
 * chaning a spinners value, tapping the number should always open the number pad
 * modal." The thirty-seven registry leaves got that through <settings-leaf>'s
 * `leaf-edit`, which the screen answers from the leaf MODEL. These four cannot take
 * that route: a bespoke stepper is not a model row, so `model.rows(leaf)` never finds
 * it and the screen's keypad has nothing to open on. Hence a keypad on this element,
 * which is the same call every bespoke dialog on this pane already makes.
 *
 * THE RANGE IS THE STORE'S, NOT A NUMBER TYPED HERE. Each entry re-keys a constant the
 * owning store exports, and the stepper below is given the SAME constant — so the
 * pressed-arrow path and the typed path cannot come to disagree about a bound, which
 * is B2 ("one ranges table, never two") applied to an app-side field.
 *
 * `cal-weight` is NOT in this table on purpose: its range is a MACHINE limit, served
 * through `deps.limits.calibrationWeight`, and it goes to the keypad by the machine
 * door like every registry row. Two doors, one per field — never two for one.
 * =========================================================================== */
export const BESPOKE_NUMBER_FIELDS = Object.freeze({
    'schedule-keep-awake': Object.freeze({ heading: 'Stay awake for', range: KEEP_AWAKE_RANGE }),
});

/** The keypad reads ONE limits object with ONE key in it — the field's own. */
const bespokeLimitsFor = (id) => (BESPOKE_NUMBER_FIELDS[id]
    ? Object.freeze({ [id]: BESPOKE_NUMBER_FIELDS[id].range })
    : null);

/* ===========================================================================
 * CONTENT, READ OUT OF THE CORPUS. Never geometry (Part 10 §4: every §7.5 rect is
 * DISQUALIFIED); the words a leaf says are quoted, the boxes they sat in are not.
 * =========================================================================== */

/**
 * The LED palette. SIXTEEN — Slate's ten, minus the one it stored as a CSS variable,
 * plus seven that fill the second row.
 *
 * THE TENTH IS DROPPED ON PURPOSE AND IT IS A FINDING. Slate stored one preset as the
 * string `var(--slate-primary)` and resolved it out of the stylesheet at press time
 * (`presetHexOf`, with its own comment explaining that comparing the stored strings could
 * never mark it selected). A colour that is sent to a MACHINE is data; reading it out of
 * a stylesheet makes the machine's LEDs a function of the theme, and makes a theme change
 * a silent write. There is no Decal token whose value would be honest here, so the
 * preset is not carried rather than invented.
 *
 * These are DATA, not authored CSS: they travel to `ui-colour-swatch-row` as a property
 * and to the machine as `Color16` hex. #52's own header records that the palette belongs
 * to the screen for exactly this reason (ReaPrime serves current colours, never
 * suggestions).
 */
export const LED_PRESETS = Object.freeze([
    Object.freeze({ hex: '#000000', label: 'Off' }),
    Object.freeze({ hex: '#ffaa55', label: 'Warm White' }),
    Object.freeze({ hex: '#ffd9a0', label: 'Soft White' }),
    Object.freeze({ hex: '#eaf2ff', label: 'Daylight' }),
    Object.freeze({ hex: '#ff7a00', label: 'Amber' }),
    Object.freeze({ hex: '#ff2200', label: 'Red' }),
    Object.freeze({ hex: '#0ca581', label: 'Green' }),
    Object.freeze({ hex: '#00c2d1', label: 'Cyan' }),
    /* SEVEN MORE, TO FILL THE SECOND ROW (Ben, 26 August 2026: "the grid is full — if it
     * runs to two rows, both rows are complete, so add colours to fill it").
     *
     * A RAGGED LAST ROW READS AS A LIST THAT RAN OUT, on a control whose whole subject is
     * choosing. Eight to a row and sixteen presets is two complete rows.
     *
     * THE SEVEN ARE CHOSEN TO ANSWER QUESTIONS THE FIRST NINE DO NOT: a cooler white, two
     * more warm points, a blue, a pink and a deep green — the gaps a person reaches for
     * after Amber and before opening the wheel. The dark slate-blue Slate has is among
     * them, as a value rather than as `var(--slate-primary)`: Slate stored that one preset
     * as a CSS variable and resolved it out of the stylesheet at press time, which makes
     * the machine's LEDs a function of the theme and a theme change a silent write. The
     * colour is carried; the mechanism is not. */
    Object.freeze({ hex: '#7a3ff2', label: 'Purple' }),
    Object.freeze({ hex: '#315c70', label: 'Slate Blue' }),
    Object.freeze({ hex: '#ffffff', label: 'Cool White' }),
    Object.freeze({ hex: '#ffc46b', label: 'Candle' }),
    Object.freeze({ hex: '#ff4f8b', label: 'Pink' }),
    Object.freeze({ hex: '#2b6cff', label: 'Blue' }),
    Object.freeze({ hex: '#0a6b3d', label: 'Forest' }),
    Object.freeze({ hex: '#b8b8b8', label: 'Grey' }),
]);

/** Slate's Zone bank, mapped onto ReaPrime's own three zone keys. */
/**
 * A SKIN VERSION, AS IT IS PRINTED. ONE FORMATTER, TWO CALL SITES.
 *
 * The served field is a bare "0.3.5" and Slate prints "v0.3.5" on both the skin cards
 * (ORACLE settings-display-skin [i=56] "v0.3.5", [i=61] "v0.4.0" — Beanie and NSX are
 * in both corpora at the same versions, so the prefix is composition, not fixture) and
 * in the update list ("Streamline.js  v0.1.88 -> v0.1.95"). The rebuild dropped it in
 * both places with nothing declaring the drop (cmp-ss-4).
 *
 * NOT AN i18n KEY. The v is part of a version string the way a decimal point is: it is
 * not translated in any language column of the seeded table, and running it through
 * t() would invite one.
 *
 * IDEMPOTENT, because the field is the machine's and a machine may one day send its
 * own prefix. An absence stays an absence — the empty string, which renders nothing.
 */
export function skinVersionText(version) {
    const text = typeof version === 'string' ? version.trim() : '';
    if (!text) return '';
    return /^v/i.test(text) ? text : `v${text}`;
}

/**
 * Display > Skin's theme bank. Slate's two cells, in Slate's order
 * (CITE settings-display-skin [i=44] "Dark Light"); the values are `theme.js`'s own
 * THEMES members, so a third band would have to exist in the stylesheets before it could
 * be offered here.
 */
const THEME_ITEMS = Object.freeze([
    Object.freeze({ value: 'dark', label: 'Dark' }),
    Object.freeze({ value: 'light', label: 'Light' }),
]);

/**
 * THE ZONE BANK IS THREE GROUPS, NOT THREE WIRE ZONES (Ben, 24 Aug 2026).
 *
 * "Also power button isn't really an option I want to show, the power button should
 * follow the front LED colour, make the 3 option 'Both' and it changes the front (and
 * switch) and back at the same time keeping the colours the same."
 *
 * The machine has THREE wire zones — `frontStrip`, `backStrip`, `frontSwitch` — and the
 * third is the illuminated power button. Offering it as a cell of its own asks the user
 * a question they do not have: a power button lit a different colour from the strip
 * beside it is a fault, not a choice. So the switch RIDES WITH the front, and the third
 * cell is the one that was missing — everything at once.
 *
 * `zones` IS THE WIRE ANSWER AND `value` IS THE UI'S. Nothing below this table names a
 * wire zone, and the store takes the whole list in ONE intent (`preview`) precisely so
 * three cells cannot become three writes into a latest-wins slot.
 *
 * THE FIRST ZONE IS THE GROUP'S REPRESENTATIVE — what the wheel, the swatches and the
 * hex read back. On a group the machine holds at two different colours (an older skin
 * set them apart) the first is shown and the next write makes them agree, which is the
 * behaviour "keeping the colours the same" asks for.
 */
const LED_ZONE_ITEMS = Object.freeze([
    Object.freeze({ value: 'front', label: 'Front', zones: Object.freeze(['frontStrip', 'frontSwitch']) }),
    Object.freeze({ value: 'rear', label: 'Rear', zones: Object.freeze(['backStrip']) }),
    Object.freeze({ value: 'both', label: 'Both', zones: Object.freeze(['frontStrip', 'frontSwitch', 'backStrip']) }),
]);

/**
 * THE ROWS THE COLOUR GRID REPORTS — TWO, not the bank's three.
 *
 * `LED_ZONE_ITEMS` is what the bank OFFERS as a write target, and "Both" is a real target:
 * pressing it points the wheel at all three wire zones at once. It is not a stored colour.
 * The grid drew all three rows and filled the Both row from `store.hex(ledLeadZone('both'))`
 * — which is `zones[0]`, which is `frontStrip` — so the Both row was the Front row's colour
 * BY CONSTRUCTION and could never disagree with it. A readout asserting a value the machine
 * does not hold is a fabricated value, which A7 forbids more strictly than Slate does; Slate
 * draws two zone rows (`settings.js:3893`) precisely because there are two stored colours to
 * report.
 *
 * NOTHING IS LOST BY DROPPING IT. The Both chips were also a selection shortcut, and the
 * Zone bank directly above the grid already selects Both while the State bank selects the
 * column — so choosing "both / asleep" is still one press on each of two controls, exactly
 * as it was.
 *
 * TWO LISTS BECAUSE THEY ANSWER TWO QUESTIONS: what may be written, and what is held.
 */
const LED_GRID_ZONES = Object.freeze(LED_ZONE_ITEMS.filter((item) => item.zones.length === 1
    || item.value === 'front'));

/** The wire zones one bank cell stands for, or an empty list for a name it does not have. */
function ledZonesFor(value) {
    return LED_ZONE_ITEMS.find((item) => item.value === value)?.zones ?? [];
}

/** What a group READS as: its first zone. See the table's note. */
function ledLeadZone(value) {
    return ledZonesFor(value)[0] ?? null;
}

/**
 * Slate's State bank. The wire names are `awake` / `sleeping` (`led_strip.dart:44-47`);
 * the labels are Slate's ("Awake" / "Asleep").
 */
const LED_BANK_ITEMS = Object.freeze([
    Object.freeze({ value: 'awake', label: 'Awake' }),
    Object.freeze({ value: 'sleeping', label: 'Asleep' }),
]);

/**
 * THE NINE-VALUE DIAGNOSTIC STATUS, one sentence each (D9, and the whole reason the
 * rebuild is richer than what it replaces: the old skin showed a generic HTTP error where
 * the machine had said `badDelta`).
 *
 * English copy, run through `t()` at render (D2). `none` is the 0xFF sentinel — nothing
 * has run — and has no sentence, because "nothing has run yet" is what an empty status
 * slot already says.
 *
 * FOUR OF THE NINE SAID THE WRONG THING UNTIL 27 AUGUST 2026, and the fifth said a true
 * thing so badly it read as a failure. Having nine sentences is not the same as having
 * nine RIGHT sentences: these were written from the enum's NAMES, and the names are
 * shorter than the meanings. The meanings are commented at the enum itself
 * (`CLoadCellCal.hpp:59-70`), and each is quoted below against what this table used to say.
 *
 *   `incomplete` — "this point latched fine and we're waiting for the other one"
 *     (`CLoadCellCal.hpp:57-58` in as many words). IT IS A SUCCESS. The table printed
 *     "The calibration did not finish", which reads as a failure, on the one status a
 *     user sees EVERY time they do this correctly: it is what the machine says after the
 *     first of the two latches. The walk's own step 4 is already telling them to move the
 *     weight; the status line was contradicting it.
 *
 *   `badDelta` — "non-positive or implausible per-cell delta" (`:64`). That is one cell
 *     not seeing the weight at all. The table said "The two load cells disagree. Check the
 *     weight is centred", which is the OPPOSITE instruction for this procedure: an
 *     isolated-cell cal wants the whole mass on ONE cell, and centring it is how you get
 *     `notIsolated` instead.
 *
 *   `illConditioned` — "both placements in effectively the same spot" (`:65`). The table
 *     said the readings were "too close together to solve", which is true and tells the
 *     user nothing they can do. The remedy is to move the weight to the other cell, so
 *     the sentence says that.
 *
 *   `outOfRange` — "solved cals outside +/-50% of nominal" (`:66`). It is a verdict on
 *     the SOLVE, and the usual cause is a mistyped weight. The table said "A reading is
 *     outside the load cells' range", which is `badWeight`'s meaning (`:63`), so two
 *     statuses were describing one condition and neither pointed at the entered mass.
 *
 *   `notIsolated` — "no dominant cell: platform still fitted / mass bridging" (`:67`).
 *     The table said "Something else is resting on the platform", which sends the user to
 *     look for a stray cup when the actual cause is the platform ITSELF being fitted.
 */
const CAL_STATUS_TEXT = Object.freeze({
    ok: 'Calibrated.',
    incomplete: 'One cell is done. Move the weight to the other cell and latch again.',
    noZero: 'Zero the load cells before latching a weight.',
    notSettled: 'The reading never settled. Keep the machine still and try again.',
    badWeight: 'That weight is outside what the load cells can measure.',
    badDelta: 'That cell did not see the weight. Check it is sitting directly on one load cell, not bridging both.',
    illConditioned: 'Both weighings landed on the same cell. Move the weight to the other one.',
    outOfRange: 'The calibration that came out is more than 50% off nominal. Check the weight you entered.',
    notIsolated: 'The cup platform is still fitted, or the weight is bridging both cells.',
});

/** `ScaleCalibrationSubState`, as a phase word beside the countdown. */
const CAL_SUBSTATE_TEXT = Object.freeze({
    settling: 'Settling',
    averaging: 'Averaging',
    done: 'Done',
    error: 'Stopped',
});

/**
 * THE WALK, FIVE STEPS, ON BEN'S RULING (26 August 2026).
 *
 * "1 Start — say what the calibration does, with a Start button. 2 Zero. 3 Weight on the
 * left cell. 4 Weight moved to the right cell. 5 Check."
 *
 * IT WAS THREE, AND THE THREE WERE A READING OF THE PROTOCOL RATHER THAN OF THE JOB. This
 * table used to say "three, because the machine's latch replaced Slate's left-then-right
 * pair" — true of the COMMAND, which detects which cell the weight is on, and not true of
 * what a person does: they put the weight on one side, latch, move it to the other, and
 * latch again. The machine says so itself. `ScaleCalibrationStatus.incomplete` is exactly
 * "one cell latched, not the other" (`scale_calibration.dart:40`), and `detectedCell`
 * names which one. A three-step walk asked the user to work that out from a status line.
 *
 * AND A START STEP, which is not ceremony: this page can only be reached deliberately, and
 * the first thing it should do is say what it is about to make you do — the drip tray off,
 * a known weight to hand — before anything is written to the machine.
 */
const CAL_STEPS = Object.freeze(['Start', 'Zero', 'Left cell', 'Right cell', 'Check']);

/** The default latch weight ReaPrime itself uses when a caller sends none. */
const CAL_DEFAULT_WEIGHT = 200;

/** What each of the five steps is called, once the machine is not mid-action. */
const CAL_STAGE_HEADING = Object.freeze({
    1: 'Calibrate the load cells',
    2: 'Zero the load cells',
    3: 'Put the weight on the left cell',
    4: 'Move the weight to the right cell',
    5: 'Check the reading',
});

/**
 * And what each one asks the user to do.
 *
 * THE PLATFORM STAYS OFF FOR THE WHOLE WALK, AND EVERY WEIGHT STEP NOW SAYS SO. This was
 * the audit's second finding against these five sentences (H19). The zero step said to
 * take the cup platform and the drip tray off; steps 3 and 4 then asked for a weight on a
 * named cell without repeating it, and step 5 said "leave the weight ON THE PLATFORM" —
 * a platform that is not fitted at that point and must not be.
 *
 * IT IS NOT A DETAIL, IT IS THE PROCEDURE. `CLoadCellCal.hpp:23-31`: the weight cal runs
 * "with the platform REMOVED (cells mechanically isolated), place ONE known weight
 * directly on either cell". A fitted platform bridges the two cells, the auto-detect finds
 * no dominant one, and the machine rejects the latch with `NotIsolated` — so a user
 * following the old wording could not succeed, and the sentence that told them why was in
 * the status line rather than the instruction.
 *
 * FIFTEEN SECONDS IS THE MACHINE'S OWN NUMBER, not a guess: `System.cpp:2361` starts the
 * precision zero with `startPrecisionZero(10, 5)` — ten seconds settling, five averaging —
 * and each cal-point latch is `startCalPoint(weight, 10, 5)`, the same fifteen.
 */
const CAL_STAGE_BODY = Object.freeze({
    1: 'This teaches the machine what a known weight feels like on each load cell. You will need the drip tray off and a weight whose mass you know. Nothing is written to the machine until you press Zero.',
    2: 'Take the cup platform and the drip tray off so the load cells are carrying nothing, then press Zero. It takes about fifteen seconds to settle and average.',
    3: 'Leave the cup platform and the drip tray OFF — the cells have to be isolated. Put the weight directly on the LEFT load cell, set its mass below, then latch it. This takes about fifteen seconds.',
    4: 'Still with the cup platform and the drip tray OFF, move the same weight directly onto the RIGHT load cell and latch it again. The machine works out which cell it is on.',
    5: 'Leave the weight where it is. The scale should now read what you entered. Refit the drip tray and the cup platform when you are done.',
});

/**
 * WHICH OF THE NINE IS GATED, AND ON WHAT. Not a second gate: the render branches and the
 * `#load()` switch each ask `#allowed()` themselves, exactly as before. This table exists
 * so `#load()` can tell whether the answer it got LAST time is the answer it has NOW —
 * the leaves not named here have no gate, so their key never moves.
 */
const LEAF_CAPABILITY = Object.freeze({
    'machine-sleep-wake-schedules': 'wakeSchedule',
    'calibration-load-cells': 'scaleCalibration',
    'accessories-lighting': 'ledStrip',
});

/**
 * MACHINE INFO'S THREE RULES FOR `extra`, all Slate's and all quoted at `#machineExtras`.
 *
 * The unit table is deliberately SHORT: a unit is stamped only where it is unambiguous,
 * because a wrong unit beside a number is worse than no unit at all. A key not in this
 * table prints its value bare, which is what the machine sent.
 */
const MACHINE_INFO_UNITS = Object.freeze({ voltage: 'V', tankTemp: '\u00B0C' });

/** The internal capability bitmask. "Profile Mode Caps 15" answers no question a user has. */
const MACHINE_INFO_INTERNAL_KEYS = new Set(['profileModeCaps', 'ProfileModeCaps']);

/**
 * HOW MANY SCREEN-SAVER PICTURES ARE KEPT.
 *
 * They live as data URLs in device storage, and a folder pick takes a whole folder — a
 * dozen camera photographs is already tens of megabytes, which is enough to fail a write
 * on a quota nobody sees. Twelve is generous for a screen saver and small enough to
 * survive. Anything past it is dropped, and the count on the page says how many landed.
 */
const SAVER_IMAGE_LIMIT = 12;

/**
 * One picked file as a data URL, or null.
 *
 * NEVER THROWS INTO A RENDER TREE. A file that cannot be read — removed between the pick
 * and the read, or refused by the platform — resolves to null and is left out of the set,
 * which is one picture missing rather than a screen that fails to paint.
 */
function readAsDataUrl(file) {
    return new Promise((resolve) => {
        try {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        } catch {
            resolve(null);
        }
    });
}

/**
 * WHAT `DELETE /machine/settings/reset` ACTUALLY MOVES, AND WHAT EACH ONE BECOMES.
 *
 * Read at the pin, `De1Controller.applySettingsDefaults`
 * (`de1_controller.defaults.dart:110-122`) makes EIGHT calls. This file said seven for a
 * while, because a summary counted the two heater flows as one line; the handler makes two
 * calls and the page now lists two rows.
 *
 * THE VALUES ARE REPEATED HERE AND THAT REVERSES A RULE THIS FILE HELD. It said "the
 * values are not repeated here; what each one becomes is the machine's business and would
 * be a second copy of a table this skin does not own." True, and it left the user with a
 * list of names and no way to tell whether pressing the button would change anything on
 * their machine. Ben, 26 August 2026: "add two columns, the current value and the default
 * it will become."
 *
 * SO THE RISK IS REAL AND IS WRITTEN DOWN INSTEAD OF AVOIDED: if ReaPrime changes a
 * default, this table is what needs the edit, and this paragraph is what says so. The
 * CURRENT column is never a copy — it is read live off the machine document through
 * `deps.machineValue`, and it dashes when the machine has not answered.
 *
 * THE PAGE COLUMN IS DERIVED, not typed: each row is matched to the registry row that
 * carries the same field, and the page is that row's leaf. A setting that moves to another
 * page takes its name here with it.
 */
/* EXPORTED FOR ONE ASSERTION, and the assertion is the point of exporting it. A registry
 * caption may not tell a reader that the Restore button knows a default unless this list
 * actually carries that field — one caption did, for two fields the reset never touches,
 * and the recovery value for both was therefore stated nowhere in the skin. The suite holds
 * the two tables together; see the render suite's "no caption promises a restore this
 * button does not make". */
export const RESET_FIELDS = Object.freeze([
    Object.freeze({ field: 'fan', value: 55 }),
    Object.freeze({ field: 'heaterIdleTemp', value: 95 }),
    Object.freeze({ field: 'heaterPh1Flow', value: 2 }),
    Object.freeze({ field: 'heaterPh2Flow', value: 4 }),
    Object.freeze({ field: 'heaterPh2Timeout', value: 4 }),
    Object.freeze({ field: 'refillKitSetting', value: 2 }),
    Object.freeze({ field: 'flowMultiplier', value: 1 }),
    Object.freeze({ field: 'steamPurgeMode', value: 0 }),
]);

/**
 * THE CONFIRM DIALOG'S SENTENCE, BUILT FROM THE PAGES THIS MACHINE ACTUALLY HAS.
 *
 * IT WAS A HARD-CODED STRING and it named a page a Bengle does not have. "Anything you have
 * set on the Pre Shot, Fan Threshold, Refill Kit, Flow Multiplier and Steam pages…" — and
 * `calibration-flow-multiplier` is gated `machines: ['de1']`, so on a Bengle the last
 * warning before an irreversible button pointed at a page the user cannot open. The Page
 * column above had the same defect from the same cause; fixing only the column would have
 * left the dangling reference in the more important of the two places.
 *
 * SO THE LIST IS DERIVED AND THE SENTENCE IS ASSEMBLED, which is the smaller claim: the
 * page names come from the same filtered rows the table draws, so the dialog cannot name a
 * page the table does not, and a setting that moves to another page takes its name here
 * with it exactly as it does there.
 *
 * D2 SURVIVES IT. Every fragment goes through `t()` — the two frames and the conjunction —
 * and the page names are `navName`'d registry content, translated at the call site. What is
 * NOT done here is composing a grammar: a language whose list separator is not a comma gets
 * that from its own translation of the frame, and the join is the one thing a translator
 * cannot reach. That limit is real and is stated rather than hidden; it is the same
 * compromise every enumerated sentence in this file makes.
 *
 * NO PAGES AT ALL is a real answer and gets its own sentence rather than a sentence with a
 * hole in it. It happens when no registry row carries any of the eight fields — not a state
 * this build reaches, and not a reason to render "goes back on the  pages".
 */
function defaultsDetail(t, pages) {
    if (pages.length === 0) {
        return t('These settings go back to the machine’s own values.');
    }
    const names = pages.map((name) => t(name));
    const list = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} ${t('and')} ${names[names.length - 1]}`;
    return `${t('Anything you have set on the')} ${list} ${t('pages goes back to the machine’s own value.')}`;
}

/**
 * PROSE NAMES FOR THE PLUGIN SETTINGS THIS SKIN SHOWS A WHOLE PAGE FOR.
 *
 * Ben, 26 August 2026, on the Visualizer page: "needs a big cleanup, make it the same as
 * Slate but lay it out like every other page." Slate writes "Auto-upload shots to
 * Visualizer" and "Minimum shot duration"; Decal printed `AutoUpload`,
 * `LengthThreshold`, `BackSync` and `BackSyncIntervalSeconds`, which are the keys a
 * plugin author chose for a config file.
 *
 * A TABLE AND NOT A TRANSFORM. Splitting camel case would give "Length Threshold", which
 * is the same jargon with a space in it — the useful name says what the number does
 * ("Minimum shot duration"), and only a person can write that.
 *
 * KEYED BY PLUGIN AND KEY, and it is a COURTESY rather than a contract: a key with no
 * entry falls back to the manifest's own name, which is what every other plugin gets. The
 * generated form still shows every field the manifest declares, including one this table
 * has never heard of — that is what makes it a generated form.
 */
const PLUGIN_FIELD_COPY = Object.freeze({
    'visualizer.reaplugin': Object.freeze({
        Username: { heading: 'Username', caption: 'Your visualizer.coffee account.' },
        Password: { heading: 'Password', caption: '' },
        AutoUpload: { heading: 'Upload shots automatically', caption: 'Send every shot as it finishes.' },
        LengthThreshold: {
            heading: 'Minimum shot duration',
            caption: 'Shorter shots are not uploaded, so a flush or a mistake does not become a record. In seconds.',
        },
        BackSync: {
            heading: 'Upload older shots',
            caption: 'Look back through shots already on the machine and send any that were missed.',
        },
        BackSyncIntervalSeconds: {
            heading: 'How often to look back',
            caption: 'In seconds.',
        },
    }),
});

/**
 * The id of a plugin's own PAGE, or null.
 *
 * THE MANIFEST'S OWN DECLARATION AND NOT A SNIFF. `PluginApi` is a list of
 * `{id, type, data}` and `ApiEndpointType` is `websocket | http`
 * (`plugin_manifest.dart:109-143`), so the manifest is where a plugin says what it has.
 * A plugin gets an Open button by SAYING it has a page.
 *
 * SLATE DECIDES THIS BY TESTING THE DESCRIPTION for a URL (`pluginHasUi`,
 * settings.js:7006), which gives a button to any plugin that happens to mention its
 * website in a sentence — and gives none to a plugin whose page has no URL in its blurb.
 * That is not carried.
 *
 * `ui`, NOT MERELY `http`, AND THAT IS THE WHOLE OF IT (27 August 2026). This took the
 * FIRST endpoint of type `http`, on the reading that `http` means "a page". It does not.
 * `_handlePluginApiEndpoint` (`plugins_handler.dart:339-352`) dispatches ANY http endpoint
 * straight to the plugin, which decides its own Content-Type — so `http` means "the plugin
 * answers a request here", and most of those answers are JSON. On the bundled six the
 * first http endpoint is `status` for Visualizer, `beans` for DYE2 and `status` for
 * shot-upload, so FOUR OF SIX ROWS drew an Open button that opened raw JSON in a new tab.
 *
 * The convention that actually means "this is the plugin's page" is an endpoint whose id
 * is `ui`: `settings.reaplugin` returns `text/html` for `request.endpoint === 'ui'`
 * (`plugin.js:1602`, `:1622`), `decent-profile.reaplugin` does the same, and Slate
 * hard-codes `/plugins/<id>/ui`. Selecting on it reproduces Slate's two rows exactly while
 * keeping the better justification — a declaration in the manifest, not a sniff of prose.
 */
function pluginPage(manifest) {
    const endpoints = Array.isArray(manifest?.api) ? manifest.api : [];
    const page = endpoints.find((entry) => entry && entry.type === 'http' && entry.id === 'ui');
    return page ? page.id : null;
}

/**
 * A plugin's description with its own URL taken out.
 *
 * TWO OF THE BUNDLED SIX END THEIR DESCRIPTION WITH A RAW LOCALHOST URL — "Displays Decent
 * application and machine settings in an embeddable HTML page.
 * http://localhost:8080/api/v1/plugins/settings.reaplugin/ui". Slate strips exactly that
 * and its P35 note says why: "On a kiosk with no address bar that UI is unreachable, and
 * the URL is noise in the one line describing what the plugin does."
 *
 * Decal HAS A STRONGER REASON TO FOLLOW. This list now draws an Open button for those
 * very plugins, so the URL is not merely unreachable noise — it is a second, worse copy of
 * a control already on the row. And `.plugin-blurb` clamps to two lines, so on the Decent
 * Profile Generator row the URL eats most of line two and pushes out the sentence that
 * says what the plugin actually does.
 *
 * BROADER THAN SLATE'S PATTERN, DELIBERATELY. Slate's regex requires the path to end `/ui`;
 * this one strips any `…/plugins/…` URL, because an endpoint that is not the page is even
 * less use to a reader than one that is.
 *
 * AND IT IS NOT SLATE'S REGEX OBJECT. Slate declares `PLUGIN_UI_URL` with the `g` flag and
 * then calls `.test()` on it (settings.js:7007) — a `g` regex carries `lastIndex` across
 * calls, so `.test()` alternates true and false on the same string. The literal lives
 * inside this function, is used only for `replace`, and cannot be reused statefully.
 */
function pluginBlurb(manifest) {
    return String(manifest?.description ?? '')
        .replace(/https?:\/\/\S*\/plugins\/\S*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * A version string with one `v` in front of it.
 *
 * `version` IS FREE-FORM MANIFEST TEXT. This row wrote `v${plugin.version}` outright, so a
 * manifest that already spells its version "v1.0.3" rendered "vv1.0.3". Nothing in the
 * bundled six triggers it today, which is exactly why it would not be noticed until a
 * third-party plugin did. Slate guards it (`formatVersion`, settings.js:494) and so does
 * this.
 *
 * AN EMPTY STRING FOR NOTHING, NEVER "v?" (A7). Slate renders `formatVersion(p.version) ||
 * 'v?'`, which asserts a version it does not have; the caller drops the whole span instead,
 * so a manifest with no version shows no version.
 */
function pluginVersion(value) {
    const text = String(value ?? '').trim();
    if (text === '') return '';
    return /^v/i.test(text) ? text : `v${text}`;
}

/** The prose name and helper for one plugin field, or the manifest's own. */
function pluginFieldCopy(pluginId, field) {
    const found = PLUGIN_FIELD_COPY[pluginId]?.[field.key] ?? null;
    return {
        heading: found?.heading ?? field.key,
        caption: found?.caption ?? field.description ?? '',
    };
}

/* THE SIZE BOUNDS USED TO BE DECLARED HERE and are now in `src/lib/firmware-image.js`
 * with the two board markers, because a bound written in two files is a bound that will
 * one day disagree with itself (B2). What replaced them is not a bigger size test: it is
 * the board marker, which is the only thing that can tell a DE1 image from a Bengle one.
 * See that module's header for Ben's instruction of 27 August 2026 and the evidence. */

/**
 * HOW MANY PRESETS TO A ROW.
 *
 * Ben, 26 August 2026: "the grid is full — if it runs to two rows, both rows are complete,
 * so add colours to fill it."
 *
 * FOUR, NOT SLATE'S EIGHT, AND THE REASON IS MEASURED. A swatch is
 * `max(--ui-control-h, --ui-hit-min)` — 64px, with a hit-size floor under it that density
 * may not move — so eight of them plus their gaps is 596px. The lighting leaf is TWO
 * COLUMNS at the reference geometry and each column is about 584px, so a row of eight
 * overflows its own column at the widest the page ever gets. Slate's fit because Slate's
 * swatches are smaller than a touch target.
 *
 * SIXTEEN OVER FOUR IS FOUR COMPLETE ROWS, which is what Ben's rule asks for — every row
 * full, at every width, with no ragged tail. The count and the palette length are one
 * decision: change either and the other has to follow, and this is where that is said.
 */
const LED_PRESET_COLUMNS = 4;

/** The absent mark, the same EN DASH the address layer uses. */
const MACHINE_INFO_DASH = '\u2013';

/* ═══════════════════════════════════════════════════════════════════════════
 * THE FOUR SENTENCES THE FLASH PAGE SAYS, DECLARED ONCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ONE DURATION, STATED IN TWO PLACES, MUST BE THE SAME NUMBER. The caution above the
 * buttons and the confirmation behind them both have to say how long a flash takes, and
 * when the two were written separately they disagreed: the page said "several minutes"
 * (Slate's number, carried) while Ben's own confirm-dialog wording of 26 August 2026 said
 * "It can take up to an hour". A constant is what makes that unrepeatable, and it is why
 * the render suite can assert the two strings are the same string rather than merely
 * similar.
 *
 * THE INTERRUPTION SENTENCE IS EVIDENCE, NOT A GUESS, and it is deliberately about
 * RESTARTING rather than about damage. Three facts, read in ReaPrime at the pin:
 * `firmware_handler.dart` wires `progressController.onCancel` to `de1.cancelFirmwareUpload()`,
 * so a client disconnect really does stop the flash — which is why "do not close this
 * page" is a fact and not caution for its own sake; `unified_de1.firmware.dart` runs
 * erase, then upload, then verify, from the top, every time, and throws when verification
 * does not succeed, so there is no resume path anywhere; and a second attempt while one is
 * running is refused with a 409 rather than continued. What CANNOT be said from the code
 * is whether a half-written machine still boots — that needs Ben's bench, and none of the
 * sentence below depends on it.
 */
const FIRMWARE_DURATION = 'It can take up to an hour.';
const FIRMWARE_POWER = 'Do not switch the machine off while an image is being written.';
const FIRMWARE_CARE = 'Do not switch the machine off, and do not close this page, until it finishes.';
const FIRMWARE_INTERRUPTION = 'If it stops part-way nothing resumes — you start the update again from the beginning.';

/**
 * The full descaling procedure, which is a DOCUMENT and not a page in this skin.
 *
 * Slate links it from the same place (`settings.js:5216`) and this is Slate's own URL,
 * carried rather than re-derived. It opens in a new context with `noopener`, so a
 * kiosk-mode tablet cannot be navigated away from the skin by it.
 *
 * ONE CONSTANT, NAMED, because a bare URL inside a render tree is a thing nobody finds
 * when it changes.
 */
const DESCALING_INSTRUCTIONS_URL = 'https://app.basecamp.com/3671212/buckets/7351439/documents/7743429669';

/**
 * THE COMPOSE BOX'S RESTING STATE.
 *
 * `attachDetails` STARTS ON, which is Slate's default (`talkdecent-attach-machine` is
 * `checked` in its markup) and is the right one for the person the page is for: someone
 * writing to support about a machine almost always wants the machine named, and the ones
 * who do not are writing about something else and will notice the switch. The switch is
 * only drawn when there is actually something to attach — see `#supportCompose`.
 *
 * FROZEN, so the object cannot become a shared mutable draft by accident: every edit in
 * `#onSupportField` spreads it into a new one.
 */
const EMPTY_SUPPORT_DRAFT = Object.freeze({ subject: '', body: '', attachDetails: true });

/** The Decent support thread stamps each message in UNIX SECONDS; `shortDateTime` takes
 *  milliseconds. One named conversion rather than a bare 1000 in a template. */
const MS_PER_SECOND = 1000;

/**
 * ONE SENTENCE PER REFUSAL, AND THEY ARE FIVE DIFFERENT THINGS TO DO.
 *
 * The store distinguishes these because they are actionable in different ways, and a table
 * here is what makes that distinction reach the reader — a single "Something went wrong"
 * would throw away the whole reason the store bothered.
 *
 * NO SENTENCE PROMISES A RETRY THAT CANNOT WORK. `NO_TOKEN` in particular says the cause
 * precisely and does NOT invite the reader to try again: without an injected bearer this
 * page can never reach the account proxy, on this load or any other, and telling somebody
 * to press Refresh would be advice that cannot help.
 *
 * `NOT_LINKED` IS REACHABLE EVEN THOUGH THIS SURFACE IS BEHIND A LINKED ACCOUNT. The
 * account read and the proxy call are two requests at two moments; an account signed out in
 * ReaPrime between them answers 401 here, and the page has to be able to say so rather than
 * printing a generic failure over a chip that still reads Linked.
 *
 * `FORBIDDEN` NAMES CONSENT, which is a state this ReaPrime does not have and a newer one
 * does. At the pin a 403 means the token is unscoped or the path is outside the allowlist;
 * in ReaPrime's working tree `DecentProxyService` takes a `requireConsent` callback and a
 * declined or timed-out native prompt answers 403 too. The sentence covers both without
 * asserting which, because the skin genuinely cannot tell them apart from the status alone.
 */
const SUPPORT_REFUSAL_COPY = Object.freeze({
    [SUPPORT_REFUSAL.NO_TOKEN]: 'Messages can only be sent from a page the machine serves. Open this skin from ReaPrime rather than from another address.',
    [SUPPORT_REFUSAL.NOT_LINKED]: 'The machine is no longer signed in to a Decent account. Sign in again in ReaPrime.',
    [SUPPORT_REFUSAL.FORBIDDEN]: 'ReaPrime did not allow this skin to use the Decent account. Check the account permissions in ReaPrime.',
    [SUPPORT_REFUSAL.UPSTREAM_REFUSED]: 'Decent’s support service refused the request. Try again in a moment.',
    [SUPPORT_REFUSAL.UNREADABLE]: 'The reply from Decent could not be read, so the conversation is not shown.',
    [SUPPORT_REFUSAL.FAILED]: 'The conversation could not be reached. Check the machine’s internet connection and try again.',
});

/**
 * A DEVICE STATE, AS A WORD A PERSON CAN ACT ON.
 *
 * The chip printed `device.state` straight through — a `ConnectionState` wire token from
 * `rea-devices.js`, one of 'discovered', 'connecting', 'connected', 'disconnecting',
 * 'disconnected'. Three of the five happen to read acceptably because the chip's CSS
 * upper-cases them, which is exactly what hid the defect: measured live, the connected
 * machine's chip textContent was the literal string 'connected'. The one that does NOT
 * read is the one a Search produces — 'discovered' is an implementation word for a state
 * a person would call available.
 *
 * SLATE'S OWN MAPPING, which is right about that: connected -> 'Connected',
 * `available === false` -> 'Unavailable', anything else -> 'Available'
 * (`settings.js:9224-9230`). This keeps Decal's finer distinction — 'Connecting' and
 * 'Disconnecting' are transitional and worth naming — and agrees with Slate everywhere
 * else.
 *
 * AND IT IS WHAT MAKES THE WORDS TRANSLATABLE. `t(word)` with a VARIABLE key cannot be
 * extracted into `i18n/source/`, and `i18n.js` deliberately returns the CALLER's casing
 * for a case-only match, so a translation for these could never have landed. Every value
 * below is a literal this file states, which is what the extractor reads.
 */
const DEVICE_WORD = Object.freeze({
    connected: 'Connected',
    connecting: 'Connecting',
    disconnecting: 'Disconnecting',
    disconnected: 'Available',
    discovered: 'Available',
});

/**
 * What a refused DEVICE action says, by the operation it was.
 *
 * The four device operations shared one `writeError` slot with the two WiFi ones, and the
 * only reader was the WiFi section — so a refused Forget printed a sentence about an
 * address on the Scale page and printed nothing at all on the Machine page. The store now
 * carries the operation (`WRITE_OP`), and this is the sentence for each one.
 *
 * THE SERVER'S OWN WORDS RIDE ALONG WHERE IT GAVE ANY. `devices_handler.dart` answers 404
 * "Device not found", 409 "Device is inventory-only and cannot be controlled here", 503 on
 * a failed connect and 504 on a timeout; the store reads those through `readConnectResult`
 * and puts them on `writeError.reason`. The sentence says what was being attempted, the
 * reason says what the machine said about it, and neither is invented here.
 */
const DEVICE_REFUSAL = Object.freeze({
    connect: 'That device could not be reached.',
    disconnect: 'That device would not disconnect.',
    forget: 'The machine would not forget that device.',
    preferred: 'That device could not be made the preferred one.',
});

export class SettingsBespokeLeaf extends UiElement {
    static properties = {
        /** The leaf id, from `settings-nav.js`. Anything not among the nine renders nothing. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** `settingsBespokeFor(boot)` — the stores this cluster reads. */
        deps: { attribute: false },

        /**
         * The theme controller (`src/lib/theme.js`), for Display > Skin's Dark/Light
         * bank. Its own property rather than a member of `deps`: that bundle is the
         * composition root's frozen object, built from a DOM-free `boot`, and this
         * controller needs a document element — so it comes down the shell's own chain
         * (app-root -> settings-screen -> here) and neither object is copied.
         *
         * Absent is a legitimate configuration: a leaf mounted in the gallery or a
         * fixture with no shell renders the skins list and no theme bank, rather than a
         * control that cannot write.
         */
        theme: { attribute: false },

        /** Internal: one beacon for every store this leaf subscribes to. */
        _version: { state: true },

        /** Internal: which LED zone and bank the user is editing. Not machine state. */
        _ledZone: { state: true },
        _ledBank: { state: true },

        /** Internal: the latch weight the user typed. Bounded by the ONE table. */
        _weight: { state: true },

        /* Internal: the two pieces of the calibration walk the machine cannot report —
         * whether the user has pressed Start, and whether a zero has been seen to finish.
         * Everything else about the walk is read from the machine (see `#calStage`). */
        _calStarted: { state: true },
        _calZeroed: { state: true },

        /** Internal: what the scale reads now, for the calibration walk's check step. */
        _scaleWeight: { state: true },

        /* Internal: the wake-schedule editor. `_schedule` is the draft being edited —
         * null when the dialog is shut, an object with `id: null` when it is a new one.
         * A DRAFT, not the store's record: a schedule is four fields and the server
         * validates all four together, so it is edited whole and posted once. */
        _schedule: { state: true },

        /* Internal: the firmware write waiting on its confirmation —
         * `{kind: 'latest'}` or `{kind: 'file', bytes}` — and whether the last picked file
         * was refused before it got there. NOTHING FLASHES WITHOUT PASSING THROUGH BOTH. */
        _flashPending: { state: true },
        /* Internal: the VERDICT on the last picked file, or null when none was refused.
         * An object rather than a boolean since 27 August 2026 — the header check answers
         * five different refusals and each one sends the reader somewhere different. */
        _flashRejected: { state: true },

        /* Internal: the id of the stepper whose number was pressed, or null. The KEY,
         * not the value: the value is read back out of the store on every render, so a
         * store update while the keypad is open reaches the readout. */
        _typing: { state: true },

        /* Internal: which irreversible procedure is waiting on a confirmation, by id. */
        _confirm: { state: true },

        /* Internal: the MACHINE'S OWN STATE, as the snapshot feed reports it, and the
         * procedure state this leaf has actually SEEN it in.
         *
         * TWO PROPERTIES BECAUSE THEY ANSWER TWO QUESTIONS. `_machineState` is "what is
         * the machine doing now", which is what says a purge is running. `_procedureSeen`
         * is "did it ever start", which is the only way to tell the FALLING EDGE — the
         * machine leaving `airPurge` — from a machine that was never in it. Without the
         * second one, "not purging" reads the same before the purge and after it, and the
         * completion sentence a person packing a machine needs would either never appear
         * or appear on a page nobody pressed. */
        _machineState: { state: true },
        _procedureSeen: { state: true },

        /* Internal: the reset was refused. Reported rather than swallowed. */
        _defaultsFailed: { state: true },

        /* Internal: the staged settings for one plugin (`{id, values}`). Staged rather
         * than written per keystroke, because `POST /plugins/<id>/settings` RELOADS the
         * plugin on every write. */
        _pluginDraft: { state: true },
        /** Which plugin's settings dialog is open, or null. */
        _pluginSettingsFor: { state: true },

        /* Internal: the last Open press produced no window. `window.open` returning null
         * in a webview is not an exception, so without this a refused navigation was
         * silent — see `#openPluginPage`. */
        _pluginOpenFailed: { state: true },

        /* Internal: the feedback form's own draft. It is not stored anywhere — an
         * unsent feedback note is not a preference. */
        _feedback: { state: true },

        /* Internal: the Talk to Decent compose box's draft, `{subject, body, attachDetails}`.
         * NOT STORED, on the same reasoning as `_feedback` above: an unsent message is not
         * a preference, and `storage-routes.js` would rightly refuse a key for one. It dies
         * with the page, which is what leaving a half-written message behind should mean. */
        _support: { state: true },

        /* Internal: Send was pressed with a blank subject or a blank message. Held here
         * rather than in the store because the store never saw the press — it refuses a
         * blank pair before building a request, so there is no result to read a reason off.
         * See `#supportCompose` on why the button stays live and refuses on press. */
        _supportIncomplete: { state: true },

        /* Internal: which night-mode time is open in the picker, `sleep` or `morning`. */
        _nightEdit: { state: true },

        /* Internal: why the last "Check for updates" press did nothing (audit F-035).
         *
         * The command rides `/ws/v1/update`, and `channel.send()` answers
         * `{ok: false, reason: 'socket is not open'}` when the socket is down. That answer
         * was DISCARDED, so a press on a closed socket produced no request, no frame, no
         * word and no change to the page — which is exactly what the audit measured
         * (`_audit/wave-3/logs/W3-settings-B/run-small2.json`, `allRequests: []`,
         * `textAfter` byte-identical to `textBefore`).
         *
         * HELD HERE RATHER THAN IN THE STORE, for the same reason `_supportIncomplete` is:
         * the store's own `error` field is the SERVER's word for why a check failed, and
         * this is why one never reached it. Cleared on every leaf change with the rest. */
        _updateRefusal: { state: true },

        /* Internal: the WiFi scale address being typed. */
        _wifiHost: { state: true },

        /* Internal: the key-binding editor. `_captureAction` is the action listening for
         * a keystroke; `_bindingConflict` is the label of the action already holding the
         * key that was just pressed. */
        _captureAction: { state: true },
        _bindingConflict: { state: true },
    };

    static styles = [typeRoles, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * ONE GAP AND NO WIDTH. The host is a grid with one gap token, exactly as
         * settings-leaf.js is, so the bespoke section sits in the leaf's rhythm rather
         * than beside it. There is NO inline-size, NO max-inline-size and NO margin here:
         * the pane owns the measure and that is the whole of T1 and T21. */
        :host {
            display: grid;
            gap: var(--ui-space-5);
            align-content: start;
            min-inline-size: 0;

            /* The lighting leaf's two-column track minimum, private and defaulted -
             * the shape #40 and #51 both use for theirs. Slate's own min-w-[420px]
             * (settings.js:3916). A FLOOR for auto-fit, never a cap. */
            --_ui-lighting-col-min: 420px;

            /* The screen-saver thumbnail's inline size. Private, defaulted, and a
             * SIZE rather than a track minimum: a thumbnail is a fixed thing. */
            --_ui-thumb-size: 160px;

            /* The width of a text or number control in a bespoke form row. A SIZE
             * rather than a measure: a field that fits an email address without
             * stretching to the page's full width.
             *
             * NO LONGER THE OWNER OF THE NUMBER. It was 320px here until a
             * registry-built leaf needed the same width for the same job and could
             * not see a private name — the ReaPrime address field computed 0 wide
             * and drew outside its pane. The number moved to tokens.css and this
             * stays as the local name pointed at it, which is the one
             * re-declaration shape Gate C's private-palette guard allows: a value
             * that is itself a public token, never a literal. */
            --_ui-form-control-w: var(--ui-form-control-w);
        }

        /* A section heading inside a leaf. Slate prints one above each group
         * (CITE settings-accessories-lighting .slate-accent-text "Zone" / "State" /
         * "Current Colours" / "Presets"); the role is the type scale's, not a size.
         *
         * SEVENTEEN CARDS BECAME THIS ON 26 AUGUST 2026, and it is the same request on
         * eleven different pages. Ben, page after page: "no cards", "drop the card, use
         * the same layout as the other pages", "rebuild as five steps, no cards".
         *
         * THE ARGUMENT IS THAT A CARD CLAIMED SOMETHING THAT WAS NOT TRUE. A bordered
         * surface says "this is a thing apart"; on a settings page it was drawn around
         * ordinary groups of ordinary rows, so every page read as two vocabularies — the
         * flat leaf rows above and a boxed region below, for content of exactly the same
         * kind. Slate draws none of them.
         *
         * WHAT SURVIVES IS THE GROUP, which is the part that carried meaning: a heading
         * over the rows it names. It sits in the leaf's own rhythm (the host gap) rather
         * than in a box of its own, so a bespoke section and a registry row are spaced by
         * one number. The card component is still used where a card is a TILE — the skin
         * grid — because a tile is a thing apart. */
        .group {
            display: grid;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .group > h3 {
            margin: 0;
        }

        .prose {
            margin: 0;
            max-inline-size: var(--ui-measure);
        }

        /* ---- the one caution on the one irreversible page -------------------
         * SLATE'S RECIPE, AND IT IS A ONE-USE RECIPE ON PURPOSE (slate-shell.css
         * .slate-caution): a 3px danger rule down the leading edge, a ten-percent danger
         * wash behind it, note size at medium weight. Every token it needs already exists
         * in this skin, which is why carrying it costs a rule rather than a component.
         *
         * WHY IT IS NOT ui-alert-banner. That component is the Live screen's strip and
         * carries a --ui-display-xl headline about fifty pixels tall; on a settings page
         * it would shout over the setting it is warning about. A caution is a paragraph
         * that has been given a colour and a bar, not an alert.
         *
         * WHY IT IS NOT A GENERAL CLASS. Exactly one paragraph in this file wears it, and
         * that is the point: a caution that appears on several pages stops being read.
         * The day a second one earns it, the rule is here and does not need rewriting. */
        .caution {
            display: block;
            margin: 0;
            /* SLATE'S OWN 70ch, WHICH IS THIS SKIN'S PROSE MEASURE TOKEN TO THE CHARACTER
             * (--ui-measure: 70ch). Spelling the number here would have been a section
             * declaring its own width, which is exactly what T21 was; the token says the
             * same thing and moves with every other paragraph on the page. */
            max-inline-size: var(--ui-measure);
            padding: var(--ui-space-3) var(--ui-space-4);
            border-inline-start: 3px solid var(--ui-status-danger);
            border-radius: var(--ui-radius);
            background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-medium);
            line-height: 1.5;
        }

        /* ---- machine info: the fact list ----------------------------------
         * A HEADING AND ITS ONE ACTION SHARE A LINE, which is where Slate puts Copy all
         * and why: dropped inline on the Serial row it "forced that one row 60% deeper
         * than its neighbours (101px against 63) so the list visibly sagged at one line —
         * and it never belonged to Serial anyway: it copies the whole block".
         */
        .fact-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .facts {
            margin: 0;
            display: grid;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        /* ONE OWNER OF THE VALUE COLUMN, which is the alignment fix Ben asked for
         * (M-INFO-50). Every value ends on the same edge because the values share ONE
         * track, not because each row happens to measure the same: the term takes the
         * space it needs and the value is aligned to the end of the rest. The ui-numeric
         * role on the value carries the tabular figures, so a serial number and a voltage
         * line up digit for digit. NO BACKTICK IN THIS COMMENT: one ends the template. */
        .fact {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: baseline;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .fact > dt {
            margin: 0;
            min-inline-size: 0;
        }

        .fact > dd {
            margin: 0;
            text-align: end;
        }

        /* A GROUP WHOSE HEADING AND CONTROL SHARE A LINE — the power switch, and
         * the one shape in this leaf that is not heading-over-control.
         * SOURCE settings.js:3953-3955, a flex row with justify-between: the word
         * on the left, the switch hard right. CITE settings-accessories-lighting
         * [i=69] span "Power" rect [1503,277,53,27] against [i=70]
         * label.slate-switch rect [1729,265,100,50] — one line, two ends.
         * It wraps, because a heading and a control that no longer fit have to go
         * somewhere and the alternative is inline overflow (spec 2.4). */
        .group.inline {
            grid-auto-flow: column;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
        }

        /* ---- accessories-lighting: the two columns ------------------------
         * INTRINSIC, NOT A BREAKPOINT. auto-fit over a track minimum gives two
         * columns when two fit and one when they do not, with no query and no
         * viewport in it - the same shape #40 uses and the same reason.
         *
         * The track minimum carries Slate's own min-w-[420px] (settings.js:3916,
         * quoted in spec 4.4) as a PRIVATE knob with a default, which is how #40
         * and #51 both express theirs. It is a floor, never a cap: nothing here
         * can make the leaf wider than the pane. */
        #lighting {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(var(--_ui-lighting-col-min), 100%), 1fr));
            gap: var(--ui-space-6);
            align-items: start;
            min-inline-size: 0;
        }

        #lighting > .column {
            display: grid;
            gap: var(--ui-space-5);
            align-content: start;
            min-inline-size: 0;
        }

        /* The four current colours: zone down the side, bank across the top. */
        #current {
            display: grid;
            grid-template-columns: auto repeat(2, minmax(0, 1fr));
            gap: var(--ui-space-2);
            align-items: center;
            min-inline-size: 0;
        }

        /* A CHIP IS A BUTTON AGAIN (cmp-ss-2, 21 Aug 2026).
         *
         * Slate's were: settings.js:3893 renders each cell as a button calling
         * ledSelectCell(zone, state), so tapping the colour you can see selects the
         * pair the pickers edit. The rebuild made them spans and the shortcut went with
         * them, undeclared — the function survived only on the two banks above, which
         * is two presses instead of one at the exact moment a person is pointing at the
         * thing they mean.
         *
         * It is a plain button and not a component: the whole control is one colour,
         * there is nothing to lay out inside it, and the nearest library piece
         * (#52 ui-colour-swatch-row) is the PRESET row's job one column over. The
         * paint is unchanged from the span it replaces; what is added is the button
         * reset a UA font shorthand and default chrome would otherwise impose. */
        .chip {
            block-size: var(--ui-control-h);
            border-radius: var(--ui-radius);
            border: var(--ui-border-w) solid var(--ui-line);
            background-color: var(--_ui-chip-fill, var(--ui-fascia));
            min-inline-size: 0;

            padding: 0;
            font: inherit;
            color: inherit;
            cursor: pointer;
        }

        /* THE ONE PROPERTY selectionSurface MUST NOT TAKE, and the reason is #52's
         * own, quoted: "No state selector touches this element. That is what lets the
         * button above be the selection surface without erasing the colour the row is
         * about." A preset swatch can say that because its fill lives on an inner
         * sample; this cell HAS no inner sample, because the cell IS the colour the
         * machine is wearing. So the fill wins here explicitly - (0,2,0) against the
         * fragment's (0,1,0), no !important, and the fallback keyword carries no
         * palette information. Everything else the fragment paints is welcome: the
         * cell has no text, so ink, weight and the glow are invisible on it, and the
         * LED strip is the mark.
         *
         * ARIA-PRESSED IS THE WHOLE STATE (Appendix 15), so the ring is driven off it
         * rather than off a second 'data-current' attribute saying the same thing in a
         * second spelling - which is exactly what #52 writes for its own swatch
         * ('ui-colour-swatch-row.js:399'). One spelling, one selector, and the
         * fragment and the ring now agree by construction.
         *
         * THE RING ITSELF IS A KEEP AND NOT A DEPARTURE. Slate's own code marks the
         * cell being edited - 'border-2 border-[var(--mimoja-blue)]' on the current
         * cell against '--profile-button-outline-color' on the other three
         * (settings.js:3893) - and it NEVER RENDERS: an id-scoped !important block
         * flattens every button in the subpage to one hairline.
         *   CITE settings-accessories-lighting [i=52] (the current cell, authored
         *        border-[var(--mimoja-blue)]) border-top-color rgb(58, 72, 82)
         *        border-top-width 1px, winning rule slate-shell.css
         *        {#subpage-host #settings-content-area :is(button, [role="button"])
         *         :not(.toggle):not(.slate-stepper > *):not(.slate-bank-item)}
         *        authored " !important" - byte-identical to [i=53]/[i=55]/[i=56].
         * So the old skin tells you which pair the picker is editing in words only.
         * This draws the mark its own source intended. */
        .chip[aria-pressed="true"] {
            background-color: var(--_ui-chip-fill, var(--ui-fascia));
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        /* ---- calibration-load-cells: the card that must not jump ----------
         * THE ONE SURVIVING LAYOUT RULE (SCOPE Part 6, loadcell-cal.js row): a
         * single button that swaps label and action in place, plus a
         * fixed-height status slot. The first cut of the rebuild was rejected
         * for jumping, so the slot's block-size is a FLOOR and the button is one
         * element whose text changes - never two buttons swapped in and out,
         * which is the other way to make a card jump.
         *
         * THREE FLOORS, BECAUSE THE CARD HAS THREE THINGS THAT CAN CHANGE SIZE:
         * the status sentence (empty, one line or two), the body copy (the weigh
         * step's is two lines where the other eight are one) and the weight
         * stepper, which used to enter the card at the weigh step and moved it
         * 260 -> 366px. The stepper is now always rendered and its SLOT is
         * floored too, so a limits table with no calibrationWeight row leaves
         * the card exactly where it was rather than 82px shorter. */
        #status {
            min-block-size: var(--ui-cal-status-h);
            margin: 0;
            display: flex;
            align-items: start;
        }

        /* THE BODY COPY'S FLOOR, now on the section rather than on a card that no longer
         * exists. The five steps' sentences are one to three lines, and a section whose
         * height follows the sentence would move the button under the reader's finger. */
        #wizard-surface > .prose {
            min-block-size: var(--ui-cal-body-h);
        }

        /* ONE CONTROL HIGH, from the control's own token rather than a third
         * proposal: #4 renders at --ui-control-h with its label spoken, so the
         * slot that holds it is that tall whether it is filled or not. */
        #cal-weight-slot {
            display: grid;
            align-content: start;
            min-block-size: var(--ui-control-h);
            min-inline-size: 0;
        }



        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            align-items: center;
        }

        /* ---- select-language: a tile ---------------------------------------
         * The GRID is #40 and owns the fluidity; a tile owns only its own
         * insides. Two lines, endonym over English name, which is Slate's
         * .slate-lang-endonym / .slate-lang-english pair as content. */
        .tile {
            display: grid;
            gap: var(--ui-space-1);
            justify-items: start;
            text-align: start;
            inline-size: 100%;
            min-block-size: var(--ui-control-h);
            padding: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-fascia);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        /* Border only. Face, ink, weight and the LED come from 'selectionSurface' at
         * the end of this list, which is what surface 3 landed; these two declarations
         * are different properties, so the two rules compose instead of colliding. */
        .tile[aria-pressed="true"] {
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        /* BOTH LINES INSIDE A SELECTED TILE TAKE THE SELECTED INK. A type role is
         * authored inside ':where()' so it carries (0,0,0) - but it is a declaration ON
         * the span, and a declaration beats an inherited value at any specificity, so
         * without this rule each line keeps its role ink on a face that is no longer
         * dark: the English name stays muted, and the endonym stays --ui-text - which is
         * near-white on the selected face. Slate flips both:
         *   CITE settings-units---language-select-language [i=40]
         *        .slate-lang-endonym inside the aria-checked tile, color rgb(18, 24, 28)
         *   CITE settings-units---language-select-language [i=41]
         *        .slate-lang-english inside the same tile, color rgb(18, 24, 28)
         *        against rgb(148, 161, 169) on the other 29 ([i=44] and its siblings).
         * (0,3,0) per selector, one property, scoped to this one control. (The first
         * draft carried the caption half only; the review measured the endonym at
         * rgb(244, 247, 248) on the face and added the heading half.) */
        .tile[aria-pressed="true"] .ui-heading,
        .tile[aria-pressed="true"] .ui-caption {
            color: inherit;
        }

        /* ---- display-skin and updates: a card's insides -------------------- */
        .entry {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-2) var(--ui-space-3);
            min-inline-size: 0;
        }

        .entry > .grow {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        /* ---- the skin tiles -------------------------------------------------
         * TWO LINES, WHICH IS SLATE'S SHAPE: the name, then the version and its badges
         * under it. They were four items on ONE line with the name at the far left and
         * the version at the far right, so reading a build number meant a sweep across
         * an empty card. */
        .skin-card {
            position: relative;
        }

        /* THE WHOLE TILE IS THE TARGET. A press area smaller than the thing it looks like
         * is the class of defect a tile grid invites, so the button fills the card
         * rather than sitting inside it. */
        .skin-press {
            all: unset;
            display: block;
            cursor: pointer;
            min-inline-size: 0;
        }

        .skin-press:focus-visible {
            outline: var(--ui-focus-w) solid var(--ui-focus);
            outline-offset: var(--ui-focus-offset);
        }

        .skin-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .skin-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        /* THE ACTIVE MARK IS A PILL IN THE CORNER, not a word in the middle of the meta
         * line — Slate's own placement, and the one that survives a long skin name. */
        .skin-active {
            position: absolute;
            inset-block-start: var(--ui-space-3);
            inset-inline-end: var(--ui-space-3);
            padding: var(--ui-space-1) var(--ui-space-2);
            border-radius: var(--ui-radius-sm);
            background: var(--ui-selected-face);
            color: var(--ui-selected-ink);
        }

        /* ═══ THE FRAGMENT STOPS AT A NESTED COMPONENT'S HOST ═══════════════
         *
         * MEASURED, AND IT IS THE REASON THIS RULE EXISTS. selectionSurface's
         * light-DOM half matches five spellings on ANY element in the tree it is
         * adopted into. Inside a component that is exactly right - the tree is the
         * component's own. Inside a SCREEN it is not: this leaf hosts nine library
         * components, and one of them - #5 ui-switch - puts role=switch and
         * aria-checked on its HOST. Composing the fragment therefore repainted the
         * Power switch: measured at settings--leaf-accessories-lighting, the switch
         * host went background rgba(0, 0, 0, 0) -> rgb(176, 196, 206), ink
         * rgb(244, 247, 248) -> rgb(18, 24, 28), weight 400 -> 500, against an
         * oracle whose own switch [i=70] paints none of the three.
         *
         * AND ui-switch REFUSED THAT PAINT IN WRITING (ui-switch.js:230-236): "a
         * switch is not a selection surface: the oracle paints its ON track from
         * --slate-primary (the primary-action fill), not from --slate-selected-face
         * ... Importing the fragment would repaint this track in --ui-selected-face
         * and lose the polarity the sheet documents." An ancestor had reintroduced
         * from outside the defect the component declined - and a rule in the outer
         * tree beats a :host rule for normal declarations, so the component could not
         * defend itself.
         *
         * SO THE SCOPE IS STATED, not the exception. This screen draws exactly THREE
         * selectable things of its own — .tile, .chip and .day; everything else in its
         * tree is a component and paints itself. (.day joined on 24 Aug 2026 with the
         * wake-schedule editor: seven weekday toggles are a multi-select, which is the
         * one shape #3 ui-bank cannot be, because a bank is a radiogroup.) (0,3,0) against the fragment's (0,1,0),
         * no !important, and every value is a keyword that carries no palette
         * information - so what a nested host gets back is what it had before the
         * fragment was composed, whichever component it turns out to be. */
        :not(.tile):not(.chip):not(.day):is(
            [aria-pressed="true"],
            [aria-selected="true"],
            [aria-checked="true"],
            [aria-current="true"],
            .is-selected
        ) {
            background-color: transparent;
            color: inherit;
            font-weight: inherit;
            box-shadow: none;
            text-shadow: none;
        }

        /* ---- machine-sleep-wake-schedules --------------------------------
         * FOUR LAYOUT CLASSES AND NO PAINT. Everything visible here is a component or
         * a type role; these say only how the pieces sit. */

        /* A label on the left, a control on the right — the shape #29 has for a
         * primitive row, borrowed for the two rows that are not registry rows. */
        .sw-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
        }

        /* AND THE FOURTH ONE, FOUND BY THE AUDIT RECAPTURE. The .form-row rule below was
         * written for exactly this defect and fixed three pages; the WiFi-scale address
         * entry was in a .sw-row instead and kept it. MEASURED beside Slate's page on
         * 26 August 2026: the field drew about 40px wide and 55 tall — narrower than it
         * was tall, with no label and no room for the placeholder it carries.
         *
         * A FIELD IN THIS ROW TAKES THE FORM CONTROL WIDTH, the same one the settings
         * rows and the form rows use, so an address entry is the same size wherever it
         * appears. The flex: none below keeps it that size when the row wraps.
         * NO BACKTICK IN THIS COMMENT: one would end the css template here. */
        .sw-row > ui-text-field {
            flex: none;
            inline-size: var(--_ui-form-control-w);
        }

        /* ---- a form row with a REAL control column --------------------------
         * MEASURED DEFECT, and it was the same one on three pages: a text field inside a
         * space-between flex row is an intrinsically-sized element with nothing telling it
         * how wide to be, so it collapsed to about 40px — narrower than it was tall, and
         * half-clipped by the surface's edge. The Visualizer page had four of them.
         *
         * SO THE ROW IS A GRID AND THE CONTROL COLUMN IS DECLARED. The label block takes
         * the slack and the control takes a stated width, which is the shape the settings
         * row reaches by its own route — and it is why every registry page lines up and
         * these did not. NO BACKTICK IN THIS COMMENT: one ends the css template. */
        .form-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) var(--_ui-form-control-w);
            align-items: center;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        /* A SWITCH IS NOT A FIELD. It states its own size, so its column is content-sized
         * and the label takes everything else — a switch stranded in the middle of a wide
         * track would read as a control that had lost something. */
        .form-row[data-control="switch"] {
            grid-template-columns: minmax(0, 1fr) auto;
        }

        .form-row > .sw-label {
            min-inline-size: 0;
        }

        .sw-stack {
            display: grid;
            gap: var(--ui-space-1);
        }

        .sw-label {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        /* The row's own opener fills the space the list row gives it, so the whole
         * time-and-days line is the target rather than the text's own width. */
        .sw-schedule-open {
            display: grid;
            gap: var(--ui-space-1);
            justify-items: start;
            text-align: start;
            flex: 1 1 auto;
            min-inline-size: 0;
            padding: 0;
            border: 0;
            background: none;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .sw-editor {
            display: grid;
            gap: var(--ui-space-5);
        }

        .sw-days {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-2);
        }

        /* A WEEKDAY TOGGLE. The .tile shape at chip width — same border, same radius,
         * same reset — because it is the same kind of thing and a second set of values
         * would be a second answer to "what does a selectable look like here".
         * The FACE, INK and WEIGHT come from 'selectionSurface' at the end of this
         * list, exactly as the tile's do; these two declarations are the border. */
        .day {
            display: grid;
            place-items: center;
            min-inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            padding-inline: var(--ui-space-2);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-fascia);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .day[aria-pressed="true"] {
            border-width: var(--ui-border-w-strong);
            border-color: var(--ui-line-strong);
        }

        /* ---- maintenance: the preparation list -----------------------------
         * A REAL ORDERED LIST, because the order is the point — the tank is filled
         * before the portafilter comes out. The UA's own marker and inset are kept;
         * what is set here is the rhythm, so the steps sit in the leaf's gap scale
         * rather than in a browser's. */
        /* A DOCUMENT LINK, which is not a button and must not look like one: it leaves
         * the skin. Slate underlines its own and paints it in the accent. */
        .doc-link {
            /* THE TOKEN NAMED HERE DID NOT EXIST, AND THE LINK WAS INVISIBLE.
             *
             * This rule named a custom property that does not exist — an --ui-accent, with
             * no -ink on the end — and styles/tokens.css has no such
             * custom property — the accent is deliberately THREE names, and the token
             * file's own paragraph says which is which: "--ui-primary is a FILL and never
             * a glyph colour ... --ui-accent-ink is what anything drawing the accent as a
             * glyph or a label reads instead." An unresolvable var() leaves the colour
             * unset, so every doc link in this file inherited the muted grey of the
             * caption around it — a declared style that matched nothing, which is exactly
             * the defect class this fork exists to remove, sitting inside the fix for it.
             * MEASURED before the repair: the support address on Talk to Decent computed
             * rgb(148, 161, 169), the same value as the sentence it sits in.
             *
             * AND AN UNDERLINE, because colour alone is not enough on a touch screen and
             * Slate underlines its own. It is the one affordance that says "this leaves
             * the skin" without borrowing a button's look. */
            color: var(--ui-accent-ink);
            text-decoration: underline;
            text-underline-offset: 0.15em;
            justify-self: start;
        }

        /* ---- the screen saver's picture set -------------------------------
         * A WRAPPING ROW OF THUMBNAILS, sized by a private track minimum rather than a
         * count: a set of one and a set of twelve are both legible, and neither needs a
         * breakpoint. */
        /* ---- the connection pages: one grid for every device row -----------
         * FOUR TRACKS, SHARED BY EVERY ROW, which is Ben's "controls sit in a grid,
         * aligned vertically with those in the list". Each row sizing its own controls is
         * what makes a list look ragged; one grid over all of them lands every chip,
         * every toggle and every button on the same edges.
         *
         * THE NAME TAKES THE SLACK and the other three take what they need, so a long
         * device address wraps inside its own cell rather than pushing the actions off
         * the row. */
        /* ---- the plugin list ------------------------------------------------
         * THREE TRACKS, ONE GRID, exactly as the device list beside it: the name and its
         * blurb take the slack, the switch and the actions take what they need, and every
         * row lands on the same two edges. */
        /* ---- the keyboard bindings ------------------------------------------
         * THREE TRACKS: the action's name takes the slack, the keycap and the Rebind
         * button take what they need. They were two nested flex rows, so every row sized
         * its own controls and the column was ragged. */
        .bindings {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: var(--ui-space-3) var(--ui-space-5);
            min-inline-size: 0;
        }

        .binding {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .bindings-reset {
            justify-self: start;
        }

        .plugins {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: var(--ui-space-4) var(--ui-space-5);
            min-inline-size: 0;
        }

        .plugin {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .plugin-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        /* THE NAME AND ITS VERSION SHARE A BASELINE, which is where a person looks for a
         * build number. It was on a third line, after the author. */
        .plugin-title {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
            min-inline-size: 0;
        }

        /* TWO LINES AND THEN AN ELLIPSIS. It was cut dead at the row edge, mid-word, with
         * no mark at all — which reads as a rendering fault rather than as a summary. */
        .plugin-blurb {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
        }

        /* ---- help > talk to decent: the message thread -----------------------
         *
         * A LIST, NOT SLATE'S CHAT BUBBLES, and the reason is on #supportMessage. Slate
         * draws left- and right-aligned rounded bubbles with a cartoon avatar fetched per
         * message from decentespresso.com; the alignment says the same thing the author
         * name already says, and the avatar is a third-party request from a settings page.
         *
         * IT SCROLLS INSIDE ITSELF, WHICH IS SLATE'S ONE STRUCTURAL IDEA HERE WORTH
         * KEEPING (max-h-[480px] overflow-y-auto). A thread grows without bound and the
         * compose box sits below it: without a cap, a long conversation pushes Send an
         * arbitrary distance down a pane that is already the scroll region, and the page
         * appears to have lost its own control. A second scroller is a real cost on a
         * touch screen and it is paid deliberately, for that.
         *
         * THE CAP IS A SHARE OF THE APP, NOT SLATE'S 480. Gate C's viewport-unit rule names
         * the two legitimate routes for a share - --ui-app-h / --ui-app-w, or a container
         * query - and forbids the viewport, because app-fit.js draws this skin at a
         * 1200-unit reference height and scales it, so a viewport unit resolves against the
         * tablet's 801 layout units where the design says 1200. A container query is not
         * available here either: nothing on this pane establishes a container, so cqb would
         * silently fall back to the small viewport and reintroduce exactly that bug. So the
         * cap is four tenths of the app's own height, which is Slate's own 480 at the
         * 1200-unit reference - the same number, arrived at as a proportion so it stays
         * right at every size.
         *
         * AND NO FALLBACK INSIDE THE var(). Without --ui-app-h the calc is invalid and the
         * declaration is dropped, so the thread is UNCAPPED and the pane scrolls - which is
         * the honest degradation. A fallback would have to be a length, and every length
         * available here is either the viewport (forbidden, and wrong on the tablet by a
         * third) or the reference height typed out, which is one of the frozen numbers this
         * file's own suite refuses to let anybody spell.
         *
         * NO GROUND AND NO BORDER ON THE LIST. Slate boxes it; CONVENTIONS 13 in this tree
         * is "a divider is a gap, not a border", and the section heading above already says
         * where the thread begins. What separates two messages is the gap between them.
         *
         * WHITE SPACE IS PRESERVED IN THE BODY. A support message is typed prose with its
         * own line breaks, and collapsing them would run a numbered list of symptoms into
         * one paragraph. Slate does the same (whitespace-pre-wrap) and it is the one paint
         * decision of its bubble carried over. */
        .thread {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: var(--ui-space-5);
            max-block-size: calc(0.4 * var(--ui-app-h));
            overflow-y: auto;
            min-inline-size: 0;
        }

        .message {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .message-head {
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .message-body {
            margin: 0;
            max-inline-size: var(--ui-measure);
            white-space: pre-wrap;
        }

        .devices {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto auto;
            align-items: center;
            gap: var(--ui-space-3) var(--ui-space-5);
            min-inline-size: 0;
        }

        /* A DEVICE ROW AND THE HEADER OVER IT SHARE THE TRACKS AND NOT THE CLASS.
         *
         * The header was first written as a .device, and every query in the suite that
         * counted devices counted it — "both machines, the remembered one included, 3 !== 2"
         * on the first run. A class that means "a device" must mean only that, or every
         * reader of it has to learn the exception. They share the subgrid because they
         * share the columns; they share nothing else. */
        .device,
        .device-head {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: center;
            min-inline-size: 0;
        }

        .device-name {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .device-actions {
            display: flex;
            gap: var(--ui-space-3);
        }

        /* ---- the reset page's table -----------------------------------------
         * FOUR TRACKS, ONE GRID, and the two numeric columns end on the same edge so
         * "now" and "default" can be compared down the column rather than across the
         * row. */
        .resets {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto auto;
            align-items: baseline;
            gap: var(--ui-space-2) var(--ui-space-5);
            min-inline-size: 0;
        }

        .reset {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: subgrid;
            align-items: baseline;
            min-inline-size: 0;
        }

        .resets-num {
            text-align: end;
        }

        .thumbs {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .thumb {
            inline-size: var(--_ui-thumb-size);
            block-size: calc(var(--_ui-thumb-size) * 0.625);
            object-fit: cover;
            border-radius: var(--ui-radius);
            border: var(--ui-border-w) solid var(--ui-line);
        }

        /* THE WHOLE SECTION DIMS WITH THE TYPE (Ben: "if black or clock is selected the
         * section below greys out"). One dial, the base's own, on the container — the
         * controls inside carry their own disabled state for BEHAVIOUR, and this is the
         * paint that says the group does not apply. */
        .group[data-inert] {
            opacity: var(--ui-opacity-disabled);
        }

        .steps {
            margin: 0;
            padding-inline-start: var(--ui-space-5);
            display: grid;
            gap: var(--ui-space-2);
        }

        /* PROSE INSIDE AN EMPTY STATE READS LEFT, WHICH IS SLATE'S OWN ANSWER AND NOT A
         * DEPARTURE FROM T11. #38 declares text-align: center on its own block so that no
         * screen sheet can left-align the HEADING — that is the whole of T11 — and the
         * component's header is explicit that a SLOTTED paragraph is a different case:
         * it lives in this element's tree, an outer normal declaration already outranks
         * ::slotted, and Slate's own library left-aligns the supporting caption of this
         * very card (slate-components.css .slate-caption). A numbered list whose markers
         * and text drift toward the middle of the box is unreadable, and three steps is
         * the shape this page is made of. The heading stays centred. */
        ui-empty-state .steps,
        ui-empty-state .prose {
            text-align: start;
        }

        /* ---- plugins and connection: rows inside a group -------------------
         * A list row fills its group, exactly as a settings row fills a leaf. */
        ui-list-row {
            display: flex;
        }
    `,

    /* THE SELECTION SURFACE, LAST (CONVENTIONS §4: structural fragments first, state
     * fragments last) — parity surface 3, landing surface 2's hand-forward.
     *
     * WHY IT WAS MISSING AND WHAT THAT COST. Two controls in this file state a selected
     * state — the language tile and the lighting cell — and both drew it by hand, so the
     * FIFTH DIAL (--ui-selected-weight, surface 2) could not reach either. Measured on
     * the tile before this line: background rgb(14, 19, 23) at weight 400, against the
     * oracle's
     *   CITE settings-units---language-select-language [i=39] .slate-lang-tile
     *        aria-checked=true background-color rgb(176, 196, 206) color rgb(18, 24, 28)
     *        font-weight 500  — one of the 95 elements the surface-2 census found at
     *        --slate-selected-face / 500, and the other 29 tiles in the same state are
     *        rgb(26, 33, 39) / rgb(244, 247, 248) / 500.
     * The fragment paints exactly those three values from the four dials plus the fifth,
     * so the tile now turns selected the way every other selectable in the skin does.
     *
     * AND THE ONE THING IT MUST NOT REPAINT — see `.chip` below. */
    selectionSurface];

    #i18n = new I18nController(this);

    /** Every store subscription this leaf holds, so `disconnectedCallback` undoes them. */
    #unwatch = [];

    /** The last machine step seen, so the walk can notice a zeroing run finishing. */
    #lastStep = null;

    /**
     * What `#load()` has already asked for: `<leafId>|open` or `<leafId>|closed`.
     *
     * A GATE THAT OPENS LATE HAS TO ISSUE THE READ IT DID NOT ISSUE. `#load()` is called
     * from `updated()` (leaf or deps changed) AND from the capability subscription, which
     * fires whenever the answer to "may I render" may have moved. This key is what keeps
     * the second caller from re-reading on every bump: the read fires once per leaf per
     * gate state, and a gate that closes and re-opens reads again because the key changed
     * twice.
     */
    #loadKey = null;

    constructor() {
        super();
        this.leafId = '';
        this.deps = null;
        this.theme = null;
        this._version = 0;
        this._ledZone = LED_ZONE_ITEMS[0].value;
        this._ledBank = LED_BANKS[0];
        this._weight = CAL_DEFAULT_WEIGHT;
        /* THE TWO BITS OF THE WALK THE MACHINE CANNOT REPORT — see `#calStage`. */
        this._calStarted = false;
        this._calZeroed = false;
        /* What the scale reads now, for the check step. Whole tenths of a gram. */
        this._scaleWeight = null;
        this._schedule = null;
        this._typing = null;
        this._confirm = null;
        /* NULL IS "NOT KNOWN", not "idle" (A7). A leaf with no machine feed behind it has
         * never been told what the machine is doing, and a page that started from `idle`
         * would be asserting a state on a machine it cannot hear. */
        this._machineState = null;
        this._procedureSeen = null;
        this._defaultsFailed = false;
        this._pluginDraft = null;
        this._pluginSettingsFor = null;
        this._pluginOpenFailed = false;
        this._feedback = null;
        this._support = null;
        this._supportIncomplete = false;
        this._nightEdit = null;
        this._updateRefusal = null;
        this._wifiHost = '';
        this._flashPending = null;
        this._flashRejected = null;
        this._captureAction = null;
        this._bindingConflict = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watch();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#drop();
        /* THE CAPTURE LISTENER IS ON THE DOCUMENT, so it outlives this element unless it
         * is removed here. One left behind would rebind a key on the next keystroke
         * anywhere in the app, long after the settings page was gone. */
        this.#stopCapture();
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('deps') || changed.has('theme')) this.#watch();
        if (changed.has('leafId') || changed.has('deps')) {
            this.#lastStep = null;
            this._calStarted = false;
            this._calZeroed = false;
            /* EVERY DRAFT DIES WITH ITS LEAF. A staged plugin setting, a half-written
             * feedback note or an open capture belongs to the page it was started on;
             * carrying one to the next leaf is how a Save button writes to the wrong
             * plugin. */
            this._schedule = null;
            this._confirm = null;
            /* `_machineState` AND `_procedureSeen` ARE DELIBERATELY NOT CLEARED HERE, and
             * they are the only two survivors of this block. Both are readings of the
             * MACHINE rather than drafts of the page: one is what it is doing, the other
             * is a state it has been seen in. Clearing them on a leaf change would lose the
             * falling edge in the ordinary case — start the purge, look at another page
             * while it runs, come back — because the latch is set on the TRANSITION into
             * the state and a machine already purging never transitions again.
             *
             * NOTHING LEAKS BETWEEN THE TWO PAGES, because the latch holds a state NAME and
             * each page tests it against its OWN state: a seen `airPurge` can never satisfy
             * the descaling page's `_procedureSeen === MACHINE_STATE.DESCALING`. */
            this._flashPending = null;
            this._flashRejected = null;
            this._defaultsFailed = false;
            this._pluginDraft = null;
            this._pluginOpenFailed = false;
            this._feedback = null;
            this._nightEdit = null;
            this._updateRefusal = null;
            this._wifiHost = '';
            /* AND THE STORE'S OWN DRAFT — the refusal from the last device or endpoint
             * action. It lives in a store rather than on this element because the store is
             * what learned about it, but it belongs to the PAGE the button was pressed on:
             * carrying a refused Forget from the Machine page onto the Scale page would put
             * a sentence about a device the Scale page has never shown under its list. This
             * is `clearWriteError`'s caller; before 26 August 2026 it had none anywhere in
             * `src/`, which is the same finished-half-with-no-other-half shape as the rest
             * of this pass. */
            this.deps?.scaleConnect?.clearWriteError?.();
            this.#stopCapture();
            this._captureAction = null;
            this._bindingConflict = null;
            this.#loadKey = null;
            this.#load();
        }
    }

    #drop() {
        for (const off of this.#unwatch) off();
        this.#unwatch = [];
    }

    /**
     * ONE SUBSCRIPTION PER STORE, TAKEN ONCE. Four stores can move this leaf and each of
     * them bumps the same counter, so a leaf re-renders on a change rather than on a poll
     * — and a leaf that changed twice re-renders twice, not four times.
     *
     * AND ONE MORE, WHICH IS A3'S: the capability answer. Without it the gate LATCHES —
     * `allowed()` is asked once at mount, the capability read is still in flight (or
     * failing, which is what the mock does), and nothing ever asks again: `deps` is
     * memoised per boot, so no property changes when the answer lands and `updated()`
     * never fires. The listener carries no capability data. It bumps the beacon so the
     * surface re-renders, and calls `#load()` so the READ a closed gate suppressed is
     * issued now that it is open — fail-closed must be a state, not a one-shot verdict.
     */
    #watch() {
        this.#drop();
        const bump = () => { this._version += 1; };
        /* THE SCALE, FOR THE CALIBRATION WALK, AND REPAINTED ONLY WHEN IT MOVES. The
         * scale sends at about 10 Hz; a settings page that re-rendered on every frame
         * would rebuild the walk thirty times a second to change one number. A tenth of a
         * gram is what the walk prints, so a tenth of a gram is what counts as a change.
         *
         * READ THROUGH THE ADDRESS LAYER, NOT OFF `state.frame` — corrected 27 August 2026,
         * when the reading grew from one step of the walk to four (point 103) and a wrong
         * number became four times as visible.
         *
         * `frame` IS THE DIAGNOSTIC COPY and the store says so at the field: "The raw
         * frame. Diagnostic — the VALUE is what consumers read" (`feed-store.js:122`).
         * Reading it worked, in the sense that a number came out, and skipped both things
         * the layer exists to do. `readScaleSnapshot` applies the absence semantics — a
         * `{"status":"disconnected"}` envelope has no `weight` at all and is a scale that
         * is present and reporting nothing — and `status` carries staleness, which a raw
         * frame cannot. Off the raw frame, a scale whose socket closed left its LAST weight
         * on screen for ever.
         *
         * THAT IS A LIE THIS PAGE IN PARTICULAR MUST NOT TELL. `live-wiring.js` makes the
         * general argument ("a gauge that went on showing 9.2 bar behind a socket that
         * closed"); here the frozen number sits under the sentence asking the user to
         * confirm the load cells are carrying nothing before a fifteen-second zero. A stale
         * 0.0 g would say the platform is off when it is on. STALE reads as an absence, and
         * an absence is the absence dash (A7). Same three-part test the Live screen makes:
         * not stale, `ok`, and the channel has a reading. */
        const scaleFeed = this.deps?.scaleFeed;
        if (scaleFeed && typeof scaleFeed.subscribe === 'function') {
            this.#unwatch.push(scaleFeed.subscribe((state) => {
                const reading = state && state.status !== FEED_STATUS.STALE ? valueOf(state) : null;
                const grams = reading?.ok === true && hasReading(reading.weight)
                    ? Number(reading.weight)
                    : NaN;
                const next = Number.isFinite(grams) ? Math.round(grams * 10) / 10 : null;
                if (next !== this._scaleWeight) this._scaleWeight = next;
            }));
        }
        /* THE MACHINE, FOR THE TWO MAINTENANCE PAGES, AND ONLY ITS STATE NAME.
         *
         * The snapshot feed is the ~10 Hz workhorse and carries ten numeric channels; not
         * one of them is drawn on either maintenance page. What those pages need is one
         * string — `descaling`, `airPurge`, `needsWater`, or whatever else the machine is
         * doing — so that is the only thing stored, and a repaint is taken only when THE
         * STRING CHANGES. Subscribing to the frame itself would rebuild the checklist ten
         * times a second to redraw a sentence that had not moved.
         *
         * AND THE SEEN-IT-RUN LATCH IS SET HERE, beside the read that establishes it: a
         * state this leaf has actually observed the machine in is a fact about the feed,
         * not about the render, and deriving it during render would make it depend on
         * which page happened to be open when the frame landed. */
        const machineFeed = this.deps?.machineFeed;
        if (machineFeed && typeof machineFeed.subscribe === 'function') {
            this.#unwatch.push(machineFeed.subscribe((state) => {
                const name = state?.value?.state;
                const next = typeof name === 'string' && name !== '' ? name : null;
                if (next === this._machineState) return;
                this._machineState = next;
                if (next === MACHINE_STATE.DESCALING || next === MACHINE_STATE.AIR_PURGE) {
                    this._procedureSeen = next;
                }
            }));
        }
        /* THE APP-UPDATE FEED, SUBSCRIBED PLAINLY AND WITHOUT A THROTTLE — which is the
         * opposite of the three feeds above and is a fact about the publisher rather than
         * a shortcut. `UpdateCheckService` emits on a PHASE CHANGE, and during a download
         * only when the fraction has moved a whole percent (`p - lastEmitted >= 0.01`). So
         * every frame that arrives here is a frame this page draws differently, and a
         * guard would be filtering nothing. */
        const updateFeed = this.deps?.appUpdate?.feed;
        if (updateFeed && typeof updateFeed.subscribe === 'function') {
            this.#unwatch.push(updateFeed.subscribe(bump));
        }
        for (const name of ['machineInfo', 'led', 'calibration', 'skins', 'firmware', 'appInfo', 'presence', 'plugins', 'account', 'support', 'feedback', 'scaleConnect', 'app', 'machineState']) {
            const store = this.deps?.[name];
            if (store && typeof store.subscribe === 'function') this.#unwatch.push(store.subscribe(bump));
        }
        const settings = this.deps?.settings;
        if (settings && typeof settings.subscribe === 'function') {
            for (const key of ['theme', 'language', 'lastBrightness', 'keyboardBindings']) {
                try { this.#unwatch.push(settings.subscribe(key, bump)); } catch { /* not a settings key here */ }
            }
        }
        const watchAllowed = this.deps?.watchAllowed;
        if (typeof watchAllowed === 'function') {
            this.#unwatch.push(watchAllowed(() => { bump(); this.#load(); }));
        }
        /* AND THE THEME CONTROLLER, which arrives as its own property rather than in
         * the bundle (settings-screen.js says why). It publishes on every change —
         * including one made by `followSystem` while this leaf is on screen — so the
         * bank shows what is painted rather than what was painted when it mounted. */
        if (this.theme && typeof this.theme.subscribe === 'function') {
            this.#unwatch.push(this.theme.subscribe(bump));
        }
    }

    /**
     * Read what THIS leaf needs, and nothing else.
     *
     * Fire and forget, like `<settings-leaf>`'s: the read lands in a store, the store
     * bumps its beacon and the beacon re-renders. A gated leaf reads NOTHING — fail-closed
     * covers the request as well as the surface, so an absent capability does not produce
     * a call to the machine that advertised no such feature.
     *
     * CALLED TWICE OVER, AND IDEMPOTENT BETWEEN THEM. `updated()` calls it when the leaf
     * or the boot changes; the capability subscription calls it when the answer to "may I
     * render" moves. `#loadKey` is what makes the second caller cheap: one read per leaf
     * per gate state, so a gate that opens after mount reads exactly once and a store
     * bumping its beacon does not re-read at all.
     */
    #load() {
        const deps = this.deps;
        if (!deps || !this.leafId) return;

        const capability = LEAF_CAPABILITY[this.leafId] ?? null;
        const key = `${this.leafId}|${capability && !this.#allowed(capability) ? 'closed' : 'open'}`;
        if (key === this.#loadKey) return;
        this.#loadKey = key;

        const go = (promise) => Promise.resolve(promise).catch(() => {});

        switch (this.leafId) {
            case 'machine-machine-info':
                go(deps.machineInfo?.load());
                break;
            case 'display-skin':
                go(deps.skins?.load());
                break;
            case 'updates-skin-app':
                go(deps.skins?.load());
                /* THE APP HALF'S ONE READ. `app-info-store` caches a successful answer for
                 * the life of the store, so paging in and out of this leaf costs one
                 * request rather than one per visit — a build cannot change under a
                 * running page. The UPDATE half needs no read at all: its socket is
                 * attached at boot and the current state arrives on subscribe, because the
                 * handler feeds from a seeded BehaviorSubject. */
                go(deps.appInfo?.load());
                break;
            case 'units-language-select-language':
                go(deps.settings?.load('language'));
                break;
            case 'accessories-lighting':
                if (this.#allowed('ledStrip')) go(deps.led?.load());
                break;
            case 'calibration-load-cells':
                if (this.#allowed('scaleCalibration')) go(deps.calibration?.read());
                break;
            case 'updates-firmware-update':
                go(deps.firmware?.load());
                break;
            case 'machine-sleep-wake-schedules':
                /* GATED BEFORE THE READ, like the LED and load-cell leaves above: on a
                 * machine with no wake scheduling there is nothing to ask for. */
                if (this.#allowed('wakeSchedule')) go(deps.presence?.load());
                /* AND HOW THIS PERSON WRITES A TIME (audit F-043). The store answers the
                 * shipped default for an unloaded key, so without this read the rows would
                 * draw the DEFAULT format while the Time page showed the stored one. */
                go(deps.settings?.load('clockFormat'));
                break;
            case 'extensions-plugins':
                go(deps.plugins?.load());
                break;
            case 'extensions-visualizer':
                /* THE LIST FIRST, THEN THE VALUES. The manifest carries the SCHEMA and
                 * the settings route carries the VALUES; the form needs both, and the
                 * schema decides which fields to ask about. */
                go(Promise.resolve(deps.plugins?.load()).then(() => deps.plugins?.loadSettings(VISUALIZER_PLUGIN_ID)));
                break;
            case 'help-talk-to-decent':
                /* THE ACCOUNT FIRST, AND THE THREAD ONLY IF IT IS LINKED (27 August 2026).
                 *
                 * `GET /account/decent` is a plain local read and answers in milliseconds;
                 * the thread goes out through the proxy to decentespresso.com and back,
                 * with the account's credentials attached server-side. Asking for the
                 * second before knowing the answer to the first would mean a round trip to
                 * a third-party host on every open of this page, on machines that have no
                 * account at all — and it would answer 401, which this page would then have
                 * to explain away. So the reads are SEQUENCED, not parallel, and the second
                 * one is conditional on the first.
                 *
                 * `loggedIn === true`, NOT TRUTHY. The account store's third state is
                 * `null` for "not asked" and its header insists the two are different
                 * sentences; a truthy test would collapse them and this branch would treat
                 * an unanswered read as a signed-out one. */
                go(Promise.resolve(deps.account?.load()).then(() => {
                    if (deps.account?.get?.()?.loggedIn === true) return deps.support?.load();
                    return null;
                }));
                /* AND THE TWO DOCUMENTS THE ATTACHMENT SWITCH NEEDS. Both are LOCAL reads
                 * — `GET /machine/info` and `GET /info`, this machine and this build — and
                 * neither goes anywhere near the account proxy, so they are asked for
                 * unconditionally beside the account read rather than behind it.
                 *
                 * WITHOUT THEM THE SWITCH IS NOT DRAWN AT ALL, which is why they are here
                 * rather than left to whichever other leaf happened to have been visited.
                 * `#supportDetails` answers null when neither document has landed and
                 * `#supportCompose` then omits the row — a switch that appends nothing is
                 * a control that changes nothing, and it would be invisible, because the
                 * reader never sees the body that gets sent. */
                go(deps.machineInfo?.load());
                go(deps.appInfo?.load());
                break;
            /* THE REMEMBERED LIST AND WHICH DEVICE IS PREFERRED, ON EVERY PAGE OPEN —
             * and STILL NO SCAN. A scan is a radio sweep that waits for the hardware, so
             * it happens when somebody presses Search and never on the way in to a page.
             * These two are ordinary reads of what ReaPrime already holds, and the page's
             * whole subject is what they say. */
            case 'connection-machine':
                go(deps.scaleConnect?.loadDevices());
                go(deps.scaleConnect?.loadPreferred());
                break;
            case 'connection-scale':
                go(deps.scaleConnect?.loadDevices());
                go(deps.scaleConnect?.loadPreferred());
                go(deps.scaleConnect?.loadEndpoints());
                break;
            case 'help-keyboard-shortcuts':
                go(deps.settings?.load('keyboardBindings'));
                break;
            case 'accessories-usb-charger':
                /* THE SAME DOCUMENT THE ROWS READ, through the same store — the rows
                 * reach it as a machine door and this half reads it directly, and there
                 * is one copy either way (`app-settings-store.js`). */
                go(deps.app?.load());
                /* AND THE CLOCK FORMAT, for the same reason the schedules leaf reads it. */
                go(deps.settings?.load('clockFormat'));
                break;
            default:
                break;
        }
    }

    /** A3, fail-closed on ABSENT and on UNKNOWN alike. No capability store at all is UNKNOWN. */
    #allowed(capability) {
        return this.deps?.allowed?.(capability) === true;
    }

    /**
     * ONE OUTER TEMPLATE, and the keypad hoisted into it.
     *
     * A LIT TEMPLATE IS KEYED BY ITS STRINGS ARRAY, so twenty-one separate
     * `return html` branches are twenty-one different templates and every leaf change
     * destroys and rebuilds whatever they hold. That is what kept the screensaver off
     * screen earlier the same day (`app-root.js`). The keypad has to outlive a leaf
     * change - a bespoke stepper can sit on any of three leaves - so it is rendered
     * ONCE here, beside the body, and the body keeps its own branch table below.
     */
    render() {
        return html`${this.#leafBody()}${this.#numberPad()}`;
    }

    /**
     * THE KEYPAD FOR THE STEPPERS ON THIS PANE, and only for them.
     *
     * TWO DOORS, ONE PER FIELD. `cal-weight` is a machine field, so its range comes
     * from `deps.limits` under its served key; the other three are app-side settings,
     * so their range comes from the store that owns each one, re-keyed by the stepper
     * id (`bespokeLimitsFor`). Neither field is ever offered both.
     *
     * #53 OWNS THE CLAMP. This file passes a range and a value and takes back a number;
     * it states no bound of its own, which is the same division <settings-screen> keeps
     * for the registry rows.
     */
    #numberPad() {
        const t = this.#i18n.t;
        const id = this._typing;
        const field = id ? this.#numberField(id) : null;
        /* A3 KEEPS ITS WORD HERE TOO. A refused leaf renders NOTHING, and an always-mounted
         * keypad — closed and empty though it is — is still an element on a pane that is
         * supposed to be bare (`settings-bespoke.render.test.mjs`, "the three gated leaves
         * render nothing"). `_typing` can only be set by a stepper that rendered, so
         * gating on it is the same sentence said one storey up. #18 shuts itself on
         * disconnect, which is what makes leaving the tree a legal way to close. */
        if (!field) return nothing;
        return html`<ui-numeric-keypad
            id="number-pad"
            ?open=${true}
            heading=${field ? t(field.heading) : ''}
            .limits=${field?.limits ?? null}
            .limitKey=${field?.key ?? ''}
            .value=${field && Number.isFinite(field.value) ? String(field.value) : ''}
            unit=${field?.range?.unit ?? ''}
            .level=${field?.level ?? 1}
            @confirm=${this.#onNumberConfirm}
            @open-change=${this.#onNumberClose}
        ></ui-numeric-keypad>`;
    }

    /**
     * The descriptor for the stepper being typed into, looked up and never held —
     * the same rule <settings-screen>'s `#typingView` follows, and for the same reason:
     * a held copy goes stale the moment the store answers.
     *
     * THE LEVEL IS TWO FOR THE SCHEDULE STEPPER. That one sits inside the wake-schedule
     * dialog, so its keypad opens over an already-open dialog and #18 stacks by `level`;
     * the other two open over the pane and take the default.
     */
    #numberField(id) {
        if (id === 'cal-weight') {
            const limits = this.deps?.limits ?? null;
            if (!limits?.calibrationWeight) return null;
            return {
                heading: 'Calibration weight',
                limits,
                key: 'calibrationWeight',
                range: limits.calibrationWeight,
                value: this._weight,
                level: 1,
            };
        }
        const field = BESPOKE_NUMBER_FIELDS[id];
        if (!field) return null;
        return {
            heading: field.heading,
            limits: bespokeLimitsFor(id),
            key: id,
            range: field.range,
            value: this.#numberValue(id),
            level: id === 'schedule-keep-awake' ? 2 : 1,
        };
    }

    /** Read back through the store, every render. Never a copy taken at press time. */
    #numberValue(id) {
        switch (id) {
            case 'schedule-keep-awake': return this._schedule?.keepAwakeFor ?? null;
            default: return null;
        }
    }

    /** A stepper's number was pressed. */
    #onNumberEdit = (event) => {
        const id = event?.currentTarget?.id;
        if (typeof id === 'string' && id !== '') this._typing = id;
    };

    /**
     * A typed number, confirmed. It goes back through the SAME handler the stepper's
     * own arrows use, so the write path is one path — a second one here is how the two
     * would come to clamp differently.
     */
    #onNumberConfirm = (event) => {
        const value = event?.detail?.value;
        const id = this._typing;
        this._typing = null;
        if (!Number.isFinite(value)) return;
        const detail = { detail: { value } };
        switch (id) {
            case 'schedule-keep-awake': this.#onScheduleKeepAwake(detail); break;
            case 'cal-weight': this._weight = value; break;
            default: break;
        }
    };

    /* #53 announces its own close — Escape, the scrim, Cancel. Only a CLOSE is acted
     * on: `open-change` fires on open too. */
    #onNumberClose = (event) => {
        if (event?.detail?.open === false) this._typing = null;
    };

    #leafBody() {
        switch (this.leafId) {
            case 'machine-machine-info': return this.#machineInfo();
            case 'machine-sleep-wake-schedules': return this.#sleepWake();
            case 'display-skin': return this.#skin();
            case 'updates-skin-app': return this.#skinApp();
            case 'units-language-select-language': return this.#language();
            case 'calibration-load-cells': return this.#loadCells();
            case 'display-screen-saver': return this.#screenSaver();
            case 'accessories-lighting': return this.#lighting();
            case 'updates-firmware-update': return this.#firmware();
            case 'maintenance-machine-descaling': return this.#descaling();
            case 'maintenance-transport-mode': return this.#transportMode();
            case 'extensions-plugins': return this.#plugins();
            case 'extensions-visualizer': return this.#visualizer();
            case 'help-talk-to-decent': return this.#decentAccount();
            case 'help-send-feedback': return this.#feedback();
            case 'accessories-usb-charger': return this.#usbCharger();
            case 'connection-machine': return this.#machineConnection();
            case 'connection-scale': return this.#scaleConnection();
            case 'help-keyboard-shortcuts': return this.#keyboard();
            case 'calibration-default-load-settings': return this.#defaults();
            /* NOT ONE OF THE NINETEEN. Renders nothing, which is not a fallback: the screen
             * mounts this element only for a leaf `leafKind()` calls bespoke, and a
             * twentieth must be a registry change rather than a branch appearing here. */
            default: return nothing;
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. MACHINE INFO — #50 definition card
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-machine-machine-info .slate-card [629,273,1200,492]
     *      rows "Model" / "Firmware version" / "Serial number" /
     *           "Group head controller" / "Refill Kit" / "Voltage",
     *      head action "Copy all"
     *
     * ALL SIX SINCE 26 AUGUST 2026, AND THE OLD REFUSAL WAS AIMED AT THE WRONG DOOR.
     *
     * It said "Refill Kit" and "Voltage" came from `GET /machine/settings/advanced` as two
     * integer enums with no mapping on this side, and that printing a raw 1 under a
     * heading saying "Voltage" would be a guess wearing a read. All true — and not what
     * this page shows. `MachineInfo.toJson` carries `version`, `model`, `serialNumber`,
     * `GHC` and a free `extra` map, and Slate reads both rows off `extra`
     * (settings.js:6011-6025), already resolved by the machine. The page was refusing to
     * print what the machine had told it, on the strength of an argument about a different
     * route.
     *
     * SO IT PRINTS THE MAP, not a list of keys — see `#machineExtras`. Anything the
     * machine adds appears without an edit here.
     *
     * NO CARD (Ben, 26 Aug 2026: "drop the card, use the same layout as the other pages").
     * The rows are a definition list in the leaf's own rhythm, and the values share ONE
     * track so they end on one edge.
     *
     * `GHC` IS KEY-PRESENCE, NOT TRUTHINESS. The contract row's gate says so: the key is
     * written unconditionally, so an ABSENT key means an older server rather than `false`.
     * An absent key therefore reaches #50 as `undefined`, which renders the dash.
     */
    #machineInfo() {
        const t = this.#i18n.t;
        const state = this.deps?.machineInfo?.get?.() ?? null;
        const info = state?.info ?? null;

        if (!info) {
            return html`<ui-empty-state
                id="info-empty"
                heading=${t('No machine information')}
                body=${t('The machine has not answered yet. It reports its model, firmware and serial number once it is connected.')}
            ></ui-empty-state>`;
        }

        const items = [
            { term: t('Model'), value: info.model },
            { term: t('Firmware version'), value: info.version },
            { term: t('Serial number'), value: info.serialNumber },
            {
                term: t('Group head controller'),
                value: typeof info.GHC === 'boolean'
                    ? t(info.GHC ? 'Enabled' : 'Not fitted')
                    : undefined,
            },
            ...this.#machineExtras(info),
        ];

        return html`
            <section class="group" id="info">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Machine')}</h3>
                    <ui-button id="info-copy" @click=${() => this.#copyInfo(items)}
                        >${t('Copy all')}</ui-button>
                </div>
                <dl class="facts">
                    ${items.map((item) => html`<div class="fact" data-term=${item.term}>
                        <dt class="ui-body">${item.term}</dt>
                        <dd class="ui-body ui-numeric">${
                            item.value === undefined || item.value === null || item.value === ''
                                ? MACHINE_INFO_DASH
                                : item.value
                        }</dd>
                    </div>`)}
                </dl>
            </section>`;
    }

    /**
     * EVERYTHING ELSE THE MACHINE REPORTS ABOUT ITSELF, which is where Slate's Refill Kit
     * and Voltage rows come from — and Decal printed none of it.
     *
     * Ben asked for both by name (26 Aug 2026: "add refill kit", "add voltage"). They are
     * not two more hard-coded rows: they are two keys of `MachineInfo.extra`, a free map
     * the server fills. The old comment above this section said the two came from
     * `/machine/settings/advanced` as un-mapped integer enums — true of the SETTINGS, and
     * this page is not showing the settings. Slate reads them off `extra`, already
     * resolved by the machine (settings.js:6011-6025).
     *
     * SO THE RULE IS THE MAP, NOT A LIST OF KEYS. Anything the machine adds appears
     * without an edit here, which is the only way this page keeps up with a firmware that
     * reports more than it did last month.
     *
     * THREE RULES, ALL SLATE'S, ALL FOR A REASON IT WROTE DOWN:
     *   - the internal capability bitmask is dropped: "Profile Mode Caps 15" answers no
     *     question a user has (its P33);
     *   - a value with an unambiguous unit is stamped with it, because "a bare integer
     *     where the reading has a unit (Voltage 245) reads as an index, not a
     *     measurement" (P33 again);
     *   - a boolean is a word, not `true`.
     */
    #machineExtras(info) {
        const t = this.#i18n.t;
        const extra = info?.extra;
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return [];
        return Object.entries(extra)
            .filter(([key]) => !MACHINE_INFO_INTERNAL_KEYS.has(key))
            .map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
                const unit = MACHINE_INFO_UNITS[key]
                    ?? MACHINE_INFO_UNITS[key.charAt(0).toLowerCase() + key.slice(1)];
                const shown = typeof value === 'boolean'
                    ? t(value ? 'Enabled' : 'Disabled')
                    : `${value}${unit ? ` ${unit}` : ''}`;
                return { term: t(label), value: shown };
            });
    }

    /**
     * Slate's "Copy all", carried as content.
     *
     * GUARDED AND SILENT ON FAILURE. `navigator.clipboard` is absent in a non-secure
     * context and can reject on a permissions policy; neither is worth a dialog, and
     * neither may throw into a render tree.
     */
    #copyInfo(items) {
        const text = items
            .filter((row) => row.value !== undefined && row.value !== null && row.value !== '')
            .map((row) => `${row.term}: ${row.value}`)
            .join('\n');
        try {
            void globalThis.navigator?.clipboard?.writeText?.(text)?.catch?.(() => {});
        } catch { /* no clipboard here; the card is still readable */ }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. SLEEP & WAKE SCHEDULES — the two-card stack, gated on `wakeSchedule`
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-machine-sleep---wake-schedules
     *      card 1 "Enable presence detection" + "Sleep after" bank
     *             (15 min / 30 min / 45 min / 60 min / Custom)
     *      card 2 "Wake schedules" + "Add schedule" + one schedule row
     *
     * THE LAYOUT SHIPPED AND THE DATA DID NOT, AND NOW BOTH DO (24 Aug 2026). The old
     * split was stated here and was honest about itself:
     *
     *   "Every control in Slate's version is a WRITE — enable presence, set the sleep
     *   timeout, add a schedule, delete one, toggle one — and their door is `GET/POST
     *   /api/v1/presence/settings` plus `/presence/schedules`, which are RECORDED (both
     *   have fixtures) and UNADOPTED: no client addresses them … a control that cannot
     *   write is a lie about the machine."
     *
     * What changed is that the doors were opened. `presence-store.js` is the client, and
     * it did not need one new route: all seven were already in the generated table, both
     * fixtures were already served, and `putPresenceSchedulesById` already had a contract
     * row. This leaf was a door with nobody walking through it, which is the largest
     * single class of what Slate had and this skin did not.
     *
     * TWO CARDS, THE SAME TWO. Presence detection carries the switch and the sleep-after
     * bank; Wake schedules carries the list, the Add button, and the editor dialog.
     *
     * "SLEEP AFTER" IS A BANK PLUS A STEPPER, NOT SLATE'S BANK PLUS A NUMPAD. Slate
     * offers 15/30/45/60 and a Custom button that opens its numpad; the four presets are
     * a shortcut and any integer 0..240 is legal (`normalizeSleepTimeoutPreferenceMinutes`
     * CLAMPS to that band rather than refusing, which is why the store re-reads). Here
     * the stepper IS the custom path and is always visible, so a value off the bank shows
     * as itself instead of as an unlit "Custom".
     *
     * THE SCHEDULE EDITOR IS A DIALOG BECAUSE A TIME IS A CLOCK FACE. `<ui-time-picker>`
     * is a dialog body by construction (its host is "the dialog body's content box"), and
     * a schedule is four fields the server validates together — so it is edited whole in
     * one modal and posted once, rather than five inline controls each writing on change.
     *
     * DAYS ARE ISO WEEKDAYS AND AN EMPTY SET MEANS EVERY DAY. `WakeSchedule.matchesTime`
     * filters by day only when the set is non-empty, so "no days selected" is not a
     * schedule that never fires — it is a schedule that fires daily, and the caption says
     * so rather than leaving the user to discover it.
     */
    #sleepWake() {
        const t = this.#i18n.t;
        if (!this.#allowed('wakeSchedule')) return nothing;

        const presence = this.deps?.presence;
        const state = presence?.get?.() ?? null;

        if (!state || state.status === PRESENCE_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="presence-unavailable"
                heading=${t('Sleep and wake settings are not available')}
                body=${t('The machine has not answered for its presence settings. They arrive once it is connected.')}
            ></ui-empty-state>`;
        }

        return html`
            <section class="group" id="schedules">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Wake schedules')}</h3>
                    <ui-button id="schedule-add" variant="primary" @click=${this.#onScheduleAdd}
                        >${t('Add schedule')}</ui-button>
                </div>
                <p class="ui-caption prose"
                    >${t('A schedule wakes the machine at a set time. With no days chosen it runs every day.')}</p>
                ${state.schedules.length === 0
                    ? html`<ui-empty-state
                        id="schedules-empty"
                        heading=${t('No wake schedules')}
                        body=${t('Add one to have the machine heat up before you get to it.')}
                    ></ui-empty-state>`
                    : state.schedules.map((schedule) => this.#scheduleRow(schedule))}
            </section>

            ${this.#scheduleDialog()}
        `;
    }

    /** One served schedule. The row opens the editor; the switch and Delete act at once. */
    #scheduleRow(schedule) {
        const t = this.#i18n.t;
        return html`<ui-list-row
            class="sw-schedule"
            data-schedule=${schedule.id}
        >
            <button
                class="sw-schedule-open"
                type="button"
                @click=${() => { this._schedule = draftFrom(schedule); }}
            >
                <span class="ui-heading">${this.#timeLabel(parseTime24(schedule.time))}</span>
                <span class="ui-caption">${dayWords(schedule.daysOfWeek, t)}${keepAwakeWords(schedule.keepAwakeFor, t)}</span>
            </button>
            <ui-switch
                slot="favourite"
                aria-label=${t('Schedule enabled')}
                ?checked=${schedule.enabled === true}
                @change=${(event) => this.#onScheduleEnabled(schedule.id, event)}
            ></ui-switch>
            <!-- DELETE IS DESTRUCTIVE AND LOOKS IT (Ben, 26 Aug 2026: "delete in red as
                 slate has it"). It was a ghost button — grey text with no fill — beside a
                 switch, on a row a tap anywhere else opens for editing. Nothing marked
                 the one control that removes the schedule. -->
            <ui-button
                slot="favourite"
                variant="danger"
                @click=${() => this.#onScheduleDelete(schedule.id)}
            >${t('Delete')}</ui-button>
        </ui-list-row>`;
    }

    /**
     * The editor. ONE DIALOG FOR BOTH ADD AND EDIT, because the fields are the same and
     * two dialogs would be two places to add the fifth field.
     */
    #scheduleDialog() {
        const t = this.#i18n.t;
        const draft = this._schedule;
        if (!draft) return nothing;

        return html`<ui-dialog
            id="schedule-dialog"
            heading=${draft.id ? t('Edit schedule') : t('Add schedule')}
            .open=${true}
            @open-change=${this.#onScheduleDialogClose}
        >
            <div slot="body" class="sw-editor">
                <ui-time-picker
                    id="schedule-time"
                    label=${t('Wake at')}
                    value=${draft.time}
                    clock-format=${this.#clockFormat}
                    auto-advance
                    @change=${this.#onScheduleTime}
                ></ui-time-picker>
                <div class="sw-stack">
                    <span class="ui-heading">${t('Days')}</span>
                    <div class="sw-days" role="group" aria-label=${t('Days')}>
                        ${WEEKDAYS.map((day) => html`<button
                            type="button"
                            class="day"
                            data-day=${day.iso}
                            aria-pressed=${draft.days.includes(day.iso) ? 'true' : 'false'}
                            aria-label=${t(day.name)}
                            @click=${() => this.#onScheduleDay(day.iso)}
                        ><span class="ui-heading">${t(day.label)}</span></button>`)}
                    </div>
                    <span class="ui-caption">${t('Choose none to run every day.')}</span>
                </div>
                <div class="sw-row">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Stay awake for')}</span>
                        <span class="ui-caption">${t('Zero lets the sleep timeout take over.')}</span>
                    </div>
                    <ui-stepper
                        id="schedule-keep-awake"
                        editable
                        .value=${draft.keepAwakeFor}
                        .min=${KEEP_AWAKE_RANGE.min}
                        .max=${KEEP_AWAKE_RANGE.max}
                        .step=${KEEP_AWAKE_RANGE.step}
                        unit=${KEEP_AWAKE_RANGE.unit}
                        @change=${this.#onScheduleKeepAwake}
                        @edit=${this.#onNumberEdit}
                    ></ui-stepper>
                </div>
            </div>
            <ui-button slot="actions" variant="ghost" @click=${this.#onScheduleCancel}>${t('Cancel')}</ui-button>
            <ui-button slot="actions" variant="primary" @click=${this.#onScheduleSave}>${t('Save')}</ui-button>
        </ui-dialog>`;
    }

    /* THE PRESENCE CARD'S TWO WRITES ARE GONE — the two settings are registry rows now
     * (`machine-sleep-auto`, `machine-sleep-after`) and go out through `presenceDoorFor`
     * like every other machine field. The preset BANK went with them: it offered four
     * fixed minute values beside a stepper that could reach any of them, and Ben replaced
     * both with one stepper in fives ("5 minute steps, 5 to 300 minutes"). Two controls
     * for one number is the shape this page was asked to lose. */

    /* ---- the schedule list and its editor -------------------------------- */

    #onScheduleAdd = () => { this._schedule = draftFrom(null); };

    #onScheduleCancel = () => { this._schedule = null; };

    /* The dialog announces its own close (Escape, the scrim, the close button). Only a
     * CLOSE is acted on: `open-change` also fires on open, and treating that as a cancel
     * would shut the editor the moment it appeared. */
    #onScheduleDialogClose = (event) => {
        if (event?.detail?.open === false) this._schedule = null;
    };

    #onScheduleTime = (event) => {
        const value = event?.detail?.value;
        if (typeof value !== 'string' || !this._schedule) return;
        this._schedule = { ...this._schedule, time: value };
    };

    #onScheduleDay(iso) {
        const draft = this._schedule;
        if (!draft) return;
        const days = draft.days.includes(iso)
            ? draft.days.filter((day) => day !== iso)
            : [...draft.days, iso].sort((a, b) => a - b);
        this._schedule = { ...draft, days };
    }

    #onScheduleKeepAwake = (event) => {
        const value = event?.detail?.value;
        if (!Number.isFinite(value) || !this._schedule) return;
        this._schedule = { ...this._schedule, keepAwakeFor: value };
    };

    /**
     * Save. THE DIALOG SHUTS ONLY ON A SUCCESSFUL WRITE — a refused one leaves the draft
     * on screen with the values still in it, which is the same rule the leaf model
     * follows for a staged machine patch.
     */
    #onScheduleSave = async () => {
        const draft = this._schedule;
        const presence = this.deps?.presence;
        if (!draft || !presence) return;
        const ok = draft.id
            ? await presence.updateSchedule(draft.id, {
                time: draft.time, days: draft.days, keepAwakeFor: draft.keepAwakeFor,
            })
            : await presence.addSchedule({
                time: draft.time, days: draft.days, enabled: true, keepAwakeFor: draft.keepAwakeFor,
            });
        if (ok) this._schedule = null;
    };

    #onScheduleEnabled(id, event) {
        const next = event?.detail?.checked;
        if (typeof next !== 'boolean') return;
        void this.deps?.presence?.updateSchedule(id, { enabled: next });
    }

    #onScheduleDelete(id) {
        void this.deps?.presence?.deleteSchedule(id);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. SKIN — #51 card grid, two up
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-display-skin .slate-heading "Active skin"
     *      caption "Tap a skin to switch to it. The screen r[eloads]"
     *      .slate-skin-card x 10, two per row, "Slate" carrying .is-active
     *      (`prov_query.py find --cls slate-skin-card` -> "found 10 element(s) in 1
     *       state(s)", all 593x96, five rows at x = 629 / 1236; the active one is
     *       [i=88] "Slate Active v0.1.18 Installed". Re-measured wave 5.4 cross-6:
     *       this line said 11.)
     *
     * THE TILES SWITCH THE SKIN (Ben, 26 August 2026: "use Slate completely").
     *
     * THIS PARAGRAPH USED TO ARGUE THE OPPOSITE and was left standing above a function
     * that had stopped agreeing with it. It read "CARDS, NOT BUTTONS … That write is not
     * in this wave's brief … So the grid READS … The card that cannot act is a card, and
     * the caption says so" — while twenty lines below, the function renders a
     * `<button class="skin-press">` per tile and the caption reads "Tap a skin to switch
     * to it." The correcting note was present but BELOW it, so the block argued both sides
     * and a reader hit the wrong one first. In a codebase where the comment IS the spec, a
     * comment that contradicts its own function is a defect, not untidiness.
     *
     * WHAT IS TRUE, as of 26 August 2026:
     *
     *   * every tile is pressable EXCEPT the active one, which is where you already are —
     *     a button that navigates to the current page is a button that does nothing;
     *   * the switch is three routes in an order, and `skins-store.js` owns that order:
     *     PUT `/webui/skins/default`, then the server stop, then the server start;
     *   * the RELOAD is offered and not taken. The page is still the OLD skin until the
     *     browser fetches again, and taking that decision away from someone mid-edit is
     *     not this page's to take;
     *   * four writes are adopted now — PUT default, server stop, server start, and the
     *     skins update. DELETE `{id}` is guarded against the active skin IN THE STORE
     *     rather than by whichever handler happens to call it, so the guard cannot be
     *     walked past by a second call site.
     *
     * D8 IS UNTOUCHED BY ANY OF THAT. Leaving the skin entirely is still one button, from
     * the registry, on this same leaf. Switching between installed skins and leaving for
     * the machine's own web UI are different questions with different answers.
     */
    #skin() {
        const t = this.#i18n.t;
        const state = this.deps?.skins?.get?.() ?? null;
        const skins = state?.skins ?? [];

        /* THE TILES ARE THE SWITCH (Ben, 26 August 2026: "use Slate completely"). They
         * were inert, under a sentence saying switching "is done from the machine's own
         * web UI" — which was true of this skin and not of the machine: the three routes
         * that do it have been in the table throughout, and `skins-store.switchTo` is the
         * order they have to be called in.
         *
         * WHAT HAPPENS AFTER IS A RELOAD, and it is offered rather than done: the page is
         * still the OLD skin until the browser fetches again, and taking that decision
         * away from someone mid-edit is not this page's to take. */
        const switching = state?.switching ?? null;
        const switched = state?.switched ?? null;
        const failed = state?.switchError ?? null;

        return html`${this.#themeBank()}
        <section class="group" id="skins">
            <h3 class="ui-heading">${t('Active skin')}</h3>
            <p class="ui-caption prose">${t('Tap a skin to switch to it. The screen reloads itself.')}</p>
            ${failed
                ? html`<p id="skin-failed" class="ui-caption prose"
                    >${t('The machine refused to switch skins. It is still serving the one you are looking at.')}</p>`
                : nothing}
            ${switched
                ? html`<div class="fact-head" id="skin-switched">
                    <span class="ui-body">${t('Skin changed. Reload to see it.')}</span>
                    <ui-button variant="primary" @click=${this.#onReload}>${t('Reload')}</ui-button>
                </div>`
                : nothing}
            ${skins.length === 0
                ? html`<ui-empty-state
                    id="skins-empty"
                    heading=${t('No skins to show')}
                    body=${t('The machine has not listed its installed skins.')}
                  ></ui-empty-state>`
                : html`<ui-card-grid id="skin-grid" columns="2" label=${t('Installed skins')}>
                    ${skins.map((skin) => this.#skinCard(skin, state.defaultId, switching))}
                  </ui-card-grid>`}
        </section>`;
    }

    /** The reload the switch needs. The one navigation this element performs. */
    #onReload = () => {
        const view = this.ownerDocument?.defaultView ?? null;
        if (view && view.location && typeof view.location.reload === 'function') view.location.reload();
    };

    /**
     * THE THEME PICKER — cmp-ss-3, restored 21 Aug 2026.
     *
     * CITE settings-display-skin [i=43] p.slate-heading "Theme" [629,304,916,26] and
     * [i=44] div.slate-bank.slate-theme-bank role=radiogroup "Dark Light"
     * [1569,285,260,64] — a heading on the left, a two-cell bank hard right, which is
     * the `.group.inline` shape. Slate's own two options and no third: Decal's
     * stylesheets define exactly the two bands (`theme.js` THEMES).
     *
     * IT WAS DROPPED UNDECLARED and nothing replaced it: `createThemeController`'s
     * `set()` had ZERO non-test callers anywhere in src/, so a user had no way to choose
     * a theme in the app at all — while the controller, the store, the stamp and the
     * pre-paint script all worked.
     *
     * THE CONTROLLER IS THE WRITER, not the storage router. `set()` stamps `data-theme`
     * (which is the channel the sheets and `plot-surface` both listen on), publishes,
     * and only then persists through the router's `theme` row — and it moves the
     * controller's `source` to STORED, which is what makes the choice survive the next
     * change of the panel's own preference. DQ-500 is untouched by this: BOOT still
     * honours `prefers-color-scheme` when nothing is stored, because nothing here runs
     * at boot.
     *
     * NO CONTROLLER, NO CONTROL. A leaf mounted in a fixture or the gallery with no
     * shell above it renders the skins list and no theme bank, rather than a bank that
     * cannot write — the same rule PENDING_ROWS states for the registry.
     */
    #themeBank() {
        const t = this.#i18n.t;
        const theme = this.theme ?? null;
        if (!theme || typeof theme.set !== 'function') return nothing;
        return html`<div class="group inline">
            <h3 class="ui-heading" id="theme-label">${t('Theme')}</h3>
            <ui-bank
                id="theme-bank"
                label=${t('Theme')}
                .items=${THEME_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                value=${theme.theme ?? ''}
                @change=${(event) => this.#onTheme(event)}
            ></ui-bank>
        </div>`;
    }

    /**
     * NOT AWAITED. `set()` stamps before it persists, so the palette has already moved by
     * the time this returns; awaiting a storage round trip would hold nothing up and
     * would swallow the rejection the controller already logs.
     */
    #onTheme(event) {
        const chosen = event.detail?.value;
        if (!chosen) return;
        void Promise.resolve(this.theme?.set(chosen)).catch(() => {});
    }

    /**
     * One skin, as a TILE YOU CAN PRESS.
     *
     * TWO LINES, WHICH IS SLATE'S OWN SHAPE: the name, then the version and its badges
     * under it. Decal put all four on one line with the name at the far left and the
     * version at the far right, so finding a build number meant a left-to-right sweep
     * across an empty card.
     *
     * THE ACTIVE ONE IS NOT PRESSABLE, and says so by being a plain box rather than a
     * button — pressing the skin you are already in would stop and restart the server for
     * no change, which is a visible pause and a small risk for nothing.
     */
    #skinCard(skin, activeId, switching) {
        const t = this.#i18n.t;
        const active = skin.id === activeId;
        const busy = switching === skin.id;
        const body = html`<span class="skin-name">
                <span class="ui-heading">${skin.name}</span>
                <span class="skin-meta">
                    <span class="ui-caption ui-numeric">${skinVersionText(skin.version)}</span>
                    <span class="ui-microcap">${t(skin.bundled ? 'Bundled' : 'Installed')}</span>
                    ${busy ? html`<span class="ui-microcap">${t('Switching')}</span>` : nothing}
                </span>
            </span>
            ${active ? html`<span class="skin-active ui-microcap">${t('Active')}</span>` : nothing}`;

        return active
            ? html`<ui-card class="skin-card" data-skin=${skin.id} data-active
                >${body}</ui-card>`
            : html`<ui-card class="skin-card" data-skin=${skin.id}>
                <button
                    type="button"
                    class="skin-press"
                    ?disabled=${Boolean(switching)}
                    @click=${() => { void this.deps?.skins?.switchTo?.(skin.id); }}
                >${body}</button>
            </ui-card>`;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. SKIN / APP — the update list, and #17
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-updates-skin---app .slate-heading "Installed skins"
     *      action "Check for updates", rows "Streamline.js  v0.1.88 -> v0.1.95"
     *      with .slate-badge-attention "Update available"
     *
     * THERE IS NO "UPDATE AVAILABLE" IN THE SERVED DATA and none is invented. A skin
     * record carries `version` and a `reaMetadata.lastChecked` timestamp; the arrow and
     * the badge in Slate come from a check that runs against GitHub, whose route
     * (`POST /api/v1/webui/skins/update`) is now adopted here for INSTALLING and still not
     * for PREDICTING. A badge that could only ever say "up to date" would be worse than no
     * badge.
     *
     * SO THE BADGE REPORTS THE OUTCOME (27 August 2026). Slate names a version it has not
     * installed, by fetching api.github.com straight from the webview; Decal names one it
     * HAS. `skins-store.updateAll` snapshots the versions before the POST and compares them
     * with the re-read afterwards, so this page can say "one skin was updated" or "every
     * skin was already current" as a fact rather than a forecast, and mark the rows that
     * moved with the attention badge #12 was built for. `skins-store.js`'s header carries
     * the full argument, including why a second client aimed at a third-party host is a
     * fallback path by another name (A7, and `src/data/README.md`'s Gate 3).
     *
     * AND THE ROW PRINTS THE DATE THE MACHINE RECORDED, not the word "Checked". The word is
     * CONSTANT once the button has been pressed once — every row says it for ever after —
     * so it distinguishes nothing, while `reaMetadata.lastChecked` is a full ISO timestamp
     * sitting unread in the same record. `short-date.js` turns it into "12 Aug"; a record
     * that never was checked says so, and one whose stamp cannot be parsed shows the dash
     * rather than a word standing in for a value nobody read.
     *
     * ===========================================================================
     * AND THE "APP" HALF, WHICH THE PAGE'S OWN NAME HAD BEEN PROMISING (27 Aug 2026)
     * ===========================================================================
     *
     * This leaf is called SKIN / APP and had no app half at all. Both halves of one were
     * already built and neither had a consumer, which is the defect this fork exists to
     * remove: `GET /api/v1/info` sat in the generated route table with no caller anywhere
     * in `src/`, and `/ws/v1/update` was attached on every boot and parsed by a complete
     * reader (`feed-readers.js` `readUpdateFrame`) whose output nothing read. It is also
     * why `ui-badge`'s `attention` variant existed with zero consumers — its own header
     * names "Update available" as the case it was built for.
     *
     * NOT ON THE FIRMWARE PAGE, which is where Slate puts its app block: Ben ruled that
     * leaf down to "the current firmware and whether the machine is a DE1 or a Bengle" on
     * 26 August 2026, and this skin has a page whose title already says where this belongs.
     * The heading is "Decaid" — the app's name since Ben's ruling of the same day.
     *
     * RELEASE NOTES ARE A LINK AND NEVER A PARAGRAPH, which is Slate's defect named so it
     * is not inherited: Slate drops the raw string into a `whitespace-pre-line` paragraph,
     * and because the string is GitHub-flavoured markdown the reader gets a literal
     * "## What's Changed", "* " bullets and unwrapped pull-request URLs. Pre-wrapping plain
     * text is not a markdown renderer, and writing one is not this page's job — the same
     * frame carries `releaseUrl`, so the link is the honest half.
     *
     * WHAT #17 MEASURES, AND IT IS REAL: how much of the list the server has ever checked
     * for updates — the count of records carrying a `lastChecked` against the total. It is
     * labelled as exactly that, it is derived from served data, and it is the one honest
     * quantity on this leaf. Recorded as a deferred question with its reversal (drop the
     * track until the update route is adopted), because "the progress track lives here"
     * came from the registry's note rather than from §4.4.
     */
    #skinApp() {
        const t = this.#i18n.t;
        const state = this.deps?.skins?.get?.() ?? null;
        const skins = state?.skins ?? [];
        const checked = skins.filter((skin) => skin.lastChecked !== null).length;
        /* WHICH ROWS MOVED IN THE LAST RUN, as a lookup rather than a scan per row. The
         * store publishes `[{id, from, to}]` and an empty array is the ordinary case, so
         * this is a Map of nothing on almost every render. */
        const moved = new Map((state?.updated ?? []).map((entry) => [entry.id, entry]));

        const installed = skins.length === 0
            ? html`<ui-empty-state
                id="updates-empty"
                heading=${t('No skins to show')}
                body=${t('The machine has not listed its installed skins.')}
            ></ui-empty-state>`
            : this.#skinList(state, skins, checked, moved);

        /* THE APP HALF FIRST. A person opening a page called "Skin / App" to find out
         * which build they are running should not have to scroll past nine skins to
         * reach it, and the skin list is the longer of the two. */
        return html`${this.#decaid()}${installed}`;
    }

    /**
     * The installed skins, the one control that changes them, and what it changed.
     *
     * SPLIT OUT OF `#skinApp` WHEN THE APP HALF ARRIVED, purely so neither half is read
     * through the other. Nothing about the list moved with it.
     */
    #skinList(state, skins, checked, moved) {
        const t = this.#i18n.t;
        const updating = state?.updating === true;
        const failed = state?.updateError ?? null;
        const ran = state?.updateRan === true;
        /* THE COUNT AS A STRING, JOINED RATHER THAN INTERPOLATED. An interpolated
         * template containing a slash is what Gate D's constructed-path scan is FOR — it
         * is how a route gets assembled out of fragments — and "3 / 11" is not a path but
         * looks exactly like one. Joining an array says the same thing and cannot be
         * mistaken for an address. */
        const checkedText = [checked, skins.length].join(' / ');

        return html`<section class="group" id="updates">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Installed skins')}</h3>
                <!-- IT DOWNLOADS AND INSTALLS, AND THE BUTTON SAYS SO. Slate's says
                     "Check for updates"; read at the pin, _handleUpdateSkins calls
                     updateAllSkins, which downloads the remote-bundled skins and
                     re-installs every user skin whose source names a newer release. A
                     button whose word is milder than its effect is the one thing a
                     settings page must not have. -->
                <ui-button
                    id="skins-update"
                    variant="primary"
                    ?disabled=${updating}
                    @click=${() => { void this.deps?.skins?.updateAll?.(); }}
                >${t(updating ? 'Updating' : 'Update all skins')}</ui-button>
            </div>
            <p class="ui-caption prose">${t('Downloads and installs the newest version of every skin that came from a source. Switch skins in Display › Skin.')}</p>
            <!-- WHAT THE PRESS ACTUALLY DID, which is the answer Slate's badge only
                 GUESSES at. The versions before the run and after it are both in this
                 store's hands, so the sentence is a report and not a forecast. It is
                 drawn only after a run has finished: telling somebody who has pressed
                 nothing that everything is current would be an assertion nobody checked. -->
            ${ran
                ? html`<p id="updates-outcome" class="ui-caption prose"
                    >${moved.size === 0
                        ? t('Every skin was already current.')
                        : (moved.size === 1
                            ? t('One skin was updated.')
                            : t('{n} skins were updated.', { n: moved.size }))}</p>`
                : nothing}
            ${failed
                ? html`<p id="updates-failed" class="ui-caption prose"
                    >${t('The machine could not finish the update. Nothing was changed.')}</p>`
                : nothing}

            <!-- THE COUNT SURVIVED; THE TRACK UNDER IT DID NOT (Ben, 27 August 2026).
                 THE HISTORY, because the reversal is the interesting part. The bar was
                 unlabelled and was read as a disk gauge, so Ben asked on 26 August for it
                 to "say what it is: the tablet's memory and how full it is". THAT CANNOT
                 BE BUILT — nothing ReaPrime serves reports the tablet's storage; every
                 handler under the webserver services directory was read and the only
                 "store"
                 routes are the key-value namespace, so there is no route to call. The bar
                 was relabelled instead, to the one real quantity in reach: how many
                 installed skins the machine has ever checked for a newer version.
                 AND THAT MADE IT A DUPLICATE. Relabelled, it said in a bar exactly what
                 the line above it says in words, so the same number appeared twice — and
                 it fills solid and stays solid the moment "Update all skins" is pressed
                 once, so from then on it distinguishes nothing at all. A control whose
                 output never varies is the defect class this fork exists to remove.
                 Ben took the recommendation: drop the track, keep the labelled count.
                 NOTHING IS LOST — the words carry the whole reading. NO BACKTICK HERE. -->
            <div class="fact-head">
                <span class="ui-caption">${t('Skins the machine has checked for a newer version')}</span>
                <span class="ui-caption ui-numeric">${checkedText}</span>
            </div>

            <!-- ONE GRID, AND THE NAME AND VERSION STACK. Slate puts both at the same left
                 edge so the list reads as one column; Decal had the name far left and
                 the version far right with 700px of empty card between them. -->
            <div class="plugins" id="update-list">
                ${skins.map((skin) => this.#skinRow(skin, state, moved.get(skin.id) ?? null))}
            </div>
        </section>`;
    }

    /**
     * One row of the update list.
     *
     * THE DATE IS THE SERVED ONE, AND THE THREE CASES ARE THREE DIFFERENT FACTS.
     * `reaMetadata.lastChecked` is a full ISO timestamp; a record that has never been
     * checked carries `null`, which is not the same thing as a stamp this build cannot
     * read. So: a date where one parses, "Never checked" where the server said null, and
     * the em dash where a string arrived that is not a date (A7 — an unread value is
     * never dressed up as a reading, and never as a zero).
     *
     * THE LANGUAGE IS THE SKIN'S OWN, taken from the settings store like every other
     * localised value on this page, so the month abbreviates the way the rest of the app
     * spells it.
     */
    #skinRow(skin, state, updated) {
        const t = this.#i18n.t;
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        const day = shortDate(skin.lastChecked, language);
        const when = skin.lastChecked === null
            ? t('Never checked')
            : (day === null ? MACHINE_INFO_DASH : t('Checked {day}', { day }));

        return html`<div class="plugin update-row" data-skin=${skin.id}>
            <span class="skin-name">
                <span class="ui-heading">${skin.name}</span>
                <span class="skin-meta">
                    <span class="ui-caption ui-numeric">${skinVersionText(skin.version)}</span>
                    <span class="ui-microcap">${when}</span>
                    <!-- THE ONE THAT MOVED. #12's attention variant, built for exactly
                         this sentence and until now drawn nowhere — and it names the
                         version this machine actually installed rather than one a
                         third-party host said existed. -->
                    ${updated && skinVersionText(updated.to) !== ''
                        ? html`<ui-badge class="skin-updated" variant="attention"
                            >${t('Updated to {version}', { version: skinVersionText(updated.to) })}</ui-badge>`
                        : nothing}
                </span>
            </span>
            <span></span>
            <span class="device-actions">
                <!-- WHERE SKINS ARE REMOVED, which is Ben's own question
                     ("where do skins get added and removed?"). The ACTIVE skin is
                     never offered: removing the folder being served leaves the
                     tablet with a web UI that cannot be reloaded, and the handler
                     does not refuse it. Bundled skins are not offered either —
                     the machine reinstalls them. -->
                ${skin.id === state?.defaultId || skin.bundled
                    ? nothing
                    : html`<ui-button
                        class="skin-remove"
                        variant="danger"
                        @click=${() => { void this.deps?.skins?.remove?.(skin.id); }}
                    >${t('Remove')}</ui-button>`}
            </span>
        </div>`;
    }

    /**
     * THE APP HALF — which build of Decaid this tablet runs, and whether a newer one exists.
     *
     * EVERY VALUE HERE IS SERVED OR ABSENT. `app-info-store.js` maps the server's own two
     * spellings of "I do not know" — the empty string and the literal word `unknown`, both
     * `build_info.dart` defaults — to null, and null draws the dash. Nothing substitutes
     * the SKIN's version for the APP's: they are different quantities and printing one
     * where the other was asked for is a lie that survives review because it looks right.
     *
     * `latestVersion` NULL IS "NOT KNOWN YET" AND NEVER "UP TO DATE". `UpdateCheckService`
     * seeds its state at `idle` with no latest version and re-checks on a twelve-hour
     * timer, so a tablet booted an hour ago genuinely does not know. Check is how a person
     * turns that into an answer without waiting half a day.
     *
     * INSTALL IS OFFERED ONLY WHERE IT WORKS, and the frame is what says so: `installable`
     * is ReaPrime's `_isAndroid && hasUpdate`, so a platform that cannot install in-app
     * gets the release link instead of a button that would reply with an error envelope.
     * The skin never sniffs the platform to work this out.
     */
    #decaid() {
        const t = this.#i18n.t;
        const info = this.deps?.appInfo?.get?.()?.info ?? null;
        const frame = this.deps?.appUpdate?.feed?.get?.()?.value ?? null;
        const dash = (value) => (typeof value === 'string' && value !== '' ? value : MACHINE_INFO_DASH);

        /* THE FIVE FACTS, AND `version (buildNumber)` IS ONE OF THEM RATHER THAN TWO ROWS.
         * `fullVersion` is `version+buildNumber` and is served as its own field, so the
         * pair is not this page composing an identifier — it is the two halves shown the
         * way a person reads them, with the server's own composite underneath. */
        const version = info?.version ?? null;
        const build = info?.buildNumber ?? null;
        const versionText = version === null
            ? MACHINE_INFO_DASH
            : (build === null ? version : t('{version} ({build})', { version, build }));

        /* THE PHASE AND THE THREE READINGS THE LINE IS MADE OF. Each arrives from
         * `readUpdateFrame` as a value OR a no-reading object, so every test below is a
         * type test rather than a truthiness one — a no-reading is an object and would
         * pass a bare `if`. */
        const phase = typeof frame?.phase === 'string' ? frame.phase : null;
        const latest = typeof frame?.latestVersion === 'string' ? frame.latestVersion : null;
        const releaseUrl = typeof frame?.releaseUrl === 'string' ? frame.releaseUrl : null;
        const installable = frame?.installable === true;
        const progress = Number.isFinite(frame?.progress) ? frame.progress : null;
        const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
        const available = phase === 'available' && latest !== null;
        const error = typeof frame?.error === 'string' ? frame.error : null;

        return html`<section class="group" id="app-info">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Decaid')}</h3>
                <!-- CHECK, WHICH IS THE ONLY THING THAT MOVES latestVersion OFF NULL
                     short of waiting for the twelve-hour timer. It rides the socket the
                     update FEED is already attached to — see live-stores.checkAppUpdate —
                     so there is no second connection and no second reconnect clock. -->
                <ui-button
                    id="app-check"
                    ?disabled=${busy || !this.deps?.appUpdate}
                    @click=${this.#onCheckUpdate}
                >${t(phase === 'checking' ? 'Checking' : 'Check for updates')}</ui-button>
            </div>

            <dl class="facts">
                <div class="fact" data-term="app-version">
                    <dt class="ui-body">${t('Version')}</dt>
                    <dd class="ui-body ui-numeric">${versionText}</dd>
                </div>
                <div class="fact" data-term="app-build">
                    <dt class="ui-body">${t('Build')}</dt>
                    <dd class="ui-body ui-numeric">${dash(info?.fullVersion)}</dd>
                </div>
                <div class="fact" data-term="app-branch">
                    <dt class="ui-body">${t('Source')}</dt>
                    <dd class="ui-body">${dash(info?.branch)}</dd>
                </div>
                <div class="fact" data-term="app-commit">
                    <dt class="ui-body">${t('Commit')}</dt>
                    <dd class="ui-body ui-numeric">${dash(info?.commitShort)}</dd>
                </div>
                <div class="fact" data-term="app-store">
                    <dt class="ui-body">${t('App Store')}</dt>
                    <dd class="ui-body">${info?.appStore === null || info?.appStore === undefined
                        ? MACHINE_INFO_DASH
                        : t(info.appStore ? 'Yes' : 'No')}</dd>
                </div>
            </dl>

            <div class="fact-head">
                <span class="ui-caption" id="app-update-state"
                    >${available
                        ? t('{version} is available.', { version: latest })
                        : (phase === 'checking'
                            ? t('Looking for a newer build…')
                            : (phase === 'downloading' || phase === 'installing'
                                ? t('Installing the update.')
                                : (latest === null
                                    ? t('Whether a newer build exists is not known.')
                                    : t('This is the newest build.'))))}</span>
                ${available
                    ? html`<ui-badge id="app-update-badge" variant="attention"
                        >${t('Update available')}</ui-badge>`
                    : nothing}
            </div>

            ${progress === null
                ? nothing
                : html`<ui-progress-track
                    id="app-update-progress"
                    .value=${progress}
                    .max=${1}
                    label=${t('Downloading the update')}
                ></ui-progress-track>`}

            ${available && installable
                ? html`<div class="device-actions">
                    <ui-button
                        id="app-install"
                        variant="primary"
                        ?disabled=${busy}
                        @click=${() => { this.deps?.appUpdate?.install?.(); }}
                    >${t('Install {version}', { version: latest })}</ui-button>
                </div>`
                : nothing}

            <!-- WHY THERE IS NO BUTTON ON THIS PLATFORM, said rather than left to be
                 discovered. The served installable flag is ReaPrime's own
                 (_isAndroid AND hasUpdate), so an iPad or a desktop gets the link and no
                 control that would answer with an error. NO BACKTICK IN THIS COMMENT. -->
            ${available && !installable
                ? html`<p id="app-install-elsewhere" class="ui-caption prose"
                    >${t('This build cannot install updates itself. Open the release page to get the new version.')}</p>`
                : nothing}

            <!-- RELEASE NOTES AS A LINK, NEVER AS A PARAGRAPH — see the section header for
                 Slate's defect. The anchor is drawn only when a release is actually
                 KNOWN: releaseNotes and latestVersion both come from ReaPrime's one
                 _availableUpdate, so notes without a version cannot happen, and with no
                 update the served URL is the releases INDEX rather than a set of notes.
                 NO BACKTICK IN THIS COMMENT. -->
            ${latest !== null && releaseUrl !== null
                ? html`<a
                    id="app-release-notes"
                    class="ui-body doc-link"
                    href=${releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >${t('Release notes')}</a>`
                : nothing}

            <!-- THE MACHINE'S OWN WORDS FOR WHY A CHECK OR AN INSTALL FAILED, verbatim.
                 THE CLOSING TAG IS ON ITS OWN LINE and that is not a formatting whim: an
                 interpolated backtick template that contains a slash and no newline is
                 what Gate D's constructed-path scan is FOR, and a closing tag carries a
                 slash. Every paragraph in this file is written this way for that reason. -->
            ${error
                ? html`<p id="app-update-error" class="ui-caption prose"
                    >${error}</p
                >`
                : nothing}

            <!-- AND WHY THE PRESS ITSELF WENT NOWHERE, which is a different sentence from
                 the one above it: that one is the SERVER's word for why a check failed,
                 this one is why no check was ever made. Audit F-035 - the command rides
                 the update socket and its refusal was discarded, so the button did
                 nothing and said nothing. NO BACKTICK IN THIS COMMENT. -->
            ${this._updateRefusal
                ? html`<p id="app-check-refusal" class="ui-caption prose"
                    >${t('The update check could not be sent: {reason}', { reason: this._updateRefusal })}</p
                >`
                : nothing}
        </section>`;
    }

    /**
     * "Check for updates", AND THE ANSWER IT USED TO THROW AWAY. (Audit F-035.)
     *
     * THE COMMAND IS A WEBSOCKET FRAME, NOT A REQUEST, which is why the audit's
     * request-log instrument recorded four zeros for this press and concluded nothing was
     * wired to it. Everything IS wired: the route exists at the pin
     * (`update_handler.dart:10-11`, `GET /api/v1/update` and `GET /ws/v1/update` with a
     * `check` command), `live-stores.checkAppUpdate` sends on the channel the update FEED
     * is already attached to, and the mock answers the command.
     *
     * WHAT WAS MISSING IS THE REFUSAL. `channel.send()` answers
     * `{ok: false, reason: 'socket is not open'}` when the socket is down and
     * `checkAppUpdate` answers `{ok: false, reason: 'the update feed is not attached'}`
     * when `attachAll()` has not run — and the click handler was
     * `() => { this.deps?.appUpdate?.check?.(); }`, which drops both. A control that
     * cannot act must say so; that is the same rule `live-stores.js` states for itself
     * ("a boot with no live stores has no sender and the slider says so rather than
     * appearing to work"), applied to the one button that had not got it.
     *
     * A SUCCESSFUL SEND CLEARS THE LINE rather than leaving it standing: the next answer
     * is the FRAME's, and the server's own error has its own paragraph.
     */
    #onCheckUpdate = () => {
        const result = this.deps?.appUpdate?.check?.();
        const reason = result && result.ok === false
            ? (typeof result.reason === 'string' && result.reason !== '' ? result.reason : 'refused')
            : null;
        this._updateRefusal = reason;
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. SELECT LANGUAGE — #40 auto-fill tile grid
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-units---language-select-language .slate-lang-tile x 30,
     *      each .slate-lang-endonym over .slate-lang-english
     *      ("English/English", "français/French", "日本語/Japanese · partial")
     *      (`prov_query.py find --cls slate-lang-tile` -> "found 30 element(s) in 1
     *       state(s)", all 291x84, four per row at x = 629 / 932 / 1235 / 1538;
     *       `--cls slate-lang-endonym` returns the same 30. Re-measured wave 5.4
     *       cross-6: this line said 27, while ui-tile-grid.js:69 and
     *       test/render/ui-tile-grid.render.test.mjs already said 30.)
     *
     * THE PATTERN TO COPY IS THE GRID, AND IT IS #40. §4.4 calls this "the only genuinely
     * fluid layout in the old app" and #40 already carries it —
     * `repeat(auto-fill, minmax(min(280px, 100%), 1fr))`. Nothing here re-implements it;
     * this section supplies tiles and #40 places them.
     *
     * V1 SHIPS ENGLISH ONLY (D2) and the list is therefore short. That is the manifest's
     * answer, not this leaf's: `initI18n({available})` takes the list from the manifest of
     * generated files, and `src/lib/i18n.js` ships `[DEFAULT_LANGUAGE]`. The leaf renders
     * what it is given, so the day the manifest grows the grid reflows without a change
     * here — which is what the render suite proves by driving it with a longer list at
     * three widths.
     *
     * ONE STORE. `language` is `layer: local, scope: device` in the routing table and the
     * write goes through the settings store like every other routed key; the old skin
     * wrote it to localStorage AND the IDB settings store, which is the proven
     * silent-revert defect.
     */
    /**
     * A TIME OF DAY AS THIS PERSON WRITES IT (audit F-043, 29 August 2026).
     *
     * ONE READER FOR ONE PREFERENCE. Two surfaces on this leaf print a time — the night
     * mode openers and the wake-schedule rows — and each wrote its own: `minutesToTime`
     * was unconditionally 24-hour and the schedule row printed the wire string raw, while
     * `<ui-time-picker>`, which BOTH of them open, was unconditionally 12-hour. So the
     * USB-Charger Sleep opener read 23:00 and its own dialog read 11:00 PM, one press
     * apart, and `clockFormat` was consumed nowhere in settings at all.
     *
     * THE SPELLING IS `wall-clock.js`'S, not this file's: same module, same `Intl` bag and
     * same locale rules as the Live header's clock and the screensaver's, so a time of day
     * has one appearance in this skin whichever surface writes it.
     *
     * @param {{h24: number, m: number}|number} at  an hour/minute pair, or minutes since
     *   midnight — the two shapes the surfaces here actually hold.
     */
    #timeLabel(at) {
        const format = normaliseClockFormat(this.deps?.settings?.value?.('clockFormat'));
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        return typeof at === 'number'
            ? clockTimeFromMinutes(at, format, language)
            : clockTime(at?.h24, at?.m, format, language);
    }

    /** The format the picker in a dialog on this leaf must agree with. One read, one rule. */
    get #clockFormat() {
        return normaliseClockFormat(this.deps?.settings?.value?.('clockFormat'));
    }

    #language() {
        const t = this.#i18n.t;
        const languages = this.deps?.languages ?? [];
        /* ONE OWNER, AND THE TAIL THAT IS NOT A SECOND ONE. `settings.value('language')`
         * already ends in `settings-defaults.js`, which carries Ben's decided 'en', so the
         * literal `?? 'en'` that used to close this expression was a THIRD spelling of one
         * decision and was unreachable whenever a settings store was present. It is gone.
         * `deps.defaultLanguage` stays and is not the same quantity: it is `i18n.js`'s
         * DEFAULT_LANGUAGE — which language files were generated — and it is what a shell
         * assembled without a settings store has to show. */
        const current = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;

        /* A PICKER, NOT A GRID OF ONE (Ben, 26 August 2026: "keep the page looking like
         * Slate's but add a dropdown to choose the language. More languages are expected
         * later").
         *
         * THE GRID WAS RIGHT FOR THE PAGE IT WAS DESIGNED FOR AND WRONG FOR THE ONE THAT
         * SHIPPED. A tile grid is how you choose among a dozen languages at a glance; with
         * one language installed it drew a single filled tile that could not be pressed to
         * any effect, which reads as a control that has lost its options. A select says
         * "there is a list here" at any length, including one.
         *
         * THE NAME IS THE LANGUAGE'S OWN, with the English name beside it — a reader
         * looking for their language looks for the word THEY use. `partial` rides along
         * because a half-translated skin is worth knowing about before choosing it. */
        const options = languages.map((language) => ({
            value: language.code,
            label: language.english && language.english !== language.endonym
                ? `${language.endonym} (${language.english})${language.partial ? ` · ${t('partial')}` : ''}`
                : `${language.endonym}${language.partial ? ` · ${t('partial')}` : ''}`,
        }));

        /* ONE INSTRUCTION, SAID ONCE — and this page said it four times.
         *
         * It rendered the leaf description "The language this app is written in." (O5/O6
         * gave every leaf a sentence), then a section heading "Display language", then a
         * row label "Language", then the caption "Choose the language for the application
         * interface." Four pieces of copy and TWO NAMES for one select, on a page with one
         * control on it.
         *
         * ITS TWO SIBLINGS SETTLE IT. Temperature and Time each carry one label and no
         * caption, and the Time row states the governing rule in its own comment: "A row on
         * a one-row page inherits the page's sentence; it does not repeat it." Ben's "keep
         * the page looking like Slate's" was said about a page that had no description
         * sentence under its rule; O5 and O6 gave it one, and the row caption became the
         * second saying of it.
         *
         * SO THE SECTION HEADING AND THE CAPTION ARE GONE and the row label is Slate's own
         * more precise pair for an H1 that reads "Select Language": "Display language",
         * which is also already the select's accessible name. End state matches Temperature
         * and Time exactly — H1 names the page, one row label names the control, the leaf
         * description is the only sentence. */
        return html`<section class="group" id="language">
            <div class="form-row">
                <div class="sw-label">
                    <span class="ui-heading">${t('Display language')}</span>
                </div>
                <ui-select
                    id="language-select"
                    label=${t('Display language')}
                    .options=${options}
                    value=${current}
                    @change=${(event) => this.#pickLanguage(event.detail?.value)}
                ></ui-select>
            </div>
        </section>`;
    }

    #pickLanguage(code) {
        if (typeof code !== 'string' || code === '') return;
        void Promise.resolve(this.deps?.settings?.set?.('language', code)).catch(() => {});
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. LOAD CELLS — #39 wizard column, D9, gated on `scaleCalibration`
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-calibration-load-cells 44x44 chips [629,259,44,44] x4,
     *      "Step 1 of 4 · Zero", card "Zero the load cells" +
     *      "Remove the cup platform and the drip tra[y]", button "Zero",
     *      button "Start over"
     *
     * FOUR CHIPS BECAME THREE AND ARE NOW FIVE, and the middle number was a reading of the
     * PROTOCOL where the job needed a reading of the WORK.
     *
     * The three-step version's reasoning is worth keeping because it was half right:
     * Slate walked zero, left, right, done against `{command: zero|left|right}` on a path
     * that has never existed, while the machine's own vocabulary is `abort | zero | latch`
     * and it DETECTS THE CELL ITSELF. All true of the command — and the person still puts
     * the weight on one side, latches, moves it, and latches again. The machine says so:
     * `ScaleCalibrationStatus.incomplete` IS "one cell latched, not the other", and
     * `detectedCell` names the one that is done. The three-step walk asked the user to
     * infer that from a status line.
     *
     * Ben, 26 August 2026: "five steps: 1 Start, 2 Zero, 3 weight on the left cell,
     * 4 weight moved to the right cell, 5 check."
     *
     * THE PHASE IS STILL THE MACHINE'S. `#calStage` reads `step`, `status` and
     * `detectedCell` and derives the chip from them — the contract row's rule ("never keep
     * a second copy of the phase in the client") is about the phase, and the phase is not
     * held here.
     *
     * WHAT IS HELD IS TWO BOOLEANS, and neither is a phase: whether the user has pressed
     * Start (from `idle` with no status, Start and Zero are both legal and no field
     * distinguishes them), and whether a zeroing run has been SEEN to finish. Both reset
     * on an error and on a leaf change.
     *
     * ONE TRANSITION USED TO BE ASSUMED RATHER THAN READ — what a machine reports
     * immediately after a successful zero — and the assumption was wrong. It is read now,
     * out of the firmware: a zero that finishes lands on `complete` carrying NO status
     * (`System.cpp:2437-2463`), and `idle` after a zeroing run is the ABORT. `#noticeStep`
     * carries the derivation and the citations.
     *
     * THE SINGLE BUTTON swaps LABEL AND ACTION IN PLACE and the status slot has a floor,
     * so the card cannot jump — the one rule that survived `loadcell-cal.js`, and the one
     * the first cut of this rebuild was rejected for breaking.
     *
     * THE WEIGHT STEPPER IS ON THREE STEPS AND OFF TWO, which is Ben's own rule ("zero
     * takes no weight input; steps 3, 4 and 5 do") and reverses a rule this file used to
     * hold: that the stepper is part of the card in EVERY state so the card's height
     * cannot move.
     *
     * THAT RULE WAS ABOUT A CARD AND THERE IS NO CARD ANY MORE. It came from a real
     * defect — the stepper rendered only at one state the drive order could not reach, so
     * the suite measured one height while the card moved 260 -> 366px the moment a
     * zeroing run finished. The fix was a slot that keeps its space. With the card gone
     * (Ben: "remove the card and match the settings style") the section sits in the
     * leaf's own rhythm like every other, and a step that asks no question should not
     * draw a control. The SLOT survives, so the two steps that show no stepper do not
     * collapse the space under the sentence.
     *
     * THE STEPPER IS NEVER DISABLED. Its value is a client-side parameter of the NEXT
     * latch and nothing else — no state makes changing it destructive, and a dial that
     * greys out for eight of ten states is a second thing moving in a card whose one rule
     * is that nothing moves.
     */
    #loadCells() {
        const t = this.#i18n.t;
        if (!this.#allowed('scaleCalibration')) return nothing;

        const store = this.deps?.calibration ?? null;
        const snapshot = store?.get?.() ?? null;
        const state = snapshot?.state ?? null;

        if (snapshot?.load === CAL_LOAD.UNSUPPORTED || snapshot?.load === CAL_LOAD.UNAVAILABLE) {
            return html`<ui-empty-state
                id="cal-empty"
                heading=${t('Load-cell calibration is not available')}
                body=${t('The machine did not answer with a calibration state.')}
            ></ui-empty-state>`;
        }

        this.#noticeStep(state);
        const stage = this.#calStage(state);
        const button = this.#walkButton(state, stage);
        const limits = this.deps?.limits ?? null;
        const range = limits && limits.calibrationWeight ? limits.calibrationWeight : null;
        /* THE WEIGHT IS ASKED FOR ON THREE STEPS AND NOT ON TWO, which is Ben's rule:
         * "Zero takes no weight input. Steps 3, 4 and 5 do." Nothing is being weighed on
         * the intro or the zero, so a stepper there is a control with no question. */
        const wantsWeight = stage >= 3 && Boolean(range);

        return html`<ui-wizard-column
            id="wizard"
            .steps=${CAL_STEPS.map((label) => t(label))}
            .current=${stage}
            label=${t('Load cell calibration steps')}
        >
            <section class="group" id="wizard-surface">
                <h3 class="ui-heading">${t(this.#walkHeading(state, stage))}</h3>
                <p class="ui-caption prose">${t(this.#walkBody(state, stage))}</p>

                <div id="cal-weight-slot">${wantsWeight
                    ? html`<ui-stepper
                        id="cal-weight"
                        editable
                        .value=${this._weight}
                        .min=${range.min}
                        .max=${range.max}
                        .step=${range.step}
                        unit=${range.unit}
                        label=${t('Calibration weight')}
                        @change=${(event) => { this._weight = event.detail?.value ?? this._weight; }}
                        @edit=${this.#onNumberEdit}
                      ></ui-stepper>`
                    : nothing}</div>

                <!-- WHAT THE SCALE READS, ON EVERY STEP THAT PUTS SOMETHING ON IT. The
                     check's three-fact block is the richer version of the same line and
                     owns stage 5; the other three weigh-adjacent steps get the one fact.
                     NO BACKTICK IN THIS COMMENT: one would end the template. -->
                ${stage === 5 ? this.#calCheck() : this.#calLive(stage)}

                <p id="status" class="ui-caption" role="status">${this.#walkStatus(state)}</p>

                <div class="actions">
                    <ui-button
                        id="cal-primary"
                        variant=${button.variant}
                        @click=${() => this.#walkPress(button)}
                    >${t(button.label)}</ui-button>
                    <!-- THE ESCAPE (Ben, 26 Aug 2026: "restore a way to start over"). A
                         half-finished run leaves the machine with one cell latched and the
                         other not, and before this the only way out was to finish or to
                         leave the page — which leaves it half-latched anyway. Offered from
                         the moment the walk starts and never on the intro, where there is
                         nothing to start over from. -->
                    ${stage > 1
                        ? html`<ui-button
                            id="cal-restart"
                            variant="ghost"
                            @click=${() => this.#walkPress({ command: 'abort', walk: 'restart' })}
                        >${t('Start over')}</ui-button>`
                        : nothing}
                </div>
            </section>
        </ui-wizard-column>`;
    }

    /**
     * WHICH OF THE FIVE STEPS THE USER IS ON, read from the machine wherever the machine
     * can say, and held here only where it cannot.
     *
     * WHAT THE MACHINE SAYS, and it says most of it:
     *   - `step` is what it is DOING now — zeroing, latching, taring — so any of those
     *     means the walk is mid-action and the chip should not move.
     *   - `status: noZero` is "you have not zeroed", which is step 2 exactly.
     *   - `status: incomplete` is "one cell latched, not the other" — step 4, and
     *     `detectedCell` names the one already done.
     *   - `status: ok` is both cells latched, which is the check.
     *
     * WHAT IT CANNOT SAY is whether the user has pressed Start yet: from `idle` with no
     * status, both Start and Zero are legal and no field distinguishes them. That single
     * boolean is `_calStarted`, and it is the only piece of the walk this file holds — the
     * contract row's rule ("never keep a second copy of the phase in the client") is about
     * the PHASE, which is still entirely the machine's.
     *
     * READ OUT OF THE FIRMWARE, 27 August 2026, AND IT HAD BEEN WRONG. What a machine
     * reports immediately after a successful zero was the one transition this reading
     * assumed rather than read. The answer is `complete` with NO status
     * (`System.cpp:2437-2463`), not `idle` — and because the old stage-5 test also fired on
     * a bare `complete`, the wizard skipped from the zero straight to the Check and the two
     * weight steps could not be reached at all. `#noticeStep` carries the citations.
     */
    #calStage(state) {
        if (!this._calStarted) return 1;
        const step = state?.step ?? CAL_STEP.IDLE;
        const status = state?.status ?? CAL_STATUS_NONE;
        if (step === CAL_STEP.ZEROING) return 2;
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) {
            return status === 'incomplete' ? 4 : 3;
        }
        if (status === 'noZero') return 2;
        if (status === 'incomplete') return 4;
        /* `ok` AND ONLY `ok`. `|| step === CAL_STEP.COMPLETE` used to ride along here and it
         * is what jumped the walk over its own two weight steps: a SUCCESSFUL ZERO lands on
         * `complete` (`System.cpp:2455` — the firmware never returns to Idle except on an
         * abort), so the moment the zero finished this test fired, the wizard went to the
         * Check, and the only button there is Finish. The weight calibration could not be
         * reached through the UI at all. `ok` is the machine's own word for "both cells
         * latched and the 2x2 solved" (`CLoadCellCal.hpp:59-70`), which is exactly and only
         * when there is something to check. */
        if (status === 'ok') return 5;
        /* ZEROED, NOTHING LATCHED. The walk has started and the machine is idle or newly
         * complete with nothing to complain about, which is the moment the first weight
         * goes on. `#noticeStep` sets `_calZeroed` on the zero's own completion edge. */
        return this._calZeroed ? 3 : 2;
    }

    /**
     * WHAT THE SCALE READS, ON THE THREE STEPS BEFORE THE CHECK.
     *
     * THE VALUE WAS ALREADY SUBSCRIBED AND ONLY ONE STEP RENDERED IT. `_scaleWeight` is fed
     * from the machine feed and repaints on every tenth of a gram, so the cost was already
     * being paid; `#calCheck` was the sole reader and it draws only on stage 5. That is a
     * subscription feeding one fifth of the walk that needs it.
     *
     * THE ZERO IS THE STEP THAT NEEDS IT MOST, which is the audit's own argument (point
     * 103): the zero is only valid if the cells are carrying nothing, and before this the
     * page asked the user to take the platform off and then gave them no way to confirm
     * they had. A number near zero is the confirmation; a number that is not is the
     * warning, and it arrives before fifteen seconds are spent averaging the wrong thing.
     *
     * AND ON THE TWO WEIGHT STEPS IT CONFIRMS THE PLACEMENT. The isolated-cell procedure
     * turns on the weight sitting on ONE cell (`CLoadCellCal.hpp:23-40`); a reading that
     * moves when the weight lands is how a user knows it landed, rather than finding out
     * from a `badDelta` fifteen seconds later.
     *
     * ALWAYS DRAWN, NEVER CONDITIONAL, and that is both the A7 answer and the no-jump one.
     * A machine that has sent no frame shows the absence dash — the absence named, never a zero
     * nobody measured — and because the row is present either way the section is exactly as
     * tall with a frame as without one. A slot that appears when the first frame lands
     * would move the button under the reader's finger at an arbitrary moment.
     */
    #calLive(stage) {
        const t = this.#i18n.t;
        if (stage < 2) return nothing;
        const live = this._scaleWeight;
        return html`
            <dl class="facts" id="cal-live">
                <div class="fact">
                    <dt class="ui-body">${t('What the scale reads')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(live) ? `${live.toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
            </dl>`;
    }

    /**
     * THE CHECK: what the scale reads now, against what the user said the weight is.
     *
     * Ben: "the check confirms the weight read matches the weight entered." It is a
     * READING and not a verdict the skin computes into a pass or a fail — the difference
     * is shown and the user decides, because a tolerance this file invented would be a
     * number nobody agreed. What it does say is the difference, which is the thing a
     * person would otherwise work out in their head.
     *
     * THE MIDDLE FACT IS `#calLive`'S LINE, and it is deliberately the same words and the
     * same formatting: one reading, phrased one way, wherever the walk shows it.
     */
    #calCheck() {
        const t = this.#i18n.t;
        const live = this._scaleWeight;
        const entered = Number(this._weight);
        const known = Number.isFinite(live) && Number.isFinite(entered);
        return html`
            <dl class="facts" id="cal-check">
                <div class="fact">
                    <dt class="ui-body">${t('Weight you entered')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(entered) ? `${entered} g` : MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact">
                    <dt class="ui-body">${t('What the scale reads')}</dt>
                    <dd class="ui-body ui-numeric">${Number.isFinite(live) ? `${live.toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact">
                    <dt class="ui-body">${t('Difference')}</dt>
                    <dd class="ui-body ui-numeric">${known ? `${(live - entered).toFixed(1)} g` : MACHINE_INFO_DASH}</dd>
                </div>
            </dl>`;
    }

    /**
     * Advance the walk when the machine finishes zeroing, and reset it when the machine
     * lands anywhere terminal. Reads the machine's step; holds no copy of it.
     *
     * THIS PAIR WAS BACKWARDS, AND IT MADE HALF THE WALK UNREACHABLE. Until 27 August 2026
     * the success edge was read as `zeroing -> idle`, with a comment three hundred lines
     * up admitting the transition was ASSUMED rather than read. The firmware answers it,
     * and it answers the other way round:
     *
     *   - `C_System::updateScaleCalProcedure` (`System.cpp:2437-2463`) is the only code
     *     that ends a zeroing run, and when the cal machine goes not-busy having reached
     *     state 2 it writes `step = E_ScaleCalStep::Complete`. Never Idle.
     *   - The ONLY writer of Idle is the abort command (`System.cpp:2350`, `case 0`).
     *   - A zero is not a cal point, so the same function publishes `calStatus = 0xFF`
     *     throughout (`:2434`) — the 0xFF that ReaPrime decodes as
     *     `ScaleCalibrationStatus.none` and this file spells `CAL_STATUS_NONE`.
     *
     * So `zeroing -> idle` is an ABORT and `zeroing -> complete` with no status is the
     * SUCCESS. The old test drove idle, agreed with itself, and pinned the assumption.
     *
     * WHY THE STATUS IS PART OF THE SUCCESS TEST. `complete` is also where a LATCH lands,
     * and a latch always carries a status — `ok` when the solve closed, `incomplete` when
     * one cell is still owed, or one of the reject ladder's seven. Only a zero arrives at
     * `complete` with nothing to say, so the absent status is what tells the two apart
     * without this file keeping a second copy of which command it sent.
     */
    #noticeStep(state) {
        const step = state?.step ?? null;
        if (step === null) return;
        const wasZeroing = this.#lastStep === CAL_STEP.ZEROING;
        const status = state?.status ?? CAL_STATUS_NONE;
        if (wasZeroing && step === CAL_STEP.COMPLETE && status === CAL_STATUS_NONE) this._calZeroed = true;
        /* AND THE ABORT EDGE UNSETS IT. A run stopped part way has left the cells wherever
         * the last complete pass put them, so the walk must not step forward to a weight
         * it has no zero for; the machine would answer `noZero` and the page would look
         * like it had lost its place. */
        if (wasZeroing && step === CAL_STEP.IDLE) this._calZeroed = false;
        if (step === CAL_STEP.ERROR) { this._calZeroed = false; this._calStarted = false; }
        this.#lastStep = step;
    }

    /**
     * ONE button, one lookup. Label AND action, swapped in place.
     *
     * TWO VOCABULARIES, KEPT APART ON PURPOSE. `command` is one of the machine's three
     * (`abort | zero | latch`) and is the ONLY thing that reaches the handler; `walk` is
     * what this page does with its own two booleans. A button may carry either, or both —
     * Start over aborts the machine AND reopens the walk — and nothing can invent a fourth
     * machine command by adding a walk step, which is what the suite checks.
     */
    #walkButton(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (isCalibrationInProgress({ step }) || step === CAL_STEP.TARING) {
            return { label: 'Stop', command: 'abort', variant: 'ghost' };
        }
        if (step === CAL_STEP.ERROR) {
            return { label: 'Try again', command: 'abort', walk: 'restart', variant: 'primary' };
        }
        if (stage === 1) return { label: 'Start', walk: 'start', variant: 'primary' };
        if (stage === 2) return { label: 'Zero', command: 'zero', variant: 'primary' };
        if (stage === 5) return { label: 'Finish', walk: 'finish', variant: 'primary' };
        return { label: 'Latch weight', command: 'latch', variant: 'primary' };
    }

    #walkHeading(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (step === CAL_STEP.ERROR) return 'Calibration stopped';
        if (step === CAL_STEP.ZEROING) return 'Zeroing the load cells';
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) return 'Reading the weight';
        return CAL_STAGE_HEADING[stage] ?? CAL_STAGE_HEADING[1];
    }

    #walkBody(state, stage) {
        const step = state?.step ?? CAL_STEP.IDLE;
        if (step === CAL_STEP.ERROR) return 'Nothing was written. Start again when the machine is settled.';
        if (step === CAL_STEP.ZEROING) return 'Keep everything off the platform until this finishes.';
        if (step === CAL_STEP.CAL_LATCH || step === CAL_STEP.TARING) return 'Leave the weight where it is until this finishes.';
        return CAL_STAGE_BODY[stage] ?? CAL_STAGE_BODY[1];
    }

    /**
     * The status slot's sentence: the countdown while the machine works, the diagnostic
     * when it stops. Always exactly one line's worth of decision, and the box has a floor
     * either way, so the card does not move between them.
     */
    #walkStatus(state) {
        const t = this.#i18n.t;
        if (!state) return '';
        if (isCalibrationInProgress(state)) {
            const phase = t(CAL_SUBSTATE_TEXT[state.subState] ?? 'Working');
            return state.secondsRemaining > 0
                ? `${phase} · ${state.secondsRemaining} ${t('s')}`
                : phase;
        }
        if (state.status === CAL_STATUS_NONE) return '';
        const sentence = CAL_STATUS_TEXT[state.status];
        if (!sentence) return t('The machine reported a status this version does not recognise.');
        const cell = state.detectedCell === 'a' || state.detectedCell === 'b'
            ? ` ${t('Cell')} ${state.detectedCell.toUpperCase()}.`
            : '';
        return `${t(sentence)}${cell}`;
    }

    /**
     * THE WALK FIRST, THEN THE MACHINE, and a button may ask for either or both.
     *
     * START AND FINISH TOUCH NOTHING ON THE MACHINE, which is the point of both: Start
     * opens the walk and Finish closes it, so neither can leave the machine in a state the
     * page did not intend. START OVER does both — it aborts whatever is running and
     * reopens the walk at the zero, because a half-finished run has one cell latched and
     * the other not.
     */
    #walkPress({ command = null, walk = null } = {}) {
        if (walk === 'start') { this._calStarted = true; this._calZeroed = false; }
        if (walk === 'finish') { this._calStarted = false; this._calZeroed = false; }
        if (walk === 'restart') { this._calStarted = true; this._calZeroed = false; }

        const store = this.deps?.calibration;
        if (!store || command === null) return;
        if (command === 'latch') { void store.latch(this._weight).catch(() => {}); return; }
        if (command === 'zero') { void store.zero().catch(() => {}); return; }
        void store.abort().catch(() => {});
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. BRIGHTNESS — #23 slider row, and Q14's answer
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-display-brightness .slate-microcap "Dim" / "Bright",
     *      #brightness-slider [681,305,955,12], #brightness-number "100%",
     *      caption "The lowest setting stays readable, so th[e]"
     *
     * Q14 IS ANSWERED HERE AND THE ANSWER IS THAT #56 DISSOLVES INTO #5. Part 9 filed it
     * as "confirm on screen, on the brightness leaf", and the screen says: THIS LEAF HAS
     * NO TOGGLE AT ALL. Slate renders a slider and a readout, and
     * `prov_query.py find --cls brightness-toggle-label` searched all 49 states and found
     * ZERO elements — the pill was exported by Figma and never built. Every toggle Slate
     * does render is one component (`find --cls slate-switch`: 24 elements in 13 states,
     * a single 100x50 geometry), which is #5.
     *
     * SO THERE IS NO PILL WRAPPER ANYWHERE ON THIS SCREEN, and the suite asserts it.
     * (DQ-610, 21 Aug 2026: #56 is retired outright — the pill became a `shape="pill"`
     * attribute on #5, and this leaf still renders a slider rather than either.)
     * The full retirement, with the second half of the evidence and the reversal, is this
     * wave's `q14-toggle-pill` deferred question.
     *
     * ONE STORE. `lastBrightness` is `layer: kv, scope: machine` — the one LAST_VALUE key
     * that survived, because ReaPrime persists no brightness of its own. The write is on
     * `change`, not on `input`: a KV POST per drag frame is a different shape of the same
     * mistake D7 exists to fix, and the slider paints itself from `input` regardless.
     */


    /* ═══════════════════════════════════════════════════════════════════════
     * 8. LIGHTING — two columns, #52, and D7's live preview
     * ═══════════════════════════════════════════════════════════════════════
     *
     * CITE settings-accessories-lighting "Zone" bank (Front / Rear / Both),
     *      "State" bank (Awake / Asleep), "Current Colours" grid,
     *      "Presets" .slate-swatch x10, "Editing  Front · Awake  #ffc180",
     *      buttons "Reset" and "Save"
     *
     * WHAT IS COMPOSED AND WHAT IS NOT. Slate's right-hand column is an `iro.js` colour
     * WHEEL (`.IroWheelHue`, `.IroWheelSaturation`, `.IroSlider`). A colour wheel is not
     * on the 57-item inventory and a vendored one would be scope invention (Part 10 §9),
     * so the picker is #52's preset row — which is the component the inventory names for
     * this leaf ("colour swatch row") and the one D7's item row cites.
     *
     * ZONES ARE REAPRIME'S THREE, NOT SLATE'S. `LedStripState` carries `frontStrip`,
     * `backStrip` and `frontSwitch`; Slate's bank said Front / Rear / Both, where "Both"
     * is a UI convenience with no wire meaning. The third item here is the third real
     * zone instead, so every press names something the machine has.
     *
     * THE WRITE PATTERN IS THE STORE'S AND THERE IS NO TIMER IN IT. This section calls
     * `led.preview(zone, bank, hex)` once per press and never awaits it; the store keeps
     * `pendingColour`, one write in flight, latest-wins.
     *
     * Q5 — WHOSE PALETTE THE PREVIEW COVERS — IS ANSWERED THE REVERSIBLE WAY: only the
     * bank the machine is currently rendering previews live, because `PUT /machine/
     * ledStrip` pushes the whole state and the machine shows whichever bank matches its
     * own sleep state. The alternative needs `POST /machine/ledStrip/preview` and
     * `.../preview/clear`, which DO NOT EXIST in ReaPrime — re-verified across `lib/` at
     * pin 2b047d02 on the day this was written — and would be an upstream ask. The caption
     * says so out loud rather than letting a user think the machine is ignoring them.
     */
    #lighting() {
        const t = this.#i18n.t;
        if (!this.#allowed('ledStrip')) return nothing;

        const store = this.deps?.led ?? null;
        const snapshot = store?.get?.() ?? null;

        if (!snapshot || snapshot.status !== LED_STATUS.READY) {
            return html`<ui-empty-state
                id="led-empty"
                heading=${t('The lighting is not readable')}
                body=${t('The machine has not reported its LED colours yet.')}
            ></ui-empty-state>`;
        }

        const current = store.hex(ledLeadZone(this._ledZone), this._ledBank) ?? '';

        return html`<div id="lighting">
            <div class="column">
                <div class="group">
                    <h3 class="ui-heading">${t('Zone')}</h3>
                    <ui-bank
                        id="led-zone"
                        .items=${LED_ZONE_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                        value=${this._ledZone}
                        label=${t('Zone')}
                        @change=${(event) => { this._ledZone = event.detail?.value ?? this._ledZone; }}
                    ></ui-bank>
                </div>

                <div class="group">
                    <h3 class="ui-heading">${t('State')}</h3>
                    <ui-bank
                        id="led-bank"
                        .items=${LED_BANK_ITEMS.map((item) => ({ value: item.value, label: t(item.label) }))}
                        value=${this._ledBank}
                        label=${t('State')}
                        @change=${(event) => { this._ledBank = event.detail?.value ?? this._ledBank; }}
                    ></ui-bank>
                </div>

                <div class="group">
                    <h3 class="ui-heading">${t('Current colours')}</h3>
                    <div id="current">
                        <span></span>
                        ${LED_BANK_ITEMS.map((bank) => html`<span
                            class="ui-microcap"
                        >${t(bank.label)}</span>`)}
                        ${LED_GRID_ZONES.map((zone) => html`
                            <span class="ui-caption">${t(zone.label)}</span>
                            ${LED_BANK_ITEMS.map((bank) => html`<button
                                type="button"
                                class="chip"
                                data-zone=${zone.value}
                                data-bank=${bank.value}
                                aria-pressed=${zone.value === this._ledZone && bank.value === this._ledBank ? 'true' : 'false'}
                                aria-label=${`${t(zone.label)} · ${t(bank.label)}`}
                                style="--_ui-chip-fill: ${store.hex(ledLeadZone(zone.value), bank.value) ?? 'transparent'}"
                                @click=${() => this.#pickCell(zone.value, bank.value)}
                            ></button>`)}
                        `)}
                    </div>
                </div>

                <!-- THE PRESETS SIT WITH THE COLOUR GRID (Ben, 26 August 2026: "make it
                     the same as Slate"). Slate's left column is Zone, State, the grid and
                     the presets; the right is the wheel and its slider. Decal had the
                     presets under the wheel, so the two ways of choosing a colour were
                     stacked and the left column ended early.

                     SIXTEEN IN TWO FULL ROWS OF EIGHT. A wrapping row cannot promise a
                     complete last row — the same palette is 8+8 at one width and 6+6+4 at
                     another — so the count is stated and #52 lays it out as a grid. -->
                <div class="group">
                    <h3 class="ui-heading">${t('Presets')}</h3>
                    <ui-colour-swatch-row
                        id="led-presets"
                        .swatches=${LED_PRESETS}
                        .columns=${LED_PRESET_COLUMNS}
                        value=${current}
                        label=${t('Preset colours')}
                        @swatch-select=${this.#onSwatch}
                    ></ui-colour-swatch-row>
                </div>
            </div>

            <div class="column">
                <div class="group inline">
                    <h3 class="ui-heading" id="led-power-label">${t('Power')}</h3>
                    <ui-switch
                        id="led-power"
                        aria-labelledby="led-power-label"
                        ?checked=${store.isOn(this._ledBank) === true}
                        @change=${(event) => this.#onPower(event)}
                    ></ui-switch>
                </div>

                <!-- THE WHEEL (Ben, 24 Aug 2026: "LED colour wheel is missing from the
                     settings"). Six presets answer six questions out of sixteen million,
                     which on a control whose whole subject is colour is not a control.
                     The old skin has the same wheel, from the same vendored library.
                     TWO EVENTS, TWO MEANINGS: colour-input many times per drag drives the
                     live preview, and colour-change once at the lift is what the machine
                     keeps — which is the pair the store already expects. -->
                <!-- WHAT IS BEING EDITED, ABOVE THE WHEEL, which is where Slate puts it
                     and is the only place it is useful: a wheel with no subject named
                     above it is a wheel you have to remember the subject of. It was below
                     the presets, two controls further down. -->
                <div class="group">
                    <p id="led-editing" class="ui-caption prose">
                        ${t('Editing')}
                        <strong>${t(LED_ZONE_ITEMS.find((z) => z.value === this._ledZone)?.label ?? '')}</strong>
                        ·
                        <strong>${t(LED_BANK_ITEMS.find((b) => b.value === this._ledBank)?.label ?? '')}</strong>
                        <span class="ui-numeric">${current}</span>
                    </p>
                    <!-- 440 DESIGN UNITS, WHICH IS SLATE'S RENDERED DIAMETER (26 Aug 2026).
                         BOTH SKINS CONFIGURE iro AT 300 — slate settings.js:3993 sets its
                         width config to that, and DEFAULT_WHEEL_SIZE here is the same
                         number — so the 1.5x the audit measured
                         is not a configuration difference — it is the SCALE COMPENSATION.
                         Slate counter-scales the picker by 1/S so it paints at 300 SCREEN
                         pixels whatever the geometry; this skin's host counter-zooms so the
                         wheel paints at exactly the size a design-unit sibling does, which
                         at the bench tablet's S of about 0.667 is roughly 200 physical
                         pixels against Slate's 300.

                         THIS SKIN'S ARCHITECTURE IS THE RIGHT ONE and is not what changes: a
                         wheel exempt from the app's scaling would be the only element in the
                         skin that is. What changes is the ASKED-FOR SIZE, because the target
                         is genuinely small for hue picking and the reason for tolerating it
                         has expired — "Decal spends the saved space on the presets column"
                         was true while the presets sat under the wheel, and on 26 August Ben
                         moved them into the left column with the colour grid. The right
                         column is Power, the editing line, the wheel, the slider, the helper
                         and the buttons, at roughly 584 units wide. There is room. -->
                    <ui-colour-wheel
                        id="led-wheel"
                        size="440"
                        label=${t('Zone colour')}
                        value=${current}
                        @colour-input=${this.#onWheel}
                        @colour-change=${this.#onWheel}
                    ></ui-colour-wheel>
                    <!-- SLATE'S OWN SENTENCE, which says what the two halves of the picker
                         do; Decal's said only what the preview does. Both facts matter,
                         so both are here. -->
                    <p id="led-preview-note" class="ui-caption prose"
                        >${t('The wheel picks the colour and the slider sets its brightness. Colours change on the machine as you pick them, and the asleep colours only show while the machine is asleep.')}</p>
                </div>

                <!-- THE TWO BUTTONS THAT USED TO BE HERE ARE GONE (26 August 2026), and
                     the pair they duplicated is the header's.

                     THE TRAP THEY LEFT BEHIND. This leaf carries no registry rows, so the
                     screen's change count was always zero on it and the header's primary
                     Save took its not-dirty branch: it CLOSED the page without writing
                     anything. Meanwhile every drag and every preset press had already gone
                     to the machine as a live PUT, which pushes and does not persist — only
                     the commit route writes NVM. So a person picked colours, pressed the big
                     Save at the top right, and lost them at the next power cycle, while the
                     button that would actually have kept them sat further down the page
                     saying "Keep these colours".

                     ONE COMMIT GESTURE PER SCREEN is the model this screen already states,
                     and an uncommitted preview is a pending change like any other: the
                     header counts it, Save commits it, and Cancel calls reset — which is
                     "reload NVM", which is precisely what Cancel means everywhere else. Two
                     save affordances on one screen was the finding; this is the half that
                     had to go. -->
            </div>
        </div>`;
    }

    /**
     * THE POWER SWITCH — Slate's semantics (settings.js:4344-4356), over the store.
     *
     * OFF writes black to every zone of the bank being edited and remembers what each
     * one was; ON puts those colours back, or Slate's warm white where nothing is
     * remembered. The switch's own state is DERIVED from the strip (`store.isOn`) and
     * nothing is stored, so a colour dragged to black by hand reads as Off on the next
     * render with no second state to reconcile — which is Slate's own note at
     * settings.js:4340-4343.
     *
     * NOT AWAITED, for the same reason the swatch is not: the store owns what reaches
     * the wire, the paint has already happened, and awaiting here would be a queue by
     * another name. The store sends it as ONE whole-strip intent through the same
     * latest-wins slot the picker uses; three per-zone writes would drop two.
     */
    #onPower(event) {
        void this.deps?.led?.power(Boolean(event.detail?.checked), this._ledBank);
    }

    /**
     * THE CHIP SHORTCUT — Slate's `ledSelectCell(zone, state)` (settings.js:3893/4319).
     *
     * One press moves BOTH banks, which is the whole affordance: the grid shows four
     * colours and a person points at the one they want to change. It writes nothing to
     * the machine — it only moves what the pickers are pointed at — so there is no
     * store call here and nothing to await.
     *
     * The chip carries no visible text (it IS the colour), so it is named for the pair
     * it selects and states its selected-ness with aria-pressed, which is what the
     * two-hairline ring on the current chip already says in paint.
     */
    #pickCell(zone, bank) {
        this._ledZone = zone;
        this._ledBank = bank;
    }

    #onSwatch = (event) => {
        const hex = event.detail?.hex;
        if (typeof hex !== 'string') return;
        /* NOT AWAITED, ON PURPOSE. The paint has already happened; the store decides what
         * reaches the wire, and awaiting here would be a queue by another name. */
        void this.deps?.led?.preview(ledZonesFor(this._ledZone), this._ledBank, hex);
    };

    /**
     * THE WHEEL MOVED. Same write as a preset press, because it is the same act: the
     * store owns the sequencing (one latest-wins slot, so a drag's hundred frames land
     * as one write rather than a hundred queued ones) and nothing here throttles.
     *
     * ONE HANDLER FOR BOTH EVENTS. `colour-input` and `colour-change` differ in how
     * MANY there are, not in what they mean, and the store's own slot is what makes the
     * difference not matter — a second handler here would be a second opinion about
     * which of the two is the real one.
     */
    #onWheel = (event) => {
        const hex = event.detail?.hex;
        if (typeof hex !== 'string') return;
        void this.deps?.led?.preview(this._ledZone, this._ledBank, hex);
    };

    /* `#ledReset` AND `#ledCommit` ARE GONE WITH THE BUTTONS THAT CALLED THEM. The store's
     * `reset()` and `commit()` are now reached from `settings-screen.js`, through Cancel and
     * Save — one commit gesture per screen. A handler kept here with no caller would be the
     * defect this fork exists to remove, in the file that just lost its callers. */

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. EXTENSIONS > DECAID — REMOVED, and the page is four rows now
     * ═══════════════════════════════════════════════════════════════════════
     *
     * This section drew ONE dashed empty state saying "decent.app settings are not shown
     * here — Gateway mode, log level and update checks belong to the decent.app gateway.
     * This version does not read or write them."
     *
     * EVERY WORD OF THAT WAS TRUE OF THE SKIN AND NONE OF IT WAS TRUE OF THE ROUTE. All
     * four settings are fields of `GET/POST /api/v1/settings`, the document this skin has
     * had a client for since the scale rows were built. The page was explaining an absence
     * that nothing required.
     *
     * Ben, 26 August 2026: "take Slate's inputs but lay them out like every other page",
     * and "the app is called Decaid now" — the nav name, not the leaf id.
     *
     * SO THE LEAF IS NO LONGER BESPOKE. Four registry rows, drawn by the same renderer as
     * every other page; §4.4's note about it ("the 885px group, measured apart from every
     * other leaf") was T21's finding rather than a requirement, and there is now nothing
     * left on this page that could declare a width.
     * ═══════════════════════════════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. FIRMWARE UPDATE — Ben, 24 August 2026, reversing D4
     * ═══════════════════════════════════════════════════════════════════════
     *
     * "I should be able to pick a file, but it should also have a 'latest' button that
     * pulls it."
     *
     * WHAT "LATEST" IS. ReaPrime bundles firmware images and judges each one against the
     * connected machine's model and installed build; `recommendedArtifactId` is its
     * answer, and this leaf installs that and nothing else. It is not a download — the
     * images ship with ReaPrime — so the wording says what it does rather than "check for
     * updates", which would promise a network nobody calls.
     *
     * `updateAvailable` IS A TRI-STATE and the sentence follows it exactly: true, false,
     * or NULL when the machine is not connected or one artifact's eligibility could not
     * be judged. Null renders as "not known", never as "up to date".
     *
     * WHAT D4 WAS PROTECTING AGAINST IS STILL REFUSED. `force` is never sent, so the
     * Latest button cannot flash an image the machine's own validator calls inapplicable.
     *
     * =======================================================================
     * DE1 FIRMWARE vs BENGLE FIRMWARE — Ben, 27 August 2026
     * =======================================================================
     *
     * "Just note the DE1 FW is different to Bengle and we will need to sort that out to
     * ensure we dont try and flash a DE1 FW onto Bengle or the other way around."
     *
     * THE SENTENCE THAT USED TO END THIS HEADER WAS FALSE, and it is worth keeping the
     * correction visible rather than quietly deleting it. It read: "it is the machine that
     * refuses a bad image rather than a header check written here." That is true of the
     * MANAGED route and false of the RAW one, and the file picker uses the raw one.
     *
     * THE MANAGED ROUTE IS GENUINELY SAFE, and safe in exactly the way Ben is asking for.
     * `_applyManaged` validates the artifact's bytes and then its eligibility, whose model
     * test is `artifact.supportedModels.contains(connectedModel)`; a mismatch is 422
     * `model_incompatible`, and `force: true` CANNOT lift it because `modelInvalid` is
     * checked ahead of the force branch. Upstream pins Ben's own scenario as a test: a
     * machine reporting `model: 'Bengle'`, artifact `de1-1352`, `force: true`, asserting
     * 422 and zero update calls.
     *
     * AND ON A BENGLE THE LATEST BUTTON CAN NEVER APPEAR ANYWAY, for a reason further
     * upstream still: `FirmwareManifest._validate` refuses to load any artifact whose
     * machineFamily is not the literal 'de1', so the bundled catalog cannot contain a
     * Bengle image at all. Every artifact is model_incompatible, `recommendedArtifactId`
     * is null, and this leaf only draws the button when that id is set. Safe — but for a
     * reason nobody could see from here, which is why it is written down.
     *
     * THE RAW ROUTE IS NOT SAFE AT ALL. `_uploadRaw` refuses an EMPTY body and nothing
     * else — no header parse, no marker check, no eligibility — and hands the bytes to
     * erase-and-write. `FirmwareValidator` is never constructed on that path. So the file
     * picker has no server-side guard behind it, and the check has to be here.
     *
     * SO IT IS HERE, in `#firmwareVerdict`, over `src/lib/firmware-image.js`: the image's
     * own board marker says which machine it is for (DE1 0xDE100001, Bengle 0xBE100001 —
     * one hex digit apart), the catalog's `machine.model` says which machine this is, and
     * a mismatch is refused before any confirmation opens. A machine that has not said
     * what it is refuses too, which is ReaPrime's own rule: `machine_model_unknown` sits
     * in the same force-proof set as `model_incompatible`.
     */
    #firmware() {
        const t = this.#i18n.t;
        const state = this.deps?.firmware?.get?.() ?? null;
        const catalog = state?.catalog ?? null;
        const flash = state?.flash ?? null;
        const busy = flash && flash.state !== 'idle' && flash.state !== 'done'
            && flash.state !== 'error' && flash.state !== 'refused';

        if (!catalog) {
            return html`<ui-empty-state
                id="firmware-empty"
                boxed
                heading=${t('No firmware information')}
                body=${t('The machine has not answered yet. It reports the images it carries once it is connected.')}
            ></ui-empty-state>`;
        }

        const build = catalog.machine && Number.isFinite(catalog.machine.build)
            ? String(catalog.machine.build) : null;

        /* WHAT "LATEST" ACTUALLY IS, RESOLVED — and the reason this page was the most
         * serious hole in the category. `recommendedArtifactId` was used purely as a
         * BOOLEAN gate on whether to draw the button; the id was never turned into a
         * version, and the confirmation asked "Write this firmware to the machine?"
         * without naming what "this" was. On the one irreversible page in the app the
         * target has to be legible before the control is live, and legible again inside
         * the confirmation — that is the whole point of a confirmation.
         *
         * NO NEW ROUTE AND NO NEW CALL. Every entry of `catalog.artifacts` is
         * `{...artifact.toJson(), eligibility}`, and `FirmwareArtifact` carries `build`
         * and `versionLabel`; the store keeps the catalog verbatim. So the answer is one
         * lookup in data this page is already holding.
         *
         * `versionLabel` FIRST, `build` AS THE OTHER NAME FOR THE SAME THING — not as a
         * fallback for an unread value. Both are non-nullable on the Dart class, so an
         * artifact that carries neither is a malformed catalog and gets the dash rather
         * than a number invented here (A7). */
        const target = (catalog.artifacts ?? []).find((a) => a && a.id === catalog.recommendedArtifactId) ?? null;
        const targetName = target
            ? (typeof target.versionLabel === 'string' && target.versionLabel !== ''
                ? target.versionLabel
                : (Number.isFinite(target.build) ? String(target.build) : null))
            : null;
        const available = catalog.updateAvailable;
        /* THE FALSE THAT MEANT TWO OPPOSITE THINGS (27 August 2026).
         *
         * `updateAvailable === false` was drawn as "This machine is on the newest image it
         * carries". On a DE1 that is true. On a BENGLE it is a fiction, and a structural
         * one rather than a fixture accident: `FirmwareManifest._validate` refuses to load
         * any manifest entry whose machineFamily is not the literal 'de1', whose
         * supportedModels is not a subset of the four DE1 names, or whose expected header
         * board marker is not the DE1 one. The bundled catalog therefore CANNOT contain a
         * Bengle image — not "does not yet", cannot — so on a Bengle every artifact is
         * model_incompatible, nothing is recommended, no eligibility is unknown, and the
         * server computes exactly the same `false` it computes for a DE1 that is current.
         *
         * A person reading the old sentence concluded their machine was up to date. What
         * was true is that this app ships no firmware for their machine at all. Same
         * boolean, opposite meanings, and the difference is legible in `supportedModels`,
         * which the page was already holding and never read.
         *
         * NULL KEEPS THE SERVER'S OWN SENTENCE (A7). `catalogCarriesNothingFor` answers
         * null when the artifacts do not declare supportedModels or the model did not
         * read — no grounds, so no new claim. */
        const carriesNothing = catalogCarriesNothingFor(catalog);
        const headline = carriesNothing === true
            ? t('This app carries no firmware for this machine')
            : (available === true ? t('A newer image is available')
                : (available === false ? t('This machine is on the newest image it carries')
                    : t('Whether a newer image applies is not known')));

        /* NO CARD, AND THE FACTS ARE A LIST (Ben, 26 August 2026: "rebuild the page, no
         * cards. Show the current firmware and whether the machine is a DE1 or a
         * Bengle"). The model row was already here and the audit missed it because it
         * sat inside a bordered card with a hairline down the value column. */
        const checking = state?.status === 'loading';
        const pending = this._flashPending ?? null;

        return html`<section class="group" id="firmware">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Machine firmware')}</h3>
                <!-- CHECK FOR UPDATE. It re-reads the catalog, which is the ONLY place
                     updateAvailable comes from: the server judges eligibility and this
                     asks it again. There is no separate check route and none is invented.
                     NO BACKTICK IN THIS COMMENT. -->
                <ui-button
                    id="firmware-check"
                    ?disabled=${busy || checking}
                    @click=${() => { void this.deps?.firmware?.load?.(); }}
                >${t(checking ? 'Checking' : 'Check for update')}</ui-button>
            </div>

            <dl class="facts">
                <div class="fact" data-term="build">
                    <dt class="ui-body">${t('On the machine')}</dt>
                    <dd class="ui-body ui-numeric">${build ?? MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact" data-term="model">
                    <dt class="ui-body">${t('Machine')}</dt>
                    <dd class="ui-body">${catalog.machine?.model ?? MACHINE_INFO_DASH}</dd>
                </div>
                <div class="fact" data-term="carried">
                    <dt class="ui-body">${t('Images carried')}</dt>
                    <dd class="ui-body ui-numeric">${String((catalog.artifacts ?? []).length)}</dd>
                </div>
                <!-- WHICH OF THEM THIS MACHINE WOULD GET. "Images carried 2" answered how
                     MANY and never which, so the one number a person needs before pressing
                     an irreversible button was the one number missing. The dash here is a
                     machine with nothing applicable to offer, which is a real answer. -->
                <div class="fact" data-term="newest">
                    <dt class="ui-body">${t('Newest carried')}</dt>
                    <dd class="ui-body ui-numeric">${targetName ?? MACHINE_INFO_DASH}</dd>
                </div>
            </dl>

            <p id="firmware-headline" class="ui-caption prose">${headline}</p>

            ${this.#firmwareProgress(flash)}

            <!-- THE WARNING COMES BEFORE THE CONTROL, AND IT IS NOT A GREY CAPTION.
                 It was an ordinary caption paragraph sitting AFTER both buttons: no
                 tint, no bar, caption weight, in the place a reader reaches once the
                 decision is made. Its whole job is to stop somebody starting an hour-long
                 write and then walking away, and that is decided BEFORE the tap.
                 SLATE'S OWN RECIPE, CARRIED (slate-shell.css .slate-caution): a 3px danger
                 rule down the leading edge over a 10 percent danger wash, at note size and
                 medium weight. Every token it needs already existed here.
                 NOT ui-alert-banner, which is the Live screen's strip and carries a 52px
                 display headline — it would swamp a settings page.
                 THE DURATION IS BEN'S HOUR, not Slate's "several minutes", and it is the
                 same string the confirmation uses: one duration, stated twice, must be the
                 same number. NO BACKTICK IN THIS COMMENT. -->
            <p id="firmware-note" class="caution"
                >${t(FIRMWARE_DURATION)} ${t(FIRMWARE_POWER)} ${t(FIRMWARE_INTERRUPTION)}</p
            >

            <div class="device-actions">
                <!-- UPDATE TO LATEST, SHOWN ONLY WHEN THERE IS ONE (Ben, 26 Aug 2026).
                     It was drawn always and disabled, which is a dead affordance on a page
                     whose whole subject is whether there is anything to do. -->
                ${catalog.recommendedArtifactId
                    ? html`<ui-button
                        id="firmware-latest"
                        variant="primary"
                        ?disabled=${busy}
                        @click=${() => { this._flashPending = { kind: 'latest' }; }}
                        >${targetName === null
                            ? t('Update to latest')
                            : t('Update to {build}', { build: targetName })}</ui-button
                    >`
                    : nothing}

                <!-- A FILE, which is the half D4 refused and Ben asked for back.

                     THE FILTER NO LONGER NAMES ONE EXTENSION, and that is the same defect
                     the shape check had: it was ".bin" only, and the DE1 firmware Decent
                     actually ships is bootfwupdate.dat — the filename in ReaPrime's own
                     manifest provenance for both bundled artifacts. A picker filtered to
                     .bin HIDES the genuine article from the person looking for it, and a
                     file that cannot be seen cannot be chosen, so the filter was refusing
                     correct firmware more quietly than the check was. Both spellings are
                     offered now, and the BOARD MARKER decides — a filename was never
                     evidence of anything. NO BACKTICK IN THIS COMMENT. -->
                <ui-file-button
                    id="firmware-file"
                    accept=".bin,.dat,application/octet-stream"
                    ?disabled=${busy}
                    label=${t('Update from a file')}
                    @file-pick=${this.#onFirmwareFile}
                    >${t('Update from a file')}</ui-file-button
                >

                ${busy ? html`<ui-button
                    id="firmware-cancel"
                    variant="danger"
                    @click=${this.#onFirmwareCancel}
                    >${t('Cancel')}</ui-button
                >` : nothing}
            </div>

            <!-- A REFUSED FILE, AND WHY. This is a CAUTION rather than a caption since
                 27 August 2026: the commonest reason to land here is now holding firmware
                 for the other machine, and a person who has just been stopped from doing
                 the one irreversible thing on this page should not have to notice grey
                 text to find that out. NO BACKTICK IN THIS COMMENT. -->
            ${this._flashRejected
                ? html`<p id="firmware-rejected" class="caution"
                    >${this.#firmwareRefusal(this._flashRejected)}</p
                >`
                : nothing}

            <!-- VALIDATE, THEN CONFIRM (Ben, 26 August 2026: "once a firmware is loaded,
                 check it is valid, then offer an UPDATE FW button behind a confirmation
                 that explains it can take up to an hour and asks the user to confirm").
                 The validation is #firmwareLooksValid and happens BEFORE this opens, so
                 a file that is obviously not an image never reaches a confirmation that
                 would make it look considered. -->
            <ui-confirm-dialog
                id="firmware-confirm"
                .open=${Boolean(pending)}
                question=${pending?.kind === 'latest' && targetName !== null
                    ? t('Write {build} to the machine?', { build: targetName })
                    : t('Write this firmware to the machine?')}
                detail=${[t(FIRMWARE_DURATION), t(FIRMWARE_CARE), t(FIRMWARE_INTERRUPTION)].join(' ')}
                confirm-label=${t('Update firmware')}
                tone="destructive"
                @confirm=${this.#onFlashConfirm}
                @cancel=${() => { this._flashPending = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._flashPending = null; }}
            ></ui-confirm-dialog>
        </section>`;
    }

    /**
     * IS THIS IMAGE FOR THIS MACHINE? — the check Ben asked for on 27 August 2026.
     *
     * WHAT IT REPLACED, AND WHY BOTH HALVES WERE WRONG. The old test was an extension and
     * a size: a name ending `.bin`, between 64 KB and 32 MB. Neither half could answer the
     * only question that matters here. Size cannot separate the two firmwares because they
     * overlap — a DE1 image is 463,872 B and a Bengle MainCPU image is around 360-460 KB —
     * and the EXTENSION test refused correct images, because the DE1 firmware Decent
     * actually ships is `bootfwupdate.dat`, which is the file ReaPrime's own manifest names
     * in the provenance string of both bundled artifacts. So the check that was there would
     * have waved through a DE1 image on a Bengle and turned away the genuine article for
     * its filename.
     *
     * WHY THE SKIN HAS TO DO THIS AT ALL, which is the part worth not forgetting. The
     * MANAGED route is guarded server-side and cannot be talked out of it — a model
     * mismatch is 422 and `force: true` does not lift it. The RAW route this file picker
     * uses is guarded by nothing: `_uploadRaw` refuses an EMPTY body and nothing else, and
     * upstream's own test proves the scope by uploading a ONE-BYTE image and getting a 200.
     * There is no server-side check here to defer to.
     *
     * ONLY THE HEAD IS READ. The board marker is 4 bytes at offset 4 of a 64-byte header,
     * so the decision needs 64 bytes rather than the whole 400 KB — and the whole file is
     * only read once the answer is yes.
     */
    async #firmwareVerdict(file) {
        const model = this.deps?.firmware?.get?.()?.catalog?.machine?.model ?? null;
        if (!file) return { ok: false, verdict: IMAGE_VERDICT.TOO_SHORT, imageClass: null, machineClass: null };
        const size = Number(file.size);
        const head = typeof file.slice === 'function'
            ? new Uint8Array(await file.slice(0, FIRMWARE_HEADER_BYTES).arrayBuffer())
            : new Uint8Array(await file.arrayBuffer());
        return checkFirmwareImage(head, model, Number.isFinite(size) ? size : head.byteLength);
    }

    /**
     * The sentence for a refusal, which is a DIFFERENT sentence per verdict.
     *
     * FIVE REFUSALS, FIVE THINGS TO DO. "That file was refused" would throw away the whole
     * reason the check distinguishes them: a person who picked a photograph needs to pick a
     * different file, a person holding DE1 firmware for a Bengle needs a different
     * FIRMWARE, and a person whose machine has not answered needs to wait rather than go
     * looking for another file. A single message would send two of the three the wrong way.
     *
     * THE WRONG-MACHINE SENTENCE NAMES BOTH SIDES, because "wrong firmware" invites the
     * reader to try again with something else that is also wrong. It says which image they
     * are holding and which machine this is.
     */
    #firmwareRefusal(rejected) {
        const t = this.#i18n.t;
        /* THE CLASS NAMES COME FROM THE MODULE THAT OWNS THE CLASS, and this file spells
         * neither of them. A3 refuses a machine-class literal here — "the class values
         * themselves belong in the registry and the nav, never here" — and it caught this
         * table on its first draft, sitting in this method. It was right: a leaf that
         * spells a class name is one edit from a leaf that branches on one. The names are
         * i18n keys, so they still go through `t()` like everything else drawn here. */
        const name = (machineClass) => t(MACHINE_CLASS_NAMES[machineClass] ?? '');
        switch (rejected?.verdict) {
            case IMAGE_VERDICT.WRONG_MACHINE:
                return t('That is {image} firmware and this machine is a {machine}. Nothing was sent.', {
                    image: name(rejected.imageClass),
                    machine: name(rejected.machineClass),
                });
            case IMAGE_VERDICT.MACHINE_UNKNOWN:
                return t('The machine has not said which model it is, so this image cannot be matched to it. Nothing was sent.');
            case IMAGE_VERDICT.TOO_LARGE:
                return t('That file is far larger than any firmware image. Nothing was sent.');
            case IMAGE_VERDICT.TOO_SHORT:
                return t('That file is too small to be a firmware image. Nothing was sent.');
            default:
                return t('That file carries no firmware header, so there is no way to tell which machine it is for. Nothing was sent.');
        }
    }

    /** The confirmed flash — the one place either install path actually starts. */
    #onFlashConfirm = async () => {
        const pending = this._flashPending;
        this._flashPending = null;
        if (!pending) return;
        if (pending.kind === 'latest') { void this.deps?.firmware?.installLatest?.(); return; }
        if (pending.bytes) void this.deps?.firmware?.installFile?.(pending.bytes);
    };

    /** The flash, as a track and a sentence, or nothing when none has been started. */
    #firmwareProgress(flash) {
        const t = this.#i18n.t;
        if (!flash || flash.state === 'idle') return nothing;
        const say = {
            erasing: t('Erasing'),
            uploading: t('Writing'),
            done: t('Done'),
            error: t('The machine stopped the update'),
            refused: t('The machine would not start the update'),
        };
        /* THE FRACTION IS THE MACHINE'S OWN and is shown only while it sends one.
         * Erasing has no progress to report, and a bar sitting at 0 for a minute reads
         * as a stall rather than as a step. */
        const fraction = typeof flash.progress === 'number' ? flash.progress : null;
        return html`<div class="group">
            <ui-progress-track
                id="firmware-progress"
                .value=${fraction === null ? 0 : Math.round(fraction * 100)}
                .max=${100}
                label=${t('Firmware progress')}
                value-text=${fraction === null ? say[flash.state] ?? '' : `${Math.round(fraction * 100)}%`}
            ></ui-progress-track>
            <p id="firmware-state" class="ui-caption prose"
                >${say[flash.state] ?? flash.state}${flash.error ? ` — ${flash.error}` : ''}</p
            >
        </div>`;
    }

    /**
     * A picked file: CHECKED, then STAGED for the confirmation. Never flashed here.
     *
     * Ben, 26 August 2026: "once a firmware is loaded — downloaded or chosen — check it is
     * valid. Then offer an UPDATE FW button behind a confirmation." Before this, choosing
     * a file WAS the flash: the picker's own dialog was the only thing between a stray tap
     * and an hour of writing.
     */
    #onFirmwareFile = async (event) => {
        const file = event.detail?.file;
        const store = this.deps?.firmware;
        if (!file || !store?.installFile) return;
        const verdict = await this.#firmwareVerdict(file);
        if (!verdict.ok) {
            /* THE VERDICT IS KEPT, NOT A BOOLEAN. It used to be `true`, which meant every
             * refusal drew one sentence; the whole point of reading the header is that the
             * refusals are different from each other. */
            this._flashRejected = verdict;
            return;
        }
        this._flashRejected = null;
        /* READ AS BYTES. A firmware image is not text and `file.text()` would mangle it
         * through UTF-8 before it ever reached the machine. */
        const bytes = new Uint8Array(await file.arrayBuffer());
        this._flashPending = { kind: 'file', bytes };
    };

    #onFirmwareCancel = () => {
        Promise.resolve(this.deps?.firmware?.cancel?.()).catch(() => {});
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 11-12. MAINTENANCE — two irreversible machine states behind one shape
     * ═══════════════════════════════════════════════════════════════════════
     *
     * BOTH LEAVES WERE EMPTY AND THE DECLARED REASON WAS WRONG. The registry said "No
     * route in the contract table starts one. The old page drove it through the machine
     * state machine directly." The second sentence is right and is not a problem: the
     * machine state machine IS the route. `descaling` and `airPurge` are members of
     * `MachineState` (`machine.dart:227` and `:230`), `PUT /machine/state/<newState>`
     * resolves the name with `MachineState.values.byName(newState)`, and
     * `machine-state-store.js` has owned that PUT since the screensaver's wake.
     *
     * SO THERE IS NO NEW STORE HERE, AND THERE SHOULD NOT BE. A second writer of machine
     * state would be a second place deciding what a state request is — the exact thing
     * that store's header refuses ("ONE OWNER, AND IT IS NOT A SCREEN").
     *
     * ONE SHAPE FOR BOTH, because they are the same kind of thing: a list of what to do
     * first, then one button, behind a confirmation. Slate confirms descaling and says
     * why in a comment worth keeping — "descaling cannot be interrupted once started …
     * there is no undo halfway through a descale" (settings.js:975-977). The same is true
     * of an air purge on a machine still holding water.
     *
     * THE PREPARATION LIST IS CONTENT, NOT CONTROLS. Slate prints the same steps; they
     * are the reason the confirmation is meaningful.
     *
     * ═══ AND SINCE 27 AUGUST 2026, THE PAGE SAYS WHAT HAPPENED ═══
     *
     * Both pages used to be silent after Start. The confirmation closed and the page was
     * byte-identical to how it had looked a moment earlier, on a page whose entire content
     * is one button. Meanwhile `machine-state-store.js` published five statuses and the
     * ONLY reader of any of them anywhere in `src/` was the refusal branch below — SENDING
     * and SENT had no reader at all. Two of five published statuses with nobody listening
     * is the finished-half-with-no-other-half this fork exists to remove.
     *
     * SO EACH PROCEDURE NOW CARRIES ITS OWN THREE SENTENCES — running, finished, and the
     * shared acknowledgement of a request that has gone out but not yet been confirmed —
     * and the page picks between them from TWO sources that must not be confused:
     *
     *   the REQUEST store   what this skin asked for, and what the route answered. A 200
     *                       is not a state change; that store's own header says so.
     *   the MACHINE FEED    what the machine reports it is doing. The only thing that can
     *                       say a cycle is actually running, or has stopped.
     *
     * SLATE PROVES THE COMPLETION SENTENCE IS THE POINT of the transport page: its
     * `watchAirPurge` polls the state and, on the falling edge, says "You can turn your
     * machine off once it is out of water." A person packing a machine has no other way to
     * know it is safe to switch off. Decal had that sentence sitting in `i18n/en.json`,
     * seeded from Slate, read by nothing — so the right removal of the dead string was to
     * add the reader, not to delete the key.
     *
     * A STATUS LINE IN THE SECTION, NOT A TOAST. Slate uses toasts for all of this; no
     * settings surface in this skin uses `ui-toast`, the refusal line below already
     * establishes the shape, and a toast that has faded is no use to someone who looked
     * away while a twenty-minute cycle ran.
     */
    #descaling() {
        return this.#machineProcedure({
            id: 'descale',
            state: MACHINE_STATE.DESCALING,
            heading: 'Descaling cycle',
            /* SLATE'S SENTENCE, WHICH SAYS THE ONE THING A USER NEEDS BEFORE PRESSING:
             * how long they are committing to. Decal's said only that it cannot be
             * stopped. Both facts matter and Slate's carries both. */
            caption: 'Takes around 20 minutes and cannot be interrupted once started. Before you begin:',
            action: 'Start',
            confirm: 'Start the descaling cycle?',
            /* THE ONE PROCEDURE THAT CAN SAY THIS, AND IT HAS A CITATION. Slate's own
             * comment at `settings.js:975-977` is the source: "descaling cannot be
             * interrupted once started … there is no undo halfway through a descale". The
             * page's caption already commits the reader to twenty minutes; the dialog
             * repeats the irreversibility in the same words, at the moment of pressing,
             * which is what a confirmation is for. See `#machineProcedure`'s `detail`
             * paragraph for why the purge does NOT get this sentence. */
            detail: 'This cannot be stopped once it has started.',
            steps: [
                'Fill the tank with descaling solution.',
                'Remove the portafilter from the group.',
                'Empty the drip tray and put it back.',
                'Put a container under the group and the steam wand.',
            ],
            /* WHAT THE MACHINE ITSELF IS SAYING, and nothing beyond it. Slate acknowledges
             * the start with a toast reading "Descaling cycle started", which is a claim
             * about a 200 rather than about the machine; these two sentences are read off
             * the machine's own state and off its falling edge, so each one is a thing
             * that has been observed. */
            running: 'The machine is descaling.',
            done: 'The descaling cycle has finished.',
            link: Object.freeze({
                href: DESCALING_INSTRUCTIONS_URL,
                label: 'Descaling Instruction',
            }),
        });
    }

    #transportMode() {
        return this.#machineProcedure({
            id: 'air-purge',
            state: MACHINE_STATE.AIR_PURGE,
            heading: 'Air purge',
            /* SLATE'S SENTENCE PLUS Decal'S REASON. Slate says what it does and when to
             * run it ("before packing the machine to prevent leaks during transport");
             * Decal's said why it matters in storage (freezing). Ben asked for Slate's
             * layout on this page and for Decal's checklist to stay, and the same
             * judgement applies to the sentence: keep both facts, in Slate's shape. */
            caption: 'Purges the remaining water from inside the machine. Run it before packing the machine, so it does not leak in transport or freeze in storage. Before you begin:',
            action: 'Start',
            confirm: 'Purge the water from the machine?',
            /* WHAT THIS PROCEDURE CAN ACTUALLY CITE (27 August 2026).
             *
             * Until today both pages shared ONE confirmation body and it read "This cannot
             * be stopped once it has started." For a descale that is Slate's own sentence
             * with Slate's own comment behind it. For an air purge NOTHING says it —
             * anywhere. Slate's transport dialog carries no such claim (its whole body is
             * "Prepare your espresso machine for transport", `settings.js:5258`), and
             * Slate's `watchAirPurge` polls for the state to GO AWAY and then says "You can
             * turn your machine off once it is out of water", which describes a purge that
             * simply ENDS. So the skin was asserting a fact about the machine it could not
             * cite, in the one place a person is deciding whether to press.
             *
             * WHAT REPLACES IT IS TRUE AND WORTH KNOWING BEFORE PRESSING. The page's own
             * completion sentence — Slate's, verbatim, read off the machine's falling edge
             * — already says the machine ends up out of water. Saying so BEFORE the press
             * is the fact that changes whether someone presses now or after their next
             * coffee, and it is corroborated by the same evidence.
             *
             * TWO THINGS ARE DELIBERATELY NOT HERE, and both wait on Ben:
             *
             *   1. NO IRREVERSIBILITY CLAIM. Nobody has established whether a purge can be
             *      stopped — `PUT /machine/state/idle` is a route this skin already owns,
             *      and `MachineState` carries `idle` beside `airPurge`, so a stop is
             *      SPELLABLE. Whether the firmware honours it mid-purge is not known here
             *      and is not something a settings page may guess at.
             *
             *   2. NO STOP CONTROL, for exactly that reason. The button would be the other
             *      half of an answer nobody has given. Ben has the question (27 August
             *      2026): can an air purge be stopped by asking for idle, and does the
             *      machine need priming afterwards? The day he answers, the stop control
             *      and — if priming is needed — a sentence about it land HERE, in this
             *      procedure's own fields, which is why `detail` became per-procedure
             *      rather than a shared constant. */
            detail: 'The machine is left empty of water afterwards.',
            steps: [
                'Empty the water tank and put it back.',
                'Remove the portafilter from the group.',
                /* "AND PUT IT BACK", BECAUSE STEP FOUR DEPENDS ON IT (27 August 2026).
                 * This said "Empty the drip tray." and the very next step says to leave
                 * the steam wand pointing into the tray — a tray the reader was last told
                 * to remove. The purge discharges into it, so it has to be there. The
                 * descaling page was corrected to Slate's exact wording earlier and this
                 * page kept the old sentence; the phrasing is the house style anyway, as
                 * step 1 above it has always shown. */
                'Empty the drip tray and put it back.',
                'Leave the steam wand pointing into the tray.',
            ],
            /* SLATE'S OWN TWO SENTENCES, verbatim, and both of them were already in
             * `i18n/en.json` with no reader anywhere in `src/`. The second one is the
             * whole point of this page: the person reading it is packing a machine and
             * needs to be told when it is safe to switch off. */
            running: 'Now removing water from your espresso machine.',
            done: 'You can turn your machine off once it is out of water. It will then be ready for transport.',
            /* THE PRECONDITION Decal'S OWN STEP 1 CREATES.
             *
             * Slate's `startAirPurge` refuses to open its dialog when the machine reports
             * `needsWater`, and its comment names the cause: "Firmware quirk: a needsWater
             * state blocks transport mode outright. Pressing the group stop button
             * overrides the out-of-water signal, after which Start works normally."
             *
             * Decal had no such guard — and Decal's step 1 tells the user to empty the
             * water tank, which is exactly how a machine arrives at `needsWater`. So the
             * page walked the reader into the one state that blocks the thing the page
             * exists to start, and then, when Start did nothing, offered either silence or
             * a refusal line reading "It may be busy, or not connected", which is wrong
             * advice about the actual cause.
             *
             * DESCALING IS NOT GATED THIS WAY. Slate does not gate it, and a descale
             * starts from a tank full of solution — there is no reason to think the same
             * quirk applies, and inventing one would be this page asserting a firmware
             * behaviour nobody has observed. */
            blockedBy: MACHINE_STATE.NEEDS_WATER,
            blockedReason: 'Out of water',
            blockedRemedy: 'Press the stop button on the group head to override, then tap Start again.',
        });
    }

    /**
     * The shared body, in SLATE'S ARRANGEMENT since 26 August 2026.
     *
     * Ben on both pages: "use slates layout completely" (descaling) and "slates layout but
     * add the list of things to do first that we have" (transport). Slate puts the section
     * heading and its one action on ONE LINE, with the button hard right, and the
     * explanation and the checklist below them.
     *
     * WHY THAT IS BETTER AND NOT JUST DIFFERENT: the button used to sit under step four,
     * so the page read as a checklist that ended in a button — as though pressing it were
     * the last step rather than the thing the four steps prepare for. Above the list, it
     * is plainly the action, and the list is plainly its precondition.
     *
     * THE BUTTON IS PRIMARY, NOT DANGER. It was drawn in the destructive treatment, which
     * on this page overstated things: a descale is a maintenance cycle a machine is meant
     * to have, and the irreversible part — you cannot stop it — is what the CONFIRMATION
     * is for, where it is stated in the same words. Slate draws its own as the page's
     * affirmative action.
     *
     * `machineState.request()` reports its own refusal, which is shown rather than
     * swallowed — a 400 here is the machine saying no, and that is news.
     *
     * THE REFUSAL BELONGS TO THE PAGE THAT ASKED, and until 27 August 2026 it did not.
     * The branch tested the STATUS and never `requested`, which the store records on every
     * branch — and Descaling and Transport Mode share ONE store instance and ONE settings
     * screen. So a purge the machine refused left a refusal that the Descaling page then
     * displayed as its own, with no descale ever attempted. A message about a request that
     * was not made is worse than silence, and the store had been carrying the discriminator
     * all along with nobody reading it.
     *
     * THE CHECKLIST IS SLATE'S FLAT TREATMENT (Ben: "use slates layout completely"), and
     * that is a fix as well as a copy of a layout. The steps were `.ui-body` — full
     * inherited ink at `--ui-text-base` — while the sentence above them, the one saying
     * the cycle takes twenty minutes and cannot be interrupted, was `.ui-caption`: muted
     * ink at `--ui-text-note`. The irreversibility warning was the QUIETEST text on the
     * page and "Remove the portafilter from the group" was louder than it. Slate puts both
     * in its caption role — `<p class="slate-caption">` and `<ol class="slate-caption
     * slate-prereqs">` — and the inversion goes away.
     *
     * THE CLASS GOES ON THE LIST, NEVER ON THE ITEMS, and that is not a style preference.
     * `:where(.ui-caption)` sets `display: block`; on an `<li>` that removes the marker and
     * the numbers vanish. On the `<ol>` it is beaten by `.steps { display: grid }` at
     * specificity (0,1,0) against a zero-specificity `:where()`, so the grid survives, the
     * items stay `list-item`, and they inherit the caption's colour and size.
     *
     * `detail` IS PER-PROCEDURE AND HAS NO DEFAULT (27 August 2026).
     *
     * It was a constant in the template — "This cannot be stopped once it has started." —
     * printed under BOTH questions. Descaling can cite that sentence (Slate's own comment,
     * `settings.js:975-977`). The air purge cannot cite it from anywhere: Slate's transport
     * dialog says only "Prepare your espresso machine for transport", and Slate's own
     * watcher describes a purge that ends on its own. One shared body meant the page with
     * evidence and the page without it made the same claim.
     *
     * NO DEFAULT VALUE, deliberately. A default would let a third procedure arrive and
     * inherit whichever sentence happened to be written for the first two — which is how
     * this defect appeared in the first place. Destructuring without a default makes the
     * parameter required in practice: a caller that forgets it renders an empty `detail`
     * attribute and `ui-confirm-dialog` draws no detail paragraph at all, which is a
     * visible absence rather than a borrowed claim.
     */
    #machineProcedure({
        id, state, heading, caption, action, confirm, detail, steps,
        running, done, link = null,
        blockedBy = null, blockedReason = null, blockedRemedy = null,
    }) {
        const t = this.#i18n.t;
        const store = this.deps?.machineState ?? null;
        const request = store?.get?.() ?? null;
        /* THIS PAGE'S OWN REQUEST, and only this page's. See the note above. */
        const mine = request?.requested === state;
        const refused = mine && (request.status === REQUEST_STATUS.REFUSED
            || request.status === REQUEST_STATUS.FAILED);
        const sent = mine && request.status === REQUEST_STATUS.SENT;

        /* THE MACHINE'S OWN ANSWER. `null` means no feed reached this leaf, which is not
         * `idle` and must not be rendered as one: with no feed the page can still report
         * what it ASKED for, and says nothing about what the machine is doing. */
        const machine = this._machineState;
        const isRunning = machine !== null && machine === state;
        /* THE FALLING EDGE. Seen in the state, and no longer in it — which is the only
         * moment at which "it has finished" is a thing that has been observed rather than
         * a thing assumed from a 200 twenty minutes ago. */
        const finished = !isRunning && this._procedureSeen === state;
        const blocked = blockedBy !== null && machine === blockedBy;

        /* ONE LINE, AND THE MACHINE OUTRANKS THE REQUEST. What it is doing now beats what
         * it has done, which beats what it was asked to do, which beats a refusal — and
         * the last two cannot both be true anyway, because the store holds one status. */
        const status = isRunning ? running
            : (finished ? done
                : (sent ? 'The machine has been asked to start. It has not reported starting yet.'
                    : null));

        return html`
            <section class="group" id=${id}>
                <div class="fact-head">
                    <h3 class="ui-heading">${t(heading)}</h3>
                    <ui-button
                        id=${`${id}-start`}
                        variant="primary"
                        ?disabled=${!store || blocked}
                        @click=${() => { this._confirm = id; }}
                    >${t(action)}</ui-button>
                </div>
                <p class="ui-caption prose">${t(caption)}</p>
                <ol class="steps ui-caption">
                    ${steps.map((step) => html`<li
                        >${t(step)}</li
                    >`)}
                </ol>
                ${link
                    ? html`<a
                        id=${`${id}-instructions`}
                        class="ui-body doc-link"
                        href=${link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >${t(link.label)}</a>`
                    : nothing}
                ${blocked
                    ? html`<span id=${`${id}-blocked`} class="ui-caption prose"
                        >${t(blockedReason)} — ${t(blockedRemedy)}</span
                    >`
                    : nothing}
                ${status
                    ? html`<span id=${`${id}-status`} class="ui-caption prose"
                        >${t(status)}</span
                    >`
                    : nothing}
                ${refused
                    ? html`<span id=${`${id}-refusal`} class="ui-caption"
                        >${t('The machine refused. It may be busy, or not connected.')}</span
                    >`
                    : nothing}
            </section>
            <ui-confirm-dialog
                id=${`${id}-confirm`}
                .open=${this._confirm === id}
                question=${t(confirm)}
                detail=${detail ? t(detail) : ''}
                confirm-label=${t(action)}
                tone="destructive"
                @confirm=${() => this.#runProcedure(state)}
                @cancel=${() => { this._confirm = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._confirm = null; }}
            ></ui-confirm-dialog>
        `;
    }

    #runProcedure(state) {
        this._confirm = null;
        /* A NEW RUN CLEARS THE LAST ONE'S COMPLETION. Without this, a second purge would
         * open under "You can turn your machine off once it is out of water" — a sentence
         * about the run before it, sitting over a run that has just been asked for. */
        if (this._procedureSeen === state) this._procedureSeen = null;
        Promise.resolve(this.deps?.machineState?.request?.(state)).catch(() => {});
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 13. EXTENSIONS > PLUGINS — the installed list
     * ═══════════════════════════════════════════════════════════════════════
     *
     * `GET /api/v1/plugins` was in the route table and in `CONTRACTS.json` with an empty
     * `consumedBy`. That is the whole story of this leaf: a route the client could spell
     * and nobody called.
     *
     * ONE ROW PER MANIFEST, and the row says the three things the handler reports —
     * name, version, author — plus the switch. `loaded` and `autoLoad` move together
     * because `/enable` sets both, so the switch reads `autoLoad`: it is the PERSISTENT
     * answer, and `loaded` can differ transiently while a plugin is being reloaded after
     * a settings write.
     *
     * THERE IS NO REMOVE, AND THAT IS A DECISION MADE ON THE PIN (27 August 2026).
     *
     * There was one, behind a confirmation reading "This skin cannot install it again —
     * ReaPrime does not serve plugin installation yet." The first half is true of the
     * install ROUTE (`POST /plugins/install` answers 501) and FALSE OF THE OUTCOME, which
     * is the only half a person acts on.
     *
     * ALL SIX PLUGINS ON THIS PAGE ARE REAPRIME'S BUNDLED SIX. `_copyBundledPlugins()` runs
     * at loader init and copies each one back out of assets whenever its directory is
     * absent (`plugin_loader_service.dart:98`, `:535-616`), and
     * `_ensureBundledPluginsAutoLoadEnabled()` then sets auto-load true for any bundled
     * plugin whose autoload key is missing (`:654-698`) — which is exactly the key
     * `removePlugin` has just deleted (`:156-184`). So Remove did not remove anything
     * permanently. It unloaded the plugin, DELETED ITS STORED SETTINGS AND ITS SECURE
     * SETTINGS — the Visualizer password among them — and the plugin came back at the next
     * app start, enabled and unconfigured. Someone removing "Visualizer upload" to tidy the
     * list silently lost their credentials and got the plugin back looking fine.
     *
     * AND THE SKIN CANNOT PHRASE AN HONEST DIALOG AT THIS PIN. `GET /plugins` returns the
     * manifest plus `loaded` and `autoLoad` and nothing else (`plugins_handler.dart:20-33`)
     * — no `source`, no bundled flag — so nothing on the wire tells "bundled, comes back"
     * apart from "installed, gone for good". A control whose consequence cannot be stated
     * is not a control this page can offer.
     *
     * NOTHING IS LOST BY DROPPING IT, which is also Slate's position: the need behind
     * Remove — stop this plugin doing things — is served exactly by the switch already on
     * the row. The day the pin moves to a ReaPrime whose listing carries `source` (it is in
     * the working tree today and absent at 2b047d02), a TRUE Remove becomes expressible and
     * belongs only on rows where `source` is non-null.
     */
    #plugins() {
        const t = this.#i18n.t;
        const store = this.deps?.plugins;
        const state = store?.get?.() ?? null;

        if (!state || state.status === PLUGINS_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="plugins-unavailable"
                heading=${t('The plugin list is not available')}
                body=${t('ReaPrime has not answered for its installed plugins.')}
            ></ui-empty-state>`;
        }
        if (state.plugins.length === 0 && state.status === PLUGINS_STATUS.READY) {
            return html`<ui-empty-state
                id="plugins-empty"
                heading=${t('No plugins installed')}
                body=${t('Plugins add features such as shot upload. They are installed on the machine, not in this skin.')}
            ></ui-empty-state>`;
        }

        return html`
            <section class="group" id="plugin-list">
                <h3 class="ui-heading">${t('Installed plugins')}</h3>
                <!-- ONE GRID OVER EVERY ROW, so the switch and the Open button land on
                     the same edges however long a plugin's name is. Rows are separated by
                     space and not by rules (Ben, 26 Aug 2026: "remove the horizontal lines
                     between rows"). -->
                <div class="plugins">
                    ${state.plugins.map((plugin) => this.#pluginRow(plugin))}
                </div>
            </section>
            ${this._pluginOpenFailed
                ? html`<p id="plugin-open-failed" class="ui-caption prose"
                    >${t('The plugin page could not be opened.')}</p>`
                : nothing}
            ${this.#pluginSettingsDialog()}
        `;
    }

    /**
     * One installed plugin.
     *
     * THE VERSION SITS BESIDE THE NAME, which is Slate's own shape and is the one a person
     * scans for: Decal put it on a third line under the description, after the author,
     * so finding a build number meant reading a paragraph first.
     *
     * THE DESCRIPTION WRAPS TO TWO LINES AND THEN STOPS WITH AN ELLIPSIS. It was cut dead
     * at the row's edge, mid-word and with no mark — "until it's ready f", "an embeddable
     * HTML p" — which reads as a rendering fault rather than as a summary.
     *
     * OPEN IS OFFERED WHERE THE MANIFEST DECLARES A PAGE, and nowhere else. Slate decides
     * this by testing whether the DESCRIPTION contains a URL (`pluginHasUi`,
     * settings.js:7006), which is a sniff: a plugin that mentions its website in a sentence
     * gets a button to nothing. The manifest's `api` array is the declaration, and the
     * endpoint that means "page" is the one whose id is `ui` — see `pluginPage`, which also
     * records why the earlier "first http endpoint" reading gave four of the six rows a
     * button onto raw JSON.
     *
     * THE VERSION AND THE DESCRIPTION BOTH GO THROUGH A HELPER NOW, and both helpers exist
     * for a defect: `v${version}` rendered "vv1.0.3" for a manifest that already spelled
     * its own v, and the raw description printed a localhost URL that this row's own Open
     * button already answers. `pluginVersion` and `pluginBlurb` carry the reasoning.
     *
     * THE BLURB IS GUARDED ON THE STRIPPED TEXT, not on `plugin.description`. A description
     * that was ONLY a URL would otherwise leave an empty caption line holding open a row of
     * space that says nothing.
     */
    #pluginRow(plugin) {
        const t = this.#i18n.t;
        const page = pluginPage(plugin);
        const version = pluginVersion(plugin.version);
        const blurb = pluginBlurb(plugin);
        return html`<div class="plugin" data-plugin=${plugin.id}>
            <span class="plugin-name">
                <span class="plugin-title">
                    <span class="ui-heading">${plugin.name ?? plugin.id}</span>
                    ${version
                        ? html`<span class="ui-caption ui-numeric"
                            >${version}</span>`
                        : nothing}
                </span>
                ${blurb
                    ? html`<span class="ui-caption plugin-blurb"
                        >${blurb}</span>`
                    : nothing}
                ${plugin.author
                    ? html`<span class="ui-caption"
                        >${plugin.author}</span>`
                    : nothing}
            </span>
            <ui-switch
                aria-label=${`${t('Enable')} ${plugin.name ?? plugin.id}`}
                ?checked=${plugin.autoLoad === true}
                @change=${(event) => this.#onPluginEnabled(plugin.id, event)}
            ></ui-switch>
            <span class="device-actions">
                ${pluginHasSettings(plugin)
                    ? html`<ui-icon-button
                        class="plugin-settings"
                        data-plugin-settings=${plugin.id}
                        label=${`${t('Settings for')} ${plugin.name ?? plugin.id}`}
                        @click=${() => this.#openPluginSettings(plugin.id)}
                    >${gearIcon()}</ui-icon-button>`
                    : nothing}
                ${page
                    ? html`<ui-button
                        class="plugin-open"
                        @click=${() => this.#openPluginPage(plugin.id, page)}
                    >${t('Open')}</ui-button>`
                    : nothing}
            </span>
        </div>`;
    }

    /**
     * A PLUGIN'S OWN SETTINGS, IN A DIALOG.
     *
     * Ben, 30 August 2026: "the settings, plugin, seems to miss anything that allows me to
     * open the settings page? Might be the case for all plugins?" It was. Every row
     * carried a name, an enable switch and an Open button that appears ONLY when a plugin
     * declares an HTML page — and nothing ever called `settingFields`, which has been in
     * `plugins-store.js` the whole time and had exactly one caller: the hand-built
     * Visualizer leaf. So a plugin with settings and no page had nowhere to be configured.
     *
     * A DIALOG, NOT A PAGE, and the nav is why: `settings-nav.js` declares its leaves
     * statically, so a plugin that arrives at runtime can never have one. The dialog also
     * puts the form where the person already is.
     *
     * IT REUSES `#pluginForm` WHOLE. That function has always taken a plugin id — the
     * Visualizer leaf is one call to it — so nothing here re-implements the form, and a
     * field type learned by one surface is learned by both.
     */
    #openPluginSettings(pluginId) {
        this._pluginSettingsFor = pluginId;
        this._pluginDraft = null;
        const load = this.deps?.plugins?.loadSettings?.(pluginId);
        if (load && typeof load.catch === 'function') load.catch(() => {});
    }

    #closePluginSettings = () => {
        this._pluginSettingsFor = null;
        this._pluginDraft = null;
    };

    #pluginSettingsDialog() {
        if (!this._pluginSettingsFor) return nothing;
        const t = this.#i18n.t;
        const id = this._pluginSettingsFor;
        const manifest = this.deps?.plugins?.plugin?.(id) ?? null;
        return html`<ui-dialog
            id="plugin-settings-dialog"
            open
            heading=${manifest?.name ?? id}
            label=${t('Plugin settings')}
            @open-change=${(event) => {
                if (event?.detail?.open === false) this.#closePluginSettings();
            }}
        >${this.#pluginForm(id, null)}</ui-dialog>`;
    }

    /**
     * Open a plugin's own page.
     *
     * A NEW CONTEXT, WITH `noopener`, and Slate's own comment says why: "a same-window
     * navigation strands the user on a kiosk with no back control". The page belongs to
     * the plugin and is served by the machine, so it is a navigation rather than something
     * this skin renders.
     *
     * NO `?layout=baseline`. Slate appends it; `decent-profile.reaplugin` stores a `layout`
     * setting of its own, and a query parameter from this skin would override the value the
     * plugin owns — B7, across a boundary rather than inside one.
     *
     * A REFUSED OPEN IS REPORTED (27 August 2026). This swallowed a throw and, worse,
     * `window.open` returning NULL in a webview is not a throw at all — so a blocked or
     * refused navigation did nothing and said nothing, and the reader was left pressing a
     * button. Decal's standing rule since 26 August is that a failed write is surfaced;
     * a failed navigation is the same shape, so the return value is captured and a missing
     * window sets the line the leaf prints under the list.
     */
    #openPluginPage(pluginId, endpointId) {
        const base = this.deps?.plugins?.pageUrl?.(pluginId, endpointId);
        if (!base) return;
        this._pluginOpenFailed = false;
        let opened = null;
        try {
            opened = this.ownerDocument?.defaultView?.open?.(base, '_blank', 'noopener') ?? null;
        } catch {
            opened = null;
        }
        if (!opened) this._pluginOpenFailed = true;
    }

    #onPluginEnabled(id, event) {
        const next = event?.detail?.checked;
        if (typeof next !== 'boolean') return;
        void this.deps?.plugins?.setEnabled(id, next);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 14. EXTENSIONS > VISUALIZER — one plugin's settings, generated
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE FORM IS BUILT FROM THE MANIFEST, WHICH IS WHY IT IS A SUPERSET OF SLATE'S.
     * Slate hand-writes four fields (username, password, auto-upload, minimum duration);
     * the manifest at the pin declares SIX, and the two Slate does not draw — `BackSync`
     * and `BackSyncIntervalSeconds` — are exactly what a hand-written form loses when the
     * plugin moves. `settingFields()` joins schema to values in one place and both this
     * leaf and Plugins read it.
     *
     * A SECURE FIELD SHOWS ITS STATE AND NEVER ITS VALUE. `GET .../settings` answers
     * `{"Password": {"isSet": true}}` and `savePluginSettings` ignores anything of that
     * shape coming back, so the round trip cannot blank a stored secret and this skin
     * cannot display one. The note beside the box is the whole of what is knowable.
     *
     * NO "VERIFY CREDENTIALS" BUTTON. Slate has one and it calls visualizer.coffee
     * DIRECTLY from the tablet's browser; there is no ReaPrime route that checks a
     * Visualizer login, and a skin reaching a third-party host is a different thing from
     * a skin talking to its machine. What this leaf can honestly report is whether the
     * plugin is loaded, which is the manifest's own `loaded`.
     */
    #visualizer() {
        return this.#pluginForm(VISUALIZER_PLUGIN_ID, 'Visualizer');
    }

    #pluginForm(pluginId, title) {
        const t = this.#i18n.t;
        const store = this.deps?.plugins;
        const manifest = store?.plugin?.(pluginId) ?? null;
        const values = store?.settingsFor?.(pluginId) ?? null;

        if (!manifest) {
            return html`<ui-empty-state
                id="plugin-absent"
                heading=${t('This plugin is not installed')}
                body=${t('It is installed on the machine, not in this skin. Check the Plugins page.')}
            ></ui-empty-state>`;
        }

        const fields = settingFields(manifest, values);
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : {};
        const dirty = Object.keys(draft).length;

        return html`
            <section class="group" id="plugin-state">
                <!-- NO HEADING WHEN THE SURFACE ALREADY NAMES THE PLUGIN. The Visualizer
                     leaf is a page and needs one; the gear's dialog carries the name in
                     its own title, and repeating it read as "Settings / Settings". -->
                ${title ? html`<h3
                    class="ui-heading"
                >${t(title)}</h3>` : nothing}
                <div class="form-row" data-control="switch">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Enable')} ${manifest.name ?? pluginId}</span>
                        <span class="ui-caption">${manifest.description ?? ''}</span>
                    </div>
                    <ui-switch
                        id="plugin-enabled"
                        aria-label=${`${t('Enable')} ${manifest.name ?? pluginId}`}
                        ?checked=${manifest.autoLoad === true}
                        @change=${(event) => this.#onPluginEnabled(pluginId, event)}
                    ></ui-switch>
                </div>
            </section>

            ${fields.length === 0
                ? nothing
                : html`<section class="group" id="plugin-settings">
                <h3 class="ui-heading">${t('Settings')}</h3>
                    ${fields.map((field) => this.#pluginField(pluginId, field, draft))}
                    <div class="sw-row">
                        <span class="ui-caption">${dirty
                            ? `${dirty} ${t(dirty === 1 ? 'change not saved' : 'changes not saved')}`
                            : t('Saving reloads the plugin.')}</span>
                        <ui-button
                            id="plugin-save"
                            variant="primary"
                            ?disabled=${dirty === 0}
                            @click=${() => this.#onPluginSave(pluginId)}
                        >${t('Save')}</ui-button>
                    </div>
                </section>`}
        `;
    }

    /**
     * One generated field.
     *
     * AN UNSUPPORTED TYPE IS PRINTED, NOT SKIPPED. A plugin may declare a type this skin
     * has no control for; a form that quietly omitted it would be a form nobody can trust
     * to be the whole of one, and the plugin's own author would have no way to tell.
     */
    #pluginField(pluginId, field, draft) {
        const t = this.#i18n.t;
        const staged = Object.hasOwn(draft, field.key);
        const shown = staged ? draft[field.key] : field.value;
        const copy = pluginFieldCopy(pluginId, field);
        const isSwitch = field.type === 'boolean';

        if (!field.supported) {
            return html`<div class="form-row" data-field=${field.key}>
                <div class="sw-label">
                    <span class="ui-heading">${t(copy.heading)}</span>
                    <span class="ui-caption">${t(copy.caption)}</span>
                </div>
                <span class="ui-caption">${t('This plugin setting has a kind this skin cannot edit')} (${field.type ?? '?'})</span>
            </div>`;
        }

        return html`<div
            class="form-row"
            data-field=${field.key}
            data-control=${isSwitch ? 'switch' : 'field'}
        >
            <div class="sw-label">
                <span class="ui-heading">${t(copy.heading)}</span>
                <span class="ui-caption">${t(copy.caption)}</span>
                ${field.secure
                    ? html`<span class="ui-caption"
                        >${field.isSet === true
                            ? t('A value is stored. Type a new one to replace it.')
                            : t('Nothing stored yet.')}</span
                    >`
                    : nothing}
            </div>
            ${isSwitch
                ? html`<ui-switch
                    aria-label=${t(copy.heading)}
                    ?checked=${shown === undefined ? field.fallback === true : shown === true}
                    @change=${(event) => this.#onPluginField(pluginId, field.key, event.detail?.checked)}
                ></ui-switch>`
                /* THE KEYBOARD FOLLOWS THE DECLARED TYPE (audit F-045, 29 August 2026).
                 *
                 * A plugin setting declared `type: "number"` rendered with no `inputmode`,
                 * so the tablet offered QWERTY for a digits-only field. The posted value
                 * was always correct — `#onPluginField` puts it through `numberOrNull` —
                 * and the person had to hunt for the digits.
                 *
                 * AND `type="number"` IS NOT WHAT FIXES IT, WHICH IS THE POINT. #26's
                 * `TEXT_TYPES` deliberately excludes `number` ("`number` belongs to the
                 * stepper (#4)"), so the `type` passed on the line below falls back to
                 * `text` at the inner input. That is a decision, not a gap — but it means
                 * the ONLY lever this field has over the panel keyboard is `inputmode`,
                 * which #26 has carried through to its input since it was written.
                 *
                 * `decimal` RATHER THAN `numeric`, because a plugin number need not be an
                 * integer and `numeric` offers no decimal point.
                 *
                 * NO `pattern`. On a `text` input it would engage `:invalid` — and #26
                 * mirrors validity onto `aria-invalid` — so a half-typed number would
                 * announce itself as wrong while somebody is still typing it. A plugin
                 * declares no bounds and this skin has none to invent (B2), so the honest
                 * state is "no validity claimed". */
                : html`<ui-text-field
                    label=${t(copy.heading)}
                    hide-label
                    type=${field.secure ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    inputmode=${field.type === 'number' && !field.secure ? 'decimal' : nothing}
                    .value=${shown === undefined || shown === null ? '' : String(shown)}
                    @change=${(event) => this.#onPluginField(
                        pluginId,
                        field.key,
                        field.type === 'number' ? numberOrNull(event.target?.value) : event.target?.value,
                    )}
                ></ui-text-field>`}
        </div>`;
    }

    #onPluginField(pluginId, key, value) {
        if (value === undefined) return;
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : {};
        this._pluginDraft = { id: pluginId, values: { ...draft, [key]: value } };
    }

    /**
     * Save the staged fields. THE DRAFT IS CLEARED ONLY ON SUCCESS — a 400 (an unknown
     * key, which is the one thing the handler validates) leaves the typed values on
     * screen, exactly as the leaf model's staged machine patch does.
     */
    async #onPluginSave(pluginId) {
        const draft = this._pluginDraft?.id === pluginId ? this._pluginDraft.values : null;
        if (!draft || Object.keys(draft).length === 0) return;
        const ok = await this.deps?.plugins?.writeSettings(pluginId, draft);
        if (ok) this._pluginDraft = null;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 15. HELP > TALK TO DECENT — a reading, because that is all there is
     * ═══════════════════════════════════════════════════════════════════════
     *
     * `GET /api/v1/account/decent` answers `{loggedIn: bool}` and there is NO SIGN-IN
     * ROUTE on the web API — `DecentAccountService` owns the credentials and ReaPrime
     * signs in through its own Flutter UI. `/account/proxy/<rest>` forwards an already
     * authenticated request and cannot establish a session.
     *
     * So this leaf reports and does not ask. A username and password box here would
     * collect credentials with nowhere to send them, which is worse than an empty page —
     * and an empty page is what shipped before, telling the user nothing at all.
     *
     * THREE STATES, NOT TWO. Signed in, signed out, and NOT ASKED — the last one is what
     * a machine that has not answered looks like, and calling it "signed out" would be a
     * guess printed as a fact.
     */
    #decentAccount() {
        const t = this.#i18n.t;
        const state = this.deps?.account?.get?.() ?? null;

        if (!state || state.status === ACCOUNT_STATUS.UNAVAILABLE) {
            return html`<ui-empty-state
                id="account-unavailable"
                heading=${t('The account status is not available')}
                body=${t('ReaPrime has not answered. The status arrives once it is reachable.')}
            ></ui-empty-state>`;
        }

        /* SLATE'S PAGE, ON BEN'S RULING (26 August 2026: "mostly copy Slate ... what
         * happens with a linked account is not yet known") — WITH THE THREE CLAIMS SLATE
         * MAKES THAT ARE FALSE ON THIS PLATFORM TAKEN OUT (27 August 2026).
         *
         * Ben's ruling was "mostly copy Slate", not "copy a claim the code contradicts",
         * and three of Slate's sentences were carried across without being checked against
         * ReaPrime:
         *
         *   "Open the Decent app on your phone."  SIGN-IN IS NOT ON A PHONE. ReaPrime's own
         *       launcher carries an Account destination (`launcher_view.dart`) whose page
         *       hosts an email-and-password form (`decent_login_form.dart`) posting to
         *       /support/api/login_test. The credentials live in ReaPrime, on this tablet.
         *
         *   "add this machine to your account"    NOTHING ADDS A MACHINE. `fetchSerialNumbers`
         *       reads the machines ALREADY on the account, `verifyMachineSerial` checks
         *       whether this one is among them, and `emailSerialMismatch` EMAILS SUPPORT
         *       when it is not (`decent_account_service.dart`). There is no add.
         *
         *   "this page will show the message box"  THERE IS NO MESSAGE BOX HERE. The thread
         *       Slate composes needs a route this skin has not adopted, and Ben said the
         *       linked state is not yet decided. So the promise is dropped rather than
         *       made and broken.
         *
         * AND THE STRUCTURAL BUG UNDER ALL THREE: `linked` was computed and used ONLY for
         * the chip's label, so a machine WITH an account was still shown the paragraph and
         * the three how-to-link steps. Instructions for a thing that has already happened.
         * The branch below is the fix, and it is why the steps are inside it.
         *
         * THE CHIP IS ONE WORD NOW, and the sentence moved into #38's heading. A
         * `ui-status-chip` is uppercase with cap tracking and WRAPS, so "No Decent account
         * linked" printed as a four-word tracked pill; the chip is for one-word machine
         * states. Slate itself puts this sentence in a heading inside a dashed empty-state
         * card, which is the very element `ui-empty-state` was built from — its oracle
         * citations read this page. So the vocabulary Ben settled on is kept and only its
         * container changes.
         */
        const linked = state.loggedIn === true;
        const known = state.loggedIn !== null;
        return html`<section class="group" id="account">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Decent account')}</h3>
                <ui-status-chip id="account-state"
                >${!known
                    ? t('Not known')
                    : t(linked ? 'Linked' : 'Not linked')}</ui-status-chip>
            </div>
            ${linked
                ? html`<p id="account-linked" class="ui-caption prose"
                    >${t('This machine is signed in to a Decent account. Messages to support are sent from it.')}</p>
                    ${this.#supportThread()}
                    ${this.#supportCompose()}`
                : html`<ui-empty-state
                    id="account-empty"
                    boxed
                    heading=${t(known ? 'No Decent account linked' : 'Whether an account is linked is not known yet')}
                >
                    <p class="ui-caption prose"
                        >${t('Messages to support are sent from your Decent account. Signing in happens in ReaPrime, not in this skin:')}</p>
                    <ol class="steps">
                        ${[
                            'Leave this skin and open Account in ReaPrime.',
                            'Sign in with your Decent email and password.',
                            /* THE PROMISE IS KEPT NOW, SO THE PROMISE COMES BACK (27 August
                             * 2026). Slate's own third step is "Come back here — this page
                             * will show the message box", and an earlier pass here replaced
                             * it with "this page will say the account is linked" for the
                             * best of reasons: there WAS no message box, and a page must not
                             * promise what it does not build. The box is built. The weaker
                             * sentence would now UNDERSELL the page — someone who signs in
                             * to send a message would be told only that a chip will change —
                             * so Slate's wording is restored, and it is restored because it
                             * became true rather than because Slate says it. */
                            'Come back here — this page will show the message box.',
                        ].map((step) => html`<li class="ui-body"
                            >${t(step)}</li
                        >`)}
                    </ol>
                    <!-- THE ADDRESS IS A LINK, WHICH IS THE WHOLE POINT OF A PAGE CALLED
                         TALK TO DECENT. Slate prints it as caption grey inside a
                         paragraph, so on a touch screen it is a string of text nobody can
                         tap; the audit flagged that as a defect worth fixing on the way
                         across and the copy came over without the fix. This skin already
                         owns the pattern — the maintenance procedures render a real
                         anchor with the same class and the same rel. The FORUM stays
                         plain text until somebody confirms its URL: a link to a guessed
                         address is worse than a name. -->
                    <p class="ui-caption prose"
                        >${t('No account? You can still reach a human at')}
                        <a
                            id="account-support-email"
                            class="ui-body doc-link"
                            href="mailto:help@decentespresso.com"
                            rel="noopener noreferrer"
                        >help@decentespresso.com</a>
                        ${t('or on the Decent Diaspora forum.')}</p>
                </ui-empty-state>`}
        </section>`;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 15b. HELP > TALK TO DECENT — the message box, which the page promised
     * ═══════════════════════════════════════════════════════════════════════
     *
     * BEN TOOK THE RECOMMENDATION (27 August 2026): build it, in Slate's shape — a compose
     * box plus a thread list, gated on the account actually being linked.
     *
     * WHAT WAS THERE BEFORE. A signed-out reader was told "Come back here — this page will
     * show the message box"; a signed-in reader got one sentence saying an account was
     * linked and nothing to do with it. A promise in copy that the code does not keep is
     * the defect class this fork exists to remove, and it was the last loud one on this
     * leaf. (An earlier pass had softened the promise to "this page will say the account is
     * linked", which was the right move while the box did not exist and is the wrong one
     * now — see the step list above.)
     *
     * THE RECORDED BLOCKER WAS NOT REAL. `settings-leaves.js` said this leaf could only be
     * "a read-only account status — there is no sign-in route on the web API to build a
     * form against". True, and beside the point: nobody wants a sign-in form here. Sending
     * a message needs an ALREADY authenticated request, which is exactly what
     * `/api/v1/account/proxy/…` forwards. `decent-support-store.js` carries the whole
     * contract re-read at the pin, including the two things that shape this surface:
     *
     *   THE INJECTED SKIN TOKEN IS READ-ONLY, so every call is a GET with a query string
     *   and the route table needed an exception to allow one (`account-proxy-query-passthrough`).
     *
     *   AND THE PROXY'S CORS ALLOWLIST IS THE SKIN SERVER'S OWN ORIGINS, so none of this
     *   can be exercised from the dev harness or the capture battery — which is why every
     *   refusal below is a SENTENCE rather than a silence. Off a tablet the reader sees
     *   exactly why the box cannot send, instead of a form that does nothing.
     *
     * TWO METHODS, NOT ONE. The thread is a READING and the compose box is a CONTROL, and
     * they fail independently: a send can succeed while the re-read fails, and the thread
     * can be unreadable while sending works perfectly. One method would have to hold both
     * outcomes in one branch and would end up letting one overwrite the other.
     */

    /**
     * THE CONVERSATION SO FAR.
     *
     * WHY AN UNREADABLE THREAD IS NOT AN EMPTY ONE, and it is the only structural decision
     * on this surface. "You have no messages" and "your messages could not be loaded" are
     * different sentences: the first is a fact about the account, the second is a fault
     * worth telling somebody about. Slate collapses them — its `talkDecentRenderThread`
     * draws "No messages yet. Send one below to start!" whenever the local store is empty,
     * INCLUDING after a failed fetch, and puts the failure in a separate line above that a
     * reader has no reason to connect to it. Here the empty state is reached only from
     * `READY`, and every refusal prints its own reason instead.
     *
     * THE REASONS ARE FOUR SENTENCES, NOT ONE, because they are four different things to
     * do. A missing bearer means this page is not being served by ReaPrime and nothing the
     * reader can do will change it; a 401 means the account came unlinked; a 403 is a
     * refusal by the app (or, on a ReaPrime newer than the pin, a declined native consent
     * prompt); anything else is worth pressing Refresh for.
     *
     * REFRESH IS A REAL CONTROL AND NOT DECORATION. `refresh()` drops the store's in-flight
     * guard, so a press after a failure genuinely re-asks. Slate has the same button.
     *
     * NO POLLING. The thread is read when this leaf opens, on Refresh, and after a
     * successful send. A settings page quietly fetching a mailbox on a timer would be a
     * clock nobody asked for — and this one would reach a third-party host.
     */
    #supportThread() {
        const t = this.#i18n.t;
        const store = this.deps?.support ?? null;
        /* NO STORE, NO MESSAGE BOX, AND NO SENTENCE ABOUT ONE. A boot assembled by hand — a
         * fixture, a gallery page — has an account store and no support store, and this
         * page then falls back to exactly what it was before today: the linked paragraph
         * and nothing else. Rendering the thread's empty state instead would be this
         * surface claiming "you have no messages" on the strength of never having asked,
         * which is the manufactured answer A7 forbids. */
        if (!store) return nothing;
        const state = store?.get?.() ?? null;
        const messages = Array.isArray(state?.messages) ? state.messages : [];
        const loading = state?.status === SUPPORT_STATUS.LOADING;
        const unavailable = state?.status === SUPPORT_STATUS.UNAVAILABLE;

        return html`<section class="group" id="support-thread">
            <div class="fact-head">
                <h3 class="ui-heading">${t('Conversation')}</h3>
                <ui-button
                    id="support-refresh"
                    ?disabled=${loading}
                    @click=${() => { void this.deps?.support?.refresh?.(); }}
                >${t('Refresh')}</ui-button>
            </div>
            ${unavailable
                ? html`<p id="support-thread-error" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[state.reason] ?? SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.FAILED])}</p>`
                : nothing}
            ${loading && messages.length === 0
                ? html`<p id="support-thread-loading" class="ui-caption prose"
                    >${t('Loading messages…')}</p>`
                : nothing}
            ${!unavailable && !loading && messages.length === 0
                ? html`<p id="support-thread-empty" class="ui-caption prose"
                    >${t('No messages yet. Send one below to start.')}</p>`
                : nothing}
            ${messages.length
                ? html`<ol id="support-messages" class="thread">
                    ${messages.map((message) => this.#supportMessage(message))}
                </ol>`
                : nothing}
        </section>`;
    }

    /**
     * ONE MESSAGE.
     *
     * WHO WROTE IT IS THE ONLY THING ON THE RECORD THAT SAYS SO. `from_user` is non-empty
     * when Decent wrote it and absent when the account did; Slate uses the same
     * discriminator and there is no other flag. The store has already reduced it to
     * `from: string|null`, so this asks a boolean and never re-reads the wire shape.
     *
     * SLATE'S CHAT BUBBLES ARE NOT CARRIED AND THAT IS DELIBERATE. It draws left- and
     * right-aligned rounded bubbles with a cartoon avatar fetched from
     * `decentespresso.com/img/cartoon_<name>_small.png` — a per-message request to a
     * third-party host from a settings page, with an `onerror` fallback to a coloured
     * initial. This skin draws a list: the author's name, the time, and the text. The
     * alignment carried the same information the name does, twice; the avatar carried none
     * of it and cost a network round trip per message.
     *
     * AN ABSENT FIELD IS ABSENT (A7). No "(no subject)", no invented author, no fabricated
     * timestamp. A message with only a body renders only a body.
     *
     * THE TIME IS `shortDateTime`, THE SKIN'S ONE SPELLING. Slate calls
     * `toLocaleDateString` with its own option bag at this one call site; the History
     * screen and the Live band already share a formatter and this uses it, so a support
     * message and a shot are dated the same way in the same app.
     */
    #supportMessage(message) {
        const t = this.#i18n.t;
        /* THE SKIN'S OWN LANGUAGE, taken from the settings store exactly as the skin list's
         * date is — a module that reached for `navigator.language` would be a second answer
         * to a question the user has already been asked on this very screen. */
        const language = this.deps?.settings?.value?.('language') ?? this.deps?.defaultLanguage;
        const when = message.at === null ? null : shortDateTime(message.at * MS_PER_SECOND, language);
        return html`<li class="message" data-from=${message.from === null ? 'you' : 'decent'}>
            <span class="message-head">
                <span class="ui-heading">${message.from ?? t('You')}</span>
                ${message.auto
                    ? html`<ui-badge
                        >${t('Automatic')}</ui-badge
                    >`
                    : nothing}
                ${when === null
                    ? nothing
                    : html`<span class="ui-caption ui-numeric"
                        >${when}</span
                    >`}
            </span>
            ${message.subject === null
                ? nothing
                : html`<span class="ui-caption"
                    >${message.subject}</span
                >`}
            ${message.body === null
                ? nothing
                : html`<p class="ui-body message-body"
                    >${message.body}</p
                >`}
        </li>`;
    }

    /**
     * THE COMPOSE BOX.
     *
     * A SUBJECT AND A BODY, BECAUSE THE UPSTREAM TAKES BOTH. `support/api/email` is
     * addressed `?subject=…&body=…` — ReaPrime's own `emailSerialMismatch` builds exactly
     * that — so a single text box would have had to invent one of the two, and an
     * invented subject is what a human at the other end sees first.
     *
     * BOTH ARE REQUIRED AND THE REFUSAL IS ON PRESS, NOT A DISABLED BUTTON. That is the
     * settlement the feedback form on this same file already reached, for the reason
     * written there: a disabled primary reads as an empty slot rather than as a control
     * waiting for something, and a gate that cannot be pressed makes its own refusal
     * unreachable. Send stays live and says which field is missing. SENDING disables it,
     * which is a different gate — it stops a second submission of a request in flight.
     *
     * THE MACHINE DETAILS SWITCH IS SLATE'S, AND WHAT IT ATTACHES IS COMPUTED HERE RATHER
     * THAN IN THE STORE. Deciding what text to send is this surface's business; the store
     * sends the string it is given and has no opinion about prose (its header says so).
     *
     * AND THE SWITCH IS ONLY DRAWN WHEN THERE IS SOMETHING TO ATTACH. `#supportDetails`
     * answers null when neither the machine document nor the app document has landed, and
     * a switch that appends nothing is a control that changes nothing — the exact defect
     * this fork exists to remove, and one that would be invisible because the reader never
     * sees the body that gets sent. Both documents are asked for when this leaf opens.
     *
     * THE DRAFT SURVIVES A REFUSAL AND IS CLEARED ONLY ON SUCCESS, which is the plugin
     * settings form's rule on this same file and for the same reason: words the reader
     * typed must not vanish because a request failed.
     */
    #supportCompose() {
        const t = this.#i18n.t;
        const store = this.deps?.support ?? null;
        /* AS THE THREAD ABOVE: no store is no surface, not a disabled one. A compose box
         * whose Send can never fire is three controls that exist to be refused. */
        if (!store) return nothing;
        const state = store?.get?.() ?? null;
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        const send = state?.send ?? null;
        const sending = send?.status === SEND_STATUS.SENDING;
        const sent = send?.status === SEND_STATUS.SENT;
        const refusal = send?.status === SEND_STATUS.REFUSED ? send.reason : null;
        const details = this.#supportDetails();

        /* NO TOKEN IS A DIFFERENT PAGE, NOT A DISABLED FORM. Without the bearer nothing
         * here can ever send, on this load or any other, so a compose box would be three
         * controls that exist to be refused. The sentence names the cause precisely,
         * because the cause is specific and checkable: this page was not served by
         * ReaPrime's own skin server. */
        if (store.hasToken === false) {
            return html`<section class="group" id="support-compose">
                <h3 class="ui-heading">${t('Send a message')}</h3>
                <p id="support-no-token" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.NO_TOKEN])}</p>
            </section>`;
        }

        return html`<section class="group" id="support-compose">
            <h3 class="ui-heading">${t('Send a message')}</h3>
            <ui-text-field
                id="support-subject"
                label=${t('Subject')}
                placeholder=${t('What can we help you with?')}
                .value=${draft.subject}
                @change=${(event) => this.#onSupportField('subject', event.target?.value)}
                @input=${(event) => this.#onSupportField('subject', event.target?.value)}
            ></ui-text-field>
            <ui-notes-editor
                id="support-message"
                label=${t('Message')}
                placeholder=${t('Describe what is happening.')}
                .value=${draft.body}
                @notes-input=${(event) => this.#onSupportField('body', event.detail?.value)}
            ></ui-notes-editor>
            ${details === null
                ? nothing
                : html`<div class="form-row" data-control="switch">
                    <div class="sw-label">
                        <span class="ui-heading">${t('Attach machine details')}</span>
                        <!-- WHAT IS ACTUALLY APPENDED, NAMED. The feedback form on this
                             page learned the same lesson the hard way: the one sentence a
                             careful reader reads is the one saying what leaves the tablet,
                             so it has to be true of THIS build rather than copied. These
                             are the fields the machine and app documents actually carry,
                             and only the ones that have arrived are sent. -->
                        <span class="ui-caption">${t('Adds the model, firmware version, serial number and app version to the end of your message.')}</span>
                    </div>
                    <ui-switch
                        aria-label=${t('Attach machine details')}
                        ?checked=${draft.attachDetails}
                        @change=${(event) => this.#onSupportField('attachDetails', event.detail?.checked)}
                    ></ui-switch>
                </div>`}
            <ui-button
                id="support-send"
                variant="primary"
                ?disabled=${sending}
                @click=${this.#onSupportSend}
            >${t(sending ? 'Sending…' : 'Send message')}</ui-button>
            ${sent
                ? html`<p id="support-sent" class="ui-caption prose"
                    >${t('Message sent. Decent support will reply to the email address on your account.')}</p>`
                : nothing}
            ${refusal
                ? html`<p id="support-send-error" class="ui-caption prose"
                    >${t(SUPPORT_REFUSAL_COPY[refusal] ?? SUPPORT_REFUSAL_COPY[SUPPORT_REFUSAL.FAILED])}</p>`
                : nothing}
            ${this._supportIncomplete
                ? html`<p id="support-incomplete" class="ui-caption prose"
                    >${t('Fill in both the subject and the message before sending.')}</p>`
                : nothing}
        </section>`;
    }

    /**
     * THE MACHINE AND APP FACTS, or null when there are none.
     *
     * FOUR FIELDS, EACH OFF A DOCUMENT THIS PAGE ALREADY HAS AN OWNER FOR: `model`,
     * `version` and `serialNumber` from `machineInfo` (the same three the Machine leaf
     * prints), and the app's `version` from `appInfo`. Slate appends the same four.
     *
     * ONLY WHAT ARRIVED. A machine that has not answered contributes nothing rather than
     * a line reading "Model: undefined", and if NOTHING arrived this answers null and the
     * switch is not drawn at all — see `#supportCompose`.
     */
    #supportDetails() {
        const info = this.deps?.machineInfo?.get?.()?.info ?? null;
        const app = this.deps?.appInfo?.get?.()?.info ?? null;
        const lines = [
            ['Model', info?.model],
            ['Firmware', info?.version],
            ['Serial', info?.serialNumber],
            /* THE TABLE'S OWN SPELLING. `App Version` is already an authored string (i18n
             * lookup is case-insensitive, so a second `App version` entry is a build
             * failure by design — two keys for one word is how a table starts disagreeing
             * with itself). The three above it are the table's spellings too. */
            ['App Version', app?.version],
        ].filter(([, value]) => typeof value === 'string' && value !== '');
        return lines.length === 0 ? null : lines;
    }

    #onSupportField(key, value) {
        if (value === undefined) return;
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        this._support = { ...draft, [key]: value };
        /* A NEW EDIT CLEARS THE LAST ATTEMPT'S VERDICT. Without this, someone correcting a
         * refused message types under "Message sent." or under a refusal about the words
         * they have just replaced — a sentence about a request that no longer describes
         * what is on screen. The same rule the maintenance pages apply to a completed
         * procedure before a second run. */
        if (this._supportIncomplete) this._supportIncomplete = false;
        const status = this.deps?.support?.get?.()?.send?.status;
        if (status === SEND_STATUS.SENT || status === SEND_STATUS.REFUSED) {
            this.deps?.support?.clearSendState?.();
        }
    }

    /**
     * SEND, AND THE ONLY PLACE THE MESSAGE BODY IS COMPOSED.
     *
     * THE DETAIL BLOCK IS SLATE'S SHAPE, MINUS ITS MARKDOWN. Slate appends
     * `\n\n---\n**Machine Info**` and a bulleted list, which arrives at a support inbox as
     * literal asterisks unless whatever renders it happens to be a Markdown viewer. This
     * appends a rule and plain `Name: value` lines, which read correctly either way.
     *
     * THE DRAFT IS CLEARED ONLY ON A TRUE RETURN. `send()` answers false for a blank field,
     * a missing bearer, a transport failure and the upstream's own `0` alike, and every one
     * of those has to leave the words on screen.
     */
    #onSupportSend = async () => {
        const draft = this._support ?? EMPTY_SUPPORT_DRAFT;
        const subject = draft.subject.trim();
        const body = draft.body.trim();
        if (subject === '' || body === '') {
            this._supportIncomplete = true;
            return;
        }
        this._supportIncomplete = false;

        const details = draft.attachDetails ? this.#supportDetails() : null;
        const t = this.#i18n.t;
        const full = details === null
            ? body
            : [body, '', '---', t('Machine details'), ...details.map(([term, value]) => `${t(term)}: ${value}`)]
                .join('\n');

        const ok = await this.deps?.support?.send?.({ subject, body: full });
        if (ok) this._support = { ...EMPTY_SUPPORT_DRAFT, attachDetails: draft.attachDetails };
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 16. HELP > SEND FEEDBACK — the form
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE AVAILABILITY HALF WAS BUILT AND THE FORM WAS NOT — the registry said so:
     * "Availability is already readable (capabilities-store.readFeedbackAvailability);
     * the form is not."
     *
     * AND THE FORM IS STILL SHOWN BEFORE AVAILABILITY IS KNOWN, deliberately. There is no
     * GET on `/api/v1/feedback`; the 503 that means "this ReaPrime build carries no GitHub
     * token" arrives at SUBMIT time only. Probing would mean filing a real feedback item
     * to find out whether feedback works. So the form is offered, and a 503 is reported as
     * a property of the build rather than as a failure worth retrying.
     */
    #feedback() {
        const t = this.#i18n.t;
        const state = this.deps?.feedback?.get?.() ?? null;
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };

        if (state?.status === FEEDBACK_STATUS.SENT) {
            /* WHERE IT WENT, WHICH THE 201 HAS ALWAYS SAID AND THIS SCREEN COULD NOT ASK.
             * `FeedbackSubmissionResult` answers `{success, issueUrl, issueNumber}` and the
             * store threw the body away, so the only sentence available was "Thank you."
             * Both fields are optional on the wire — a build that files the issue and does
             * not say where is a real outcome — so the number and the link are drawn only
             * when they arrived, and their absence leaves the plain thank-you rather than
             * a fabricated issue number under a link that goes nowhere (A7). */
            const number = Number.isInteger(state.issueNumber) ? state.issueNumber : null;
            const url = typeof state.issueUrl === 'string' && state.issueUrl !== '' ? state.issueUrl : null;
            return html`<ui-empty-state
                id="feedback-sent"
                heading=${t('Feedback sent')}
                body=${number === null
                    ? t('Thank you. It was filed against the ReaPrime project.')
                    : t('Thank you. Filed as issue #{number} on the ReaPrime issue tracker.', { number })}
            >
                ${url === null
                    ? nothing
                    : html`<a
                        id="feedback-issue"
                        class="ui-body doc-link"
                        href=${url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >${t('View the issue')}</a>`}
                <ui-button slot="actions" @click=${this.#onFeedbackAgain}>${t('Send another')}</ui-button>
            </ui-empty-state>`;
        }

        const refusal = state?.status === FEEDBACK_STATUS.REFUSED ? state.reason : null;
        const sending = state?.status === FEEDBACK_STATUS.SENDING;

        return html`<section class="group" id="feedback">
                <h3 class="ui-heading">${t('Send feedback')}</h3>
            ${refusal === FEEDBACK_REFUSAL.NOT_CONFIGURED
                ? html`<p id="feedback-unconfigured" class="ui-caption prose"
                    >${t('This ReaPrime build cannot send feedback — it was compiled without a feedback token. Nothing you do here will change that.')}</p>`
                : nothing}
            <div class="sw-stack">
                <span class="ui-heading">${t('What is this about?')}</span>
                <ui-bank
                    id="feedback-type"
                    label=${t('Feedback type')}
                    .items=${FEEDBACK_TYPES.map((entry) => ({ value: entry.value, label: t(entry.label) }))}
                    .value=${draft.type}
                    @change=${(event) => this.#onFeedbackField('type', event.detail?.value)}
                ></ui-bank>
                <!-- SLATE PUTS A SENTENCE UNDER EACH CATEGORY and it is what tells a
                     reader which one their message is: with labels alone, "Question" and
                     "Other" are indistinguishable until you have written it. Slate draws
                     three tiles each carrying its own; this draws the SELECTED one's,
                     which says the same thing in the space a bank leaves. -->
                <span id="feedback-type-hint" class="ui-caption"
                    >${t(FEEDBACK_TYPES.find((entry) => entry.value === draft.type)?.hint ?? '')}</span>
            </div>
            <div class="sw-stack">
                <span class="ui-heading">${t('Description')}</span>
                <ui-notes-editor
                    id="feedback-description"
                    label=${t('Description')}
                    placeholder=${t('What happened, and what did you expect?')}
                    .value=${draft.description}
                    @notes-input=${(event) => this.#onFeedbackField('description', event.detail?.value)}
                ></ui-notes-editor>
                ${refusal === FEEDBACK_REFUSAL.EMPTY_DESCRIPTION
                    ? html`<span id="feedback-empty" class="ui-caption"
                        >${t('Write something first.')}</span
                    >`
                    : nothing}
            </div>
            <div class="form-row" data-control="switch">
                <div class="sw-label">
                    <span class="ui-heading">${t('Attach logs')}</span>
                    <span class="ui-caption">${t('Sends the app’s recent log with the report.')}</span>
                </div>
                <ui-switch
                    aria-label=${t('Attach logs')}
                    ?checked=${draft.includeLogs}
                    @change=${(event) => this.#onFeedbackField('includeLogs', event.detail?.checked)}
                ></ui-switch>
            </div>
            <div class="form-row" data-control="switch">
                <div class="sw-label">
                    <!-- SLATE'S HELPER, which names what is actually attached. Decal had
                         the switch and no sentence, so "system information" could have
                         meant anything. -->
                    <span class="ui-heading">${t('Attach system information')}</span>
                    <!-- WHAT IS ACTUALLY ATTACHED, WHICH IS NOT WHAT SLATE SAYS.
                         _collectSystemInfo writes the app version and build number, the
                         commit, the branch, the platform, the OS version and the Dart
                         version. There is NO MACHINE FIRMWARE in it anywhere. This is the
                         one sentence on the page a privacy-conscious reader actually
                         reads, so it is the one sentence that has to be true; Slate's was
                         not, and Decal inherited it unchecked. -->
                    <span class="ui-caption">${t('Appends the app version, build and platform to the report.')}</span>
                </div>
                <ui-switch
                    aria-label=${t('Attach system information')}
                    ?checked=${draft.includeSystemInfo}
                    @change=${(event) => this.#onFeedbackField('includeSystemInfo', event.detail?.checked)}
                ></ui-switch>
            </div>

            <!-- WHAT IS NOT HERE, AND WHY. Slate offers a Contact Email and a Title field
                 and neither reaches the machine: FeedbackRequest.fromJson, at
                 feedback_request.dart:62-73, reads description, type, includeLogs,
                 includeSystemInfo, screenshots and timestamp, and nothing else. Two boxes
                 whose contents are dropped on the way out is the finished-half defect with
                 a placeholder on it. NO BACKTICK IN THIS COMMENT. -->
            <p class="ui-caption prose"
                >${t('Screenshots are not sent — ReaPrime does not read them from this route.')}</p>
            <!-- WHERE IT GOES, AND WHY THERE IS NO REPLY BOX. _createGitHubIssue opens a
                 PUBLIC issue on decentespresso/decaid, so there is no channel back to this
                 tablet by construction — Slate manufactures one by XOR-obfuscating the
                 user's email into the issue body with a hard-coded key, which publishes
                 their address, lightly scrambled, in a place they cannot see. Not
                 collecting it is right; what was missing is the sentence saying so, and
                 the one honest reply route the app has. NO BACKTICK IN THIS COMMENT. -->
            <p id="feedback-destination" class="ui-caption prose"
                >${t('Feedback is filed as an issue on ReaPrime’s public issue tracker. Nobody replies here; for an answer, write to help@decentespresso.com.')}</p>
            ${refusal === FEEDBACK_REFUSAL.FAILED
                ? html`<span id="feedback-failed" class="ui-caption"
                    >${state.message ?? t('Sending failed.')}</span>`
                : nothing}
            <!-- SUBMIT, LEFT-ALIGNED, which is Slate's own place for it — AND PRESSABLE
                 WITH AN EMPTY DESCRIPTION, which it was not.
                 THE GATE MADE ITS OWN REFUSAL UNREACHABLE. A disabled primary is the navy
                 face at 38 percent opacity, which on a near-black card reads as an empty
                 slot rather than as a control that is waiting for something; and because
                 the press could never happen, the store's EMPTY_DESCRIPTION refusal — and
                 the sentence "Write something first." under the description box — had no
                 caller at all. A finished half with no other half, guarding a form.
                 SLATE KEEPS SUBMIT ENABLED AND REFUSES ON PRESS, and Ben's own ruling of
                 25 August for the committing screens is the same: a refused action stays
                 where it is and prints why. The refusal is free — feedback-store checks
                 the description before it builds a request, so nothing reaches the wire.
                 SENDING STILL DISABLES IT, because that gate stops a SECOND submission of
                 a request already in flight, which is a different thing entirely. -->
            <ui-button
                id="feedback-send"
                class="bindings-reset"
                variant="primary"
                ?disabled=${sending}
                @click=${this.#onFeedbackSend}
            >${t(sending ? 'Sending' : 'Submit')}</ui-button>
        </section>`;
    }

    #onFeedbackField(key, value) {
        if (value === undefined) return;
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };
        this._feedback = { ...draft, [key]: value };
    }

    #onFeedbackSend = () => {
        const draft = this._feedback ?? { type: 'bug', description: '', includeLogs: true, includeSystemInfo: true };
        void this.deps?.feedback?.submit(draft);
    };

    #onFeedbackAgain = () => {
        this._feedback = null;
        this.deps?.feedback?.reset();
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 17. ACCESSORIES > USB CHARGER — the status block and the two times
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE ROWS ARE ON #29 AND THESE TWO ARE NOT, and the split is mechanical rather than
     * a policy: charging mode, night mode and the low-battery dim are one control each and
     * are registry rows. A minute-of-day is a CLOCK FACE — `<ui-time-picker>`'s host is
     * "the dialog body's content box" — and #29 has one control slot per row.
     *
     * `nightModeSleepTime` AND `nightModeMorningTime` ARE MINUTES SINCE MIDNIGHT, and the
     * handler enforces `0..1439` on both (`settings_handler.dart`). The picker speaks
     * "HH:MM", so the conversion is here, twice, and nowhere else.
     *
     * THE STATUS BLOCK IS A READING AND MAY BE ABSENT. `chargingState` is added to the
     * settings document ONLY when a battery controller exists, so a tablet that does not
     * report a battery has no key at all — which is a state, not an error, and renders
     * nothing rather than a row of dashes.
     */
    #usbCharger() {
        const t = this.#i18n.t;
        const document_ = this.deps?.app?.document ?? null;
        const charging = document_?.chargingState ?? null;
        /* THE TIMES FOLLOW THE SWITCH *AND* BATTERY SAVER, which is the same condition the
         * Night mode row itself is gated on and for the same reason: ReaPrime's
         * `charging_logic.dart:123-129` returns early on `ChargingMode.disabled` with
         * `nightPhase: inactive` before it reads the night-mode config at all. With Battery
         * Saver off, a sleep time and a morning time change nothing on the machine, and
         * offering two clock faces that do nothing is the defect this fork exists to remove.
         * Slate gates its whole night-mode section on the same test (`settings.js:1643`).
         *
         * HIDDEN HERE, INERT ON THE ROW, and the difference is what each control IS: the
         * switch is a setting that still holds its value and greys out to say so, while
         * these are two buttons that open a dialog — a disabled dialog opener is a thing
         * that looks pressable and is not. */
        const savingBattery = document_?.chargingMode !== 'disabled';
        const nightOn = savingBattery && document_?.nightModeEnabled === true;

        return html`
            ${nightOn
                ? html`<section class="group" id="night-times">
                    <h3 class="ui-heading">${t('Night mode times')}</h3>
                    <div class="form-row" data-control="switch">
                        <span class="ui-heading">${t('Sleep')}</span>
                        <ui-button id="night-sleep" @click=${() => { this._nightEdit = 'sleep'; }}
                            >${this.#timeLabel(document_?.nightModeSleepTime)}</ui-button>
                    </div>
                    <div class="form-row" data-control="switch">
                        <span class="ui-heading">${t('Morning')}</span>
                        <ui-button id="night-morning" @click=${() => { this._nightEdit = 'morning'; }}
                            >${this.#timeLabel(document_?.nightModeMorningTime)}</ui-button>
                    </div>
                </section>`
                : nothing}

            <!-- THE STATUS BLOCK, AS SLATE DRAWS IT: a heading over three full-width
                 rows, in the leaf's own rhythm. It was three flex rows inside a bordered
                 card butted straight under the Dim toggle, so it read as part of that
                 setting rather than as a report about the tablet (Ben, 26 Aug 2026: "drop
                 the card and use Slate's layout for the status block").

                 A DEFINITION LIST, like Machine Info's: these are FACTS the machine
                 reports, not settings, and the value column shares one track so the three
                 end on one edge. -->
            ${charging
                ? html`<section class="group" id="charging-state">
                    <h3 class="ui-heading">${t('Charging status')}</h3>
                    <dl class="facts">
                        <div class="fact" data-term="battery">
                            <dt class="ui-body">${t('Battery')}</dt>
                            <dd class="ui-body ui-numeric">${Number.isFinite(charging.batteryPercent)
                                ? `${charging.batteryPercent}%`
                                : MACHINE_INFO_DASH}${charging.isEmergency ? ` · ${t('emergency')}` : ''}</dd>
                        </div>
                        <div class="fact" data-term="phase">
                            <dt class="ui-body">${t('Phase')}</dt>
                            <dd class="ui-body">${t(CHARGING_PHASES[charging.currentPhase]
                                ?? charging.currentPhase ?? MACHINE_INFO_DASH)}</dd>
                        </div>
                        <div class="fact" data-term="output">
                            <dt class="ui-body">${t('Charger output')}</dt>
                            <dd class="ui-body">${t(charging.usbChargerOn ? 'On' : 'Off')}</dd>
                        </div>
                    </dl>
                </section>`
                : nothing}

            ${this._nightEdit ? this.#nightDialog() : nothing}
        `;
    }

    #nightDialog() {
        const t = this.#i18n.t;
        const which = this._nightEdit;
        const document_ = this.deps?.app?.document ?? null;
        const minutes = which === 'sleep' ? document_?.nightModeSleepTime : document_?.nightModeMorningTime;

        return html`<ui-dialog
            id="night-dialog"
            heading=${t(which === 'sleep' ? 'Sleep time' : 'Morning time')}
            .open=${true}
            @open-change=${(event) => { if (event?.detail?.open === false) this._nightEdit = null; }}
        >
            <ui-time-picker
                slot="body"
                id="night-picker"
                label=${t(which === 'sleep' ? 'Sleep time' : 'Morning time')}
                value=${minutesToTime(minutes)}
                clock-format=${this.#clockFormat}
                auto-advance
                @change=${this.#onNightTime}
            ></ui-time-picker>
            <ui-button slot="actions" variant="primary" @click=${() => { this._nightEdit = null; }}
                >${t('Done')}</ui-button>
        </ui-dialog>`;
    }

    /**
     * WRITTEN ON EVERY CHANGE, not on Done, and Done only shuts the dialog.
     *
     * The picker commits a whole time on each choice, and both fields are single app
     * preferences that ReaPrime accepts one at a time. Staging them would be a second
     * commit model beside the one #29 already has for machine fields.
     */
    #onNightTime = (event) => {
        const value = event?.detail?.value;
        const minutes = timeToMinutes(value);
        if (minutes === null || !this._nightEdit) return;
        const field = this._nightEdit === 'sleep' ? 'nightModeSleepTime' : 'nightModeMorningTime';
        /* THE STORE RE-READS ITSELF ON A SUCCESSFUL WRITE, so there is nothing to
         * refresh here and no second copy to keep in step. */
        Promise.resolve(this.deps?.app?.write?.({ [field]: minutes })).catch(() => {});
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 17a. THE DEVICE LIST — both connection pages, one surface
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Ben, 26 August 2026: "Take more of Slate. End with a list of previously connected
     * devices, and put the Search button above the dividing line on the right", "drop the
     * card around each device", "controls sit in a grid, aligned vertically with those in
     * the list — keep each row clean, the Preferred label currently pushes its toggle
     * down." And for the Scale page: "same setup."
     *
     * WHAT WAS THERE BEFORE. The Machine page had ONE text field (the ReaPrime address)
     * and said nothing at all about whether the machine was connected — no dot, no word,
     * no badge, on the page whose whole subject is the connection. The Scale page had a
     * scan result but no remembered list and no way to reconnect or forget.
     *
     * REMEMBERED IS THE THIRD STATE AND IT IS THE USEFUL ONE. `available: false` is a
     * device ReaPrime knows about and cannot see right now (`rea-devices.js` says so at
     * `readDevice`), which is exactly what "previously connected" means. It is what lets
     * this page offer a machine that is asleep.
     *
     * THE ACTIONS FOLLOW THE STATE, and each one is offered only where it means something:
     * a connected device can be disconnected, anything else can be connected, and only a
     * device that is NOT connected can be forgotten — Slate makes the same choice, and the
     * reason is that forgetting a live pairing is a two-step action wearing one button.
     *
     * NO LABEL ABOVE THE TOGGLE, which is Ben's "keep each row clean". The switch carries
     * its name for a screen reader and the column is one grid track, so every row's
     * controls land on the same two edges instead of each row sizing its own.
     */
    #deviceList(type) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;
        const known = (state?.known ?? []).filter((device) => device.type === type);
        const preferredId = type === DEVICE_TYPE.MACHINE
            ? (state?.preferred?.machine ?? null)
            : (state?.preferred?.scale ?? null);
        const heading = type === DEVICE_TYPE.MACHINE ? 'Machines' : 'Scales';

        /* THREE STATES, AND THE FAILED READ WAS BEING DRAWN AS THE UNREAD ONE.
         *
         * `loadDevices` publishes `{error: result}` on a failure and leaves `known` at
         * null, and this line used to return `nothing` for both — so a machine that
         * refused the read took the WHOLE section with it, heading and empty state and
         * all. On the Machine page that put the page back exactly where the audit found
         * it: an address field and nothing else, with no indication anything had gone
         * wrong. The skin already holds the right rule for the other direction —
         * `settings-screen.js` prints a refusal because "a write the machine turned down
         * would otherwise carry a person away from the page with... nothing said" — and a
         * READ the machine turned down, on the page whose whole subject is that machine,
         * earns the same treatment.
         *
         *   unread          nothing yet. Not an emptiness, and not drawn as one.
         *   read and empty  the empty state, which is a real answer.
         *   read and failed the heading, and a sentence saying the asking failed.
         */
        const failed = state?.known === null && state?.error;
        if (state?.known === null && !failed) return nothing;

        const refusal = state?.writeError && DEVICE_REFUSAL[state.writeError.op]
            ? state.writeError
            : null;

        return html`
            <section class="group" id="devices">
                <h3 class="ui-heading">${t(heading)}</h3>
                ${failed
                    ? html`<p id="devices-error" class="ui-caption prose" role="status"
                        >${t('This machine could not be asked what it remembers.')}</p>`
                    : html`
                        <!-- THE SENTENCE THE REBUILD DELETED, AND IT WAS THE ONLY PLACE
                             THE SKIN SAID THIS. "Looks for scales over Bluetooth. Nothing
                             is connected automatically." lived in the bordered scan card
                             that Ben's no-cards pass removed, and it went with the card —
                             a real fact lost, not a nicety. Decal's scan sends
                             connect=false on purpose (scale-connect-store.js carries the
                             handler citation) and Slate's does NOT, so Slate's Search
                             connects to whatever it finds and Decal's does not. An
                             undocumented right choice reads as a broken button. It is on
                             BOTH pages now; the Machine page never had it.
                             NO BACKTICK IN THIS COMMENT: one would end the template. -->
                        <p class="ui-caption prose" id="devices-search-note"
                            >${t('Search looks for devices nearby. Nothing is connected automatically.')}</p>
                        ${known.length === 0
                            ? html`<ui-empty-state
                                id="devices-empty"
                                heading=${t('Nothing remembered yet')}
                                body=${t('Press Search to look for one. A device stays on this list once it has been connected.')}
                            ></ui-empty-state>`
                            : html`<div class="devices">
                                <!-- THE WORD, ONCE, OVER THE TRACK IT NAMES. The preferred
                                     switch carried an aria-label and no visible name at
                                     all, and a column of unlabelled switches on a
                                     connection page is unreadable — "preferred" is not a
                                     guessable meaning. Ben's instruction was about
                                     PLACEMENT, not about the word: "controls sit in a
                                     grid, aligned vertically with those in the list — keep
                                     each row clean, the Preferred label currently pushes
                                     its toggle down." A header row satisfies both halves,
                                     because the grid is already four shared tracks and no
                                     row grows a second line. -->
                                <div class="device-head" aria-hidden="true">
                                    <span></span>
                                    <span></span>
                                    <span class="ui-microcap">${t('Preferred')}</span>
                                    <span></span>
                                </div>
                                ${known.map((device) => this.#deviceRow(device, type, preferredId))}
                            </div>`}
                        ${refusal
                            ? html`<p id="devices-refusal" class="ui-caption prose" role="status"
                                >${t(DEVICE_REFUSAL[refusal.op])}${refusal.reason ? ` ${refusal.reason}` : ''}</p>`
                            : nothing}`}
            </section>`;
    }

    /** One device: what it is, what it is doing, and the three things you can do to it. */
    #deviceRow(device, type, preferredId) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const connected = device.state === DEVICE_STATE.CONNECTED;
        /* THE WORD IS THE MACHINE'S OWN STATE, TRANSLATED INTO ENGLISH. `available: false`
         * is the remembered case and outranks the state, because a remembered device's
         * stored state is whatever it was when it went away.
         *
         * IT WAS THE WIRE TOKEN ITSELF, and the chip's upper-casing hid that for three of
         * the five values. See `DEVICE_WORD` for what 'discovered' printed and why a
         * variable key could never have been translated. An unmapped state is 'Unknown'
         * rather than the token — a name this build's enum does not carry is a state we
         * have no word for, and printing the server's spelling would be inventing one. */
        const word = device.available === false
            ? 'Unavailable'
            : (DEVICE_WORD[device.state] ?? 'Unknown');

        return html`<div class="device" data-device=${device.id} ?data-connected=${connected}>
            <span class="device-name">
                <span class="ui-heading">${device.name ?? device.id}</span>
                <span class="ui-caption">${device.id}</span>
            </span>
            <!-- THE WORD IS THE STATE. #33 carries one flag, the live one, and this is
                 not that: a connected device is not a shot in progress, and borrowing the
                 pulsing dot to mean "connected" would give one treatment two meanings.
                 What separates the states here is the WORD, which is the machine's own.
                 NO BACKTICK IN THIS COMMENT: one would end the html template. -->
            <ui-status-chip class="device-state">${t(word)}</ui-status-chip>
            <ui-switch
                class="device-preferred"
                aria-label=${t('Preferred device')}
                ?checked=${device.id === preferredId}
                @change=${(event) => {
                    const on = event?.detail?.checked === true;
                    void store?.setPreferred(type, on ? device.id : null);
                }}
            ></ui-switch>
            <span class="device-actions">
                ${connected
                    ? html`<ui-button
                        class="device-disconnect"
                        @click=${() => { void store?.disconnectDevice(device.id); }}
                    >${t('Disconnect')}</ui-button>`
                    /* RECONNECT ON A REMEMBERED DEVICE IS A SCAN FIRST, and the direct
                     * route it used to call could not succeed for exactly these rows:
                     * `PUT /devices/connect` looks the id up in the LIVE device list, and
                     * a remembered entry is by construction not in it, so the call
                     * answered 404 every time. `reconnectDevice` scans, re-reads and only
                     * then connects to the named device — see its own note in the store,
                     * which carries the handler citations. An `available` row keeps the
                     * direct connect, which does work and is one round trip. */
                    : html`<ui-button
                        class="device-connect"
                        @click=${() => {
                            void (device.available === false
                                ? store?.reconnectDevice(device.id)
                                : store?.connectDevice(device.id));
                        }}
                    >${t('Reconnect')}</ui-button>`}
                ${connected
                    ? nothing
                    : html`<ui-button
                        class="device-forget"
                        variant="danger"
                        @click=${() => { void store?.forgetDevice(device.id); }}
                    >${t('Forget')}</ui-button>`}
            </span>
        </div>`;
    }

    /**
     * What the last SEARCH turned up, which is a different list from what is remembered.
     *
     * Merging the two would lose the distinction a person acts on: a remembered device is
     * one to reconnect to, a found one is one you have just met. A device that is already
     * on the remembered list is left out here rather than drawn twice.
     */
    #foundList(type) {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;
        const scanning = state?.status === SCAN_STATUS.SCANNING;
        if (state?.devices === null && !scanning) return nothing;
        const remembered = new Set((state?.known ?? []).map((device) => device.id));
        const found = (state?.devices ?? [])
            .filter((device) => device.type === type && !remembered.has(device.id));

        return html`
            <section class="group" id="found">
                <h3 class="ui-heading">${t('Found by searching')}</h3>
                ${scanning
                    ? html`<p id="found-scanning" class="ui-caption prose"
                        >${t('Searching…')}</p>`
                    : found.length === 0
                        ? html`<p id="found-empty" class="ui-caption prose"
                            >${t('Nothing new. Switch the device on and put it near the machine, then search again.')}</p>`
                        : html`<div class="devices">
                            ${found.map((device) => html`<div class="device" data-found=${device.id}>
                                <span class="device-name">
                                    <span class="ui-heading">${device.name ?? device.id}</span>
                                    <span class="ui-caption">${device.id}</span>
                                </span>
                                <span></span>
                                <span></span>
                                <span class="device-actions">
                                    <ui-button
                                        class="device-connect"
                                        variant="primary"
                                        @click=${() => { void store?.connectDevice(device.id); }}
                                    >${t('Connect')}</ui-button>
                                </span>
                            </div>`)}
                        </div>`}
            </section>`;
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 18. CONNECTION > SCALE — the scan and the manual WiFi endpoints
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE LEAF'S OWN READING ROW NAMED THE OWNER AND THE OWNER NEVER ARRIVED: pairing and
     * forgetting "belong to whoever builds the connection surface". This is that surface,
     * scoped to what a scale page can honestly do — find scales, and add one by address.
     *
     * THE SCAN SENDS `connect=false` AND NEVER `quick=true`, and both are traps rather
     * than preferences. An absent `connect` means the handler CONNECTS to what it finds;
     * `quick=true` returns an empty array immediately, which reads as "nothing found".
     * `scale-connect-store.js` carries the handler citation.
     *
     * CONNECTING IS THE DEVICES LINK'S, NOT THIS STORE'S. `createDevicesLink` already owns
     * `PUT /devices/connect` and the ambiguity handling that goes with it; a second caller
     * here would be a second answer to "what does connecting mean".
     */
    /**
     * CONNECTION > MACHINE — the remembered list AND what a search turned up.
     *
     * THE PAGE RENDERED THE REMEMBERED LIST ALONE, so pressing Search on it had no
     * observable effect of any kind: no "Searching…", no results, no "nothing found",
     * while the store reached status 'done' with results in it. Measured live at
     * 1281x801 — `#found` absent, the device rows unchanged. That is the audit's original
     * complaint about this page (no path from nothing-connected to connected) surviving in
     * a new shape, for machines only.
     *
     * `#foundList` has taken the device type as a parameter since it was written and the
     * Scale page has always called it, so this was a one-line omission rather than a
     * missing feature. It is a named method rather than two calls inline because that is
     * what the Scale page is, and because the bespoke registry's own law is one leaf, one
     * section, one method.
     */
    #machineConnection() {
        return html`
            ${this.#deviceList(DEVICE_TYPE.MACHINE)}
            ${this.#foundList(DEVICE_TYPE.MACHINE)}
        `;
    }

    #scaleConnection() {
        const t = this.#i18n.t;
        const store = this.deps?.scaleConnect;
        const state = store?.get?.() ?? null;

        return html`
            ${this.#deviceList(DEVICE_TYPE.SCALE)}
            ${this.#foundList(DEVICE_TYPE.SCALE)}

            <section class="group" id="wifi">
                <h3 class="ui-heading">${t('WiFi scales')}</h3>
                <p class="ui-caption prose">${t('A WiFi scale is reached by address rather than found by scanning.')}</p>
                <!-- A FAILED READ IS SAID, NOT DRAWN AS AN EMPTY LIST. loadEndpoints
                     publishes an error and leaves the endpoint list null, and an empty map
                     over null renders nothing — which is indistinguishable from a tablet that
                     has no WiFi scales, and which would invite a person to re-add an
                     address the machine already holds. Same rule as the devices section
                     above it. NO BACKTICK IN THIS COMMENT. -->
                ${state?.endpoints === null && state?.error
                    ? html`<p id="wifi-error" class="ui-caption prose" role="status"
                        >${t('This machine could not be asked which addresses it holds.')}</p>`
                    : nothing}
                ${(state?.endpoints ?? []).map((host) => html`<ui-list-row class="endpoint" data-host=${host}>
                    <span class="ui-heading">${host}</span>
                    <ui-button
                        slot="favourite"
                        variant="ghost"
                        @click=${() => { void store?.removeEndpoint(host); }}
                    >${t('Remove')}</ui-button>
                </ui-list-row>`)}
                <div class="sw-row">
                    <ui-text-field
                        id="wifi-host"
                        label=${t('Scale address')}
                        hide-label
                        placeholder="192.168.1.50"
                        .value=${this._wifiHost ?? ''}
                        @change=${(event) => { this._wifiHost = event.target?.value ?? ''; }}
                        @input=${(event) => { this._wifiHost = event.target?.value ?? ''; }}
                    ></ui-text-field>
                    <ui-button
                        id="wifi-add"
                        variant="primary"
                        ?disabled=${!(this._wifiHost ?? '').trim()}
                        @click=${this.#onWifiAdd}
                    >${t('Add')}</ui-button>
                </div>
                <!-- THE ENDPOINT OPERATIONS ONLY, NOW. This sentence was the single
                     reader of a writeError slot five operations wrote, so a refused
                     Forget printed "That address was refused." here — on the Scale page,
                     under the WiFi form, about a device that has no address. The store
                     carries the operation; the device refusals are said in the devices
                     section where the button was pressed.
                     NO BACKTICK IN THIS COMMENT: one would end the template. -->
                ${state?.writeError?.op === 'endpoint'
                    ? html`<span id="wifi-refusal" class="ui-caption" role="status"
                        >${t('That address was refused.')}${state.writeError.reason
                            ? ` ${state.writeError.reason}`
                            : ''}</span
                    >`
                    : nothing}
            </section>
        `;
    }

    #onWifiAdd = async () => {
        const host = (this._wifiHost ?? '').trim();
        if (!host) return;
        const ok = await this.deps?.scaleConnect?.addEndpoint(host);
        if (ok) this._wifiHost = '';
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 19. HELP > KEYBOARD SHORTCUTS — the binding table, and rebinding
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THE REGISTRY DECLARED BOTH HALVES AS PENDING AND ITS REASON WAS ACCURATE AT THE
     * TIME: "NOBODY YET — no route, no store and no key map on either side … Decal can
     * therefore SHOW a binding and not change one."
     *
     * BUILDING THE EDITOR ALONE WOULD HAVE BEEN THE WORSE BUG. `live-wiring.js` called
     * `stateForKey(event.key)` with no map, so it read the shipped defaults; a settings
     * page that rebound Espresso to X would have shown X while the machine kept answering
     * E. `key-bindings.js` is the map both ends share, and the Live screen now reads the
     * stored overrides through it.
     *
     * NO ROUTE IS NEEDED AND NONE WAS ADDED. `keyboardBindings` is a routed SKIN key —
     * `storage-routes.js` puts it in local/device storage because "bindings belong to
     * whatever keyboard is attached to this device", which is still the right layer.
     *
     * CAPTURE, NOT TYPING. A key is chosen by pressing it, so the field listens for a
     * keydown and stores the normalised key. Escape leaves the capture and is therefore
     * the one key that cannot be bound — stated in `normaliseKey`, not here.
     *
     * A CONFLICT IS A SENTENCE, NOT A SILENT SWAP. One key may hold one action; the
     * editor asks `conflictFor` BEFORE it writes and names the action already holding it.
     */
    #keyboard() {
        const t = this.#i18n.t;
        const stored = this.deps?.settings?.value?.('keyboardBindings') ?? null;
        const byAction = bindingsByAction(stored);
        const capturing = this._captureAction;

        return html`<section class="group" id="bindings">
            <h3 class="ui-heading">${t('Keyboard shortcuts')}</h3>
            <!-- SLATE'S SENTENCE, WHICH IS THE ONE A READER NEEDS FIRST: how to change a
                 binding. Decal said only WHERE the keys work, which is worth saying and
                 is not an instruction. Both are here, in that order. -->
            <p class="ui-caption prose"
                >${t('Tap Rebind, then press a key on a connected USB or Bluetooth keyboard. These keys work on the Live screen, and only on a machine with no group-head controller.')}</p>

            <!-- ONE GRID, so every keycap and every Rebind button lands on the same edge
                 however long an action's name is. They were two nested flex rows, which
                 sized themselves per row. -->
            <div class="bindings">
                ${BINDABLE_ACTIONS.map((action) => html`<div class="binding" data-action=${action.id}>
                    <span class="ui-heading">${t(action.label)}</span>
                    ${byAction[action.id]
                        ? html`<ui-keycap>${keyLabel(byAction[action.id])}</ui-keycap>`
                        : html`<span class="ui-caption"
                            >${t('Not bound')}</span
                        >`}
                    <ui-button
                        class="rebind"
                        variant=${capturing === action.id ? 'primary' : 'default'}
                        @click=${() => this.#onRebindStart(action.id)}
                    >${t(capturing === action.id ? 'Press a key' : 'Rebind')}</ui-button>
                </div>`)}
            </div>

            ${this._bindingConflict
                ? html`<span id="binding-conflict" class="ui-caption"
                    >${t('That key already runs')} ${t(this._bindingConflict)}.</span>`
                : nothing}
            <!-- SINGULAR AND LEFT-ALIGNED, which is Slate's own (Ben: "mostly Slate's
                 version, tidied"). It restores ONE map, not a set of them. -->
            <ui-button
                id="bindings-reset"
                class="bindings-reset"
                @click=${this.#onBindingsReset}
            >${t('Reset to default')}</ui-button>
        </section>`;
    }

    /**
     * Start capturing. ONE LISTENER AT A TIME, on the document, removed the moment a key
     * lands or the capture is cancelled — a screen that left one behind would rebind on
     * the next keystroke anywhere in the app.
     */
    #onRebindStart(actionId) {
        this.#stopCapture();
        if (this._captureAction === actionId) { this._captureAction = null; return; }
        this._captureAction = actionId;
        this._bindingConflict = null;
        const doc = this.ownerDocument ?? null;
        if (!doc) return;
        this.#captureOn = doc;
        doc.addEventListener('keydown', this.#onCaptureKey, true);
    }

    #captureOn = null;

    #stopCapture() {
        if (!this.#captureOn) return;
        this.#captureOn.removeEventListener('keydown', this.#onCaptureKey, true);
        this.#captureOn = null;
    }

    #onCaptureKey = (event) => {
        const actionId = this._captureAction;
        if (!actionId) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') { this.#stopCapture(); this._captureAction = null; return; }
        const key = normaliseKey(event.key);
        if (key === null) return;

        const stored = this.deps?.settings?.value?.('keyboardBindings') ?? null;
        const clash = conflictFor(key, actionId, stored);
        if (clash) { this._bindingConflict = clash.label; return; }

        this.#stopCapture();
        this._captureAction = null;
        this._bindingConflict = null;
        Promise.resolve(this.deps?.settings?.set?.('keyboardBindings', withBinding(stored, actionId, key)))
            .catch(() => {});
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 22. DISPLAY > SCREEN SAVER — the pictures
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THREE ROWS ARE REGISTRY ROWS AND THIS IS THE FOURTH THING: enable, type and cycle
     * are ordinary settings rows above; what needs a layout is the SET OF PICTURES —
     * thumbnails, a file pick, a folder pick and a way to go back to the bundled one.
     *
     * IT REVERSES D10, ON BEN'S RULING (26 August 2026). D10 said the saver is fully
     * black and `storage-routes.js` retired the image list on it; Ben restored the Image
     * type and asked for "Slate's image setup including its bundled default ... or a
     * folder on the disk". The reversal is recorded at every row it touches rather than
     * only here.
     *
     * WHAT A FOLDER PICK ACTUALLY IS, stated because it is easy to expect otherwise: a
     * browser cannot hold a folder PATH and watch it. `webkitdirectory` hands back the
     * files that were in the folder at pick time, and nothing follows it afterwards. So a
     * folder whose contents change later does not change the saver, and the remedy is to
     * pick it again. The caption says so on the page.
     *
     * THE PICTURES ARE DATA URLs IN DEVICE STORAGE, which is Slate's shape and the only
     * one available: a File object does not survive a reload, and the path it came from
     * is not readable. That is also why the count is capped — see `#onSaverPick`.
     */
    #screenSaver() {
        const t = this.#i18n.t;
        const settings = this.deps?.settings;
        const images = settings?.value?.('screensaverImages');
        const list = Array.isArray(images) ? images : [];
        const type = settings?.value?.('screensaverType');
        /* THE SECTION FOLLOWS THE TYPE, exactly as the cycle row above it does (Ben: "if
         * black or clock is selected the section below greys out"). Drawn and dimmed
         * rather than removed: the pictures are still chosen, and a section that vanished
         * would read as though switching to Clock had discarded them. */
        const inert = type !== 'image';

        return html`
            <section class="group" id="saver-images" ?data-inert=${inert}>
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Images')}</h3>
                    <div class="sw-row">
                        <ui-file-button
                            id="saver-pick-files"
                            multiple
                            accept="image/*"
                            ?disabled=${inert}
                            @file-pick=${this.#onSaverPick}
                        >${t('Choose images')}</ui-file-button>
                        <ui-file-button
                            id="saver-pick-folder"
                            directory
                            accept="image/*"
                            ?disabled=${inert}
                            @file-pick=${this.#onSaverPick}
                        >${t('Choose a folder')}</ui-file-button>
                        ${list.length > 0
                            ? html`<ui-button
                                id="saver-clear"
                                variant="danger"
                                ?disabled=${inert}
                                @click=${this.#onSaverClear}
                            >${t('Use the built-in image')}</ui-button>`
                            : nothing}
                    </div>
                </div>
                ${list.length > 0
                    ? html`<p id="saver-count" class="ui-caption prose"
                        >${t('{n} images chosen. A folder is read when you pick it — add it again if its contents change.', { n: list.length })}</p>`
                    : html`<p id="saver-default-note" class="ui-caption prose"
                        >${t('Using the built-in image. Choose your own to replace it.')}</p>`}
                <div class="thumbs">
                    ${(list.length > 0 ? list : [SCREENSAVER_DEFAULT_IMAGE]).map((src, index) => html`<img
                        class="thumb"
                        data-thumb=${index}
                        src=${src}
                        alt=""
                    >`)}
                </div>
            </section>
        `;
    }

    /**
     * Read the picked files and store them.
     *
     * CAPPED, AND THE CAP IS THE STORAGE. These become data URLs in device storage, and a
     * folder of camera pictures is tens of megabytes — enough to fail the write silently
     * on a quota nobody sees. Twelve is generous for a screen saver and small enough to
     * survive; anything past it is dropped and the count on the page says how many landed.
     *
     * NON-IMAGES ARE DROPPED rather than refused: a folder pick takes everything in the
     * folder, so a stray text file is the normal case and not a mistake to report.
     */
    #onSaverPick = async (event) => {
        const picked = (event?.detail?.files ?? [])
            .filter((file) => typeof file?.type === 'string' && file.type.startsWith('image/'))
            .slice(0, SAVER_IMAGE_LIMIT);
        if (picked.length === 0) return;
        const urls = [];
        for (const file of picked) {
            const url = await readAsDataUrl(file);
            if (url) urls.push(url);
        }
        if (urls.length === 0) return;
        await this.deps?.settings?.set('screensaverImages', urls);
    };

    /** Back to the bundled picture: the stored list goes, and the default shows again. */
    #onSaverClear = async () => {
        await this.deps?.settings?.set('screensaverImages', []);
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 20. ACCESSORIES > CUP WARMER — REMOVED, and that is the finished shape
     * ═══════════════════════════════════════════════════════════════════════
     *
     * This section drew four controls by hand: the enable switch, the live mat
     * temperature, the pre-warm switch and its lead-time stepper. It existed for one
     * reason — the values live on `/machine/cupWarmer` and `/machine/cupWarmer/preheat`,
     * two routes the leaf MODEL could not reach, so the only way to draw them was here.
     *
     * Ben, 26 August 2026, asked for Slate's order on this page, for the live readout to
     * go, and for the pre-warm to stop being capability-gated. Slate's order is four
     * ordinary settings rows — and a row is what the registry draws. So the fix was a
     * DOOR (`cupWarmerDoorFor`, machine-fields-port.js), not a re-layout: the four rows
     * are in `SETTINGS_ROWS` now, in Ben's order, drawn by the same renderer as every
     * other page.
     *
     * WHAT WAS LOST AND WHY IT IS NOT MISSED. The two pre-warm WARNINGS ("the warmer is
     * switched off, so the pre-warm does nothing" / "there is no enabled wake schedule")
     * went with this section. Both said the same thing the page now SHOWS: with the
     * warmer off, the target row is inert and dashed, which is the warning drawn rather
     * than written. The schedule warning belongs to the Sleep and Wake page, where the
     * schedule is, and is the one thing worth restoring if Ben asks — it is not restored
     * here on a guess.
     *
     * The store keeps its callers: the door reads and writes through it, so
     * `cup-warmer.js` is no more orphaned than it was.
     * ═══════════════════════════════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════════════════════════════
     * 21. CALIBRATION > DEFAULT LOAD SETTINGS — the reset, and what it moves
     * ═══════════════════════════════════════════════════════════════════════
     *
     * THIS LEAF SHIPPED EMPTY BY A SCREEN LAW — F3/Q1, "no work of any kind on
     * reset-to-default" — and the law was written when the values a reset moves were
     * mostly invisible in this skin.
     *
     * IT IS NOT A FACTORY RESET, and reading the handler is what settles it.
     * `De1Controller.applySettingsDefaults` (de1_controller.defaults.dart:110-122) writes
     * EIGHT values: the fan threshold, the four heater-up numbers, the refill kit mode,
     * the flow estimate and the steam purge mode. No profile, no calibration latch,
     * nothing a person cannot set again from the pages beside this one. (It said SEVEN
     * while enumerating eight and while `RESET_FIELDS` held eight — a summary that counted
     * the two heater-up flows as one line. The handler makes two calls and the page lists
     * two rows.)
     *
     * SO THE CONFIRMATION LISTS THEM RATHER THAN WARNING VAGUELY. Slate prints the same
     * list in its caption ("Restores fan threshold, heater idle temp, heater phase flows,
     * phase 2 timeout, refill kit mode, flow multiplier, and steam purge to factory
     * defaults"), and a confirmation that names what moves is the difference between a
     * decision and a flinch.
     *
     * THE VALUES ARE REPEATED HERE, IN THE DEFAULT COLUMN, and the sentence that used to
     * stand in this place said the opposite: "the values are not repeated here; what each
     * one becomes is the machine's business and would be a second copy of a table this skin
     * does not own." Ben overruled it on 26 August 2026 — "add two columns, the current
     * value and the default it will become" — and the table has printed both since. The
     * risk the old sentence named is real and is written down at `RESET_FIELDS` instead of
     * being avoided: if ReaPrime changes a default, that table is what needs the edit.
     */
    #defaults() {
        const t = this.#i18n.t;
        const client = this.deps?.de1Settings ?? null;
        const read = this.deps?.machineValue ?? (() => undefined);
        /* THE PAGE COLUMN, RESOLVED AGAINST THIS MACHINE, and the two things it feeds.
         *
         * A ROUTE WITH NO CLIENT WAS THE DEFECT. `leafFor()` searches the whole tree and
         * does not filter by machine class — the filter is `leavesFor` / `leafShownOn`,
         * which the nav uses and this did not — so on a Bengle the `flowMultiplier` row
         * printed "Flow Multiplier", a leaf gated `machines: ['de1']` at the time and
         * therefore absent from that machine's nav. A reset page that tells you to go and
         * look at a page you cannot open is the same class of half as a stored key nothing
         * reads. (THAT GATE HAS SINCE MOVED ONTO THE ROW and the leaf is shown everywhere;
         * the block above `resets` carries the move and why both gates are asked now. The
         * defect and the answer are unchanged — only which node holds the `machines` list.)
         *
         * A HIDDEN PAGE PRINTS THE DASH RATHER THAN A NAME, which is A7 applied to a name:
         * the SETTING still moves on a Bengle — `applySettingsDefaults` writes all eight
         * whatever the machine is — so the row must stay in the table and only its
         * whereabouts is unknown. Dropping the row would understate what the button does.
         *
         * AND THE CONFIRM DIALOG IS BUILT FROM THE SAME LIST. Its detail used to be a
         * hard-coded sentence naming the same five pages, Flow Multiplier among them, so
         * the dangling reference existed twice and only one of the two could be fixed by
         * filtering the table. One derivation, two readers. */
        const machineClass = typeof this.deps?.machineClass === 'function'
            ? this.deps.machineClass()
            : null;
        /* THE PAGE MUST HAVE THE ROW ON IT, NOT MERELY EXIST (27 August 2026).
         *
         * THE GATE MOVED DOWN A LEVEL AND THIS READER DID NOT FOLLOW IT. Until this pass
         * the whole `calibration-flow-multiplier` LEAF carried `machines: ['de1']`, so
         * asking `leafShownOn` was the same question as asking whether the setting was
         * reachable. Then the page turned out to be two DE1-only rows and one that belongs
         * on every machine (`calibration-flow-multiplier-weight`), so the gate was split:
         * the leaf is now shown everywhere and `calibration-flow-multiplier-factor` — the
         * row this table's `flowMultiplier` line is actually about — carries the
         * `machines: ['de1']` itself.
         *
         * ASKING ONLY THE LEAF THEREFORE STARTED ANSWERING THE WRONG QUESTION. On a Bengle
         * the Page cell went back to printing "Flow Multiplier": a page the person really
         * can open, and one that does not contain the setting the table just told them the
         * reset would move. That is the SAME dangling reference the leaf-level gate was
         * added to remove, one level further down — the page opens, and the row is not on
         * it — and it is the shape this fork exists to remove: a promise in copy the code
         * does not keep.
         *
         * SO BOTH GATES ARE ASKED, the page's and the row's, and either one closing dashes
         * the cell. `shownOnMachine` is the general form and `leafShownOn` its page-shaped
         * alias; the row gets the general one because a row is not a page. The rule itself
         * still lives in exactly one place (`settings-nav.js`), which is why asking it
         * twice here is two questions and not two copies of an answer. */
        const resets = RESET_FIELDS.map((row) => {
            const registryRow = SETTINGS_ROWS.find((entry) => entry.field === row.field);
            const candidate = registryRow ? leafFor(registryRow.leaf) : null;
            const reachable = candidate
                && leafShownOn(candidate, machineClass)
                && shownOnMachine(registryRow, machineClass);
            const leaf = reachable ? candidate : null;
            return { ...row, registryRow, leaf };
        });
        /* THE PAGES THIS MACHINE ACTUALLY HAS, named once each and in table order. A page
         * carrying two of the eight — Pre Shot carries the four heater-up numbers — must
         * not be named four times in one sentence. */
        const pages = [...new Set(resets.map((row) => row.leaf).filter(Boolean).map(navName))];

        return html`
            <section class="group" id="defaults">
                <div class="fact-head">
                    <h3 class="ui-heading">${t('Restore default settings')}</h3>
                    <ui-button
                        id="defaults-start"
                        variant="danger"
                        ?disabled=${!client}
                        @click=${() => { this._confirm = 'defaults'; }}
                    >${t('Restore defaults')}</ui-button>
                </div>
                <p class="ui-caption prose"
                    >${t('Puts eight machine settings back to the values the machine ships with. Nothing else is touched — no profile, no calibration, no shot history.')}</p>

                <!-- WHAT MOVES, WHERE IT LIVES, AND WHAT IT BECOMES. Ben, 26 Aug 2026:
                     "name each row by the PAGE its setting comes from, and add two
                     columns — the current value, and the default it will become."
                     A list of setting names told the reader what would move; it did not
                     tell them where to go and look at it afterwards, or whether the reset
                     would change anything at all on their machine. -->
                <div class="resets" id="defaults-list">
                    <span class="ui-microcap resets-head">${t('Page')}</span>
                    <span class="ui-microcap resets-head">${t('Setting')}</span>
                    <span class="ui-microcap resets-head resets-num">${t('Now')}</span>
                    <span class="ui-microcap resets-head resets-num">${t('Default')}</span>
                    ${resets.map(({ registryRow, leaf, ...row }) => {
                        const now = read(row.field);
                        return html`<div class="reset" data-field=${row.field}>
                            <span class="ui-body">${leaf ? t(navName(leaf)) : MACHINE_INFO_DASH}</span>
                            <span class="ui-body">${t(registryRow?.heading ?? row.field)}</span>
                            <span class="ui-body ui-numeric resets-num">${
                                now === undefined || now === null ? MACHINE_INFO_DASH : String(now)
                            }</span>
                            <span class="ui-body ui-numeric resets-num">${String(row.value)}</span>
                        </div>`;
                    })}
                </div>

                ${this._defaultsFailed
                    ? html`<span id="defaults-refusal" class="ui-caption"
                        >${t('The machine refused. It may be busy, or not connected.')}</span
                    >`
                    : nothing}
            </section>
            <ui-confirm-dialog
                id="defaults-confirm"
                .open=${this._confirm === 'defaults'}
                question=${t('Restore these eight settings?')}
                detail=${defaultsDetail(t, pages)}
                confirm-label=${t('Restore defaults')}
                tone="destructive"
                @confirm=${this.#onDefaultsConfirm}
                @cancel=${() => { this._confirm = null; }}
                @open-change=${(event) => { if (event?.detail?.open === false) this._confirm = null; }}
            ></ui-confirm-dialog>
        `;
    }

    #onDefaultsConfirm = async () => {
        this._confirm = null;
        const client = this.deps?.de1Settings;
        if (!client) return;
        const result = await client.resetSettings();
        this._defaultsFailed = !result?.ok;
        if (!result?.ok) return;
        /* AND THIS PAGE RE-READS TOO, WHICH IT DID NOT UNTIL 26 AUGUST 2026.
         *
         * The client invalidates both DE1 caches on a successful reset, so the pages that
         * SHOW the eight re-read on their next visit — that half was already right, and it
         * is the bug the old skin had in as many words: "Reset-to-defaults repainted the
         * PRE-reset values under a toast that said it had worked."
         *
         * THIS PAGE SHOWS THEM TOO, and it was the one page still doing exactly that. Its
         * NOW column lists what each of the eight is set to right now, and the settings
         * model holds its own copy of the machine document — invalidating an HTTP cache
         * does not touch that. So the reset landed, the table went on printing the values
         * from before it, and the only way to see the new ones was to leave the page and
         * come back. Found by re-judging the behaviour audit against the build.
         *
         * ONE READ, THROUGH THE MODEL. `loadMachine` is the same call the leaf model makes
         * after its own commit, so there is one reader of that document and no second
         * opinion about what the machine holds.
         *
         * AND THEN A REPAINT, WHICH THE PARAGRAPH ABOVE ASSUMED AND DID NOT GET. The read
         * landed and the table went on printing the old numbers anyway, so the fix
         * described above was half a fix and its own comment was the promise the code did
         * not keep — the exact shape this fork exists to remove.
         *
         * WHY THE RE-READ ALONE IS NOT ENOUGH. `reloadMachine` refreshes the leaf MODEL's
         * copy of the machine document and bumps the model's beacon. This element does not
         * subscribe to that beacon: `#watch` takes the thirteen bespoke STORES and the
         * settings keys, and the model is neither. The screen above does subscribe, but it
         * re-renders `<settings-bespoke-leaf>` with the SAME `deps` object, and lit
         * compares properties by identity — so nothing changes and no render is scheduled.
         *
         * A LOCAL BUMP RATHER THAN A NEW SUBSCRIPTION, and the scope is why. `machineValue`
         * has exactly one reader in this file — `#defaults`, four lines up — so a general
         * model subscription would re-render nine bespoke leaves on every staged keystroke
         * anywhere in Settings to keep one table fresh on one of them. This page knows it
         * just moved eight machine values and knows it draws them; saying so here is the
         * smaller and the more honest claim. */
        await this.deps?.reloadMachine?.();
        this._version += 1;
    };

    /** Back to the shipped map. Writing `null` clears the whole overrides object. */
    #onBindingsReset = () => {
        this.#stopCapture();
        this._captureAction = null;
        this._bindingConflict = null;
        Promise.resolve(this.deps?.settings?.set?.('keyboardBindings', null)).catch(() => {});
    };
}

/* ===========================================================================
 * WAKE-SCHEDULE HELPERS — module scope, DOM-free, and read by the suite directly.
 * =========================================================================== */

/**
 * ISO weekdays: Monday is 1 and Sunday is 7 (`WakeSchedule.matchesTime` compares against
 * Dart's `DateTime.weekday`, which is ISO-8601). Listed Monday-first for the same reason,
 * not because of any locale — the number IS the order.
 *
 * `label` is the two-letter cap on the toggle; `name` is its accessible name, because a
 * button whose visible text is "Tu" must still announce "Tuesday".
 */
export const WEEKDAYS = Object.freeze([
    Object.freeze({ iso: 1, label: 'Mo', name: 'Monday' }),
    Object.freeze({ iso: 2, label: 'Tu', name: 'Tuesday' }),
    Object.freeze({ iso: 3, label: 'We', name: 'Wednesday' }),
    Object.freeze({ iso: 4, label: 'Th', name: 'Thursday' }),
    Object.freeze({ iso: 5, label: 'Fr', name: 'Friday' }),
    Object.freeze({ iso: 6, label: 'Sa', name: 'Saturday' }),
    Object.freeze({ iso: 7, label: 'Su', name: 'Sunday' }),
]);

/**
 * The editor's draft for a served schedule, or for a new one.
 *
 * A NEW SCHEDULE OPENS AT 07:00 WITH NO DAYS, and both halves are decisions rather than
 * blanks: the picker needs a time to draw a hand at, and no days means every day, which
 * is the useful default for "wake the machine before I get up".
 */
export function draftFrom(schedule) {
    if (!schedule) return { id: null, time: '07:00', days: [], keepAwakeFor: 0 };
    return {
        id: schedule.id,
        time: typeof schedule.time === 'string' ? schedule.time : '07:00',
        days: [...(schedule.daysOfWeek ?? [])].sort((a, b) => a - b),
        /* ABSENT MEANS NONE, AND THE STEPPER SPEAKS ZERO. `WakeSchedule.toJson` omits
         * `keepAwakeFor` entirely when it is null, and the handler treats 0 and null
         * alike as "clear" — so the two absences are one value here. */
        keepAwakeFor: Number.isFinite(schedule.keepAwakeFor) ? schedule.keepAwakeFor : 0,
    };
}

/**
 * The days line under a schedule's time.
 *
 * AN EMPTY SET IS "EVERY DAY", NOT "NEVER" — `matchesTime` filters by day only when the
 * set is non-empty. Getting this backwards would describe a daily alarm as one that never
 * fires, which is the kind of confident wrong sentence a UI is worse for having.
 */
export function dayWords(days, t = (text) => text) {
    const list = [...(days ?? [])].sort((a, b) => a - b);
    if (list.length === 0) return t('Every day');
    if (list.length === 7) return t('Every day');
    return list
        .map((iso) => WEEKDAYS.find((day) => day.iso === iso))
        .filter(Boolean)
        .map((day) => t(day.label))
        .join(' ');
}

/** The keep-awake tail, or nothing at all. Slate's own `formatKeepAwakeDuration`. */
export function keepAwakeWords(minutes, t = (text) => text) {
    if (!Number.isFinite(minutes) || minutes < 1) return '';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours > 0 && rest > 0) return ` · ${hours} ${t('hr')} ${rest} ${t('min')}`;
    if (hours > 0) return ` · ${hours} ${t('hr')}`;
    return ` · ${rest} ${t('min')}`;
}

/* ===========================================================================
 * USB CHARGER AND PLUGIN-FORM HELPERS — module scope, DOM-free, read by the suite.
 * =========================================================================== */

/**
 * `ChargingState.currentPhase` -> a word.
 *
 * The five are Slate's own labels for ReaPrime's phase names. An unknown phase is printed
 * AS ITSELF rather than replaced with a dash: a new phase name is news, and hiding it
 * behind "—" would make a working machine look like a broken read.
 */
export const CHARGING_PHASES = Object.freeze({
    inactive: 'Inactive',
    normal: 'Normal',
    hovering: 'Hovering',
    chargingToMax: 'Charging to Max',
    sleeping: 'Sleeping',
});

/**
 * Minutes since midnight -> "HH:MM", the string `<ui-time-picker>` reads.
 *
 * `nightModeSleepTime` and `nightModeMorningTime` are ints 0..1439 (`settings_handler
 * .dart` validates `value >= 0 && value < 1440`). An absent or out-of-band value renders
 * as the em dash rather than as midnight — 0 is a real, settable time and must not be
 * what "not answered" looks like.
 */
export function minutesToTime(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1439) return '\u2014';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** "HH:MM" -> minutes since midnight, or null. The inverse, and the only one. */
export function timeToMinutes(value) {
    if (typeof value !== 'string') return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * A typed string -> a number, or null for an empty box.
 *
 * NULL AND NOT ZERO for a cleared field: `savePluginSettings` treats a null as "remove
 * this setting", which is what clearing a box means, while a zero is a value the plugin
 * would then act on. A non-numeric string is also null — the handler validates types and
 * would refuse it, and sending `NaN` serialises as `null` anyway.
 */
export function numberOrNull(value) {
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '' || text === null || text === undefined) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

customElements.define('settings-bespoke-leaf', SettingsBespokeLeaf);
