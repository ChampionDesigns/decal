/**
 * ui-toast.entry.js — the gallery entry for Wave 3 item #22.
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a
 * single exported array and the run's rule is whole-file writes; N builders appending
 * to one array in parallel is N−1 entries lost, silently, because a missing entry is
 * just a shorter list. Each builder owns one file here and the wave's cross-cutting
 * reviewer wires the import line and the array slot in serially, as single writer.
 *
 * FOR THE GATE:  import { entry as uiToast } from './entries/ui-toast.entry.js';
 *                export const entries = [ …, uiToast ];
 *
 * TWO THINGS EVERY STATE HERE HAS TO DO, and both are properties of this component
 * rather than of the gallery:
 *
 *   1. `anchor="container"` and a POSITIONED stage. The toast surface is
 *      `position: fixed` on the --ui-z-toast layer, so without this every state would
 *      land in the same corner of the window, on top of the gallery's own chrome, and
 *      the capture battery would shoot the identical picture for all of them.
 *      `hostStyle` is applied to the STAGE WRAPPER, which is exactly the positioned
 *      ancestor an absolutely-positioned layer needs — the honest way to show a
 *      component that owns a layer, the same way `inline-size` is the honest way to
 *      show one that reads its own container.
 *
 *   2. `duration="0"` on every notice. A toast with a clock is gone before the shutter
 *      opens: the battery drives 1281×801@dsf1.5 / 1920×1200 / 1000×600 over the same
 *      states, and the default is 2400 ms (ui.js:3283). Sticky notices are also what
 *      makes the baseline deterministic, together with DEPARTURE 10 — a notice present
 *      at mount does not animate in, so no capture can catch a half-faded card.
 *
 * THE CORPUS HAS NO PICTURE OF THIS COMPONENT TO COMPARE AGAINST, mechanically:
 * `prov_query.py find --cls toast` and `find --id app-toast` both return "0 elements
 * matched anywhere in this corpus" across all 49 states, because Slate ships both toast
 * containers `display: none` in markup (index.html:645, :657) and shows them from
 * script. These captures are therefore a NEW baseline, not a comparison.
 */

/** Every state sits in a panel-sized, positioned stage. */
const STAGE = { position: 'relative', 'inline-size': '640px', 'block-size': '300px' };

const TALL = { ...STAGE, 'block-size': '420px' };

export const entry = {
    id: 'ui-toast',
    title: 'Toast',
    module: '../../src/components/ui-toast.js',
    notes:
        'Wave 3 #22, and one of the six primitives DECISIONS.md:251 says the library '
        + 'never had. Today it is raw DaisyUI in index.html:645-661 with 26 call sites '
        + 'through ui.js:3283 showToast(message, duration = 2400, type = "info"). ONE '
        + 'element, so the second toast in a burst overwrites the first and restarts its '
        + 'clock; four types, of which "info" — 20 of the 26 calls — has no rule of its '
        + 'own and paints in DaisyUI\'s vendor cyan; role and aria-live rewritten on the '
        + 'container per message; z-index 10001 on a scale that does not exist; and no '
        + 'dismiss affordance at all on a wall panel with no keyboard. This is the '
        + 'surface: the fixed layer, the column, the clocks, the live region. A notice is '
        + 'any element child, and the region owns it from the moment it is slotted in — '
        + 'it shows it, paces it, and removes it. The handover is one-way: there is no '
        + 'report back (ui-toast-dismiss was retired 29 Aug 2026, audit F-014, unheard).',
    states: [
        {
            id: 'info',
            title: 'One notice, info',
            notes: 'The default tone and the commonest call — "Shot uploaded '
                + 'successfully!" (app.js:528). --ui-surface card, --ui-text ink, a '
                + '--ui-line hairline edge, --ui-radius-xl (DaisyUI\'s --rounded-box 1rem '
                + 'on the scale\'s floating-surface step), --ui-elev-2 (index.html:646 '
                + 'shadow-lg), --ui-space-4 padding and --ui-text-nav 22px type '
                + '(index.html:658 text-[22px]).',
            hostStyle: STAGE,
            html: '<ui-toast anchor="container">'
                + '<div duration="0">Shot uploaded successfully!</div>'
                + '</ui-toast>',
        },
        {
            id: 'tones',
            title: 'The four tones',
            notes: 'DEPARTURE 1, the measured one. Slate fills the card with the status '
                + 'colour and writes --slate-on-primary on top (slate-shell.css:84-104). '
                + 'In the DARK theme — the one the machine boots into, bug S11 — the '
                + 'status tokens are the BRIGHT variants meant to be read AS ink, so white '
                + 'on them measures 1.83 (ok) / 3.13 (danger) / 2.07 (warn) against a 4.5 '
                + 'floor. Tone here is ink and edge on the one card face: 8.81 / 5.16 / '
                + '7.78 dark and 5.80 / 6.66 / 5.89 light. It is also the house treatment '
                + 'already — ui-alert-banner draws --ui-status-danger as ink on '
                + '--ui-fascia, which is the oracle\'s own answer for the alert strip.',
            hostStyle: TALL,
            html: '<ui-toast anchor="container" max-visible="0">'
                + '<div duration="0">Shot stopped: 27.4s</div>'
                + '<div tone="ok" duration="0">Scale tared</div>'
                + '<div tone="warn" duration="0">Offline: displaying cached profiles</div>'
                + '<div tone="danger" duration="0">Scale lost — stop at weight disabled</div>'
                + '</ui-toast>',
        },
        {
            id: 'stack-cap',
            title: 'The cap: three, newest nearest the edge',
            notes: 'DEPARTURE 3. Slate stacks nothing — ui.js:3290 writes '
                + 'messageEl.textContent and clears the running timer, so "Scale tared" '
                + '(2000 ms) silently eats "Shot blocked: no scale connected" (4000 ms) if '
                + 'they land together. Here up to max-visible notices stack, the OLDEST is '
                + 'retired when a further one arrives — the newest is the one being read, '
                + 'so the message that has already had its time on the glass is the one '
                + 'that goes, rather than the one that just landed. Gap is '
                + '--ui-space-2, DaisyUI\'s .toast gap of .5rem exactly.',
            hostStyle: STAGE,
            html: '<ui-toast anchor="container">'
                + '<div duration="0">Scale Not Found</div>'
                + '<div tone="ok" duration="0">Cup warmer on</div>'
                + '<div tone="danger" duration="0">Machine did not accept target temperature</div>'
                + '</ui-toast>',
        },
        {
            id: 'top',
            title: 'placement="top"',
            notes: 'index.html:645 pins the fullscreen prompt with toast-middle and the '
                + 'app toast at the bottom; only the two edges are offered here, because a '
                + 'middle toast is a modal that forgot to be one and #18 owns modality this '
                + 'wave. The column reverses so the newest is still nearest the pinned '
                + 'edge. Note S14 is not reproduced: Slate\'s app toast carries '
                + 'class="toast-buttom", a typo that matches no rule, so its bottom '
                + 'placement is DaisyUI\'s default arriving by accident.',
            hostStyle: STAGE,
            html: '<ui-toast anchor="container" placement="top">'
                + '<div duration="0">Profile ‘Cremina 9 bar’ uploaded.</div>'
                + '<div tone="warn" duration="0">Unable to reach the machine</div>'
                + '</ui-toast>',
        },
        {
            id: 'rich-with-actions',
            title: 'Rich content and two controls',
            notes: 'The SECOND consumer in the old tree, and the one that proves this '
                + 'surface has to take content rather than a string: index.html:645-656\'s '
                + 'fullscreen prompt carries a heading, a body line and two buttons. A '
                + 'press anywhere on a notice dismisses it (DEPARTURE 6 — Slate has no '
                + 'affordance at all, on a wall panel with no keyboard), UNLESS it lands on '
                + 'something interactive, which is what keeps "Enter Fullscreen" working. '
                + 'The "Later" button is one attribute: data-ui-toast-dismiss. Both take '
                + 'the base\'s one focus ring through ::slotted (CONVENTIONS §3a).',
            hostStyle: STAGE,
            html: '<ui-toast anchor="container">'
                + '<div duration="0">'
                + '<strong>Fullscreen Recommended</strong> '
                + '<button>Enter Fullscreen</button> '
                + '<button data-ui-toast-dismiss>Later</button>'
                + '</div>'
                + '</ui-toast>',
        },
        {
            id: 'long-message',
            title: 'A message that has to wrap',
            notes: 'DEPARTURE 2. DaisyUI authors white-space: nowrap on .toast, so a long '
                + 'message grows the column until it leaves the window — silent clipping, '
                + 'the inherited default §2.4 exists to end. Here the notice is capped at '
                + 'min(100%, --ui-measure) and wraps. Responsive behaviour has no Slate '
                + 'answer (98.4% frozen); LAYOUT_SPEC_DRAFT governs.',
            hostStyle: { ...STAGE, 'inline-size': '420px' },
            html: '<ui-toast anchor="container">'
                + '<div tone="danger" duration="0">Machine did not accept the target '
                + 'temperature, and the value shown on the rail has been corrected from '
                + 'the machine snapshot; pull a shot to confirm.</div>'
                + '</ui-toast>',
        },
        {
            id: 'narrow-container',
            title: 'In a 320px panel',
            notes: 'The container state. The layer is inset from the box it is anchored '
                + 'to, not from the window, so the same component is a panel-scoped notice '
                + 'without a second element. Nothing here reads a viewport width: there is '
                + 'no @media (width…) in the component at any level (CONVENTIONS §2).',
            hostStyle: { ...STAGE, 'inline-size': '320px' },
            html: '<ui-toast anchor="container">'
                + '<div tone="ok" duration="0">Favourite 2 cleared</div>'
                + '</ui-toast>',
        },
    ],
};

export default entry;
