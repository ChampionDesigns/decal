/**
 * <live-refusal>, B9's surface.
 */

import { css, html, nothing, svg } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

import 'src/components/ui-alert-banner.js';
import 'src/components/ui-icon-button.js';

/** The dismiss glyph. `currentColor` so it follows the button's ink through both themes;
 *  no colour is written here, and the accessible name is the button's `label` (D2). */
const DISMISS_GLYPH = svg`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    ><path d="M6 6l12 12M18 6L6 18"/></svg>`;

export class LiveRefusal extends UiElement {
    static properties = {
        /**
         * `{kind: 'unsupported'|'invalid', error: string, message: string}` or null.
         * Straight from `profileRefusal()`; nothing here reshapes it.
         */
        refusal: { attribute: false },
        /** `refusal.kind`, reflected. State travels as an attribute (Appendix 15). */
        kind: { type: String, reflect: true },
    };

    static styles = [css`
        /* Nothing refused, nothing shown, and no row spent on it. */
        :host(:not([kind])) {
            display: none;
        }

        .remedy {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.refusal = null;
        this.kind = null;
    }

    willUpdate(changed) {
        if (!changed.has('refusal')) return;
        const refusal = this.refusal;
        this.kind = refusal && typeof refusal === 'object' && typeof refusal.kind === 'string'
            ? refusal.kind
            : null;
    }

    render() {
        const refusal = this.refusal;
        if (!refusal || typeof refusal !== 'object') return nothing;
        const t = this.#i18n.t;

        // THE SERVER'S OWN WORDS, both halves, in the order it wrote them: `error` is the
        // typed headline ("Unsupported profile"), `message` is the detail. Neither is
        // translated — translating a server's diagnostic would make the one sentence that
        // says what went wrong un-searchable, and D2's mechanism is for OUR strings.
        const headline = typeof refusal.error === 'string' && refusal.error
            ? refusal.error
            : t('The machine refused the profile');
        const message = typeof refusal.message === 'string' ? refusal.message : '';

        return html`
            <ui-alert-banner id="banner"
                >${headline}<span slot="remedy" class="remedy"
                    >${message ? html`<span id="message">${message}</span>` : nothing
                    }<ui-icon-button id="dismiss"
                        label=${t('Dismiss')}
                        @click=${this.#dismiss}
                    >${DISMISS_GLYPH}</ui-icon-button></span
            ></ui-alert-banner>
        `;
    }

    #dismiss = () => {
        this.dispatchEvent(new CustomEvent('refusal-dismiss', { bubbles: true, composed: true }));
    };
}

customElements.define('live-refusal', LiveRefusal);
