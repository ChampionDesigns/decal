/**
 * ui-sheet.js — component #20 of the 57-component inventory: THE SHEET BODY.
 *
 * Wave 4, item #20 (SCOPE Part 4, "Wave 4 — dialog bodies and screen compounds",
 * SCOPE.md:1615, verbatim):
 *
 *   "| 20 | **Sheet** | Side/bottom sheet variant of the dialog contract (settings
 *    schedule editor). | small | #18, #16 |"
 *
 * and the table's own preamble (SCOPE.md:1610), which is the whole brief in one line:
 *
 *   "**Dialog bodies** (each is the content of a #18 instance, never its own modal
 *    machinery)"
 *
 * So this file contains NO dialog, no backdrop, no focus trap, no top layer, no
 * Escape handling and no `open` state. Every one of those is `<ui-dialog>`'s
 * (ui-dialog.js), which spec §4.6 built once for all seven overlays. This is the
 * thing that goes in its `body` slot: the labelled field stack the settings schedule
 * editor is made of.
 *
 * Token-only: no data layer, no store, no endpoint, no address-layer read. A field
 * stack renders what it is handed. (Wave-4 Gate 2 law is about ports and compounds
 * that read SERVER data; this one reads none, which is why `src/data/rea-address.js`
 * is absent rather than unused.)
 *
 * ---------------------------------------------------------------------------
 * WHAT SLATE HAS, AND WHERE THE PARTS GO NOW
 *
 * Slate's schedule sheet is `#add-schedule-modal` (`settings.js:2608`), styled
 * 1290 lines away in `slate-shell.css:2192-2231`. Read read-only, in full, it is:
 *
 *   .slate-sheet-box       width: min(92vw, 680px); padding: var(--slate-space-7);
 *                          border; radius; background: var(--slate-surface)
 *   .slate-sheet-title     margin: 0 0 var(--slate-space-6)
 *   .slate-sheet-body      display: flex; flex-direction: column;
 *                          gap: var(--slate-space-6)
 *   .slate-sheet-row       display: flex; flex-direction: column;
 *                          gap: var(--slate-space-3)
 *   .slate-sheet-field     width: 100%
 *   .slate-sheet-duration  display: flex; align-items: center;
 *                          gap: var(--slate-space-3)
 *   .slate-sheet-actions   display: flex; justify-content: flex-end;
 *                          gap: var(--slate-space-4);
 *                          margin-top: var(--slate-space-7)
 *
 * Four of those seven are not this component's, and saying which is the point:
 *
 *   BOX      -> #18. The card, its inset, its surface, its radius and its bound are
 *               §4.6's contract ("inline-size: min(intrinsic, 100% - 2 * space-6);
 *               max-block-size; grid-template-rows: auto minmax(0,1fr) auto"), and
 *               ui-dialog.js implements it once. A body that drew its own card would
 *               be the second card.
 *   TITLE    -> #16, through #18's `heading`. ui-sheet-header owns the title type and
 *               its bottom inset; the line under it is the dialog grid's seam
 *               (CONVENTIONS §13).
 *   ACTIONS  -> #18's `actions` slot. SEE O13 BELOW. This file has no footer, no
 *               `actions` slot and no flex-end cluster of any kind.
 *   THE REST -> here: the stack rhythm, the field rhythm, the visible label, the
 *               caption, and the one horizontal cluster ("2 hr 30 min").
 *
 * ---------------------------------------------------------------------------
 * O13 — THE ROW'S CARRIED REPAIR, AND WHY IT LANDS ON THIS FILE
 *
 * §7.7 O13 (LAYOUT_SPEC_DRAFT.md:1230): "`.slate-sheet-actions` means two different
 * things — a header cluster in the library, a dialog footer in the shell"
 * (`slate-components.css:690-695` vs `slate-shell.css:2227-2232`). #16's row states
 * the cure — "the rewrite gives the two jobs two names" (SCOPE.md:1550) — and #16
 * took the header half: its cluster is the `trail` slot. #18 took the footer half:
 * its cluster is the `actions` slot.
 *
 * The schedule sheet is the CONSUMER that made the collision expensive: it is the
 * element whose `.slate-sheet-actions` is the footer, restyling every header cluster
 * in the app because its sheet loads after the library. So the sheet is exactly where
 * the repair could be undone by accident, and this file's discipline is:
 *
 *   THE SHEET OWNS NO ACTION CLUSTER AT ALL. Cancel/Save go in the DIALOG's `actions`
 *   slot, one level out. There is no `slot[name="actions"]` in this shadow root, no
 *   `justify-content: flex-end` anywhere in it and no `margin-top: --ui-space-7` —
 *   that margin is replaced by #18's own footer inset plus the seam above it
 *   (ui-dialog.js: "The margin-top there is replaced by this cell's own inset plus
 *   the seam above it"). Two jobs, two names, and the sheet re-conflates neither.
 *
 * `test/render/ui-sheet.render.test.mjs` asserts all four halves of that.
 *
 * ---------------------------------------------------------------------------
 * "SIDE/BOTTOM SHEET VARIANT" — WHAT IS AND IS NOT BUILT TONIGHT
 *
 * The row names the variant; nothing in the corpus or the spec draws one. Slate's
 * sheet is a centred modal card (measured below), spec §4.6 gives ONE dialog skeleton
 * with no edge-attached mode, and ui-dialog.js states plainly under WHAT IS
 * DELIBERATELY NOT HERE that there is no non-modal path. An edge-attached box is
 * geometry on the DIALOG, and building it here would be the second modal machinery
 * the wave law blocks.
 *
 * So the variant is expressed the one honest way a body can express it: THE SHEET IS
 * THE NARROW DIALOG. Slate's own number is `slate-shell.css:2194`
 * `width: min(92vw, 680px)`, and `layout/settings.md` V3 proves the OPEN geometry is
 * that 680 ("the closed capture measures 612 outer / 538 inner / ~37 padding =
 * exactly 0.9 x (680 / 600 / 40) ... So the open sheet is 680 wide with 600 inner").
 * `SHEET_DIALOG_INLINE` below is that number, for a screen to set on the dialog:
 *
 *     <ui-dialog heading="Add schedule" style="--_ui-dialog-inline: 680px">
 *
 * The `92vw` half is deliberately NOT carried: it is `layout/settings.md` row 67's
 * own finding, "FLUID but **vw != canvas**", and §2.1 Rule 1 bans a component reading
 * the viewport. #18 already spells the same intent as `min(intrinsic, 100% - 2 *
 * --ui-space-6)` against its own container.
 *
 * ONE DEPARTURE, and it is the inset. Slate pads the sheet card with
 * `--slate-space-7` (40px) where every other overlay pads with 24; the rewrite has
 * one dialog and therefore one inset. MEASURED, and it is not the 24 either: 680 is
 * inside #18's one container query — §4.6's surviving real breakpoint,
 * `numpad-modal.css:411 max-width: 720px`, carried as
 * `@container (max-width: 720px) { .cell { --_ui-dialog-pad: var(--ui-space-4) } }`
 * — so a sheet dialog runs at 18px and the content measure is 680 - 36 = 644 against
 * Slate's 600. The alternative, this file re-adding an inset of its own, is a second
 * inset in the same box: the class of defect the whole overlay group is being rebuilt
 * to remove. Recorded as a deferred question (realine-run/waves/4/ledger-src/
 * 20-deferred-questions.json, question 1 — the variant below is question 2 and
 * SHEET_DIALOG_INLINE's owner is question 3; the visible half is
 * 20-expected-changes.json), and asserted in the suite so the number cannot drift
 * silently if #18's breakpoint moves.
 *
 * ---------------------------------------------------------------------------
 * MEASURED STARTING VALUES — oracle answers, quoted rather than paraphrased
 * (SCOPE Part 10 §4), from prov_query.py against slate-audit-2026-08-16/prov-baseline.
 *
 * THE LABEL. All three of the schedule sheet's labels are `.slate-microcap`:
 *
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75] font-size =
 *        15px  <-  slate-components.css  `.slate-microcap`  authored
 *        `var(--slate-text-cap)`  !important=yes  (token-driven)   = --ui-text-sm
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75] font-weight =
 *        600  <-  slate-components.css  `.slate-microcap`  authored
 *        `var(--slate-weight-semibold)`  !important=yes  (token-driven)
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75]
 *        text-transform = uppercase  <-  slate-components.css  `.slate-microcap`
 *        authored `uppercase`  !important=no  (FROZEN/hardcoded)
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75]
 *        letter-spacing = 1.8px  <-  slate-components.css  `.slate-microcap`
 *        authored `var(--slate-tracking-cap)`  !important=yes  (token-driven)
 *   CITE settings-machine-sleep---wake-schedules .slate-microcap [i=75] color =
 *        rgb(148, 161, 169)  <-  slate-components.css  `.slate-microcap`  authored
 *        `var(--slate-muted)`  !important=yes  (token-driven)      = --ui-muted
 *
 * Two of those five are already decided against the oracle UPSTREAM of this file, in
 * styles/tokens.css:368-382 — weight 600 -> 700 (three weights, not five) and
 * tracking .12em -> .04em (spec §3.5 beats the oracle, "microcaps tighten visibly").
 * type-roles.js:271-283 carries both departures with the reasoning, and this file
 * takes the label straight from the `.ui-microcap` role rather than restating any of
 * it. That is the whole point of #13 being a fragment: a label in a sheet and a label
 * on Live are the same role, declared once.
 *
 * THE RHYTHM has no oracle answer — `prov_query.py find --cls slate-sheet-body`,
 * `--cls slate-sheet-row` and `--cls slate-sheet-duration` each return "0 elements
 * matched anywhere in this corpus", whose own printed instruction is "read the Slate
 * source read-only". slate-shell.css:2205-2220 gives three gaps, and the CAPTURE
 * CORROBORATES ALL THREE at the DaisyUI closed-modal scale of 0.9
 * (`layout/settings.md` V3, `.modal-box { --tw-scale-x: .9 }`):
 *
 *   .slate-sheet-body  gap var(--slate-space-6) = 28px
 *        measured [i=76] input bottom 454 -> [i=77] label top 479  = 25px = 28 x 0.9
 *        measured [i=78] bank bottom 565 -> [i=93] label top 591   = 26px = 28 x 0.9
 *   .slate-sheet-row   gap var(--slate-space-3) = 12px
 *        measured [i=75] label bottom 385 -> [i=76] input top 396  = 11px = 12 x 0.9
 *        measured [i=93] label bottom 607 -> [i=94] input top 618  = 11px = 12 x 0.9
 *        measured [i=96] input bottom 676 -> [i=98] caption top 686 = 10px = 12 x 0.9
 *   .slate-sheet-duration gap var(--slate-space-3) = 12px
 *        measured [i=94] field right 799 -> [i=95] "hr" left 810   = 11px = 12 x 0.9
 *
 * CITE settings-machine-sleep---wake-schedules div.modal-box.slate-sheet-box [i=73]
 *      rect x=654 y=275 w=612 h=564 — the card, closed and 0.9-scaled; 612/0.9 = 680.
 * CITE settings-machine-sleep---wake-schedules .slate-heading.slate-sheet-title [i=74]
 *      rect x=691 y=312 w=538 h=33 — the title, 538/0.9 = 598 ~ the 600 inner measure.
 *
 * The geometry above is Slate at 1920x1200 and is FROZEN — quoted as what Slate does,
 * never as Decal's responsive target; LAYOUT_SPEC_DRAFT.md governs responsive
 * behaviour and the oracle has no vote there (prov_query.py's own banner).
 *
 * ---------------------------------------------------------------------------
 * THE ACCESSIBLE NAME PROBLEM, AND WHY THE FIELD IS A GROUP
 *
 * Slate's three labels name nothing. `<label class="slate-microcap">Wake Time</label>`
 * (`settings.js:2614`) carries no `for`, and the two duration labels are `<span>`s;
 * the controls beside them have no `aria-label` either. That is the same shape as
 * §7.5 T15's "four of twenty switches have no accessible name" and it is not carried.
 *
 * IT CANNOT BE FIXED WITH `for` OR `aria-labelledby` ACROSS THE SLOT. An IDREF does
 * not cross a shadow boundary — ui-sheet-header.js:277-281 hit the identical wall and
 * solved it by making the name a string in one place. Here the label element and the
 * GROUP are both in THIS shadow root, and the slotted control is a flat-tree
 * descendant of that group, so the association is made without any IDREF leaving the
 * root: the field is `role="group"` + `aria-labelledby` at its own label, and the
 * caption is `aria-describedby` on the same group.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO is write `aria-label` onto slotted light-DOM
 * elements. That is §7.6 T15's other symptom in the making — "`aria-label` on role-less
 * divs" — because the sheet cannot know whether the thing it was handed has a role to
 * hang a name on. A control keeps its own name (`<ui-text-field label="Wake Time"
 * hide-label>`); the sheet supplies the VISIBLE label and the group context. Two
 * names, one string, and the consumer decides.
 *
 * ---------------------------------------------------------------------------
 * API
 *   <ui-dialog heading="Add schedule" open style="--_ui-dialog-inline: 680px">
 *     <ui-sheet slot="body" fields='[
 *         {"name":"time","label":"Wake Time"},
 *         {"name":"days","label":"Days of Week"},
 *         {"name":"awake","label":"Keep Awake For","layout":"inline",
 *          "caption":"Duration to keep machine awake after schedule starts."}]'>
 *       <ui-text-field slot="time" label="Wake Time" hide-label></ui-text-field>
 *       <ui-bank slot="days" label="Days of week"></ui-bank>
 *       <ui-text-field slot="awake" label="Hours" hide-label></ui-text-field>
 *       <span slot="awake" class="unit">hr</span>
 *     </ui-sheet>
 *     <ui-button slot="actions">Cancel</ui-button>
 *     <ui-button slot="actions" variant="primary">Save</ui-button>
 *   </ui-dialog>
 *
 *   fields   an array, parsed from a JSON attribute so a screen — and the gallery —
 *            can state a sheet in markup, the same shape ui-tab-bar's `tabs` takes
 *            (ui-tab-bar.js:205-220). NOT a data source: a sheet renders what it is
 *            given. Each entry:
 *              name     the SLOT NAME the control is placed in. Required, unique.
 *              label    the visible microcap. Omit for a field with no label; the
 *                       group and its aria go with it.
 *              caption  explanatory copy under the control (#13's `caption` role),
 *                       announced through aria-describedby on the group.
 *              layout   "stack" (default) — control fills the row, Slate's
 *                       `.slate-sheet-field { width: 100% }`; or "inline" — a
 *                       wrapping cluster, Slate's `.slate-sheet-duration`.
 *
 *   default slot  THE TAIL: anything after the last field, for a body that ends in
 *                 something that is not a field. Content with a `slot=` naming no
 *                 field is not rendered at all, deliberately — including
 *                 `slot="actions"`, which belongs to the dialog one level out.
 *
 *   --_ui-sheet-gap        the stack rhythm, default --ui-space-6 (28px)
 *   --_ui-sheet-field-gap  the rhythm inside one field, default --ui-space-3 (12px)
 *
 * Both are on :host and not on .stack, for the reason ui-dialog.js:352-363 measured:
 * a private declared on an inner element is a private a screen cannot set.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

/**
 * The dialog inline size a sheet asks for, as a string a screen can hand to
 * `--_ui-dialog-inline`. SOURCE slate-shell.css:2194 `width: min(92vw, 680px)`, with
 * the open geometry proved from the closed capture in `layout/settings.md` V3. It is
 * exported rather than applied because the box belongs to #18 (see the header) and a
 * custom property inherits DOWN — a body cannot resize the dialog it is inside.
 */
export const SHEET_DIALOG_INLINE = '680px';

/** The two arrangements a field's control area can take. */
export const SHEET_FIELD_LAYOUTS = Object.freeze(['stack', 'inline']);

/**
 * One shape out, whatever went in — the same normalisation ui-tab-bar does for its
 * tabs (ui-tab-bar.js:184-196). A bare string is a field with that slot name and no
 * label, which is the "control only" row.
 */
function normaliseField(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        return {
            name: String(raw.name ?? index),
            label: String(raw.label ?? ''),
            caption: String(raw.caption ?? ''),
            layout: raw.layout === 'inline' ? 'inline' : 'stack',
        };
    }
    return { name: String(raw ?? index), label: '', caption: '', layout: 'stack' };
}

export class UiSheet extends UiElement {
    static properties = {
        /**
         * The fields, in order. Parsed from a JSON attribute (Lit's default Array
         * converter), so the gallery's static markup and a screen's template say the
         * same thing. Malformed JSON parses to null and renders an empty stack rather
         * than throwing — a sheet with no fields is a sheet with only its tail.
         */
        fields: { type: Array },
    };

    static styles = [typeRoles, css`
        /* ---------------------------------------------------------------
         * THE HOST KEEPS THE BASE'S BOX. Unlike #18 (display: contents, because a
         * top-layer dialog's geometry comes from the viewport), a sheet body is an
         * ordinary block inside the dialog's body cell: it fills the cell's inline
         * size, and it is a container so a field can read ITS OWN box rather than the
         * window (§2.1 Rule 1). Both come from base.js and are not restated here.
         *
         * THE TWO KNOBS, on :host for the reason ui-dialog.js:352-363 measured: a
         * private declared on .stack would be a private a screen cannot set, because
         * a declaration on the element that USES a custom property beats the value
         * inherited from outside.
         * ------------------------------------------------------------- */
        :host {
            --_ui-sheet-gap: var(--ui-space-6);
            --_ui-sheet-field-gap: var(--ui-space-3);
        }

        /* ---------------------------------------------------------------
         * THE STACK.
         * SOURCE slate-shell.css:2205-2209 .slate-sheet-body { display: flex;
         * flex-direction: column; gap: var(--slate-space-6) } — corroborated by the
         * capture at 0.9 scale, twice (see the header's RHYTHM block).
         *
         * NO PADDING, NO SURFACE, NO RADIUS, NO BORDER. The card is #18's cell, which
         * already paints --ui-surface, insets by --_ui-dialog-pad and rounds its
         * corners; a body that repainted any of them would be the second card in the
         * same box (and, on the corners, the second radius that has to agree).
         *
         * NO overflow DECLARATION EITHER, and that is load-bearing twice over. The
         * dialog's body cell is the ONE scrollport in a dialog — §4.6's "body 1fr
         * overflow-y: auto <- mandatory", with its floor and its order of surrender
         * on ui-dialog.js's .body. A second scrollport here would give a short dialog
         * two scrollbars and one of them would be the wrong one. And an overflow
         * other than visible on this stack would clip the outset focus ring of every
         * control in it, which is bug L24's whole class.
         * ------------------------------------------------------------- */
        .stack {
            display: flex;
            flex-direction: column;
            gap: var(--_ui-sheet-gap);

            /* A flex item's automatic minimum size is its content, so a long
             * unbreakable value in one field would push the whole stack wider than
             * the dialog rather than shrinking. Same reason ui-sheet-header sets it
             * on the title. */
            min-inline-size: 0;
        }

        /* ---------------------------------------------------------------
         * ONE FIELD: label, control, caption.
         * SOURCE slate-shell.css:2210-2214 .slate-sheet-row { display: flex;
         * flex-direction: column; gap: var(--slate-space-3) } — corroborated three
         * times in the capture.
         *
         * The gap does the spacing, so nothing here carries a margin: the label is a
         * span (no UA margin) and the caption is #13's .ui-caption, which already
         * zeroes its own. One rhythm, one owner.
         * ------------------------------------------------------------- */
        .field {
            display: flex;
            flex-direction: column;
            gap: var(--_ui-sheet-field-gap);
            min-inline-size: 0;
        }

        /* ---------------------------------------------------------------
         * THE CONTROL AREA. A block by default, so a slotted control fills the row —
         * SOURCE slate-shell.css:2215-2217 .slate-sheet-field { width: 100% },
         * which under Shadow DOM is the container's job rather than a rule reaching
         * into the control (a ::slotted width would fight the control's own).
         *
         * A <slot> is display: contents, so the assigned elements are laid out by
         * THIS box, which is what makes both arrangements work without touching the
         * slotted elements at all.
         * ------------------------------------------------------------- */
        .control {
            min-inline-size: 0;
        }

        /* THE HORIZONTAL CLUSTER — Slate's duration row ("2 hr 30 min").
         * SOURCE slate-shell.css:2218-2222 .slate-sheet-duration { display: flex;
         * align-items: center; gap: var(--slate-space-3) }, measured 11px at 0.9.
         *
         * flex-wrap is the departure, and it is the same call #18's footer made: two
         * fields and two unit words in a 320px container is a real arrangement, and
         * the alternative is a cluster that overflows its own dialog. The container
         * decides, not a width query.
         *
         * THE FIELD WIDTHS ARE NOT HERE. Slate sets them one selector deeper —
         * .slate-sheet-duration .slate-field { width: 120px }, slate-shell.css:2224,
         * layout/settings.md row 70 "TOKENISABLE" — and that is a declaration about
         * a CONTROL, which now owns its own size. One number, one owner: the consumer
         * writes it on its field, and this file cannot silently disagree. */
        .control-inline {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--_ui-sheet-field-gap);
        }

        /* The caption's measure is #13's --ui-measure; nothing is restated. The one
         * addition is the flex minimum again, so a long caption wraps inside the
         * field instead of setting the stack's width. */
        .caption {
            min-inline-size: 0;
        }
    `];

    constructor() {
        super();
        this.fields = [];
    }

    /** Normalised, in render order. Never null: a malformed attribute renders empty. */
    get #fields() {
        return (Array.isArray(this.fields) ? this.fields : []).map(normaliseField);
    }

    /**
     * INDEX-KEYED IDS, not name-keyed. The ids exist for aria-labelledby and for the
     * suite to query (CONVENTIONS §9: ids for querying, classes for the cascade), and
     * a consumer's field name is arbitrary text — two fields called the same thing, or
     * a name with a space in it, would produce a duplicate or invalid id and a silently
     * mis-associated label. The SLOT name is the consumer's string; the id is ours.
     */
    #field(field, index) {
        const labelId = `lbl-${index}`;
        const captionId = `cap-${index}`;
        const named = field.label !== '';
        const described = named && field.caption !== '';

        return html`
            <div
                class="field"
                id="field-${index}"
                data-name=${field.name}
                role=${named ? 'group' : nothing}
                aria-labelledby=${named ? labelId : nothing}
                aria-describedby=${described ? captionId : nothing}
            >
                ${named
                    ? html`<span class="ui-microcap label" id=${labelId}>${field.label}</span>`
                    : nothing}
                <div class="control ${field.layout === 'inline' ? 'control-inline' : ''}"
                     id="control-${index}">
                    <slot name=${field.name}></slot>
                </div>
                ${field.caption !== ''
                    ? html`<p class="ui-caption caption" id=${captionId}>${field.caption}</p>`
                    : nothing}
            </div>
        `;
    }

    render() {
        /* THE TAIL SLOT IS LAST AND UNNAMED. It is the escape hatch for a body that
         * ends in something that is not a field; it is deliberately not first and not
         * interleaved, because a default slot that could appear anywhere in the order
         * is a second layout system nobody can read from the markup.
         *
         * AND IT CANNOT SWALLOW A FOOTER: an element carrying slot="actions" matches
         * no slot in this root — not the named field slots, and not the default slot,
         * which only takes nodes with no slot attribute — so it renders nowhere.
         * O13's repair survives a consumer that puts the buttons in the wrong element:
         * they disappear rather than quietly becoming a second footer inside the body.
         * Asserted in the suite. */
        return html`
            <div class="stack" id="stack">
                ${this.#fields.map((field, index) => this.#field(field, index))}
                <slot></slot>
            </div>
        `;
    }
}

customElements.define('ui-sheet', UiSheet);
