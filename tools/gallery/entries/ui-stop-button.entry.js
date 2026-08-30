/**
 * ui-stop-button.entry.js — the gallery entry for Wave 4 item #47.
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a single
 * exported array and its README says "Edit entries.js. That is the whole procedure" —
 * true for one builder, false for a wave of them working in parallel under a
 * whole-file-write rule: the last write wins and the other entries vanish silently, and
 * the gallery cannot detect that because a missing entry is just a shorter list. So each
 * builder owns one file here and the wave's single cross-cutting writer wires them in.
 *
 * SHAPE is exactly the one entries.js documents: `module` is relative to `tools/gallery/`,
 * `hostStyle` sizes the STAGE and not the component, and the full state id is
 * `ui-stop-button--<state.id>` — a capture-battery filename, so these ids are identifiers
 * and renaming one is a re-baseline.
 *
 * FOR THE GATE:  import { entry as uiStopButton } from './entries/ui-stop-button.entry.js';
 *                export const entries = [ …, uiStopButton ];
 */

/* The rail at Slate's frozen capture width. `find --cls slate-stepper` measures 85
 * elements in 16 states, every one 268x64 at x=134; the abort target is 430 wide,
 * i.e. the RAIL, not the row. Quoted as what Slate does — --ui-rail-w is
 * clamp(320px, 26%, 460px) and 430 is one point on that line. */
const RAIL = { 'inline-size': '430px' };

/* One grid cell holding both the row and the overlay, which is how the rewrite gets
 * Slate's `position: absolute; top: 25px; z-index: 6` without a component that positions
 * itself. Nothing moves when the control appears. */
const STACK = 'display:grid;';
const CELL = 'grid-area:1/1;';
/* The seam IS the divider, written the way the spec's own Live skeleton writes it —
 * LAYOUT_SPEC_DRAFT.md:521-525, `display:grid; gap: var(--ui-seam); background:
 * var(--ui-line-strong)`. Inline here because a gallery state is markup, not a
 * component; a component would import the `seams` fragment (CONVENTIONS §13). */
const RAIL_ROWS = 'display:grid; gap:var(--ui-seam); background:var(--ui-line-strong);';

export const entry = {
    id: 'ui-stop-button',
    title: 'STOP overlay button',
    module: './entries/ui-stop-button.demo.js',
    notes:
        'Wave 4 #47, "the full-width shot-abort control" (SCOPE Part 4). THE ORACLE HAS NO '
        + 'ANSWER FOR IT: find --cls slate-rail-stop, --id ghc-stop-btn-rail and --id '
        + 'ghc-stop-btn each return "found 0 element(s) in 0 state(s)" across all 49 states, '
        + 'because the control ships hidden (index.html:131) and no capture ever ran a '
        + 'machine — the documented carve-out for states outside the 49. So the paint is a '
        + 'read-only source read of slate-live.css:1773-1797 with every token cross-cited '
        + 'from elsewhere in the corpus: --ui-status-danger (CITE .slate-btn [i=72] '
        + 'rgb(230,102,97) light rgb(181,28,35) <- var(--slate-danger)), --ui-on-primary '
        + '(CITE .slate-btn [i=100] rgb(246,251,253) <- var(--slate-on-primary)), '
        + '--ui-control-h (CITE .slate-btn [i=43] min-height 64px <- '
        + 'var(--slate-control-height)) and --ui-display-xs (CITE #grind-value [i=21] '
        + '27px <- var(--slate-display-xs)). It does not position itself and it is absent, '
        + 'not hidden, when nothing is running.',
    states: [
        {
            id: 'running',
            title: 'Running',
            notes: 'The control, alone, at the rail width. Solid --ui-status-danger with '
                + '--ui-on-primary ink, --ui-control-h tall, square-cornered and borderless '
                + '(slate-live.css:1783-1791). The word is a translated value (D2) and the '
                + 'accessible name is Slate\'s own, "Stop the machine".',
            hostStyle: RAIL,
            html: '<ui-stop-button running></ui-stop-button>',
        },
        {
            id: 'rail-idle',
            title: 'Rail, nothing running',
            notes: 'Half of the pair that is the whole point. The overlay is ABSENT — not '
                + 'hidden, not dimmed: "no cost at all when nothing is running: the control '
                + 'does not exist then" (ui.js:3559-3561). Compare with rail-running.',
            hostStyle: RAIL,
            html: `<div style="${RAIL_ROWS}">`
                + `<div style="${STACK}">`
                + `<ui-stepper style="${CELL}" label="Grind" value="93"></ui-stepper>`
                + `<ui-stop-button style="${CELL}"></ui-stop-button>`
                + '</div>'
                + '<ui-stepper label="Dose" unit="g" value="17" step="0.1"></ui-stepper>'
                + '<ui-stepper label="Drink weight" unit="g" value="40"></ui-stepper>'
                + '</div>',
        },
        {
            id: 'rail-running',
            title: 'Rail, running',
            notes: 'The other half. One thing changed and NOTHING MOVED: the row and the '
                + 'overlay share one grid cell, which is the rewrite\'s answer to Slate\'s '
                + 'hand-solved "top: 25px; z-index: 6" and to Appendix item 3, "state '
                + 'changes weight, never position". Slate takes the Grind row deliberately '
                + '— "the row you cannot want while the pump is running". The rows below '
                + 'receding is the RAIL\'s job, not this control\'s (bug L11: one owner per '
                + 'visual state).',
            hostStyle: RAIL,
            html: `<div style="${RAIL_ROWS}">`
                + `<div style="${STACK}">`
                + `<ui-stepper style="${CELL}" label="Grind" value="93"></ui-stepper>`
                + `<ui-stop-button style="${CELL}" running></ui-stop-button>`
                + '</div>'
                + '<ui-stepper label="Dose" unit="g" value="17" step="0.1"></ui-stepper>'
                + '<ui-stepper label="Drink weight" unit="g" value="40"></ui-stepper>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 200px container',
            notes: 'The container floor. The box still clears --ui-control-h and the touch '
                + 'floor — "ergonomics is physical", so the height never scales with the '
                + 'width — and the display step is clamp(22px, 2.2cqi, 27px) against THIS '
                + 'component\'s container, so it sits on the 22px floor here and reaches '
                + 'Slate\'s 27px only past ~1227px. Slate is frozen at 1920x1200 and has no '
                + 'vote on responsive behaviour.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-stop-button running></ui-stop-button>',
        },
        {
            id: 'slotted-word',
            title: 'A different verb, slotted',
            notes: 'The visible word is a slot with a translated fallback; label="" then '
                + 'hands the accessible name to the words instead of Slate\'s sentence. '
                + 'Shown wide, where the display step reaches its 27px ceiling.',
            hostStyle: { 'inline-size': '820px' },
            html: '<ui-stop-button running label="">Abort shot</ui-stop-button>',
        },
    ],
};

export default entry;
