/**
 * ui-badge.js - component #12 of the 57-component inventory: THE SMALL STATUS MARKER.
 *
 * Wave 1, item #12 (SCOPE Part 4, "Wave 1 - primitives", L1523). Token-only: no data
 * layer, no ReaPrime, no endpoint. The text, the count and the choice of variant all
 * arrive from outside; this element owns paint and nothing else.
 *
 * WHAT THE ROW SAYS, verbatim
 *   spec §5.1 #12: "Badge (+ active, attention) | 9/2/1 uses" - and SCOPE L1523:
 *   "Small status marker on rows and headers." size small, depends on: tokens.
 *   Wave 2 #26 (List row) is the downstream consumer: "Title + provenance badge +
 *   favourite disc + overflow affordance" (SCOPE L1545, depends on #1, #12).
 *
 * ROW #12 CITES NO BUG ID, AND THAT IS A MEASURED FACT, not an omission: grepping
 * LAYOUT_SPEC_DRAFT.md for "badge" returns §3 (--ui-control-sm's consumer list),
 * §4.6's prose and the §5.1 row itself - nothing in §7's 140 layout bugs. The
 * disqualification check (Part 10 §4) therefore clears the oracle for every
 * appearance value below. Responsive behaviour is still disqualified - Slate is
 * frozen at 1920x1200 - and is marked as such where it comes up.
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (prov_query.py themes, against prov-baseline (dark) and prov-light.)
 *
 *   DEFAULT (.slate-badge), a folder count on the profile selector:
 *     CITE profile-selector .slate-badge [i=20] background-color: dark rgb(40, 49, 57)
 *          / light rgb(227, 231, 233) <- slate-components.css `.slate-badge`
 *          authored (NOT CAPTURED - set via a CSS shorthand) !important=no (token-driven)
 *          [the shorthand is slate-components.css:702 `background: var(--slate-key-on)`,
 *           read read-only from the Slate source because the corpus cannot name a
 *           token behind a shorthand; the two computed values ARE --ui-key-on's two
 *           theme values, styles/tokens.css:723 #e3e7e9 / :844 #283139]
 *     CITE profile-selector .slate-badge [i=20] color: dark rgb(186, 196, 202)
 *          / light rgb(63, 71, 76) <- slate-components.css `.slate-badge`
 *          authored `var(--slate-text-2)` !important=no (token-driven)
 *     CITE profile-selector .slate-badge [i=20] border-top-left-radius = 6px  (= --ui-radius)
 *     CITE profile-selector .slate-badge [i=20] padding-left = 8px            (= --ui-space-2)
 *     CITE profile-selector .slate-badge [i=20] font-size = 14px
 *     CITE profile-selector .slate-badge [i=20] font-weight = 500             (= --ui-weight-medium)
 *     CITE profile-selector .slate-badge [i=20] letter-spacing = normal
 *     CITE profile-selector .slate-badge [i=20] text-transform = none
 *     CITE profile-selector .slate-badge [i=20] box-shadow = none
 *     CITE profile-selector .slate-badge [i=20] border-top-width = 0px
 *     CITE profile-selector .slate-badge [i=20] height = 21px, min-height = auto
 *          <- (no declaration - inherited or initial value) - so 21px IS the line box
 *          of 14px Geist: 14 x 1.5, the leading Slate inherits from Tailwind's
 *          preflight (`html, :host { line-height: 1.5 }`, output.css:53-54, read
 *          read-only because a DOCUMENT-layer declaration is outside the corpus's
 *          per-element surface). Decal's document layer declares no leading at all
 *          - `grep -n "line-height\|leading" styles/document.css styles/tokens.css`
 *          returns zero hits - so a badge that declares none renders at the UA's
 *          `normal`, which is 18px for 14px Geist and misses the frozen record by 3.
 *          The ratio is therefore carried on .badge; see LEADING below.
 *
 *   ACTIVE (.slate-badge-active), the active skin card's marker:
 *     CITE settings-display-skin .slate-badge [i=90] background-color: dark rgb(23, 59, 77)
 *          / light rgb(35, 79, 99) <- slate-components.css `.slate-badge-active`
 *          authored (NOT CAPTURED - shorthand) !important=no (token-driven)
 *          [= --ui-primary, tokens.css:752 #234f63 / :859 #173b4d]
 *     CITE settings-display-skin .slate-badge [i=90] color: dark rgb(246, 251, 253)
 *          / light rgb(248, 252, 253) <- slate-components.css `.slate-badge-active`
 *          authored `var(--slate-on-primary)` !important=no (token-driven)
 *     CITE settings-display-skin .slate-badge [i=90] font-weight = 600
 *     CITE settings-display-skin .slate-badge [i=90] letter-spacing = 1.68px
 *     CITE settings-display-skin .slate-badge [i=90] text-transform = uppercase
 *
 *   ATTENTION (.slate-badge-attention), "Update available" on the skin list:
 *     CITE settings-display-skin .slate-badge [i=52] background-color:
 *          dark color(srgb 0.898039 0.647059 0.054902 / 0.18)
 *          / light color(srgb 0.588235 0.329412 0 / 0.18)
 *          <- slate-components.css `.slate-badge-attention` authored (NOT CAPTURED -
 *          shorthand) !important=no (token-driven)  [the shorthand is
 *          slate-components.css:770 `background: color-mix(in srgb, var(--slate-power)
 *          18%, transparent)`, carried below as Slate's own arithmetic]
 *     CITE settings-display-skin .slate-badge [i=52] color: dark rgb(229, 165, 14)
 *          / light rgb(150, 84, 0) <- slate-components.css `.slate-badge-attention`
 *          authored `var(--slate-power)` !important=no (token-driven)
 *          [= --ui-tint-power, tokens.css:776 #965400 / :868 #e5a50e - exact, both themes]
 *     CITE settings-display-skin .slate-badge [i=52] font-weight = 600
 *
 * WHY BOTH STATES EXIST AT ALL, in Slate's own words (slate-components.css:758-760):
 *   "Badge states. A badge that says the same thing on every row says nothing, so
 *    these two exist precisely because they are exceptional: one marks the single
 *    active item, the other the single item that needs attention (P15)."
 *
 * DELIBERATE DEPARTURES, each recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-badge; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to. Each is ALSO asserted as a
 * departure in test/render/ui-badge.render.test.mjs, which is the copy a gate can run
 * rather than read:
 *   1. WEIGHT 600 -> 700 on active and attention — REVERSED AT PARITY SURFACE 1, and
 *      the token layer decided that too. Slate reads --slate-weight-semibold (600) and
 *      Decal now ships it: styles/tokens.css carries Slate's four weights again after
 *      LAYOUT_SPEC_DRAFT §3.5's three-weight line was found to be refuted by its own
 *      citation (slate-tokens.css:148-153 declares four). This component is two of the
 *      ~50 elements and renders the oracle's own 600.
 *   2. TRACKING 1.68px -> 0.56px on active. --slate-tracking-cap is .12em; spec §3.5
 *      proposed .04em and the token sheet adopted it. REVERSED at parity surface 0:
 *      the spec writes ".04em" while citing the slate-tokens.css lines that declare
 *      .12em, so its own citation refutes it. The marker tracks Slate's 1.68px at
 *      14px again, and this is no longer a departure.
 *   3. FONT SIZE reads --ui-text-2xs, not --ui-text-sm. Slate authored
 *      var(--slate-text-sm) = 14px "column headers, units" (slate-tokens.css:129).
 *      Decal re-cut the scale: --ui-text-2xs is 14px with that same comment
 *      (tokens.css:351) and --ui-text-sm is a NEW 15px step for uppercase microcaps.
 *      --ui-text-2xs reproduces the oracle's measured 14px exactly, and all three
 *      variants take one size because a badge that changed size when it turned
 *      active would move the row it marks (spec Appendix 3: "State changes weight,
 *      never position").
 *   4. A CLAMP INSTEAD OF A SPILL. Slate's badge is white-space: nowrap with nothing
 *      capping it, which at 1920x1200 never comes up. The oracle is DISQUALIFIED for
 *      responsive behaviour (Part 10 §4), so the layout spec governs: the marker is
 *      capped at its container and the text ellipsises rather than escaping the row
 *      it belongs to. One line still - it never wraps to two.
 *   5. An optional `label`, for the count case. See ACCESSIBILITY below.
 *
 * LEADING IS CARRIED, NOT INVENTED - and it is NOT a departure.
 *   `line-height: 1.5` on .badge reproduces the oracle's height record exactly:
 *   CITE profile-selector .slate-badge [i=20] height = 21px (dark AND light, the
 *   themes table's own row) - 14px x 1.5 = 21px. Slate never wrote that ratio on
 *   .slate-badge; it inherited it from the Tailwind preflight at the document layer,
 *   and Decal's document layer has no leading of any kind, so what is an
 *   INHERITED value there has to be a DECLARED one here or the frozen box moves.
 *   Restoring a measured value is not a departure, and the height is inside the
 *   oracle's own 18-property surface, so leaving it at 18px was a silent break.
 *
 *   WHY A LITERAL AND NOT A TOKEN. There is no --ui-leading-* family: §3.5 of the
 *   layout spec never proposes one (grep for line-height/leading across
 *   LAYOUT_SPEC_DRAFT.md and DECISIONS.md returns zero hits), and styles/tokens.css
 *   is wave 0a's file. Six sibling primitives already carry a Slate ratio as a plain
 *   value for the same reason (type-roles.js:190/204/223/237/256, ui-empty-state.js
 *   :314/325, ui-keycap.js:270, ui-icon-button.js:243, ui-alert-banner.js:257,
 *   ui-select.js:234), so this follows the tree rather than inventing a seventh
 *   spelling. It is also the most easily reversed shape: if the document layer or
 *   the token set later grows a leading, deleting this ONE declaration returns the
 *   badge to inheriting it. Recorded as a deferred question for the gate
 *   (realine-run/waves/1/ledger-src/02-builders-deferred-questions.json).
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO selection treatment, and `active` is not one. The four dials mean something
 *     only because there is ONE selection component (CONVENTIONS §4; that is #3, the
 *     segmented bank). A badge marks the active item; it is not the control that
 *     selects it, it has no aria-selected state of its own, and `selectionSurface` is
 *     deliberately not imported. Pinned by a test that sets every selection spelling
 *     on this element and asserts the paint does not move.
 *   - NO hit-area utility and NO 48px floor. spec §2.3 / Appendix 5 govern TOUCH
 *     TARGETS; the shared utility's three consumers are #15, #23 and #35
 *     (CONVENTIONS §5). A badge is not interactive - it takes no focus, fires no
 *     event, and Slate's is 21px tall. Growing it to 48px would put a hit box with
 *     nothing behind it on top of the row that IS the target.
 *   - NO `--ui-status-warn`, because the token set has none. Attention borrows
 *     --ui-tint-power exactly as Slate borrowed --slate-power, and the computed
 *     values match in both themes. Flagged for the gate, not invented here: adding
 *     a token is a wave-0a change.
 *   - NO `part()` theming surface. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY
 *   The slot's text is the accessible content, which is right for "Active" and for
 *   "Update available". It is NOT right for the folder count - Slate renders
 *   <span class="slate-badge slate-folder-count">2</span> and a screen reader says
 *   "2". `label` fixes that case: the visible glyph goes aria-hidden and the label
 *   is exposed as visually hidden text. NOT aria-label on the span: aria-label is
 *   ignored on an element with the generic role, which is what a bare <span> has.
 *   Row #12 cites no Appendix 15 aria contract - Appendix 15 is the aria-*-driven
 *   STATE selector rule for .slate-bank / .slate-stepper, and a badge has no state
 *   a user can change.
 *
 * API
 *   <ui-badge>2</ui-badge>                                  count / neutral marker
 *   <ui-badge label="2 profiles">2</ui-badge>               named for a screen reader
 *   <ui-badge variant="active">Active</ui-badge>            the ONE active item
 *   <ui-badge variant="attention">Update available</ui-badge>   the ONE that needs it
 *   <ui-badge hidden>...</ui-badge>                         really hidden (see below)
 *
 *   [hidden] IS LOAD-BEARING AND SLATE SAYS SO. slate-components.css:230-239:
 *   "A component sets `display`, which outranks the [hidden] attribute - so hiding
 *   one by script silently did nothing. State beats layout." Slate's answer was
 *   `display: none !important` on .slate-badge[hidden]. Here the base's
 *   :host([hidden]) is (0,2,0) and this file's :host is (0,1,0), so state beats
 *   layout on specificity with zero !important - and there is a test for it, because
 *   this component's container opt-out is exactly the `display` that caused the bug.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';

/** The three the spec names. Anything else falls back to `default` rather than
 *  blanking the marker - the same choice base.js makes for an unrecognised
 *  focus-ring value, and ui-button for an unrecognised variant. */
export const BADGE_VARIANTS = Object.freeze(['default', 'active', 'attention']);

export class UiBadge extends UiElement {
    static properties = {
        /** 'default' | 'active' | 'attention'. */
        variant: { type: String, reflect: true },
        /** Accessible name, for a badge whose visible content is a bare number. */
        label: { type: String },
    };

    /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1, §5). `selectionSurface` is
     * not here at all - see WHAT IS DELIBERATELY NOT HERE. */
    static styles = [visuallyHidden, css`
        /* CONTAINER-HOSTING OPT-OUT, the one-liner CONVENTIONS §2 documents: the base
         * puts container-type: inline-size on every host, which is right for anything
         * filling a slot and wrong for "a control that must shrink to fit its glyph".
         * A badge is sized by its own text and sits inline in a row or a header, so
         * it opts out and queries nothing - no rule in this file is size-keyed.
         *
         * max-inline-size is departure 4: the marker may be as wide as its text and
         * no wider than the row it marks. The oracle has no vote on this (Slate is
         * frozen at 1920x1200); spec §2.2 governs. */
        :host {
            container-type: normal;
            display: inline-grid;
            max-inline-size: 100%;
        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) - and never
         * on :host either, because a screen sheet CAN name the host from outside and
         * cannot name anything in here. That is bug P8's mechanism, and this
         * component is exactly as exposed to it as Slate's button was.
         *
         * SOURCE slate-components.css:698-707 (.slate-badge), token names re-prefixed:
         *   display: inline-flex; align-items: center; padding: 0 var(--slate-space-2);
         *   border-radius: var(--slate-radius); background: var(--slate-key-on);
         *   color: var(--slate-text-2); font-size: var(--slate-text-sm);
         *   font-weight: var(--slate-weight-medium); white-space: nowrap;
         * No font-family here: it is inherited and already crosses the boundary from
         * styles/document.css, and a span has no UA font to undo (CONVENTIONS §11). */
        .badge {
            display: inline-flex;
            align-items: center;
            /* Grid items floor at min-content by default, so without this the clamp
             * above would be overflowed rather than obeyed. */
            min-inline-size: 0;
            padding-inline: var(--ui-space-2);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key-on);
            color: var(--ui-text-2);
            font-size: var(--ui-text-2xs);
            font-weight: var(--ui-weight-medium);
            /* THE HEIGHT RECORD, and the one value Slate does not write in this rule.
             * CITE profile-selector .slate-badge [i=20] height = 21px  <- (no
             * declaration - inherited or initial value), identical in prov-light; the
             * themes table prints  height 21px 21px. 21 = 14 x 1.5, and the 1.5 is
             * Tailwind's preflight on the DOCUMENT (html, :host { line-height: 1.5 },
             * slate/app/src/css/output.css:53-54, read read-only). Decal's document
             * layer declares no leading, so the inherited value has to be declared
             * here or the marker renders 18px and the frozen record moves. See
             * LEADING in the header for why it is a literal and not a token. */
            line-height: 1.5;
            white-space: nowrap;
        }

        /* The clamp's other half. text-overflow needs a block container, so the text
         * gets its own box inside the flex line rather than riding as an anonymous
         * flex item, where the ellipsis would silently do nothing. */
        .text {
            display: block;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* SOURCE slate-components.css:761-767 (.slate-badge-active). */
        :host([variant="active"]) .badge {
            background-color: var(--ui-primary);
            color: var(--ui-on-primary);
            font-weight: var(--ui-weight-semibold);
            letter-spacing: var(--ui-tracking-cap);
            text-transform: uppercase;
        }

        /* SOURCE slate-components.css:769-773 (.slate-badge-attention), including its
         * own colour arithmetic carried unchanged:
         *   background: color-mix(in srgb, var(--slate-power) 18%, transparent) */
        :host([variant="attention"]) .badge {
            background-color: color-mix(in srgb, var(--ui-tint-power) 18%, transparent);
            color: var(--ui-tint-power);
            font-weight: var(--ui-weight-semibold);
        }

        /* The visually-hidden .a11y treatment is the SHARED fragment above, not a
         * copy: visuallyHidden from base.js, structural, first in static styles
         * (CONVENTIONS §5). It was three byte-identical copies here, in ui-keycap.js
         * and in ui-locked-value.js until the fragment existed - see ACCESSIBILITY in
         * the header comment for what the label is for. */
    `];

    constructor() {
        super();
        this.variant = 'default';
        this.label = '';
    }

    /** Normalise before paint, so `variant="Active"` and `variant="nope"` are a
     *  documented fallback rather than an unstyled marker. */
    willUpdate(changed) {
        if (changed.has('variant')) {
            const raw = String(this.variant ?? '').trim().toLowerCase();
            const next = BADGE_VARIANTS.includes(raw) ? raw : 'default';
            if (next !== this.variant) this.variant = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<span id="badge" class="badge"
            ><span id="text" class="text" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</span>`;
    }
}

customElements.define('ui-badge', UiBadge);
