/**
 * The gallery entry for.
 */

const LIVE = [
    { key: 'pressure', label: 'Pressure (bar)' },
    { key: 'targetPressure', label: 'Target Pressure', minor: true, dash: 'dash' },
    { key: 'flow', label: 'Flow (mL/s)' },
    { key: 'targetFlow', label: 'Target Flow', minor: true, dash: 'dashdot' },
    { key: 'weightFlow', label: 'GFlow (g/s)', minor: true },
];

const EXPANDED = [
    ...LIVE,
    { key: 'power', label: 'Power (W)' },
    { key: 'groupTemp', label: 'Group °C' },
    { key: 'mixTemp', label: 'Mix °C' },
    { key: 'targetTemp', label: 'Group Target °C', minor: true, dash: 'dash' },
    { key: 'targetMixTemp', label: 'Mix Target °C', minor: true, dash: 'dash' },
];

/** The attribute form, so a state stays a string of markup. Lit parses `items`
 * and `values` back out of the attribute itself (Array / Object converters). */
const json = (value) => JSON.stringify(value).replace(/'/g, '&#39;');

export const entry = {
    id: 'ui-chart-legend',
    title: 'Chart legend',
    module: './entries/ui-chart-legend.demo.js',
    notes:
        'Component #10, the key for a plot and a control in the same object (spec §5.1 '
        + '#10; slate-components.css:832-873). Each swatch is an SVG line carrying the '
        + 'series\' OWN stroke: --ui-chart-stroke for a measured channel, '
        + '--ui-chart-stroke-minor for a target or a derived one, and the plot\'s own '
        + 'dash table for the pattern - spec §6.2\'s fix for a swatch that draws 3px '
        + 'solid for every entry whatever it stands for. The ink is '
        + 'var(--ui-channel-<name>), the same custom property uPlot is handed for the '
        + 'trace (A6), so the key and the plot cannot drift apart. Tap a chip to hide '
        + 'that series, double tap to isolate it.',
    states: [
        {
            id: 'live-set',
            title: 'The Live channel set, all drawn',
            notes:
                'The five channels ui-chart-card draws by default, in its draw order: a '
                + 'measured channel then its target under it. Solid 3px against dashed '
                + '2px is the whole reason the key exists - it is how an actual is told '
                + 'from a target at arm\'s length.',
            html: `<ui-chart-legend label="Chart key" items='${json(LIVE)}'></ui-chart-legend>`,
        },
        {
            id: 'one-off',
            title: 'One series turned off',
            notes:
                'The exceptional state, and the only one that is painted: ground removed, '
                + 'ink to --ui-muted, swatch at .35 (slate-components.css:857-862 - "A '
                + 'hidden series stays readable - it is a control you can turn back on, '
                + 'not a thing that has gone away"). The border and the 44px box stay, so '
                + 'the row does not reflow when a chip goes off. NOT the four selection '
                + 'dials: every chip is pressed at rest, so painting the on state would '
                + 'make a resting legend a wall of selection.',
            html: `<ui-chart-legend label="Chart key" items='${json(
                LIVE.map((item, i) => (i === 2 ? { ...item, off: true } : item)),
            )}'></ui-chart-legend>`,
        },
        {
            id: 'isolated',
            title: 'One series isolated',
            notes:
                'What a double tap leaves behind, and the reason the gesture exists: the '
                + 'expanded charts overlay six lines in the 0-4 band and the only way to '
                + 'read one of them is to put the others away (uplot-legend.js:5-8). Four '
                + 'chips off, one on.',
            html: `<ui-chart-legend label="Chart key" items='${json(
                LIVE.map((item, i) => (i === 0 ? item : { ...item, off: true })),
            )}'></ui-chart-legend>`,
        },
        {
            id: 'with-readout',
            title: 'With a cursor readout',
            notes:
                'What the crosshair adds: the value each series had at the card\'s own '
                + 'cursor index (ui-chart-card.js:645). The strings arrive already '
                + 'formatted - this component owns no units, no precision and no locale - '
                + 'and are set in tabular figures so a value changing at 15Hz does not '
                + 'jitter the chip\'s width.',
            html: `<ui-chart-legend label="Chart key" items='${json(LIVE)}'
                values='${json({
        pressure: '8.6 bar',
        targetPressure: '9.0 bar',
        flow: '2.1 mL/s',
        targetFlow: '2.0 mL/s',
        weightFlow: '1.8 g/s',
    })}'></ui-chart-legend>`,
        },
        {
            id: 'expanded-set',
            title: 'Ten entries, the expanded page\'s own count',
            notes:
                'prov_query.py find --cls slate-chart-legend-item returns ten chips in '
                + 'each of the two captured states, which makes §6.1 rule 5\'s "up to six '
                + 'legend entries" an understatement. At this width they still fit one row.',
            html: `<ui-chart-legend label="Chart key" items='${json(EXPANDED)}'></ui-chart-legend>`,
        },
        {
            id: 'narrow-container',
            title: 'Ten entries in a 380px container',
            notes:
                'The same ten chips, same viewport, narrower host (spec §2.1 Rule 1). The '
                + 'row wraps rather than clipping or shrinking its words, and each new '
                + 'chip row costs 44px + an 8px gap - §6.1 rule 5\'s "another ~52px", '
                + 'except that here it is not silent: the legend is a plain block in the '
                + 'flow, so the chart card\'s ResizeObserver sees the plot box move.',
            hostStyle: { 'inline-size': '380px' },
            html: `<ui-chart-legend label="Chart key" items='${json(EXPANDED)}'></ui-chart-legend>`,
        },
        {
            id: 'in-the-cards-row',
            title: 'In the chart card\'s reserved row',
            notes:
                'The layout contract, assembled (bug chart-C10). The card reserves the '
                + 'legend\'s row whether or not it is filled, so no plot is ever measured '
                + 'against a box a legend is about to take - Slate inserts its 78px legend '
                + 'host as the plot\'s PRECEDING sibling after createPlot has measured '
                + '(chart-components.js:73-121). One chip row costs 52px here: 44 of chip '
                + 'plus the card\'s own 8px below it. The plot is empty because no shot '
                + 'has been handed to it; ui-chart-card\'s entry owns the picture with a '
                + 'recorded shot in it.',
            html: `<ui-chart-card label="Shot chart" style="display: block; block-size: 320px">
                    <ui-chart-legend slot="legend" label="Chart key" items='${json(LIVE.slice(0, 3))}'
                        ></ui-chart-legend>
                    <span slot="empty">No shot yet</span>
                </ui-chart-card>`,
        },
    ],
};

export default entry;
