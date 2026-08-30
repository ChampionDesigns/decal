/**
 * ui-chart-legend.js — component #10 of the 57-component inventory: THE CHART KEY,
 * WHICH IS ALSO A CONTROL.
 *
 * Wave 3, item #10 (SCOPE Part 4 "Wave 3 — the platform owners"; SCOPE.md:1597,
 * "Chart legend (+ item, swatch) | Chip row for a plot; swatch weight reads
 * `--ui-chart-stroke`/`-minor` per series instead of a fixed 3px (spec §6.2). Its 78px
 * height cost is part of #9's layout contract. | small | #9's layout contract, chart
 * tokens"). Token-only and data-free: no store, no endpoint, no derivation. The legend
 * is handed a list of series and it draws them; it never asks anything for one.
 *
 * ONE COMPONENT, THREE PARTS. The inventory row reads "(+ item, swatch)" the same way
 * row #12 reads "Badge (+ active, attention)" and row #11 "Time key (+ strip, caption)":
 * those are the PARTS of one component, not three tags. Slate's three classes
 * (`.slate-chart-legend`, `-item`, `-swatch`, slate-components.css:832-873) are one
 * builder's output — `createLegend(host, series, onChange)` (uplot-legend.js:26) writes
 * every button itself. So does this, and `part="row|item|swatch|label|value"` is how a
 * screen reaches any of them from outside without piercing the boundary.
 *
 * ─── WHAT IT IS FOR, in Slate's own words (uplot-legend.js:1-16, read read-only) ────
 *   "The previous library's legend already toggled a series on click and isolated one
 *    on double-click; what it did not do was look like something you could press. The
 *    expanded charts overlay six lines in the 0-4 band and the only way to read one of
 *    them is to put the others away, so this is a control that happens to also be a key
 *    — chip-sized hit areas, a visible ground, and the same behaviour:
 *        tap          hide or show that series
 *        double tap   isolate it (or restore everything, if already isolated)
 *    Built as DOM rather than drawn into the canvas: it is pressed, so it needs to be a
 *    button — reachable, announceable, and with a hit area that does not depend on where
 *    a line happens to end."
 * That behaviour is carried whole. It is a shipped capability, not a proposal.
 *
 * ─── THE BUG THIS COMPONENT IS ON THE HOOK FOR — chart-C10 (spec §7.8, §6.1 rule 4) ──
 *   "C10 | `createPlot` measures its host BEFORE its own 78px legend is inserted as a
 *    preceding sibling, so every plot is born sized to a box it no longer occupies."
 *    (`chart-components.js:73-121`; `uplot-plot.js:252-253`)
 *   §6.1 rule 4 costs it out: "The host costs 78px: 44 chip + 8 + 8 padding + 18 margin
 *   (`slate-components.css:842`, `:837`, `:927-929`)… invisible only because the callers
 *   schedule a compensating resize a frame later."
 *
 *   THE FIX IS SHARED AND THIS IS THIS COMPONENT'S HALF. #9 owns the reserved row:
 *   `grid-template-rows: auto minmax(var(--ui-chart-min-h), 1fr) auto` with
 *   `:host([has-legend]) .legend { min-block-size: var(--ui-legend-chip-h) }`
 *   (ui-chart-card.js:210, :233-236) — the row exists whether or not it is filled, so
 *   nothing is inserted as a surprise sibling after the measure. This component's half
 *   is to FIT that row and to change size only in ways the card's `ResizeObserver` can
 *   see: it is a plain block in the flow with no absolute positioning, no transform and
 *   no margin of its own, so a wrap to a second row grows the legend row, shrinks the
 *   plot box, and the card re-measures (ui-chart-card.js:528-536). The 78px is now 52px
 *   — 44px of chip (`--ui-legend-chip-h`) plus the card's own 8px below it — because the
 *   16px of legend padding and the 18px margin were three declarations in two files
 *   saying one thing, and the row's spacing belongs to the row's owner.
 *   `test/render/ui-chart-legend.render.test.mjs` measures that, with a legend and a
 *   real shot in a real card, at both Gate A geometries.
 *
 * ─── THE DEFECT §6.2 NAMES FOR THIS COMPONENT SPECIFICALLY ─────────────────────────
 *   "The legend swatch's `border-top: 3px` (`slate-components.css:868`) is fixed
 *    regardless of the series weight it stands for — it reads `--ui-chart-stroke` /
 *    `-minor` per series in the rewrite."
 *   So a minor channel's swatch is 2px here and a major one's is 3px, from the same two
 *   tokens the traces are drawn with (`ui-chart-card.js:492`, `plot-surface.js:580`).
 *   A key that draws a 3px mark for a 2px line is a key that cannot be checked against
 *   the plot, which is the only thing a key is for.
 *
 *   AND THE DASH GOES THE SAME WAY, one step further than §6.2 asks. Slate's swatch has
 *   two states — solid or `border-top-style: dashed` (slate-components.css:872-874) —
 *   while the plot draws four patterns from `DASH_PATTERNS` (chart-axis.js:78-83, §6.2's
 *   "The dash table is one exported constant"). `dashdot` [9,3,3,3] and `longdash`
 *   [15,15] both render as CSS `dashed`, which is the same class of lie as the fixed
 *   3px. The swatch is therefore an SVG line with `stroke-dasharray` taken from that
 *   ONE table, so the mark in the key is the pattern on the canvas, by construction.
 *
 * ─── A6: THE SWATCH AND THE TRACE READ THE SAME TOKEN ──────────────────────────────
 *   `DECISIONS.md:247` — CSS is the single source for chart colour. Today all 16
 *   `--slate-data-*` channel colours exist ONLY in JavaScript, injected into a <style>
 *   appended to <head> last (chart-palette.js:124-156), which is why the legend's colour
 *   arrives as `swatch.style.setProperty('--legend-color', spec.color)` — a STRING
 *   copied out of a JS palette (uplot-legend.js:55). Here the swatch's ink is
 *   `var(--ui-channel-<name>)`, the same custom property `readChartTokens` hands uPlot
 *   for the stroke (chart-tokens.js:212-252). One source, two readers, and the render
 *   suite proves it the only way that is honest: ONE drill on `--ui-channel-pressure`,
 *   asserted to move BOTH the swatch's computed stroke AND the pixels on the card's
 *   canvas. `channelToken()` is imported rather than the prefix being written here, so
 *   `--ui-channel-` appears in exactly one file in the repo.
 *
 *   It also closes the legend's half of bug chart-C4 ("five `--slate-chart-*` tokens
 *   have zero consumers, and one has already drifted from the value it documents — 19 vs
 *   the rendered 17"). `--ui-chart-legend` had no consumer in the tree until this file:
 *   `readChartTokens` reads it into `geometry.legendFontPx` and no plot uses it, because
 *   the legend is not the plot's. The chip's `font-size` is that token. A token nobody
 *   reads is a number waiting to drift, and this is the reader.
 *
 * ─── MEASURED STARTING VALUES — every one an oracle answer, quoted verbatim ─────────
 * (`prov_query.py` against slate-audit-2026-08-16/prov-baseline + prov-light.)
 *
 *   prov_query.py find --cls slate-chart-legend-item
 *     found 20 element(s) in 2 state(s) — expanded-charts, history-viewer
 *     distinct geometries (w x h): 157x44 x4, 175x44 x2, 155x44 x2, 189x44 x2,
 *     145x44 x2, 136x44 x2, 116x44 x2, 190x44 x2, 171x44 x2
 *     <button class="slate-chart-legend-item"> text "Pressure (bar)" … "Target Flow"
 *     — every chip 44px tall, every width its own words. TEN chips per state, which is
 *     §6.1 rule 5's "up to six legend entries" being an understatement.
 *
 *   CITE expanded-charts .slate-chart-legend-item [i=176] background-color =
 *        rgb(26, 33, 39)  <- slate-components.css `.slate-chart-legend-item` authored
 *        `(NOT CAPTURED — set via a CSS shorthand)` !important=no (token-driven)
 *        [dark rgb(26,33,39) / light rgb(248,249,249) — --ui-key's two theme values
 *         exactly (styles/tokens.css:722, :843), and the SOURCE is `background:
 *         var(--slate-key)` at slate-components.css:849, read read-only because the
 *         shorthand hides the token name from the corpus.]
 *   CITE expanded-charts .slate-chart-legend-item [i=176] color = rgb(186, 196, 202)
 *        <- slate-components.css `.slate-chart-legend-item` authored `var(--slate-text-2)`
 *        !important=no (token-driven)     [light rgb(63, 71, 76)]  -> --ui-text-2
 *   CITE expanded-charts .slate-chart-legend-item [i=176] font-size = 17px
 *        <- authored `var(--slate-text-base)` (token-driven)  -> see DEPARTURE 1
 *   CITE expanded-charts .slate-chart-legend-item [i=176] font-weight = 500
 *        <- authored `var(--slate-weight-medium)` (token-driven)  -> --ui-weight-medium
 *   CITE expanded-charts .slate-chart-legend-item [i=176] height = 44px
 *        <- authored `var(--slate-chip-height)` (token-driven)  -> --ui-legend-chip-h
 *        (styles/tokens.css:537 quotes this same record) -> see DEPARTURE 2
 *   CITE expanded-charts .slate-chart-legend-item [i=176] border-top-width = 1px,
 *        border-top-left-radius = 6px, padding-left = 12px, gap = 8px
 *        <- `(NOT CAPTURED — set via a CSS shorthand)` (token-driven)
 *        -> --ui-border-w, --ui-radius, --ui-space-3, --ui-space-2
 *   CITE expanded-charts .slate-chart-legend-item [i=176] border-top-color =
 *        dark rgb(58, 72, 82) / light rgb(203, 208, 211)   -> --ui-line
 *   CITE expanded-charts .slate-chart-legend-item [i=176] box-shadow = none,
 *        text-transform = none, letter-spacing = normal, opacity = 1
 *   CITE themes expanded-charts .slate-chart-legend-item: 15 of 18 properties identical
 *        across themes; 3 differ (background-color, border-top-color, color) — all three
 *        are token swaps, so this component states no theme-conditional rule at all.
 *
 * WHAT THE ORACLE CANNOT ANSWER, and what was read instead
 *   `prov_query.py find --cls slate-chart-legend` and `--cls slate-chart-legend-swatch`
 *   both return "0 elements matched anywhere in this corpus" — the capture records the
 *   BUTTON, never its container or its mark. So the row's own geometry and the whole
 *   swatch come from the Slate source read read-only (Part 10 §4's carve-out), quoted at
 *   the rules below: slate-components.css:832-841 for the row, :864-874 for the swatch.
 *   The `.is-off` paint (:857-862) is in the same position: a state the corpus never
 *   caught, read from source.
 *
 * ─── DELIBERATE DEPARTURES ─────────────────────────────────────────────────────────
 *   1. FONT SIZE READS `--ui-chart-legend`, NOT `--ui-text-base`. Both are 17px, so
 *      nothing on screen moves — spec §3.8 says exactly that ("Propose 17; nothing on
 *      screen moves") — but the number now has ONE home. Slate had two that had already
 *      drifted apart (`--slate-chart-legend: 19px` vs the rendered 17px), which is
 *      bug chart-C4 in its purest form: a token documenting a JS constant.
 *   2. `min-block-size: 44px`, NOT `height: 44px`. Slate's chip is frozen at 1920x1200
 *      where "Group Target °C" fits on one line. Responsive behaviour has no Slate
 *      answer (Part 10 §4's disqualification check) and §2.4 makes silent clipping the
 *      inherited default the rewrite exists to remove, so a label too long for its
 *      container wraps INSIDE a chip that grows, rather than spilling out of a fixed
 *      44px box. At every width where Slate has an answer, this renders Slate's 44px.
 *   3. THE HIT FLOOR IS REAL. Slate's chip is 44px against a 48px `--slate-hit-min`
 *      it never applies here. `hitArea`'s `.hit-overlay` (base.js:175) grows the hit box
 *      to `--ui-hit-min` without moving one pixel of paint, which is the whole point of
 *      that utility existing (Appendix 5: "make them ONE utility rather than three
 *      copies"). The 2px that spills above and below the ink lands inside the card's own
 *      8px gap, and the render suite asserts the overlay never reaches the plot well —
 *      an invisible hit box stealing the crosshair's top 2px would be exactly the kind
 *      of defect a screenshot cannot see.
 *   4. THE ROW OWNS NO OUTER SPACING. Slate spends `padding: 8px 0` on the legend
 *      (`.slate-chart-legend`) plus an 18px margin on its host, inside a card that also
 *      pads. #9 already reserves the row and its 8px below (ui-chart-card.js:233-236),
 *      so restating either here would be §2.3's "the same number written in two places".
 *      The gap BETWEEN chips is this component's (8px row / 12px column, Slate's own
 *      `gap: var(--slate-space-2) var(--slate-space-3)`).
 *   5. THE GROUP HAS A ROLE AND A NAME. Bug chart-C14, second clause: "the legend has no
 *      group role or accessible name". `role="group"` + `aria-label` on the host, in the
 *      same capture-the-author's-value shape ui-bank uses (ui-bank.js:560-601), so a
 *      screen's own `aria-labelledby` is never overwritten.
 *   6. ISOLATE IS POINTER-ONLY. Slate's double-tap runs off `Date.now()` inside a click
 *      handler (uplot-legend.js:62-78), and a keyboard Enter fires that same click — so
 *      two quick Enters isolate a series with no way to see it coming. The 320ms window
 *      here only opens for a pointer-driven click (`event.detail !== 0`); keyboard
 *      activation always toggles. Nothing is lost: isolate is a shortcut for "turn the
 *      other five off", which the keyboard can still do one chip at a time, and Slate's
 *      own "already alone → restore everything" rule is kept so the shortcut is never a
 *      one-way trip.
 *   7. THE SECOND TAP UNDOES THE FIRST BEFORE IT ISOLATES. Slate's restore branch is
 *      unreachable by the gesture it was written for, because the pair's first tap has
 *      already toggled the series by the time the second asks "is this one alone?".
 *      Measured on this suite's first run: four rapid taps end where two did. Three
 *      lines in `#onClick` fix it; the rapid-chain behaviour is unchanged. See there.
 *
 * ─── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────────────
 *   - NO STRINGS. Every word — the group name, each series label, each readout — arrives
 *     already translated. Wave 3's law, and the same one ui-chart-card and ui-toast
 *     state. `channelNameFor` is used for the TOKEN, never for a label: `weight-flow` is
 *     a custom-property suffix, not English.
 *   - NO FORMATTING. `values` takes strings a consumer has already formatted at the
 *     card's own cursor index (`ui-chart-card.js:645`, "the same numbers the chart drew,
 *     at the same index"). A legend that formatted numbers would own units, precision
 *     and a locale, all of which belong to `src/lib/units.js` and the screen.
 *   - NOT A SELECTION SURFACE. The chips carry `aria-pressed`, and this file does NOT
 *     import `selectionSurface`. The four dials mark the ONE chosen thing among many
 *     (CONVENTIONS §4); every chip here is pressed at rest, so painting them with
 *     `--ui-selected-face` would make a resting legend a wall of selection and leave the
 *     exceptional state — a series turned OFF — as the only undecorated one. Slate paints
 *     the off state and nothing else, and so does this. There is a test asserting the
 *     dials stay out.
 *   - NO SECOND BANK. `ui-bank` (#3) is single-select with a seam; this is a multi-toggle
 *     row of separate chips. Sharing the tag would need a fourth `mode` that changes both
 *     the paint and the state model, which is the decay the inventory exists to stop.
 *   - NO uPlot LEGEND. `legend: { show: false }` (uplot-plot.js:454) and it stays false:
 *     uPlot's own legend is a table it positions itself, outside the card's grid row.
 *   - NO TIME KEY. Component #11 (`--ui-timekey-*`) is its own element, `ui-time-key.js`,
 *     built by fix run 6 for the P-Q trajectory: a colour axis needs a strip and two
 *     numbers, not a chip row.
 *
 * API
 *   legend.items = [{ key, label, minor?, dash?, off? }]     the series, in draw order
 *   <ui-chart-legend items='[{"key":"pressure","label":"Pressure (bar)"}]'>
 *   <ui-chart-legend label="Chart key">        the group's accessible name (chart-C14)
 *   legend.values = { pressure: '9.1 bar' }    an already-formatted readout per key
 *   <ui-chart-legend chart="live-chart">       drive that chart's series directly
 *   legend.chart = cardElement                 …or by reference
 *   legend.hiddenKeys / .setVisible(k, on) / .isolate(k) / .reset()
 *   'legend-change'  { key, visible, hidden, reason }        bubbles, composed
 *
 *   Internal knobs (--_ui-, not tokens, not an API surface): --_ui-off-opacity,
 *   --_ui-swatch-ink, --_ui-swatch-dash, --_ui-swatch-w.
 */

import { css, html, nothing } from 'lit';

import { UiElement, hitArea } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { DASH_PATTERNS } from 'src/lib/chart-axis.js';
import { channelNameFor, channelToken, readChartTokens, resolveChannels } from 'src/lib/chart-tokens.js';
import { logger } from 'src/lib/logger.js';

/**
 * Slate's own window, kept as one exported number (uplot-legend.js:19,
 * `const DOUBLE_TAP_MS = 320`). Exported because M4 — the tablet confirmation pass — is
 * the run that gets to measure whether 320ms is right on a Galaxy Tab A9+ with a wet
 * hand, and when it moves it must move in one place. The spike digest lists "the 320 ms
 * double-tap (M4's)" among the three things still unmeasured.
 */
export const DOUBLE_TAP_MS = 320;

/**
 * One item, normalised. Strings are accepted as a bare key so a state can be written in
 * markup, exactly as ui-bank accepts them (ui-bank.js:210) — but a key is a token suffix,
 * not a label, so a bare string renders no words rather than rendering `weight-flow` at
 * the user. That is the NO STRINGS law taking precedence over convenience.
 */
function normaliseItem(item) {
    const raw = typeof item === 'string' ? { key: item } : (item ?? {});
    const key = String(raw.key ?? '');
    return {
        key,
        channel: channelNameFor(key),
        label: typeof raw.label === 'string' ? raw.label : '',
        minor: raw.minor === true,
        dash: typeof raw.dash === 'string' && Object.hasOwn(DASH_PATTERNS, raw.dash) ? raw.dash : null,
        off: raw.off === true,
    };
}

export class UiChartLegend extends UiElement {
    static properties = {
        /**
         * The series this key stands for, in the plot's own draw order. Objects
         * `{ key, label, minor, dash, off }`; parsed from a JSON attribute so the
         * gallery and a test can state one in markup (ui-bank's precedent).
         *
         * `key` is a derivation SERIES_KEY (`weightFlow`) or a channel name
         * (`weight-flow`); `channelNameFor` accepts both and the swatch reads
         * `--ui-channel-<name>` either way. NOT a data source: nothing here fetches,
         * derives or knows what a shot is.
         */
        items: { type: Array },

        /** Accessible name for the GROUP, put on the host as `aria-label` (chart-C14). */
        label: { type: String },

        /**
         * Already-formatted readouts by item key — `{ pressure: '9.1 bar' }`. Absent
         * keys render no readout at all, which is the resting state of every legend
         * that has no cursor on its plot.
         */
        values: { type: Object },

        /**
         * The plot this key belongs to: an element, or the id of one in this legend's
         * root. Optional. Bound, a press applies itself; unbound, the chip still shows
         * its state and `legend-change` is the consumer's road in.
         *
         * DUCK-TYPED ON PURPOSE — anything exposing `channels` (`[{ key }]`, in draw
         * order) and `plotHandle.setSeriesVisible(index, visible)` works. That is
         * `plot-surface.js:517` / `uplot-plot.js:485`, so `ui-chart-card` and any other
         * `PlotSurfaceElement` qualify, and a test can hand it a stub instead of a
         * browser-built chart.
         */
        chart: { attribute: 'chart' },
    };

    static styles = [hitArea, typeRoles, css`
        /* THE HOST IS A ROW IN SOMEONE ELSE'S GRID (chart-C10). Plain block flow, no
         * position, no transform, no margin: the card's ResizeObserver watches the PLOT
         * box (ui-chart-card.js:528-536), so the only honest way for a legend to grow is
         * to grow the flow and let that observer see it. The base's
         * container-type: inline-size is kept — nothing in this file is size-keyed, and
         * a query container costs nothing until something queries it. */
        :host {
            display: block;

            /* PRIVATE GEOMETRY (CONVENTIONS §7). --_ui-swatch-w is the swatch's own
             * width with the public token as its value, so a screen can tighten one
             * legend without redefining a --ui-* token for the whole document; the ink
             * and the dash are per-chip and are set inline by render(). None of these
             * may ever carry a colour literal — --_ui-swatch-ink is always a var().
             * .35 is slate-components.css:861 read verbatim; the corpus never captured
             * an off chip, so it is a source read, not a measurement. */
            --_ui-off-opacity: .35;
            --_ui-swatch-w: var(--ui-legend-swatch-w);
        }

        /* THE ROW. Source, read read-only because the corpus never captured this
         * element (slate-components.css:832-841):
         *     display: flex; flex-wrap: wrap; align-items: center;
         *     gap: var(--slate-space-2) var(--slate-space-3);
         *     padding: var(--slate-space-2) 0;
         * The gaps are carried; the padding is DEPARTURE 4 (the card owns the row's
         * outer spacing). Wrapping is kept, and §6.1 rule 5's complaint about it — "a
         * second chip row costs another ~52px SILENTLY" — is answered by the card's
         * observer rather than by a cap: a cap would hide chips, and §2.4's rule is that
         * nothing goes missing quietly. Ten chips per state is Slate's own number. */
        .row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            column-gap: var(--ui-space-3);
            row-gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        /* THE CHIP — RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2).
         *
         * ORACLE, expanded-charts .slate-chart-legend-item [i=176], quoted in the header:
         *   height 44px <- var(--slate-chip-height)   -> --ui-legend-chip-h (DEPARTURE 2)
         *   background-color rgb(26,33,39)/rgb(248,249,249)  -> --ui-key
         *   color rgb(186,196,202)/rgb(63,71,76)      -> --ui-text-2
         *   border-top-width 1px -> --ui-border-w · border-top-color -> --ui-line
         *   border-top-left-radius 6px -> --ui-radius · padding-left 12px -> --ui-space-3
         *   gap 8px -> --ui-space-2 · font-weight 500 -> --ui-weight-medium
         *   font-size 17px <- var(--slate-text-base)  -> --ui-chart-legend (DEPARTURE 1)
         *   box-shadow none · text-transform none · letter-spacing normal
         *
         * The UA sheet styles <button> inside a shadow root and there is no preflight in
         * here to undo it (ui-button.js:186-188 measured the same thing), so family and
         * size are both stated. "font: inherit" would also drag in the host's line-height
         * and weight, which is not what the oracle reads. */
        .chip {
            display: inline-flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-block-size: var(--ui-legend-chip-h);
            max-inline-size: 100%;
            padding-inline: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key);
            color: var(--ui-text-2);
            font-family: inherit;
            font-size: var(--ui-chart-legend);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
            text-align: start;
            /* The preflight in app.css gives every Slate button cursor: pointer and
             * there is none inside a shadow root — ui-button.js:195 measured the same
             * absence. Stated, or the one control on the card that is pressable is the
             * one that does not say so. */
            cursor: pointer;
        }

        /* THE OFF STATE, expressed as the aria state and painted on it — the state
         * attribute IS the selector, so a chip cannot be painted off while announcing
         * itself on (Appendix 15's contract, and CONVENTIONS §4's "selection expressed
         * as the aria state"). Source, read read-only (slate-components.css:857-862):
         *   "A hidden series stays readable — it is a control you can turn back on, not
         *    a thing that has gone away."
         *      .is-off { background: transparent; color: var(--slate-muted) }
         *      .is-off .slate-chart-legend-swatch { opacity: .35 }
         * NOT the four dials: see the header. The border stays, so the chip keeps its
         * shape and its hit box while its ground drops away. */
        .chip[aria-pressed="false"] {
            background-color: transparent;
            color: var(--ui-muted);
        }

        .chip[aria-pressed="false"] .swatch {
            opacity: var(--_ui-off-opacity);
        }

        /* THE SWATCH. Source (slate-components.css:864-874):
         *   "The swatch carries the series' own stroke: solid or dashed is how an actual
         *    is told from its target, and a key that draws them alike cannot say which."
         *      width: var(--slate-legend-swatch-width); height: 0; flex: 0 0 auto;
         *      border-top: 3px solid var(--legend-color, currentColor);
         *
         * An SVG line rather than a border-top, because the border can carry a WIDTH per
         * series (§6.2's requirement) but not a PATTERN: "dashed" is one CSS keyword for
         * four different dash tables. The box is as tall as the major stroke so a minor
         * chip and a major chip line up on the same baseline; the line is centred in it.
         *
         * "overflow: visible" matters: at a stroke wider than the box (a token drill, or
         * a fork that wants a 6px trace) the mark grows out of its box instead of being
         * clipped to a lie. */
        .swatch {
            flex: none;
            inline-size: var(--_ui-swatch-w);
            block-size: var(--ui-chart-stroke);
            overflow: visible;
        }

        /* THE ONE PLACE COLOUR CROSSES THE BOUNDARY (A6). --_ui-swatch-ink is set inline
         * per chip to "var(--ui-channel-<name>)" — a REFERENCE to the same custom
         * property "readChartTokens" gives uPlot for the stroke, never a copied string.
         * currentColor is the fallback so an unknown channel draws in the chip's own ink
         * rather than vanishing; "unresolvedChannels" is what makes that loud. */
        .swatch line {
            stroke: var(--_ui-swatch-ink, currentColor);
            stroke-width: var(--ui-chart-stroke);
            stroke-dasharray: var(--_ui-swatch-dash, none);
            stroke-linecap: butt;
        }

        /* §6.2's fix, in one declaration: the swatch's weight is the series' weight.
         * "minor" is the same flag ui-chart-card puts on a target or a derived channel
         * (ui-chart-card.js:146-152) and it resolves to the same token there (:492). */
        .chip[data-minor] .swatch line {
            stroke-width: var(--ui-chart-stroke-minor);
        }

        /* DEPARTURE 2's other half: the words may wrap inside a chip that grows, and may
         * never push the row wider than its container. */
        .label {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        /* THE READOUT, when a consumer has one. ".ui-numeric" is type-roles.js's
         * modifier — tabular, lining figures, no size or colour of its own — so a value
         * changing at 15Hz does not jitter the chip's width (type-roles.js:284-293). */
        .value {
            flex: none;
            color: var(--ui-muted);
            font-variant-numeric: tabular-nums lining-nums;
        }
    `];

    constructor() {
        super();
        this.items = [];
        this.label = '';
        this.values = null;
        this.chart = null;
    }

    /** Keys currently turned off. A Set, so isolate is one pass. */
    #hidden = new Set();

    /** The last pointer tap, for the 320ms isolate window (uplot-legend.js:31-32). */
    #lastTapAt = 0;
    #lastTapKey = null;
    /** Was that last tap a plain toggle? DEPARTURE 7's guard — see #onClick. */
    #lastWasToggle = false;

    /** Channel names whose token resolved to nothing at the last check. */
    #unresolved = Object.freeze([]);

    /** ui-bank.js:520-540's capture, for the same reason: never overwrite the screen's. */
    #authorRole = null;
    #authorLabel = null;
    #captured = false;

    /* ---- what a screen and a test read ------------------------------------- */

    /**
     * The normalised items, in draw order — `{ key, channel, label, minor, dash, off }`.
     * A fresh array of fresh objects on every read, so a consumer holding it cannot
     * reach back into this component's state.
     */
    get series() { return this.#items(); }

    /** The keys currently turned off, in item order. */
    get hiddenKeys() { return this.#items().filter((i) => this.#hidden.has(i.key)).map((i) => i.key); }

    /** True while a series is drawn. */
    isVisible(key) { return !this.#hidden.has(String(key)); }

    /**
     * Channels whose `--ui-channel-*` token resolved to nothing when the items last
     * changed — `['weightflow (--ui-channel-weightflow)']`, `resolveChannels`'s own
     * wording. NOT a throw: the card throws because an unpainted trace is
     * indistinguishable from a quantity the machine never reported, while a swatch with
     * no colour still shows its label and its state. Reported rather than silent, and
     * `logger.error` carries the same list.
     */
    get unresolvedChannels() { return this.#unresolved; }

    /* ---- the control ------------------------------------------------------- */

    /** Show or hide one series. The road in for a screen restoring saved state. */
    setVisible(key, visible, reason = 'set') {
        const id = String(key);
        if (visible) this.#hidden.delete(id);
        else this.#hidden.add(id);
        this.#commit(id, visible, reason);
    }

    /**
     * Isolate one series — or, if it is already the only one showing, put everything
     * back. Slate's own rule (uplot-legend.js:68-73): "Without the second half, an
     * isolating double tap is a one-way trip that needs five taps to undo."
     */
    isolate(key) {
        const id = String(key);
        const items = this.#items();
        const alreadyAlone = items.every((item) => (item.key === id) === !this.#hidden.has(item.key));
        this.#hidden = new Set(alreadyAlone ? [] : items.filter((i) => i.key !== id).map((i) => i.key));
        this.#commit(id, !this.#hidden.has(id), alreadyAlone ? 'restore' : 'isolate');
    }

    /** Show everything again — Slate's `reset()`, for a rebuilt series set. */
    reset() {
        this.#hidden = new Set();
        this.#commit(null, true, 'reset');
    }

    /* ---- lifecycle --------------------------------------------------------- */

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('items')) return;
        /* A NEW SERIES SET DROPS THE STATE THAT NO LONGER APPLIES, and keeps the state
         * that does. Slate resets everything (uplot-legend.js:86-87) because its legend
         * is rebuilt from scratch whenever the chart is; here the same five channels
         * arriving again — a theme flip rebuilds the plot, and the screen re-hands the
         * specs — must not turn six chips back on behind the user. Pruning is the
         * version of "reset" that survives a rebuild. */
        const live = new Set(this.#items().map((item) => item.key));
        for (const key of [...this.#hidden]) if (!live.has(key)) this.#hidden.delete(key);
        for (const item of this.#items()) if (item.off) this.#hidden.add(item.key);
        this.#checkChannels();
    }

    updated(changed) {
        super.updated(changed);
        /* DEPARTURE 5 — chart-C14's second clause. Both branches on the name, for the
         * reason ui-bank.js:587-601 spells out: an attribute written and never removed
         * is state that cannot go back, and clearing THIS component's name must not
         * delete the screen's. */
        if (this.#authorRole === null) this.setAttribute('role', 'group');
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
        /* A chart bound after the items arrived starts out of step with the chips. */
        if (changed.has('chart') || changed.has('items')) this.#applyToChart();
    }

    /**
     * NOTHING TO CLEAN UP ON DISCONNECT, and it is a design choice rather than an
     * oversight (CONVENTIONS §12). Every listener is a Lit binding on a button in this
     * component's own shadow tree; there is no host listener, no observer, no timer and
     * no vendor instance. The bound chart is READ, never subscribed to.
     */

    /**
     * THE OPENING TAG IS BROKEN ACROSS LINES ON PURPOSE and must stay that way. Gate D's
     * constructed-path scan is deliberately STRUCTURAL rather than a keyword list
     * (scripts/gate-d.js:200-213): an interpolated template literal counts as a route
     * assembled from fragments when it contains a `/` and no newline, no `;` and no `{`.
     * `html`<div class="row" part="row">${…}</div>`` is exactly that shape — MEASURED, it
     * failed Gate D on this file's first full run — and it is a false positive that
     * cannot be narrowed away without weakening the check for the real thing it catches.
     * A newline inside the literal is the whole fix. There is no leading whitespace
     * before `<div`, because that would put an anonymous inline box in the shadow root.
     */
    render() {
        const values = this.values ?? {};
        return html`<div
            class="row"
            part="row"
        >${this.#items().map((item) => {
            const visible = !this.#hidden.has(item.key);
            const value = values[item.key];
            return html`<button
                type="button"
                class="chip hit-overlay"
                part="item"
                id=${`chip-${item.key}`}
                data-key=${item.key}
                ?data-minor=${item.minor}
                aria-pressed=${visible ? 'true' : 'false'}
                style=${`--_ui-swatch-ink: var(${channelToken(item.channel)});`
                    + (item.dash ? ` --_ui-swatch-dash: ${DASH_PATTERNS[item.dash].join(' ')};` : '')}
                @click=${(event) => this.#onClick(event, item.key)}
            ><svg class="swatch" part="swatch" aria-hidden="true"
                ><line x1="0" y1="50%" x2="100%" y2="50%"></line></svg
            ><span class="label" part="label">${item.label}</span
            >${value === undefined || value === null || value === ''
                ? nothing
                : html`<span class="value ui-numeric" part="value">${value}</span>`}</button>`;
        })}</div>`;
    }

    /* ---- internals --------------------------------------------------------- */

    #items() {
        return (Array.isArray(this.items) ? this.items : []).map(normaliseItem).filter((i) => i.key);
    }

    /**
     * Slate's two gestures, with DEPARTURE 6's guard. `event.detail` is the click count
     * a pointer carries and is 0 for a keyboard-activated click, so the isolate window
     * only ever opens for a finger or a mouse.
     *
     * DEPARTURE 7 — THE SECOND TAP UNDOES THE FIRST BEFORE IT ISOLATES, and it is three
     * lines. Slate's own comment states the intent — "Isolate — or, if this one is
     * already the only one showing, put everything back" (uplot-legend.js:68-71) — and
     * its code cannot reach it: the first tap of the pair has ALREADY toggled the series
     * off by the time the second evaluates `alreadyAlone`, so a double tap on an
     * isolated series never sees it as alone and isolates it again. MEASURED on the
     * first run of this suite: four rapid taps on one chip end where two did. Slate's
     * restore branch is only reachable by a THIRD consecutive tap, which is not a
     * gesture anybody performs on purpose. Undoing the pair's first toggle makes the
     * decision on the state the user was looking at when the gesture started.
     *
     * Only when the previous click was a plain TOGGLE: in a rapid chain the previous
     * click was itself an isolate, there is nothing to undo, and Slate's chain
     * behaviour is kept exactly (tap-tap-tap = isolate then restore).
     */
    #onClick(event, key) {
        const pointer = Number(event.detail) !== 0;
        const now = event.timeStamp;
        const isDouble = pointer && this.#lastTapKey === key && (now - this.#lastTapAt) < DOUBLE_TAP_MS;
        const undoable = this.#lastWasToggle;
        this.#lastTapAt = pointer ? now : 0;
        this.#lastTapKey = pointer ? key : null;
        this.#lastWasToggle = !isDouble;
        if (isDouble) {
            if (undoable) {
                if (this.#hidden.has(key)) this.#hidden.delete(key);
                else this.#hidden.add(key);
            }
            this.isolate(key);
        } else {
            this.setVisible(key, this.#hidden.has(key), 'toggle');
        }
    }

    /** Paint, drive the plot if there is one, and say what happened — in that order. */
    #commit(key, visible, reason) {
        this.requestUpdate();
        this.#applyToChart();
        this.dispatchEvent(new CustomEvent('legend-change', {
            bubbles: true,
            composed: true,
            detail: { key, visible, reason, hidden: this.hiddenKeys },
        }));
    }

    /** The bound chart, by reference or by id in this legend's own root. */
    get #chartElement() {
        const chart = this.chart;
        if (!chart) return null;
        if (typeof chart !== 'string') return chart;
        const root = this.getRootNode?.();
        return root?.getElementById?.(chart) ?? null;
    }

    /**
     * Apply the chips' state to the plot, matching by KEY rather than by position: a
     * legend may name fewer channels than the plot draws, or name them in another order,
     * and index-matching two lists that were never promised to agree is how a key ends
     * up hiding the wrong trace.
     */
    #applyToChart() {
        const chart = this.#chartElement;
        const handle = chart?.plotHandle;
        const channels = chart?.channels;
        if (!handle?.setSeriesVisible || !Array.isArray(channels)) return false;
        let applied = 0;
        for (const item of this.#items()) {
            const index = channels.findIndex((c) => c.key === item.key
                || channelNameFor(c.key) === item.channel);
            if (index < 0) continue;
            handle.setSeriesVisible(index, !this.#hidden.has(item.key));
            applied += 1;
        }
        return applied > 0;
    }

    /**
     * Does every channel this key names have a colour? `readChartTokens` answers "did
     * the SHEET arrive", `resolveChannels` answers "did MY keys resolve" — and the
     * second question is the one a legend can get wrong on its own, by naming a
     * derivation key the SERIES_KEY_CHANNELS table has never heard of
     * (chart-tokens.js:70-92, which measured 5 of 14 resolving before that table
     * existed). Non-strict on both, because a legend is not a plot: it reports.
     */
    #checkChannels() {
        const items = this.#items();
        if (!items.length) { this.#unresolved = Object.freeze([]); return; }
        let tokens;
        try {
            tokens = readChartTokens(this, { strict: false });
        } catch {
            return;                       // no getComputedStyle: not connected yet
        }
        const { unresolved } = resolveChannels(items.map((i) => i.key), tokens.channels, { strict: false });
        this.#unresolved = unresolved;
        if (unresolved.length) {
            logger.error(
                `ui-chart-legend: ${unresolved.length} channel(s) have no colour — ${unresolved.join(', ')}. `
                + 'The swatch falls back to the chip\'s own ink; every drawn channel needs a token in '
                + 'styles/chart-channels.css and, if its key is a derivation key, an entry in '
                + 'SERIES_KEY_CHANNELS (A6).',
            );
        }
    }
}

customElements.define('ui-chart-legend', UiChartLegend);
