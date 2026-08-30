/**
 * settings-leaves.js — THE LEAF REGISTRY. Wave 5.4, row `settings-row-thirty-leaves`
 * (with `c6-density-type-scale`, `d8-way-out-of-the-skin` and `d4-d5-d6-scope-boundary`
 * declaring their rows here rather than in a file of their own).
 *
 * SCOPE Part 5 §4: "**settings row** (#29 — the primitive that covers ~30 leaves: label
 * block with heading, optional range hint, live reading, caption; one control on the
 * right) · the five control archetypes (stepper, switch, segmented bank, select,
 * button)". `LAYOUT_SPEC_DRAFT.md` §4.4: "this one primitive covers ~30 of the 37
 * leaves … Nine leaves need their own layout, not seven".
 *
 * WHAT THAT ~30 MEASURES AS, IN THIS REGISTRY — the projection is not met and the honest
 * numbers are here rather than in a summary, because this file is where they are counted:
 *
 *   37  leaves (`allLeaves()`, `settings-nav.js`)   9  bespoke (`BESPOKE_LEAVES`)
 *   28  CLASSIFIED primitive — `leafKind()` below is NOT-in-`BESPOKE_LEAVES`, i.e. a
 *       classification BY EXCLUSION. It is not, and never was, a count of leaves that
 *       compose #29; reporting it as the one-primitive headline conflated two different
 *       quantities and overstated the claim by ten leaves.
 *   19  leaves that COMPOSE #29 — `SETTINGS_ROWS` is 23 rows over 19 distinct leaves
 *       (`leavesWithRows()`), 18 of them primitive; the nineteenth is `display-skin`, a
 *       bespoke leaf that also carries D8's button row.
 *   10  primitive leaves rendering a heading and nothing else, because they hold only
 *       `PENDING_ROWS` and `settings-leaf.js` renders `model.rows()` only.
 *
 * The ten are ACCOUNTED FOR, which is why the registry is honest even though the headline
 * was not: eight carry a `PENDING_ROWS` entry naming the owner that would build the row,
 * `updates-firmware-update` became the TENTH BESPOKE leaf on 24 Aug 2026 (Ben's reversal
 * of D4) and no longer carries a note.
 *
 * THE HEADLINE IS NOW THE OTHER WAY ROUND. On 24 August Ben said "lets fix all the
 * settings pages then now", and the ten silent leaves became ZERO: every one of them is
 * bespoke, every one reads a store, and not one of them needed a route the generated
 * table did not already carry. One pending row survives — `helpLaunches`, which is a
 * counter and not a control, and says so. The totality test asserts the classification
 * and the composition separately, so the two can never be reported as one number again.
 *
 * NO DOM, NO LIT, NO COLOUR, NO LENGTH, NO NUMBER — `src/lib`'s own rule ("plain ES
 * modules with no DOM access", SCOPE Part 2 §2), and it sits beside `settings-nav.js`
 * for the same reason: the model of a screen is not the screen. Here the rule is the
 * point rather than a convenience: a registry that could hold a
 * length would be the second owner of a measure, and a registry that could hold a range
 * would be the second ranges table B2/R2 forbids. There is exactly one number-shaped
 * field in this file and it is a NAME (`limit: 'flushTemp'`) — the value it names lives
 * in `src/lib/machine-limits.js` and reaches a row through the R2 door
 * (`r2MachineLimits`, `src/data/adapters-r.js`), as an argument.
 *
 * ===========================================================================
 * WHY A REGISTRY AND NOT THIRTY-SEVEN FILES  (T13, T20, T14, T17, T7)
 * ===========================================================================
 *
 * Four of this row's five bugs are one bug counted four ways: the old settings page
 * built its rows in template strings, so every leaf was free to write its own padding,
 * its own gap and its own switch.
 *
 *   T13  "One leaf's header sits 12px lower than the other 36, because it wraps its
 *        title in a row that picks up the row primitive's padding-block."
 *   T20  "Fourteen distinct `gap-[Npx]` literals pass through the shell's rhythm rules
 *        untouched."
 *   T14  "Seven contradictory declaration pairs left in place — … leaf gap 32/18 vs 24".
 *   T17  "Twenty hardcoded copies of the switch geometry in template strings, including
 *        an undocumented derived throw."
 *
 * A ROW HERE IS DATA. It cannot carry a padding, a gap or a geometry, because those are
 * not fields — the row component (#29) owns its padding inside its own shadow root and
 * the switch (#5) owns its geometry as four tokens plus a derived throw. Thirty-seven
 * leaves therefore share one rhythm the way they share one measure: not by agreement,
 * but because there is only one declaration and no leaf can reach it. That is the whole
 * "one primitive" claim, and it is structural rather than a coding standard.
 *
 * T7 is the same shape one storey up: "76 lines of `:has()` stepper CSS written for a
 * page that is unreachable … and there is a second, live Fan implementation". Here the
 * Fan threshold is ONE ROW (`calibration-fan-threshold`) and the totality test asserts
 * every row id is unique and every row's leaf exists in `settings-nav.js`, so a second
 * Fan implementation has nowhere to be and an unreachable renderer has nothing to
 * dispatch on.
 *
 * ===========================================================================
 * WHAT A ROW MAY SAY, AND WHAT IT MAY NOT
 * ===========================================================================
 *
 * MAY: which leaf it belongs to, which of the five archetypes carries it, where its
 * value lives (`source`), the logical storage key or machine field, the NAME of a limits
 * row, and its English copy (D2: a value the renderer hands to `t()`, never a translated
 * string — this module has no controller and must not translate).
 *
 * MAY NOT: a number, a length, a colour, a range, an endpoint path, a namespace, a
 * prefix, or a component. `source: 'route'` names a LOGICAL key and the layer is
 * `src/lib/storage-routes.js`'s to decide (B7: one store per setting, resolved in the
 * table, never at a call site). `source: 'machine'` names a field of ReaPrime's own
 * settings document and the door is `src/data/rea-de1-settings.js`, whose two routes are
 * contract rows checked at the pin.
 *
 * ===========================================================================
 * THE COPY IS SLATE'S, READ OUT OF THE CORPUS  (content, never geometry)
 * ===========================================================================
 *
 * Headings and captions below were read from the rendered leaf panes across the 37
 * `settings-*` states of `prov-baseline` — the same corpus `prov_query.py` reads, and the
 * same treatment `settings-nav.js` gives the navigation names: content is quoted, layout
 * is not. Every geometry in those states is on §7.5 and is DISQUALIFIED (Part 10 §4).
 *
 *   CITE settings-machine-flush right-panel [629,181,1200,34] text = "Flush"
 *        rows "Temperature for flush cycles" / "Flush flow rate"
 *   CITE settings-machine-steam    rows "Steam temperature" / "Flow" / "Steam stop"
 *        with items "Off  Time  Milk Temp"
 *   CITE settings-display-display-size rows "Zoom level" with items
 *        "Small  Fit screen  Larger  Largest"  <- C6 keeps THESE FOUR LABELS
 *
 * ONE HINT IS DELIBERATELY NOT CARRIED. Slate's steam row prints "0 or 130–170 °C"
 * (`settings-machine-steam`). The decided envelope is 135 / 165-160 and the hint is
 * COMPOSED FROM THE TABLE by `rangeHint`, so 130/170 has no spelling anywhere in this
 * tree — the screen law's "130/170 anywhere is a block", enforced by construction rather
 * than by proofreading. Slate's fan caption ("0-100", presented as a percentage) is not
 * carried either: `fanThreshold` is a temperature band out of the table — 40–60 °C on a
 * Bengle, 0–50 °C on a DE1 since 27 August 2026 — and the hint says whichever is this
 * machine's. The number is not spelled here for the same reason 130/170 is not.
 *
 * ===========================================================================
 * PENDING ROWS — DECLARED, NOT BUILT, AND EACH ONE NAMES ITS OWNER
 * ===========================================================================
 *
 * `PENDING_ROWS` is the other half of the enumeration and it works exactly like
 * `storage-routes.js`'s `layer: 'none'` half: a setting the old skin had, that this skin
 * does NOT build yet, with the reason and the owner written down. A leaf that renders
 * nothing because its data has no door is a fact about the data layer; a leaf that
 * renders a control which cannot write is a lie about the machine. The registry says
 * which, so nobody has to guess from an empty pane.
 *
 * A pending row is not a placeholder and produces no markup: the renderer never sees
 * this list. `test/settings-leaves.test.mjs` asserts every entry names an owner.
 */

/* ===========================================================================
 * THE FIVE ARCHETYPES, AND THE TWO SHAPES THAT ARE NOT CONTROLS
 * =========================================================================== */

/**
 * Part 5 §4's five, one constant each, plus two row shapes that are not an archetype at
 * all and must not be mistaken for one:
 *
 *   READING — a row with no control. #29 renders a heading, a caption and a live reading
 *             with nothing in its slot; that is a shipped state of the primitive
 *             (`ui-settings-row.js`: an unset `reading` renders no element, an absence
 *             renders the dash), not a sixth control.
 *   TEXT    — `ui-text-field`, already in the library. #29's slot is control-agnostic, so
 *             a text row is the SAME row shape carrying a different library component;
 *             it is counted separately in the digest so the "five archetypes" claim
 *             stays a claim about five and not about six.
 */
/* THE ONE IMPORT THIS REGISTRY HAS, and it is a DECISION rather than a mechanism.
 *
 * `HOT_WATER_STOP` is Ben's whole rule for the hot-water stop, written out in
 * `settings-defaults.js` on 26 August 2026 and — until the row below was rebuilt — imported
 * by nothing at all. A registry that spelled 'weight' and 'volume' again beside it would be
 * a second copy of a rule that already has a home, and the two would drift the first time
 * one of them was edited. So the row reads the constant and this file stays the place the
 * CONTROL is described, not the place the decision is made. */
import { HOT_WATER_STOP } from './settings-defaults.js';

export const ARCHETYPE = Object.freeze({
    STEPPER: 'stepper',   // #4 ui-stepper
    SWITCH: 'switch',     // #5 ui-switch
    BANK: 'bank',         // #3 ui-bank
    SELECT: 'select',     // #7 ui-select
    /* A CONTINUOUS NUMBER, WHERE A STEPPER WOULD BE WRONG. Added 28 Aug 2026 for screen
     * brightness, which is the only value in the tree a person sets by feel rather than by
     * counting: a stepper asks "how many percent" and a slider asks "how bright". Its
     * absence is why Brightness was a bespoke leaf with one control on it. */
    SLIDER: 'slider',     // ui-slider
    BUTTON: 'button',     // #1 ui-button
    TEXT: 'text',         // ui-text-field — library, not an archetype
    READING: 'reading',   // no control at all
});

/** The five, as the digest counts them. */
export const CONTROL_ARCHETYPES = Object.freeze([
    ARCHETYPE.STEPPER, ARCHETYPE.SWITCH, ARCHETYPE.BANK, ARCHETYPE.SELECT, ARCHETYPE.SLIDER,
    ARCHETYPE.BUTTON,
]);

/**
 * Where a row's value lives. THREE, and the difference between the first two is the
 * whole of B7: a `route` row's layer is a lookup in the routing table, and a `machine`
 * row is not this skin's to store at all.
 */
export const SOURCE = Object.freeze({
    /** A logical key in `src/lib/storage-routes.js`. The layer is the table's answer. */
    ROUTE: 'route',
    /** A field of `GET/POST /api/v1/machine/settings` — ReaPrime owns the value. */
    MACHINE: 'machine',
    /** Neither: the row asks the screen to do something. */
    ACTION: 'action',
});

/**
 * "PUT BACK WHAT WAS THERE" — the one value in a `stages` plan that is not a literal.
 *
 * A stop policy is armed by writing a NUMBER and disarmed by writing zero, so the option
 * that arms it has to name a number, and the honest number is the one the machine already
 * holds. A literal in this table would be a shipped default in the wrong file and would
 * overwrite whatever the user set the last time they used that mode.
 *
 * `settings-leaf-model.js` `restoreValueFor` is the one reader and states the precedence:
 * the machine's own value if it is positive, else the entry in `MACHINE_FALLBACKS`, which
 * is where the provenance of each number is written. A SYMBOL rather than a string so it
 * can never collide with a value a machine could hold.
 */
export const RESTORE = Symbol('restore the value the machine already holds');

/**
 * C6's row id, exported because ONE row in this registry has an effect that is not
 * storage: choosing a display size must move the tokens now, not on the next boot. The
 * screen listens for a change to this id and applies the base to the document root
 * (`src/lib/density.js`). Exported rather than spelled twice — a screen matching on a
 * typed string is how a preference silently stops previewing.
 */
export const DENSITY_ROW = 'display-display-size-density';

/** Primitive leaves compose #29. Bespoke leaves need their own layout (§4.4). */
export const LEAF_KIND = Object.freeze({ PRIMITIVE: 'primitive', BESPOKE: 'bespoke' });

/**
 * THE NINE, verbatim from `LAYOUT_SPEC_DRAFT.md` §4.4: "Nine leaves need their own
 * layout, not seven: machine-info, sleep/wake, skin (2-up cards), skin/app (update
 * list), select-language (tile grid), load-cells (wizard), brightness (slider row),
 * **accessories-lighting** (two-column, `min-w-[420px]`, `settings.js:3916`) and
 * **extensions-decent-app-settings** (the 885px group) — the last two added by the
 * verifier".
 *
 * DECLARED HERE, BUILT BY `bespoke-leaves-nine`. The value is the layout each needs, so
 * the reason a leaf is not on the primitive is written next to the leaf rather than
 * inferred from its absence. A leaf may still carry registry ROWS — its bespoke half is
 * a layout, not an exemption from the row vocabulary.
 */
export const BESPOKE_LEAVES = Object.freeze({
    'machine-machine-info': 'definition card (§4.4) — a read-only fact table, no controls',
    'machine-sleep-wake-schedules': 'schedule editor (§4.4 "sleep/wake")',
    'display-skin': '2-up cards (§4.4 "skin (2-up cards)")',
    /* THE IMAGE CHOOSER — thumbnails, a file pick and a folder pick. Ben, 26 Aug 2026,
     * reversing D10: "keep Slate's image setup including its bundled default; let the
     * user choose another image, or a folder on the disk." A grid of pictures with two
     * pickers over it is not a settings row, and the three ROWS on this leaf (enable,
     * type, cycle) are still registry rows above it. */
    'display-screen-saver': 'the screen-saver image set (Ben, 26 Aug 2026 — reverses D10)',
    'updates-skin-app': 'update list (§4.4 "skin/app (update list)") — #17 progress track lives here',
    'units-language-select-language': 'auto-fill tile grid (§4.4 "select-language (tile grid)")',
    'calibration-load-cells': 'wizard column + step chips (§4.4 "load-cells (wizard)") — D9',
    'accessories-lighting': 'two-column (§4.4, added by the verifier) — D7 LED live preview',
    /* THE TENTH, AND IT REVERSES A DECISION. D4 said "no firmware-update feature, and the
     * hand-picked file upload is removed, not carried"; Ben reversed it on 24 August 2026:
     * "I should be able to pick a file, but it should also have a 'latest' button that
     * pulls it." What D4 was protecting against is still refused — nothing here sends
     * `force`, so an image the machine's own validator calls inapplicable is not flashed
     * by pressing a button labelled Latest. */
    'updates-firmware-update': 'catalog + install (Ben, 24 Aug 2026 — reverses D4) — a Latest button over `recommendedArtifactId`, a file picker, and the flash progress',

    /* ==================================================================
     * NINE MORE, ALL ON ONE INSTRUCTION (Ben, 24 August 2026: "lets fix all the
     * settings pages then now").
     *
     * EVERY ONE OF THEM WAS A DOOR WITH NOBODY WALKING THROUGH IT. Not one needed a
     * new route: `/plugins`, `/plugins/<id>/settings`, `/plugins/<id>/enable`,
     * `/account/decent`, `/feedback`, `/devices/scan`, `/devices/wifi` and
     * `PUT /machine/state/<newState>` were all in the generated table already, and
     * most had a served fixture. What they lacked was a client and a surface.
     *
     * THEY ARE BESPOKE FOR THE §4.4 REASON AND NOT FOR CONVENIENCE — each needs a
     * layout the settings row cannot be. A list of installed plugins, a form
     * generated from a manifest, an irreversible action behind a confirmation, a
     * device scan with results, and a key-capture field are five different shapes;
     * none of them is "a heading, a hint and one control".
     *
     * FOUR OF THEM ALSO CARRY REGISTRY ROWS, which the rule has always allowed: "A
     * leaf may still carry registry ROWS — its bespoke half is a layout, not an
     * exemption from the row vocabulary." The screen renders both halves for every
     * bespoke leaf, so `connection-scale`'s power-mode bank is a row and its scan
     * list is bespoke, on one page.
     * ================================================================== */
    'maintenance-machine-descaling': 'an irreversible action behind a confirmation, over `PUT /machine/state/descaling` — the preparation list is the surface, not a control',
    'maintenance-transport-mode': 'as descaling, over `PUT /machine/state/airPurge`',
    'extensions-plugins': 'the installed-plugin list — one row per manifest, each with its own generated settings form',
    'extensions-visualizer': 'ONE plugin\u2019s settings form, generated from its manifest (`plugins-store.js` `settingFields`)',
    'help-talk-to-decent': 'the account status, and behind a linked account a message thread and a compose box over `GET /account/proxy/support/api/<endpoint>`',
    'help-send-feedback': 'the feedback form: a type bank, a description, two switches and one POST',
    'accessories-usb-charger': 'the charging STATUS block and the two night-mode times — a minute-of-day is a clock face (#22), which is a dialog body and not a row control',
    /* BOTH CONNECTION PAGES, since 26 August 2026. Ben: "take more of Slate ... end with
     * a list of previously connected devices", and "same setup for the scale". A list of
     * devices, each with its own state and its own three actions, is not a settings row
     * and never could be — a row has one control. */
    'connection-machine': 'the remembered device list and its actions (Ben, 26 Aug 2026)',
    'connection-scale': 'the same device list, plus the scan and the manual WiFi endpoints',
    'help-keyboard-shortcuts': 'the binding table with a key-capture field — rebinding needs a keystroke, which no archetype reads',
    /* THE TWENTY-FIRST, AND IT REVERSES THE F3/Q1 SCREEN LAW — the one that said this
     * leaf holds zero rows AND zero note, on "no work of any kind on reset-to-default".
     *
     * WHAT CHANGED IS WHAT A RESET MOVES. Read at the pin,
     * `De1Controller.applySettingsDefaults` writes SEVEN values and nothing else — the
     * fan threshold, the four heater-up numbers, the refill kit mode, the flow estimate
     * and the steam purge mode. It is not a factory reset of the machine: it touches no
     * profile, no calibration latch and nothing a person cannot set again by hand.
     *
     * On 24 August every one of those seven became a CONTROL on a page in this skin, so
     * the rule was written about a button whose effect was mostly invisible and is now
     * about one whose effect is seven rows a user can see and undo. It is a BUTTON and a
     * confirmation naming what moves — which is not a #29 row, so it is bespoke. */
    'calibration-default-load-settings': 'one irreversible-looking button and the list of what it actually moves (Ben, 24 Aug 2026 — reverses F3/Q1)',
});

/**
 * A PAGE-LEVEL ACTION, in the leaf's head row beside the title.
 *
 * Ben, 26 August 2026, on the connection pages: "put the Search button above the dividing
 * line on the right." Slate does the same — its Search sits level with the page title on
 * both Machine and Scale — and Decal had it inside a card near the bottom of one page
 * and missing from the other.
 *
 * IT IS NOT A ROW, and that is why it is a table rather than an archetype. A row has a
 * label on the left and a control on the right; this is an action that belongs to the
 * PAGE, in the one place a page-level action already goes (O7's Restore defaults sits
 * there too). Making it a row would put it below the rule and give it a heading nobody
 * needs.
 *
 * THE SCREEN ANSWERS IT, through the same `leaf-action` event D8's Leave button uses. The
 * renderer knows nothing about scanning.
 */
export const LEAF_ACTIONS = Object.freeze({
    'connection-machine': Object.freeze({ action: 'scan-devices', label: 'Search' }),
    'connection-scale': Object.freeze({ action: 'scan-devices', label: 'Search' }),
});

/**
 * LEAVES THAT READ THE MACHINE DOCUMENT WITHOUT OWNING A MACHINE ROW.
 *
 * THE DEFECT, MEASURED 26 August 2026. `settings-leaf-model.load()` reads the machine
 * document only when the leaf has at least one `SOURCE.MACHINE` row. That is the right
 * test for a leaf built out of rows, and it is the wrong one for a bespoke leaf that
 * reads machine fields through `machineValue()` and draws them itself.
 *
 * `calibration-default-load-settings` is exactly that. Ben asked its table for a NOW
 * column beside the DEFAULT column — "tell them whether the reset would change anything
 * at all on their machine" — and the leaf holds no registry rows, so no read fired and
 * every one of the eight NOW cells drew the absence dash. Not a fixture gap: on the
 * tablet the column reads the dash too, unless the person happened to open a machine
 * page first in the same session, which makes the column's correctness depend on where
 * they came from.
 *
 * ONE NAME PER LEAF, DECLARED HERE. The model must not carry a hard-coded leaf id, and
 * the bespoke renderer cannot ask for a read it does not know it needs. This is the
 * registry saying what the leaf needs, which is what the registry is for.
 */
export const LEAVES_READING_MACHINE_DOC = Object.freeze([
    'calibration-default-load-settings',
]);

/** Does this leaf need the machine document even with no machine row? */
export function leafReadsMachineDoc(leafId) {
    return LEAVES_READING_MACHINE_DOC.includes(leafId);
}

/** The page-level action for a leaf, or null. */
export function leafAction(leafId) {
    return LEAF_ACTIONS[leafId] ?? null;
}

/* ===========================================================================
 * THE ROWS
 * =========================================================================== */

/**
 * Every live row, in leaf order. THE SINGLE PLACE A LEAF IS DESCRIBED.
 *
 * Fields:
 *   id        unique, `<leaf>-<row>`; the renderer keys on it and the suite asserts it
 *   leaf      a leaf id in `settings-nav.js` — asserted, so a typo cannot orphan a row
 *   archetype one of ARCHETYPE
 *   source    one of SOURCE
 *   key       SOURCE.ROUTE only — the LOGICAL key; the layer is the routing table's
 *   field     SOURCE.MACHINE only — the field name in ReaPrime's settings document
 *   action    SOURCE.ACTION only — the intent the screen receives
 *   limit     the NAME of a row in the limits table; the values arrive through R2
 *   unit      only where the table has no row, so the stepper is UNBOUNDED and says so
 *   invert    a stored `true` that the control shows as OFF (helpHidden)
 *   items     bank/select choices — `{value, label}`, labels are English for `t()`
 *   heading / caption   English copy, run through `t()` by the renderer (D2)
 */
export const SETTINGS_ROWS = Object.freeze([

    /* ---- Machine ------------------------------------------------------------
     * STEAM. FOUR live rows since the cmp-sm-1 fix (21 Aug 2026); it was two, and the
     * two that were missing were an UNDECLARED partial — neither in PENDING_ROWS nor
     * in any manifest row, which is what made it a finding rather than a decision.
     *
     * The temperature itself is still pending (see PENDING_ROWS): it is written by
     * POST /api/v1/machine/shotSettings, whose contract row is `recorded` — no client
     * addresses it — and inventing a caller for a route no consumer has checked is
     * exactly what the contract law forbids.
     *
     * DURATION AND PURGE MODE ARRIVE BY TWO DIFFERENT DOORS, and the difference is the
     * contract table rather than a preference:
     *
     *   steamPurgeMode IS a field of GET and POST /api/v1/machine/settings (CONTRACTS
     *   getMachineSettings/postMachineSettings, both `consumed`), so it is a MACHINE
     *   row exactly like `steamFlow` beside it and the leaf's existing write path
     *   carries it. The drop left a served machine setting unreachable anywhere in the
     *   app, which is the finding's own sentence.
     *
     *   steamDuration IS NOT on that route — the nine keys are usb, fan, flushTemp,
     *   flushFlow, flushTimeout, hotWaterFlow, steamFlow, tankTemp, steamPurgeMode.
     *   Slate wrote it into `workflow.steamSettings.duration` (settings.js:3330), and
     *   PUT /api/v1/workflow is `declared` here, not consumed for this purpose. So the
     *   row is ROUTED, machine-scoped, beside `steamStopMode` — which is the same
     *   choice already made for the STOP MODE this value belongs to. The two are one
     *   steam-stop policy in two fields and they now live in one place. See the
     *   deferred question: the reversal is one row in storage-routes.js the day the
     *   machine route carries the field.
     *
     *   AND THE MACHINE'S OWN TIMER IS NOT WHAT THIS ROW WRITES — verified at the
     *   pin by the fix run's review, so the next reader is not left guessing. The
     *   DE1's stop-at-time is its `targetSteamDuration` shot setting, and at the pin
     *   the workflow door is what feeds it: workflow_handler.dart:157-173 deep-merges
     *   `steamSettings.duration` and hands old/new to
     *   De1Controller.updateWorkflowSettings (de1_controller.dart:531-570), which
     *   writes the register through updateShotSettings (de1_controller.dart:442-453).
     *   Until a consumed write path exists, a value staged on THIS row reaches the
     *   skin's stores and nothing else; the machine steams by whatever
     *   targetSteamDuration it already holds. Whether that gap is closed by adopting
     *   the workflow route or by an upstream ask is the deferred question's subject,
     *   and it is Ben's to rule.
     */
    /* THE MASTER SWITCH, AND IT IS THE PAGE'S FIRST ROW.
     *
     * Ben, 26 August 2026: "Add a new toggle to the top to turn the steam on and off with
     * the toggle or switch. Rest of the order is ok." The rest of the order IS the order
     * below — flow, then temperature — so this row is inserted and nothing is moved.
     *
     * IT RETIRES A SENTENCE AS WELL AS ADDING A CONTROL. The old temperature caption said
     * "Below the bottom of the band the steam heater is off", which made the temperature
     * stepper carry two jobs: a setpoint and an off switch. With a switch on the page that
     * rule is gone (Ben: "the new toggle does that job"), so the caption went with it.
     *
     * `enabledBy` ON THE FOUR ROWS BELOW IS THE OTHER HALF. A steam page with the heater
     * off shows its four settings inert and dashed rather than hiding them: the values are
     * still what the machine will use when steam is switched back on, and hiding them
     * would make the switch look like it deleted them. */
    Object.freeze({
        id: 'machine-steam-enabled',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'steamTargetTemperature',
        /* THE SWITCH IS A VIEW OVER THE TEMPERATURE, NOT A SECOND SETTING.
         *
         * The machine's own way of saying "no steam" is a target temperature of zero —
         * `machine-limits.js` steamTemp says exactly that, `zeroMeans: 'steam heater
         * off'` — and the old skin taught it as a rule the user had to learn ("Setting
         * below 130 °C turns the steam heater off"). A NEW stored flag beside that field
         * would be a second answer to one question, and the two would drift the first
         * time anything else wrote the temperature.
         *
         * So this row STAGES THE SAME FIELD the temperature row does: off writes 0, on
         * writes back the remembered target. `zeroSwitch` names the KV key that remembers
         * it, which is `cup-warmer.js`'s pattern verbatim — "the machine holds only the
         * live value (0 when off)", so the value to come back to has to live somewhere
         * that is not the machine. */
        zeroSwitch: 'steamTempWhenOn',
        heading: 'Steam',
        caption: 'Turn the steam heater on and off.',
    }),
    Object.freeze({
        id: 'machine-steam-flow',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamFlow',
        limit: 'steamFlow',
        heading: 'Flow',
        enabledBy: 'machine-steam-enabled',
    }),
    /* STEAM TEMPERATURE — built 24 Aug 2026, and its PENDING entry pointed at the wrong
     * door. That entry said `POST /api/v1/machine/shotSettings`, whose contract row is
     * `recorded`. Read at the pin, that route cannot carry one value: `De1ShotSettings
     * .fromJson` runs `parseInt` over all EIGHT fields and `parseInt` ends in
     * `int.parse(value)`, which throws on a missing key — so a one-target POST either
     * 500s or, with the other seven supplied from a cache, is a whole-document write.
     * `PUT /api/v1/workflow` takes a PATCH (`deepMergeJson`) and
     * `De1Controller.updateWorkflowSettings` writes the changed group through to the DE1,
     * so the value reaches the machine by the door that already has a store here.
     * `machine-fields-port.js` carries the flat-name-to-nested-path map. */
    Object.freeze({
        id: 'machine-steam-temp',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamTargetTemperature',
        limit: 'steamTemp',
        heading: 'Temperature',
        enabledBy: 'machine-steam-enabled',
        /* THE ONE LIVE READING ON THE PAGE, and Slate has it: settings.js:1016
         * LIVE_READINGS maps `steamTempNow` to the snapshot's `steamTemperature` and
         * prints "now 158 °C" beside the range, or "no reading" when the channel is
         * silent. Slate's own comment states the rule this row inherits — "Only channels
         * with a genuine instantaneous value appear here ... A channel the machine is not
         * reporting says so rather than showing a stale or zero figure." */
        live: 'steamTemperature',
    }),
    /* THE STOP MODE IS THE MACHINE'S, AND UNTIL 26 AUGUST 2026 IT WAS INERT.
     *
     * It was `source: ROUTE` over the `steamStopMode` KV key, so choosing an option wrote a
     * string to the tablet and NOTHING reached the machine. All three options were false at
     * once. "Off", whose caption promises "Steam runs until you stop it", left the machine
     * stopping on whatever timer it already held. "Milk Temp" did not arm the probe:
     * ReaPrime's `steam_sequencer.dart:134-140` reads `wf.steamSettings.stopAtTemperature`
     * and returns immediately when it is `<= 0`, and Slate DOES write it — `setSteamStopMode`
     * posts 60 on the way in and 0 on the way out. And the page offered Milk Temp with no
     * target control at all, where Slate shows a stepper and a live probe reading.
     *
     * SO THE MODE IS DERIVED FROM THE TWO FIELDS THAT ARE THE MODE, which is Ben's O3 read
     * literally: "the current option should always be shown as selected, read from the
     * machine." There is no third field and no stored flag beside them to drift — the same
     * argument the `zeroSwitch` rows make about a heater's target, with two fields instead
     * of one. `derivedFrom` is ordered by precedence: an armed probe wins over a timer,
     * because that is what the sequencer does.
     *
     * THE KV KEY IS RETIRED, AND THE RAIL DERIVES THE MODE THE SAME WAY (27 August 2026).
     * `steamStopMode` was the Live rail's own copy of this choice, and while it existed the
     * two surfaces had two sources for one fact: an "Off" chosen here left the rail showing
     * whatever its copy last said, and the rail had no Off option at all. `live-wiring.js`
     * now reads the mode from the same two workflow fields through `steamStopFrom` in
     * `live-targets.js`, and writes back through the same door with the same restore ladder.
     * The rail SHOWS Off and cannot arm it — leaving Off needs a duration the machine no
     * longer holds, and the rail commits on the press with no Cancel, so a caption tap that
     * zeroed both fields would be a destructive setting hidden in a two-word microcap.
     *
     * MILK TEMP IS CAPABILITY-GATED ON THE ITEM, which is the gap Decal's own registry
     * already admitted by name (R3 `r3MilkProbeCapability`). The Live rail gates its Milk
     * option on the same `sensorCapability('milkProbe')` answer, so the two surfaces now ask
     * one question about one piece of hardware. */
    Object.freeze({
        id: 'machine-steam-stop',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        derivedFrom: Object.freeze([
            Object.freeze({ field: 'milkStopTemp', is: 'milk-temp' }),
            Object.freeze({ field: 'steamDuration', is: 'time' }),
        ]),
        whenNone: 'off',
        /* WHAT EACH OPTION WRITES. Two fields per press, staged together, so Cancel undoes
         * both. `RESTORE` is "the number the machine already holds" — see the symbol's own
         * paragraph and `restoreValueFor`. */
        stages: Object.freeze({
            off: Object.freeze({ steamDuration: 0, milkStopTemp: 0 }),
            time: Object.freeze({ milkStopTemp: 0, steamDuration: RESTORE }),
            'milk-temp': Object.freeze({ milkStopTemp: RESTORE }),
        }),
        /* THE OPTION TO FALL BACK TO when the chosen one is disabled — a machine with no
         * milk probe cannot be in Milk Temp, so it reads as Time. */
        unavailable: 'time',
        heading: 'Steam stop',
        caption: 'What ends a steam session.',
        enabledBy: 'machine-steam-enabled',
        /* THE CAPTION FOLLOWS THE SELECTION, which is Slate's own shape
         * (settings.js:3217-3221 `stopDescriptions`) and the reason Ben asked for it:
         * "What ends a steam session" says what the SETTING is for, and Slate's sentence
         * says what the CURRENT choice does. The row keeps its own caption as the
         * fallback, so a value with no sentence — or no value at all — still reads.
         * Keyed by the option's own value, so a new option cannot silently inherit
         * another option's description. */
        captions: Object.freeze({
            off: 'Steam runs until you stop it (subject to the machine safety timeout).',
            time: 'Steam stops automatically after the set duration.',
            'milk-temp': 'Steam stops automatically when the milk reaches the target temperature.',
        }),
        items: Object.freeze([
            Object.freeze({ value: 'off', label: 'Off' }),
            Object.freeze({ value: 'time', label: 'Time' }),
            /* THE MILK-PROBE NOTE RIDES ON THE OPTION IT IS ABOUT, and that is the
             * whole mechanism. Slate printed it as a second <p class="slate-caption">
             * under the bank ([i=71]) whenever the Milk Temp option was offered on a
             * machine with no probe; the Decal rebuild dropped it undeclared while
             * keeping the option. Attaching it to the ITEM rather than to the ROW
             * means the note is present exactly when the option is — the day this
             * option becomes capability-gated (R3 r3MilkProbeCapability, the gap the
             * capability store already enumerates) the note leaves with it and nobody
             * has to remember a second edit. `note` is the only per-item field beyond
             * value/label, and `settings-leaf.js` is the one reader. */
            /* `sensor` RATHER THAN `capability` BECAUSE REAPRIME HAS TWO DOORS. The milk
             * probe is not one of the seven entries `de1handler.dart` puts in the
             * capability array; it is answered by the R3 adapter over that same array
             * (`r3MilkProbeCapability`), which is what `settings.gateSensor` asks and what
             * `live-wiring.js`'s `#offers` asks for the rail's identical option. */
            Object.freeze({
                value: 'milk-temp',
                label: 'Milk Temp',
                sensor: 'milkProbe',
                note: 'Requires the Bengle milk temperature probe.',
            }),
        ]),
    }),
    /* THE MILK TARGET, WHICH THE PAGE OFFERED A MODE FOR AND NO CONTROL FOR.
     *
     * Slate draws "Stop at milk temperature" as a stepper plus a live probe reading whenever
     * that mode is chosen (settings.js:3345-3380); Decal offered the mode and nothing to
     * set. The field is `steamSettings.stopAtTemperature` — the same one the mode bank arms
     * — so this row and the bank above are one policy in two controls, and the bank's own
     * `stages` is what keeps them from disagreeing.
     *
     * NO FALLBACK, WHICH IS A7. Ben was never asked for a milk temperature and the machine
     * holds none until somebody sets one, so an unanswered machine draws the dash here
     * rather than a number nobody chose. `MACHINE_FALLBACKS` deliberately has no entry — and
     * it must not gain one, or the mode above would derive "Milk Temp" on every machine that
     * has not answered yet. */
    Object.freeze({
        id: 'machine-steam-milk-target',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'milkStopTemp',
        limit: 'milkStopTemp',
        heading: 'Stop at milk temperature',
        enabledBy: Object.freeze([
            'machine-steam-enabled',
            Object.freeze({ row: 'machine-steam-stop', value: 'milk-temp' }),
        ]),
    }),
    /* DURATION IS THE MACHINE'S, AND IT WAS THIS SKIN'S UNTIL 26 AUGUST 2026.
     *
     * The paragraph above this block used to end "So the row is ROUTED, machine-scoped,
     * beside `steamStopMode`" and named the reversal it was waiting for: "one row in
     * storage-routes.js the day the machine route carries the field". The day came from
     * the other side. `workflowDoorFor` (machine-fields-port.js) was built for steam
     * temperature, `steamSettings.duration` is a field of the same document
     * (ReaPrime `workflow.dart:233-240`), and `PUT /api/v1/workflow` deep-merges — so a
     * one-field patch is safe on this door in a way it is not on shotSettings.
     *
     * THE ARGUMENT FOR MOVING IT IS NOT TIDINESS, IT IS THAT THE SPLIT WAS REAL. The Live
     * rail already read this value off the workflow (`workflow-targets.js` SCALAR_FIELDS
     * `steamDuration`), so the rail and the settings page were reading two different
     * stores for one setting — the exact defect the routing table exists to prevent. One
     * store now, and it is the machine's.
     *
     * Ben, 26 August 2026: "Read flow and duration from the machine. If unavailable: Time
     * at 60 s and 1 mL/s." The 60 is now a MACHINE fallback rather than a stored default
     * (settings-defaults.js), which is the same sentence expressed in the right table. */
    /* TWO GATES, BOTH REQUIRED. The heater has to be on AND the stop mode has to be Time,
     * because a duration under an Off or a Milk Temp stop is a number the machine will not
     * use. `enabledBy` takes a list for exactly this; a row is inert if ANY gate says so. */
    Object.freeze({
        id: 'machine-steam-duration',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'steamDuration',
        limit: 'steamDuration',
        heading: 'Duration',
        enabledBy: Object.freeze([
            'machine-steam-enabled',
            Object.freeze({ row: 'machine-steam-stop', value: 'time' }),
        ]),
    }),
    Object.freeze({
        id: 'machine-steam-purge',
        leaf: 'machine-steam',
        archetype: ARCHETYPE.SELECT,
        source: SOURCE.MACHINE,
        field: 'steamPurgeMode',
        heading: 'Steam purge mode',
        enabledBy: 'machine-steam-enabled',
        caption: 'Normal purges the wand as soon as steam stops. Two Tap Stop waits for a second tap, so the wand can stay in the jug.',
        /* TWO OPTIONS, AND THE FINDING SAID THREE. cmp-sm-1 reads the oracle's
         * [i=81] TEXT — "Normal Two Tap Stop", the two option labels concatenated by
         * the walker — as "Normal / Two Tap / Stop". The handler's own markup is two
         * <option> elements (slate settings.js:3392-3394): value 0 "Normal" and
         * value 1 "Two Tap Stop". Three options would invent a value the machine has
         * no number for, so the oracle's two are built and the correction is
         * declared. The values are the NUMBERS the route carries, not the labels. */
        items: Object.freeze([
            Object.freeze({ value: 0, label: 'Normal' }),
            Object.freeze({ value: 1, label: 'Two Tap Stop' }),
        ]),
    }),

    /* HOT WATER. `hotWaterFlow` has NO row in the limits table, so the stepper is
     * unbounded and prints no hint — B2's "unstated is unbounded, null, not a number
     * this file picked". Target temperature and volume arrive by the WORKFLOW door for
     * the reason written above steam temperature. */
    Object.freeze({
        id: 'machine-hot-water-temp',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterTargetTemperature',
        limit: 'hotWaterTemp',
        /* SLATE'S LABEL, ON BEN'S RULING (26 Aug 2026, "Use Slate's labels"). Slate
         * writes "Target temperature" (settings.js:4415) and the extra word earns its
         * place on a page that also carries a live group reading. */
        heading: 'Target temperature',
        /* AND THE LIVE READING IS WHAT EARNS IT, which is why the two land together. The
         * steam row got its reading on 24 August and hot water did not, so the longer label
         * was doing the work of a distinction the page did not draw.
         *
         * THE CHANNEL IS THE GROUP'S, which is Slate's own mapping (`settings.js:1016-1018`
         * LIVE_READINGS `hotWaterTempNow` -> `groupTemperature`, printed at `:4416`). The
         * DE1 reports no separate hot-water outlet probe, and inventing one would be worse
         * than the silence: A7 forbids a stand-in, and Slate's rule at the steam row says
         * the same — "a channel the machine is not reporting says so rather than showing a
         * stale or zero figure". Worth confirming on the rig whether `mixTemperature` reads
         * closer on a Bengle; Slate's choice is the default, not a certainty. */
        live: 'groupTemperature',
    }),
    /* DURATION — THE LIMITER, AND IT SAYS SO.
     *
     * Ben, 26 August 2026: "Add duration, stop should be the limiter but make it loud
     * with 'Stops at this time regardless of amount dispersed'." So the caption is not a
     * description of the control, it is a WARNING about what the control overrides: the
     * stop mode below can be set to weight and this row will still cut the pour.
     *
     * Slate has the control (settings.js:4472-4500, 5-120 s in steps of 5) and Decal
     * had nothing — with Volume and Weight the only stops offered, there was no time
     * limit anywhere on the page. Same door as the temperature above. */
    Object.freeze({
        id: 'machine-hot-water-duration',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterDuration',
        limit: 'hotWaterDuration',
        heading: 'Duration',
        caption: 'Stops at this time regardless of the amount dispensed.',
    }),
    /* THE 255 CEILING IS THE PACKET'S AND THE LIMITS TABLE OWNS IT. Its paragraph in
     * machine-limits.js is the one that measured the wrap on the bench (400 came back as
     * 144); nothing here repeats a number. */
    /* THE STOP MODE — L25's hot-water half, and the regression the live-polish pass
     * declared (its L25-hot-water finding) built where the finding named it. Folding
     * the Live rail's stop-mode banks into Slate's caption (7-live-polish, it14) left
     * HOT WATER's Volume/Weight with no control ANYWHERE, while steam's kept
     * `machine-steam-stop` above — and Slate itself has a working control for exactly
     * this, on exactly this leaf: settings.js:4540 `stopHotWaterAtWeightToggle`,
     * "Stop at weight" over the Rea setting `stopHotWaterAtWeight` (its Live toggle is
     * the display:none half of L25, slate-live.css:554). Ben's charter sentence —
     * "improvements, not regressions" — is why this lands with the pass rather than
     * riding its digest.
     *
     * A BANK, NOT SLATE'S SWITCH, on the sanctioned consistency class: Decal draws
     * ONE stop policy control kind, and the steam half is already a bank (Slate itself
     * draws its two stop-mode controls two ways — steam as a three-button group at
     * settings.js:3213, hot water as a switch — so no one form matches both, and the
     * steam pair is the template this row mirrors field for field). The weight
     * option's note is Slate's own caption sentence, riding the option it gates
     * exactly as the milk-probe note does above. Where the VALUE goes — and the gap
     * between this row and ReaPrime's own `stopHotWaterAtWeight` until that door is
     * adopted — is `hotWaterStopMode`'s paragraph in storage-routes.js. */
    /* AND THE ROW REACHES THE MACHINE SINCE 26 AUGUST 2026. The paragraph above ends "the
     * gap between this row and ReaPrime's own `stopHotWaterAtWeight` until that door is
     * adopted"; the reason recorded for not adopting it — "an UNADOPTED door here, no
     * contract row, no consumer" — was stale. `stopHotWaterAtWeight` is served by
     * GET /settings, accepted by POST /settings, read by `hot_water_sequencer.dart:106`,
     * and this skin's `app` door already writes a dozen keys through that exact route.
     *
     * THE KV KEY IS RETIRED, AND THE RAIL IS ON THE SAME FIELD (27 August 2026).
     * `hotWaterStopMode` was the Live rail's own copy, and the rail's toggle wrote it and
     * NOTHING ELSE — its own comment admitted as much. So the rail could say "Weight" while
     * the machine went on stopping by volume. `live-wiring.js` now reads and writes
     * `stopHotWaterAtWeight` through the same door this row uses.
     *
     * BEN'S RULE IS THE WHOLE ROW, and it was written down as `HOT_WATER_STOP` in
     * settings-defaults.js on 26 August with NOTHING IMPORTING IT — a finished half with no
     * other half, three lines below the defaults that do work. "Weight for Bengle, Weight
     * for the DE1 [if a] scale is connected, weight grayed out if no scale is connected and
     * volume selected." The consequence of the missing half was concrete: on a tablet with
     * no scale the page defaulted to Weight, offered Weight ungreyed, and a pour started
     * that way had no stop at all.
     *
     * SO THE CONSTANT IS THE SOURCE OF THE THREE PIECES BELOW — which option is disabled,
     * what the selection falls to, and which is preferred — rather than three literals that
     * agree with it today.
     *
     * `stopAtWeight` IS THE CAPABILITY ASKED, and Ben's sentence says "scale". It is the
     * closest thing ReaPrime answers: the served array carries `stopAtWeight`, the Live
     * rail's identical Weight option is gated on that same entry (`live-wiring.js`
     * `#offers`), and a skin that asked two different questions about one offer would give
     * two different answers on one machine. */
    Object.freeze({
        id: 'machine-water-stop',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'stopHotWaterAtWeight',
        /* THE BOOLEAN AND THE TWO WORDS, mapped once and read in both directions by the
         * model. ReaPrime holds a bool; the page draws two cells. */
        fieldValues: Object.freeze({ volume: false, weight: true }),
        unavailable: HOT_WATER_STOP.withoutScale,
        heading: 'Hot water stop',
        caption: 'What ends a hot-water pour.',
        items: Object.freeze([
            Object.freeze({ value: 'volume', label: 'Volume' }),
            Object.freeze({
                value: HOT_WATER_STOP.disabledWithoutScale,
                label: 'Weight',
                capability: 'stopAtWeight',
                note: 'Requires a connected scale',
            }),
        ]),
    }),

    /* ONE FIELD, TWO NAMES, AND THE STOP MODE PICKS WHICH.
     *
     * Ben's order for this page (26 Aug 2026) is "Temperature, Duration, Hot Water stop,
     * Volume / Weight depending on the toggle / Flow" — so the target sits BELOW the mode
     * that names it, and it is one row rather than two.
     *
     * IT IS ALSO ONE FIELD ON THE MACHINE. `live-targets.js` STOP_TARGET already points
     * both WATER_STOP.VOLUME and WATER_STOP.WEIGHT at the same limit key
     * (`hotWaterVolume`) and the same rail track, because ReaPrime carries one hot-water
     * target and the mode decides how it is read. Drawing two rows here would imply two
     * stored numbers and the second would be a lie.
     *
     * `variesWith` NAMES A ROUTE KEY AND `variants` KEYS ON ITS VALUE, so the heading and
     * the unit move together and neither is spelled twice. An unset mode falls through to
     * the row's own heading. */
    Object.freeze({
        id: 'machine-hot-water-volume',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterVolume',
        limit: 'hotWaterVolume',
        heading: 'Volume',
        /* IT NAMES THE ROW, NOT A KEY, since the stop mode moved to a machine field on
         * 26 August 2026 — the same argument `enabledBy` has always made, so a control that
         * changes where its value lives does not drag its dependants with it. */
        variesWith: Object.freeze({ row: 'machine-water-stop' }),
        /* THE THIRD PIECE OF EACH VARIANT IS THE ZERO MEANING, and it was missing until
         * the leaf was photographed on 26 August 2026. The heading read "Weight", the
         * stepper read "0 g", and the hint beside them finished "0 = no volume cap" —
         * the limits row's own wording, which is written for millilitres. One field, two
         * modes, and the sentence has to follow the mode like everything else does. */
        variants: Object.freeze({
            volume: Object.freeze({ heading: 'Volume', unit: 'mL', zeroMeans: 'no volume cap' }),
            weight: Object.freeze({ heading: 'Weight', unit: 'g', zeroMeans: 'no weight cap' }),
        }),
    }),
    Object.freeze({
        id: 'machine-hot-water-flow',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterFlow',
        limit: 'hotWaterFlow',
        heading: 'Flow',
    }),
    /* THE STOP LOOKAHEAD, AND THE REASON RECORDED FOR NOT BUILDING IT WAS FALSE.
     *
     * This registry said Slate "has a numpad field for it and no settings row that renders
     * one, so there is no control to match". Slate in fact renders a complete stepper row on
     * this very page (`settings.js:4551-4578`): heading "Flow multiplier", sub-label
     * "Lookahead for stop-at-weight", unit s, step 0.05, default 0.3. And the value is live
     * at the pin — `hot_water_sequencer.dart:117-118` reads it as `lookaheadSeconds` — so
     * without this row a Bengle stops hot water at weight using an invisible lead nobody can
     * see or tune, while this skin already ships the two SIBLING multipliers on Calibration
     * on Ben's own instruction ("add the weight flow multiplier with a helper like Slate
     * has").
     *
     * PORTED, AND PORTED RENAMED. "Flow multiplier" is a mislabel: the value is a LEAD TIME
     * in seconds, not a ratio, and Slate's own sub-label is the honest half of its own copy.
     * The heading here is what the control does and the caption is why it exists.
     *
     * LAST ON THE PAGE, NOT NEXT TO THE STOP BANK. Ben gave this leaf's order in his own
     * words — "Temperature, Duration, Hot Water stop, Volume / Weight depending on the
     * toggle / Flow" — so a new row appends rather than splitting a sequence he stated.
     *
     * GATED ON THE STOP MODE, because a lookahead is meaningless under a volume stop: the
     * machine is counting millilitres it has already measured, not predicting water in
     * flight. Inert rather than hidden, as everywhere else — the number is still what the
     * machine will use the moment Weight is chosen again.
     *
     * THE GATE'S VALUE IS READ OFF `HOT_WATER_STOP` rather than typed, for the same reason
     * the bank's own items are: Ben's rule names the weight option once, in
     * `settings-defaults.js`, and three literals here that agree with it today are three
     * places to forget when it changes. `disabledWithoutScale` is that option — the one the
     * scale gates — which is exactly the mode this row belongs to. */
    Object.freeze({
        id: 'machine-hot-water-lookahead',
        leaf: 'machine-hot-water',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'hotWaterFlowMultiplier',
        limit: 'hotWaterLookahead',
        heading: 'Stop lookahead',
        caption: 'How far ahead of the target weight the pour is cut, to allow for water still in flight.',
        enabledBy: Object.freeze({ row: 'machine-water-stop', value: HOT_WATER_STOP.disabledWithoutScale }),
    }),

    /* FLUSH. All three fields are on POST /machine/settings and all three have limits
     * rows — the one leaf where the door and the table line up completely. */
    Object.freeze({
        id: 'machine-flush-temp',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushTemp',
        limit: 'flushTemp',
        heading: 'Temperature for flush cycles',
    }),
    Object.freeze({
        id: 'machine-flush-flow',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushFlow',
        limit: 'flushFlow',
        heading: 'Flush flow rate',
    }),
    Object.freeze({
        id: 'machine-flush-duration',
        leaf: 'machine-flush',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flushTimeout',
        limit: 'flushDuration',
        /* Ben, 26 August 2026: "Keep it but remove the 0 = no flush. It's a button the
         * user needs to press, no point turning it off. Call it Duration." Both halves
         * are here and in `machine-limits.js`: the heading is the word he asked for, and
         * the zero meaning is gone from the range hint. */
        heading: 'Duration',
    }),

    /* WATER TANK. The tank TEMPERATURE is here from 24 Aug 2026 and its absence was a
     * decision this file records rather than hides: `machine-limits.js` refused it a
     * range because every profile load rewrites the value. That is still true, and the
     * remedy is the CAPTION rather than the empty leaf — see the row's own note and the
     * `tankTemp` paragraph in the limits table. The display unit is machine-scoped and
     * routed. */
    /* THE PREHEAT SWITCH, AND IT IS OFF BY DEFAULT.
     *
     * Ben, 26 August 2026, with the words for the caption: "Turning this on preheats the
     * tank, which can help with flow rates above 6 mL/s. Not recommended under most
     * circumstances." A setting that is not recommended has to say so on the page, or the
     * only place it says so is a conversation.
     *
     * IT GATES THE TWO ROWS BELOW IT rather than hiding them, the same shape steam's
     * switch uses: the tank temperature the machine will use when preheat is switched on
     * is still a real number, and a hidden control cannot be read before it is needed. */
    Object.freeze({
        id: 'machine-water-tank-preheat',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'tankTemp',
        /* THE SAME MECHANISM AS STEAM'S SWITCH, over the same kind of field: the tank
         * row's range carried `zeroMeans: 'no tank heating'` until this switch existed to
         * say it in a control. Off writes 0; on writes back the remembered temperature. */
        zeroSwitch: 'tankTempWhenOn',
        heading: 'Preheat water tank',
        /* BEN'S OWN SENTENCE, WITH THE NUMBER SPELLED AS A WORD.
         *
         * He wrote "above 6 mL/s". The B2/R2 guard (`test/settings-leaves.test.mjs`)
         * refuses ANY unit-bearing numeral in this file, and it is right to: a range typed
         * into a caption is exactly how a page ends up claiming a band its control does
         * not have — the "stated range" finding, in one string. The fact is his and stays;
         * only the spelling moves, so the guard keeps its teeth. */
        caption: 'Turning this on preheats the tank, which can help with flow rates above six millilitres a second. Not recommended under most circumstances.',
    }),
    Object.freeze({
        id: 'machine-water-tank-temp',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'tankTemp',
        limit: 'tankTemp',
        heading: 'Tank heater temperature',
        caption: 'Loading a profile overwrites this with the profile’s own tank temperature.',
        enabledBy: 'machine-water-tank-preheat',
    }),
    /* THE LOW-WATER ALERT, RESTORED. Slate has it (settings.js:4641-4672, "Water level",
     * 0-30 mm in steps of 5) and Decal dropped it, which left no way to tune when the
     * machine warns that the tank is running out.
     *
     * ITS DOOR IS NOT A DOCUMENT. Every other machine row on this page is a field of a
     * settings document that is READ over REST; `refillLevel` is written over
     * `POST /api/v1/machine/waterLevels` and read back only on the
     * `/ws/v1/machine/waterLevels` socket, which is why `waterLevelsDoorFor` in
     * machine-fields-port.js takes the live feed as its read side. `storage-routes.js`
     * already named ReaPrime the owner of this value and refused it a local store; this
     * row is the control that owner was waiting for.
     *
     * NOT gated by the preheat switch: the alert is about the level in the tank, not
     * about heating it, and it stays useful with the heater off. */
    Object.freeze({
        id: 'machine-water-tank-alert',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'refillLevel',
        limit: 'waterAlertLevel',
        heading: 'Water level',
        /* AND THE CAPTION SAYS WHAT ZERO DOES, which `machine-limits.js` had promised on
         * this row's behalf and nothing delivered. Its paragraph argues that zero is a real
         * setting meaning "no alert" and that "the caption says so rather than the range
         * hint, because '0 = no alert' beside a height reads as a height" — and the caption
         * said only the first sentence. A comment asserting copy that does not exist is the
         * same broken half as a control with no reader.
         *
         * "ZERO" AS A WORD, not as a numeral: `test/settings-leaves.test.mjs` refuses a
         * unit-bearing numeral anywhere in this file, and it is right to — a range typed
         * into a caption is how a page comes to claim a band its control does not have. */
        caption: 'Alert when the tank water level drops below this height. Zero turns the alert off.',
    }),
    Object.freeze({
        id: 'machine-water-tank-unit',
        leaf: 'machine-water-tank',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'waterTankUnit',
        heading: 'Measurement units',
        /* THE SHORT UNITS, ON BEN'S RULING (26 Aug 2026): "mm and mL not millimetres and
         * millilitres." The buttons already say mm and mL, so the sentence above them
         * spelling the words in full was the page teaching two vocabularies for one
         * choice. Slate's own sentence spells "millimeters" then "millilitres" — one
         * word in each spelling — which is the argument in miniature. Where the setting
         * takes effect is Slate's ("on the home screen") and is kept. */
        caption: 'Show tank level on the home screen in mm or mL.',
        items: Object.freeze([
            Object.freeze({ value: 'mm', label: 'mm' }),
            Object.freeze({ value: 'ml', label: 'mL' }),
        ]),
    }),

    /* ADVANCED. SIX MACHINE ROWS AND TWO PROVISIONAL FLAGS, and until 24 Aug 2026 it
     * was the two flags alone — a leaf whose overlap with Slate's own Advanced page was
     * EMPTY, because Slate's four heater numbers and two enums all live on
     * `POST /machine/settings/advanced` and nothing in this skin called it.
     *
     * The client had `readAdvancedSettings` and `writeAdvancedSettings` from wave 0b.
     * What was missing was a DOOR in `machine-fields-port.js` and a RANGE for the four
     * numbers; both are now there, and the ranges' provenance (Slate's own inputs, not a
     * handler and not an MMR) is written at the rows in `machine-limits.js`.
     *
     * THE TWO ENUMS on that same route are on the Calibration leaves Slate puts them on
     * — `calibration-voltage` and `calibration-refill-kit` — and each carries the enum
     * that unblocked it. */
    Object.freeze({
        id: 'machine-advanced-heater-ph1-flow',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh1Flow',
        limit: 'heaterPh1Flow',
        heading: 'Heater phase 1 flow',
        /* Ben's own sentence, 26 August 2026. It replaces "Water flow while the group
         * heats from cold", which described the phase rather than the flow. */
        caption: 'The flow rate that warms the heater up from idle temperature.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-ph2-flow',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh2Flow',
        limit: 'heaterPh2Flow',
        heading: 'Heater phase 2 flow',
        caption: 'The flow rate that adjusts water temperature so the shot starts on target.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-ph2-timeout',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterPh2Timeout',
        limit: 'heaterPh2Timeout',
        heading: 'Heater phase 2 timeout',
        caption: 'The longest phase 2 can run for. A longer time improves temperature control.',
    }),
    Object.freeze({
        id: 'machine-advanced-heater-idle-temp',
        leaf: 'machine-advanced',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'heaterIdleTemp',
        limit: 'heaterIdleTemp',
        heading: 'Heater idle temperature',
        caption: 'What the water heater holds between shots.',
    }),
    /* THE TWO EXPERIMENTAL SWITCHES ARE GONE FROM THE PAGE AND NOT FROM THE SKIN.
     *
     * Ben, 26 August 2026: "Remove the fused channels and collapse detection but keep
     * these settings on and hidden." So the ROWS are deleted — nothing draws them, and a
     * deleted row is the only honest way to say "not a control" — while the two keys stay
     * in `storage-routes.js` and keep answering `settings.value(...)` for whatever reads
     * them. `settings-defaults.js` is what decides they read as ON.
     *
     * WHY DELETE RATHER THAN GATE: a gated row is a row with a condition, and the
     * condition here would be the constant false. A control nobody can ever reach is the
     * defect class this fork exists to remove, not an implementation of "hidden".
     */

    /* SLEEP AND WAKE — THE POLICY, IN ROWS. The SCHEDULES beside these are a list and
     * stay bespoke; these two were hand-drawn controls sitting above that list, in a card,
     * which is what Ben's "the card layout is not like the rest of the settings, needs a
     * rewrite" was about. `presenceDoorFor` is what lets them be rows.
     *
     * "AUTOMATIC SLEEP", NOT "PRESENCE DETECTION". The field is `userPresenceEnabled` and
     * the old heading said so, which named the mechanism to a reader who wanted the
     * effect. Ben's own words are the heading and the caption: "a toggle, on/off, puts the
     * machine to sleep after a period of inactivity". */
    Object.freeze({
        id: 'machine-sleep-auto',
        leaf: 'machine-sleep-wake-schedules',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'autoSleepEnabled',
        capability: 'wakeSchedule',
        heading: 'Automatic sleep',
        caption: 'Puts the machine to sleep after a period without use.',
    }),
    Object.freeze({
        id: 'machine-sleep-after',
        leaf: 'machine-sleep-wake-schedules',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'sleepAfterMinutes',
        limit: 'sleepAfter',
        capability: 'wakeSchedule',
        heading: 'Sleep after',
        caption: 'Time without use before the machine sleeps.',
        enabledBy: 'machine-sleep-auto',
    }),

    /* ---- Accessories --------------------------------------------------------
     * CUP WARMER. A3 IS THE ROUTE'S OWN ANSWER HERE, not a row's `capability`, and that
     * changed on 26 August 2026 — see the paragraph below the next one for the whole
     * argument. The short version: `gateCapability` fails closed on UNKNOWN as well as
     * ABSENT, so a capability on some of these rows and not others produced a page about a
     * warmer with no warmer on it every time the list was slow. `cup-warmer.js` publishes
     * `status: UNSUPPORTED` on the handler's own 404 and every field goes absent with it,
     * which is the stronger answer and the one the store calls authoritative.
     *
     * NO RANGE, ON PURPOSE. `src/stores/cup-warmer.js` states it: "The 0-80 whole-degree
     * range is NOT re-validated here: the handler answers a typed 400 and the refusal is
     * the server's to make (B9). A second copy of a range is a…". The stepper is
     * unbounded and the machine refuses what it will not take. */
    /* FOUR ROWS IN SLATE'S ORDER, AND THE PAGE HAS NO BESPOKE HALF ANY MORE.
     *
     * Ben, 26 August 2026, took Slate's arrangement on this leaf — enable, then the
     * target, then the pre-warm pair — dropped Slate's live mat reading ("remove the live
     * readout"), and ruled the pre-warm ungated ("every Bengle supports it, so show it as
     * a toggle rather than gating it"). What was here was one registry row for a
     * REMEMBERED target with three hand-drawn controls under it, in the other order,
     * behind a capability gate.
     *
     * THE SWITCH IS THE TEMPERATURE, as on steam and the water tank: the machine holds a
     * setpoint of zero while the mat is off (`cup-warmer.js`: "the machine holds only the
     * live value (0 when off)"), so `cupWarmerTarget` in the KV store is what to come
     * back to and the machine field is the setting. `cupWarmerDoorFor` carries both
     * routes.
     *
     * THE CAPABILITY GATE IS GONE FROM THE PRE-WARM ROWS and the row that named it is
     * why: A3 exists so a control cannot claim a machine can do something it cannot, and
     * on this machine it can. A gate whose answer is always the same is a gate that only
     * ever hides a working control — against the mock, whose capability route answers 503
     * by design, it hid both rows on every machine.
     *
     * AND IT IS NOW GONE FROM THE OTHER THREE, because the gate was SPLIT and one leaf must
     * have one verdict. Three rows carried `capability: 'cupWarmer'` and two did not, on a
     * leaf served by one route pair — and `gateCapability` fails closed on UNKNOWN as well
     * as ABSENT, so on any machine whose capability list had not landed this page rendered
     * ONLY "Pre-warm before wake-up" and "Start this long before". A page about a warmer
     * with no warmer on it. The argument that killed the pre-warm gate applies word for word
     * to the rest: `GET /machine/capabilities` returns `cupWarmer` and `preheat` TOGETHER
     * for any `BengleInterface` and 404s both routes together for anything else
     * (`de1handler.dart:38-54, :632-637`), so there is no machine on which three of these
     * rows belong and two do not.
     *
     * WHAT GATES THE LEAF INSTEAD IS THE ROUTE'S OWN ANSWER, which is the honest one and the
     * one `cup-warmer.js` calls authoritative: the store publishes `status: UNSUPPORTED` on
     * a 404 and every field goes absent with it, so a machine with no warmer draws a page of
     * dashes rather than a page of confident numbers. The pre-warm pair goes further and
     * draws INERT with a sentence, because "the firmware cannot do this" is a different
     * statement from "the machine has not answered" — see `supportedBy` below. */
    Object.freeze({
        id: 'accessories-cup-warmer-enabled',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'cupWarmerTemperature',
        zeroSwitch: 'cupWarmerTarget',
        /* WHERE THE MACHINE'S OWN REMEMBERED TARGET LIVES, so switching back on can ask
         * the machine before it asks a shipped default (audit F-049, Ben's D09).
         *
         * A `zeroSwitch` row's `field` reads ZERO while the switch is off — that is what
         * "off" means to the machine and to `checkedFor`. For steam and the water tank the
         * zero IS the whole state and there is nothing else to consult. The cup warmer is
         * the exception: its off is a separate `enabled` flag, so the mat keeps its
         * setpoint and `machine-fields-port.js` publishes it here under its own name.
         * MEASURED: a warmer holding 70 with `enabled:false`, switched on from the glass,
         * was written 60 — `STORED_DEFAULTS.cupWarmerTarget` answering before the machine.
         *
         * ONLY THE RESTORE LADDER READS IT. It is not a row, not a control and not
         * writable; a row that declares no `heldField` simply skips that rung. */
        heldField: 'cupWarmerHeldTarget',
        heading: 'Enable cup warmer',
        caption: 'Warm the cups on the top of the machine.',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-target',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'cupWarmerTemperature',
        limit: 'cupWarmerTarget',
        heading: 'Target temperature',
        enabledBy: 'accessories-cup-warmer-enabled',
    }),
    /* THE PLATE'S OWN TEMPERATURE, AND IT WENT MISSING TWICE OVER.
     *
     * Slate prints it as its own row — 'Current temperature / Live temperature of the
     * cup-warming plate' — and it is the row that answers the only question this page
     * cannot answer from its controls: are the cups warm yet.
     *
     * IT WAS LOST, AND THEN IT WAS WORSE THAN LOST. The 26 August rebuild dropped the
     * card that had carried it, and nothing took the reading. Photographing the page
     * beside Slate's found that, and found the reason it had gone unnoticed: the cup
     * warmer DOOR was reading `currentTemperature` — this value — and handing it over as
     * the SETPOINT, so the Target temperature stepper had been displaying the live plate
     * reading all along. One row absent, one row wrong, one wire.
     *
     * A READING, NOT A CONTROL. The machine owns the number and nothing here sets it.
     * Null is a normal answer (the interface types it `Future<double?>` and the machine
     * returns null whenever the warmer is off), so the row draws the absence dash rather
     * than a zero — a cold plate and a plate not reporting are different states. */
    Object.freeze({
        id: 'accessories-cup-warmer-now',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.READING,
        source: SOURCE.MACHINE,
        field: 'cupWarmerCurrentTemperature',
        heading: 'Current temperature',
        caption: 'Live temperature of the cup-warming plate.',
        /* AND IT CARRIES A UNIT, WHICH IS THE ONLY THING A READING ROW NEEDS ONE FOR.
         *
         * The row shipped with no `limit` and no `unit`, and three things followed from
         * that single absence: `#readingFormat` returned undefined so the number printed
         * bare, with no degree sign; `isTemperatureRow` decides temperature-ness FROM THE
         * LIMITS ROW and answered false, so the reading was never converted while the Target
         * stepper directly above it converted to Fahrenheit — two numbers on one page in two
         * different units; and Slate's 0.1 °C resolution was kept or lost by accident,
         * depending on what the machine happened to send.
         *
         * A LIMIT WOULD BE WRONG HERE. Nothing sets this value, so it has no band to clamp
         * against and inventing one would be the second ranges table by another route. The
         * unit alone is what `isTemperatureRow` falls through to, and it is what
         * `boundsFor` carries to the display. */
        unit: '°C',
    }),
    /* THE PRE-WARM PAIR, AND THE FIRMWARE MAY SIMPLY NOT HAVE IT.
     *
     * `supportedBy` NAMES THE ANSWER THE STORE ALREADY HAD. `cup-warmer.js` sets
     * `preheatSupported` true / false / null from the pre-heat route's OWN 404 — a stronger
     * answer than the capability list, and stronger than Slate's, which infers support from
     * the shape of a payload — and nothing outside the store read it. Meanwhile
     * `MACHINE_FALLBACKS` carried `cupWarmerPreheatEnabled: true`, so on a machine that had
     * 404'd that route the switch painted ON, its lead stepper was live, and there was no
     * caveat anywhere on the page. That is a control claiming a machine does something it
     * cannot, which is the whole of what A3 exists to prevent; the fallback is deleted and
     * this is what replaces it.
     *
     * THE SENTENCE IS SLATE'S OWN (settings.js:3674-3676), because Slate got this right and
     * there is nothing to improve about it: it names the cause and it names the remedy.
     *
     * ONLY `false` DISABLES. Null is "the route has not been asked yet", and a page that
     * greyed a control while the answer was in flight would flicker on every open. */
    Object.freeze({
        id: 'accessories-cup-warmer-prewarm',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'cupWarmerPreheatEnabled',
        heading: 'Pre-warm before wake-up',
        caption: 'The mat starts ahead of the time the machine is due to wake.',
        supportedBy: 'cupWarmerPreheatSupported',
        unsupportedNote: 'This machine’s firmware doesn’t support pre-warm — update the firmware to use it.',
    }),
    Object.freeze({
        id: 'accessories-cup-warmer-prewarm-lead',
        leaf: 'accessories-cup-warmer',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'cupWarmerPreheatLead',
        limit: 'preWarmLead',
        heading: 'Start this long before',
        enabledBy: 'accessories-cup-warmer-prewarm',
        /* THE SAME VETO, AND NO SECOND SENTENCE. The switch above says why once; repeating
         * it under the stepper would print the caveat twice on one page. */
        supportedBy: 'cupWarmerPreheatSupported',
    }),

    /* USB CHARGER. `usb` reads as a bool and writes as the string 'enable' — the
     * asymmetry is encoded at the data boundary (`rea-de1-settings.js`) and nothing
     * above it ever spells 'enable'. Here it is a switch and nothing else. */
    Object.freeze({
        id: 'accessories-usb-charger-power',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'usb',
        heading: 'USB power',
        caption: 'Charge a phone or a scale from the machine.',
    }),
    /* THE OTHER THREE ARE THE TABLET'S BATTERY, NOT THE MACHINE'S SOCKET, and the split
     * is why one of the four could be built and three could not: `usb` above is a DE1
     * field on `/machine/settings`, while charging mode, night mode and the low-battery
     * dim are ReaPrime's own preferences on `/api/v1/settings` — a document this skin had
     * no client for. One leaf, two documents, and `machine-fields-port.js` decides which.
     *
     * `ChargingMode`, verbatim from `lib/src/settings/charging_mode.dart:3`:
     * `{ disabled, longevity, balanced, highAvailability }`. ORDERED HERE BY CEILING
     * rather than by the enum, because a user choosing how hard to charge is choosing a
     * point on one scale and the enum's own order is not that scale.
     *
     * THE PERCENTAGES ARE DELIBERATELY NOT IN THE LABELS, and this is B2 rather than
     * squeamishness. Slate labels the four "Charge to 100% / 95% / 80% / 55%", and those
     * numbers are REAL — they are the top of each hysteresis band in
     * `charging_logic.dart:174-179` (`longevity => (45, 55)`, `balanced => (40, 80)`,
     * `highAvailability => (80, 95)`, `disabled => (0, 100)`). They are also ReaPrime's to
     * change, they are a PAIR rather than a single number, and nothing in this skin would
     * notice the day that switch is retuned. A label restating a band the server owns is
     * the second ranges table wearing a word, so the labels describe the CHOICE and the
     * numbers stay where they are computed.
     *
     * A SELECT, NOT A BANK. Four options whose labels are a phrase each; the bank is for
     * two to four SHORT choices and this is the case #7 exists for. */
    /* "BATTERY SAVER", THREE SETTINGS, AND THE PERCENTAGES ARE BACK IN THE LABELS.
     *
     * Ben, 26 August 2026: "Charging mode should be called Battery Saver and have three
     * settings, Off, 80% and 55%. Lower prolongs the battery life and protects the
     * tablet."
     *
     * THIS REVERSES THE PARAGRAPH ABOVE, WHICH IS STILL WORTH READING. It argued that a
     * label restating 80 or 55 is a second ranges table wearing a word: those numbers are
     * the top of a hysteresis PAIR in ReaPrime's `charging_logic.dart:174-179`
     * (`longevity => (45, 55)`, `balanced => (40, 80)`), they are ReaPrime's to retune,
     * and nothing here would notice the day they moved. All of that is true.
     *
     * WHAT IT MISSED is that the labels it chose instead — "Balanced", "Keep it ready" —
     * told the user nothing they could act on. A person choosing a charge limit is
     * choosing a number, and the audit measured the cost: the capture showed a collapsed
     * select reading "Balanced" with no percentage anywhere on the page. A label that
     * names no number is not safer than one that names a number the server might change;
     * it is just less useful, every day, against a change that has not happened.
     *
     * SO THE NUMBER IS THE LABEL AND THE RISK IS WRITTEN DOWN HERE. If ReaPrime retunes a
     * band, this table is what needs the edit, and this paragraph is what says so.
     *
     * THREE OF ReaPrime'S FOUR. `highAvailability` (80, 95) is not offered: it charges
     * harder than Off in the range that matters and answers no question Ben's three do
     * not. A machine already set to it keeps it — the bank simply shows no selection,
     * which is honest, and any choice here moves it to one of the three.
     *
     * A BANK, NOT A SELECT. Three short labels is what #3 is for; a collapsed select was
     * hiding two of the three choices behind a tap. */
    Object.freeze({
        id: 'accessories-usb-charger-mode',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'chargingMode',
        heading: 'Battery Saver',
        caption: 'The charge limit for the tablet. A lower limit prolongs the battery’s life and protects the tablet.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Off' }),
            Object.freeze({ value: 'balanced', label: '80%' }),
            Object.freeze({ value: 'longevity', label: '55%' }),
        ]),
    }),
    /* THE SWITCH IS A ROW AND THE TWO TIMES ARE NOT, and that is a layout fact rather
     * than a policy: a minute-of-day is chosen on a clock face, `<ui-time-picker>` is a
     * dialog body, and #29 has one control slot. The bespoke half of this leaf owns the
     * two time buttons and the dialog; this row owns whether they apply at all. */
    /* THE DIM SWITCH MOVED ABOVE NIGHT MODE (26 Aug 2026), and it is a GROUPING fix.
     *
     * Registry rows draw first and the bespoke half draws after all of them, so the page
     * read: USB power -> Battery Saver -> Night mode -> Dim the screen -> [Sleep / Morning]
     * -> Charging status. The two times sat below an unrelated setting, with nothing to say
     * they belonged to the switch three rows up. Slate nests them directly under the Night
     * mode toggle (`settings.js:1663-1667`). Night mode is now the LAST registry row on this
     * leaf, so the bespoke times land immediately beneath it. */
    Object.freeze({
        id: 'accessories-usb-charger-dim',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'lowBatteryBrightnessLimit',
        heading: 'Dim the screen when the battery is low',
    }),
    /* AND NIGHT MODE DOES NOTHING WITH BATTERY SAVER OFF, so it says so instead of
     * pretending.
     *
     * ReaPrime's `charging_logic.dart:123-129` returns early on `ChargingMode.disabled` with
     * `nightPhase: NightPhase.inactive` BEFORE it looks at the night-mode config at all. So
     * with Battery Saver set to Off, this switch and its two times changed nothing on the
     * machine — a dead setting, which is the defect class this fork exists to remove. Slate
     * already had the right answer: it renders the whole night-mode section only when
     * `chargingMode !== 'disabled'` (`settings.js:1643`).
     *
     * INERT RATHER THAN HIDDEN, which is where this departs from Slate and follows Ben's own
     * rule for the tank ("while it is off the settings below grey out and read '−'"): the
     * setting is still real and is still what the machine will use the moment Battery Saver
     * is turned back on, and a control that vanishes looks like one that was deleted. The
     * negated gate is `{row, not}` — see `gateSaysInert`. */
    Object.freeze({
        id: 'accessories-usb-charger-night',
        leaf: 'accessories-usb-charger',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'nightModeEnabled',
        heading: 'Night mode',
        caption: 'Charge conservatively between a sleep time and a morning time.',
        enabledBy: Object.freeze({ row: 'accessories-usb-charger-mode', not: 'disabled' }),
    }),

    /* ---- Connection ---------------------------------------------------------
     * The address of the ReaPrime this browser talks to. Device-scoped by necessity:
     * "Cannot live in the store it addresses." */
    Object.freeze({
        id: 'connection-machine-host',
        leaf: 'connection-machine',
        archetype: ARCHETYPE.TEXT,
        source: SOURCE.ROUTE,
        key: 'reaHostname',
        heading: 'ReaPrime address',
        /* AND IT SAYS WHEN IT TAKES EFFECT, because it does not take effect now.
         *
         * The key was read by NOTHING until 26 August 2026 — the field accepted an address,
         * stored it, and the tablet kept talking to the host that served the page.
         * `bootFromWindow` reads it now, which is the one function allowed to touch ambient
         * state and the only place that can: the router's KV layers are addressed AT the
         * machine this value names.
         *
         * The base URL and the socket origin are composed once, at construction, so
         * re-pointing a live app mid-session would leave every open socket on the old
         * machine. A person who types an address and sees nothing happen has been told
         * nothing; a person who reads this knows to reload. */
        caption: 'Where this tablet looks for the machine. Blank means this page’s own host. Takes effect the next time this page loads.',
    }),
    /* 'LAST SCALE USED' IS GONE (26 August 2026), and it went for two reasons at once.
     *
     * IT COULD NEVER HAVE BEEN RIGHT. The row was a READING over `scaleDeviceId`, and
     * nothing anywhere in `src/` ever wrote that key — so it printed the absence dash on
     * every machine, for ever. A reading whose value has no writer is the same finished
     * half as a control whose value has no reader, seen from the other side. Found by the
     * sweep that also found the brightness slider and the ReaPrime address.
     *
     * AND IT IS REDUNDANT NOW. The row was written when this page had no device list, and
     * its own note said so: "what this leaf can honestly say is which scale this tablet
     * used last, or nothing at all." The leaf lists every remembered scale by name and
     * address, with its state and its preferred toggle, and it has done since Ben's
     * connection-page pass earlier the same day. Making the key work would have put a
     * fourth answer to the same question above a list that answers it better.
     *
     * The routing row stays, marked retired — see `storage-routes.js`. */
    /* SCALE POWER AND THE SHOT BLOCK. Both are REAPRIME's, not the machine's and not this
     * skin's, and that third owner is why they read as absent for so long: the skin had a
     * generated route row for `GET/POST /api/v1/settings` and no client behind it.
     *
     * `blockOnNoScale` IS ENFORCED BY THE SERVER, which is what makes it worth having
     * here rather than as a skin preference: `_requestStateHandler` reads it before it
     * lets a state request through, so it refuses a shot whether or not any skin
     * remembers asking for it. A local copy of that switch would be a second answer to a
     * question the server already answers. */
    Object.freeze({
        id: 'connection-scale-power-mode',
        leaf: 'connection-scale',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'scalePowerMode',
        heading: 'When the machine sleeps',
        caption: 'What happens to a connected scale.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Nothing' }),
            Object.freeze({ value: 'displayOff', label: 'Display Off' }),
            Object.freeze({ value: 'disconnect', label: 'Disconnect' }),
        ]),
    }),
    Object.freeze({
        id: 'connection-scale-required',
        leaf: 'connection-scale',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'blockOnNoScale',
        heading: 'Scale required',
        caption: 'The machine refuses to start a shot with no scale connected.',
    }),

    /* ---- Calibration --------------------------------------------------------
     * FAN THRESHOLD, AND ITS BAND IS MACHINE-DEPENDENT SINCE 27 AUGUST 2026 — Bengle
     * 40-60, DE1 whatever ReaPrime declares (Ben: "lets increase it this in the decal
     * for Bengle and do what ever reaprime has for the DE1"). It was one band for both
     * (30-70, Ben, 26 Aug, point 129) and before that 0-50 read straight off
     * `MMRItem.fanThreshold`, while the old page clamped 0..100 and printed a percentage
     * over a caption that said °C. One row, one range, one unit — and T7's "second, live
     * Fan implementation" has nowhere to live.
     *
     * THE ROW ITSELF DID NOT CHANGE AND THAT IS THE POINT OF B2. It names `fanThreshold`
     * and the table answers with the band for whichever machine is connected, exactly as
     * `machine-steam-temperature` has since B3. A per-machine `machines` gate here would
     * be the wrong instrument: both classes HAVE a fan threshold, they disagree about its
     * range, and a range is the limits table's business.
     *
     * READ `FAN_THRESHOLD_BY_MACHINE_CLASS` IN `machine-limits.js` BEFORE QUOTING THE
     * BENGLE'S 60 TO ANYONE. ReaPrime clamps every write of this field to 50 on every
     * machine, Bengle included, so the top ten degrees of the band do not reach the
     * machine until ReaPrime's own bound moves. The whole chain is written out there.
     *
     * NO LIVE TEMPERATURE, AND THAT IS AN ANSWER RATHER THAN AN OMISSION. Ben asked for
     * one "if we can get the temperature that drives the fan", and doubted we could. We
     * cannot: the fan runs off the DE1's own board temperature, and `SNAPSHOT_KEYS`
     * (rea-names.js) carries twelve channels — flow, pressure, the two targets, mix,
     * group, steam and the frame — with no board or ambient reading among them. Nothing
     * on any served route reports it. Printing the group temperature beside a fan
     * threshold would be a number that looks like evidence and is not. */
    Object.freeze({
        id: 'calibration-fan-threshold',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'fan',
        limit: 'fanThreshold',
        heading: 'Fan turns on at',
        caption: 'The fan runs above this temperature.',
    }),

    /* MAINS VOLTAGE. The leaf was EMPTY and the refusal was right: "the int mapping for
     * 110 / 220 is not written down on this side; writing a guessed enum to a heater is
     * not a reversible mistake." It is written down on the OTHER side, and reading it is
     * what closed this (`de1_interface.dart` at the pin):
     *
     *   enum De1HeaterVoltage { v110(120), v220(230), unset(-1) }
     *
     * THE WIRE VALUE IS VOLTS, NOT AN INDEX — which is exactly the mistake a guess would
     * have made. `fromInt` accepts a band either side (90..150 -> v110, 180..260 ->
     * v220) and subtracts 1000 first, because the MMR's own description is "Nominal
     * Heater Voltage (0, 120V or 230V). +1000 if it is a set value". `GET
     * /machine/settings/advanced` answers `.voltage`, so a machine nobody has told reads
     * -1, NO option is selected, and the leaf says nothing rather than guessing 110.
     *
     * NOTHING CHANGES UNTIL THE MACHINE RESTARTS. Slate prints that as a notice; here it
     * is the caption, because it is true of the setting and not of the moment. */
    Object.freeze({
        id: 'calibration-voltage-mains',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'heaterVoltage',
        heading: 'Mains voltage',
        /* THE LEAF'S HEADLINE SCALAR, ON ITS NAV ROW (Slate's S20, `settings.js:6367`).
         * One nominated row per leaf and no second table: the flag IS the declaration, and
         * `navSummary(leafId)` on the leaf model is its only reader. A bank summarises as
         * the LABEL of the item its value names — '220V', not 230 — so the nav row and the
         * control it stands for print the same words. */
        navSummary: true,
        /* SLATE'S SENTENCE, ON BEN'S RULING (26 Aug 2026, point 123). Decal's own read
         * better as prose — "Match your supply. Nothing changes until the machine
         * restarts." — but it dropped the CONSEQUENCE, and the consequence is the reason
         * the page exists: a wrong voltage is a heater problem, not a display problem.
         * The restart sentence rides on the second line rather than being lost. */
        caption: 'Set to match your local mains voltage. An incorrect setting may affect heater performance. Nothing changes until the machine restarts.',
        /* THE MEASURED MAINS, BESIDE THE CHOICE IT IS EVIDENCE FOR.
         *
         * Slate's own comment states the finding and the rule (P18, settings.js:5143):
         * the page "asks you to pick a mains voltage, and warns that a wrong choice may
         * affect heater performance, [but] showed no measured mains, although Machine Info
         * displays it two sub-nav lists away. Reported, never auto-selected: the reading
         * is evidence for the user's choice, not the choice itself, and a machine mid-heat
         * can read well off nominal."
         *
         * `readingField` RATHER THAN `live`: this is not a snapshot channel. It comes from
         * `GET /machine/info`, through the machine-info door, and arrives with the rest of
         * the machine document — so it is read once per page open like every other machine
         * value, not polled. */
        readingField: 'measuredVoltage',
        readingLabel: 'Measured at the machine',
        readingUnit: 'V',
        /* THE THIRD STATE THE TWO ITEMS CANNOT EXPRESS. `De1HeaterVoltage` has a member
         * this bank deliberately does not offer — `unset(-1)` — and a machine nobody has
         * told answers exactly that. Two segments, neither pressed, and until 27 August
         * 2026 nothing anywhere on the page said why: a bank drawing no selection with
         * nothing said is indistinguishable from a bank that failed to render.
         *
         * NOT A THIRD ITEM, and that is the point of putting it here instead. "Unset" is
         * not a voltage a user can choose — writing it back would be asking a heater to run
         * on nothing — so it must be sayable without being selectable. Slate's own
         * `unsetNote` (`settings.js:5138`) reads "No voltage set yet — select your mains
         * voltage"; this keeps its two halves, the fact and the instruction, and points at
         * the supply rather than at the control, because the measured mains is printed
         * directly above as the evidence for the choice. */
        emptyNote: 'No voltage set yet — choose the one that matches your supply.',
        items: Object.freeze([
            Object.freeze({ value: 120, label: '110V' }),
            Object.freeze({ value: 230, label: '220V' }),
        ]),
    }),
    /* REFILL KIT. Same door, same kind of refusal, same answer:
     *
     *   enum De1RefillKitSettings { auto(2), forceOn(1), forceOff(0) }
     *
     * AND THE HANDLER HAS NO `orElse`: it resolves the int with
     * `values.firstWhere((e) => e.hex == parseInt(...))`, which THROWS on anything
     * outside {0,1,2} and answers 500. Offering exactly these three is what keeps that
     * unreachable — a fourth option here would be a server error, not a rejected value. */
    Object.freeze({
        id: 'calibration-refill-kit-mode',
        leaf: 'calibration-hardware',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'refillKitSetting',
        heading: 'Refill kit mode',
        /* "ALWAYS" IS THE WORD THAT SEPARATES FORCE ON FROM AUTO, and dropping it left the
         * three options describing two states. "Force On keeps the refill kit active" is
         * exactly what a reader would assume Auto does as well — the difference is not that
         * Force On turns it on, it is that Force On stops the machine deciding. Slate's
         * sentence (`settings.js:5120`) carries it and there is no reason here to depart
         * from the charter default. */
        caption: 'Auto lets the machine decide. Force On keeps the refill kit always active; Force Off disables it.',
        items: Object.freeze([
            Object.freeze({ value: 2, label: 'Auto-Detect' }),
            Object.freeze({ value: 1, label: 'Force On' }),
            Object.freeze({ value: 0, label: 'Force Off' }),
        ]),
    }),
    /* D9's FIRST HALF — "expose the flow-calibration factor" (Part 5 §4). THE ROW BELOW,
     * and this block sat sixty lines up describing a row that was no longer under it until
     * 27 August 2026. A comment with no subject is the same defect class as a function with
     * no caller: nothing keeps it true, and this one had already stopped being true.
     *
     * A PLAIN STEPPER ON #29, and it is the load-bearing half of the one-primitive claim:
     * the value comes from a DIFFERENT machine document (GET/POST /api/v1/machine/
     * calibration, `{flowMultiplier}`) than every other `source: MACHINE` row, and the row
     * cannot tell. `src/stores/machine-fields-port.js` holds the field -> door table and
     * the model still sees one port, so a second document did not cost a second row shape,
     * a second source or a second renderer branch.
     *
     * THE SERVER DECLARES NO BAND AND THIS SKIN DOES. `de1handler.dart:472-491` parses the
     * body with `parseDouble` and hands it straight to `setFlowEstimation` — no min, no
     * max, no step, no 400. The block that used to sit here concluded from that "the row
     * carries a UNIT and no `limit`", and that has NOT been true since the row gained
     * `limit: 'flowCalibration'` two lines below: the band is 0.5..2 and it is this skin's
     * statement, exactly as `appFlowMultiplier`'s ceiling is. `defaults.dart:120` resets it
     * to 1.0, which is a default, not a bound. */
    Object.freeze({
        id: 'calibration-flow-multiplier-factor',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'flowMultiplier',
        limit: 'flowCalibration',
        /* DE1 ONLY, ON BEN'S OWN HARDWARE FACT (27 August 2026): "Bengle's pumps dont have
         * any need for flow calibration, its delievers perfect accurate flow, the DE1
         * didn't and needed these calibration values to get it running. That is why I
         * wanted it to be removed."
         *
         * THIS IS THE ROW HIS SENTENCE IS ACTUALLY ABOUT. `flowMultiplier` is the machine's
         * own `calFlowEst` on `GET/POST /machine/calibration` — a correction applied to a
         * flow the machine measures badly — and he owns that machine, so the claim is his
         * to make and there is nothing here to verify it against.
         *
         * A `machines` GATE AND NOT A DELETION, because the setting is real on the other
         * class: `defaults.dart:120` resets it to 1.0 on any machine and Slate ships the
         * control. Deleting the row would take it from a DE1 owner as well. */
        machines: Object.freeze(['de1']),
        heading: 'Flow calibration',
        caption: 'Scales the machine’s flow estimate. 1 is uncalibrated.',
    }),
    /* THE TWO APP-SIDE MULTIPLIERS, and this leaf is now a SUPERSET of Slate's rather
     * than a substitution for it. The row above is the MACHINE's flow estimate
     * (`GET/POST /machine/calibration`) and is not one of Slate's two; these two are
     * Slate's, on `GET/POST /api/v1/settings`, and they were unadopted because this skin
     * had no client for that document at all. `rea-app-settings.js` is that client.
     *
     * BOTH ARE SECONDS, NOT GAINS, AND THAT IS THE MOST SERIOUS THING ON THIS PAGE. Read at
     * the pin, `shot_sequencer.dart` computes
     *
     *     projectedWeight = currentWeight + (weightFlow * _weightFlowMultiplier)   :432-433
     *     projectedVolume = _accumulatedVolume + (machine.flow * _volumeFlowMultiplier)
     *                                                                              :460-461
     *
     * and flow is a per-second RATE in both. A rate times a number that gives a mass or a
     * volume is a TIME. ReaPrime names the identical construct itself one file over —
     * `hot_water_stop.dart:112` is `projectedWeight = weight + flow * next.lookaheadSeconds`
     * — and Slate labels the same field "Volume flow multiplier (s)" with an 's' beside the
     * input (`settings.js:1284-1298`).
     *
     * SO NOTHING IS CORRECTED. Decal's captions opened "Corrects flow derived from…",
     * which describes a calibration gain: a number you turn because an instrument reads
     * high. Neither multiplier touches the flow it is given. Both project it FORWARD, so
     * that a stop command goes out early enough for the shot to land on the number the user
     * asked for. A user who read "corrects" would tune these against a scale error and
     * never find a setting that fixed it.
     *
     * ONE LIMITS ROW FOR BOTH — `appFlowMultiplier`. The handler validates only
     * `value is num`, so the band is this skin's; its paragraph in the limits table says
     * so, and says why the ceiling is 2 rather than Slate's absent one, and why it steps by
     * Slate's own 0.05.
     *
     * THE DEFAULTS ARE STATED IN THE CAPTIONS BECAUSE NOTHING ELSE STATES THEM. The old
     * text left them "to the Restore button, which knows it" — and it does not:
     * `RESET_FIELDS` is the eight fields `applySettingsDefaults` writes and neither of these
     * is among them (the reset moves the MACHINE's `flowMultiplier`, the row above, which is
     * a different number on a different document). There is no `MACHINE_FALLBACKS` entry for
     * either, so before this the recovery value for both was written down nowhere in the
     * skin and no button restored it. The numbers are ReaPrime's own — weight 1.0
     * (`settings_service.dart:153`), volume 0.3 (`:163`) — and are the two Slate prints in
     * prose.
     *
     * `hotWaterFlowMultiplier` IS THE THIRD ON THAT DOCUMENT AND IS NOT ON THIS LEAF, and
     * the reason recorded here used to be false. It said Slate "has a numpad field for it
     * and no settings row that renders one, so there is no control to match" — Slate renders
     * a full stepper for it, on the HOT WATER page, labelled "Flow multiplier / Lookahead
     * for stop-at-weight" with an 's' unit (`settings.js:4551-4576`). It is out of this
     * leaf's scope because it belongs to Hot Water, not because no surface existed, and
     * `machine-hot-water-lookahead` is that row here. Its band is `hotWaterLookahead` —
     * a separate limits row for a separate document field, and deliberately the same
     * 0..2 by 0.05 in seconds, because it is the same quantity. */
    /* ═══════════════════════════════════════════════════════════════════════════════
     * THE ROW THAT STAYS ON A BENGLE, AND WHY IT IS NOT WHAT ITS NEIGHBOURS ARE
     * ═══════════════════════════════════════════════════════════════════════════════
     *
     * Ben, 27 August 2026, on this page: "Bengle's pumps dont have any need for flow
     * calibration, its delievers perfect accurate flow, the DE1 didn't and needed these
     * calibration values to get it running. That is why I wanted it to be removed."
     *
     * TWO OF THE THREE ROWS ARE COVERED BY THAT SENTENCE AND THIS ONE IS NOT. It is not a
     * flow calibration. Nothing about it corrects a flow reading, on this machine or any
     * other: it is STOP-LAG LOOKAHEAD, the number of seconds of scale flow to add to the
     * weight already in the cup so the valve closes early enough to land on the target.
     *
     * AND IT IS LIVE ON A BENGLE, which is the half that decides it. Read at the pin,
     * `lib/src/controllers/shot_sequencer.dart`:
     *
     *   :432-433  double projectedWeight =
     *                 currentWeight + (weightFlow * _weightFlowMultiplier);
     *   :435      _handleStepWeightExit(machine.profileFrame, projectedWeight, machine);
     *   :436-437  if (!_machineHasAutonomousSAW &&
     *                 targetYield > 0 && projectedWeight >= targetYield) {
     *
     * LINE 435 IS ABOVE LINE 436, AND THAT IS THE ENTIRE ARGUMENT. The per-step weight
     * exit is called with the projected weight BEFORE the autonomous-SAW gate, so it runs
     * on every machine — a Bengle included, where `_machineHasAutonomousSAW` is true
     * (`:75-77`, `connectedDe1() is BengleInterface`). What the gate below it removes on a
     * Bengle is the SHOT-LEVEL stop at target yield, which the machine does for itself; it
     * does not remove the per-step weight exits inside a profile, and those still project
     * through this multiplier.
     *
     * SO HIDING IT WOULD HAVE MADE A SETTING THAT STILL MOVES A BENGLE UNREACHABLE FROM A
     * BENGLE — a value with a live reader and no control, which is the same defect as a
     * control with no reader, wearing the other face. It is the reason the `machines` gate
     * on this leaf moved from the nav node down to the two rows either side of this one.
     *
     * THE DISTINCTION IS EASY TO LOSE AGAIN because all three rows sit on a page called
     * Flow Multiplier and two of them share this one's limits row. Anyone tempted to
     * "finish the job" by gating this row as well should re-read line 435 first. */
    Object.freeze({
        id: 'calibration-flow-multiplier-weight',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'weightFlowMultiplier',
        limit: 'appFlowMultiplier',
        /* NO `machines` GATE, DELIBERATELY, AND THE ABSENCE IS THE DECISION. See above. */
        heading: 'Weight flow multiplier',
        /* SLATE'S HELPER, SHORTENED (Ben, 26 Aug 2026: "add the weight flow multiplier
         * with a helper like Slate has"). Slate's own runs to two sentences and 190
         * characters; what a reader needs is what the number DOES, which way it moves the
         * stop, and what to put back — so all three are here. */
        caption: 'How far ahead the shot stops. The scale’s flow rate for this many seconds is added to the weight already in the cup, so a higher value stops the shot earlier. Default 1.0 s.',
        /* THE LEAF'S HEADLINE SCALAR (S20). Slate nominates this same field for this same
         * nav row (`settings.js:6376`). It prints it as '×1', which contradicts the 's' its
         * own page puts beside the input; the summary here takes the row's declared unit, so
         * the nav row and the control agree. */
        navSummary: true,
    }),
    Object.freeze({
        id: 'calibration-flow-multiplier-volume',
        leaf: 'calibration-flow-multiplier',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.MACHINE,
        field: 'volumeFlowMultiplier',
        limit: 'appFlowMultiplier',
        /* DE1 ONLY, AND THIS ONE IS PROVABLY DEAD ON A BENGLE RATHER THAN MERELY
         * UNWANTED — which is a stronger reason than the row above has, and it is read out
         * of ReaPrime rather than taken on anyone's word.
         *
         *   shot_sequencer.dart:75-77   _machineHasAutonomousSAW =
         *                                   de1controller.connectedDe1() is BengleInterface
         *   shot_sequencer.dart:456-461 if (!_bypassSAW && !_machineHasAutonomousSAW &&
         *                                   (scale == null || _scaleLost) && ...) {
         *                                 final projectedVolume = _accumulatedVolume
         *                                     + (machine.flow * _volumeFlowMultiplier);
         *
         * `Bengle` implements `BengleInterface` (`bengle.dart:14-21`), so the flag is TRUE
         * on every Bengle and the only expression that reads this field is inside a branch
         * that can never be entered. A stepper whose value nothing downstream can consume
         * is a control with no other half — the defect class this fork exists to remove —
         * and it was drawn on a Bengle for as long as the gate was on the leaf and the leaf
         * was showing.
         *
         * RE-READ THE SEQUENCER BEFORE DELETING THIS GATE. The condition that makes it dead
         * is the autonomous-SAW branch, not the machine's name; if ReaPrime ever gives the
         * volume path a Bengle-reachable route, this row belongs back on both classes. */
        machines: Object.freeze(['de1']),
        heading: 'Volume flow multiplier',
        /* THE DIRECTION IS ON BOTH ROWS, and Slate states it only on the weight one. The
         * mechanism is identical — a larger lookahead projects further ahead and trips the
         * stop sooner — so a page that says it once has left the reader to guess whether the
         * other number works the same way. Slate being incomplete is not a reason to be. */
        caption: 'How far ahead a volume-stopped shot ends. The machine’s flow for this many seconds is added to the volume already poured, which covers the lag between the stop command and the flow actually stopping. A higher value stops the shot earlier. Default 0.3 s.',
    }),

    /* ---- Display ------------------------------------------------------------
     * C6 — WHAT REPLACES DISPLAY SIZE. The same four labels, read out of the corpus:
     *   CITE settings-display-display-size [1310,286,130,62] "Small"
     *        [1440,286,130,62] "Fit screen" [1569,286,130,62] "Larger"
     *        [1699,286,130,62] "Largest"
     * The values are DENSITY_STEP names, not numbers: the base each label sets lives in
     * `src/lib/density.js`, the composition with the height band lives in
     * `styles/tokens.css`, and neither is expressible here. The old control multiplied a
     * canvas transform and turned the viewport into a scroller above 1.0; this one moves
     * --ui-density and the type scale, which is why the leaf measure is in `ch`.
     *
     * The heading is the leaf's own name rather than Slate's "Zoom level": there is no
     * zoom any more, and a label naming a retired mechanism is the kind of stale copy
     * T14 is a list of. Recorded as an expected change. */
    Object.freeze({
        id: 'display-display-size-density',
        leaf: 'display-screen',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'density',
        heading: 'Display size',
        caption: 'Sets how large text and rows are drawn. A short window still tightens '
            + 'the rhythm on top of your choice.',
        items: Object.freeze([
            Object.freeze({ value: 'small', label: 'Small' }),
            Object.freeze({ value: 'fit-screen', label: 'Fit screen' }),
            Object.freeze({ value: 'larger', label: 'Larger' }),
            Object.freeze({ value: 'largest', label: 'Largest' }),
        ]),
    }),
    Object.freeze({
        id: 'display-screen-saver-enabled',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.ROUTE,
        key: 'screensaverEnabled',
        heading: 'Show screen saver when the machine sleeps',
        /* THE CAPTION SAID WHAT IS TRUE OF ONE OF THE THREE TYPES.
         *
         * "The screen goes fully black. Touch it to wake the machine." was written when
         * D10 made the saver black-only, and Ben reversed that on the SAME DAY the type
         * bank was added — so from that afternoon the sentence was simply wrong for Image
         * and for Clock. The second half was always true of all three and is the half worth
         * keeping: how to get the screen back is the one thing a person cannot work out by
         * looking, and it is where Decal is better than Slate.
         *
         * WHAT IS DRAWN IS THE TYPE ROW'S TO SAY, and it says it. A caption on an enable
         * switch that describes the appearance of one of the options below it is a second
         * answer to a question that already has an owner. */
        caption: 'While the machine sleeps the screen shows the saver below. Touch it to wake the machine.',
    }),
    /* THREE KINDS OF SAVER, AND THIS REVERSES D10.
     *
     * Ben, 26 August 2026: "Row 2 should be the screen saver type: Black, Image or Clock.
     * If black or clock is selected the section below greys out."
     *
     * D10 SAID FULLY BLACK AND `storage-routes.js` RETIRED THE IMAGE LIST ON IT. The
     * clock arrived on 24 August as a switch over the blank, which was D10 plus one
     * exception; a THIRD state made the switch the wrong shape — two switches for three
     * states has an unreachable combination and no name for what is showing. So the
     * switch becomes a choice, the clock keeps exactly the behaviour it had, and Image
     * joins it.
     *
     * BLACK IS STILL THE ONE THAT COSTS NOTHING, and the caption says so rather than the
     * page pretending the three are equivalent: anything lit on a screen that stays on
     * for hours can mark it.
     *
     * IMAGE IS THE DEFAULT, on Ben's own pick ("Screen saver type: image"). */
    Object.freeze({
        id: 'display-screen-saver-type',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'screensaverType',
        heading: 'Screen saver',
        caption: 'What the screen shows while the machine sleeps. A fully black screen is the kindest to the panel.',
        items: Object.freeze([
            Object.freeze({ value: 'black', label: 'Black' }),
            Object.freeze({ value: 'image', label: 'Image' }),
            Object.freeze({ value: 'clock', label: 'Clock' }),
        ]),
        enabledBy: 'display-screen-saver-enabled',
    }),
    /* HOW OFTEN THE PICTURE CHANGES, and only while there is more than one.
     *
     * Ben: "a folder cycles every image in it at the Change image every rate. Make that a
     * stepper, 1 to 10 minutes." Slate's own control is SECONDS (2-600,
     * `settings.js:112`), which is a different question: two seconds is a slideshow, and
     * this is a screen saver. The minute band is Ben's.
     *
     * GATED ON THE TYPE, by value rather than by a switch — see `inertFor`. With Black or
     * Clock showing there is no image to change, so the row reads as a dash rather than
     * offering an interval for something that is not happening. */
    Object.freeze({
        id: 'display-screen-saver-cycle',
        leaf: 'display-screen-saver',
        archetype: ARCHETYPE.STEPPER,
        source: SOURCE.ROUTE,
        key: 'screensaverCycleMinutes',
        limit: 'screensaverCycle',
        heading: 'Change image every',
        caption: 'With more than one image, how long each one stays on screen.',
        enabledBy: Object.freeze({ row: 'display-screen-saver-type', value: 'image' }),
    }),
    /* THE SWITCH WROTE A KEY NOTHING READ, AND THE PAGE PROMISED WHAT NOTHING DELIVERED.
     *
     * `wakeLockEnabled` had this row, a route in `storage-routes.js` and a default of true,
     * and a sweep of `src/` on 26 August 2026 found those three declarations and NO reader:
     * no command, no caller, nothing on the other end. The tablet's screen slept exactly as
     * the operating system decided whichever way the switch was set, and the footnote below
     * described the release behaviour of a lock this skin never took.
     *
     * `panel` IS THE OTHER HALF. It names the TABLET's own door (`settings-leaf-model.js`
     * `PANEL_SETTINGS`), whose write is `requestWakeLock` / `releaseWakeLock` on the display
     * socket and whose read is ReaPrime's `wakeLockOverride` — "did this client ask for the
     * lock", which is precisely what this switch means. The stored key stays: it is what the
     * row draws before the first display frame arrives, and it is the preference that
     * survives a reload.
     *
     * THE SOCKET, NOT THE REST PAIR, AND THE FOOTNOTE IS WHY. `display_handler.dart` tracks
     * the override per socket and releases it in both `onDone` and `onError`, so "releases
     * by itself when the connection drops" is a fact about the WS route and would be false
     * of `POST /display/wakelock`. The sentence Ben asked for is now true. */
    /* THE BRIGHTNESS SLIDER, WHICH WAS A BESPOKE PAGE UNTIL 28 AUGUST 2026.
     *
     * It had a leaf to itself with ONE control on it, and the reason was mechanical rather
     * than editorial: `ARCHETYPE` had no SLIDER, so the only way to draw one was to hand-
     * write the page. Adding the archetype removed the reason, and Ben's page merge
     * removed the page.
     *
     * A ROUTE ROW WITH A PANEL, exactly as the wake lock below is. The served brightness
     * outranks the stored one — the row states what the screen IS, not what this tablet
     * last asked for — and `lastBrightness` is the answer before the first display frame
     * and the preference that survives a reload.
     *
     * THE BAND IS `screenBrightness` AND ITS FLOOR IS 10, NOT 0. A screen that can be set
     * to nothing is a screen that goes dark by accident with no way back, so the floor is
     * a real bound and not a formality. It is stated once, in `machine-limits.js`.
     *
     * WHAT THE BESPOKE PAGE HAD THAT THIS DOES NOT: "Dim" and "Bright" end captions. They
     * named the two ends of a control whose ends are self-evident and whose value is
     * printed beside it; the row's heading and its percent reading carry the same
     * information in the vocabulary every other row uses. */
    Object.freeze({
        id: 'display-screen-brightness',
        leaf: 'display-screen',
        archetype: ARCHETYPE.SLIDER,
        source: SOURCE.ROUTE,
        key: 'lastBrightness',
        panel: 'brightness',
        limit: 'screenBrightness',
        heading: 'Screen brightness',
        caption: 'The lowest setting stays readable, so the screen never goes dark by accident.',
    }),
    Object.freeze({
        id: 'display-wake-lock-enabled',
        leaf: 'display-screen',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.ROUTE,
        key: 'wakeLockEnabled',
        panel: 'wakeLock',
        heading: 'Enable wake lock',
        caption: 'Keep the screen on while the app is active.',
        /* SLATE'S FOOTNOTE, AND IT IS THE ONE THING ON THIS PAGE A USER CANNOT WORK OUT.
         * Ben, 26 August 2026, on both rows: "as slate", "as slate including the release
         * footnote". The intro sentence is the page DESCRIPTION (settings-leaf-copy.js);
         * this is the sentence about the SETTING, so it rides on the row. */
        note: 'The wake lock releases by itself when the connection to the machine drops.',
    }),

    /* D8 — A WAY BACK OUT OF THE SKIN. One control, one button, the button archetype on
     * #29. Part 1: "A full-screen app with no exit is a trap … the cost is a single
     * button." It sits on the Skin leaf because that is where the question "which skin
     * am I in" is already asked; the leaf's own 2-up cards are bespoke and land with
     * their own row, which is why a row here is not a second owner of that layout.
     *
     * No confirm step. #19 is available and D8's own text says the cost is a single
     * button; adding a dialog to a reversible navigation would be the "new dialog shape"
     * the wave law forbids. */
    Object.freeze({
        id: 'display-skin-leave',
        leaf: 'display-skin',
        archetype: ARCHETYPE.BUTTON,
        source: SOURCE.ACTION,
        action: 'leave-skin',
        heading: 'Leave this skin',
        caption: 'Go back to the page that loaded Decal. Nothing is uninstalled.',
        control: 'Leave',
    }),

    /* ---- Units & Language ---------------------------------------------------
     * Machine-scoped: a display unit for machine readings, shared across clients. The
     * dual write (localStorage AND the IDB settings store, reading the other first) was
     * the proven silent-revert bug; one row, one layer, and the store refuses a second. */
    Object.freeze({
        id: 'units-language-temperature-unit',
        leaf: 'units-language-units',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'tempUnit',
        heading: 'Temperature unit',
        items: Object.freeze([
            Object.freeze({ value: 'c', label: 'Celsius (°C)' }),
            Object.freeze({ value: 'f', label: 'Fahrenheit (°F)' }),
        ]),
    }),

    /* UNITS & LANGUAGE › TIME. Ben, 24 Aug 2026: "For the screen saver clock or clock in
     * general we should give the option to show 24hr or 12hr with am/pm added to 12 hr."
     *
     * "IN GENERAL" IS WHY IT IS ONE KEY AND NOT TWO. The Live header and the screensaver
     * both write a time, and a per-surface format would let one say 21:40 while the other
     * says 9:40 PM — the drift `wall-clock.js` was extracted to prevent, arriving by the
     * other door. One preference, one formatter, two readers.
     *
     * THE VALUES ARE THE FORMATTER'S OWN. `CLOCK_FORMAT` in `wall-clock.js` names them
     * and the labels here are this skin's; a third spelling in the registry would be the
     * vocabulary drift the charging-mode row's paragraph is about. */
    Object.freeze({
        id: 'units-language-time-format',
        leaf: 'units-language-units',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.ROUTE,
        key: 'clockFormat',
        heading: 'Clock',
        /* NO CAPTION. It read "How the time is written on the Live screen and on the
         * sleep screen." — the leaf's own description with one word moved (O6's copy in
         * `settings-leaf-copy.js` says "on the Live screen and the sleep screen"). The
         * page is one row, so the two sentences sat four lines apart saying the same
         * thing, and the second one taught the reader nothing about the choice below it.
         * A row on a one-row page inherits the page's sentence; it does not repeat it. */
        items: Object.freeze([
            Object.freeze({ value: '24h', label: '24-hour' }),
            Object.freeze({ value: '12h', label: '12-hour' }),
        ]),
    }),

    /* DECAID — FOUR CONTROLS, WHERE THERE WAS AN APOLOGY.
     *
     * The leaf shipped as a dashed card reading "decent.app settings are not shown here —
     * Gateway mode, log level and update checks belong to the decent.app gateway. This
     * version does not read or write them." Every word of that was true of the SKIN and
     * none of it was true of the ROUTE: all four are fields of `GET/POST /api/v1/settings`,
     * the document this skin has had a client for since the scale rows were built.
     *
     * Ben, 26 August 2026: "take Slate's inputs but lay them out like every other page",
     * and "the app is called Decaid now" — which is the nav name, not the leaf id.
     *
     * THE THREE VOCABULARIES ARE THE SERVER'S, and the two failure modes are opposite
     * (see `APP_SETTINGS_WRITE_KEYS`): a bad `gatewayMode` is a typed 400, a bad
     * `logLevel` is silently ignored. Offering exactly the server's names keeps both
     * unreachable.
     */
    Object.freeze({
        id: 'extensions-decent-app-gateway',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.BANK,
        source: SOURCE.MACHINE,
        field: 'gatewayMode',
        heading: 'Gateway mode',
        caption: 'How much the gateway does with the machine. Tracking watches it; Full also controls it.',
        items: Object.freeze([
            Object.freeze({ value: 'disabled', label: 'Disabled' }),
            Object.freeze({ value: 'tracking', label: 'Tracking' }),
            Object.freeze({ value: 'full', label: 'Full' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions-decent-app-log-level',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.SELECT,
        source: SOURCE.MACHINE,
        field: 'logLevel',
        heading: 'Log level',
        caption: 'How much detail the app writes to its log. Everything is for chasing a fault; Off writes nothing.',
        /* THE LOGGER'S OWN TEN NAMES, in its own order from most to least. Slate spells
         * each one twice — a word and the level in brackets — and that is kept, because
         * the bracketed name is what appears in a log file somebody is reading. */
        items: Object.freeze([
            Object.freeze({ value: 'ALL', label: 'Everything (ALL)' }),
            Object.freeze({ value: 'FINEST', label: 'Trace (FINEST)' }),
            Object.freeze({ value: 'FINER', label: 'Trace (FINER)' }),
            Object.freeze({ value: 'FINE', label: 'Debug (FINE)' }),
            Object.freeze({ value: 'CONFIG', label: 'Configuration (CONFIG)' }),
            Object.freeze({ value: 'INFO', label: 'Info (INFO)' }),
            Object.freeze({ value: 'WARNING', label: 'Warnings (WARNING)' }),
            Object.freeze({ value: 'SEVERE', label: 'Errors (SEVERE)' }),
            Object.freeze({ value: 'SHOUT', label: 'Critical (SHOUT)' }),
            Object.freeze({ value: 'OFF', label: 'Off (OFF)' }),
        ]),
    }),
    Object.freeze({
        id: 'extensions-decent-app-updates',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.SWITCH,
        source: SOURCE.MACHINE,
        field: 'automaticUpdateCheck',
        heading: 'Automatic update checks',
        caption: 'Look for a newer app every twelve hours.',
    }),
    /* THE PATH IS SHOWN AND NOT OFFERED. It is writable on the route, and writing it
     * re-points the server at another folder — which is how a skin removes itself from the
     * screen. A READING row is the shape that says "this is a fact about your machine"
     * without also saying "and you may change it here". */
    Object.freeze({
        id: 'extensions-decent-app-path',
        leaf: 'extensions-decent-app-settings',
        archetype: ARCHETYPE.READING,
        source: SOURCE.MACHINE,
        field: 'webUiPath',
        heading: 'Web UI folder',
        caption: 'Where the app serves this skin from.',
    }),

    /* ---- Extensions ---------------------------------------------------------
     * THE DYE2 LEAF IS GONE (Ben, 26 August 2026: "delete the DYE2 leaf and move what it
     * does into Plugins"), and its one switch went with it.
     *
     * THE SWITCH WAS A FINISHED HALF WITH NO OTHER HALF, which is the defect class this
     * fork exists to remove: `dye2Enabled` had a control, a routing row and a store, and
     * NOTHING in `src/` read it. A whole leaf in the sub-nav for a preference that changed
     * nothing.
     *
     * DYE2 IS A PLUGIN AND THE PLUGINS PAGE ALREADY LISTS IT, with the enable switch every
     * other plugin gets. That is where "turn DYE2 on" belongs, and it is why deleting this
     * page loses nothing that worked.
     *
     * THE KEY STAYS IN THE ROUTING TABLE, provisional, with the open question named:
     * Ben's current thinking is that the toggle should enable the Live page's button
     * beside "All notes", which loads DYE2 — and that is not built on a guess. The day it
     * is decided, the key is where the answer lives. */

    /* ---- Help ---------------------------------------------------------------
     * THE GUIDE, AND THE TOGGLE THAT WENT WITH IT.
     *
     * Ben, 26 August 2026: "show a Quick start guide row with a View button that opens the
     * guide", and "Decal has no help button or overlay, so the toggle goes."
     *
     * THE TOGGLE WAS A CONTROL FOR SOMETHING THAT DOES NOT EXIST HERE. It read and wrote
     * `helpHidden`, which in the old skin hid a floating "?" button over the Live screen.
     * This skin has no such button and no overlay behind it, so the switch changed a stored
     * value and nothing else — the same finished-half defect the DYE2 leaf was deleted for,
     * on a page that also had something real to offer.
     *
     * AND THE PAGE HAD NOTHING ELSE. With the toggle gone the leaf would have been empty,
     * which is why the two arrive together: the guide is what the page is for. */
    Object.freeze({
        id: 'help-quickstart-guide-view',
        leaf: 'help-quickstart-guide',
        archetype: ARCHETYPE.BUTTON,
        source: SOURCE.ACTION,
        action: 'open-quickstart',
        heading: 'Quick start guide',
        caption: 'Opens Decent’s own guide in a new window.',
        control: 'View',
    }),
    /* THE "BOUND KEYS" READING ROW IS GONE (26 August 2026). It printed the NUMBER of
     * stored overrides above a list that shows every binding by name — and with no
     * overrides stored it printed a bare dash under a heading, which is the stray em dash
     * the audit found sitting under "Bound keys" with nothing to explain it.
     *
     * ITS CAPTION IS GONE TOO, AND THAT WAS THE DUPLICATE: "Bindings belong to the keyboard
     * attached to this device" appeared once here and once inside the section below. The
     * sentence survives where a sentence about the PAGE belongs — the leaf description. */
]);

/**
 * A LEAF NOTE IS A SENTENCE, NOT A CONTROL. One paragraph under the leaf heading, for a
 * leaf whose emptiness is a DECISION rather than a gap — so the pane says why instead of
 * looking broken.
 *
 * IT IS EMPTY TODAY, and the one entry it used to hold is worth recording. D4 (accepted)
 * said: "no firmware-update feature, and the hand-picked file upload is removed, not
 * carried. A control that flashes firmware from an arbitrary file is worse than no
 * control." Ben reversed it on 24 August 2026 — "I should be able to pick a file, but it
 * should also have a 'latest' button that pulls it" — so `updates-firmware-update` is a
 * BESPOKE leaf now rather than a sentence about not having one.
 *
 * WHAT D4 WAS PROTECTING AGAINST IS STILL REFUSED: the Latest button installs the
 * artifact ReaPrime's own validator recommends, and nothing in this app sends `force`,
 * which is the flag that would flash an image the machine says is not for it.
 */
export const LEAF_NOTES = Object.freeze({
    /* EMPTY SINCE THE FIRMWARE LEAF GOT ITS CONTROLS BACK (Ben, 24 Aug 2026). The note
     * that was here — "Decal does not send firmware to the machine" — was D4's
     * boundary said on screen, and it is no longer true. The object stays because the
     * mechanism is what the renderer asks: a leaf whose emptiness is a decision needs
     * somewhere to say so, and the next one will go here. */
});

/**
 * DECLARED, NOT BUILT. Every entry names the OWNER that would have to land first, in the
 * same spirit as `storage-routes.js`'s `layer: 'none'` half: "never two stores for one
 * value needs somewhere to say who the one store is when it is not us."
 *
 * This list produces NO markup. It exists so that an empty leaf pane is a fact with a
 * reason attached, and so the next builder can see at a glance which door is missing
 * rather than re-deriving it from an absence.
 *
 * TWO KINDS OF ENTRY, AND THE SECOND KIND WAS MISSING (wave 5.4, cross-2). Everything
 * down to `machine-flush` declares a leaf that draws NOTHING. Everything after it
 * declares a control DROPPED FROM A LEAF THAT DRAWS SOMETHING — and until that block was
 * written the ledger could not see those at all: the wave built a careful accounting for
 * empty leaves and none for partial ones, so SEVEN leaves shipped a live row beside a
 * silent omission. A partial leaf is the harder case to catch by eye, precisely because
 * the pane does not look broken.
 *
 * The mechanism does not change — same shape, same rule that every entry names its owner.
 * `name` is the SLATE control that is absent, quoted from the corpus, not a name Decal
 * invented for it.
 */
export const PENDING_ROWS = Object.freeze([
    /* `calibration-flow-multiplier` WAS HERE AND IS NOW LIVE (wave 5.4, D9). The row above
     * replaces it. Its owner line named GET/PUT /api/v1/machine/scaleCalibration, which is
     * the LOAD-CELL route — the flow multiplier is GET/POST /api/v1/machine/calibration,
     * `{flowMultiplier}`, a pair that had no contract row because nothing addressed it.
     * Recorded here rather than deleted silently: the correction is the reason the row
     * could be built at all. */
    /* `display-screen-saver` / "Change image every" WAS DECLARED HERE AND THE
     * DECLARATION WAS WRONG ABOUT WHY (24 Aug 2026). It blamed the absence of a
     * device-preference ranges table. The real reason is an ACCEPTED DECISION one layer
     * down: D10 makes this skin's screensaver FULLY BLACK and `storage-routes.js`
     * retired both `blackScreenSaver` and the `screensaverImages` list on it. There are
     * no images, so there is no cycle interval — and Slate's other two screen-saver
     * controls (Images choose/clear, Black screen saver) fall to the same decision.
     * A pending entry for a control that a shipped decision removed reads as debt when
     * it is a design; it is deleted rather than restated. */
    /* `extensions-dye2` / "Strip mode" WAS DECLARED HERE AND IS NOT A SLATE CONTROL
     * (24 Aug 2026). Read at the source: `renderDye2Settings` (slate settings.js:5757)
     * renders exactly ONE control, the `dye2-enabled` master switch, and this skin ships
     * it as `extensions-dye2-enabled`. The leaf is COMPLETE, not partial. The entry was
     * a census artefact — Q6 is a real open question about whether the strip ships in
     * v1 Live, and it was mistaken for a missing settings row. */
    /* `extensions-visualizer` AND `extensions-plugins` ARE BUILT (24 Aug 2026). Both
     * entries said the same thing — "recorded and handler-checked, but unadopted: no
     * contract row, because no client addresses it" — and that was the whole obstacle.
     * `plugins-store.js` is the client, and the FORM IS GENERATED FROM THE MANIFEST
     * rather than typed out per plugin, because `POST /plugins/<id>/settings` validates
     * every key against that manifest and answers 400 for one it does not know. */
    /* THE TWO MAINTENANCE ENTRIES ARE GONE AND THEIR REASON WAS WRONG (24 Aug 2026).
     * They said "No route in the contract table starts one. The old page drove it
     * through the machine state machine directly." The second sentence is right and is
     * not an obstacle: `descaling` and `airPurge` ARE members of `MachineState`
     * (machine.dart:227, :230), and `PUT /machine/state/<newState>` resolves the name
     * with `MachineState.values.byName`. The machine state machine IS the route, and
     * `machine-state-store.js` has owned that PUT since the screensaver's wake. */
    /* `help-talk-to-decent` IS BUILT, AND SINCE 27 AUGUST 2026 IT IS THE MESSAGE BOX TOO.
     *
     * WHAT THIS ENTRY SAID, AND THE HALF OF IT THAT WAS A NON-SEQUITUR. "There is no
     * sign-in route on the web API at all — `DecentAccountService` owns the credentials and
     * ReaPrime signs in through its own Flutter UI, while `/account/proxy/<rest>` forwards
     * an ALREADY authenticated request. A username and password box here would collect
     * credentials with nowhere to send them." Every sentence of that is TRUE and it is an
     * argument against a SIGN-IN FORM, which nobody wanted. It was then used as the reason
     * the leaf could only be a reading, and it does not support that conclusion: the clause
     * beginning "while" describes precisely the mechanism a message box needs. A blocker
     * recorded against the wrong feature kept this page a paragraph for three days while
     * its own copy promised a message box.
     *
     * BEN'S CALL (27 August 2026): build it, in Slate's shape — a compose box plus a thread
     * list, both behind a linked account. `decent-support-store.js` carries the contract,
     * re-read at the pin before a line of it was written, and the two things that shape the
     * surface: the injected skin token is READ-scoped, so every call is a GET with a query
     * string (route-table exception `account-proxy-query-passthrough`); and the proxy's CORS
     * allowlist is the skin server's own origins, so none of it can be exercised anywhere
     * but a real ReaPrime-served page. */
    /* `help-send-feedback` IS BUILT (24 Aug 2026), and the form is shown BEFORE
     * availability is known — deliberately. There is no GET on `/api/v1/feedback`, so the
     * 503 that means "this ReaPrime build was compiled with no GitHub token" arrives at
     * SUBMIT time only; probing would mean filing a real feedback item to find out
     * whether feedback works. A 503 is therefore reported as a property of the build
     * rather than as a failure worth retrying. */
    Object.freeze({
        leaf: 'help-quickstart-guide', name: 'Startup counter', limit: null,
        owner: 'NOT A CONTROL AT ALL. `helpLaunches` is the counter behind the button’s '
            + 'default and exists so "never chose" stays distinguishable from "chose to show".',
    }),
    /* `machine-flush` / "Flush presets" WAS DECLARED HERE AND IS NOT A SETTINGS CONTROL
     * (24 Aug 2026). Slate's flush SETTINGS page is `renderFlushSettingsForm`
     * (settings.js:1425) and carries two rows, temperature and flow; this leaf ships
     * those two AND duration, so it is a superset. The preset bank Slate calls
     * `flush-presets` is on the LIVE dashboard (`modules/ui.js:1597`), not in Settings,
     * and belongs to whoever builds that surface. */

    /* ======================================================================
     * PARTIAL LEAVES — a live row AND a dropped Slate control (wave 5.4, cross-2).
     * Six leaves. The seventh partial leaf found by that census is
     * `display-display-size`, which is NOT declared here: its dropped control is
     * queued for Ben (c-leaves-volume-7) and this run neither builds, plans, nor
     * names a shape for it.
     * ====================================================================== */

    /* MACHINE › ADVANCED. Slate carries four steppers; Decal ships two experimental
     * KV switches that are not on Slate's advanced page at all — they come from Slate's
     * STORAGE, not from this page — so the overlap between the two pages is EMPTY.
     * This is the one group where nothing is blocked, and the entries say so. */

    /* CONNECTION › SCALE. Decal ships one READING row (which scale this tablet used
     * last); Slate ships a whole connection surface. TWO different owners, so both are
     * named — the drop is not one missing door. */
    /* `connection-scale`'s SCAN AND WIFI HALVES ARE BUILT (24 Aug 2026), by the owner
     * the leaf's own reading row named: "pairing and forgetting belong to whoever builds
     * the connection surface". `scale-connect-store.js` is that surface's data half, and
     * it carries the two query-flag traps `GET /devices/scan` has — an absent `connect`
     * means CONNECT, and `quick=true` answers with an empty array before it has looked.
     *
     * CONNECTING IS STILL NOT HERE, and that is the same rule kept: `createDevicesLink`
     * owns `PUT /devices/connect` and the ambiguity handling that goes with it. */

    /* ACCESSORIES › USB CHARGER. Decal ships `usb`, which is on the MACHINE route.
     * Slate's other three controls are app-side and share one unadopted door. */

    /* ACCESSORIES › CUP WARMER — BOTH ENTRIES ARE GONE, BUILT 24 Aug 2026, and between
     * them they were the clearest example of the shape this whole pass is about: a
     * COMPLETE STORE WITH NO CALLER. `src/stores/cup-warmer.js` reads both routes, writes
     * both, names the two states where an enabled pre-heat silently does nothing, and had
     * not one caller in `src/`.
     *
     * "Enable cup warmer" was declared blocked on the MOCK, not on the machine: the
     * recorded fixture is ledgered `refuse` because it predates the pre-heat split, so
     * `api__v1__machine__cupWarmer.json` is refused and any control renders its absent
     * state against `mock_rea.py`. That is a fixture fact and not a firmware one — the
     * route answers on a real Bengle, the leaf is already gated on the `cupWarmer`
     * capability, and a control that reads absent against a mock is exactly what A3's
     * fail-closed shape looks like working. Re-record the fixture and the mock agrees too.
     *
     * "Pre-warm before wake-up" was declared blocked on a SPELLING, and the drop was
     * principled: Slate's two key names for the pair are a `forbiddenSpelling` in
     * CONTRACTS.json (CB-18/CB-19) because the old skin read them off the WRONG route and
     * concluded the firmware had no pre-warm. Nothing here ports those names. The control
     * is built on `PUT /machine/cupWarmer/preheat {enabled, leadMinutes}` — the route the
     * store has always used — so the retired bug cannot be re-filed by building it.
     */
]);

/* ===========================================================================
 * Derived views. Never a second list.
 * =========================================================================== */

/** Every row a leaf owns, in registry order. Unknown leaf -> empty, never a throw. */
export function rowsForLeaf(leafId) {
    return SETTINGS_ROWS.filter((row) => row.leaf === leafId);
}

/** One row by id, or null. */
export function rowFor(id) {
    return SETTINGS_ROWS.find((row) => row.id === id) ?? null;
}

/** Everything declared-but-not-built for a leaf. */
export function pendingForLeaf(leafId) {
    return PENDING_ROWS.filter((row) => row.leaf === leafId);
}

/** The note for a leaf, or null. */
export function noteForLeaf(leafId) {
    return LEAF_NOTES[leafId] ?? null;
}

/**
 * PRIMITIVE unless §4.4 named it.
 *
 * A CLASSIFICATION BY EXCLUSION, and it counts 28 — which is NOT the number of leaves
 * that compose #29 (that is `leavesWithRows()`, 19; 18 of them primitive). A leaf is
 * "primitive" here purely because it is absent from `BESPOKE_LEAVES`, including the ten
 * that render no row at all. Do not report this count as the one-primitive headline.
 */
export function leafKind(leafId) {
    return Object.hasOwn(BESPOKE_LEAVES, leafId) ? LEAF_KIND.BESPOKE : LEAF_KIND.PRIMITIVE;
}

/** Every leaf that carries at least one live row. */
export function leavesWithRows() {
    return [...new Set(SETTINGS_ROWS.map((row) => row.leaf))];
}

/** The logical storage keys the registry claims, sorted. */
export function registryKeys() {
    return [...new Set(SETTINGS_ROWS.filter((row) => row.source === SOURCE.ROUTE).map((row) => row.key))].sort();
}

/**
 * The ReaPrime settings fields the registry writes, sorted.
 *
 * A ROW MAY NAME MORE THAN ONE, and one does: `machine-steam-stop` is a view over BOTH
 * `steamDuration` and `milkStopTemp` — the two numbers that between them ARE the stop mode
 * — so it declares no single `field` and states its fields in `stages` instead. Reading
 * only `row.field` left this list carrying an `undefined`, which is how a door check comes
 * to pass while a field reaches the wire through no door at all.
 */
export function machineFields() {
    const fields = new Set();
    for (const row of SETTINGS_ROWS) {
        if (row.source !== SOURCE.MACHINE) continue;
        if (row.field) fields.add(row.field);
        for (const plan of Object.values(row.stages ?? {})) {
            for (const field of Object.keys(plan)) fields.add(field);
        }
    }
    return [...fields].sort();
}

/** How many rows each archetype carries — the headline's supporting arithmetic. */
export function archetypeCounts() {
    const counts = {};
    for (const name of Object.values(ARCHETYPE)) counts[name] = 0;
    for (const row of SETTINGS_ROWS) counts[row.archetype] += 1;
    return counts;
}
