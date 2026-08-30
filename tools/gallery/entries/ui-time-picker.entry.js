/**
 * ui-time-picker.entry.js — the gallery entry for Wave 4 item #54, the time picker
 * face (a dialog body).
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a
 * single hand-written array and the run's rule is whole-file writes; N builders
 * appending to it in parallel is N−1 entries lost, which the gallery cannot detect
 * because a missing entry is just a shorter list. Wave 1 hit exactly this and adopted
 * the per-entry split (entries.js:30-45). This builder owns this file; the wave's one
 * cross-cutting writer adds the single import line and the single array slot, serially.
 *
 * SHAPE is the one entries.js documents: `module` is relative to `tools/gallery/`,
 * `hostStyle` sizes the STAGE and not the component (spec §2.1 Rule 1), and the full
 * state id is `ui-time-picker--<state.id>` — a capture-battery filename, so these ids
 * are identifiers and renaming one is a re-baseline.
 *
 * ONE STATE OPENS A MODAL. `in-dialog` mounts the body inside #18, which is where it
 * actually lives; a modal dialog is in the top layer, so it centres on the VIEWPORT
 * and its scrim covers the stage frame, and the gallery's own nav goes inert while it
 * is up. That is the component working — move between states with the URL's `?state=`
 * parameter, which is what `tools/capture_battery.py` does anyway (capture_battery.py:107).
 *
 * FOR THE GATE:  import { entry as uiTimePicker } from './entries/ui-time-picker.entry.js';
 *                export const entries = [ …, uiTimePicker ];
 */

export const entry = {
    id: 'ui-time-picker',
    title: 'Time picker face',
    module: './entries/ui-time-picker.demo.js',
    notes:
        'Wave 4 #54, the body of a #18 instance — never its own modal machinery. The clock '
        + 'is the one element the spec calls genuinely fluid (§5.2 #54), and it stays fluid: '
        + 'the disc, the hand and the hub are an SVG viewBox that scales with the container. '
        + 'What does NOT scale is the finger. Slate\'s twelve targets are SVG circles at r=22 '
        + 'inside an SVG at max-width: 78vw — a 44-unit touch target that shrinks with the '
        + 'window and is already under the 48px floor at its natural size. Here they are HTML '
        + 'buttons at --ui-hit-min, at fluid POSITIONS and a fixed SIZE (spec §2.2 row 1), '
        + 'which is also what lets the four selection dials reach the selected number: '
        + 'background-color does not paint an SVG <text>, and that is exactly why Slate reached '
        + 'for `fill: #fff` — bug O16, time-picker-modal.css:192. All the time arithmetic is '
        + 'src/lib/time-picker-core.js, PORT-AS-IS.',
    states: [
        {
            id: 'hour-dial',
            title: 'Hour dial — 06:30',
            notes: 'The state the picker opens in. The readout is a composed ui-bank (#3) with '
                + 'the digits slotted in at --ui-display-md, so the bank keeps the roles, the '
                + 'roving tabindex, the seam and the four dials while the body owns the type. '
                + 'The hand angle is hourHandAngle(6) from the ported core; the 6 chip sits on '
                + 'the end of it and IS the knob Slate drew separately.',
            html: '<ui-time-picker value="06:30" label="Wake time"></ui-time-picker>',
        },
        {
            id: 'minute-dial',
            title: 'Minute dial — the same face, twelve other labels',
            notes: 'mode="minute". Nothing about the artwork changes: same viewBox, same ring '
                + 'radius, same chips, minuteHandAngle(30) instead of hourHandAngle(6). Slate '
                + 'auto-advances here after an hour is tapped ("like the OS picker", '
                + 'time-picker-modal.js:105) and so does this — but only on an explicit choice, '
                + 'never on arrow-key roving, because a dial that changes under the caret is '
                + 'unusable from a keyboard.',
            html: '<ui-time-picker value="06:30" mode="minute" label="Wake time"></ui-time-picker>',
        },
        {
            id: 'off-tick',
            title: 'Off the ticks — 07:37',
            notes: 'The minute dial exposes multiples of five, so 37 has no chip to check: '
                + 'snapMinute(37) is 35, which is not 37, so aria-checked is false on all twelve '
                + 'and the hand alone carries the value. Slate\'s comment for the same branch is '
                + '"no exact number between ticks" (time-picker-modal.js:61). Look at this one '
                + 'to confirm the hand reads as the answer when no number is lit.',
            html: '<ui-time-picker value="07:37" mode="minute" label="Wake time"></ui-time-picker>',
        },
        {
            id: 'readout',
            title: 'The departure: no colon',
            notes: 'Slate separates HH and MM with a <span class="tpm-colon">:</span> because its '
                + 'two segments are detached rounded boxes 8px apart. The readout here is a '
                + 'one-piece bank, so the divider is the bank\'s own seam — CONVENTIONS §13, "a '
                + 'divider is a gap, not a border". Two hours are shown side by side so the seam '
                + 'can be judged against the tabular digits it separates. This state exists to be '
                + 'looked at and accepted or rejected on purpose.',
            html: '<ui-time-picker value="06:30" label="Wake"></ui-time-picker>'
                + '<ui-time-picker value="23:05" mode="minute" label="Sleep"></ui-time-picker>',
        },
        {
            id: 'in-dialog',
            title: 'Where it actually lives — inside #18',
            notes: 'The whole overlay, assembled: the title is the dialog\'s `heading` and the '
                + 'Cancel/OK pair is its `actions` slot. Slate drew both inside the card, and its '
                + 'title is bug A10 — "the time picker\'s is 20px/800 against the component\'s '
                + '28px/500". Not restating the type here is how A10 dies for this consumer. '
                + 'Modality, the focus trap, inertness, Escape and the scrim are all #18\'s; this '
                + 'body supplies content only.',
            html: `
<ui-dialog id="d" open heading="Set time">
  <ui-time-picker slot="body" value="06:30"></ui-time-picker>
  <ui-button slot="actions">Cancel</ui-button>
  <ui-button slot="actions" variant="primary">OK</ui-button>
</ui-dialog>`,
        },
        {
            id: 'narrow-container',
            title: 'In a 200px container — the two floors hold',
            notes: 'Both rows overflow rather than degrading, and they are two different floors. '
                + 'The FACE stops shrinking where its targets would start overlapping: '
                + '--ui-hit-min is physical — "a wet fingertip is about 9 mm; at this panel\'s '
                + 'density that is ~48px" — and §2.2\'s first row is explicit that a control which '
                + 'shrinks with the window "becomes unusable exactly when the window is small". '
                + 'That floor is DERIVED, not typed: twelve labels 30 degrees apart on a ring of '
                + 'radius 98 in a 264-unit box put adjacent centres 19.2% of the face apart, so '
                + 'the face stops at hit-min / 0.192; raise --ui-hit-min and the floor follows. '
                + 'The READOUT does not shrink at all: it is four controls, not artwork, and '
                + 'letting it track the container puts its cells at 48px — 12px of content box '
                + 'after #3\'s padding — so every digit would ellipsise away while the clock '
                + 'beside it stayed legible. It is the wider of the two, so the readout, not the '
                + 'clock, is this body\'s binding floor.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-time-picker value="06:30" label="Wake time"></ui-time-picker>',
        },
        {
            id: 'dials-radian',
            title: 'The four dials moved (a Radian-shaped preview)',
            notes: 'The same face with the LED and glow dials turned up on the stage, which is '
                + 'what the Radian fork does: face and ink stay tokens, --ui-selected-led becomes '
                + 'a length and --ui-selected-glow a percentage. Zero rule changes in the '
                + 'component, and the selected chip, the checked readout segment and the checked '
                + 'meridiem segment all move together because there is one treatment behind all '
                + 'three. This state IS the claim, rendered — and it is the state O16 could never '
                + 'have: `fill: #fff` has no dial to turn.',
            hostStyle: {
                '--ui-selected-led': '4px',
                '--ui-selected-glow': '55%',
            },
            html: '<ui-time-picker value="15:45" mode="minute" label="Wake time"></ui-time-picker>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes: 'One fade on the host at --ui-opacity-disabled (.38), from the base\'s single '
                + 'disabled dial. Paint only in the base; the native disabled attribute on every '
                + 'chip and on both banks is what actually refuses the press, and no change event '
                + 'is fired.',
            html: '<ui-time-picker value="18:00" disabled label="Wake time"></ui-time-picker>',
        },
    ],
};

export default entry;
