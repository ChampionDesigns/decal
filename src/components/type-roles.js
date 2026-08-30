/**
 * type-roles.js - component #13, and one of the two wave-1 rows that is deliberately
 * NOT an element.
 *
 * SCOPE.md:1531, verbatim: "Title / heading / caption / body / microcap / numeric.
 * Dissolves into the token layer plus a shared style module rather than an element -
 * recorded here so the inventory stays 57-for-57." So there is no `<ui-title>`, no
 * `customElements.define`, and nothing here renders. The token layer is
 * `styles/tokens.css` §3.5 (twenty type tokens plus the family token, all shipped by
 * wave 0a - this row added none); the shared style module is the `typeRoles` fragment
 * below, which a component imports into its own `static styles`:
 *
 *     import { UiElement } from 'src/components/base.js';
 *     import { typeRoles } from 'src/components/type-roles.js';
 *
 *     static styles = [typeRoles, css`...your own rules...`];
 *
 * and then writes ORDINARY elements inside its shadow root:
 *
 *     <h2 class="ui-heading">Water</h2>
 *     <p class="ui-caption">Explanatory copy under a label.</p>
 *
 * WHY A FRAGMENT AND NOT A FOURTH GLOBAL SHEET. `index.html` links exactly three
 * sheets and calls them "the only global CSS in the project" (SCOPE Part 2 §2), and a
 * class in the document cannot reach inside a shadow root anyway. Everything in this
 * app is a component, so the roles have to travel the way every other shared rule
 * travels: as a `css` fragment, like `focusRing` / `hitArea` / `selectionSurface` in
 * `base.js`. If a light-DOM consumer ever appears, `adoptStyleSheet(root,
 * typeRoles.styleSheet)` from `base.js` puts the same rules on any root.
 *
 * A LIGHT-DOM CONSUMER HAS NOW APPEARED, and until parity surface 4 it was SILENTLY
 * INERT (DQ-2-C, found by surface 2's census). `test/fixtures/editor-shell-fixture.js`
 * wrote `class="ui-caption"` on spans it appends to the DOCUMENT; the fragment reached
 * none of them, so eight labels rendered `--ui-text` at no measure cap - two of them
 * 914px wide - while looking, in the source, exactly like every styled caption in the
 * tree. That is the trap this sentence used to leave open: the class name is the same
 * whether or not any rule is behind it, and nothing said so.
 *
 * `adoptTypeRoles(root)` at the foot of this file is the door, and it is the ONLY
 * supported way to use a role outside a shadow root. It is named rather than left as a
 * two-argument call so the reason travels with it and so a test can assert on it; it is
 * idempotent (`adoptStyleSheet` merges by identity), and it takes any root with an
 * `adoptedStyleSheets` list, `document` included. Nothing in `src/` calls it - every
 * screen in this app is a component - and a call appearing here later is a signal that
 * something has started building UI outside the component layer.
 *
 * WHY THE SIX ARE THE SIX. The row names them, and they are Slate's own
 * (`slate-components.css:81-136`). Slate also ships `.slate-text` and
 * `.slate-muted-text`, which are ink switches rather than type roles, and both are
 * dropped: ink is inherited from `styles/document.css` (`--ui-text` on `html`) and the
 * two roles that deliberately speak quietly - caption and microcap - carry
 * `--ui-muted` themselves.
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE, quoted rather than paraphrased (Part 10 §4). Queried mechanically with
 * `prov_query.py rule --state <s> --cls <c> --prop <p>` against prov-baseline (dark):
 *
 *   CITE settings-calibration-fan .slate-title [i=45] font-size = 28px
 *        <- slate-components.css `.slate-title` authored `var(--slate-text-xl)`
 *        !important=yes (token-driven)
 *   CITE settings-calibration-fan .slate-title [i=45] font-weight = 500
 *        <- slate-components.css `.slate-title` authored `var(--slate-weight-medium)`
 *   CITE settings-calibration-fan .slate-title [i=45] color = rgb(244, 247, 248)
 *        <- slate-components.css `.slate-title` authored `var(--slate-text)`
 *   CITE settings-calibration-fan .slate-heading [i=46] font-size = 20px
 *        <- slate-components.css `.slate-heading` authored `var(--slate-text-lg)`
 *   CITE settings-calibration-fan .slate-heading [i=46] font-weight = 500
 *        <- slate-components.css `.slate-heading` authored `var(--slate-weight-medium)`
 *   CITE settings-calibration-fan .slate-caption [i=47] font-size = 16px
 *        <- slate-components.css `.slate-caption` authored `var(--slate-text-note)`
 *   CITE settings-calibration-fan .slate-caption [i=47] font-weight = 400
 *        <- slate-components.css `.slate-caption` authored `var(--slate-weight-regular)`
 *   CITE settings-calibration-fan .slate-caption [i=47] color = rgb(148, 161, 169)
 *        <- slate-components.css `.slate-caption` authored `var(--slate-muted)`
 *   CITE expanded-charts .slate-microcap [i=168] font-size = 15px
 *        <- slate-components.css `.slate-microcap` authored `var(--slate-text-cap)`
 *   CITE expanded-charts .slate-microcap [i=168] font-weight = 600
 *        <- slate-components.css `.slate-microcap` authored `var(--slate-weight-semibold)`
 *   CITE expanded-charts .slate-microcap [i=168] letter-spacing = 1.8px
 *        <- slate-components.css `.slate-microcap` authored `var(--slate-tracking-cap)`
 *   CITE expanded-charts .slate-microcap [i=168] text-transform = uppercase
 *        <- slate-components.css `.slate-microcap` authored `uppercase` !important=no
 *   CITE settings-machine-machine-info .slate-body [i=51] font-size = 17px
 *        <- slate-components.css `.slate-body` authored `var(--slate-text-base)`
 *   CITE settings-machine-machine-info .slate-body [i=51] font-weight = 400
 *        <- slate-components.css `.slate-body` authored `var(--slate-weight-regular)`
 *   CITE settings-machine-machine-info .slate-body [i=51] color = rgb(244, 247, 248)
 *        <- slate-components.css `.slate-text` authored `var(--slate-text)`
 *        (the ink comes from a SECOND class on the same element, not from .slate-body)
 *   CITE expanded-charts #expanded-compliance-badge [i=166] font-family =
 *        Geist, system-ui, sans-serif <- slate-components.css `.slate-numeric`
 *        authored `var(--slate-font-numeric)` !important=yes (token-driven)
 *   CITE expanded-charts #expanded-compliance-badge [i=166] font-size = 18px
 *        <- (no declaration - inherited or initial value) (token-driven)
 *        (.slate-numeric sets NO size, weight or colour: it is a modifier)
 *
 * Reach, from `prov_query.py find --cls <c>`: title 38 elements / 38 states,
 * heading 88 / 30, caption 77 / 30, microcap 31 / 7, body 12 / 3, numeric 19 / 6.
 * The dark values above are exactly `--ui-text` (#f4f7f8) and `--ui-muted` (#94a1a9)
 * in `styles/tokens.css:847,849`, so the rename is a rename and nothing moved.
 *
 * THE ORACLE CANNOT ANSWER TWO OF THE PROPERTIES HERE, and says so: `line-height` and
 * `text-align` are outside the probe's 18-property appearance surface
 * ("property not probed"). `line-height` is therefore read from the Slate source
 * read-only, at `slate-components.css:81-136`, which is the carve-out's documented
 * fallback. `text-align` IS NOT DECLARED AT ALL - see departure 2: Slate's value there
 * is bug T11's own mechanism, so it is the one source read this file declines.
 *
 * ---------------------------------------------------------------------------
 * FIVE DELIBERATE DEPARTURES FROM SLATE. Every one is named here and asserted as a
 * departure in `test/render/type-roles.render.test.mjs`, so drifting back is a red
 * test rather than a quiet regression.
 *
 *  1. ZERO `!important`, where Slate has one on nearly every declaration in this
 *     block (spec §2.1 Rule 3; CONVENTIONS §6). Nothing outside a shadow root can
 *     reach these rules, so the reason for them is gone.
 *
 *  2. THE RULES ARE WRAPPED IN `:where()`, AND NO ROLE DECLARES AN ALIGNMENT. Two
 *     mechanisms, because T11 needs both, and shipping only the first is how this
 *     module reproduced the bug in review (finding i13-1).
 *
 *     T11 is "the loading/empty states are authored centred and rendered
 *     left-aligned by three shell rules - four call sites affected"
 *     (LAYOUT_SPEC_DRAFT.md §7.5 T11, `slate-shell.css:1304-1306, 1326-1328,
 *     1244-1250`), i.e. a shared alignment that an author could not override.
 *
 *     `:where()` makes a role (0,0,0) - the same mechanism the base uses for every
 *     rule it puts inside your tree - so a component's own rule always wins,
 *     including a bare element selector, and no component ever has to fight the
 *     shared layer. `.centred { text-align: center }` in a component's own styles
 *     simply wins. (The author-origin rule beats the UA stylesheet regardless of
 *     specificity, so `h1` still renders at the role's size and not at the UA's
 *     `2em`.)
 *
 *     BUT SPECIFICITY IS THE WRONG TOOL AGAINST INHERITANCE. `text-align` is an
 *     inherited property, and ANY declaration on the element - even at (0,0,0) -
 *     beats an inherited value, because inheritance is only consulted when no
 *     declaration applies at all. So `:where(.ui-caption) { text-align: start }`
 *     rendered a caption LEFT inside a container the component had centred: T11's
 *     exact symptom, from a rule an author could not "override" because there was
 *     nothing to out-specify (MEASURED at BENCH: caption `start` while its
 *     unaligned siblings `#body` and `#heading` both read `center`). The roles
 *     therefore declare NO alignment; `start` is the initial value, so LTR copy is
 *     byte-identical and centring an ancestor now reaches the type.
 *
 *  3. MICROCAP WEIGHT 600 -> 700. `styles/tokens.css:368-372` ships three weights,
 *     not five, because spec §3.5 enumerates regular/medium/bold: "600 -> 700 on the
 *     ~50 elements that read semibold". The microcap is the biggest of those groups.
 *
 *  4. MICROCAP TRACKING .12em -> .04em, decided in `styles/tokens.css:374-382`: the
 *     spec is a Step 0 document and beats the oracle, so a 15px microcap tracks 0.6px
 *     where Slate tracked 1.8px, on ~43 elements.
 *
 *  5. THE BLOCK ROLES ZERO THE UA MARGIN. Slate resets `margin: 0` on `.slate-caption`
 *     only, because its titles and headings are `div`s and `span`s. A role that
 *     renders differently on `<h1>` than on `<div>` is a trap, and the semantic
 *     element is the one an author should reach for (a heading is structure, not
 *     paint), so title/heading/caption/body zero it and SPACING IS THE LAYOUT'S JOB -
 *     `--ui-space-*` on the container, never a margin baked into the type.
 *     `.ui-numeric` and `.ui-microcap` are inline modifiers and touch no box property.
 *
 * One smaller one, recorded for the same reason:
 * `.ui-numeric` no longer restating the font family - `--slate-font-numeric` was
 * already defined as `var(--slate-font-ui)`, and `styles/tokens.css:346-348` collapsed
 * the two into one family token. Restating it would stop numbers inheriting a family
 * their own component chose. What is left of the role is the part that was always
 * doing the work: tabular, lining figures, so a changing readout does not jitter.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT HERE, ON PURPOSE.
 *
 *  * NO SEVENTH ROLE. The five fluid display steps (`--ui-display-xs … -xl`) are in
 *    this row's token list and are documented in `TYPE_ROLES.md`, but a display
 *    readout is not a role: it is a component's own rule setting `font-size:
 *    var(--ui-display-md)` on an element that also carries `.ui-numeric`. They are the
 *    only fluid type in the system and they clamp against `cqi` - the COMPONENT's own
 *    container (spec §3.5, §2.1 Rule 1) - so they belong to the component that owns
 *    that container, not to a shared class that would resolve against whatever
 *    happened to be nearest.
 *
 *  * NO LINE-HEIGHT TOKENS. §3.5 names none, and this row may add tokens only where
 *    §3 names them. The three ratios below are Slate's, from source; if a
 *    `--ui-leading-*` family is ever agreed they replace five values in this file and
 *    nothing else (recorded as a deferred question - realine-run/waves/1/ledger-src/
 *    02-builders-deferred-questions.json, rendered into DEFERRED_QUESTIONS.md by the
 *    gate).
 *
 *  * NO COLOUR LITERAL, NO `@font-face`, NO `!important` - Gate C's three static
 *    guards, all of which scan this file (`src/` is a scan root).
 */

import { css } from 'lit';

import { adoptStyleSheet } from './base.js';

/**
 * The six role class names, in the order SCOPE.md:1531 lists them. Exported so a
 * fixture, a test or the gallery names them once rather than six times.
 */
export const TYPE_ROLES = Object.freeze([
    'ui-title',
    'ui-heading',
    'ui-caption',
    'ui-body',
    'ui-microcap',
    'ui-numeric',
]);

/**
 * The shared style module. Import into `static styles`; put it FIRST, with the other
 * structural fragments - it is a default layer and every rule in it is written to
 * lose a tie (CONVENTIONS §4: structural fragments first, state fragments last).
 */
export const typeRoles = css`
    /* TITLE - the page title. One per screen; use the element that says so.
     * ORACLE settings-calibration-fan .slate-title font-size 28px / font-weight 500 /
     * color rgb(244, 247, 248), winning rule slate-components.css {.slate-title},
     * authored var(--slate-text-xl) / var(--slate-weight-medium) / var(--slate-text).
     * line-height 1.2 is from slate-components.css:83-89, read from source because the
     * probe never measured it. NO text-align: Slate's "left" there is bug T11's own
     * mechanism and an inherited property cannot be out-specified (departure 2). */
    :where(.ui-title) {
        margin: 0;
        color: var(--ui-text);
        font-size: var(--ui-text-xl);
        font-weight: var(--ui-weight-medium);
        line-height: 1.2;
    }

    /* HEADING - a section heading inside a page.
     * ORACLE settings-calibration-fan .slate-heading font-size 20px / font-weight 500 /
     * color rgb(244, 247, 248), winning rule slate-components.css {.slate-heading},
     * authored var(--slate-text-lg) / var(--slate-weight-medium) / var(--slate-text).
     * line-height 1.3 from slate-components.css:91-96. */
    :where(.ui-heading) {
        margin: 0;
        color: var(--ui-text);
        font-size: var(--ui-text-lg);
        font-weight: var(--ui-weight-medium);
        line-height: 1.3;
    }

    /* CAPTION - explanatory copy under a label. Slate's own comment at
     * slate-components.css:107-109 is the whole design note: "One treatment
     * everywhere: left-aligned, muted, measure-capped. Help text was variously centred
     * across four ragged lines, set bold at near-title weight, or run to a
     * 155-character measure."
     * ORACLE settings-calibration-fan .slate-caption font-size 16px / font-weight 400 /
     * color rgb(148, 161, 169), winning rule slate-components.css {.slate-caption},
     * authored var(--slate-text-note) / var(--slate-weight-regular) / var(--slate-muted).
     * The 70ch cap is var(--ui-measure), spec §3.5, from slate-components.css:111.
     * THE "left-aligned" HALF OF THAT DESIGN NOTE IS NOT CARRIED, and that is
     * departure 2: Slate spells it as a physical left alignment forced with the
     * important flag, which is bug T11 - the shared alignment four centred call sites
     * could not escape. "start" is the initial value, so a caption still reads left
     * in LTR copy with nothing declared;
     * the difference is that a container which centres its contents now reaches it. */
    :where(.ui-caption) {
        display: block;
        max-inline-size: var(--ui-measure);
        margin: 0;
        color: var(--ui-muted);
        font-size: var(--ui-text-note);
        font-weight: var(--ui-weight-regular);
        line-height: 1.5;
    }

    /* BODY - running copy and control values. No colour: ink is inherited from
     * styles/document.css, which puts var(--ui-text) on html. Slate reached the same
     * result with a second class on the element - ORACLE
     * settings-machine-machine-info .slate-body color rgb(244, 247, 248) winning rule
     * slate-components.css {.slate-text} - so nothing here is a change of appearance,
     * only one fewer class to remember. */
    :where(.ui-body) {
        margin: 0;
        font-size: var(--ui-text-base);
        font-weight: var(--ui-weight-regular);
        line-height: 1.5;
    }

    /* MICROCAP - the uppercase label above a value on Live and in the editor.
     * ORACLE expanded-charts .slate-microcap font-size 15px / font-weight 600 /
     * letter-spacing 1.8px / color rgb(148, 161, 169) / text-transform uppercase,
     * winning rule slate-components.css {.slate-microcap}, authored
     * var(--slate-text-cap) / var(--slate-weight-semibold) / var(--slate-tracking-cap) /
     * var(--slate-muted) / uppercase.
     * TWO DEPARTURES, both decided upstream of this file: weight 600 -> 700
     * (styles/tokens.css:368-372, three weights not five) and tracking .12em -> .04em
     * (styles/tokens.css:374-382, spec §3.5 beats the oracle), so 1.8px becomes 0.6px.
     * text-transform is PAINT: the accessible name keeps the case the author wrote,
     * which is why the markup says Pressure and not PRESSURE. */
    :where(.ui-microcap) {
        color: var(--ui-muted);
        font-size: var(--ui-text-sm);
        font-weight: var(--ui-weight-semibold);
        letter-spacing: var(--ui-tracking-cap);
        line-height: 1.2;
        text-transform: uppercase;
    }

    /* NUMERIC - a modifier, not a step. It sets no size, weight or colour, exactly as
     * Slate's did (ORACLE expanded-charts #expanded-compliance-badge font-size 18px,
     * font-weight 500, color rgb(148, 161, 169), all "no declaration - inherited or
     * initial value"), so it composes with any of the roles above and with the display
     * steps. Tabular, lining figures: a readout that changes must not jitter, and a
     * column of numbers must line up. */
    :where(.ui-numeric) {
        font-variant-numeric: tabular-nums lining-nums;
    }
`;

/**
 * THE LIGHT-DOM DOOR (DQ-2-C). Put the six roles on a root that is not a shadow root -
 * in practice `document`, for markup a test or a driver builds outside the component
 * layer. Returns the root's resulting sheet list, the way `adoptStyleSheet` does.
 *
 * WHY THIS EXISTS AT ALL, given "everything in this app is a component": because the
 * class name is not self-announcing. `class="ui-caption"` in the light DOM renders as
 * an unstyled span and nothing anywhere reports it - no console warning, no failing
 * selector, no missing element. The fix is one call; the trap was that there was no
 * name to search for. There is now.
 *
 * IT IS STILL NOT A GLOBAL SHEET. `index.html` links three sheets and calls them the
 * only global CSS in the project; this adds nothing at boot and nothing at all unless a
 * caller asks. Every rule is `:where()`-wrapped, so a role landing on light-DOM markup
 * loses every tie it enters, exactly as it does inside a shadow root.
 */
export function adoptTypeRoles(root) {
    return adoptStyleSheet(root, typeRoles.styleSheet);
}

export default typeRoles;
