/**
 * The gallery entry for.
 */

const RAIL = { 'inline-size': '430px' };

const STACK = 'display:grid;';
const CELL = 'grid-area:1/1;';
const RAIL_ROWS = 'display:grid; gap:var(--ui-seam); background:var(--ui-line-strong);';

export const entry = {
    id: 'ui-stop-button',
    title: 'STOP overlay button',
    module: './entries/ui-stop-button.demo.js',
    notes:
        'Wave 4 #47, "the full-width shot-abort control". THE ORACLE HAS NO '
        + 'ANSWER FOR IT: find --cls slate-rail-stop, --id ghc-stop-btn-rail and --id '
        + 'ghc-stop-btn each return "found 0 element(s) in 0 state(s)" across all 49 states, '
        + 'because the control ships hidden (index.html:131) and no capture ever ran a '
        + 'machine — the documented carve-out for states outside the 49. So the paint is a '
        + 'read-only source read of the old sheet with every token cross-cited '
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
                + '. The word is a translated value (D2) and the '
                + 'accessible name is the reference skin\'s own, "Stop the machine".',
            hostStyle: RAIL,
            html: '<ui-stop-button running></ui-stop-button>',
        },
        {
            id: 'rail-idle',
            title: 'Rail, nothing running',
            notes: 'Half of the pair that is the whole point. The overlay is ABSENT — not '
                + 'hidden, not dimmed: "no cost at all when nothing is running: the control '
                + 'does not exist then". Compare with rail-running.',
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
                + 'overlay share one grid cell, which is the rewrite\'s answer to the reference skin\'s '
                + 'hand-solved "top: 25px; z-index: 6" and to Appendix item 3, "state '
                + 'changes weight, never position". The reference skin takes the Grind row deliberately '
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
                + 'the reference skin\'s 27px only past ~1227px. The reference skin is frozen at 1920x1200 and has no '
                + 'vote on responsive behaviour.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-stop-button running></ui-stop-button>',
        },
        {
            id: 'slotted-word',
            title: 'A different verb, slotted',
            notes: 'The visible word is a slot with a translated fallback; label="" then '
                + 'hands the accessible name to the words instead of the reference skin\'s sentence. '
                + 'Shown wide, where the display step reaches its 27px ceiling.',
            hostStyle: { 'inline-size': '820px' },
            html: '<ui-stop-button running label="">Abort shot</ui-stop-button>',
        },
    ],
};

export default entry;
