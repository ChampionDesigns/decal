/**
 * ui-wizard-column.entry.js — the gallery entry for Wave 4 item #39, the Wizard column
 * + step chip.
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a single
 * hand-written array and this run writes whole files, so a wave of parallel builders
 * editing it means the last write wins and every other entry vanishes silently — a
 * missing entry is just a shorter list, which the gallery cannot detect. This builder
 * owns this file; the wave's one cross-cutting writer adds the single import line and the
 * single array slot, serially, once.
 *
 * FOR THE GATE:  import { entry as uiWizardColumn } from './entries/ui-wizard-column.entry.js';
 *                export const entries = [ …, uiWizardColumn ];
 *
 * SHAPE is the one entries.js documents: `module` is relative to `tools/gallery/` (here a
 * demo sidecar, because each state mounts three custom elements), `hostStyle` sizes the
 * STAGE and not the component (spec §2.1 Rule 1), and the full state id is
 * `ui-wizard-column--<state.id>` — a capture-battery filename, so these ids are
 * identifiers and renaming one is a re-baseline.
 *
 * WHAT A REVIEWER SHOULD LOOK AT, in the order the states are listed:
 *
 *   1. `step-1` is Slate's own captured leaf, rebuilt. Compare it against
 *      `settings-calibration-load-cells`: same four chips, same 44x44, same square 6px
 *      corners, same "Step 1 of 4 · Zero" line — and a column that ends where every
 *      other leaf ends instead of 63px further right (T1).
 *   2. `mid-walk` is the state Slate has NO capture of: two steps behind the walk, one
 *      current, one ahead. Three luminances, one of them arriving from the four
 *      selection dials rather than from an inline style on a div.
 *   3. `narrow` is what the corpus cannot answer at all — the column at 360px. The chips
 *      hold 44x44 and the strip wraps; nothing shrinks and nothing clips.
 *   4. `no-actions` is the F3 hole, photographed. The wizard ships without a
 *      reset-to-default control (SCOPE.md:94-97, Q1), and because every action is
 *      slotted, "without the control" is a state this component already has rather than
 *      a feature waiting to be removed.
 *
 * THE STEP NAMES ARE SLATE'S — 'Zero', 'Left cell', 'Right cell', 'Verify'
 * (`settings.js:4867`, read-only) — because they are what the machine's calibration walk
 * actually does. They are DATA the screen passes in, not strings this component owns.
 */

const STEPS = JSON.stringify(['Zero', 'Left cell', 'Right cell', 'Verify']);

/** Slate's card copy for step 1 (`settings.js`, the CAL_CARD body), abridged. */
const ZERO_CARD =
    '<ui-card>Zero the load cells. Remove the cup platform and anything resting on the '
    + 'drip tray, then press Zero.</ui-card>';

const RIGHT_CARD =
    '<ui-card>Place the calibration weight over the RIGHT cell and hold it steady, then '
    + 'press Calibrate.</ui-card>';

export const entry = {
    id: 'ui-wizard-column',
    title: 'Wizard column',
    module: './entries/ui-wizard-column.demo.js',
    notes:
        'Wave 4 #39, the load-cell calibration walk. Slate\'s wizard is the one leaf that '
        + 'is 63px wider than the other 37 (T1: CITE find --cls slate-cal-step-label -> '
        + 'settings-calibration-load-cells [i=50] rect 629,321,1263,27, against the 1200px '
        + 'cap every sibling gets) and it hangs a 760px card inside that (CITE find --cls '
        + 'slate-cal-card -> [i=51] rect 629,384,760,296) — two of T21\'s three live '
        + 'measures in one leaf. This component declares no width at all, so both numbers '
        + 'are unreachable. The chips are measured 44x44 (CITE find --cls rounded-full -> '
        + '4 elements at 629/733/837/941, y 259, 44x44) with square 6px corners, because '
        + 'the shell\'s rounded-full override outranks the Tailwind class; the current '
        + 'chip\'s rgb(176,196,206) on rgb(18,24,28) is --ui-steel on --ui-on-steel, which '
        + 'is exactly what the four selection dials ship — same pixels, reached through '
        + 'the dial instead of an inline style.',
    states: [
        {
            id: 'step-1',
            title: 'Step 1 of 4 — Slate\'s captured state',
            notes:
                'The leaf as the corpus has it: step 1 current, three ahead, no step '
                + 'behind the walk yet. The connectors are all unwalked.',
            hostStyle: { 'inline-size': '760px' },
            html:
                `<ui-wizard-column label="Load cell calibration steps" steps='${STEPS}' current="1">`
                + ZERO_CARD
                + '<ui-button slot="actions" variant="primary">Zero</ui-button>'
                + '</ui-wizard-column>',
        },
        {
            id: 'mid-walk',
            title: 'Step 3 of 4 — two done, one current, one ahead',
            notes:
                'The state Slate never captured. Done chips are filled and quiet with a '
                + 'check; the current chip is the selection dials; the ahead chip is an '
                + 'outline. The connectors behind the walk take --ui-line-strong.',
            hostStyle: { 'inline-size': '760px' },
            html:
                `<ui-wizard-column label="Load cell calibration steps" steps='${STEPS}' current="3">`
                + RIGHT_CARD
                + '<ui-button slot="actions" variant="primary">Calibrate</ui-button>'
                + '<ui-button slot="actions">Skip</ui-button>'
                + '</ui-wizard-column>',
        },
        {
            id: 'narrow',
            title: 'The column at 360px',
            notes:
                'What the frozen 1920x1200 corpus cannot answer (Part 10 §4). The chips '
                + 'hold their 44x44 — a touch floor is never fluid, spec §2.2 — the strip '
                + 'wraps in whole chip+connector units, and the actions wrap with it.',
            hostStyle: { 'inline-size': '360px' },
            html:
                `<ui-wizard-column label="Load cell calibration steps" steps='${STEPS}' current="3">`
                + RIGHT_CARD
                + '<ui-button slot="actions" variant="primary">Calibrate</ui-button>'
                + '<ui-button slot="actions">Skip</ui-button>'
                + '</ui-wizard-column>',
        },
        {
            id: 'no-actions',
            title: 'No action slotted — the F3 hole',
            notes:
                'F3 (calibration reset semantics) is blocked on Ben, so the wizard ships '
                + 'without a reset-to-default control and the omission is recorded (Q1). '
                + 'Every action here is slotted, so this is simply a state: the actions '
                + 'cluster draws no box and the column draws no row gap for it.',
            hostStyle: { 'inline-size': '760px' },
            html:
                `<ui-wizard-column label="Load cell calibration steps" steps='${STEPS}' current="4">`
                + '<ui-card>Calibration complete. Check the reading against a known '
                + 'weight before you brew.</ui-card>'
                + '</ui-wizard-column>',
        },
    ],
};
