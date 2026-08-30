/**
 * The gallery entry for.
 */

/** A positioned stage, so `anchor="container"` has something to be absolute against. */
const STAGE = { position: 'relative', 'inline-size': '640px', 'block-size': '300px' };

const NARROW = { ...STAGE, 'inline-size': '320px', 'block-size': '200px' };

/**
 * The panel the blank covers. Token colours only — `tools/` is inside Gate C's scan
 * roots, so an inline `#fff` here fails the colour-literal guard exactly as it would in
 * a component.
 */
const PANEL = '<div style="position:absolute; inset:0; display:grid; place-items:center;'
    + ' background-color:var(--ui-fascia); color:var(--ui-text);'
    + ' font-size:var(--ui-text-lg)">Live screen</div>';

export const entry = {
    id: 'ui-screensaver',
    title: 'Screensaver',
    module: '../../src/components/ui-screensaver.js',
    notes:
        'Wave 4 #57, the Live compound that blanks the screen. D10: fully black, and the '
        + 'skin is the SINGLE owner of blanking — enforced by a module-level owner slot, '
        + 'so a second viewport-anchored instance is refused rather than allowed to be a '
        + 'second blanker. All of the logic is the screensaver-policy.js port, whose value '
        + 'is that its derivations return paint instructions and are structurally '
        + 'incapable of asking for a machine command; this element inherits that by '
        + 'emitting ui-screensaver-wake and never calling a route. Q13 — the wake-edge '
        + 'brightness race — is decided here: the skin drives the DIM and stands back on '
        + 'the RESTORE, so ReaPrime\'s own awake-with-brightness-0 restore is the single '
        + 'restore path and the old brightnessBeforeDim ?? rememberedBrightness ?? 100 '
        + 'ladder has nothing to come back for. The derived restore is still visible on '
        + 'the display-action attribute, which is what the reversal would measure.',
    states: [
        {
            id: 'blank',
            title: 'Machine confirmed sleeping — the blank',
            notes: 'The whole component. --ui-blackout, the one token that is the same '
                + 'value in both themes because a blanked screen does not follow the '
                + 'theme. The panel behind it is completely covered — this is the picture '
                + 'D10 describes, and there is no grey dim child and no image: Slate\'s '
                + 'rgba(40,40,40,0.55) overlay and its screensaverImages list are both '
                + 'retired. display-action reads "dim": the panel half of the blank left '
                + 'with the overlay half, from the same branch.',
            hostStyle: STAGE,
            html: PANEL + '<ui-screensaver anchor="container" machine-state="sleeping"'
                + ' brightness-supported></ui-screensaver>',
        },
        {
            id: 'awake',
            title: 'Machine awake — nothing is painted',
            notes: 'The overlay goes up on a CONFIRMED sleep and comes down on any exit '
                + 'from one. An awake machine is not a sleep, so the panel is untouched. '
                + 'This is also the state the 46 ms race used to break: the old teardown '
                + 'sent setMachineState(idle) as it hid, so an overlay coming down woke '
                + 'the machine. Nothing here can emit a machine state without a press.',
            hostStyle: STAGE,
            html: PANEL + '<ui-screensaver anchor="container" machine-state="idle">'
                + '</ui-screensaver>',
        },
        {
            id: 'unknown-state',
            title: 'A state name this build does not know',
            notes: 'The generated enum has 21 members and the server may know a 22nd. An '
                + 'unrecognised name is a machine DOING something, so it is not a sleep '
                + 'and the screen stays lit. Slate case-folded and coerced here, which is '
                + 'a fallback whose failure mode was blanking the screen on a name '
                + 'ReaPrime never sent; the comparison is now exact against the generated '
                + 'name (A7).',
            hostStyle: STAGE,
            html: PANEL + '<ui-screensaver anchor="container" machine-state="Sleeping">'
                + '</ui-screensaver>',
        },
        {
            id: 'no-reading',
            title: 'The feed said nothing — still not a blank',
            notes: 'No machine-state at all: the address layer\'s absence, which is what '
                + 'a BLE drop now arrives as. Nothing is not a confirmation, so the skin '
                + 'does not blank — and an absence RELEASES a blank that is already up, '
                + 'which is reaprime#519 closed (the DE1 dropped off BLE while asleep and '
                + 'the tablet stayed dark for the rest of the session, recoverable only '
                + 'by a brightness slider the user could not see).',
            hostStyle: STAGE,
            html: PANEL + '<ui-screensaver anchor="container"></ui-screensaver>',
        },
        {
            id: 'disabled',
            title: 'screensaverEnabled off — one feature, one switch',
            notes: 'The machine IS asleep; the user has turned the screensaver off. No '
                + 'overlay and no dim: under D10 the black box and the panel dim are one '
                + 'decision, so the skin can never leave a dimmed panel with no overlay '
                + 'on it — a black screen the user cannot press. Black-vs-dimmed is no '
                + 'longer a setting (blackScreenSaver is retired); on-vs-off still is.',
            hostStyle: STAGE,
            html: PANEL + '<ui-screensaver anchor="container" machine-state="sleeping"'
                + ' enabled="false" brightness-supported></ui-screensaver>',
        },
        {
            id: 'narrow-container',
            title: 'In a 320×200 panel',
            notes: 'The container state. The blank fills the box it is anchored to and '
                + 'never reads the viewport — there is no @media (width…) at any level in '
                + 'the component (CONVENTIONS §2), because a blank that covers the screen '
                + 'needs no breakpoint. Responsive behaviour has no Slate answer anyway '
                + '(98.4% of its geometry is frozen); LAYOUT_SPEC_DRAFT governs.',
            hostStyle: NARROW,
            html: PANEL + '<ui-screensaver anchor="container" machine-state="sleeping">'
                + '</ui-screensaver>',
        },
    ],
};

export default entry;
