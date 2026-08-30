/**
 * live-refusal.js — `<live-refusal>`, B9's surface. It shows what the server said.
 *
 * ITEM `live-refusal-surface`. SCOPE.md:1861-1868: "v1 builds the refusal surface and
 * wires it to every refusal ReaPrime can already report — the arm-time 400 (`Unsupported
 * profile`) exists today and needs zero upstream work; the alert banner (#49) takes a
 * message, it does not know the message. When R7 lands, the same surface carries the
 * machine-side refusal."
 *
 * ===========================================================================
 * THE WHOLE POINT: THIS ELEMENT KNOWS NOTHING ABOUT PROFILES
 * ===========================================================================
 *
 * It takes `{kind, error, message}` — `profileRefusal()`'s output, verbatim from
 * `src/data/rea-profile.js`, which reads it out of the 400 body and words nothing. It has
 * no capability check, no profile model, no list of refusable step types, and no sentence
 * of its own describing WHY something was refused. That is what lets R7's machine-side
 * refusal ride this same element later with no change here at all: a refusal is a
 * `{kind, error, message}`, whoever produced it.
 *
 * There are exactly two strings in this file and neither describes a refusal: a label for
 * the dismiss control, and a fallback headline for a refusal that arrived with no `error`
 * string — which the address layer cannot produce (`profileRefusal` returns null on an
 * empty `error`) but a future producer might.
 *
 * WHAT IT DOES ADD, and why it is not "just render the message": `kind` distinguishes the
 * two 400s the route can answer, and they mean different things to a person —
 * "'unsupported' says 'this machine cannot run this profile', 'invalid' says 'this profile
 * is malformed'" (`rea-profile.js`). The kind is a REFLECTED ATTRIBUTE (Appendix 15) so
 * the two are distinguishable to a suite, to a screen sheet, and to anyone reading the
 * DOM — without this file writing a sentence about either.
 *
 * UNCONDITIONAL IS ENFORCED UPSTREAM, in `src/stores/profile-arm-store.js`: always send,
 * always read the answer, never pre-filter on `capabilities.profileModes()`. This element
 * renders whatever it is given, so a capability check here would be the same defect in a
 * different file — and there is none.
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

    /**
     * The user acknowledged it. An EVENT, not a local clear: the arm store owns the state
     * (`clear()`), and an element that hid the banner locally would leave the store saying
     * `refused` with nothing on screen — two owners of one visual state, which is L11's
     * shape in another region.
     */
    #dismiss = () => {
        this.dispatchEvent(new CustomEvent('refusal-dismiss', { bubbles: true, composed: true }));
    };
}

customElements.define('live-refusal', LiveRefusal);
