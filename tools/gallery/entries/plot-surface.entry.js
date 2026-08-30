/**
 * plot-surface.entry.js — the gallery entry for gate 5's chart surface (wave 3).
 *
 * NOT A SHIPPING COMPONENT, like `base-fixture` above it in the registry: the subject is
 * `PlotSurfaceElement` through the Gate A fixture, because item #9 (chart card) was not
 * built. The reason the module is a `.demo.js` — the states are strings, the mount is
 * asynchronous, and the settle has to wait for the first draw — is in that file's header.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`plot-surface--<state>`): identifiers, not labels.
 *
 * The host style carries the BLOCK size, because uPlot sizes from `clientWidth` /
 * `clientHeight` and a surface in an auto-height stage would build at zero. The inline
 * size is the stage's, so `narrow-container` is the honest container demonstration:
 * the same element, the same viewport, a narrower host.
 */

/** The chart's own box. Block size only — the width is whatever the host gives it. */
const BOX = 'display:block; block-size:280px';

export const entry = {
    id: 'plot-surface',
    title: 'Chart surface (gate 5)',
    module: './entries/plot-surface.demo.js',
    notes:
        'Gate 5\'s uPlot surface with a deterministic fixture shot — 60 samples over 30 s, '
        + 'pressure ramping to 9 bar with flow under it. Item #9 (chart card) is not built, '
        + 'so this is the chart the battery can photograph: colours come from '
        + 'styles/chart-channels.css through the host, the axis face from the document.',
    states: [
        {
            id: 'fixture-shot',
            title: 'Fixture shot',
            notes:
                'The healthy mount: vendor sheet in adoptedStyleSheets, fonts ready before '
                + 'first paint, two channels resolved from --ui-channel-*.',
            html: `<plot-surface-demo id="chart" style="${BOX}"></plot-surface-demo>`,
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (380px)',
            notes:
                'The same shot in a 380px host at an unchanged viewport — the chart reads '
                + 'its own box, not the window.',
            hostStyle: { 'inline-size': '380px' },
            html: `<plot-surface-demo id="chart" style="${BOX}"></plot-surface-demo>`,
        },
        {
            id: 'rule-1-canary',
            title: 'Rule 1 canary (sheet declined)',
            notes:
                'The vendor stylesheet is NOT adopted — Part 8 §3 Rule 1 failing, mount C. '
                + 'This capture should be indistinguishable from fixture-shot, and that is '
                + 'the point: Gate B cannot see this defect, Gate A must.',
            html: `<plot-surface-demo-canary id="chart" style="${BOX}"></plot-surface-demo-canary>`,
        },
    ],
};
