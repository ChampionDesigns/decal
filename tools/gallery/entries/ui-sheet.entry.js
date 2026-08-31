/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-sheet',
    title: 'Sheet body',
    module: './entries/ui-sheet.demo.js',
    notes:
        'Component #20: the labelled field stack a #18 dialog wears as '
        + 'its body — the settings schedule editor. It owns two rhythms and nothing '
        + 'else: 28px (--ui-space-6) between fields, 12px (--ui-space-3) inside one, '
        + 'read from the old sheet and corroborated six times in the '
        + 'capture at the DaisyUI closed scale of 0.9. The card, the title and the '
        + 'footer are #18 and #16; the label is #13\'s microcap role; the controls are '
        + 'whatever the consumer slots in. A labelled field is a real aria group named '
        + 'by its own label — an IDREF cannot cross the slot, so the group and the '
        + 'label are both in the shadow root and the control is a flat-tree descendant '
        + 'of the group. The reference skin\'s three labels name nothing at all.',
    states: [
        {
            id: 'schedule-editor',
            title: 'The whole thing — sheet body inside a #18 dialog',
            notes:
                'The reference skin\'s #add-schedule-modal, rebuilt as composition. '
                + 'ORACLE settings-machine-sleep---wake-schedules div.modal-box.slate-sheet-box '
                + '[i=73] rect 612x564 closed at 0.9 scale; layout/settings.md V3 proves the '
                + 'open card is 680 wide. The dialog is asked for exactly that with '
                + '--_ui-dialog-inline: 680px — which is INSIDE #18\'s one container query '
                + '(§4.6\'s surviving breakpoint, max-width: 720px), so '
                + 'the cell inset is --ui-space-4 and the body measure is 644, against '
                + 'the reference skin\'s 600 under a 40px sheet-only padding. One dialog, one inset. '
                + 'The Days of Week row is a #3 bank: single-select as #3 ships today, and '
                + 'the seven-day MULTI-select is #3\'s contract to add (findings-digest '
                + '"compose instead of copy", .slate-day-toggle -> .slate-bank-item), not '
                + 'this component\'s — the sheet supplies the labelled group, never the '
                + 'control.',
            html: `
<ui-dialog id="d" open heading="Add schedule" style="--_ui-dialog-inline: 680px">
  <ui-sheet slot="body" fields='[
      {"name":"time","label":"Wake Time"},
      {"name":"days","label":"Days of Week"},
      {"name":"awake","label":"Keep Awake For","layout":"inline",
       "caption":"Duration to keep machine awake after schedule starts."}]'>
    <ui-text-field slot="time" label="Wake Time" hide-label value="05:30"></ui-text-field>
    <ui-bank slot="days" label="Days of week" value="Mon"
             items='["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'></ui-bank>
    <ui-text-field slot="awake" label="Hours" hide-label value="1"
                   align="center" style="inline-size: 120px"></ui-text-field>
    <span slot="awake">hr</span>
    <ui-text-field slot="awake" label="Minutes" hide-label value="00"
                   align="center" style="inline-size: 120px"></ui-text-field>
    <span slot="awake">min</span>
  </ui-sheet>
  <ui-button slot="actions">Cancel</ui-button>
  <ui-button slot="actions" variant="primary">Save</ui-button>
</ui-dialog>`,
        },
        {
            id: 'field-stack',
            title: 'The body alone, at its own measure',
            notes:
                'The same stack out of the dialog, at the 644px measure a 680px sheet '
                + 'dialog gives it. This is what the component actually is: two gaps, a '
                + 'microcap, a caption and three slots. No surface, no radius, no border, '
                + 'no padding and no overflow — every one of those is the dialog cell\'s, '
                + 'and a body that repainted them would be the second card in one box.',
            hostStyle: { 'inline-size': '644px' },
            html: `
<ui-sheet fields='[
    {"name":"time","label":"Wake Time"},
    {"name":"days","label":"Days of Week"},
    {"name":"awake","label":"Keep Awake For","layout":"inline",
     "caption":"Duration to keep machine awake after schedule starts."}]'>
  <ui-text-field slot="time" label="Wake Time" hide-label value="05:30"></ui-text-field>
  <ui-bank slot="days" label="Days of week" value="Mon"
           items='["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'></ui-bank>
  <ui-text-field slot="awake" label="Hours" hide-label value="1"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">hr</span>
  <ui-text-field slot="awake" label="Minutes" hide-label value="00"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">min</span>
</ui-sheet>`,
        },
        {
            id: 'inline-cluster',
            title: 'The one horizontal arrangement',
            notes:
                'The old duration row: display: flex; '
                + 'align-items: center; gap: var(--slate-space-3) }, measured 11px between '
                + '[i=94] and [i=95] at 0.9 scale. The 120px field width is NOT here: the reference skin '
                + 'sets it one selector deeper (:2224, layout/settings.md row 70), and that '
                + 'is a declaration about a control, which now owns its own size. One '
                + 'number, one owner.',
            hostStyle: { 'inline-size': '440px' },
            html: `
<ui-sheet fields='[
    {"name":"awake","label":"Keep Awake For","layout":"inline",
     "caption":"Duration to keep machine awake after schedule starts."}]'>
  <ui-text-field slot="awake" label="Hours" hide-label value="1"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">hr</span>
  <ui-text-field slot="awake" label="Minutes" hide-label value="30"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">min</span>
</ui-sheet>`,
        },
        {
            id: 'unlabelled-and-tail',
            title: 'A field with no label, and the tail slot',
            notes:
                'A field whose label is omitted is not an empty group: the role, the '
                + 'aria-labelledby and the label element all go with it, because a group '
                + 'announcing nothing is worse than no group. The default slot is the TAIL '
                + '— anything after the last field, for a body that does not end in one. '
                + 'Content carrying a slot name no field answers to renders nowhere at all, '
                + 'slot="actions" included: the footer belongs to the dialog.',
            hostStyle: { 'inline-size': '644px' },
            html: `
<ui-sheet fields='[
    {"name":"bare"},
    {"name":"named","label":"Repeat weekly"}]'>
  <ui-text-field slot="bare" label="Schedule name" hide-label
                 value="Morning"></ui-text-field>
  <ui-bank slot="named" label="Repeat weekly" value="On" items='["Off","On"]'></ui-bank>
  <p class="tail" style="margin: 0; opacity: .75">
    Schedules run while the machine is on standby.
  </p>
  <ui-button slot="actions">This button is not rendered — the footer is the dialog's</ui-button>
</ui-sheet>`,
        },
        {
            id: 'narrow',
            title: 'A 320px container — the cluster wraps, the rhythm does not move',
            notes:
                'The component reads its own container and never the viewport (§2.1 Rule '
                + '1); there is no width query anywhere in it, so the only thing a narrow '
                + 'container changes is the wrap. The gaps at 320px are the gaps at 644px. '
                + 'the reference skin\'s sheet cannot do this: it sizes the card with '
                + 'min(92vw, 680px) — "FLUID but vw != canvas" (layout/settings.md row 67) '
                + '— and its duration row has no wrap at all.',
            hostStyle: { 'inline-size': '320px' },
            html: `
<ui-sheet fields='[
    {"name":"time","label":"Wake Time"},
    {"name":"awake","label":"Keep Awake For","layout":"inline",
     "caption":"Duration to keep machine awake after schedule starts."}]'>
  <ui-text-field slot="time" label="Wake Time" hide-label value="05:30"></ui-text-field>
  <ui-text-field slot="awake" label="Hours" hide-label value="1"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">hr</span>
  <ui-text-field slot="awake" label="Minutes" hide-label value="30"
                 align="center" style="inline-size: 120px"></ui-text-field>
  <span slot="awake">min</span>
</ui-sheet>`,
        },
    ],
};

export default entry;
