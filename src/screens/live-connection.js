/**
 * <live-connection>, B8's states made distinguishable AND answerable.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { CONNECTION_SURFACE, connectionSurface } from 'src/lib/connection-surface.js';

import 'src/components/ui-alert-banner.js';
import 'src/components/ui-button.js';
import 'src/components/ui-dialog.js';

const WORDS = Object.freeze({
    [CONNECTION_SURFACE.WAITING]: {
        headline: 'Connecting', remedy: 'Opening the connection to the machine.',
    },
    [CONNECTION_SURFACE.UNREADABLE]: {
        headline: 'Connection state unclear',
        remedy: 'The machine sent something this app could not read. Nothing has been disconnected.',
    },
    [CONNECTION_SURFACE.UNAVAILABLE]: {
        headline: 'Not connected',
        remedy: 'The connection to the machine has stopped. Check the machine is powered on.',
    },
    [CONNECTION_SURFACE.STALE]: {
        headline: 'Connection lost',
        remedy: 'This is the last thing the machine said. Trying to reconnect.',
    },
    [CONNECTION_SURFACE.IDLE]: {
        headline: 'No machine', remedy: 'Nothing is connected. Scan to look for a machine.',
    },
    [CONNECTION_SURFACE.SCANNING]: {
        headline: 'Looking for the machine', remedy: 'Scanning.',
    },
    [CONNECTION_SURFACE.CONNECTING_MACHINE]: {
        headline: 'Connecting to the machine', remedy: 'Still trying.',
    },
    [CONNECTION_SURFACE.CONNECTING_SCALE]: {
        headline: 'Connecting to the scale', remedy: 'The machine is connected. Still trying the scale.',
    },
    [CONNECTION_SURFACE.ERROR]: {
        headline: 'Could not connect', remedy: null,
    },
    [CONNECTION_SURFACE.MACHINE_PICKER]: {
        headline: 'More than one machine', remedy: 'Choose which machine to use.',
    },
    [CONNECTION_SURFACE.SCALE_PICKER]: {
        headline: 'More than one scale', remedy: 'Choose which scale to use.',
    },
    [CONNECTION_SURFACE.PHASE_UNKNOWN]: {
        headline: 'Connection state not recognised',
        remedy: 'The machine reported a state this version of the app does not know.',
    },
});

const ASSERTIVE_SURFACES = new Set([
    CONNECTION_SURFACE.UNREADABLE,
    CONNECTION_SURFACE.UNAVAILABLE,
    CONNECTION_SURFACE.STALE,
    CONNECTION_SURFACE.ERROR,
    CONNECTION_SURFACE.PHASE_UNKNOWN,
    CONNECTION_SURFACE.MACHINE_PICKER,
    CONNECTION_SURFACE.SCALE_PICKER,
]);

/** The live-region politeness for one surface. Bound on every render, never guessed. */
export function bannerRoleFor(surfaceId) {
    return ASSERTIVE_SURFACES.has(surfaceId) ? 'alert' : 'status';
}

export class LiveConnection extends UiElement {
    static properties = {
        frame: { attribute: false },
        /** The connection feed's `FEED_STATUS`, which is what separates the three nulls. */
        feedStatus: { type: String, attribute: 'feed-status' },
        /** The derived surface id, REFLECTED. Appendix 15: state is an attribute. */
        surface: { type: String, reflect: true },
        /** Is the picker showing? Reflected so a suite and a screen sheet can read it. */
        picking: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host([surface='ready']) {
            display: none;
        }

        /* The banner and the choice affordance are one row: a remedy line and the button
         * that acts on it belong on the same line the eye lands on. */
        .remedy {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
            flex-wrap: wrap;
        }

        /* The picker's body: one full-width choice per device. A device name is arbitrary
         * length, so the button fills the column rather than sizing to its label. */
        .choices {
            display: grid;
            grid-template-rows: auto;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .choices ui-button {
            display: grid;
        }

        .choice {
            flex: 1 1 auto;
            min-inline-size: 0;
            display: grid;
            justify-items: start;
            gap: var(--ui-space-1);
            text-align: start;
        }

        .choice-id,
        .choice-note {
            color: var(--ui-muted);
            font-size: var(--ui-text-sm);
            overflow-wrap: anywhere;
        }

        .choice-empty {
            color: var(--ui-muted);
            font-size: var(--ui-text-base);
        }
    `];

    #i18n = new I18nController(this);

    /** The surface id the last auto-open decision was made against. */
    #autoOpenedFor = null;

    constructor() {
        super();
        this.frame = null;
        this.feedStatus = null;
        this.surface = CONNECTION_SURFACE.WAITING;
        this.picking = false;
    }

    /** The whole derivation, in one place, read by render and by the auto-open. */
    get state() {
        return connectionSurface(this.frame, { feedStatus: this.feedStatus ?? null });
    }

    willUpdate(changed) {
        if (!changed.has('frame') && !changed.has('feedStatus')) return;
        const next = this.state;
        this.surface = next.id;

        // AUTO-OPEN ON THE TRANSITION, not on the state. A park the user dismissed stays
        // dismissed until the park itself changes; a new park opens the dialog again.
        if (next.actionable) {
            if (this.#autoOpenedFor !== next.id) {
                this.#autoOpenedFor = next.id;
                this.picking = true;
            }
        } else {
            this.#autoOpenedFor = null;
            this.picking = false;
        }
    }

    render() {
        const t = this.#i18n.t;
        const state = this.state;
        if (state.quiet) return nothing;

        const words = WORDS[state.id];
        // The server's own sentence, `ConnectionError`'s `message` and `suggestion` joined,
        // written by the side that knows what failed. Never translated and never rewritten.
        const serverLine = state.error && typeof state.error === 'object'
            ? [state.error.message, state.error.suggestion].filter((s) => typeof s === 'string' && s).join(' ')
            : '';
        const ours = words.remedy ? t(words.remedy) : '';
        const remedy = state.id === CONNECTION_SURFACE.ERROR
            ? (serverLine || ours)
            : [ours, serverLine].filter(Boolean).join(' ');

        return html`
            <ui-alert-banner id="banner" role=${bannerRoleFor(state.id)}
                >${t(words.headline)}<span slot="remedy" class="remedy"
                    >${remedy ? html`<span id="remedy-text">${remedy}</span>` : nothing}${
                    state.actionable
                        ? html`<ui-button id="choose" variant="primary" @click=${this.#openPicker}
                            >${t('Choose')}</ui-button>`
                        : nothing}</span
            ></ui-alert-banner>

            ${state.actionable ? this.#picker(state, t) : nothing}
        `;
    }

    static choiceRows(choices) {
        const labels = choices.map((device) => device.name || device.id);
        const shared = new Set(labels.filter((label, i) => labels.indexOf(label) !== i));
        return choices.map((device, i) => ({
            device,
            label: labels[i],
            /* Never under an id that IS the label: repeating it says nothing. */
            id: shared.has(labels[i]) && labels[i] !== device.id ? device.id : null,
            /* The server's own third state — "known about, not visible right now"
             * (`rea-devices.js:101-103`). Rendered when it is SET, never inferred. */
            unavailable: device.available === false,
        }));
    }

    #picker(state, t) {
        const scales = state.id === CONNECTION_SURFACE.SCALE_PICKER;
        const rows = LiveConnection.choiceRows(state.choices);
        return html`
            <ui-dialog id="picker"
                ?open=${this.picking}
                heading=${scales ? t('Choose a scale') : t('Choose a machine')}
                @close-request=${this.#closePicker}
            >
                <div class="choices" id="choices">
                    ${rows.length === 0
                        ? html`<p class="choice-empty" id="choices-empty"
                            >${t('The machine did not say which devices it found.')}</p>`
                        : rows.map((row) => html`
                            <ui-button
                                data-device-id=${row.device.id}
                                @click=${() => this.#choose(row.device, scales)}
                            ><span class="choice"
                                ><span class="choice-name">${row.label}</span
                                >${row.id
                                    ? html`<span class="choice-id">${row.id}</span>`
                                    : nothing}${row.unavailable
                                    ? html`<span class="choice-note"
                                        >${t('Not visible right now')}</span>`
                                    : nothing}</span
                            ></ui-button>`)}
                </div>
                <ui-button slot="actions" variant="ghost" @click=${this.#closePicker}
                    >${t('Not now')}</ui-button>
            </ui-dialog>
        `;
    }

    #openPicker = () => { this.picking = true; };

    #closePicker = () => { this.picking = false; };

    /**
     * SEND THE ANSWER. The event, not the request: the endpoint stays behind the devices
     * link the shell holds, and this element stays testable without a transport.
     */
    #choose(device, scales) {
        this.picking = false;
        this.dispatchEvent(new CustomEvent('connect-device', {
            detail: { deviceId: device.id, kind: scales ? 'scale' : 'machine', device },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('live-connection', LiveConnection);
