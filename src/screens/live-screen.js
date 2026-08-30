/**
 * live-screen.js - <live-screen>, the Live skeleton. LAYOUT_SPEC_DRAFT.md §4.1.
 *
 * This file replaces the wave-5.1 placeholder whole. It is the SKELETON and the
 * placeholder content that proves it: "First deliverable of the phase is the Live
 * skeleton with placeholder content, looked at on a 1920 x 1080 window and on the
 * bench tablet, before any real component work lands" (SCOPE Part 5 §1, C1).
 *
 * ===========================================================================
 * THE GRID  (§4.1, quoted)
 * ===========================================================================
 *
 *     <live-screen>                       display:grid; height:100%
 *       grid-template-columns: var(--ui-rail-w) minmax(0, 1fr)
 *       grid-template-rows:    var(--ui-band-h) minmax(0, 1fr) auto
 *       gap: var(--ui-seam)                     / the seam IS the divider /
 *       background: var(--ui-line-strong)       / shows through the gap /
 *
 *       ├─ <live-header>      row 1, spans both columns
 *       ├─ <live-rail>        col 1, rows 2-3          container-type: inline-size
 *       ├─ <live-main>        col 2, row 2
 *       └─ <live-foot>        col 2, row 3
 *
 * Built exactly so, with the display/gap/ground coming from the seam utility rather
 * than being hand-written here (CONVENTIONS §13 (b): the classes go on the HOST,
 * because a `.seam-grid` rule inside this shadow root can never match its own host).
 * TWO TRACK FUNCTIONS DIFFER FROM THE SKETCH AND THEY ARE THE ITEM:
 *
 *   row 2  `minmax(0, 1fr)`, §4.1's own spelling, kept AFTER trying to improve on it.
 *          `minmax(auto, 1fr)` reads like the L2 / L4 / L18 cure - take the item's own
 *          minimum as the track's floor, so no box is ever smaller than its content -
 *          and it was built and MEASURED that way first. It pins the row: `auto`
 *          resolves to the item's min-content contribution, and a chart card's
 *          min-content is whatever pixel height uPlot last wrote onto its canvas, so
 *          the row froze at 804px and would not shrink at any window height (chart
 *          690px at 1080 rows AND at 480). `ui-chart-card.js` records exactly this
 *          trap for its own inner track ("the card then pinned itself at its first
 *          layout (340px)"), and this is the same trap one box out. So the row is
 *          `0`-floored and THE CARD CARRIES ITS OWN FLOOR - min-block-size:
 *          --ui-chart-min-h plus the card's chrome, derived in its file - which is
 *          §4.1's arrangement exactly: squeezed below it, the card overflows its row
 *          visibly, border still around the plot (§2.4), rather than the canvas
 *          escaping the card or the row lying about how small it can be.
 *   row 3  `fit-content(var(--ui-live-foot-max-share))` - §4.1's foot band row in
 *          full: "auto, content-sized, with a min-block-size AND A MAXIMUM SHARE of
 *          the column". `fit-content(share)` is content-sized-but-never-past-its-share
 *          in one function, and the track's own floor is the item's min-content
 *          contribution, which is `<live-foot>`'s `min-block-size:
 *          var(--ui-live-foot-min-h)` - so the floor stays declared on the band that
 *          owns it and the share stays on the grid that owns the track.
 *          MEASURED, NOT ASSUMED: the obvious spelling,
 *          `minmax(floor, fit-content(share))`, is INVALID CSS -
 *          `fit-content()` is a `<track-size>` and not a `<track-breadth>`, so it may
 *          not appear inside `minmax()`. Chrome drops the whole declaration, the rows
 *          fall back to `auto`, the header band silently stops being --ui-band-h and
 *          everything still LOOKS plausible. Caught by measuring the used track list
 *          (82.23px against a 118px band); the suite now pins all three tracks.
 *
 * ===========================================================================
 * C1 AND C2, THE DECIDED ANSWERS - AND WHAT A FLUID LAYOUT CAN AND CANNOT SAY
 * ===========================================================================
 *
 * C1 (accepted, SCOPE.md:1911-1916): "At 1920 x 1080 the rewrite has 120 fewer rows
 * than the old design height and does not squash to hide it. The decision: the chart
 * keeps its height; the foot band loses rows first."
 * C2 (accepted, SCOPE.md:1918-1925): "The foot band's order of surrender: drop the
 * derived list first, then scroll as a last resort."
 *
 * Both are built to, not re-litigated. What is built:
 *
 *   - the chart NEVER goes below --ui-chart-min-h plus the card's chrome (its own
 *     file derives the sum; this screen states no chart number);
 *   - the foot band NEVER goes below --ui-live-foot-min-h;
 *   - the foot band is the ONLY region that scrolls, and only once it has been
 *     squeezed under its content, which is below the 1000x600 design floor;
 *   - the rail never scrolls and drops nothing;
 *   - C2's first step is already spent: D1 removes the derived list from v1, so the
 *     band has no lesser row left to drop and what remains of C2 is the phase table's
 *     behaviour, which M3 gates.
 *
 * AND HERE IS THE HONEST PART, because it belongs in the morning report rather than
 * in a comment nobody reads. "The chart keeps its height" cannot mean a pixel height
 * in this layout, and the reason is arithmetic, not taste: when a container loses
 * 120px, some box loses 120px, and the box that loses it is whichever box holds the
 * flexible space. §4.1's own table makes that the chart - "Chart | The only 1fr. It
 * absorbs everything, down to --ui-chart-min-h" - so above the floors the chart is
 * the giver, and the band gives next, from its content height down to its floor.
 * Pinning the chart instead would mean writing its height as a number, and that
 * number only exists as a measurement of the 1920 x 1200 fixed canvas the rewrite
 * rejects (§1.2). What IS expressible, and is here, is the band's share cap: it is a
 * share of the screen's own body, so a shorter window narrows the cap and the band
 * gives back space it was holding - C1's answer, to the extent a fluid layout can
 * make it true. Today the cap does not bind (the placeholder band is well under 40%);
 * with M3's real five-phase content it will.
 *
 * THE ONE-LINE REVERSAL, so the morning has a dial and not an argument: move the
 * `1fr` from row 2 to row 3 and the band becomes the flexible box - the chart then
 * keeps its content height at every size and the band absorbs the difference. That is
 * C1's literal reading. Q2 reviews it.
 *
 * AND HERE IS WHAT THE REVERSAL ACTUALLY COSTS, measured by the wave-5.1 fix pass rather
 * than reasoned about, because the sentence above under-sold it. On a FRESH layout at
 * 1920 wide the reversal gives: 1200 rows -> chart 186, band 766; 1080 rows -> chart 186,
 * band 646. The chart is on its floor AT EVERY SIZE, not only on a 1080-row window - "its
 * content height" IS the floor, because a chart card has no intrinsic height to keep. So
 * the reversal buys C1's words at the price of a 186px chart on a 1200-row screen, and it
 * is not the recommendation. (Measured on a fresh mount on purpose: applied to a screen
 * that has already laid out, the change appears to do nothing at all, because the `auto`
 * row then pins to uPlot's last canvas height - the trap recorded at the top of this file,
 * reproduced exactly.) The third option, and the one that looks like this tree's own
 * habits, is a KEPT height as a token to fill - `minmax(var(--ui-chart-keep-h), 1fr)` with
 * the token starting at the card's own floor, the same shape M3 uses for the band. It is
 * not built here because inventing that token IS the decision Q2 owns.
 * Full record, with both tables: waves/5.1/DEFERRED_QUESTIONS_fix-1.md §1.
 *
 * ===========================================================================
 * THE CHART REGION - THE ONE PART OF THIS SCREEN THAT CARRIES DATA
 * ===========================================================================
 *
 * The 1fr row holds <ui-chart-card> (#9, wave 3) and it is fed the way its own file
 * says a screen feeds it: "a screen hands it deriveFromBuffer(buffer) and the card
 * draws that". The road is `ChartFeed` (src/lib/chart-feed.js) - watch the shot
 * buffer, run gate 6's derivation at most once per frame, hand the bundle over. This
 * file therefore reaches no store and no endpoint: `shot` is a property, and the app
 * shell's `live.shot` is what the wiring row will set on it.
 *
 * THREE THINGS THE INTEGRATION OWNS, each a numbered chart defect (§7.8):
 *
 *   chart-C13  the chart is FED FROM THE MODEL. The derivation bundle is the only
 *              input; nothing here reads another component's rendered DOM, which is
 *              what `chart.js:1664-1678` did with a regex over five element ids.
 *   chart-C14  the canvas gets a TEXT ALTERNATIVE and an aria-live SUMMARY. The
 *              alternative is the card's own `role="img"` plus the name this screen
 *              supplies; the summary is the polite region below, whose sentence is
 *              built from the derivation's own scalars (B5) and NOT from the gauge
 *              cluster's rendered numbers. It re-announces on a state change or every
 *              fifth second OF THE SHOT'S OWN CLOCK - a live region rewritten at 15 Hz
 *              is a live region nobody can use, and a wall clock here would be a
 *              second clock disagreeing with the shot's.
 *   A5 / A6    the channel set and every colour in it belong to the card and the token
 *              sheet. This screen names no channel and states no colour: the card's
 *              DEFAULT_CHANNELS is "the Live set, in draw order" and the eighteen
 *              --ui-channel-* tokens are read from the host's computed style. Passing
 *              `channels="..."` here would be a second place the Live set is written.
 *
 * B4 rides through untouched: `axis.t` is ReaPrime's arrival stamps minus the chosen
 * origin, jitter included, and nothing on this road resamples or reconstructs it.
 *
 * ===========================================================================
 * THE READ PATH IS END TO END. THERE IS NO WRITE PATH. (wave 5.1, in one line)
 * ===========================================================================
 *
 * Everything that arrives - the machine's state, the shot, the connection, the capability
 * gates, the refusal - reaches a pixel through a store and the generated client, and the
 * loop proof drives it at 15 Hz over a real socket. Everything that LEAVES is another
 * row's: this screen dispatches `target-change`, `warmer-toggle`, `favourite-select`,
 * `library-open` and `header-action`, and `<ui-stop-button>` dispatches `stop-request`.
 * `live-wiring.js` listens to FOUR of them — `connect-device`, `refusal-dismiss`,
 * `target-change` (the rail's write half, P-1) and `warmer-toggle` (the mat's) — and
 * NOTHING under `src/` listens to the rest. So a favourite selected, Sleep pressed and
 * a stop requested are local state or nothing at all.
 *
 * `mode-change` is no longer dispatched at all: the mode picker went with Ben's
 * standing-rail ruling.
 *
 * `stop-mode-change` IS GONE FROM BOTH ENDS since 30 August 2026, and it is worth saying
 * why rather than just deleting the line. It was L25's fix: the caption under STEAM and
 * HOT WATER was a `<ui-button>`, and pressing it swapped the mode and wrote the machine's
 * own field. Ben withdrew it — "these labels (Timed Stop and Weight Target) are actual
 * toggles, even though it wasn't clear they were" — which is the strongest case against
 * it: a control that reads as a caption is a control nobody presses.
 *
 * THE DISPATCH, THE LISTENER AND BOTH ARMING METHODS WENT TOGETHER, deliberately. Leaving
 * either half would have left a wire with one end, and `gate-wire` reports zero dead wires
 * only while both stay removed. The mode's home is now Settings alone —
 * `machine-steam-stop` and `machine-water-stop` in `settings-leaves.js` — which is where
 * Slate's own working control lives too. (The listener COUNT four lines up is stale in the
 * same direction: `hostConnected` binds nine handlers today.)
 *
 * That is legitimate - each is a later row - but it has to be SAID, because three digests
 * describe this screen as the live loop "end to end" and a reader who has not counted the
 * listeners will read that as both directions. It is one gap and not six: wave 5.1 built
 * the read path end to end and no write path at all.
 *
 * ===========================================================================
 * PLACEHOLDER CONTENT - WHAT IT IS AND WHAT IT IS NOT
 * ===========================================================================
 *
 * The grey boxes below are placeholders and are marked `data-placeholder`. They are
 * deliberately not controls: no roles, no selection treatment, no press behaviour.
 * The one component law that matters here is that a hand-built copy of a library
 * control is the L8 defect class, so where the SKELETON's correctness depends on a
 * real component's own contract, the real component is used and nothing is imitated:
 *   - <ui-chart-card> (#9), because the `1fr` row's floor IS that card's declared
 *     min-block-size, and a stand-in would prove a floor nothing else has;
 *   - <ui-stat-tile> (#33), because the gauge cluster is where bug L2 lives (a 44px
 *     value track under 45-52px digits) and that tile owns the value-track rule.
 * The favourites bank, the rail's steppers, the STOP target, the phase table and the
 * GHC strip are `live-components-inventory`'s row, not this one; their slots are here
 * and their contents are placeholders.
 *
 * D2: every string a person can read is a value read through I18nController, from
 * this file's first commit. English only in v1; the mechanism is never deferred.
 *
 * This screen talks to no endpoint and reads no store: screens are "components, but
 * layout-only" (src/screens/README.md, SCOPE Part 2 §3). The 15 Hz loop, the machine
 * state, the capability gates and the refusal surface are the other wave-5.1 rows.
 */

import { css, html, svg, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { ChartFeed } from 'src/lib/chart-feed.js';
import { CLOCK_TICK_MS, DEFAULT_CLOCK_FORMAT, wallClock } from 'src/lib/wall-clock.js';
/* THE BAND'S OWN TWO READERS AND ITS ONE FORMATTER (parity 7-live-polish). The last
 * shot's date and title are read the way every other surface in this tree reads them,
 * and every scalar in the band is spelled by the one function that owns the dash. */
import { scalarText, shotClock, shotGrind, shotTitle } from 'src/lib/shot-summary.js';
/* THE NOTES SHEET'S ONE READER (audit F-029). `annotations` is authoritative and the
 * top-level `shotNotes` is its shadow — CONTRACTS.json putShotsById says so in those
 * words — so the sheet reads the annotation through the module that owns the shape,
 * and never re-derives it here. */
import { readShotAnnotations } from 'src/data/rea-shot-record.js';
import { I18nController } from 'src/lib/i18n.js';

import {
    RAIL_ROW, STEAM_STOP, WATER_STOP, MACHINE_KEYS, STOP_STATE, DEFAULT_PRESETS,
    PHASE_COLUMNS, bandDerivationFor, isRunning, machineKeyGate, phaseRows, railRows, stepFor,
    numpadBandFor,
} from 'src/lib/live-targets.js';
import {
    CHART_MODE, STEAM_Y_RANGE, STEAM_Y2_RANGE, steamChannelSpecs, steamEndLabels,
} from 'src/lib/steam-chart.js';
import { SHOT_Y_RANGE } from 'src/lib/chart-autoscale.js';

/**
 * WHAT EACH STEAM TRACE CALLS ITSELF AT ITS OWN END.
 *
 * Slate's four words, from `steamChartTraceSpecs`: Pressure, Flow, Steam, Milk. Short on
 * purpose — the label is drawn INSIDE the plot at the end of its line, so it competes with
 * the trace for room, and "Steam temperature (°C)" would cover the last two seconds of the
 * session it is labelling.
 *
 * THE TARGET IS NOT IN THIS TABLE and is not meant to be: `steamEndLabels` drops it before
 * anything reaches here, for Slate's reason — "a command, not a measurement".
 */
const CHANNEL_END_LABELS = Object.freeze({
    pressure: 'Pressure',
    flow: 'Flow',
    steamTemperature: 'Steam',
    milkTemperature: 'Milk',
});

/* THE CONNECTION-AND-GATES CLUSTER (B8, B9, A3, L1, L11). The paint half of the ONE
 * dimming owner, and the controller that turns the shell's stores into the two properties
 * below — see `live-wiring.js` for why a controller and not five subscriptions here. */
import { liveDimming, railDimGroup, railKeepsInput } from 'src/screens/live-dimming.js';
import { isMachineAsleep } from 'src/lib/screensaver-policy.js';
import { LiveWiring } from 'src/screens/live-wiring.js';

import 'src/screens/live-header.js';
import 'src/screens/live-rail.js';
import 'src/screens/live-main.js';
import 'src/screens/live-foot.js';
import 'src/screens/live-connection.js';
import 'src/screens/live-refusal.js';
import 'src/components/ui-chart-card.js';
import 'src/components/ui-stat-tile.js';
/* THE BANDS' CONTENT — every one a library component, composed. A hand-built copy of
 * any of them is the L8 defect class and a wave block, so there is no local button, no
 * local selected look and no local table in this file: the four --ui-selected-* dials
 * are reached through <ui-bank> and through the two components that are uses of it
 * (#36 favourites, #37 presets), and nothing else here expresses selection at all. */
import 'src/components/ui-bank.js';
import 'src/components/ui-favourites-bank.js';
import 'src/components/ui-preset-bank.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-numeric-keypad.js';
import 'src/screens/live-expanded-chart.js';
import 'src/components/ui-stop-button.js';
import 'src/components/ui-menu.js';
import 'src/components/ui-data-grid.js';
import 'src/components/ui-rating-control.js';
import 'src/components/ui-weather-corner.js';
import 'src/screens/weather-modal.js';
import { WEATHER_STATE, weatherState } from 'src/lib/weather-model.js';
import { WEATHER_PLUGIN_ID } from 'src/lib/weather-model.js';
import 'src/components/ui-status-chip.js';
import 'src/components/ui-button.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-empty-state.js';
/* THE NOTES SHEET'S BODY (Ben's decision D14). #55's own header: "a dialog BODY, not a
 * dialog" — it fills `slot="body"` and owns no scrim, no trap and no Escape arbitration,
 * which is why it composes into `<ui-dialog>` rather than replacing it. */
import 'src/components/ui-notes-editor.js';

/** The one dash spelling in the tree, borrowed from the component that owns it rather
 *  than typed again here: "an em dash says not applicable here; an empty cell says we
 *  forgot" (`ui-data-grid.js`, quoting `history-viewer.js:827-830`). */
import { DEFAULT_DATA_GRID_DASH } from 'src/components/ui-data-grid.js';
import {
    toDisplayLevel, normaliseTankUnit, tankDecimals, DEFAULT_TANK_UNIT,
} from 'src/lib/tank-volume.js';
import {
    normaliseUnit, toDisplayTemp, fromDisplayTemp, unitSymbol,
    decimalsForStep, DEFAULT_TEMP_UNIT,
} from 'src/lib/temperature.js';
/* WHERE THE FOOT CORNER'S THIRD BUTTON GOES. Both constants are the manifest's own
 * spelling, and they live in `src/lib/` rather than beside `pageUrl` in `plugins-store.js`
 * for one reason: this file may not import a store. `test/live-screen.test.mjs` pins that
 * over the source text of the five skeleton files, and `plugin-pages.js` carries the whole
 * argument — including why `bean-picker` rather than the `ui` endpoint `pluginPage()`
 * looks for, and why "for now" means a destination and nothing carried with it. */
import { DYE2_PLUGIN_ID, DYE2_PAGE_ENDPOINT } from 'src/lib/plugin-pages.js';

/**
 * WHAT THE DYE2 BUTTON SAYS, AND WHY IT IS NOT SLATE'S WORD.
 *
 * `ui-rating-control`'s built-in label is Slate's own — "Full notes", `index.html:444`,
 * the text on `#shot-dye-btn`. That word was honest in Slate, where the button was the
 * only route to a shot's notes AND to DYE. It is not honest here for two reasons, and the
 * component was built with a `handoffLabel` override for exactly this kind of call.
 *
 * FIRST, THIS CORNER ALREADY HAS A NOTES BUTTON. Ben asked for it on 25 August — "Add a
 * new button under this input that has I can enter 'ALL NOTES'" — and it sits directly
 * above the handoff. "All notes" over "Full notes" is two buttons a hand's width apart
 * whose words a reader cannot tell apart, going to two entirely different places.
 *
 * SECOND, THE DESTINATION IS NOT NOTES AT ALL. It is DYE2's bean picker (Ben, 27 August
 * 2026), which is bean and grinder management — a different product's page.
 *
 * ===========================================================================
 * AND IT IS NAMED FOR WHAT IT OPENS, NOT FOR WHO WROTE IT — "Beans"
 * ===========================================================================
 * Ben, 30 August 2026 (decisions page, F-028): **"Relabel to Beans."**
 *
 * The word was "DYE2" until then, on the argument one line up that "a button should be
 * named for where it goes, and the name of where it goes is DYE2". That argument had the
 * right rule and the wrong noun. "DYE2" is the name of the PLUGIN — a vendor's product
 * name a person has to already know — while the page it opens is a bean picker, and
 * "Beans" is what the person pressing it is going to do. Slate's own "Full notes" failed
 * the same test from the other side: it named a destination this button does not have.
 *
 * F-028 IS THE FINDING THAT PRODUCED THE RELABEL, AND THE RELABEL IS NOT ITS FIX. The
 * finding is that the handoff carries no shot id, so the picker cannot know which shot it
 * was opened from; Wave 4 proved that handoff STRUCTURALLY unavailable (DYE2 reads only
 * `sessionStorage` on its own origin and declares no URL parameter), so it stays in the
 * app-side dossier for a plugin-side change. What Ben settled here is the WORD. The
 * behaviour is deliberately untouched: the press still fires `dye-handoff`, `#openDye2`
 * still opens `DYE2_PAGE_ENDPOINT`, and the button is still gated on the plugin being
 * loaded at all.
 *
 * IT IS STILL RUN THROUGH `t()`, as every string reaching a template in this tree is.
 * Note for the i18n sweep: `i18n/source/strings.json` still carries the old row and not
 * this one, which is invisible in the source language (`src/lib/i18n.js` falls back to the
 * key) and is translation debt, not a break — the same debt round 2 recorded for five
 * other relabelled strings, to be closed in one pass rather than five patches.
 */
const DYE2_BUTTON = 'Beans';

/**
 * The header's action cluster. Slate's three, whose English widths the old header's
 * 133px of slack depended on (§4.1) - here they are values (D2) in a flex cluster
 * that cannot collide with the one beside it whatever they become.
 *
 * ===========================================================================
 * EVERY CONTROL ON THIS BAND IS TALL, AND THE BAND ALREADY SAID SO (parity surface 1)
 * ===========================================================================
 * Slate names this size: `--slate-control-lg: 82px  / toolbar controls that carry a
 * whole screen /` (slate-tokens.css:32), and derives the band from it —
 * `--slate-header-height: calc(var(--slate-control-lg) + 2 * var(--slate-header-inset))`
 * = 82 + 36 = 118. Decal carries BOTH: --ui-control-lg 82px and --ui-band-h derived
 * the same way (styles/tokens.css:96, :231), and this screen's row 1 IS --ui-band-h.
 *
 * The band was therefore 118px tall around 64px controls: 27px of dead space above and
 * below every one of them, and a derivation whose own premise the band contradicted.
 * Worse, it was INCONSISTENT WITH DECAL ITSELF — <ui-page-header>'s Save is
 * --ui-control-lg and renders 82 on the Settings screen (its suite asserts it), so one
 * skin drew two different toolbar heights on two screens through one token. That is
 * exactly the drift Ben asked the rewrite to end, and it was on the screen he looks at
 * most.
 *
 * The fix is the attribute both components already had for it — <ui-button tall> and
 * <ui-icon-button size="lg"> — so no geometry is written here and nothing new is
 * declared.
 *   ORACLE  live-ready #edit-profile-btn [i=12] height = 82px, min-height = 82px,
 *           rect=[1408,18,152,82]; #settings-btn [i=13] the same 82;
 *           #profile-open-selector [i=8] rect=[30,18,82,82]; #sleep-button [i=14]
 *           rect=[1688,18,96,82]; and the band <header> [i=1] min-height = 118px.
 *           82 + 2*18 = 118 exactly, which is why the controls sit at y=18 and not 27.
 */
/* SLEEP IS A WORD AGAIN, AND THAT IS A RESTORE (parity 7-live-polish).
 *
 * It shipped as `<ui-icon-button>` with a crescent glyph, on this file's own reasoning
 * for the LIBRARY control ("a glyph, an accessible name, and no text whose length
 * another cluster depends on"). That reasoning is right for the library button, whose
 * oracle IS an icon button — #profile-open-selector [i=8], no text at all — and wrong
 * here, because Slate draws Sleep as a TALL TEXT BUTTON and puts the icon at the OTHER
 * end of the cluster:
 *   ORACLE live-ready #sleep-button [i=14] `.slate-btn slate-btn-tall` rect
 *          [1688,18,96,82] text "Sleep" — a word, 17px/500, beside #settings-btn's
 *          identical treatment;
 *          #fullscreen-toggle-btn [i=15] `.slate-icon-btn slate-icon-btn-lg
 *          slate-icon-action` rect [1794,18,96,82], no text — THE cluster's icon.
 * So the cluster reads Warmer · Edit profile · Settings · Sleep · ⛶, and the moon glyph
 * at the end of Decal's band was not Slate's Sleep in a different dress; it was
 * Slate's Sleep wearing the fullscreen control's slot while the fullscreen control was
 * missing. Making Sleep a word puts both back in one move.
 */
/* TWO WORDS, NOT THREE — Ben, 23 Aug 2026, on the glass: "We dont need the sleep button
 * OR the full sreen button, those that are on the far right." That reverses it14's
 * restoration of Slate's five-control cluster, and it reverses it DELIBERATELY: the
 * precedence chain puts Ben's decisions above Slate-as-photographed, and both removed
 * controls were composed-but-unwired anyway (see app-intents.js). It also pays for the
 * band width he asked for in the same breath — a bigger gap between the favourites and
 * the Warmer toggle — because the two controls Slate spends ~192px on here are gone. */
/**
 * THE ACTION CLUSTER'S BUTTONS, LEFT TO RIGHT, after the warmer.
 *
 * SLEEP IS BACK, AND ITS REMOVAL IS ON RECORD SO ITS RETURN SHOULD BE TOO. Ben, 23 August
 * 2026, took it off — `key-bindings.js` still carries the note ("Sleep has no button on
 * this skin's Live screen — Ben removed it on 23 Aug") — and on 25 August 2026: "I think
 * I have changed my mind and please add a sleep button on the top right, to the right of
 * settings."
 *
 * IT IS NOT A ROUTE AND THIS TABLE DOES NOT SAY SO. Every entry here is a NAME the header
 * announces through `header-action`; `app-intents.js` holds the two tables that say what
 * a name means, one for routes and one for machine commands, and Sleep is in the second.
 * The button is the same button either way, which is the point of announcing rather than
 * doing.
 */
const ACTIONS = Object.freeze(['Edit profile', 'Settings', 'Sleep']);

/**
 * The one affirmative action on this band, painted as one (parity surface 1).
 *
 * SLATE NAMES IT, in the sheet, in these words (slate-components.css, above
 * `.slate-primary-action`): "Semantic alias: the one affirmative action on a screen.
 * Live's Edit Profile and the routed headers' Save/Confirm all mean the same thing, so
 * they carry the same name — screen-specific geometry may still refine it."
 *   ORACLE  live-ready #edit-profile-btn [i=12] class="slate-btn slate-btn-tall
 *           slate-btn-primary"; background-color = rgb(23, 59, 77) <- .slate-btn-primary
 *           authored `background: var(--slate-primary)`; color = rgb(246, 251, 253)
 *           <- `var(--slate-on-primary)`; border-top-color = color(srgb 0.258196
 *           0.381804 0.443608) <- `color-mix(in srgb, var(--slate-primary) 72%,
 *           var(--slate-steel))`. Every one of the three is <ui-button variant="primary">
 *           in this tree, declaration for declaration (ui-button.js).
 *
 * IT WAS ALSO INCONSISTENT WITH DECAL ITSELF, which is the half that makes it worth
 * fixing here rather than noting: <ui-page-header> already paints the Settings screen's
 * Save `variant="primary"`, so the skin had one semantic ("the affirmative action") and
 * two treatments on two screens — and the untreated one was the Live page.
 *
 * The OTHER two Slate fills on this band are NOT restored, and both refusals are
 * catalogued rather than chosen: Settings and Sleep render #101117/white from
 * dark-mode.css:95-98, which the audit's findings-digest measures as one of the two
 * surfaces where "change the tokens and the whole appearance changes" is FALSE ("#101117
 * exists in no Slate palette", "both in frozen[]"). Painting them would restore that
 * hole. See the classify table for the row.
 */
const PRIMARY_ACTION = 'Edit profile';

/** The one action whose label is not its name — see `#actionLabel`. */
const SLEEP_ACTION = 'Sleep';


/**
 * The symbol beside ONE rail control's number: the row's own word when it declares one,
 * otherwise the R2 table's.
 *
 * ONE FUNCTION BECAUSE THERE ARE TWO CONTROLS AND THEY MUST NOT DISAGREE. The stepper in
 * the rail and the numpad that opens over it are two renderings of one target, and each
 * used to spell `row.range.unit` for itself. That was harmless while the unit came only
 * from the limits table; it stops being harmless the moment a row can restate it (see
 * `STOP_TARGET`'s hot-water weight entry), because a typed value would then be captioned
 * in millilitres over a rail reading grams.
 *
 * WHAT THIS DOES NOT REACH, SAID OUT LOUD: the numpad's own RANGE HINT. `<ui-numeric-keypad>`
 * composes that line from `numpadRange(limits, limitKey)` and its file states the rule it is
 * keeping — "the port's own sentence for the range … Never assembled here" — so the hint
 * reads the RAW R2 row and says "0–255 mL" under a weight stop while the well beside it says
 * g. That is not a defect this change introduced; it is one instance of a family that is
 * already shipping, and the louder instance is temperature: in Fahrenheit the same hint
 * reads "70–110 °C" beside a well reading °F, on every temperature row, today. Both want the
 * same fix — a display unit the port is TOLD rather than one a screen substitutes — and it
 * belongs in `machine-limits.js` and the keypad, in one pass, not half of it here.
 */
const unitForRow = (row) => row?.unit ?? (row?.range?.unit ? row.range.unit : '');

/**
 * A gauge's two per-tile properties, as an inline style or nothing.
 *
 * BOTH ARE SEAMS <ui-stat-tile> ALREADY DECLARED, and both are the cluster's to fill:
 * "--_ui-stat-ink  the reading's colour" and "--_ui-stat-value-tracking  the reading's
 * tracking" (ui-stat-tile.js's own API block). The tile owns no channel table and no
 * per-gauge exception; this list is where a gauge says which channel it is and how tight
 * its digits are, so a sixth gauge is one row here and nothing else anywhere.
 *
 * THE TRACKING IS SLATE'S ONE PROMOTED READOUT. Departure 4 said "every tile reads
 * normal, as six of Slate's seven do" — and the seventh is TIME, the only one Slate
 * draws at --slate-display-xl. The value is --ui-tracking-readout, whose own note in
 * styles/tokens.css carries the source rule and the oracle record; every other gauge in
 * the corpus reads normal, so this is Slate's exception and not its rule — expressed as
 * this gauge's property, through the seam the tile declares, rather than as a default
 * every readout in the skin would inherit.
 *
 * AND THE UNIT GOES UP WITH IT, for the same reason and from the same rule:
 *   SOURCE slate-live.css:979  #main-page .slate-gauge-time strong small
 *          { font-size: var(--slate-text-note) }
 *   ORACLE live-ready <small> [i=98] "s" font-size = 16px against every other gauge
 *          unit at 14px ([i=101] "bar", [i=104] "mL/s", [i=109] "°C").
 * <ui-stat-tile>'s departure 5 — "one size for every tile's unit" — stays the DEFAULT
 * and stays true of every tile that says nothing; what changes is that the one gauge
 * Slate promotes whole is promoted whole here too, through the seam the tile declares
 * (--_ui-stat-unit-size) rather than by a rule about Time inside the component.
 */
/**
 * A number formatter for a rail target, memoised by its decimal count.
 *
 * THE PRECISION FOLLOWS THE MACHINE'S STEP, NOT THE CONVERTED ONE. Left to itself the
 * stepper takes its decimals from `step`, and a converted band has a converted step: steam
 * is 1 °C, which is 1.8 °F, which would print "320.0" where the Celsius face prints "160".
 * Ben, 26 August 2026: "rounding to same decimal place as the original value."
 *
 * MEMOISED BECAUSE lit COMPARES PROPERTIES BY IDENTITY. A closure built fresh in `render`
 * is a new object every frame, so `.format` would be written on every render even when
 * nothing about it had changed — and this screen re-renders at 10 Hz during a shot.
 */
const RAIL_FORMATTERS = new Map();
const railFormatter = (decimals) => {
    if (!RAIL_FORMATTERS.has(decimals)) {
        RAIL_FORMATTERS.set(decimals, (value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return String(value);
            return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
        });
    }
    return RAIL_FORMATTERS.get(decimals);
};

const statTileStyle = (gauge) => {
    const parts = [];
    if (gauge.ink) parts.push(`--_ui-stat-ink: ${gauge.ink}`);
    if (gauge.tracking) parts.push(`--_ui-stat-value-tracking: ${gauge.tracking}`);
    if (gauge.unitSize) parts.push(`--_ui-stat-unit-size: ${gauge.unitSize}`);
    return parts.length ? parts.join('; ') : nothing;
};

/**
 * THE CLUSTER DOES NOT RECOMPOSE. READ THIS BEFORE "RESTORING" ANY OF IT.
 *
 * ===========================================================================
 * BEN OVERRODE SLATE'S WHOLE RULE ON 29 AUGUST 2026. IT IS NOT MISSING.
 * ===========================================================================
 * "Fair but I find it distracting. Lets not change the size or colour of them." — and,
 * on the promotion the first pass kept: "don't have them grow."
 *
 * Slate recomposed the cluster in BOTH directions while a shot ran: four numbers grew to
 * `--slate-display-xl` and three receded to `--slate-muted` at `--slate-display-sm`.
 * DECAL DOES NEITHER. Every tile holds its resting size and its channel ink from idle
 * through the pour and out the other side. No record carries `running` or `recedes` any
 * more, `statTileStyle` does not take the machine state, and `gaugeSize` is a lookup of
 * one field.
 *
 * WHAT IS LOST, STATED HONESTLY: the cluster no longer says which numbers are carrying the
 * shot. Slate's argument for the recomposition was a real one, and it is quoted in full
 * below. Ben has stood in front of the machine and judged the movement more distracting
 * than the emphasis is useful. That is a call the oracle cannot make.
 *
 * THE CITATIONS BELOW ARE STILL TRUE OF SLATE AND ARE KEPT FOR THAT REASON. They are the
 * measured record of what the old skin did; they are NO LONGER a statement of what this
 * one should do. A parity pass that reads them as a defect and re-adds either half is
 * undoing a decision, not fixing a regression — check with Ben first.
 *
 * `reserve="xl"` STAYS ON EVERY TILE even though nothing resizes now. It is what keeps the
 * value track sized for the largest digits the tile can hold, so a number that changes
 * width cannot move its neighbours — the L2 defect. It was never only about the promotion.
 *
 * Slate's own rule, which this file no longer follows — by WEIGHT, never by position
 * (Appendix item 3, "state changes weight, never position"):
 *   SOURCE slate-live.css:2101-2110  #main-page[data-live-state="pulling"] :is(
 *          .slate-gauge-weight, .slate-gauge-time, .slate-gauge-pressure,
 *          .slate-gauge-flow) strong { font-size: var(--slate-display-xl) }
 *          with its own comment: "The four that are changing 15 times a second. Weight
 *          and Time carry the shot; Pressure and Flow carry what the puck is doing."
 *   SOURCE slate-live.css:2083-2098  the same state on :is(.slate-gauge-group,
 *          .slate-gauge-steam, .slate-gauge-tank) strong { color: var(--slate-muted);
 *          font-size: var(--slate-display-sm) } — "They stay legible: this is a
 *          demotion, not a hide."
 *   ORACLE live-pulling #slate-live-pressure [i=103] font-size = 52px and
 *          #slate-live-flow [i=106] = 52px, against 45px at live-ready;
 *          #data-group-temp [i=111] = 30px and muted, against 45px at live-ready.
 *
 * <ui-stat-tile> was BUILT for this and its own header says so — "Rest 45px -> pulling
 * 52px on the same element is the promotion, and it is the whole of what L2 breaks" —
 * and every tile here already carries reserve="xl", so the track was already the promoted
 * size and NOTHING MOVES when the size changes. What was missing was the trigger: the
 * sizes were static, so the cluster looked the same mid-shot as at rest. It took a second
 * Slate state to see it, which is why this pass diffed one.
 */
const gaugeSize = (gauge) => gauge.size || 'lg';

/** The sleep control is the one icon button (#2) on this band: a glyph, an accessible
 *  name, and no text whose length another cluster depends on. `currentColor` so it
 *  follows the button's ink through both themes; no colour is written here. */
/**
 * THE WAY IN TO THE PROFILE LIBRARY — Slate's own control, and its own shape.
 *
 *   ORACLE live-ready #profile-open-selector [i=8] `.slate-icon-btn` rect [30,18,82,82],
 *          an ICON button at the head of the band, with no text at all.
 *
 * Decal drew a text button there instead, and once the loaded profile's name was
 * wired (Ben's ruling, 22 Aug 2026) that button started rendering the very string the
 * first favourite slot and the chart card's heading already carry — the same name three
 * times across one screen, in a band whose favourites were being squeezed for width.
 * The accessible name is unchanged; only the paint is. Drawn to this file's glyph recipe:
 * 24x24 viewBox, currentColor, 2px round joins, aria-hidden because the name is the
 * control's `label`.
 */
/**
 * THE BAND'S TWO ARROWS — Ben, 23 Aug 2026: "The history pannel part on the left needs
 * left and right arrows to allow navigating between old shots in the history, this
 * should update the chart etc."
 *
 * Slate has the pair (#history-prev-btn beside its own panel) and Decal's digest
 * carried them as a DECLARED DROP — "paging back through stored shots is what Slate's
 * #history-prev-btn does and what the History screen does properly". Ben has reversed
 * that drop, so they are built to this file's own glyph recipe: 24x24 viewBox,
 * currentColor, 2px round joins, aria-hidden because the name is the control's label.
 *
 * BACK IS OLDER AND IT POINTS LEFT, which is the direction the list runs: the page is
 * newest-first, so stepping left is stepping back in time. The wiring's `shot-step`
 * carries +1 for older and -1 for newer, and the words are on this side of that event
 * so the handler never has to know which way round the list is.
 */
const OLDER_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

const NEWER_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;

const LIBRARY_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><path d="M3 6h13"/><path d="M3 12h7"/><path d="M3 18h7"/><circle
    cx="16.5" cy="15.5" r="3.5"/><path d="M19 18l2.5 2.5"/></svg>`;

/* THE BAND'S OTHER ICON CONTROL IS GONE, and its glyph with it. Slate has one at the
 * end of the cluster — ORACLE live-ready #fullscreen-toggle-btn [i=15] `.slate-icon-btn
 * slate-icon-btn-lg slate-icon-action` rect [1794,18,96,82] — and it14 restored it here
 * to match. Ben removed it on 23 Aug 2026 along with Sleep: "We dont need the sleep
 * button OR the full sreen button." A departure from the oracle, on his word, recorded
 * where the control used to be so the next reader does not restore it as a gap.
 *
 * Its long note also carried this file's record of the missing shell listener — "Edit
 * profile, Settings and Sleep have had the same silence since the band was built …
 * a shell listener is another surface's work". That surface now exists:
 * src/lib/app-intents.js, installed by app-root. */

/**
 * The gauge cluster, as Part 5 describes it: time promoted, the rest equal.
 *
 * FIVE, AND THE NUMBER IS A MEASUREMENT. A stat tile is its content's width (it opts
 * out of inline-size containment, because its display type is a cqi clamp that has to
 * read an ancestor), so at the 1000x600 design floor a tile is ~90px and the cluster
 * has 643px: five tiles and four gutters fit on one row, six do not. Seven - the set
 * the tile's own gallery entry shows at 1375px - wraps to two rows there, costs the
 * chart 72px and puts it on its floor with <live-main> overflowing, which is the one
 * thing §4.1 forbids at or above the design floor. WHICH readings the real cluster
 * carries, and what a sixth one costs, is live-components-inventory's row; what this
 * file records is that the design floor pays for five of them.
 *
 * NO VALUES, AND THAT IS THE POINT (A7). This list carried '24.6' / '9.0' / '2.1' /
 * '36.2' / '92.4' until the wave-5.1 review measured what they became once the loop was
 * wired underneath them: five readings that never changed, byte-identical across 200
 * in-shot samples, next to a chart and a phase table that were live — a capture shows
 * WEIGHT 36.2 g in this cluster while the band beneath it reported -180.8 g for the same
 * shot. A frozen number that looks like a reading is the A7 fabrication class, and it is
 * the one placeholder on this screen a person could not tell from telemetry. So the tiles
 * are handed NO value: `<ui-stat-tile>` renders its own dash for an absent one ("`null` /
 * `undefined` / '' are ABSENT and render the dash; 0 is a READING"), which is the same
 * spelling the phase table uses for an absent channel and the rail uses for a value the
 * machine has not sent. The label and the unit stay, because they are the promise of what
 * will be here; the number arrives with live-components-inventory's row.
 *
 * WHERE THE WIDTH PROOF WENT. The five-tiles measurement above was taken with those
 * representative digits, and a dash is narrower than "24.6" — so the geometry it proves
 * would quietly stop being proved. It is now proved where it belongs: the skeleton suite
 * fills the five tiles with representative readings before it stresses the type
 * (`live-screen.render.test.mjs`, §2.4), so the cluster is measured at the width the real
 * cluster will have, without this screen shipping a number nobody measured.
 *
 * ===========================================================================
 * THE CHANNEL INK (parity surface 1; surface 0's finding F-9 is its evidence)
 * ===========================================================================
 * Slate paints a data-bearing readout in ITS OWN CHANNEL'S colour, and the gauge that
 * is not data-bearing keeps the plain ink. The cluster owns the table because the tile
 * does not: "A CHANNEL TINT ARRIVES HERE FROM THE CLUSTER — this component owns no
 * channel table" (ui-stat-tile.js). The map is the canonical one, the same
 * --ui-channel-* names the chart's own series read, so a channel cannot be one colour
 * on the plot and another six inches above it.
 *
 *   ORACLE  live-ready #slate-live-pressure [i=100] color = rgb(46, 194, 126)
 *           <- slate-live.css {#main-page .slate-gauge-pressure strong > span}
 *           authored `var(--slate-data-pressure, var(--slate-live-pressure))`
 *   ORACLE  live-ready #slate-live-flow [i=103] color = rgb(57, 123, 206)
 *           <- {#main-page .slate-gauge-flow strong > span} authored
 *           `var(--slate-data-flow, var(--slate-live-flow))`
 *   SOURCE  slate-live.css:982  .slate-gauge-weight strong > span  ->
 *           `var(--slate-data-weight-flow, ...)`  = #8b6343
 *   SOURCE  slate-live.css:998  .slate-gauge-group  strong > span  ->
 *           `var(--slate-data-group-temperature, ...)` = #c94e4b
 *   SOURCE  chart-palette.js:16-22 installs those four --slate-data-* names on :root
 *           for BOTH themes, which is why the var() fallbacks never apply (F-9).
 *   ORACLE  live-ready #slate-live-time [i=97] color = rgb(244, 247, 248), no
 *           declaration — TIME IS NOT A CHANNEL and takes no tint. It is the one
 *           gauge with no trace on the plot.
 *
 * WHY THE TWO THE BRIEF CALLED "text-2" AND "muted" ARE NOT WIRED THAT WAY. At
 * live-ready the oracle renders #data-weight in --slate-text-2 and #data-group-temp in
 * --slate-muted, but neither is that gauge's ROLE: the weight record carries
 * `.slate-gauge-action` (its value slot is holding a Retry button, because the scale
 * has dropped) and the group record carries `.slate-gauge.slate-is-absent` (its value
 * is an em dash). Both are STATE rules, and both are Slate's own general ones —
 *   ORACLE  live-ready #data-weight [i=106] color <- {#main-page
 *           #data-weight.slate-gauge-action} authored `var(--slate-text-2) !important`
 *   ORACLE  live-ready #data-group-temp [i=108] color <- {#main-page
 *           .slate-gauge.slate-is-absent strong > span, ... strong} authored
 *           `var(--slate-muted) !important`
 * — so the role is the channel and the state is the exception. Reading the rendered
 * value as the role is exactly the declaration-vs-render error surface 0 was written
 * about, one step the other way. The absent half lives in <ui-stat-tile> (every tile
 * with no reading goes muted, which is what these five render today); the action half
 * arrives with the scale-retry affordance, which is live-components-inventory's row.
 */
const GAUGES = Object.freeze([
    {
        key: 'time',
        label: 'Time',
        unit: 's',
        size: 'xl',
        ink: null,
        tracking: 'var(--ui-tracking-readout)',
        unitSize: 'var(--ui-text-note)',
    },
    { key: 'pressure', label: 'Pressure', unit: 'bar', size: null, ink: 'var(--ui-channel-pressure)' },
    /* "mL/s", not "ml/s" — Slate's own spelling and the unit's own rule, which
     * <ui-data-grid> already quotes verbatim from slate-live.css:1334-1336: "mL is a
     * unit, and ML is a different one". The same sentence rules out the lowercase l.
     * ORACLE live-ready <small> [i=104] text "mL/s". */
    { key: 'flow', label: 'Flow', unit: 'mL/s', size: null, ink: 'var(--ui-channel-flow)' },
    /* THE ONE TILE THAT IS ALSO A CONTROL. Ben, 23 Aug 2026: "with slate, if you tough
     * the weight value it sends the tare command to the machine resetting the weigh to
     * 0.0g." Declared on the ROW rather than special-cased in the template, so the
     * gesture travels with the thing it belongs to and a second one costs a field. */
    {
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        size: null,
        ink: 'var(--ui-channel-weight-flow)',
        press: 'tare',
        /* WITHDRAWN WHILE STEAMING — see `notSteam` below and Slate's own stylesheet. */
        notSteam: true,
    },
    {
        key: 'group',
        label: 'Group',
        unit: '°C',
        size: null,
        ink: 'var(--ui-channel-group-temperature)',
        notSteam: true,
    },
    /* THE SIXTH AND SEVENTH, AND BOTH ARE RESTORES (parity 7-live-polish). Slate's
     * cluster is SEVEN tiles — ORACLE live-ready [i=110] "Steam" #data-steam-temp
     * [i=111] and [i=113] "Tank" #data-tank-vol [i=114] — and the rewrite shipped five,
     * because the design floor pays for five ("a tile is ~90px and the cluster has
     * 643px at 1000x600"). The cluster WRAPS (see .gauges), so the floor pays for seven
     * on two lines rather than for five on one; nothing is dropped to make a row fit.
     *
     * Steam comes back because the machine SERVES it: `steamTemperature` is one of the
     * eleven keys `/ws/v1/machine/snapshot` always writes, and it is the one context
     * reading on this screen that a person waiting to froth milk is actually watching.
     * It recedes mid-shot with Group, from Slate's own rule
     * (slate-live.css:2083-2098, ".slate-gauge-steam … this is a demotion, not a hide").
     *
     * TANK COMES BACK AS AN ABSENCE, WHICH IS EXACTLY WHAT SLATE RENDERS. An earlier
     * turn of this pass held it out on the grounds that a tile with no source "promises
     * a reading it has no road to" — measured against the oracle, that reasoning was
     * backwards: SLATE'S OWN TANK IS A DASH, in both live states.
     *   ORACLE live-ready  #data-tank-vol [i=114] text "—", 45px, muted 148,161,169
     *          live-pulling #data-tank-vol [i=117] text "—", 30px, the same muted ink
     *          — i.e. it recedes with Group and Steam and it has NO <small> unit
     *            element beside it in either state, unlike every other tile.
     * So a present, dashed Tank is not a promise; it is a byte-for-byte restore of what
     * the reference draws, and it is Ben's own rail rule ("a row whose key the machine
     * does not serve renders present and dashed, never invented") applied where it
     * plainly belongs. Nothing invents a level: `readings.tank` is never written, so
     * `#reading` answers the tile's own dash (A7 intact).
     *
     * THE MISSING SOURCE IS STILL MISSING, and it is the DQ rather than the tile: the
     * water level is on `/ws/v1/machine/waterLevels`, which `rea-ws-channels.js` names
     * and no feed in `live-stores.js` attaches. Attaching it is a feed, a reader, a
     * budget row and a recorded frame the mock does not hold — a build, not a polish —
     * so it rides the digest as a deferred question with this tile already in place to
     * receive it. `unit` is '' deliberately: the oracle has no unit element here, and
     * the unit the level would arrive in is the feed's to declare, not this row's. */
    {
        key: 'steam',
        label: 'Steam',
        unit: '°C',
        size: null,
        ink: 'var(--ui-channel-steam-temperature)',
    },
    /* MILK, SLATE'S EIGHTH READING, restored with its feed (live-wiring's WATCHED_FEEDS).
     *
     * ORACLE live-ready #milk-info-container [i=88] .slate-gauge-milk, between Steam and
     * Tank — so it goes there, not on the end.
     *
     * AND IT IS THE ONE TILE THAT COMES AND GOES, which is why the capture this cluster
     * was measured from counted seven. Slate hides it outright when the probe has
     * nothing to say — `container.style.display = value === null ? 'none' : ''`
     * (ui.js:2856-2863) — and shows the machine's Mix temperature in its place. So a
     * dashed Milk tile would NOT be the oracle's absence spelling; an absent one is.
     * `whenRead` is that rule, and this is the only row that carries it: every other
     * reading is one the machine always sends, and a dash is the right answer for those.
     */
    {
        key: 'milk',
        label: 'Milk',
        unit: '°C',
        size: null,
        whenRead: true,
        ink: 'var(--ui-channel-milk-temperature)',
    },
    {
        key: 'tank',
        label: 'Tank',
        /* MILLIMETRES, AND THE MACHINE'S OWN UNIT. The oracle draws no unit element here
         * because Slate's tile had no reading to put one beside; now that the feed is
         * attached the number needs naming, and mm is what
         * `/ws/v1/machine/waterLevels` carries. Slate shows the same by default and
         * offers mL as a SETTING, converting through a 68-entry table it ports from the
         * TCL skin — the contract's own note records that the table has no ReaPrime
         * counterpart.
         *
         * THE SETTING EXISTS HERE NOW (26 August 2026) and this is the DEFAULT rather than
         * the answer: `#reading` and the template both take the unit from
         * `#tankUnit`, which reads the preference and falls back to this. The conversion is
         * Ben's 40 mL per millimetre, not Slate's table — see `lib/tank-volume.js` for the
         * disagreement and which one governs. */
        unit: 'mm',
        size: null,
        ink: null,
    },
]);

/**
 * How often the chart's aria-live summary may re-announce, measured in SECONDS OF THE
 * SHOT rather than of the wall clock (chart-C14).
 *
 * A polite live region rewritten at the render rate is a live region a screen reader
 * reads for ever and a person can never get past; one that only ever announces at the
 * end is not a live summary at all. Five shot-seconds is roughly six announcements in a
 * 30 s espresso, and it is the SHOT's clock because that is the clock the sentence is
 * about - a wall clock here would keep announcing while a paused, finished or refused
 * shot said nothing new. The other trigger is a state change (a shot opening, closing,
 * or the derivation refusing), which is announced at once because it is news.
 */
const SUMMARY_EVERY_S = 5;

/**
 * ===========================================================================
 * THE WALL CLOCK (finding audit-1; Ben's ruling, 21 August 2026)
 * ===========================================================================
 *
 * Slate draws the time of day at the right-hand end of its header cluster and the
 * rewrite dropped it with no declaration anywhere - the four triage records were
 * bucketed EXPECTED on the strength of a spec that simply does not mention it, and "a
 * spec that omits an element does not DECLARE its removal". Ben: restore the clock, and
 * nothing else with it. Verified before building: the current oracle carries no theme
 * control in that row either (its own markup says the sun-icon toggle moved to
 * Settings > Display > Theme), so the clock comes back alone.
 *
 * WHERE IT LANDS, AND WHY NOT IN THE HEADER BAND. Slate draws it at the top of the MAIN
 * column, in the row that carries the profile name, the dose and the machine status
 * (`.slate-machine-telemetry`, [i=92..95]) - and that is where it is here: the right-hand
 * column of the stats block, level with the readings, hanging at the top.
 *
 * The header band was measured first and REFUSED, on the numbers wave 5.6 already
 * recorded for exactly this question ("that header gives from the FAVOURITES BANK, which
 * declares no hit-floor-aware minimum"). At the 1000x600 design floor, in the espresso
 * state with the default profile label, the bank is ALREADY at 54.75px per slot - 6.75
 * above --ui-hit-min - because the three clusters want 1061 of a 1000-wide band and the
 * bank is the only one that gives. A 64.73px clock plus its gutter takes it to 39.4 and
 * L22 goes red, MEASURED, at every clock size the type scale has: 17px buys 43.2, which
 * is still under the floor. The bank's own component floor (5 x (--ui-hit-min + 2 x
 * --ui-space-4) = 420px) exists and is correct; this screen's `min-inline-size: 0` on it
 * is what lets the header stay whole, and restoring it would push the action cluster off
 * the end instead. That is the H3-shaped defect the wave-5.6 note names, it is not this
 * fix's to open, and putting the clock where Slate actually draws it costs nothing: the
 * stats block's own column, out of horizontal slack the gauge cluster has in abundance
 * (its five tiles want 384px of a 643px row at the floor) and out of NO height at all,
 * because the clock spans both rows of a block whose readings are twice its height.
 *
 *   ORACLE  live-ready #data-clock [i=95] text "12:16" rect [1799,170,64,31]
 *           font-size 24px -> --ui-text-2xl (the scale's own 24)
 *           font-weight 300 -> --ui-weight-light. It read --ui-weight-regular while the
 *                              sheet shipped three weights; parity surface 1 restored
 *                              Slate's four (its §3.5 line is refuted by its own
 *                              citation, slate-tokens.css:148-153), so the clock is now
 *                              the oracle's own 300.
 *           color rgb(244,247,248) -> --ui-text
 *           font-family var(--slate-font-numeric), which tokens.css records was
 *                              ALREADY the UI family -> the numeric part of the role
 *                              is font-variant-numeric alone, i.e. .ui-numeric.
 *           Right-aligned: it is the last thing in its row, and it is the last thing
 *           in this header's action cluster for the same reason.
 *
 * 24-HOUR HH:MM, WHICH IS BOTH SLATE'S FORM AND BEN'S INSTRUCTION. Intl does the
 * spelling, in the language the I18nController holds, with `hourCycle: 'h23'` so
 * midnight is 00:xx in every locale rather than 24:xx in the ones that count that way.
 * No new readable string arrives with it - the clock's whole content is a formatted
 * number, so there is nothing here for the i18n source to carry.
 *
 * ===========================================================================
 * THE TIMER, AND WHY IT IS NOT D7's TERRITORY
 * ===========================================================================
 *
 * D7's law is "no timer at all" on the LED PREVIEW WRITE PATH - `led-strip-store.js`,
 * which is grepped for four spellings by its own suite - and it is about a
 * trailing-edge debounce that could never fire mid-drag. A wall clock writes nothing,
 * asks nothing of the machine and cannot be expressed without a clock at all;
 * `calibration-store.js` records the same distinction for its countdown poll ("the
 * screen law's 'no timer at all' is the LED preview write path ... a different
 * mechanism on a different route answering a different question").
 *
 * ONE INTERVAL, OWNED BY THE SCREEN, STOPPED ON DISCONNECT - the same shape
 * `live-wiring.js` uses for its staleness tick, and the reason a route swap cannot
 * leave it running. The tick is a SECOND while the reading is a MINUTE, and that is
 * deliberate: a minute-long interval displays the wrong minute for up to 59 seconds of
 * every one, and re-arming to the next boundary would be two mechanisms where one will
 * do. The property is only written when the SPELLING changes, so the screen re-renders
 * once a minute and not sixty times.
 *
 * THE FORMATTER AND THE TICK MOVED OUT on 24 Aug 2026 and this paragraph did not: they
 * are `src/lib/wall-clock.js` now, because the screensaver gained a clock the same day
 * (Ben: "a faint clock showing the time in the same font the skin uses") and two copies
 * of an `Intl` option bag is two places for `hourCycle` to drift. The failure would be
 * silent — one surface saying 21:40 and the other 9:40 PM, each right on its own screen.
 */

/** One decimal, or null when there is no reading. Never "0" for "not measured". */
function reading(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : null;
}

export class LiveScreen extends UiElement {
    static properties = {
        /**
         * Is the group-head-controller strip in the flow?
         *
         * THE GATE IS NOT HERE. This is the slot the gate fills:
         * `live-capability-gates-ghc` reads capabilitiesStore.groupHeadController()
         * over r3GroupHeadControllerCapability - which can answer "not known", and
         * whose absence is never a false - and sets this. No machine name is read in
         * this file and no capability is inferred from one; the skeleton's job is
         * that the strip is a ROW and not an overlay (bug L1).
         */
        ghc: { type: Boolean, reflect: true },

        /**
         * The app shell's boot object (`createAppBoot(...)`), handed down by `<app-root>`.
         *
         * ONE PROPERTY, NOT FIVE STORES. It is the shell's own noun, and it is the only
         * thing this screen is given that can talk to a server — which is what keeps the
         * screen layout-only: `LiveWiring` reads the stores off it and hands back two
         * derived properties, and nothing in this file ever names a route.
         */
        boot: { attribute: false },

        /**
         * THE ONE DIMMING OWNER'S ANSWER (bug L11), reflected so the single declaration
         * block in `live-dimming.js` can read it. Written by `LiveWiring` from
         * `liveDim(machineState)` and by nothing else — an inline style, or a second
         * property that also dimmed, would be L11 rebuilt.
         */
        dim: { type: String, reflect: true },

        /**
         * The SHOT BUFFER this screen's chart draws - `live.shot` from the app shell's
         * stores (`createShotBuffer`, wave 0b), or null before one exists.
         *
         * `attribute: false` for the reason the card gives for its own derivation: there
         * is no honest string form of a shot, and a chart a screen could feed through an
         * attribute is a chart a screen could feed by hand. This screen never opens,
         * closes or writes to the buffer - the machine-state truth is the store's.
         */
        shot: { attribute: false },

        /* ===================================================================
         * THE BANDS' DATA. Every one of these is HANDED TO the screen - screens are
         * "components, but layout-only" - and every one has exactly one legal source,
         * named here so a later wiring row has nothing to decide:
         *
         *   machineState  feeds[FEED.MACHINE]'s state, the store's truth. Never an
         *                 endpoint, never a name, never this screen's opinion.
         *   limits        capabilitiesStore.machineLimits(), which IS r2MachineLimits
         *                 and is the only door to the one limits table (B2). The
         *                 screen holds no bound and does no limit arithmetic: it
         *                 passes the table to the numpad and a step function to the
         *                 stepper, both of which read it themselves.
         *   offers        the two gates the rail's toggles need, as `true|false|null`:
         *                 milkProbe (R3, r3MilkProbeCapability) and stopAtWeight (one
         *                 of the seven SERVED entries). Fail-closed - only true opens
         *                 an option, and null is not a false, it is "not known".
         *   derivation    the gate-6 shot derivation, for the foot band's phase table.
         *                 No derived channels: D1 keeps R/Z/W and the fused estimator
         *                 out of v1, and the table's three columns are its whole set.
         * =================================================================== */

        /** ReaPrime's own state name, e.g. `espresso` / `steam` / `idle`. */
        machineState: { type: String, attribute: 'machine-state', reflect: true },

        /**
         * WHICH PICTURE THE CHART IS SHOWING — 'espresso' or 'steam'.
         *
         * REFLECTED, because the steam session's own composition is a stylesheet's job and
         * not a template's: the profile line is hidden by a host selector, the same shape
         * Slate uses (`#main-page[data-live-mode="steam"]`) and for the same reason its own
         * note gives — "the module owns one attribute, CSS owns every consequence".
         *
         * The wiring folds it out of the machine's own frames (`steam-chart.js`), and this
         * screen only reads it: what the chart draws is a rendering decision, and which
         * session the machine is in is not this screen's to work out. Reflected, so a
         * harness and a stylesheet can both see it.
         */
        chartMode: { type: String, attribute: 'chart-mode', reflect: true },

        /** The steam session, in the shape `<ui-chart-card>` reads, or null. */
        steamDerivation: { attribute: false },

        /** The steam session has stopped and is in its settle window, so the chart may
         *  draw its end labels. `LiveWiring` reads the fold; this screen only paints. */
        steamSettled: { type: Boolean, attribute: false },

        /** A milk probe is attached and answering. Slate omits the milk trace without
         *  one, and this is what says so. */
        milkPresent: { type: Boolean, attribute: false },

        /** The gauge cluster's channels, keyed as GAUGES names them — each a finite
         *  number or null. `LiveWiring` is the only writer; nothing here defaults one. */
        readings: { attribute: false },

        /** The cup warmer, as `{present, on}`. `present: false` takes the control off
         *  the band (the capability's answer); `on: null` keeps it and draws the dash.
         *  `LiveWiring` is the only writer and it reads the store's own predicates. */
        warmer: { attribute: false },

        /** The puck estimator's `{ compliance, flags }` for the expanded chart's badge,
         *  or null. `LiveWiring` is the only writer; `expanded-summary.js` owns the rule
         *  that turns the pair into a badge, including the C-observed bit. */
        compliance: { attribute: false },

        /** The R2 limits table. No range is read from anywhere else. */
        limits: { attribute: false },

        /** limit key -> the machine's current target. A key with no value is a control
         *  with nothing to show, and it renders as an absence rather than as a zero. */
        targets: { attribute: false },

        /** `{ milkProbe, stopAtWeight }`, each `true | false | null`. */
        offers: { attribute: false },

        /** limit key -> preset values (#37). User data; nothing is invented here. */
        presets: { attribute: false },

        /** L25's two restored toggles, as state. */
        steamStop: { type: String, attribute: 'steam-stop' },
        waterStop: { type: String, attribute: 'water-stop' },

        /** The header band's favourites (#36) and the profile the machine has loaded. */
        favourites: { attribute: false },
        favourite: { type: String },
        profileName: { type: String, attribute: 'profile-name' },

        /** The foot band's phase table reads the LIVE derivation - `get derivation()`
         *  below, the chart's own road, so the table and the plot are the same shot
         *  read from the same model (chart-C13). This is the STORED one: a shot being
         *  reviewed, or a suite driving the band without a buffer. Same shape either
         *  way, and the live one wins while it has a shot in it. */
        storedDerivation: { attribute: false },

        /** The stored shot's LIST row — its timestamp and its profile title, which is
         *  all the band's first block names it by. Never the 221 KB record. */
        storedShot: { attribute: false },
        shotId: { type: String, attribute: 'shot-id' },
        rating: { type: Number },
        /**
         * THE WEATHER PLUGIN'S LAST READING, or null when the plugin is not installed.
         * Written by `LiveWiring` from `weather-store.js` and by nothing else.
         */
        weather: { attribute: false },
        historyCount: { type: Number, attribute: 'history-count' },

        /**
         * DOES THIS MACHINE HAVE DYE2 RUNNING? The gate on the foot corner's third
         * button, answered by the wiring off ReaPrime's installed-plugin listing and
         * never inferred here — see `LiveWiring`'s `#dye2Loaded`, which explains why the
         * answer is `loaded` and why an unread listing is `false`.
         *
         * A RENDERED FACT, LIKE EVERY OTHER PROPERTY ON THIS SCREEN. The screen does not
         * ask whether DYE2 is installed and does not know what a plugin is; it draws a
         * button when it is told there is somewhere for that button to go.
         */
        dye2: { type: Boolean },

        /**
         * WHETHER EACH ARROW HAS ANYWHERE TO GO. Two booleans and not an index, for the
         * reason every other property on this screen is a rendered fact rather than a
         * source: the band draws a disabled control, it does not decide what is
         * reachable. The wiring owns the index and the page, and answers these.
         */
        canStepOlder: { type: Boolean, attribute: 'can-step-older' },
        canStepNewer: { type: Boolean, attribute: 'can-step-newer' },
        /** True while the arrows are on a row that is not the newest — see #bandDerivation. */
        browsingHistory: { type: Boolean, attribute: 'browsing-history' },

        /** The numpad's open target: the limit key being typed, or null. */
        _typing: { state: true },

        /**
         * The numpad's OTHER open target: `{key, index}` while a PRESET CELL is being
         * typed, or null (audit F-026, 29 August 2026).
         *
         * TWO TARGETS AND NOT ONE UNION, because the two mean different things and the
         * difference is the whole finding. `_typing` names a SETTING and its commit goes
         * to the machine; this names a CELL of a bank and its commit goes to the bank.
         * They are mutually exclusive — one keypad — and every path that opens one clears
         * the other.
         */
        _presetTyping: { state: true },

        /** Which cell a press-and-hold opened the actions menu for, or null. */
        _hold: { state: true },

        /**
         * The full-screen chart is up. Ben, 24 Aug 2026: the tap "should load the
         * expanded chart that does show live tracking etc". State and not a route — see
         * `live-expanded-chart.js` for why an overlay is the right shape and what a
         * route would have had to rebuild.
         */
        _expanded: { state: true },
        _notes: { state: true },
        /** Whether the weather detail modal is open. */
        _weatherOpen: { state: true },
        /**
         * Has the open notes sheet been typed into? (Ben's decision D14.) The DIRTY FLAG
         * and not the text: `<ui-notes-editor>` owns the document — `value` is its seed,
         * never its live text — and a second copy on this element would be a second owner
         * of one string. This exists so Save can be offered or withheld.
         */
        _notesDirty: { state: true },

        /** The wall clock's current spelling. State, because nothing outside this
         *  screen owns the time of day (see THE WALL CLOCK above). */
        _clock: { state: true },

        /**
         * How the header's clock is written — `24h` or `12h`, the `clockFormat`
         * preference. Handed down by the wiring with the rail's other stored answers,
         * because a screen may not build a settings store of its own (B7).
         */
        clockFormat: { type: String, attribute: 'clock-format' },

        /**
         * Which unit the Tank tile draws — `mm` or `mL`, the `waterTankUnit` preference.
         *
         * SAME SHAPE AS `clockFormat` AND FOR THE SAME REASON: a screen may not build a
         * settings store of its own (B7), so the wiring hands it down with the rail's other
         * stored answers. It arrived on 26 August 2026; before that the preference had no
         * reader at all and this tile drew millimetres whichever the person picked.
         */
        tankUnit: { type: String, attribute: 'tank-unit' },

        /**
         * Which unit a temperature is drawn in — `c` or `f`, the `tempUnit` preference.
         *
         * It reaches the gauge tiles AND the rail's three temperature targets. Handed down
         * by the wiring with the other stored answers, because a screen may not build a
         * settings store of its own (B7).
         */
        tempUnit: { type: String, attribute: 'temp-unit' },

        /**
         * THE ROUTE FORM OF THE DIALOG CONTRACT'S `invoker` (bug H9, wave 5.6).
         *
         * A string id inside THIS screen's own shadow root, set by `<app-root>` when
         * this screen is mounted as a RETURN from somewhere it was left. A route swap
         * destroys the screen, so an element reference - which is what `ui-dialog`'s
         * `invoker` property holds, correctly, for a dialog whose opener outlives it -
         * cannot survive the trip; the id can, and only the screen can reach inside its
         * own root to use it. Unset: the caret is left where arriving put it.
         */
        restoreFocusTo: { attribute: false },
    };

    static styles = [typeRoles, seams, liveDimming, css`
        /* THE CHART'S ARIA SUMMARY (chart-C14) - hidden from the eye, in the
         * accessibility tree, and COSTING THE CHART NOTHING.
         *
         * Not base.js's \`visuallyHidden\` utility, and the difference is measured
         * rather than stylistic. That utility is \`position: absolute\` +
         * \`overflow: hidden\`, which is right nearly everywhere and wrong in this one
         * shadow root: this screen's own suite walks every box in the skeleton and
         * refuses BOTH shapes - an absolutely positioned box (bug L1's mechanism,
         * §4.1 "no absolutely-positioned structure") and a box that clips content
         * larger than itself (the L2 / L4 / L18 filter). A 1x1 aria-only span is
         * neither defect, but a blanket rule cannot tell one from the other, and the
         * rule is worth more than the exemption.
         *
         * So the box stays IN THE FLOW at zero height and the PAINT is clipped
         * instead: \`clip-path\` clips the element and everything overflowing it
         * without \`overflow: hidden\`, so nothing here is positioned, nothing is
         * "clipped content", and the card's foot row is still 0px - the chart gives
         * up no height for it. Verified against the real accessibility tree
         * (CDP Accessibility.getFullAXTree) rather than assumed, because a hidden
         * summary nothing announces is worse than none. */
        .chart-summary {
            display: block;
            block-size: 0;
            clip-path: inset(50%);
        }

        /* THE GRID. display / gap / ground come from the seam utility via the host
         * classes added in connectedCallback; :host(.seam-grid) is (0,2,0), so this
         * rule - same selector, written later - is what adds the tracks to it. */
        :host(.seam-grid) {
            grid-template-columns: var(--ui-rail-w) minmax(0, 1fr);
            grid-template-rows:
                var(--ui-band-h)
                minmax(0, 1fr)
                fit-content(var(--ui-live-foot-max-share));
            block-size: 100%;
        }

        live-header {
            grid-column: 1 / -1;
            grid-row: 1;
            min-inline-size: 0;
        }

        /* Rows 2-3, so the rail runs from the header's underline to the foot of the
         * screen exactly as the seam beside it does. min-block-size: 0 keeps the
         * rail's own content out of row 2's floor: the rail's contract is "never
         * scrolls, drops nothing", so it overflows visibly rather than pushing the
         * chart and the band around. */
        live-rail {
            grid-column: 1;
            grid-row: 2 / 4;
            min-block-size: 0;
            min-inline-size: 0;
        }

        live-main {
            grid-column: 2;
            grid-row: 2;
            min-inline-size: 0;
        }

        live-foot {
            grid-column: 2;
            grid-row: 3;
            min-inline-size: 0;
        }

        /* ===================================================================
         * THE BANDS' CONTENT. Composition only: every control below is a library
         * component and this sheet gives it a BOX, never a look. There is no
         * colour, no border, no font and no selected state written here - the four
         * --ui-selected-* dials live inside <ui-bank>, and a rule in this file that
         * painted a selected anything would be L8 recreated one shadow root out.
         *
         * Every box is a FLOOR and never a fixed height (L2 / L4 / L18): the bench
         * tablet renders text ~10% larger than the desk harness (§1.4), so two
         * pixels of clearance is a box that only works on the desk.
         * =================================================================== */

        /* The header's clusters. min-inline-size: 0 on the middle one is the half
         * of §4.1's rule that is easy to lose: a flex item's automatic minimum is
         * its content, so a favourites bank that refuses to shrink pushes the action
         * cluster off the end instead of getting narrower. */
        ui-favourites-bank {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        .actions {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        /* ===================================================================
         * THE WARMER CONTROL'S TWO LINES (parity 7-live-polish)
         * ===================================================================
         * <ui-button>'s own box is a centred flex ROW with --ui-space-2 between
         * slotted children, which is right for a word plus a glyph and wrong for a
         * word ABOVE a state. Slate stacks them and says so in its own gap:
         *   ORACLE live-ready #cupwarmer-toggle-btn [i=9] gap = 2px, with
         *          [i=10] .slate-warmer-label "Warmer" rect [1314,43,62,19] and
         *          [i=11] .slate-warmer-state "ON"     rect [1335,63,21,12] —
         *          the same button, one record above the other, 43+19 = 62 to 63.
         *
         * SO THE STACK IS THE SCREEN'S, NOT THE BUTTON'S. This is light DOM inside
         * <ui-button>'s slot, so it is this screen's own subtree and this sheet can
         * name it directly — no ::slotted, no part, and nothing added to the button
         * for one caller's composition. A second consumer wanting a stacked button
         * would be the moment to ask the component for it; one is not.
         *
         * --ui-space-1 is 4px against Slate's 2. The scale has no 2 and inventing
         * one for a single gap is exactly the token-blind literal the audit counts;
         * 2px of slack inside an 82px control is below the bench's own text-size
         * variance (§1.4), so the row is the scale's and not the oracle's here. */
        .warmer {
            display: grid;
            justify-items: center;
            gap: var(--ui-space-1);
            line-height: 1;
        }

        /* THE NAME IS THE BUTTON'S OWN TYPE and nothing is declared for it: .btn is
         * --ui-text-base / --ui-weight-medium = 17px / 500, which is [i=10] exactly.
         *
         * THE STATE LINE IS THE MICROCAP ROLE, ONE STEP DOWN. Slate's [i=11] reads
         * 12px / 600 / letter-spacing 1.44px / muted, and 1.44 ÷ 12 = .12em is
         * --ui-tracking-cap exactly — so weight, tracking, colour and the uppercase
         * are all the .ui-microcap role's already, and the class carries them rather
         * than this rule restating four tokens. The ONE thing the role gets wrong is
         * size: the role is --ui-text-sm (15px), because a microcap above a VALUE is
         * 15px everywhere else in the skin. This one sits inside an 82px control under
         * a 17px name, and Slate steps it down for that reason. --ui-text-xs is the
         * scale's own next step and the same one the rail's continuation labels take
         * — no literal, and one step, not a new size. */
        .warmer-state {
            font-size: var(--ui-text-xs);
        }

        /* ===================================================================
         * THE RAIL TARGET'S CHANNEL INK (parity surface 1)
         *
         * Two rules and a table of two, because Slate paints a rail target's NUMBER in
         * the colour of the channel that target commands. WHICH channel a row commands
         * is the row model's (live-targets.js, THE TARGET NUMBER'S INK, with the oracle
         * records and the reason the canonical --ui-channel-* names are used rather than
         * the legacy --slate-live-* family Slate reaches for on three of the four);
         * turning a channel's NAME into an ink is this sheet's, and it is here rather
         * than on the element because bug L11 is "inline wins" and this screen's own
         * dimming suite bans a style attribute on a rail track by name.
         *
         * The property is <ui-stepper>'s declared seam (--_ui-stepper-number-ink); a row
         * that names no channel sets nothing and the number keeps the cell's ink, which
         * is Slate's own treatment of a dose, a weight, a volume and a duration.
         * =================================================================== */
        ui-stepper[data-channel="temperature"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-group-temperature);
        }

        ui-stepper[data-channel="flow"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-flow);
        }

        /* A CONTINUATION ROW SPEAKS QUIETLY — Slate's .slate-continuation-label.
         * ORACLE live-ready [i=56] "Flow" and [i=82] "Temperature" both render
         * font-size 12px where the block headings [i=48] "Steam" and [i=74]
         * "Hot Water" render 17px. Which rows those are is the row model's
         * (its continuation flag); the size is --ui-text-xs, the step whose own comment
         * in tokens.css already reads "dense capability labels". It is also what makes
         * TEMPERATURE fit the 88px name column on one line. */
        /* A ROW WITH A STOP CONDITION KEEPS ITS WORDS WHOLE (it16).
         *
         * The two rows that carry a caption are the two whose headings are the longest:
         * "STEAM" and "HOT WATER". At the reference geometry the name column is 88px
         * and "HOT WATER" takes two lines, which is exactly what the oracle does —
         * #hotwater-label [i=74] rect [28,991,108,41], two lines, 108px running into
         * the 18px gutter. Below the reference the column narrows (77 at the bench, 64
         * at the floor) and the component's default overflow-wrap broke the word into
         * THREE, which with the caption under it took the row to 88.56px against a
         * 64px control — the one thing this rail may not do, since every other row
         * stays 64 and the rhythm is the rail's whole claim.
         *
         * The normal keyword breaks at the space and nowhere else, so the name is two
         * lines at every geometry: 2 x 20.4 + 4 + 14.4 = 59.2 inside 64, measured. What
         * does not fit overflows into the gutter, as Slate's own label does with 20px
         * of overhang and what the continuation rows below already do. */
        ui-stepper[data-stop] {
            --_ui-stepper-label-wrap: normal;
        }

        /* THE TWO CONTINUATION ROWS NO LONGER SHOW THEIR NAME — Ben, 30 August 2026:
         * "lets remove all these little sub headings ... we dont say this for any of the
         * others and we have units so its mostly clear what it does."
         *
         * FLOW sits over a well reading mL/s and TEMPERATURE over one reading degrees, so
         * the unit already answers which row it is, and these were the only two labels on
         * the rail drawn at a second size. The name is HIDDEN, not deleted: label-hidden
         * takes the shared visually-hidden treatment, so aria-labelledby still resolves
         * and the control keeps its accessible name.
         * (No backticks in this comment on purpose — it sits inside a css template, and
         * the guard that catches a truncated stylesheet is called lost-stylesheet.)
         *
         * THE SIZE BELOW IS KEPT ON PURPOSE. It governs nothing while the label is hidden,
         * and it is what the row goes back to if the label is ever shown again — deleting
         * it would lose the measurement, and the measurement is the expensive half. */
        ui-stepper[data-continuation] {
            --_ui-stepper-label-size: var(--ui-text-xs);
            /* AND IT KEEPS ITS WORD. TEMPERATURE is 11 characters of tracked caps and
             * the name column is 88px; Slate fits it because its 12px continuation
             * label tracks 1.08px (.09em) where its 17px heading tracks 2.04px (.12em)
             * — Slate disagreeing with itself about one token. Decal has ONE
             * --ui-tracking-cap at .12em (surface 0, spec §3.5 over the oracle), which
             * costs this label about 4px, and 4px is not worth breaking a word over.
             * So it overflows into the 18px gutter, which is exactly what Slate's own
             * #hotwater-label [i=74] does with 20px of overhang. */
            --_ui-stepper-label-wrap: normal;
        }

        /* THE RAIL'S BLOCK HEADINGS ARE 17px, NOT THE MICROCAP'S 15 — Slate's own two
         * sizes, both read off the oracle:
         *   [i=18] #grind-label, [i=23] #dose-label, [i=30] #drink-label,
         *   [i=41] #brew-label, [i=48] #steam-label, [i=67] #flush-label and
         *   [i=74] #hotwater-label all render font-size 17px;
         *   [i=56] and [i=82], the two .slate-continuation-label spans, render 12px.
         * The microcap ROLE stays 15px everywhere it is used (its own oracle record is
         * .slate-microcap [i=168] on expanded-charts) — this is not that role drawn a
         * second way, it is Slate's rail label, which has its own rule and its own
         * size. Scoped to the rail so nothing else in the skin moves.
         *
         * A DESCENDANT SELECTOR, NOT A CHILD ONE: the first row is wrapped in the abort
         * target's one-cell grid, so a child combinator here quietly left GRIND at the
         * microcap's 15px while its eight neighbours read 17 — measured, and the kind of
         * one-row exception nobody would ever write on purpose. */
        live-rail ui-stepper {
            --_ui-stepper-label-size: var(--ui-text-base);
        }

        .glyph {
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
        }

        /* THE WALL CLOCK'S TYPE. From the oracle, through the tokens named at the top of
         * this file. Nothing here positions, floats or nudges it: it is right-aligned
         * because it is the end of a grid column (see .stats-block below), which is a
         * box and not a nudge. white-space: nowrap so a narrow column never breaks
         * HH:MM across two lines. */
        .clock {
            color: var(--ui-text);
            font-size: var(--ui-text-2xl);
            font-weight: var(--ui-weight-light);
            white-space: nowrap;
        }


        /* THE STOP OVERLAY (#47), WITHOUT POSITIONING ANYTHING. Slate's abort target
         * is position:absolute, top 25px, z-index 6 over the rail; here the
         * rail's first track is a one-cell grid and both children sit in that cell,
         * so the control appears over the row it covers and NOTHING MOVES when it
         * does. The component "does not position itself and it is absent, not
         * hidden, when nothing is running" (#47's own entry), and this is the box
         * that lets it keep that promise. */
        .stack {
            display: grid;
        }

        .stack > * {
            grid-area: 1 / 1;
        }

        /* AND THE OVERLAY MUST BE ON TOP OF THE CELL, NOT MERELY IN IT. Sharing a
         * grid area decides GEOMETRY, not paint order, and the two are not the same
         * question: while a shot runs the control under this cell is disabled, and its
         * own disabled look computes opacity: 0.38, which gives it a stacking
         * context. A stacking context on a non-positioned element paints with the
         * z-index:0 positioned layer (CSS 2.1 Appendix E step 8), i.e. ABOVE its
         * plain sibling — so that control painted over the whole of the abort target
         * and,
         * because hit testing follows paint order, swallowed every press: measured
         * 0 of 7 points across the STOP box reaching <ui-stop-button> at both Gate A
         * geometries, a real click dispatching pointerdown only (what a disabled
         * <button> does) and stop-request never firing. A pixel-identical screen,
         * dead to input, on a panel whose only input is a finger — SCOPE Part 8 §3
         * Rule 1, and the abort target is the worst possible place to learn it.
         *
         * ONE DECLARATION, NO NUMBER, AND STILL NOTHING POSITIONS ITSELF. The cure is
         * the same mechanism that caused it: isolation: isolate gives the abort target
         * its own stacking context, so it joins its cell-mate in that step-8 group and
         * TREE ORDER decides — the stop button is the later child of this cell. Measured
         * after: 7 of 7 points answer <ui-stop-button> and a real press fires
         * stop-request once, at both geometries.
         *
         * WHY NOT z-index. It would work (a grid item takes z-index at position: static),
         * but every authored z-index in this tree is a --ui-z-* token — "four literals
         * on a scale beat thirteen literals with no scale" (tokens.css §3.8, bug S8's
         * cure) — and this is not a page layer; it is the order of two boxes inside one
         * grid cell. A raw 1 here would be the only z-index literal in src/, and
         * borrowing --ui-z-sticky would be a lie about what the number means.
         *
         * The component keeps #47's promise either way: it does not position itself,
         * nothing moves, and getComputedStyle(stop).position is still static. The
         * declaration is on the STOP button rather than on the bank so it reads as "the
         * overlay is on top", which is the invariant, and so no future opacity on any
         * other cell-mate can take it back. */
        .stack > ui-stop-button {
            isolation: isolate;
        }

        /* The rail's rows. A stepper is 268px of its own arithmetic wide (two caps,
         * the value cell's floor and two hairlines) and the rail is --ui-rail-w, so
         * the row is given the width and never told a size. */
        live-rail > * {
            inline-size: 100%;
        }

        /* ===================================================================
         * THE RAIL'S NAME COLUMN, SHARED BY EVERY ROW THAT IS NOT A STEPPER
         * (parity 7-live-polish; Ben's standing-rail ruling, 22 Aug 2026)
         * ===================================================================
         * Slate hangs the preset banks off the WELL, not off the rail's inset:
         *   ORACLE live-ready #drink-out-preset-1 [i=37] rect.x = 134 — the same x
         *          as .slate-stepper [i=31], and 106 to the right of the 28px inset;
         *          #steam-flow-preset-1 [i=63] agrees at 134.
         * A stepper computes that offset for itself, as the first track of its
         * label-position="start" grid: min(the name column it wants, whatever is
         * left once the well keeps its squeezed form). A preset bank has no name to
         * hang there, so it takes the SAME arithmetic as a start inset — one
         * expression, declared once on the rail, from public tokens only
         * (--ui-stepper-value-min was published for exactly this).
         *
         * IT USED TO NAME <ui-bank> TOO, and that selector went with the two
         * stop-mode tracks (it14): the stop condition is a caption INSIDE the
         * stepper's name cell now, so it takes the stepper's own column and there is
         * no bank left in this rail. The rule is not widened to a star selector —
         * the preset bank is the rail's one non-stepper row, and it is named.
         *
         * PADDING, NOT MARGIN, AND NOT A NUDGE. <live-rail> zeroes ::slotted(*)
         * margins by design (bug L5: a row that tries to nudge itself into line
         * cannot), and this is not a row nudging itself — it is the rail's own
         * column arithmetic, in the rail's own sheet, the same value for every row
         * that uses it. Nothing here touches the BLOCK axis, which is where L5's
         * four correction margins lived. */
        live-rail {
            --_ui-rail-well-floor: calc(
                2 * var(--ui-hit-min) + var(--ui-stepper-value-min) + 2 * var(--ui-border-w));
        }

        live-rail > ui-preset-bank {
            padding-inline-start: calc(var(--ui-space-4) + min(
                var(--ui-stepper-label-w),
                calc(100% - var(--ui-space-4) - var(--_ui-rail-well-floor))));

            /* AND IT SITS AGAINST THE STEPPER IT BELONGS TO. Ben, 23 Aug 2026: "Move
             * the presets closer to the stepp above that its linked to, reduce the gap
             * between the bottom of the stepper and the top of the presets by 80%."
             *
             * A preset row is not a peer of the row above it — it is four shortcuts to
             * that row's value, and the rail's uniform 28px gap said the opposite. 80%
             * off leaves 5.6px, and the arithmetic is written out rather than rounded to
             * a token: the gap being cancelled is --ui-space-6, so the pull is 0.8 of it.
             *
             * A NEGATIVE MARGIN, AND IT IS NOT L5. L5 is four CORRECTION margins, each a
             * different fudge, each making a row's position depend on how many rows are
             * above it. This is ONE constant, the same for both preset rows, in the
             * rail's own sheet, derived from the gap it modifies — the rhythm stays
             * uniform-gap-plus-one-constant and no other row moves.
             *
             * IT ALSO PAYS FOR THE CENTRED DIVIDERS BELOW: two rows at 5.6 instead of 28
             * hand 44.8px back to a rail that measured EXACTLY zero spare at 1920x1200
             * (1081 of content in 1081 of interior). */
            margin-block-start: calc(-0.8 * var(--ui-space-6));
        }

        /* ===================================================================
         * THE FOUR HAIRLINES — SLATE'S FIVE BLOCKS (parity 7-live-polish)
         * ===================================================================
         * Slate rules the rail into espresso / brew / steam / flush / hot water,
         * and the lines are visible in the oracle capture at exactly four places:
         * above BREW, above the steam block, above FLUSH and above the hot-water
         * block. WHICH row opens a block is the row model's (sectionStart in
         * live-targets.js, derived from each row's section rather than counted);
         * drawing the line is this sheet's.
         *
         * ONE LINE, ONE DRAWER, which is the half of bug L9 the Live screen owns.
         * L9 is "every rail stepper draws its seam TWICE (component inset shadow +
         * Live border), and three of eight draw 1px instead" — two drawers at two
         * weights. Here the control draws its own inset shadow and NOTHING ELSE,
         * and the block rule is the rail's, above a row rather than around a
         * control, so the two can never disagree about a weight.
         *
         * THE BLOCK AXIS IS SYMMETRICAL AND IT IS NOT A CORRECTION MARGIN: every
         * opening row pays the same --ui-space-3 above its line, so the rhythm
         * stays uniform-gap-plus-one-constant and no row's position depends on how
         * many rows are above it (L5). */
        live-rail > [data-section-start] {
            border-block-start: var(--ui-hairline) solid var(--ui-line);

            /* THE LINE SITS IN THE MIDDLE, AND THAT TOOK BOTH HALVES. Ben, 23 Aug 2026:
             * "the seperater line between Brew and Steam Is not centered between the two.
             * Also Brew itself it not centered between the line above and below it."
             *
             * MEASURED, before: the rail's --ui-space-6 gap put 28px above every line and
             * the padding below put 12 — so the line read as the next row's lid, and a
             * one-row block like Brew sat 13 below its own line and 28 above the next.
             * Both complaints are one asymmetry seen from two sides.
             *
             * The space ABOVE the line is the rail's gap; the space BELOW it is this
             * row's padding. Centring them means changing both, so this margin trims the
             * gap to --ui-space-5 and the padding below matches it: 24 and 24, at every
             * opening. Written as the difference between the two tokens rather than as
             * -4px, so a change to either keeps the line centred. */
            margin-block-start: calc(var(--ui-space-5) - var(--ui-space-6));
            /* THE LINE SITS BETWEEN THE TWO ROWS, NOT AGAINST THE LOWER ONE — Ben,
             * 23 Aug 2026: "Vertical spacking and marginds need a little work around
             * the horixintal deviding lines, the line should be between two of the
             * steppers or well spaced below the presets etc."
             *
             * The rail's gap puts --ui-space-6 above every line; this padding is what
             * is left below it, and at --ui-space-2 that was 28 above against 8 below.
             * The line read as BREW's lid rather than as the boundary between two
             * blocks, which is what he is describing.
             *
             * --ui-space-5, AND IT IS THE OTHER HALF OF THE CENTRING ABOVE. It has to
             * equal what the margin leaves above the line, and it does: 24 and 24.
             *
             * THE RAIL CAN AFFORD IT ONLY BECAUSE THE PRESETS MOVED. Measured at
             * 1920x1200 — which the fit makes every landscape screen — the rail had
             * EXACTLY zero spare: 1081 of content in 1081 of interior. Each opening now
             * costs 8px more (-4 of margin against +24 of padding, where it was 0 and
             * +12), so the four cost 32; the two preset rows pulled against their
             * steppers hand back 44.8. Net 12.8 to the good.
             *
             * THE FIRST ATTEMPT AT THIS, WITHOUT THE PRESET CHANGE, IS WHY THAT
             * ARITHMETIC IS WRITTEN DOWN: --ui-space-4 alone grew a scrollbar, the row
             * lost width, and every stepper cap came out at 73 against
             * --ui-stepper-cap's 78 — caught by live-bands' own cmp-lo-3 assertion
             * rather than by eye. */
            padding-block-start: var(--ui-space-5);
        }

        /* THE GAUGE CLUSTER. The row is an auto track in <live-main>: content-sized,
         * so the value track is the display type's own box and never a number
         * somebody wrote down (bug L2 was 44px against 45-52px digits).
         *
         * WRAPS, and that is measured rather than preferred. The obvious shape is the
         * one the tile's own gallery entry uses - grid, 1.15fr for the promoted
         * reading and six equal tracks after it. It overflows: a stat tile opts out
         * of inline-size containment (its display type is clamp(38px, 4.2cqi, 52px)
         * and must read an ancestor), so a tile is its content's width and seven of
         * them do not fit 643px at the design floor - the cluster overflowed
         * horizontally at ALL THREE geometries, which is bug L2 in the other axis.
         * A wrapping flex row is Appendix 14's "auto-fill tile grid ... the only
         * genuinely fluid layout in the app, and the pattern to copy", expressed
         * without inventing a minimum column width the token sheet does not have.
         * How many gauges the real cluster carries, and whether any of them drop
         * below a width, is live-components-inventory's row. */
        .gauges {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: var(--ui-space-3) var(--ui-space-5);
        }

        /* EQUAL SHARES, NOT CONTENT WIDTHS (it16; arithmetic corrected in review). A
         * flex basis of auto bases a tile on its own content, so the seven readouts sat
         * at seven different pitches and the row read as a ragged list where Slate's
         * reads as a ruled row:
         *   ORACLE live-ready the seven labels [i=96][i=99][i=102][i=105][i=107][i=110]
         *          [i=113] at x = 488, 710, 906, 1102, 1298, 1495, 1691 — pitches
         *          222, then 196 five times, with the last tile 172 so it ends at
         *          1863, the chart's own right edge. NOT even (it16's note said 196
         *          even; the first and last tiles are Slate's hand-drawn exceptions),
         *          but a ruled row whose middle pitch is 196.
         * A zero basis is what makes flex share the line equally: seven equal columns
         * across the full card width land within a few pixels of Slate's at both ends
         * (pitch just over 200) and inside ~23px mid-row. Where Slate draws one row
         * three widths, one component drawing one width is the sanctioned consistency
         * class — the residue is classified, not hidden. The wrap this row was given
         * for is unchanged: below the reference geometry the tiles still wrap rather
         * than overflow, which is the measured behaviour the .gauges note above records
         * and the reason this is not a seven-track grid. */
        .gauges > ui-stat-tile {
            flex: 1 1 0;
        }

        /* THE LAST READING ENDS ON THE CHART'S EDGE, and Slate's own row does the same
         * thing by a different route.
         *
         * Ben, 25 August 2026: "Move the Tank measurement to the right be 50px or so, the
         * right of the mm should align with the edge of the chart."
         *
         * MEASURED, and 50 is his number to a pixel: the cluster's own box already ends at
         * 1829.6 — where the plot's last x label ends — but the tile inside it is 168 wide
         * holding about 117 of digits, left-aligned, so the unit finished at 1778.9. The gap is
         * 50.7.
         *
         * THE ROW IS EQUAL SHARES AND STAYS THAT WAY. What changes is where the last
         * tile's content sits INSIDE its share, not how wide the share is — so the six
         * pitches before it are untouched and only the ragged end is closed. The oracle
         * above records that Slate reaches the same edge by hand-drawing its last tile
         * narrower (172 against a 196 pitch); one component drawing one width and aligning
         * its content is the same answer without the exception. */
        .gauges > ui-stat-tile:last-child {
            justify-items: end;
        }

        /* THE STATS BLOCK: the notices and the gauge cluster, as ONE grid item.
         *
         * WHY A WRAPPER RATHER THAN A FOURTH SLOT. <live-main>'s tracks are
         * \`auto minmax(0, 1fr)\` and its slots ARE the grid items (\`slot { display:
         * contents }\`), so an extra leading slot would take row 1 and hand the gauges the
         * \`1fr\` the chart owns — the skeleton's whole sizing contract, undone from
         * outside. A declared third track is no better: an empty track still spends a
         * \`gap\`, which is the hole <live-main> avoids for the GHC strip by leaving that
         * row implicit. So the notices ride in the row that is already \`auto\` and already
         * content-sized, and <live-main> is untouched.
         *
         * The connection surface is above the readings on purpose: "not connected" is the
         * fact that makes every number under it meaningless, and Slate puts its own strip
         * at the top of this column too (#live-alert, measured [488,168,1375,130]). */
        .stats-block {
            display: grid;
            /* TWO COLUMNS SINCE THE CLOCK CAME BACK: the notices and the readings, and
             * beside them the time of day. See THE WALL CLOCK's placement note. */
            grid-template-columns: minmax(0, 1fr) auto;
            /* THREE ROWS SINCE THE HEADING CAME BACK (parity surface 1): the identity
             * line, the notices, the readings. Stated rather than left implicit so the
             * clock's 1 / -1 still spans the whole block — -1 is the last EXPLICIT
             * line, so an implicit third row would have left the clock spanning two of
             * three and the span would have silently stopped meaning what it says. */
            grid-template-rows: auto auto auto;
            column-gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .identity {
            grid-column: 1;
        }

        /* THE NOTICES AND THE READINGS RUN THE FULL CARD WIDTH (review,
         * 7-live-polish). They sat in column 1 and paid the clock's column — 64px
         * plus the 24px gap — on every row, so the seven tiles shared 1289px where
         * Slate's share 1375 and the cluster stopped 88px short of the plot's edge:
         *   ORACLE live-ready the Tank label [i=113] rect [1691,222,172,18] ends at
         *          1863 — the same x the chart ends ([i=115] 488+1375) — and the
         *          alert strip [live-pulling i=92] is [488,168,1375,130], the full
         *          card width. Only the IDENTITY line shares its row with the clock.
         * The clock is confined to row 1 (below), so these two rows have nothing in
         * column 2 and the span is real width, not overlap. */
        .notices,
        .gauges {
            grid-column: 1 / -1;
        }

        /* =====================================================================
         * THE STAT CLUSTER'S HEADING (parity surface 1; finding P-2's content half)
         *
         * §4.1's skeleton says what belongs here in four words — "<stat-cluster>  auto
         * (heading + gauges)" — and the heading was the half that never got built. Slate
         * draws it as the first line of its chart card and Ben reported it missing from
         * the glass:
         *   ORACLE live-ready #profile-name [i=92] <h1> "Extractamundo Dos! (2)"
         *          rect=[488,172,262,29]; live-pulling [i=95] font-size = 24px,
         *          font-weight = 500, colour rgb(244,247,248)
         *          [= --ui-text-2xl / --ui-weight-medium / --ui-text]
         *   ORACLE live-ready #slate-live-profile-dose [i=93] "· 17.0 g"
         *          rect=[762,174,53,27]; live-pulling [i=96] font-size = 18px,
         *          font-weight = 400, colour rgb(148,161,169)
         *          [= --ui-text-md / --ui-weight-regular / --ui-muted]
         *   ORACLE live-ready #machine-status [i=94] "Disconnected" rect=[1607,177,161,22]
         *          — the machine's state, right-aligned at the far end of the same line,
         *          just inside the wall clock at [1799,170,64,31].
         *
         * WHICH IS WHERE THE STATUS CHIP MOVED FROM AND TO. It was in the header band's
         * lead cluster, beside the library button; Slate puts the same one word on this
         * line, and this line is where a reader looks for what the machine is doing —
         * over the readings it explains, not over the profile controls. Same component,
         * same one word, Slate's own place for it.
         *
         * WHAT IS STRUCTURE AND WHAT IS DATA. The heading is structure and it is here.
         * profileName is DATA and it has no owner: it is a declared property of this
         * screen that nothing in src/ ever writes, so the loaded profile's name appears
         * nowhere on the Live screen today — the same shape of gap as the rail's targets
         * before P-1, and live-screen.favourites (never populated, app-boot.js:165) is
         * its twin. Wiring it is a data run's row and it is recorded as one; the
         * heading collapses to the chip alone until it lands, rather than reserving a
         * box for a string nobody supplies.
         * ================================================================== */
        .identity {
            display: flex;
            flex-direction: row;
            align-items: baseline;
            gap: var(--ui-space-2);
            min-inline-size: 0;

            /* AIR UNDER THE IDENTITY LINE. Slate leaves 21px between the bottom of the
             * profile name and the top of the first readout's microcap — ORACLE
             * live-ready #profile-name [i=92] rect [488,172,262,29] (bottom 201) against
             * the Time label [i=96] rect [488,222,198,18] — and this block had none at
             * all, so the name and the cluster's caps sat on one another.
             *
             * ON THIS ROW, NOT ON THE BLOCK'S row-gap, and the reason is the trick the
             * notices' own comment spells out: a display:none element generates no box
             * and therefore no margin, "so a connected machine with no refusal costs
             * this column exactly zero pixels". A row-gap does not collapse with the row
             * it separates, so gapping the block charged the chart 48px for a notice
             * that had nothing to say — measured, and exactly the defect that comment
             * exists to prevent. The identity line always renders (it carries the status
             * chip), so its own padding is air that is always wanted and never spent on
             * an absent row. */
            padding-block-end: var(--ui-space-5);
        }

        .profile-name {
            margin: 0;
            min-inline-size: 0;
            overflow: hidden;
            color: var(--ui-text);
            font-size: var(--ui-text-2xl);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .profile-dose {
            flex: 0 0 auto;
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
        }

        /* The state word sits at the far end of the line, which is Slate's placement and
         * also the reason it is not in the flow of the name: a long profile name gives
         * (it ellipsises above), and the one word saying whether any of this is live
         * does not. */
        .identity ui-status-chip {
            margin-inline-start: auto;
            /* 20, NOT THE CHIP'S OWN 18 — Ben, 30 August 2026. Measured in his capture:
             * IDLE is 46px wide with 14px of ink at x 1658..1703, and the clock beside
             * it carries 18px of ink at x 1733..1829. The state word read as a caption
             * on the clock rather than its equal. At --ui-text-lg the two are level and
             * the line reads as one status. Scoped here so the chip's frozen oracle
             * size still governs every other place it is used. */
            --_ui-status-chip-size: var(--ui-text-lg);
        }

        /* THE PROFILE LINE GOES INVISIBLE FOR A STEAM SESSION, and it is visibility rather
         * than display for the reason Slate states beside the same two elements: "The
         * heading row keeps its height so the machine status and clock do not shift when
         * the mode changes."
         *
         * Ben, 25 August 2026, on the function audit: "The profile name and dose: Copy
         * slate." A steam session has no profile, so the name on screen is the espresso
         * recipe that is not running - and a name that DISAPPEARS takes the status chip and
         * the clock 29px up the screen with it every time steam is pressed. */
        :host([chart-mode="steam"]) #profile-name,
        :host([chart-mode="steam"]) #profile-dose {
            visibility: hidden;
        }

        /* The clock shares the IDENTITY's row only (review, 7-live-polish — it spanned
         * 1/-1, which held its column open across the readings' row too and cost the
         * gauge cluster 88px against the oracle; see .gauges above). Slate's own
         * geometry is the same: its clock [i=95] sits on the identity line and its
         * Tank column runs beneath it to the card's edge. Row 1 always renders (the
         * identity line carries the status chip), so the clock still adds no row of
         * its own and the block is exactly its column-1 content's height
         * (live-bands' audit-1 test measures that by hiding it). */
        .clock {
            grid-column: 2;
            grid-row: 1;
            align-self: start;
            justify-self: end;
        }

        /* NO BOOT, NO NOTICES — the block is not rendered at all rather than rendered
         * quiet. A screen with no shell attached has no connection to report, and
         * \`waiting\` ("opening the connection to the machine") would be a claim about a
         * socket nobody opened. It also keeps the skeleton's own suite honest: that suite
         * mounts <live-screen> bare to measure the grid, and a banner it never asked for
         * would come out of the chart's height. */
        .notices {
            display: flex;
            flex-direction: column;
            min-inline-size: 0;
        }

        /* THE SPACING IS ON THE NOTICE, NOT ON A GAP, and that is the whole trick.
         *
         * Both banners collapse to nothing when they have nothing to say
         * (\`:host([surface='ready'])\` and \`:host(:not([kind]))\` are \`display: none\`), and a
         * \`display: none\` element generates no box and therefore no margin — so a connected
         * machine with no refusal costs this column exactly zero pixels. A \`gap\` on either
         * container could not do that: a gap is spent between TRACKS, and an empty track
         * is still a track. It is the same hole <live-main> leaves the GHC strip's row
         * implicit to avoid, solved the same way one box in. */
        .notices > * {
            margin-block-end: var(--ui-space-3);
        }

        /* THE MACHINE KEYS, ACROSS THE STRIP'S ONE ROW.
         *
         * FOUR EQUAL TRACKS AND NO FIFTH. Stop is not a track: it takes the whole row
         * while the machine runs, because the four action keys are refused then and an
         * abort a hand has to aim at is the wrong shape for the one control that must
         * never be missed. That is Slate's own arrangement seen sideways — its
         * #ghc-stop-btn-rail spans the rail for exactly this reason ("one unambiguous
         * abort target regardless of how the run started"), and its five-button column
         * disables the other four while active. */
        .ghc-strip {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 1fr;
            gap: var(--ui-space-3);
            min-block-size: var(--ui-control-h);
        }

        /* GRID, NOT BLOCK, so the control fills the track it was given. The component's
         * own host is inline-grid and its .btn is a flex box that sizes to its label; a
         * block host leaves the button at label width inside a 229px cell, which measured
         * as four narrow controls floating in a wide strip. A grid host stretches its one
         * child, which is the seam ui-button documents ("a screen that needs a full-width
         * button sets ui-button { display: block } from outside") arrived at by the one
         * spelling that actually stretches. */
        .ghc-strip ui-button {
            display: grid;
        }

        /* THE HOLD MENU IS NOT A ROW OF THIS SCREEN.
         *
         * The screen IS the §4.1 grid — band, body, foot band — so any direct child of
         * this root is a grid item and gets an implicit fourth track. The menu's own
         * surface is position:fixed and is placed against whichever cell was held, so the
         * host is a 0x0 wrapper that only needs to exist. display:contents makes it
         * generate no box at all, which is the one spelling that leaves the grid's three
         * rows exactly three. (The numpad next to it is a dialog and was already out of
         * flow; this is why it never had the same problem.) */
        #hold-menu {
            display: contents;
        }

        /* THE FOOT BAND, IN ONE SLOTTED BOX. §4.1 draws two columns - the phase table
         * beside the derived list - and D1 deletes the derived list from v1 entirely,
         * so the second column would be a column with nothing in it. What is beside
         * the table instead is the band's own controls (rating, history), and the
         * pair is ONE slotted child so that <live-foot>'s single-row band, its floor
         * and its last-resort scroll are all still its own (C2).
         *
         * min-block-size: 0 so the band can squeeze it below the design floor,
         * which is the only place C2's scroll ever fires. */
        /* ===================================================================
         * THE BAND'S FOUR BLOCKS — SLATE'S OWN ORDER (parity 7-live-polish)
         * ===================================================================
         * ORACLE live-ready, left to right: #shot-history-panel [i=117] rect
         * [431,944,470,256] (which shot), #shot-data-panel [i=126] [902,944,1018,256]
         * (the phase table), .slate-derived-list [i=145] [1372,984,324,136] (the four
         * scalars) and .slate-shot-rate [i=154] [1720,980,172,165] (the rating).
         *
         * THE PHASE TABLE'S TRACK IS THE ONLY 1fr and the other three are content-sized,
         * which is Slate's arrangement: its table content sits at 936..1342 inside a
         * 1018px panel, so what separates the table from the derived list is SPACE
         * rather than a column that grew. The table's own columns keep their floor
         * (grow: 0 in live-targets.js) so the slack lands in the track, not between
         * the numbers.
         *
         * MEASURED AND REJECTED FIRST: grid-auto-flow: column with
         * justify-content: space-between. It reads like the same idea and it is not —
         * when four content-sized blocks want more than the band has, the free space is
         * NEGATIVE and space-between distributes it as negative gaps, so the derived
         * list was drawn ON TOP of the phase table (measured: the dl at x=1130 over
         * cells ending at 1215, and the table invisible in the capture). A 1fr track
         * cannot go negative; it goes to zero and the table clips where it can be seen.
         *
         * AN AUTO TRACK FIRST, NOT A WIDTH. The identity block is absent whole while a
         * shot is running (there is no stored shot to name then), and an auto track that
         * collapses to nothing is how a four-block band becomes a three-block one. */
        .foot-grid {
            display: grid;
            /* FOUR CONTENT-SIZED PARTS, SPREAD — Ben, 23 Aug 2026: "can you look at the
             * bottom rail ... try to structure it in a better way, better spacing etc."
             *
             * The middle track was minmax(0, 1fr), which handed every spare pixel to the
             * phase table — and that table does not want them. Its three value columns
             * are grow: 0 on purpose, each as wide as its own heading and no wider,
             * because that is what Slate's band measures (ORACLE #shot-data-pi-time
             * [i=134] w=80, -weight w=88, -volume w=94). MEASURED here before the change:
             * the table's element ran 730..1418 while its last column ended at 1185 —
             * 233px of dead space INSIDE the table, and the four parts crowded left of a
             * gap that belonged to nobody.
             *
             * So every track is content-sized and the slack is distributed BETWEEN them.
             * The identity keeps the left edge, the rate strip keeps the right, and the
             * two middles sit at even intervals — which is what a band of four unrelated
             * readings should look like, and what "structure it better" asks for. */
            grid-template-columns: auto minmax(0, 1fr) auto auto;

            /* STRETCH, SO THE FOUR RULES ARE ONE LINE. It was start, which sizes every
             * part to its own content — and since the rules are drawn on each part's
             * leading border, four parts of four heights drew four rules of four
             * lengths: 166, 144 and 109 against an identity block of 82. Read together
             * they looked like three accidents rather than a divided band.
             *
             * The content does not move: each part lays itself out from its own start,
             * so stretching the BOX only lengthens the rule beside it. */
            align-items: stretch;

            /* HALF THE GAP, BECAUSE THE OTHER HALF IS THE RULE'S. Ben, 23 Aug 2026:
             * "the spacing needs a little work, with the Phase etc moving to the right
             * a little. The three sort of parts in the bottom rail should be seperate
             * but faint vertical lines, same lines that seperate the different secsions
             * in the left rail."
             *
             * Same arithmetic as the rail's dividers one region up, turned on its side:
             * the space before a rule is this gap and the space after it is the track's
             * own padding, so they are the same token and the line sits centred between
             * two parts. --ui-space-4 either side reads as a wider break than the old
             * undivided --ui-space-6, which is also the "moving to the right" he asked
             * for — the phase table starts 18px further in than it did. */
            gap: var(--ui-space-4);
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE BAND'S OWN SECTION LINES — the rail's, rotated. Same token and same
         * weight as live-rail > [data-section-start], because Ben named them as the
         * same thing: "same lines that seperate the different secsions in the left
         * rail". A child selector, so a part that is not rendered (the derived block on
         * a machine with none, the rate strip with no shot) takes its rule with it and
         * no line is ever left hanging in an empty track. */
        .foot-grid > * + * {
            border-inline-start: var(--ui-hairline) solid var(--ui-line);
            padding-inline-start: var(--ui-space-4);
        }

        /* WHICH SHOT THIS IS. Three lines, Slate's three sizes, and nothing positioned:
         * ORACLE #history-date [i=121] 20px/500 --ui-text, #history-profile-name
         * [i=122] 20px/500 --ui-muted, #history-dose-in [i=123] 18px/400 --ui-muted. */
        .foot-shot {
            display: flex;
            flex-direction: column;
            /* THE IDENTITY LINES AT THE TOP, THE WAY OUT AT THE BOTTOM — see .foot-controls
             * for the rule and Ben's own sentence. This column is the one with a variable
             * number of lines above its button (three identity lines, or none), so it is
             * the one that would otherwise leave its button somewhere different on every
             * shot. */
            justify-content: space-between;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .foot-shot p {
            margin: 0;
            white-space: nowrap;
        }

        /* THE WAY BACK AND THE WAY OUT, ON ONE LINE. The two arrows step through the
         * page the shell already read; the button leaves for the History screen. They
         * share a row because they are one idea — which shot this band is about — and
         * because the identity column is auto-sized: stacking them would make the
         * column as wide as the widest of the three rather than as wide as the dates
         * above it. Baseline, not centre: the button carries text and the arrows do
         * not, so aligning their boxes would sit the glyphs slightly high. */
        /* THE ROW FILLS THE COLUMN, ARROWS AT BOTH ENDS — Ben, 30 August 2026: "change
         * the button arrangement so its full width with < / All Shots / >. Make < and >
         * a bit wider than the 64x64 though so they are easier to press."
         *
         * The two arrows were side by side at the left with the word after them, so both
         * targets sat in the same third of the column and the right-hand two thirds were
         * dead. Now they hold the two edges, which is where a thumb already is, and the
         * word takes whatever is between.
         *
         * 90 x 64, AND THE WIDTH COMES FROM OUTSIDE. ui-icon-button sizes itself with
         * min-inline-size, so an outer inline-size stretches it and the 64px HEIGHT is
         * untouched — the component's own note records this route
         * ("ui-icon-button.header-action { inline-size: 96px }") and Ben's 23 August rule
         * that all three controls share one height still holds. */
        .shot-nav {
            display: flex;
            flex-direction: row;
            align-items: center;
            inline-size: 100%;
            gap: var(--ui-space-2);

            /* THE THREE CONTROLS ARE ONE HEIGHT — Ben, 23 Aug 2026: "Make the history
             * left and right botton the same height as the all shots button." They were
             * not: the arrows asked ui-icon-button for lg (--ui-control-lg, 82) beside
             * a ui-button at --ui-control-h (64), so two 82px squares sat either side of
             * a 64px word and the row read as three unrelated things. md IS
             * --ui-control-h, so the match comes from the component's own size scale
             * rather than from a height written here — nothing to keep in step.
             *
             * AND THE ROW STANDS OFF FROM THE LINES ABOVE IT. .foot-shot spaces its
             * three text lines with --ui-space-1, which is right between two lines of
             * type and far too tight between a line of type and a row of 64px controls.
             * This is the one place in the column where the spacing changes meaning. */
            margin-block-start: var(--ui-space-3);
        }

        /* THE STAMP AND THE CHARGE SHARE A LINE — Ben, 30 August 2026, choosing the
         * short band. The column carried three text lines over a 64px control row, which
         * is what made it the tallest block in the band and therefore what set the band's
         * height. Folding the dose up beside the date takes a line out of the column
         * without taking a word off the screen, and that is what lets the band come down
         * to 172 and put its rule on the left rail's own divider at y 992. */
        .shot-head {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
            min-inline-size: 0;
        }

        .shot-when {
            color: var(--ui-text);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-medium);
        }

        /* TWO LINES, NOT ONE WITH A TAIL — Ben, 30 August 2026, asking what to do about
         * long profile names in the band.
         *
         * MEASURED FIRST: the name fits one line today with NOTHING to spare. His capture
         * has the identity column's content at 490px and this name's ink at 491, so any
         * name longer than "ULC Dos Bengelitos - REF colleague (limiter 6.0)" already
         * ellipsises, and the short band's narrower column ellipsises this one.
         *
         * A clamp of two says the same thing the ellipsis says when it must, and says the
         * whole name the rest of the time. It costs the column nothing: the row above it
         * gave up a line when the dose moved onto the stamp, so the second line spends
         * that one. The ellipsis is kept for the name that overruns even two. */
        .shot-profile {
            overflow: hidden;
            color: var(--ui-muted);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-medium);
            text-overflow: ellipsis;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.25;
        }

        .shot-charge {
            display: flex;
            flex-direction: row;
            gap: var(--ui-space-2);
            color: var(--ui-muted);
            font-size: var(--ui-text-md);
        }

        /* THE NOTES SHEET (F-029). It reuses the band's three identity classes above
         * rather than restating them, so the sheet and the panel two inches from it
         * cannot spell one shot two ways — the only thing declared here is the column
         * and the paragraph, which the band's own .foot-shot p rule does not reach.
         * (No backticks in this block: it is a template literal.) */
        .notes-sheet {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-3);
        }

        .notes-identity p {
            margin: 0;
        }

        .notes-body {
            /* A NOTE IS PROSE AND WRAPS. The band's identity lines are nowrap because
             * they sit in a fixed column; a paragraph of tasting notes is the opposite
             * case, and pre-wrap keeps the line breaks the person typed. */
            margin: 0;
            color: var(--ui-text);
            font-size: var(--ui-text-md);
            white-space: pre-wrap;
        }

        /* THE FOUR SCALARS. A description list because that is what it is — four terms
         * and four values — and a two-column grid because Slate right-aligns the values
         * to one edge (ORACLE [i=147] and [i=149] both end at x=1696, as do the two
         * pairs [i=151] and [i=153]). The term is the microcap role at Slate's own
         * 14px; the value is the numeric modifier, so a column of them lines up. */
        .foot-derived {
            display: grid;
            grid-template-columns: auto auto;
            align-items: baseline;
            gap: var(--ui-space-2) var(--ui-space-5);
            margin: 0;
            min-inline-size: 0;
        }

        .foot-derived dt {
            font-size: var(--ui-text-2xs);
        }

        .foot-derived dd {
            margin: 0;
            justify-self: end;
            color: var(--ui-text);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-light);
            white-space: nowrap;
        }

        .foot-controls {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            /* THE FIRST CHILD ON THE TOP LINE AND THE LAST ON THE FLOOR — which is the
             * same rule .foot-shot follows, and for the same reason.
             *
             * Ben, 25 August 2026: "Make sure ALL items on the bottom of the screen are
             * aligned", and then "Put 'rate this shot' up so its aligned with the top row."
             * Both at once is space-between: All notes reaches the band's floor with the
             * All shots button and the phase table's TOTAL, and the rate button starts on
             * the line the date, the PHASE heading and RATIO start on.
             *
             * IT WAS flex-end, which answered only the second half of the first sentence
             * and stacked both buttons at the bottom with the column's slack above them. */
            justify-content: space-between;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        /* THE CORNER FILLS ITS COLUMN, which is what lets its own space-between reach the
         * band's two edges. Without it the control is as tall as its two buttons and its
         * spacing has nothing to spread: MEASURED, the rate button sat on the top line and
         * All notes ended at 1141 against the 1176 every other column reaches. */
        .foot-controls > ui-rating-control {
            flex: 1 1 auto;
        }

        /* THE WAY IN TO THE SHOT HISTORY, IN SLATE'S OWN PLACE AND SHAPE (it16).
         *
         *   ORACLE live-ready #history-open-viewer [i=118] class .slate-btn
         *          .slate-history-open, rect [578,1081,176,64], text "All shots" — a
         *          TEXT button under the identity block, not an icon in the rating
         *          corner. Its block sits inside #shot-history-panel [i=117]
         *          [431,944,470,256], i.e. under #history-dose-in [i=123].
         *
         * It was an <ui-icon-button> beside the rating control, on an argument about
         * 64px of horizontal slack that was sound and was answering the wrong
         * question — the placement was never a spacing problem, and the oracle had
         * the answer the whole time. The four measured placements stay recorded in
         * #openHistory; this is the fifth and it is the reference's. The button keeps
         * its own width rather than the column's (the rule and its axis are the
         * .foot-shot #history-entry note below). */
        /* (Review, 7-live-polish: two earlier layers of this note — "the way out
         * fills its column" and "the two sit side by side" — described it20's
         * arrangements of an "All shots" button in the rating corner and were still
         * standing after it21 moved the button back under the identity. The history
         * of those arrangements lives in the template's own corner note and in
         * #openHistory; the rules below are the ones that exist.) */
        /* THE WAY OUT KEEPS ITS OWN WIDTH inside a block that can otherwise collapse:
         * align-self rather than justify-self, because .foot-shot is a flex COLUMN and
         * the cross axis is the inline one.
         *
         * SCOPED TO .shot-nav SINCE 23 Aug, AND THAT IS THE POINT. The rule was written
         * when this button was a direct child of the flex COLUMN and carried its own top
         * margin because nothing else spaced it. It now sits in .shot-nav, a flex ROW
         * beside the two history arrows, where the same two declarations mean something
         * else entirely: align-self: flex-start pins it to the row's top and the margin
         * pushes it 8px down, so the button sat 4px below two arrows it had just been
         * matched in height to (Ben: "Make the history left and right botton the same
         * height as the all shots button"). MEASURED: arrows at 1025, button at 1029, in
         * a row that was 72 tall for a 64px control.
         *
         * The row centres its three controls and spaces them with its own gap, so
         * neither declaration has a job left. What replaces them is nothing. */
        .shot-nav #history-entry {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        /* 82 WIDE, 64 TALL, AND BOTH COME FROM THE SCALE. --ui-control-lg is the step
         * above --ui-control-h, and it is the size these two arrows used to ASK FOR:
         * before 23 August they were ui-icon-button size="lg", which made them 82px
         * SQUARES beside a 64px word, and Ben's fix was to bring them down to md so all
         * three controls shared one height. That fix was about height. This is width, so
         * the old number comes back on the axis it was never wrong on: 82 x 64.
         *
         * No raw length, because live-screen.js may not write one — test/live-screen.test.mjs
         * §"no steam bound, no chart number and no foot-band number is written here". */
        .shot-nav ui-icon-button {
            flex: 0 0 auto;
            inline-size: var(--ui-control-lg);
        }

        /* THE RATE STRIP'S OWN MEASURE, STATED — because the control does not state it.
         *
         * <ui-rating-control> is a flex column of three rows and none of them has an
         * intrinsic inline size, so the host's max-content is ZERO: measured at 1920,
         * an auto grid track holding nothing else resolved the strip to 0px and the
         * band's fourth block vanished. Everything it had ever been given was space
         * something ELSE in its column happened to ask for.
         *
         * SO THE BAND STATES THE BOX, which is what a screen's sheet is for (§4.1 gives
         * a region's boxes to the screen and the look to the component), and the number
         * is Slate's own, derived rather than typed:
         *   ORACLE live-ready .slate-shot-rate [i=154] rect [1720,980,172,165], with
         *          its slider [i=157] and its button [i=158] both 147 wide inside it.
         *   172 = two --ui-control-lg (82, the toolbar control this band's own header
         *   derives from) plus one --ui-space-2. No literal, and it moves with the
         *   scale.
         * The component's missing intrinsic width is its own row to fix; until then a
         * stated floor here is the honest place for it, and it is recorded as such. */
        .foot-controls {
            /* TWO LARGE CONTROLS AND A GAP, and the cap wraps rather than the column
             * growing. Sizing the column to hold "RATE THIS SHOT" on one line took 74px off
             * the phase table and ellipsised two of its headings instead — the same defect,
             * one column along. ui-stat-tile's new --_ui-stat-label-wrap is what lets the
             * cap take two lines here and stay on one everywhere else. */
            min-inline-size: calc(2 * var(--ui-control-lg) + var(--ui-space-2));
        }

        /* THE PHASE TABLE CLIPS INSIDE ITS OWN TRACK RATHER THAN PUSHING THE BAND.
         *
         * <ui-data-grid>'s host takes min-inline-size: 0 and gives way, but the grid
         * INSIDE it has ch minimums on every track, so below a certain width the grid
         * is wider than the host — and with the host visible that width reached
         * <live-foot>'s band, which reported an INLINE overflow: content leaving the
         * box, which §2.4 forbids outright.
         *
         * MEASURED at the bench once the band carried four blocks and a way out. What
         * this does NOT do is hide anything silently: the table's own cells and heads
         * carry text-overflow: ellipsis and truncate visibly first — that degradation
         * is measured, listed and pinned to the pixel by this screen's render suite,
         * and the reference geometry has none of it. */
        .foot-grid > ui-data-grid {
            min-inline-size: 0;
            overflow: hidden;

            /* AND ITS TRACK STAYS FLEXIBLE, WHICH IS NOT A PREFERENCE. A band of four
             * content-sized tracks was built and measured first, because that is the
             * tidier structure — and this component cannot take part in one: it reports
             * an intrinsic width of 19px while its own grid lays out to 1288 and clips.
             * The note above and .foot-controls' one rule up both record the same
             * missing width, and call it the component's own row to fix. So the table
             * keeps a 1fr track and FILLS it — see the grow the call site passes. */
        }
    `];

    #i18n = new I18nController(this);

    /** The chart's data road. A controller, so its subscription lives and dies with
     *  this element (CONVENTIONS §12) without this file owning a lifecycle hook. */
    #chart = new ChartFeed(this);

    /** The connection, refusal and capability-gate road. Same shape, same reason: its
     *  five subscriptions live and die with this element, and a route swap takes them
     *  with it. It is the only writer of `ghc` and `dim`. */
    #wiring = new LiveWiring(this);

    /** The announced sentence and the state it was announced for (chart-C14). */
    #summary = '';

    #summaryKey = null;

    constructor() {
        super();
        this.ghc = false;
        this.boot = null;
        /* No dim state until a machine state arrives. `null` is the absence of the
         * attribute, so a screen that is not dimming carries nothing to clear. */
        this.dim = null;
        this.shot = null;
        /* Nothing is invented at construction: no target value, no favourite, no
         * preset and no limits table. A screen that defaulted a number would be
         * showing a setting the machine never sent. */
        this.machineState = '';
        this.chartMode = CHART_MODE.ESPRESSO;
        this._expanded = false;
        this._notes = false;
        this._weatherOpen = false;
        this._notesDirty = false;
        /* NOT AN OFFER UNTIL THE LISTING SAYS SO. `false` here is the same refusal to
         * invent that the line above it makes about targets: a button offered before
         * anything has established a destination is the dead-end control this corner's
         * own component header records as the measured old-skin defect. */
        this.dye2 = false;
        this.compliance = null;
        this.steamDerivation = null;
        this.steamSettled = false;
        this.milkPresent = false;
        this.readings = null;
        this.weather = null;
        /* NOT `{present: false}`: that would hide the Warmer control on a machine
         * nobody has asked about yet, which is a capability verdict invented at
         * construction. Null is "no answer", and the control renders present with the
         * dash — the same shape every other absence on this screen takes. */
        this.warmer = null;
        this.limits = null;
        this.targets = null;
        this.offers = null;
        this.presets = null;
        /* NULL, FOR THE REASON `warmer` FOUR LINES UP IS NULL. These were
         * `STEAM_STOP.TIME` and `WATER_STOP.VOLUME` — a stop condition asserted at
         * CONSTRUCTION, before any owner had looked at a machine, and the same class of
         * invented verdict that comment refuses for the cup warmer. It mattered more here
         * than it looks while the caption existed: the two values were printed as a
         * sentence about the machine, so a screen that had heard nothing still said "Timed
         * stop" and "Volume stop" out loud. The caption is gone, but these two are NOT —
         * `live-targets.js` still reads them to choose WHICH stop target the rail draws and
         * in which unit, which is the whole of what the rail now says about the mode. */
        this.steamStop = null;
        this.waterStop = null;
        this.favourites = null;
        this.favourite = '';
        this.profileName = '';
        this.storedDerivation = null;
        this.storedShot = null;
        this.shotId = '';
        this.rating = null;
        this.historyCount = 0;
        this.canStepOlder = false;
        this.canStepNewer = false;
        this.browsingHistory = false;
        this._typing = null;
        this._presetTyping = null;
        this._hold = null;
        this._clock = '';
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this.restoreFocusTo = null;
    }

    /** The wall clock's one interval, or null while this screen is not in a document. */
    #clockTimer = null;


    /** The seam classes go on the host - NOT in the constructor, because a custom
     *  element constructor must not gain attributes (CONVENTIONS §13). */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        /* THE ABORT IS HEARD ONCE, ON THE HOST, because it can be pressed in two places
         * — the rail's stack and the machine strip — and both `<ui-stop-button>`s
         * bubble and compose to here. A per-render `@stop-request` on each container
         * would be two bindings for one meaning, and the rail's stop button was built
         * WITHOUT one of those: `stop-request` reached this host and nothing listened,
         * which is why pressing STOP mid-shot did nothing at all. */
        this.addEventListener('stop-request', this.#onStopRequest);
        this.#tick();
        if (this.#clockTimer === null) this.#clockTimer = setInterval(() => this.#tick(), CLOCK_TICK_MS);
    }

    /** The other half of the interval, and the whole of its cleanup. A route swap
     *  disconnects this element, so the clock dies with the screen it is drawn on. */
    disconnectedCallback() {
        this.removeEventListener('stop-request', this.#onStopRequest);
        if (this.#clockTimer !== null) {
            clearInterval(this.#clockTimer);
            this.#clockTimer = null;
        }
        super.disconnectedCallback();
    }

    /** Read the clock; write the property ONLY when the spelling has changed, so a
     *  1 Hz tick costs one render a minute (see THE TIMER above). */
    #tick() {
        /* THE FORMAT IS THE USER'S AND THE DEFAULT IS THE SHIPPED ONE. `clockFormat` is a
         * routed device preference (Ben, 24 Aug 2026); an unset key is `undefined` and the
         * formatter answers 24-hour for anything it does not recognise, so this reads the
         * value straight through rather than restating the default here. */
        const now = wallClock(new Date(), this.#i18n.language, this.clockFormat ?? DEFAULT_CLOCK_FORMAT);
        if (now !== this._clock) this._clock = now;
    }

    /** The buffer is handed to the chart's road; nothing else here reads it. */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        /* THE WIRING (`live-15hz-loop`). The shell hands this screen one object, and the
         * shot buffer is already inside it: `boot.live.shot` is built by
         * `createLiveStores` and filled by `attachShotBuffer` off the machine, shot-state
         * and scale feeds. Until this line existed the road was complete at both ends and
         * joined at neither - `chart-integration` left it deliberately unwritten
         * ("nothing sets `shot` on the screen in the shipping app - that is
         * live-15hz-loop's row").
         *
         * WHY IT ASSIGNS THE PROPERTY rather than calling `watch` with the boot's buffer:
         * `shot` is this screen's own declared seam, so a test that hands it a buffer by
         * hand and the shell that hands it one through `boot` end in the same place, and
         * `screen.shot` is inspectable either way. An explicitly-set buffer WINS - the
         * `!this.shot` guard - because a caller that named a buffer meant it.
         *
         * The `watch` call is unconditional and costs one identity comparison: the
         * controller is idempotent for the same buffer by construction, and a
         * `changed.has(...)` guard here would be a second rule about when to re-watch,
         * disagreeing with the first the day a buffer is swapped without a property set. */
        if (changed.has('boot') && !this.shot) this.shot = this.boot?.live?.shot ?? null;
        this.#chart.watch(this.shot ?? null);
        this.#refreshSummary();
    }

    /** The derivation on screen right now. For the suite, and for the rows that will
     *  read the same shot the chart is drawing (the phase table, the gauges). */
    get derivation() { return this.#chart.derivation; }

    /** How many derivations the chart's road has run. A diagnostic, in the same sense
     *  as the card's `buildCount` and the buffer's `subscriberCount()`: chart-C9 is a
     *  claim about how often work happens, and a claim like that needs a counter. */
    get chartDerivations() { return this.#chart.derivations; }

    /**
     * chart-C14's summary, rebuilt only when it would SAY something different.
     *
     * The key is the state the sentence describes - refused or not, which shot, which
     * phase, and which five-second band of the shot's own clock - plus the language,
     * because a sentence that did not change in English still changes when the language
     * does. Everything else about a frame (a new sample, a re-render, a resize) leaves
     * the announced text exactly as it was, which is what keeps a polite region polite.
     */
    #refreshSummary() {
        const derivation = this.#bandDerivation;
        const ok = Boolean(derivation && derivation.ok);
        const seconds = ok ? derivation.scalars.durationSeconds : null;
        const key = [
            this.#i18n.language,
            ok,
            derivation ? derivation.reason ?? null : null,
            derivation ? derivation.shotId : null,
            derivation ? derivation.phase : null,
            typeof seconds === 'number' ? Math.floor(seconds / SUMMARY_EVERY_S) : null,
        ].join('|');
        if (key === this.#summaryKey) return;
        this.#summaryKey = key;
        this.#summary = this.#sentence(derivation);
    }

    /**
     * The sentence itself, built from the derivation's own scalars (B5) - the same
     * numbers the chart drew, read from the model rather than scraped back out of the
     * gauge cluster's rendered DOM, which is chart-C13 in one line.
     *
     * A clause is ABSENT when its number is. No shot has a yield before the first drop,
     * and a summary that said "yield 0.0 grams" would be reporting a measurement that
     * has not happened - the same rule the derivation applies to a 0 °C target.
     */
    #sentence(derivation) {
        const t = this.#i18n.t;
        if (!derivation || !derivation.ok) {
            return derivation && derivation.reason === 'noPouringSample'
                ? t('Shot chart. This shot has no pouring samples to draw.')
                : t('Shot chart. No shot yet.');
        }
        const scalars = derivation.scalars;
        const seconds = reading(scalars.durationSeconds);
        const pressure = reading(scalars.peakPressure);
        const flow = reading(scalars.averageFlow);
        const weight = reading(scalars.yield);
        const parts = [seconds
            ? t('Shot chart, {seconds} seconds.', { seconds })
            : t('Shot chart.')];
        if (pressure) parts.push(t('Peak pressure {pressure} bar.', { pressure }));
        if (flow) parts.push(t('Average flow {flow} millilitres per second.', { flow }));
        if (weight) parts.push(t('Yield {weight} grams.', { weight }));
        return parts.join(' ');
    }

    /** The words over the axes when the derivation refuses. The card owns the surface
     *  and knows no words; the reason is gate 6's and the sentence is this screen's. */
    #emptyMessage() {
        const t = this.#i18n.t;
        const shown = this.#bandDerivation;
        const reason = shown ? shown.reason : null;
        if (reason === 'noPouringSample') return t('No pouring samples in this shot.');
        return t('No shot yet.');
    }

    /* =======================================================================
     * THE BANDS. Four short getters, one row renderer, and the handlers that turn a
     * press into an EVENT - because a screen is layout, and the machine's truth is
     * the store's. Nothing below reads a store, calls a route or knows a bound.
     * ======================================================================= */

    /** Is the machine doing something the STOP target would abort? The enum decides
     *  (`isRunning`), not this file, and #47 is told rather than asked. */
    /**
     * DOES WEATHER OWN THE CORNER THIS FRAME?
     *
     * `weatherState` is the one owner of that question — it returns HIDDEN for a plugin
     * that is absent, a location never set, or a reading past two hours — so this asks it
     * rather than testing the payload here. A second test would be a second answer, and
     * the two would disagree the first time the rule moved.
     */
    get #weatherShowing() {
        return weatherState(this.weather) !== WEATHER_STATE.HIDDEN;
    }

    get #running() { return isRunning(this.machineState); }

    /**
     * IS THE CHART SHOWING A STEAM SESSION?
     *
     * READ OFF THE MODE, never off the machine state: the mode holds the finished graph
     * for a settle window after the valve closes, and a screen that asked "is the machine
     * steaming" would take the picture away the instant steaming stopped — which is the
     * moment a person looks at it.
     */
    get #steaming() { return this.chartMode === CHART_MODE.STEAM; }

    /**
     * The steam chart's channels for THIS session — four without a milk probe, five with.
     *
     * ONE READING, TWO CARDS. The embedded card and the expanded overlay must draw the
     * same set: a chart whose expansion has a series it does not is not an expansion of
     * it. Both read this getter.
     */
    get #steamSpecs() { return steamChannelSpecs({ milk: this.milkPresent }); }

    /**
     * Whether the machine's own channel has stopped answering — the one fact on this
     * screen that a frozen picture cannot tell you, and until tonight the one fact no
     * pixel carried. The store latched it correctly and nothing read it, so a channel
     * that went quiet with its socket open kept the chip lit and the state name on the
     * header for ever (`live-wiring.js` owns the tick that finds it).
     *
     * WHAT IT DOES NOT TOUCH, deliberately: `#running`, the dimming, the rail's mode and
     * the STOP target. A feed that stopped talking is not a machine that stopped pulling —
     * it is the case where you least know — so withdrawing the abort target on a stale
     * feed would be the same defect as burying it (cross-1), reached from the other side.
     * The chip stops claiming `live` and stops naming a state it can no longer read; every
     * control stays exactly where it was.
     */
    get #machineStale() { return this.#wiring.machineStale; }

    /**
     * The dose, spelled as the note beside the profile's name — Slate's own lockup.
     *
     *   ORACLE live-ready #slate-live-profile-dose [i=93] text "· 17.0 g",
     *          rect=[762,174,53,27], font-size 18px, colour rgb(148,161,169), beside
     *          #profile-name [i=92] "Extractamundo Dos! (2)" rect=[488,172,262,29].
     *
     * READ FROM THE SAME `targets` DOCUMENT THE RAIL STEPS, not from a second source:
     * one number, one owner (the workflow store, P-1). ABSENT IS ABSENT (A7): with no
     * dose held the note is not rendered at all rather than standing a zero in for one,
     * which is the same rule the rail's own steppers follow one band to the left.
     *
     * ONE DECIMAL, THROUGH THE ONE FORMATTER (review, 7-live-polish). The raw
     * interpolation printed "· 17 g" against the oracle record this comment itself
     * cites ("· 17.0 g") — Slate spells the workflow dose to one decimal here — and
     * against this screen's own foot, whose "In 17.0 g" already reads through
     * `scalarText`. Same number, same spelling, one function.
     */
    get #doseNote() {
        const dose = this.#valueOf('dose');
        if (dose === undefined) return '';
        const unit = this.limits?.dose?.unit ?? '';
        return `· ${scalarText(dose, unit ? { unit } : {})}`;
    }

    /** The rail's tracks, in order. ONE list in every state since Ben's 22 Aug
     *  ruling — see `railRows`. */
    get #rows() {
        return railRows({
            limits: this.limits ?? null,
            /* PASSED THROUGH, NOT DEFAULTED. These two used to read `?? STEAM_STOP.TIME` and
             * `?? WATER_STOP.VOLUME`, which meant a screen whose owner had nothing to say
             * still asserted a stop condition — and after 27 August 2026 the owner DOES
             * sometimes have nothing to say, because it derives both from the machine and a
             * machine that has not answered gives null. Coercing here would have put the
             * invented answer back one layer below the one it was removed from. `railRows`
             * takes null and keeps the same tracks; the caption draws its dash. */
            steamStop: this.steamStop ?? null,
            waterStop: this.waterStop ?? null,
            offers: this.offers ?? {},
            presets: this.presets ?? {},
            /* THE THREE TEMPERATURE TARGETS — brew, steam and hot water — were drawn in
             * Celsius whatever the Temperature bank said, because nothing in the skin read
             * the preference at all until 26 August 2026. `railRows` converts the whole
             * face: value, band, step and symbol together. */
            tempUnit: this.#tempUnit,
        });
    }

    /**
     * The shot this screen is about: the one the chart's feed is drawing while there is
     * one, otherwise the last stored shot. Same model for the plot, the phase table and
     * the summary sentence, so no two of them can disagree about a number (chart-C13).
     *
     * THE CHART READS IT TOO NOW (Ben's ruling, 22 Aug 2026: "THE LIVE CHART SHOWS THE
     * LAST SHOT"). It used to read `#chart.derivation` alone, so a machine with 321
     * stored shots drew an empty grid and said "No shot yet" — the foot band already
     * had the at-rest source and the plot six inches above it did not. Slate draws the
     * last shot's traces at live-ready and the two are one picture there:
     *   ORACLE live-ready #live-chart [i=116] carries a drawn shot, and the band under
     *          it reports that same shot (#history-date [i=121] "2026/08/15 07:10",
     *          #shot-data-total-time [i=142] "22").
     * `storedDerivation` is `LiveWiring`'s, off the shots store; nothing here fetches.
     */
    get #bandDerivation() {
        /* THE RULE IS `live-targets.js`'s, and the three inputs are this screen's. It is
         * a decision rather than a layout, so it is testable without a browser and it
         * cannot be stated differently by the plot and by the table. */
        return bandDerivationFor(this.derivation, this.storedDerivation, {
            browsing: this.browsingHistory,
            running: this.#running,
        });
    }

    /**
     * ONE GAUGE'S NUMBER, SPELLED — or the tile's own dash.
     *
     * THE TILE TAKES A STRING AND THAT IS THE POINT: "`null` / `undefined` / '' are
     * ABSENT and render the dash; 0 is a READING and renders as 0" (ui-stat-tile.js),
     * so the distinction between a channel at zero and a channel that is not there
     * survives the trip, and `scalarText` is the one function in the tree that makes
     * it. One decimal on every gauge, which is Slate's own spelling:
     *   ORACLE live-ready #slate-live-pressure [i=100] "0.0", #slate-live-flow [i=103]
     *          "0.0" and #slate-live-time [i=97] "0.0" — an idle machine reporting
     *          zero bar reads 0.0, not a dash, because zero IS the reading.
     *
     * TIME IS THE SHOT'S CLOCK, not a channel: it comes off the same derivation the
     * plot and the phase table read, so no two of the three can disagree about how
     * long this shot has been going.
     *
     * AND AT REST IT IS 0.0, NOT A DASH (Ben's ruling, 22 Aug 2026: "READOUTS AT IDLE
     * SHOW 0.0 … dashes only for a channel genuinely absent"). This read the other way
     * — "at rest there is no shot open and no clock to report, which is an absence" —
     * and that reasoning is right about a CHANNEL and wrong about a clock. A channel
     * with no reading is a question the machine has not answered; the elapsed time of a
     * shot that is not running is answered, and the answer is zero. Nothing is
     * invented: this is not a machine value at all.
     *   ORACLE live-ready #slate-live-time [i=97] "0.0" with its unit [i=98] "s" —
     *          the same 0.0 Slate shows for pressure and flow on an idle machine,
     *          which is the whole shape of the ruling.
     */
    /**
     * The cluster, with the one conditional tile resolved.
     *
     * ONE `filter`, AND IT IS ABOUT ABSENCE RATHER THAN ABOUT MILK. A row marked
     * `whenRead` is drawn only while its channel has a reading; nothing else on this
     * screen behaves that way, and the reason it is a row property rather than a branch
     * in the template is so the next such reading is a table edit.
     */
    get #gauges() {
        const readings = this.readings ?? null;
        const steaming = this.#steaming;
        return GAUGES.filter((gauge) => {
            /* A STEAM SESSION WITHDRAWS TWO TILES, and the reason is Slate's own, in its
             * stylesheet beside the same two: "Weight and Group are withdrawn — neither is
             * a steam quantity, and a stale espresso number beside live steam data would
             * read as current."
             *
             * Ben, 25 August 2026, on the function audit: "Weight and Group: Copy slate."
             *
             * WITHDRAWN, NOT DASHED. Every other absence on this screen renders present and
             * dashed — the rail's own rule, and the tank's. This is a different kind of
             * absence: the channel is not missing, it is not the subject. A dashed Weight
             * beside a live steam graph still claims Weight is one of the things this
             * screen is about. */
            if (steaming && gauge.notSteam) return false;
            return !gauge.whenRead
                || (readings && readings[gauge.key] !== null && readings[gauge.key] !== undefined);
        });
    }

    #reading(gauge) {
        if (gauge.key === 'time') {
            /* THE STEAM SESSION HAS ITS OWN CLOCK, and it is the one this tile shows while
             * the steam graph holds the canvas.
             *
             * Ben, 25 August 2026, on the function audit: "The Time tile: Copy Slate."
             * Slate reads `lastSteamSeconds` here and its own note says what it is: "x = 0
             * is the first pouring frame, not the button press, so the graph and the Time
             * field agree on what steaming means."
             *
             * THIS TILE WAS THE ONE THE OTHER TWO WERE HIDDEN FOR. Withdrawing Weight and
             * Group and then leaving the last espresso shot's duration on the tile beside
             * them is the same defect, one tile along — a stale espresso number beside live
             * steam data, reading as current. `steamDerivation.axis.t` is the session's own
             * seconds, from the same buffer the graph is drawn from, so the number and the
             * picture cannot disagree. */
            const derivation = this.#steaming ? this.steamDerivation : this.derivation;
            if (this.#steaming) {
                const ts = derivation && derivation.ok ? (derivation.axis?.t ?? []) : [];
                return scalarText(ts.length ? ts[ts.length - 1] : 0);
            }
            return derivation && derivation.ok
                ? scalarText(derivation.scalars.durationSeconds)
                : scalarText(0);
        }
        /* THE TANK IS THE ONE TILE WITH A UNIT THE PERSON CHOSE, and until 26 August 2026
         * the choice did nothing: `machine-water-tank-unit` offered mm | mL, the key had no
         * reader, and this tile drew millimetres whichever was picked. The note on the
         * GAUGES row said where the fix would go — "this is the one place the unit changes"
         * — and this is it.
         *
         * THE READING STAYS IN MILLIMETRES and only the drawn number moves.
         * `/ws/v1/machine/waterLevels` carries depth in mm, the low-water threshold is
         * compared in mm, and a conversion that survived past this line would eventually
         * round-trip through a write. */
        const held = this.readings ? this.readings[gauge.key] : null;
        /* THE THREE TEMPERATURE TILES — Group, Steam and Milk — follow the same preference
         * the rail and the settings pages do. Whole degrees in either unit: the machine
         * reports tenths on some channels, and the gauge cluster has always rounded
         * (`scalarText`'s own default is one decimal, and these tiles pass zero). */
        if (gauge.unit === '°C') {
            /* NO `decimals` HERE ON PURPOSE. `scalarText` defaults to one, which is what
             * these tiles have always drawn, so the Celsius face does not move a pixel —
             * and one decimal in Fahrenheit is the same decimal place the original had,
             * which is Ben's rule. */
            return scalarText(toDisplayTemp(held, this.#tempUnit), { dash: DEFAULT_DATA_GRID_DASH });
        }
        if (gauge.key === 'tank') {
            return scalarText(toDisplayLevel(held, this.#tankUnit), {
                dash: DEFAULT_DATA_GRID_DASH,
                decimals: tankDecimals(),
            });
        }
        return scalarText(held, { dash: DEFAULT_DATA_GRID_DASH });
    }

    /**
     * Which unit the Tank tile draws, from the preference, defaulting to the wire's own.
     *
     * NO OPINION MEANS MILLIMETRES. `normaliseTankUnit` returns null for anything that is
     * not one of the two rather than coercing, so the default is chosen HERE, visibly,
     * instead of being hidden inside a parser.
     */
    get #tankUnit() {
        return normaliseTankUnit(this.tankUnit) ?? DEFAULT_TANK_UNIT;
    }

    /**
     * Which unit a temperature is drawn in, from the preference, defaulting to the wire's.
     *
     * SAME SHAPE AS `#tankUnit` and for the same reason: `normaliseUnit` answers null for
     * anything that is not one of the two rather than coercing, so the fallback is chosen
     * here, where it can be read, instead of hidden inside a parser.
     */
    get #tempUnit() {
        return normaliseUnit(this.tempUnit) ?? DEFAULT_TEMP_UNIT;
    }

    /**
     * The symbol a tile prints, which is not always the one the table declares.
     *
     * TWO TILES HAVE A UNIT THE PERSON CHOSE — the tank's depth and any temperature — and
     * until 26 August 2026 neither preference had a reader, so both drew the machine's own
     * unit whatever was picked. Everything else prints what the table says.
     */
    #gaugeUnit(gauge) {
        if (gauge.key === 'tank') return this.#tankUnit;
        if (gauge.unit === '°C') return unitSymbol(this.#tempUnit);
        return gauge.unit;
    }

    /** The value a target currently holds, or undefined. Undefined is a real answer:
     *  the control is shown with the dash and cannot be stepped (A7). */
    #valueOf(key) {
        const held = this.targets ? this.targets[key] : undefined;
        if (typeof held !== 'number' || !Number.isFinite(held)) return undefined;
        /* THE DISPLAY EDGE FOR A RAIL TARGET. `railRows` converts the BAND — min, max,
         * step and symbol — and this converts the number that sits inside it; a value in
         * one unit against a band in another is the defect the hot-water cap had, one
         * screen along. Everything the rail sends back goes through `#commit`, which
         * converts it home again. */
        return toDisplayTemp(held, this.#unitOf(key));
    }

    /**
     * The unit ONE target is drawn in — the preference for a temperature, Celsius for
     * everything else, which is the identity conversion.
     *
     * READ OFF THE LIMITS TABLE, not a list of key names. A target is a temperature when
     * the range it clamps against says °C, which is one table and one spelling and nothing
     * here to fall out of date.
     */
    #unitOf(key) {
        const range = this.limits ? this.limits[key] : null;
        return range && range.unit === '°C' ? this.#tempUnit : DEFAULT_TEMP_UNIT;
    }



    /** One rail track. The kind decides the component; nothing here decides a look. */
    #renderRow(row) {
        const t = this.#i18n.t;
        if (row.kind === RAIL_ROW.PRESETS) {
            /* `data-dim-keeps-input` BELOW: THE BANK RECEDES WITH ITS GROUP AND STILL
             * TAKES A PRESS (audit F-038; Ben, 30 August 2026: "A defect — make them
             * pressable").
             *
             * Wave 3 measured all EIGHT preset cells resolving to `live-screen >>>
             * live-rail` during a live shot — the dim rule takes `pointer-events` away
             * with the opacity, so a press fell through the bank to the rail behind it,
             * which paints a background and therefore answers the hit test. Eight controls
             * were silently unreachable for the length of every pour, with nothing
             * disabled and nothing saying so.
             *
             * WHICH rows do this is `DIM_KEEPS_INPUT`'s to say, not this file's — the same
             * division of labour as `data-dim-group` on the line above, and for the same
             * reason: an id vocabulary is a contract another module owns. */
            return html`
                <ui-preset-bank
                    label=${t(row.label)}
                    data-section-start=${row.sectionStart ? '' : nothing}
                    .presets=${row.presets}
                    .value=${this.#valueOf(row.limitKey) ?? null}
                    .step=${this.limits?.[row.limitKey]?.step ?? null}
                    data-key=${row.limitKey}
                    data-dim-group=${railDimGroup(row.id) ?? nothing}
                    data-dim-keeps-input=${railKeepsInput(row.id) ? '' : nothing}
                    hold
                    @preset-select=${this.#onPreset}
                    @preset-hold=${this.#onPresetHold}
                ></ui-preset-bank>`;
        }

        /* THE NAME IS VISIBLE, AND IT IS THE SAME STRING THE CONTROL IS CALLED
         * (finding cmp-lo-3, Ben's ruling 21 Aug 2026).
         *
         * Until tonight `label` reached the stepper as an accessible name only, so the
         * espresso rail was three identical wells reading an em dash apiece and Dose
         * could not be told from Drink weight by sight - Slate draws a microcap per row
         * and the rewrite dropped it without declaring the drop. `label-position="start"`
         * is the component's answer: the SAME `row.label` becomes the visible microcap
         * to the left and the group's accessible name, taken from that element rather
         * than restated, so the two cannot drift apart.
         *
         * ONE TEMPLATE, EVERY ROW. This is the only place a rail target is rendered —
         * Grind, Dose, Drink, Brew, Flush, the two continuation rows, AND the two
         * stop-target rows (`STOP_TARGET`, live-targets.js), which all arrive here as
         * `RAIL_ROW.TARGET`. The preset banks are the rail's only other component.
         *
         * A ROW CARRYING A STOP CONDITION USED TO SLOT ONE EXTRA THING — a caption that
         * was really a toggle — and since 30 August 2026 it does not. `row.stopMode` is
         * still the descriptor and still decides which target row arrives here and in what
         * unit; what it no longer does is put a control in the stepper's `caption` slot.
         * The slot stays empty on every row: the mode's only control is on its settings
         * leaf. See the `stop-mode-change` paragraph in this file's header. */
        const range = row.range;
        const value = this.#valueOf(row.limitKey);
        /* THE ROW MAY RESTATE THE UNIT, AND EXACTLY ONE DOES (27 August 2026).
         *
         * `hotWaterVolume` is one machine field read two ways: under a volume stop the DE1
         * cuts the pour at millilitres, under a weight stop `hot_water_sequencer.dart` cuts
         * it at grams off the scale. Same field, same band, same track — different word.
         * `STOP_TARGET` carries the override (with the whole argument beside it) and the
         * settings page states the same thing for the same field in `variants`.
         *
         * THE RANGE IS STILL THE TABLE'S OBJECT. Rewriting `range.unit` would have meant
         * copying it, and the rail's suite asserts a row's range is the R2 table's own
         * object by identity — a guard against a layer inventing a BOUND. This invents no
         * bound; it prefers a symbol the row declared, and every other row declares none and
         * reads exactly as it did. */
        const unit = unitForRow(row);
        /* UNAVAILABLE IS A STATE, NOT A GAP. Two ways to reach it and one look: the
         * table declares no range for this key (the steam row is absent until the
         * machine class resolves - A7 forbids standing a ceiling in for it), or the
         * machine has not told us the value yet. Either way the control is here, in
         * its track, dimmed, showing the one dash spelling - never a zero, which
         * would be a temperature the machine is not holding. */
        /* AN AUTHORED ROW IS NOT UNAVAILABLE WHEN IT IS EMPTY. `row.authored` says the
         * value is the user's own (the grind number, and only that today), so an absence
         * means "not set yet" rather than "the machine did not say" — the dash is the
         * same, and the control has to work or the value can never be set at all. */
        const unavailable = row.unavailable !== null || (value === undefined && !row.authored);
        const stepper = html`
            <ui-stepper
                label=${t(row.label)}
                label-position="start"
                unit=${unit}
                .value=${value ?? null}
                .min=${range ? range.min : null}
                .max=${range ? range.max : null}
                .step=${range ? range.step : null}
                .next=${stepFor(this.limits, row.limitKey, this.#tempUnit)}
                .format=${this.#formatFor(row, unavailable)}
                ?disabled=${unavailable}
                ?editable=${!unavailable}
                data-key=${row.limitKey}
                data-row=${row.id}
                data-section-start=${row.sectionStart ? '' : nothing}
                data-continuation=${row.continuation ? '' : nothing}
                ?label-hidden=${Boolean(row.continuation)}
                data-stop=${row.stopMode ? '' : nothing}
                data-dim-group=${railDimGroup(row.id) ?? nothing}
                data-channel=${row.channel ?? nothing}
                decrease-label=${t('Less')}
                increase-label=${t('More')}
                @change=${this.#onTarget}
                @edit=${this.#onEdit}
            ></ui-stepper>`;

        /* THE ABORT TARGET'S TRACK IS THE FIRST ROW'S (Ben's standing-rail ruling).
         *
         * It used to have a track of its own, shared with the mode picker; the picker
         * is gone and an empty track would be either a hole above GRIND at rest or a
         * 76px slide the moment a shot starts — and "state changes weight, never
         * position" is why this screen is readable during a pull. Which row carries it
         * is the row model's (`abortSlot`); this is the one-cell grid both controls sit
         * in, and `<ui-stop-button>` "does not position itself and it is absent, not
         * hidden, when nothing is running", so at rest this is one control in one cell.
         *
         * NO data-dim-group HERE: the wrapper takes the row's own, and the row that
         * carries the abort target is GRIND, which the map marks exempt for exactly
         * this reason. */
        if (!row.abortSlot) return stepper;
        return html`
            <div class="stack"
                data-section-start=${row.sectionStart ? '' : nothing}
                data-dim-group=${railDimGroup(row.id) ?? nothing}>
                ${stepper}
                ${this.#running ? html`<ui-stop-button running></ui-stop-button>` : nothing}
            </div>`;
    }

    /**
     * The cell's own words: the dash when there is nothing to say, and otherwise the
     * number itself.
     *
     * THE RATIO IS NOT IN THE WELL, AND THAT IS WHAT THE ORACLE RENDERS (Ben's
     * "drink-weight ratio clip", detail polish, 22 Aug 2026). Slate's drink stepper
     * carries "40g (1:2.4)" in its subtree TEXT — .slate-stepper [i=31] — and draws
     * exactly two things inside the 110px value well: [i=34] <span> "40" at
     * [244,339,32,35] and [i=35] <small> "g" at [281,348,11,23]. There is no third
     * painted record anywhere in the rail's 430px, at either live state. Decal put
     * the parenthetical INTO the well, where 110px cannot hold it, and the row read
     * "40 (1:2..." with the unit pushed out of the box. The clip is not a width
     * problem to solve with a smaller type; the number Slate paints there is the
     * drink weight, full stop.
     */
    #formatFor(row, unavailable) {
        if (unavailable) return () => DEFAULT_DATA_GRID_DASH;
        if (!row.range) return undefined;
        /* AN UNCONVERTED RANGE IS THE TABLE'S OWN OBJECT and carries no `decimals` — that
         * identity is asserted by the rail's own suite — so the count is derived here
         * instead. Same answer either way; it is what the stepper would have done. */
        return railFormatter(row.range.decimals ?? decimalsForStep(row.range.step));
    }

    /**
     * THE NUMPAD (#53), IN THE DIALOG SHELL IT ALREADY BRINGS.
     *
     * One instance for the whole rail: the body is #18's to open, the ranges are the
     * table's to declare, and this screen's whole part is naming the limit key and
     * putting the confirmed number back.
     *
     * IT IS TOLD THE BAND THE STEPPER BESIDE IT IS DRAWING, AND `limits` STAYS BEHIND IT
     * (27 August 2026). `unitForRow`'s comment, thirty lines into this file, named the two
     * defects this closes and said they wanted one fix: the numpad "reads the RAW R2 row
     * and says '0–255 mL' under a weight stop while the well beside it says g", and "in
     * Fahrenheit the same hint reads '70–110 °C' beside a well reading °F, on every
     * temperature row". Both were the numpad DERIVING a band from the machine's own table
     * while every other control on the row drew the display's. `numpadBandFor` hands over
     * the row's OWN range — the same object the stepper takes — with the row's own word
     * for the unit and a clamp that converts in, runs the port's hole-aware arithmetic and
     * converts out. This file still owns no bound and does no comparison.
     *
     * `limits` IS STILL PASSED. It is #53's fallback for a caller holding no converted
     * band, and the rail's own suite asserts it is here — "the numpad is the ONE typed
     * path, and it is given the table rather than a range". It is given both now: the
     * table it can always fall back on, and the face the screen is actually drawing.
     *
     * A CLOSED PAD COSTS NOTHING, and that is worth stating because this screen renders
     * on every telemetry frame. With no row being typed `numpadBandFor` answers null,
     * lit compares the property by identity, and null is null — so the keypad is not
     * touched during a pour. While it IS open the band is rebuilt per frame, exactly as
     * every rail stepper's converted `range` already is (`#rows` calls `railRows` on
     * each access), so this adds one small object to an allocation the frame was making
     * anyway.
     */
    /**
     * WHICH BANK A PRESET CELL BELONGS TO, and what it currently prints there.
     *
     * `railRows` inserts the PRESETS track directly after the target row it belongs to and
     * gives both the same `limitKey`, so the bank is found by asking for the row of that
     * kind. Reading the cells from the ROW rather than from `this.presets` is what makes
     * this agree with what is drawn: the row already resolved stored-else-shipped.
     */
    #presetCell(cell) {
        if (!cell) return null;
        const rows = this.#rows;
        const bank = rows.find((candidate) => candidate.kind === RAIL_ROW.PRESETS
            && candidate.limitKey === cell.key);
        const target = rows.find((candidate) => candidate.kind !== RAIL_ROW.PRESETS
            && candidate.limitKey === cell.key);
        const cells = bank && Array.isArray(bank.presets) ? bank.presets : null;
        if (!cells || !Number.isInteger(cell.index) || cell.index < 0 || cell.index >= cells.length) {
            return null;
        }
        return { target, value: cells[cell.index], index: cell.index, key: cell.key };
    }

    /**
     * THE ONE KEYPAD, TWO THINGS IT CAN BE ABOUT (audit F-026).
     *
     * A SETTING (`_typing`): the row's own name and the row's own current value — what it
     * has always been, unchanged.
     *
     * A PRESET CELL (`_presetTyping`): the cell's name and the cell's own number. The
     * BAND is still the setting's, and deliberately: a preset is a shortcut TO that
     * setting, so a cell holding a number the machine would refuse is a cell that could
     * only ever fail on the day it was pressed. Same range, different subject.
     *
     * THE HEADING IS THE FINDING'S OWN EVIDENCE, INVERTED. F-026's strongest argument for
     * the other reading was that the pad was "byte-for-byte the keypad the stepper's own
     * readout opens", headed with the SETTING's name. It now says which cell it is about,
     * so the two controls read as the two different things they are.
     */
    #renderKeypad() {
        const t = this.#i18n.t;
        const cell = this.#presetCell(this._presetTyping);
        if (cell) {
            const label = cell.target ? t(cell.target.label) : '';
            return html`
                <ui-numeric-keypad
                    open
                    heading=${t('{label} preset {n}', { label, n: cell.index + 1 })}
                    .limits=${this.limits ?? null}
                    .limitKey=${cell.key}
                    .band=${numpadBandFor(cell.target, this.limits ?? null, this.#unitOf(cell.key))}
                    .value=${String(cell.value)}
                    unit=${unitForRow(cell.target)}
                    @confirm=${this.#onKeypadConfirm}
                    @open-change=${this.#onKeypadClose}
                ></ui-numeric-keypad>`;
        }
        const key = this._typing;
        const row = key ? this.#rows.find((candidate) => candidate.limitKey === key) : null;
        const value = key ? this.#valueOf(key) : undefined;
        return html`
            <ui-numeric-keypad
                ?open=${Boolean(key)}
                heading=${row ? t(row.label) : ''}
                .limits=${this.limits ?? null}
                .limitKey=${key ?? ''}
                .band=${numpadBandFor(row, this.limits ?? null, this.#unitOf(key))}
                .value=${value === undefined ? '' : String(value)}
                unit=${unitForRow(row)}
                @confirm=${this.#onKeypadConfirm}
                @open-change=${this.#onKeypadClose}
            ></ui-numeric-keypad>`;
    }

    /* ---- intent leaves as an event ---------------------------------------- */

    /**
     * A target the user set. Shown at once, reported as an event: the owner of the
     * machine's settings answers by handing `targets` back.
     *
     * `presetIndex` SAYS WHICH CELL ASKED, OR THAT NO CELL DID (audit F-022, 29 August
     * 2026). `storage-routes.js:504 steamFlowPresetIndex` — "Which steam-flow preset is
     * armed on this machine" — was a declared key with no writer anywhere in `src/`, so it
     * could never hold anything. The fact it records is knowable at exactly one moment:
     * the press that arms a preset. So the press carries it, on the event the press
     * already sends, and `LiveWiring` — the one thing on this screen that talks to a
     * store — decides what to do with it.
     *
     * A COMMIT FROM ANY OTHER CONTROL CARRIES `null`, AND THAT IS THE LOAD-BEARING HALF.
     * `null` is not "no opinion": it is "no preset is armed any more", which is exactly
     * what stepping the dial off 0.8 by hand means. A key that only ever gained a value
     * would go stale the first time somebody used the stepper, and then it would be a
     * stored claim that disagrees with the row on the glass.
     */
    #commit(key, value, presetIndex = null) {
        /* THE REVERSE CONVERSION, AT THE ONE PLACE A TARGET LEAVES THIS SCREEN. Every rail
         * control — the stepper, the presets and the numpad — arrives here, so a value read
         * in Fahrenheit becomes Celsius once and `target-change` carries the machine's own
         * number. Nothing downstream knows a unit exists. */
        const celsius = fromDisplayTemp(Number(value), this.#unitOf(key));
        this.targets = { ...(this.targets ?? {}), [key]: celsius };
        this.dispatchEvent(new CustomEvent('target-change', {
            detail: { key, value: celsius, presetIndex }, bubbles: true, composed: true,
        }));
    }

    #onTarget(event) {
        const key = event.target.dataset.key;
        if (key) this.#commit(key, event.detail.value);
    }

    #onPreset(event) {
        const key = event.target.dataset.key;
        /* THE CELL'S OWN POSITION, off `preset-select`'s detail — the component sends
         * `{value, label, index}` and nothing here counts cells for itself. */
        const index = event.detail?.index;
        if (key) this.#commit(key, event.detail.value, Number.isInteger(index) ? index : null);
    }

    #onEdit(event) {
        /* THE STEPPER'S OWN READOUT STILL EDITS THE SETTING, and clearing the cell target
         * here is what keeps the two apart: one keypad, two possible meanings, and the
         * gesture that opened it is the only thing that says which. */
        this._presetTyping = null;
        this._typing = event.target.dataset.key ?? null;
    }

    /**
     * THE KEYPAD WAS CONFIRMED — and where the number goes depends on what opened it.
     *
     * A CELL EDIT LEAVES AS `preset-edit`, WHICH ALREADY HAD A WRITER (audit F-026).
     * `LiveWiring #onPresetEdit` writes the whole bank to `drinkOutPresets` /
     * `steamFlowPresets` and re-renders — it is what "Save current (N) here" and "Revert
     * to N" already use, and it was proven live. The fix is not a new write path; it is
     * routing this gesture to the write path that matches what the menu item says.
     */
    #onKeypadConfirm(event) {
        const { limitKey, value } = event.detail;
        const cell = this._presetTyping;
        if (cell) {
            this.dispatchEvent(new CustomEvent('preset-edit', {
                detail: { key: cell.key, index: cell.index, value: Number(value) },
                bubbles: true,
                composed: true,
            }));
        } else if (limitKey) {
            this.#commit(limitKey, value);
        }
        this._typing = null;
        this._presetTyping = null;
    }

    #onKeypadClose(event) {
        if (!event.detail.open) { this._typing = null; this._presetTyping = null; }
    }

    /* ---- press and hold: Slate's second action on the two banks ------------- */

    /**
     * A PRESET WAS HELD — Slate's re-cut menu, item for item.
     *
     * `ui.js:1630-1666` offers four: Apply, Enter value, "Save current (N) here" and
     * "Revert to N". All four are here, and the two that need a number take it from the
     * places this screen already has one — the rail's live value for Save, and the
     * shipped bank for Revert — so nothing on this menu invents a target.
     */
    #onPresetHold(event) {
        const key = event.currentTarget.dataset.key;
        const index = event.detail?.index;
        if (!key || !Number.isInteger(index)) return;
        this._hold = { kind: 'preset', key, index, value: event.detail.value };
        this.#openHoldMenu(event.currentTarget);
    }

    /**
     * A FAVOURITE SLOT WAS HELD — Slate's slot menu (`profileManager.js:664-696`).
     *
     * FILLED: Edit, Replace with, Clear this favourite. EMPTY: Choose for this slot.
     * Decal's "Replace with" and "Choose for this slot" are the same trip — into the
     * library, where a profile is picked — so they are one action with two names, exactly
     * as Slate's are.
     *
     * THE TWO WORDINGS ARE BEN'S OWN, DECIDED 29 AUGUST 2026 (fix-campaign decisions D13
     * and D15), and both replace a label that described the WIDGET rather than the act:
     *
     *   "Clear button"     -> "Clear this favourite"    (D13)
     *   "Browse Profiles"  -> "Choose for this slot"    (D15)
     *
     * Slate called the first one "Clear button" because in Slate the thing being cleared
     * IS a button on a toolbar; here it is a favourite in a rail of five, and a menu row
     * that names the widget leaves "which button?" as the reader's problem. The second is
     * the F-025 carry saying out loud what it now does: the audit's own open question on
     * `L0444` was whether "Browse Profiles" meant plain browsing or filling the slot you
     * held, and D15 settles it as FILL — so the label stops implying the other reading.
     */
    #onFavouriteHold(event) {
        const slot = event.detail?.slot;
        if (!Number.isInteger(slot)) return;
        this._hold = { kind: 'favourite', slot, value: event.detail.value ?? null,
            filled: !!event.detail.filled };
        this.#openHoldMenu(event.currentTarget);
    }

    #openHoldMenu(anchorElement) {
        const menu = this.renderRoot?.getElementById?.('hold-menu');
        if (!menu) return;
        menu.anchorElement = anchorElement;
        /* The menu is opened WITHOUT taking focus: the finger is still on the control
         * that opened it, and moving the caret under a held finger is what makes a
         * touch menu feel like it jumped. Arrowing into it still works. */
        menu.open = true;
    }

    #holdItems() {
        const t = this.#i18n.t;
        const hold = this._hold;
        if (!hold) return [];
        if (hold.kind === 'favourite') {
            if (!hold.filled) return [{ id: 'browse', label: t('Choose for this slot') }];
            return [
                { id: 'edit', label: t('Edit profile') },
                { id: 'replace', label: t('Replace with') },
                { separator: true },
                { id: 'clear', label: t('Clear this favourite'), danger: true },
            ];
        }
        const current = this.#valueOf(hold.key);
        const shipped = DEFAULT_PRESETS[hold.key];
        const factory = Array.isArray(shipped) ? shipped[hold.index] : undefined;
        const number = (value) => (typeof value === 'number' && Number.isFinite(value)
            ? String(value) : null);
        const items = [
            { id: 'apply', label: t('Apply {value}').replace('{value}', String(hold.value)) },
            { id: 'enter', label: t('Enter value') },
        ];
        /* SAVE AND REVERT ARE OFFERED ONLY WHEN THEY HAVE A NUMBER, rather than shown
         * disabled: Slate disables Save when the rail reads NaN, and a Revert with no
         * factory value is a row that could only ever refuse. A7's rule for a value the
         * machine has not sent, applied to a menu row. */
        if (number(current) !== null) {
            items.push({ id: 'save',
                label: t('Save current ({value}) here').replace('{value}', number(current)) });
        }
        if (number(factory) !== null && factory !== hold.value) {
            items.push({ separator: true });
            items.push({ id: 'revert', danger: true,
                label: t('Revert to {value}').replace('{value}', number(factory)) });
        }
        return items;
    }

    #onHoldSelect(event) {
        const hold = this._hold;
        const id = event.detail?.id;
        if (!hold || !id) return;
        if (hold.kind === 'favourite') {
            this.dispatchEvent(new CustomEvent('favourite-action', {
                detail: { action: id, slot: hold.slot, value: hold.value },
                bubbles: true,
                composed: true,
            }));
            return;
        }
        /* "Apply {value}" IS THE SAME ARMING AS A TAP and carries the same cell (F-022):
         * the menu is anchored to the cell that was held and `hold.index` is that cell. */
        if (id === 'apply') { this.#commit(hold.key, hold.value, hold.index); return; }
        /* "Enter value" EDITS THE CELL YOU HELD, NOT THE SETTING (audit F-026).
         *
         * WHAT IT DID. It set `_typing` to the rail key, which is the same thing the
         * stepper's own value readout does — so the keypad opened headed "Drink", with the
         * SETTING's 1–1000 g range, and Confirm wrote `targetYield`. The bank was unchanged
         * before and after a reload. Two controls doing one job, and the hold-only one
         * doing the job the visible one already does.
         *
         * WHY THE CELL AND NOT THE SETTING. This is the entry's Reading A, and Ben's intent
         * review left it standing. It is also what makes the menu coherent: "Apply" moves
         * cell → setting, "Save current here" moves setting → cell, and "Enter value" is
         * the third edge — a number straight into the cell, so a value the bank does not
         * offer becomes one tap away in future. Under the other reading this item and the
         * stepper's readout are the same control twice.
         *
         * The worker's disagreement is recorded in F-026 and is Ben's to overturn. */
        if (id === 'enter') {
            this._typing = null;
            this._presetTyping = { key: hold.key, index: hold.index };
            return;
        }
        if (id === 'save' || id === 'revert') {
            const shipped = DEFAULT_PRESETS[hold.key];
            const next = id === 'save'
                ? this.#valueOf(hold.key)
                : (Array.isArray(shipped) ? shipped[hold.index] : undefined);
            if (typeof next !== 'number' || !Number.isFinite(next)) return;
            this.dispatchEvent(new CustomEvent('preset-edit', {
                detail: { key: hold.key, index: hold.index, value: next },
                bubbles: true,
                composed: true,
            }));
        }
    }

    /**
     * THE ONE MENU FOR BOTH GESTURES. Its rows are whichever hold opened it, its anchor
     * is whichever cell was held, and it has no trigger of its own — `anchorElement` is
     * the seam the component already declares for exactly this ("a list row that
     * long-pressed"). One instance, because two would be two focus traps.
     */
    #renderHoldMenu() {
        const t = this.#i18n.t;
        return html`
            <ui-menu
                id="hold-menu"
                label=${t('Actions')}
                .items=${this.#holdItems()}
                @select=${this.#onHoldSelect}
            ></ui-menu>`;
    }

    /**
     * OPEN THE SHOT HISTORY (wave 5.6, hist-route-conversion). The shell owns
     * navigation, so this ASKS rather than touching `location`: a composed, bubbling
     * `navigate` event that `<app-root>` catches with a template binding. A screen
     * mounted in a fixture or the gallery has no shell above it, so the event is simply
     * unheard and nothing navigates the harness page away - the same reason
     * `settings-screen.js` asks its boot object.
     *
     * `invoker` is this button's id in this root, and it is what the caret comes back
     * to when History is left (the phase-2 dialog contract, applied to a route:
     * app-root carries the pair across the swap and hands it back as `restoreFocusTo`,
     * and #restoreFocus above puts the caret here again). That is H9's surviving half,
     * with no trap, no inert and no aria-modal in it.
     *
     * ---------------------------------------------------------------------------
     * WHERE THE AFFORDANCE SITS, AND WHY - FOUR PLACEMENTS, ALL MEASURED
     * ---------------------------------------------------------------------------
     * 4.5 puts it "in the Live foot band" and that is where it is; what took measuring
     * is that it rides BESIDE the rating control rather than under it. At the 1000x600
     * design floor this screen has no spare room, so every arrangement was measured in
     * the busiest honest state - a finished shot, so the rating shows, and stored
     * shots, so the stepper does. Lengths below are CSS pixels, written without the
     * unit because a screen file may not spell one (see test/live-screen.test.mjs).
     *
     *   stacked as a THIRD ROW in .foot-controls
     *       the column goes 176 -> 248 against a band capped at
     *       fit-content(--ui-live-foot-max-share) = 40% of 600 = 240. live-foot's own
     *       .band then goes from not scrolling at all to scrollHeight - clientHeight =
     *       32, and its 15-wide scrollbar takes the phase table 385 -> 370, moving the
     *       recorded truncation pair from Volume 44/63, Weight 56/58 to 39/63 and
     *       51/58. C2's last-resort scroll is for BELOW the design floor; firing it AT
     *       the floor is what live-bands.render's "at this size the bands fit" asserts
     *       against, quoting slate-live.css:1126-1131.
     *
     *   beside the STEPPER instead
     *       the column widens 240 -> 312 and takes the phase table 385 -> 313, which
     *       moves the same truncation pair.
     *
     *   in the HEADER's destination cluster, as a text button OR an icon button
     *       breaks L22 either way. That header gives from the FAVOURITES BANK, which
     *       declares no hit-floor-aware minimum, and in the espresso state at the floor
     *       the bank is ALREADY at 54.7 per slot - 6.7 above --ui-hit-min. Any 64-wide
     *       control takes it to 39.5; a 146.7-wide text button to 38.9. That is an
     *       H3-shaped defect in THIS screen's header - the give coming from the wrong
     *       item - and it is wave 5.1's to fix, not 5.6's to trip over. Recorded as a
     *       deferred question rather than fixed here.
     *
     *   HERE, beside the rating control
     *       costs nothing. The rating control is 240 x 104 and this button is 64 x 64,
     *       so the row is 104 tall and the column stays 240 x 176 to the pixel: band
     *       200 and not scrolling, phase table 385, truncation pair unchanged, L22
     *       sweep clean, at both Gate A geometries. The slack was already in the
     *       column beside a control that does not fill it; this row uses it.
     */
    /**
     * ===========================================================================
     * THE BAND'S FIRST BLOCK — WHICH SHOT THIS IS (Ben's ruling, 22 Aug 2026)
     * ===========================================================================
     * "The foot = Slate's foot: last-shot summary — date/time + profile line left,
     * phase table (TIME/WEIGHT/VOLUME by phase), the ratio/first-drop/avg-peak
     * column, RATE THIS SHOT strip."
     *
     *   ORACLE live-ready #history-date [i=121] "2026/08/15 07:10" rect [529,980,274,30]
     *          font-size 20px / weight 500 / rgb(244,247,248)
     *   ORACLE live-ready #history-profile-name [i=122] "Lever Classic demo"
     *          rect [529,1016,274,25] font-size 20px / weight 500 / rgb(148,161,169)
     *   ORACLE live-ready #history-dose-in [i=123] "In 18g" [591,1044,48,27] 18px muted,
     *          the separator [i=124] "|" and #history-grind-size [i=125] "Grind N/A"
     *          [660,1044,81,27] — the same size and ink.
     *
     * WHAT IT IS ABOUT, AND WHY IT IS NOT THE LIVE SHOT'S. The three lines name a
     * STORED shot — the one the chart is drawing at rest — so they read the list row
     * `LiveWiring` holds, through `shot-summary.js`'s own two readers (`shotClock`,
     * `shotTitle`). Mid-shot there is no stored row to name and the block collapses:
     * a date and a title from the last shot, over a phase table counting the current
     * one, would be the band claiming two shots at once.
     *
     * THE GRIND IS ON THE RECORD, and this note used to say it was not. `ShotRecord`
     * has no grinder field, which is what was checked; the record also carries the
     * WORKFLOW as it stood, and the grind lives on that document's `context` — where
     * Slate reads it from (`history.js:191`) and where Decal's own rail now writes it.
     * `shotGrind` is the reader. A shot pulled before anybody set a grind still shows the
     * dash, which is the absence and not the words "N/A" (A7).
     */
    #renderShotIdentity() {
        const t = this.#i18n.t;
        const shot = this.storedShot;
        const clock = shotClock(shot ? shot.timestamp : null);
        const title = shot ? shotTitle(shot) : '';
        const dose = this.#bandDerivation && this.#bandDerivation.ok
            ? this.#bandDerivation.scalars.dose : null;
        /* ABSENT WHOLE WHEN THERE IS NO SHOT TO NAME, which is what the band's own grid
         * is built around: "the identity block is absent whole while a shot is running
         * … and an auto track that collapses to nothing is how a four-block band
         * becomes a three-block one" (.foot-grid, below). A dash here would be this
         * screen claiming a shot it does not have. */
        return html`
            <div class="foot-shot">
                ${shot && clock.ok
                    ? html`<div class="shot-head">
                            <p class="shot-when">${clock.dateSummary} ${clock.time}</p>
                            <p class="shot-charge">
                                <span>${t('In {dose} g', { dose: scalarText(dose) })}</span>
                                <span aria-hidden="true">|</span>
                                <span>${t('Grind {grind}', {
                                    grind: scalarText(shotGrind(shot), { dash: DEFAULT_DATA_GRID_DASH }),
                                })}</span>
                            </p>
                        </div>
                        ${title ? html`<p class="shot-profile">${title}</p>` : nothing}`
                    : nothing}
                <div class="shot-nav">
                    <ui-icon-button id="shot-older" size="md"
                        label=${t('Older shot')}
                        ?disabled=${!this.canStepOlder}
                        @click=${this.#onStepOlder}
                        >${OLDER_GLYPH}</ui-icon-button
                    >
                    <ui-button id="history-entry" @click=${this.#openHistory}
                        >${t('All shots')}</ui-button>
                    <ui-icon-button id="shot-newer" size="md"
                        label=${t('Newer shot')}
                        ?disabled=${!this.canStepNewer}
                        @click=${this.#onStepNewer}
                        >${NEWER_GLYPH}</ui-icon-button
                    >
                </div>
            </div>`;
    }

    /**
     * ===========================================================================
     * THE BAND'S THIRD BLOCK — THE FOUR DERIVED READINGS
     * ===========================================================================
     *   ORACLE live-ready .slate-derived-list [i=145] rect [1372,984,324,136] holding
     *          four dt/dd pairs: "Ratio" [i=146], "First drop" [i=148], "Flow avg/peak"
     *          [i=150] and "Pressure avg/peak" [i=152], each a 14px/600 muted term with
     *          a 20px/300 value right-aligned to x=1696 ([i=147], [i=149], [i=151],
     *          [i=153]).
     *
     * THIS IS NOT D1's DERIVED-CHANNEL LIST and the names collide unhelpfully. D1
     * removes the puck-estimator CHANNELS (resistance, impedance, hydraulic power)
     * from v1; these four are gate 6's per-shot SCALARS, which the derivation has
     * computed since wave 3 and which nothing on this screen has ever shown. Ben's
     * ruling names them one by one, and the brief says so in the same breath: "(the
     * derived-channel list stays DEAD — D1; it is not in the capture)".
     *
     * EVERY NUMBER COMES FROM THE SAME DERIVATION THE PHASE TABLE AND THE PLOT READ,
     * through `shot-summary.js`'s `scalarText` — one formatter, one dash spelling, and
     * a pair renders "— / —" when neither half is a reading, which is Slate's own
     * spelling for the two pairs ([i=151], [i=153]).
     */
    #renderDerived() {
        const t = this.#i18n.t;
        const derivation = this.#bandDerivation;
        const s = derivation && derivation.ok ? derivation.scalars : null;
        /* JOINED, NOT TEMPLATED, and the reason is Gate D: `collectConstructedPaths`
         * flags any interpolated template that is PATH-SHAPED, and "<a> / <b>" is
         * exactly that shape. Slate's own spelling for these two pairs is a slash
         * (ORACLE [i=151] "— / —", [i=153] "— / —"), so the separator stays and the
         * assembly changes — the same move `app-boot.js` makes for its KV base. */
        const pair = (a, b) => [a, b].map((value) => scalarText(value)).join(' / ');
        const rows = [
            [t('Ratio'), s && s.ratio !== null ? `1:${scalarText(s.ratio)}` : DEFAULT_DATA_GRID_DASH],
            [t('First drop'), scalarText(s ? s.timeToFirstDrop : null)],
            [t('Flow avg/peak'), pair(s ? s.averageFlow : null, s ? s.peakFlowAfterFirstDrop : null)],
            /* "PRESS", NOT "PRESSURE" — Ben, 30 August 2026: "I thought we were going to
             * make it PRESS AVG/PEAK so we can reduce that column as well?" Measured at the
             * tablet's own type scale, the four pairs need 294 px with the word spelled out
             * and 257 with it clipped to Press, and the 37 px goes to the phase table, which
             * was ellipsising every one of its headers. AVG/PEAK is kept whole: it is the
             * half that says what the two numbers ARE, and it is the same on both rows. */
            [t('Press avg/peak'), pair(s ? s.averagePressure : null, s ? s.peakPressure : null)],
        ];
        return html`
            <dl class="foot-derived">
                ${rows.map(([term, value]) => html`
                    <dt class="ui-microcap">${term}</dt>
                    <dd class="ui-numeric">${value}</dd>`)}
            </dl>`;
    }

    /**
     * THE WAY TO THE BIG CHARTS — from the button, and from the plot itself.
     *
     * Slate opens a full-screen overlay of two stacked plots when the live chart is
     * tapped (`chart.js:181-183`). Decal has no overlay and does not need one: the
     * History screen IS those two plots, at full size, with the shot picker and the
     * comparison the overlay never had. So the plot's activation goes to the same place
     * the "All shots" button goes, and `invoker` says which one asked so the caret comes
     * back to it.
     */
    #openHistory = (event) => {
        const invoker = event?.currentTarget?.id ?? 'history-entry';
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'history', invoker },
            bubbles: true,
            composed: true,
        }));
    };

    /**
     * THE PLOT WAS TAPPED. Open the expanded chart — NOT the History screen.
     *
     * Ben, 24 Aug 2026: "it should NOT load the history viewer, it should load the
     * expanded chart that does show live tracking etc. The History view is only
     * accessible through the 'all shots' button in the history tab." So `#openHistory`
     * above keeps exactly one caller, the button that says so.
     *
     * NOTHING ASYNCHRONOUS HAPPENS HERE, which is the other half of the same note: "it
     * shouldn't have any vertical line or delay just launch the full screen chart". The
     * delay was a route change mounting a screen module; the vertical line was the card's
     * own cursor, which an activatable card no longer paints (`ui-chart-card.js`).
     */
    #openNotes = () => { this._notes = true; };

    /**
     * THE CORNER SAID IT WAS PRESSED; THE SCREEN OPENS THE DIALOG. The component reaches
     * for nothing itself — the rule this skin wrote after the old DYE2 button called a
     * `window` global that was sometimes not there, and every tap did nothing at all.
     */
    #openWeather = () => { this._weatherOpen = true; };

    /**
     * A TYPED LOCATION, WRITTEN THROUGH THE PLUGIN'S OWN SETTING.
     *
     * The generated settings form writes the same key by the same route, so there is one
     * owner of the value and the plugin resolves it on its next frame. The screen holds
     * the transport because a component here may not.
     */
    #saveWeatherLocation = async (event) => {
        const location = event?.detail?.location;
        const plugins = this.boot ? this.boot.plugins : null;
        if (!location || !plugins || typeof plugins.writeSettings !== 'function') return;
        try {
            await plugins.writeSettings(WEATHER_PLUGIN_ID, { Location: location });
        } catch {
            /* The plugin keeps publishing its last reading either way, and the modal
             * shows the place it actually resolved — so a failed write is visible as
             * the name simply not changing, rather than as a banner over a live screen. */
        }
    };

    #renderWeatherModal() {
        if (!this._weatherOpen) return nothing;
        return html`<weather-modal
            open
            .reading=${this.weather}
            @weather-location=${this.#saveWeatherLocation}
            @open-change=${this.#onWeatherOpenChange}
        ></weather-modal>`;
    }

    #onWeatherOpenChange = (event) => {
        if (event && event.detail && event.detail.open === false) this._weatherOpen = false;
    };

    /**
     * THE DYE2 HANDOFF WAS PRESSED. Open DYE2's bean picker in a new context.
     *
     * Ben, 27 August 2026: "Have the button open the bean picker page for now, I need to
     * do more work on this though." That sentence is the whole scope of this method and it
     * is deliberately small: it opens ONE page and hands it nothing.
     *
     * THE SAME MECHANISM THE PLUGINS PAGE'S OPEN BUTTON USES, and not a second one. The URL
     * comes from `plugins-store.pageUrl(...)` — the one place a plugin and one of its
     * endpoints becomes an address — and the navigation is `open(url, '_blank', 'noopener')`,
     * which is the shape `settings-bespoke-leaf.js#openPluginPage` already establishes.
     *
     * SLATE DOES SOMETHING ELSE AND IT IS LIVE CODE, WHICH IS WORTH STATING PRECISELY
     * BECAUSE THE OPPOSITE WAS BELIEVED. `dyeStrip.js` `openPluginOverlay(page)` builds a
     * fixed-position overlay with a Close bar and an `<iframe>`, sets `frame.src` to
     * `<pluginBase>/<page>?return=<sentinel>`, and watches the frame's `load` for the
     * plugin navigating back to that sentinel so it can close and refresh. It has three
     * callers (`dyeStrip.js:115`, `:396`). It is not dead.
     *
     * IT IS STILL NOT COPIED, AND EACH REASON IS ITS OWN.
     *   THE RETURN SENTINEL IS A CONTRACT WITH THE DYE2 PAGES — they have to honour
     *       `?return=` — and Ben has not asked for one. His instruction was to open the
     *       bean picker "for now"; inventing a round trip on top of that is the large
     *       surface this method is explicitly not building.
     *   IT ONLY WORKS SAME-ORIGIN, and Slate's own comment says so: cross-origin the
     *       X-Frame-Options SAMEORIGIN header blocks the frame and reading
     *       `contentWindow.location` throws, so Slate falls back to a full-page navigation.
     *       That fallback is what this does unconditionally, which is the honest half.
     *   AND AN OVERLAY HERE WOULD BE A COMPONENT, not a `document.body.appendChild`. This
     *       screen paints inside its own shadow root; a surface bolted onto the document
     *       is exactly the wall this rewrite exists to keep.
     *
     * A NEW CONTEXT, WITH `noopener`, for the reason the Plugins page gives: "a same-window
     * navigation strands the user on a kiosk with no back control". The page belongs to
     * DYE2 and is served by the machine, so this skin navigates to it rather than rendering
     * it.
     *
     * `ownerDocument.defaultView`, NOT `window`. The screen reaches its own view rather
     * than a global — the same read the Plugins page makes, and it is what lets the render
     * suite drive this without a global stub.
     *
     * NOTHING IS PASSED, AND THAT IS THE "FOR NOW". The event carries `shotId` — the
     * component publishes it and `ui-rating-control`'s header explains why it is an intent
     * rather than a call — and this method ignores it, because no DYE2 endpoint at the pin
     * documents a way to receive it. The old skin's answer was a global,
     * `window.openDye2ForShot(shotId)`, which the audit measured on the bench as undefined,
     * so every tap did nothing. An honest button that opens the right page with no context
     * beats a button that pretends to carry one. When Ben settles the shape of the handoff,
     * the argument lands here and the destination pair in `plugins-store.js` is where it
     * joins.
     *
     * A REFUSED OPEN IS NOT REPORTED HERE, and that is a difference from the Plugins page
     * worth stating rather than hiding. That page surfaces a null `open()` because it draws
     * a status line under its list and has somewhere to put the sentence; this corner is
     * three stacked buttons in 165px with no room for one, and Ben's own foot-band ruling
     * is that the corner holds the rating control and nothing else. The press is either a
     * new context or nothing, exactly as `#openHistory` is either a route change or nothing.
     */
    #openDye2 = () => {
        const url = this.boot?.plugins?.pageUrl?.(DYE2_PLUGIN_ID, DYE2_PAGE_ENDPOINT);
        if (!url) return;
        try {
            this.ownerDocument?.defaultView?.open?.(url, '_blank', 'noopener');
        } catch {
            /* A WebView that refuses to open a context throws rather than returning null.
             * There is nowhere on this corner to say so — see the paragraph above. */
        }
    };

    #openExpanded = () => {
        /* NOT DURING A STEAM SESSION. Ben, 25 August 2026, on the function audit: "The
         * expanded chart: Copy Slate, no expanded chart for Steam."
         *
         * Slate's own reason, at its single choke point: "The expanded overlay is built
         * entirely from espresso-shot channels; there is no steam equivalent, so while the
         * steam chart holds the canvas the expand affordance does nothing. This is the
         * single choke point — the tap target, the button and any future caller are all
         * covered here."
         *
         * THE SAME CHOKE POINT HERE, and it is the reason the refusal is in the opener
         * rather than on the card: `activate` still marks the plot a button, so the gesture
         * is still announced and still lands here, and one line refuses every caller. What
         * Decal drew until now was ONE enlarged steam plot with no tabs, no strip and no
         * second page — an expansion of a chart, on a surface built to be an expansion of a
         * shot. */
        if (this.#steaming) return;
        this._expanded = true;
    };

    /**
     * PUT THE CARET BACK, ONCE, when the shell says this mounting is a return.
     *
     * The two lines H9 leaves behind. `ui-dialog`'s own restore is private
     * (`#returnFocusTo` / `#restoreFocus`) and `src/lib/focus-trap.js` exports no
     * restore function, so what is inherited is the CONTRACT and not the code - and a
     * second trap/restore machinery here would be the block, not the fix. It no-ops on
     * a target that is not there, exactly as the dialog's does: a screen that came back
     * without the control it left from (a shot that ended, a gate that closed) leaves
     * the caret where the browser put it rather than throwing.
     */
    async #restoreFocus() {
        const wanted = this.restoreFocusTo;
        if (typeof wanted !== 'string' || wanted === '') return;
        this.restoreFocusTo = null;
        const target = this.renderRoot?.getElementById?.(wanted);
        if (!target) return;
        /* Await the control before focusing it: focus goes INWARD and a host whose
         * inner button has not rendered yet is not focusable at all, so an unwaited
         * focus() here is a silent no-op (ui-button.js:248). */
        await target.updateComplete;
        target.focus?.({ preventScroll: true });
    }

    updated(changed) {
        super.updated?.(changed);
        this.#restoreFocus();
        this.#applySteamLabels();
    }

    /**
     * THE STEAM CHART'S END LABELS, drawn once the session settles.
     *
     * Ben, 25 August 2026: the steam chart "works well in slate, but is poorly done in
     * Decal. I need it to look & behave the same." This is the second of the two
     * differences (the first is the milk trace, in `#steamSpecs`).
     *
     * WHY THE STEAM CHART AND NOTHING ELSE. Slate's own note: "Steam's only key: it has no
     * legend and no KPI strip naming its two axes, so two lines against different scales
     * would otherwise be unlabelled." Every other chart in this skin has a legend beside
     * it; the steam card has none, so a pressure line and a temperature line share a plot
     * with nothing to say which is which.
     *
     * NOT WHILE IT RUNS. A label pinned to a moving endpoint slides across the plot at
     * 15 Hz and is harder to read than no label. `steamSettled` is the fold's own hold
     * window and not a second timer.
     *
     * CLEARED ON THE WAY OUT, in the same call. The card outlives the session — it is the
     * espresso chart the rest of the time — so a label set left behind would be three
     * steam readings floating over the next shot.
     */
    #applySteamLabels() {
        const card = this.renderRoot?.getElementById?.('live-chart');
        if (!card || typeof card.setEndLabels !== 'function') return;
        const t = this.#i18n.t;
        const show = this.#steaming && this.steamSettled;
        const labels = show
            ? steamEndLabels(this.steamDerivation, this.#steamSpecs)
                .map((label) => ({ ...label, text: t(CHANNEL_END_LABELS[label.key] ?? label.key) }))
            : [];
        card.setEndLabels(labels);
    }

    /**
     * ===========================================================================
     * THE PLOT'S STEP BOUNDARIES CARRY THEIR NAMES AGAIN (Ben, 25 August 2026)
     * ===========================================================================
     * "Step name, Live chart - we have these on the Expanded chart, can we put them into
     * the live chart as well please, likely around the 14px would work I think."
     *
     * WHAT WAS HERE, AND WHY IT IS GOING. it16 stripped the names from this one screen and
     * kept the rules, with a measurement behind it: on the mock's own recorded shot every
     * step falls in the last second, so three rotated names stacked into an unreadable
     * column inside about forty pixels. That measurement was real and it was taken on one
     * fixture. It is not a reason to have no names on a bench machine's ordinary shot,
     * where the steps are seconds apart — and Ben reads the expanded chart's names every
     * day without the problem the fixture showed.
     *
     * THE SIZE IS THE FIX THE FIRST ATTEMPT NEEDED. The names were set at
     * --ui-chart-tick, 17px, because nothing declared a size of their own; Slate draws the
     * same label at 14px here. --ui-chart-step-label is that number and it applies to all
     * three surfaces that draw the label.
     *
     * SO THIS METHOD IS GONE ENTIRELY, and its absence is the change: `<ui-chart-card>`'s
     * OWN default composition already emits a vertical rule and a rotated name per step
     * mark, from the card's own tokens. Overriding it here to delete half of it was the
     * only thing this screen was doing.
     */

    /**
     * A FAVOURITE WAS PRESSED. REPORT IT, AND DO NOT MOVE THE HIGHLIGHT.
     *
     * This used to open with `this.favourite = event.detail.value` — the highlight moved
     * the instant the slot was pressed, before anything had been asked of anybody. That
     * made this screen the SECOND writer of `favourite`: `live-wiring.js` sets it from the
     * library store on every update, so the two took turns and the last one to run won.
     * Ben, 27 August 2026, machine disconnected: "it highlights but if you then click edit
     * profile it will show the previous one". The highlight and the loaded profile were
     * two different facts wearing one property, and only one of them was true.
     *
     * IT IS NOT A LOSS OF RESPONSIVENESS. The library store publishes `armingId`
     * synchronously, before its first request goes out, and this controller reads it —
     * so the mark still moves within the same microtask as the press. What changed is
     * that it moves because the app is loading that profile, not because a finger landed
     * on it, and it therefore goes back if the machine refuses the profile instead of
     * quietly disagreeing with the header beside it.
     *
     * THE PROPERTY REMAINS, and it is still this screen's to render: a fixture, the
     * gallery and the render suites all set `favourite` directly. What is gone is this
     * file WRITING it.
     */
    #onFavourite(event) {
        this.dispatchEvent(new CustomEvent('favourite-select', {
            detail: { value: event.detail.value }, bubbles: true, composed: true,
        }));
    }

    /**
     * ASK THE SHELL'S WIRING TO STEP — it owns the index, the page and the record fetch.
     * Composed and bubbling like every other intent this screen dispatches, and the
     * DIRECTION is decided here so the handler never has to know which way the list
     * runs: +1 is older, because the page is newest-first.
     */
    #onStepOlder() { this.#stepShot(1); }

    #onStepNewer() { this.#stepShot(-1); }

    #stepShot(delta) {
        this.dispatchEvent(new CustomEvent('shot-step', {
            detail: { delta }, bubbles: true, composed: true,
        }));
    }

    /**
     * THE WEIGHT TILE IS THE TARE.
     *
     * IT ASKS RATHER THAN ACTS, like every other intent this screen sends: the press
     * leaves as `scale-tare` and the wiring row calls the store, because this screen
     * reads no store and calls no endpoint. What comes back is state, and the store is
     * the one place that decides whether a tare actually happened — a 200 does not say
     * (see scale-tare-store.js, and Slate's f813dea, which toasted success over a
     * firmware refusal).
     *
     * ROLE, TABINDEX AND A KEY HANDLER, because a div that only answers a click is a
     * control no keyboard can reach. Space and Enter are the two keys a `button` role
     * promises, and preventDefault on Space stops the page scrolling under it.
     */
    #onGaugePress = () => {
        this.dispatchEvent(new CustomEvent('scale-tare', { bubbles: true, composed: true }));
    };

    #onGaugeKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.#onGaugePress();
    };

    #onLibrary() {
        this.dispatchEvent(new CustomEvent('library-open', { bubbles: true, composed: true }));
    }

    /**
     * WHAT AN ACTION BUTTON SAYS, which is not always what it is called.
     *
     * The NAME is what the header announces and what `app-intents.js` switches on; the
     * LABEL is what a person reads. For two of the three they are the same word. Sleep is
     * the exception because it is a toggle: `deriveSleepButtonAction` sends a wake when the
     * machine is already asleep, and a button that sends a wake while reading "Sleep" is
     * the control-that-lies defect this tree is written against.
     *
     * IT IS BELT AND BRACES AND SAYS SO. A sleeping machine has the screensaver over the
     * whole screen, so this button is not reachable in that state today. The label still
     * follows the command, because "unreachable" is a fact about another component and not
     * a licence for this one to be wrong.
     */
    #actionLabel(action) {
        if (action !== SLEEP_ACTION) return action;
        return isMachineAsleep(this.machineState) ? 'Wake' : SLEEP_ACTION;
    }

    #onAction(event) {
        this.dispatchEvent(new CustomEvent('header-action', {
            detail: { action: event.currentTarget.dataset.action },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * ===========================================================================
     * THE WARMER CONTROL — SLATE'S OWN, AND ITS THREE STATES
     * ===========================================================================
     *   ORACLE live-ready #cupwarmer-toggle-btn [i=9] `.slate-btn slate-btn-tall`
     *          rect [1293,18,104,82], `gap: 2px`, text "Warmer ON" — two records:
     *          [i=10] .slate-warmer-label "Warmer" 17px / 500, and
     *          [i=11] .slate-warmer-state "ON" 12px / 600, letter-spacing 1.44px
     *          (= .12em at 12px, which is --ui-tracking-cap exactly).
     * So it is a tall button carrying a stacked name over a state word, and it is the
     * FIRST control of the action cluster.
     *
     * THREE STATES, NOT TWO, AND THE THIRD IS THE ONE THAT MATTERS.
     *   present: false  the machine does not have a mat -> NO BUTTON. The contract row
     *                   the store quotes is explicit: "404 here means the feature is
     *                   absent — hide the control." A dead control for hardware that is
     *                   not fitted is worse than no control.
     *   on: true/false  the machine SAID so, through `enabled` (never through a
     *                   setpoint — the store's dead premise 1).
     *   on: null        nothing has been read yet, or the read failed. The button is
     *                   there and its state line is the DASH. This is A7 at the paint:
     *                   an unread warmer drawn as OFF is a hardware verdict manufactured
     *                   out of data never received, which is the exact failure the
     *                   store's header calls "the expensive one".
     * At this pin the mock answers the route 410 (a refuted recording it refuses to
     * serve), so the capture shows the dash — the instrument being honest, not a bug.
     *
     * NO PRESSED-STATE ATTRIBUTE, AND THAT IS A LAW RATHER THAN AN OMISSION. This
     * screen may not write the aria state of a selection — "the aria state of a
     * selection is the bank's (Appendix 15), never a screen's", asserted over this
     * file's source by `test/live-targets.test.mjs` §6 — and a toggle button's pressed
     * state is exactly that state under another name. The state IS announced: it is
     * the second line of
     * the button's own label, which is a <span> inside the control and part of its
     * accessible name, so a screen reader hears "Warmer, On" from the text Slate itself
     * paints there. That is Slate's own composition doing the work an aria attribute
     * would otherwise duplicate.
     *
     * THE PRESS IS A WRITE AND IT IS THE SHELL'S TO MAKE. `warmer-toggle` leaves the
     * same way `favourite-select` and `header-action` do: composed, bubbling, carrying
     * the state it is asking FOR, so nothing here predicts what the machine will do
     * with it (B10 — the refresh that follows shows the caller what actually happened).
     * With `on` null there is nothing to toggle TO that would not be a guess, so the
     * control refuses rather than asking for an invented state.
     */
    #renderWarmer() {
        const t = this.#i18n.t;
        const warmer = this.warmer;
        if (warmer && warmer.present === false) return nothing;
        const on = warmer ? warmer.on : null;
        const state = on === null || on === undefined
            ? DEFAULT_DATA_GRID_DASH
            : (on ? t('On') : t('Off'));
        return html`
            <ui-button tall id="warmer"
                ?disabled=${on === null || on === undefined}
                label=${t('Cup warmer')}
                @click=${this.#onWarmer}
            ><span class="warmer"
                ><span class="warmer-name">${t('Warmer')}</span
                ><span class="warmer-state ui-microcap">${state}</span
            ></span></ui-button>`;
    }

    #onWarmer() {
        const on = this.warmer ? this.warmer.on : null;
        if (on === null || on === undefined) return;
        this.dispatchEvent(new CustomEvent('warmer-toggle', {
            detail: { enabled: !on }, bubbles: true, composed: true,
        }));
    }

    /**
     * THE MACHINE KEYS — the strip that starts and stops the machine.
     *
     * WHAT WAS HERE BEFORE was a `<div data-placeholder>` reading "Group head". The gate
     * that decides WHETHER the strip exists was built, tested and correct; what it
     * revealed was a label. So a machine with no group-head controller — which is the
     * only machine that gets this strip, `GHC_STRIP_SHOWS_WHEN = ABSENT` — had no way to
     * pull a shot, run water, steam, flush or stop from this app at all.
     *
     * ONE CONTROL AT A TIME, AND IT IS SLATE'S RULE. While the machine runs, the four
     * action keys are `disabled` (not dimmed — see `machineKeyGate`) and the strip holds
     * `<ui-stop-button>` alone. At rest the four are live and the stop button renders
     * nothing, so there is no disabled abort to press by mistake.
     *
     * `variant="danger"` IS NOT USED FOR STOP: `<ui-stop-button>` owns the abort's paint
     * and its own accessible name, and giving the same meaning two treatments is what
     * put a second Edit-profile look on this band a wave ago.
     */
    #renderMachineKeys() {
        const t = this.#i18n.t;
        const gate = machineKeyGate(this.machineState);
        return html`
            <div slot="ghc" class="ghc-strip"
                role="group"
                aria-label=${t('Machine controls')}
                data-r-tag=${this.#wiring.ghcGate().tag ?? nothing}
                data-r-adapter=${this.#wiring.ghcGate().adapter ?? nothing}
            >${gate.stop
                ? html`<ui-stop-button running></ui-stop-button>`
                : MACHINE_KEYS.map((key) => html`
                    <ui-button tall
                        data-state=${key.state}
                        data-key=${key.id}
                        ?disabled=${!gate.actions}
                        @click=${this.#onMachineKey}
                    >${t(key.label)}</ui-button>`)}
            </div>`;
    }

    /**
     * Ask for a state. The screen reads no store and calls no endpoint, so this leaves as
     * an intent exactly like `scale-tare` and `warmer-toggle` do; the wiring row calls
     * `machineState.request`, and what comes back is state — including ReaPrime's typed
     * `block_no_scale` 400, which reaches the same `<live-refusal>` an arm refusal does.
     */
    #onMachineKey(event) {
        const state = event.currentTarget.dataset.state;
        if (!state) return;
        this.dispatchEvent(new CustomEvent('machine-request', {
            detail: { state }, bubbles: true, composed: true,
        }));
    }

    /**
     * The abort, from either of the two places it can be pressed — the rail's stack and
     * the machine strip. `<ui-stop-button>` says the press happened
     * (`stop-request`); turning that into a state is this screen's, and the state is
     * `STOP_STATE` so the abort and the keyboard's space bar cannot name different ones.
     */
    #onStopRequest = (event) => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('machine-request', {
            detail: { state: STOP_STATE, reason: 'stop' }, bubbles: true, composed: true,
        }));
    };

    render() {
        const t = this.#i18n.t;
        return html`
            <live-header part="header">
                <ui-icon-button size="lg" slot="lead" label=${t('Choose a profile')}
                    @click=${this.#onLibrary}>${LIBRARY_GLYPH}</ui-icon-button
                >

                <ui-favourites-bank
                    tall
                    plain
                    slot="favourites"
                    label=${t('Favourite profiles')}
                    .favourites=${this.favourites ?? []}
                    value=${this.favourite ?? ''}
                    hold
                    @change=${this.#onFavourite}
                    @favourite-hold=${this.#onFavouriteHold}
                ></ui-favourites-bank>

                <div slot="actions" class="actions">
                    ${this.#renderWarmer()}

                    ${ACTIONS.map((action) => html`
                        <ui-button tall
                            variant=${action === PRIMARY_ACTION ? 'primary' : 'default'}
                            @click=${this.#onAction} data-action=${action}
                            >${t(this.#actionLabel(action))}</ui-button
                        >`)}

                </div>
            </live-header>

            <live-rail part="rail" role="region" aria-label=${t('Shot settings')}>
                ${this.#rows.map((row) => this.#renderRow(row))}
            </live-rail>

            <live-main part="main">
                <!-- THE CHART IS THE SHOT'S, OR THE STEAM SESSION'S (Ben, 24 Aug 2026).
                     ONE CARD, NOT TWO: a second card would be a second cursor, a second
                     legend and a second set of tokens to keep in step, and the card
                     already takes its channels and both its scales as properties. What
                     changes on a steam is the derivation, the channel list and the two
                     axes — every one of them a value this screen hands over. -->
                <ui-chart-card
                    id="live-chart"
                    slot="chart"
                    legend-gutter
                    activate
                    label=${this.#steaming ? t('Steam chart') : t('Shot chart')}
                    activate-label=${t('Open the shot charts')}
                    .channelKeys=${this.#steaming ? this.#steamSpecs : null}
                    .yRange=${this.#steaming ? STEAM_Y_RANGE : SHOT_Y_RANGE}
                    .y2=${this.#steaming ? { range: STEAM_Y2_RANGE } : null}
                    .derivation=${this.#steaming ? this.steamDerivation : this.#bandDerivation}
                    @plot-activate=${this.#openExpanded}
                >
                <div slot="legend" class="stats-block">
                <div class="identity">
                    ${this.profileName
                        ? html`<h1 id="profile-name" class="profile-name">${this.profileName}</h1
                            >${this.#doseNote
                                ? html`<span id="profile-dose" class="profile-dose"
                                    >${this.#doseNote}</span>`
                                : nothing}`
                        : nothing}
                    <ui-status-chip ?live=${this.#running && !this.#machineStale}
                        data-feed=${this.#wiring.machineFeedStatus ?? nothing}
                        >${this.#machineStale ? t('No reading') : t(this.machineState || 'idle')}</ui-status-chip
                    >
                </div>
                ${this.boot ? html`<div class="notices">
                    <live-connection
                        id="connection"
                        .frame=${this.#wiring.connectionFrame}
                        feed-status=${this.#wiring.connectionFeedStatus ?? nothing}
                    ></live-connection>
                    <live-refusal id="refusal" .refusal=${this.#wiring.refusal}></live-refusal>
                </div>` : nothing}
                <div class="gauges">
                    ${this.#gauges.map((gauge) => html`
                        <ui-stat-tile
                            label=${t(gauge.label)}
                            unit=${this.#gaugeUnit(gauge)}
                            value=${this.#reading(gauge)}
                            size=${gaugeSize(gauge)}
                            reserve="xl"
                            style=${statTileStyle(gauge)}
                            data-press=${gauge.press ?? nothing}
                            role=${gauge.press ? 'button' : nothing}
                            tabindex=${gauge.press ? '0' : nothing}
                            aria-label=${gauge.press === 'tare' ? t('Tare the scale') : nothing}
                            @click=${gauge.press ? this.#onGaugePress : nothing}
                            @keydown=${gauge.press ? this.#onGaugeKey : nothing}
                        ></ui-stat-tile>`)}
                </div>
                <span id="clock" class="clock ui-numeric">${this._clock}</span>
                </div>
                    <span slot="empty">${this.#emptyMessage()}</span>
                    <span slot="foot" class="chart-summary" role="status" aria-live="polite"
                        >${this.#summary}</span
                    >
                </ui-chart-card>

                ${this.ghc ? this.#renderMachineKeys() : null}
            </live-main>

            <live-foot part="foot" role="region" aria-label=${t('Shot data')}>
                <div class="foot-grid">
                    ${this.#renderShotIdentity()}

                    <ui-data-grid
                        stacked-units
                        label=${t('Shot data by phase')}
                        row-header-label=${t('Phase')}
                        .columns=${PHASE_COLUMNS.map((column) => ({
                            ...column,
                            label: t(column.label),
                            /* SPREAD ACROSS THE TRACK THIS BAND GIVES THEM. Ben, 23 Aug
                             * 2026: "try to structure it in a better way, better spacing
                             * etc." MEASURED before: the table's element ran 730..1418
                             * while its last column ended at 1185 — 233px of dead space
                             * inside a table that had been handed a 1fr track and sized
                             * itself to its headings.
                             *
                             * PHASE_COLUMNS ships grow: 0 and KEEPS IT: that is Slate's
                             * own measure (ORACLE #shot-data-pi-time [i=134] w=80,
                             * -weight w=88, -volume w=94, each as wide as its heading
                             * needs), and the History data page reads the same constant
                             * for a table that is not given surplus room. The grow is
                             * the LIVE BAND's opinion about its own track, applied where
                             * that opinion belongs — at the call site — so one export
                             * still serves both screens. */
                            grow: 1,
                        }))}
                        .rows=${phaseRows(this.#bandDerivation).map((row) => ({ ...row, header: t(row.header) }))}
                    ></ui-data-grid>

                    ${this.#renderDerived()}

                    <!-- ============================================================
                         THE RATE STRIP, ALONE IN ITS CORNER (it16 / it21; this note
                         corrected in review — an it20 draft of it still argued for the
                         "All shots" button living here, one arrangement after the tree
                         had already moved on)

                         SLATE'S OWN CORNER IS FOUR THINGS AND THE LAST IS A BUTTON:
                         .slate-shot-rate [i=154] holds the microcap "Rate this shot"
                         [i=155], the score [i=156], the slider [i=157] and then
                         #shot-dye-btn [i=158] "Full notes".

                         THE FOURTH ITEM HAS A DESTINATION NOW, AND IT IS DYE2'S BEAN
                         PICKER (Ben, 27 August 2026: "Have the button open the bean
                         picker page for now, I need to do more work on this though").
                         This note used to say "Decal builds no NOTES surface, so that
                         destination does not exist here (the digest's declared drop) and
                         the corner holds the rating control alone" — both halves of that
                         have moved on. The notes button arrived on 25 August with its
                         own sheet, and the DYE handoff that ui-rating-control has been
                         firing since it was built now has a listener: #openDye2 below.
                         Until today dye-handoff was published by the component,
                         documented in its header, exercised by its own render tests, and
                         listened to by NOTHING in src/ — a finished half with no other
                         half, in the one place the component's header had already warned
                         about it. (NO BACKTICKS ANYWHERE IN THIS BLOCK. It sits inside an
                         html tagged template, where one backtick inside a comment closes
                         the template and the parse error names a distant line.)

                         THE COMPOSITION IS UNCHANGED AND SO IS THE PIN. The handoff is a
                         child of ui-rating-control, not a sibling of it, so this
                         corner still holds exactly one element —
                         which is what the oracle's corner is once its dead-end button
                         is declared away, and what live-bands' composition test pins
                         (foot-controls renders exactly ['ui-rating-control']).

                         THE WAY OUT ("All shots") is NOT here: it is in Slate's own
                         block, under the date and the profile line (#history-open-viewer
                         [i=118] inside #shot-history-panel) — see #renderShotIdentity.
                         it20 tried it stacked in this corner and measured it out: the
                         auto track resolved to the button's width and the strip's
                         microcap ellipsised at 1920 (the strip states no measure of its
                         own — see .foot-controls in the styles). it21 put it back under
                         the identity, unconditional, with only the three identity LINES
                         conditional, and gave this column the token-derived box the
                         component never states.

                         THE STEPPER THAT USED TO BE HERE was deleted outright, and it
                         was worse than an invention. Its value was pinned at 0 with no
                         change handler at all, so it rendered a control that could not
                         move: three presses, no event, no re-read, nothing. Slate has
                         no such control on this band and Ben's enumeration of the foot
                         has none. Paging back through stored shots is what Slate's
                         #history-prev-btn does and what the History screen does
                         properly; the digest carries the declared drop. -->
                    <div class="foot-controls">
                        <!-- WEATHER TAKES THE WHOLE CORNER WHEN IT HAS A READING, and the
                             three controls it replaces are not rendered beside it - Ben's
                             call, 29 Aug 2026. weatherState returns HIDDEN whenever the
                             plugin is absent, has never been given a location, or its
                             reading has aged past two hours, so the ordinary corner is
                             what a machine without the plugin still sees. -->
                        ${this.#weatherShowing
                            ? html`<ui-weather-corner
                                .reading=${this.weather}
                                @weather-open=${this.#openWeather}
                            ></ui-weather-corner>`
                            : this.shotId
                            ? html`<ui-rating-control
                                shot-id=${this.shotId}
                                .score=${this.rating ?? null}
                                label=${t('Rate this shot')}
                                ?handoff=${this.dye2}
                                handoff-label=${t(DYE2_BUTTON)}
                                @notes-open=${this.#openNotes}
                                @dye-handoff=${this.#openDye2}
                            ></ui-rating-control>`
                            : nothing}
                    </div>
                </div>
            </live-foot>

            ${this.#renderKeypad()}

            <!-- THE FULL-SCREEN CHART. Ben, 24 Aug 2026: the tap "should load the
                 expanded chart that does show live tracking etc".

                 IT IS HANDED THE DERIVATION THE CARD ABOVE IS DRAWING, not a second one.
                 That is what makes it live and it is the reason this is an overlay rather
                 than a route: a second screen would need its own feeds, its own
                 derivation and its own copy of the running-vs-browsed rule, and no two of
                 those can be built twice without disagreeing about which shot is on
                 screen. -->
            <!-- ALWAYS THE BAND'S DERIVATION, never the steam session's: this surface
                 cannot be opened during a steam session (see #openExpanded), so a steam
                 branch here would be a branch nothing can reach.

                 A COMMENT GOES ABOVE THE TAG AND NEVER INSIDE ITS ATTRIBUTE LIST. One put
                 between two bindings here made lit parse the element as text: the overlay
                 opened, took no derivation, and drew its own "No shot to draw" refusal. -->
            <live-expanded-chart
                id="expanded"
                ?open=${this._expanded}
                .derivation=${this.#bandDerivation}
                .compliance=${this.compliance ?? null}
                profile-name=${this.profileName ?? ''}
                @expanded-close=${() => { this._expanded = false; }}
            ></live-expanded-chart>
            ${this.#renderHoldMenu()}
            ${this.#renderNotes()}
            ${this.#renderWeatherModal()}
        `;
    }

    /**
     * THE NOTES SURFACE \u2014 IT NAMES THE SHOT AND SHOWS WHAT IS WRITTEN ABOUT IT.
     *
     * Ben, 25 August 2026: "Add a new button under this input that has I can enter 'ALL
     * NOTES' which we will make a new page for at some point."
     *
     * =========================================================================
     * WHAT THIS WAS UNTIL 29 AUGUST 2026, AND WHY IT WAS NOT GOOD ENOUGH
     * =========================================================================
     * It said the page was not built yet. That was honest about the ROADMAP and it was
     * still a fault, because the sheet named no shot at all: the audit enumerated its
     * subtree element by element and recorded a header reading "All notes", an empty body
     * and one control \u2014 "the sheet's whole text is 'Close'". The intent line it answers
     * (`L0534`) is "everything you have written about this shot \u2026 is in front of you to
     * read and add to", and the PROVEN is that the sheet NAMES this shot and SHOWS the
     * text stored against it. Neither half needed a new page: the record was already
     * fetched and already on this screen \u2014 the panel two inches away prints its date and
     * its profile from the same object.
     *
     * SO THE SHEET SAYS WHAT IS TRUE. It names the shot in the band's own vocabulary
     * (`shotClock`, `shotTitle`, `scalarText` \u2014 the same three readers `#renderShotIdentity`
     * uses, so the sheet and the panel cannot spell one shot two ways), and it prints the
     * note stored against it.
     *
     * THE EMPTY STATE IS AN EMPTY STATE, NOT A DASH AND NOT A BLANK. "No notes are stored
     * against this shot" is a fact about the record; a blank body is the screen failing to
     * say anything. A7's rule for a value nobody has supplied, applied to a paragraph.
     *
     * =========================================================================
     * ROUND 2, 30 AUGUST 2026 \u2014 BEN'S DECISION D14: THE NAME, AND THE OTHER HALF
     * =========================================================================
     * Round 1 left two things owed and both are paid here.
     *
     * THE NAME IS "Shot notes". Round 1 flagged the wording and changed nothing: "All
     * notes" sits inside the per-shot rating control, which argues for THIS shot's notes,
     * while the word "All" argues for every note ever written. Ben settled it as the
     * former. The constant moved with it \u2014 `ui-rating-control.js` owns the BUTTON's word
     * and this owns the SHEET's, and the two must not drift, so both now say the same
     * thing and the component's comment records that the phrase is Ben's second word for
     * it rather than a rename of somebody's guess.
     *
     * AND IT WRITES. `L0534` is "everything you have written about this shot \u2026 is in front
     * of you to read and add to", and round 1 delivered the reading half only. The sheet
     * now mounts `<ui-notes-editor>` \u2014 the house component for exactly this, whose own
     * header calls itself "a dialog BODY, not a dialog" \u2014 seeded from the stored note, and
     * Save sends it. Nothing is composed here that the component already owns: the empty
     * invitation is its `placeholder`, the unsaved-work guard is its `guard-unsaved`, and
     * the dirty baseline is its `dirty` / `markSaved()`.
     *
     * THE ROUTE WAS ALREADY PROVEN, WHICH IS WHY THIS IS SMALL. F-023's fix established
     * `PUT /api/v1/shots/<id>` with the smallest honest patch; the note is the same route
     * with `annotations.espressoNotes` in place of `annotations.enjoyment`, and
     * `shots-store.js setNotes` is its writer. The contract row's own gate is obeyed: the
     * ANNOTATION is written, never the top-level `shotNotes` shadow, which the handler
     * rewrites from the annotation on every PUT.
     *
     * THE SCREEN ASKS, IT DOES NOT WRITE. Save dispatches `notes-change {shotId, text}` and
     * `live-wiring.js` calls the store \u2014 the same seam `rating-change` takes, for the same
     * reason: this element renders and the wiring owns the boot object.
     *
     * WHAT STAYS AN EMPTY STATE, AND WHAT STOPS BEING ONE. A shot with no note is not an
     * empty state any more: it is an empty editor with an invitation in it, because there
     * is now something to do about it. A band with NO SHOT still is one \u2014 there is nothing
     * to write against \u2014 and it keeps the sentence and drops the editor rather than
     * offering a text box whose Save could go nowhere.
     *
     * `guard-unsaved` GUARDS THE ACCIDENTS AND NOT THE DECISION, which is the shape of
     * #18's own door rather than a gap in it. `close-request` is raised by ESCAPE and by
     * the BACKDROP \u2014 the two dismissals a hand makes without meaning to \u2014 and the editor
     * refuses those while there is unsaved text, in words, on the glass. `Close` is a
     * labelled press on a button that says what it does; routing it through the same
     * refusal would be asking a person to confirm the thing they just chose.
     */
    #renderNotes() {
        if (!this._notes) return nothing;
        const t = this.#i18n.t;
        const shot = this.storedShot;
        const clock = shotClock(shot ? shot.timestamp : null);
        const title = shot ? shotTitle(shot) : '';
        const dose = this.#bandDerivation && this.#bandDerivation.ok
            ? this.#bandDerivation.scalars.dose : null;
        /* THE ANNOTATION IS AUTHORITATIVE AND THE TOP-LEVEL FIELD IS ITS SHADOW \u2014
         * CONTRACTS.json putShotsById, in those words. A record written before ReaPrime
         * started synchronising the pair can carry `shotNotes` and no `espressoNotes`, so
         * the shadow is read SECOND rather than not at all. Anything that is not a string
         * is an absence: `readValue` answers a no-reading object, never a string. */
        const annotations = readShotAnnotations(shot);
        const written = typeof annotations.espressoNotes === 'string'
            ? annotations.espressoNotes
            : (shot && typeof shot.shotNotes === 'string' ? shot.shotNotes : '');
        const notes = written.trim();
        const shotId = shot && typeof shot.id === 'string' ? shot.id : null;
        return html`<ui-dialog
            id="notes-sheet"
            heading=${t('Shot notes')}
            .open=${true}
            @open-change=${(event) => { if (event?.detail?.open === false) this.#closeNotes(); }}
        >
            <div slot="body" class="notes-sheet">
                ${shot
                    ? html`<div id="notes-identity" class="notes-identity">
                            ${clock.ok
                                ? html`<p class="shot-when">${clock.dateSummary} ${clock.time}</p>`
                                : nothing}
                            ${title ? html`<p class="shot-profile">${title}</p>` : nothing}
                            <p class="shot-charge">
                                <span>${t('In {dose} g', { dose: scalarText(dose) })}</span>
                            </p>
                        </div>`
                    : nothing}
                ${shotId
                    /* BROKEN ACROSS LINES ON PURPOSE. Gate D's constructed-path check
                     * reads any interpolated one-line template containing a slash as a
                     * route assembled from fragments, and a closing tag carries one.
                     * Every other template in this file is written this way already. */
                    ? html`
                        <ui-notes-editor
                            id="notes-editor"
                            label=${t('Shot notes')}
                            placeholder=${t('Nothing is written against this shot yet.')}
                            guard-unsaved
                            .value=${notes}
                            @notes-input=${this.#onNotesInput}
                        ></ui-notes-editor>`
                    : html`<ui-empty-state
                        id="notes-empty"
                        heading=${t('No notes yet')}
                        body=${t('There is no shot on the band to read notes for.')}
                    ></ui-empty-state>`}
            </div>
            <ui-button slot="actions"
                @click=${() => { this.#closeNotes(); }}>${t('Close')}</ui-button>
            ${shotId
                ? html`
                    <ui-button
                        id="notes-save"
                        slot="actions"
                        variant="primary"
                        ?disabled=${!this._notesDirty}
                        @click=${() => { this.#saveNotes(shotId); }}
                    >${t('Save')}</ui-button>`
                : nothing}
        </ui-dialog>`;
    }

    /**
     * The editor reported a keystroke. Only the DIRTY FLAG is held here, never the text.
     *
     * The component owns the document — its own header says `value` is "the SEED, not the
     * live text" — so holding a copy on this element would be a second owner of one string
     * and a re-render race with the caret. What the screen needs is the one thing the
     * component cannot decide for it: whether Save is offered. `#saveNotes` reads the text
     * off the editor at the moment of the press, which is the only moment it matters.
     */
    #onNotesInput = (event) => {
        this._notesDirty = !!event?.detail?.dirty;
    };

    /**
     * Save the note against THIS shot, then stop being dirty.
     *
     * ASKS RATHER THAN WRITES: `notes-change` is heard by `live-wiring.js`, which owns the
     * boot object and the store — the same seam `rating-change` takes. A screen mounted in
     * a fixture or the gallery has no wiring above it, so the event is simply unheard and
     * nothing is sent, which is the honest behaviour for a screen with no server.
     *
     * `markSaved()` MOVES THE BASELINE rather than closing the sheet on a hope: the editor
     * decides what "unsaved" means and it is the thing whose guard would otherwise refuse
     * the next dismissal over work that has been sent.
     */
    #saveNotes(shotId) {
        const editor = this.renderRoot?.getElementById?.('notes-editor');
        if (!editor || typeof shotId !== 'string' || shotId === '') return;
        const text = typeof editor.text === 'string' ? editor.text : '';
        this.dispatchEvent(new CustomEvent('notes-change', {
            detail: { shotId, text },
            bubbles: true,
            composed: true,
        }));
        editor.markSaved?.();
        this._notesDirty = false;
        this._notes = false;
        this._weatherOpen = false;
    }

    /** Shut the sheet and forget the draft state with it. */
    #closeNotes() {
        this._notes = false;
        this._weatherOpen = false;
        this._notesDirty = false;
    }
}

customElements.define('live-screen', LiveScreen);
