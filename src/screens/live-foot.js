/**
 * live-foot.js - <live-foot>, the Live screen's foot band. C2 lives here, and so does
 * the one measurement that is not taken yet (M3).
 *
 * §4.1 gives the band two numbers and one behaviour: "Foot band | auto, content-sized,
 * with a min-block-size and a maximum share of the column", and "Below the floor the
 * foot band is the one region permitted to scroll". Both numbers are tokens
 * (--ui-live-foot-min-h, --ui-live-foot-max-share, styles/tokens.css §3.9); the share
 * is applied by the screen's own grid row, because a track's maximum belongs to the
 * grid that declares the track.
 *
 * THE FLOOR HAS A PROPORTIONAL TERM SINCE 21 AUGUST 2026 (DQ-541, Ben's own
 * direction): the band is never shorter than --ui-live-foot-share of the screen, so a
 * taller screen gives the band a taller band and a shorter one takes it back, instead
 * of the chart paying the whole difference. The reasoning, the measurements and why the
 * share is 18dvh are in styles/tokens.css beside the token; the consumption is one
 * max() below.
 *
 * THE FLOOR IS A TOKEN TO FILL, NOT A NUMBER. LAYOUT_SPEC_DRAFT.md §7.9 item 2: the
 * band's real content height on a five-phase profile has never been measured, and
 * "OQ-8 depends on this" - OQ-8 being register decision C2, whose residual action is
 * that measurement (M3, scheduled for phase 1 attended or the post-run bench pass).
 * So --ui-live-foot-min-h is written as a derivation with its reasoning attached and
 * this file consumes it; when M3 lands, one token line changes and nothing here does.
 *
 * ONE COLUMN, NOT TWO. §4.1 draws `display:grid; cols: minmax(0,34%) minmax(0,1fr)` -
 * the phase table beside the derived list. Register decision D1 removes the puck and
 * the derived channels from v1 entirely, which deletes the derived list and its
 * plumbing, so the 34% column would be a column with nothing in it. That also spends
 * C2's first step of surrender in advance ("drop the derived list first, then scroll
 * as a last resort"): the list is not dropped under pressure, it is not in v1 at all,
 * and what is left of C2 is the phase table's behaviour.
 *
 * THE SCROLL IS DELIBERATE, AND IT IS THE ONLY ONE ON THIS SCREEN. `slate-live.css:
 * 1126-1131` is where the reasoning comes from and it argues the other way for the
 * normal case - "a scroll affordance on a wall tablet is worse than the crowding it
 * fixes" - which is why the band scrolls only when it has been squeezed below its
 * content, i.e. below the 1000x600 design floor. Two consequences, both intended:
 * the scrollbar is a real one (§2.4 bans hiding it - `slate-shell.css:456` sets
 * `scrollbar-width: none` on a scrollable column and that is a bug), and the band's
 * inner region takes `min-block-size: 0` so it CAN be squeezed. The band's host keeps
 * the floor, so the squeeze stops there and the content scrolls instead of vanishing.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveFoot extends UiElement {
    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);

            /* M3, PLUS BEN'S DQ-541 ANSWER (21 August 2026).
             *
             * The band never goes below its floor, whatever the screen does above it -
             * and the floor now has two terms, because it answers two questions.
             * --ui-live-foot-min-h is M3's: the smallest band that still shows the
             * table, a derivation over rows that already exist.
             * --ui-live-foot-share is the band's share of the screen: "the foot band
             * should scale, not have fixed pixel height but reduce so it looks similar
             * regardless of resolution. The Chart will need to reduce in height so it
             * still fits."
             *
             * max(), so the larger of the two wins and neither can be lost: at 1200
             * rows the share is 216 and the band takes it (the chart gives that height
             * back proportionally when the screen shrinks); at the 1000x600 design
             * floor the share is 108, M3's floor is 148, and the band is content-sized
             * exactly as it was. The token sheet carries the arithmetic and the
             * measurements; this line is the whole of the consumption.
             *
             * THE SHARE IS A FLOOR, NOT A HEIGHT, and that is what keeps C2 intact:
             * the screen's row is still fit-content(--ui-live-foot-max-share), so a
             * band with MORE content than its share is still content-sized, still
             * capped at 40% of the column, and still the one region permitted to
             * scroll once it has been squeezed under that cap. */
            min-block-size: max(var(--ui-live-foot-min-h), var(--ui-live-foot-share));

            /* THE BOTTOM INSET IS THE RAIL'S AND THE CHART CARD'S — 24, one token.
             * Ben, 25 August 2026: "the bottom stepper, the Hot water temperature, can the
             * bottom of that align with the bottom of the <, > and All shots button" and
             * "Make sure ALL items on the bottom of the screen are aligned". The rail and
             * this band both end on the screen's last grid line, so equal bottom insets
             * put their last rows on one edge. */
            padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        /* C2's LAST RESORT. min-block-size: 0 is what lets the region be squeezed at
         * all (a grid item's automatic minimum is its content); overflow: auto is
         * what makes the squeeze visible instead of silent. Above the design floor
         * this never fires - the band is content-sized and the screen's grid row
         * grows to it. */
        .band {
            display: grid;
            grid-template-rows: auto;

            /* THE SLACK IS SHARED, NOT ALL AT THE BOTTOM. The band's height is a SHARE
             * of the screen (--ui-live-foot-share), so it is usually taller than its
             * content: measured at 1920x1200, 166px of content in a 216px band left 26px
             * of slack, and start put every pixel of it under the last row. The band
             * then read as content stuck to a ceiling rather than as a band.
             *
             * safe center AND NOT plain center, which is the whole reason this is worth a
             * note: centred content in a scrolling box overflows EQUALLY in both
             * directions, and the top half becomes unreachable — a scroll container
             * cannot scroll above its start. safe falls back to start the moment the
             * content is taller than the box, which is exactly C2's last-resort case
             * below. Centred when there is room, honest when there is not. */
            /* THE BAND'S CONTENT SITS ON ITS FLOOR, not in the middle of it.
             *
             * safe center shared the slack above and below, which is right for a band
             * with nothing to line up against. It has something now: the rail's last
             * stepper ends on the same grid line, and Ben asked for the two to meet.
             * Centring puts half the band's surplus under the buttons and breaks that by
             * exactly that half.
             *
             * safe IS KEPT. Without it a band whose content is taller than its box
             * overflows upward, past the scroll origin, and the top of the phase table
             * becomes unreachable — the one thing safe exists to prevent. */
            align-content: safe end;
            gap: var(--ui-space-2);
            min-block-size: 0;
            overflow: auto;
        }

        ::slotted(*) {
            margin: 0;
        }
    `];

    render() {
        return html`<div class="band" part="band"><slot></slot></div>`;
    }
}

customElements.define('live-foot', LiveFoot);
