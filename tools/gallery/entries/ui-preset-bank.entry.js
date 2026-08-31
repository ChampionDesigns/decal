/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-preset-bank',
    title: 'Preset bank',
    module: '../../src/components/ui-preset-bank.js',
    notes:
        'Wave 4 #37, the Live rail\'s steam / hot-water / dose shortcut row — and one of the '
        + 'four selection implementations the audit started from: "The preset bank is a fourth '
        + 'idiom (spec §5.2 #37)". The reference skin paints its active preset with four properties and no '
        + 'dial — ink at var(--slate-text), font-weight 300 → 400, a steel text-shadow glow and '
        + 'a 42px ::after underline — so a fork can retarget every --slate-selected-* value and '
        + 'this row will not move. Here the row IS a ui-bank (#3) in its toolbar spelling: this '
        + 'component contributes one CSS rule, opacity: 1, and no colour at all. The half it '
        + 'does own is which preset is lit, and that is derived from the control\'s current '
        + 'value and read-only in both directions — a press publishes '
        + 'preset-select with the preset\'s NUMBER and the highlight waits for the machine.',
    states: [
        {
            id: 'drink-out',
            title: 'Drink weight — 40 g active',
            notes: 'the reference skin\'s own row, measured: CITE live-ready #drink-out-preset-1..4 [i=37..40] '
                + 'four cells at x=134 / 201 / 268 / 335, each 67 x 34, texts "30" "36" "40" "50", '
                + 'with #drink-out-preset-3 carrying .preset-active. Four equal cells across the '
                + 'width of the stepper they set (.slate-stepper is 268 x 64 in all 85 elements the '
                + 'corpus finds) — which is what ui-bank gives for nothing, its items being '
                + 'flex: 1 1 0. The active cell is the two colour dials and nothing else.',
            hostStyle: { 'inline-size': '400px' },
            html: '<ui-preset-bank label="Drink weight presets" value="40"'
                + " presets='[30,36,40,50]'></ui-preset-bank>",
        },
        {
            id: 'steam-flow-hand-dialled',
            title: 'Steam flow — nothing active, and that is the honest state',
            notes: 'The same Live screen ships a second preset row with NO active preset: CITE '
                + 'live-ready, find --cls has-context-menu returns 8 preset buttons (drink-out at '
                + 'y=395, steam-flow 0.6 / 0.8 / 1.0 / 1.2 at y=764) while find --cls preset-active '
                + 'returns exactly one. The flow was hand-dialled, so no shortcut matches — '
                + '"no highlight, the honest state for a hand-dialed flow". '
                + 'Note "1.0" rather than "1": the label and the match are both read at the row\'s '
                + 'step, through one formatter (units.js formatToStep), so they cannot disagree.',
            hostStyle: { 'inline-size': '400px' },
            html: '<ui-preset-bank label="Steam flow presets" value="0.9"'
                + " presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>",
        },
        {
            id: 'steam-temp',
            title: 'Steam temperature — the corrected table',
            notes: 'Presets are choices, not bounds: this component carries no limits table, '
                + 'because B2/R2 allow exactly one in the skin and it lives behind r2MachineLimits. '
                + 'The values shown are inside the corrected steam range — floor 135, ceiling 165 '
                + 'on a Bengle and 160 on a DE1 (machine-limits.js; '
                + 'ReaPrime de1_controller.dart:545). The retired table\'s 130 is a dead band with '
                + 'the heater off, and it appears nowhere in this row.',
            hostStyle: { 'inline-size': '400px' },
            html: '<ui-preset-bank label="Steam temperature presets" value="145"'
                + " presets='[135,145,155,165]'></ui-preset-bank>",
        },
        {
            id: 'labelled-and-disabled-cell',
            title: 'Named presets, one unavailable',
            notes: 'A preset may state its own label when the number is not the word — the object '
                + 'form { value, label, disabled }. A disabled cell dims from the base\'s one '
                + 'disabled dial (--ui-opacity-disabled, .38) and refuses the press through the '
                + 'native disabled attribute on the bank\'s own button; it is still matched, because '
                + 'the highlight reports what the value IS, not what the row would let you choose.',
            hostStyle: { 'inline-size': '400px' },
            html: '<ui-preset-bank label="Hot water volume presets" value="150"'
                + ' presets=\'[{"value":50,"label":"Rinse"},{"value":150},{"value":250},'
                + '{"value":400,"label":"400","disabled":true}]\'></ui-preset-bank>',
        },
        {
            id: 'disabled',
            title: 'The whole row disabled',
            notes: 'One fade, at --ui-opacity-disabled. The composition\'s arithmetic trap is here '
                + 'and is the only rule this component ships: the base dims the host AND the bank '
                + 'inside it, so without an opt-out the two multiply — .38 x .38 = .14, a row three '
                + 'times fainter than every other disabled control in the skin. The outer host keeps '
                + 'the dial because it is the element a screen disabled.',
            hostStyle: { 'inline-size': '400px' },
            html: '<ui-preset-bank label="Steam flow presets" value="0.8" disabled'
                + " presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>",
        },
        {
            id: 'narrow-container',
            title: 'In a 260px container',
            notes: 'The component reads its own container and never the viewport. The bank shrinks '
                + 'its four cells and ellipsises rather than clipping or scrolling — nothing is '
                + 'silently removed (spec §2.4). What it does NOT do is drop below the touch floor: '
                + 'the cell is --ui-control-inner tall (62px) against a --ui-hit-min of 48, because '
                + 'a wet fingertip is about 9 mm whatever the container is doing.',
            hostStyle: { 'inline-size': '260px' },
            html: '<ui-preset-bank label="Steam flow presets" value="1"'
                + " presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>",
        },
        {
            id: 'three-rows-one-treatment',
            title: 'Three rows, one selected treatment',
            notes: 'The founding defect, inverted. In the reference skin these three rows would be a preset '
                + 'idiom, a bank and a favourites copy painting "selected" three different ways; '
                + 'here they are three uses of one component, so the lit cell reads identically '
                + 'down the column and one turn of --ui-selected-face moves all three.',
            hostStyle: { 'inline-size': '400px' },
            html: '<div style="display: grid; gap: 18px;">'
                + '<ui-preset-bank label="Drink weight presets" value="40"'
                + " presets='[30,36,40,50]'></ui-preset-bank>"
                + '<ui-preset-bank label="Steam temperature presets" value="155"'
                + " presets='[135,145,155,165]'></ui-preset-bank>"
                + '<ui-preset-bank label="Steam flow presets" value="0.8"'
                + " presets='[0.6,0.8,1.0,1.2]'></ui-preset-bank>"
                + '</div>',
        },
        {
            id: 'dials-radian',
            title: 'The four dials moved (a Radian-shaped preview)',
            notes: 'The same three rows with the LED and glow dials turned up on the stage, which '
                + 'is what the Radian fork does. Zero rule changes in this component and zero in '
                + 'ui-bank — this state IS the claim the row exists to make, rendered. The reference skin\'s '
                + 'fourth idiom cannot do it: its glow is a hard-coded steel text-shadow and its '
                + 'underline a 42px ::after, neither of them reachable from a dial.',
            hostStyle: {
                'inline-size': '400px',
                '--ui-selected-led': '4px',
                '--ui-selected-glow': '55%',
            },
            html: '<div style="display: grid; gap: 18px;">'
                + '<ui-preset-bank label="Drink weight presets" value="40"'
                + " presets='[30,36,40,50]'></ui-preset-bank>"
                + '<ui-preset-bank label="Steam temperature presets" value="155"'
                + " presets='[135,145,155,165]'></ui-preset-bank>"
                + '</div>',
        },
    ],
};

export default entry;
