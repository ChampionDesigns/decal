/**
 * settings-leaf-pane.js — <settings-leaf-pane>, column 3 of the Settings body.
 *
 * `LAYOUT_SPEC_DRAFT.md` §4.4, verbatim:
 *
 *     └─ <leaf-pane>       overflow-y:auto; padding: var(--ui-space-6)
 *          > <leaf>        inline-size: min(100%, var(--ui-measure-wide)); margin-inline: auto
 *
 * ===========================================================================
 * ONE MEASURE, AND IT IS THIS BOX  (T1, T21, and T8's mechanism)
 * ===========================================================================
 *
 * Three live measures die here. §4.4: "there are three live measures today, not one:
 * 1200 (the cap), 760 (the load-cell wizard, `slate-shell.css:2302`) and 885 (the
 * Decent.app gateway group, `settings.js:1314`, measured [629,317,885,66])".
 *
 *   T1  "The load-cell wizard is 63px wider than every other leaf — measured 1263
 *       against 1200, right edge 1892 against 1829 on all 37 others. The comment says
 *       the LEFT edge was fixed so paging no longer jolts; the right edge still jumps."
 *       (`slate-shell.css:2290-2295` vs `:1285-1288`.)
 *   T21 "A third live measure at 885px, sitting between the 1200 cap and the 760 wizard
 *       and documented nowhere." (`settings.js:1314, 1343-1354`.)
 *
 * THE MEASURE IS THE PANE'S BOX, NOT A DECLARATION EACH LEAF MAKES. #leaf carries
 * `min(100%, var(--ui-measure-wide))` and `margin-inline: auto`, and every leaf is
 * slotted into it. Thirty-seven leaves therefore have one width because they are in one
 * box — not because thirty-seven files agreed. A per-leaf `max-width` is how you get
 * 1200 and 885 and 760, and the only reason those three could coexist is that three
 * different files each owned the number. Here no leaf owns it.
 *
 * Part 5 §4 keeps one escape and this shape is what makes it explicit: "the wizard and
 * any leaf needing more width asks for it explicitly via its own container, not via a
 * bespoke cap". A leaf that declares its own inline-size overflows this box visibly and
 * on purpose. What it cannot do is quietly land at a fourth width.
 *
 * THE 28/91 ASYMMETRY GOES WITH THEM. §4.4: "the leaf column [is] capped at 1200
 * (`:1287`) and NOT CENTRED, so every leaf sits in a 28px/91px asymmetric inset … an
 * artefact of 1200 against 1319, not a design decision". `margin-inline: auto` is the
 * whole fix, and it is one declaration rather than a corrected pair of insets.
 *
 * T8 IS THE SAME MECHANISM ONE STOREY DOWN, and it dies with the shadow boundary rather
 * than with this box: "The feedback Description box is 128px, not the 320px its own fix
 * comment claims — an `[id$="-preview"]` attribute selector outscores the id it was
 * written to beat" (`slate-shell.css:1138-1144` vs `:1615-1620`). Two sheets could reach
 * one element; nothing can reach into a shadow root (CONVENTIONS §6), so the fight has
 * no second party. Not claimed as this file's kill — recorded so the next reader knows
 * where it went.
 *
 * ===========================================================================
 * THE FLOOR  (§2.4, M18)
 * ===========================================================================
 *
 * Part 5 §4's table: "Leaf pane | one settings row + its heading (proposal) | auto".
 * `--ui-settings-leaf-min-h` is exactly that arithmetic — #29's own min-block-size plus
 * one `.ui-heading` line — and it is A PROPOSAL CARRIED AS A TOKEN (M18), with the note
 * in `styles/tokens.css`. Not a frozen number: Part 10 §9's review check is that every
 * floor marked "proposal — confirm" is a token with an M18 note.
 *
 * SCROLLING IS THE DESIGNED ANSWER HERE, not the surrender (Part 5 §4). §4.4 measured
 * content bottoms across all 37 leaves running 1210 down to 338, with `updates-skin---app`
 * overflowing even at the design height (1210 against 1200) — so this pane already
 * scrolls on the biggest screen the old app supports, and at 600px tall most of the 37
 * scroll. Nothing is dropped and nothing is hidden: no `scrollbar-width` anywhere (T16).
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SettingsLeafPane extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THE PANE IS THE SCROLL REGION. §2.4's three: an explicit overflow, an
         * explicit floor, and a stated place in the order of surrender — this pane is
         * the elastic one (§4.4 "Flexes / does not"), so it gives last and it gives by
         * scrolling.
         *   CITE settings-machine-machine-info #right-panel [i=44] background-color =
         *        rgb(14, 19, 23)  <-  slate-shell.css  winning rule
         *        (hash)subpage-host (hash)settings-body > (hash)right-panel, ...
         *        !important=yes  (token-driven) = --ui-fascia.
         *   The important flag is Slate's, and it is there because three sheets could
         *   reach that panel. Nothing can reach this one. NO BACKTICK in here: the
         *   quoting a citation normally takes would end this tagged template. */
        :host {
            display: block;
            overflow-y: auto;
            padding-block: var(--ui-space-6);
            padding-inline-start: var(--ui-settings-pane-inset-start);
            padding-inline-end: var(--ui-settings-pane-inset-end);
            background-color: var(--ui-fascia);
            min-block-size: var(--ui-settings-leaf-min-h);
            min-inline-size: 0;
        }

        /* THE ONE MEASURE. Both halves are §4.4 verbatim and neither is a number:
         * min(100%, --ui-measure-wide) so a narrow pane gives the leaf all of itself
         * and a wide one stops at the measure, and margin-inline: auto so what is left
         * over is split evenly instead of landing 28 on one side and 91 on the other. */
        /* THE LEAF FILLS THE PANE. It was capped at --ui-measure-wide and centred, which
         * is what produced the 148.8px on each side Ben measured as too much (O4). The
         * cap is gone and the pane's own two insets take its place — see
         * --ui-settings-pane-inset-start in tokens.css for the arithmetic.
         *
         * WHAT THE CAP WAS FOR still holds, but it holds one level down: a line of PROSE
         * needs a measure, and a page does not. The leaf's description carries
         * --ui-measure, and O1's rule caps a row's text at the widest control on the page
         * — which is a better answer to the same question, because it also stops the text
         * running into the control. */
        #leaf {
            inline-size: 100%;
        }
    `];

    render() {
        return html`<div id="leaf" part="leaf"><slot></slot></div>`;
    }
}

customElements.define('settings-leaf-pane', SettingsLeafPane);
