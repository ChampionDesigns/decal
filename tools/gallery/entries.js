/**
 * entries.js — the gallery's registry. THIS is the file a component builder edits.
 *
 * One entry per component, one state per thing worth looking at. Waves 1–4 append;
 * nothing here is generated, and nothing else in the gallery needs touching to add a
 * subject.
 *
 * SHAPE:
 *
 *     {
 *       id:     'ui-stepper',                    // unique, kebab-case, matches the tag
 *       title:  'Stepper',                       // shown in the nav
 *       module: '../../src/components/ui-stepper.js',   // relative to tools/gallery/
 *       notes:  'one line about what to look at',       // optional
 *       states: [
 *         { id: 'resting',  title: 'Resting',  html: '<ui-stepper value="93"></ui-stepper>' },
 *         { id: 'selected', title: 'Selected', html: '…', hostStyle: { 'inline-size': '380px' } },
 *       ],
 *     }
 *
 * `hostStyle` is applied to the stage wrapper, not to the component — it is how a
 * state says "at a 380px container", which is the only honest way to show a
 * component that reads its own container rather than the viewport (spec §2.1 Rule 1).
 * The VIEWPORT is the capture battery's business: it drives the geometry matrix
 * (1281×801 @ dsf 1.5, 1920×1200, 1000×600) over the same states.
 *
 * STATE IDS ARE THE BATTERY'S FILENAMES, so they are stable identifiers, not labels:
 * a state's full id is `<entry.id>--<state.id>` and a rename is a re-baseline.
 *
 * ===========================================================================
 * WAVE 1: WHY THE ENTRIES ARE IMPORTED RATHER THAN WRITTEN OUT HERE
 * ===========================================================================
 *
 * README.md:12 says "Edit entries.js. That is the whole procedure", and that is the
 * right procedure for ONE author. Wave 1 ran sixteen builders in parallel under a
 * whole-file-write rule, so sixteen appends to one array would have clobbered each
 * other. Each builder therefore wrote `entries/<id>.entry.js` exporting `entry` in
 * exactly the documented shape, and the wave's cross-cutting reviewer (single writer
 * for shared files) wired them here, serially, once — this block.
 *
 * The registry is still a hand-written array, not a glob: adding a component means
 * one import line and one array slot, and a file nobody imported is a visible
 * omission rather than a silent pickup. Later waves may keep appending either way.
 *
 * ORDER is the wave's SCOPE order (Part 4's Wave 1 table), not alphabetical, so the
 * gallery nav reads the way the scope document does: controls, then surfaces, then
 * the two rows that are not elements at all.
 */

import { entry as uiButton } from './entries/ui-button.entry.js';
import { entry as uiIconButton } from './entries/ui-icon-button.entry.js';
import { entry as uiTextField } from './entries/ui-text-field.entry.js';
import { entry as uiSelect } from './entries/ui-select.entry.js';
import { entry as uiSwitch } from './entries/ui-switch.entry.js';
import { entry as uiSlider } from './entries/ui-slider.entry.js';
import { entry as uiBadge } from './entries/ui-badge.entry.js';
import { entry as uiStatusChip } from './entries/ui-status-chip.entry.js';
import { entry as uiCard } from './entries/ui-card.entry.js';
import { entry as uiKeycap } from './entries/ui-keycap.entry.js';
import { entry as uiProgressTrack } from './entries/ui-progress-track.entry.js';
import { entry as uiLockedValue } from './entries/ui-locked-value.entry.js';
import { entry as uiEmptyState } from './entries/ui-empty-state.entry.js';
import { entry as uiAlertBanner } from './entries/ui-alert-banner.entry.js';
import { entry as typeRoles } from './entries/type-roles.entry.js';
import { entry as seams } from './entries/seams.entry.js';

/* ---- Wave 2, the twelve state-and-navigation rows (waves/2/ITEMS.json order) ----
 * Wired by wave 2's cross-cutting reviewer, serially, once — same single-writer rule
 * as the wave-1 block above. All twelve entry files were written by their builders
 * and left unimported; until this block existed the gallery mounted wave 1 only and
 * the capture battery had ZERO wave-2 states to shoot. Recorded as finding cross-2. */
import { entry as uiBank } from './entries/ui-bank.entry.js';
import { entry as uiStepper } from './entries/ui-stepper.entry.js';
import { entry as uiSearchField } from './entries/ui-search-field.entry.js';
import { entry as uiListRow } from './entries/ui-list-row.entry.js';
import { entry as uiSectionHeader } from './entries/ui-section-header.entry.js';
import { entry as uiFavouriteSlot } from './entries/ui-favourite-slot.entry.js';
import { entry as uiNavRow } from './entries/ui-nav-row.entry.js';
import { entry as uiSubnavRow } from './entries/ui-subnav-row.entry.js';
import { entry as uiSheetHeader } from './entries/ui-sheet-header.entry.js';
import { entry as uiPageHeader } from './entries/ui-page-header.entry.js';
import { entry as uiStatTile } from './entries/ui-stat-tile.entry.js';
import { entry as uiPickDisc } from './entries/ui-pick-disc.entry.js';

/* ---- Wave 3, the platform owners (waves/3/ITEMS.json order) ----
 * Wired by wave 3's cross-cutting reviewer, serially, once — same single-writer rule.
 * On wave 3's SECOND pass #18, #9 and #10 exist, so all six component rows are wired
 * here. (#11, the time key, is correctly absent: D1 forbade building it.) The first
 * pass's note that three rows "have no entry to wire" was true then and is not now. */
import { entry as uiDialog } from './entries/ui-dialog.entry.js';
import { entry as uiChartCard } from './entries/ui-chart-card.entry.js';
import { entry as uiChartLegend } from './entries/ui-chart-legend.entry.js';
import { entry as uiMenu } from './entries/ui-menu.entry.js';
import { entry as uiToast } from './entries/ui-toast.entry.js';
import { entry as uiTabBar } from './entries/ui-tab-bar.entry.js';

/* Gate 5's chart surface, wired by wave 3's GATE (not by a builder) on the first pass,
 * when `PlotSurfaceElement` was the only chart in the tree. #9 now ships its own card
 * entry above; this one stays because its three states are an existing Gate B baseline
 * (a rename or removal is a re-baseline) and because it is the ONLY subject that
 * photographs the Rule-1 canary — the sheet-less mount #9 can never show. Same
 * precedent as `base-fixture` below: a fixture may be a gallery subject. */
import { entry as plotSurface } from './entries/plot-surface.entry.js';

/* ---- Wave 4, the twenty-two compounds and dialog bodies (waves/4/ITEMS.json order) ----
 * Wired by wave 4's cross-cutting writer, serially, once — same single-writer rule as the
 * three blocks above. ALL TWENTY-TWO of wave 4's entry files were written by their builders
 * and left unimported, so the gallery mounted waves 1–3 only and the capture battery had
 * ZERO wave-4 states to shoot: 139 states dark, per theme per geometry. Recorded as finding
 * cross-1.
 *
 * THE MECHANISM, not just the omission: nothing could go red for this. The gallery's own
 * meta-suite (test/render/gallery.render.test.mjs:32-41) asserts over
 * `window.__gallery.states()`, which enumerates only what THIS array holds, so an entry file
 * that exists and is never imported is invisible to it by construction — three waves in a
 * row have now hit the same hole (cross-2 was wave 2's). `test/gallery-registry.test.mjs`
 * was added in the same change as this block and closes it: it diffs readdir(entries/)
 * against the import list below and against the array, in node, with no browser. A wave-5
 * builder who writes an entry file and stops now gets a red test instead of a dark state. */
import { entry as uiConfirmDialog } from './entries/ui-confirm-dialog.entry.js';
import { entry as uiSheet } from './entries/ui-sheet.entry.js';
import { entry as uiNumericKeypad } from './entries/ui-numeric-keypad.entry.js';
import { entry as uiTimePicker } from './entries/ui-time-picker.entry.js';
import { entry as uiNotesEditor } from './entries/ui-notes-editor.entry.js';
import { entry as uiFavouritesBank } from './entries/ui-favourites-bank.entry.js';
import { entry as uiPresetBank } from './entries/ui-preset-bank.entry.js';
import { entry as uiStopButton } from './entries/ui-stop-button.entry.js';
import { entry as uiRatingControl } from './entries/ui-rating-control.entry.js';
import { entry as uiDataGrid } from './entries/ui-data-grid.entry.js';
import { entry as uiScreensaver } from './entries/ui-screensaver.entry.js';
import { entry as uiSettingsRow } from './entries/ui-settings-row.entry.js';
import { entry as uiDefinitionCard } from './entries/ui-definition-card.entry.js';
import { entry as uiCardGrid } from './entries/ui-card-grid.entry.js';
import { entry as uiTileGrid } from './entries/ui-tile-grid.entry.js';
import { entry as uiColourSwatchRow } from './entries/ui-colour-swatch-row.entry.js';
import { entry as uiWizardColumn } from './entries/ui-wizard-column.entry.js';
import { entry as uiExitSentence } from './entries/ui-exit-sentence.entry.js';
import { entry as uiActionKeyRail } from './entries/ui-action-key-rail.entry.js';
import { entry as uiCompareBar } from './entries/ui-compare-bar.entry.js';

export const entries = [
    {
        id: 'base-fixture',
        title: 'Base-element conventions',
        module: '../../test/fixtures/base-fixture.js',
        notes:
            'Wave 0a item #2\'s fixture: every base convention on screen at once — the one '
            + 'focus ring in both offsets, the four selection dials, the shared hit-area '
            + 'utility, container hosting. Not a shipping component; it is here so the '
            + 'gallery and the capture battery have a subject from the first night.',
        states: [
            {
                id: 'default',
                title: 'Default',
                html: '<base-fixture></base-fixture>',
            },
            {
                id: 'narrow-container',
                title: 'Narrow container (380px)',
                notes:
                    'The container probe drops from 40px to 10px because the HOST is narrow, '
                    + 'at an unchanged viewport. A component keyed on @media would not move.',
                hostStyle: { 'inline-size': '380px' },
                html: '<base-fixture></base-fixture>',
            },
            {
                id: 'intrinsic-optout',
                title: 'Container-hosting opt-out',
                notes:
                    'One line of the component\'s own styles turns inline-size containment off, '
                    + 'so this one shrinks to fit its glyph while <base-fixture> fills its slot.',
                html: '<base-fixture-intrinsic>E</base-fixture-intrinsic>',
            },
        ],
    },

    // ---- Wave 1, the sixteen primitives (SCOPE.md Part 4, Wave 1 table) ----
    uiButton,        // #1  Button (+primary/tall/ghost/danger)
    uiIconButton,    // #2  Icon button (+lg)
    uiTextField,     // #6  Text field (formAssociated)
    uiSelect,        // #7  Select
    uiSwitch,        // #5  Switch
    uiSlider,        // #23 Slider
    uiBadge,         // #12 Badge (+active/attention)
    uiStatusChip,    // #48 Status chip / live pulse
    uiCard,          // #8  Card
    uiKeycap,        // #15 Keycap
    uiProgressTrack, // #17 Progress track
    uiLockedValue,   // #43 Locked value box
    uiEmptyState,    // #38 Empty state
    uiAlertBanner,   // #49 Alert banner
    typeRoles,       // #13 Type roles     — NOT an element: a shared style module
    seams,           // #14 Hairline/seam  — NOT an element: a layout utility

    // ---- Wave 2, the twelve state-and-navigation rows (waves/2/ITEMS.json order) ----
    uiBank,          // #3  Segmented bank — THE selection component
    uiStepper,       // #4  Stepper
    uiSearchField,   // #30 Search field
    uiListRow,       // #26 List row
    uiSectionHeader, // #27 Sticky section header
    uiFavouriteSlot, // #35 Favourite slot
    uiNavRow,        // #24 Nav row
    uiSubnavRow,     // #25 Sub-nav row
    uiSheetHeader,   // #16 Sheet header
    uiPageHeader,    // #31 Page header bar
    uiStatTile,      // #33 Stat tile / gauge
    uiPickDisc,      // #45 A/B pick disc

    /* Wave 3 */
    uiDialog,        // #18 Dialog / modal shell
    uiChartCard,     // #9  Chart card
    uiChartLegend,   // #10 Chart legend
    uiMenu,          // #21 Menu / popover
    uiToast,         // #22 Toast / notice region
    uiTabBar,        // #32 Tab bar
    plotSurface,     // gate 5 chart surface — a FIXTURE, and the Rule-1 canary's only home

    /* ---- Wave 4, the compounds and dialog bodies (waves/4/ITEMS.json order) ----
     * 139 states, which took the registry from 36 rows / 235 states to 58 / 374 — 57 rows
     * since 21 Aug 2026, when #56 (Toggle pill) dissolved into a `shape="pill"` attribute
     * on #5 and its entry went with the component (DQ-610, Ben's ruling); the pill's own
     * states live on `ui-switch` now, where the capability does. 56 rows since 30 Aug 2026,
     * when #28 (Folder disclosure) was DELETED — it was composed in zero places in `src/`,
     * the fold state the selector ships is its own (`_openFolders` + `profileFoldersOpen`),
     * and `profile-listbox.js` had already ruled that a foldered list is a tree, not this
     * component (audit F-005; Ben's decision D10, 30 Aug). Its entry file went with it. The
     * four Gate 7 domain ports in the same wave have no rows here on purpose: they are
     * modules, not elements, and the gallery's subjects are things that mount. */
    uiConfirmDialog,   // #19 Confirm dialog       — dialog body, runs inside #18's shell
    uiSheet,           // #20 Sheet                — dialog body
    uiNumericKeypad,   // #53 Numeric keypad       — dialog body
    uiTimePicker,      // #54 Time picker face     — dialog body
    uiNotesEditor,     // #55 Notes editor host    — dialog body
    uiFavouritesBank,  // #36 Favourites bank      — Live compound
    uiPresetBank,      // #37 Preset bank          — Live compound
    uiStopButton,      // #47 STOP overlay button  — Live compound
    uiRatingControl,   // #46 Rating control       — Live compound
    uiDataGrid,        // #34 Data grid / table    — Live compound
    uiScreensaver,     // #57 Screensaver          — Live compound
    uiSettingsRow,     // #29 Settings row         — settings compound
    uiDefinitionCard,  // #50 Definition card      — settings compound
    uiCardGrid,        // #51 Card grid            — settings compound
    uiTileGrid,        // #40 Auto-fill tile grid  — settings compound
    uiColourSwatchRow, // #52 Colour swatch row    — settings compound
    uiWizardColumn,    // #39 Wizard column + step chip — settings compound
    uiExitSentence,    // #41 Exit chip / sentence — editor compound
    uiActionKeyRail,   // #42 Action key rail      — editor compound
    uiCompareBar,      // #44 Compare bar          — history compound
];

/** Every state, flattened — the order the capture battery walks. */
export function allStates(list = entries) {
    return list.flatMap((entry) =>
        entry.states.map((state) => ({
            id: `${entry.id}--${state.id}`,
            entryId: entry.id,
            stateId: state.id,
            title: `${entry.title} — ${state.title}`,
            entry,
            state,
        })),
    );
}
