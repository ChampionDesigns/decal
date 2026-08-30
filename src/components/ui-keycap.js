/**
 * ui-keycap.js - component #15 of the 57-component inventory: THE KEY FACE.
 *
 * Wave 1, item #15 (SCOPE Part 4, "Wave 1 - primitives", L1526). Token-only: no data
 * layer, no ReaPrime, no endpoint. The glyph arrives through the slot; this element
 * owns paint and a touch floor, and nothing else.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE L1526: "Keycap | The numpad key face; one of three components where
 *   `--ui-hit-min` is load-bearing (spec §2.3)." size small, depends on: tokens.
 *   spec §5.1 #15: "Keycap | `slate-components.css:780-784`".
 *   spec §2.3 case 2: "Touch floors - `--ui-hit-min: 48px` and `--ui-control-sm: 44px`.
 *   Physically justified, and load-bearing in three components today, not one
 *   (`layout/overlays.md` A1: `.slate-keycap` `slate-components.css:780-781`,
 *   `.ps-fav-slot` `slate-shell.css:1669-1670`, `.slate-preset-bank > button::before`
 *   `slate-live.css:787`)."
 *   Downstream consumer, recorded because it constrains the API: Wave 4 #53, the
 *   numpad body (SCOPE L1692ff / ITEMS.json note 7).
 *
 * ROW #15 CITES NO BUG ID, AND THAT IS MEASURED, not an omission: grepping
 * LAYOUT_SPEC_DRAFT.md §7's 140 layout bugs for "keycap" and "kbd" returns nothing;
 * the only §7 hits near this component are the OTHER two hit-area consumers, P4 and
 * L22, and the cross-cutting L24. The disqualification check (Part 10 §4) therefore
 * CLEARS the oracle for every appearance value below - the keycap is the one of the
 * three consumers that actually reaches the 48px floor today (CONVENTIONS §5).
 * Responsive behaviour stays disqualified in all cases: Slate is frozen at
 * 1920x1200, so the layout spec governs, and it is marked where it comes up.
 *
 * THE SLATE RULE, read read-only from the source because four of its declarations
 * arrive at the corpus through shorthands (`border:`, `border-radius:`, `background:`,
 * `padding:`) and prov_query.py refuses to guess a token name behind a shorthand -
 * "Still citable: the computed value, the stylesheet, the selector and the
 * moved/frozen verdict ... NOT citable: the token name."
 * `slate-components.css:775-792`, its own comment included:
 *
 *     -- A key on a keyboard, drawn as one. The binding used to be small unstyled
 *        text sitting ~950px from the action it belonged to (P31). --
 *     .slate-keycap {
 *         display: inline-grid;
 *         place-items: center;
 *         min-width: var(--slate-hit-min);
 *         height: var(--slate-hit-min);
 *         padding: 0 var(--slate-space-2);
 *         border: var(--slate-hairline) solid var(--slate-line-strong);
 *         border-bottom-width: 3px;
 *         border-radius: var(--slate-radius);
 *         background: var(--slate-key);
 *         color: var(--slate-text);
 *         font-family: var(--slate-font-numeric);
 *         font-size: var(--slate-text-base);
 *         font-weight: var(--slate-weight-medium);
 *     }
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (prov_query.py find/value/themes, prov-baseline (dark) + prov-light.)
 *
 *   CITE  prov_query.py find --cls slate-keycap -> "found 6 element(s) in 1 state(s)";
 *         settings-help-keyboard-shortcuts, rects [1655,333,48,48] [1655,422,48,48]
 *         [1655,511,48,48] [1655,600,48,48] [1635,689,68,48] [1655,778,48,48];
 *         "distinct geometries (w x h), all matched elements: 48 x 48 x5, 68 x 48 x1".
 *         The 68 is the one whose text is "Space" - width is content, height is the floor.
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] height = 48px
 *         <- slate-components.css `.slate-keycap` (= --slate-hit-min) (token-driven)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] background-color:
 *         dark rgb(26, 33, 39) / light rgb(248, 249, 249) <- slate-components.css
 *         `.slate-keycap` authored (NOT CAPTURED - set via a CSS shorthand)
 *         !important=no (token-driven)
 *         [the shorthand is slate-components.css:787 `background: var(--slate-key)`;
 *          the two computed values ARE --ui-key's two theme values,
 *          styles/tokens.css:722 #f8f9f9 / :843 #1a2127 - exact, both themes]
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] color:
 *         dark rgb(244, 247, 248) / light rgb(23, 26, 28) <- slate-components.css
 *         `.slate-keycap` authored `var(--slate-text)` !important=no (token-driven)
 *         [= --ui-text, styles/tokens.css:726 #171a1c / :847 #f4f7f8 - exact, both themes]
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] border-top-color:
 *         dark rgb(82, 97, 107) / light rgb(170, 178, 183) <- slate-components.css
 *         `.slate-keycap` authored (NOT CAPTURED - shorthand) !important=no (token-driven)
 *         [the shorthand is slate-components.css:784 `border: var(--slate-hairline) solid
 *          var(--slate-line-strong)`; = --ui-line-strong, styles/tokens.css:731 #aab2b7 /
 *          :852 #52616b - exact, both themes]
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
 *         border-top-width = 1px  (= --ui-border-w -> --ui-hairline)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
 *         border-top-left-radius = 6px  (= --ui-radius, styles/tokens.css:291)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
 *         padding-left = 8px  (= --ui-space-2, styles/tokens.css:266)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] font-size = 17px
 *         <- slate-components.css `.slate-keycap` authored `var(--slate-text-base)`
 *         !important=no (token-driven)  (= --ui-text-base, styles/tokens.css:354)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] font-weight = 500
 *         <- slate-components.css `.slate-keycap` authored `var(--slate-weight-medium)`
 *         !important=no (token-driven)  (= --ui-weight-medium, styles/tokens.css:371)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] box-shadow = none
 *         <- (no declaration - inherited or initial value)  (FROZEN/hardcoded)
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43]
 *         letter-spacing = normal, min-height = auto, opacity = 1, text-transform = none
 *   CITE  themes: "15 of 18 properties identical across themes; 3 differ" - and the
 *         three are exactly face, ink and border, all three reproduced token-for-token.
 *
 *   THE ONE ORACLE ANSWER THIS COMPONENT DOES NOT COPY, and it is instructive:
 *   CITE  settings-help-keyboard-shortcuts #kb-current-espresso [i=43] font-family =
 *         Geist, system-ui, sans-serif <- slate-shell.css
 *         `#subpage-host #settings-content-area *` authored `var(--slate-font-ui)`
 *         !important=yes (token-driven)
 *   The keycap's OWN declaration is `var(--slate-font-numeric)` and it loses, to a
 *   universal-selector `!important` rule in another sheet 1000 lines away. Nothing
 *   visible changed because slate-tokens.css:125 defines `--slate-font-numeric:
 *   var(--slate-font-ui)` - the two are the same family - but that is luck, not
 *   design, and it is the reach-in the shadow boundary exists to make impossible
 *   (CONVENTIONS §6). styles/tokens.css:346-347 settles the merge in its own comment:
 *   "One family, not two: the old --slate-font-numeric was already defined as
 *   var(--slate-font-ui)". So: `var(--ui-font-family)`, and a test that puts an
 *   `!important` universal rule in the DOCUMENT and watches the face not move.
 *
 * DELIBERATE DEPARTURES, each recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-keycap; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to. Each is ALSO asserted as a
 * departure in test/render/ui-keycap.render.test.mjs, which is the copy a gate can run
 * rather than read:
 *   1. THE SKIRT IS DERIVED, NOT A LITERAL. Slate writes `border-bottom-width: 3px`
 *      - the one bare px in the rule, and the thing that makes a rectangle read as a
 *      key rather than as a box. spec §2.3 permits a fixed px for "icon and glyph
 *      geometry intrinsic to the artwork (stroke widths...)" (case 3), which this is;
 *      but it also bans "the same number written in two places", so it is expressed
 *      as a ratio of the hairline instead - `calc(3 * var(--ui-border-w))` - and moves
 *      with the token when --ui-hairline goes to 0.5px at high dpr (spec §3.1's note
 *      on --ui-hairline). Renders identically at dpr 1: 3 x 1px = 3px.
 *   2. THE HIT FLOOR IS THE SHARED UTILITY, NOT A LOCAL COPY. Slate's keycap reaches
 *      48x48 by declaring `min-width`/`height` directly, and today it is the only one
 *      of the three consumers that succeeds - `.ps-fav-slot` is bug P4 ("measured
 *      64x64, so --slate-hit-min is silently not applied where the comment says it
 *      is") and the rail's numpad targets are bug L22 ("five of the nine numpad
 *      targets are inline spans whose hit box is the glyphs - measured 32 x 35
 *      against a 48px floor, on a wall panel operated with a wet hand"). The face
 *      still declares the floor, AND it carries `.hit-overlay` from base.js, so the
 *      hit box holds 48px on both axes even if a consumer squeezes the ink. That is
 *      the difference between a floor a comment claims and a floor the box has.
 *   3. NO SHRINK. The oracle is disqualified for responsive behaviour, so the layout
 *      spec governs, and it is unusually direct here (§2.2 sizing table): "Control
 *      heights, touch targets, hairlines | Fixed token. Never fluid. | Ergonomics is
 *      physical ... A control that shrinks with the window becomes unusable exactly
 *      when the window is small." A keycap in a container narrower than 48px
 *      OVERFLOWS its container rather than shrinking. Deliberate, and tested.
 *   4. AN OPTIONAL `label`. See ACCESSIBILITY below.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NOT INTERACTIVE. Slate's is `<kbd class="slate-keycap">` in
 *     `src/settings/settings.js:9434` - a rendered key BINDING, not a control. This
 *     element is the FACE; #53 (Wave 4, the numpad body) owns pressing, and #1/#2
 *     already own "the one press control". Adding a `pressable` mode later is purely
 *     additive - one attribute, one branch in render() - whereas removing one is a
 *     breaking change for every consumer, so the reversible half ships first
 *     (recorded as a deferred question - realine-run/waves/1/ledger-src/
 *     02-builders-deferred-questions.json, rendered into DEFERRED_QUESTIONS.md by the
 *     gate). A consumer that needs the face focusable
 *     today puts `tabindex` on the host and gets the ONE ring from the base for free;
 *     that path is tested, in both offsets.
 *   - NO SELECTION TREATMENT, and `selectionSurface` is deliberately not imported.
 *     The four dials mean something only because there is ONE selection component
 *     (CONVENTIONS §4; that is #3, the segmented bank). A key is pressed, not
 *     selected: Slate's rule has no state selectors at all and the oracle reads
 *     box-shadow `none`, FROZEN. Pinned by a test that sets every selection spelling
 *     on both the host and the face and asserts the paint does not move.
 *   - NO `@media`, no size-keyed rule of any kind, and therefore no container query
 *     either: every dimension here is a fixed ergonomic token by §2.2. The host opts
 *     OUT of container hosting (see the styles) because it must shrink to its glyph.
 *   - NO `part()` theming surface. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *   - NO event, no value, no key-code knowledge. A primitive that "needs" server data
 *     is a design error to flag; this one does not even need a keyboard.
 *
 * ACCESSIBILITY
 *   `<kbd>` is the right element and Slate already uses it: it says "this is user
 *   input", and the slotted text is the accessible content, which is correct for "E",
 *   for "Space" and for every binding on the shortcuts screen. It is NOT correct for
 *   a glyph - a numpad backspace face is the character U+232B and a screen reader
 *   reads it as nothing useful. `label` fixes that case the same way ui-badge does:
 *   the visible glyph goes `aria-hidden` and the name is exposed as visually hidden
 *   text. NOT `aria-label`: `kbd` has no ARIA role of its own, and `aria-label` is
 *   ignored on a generic-role element. Recorded for Wave 4: the numpad's unnamed
 *   backspace is bug O9, and this is the affordance that retires it there.
 *   Row #15 cites no Appendix 15 aria contract, and correctly - Appendix 15 is the
 *   `aria-*`-driven STATE selector rule for `.slate-bank` / `.slate-stepper`, and a
 *   keycap has no state a user can change.
 *
 * API
 *   <ui-keycap>E</ui-keycap>                       a binding, the Slate case
 *   <ui-keycap>Space</ui-keycap>                   wider than the floor, by content
 *   <ui-keycap label="Backspace">&#9003;</ui-keycap>   a glyph with a name
 *   <ui-keycap tabindex="0">7</ui-keycap>          focusable; the base draws the ring
 *   <ui-keycap focus-ring="inset">7</ui-keycap>    inside an overflow:hidden grid (L24)
 *   <ui-keycap disabled>-</ui-keycap>              dimmed by --ui-opacity-disabled
 *   <ui-keycap hidden>...</ui-keycap>              really hidden (see below)
 *
 *   [hidden] IS LOAD-BEARING AND SLATE SAYS SO. slate-components.css:230-239: "A
 *   component sets `display`, which outranks the [hidden] attribute - so hiding one
 *   by script silently did nothing. State beats layout." Slate's answer was
 *   `display: none !important`. Here the base's `:host([hidden])` is (0,2,0) and this
 *   file's `:host` is (0,1,0), so state beats layout on specificity with zero
 *   `!important` - and there is a test, because this component's container opt-out is
 *   exactly the `display` declaration that caused the bug.
 */

import { css, html, nothing } from 'lit';
import { UiElement, hitArea, visuallyHidden } from 'src/components/base.js';

export class UiKeycap extends UiElement {
    static properties = {
        /** Accessible name, for a face whose visible content is a bare glyph. */
        label: { type: String },
    };

    /* STRUCTURAL FRAGMENTS FIRST (CONVENTIONS §4 rule 1, §5). `selectionSurface` is
     * not here at all - see WHAT IS DELIBERATELY NOT HERE. */
    static styles = [hitArea, visuallyHidden, css`
        /* CONTAINER-HOSTING OPT-OUT, the one-liner CONVENTIONS §2 documents - and
         * base.js names THIS component when it explains why the opt-out exists:
         * "wrong for the handful of controls that must shrink to fit their glyph -
         * a keycap at min-width: var(--ui-hit-min) inside a row, say."
         * inline-size containment would freeze the host at its slot's width and the
         * 68px "Space" face could never happen. Nothing in this file is size-keyed,
         * so no container is needed for queries either. */
        :host {
            container-type: normal;
            display: inline-grid;
        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) - and never
         * on :host either, because a screen sheet CAN name the host from outside and
         * cannot name anything in here. That is the mechanism behind both P8 and the
         * universal-selector !important rule in slate-shell.css that beat this
         * component's own font-family in Slate (cited in full in the header comment;
         * no backticks in here, CONVENTIONS §9).
         *
         * SOURCE slate-components.css:777-792, token names re-prefixed. Every
         * declaration below is one of that rule's, in its order, except the two
         * marked. */
        .cap {
            display: inline-grid;
            place-items: center;

            /* THE FLOOR, on both axes. Width is a MINIMUM so the face grows with the
             * word - the oracle's 68x48 "Space" key is this line doing its job -
             * while height is exact, because a key that is tall for one binding and
             * short for the next is not a keyboard. */
            min-inline-size: var(--ui-hit-min);
            /* THE TWO ADDITIVE LINES #53 ASKED FOR, and its own note wrote the reversal
             * down before this was needed: "the loss is real and it is recorded ... its
             * reversal, which is two additive lines in #15 plus one declaration here".
             * Ben asked for it on 24 Aug 2026 — "The numberpad modal is ugly compared to
             * Slate, please make it look the same" — and Slate's numpad key is 88px at a
             * display size, with its own reason: "this is the one control on the machine
             * that is used with a fingertip, at speed, often with a wet hand".
             *
             * PRIVATE KNOBS WITH THE OLD VALUE AS THE FALLBACK, so nothing that does not
             * set one moves a pixel — the keyboard-shortcuts page's caps are still
             * --ui-hit-min at --ui-text-base. A --ui-* name here would be guard 4's
             * private-palette error; --_ui- is this component's own surface, which is
             * what the skirt above already uses. */
            block-size: var(--_ui-keycap-block, var(--ui-hit-min));
            padding-inline: var(--ui-space-2);

            border: var(--ui-border-w) solid var(--ui-line-strong);
            /* DEPARTURE 1: the skirt, Slate's bare border-bottom-width of 3px,
             * expressed as a ratio of the hairline so it survives --ui-hairline
             * going to 0.5px at high dpr. Declared AFTER the shorthand, which would
             * otherwise reset it - the same ordering trap background-clip has on a
             * .hit-pad element (base.js, THE ONE TRAP). */
            border-block-end-width: var(--_ui-keycap-skirt, calc(3 * var(--ui-border-w)));
            border-radius: var(--ui-radius);

            background-color: var(--ui-key);
            color: var(--ui-text);

            /* Not inherited from the document: a kbd element carries a UA
             * font-family of monospace, so this is one of the few places where
             * CONVENTIONS §11's "no font-family on :host" does not mean "no
             * font-family anywhere" - there is a UA rule to undo. One family, not
             * two (styles/tokens.css:346-347). */
            font-family: var(--ui-font-family);
            font-size: var(--_ui-keycap-size, var(--ui-text-base));
            font-weight: var(--_ui-keycap-weight, var(--ui-weight-medium));

            /* NOT IN THE SLATE RULE, and both are consequences of the two above:
             * a UA-monospace kbd never had a line box taller than its own box, and
             * a binding name is one word by definition. Without nowrap a container
             * narrower than the floor wraps "Space" into two lines inside a 48px box,
             * which is departure 3 failing quietly instead of overflowing honestly. */
            line-height: 1;
            white-space: nowrap;
        }

        /* The glyph's own box, so the label property has something to hide and
         * something stable to query. Not a paint surface. */
        .glyph {
            display: block;
        }

        /* The visually-hidden .a11y treatment is the SHARED fragment above, not a
         * copy: visuallyHidden from base.js, structural, first in static styles
         * (CONVENTIONS §5). It was three byte-identical copies here, in ui-badge.js
         * and in ui-locked-value.js until the fragment existed - see ACCESSIBILITY in
         * the header comment for what the label is for. */
    `];

    constructor() {
        super();
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        /* `.hit-overlay` is on the FACE, not the host: the utility's ::before is
         * positioned against its originating element, and the face is the element
         * whose ink can be squeezed. Leaf-only is satisfied - there is nothing
         * interactive inside. */
        return html`<kbd id="cap" class="cap hit-overlay"
            ><span id="glyph" class="glyph" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</kbd>`;
    }
}

customElements.define('ui-keycap', UiKeycap);
