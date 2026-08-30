/**
 * The "nothing here" block.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** An assigned node that is actually content - elements, or text that is not just
 *  the whitespace between tags. Without the trim, every
 *  `<ui-empty-state>\n</ui-empty-state>` in real markup reports a body. */
const isContent = (node) => node.nodeType === 1 || (node.textContent ?? '').trim() !== '';

export class UiEmptyState extends UiElement {
    static properties = {
        /** The one line that says what is missing. Rendered as a <p>; see the header. */
        heading: { type: String },
        body: { type: String },
        boxed: { type: Boolean, reflect: true },

        _hasIcon: { state: true },
        _hasBody: { state: true },
        _hasActions: { state: true },
    };

    static styles = [css`
        :host {
            --_ui-empty-pad: var(--ui-space-6);
        }

        :host([boxed]) {
            --_ui-empty-pad: var(--ui-space-7);
        }

        .empty {
            display: grid;

            justify-self: stretch;
            align-self: stretch;

            inline-size: 100%;

            justify-items: center;
            align-content: center;
            gap: var(--ui-space-4);
            padding: var(--_ui-empty-pad);
            min-block-size: 100%;
            text-align: center;
        }

        :host([boxed]) .empty {
            border: var(--ui-border-w-strong) dashed var(--ui-line);
            border-radius: var(--ui-radius-lg);
            background-color: var(--ui-key);
        }

        .icon {
            display: grid;
            place-items: center;
            inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            border-radius: var(--ui-radius-pill);
            background-color: var(--ui-key-on);
            color: var(--ui-muted);
        }

        slot[name="icon"]::slotted(*) {
            inline-size: var(--ui-icon-lg);
            block-size: var(--ui-icon-lg);
        }

        .text {
            display: grid;
            gap: var(--ui-space-2);
            justify-items: center;
            max-inline-size: var(--ui-measure);
        }

        .heading {
            margin: 0;
            color: var(--ui-text);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
        }

        .body {
            color: var(--ui-muted);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);
            line-height: 1.5;
        }

        .prose {
            margin: 0;
        }

        slot:not([name])::slotted(*) {
            margin-block: 0;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--ui-space-3);
        }

        /* An absent part is not rendered at all - it does not contribute a gap row,
         * and the disc cannot become P21's grey block pretending to be art. */
        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.body = '';
        this.boxed = false;
        this._hasIcon = false;
        this._hasBody = false;
        this._hasActions = false;
    }

    /** One handler for three slots; the slot's own name picks the flag. */
    #onSlotChange(event) {
        const slot = event.target;
        const filled = slot.assignedNodes({ flatten: true }).some(isContent);
        if (slot.name === 'icon') this._hasIcon = filled;
        else if (slot.name === 'actions') this._hasActions = filled;
        else this._hasBody = filled;
    }

    render() {
        // An empty part is dropped rather than hidden-but-present, because a
        // zero-height grid item still contributes its share of the gap: an absent
        // text pair would put 36px between the disc and the actions instead of 18.
        const hasProse = Boolean(this.body) || this._hasBody;
        const hasText = Boolean(this.heading) || hasProse;
        return html`<div id="empty" class="empty">
            <div
                id="icon"
                class="icon ${this._hasIcon ? '' : 'is-empty'}"
                aria-hidden="true"
            ><slot name="icon" @slotchange=${this.#onSlotChange}></slot></div>

            <div id="text" class="text ${hasText ? '' : 'is-empty'}">
                ${this.heading
                    ? html`<p id="heading" class="heading">${this.heading}</p>`
                    : nothing}
                <div
                    id="body"
                    class="body ${hasProse ? '' : 'is-empty'}"
                >${this.body
                    ? html`<p id="prose" class="prose">${this.body}</p>`
                    : nothing}<slot @slotchange=${this.#onSlotChange}></slot></div>
            </div>

            <div
                id="actions"
                class="actions ${this._hasActions ? '' : 'is-empty'}"
            ><slot name="actions" @slotchange=${this.#onSlotChange}></slot></div>
        </div>`;
    }
}

customElements.define('ui-empty-state', UiEmptyState);
