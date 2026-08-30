/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-pick-disc',
    title: 'A/B pick disc',
    module: '../../src/components/ui-pick-disc.js',
    notes:
        'Wave 2 #45. The History viewer\'s two-slot shot selector, drawn twice in Slate and '
        + 'named there as one object: a static tag in the header ("which slot is which") and a '
        + 'pressable disc in every shot-list row ("this row is that slot"). 48 elements measured, '
        + 'one geometry — 62 x 62, which is --ui-control-inner. It is one of the six components '
        + 'SCOPE\'s founding-defect callout says "may not own a private selected look", so the '
        + 'whole of its selected state is the four dials: the oracle reads the selected fill as '
        + '--ui-steel and the selected ink as --ui-on-steel in both forms and both themes, which '
        + 'is exactly --ui-selected-face / --ui-selected-ink. Retarget those four values and both '
        + 'states below move; no rule in the component changes.',
    states: [
        {
            id: 'tag-pair',
            title: 'Header tags — A picked, B not',
            notes: 'The header\'s two slot tags, as Slate draws them: A filled because "A is the '
                + 'shot on the charts, B the one it is measured against". A takes the two colour '
                + 'dials; B rests on --ui-key inside a --ui-line-strong hairline. Slate\'s comment '
                + 'on that hairline is carried in the component: filled with --slate-key alone the '
                + 'disc vanished against the header bar in the light theme "so B read as disabled".',
            html: '<ui-pick-disc selected label="Slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc label="Slot B">B</ui-pick-disc>',
        },
        {
            id: 'pick-pair',
            title: 'Shot-list discs — one assigned, one free',
            notes: 'The row form. Hollow until assigned, so twenty-one unassigned rows do not read '
                + 'as twenty-one filled discs: transparent inside a --ui-line hairline with '
                + '--ui-muted ink. The assigned one is painted by the same four dials as the header '
                + 'tag above — same treatment, two forms, one component. THE FORM IS AN ATTRIBUTE '
                + 'OF ITS OWN since parity surface 6 (form="pick"), because "is this pressable" and '
                + '"which of Slate\'s two discs is this" are different questions: the History band '
                + 'wants a slot-NAMING tag that is also pressable, which is interactive with no '
                + 'form, and every state on this page renders exactly what it rendered before.',
            html: '<ui-pick-disc interactive form="pick" selected label="Compare slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" label="Compare slot B">B</ui-pick-disc>',
        },
        {
            id: 'both-forms',
            title: 'Both forms, both states',
            notes: 'The four discs together — the reason this is one file. Read the two selected '
                + 'ones against each other: the tag and the pick differ only in the paint they '
                + 'REST on, never in the paint that says "picked".',
            html: '<ui-pick-disc selected label="Slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc label="Slot B">B</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" selected label="Compare slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" label="Compare slot B">B</ui-pick-disc>',
        },
        {
            id: 'departure-border',
            title: 'The departure: the ring survives selection',
            notes: 'Slate swaps the border to --slate-steel on both selected rules, so a selected '
                + 'disc loses its edge into its own fill. That is a fifth painted property keyed on '
                + 'the selected state — a private selected look, which this wave bans. The hairline '
                + 'is resting paint and keeps its resting token in every state, so the selected disc '
                + 'below still carries a ring where Slate\'s does not. This state exists to be looked '
                + 'at and accepted or rejected on purpose.',
            html: '<ui-pick-disc interactive form="pick" label="Free">B</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" selected label="Picked">A</ui-pick-disc>',
        },
        {
            id: 'disabled',
            title: 'Disabled, both states',
            notes: 'One fade on the host at --ui-opacity-disabled (.38), from the base\'s single '
                + 'disabled dial. Paint only in the base; the native disabled attribute on the '
                + 'button inside is what actually refuses the press, and no pick event is fired.',
            html: '<ui-pick-disc interactive form="pick" disabled label="Compare slot B">B</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" selected disabled label="Compare slot A">A</ui-pick-disc>',
        },
        {
            id: 'narrow-container',
            title: 'In a 96px container',
            notes: 'Nothing moves. --ui-hit-min is physical — "a wet fingertip is about 9 mm; at '
                + 'this panel\'s density that is ~48px" — and CONVENTIONS §11 keeps density '
                + 'arithmetic off --ui-control-h and --ui-hit-min for that reason. So the honest '
                + 'container floor for this control is 62 x 62 and a container narrower than its '
                + 'two discs overflows rather than shrinking them under the thumb.',
            hostStyle: { 'inline-size': '96px' },
            html: '<ui-pick-disc interactive form="pick" selected label="Compare slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" label="Compare slot B">B</ui-pick-disc>',
        },
        {
            id: 'dials-radian',
            title: 'The four dials moved (a Radian-shaped preview)',
            notes: 'The same two discs with the LED and glow dials turned up on the stage, which is '
                + 'what the Radian fork does: face and ink stay tokens, --ui-selected-led becomes a '
                + 'length and --ui-selected-glow a percentage. Zero rule changes in the component — '
                + 'this state IS the claim, rendered.',
            hostStyle: {
                '--ui-selected-led': '4px',
                '--ui-selected-glow': '55%',
            },
            html: '<ui-pick-disc selected label="Slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" selected label="Compare slot A">A</ui-pick-disc>'
                + ' <ui-pick-disc interactive form="pick" label="Compare slot B">B</ui-pick-disc>',
        },
    ],
};

export default entry;
