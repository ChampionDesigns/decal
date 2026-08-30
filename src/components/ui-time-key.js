/**
 * ui-time-key.js — component #11 of the 57-component inventory: THE TIME KEY.
 *
 * SCOPE.md's row #11 reads "Time key (+ strip, caption)", the same "(+ parts)" form
 * row #10 uses for the chart legend and row #12 for the badge: three PARTS of one
 * component, not three tags. Built by fix run 6 (the History power page); until now it
 * was the one inventory row with tokens shipped and nothing consuming them —
 * `--ui-timekey-w` and `--ui-timekey-strip-w` (tokens.css §3.8, ported from
 * `slate-tokens.css:78-79`) have had no reader in this tree since wave 0a.
 *
 * ===========================================================================
 * WHAT IT IS FOR
 * ===========================================================================
 * The P–Q trajectory is the one chart in the skin whose x axis is not time: it plots
 * pressure against flow, and TIME IS THE COLOUR. A colour that carries a quantity needs
 * an axis like any other quantity, and this is that axis — a gradient strip, the two
 * ends of the range as numbers, and a caption naming the unit.
 *
 *     ┌──┐  <- the end of the shot, in seconds
 *     │▓▓│
 *     │▒▒│     the strip: --ui-timekey-strip-w wide, the ramp painted bottom-to-top
 *     │░░│
 *     └──┘  <- 0
 *      s       the caption
 *
 * Slate built exactly this and its reasoning is carried whole (`chart-components.js`
 * :148-176): "This used to be a chart library's colourbar, attached to an invisible
 * marker trace. It is a strip and some numbers; it does not need one."
 *
 * ===========================================================================
 * H2 AND chart-C14 — AN AXIS THAT IS ANNOUNCED
 * ===========================================================================
 * chart-C14's first clause is that Slate's gradient key was `aria-hidden="true"`
 * (`index.html:521`) while being "the trajectory's ONLY axis legend" — so the one
 * chart whose colour IS an axis had no axis in the accessibility tree at all, and the
 * plot beside it announced "Pressure versus flow trajectory" with nothing saying what
 * the colours meant. H2 is the same absence read from the layout side: no time key,
 * anywhere, and the `--ui-timekey-*` tokens orphaned.
 *
 * So the host is a `group` with an accessible name, exactly as `<ui-chart-legend>` is,
 * and the two end values are real text in it rather than decoration. The STRIP is the
 * only `aria-hidden` part, for the same reason the legend's swatch is: the numbers
 * beside it carry the name, and a gradient has nothing to say twice.
 *
 * ===========================================================================
 * A6 — THE RAMP IS THE STYLESHEET'S
 * ===========================================================================
 * The ten `--ui-timekey-stop-*` values live in `styles/chart-channels.css` and reach
 * this component the way every chart colour reaches every chart: as custom properties
 * that inherit through the shadow boundary. This file paints them as one
 * `linear-gradient(to top, ...)` and declares no colour of its own. The PLOT beside it
 * reads the same ten computed and blends between them (`history-power.js` `rampColour`),
 * so the key and the path cannot disagree — the failure Slate's JS-only palette made
 * unavoidable.
 *
 * ===========================================================================
 * WHAT IT DOES NOT DO
 * ===========================================================================
 * No data layer, no derivation, no endpoint (the wave-1 law for a component): it is
 * handed a number of seconds and a name, and it draws them. It does not format the
 * seconds beyond rounding them to whole ones, and it authors NO word — `caption` and
 * `label` arrive already translated (D2). It has no block size of its own: the strip is
 * `flex: 1 1 auto` inside whatever box the consumer gives it, because a key beside a
 * chart on a ratio track must give with the track (H1).
 */

import { css, html } from 'lit';

import { UiElement } from './base.js';
import { typeRoles } from './type-roles.js';

/** How many gradient stops the strip paints. The ramp's own count; see the CSS. */
export const TIMEKEY_STOPS = 10;

export class UiTimeKey extends UiElement {
    static properties = {
        /**
         * The value at the TOP of the strip, in the caption's unit. The bottom is
         * `from`. Rounded to whole units for display and never otherwise touched.
         */
        seconds: { type: Number },

        /** The value at the bottom of the strip. Zero on every caller today. */
        from: { type: Number },

        /** The unit, under the strip — already translated (D2). */
        caption: { type: String },

        /** The GROUP's accessible name, on the host as `aria-label` (chart-C14). */
        label: { type: String },
    };

    static styles = [typeRoles, css`
        /* NO BACKTICK IN THIS TEMPLATE, in a comment or out of one: one ends the
         * tagged template where it stands (CONVENTIONS §9).
         *
         * THE WIDTH IS THE TOKEN'S, and this is the first consumer it has ever had.
         * --ui-timekey-w is 54px, ported from slate-tokens.css:78 with the note that
         * "the timekey is the trajectory chart's gradient strip and its two numbers" —
         * so the box is content-sized by declaration rather than by measurement, and a
         * fork retunes it in one place. */
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--ui-space-1);
            inline-size: var(--ui-timekey-w);
            flex: 0 0 auto;
            color: var(--ui-text-2);
        }

        /* THE STRIP. Its width is the second orphaned token; its HEIGHT is nobody's
         * declaration — flex: 1 1 auto takes whatever the row has left, so the key
         * gives with the chart it stands beside instead of pinning a px height into a
         * ratio track (H1's rule, one component along). Slate declared a 120px
         * min-height here (--slate-timekey-strip-min-height) and that token is
         * deliberately NOT ported: it is the same class of declaration H1 counted. */
        .strip {
            inline-size: var(--ui-timekey-strip-w);
            flex: 1 1 auto;
            min-block-size: 0;
            border: var(--ui-hairline) solid var(--ui-line);
            border-radius: var(--ui-radius-sm);
            background-image: linear-gradient(
                to top,
                var(--ui-timekey-stop-0) 0%,
                var(--ui-timekey-stop-1) 11.111%,
                var(--ui-timekey-stop-2) 22.222%,
                var(--ui-timekey-stop-3) 33.333%,
                var(--ui-timekey-stop-4) 44.444%,
                var(--ui-timekey-stop-5) 55.556%,
                var(--ui-timekey-stop-6) 66.667%,
                var(--ui-timekey-stop-7) 77.778%,
                var(--ui-timekey-stop-8) 88.889%,
                var(--ui-timekey-stop-9) 100%
            );
        }

        /* The two ends and the unit read at the chart's own tick size, so the key and
         * the axis labels beside it are one voice (§3.8). */
        .value,
        .caption {
            font-size: var(--ui-chart-legend);
            line-height: 1.2;
            text-align: center;
        }
    `];

    constructor() {
        super();
        this.seconds = 0;
        this.from = 0;
        this.caption = '';
        this.label = '';
    }

    /**
     * The host carries the role and the name. In `connectedCallback` and not the
     * constructor: a custom element constructor must not gain attributes
     * (CONVENTIONS §13 (b)). A consumer that states its own role keeps it — the same
     * rule `<ui-chart-legend>` follows.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('label')) {
            if (this.label) this.setAttribute('aria-label', this.label);
            else this.removeAttribute('aria-label');
        }
    }

    render() {
        const top = Number.isFinite(this.seconds) ? Math.round(this.seconds) : 0;
        const bottom = Number.isFinite(this.from) ? Math.round(this.from) : 0;
        return html`
            <span class="value ui-numeric" part="value-top">${top}</span>
            <div class="strip" part="strip" aria-hidden="true"></div>
            <span class="value ui-numeric" part="value-bottom">${bottom}</span>
            ${this.caption
                ? html`<span class="caption ui-caption" part="caption">${this.caption}</span>`
                : null}
        `;
    }
}

customElements.define('ui-time-key', UiTimeKey);
