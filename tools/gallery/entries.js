/**
 * The gallery's registry.
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

import { entry as uiDialog } from './entries/ui-dialog.entry.js';
import { entry as uiChartCard } from './entries/ui-chart-card.entry.js';
import { entry as uiChartLegend } from './entries/ui-chart-legend.entry.js';
import { entry as uiMenu } from './entries/ui-menu.entry.js';
import { entry as uiToast } from './entries/ui-toast.entry.js';
import { entry as uiTabBar } from './entries/ui-tab-bar.entry.js';

import { entry as plotSurface } from './entries/plot-surface.entry.js';

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

    uiDialog,        // #18 Dialog / modal shell
    uiChartCard,     // #9  Chart card
    uiChartLegend,   // #10 Chart legend
    uiMenu,          // #21 Menu / popover
    uiToast,         // #22 Toast / notice region
    uiTabBar,        // #32 Tab bar
    plotSurface,     // gate 5 chart surface — a FIXTURE, and the Rule-1 canary's only home

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
