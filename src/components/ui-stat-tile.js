/**
 * <ui-stat-tile> — a labelled reading: a microcap over a number, with an optional
 * unit beside it.
 *
 * It formats nothing and knows no channels. The caller passes a formatted string and,
 * if it wants one, a tint.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/* The absent-value mark. Declared here rather than imported so the component has no
   dependency on the units store for one glyph. */
const NO_READING_MARK = '—';

/* What an absent reading is called out loud. A translation key: the component
   decides the wording so every tile says the same thing. */
const ABSENT_KEY = 'no reading';

export class UiStatTile extends UiElement {
    static properties = {
        /* The microcap over the reading. Always rendered, so the track never collapses. */
        label: { type: String },
        /* The reading, already formatted. null, undefined and '' are absent and render the
           dash; 0 is a reading and renders as 0. */
        value: { type: String },
        /* The unit suffix, in the label's register. Omitted when empty. */
        unit: { type: String },
        /* Which display step the digits read: xs|sm|md|lg|xl. */
        size: { type: String, reflect: true },
        /* The track floor, for a tile that will be promoted. */
        reserve: { type: String, reflect: true },
        /* The absent-value mark, overridable. Not the same string as the announced
           sentence: one is a glyph, the other is speech. */
        dash: { type: String },
        /* Whether the value slot carries anything. */
        _slotted: { type: Boolean, state: true },
    };

    static styles = [visuallyHidden, css`
        :host {
            /* No container-type here. The base sets one, which is right for anything that
               fills a region, but this tile is sized by its own type step. */
            container-type: normal;
            display: grid;

            /* Which display step the digits read. Overridden per size below. */
            --_ui-stat-value-size: var(--ui-display-lg);

            /* The value track's floor defaults to the token the digits read, so the track and
               the number are one number and cannot drift. */
            --_ui-stat-value-reserve: var(--_ui-stat-value-size);

            /* The label track is derived from the microcap's line box, not restated. */
            --_ui-stat-label-h: calc(var(--ui-text-sm) * 1.2);

            --_ui-stat-value-tracking: normal;

            --_ui-stat-unit-size: var(--ui-text-2xs);

            /* The reading's ink. A tint arrives from the caller; this component owns no channel
               table. */
            --_ui-stat-ink: var(--ui-text);

            /* minmax rather than a fixed track: the tile may be promoted to a larger step
               mid-shot and must not shrink when it is demoted again. */
            grid-template-rows:
                var(--_ui-stat-label-h)
                minmax(var(--_ui-stat-value-reserve), 1fr);

            row-gap: var(--ui-space-1);

            /* min-inline-size: 0 so a tile in a cluster can shrink below its content rather
               than forcing the row wider. */
            min-inline-size: 0;
        }

        /* The five display steps, authored rather than computed: a host attribute beats the
           bare host rule whatever the source order. */
        :host([size="xs"]) { --_ui-stat-value-size: var(--ui-display-xs); }
        :host([size="sm"]) { --_ui-stat-value-size: var(--ui-display-sm); }
        :host([size="md"]) { --_ui-stat-value-size: var(--ui-display-md); }
        :host([size="lg"]) { --_ui-stat-value-size: var(--ui-display-lg); }
        :host([size="xl"]) { --_ui-stat-value-size: var(--ui-display-xl); }

        /* The reserve, same five steps. A tile promoted mid-shot carries the larger reserve
           and its box never changes size. */
        :host([reserve="xs"]) { --_ui-stat-value-reserve: var(--ui-display-xs); }
        :host([reserve="sm"]) { --_ui-stat-value-reserve: var(--ui-display-sm); }
        :host([reserve="md"]) { --_ui-stat-value-reserve: var(--ui-display-md); }
        :host([reserve="lg"]) { --_ui-stat-value-reserve: var(--ui-display-lg); }
        :host([reserve="xl"]) { --_ui-stat-value-reserve: var(--ui-display-xl); }

        .label {
            grid-row: 1;
            align-self: start;

            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            /* Nowrap by default, wrapping when a caller asks. Every tile in the gauge cluster
               is one word wide; a two-word label elsewhere would otherwise spill sideways. */
            white-space: var(--_ui-stat-label-wrap, nowrap);

            color: var(--ui-muted);

            /* The family is restated because the cluster around this tile sets none. */
            font-family: var(--ui-font-family);

            font-size: var(--ui-text-sm);

            font-weight: var(--ui-weight-semibold);

            letter-spacing: var(--ui-tracking-cap);

            /* The line box is the track, so every label in a cluster sits on one baseline. */
            line-height: var(--_ui-stat-label-h);

            text-transform: uppercase;
        }

        .value {
            grid-row: 2;
            align-self: end;
            display: flex;
            align-items: baseline;
            min-inline-size: 0;

            color: var(--_ui-stat-ink);
            font-family: var(--ui-font-family);
            font-size: var(--_ui-stat-value-size);

            /* Tabular figures are not negotiable on a readout changing fifteen times a second:
               proportional digits make the number jitter sideways on every frame. */
            font-variant-numeric: tabular-nums;

            font-weight: var(--ui-weight-light);

            letter-spacing: var(--_ui-stat-value-tracking);

            /* The line box is exactly the font size, which is what lets the track floor and the
               type read one token. */
            line-height: 1;

            /* A reading never wraps and never ellipsises: a clipped number is a wrong number. A
               narrow container is absorbed by the fluid type step instead. */
            white-space: nowrap;

            transition: font-size var(--ui-dur-slow) var(--ui-ease);
        }

        @media (prefers-reduced-motion: reduce) {
            .value { transition: none; }
        }

        /* The reading carries no paint of its own. The ink is on the value box, so a
           slotted control inherits the same tint through currentColor. */
        .reading {
            min-inline-size: 0;
        }

        /* An absent reading is muted. */
        .value.is-absent {
            color: var(--ui-muted);
        }

        .unit {
            margin-inline-start: var(--ui-space-1);

            /* The unit takes the label's ink, not the reading's: it is part of the label's
               register. */
            color: var(--ui-muted);

            font-size: var(--_ui-stat-unit-size);

            /* Stated because the value box above sets a weight the unit must not inherit. */
            font-weight: var(--ui-weight-regular);

            /* The reading's tracking is the reading's. A unit is a word. */
            letter-spacing: normal;
        }

        /* A slot for an action in the value's place. */
        slot[name="value"] {
            display: contents;
        }

    `];

    constructor() {
        super();
        this.label = '';
        this.value = null;
        this.unit = '';
        this.size = 'lg';
        this.reserve = '';
        this.dash = NO_READING_MARK;
        this._slotted = false;
        /* The controller subscribes on connect and re-renders on a locale change. */
        this.i18n = new I18nController(this);
    }

    /* Absence is not falsiness. 0, '0' and 0.0 are readings; null, undefined and '' are
       not. A zero that reads as a measurement is the defect this guards. */
    get #absent() {
        return this.value === null || this.value === undefined || this.value === '';
    }

    #onSlotChange(event) {
        const assigned = event.target.assignedNodes({ flatten: true });
        this._slotted = assigned.some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.textContent || '').trim() !== '',
        );
    }

    render() {
        /* A slotted control replaces the reading rather than sitting beside it: the tile has
           one value position. */
        /* The unit survives an absent reading — the dash is the value, and the unit still
           says what would have been measured. */
        const own = this._slotted
            ? nothing
            : this.#absent
                /* The dash is a glyph standing for a sentence, so it is hidden from the
                   accessibility tree and the sentence is exposed instead. */
                ? html`<span id="reading" class="reading" aria-hidden="true"
                    >${this.dash}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit" aria-hidden="true"
                            >${this.unit}</small>`
                        : nothing
                    }<span id="a11y" class="a11y">${this.i18n.t(ABSENT_KEY)}</span>`
                : html`<span id="reading" class="reading">${this.value}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit">${this.unit}</small>`
                        : nothing}`;

        /* Off while a control is slotted: a slotted control is an action, not an absent
           reading. */
        const valueClass = !this._slotted && this.#absent ? 'value is-absent' : 'value';

        return html`<span id="label" class="label">${this.label}</span
            ><div id="value" class=${valueClass}>${own}<slot
                name="value" @slotchange=${this.#onSlotChange}></slot></div>`;
    }
}

customElements.define('ui-stat-tile', UiStatTile);
