/**
 * The gallery entry for the chart card. Its states are a recorded shot, the same shot with
 * a legend row beneath it, the card in a narrow host, and the state before any shot has
 * arrived. The loader it names registers the card and everything the plot inside it needs.
 */

/** The card's own box. Block size only — the width is whatever the host gives it. */
const BOX = 'display:block; block-size:300px';

export const entry = {
    id: 'ui-chart-card',
    title: 'Chart card',
    module: './entries/ui-chart-card.demo.js',
    notes:
        'Item #9, on gate 5\'s uPlot mount and fed only by gate 6\'s derivation — a real '
        + 'recorded bench shot (426 measurements, 336 in-shot samples, 22.3 s, two profile '
        + 'steps). Colours come from styles/chart-channels.css through the host (A6), the '
        + 'axis face from the document registry (Rule 2), and the card\'s background reads '
        + '--ui-chart-well WITH a fallback (bug O3). The shot is scale-less, like every '
        + 'bench recording, so the weight-flow channel is empty on purpose.',
    states: [
        {
            id: 'recorded-shot',
            title: 'Recorded shot',
            notes:
                'The default Live channel set in draw order: pressure and its target, flow '
                + 'and its target, weight flow. Step boundaries are drawn as vertical rules '
                + 'with their profile step names, from the derivation\'s own stepMarks.',
            html: `<ui-chart-card-shot id="chart" label="Shot chart" style="${BOX}"></ui-chart-card-shot>`,
        },
        {
            id: 'with-legend',
            title: 'With a legend row',
            notes:
                'Bug chart-C10: the legend is a ROW IN THE CARD\'S GRID, laid out before the '
                + 'plot is built — not a 78px sibling inserted after createPlot has measured '
                + 'the host. The stand-in is plain markup; the legend component is #10.',
            html: `<ui-chart-card-shot id="chart" label="Shot chart" style="${BOX}">`
                + '<div slot="legend" '
                + 'style="display:flex; align-items:center; gap:var(--ui-space-3); '
                + 'block-size:var(--ui-legend-chip-h)">'
                + 'Pressure · Target pressure · Flow · Target flow · Weight flow'
                + '</div></ui-chart-card-shot>',
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (380px)',
            notes:
                'The same shot in a 380px host at an unchanged viewport. The tick ladder is '
                + 'chosen from --ui-chart-tick-gap against the plot\'s own width, so a narrow '
                + 'card gets fewer time labels rather than crowded ones.',
            hostStyle: { 'inline-size': '380px' },
            html: `<ui-chart-card-shot id="chart" label="Shot chart" style="${BOX}"></ui-chart-card-shot>`,
        },
        {
            id: 'no-shot',
            title: 'No shot yet',
            notes:
                'The plain shipping tag with no derivation: the card keeps its frame and its '
                + 'axes and shows the slotted refusal over them. A chart that vanished would '
                + 'read as a broken chart, which is what gate 6\'s `reason` exists to avoid.',
            html: `<ui-chart-card id="chart" label="Shot chart" style="${BOX}">`
                + '<span slot="empty">No shot yet</span>'
                + '</ui-chart-card>',
        },
    ],
};
