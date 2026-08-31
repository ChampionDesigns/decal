/**
 * The gallery entry for.
 */

const CELL = 'padding: var(--ui-space-4); color: var(--ui-text); font-size: var(--ui-text-base)';
const LABEL = 'color: var(--ui-muted); font-size: var(--ui-text-2xs); padding-block-end: var(--ui-space-2)';

const row = (label, value) =>
    '<div class="seam-cell" style="display: flex; align-items: center;'
    + ' justify-content: space-between; block-size: 63px;'
    + ' padding-inline: var(--ui-space-4); color: var(--ui-text);'
    + ' font-size: var(--ui-text-base)">'
    + `<span>${label}</span>`
    + `<span style="color: var(--ui-text-2)">${value}</span>`
    + '</div>';

/** One step column in the editor matrix. */
const stepCell = (text) =>
    '<div class="seam-cell" style="display: grid; place-items: center; block-size: 72px;'
    + ` color: var(--ui-text-2); font-size: var(--ui-text-base)">${text}</div>`;

export const entry = {
    id: 'seams',
    title: 'Hairline / seam',
    module: './entries/seams.demo.js',
    notes:
        'Component #14, and NOT an element: a 1px grid gap over a coloured grid '
        + 'background (spec §2.2), shipped as the shared css fragment '
        + 'src/components/seams.js and documented in CONVENTIONS §13. Classes: '
        + '.seam-grid (+ .seam-cols / .seam-rows for one axis), three weights '
        + '.seam-zone / .seam-line / .seam-strong - two of them Appendix 2\'s '
        + '(--slate-zone-seam, --slate-line) and .seam-strong NOT, which is measured '
        + '(the Live rail edge) and written into the spec\'s own Live skeleton at '
        + 'the Live skeleton - and .seam-cell for a plain '
        + 'cell that is not a component. Each rule ships a second time as :host(...) '
        + 'for the screen component that IS the grid. The reference skin already contains the '
        + 'pattern twice - '
        + 'the Live rail edge (gap 1px over --slate-line-strong) and the editor matrix '
        + '(gap 0px 1px over --slate-line) - and spells every other divider as a '
        + 'border: 55 .slate-hairline uses in settings.js, 43 of them a standalone '
        + '<hr class="border-t slate-hairline w-full">, 5 a content row with border-t, '
        + 'and 7 an enclosure round a box (which stays a border).',
    states: [
        {
            id: 'zone-split',
            title: 'A nav/pane split — one seam, not two hairlines',
            notes:
                'Bug T19: "The nav/pane seam is TWO hairlines of two different greys, '
                + 'which is why the nav container measures 599 rather than 600." Here the '
                + 'seam comes out of the grid: 260 + 1 + 339 = 600 exactly, one ink, drawn '
                + 'once by the container. Spec §4.4 accepts in advance that the divider '
                + 'WILL look different, and register decision C5 (ACCEPTED) settles it '
                + 'that way: "one 1px grid gap, var(--ui-seam), replacing today\'s 2px '
                + 'band of two different greys (T19)". OQ-6 is C5\'s old '
                + 'number and is NOT open; what is outstanding is C5\'s '
                + 'residual - confirmation of the LOOK on the C1 prototype, collected as '
                + 'Q3. This state is what he would be looking at.',
            html:
                '<div class="seam-grid" style="inline-size: 600px; block-size: 240px;'
                + ' grid-template-columns: 260px minmax(0, 1fr)">'
                + `<div class="seam-cell" style="${CELL}">Categories</div>`
                + `<div class="seam-cell" style="${CELL}">Machine</div>`
                + '</div>',
        },
        {
            id: 'settings-rows',
            title: 'The 43 <hr> elements, deleted',
            notes:
                'The old sheet has 55 uses of it, and they are NOT all '
                + 'one shape: 43 are <hr class="border-t slate-hairline w-full"> - elements '
                + 'in the DOM whose entire job is to be a line - and 12 are <div>, of which '
                + '5 are content rows carrying border-t/border-b and 7 are ENCLOSURES '
                + '(rounded-[10px] border slate-hairline p-4). The gap replaces the first '
                + '48; the 7 enclosures are a border round a box and stay one, per '
                + 'CONVENTIONS §13 "What this is not". Five rows here draw four seams with '
                + 'no elements and no sibling selector, which is also bug T2 retired ("the '
                + '> * + * half of the rule can never match ... The sub-nav has NO row '
                + 'separators at all"). Row height 63px and the text are the oracle\'s own: '
                + 'settings-machine-machine-info [i=52..64], 1150 x 63 - themselves five of '
                + 'the 12 divs, not <hr>s.',
            hostStyle: { 'inline-size': '640px' },
            html:
                '<div class="seam-grid seam-rows seam-line" style="inline-size: 100%">'
                + row('Firmware version', '282')
                + row('Serial number', '888888')
                + row('Group head controller', 'Enabled')
                + row('Refill Kit', 'Enabled')
                + row('Voltage', '245 V')
                + '</div>',
        },
        {
            id: 'editor-columns',
            title: 'Column gap as the only vertical rule',
            notes:
                'Spec Appendix 8, carried over as an idea worth keeping: "Column gap as '
                + 'the only vertical rule, over a coloured grid background '
                + '". CITE editor-steps .pe-grid [i=17] '
                + 'gap = 0px 1px, background-color rgb(58, 72, 82) dark / '
                + 'rgb(203, 208, 211) light -> --ui-line. .seam-cols is that shape: the '
                + 'columns are ruled and the rows genuinely touch.',
            html:
                '<div class="seam-grid seam-cols seam-line" style="inline-size: 600px;'
                + ' grid-template-columns: repeat(3, 1fr)">'
                + stepCell('01 Flow') + stepCell('02 Flow') + stepCell('03 Pressure')
                + stepCell('9.0 bar') + stepCell('2.0 ml/s') + stepCell('93 °C')
                + '</div>',
        },
        {
            id: 'three-weights',
            title: 'Three weights, three tokens',
            notes:
                'THREE WEIGHTS, BUT NOT APPENDIX 2\'S THREE. Appendix 2, verbatim: '
                + '"Seams, edges and zone grounds are three different weights - '
                + '--slate-seam divides a box, --slate-line encloses one, '
                + '--slate-zone-seam is the ground between zones." Two of those are '
                + 'here: --ui-zone-seam and --ui-line, which carry the same value in '
                + 'both themes today, so the top two read identically and a fork can '
                + 'move them apart. The THIRD IS NOT: Appendix 2\'s --slate-seam is an '
                + 'inset shadow between the segments of ONE control (component #3 '
                + 'ui-bank), which this utility refuses. In its place, --ui-line-strong '
                + '- the emphasised divider the reference skin uses for the rail edge, the header '
                + 'underline and the band top, "the three lines that close a box" - on '
                + 'the authority of the oracle (CITE live-ready .flex-grow [i=16] '
                + 'background-color = rgb(82, 97, 107) / rgb(170, 178, 183)) and of the '
                + 'spec\'s Live skeleton, not of the '
                + 'appendix.',
            html:
                '<div style="display: grid; gap: var(--ui-space-6); inline-size: 520px">'
                + `<div><div style="${LABEL}">.seam-zone — --ui-zone-seam</div>`
                + '<div class="seam-grid seam-zone" style="block-size: 84px;'
                + ' grid-template-columns: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">zone</div>`
                + `<div class="seam-cell" style="${CELL}">zone</div></div></div>`
                + `<div><div style="${LABEL}">.seam-line — --ui-line</div>`
                + '<div class="seam-grid seam-line" style="block-size: 84px;'
                + ' grid-template-columns: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">control</div>`
                + `<div class="seam-cell" style="${CELL}">control</div></div></div>`
                + `<div><div style="${LABEL}">.seam-strong — --ui-line-strong</div>`
                + '<div class="seam-grid seam-strong" style="block-size: 84px;'
                + ' grid-template-columns: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">band</div>`
                + `<div class="seam-cell" style="${CELL}">band</div></div></div>`
                + '</div>',
        },
        {
            id: 'rail-edge',
            title: 'The Live rail edge, as the reference skin draws it',
            notes:
                'CITE live-ready .flex-grow [i=16] gap = 1px '
                + '`#main-page > .flex-grow.flex` authored `1px` (FROZEN/hardcoded); '
                + 'background-color rgb(82, 97, 107) dark / rgb(170, 178, 183) light -> '
                + '--ui-line-strong. The reference skin\'s own comment: "THE RAIL\'S RIGHT EDGE: a 1px '
                + 'grid gap with the enclosing grade showing through it, full height, from '
                + 'the header\'s underline to the foot of the screen." The rail width here '
                + 'is --ui-rail-w, so the seam moves with the clamp rather than with three '
                + 'copies of 430px (bug BUG-11).',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<div class="seam-grid seam-strong" style="inline-size: 100%;'
                + ' block-size: 260px; grid-template-columns: var(--ui-rail-w) minmax(0, 1fr)">'
                + `<div class="seam-cell" style="${CELL}">rail</div>`
                + `<div class="seam-cell" style="${CELL}">chart zone</div>`
                + '</div>',
        },
        {
            id: 'traps',
            title: 'The two traps, on screen',
            notes:
                'LEFT: a seamed grid whose cells paint nothing is a slab of ground, not a '
                + 'seam - the ground shows through everything that is not covered. Cells '
                + 'that are components paint themselves inside their shadow root; plain '
                + 'cells take .seam-cell. RIGHT: a nested seam grid is also a cell, so it '
                + 'names its own weight - a weight class is (0,2,0) and .seam-cell (0,1,0), '
                + 'so the nested grid can never be silently repainted as a cell.',
            html:
                '<div style="display: grid; gap: var(--ui-space-7);'
                + ' grid-template-columns: repeat(2, 300px)">'
                + `<div><div style="${LABEL}">unpainted cells — a slab</div>`
                + '<div class="seam-grid" style="block-size: 140px;'
                + ' grid-template-columns: 1fr 1fr"><div></div><div></div></div></div>'
                + `<div><div style="${LABEL}">nested grid, own weight</div>`
                + '<div class="seam-grid seam-strong" style="block-size: 140px;'
                + ' grid-template-columns: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">pane</div>`
                + '<div class="seam-grid seam-line seam-cell" style="grid-template-rows: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">a</div>`
                + `<div class="seam-cell" style="${CELL}">b</div>`
                + '</div></div></div>'
                + '</div>',
        },
        {
            id: 'not-a-seam',
            title: 'What this utility is NOT',
            notes:
                'Three of the eight .slate-hairline elements in the corpus are '
                + '<div class="rounded-[10px] border slate-hairline"> - a hairline that '
                + 'ENCLOSES a box, not one that divides two. That case is --ui-border-w '
                + '(spec §3.6, itself var(--ui-hairline)) with --ui-line, declared by '
                + 'whichever component draws the box - #8 Card, #9 Chart card. A gap draws '
                + 'lines BETWEEN cells and never around the outside, which is exactly why '
                + 'the two cases must not share one class.',
            html:
                '<div style="display: grid; gap: var(--ui-space-7);'
                + ' grid-template-columns: repeat(2, 300px)">'
                + `<div><div style="${LABEL}">enclosure — a border, not this utility</div>`
                + '<div style="border: var(--ui-border-w) solid var(--ui-line);'
                + ' border-radius: var(--ui-radius-lg); background-color: var(--ui-surface);'
                + ` ${CELL}">Version 1.0.0-bengle.1</div></div>`
                + `<div><div style="${LABEL}">division — the seam</div>`
                + '<div class="seam-grid seam-line" style="grid-template-columns: 1fr 1fr">'
                + `<div class="seam-cell" style="${CELL}">left</div>`
                + `<div class="seam-cell" style="${CELL}">right</div>`
                + '</div></div>'
                + '</div>',
        },
    ],
};

export default entry;
