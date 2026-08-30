/**
 * ui-weather-corner.js — THE LIVE SCREEN'S BOTTOM-RIGHT CORNER, WHEN WEATHER IS INSTALLED.
 *
 * Ben, 29-30 August 2026. It replaces all three controls that sit there — Rate this shot,
 * Shot notes, and whichever plugin holds the hand-off row — and it fills their box exactly.
 *
 * ===========================================================================
 * THE BOX WAS 153 x 216. IT IS NOW 290 WIDE AND THE BAND'S OWN HEIGHT.
 * ===========================================================================
 * The first box was measured off `<ui-rating-control>`, the three-button stack this
 * replaced: 153 x 216 design px, three 64px rows and two 12px gaps. That geometry is
 * gone. Ben chose the short-band layout on 30 August, which pins the band's rule to the
 * left rail's own divider at y 992 and leaves the band 172 tall — too short for a 216px
 * stack — and pays for it by giving this block 290px of width instead of 189.
 *
 * SO THE HEAD TURNED SIDEWAYS. The mark and the temperature share one line, and the rain
 * block takes the rest. Nothing shrank to fit: the labels went UP from 14 to 16 and the
 * title from 14 to 18. The one reduction is the temperature, 45 -> 40, and it is not a
 * fit problem — see THE TEMPERATURE below.
 *
 * ===========================================================================
 * WHY THE LABELS ARE TWO LETTERS
 * ===========================================================================
 * Measured in Geist on the tablet, each half of the old 153px strip was 68 px:
 * AFTERNOON needs 107 px even at 10 px with tracking cut to .04em, and MORNING needs 83.
 * There is no size at which the words fit. NIGHT needs 68 px at the .1em tracking this
 * skin's micro-caps use elsewhere, which OVERFLOWED — so these labels track at .04em.
 * The wider block would now hold MORNING, but the abbreviations stay: the two halves are
 * read as a pair and one long word beside one short one reads as a mismatch, not a pair.
 *
 * ===========================================================================
 * THE TEMPERATURE IS 40, AND THE MARK IS WHY
 * ===========================================================================
 * Ben, 30 August 2026: "make the temperature a little smaller ... so the symbol looks
 * like its the same size as the temperature." Measured before changing it, because the
 * two were already almost level: at 45 the mark's ink is 35 px tall and the digits 36.
 * What makes the temperature read bigger is MASS, not height — the mark is a 1.5px
 * outline and the digits are solid at weight 500. At 40 the digits come to 31 against
 * the mark's 35, and the extra 3 px is what pays for the lighter stroke.
 *
 * ===========================================================================
 * IT IS PART OF THE RAIL, NOT A CARD ON TOP OF ONE
 * ===========================================================================
 * Ben, 30 August 2026: "Can we remove the card? Looks a bit disjointed, would be better
 * if it looks part of the rail." The block to its left - ratio, first drop, the two
 * avg/peak pairs - has no surface, no border and no radius; it is content inside the
 * band with a seam beside it. This now matches: the chrome is gone and only the seam
 * stays, so the corner reads as the band's fourth column rather than a tile dropped
 * into it.
 *
 * WHAT REPLACES THE BORDER AS THE PRESS AFFORDANCE. A region with no edge still has to
 * look pressable, so the surface appears on hover and focus rather than at rest. That
 * is the same move the band's other pressable regions make, and it keeps the resting
 * state flat.
 *
 * IT OPENS THE DETAIL MODAL. It emits `weather-open`; the screen owns the dialog. The
 * component reaches for nothing - the rule this skin wrote after the old DYE2 button
 * called a `window` global that was sometimes not there and every tap did nothing.
 *
 * AND THE MODAL IS THE ONLY WAY TO SET A LOCATION, which is why the empty state says
 * "press" rather than naming a settings page. Ben, 30 August 2026: the Plugins page has
 * no way to open a plugin's settings. Checked: each row carries a name, an enable switch
 * and an Open button that appears only when the plugin declares an HTML PAGE. It never
 * renders `settingFields`, which exists in `plugins-store.js` and is called only by the
 * hand-built Visualizer leaf. So every plugin with settings and no page - this one - has
 * nowhere in Settings to configure it. That is a finding for the audit, not something to
 * work around here; the modal simply owns the field.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { placeIcon, weatherIcon } from 'src/lib/icons.js';
import {
    CORNER_PERIODS, WEATHER_STATE, markFor, rangeOf, unitsOf, weatherState, wetIndex,
    windowOf,
} from 'src/lib/weather-model.js';
import { typeRoles } from 'src/components/type-roles.js';

export class UiWeatherCorner extends UiElement {
    static properties = {
        /** The plugin's last frame, verbatim. Null until one arrives. */
        reading: { attribute: false },
    };

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.reading = null;
    }

    static styles = [typeRoles, css`
        :host {
            display: block;
            /* 290 WIDE, AND THE HEIGHT IS THE BAND'S. The width is stated because it is
             * a layout decision the band cannot infer; the height is not, because the
             * band's own rule fixes it (172 today) and a second declaration here would
             * be a second owner of one number.
             *
             * 290, DOWN FROM 320 — Ben, 30 August 2026: "Weather is a bit too wide."
             * THE PIXELS ARE NOT SAVED, THEY ARE MOVED. The band's phase table sits in its
             * only minmax(0, 1fr) track, so it gets exactly what the other three blocks
             * leave — and measured on the tablet it was getting 365 against the 495 its
             * bracketed headers need, which is why every one of them read TI…(s), W…(g),
             * V…(m. This block giving back 30 and the stats column giving back 37 is most
             * of what closes that gap. */
            inline-size: 290px;
            block-size: 100%;
        }

        .card {
            inline-size: 100%;
            block-size: 100%;
            /* NO SURFACE, NO BORDER, NO RADIUS AT REST - see the header. The band's
               other blocks have none either. */
            background: none;
            border: 0;
            border-radius: var(--ui-radius);
            /* 8px sides, not 12: it is what widens each half of the strip to 68px, which
             * is what lets NIGHT fit. See the header. */
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            color: var(--ui-text);
            font: inherit;
            text-align: inherit;
            cursor: pointer;
            transition: background .14s ease;
        }

        .card:hover { background: var(--ui-key); }
        .card:focus-visible {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: -2px;
            background: var(--ui-key);
        }
        @media (prefers-reduced-motion: reduce) {
            .card { transition: none; }
        }

        /* THE SVG IS SIZED, NOT ITS WRAPPER — the same rule <ui-icon-button> applies to
         * its slotted glyph. A <span> is inline, so inline-size on it does nothing, and
         * an <svg> carrying only a viewBox then falls back to its default 300 x 150: on
         * the tablet that pushed the whole card past its 216 px box and left the mark
         * invisible. The render test asserted the svg EXISTED, which it did. */
        .glyph {
            display: block;
            color: var(--ui-text-2);
        }
        /* 46, NOT 54, AND THE DEVICE IS WHY. At 54 the card's content came to 222 px
         * inside a 214 px box on the tablet and the last line clipped. The render harness
         * cannot see it: this display renders text about 10 per cent larger than the
         * harness does, so the overflow exists only where it matters. Measured back at
         * 46 through CDP on the machine itself. */
        .glyph svg {
            display: block;
            inline-size: 44px;
            block-size: 44px;
        }

        /* THE HEAD, SIDEWAYS. One line, mark then temperature, and the row is the full
         * width so anything added later has a place to sit. */
        .head {
            inline-size: 100%;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        /* TODAY'S RANGE, IN THE ROOM THE SIDEWAYS HEAD OPENED UP. Ben, 30 August 2026.
         * The mark and the temperature take about 145 of the block's 290, so the pair sits
         * at the far end rather than under anything — pushed there by the spacer so the
         * temperature keeps its place when the range is absent. Two lines, because MAX and
         * MIN on one would need 160 and there are 100. */
        .range {
            margin-inline-start: auto;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            line-height: 1.15;
        }
        .range .pair { display: flex; align-items: baseline; gap: 7px; }
        .range .k {
            font-size: var(--ui-text-2xs);
            font-weight: 600;
            letter-spacing: .06em;
            text-transform: uppercase;
            color: var(--ui-muted);
        }
        .range .v {
            font-size: var(--ui-text-md);
            color: var(--ui-text-2);
            font-variant-numeric: tabular-nums;
        }
        .prompt .glyph svg {
            inline-size: 40px;
            block-size: 40px;
        }

        .temp {
            display: flex;
            align-items: baseline;
            gap: 3px;
            font-variant-numeric: tabular-nums;
        }
        .temp .value {
            /* 40, not --ui-display-lg's 45. See THE TEMPERATURE in the header. */
            font-size: 40px;
            font-weight: 500;
            line-height: 1.05;
            letter-spacing: -.02em;
            color: var(--ui-channel-group-temperature);
        }
        .temp .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); }

        /* THE RAIN STRIP. The rule sits UNDER the title, which is the settings page's own
         * idiom: a heading, then the line it heads, then what it heads. Both divisions use
         * --ui-seam-ink, the token for a seam INSIDE a one-piece control, rather than
         * --ui-line, which is the weight that encloses one. */
        .rain {
            /* IT FILLS RATHER THAN HANGS. It used to carry margin-block-start: auto, so
             * every spare pixel in the box collected in ONE place — between the
             * temperature and the rule — and Ben read that as a gap to close (30 August:
             * "move the horizontal line up slightly"). Closing it by hand would have
             * lifted the last line off the band's bottom edge and broken the alignment
             * he asked for the round before. Growing into the slack does both: the rule
             * rises to sit under the temperature and 0 mm stays on the bottom. */
            flex: 1 1 auto;
            inline-size: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
        }
        /* THE RULE SITS ABOVE THE TITLE, WHICH REVERSES 29 AUGUST. Ben chose the other
         * order then ("the line above rain should be below, that is how we usually do it
         * in the settings page") and reversed it on 30 August, having seen it on the
         * machine: "its not quite clear that RAIN is the title for the below". Under the
         * rule the words read as one more row in the stack; over it they head the block.
         *
         * AND THE TITLE SAYS WHAT THE NUMBER IS. "Rain" over "43%" left the 43 unnamed;
         * "Chance of rain" names it. It measures 205px in the block's 283, so it fits at
         * this skin's own tracking with 78 to spare — the RAIN % fallback Ben offered was
         * not needed. */
        .rain .title {
            align-self: stretch;
            text-align: center;
            border-block-start: var(--ui-border-w) solid var(--ui-seam-ink);
            font-size: var(--ui-text-md);
            font-weight: 600;
            letter-spacing: .14em;
            text-transform: uppercase;
            color: var(--ui-muted);
            line-height: 1.2;
            padding-block: 6px 4px;
        }
        /* NO DIVIDER BETWEEN THE PERIODS, and the halves are equal — Ben, 30 August
         * 2026. The tracks were 1fr / 1px / 1.18fr only because NIGHT is five characters
         * and PM is two, and a seam explained the imbalance. With nothing between them,
         * equal halves centre the two groups on the quarter and three-quarter points,
         * which is what reads as a pair. The rule the block still has is the one above
         * the title. */
        .halves {
            flex: 1 1 auto;
            inline-size: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: stretch;
        }
        .half { display: flex; flex-direction: column; align-items: center;
                justify-content: space-between; }
        /* 14px, NOT 12, because 12 made this the smallest text in the whole band while
           everything beside it - Phase, (s), Ratio - sits at 14. Ben, 30 August 2026.
           The halves below are UNEQUAL to pay for it: NIGHT is five characters and PM is
           two, so equal halves would have to be sized for the longer one and waste the
           difference on the shorter. */
        .half .label {
            /* 16, up from 14. Ben has twice called this block's small type too small,
             * and the wider box pays for it without touching the scale. */
            font-size: var(--ui-text-note);
            font-weight: 600;
            letter-spacing: .04em;
            text-transform: uppercase;
            color: var(--ui-muted);
            line-height: 1.4;
        }
        .half .chance {
            font-size: var(--ui-text-lg);
            font-variant-numeric: tabular-nums;
            line-height: 1.15;
        }
        .half .amount {
            font-size: var(--ui-text-base);
            color: var(--ui-text-2);
            font-variant-numeric: tabular-nums;
            line-height: 1.3;
        }
        .half .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); }
        .half.wet .chance { color: var(--ui-channel-flow); }

        /* The prompt: no location has ever been set, so the corner asks once. */
        .card.prompt { justify-content: center; gap: 10px; }
        .prompt .ask { font-size: var(--ui-text-note); color: var(--ui-text-2); text-align: center; }
        .prompt .where { font-size: var(--ui-text-xs); color: var(--ui-muted); text-align: center; }
    `];

    render() {
        const state = weatherState(this.reading);
        if (state === WEATHER_STATE.HIDDEN) return nothing;
        if (state === WEATHER_STATE.PROMPT) return this.#renderPrompt();
        return this.#renderReading();
    }

    #renderPrompt() {
        const t = this.#i18n.t;
        return html`<button
            class="card prompt"
            type="button"
            @click=${this.#open}
        >
            <span class="glyph">${placeIcon()}</span>
            <span class="ask">${t('Set your location')}</span>
            <span class="where">${t('Press to choose a place')}</span>
        </button>`;
    }

    #renderReading() {
        const t = this.#i18n.t;
        const reading = this.reading;
        const units = unitsOf(reading);
        const periods = windowOf(reading, CORNER_PERIODS);
        const wet = wetIndex(periods);
        /* NULL ON A TABLET STILL RUNNING weather.reaplugin 1.0.x, which sends neither
         * field. The pair is then simply absent — the head keeps its shape. */
        const range = rangeOf(reading);

        return html`<button
            class="card"
            type="button"
            aria-label=${t('Weather. Press for detail.')}
            @click=${this.#open}
        >
            <div class="head">
                <span class="glyph">${weatherIcon(markFor(reading.code, reading.isDay))}</span>
                <div class="temp">
                    <span class="value">${Math.round(reading.temperature)}</span
                    ><span class="unit">${units.temperature}</span>
                </div>
                ${range ? html`<div class="range">
                    <span class="pair"><span class="k">${t('Max')}</span
                        ><span class="v num">${Math.round(range.high)}&deg;</span></span>
                    <span class="pair"><span class="k">${t('Min')}</span
                        ><span class="v num">${Math.round(range.low)}&deg;</span></span>
                </div>` : nothing}
            </div>
            ${periods.length ? html`<div class="rain">
                <span class="title">${t('Chance of rain')}</span>
                <div class="halves">
                    ${periods.map((period, i) => html`
                        <div class="half ${i === wet ? 'wet' : ''}">
                            <span class="label">${t(period.label)}</span>
                            <span class="chance">${this.#chance(period)}</span>
                            <span class="amount">${this.#amount(period, units)}</span>
                        </div>`)}
                </div>
            </div>` : nothing}
        </button>`;
    }

    /**
     * THE COMPONENT OPENS NOTHING ITSELF. It says it was pressed and the screen decides
     * what can answer - `dye-handoff`'s own rule, written after the old skin's button
     * called `window.openDye2ForShot` when it happened to exist and did nothing at all
     * when it did not.
     */
    #open = () => {
        this.dispatchEvent(new CustomEvent('weather-open', { bubbles: true, composed: true }));
    };

    /**
     * A DASH FOR A PERIOD THE FORECAST DOES NOT COVER, never a zero.
     *
     * The plugin sends `null` when no hour of a bucket was in the response — three
     * forecast days do not always reach the far edge of the third period. Drawing that as
     * "0 %" would state a dry night the forecast never claimed, which is the same class
     * of lie as a stale number.
     */
    #chance(period) {
        if (typeof period.probability !== 'number') return html`&mdash;`;
        return html`${period.probability}<span
            class="unit"
        >%</span>`;
    }

    #amount(period, units) {
        if (typeof period.amount !== 'number') return nothing;
        return html`${period.amount}<span
            class="unit"
        > ${units.rain}</span>`;
    }
}

customElements.define('ui-weather-corner', UiWeatherCorner);
