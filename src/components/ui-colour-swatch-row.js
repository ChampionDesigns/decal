/**
 * ui-colour-swatch-row — Wave 4 item #52, the Colour swatch row (settings compound).
 *
 * Part 4 Wave 4, "Settings-screen compounds" table, row #52: "Colour swatch row | LED
 * colour selection row. Selected treatment via --ui-border-w-strong, not a private 3px.
 * The picker it feeds keeps the live preview (D7 — overruled, stays in v1) with the
 * accepted write pattern: no debounce timer, one write in flight, latest-wins. | small |
 * selection dials".
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #52): "Colour swatch row | slate-shell.css:1990-1999".
 * Spec §4.4 lists it among the Settings screen's components; §3.6 names its token by name:
 * "--ui-border-w-strong | 2px | slate-shell.css:1997 (selected swatch border-width: 3px)".
 *
 * =========================================================================
 * WHAT THIS ROW IS: TEN COLOURS, ONE OF WHICH THE MACHINE IS WEARING
 * =========================================================================
 *
 * The Lighting leaf offers a strip of LED preset colours. Pressing one asks the machine
 * to wear it; the lit swatch says which one the machine currently has. That second half
 * is the whole design, and it is the same shape ui-preset-bank (#37) argues at length:
 * the highlight is DERIVED from the current value and READ-ONLY in both directions. It
 * is also Slate's own shape, and Slate says so in code —
 * SOURCE `slate/app/src/settings/settings.js:4269-4272` (read read-only):
 *
 *     for (const swatch of root.querySelectorAll('[data-led-preset]')) {
 *         const on = resolveLedPresetHex(swatch.dataset.ledPreset) === currentHex;
 *         swatch.classList.toggle('is-selected', on);
 *         swatch.setAttribute('aria-pressed', on ? 'true' : 'false');
 *     }
 *
 * — the selection is recomputed from the current colour, never written by the press. A
 * press therefore publishes an INTENT (`swatch-select`) and this component's paint does
 * not move until `value` comes back changed. A colour the machine refuses never lights.
 *
 * =========================================================================
 * THE DEFECT THIS COMPONENT MAKES INEXPRESSIBLE — MEASURED, AND BIGGER THAN THE ROW SAYS
 * =========================================================================
 *
 * DISQUALIFICATION CHECK FIRST (SCOPE Part 10 §4). The oracle's measured swatch is
 * quoted below and then NOT matched, because matching it reproduces a defect. The
 * authored rules are the reference instead — which is also the side spec §3.6 already
 * took when it derived --ui-border-w-strong from `slate-shell.css:1997`, a line whose
 * declaration never reaches the screen.
 *
 * `.slate-swatch` (`slate-shell.css:1986-1994`) is a careful little rule with a careful
 * comment above it:
 *
 *     P30 — a colour swatch is a sample, so its ring must be legible against BOTH
 *     the swatch and the page. --slate-line-strong clears 3:1 on either, which the
 *     old outline colour did not: preset 0 is #000000 and sat behind a 2.0:1 ring
 *     on a near-black canvas, invisible in every sense.
 *
 *     border: 2px solid var(--slate-line-strong) !important;
 *     border-radius: 50% !important;
 *
 * and `.slate-swatch.is-selected` (`:1996-2001`) is the selected treatment this row's
 * spec line is about:
 *
 *     border-width: 3px;
 *     border-color: var(--slate-text);
 *     box-shadow: 0 0 0 3px var(--slate-canvas);
 *
 * NONE OF THOSE FIVE DECLARATIONS REACHES A PIXEL. The generic Settings button reset
 * (`slate-shell.css:716-724`) marks border-width, border-color, border-radius and
 * box-shadow `!important`, and its `:not()` arguments contribute their own specificity,
 * so it outranks `.slate-swatch` on the important side and beats `.is-selected` simply
 * by being important at all. Measured, mechanically, through prov_query:
 *
 *   CITE settings-accessories-lighting .slate-swatch [i=58] border-top-width = 1px  <-
 *        slate-shell.css  `#subpage-host #settings-content-area :is(button,
 *        [role="button"]):not(.toggle):not(.slate-stepper > *):not(.slate-bank-item)`
 *        authored `1px`  !important=yes  (FROZEN/hardcoded)
 *   CITE settings-accessories-lighting .slate-swatch [i=58] border-top-color: dark
 *        rgb(58, 72, 82) / light rgb(203, 208, 211)  <-  slate-shell.css  (the same
 *        rule)  authored `(NOT CAPTURED — set via a CSS shorthand)`  !important=yes
 *   CITE settings-accessories-lighting .slate-swatch [i=58] border-top-left-radius =
 *        6px  <-  slate-shell.css  (the same rule)  !important=yes  (token-driven)
 *   CITE settings-accessories-lighting .slate-swatch [i=58] box-shadow = none  <-
 *        slate-shell.css  (the same rule)  authored `none`  !important=yes
 *
 * Read them together: the ring is 1px of --slate-line — which in dark is rgb(58, 72, 82)
 * and is EXACTLY the 2.0:1 ring P30 was written to replace — the sample is a 6px
 * rounded rectangle rather than a circle, and every declaration of the selected state is
 * dead, so a selected preset and an unselected one are the same pixels. Slate's sheet
 * documents this exact cascade failure twice, at `:1081-1088` ("the selected rule's
 * background lost to the unselected one, !important on both") and at `:1456-1461`, and
 * did not notice it happening here. It is the mechanism of bug T3 and the family of T6.
 *
 * THE CORPUS CANNOT SHOW THE SELECTED SWATCH, AND THAT IS ITSELF THE FINDING:
 *   CITE `prov_query.py find --cls is-selected` -> 3 elements in 3 states, all of them
 *        editor tabs at 143 x 80 (#editor-tab-0/1/2). No swatch in any of the 49 states
 *        carries it, because in the captured Lighting state the machine's colour matched
 *        no preset — the honest nothing-selected case, rendered.
 * So the selected swatch's paint is UNMEASURED (Part 10 §4's carve-out) and the two
 * source rules above are quoted read read-only, as the tool instructs.
 *
 * HERE IT CANNOT HAPPEN. There is no outer sheet, because there is no way into a shadow
 * root: "Nothing can reach into a shadow root, so the only remaining reason to write
 * [!important] would be to beat the base rules" (CONVENTIONS §6). The ring, its selected
 * weight and the selected paint are all declared in this file, in tokens, and the only
 * thing that can change them is the token. That is the wave's claim rendered rather than
 * asserted, and `test/render/ui-colour-swatch-row.render.test.mjs` §3 proves it by
 * appending a document sheet full of `!important` aimed at every class here and showing
 * it reaches nothing.
 *
 * =========================================================================
 * SELECTION: THE FOUR DIALS PAINT IT, --ui-border-w-strong WEIGHS IT
 * =========================================================================
 *
 * The wave's standing rule is that no component here may own a private selected look —
 * "#36/#37/#39's chips/#52 all express selection through #3 or its four
 * --slate-selected-* dials" (`DECISIONS.md:244`, spec §3.9). A colour swatch has one
 * complication no other selection surface has: ITS FACE IS DATA. Painting
 * --ui-selected-face over a swatch would erase the one thing the swatch is for.
 *
 * So the button and the sample are two elements, and only one of them is the selection
 * surface:
 *
 *     button.swatch   the selection surface — transparent at rest, and when pressed it
 *                     takes --ui-selected-face, --ui-selected-ink, the --ui-selected-led
 *                     inset strip and the --ui-selected-glow, all from `selectionSurface`
 *                     and none of them written here. Visually it is a seated ring around
 *                     the sample, which is precisely what Slate's dead `.is-selected`
 *                     rule was drawing with border-color + a canvas halo.
 *     span.chip       the sample. Its fill is the machine's colour, arriving as data
 *                     through --_ui-swatch-fill, and no state touches it.
 *
 * The one thing this component states about selection is the ring's WEIGHT, and the row
 * names the token: "Selected treatment via --ui-border-w-strong, not a private 3px". So
 * `--ui-border-w` at rest, `--ui-border-w-strong` when pressed — two tokens from spec
 * §3.6's border family, one of which exists for this line. That is not a private look:
 * it is a shared token, and turning it moves every strong border in the skin.
 *
 * THE ARIA STATE IS THE VISUAL STATE. `aria-pressed` and nothing else (Appendix 15, "the
 * aria-*-driven state selectors ... the right contract for a Lit component's reflected
 * properties"; spec §3.9's state contract). It is also Slate's own spelling here
 * (`settings.js:3903`), which is the one part of this row Slate got right and T15 —
 * "selection is class-only with no aria-current/aria-selected" — did not have to reach.
 *
 * =========================================================================
 * GATE 2 — NO SERVER DATA IS READ HERE, AND THAT IS NOT AN EVASION
 * =========================================================================
 *
 * There is no frame, no key string and no fetch in this file. `swatches` is the screen's
 * palette; `value` is the machine's current colour, handed in as a prop. The Lighting
 * screen reads it through `src/stores/` and the `src/data/` address layer one level up,
 * where the machine names live, and writes it through the generated client — exactly the
 * split ui-preset-bank.js states for the same reason. What IS imported from the address
 * layer is its absence predicate, `isNoReading`, so an absent colour is a state (nothing
 * selected) rather than a prompt to invent one. There is no `?? compute` below (A7).
 *
 * THE FOUR ROUTES, CHECKED AT BUILD TIME AGAINST THE HANDLER AS WRITTEN — which is D7's
 * second lesson and a standing rule. The LED strip's real surface is GET and PUT
 * /machine/ledStrip, POST .../commit and POST .../reset, all four already recorded in
 * `src/data/CONTRACTS.json` (rows getMachineLedStrip, putMachineLedStrip,
 * postMachineLedStripCommit, postMachineLedStripReset) against
 * ReaPrime `de1handler.dart:186, :202, :221, :230`. This component consumes none of
 * them; it names them so the screen that does has the list.
 *
 * AND THE TWO THAT DO NOT EXIST. The old skin's cross-state preview called
 * POST /machine/ledStrip/preview and .../preview/clear (`api.js:1416`, `:1426`); neither
 * appears anywhere in ReaPrime, every call 404s, and the failure is swallowed at
 * `settings.js:4110` with "preview is a nicety". They are excluded surface
 * (`src/data/EXCLUDED.md`, enforced by `test/rea-excluded.test.mjs`) and must not be
 * called from anywhere. Whether the cross-state preview needs them upstream or should be
 * dropped from the design is open as Q5 (`SCOPE.md:5144`) — which is a question for the
 * picker, not for this row: a swatch press is same-state by construction.
 *
 * =========================================================================
 * D7 — WHAT THIS COMPONENT OWES THE LIVE PREVIEW, AND WHAT IT DOES NOT
 * =========================================================================
 *
 * D7 was overruled: the live preview stays in v1. The diagnosis was a trailing-edge
 * debounce — `ledSchedulePut` (`settings.js:4114`) restarts a 120 ms timer on every
 * pointer move, so during a drag it can never expire and fires once, on release
 * (SCOPE Part 1, "The D7 reversal"). The accepted pattern is "no timer at all ... keep a
 * pendingColour, one write in flight, issue the next write when the previous one
 * resolves, latest-wins".
 *
 * THIS FILE HAS NO TIMER, NO QUEUE AND NO TRANSPORT, and that is the pattern's component
 * half rather than a gap in it. A swatch press is one discrete intent, so there is
 * nothing to coalesce here; the write policy lives in the screen that owns the transport,
 * exactly as ui-rating-control.js:130-139 places it for the identical reason. What the
 * row DOES owe the pattern is the half a coalescing writer cannot supply on its own: the
 * paint must never run ahead of the machine, or a latest-wins write that loses would
 * leave the row lit on a colour the strip is not wearing. Hence the derived, read-only
 * highlight above.
 *
 * =========================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * =========================================================================
 *
 * 1. THE 16-BIT CONVERTERS. `led-color.js`'s `led8to16` / `ledRgbToColor16` /
 *    `ledColor16ToHex8` / `ledHexToRgb` implement the byte-replication convention shared
 *    with ReaPrime and the firmware (Part 6, `led-color.js` 51 -> ~25). They belong to
 *    whatever speaks the wire — the picker and the Lighting screen — and row #52's
 *    dependsOn names only "#3's selection dials", no port. This row's boundary is
 *    `#RRGGBB` in both directions, so the port can land later without changing it.
 *    `ledPreviewComposite` (`led-color.js:45-51`) is not to be ported at all: both
 *    endpoints it feeds are the invented pair above.
 * 2. `resolveLedPresetHex`'s var() HALF (`settings.js:3841-3848`). One Slate preset is
 *    stored as `var(--slate-primary)` and resolved with
 *    `getComputedStyle(document.documentElement)`. A component reaching out of its own
 *    root into the document to resolve a caller's data is not a thing this architecture
 *    does; a themed preset is the caller's to resolve before it hands one over. What IS
 *    carried is the comparison half of that function — `.slice(0, 7).toLowerCase()`,
 *    below as `normaliseHex`, so `#FFAA55` and `#ffaa55` are one colour.
 * 3. THE VISIBLE "Off" CAPTION (`settings.js:3906`, `slate-shell.css:2003-2008`): "Off is
 *    a colour you cannot see, so it says its own name", printed over the swatch in
 *    `mix-blend-mode: difference`. It answers the same question P30 does — how do you see
 *    a black swatch — and the ring answers it here for every swatch and both themes at
 *    once, which the caption does not (its ink is one colour against ten). Slate also
 *    keys it on the label string being "Off", which A3 refuses. Every swatch names itself
 *    to a screen reader through the `visuallyHidden` fragment instead.
 * 4. A ROVING TABINDEX. These are buttons in a `group`, not a toolbar or a radiogroup:
 *    each is its own tab stop, as in Slate. Arrow-key selection would also be wrong for
 *    the same reason ui-bank's toolbar mode exists — every press asks a machine to change
 *    something, so arrowing across ten swatches must not ask ten times.
 * 5. `::part()`. Theming crosses the boundary through custom properties only (A6). A part
 *    aimed at a selection surface is a second way to paint "selected" from outside, which
 *    is the whole shape of the defect above.
 *
 * =========================================================================
 * GEOMETRY — WHAT SLATE MEASURES, AND THE ONE DEPARTURE
 * =========================================================================
 *
 *   CITE `prov_query.py find --cls slate-swatch` -> found 10 element(s) in 1 state(s):
 *        settings-accessories-lighting, all 64 x 64, at x = 629, 707, 785, 863, 941,
 *        1019, 1097, 1175, 1253, 1331 and y = 816. [i=58] carries the text "Off".
 *   CITE settings-accessories-lighting .slate-swatch [i=58] background-color =
 *        rgb(0, 0, 0)  <-  <inline>  authored `rgb(0, 0, 0)`  !important=no
 *        (FROZEN/hardcoded)  — the fill is data, on the element, in both trees.
 *
 * 64 x 64 is carried, as `max(--ui-control-h, --ui-hit-min)`: --ui-control-h IS 64px
 * (styles/tokens.css:88), and the `max()` keeps the physical floor if a fork shrinks the
 * control token, because ergonomics is physical (CONVENTIONS §11; --ui-hit-min's 48px is
 * "a wet fingertip is about 9 mm"). No `.hit-overlay` is needed: the ink already exceeds
 * the floor on both axes, which is the case Appendix 5's utility is NOT for.
 *
 * THE DEPARTURE IS THE PITCH. 707 - 629 = 78, less the 64px swatch, is a 14px gap —
 * authored `gap-[14px]` (`settings.js:3897`) and one of the fourteen literals bug T20
 * names: "Fourteen distinct gap-[Npx] literals pass through the shell's rhythm rules
 * untouched." Disqualified, so the gap is --ui-space-3 (12px) from the spacing scale.
 * Nothing else moves.
 *
 * RESPONSIVE BEHAVIOUR IS THE SPEC'S, NEVER THE ORACLE'S. Slate's row is frozen at
 * 1920x1200 and wraps only because a flex container happens to. Here the row wraps
 * because wrapping is the honest answer for a set of fixed-size samples: the swatch never
 * shrinks below the touch floor and nothing is ever silently removed (spec §2.4). That is
 * already container-driven — flex wrapping resolves against this component's own inline
 * size, which the base makes a container — so there is no `@container` query to write and
 * `@media (width...)` appears nowhere (spec §2.1 Rule 1).
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { isNoReading } from 'src/data/reading.js';

/** Six hex digits, with or without the hash. Slate's own accepted shape. */
const HEX6 = /^#?([0-9a-fA-F]{6})$/;

/**
 * The comparison half of `resolveLedPresetHex` (`settings.js:3843`),
 * `raw.slice(0, 7).toLowerCase()`, expressed as a validity check rather than a slice.
 *
 * Returns the canonical `#rrggbb` or `null` — and `null` is the whole point: a slice
 * cannot tell "not a colour" from "a colour", so Slate's version turns any malformed
 * string into a seven-character prefix that then fails to match anything. Here an
 * unreadable value is ABSENT, which is the address layer's own vocabulary for it.
 */
export function normaliseHex(raw) {
    if (typeof raw !== 'string') return null;
    const match = HEX6.exec(raw.trim());
    return match ? `#${match[1].toLowerCase()}` : null;
}

/**
 * Strings or objects in, one shape out.
 *
 * A swatch with no readable colour is DROPPED rather than rendered empty: the element is
 * a colour sample and a button, so without a colour it has nothing to show, nothing to
 * apply and nothing to be named by. Rendering it would be an unnamed button (an
 * accessibility defect) painted as a hole (a rendering one) — two defects standing in for
 * a caller's typo. `swatchCount` reports what survived, so the drop is observable.
 */
function normaliseSwatch(raw) {
    const source = raw !== null && typeof raw === 'object' ? raw : { hex: raw };
    const hex = normaliseHex(source.hex);
    if (hex === null) return null;
    return {
        hex,
        label: source.label === undefined || source.label === null ? null : String(source.label),
        disabled: source.disabled === true,
    };
}

/** A swatch's accessible name: what the caller called it, or the colour itself. */
function nameOf(swatch) {
    return swatch.label || swatch.hex.toUpperCase();
}

export class UiColourSwatchRow extends UiElement {
    static properties = {
        /**
         * The palette. `'#RRGGBB'` strings, or `{ hex, label, disabled }` objects for a
         * swatch with a name. Parsed from a JSON attribute so the gallery and a screen's
         * markup can state one.
         *
         * NOT a data source: ReaPrime serves the strip's CURRENT colours, never a list of
         * suggestions, so the palette is the screen's (the old skin's `LED_PRESETS`,
         * `settings.js:3829-3833`). No key string, no frame, no fetch (Gate 2).
         */
        swatches: { type: Array },

        /**
         * Lay the palette out as a GRID of exactly this many columns, instead of a
         * wrapping row.
         *
         * Ben, 26 August 2026: "the grid is full — if it runs to two rows, both rows are
         * complete, so add colours to fill it." A wrapping row cannot promise that: how
         * many fit per row depends on the container, so the same sixteen swatches are
         * 8+8 at one width and 6+6+4 at another, and a ragged last row reads as a list
         * that ran out.
         *
         * ZERO OR ABSENT KEEPS THE WRAPPING ROW, which is what every other caller wants
         * and what the gallery shows.
         */
        columns: { type: Number },

        /**
         * The colour the machine is CURRENTLY wearing, as `#RRGGBB` — not this row's
         * opinion of it. Anything unreadable (an absence from `src/data/reading.js`, a
         * malformed string, nothing at all) highlights nothing, which is the state
         * Slate's own Lighting capture is in.
         *
         * NOT reflected: an absence is an object, and reflecting it would serialise it
         * into the attribute and read it back as a string that is not a colour. The
         * readable state is `activeIndex`, which is derived anyway.
         */
        value: { type: String },

        /** Accessible name for the GROUP — the question the row answers. */
        label: { type: String },

        /** Paint from the base's one disabled dial; behaviour from the real buttons. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        /* Structural fragment first (CONVENTIONS §4 usage rule 1, §5a). */
        visuallyHidden,

        css`
            :host {
                /* PRIVATE GEOMETRY (CONVENTIONS §7): lengths only, never a colour, and
                 * --_ui- so the token-integrity check can never mistake one for a token.
                 *
                 * The size carries Slate's measured 64 x 64 through --ui-control-h, which
                 * IS 64px — and keeps --ui-hit-min underneath it, because density and
                 * theming may move a control token and may not move the physical floor. */
                --_ui-swatch-size: max(var(--ui-control-h), var(--ui-hit-min));

                /* The gap between the ring and the sample. It is transparent at rest and
                 * becomes --ui-selected-face when pressed, so this length is how much
                 * selected colour there is to see. */
                --_ui-swatch-seat: var(--ui-space-1);
            }

            /* The row. Wrapping is the container query: it resolves against this
             * component's own inline size (the base makes the host a container), so the
             * row reflows in a narrow leaf without one swatch shrinking, without a
             * scroller and without anything being removed (spec §2.1 Rule 1, §2.4).
             *
             * The gap is --ui-space-3, NOT Slate's authored 14px literal (bug T20). */
            .row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--ui-space-3);
            }

            /* A FIXED COLUMN COUNT, when a caller asks for one.
             *
             * The wrapping row above cannot promise a full last row: how many fit depends
             * on the container, so the same sixteen swatches are 8+8 at one width and
             * 6+6+4 at another. A caller that has chosen its palette to fill N columns
             * says so, and the grid honours it.
             *
             * THE TRACKS ARE CONTENT-SIZED, not fractions: a swatch states its own size
             * and must not be stretched by a track. The row then sits at its content
             * width, which is what makes a complete row look complete.
             * NO BACKTICK IN THIS COMMENT: one ends the css template. */
            .row[data-columns] {
                display: grid;
                grid-template-columns: repeat(var(--_ui-swatch-columns), auto);
                justify-content: start;
            }

            /* THE SELECTION SURFACE. Everything about the resting paint is on this class
             * and not on the id beside it: an id is (1,0,0) and would beat every
             * attribute selector in selectionSurface, so the swatch would silently never
             * turn selected (CONVENTIONS §4 usage rule 2). The id is for the tests.
             *
             * The ring is --ui-line-strong, which is P30's requirement finally applied:
             * the ring has to clear 3:1 against BOTH the sample and the page, and Slate's
             * measured 1px of --slate-line does not. */
            .swatch {
                /* display: block rather than the UA's inline-block so the sample can take
                 * 100% of the content box, and position: relative so the visually-hidden
                 * name resolves its static position against this button rather than
                 * escaping to the initial containing block.
                 * (No backticks anywhere in this template — CONVENTIONS §9; the first
                 * draft of this comment had two and cost one full test run.) */
                display: block;
                position: relative;
                inline-size: var(--_ui-swatch-size);
                block-size: var(--_ui-swatch-size);
                padding: var(--_ui-swatch-seat);
                border: var(--ui-border-w) solid var(--ui-line-strong);
                border-radius: var(--ui-radius-pill);
                background-color: transparent;
                color: var(--ui-text);
                cursor: pointer;
            }

            /* THE ROW'S OWN SENTENCE, and the only thing it states about selection:
             * "Selected treatment via --ui-border-w-strong, not a private 3px."
             * Slate's 3px lives at slate-shell.css:1997 and never renders; spec §3.6
             * created this token out of that line. (0,2,0) against selectionSurface's
             * (0,1,0), and a different property besides, so the two cannot collide. */
            .swatch[aria-pressed="true"] {
                border-width: var(--ui-border-w-strong);
            }

            .swatch[disabled] {
                cursor: default;
            }

            /* ONE DIAL, PAINTED ONCE. Disabling the row disables every button in it, and
             * the base dims BOTH the host and each [disabled] element, so without this
             * line the two multiply: .38 x .38 = .14, a row three times fainter than
             * every other disabled control in the skin. ui-preset-bank.js:322-330 and
             * ui-tab-bar.js:395-404 solve the identical arithmetic identically. The host
             * keeps the dial because it is the element a screen disabled. Specificity,
             * not !important. */
            :host([disabled]) .swatch[disabled] {
                opacity: 1;
            }

            /* THE SAMPLE. Its fill is DATA — the machine's colour — and it is the one
             * value in this component that crosses the shadow boundary as a colour, set
             * per element from the property below (ui-chart-legend.js:605 does the same
             * for a channel's stroke). No authored colour literal exists here: the
             * fallback is the transparent keyword, which carries no palette information.
             *
             * No state selector touches this element. That is what lets the button above
             * be the selection surface without erasing the colour the row is about. */
            .chip {
                display: block;
                inline-size: 100%;
                block-size: 100%;
                border-radius: inherit;
                background-color: var(--_ui-swatch-fill, transparent);
            }
        `,

        /* State fragment LAST, so selection beats the resting paint (CONVENTIONS §4). */
        selectionSurface,
    ];

    constructor() {
        super();
        this.swatches = [];
        this.value = null;
        this.label = '';
        this.disabled = false;
        this.columns = 0;
    }

    /**
     * An `aria-label` a screen wrote on this host, MOVED rather than copied.
     *
     * The host takes no role, and bug T15's first symptom on this screen is "aria-label
     * on role-less divs" — Chrome exposes the name anyway, so leaving it here would
     * announce the row twice, once anonymously. ui-preset-bank.js:337-352 made the same
     * move for the same reason; the name belongs on the element carrying the group role.
     */
    #hostLabel = null;

    /** The group's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.#hostLabel || '';
    }

    /** The palette, normalised, with unreadable entries dropped. */
    get #swatches() {
        return (Array.isArray(this.swatches) ? this.swatches : [])
            .map(normaliseSwatch)
            .filter((swatch) => swatch !== null);
    }

    /** How many swatches survived normalisation — so a dropped entry is observable. */
    get swatchCount() {
        return this.#swatches.length;
    }

    /**
     * The index of the swatch the CURRENT COLOUR matches, or -1 for none.
     *
     * Derived, and read-only in both directions: the match runs value -> swatch and never
     * the other way, so no press can make this return something the machine has not
     * confirmed. `isNoReading` is the address layer's absence predicate and there is no
     * fallback branch below it (A7): an absent colour matches nothing, exactly as Slate's
     * own captured Lighting state shows.
     */
    get activeIndex() {
        if (isNoReading(this.value)) return -1;
        const current = normaliseHex(this.value);
        if (current === null) return -1;
        return this.#swatches.findIndex((swatch) => swatch.hex === current);
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    render() {
        const swatches = this.#swatches;
        const active = this.activeIndex;
        const name = this.accessibleName;

        return html`
            <div
                id="row"
                class="row"
                role="group"
                aria-label=${name || nothing}
                data-columns=${this.columns > 0 ? String(this.columns) : nothing}
                style=${this.columns > 0 ? `--_ui-swatch-columns: ${this.columns}` : nothing}
            >
                ${swatches.map((swatch, index) => html`
                    <button
                        id="swatch-${index}"
                        class="swatch"
                        type="button"
                        aria-pressed=${index === active ? 'true' : 'false'}
                        ?disabled=${swatch.disabled || this.disabled}
                        @click=${() => this.#press(index)}
                    >
                        <span class="chip" style="--_ui-swatch-fill: ${swatch.hex};"></span>
                        <span class="a11y">${nameOf(swatch)}</span>
                    </button>
                `)}
            </div>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /**
     * Move a screen-written `aria-label` onto the group. Returns true only on the update
     * that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    /**
     * A press. It publishes an intent and changes nothing that is painted.
     *
     * The event carries the swatch's HEX, never its rendered label — reading a value back
     * out of a string another module printed is the worst coupling the audit found
     * (`CARRY_FORWARD.md`, `chart.js:1664-1678`). The label rides along for a log or a
     * toast, as the second field.
     */
    #press(index) {
        const swatch = this.#swatches[index];
        if (!swatch || swatch.disabled || this.disabled) return;

        this.dispatchEvent(new CustomEvent('swatch-select', {
            detail: { hex: swatch.hex, label: nameOf(swatch), index },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-colour-swatch-row', UiColourSwatchRow);
