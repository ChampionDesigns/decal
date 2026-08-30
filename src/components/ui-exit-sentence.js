/**
 * A profile step's exit condition as a row of chips, each one editable.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    exitBand,
    exitTypeLabel,
    formatExitValue,
    serializeExitSlots,
} from 'src/lib/exit-sentence.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-menu.js';

export class UiExitSentence extends UiElement {
    static properties = {
        step: { type: Object },
        /** Which step column this band belongs to. Travels on every event. */
        index: { type: Number },
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },
        /** Paint dims (the base) and every control refuses. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        typeRoles,
        css`
            :host {
                --_ui-exit-floor: var(--ui-control-h);
                min-block-size: var(--_ui-exit-floor);
            }

            .band {
                display: grid;

                gap: var(--_ui-exit-gap, var(--ui-space-2));
                align-content: start;
                block-size: 100%;
                min-block-size: var(--_ui-exit-floor);
                overflow-y: auto;

                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            .row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: var(--ui-space-2);
                align-items: center;
                min-block-size: var(--ui-control-h);

                --_ui-exit-tone: var(--ui-steel);
            }
            .row[data-tone='pressure'] { --_ui-exit-tone: var(--ui-channel-pressure); }
            .row[data-tone='flow'] { --_ui-exit-tone: var(--ui-channel-flow); }
            .row[data-tone='power'] { --_ui-exit-tone: var(--ui-channel-power); }

            .row.add {
                grid-template-columns: minmax(0, 1fr);
            }

            .sentence {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-2);
                min-inline-size: 0;
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-2);
                overflow: hidden;

                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text-2);
                cursor: pointer;

                font-family: inherit;
                font-size: var(--ui-text-note);
                text-align: center;
                white-space: nowrap;
            }

            .sentence:disabled {
                cursor: default;
            }

            .phrase,
            .value {
                display: flex;
                align-items: center;
                gap: var(--ui-space-2);
                min-inline-size: 0;
                overflow: hidden;
            }

            .subject {
                min-inline-size: 0;
                overflow: hidden;
                color: var(--_ui-exit-tone);
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-medium);
                text-overflow: ellipsis;
            }

            .verb {
                min-inline-size: 0;
                overflow: hidden;
                font-size: var(--ui-text-sm);
                font-weight: var(--ui-weight-regular);
                text-overflow: ellipsis;
            }

            .number {
                color: var(--_ui-exit-tone);
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-light);
            }

            .unit {
                color: var(--ui-muted);
                font-size: var(--ui-text-sm);
                font-weight: var(--ui-weight-regular);
            }

            .row.dead .sentence {
                border-color: var(--ui-tint-power);
            }

            .note {
                color: var(--ui-tint-power);
                font-size: var(--ui-text-note);
                /* The uncapped <p> of E16, capped: it wraps inside its own row
                 * instead of spilling into the rows above and below. */
                min-inline-size: 0;
                max-inline-size: 100%;
                overflow-wrap: break-word;
            }

            .add-slot {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-1);
                inline-size: 100%;
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-3);

                border: var(--ui-border-w) dashed
                    color-mix(in srgb, var(--ui-line-strong) 58%, transparent);
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: var(--ui-muted);
                cursor: pointer;

                font-family: inherit;
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-medium);
                text-align: center;

                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            .add-slot:disabled {
                cursor: default;
            }

            ui-menu {
                display: block;
                inline-size: 100%;
            }

            .glyph {
                color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted));
                font-size: var(--ui-text-lg);
                line-height: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.step = null;
        this.index = 0;
        this.powerExitOffered = false;
        this.disabled = false;
        this.i18n = new I18nController(this);
    }

    /** The three slots, from the ONE table. Recomputed per render; pure. */
    get band() {
        return exitBand(this.step, { powerExitOffered: this.powerExitOffered });
    }

    /**
     * THE C8 SEAM, reachable from the element for convenience — it delegates and
     * owns nothing. The function is the seam; this is a shortcut for a consumer
     * that already has the element in hand.
     */
    serialize() {
        return serializeExitSlots(this.step, { powerExitOffered: this.powerExitOffered });
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: { index: this.index, ...detail },
            bubbles: true,
            composed: true,
        }));
    }

    #onEdit(slot) {
        const serialized = this.serialize().find((record) => record.slot === slot.slot) ?? null;
        this.#emit('exit-edit', { slot: slot.slot, type: slot.type, serialized });
    }

    #onRemove(slot) {
        this.#emit('exit-remove', { slot: slot.slot, type: slot.type });
    }

    #onAdd(slot, type) {
        this.#emit('exit-add', { slot: slot.slot, type });
    }

    render() {
        const band = this.band;
        const occupied = band.filter((slot) => slot.occupied);
        const offered = band.filter(
            (slot) => !slot.occupied && (slot.slot !== 'condition' || slot.choices.length > 0),
        );

        return html`
            <div id="band" class="band">
                ${occupied.map((slot) => this.#renderOccupied(slot))}
                ${offered.map((slot) => this.#renderOffered(slot))}
            </div>
        `;
    }

    #renderOccupied(slot) {
        const t = this.i18n.t;
        const text = formatExitValue(slot.value, slot.step);
        return html`
            <div
                id="row-${slot.slot}"
                class="row ${slot.dead ? 'dead' : ''}"
                data-tone=${slot.type}
            >
                <button
                    id="sentence-${slot.slot}"
                    class="sentence"
                    type="button"
                    ?disabled=${this.disabled}
                    title=${slot.deadReason ? t(slot.deadReason) : nothing}
                    @click=${() => this.#onEdit(slot)}
                ><span class="phrase"
                    ><b class="subject">${t(slot.subject)}</b
                    ><span class="verb">${t(slot.verb)}</span
                ></span><span class="value ui-numeric"
                    ><span class="number">${text}</span
                    ><span class="unit">${slot.unit}</span
                ></span></button>
                <ui-icon-button
                    id="remove-${slot.slot}"
                    class="remove"
                    label=${`${t('Remove')} ${t(slot.subject)}`}
                    focus-ring="inset"
                    ?disabled=${this.disabled}
                    @click=${() => this.#onRemove(slot)}
                ><span class="glyph" aria-hidden="true">&times;</span></ui-icon-button>
            </div>
            ${slot.dead ? html`
                <p id="note-${slot.slot}" class="note ui-caption">
                    ${t(slot.deadReason)}${slot.note ? ` · ${t(slot.note)}` : ''}
                </p>
            ` : nothing}
        `;
    }

    #renderOffered(slot) {
        const t = this.i18n.t;
        if (slot.slot === 'condition') {
            return html`
                <div id="row-${slot.slot}" class="row add">
                    <ui-menu
                        id="menu-${slot.slot}"
                        label=${t('Add exit condition')}
                        .items=${slot.choices.map((type) => ({ id: type, label: t(exitTypeLabel(type)) }))}
                        ?disabled=${this.disabled}
                        @select=${(event) => { event.stopPropagation(); this.#onAdd(slot, event.detail.id); }}
                    >
                        <button
                            id="add-${slot.slot}"
                            class="add-slot"
                            type="button"
                            slot="trigger"
                            ?disabled=${this.disabled}
                        >+ ${t('Condition')}</button>
                    </ui-menu>
                </div>
            `;
        }
        return html`
            <div id="row-${slot.slot}" class="row add">
                <button
                    id="add-${slot.slot}"
                    class="add-slot"
                    type="button"
                    ?disabled=${this.disabled}
                    @click=${() => this.#onAdd(slot, slot.type)}
                >+ ${t(slot.subject)}</button>
            </div>
        `;
    }
}

customElements.define('ui-exit-sentence', UiExitSentence);
