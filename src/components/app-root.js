/**
 * The application shell: the router, the theme, and the one mount point every screen renders into.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { bootFromWindow, BOOT_PHASE } from 'src/lib/app-boot.js';
import { reconnectingSocketFactory } from 'src/data/rea-sockets.js';
import { createThemeController, LIGHT_QUERY } from 'src/lib/theme.js';
import { applyDensity, normaliseDensity, DENSITY_KEY } from 'src/lib/density.js';
import { createStorageRouter } from 'src/lib/storage-router.js';
import { createWebStorageBackend, createMemoryBackend } from 'src/lib/storage-backends.js';
import { LAYERS } from 'src/lib/storage-routes.js';
import {
    routeIdFromHash, hashFor, DEFAULT_ROUTE_ID,
    createLeaveContract, LEAVE_KIND, LEAVE_ACTION,
} from 'src/lib/app-routes.js';
import { installFit } from 'src/lib/app-fit.js';
import { startupFailureDetails, canOpenDashboard, openDashboard } from 'src/lib/startup-recovery.js';
import { intentFor, INTENT_EVENTS } from 'src/lib/app-intents.js';
import { logger as appLogger } from 'src/lib/logger.js';

import 'src/components/ui-empty-state.js';
import 'src/components/ui-alert-banner.js';
import 'src/components/ui-screensaver.js';
import { attachScreensaver } from 'src/components/ui-screensaver.js';
import { FEED } from 'src/stores/live-stores.js';
import { MACHINE_STATE } from 'src/data/machine-state.js';
import { REQUEST_STATUS } from 'src/stores/machine-state-store.js';
import { valueOf } from 'src/stores/feed-store.js';
import { deriveSleepButtonAction } from 'src/lib/screensaver-policy.js';

function realStorage(win, logger) {
    let local;
    try {
        local = createWebStorageBackend({ storage: win.localStorage, logger, label: 'localStorage' });
    } catch {
        local = createMemoryBackend();
    }
    return createStorageRouter({
        backends: { [LAYERS.local]: local, [LAYERS.session]: createMemoryBackend() },
        logger,
    });
}

export class AppRoot extends UiElement {
    static properties = {
        boot: { attribute: false },

        phase: { type: String, reflect: true },

        /** The mounted route's id, reflected for the same reason. */
        route: { type: String, reflect: true },

        /** Internal: the boot state, so `render()` reads one object. */
        _boot: { state: true },

        _recoveryCopy: { state: true },
        _recoveryFailure: { state: true },
    };

    static styles = [css`
        .app {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
        }

        .booting {
            display: grid;
            align-items: center;
            justify-items: stretch;
            text-align: center;
            padding: var(--ui-space-6);
            min-block-size: 0;
        }

        .recovery {
            inline-size: min(100%, var(--ui-measure-wide));
            box-sizing: border-box;
            justify-self: center;
            padding: var(--ui-space-7);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius-xl);
            background: var(--ui-surface);
            text-align: start;
            font-size: var(--ui-text-lg);
        }

        .recovery h1 { font-size: var(--ui-display-md); margin: 0 0 var(--ui-space-5); }
        .recovery p { margin: 0 0 var(--ui-space-5); }
        .recovery-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-4); margin-block: var(--ui-space-6); }

        .recovery button {
            box-sizing: border-box;
            min-block-size: var(--ui-control-h);
            padding: var(--ui-space-3) var(--ui-space-5);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background: var(--ui-surface);
            color: var(--ui-text);
            font: inherit;
            cursor: pointer;
        }

        .recovery .reload { background: var(--ui-steel); color: var(--ui-on-primary); border-color: var(--ui-steel); }

        .recovery button:focus-visible, .recovery summary:focus-visible {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: var(--ui-space-1);
        }

        .recovery details { border-block-start: var(--ui-border-w) solid var(--ui-line); padding-block-start: var(--ui-space-5); }
        .recovery summary { cursor: pointer; min-block-size: var(--ui-control-sm); }
        .recovery pre { white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; max-block-size: calc(var(--ui-control-h) * 3); font: inherit; }
        .recovery .recovery-status { margin-block-start: var(--ui-space-4); }

        /* The error case is a strip, not a card: ui-alert-banner carries its own
         * measured treatment (component #49) and this only decides how wide it may be. */
        .booting ui-alert-banner {
            inline-size: min(100%, 860px);
            justify-self: center;
        }
    `];

    #i18n = new I18nController(this);

    #screen = null;

    /** Unsubscribe from the boot store. Held so `disconnectedCallback` can undo it. */
    #unwatchBoot = null;

    /** The hash listener, held for the same reason (bug S10: a duplicated listener). */
    #onHashChange = null;

    /** The route-leave guards. One registration, forwarding to whatever screen is mounted. */
    #leave = createLeaveContract({ logger: appLogger });

    #unguardScreen = null;

    #onBeforeUnload = null;

    /** The theme controller, if this element built one. */
    #theme = null;

    /** `attachScreensaver`'s teardown while a boot is attached, else null. */
    #unwatchSaver = null;

    /** WHICH element that teardown belongs to. See `#attachSaver` for why identity, and
     *  not a boolean, is what this has to remember. */
    #attachedSaver = null;

    #stopFit = null;

    #onIntent = null;

    /** True when this element built its own boot object and therefore owns its teardown. */
    #ownsBoot = false;

    #returnFocus = null;

    constructor() {
        super();
        this.phase = BOOT_PHASE.IDLE;
        this.route = null;
        this._boot = null;
        this._recoveryCopy = null;
        this._recoveryFailure = null;
    }

    connectedCallback() {
        super.connectedCallback();

        this.#stopFit = installFit(globalThis);

        if (!this.boot) {
            this.boot = bootFromWindow({
                window: globalThis,
                createSocket: reconnectingSocketFactory(),
                logger: appLogger,
                route: this.#routeFromLocation(),
            });
            this.#ownsBoot = true;
            this.#startTheme();
        }

        void this.#hydrateDensity();

        this.#unwatchBoot = this.boot.subscribe((state) => this.#onBootState(state));

        this.#unguardScreen = this.#leave.guard(
            (details) => this.#screen?.canLeaveRoute?.(details) ?? true,
        );

        this.#onBeforeUnload = (event) => {
            const answer = this.#leave.request({ from: this.route, to: null, kind: LEAVE_KIND.UNLOAD });
            if (answer.action === LEAVE_ACTION.LEAVE) return;
            event.preventDefault();
            event.returnValue = '';
        };
        globalThis.addEventListener?.('beforeunload', this.#onBeforeUnload);

        this.#onHashChange = () => {
            const id = this.#routeFromLocation();
            const from = this._boot?.route?.id ?? null;
            if (from === id) return;
            const answer = this.#leave.request({ from, to: id, kind: LEAVE_KIND.HISTORY });
            /* The address has already moved, so a refusal owes a correction. replaceState,
             * or the correction becomes a history entry of its own and Back stops working. */
            if (answer.action === LEAVE_ACTION.RESTORE) {
                globalThis.history?.replaceState?.(null, '', hashFor(answer.restoreTo));
                this.#leave.request({ from: answer.restoreTo, to: answer.restoreTo, kind: LEAVE_KIND.HISTORY });
                return;
            }
            if (answer.action !== LEAVE_ACTION.LEAVE) return;
            this.boot.goto(id);
        };
        globalThis.addEventListener?.('hashchange', this.#onHashChange);

        this.#onIntent = (event) => this.#applyIntent(event);
        for (const type of INTENT_EVENTS) this.addEventListener(type, this.#onIntent);

        this.boot.start({ route: this.#routeFromLocation() });
    }

    disconnectedCallback() {
        if (this.#onIntent) {
            for (const type of INTENT_EVENTS) this.removeEventListener(type, this.#onIntent);
        }
        this.#onIntent = null;
        this.#stopFit?.();
        this.#stopFit = null;
        if (this.#onHashChange) globalThis.removeEventListener?.('hashchange', this.#onHashChange);
        this.#onHashChange = null;
        if (this.#onBeforeUnload) globalThis.removeEventListener?.('beforeunload', this.#onBeforeUnload);
        this.#onBeforeUnload = null;
        this.#unguardScreen?.();
        this.#unguardScreen = null;
        this.#unwatchBoot?.();
        this.#unwatchBoot = null;
        this.#unwatchSaver?.();
        this.#unwatchSaver = null;
        this.#attachedSaver = null;
        this.#screen?.remove();
        this.#screen = null;
        if (this.#ownsBoot) {
            this.boot?.destroy();
            this.#theme?.destroy();
            this.#theme = null;
            this.boot = null;
            this.#ownsBoot = false;
        }
        super.disconnectedCallback();
    }

    #startTheme() {
        const doc = globalThis.document;
        if (!doc || !doc.documentElement) return;
        this.#theme = createThemeController({
            root: doc.documentElement,
            storage: realStorage(globalThis, appLogger),
            media: globalThis.matchMedia ? globalThis.matchMedia(LIGHT_QUERY) : null,
            logger: appLogger,
        });
        this.#theme.followSystem();
        this.#theme.hydrate();
    }

    async #hydrateDensity() {
        const doc = globalThis.document;
        const settings = this.boot?.settings ?? null;
        if (!doc?.documentElement || !settings) return;
        try {
            await settings.load(DENSITY_KEY);
            const stored = normaliseDensity(settings.value(DENSITY_KEY));
            if (stored) applyDensity(doc.documentElement, stored);
        } catch (error) {
            appLogger?.warn?.('the display size could not be read at boot', error);
        }
    }

    /** The route id in the address, or the default. Pure string work lives in app-routes. */
    #routeFromLocation() {
        return routeIdFromHash(globalThis.location?.hash) ?? DEFAULT_ROUTE_ID;
    }

    #onWake = async () => {
        const store = this.boot?.machineState;
        if (!store) return;
        const state = await store.request(MACHINE_STATE.IDLE);
        const saver = this.renderRoot?.querySelector?.('#screensaver');
        if (!saver) return;
        const failed = state?.status === REQUEST_STATUS.FAILED
            || state?.status === REQUEST_STATUS.REFUSED;
        saver.wakeError = failed ? this.#i18n.t('The machine did not wake. Press again.') : '';
    };

    #onSaverDim = (event) => {
        const brightness = event?.detail?.brightness;
        this.boot?.live?.setBrightness?.(brightness);
    };

    #attachSaver() {
        if (!this.boot || !this.boot.live) return;
        const saver = this.renderRoot?.querySelector?.('#screensaver');
        if (!saver) return;
        if (saver === this.#attachedSaver) return;
        this.#unwatchSaver?.();
        this.#attachedSaver = saver;
        this.#unwatchSaver = attachScreensaver(saver, {
            machine: this.boot.live.feed(FEED.MACHINE),
            display: this.boot.live.feed(FEED.DISPLAY),
            settings: this.boot.settings ?? null,
        });
    }

    #onBootState(state) {
        if (this._boot?.error !== state.error) { this._recoveryCopy = null; this._recoveryFailure = null; }
        this._boot = state;
        this.phase = state.phase;
        this.route = state.route ? state.route.id : null;

        const tag = state.route ? state.route.tag : null;
        const current = this.#screen ? this.#screen.tagName.toLowerCase() : null;
        if (tag === current) return;

        this.#screen?.remove();
        this.#screen = tag && globalThis.document ? globalThis.document.createElement(tag) : null;
        if (this.#screen) this.#screen.boot = this.boot;

        if (this.#screen) this.#screen.theme = this.#theme;

        if (this.#returnFocus && this.#screen && this.#returnFocus.route === this.route) {
            this.#screen.restoreFocusTo = this.#returnFocus.invoker;
            this.#returnFocus = null;
        }

        this.requestUpdate();
    }

    #applyIntent(event) {
        const intent = intentFor(event.type, event.detail ?? null);
        if (!intent) return;

        if (intent.kind === 'route') {
            this.goto(intent.route, { invoker: intent.invoker ?? null });
            return;
        }

        if (intent.kind === 'machine' && intent.command === 'sleep') {
            const feed = this.boot?.live?.feed?.(FEED.MACHINE);
            const state = typeof feed?.get === 'function' ? feed.get() : null;
            const decision = deriveSleepButtonAction({
                machineState: valueOf(state)?.state ?? null,
            });
            this.boot?.machineState?.request(decision.command);
            return;
        }

        if (intent.kind === 'edit') {
            const library = this.boot?.library;
            const editor = this.boot?.profileEditor;
            const state = typeof library?.get === 'function' ? library.get() : null;
            const namedId = intent.profileId ?? null;
            const loadedId = namedId ?? state?.loaded?.id ?? null;
            const record = (loadedId && typeof library?.recordFor === 'function'
                ? library.recordFor(loadedId)
                : null)
                ?? (namedId ? null
                    : (typeof library?.activeDraft === 'function' ? library.activeDraft() : null))
                ?? (namedId ? null
                    : (typeof library?.selected === 'function' ? library.selected() : null));
            if (!editor || !record) {
                appLogger.warn('edit: no profile record to seat — staying on the current route');
                return;
            }
            editor.open(record);
            this.goto(intent.route);
            return;
        }

        if (intent.kind === 'arm') {
            const library = this.boot?.library;
            if (!library) return;
            library.select(intent.profileId);
            library.arm(intent.profileId)?.catch?.((error) => {
                appLogger.warn(`arming a favourite threw: ${error && error.message}`);
            });
        }
    }

    /** Navigate, unless a guard refuses. Answers whether the route change was allowed. */
    goto(routeId, { invoker = null } = {}) {
        const asked = this.#leave.request({ from: this.route ?? null, to: routeId, kind: LEAVE_KIND.NAVIGATE });
        if (asked.action !== LEAVE_ACTION.LEAVE) return false;
        this.#returnFocus = invoker && this.route
            ? { route: this.route, invoker: String(invoker), pushed: true }
            : null;
        if (globalThis.location) globalThis.location.hash = hashFor(routeId);
        else this.boot?.goto(routeId);
        return true;
    }

    back() {
        if (this.#returnFocus?.pushed && globalThis.history?.back) {
            globalThis.history.back();
            return;
        }
        this.goto(DEFAULT_ROUTE_ID);
    }

    #onNavigate = (event) => {
        const detail = event?.detail ?? {};
        if (detail.back) {
            this.back();
            return;
        }
        if (typeof detail.route === 'string' && detail.route !== '') {
            this.goto(detail.route, { invoker: detail.invoker ?? null });
        }
    };

    /** The theme, for a screen that offers a switch. `null` when a test injected a boot
     *  and therefore owns the theme itself. */
    get theme() { return this.#theme; }

    updated(changed) {
        super.updated?.(changed);
        this.setAttribute('aria-busy', this.phase === BOOT_PHASE.READY ? 'false' : 'true');
        this.#attachSaver();
    }

    render() {
        const state = this._boot;
        const phase = state ? state.phase : BOOT_PHASE.IDLE;

        const saver = html`
            <ui-screensaver
                id="screensaver"
                @ui-screensaver-wake=${this.#onWake}
                @ui-screensaver-dim=${this.#onSaverDim}
            ></ui-screensaver>
        `;

        return html`
            ${saver}
            ${this.#body(phase, state)}
        `;
    }

    /** The branch under the saver. Three shapes, no saver in any of them. */
    #body(phase, state) {
        if (phase === BOOT_PHASE.ERROR) {
            const t = this.#i18n.t;
            const win = this.ownerDocument?.defaultView;
            return html`<div class="app"><div class="booting">
                <section class="recovery" aria-labelledby="recovery-heading">
                    <h1 id="recovery-heading">${t('Decal could not start')}</h1>
                    <p role="alert">${t('The screen could not be loaded. Reload Decal to try again.')}</p>
                    <p>${t('If this keeps happening, reopen the skin from Decaid or reinstall its app files.')}</p>
                    <div class="recovery-actions">
                        <button id="recovery-reload" class="reload" @click=${this.#reload}>${t('Reload Decal')}</button>
                        ${canOpenDashboard(win) ? html`<button id="recovery-dashboard" @click=${this.#openDashboard}
                            >${t('Open dashboard')}</button>` : nothing}
                    </div>
                    <details id="recovery-details">
                        <summary>${t('Technical details')}</summary>
                        <pre id="recovery-error" tabindex="0">${startupFailureDetails(state.error)}</pre>
                        <button id="recovery-copy" ?disabled=${this._recoveryCopy === 'pending'} @click=${this.#copyRecovery}
                            >${t('Copy details')}</button>
                        ${this._recoveryCopy && this._recoveryCopy !== 'pending' ? html`<p class="recovery-status" role="status"
                            >${t(this._recoveryCopy === 'copied' ? 'Copied' : 'Could not copy. Select the details to copy them.')}</p>` : nothing}
                    </details>
                    ${this._recoveryFailure ? html`<p class="recovery-status" role="status">${t(this._recoveryFailure)}</p>` : nothing}
                </section>
            </div></div>`;
        }

        if (!this.#screen) {
            /* `role="status"` (a polite live region) rather than `alert`: starting up is
             * not an interruption, and the screen that follows is the real content. */
            return html`<div class="app"><div class="booting" role="status">
                <ui-empty-state
                    heading=${this.#i18n.t('Starting Decal')}
                    body=${this.#bootMessage(state)}
                ></ui-empty-state>
            </div></div>`;
        }

        return html`
            <main class="app" @navigate=${this.#onNavigate}>${this.#screen}</main>
        `;
    }

    #reload = () => {
        try { this.ownerDocument.defaultView.location.reload(); }
        catch { this._recoveryFailure = 'Reload failed. Open the skin again from Decaid.'; }
    };

    #openDashboard = () => {
        if (!openDashboard(this.ownerDocument?.defaultView)) this._recoveryFailure = 'The dashboard could not be opened.';
    };

    #copyRecovery = async () => {
        const error = this._boot?.error;
        this._recoveryCopy = 'pending';
        try {
            const clipboard = this.ownerDocument?.defaultView?.navigator?.clipboard;
            if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
            await clipboard.writeText(startupFailureDetails(error));
            if (this._boot?.error === error) this._recoveryCopy = 'copied';
        } catch {
            if (this._boot?.error === error) this._recoveryCopy = 'failed';
        }
    };

    #bootMessage(state) {
        const t = this.#i18n.t;
        if (!state) return t('Starting.');
        switch (state.step) {
            case 'stores': return t('Opening the connection to the machine.');
            case 'capabilities': return t('Asking the machine what it can do.');
            case 'screen': return t('Loading the screen.');
            default: return t('Starting.');
        }
    }
}

customElements.define('app-root', AppRoot);

export { BOOT_PHASE };
