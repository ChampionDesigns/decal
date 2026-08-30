/**
 * base.js - the base-element conventions every Decal component inherits.
 * Wave 0a item #2 (SCOPE Part 4 Wave 0 item 2; Part 10 §12: "base conventions
 * §2.1-2.3, §3.9").
 *
 * READ `src/components/CONVENTIONS.md` FIRST if you are building a component. This
 * file is the mechanism; that file is the rule set with its citations, and it is
 * meant to be the ONE thing a Wave 1 builder reads instead of the spec set.
 *
 * WHAT THIS FILE IS FOR. The audit's one-line verdict on Slate's library is that
 * *discipline without enforcement decays*: the library was well designed and well
 * documented and still ended up with five focus treatments, thirteen selection
 * looks and three copies of the hit-area trick. Shadow DOM is the wall; this file
 * is what is INSIDE the wall by default, so that the correct thing is also the
 * thing you get for free.
 *
 * THE FIVE CONVENTIONS, each mechanised below:
 *   1. Shadow DOM always, and the host is its own query container
 *      (LAYOUT_SPEC_DRAFT.md §2.1 Rule 1 - "a component reads its own container,
 *      never the viewport").
 *   2. ONE focus-ring treatment, from `--ui-focus-*`, in two offsets - replacing
 *      the five treatments Slate ships (§3.6).
 *   3. The four selection dials are the ONLY selection treatment surface (§3.9).
 *   4. ONE hit-area utility, ink kept separate from the hit floor
 *      (§2.3 + Appendix 5).
 *   5. Zero `!important` in component styles (§2.1 Rule 3), made unnecessary by
 *      two mechanisms rather than by asking nicely - see ZERO !IMPORTANT below.
 *
 * ZERO !IMPORTANT - THE MECHANISM. `slate-shell.css` carries 268 `!important`
 * declarations and `slate-components.css` 96, and every one of them exists because
 * some other sheet could reach the same element. Nothing can reach in here, so the
 * only remaining reason to write one would be to beat THIS file's own rules. Two
 * things remove that reason:
 *
 *   (a) Every base rule that targets an element inside the shadow tree is authored
 *       inside `:where(...)`, which contributes ZERO specificity. A component rule
 *       as weak as a bare element selector already outranks it. Order does not
 *       even come into it.
 *   (b) The base styles are prepended by `finalizeStyles()` rather than by asking
 *       subclasses to spread them, so they are always FIRST in the cascade and a
 *       component's own rule wins every tie on source order. That leg is load-bearing
 *       for the five declarations that CANNOT be wrapped in `:where()` - the `:host`
 *       rules below, which carry a real (0,1,0) and therefore TIE with a component's
 *       own `:host` rule. `composeStyles` (src/lib/base-conventions.js) is what makes
 *       the order hold whatever the subclass wrote; read its comment before changing
 *       `finalizeStyles`, because Lit's own dedupe would otherwise invert it.
 *
 * Both together mean: to override a base rule, write the rule. That is the whole
 * escape hatch, and it is why `!important` never appears here - a base that used it
 * would force every component that disagrees to use it too, which is precisely how
 * the old sheet got to 364.
 */

import { LitElement, css } from 'lit';

import {
    DEFAULT_FOCUS_VARIANT,
    composeStyles,
    mergeAdoptedSheets,
    resolveFocusVariant,
} from '../lib/base-conventions.js';

/* ===========================================================================
 * THE ONE FOCUS RING
 *
 * SOURCE  slate-components.css:733-734 `outline: 3px solid var(--slate-steel);
 *         outline-offset: 2px` - the treatment Decal keeps, generalised.
 *         `outline` and `outline-offset` are OUTSIDE the provenance corpus's
 *         18-property appearance surface, so the oracle has no answer here and is
 *         not consulted: `prov_query.py value --prop outline-width` exits 3,
 *         "not 'no rule', but 'never measured'". A read-only source read is still
 *         ladder step 3.
 *
 * Slate ships FIVE treatments for one skin (LAYOUT_SPEC_DRAFT.md §3.6):
 *   3px / offset  2px   slate-components.css:733
 *   3px / offset  3px   slate-live.css:78-82, slate-components.css:479
 *   3px / offset -3px   slate-shell.css:925-926
 *         offset -1px   slate-shell.css:1132
 *   2px                 numpad-modal.css:39-42
 * and the component layer's ring reaches only four classes, so most focusable
 * things in the app have no ring at all. This is the replacement: one width, one
 * ink, two offsets, applied by the base to the host, to every focusable in the
 * shadow tree, AND to a focusable slotted in from the light tree - three rules,
 * because those are the three places a focusable can be. The third exists because
 * review finding cross-3 measured the leak: 12 of wave 1's 14 elements expose a
 * slot, and a bare <button> slotted into one took Chrome's `outline: auto` 1px
 * rgb(16,16,16) - a SIXTH treatment, inside the layer that exists to end the five.
 *
 * THE INK IS `--ui-steel`, whose own declaration comment in styles/tokens.css
 * reads "focus ring, selected LED, selected FILL". It inverts between themes
 * (dark #315c70 / light #b0c4ce) so the ring stays visible on both grounds.
 * =========================================================================== */

/**
 * The two declarations, alone, so a component can put the ONE ring on something the
 * base's own selector list does not reach - a custom element child, or a wrapper
 * that must show the ring while an inner input takes the focus:
 *
 *     static styles = [css`.thumb:focus-visible { ${focusRing} }`];
 *
 * The `--_ui-focus-offset` fallback makes it work outside a `UiElement` too.
 */
export const focusRing = css`
    outline: var(--ui-focus-w) solid var(--ui-steel);
    outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
`;

/* ===========================================================================
 * THE ONE HIT-AREA UTILITY
 *
 * LAYOUT_SPEC_DRAFT.md Appendix 5, carried over as an idea worth keeping:
 * "Hit area is separate from ink - `::before` at `max(100%, var(--slate-hit-min))`
 * on presets (`slate-live.css:781-790`) and `padding-block` +
 * `background-clip: content-box` on sliders (`:1541-1571`). Good patterns; make
 * them ONE utility rather than three copies."
 *
 * The three copies are components #15 (keycap), #23 (slider) and #35 (favourite
 * slot). They consume this instead.
 *
 * ORACLE, for the floor's reality rather than its value:
 *   state=settings-help-keyboard-shortcuts element=[43] <kbd id="kb-current-espresso"
 *   class="slate-keycap"> property=height value=48px winning rule=
 *   slate-components.css {.slate-keycap} authored `var(--slate-hit-min)`;
 *   `prov_query.py find --cls slate-keycap` returns 6 elements in 1 state, five at
 *   48x48 and one at 68x48. The keycap is the one of the three that actually
 *   reaches the floor today.
 *
 * ORACLE DISQUALIFIED for the other two, and this is the point of the utility:
 *   - the favourite slot is bug P4 - "measured 64x64, so `--slate-hit-min` is
 *     silently not applied where the comment says it is";
 *   - the rail's numpad targets are bug L22 - "five of the nine numpad targets are
 *     inline spans whose hit box is the glyphs - measured 32x35 against a 48px
 *     floor, on a wall panel operated with a wet hand";
 *   - the rating slider is 32px tall against the same 48px floor
 *     (`slate-live.css:1541-1546`, spec §5.2 #23).
 * Matching Slate there reproduces the bug (Part 10 §4 disqualification check). The
 * utility takes the floor from the token instead, on both axes.
 *
 * TWO MODES, because the two proven patterns solve different shapes:
 *
 *   .hit-overlay   A LEAF control whose ink is smaller than the floor - a keycap, a
 *                  preset, a favourite slot. A transparent `::before` centred on the
 *                  element grows the hit box without moving one pixel of paint. The
 *                  pseudo-element's hits belong to its originating element, so the
 *                  control simply becomes bigger to the finger and identical to the
 *                  eye. LEAF ONLY: the overlay sits above the element's own content,
 *                  so an element with interactive children must use `.hit-pad`.
 *                  Two escape hatches, both single-line, both private properties:
 *                  `--_ui-hit-inline` / `--_ui-hit-block` per axis. A control in a
 *                  tight row sets `--_ui-hit-inline: 100%` - which is exactly what
 *                  Slate's preset bank does (`slate-live.css:781-790` maxes the
 *                  block axis only, because the presets sit shoulder to shoulder).
 *                  The default maxes BOTH axes: an a11y floor that has to be asked
 *                  for is the floor Slate has.
 *
 *   .hit-pad       An element whose ink IS its background - a slider track. The box
 *                  grows to the floor and the paint is clipped back to the content
 *                  box, so the track still READS as 8px while the whole 48px accepts
 *                  a press. Set `--_ui-hit-ink` to the ink's thickness; the box
 *                  itself is the floor, and `--_ui-hit-box` overrides that where a
 *                  control needs a taller one.
 *
 * THE ONE TRAP, and Slate's own sheet is the one that documents it
 * (`slate-live.css:1565-1567`): "AFTER the shorthand, which resets it to
 * border-box - that is what turned the track into a 32px slab the first time."
 * `background-clip` is a longhand of the `background` shorthand, so a component
 * that paints a `.hit-pad` element with `background: linear-gradient(...)` silently
 * un-clips it and the ink swells to fill the hit box. Base rules cannot defend
 * against this by ordering - they come FIRST by design. So: on a `.hit-pad`
 * element, paint with `background-image` / `background-color` longhands, never the
 * shorthand. If you must use the shorthand, re-declare `background-clip:
 * content-box` after it.
 * =========================================================================== */

export const hitArea = css`
    :where(.hit-overlay) {
        position: relative;
    }

    /* Transparent by construction: no colour, no paint, nothing to theme. */
    :where(.hit-overlay)::before {
        content: "";
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 50%;
        inline-size: var(--_ui-hit-inline, max(100%, var(--ui-hit-min)));
        block-size: var(--_ui-hit-block, max(100%, var(--ui-hit-min)));
        transform: translate(-50%, -50%);
    }

    :where(.hit-pad) {
        /* The outer box IS the hit floor, and box-sizing: border-box makes the
         * padding come out of it - so the content box is exactly the ink. A
         * min-block-size would not do: an input's own intrinsic content height
         * plus the padding pushes the box past the floor (measured: 56px, not 48). */
        --_ui-hit-box-resolved: var(--_ui-hit-box, var(--ui-hit-min));
        box-sizing: border-box;
        block-size: var(--_ui-hit-box-resolved);
        padding-block: max(0px, calc(
            (var(--_ui-hit-box-resolved) - var(--_ui-hit-ink, var(--_ui-hit-box-resolved))) / 2));
        background-clip: content-box;
    }
`;

/* ===========================================================================
 * THE ONE VISUALLY-HIDDEN TREATMENT
 *
 * Same argument as the hit-area utility one section up, and it is this file's own
 * header argument (base.js:9-16): "discipline without enforcement decays ... five
 * focus treatments, thirteen selection looks and three copies of the hit-area
 * trick", and LAYOUT_SPEC_DRAFT.md Appendix 5's remedy for exactly that shape -
 * "Good patterns; make them ONE utility rather than three copies."
 *
 * Wave 1 wrote the same nine declarations three times before this export existed -
 * ui-badge.js, ui-keycap.js and ui-locked-value.js, byte-identical, in the same
 * order, each labelling an icon-only or ellipsised control for a screen reader. All
 * three were CORRECT; three copies of correct is the defect, because the fourth one
 * is where a copy drifts. They consume this instead.
 *
 * NO ORACLE ANSWER EXISTS AND NONE IS SOUGHT. Slate has no visually-hidden utility
 * (its icon-only controls carry `title`/`aria-label` attributes, not text), and
 * `clip-path` / `position` are outside the provenance corpus's 18-property
 * appearance surface: `prov_query.py value --prop clip-path` is "not 'no rule', but
 * 'never measured'". This is the standard treatment, not a Slate measurement.
 *
 * NOT `display: none`, NOT `visibility: hidden`, NOT `width: 0`: all three remove
 * the text from the accessibility tree as well as from the page, which is the one
 * thing this must not do. `clip-path: inset(50%)` on a 1px box keeps the node
 * rendered, laid out and announced.
 *
 * SPECIFICITY, deliberate. Unlike the base's own rules this is NOT wrapped in
 * `:where()` - it carries the class's real (0,1,0), the same as the three copies it
 * replaces, so hoisting it changed no cascade outcome. Put it FIRST in
 * `static styles` (structural fragment, CONVENTIONS §5): a component's own rule at
 * equal specificity then still wins on source order, which is the escape hatch, and
 * anything that took it would be un-hiding text from sighted users - visible
 * immediately, not silent.
 *
 *     static styles = [visuallyHidden, css`...own rules...`];
 *     render() { return html`<span id="a11y" class="a11y">${this.label}</span>`; }
 * =========================================================================== */

export const visuallyHidden = css`
    /* Visually hidden, still in the accessibility tree. No colour, no theme surface,
     * nothing to drift. */
    .a11y {
        position: absolute;

        /* PINNED TO ITS CONTAINING BLOCK'S ORIGIN, AND THAT IS A BUG FIX, NOT TIDINESS.
         *
         * Without an inset an absolutely positioned box keeps its STATIC position - where
         * it would have sat in flow - while its containing block is the nearest POSITIONED
         * ancestor, or the initial containing block when there is none. Those two are
         * different boxes, and a box positioned against the initial containing block is
         * not clipped by an overflow: auto ancestor and does not add to that ancestor's
         * scrollable overflow. It adds to the VIEWPORT's.
         *
         * MEASURED, 26 August 2026, History -> Data with twenty shots at 1281x801 @ dsf
         * 1.5. Each pick disc in the shot list renders one of these spans, nothing in
         * ui-pick-disc was positioned, and row twenty sits 2027px down the list's own
         * scrolling content:
         *
         *     documentElement.scrollHeight  2028      document.body.scrollHeight  801
         *     lowest .a11y bottom 2027.6, offsetParent = body
         *     the list's frame 1670 in 409 - clipping correctly, all forty discs assigned
         *
         * html and body parting by 1227px is the fingerprint: content in flow cannot do
         * that. The whole screen scrolled 1227px, which reached nothing - the page already
         * fitted its region and the list was already scrolling inside itself - and it cost
         * ten pixels of page width to a scrollbar the layout did not need. Proved by
         * elimination: display: none on ONLY these spans took the document scroll to zero
         * with every row height untouched.
         *
         * FIFTEEN FILES RENDER ONE OF THESE and every one is exposed the moment it sits
         * inside a scroll region. ui-pick-disc was simply the first to sit twenty rows
         * deep. Pinned to 0, the span can never reach past its containing block, so no
         * consumer can leak page scroll again. It is hidden either way, so nothing moves. */
        inset-block-start: 0;
        inset-inline-start: 0;

        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        border: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
`;

/* ===========================================================================
 * THE FOUR SELECTION DIALS - THE ONLY SELECTION TREATMENT SURFACE
 *
 * LAYOUT_SPEC_DRAFT.md §3.9, carrying `slate-tokens.css:188-191` unchanged. The
 * dials only mean anything because there is ONE selection component: today Live's
 * favourites bank (bug L8/BUG-12) and the editor's tab bank (bug E10/B10) bypass
 * them entirely, "which is the decay the rewrite exists to stop".
 *
 * THE CONTRACT is Slate's own, and it is the right one - selection expressed as the
 * aria state, so accessibility state and visual state cannot drift
 * (LAYOUT_SPEC_DRAFT.md Appendix 15; `slate-components.css:389-392`).
 *   ORACLE  state=expanded-charts element=[164] <button id="expanded-tab-flow"
 *           class="slate-bank-item" role="tab"> property=color
 *           value=rgb(18, 24, 28) winning rule=slate-components.css
 *           {.slate-bank-item[aria-pressed="true"], .slate-bank-item[aria-selected="true"],
 *           .slate-bank-item[aria-checked="true"], .slate-bank-item.is-selected}
 *           authored `var(--slate-selected-ink)` !important=no (token-driven)
 *   ORACLE  state=settings-accessories-cup-warmer element=[11] <button
 *           id="accessories-btn" class="settings-nav-btn ... slate-nav-selected">
 *           property=background-color value=rgb(176, 196, 206) winning rule=
 *           slate-shell.css {#subpage-host .settings-nav-btn.active, ...
 *           .slate-nav-selected, ... [aria-current="true"], ...} authored
 *           `var(--slate-selected-face)` !important=yes (token-driven)
 *
 * FOUR VALUES, ZERO RULE CHANGES - which is only true if everything the treatment
 * paints is derived from those four. So:
 *   face   `--ui-selected-face`  the fill.
 *   ink    `--ui-selected-ink`   the glyph colour, and therefore `currentColor`.
 *   led    `--ui-selected-led`   a LENGTH. 0px in Slate: "the fill IS the indicator,
 *                                so the LED strip is off". The strip paints in
 *                                `currentColor` - i.e. the ink - so a fork gets a
 *                                channel-coloured LED by setting the ink, without a
 *                                fifth dial.
 *   glow   `--ui-selected-glow`  a PERCENTAGE, mixed toward transparent. 0% in
 *                                Slate: nothing glows. Radian: ~55%.
 * SOURCE for the two shapes: `slate-live.css:777` `text-shadow: 0 0 6px
 * color-mix(in srgb, var(--slate-steel) var(--slate-glow), transparent)`, and
 * `slate-components.css` / `slate-shell.css`'s inset-shadow LED, whose 4px the
 * oracle reads back as `... 0px -4px 0px 0px inset` at 72% of steel.
 *
 * WHAT VISIBLY CHANGES: nothing, on Slate's own dials. `--ui-selected-led: 0px` and
 * `--ui-selected-glow: 0%` make the last two declarations paint nothing at all, and
 * the Settings nav's own 4px LED was steel-at-72% drawn ON a steel face - invisible
 * before and absent after.
 *
 * TWO USAGE RULES, and the second one is not optional:
 *
 *   1. PUT THIS FRAGMENT LAST in `static styles`, after the component's own rules:
 *          static styles = [hitArea, css`...own...`, selectionSurface];
 *      Selection is a STATE treatment - it has to beat the resting paint. Structural
 *      fragments (`hitArea`) go first; state fragments go last. Unlike the base
 *      rules, this one is NOT wrapped in `:where()`: it carries a real (0,1,0) and
 *      needs to win.
 *
 *   2. PAINT THE RESTING STATE WITH A CLASS, NOT AN ID. An id selector is (1,0,0)
 *      and beats every attribute selector in this fragment, so a component that
 *      writes `#tab { background-color: var(--ui-key) }` silently never turns
 *      selected - measured on the fixture before it was corrected, and it is
 *      precisely how thirteen bypassed selection treatments get written by accident.
 *      Ids are for the test to query by; classes are for the cascade.
 *
 * AND THE ONE COLLISION, because `box-shadow` and `text-shadow` are WHOLE-VALUE
 * properties, not additive ones. `background-color` and `color` are dials replacing
 * dials, but a component whose RESTING paint already uses a shadow loses it the
 * moment the element is selected - the fragment's declaration replaces the whole
 * list. That is not hypothetical: the seam between two items in a one-piece bank is
 * an inset shadow, which is exactly what --ui-seam-ink exists for
 *   ORACLE  state=editor-review element=[9] <button id="editor-tab-1"
 *           class="slate-bank-item"> property=box-shadow value=
 *           rgba(30, 42, 50, 0.11) 1px 0px 0px 0px inset winning rule=
 *           slate-components.css {.slate-bank-item + .slate-bank-item} authored
 *           `inset var(--slate-hairline) 0 var(--slate-seam)`
 * and ui-bank is component #2 of the library. A selected bank item would lose its
 * seam, silently, in the very first component that draws one.
 *
 * SO THE TWO SHADOWS COMPOSE rather than replace. Each declaration is a two-item
 * shadow list whose FIRST item comes from a private property, defaulting to a
 * transparent no-op. A component with a resting shadow declares it once, in the
 * property, and paints from the same property:
 *
 *     .item + .item {
 *         --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
 *         box-shadow: var(--_ui-rest-shadow);
 *     }
 *
 * and the seam survives selection with the LED drawn over it. No `!important`, no
 * out-specifying, and the default path paints exactly what it painted before.
 * `--_ui-rest-text-shadow` is the same slot for the glow's property. Both are
 * PRIVATE (--_ui-), so they are invisible to the token-integrity check and are not
 * dials: they carry the component's own resting paint, not a theme value.
 *
 * The properties inherit, like every custom property. Set them on the element that
 * draws the shadow, not on a wrapper, or a selected descendant inherits the seam too.
 *
 * THE WEIGHT IS THE FIFTH DIAL (parity surface 2), and `--_ui-rest-weight` is its
 * composition slot, for the same reason the two shadows have one: `font-weight` is a
 * WHOLE-VALUE property, so a component whose RESTING weight is already an emphasis
 * would lose it the moment the element turned selected.
 *
 * Slate carries a selected weight in THREE rules and no token -
 * `slate-components.css:392` (.slate-bank-item, `var(--slate-weight-medium)`),
 * `slate-components.css:265` (.slate-nav-selected, the same token with !important)
 * and `slate-shell.css:310` (the selected profile-list row, a hardcoded 500) - and a
 * corpus census over all 49 baseline states finds 95 of the 100 elements painted
 * with --slate-selected-face at 500, with a single class of exception - the other 5:
 * `.hv-pick-btn` / `.slate-hv-pick-tag` at 600, which are 600 unselected as well.
 * Decal rendered 400 on all 153 of its own, because a weight written in the rules
 * is precisely the "selected look that survives retargeting every dial" this file
 * refuses. Making it a VALUE is the resolution: the dial restores Slate's rendered
 * weight AND the fork claim, where the old refusal delivered neither.
 *
 *     .disc {
 *         --_ui-rest-weight: var(--ui-weight-semibold);
 *         font-weight: var(--_ui-rest-weight);
 *     }
 *
 * is the whole of the exception, and #52 ui-pick-disc is the one component that needs
 * it - Slate's own disc is semibold in both states, so its weight is resting paint.
 * =========================================================================== */

export const selectionSurface = css`
    [aria-pressed="true"],
    [aria-selected="true"],
    [aria-checked="true"],
    [aria-current="true"],
    .is-selected {
        background-color: var(--ui-selected-face);
        color: var(--ui-selected-ink);
        font-weight: var(--_ui-rest-weight, var(--ui-selected-weight));
        box-shadow:
            var(--_ui-rest-shadow, 0 0 transparent),
            inset 0 calc(-1 * var(--ui-selected-led)) 0 0 currentColor;
        text-shadow:
            var(--_ui-rest-text-shadow, 0 0 transparent),
            0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent);
    }

    :host(:is(
        [aria-pressed="true"],
        [aria-selected="true"],
        [aria-checked="true"],
        [aria-current="true"],
        [selected]
    )) {
        background-color: var(--ui-selected-face);
        color: var(--ui-selected-ink);
        font-weight: var(--_ui-rest-weight, var(--ui-selected-weight));
        box-shadow:
            var(--_ui-rest-shadow, 0 0 transparent),
            inset 0 calc(-1 * var(--ui-selected-led)) 0 0 currentColor;
        text-shadow:
            var(--_ui-rest-text-shadow, 0 0 transparent),
            0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent);
    }
`;

/* ===========================================================================
 * THE BASE RULES
 *
 * CONTAINER HOSTING (LAYOUT_SPEC_DRAFT.md §2.1 Rule 1). `container-type:
 * inline-size` on the host, set here so it cannot be forgotten - which also makes
 * the excluded phone-landscape layout cheap to add later (DECISIONS.md:177-181).
 * A component's `@container` queries then resolve against its own host, because the
 * host is the nearest container ancestor of everything in its shadow tree. No
 * component writes `@media (width...)`: the only global queries are the two height
 * ones, and they live on `:root` in styles/tokens.css.
 *
 * THE ONE THING TO KNOW ABOUT IT: `container-type: inline-size` applies inline-size
 * CONTAINMENT, so the host's own inline size can no longer depend on its contents.
 * That is what you want for anything that fills a slot, and wrong for the handful of
 * controls that must shrink to fit their glyph - a keycap at `min-width:
 * var(--ui-hit-min)` inside a row, say. Those opt out in one line, in their own
 * styles, with no `!important` anywhere:
 *
 *     static styles = [css`:host { container-type: normal; display: inline-grid; }`];
 *
 * and query an ancestor container instead. `display: block` is set here for the same
 * reason: a custom element defaults to `display: inline`, and an inline box with
 * size containment is a 0x0 box - the failure looks like "my component vanished".
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *   - no font-family/font-size/color declarations. They are inherited properties and
 *     they already cross the shadow boundary from `styles/document.css`; restating
 *     them on every `:host` would break a screen's ability to set them locally.
 *   - no `--ui-density` arithmetic. Density multiplies vertical rhythm only, and the
 *     rhythm belongs to whatever is laying rows out, not to every leaf control.
 *   - no `touch-action`, and the reason has CHANGED — the sentence that used to be
 *     here ("whether pinch-zoom is reachable in the tablet WebView is an open
 *     measurement (SCOPE Part 2 §8 item 3) and the viewport meta deliberately does
 *     not restrict it; a base rule that disabled double-tap zoom would decide that
 *     question by accident") described a question that has since been answered, and
 *     a comment describing a decision that has already been made is the same defect
 *     in prose. Ben hit the trap on 27 August 2026: the panel ended up zoomed with no
 *     chrome to escape it. The viewport meta in index.html now says
 *     `user-scalable=no, minimum-scale=1, maximum-scale=1`, so browser scaling is
 *     settled THERE, in one place, with the measurement written beside it.
 *     `touch-action` still has no business in this file for the ordinary reason: it
 *     is a per-surface answer about which axis a gesture belongs to, not a base rule.
 *     The library has exactly one, on the chart's plot well
 *     (ui-chart-card.js, `touch-action: pan-y`), and it is there because a horizontal
 *     scrub was measurably being stolen as a pan — not to suppress zoom.
 * =========================================================================== */

const baseStyles = css`
    :host {
        display: block;
        box-sizing: border-box;
        container-type: inline-size;

        /* SOURCE slate-live.css:75, main.css:338, numpad-modal.css:321 - carried:
         * the grey tap flash on a wall panel reads as a rendering fault. */
        -webkit-tap-highlight-color: transparent;

        /* The focus offset, as one private property the whole subtree inherits.
         * Prefixed --_ui- and not --ui-: private, never a token, invisible to the
         * token-integrity check by construction (src/lib/base-conventions.js). */
        --_ui-focus-offset: var(--ui-focus-offset);
    }

    /* The inset variant, for a control whose parent clips - bug L24's class.
     * Settable on the host for the whole component, or on any element inside it
     * for just that subtree, which is what a component with an overflow: hidden
     * band of its own needs:  .band { --_ui-focus-offset: var(--ui-focus-offset-inset); } */
    :host([focus-ring="inset"]) {
        --_ui-focus-offset: var(--ui-focus-offset-inset);
    }

    :host([hidden]) {
        display: none;
    }

    /* Written as three selectors, not :where(*, *::before, *::after). The :where()
     * list is FORGIVING and silently drops any pseudo-element handed to it, so that
     * shorter form would compile to :where(*) and leave every pseudo-element in the
     * tree on content-box. The failure would stay invisible until something put
     * padding on a ::before. */
    :where(*),
    :where(*)::before,
    :where(*)::after {
        box-sizing: inherit;
    }

    /* THE ring, on the host when the host is the focusable thing. */
    :host(:focus-visible) {
        ${focusRing}
    }

    /* THE ring, on every focusable inside the shadow tree. Zero specificity from
     * :where(), so any component rule outranks it - but a component that wants a
     * DIFFERENT ring is doing the thing this file exists to prevent. */
    :where(:any-link, button, input, select, textarea, summary, [tabindex]):focus-visible {
        ${focusRing}
    }

    /* THE ring, on a focusable SLOTTED IN from the light tree - the third and last
     * place a focusable can be, and the one neither rule above can see. The list
     * above is scoped to the shadow tree and a slotted node is light DOM; :has() on
     * a wrapper walks the DOM tree rather than the flattened tree, so it never
     * matches a slotted descendant either. ::slotted() is the one selector that
     * reaches it, and it draws the SAME exported fragment, so nothing new is
     * invented here - the ring simply stops having a hole in it.
     *
     * MEASURED, review finding cross-3: a bare button slotted into ui-card, keyboard
     * focus -> outline-style auto, outline-color rgb(16, 16, 16), outline-width 1px.
     * That is the UA ring, i.e. a sixth treatment. Twelve of wave 1's fourteen
     * elements expose a slot and every one of them had this hole.
     *
     * IT DOES NOT DOUBLE-RING A ui-* CHILD. A slotted UiElement rings itself from
     * :host(:focus-visible) in its OWN tree; for two normal declarations in
     * different tree contexts the outer tree wins whatever the specificity (CSS
     * Scoping §3.3), so the child receives these declarations instead of its own -
     * and they are identical text. Its OFFSET still follows the child, because
     * --_ui-focus-offset is resolved on the child and only the child declares it:
     * a slotted ui-card keeps -3px, and focus-ring=inset keeps working.
     *
     * TWO LIMITS, both deliberate. ::slotted() matches only TOP-LEVEL assigned
     * nodes, so a focusable buried inside a slotted wrapper is still the light
     * tree's own business - CONVENTIONS §3a states that contract. And a document
     * rule on the child outranks this one, because the document is the outermost
     * tree; a consumer who has said what it wants keeps it. */
    ::slotted(:focus-visible) {
        ${focusRing}
    }

    /* One disabled dial, not three. Spec §3.7 settles .38 against Slate's three
     * live values: slate-components.css:424 says .45, and the oracle reads 0.5 on
     * #subpage-host :is(button, a):disabled. Paint only - whether the control still
     * accepts input is the component's own business, expressed with the native
     * disabled attribute. */
    :where([disabled], [aria-disabled="true"]) {
        opacity: var(--ui-opacity-disabled);
    }

    /* THE SAME DIAL ON THE HOST, and it needs its own rule: a shadow-tree selector
     * cannot match the host, only :host()/:host() can. The ordinary Lit spelling of
     * a disabled control is a reflected reactive property - <ui-stepper disabled> -
     * which puts the attribute on the HOST, so without this line "every disabled
     * control dims" would be false for the most common shape in the library and
     * true only for controls that happen to disable an inner element. The other two
     * host state rules above (:host([hidden]), :host([focus-ring])) had it and this
     * one did not; the asymmetry was the bug. */
    :host(:is([disabled], [aria-disabled="true"])) {
        opacity: var(--ui-opacity-disabled);
    }
`;

/* ===========================================================================
 * THE BASE ELEMENT
 * =========================================================================== */

/**
 * Every Decal component extends this, not `LitElement` directly.
 *
 *     import { UiElement } from 'src/components/base.js';
 *     class UiKeycap extends UiElement {
 *         static styles = [hitArea, css`...`];   // base styles arrive on their own
 *         render() { return html`<kbd class="hit-overlay"><slot></slot></kbd>`; }
 *     }
 *
 * NOTE the `static styles` line: it does NOT spread `UiElement.styles`. Lit's
 * `finalizeStyles` hook is overridden below to prepend the base styles for every
 * subclass, so forgetting to spread is not a failure mode that exists. Write only
 * your own styles; they land after the base ones and win every tie. Spreading
 * `UiElement.baseStyles` anyway is harmless - the duplicate is removed before Lit
 * sees the list, in either position - but it buys nothing.
 */
export class UiElement extends LitElement {
    /**
     * Prepend the base rules to whatever the subclass declared. Lit calls this once
     * per class, during `finalize()`.
     *
     * `composeStyles` strips any copy of the base styles OUT of the subclass's array
     * before handing the list on, so the base is first however the subclass spelled
     * itself. Do NOT simplify this to `super.finalizeStyles([baseStyles, styles])`:
     * Lit dedupes on the reversed array and keeps the LAST occurrence, so a subclass
     * that also spread `UiElement.baseStyles` at the END of its list would get the
     * base rules LAST - and the `:host` opt-out documented above would silently stop
     * working for exactly the author who was being careful. Measured against
     * vendor/lit.js; the two orderings are pinned in test/base-conventions.test.mjs
     * and the rendered consequence in test/render/base-fixture.render.test.mjs.
     */
    static finalizeStyles(styles) {
        return super.finalizeStyles(composeStyles(baseStyles, styles));
    }

    /** The base rules, exported for a component that cannot extend this class. */
    static get baseStyles() {
        return baseStyles;
    }

    /**
     * `'outset'` | `'inset'` - which offset this element's focus ring is using.
     * Read from the `focus-ring` attribute and normalised; an unrecognised value
     * falls back to `outset` rather than blanking the ring.
     *
     * Not a reactive property on purpose: it is a styling hint the CSS reads
     * straight off the attribute, so reflecting it would only add a default
     * `focus-ring="outset"` to every element in the tree.
     */
    get focusVariant() {
        return this.hasAttribute?.('focus-ring')
            ? resolveFocusVariant(this.getAttribute('focus-ring'))
            : DEFAULT_FOCUS_VARIANT;
    }
}

/* ===========================================================================
 * ADOPTING A VENDOR STYLESHEET INTO A SHADOW ROOT
 *
 * PLACEHOLDER, by the item's own wording - the chart card (Wave 3, component #47)
 * is the first real consumer and owns the decision of which of the two forms below
 * it uses. Component #55 (the notes editor) has the identical problem with
 * `vendor/easymde.min.css`, so this is two consumers, not one.
 *
 * THE PREFERRED FORM NEEDS NOTHING FROM THIS FILE. Lit's `static styles` compiles to
 * `adoptedStyleSheets` and accepts a native `CSSStyleSheet`, and a CSS module import
 * is a STATIC import - so the sheet is guaranteed present before the first render:
 *
 *     import uplotSheet from '../../vendor/uPlot.min.css' with { type: 'css' };
 *     static styles = [uplotSheet, css`...`];
 *
 * That ordering also puts the vendor sheet before the component's own rules, so the
 * component wins ties, which is the direction theming a chart runs in.
 *
 * WHY THE STATIC FORM MATTERS MORE THAN IT LOOKS. The failure mode of a MISSING
 * uPlot sheet is not a broken-looking chart - it is a chart that is pixel-identical
 * in a screenshot and completely dead to the touch (`cursor.idx = null`,
 * LAYOUT_SPEC_DRAFT.md §6.3 Rule 1). Any form that fetches the sheet has a window in
 * which the chart has rendered without it, and that window is invisible to every
 * test that asserts on pixels. A static import has no such window; if the WebView
 * turns out not to support import attributes, the module fails to load - loudly,
 * on the first run, which is the failure you want.
 *
 * THE FALLBACK FORM, for exactly that case, is `loadStyleSheet` + `adoptStyleSheet`
 * below, called from `firstUpdated` and awaited BEFORE the first `new uPlot(...)`.
 * `hasAdoptedSheet` is what the chart card's own test asserts on, so "the sheet is
 * adopted" is checked rather than assumed.
 * =========================================================================== */

/** Resolved against this module, so it does not care what the served root is. */
export const UPLOT_STYLESHEET_URL = new URL('../../vendor/uPlot.min.css', import.meta.url).href;

const sheetCache = new Map();

/**
 * Fetch a stylesheet once per URL and hand back a constructed `CSSStyleSheet`.
 * Cached by URL: N chart cards share one sheet object, which is also what makes
 * `adoptStyleSheet` idempotent across components.
 */
export function loadStyleSheet(url, { fetch: fetchImpl = globalThis.fetch } = {}) {
    const href = String(url);
    let pending = sheetCache.get(href);
    if (pending === undefined) {
        pending = Promise.resolve(fetchImpl(href))
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`loadStyleSheet: ${response.status} for ${href}`);
                }
                return response.text();
            })
            .then((cssText) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(cssText);
                return sheet;
            })
            .catch((error) => {
                // Do not cache a failure: a transient fetch error must not make the
                // chart permanently uninteractive for the life of the page.
                sheetCache.delete(href);
                throw error;
            });
        sheetCache.set(href, pending);
    }
    return pending;
}

/**
 * Merge a constructed sheet into a shadow root's `adoptedStyleSheets` without
 * disturbing the ones Lit put there. Idempotent - safe to call on every update.
 */
export function adoptStyleSheet(root, sheet, { position = 'before' } = {}) {
    if (!root) throw new TypeError('adoptStyleSheet: no render root');
    if (!sheet) throw new TypeError('adoptStyleSheet: no stylesheet');
    root.adoptedStyleSheets = mergeAdoptedSheets(root.adoptedStyleSheets, [sheet], { position });
    return root.adoptedStyleSheets;
}

/** Is this sheet actually in that root? The assertion a chart test should make. */
export function hasAdoptedSheet(root, sheet) {
    const sheets = root?.adoptedStyleSheets;
    return Array.isArray(sheets) ? sheets.includes(sheet) : Array.from(sheets ?? []).includes(sheet);
}
