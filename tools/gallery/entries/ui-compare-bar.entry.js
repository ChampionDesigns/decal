/**
 * The gallery entry for.
 */

const KEY = `<span slot="key" aria-hidden="true" style="
        display: inline-flex; align-items: center; gap: var(--ui-space-2);
        color: var(--ui-muted); font-size: var(--ui-text-sm); font-weight: var(--ui-weight-semibold);
        letter-spacing: var(--ui-tracking-cap); text-transform: uppercase; white-space: nowrap;">
        <span style="inline-size: var(--ui-icon); border-block-start: var(--ui-chart-stroke, 3px) solid var(--ui-text-2);"></span>A solid
        <span style="inline-size: var(--ui-icon); border-block-start: var(--ui-chart-stroke-minor, 2px) dashed var(--ui-text-2); margin-inline-start: var(--ui-space-3);"></span>B dashed
    </span>`;

export const entry = {
    id: 'ui-compare-bar',
    title: 'Compare bar',
    module: '../../src/components/ui-compare-bar.js',
    notes:
        'Item #44, the History screen\'s A/B alignment strip: slider (#23) + numeric '
        + 'output + reset (#1). Every number and rule about the offset comes from '
        + 'src/lib/alignment-offset.js, the Gate 7 port staged ahead of this row - the '
        + '+/-5 s limit and its reasoning (alignment is for the grind drift between two '
        + 'pours of the SAME profile, not for lining up arbitrary shots), the 0.1 s step, '
        + 'the signed one-decimal readout, and the three enable rules. Sliding emits '
        + 'offset-change and the screen REDRAWS with shiftSeriesX; nothing here reaches '
        + 'into a trace list (a redraw is 4 ms - history-viewer.js:1032-1034). Bug H8 '
        + '"the align bar\'s height is set by the 64px Reset button, not the 44px slider '
        + 'beside it" dies here: the bar states its own block-size from one private row '
        + 'token and BOTH controls are sized to that row, so no sibling sets the strip.',
    states: [
        {
            id: 'comparing',
            title: 'Two shots, aligned at zero',
            notes:
                'The resting state of a comparison. The readout is the port\'s zero form, '
                + 'quoted from the corpus - "0.0 s", one decimal, a space before the unit, '
                + 'no sign at zero. Reset is disabled because reset is only ever an undo, '
                + 'which is also the state Slate was captured in: CITE history-viewer '
                + '#hv-align-reset [i=178] color = rgb(148, 161, 169) <- '
                + 'slate-components.css .slate-btn:disabled authored var(--slate-muted).',
            html: `<ui-compare-bar has-comparison>${KEY}</ui-compare-bar>`,
        },
        {
            id: 'offset-positive',
            title: 'B slid 1.4 s later',
            notes:
                'A coarser grind pushes everything after preinfusion a second or two '
                + 'right; this is that correction. The sign is the whole content of the '
                + 'control at small offsets, so the readout is signed always. The slider '
                + 'fills from the MIDPOINT, not the left end - #23\'s origin property, '
                + 'not a second gradient here.',
            html: `<ui-compare-bar has-comparison offset="1.4">${KEY}</ui-compare-bar>`,
        },
        {
            id: 'offset-limit',
            title: 'At the -5 s limit',
            notes:
                'Five seconds, not fifteen: the travel is a statement of what alignment '
                + 'MEANS, not a limit on what can be compared. A value past the limit is '
                + 'clamped on the way in, so the number printed is the number applied.',
            html: `<ui-compare-bar has-comparison offset="-9">${KEY}</ui-compare-bar>`,
        },
        {
            id: 'no-comparison',
            title: 'One shot only',
            notes:
                'Nothing to align against reads as a dimmed bar, not a missing one '
                + '(slate-live.css:2400-2405). Slate dimmed the key and caption to .45; '
                + 'here they take the one disabled dial, --ui-opacity-disabled, and the '
                + 'two controls dim themselves because they carry the real disabled state.',
            html: `<ui-compare-bar>${KEY}</ui-compare-bar>`,
        },
        {
            id: 'no-key',
            title: 'Without a slotted key',
            notes:
                'The key slot is empty and costs no gap. The A/B key is a CHART key and '
                + 'the library already has #10 ui-chart-legend, so #44 slots one rather '
                + 'than drawing a third legend; where it finally lives is the History '
                + 'screen\'s call in wave 5 phase 6.',
            html: '<ui-compare-bar has-comparison offset="-2.5"></ui-compare-bar>',
        },
        {
            id: 'narrow-container',
            title: 'In a 520px container',
            notes:
                'The one container rule (spec §2.1 Rule 1 - the oracle has no vote on '
                + 'responsive behaviour). Below 640px the caption drops: it is a visual '
                + 'repeat of the slider\'s own accessible name, so nothing is announced '
                + 'differently, and the ~89px it frees goes to the track. The strip keeps '
                + 'its stated height and the slider keeps a fingertip of width.',
            hostStyle: { 'inline-size': '520px' },
            html: `<ui-compare-bar has-comparison offset="0.7">${KEY}</ui-compare-bar>`,
        },
    ],
};

export default entry;
