/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-stepper',
    title: 'Stepper',
    module: '../../src/components/ui-stepper.js',
    notes:
        'Item #4, the skin\'s most-used compound (112 uses). One continuous instrument: '
        + 'seams, not gaps. Two register decisions live here — C3 (the editor\'s private '
        + '64px caps become a NAMED compact density) and B2 (ranges arrive as data; the '
        + 'component never owns limits, so with no min or max stated it is unbounded).',
    states: [
        {
            id: 'resting',
            title: 'Resting — the oracle box',
            notes:
                '268 × 64 with 78px caps and a 110px value cell, which is what '
                + 'prov_query.py find --cls slate-stepper measures in all 85 elements '
                + 'across 16 states. No limits stated, so neither cap is at an end.',
            hostStyle: { 'inline-size': '268px' },
            html: '<ui-stepper label="Grind" value="93"></ui-stepper>',
        },
        {
            id: 'with-unit',
            title: 'The unit lockup',
            notes:
                'One line box, the height of the cell: the unit sits after the number on '
                + 'its own baseline and the pair centres vertically, because the line box '
                + 'IS the cell. Muted, at --ui-text-2xs (14px — the oracle\'s number).',
            hostStyle: { 'inline-size': '268px' },
            html: '<ui-stepper label="Steam temperature" unit="°C" value="155" min="135" max="165"></ui-stepper>',
        },
        {
            id: 'range-end',
            title: 'At a range end',
            notes:
                'B2: the limits are DATA (min/max attributes here; machine-limits.js and '
                + 'then ReaPrime\'s served ranges later). At the end the cap stops looking '
                + 'live — one dial, --ui-opacity-disabled — and stays in the tab order so a '
                + 'keyboard user can find out why it does nothing. The reference skin leaves steam '
                + 'pinned at 170/170 with a fully lit +.',
            hostStyle: { 'inline-size': '268px' },
            html: '<ui-stepper label="Steam temperature" unit="°C" value="165" min="135" max="165"></ui-stepper>',
        },
        {
            id: 'editable',
            title: 'Editable value cell',
            notes:
                'Bug L22\'s value-cell half: the reference skin\'s rail cells are tabindex="-1" — in the '
                + 'markup, out of the tab order. Here an editable cell is a real button at '
                + '110 × 62, it announces its own value, and it reports the press rather '
                + 'than opening anything itself (the numpad is #53).',
            hostStyle: { 'inline-size': '268px' },
            html: '<ui-stepper editable label="Dose" unit="g" value="17" min="5" max="30" step="0.1"></ui-stepper>',
        },
        {
            id: 'compact-matrix',
            title: 'C3 — the compact density, five steps wide',
            notes:
                'The editor\'s step matrix. OQ-4: 78px caps cost 28px per step against 64, '
                + 'which is real money at five steps — 140px. So the 64 becomes a NAMED '
                + 'density of this one component (64px is --ui-control-h, a square cap) '
                + 'rather than a second implementation that never reads the token. The '
                + 'value cell keeps its measured 110 in every column.',
            hostStyle: { 'inline-size': '1240px' },
            html: `
                <style>
                  .matrix { display: flex; gap: var(--ui-seam); }
                </style>
                <div class="matrix">
                  <ui-stepper density="compact" label="Step 1 pressure" unit="bar" value="9" min="0" max="12" step="0.1"></ui-stepper>
                  <ui-stepper density="compact" label="Step 2 pressure" unit="bar" value="6" min="0" max="12" step="0.1"></ui-stepper>
                  <ui-stepper density="compact" label="Step 3 pressure" unit="bar" value="4" min="0" max="12" step="0.1"></ui-stepper>
                  <ui-stepper density="compact" label="Step 4 flow" unit="mL/s" value="2.1" min="0" max="8" step="0.1"></ui-stepper>
                  <ui-stepper density="compact" label="Step 5 flow" unit="mL/s" value="1.4" min="0" max="8" step="0.1"></ui-stepper>
                </div>`,
        },
        {
            id: 'density-pair',
            title: 'Regular against compact',
            notes:
                'The same component, two named states: 268 and 240. Nothing but the cap '
                + 'moves — the row height is --ui-control-h in both, because density '
                + 'multiplies vertical rhythm and never the ergonomics.',
            hostStyle: { 'inline-size': '300px' },
            html: `
                <style>
                  .pair { display: grid; gap: var(--ui-space-4); justify-items: start; }
                </style>
                <div class="pair">
                  <ui-stepper label="Regular" unit="°C" value="93"></ui-stepper>
                  <ui-stepper density="compact" label="Compact" unit="°C" value="93"></ui-stepper>
                </div>`,
        },
        {
            id: 'settings-column',
            title: 'A settings column',
            notes:
                'Where the reference skin renders eight of these in a row at [1561, y, 268, 64]. Every '
                + 'field states its own range; nothing in the component knows what any of '
                + 'them measures.',
            hostStyle: { 'inline-size': '420px' },
            html: `
                <style>
                  .col { display: grid; gap: var(--ui-space-4); justify-items: end; }
                  .col ui-stepper { inline-size: 268px; }
                </style>
                <div class="col">
                  <ui-stepper label="Steam temperature" unit="°C" value="155" min="135" max="165"></ui-stepper>
                  <ui-stepper label="Hot water volume" unit="mL" value="240" min="0" max="255" step="5"></ui-stepper>
                  <ui-stepper label="Flush temperature" unit="°C" value="98" min="80" max="105"></ui-stepper>
                  <ui-stepper label="Fan threshold" unit="°C" value="40" min="0" max="50"></ui-stepper>
                </div>`,
        },
        {
            id: 'wide-container',
            title: 'A wider container',
            notes:
                'The container speaking, not the viewport. The caps stay at the token and '
                + 'the value cell takes the slack — 420 − 2 − 78 − 78 = 262.',
            hostStyle: { 'inline-size': '420px' },
            html: '<ui-stepper label="Target weight" unit="g" value="40" min="10" max="80" step="0.5"></ui-stepper>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes:
                'One dial, painted once. The host takes --ui-opacity-disabled; the three '
                + 'controls carry the native attribute for behaviour and opt out of the '
                + 'paint, or the two would compound to .14.',
            hostStyle: { 'inline-size': '268px' },
            html: '<ui-stepper disabled label="Grind" value="93" min="0" max="200"></ui-stepper>',
        },
        {
            id: 'no-selection',
            title: 'The four dials reach nothing here',
            notes:
                'The wave law, photographed. All four selection dials are retargeted to '
                + 'something unmissable on this stage; a stepper has no selected state, so '
                + 'nothing in it may move. If any part of this control is pink, a seventh '
                + 'selected treatment has started.',
            hostStyle: {
                'inline-size': '268px',
                '--ui-selected-face': 'rgb(255, 0, 170)',
                '--ui-selected-ink': 'rgb(0, 255, 0)',
                '--ui-selected-led': '6px',
                '--ui-selected-glow': '60%',
            },
            html: '<ui-stepper editable label="Grind" unit="°C" value="93" min="0" max="200"></ui-stepper>',
        },
    ],
};

export default entry;
