/**
 * editor-screen.js — <editor-screen>, the profile editor's shell.
 * SCOPE Part 5 §5 "Skeleton and what flexes"; `LAYOUT_SPEC_DRAFT.md` §4.3;
 * wave 5.5 (wf-w5p5-editor), rows `editor-skeleton` and `tablist-and-selection`.
 *
 * ===========================================================================
 * THE GRID  (§4.3, quoted)
 * ===========================================================================
 *
 *     <editor-screen>              display:grid; height:100%
 *       grid-template-rows: var(--ui-band-h) minmax(0,1fr)
 *
 *       ├─ <editor-header>         grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)
 *       │                          centre = the tablist's own width; flanks overflow,
 *       │                          never shove
 *       └─ <editor-body>           one of three panels
 *            ├─ steps:    <step-matrix>          overflow: auto BOTH axes
 *            ├─ settings: 1fr 1fr 2fr -> 2-up -> 1-up; overflow-y auto
 *            └─ review:   1fr 1fr    -> 1-up;          each column overflow-y auto
 *
 * Two rows, and the seam between them is the header's underline: display, gap and
 * ground come from the seam utility via the classes added to the HOST in
 * connectedCallback, because a `.seam-grid` rule inside this shadow root can never
 * match its own host (CONVENTIONS §13 (b)). Same construction as `live-screen.js`,
 * `selector-screen.js` and `settings-screen.js`.
 *
 * ===========================================================================
 * <editor-header> IS #31 ui-page-header, AND THERE IS NO SECOND HEADER COMPONENT
 * ===========================================================================
 * §4.3 names a box, not a component. The box it names is already built:
 * `ui-page-header.js:390-393` declares
 * `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)` on `.band`, and that
 * file's own header note quotes §4.3's sentence as the reason the centre track is
 * `auto` rather than Slate's 430px literal — "centre track = the tablist's own width;
 * flanks overflow, never shove" — while the note beside it records that the flank which
 * overflows does it as an ellipsis rather than by shoving its neighbour.
 *
 * So the editor's header is #31 in its default `layout="flanks"`, with the tablist in
 * the `centre` slot. Authoring an `<editor-header>` element here would be a second
 * implementation of a track list that already exists in the inventory, which is scope
 * invention (Part 10 §9) and E2/E3's class one level up: two owners of one dimension.
 *
 * ===========================================================================
 * D11 — THE COUNT CROSSES, AND NOTHING ELSE
 * ===========================================================================
 * The band is in `commit` mode. "Save (3)" at a dirty count and "Save" at zero, the pair
 * of buttons carried at both (Ben, 25 August 2026 — this said "Close" alone at zero until
 * the audit recapture caught it), decided in `ui-page-header.js` and nowhere else; `commit-state.js`'s `primaryLabel`
 * was deleted by D11 and a screen that composed the sentence itself would be putting
 * it back. THIS SCREEN SUPPLIES ONLY THE COUNT, as a Number property, default 0.
 * `src/screens/settings-screen.js:83` is the live precedent.
 *
 * B10/R8 sits underneath that and is NOT this row's: the count is what the screen was
 * told, never a prediction of what a save will do. Nothing here re-implements
 * `profile_hash.dart`'s rules, and "cannot tell" is treated as clean, because a
 * false-dirty Save is worse than no dirty state.
 *
 * ===========================================================================
 * THE TABLIST, AND THE EVENT A SCREEN ACTUALLY LISTENS FOR  (E10)
 * ===========================================================================
 * #32 `<ui-tab-bar>` is a WRAPPER: it renders `<ui-bank mode="tablist">` and declares
 * no selected-state rule, no `.item`, no `[aria-selected]` rule, no colour and no key
 * handler. Paint and keyboard both come from #3, so tabs and banks cannot diverge —
 * E10 dies by COMPOSITION rather than by a rule this screen would have to keep. There
 * is no `selected` look anywhere in this file, and there is nowhere for one to go: the
 * only element that could carry it lives in another component's shadow root.
 *
 * IT DISPATCHES NOTHING OF ITS OWN. `ui-bank.js:658` dispatches
 * `CustomEvent('change', {detail:{value,index}, bubbles:true, composed:true})`, and
 * `composed` is what carries it out of the tab bar's shadow root. This screen listens
 * for `change` on the band — the bar is the band's light-DOM child, so the band is on
 * the event's path. A screen listening for a `ui-tab-bar`-specific event would be
 * waiting for one that is never sent.
 *
 * `stretch` is OFF (its default): §4.3's centre track is `auto`, so the bar takes its
 * own width and the flanks take the rest. Setting `stretch` here would make the centre
 * track the flanks' leftovers and quietly re-create Slate's 430.
 *
 * ===========================================================================
 * WHERE THE PANELS LIVE, AND WHO HIDES THEM
 * ===========================================================================
 * The three panels are rendered by THIS file and slotted into `<editor-body>`; the
 * body owns their box and `<ui-tab-bar>` owns which one is showing. The bar's `panels`
 * property takes `value -> Element` and writes `role="tabpanel"`, `tabindex="0"`, an
 * accessible name, `hidden` and `inert` — and restores all five on release. That is
 * one owner for "which panel is showing", and it is the component whose job it is.
 *
 * The map is handed over in `updated()`, because element references only exist after a
 * render. The cost is the one frame ui-tab-bar already documents for a re-parented bar:
 * all three panels are laid out before the first sync. The alternative — this screen
 * writing `hidden` itself — is two owners of one state, which is the defect class this
 * screen exists to retire.
 *
 * ===========================================================================
 * THE TWO MOUNT REGIONS, AND THEIR CONTRACTS
 * ===========================================================================
 * This wave's matrix and editing rows fill the panels; this file gives them boxes.
 *
 * STEPS — `wf-w5p5-editor`'s matrix rows own `<step-matrix>`:
 *
 *   - the region is a grid cell of `<editor-body>`, sized `minmax(0,1fr)` in BOTH axes,
 *     with `min-inline-size: 0` and `min-block-size: 0` so the matrix can shrink;
 *   - the slot is `display: contents`, so the SLOTTED ELEMENT is the grid item and a
 *     floor declared on the matrix still binds (a wrapper box would take the track and
 *     then have to hand its height on, which is how a floor stops binding);
 *   - THE REGION DECLARES NO OVERFLOW. §4.3 gives `overflow: auto` on BOTH axes to
 *     `<step-matrix>` itself, so the matrix owns both, and E1's trap ("the container's
 *     content box is not sized to exactly its own content") is the matrix's to avoid.
 *     A second `overflow` here would be a second owner of the same behaviour.
 *
 *   Mount it as a light-DOM child:  <editor-screen><step-matrix slot="steps">…
 *
 * SETTINGS — the editor's own field rows, which are a COMPOSITION and not a component
 * (Part 10 §9; see `editor-settings-panel.js` on why #29 is not the one to reach for).
 * They arrive the same way, and are forwarded straight into the panel's grid:
 *
 *   Mount them as light-DOM children:  <editor-screen><div slot="settings">…
 *
 * REVIEW is not a mount region: its sentences are MODEL OUTPUT (`profile-modes.js`
 * `reviewStepSpec`), so they arrive as the `reviewColumns` property and the panel
 * renders them. See `editor-review-panel.js`.
 *
 * ===========================================================================
 * ONE OWNER PER DIMENSION  (E2/E3/E5/E8)
 * ===========================================================================
 * There is no layout computed in JavaScript in this file: no ResizeObserver, no
 * `matchMedia`, no measured width written back as a style, and no exported scale.
 * E8 is the cautionary tale — `--pe-scale` was declared, documented, exported and
 * TESTED, and connected to nothing, with the tests passing against an engine the app
 * never used. Every number this screen has an opinion about is a token, and the suite
 * proves each one MOVES A RENDERED BOX rather than merely existing.
 *
 * ===========================================================================
 * THE STORE, THE DRAFT, AND THE TWO GESTURES  (fix run 4 — `dec-A-B-1`)
 * ===========================================================================
 * B10/B11's save path shipped complete and unreachable. `createProfileEditorStore` had
 * no caller outside `test/`; the `editor-commit` event this file dispatches "so the
 * composition root above has one place to listen" had no listener in `src/`; and the
 * only composition root in the tree was the ten-line one inside `test/harness/editor.js`.
 * So the editor route mounted a screen with no profile, no editable surface and no way
 * to reach `saveAsNewVersion`. This section is what closed it, and every part of it is a
 * connection rather than a new mechanism.
 *
 * THE STORE IS THE SHELL'S — `boot.profileEditor`, built in `app-boot.js` beside the
 * other stores, because the handoff has two ends: the SELECTOR seats the record when the
 * user picks Edit, this screen reads it back after the route swap, and a route swap
 * destroys the outgoing screen. This screen takes what it is given and never builds one;
 * it unsubscribes on disconnect and does NOT stop the store, which belongs to the shell.
 *
 * THE DRAFT IS THIS SCREEN'S, which is the contract every surface under it states in its
 * own header ("editor draft state, NEVER mutated; every change leaves as an event and the
 * screen owns the draft"). The FIVE editing events — `step-change`, `value-commit`,
 * `exit-condition-change`, `lever-change` and `step-action` — are applied by
 * `src/lib/editor-draft.js`, which holds every rule about what an edit MEANS (the limiter's
 * inner value, a pump switch being a reseed, the exit's three parts becoming an object, and
 * what it costs to move a step out from under the preinfusion marker). The listeners are on
 * the HOST, so they catch both mount styles, and they never stop propagation: a
 * composition root above this screen still sees every event it saw before.
 *
 * THE FIFTH ARRIVED ON 27 AUGUST 2026 AND IT WAS `dec-A-B-1` A SECOND TIME. Ben: "IN the
 * profile editor page, the 5 buttons down the bottom dont seem to do anything, like if I
 * try to make a new step of copy one etc it does noting." `ui-action-key-rail.js` had five
 * working buttons, a documented `step-action` contract and a 700-line suite; `step-matrix`
 * mounted one rail per step column; and the only other place the string `step-action`
 * appeared in `src/` was a comment in the matrix saying the event "crosses this boundary as
 * it is" — and then stopping. See `#onStepAction`.
 *
 * TWO GESTURES, AND THE ROUTE FOLLOWS THE GESTURE, NEVER A DIFF. The band's Save is a
 * content save and takes B11's path (`saveAsNewVersion`, DQ-629, Ben's ruling); the
 * header's rename affordance is a label edit and takes the PUT. `editor-commit.js
 * commitPlan()` is that table, written once, with the reasoning and the evidence. Slate
 * chose between the two by re-implementing `profile_hash.dart`'s input set in the client
 * (`profile_editor.js:3267`), which is the B10 defect exactly; nothing here predicts what
 * a save will do, and the REPORT the store publishes is what the person is told.
 *
 * THE SCREEN MOUNTS ITS OWN EDITING SURFACES ONLY WHERE NOBODY HANDED IT ANY, AND THE
 * UNIT IS THE REGION. The four regions stay light-DOM mount points — the harness, the
 * capture fixture and the render suites all mount their own children and are untouched —
 * and each region is answered independently (`#owns`), so a caller that mounts its own
 * field rows and nothing else still gets a matrix. The surfaces live inside the slots as
 * FALLBACK CONTENT, which the engine renders only when that slot has nothing assigned, so
 * the two halves agree by construction rather than by care. A screen with no profile
 * renders exactly what it rendered before this run, which is what keeps the skeleton
 * suite and the Gate B poses honest.
 *
 * ===========================================================================
 * THE HEADER CARRIES THE PROFILE'S IDENTITY  (fix run 4 — `cmp-seh-3`)
 * ===========================================================================
 * Ben: RESTORE THE FULL SETUP. Slate names the profile on every tab and this file did
 * not — the band read the static heading "Profile editor" on all three:
 *
 *   CITE prov-baseline/editor-steps.json — .slate-editor-kicker [i=3] "Profile editor"
 *        (uppercase, muted, 14px); button#editor-title-display [i=4] "Extractamundo Dos!"
 *        (28px, weight 500); button#editor-title-pencil [i=5] aria-label "Edit profile
 *        name" (62 x 62); p#editor-profile-totals [i=6] "3 steps · max 2:00 · cap 100 mL
 *        · peak 6.0 bar" (15px, muted). All four in the lead flank, rects x=30.
 *
 * It is rebuilt in #31's `lead` slot, which is the flank §4.3 gives to a heading, so the
 * CENTRE track is still the tablist's own width and cross-1's sizing is untouched. The
 * heading property is dropped exactly when the identity block replaces it, so the band
 * never carries two titles. The totals come from `profile-totals.js`, which composes
 * `profile-modes.js stepTargetOverlay` for the peak rather than repeating Slate's
 * limiter-derived misreport.
 *
 * ===========================================================================
 * D2
 * ===========================================================================
 * Every readable string is a value read through I18nController, from this file's first
 * commit — English only in v1, mechanism never deferred. The three tab labels and the
 * two names below are the only strings here, and each is `t(...)` of a value.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { shotClock } from 'src/lib/shot-summary.js';
import { VERSIONS_STATUS } from 'src/stores/profile-library-store.js';
import { createEditorRanges } from 'src/lib/editor-ranges.js';
import {
    applyEditorEdit, applyStepAction, EDITOR_EDIT, renameBody,
} from 'src/lib/editor-draft.js';
/* THE FIFTH EDITING EVENT'S NAME, imported from the component that dispatches it rather
 * than re-typed here. One spelling; a rename in the rail is a build error here instead of
 * a listener that quietly stops matching. `NEW_STEP_NAME_KEY` rides along because D2 puts
 * the translation at the call site and this screen is the call site: `editor-draft.js` is
 * DOM-free and has no t() to give a brand-new step its name. */
import { STEP_ACTION } from 'src/components/ui-action-key-rail.js';
import {
    commitPlan, COMMIT_GESTURE, SAVE_OPERATION, CHANGE_TELL,
} from 'src/lib/editor-commit.js';
import {
    profileFailureSentence, PROFILE_VISIBILITY, profileVisibilityOf,
} from 'src/data/rea-profile.js';
import { profileTotalTerms, TOTALS_SEPARATOR } from 'src/lib/profile-totals.js';
import { NEW_STEP_NAME_KEY, reviewStepSpec } from 'src/lib/profile-modes.js';
import {
    VERSION_KEPT, versionChangeFacts, parentRecordOf, lineageFactsOf,
} from 'src/lib/profile-lineage.js';

/**
 * THE PROFILE-LEVEL FIELDS, IN WORDS — the display half of `PROFILE_SCALAR_KEYS`
 * (`editor-commit.js`), which is the wire half.
 *
 * D2: the keys here are the ENGLISH SOURCE STRINGS, not a second vocabulary. They go
 * through `t()` at the call site like every other word this screen shows, and the map
 * exists only so the wire spelling (`target_volume_count_start`) never reaches a person.
 * It is deliberately NOT exhaustive-by-assertion: a key with no entry is printed as
 * itself rather than dropped — see `#versionChangeLine`.
 */
const VERSION_FIELD_WORDS = Object.freeze({
    title: 'the name',
    notes: 'the notes',
    author: 'the author',
    beverage_type: 'the beverage',
    version: 'the profile version',
    target_volume: 'target volume',
    target_weight: 'target weight',
    target_volume_count_start: 'volume count start',
    tank_temperature: 'tank temperature',
});
import { SAVE_STATUS, VISIBILITY_WRITE } from 'src/stores/profile-editor-store.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
import { historyIcon, penIcon } from 'src/lib/icons.js';

import 'src/screens/editor-body.js';
import 'src/screens/editor-settings-panel.js';
import 'src/screens/editor-review-panel.js';

/* THE EDITING SURFACES, imported so they are DEFINED wherever this screen is — the
 * side-effect idiom `ui-favourites-bank` uses for #3 and #35. Nothing is imported by
 * name: this screen sets their properties and never touches a class. They are mounted
 * only when nobody handed the screen its own (see `#owns`). */
import 'src/screens/step-matrix.js';
import 'src/screens/editor-preview.js';
import 'src/screens/editor-overlays.js';
/* The overlays' REFUSAL, by its own name. A door that declined to open says so on this
 * event and the screen is the only thing above it with a notice surface — see
 * `#onNumpadRefused`. */
import { NUMPAD_REFUSED } from 'src/screens/editor-overlays.js';

/* THE BOXES' CONTENT — every one a library component, composed. §4.3's component list
 * for this screen. A hand-built copy of any of them is scope invention (Part 10 §9). */
import 'src/components/ui-page-header.js';
import 'src/components/ui-tab-bar.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';
import 'src/components/ui-text-field.js';
/* #7, for the Settings panel's "Count volume from" — a step INDEX, whose only legal
 * values are the steps the draft already holds. See `#settingsRows`. */
import 'src/components/ui-select.js';
/* #5, for the Settings panel's "Hidden from the library" — a RECORD property rather than
 * a profile key, written by its own request. See `#settingsRows` and `#onHiddenSwitch`. */
import 'src/components/ui-switch.js';
import 'src/components/ui-toast.js';

/**
 * The three panels, in the order §4.3 lists them. `value` is the id this screen and
 * the tab bar agree on; `label` is content and goes through `t()` at the call site.
 *
 * Exported so the suite names the tabs once rather than three times, and so a later
 * row that needs to select a panel does not re-type a string.
 */
export const EDITOR_TABS = Object.freeze([
    Object.freeze({ value: 'steps', label: 'Steps' }),
    Object.freeze({ value: 'settings', label: 'Settings' }),
    Object.freeze({ value: 'review', label: 'Review' }),
]);

/** The panel the editor opens on. §4.3 lists steps first and it is the screen's point. */
export const DEFAULT_EDITOR_TAB = 'steps';

/**
 * The four LIGHT-DOM mount regions, by slot name. A caller fills the ones it wants and
 * this screen fills the rest from its draft — per region, so mounting your own field rows
 * does not cost you the matrix. `settings` is in the list because it is a region; the
 * screen mounts nothing into it today (the app's editor has no field rows yet — see the
 * run's deferred questions), and naming it here is what makes that a one-line addition
 * rather than a second mechanism.
 */
export const EDITOR_REGIONS = Object.freeze(['steps', 'settings', 'preview', 'overlays']);

const EMPTY_REGIONS = Object.freeze(Object.fromEntries(EDITOR_REGIONS.map((r) => [r, false])));

export class EditorScreen extends UiElement {
    static properties = {
        /**
         * The app shell's boot object, handed down by <app-root> at creation
         * (`app-root.js:272`). This screen reaches no route through it — the editing
         * rows do — but the door is where every other screen puts it.
         */
        boot: { attribute: false },

        /**
         * D11's count, and the only thing this screen tells the band. A number.
         * `ui-page-header` coerces a negative, fractional or unparseable value to zero
         * changes, because a false-dirty Save is worse than no dirty state.
         */
        changeCount: { type: Number, attribute: 'change-count' },

        /**
         * Which panel is showing. Reflected, so a harness state is one attribute and a
         * test reads the selection off the DOM rather than out of a private field.
         * A value matching no tab selects nothing — that is #32's stated behaviour and
         * this screen does not paper over it with a fallback.
         */
        tab: { type: String, reflect: true },

        /**
         * The review, as data — `editor-review-panel.js`'s `columns` shape, built from
         * `profile-modes.js` `reviewStepSpec`. Data in, layout out: this screen holds
         * no sentence and no range.
         */
        reviewColumns: { attribute: false },

        /**
         * Internal: the profile-editor store's published state — `{load, record,
         * baseline, save, report, refusal, version, …}`. Mirrored, never re-derived.
         */
        _state: { state: true },

        /**
         * Internal: THE DRAFT. The profile being edited, in the DE1 v2 shape the server
         * serves. Seeded from the seated record and rewritten by `editor-draft.js` on
         * every editing event; `null` when nothing is open, which is the state a bare
         * mounting is in and the reason such a mounting renders what it always did.
         */
        _draft: { state: true },

        /**
         * Internal: which of the four mount regions a CALLER filled, by name. A region a
         * caller mounted into is the caller's; the others are this screen's to fill when
         * it has a draft. PER REGION and not per element, so a caller that mounts its own
         * field rows and nothing else still gets a matrix.
         */
        _callerRegions: { state: true },

        /**
         * Internal: the rename dialog's refusal sentence, or null.
         *
         * IT IS A FIELD BECAUSE THERE HAS TO BE SOMEWHERE TO PUT IT (audit F-050). The
         * confirm used to `hide('confirm')` one line BEFORE it checked whether it had a
         * body, so an empty or whitespace-only title dismissed the dialog exactly as an
         * accepted rename dismisses it, and the early return then happened behind a closed
         * dialog with no surface left to render a refusal into. Declining to send an empty
         * title is the RIGHT call — ReaPrime answers one with a typed 400 — so the fault
         * was never the refusal, only that it was silent and dressed as an acceptance.
         */
        _renameRefusal: { state: true },
    };

    static styles = [typeRoles, seams, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THE GRID. display / gap / ground come from the seam utility via the host
         * classes added in connectedCallback; :host(.seam-grid) is (0,2,0), so this
         * rule — same selector, written later — is what adds the tracks to it.
         *
         * Two rows and no more, and the seam between them IS the header's underline,
         * which is why the ground is --ui-line-strong (.seam-strong): §3.9 and
         * CONVENTIONS §13 both give that weight for "rail edge, header underline, band
         * top". */
        /* THE VERSION LIST'S BODY. One column of rows, each a whole button, so a finger
         * lands on the row rather than on the text in it. The dialog owns the scroll.
         *
         * THE ROWS ARE STRETCHED BY THE GRID and not by a rule naming them. A
         * a .versions ui-button selector matches nothing until a lineage has landed, and
         * E4's rule — no selector that cannot match in any state — is checked over the
         * states a harness can reach, which does not include "the server answered with two
         * versions". justify-items says the same thing about whatever the column holds,
         * including the sentence that stands in for an empty one. */
        .versions {
            display: grid;
            gap: var(--ui-space-2);
            justify-items: stretch;
            min-inline-size: 0;
        }


        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long heading cannot widen the screen; the
         * band's own three tracks are #31's and nothing here reaches into them. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        /* Row 2, both minimums at 0 — the body decides its own cell and each panel
         * decides its own floor. A min-block-size here would be a third owner of a
         * dimension two boxes already own (§2.3). */
        editor-body {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* THE SETTINGS PANEL'S FIELD ROWS (F-031).
         *
         * A field row is a COMPOSITION and not a component — editor-settings-panel.js
         * says so at length, and its own header is the reason these rows live here as
         * fallback content rather than inside it: that element owns the tracks, the two
         * collapses, the scroll region and the floor, and authors no field, no label, no
         * control and NO RANGE. This is the caller half of the same contract.
         *
         * ONE GRID ITEM PER ROW. The panel is the grid; a row is a block that stacks its
         * caption under its control and states no width of its own, so the track owns the
         * width exactly as the panel's header requires.
         *
         * NO BOUND IS WRITTEN HERE. Not one number. The two fields that would want one
         * are both DECLARED UNRANGED in editor-ranges.js by name, with reasons, and each
         * takes the control that needs no table: a plain entry, or a list of the steps the
         * draft already holds. */
        .field {
            display: block;
            min-inline-size: 0;
        }

        .field ui-text-field,
        .field ui-select {
            inline-size: 100%;
        }

        /* A SWITCH ROW IS A LABEL AND A CONTROL ON ONE LINE (D20), which is the one shape
         * a text field's stacked label cannot take: #5 ui-switch draws no label of its
         * own and takes its accessible name from the light DOM, so the visible word and
         * the announced word are the same element. The name is the FIRST thing on the
         * line and the control the last — the settings screen's own order.
         *
         * NO WIDTH IS STATED. The switch has its own track size and the label takes the
         * rest, so the track still owns the row's width exactly as the panel requires. */
        .field .switch-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-3);
            min-block-size: var(--ui-hit-min);
        }

        .field .switch-line ui-switch {
            flex: none;
        }

        /* THE CAPTION UNDER A FIELD, for the two rows that carry one. A caption is the
         * house answer to a control whose consequence is not legible from its label —
         * settings-bespoke-leaf.js uses the same class for the same job. */
        .field .ui-caption {
            display: block;
            margin-block-start: var(--ui-space-2);
            color: var(--ui-muted);
        }

        /* THE STEPS MOUNT REGION. A cell and a floor of zero, and no overflow at all:
         * §4.3 gives both axes to <step-matrix>. See the header for the contract the
         * matrix row builds against. */
        #steps {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            min-inline-size: 0;
            min-block-size: 0;

            /* THE GROUND, AND IT IS CONVENTIONS §13 TRAP 1 VERBATIM: "a cell that
             * paints nothing is a hole".
             *
             * This host carries seam-grid + seam-strong, so the SCREEN paints
             * --ui-line-strong and every region is expected to paint over it. The two
             * panels beside this one are custom elements that paint their own ground;
             * #steps is a plain div and painted nothing, which never showed while the
             * matrix stretched to fill it.
             *
             * Ben, 25 August 2026: "why is there an empty row at the bottom in
             * decal". Two grounds were showing through, an axis each. The matrix now
             * ends at its own rows and its own tracks — so this cell must cover what
             * the matrix no longer does, or the hole simply changes colour from
             * --ui-line to --ui-line-strong.
             *
             * FASCIA, because that is the ground the matrix's own cells stand on, and
             * it is Slate's answer at the same place: beside its grid the page reads
             * rgb(14, 19, 23) = --ui-fascia, measured. */
            background-color: var(--ui-fascia);
        }

        /* AND THE HALF THAT MAKES hidden WORK ON IT. #steps is a plain div in this
         * root, so the rule above is an AUTHOR rule and outranks the UA sheet's
         * [hidden] { display: none } — the exact mechanism ui-tab-bar's own header
         * calls bug P13, and the reason that component writes inert alongside
         * hidden. (0,2,0) against (0,1,0), stated rather than left to source order.
         * The two custom-element panels need no such rule: base.js already declares
         * :host([hidden]) { display: none } at (0,2,0). */
        #steps[hidden] {
            display: none;
        }

        /* THE FORWARDING SLOTS. display: contents at every link of the chain, so
         * the light-DOM element a caller mounts is the grid item in the end — the
         * matrix in #steps' one cell, a field row in the settings panel's track. A box
         * anywhere in the chain would take the cell and then have to hand its size on,
         * which is how a floor stops binding.
         *
         * "preview" is the same construction one link longer: the slot inside
         * <editor-review-panel> is itself slotted into that panel's own "chart" slot, so
         * a caller mounts an <editor-preview slot=preview> on THIS element and the card
         * lands in the review panel's chart row. E12 puts the preview on the Review tab
         * ("the Review chart"), which is also what makes the hidden-tab guard the thing
         * it guards.
         *
         * "overlays" is not a region and takes no track: each overlay is a
         * display:contents host over a CLOSED native dialog, so nothing here contributes
         * a row. Same placement, and the same reason, as the selector screen's "the
         * overlays live here". */
        #steps > slot,
        slot[name="settings"],
        slot[name="preview"],
        slot[name="overlays"] {
            display: contents;
        }

        /* =====================================================================
         * THE PROFILE'S IDENTITY IN THE LEAD FLANK  (cmp-seh-3)
         *
         * Three stacked lines in ONE flex item, so #31's lead region still holds a
         * single cluster and the centre track is still the tablist's own width. The
         * block is content-sized in both axes: no height is declared here, because the
         * band's own min-block-size is --ui-band-h and a second owner of that dimension
         * is §2.3's defect. align-content: center is what keeps the shorter no-totals
         * form (an unbounded profile states no ceiling) optically on the band's axis.
         *
         * min-inline-size: 0 at every level of the chain, and it is load-bearing: the
         * flank's job under load is to ELLIPSISE rather than shove the tablist off
         * centre (Appendix 7), and a grid item's automatic minimum is its content
         * unless it is told otherwise — which is M10's mechanism exactly.
         * ================================================================== */
        #identity {
            display: grid;
            /* THE BAND PAYS FOR ITS TWO TYPE LINES FIRST, AND THE CONTROL ROW TAKES WHAT
             * IS LEFT — never below the hit floor, which is what minmax() states. Same
             * construction as the Live rail's stepper caps: reserve the floor, derive the
             * give, and let the assertion catch the day it stops fitting.
             *
             * max-block-size, so the block can never grow the band: the screen's grid row
             * 1 is exactly --ui-band-h and a taller flank would overflow it rather than
             * push the body down. align-content: center then places the shorter form on
             * the band's optical axis, which is where the oracle draws it (its block runs
             * 5..114 in a 118 band). */
            grid-template-rows: auto minmax(var(--ui-hit-min), 1fr) auto;
            align-content: center;
            max-block-size: var(--ui-band-h);
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .name-row {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        /* THE PENCIL GIVES DOWN TO THE HIT FLOOR AND NO FURTHER, through #2's own private
         * geometry hook (--_ui-icon-btn-box, ui-icon-button.js:283) — the sanctioned
         * route for a consumer, and the same one #56 used for the switch's corners. Gate C
         * forbids re-pointing a PUBLIC --ui-* token from out here; a private hook is what
         * the guard deliberately allows.
         *
         * DECLARED DEPARTURE: the oracle's pencil is 62 x 62 in a 118 band
         * (prov-baseline editor-steps [i=5]). Three stacked registers plus a 64px control
         * measure 114, which fits the reference band and OVERFLOWS the short-canvas one
         * (103.25 at the 1000x600 floor, tokens.css:1358). One control size at both
         * geometries is one owner; a per-geometry size would be two. 48 is --ui-hit-min
         * exactly, which is the floor the whole skin is built on. */
        /* THE TABS, TO SLATE'S MEASUREMENTS. #32 wraps #3, so the knobs are #3's: the
         * item inset, its type, and a floor on the item so three tabs are one width
         * rather than three word-widths. 143 is Slate's 142.7 rounded — a third of its
         * 428px bar, which is what makes the three equal. */
        #tabs {
            --_ui-item-inset: 14px;
            --_ui-bank-item-min: 143px;
        }

        /* THE PART SPELLING ONLY. The descendant selector that used to sit beside it —
         * a role=tab under #tabs — could never match: #32 wraps #3 and the tabs live in
         * that component's shadow root, which a selector in THIS sheet cannot reach.
         * E4's own guard says so ("no rule in the shell's four sheets is unmatchable, in
         * any panel state") and it had been failing on that one line.
         * NO BACKTICK IN THIS COMMENT: one ends the css template. */
        #tabs::part(item) {
            font-size: 16px;
            letter-spacing: 1.76px;
            text-transform: uppercase;
        }

        #title-pencil {
            --_ui-icon-btn-box: var(--ui-hit-min);

            /* NO BOX. Ben, 25 August 2026: "copy Slates edit icon and remove the box
             * around it". Slate's own .slate-editor-pencil is a 62px square with
             * border: 0 and a transparent ground - the mark alone. #12's border is a
             * declared hook for exactly this; the hit area and the focus ring are
             * untouched, which is what makes removing the paint safe. */
            --_ui-icon-btn-border: 0;
        }


        /* THE TITLE IS A BUTTON, as it is in the oracle (button#editor-title-display),
         * because pressing the name is one of the two ways Slate opens the rename
         * (profile_editor.js:3255 binds the display and the pencil to one opening).
         *
         * It carries .ui-title for its type, so nothing about size, weight or colour is
         * declared here — the role owns all three and this rule owns the box. The UA
         * sheet's font-family on <button> is the one exception and it is stated for the
         * reason ui-button.js:185-190 gives: there is no preflight inside a shadow root
         * to undo it. The focus ring is the base's, which rings every focusable element
         * in this tree (base.js:470). */
        #editor-title {
            /* L22. The name is a control a finger presses, so it clears the hit floor on
             * the axis it can — the oracle's own title button is 62 x 62 in a 118 band
             * (prov-baseline editor-steps [i=4]) and this is the token that says the same
             * thing. The inline axis is the flank's and gives before the band does. */
            min-block-size: var(--ui-hit-min);
            min-inline-size: 0;
            overflow: hidden;
            border: 0;
            padding: 0;
            background-color: transparent;
            font-family: inherit;
            text-align: start;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
        }

        /* THE TOTALS LINE. One line, ellipsised rather than wrapped — a second line
         * would take the band past --ui-band-h and the band is the one box on this
         * screen whose height is a token. The measure cap .ui-caption carries is
         * dropped for the same reason: this is a strip of four terms, not copy.
         *
         * DEPARTURE, DECLARED: the oracle's totals are semibold (font-weight 600,
         * prov-baseline editor-steps [i=6]) and .ui-caption is regular. The skin has ONE
         * caption treatment (type-roles.js quotes Slate's own note on why) and a
         * semibold variant here would be a fourteenth register for one line of text.
         * .ui-numeric rides along because the line is mostly figures and a value that
         * changes must not jitter. */
        #totals {
            max-inline-size: none;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `];

    #i18n = new I18nController(this);

    /** The `value -> Element` map handed to #32, built once the panels exist. */
    #panels = null;

    /** The shell's editor store, or null when this screen was mounted without a boot. */
    #store = null;

    /** The subscription to it. One in, one out — P14. */
    #unwatch = null;

    /** THE ONE RANGES DOOR (B2), built from the shell's capability answer. */
    #ranges = null;

    /**
     * THE THREE CAPABILITY HINTS THE MATRIX TAKES, read once at attach beside the
     * ranges. Fail-closed defaults, so a screen with no boot offers nothing.
     */
    #modes = Object.freeze({ pumpModes: false, hold: false, powerExit: false });

    /** The record object `_draft` was seeded from, so a re-seat is a real event. */
    #seatedFrom = null;

    /** The operation the last save took, so the answer knows which draft rule applies. */
    #pending = null;

    /** The last save status announced, so one outcome is announced exactly once. */
    #announced = SAVE_STATUS.IDLE;

    constructor() {
        super();
        this.boot = null;
        this.changeCount = 0;
        this.tab = DEFAULT_EDITOR_TAB;
        this.reviewColumns = null;
        this._state = null;
        this._draft = null;
        this._callerRegions = EMPTY_REGIONS;
        this._renameRefusal = null;
    }

    /**
     * The seam classes go on the HOST, not in the constructor — a custom element
     * constructor must not gain attributes (CONVENTIONS §13 (b)).
     */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');

        /* THE FOUR EDITING EVENTS, ON THE HOST. On the host rather than on the elements,
         * so a caller's own light-DOM matrix and this screen's own reach the same writer;
         * added here and removed below, which is the pairing S10/P14 is the absence of.
         * NOTHING IS STOPPED: a composition root above this screen (the harness's) still
         * receives every event it received before. */
        for (const name of Object.values(EDITOR_EDIT)) this.addEventListener(name, this.#onEdit);

        /* THE FIFTH, AND IT IS THE ONE THAT WAS MISSING ENTIRELY (see #onStepAction). Same
         * host, same reason, same non-stopping: a composition root above this screen sees
         * `step-action` exactly as it did before. */
        this.addEventListener(STEP_ACTION, this.#onStepAction);

        /* THE SIXTH, AND IT WAS HEARD ONLY BY A TEST (see #onNumpadRefused). Same host,
         * same reason: the overlays are a light-DOM child on one mount and a shadow-root
         * child on the other, and the host is the one place both reach. */
        this.addEventListener(NUMPAD_REFUSED, this.#onNumpadRefused);
        this.#noteCallerMounts();
        this.#attach();
    }

    disconnectedCallback() {
        for (const name of Object.values(EDITOR_EDIT)) this.removeEventListener(name, this.#onEdit);
        this.removeEventListener(STEP_ACTION, this.#onStepAction);
        this.removeEventListener(NUMPAD_REFUSED, this.#onNumpadRefused);
        this.#unwatch?.();
        this.#unwatch = null;
        /* THE STORE IS NOT STOPPED. It is the shell's (`boot.profileEditor`) and it
         * outlives this screen by design — the record survives a route swap. Stopping it
         * here would destroy an object this element does not own. */
        this.#store = null;
        super.disconnectedCallback();
    }

    /** The shell may set `boot` before or after this element is connected; both must
     *  open the screen exactly once. Same construction as `selector-screen.js:409`. */
    willUpdate(changed) {
        if (changed.has('boot')) this.#attach();
    }

    /**
     * Subscribe to the shell's editor store and build the ranges door. Idempotent.
     *
     * THE DOOR IS BUILT FROM THE CAPABILITY STORE'S OWN ANSWER — `machineLimits()`, the
     * R2 adapter, which is how every surface in this tree reaches `machine-limits.js`.
     * One door per screen, handed to the matrix and the overlays, so a bound a keypad
     * hints and a bound a cell clamps are the same table (B2).
     */
    #attach() {
        if (!this.isConnected || !this.boot?.profileEditor) return;
        /* IDEMPOTENT ON THE STORE, NOT ON THE CALL. A second `boot` carrying the same
         * store changes nothing; a second boot carrying a DIFFERENT one re-subscribes,
         * because a screen still mirroring the previous shell's store would render a
         * record nobody is editing. One subscription either way. */
        if (this.#store === this.boot.profileEditor) return;
        this.#unwatch?.();
        this.#store = this.boot.profileEditor;
        /* NO TABLE, NO DOOR, AND NO SUBSTITUTE. `createEditorRanges` throws rather than
         * defaulting — "a hand-written fallback here would be the second table B2
         * forbids" — so a shell with no capability store leaves `#ranges` null and every
         * bounded control renders UNAVAILABLE with the door's own reason (A7). Built once,
         * at attach: the editor is opened from the selector, long after the boot's
         * capability read has settled. */
        const limits = this.boot.capabilities?.machineLimits?.()?.value ?? null;
        /* THE MACHINE CLASS ENTERS THE EDITOR HERE AND NOWHERE ELSE (27 August 2026).
         *
         * Ben, in this screen: "why is flow limited to 15ml/s" — and then "flow limit goes
         * with it to 20 as well." A Bengle authors a flow step's target and a pressure
         * step's flow limit up to 20 mL/s where a DE1 stops at 15 and 8, so the authoring
         * table resolves those two rows per machine class exactly as the machine table has
         * always resolved its steam ceiling.
         *
         * IT IS THE SERVED CAPABILITY ANSWER, NEVER THE MACHINE'S NAME.
         * `capabilities.machineClass()` is `machineClassFromServedSet` over ReaPrime's
         * capability array — the same answer `machineLimits()` a line above was resolved
         * against, so the two halves of the ranges door cannot end up describing two
         * different machines. The old editor got this lift by sniffing the model string,
         * which A3 forbids and which is why the lift was dropped rather than ported; this
         * is the route it had to come back through.
         *
         * NULL IS FINE AND MEANS "NOT KNOWN YET" — the door then offers the narrower of
         * the two bands (the DE1's), which nests inside the Bengle's, so nothing it lets
         * a person type can be refused by the machine. Read once, at attach, for the same
         * reason the limits beside it are: the editor opens from the selector, long after
         * the boot's capability read has settled. */
        const machineClass = this.boot.capabilities?.machineClass?.() ?? null;
        this.#ranges = limits ? createEditorRanges({ machineLimits: limits, machineClass }) : null;
        this.#modes = this.#readModes();
        this.#unwatch = this.#store.subscribe((state) => this.#onStoreState(state));
        this.#onStoreState(this.#store.get());
    }

    /**
     * THE ADVANCED PUMP MODES — Power, Lever, HOLD, and the cross-variable Power exit.
     *
     * MEASURED 25 AUGUST 2026, and it was a dead half of exactly the class this port
     * keeps finding. Ben, looking at the editor beside Slate's: "why is the lever and
     * power pump modes missing from both?" Every piece existed —
     * `r3ProfileModeCapabilities` decodes the served bitmask, `capabilities.profileModes()`
     * answers it, `pumpChipsFor` and `transitionSegments` and `exitConditionChoices`
     * consume it, and `<step-matrix>` declares all three properties — and NOTHING
     * CONNECTED THEM. `profileModes()` had no caller in the app at all. So the modes
     * could not appear on any machine, whatever it advertised; his own machine reports
     * `profileModeCaps: 15`, which is all four bits set.
     *
     * THE GATE IS SLATE'S, MINUS THE NAME TEST. Slate asks
     * `isBengleMachine() && isProfileModeCapableCached()` — a model-string test ANDed
     * with "the mask is non-zero". A3 forbids the name half ("A3 forbids the name test,
     * so it is unported", capabilities-store.js), and it costs nothing: a machine that
     * does not serve `extra.profileModeCaps` reads UNKNOWN and falls closed here anyway.
     * What is left is the mask, and `fromAdapter` already computes PRESENT as `mask > 0`
     * — Slate's inner gate exactly.
     *
     * PRESENT ONLY. ABSENT and UNKNOWN both offer nothing, which is A3's whole sentence:
     * an unresolved machine is not a permissive one.
     *
     * THE TWO NARROW HINTS ARE PER-BIT, because they name one mode each. `powerExit`
     * carries Slate's own AND — `profileModesOffered && (caps & powerExit)` — because
     * `exit-sentence.js` takes it "already ANDed by the caller".
     *
     * READ ONCE, AT ATTACH, for the reason the ranges beside it give: the editor opens
     * from the selector, long after the boot's capability read has settled.
     */
    #readModes() {
        const answer = this.boot?.capabilities?.profileModes?.() ?? null;
        if (!answer || answer.capability !== CAPABILITY.PRESENT) {
            return Object.freeze({ pumpModes: false, hold: false, powerExit: false });
        }
        const offers = answer.value?.offers ?? null;
        return Object.freeze({
            pumpModes: true,
            hold: offers?.hold === true,
            powerExit: offers?.powerExit === true,
        });
    }

    /**
     * Does this screen mount its own editing surfaces? Only when nobody handed it any
     * AND there is something to edit. See the header: the three regions stay light-DOM
     * mount points and a caller who uses them keeps every measurement it had.
     */
    #owns(region) { return Boolean(this._draft) && this._callerRegions[region] !== true; }

    /**
     * WHICH REGIONS A CALLER FILLED. Read from the light DOM at connect and again on every
     * slot change, rather than from `slotchange` alone: a caller appends its children
     * before the element is inserted (the capture fixture) or writes them as markup (the
     * render harness), so the answer is already knowable at connect — and reading it there
     * means a fallback surface is never constructed for one frame and thrown away, which
     * for the overlay region would mean three native dialogs built and destroyed on every
     * mounting.
     */
    #noteCallerMounts() {
        const next = {};
        let moved = false;
        for (const region of EDITOR_REGIONS) {
            next[region] = this.querySelector(`:scope > [slot="${region}"]`) !== null;
            if (next[region] !== this._callerRegions[region]) moved = true;
        }
        if (moved) this._callerRegions = Object.freeze(next);
    }

    #onSlotChange = () => this.#noteCallerMounts();

    /**
     * THE REVIEW, AS DATA. `reviewStepSpec` is the port of the editor's own sentences and
     * the bounds ride on its segments, out of the one door — this file words nothing and
     * states no range (B2).
     *
     * THE SPLIT IS THE CALLER'S, which is `editor-review-panel.js:120`'s own rule: the
     * blocks are halved down the middle so both columns scroll rather than one.
     *
     * A REFUSAL IS CAUGHT AND REPORTED. `reviewStepSpec` throws on a pump mode it does not
     * recognise (A7 — it refuses rather than reading an unknown step as flow), and a throw
     * inside render() would blank the screen. The Review tab shows its empty columns and
     * the reason goes to the log.
     */
    #reviewFromDraft() {
        if (!this._draft || !this.#ranges) return null;
        const steps = Array.isArray(this._draft.steps) ? this._draft.steps : [];
        if (steps.length === 0) return null;
        const t = this.#i18n.t;
        try {
            const machineRanges = this.#ranges.machineRangesForReview();
            /* THE SENTENCE READS THE SAME CEILING THE STEPPER DOES, ON THE SAME MACHINE.
             * `reviewStepSpec` builds its own `num` segments out of `profile-modes.js`
             * because the wording lives with them, so it needs the machine class as an
             * argument — and it is taken from the DOOR, not from the capability store a
             * second time. Since 27 August 2026 two of the rows it prints are
             * machine-dependent (a flow step's target, a pressure step's flow limit), and
             * a Review tab saying "up to 15 mL/s" beside a grid stepper that reaches 20
             * would be a per-surface disagreement about one field — the exact defect the
             * one authoring table was created to end. */
            const machineClass = this.#ranges.machineClass();
            const blocks = steps.map((step, index) => ({
                id: `step-${index}`,
                heading: t('Step {n}', { n: index + 1 }),
                lines: reviewStepSpec(step, { machineRanges, machineClass }),
            }));
            const half = Math.ceil(blocks.length / 2);
            return [
                { id: 'a', blocks: blocks.slice(0, half) },
                { id: 'b', blocks: blocks.slice(half) },
            ];
        } catch (error) {
            this.#log('warn', `editor: the review could not be built — ${error?.message ?? error}`);
            return null;
        }
    }

    /** The four terms, worded through this screen's own `t()` and joined as Slate joins
     *  them. The numbers and which terms exist are `profile-totals.js`'s. */
    #totalsLine() {
        const t = this.#i18n.t;
        return profileTotalTerms(this._draft)
            .map((term) => t(term.text, term.params))
            .join(TOTALS_SEPARATOR);
    }

    render() {
        const t = this.#i18n.t;
        const tabs = EDITOR_TABS.map(({ value, label }) => ({ value, label: t(label) }));
        /* THE IDENTITY REPLACES THE HEADING, never sits beside it: #31 renders its own
         * <h1> from `heading` in the same region this block is slotted into, and two
         * titles in one flank is what a bare `heading` beside a name would be. With no
         * profile open the band is exactly what it was before this run. */
        const identity = this._draft !== null;
        const steps = this._draft && Array.isArray(this._draft.steps) ? this._draft.steps : null;

        return html`
            <ui-page-header
                id="band"
                heading=${identity ? '' : t('Profile editor')}
                commit
                change-count=${this.#count}
                @commit=${this.#onCommit}
                @cancel=${this.#onCancel}
                @change=${this.#onTabChange}
            >
                <!-- THE PROFILE'S IDENTITY (cmp-seh-3). One flex item in the lead
                     flank: the eyebrow the heading used to be, the name as a button, the
                     rename pencil beside it, and the ceilings. Absent until a profile is
                     open, because a name and four ceilings are things only a loaded
                     profile has. -->
                ${identity ? html`
                    <div id="identity" slot="lead">
                        <span id="eyebrow" class="ui-microcap">${t('Profile editor')}</span>
                        <div class="name-row">
                            <button
                                id="editor-title"
                                class="ui-title"
                                type="button"
                                @click=${this.#onRenameOpen}
                            >${this._draft.title || t('Untitled')}</button>
                            <ui-icon-button
                                id="title-pencil"
                                label=${t('Edit profile name')}
                                @click=${this.#onRenameOpen}
                                >${penIcon()}</ui-icon-button
                            >
                        </div>
                        <p id="totals" class="ui-caption ui-numeric">${this.#totalsLine()}</p>
                    </div>` : nothing}

                <!-- THE CENTRE TRACK IS THIS ELEMENT'S OWN WIDTH. No stretch: see
                     the header. The tablist is named, and #32 names its panels rather
                     than pointing at them, because an IDREF cannot cross a shadow
                     boundary. -->
                <!-- SLATE'S TABS (Ben, 25 August 2026: "I have changed my mind, make them
                     all caps same font size as slate, also make the button width match
                     slates"). ORACLE .slate-editor-tabs .slate-bank-item, measured on the
                     running skin: 142.7 x 80 each, padding 0 14px, 16px at weight 500,
                     letter-spacing 1.76px, uppercase. The three privates below carry
                     those; #3 owns the paint, so nothing here states a colour. -->
                <ui-tab-bar
                    slot="centre"
                    id="tabs"
                    .tabs=${tabs}
                    .value=${this.tab}
                    label=${t('Editor panels')}
                ></ui-tab-bar>

                <!-- PREVIOUS VERSIONS, BESIDE SAVE (Ben, 24 Aug 2026: "Can we add it to
                     the editor as well, could be useful to be able to undo a change etc.")
                     Slate has the same control in the same place (#editor-history-btn),
                     and it is shown only for a record with a lineage to have: a bundled
                     profile has none, and neither does a draft that has never been saved.
                     Restoring is NON-DESTRUCTIVE — see #onVersionPick. -->
                ${identity && this.#canBrowseVersions ? html`
                    <ui-icon-button
                        slot="trail"
                        id="versions-open"
                        size="lg"
                        label=${t('Previous versions')}
                        @click=${this.#onVersionsOpen}
                        >${historyIcon()}</ui-icon-button
                    >` : nothing}
            </ui-page-header>

            <editor-body id="body">
                <!-- THE MOUNT REGIONS' FALLBACK CONTENT (dec-A-B-1). The engine renders
                     what is inside a slot ONLY when nothing is assigned to it, so a
                     caller who mounts its own matrix, preview or overlay region gets
                     exactly what it always got and nothing below is created at all. The
                     app mounts none of the three, and this is where it gets them. -->
                <div id="steps" part="steps" slot="steps">
                    <slot name="steps" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('steps') ? html`<step-matrix
                            id="matrix"
                            editable
                            density="compact"
                            label=${t('Profile steps')}
                            ?pump-modes-offered=${this.#modes.pumpModes}
                            ?hold-offered=${this.#modes.hold}
                            ?power-exit-offered=${this.#modes.powerExit}
                            .ranges=${this.#ranges}
                            .steps=${steps}
                        ></step-matrix>` : nothing}
                    </slot>
                </div>

                <editor-settings-panel id="settings-panel" slot="settings">
                    <slot name="settings" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('settings') ? this.#settingsRows() : nothing}
                    </slot>
                </editor-settings-panel>

                <editor-review-panel
                    id="review-panel"
                    slot="review"
                    .columns=${this.reviewColumns ?? this.#reviewFromDraft()}
                >
                    <!-- THE PREVIEW CHART'S MOUNT REGION (row chart-preview). A slot
                         forwarding into the review panel's own "chart" slot; empty, it
                         is an auto row of zero height and every measurement of this
                         panel is what it was without it. -->
                    <slot name="preview" slot="chart" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('preview') ? html`<editor-preview
                            id="preview"
                            .profile=${this._draft}
                        ></editor-preview>` : nothing}
                    </slot>
                </editor-review-panel>
            </editor-body>

            <!-- THE VERSION LIST. A dialog rather than a menu: the rows are profile
                 titles with a date beside them, and a menu row is one line of text.
                 display:contents over a closed native dialog, so it adds no row to the
                 screen's two — the same shape every other overlay here has. -->
            <ui-dialog
                id="versions"
                heading=${t('Previous versions')}
                @close-request=${this.#onVersionsClose}
            >
                <div slot="body" class="versions">${this.#versionsBody()}</div>
            </ui-dialog>

            <!-- THE OVERLAY REGION (rows editor-dialogs, numpad-flows). It is not a
                 band: <editor-overlays> is display:contents over closed dialogs, so this
                 contributes no third row to the screen's two. -->
            <slot name="overlays" @slotchange=${this.#onSlotChange}>
                ${this.#owns('overlays') ? html`<editor-overlays
                    id="overlays"
                    .ranges=${this.#ranges}
                    .steps=${steps}
                    .source=${this}
                ></editor-overlays>` : nothing}
            </slot>

            <!-- THE RENAME (cmp-seh-3), AND IT IS ONE PIPELINE, NOT A SECOND. The pencil
                 and the title open this; its confirm is the RENAME gesture and goes
                 through the same commitPlan table the band's Save uses. It is a
                 ui-dialog over a CLOSED native dialog with a display:contents host, so
                 it takes no track in this screen's two-row grid — the same construction,
                 and the same reason, as the selector's own overlays. -->
            <ui-dialog id="discard-dialog" heading=${t('Discard your changes?')}>
                <div slot="body">
                    <p>${t('{count} changes will be lost.', { count: this.#count })}</p>
                </div>
                <div slot="actions">
                    <ui-button id="discard-cancel" @click=${this.#onDiscardCancel}
                        >${t('Keep editing')}</ui-button
                    >
                    <ui-button id="discard-confirm" variant="primary" @click=${this.#onDiscardConfirm}
                        >${t('Discard')}</ui-button
                    >
                </div>
            </ui-dialog>

            <ui-dialog id="rename-dialog" heading=${t('Edit profile name')}>
                <div slot="body">
                    <ui-text-field
                        id="rename-field"
                        label=${t('Profile name')}
                        ?invalid=${Boolean(this._renameRefusal)}
                        .value=${this._draft?.title ?? ''}
                    ></ui-text-field>
                    <!-- WHY THE RENAME DID NOT HAPPEN (F-050). The house refusal idiom —
                         a ui-caption paragraph with role=status, the same shape
                         settings-screen.js uses for its two — rendered AT THE FIELD,
                         because the dialog now stays open to hold it. NO BACKTICK HERE. -->
                    ${this._renameRefusal
                        ? html`<p id="rename-refusal" class="ui-caption" role="status"
                            >${t(this._renameRefusal)}</p>`
                        : nothing}
                </div>
                <div slot="actions">
                    <ui-button id="rename-cancel" @click=${this.#onRenameCancel}
                        >${t('Cancel')}</ui-button
                    >
                    <ui-button id="rename-save" variant="primary" @click=${this.#onRenameConfirm}
                        >${t('Save')}</ui-button
                    >
                </div>
            </ui-dialog>

            <!-- WHAT THE SERVER SAID. #22 is the skin's notice surface and it is
                 position: fixed, so it contributes no grid item either. A save that
                 reported nothing would be the silence dec-A-B-1 is about. -->
            <ui-toast id="notice"></ui-toast>
        `;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#wirePanels();
    }

    /**
     * Hand #32 the three panel elements. Built once and cached: the map's identity is
     * what Lit compares, so rebuilding it every update would re-run the bar's whole
     * adopt/release pass for no change.
     */
    #wirePanels() {
        const bar = this.renderRoot?.querySelector?.('#tabs');
        if (!bar || this.#panels) return;
        const map = new Map();
        for (const { value } of EDITOR_TABS) {
            const el = this.renderRoot.querySelector(`[slot="${value}"]`);
            if (el) map.set(value, el);
        }
        if (map.size !== EDITOR_TABS.length) return;
        this.#panels = map;
        bar.panels = map;
    }

    /**
     * #3's composed `change`, arriving through #32's shadow root. `detail.value` is the
     * tab's value; this screen writes it to `tab` and the bar reads it back. One owner
     * of the selection, and it is the reflected attribute.
     */
    #onTabChange(event) {
        const value = event?.detail?.value;
        if (typeof value !== 'string') return;
        this.tab = value;
    }

    /* ---------------------------------------------------------------------
     * THE STORE, THE DRAFT AND THE TWO GESTURES  (see the header)
     * ------------------------------------------------------------------- */

    /**
     * The store published. Mirror it, decide whether the DRAFT follows, and announce a
     * save exactly once.
     *
     * WHEN THE DRAFT FOLLOWS THE RECORD, and the rule is written as three cases because
     * the wrong answer to any of them silently loses somebody's work:
     *
     *   a NEW RECORD IS SEATED (a different id, or the first one) -> the draft is the
     *     record's profile. This is `open(record)` from the selector and `loadById` from
     *     a deep link.
     *   THE ANSWER TO A CONTENT SAVE -> the draft becomes the server's answer, because
     *     the whole draft is what was sent. If the server stored something other than
     *     what was asked for, the person sees THAT rather than a phantom unsaved count.
     *   THE ANSWER TO A RENAME -> the draft is KEPT and only the served title is taken.
     *     A rename is a label edit on the open record and must not discard unsaved step
     *     edits; those stay unsaved, and stay counted.
     */
    #onStoreState(state) {
        this._state = state;
        const record = state && state.record ? state.record : null;
        const served = record && typeof record === 'object' ? record.profile ?? null : null;

        /* THE RECORD IS COMPARED BY IDENTITY, NOT BY ID. Every publish carries a new state
         * object and the same record object until the record itself changes, so this is
         * "did the thing being edited change" asked exactly. Comparing ids instead would
         * treat two different profiles that happen to share an id as one — and on a
         * content-addressed server that is a real case, not a hypothetical. */
        if (!record) {
            this._draft = null;
        } else if (this.#pending === SAVE_OPERATION.IN_PLACE && this._draft && served) {
            this._draft = { ...this._draft, title: served.title };
        } else if (record !== this.#seatedFrom) {
            /* THE IDENTITY CHECK IS THE WHOLE RULE, the content-save answer included: the
             * store re-seats the server's answer as a NEW record object on SAVED and on
             * nothing else (`publishSaved` — the saving/failed/refused patches leave
             * `record` alone). A `#pending`-keyed reseed here would fire on the SAVING
             * publish too and wipe the draft at save START — so a failed or refused save
             * would silently discard the person's edits at the exact moment they need
             * them back to retry. Measured before the fix: edit 88 -> Save -> mock 501 ->
             * draft back at 83.5 and the band reading Close. */
            this._draft = served;
        }
        this.#seatedFrom = record;

        const status = state ? state.save : SAVE_STATUS.IDLE;
        if (status !== this.#announced) {
            this.#announced = status;
            if (status !== SAVE_STATUS.SAVING && status !== SAVE_STATUS.IDLE) {
                this.#pending = null;
                this.#announce(state);

                /* AND THE CLOSE HAPPENS HERE, ON THE OUTCOME — never on the press.
                 *
                 * Ben, 27 August 2026: "pressing save should close and arm, I shouldn't
                 * need to press save twice." The first pass at that closed in `#commit`,
                 * as soon as the write was in flight. It worked, and it quietly took the
                 * failure path with it: `<app-root>` unmounts this screen, the unmount
                 * runs `#unwatch`, and the store's outcome then arrives at nothing. The
                 * toast was not merely off-screen, it was never created — measured, the
                 * fixture's `notices()` came back null where it used to carry the
                 * sentence. So a REFUSED or FAILED save became silent AND took the draft
                 * down with the screen, which is a worse defect than the one being fixed:
                 * work that exists nowhere else, gone, with nothing said.
                 *
                 * Waiting for the outcome costs one round trip and keeps both halves.
                 * SAVED closes, which is what Ben asked for. FAILED and REFUSED stay put,
                 * with the draft intact and the server's own sentence on screen, which is
                 * what he would ask for if it happened to him. */
                if (status === SAVE_STATUS.SAVED && this.#closeOnSaved) {
                    this.#closeOnSaved = false;
                    this.#leave();
                } else if (status !== SAVE_STATUS.SAVED) {
                    this.#closeOnSaved = false;
                }
            }
        }
    }

    /* ---------------------------------------------------------------------
     * PREVIOUS VERSIONS — Ben, 24 August 2026
     * ------------------------------------------------------------------- */

    /**
     * Is there a lineage worth asking for?
     *
     * TWO RECORDS HAVE NONE and neither should be offered a control that can only ever
     * answer "no other versions": a draft that has never been saved has no id, and a
     * BUNDLED profile is a factory record whose history is the bundle. Slate makes the
     * same two checks in the same place — `editorState.sourceProfileId &&
     * !sourceProfileRecord?.isDefault` (profile_editor.js:3614).
     */
    /**
     * May this record's history be browsed?
     *
     * A SAVED RECORD AND A LIBRARY TO ASK. Nothing else — Ben, 25 August 2026: "The
     * profile history button is missing, can you add that from slate and make it work to
     * see past revisions."
     *
     * `isDefault !== true` USED TO BE PART OF THIS and it was the wrong question. A
     * bundled profile having no revisions of its own is an answer the VERSIONS LIST
     * gives; hiding the control makes it a question the user cannot ask. It is also not
     * reliably true: a bundled profile that has been edited and saved has a lineage like
     * any other, and the flag says nothing about that.
     *
     * THE DIALOG ALREADY REPORTS AN EMPTY HISTORY (`VERSIONS_STATUS`), so the honest
     * shape is a control that always opens and a list that says what it found.
     */
    get #canBrowseVersions() {
        const record = this._state?.record ?? null;
        return Boolean(record && record.id && this.boot?.library);
    }

    /**
     * ASK THE LIBRARY, NOT THE ROUTE.
     *
     * `getProfilesByIdLineage` has exactly one caller in this tree — the library store's
     * `versionsOf` — and the contract row names it. A second call site here would be a
     * second reading of the same answer, which is the shape this tree spends its comments
     * refusing. The library store is on the shell and the editor already holds it.
     */
    #onVersionsOpen = () => {
        const record = this._state?.record ?? null;
        const library = this.boot?.library;
        if (!record?.id || !library) return;
        this.#versionsWatch?.();
        this.#versionsWatch = library.subscribe(() => this.requestUpdate());
        Promise.resolve(library.versionsOf(record.id)).catch(() => {});
        this.renderRoot?.getElementById?.('versions')?.show({ reason: 'press' });
    };

    #onVersionsClose = () => {
        this.#versionsWatch?.();
        this.#versionsWatch = null;
        this.boot?.library?.clearVersions?.();
    };

    /** The library subscription this screen holds only while the version list is open. */
    #versionsWatch = null;

    /**
     * RESTORING IS NOT SAVING, and that is the whole reason this is useful as an undo.
     *
     * The chosen version's steps are loaded into the DRAFT and nothing is written. The
     * band goes dirty, Save mints a new version on top, and Cancel throws the restore
     * away like any other edit. Slate says the same thing in a toast — "Restored — Save
     * to keep this version".
     *
     * THE TITLE IS NOT TAKEN. Two versions of one profile usually share a title, and when
     * they do not, the name on screen is the one the person is editing under — silently
     * renaming their draft because they looked at an older version is a change they did
     * not ask for.
     *
     * KNOWN LIMITATION, RECORDED RATHER THAN PAPERED OVER (27 August 2026). The line above
     * states an INTENT that the SAVE cannot honour on this path, and the reason is
     * ReaPrime's, not this screen's. A record's id is hashed from its CONTENT only — steps
     * and the targets — and NOT from the title, which belongs to the metadata hash
     * (`profile_hash.dart calculateProfileHash` vs `calculateMetadataHash`). So saving a
     * restored version resolves to the stored record WHOLE, including the title it was
     * saved under, and the draft's title is discarded with the rest of it.
     *
     * IT NEEDS A RENAME TO BE REACHABLE AT ALL, because a rename is the only gesture that
     * moves a title without moving the content: it goes through `saveInPlace`, which is
     * id-stable for exactly this reason and therefore creates no version. So the sequence
     * is edit, save, rename, then restore across the rename — at which point the older
     * name comes back with the older steps.
     *
     * NOT FIXED HERE, DELIBERATELY. The fix is a third write on the restore path (an
     * id-stable PUT putting the draft's title back), and the restore path is the one place
     * where a failed write can leave a profile with no visible row — `settleToOneRow`
     * orders its two writes around precisely that hazard. Adding a third for a case that
     * needs a rename to reach is a poor trade, and a rename after the restore fixes it in
     * one gesture. Recorded so the next reader knows it was seen and weighed.
     */
    #onVersionPick = (event) => {
        const id = event.currentTarget.dataset.id;
        const versions = this.boot?.library?.get?.()?.versions;
        const record = (versions?.records ?? []).find((candidate) => candidate.id === id);
        const profile = record?.profile ?? null;
        if (!profile || !this._draft) return;
        this._draft = { ...profile, title: this._draft.title };
        this.renderRoot?.getElementById?.('versions')?.hide('restored');
        this.#onVersionsClose();
    };

    /* ---------------------------------------------------------------------
     * THE SETTINGS PANEL'S FIELDS  (audit F-031)
     * ------------------------------------------------------------------- */

    /**
     * ONE PROFILE-SCALAR KEY MOVED. The same shape as `#onEdit`, one level up: the control
     * announces, this decides, the draft is the screen's.
     *
     * IT IS NOT `applyStepValue`. That module's whole subject is a STEP — its three special
     * keys are `limiter`, `pump` and `exit`, and `withStep` refuses anything without an
     * index. These are the profile's own scalars, one level above the step list, and every
     * one of them is a plain assignment with no rule attached. Giving `editor-draft.js` a
     * second door for "write a top-level key" would be a door with no rules behind it.
     *
     * THE KEYS ARE `changeCountOf`'s OWN. All six below are in its `PROFILE_SCALAR_KEYS`,
     * so a field edited here is counted, named in the header's change line and in the
     * version dialog's "what changed", and carried by the next save as part of the whole
     * draft — no separate write path, no second request.
     */
    #onFieldChange(key, value) {
        if (!this._draft) return;
        this._draft = { ...this._draft, [key]: value };
    }

    /** `ui-text-field`'s composed `change`, as the key it belongs to. */
    #onTextField = (event) => {
        const key = event.currentTarget?.dataset?.profileKey;
        if (!key) return;
        event.stopPropagation();
        this.#onFieldChange(key, event.currentTarget.value ?? '');
    };

    /**
     * THE PREINFUSION MARKER, as `editor-draft.js` spells it: 1-BASED, with 0 meaning None.
     *
     * `<ui-select>` carries strings, so the value is parsed back to the integer the
     * profile document holds. A value the list could not have offered writes nothing.
     */
    #onCountFrom = (event) => {
        event.stopPropagation();
        const raw = Number(event.detail?.value ?? event.currentTarget?.value);
        if (!Number.isInteger(raw) || raw < 0) return;
        this.#onFieldChange('target_volume_count_start', raw);
    };

    /**
     * THE SETTINGS TAB'S REAL FIELDS — audit F-031, six intents and one fault.
     *
     * WHAT WAS THERE. `editor-screen` rendered
     * `<editor-settings-panel slot="settings"><slot name="settings"></slot></editor-settings-panel>`
     * **with no fallback content**, and `app-root` mounts `<editor-screen>` with no
     * light-DOM children — so in the shipped app the panel's slot had ZERO assigned
     * elements and there was nothing on the glass to press. The rows a person could see on
     * the screens page came from `test/fixtures/editor-shell-fixture.js`, hand-built
     * `<div slot="settings">` items carrying literals ("Gentle and sweet", "Ben", "20 °C",
     * "step 1"), bound to nothing: typing into one left the draft and the change count
     * unmoved and put no request on the wire. A profile's name, author, beverage, notes and
     * library visibility could not be edited from this screen at all.
     *
     * THEY ARE FALLBACK CONTENT INSIDE THE SLOT, which is this file's own established
     * pattern for the other three regions (see "THE MOUNT REGIONS' FALLBACK CONTENT"): the
     * engine renders it only when nothing is assigned, so the harness, the capture fixture
     * and every render suite that mounts its own rows get exactly what they always got.
     * `#owns('settings')` is the same per-region answer the matrix and the preview take.
     *
     * AND THEY ARE COMPOSED HERE RATHER THAN IN THE PANEL, which is the panel's own rule
     * rather than a convenience: `editor-settings-panel.js`'s header states that it "owns
     * four things and no fifth — the three tracks, the two collapses, the scroll region and
     * the floor", authors "no field, no label, no control and NO RANGE", and takes its rows
     * as light-DOM children. This screen is where the draft, the translator and the ranges
     * door already are. Composing the fields inside the panel would have made it a screen.
     *
     * NO BOUND IS WRITTEN, and the two fields that would want one are the reason the shape
     * is what it is. Both are in `editor-ranges.js UNRANGED_EDITOR_FIELDS`, refused BY NAME
     * with a reason, and `rangeFor` throws for them rather than defaulting — so neither may
     * be a stepper:
     *
     *   `tankTemperature`         — the profile's own `tank_temperature`, the value that
     *                               does the clobbering every `_sendProfile` performs. A
     *                               plain entry, with the door's own reason as a caption,
     *                               is what "render it unbounded, or unavailable, and say
     *                               why" asks for.
     *   `targetVolumeCountStart`  — "an INDEX into the profile's own step list, not a
     *                               measured quantity. Its bound is steps.length, which is
     *                               content the editor already holds." So it is #7 over the
     *                               steps in the draft — the bound IS the list, and there is
     *                               no table to disagree with.
     *
     * THE SEVENTH ROW IS A RECORD PROPERTY, NOT A PROFILE KEY (D20, 30 August 2026).
     * "Hidden from the library" (L0005) is the RECORD's `visibility`, so it is not in the
     * draft, is not counted by `changeCountOf`, and does not travel on a save. It carries
     * its own request, sent when the switch is pressed, through the store's public
     * `setVisibility()`. `#hiddenSwitchRow` composes it and `#libraryFace` states what it
     * is showing; the argument for the immediate write, rather than a staged one, is at
     * `#onHiddenSwitch`.
     *
     * THE EIGHTH CONTROL IS PARKED, AND THE EVIDENCE IS WHY. "Machine default" (L0006)
     * was taken to be the record's `isDefault`. At the pin `2b047d02` that flag has NO
     * ROUTE — `lib/src/services/webserver/` never names it, `rest_v1.yml` never lists it,
     * and `_handleUpdate` accepts only `profile` and `metadata` — and it does not mean
     * what the label says: it marks a BUNDLED profile shipped in `assets/defaultProfiles/`
     * and acts as a guard (such a record refuses content updates, refuses a purge, and
     * cannot be soft-deleted). L0006's own intent line is "the machine comes up on this
     * profile rather than whatever was loaded last", which is a different thing again, and
     * that entry is marked `A-WHY no-clue` with two readings still open. Nothing here
     * writes it. See the fix log entry RB-2 and the morning report.
     */
    #settingsRows() {
        const draft = this._draft;
        if (!draft) return nothing;
        const t = this.#i18n.t;
        const text = (key, label) => html`
            <div class="field">
                <ui-text-field
                    id=${`field-${key}`}
                    data-profile-key=${key}
                    label=${t(label)}
                    .value=${draft[key] ?? ''}
                    @change=${this.#onTextField}
                ></ui-text-field>
            </div>`;

        /* THE MARKER'S CHOICES ARE THE DRAFT'S OWN STEPS. 0 is None, and 1-based after
         * that — `editor-draft.js VOLUME_COUNT_KEY`'s rule, read from where it is written
         * rather than restated. A step with no name reads as its ordinal, which is what the
         * matrix's head cell draws for the same step. */
        const steps = Array.isArray(draft.steps) ? draft.steps : [];
        const choices = [
            { value: '0', label: t('None') },
            ...steps.map((step, i) => ({
                value: String(i + 1),
                label: step?.name || t('Step {n}', { n: i + 1 }),
            })),
        ];
        const marker = Number.isInteger(draft.target_volume_count_start)
            ? draft.target_volume_count_start : 0;

        return html`
            ${text('title', 'Profile name')}
            ${text('author', 'Author')}
            ${text('beverage_type', 'Beverage')}
            ${text('notes', 'Notes')}

            <div class="field">
                <ui-text-field
                    id="field-tank-temperature"
                    data-profile-key="tank_temperature"
                    label=${t('Tank temperature')}
                    .value=${draft.tank_temperature ?? ''}
                    @change=${this.#onTankTemperature}
                ></ui-text-field>
                <!-- THE CAPTION IS THE DOOR'S OWN REASON, shortened to a sentence a
                     barista can act on. editor-ranges.js refuses this field a range
                     because every profile load ends in a tankTemp MMR write, so the
                     machine takes this number from the profile whatever a control set.
                     NO BACKTICK IN THIS COMMENT. -->
                <span class="ui-caption"
                    >${t('The machine takes this from the profile each time it loads.')}</span
                >
            </div>

            <div class="field">
                <ui-select
                    id="field-count-from"
                    label=${t('Count volume from')}
                    .options=${choices}
                    .value=${String(marker)}
                    @change=${this.#onCountFrom}
                ></ui-select>
                <span class="ui-caption"
                    >${t('Volume exits ignore everything poured before this step.')}</span
                >
            </div>

            ${this.#hiddenSwitchRow()}
        `;
    }

    /**
     * "HIDDEN FROM THE LIBRARY" (L0005) — D20, and the seventh row on this panel.
     *
     * THE NAME IS THE VISIBLE WORD, pointed at rather than copied. #5 ui-switch draws no
     * label and takes its accessible name from the light DOM, so `aria-labelledby` on the
     * one span means the announced name and the printed name cannot drift apart. Both
     * elements are in THIS shadow root — the rows are the settings slot's fallback
     * content, so they never leave it — and an IDREF resolves inside its own tree.
     *
     * THE CAPTION IS A LIVE REGION because it is the only place the OUTCOME of the press
     * is said: `role="status"` is polite, so it is announced after the gesture rather than
     * interrupting it. Every one of its five sentences is `#libraryFace`'s.
     */
    #hiddenSwitchRow() {
        const t = this.#i18n.t;
        const face = this.#libraryFace;
        return html`
            <div class="field">
                <div class="switch-line">
                    <span id="field-hidden-label" class="ui-body"
                        >${t('Hidden from the library')}</span
                    >
                    <ui-switch
                        id="field-hidden"
                        aria-labelledby="field-hidden-label"
                        data-face=${face.state}
                        .checked=${face.checked}
                        ?disabled=${face.disabled}
                        @change=${this.#onHiddenSwitch}
                    ></ui-switch>
                </div>
                <span class="ui-caption" role="status">${face.caption}</span>
            </div>`;
    }

    /**
     * WHAT THE "HIDDEN FROM THE LIBRARY" SWITCH IS SHOWING, as one object (D20).
     *
     * FIVE FACES, and every one of them is a state the record or the write is really in.
     * Nothing here predicts: the switch asserts only a visibility the SERVER has stated,
     * which is why the toggle disables itself while a write is in flight instead of
     * flipping and hoping.
     *
     *   unseated  — a draft that has never been saved has no record id to address, so
     *               there is nothing to hide FROM the library: it is not in it. The
     *               control is unavailable and the caption says why (A7 — "render it
     *               unavailable and say why", never a plausible default).
     *   writing   — the request is on the wire. Disabled, and the caption says so.
     *   failed    — the caption carries the SERVER's own sentence verbatim when there is
     *               one (#49: this screen takes a message, it does not know the message)
     *               and the screen's own words when there is not. The switch snaps back,
     *               because nothing changed.
     *   unknown   — the record's visibility is a spelling this build does not have a
     *               switch position for (`deleted`, or a fourth state ReaPrime grows).
     *               A7 again: `profileVisibilityOf` returns exactly what the server said,
     *               so the honest answer is an unavailable control naming the state
     *               rather than a switch that silently reads it as "not hidden".
     *   settled   — visible or hidden, said plainly.
     *
     * THE SLICE WINS OVER THE RECORD, and only for the reason the store gives: a
     * visibility write deliberately does not re-publish `record` (that would re-seat the
     * draft and discard unsaved step edits), so `visibility.value` is the newer of the two
     * answers whenever there is one.
     */
    get #libraryFace() {
        const t = this.#i18n.t;
        const state = this._state ?? null;
        const write = state?.visibility ?? null;
        const record = this.#record;
        const seated = Boolean(record && record.id);

        if (!seated) {
            return {
                state: 'unseated',
                checked: false,
                disabled: true,
                caption: t('Save this profile first — the library has nothing to hide yet.'),
            };
        }

        const shown = write?.value ?? profileVisibilityOf(record);
        const hidden = shown === PROFILE_VISIBILITY.HIDDEN;

        if (write?.status === VISIBILITY_WRITE.WRITING) {
            return {
                state: 'writing',
                checked: hidden,
                disabled: true,
                caption: write.wanted === PROFILE_VISIBILITY.HIDDEN
                    ? t('Hiding it…') : t('Showing it again…'),
            };
        }
        if (write?.status === VISIBILITY_WRITE.FAILED) {
            /* THE SERVER'S WORD, VERBATIM. `profileRefusal` reads a typed 400 into
             * {kind, error, message}; a fault has no sentence of its own, so the screen
             * writes that one. Same split as `#announce`. */
            const said = write.refusal?.message || write.refusal?.error || null;
            return {
                state: 'failed',
                checked: hidden,
                disabled: false,
                caption: said
                    ? t('The library was not changed. {reason}', { reason: said })
                    : t('The library could not be changed. Try again.'),
            };
        }
        if (shown !== PROFILE_VISIBILITY.VISIBLE && shown !== PROFILE_VISIBILITY.HIDDEN) {
            return {
                state: 'unknown',
                checked: false,
                disabled: true,
                caption: shown
                    ? t('This profile is {state}, which this switch cannot change.', { state: shown })
                    : t('The library has not said whether this profile is listed.'),
            };
        }
        return {
            state: 'settled',
            checked: hidden,
            disabled: false,
            caption: hidden
                ? t('The library is not listing this profile.')
                : t('The library lists this profile.'),
        };
    }

    /**
     * THE SWITCH'S OWN REQUEST, sent the moment it is pressed (D20).
     *
     * IT IS NOT A DRAFT CHANGE AND IT IS NOT PART OF A SAVE, and the reason is the save's
     * own shape rather than a preference. A content save is `saveAsNewVersion` — a POST
     * that MINTS A NEW RECORD with a new id — and the store's `settleToOneRow` then makes
     * that new record VISIBLE on purpose (it is the restore path's un-hide). So a
     * "hidden" flag staged for the save would be applied either to a record about to be
     * superseded, or against a step the save performs by design. And on a draft that has
     * never been saved there is no id to address at all. The gesture that CAN be honest is
     * the immediate one: the record exists, the write names it, and the answer says what
     * happened.
     *
     * NOTHING IS PREDICTED. The press does not flip the switch; it starts a request, and
     * the switch re-reads whatever the server then says it is. See `#libraryFace`.
     */
    #onHiddenSwitch = (event) => {
        event.stopPropagation();
        const wanted = event.detail?.checked === true
            ? PROFILE_VISIBILITY.HIDDEN
            : PROFILE_VISIBILITY.VISIBLE;

        /* PUT THE CONTROL BACK WHERE IT WAS, IMMEDIATELY — the one line that makes "the
         * switch asserts only what the server said" true rather than merely intended.
         *
         * `ui-switch` is a real control: its own press handler flips `checked` and THEN
         * dispatches, so by the time this runs the switch is already showing a state
         * nobody has confirmed — and `role="switch"` means it has announced it too.
         * Re-rendering does not undo that: Lit dirty-checks a property binding against the
         * value it last committed, and that value has not changed, so the flip would
         * simply stand. Writing it back here is the force-the-write idiom, and the next
         * render's face (`writing`, then whatever the server says) is what moves it.
         *
         * The failure path is why it matters: a write that is refused must leave the glass
         * saying exactly what the library says, with no trace of the press. */
        const control = event.currentTarget ?? this.renderRoot?.querySelector?.('#field-hidden');
        if (control) control.checked = this.#libraryFace.checked;

        if (!this.#store) return;
        /* STARTED, NOT AWAITED — the same rule as `#commit`. The store records the ending
         * as publishable state and `#libraryFace` words it; an awaited write in an event
         * handler is a promise nobody catches. */
        this.#store.setVisibility(wanted);
    };

    /**
     * The tank temperature is the one text field carrying a NUMBER, so it is parsed here
     * rather than written as the string the control holds — `tank_temperature` is one of
     * the seven inputs to ReaPrime's content hash and a string where a number belongs
     * changes what the server stores. An unparseable entry writes nothing and leaves the
     * draft as it was; the field keeps what was typed until the draft repaints it.
     */
    #onTankTemperature = (event) => {
        event.stopPropagation();
        const raw = String(event.currentTarget?.value ?? '').trim();
        if (raw === '') return;
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        this.#onFieldChange('tank_temperature', value);
    };

    /**
     * The list, or the sentence that says why there is none.
     *
     * A ONE-ENTRY LINEAGE IS "NO OTHER VERSIONS": `getLineage` always includes the profile
     * itself, so the 200 body is never empty and a list of one is the empty answer. The
     * selector's own dialog reads it the same way, and this is the second reader of one
     * store rather than a second store.
     */
    #versionsBody() {
        const t = this.#i18n.t;
        const state = this.boot?.library?.get?.()?.versions ?? null;
        const status = state?.status ?? VERSIONS_STATUS.IDLE;
        /* THE SENTENCES BREAK OVER TWO LINES on purpose. Gate D reads any interpolated
         * template holding a slash and no newline as a hand-built PATH, and `</p>` is a
         * slash — the rest of this tree's templates are multi-line and never trip it. */
        if (status === VERSIONS_STATUS.LOADING) {
            return html`<p
                >${t('Reading versions…')}</p
            >`;
        }
        if (status === VERSIONS_STATUS.FAILED) {
            return html`<p
                >${t('The versions could not be read.')}</p
            >`;
        }
        const here = this._state?.record?.id ?? null;
        const others = (state?.records ?? []).filter((record) => record.id !== here);
        if (status !== VERSIONS_STATUS.READY || others.length === 0) {
            return html`<p
                >${t('This profile has no other versions.')}</p
            >`;
        }
        return others.map((record) => {
            /* THE DATE IS WHAT TELLS TWO VERSIONS APART, because they usually share a
             * title — that is what a version IS. `shotClock` is the one formatter in this
             * tree that owns a date, and its `dateSummary` is the spelling for a list that
             * spans more than a morning. An unparseable timestamp answers `ok: false` and
             * the row is then the title alone rather than the word "Invalid Date". */
            const when = shotClock(record.updatedAt ?? record.createdAt);
            const title = record.profile?.title || t('Untitled');
            const stamp = when.ok ? `${title} · ${when.dateSummary} ${when.time}` : title;
            /* AND WHAT CHANGED TELLS THEM APART WHEN THE DATE CANNOT — two saves a minute
             * apart carry the same title and nearly the same time, and "24 Aug 14:32" does
             * not tell anybody which one to go back to. See `#versionChangeLine`. */
            const changed = this.#versionChangeLine(record, state?.records ?? []);
            /* AUDIT F-016 ROW 2 WAS CHECKED HERE ON 29 AUGUST 2026 AND IS NOT A DEFECT.
             *
             * The inventory lists this control — the version record's button — as having
             * an accessible name of the empty string, and it is the only editor row in
             * F-016 that is not a chart well. It was measured `via: "source"`: the ledger
             * entry was derived by READING, not from a live element, and U3's own record
             * for the dialog above it says "SCROLL-FAULT: zero-size box — not on screen",
             * so the versions dialog was never opened in that capture and there was
             * nothing there to name.
             *
             * Driven live, the name is present and correct by both readers.
             * `test/render/editor-versions-name.render.test.mjs` reads Chrome's own
             * accessibility tree; the ledger's own cascade, re-run against a shown dialog,
             * agrees — its `textAll` walks `<slot>` through `assignedNodes({flatten: true})`
             * and reaches the row's text inside #6's shadow root, answering
             * `source: "text"` rather than `"none"`.
             *
             * NO `label` WAS ADDED, and that is the decision rather than an omission. It
             * would be a SECOND copy of the sentence the row already draws, kept in sync by
             * nothing but adjacency, and #6's own doc reserves `label` for "a glyph slot" —
             * a control whose face carries no words. This one's face is its name.
             *
             * The name is nonetheless PINNED by that suite, because "the row is named" and
             * "no two rows announce the same sentence" are properties worth keeping: two
             * versions of a profile share a title by nature, so the date is the whole
             * discriminator. */
            /* NAMED `rowName` AND NOT `name`, WHICH IS NOT FUSSINESS. `gate-wire` resolves
             * `addEventListener(name, …)` — the loop over `EDITOR_EDIT` in
             * `connectedCallback` — by looking up the identifier's binding in this file. A
             * second `const name` here made it refuse to guess, and FIVE live editing
             * wires (`step-change`, `value-commit`, `exit-condition-change`,
             * `lever-change`, `exit-remove`) were reported dead in one run. Measured
             * 29 Aug 2026: gate-wire 7 -> 11 dead + 1 unresolved, back to 7 on the rename. */
            const rowName = changed ? `${stamp} — ${changed}` : stamp;
            return html`
                <ui-button
                    data-id=${record.id}
                    @click=${this.#onVersionPick}
                    >${rowName}</ui-button
                >`;
        });
    }

    /**
     * WHAT THIS VERSION CHANGED — Ben, 27 August 2026.
     *
     * "I fill the best would be a diff of the new and old and changes recoreded not full
     * profiles and we can walk back like GitHub does it I assume. But I dont know how much
     * work that is to implement."
     *
     * THE DIFF IS SHOWN AND NOT STORED, and that is the one place this parts company with
     * the shape Ben floated. ReaPrime already stores whole records and owns that model, so
     * a delta persisted beside them would be a second copy of one history, free to
     * disagree with it — and it would need a migration, a writer, and a reader, none of
     * which the skin has any business owning. Computing it costs one comparison of two
     * profiles this dialog is ALREADY HOLDING: `versionsOf` fetched the whole lineage, so
     * every version and its parent are in the same array. Nothing is fetched for this line
     * and nothing is written. That is why it was cheap.
     *
     * THE COMPARISON IS THE SAVE BAND'S OWN. `changeGroupsOf` is what "Save (N)" counts,
     * reached through `versionChangeFacts`, so the number of changes this line describes
     * and the number the button showed before the save are the same number by
     * construction. Two answers to one question is the defect this tree keeps naming.
     *
     * A FIELD LIST IS NOT A SENTENCE, so the groups are worded rather than printed. "Steps
     * 1 and 3, target weight" is what a person can act on; `['steps[0]', 'steps[2]',
     * 'target_weight']` is what a developer can act on, and it belongs in the log.
     *
     * A7 — THE ROOT SAYS "original", NOT "no changes". The first version of a profile has
     * no parent to be compared against, and `versionChangeFacts` answers `known: false`
     * for it. "No changes" would be a claim about a comparison that never happened; the
     * root genuinely is the original, and saying so is both true and useful.
     */
    #versionChangeLine(record, records) {
        const t = this.#i18n.t;
        const parent = parentRecordOf(record, records);
        const facts = versionChangeFacts(record, parent);
        if (!facts.known) {
            /* NO PARENT AT ALL is the root of the chain. A record whose parent is simply
             * missing from the lineage cannot occur — `getLineage` walks UP to the root
             * before it walks down — so this is the root and nothing else. */
            return lineageFactsOf(record).hasParent ? null : t('original');
        }

        const parts = [];
        if (facts.wholesale) parts.push(t('the steps'));
        if (facts.changed.length === 1) {
            parts.push(t('step {n}', { n: facts.changed[0] + 1 }));
        } else if (facts.changed.length > 1) {
            /* ONE-BASED, because the person is reading a step number off the matrix in
             * front of them and that matrix counts from 1. The indexes are zero-based
             * everywhere they are computed and are converted at the one point where they
             * become words. */
            parts.push(t('steps {list}', { list: facts.changed.map((i) => i + 1).join(', ') }));
        }
        if (facts.added.length) {
            parts.push(facts.added.length === 1
                ? t('1 step added')
                : t('{count} steps added', { count: facts.added.length }));
        }
        if (facts.removed.length) {
            parts.push(facts.removed.length === 1
                ? t('1 step removed')
                : t('{count} steps removed', { count: facts.removed.length }));
        }
        for (const key of facts.scalars) {
            /* AN UNKNOWN KEY IS NAMED, NOT DROPPED (A7). `PROFILE_SCALAR_KEYS` can grow —
             * ReaPrime's Profile model is not this skin's to freeze — and a change the user
             * really made must not vanish from the line because nobody has written a word
             * for it yet. The raw key is worse English and better than a lie. */
            parts.push(VERSION_FIELD_WORDS[key] ? t(VERSION_FIELD_WORDS[key]) : key);
        }

        if (parts.length === 0) {
            /* COMPARED, AND NOTHING MOVED. Reachable: `create` is content-addressed over
             * the STEPS and the targets, and the title is NOT among them
             * (`profile_hash.dart` splits profileHash from metadataHash), so two records
             * can share a chain and differ in nothing this comparison counts. Saying
             * "no changes" here is a real, measured answer — unlike the `known: false`
             * case above, where no comparison happened at all. */
            return t('no changes');
        }
        /* THREE THINGS AND A COUNT. A version that moved nine fields produces a line
         * longer than the dialog is wide, and a row that wraps to three lines is harder to
         * scan than one that says "+6 more".
         *
         * STEPS FIRST, WHICH IS NOT `changeCountOf`'s ORDER and is deliberate. That
         * function lists scalars first because its output is a developer's field list;
         * this is a person deciding which version to go back to, and what they changed is
         * almost always a step. The truncation therefore keeps the steps and drops the
         * fields, rather than the other way round. */
        if (parts.length > 3) {
            return `${parts.slice(0, 3).join(', ')}, ${t('+{count} more', { count: parts.length - 3 })}`;
        }
        return parts.join(', ');
    }

    /** An editing event arrived. `editor-draft.js` holds every rule; this is the wire. */
    #onEdit = (event) => {
        /* NOTHING IS OPEN — a bare mounting, or a harness stage that owns its own draft.
         * The event is left alone for whoever else is listening. */
        if (!this._draft) return;
        const result = applyEditorEdit(this._draft, event.type, event.detail ?? {});
        if (result.applied) this._draft = result.draft;
        else this.#log('warn', `editor: an edit was not applied — ${result.reason}`);
    };

    /**
     * ONE OF THE FIVE KEYS UNDER A STEP COLUMN WAS PRESSED — move-left, delete,
     * insert-after, duplicate, move-right.
     *
     * THIS LISTENER DID NOT EXIST UNTIL 27 AUGUST 2026, and that is the whole of the bug.
     * Ben: "IN the profile editor page, the 5 buttons down the bottom dont seem to do
     * anything, like if I try to make a new step of copy one etc it does noting." The rail
     * dispatched `step-action` correctly, composed and bubbling, carrying {action, index,
     * count}; `step-matrix.js` mounted one per column and its own comment said the event
     * "crosses this boundary as it is"; and the string `step-action` appeared nowhere else
     * in `src/` except that comment. It went green for a whole wave because the rail's
     * suite drives the rail in isolation, where an unheard event is the correct outcome.
     *
     * IT IS THE SAME SHAPE AS `#onEdit` ON PURPOSE. The matrix announces, the screen
     * decides, the draft is the screen's — the contract every surface under this one states
     * in its own header — and every rule about what the press MEANS is in
     * `editor-draft.js`, where node can reach it. Nothing here is a second mechanism beside
     * `step-change`; it is the same mechanism with the fifth event on it.
     *
     * THE ONE THING THIS DOES THAT `#onEdit` DOES NOT IS PUT THE CARET BACK. A structural
     * edit re-renders the matrix and Lit reuses the DOM, so the button that was just pressed
     * now belongs to whichever step was displaced into that column: without this, a second
     * press on the same key moves a different step, and after a delete the caret falls out
     * to <body> with nothing to say where it went. `applyStepAction` answers WHERE THE
     * PERSON NOW IS, and the matrix is asked to focus the same key on that step.
     *
     * THE MATRIX IS FOUND ON THE EVENT'S OWN PATH, not by reaching for a known id. Four
     * callers mount their own `<step-matrix slot="steps">` (the harness, the capture
     * fixture, two render suites) and this screen mounts its own only when nobody handed it
     * one — so `#matrix` is not always this screen's element. `composedPath()` names the
     * element the press actually came through, and it is read DURING dispatch because that
     * is the only time it is populated.
     *
     * A REFUSAL IS LOGGED AND NOTHING MOVES, which is `editor-draft.js`'s own rule ("a
     * silent no-op cannot hide a wiring mistake") and is reachable in exactly two ways
     * today: a race between the rail's `count` and the draft's real length, and a delete on
     * the last remaining step. The second is not a surprise — the rail greys that key — and
     * this is the second line of defence behind it.
     */
    #onStepAction = (event) => {
        if (!this._draft) return;
        const detail = event.detail ?? {};
        const matrix = typeof event.composedPath === 'function'
            ? event.composedPath().find((node) => node?.localName === 'step-matrix') ?? null
            : null;

        const result = applyStepAction(this._draft, detail, {
            /* D2, and the reason `NEW_STEP_NAME_KEY` is a key rather than text: the seed
             * lives in a DOM-free module with no translator, so the word is made here. */
            stepName: this.#i18n.t(NEW_STEP_NAME_KEY),
        });
        if (!result.applied) {
            this.#log('warn', `editor: a step action was not applied — ${result.reason}`);
            return;
        }
        this._draft = result.draft;

        /* AFTER THE RENDER, NEVER BEFORE IT — and it takes BOTH awaits, which is worth
         * saying plainly. `this.updateComplete` only settles this element's own update;
         * Lit does NOT await a child component's, so at that point the matrix has been
         * handed its new `steps` and has not yet rebuilt its columns. The key to focus is
         * in a column that does not exist yet. `matrix.updateComplete` is the second half,
         * and it is the one that makes the reach legal. */
        this.updateComplete
            .then(() => matrix?.updateComplete ?? null)
            .then(() => matrix?.focusStepKey?.(result.index, detail.action))
            /* REPORTED, NOT SWALLOWED (A7). `focusStepKey` cannot throw — it answers false
             * for a key that is now disabled — so the only way here is an update that threw,
             * which is worth a line in the log rather than a silent no-op. The edit itself
             * has already landed either way; nothing is retried. */
            .catch((error) => this.#log('warn',
                `editor: the caret could not be put back — ${error?.message ?? error}`));
    };

    /**
     * A DOOR DECLINED TO OPEN, AND NOW A PERSON HEARS IT — audit F-008.
     *
     * `editor-overlays.js #refuse` has always dispatched `numpad-refused` carrying the
     * door's own sentence, and the gate found it heard NOWHERE in `src/`. The one listener
     * in the tree was `test/harness/editor.js:949`, which records it for assertions and is
     * not loaded by `index.html` — a wire only a test can hear, which is the audit's kind-1
     * fault exactly. So the outcome was real (the pad correctly opened nothing) and the
     * report reached nobody: a person pressed a value and the screen sat still.
     *
     * IT LANDS ON THE SCREEN'S EXISTING NOTICE SURFACE, `#22`, the same one every save
     * outcome is worded through. Nothing new is composed for it.
     *
     * THE REASON IS PRINTED VERBATIM AND IS NOT TRANSLATED, which is this screen's own
     * settled rule for a sentence it did not write: `#announce` prints the SERVER's refusal
     * word for word (#49 — "takes a message, it does not know the message"), and this is
     * the RANGES DOOR's refusal, produced by the same kind of authority. `editor-ranges.js`
     * writes those sentences deliberately long because they are aimed at whoever wired the
     * field; paraphrasing one here would be a second, shorter, drifting copy. The LEAD is
     * translated, because that half is this screen's own sentence.
     *
     * IT IS ALSO LOGGED, for the same reason `#nothingToSave` logs its plan reason: a bench
     * session wants the address (`field`, `index`, `row`) that no toast should carry.
     */
    #onNumpadRefused = (event) => {
        const detail = event.detail ?? {};
        const reason = typeof detail.reason === 'string' ? detail.reason : '';
        const where = [detail.field, detail.row, detail.slot].filter(Boolean).join('/');
        this.#log('warn', `editor: a numpad open was refused${where ? ` (${where})` : ''} — ${reason}`);

        const toast = this.renderRoot?.querySelector?.('#notice');
        if (!toast || typeof toast.show !== 'function') return;
        const t = this.#i18n.t;
        toast.show(
            reason
                ? t('That value cannot be edited here. {reason}', { reason })
                : t('That value cannot be edited here.'),
            { tone: 'warn' },
        );
    };

    /** The shell's logger, when there is one. A screen mounted without a boot is silent. */
    #log(level, message) {
        const logger = this.boot?.logger ?? null;
        if (logger && typeof logger[level] === 'function') logger[level](message);
    }

    /**
     * D11's dirty state, WHOLE — the store's answer when there is one, the property when
     * there is not.
     *
     * THE `tell` IS THE HALF THAT USED TO BE DROPPED HERE, and dropping it is what let a
     * Save close over somebody's work. `changeCountOf` reports `{count, clean, tell,
     * fields}` and this getter used to end in `.count`, which flattens "there are no
     * changes" and "I could not compare these two objects" into the same 0. `#commit`
     * then handed that 0 to `commitPlan` as `dirty: false`, and at `dirty: false` a Save
     * means LEAVE. See `editor-commit.js commitPlan`, the CANNOT TELL IS NOT CLEAN block,
     * for the whole argument; the code change that matters is that both fields now cross
     * the boundary and the decision is made where the words for it are.
     *
     * THE PROPERTY FALLBACK COUNTS AS COMPARED, deliberately. `change-count` is an
     * attribute a CALLER set — the gallery, the harness, a composition root above this
     * screen — and a number somebody authored is an answer, not an absence. Calling it
     * cannot-tell would make a screen mounted without a boot try to save through a store
     * it does not have.
     */
    get #change() {
        if (this.#store && this._draft) return this.#store.changeCount(this._draft);
        const count = Number.isFinite(this.changeCount) ? this.changeCount : 0;
        return { count, clean: count === 0, tell: CHANGE_TELL.COMPARED, fields: [] };
    }

    /** D11's count alone — what the band renders and what the discard question counts. */
    get #count() { return this.#change.count; }

    /** The record the editor has open, or null. */
    get #record() { return this._state?.record ?? null; }

    /**
     * ONE GESTURE, ROUTED. `commitPlan` decides; this performs and reports.
     *
     * The save is STARTED, NOT AWAITED, and the outcome arrives as store state: an
     * awaited save in an event handler is a promise nobody catches, and the store already
     * records every ending as publishable state.
     */
    /**
     * Does the save in flight close the editor when it lands?
     *
     * Set by the press that asked for it, read by the store's outcome. It is a FLAG rather
     * than a leave at the call site because the answer is not known at the press: see the
     * paragraph at the close itself.
     */
    #closeOnSaved = false;

    #commit(gesture, { profile = null } = {}) {
        const change = this.#change;
        const plan = commitPlan({
            gesture,
            dirty: change.count > 0,
            /* BOTH HALVES OF THE ANSWER, and the second one is the fix. A count of 0 that
             * means "I could not compare the draft against the baseline" must not be read
             * as "there is nothing to save" — commitPlan's CANNOT TELL IS NOT CLEAN block
             * argues it out and turns that case into a write rather than a silent close. */
            tell: change.tell,
            seated: Boolean(this.#record),
        });
        /* CLOSE WITH NO OPERATION IS A LEAVE. A close WITH one is a save that also
         * leaves, and it must not take this branch — Ben, 27 August 2026: "pressing save
         * should close and arm, I shouldn't need to press save twice." Until then a plan
         * could only be one or the other, and leaving here first would have thrown the
         * write away on the way out. The save is started below and the leave follows it. */
        if (plan.close && !plan.operation) { this.#leave(); return plan; }

        /* THE THREE WAYS A COMMIT ENDS WITHOUT DOING ANYTHING, AND THEY NOW SAY SO.
         *
         * Each of these used to be a bare `return plan` — the press landed, the handler
         * ran, and the screen looked exactly as it had a moment earlier. That is the same
         * defect as the one above wearing a smaller face: B10's rule is "save, then report
         * what happened", and "nothing happened" is something that happened.
         *
         * ALL THREE REDUCE TO ONE FACT, which is why they share one sentence: there is no
         * record open. `commitPlan` answers `operation: null` for a RENAME with nothing
         * seated; `this._draft` is null exactly when no record is seated (`#onStoreState`
         * nulls the draft with the record); and a screen with no store has no record it
         * could have got from one. A fourth, differently-worded toast per branch would be
         * three sentences for one state.
         *
         * IT IS DELIBERATELY NOT A REFUSAL SENTENCE. A refusal is the SERVER's word and is
         * printed verbatim (#49's rule, and `#announce` below). This is the screen saying
         * it did not ask. */
        if (!plan.operation || !this.#store) return this.#nothingToSave(plan);

        const body = plan.operation === SAVE_OPERATION.NEW_VERSION ? this._draft : profile;
        if (!body) return this.#nothingToSave(plan);
        this.#pending = plan.operation;
        /* STARTED, NOT AWAITED — see the paragraph above this method. The store records
         * every ending as publishable state, and `#announce` words it; an awaited save in
         * an event handler is a promise nobody catches. */
        this.#store[plan.operation](body);

        /* THE LEAVE IS DEFERRED TO THE OUTCOME. `plan.close` is the request; the store's
         * SAVED publish is when it is honoured. See `#onStoreState`, which carries the
         * reasoning and the measurement. */
        this.#closeOnSaved = plan.close === true;
        return plan;
    }

    /**
     * A commit that never became a request, said out loud once.
     *
     * The plan's own `reason` is developer-facing English and is logged rather than shown;
     * D2 puts a translated sentence in front of the person and the reason in the log,
     * which is also how a bench session tells the three branches apart.
     */
    #nothingToSave(plan) {
        this.#log('warn', `editor: the commit did nothing — ${plan.reason}`);
        const toast = this.renderRoot?.querySelector?.('#notice');
        if (toast && typeof toast.show === 'function') {
            toast.show(this.#i18n.t('Nothing was saved — no profile is open.'), { tone: 'warn' });
        }
        return plan;
    }

    /** Leave the editor. The shell owns navigation, so this ASKS (app-root.js:375). */
    #leave() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * WHAT HAPPENED, SAID OUT LOUD. The store's report and its version facts, worded
     * here and nowhere else — B10: save, then report what happened.
     *
     * A REFUSAL IS THE SERVER'S OWN SENTENCE, printed verbatim, exactly as the selector
     * prints an arm-time refusal (#49's rule: "takes a message, it does not know the
     * message"). The three save endings are the store's own vocabulary, so a fourth
     * ending cannot appear here without appearing there first.
     */
    #announce(state) {
        const t = this.#i18n.t;
        const toast = this.renderRoot?.querySelector?.('#notice');
        if (!toast || typeof toast.show !== 'function') return;

        if (state.save === SAVE_STATUS.REFUSED) {
            const refusal = state.refusal ?? {};
            const message = [refusal.error, refusal.message].filter(Boolean).join(' — ');
            toast.show(message || t('The server refused the save.'), { tone: 'danger' });
            return;
        }
        if (state.save === SAVE_STATUS.FAILED) {
            /* THE SERVER'S OWN SENTENCE, WHEN IT SENT ONE.
             *
             * This used to show the status and nothing else, and Ben met it as "The save
             * failed (500)." on 28 August 2026. The body had already carried the reason —
             * ReaPrime answers a profile it cannot parse with 500 and the real fault in
             * `message` — and the transport had already parsed it into `problem`. Only
             * this line dropped it, which made a diagnosable failure undiagnosable.
             *
             * The status stays beside it. It is the one fact that is true even when the
             * body is missing, and it is what a bug report can be matched on. */
            const status = state.report?.status ?? null;
            const said = profileFailureSentence(state.report?.error);
            let message;
            if (said && status) {
                message = t('The save failed ({status}). {reason}', {
                    status: String(status), reason: said,
                });
            } else if (said) {
                message = t('The save failed. {reason}', { reason: said });
            } else if (status) {
                message = t('The save failed ({status}).', { status: String(status) });
            } else {
                message = t('The save failed.');
            }
            toast.show(message, { tone: 'danger' });
            return;
        }
        if (state.save !== SAVE_STATUS.SAVED) return;

        /* SAVED. What became of the previous version is `profile-lineage.js`'s answer off
         * two server-issued ids — never a guess — and each word below is one of its four. */
        switch (state.version?.kept) {
            case VERSION_KEPT.LINKED:
                toast.show(t('Saved. The previous version is kept.'), { tone: 'ok' });
                break;
            case VERSION_KEPT.SAME_RECORD:
                toast.show(t('Saved. One record, updated in place.'), { tone: 'ok' });
                break;
            /* THE RESTORE ENDING, AND IT IS AN `ok` NOT A `warn`. The server already held
             * this content, so it handed back the record it had rather than storing a
             * second copy of it — which is the ordinary outcome of restoring an older
             * version, not a fault. Before `VERSION_KEPT.RESTORED` existed this case fell
             * through to NOT_LINKED and told the person their previous version was not
             * kept, which was both wrong and exactly the sentence that would stop somebody
             * trusting undo. Nothing was lost: the version they were on is hidden, still in
             * its lineage, and still in this dialog. */
            case VERSION_KEPT.RESTORED:
                toast.show(t('Restored. This version is now the current one.'), { tone: 'ok' });
                break;
            case VERSION_KEPT.NOT_LINKED:
                toast.show(t('Saved. The previous version was not kept.'), { tone: 'warn' });
                break;
            default:
                toast.show(t('Saved.'), { tone: 'ok' });
        }
    }

    /* ---------------------------------------------------------------------
     * The rename affordance (cmp-seh-3)
     * ------------------------------------------------------------------- */

    /** The pencil, or the title itself — Slate binds both to the same opening
     *  (`profile_editor.js:3255`). The invoker is the control that was pressed, so the
     *  caret comes back to it: #21's own contract, and the reason it takes an element. */
    #onRenameOpen = (event) => {
        const dialog = this.renderRoot?.querySelector?.('#rename-dialog');
        if (!dialog) return;
        const field = this.renderRoot.querySelector('#rename-field');
        if (field) field.value = this._draft?.title ?? '';
        /* A FRESH OPEN CARRIES NO REFUSAL. The last one belonged to the title that was
         * typed then, and re-showing it over an untouched field would accuse the person
         * of something they have not done yet. */
        this._renameRefusal = null;
        dialog.show({ invoker: event?.currentTarget ?? null, reason: 'press' });
    };

    /**
     * Confirmed. The RENAME gesture, routed by the same table the band's Save uses.
     *
     * THE BODY IS COMPUTED BEFORE THE DIALOG IS TOUCHED, and that ordering is the fix for
     * audit F-050. This method used to read:
     *
     *   const body = renameBody(this._state?.baseline ?? null, field?.value ?? '');
     *   this.renderRoot?.querySelector?.('#rename-dialog')?.hide('confirm');
     *   if (!body) return;
     *
     * — `hide('confirm')` UNCONDITIONALLY, and with the reason `'confirm'`. So a seated
     * profile renamed to `""` or `"   "` closed the dialog exactly as a successful rename
     * closes it: the header still carried the old title, the change count stayed 0,
     * `saveStatus` stayed idle, no toast was raised, and zero requests left the app. The
     * only way to find out the rename had not happened was to read the header. Declining
     * to send an empty title is CORRECT — `profile.dart:46-49` answers one with a typed
     * 400 — so the fault was that a correct refusal was silent and wore an acceptance's
     * face. Now the dialog stays open on a refusal and says why, and only a real body
     * dismisses it.
     */
    #onRenameConfirm = () => {
        const field = this.renderRoot?.querySelector?.('#rename-field');
        const wanted = typeof field?.value === 'string' ? field.value.trim() : '';

        /* `renameBody` collapses `""` and `"   "` to one state (`title.trim()`), which is
         * why an empty title and a whitespace-only one behaved identically; the same trim
         * is done here so the refusal covers both by the same rule rather than a second
         * one. The dialog is NOT hidden — it is the surface this sentence renders into. */
        if (wanted === '') {
            this._renameRefusal = 'A profile needs a name.';
            return;
        }
        this._renameRefusal = null;

        /* AN UNSEATED DRAFT IS RENAMED IN PLACE — audit F-041.
         *
         * "New profile" is the only creation door, and it opens `{id: null, profile}`
         * (`selector-screen.js #openNewProfile`). A record with a null id is SEATED as far
         * as `commitPlan` is concerned — there is an object — so RENAME routed to
         * `saveInPlace`, which reads the id off the record and returns early on a null one
         * (`profile-editor-store.js:456`, `if (!wanted) return store.get();`). No request,
         * no refusal, no toast. So EVERY profile created in Decal landed on the server
         * titled "New profile" and could only be renamed after the fact.
         *
         * THE RIGHT ANSWER IS NOT TO INVENT A REQUEST. There is nothing on the server to
         * rename yet: the profile does not exist until its first save, and a rename is
         * defined in this tree as a metadata edit on a record the server already served
         * (see `renameBody`'s own note — it is built from the BASELINE precisely so a
         * rename cannot smuggle unsaved content). What a person means by naming an unsaved
         * draft is that the draft is called that; so the title goes into the DRAFT, the
         * header re-reads it, `changeCountOf` counts `title` among its scalars, and the
         * first Save carries it as part of the whole draft it was always going to send.
         *
         * THE SEATED PATH BELOW IS UNTOUCHED. F-050 is the other half of this dialog and a
         * different mechanism; neither fix reaches the other's state. */
        if (!this.#record?.id) {
            if (this._draft) this._draft = { ...this._draft, title: wanted };
            this.renderRoot?.querySelector?.('#rename-dialog')?.hide('confirm');
            return;
        }

        const body = renameBody(this._state?.baseline ?? null, wanted);
        this.renderRoot?.querySelector?.('#rename-dialog')?.hide('confirm');
        if (!body) return;
        this.#commit(COMMIT_GESTURE.RENAME, { profile: body });
    };

    #onRenameCancel = () => {
        this._renameRefusal = null;
        this.renderRoot?.querySelector?.('#rename-dialog')?.hide('cancel');
    };

    /* ---------------------------------------------------------------------
     * D11's two events
     * ------------------------------------------------------------------- */

    /* THE COURTESY RE-EMITS WERE RETIRED ON 29 AUGUST 2026 — audit F-003 and F-004.
     *
     * Both handlers used to dispatch a second event of their own first — `editor-commit`
     * here, `editor-cancel` below — "so a composition root above has one place to listen".
     * That root never materialised. The Wave 0 wire gate found both emitted from exactly
     * one site and heard NOWHERE: not in `src/`, not in `index.html`, not in `tools/`, not
     * even in `test/harness/`. `app-boot.js` records the same absence from the other end —
     * the shell assembles the editor store and seats the record itself, which is the job
     * the listener above would have had.
     *
     * WHAT WAS DELETED IS THE ANNOUNCEMENT, NOT THE ACTION. Each handler's second half —
     * the guarded discard for Cancel, the routed save for Save — is untouched and is what
     * the two gestures have actually done since fix run 4. An event nobody hears is not a
     * seam; it is a claim that a seam exists, and it made two of the thirteen dead wires
     * the audit had to walk. If a composition root above this screen is ever needed, it
     * gets the events back with a listener on the same commit, and the gate keeps them
     * honest in the meantime.
     *
     * `event.stopPropagation()` STAYS on both. It is not about the re-emit: it stops #31's
     * own bank `change` from crossing this boundary as a bare, coordinate-free event. */
    #onCommit(event) {
        event.stopPropagation();
        if (this.#store) this.#commit(COMMIT_GESTURE.SAVE);
    }

    /**
     * CANCEL LEAVES — and asks first, because leaving is what discards the work.
     *
     * This used to re-emit the gesture and do nothing else, on the grounds that wiring it
     * to "leave" would discard unsaved changes with no guard in front of it. The guard was
     * the missing half, and the consequence of leaving it out was worse than the risk it
     * avoided: Cancel appears ONLY at a dirty count, and the band's other control at a
     * dirty count is Save — so an editor with one edit in it had no way out at all except
     * to save a version nobody wanted. A dirty screen you cannot leave is a trap.
     *
     * SO THE GUARD IS BUILT HERE, as one dialog, and Cancel goes through it. The count is
     * in the question because "3 changes" is what makes the answer obvious.
     *
     * THE `editor-cancel` RE-EMIT IS GONE (F-003) — see the note above `#onCommit`. The
     * guard is the whole of what this gesture does, and it always was.
     */
    #onCancel(event) {
        event.stopPropagation();
        if (this.#count > 0) {
            this.renderRoot?.querySelector?.('#discard-dialog')?.show();
            return;
        }
        this.#leave();
    }

    #onDiscardCancel = () => {
        this.renderRoot?.querySelector?.('#discard-dialog')?.hide('cancel');
    };

    #onDiscardConfirm = () => {
        this.renderRoot?.querySelector?.('#discard-dialog')?.hide('confirm');
        this.#leave();
    }
}

customElements.define('editor-screen', EditorScreen);
