/**
 * ui-card.js - component #8 of the 57-component inventory: THE PLAIN SURFACE.
 *
 * Wave 1, item #8 (SCOPE Part 4, "Wave 1 - primitives", SCOPE.md:1525):
 *   "| 8 | Card | Plain surface with radius and border. | small | tokens |"
 * Token-only: no data layer, no ReaPrime, no endpoint. Everything it shows arrives
 * through the slot; every value it paints arrives from styles/tokens.css.
 *
 * WHY IT EXISTS AS A COMPONENT AT ALL
 *   spec §5.1 #8: "Card | 9 uses". It is already a library class in Slate
 *   (slate-components.css:31-35) and its whole body is three declarations - which is
 *   exactly why it is worth owning: two later components are defined in terms of it
 *   (SCOPE.md:1642 "#50 Definition card ... small | #8" and :1643 "#51 Card grid ...
 *   small | #8"), and Part 4 folds a third surface into it rather than building one -
 *   SCOPE.md:1702, "Notes pane -> #8 card + type roles with a max-block-size cap
 *   (spec §4.2)".
 *
 * MEASURED STARTING VALUES - every one is an oracle answer, quoted verbatim.
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light;
 * 20 elements in 6 states answer to `find --cls slate-card`.)
 *
 *   CITE settings-machine-machine-info .slate-card [i=47] background-color =
 *        rgb(26, 33, 39)  <-  slate-components.css  `.slate-card`  authored
 *        `var(--slate-key)`  !important=yes  (token-driven)
 *        [themes: dark rgb(26, 33, 39) / light rgb(248, 249, 249) - both are
 *         --ui-key's two theme values]
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-color =
 *        rgb(58, 72, 82)  <-  slate-components.css  `.slate-card`  authored
 *        `(NOT CAPTURED - set via a CSS shorthand)`  !important=yes  (token-driven)
 *        [themes: dark rgb(58, 72, 82) / light rgb(203, 208, 211) = --ui-line]
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-width = 1px
 *        <-  slate-components.css  `.slate-card`  authored `(NOT CAPTURED - set via
 *        a CSS shorthand)`  !important=yes  (token-driven)   = --ui-hairline
 *   CITE settings-machine-machine-info .slate-card [i=47] border-top-left-radius =
 *        6px  <-  slate-components.css  `.slate-card`  authored `(NOT CAPTURED -
 *        set via a CSS shorthand)`  !important=yes  (token-driven)   = --ui-radius
 *   CITE settings-machine-machine-info .slate-card [i=47] box-shadow = none
 *        <-  (no declaration - inherited or initial value)  (FROZEN/hardcoded)
 *   CITE settings-machine-machine-info .slate-card [i=47] min-height = auto
 *        (the pure-surface cards are content-sized; see the scroll mode below)
 *
 * THE DEFECT THIS COMPONENT RETIRES, and it is P8's exact mechanism on a different
 * element. Slate's card is a library class, so a screen sheet can reach it - and one
 * does, on 14 of the 20 cards in the corpus:
 *
 *   CITE settings-accessories-usb-charger .slate-card [i=44] border-top-width = 1px
 *        <-  slate-shell.css  `#subpage-host #settings-content-area :is(button,
 *        [role="button"]):not(.toggle):not(.slate-stepper > *):not(.slate-bank-item)`
 *        authored `1px`  !important=yes  (FROZEN/hardcoded)
 *   CITE settings-display-skin .slate-card [i=88] box-shadow = none  <-  the same
 *        shell rule, authored `none`  !important=yes  (FROZEN/hardcoded)
 *
 *   So the SAME class renders a token-driven hairline on the six div cards and a
 *   frozen literal 1px on the fourteen button cards: a fork that moves --ui-hairline
 *   moves six of twenty borders. The audit states the general form at
 *   findings-digest.md:2251 - "The library layer cannot win inside Settings ... so
 *   .slate-btn-primary, .slate-card, .slate-field and the stepper components are
 *   decoration on Settings markup - the shell decides." Not a numbered §7 bug, but
 *   the same family as P8, and the shadow boundary is what ends it: the paint lives
 *   on .card inside this root where no screen rule can name it. Asserted in
 *   test/render/ui-card.render.test.mjs ("no rule from outside can reach the paint").
 *
 * FOUR DELIBERATE DEPARTURES, all recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-card; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to.
 *
 *   1. THE CARD OWNS ITS INSET. Slate's .slate-card declares no padding at all, so
 *      all nine uses supply their own at the call site, and the oracle reads four
 *      different insets for one component:
 *        CITE settings-updates-firmware-update .slate-card [i=37] padding-left = 24px
 *             <-  app.css  `.p-6`  authored `1.5rem`  !important=no  (FROZEN/hardcoded)
 *        CITE settings-machine-sleep---wake-schedules .slate-card [i=65] padding-left
 *             = 16px  <-  app.css  `.p-4`  authored `1rem`  (FROZEN/hardcoded)
 *        plus px-[60px] py-[30px] (the load-cell card) and px-[24px] py-[14px] (the
 *        USB-charger tiles), both inline Tailwind arbitraries at the call site.
 *      That is the shape the audit calls out for the tile family - "the geometry is
 *      six Tailwind arbitraries at the call site" (findings-digest.md:1960). Default
 *      here is --ui-space-5 = 24px, which is what three of the four pure-surface uses
 *      already measure; pad="tight" is --ui-space-4, spec §3.3's own snap for Slate's
 *      16px ("16 -> 18" in the snapping table); pad="none" restores the Slate-identical
 *      surface for a consumer that really does own its own inset.
 *
 *   2. SCROLL MODE IS BOUNDED AND STATED (spec §2.4). Every scroll region gets "an
 *      explicit min-height ... an explicit overflow behaviour - auto with a VISIBLE
 *      scrollbar", and "hiding the scrollbar is banned". This is the generalisation of
 *      the one thing the old app got right, Appendix item 13: "The numpad's bounded,
 *      scrollable card (numpad-modal.css:44-48) ... the only overlay that handles a
 *      short viewport, and a real fix to a real problem." The cap arrives from outside
 *      as max-block-size on the host - which is exactly how SCOPE.md:1702 asks the
 *      Notes pane to be built - and the floor is the component's.
 *
 *   3. A SCROLLING CARD IS KEYBOARD-REACHABLE. tabindex="0" only when scroll is set,
 *      so a keyboard user can reach content the mouse can wheel to. A11y floors are
 *      the class of defect L22 and P4 record; an unreachable scroll region is the same
 *      failure one step later. A card that does not scroll takes no tab stop.
 *
 *   4. RESPONSIVE BEHAVIOUR IS THE SPEC'S, NOT SLATE'S. The oracle is DISQUALIFIED
 *      here (Part 10 §4): its geometry is frozen at 1920x1200 - the 20 measured cards
 *      are 593/594/760/1150/1200 wide because that is what a 1920 canvas gave them.
 *      The card fills its container and reads no viewport; heights are content or the
 *      §2.4 floor.
 *
 *      AND THE OTHER HALF OF THAT SENTENCE, because "fills its container" has a
 *      degenerate case every consumer can walk into. The base puts
 *      `container-type: inline-size` on the host (CONVENTIONS §2: "the host's inline
 *      size can no longer depend on its contents"), so in an INTRINSIC-SIZING slot -
 *      a bare flex item, a column flex with align-items: flex-start, a grid cell with
 *      justify-items: start - there is no container inline size to fill. The host
 *      resolves to 0 and the card renders as exactly its own inset plus its own
 *      border, with the slotted content overflowing it: measured in the rig at the
 *      default pad, host 0 / .card 50x92 / clientWidth 48 / scrollWidth 79. The
 *      overflow is VISIBLE, never clipped - §2.4's no-silent-clip rule holds in the
 *      degenerate case too, so this is a failure a builder can see rather than one
 *      that eats text.
 *
 *      Stated rather than defended against, and not out of laziness: a surface cannot
 *      invent an inline size nobody gave it, and dropping the containment would only
 *      trade this for shrink-wrapping the text, which is not what a card does. THE
 *      REMEDY IS ONE DECLARATION AT THE CALL SITE - `flex: 1`, `align-self: stretch`,
 *      a width, a grid track. Both halves are pinned in
 *      test/render/ui-card.render.test.mjs ("an INTRINSIC-SIZING slot leaves the card
 *      nothing to fill"), and the row fixture there carries its own guard so the suite
 *      cannot silently go back to measuring the collapsed box.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SELECTION TREATMENT, even though 14 of the 20 measured cards are buttons in
 *     a pick-one set. CONVENTIONS §4: the four dials only mean anything because there
 *     is ONE selection component (#3, the segmented bank). The pick-one tile the audit
 *     proposes (findings-digest.md:1937-1939) is a separate component, not this one,
 *     and adding a second selection look here is the decay the rewrite exists to stop.
 *   - NO ELEVATION. The oracle reads box-shadow: none on every card in the corpus.
 *     --ui-elev-* belongs to things that float (dialog, sheet, menu), and those are
 *     #18/#20/#21 in Wave 3.
 *   - NO HEADER/FOOTER SLOTS. "Plain surface" is the whole brief; the label/value
 *     layout is #50, the 2-up grid is #51, and the chart host is #9.
 *   - NO --ui-surface. The oracle says the card paints --slate-key, and the measured
 *     value matches --ui-key in both themes to the byte. styles/tokens.css:721 calls
 *     --ui-surface "raised card", which reads like a contradiction and is not one:
 *     the token's own ORACLE line binds it to #review-graph, the chart ground. Flagged
 *     for the GATE rather than silently resolved: the measurement wins here.
 *
 * API
 *   <ui-card>...</ui-card>                     surface, 24px inset
 *   <ui-card pad="tight">...</ui-card>         18px inset
 *   <ui-card pad="none">...</ui-card>          Slate-identical: the caller insets
 *   <ui-card scroll>...</ui-card>              bounded scroll region, §2.4 floor
 *   card.scrollable = true                     the SAME thing from script (see below)
 *   <ui-card label="Machine">...</ui-card>     role="group" + accessible name
 *   <ui-card focus-ring="outset">              base attribute; overrides scroll's inset
 *   ui-card { max-block-size: 275px }          the cap, from outside (SCOPE.md:1702)
 *   ui-card { flex: 1 }                        in a shrink-to-fit slot, give it an
 *                                              inline size - departure 4's degenerate
 *                                              case, or the card is inset + border
 *   --_ui-card-min-block                       the scroll floor, if 64px is wrong
 *
 *   THE ATTRIBUTE IS `scroll`, THE PROPERTY IS `scrollable`, AND THEY ARE THE SAME
 *   STATE. A reactive property named `scroll` would be defined by Lit as an accessor
 *   on UiCard.prototype - the prototype has no own `scroll`, so Lit takes the name -
 *   and that accessor SHADOWS Element.prototype.scroll(). Measured in the rig:
 *   `typeof card.scroll` = 'boolean', and `card.scroll(0, 0)` throws
 *   "TypeError: el.scroll is not a function". A card is the one component in this
 *   wave that a screen has a real reason to scroll from script - it is a scroll
 *   container - so breaking the standard method on it is the worst possible name to
 *   take. `attribute: 'scroll'` keeps the whole authored surface (`<ui-card scroll>`,
 *   `:host([scroll])`, ui-card[scroll] from a screen sheet) exactly as documented and
 *   as SCOPE.md:1702 asks for it; only the JS spelling moves, and it moves onto a
 *   name nothing standard owns. The same shape four siblings already use for a
 *   property/attribute mismatch (ui-progress-track.js:189, ui-text-field.js:172,
 *   ui-slider.js:115, ui-icon-button.js:160). Pinned by a test that calls
 *   card.scroll(0, 0) and reads scrollTop back.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** The three the component recognises; anything else falls back to `regular` rather
 *  than collapsing the inset - the same choice base.js makes for focus-ring, and the
 *  same one ui-button makes for variant. */
export const CARD_PADS = Object.freeze(['regular', 'tight', 'none']);

export class UiCard extends UiElement {
    static properties = {
        /** 'regular' | 'tight' | 'none'. */
        pad: { type: String, reflect: true },
        /** Bounded scroll region: overflow, floor, tab stop, inset ring (spec §2.4).
         *  The ATTRIBUTE is `scroll`; the property may not be, because a reactive
         *  property named `scroll` lands on the prototype and shadows the standard
         *  Element.prototype.scroll() - see the API note in the header. */
        scrollable: { type: Boolean, reflect: true, attribute: 'scroll' },
        /** Accessible name. With one, the card becomes a labelled group. */
        label: { type: String },
    };

    static styles = [css`
        /* THE HOST IS A ONE-ROW GRID, not the base's plain block, and that is what
         * makes the cap in SCOPE.md:1702 work. A screen writes
         * ui-card { max-block-size: 275px } from outside; the row track resolves to
         * the capped height and minmax(0, 1fr) lets the card shrink BELOW its content,
         * so the overflow lands inside the card and becomes a scrollbar instead of
         * spilling out of the surface. With no cap the track is content-sized and
         * nothing changes.
         *
         * container-type stays as the base set it: a card fills its slot, so the
         * inline-size containment CONVENTIONS §2 warns about is right here, not wrong.
         * Its one documented cost is departure 4's second half - a slot that is itself
         * intrinsically sized offers nothing to fill, so the host resolves to 0 and the
         * card collapses to its own inset. That is the call site's declaration to make
         * (flex: 1, align-self: stretch, a width), not this file's, and it is pinned by
         * a rendering test rather than left to be rediscovered.
         * No rule in this file is size-keyed and none may be: a component reads its
         * own container, never the viewport (spec §2.1 Rule 1). */
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);

            /* The inset, in one private slot the three pad rules retarget.
             * ORACLE the default: 24px is what three of the four pure-surface cards
             * measure (settings-updates-firmware-update [i=37], and both p-6 cards in
             * settings-machine-machine-info / -sleep---wake-schedules). */
            --_ui-card-pad: var(--ui-space-5);
        }

        /* Slate's own second inset is 16px (app.css .p-4); spec §3.3 snaps off-scale
         * spacing to the nearest step and lists this exact case - "16 -> 18". */
        :host([pad="tight"]) {
            --_ui-card-pad: var(--ui-space-4);
        }

        /* The Slate-identical card: three declarations and no inset at all. */
        :host([pad="none"]) {
            --_ui-card-pad: 0px;
        }

        /* THE PAINT, ON A CLASS (CONVENTIONS §4 rule 2) AND INSIDE THE ROOT. Not on
         * :host - a screen sheet can name the host from outside and cannot name
         * anything in here, which is the half that ends the shell-716 override quoted
         * in the header. Every value is a token; there is not a number in this block. */
        .card {
            min-inline-size: 0;
            padding: var(--_ui-card-pad);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key);
        }

        /* SCROLL MODE - spec §2.4: a floor, a stated overflow, a visible scrollbar.
         * overflow: auto on BOTH axes on purpose: a card is a column of content, but
         * an unbreakable string is the case where a vertical-only scroller silently
         * clips, and silent clipping is the inherited behaviour §2.4 exists to end.
         * The scrollbar itself is the document's (styles/document.css:79-80,
         * scrollbar-color / scrollbar-width: thin) - inherited properties cross the
         * boundary, so the card does not restate them and cannot hide them. */
        :host([scroll]) .card {
            overflow: auto;
            min-block-size: var(--_ui-card-min-block, var(--ui-control-h));
        }

        /* L24, SELF-INFLICTED AND PRE-EMPTED. A scroll container clips at its padding
         * edge, so the ring on its own tab stop would be cut on all four sides - which
         * is bug L24's exact wording, "focus rings clipped on all four sides by the
         * components they sit inside". One treatment, second offset (CONVENTIONS §3).
         *
         * :not([focus-ring]) so this is a DEFAULT, not an override: a consumer that
         * writes focus-ring="outset" (or "inset") on the host still decides. Slotted
         * children are unaffected - every UiElement re-declares the offset on its own
         * host - which is why the pad matters: 18px or 24px of inset is what keeps a
         * slotted control's outset ring inside the scrollport. At pad="none" the
         * consumer puts focus-ring="inset" on the child, and that is tested too. */
        :host([scroll]:not([focus-ring])) {
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* L24 AGAIN, AND THIS TIME FOR SOMEBODY ELSE'S RING. The rule above only
         * covers the card's own tab stop. At pad="none" there is no inset left to
         * keep a FLUSH CHILD's outset ring inside the scrollport, and the card is
         * what clips it - so the card closes the case it creates instead of leaving
         * it to every consumer to rediscover. At pad="tight" and pad="regular" the
         * 18px/24px inset already clears the ring (--ui-focus-offset 2px +
         * --ui-focus-w 3px), which is why this is keyed on pad="none" only: reaching
         * into a slotted child that is in no danger would be the reach-in this
         * component exists to end.
         *
         * WHY A ::slotted RULE CAN WIN THIS AT ALL - measured, not assumed. A slotted
         * UiElement re-declares --_ui-focus-offset on its own :host (base.js:378), and
         * that declaration is in an INNER tree relative to this one; for two normal
         * declarations in different tree contexts the outer tree wins, whatever the
         * specificity (CSS Scoping §3.3, shadow-including tree order - the same
         * mechanism the :host notes elsewhere in this wave lean on). Probed in the
         * rig: a slotted component's computed --_ui-focus-offset moves 2px -> -3px
         * under this rule.
         *
         * TWO LIMITS, both deliberate and both tested. A child that STATES its
         * treatment (focus-ring="outset"/"inset") is not matched, exactly as the host
         * rule above leaves the consumer's attribute in charge. And a light-tree
         * declaration - a document rule setting --_ui-focus-offset on the child -
         * outranks this one, because the document is the outermost tree; that
         * consumer has said what it wants and the documented escape hatch (one
         * property, same treatment) is still theirs. */
        :host([scroll][pad="none"]) ::slotted(:not([focus-ring])) {
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }
    `];

    constructor() {
        super();
        this.pad = 'regular';
        this.scrollable = false;
        this.label = '';
    }

    /** Normalise before paint, so pad="Tight" and pad="nope" are a documented
     *  fallback rather than a surface with no inset. */
    willUpdate(changed) {
        if (changed.has('pad')) {
            const raw = String(this.pad ?? '').trim().toLowerCase();
            const next = CARD_PADS.includes(raw) ? raw : 'regular';
            if (next !== this.pad) this.pad = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<div
            id="card"
            class="card"
            role=${named ? 'group' : nothing}
            aria-label=${named ? this.label : nothing}
            tabindex=${this.scrollable ? '0' : nothing}
        ><slot></slot></div>`;
    }
}

customElements.define('ui-card', UiCard);
