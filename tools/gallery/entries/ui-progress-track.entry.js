/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-progress-track',
    title: 'Progress track',
    module: '../../src/components/ui-progress-track.js',
    notes:
        'Wave 1 #17. Determinate progress line with exactly one consumer — the app-update '
        + 'download bar (settings.js:6240); D4 killed the firmware file upload, so there is no '
        + 'indeterminate mode and no upload API. The oracle has NO answer here (prov_query.py '
        + 'find --cls slate-progress-track -> "0 elements matched anywhere in this corpus": the '
        + 'bar only exists mid-download and no capture caught one), so the trough, radius, '
        + 'thickness and 200ms come from a read-only source read. The FILL does not: it is '
        + '--ui-steel, which the oracle measures on this skin\'s other filled track in both '
        + 'themes (live-ready #shot-rating-slider), because Slate\'s own --ui-primary fill gives '
        + '1.11:1 against this trough in the dark theme. Look at the dark capture first.',
    states: [
        {
            id: 'empty',
            title: 'Zero',
            notes: 'value=0. The trough alone: --ui-key-on at --ui-radius, 10px tall '
                + '(--ui-space-2 + 2 x --ui-hairline, derived — 10px is not a token).',
            html: '<ui-progress-track value="0" label="Downloading update"></ui-progress-track>',
        },
        {
            id: 'partial',
            title: 'Mid-download (42%)',
            notes: 'The shipping state. max defaults to 1, the native progress default and the '
                + 'shape of the one live producer (state.progress is a 0..1 fraction, '
                + 'settings.js:6195). Fill --ui-steel, square-ended against the clipped trough.',
            html: '<ui-progress-track value="0.42" value-text="42%" label="Downloading update"></ui-progress-track>',
        },
        {
            id: 'complete',
            title: 'Complete',
            notes: 'value=1. The fill reaches both rounded ends of the trough; the radius is '
                + 'the trough\'s, clipped, not a second radius on the fill.',
            html: '<ui-progress-track value="1" value-text="100%" label="Downloading update"></ui-progress-track>',
        },
        {
            id: 'hundred-scale',
            title: 'A 0..100 range',
            notes: 'The limit arrives from outside and the primitive never owns it (Part 10 §12). '
                + 'Same paint as "partial" — 42/100 and 0.42/1 are one fraction.',
            html: '<ui-progress-track value="42" max="100" value-text="42%" label="Downloading update"></ui-progress-track>',
        },
        {
            id: 'ladder',
            title: 'Ladder — 0 / 25 / 50 / 75 / 100',
            notes: 'Five bars stacked, so a fill that is off by a hairline or a trough that '
                + 'changes height with its fill is visible by comparison rather than by measurement.',
            html: '<ui-progress-track value="0" label="0 percent"></ui-progress-track>'
                + '<ui-progress-track value="0.25" label="25 percent"></ui-progress-track>'
                + '<ui-progress-track value="0.5" label="50 percent"></ui-progress-track>'
                + '<ui-progress-track value="0.75" label="75 percent"></ui-progress-track>'
                + '<ui-progress-track value="1" label="100 percent"></ui-progress-track>',
        },
        {
            id: 'narrow-container',
            title: 'In a 200px container',
            notes: 'The bar is w-full at its one use site and stays that way: it fills its '
                + 'CONTAINER (§2.1 Rule 1) and reads no viewport. The fill holds its fraction '
                + 'of a narrower trough — the same 42% at 200px as at 900px.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-progress-track value="0.42" label="Downloading update"></ui-progress-track>',
        },
        {
            id: 'in-panel',
            title: 'In the update card',
            notes: 'The one real context, rebuilt from settings.js:6250-6262 with tokens: a '
                + 'hairline card on --ui-surface with the status line above the bar. This is '
                + 'where the dark-theme contrast departure is judged — Slate\'s fill would sit '
                + 'at 1.11:1 against this trough here.',
            hostStyle: { 'inline-size': '520px' },
            html: '<div style="border:var(--ui-hairline) solid var(--ui-line);border-radius:var(--ui-radius-xl);'
                + 'padding:var(--ui-space-4);background:var(--ui-surface);display:flex;'
                + 'flex-direction:column;gap:var(--ui-space-3)">'
                + '<span style="font-size:var(--ui-text-md);color:var(--ui-text)">Downloading update… 42%</span>'
                + '<ui-progress-track value="0.42" value-text="42%" label="Downloading update"></ui-progress-track>'
                + '</div>',
        },
    ],
};

export default entry;
