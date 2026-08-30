/**
 * ui-bank.entry.js — the gallery entry for Wave 2 item #3 (Segmented bank).
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is ONE
 * exported array in ONE file and Wave 2 runs twelve builders under a whole-file-write
 * rule, so twelve appends to one array is twelve chances to clobber eleven entries,
 * silently, with the loss invisible until a capture battery photographs an empty
 * stage. Wave 1 hit exactly this and adopted the per-entry split (entries.js:30-45);
 * the same rule binds here. Each builder owns a file, and ONE cross-cutting writer
 * adds the import line and the array slot, serially, once.
 *
 * The shape below is the documented one (tools/gallery/README.md, entries.js header):
 * { id, title, module, notes, states: [{ id, title, html, hostStyle, notes }] } with
 * `module` relative to tools/gallery/. `test/render/gallery.render.test.mjs` drives
 * the registry, so a malformed entry is a red test rather than a silent miss.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-bank--<state.id>`), so they are identifiers,
 * not labels; renaming one is a re-baseline.
 *
 * WHAT TO LOOK AT, IN ONE SENTENCE PER STATE: the same component, in three aria
 * spellings, two dial settings and four container widths, with exactly one selected
 * treatment throughout — which is the founding defect made un-photographable.
 */

export const entry = {
    id: 'ui-bank',
    title: 'Segmented bank',
    module: '../../src/components/ui-bank.js',
    notes:
        'Item #3, THE selection component. One-piece bank of mutually exclusive items: '
        + 'a --ui-key ground inside one hairline, a --ui-seam-ink inset seam between '
        + 'cells, and a selected item painted ONLY by the four dials. Slate had thirteen '
        + 'selection implementations and six selected looks; there is one of each here, '
        + 'and the shadow boundary is what makes a seventh inexpressible (L8, E10, T5).',
    states: [
        {
            id: 'radio',
            title: 'Radio — the default spelling',
            notes:
                'role=radiogroup / role=radio / aria-checked, the shape Slate uses for a '
                + 'settings multi-choice group (oracle: settings-connection-scale, three '
                + 'items at 126x62 in a 379x64 bank). 64px outside, 62px inside: the two '
                + 'hairlines are --ui-control-inner, derived rather than written.',
            hostStyle: { 'inline-size': '380px' },
            html: `<ui-bank label="On disconnect" value="Disconnect"
                items='["Nothing","Display Off","Disconnect"]'></ui-bank>`,
        },
        {
            id: 'tablist',
            title: 'Tablist — the same paint, the other spelling',
            notes:
                'role=tablist / role=tab / aria-selected, at the 82px call-site height the '
                + 'History and expanded-chart banks use (oracle: history-viewer, three tabs '
                + 'at 239x80 in a 720x82 bank). Nothing about the selected treatment '
                + 'changes: the aria word is the accessibility answer, not a paint switch.',
            hostStyle: { 'inline-size': '720px' },
            html: `<ui-bank mode="tablist" label="Chart" value="flow"
                style="block-size: var(--ui-control-lg)"
                items='[{"value":"flow","label":"Pressure / Flow"},
                        {"value":"power","label":"Resistance / Impedance"},
                        {"value":"data","label":"Shot data"}]'></ui-bank>`,
        },
        {
            id: 'toolbar',
            title: 'Toolbar — aria-pressed, and arrows that do not press',
            notes:
                'role=group with plain buttons carrying aria-pressed, the shape Slate '
                + 'leaves role-less (oracle: settings-accessories-lighting, two items at '
                + '412x64). Selection does NOT follow focus here — arrowing past a pressed '
                + 'button must not press it — so the arrows move the tab stop and '
                + 'Space/Enter chooses.',
            hostStyle: { 'inline-size': '560px' },
            html: `<ui-bank mode="toolbar" label="Lighting state" value="Awake"
                items='["Awake","Asleep"]'></ui-bank>`,
        },
        {
            id: 'five-up',
            title: 'Five up',
            notes:
                'The sleep/wake schedule bank (oracle: settings-machine-sleep---wake-'
                + 'schedules, five items at 230x62 in a 1150x64). Four seams, drawn by the '
                + 'four + siblings, at --ui-seam over --ui-seam-ink.',
            hostStyle: { 'inline-size': '1150px' },
            html: `<ui-bank label="Schedule" value="Wed"
                items='["Mon","Tue","Wed","Thu","Fri"]'></ui-bank>`,
        },
        {
            id: 'radian-dials',
            title: 'The fork, in four values and no rule changes',
            notes:
                'The identical component with --ui-selected-led and --ui-selected-glow '
                + 'turned up and the face taken to a seated slice: Slate is a solid accent '
                + 'block with the LED off, Radian is the quiet slice with the LED and a '
                + 'channel glow doing the work. Same file, same selectors, four numbers. '
                + 'Note the seam still runs behind the selected cell — that is '
                + '--_ui-rest-shadow composing rather than being replaced.',
            hostStyle: { 'inline-size': '720px' },
            html: `<ui-bank mode="tablist" label="Chart" value="power"
                style="block-size: var(--ui-control-lg);
                       --ui-selected-face: var(--ui-key-on);
                       --ui-selected-ink: var(--ui-tint-lever);
                       --ui-selected-led: var(--ui-toggle-led);
                       --ui-selected-glow: 55%"
                items='[{"value":"flow","label":"Pressure / Flow"},
                        {"value":"power","label":"Resistance / Impedance"},
                        {"value":"data","label":"Shot data"}]'></ui-bank>`,
        },
        {
            id: 'one-turn-three-banks',
            title: 'L8 — three banks, three spellings, one dial',
            notes:
                'The favourites bank, the dye strip and the tab bank: in Slate these are '
                + 'two hand-built copies of .slate-bank plus the real one, so re-skinning '
                + 'selection moved the tabs and left the favourites behind. Here they are '
                + 'three uses of one component, and the face override on the wrapper '
                + 'reaches all three at once. That is L8 with nothing left to bypass.',
            hostStyle: { 'inline-size': '760px' },
            html: `
                <style>
                  .l8 { display: grid; gap: var(--ui-space-3);
                        --ui-selected-face: var(--ui-primary);
                        --ui-selected-ink: var(--ui-on-primary); }
                </style>
                <div class="l8">
                  <ui-bank mode="toolbar" label="Favourites" value="Londinium"
                    items='["Lever Classic","Londinium","Filter 2.1","Turbo"]'></ui-bank>
                  <ui-bank label="Dye" value="B"
                    items='["A","B","C","D","E","F"]'></ui-bank>
                  <ui-bank mode="tablist" label="Editor" value="Settings"
                    items='["Steps","Settings","Review"]'></ui-bank>
                </div>`,
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (240px)',
            notes:
                'The container speaking, not the viewport (spec §2.1 Rule 1). The cells are '
                + 'flex: 1 1 0 with min-inline-size: 0 and the label ellipsises, so the bank '
                + 'shrinks instead of overflowing its box — and nothing is silently clipped '
                + 'by the overflow: hidden the radius needs.',
            hostStyle: { 'inline-size': '240px' },
            html: `<ui-bank label="Comparison" value="No comparison"
                items='["No comparison","Previous shot","Best of week"]'></ui-bank>`,
        },
        {
            id: 'disabled-item',
            title: 'One item disabled',
            notes:
                'The base dims the button from --ui-opacity-disabled and the keyboard skips '
                + 'it on both the arrow path and the Home/End path. Slate never disables a '
                + 'bank item, so there is no oracle answer and none is sought.',
            hostStyle: { 'inline-size': '560px' },
            html: `<ui-bank label="Steam" value="auto"
                items='[{"value":"off","label":"Off"},
                        {"value":"auto","label":"Auto"},
                        {"value":"purge","label":"Purge","disabled":true}]'></ui-bank>`,
        },
        {
            id: 'disabled-bank',
            title: 'The whole bank disabled',
            notes:
                'One dial, painted once. The host takes --ui-opacity-disabled; the buttons '
                + 'carry the native attribute for behaviour and opt out of the paint, or the '
                + 'two would compound to .14 — three times fainter than every other disabled '
                + 'control in the skin.',
            hostStyle: { 'inline-size': '380px' },
            html: `<ui-bank disabled label="On disconnect" value="Nothing"
                items='["Nothing","Display Off","Disconnect"]'></ui-bank>`,
        },
        {
            id: 'slotted-content',
            title: 'Rich cells through the per-item slot',
            notes:
                'Each cell exposes a slot named item-<value> whose fallback is the label, so '
                + 'a favourites bank (#36 = #3 + #35) or a preset bank (#37) composes into '
                + 'the cell without a second selection component. The BUTTON still owns the '
                + 'paint, so the slotted content simply inherits currentColor — which is '
                + '--ui-selected-ink on the selected cell.',
            hostStyle: { 'inline-size': '560px' },
            html: `<ui-bank mode="tablist" label="Preset" value="p2"
                style="block-size: var(--ui-control-lg)"
                items='[{"value":"p1","label":"1"},{"value":"p2","label":"2"},
                        {"value":"p3","label":"3"}]'>
                  <span slot="item-p1">18 g<br>36 g</span>
                  <span slot="item-p2">20 g<br>44 g</span>
                  <span slot="item-p3">22 g<br>50 g</span>
                </ui-bank>`,
        },
    ],
};

export default entry;
