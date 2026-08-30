/**
 * live-header.js - <live-header>, the Live screen's header band.
 *
 * ONE JOB: be a 3-part FLEX ROW. LAYOUT_SPEC_DRAFT.md §4.1's flex table, verbatim:
 * "Header band | Fixed --ui-band-h. Contents are a 3-part flex row: library button,
 * favourites bank (1fr, min-width: 0), action cluster. NOT three absolute clusters -
 * today all three are absolutely positioned and the header's two clusters are only
 * proven not to collide at 1920, with 133px of slack that depends on the English
 * labels 'Edit profile / Settings / Sleep' (layout/live.md §3.4)."
 *
 * That is the whole of this file's reason to exist, and it is a structural fix, not a
 * careful one: with three flex clusters there is no width at which two clusters can
 * overlap, because overlap is not a state a flex row can reach. The middle cluster
 * carries `flex: 1 1 auto` and `min-inline-size: 0` - the second half matters as much
 * as the first, since a flex item's automatic minimum size is its CONTENT, and a
 * favourites bank that refuses to shrink pushes the action cluster off the end
 * instead of getting narrower. D2 makes this permanent rather than lucky: the slack
 * that today depends on the English labels is gone whatever the strings become.
 *
 * WHAT THIS FILE DOES NOT DECIDE. Which components sit in the three clusters (that is
 * `live-components-inventory`), what the band's height is (--ui-band-h, tokens.css, and
 * the screen's grid row owns it), or what a cluster's own gaps mean beyond the shared
 * spacing scale. The band paints --ui-fascia because a cell that does not paint is a
 * hole in the seamed grid, not a seam (`seams.js` trap 1).
 *
 * NO ROLE ON THE HOST. `app-root` already renders the document's one <main>, and the
 * screen names its regions from its own template (D2: a name is a value read through
 * t(), never text baked into a template here).
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveHeader extends UiElement {
    static styles = [css`
        /* display: flex WINS over the base's display: block because it is the same
         * specificity written later (CONVENTIONS §1: the base is prepended). */
        :host {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-4);
            padding-inline: var(--ui-band-inset);

            /* THE BAND IS THE BAR, NOT THE BODY (parity surface 1). It painted
             * --ui-fascia, which is the token whose own comment reads "page body"; the
             * one that reads "top bars" is --ui-bar, and this is the top bar.
             *   ORACLE live-ready <header> [i=1] background-color = rgb(17, 22, 26)
             *          = #11161a = --slate-bar / --ui-bar (slate-tokens.css:291,
             *          styles/tokens.css:1398). Decal painted rgb(14, 19, 23)
             *          = #0e1317 = --ui-fascia, the rail's ground — so the header and
             *          the rail were one colour and Slate's band sits a step lighter
             *          than the body it heads. */
            background-color: var(--ui-bar);
            min-inline-size: 0;
        }

        /* THE THREE CLUSTERS. Each is a flex row of its own so a cluster with two
         * controls in it does not need a wrapper somewhere else to space them. */
        .cluster {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        /* The two end clusters are their own size and never grow: an action cluster
         * that grew would move its buttons around as the middle one changed. */
        .lead,
        .actions {
            flex: 0 0 auto;
        }

        /* AND THE ACTIONS STAND OFF FROM THE FAVOURITES. Ben, 23 Aug 2026: "Can you
         * reduce the width of the profile buttons or ensure there is a bigger gap
         * between the favorits and the Warmer toggle." Both halves of that were paid:
         * Sleep and the fullscreen control went in the same message, handing ~192px back
         * to the bank, and this is the separation itself.
         *
         * A MARGIN AND NOT A BIGGER GAP PROPERTY, because the gap is the band's and
         * applies at
         * BOTH seams: widening it would also push the favourites off the library button,
         * where nothing is crowded. --ui-space-7 on top of the band's --ui-space-4 reads
         * as a deliberate break between "which profile" and "what to do", rather than as
         * one more item in an evenly-spaced row. */
        .actions {
            /* THE SLACK THE CAP LEAVES GOES HERE, and the actions stay at the band's
             * end. An auto inline-start margin absorbs the free space a flex row
             * would otherwise leave AFTER the last item, which would have pushed these
             * three controls off the right edge of the band.
             *
             * THE FLOOR IS STILL A REAL GAP. auto collapses to zero when the cap does
             * not bind, so the stand-off Ben asked for on the same day — "ensure there
             * is a bigger gap between the favorits and the Warmer toggle" — is a
             * margin on the favourites' own end, and this only adds to it. */
            margin-inline-start: auto;
        }

        .favourites {
            margin-inline-end: var(--ui-space-7);
        }

        /* THE MIDDLE ONE IS THE 1fr, AND min-inline-size: 0 IS HALF THE RULE.
         * Without it the automatic minimum size is the bank's content and the row
         * overflows to the right instead of the bank getting narrower - which is the
         * "proven not to collide at 1920" state the spec is retiring. */
        .favourites {
            flex: 1 1 auto;
            min-inline-size: 0;

            /* AND IT DOES NOT TAKE THE WHOLE BAND. Ben, 23 Aug 2026: "Make the 5
             * facorites less wide still like by ~10%."
             *
             * MEASURED at 1920 design units before the cap: five cells of 267 in a
             * 1338px cluster, against a 1884px band. 64% of the band is 1206, which is
             * the 10% he asked for (241 per cell), and it is stated as a SHARE OF THE
             * BAND rather than as a pixel width so it holds at every screen the fit
             * produces — a 16:9 design is 2133 units wide and the rule still means the
             * same thing there.
             *
             * A CAP, NOT A SIZE: below the width where 64% exceeds what is left, the
             * cluster is flexible again and gives before anything else does, which is
             * the behaviour the floor sweep depends on. *
             * 59, NOT 64, BECAUSE THE ACTION CLUSTER GREW A BUTTON. Ben, 25 August 2026:
             * "please add a sleep button on the top right, to the right of settings. Make
             * the 5 favorites a little narrower, 5% or so to fit the new button." That is
             * his number and his reason, and it is the same shape as the 23 August change
             * this note already records: the middle cluster is what gives when the ends
             * need room, and it gives by a stated share rather than by whatever is left. */
            max-inline-size: 59%;
        }

        /* Nothing here is positioned. Written as a rule rather than as a comment so
         * that a later edit that reaches for position: absolute has to delete a
         * line that says why it must not (bug L1's mechanism, one screen region up). */
        :host,
        .cluster {
            position: static;
        }
    `];

    render() {
        return html`
            <div class="cluster lead" part="lead"><slot name="lead"></slot></div>
            <div class="cluster favourites" part="favourites"><slot name="favourites"></slot></div>
            <div class="cluster actions" part="actions"><slot name="actions"></slot></div>
        `;
    }
}

customElements.define('live-header', LiveHeader);
