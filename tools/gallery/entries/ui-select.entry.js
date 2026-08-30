/**
 * ui-select.entry.js — the gallery entry for Wave 1 item #7 (Select).
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is ONE
 * exported array in ONE file, and sixteen Wave 1 builders write whole files. Sixteen
 * appends to one array is sixteen chances to clobber fifteen entries, silently, with
 * the loss invisible until a capture battery photographs an empty stage. So each
 * builder owns a file here and the wave GATE agent wires them in — import this
 * module and spread `entry` into the array, or build a manifest from this directory.
 *
 * The shape below is exactly the documented one (tools/gallery/README.md, entries.js
 * header): { id, title, module, notes, states: [{ id, title, html, hostStyle, notes }] }
 * with `module` relative to tools/gallery/. `test/render/gallery.render.test.mjs`
 * drives the registry, so a malformed entry is a red test rather than a silent miss.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-select--<state.id>`), so they are identifiers,
 * not labels; renaming one is a re-baseline.
 */

export const entry = {
    id: 'ui-select',
    title: 'Select',
    module: '../../src/components/ui-select.js',
    notes:
        'Item #7. A native select, styled: the caret is two gradients derived from two '
        + 'numbers (Slate writes six, twice), and the host is flex: none so a stated width '
        + 'is HELD — bug T9, where one screen renders 250px and 217px for the same '
        + 'authored width.',
    states: [
        {
            id: 'resting',
            title: 'Resting',
            notes:
                'No width stated, so the control takes its own max-content — the one width '
                + 'it can always honour. 64px tall (--ui-control-h), 18px text inset and an '
                + '18px caret inset, both from --ui-space-4.',
            html: `<ui-select label="Temperature unit"
                options='["Celsius (°C)","Fahrenheit (°F)"]'></ui-select>`,
        },
        {
            id: 'settings-row',
            title: 'T9 — a stated width in a squeezing row',
            notes:
                'Two selects, one row, both stating 260px, with a label that will not give '
                + 'up pixels. Slate renders 250 and 217 here (oracle: '
                + 'settings-extensions-decent-app-settings, elements 48 and 51). Both of '
                + 'these are 260.',
            html: `
                <style>
                  .row { display: flex; align-items: center; gap: var(--ui-space-4);
                         inline-size: 420px; }
                  .row .lbl { flex: none; inline-size: 320px; color: var(--ui-text); }
                  .row ui-select { inline-size: 260px; }
                </style>
                <div class="row">
                  <span class="lbl">Temperature unit</span>
                  <ui-select label="Temperature unit"
                    options='["Celsius (°C)","Fahrenheit (°F)"]'></ui-select>
                  <ui-select label="Log level"
                    options='["Everything (ALL)","Trace (FINEST) and every packet on the bus"]'></ui-select>
                </div>`,
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (240px)',
            notes:
                'The container speaking, not the viewport: max-inline-size: 100% clamps the '
                + 'control to its own box at an unchanged window, and the ink stays inside '
                + 'the box rather than painting through it.',
            hostStyle: { 'inline-size': '240px' },
            html: `<ui-select label="Log level"
                options='["Everything (ALL)","Trace (FINEST) and every packet on the bus"]'></ui-select>`,
        },
        {
            id: 'long-option',
            title: 'Long option, caret clearance',
            notes:
                'The trailing padding reserves the whole caret band plus one --ui-space-4, '
                + 'so the longest option never paints over the chevron.',
            hostStyle: { 'inline-size': '380px' },
            html: `<ui-select label="Comparison shot"
                options='["No comparison","15/08 07:10 · Lever Classic demo"]'></ui-select>`,
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes:
                'One dial, painted once. The host takes --ui-opacity-disabled; the control '
                + 'carries the native attribute for behaviour and opts out of the paint, or '
                + 'the two would compound to .14.',
            html: `<ui-select disabled label="Temperature unit"
                options='["Celsius (°C)","Fahrenheit (°F)"]'></ui-select>`,
        },
    ],
};

export default entry;
