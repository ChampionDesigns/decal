/**
 * The gallery entry for.
 */

const LEAF_OPEN = '<div style="display:grid; gap:var(--ui-seam); background:var(--ui-line)">';
const LEAF_CLOSE = '</div>';

const T13_RULE = `
<style>
    .t13-leaf .content-stretch.flex.items-center.justify-between,
    .t13-leaf [data-settings-row] {
        box-sizing: border-box;
        min-height: var(--ui-control-h);
        padding-block: var(--ui-space-3);
        gap: var(--ui-space-5);
    }
    .t13-mark { outline: 1px dashed var(--ui-steel); }
</style>`;

export const entry = {
    id: 'ui-settings-row',
    title: 'Settings row',
    module: './entries/ui-settings-row.demo.js',
    notes:
        'Component #29: the label block (heading + optional range hint + optional live '
        + 'reading + optional caption) with one control slot on the right. This ONE '
        + 'primitive covers ~30 of Settings\' 37 leaves (spec §4.4). Slate has the same '
        + 'anatomy - slate-shell.css:1293-1296, min-height 64 / padding-block 12 / gap 24 '
        + '- but attaches it to a CLASS SHAPE, and line 1292\'s explicit opt-in '
        + '[data-settings-row] is used by exactly zero elements. The Brightness leaf then '
        + 'wraps its page title in that shape (settings.js:2391) and its header lands 12px '
        + 'lower than the other 36 (T13, measured y=193 against y=181). Here a row is a '
        + 'TAG, so the shape means nothing - see the t13 state.',
    states: [
        {
            id: 'resting',
            title: 'Heading, caption, control',
            notes:
                'The commonest of the ~30 leaves. Heading is the .ui-heading type role '
                + '(20px / 500 / --ui-text, measured on .slate-heading), caption is '
                + '.ui-caption (16px / 400 / --ui-muted, measured on .slate-caption), and '
                + 'the 4px between them is Slate\'s own gap-[4px]. The row floors at '
                + '--ui-control-h (64px) with --ui-space-3 above and below.',
            html: `${LEAF_OPEN}
                <ui-settings-row heading="Enable cup warmer"
                                 caption="Warm your cups on the top plate">
                    <ui-switch checked></ui-switch>
                </ui-settings-row>${LEAF_CLOSE}`,
        },
        {
            id: 'leaf',
            title: 'A leaf, with the seam between rows',
            notes:
                'Six rows in a 1px grid gap over --ui-line. The divider is the GAP, so N '
                + 'rows give N-1 seams with no sibling selector and no <hr> elements - '
                + 'Slate ships 43 of those plus 5 rows drawing their own border-top '
                + '(CONVENTIONS §13). Every row here is the same component, which is what '
                + '"one padding, one gap vocabulary" means (SCOPE L2293).',
            html: `${LEAF_OPEN}
                <ui-settings-row heading="Enable cup warmer"
                                 caption="Warm your cups on the top plate">
                    <ui-switch checked></ui-switch>
                </ui-settings-row>
                <ui-settings-row heading="Target temperature" hint="30-80 °C">
                    <ui-stepper unit="°C" value="70"></ui-stepper>
                </ui-settings-row>
                <ui-settings-row heading="Current temperature"
                                 caption="Live temperature of the cup-warming plate"
                                 reading="38.5 °C"></ui-settings-row>
                <ui-settings-row heading="Measurement units">
                    <ui-select label="Measurement units"
                               options='["Metric","Imperial"]'></ui-select>
                </ui-settings-row>
                <ui-settings-row heading="On disconnect"
                                 caption="What the screen does when the machine goes away">
                    <ui-bank label="On disconnect" value="Disconnect"
                             items='["Nothing","Display Off","Disconnect"]'></ui-bank>
                </ui-settings-row>
                <ui-settings-row heading="Charging log">
                    <ui-button label="Open the charger log">Open</ui-button>
                </ui-settings-row>${LEAF_CLOSE}`,
        },
        {
            id: 'archetypes',
            title: 'The five control archetypes in one primitive',
            notes:
                'Stepper (#4), switch (#5), segmented bank (#3), select (#7), button (#1) '
                + '- the row\'s five declared dependencies, all in the same slot. The row '
                + 'imports none of them: it owns the label block and the space, and the '
                + 'control track is flex: none so a control holds its stated size '
                + '(T9/T10). The first four take their accessible name from their ROW, '
                + 'which is the cross-root replacement for Slate\'s aria-labelledby (T15: '
                + '"four of twenty switches have no accessible name"). The Start button '
                + 'does NOT: a control with visible text keeps it, or it would be operable '
                + 'by voice only under a phrase that does not appear on it.',
            html: `${LEAF_OPEN}
                <ui-settings-row heading="Temperature for flush cycles" hint="5-95 °C">
                    <ui-stepper unit="°C" value="80"></ui-stepper>
                </ui-settings-row>
                <ui-settings-row heading="Enable presence detection">
                    <ui-switch checked></ui-switch>
                </ui-settings-row>
                <ui-settings-row heading="Temperature unit">
                    <ui-bank value="Celsius" items='["Celsius","Fahrenheit"]'></ui-bank>
                </ui-settings-row>
                <ui-settings-row heading="Log level">
                    <ui-select options='["Errors","Warnings","Everything"]'></ui-select>
                </ui-settings-row>
                <ui-settings-row heading="Descale the machine"
                                 caption="Runs the full cycle; takes about twenty minutes">
                    <ui-button>Start</ui-button>
                </ui-settings-row>${LEAF_CLOSE}`,
        },
        {
            id: 'reading-and-absence',
            title: 'A live reading, present and absent',
            notes:
                'The reading is a READING from src/data/reading.js: present it renders, '
                + 'absent it renders the dash. There is no `?? compute` in the component '
                + '(A7) - an absent reading never becomes a zero and never becomes "NaN". '
                + 'Its type is the one thing the row declares itself, because 18px at '
                + 'weight 500 is not one of the six roles (measured on '
                + '#cupWarmerCurrentTemp). Spec §4.4 puts the reading in the LABEL BLOCK; '
                + 'Slate puts it on the right, where the control goes.',
            html: `${LEAF_OPEN}
                <ui-settings-row heading="Current temperature"
                                 caption="Live temperature of the cup-warming plate"
                                 reading="38.5 °C"></ui-settings-row>
                <ui-settings-row heading="Group head"
                                 caption="No frame has carried this channel yet"
                                 reading=""></ui-settings-row>
                <ui-settings-row heading="Charger output" reading="On">
                    <ui-switch checked></ui-switch>
                </ui-settings-row>${LEAF_CLOSE}`,
        },
        {
            id: 't13',
            title: 'T13 — the 12px, live and unreachable',
            notes:
                'The rule that CAUSES T13 is live in this state: slate-shell.css:1290-1297 '
                + 'verbatim, matching on the class shape. The DASHED box is '
                + 'settings.js:2391 reproduced byte-for-byte - a leaf title wrapped in the '
                + 'row primitive\'s four classes - and it is displaced by exactly the 12px '
                + 'the audit measured (y=193 against y=181, = --slate-space-3). The two '
                + 'rows below it are unmoved, and the SECOND ONE WEARS THE SAME FOUR '
                + 'CLASSES: their heading lives in a shadow root, and no selector outside '
                + 'one reaches into it. A row is a tag; a class shape is decoration.',
            html: `${T13_RULE}
                <div class="t13-leaf" style="display:grid; gap:var(--ui-seam); background:var(--ui-line)">
                    <div class="t13-mark content-stretch flex items-center justify-between relative w-full"
                         style="background:var(--ui-fascia)">
                        <div class="w-full">
                            <p class="ui-title" style="margin:0">Screen Brightness</p>
                        </div>
                    </div>
                    <ui-settings-row heading="Enable cup warmer"
                                     caption="A row that does not wear the class shape">
                        <ui-switch checked></ui-switch>
                    </ui-settings-row>
                    <ui-settings-row class="content-stretch flex items-center justify-between relative w-full"
                                     heading="Enable cup warmer"
                                     caption="A row that DOES wear it — same to the pixel">
                        <ui-switch checked></ui-switch>
                    </ui-settings-row>
                </div>`,
        },
        {
            id: 'narrow',
            title: 'In a 380px container',
            notes:
                'The control keeps its stated size and the ROW wraps - the label block '
                + 'carries a floor (spec §2.3 case 4, where a minimum on a flex track is '
                + 'REQUIRED) and the control track is flex: none, so the control drops to '
                + 'its own line rather than being crushed. That is T9/T10 read forwards. '
                + 'There is no @container query and no @media (width...) anywhere in the '
                + 'component: the wrap is intrinsic, so it has no threshold to be wrong at.',
            hostStyle: { 'inline-size': '380px' },
            html: `${LEAF_OPEN}
                <ui-settings-row heading="Temperature for flush cycles" hint="5-95 °C"
                                 caption="Applies to every flush the machine runs on its own">
                    <ui-stepper unit="°C" value="80"></ui-stepper>
                </ui-settings-row>
                <ui-settings-row heading="Enable cup warmer"
                                 caption="Warm your cups on the top plate">
                    <ui-switch checked></ui-switch>
                </ui-settings-row>${LEAF_CLOSE}`,
        },
    ],
};

export default entry;
