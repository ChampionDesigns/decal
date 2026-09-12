/**
 * The gallery entry for the row of colour presets. Its states are the row with nothing
 * active, one preset seated, no colour arrived at all, a leaf too narrow to hold the row
 * on one line, one preset unavailable, the whole row disabled, and the row with the
 * theme dials moved.
 */

const LED_PRESETS = JSON.stringify([
    { hex: '#000000', label: 'Off' },
    { hex: '#FFAA55', label: 'Warm White' },
    { hex: '#FFD9A0', label: 'Soft White' },
    { hex: '#EAF2FF', label: 'Daylight' },
    { hex: '#234F63', label: 'Blue' },
    { hex: '#FF7A00', label: 'Amber' },
    { hex: '#FF2200', label: 'Red' },
    { hex: '#0CA581', label: 'Green' },
    { hex: '#00C2D1', label: 'Cyan' },
    { hex: '#7A3FF2', label: 'Purple' },
]);

const row = (attrs) =>
    `<ui-colour-swatch-row label="LED colour presets" ${attrs} swatches='${LED_PRESETS}'></ui-colour-swatch-row>`;

export const entry = {
    id: 'ui-colour-swatch-row',
    title: 'Colour swatch row',
    module: '../../src/components/ui-colour-swatch-row.js',
    notes:
        'Wave 4 #52, the Lighting leaf\'s LED preset row. The reference skin ships ten 64x64 swatches here '
        + '(CITE find --cls slate-swatch: 10 elements in 1 state, all 64 x 64, x = 629 … 1331, '
        + 'y = 816) and NOT ONE of the five declarations that were meant to style them survives '
        + 'the cascade: the generic Settings button reset marks '
        + 'border-width, border-color, border-radius and box-shadow !important, so .slate-swatch\'s '
        + 'P30 ring (2px of --slate-line-strong, "its ring must be legible against BOTH the swatch '
        + 'and the page") measures 1px of --slate-line, the 50% circle measures a 6px rectangle, '
        + 'and every declaration of .slate-swatch.is-selected — 3px border, --slate-text ink, a '
        + 'canvas halo — loses outright, so a selected preset and an unselected one are the same '
        + 'pixels. Here the ring is --ui-line-strong, its selected weight is --ui-border-w-strong '
        + '(the token spec §3.6 created out of that dead 3px), and the selected paint is the four '
        + 'dials on the button while the sample keeps the machine\'s colour. Nothing outside can '
        + 'reach in to undo any of it.',
    states: [
        {
            id: 'nothing-active',
            title: 'Ten presets, none of them the machine\'s colour',
            notes: 'the reference skin\'s own captured state, and the honest one: CITE prov_query find '
                + '--cls is-selected returns 3 elements in 3 states, all editor tabs — no swatch '
                + 'in any of the 49 states is selected, because the strip was on a hand-picked '
                + 'colour. The highlight is derived from the current colour and read-only in both '
                + 'directions, so "none" is a first-class state rather '
                + 'than an error. Note the ring: every swatch has a visible edge against the page '
                + 'INCLUDING the black one, which is the whole of P30 and is what the reference skin\'s 1px of '
                + '--slate-line does not deliver.',
            hostStyle: { 'inline-size': '860px' },
            html: row('value="#1B9E5A"'),
        },
        {
            id: 'amber-active',
            title: 'Amber active — the seated ring',
            notes: 'The selected swatch takes --ui-selected-face in the seat between the ring and '
                + 'the sample, --ui-selected-ink as its currentColor, the --ui-selected-led inset '
                + 'strip and the --ui-selected-glow, all from selectionSurface and none of them '
                + 'written in this component. The one thing the component states is the ring\'s '
                + 'weight, --ui-border-w-strong, which is exactly what row #52 asks for: '
                + '"Selected treatment via --ui-border-w-strong, not a private 3px". The sample '
                + 'itself is untouched by selection — its fill is the machine\'s colour, and a '
                + 'selection treatment that painted over it would erase the row\'s subject.',
            hostStyle: { 'inline-size': '860px' },
            html: row('value="#ff7a00"'),
        },
        {
            id: 'absent-value',
            title: 'No colour has arrived',
            notes: 'A7, rendered: absence is a state, not a prompt to invent a value. The row is '
                + 'given no `value` at all, so nothing is lit — there is no "?? the first preset" '
                + 'anywhere below, and an absence object from src/data/reading.js reaches the same '
                + 'answer through isNoReading. Case is not a difference either: the previous state '
                + 'passes "#ff7a00" against a palette written "#FF7A00" and they are one colour '
                + '(the comparison half of settings.js:3841-3848, carried; the getComputedStyle '
                + 'half, not).',
            hostStyle: { 'inline-size': '860px' },
            html: row(''),
        },
        {
            id: 'narrow-leaf',
            title: 'In a 300px leaf — it wraps, it does not shrink',
            notes: 'The component reads its own container and never the viewport (spec §2.1 Rule '
                + '1); flex wrapping IS the container query here, resolving against the host\'s '
                + 'own inline size. What it must not do is shrink a swatch to fit: the sample is '
                + 'max(--ui-control-h, --ui-hit-min), so the 64px the reference skin measures is kept and the '
                + '48px touch floor is kept under it whatever a fork does to the control token — '
                + '"a wet fingertip is about 9 mm" is physical. Nothing is clipped and nothing '
                + 'scrolls sideways (spec §2.4).',
            hostStyle: { 'inline-size': '300px' },
            html: row('value="#0ca581"'),
        },
        {
            id: 'one-swatch-unavailable',
            title: 'One preset unavailable',
            notes: 'A swatch may state its own { hex, label, disabled }. A disabled swatch dims '
                + 'from the base\'s one disabled dial (--ui-opacity-disabled, .38) and refuses the '
                + 'press through the native disabled attribute — paint and behaviour said once '
                + 'each, in the two places that own them.',
            hostStyle: { 'inline-size': '860px' },
            html: '<ui-colour-swatch-row label="LED colour presets" value="#ffd9a0"'
                + ' swatches=\'[{"hex":"#000000","label":"Off"},'
                + '{"hex":"#FFAA55","label":"Warm White"},'
                + '{"hex":"#FFD9A0","label":"Soft White"},'
                + '{"hex":"#EAF2FF","label":"Daylight","disabled":true},'
                + '{"hex":"#FF7A00","label":"Amber"}]\'></ui-colour-swatch-row>',
        },
        {
            id: 'row-disabled',
            title: 'The whole row disabled — one fade, not two',
            notes: 'The strip is off, so the palette is unavailable. One fade at '
                + '--ui-opacity-disabled: the composition\'s arithmetic trap is that the base dims '
                + 'the host AND every [disabled] button inside it, so without the opt-out the two '
                + 'multiply — .38 x .38 = .14, three times fainter than every other disabled '
                + 'control in the skin. ui-preset-bank and ui-tab-bar carry the same one-line fix.',
            hostStyle: { 'inline-size': '860px' },
            html: row('value="#00c2d1" disabled'),
        },
        {
            id: 'dials-radian',
            title: 'The four dials moved (a Radian-shaped preview)',
            notes: 'The same row with the LED and glow dials turned up on the stage, which is what '
                + 'the Radian fork does. Zero rule changes in this component: this state IS the '
                + 'claim the row exists to make. The reference skin cannot do it here at all — its selected '
                + 'swatch has no surviving treatment to retarget, and its ring colour comes from a '
                + '!important reset in a sheet the swatch\'s own rule cannot outrank.',
            hostStyle: {
                'inline-size': '860px',
                '--ui-selected-led': '4px',
                '--ui-selected-glow': '55%',
            },
            html: row('value="#7a3ff2"'),
        },
    ],
};

export default entry;
