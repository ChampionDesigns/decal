/**
 * ui-status-chip.entry.js — the gallery entry for Wave 1 item #48.
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a
 * single exported array and its README says "Edit entries.js. That is the whole
 * procedure" — true for one builder, false for sixteen working in parallel with
 * whole-file writes: the last write wins and fifteen entries vanish silently, and
 * the gallery cannot detect that because a missing entry is just a shorter list.
 * So each builder owns one file here and the GATE agent wires them in.
 *
 * SHAPE is exactly the one entries.js documents: `module` is relative to
 * `tools/gallery/`, `hostStyle` sizes the STAGE not the component, and the full
 * state id is `ui-status-chip--<state.id>` — a capture-battery filename, so these
 * ids are identifiers and renaming one is a re-baseline.
 *
 * FOR THE GATE:  import { entry as uiStatusChip } from './entries/ui-status-chip.entry.js';
 *                export const entries = [ …, uiStatusChip ];
 */

export const entry = {
    id: 'ui-status-chip',
    title: 'Status chip / live pulse',
    module: '../../src/components/ui-status-chip.js',
    notes:
        'Wave 1 #48. Slate wrote this chip TWICE and shipped both: the rule that reaches the '
        + 'screen is #main-page #machine-status (slate-live.css:903-916, six !important '
        + 'declarations), and the rule that reaches nothing is #main-page .slate-chart-state '
        + '(:1738-1745) — bug L13, "styles a class no element carries". The two do not even '
        + 'agree on the type. Oracle: find --cls slate-chart-state → 0 elements in 0 states '
        + 'across all 49; find --id machine-status → 7 elements in 7 states, one geometry, '
        + '161 x 22. One chip here, not two. Everything a "chip" would decorate with — fill, '
        + 'border, radius, padding, shadow — measures zero on Slate in both themes, so this '
        + 'is tracked uppercase text at --ui-muted and nothing else.',
    states: [
        {
            id: 'ready',
            title: 'Ready',
            notes: 'The resting chip. --ui-muted ink, --ui-text-md (18px), uppercase, '
                + '--ui-tracking-cap. Oracle: live-ready #machine-status [i=94] '
                + 'color = rgb(148, 161, 169) ← var(--slate-muted); font-size = 18px '
                + '← var(--slate-text-md); text-transform = uppercase.',
            html: '<ui-status-chip>Ready</ui-status-chip>',
        },
        {
            id: 'disconnected',
            title: 'Disconnected',
            notes: 'The only word the capture battery ever caught: all seven '
                + '#machine-status records read text "Disconnected". Slate paints it in the '
                + 'same muted ink as every other state — the .status-msg-red class on the '
                + 'element loses to #main-page #machine-status — and so does this.',
            html: '<ui-status-chip>Disconnected</ui-status-chip>',
        },
        {
            id: 'live',
            title: 'Live, pulsing',
            notes: 'The recording pulse. A 10px --ui-status-danger disc at --ui-radius-pill, '
                + '--ui-space-2 from the words, breathing 1 → .3 over 1.6s ease-in-out. Read '
                + 'from slate-live.css:1832-1846 read-only: the corpus never captured it, '
                + 'because live-pulling was itself captured Disconnected. Slate\'s stated '
                + 'intent: "LIVE pulses so the difference between a shot happening now and a '
                + 'plot of one that finished is visible at arm\'s length."',
            html: '<ui-status-chip live>Live</ui-status-chip>',
        },
        {
            id: 'row',
            title: 'The three together',
            notes: 'One ink for every state — the oracle measures a single colour on all '
                + 'seven captured states in both themes, so there are no tones here. The '
                + 'small coloured status marker is item #12, Badge; a second one would be '
                + 'the fourteenth selection idiom all over again.',
            html: '<ui-status-chip>Ready</ui-status-chip>'
                + ' <ui-status-chip>Disconnected</ui-status-chip>'
                + ' <ui-status-chip live>Live</ui-status-chip>',
        },
        {
            id: 'narrow-container',
            title: 'In a 120px container',
            notes: 'The container state. Slate is white-space: nowrap at a frozen '
                + '1920x1200, which below that width is a silent clip — the inherited '
                + 'default §2.4 exists to remove. Here the words wrap and the dot does not: '
                + 'the chip may become taller, never wider than what holds it. Responsive '
                + 'behaviour has no Slate answer (Part 10 §4); the layout spec governs.',
            hostStyle: { 'inline-size': '120px' },
            html: '<ui-status-chip live>Disconnected</ui-status-chip>',
        },
        {
            id: 'focus',
            title: 'Focusable (tabindex from outside)',
            notes: 'The chip is a readout and takes no focus of its own — the row cites '
                + 'neither Appendix 5 nor a hit floor, and a 48px box on a text label would '
                + 'push a header band apart for a target nobody can press. When a screen '
                + 'makes it focusable the base ring applies unmodified, from --ui-focus-w '
                + 'and --ui-focus-offset, with nothing here to clip it (bug L24).',
            html: '<ui-status-chip tabindex="0" live>Live</ui-status-chip>',
        },
    ],
};

export default entry;
