/**
 * The guard that says the steam wand is still running after a session.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import 'src/components/ui-stop-button.js';

/** The three visible strings, as i18n KEYS (keys are English text - src/lib/i18n.js). */
export const STEAM_GUARD_HEADLINE_KEY = 'Steam is still on';

export const STEAM_GUARD_REASON_KEY = 'The wand puffs quietly, so it is easy to miss.';

export const STEAM_GUARD_REMEDY_KEY = 'Press stop to purge and clean it.';

export class UiSteamGuard extends UiElement {
    static properties = {
        /** Is the guard on screen? It exists only while this is true. */
        open: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            display: none;
        }

        /* THE SAME OVERLAY SHAPE THE EXPANDED CHART USES. The host of the screen has
         * layout containment, so it is the containing block for this box. */
        :host([open]) {
            display: grid;
            position: absolute;
            inset: 0;
            z-index: var(--ui-z-overlay);
            place-items: center;
        }

        .scrim {
            position: absolute;
            inset: 0;
            background-color: var(--ui-scrim);
            backdrop-filter: blur(var(--ui-scrim-blur));
        }

        /* A QUARTER TO A THIRD OF THE AREA, on both screen sizes the skin is built for.
         * The width cap is what keeps a wide screen from stretching the panel out. */
        .panel {
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-4);
            inline-size: min(58%, 40rem);
            min-block-size: 50%;
            padding: var(--ui-space-6);
            border-block-start: var(--ui-space-1) solid var(--ui-status-danger);
            border-radius: var(--ui-radius-xl);
            background-color: var(--ui-surface);
            box-shadow: var(--ui-elev-3);
            text-align: center;
        }

        p {
            margin: 0;
        }

        .headline {
            color: var(--ui-status-danger);
            font-size: var(--ui-display-lg);
            font-weight: var(--ui-weight-medium);
            line-height: 1.1;
        }

        .reason {
            color: var(--ui-text-2);
            font-size: var(--ui-text-lg);
        }

        .remedy {
            color: var(--ui-text);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-medium);
        }

        /* THE GUARD CARRIES ITS OWN WAY OUT, so the user never reaches for the rail.
         * The cross axis of a column flex is the horizontal one, so align-self centres it:
         * the press sizes to its own words and sits under the middle of the panel. */
        .stop {
            align-self: center;
            min-inline-size: 12rem;
            margin-block-start: var(--ui-space-2);
        }
    `];

    constructor() {
        super();
        this.open = false;
        this.i18n = new I18nController(this);
    }

    render() {
        if (!this.open) return nothing;
        const t = this.i18n.t;
        return html`
            <div class="scrim" part="scrim"></div>
            <div class="panel" part="panel"
                role="alertdialog"
                aria-labelledby="headline"
                aria-describedby="reason remedy"
            >
                <p id="headline" class="headline">${t(STEAM_GUARD_HEADLINE_KEY)}</p>
                <p id="reason" class="reason">${t(STEAM_GUARD_REASON_KEY)}</p>
                <p id="remedy" class="remedy">${t(STEAM_GUARD_REMEDY_KEY)}</p>
                <ui-stop-button id="stop" class="stop" running></ui-stop-button>
            </div>
        `;
    }
}

customElements.define('ui-steam-guard', UiSteamGuard);
