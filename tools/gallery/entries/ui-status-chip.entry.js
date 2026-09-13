/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-status-chip',
    title: 'Status chip / live pulse',
    module: '../../src/components/ui-status-chip.js',
    notes:
        'Wave 1 #48. The reference skin wrote this chip TWICE and shipped both: the rule that reaches the '
        + 'screen is #main-page #machine-status (six !important '
        + 'declarations), and the rule that reaches nothing is #main-page .slate-chart-state '
        + '(:1738-1745) — bug L13, "styles a class no element carries". The two do not even '
        + 'agree on the type. Oracle: find --cls slate-chart-state → 0 elements in 0 states '
        + 'across all 49; find --id machine-status → 7 elements in 7 states, one geometry, '
        + '161 x 22. One chip here, not two. Everything a "chip" would decorate with — fill, '
        + 'border, radius, padding, shadow — measures zero on the reference skin in both themes, so this '
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
                + '#machine-status records read text "Disconnected". The reference skin paints it in the '
                + 'same muted ink as every other state — the .status-msg-red class on the '
                + 'element loses to #main-page #machine-status — and so does this.',
            html: '<ui-status-chip>Disconnected</ui-status-chip>',
        },
        {
            id: 'live',
            title: 'A tone, breathing',
            notes: 'A 10px disc in the tone\'s own token at --ui-radius-pill, --ui-space-2 '
                + 'from the words, breathing 1 → .3 over 1.6s ease-in-out. Every tone '
                + 'breathes, so the movement says the app is still updating rather than that '
                + 'a shot is running.',
            html: '<ui-status-chip tone="active">Live</ui-status-chip>',
        },
        {
            id: 'tones',
            title: 'The six tones',
            notes: 'ok, active, attention, busy, asleep and error, in that order. Five '
                + 'tokens: --ui-status-ok, --ui-status-danger, --ui-status-attention, '
                + '--ui-status-busy and --ui-status-asleep — error shares danger\'s red and '
                + 'is told apart by the alarm and the ring rather than by hue. Which machine '
                + 'state is which tone is the consumer\'s; this component knows six names.',
            html: '<ui-status-chip tone="ok">Idle</ui-status-chip>'
                + ' <ui-status-chip tone="active">Steaming</ui-status-chip>'
                + ' <ui-status-chip tone="attention">Needs water</ui-status-chip>'
                + ' <ui-status-chip tone="busy">Booting</ui-status-chip>'
                + ' <ui-status-chip tone="asleep">Asleep</ui-status-chip>'
                + ' <ui-status-chip tone="error">Error</ui-status-chip>',
        },
        {
            id: 'row',
            title: 'The three together',
            notes: 'One ink for the WORDS in every state, in both themes — the tone '
                + 'colours the dot rather than the text. A chip that names no tone '
                + 'draws no dot.',
            html: '<ui-status-chip>Ready</ui-status-chip>'
                + ' <ui-status-chip>Disconnected</ui-status-chip>'
                + ' <ui-status-chip tone="active">Live</ui-status-chip>',
        },
        {
            id: 'narrow-container',
            title: 'In a 120px container',
            notes: 'The container state. The reference skin is white-space: nowrap at a frozen '
                + '1920x1200, which below that width is a silent clip — the inherited '
                + 'default §2.4 exists to remove. Here the words wrap and the dot does not: '
                + 'the chip may become taller, never wider than what holds it. Responsive '
                + 'behaviour has no the reference skin answer (Part 10 §4); the layout spec governs.',
            hostStyle: { 'inline-size': '120px' },
            html: '<ui-status-chip tone="active">Disconnected</ui-status-chip>',
        },
        {
            id: 'focus',
            title: 'Focusable (tabindex from outside)',
            notes: 'The chip is a readout and takes no focus of its own — the row cites '
                + 'neither Appendix 5 nor a hit floor, and a 48px box on a text label would '
                + 'push a header band apart for a target nobody can press. When a screen '
                + 'makes it focusable the base ring applies unmodified, from --ui-focus-w '
                + 'and --ui-focus-offset, with nothing here to clip it (bug L24).',
            html: '<ui-status-chip tabindex="0" tone="active">Live</ui-status-chip>',
        },
    ],
};

export default entry;
