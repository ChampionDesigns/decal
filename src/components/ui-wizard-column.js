/**
 * The column of steps down the side of a wizard, showing where you are in it.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

const CHECK = '✓';

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
        steps: { type: Array },

        current: { type: Number, reflect: true },

        /** Accessible name for the step LIST, e.g. "Load cell calibration steps". */
        label: { type: String },

        caption: { type: String },
    };

    static styles = [
        visuallyHidden,
        css`
            .column {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                row-gap: var(--ui-space-6);
            }

            .progress {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                row-gap: var(--ui-space-4);
                justify-items: start;
            }

            .steps {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
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

            .chip {
                flex: 0 0 auto;
                display: inline-grid;
                place-items: center;

                inline-size: var(--ui-control-sm);
                block-size: var(--ui-control-sm);

                border: var(--ui-border-w) solid transparent;
                border-radius: var(--ui-radius);

                background-color: transparent;
                color: var(--ui-muted);
                /* MEASURED 18px / 500 — the authored text-[22px] and font-bold both
                 * lose to an !important shell rule and never render. */
                font-size: var(--ui-text-md);
                font-weight: var(--ui-weight-medium);
                /* Four numerals that must not jitter as the walk advances. */
                font-variant-numeric: tabular-nums;

            }

            /* AHEAD — measured: transparent face, one --ui-line hairline, --ui-muted ink
             * (the face and the ink are already the resting values above). */
            .ahead {
                border-color: var(--ui-line);
            }

            .done {
                background-color: var(--ui-key-on);
                color: var(--ui-text);
            }

            .rule {
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

            ::slotted(*) {
                min-inline-size: 0;
            }

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
        this.i18n = new I18nController(this);
    }

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

    get #current() {
        const total = this.#steps.length;
        if (!total) return 0;
        const n = Number.isFinite(this.current) ? Math.round(this.current) : 1;
        return Math.min(Math.max(n, 1), total);
    }

    /** "Step 2 of 4" + " · " + the step's name, or whatever `caption` overrides it with. */
    #caption(steps, current) {
        if (this.caption) return this.caption;
        if (!steps.length) return '';
        const count = this.i18n.t('Step {n} of {total}', { n: current, total: steps.length });
        const name = steps[current - 1]?.label;
        if (!name) return count;
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
        const isDone = !isCurrent && (step.done || n < current);
        const isAhead = !isCurrent && !isDone;

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
