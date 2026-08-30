/**
 * selector-screen.js — <selector-screen>, the Profile selector.
 * LAYOUT_SPEC_DRAFT.md §4.2; SCOPE Part 5 §3.
 *
 * ===========================================================================
 * THE GRID  (§4.2, quoted)
 * ===========================================================================
 *
 *     <selector-screen>                 display:grid; height:100%
 *       grid-template-rows: var(--ui-band-h) minmax(0,1fr)
 *
 *       ├─ <page-header>   title + Cancel + Confirm
 *       └─ <split>         display:grid; gap: var(--ui-seam)
 *            grid-template-columns: minmax(360px, 40%) minmax(0, 1fr)
 *            @container (inline-size < 900px) → single column, list over detail
 *
 * Two rows, and the seam between them is the header's underline: display, gap and
 * ground come from the seam utility via the classes added to the HOST in
 * connectedCallback, because a .seam-grid rule inside this shadow root can never match
 * its own host (CONVENTIONS §13 (b)). Same construction as live-screen.js, one screen
 * over.
 *
 * THE GRID HAS EXACTLY TWO CHILDREN AND EVERY OVERLAY LIVES INSIDE ONE OF THEM. That is
 * P1's cure held rather than merely achieved: four <dialog>s parsing as children of a
 * three-column grid is the defect, so the confirm dialogs, the versions dialog and the
 * context menu are slotted into the detail pane's own regions, where <ui-dialog>'s
 * `display: contents` host and a closed native <dialog> contribute nothing to the
 * layout. The skeleton suite counts this root's children and finds two.
 *
 * ===========================================================================
 * WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT
 * ===========================================================================
 * OWNS: the boxes, the composition, and the wiring between the store and the library.
 * DOES NOT own: a route id, a fetch, a body, a refusal's wording, a list row's markup,
 * a dialog's machinery, a limit, or a colour. Every endpoint on this screen is reached
 * through `createProfileLibraryStore`, which is the only file in the cluster that imports
 * `callRoute`; every visible box is a library component; every number is a token.
 *
 * ===========================================================================
 * THE CORE LOOP  (`sel-core-loop`, Part 5 §3 "What it must do in v1" bullet 1)
 * ===========================================================================
 *
 *   list        GET /profiles?includeHidden=true through rule 1, grouped by
 *               `profile-folders.js`, rendered as a REAL listbox (P12 — see
 *               `profile-listbox.js` for all four halves of that defect).
 *   search      #30, filtering with `matchProfiles` — the store's own pure function, so
 *               the filter the screen shows and the filter the store would apply cannot
 *               drift.
 *   select      one property on one <ui-list-row> (P11: never a class), and the detail
 *               pane redraws from the record — no second read.
 *   favourite   #36 over #35, five slots, rules 4 and 5. An EMPTY slot is the ordinary
 *               case, which is what makes `profileManager.js:450`'s ReferenceError
 *               unwriteable here.
 *   confirm     #19 with a REAL primary treatment (P8), then `arm()` — POST
 *               /machine/profile, whose typed 400 lands on the alert banner beside the
 *               profile that was picked (B9).
 *
 * ===========================================================================
 * WHY THE HEADER IS layout="flanks" WITH SLOTTED BUTTONS, AND NOT commit
 * ===========================================================================
 * <ui-page-header> (#31) has a `commit` mode that renders D11's Save wording — "Save
 * (3)", "Close" at zero changes — with its own @commit / @cancel events. That is the
 * EDITOR's band. §4.2 names this one "title + Cancel + Confirm", and P8 is about this
 * screen's Confirm specifically: "#confirm-profile-btn — the one affirmative action on
 * the screen — has NO primary treatment; measured transparent, identical to Cancel
 * beside it." A slotted <ui-button variant="primary"> is how the primary treatment
 * actually paints, because #16 owns the variant and the four selection dials are not
 * involved.
 *
 * P8 IS ANSWERED TWICE ON THIS SCREEN AND BOTH ARE THE SAME MECHANISM: the band's
 * Confirm is `variant="primary"`, and the confirm DIALOG's affirmative button is
 * `<ui-confirm-dialog tone="affirmative">`, whose own TONE_VARIANT table maps that to
 * the same #1 variant ("tone selects the variant … one place, so the mapping cannot
 * drift"). Neither is a colour written here.
 *
 * ===========================================================================
 * THE SEVEN DEFECTS THAT DIE BY CONSTRUCTION  (P1, P2, P3, P9, P11, P14, P15)
 * ===========================================================================
 * These are the skeleton's row (`bug-structural-P1-P3-P9-P11-P14-P15`) and its suite
 * checks them; the mechanisms are restated in short here because the core loop is what
 * would break them, and a builder editing this file needs to know which lines are load
 * bearing for someone else's proof.
 *
 * P1  there is no page — a Lit template's structure is fixed at module evaluation, and
 *     this root has two children, both named in §4.2.
 * P2  the route is {id, tag, module, label} in `app-routes.js` and <app-root> creates the
 *     element; nothing on the path is innerHTML.
 * P3  there is no bundle and there are no utilities; the rhythm under the filter field is
 *     the list pane's own row-gap, one declaration.
 * P9  a rule that matches nothing is visible in a ten-element root; the suite walks the
 *     parsed CSSOM and asserts every rule in this file's sheet matches something.
 * P11 SELECTION IS A PROPERTY. `selected` on <ui-list-row>, reflecting to aria-selected,
 *     painting through the four --ui-selected-* dials. No row on this screen carries a
 *     class for state, and the suite asserts it over the rendered rows.
 * P14 teardown is disconnectedCallback; this screen registers no document- or
 *     window-level listener, and the suite counts them from before the imports run.
 * P15 an id inside a shadow root is not a global name; no selector here holds two ids.
 *
 * ===========================================================================
 * NO STORE, NO ROWS — AND WHY THE PLACEHOLDERS SURVIVE
 * ===========================================================================
 * `boot` is set by <app-root> at creation, and without it this screen has no transport
 * and therefore no listing. It then renders PLACEHOLDER_ROWS: four titles, two of them
 * sharing a folder prefix, so the list region has four rows to be four rows tall — which
 * is the one thing `--ui-selector-list-min-h` is a claim about, and the state the
 * skeleton's own suite measures. It is a LAYOUT DEMO and it is marked as one on every row
 * (`data-placeholder`); no placeholder is ever selectable into the detail pane, because a
 * placeholder has no profile to draw and arming one would be a lie.
 *
 * ===========================================================================
 * D2
 * ===========================================================================
 * Every readable string is a value read through I18nController, from this file's first
 * commit — English only in v1, mechanism never deferred.
 */

import { css, html, nothing } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { profilePreviewDerivation } from 'src/lib/profile-preview.js';
/* THE BLANK PROFILE AND THE BLANK STEP'S NAME, each from the module that owns it —
 * `rea-profile.js` owns what a profile DOCUMENT is (it holds PROFILE_FILE_KEYS and both
 * write bodies), `profile-modes.js` owns what a STEP is. See `#openNewProfile`. */
import { newProfile } from 'src/data/rea-profile.js';
import { NEW_STEP_NAME_KEY } from 'src/lib/profile-modes.js';
/* THE CEILINGS, FROM THE ONE MODULE THAT READS THEM — fix run 4's, built for the editor
 * header and shared with this strip exactly as Slate shared its own. Peak and Steps come
 * from here; see SUMMARY_TILES for why Temp and Stop at do not. */
import { formatCeilingDuration, profileTotals } from 'src/lib/profile-totals.js';
import { ARM_STATUS } from 'src/stores/profile-arm-store.js';
import {
    matchProfiles,
    restoreFilenameOf,
    ADD_STATUS,
    LIBRARY_STATUS,
    VERSIONS_STATUS,
} from 'src/stores/profile-library-store.js';
import {
    highlightParts,
    listboxGroups,
    nextActiveIndex,
    optionIdFor,
    treeNodes,
    treeSideStep,
    R1_PROVISIONAL_ATTR,
    R1_PROVISIONAL_HIGHLIGHT,
} from 'src/lib/profile-listbox.js';
import { listboxStyles } from 'src/screens/selector-list.js';

import 'src/screens/selector-split.js';
import 'src/screens/selector-list-pane.js';
import 'src/screens/selector-detail-pane.js';

/* THE BANDS' CONTENT — every one a library component, composed. §4.2's component list
 * for this screen. A hand-built copy of any of these is the P6 defect class (the profile
 * row implemented twice) and a wave block. */
import 'src/components/ui-page-header.js';
import 'src/components/ui-button.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-search-field.js';
import 'src/components/ui-list-row.js';
import 'src/components/ui-section-header.js';
import 'src/components/ui-favourite-slot.js';
import 'src/components/ui-stat-tile.js';
import 'src/components/ui-chart-card.js';
import 'src/components/ui-notes-editor.js';
import 'src/components/ui-alert-banner.js';
import 'src/components/ui-toast.js';
import 'src/components/ui-menu.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-confirm-dialog.js';
import 'src/components/ui-file-button.js';
import 'src/components/ui-text-field.js';

/** Re-exported so a reviewer grepping the screen finds R1's marking here too. */
export { R1_PROVISIONAL_ATTR, R1_PROVISIONAL_HIGHLIGHT };

/**
 * The layout demo's rows — see "NO STORE, NO ROWS" above. NOT fixture data and not a
 * listing. Two share a folder prefix on purpose: the ' / ' families are real in the
 * fixture (Tea portafilter 12, A-Flow 9, Pour over basket 6) and `profile-folders.js`
 * already groups them, so the box the group occupies is the box being measured.
 */
const PLACEHOLDER_ROWS = Object.freeze([
    { title: 'Extractamundo Dos!', provenance: 'Bundled' },
    { title: 'Tea portafilter / Green', provenance: 'Bundled' },
    { title: 'Tea portafilter / Oolong', provenance: 'Bundled' },
    { title: 'Baseline', provenance: 'Yours' },
]);

/**
 * The summary strip's tiles. §4.2 calls it a "summary tile strip"; #34 is the tile.
 *
 * ===========================================================================
 * THE ROSTER IS BEN'S, AND IT IS SLATE'S SET MINUS ONE  (`cmp-seh-1`)
 * ===========================================================================
 * The shipped strip read Yield / Volume / Time / Temperature. Slate's read Temp / Peak /
 * Duration / Steps / Stop at, and the change was made in code with no manifest row naming
 * it — an undeclared drop of Peak and Steps, which is the finding. Ben's answer to the
 * roster: **Temp · Peak · Steps · Stop At**, Slate's set minus Duration, and "PEAK MUST BE
 * COMPUTED CORRECTLY".
 *
 * DURATION IS GONE ON PURPOSE and its ≈ goes with it. Slate painted the duration ceiling
 * as "≈2:00" because a step normally exits early on its own condition; with the tile
 * dropped there is no ceiling on this strip to qualify, so the question of whether the
 * approximately-sign survives the port does not arise here. The ceiling itself is not
 * lost — the editor header still says "max 2:00" over the same profile, from the same
 * module.
 *
 * FOUR TILES, ALWAYS FOUR. Slate OMITTED a tile whose value the profile does not define,
 * so its strip was three, four or five tiles wide depending on the profile. #34 paints its
 * own dash for an absent reading and says "no reading" to a screen reader while it does
 * it, so absence is expressed inside a tile that stays put — which is also what keeps the
 * strip's own geometry (ECM-828's alignment with the chart card below it) a fact about
 * four columns rather than about the profile that happens to be selected.
 *
 * WHERE EACH NUMBER COMES FROM, and it is two places rather than one:
 *
 *   Peak, Steps   `profile-totals.js` — THE module for a profile's ceilings, landed by
 *                 fix run 4 for the editor header. Slate's own `profileTotals` fed both
 *                 that header and this strip, and the peak is the reason it matters: Slate
 *                 read a non-pressure step's LIMITER, so a gentle flow profile reported
 *                 "peak 9.0 bar" on its own screen. The port composes
 *                 `stepTargetOverlay()` instead and a flow step contributes nothing. That
 *                 fix is not restated here; this file calls the module.
 *   Temp, Stop at THE PROFILE'S OWN FIELDS, read here — the same split Slate drew
 *                 (`profile-totals.js:52-74`, read-only): its `profileTotals` has exactly
 *                 the four ceiling terms and its tile builder reads the temperature and
 *                 the stop target itself. Neither is a ceiling the editor header states,
 *                 so neither is added to that module for one caller.
 *
 * THE TEMPERATURE IS THE HIGHEST ANY STEP COMMANDS, which is Slate's rule
 * (`Math.max(...temps)`) and replaces the shipped strip's first-step reading. A profile
 * that steps down — the oracle's own does, 83.5 → 75 → 75 — has no single temperature,
 * and the hottest water it will pour is the one figure of the set that is a fact about the
 * whole profile rather than about whichever step happens to be first. Both rules agree on
 * the oracle's profile (83.5 °C, prov-baseline/profile-selector.json [i=179]).
 *
 * THE STOP TARGET IS WEIGHT OR VOLUME, whichever the profile states. Slate read
 * `target_weight` alone; a profile that stops on volume instead is the ordinary case for a
 * machine with no scale, and it stated its stop target in `target_volume` all along — so
 * the tile reads the field the profile filled in and carries that field's unit. Zero is
 * ReaPrime's "unset" for both, so a profile with neither dashes.
 *
 * `read` returns `null` for "this profile does not say", and a `{value, unit}` pair
 * otherwise: the VALUE is already spelled, because how many decimals a reading carries is
 * a fact about the reading (one on °C and bar, none on a count) and not something a
 * translation owns. The unit travels with it because Stop at's unit is the profile's
 * answer too.
 */
/** The five slots, 1-based, as a person reads them off the discs. */
const SLOT_NUMBERS = Object.freeze([1, 2, 3, 4, 5]);

const SUMMARY_TILES = Object.freeze([
    Object.freeze({
        key: 'temp', label: 'Temp',
        read: (profile) => {
            const temps = stepsOf(profile)
                .map((step) => numeric(step?.temperature))
                .filter((value) => value !== null);
            return temps.length ? { value: Math.max(...temps).toFixed(1), unit: '°C' } : null;
        },
    }),
    Object.freeze({
        key: 'peak', label: 'Peak',
        read: (profile, totals) => (totals.peakPressure === null
            ? null
            : { value: totals.peakPressure.toFixed(1), unit: 'bar' }),
    }),
    /**
     * DURATION — Slate's third tile, and the one Decal's strip did not have.
     *
     * Ben, 25 August 2026, on the selector audit's finding 3: "Add duration". Slate prints
     * TEMP, PEAK, DURATION, STEPS and STOP AT; this strip printed four of the five.
     *
     * THE NUMBER WAS ALREADY BEING COMPUTED, which is what made it a missing tile rather
     * than a missing feature: the profile editor's own subtitle prints "max 1:06" from the
     * same steps. `profileTotals` walks them once for the peak and the count; the seconds
     * come off the same walk.
     *
     * IT IS A MAXIMUM AND THE UNIT SAYS SO. Every step's `seconds` is its LIMIT, not its
     * length — a step can exit early on pressure, on weight or on volume — so the sum is
     * the longest the profile can run and never what a shot will take. `profileTotals`
     * already answers `maxSeconds: null` for a profile with an unbounded step, and a
     * profile with no ceiling has no tile rather than a made-up one.
     *
     * `formatCeilingDuration` IS THE EDITOR'S OWN SPELLING, not a second one: it is what
     * prints "max 1:06" under the profile's name one screen over.
     */
    Object.freeze({
        key: 'duration', label: 'Duration',
        read: (profile, totals) => (totals.maxSeconds === null
            ? null
            : { value: formatCeilingDuration(totals.maxSeconds), unit: 'max' }),
    }),
    Object.freeze({
        /* THE ONE TILE EVERY PROFILE CAN ANSWER: a profile with no steps has none, and
         * zero steps is a reading rather than an absence. */
        key: 'steps', label: 'Steps',
        read: (profile, totals) => ({ value: String(totals.steps), unit: '' }),
    }),
    Object.freeze({
        key: 'stop-at', label: 'Stop at',
        read: (profile) => {
            const weight = numeric(profile.target_weight);
            if (weight !== null) return { value: String(weight), unit: 'g' };
            const volume = numeric(profile.target_volume);
            return volume === null ? null : { value: String(volume), unit: 'mL' };
        },
    }),
]);

/** The profile's steps, or none. Same reading as `profile-totals.js`'s. */
const stepsOf = (profile) => (Array.isArray(profile?.steps) ? profile.steps : []);

/** A number a profile actually states. Zero is ReaPrime's "unset" for these fields. */
function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Menu item ids. Strings in one place, so the template and the handler cannot part. */
/**
 * The fold marks. Two glyphs, not one rotated by CSS, so the shut and open states are
 * different CONTENT rather than a transform a reduced-motion setting has an opinion
 * about. Aria-hidden on the span that carries them: the state a reader needs is
 * `aria-expanded` on the row, and a triangle read aloud beside it is noise.
 */
const FOLD_SHUT_GLYPH = '\u25B8';

const FOLD_OPEN_GLYPH = '\u25BE';

/**
 * The id a FAMILY node carries, so one active-descendant lookup serves both kinds.
 *
 * PREFIXED, because a family is named by a string a person typed into a profile title
 * and a profile is named by a ReaPrime record id — and nothing stops a library from
 * holding a family called `profile:0925…`. The prefix is not a namespace anybody parses;
 * it exists so the two id spaces cannot collide.
 */
export const FOLDER_NODE_PREFIX = 'folder:';

const folderNodeId = (folder) => `${FOLDER_NODE_PREFIX}${folder}`;

/** The three ways a profile can arrive. Slate's own three, in Slate's own order. */
const ADD_ACTION = Object.freeze({
    /**
     * START A BLANK PROFILE — the one thing this menu could not do.
     *
     * Ben, 25 August 2026, on the selector audit's finding 2: "Add a way to start a new
     * profile." The audit's own words: "All three bring in a profile from somewhere else;
     * none of them starts a blank one. Measured: pressing Slate's + landed on the editor at
     * ?page=profile_editor with a profile called 'New Profile'."
     *
     * IT IS FIRST IN THE MENU, because it is the only entry that does not depend on
     * something outside the machine. The other three are an upload, a share code and a
     * plugin.
     */
    NEW: 'new',
    UPLOAD: 'upload',
    SHARE_CODE: 'share-code',
    GENERATE: 'generate',
});

const ACTION = Object.freeze({
    /** A row menu's five slot rows — the number rides on the id after a colon. */
    ASSIGN: 'assign',
    /**
     * D6's SECOND HALF, LANDED. Ben, 25 August 2026: "yes build it behind a confirm that
     * says plainly it cannot be undone."
     *
     * IT IS OFFERED ONLY FROM THE HIDDEN LIST, and that is the whole of its safety design.
     * A profile has to be hidden before it can be removed, so the gesture is two decisions
     * on two screens rather than one press beside Edit — and the second decision is made
     * looking at a list of things the user has already put away.
     */
    REMOVE: 'remove',
    VERSIONS: 'versions',
    /* THE EDIT (fix run 4, `dec-A-B-1`). The editor route existed from wave 5.5 and
     * nothing in the app could reach it with a profile in hand: the screen mounted
     * data-less, so B10/B11's save path was unreachable from the shipped app. This is
     * the trip out, and the detail pane's overflow menu is where it belongs — the same
     * menu, over the same selected record, that Q7 put the versions entry on. */
    EDIT: 'edit',
    /* HIDE (wave 5.8). The route is DELETE /profiles/<id> and the word is deliberately
     * not "delete": ReaPrime's own handler sets Visibility.hidden on a bundled record and
     * Visibility.deleted on a user one, and removes nothing. The old skin calls the same
     * control "Hide" (profile_selector.js:624). Until this landed, the restore half of D6
     * was a door with nothing behind it — the list of restorable profiles could only ever
     * hold records some OTHER client had hidden. */
    HIDE: 'hide',
});

export class SelectorScreen extends UiElement {
    static properties = {
        /**
         * The app shell's boot object, handed down by <app-root> at creation. This is the
         * screen's ONLY door to the network: the store is built from `boot.transport`,
         * `boot.storage` and `boot.arm`, and nothing else here reaches a route.
         */
        boot: { attribute: false },

        /** The profile the machine has loaded, by id — settable for a demo or a test. */
        loadedProfileId: { type: String, attribute: 'loaded-profile-id' },

        /** Internal: the library store's published state. */
        _state: { state: true },
        /** Internal: the filter field's text. */
        _query: { state: true },

        /**
         * THE LIST IS SHOWING WHAT THE LIBRARY HIDES — Slate's Hidden toggle.
         *
         * Internal state and not a route: it is a view of the same screen, and a hidden
         * list that survived a navigation would be a screen that opens on the wrong set.
         */
        _showHidden: { state: true },
        /** Internal: which option `aria-activedescendant` names. A record id, or null. */
        _activeId: { state: true },
        /** Internal: which placeholder row is selected, in the no-boot layout demo. */
        _placeholder: { state: true },

        /**
         * Which families are expanded, as a Set of family names.
         *
         * STATE AND NOT A STORE'S, because it is about this device's screen rather than
         * about the library: the routing table has carried `profileFoldersOpen` (local,
         * device-scoped) since wave 0 with no reader. It is read once on connect and
         * written on every toggle.
         */
        _openFolders: { state: true },

        /** What has been typed into the share-code field. */
        _shareCode: { state: true },

        /** The generator plugin's page, or null while it is absent or not loaded. */
        _generatorUrl: { state: true },
    };

    static styles = [typeRoles, seams, listboxStyles, css`
        /* THE FILE BUTTON IS IN THE TREE AND NOT ON THE BAND. Its input has to exist for
         * a menu row to be able to click it, and its own button paints nothing here — the
         * menu row is the control a person presses. Absent, not hidden, would take the
         * input with it. */
        .hidden-control {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }

        /* The share-code dialog's body: a field, whatever the add had to say, and the
         * one affirmative button. */
        .share-body {
            display: grid;
            gap: var(--ui-space-4);
            min-inline-size: 0;
        }

        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THE GRID. display / gap / ground come from the seam utility via the host
         * classes added in connectedCallback; :host(.seam-grid) is (0,2,0), so this
         * rule — same selector, written later — is what adds the tracks to it.
         *
         * Two rows and no more. §4.2 names two, and the seam between them IS the
         * header's underline, which is why the ground is --ui-line-strong
         * (.seam-strong): §3.9 and CONVENTIONS §13 both give that weight for "rail
         * edge, header underline, band top". */
        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long profile title in the band cannot widen
         * the screen; the band's own layout is #31's and nothing here reaches into it. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        /* Row 2, both minimums at 0 — the split decides its own columns and the panes
         * decide their own floors. A min-block-size here would be a third owner of a
         * dimension two boxes already own (§2.3). */
        selector-split {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* THE BAND'S BUTTON CLUSTER. A flex row with one gap, so Cancel and Confirm
         * cannot collide whatever the words become under D2 — the same arrangement
         * live-screen.js uses for its own action cluster, and the reason the old
         * header's 133px of slack was load-bearing (§4.1). */
        .band-actions {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
        }

        /* The detail pane's title row and the list pane's toolbar are both
         * --ui-toolbar-h tall; these two boxes centre their content in that height and
         * declare no height of their own. One owner per dimension: the track. */
        .toolbar,
        .title-row {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }


        /* The title takes the slack so the overflow affordance sits at the trailing
         * edge, and it ELLIPSES rather than widening the pane: a 60-character profile
         * title is ordinary in this fixture. */
        /* THE PANE'S SUBJECT, AT THE TOP OF THE TEXT LADDER. Ben, 25 August 2026: "The
         * profile name above the chart, please make it bigger font size by at least 50%
         * but there is likely some normal height for these sorts of headings."
         *
         * IT WAS 20/500, WHICH IS THE LIST ROW'S OWN TYPE — .ui-heading is --ui-text-lg,
         * the section-heading role, and a section heading is what the markup called this.
         * It is not a section heading: it is the name of the thing the entire right pane
         * is about, and it was set in the same size as the 53 rows beside it.
         *
         * 28 IS THE LADDER'S ANSWER, not 30. --ui-text-xl is the top of the text scale and
         * the .ui-title role's own size, so this is a role rather than a number. 20 -> 28
         * is +40%. The +50% Ben asked for is 30, which is --ui-display-sm — a DISPLAY
         * token, for numeric readouts, and it would also pass the page title above it.
         * Slate sets its own detail title at 24 against a 28 page title, so 28 here is
         * already the more prominent of the two skins. */
        #detail-title {
            font-size: var(--ui-text-xl);
            line-height: 1.2;
            min-inline-size: 0;
            overflow-x: clip;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE THREE ACTIONS, AT THE FAR END OF THE TITLE ROW — Slate's placement. */
        .detail-actions {
            margin-inline-start: auto;
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            flex: 0 0 auto;
        }

        /* THE SUMMARY STRIP: FIVE TILES BUNCHED AT THE LEFT, WHICH IS SLATE'S SHAPE.
         *
         * Ben, 25 August 2026: "Add duration and bunch them up on the left side of the
         * chart like Slate has done."
         *
         * IT WAS A STRETCHED GRID. repeat(auto-fit, minmax(2 x control-h, 1fr)) gave the
         * four tiles the whole pane: MEASURED at the reference geometry, four tiles of
         * 269.6 each across 1114, so a two-character reading like STEPS sat alone in the
         * middle of a 270px cell and the strip read as a table with nothing in it.
         *
         * SLATE'S OWN, MEASURED on its running selector: .ps-summary-strip is a flex ROW
         * with a 28px gap and five tiles of 68.3, 64.9, 90.5, 55.8 and 73.2 - each as wide
         * as its own reading, all five inside the first 465 of a 1279 pane. A tile is as
         * wide as what it says, and the strip stops where the readings stop.
         *
         * --ui-space-6 IS THAT 28, from the scale rather than from the measurement. */
        /* THE ASSIGN ROW. Slate's own, one step shorter.
         *
         * MEASURED on Slate's running selector: the row is 113 tall (p-6, border-t, flex,
         * items-center, gap 22) holding a microcap and five 64px discs, under the list
         * and above nothing. Ben asked for "maybe reduce the height a bit", so the inset is
         * --ui-space-5 rather than Slate's 24-and-a-bit: 24 + 64 + 24 is 112 of box against
         * its 113, and the whole saving is the rule above it, which this row does not draw
         * because the pane's own grid already separates its tracks.
         *
         * --ui-space-6 IS SLATE'S 22 ROUNDED TO THE SCALE, the same step the rail spends. */
        /* A ROW'S MARK IS THE SAME DISC, SMALLER — and the hook is the component's own.
         *
         * MEASURED: --ui-hit-min is the FALLBACK inside ui-favourite-slot's box, so setting
         * it here loses to the private the element declares first. --_ui-fav-slot-size is
         * that private, and it is what the file's own header calls its geometry seam.
         *
         * WHY IT HAS TO SHRINK AT ALL: the assign row's disc is a 64px TARGET; this one is
         * a label inside a list row, and at 64 it stood taller than the row and spilled out
         * of the list's scroll region — visible under the assign row in the capture that
         * found it. --ui-control-sm is the row's own height. */
        /* THE MATCH. Slate paints the matched letters yellow; the platform's <mark> has a
         * UA default that is a different yellow on every ground, so the paint is stated.
         * --ui-match is that colour, declared per theme beside --ui-selection because the
         * two are the same kind of thing: a wash behind text that the text survives. */
        .hit {
            background-color: color-mix(in srgb, var(--ui-match) 55%, transparent);
            color: inherit;
            border-radius: var(--ui-radius-sm, 3px);
        }

        /* A ROW'S MENU SITS AT THE END OF THE ROW and takes no room from the title until
         * the title needs it. Slate's .slate-profile-more is 64 x 64 with a 28px glyph.
         *
         * NO BOX ON THE TRIGGER, which is the difference between one control and ninety.
         * ui-icon-button paints a bordered control, which is right for the two in the
         * toolbar and wrong for the one that repeats down every row: MEASURED on the first
         * capture, thirty-one outlined squares reading as a second column beside the names.
         * Slate's is a bare glyph. --_ui-icon-btn-border is the component's own seam for
         * this, already spent by the editor's rename pencil for the same reason. */
        /* THE DOTS. A span, so every box the icon button used to bring has to be stated:
         * the hit area is the row's own height rather than a control's, because the
         * affordance is inside the row and the row is what P4's floor is measured on. */
        .row-dots {
            display: grid;
            place-items: center;
            inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            flex: 0 0 auto;
            border-radius: var(--ui-radius);
            color: var(--ui-muted);
            font-size: var(--ui-icon);
            line-height: 1;
            cursor: pointer;
        }

        /* AND IT SHOWS THE CARET, now that a caret can land on it (D21). The opener is
         * focusable on the tree's active row only, so exactly one of these can be focused
         * at a time; without a ring the keyboard route would exist and be invisible, which
         * is the same defect as not having it. It is the focus-VISIBLE pseudo-class and not
         * plain focus: a finger press must not leave a ring behind on a touch panel.
         *
         * NO BACKTICKS IN THIS COMMENT, and that is not fussiness — the first draft quoted
         * the pseudo-class in them and CLOSED THE css TEMPLATE, which npm run guards caught
         * as "a css template ends inside a comment". Fourth time in this campaign. */
        .row-dots:focus-visible { ${focusRing} }

        .row-menu {
            flex: 0 0 auto;
        }

        .row-fav {
            --_ui-fav-slot-size: var(--ui-control-sm);
        }

        /* NO INLINE PADDING OF ITS OWN. Ben, 25 August 2026: "Make sure all elements are
         * aligned." The pane already insets its children by --ui-space-5, so an extra
         * --ui-space-4 here started the cap at 42 while the toolbar above it started at
         * 24 — MEASURED, and visible as a step down the left edge of the list pane. The
         * block padding stays: that is the row's own height, not its alignment. */
        /* THE ROW FILLS THE LIST, and it sits where Slate's sits. Ben, 25 August 2026:
         * "the favorite assigment is a little high, the bottom margin could be reduced,
         * and the row should fill the width of the list in a tidy way, like what slate
         * looks like."
         *
         * SLATE'S ROW FILLS BY ARITHMETIC, not by a rule: MEASURED at 639 wide, cap 161 +
         * gap 22 + five 64 discs + four 22 gaps = 591, plus the 24 inset = 615, and the
         * pane's own 24 on the right closes it exactly. That lands because the pane is
         * 640. Decal's is wider, so the same numbers left 146px of nothing after the
         * fifth disc.
         *
         * space-between IS THE RULE THAT SURVIVES A WIDTH CHANGE. The cap holds the
         * leading edge, the fifth disc holds the trailing one, and the four gaps between
         * them share whatever is left. At Slate's own width it reproduces Slate's 22px
         * gaps; at any other width it stays tidy instead of stopping short.
         *
         * NO BOTTOM PADDING. The row had 24 of its own on top of the pane's 24, so the
         * discs sat 48 clear of the pane's foot against Slate's 24 — "a little high". The
         * pane's inset is the row's bottom margin now, and the discs land at 1112.5-1176.5
         * where Slate's are. The TOP padding stays: that is the row's separation from the
         * list, not its alignment. */
        .assign-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-6);
            padding-block-start: var(--ui-space-5);
            min-inline-size: 0;
        }

        /* THE CAP, AT SLATE'S SIZE AND ON TWO LINES. Ben, 25 August 2026: "Assign
         * FavuRits can be bigger text, match slate size and have the line break."
         *
         * MEASURED on Slate: 17 / 400 / 2.04px tracking, uppercase, boxed at 161 wide so
         * "ASSIGN" and "FAVOURITE" take a line each. The type audit called this a
         * difference of ROLE, not of size - Decal was reading the words as a microcap
         * (15 / 600) and Slate reads them as a body-size heading. This restates the role
         * for these two words only; .ui-microcap keeps its own definition for every other
         * caller, which is why the override lives here and not in type-roles.js.
         *
         * THE WIDTH IS WHAT BREAKS THE LINE, not a <br>. A hard break would survive
         * translation into a language whose word for "favourite" is one syllable and
         * whose word for "assign" is four. */
        .assign-row .ui-microcap {
            flex: 0 0 auto;
            max-inline-size: 10ch;
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            line-height: 1.2;
            white-space: normal;
        }

        /* THE FIVE DISCS, AT SLATE'S 64. The row was shortened once and took the discs
         * down to --ui-control-sm (44) with it; Ben's "Make the favourite buttons bigger,
         * again match slate" puts them back on the ordinary control height, which is
         * Slate's 64 x 64 to the pixel. The row keeps its 24px insets, so it grows from
         * 92 to 112 - one pixel under Slate's own 113. */
        .assign-row ui-favourite-slot {
            --_ui-fav-slot-size: var(--ui-control-h);
        }

        .summary {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-3) var(--ui-space-6);
            min-inline-size: 0;
        }

        /* A TILE IS AS WIDE AS ITS OWN READING. No basis, no growth: the strip is a row of
         * readings, not a set of columns, and a tile that stretched would put its number
         * somewhere different on every profile. */
        .summary > * {
            flex: 0 0 auto;
            min-inline-size: 0;
        }

        /* THE SUMMARY SLOT'S COLUMN. The refusal banner (#49) rides above the strip, in
         * flow, in the detail pane — "at the point of picking" (B9), beside the profile
         * that was picked and under its name. It is NOT an overlay: DQ-565 is about a
         * notice buried by a dialog opened inside its life, and an in-flow strip has no
         * such life and no stacking order to lose. The wrapper carries the rhythm and no
         * inset, so #summary still starts on the pane's one inset (P7). */
        .detail-strip {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        /* A DIALOG'S BODY LIST — the versions body (B11 / Q7) and the restore body (D6).
         * ONE rule for both, and it is rendered in both bodies whether or not there is
         * anything in the list, so it cannot become a rule that matches nothing (P9): an
         * empty list renders its sentence INSIDE this box rather than instead of it. The
         * sentence carries no class and takes the dialog body's own ink — a second colour
         * rule here would be a rule with one consumer and two states. */
        .dialog-list {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        /* THE TOOLBAR'S CAPTION TAKES THE SLACK — as a FLEX ITEM THAT GROWS, not as an
         * auto margin, and the difference is the whole caption (parity surface 5).
         *
         * NO BACKTICK IN THIS TEMPLATE, comment or not (CONVENTIONS §9): the old
         * margin-inline-end: auto pushed the restore affordance to the trailing edge and
         * left the caption SHRINK-TO-FIT. base.js puts container-type: inline-size on
         * every host and says in writing what that costs: "the host's own inline size
         * can no longer depend on its contents ... wrong for the handful of controls that
         * must shrink to fit their glyph ... the failure looks like 'my component
         * vanished'." That is exactly what happened here. MEASURED before this line
         * existed: <ui-section-header> host 0px wide, its .band 48px (its two 24px insets
         * and nothing between them), its <h2 id="caption"> 0x18 — under the probe's own
         * 4px floor, so the caption was not even in the provenance corpus — and the count
         * overflowing the band it is supposed to sit inside. Slate draws a captioned band
         * here (ORACLE profile-selector .slate-microcap [i=15] rect=[24,351,140,18] "Your
         * Profiles", [i=32] [24,667,168,18] "Built-In Profiles"); Decal drew the count
         * alone.
         *
         * Growing the item is the fix rather than opting the component out of container
         * hosting: #27's own file settles that ("The band fills the list's width, which is
         * the case the base default is right for"), so the consumer was wrong to ask it
         * to shrink, not the component to be a container. With the width coming from the
         * flex line instead of from the contents, inline-size containment has nothing left
         * to withhold. The restore affordance still sits at the trailing edge — that is
         * what a grown caption does to it — so nothing else in the band moves. */
        #list-caption {
            flex: 1 1 auto;
            min-inline-size: 0;
        }
    `];

    #i18n = new I18nController(this);

    /** The library store, built once `boot` arrives. Null in the layout demo. */
    #store = null;

    /** The store's unsubscribe, dropped in disconnectedCallback. */
    #unwatch = null;

    constructor() {
        super();
        this.boot = null;
        this.loadedProfileId = '';
        this._state = null;
        this._showHidden = false;
        this._query = '';
        this._activeId = null;
        this._openFolders = new Set();
        this._shareCode = '';
        this._generatorUrl = null;
        this._placeholder = null;
    }

    /**
     * The seam classes go on the HOST here, not in the template, and not in the
     * constructor — a custom element's constructor must not gain attributes
     * (CONVENTIONS §13). .seam-strong is the header underline's weight.
     */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        this.#attach();
        this.#readOpenFolders();
        this.#readGenerator();
    }

    /**
     * IS THE PROFILE GENERATOR THERE? Asked once, not awaited, and answered with a URL or
     * null — null keeps the menu row out of the list rather than showing one that 404s.
     */
    async #readGenerator() {
        const url = await this.#store?.generatorUrl?.().catch(() => null);
        if (typeof url === 'string' && url) this._generatorUrl = url;
    }

    /**
     * WHICH FAMILIES WERE OPEN LAST TIME. Not awaited and not blocking: the tree paints
     * shut, and opens the moment the answer lands. A device that has never been asked
     * lands on the empty set, which is every family shut — the state a person collapses
     * TO, and the one that makes a 186-profile library legible at all.
     */
    async #readOpenFolders() {
        const storage = this.boot?.storage;
        if (!storage || typeof storage.get !== 'function') return;
        const held = await storage.get('profileFoldersOpen').catch(() => null);
        if (!Array.isArray(held) || !held.length) return;
        this._openFolders = new Set(held.filter((name) => typeof name === 'string'));
    }

    /**
     * TEARDOWN IS THE BROWSER'S (P14). One subscription in, one out, and no listener on
     * any object that outlives this element — which is what makes P14's two dead
     * listeners unwriteable rather than merely absent.
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        this.#unwatch?.();
        this.#unwatch = null;
        /* THE PENDING ASSIGNMENT DIES WITH THE VISIT (F-025). The Live rail's hold menu
         * writes `pendingAssignmentIndex` on its way here and Confirm consumes it; every
         * OTHER way out of this screen — Back, a route change, the shell swapping the
         * element — has to drop it, or the next person to open the library from anywhere
         * at all would have their Confirm silently assign to a slot they never held.
         *
         * A CONSUMED INTENT IS ALREADY GONE, so this is a no-op on the path that used it:
         * `#takePendingAssignment` clears the key BEFORE it assigns, for exactly that
         * reason. An intent is a one-shot, and it is cleared by whoever reads it first. */
        this.#dropPendingAssignment();
        /* The subscription is dropped; the STORE is not. It is the shell's — see
         * `#attach` — and stopping it here would take the Live screen's five favourites
         * and its loaded highlight down with this screen. */
        this.#store = null;
    }

    /**
     * READ THE PENDING ASSIGNMENT AND CONSUME IT IN ONE STEP, or answer null.
     *
     * THE READ AND THE CLEAR ARE ONE ACT because an intent that survives being read is an
     * intent that can be spent twice. The key is cleared BEFORE the assignment is
     * attempted, so a refused or failed assign leaves nothing behind to fire on the next
     * Confirm — a slot the person has stopped thinking about.
     *
     * ANYTHING THAT IS NOT A SLOT IS NOT AN INTENT. The row is a session value and the
     * router hands back whatever is stored, so a string, a float or an out-of-range number
     * answers null and Confirm behaves exactly as it always has. The bound is
     * `SLOT_NUMBERS.length` — this file's one statement of how many slots there are, the
     * same list the row menu builds its five "Favourite {n}" items from — rather than a
     * second literal beside it.
     */
    async #takePendingAssignment() {
        const storage = this.boot?.storage;
        if (!storage || typeof storage.get !== 'function') return null;
        const held = await storage.get('pendingAssignmentIndex').catch(() => null);
        this.#dropPendingAssignment();
        const index = Number(held);
        if (held === null || held === undefined || held === '' || !Number.isInteger(index)) return null;
        if (index < 0 || index >= SLOT_NUMBERS.length) return null;
        return index;
    }

    /** Drop the pending assignment, wherever the visit ends. Never throws, never waits. */
    #dropPendingAssignment() {
        const storage = this.boot?.storage;
        if (!storage || typeof storage.remove !== 'function') return;
        Promise.resolve(storage.remove('pendingAssignmentIndex')).catch(() => {});
    }

    willUpdate(changed) {
        /* The shell may set `boot` after the element is already connected — <app-root>
         * creates the element, sets the property and appends it, but a test drives the
         * other order. Both must open the screen exactly once. */
        if (changed.has('boot')) this.#attach();
    }

    /**
     * Take the SHELL'S library store and read it. Idempotent: a second call is a no-op.
     *
     * THE SHELL'S, NOT ONE OF ITS OWN, and that is a bug fix rather than a tidy-up. This
     * screen used to build a second `createProfileLibraryStore` over the same transport
     * and the same KV rows. Two stores over one set of facts means two answers: a
     * favourite assigned here was written to the server and published to THIS instance,
     * and `<live-screen>` — subscribed to `boot.library` — never heard it, so the five
     * slots on Live went on showing the old profiles until the app was reloaded. The
     * loaded-profile highlight had the same split.
     *
     * ONE OWNER PER PIECE OF STATE is the tree's own rule (`src/stores/README.md`), and
     * the shell has owned this one since it was hoisted onto the boot path.
     *
     * NOT STOPPED ON DISCONNECT, for the same reason: the store outlives this screen now.
     */
    #attach() {
        if (this.#store || !this.isConnected || !this.boot?.library) return;
        this.#store = this.boot.library;
        this.#unwatch = this.#store.subscribe((state) => { this._state = state; });
        this._state = this.#store.get();
        /* STARTED, NOT AWAITED. connectedCallback cannot block, and every state the read
         * passes through is publishable — `loading` renders the boxes with no rows, which
         * is the same picture an empty machine gives. */
        this.#store.load();
    }

    /** The store, for a suite that drives the loop. Null in the layout demo. */
    get store() { return this.#store; }

    /* ---- what is on screen ------------------------------------------------- */

    /** True when there is no shell, so the screen is the layout demo. */
    get #demo() { return this.#store === null; }

    /** The rows the listbox shows: rule 1's listable set, through the filter. */
    get #rows() {
        /* THE HIDDEN LIST IS THE SAME LIST, FROM THE OTHER SET.
         *
         * Ben, 25 August 2026, on the selector audit's finding 8: "Add the hidden toggle."
         * Slate has one beside + and Generate; Decal had only the restore icon, which the
         * audit called "a different job, and no way to browse hidden ones".
         *
         * ONE FILTER, TWO SOURCES. The query, the grouping, the fold state and the
         * highlight all belong to whichever set is on screen, so the toggle swaps the SET
         * and nothing else changes. That is also why the count in the caption is right
         * without a second reading. */
        if (this._showHidden) return matchProfiles(this._state?.hidden ?? [], this._query);
        if (this.#demo) return [];
        return matchProfiles(this._state?.listable ?? [], this._query);
    }

    /**
     * WHAT THE KEYBOARD WALKS: the VISIBLE nodes, families included, shut members not.
     *
     * A FILTERED LIST IS ALWAYS OPEN. Typing into the filter is asking to see what
     * matches, and answering with four shut families is the search returning nothing you
     * can read. So a query expands every family it produces — which is also what makes
     * the filter and the fold two controls that never fight.
     */
    get #nodes() {
        if (this.#demo) return [];
        const rows = this.#rows;
        return treeNodes(rows, this._query ? new Set(listboxGroups(rows)
            .map((group) => group.folder).filter(Boolean)) : this._openFolders);
    }

    get #selectedRecord() {
        if (this.#demo) return null;
        return this.#store.selected();
    }

    /** Which option the keyboard is on: the active one, else the selected, else first. */
    get #activeIndex() {
        const nodes = this.#nodes;
        if (nodes.length === 0) return -1;
        const idOf = (node) => (node.kind === 'folder' ? folderNodeId(node.folder) : node.record.id);
        const byActive = nodes.findIndex((node) => idOf(node) === this._activeId);
        if (byActive >= 0) return byActive;
        const selected = this._state?.selectedId;
        const bySelected = nodes.findIndex((node) => node.kind === 'profile' && node.record.id === selected);
        return bySelected >= 0 ? bySelected : 0;
    }

    /** The id `aria-activedescendant` names, or null when the list is empty. */
    get activeDescendantId() {
        const nodes = this.#nodes;
        const at = this.#activeIndex;
        if (at < 0 || !nodes[at]) return null;
        return nodes[at].kind === 'folder'
            ? optionIdFor(folderNodeId(nodes[at].folder))
            : optionIdFor(nodes[at].record.id);
    }

    /* ---- the loop ---------------------------------------------------------- */

    /**
     * NARROW THE LISTING. One rule, two ways in (audit F-030, fixed 29 August 2026).
     *
     * WHAT WAS WRONG. This was bound to `search` ALONE, and `<ui-search-field>` raises
     * `search` on Enter and on `clear()` only. So typing "Baseline" left all 42 rows on
     * screen — the audit read the listing after every one of the eight characters and
     * again after a further five seconds — until Enter was pressed, "a key nothing on the
     * glass mentions".
     *
     * IT WAS NEVER A LOST KEYSTROKE OR A LOST EVENT, and that is what makes the fix one
     * line. The audit measured the field's value reading "Baseline" at all three depths
     * and SIXTEEN `input` events raised and heard — eight on the field, eight on this
     * screen. The wire was connected; the narrowing was simply bound to submit.
     *
     * THE COMPONENT ALREADY PROMISES THIS. `ui-search-field`'s own `clear()` comment says
     * "a consumer that has wired a filter to `input` keeps working without knowing this
     * method exists" — the contract assumed a consumer that did. Enter still works, and
     * `clear()`'s pair of events now both land on the same rule instead of only the
     * second.
     */
    #applyQuery(next) {
        this._query = next ?? '';
        /* THE ACTIVE OPTION IS RELEASED ON A NEW FILTER, never carried: the row it named
         * may not be in the result, and an aria-activedescendant pointing at an id that
         * is no longer rendered is the same class of defect P12 is about. Releasing it
         * makes the getter fall back to the selection, then to the first row. */
        this._activeId = null;
    }

    #onSearch = (event) => {
        this.#applyQuery(event.detail?.value ?? '');
    };

    /**
     * EVERY KEYSTROKE, off the field's own property.
     *
     * `input` IS THE NATIVE EVENT AND CARRIES NO DETAIL — `ui-search-field` lets the
     * entry's own composed `input` travel rather than re-dispatching one ("Re-dispatching
     * would deliver it twice — the trap ui-text-field's own comment records"), and keeps
     * `value` in step with it in a handler on the element INSIDE its shadow root. That
     * handler is deeper than this one, so by the time this runs the property is current.
     */
    #onFilterInput = (event) => {
        this.#applyQuery(event.currentTarget?.value ?? '');
    };

    #onPick = (event) => {
        const id = event.currentTarget.dataset.id;
        if (!id) return;
        this._activeId = id;
        this.#store?.select(id);
    };

    /** The layout demo's rows select nothing — a placeholder has no profile to draw. */
    #onPickPlaceholder = (event) => {
        this._placeholder = event.currentTarget.dataset.title;
    };

    #onListKeyDown = (event) => {
        const nodes = this.#nodes;
        const at = this.#activeIndex;
        const next = nextActiveIndex(event.key, at, nodes.length);
        if (next === null) return;

        const move = (index) => {
            const node = nodes[index];
            if (!node) return;
            this._activeId = node.kind === 'folder' ? folderNodeId(node.folder) : node.record.id;
            this.updateComplete.then(() => {
                const el = this.renderRoot.getElementById(optionIdFor(this._activeId));
                /* `block: 'nearest'` so a row already on screen does not move the pane at
                 * all — a list that re-centres on every arrow press slides under a finger
                 * that is only reading. */
                el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            });
        };

        if (next === 'choose') {
            /* ENTER MEANS THE SAME AS A TAP, and on a family a tap folds it. */
            const node = nodes[at];
            if (node?.kind === 'folder') this.#toggleFolder(node.folder);
            else if (node) this.#store?.select(node.record.id);
        } else if (next === 'open' || next === 'close') {
            /* THE TREE'S TWO SIDEWAYS KEYS. `treeSideStep` answers with a family to open,
             * a family to shut, or an index to move to — the four cases the APG's tree
             * pattern names, and no fifth. */
            const step = treeSideStep(next, nodes, at);
            if (!step) return;
            if (step.open) this.#toggleFolder(step.open, true);
            else if (step.close) this.#toggleFolder(step.close, false);
            else move(step.index);
        } else {
            move(next);
        }
        event.preventDefault();
        event.stopPropagation();
    };

    /**
     * Fold or unfold one family, and remember it.
     *
     * THE WRITE IS NOT AWAITED and its failure is not surfaced: which families are open
     * is a convenience about this screen on this device, and a tablet that cannot write
     * to local storage should still fold. The SET is replaced rather than mutated,
     * because Lit compares by identity and a mutated Set never re-renders.
     */
    #toggleFolder(folder, force = null) {
        if (typeof folder !== 'string' || !folder) return;
        const open = new Set(this._openFolders);
        const wanted = force === null ? !open.has(folder) : force;
        if (wanted === open.has(folder)) return;
        if (wanted) open.add(folder);
        else open.delete(folder);
        this._openFolders = open;
        const storage = this.boot?.storage;
        if (storage && typeof storage.set === 'function') {
            Promise.resolve(storage.set('profileFoldersOpen', [...open])).catch(() => {});
        }
    }

    #onFolderPick = (event) => {
        const folder = event.currentTarget.dataset.folder;
        if (folder) {
            this._activeId = folderNodeId(folder);
            this.#toggleFolder(folder);
        }
    };

    /* THERE IS NO ROW-OVERFLOW HANDLER, and since 30 August 2026 there is no row
     * overflow affordance either — #26's built-in button and its `no-overflow` opt-out
     * were deleted outright (audit D11; ui-list-row.js, THE AMPUTATION). What this
     * screen slots into `slot="actions"` is the only row-actions control that exists.
     * It is still worth writing down what the
     * handler DID, because the ordering it assumed was measured backwards and the
     * remedy people reach for first is to keep it and reorder:
     *
     *   #26 does not stop the affordance's click, so the belief was "the row is already
     *   selected by the time this runs". MEASURED (wave 5.3 review, first interaction on a
     *   row's affordance): `overflow (selectedId=null, menuItems=0)` then
     *   `click-on-host (selectedId=profile:0925…)`. The composed `overflow` event is
     *   dispatched from inside the button's own click handler, so it reaches this screen
     *   BEFORE the click finishes bubbling to the host where #onPick lives. menu.show()
     *   therefore ran against items=[] and `ui-menu.js:665` sizes and positions the surface
     *   AFTER the items — a "More actions" control that opens an empty menu on first press,
     *   which is P10's dead-affordance family.
     *
     * Selecting the row here first would have fixed the ordering and kept the button
     * inside the listbox, which is the defect P12's fourth half names. So the affordance
     * leaves the listbox rows entirely and the ordering question goes with it; the actions
     * live on `<ui-menu id="actions">` in the detail pane, Q7's recorded home, where the
     * selected record is already the menu's subject before any trigger is pressed.
     */

    /**
     * A PRESS ON A FAVOURITE SLOT ASSIGNS THE SELECTED PROFILE TO IT.
     *
     * Ben, 23 Aug 2026: "I should be able to see the profile list and if I select one
     * and then press the favorite button at the bottom it should change that favorite."
     *
     * IT USED TO SELECT, and that is the reading a favourites bar normally has — press a
     * slot, go to what is in it. This screen is where the five slots are MANAGED, and
     * the thing in a slot is already one press away in the list beside it, so the press
     * is spent on the gesture that had no home: assignment. The menu's "Add to
     * favourites" stays, and takes the first EMPTY slot; this is how a slot already in
     * use gets a new profile, which is the half that was missing.
     *
     * NOTHING SELECTED IS NOT AN ERROR. `setFavourite` needs a profile to seat, and with
     * no row picked there is none — so the press does nothing rather than clearing the
     * slot. Clearing is a different gesture and it does not exist yet; inventing it on
     * the same press would make a mis-tap destructive.
     *
     * THE SLOT IS THE EVENT'S OWN INDEX, never a search for the pressed value: an empty
     * slot has no value to search by, and an empty slot is exactly the one being filled.
     */
    /**
     * SLATE'S ASSIGN ROW: the cap, then the five discs — see the markup below.
     *
     * Ben, 25 August 2026: "Can we use slates assign Favorites row, maybe reduce the
     * height a bit but have the ASSIGN FAVOURITE and the 5 round buttons."
     *
     * WHAT IT REPLACES IS A WHOLE COMPONENT, and the reason is what that component is for.
     * `<ui-favourites-bank>` is a BANK — five wide cells, each carrying a disc AND the
     * profile's name, sharing a toolbar's width. That is right on the Live header, where
     * the row IS the profile picker. Here the picker is the list beside it, and the row is
     * five targets to drop the selection into: a name in each cell says nothing the list
     * does not already say, at the price of the pane's whole width.
     *
     * `<ui-favourite-slot>` IS THE DISC ITSELF, and it is Slate's `.ps-fav-slot` to the
     * pixel — MEASURED 64 x 64 at border-radius 50 %, with `filled` for occupancy and
     * `selected` for the slot holding what is picked. The bank composes the same element;
     * this row composes it directly and drops the cells.
     */
    #favouriteSlots() {
        const t = this.#i18n.t;
        const entries = this.#demo ? [] : (this.#store?.favouriteEntries?.() ?? []);
        const selected = this._state?.selectedId ?? '';
        return SLOT_NUMBERS.map((number) => {
            const entry = entries[number - 1] ?? null;
            const held = entry?.value ?? entry?.id ?? '';
            const name = entry?.name ?? entry?.label ?? '';
            return html`<ui-favourite-slot
                data-slot=${number}
                index=${number}
                ?filled=${Boolean(held)}
                ?selected=${Boolean(held) && held === selected}
                label=${name
                    ? t('Favourite {n}: {name}', { n: number, name })
                    : t('Favourite {n}, empty', { n: number })}
                @click=${this.#onFavouriteSlot}
            ></ui-favourite-slot>`;
        });
    }

    /** A disc was pressed. Same rule as the bank's, through the same store call. */
    #onFavouriteSlot = (event) => {
        const slot = Number(event.currentTarget?.dataset?.slot);
        if (!Number.isFinite(slot)) return;
        this.#onFavouriteChange({ detail: { slot } });
    };

    #onFavouriteChange = (event) => {
        const slot = event.detail?.slot;
        const selected = this._state?.selectedId;
        if (!Number.isInteger(slot) || slot < 1) return;
        /* NOTHING PICKED, AND IT SAYS SO. Ben, 25 August 2026, asked whether Decal
         * should carry Slate's "nothing selected" message. On CONFIRM it cannot: that
         * button is disabled until a row is picked, so the state Slate alerts about is
         * unreachable and the message would be a branch nothing can enter.
         *
         * HERE IT IS REACHABLE, and until now it was a silent return - the disc absorbed
         * the press and reported nothing, which is the same "reads as nothing happened"
         * Slate's duplicate-guard comment is about. Slate says it too, in the else-branch
         * of the same gesture: profile_selector.js:1110, "Please select a profile from the
         * list to assign it." */
        if (!selected) {
            this.#notice(this.#i18n.t('Pick a profile from the list to assign it.'), 'warn');
            return;
        }
        /* THE MARK IS 1-BASED AND THE STORE IS 0-BASED, and the conversion is here
         * because that is where the two meanings meet. <ui-favourites-bank> answers with
         * the number a person reads off the disc; `setFavourite` keys the assignments map
         * by array index. Passing one for the other seats the profile in the slot NEXT to
         * the one that was pressed — measured, once, by this screen's own loop suite. */
        this.#assign(slot - 1, selected);
    };

    /**
     * Assign a profile to a slot and SAY WHAT HAPPENED.
     *
     * Ben's call, 25 August 2026: "Assigning a profile already on a slot: Copy Slate."
     * Slate refuses the duplicate and puts an error toast on screen naming the slot that
     * already holds it; the store carries the refusal, and this carries the words.
     *
     * THE SUCCESS TOAST IS SLATE'S TOO - profile_selector.js:1098, "Assign to favourite
     * {n}: <title>", shown only on a genuinely new assignment. Its own note says why the
     * two cases cannot share one message: a rejected assign has already put its error on
     * screen, and a success toast a few hundred ms later overwrites it before it can be
     * read.
     *
     * IT ASKS THE STORE FIRST rather than after. `favouriteSlotHolding` is the rule
     * `setFavourite` refuses on; reading it before the call is what lets the message name
     * a slot, and reading it after would name the slot the write had just made.
     *
     * `load` IS AN OPTION AND EVERY CALLER IN THIS FILE NOW TAKES THE DEFAULT — which is
     * a decision with a history, and the history is why the option survives rather than
     * being inlined. Round 1 of the fix campaign (F-025, 29 August 2026) built the pending
     * Confirm as assign-without-load and flagged the choice; **Ben overruled it the next
     * morning (decision D01)**: assigning a profile to a slot loads it, whether the
     * gesture was a press on the disc or a Confirm consuming a slot held on the Live rail.
     * One act, one answer. The option stays because `load: false` is still the honest
     * spelling of "seat it, do not touch the machine" the day a caller wants it, and
     * because deleting it would leave `#onConfirmChosen`'s history unreadable.
     *
     * ONE METHOD EITHER WAY: two would be two duplicate guards and two vocabularies for
     * one refusal.
     *
     * IT ANSWERS WHETHER IT ASSIGNED, so a caller that wants to navigate afterwards does
     * not navigate away from its own refusal message.
     */
    async #assign(index, id, { load = true } = {}) {
        const store = this.#store;
        if (!store || typeof store.setFavourite !== 'function') return false;
        const t = this.#i18n.t;
        const held = store.favouriteSlotHolding?.(id) ?? null;
        if (held !== null) {
            const title = store.recordFor?.(id)?.profile?.title;
            this.#notice(
                title
                    ? t('“{title}” is already on favourite {n}', { title, n: held + 1 })
                    : t('That profile is already on favourite {n}', { n: held + 1 }),
                'danger',
            );
            return false;
        }
        return Promise.resolve(store.setFavourite(index, id)).then(async () => {
            const title = store.recordFor?.(id)?.profile?.title;
            /* AND THE PRESS LOADS IT. Ben, 25 August 2026, on "Slate's press also loads
             * the profile onto the machine": "yes do that as well."
             *
             * SLATE'S THREE CALLS ARE Decal's ONE. profile_selector.js:1091-1094 sends
             * `updateWorkflow`, then `setActiveProfile`, then `updateProfileName`;
             * `store.arm` is all three — it POSTs the profile, remembers the id at the one
             * moment it is certain, applies the workflow body and re-reads.
             *
             * IT DOES NOT NAVIGATE, which is the one thing it shares with Slate's version
             * and not with Confirm's. Confirm's whole gesture is "this profile, now, on the
             * Live screen"; this one is "this profile, on this slot" and the screen you are
             * on is the one you meant to be on.
             *
             * ONLY ON A SUCCESSFUL ASSIGN. Slate loads on a REFUSED one too - the branch
             * above returns before this - and that is a difference on purpose: Decal's
             * refusal says "already on favourite 1", and a machine that changed profile
             * anyway would make that sentence a lie about a press that did nothing.
             *
             * TWO ENDINGS AND TWO SENTENCES, 27 August 2026. This used to say "The machine
             * refused this profile." for EVERY status that was not ARMED — including the
             * one Ben hit with no machine connected, where the machine made no statement
             * at all because it was not there to make one. A refusal is the machine's own
             * word and keeps the danger tone; a transport failure means the profile was
             * chosen, written into the workflow document and is waiting for a machine, so
             * it warns rather than alarms and it says what is actually true. The wording
             * is the SAME KEY the Live banner's headline uses, so the two surfaces cannot
             * drift into two vocabularies for one fact. */
            if (title) this.#notice(t('Favourite {n}: {title}', { n: index + 1, title }), 'ok');
            if (!load) return true;
            const armed = await store.arm?.(id);
            if (armed && armed.status === ARM_STATUS.REFUSED) {
                this.#notice(t('The machine refused this profile.'), 'danger');
            } else if (armed && armed.status !== ARM_STATUS.ARMED) {
                this.#notice(t('The machine has not been given this profile yet'), 'warn');
            }
            return true;
        }).catch(() => false);
    }

    /** Put one line on the screen's toast, if the toast has rendered yet. */
    #notice(message, tone) {
        this.renderRoot?.getElementById('notice')?.show?.(message, { tone, duration: 3000 });
    }

    /**
     * HIDE, CONFIRMED. The store owns the route, the 404-is-already-gone reading and the
     * re-read; this only asks, and clears the query so the list the user lands on is the
     * whole library rather than a filter that may now match nothing.
     */
    #onConfirmHide = () => {
        const id = this._state?.selectedId;
        if (!id || !this.#store || typeof this.#store.hide !== 'function') return;
        Promise.resolve(this.#store.hide(id)).catch(() => {});
    };

    /**
     * RESET IS OFFERED ONLY WHERE IT MEANS SOMETHING, which is the one place this row
     * departs from Slate's always-three.
     *
     * A reset is `restoreToFactory`, and the route it spends takes a BUNDLE FILENAME off
     * the record's own metadata: a profile the user wrote has no bundle to go back to, so
     * the control would be permanently disabled on most of the list. A control that can
     * never do anything is a dead affordance, which is this tree's own rule and the reason
     * the toolbar's restore icon is only rendered when there is something to restore.
     */
    get #canReset() {
        const record = this.#selectedRecord;
        return Boolean(record) && restoreFilenameOf(record) !== null;
    }

    /**
     * SWAP THE SET, AND DROP THE SELECTION WITH IT.
     *
     * A selection made in one list has no meaning in the other: the detail pane would go
     * on naming a profile the list beside it is no longer showing, which is the sentence
     * the store's own hide rule is written against. Clearing is the honest answer and it
     * is one call.
     */
    #onToggleHidden = () => {
        this._showHidden = !this._showHidden;
        this.#store?.select?.(null);
    };

    #onHidePress = () => {
        if (!this._state?.selectedId) return;
        this.renderRoot.getElementById('confirm-hide')?.show({ reason: 'detail-actions' });
    };

    #onResetPress = () => {
        const id = this._state?.selectedId;
        if (!id || !this.#canReset) return;
        this.renderRoot.getElementById('confirm-reset')?.show({ reason: 'detail-actions' });
    };

    /**
     * REMOVED. The store owns the route, the 404-is-already-gone reading and the re-read;
     * this only asks, and it has already asked.
     */
    #onConfirmRemove = () => {
        const id = this._state?.selectedId;
        if (!id || typeof this.#store?.purge !== 'function') return;
        Promise.resolve(this.#store.purge(id)).catch(() => {});
    };

    /** The one profile, back to its bundle. The store owns the filename and the re-read. */
    #onConfirmReset = () => {
        const id = this._state?.selectedId;
        if (!id || typeof this.#store?.restoreToFactory !== 'function') return;
        Promise.resolve(this.#store.restoreToFactory(id)).catch(() => {});
    };

    #onEditPress = () => { this.#openEditor(); };

    /**
     * Delete for good — ask first.
     *
     * THE SAME DIALOG THE ROW MENU OPENS, and the same reason it exists: this is the one
     * route on the screen that removes a record, so the question carries what it costs
     * rather than only what it is about.
     */
    #onDeletePress = () => {
        if (!this._state?.selectedId) return;
        this.renderRoot.getElementById('confirm-remove')?.show({ reason: 'actions' });
    };


    /**
     * THE HANDOFF TO THE EDITOR (`dec-A-B-1`), and it is TWO STEPS BECAUSE IT HAS TO BE.
     *
     * The record is seated in the SHELL'S store (`boot.profileEditor`) and only then is
     * the route asked for, because a route swap destroys this screen — `<app-root>`
     * removes the outgoing element before creating the incoming one — so a record handed
     * over any other way would go with it. `open(record)` touches no route at all: the
     * listing is already in hand, and re-reading a record somebody just handed over is a
     * request nobody needed (`profile-editor-store.js open()`).
     *
     * IT IS THE RECORD, NOT THE ID. `GET /profiles/{id}` exists and `loadById` is its
     * caller, but that is the DEEP-LINK path; here the whole ProfileRecord is already the
     * selected row's own object. That also keeps the trip working against the capture
     * mock, which has no `api__v1__profiles~<id>.json` recording and answers 503 for it.
     *
     * The invoker is named so the caret comes back to the menu trigger on the way back.
     */
    /**
     * A BLANK PROFILE, SEATED IN THE EDITOR — Slate's + and nothing more.
     *
     * IT IS NOT SAVED HERE. Slate's + lands on the editor with a profile called "New
     * Profile"; whether it exists on the machine is the editor's Save to decide. Writing a
     * record on the way past would leave an empty profile behind every time someone pressed
     * + and changed their mind, which is the defect this skin catalogues as a control with
     * a side effect nobody asked for.
     *
     * THE SHAPE IS THE ONE THE EDITOR ALREADY TAKES, not a second one: `profileEditor.open`
     * is handed a RECORD — `{ id, profile }` — and everything it needs is `profile`. A new
     * profile's id is null, which is exactly what an unsaved record is, and the editor's
     * Save is what turns null into an id.
     *
     * ONE STEP, ONE NAME — AND THE STEP HALF WAS NOT WRITTEN UNTIL 27 AUGUST 2026.
     *
     * That sentence sat three lines above `steps: []` for as long as this door existed. Ben
     * found the other end of it: "in profile selector, if I press the button to make a new
     * profile it loads the profile editor but there is no steps, wich means there is not +
     * button to add a new step etc, ie I cannot add any steps." A profile with no steps has
     * no step columns; the per-step action rail is the ONLY route to a new step; so the +
     * opened an editor nobody could edit. A comment that claims what the code does not do
     * is the same defect as the code, one layer up, and it is why this one is now this
     * long.
     *
     * THE PROFILE IS BUILT BY `rea-profile.js newProfile()` AND NOT SPELLED HERE. Two
     * reasons, and the second is the one that bites:
     *
     *   1. THE STEP IS SHARED. `profile-modes.js NEW_STEP` carries Ben's own six values
     *      ("a pressure profile step with a target of 8bar, flow limit of 8ml/s and a target
     *      temperature of 85c at the coffee duration of 30s, no exit conditions") and the
     *      editor's own `insert-after` key seeds from the same object. A blank step written
     *      at two call sites is a blank step that will disagree with itself.
     *   2. `{ title, steps }` WAS NEVER A SAVEABLE PROFILE EITHER. `POST /api/v1/profiles`
     *      requires `title`, `steps`, `target_volume_count_start` and `tank_temperature`
     *      (`rea-routes.generated.js`, the pinned spec) and a profile document carries ten
     *      keys (`PROFILE_FILE_KEYS`). This literal had two. Nobody had reached the Save,
     *      because nobody could add a step — the second half of the same defect, hidden
     *      behind the first.
     *
     * THE TWO STRINGS ARE STILL THIS SCREEN'S, because D2 puts a translation where a
     * translator is and `rea-profile.js` is a DOM-free data module. Slate calls the profile
     * "New Profile" and the step "New Step"; both are `t()` of a key here.
     */
    #openNewProfile() {
        if (!this.boot?.profileEditor) return;
        const t = this.#i18n.t;
        this.boot.profileEditor.open({
            id: null,
            profile: newProfile({
                title: t('New profile'),
                stepName: t(NEW_STEP_NAME_KEY),
            }),
        });
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker: 'add-menu' },
            bubbles: true,
            composed: true,
        }));
    }

    #openEditor() {
        const record = this.#selectedRecord;
        if (!record || !this.boot?.profileEditor) return;
        this.boot.profileEditor.open(record);
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker: 'detail-actions' },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * THE ROW SAYS WHICH FAVOURITE IT IS, if it is one.
     *
     * Ben, 23 Aug 2026: "the profile list, on the right side of the list should have a
     * little box with the facorite number."
     *
     * NOTHING NEW IS DRAWN. <ui-list-row> already carries a `favourite` slot for exactly
     * this, and <ui-badge> is the chip it already puts in the same row for "Loaded" —
     * whose own `label` property exists, in its words, "for a badge whose visible content
     * is a bare number".
     *
     * NOT <ui-favourite-slot>, WHICH IS THE STRIP'S MARK, and the difference is not
     * cosmetic: that component renders a BUTTON, and this row is an `option` inside a
     * `listbox`. P12 is the rule that only options and groups live in there, and the
     * suite caught the button immediately. The strip's mark is a control because it is
     * pressed; a row's mark states a fact, and a fact is a badge.
     *
     * ASSIGNMENTS ARE KEYED BY SLOT INDEX, so this walks them rather than indexing by
     * profile: the same profile can sit in two slots, and the first one wins here for
     * the same reason it wins in the strip — the marks read left to right.
     */
    /**
     * THE TITLE, WITH THE FILTER'S MATCH MARKED.
     *
     * Ben, 25 August 2026, on the selector audit's finding 7: "Highlight the match."
     *
     * THE PIECES ARE `profile-listbox.js`'s and the paint is this screen's, which is the
     * split every pure/rendered pair in this tree uses: the module says WHERE the match is
     * and can be tested without a browser; the screen decides what a match looks like.
     *
     * `<mark>` AND NOT A SPAN. It is the element the platform has for "this is here
     * because you searched for it", it carries that meaning to a screen reader without a
     * label, and its paint is one rule below rather than a colour on a class.
     */
    #titleParts(title) {
        const parts = highlightParts(title, this._query);
        if (parts.length === 1 && !parts[0].hit) return title;
        /* THE TAG IS BROKEN OVER TWO LINES because gate D reads a template chunk carrying
         * a slash with no newline as a route assembled from fragments, and a closing tag
         * looks exactly like one from outside the file. The break is invisible in the
         * output — lit does not add whitespace at a binding boundary. */
        return parts.map((part) => (part.hit
            ? html`<mark class="hit">${part.text}</mark
                >`
            : part.text));
    }

    /**
     * A MENU ON EVERY ROW — Slate's, and the audit's finding 5.
     *
     * Ben, 25 August 2026: "add the ... so that we can hide it, assign it".
     *
     * THE SCREEN HELD THE OPPOSITE POSITION AND ITS REASONING IS ONE SCREEN UP, at
     * `#onFavouriteSlot`'s neighbour: "the actions leave the listbox rows entirely and the
     * ordering question goes with it". That question was real — a button inside a listbox
     * row has to decide whether pressing it selects the row first — and it is ANSWERED
     * here rather than avoided: the trigger stops the press from reaching the row, and the
     * menu acts on the record it was opened from rather than on the selection. A row's
     * menu never changes what is selected, so there is no ordering to get wrong.
     *
     * THE DETAIL PANE'S ACTIONS STAY. They are the same actions for the SELECTED profile,
     * as three buttons rather than a menu (finding 6), and having both is Slate's
     * arrangement exactly.
     */
    #rowMenu(record, isActiveRow = false) {
        const t = this.#i18n.t;
        const id = record?.id;
        if (!id) return nothing;
        return html`<ui-menu
            slot="actions"
            class="row-menu"
            label=${t('Actions for {name}', { name: record.profile?.title || t('Untitled') })}
            .items=${this.#rowMenuItems(record)}
            @select=${(event) => this.#onRowMenuSelect(event, id)}
            @click=${(event) => event.stopPropagation()}
        >
            <!-- A SPAN, NOT A BUTTON, AND THAT IS THE P12 LAW RATHER THAN AN OVERSIGHT.
                 A <button> inside a role="tree" is reported as a button child of the
                 tree, and 78 of them is the exact defect this screen already paid for
                 once: measured with CDP Accessibility.getFullAXTree, 78 operable "More
                 actions" nodes, a listbox with 79 tab stops, and every option's name
                 reading "Preinfuse then 45ml of water More actions".

                 aria-hidden AND tabindex=-1 ON A ui-icon-button WERE NOT ENOUGH: the
                 component renders its own <button> inside its shadow root, and the P12
                 probe walks shadow roots and reports focusables. MEASURED after that
                 attempt: 78 (focusable:ui-icon-button) and 83 button, unchanged. The only
                 element that is neither is one that was never a button.

                 ui-menu TAKES ITS TRIGGER EVENTS ON THE SLOT (ui-menu.js:696), so a span
                 opens the menu exactly as the button did. The pointer gesture Ben asked
                 for ("add the …") is unaffected.

                 THE KEYBOARD ROUTE IS OWED. Assign, Edit and Versions are reachable
                 another way; REMOVE FOR GOOD IS NOT, and that is an open item rather than
                 a settled one.

                 THE NAME IS HERE NOW, AND IT COST A CHANGE IN ui-list-row TO MAKE IT
                 SAFE (audit F-016 #8, closed 29 August 2026 after being attempted and
                 parked earlier the same night). Wave 1 rowed this span as one of sixteen
                 controls whose accessible name is the empty string, and said why: the
                 element carrying the glyph was itself aria-hidden, so the element that
                 TAKES THE PRESS was hidden along with the decoration.

                 THE OBVIOUS FIX ON ITS OWN COSTS MORE THAN IT BUYS, and that was
                 measured before this line was written. Moving aria-hidden onto an inner
                 glyph span and putting an aria-label on this one does give the opener a
                 name -- and Chrome then folded that name into the ROW's, because a
                 treeitem with no explicit label is named from its contents and a
                 labelled descendant is part of them. Measured with
                 Accessibility.getFullAXTree, every row's name became

                     "Alpha bloom Loaded More actions for Alpha bloom"

                 which is the defect the paragraph above this one is about, in a smaller
                 form.

                 WHAT CLOSED IT is the second of the two routes that note named:
                 ui-list-row now composes its OWN aria-label, from its own content, for
                 any row whose list has given it a role. Name-from-content therefore never
                 runs on these rows and a labelled descendant cannot enter their names --
                 so this span may be named, and is. The row's name is unchanged
                 ("Alpha bloom Loaded"), which is asserted in ui-list-row's own suite
                 against the real AX tree rather than argued here.

                 THE GLYPH KEEPS aria-hidden, ON ITS OWN SPAN. The decoration is not the
                 name; without this the opener would be announced as "More actions for
                 Alpha bloom ⋯". The role walk and the tab-stop count are unaffected: a
                 span with an aria-label and no role and no tabindex is reported as
                 nothing by P12's walk, which is why role="button" was never a candidate.

                 THE KEYBOARD ROUTE IS OPEN NO LONGER — Ben's decision D21, 30 August
                 2026, and the ROVING TABINDEX is what makes it compatible with everything
                 above. Read the two numbers together: P12's complaint was SEVENTY-EIGHT
                 operable nodes and SEVENTY-NINE tab stops, measured; this adds exactly
                 ONE, on the row the tree's own aria-activedescendant already names, and
                 it moves with the arrow keys. Tab from the listing reaches the opener for
                 the row you are standing on and nothing else — which is the shape the
                 APG's own "actions in a composite widget" advice describes, and the
                 opposite of a tab stop per row.

                 role="button" COMES WITH THE TABINDEX AND NOT BEFORE IT. An unlabelled
                 focusable generic is worse than either end state: a caret lands on
                 something a screen reader cannot classify. The role is written only where
                 the element is actually reachable, so the 77 openers that are not on the
                 active row stay exactly what the F-016 #8 note above describes — a named
                 span with no role and no tabindex, reported as nothing by a role walk.

                 ENTER AND SPACE ARE HANDLED HERE, ARROWS BY THE COMPONENT. ui-menu's
                 #onTriggerKeydown takes ArrowDown/ArrowUp on the slot and says in its own
                 words why Enter and Space are absent from it: "the trigger is a real
                 button, its native click opens the menu through #onTriggerClick". A span
                 is not, and no native click arrives — so the two keys are supplied by the
                 consumer that chose the span, rather than by widening the component for
                 everybody. show() is its public door and it remembers the opener as the
                 focus to return to, so the caret comes back here when the menu closes.

                 aria-haspopup AND aria-expanded ARE NOT WRITTEN HERE: ui-menu's
                 #syncTrigger puts both on whatever is slotted, and keeps aria-expanded in
                 step with the open state. A second copy would be a second owner. -->
            <span
                slot="trigger"
                class="row-dots"
                role=${isActiveRow ? 'button' : nothing}
                tabindex=${isActiveRow ? '0' : nothing}
                aria-label=${t('More actions for {name}', { name: record.profile?.title || t('Untitled') })}
                @keydown=${this.#onRowMenuKey}
            ><span class="row-dots-glyph" aria-hidden="true">⋯</span></span>
        </ui-menu>`;
    }

    /**
     * Enter and Space open a row's actions menu (D21).
     *
     * The two keys a focused button answers, supplied for an element that is deliberately
     * not one. `ui-menu` already owns ArrowDown/ArrowUp on the same slot, and it explains
     * in its own source why Enter and Space are not among them: it expects a real
     * `<button>`, whose native click it hears instead. This screen may not put a button in
     * a tree (bug P12, measured at 78 of them), so it supplies the keys itself.
     *
     * IT ASKS THE MENU RATHER THAN SYNTHESISING A CLICK. `show()` is the component's public
     * door, it takes focus into the first item — which is the whole point of arriving by
     * keyboard — and it records the opener as the element to return focus to when the menu
     * closes. A dispatched `click` would open the menu WITHOUT moving focus (the
     * component's own documented difference) and leave the caret on a menu it cannot reach.
     *
     * THE PRESS DOES NOT REACH THE ROW. Without `stopPropagation` the same keystroke would
     * also be the tree's, and Enter on the tree CHOOSES the active option — so one key
     * would both open a menu and load a profile.
     */
    #onRowMenuKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const menu = event.currentTarget?.closest?.('ui-menu');
        if (!menu || menu.open) return;
        event.preventDefault();
        event.stopPropagation();
        menu.show({ focus: 'first', reason: 'keyboard' });
    };

    /**
     * WHAT A ROW'S MENU OFFERS: the five slots by number, then edit, then hide.
     *
     * ASSIGNMENT IS BY SLOT AND NOT "add to favourites", which is the difference from the
     * pane's own menu and is Ben's own words for it ("hide it, assign it"). Slate lists
     * Assign to favourite 1-5; the five rows say which slot, and a slot that already holds
     * something says what it holds, so a press is never a blind overwrite.
     */
    #rowMenuItems(record) {
        const t = this.#i18n.t;
        const assignments = this._state?.favourites?.assignments ?? {};
        const items = SLOT_NUMBERS.map((number) => {
            const held = assignments[number - 1] ?? null;
            const holder = held ? this.#store?.recordFor?.(held) : null;
            const name = holder?.profile?.title ?? '';
            return {
                id: `${ACTION.ASSIGN}:${number}`,
                label: name
                    ? t('Favourite {n} — replace {name}', { n: number, name })
                    : t('Favourite {n}', { n: number }),
                selected: held === record.id,
            };
        });
        items.push({ separator: true });
        items.push({ id: ACTION.EDIT, label: t('Edit profile') });
        /* VERSIONS LANDED HERE when the detail pane's overflow menu went. Ben's "Copy
         * slate" on the three-buttons question replaced that menu with Hide / Reset /
         * Edit, and Slate has no versions surface to copy - so B11 / Q7's entry point had
         * nowhere left to be, and `#menuItems` sat unreachable with "Previous versions"
         * inside it — that builder is deleted now, and this is the door. A surface with no
         * door is the same defect as a door with no surface. */
        items.push({ id: ACTION.VERSIONS, label: t('Previous versions') });
        items.push({ separator: true });
        /* BOTH, ALWAYS, BECAUSE THEY ARE TWO DIFFERENT THINGS. Ben, 25 August 2026:
         * "Hide should hide, delete should delete after confirmation."
         *
         * IT USED TO BE ONE OR THE OTHER — Hide on a listable profile, Remove on a hidden
         * one — which made removing a profile two deliberate steps and put the dangerous
         * one behind a view you had to choose. That was a safety design, and it was also
         * why the words could not be trusted: a menu that offers only Hide, on a screen
         * where Delete exists somewhere else, is a menu that does not say what is
         * possible.
         *
         * THE SAFETY MOVED TO THE CONFIRM, where the words are. Hide asks and names the
         * profile. Delete asks and says, in a sentence, that it cannot be undone and that
         * Restore will not bring a bundled one back. One press is enough to reach a
         * question; it is not enough to reach the route.
         *
         * HIDE IS ABSENT ON AN ALREADY-HIDDEN PROFILE, and that is the one gate left: it
         * is already hidden, so the action has nothing to do. Delete has something to do
         * in both states. */
        if (!this._showHidden) items.push({ id: ACTION.HIDE, label: t('Hide'), danger: true });
        items.push({ id: ACTION.REMOVE, label: t('Delete'), danger: true });
        return items;
    }

    /**
     * A ROW'S MENU ACTS ON THAT ROW, never on the selection.
     *
     * It is what makes the affordance safe to put back inside the listbox: the record is
     * captured when the menu is built, so nothing depends on a selection that a press may
     * or may not have moved first.
     */
    #onRowMenuSelect(event, id) {
        const chosen = String(event.detail?.id ?? '');
        if (chosen.startsWith(`${ACTION.ASSIGN}:`)) {
            const slot = Number(chosen.slice(ACTION.ASSIGN.length + 1));
            if (Number.isFinite(slot)) this.#assign(slot - 1, id);
            return;
        }
        if (chosen === ACTION.EDIT) {
            this.#store?.select(id);
            this.#openEditor();
            return;
        }
        if (chosen === ACTION.VERSIONS) {
            /* THE SAME TWO CALLS the old detail-pane menu made — ask the store for the
             * lineage, then open the surface that reads it. `select` first, because the
             * dialog's body names the profile it is about and reads the selection to do
             * it, exactly as the Hide confirm below does. */
            this.#store?.select(id);
            this.#store?.versionsOf(id);
            this.renderRoot.getElementById('versions')?.show({ reason: 'row-menu' });
            return;
        }
        if (chosen === ACTION.REMOVE) {
            this.#store?.select(id);
            this.renderRoot.getElementById('confirm-remove')?.show({ reason: 'row-menu' });
            return;
        }
        if (chosen === ACTION.HIDE) {
            /* THE CONFIRM NAMES ONE PROFILE and reads the selection, so the row's own
             * profile has to become the selection before the question is asked. This is the
             * one place a row menu moves it, and it moves it to the profile the user just
             * pointed at — which is what they would have done by hand. */
            this.#store?.select(id);
            this.renderRoot.getElementById('confirm-hide')?.show({ reason: 'row-menu' });
        }
    }

    #favouriteMarkFor(id) {
        const assignments = this._state?.favourites?.assignments;
        if (!id || !assignments) return nothing;
        for (const [index, held] of Object.entries(assignments)) {
            if (held !== id) continue;
            const slot = Number(index) + 1;
            if (!Number.isFinite(slot)) return nothing;
            /* THE MARK IS THE DISC, NOT A PILL.
             *
             * Ben, 25 August 2026: "for the favorites, in the list can you make the icon
             * round, like the buttons below."
             *
             * `<ui-favourite-slot>` IS the button below — the same element the assign row
             * spends, at the same 64px and the same 50 % radius — so the two now match by
             * construction rather than by a rounded pill happening to look similar.
             *
             * `inert` AND `filled`. A row's mark says which slot holds this profile; it is
             * not a target. `filled` is the occupancy paint, which is exactly what a mark
             * on a row means, and inert keeps it out of the tab order so the ROW stays the
             * one thing a press lands on. */
            return html`<ui-favourite-slot
                slot="favourite"
                class="row-fav"
                inert
                aria-hidden="true"
                filled
                index=${slot}
                label=${this.#i18n.t('Favourite {slot}', { slot })}
            ></ui-favourite-slot>`;
        }
        return nothing;
    }

    /**
     * CANCEL LEAVES. It had no handler at all — Ben, 23 Aug 2026, could reach this
     * screen and not get off it, which is the same missing-listener class as the
     * `navigate` event itself: the button was composed and never wired.
     *
     * `{ back: true }` and not a route, for the reason the shell's own back() gives: it
     * pops the entry this shell pushed when it pushed one, and navigates when it did
     * not. A user who opened #/selector directly has something else underneath, and
     * popping would take them out of the app.
     */
    #onCancelPress = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true }, bubbles: true, composed: true,
        }));
    };

    /**
     * CONFIRM LOADS THE PROFILE. It does not ask whether you meant it.
     *
     * BEN SAID THIS TWICE. 23 August: "Pressing confirm in the profile selector doesn
     * close the page, just asks for confirmation." Half of that was fixed — the press now
     * leaves for Live — and the half left behind is the half he named first: a button
     * labelled CONFIRM that opens a dialog asking you to confirm asks the same question
     * twice, and the second asking teaches nothing the first did not.
     *
     * IT IS ALSO SLATE'S OWN BEHAVIOUR. `handleConfirm` (profile_selector.js:389) writes
     * the workflow and returns to the Live page; there is no dialog anywhere in it.
     *
     * AND LOADING IS REVERSIBLE, which is what makes the confirm unnecessary rather than
     * merely annoying: the profile that was loaded before is still in the library, one
     * press away, and nothing is written that a second load does not overwrite.
     */
    #onConfirmPress = () => {
        if (!this._state?.selectedId) return;
        /* THE REFUSAL SURFACE IS CLEARED AT THE POINT OF ASKING, not at the point of
         * answering: a banner left over from the last profile beside a new question is
         * the worst reading available. `clear()` is the arm store's own word for it. */
        this.#store.clearRefusal();
        Promise.resolve(this.#onConfirmChosen()).catch(() => {});
    };

    /**
     * WHAT CONFIRM MEANS DEPENDS ON HOW YOU GOT HERE (audit F-001 / F-025, 29 Aug 2026).
     *
     * ARRIVING FROM THE LIVE RAIL'S HOLD MENU is arriving with a question already asked:
     * "Replace with" on a filled slot, or "Browse Profiles" on an empty one, both mean
     * *fill THIS slot*. `live-wiring.js` writes the slot as `session
     * pendingAssignmentIndex` on the way out — an intent, never a write — and this is the
     * one place that consumes it. Ben found the gap by hand: "I can select 'replace' which
     * opens up the profile selection page, but when I click confirm it doesn't change the
     * favourite, it just loads it like the normal profile page."
     *
     * ARRIVING ANY OTHER WAY — the header's library button, a route — leaves the key
     * absent, and Confirm is exactly the button it has always been: arm the profile and go
     * to Live. That is the branch below and it is untouched.
     *
     * THE INTENT IS CONSUMED BEFORE THE ASSIGNMENT IS TRIED, not after, so a refusal (the
     * profile is already on another slot) ends the gesture rather than arming a second
     * one. And a refused assignment does NOT navigate: its message is on this screen and
     * leaving would take it away before it could be read.
     *
     * ================================================================
     * IT ASSIGNS **AND** LOADS — BEN'S CALL, 29 AUGUST 2026 (decision D01)
     * ================================================================
     * Round 1 built this half as assign-WITHOUT-load and flagged it for him, reasoning
     * that `L0307` names the slot and says nothing about the machine, so a trip made to
     * change a shortcut should not change what is running. Ben overruled it: a Confirm
     * that consumes a pending slot does what a press on a favourite DISC does — seats the
     * profile on the slot and puts it on the machine — which is his 25 August ruling on
     * the disc ("yes do that as well") applied to the other door into the same act.
     *
     * SO THERE IS ONE ANSWER TO "WHAT DOES PICKING A PROFILE FOR A SLOT DO", not two that
     * depend on which affordance you reached it through. That is the whole of the change:
     * `#assign`'s `load` option goes back to its default here, and the arming, the two
     * refusal sentences and the ok toast are the disc's own, unduplicated.
     *
     * A MACHINE REFUSAL STILL LEAVES FOR LIVE, and that is deliberate rather than
     * overlooked. The ASSIGNMENT succeeded — the rail changed, which is the thing the
     * gesture was for — and the refusal is not lost by going: `profile-library-store`
     * holds it, and `<live-refusal>` on the screen this navigates to renders it from that
     * same store (`live-wiring.js get refusal()`). Compare `#onConfirmLoad` below, which
     * MUST stay put on a refusal because nothing else happened there and leaving would
     * take the only account of the press away with it.
     */
    async #onConfirmChosen() {
        const pending = await this.#takePendingAssignment();
        if (pending === null) return this.#onConfirmLoad();

        const id = this._state?.selectedId;
        if (!id) return undefined;
        const assigned = await this.#assign(pending, id);
        if (!assigned) return undefined;
        /* AND THE TRIP ENDS WHERE IT STARTED. The gesture began on the Live screen, on a
         * slot the person was looking at; the ending that answers it is that slot, filled,
         * on the screen they left. Same navigation Confirm's own load half makes. */
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'live' }, bubbles: true, composed: true,
        }));
        return undefined;
    }

    /**
     * LOAD IT, AND LEAVE.
     *
     * The dialog's Load used to call `arm()` and stop there, so a person confirmed a
     * profile and stayed on the picker with no sign anything had happened — Ben, 23 Aug
     * 2026: "Pressing confirm in the profile selector doesn't close the page". Picking a
     * profile is a round trip to Live, exactly as it is in the old app: you pick, the
     * machine takes it, and you are looking at the screen you pull the shot on.
     *
     * ONLY A REFUSAL STAYS PUT, and that is a change of 27 August 2026. This used to read
     * "only on a 200": every ending that was not ARMED kept the user on the picker and
     * toasted "The machine refused this profile." With no machine connected that sentence
     * was simply false — the machine made no statement at all, it was not there to make
     * one — and the profile HAD been chosen. `profile-library-store.js` `arm()` now writes
     * the workflow document on everything except a refusal, and ReaPrime's
     * `WorkflowDeviceSync` delivers it when a DE1 connects, so the load succeeded in every
     * sense a person cares about and the trip to Live is the right ending.
     *
     * A REFUSAL IS THE ONE ENDING THAT MUST NOT LEAVE. The document was deliberately not
     * written, the machine is still holding the profile from before, and navigating away
     * would hide the one surface B9 exists for. `ARM_STATUS` is the arm store's own word
     * for what happened, read rather than re-derived from a result shape.
     *
     * AN ABSENT ANSWER IS TREATED AS THE REFUSAL, not as the success: `arm()` returns null
     * when nothing matched the selected id, and leaving the picker on the strength of a
     * load that never happened is the worse of the two mistakes.
     *
     * WHAT SAYS THE OTHER HALF. A transport failure is not silent any more, but its
     * sentence is not here: `live-wiring.js` (ARM_UNDELIVERED) renders it on the Live
     * screen this navigates to, because that is where the person is standing a moment
     * later and because one sentence in one place cannot drift from itself.
     */
    #onConfirmLoad = async () => {
        const armed = await this.#store?.arm();
        /* NOTHING WAS ASKED OF ANYBODY. `arm()` answers null when no record matched the
         * selected id, so no request went out and there is nothing to report and nowhere
         * to go. Staying put with the selection on screen is the whole of the remedy. */
        if (!armed) return;
        if (armed.status === ARM_STATUS.REFUSED) {
            /* A REFUSAL IS SPOKEN, NOT ONLY WRITTEN DOWN. Ben, 25 August 2026, on the
             * audit's "Verification" row: "I think we should do the alert() as well?"
             *
             * NOT alert(). Slate's is a native browser dialog: it cannot be styled, it
             * does not obey the skin's focus rules, and inside a tablet WebView it is the
             * HOST's dialog rather than the app's. What Ben is asking for is that a
             * refusal INTERRUPT rather than sit quietly, and the toast does that in the
             * skin's own components.
             *
             * THE BANNER STAYS. It is the durable record - it names the error and its
             * remedy, and it survives until the refusal is acknowledged. The toast is the
             * announcement; `danger` makes it an assertive one, so it is spoken as well as
             * shown. A refusal that only paints a banner in the detail pane can be missed
             * by someone whose eyes are on the list they just pressed from. */
            this.#notice(this.#i18n.t('The machine refused this profile.'), 'danger');
            return;
        }
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'live' }, bubbles: true, composed: true,
        }));
    };

    /**
     * D6, FIRST HALF. Restore one bundled profile, from the surface that lists them.
     *
     * NO CONFIRMATION DIALOG, and that is a reading of the handler rather than a saving
     * of clicks: `restoreDefault` un-hides the factory record where it survives and
     * re-creates it from the bundle where it does not (`profile_controller.dart:398-416`).
     * It deletes nothing and it overwrites nothing a person made — a user's edit is a
     * different record with a different id. An "are you sure?" in front of an additive
     * action teaches people to dismiss the ones that matter. The dialog's own sentence
     * says what will happen, and the row is the act.
     */
    #onRestore = (event) => {
        const id = event.currentTarget.dataset.id;
        if (id) this.#store.restoreToFactory(id);
    };

    #onVersionsClose = () => { this.#store?.clearVersions(); };

    #onRestoreOpen = () => {
        this.renderRoot.getElementById('restore')?.show({ reason: 'toolbar' });
    };

    /* ---- templates --------------------------------------------------------- */

    /**
     * ONE OPTION TEMPLATE, CALLED FROM ONE PLACE (P6).
     *
     * There is no second version of this function for a bundled row, a loaded row or a
     * selected row: each of those is a PROPERTY on the one <ui-list-row>. That is the
     * whole of P6's answer — "the affordance added to the first never reached the second"
     * needs a second to be true of.
     *
     * NOTHING OPERABLE GOES INSIDE THE OPTION, and it is #26's own recorded pairing
     * rather than a preference here. ui-list-row.js departure 7: the row states no role,
     * because "the list is the only thing that knows whether it built a listbox (rows with
     * nothing slotted, or a non-operable slotted trigger), a grid (rows as `row`, the
     * trigger in a `gridcell`) or a plain list of links" — and a row that renders a real
     * <button> inside a `role="option"` IS P12's fourth half ("non-option children inside
     * the listbox"), reproduced rather than retired.
     *
     * THIS USED TO BE SPELLED `no-overflow`, an attribute on every row here, because #26
     * drew a built-in overflow button that had to be suppressed. It was deleted on
     * 30 August 2026 (audit D11) — the row draws no such button now, so a list gets the
     * listbox-safe shape by DEFAULT and the opt-out has nothing left to opt out of. The
     * measurement below is what the attribute was buying, and it is now free.
     * MEASURED before that attribute existed here (CDP
     * Accessibility.getFullAXTree, wave 5.3 review): 78 exposed, operable
     * `button "More actions"` nodes inside the listbox, none ignored, none carrying
     * tabindex="-1" — so the listbox was 79 tab stops, and every option's name read
     * "Preinfuse then 45ml of water More actions". The screen law is "aria per Appendix 15
     * (P12: a REAL listbox)", so the list takes #26's listbox pairing.
     *
     * THE ROW'S ACTIONS CAME BACK, and the listbox law is what shaped how. Ben, 25 August
     * 2026: "add the … so that we can hide it, assign it but maybe we should also have a
     * remove as well?" The affordance is a `<ui-menu class="row-menu">` in the row's
     * `actions` slot, and P12 still holds because the TRIGGER is inside the option rather
     * than a sibling tab stop beside it — the tree keeps its one tab stop and
     * aria-activedescendant, which is what the 78 exposed buttons broke.
     *
     * IT IS THE ONLY HOME NOW. The detail pane's `<ui-menu id="actions">` is gone too, to
     * Hide / Reset / Edit as three worded buttons ("Copy slate", same day), so B11 / Q7's
     * versions entry point moved onto this menu with the rest.
     */
    #option(record, index, activeRecordId) {
        const t = this.#i18n.t;
        const id = record.id;
        const title = record.profile?.title || t('Untitled');
        /* THE HIGHLIGHT IS BY ID (B1/R1). A string equality against a ProfileRecord id,
         * never a title comparison — see the R1 block in `profile-listbox.js` for what
         * makes that id provisional today and what marks it. */
        const loaded = this._state?.loaded;
        const isLoaded = Boolean(loaded?.id) && loaded.id === id;
        return html`
            <ui-list-row
                id=${optionIdFor(id)}
                role="treeitem"
                data-id=${id}
                data-index=${index}
                ?data-active=${id === activeRecordId}
                ?data-r1-provisional=${isLoaded && loaded.provisional === true}
                ?selected=${id === this._state?.selectedId}
                provenance=${isLoaded ? t('Loaded') : nothing}
                @click=${this.#onPick}
                >${this.#titleParts(title)}${this.#favouriteMarkFor(id)}${this.#rowMenu(record, id === activeRecordId)}</ui-list-row
            >`;
    }

    /**
     * The layout demo's rows. Marked, never selectable into the detail pane.
     *
     * AN OPTION, WITH AN ID, LIKE EVERY OTHER CHILD OF THIS LISTBOX. It reads as a
     * demo-only row and it was measured as P12's fourth half all the same: in the no-boot
     * state #rows carried `ui-list-row[role=NONE][id=NONE]` beside a `role="group"`, and
     * that is the state the skeleton suite mounts, so every skeleton assertion ran against
     * an ARIA-invalid listbox. The id is positional (`opt-demo-0`) because a placeholder
     * has no record id, and it is only ever named by an activedescendant the demo does not
     * write — `#rows` is empty without a store, so the key arithmetic has nothing to walk
     * and the listbox carries no `aria-activedescendant` here.
     *
     * THE DEMO ROWS SLOT NO ACTIONS TRIGGER, and there is nothing left for them to
     * suppress. They used to carry `no-overflow` for a second reason of their own: the
     * demo's rows never had an `@overflow` listener, so the affordance #26 rendered
     * opened nothing at all — a dead affordance (P10) in the one state a reader meets
     * with no machine attached. That affordance was deleted on 30 August 2026 (audit
     * D11), which is the same observation carried to its end: an affordance nothing
     * listened to, in a component nothing rendered it from.
     */
    #placeholderRow(row, index) {
        const t = this.#i18n.t;
        return html`
            <ui-list-row
                id=${optionIdFor('demo-' + index)}
                role="treeitem"
                data-title=${row.title}
                data-placeholder
                provenance=${t(row.provenance)}
                ?selected=${this._placeholder === row.title}
                @click=${this.#onPickPlaceholder}
                >${row.title}</ui-list-row
            >`;
    }

    /**
     * The listbox's children: options, and `role="group"` wrappers around the families
     * `profile-folders.js` found. NOTHING ELSE GOES IN HERE — that is P12's fourth half,
     * and it is why the "no profiles match" line is a sibling of the listbox rather than
     * a child of it.
     *
     * IN BOTH STATES, AND FLATTENED. "Nothing else" is a claim about the ACCESSIBILITY
     * tree, which is computed over the flattened tree, so it covers what a row puts inside
     * its own shadow root as well as what this function puts inside the listbox — which
     * is why it mattered that #26 drew a `<button>` of its own, and why every row here
     * carried `no-overflow` until that button was deleted (30 August 2026, audit D11).
     * Both halves were measured false before this wave's fix pass: 78 exposed `button`
     * nodes in the booted state, and role-less, id-less rows in the demo. The row's own
     * half is now structural — there is no built-in button to expose — and what this
     * screen slots is a `<span>` with a name and no tabindex, deliberately not operable.
     *
     * ONE WALK for both the demo and the real listing, because two walks is how the
     * grouping in front of a person and the grouping in a test part company. The demo's
     * rows are shaped as records so `listboxGroups` sees the same input either way.
     */
    #listBody() {
        const demo = this.#demo;
        const rows = demo
            ? PLACEHOLDER_ROWS.map((row) => ({ id: '', profile: { title: row.title }, placeholder: row }))
            : this.#rows;
        if (rows.length === 0) return nothing;

        /* WHICH ROW THE KEYBOARD IS ON — read off the NODES, because that is what the
         * index walks now: a family row is a node too, and indexing `rows` with it named
         * the wrong profile or nothing at all. `null` when the active node is a family. */
        const activeNode = demo ? null : this.#nodes[this.#activeIndex];
        const activeRecordId = activeNode && activeNode.kind === 'profile'
            ? activeNode.record.id : null;
        let index = -1;
        const option = (record) => {
            index += 1;
            return record.placeholder
                ? this.#placeholderRow(record.placeholder, index)
                : this.#option(record, index, activeRecordId);
        };

        const t = this.#i18n.t;
        const open = this._query
            ? new Set(listboxGroups(rows).map((group) => group.folder).filter(Boolean))
            : this._openFolders;
        const activeId = this._activeId;

        /* THE DEMO DOES NOT FOLD, and that is not an exemption from the feature. These
         * four titles exist to show the LAYOUT with no machine attached, and two of them
         * ("Tea portafilter / Green", "/ Oolong") happen to group — so folding them turned
         * a four-row demo into a family row and two loose rows, which is a smaller sample
         * of the thing the demo is for. There is no storage to remember a fold in this
         * state either. `folders: false` is the grouping module's own seam for it. */
        return listboxGroups(rows, { folders: !demo }).map((group) => {
            if (group.folder === null) return group.entries.map(option);
            /* A FAMILY IS A treeitem THAT OWNS A group, which is the APG's own shape and
             * the reason this wrapper is a tree at all. The disclosure state lives on the
             * family row (`aria-expanded`), never on the group — a group has no expanded
             * state to have, and putting a <button> in here is what P12 refuses. */
            const expanded = open.has(group.folder);
            const id = folderNodeId(group.folder);
            const head = html`
                <ui-list-row
                    id=${optionIdFor(id)}
                    role="treeitem"
                    class="family-row"
                    aria-expanded=${expanded ? 'true' : 'false'}
                    data-folder=${group.folder}
                    ?data-active=${id === activeId}
                    provenance=${t('{n} profiles').replace('{n}', String(group.entries.length))}
                    @click=${this.#onFolderPick}
                    ><span class="fold-mark" aria-hidden="true"
                        >${expanded ? FOLD_OPEN_GLYPH : FOLD_SHUT_GLYPH}</span
                    >${group.folder}</ui-list-row
                >`;
            /* THE MEMBERS ARE NOT RENDERED WHEN THE FAMILY IS SHUT, rather than hidden
             * with CSS. A hidden option is still in the accessibility tree and still in
             * the DOM to be found by an id lookup, and the whole point of folding 186
             * profiles is that the ones you folded away stop being there. */
            if (!expanded) {
                /* The counter still has to advance past them, or the demo's data-index
                 * and the keyboard's own walk disagree about which row is which. */
                index += group.entries.length;
                return head;
            }
            return html`${head}
                <div class="group seam-grid seam-rows seam-line" role="group"
                    aria-label=${group.folder}>
                    ${group.entries.map(option)}
                </div>`;
        });
    }


    /* ---------------------------------------------------------------------
     * ADD A PROFILE — Ben, 24 August 2026
     * ------------------------------------------------------------------- */

    /**
     * The three doors, and the third only when it is there.
     *
     * SLATE'S OWN THREE, in its own order (`add-profile-modal`): a local file, a
     * Visualizer share code, and the profile generator. The first two are always
     * offered — a file picker needs nothing installed and a wrong share code answers
     * with a sentence rather than an absence. The third is gated on the plugin being
     * LOADED, because a link to a plugin that is not running answers 404.
     */
    #addItems() {
        const t = this.#i18n.t;
        const items = [
            { id: ADD_ACTION.NEW, label: t('New profile') },
            { id: ADD_ACTION.UPLOAD, label: t('Upload a profile') },
            { id: ADD_ACTION.SHARE_CODE, label: t('Import a share code') },
        ];
        /* NO GENERATE ROW. It is a worded button in the toolbar since 25 August 2026;
         * two doors to one page is the "finished half with no other half" defect wearing
         * its opposite face. ADD_ACTION.GENERATE stays declared and stays handled below,
         * because the menu is keyed by id and a stale branch costs nothing next to a
         * missing one. */
        return items;
    }

    #onAddSelect = (event) => {
        const id = event.detail?.id;
        if (id === ADD_ACTION.NEW) {
            this.#openNewProfile();
            return;
        }
        if (id === ADD_ACTION.UPLOAD) {
            this.#store?.clearAdd?.();
            this.renderRoot.getElementById('upload')?.input?.click();
            return;
        }
        if (id === ADD_ACTION.SHARE_CODE) {
            this._shareCode = '';
            this.#store?.clearAdd?.();
            this.renderRoot.getElementById('share-code')?.show({ reason: 'menu' });
            return;
        }
        if (id === ADD_ACTION.GENERATE && this._generatorUrl) {
            /* A SAME-FRAME NAVIGATION, which the host intercepts to open the OS browser
             * (the old skin's own note, gh#384). The generator uploads the profile
             * itself, so coming back is a re-read and nothing here waits for one. */
            if (globalThis.location) globalThis.location.href = this._generatorUrl;
        }
    };

    /**
     * A FILE WAS PICKED. Read here and validated in the store, because "is this a
     * profile" is a fact about the data rather than about this screen — and the same
     * check has to hold for any other door that ever brings a file in.
     */
    /**
     * GENERATE - open the generator plugin's page.
     *
     * A SAME-FRAME NAVIGATION, which the host intercepts to open the OS browser; the same
     * assignment the + menu's GENERATE row made before the control was given its own word
     * and its own place in the band.
     */
    #onGeneratePress = () => {
        if (this._generatorUrl && globalThis.location) globalThis.location.href = this._generatorUrl;
    };

    #onFilePick = async (event) => {
        const file = event.detail?.file;
        if (!file || !this.#store?.createFromFile) return;
        let text = '';
        try {
            text = await file.text();
        } catch {
            /* A file the tablet would not read. The store's own `not-json` refusal is the
             * same sentence a person needs, and routing it through there keeps one owner
             * of what an add can answer. */
            text = '';
        }
        await this.#store.createFromFile(text);
        const state = this.#store.get?.();
        /* THE DIALOG IS ONLY OPENED TO SAY NO. A file that landed needs no surface — the
         * list it joined is the answer, and it is already on screen. */
        if (state?.add?.status === ADD_STATUS.REFUSED || state?.add?.status === ADD_STATUS.FAILED) {
            this.renderRoot.getElementById('share-code')?.show({ reason: 'refusal' });
        }
    };

    #onShareInput = (event) => {
        this._shareCode = String(event.detail?.value ?? event.target?.value ?? '').trim();
    };

    #onShareImport = async () => {
        if (!this._shareCode || !this.#store?.importShareCode) return;
        await this.#store.importShareCode(this._shareCode);
        if (this.#store.get?.()?.add?.status === ADD_STATUS.ADDED) {
            this._shareCode = '';
            this.renderRoot.getElementById('share-code')?.hide('imported');
        }
    };

    #onAddClose = () => { this.#store?.clearAdd?.(); };

    /** True while an add is in flight — the Import button refuses a second press. */
    get #adding() { return this._state?.add?.status === ADD_STATUS.ADDING; }

    /**
     * WHAT THE ADD SAID, in words.
     *
     * FIVE SENTENCES AND NO SIXTH, one per reason the store can answer with. The store
     * never words a refusal (it carries a reason); this is the one place the words are,
     * so the file path and the share-code path cannot describe the same refusal
     * differently.
     */
    #addMessage() {
        const t = this.#i18n.t;
        const add = this._state?.add ?? null;
        if (!add || add.status === ADD_STATUS.IDLE || add.status === ADD_STATUS.ADDING) return nothing;
        const say = {
            'not-json': t('That file is not a profile.'),
            'not-a-profile': t('That file is not a profile.'),
            'missing-fields': t('That file is missing fields a profile needs.'),
            'steps-not-an-array': t('That file is not a profile.'),
            'no-code': t('Enter a share code.'),
            'bad-code': t('That share code did not work.'),
            'not-signed-in': t('Sign in to Visualizer in Settings first.'),
        };
        const text = add.status === ADD_STATUS.ADDED
            ? t('Added.')
            : (say[add.reason] ?? t('That could not be added.'));
        return html`<ui-alert-banner
            id="add-message"
            kind=${add.status === ADD_STATUS.ADDED ? 'info' : 'warning'}
            >${text}</ui-alert-banner
        >`;
    }

    /** One dialog body list: the rows, or the sentence that says why there are none. */
    #dialogList(rows, note) {
        return html`<div class="dialog-list">
            ${rows.length ? rows : html`<p>${note}</p>`}
        </div>`;
    }

    /**
     * B11 / Q7 — the other versions of the selected profile.
     *
     * A ONE-ENTRY LINEAGE IS "NO OTHER VERSIONS", not a fault: `getLineage` always adds
     * the profile itself (`profile_controller.dart:308`), so the 200 body is never empty
     * and a list of one is the empty answer. The store derives `none` from the LIST and
     * this is where that becomes a sentence. There is no 404 to read — `_handleGetLineage`
     * (`profile_handler.dart:205-219`) has no `on ArgumentError` clause, so a missing id is
     * a 500 and stays a fault; this comment said the opposite until 21 Aug.
     */
    #versionsBody() {
        const t = this.#i18n.t;
        const versions = this._state?.versions;
        const status = versions?.status ?? VERSIONS_STATUS.IDLE;
        if (status === VERSIONS_STATUS.READY && versions.records.length) {
            return this.#dialogList(versions.records.map((record) => html`
                <ui-list-row
                    provenance=${record.id === versions.id ? t('This one') : nothing}
                    >${record.profile?.title || t('Untitled')}</ui-list-row
                >`), '');
        }
        if (status === VERSIONS_STATUS.LOADING) return this.#dialogList([], t('Reading versions…'));
        if (status === VERSIONS_STATUS.FAILED) {
            return this.#dialogList([], t('The versions could not be read.'));
        }
        return this.#dialogList([], t('This profile has no other versions.'));
    }

    /**
     * D6, FIRST HALF — the bundled profiles that can be restored.
     *
     * THE LIST IS `state.restorable`: hidden AND isDefault AND carrying a bundle
     * filename. Every one of those three is load bearing. Hidden, because that is what
     * `ProfileController.delete` does to an `isDefault` record instead of removing it.
     * isDefault, because only a bundled profile has a factory to go back to. And the
     * filename, because the route's path parameter IS the bundle filename — a record
     * without one cannot be restored and is not offered, rather than being offered and
     * failing.
     *
     * THE PURGE HALF IS ELSEWHERE ON THIS SCREEN NOW — `#onRemovePress`, reachable from a
     * row's menu while the Hidden list is showing. It is not here because the two are
     * opposite: this dialog puts bundled profiles BACK, and that one takes a record away
     * for good.
     */
    #restoreBody() {
        const t = this.#i18n.t;
        const rows = (this._state?.restorable ?? []).map((record) => html`
            <ui-button
                data-id=${record.id}
                data-filename=${restoreFilenameOf(record) ?? ''}
                @click=${this.#onRestore}
                >${record.profile?.title || t('Untitled')}</ui-button
            >`);
        return this.#dialogList(rows, t('Every bundled profile is already here.'));
    }

    render() {
        const t = this.#i18n.t;
        const state = this._state;
        const record = this.#selectedRecord;
        const profile = record?.profile ?? null;
        const preview = profilePreviewDerivation(profile);
        const totals = profileTotals(profile);
        const refusal = state?.refusal ?? null;
        const rows = this.#rows;
        const restorable = state?.restorable ?? [];
        const title = profile?.title ?? (this.#demo ? this._placeholder : null);
        const loading = state?.status === LIBRARY_STATUS.LOADING;

        return html`
            <ui-page-header heading=${t('Profiles')} layout="flanks">
                <div slot="trail" class="band-actions">
                    <!-- BOTH ARE TALL, and the band already said so (parity surface 5;
                         parity surface 1 wrote the same two words on live-screen.js and
                         gave the whole argument at its ACTIONS block). --ui-band-h is
                         calc((--ui-control-lg + 2 * --ui-band-inset) * --ui-density) =
                         118 at density 1, and the CONTROL is deliberately not multiplied
                         ("ergonomics is physical", ui-page-header.js:185), so a 64px
                         control in this band leaves 27px of dead space above and below
                         itself and contradicts the derivation the band's own height comes
                         from. <ui-page-header> renders ITS OWN commit cluster tall
                         (ui-page-header.js:551-563, the Settings screen's Cancel/Save);
                         the Live band is tall; this screen supplied the trail slot itself
                         and was the last one in the tree still drawing 64. The oracle
                         agrees rather than merely permitting it:
                           ORACLE profile-selector #cancel-profile-btn [i=4] height =
                           82px, min-height = 82px, rect=[1602,18,108,82];
                           #confirm-profile-btn [i=5] the same 82, rect=[1722,18,168,82];
                           the band [i=2] min-height = 118px. 82 + 2*18 = 118 exactly,
                           which is why both sit at y=18 and not at y=27.
                         No geometry is written here and NO BACKTICK either (CONVENTIONS
                         §9, and this comment cost one): the tall attribute IS
                         --ui-control-lg, by name, on the component that already had it. -->
                    <ui-button id="cancel" tall @click=${this.#onCancelPress}
                        >${t('Cancel')}</ui-button
                    >
                    <ui-button
                        id="confirm"
                        tall
                        variant="primary"
                        ?disabled=${!state?.selectedId}
                        @click=${this.#onConfirmPress}
                        >${t('Confirm')}</ui-button
                    >
                </div>
            </ui-page-header>

            <selector-split id="split" part="split">
                <selector-list-pane id="list-pane" slot="list">
                    <div slot="toolbar" class="toolbar">
                        <!-- NO CAPTION. Ben, 25 August 2026: "We can remove 'ALL PROFILES'
                             label." It said what the screen already says — its own title is
                             "Profiles" and the list under it is the profiles — and it was
                             what pushed the three controls to the right-hand end of the
                             band. With it gone they start where Slate's do.

                             THE COUNT WENT WITH IT and that is the one thing lost: the
                             caption carried "93". Slate has no count either. -->

                        <!-- ADD A PROFILE (Ben, 24 Aug 2026: "We should add Upload,
                             import and the generate one"). Three doors behind one menu,
                             because they are three ways to do one thing and a band with
                             three buttons on it says they are three things.
                             THE GENERATOR ROW IS ABSENT until its plugin answers loaded —
                             a link to a plugin that is not installed is a dead affordance,
                             which is the old skin's own rule for the same control. -->
                        <ui-menu
                            id="add"
                            label=${t('Add a profile')}
                            .items=${this.#addItems()}
                            @select=${this.#onAddSelect}
                        >
                            <ui-icon-button
                                slot="trigger"
                                id="add-open"
                                label=${t('Add a profile')}
                                >&#43;</ui-icon-button
                            >
                        </ui-menu>

                        <!-- THE HIDDEN TOGGLE. Ben, 25 August 2026: "Add the hidden
                             toggle." Slate's #view_profile, MEASURED at 124.8 x 82 with the
                             word "Hidden" beside its glyph.

                             PRESSED IS THE STATE AND aria-pressed IS THE SPELLING, so the
                             control says which set is on screen rather than needing a second
                             label. It is rendered whether or not anything is hidden: unlike
                             the restore icon below it, "nothing is hidden" is an ANSWER this
                             control gives, and a toggle that vanished when the answer was
                             empty could never give it. -->
                        <ui-button
                            id="hidden-toggle"
                            variant=${this._showHidden ? 'primary' : nothing}
                            aria-pressed=${this._showHidden ? 'true' : 'false'}
                            @click=${this.#onToggleHidden}
                            >${t('Hidden')}</ui-button
                        >

                        <!-- GENERATE, WITH ITS NAME ON IT. Ben, 25 August 2026: "Move the
                             +, Hidden, and Generate button to the left, like what slate
                             has" and "The generate button needs to say generate or
                             something, its not clear what the icon does."

                             IT WAS THE FOURTH ROW OF THE + MENU until now, which is why it
                             read as an unlabelled glyph: the glyph beside Hidden was the
                             RESTORE icon, and it is labelled below. Slate carries Generate
                             as its own worded button in this band - profile_selector.html:26,
                             #ai_generate_profile - so this is the parity move as well as
                             the legibility one.

                             STILL GATED ON THE PLUGIN ANSWERING. A link to a plugin that is
                             not installed is a dead affordance, and that rule does not
                             change by moving the control into daylight. -->
                        ${this._generatorUrl
                            ? html`<ui-button
                                id="generate"
                                @click=${this.#onGeneratePress}
                                >${t('Generate')}</ui-button
                            >`
                            : nothing}

                        <!-- D6's ENTRY POINT, NOW WORDED. Ben read its glyph as Generate,
                             which is the strongest evidence a glyph can give that it is not
                             carrying its own meaning. It says Restore now.

                             Rendered only when there is something to restore, because a
                             control that is permanently disabled on a machine nobody has
                             deleted from is a dead affordance (P10's family). The count IS
                             the offer. -->
                        ${restorable.length
                            ? html`<ui-button
                                id="restore-open"
                                @click=${this.#onRestoreOpen}
                                >${t('Restore')}</ui-button
                            >`
                            : nothing}
                    </div>

                    <ui-search-field
                        id="filter"
                        slot="filter"
                        label=${t('Filter profiles')}
                        placeholder=${t('Filter profiles')}
                        .value=${this._query}
                        @input=${this.#onFilterInput}
                        @search=${this.#onSearch}
                    ></ui-search-field>

                    <!-- THE LISTBOX (P12). One tab stop, aria-activedescendant, a keydown
                         handler, and only options and groups inside it.
                         THE SEAM CLASSES ARE ON THE ELEMENT, never restated in a
                         stylesheet: seams.js owns the three declarations and this is the
                         same class list settings-nav-column.js:200 renders on its own
                         rows. See selector-list.js for why the list had no divider at
                         all until parity surface 5. -->
                    <div
                        slot="list"
                        class="listbox seam-grid seam-rows seam-line"
                        id="rows"
                        role="tree"
                        tabindex="0"
                        aria-label=${t('Profiles')}
                        aria-activedescendant=${this.activeDescendantId ?? nothing}
                        @keydown=${this.#onListKeyDown}
                    >
                        ${this.#listBody()}
                    </div>
                    ${!this.#demo && rows.length === 0 && !loading
                        ? html`<p slot="list" class="list-empty" id="list-empty"
                            >${t('No profiles found.')}</p>`
                        : nothing}

                    <!-- SLATE'S ASSIGN ROW: a cap, then five discs.
                         Ben, 25 August 2026: "Can we use slates assign Favorites row, maybe
                         reduce the height a bit but have the ASSIGN FAVOURITE and the 5
                         round buttons. It looks clean." -->
                    <div id="favourites" slot="favourites" class="assign-row">
                        <span class="ui-microcap">${t('Assign favourite')}</span>
                        ${this.#favouriteSlots()}
                    </div>
                </selector-list-pane>

                <selector-detail-pane id="detail-pane" slot="detail">
                    <div slot="title" class="title-row">
                        <h2 id="detail-title" class="ui-heading"
                            >${title ?? t('No profile selected')}</h2
                        >

                        <!-- THREE BUTTONS, NOT A MENU. Ben, 25 August 2026, on the
                             selector audit's finding 6 ("Three buttons, or one menu"):
                             "Copy slate."

                             SLATE'S OWN THREE, MEASURED on its running selector: Delete
                             102.3 x 82 in red ink on a translucent red ground, Reset, and
                             Edit 112 x 82. The actions are the ones the ... already
                             carried; what changes is that they are on screen rather than
                             one press behind a glyph.

                             HIDE KEEPS ITS OWN WORD and Slate's paint. Decal calls this
                             Hide and not Delete on purpose, and the contract says why:
                             DELETE /profiles/<id> is a SOFT delete - the record stays and a
                             bundled one comes back through Restore. Painting it as Slate's
                             Delete while calling it Delete would be the first honest half
                             and the second a lie. -->
                        <div id="actions" class="detail-actions">
                            <!-- TWO DESTRUCTIVE WORDS, AND EACH DOES WHAT IT SAYS. Ben,
                                 25 August 2026: "Hide should hide, delete should delete
                                 after confirmation."

                                 SLATE HAS ONE BUTTON HERE and calls it Delete, for a route
                                 that hides. That was the audit's "The word" row and it is
                                 what this replaces: Hide takes DELETE /profiles/<id>, the
                                 SOFT delete that sets a visibility and removes nothing, and
                                 Delete takes /purge, the one route that removes a record.

                                 HIDE GOES AWAY ON A HIDDEN PROFILE. There is nothing left
                                 for it to do, and a disabled button that is only ever
                                 disabled in one view is a control that has to be explained.
                                 Delete stays in both. -->
                            ${this._showHidden ? nothing : html`<ui-button
                                id="act-hide"
                                variant="danger"
                                ?disabled=${!record}
                                @click=${this.#onHidePress}
                                >${t('Hide')}</ui-button
                            >`}
                            <ui-button
                                id="act-delete"
                                variant="danger"
                                ?disabled=${!record}
                                @click=${this.#onDeletePress}
                                >${t('Delete')}</ui-button
                            >
                            ${this.#canReset
                                ? html`<ui-button
                                    id="act-reset"
                                    ?disabled=${!record}
                                    @click=${this.#onResetPress}
                                    >${t('Reset')}</ui-button
                                >`
                                : nothing}
                            <ui-button
                                id="act-edit"
                                ?disabled=${!record}
                                @click=${this.#onEditPress}
                                >${t('Edit')}</ui-button
                            >
                        </div>

                        <!-- THE OVERLAYS LIVE HERE, and P1 is why: this screen's grid has
                             exactly two children and an overlay is not a band. Every
                             confirm host has a display:contents host over a closed native
                             dialog, so none contributes a flex item here.
                             (No backtick in this template, comment or not.)

                             THE LOAD CONFIRM IS GONE (Ben, 24 Aug 2026). A button labelled
                             Confirm that opened a dialog asking you to confirm asked the
                             same question twice; the old skin's own Confirm writes the
                             workflow and leaves. What remains here asks about the things
                             this app cannot undo. -->

                        <!-- THE FILE PICKER, HELD OPEN NOWHERE. <ui-file-button> is a
                             button over a clipped input; it is in the tree so a menu row
                             can click it, and it paints nothing of its own here. -->
                        <ui-file-button
                            id="upload"
                            class="hidden-control"
                            accept=".json,application/json"
                            label=${t('Upload a profile')}
                            @file-pick=${this.#onFilePick}
                            >${t('Upload a profile')}</ui-file-button
                        >

                        <!-- THE SHARE CODE. Four characters and a message that says which
                             of the two refusals happened — a wrong code and a Visualizer
                             account nobody is signed in to need different answers, and the
                             old skin shows a whole second modal for the second. -->
                        <ui-dialog
                            id="share-code"
                            heading=${t('Import a share code')}
                            @close-request=${this.#onAddClose}
                        >
                            <div slot="body" class="share-body">
                                <ui-text-field
                                    id="share-input"
                                    label=${t('Share code')}
                                    .value=${this._shareCode}
                                    @change=${this.#onShareInput}
                                ></ui-text-field>
                                ${this.#addMessage()}
                                <ui-button
                                    id="share-import"
                                    variant="primary"
                                    ?disabled=${!this._shareCode || this.#adding}
                                    @click=${this.#onShareImport}
                                    >${t('Import')}</ui-button
                                >
                            </div>
                        </ui-dialog>

                        <!-- THE HIDE CONFIRM. Its detail names the profile, because the
                             menu it came from is closed by the time the question is asked
                             and "this profile" would then name nothing on screen. -->
                        <ui-confirm-dialog
                            id="confirm-hide"
                            tone="destructive"
                            question=${t('Hide this profile?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Hide')}
                            @confirm=${this.#onConfirmHide}
                        ></ui-confirm-dialog>

                        <!-- REMOVE FOR GOOD, AND THE QUESTION SAYS SO IN THOSE WORDS.
                             Ben, 25 August 2026: "build it behind a confirm that says
                             plainly it cannot be undone."

                             THE DETAIL IS THE SENTENCE, not the profile's name — the name
                             is in the question. Every other confirm on this screen can
                             afford to name the thing and stop, because every other action
                             here is reversible: a hidden bundled profile comes back through
                             Restore, and a hidden user profile is still on the server. This
                             is the one route that removes a record, so the sentence a user
                             needs is what it costs, not what it is about. -->
                        <ui-confirm-dialog
                            id="confirm-remove"
                            tone="destructive"
                            question=${t('Delete {name}?', { name: title ?? t('this profile') })}
                            detail=${t('This removes the profile from the machine. It cannot be undone, and Restore will not bring a bundled profile back.')}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Delete')}
                            @confirm=${this.#onConfirmRemove}
                        ></ui-confirm-dialog>

                        <!-- RESET ONE PROFILE, ASKED FIRST. Same route as the bulk restore
                             below and the same 'nothing the user made is touched' promise —
                             what differs is that this one names the profile it is about,
                             because it was reached from that profile's own row of actions. -->
                        <ui-confirm-dialog
                            id="confirm-reset"
                            question=${t('Reset this profile to factory?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Reset')}
                            @confirm=${this.#onConfirmReset}
                        ></ui-confirm-dialog>

                        <!-- D6, FIRST HALF ONLY. The wording says exactly what the handler
                             does (see #restoreBody): the bundled version comes back, and
                             nothing the user made is touched, because their edit is a
                             different record with a different id. The PURGE half is
                             deferred and has no control anywhere on this screen. -->
                        <ui-dialog id="restore" heading=${t('Restore bundled profiles')}>
                            <p slot="header-trail"
                                >${t('The bundled version comes back. Your own profiles are untouched.')}</p
                            >
                            <div slot="body">${this.#restoreBody()}</div>
                        </ui-dialog>

                        <ui-dialog
                            id="versions"
                            heading=${t('Previous versions')}
                            @close-request=${this.#onVersionsClose}
                        >
                            <div slot="body">${this.#versionsBody()}</div>
                        </ui-dialog>
                    </div>

                    <div slot="summary" class="detail-strip">
                        <!-- B9 — THE REFUSAL, AT THE POINT OF PICKING. #49 takes a message
                             and does not know the message: the server's own sentence
                             arrives through profileRefusal() and is printed verbatim.

                             AND IT TAKES NOTHING ELSE. This surface used to bind the
                             refusal's own kind onto a "kind" attribute as well, and #49 has
                             no such property, attribute or rule: its whole properties map is
                             {_hasHeadline, _hasRemedy} (ui-alert-banner.js:180-185), and the
                             only "kind" in that file is a prose note about the OLD skin's
                             three alert kinds. An attribute with no consumer is P9's class
                             exactly — markup that implies a distinction it never paints —
                             so it is gone. The distinction still reaches the person, in the
                             one place it was ever readable: the server's own two sentences,
                             "Unsupported profile" and "Invalid profile", verbatim in the
                             headline. The kind stays a VALUE on the store's state, where
                             profileRefusal() puts it and the suites assert it. -->
                        ${refusal
                            ? html`<ui-alert-banner id="refusal"
                                >${refusal.error}<span slot="remedy">${refusal.message}</span
                                ></ui-alert-banner>`
                            : nothing}

                        <div class="summary" id="summary">
                            ${SUMMARY_TILES.map((tile) => {
                                /* NO PROFILE IS NOT A ZERO. With nothing selected every
                                 * tile is absent and #34 paints its own dash — the strip
                                 * keeps its four columns and says four times that it has
                                 * no reading, which is the true statement. */
                                const reading = profile ? tile.read(profile, totals) : null;
                                return html`
                                <ui-stat-tile
                                    data-tile=${tile.key}
                                    label=${t(tile.label)}
                                    unit=${reading?.unit ?? ''}
                                    size="sm"
                                    value=${reading?.value ?? ''}
                                ></ui-stat-tile>`;
                            })}
                        </div>
                    </div>

                    <!-- chart-C3: THE PLOT HOST IS UNPADDED. The card's inset lives on its
                         FRAME and the plot host inside it carries none, which is #47's own
                         contract and is inherited whole by mounting the card rather than
                         building a well around it. Nothing here declares padding on it. -->
                    <ui-chart-card
                        id="preview"
                        slot="chart"
                        label=${t('Profile preview')}
                        channels="targetPressure targetFlow"
                        .derivation=${preview}
                    >
                        <span slot="empty">${t('Choose a profile to see its curves')}</span>
                    </ui-chart-card>

                    <!-- READONLY, because there is nowhere to save an edit to.
                         Slate's pane is a plain div that prints profile.notes
                         (profile_selector.js:565); this mounted a full editor over the
                         same read, so the caret landed and every word typed was thrown
                         away at the next selection. Writing notes needs a route, a store
                         and a Save — none of which this screen has — so until it does,
                         the pane says what it can do. -->
                    <ui-notes-editor
                        readonly
                        id="notes"
                        slot="notes"
                        label=${t('Profile notes')}
                        placeholder=${t('Notes about this profile')}
                        .value=${profile?.notes ?? ''}
                    ></ui-notes-editor>
                </selector-detail-pane>
            </selector-split>

            <!-- THE SCREEN'S ONE LINE OF SPEECH. Slate says every favourite outcome in a
                 toast, refusal and success alike, and its own note explains why they
                 cannot share one: an error toast that a success overwrites 300 ms later
                 is an error nobody reads.

                 IT IS OUTSIDE THE SPLIT ON PURPOSE. ui-toast is position: fixed, so it
                 contributes no grid item and P1's "this screen's grid has exactly two
                 children" still holds - the same placement editor-screen.js:981 makes for
                 the same reason. -->
            <ui-toast id="notice"></ui-toast>
        `;
    }
}

customElements.define('selector-screen', SelectorScreen);
