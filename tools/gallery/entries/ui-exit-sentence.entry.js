/**
 * The gallery entry for.
 */

const PRESSURE_STEP = JSON.stringify({
    pump: 'flow',
    exit: { type: 'pressure', condition: 'over', value: 4.5 },
    volume: 100,
});

const DEAD_FLOW_STEP = JSON.stringify({
    pump: 'pressure',
    exit: { type: 'flow', condition: 'under', value: 0 },
    volume: 100,
});

const FULL_STEP = JSON.stringify({
    pump: 'flow',
    exit: { type: 'power', condition: 'over', value: 7.2 },
    volume: 36,
    weight: 18,
});

const EMPTY_STEP = JSON.stringify({ pump: 'flow' });

export const entry = {
    id: 'ui-exit-sentence',
    title: 'Exit chip / sentence',
    module: '../../src/components/ui-exit-sentence.js',
    notes:
        'Wave 4 #41, decision C8: the exit chip is ONLY a sentence and a remove ×. The reference skin '
        + 'built the decomposed comparator / − / value / + controls and hid four of the five '
        + 'with .pe-chip.has-summary, keeping them "in the DOM '
        + 'as a serialization/test seam" — documented intent, '
        + 'recorded as OQ-10, and the register accepted C8 against it: build the visible '
        + 'sentence and re-provide the seam as a plain function. That function is '
        + 'serializeExitSlots() in src/lib/exit-sentence.js, and there is nothing hidden in '
        + 'this shadow tree at all. Appendix 9 is carried: three stable slots — Condition, '
        + 'Volume, Weight — occupied first, add-slots below, so the band never reorders. '
        + 'B2: not one min/max/step is authored in either file; every bound is AUTHORING_RANGES '
        + 'through the profile_modes port, which unified three disagreeing copies '
        + 'The dead-exit warning is exit-validity.js, port-as-is, '
        + 'including its refusal to flag a 0.0 mL/s TARGET (a real zero-flow bloom).',
    states: [
        {
            id: 'threshold-and-volume',
            title: 'A threshold and a volume, at the reference skin\'s 346px',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'The oracle\'s first column. The sentence lands on 274 x 64 and the × on 64 x 64 '
                + 'with an 8px gap, all three derived from minmax(0,1fr) auto at a --ui-space-2 '
                + 'gap rather than declared. Subject and number take the channel tone — '
                + 'CITE editor-steps .pe-data-number [i=164] color = rgb(46, 194, 126) ← '
                + 'var(--slate-editor-pressure), which is #2ec27e, --ui-channel-pressure exactly. '
                + 'The Volume row has no channel and falls back to --ui-steel — CITE [i=170] '
                + 'color = rgb(176, 196, 206), the dark value of --ui-steel. The unoccupied '
                + 'Weight slot is the add slot at the bottom (Appendix 9).',
            html: `<ui-exit-sentence step='${PRESSURE_STEP}' index="0"></ui-exit-sentence>`,
        },
        {
            id: 'dead-exit',
            title: 'A provably unsatisfiable exit (O5)',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'CITE editor-steps .pe-chip-summary [i=193] text "Flowfalls below0.0 mL/s" — '
                + 'flow cannot fall below zero, so this exit can never end the step. The sentence '
                + 'takes an outline in --ui-tint-power and the note goes UNDER it as a sibling '
                + 'row, never as a child: "the chip is a fixed-height row in a grid, and a child '
                + 'that wraps to a second line tears the card\'s layout apart" '
                + '. CITE [i=198] .pe-exit-dead-note color = '
                + 'rgb(229, 165, 14) ← var(--slate-power) = --ui-tint-power, exact. THIS IS THE '
                + 'STATE THAT KILLS E16: the reference skin appends that note into a fixed 280px track with no '
                + 'overflow anywhere, so it spills into the rows above and below. Here the band '
                + 'is content-sized with a floor and a stated overflow, and the note wraps inside '
                + 'its own row. The note also names what WILL end the step, from the step\'s '
                + 'remaining exits rather than an assumed duration cap.',
            html: `<ui-exit-sentence step='${DEAD_FLOW_STEP}' index="2"></ui-exit-sentence>`,
        },
        {
            id: 'empty',
            title: 'Nothing set — three add slots',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'CITE find --cls pe-empty-slot -> 346 x 64 x3, text "+Weight"; transparent fill, '
                + '--ui-muted ink, and a dashed border at CITE border-top-color = color(srgb '
                + '0.321569 0.380392 0.419608 / 0.58) — rgb(82, 97, 107) at 58%, which is '
                + '--ui-line-strong mixed with transparent. The Condition slot opens #21 '
                + '(ui-menu) because its legal choices depend on the pump and on a capability '
                + 'bit; the two scalar slots seed directly. This step is a flow step, so the menu '
                + 'offers Pressure only — a step never exits on the channel it is controlling.',
            html: `<ui-exit-sentence step='${EMPTY_STEP}' index="0"></ui-exit-sentence>`,
        },
        {
            id: 'power-offered',
            title: 'Power offered (R3 capability bit set)',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'The same empty flow step with power-exit-offered set, so the Condition menu now '
                + 'offers Pressure and Power. The boolean arrives already decoded: the mask lives '
                + 'behind R3 (adapters-r.js:300, PROFILE_MODE_BIT.powerExit = 0x8) and '
                + 'capabilities-store.js:390 profileModes() is its one reader. A UI-OFFER HINT '
                + 'ONLY — the authority is ReaPrime\'s arm-time 400 (B9).',
            html: `<ui-exit-sentence step='${EMPTY_STEP}' index="0" power-exit-offered></ui-exit-sentence>`,
        },
        {
            id: 'all-three',
            title: 'All three slots occupied',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'A power exit plus volume plus weight — no add slots left, and still exactly '
                + 'three rows. The power sentence takes --ui-channel-power; volume and weight '
                + 'take --ui-steel. Note the band did not reorder: Appendix 9\'s slot order is '
                + 'Condition, Volume, Weight whether a slot is occupied or offered.',
            html: `<ui-exit-sentence step='${FULL_STEP}' index="1" power-exit-offered></ui-exit-sentence>`,
        },
        {
            id: 'narrow',
            title: 'In a 260px container — the sentence ellipsises',
            hostStyle: { 'inline-size': '260px' },
            notes:
                'The remove button keeps its 64px floor (ergonomics is physical — --ui-hit-min '
                + 'and --ui-control-h are the two tokens density never multiplies) and the '
                + 'sentence takes what is left, ellipsising subject and verb. The reference skin\'s summary '
                + 'does exactly this (overflow hidden + '
                + 'text-overflow ellipsis) — which is the half of E19 it got RIGHT; the rail '
                + 'labels one file over are the half it got wrong.',
            html: `<ui-exit-sentence step='${PRESSURE_STEP}' index="0"></ui-exit-sentence>`,
        },
        {
            id: 'wide',
            title: 'In a 560px container — the ratio, not the number',
            hostStyle: { 'inline-size': '560px' },
            notes:
                'The same band with 214px more to give. Nothing is 274px here: the sentence is '
                + '1fr, the × is its own floor, the gap is one token. The reference skin\'s 274 was frozen at '
                + '1920x1200 and the oracle says so in its own banner — "geometry is FROZEN, '
                + 'quote it as what the reference skin does, never as Decal\'s responsive target".',
            html: `<ui-exit-sentence step='${PRESSURE_STEP}' index="0"></ui-exit-sentence>`,
        },
        {
            id: 'disabled',
            title: 'Disabled',
            hostStyle: { 'inline-size': '346px' },
            notes:
                'One dial, --ui-opacity-disabled, from the base (CONVENTIONS §4). Every control '
                + 'refuses as well as dimming: the sentence, the ×, the add slots and the menu '
                + 'trigger all carry the native disabled attribute, because the host attribute '
                + 'dims and does not disable.',
            html: `<ui-exit-sentence step='${PRESSURE_STEP}' index="0" disabled></ui-exit-sentence>`,
        },
    ],
};
