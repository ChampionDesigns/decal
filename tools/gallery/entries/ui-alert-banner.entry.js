/**
 * ui-alert-banner.entry.js - the gallery entry for component #49 (wave 1, item #49).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 1 runs sixteen builders in parallel
 * under a whole-file-write rule, so sixteen appends to one array clobber each other.
 * Each builder owns one file here and the wave's GATE agent wires them into
 * entries.js once, serially:
 *
 *     import { entry as uiAlertBanner } from './entries/ui-alert-banner.entry.js';
 *     export const entries = [ ...existing, uiAlertBanner ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js does
 * the import(entry.module), so the specifier resolves against gallery.js wherever the
 * entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-alert-banner--<state>`): identifiers, not
 * labels. A rename is a re-baseline.
 */

export const entry = {
    id: 'ui-alert-banner',
    title: 'Alert banner',
    module: '../../src/components/ui-alert-banner.js',
    notes:
        'Component #49 (spec §5.2 #49, slate-live.css:2028-2038): the strip that says '
        + 'the machine has stopped being usable, and the surface a profile refusal '
        + 'lands on once ReaPrime can report one (B9 / R7, SCOPE.md:1861-1865). It '
        + 'takes a message and knows nothing else - no message table, no severity '
        + 'variants, no endpoint. Slate paints it as an absolute overlay over the '
        + 'display band; the rewrite lays it out in flow (SCOPE.md:1530, spec §4.1 '
        + '"One grid. No absolutely-positioned structure."), and the last state below '
        + 'shows the overlay is still one rule away for whoever wants it.',
    states: [
        {
            id: 'default',
            title: 'Headline and remedy',
            notes:
                'The measured treatment: --ui-fascia ground (oracle rgb(14, 19, 23) '
                + 'dark / rgb(242, 243, 243) light), headline --ui-display-xl in '
                + '--ui-status-danger at --ui-weight-medium, remedy --ui-text-lg in '
                + '--ui-text-2, --ui-space-1 between them. The words are Slate\'s own '
                + 'disconnected alert (ui.js:3515).',
            hostStyle: { 'inline-size': '860px' },
            html:
                '<ui-alert-banner>Disconnected'
                + '<span slot="remedy">Check the machine is powered on and paired.</span>'
                + '</ui-alert-banner>',
        },
        {
            id: 'slate-width',
            title: 'At Slate\'s frozen 1375px',
            notes:
                'The oracle\'s own box - find --cls slate-live-alert returns 1375 x 130 '
                + 'in all three states that carry it. At this container width '
                + '--ui-display-xl (clamp(38px, 4.2cqi, 52px)) returns 4.2cqi = 57.75px '
                + 'and clamps to 52px, which is the measured font-size exactly. This is '
                + 'the port checking itself against the oracle, not a layout target.',
            hostStyle: { 'inline-size': '1375px' },
            html:
                '<ui-alert-banner>Disconnected'
                + '<span slot="remedy">Check the machine is powered on and paired.</span>'
                + '</ui-alert-banner>',
        },
        {
            id: 'headline-only',
            title: 'Headline only (the refusal shape)',
            notes:
                'DEPARTURE 3: a part with nothing slotted into it collapses, gap and '
                + 'all. This is the shape a machine-side refusal arrives in before R7 '
                + 'can say which step type was rejected (SCOPE.md:3182) - one line, '
                + 'deliberate rather than truncated.',
            hostStyle: { 'inline-size': '860px' },
            html: '<ui-alert-banner>Profile refused</ui-alert-banner>',
        },
        {
            id: 'three-alerts',
            title: 'Slate\'s three alert kinds, one treatment',
            notes:
                'ui.js:3514-3518 - disconnected, error, needsWater. All three paint '
                + 'identically in Slate and all three paint identically here: no '
                + 'severity variants, no tone attribute, no 17th item. "Only three '
                + 'states qualify: the machine is unreachable, it has faulted, or it '
                + 'needs water" (ui.js:3506-3512) is the SCREEN\'s rule, not this '
                + 'component\'s.',
            hostStyle: { 'inline-size': '860px' },
            html:
                '<div style="display:flex; flex-direction:column; gap:12px">'
                + '<ui-alert-banner>Disconnected<span slot="remedy">Check the machine is powered on and paired.</span></ui-alert-banner>'
                + '<ui-alert-banner>Machine error<span slot="remedy">Switch the machine off at the wall, wait ten seconds, switch it on.</span></ui-alert-banner>'
                + '<ui-alert-banner>Needs water<span slot="remedy">Refill the tank; the machine will resume by itself.</span></ui-alert-banner>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 320px container',
            notes:
                'The banner reads its own container and nothing else. --ui-display-xl '
                + 'shrinks through its clamp to the 38px floor (spec §4.1: "Display '
                + 'type shrinks via its clamp()"), the 28px inline inset and the 18px '
                + 'block inset are physical tokens and do not, and the long words wrap '
                + 'rather than leaving the strip. The oracle has no vote here - Slate '
                + 'is frozen at 1920x1200.',
            hostStyle: { 'inline-size': '320px' },
            html:
                '<ui-alert-banner>Needs water'
                + '<span slot="remedy">Refill the tank; the machine will resume by itself.</span>'
                + '</ui-alert-banner>',
        },
        {
            id: 'as-overlay',
            title: 'Placed as Slate places it',
            notes:
                'DEPARTURE 1 shown from the other side: the component sets no position, '
                + 'so a screen that wants slate-live.css:2029-2031 back writes it on the '
                + 'host and the banner fills the box (min-block-size: 100%) and centres '
                + 'its content. The stand-in below is the display band it covers.',
            hostStyle: { 'inline-size': '860px' },
            html:
                '<div style="position:relative; block-size:130px; padding:0 28px; '
                + 'display:flex; align-items:center; gap:48px; '
                + 'background:var(--ui-surface); color:var(--ui-muted)">'
                + '<span style="font-size:var(--ui-display-md)">0.0 s</span>'
                + '<span style="font-size:var(--ui-display-md)">0.0 bar</span>'
                + '<span style="font-size:var(--ui-display-md)">0.0 mL/s</span>'
                + '<ui-alert-banner style="position:absolute; inset:0">Disconnected'
                + '<span slot="remedy">Check the machine is powered on and paired.</span>'
                + '</ui-alert-banner>'
                + '</div>',
        },
    ],
};

export default entry;
