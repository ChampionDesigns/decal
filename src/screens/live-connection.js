/**
 * live-connection.js — `<live-connection>`, B8's states made distinguishable AND answerable.
 *
 * ITEM `live-connection-states`. The derivation is `src/lib/connection-surface.js` and is
 * tested without a browser; this file is what a person sees, and the answer path.
 *
 * ===========================================================================
 * WHAT "DISTINGUISHABLE" IS BUILT AS
 * ===========================================================================
 *
 * Twelve surfaces, and no two of them render the same thing:
 *   * the surface id is a REFLECTED ATTRIBUTE (`surface="machinePicker"`), which is
 *     Appendix 15's rule — state travels as an attribute a selector and a suite can name,
 *     exactly as `.slate-bank` does it with `aria-*`. A screen sheet can lay out
 *     `live-connection[surface=error]` without piercing anything;
 *   * each carries its own headline and its own remedy line, through I18nController (D2),
 *     and the two picker states additionally carry a BUTTON — the affordance is what makes
 *     "two machines, pick one" impossible to mistake for "still trying", and it is the
 *     half SCOPE.md:1858 says rendering alone would not fix;
 *   * `ready` renders NOTHING. The host collapses (`display: none`), so a connected
 *     machine costs this screen no rows at all — which matters on the one screen whose
 *     decided layout answer is about 120 missing rows (C1). `ready` is therefore the one
 *     surface a WRONG answer hides completely, which is why `feed-status` is an input to
 *     the derivation and not decoration: a dead socket still holding a ready frame must
 *     reach `stale` or `unavailable` here, never the surface that draws nothing.
 *
 * AND SINCE 28 AUGUST 2026 A PUBLISHED ERROR DOES NOT AUTOMATICALLY MAKE THIS `error`.
 * `connection-surface.js` demotes one that is about the scan transport, one upstream marks
 * `warning`, and one contradicted by a machine the same frame reports as connected — Ben's
 * stuck "could not connect" banner over a machine on USB with Bluetooth off. The whole
 * argument is in that file's header; what lands HERE is two things. `ready` stays silent,
 * so a demoted error at a connected machine costs this screen nothing, which is the point.
 * And on every other surface the error prints as a NOTE UNDER THE STATE rather than as the
 * state — see the remedy composition in `render`, which used to let the server's sentence
 * silently replace the skin's own.
 *
 * THE SURFACE IS #49, NOT A NEW BOX. `<ui-alert-banner>` "takes a message, it does not
 * know the message" (SCOPE.md:1530) and already owns the measured Live strip look. A
 * hand-built strip here would be the L8 defect class one component along, so there is not
 * one paint declaration for the banner in this file.
 *
 * THE PICKER IS #18, NOT A NEW DIALOG. SCOPE.md:1708-1711: "Device picker — the B8 'two
 * machines, pick one' answer surface → an #18/#19 dialog instance over
 * `connectionStatus.foundMachines`/`foundScales`, answered with the `connect` command
 * (Part 3 §2's devices row names the route). Not a new inventory item." One `<ui-dialog>`
 * with a body of `<ui-button>`s, one per found device.
 *
 * ===========================================================================
 * THE ANSWER PATH — THE HALF THAT IS NOT FREE
 * ===========================================================================
 *
 * "While `pendingAmbiguity` is set, ReaPrime parks in a selection session and actively
 * suppresses recovery until the choice arrives" (SCOPE.md:1084). So the choice is SENT.
 * This element does not send it: it dispatches `connect-device` with `{deviceId, kind}`
 * and the screen hands that to `live.devices.connect(deviceId)` — `PUT
 * /api/v1/devices/connect`, whose row this cluster contract-checked. The element stays
 * layout-and-composition, and the endpoint stays behind the link the shell holds.
 *
 * THE DIALOG OPENS ITSELF, ONCE PER PARK. A server holding a question open behind a
 * banner the user has to notice is the old failure with better wording. It is dismissable
 * — and the banner's button re-opens it — because the modal must not trap a user who
 * wants to look at the machine state behind it. Re-opening on every render would fight
 * that dismissal, so the auto-open is keyed on the TRANSITION into a park.
 *
 * A CHOICE A PERSON CAN ACTUALLY MAKE. The park's whole point is picking between two
 * machines, so two rows that read the same are the item half-done in a second way — and
 * the recorded device list has exactly that shape: `tools/rea-fixtures/api__v1__devices.json`
 * holds two machines BOTH called "Bengle", one on BLE (`DA:BA:AF:20:7A:03`) and one on USB
 * (`usb-2e8a-a-8549628789ABCDEF`). Measured through the mock's own socket at both Gate A
 * geometries: two choices, ONE distinct label. So a row whose name does not distinguish it
 * carries the device's ID underneath — the id being what the `connect` command sends, and
 * the only field on a `foundMachines` entry that is guaranteed to differ.
 *
 * WHAT THE ROW DOES NOT SAY: "Bluetooth" or "USB". Reading a transport out of the SHAPE of
 * an id is a name-sniff, and this screen may not invent a server answer (Part 10 §12) — the
 * field does not exist on `DeviceListEntry`. `available: false` IS a real field and is
 * rendered when the server sets it, which on the socket's hand-built `foundMachines`
 * entries it does not (`ws_frames.py:567`, four keys, no `available`) and on the device
 * list route it does. Nothing here fills the gap in.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { CONNECTION_SURFACE, connectionSurface } from 'src/lib/connection-surface.js';

import 'src/components/ui-alert-banner.js';
import 'src/components/ui-button.js';
import 'src/components/ui-dialog.js';

/**
 * The words, one row per surface. `headline` is the state; `remedy` is what the person can
 * do about it, or what is happening — never both, and never a colour as the only signal.
 *
 * NO ORACLE ANSWER: Slate renders one string, "Disconnected / Check the machine is
 * powered" (`prov_query.py find --cls slate-live-alert`), for the whole payload. That is
 * the collapse B8 retires, so these ten are written here and are the item's own work.
 */
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
    /* The source went while we were holding a frame. Says the two things the held frame
     * cannot say for itself: what is on screen is old, and the app is still trying. */
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

/**
 * WHICH SURFACES ARE ALLOWED TO INTERRUPT — Appendix 15's aria contract, decided here
 * because the call site is the only place that knows.
 *
 * `<ui-alert-banner>` sets `role="alert"` on itself unless the author chose a role
 * (`ui-alert-banner.js:366-372`), and role="alert" is an ASSERTIVE live region: a screen
 * reader stops what it is saying and reads the strip. That is right for the component's
 * default and wrong for most of this element's twelve surfaces, because an ordinary boot
 * walks `waiting → scanning → connectingMachine → connectingScale → ready` and every one
 * of those transitions re-renders the banner. Announcing four progress notices over the
 * top of whatever the person was reading is the same defect the chart summary already
 * refuses one component along — "a chart summary that interrupts is worse than none,
 * polite is the only kind a 15 Hz surface may have" (`live-screen.js`'s role=status).
 *
 * So the rule is what the STATE IS, not what the component is:
 *   assertive (role="alert") — something is wrong, or ReaPrime is parked waiting for an
 *       answer this person has to give. Interrupting is the point.
 *   polite (role="status")   — progress, and the resting state. It arrives when the
 *       reader next draws breath, and the banner is on screen the whole time either way.
 *
 * `<live-refusal>` keeps the component's `alert`: a refused profile is a machine that did
 * NOT do what it was told, and there is exactly one of them. REVERSAL, one line: drop the
 * `role=` binding in `render` and every surface goes back to the component's default.
 */
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
        /**
         * The parsed devices frame — `readDevicesFrame(...)`, i.e. the connection feed's
         * `value`. `null` is a real input and is three different pictures; see
         * `connection-surface.js`. Not an attribute: it is an object.
         */
        frame: { attribute: false },
        /** The connection feed's `FEED_STATUS`, which is what separates the three nulls. */
        feedStatus: { type: String, attribute: 'feed-status' },
        /** The derived surface id, REFLECTED. Appendix 15: state is an attribute. */
        surface: { type: String, reflect: true },
        /** Is the picker showing? Reflected so a suite and a screen sheet can read it. */
        picking: { type: Boolean, reflect: true },
    };

    static styles = [css`
        /* THE HOST IS A BLOCK THAT DISAPPEARS WHEN THERE IS NOTHING TO SAY.
         * \`ready\` is the only quiet surface. display: none rather than an empty box,
         * because an empty box in a grid row still spends a gap — the same reasoning
         * <live-main> uses for the GHC strip's implicit row. */
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

        /* GRID, NOT BLOCK, AND THE DIFFERENCE IS THE WHOLE AFFORDANCE. ui-button.js:164-166
         * documents "ui-button { display: block }" as the full-width override, and measured
         * it only stretches the HOST: the pressable control inside is a shrink-to-fit box in
         * Blink whatever its display is, so a row 772 wide held a control 105.89 wide at
         * BOTH Gate A geometries — a small box at the left of a wide row, and comfortably
         * over the hit floor, so L22 stayed green and no suite saw it (wave 5.1, cross-4).
         * A grid host makes that control a grid ITEM, and a grid item stretches; nothing
         * here reaches into the shadow root, and the override is still one declaration from
         * outside. */
        .choices ui-button {
            display: grid;
        }

        /* The label, which is one line when a name is enough and two when it is not. It is
         * a flex item of the button's own row, so it takes the width and starts its text
         * at the leading edge — a list of choices is read down the left, not from the
         * middle of each row. */
        .choice {
            flex: 1 1 auto;
            min-inline-size: 0;
            display: grid;
            justify-items: start;
            gap: var(--ui-space-1);
            text-align: start;
        }

        /* The disambiguator. Smaller and quieter than the name, because it is the thing
         * you read only when the names have failed you. An id is a MAC or a USB path, so
         * it wraps rather than widening the dialog. */
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
        /*
         * THE HEADLINE'S OWNER DECIDES WHICH LINE IS THE ANSWER AND WHICH IS THE NOTE.
         *
         * On `error` the headline is ours and deliberately says nothing more than "Could
         * not connect" (`remedy: null`), so the server's sentence IS the answer and stands
         * alone. That is unchanged, and it is the whole reason the error surface has no
         * remedy of its own.
         *
         * EVERYWHERE ELSE THE ERROR IS A NOTE UNDER A STATE, and until 28 August 2026 the
         * note SILENTLY REPLACED the state. `serverLine ||` meant a machine that was up
         * and a scale still being tried printed "Bluetooth is turned off." where it had
         * said "The machine is connected. Still trying the scale." — dropping exactly the
         * reassurance Ben's bug is about, in the one place it was already worded right.
         * The park had the same defect: a picker's "Choose which machine to use." was
         * replaced by the failed attempt that caused the park, so the instruction on a
         * surface whose entire job is to be answerable went missing.
         *
         * So both are printed, state first, reason second: "Nothing is connected. Scan to
         * look for a machine. Bluetooth is turned off. Turn Bluetooth on to scan for
         * Bluetooth devices." Neither sentence is invented and neither is thrown away.
         */
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

    /**
     * The rows, with whatever it takes to tell them apart.
     *
     * A name is the label when it is the person's own word for the machine. It stops being
     * enough the moment two rows carry the same one — the recorded list's two "Bengle"s —
     * so the ID goes underneath EVERY row that shares a name, not just the second of them:
     * a disambiguator that appears on one row of a pair reads as a difference between the
     * rows rather than as the same fact about both.
     */
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
