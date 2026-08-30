/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-tab-bar',
    title: 'Tab bar / tablist',
    module: '../../src/components/ui-tab-bar.js',
    notes:
        'Item #32. A tablist is Wave 2\'s segmented bank (#3) in its `tablist` aria '
        + 'spelling, at --ui-control-lg, taking its own width — plus the half a bank '
        + 'cannot carry: the panels. Roving tabindex, arrows, Home/End and the four '
        + 'selection dials all come from #3 unchanged (Appendix 10, Appendix 15); what '
        + 'this component adds is role=tabpanel, the panel\'s name, and a hidden panel '
        + 'that is genuinely out of the tab order (bug L23, and P13\'s mechanism).',
    states: [
        {
            id: 'editor-tabs',
            title: 'The editor\'s three tabs, at their own width',
            notes:
                'ORACLE editor-steps <nav class="slate-bank slate-editor-tabs" '
                + 'role="tablist"> [i=7] rect 430x82 with #editor-tab-0 [i=8] 143x80 — the '
                + 'implementation Appendix 10 keeps verbatim. The 82 is --ui-control-lg '
                + '(styles/tokens.css:65-69 cites this very element); the width is '
                + 'fit-content, so the stage is 900px wide and the tablist is not. Slate\'s '
                + 'rect is a frozen 1920x1200 capture, quoted as what Slate does, never as '
                + 'a responsive target.',
            hostStyle: { 'inline-size': '900px' },
            html: `<ui-tab-bar label="Profile editor" value="Steps"
                tabs='["Steps","Settings","Review"]'></ui-tab-bar>`,
        },
        {
            id: 'header-track',
            title: 'Appendix 7 — a three-column header with an auto centre track',
            notes:
                '"centre track = the tablist\'s own width; flanks overflow, never shove" '
                + '(spec §4.3). The tab bar contributes its intrinsic width to the auto '
                + 'track and the two 1fr flanks absorb everything else — the same '
                + 'arrangement that bug H3 gets backwards on History, where 720px of tab '
                + 'bank is pinned flex: 0 0 and the pickers collapse first.',
            hostStyle: { 'inline-size': '1100px' },
            html: `
                <style>
                  .hdr { display: grid; align-items: center; gap: var(--ui-space-4);
                         grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
                  .flank { min-inline-size: 0; overflow: hidden; white-space: nowrap;
                           text-overflow: ellipsis; }
                  .flank-end { text-align: end; }
                </style>
                <div class="hdr">
                  <span class="flank">Londinium — a long profile name that must ellipsise</span>
                  <ui-tab-bar label="Profile editor" value="Settings"
                    tabs='["Steps","Settings","Review"]'></ui-tab-bar>
                  <span class="flank flank-end">Save</span>
                </div>`,
        },
        {
            id: 'panels',
            title: 'Tabs and their panels — bug L23 closed',
            notes:
                'Panels slotted with data-tab are adopted: role=tabpanel, a name taken '
                + 'from the tab\'s own label, tabindex=0 because a panel is a scroll '
                + 'region, and hidden + inert on every panel but one. Slate\'s Live tabs '
                + 'have no panels and no aria-controls at all (L23). No aria-controls '
                + 'here either, and deliberately: an IDREF cannot cross a shadow boundary, '
                + 'so the panel is named rather than pointed at.',
            hostStyle: { 'inline-size': '900px' },
            html: `
                <style>
                  .panel { padding: var(--ui-space-4); background: var(--ui-fascia);
                           border-radius: var(--ui-radius); margin-block-start: var(--ui-space-3); }
                </style>
                <ui-tab-bar label="Shot" value="flow"
                  tabs='[{"value":"flow","label":"Pressure / Flow"},
                         {"value":"power","label":"Resistance / Impedance"},
                         {"value":"data","label":"Shot data"}]'>
                  <div class="panel" data-tab="flow">Pressure and flow, over the shot.</div>
                  <div class="panel" data-tab="power">Resistance and impedance.</div>
                  <div class="panel" data-tab="data">The shot-data grid.</div>
                </ui-tab-bar>`,
        },
        {
            id: 'stretch',
            title: 'stretch — the full-bleed bank, without writing 720',
            notes:
                'ORACLE expanded-charts .slate-bank.slate-expanded-tabs [i=163] 720x82 and '
                + 'history-viewer .slate-bank.slate-hv-tabs [i=168] 720x82: Slate pins both '
                + 'at a literal 720. `stretch` says "fill the container" and the container '
                + 'says how wide that is, so the same look survives a header that is not '
                + '1920 wide.',
            hostStyle: { 'inline-size': '720px' },
            html: `<ui-tab-bar stretch label="Chart" value="power"
                tabs='[{"value":"flow","label":"Pressure / Flow"},
                       {"value":"power","label":"Resistance / Impedance"},
                       {"value":"data","label":"Shot data"}]'></ui-tab-bar>`,
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (280px)',
            notes:
                'The container speaking, not the viewport (spec §2.1 Rule 1). fit-content '
                + 'has nothing left to give, so the bank shrinks to the box and #3\'s cells '
                + 'ellipsise — it does not overflow the header and it does not shove its '
                + 'neighbours, which is exactly the half of H3 that a component can own.',
            hostStyle: { 'inline-size': '280px' },
            html: `<ui-tab-bar label="Chart" value="data"
                tabs='[{"value":"flow","label":"Pressure / Flow"},
                       {"value":"power","label":"Resistance / Impedance"},
                       {"value":"data","label":"Shot data"}]'></ui-tab-bar>`,
        },
        {
            id: 'dials-neutral',
            title: 'NO PRIVATE SELECTED LOOK — all four dials neutral',
            notes:
                'The selected face turned to the bank\'s own ground and the ink to the '
                + 'resting ink, with the LED and glow at their shipped zero. If ANY part of '
                + '"selected" were painted by a rule in this component rather than by the '
                + 'four dials, this is the screenshot where it would still be visible. '
                + 'Slate had six selected looks across thirteen selection surfaces; this '
                + 'state is what "one, and it is re-themable to nothing" looks like.',
            hostStyle: { 'inline-size': '900px' },
            html: `<ui-tab-bar label="Profile editor" value="Settings"
                style="--ui-selected-face: var(--ui-key);
                       --ui-selected-ink: var(--ui-muted)"
                tabs='["Steps","Settings","Review"]'></ui-tab-bar>`,
        },
        {
            id: 'radian-dials',
            title: 'The fork, in four values and no rule changes',
            notes:
                'The identical component with the face taken to a seated slice and the LED '
                + 'and glow doing the work — the same four numbers ui-bank--radian-dials '
                + 'uses, on the tab bar, proving the two cannot diverge: there is one '
                + 'implementation of selected between them (bugs L8 and E10).',
            hostStyle: { 'inline-size': '900px' },
            html: `<ui-tab-bar label="Chart" value="power"
                style="--ui-selected-face: var(--ui-key-on);
                       --ui-selected-ink: var(--ui-tint-lever);
                       --ui-selected-led: var(--ui-toggle-led);
                       --ui-selected-glow: 55%"
                tabs='[{"value":"flow","label":"Pressure / Flow"},
                       {"value":"power","label":"Resistance / Impedance"},
                       {"value":"data","label":"Shot data"}]'></ui-tab-bar>`,
        },
        {
            id: 'disabled-tab',
            title: 'One tab disabled — and the arrows step over it',
            notes:
                'A tab that is not available yet (the editor\'s Review before a first '
                + 'step exists). #3 dims the cell and skips it on the arrow path AND the '
                + 'Home/End path; Slate never disables a tab, so this is new behaviour '
                + 'rather than a carried-over one, and it is stated once, in the bank.',
            hostStyle: { 'inline-size': '900px' },
            html: `<ui-tab-bar label="Profile editor" value="steps"
                tabs='[{"value":"steps","label":"Steps"},
                       {"value":"settings","label":"Settings"},
                       {"value":"review","label":"Review","disabled":true}]'></ui-tab-bar>`,
        },
        {
            id: 'disabled',
            title: 'The whole tab bar disabled',
            notes:
                'One dial, painted once, and it is #3\'s: the host takes '
                + '--ui-opacity-disabled and the tab buttons carry the native attribute for '
                + 'behaviour while opting out of the paint, so the two cannot compound. '
                + 'Nothing about disabled is stated in this component.',
            hostStyle: { 'inline-size': '900px' },
            html: `<ui-tab-bar disabled label="Profile editor" value="Review"
                tabs='["Steps","Settings","Review"]'></ui-tab-bar>`,
        },
    ],
};

export default entry;
