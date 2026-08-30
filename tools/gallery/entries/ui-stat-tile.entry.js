/**
 * ui-stat-tile.entry.js - the gallery entry for component #33 (wave 2, item #33).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 2 runs twelve builders in parallel under
 * a whole-file-write rule, so twelve appends to one array clobber each other - which is
 * exactly what wave 1 hit (entries.js:30-45). Each builder owns one file here and the
 * wave's cross-cutting writer wires them into `entries.js` once, serially:
 *
 *     import { entry as uiStatTile } from './entries/ui-stat-tile.entry.js';
 *     export const entries = [ ...existing, uiStatTile ];
 *
 * The registry stays a hand-written array rather than a glob, so an unimported entry file
 * is a visible omission rather than a silent pickup. Order is SCOPE order.
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js does the
 * `import(entry.module)`, so the specifier resolves against gallery.js wherever the entry
 * object was authored. It points at ui-stat-tile.demo.js because one state needs a second
 * module loaded; the reason, and the hang it avoids, are in that file's header.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-stat-tile--<state>`): identifiers, not labels. A
 * rename is a re-baseline.
 *
 * WHY EVERY STATE SETS `container-type` IN `hostStyle`, AND WHY THAT IS THE SUBJECT
 * RATHER THAN BOILERPLATE. This is the one wave-2 component that OPTS OUT of the base's
 * `container-type: inline-size` (CONVENTIONS §2's one-line opt-out). It has to:
 * LAYOUT_SPEC_DRAFT.md:368 says of the fluid display scale that "cqi resolves against the
 * gauge cluster's own container", and seven tiles in a cluster are each ~1/7 of it, so a
 * per-tile container would resolve 4.2cqi against ~170px and pin every reading in the
 * skin at the clamp's 38px floor forever, with the clamp doing nothing at all. The
 * CONSUMER declares the container. `hostStyle` "sizes the CONTAINER, not the viewport"
 * (README), so stating it there is the honest demonstration of the contract rather than a
 * workaround for it: change the number and every reading in the state moves together.
 */

/* Slate's own cluster shape, quoted once and reused, so no state re-invents it:
 *     #main-page .slate-gauge-cluster { display: grid;
 *         grid-template-columns: 1.15fr repeat(6, minmax(0, 1fr)); column-gap: 24px; }
 * (slate-live.css:919-931, read READ-ONLY - grid placement is outside the corpus's
 * 18-property appearance surface, so the oracle says so and stops.)
 * Its `height: 84px; min-height: 84px` is DELIBERATELY NOT CARRIED: that pair is L2's
 * mechanism. 24px is --ui-space-5. */
const CLUSTER = 'display:grid; grid-template-columns:1.15fr repeat(6, minmax(0, 1fr));'
    + ' column-gap:var(--ui-space-5)';

/** A plain row of equal tiles - Part 5's "summary tile strip is a row of #33". */
const strip = (n) => `display:grid; grid-template-columns:repeat(${n}, minmax(0, 1fr));`
    + ' column-gap:var(--ui-space-5)';

export const entry = {
    id: 'ui-stat-tile',
    title: 'Stat tile / gauge',
    module: './entries/ui-stat-tile.demo.js',
    notes:
        'Component #33, the label-over-value readout on Live - "named as a missing '
        + 'primitive in DECISIONS.md:251". A two-row grid: a FIXED label track and a value '
        + 'track FLOORED at the display token the digits themselves read. That single '
        + 'shared token is bug L2 dead: Slate had a 44px value track against numbers at '
        + '45px and 52px, so the promoted digits ran out of the cluster and the plot '
        + 'canvas painted over them. Track and type cannot disagree here because they are '
        + 'one number. The tile declares no height, no min-height and no max-height, and '
        + 'is NOT its own container - the cluster is.',
    states: [
        {
            id: 'cluster-ready',
            title: 'The Live cluster at rest',
            notes:
                'Seven gauges in one container, Slate\'s own column shape (1.15fr + six '
                + 'equal tracks, 24px gutter) WITHOUT its height: 84px / min-height: 84px - '
                + 'that pair is L2. Time reads --ui-display-xl, the rest --ui-display-lg, '
                + 'and the three the machine is not reporting show the one absent mark, '
                + 'U+2014, which units.js calls NO_READING_MARK. Every label sits on one '
                + 'line whatever size the number under it is: that is the fixed label '
                + 'track, carried forward whole from LAYOUT_SPEC_DRAFT Appendix item 4.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1375px' },
            html:
                `<div style="${CLUSTER}">`
                + '<ui-stat-tile label="Time" value="24.6" unit="s" size="xl" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Pressure" value="9.0" unit="bar" reserve="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-pressure)"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s" reserve="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-flow)"></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="36.2" unit="g" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Group" unit="&deg;C"></ui-stat-tile>'
                + '<ui-stat-tile label="Steam" unit="&deg;C"></ui-stat-tile>'
                + '<ui-stat-tile label="Tank"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'cluster-pulling',
            title: 'The same cluster mid-shot',
            notes:
                'Appendix item 3, carried forward: "State changes weight, never position - '
                + '[data-live-state] recomposes WITHIN the existing tracks: nothing '
                + 'appears, disappears or slides mid-pull. This is why the screen is '
                + 'readable during a shot." The four that change fifteen times a second go '
                + 'to --ui-display-xl and the three that are not part of the pull recede to '
                + '--ui-display-sm. Compare this capture with cluster-ready: the four '
                + 'promoted tiles are the SAME BOX in both, because they carry reserve="xl" '
                + 'and the space was always there. Slate bought the same stillness with the '
                + 'fixed 84px cluster - which is what caused L2.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1375px' },
            html:
                `<div style="${CLUSTER}">`
                + '<ui-stat-tile label="Time" value="24.6" unit="s" size="xl" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Pressure" value="9.0" unit="bar" size="xl" reserve="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-pressure)"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s" size="xl" reserve="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-flow)"></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="36.2" unit="g" size="xl" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Group" value="92.4" unit="&deg;C" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Steam" value="154.0" unit="&deg;C" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Tank" value="1.8" unit="L" size="sm"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'l2-dead',
            title: 'Bug L2, dead - the promoted digits and the chart below them',
            notes:
                'L2: "The gauge cluster\'s value track is 44px against numbers at 45px and '
                + '52px. Measured #slate-live-time [488,248,69,52]; the cluster ends at 297, '
                + 'the chart begins at 298, so the promoted digits are clipped by the plot '
                + 'canvas." The block under the tiles is where the plot canvas starts. '
                + 'Nothing overhangs it, at any size the scale can produce, because the '
                + 'value track is a FLOOR set from the same token the digits read - '
                + 'minmax(var(--_ui-stat-value-reserve), 1fr) - and this component declares '
                + 'no height anywhere. Slate needed BOTH halves for the bug: a fixed box '
                + 'AND a clipping neighbour. Only the neighbour survives.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1375px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Pressure" value="9.0" unit="bar" size="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-pressure)"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s" size="xl"'
                + ' style="--_ui-stat-ink:var(--ui-channel-flow)"></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="36.2" unit="g" size="xl"></ui-stat-tile>'
                + '</div>'
                + '<div style="margin-block-start:var(--ui-space-2); block-size:200px;'
                + ' border-radius:var(--ui-radius-lg); background-color:var(--ui-chart-well);'
                + ' border:var(--ui-border-w) solid var(--ui-line)"></div>',
        },
        {
            id: 'reserve-holds-space',
            title: 'reserve="xl" - the same box at rest and promoted',
            notes:
                'Left pair: size="lg" reserve="xl" then size="xl" reserve="xl". Identical '
                + 'boxes, different digits - the promotion changes weight and nothing else '
                + 'moves. Right pair: the same two WITHOUT a reserve, where the tile grows '
                + 'with its reading because that is what a floor does. Reserving is opt-in, '
                + 'so a summary tile strip that never promotes reserves nothing.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Reserved, rest" value="9.0" unit="bar" size="lg" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Reserved, pulling" value="9.0" unit="bar" size="xl" reserve="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Plain, rest" value="9.0" unit="bar" size="lg"></ui-stat-tile>'
                + '<ui-stat-tile label="Plain, pulling" value="9.0" unit="bar" size="xl"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'display-steps',
            title: 'The five display steps',
            notes:
                'xs / sm / md / lg / xl, the whole fluid display scale and the only fluid '
                + 'type in the system: clamp(22px, 2.2cqi, 27px) through '
                + 'clamp(38px, 4.2cqi, 52px) (LAYOUT_SPEC_DRAFT.md:361-365). The upper '
                + 'bounds are Slate\'s current values; the lower bounds are the spec\'s '
                + 'proposals and want a look on the bench. The label track does not change '
                + 'with the step - that is the point of a fixed label track.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(5)}">`
                + '<ui-stat-tile label="xs" value="24.6" unit="s" size="xs"></ui-stat-tile>'
                + '<ui-stat-tile label="sm" value="24.6" unit="s" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="md" value="24.6" unit="s" size="md"></ui-stat-tile>'
                + '<ui-stat-tile label="lg" value="24.6" unit="s" size="lg"></ui-stat-tile>'
                + '<ui-stat-tile label="xl" value="24.6" unit="s" size="xl"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'absent-reading',
            title: 'No reading, and the difference between absent and zero',
            notes:
                'reading.js:12-15: "A missing channel renders as a gap or a dash, never as '
                + '... a zero that reads as a measurement." So null, undefined and the empty '
                + 'string are ABSENT and draw U+2014; 0 is a READING and draws 0. The dash '
                + 'is a glyph standing for a sentence, so it goes aria-hidden and "no '
                + 'reading" is exposed as visually hidden text instead - a sighted user sees '
                + 'FLOW followed by a dash, a screen-reader user hears the sentence rather '
                + 'than "FLOW" alone. The mark is the same one units.js exports; it arrives '
                + 'as a property, because a wave-2 component may not import from src/stores/.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Ratio"></ui-stat-tile>'
                + '<ui-stat-tile label="Group" unit="&deg;C"></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="0" unit="g"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="0.0" unit="ml/s"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'channel-tints',
            title: 'Channel tints - and no channel table in the component',
            notes:
                'Slate hard-codes seven per-gauge tint rules (.slate-gauge-pressure strong > '
                + 'span and six siblings). The sixteen channel colours live in '
                + 'styles/chart-channels.css and the map from a tile to a channel belongs to '
                + 'the CLUSTER, so the ink arrives from outside as --_ui-stat-ink. A '
                + 'component carrying that list would have to be edited to add a channel, '
                + 'and a lookup table inside a primitive is the shape the wave law blocks '
                + 'for the stepper\'s limits. The UNIT is never tinted: it is the label\'s '
                + 'register, not the reading\'s.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Pressure" value="9.0" unit="bar"'
                + ' style="--_ui-stat-ink:var(--ui-channel-pressure)"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s"'
                + ' style="--_ui-stat-ink:var(--ui-channel-flow)"></ui-stat-tile>'
                + '<ui-stat-tile label="Group" value="92.4" unit="&deg;C"'
                + ' style="--_ui-stat-ink:var(--ui-channel-group-temperature)"></ui-stat-tile>'
                + '<ui-stat-tile label="Power" value="1420" unit="W"'
                + ' style="--_ui-stat-ink:var(--ui-channel-power)"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'slotted-action',
            title: 'An action in the value slot, not a private pill',
            notes:
                'Slate paints a button inside the gauge - .slate-gauge strong > '
                + 'span.slate-gauge-action, a hairline pill with its own ink and an '
                + '!important colour, "so it stops reading as a weight and starts reading as '
                + 'a button" (slate-live.css:983-996). It IS a button, so here it is #1 '
                + 'ui-button slotted in: the slotted control REPLACES the reading rather '
                + 'than sitting beside it, this component paints nothing on it, and it '
                + 'brings its own hit floor and the one focus ring. A private button '
                + 'treatment inside a readout is the founding defect in a different family.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Weight"><ui-button slot="value">Retry</ui-button></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="36.2" unit="g"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>'
                + '<ui-stat-tile label="Time" value="24.6" unit="s"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'long-label',
            title: 'A label longer than its column',
            notes:
                'The LABEL ellipsises - Slate states white-space: nowrap with no overflow at '
                + 'all, so a long cap in a narrow gauge spills sideways into its neighbour '
                + '(bug E19\'s class). The READING never ellipsises and never wraps: a '
                + 'clipped number is a WRONG number. What absorbs a narrow container is the '
                + 'fluid type, not a clip. The oracle is disqualified for both halves in any '
                + 'case - what a box does below 1920 is responsive behaviour, and Slate has '
                + 'no answer, so LAYOUT_SPEC_DRAFT.md governs.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '760px' },
            html:
                `<div style="${strip(3)}">`
                + '<ui-stat-tile label="Peak flow after first drop" value="3.4" unit="ml/s"></ui-stat-tile>'
                + '<ui-stat-tile label="Preinfusion resistance" value="4.1"></ui-stat-tile>'
                + '<ui-stat-tile label="Time" value="24.6" unit="s"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'The same cluster in a 620px container',
            notes:
                'Nothing about the tile changed; the CONTAINER did. The digits are fluid '
                + 'against it (cqi), so they shrink together and floor at the clamp\'s lower '
                + 'bound - 34px for lg, 38px for xl - rather than being clipped or '
                + 'ellipsised. Shot beside cluster-ready this is the whole container-query '
                + 'contract: the tile reads its own container, never the viewport, so this '
                + 'capture is identical at 1281x801 and at the 1000x600 floor.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '620px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>'
                + '<ui-stat-tile label="Pressure" value="9.0" unit="bar"></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>'
                + '<ui-stat-tile label="Weight" value="36.2" unit="g"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'summary-strip',
            title: 'Part 5\'s summary tile strip',
            notes:
                'Row #33\'s own note: "Part 5\'s summary tile strip is a row of #33, not a '
                + 'separate component." Same element, one step down the display scale, no '
                + 'reserve because nothing here is ever promoted, and the units carry the '
                + 'meaning. Nothing was added to the component to make this exist.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1018px' },
            html:
                `<div style="${strip(5)}">`
                + '<ui-stat-tile label="Dose" value="18.0" unit="g" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Yield" value="36.2" unit="g" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Ratio" value="1:2.0" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Time" value="24.6" unit="s" size="sm"></ui-stat-tile>'
                + '<ui-stat-tile label="Peak" value="9.0" unit="bar" size="sm"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'selection-inexpressible',
            title: 'Every selection spelling, painting nothing',
            notes:
                'THE WAVE LAW, in its negative form. Left to right: aria-pressed, '
                + 'aria-selected, aria-checked, aria-current, class="is-selected", the '
                + '[selected] host attribute, and a plain tile. Seven identical captures. A '
                + 'readout has no selected state, so it paints none - selectionSurface is '
                + 'deliberately not imported, this component draws no ground of its own, and '
                + 'retargeting all four dials at once moves nothing in it. The four dials '
                + 'mean something only because there is ONE selection component; a tile that '
                + 'grew a private highlight would be the fourteenth implementation the '
                + 'rewrite exists to prevent.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(7)}">`
                + '<ui-stat-tile label="pressed" value="2.1" aria-pressed="true"></ui-stat-tile>'
                + '<ui-stat-tile label="selected" value="2.1" aria-selected="true"></ui-stat-tile>'
                + '<ui-stat-tile label="checked" value="2.1" aria-checked="true"></ui-stat-tile>'
                + '<ui-stat-tile label="current" value="2.1" aria-current="true"></ui-stat-tile>'
                + '<ui-stat-tile label="is-selected" value="2.1" class="is-selected"></ui-stat-tile>'
                + '<ui-stat-tile label="[selected]" value="2.1" selected></ui-stat-tile>'
                + '<ui-stat-tile label="plain" value="2.1"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'focus-in-a-band',
            title: 'Made focusable inside a clipping band',
            notes:
                'The tile takes no focus of its own. When a consumer gives it one - a '
                + 'wave-4 screen with a roving tabindex over a stat strip - it gets THE ring '
                + 'from --ui-focus-*, and focus-ring="inset" keeps it unclipped inside an '
                + 'overflow:hidden parent. Bug L24 is "focus rings clipped on all four sides '
                + 'by the components they sit inside"; this component supplies no clipping '
                + 'surface of its own, so the only one in the picture is the band.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '760px' },
            html:
                '<div style="overflow:hidden; padding:var(--ui-space-2);'
                + ` ${strip(3)}">`
                + '<ui-stat-tile tabindex="0" focus-ring="inset" label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>'
                + '<ui-stat-tile tabindex="0" focus-ring="inset" label="Pressure" value="9.0" unit="bar"></ui-stat-tile>'
                + '<ui-stat-tile tabindex="0" focus-ring="inset" label="Time" value="24.6" unit="s"></ui-stat-tile>'
                + '</div>',
        },
        {
            id: 'disabled',
            title: 'Dimmed by the one disabled dial',
            notes:
                'Paint only, from the base: --ui-opacity-disabled (.38), settling Slate\'s '
                + 'three live values. A readout accepts no input in either state - the host '
                + 'attribute dims, it does not disable. Slate\'s own version of this is the '
                + 'gauge that is not reporting, which it paints by swapping the ink to '
                + '--slate-muted and the size down a step; both are the consumer\'s call '
                + 'here, and the absent-reading state above shows the other spelling.',
            hostStyle: { 'container-type': 'inline-size', 'inline-size': '1120px' },
            html:
                `<div style="${strip(4)}">`
                + '<ui-stat-tile label="Group" value="92.4" unit="&deg;C" disabled></ui-stat-tile>'
                + '<ui-stat-tile label="Steam" value="154.0" unit="&deg;C" disabled></ui-stat-tile>'
                + '<ui-stat-tile label="Tank" value="1.8" unit="L" disabled></ui-stat-tile>'
                + '<ui-stat-tile label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>'
                + '</div>',
        },
    ],
};

export default entry;
