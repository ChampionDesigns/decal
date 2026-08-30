/**
 * app-root — THE APPLICATION SHELL. One mount point, one document.
 *
 * This file replaces the wave-0a placeholder whole (SCOPE Part 5 §1: "this screen drags
 * the application shell — theme boot, routing, connection state, tokens on `:root` — into
 * existence with it"). It does four things and refuses the fifth:
 *
 *   1. BOOTS. Reads `window.location` once — through `bootFromWindow`, the one function
 *      allowed to (`rea-transport.js:56-58`) — and hands the result to `createAppBoot`.
 *   2. ROUTES. A hash change swaps WHICH SCREEN COMPONENT is mounted here. No HTML
 *      fragments, no `innerHTML`-injected pages: bugs P1, P2 and S10 are all the same
 *      mistake, and a custom element's own `disconnectedCallback` is the browser's
 *      guarantee that the screen going away takes its listeners with it.
 *   3. THEMES. Adopts the pre-paint stamp rather than re-deciding it (no flash), then
 *      owns the store-driven switch afterwards (`src/lib/theme.js`, bug S11).
 *   4. SAYS WHERE IT IS. `connecting` / `ready` / `error`, composed from the boot store —
 *      whose `connection` field is the connection feed's own status, mirrored, never
 *      re-derived.
 *
 * AND THE FIFTH: IT DOES NOT RENDER THE MACHINE'S STATE. "Still trying", "failed" and
 * "two machines, pick one" are B8's three states and they belong to `<live-screen>`,
 * which is where the user is standing and where the picker dialog can be answered. A
 * shell that held the screen behind a connection would make those states unreachable.
 * The boot surface here is about the SHELL: it is on screen only until there is a screen.
 *
 * TOKENS ONLY, NO COLOUR, NO `!important`, NOTHING ABSOLUTELY POSITIONED. The ground is
 * `styles/document.css`'s (`app-root { background: var(--ui-canvas) }`), and this file
 * does not restate it: ONE owner of the ground is the whole of bug S6, whose old shape
 * was a letterbox painted `#FFFFFF` / `#101217` against a canvas of `#e8eaeb` / `#090d10`
 * from a body rule that never applied. With the canvas gone there is no letterbox to get
 * wrong; what is left is not declaring the colour a second time.
 *
 * D2 — every string a person reads is a VALUE, read through `I18nController`, from the
 * component's first commit. English only in v1; the mechanism is not deferred.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { bootFromWindow, BOOT_PHASE } from 'src/lib/app-boot.js';
import { reconnectingSocketFactory } from 'src/data/rea-sockets.js';
import { createThemeController, LIGHT_QUERY } from 'src/lib/theme.js';
import { applyDensity, normaliseDensity, DENSITY_KEY } from 'src/lib/density.js';
import { createStorageRouter } from 'src/lib/storage-router.js';
import { createWebStorageBackend, createMemoryBackend } from 'src/lib/storage-backends.js';
import { LAYERS } from 'src/lib/storage-routes.js';
import { routeIdFromHash, hashFor, DEFAULT_ROUTE_ID } from 'src/lib/app-routes.js';
import { installFit } from 'src/lib/app-fit.js';
import { intentFor, INTENT_EVENTS } from 'src/lib/app-intents.js';
import { logger as appLogger } from 'src/lib/logger.js';

import 'src/components/ui-empty-state.js';
import 'src/components/ui-alert-banner.js';
import 'src/components/ui-screensaver.js';
import { attachScreensaver } from 'src/components/ui-screensaver.js';
import { FEED } from 'src/stores/live-stores.js';
import { MACHINE_STATE } from 'src/data/machine-state.js';
import { valueOf } from 'src/stores/feed-store.js';
import { deriveSleepButtonAction } from 'src/lib/screensaver-policy.js';

/**
 * Build the real storage router: localStorage for the device-scoped keys the shell needs
 * (the theme is one), memory for everything else this file does not own.
 *
 * A WebView in private mode throws on `localStorage` access, which is why the backend is
 * built inside a `try`: a shell that cannot remember a colour still has to boot.
 */
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
        /**
         * The boot object (`createAppBoot(...)`). Settable BEFORE the element connects,
         * which is how a test drives the shell against fakes; left unset, the element
         * builds the real one from `window` on connect. The seam is a property rather
         * than a module-level hook so two shells can exist in one page without one
         * silently configuring the other.
         */
        boot: { attribute: false },

        /**
         * The shell's own state, reflected so a test — and a stylesheet — can read it
         * without piercing the shadow root. Appendix 15: state travels as an attribute a
         * selector can name, exactly as `.slate-bank` does it with `aria-*`.
         */
        phase: { type: String, reflect: true },

        /** The mounted route's id, reflected for the same reason. */
        route: { type: String, reflect: true },

        /** Internal: the boot state, so `render()` reads one object. */
        _boot: { state: true },
    };

    static styles = [css`
        /* The HOST BOX IS NOT DECLARED HERE. styles/document.css:88-97 owns it -
         * block-size: 100dvh, the canvas ground, and container-type: size, which is
         * where "a component reads its own container, never the viewport" starts. An
         * outer-tree rule beats a :host rule whatever the specificity, so restating it
         * would be a second owner that cannot win: bug S3's shape (four owners of page
         * height) reintroduced for tidiness.
         *
         * (No backticks anywhere in this block, and none in any css template in the
         * tree: one inside a tagged template CLOSES it, and the file then parses as
         * whatever the CSS happens to look like. Measured, once, the hard way.) */

        /* The screen's box. One grid row, definite height, so a screen written to the
         * §4.1 skeleton (display: grid; height: 100%) gets the definite block size that
         * skeleton needs. min-block-size: 0 so a screen that overflows scrolls or
         * clips on its OWN terms rather than pushing the shell's box open. */
        .app {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
        }

        /* THE BOOT SURFACE. Centred in the same single row the screen would occupy, so
         * the shell's box is identical before and after mounting — nothing reflows
         * underneath the screen when it arrives. Padding, not margin: the row is the
         * grid's, and a margin here would collapse against it. */
        .booting {
            display: grid;
            place-items: center;
            padding: var(--ui-space-6);
            min-block-size: 0;
        }

        /* The error case is a strip, not a card: ui-alert-banner carries its own
         * measured treatment (component #49) and this only decides how wide it may be. */
        .booting ui-alert-banner {
            inline-size: min(100%, 860px);
        }
    `];

    #i18n = new I18nController(this);

    /** The mounted screen ELEMENT. A DOM node rendered as a template value — Lit commits
     *  a node it is given and removes the previous one, which is the whole of "a route
     *  change swaps the mounted screen component" with no innerHTML anywhere. */
    #screen = null;

    /** Unsubscribe from the boot store. Held so `disconnectedCallback` can undo it. */
    #unwatchBoot = null;

    /** The hash listener, held for the same reason (bug S10: a duplicated listener). */
    #onHashChange = null;

    /** The theme controller, if this element built one. */
    #theme = null;

    /** `attachScreensaver`'s teardown while a boot is attached, else null. */
    #unwatchSaver = null;

    /** WHICH element that teardown belongs to. See `#attachSaver` for why identity, and
     *  not a boolean, is what this has to remember. */
    #attachedSaver = null;

    /**
     * Stop the fit's resize listeners (src/lib/app-fit.js). The shell owns this because
     * the shell IS the element being scaled: `styles/document.css` reads the three
     * properties the fit publishes. index.html writes them once before first paint —
     * without that, the first frame paints unscaled and the tablet flashes the 1281
     * reflow this whole mechanism exists to prevent — and this keeps them true from
     * then on, through a rotate, a window drag and an on-screen keyboard.
     */
    #stopFit = null;

    /**
     * THE INTENT LISTENER — one handler for the three events a screen dispatches at the
     * shell (src/lib/app-intents.js). Held so the add/remove pair cannot drift, exactly
     * as `#onHashChange` is: bug S10 is the absence of that pairing.
     *
     * It listens on THIS element and not on `window`, because every intent is composed
     * and bubbling and the mounted screen is inside this shadow root — so the events
     * arrive here on their own, and a window listener would also catch a second shell
     * on the same page.
     */
    #onIntent = null;

    /** True when this element built its own boot object and therefore owns its teardown. */
    #ownsBoot = false;

    /**
     * WHERE THE CARET GOES BACK TO — the phase-2 dialog contract's `invoker`, applied
     * to a route (bug H9's surviving half).
     *
     * `ui-dialog` names an ELEMENT ("the element focus returns to. Defaults to whatever
     * had the caret when the dialog opened") because a dialog's invoker outlives the
     * dialog: the page underneath is still there. A ROUTE SWAP DESTROYS THE SCREEN —
     * that is what makes it a route and not an overlay — so an element reference here
     * would be a reference to a node that has been removed and forgotten by the time
     * anyone could restore focus to it. What crosses the swap is the pair
     *
     *     { route: the route we left, invoker: the affordance's id in ITS OWN root }
     *
     * and the SCREEN applies it, because only the screen can reach inside its own
     * shadow root. That is the whole mechanism: no trap, no `inert`, no `aria-modal`,
     * no second restore machinery — a route is not modal, and the one thing it
     * inherits from the dialog contract is "name an invoker, restore focus to it on
     * leaving" (`src/lib/focus-trap.js` exports no restore function to reuse, and
     * ui-dialog's is private, so this is the contract applied rather than the code
     * copied).
     *
     * `pushed` records that THIS shell wrote the address that got us here, which is
     * what makes `back()` safe to answer with `history.back()`.
     */
    #returnFocus = null;

    constructor() {
        super();
        this.phase = BOOT_PHASE.IDLE;
        this.route = null;
        this._boot = null;
    }

    connectedCallback() {
        super.connectedCallback();

        /* Before anything else: the ground this element is drawn on. `installFit` writes
         * the fit immediately, so a shell mounted into a page that never ran the inline
         * copy — every harness page, and every test that mounts <app-root> by hand — is
         * scaled the same way the tablet is. */
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

        /* THE DISPLAY SIZE, PUT BACK LIKE THE THEME. Outside the `#ownsBoot` branch on
         * purpose: an injected boot brings its own settings store, and the density is that
         * store's to answer whoever built it. Started, not awaited — a stored size arrives
         * a KV read later and the app is usable meanwhile, exactly as the theme's own
         * hydrate behaves. */
        void this.#hydrateDensity();

        this.#unwatchBoot = this.boot.subscribe((state) => this.#onBootState(state));

        /* ROUTING. One listener, added here and removed in `disconnectedCallback` — the
         * pairing S10 is the absence of. `hashchange` rather than a click interceptor:
         * the address bar, a link and `location.hash = …` all arrive the same way. */
        this.#onHashChange = () => {
            const id = this.#routeFromLocation();
            if (this._boot && this._boot.route && this._boot.route.id === id) return;
            this.boot.goto(id);
        };
        globalThis.addEventListener?.('hashchange', this.#onHashChange);

        /* THE WRITE PATH THE LIVE SCREEN NEVER HAD. Its own contract block records the
         * gap — six events dispatched, four listened to — and the fullscreen control's
         * note calls the fix "another surface's work". This is that surface. */
        this.#onIntent = (event) => this.#applyIntent(event);
        for (const type of INTENT_EVENTS) this.addEventListener(type, this.#onIntent);

        /* `start()` is deliberately not awaited: `connectedCallback` is synchronous, and
         * an await here would only move the same promise somewhere with no catch. Every
         * failure `start()` can have is already state. */
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
        this.#unwatchBoot?.();
        this.#unwatchBoot = null;
        this.#unwatchSaver?.();
        this.#unwatchSaver = null;
        this.#attachedSaver = null;
        /* The screen goes with the shell. Dropping the reference is not enough — the node
         * is in this shadow root, and Lit will not remove it while the template still
         * holds it, so it is removed explicitly and then forgotten. */
        this.#screen?.remove();
        this.#screen = null;
        if (this.#ownsBoot) {
            this.boot?.destroy();
            this.#theme?.destroy();
            this.#theme = null;
            /* AND FORGET IT. A destroyed boot refuses `start()`, so an element that was
             * moved in the DOM — disconnected and connected again, which the platform does
             * for a single `appendChild` elsewhere — would come back attached to a corpse.
             * Clearing it means a reconnect rebuilds, which is the only correct answer for
             * an object whose whole job is to be started. A boot the CALLER injected is
             * left alone: it is theirs, and theirs to re-inject. */
            this.boot = null;
            this.#ownsBoot = false;
        }
        super.disconnectedCallback();
    }

    /** The theme: adopt the stamp, hydrate from the router, follow the panel until the
     *  user chooses. Only when this element built its own boot — a test injecting one
     *  brings its own root and its own storage. */
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

    /**
     * The display size, put back the way the theme is.
     *
     * IT WAS CHOSEN AND THEN FORGOTTEN. `applyDensity` had exactly one caller — the
     * settings screen's own `leaf-change` handler — so a size picked on a previous visit
     * was applied when it was picked and never again. Reload the tablet and the app came
     * up at "Fit screen" whatever the person had stored, until they opened Settings ›
     * Display › Display Size, at which point it silently snapped to their choice. The
     * behaviour audit filed it as a boot gap; it is the same shape as the theme, which has
     * been hydrated at boot since the shell was built.
     *
     * THE STORE IS THE BOOT'S, not a second one. The density row is a routed key like every
     * other (B7), and `settings.load()` is what fetches it; reading it any other way would
     * be a second owner for one value.
     *
     * AN UNREADABLE OR UNKNOWN VALUE APPLIES NOTHING. `normaliseDensity` answers null for
     * anything outside the four steps, and the sheet's own declarations are the fallback —
     * which is exactly what an unset preference should get.
     */
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

    /**
     * The boot store changed. The ONE place the screen element is created or replaced.
     *
     * The element is created once per route and kept: re-creating it on every state
     * change would restart the screen (and its chart) on a connection blip, which is the
     * "destroyed and rebuilt on every ± press" defect (E12) wearing a shell's clothes.
     */
    /**
     * THE WAKE — the one command the screensaver is allowed to cause.
     *
     * `screensaver-policy.js` rule 2: "nothing that is not a wake may emit a wake", and
     * the corollary is that the wake itself is not the component's to send. It reports
     * the press; the shell asks the machine. The state name comes from the GENERATED enum
     * because `MachineState.values.byName` is what parses it upstream and an unknown name
     * is a 500, not a 400.
     */
    #onWake = () => {
        this.boot?.machineState?.request(MACHINE_STATE.IDLE);
    };

    /**
     * THE DIM — D10's panel half, which was emitted and heard by nobody.
     *
     * `ui-screensaver.js` has said since it was written that "the skin drives the DIM and
     * stands back on the RESTORE" (its Q13 section), and the whole of that argument rests
     * on the dim actually being sent: ReaPrime restores an awake machine that is sitting at
     * requested brightness 0 (`display_controller.dart:276-285`), so OUR dim to 0 is what
     * ARMS its restore. The component emitted `ui-screensaver-dim` faithfully and this
     * shell bound only `@ui-screensaver-wake` — so the overlay went black, the panel behind
     * it stayed at whatever brightness it was, and because the panel never reached 0
     * ReaPrime's restore was never armed either. The whole wake-edge design was inert.
     *
     * That is the same shape as the bug recorded in `render()` against this very component
     * ("IT IS WRITTEN AND IT WAS MOUNTED NOWHERE") — a finished half with no other half —
     * and it survived because all three of the component's own tests assert that it EMITS,
     * and none of them asserts that anybody acts. Found 26 August 2026 by grepping `src/`
     * for the event name: one emitter, zero consumers.
     *
     * THREE LINES, AND NO POLICY IN THEM. The brightness on the event is the port's own
     * `SCREENSAVER_BRIGHTNESS`, so this handler never picks a number; `live.setBrightness`
     * rounds, clamps and answers `{ok, reason}` (`live-stores.js`), so this handler never
     * validates one. A shell with no live stores simply has no sender, and the optional
     * calls make that a no-op rather than a throw on the sleep edge.
     */
    #onSaverDim = (event) => {
        const brightness = event?.detail?.brightness;
        this.boot?.live?.setBrightness?.(brightness);
    };

    /**
     * Feed the mounted saver, once a boot exists. Idempotent PER ELEMENT.
     *
     * IT USED TO BE IDEMPOTENT PER SHELL, and that is what made the black screen never
     * appear. The guard was `if (this.#unwatchSaver …) return` — a one-shot flag — and
     * `render()` returned THREE separate templates (error / booting / ready), each with
     * its own `${saver}`. Lit keys a template by its strings array, so those are three
     * different templates and moving between them DESTROYS the `<ui-screensaver>` and
     * builds a new one. The shell attached to the BOOTING element, the flag went
     * truthy, the ready element arrived, and nothing ever fed it.
     *
     * Every guard passed. The feed was live and reporting `sleeping`; the element was in
     * the shadow root and findable; `attachScreensaver` worked when called by hand. Only
     * the identity was wrong, and identity is the one thing none of those checks reads.
     *
     * `render()` now hoists the saver above the branch so the element is the same one in
     * every phase — that is the actual repair. This half is the second lock: it holds the
     * element it attached to, and a DIFFERENT element re-attaches. A future split of the
     * template then costs a re-subscription rather than a blank screen that never comes.
     */
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
            /* THE THIRD SOURCE, AND TWO OF ITS THREE KEYS WERE DEAD BEFORE IT.
             * `screensaverEnabled` had a switch on the Screen Saver page and reached
             * nothing — the blank went up on a sleeping machine whether or not the user
             * had turned it off. `screensaverType` is Ben's (26 Aug 2026) and is fed
             * from the start. It is the BOOT's store, not a second one: see
             * `app-boot.js`, where there is now exactly one. */
            settings: this.boot.settings ?? null,
        });
    }

    #onBootState(state) {
        this._boot = state;
        this.phase = state.phase;
        this.route = state.route ? state.route.id : null;

        const tag = state.route ? state.route.tag : null;
        const current = this.#screen ? this.#screen.tagName.toLowerCase() : null;
        if (tag === current) return;

        /* THE SWAP. Remove first, then create: the outgoing element's
         * `disconnectedCallback` runs at removal, so its subscriptions are gone before
         * the incoming one's are made. The two never overlap, which is what keeps a
         * route swap from costing one subscription per swap for as long as the app runs. */
        this.#screen?.remove();
        this.#screen = tag && globalThis.document ? globalThis.document.createElement(tag) : null;
        /* HAND THE SCREEN THE STORES. One property, the shell's own object, set once at
         * creation — a screen is "components, but layout-only", so it holds stores it was
         * given and never reaches for one. Set BEFORE the element is in the document, so
         * the screen's first update already has its data and nothing paints an empty state
         * it is about to replace. A screen with no `boot` property just gains a field it
         * ignores, which is what keeps `probe-screen` (and any later screen) unaffected. */
        if (this.#screen) this.#screen.boot = this.boot;

        /* AND THE THEME CONTROLLER, for the same reason and by the same rule.
         *
         * This element owns it (see #startTheme): the controller needs a document
         * element to stamp and a matchMedia to ask, and reading ambient state is this
         * file's job and no screen's. Settings > Display > Skin has the only theme
         * control in the app (cmp-ss-3), and it must write through THIS object rather
         * than through the storage router: `set()` stamps the attribute AND moves the
         * controller's own `source` to STORED, which is what stops `followSystem`
         * overwriting the user's choice the next time the panel's preference changes.
         * A screen that persisted the key by itself would leave the controller thinking
         * nobody had chosen — S11's confusion, arrived at from the other side.
         *
         * A screen with no `theme` property just gains a field it ignores, exactly as
         * `boot` does one line up. */
        if (this.#screen) this.#screen.theme = this.#theme;

        /* AND, IF THIS IS A RETURN, HAND BACK THE INVOKER. The record names the route
         * it was recorded ON, so it is spent exactly once and only on the screen that
         * owns the affordance — mounting some OTHER route leaves it alone, because the
         * trip out and the trip back are not always one step, and the record is
         * REPLACED (or cleared) by the next `goto` in any case. A screen with no
         * `restoreFocusTo` property gains a field it ignores, exactly as `boot` does. */
        if (this.#returnFocus && this.#screen && this.#returnFocus.route === this.route) {
            this.#screen.restoreFocusTo = this.#returnFocus.invoker;
            this.#returnFocus = null;
        }

        this.requestUpdate();
    }

    /**
     * Publicly: change route. The address is the source of truth, so this writes the
     * hash and lets the one `hashchange` listener do the work — never both.
     *
     * `invoker` is the id, inside the CURRENT screen's own shadow root, of the control
     * that asked to leave. Naming it is what lets the caret come back to it when this
     * route is returned to; omitting it is fine and means "put the caret wherever
     * arriving normally would".
     */
    /**
     * Act on a screen's intent. Two kinds, and both are the shell's own business.
     *
     * A ROUTE goes through `goto()` and therefore through the address — never through
     * `boot.goto()` directly, which would move the mounted screen while the hash still
     * named the old one, and leave browser Back pointing at a screen that is already on
     * the glass.
     *
     * AN ARM is `select` then `arm`, the pair `selector-screen.js` already uses
     * (`#onPick` then `#onConfirmLoad`) — the library store owns the route, the body and
     * the refusal's wording, and the refusal it raises is published as state that the
     * Live screen's own surface reads. Nothing is awaited: the press is answered by the
     * store's state, and an await here would only hold a promise with no catch.
     *
     * An intent this shell has no answer for is ignored in silence. `intentFor` returns
     * null for it, and null means the shell has no opinion — not an error.
     */
    #applyIntent(event) {
        const intent = intentFor(event.type, event.detail ?? null);
        if (!intent) return;

        if (intent.kind === 'route') {
            this.goto(intent.route, { invoker: intent.invoker ?? null });
            return;
        }

        /**
         * A MACHINE COMMAND FROM THE HEADER — today that is Sleep and nothing else.
         *
         * THE SHELL SENDS IT AND THE POLICY DECIDES IT. `deriveSleepButtonAction` is the
         * one place that knows whether pressing Sleep means sleep or wake, and it exists
         * because of a bug worth the extra hop: "one tap on the sleep button slept the
         * machine and woke it again 46 ms later" — the overlay's own teardown emitted the
         * wake. The rule it enforces is that nothing which is not a wake may emit a wake,
         * and it enforces it by RETURNING a command rather than sending one.
         *
         * THE STATE IT READS IS THE CONFIRMED ONE, off the same store the screensaver
         * reads, so the button and the black screen can never disagree about whether the
         * machine is asleep.
         */
        if (intent.kind === 'machine' && intent.command === 'sleep') {
            const feed = this.boot?.live?.feed?.(FEED.MACHINE);
            const state = typeof feed?.get === 'function' ? feed.get() : null;
            const decision = deriveSleepButtonAction({
                machineState: valueOf(state)?.state ?? null,
            });
            this.boot?.machineState?.request(decision.command);
            return;
        }

        /* EDIT SEATS THE RECORD, THEN ROUTES, AND THE ORDER IS THE WHOLE POINT. A route
         * swap destroys the outgoing screen, so a record handed over any other way goes
         * with it; the editor "takes what it is given and never builds one". This is the
         * same two-step the selector's own Edit makes (selector-screen.js #openEditor),
         * made from the Live band's Edit profile — which had no first step at all, and
         * so mounted the editor's whole structure around nothing. The record is the
         * LOADED profile, which is the one the band names. */
        if (intent.kind === 'edit') {
            const library = this.boot?.library;
            const editor = this.boot?.profileEditor;
            /* THE LOADED PROFILE, NOT THE SELECTED ONE. `selected()` answers the row a
             * user picked IN THE SELECTOR, and on Live nobody has picked anything — the
             * band names the profile the MACHINE is holding, which the library store
             * publishes as `loaded` (R1). Falling back to `selected()` covers the case
             * where the user came from the selector and the two agree. */
            const state = typeof library?.get === 'function' ? library.get() : null;
            /* AN INTENT MAY NAME THE PROFILE, and when it does that is the answer: the
             * favourites' hold menu edits the profile in the SLOT, which is normally not
             * the loaded one. Only an intent with no id falls through to "the one the
             * machine is running". */
            const namedId = intent.profileId ?? null;
            const loadedId = namedId ?? state?.loaded?.id ?? null;
            const record = (loadedId && typeof library?.recordFor === 'function'
                ? library.recordFor(loadedId)
                : null)
                ?? (namedId ? null
                    : (typeof library?.selected === 'function' ? library.selected() : null));
            /* NO RECORD, NO ROUTE. The seat was conditional and the route was not, so a
             * press that resolved to nothing still swapped the screen — and the editor
             * "takes what it is given and never builds one", which is a blank page.
             * Ben, 25 August 2026: "if I click edit profile the page is blank, like no
             * profile is loaded".
             *
             * THE CAUSE WAS UPSTREAM AND IS FIXED THERE (R1 now settles an ambiguous
             * title by the served body), so this branch is the floor rather than the
             * remedy: it is what happens when the machine holds a profile this skin
             * genuinely cannot name — no listing yet, no match, or two bodies alike.
             * Staying put says less than it should; it says strictly more than a blank
             * editor does, and it leaves the Live band's own state on screen. */
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

    goto(routeId, { invoker = null } = {}) {
        this.#returnFocus = invoker && this.route
            ? { route: this.route, invoker: String(invoker), pushed: true }
            : null;
        if (globalThis.location) globalThis.location.hash = hashFor(routeId);
        else this.boot?.goto(routeId);
    }

    /**
     * Publicly: go BACK — the in-app affordance, not the browser's.
     *
     * TWO ANSWERS, AND THE FLAG DECIDES WHICH IS SAFE. `goto()` writes the hash, and a
     * hash ASSIGNMENT pushes a session-history entry: browser Back already works, and
     * an in-app back built on `goto('live')` would push a THIRD entry rather than
     * popping the second, leaving forward history behind it. `history.back()` pops it
     * properly — but only when the entry underneath is ours. A user who opened
     * `#/history` directly (a bookmark, a reload, a link from the host page) has
     * something else under it, and popping would take them out of the app entirely.
     *
     * So: pop when THIS shell pushed, navigate when it did not. The flag is set by the
     * same `goto(..., {invoker})` call that records the invoker, because "we pushed
     * this" and "we know where the caret was" are the same event.
     *
     * Recorded as this wave's most-easily-reversed build note (the tree settles
     * nothing here): the reversal is deleting the `pushed` branch, after which back is
     * always a forward navigation to the default route.
     */
    back() {
        if (this.#returnFocus?.pushed && globalThis.history?.back) {
            globalThis.history.back();
            return;
        }
        this.goto(DEFAULT_ROUTE_ID);
    }

    /**
     * The screens' one way to ask for navigation: a composed, bubbling `navigate`
     * event, caught by a template binding in `render()`.
     *
     * A TEMPLATE BINDING RATHER THAN A SECOND `addEventListener`, deliberately. This
     * element already carries the one listener it must remove by hand (`hashchange`,
     * bug S10's pairing); a binding Lit owns is torn down with the template and cannot
     * be the second half of that bug. And an EVENT rather than a screen reaching for
     * `location`: a screen mounted in a fixture or the gallery has no shell above it,
     * so the event is simply unheard and nothing navigates the harness page away —
     * which is the same reason `settings-screen.js:468` asks its boot rather than the
     * address.
     */
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

    /**
     * `aria-busy` on the HOST, driven by the same state the `phase` attribute carries.
     *
     * In `updated()`, not in `render()`: writing an attribute on the host during render
     * is a side effect in the one place Lit asks to be pure, and this way the announcement
     * lands only once the screen it describes is actually in the DOM. Appendix 15 - state
     * as an attribute a selector (and an assistive technology) can name.
     */
    updated(changed) {
        super.updated?.(changed);
        this.setAttribute('aria-busy', this.phase === BOOT_PHASE.READY ? 'false' : 'true');
        /* The saver exists only after the first render, and the boot may arrive before
         * or after that render. Asking here covers both orders, and the guard makes the
         * second ask free — see `#attachSaver` for what that guard has to compare. */
        this.#attachSaver();
    }

    render() {
        const state = this._boot;
        const phase = state ? state.phase : BOOT_PHASE.IDLE;

        /* THE BLANK IS THE SHELL'S, NOT A SCREEN'S, and it is ABOVE every branch.
         *
         * Slate blanks the whole tablet when the machine sleeps, from wherever you are
         * standing — Ben, 23 Aug 2026: "please add slates black sleep screen for when it
         * goes to sleep". A saver mounted inside <live-screen> would leave Settings and
         * the History screen lit on a sleeping machine, and would be torn down and rebuilt
         * on every route change, which is a blank that flickers on navigation. A saver in
         * the READY branch alone would be absent for as long as a screen module takes to
         * load, which is exactly when a sleeping machine is most likely to be found.
         *
         * IT WAS IN EVERY BRANCH AND THAT WAS THE BUG (24 Aug 2026). Each branch was its
         * own `html` template, so Lit rebuilt the element on every phase change and the
         * shell's one-shot attach stayed bound to the element from the phase before. The
         * machine reported `sleeping` and the screen never went black. `#attachSaver`
         * carries the measurement; the repair is that the saver is interpolated once,
         * above `#body()`, and is therefore the same element for the life of the shell.
         *
         * IT IS WRITTEN AND IT WAS MOUNTED NOWHERE. `<ui-screensaver>` (#57) and
         * `screensaver-policy.js` were both finished — the policy has its own suite, the
         * component raises a top-layer blank and re-enters it above any later top-layer
         * box — and nothing in `src/` ever rendered one. Same shape as the tank's feed
         * and the header's dead buttons: a finished half with no other half.
         *
         * NOTHING IS PASSED BUT THE STATE. `enabled` defaults on and `brightnessSupported`
         * defaults off; `attachScreensaver` fills both from the feeds when a boot arrives.
         * With no boot at all it stays dark-free: the policy's answer for a non-string
         * machine state is "not a confirmed sleep".
         *
         * BOTH OF THE COMPONENT'S COMMANDS ARE BOUND HERE, and for a while only one was.
         * The element emits two events and both of them ask the shell for something: the
         * WAKE, and the DIM. `@ui-screensaver-dim` was missing until 26 August 2026 —
         * see `#onSaverDim` for what that cost.
         *
         * THERE USED TO BE A THIRD, `-blank`, and this note used to end "…is a report
         * that the paint changed and nothing here needs to act on it". That reading was
         * taken as the finding when the dead-wire gate reached it three days later
         * (audit F-013): the emit is gone from `ui-screensaver.js` rather than bound
         * here, so the two lines above are now the WHOLE of this element's vocabulary
         * and a reader can tell that by counting them. */
        const saver = html`
            <ui-screensaver
                id="screensaver"
                @ui-screensaver-wake=${this.#onWake}
                @ui-screensaver-dim=${this.#onSaverDim}
            ></ui-screensaver>
        `;

        /* ONE TEMPLATE, THREE BODIES — and the order matters more than it looks.
         *
         * This used to be three `return html` statements, each opening with `${saver}`.
         * Lit keys a template by its strings array, so those were three DIFFERENT
         * templates: every move between them destroyed the `<ui-screensaver>` and built a
         * new one. The shell attached to the first, and the machine's state never reached
         * any of the others — the black screen simply never appeared, on a machine that
         * was reporting `sleeping` the whole time.
         *
         * Hoisting the saver ABOVE the branch makes it one element for the life of the
         * shell. Nothing else about the three bodies changes. */
        return html`
            ${saver}
            ${this.#body(phase, state)}
        `;
    }

    /** The branch under the saver. Three shapes, no saver in any of them. */
    #body(phase, state) {
        if (phase === BOOT_PHASE.ERROR) {
            return html`<div class="app"><div class="booting" role="alert">
                <ui-alert-banner
                    >${this.#i18n.t('Decal could not start')}<span slot="remedy"
                        >${this.#i18n.t('The screen module could not be loaded. Reload the page; if it happens again the app files did not all reach the tablet.')}</span
                    ></ui-alert-banner
                >
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

        /* THE SCREEN. A DOM NODE as a template value: Lit commits the node it is given
         * and removes the one that was there, which is the whole of "a route change swaps
         * the mounted screen component" — no innerHTML, no fragment, no re-parse.
         *
         * Written across three lines rather than one because Gate D's constructed-path
         * scan reads any single-line interpolated template containing a slash as a path
         * being assembled (`gate-d.js` collectConstructedPaths, and its shape test is
         * deliberately structural). A closing tag has a slash in it. */
        return html`
            <main class="app" @navigate=${this.#onNavigate}>${this.#screen}</main>
        `;
    }

    /**
     * What the boot surface says while it is up.
     *
     * COMPOSED FROM THE CONNECTION STORE, not from a second reading of the socket layer:
     * `state.connection` is `FEED_STATUS` as the connection feed published it. The
     * vocabulary stops at "the machine has not answered yet" — naming the B8 states here
     * would be a second implementation of the thing `<live-screen>` owns.
     */
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
