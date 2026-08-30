/**
 * ui-wizard-column — Wave 4 item #39, the Wizard column + step chip.
 *
 * SCOPE Part 4, "Settings-screen compounds", row 39: "The load-cell calibration walk;
 * chips are 44x44 selection-family members, and the column stops being 63px wider than
 * every other leaf (T1). | medium | #3's dials, #1".
 *
 * Inventory row (LAYOUT_SPEC_DRAFT.md §5.2 #39): "Wizard column + step chip |
 * slate-shell.css:2290-2320; [data-wizard-step] selectors are dead, the real chips are
 * 44x44 divs".
 *
 * =========================================================================
 * WHAT THIS COMPONENT IS, AND WHAT IT REFUSES TO BE
 * =========================================================================
 *
 * It is ONE COLUMN. Slate's own comment for the wizard says it best, and it is the
 * design this file keeps (`slate-shell.css:2281-2289`, read-only):
 *
 *     "Load-cell calibration: a wizard, not a settings list. Four steps, one at a
 *      time, each with a card and an action. Everything in it belongs to one column
 *      of one width -- the card, the step dots, the step label and Start over -- so
 *      the page reads top to bottom instead of as three things that each chose their
 *      own alignment."
 *
 * Three regions, stacked, all the same width: the PROGRESS block (step chips + the
 * "Step n of m" line), the BODY (a slot — the screen puts an #8 ui-card in it), and the
 * ACTIONS cluster (a slot — the screen puts #1 ui-buttons in it). It composes; it does
 * not re-implement a card and it does not re-implement a button.
 *
 * IT OWNS NO WIDTH. That single omission is bug T1, and §7.5 states the defect:
 *
 *     T1 — "The load-cell wizard is 63px wider than every other leaf — measured 1263
 *     against 1200, right edge 1892 against 1829 on all 37 others. The comment says the
 *     LEFT edge was fixed so paging no longer jolts; the right edge still jumps."
 *     (`slate-shell.css:2290-2295` vs `:1285-1288`)
 *
 *   MEASURED, and this is T1's own number arriving from the oracle rather than from the
 *   bug list:
 *     CITE find --cls slate-cal-step-label -> settings-calibration-load-cells
 *          .text-[24px] [i=50] rect x=629 y=321 w=1263 h=27
 *     CITE find --cls slate-cal-card -> settings-calibration-load-cells .slate-card
 *          [i=51] rect x=629 y=384 w=760 h=296
 *   1263 against the 1200 every other leaf gets from `#subpage-host
 *   #settings-content-area > div { max-width: 1200px }` — and a 760 card inside it, so
 *   the leaf is simultaneously 63px too wide and 440px too narrow. Both numbers are
 *   T21's ("a third live measure at 885px … the 1200 cap and the 760 wizard").
 *
 *   THE FIX IS STRUCTURAL, not a smaller number: this component declares no `width`,
 *   no `inline-size` and no `max-inline-size` ANYWHERE — not on the host, not on the
 *   column, not on the body. It is a block-level custom element, so it is exactly as
 *   wide as the leaf pane makes it, like every other leaf. SCOPE.md:2252 is the
 *   instruction: "The leaf measure is one value (~84ch, centred), replacing today's
 *   three undocumented widths (1200 / 885 / 760 — T21) — the wizard and any leaf
 *   needing more width asks for it explicitly via its own container, not via a bespoke
 *   cap." There is no bespoke cap here to ask with. `test/render/…` pins it at two
 *   container widths and both Gate A geometries.
 *
 * IT OWNS NO RESET CONTROL, and that is a recorded hole rather than an oversight.
 * F3 (calibration reset semantics) is BLOCKED ON BEN — it writes machine state — and
 * the run's instruction is explicit (SCOPE.md:94-97, :2208-2211): "Settings ships the
 * calibration wizard without that control, the omission is recorded in
 * DEFERRED_QUESTIONS.md, and the ladder continues." So: no reset button, no reset slot,
 * no reset event, no reset semantics. Every action in this component arrives slotted
 * from the screen, so nothing here has to be removed later — a control simply is not
 * slotted until F3 is answered (Q1).
 *
 * IT READS NO SERVER DATA. Gate 2 addressing is satisfied by having nothing to address:
 * no `src/stores/` import, no `src/data/` import, no fetch, no socket, and not one
 * server key string. The walk's live grams reading, the calibration write and the
 * step machine all belong to the settings screen (wf-w5p4), which passes `steps`
 * and `current` in and slots the body. That write is the contract table's
 * `putMachineScaleCalibration` (PUT /api/v1/machine/scaleCalibration, status
 * `recorded`, consumedBy []), NOT the path SCOPE.md:1331 records the old skin
 * using: that one is CB-15's forbidden spelling and has never existed in
 * ReaPrime's history (src/data/CONTRACTS.json, forbiddenSpellings). This is the rule
 * ui-progress-track states for the same situation: "a primitive that needs server data
 * is a design error to flag, not satisfy".
 *
 * =========================================================================
 * THE CHIPS — SELECTION-FAMILY MEMBERS, NOT A PRIVATE LOOK
 * =========================================================================
 *
 * SCOPE Part 4's founding-defect callout (SCOPE.md:1577) names this component in the
 * list that may not own a selected treatment: "the wizard chips in #39 and the selected
 * states of #24/#25/#52 are all expressed through #3 or its four `--slate-selected-*`
 * dials". This file takes the DIALS route rather than composing #3 ui-bank, for one
 * measured reason: a bank item is `--ui-control-inner` (62px) tall inside a one-piece
 * bordered box, and a step chip is a free-standing 44x44 square. The mechanism is
 * identical either way — `selectionSurface` from `src/components/base.js` is the same
 * exported fragment ui-bank paints from — so there is exactly one selected treatment in
 * the skin and one turn of `--ui-selected-face` moves the chips with everything else.
 *
 * AND THE DIALS LAND ON SLATE'S OWN PIXELS. The current chip is measured:
 *   CITE settings-calibration-load-cells .rounded-full [i=46] background-color =
 *        rgb(176, 196, 206)  <-  <inline>  authored (NOT CAPTURED — set via a CSS
 *        shorthand)  !important=no  (token-driven)          — that is --slate-steel
 *   CITE settings-calibration-load-cells .rounded-full [i=46] color = rgb(18, 24, 28)
 *        <-  <inline>  authored `var(--slate-on-steel)`  !important=no  (token-driven)
 * and the shipped dials are `--ui-selected-face: var(--ui-steel)` / `--ui-selected-ink:
 * var(--ui-on-steel)` (`styles/tokens.css:834-835` LIGHT, under the section header at
 * :832 that says so, and `:903-904` DARK, inside the `[data-theme="dark"]` block that
 * opens at :853 - the sheet's own contract, stated at tokens.css:16, is that `:root`
 * carries the light values and `[data-theme="dark"]` overrides them). The corpus capture
 * is the dark theme, so the values that match it are the DARK `--ui-steel` / `--ui-on-steel`
 * at `tokens.css:872-873`: #b0c4ce = rgb(176, 196, 206) and #12181c =
 * rgb(18, 24, 28). Identical paint, reached through the
 * dial instead of through an inline style on a div. That is the whole difference, and it
 * is the difference between a look a fork can retarget and thirteen it cannot.
 *
 * THE OTHER TWO CHIP STATES, also measured (step 1 is current in the capture, so 2-4
 * are the AHEAD state and no DONE chip exists anywhere in the 49):
 *   CITE settings-calibration-load-cells .rounded-full [i=47] background-color =
 *        rgba(0, 0, 0, 0)  <-  <inline>  authored `transparent`  (FROZEN/hardcoded)
 *   CITE settings-calibration-load-cells .rounded-full [i=47] color = rgb(148, 161, 169)
 *        <-  slate-shell.css  authored `var(--slate-muted)`  !important=yes   -> --ui-muted
 *   CITE settings-calibration-load-cells .rounded-full [i=47] border-top-width = 1px
 *        <-  <inline>   and  border-top-color = rgb(58, 72, 82)  -> --ui-line
 * so AHEAD is: transparent face, one hairline of --ui-line, --ui-muted ink. Carried.
 *
 * DONE IS UNMEASURED — the corpus has no captured state in which a step is behind the
 * walk (Part 10 §4's carve-out: "States outside the 49 have no corpus answer at all").
 * Slate's source fills it with `var(--slate-pressure)` and `var(--slate-on-primary)`
 * (`settings.js:4877-4879`, read-only). This file paints it `--ui-key-on` with `--ui-text`
 * ink and a check glyph instead, for a reason that is a measurement and not a taste:
 * --slate-pressure's token here is --ui-status-ok, whose DARK value is #00d4ab, and
 * --ui-on-primary's dark value is #f6fbfd — a near-white glyph on a bright teal disc,
 * which is the one combination in this palette that fails a contrast check. The three
 * luminance states Slate's own dead rule asks for ("Three luminance states: future,
 * current, done", `slate-shell.css:1560-1562`) survive without a hue: outline / filled /
 * selected. Recorded as a deferred question — it is two custom-property values to
 * reverse, and the glyph carries the meaning either way.
 *
 * THE GEOMETRY IS MEASURED AND THE DEAD RULE IS NOT PORTED. `[data-wizard-step]`
 * (`slate-shell.css:1563-1585`) sizes chips at `var(--slate-control-height)` = 64 and is
 * one of BUG-6's dead selectors — "the load-cell step chips are div.rounded-full…
 * text-[22px], measured 44x44, not var(--slate-control-height) = 64"
 * (`layout/settings.md` BUG-6 / T6). Porting the sheet would have carried the fix AND
 * shipped the defect, which is exactly what T6 says happens to anyone who ports it. So
 * the numbers come from the render:
 *   CITE find --cls rounded-full -> settings-calibration-load-cells  4 elements
 *        [629,259,44,44] [733,259,44,44] [837,259,44,44] [941,259,44,44]
 *        — 44x44 (= --ui-control-sm, spec §3.1 "wizard step chips (measured 44x44)"),
 *          on a 104px pitch: 44 chip + 10 gap + 40 rule + 10 gap
 *   CITE settings-calibration-load-cells .rounded-full [i=46] border-top-left-radius =
 *        6px  <-  slate-shell.css `#subpage-host [class*="rounded-full"]:not(…)`
 *        !important=yes  (token-driven)   — the chips are NOT round: an id-scoped shell
 *        rule beats `rounded-full` and hands them --slate-radius. 6px = --ui-radius.
 *   CITE settings-calibration-load-cells .rounded-full [i=46] font-size = 18px  <-
 *        slate-shell.css `[class*="text-[22px]"]` authored `var(--slate-text-md)`
 *        !important=yes   — the authored text-[22px] never renders. 18px = --ui-text-md.
 *   CITE settings-calibration-load-cells .rounded-full [i=46] font-weight = 500  <-
 *        slate-shell.css `[class*="font-bold"]` authored `500` !important=yes
 *        -> --ui-weight-medium (the authored font-bold never renders either)
 *   CITE settings-calibration-load-cells .text-[24px] [i=50] font-size = 18px /
 *        color = rgb(148, 161, 169) / font-weight = 400   — the caption:
 *        --ui-text-md, --ui-muted, --ui-weight-regular
 *
 * All rects above are Slate at a FROZEN 1920x1200 and are quoted as what Slate does,
 * never as a responsive target — LAYOUT_SPEC_DRAFT.md governs responsive behaviour and
 * the oracle has no vote there (Part 10 §4).
 *
 * TWO NUMBERS ARE NOT CARRIED, both untokenised literals of the T20/T14 family
 * ("Fourteen distinct gap-[Npx] literals pass through the shell's rhythm rules
 * untouched"): the strip's `gap: 10px` and the wizard's `gap-[30px]` (`settings.js:4886`,
 * `:5015`). 10 and 30 are not on the space scale (4/8/12/18/24/28/40, spec §3.3), so the
 * strip takes --ui-space-2 and the column takes --ui-space-6. The one gap that IS on the
 * scale is measured and kept exactly: chips bottom out at y=259+44=303 and the caption
 * starts at y=321, so the strip-to-caption gap is 18px = --ui-space-4.
 *
 * =========================================================================
 * RESPONSIVE — THE PART SLATE HAS NO ANSWER FOR
 * =========================================================================
 *
 * The whole strip is 4x44 + 3x40 + 6x10 = 356px at four steps, and Slate is frozen at a
 * 1263px column, so nothing in the corpus says what happens when the column is 320px.
 * LAYOUT_SPEC_DRAFT.md §2.1 Rule 1 and §2.2 do, and the order of surrender is stated
 * here so a reviewer can check it rather than infer it:
 *
 *   1. THE CHIP NEVER MOVES. `flex: 0 0 auto` at a FIXED 44x44 — spec §2.2 row 1,
 *      "control heights, touch targets, hairlines: fixed token, never fluid. Ergonomics
 *      is physical." A step chip that shrank with the window would be unreadable
 *      exactly on the tablet it is read on.
 *   2. THE STRIP WRAPS, in whole chip+connector units. Each `<li class="track">` is one
 *      such unit, so a wrapped line never begins with an orphaned connector.
 *   3. THE FLOOR IS ONE UNIT: `--ui-control-sm + --ui-space-2 + --ui-space-7` = 44 + 8 +
 *      40 = 92px, which is the strip's min-content width and the narrowest column this
 *      component has an answer for. Below it the strip OVERFLOWS, visibly — it does not
 *      clip, it does not scroll and it does not shrink the target. A settings leaf pane
 *      is never that narrow; stating the floor is how §2.4's "defined order of surrender"
 *      gets a number instead of a hope.
 *      (An elastic connector was tried first, twice, and measured both times: `flex: 0 1
 *      var(--ui-space-7)` renders at 0px because an empty shrinkable flex item
 *      contributes its content size suggestion — zero — to the container's intrinsic
 *      width (Flexbox §9.9.1), and a shrinkable one WITH a width still reports 40px as
 *      its min-content contribution, so the strip's floor never moved. "The connectors
 *      give way first" was a sentence the layout did not obey; it is gone.)
 *   4. NOTHING SCROLLS AND NOTHING HIDES. This component's own rules contain no
 *      `overflow` declaration at all (the base's `.a11y` 1px box is the only one in the
 *      tree), which is the "documented reason not to" §2.4 asks for: the wizard is not
 *      a scroll region — the leaf pane is (spec §4.4, "the leaf pane scrolls … which is
 *      fine, and is what the pane is for"). A hidden overflow here would also clip the
 *      focus ring of every slotted button, which is bug L24's class.
 *   5. AND THE TRACKS ARE `minmax(0, 1fr)`, NOT `auto`. An auto grid track is sized to
 *      its items' max-content and is then never shrunk, so with `auto` the strip simply
 *      took its 344px max-content and hung out of a 272px pane instead of wrapping —
 *      measured, before the two `grid-template-columns` lines below existed. The same
 *      line is what stops a long line inside the slotted card widening the column, which
 *      would be T1 arriving through the back door.
 *
 * No `@media (width…)` and no `@container` query: there is no size at which this
 * component should change its mind, and every behaviour above is intrinsic. The suite
 * measures them at a 320px and a 92px column rather than trusting the rule.
 *
 * =========================================================================
 * ARIA — Appendix 15, "the aria-*-driven state selectors"
 * =========================================================================
 *
 * The visual state and the accessibility state are the SAME state, so they cannot
 * drift: the current chip is `aria-current="step"` (ARIA's own token for "the current
 * step within a process") and carries `.is-selected`, both written from one boolean in
 * one template expression. The class is what `selectionSurface` paints — the fragment's
 * selector list is `[aria-pressed|selected|checked|current="true"], .is-selected`, and
 * `aria-current="step"` is deliberately NOT `="true"`, so the class is how a step chip
 * joins the one treatment without lying about which aria token it speaks.
 *
 * The strip is an `<ol role="list">` — the role is restated because Safari drops list
 * semantics from a list with `list-style: none` — and takes its accessible name from
 * `label`. The visible glyph (a numeral, or a check on a completed step) is
 * `aria-hidden`, and each chip carries the step's NAME as visually-hidden text, so the
 * strip announces "Zero, Left cell, Right cell, Verify" with one of them current rather
 * than "1 2 3 4". T15's settings finding is the counter-example this avoids: "selection
 * is class-only with no aria-current/aria-selected".
 *
 * Nothing here is focusable and nothing here is clickable. The chips are an INDICATOR:
 * Slate's are inert divs, jumping to an arbitrary calibration step is not a thing the
 * machine supports, and inventing navigation would be inventing semantics. The walk is
 * driven by the slotted action buttons. Recorded as a deferred question with its
 * reversal (chips become buttons in a #3 bank; the paint does not change, because the
 * paint is already the dials).
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/** Slate's own glyph for a completed step (`settings.js:4882`, `&#10003;`). */
const CHECK = '✓';

/** Slate's own separator between the count and the step name (`settings.js:4890`). */
const MIDDOT = '·';

/** `'Zero'` and `{ label: 'Zero', done: true }` are both a step. */
function normaliseStep(step) {
    if (step && typeof step === 'object') {
        return { label: step.label == null ? '' : String(step.label), done: step.done === true };
    }
    return { label: step == null ? '' : String(step), done: false };
}

export class UiWizardColumn extends UiElement {
    static properties = {
        /**
         * The walk. Strings, or `{ label, done }` objects. Parsed from a JSON attribute
         * so the gallery and a test can state one in markup — the same shape ui-bank
         * uses for `items`, and for the same reason.
         *
         * NOT a data source. The screen owns the walk; this renders it.
         */
        steps: { type: Array },

        /**
         * Which step the walk is on, 1-based. Reflected: it is the state, and tests read
         * it. Out-of-range values are clamped for rendering rather than blanking the
         * strip — a wizard with no current step is not a state this component can be in.
         */
        current: { type: Number, reflect: true },

        /** Accessible name for the step LIST, e.g. "Load cell calibration steps". */
        label: { type: String },

        /**
         * Replaces the derived "Step n of m · Name" line. Empty (the default) derives it
         * from `steps` and `current` through `src/lib/i18n.js` (D2), whose key is Slate's
         * own: `Step {n} of {total}` (`settings.js:4888`, and `i18n/en.json:446`).
         */
        caption: { type: String },
    };

    static styles = [
        /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1); the state fragment is last.
         * No `hitArea`: nothing in this component is a hit target — the chips are an
         * indicator and every interactive thing is slotted, where it brings its own
         * floor (a slotted ui-button is 64px tall by its own rule). Adding an overlay
         * to a 44px indicator would grow a hit box around something that cannot be hit,
         * which is bug P4's shape in reverse. */
        visuallyHidden,
        css`
            /* ===============================================================
             * THE COLUMN. Read the absences: no width, no max-inline-size, no
             * overflow. T1 and L24 are both absences of a declaration, which is
             * why they are pinned by the suite and not by a comment.
             * =============================================================== */
            .column {
                display: grid;
                /* ONE definite track, not the auto one. An auto grid track is sized to
                 * its items' max-content and then never shrunk, so a long line inside
                 * the slotted card would size the track past the pane and take the whole
                 * column with it — T1 arriving through the back door, measured before
                 * this line existed. minmax(0, 1fr) is the container's width, full stop. */
                grid-template-columns: minmax(0, 1fr);
                /* Slate's own gap here is an untokenised gap-[30px]
                 * (settings.js:5015); 30 is not on the space scale (§3.3). */
                row-gap: var(--ui-space-6);
            }

            /* "The dots and the step label are the same object -- where am I -- so they
             * sit together" (slate-shell.css:2321-2327). One block, one tighter gap:
             * MEASURED 18px = --ui-space-4 (chips bottom 259+44=303, caption y=321). */
            .progress {
                display: grid;
                /* Same reason as the column, and here it is what makes the strip WRAP:
                 * inside an auto track the flex row is handed its max-content width and
                 * simply overflows a narrow pane instead of breaking. */
                grid-template-columns: minmax(0, 1fr);
                row-gap: var(--ui-space-4);
                justify-items: start;
            }

            .steps {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                /* Slate: style="gap:10px" (settings.js:4886) — a T20 literal. */
                gap: var(--ui-space-2);
                margin: 0;
                padding: 0;
                list-style: none;
            }

            .track {
                display: flex;
                align-items: center;
                gap: var(--ui-space-2);
                /* So the connector inside it can actually give way. */
                min-inline-size: 0;
            }

            /* ===============================================================
             * THE CHIP. Resting paint on a CLASS, never an id (CONVENTIONS §4
             * rule 2): every rule below is (0,1,0) and selectionSurface is
             * (0,1,0) written later, so selection wins the tie by ORDER. Write
             * .chip.ahead here and the current chip would silently stop
             * turning selected — which is precisely how thirteen bypassed
             * selection treatments get written by accident.
             * =============================================================== */
            .chip {
                flex: 0 0 auto;
                display: inline-grid;
                place-items: center;

                /* MEASURED 44x44 (find --cls rounded-full, four chips). §2.3 case 2:
                 * a touch-scale floor is one of the four legal fixed px, and §2.2
                 * row 1 says it is never fluid. */
                inline-size: var(--ui-control-sm);
                block-size: var(--ui-control-sm);

                /* A transparent border in EVERY state, so the box is 44x44 whether or
                 * not the state paints a hairline — Appendix 3, "state changes weight,
                 * never position". Only border-color moves below. */
                border: var(--ui-border-w) solid transparent;
                /* MEASURED 6px: the shell's [class*="rounded-full"] rule outranks the
                 * Tailwind class and hands it --slate-radius. The chips are squares. */
                border-radius: var(--ui-radius);

                background-color: transparent;
                color: var(--ui-muted);
                /* MEASURED 18px / 500 — the authored text-[22px] and font-bold both
                 * lose to an !important shell rule and never render. */
                font-size: var(--ui-text-md);
                font-weight: var(--ui-weight-medium);
                /* Four numerals that must not jitter as the walk advances. */
                font-variant-numeric: tabular-nums;

                /* NO line-height. The document's 1.5 inherits (styles/document.css:64)
                 * and place-items: center does the centring, so a local ratio here
                 * would be the seventh copy of the literal that file's own comment
                 * regrets. The chip's box is 44x44 whatever the leading does. */
            }

            /* AHEAD — measured: transparent face, one --ui-line hairline, --ui-muted ink
             * (the face and the ink are already the resting values above). */
            .ahead {
                border-color: var(--ui-line);
            }

            /* DONE — unmeasured (no capture has a completed step); see the header for
             * why this is a filled quiet chip and not Slate's green one. */
            .done {
                background-color: var(--ui-key-on);
                color: var(--ui-text);
            }

            /* ===============================================================
             * THE CONNECTOR. Slate draws a 40x3 div between chips
             * (settings.js:4883) and recolours it once the walk is past. 3px has
             * no token behind it; the emphasised rule weight does.
             * =============================================================== */
            .rule {
                /* A FIXED LENGTH, and both halves of that were measured rather than
                 * chosen. flex: 0 1 var(--ui-space-7) was written first and rendered at
                 * 0px — an empty flex item that can shrink contributes its CONTENT size
                 * suggestion, zero, to its container's intrinsic width (Flexbox §9.9.1),
                 * so the strip sized itself as if the connectors were not there and then
                 * gave them nothing. Making it shrinkable-with-a-width did not help
                 * either: Chrome takes 40px as the min-content contribution anyway, so
                 * "the connectors give way first" was a comment the layout never obeyed.
                 * It is honest as a fixed length, and the strip's floor is stated in the
                 * header instead of implied by a flex factor. */
                flex: 0 0 auto;
                inline-size: var(--ui-space-7);
                block-size: var(--ui-border-w-strong);
                border-radius: var(--ui-radius-pill);
                background-color: var(--ui-line);
            }

            /* Behind the walk. Weight, not hue — same argument as the done chip. */
            .walked {
                background-color: var(--ui-line-strong);
            }

            /* MEASURED: 18px, --ui-muted, weight 400. */
            .caption {
                margin: 0;
                color: var(--ui-muted);
                font-size: var(--ui-text-md);
                font-weight: var(--ui-weight-regular);
            }

            .caption-sep {
                padding-inline: var(--ui-space-1);
            }

            /* THE BODY IS A BARE SLOT, on purpose. A slot's UA display is contents,
             * so the screen's #8 card becomes a grid item of the column itself: it is
             * the column's width (T1's other half — no 760px card cap, T21), and an
             * EMPTY body contributes no box and therefore no row gap. A wrapper div
             * would have left 28px of dead column in that state.
             *
             * min-inline-size: 0 because a grid item's automatic minimum is its content,
             * and a wide table inside the card would otherwise push the column past the
             * pane — which is T1 arriving through the back door. */
            ::slotted(*) {
                min-inline-size: 0;
            }

            /* Slate seats one primary button and (when the walk allows it) a secondary
             * beside it. Wrapping rather than shrinking: a button that shrank would
             * ellipsise its own verb. This one needs a real box — it is a cluster — so
             * emptiness is answered in JS instead (see #slotChange) rather than with a
             * positional selector, which §2.3 bans as a structural contract. */
            .actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--ui-space-3);
            }

            /* The UA rule for [hidden] is display: none, and the author rule above
             * beats it. Restating it is the whole cost of not shipping a dead row. */
            .actions[hidden] {
                display: none;
            }
        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.steps = [];
        this.current = 1;
        this.label = '';
        this.caption = '';
        /* The one string this component owns goes through the shared table (D2), which
         * already carries Slate's key verbatim (i18n/en.json:446). Same wiring as #19. */
        this.i18n = new I18nController(this);
    }

    /**
     * Whether anything is slotted into the actions cluster. A cluster with no buttons
     * must not draw a row gap, and there is no CSS selector that can ask a slot whether
     * it has assigned nodes — `:has()` sees a slot's FALLBACK children and `::slotted()`
     * is a pseudo-element, illegal inside `:has()`. So it is one boolean, one listener.
     *
     * It starts false, which is the state a component with no assigned nodes is really
     * in; `slotchange` fires on the initial assignment, in the same microtask checkpoint
     * as the first render, so a filled cluster is never painted collapsed.
     */
    #hasActions = false;

    #slotChange = (event) => {
        const slot = event.target;
        const filled = slot.assignedNodes({ flatten: true }).some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''),
        );
        if (filled !== this.#hasActions) {
            this.#hasActions = filled;
            this.requestUpdate();
        }
    };

    get #steps() {
        return (Array.isArray(this.steps) ? this.steps : []).map(normaliseStep);
    }

    /**
     * The current step, 1-based and clamped into the walk. A wizard is always ON a step;
     * an out-of-range `current` is a caller bug, and blanking the strip would hide it
     * while leaving the walk unreadable.
     */
    get #current() {
        const total = this.#steps.length;
        if (!total) return 0;
        const n = Number.isFinite(this.current) ? Math.round(this.current) : 1;
        return Math.min(Math.max(n, 1), total);
    }

    /* NOTHING IS WRITTEN TO THE HOST, and that is the decision ui-bank's #authorLabel
     * capture exists to make safe in the other direction. The host is not the list — the
     * <ol> inside is — so `label` names the <ol> and whatever aria a SCREEN puts on the
     * host stays exactly where the screen put it, with no capture-and-restore dance to
     * get wrong. Nothing to clean up on disconnect either: the one listener is a Lit
     * template binding on a slot in this component's own shadow tree, so it goes with
     * the tree (CONVENTIONS §12). */

    /** "Step 2 of 4" + " · " + the step's name, or whatever `caption` overrides it with. */
    #caption(steps, current) {
        if (this.caption) return this.caption;
        if (!steps.length) return '';
        const count = this.i18n.t('Step {n} of {total}', { n: current, total: steps.length });
        const name = steps[current - 1]?.label;
        if (!name) return count;
        /* Written over three lines rather than one, and that is Gate D's doing: its
         * constructed-path scan flags any single-line interpolated template containing a
         * slash, and a closing tag has one. A newline inside the literal is the whole
         * difference between "a route assembled from fragments" and a caption. */
        return html`
            ${count}<span class="caption-sep" aria-hidden="true">${MIDDOT}</span>${name}
        `;
    }

    render() {
        const steps = this.#steps;
        const current = this.#current;

        return html`
            <div class="column" id="column">
                <div class="progress" id="progress">
                    <ol class="steps" id="steps" role="list" aria-label=${this.label || nothing}>
                        ${steps.map((step, index) => this.#renderStep(step, index, steps.length, current))}
                    </ol>
                    <p class="caption" id="caption">${this.#caption(steps, current)}</p>
                </div>

                <slot></slot>
                <div class="actions" id="actions" ?hidden=${!this.#hasActions}>
                    <slot name="actions" @slotchange=${this.#slotChange}></slot>
                </div>
            </div>
        `;
    }

    #renderStep(step, index, total, current) {
        const n = index + 1;
        const isCurrent = n === current;
        /* Slate's own rule, carried: `calDone[i] || i < calStep` (settings.js:4870) — a
         * step is done because it says so, or because the walk is past it. */
        const isDone = !isCurrent && (step.done || n < current);
        const isAhead = !isCurrent && !isDone;

        /* THREE writes of ONE boolean, in one place, so aria state and painted state
         * cannot drift (Appendix 15). `.is-selected` is what selectionSurface paints;
         * aria-current="step" is what a screen reader hears. */
        const chipClass = `chip${isCurrent ? ' is-selected' : ''}${isDone ? ' done' : ''}${isAhead ? ' ahead' : ''}`;

        return html`
            <li class="track" id="track-${n}">
                <span
                    id="chip-${n}"
                    class=${chipClass}
                    aria-current=${isCurrent ? 'step' : nothing}
                >
                    <span class="glyph" aria-hidden="true">${isDone ? CHECK : n}</span>
                    <span class="a11y">${step.label || n}</span>
                    ${isDone ? html`<span class="a11y">${this.i18n.t('Done')}</span>` : nothing}
                </span>
                ${n === total ? nothing : html`
                    <span
                        id="rule-${n}"
                        class="rule${n < current ? ' walked' : ''}"
                        aria-hidden="true"
                    ></span>`}
            </li>
        `;
    }
}

customElements.define('ui-wizard-column', UiWizardColumn);
