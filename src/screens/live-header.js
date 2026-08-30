/**
 * <live-header>, the Live screen's header band.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveHeader extends UiElement {
    static styles = [css`
        :host {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-4);
            padding-inline: var(--ui-band-inset);

            background-color: var(--ui-bar);
            min-inline-size: 0;
        }

        /* THE THREE CLUSTERS. Each is a flex row of its own so a cluster with two
         * controls in it does not need a wrapper somewhere else to space them. */
        .cluster {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        /* The two end clusters are their own size and never grow: an action cluster
         * that grew would move its buttons around as the middle one changed. */
        .lead,
        .actions {
            flex: 0 0 auto;
        }

        .actions {
            margin-inline-start: auto;
        }

        .favourites {
            margin-inline-end: var(--ui-space-7);
        }

        .favourites {
            flex: 1 1 auto;
            min-inline-size: 0;

            max-inline-size: 59%;
        }

        :host,
        .cluster {
            position: static;
        }
    `];

    render() {
        return html`
            <div class="cluster lead" part="lead"><slot name="lead"></slot></div>
            <div class="cluster favourites" part="favourites"><slot name="favourites"></slot></div>
            <div class="cluster actions" part="actions"><slot name="actions"></slot></div>
        `;
    }
}

customElements.define('live-header', LiveHeader);
