/**
 * settings-model.js — the Settings screen's composition root, and nothing else.
 * Wave 5.4, rows `settings-row-thirty-leaves`, `b7-storage-routing` (consumer side).
 *
 * WHY A FILE FOR THIRTY LINES. `settings-screen.js` owns boxes, and `test/settings-
 * skeleton.test.mjs` holds it to that: the suite fails if that file imports `src/data/`
 * or `src/stores/`, names a storage route, a capability or a limits table. That is the
 * layer boundary the skeleton was built to have, and the leaves must not be the thing
 * that quietly dissolves it. So the wiring lives here, one import deep, where it is
 * visible and where a reader looking for "what does this screen touch" finds all of it
 * on one screen of text.
 *
 * FOUR THINGS ARE JOINED HERE AND EACH ONE ARRIVES FROM ITS OWN OWNER:
 *
 *   the router      `boot.storage` — "one per app; screens take it, never build one"
 *                   (`app-boot.js`). Every key's LAYER is the routing table's answer.
 *   capabilities    `boot.capabilities` — the served array, A3. Never a model string.
 *   the limits      `boot.capabilities.machineLimits()` — the R2 door itself, which is
 *                   the only route to the one table. The table travels as a VALUE.
 *   the machine     `createDe1SettingsClient(boot.transport)` — the two contract rows
 *                   for `/machine/settings`, both `consumed` and checked at the pin.
 *
 * ONE MODEL PER BOOT, and it matters. Machine changes are STAGED until Save (D11), so a
 * model rebuilt when the selected leaf changes would throw away the staged changes of
 * every other leaf and quietly reset the count to zero — a settings page that forgets
 * what you typed the moment you look at another page. The `WeakMap` keys the model to
 * the boot object, so the app has one and a test that builds two boots gets two.
 */

import { createSettingsStore } from 'src/stores/settings-store.js';
import { createSettingsLeafModel, machinePortFor, advancedPortFor } from 'src/stores/settings-leaf-model.js';
import { createDe1SettingsClient } from 'src/data/rea-de1-settings.js';
import {
    createMachineFieldsPort, workflowDoorFor, waterLevelsDoorFor, machineInfoDoorFor,
    cupWarmerDoorFor, presenceDoorFor,
} from 'src/stores/machine-fields-port.js';
import { createMachineInfoStore } from 'src/stores/machine-info-store.js';
import { createLedStripStore } from 'src/stores/led-strip-store.js';
import { createCalibrationStore } from 'src/stores/calibration-store.js';
import { createSkinsStore } from 'src/stores/skins-store.js';
import { createFirmwareStore } from 'src/stores/firmware-store.js';
import { createAppInfoStore } from 'src/stores/app-info-store.js';
import { createAppSettingsStore } from 'src/stores/app-settings-store.js';
import { createWorkflowStore } from 'src/stores/workflow-store.js';
import { createPresenceStore } from 'src/stores/presence-store.js';
import { createPluginsStore } from 'src/stores/plugins-store.js';
import { createDecentAccountStore } from 'src/stores/decent-account-store.js';
import { createDecentSupportStore } from 'src/stores/decent-support-store.js';
import { createFeedbackStore } from 'src/stores/feedback-store.js';
import { createScaleConnectStore } from 'src/stores/scale-connect-store.js';
import { createMachineStateStore } from 'src/stores/machine-state-store.js';
import { callRoute } from 'src/data/rea-routes.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
import { FEED } from 'src/stores/live-stores.js';
import { DEFAULT_LANGUAGE } from 'src/lib/i18n.js';

/** boot -> the bundle both models come out of. Weak; a destroyed boot takes it with it. */
const MODELS = new WeakMap();

/**
 * THE LANGUAGES THE TILE GRID OFFERS, and it is one (D2: "translation as a value each
 * component reads, English only in v1").
 *
 * NOT THIS SCREEN'S LIST TO GROW. `initI18n({available})` takes it from the manifest of
 * generated files (`src/lib/i18n.js:132-150`) and today that manifest ships `en.json`
 * alone, so a longer list here would offer a language whose strings do not exist — the
 * tile would write the key and the app would fall back to English with no way back except
 * clearing storage. The grid is data-driven, so the day the manifest grows this constant
 * follows it and nothing in the leaf changes.
 *
 * Endonym over English name is Slate's own pair (`.slate-lang-endonym` /
 * `.slate-lang-english`), carried as content.
 */
export const AVAILABLE_LANGUAGES = Object.freeze([
    Object.freeze({ code: DEFAULT_LANGUAGE, endonym: 'English', english: 'English', partial: false }),
]);

/**
 * The model for a boot object, built once.
 *
 * A boot with no storage router is not an error and not a degraded mode: it is a screen
 * mounted without an app (a fixture, a gallery page). It gets `null`, and
 * `<settings-leaf>` renders its heading with no rows — which is the honest picture of a
 * settings screen with no stores behind it.
 */
export function settingsModelFor(boot) {
    return bundleFor(boot)?.leaf ?? null;
}

/**
 * The stores the NINE BESPOKE LEAVES read (`bespoke-leaves-nine`, D7, D9).
 *
 * SAME BUNDLE, SAME SETTINGS STORE. `display-skin`'s theme, `display-brightness`'s
 * `lastBrightness` and `select-language`'s `language` are routed keys like every other,
 * so the bespoke leaves take the SAME store instance the primitive rows take — B7 is one
 * store per setting, and two stores over one router would be two in-memory answers to one
 * key, which is the units.js silent-revert defect wearing a second screen.
 *
 * `allowed()` IS A3 IN ONE PLACE. A bespoke leaf asks "may I render", never "what did the
 * capability array say", so there is one expression of fail-closed and it covers ABSENT
 * and UNKNOWN alike — including the case of no capability store at all, which is UNKNOWN
 * and not a degraded mode.
 */
export function settingsBespokeFor(boot) {
    return bundleFor(boot)?.bespoke ?? null;
}

function bundleFor(boot) {
    if (!boot || !boot.storage) return null;
    if (MODELS.has(boot)) return MODELS.get(boot);

    /* THE BOOT'S STORE WHEN THERE IS ONE, AND THAT IS THE ORDINARY CASE (24 Aug 2026).
     *
     * B7 is one store per setting, and this line used to build a second one
     * unconditionally. It was harmless while the Settings screen was the only reader —
     * and it stopped being harmless the moment the SCREENSAVER needed `screensaverEnabled`
     * and `screensaverType`: two stores over one router are two in-memory answers to one
     * key, so the page would turn the clock on and the blank would go on reading its own
     * copy. That is the units.js silent-revert defect with a new key.
     *
     * The fallback stays for a boot assembled by hand — a fixture, a gallery page — which
     * has a `storage` and no `settings`. It is a construction, not a second answer: such a
     * boot has no other reader to disagree with. */
    const settings = boot.settings ?? createSettingsStore({
        storage: boot.storage,
        capabilities: boot.capabilities ?? null,
        logger: boot.logger ?? undefined,
    });

    /* THE LIMITS ARRIVE AS A FUNCTION, AND THAT IS THE FIX FOR A SHIPPED DEFECT.
     *
     * `machineLimits()` is the R2 answer — its `.value` is the table for the machine
     * class the SERVED capability array implies, and it carries no steam row at all
     * while the class is unknown (A7: no honest stand-in for a machine-dependent
     * ceiling).
     *
     * THIS READ ONCE AT CONSTRUCTION, on the reasoning that "a machine swap re-boots the
     * capability store, and this model dies with its boot". True of a swap, and wrong
     * about the FIRST answer, which is what made it a defect: `/machine/capabilities` is
     * an asynchronous read, the screen builds its model as soon as it connects, and on a
     * normal boot that happens first. MEASURED 26 August 2026 — the steam Temperature row
     * drew no band, no degree sign and no clamp, for the whole session, whatever the
     * machine answered a moment later.
     *
     * A FUNCTION IS RE-READ AT EVERY JOIN, so the row gains its envelope when the answer
     * lands. The re-render is already wired: the leaf watches the capability store. */
    const limits = typeof boot.capabilities?.machineLimits === 'function'
        ? () => boot.capabilities.machineLimits().value
        : null;

    /* WHICH MACHINE THIS IS, AS A FUNCTION, FOR THE ROWS THAT ARE NOT ON EVERY MACHINE.
     *
     * A handful of registry rows declare `machines` — the DE1's flow calibration and its
     * volume flow multiplier, since 27 August 2026 — and the leaf model needs the served
     * class to answer them. Same expression the bespoke bundle's `machineClass` uses below
     * and the same one `<settings-screen>` reads for the nav, so all three agree by
     * construction rather than by three people spelling it the same way.
     *
     * A FUNCTION FOR THE SAME REASON `limits` IS ONE, and the failure mode is worse here.
     * The class comes from an asynchronous capability read, so a value captured at
     * construction is null on every normal boot — and null means "show everything", so a
     * captured one would draw the two DE1-only steppers on a Bengle for the whole session
     * and never take them away. That is not a band arriving late; it is a control that
     * should not exist, live and writable, for as long as the page is open. */
    const machineClass = () => (
        typeof boot.capabilities?.machineClass === 'function'
            ? boot.capabilities.machineClass()
            : null
    );

    /* The machine door, or none. `createDe1SettingsClient` REFUSES a transport with no
     * `onWrite` (it is what invalidates the settings caches when a workflow write moves
     * five of the nine values), so a partial transport must produce no port rather than a
     * client that silently serves stale reads. */
    let settingsPort = null;
    let advancedPort = null;
    /* THE CLIENT ITSELF, held so the reset leaf can reach it. `resetSettings()` is the
     * third route that changes what the two DE1 caches hold, and it invalidates them —
     * which is exactly why it belongs on the client rather than at a call site. */
    let de1Settings = null;
    try {
        /* ONE CLIENT, TWO DOORS. The DE1 client owns both `/machine/settings` and
         * `/machine/settings/advanced` and invalidates BOTH caches on either write, so
         * building it twice would give the two doors two cache pairs and let a heater
         * write leave a stale flush temperature on screen beside it. */
        de1Settings = boot.transport ? createDe1SettingsClient(boot.transport) : null;
        settingsPort = de1Settings ? machinePortFor(de1Settings) : null;
        advancedPort = de1Settings ? advancedPortFor(de1Settings) : null;
    } catch {
        de1Settings = null;
        settingsPort = null;
        advancedPort = null;
    }

    /* THE BESPOKE STORES. Each takes the transport and nothing else — no path is spelled
     * on this side of any of them, and none of them is built without one. */
    const transport = boot.transport ?? null;
    const logger = boot.logger ?? undefined;
    const machineInfo = transport ? createMachineInfoStore({ transport, logger }) : null;
    const led = transport ? createLedStripStore({ transport, logger }) : null;
    const calibration = transport ? createCalibrationStore({ transport, logger }) : null;
    const skins = transport ? createSkinsStore({ transport, logger }) : null;
    /* THE TENTH BESPOKE STORE (Ben, 24 Aug 2026, reversing D4). Same shape as the four
     * above it: a transport and nothing else. */
    const firmware = transport ? createFirmwareStore({ transport, logger }) : null;
    /* WHICH BUILD OF DECAID THIS TABLET RUNS — the store that closes the oldest unused
     * half in the tree. `GET /api/v1/info` had been in the generated route table since the
     * table was generated and `grep -rn getInfo src/` returned the declaration and NOTHING
     * ELSE, while the leaf named "Skin / App" had no app half and Send Feedback promised a
     * user it appends an app version the skin could not show. Same shape as the eleven
     * above it: a transport and nothing else. */
    const appInfo = transport ? createAppInfoStore({ transport, logger }) : null;
    /* REAPRIME'S OWN PREFERENCES — the third owner, and the reason nine of Slate's
     * controls read as absent for so long. `rea-app-settings.js` says which nine and why
     * the other thirteen keys on that document are deliberately not writable here.
     *
     * THE SHELL'S, NOT A SECOND ONE (27 August 2026) — the same correction the machine-state
     * store and the cup warmer got above, arriving the same way. `app-boot.js` hoisted this
     * store when the Live rail needed `stopHotWaterAtWeight` to say what ends a hot-water
     * pour; building another here would give one document two in-memory copies, and the two
     * surfaces that read it would then disagree exactly as they did while the rail kept a KV
     * copy — a stop mode changed on this page invisible to the rail until something else
     * re-read. CONSTRUCTED ONLY AS THE FALLBACK a hand-assembled boot (a fixture, a gallery
     * page) needs, which is the shape the two stores above it already use. */
    const app = boot.appSettings ?? (transport ? createAppSettingsStore({ transport, logger }) : null);
    /* THE WORKFLOW STORE, SHARED WITH THE RAIL. The steam and hot-water TARGETS are
     * fields of this document, so the settings page and the Live rail write the same
     * values through the same store — which is B7 across two screens rather than two
     * screens with two answers. A second store here would be exactly that. */
    const workflow = transport ? createWorkflowStore({ transport, logger }) : null;
    /* THE NINE NEW LEAVES' STORES (Ben, 24 Aug 2026). Same shape as the five above:
     * a transport and nothing else, and none is built without one. Not one of them
     * needed a new route — every path was already in the generated table. */
    const presence = transport ? createPresenceStore({ transport, logger }) : null;
    /* THE SHELL'S PLUGIN LISTING, NOT A SECOND ONE (27 August 2026) — the same correction
     * the settings store, the cup warmer, the machine-state store and the preferences
     * document all got above, arriving for the same reason: a second reader appeared. The
     * Live screen's DYE2 button asks this listing whether DYE2 is loaded, so a store built
     * here would give one listing two in-memory copies — and disabling DYE2 on the Plugins
     * page would then leave the Live button offered by a copy that had not heard.
     * CONSTRUCTED ONLY AS THE FALLBACK a hand-assembled boot (a fixture, a gallery page)
     * needs, which is the shape those four already use. */
    const plugins = boot.plugins ?? (transport ? createPluginsStore({ transport, logger }) : null);
    const account = transport ? createDecentAccountStore({ transport, logger }) : null;
    /* THE MESSAGE BOX'S STORE, AND THE BEARER IT CANNOT WORK WITHOUT (27 August 2026).
     *
     * Ben took the recommendation to build Help > Talk to Decent's message box in Slate's
     * shape — a compose box and a thread list, both behind a linked account. The thread and
     * the send both go through `/api/v1/account/proxy/support/api/<endpoint>`, which is
     * authorised by a bearer ReaPrime injects into every skin page it serves.
     *
     * THE TOKEN COMES OFF THE BOOT, NOT OFF `window`. `bootFromWindow` reads
     * `window.__REA_PROXY_TOKEN__` once — it is the one function in the tree allowed to
     * touch ambient state — and parks it on `boot.proxyToken`. A store reading the global
     * for itself would be untestable and would put a second reader of one fact in the tree.
     *
     * `null` IS EXPECTED AND HANDLED, NOT GUARDED AGAINST. A hand-assembled boot (a
     * fixture, a gallery page) and the dev harness both have no token, and the store then
     * answers `hasToken === false` and the leaf says why the box is not there. That is a
     * stated absence rather than a form that would 401 on its first press. */
    const support = transport
        ? createDecentSupportStore({ transport, token: boot.proxyToken ?? null, logger })
        : null;
    const feedback = transport ? createFeedbackStore({ transport, logger }) : null;
    const scaleConnect = transport ? createScaleConnectStore({ transport, logger }) : null;
    /* THE ONE THAT IS NOT NEW — AND THE SHELL'S, NOT A SECOND ONE (27 August 2026).
     *
     * Descaling and Air Purge are machine STATES, so they go through the store that
     * already owns `PUT /machine/state/<newState>`. That much was always the intent, and
     * `machine-state-store.js`'s own header says it in as many words: "ONE OWNER, AND IT
     * IS NOT A SCREEN … a screen that called `callRoute` itself would be the second place
     * deciding what a wake is."
     *
     * THIS LINE BUILT THE SECOND PLACE ANYWAY. `app-boot.js:208` hoists a machine-state
     * store for the shell — the screensaver's wake runs through it, with the injected
     * clock — and this file then constructed another one over the same transport and the
     * same route. Two stores, two records of "what did we last ask the machine for", and
     * the leaf reads only its own: a wake refused from the screensaver was invisible here
     * and a descale refused here was invisible to the shell. It is the same defect the
     * cup warmer had twenty lines below, and the fix has the same shape as the settings
     * store's twenty lines above — take the boot's, and CONSTRUCT only as the fallback a
     * hand-assembled boot (a fixture, a gallery page) needs.
     *
     * The injected clock is part of what is recovered: the shell's store stamps `at` from
     * `boot.clock`, and a second store built here stamped it from `Date.now()`, so two
     * records of one request could not even be ordered against each other. */
    const machineState = boot.machineState
        ?? (transport ? createMachineStateStore({ transport, logger }) : null);
    /* THE TWENTIETH LEAF'S STORE — THE SHELL'S, NOT A SECOND ONE.
     *
     * IT WAS BUILT HERE UNTIL 26 AUGUST 2026, and the comment that stood here said the store
     * had "no caller anywhere in src/". That stopped being true when `app-boot.js` hoisted
     * one for the Live header's Warmer button, and nobody noticed: there were then TWO
     * instances of a store whose whole job is to hold the machine's mat state. The boot's
     * copy refreshes at boot and on `machineChanged` and nothing else, so changing the mat
     * target on this page and pressing Save left the Live header showing the OLD setpoint
     * until the machine reconnected. B7 says one store per setting, and two constructions of
     * one store break it just as thoroughly as two keys would.
     *
     * THE SHELL IS WHERE STORES ARE ASSEMBLED, which this file already agreed with for the
     * capability store and the live layer — it takes `boot.capabilities` and `boot.live`
     * rather than building either. The cup warmer joins them.
     *
     * WHAT THE BOOT'S INSTANCE LACKED WAS THE WAKE SCHEDULES, and that is why this was not a
     * one-line deletion. The presence store lives in this shell, and it is what turns "an
     * enabled pre-heat with no wake schedule" from a silent dead setting into a sentence. So
     * the reader is handed over rather than the store rebuilt — `useSchedules` exists for
     * exactly this, and its own paragraph explains why it does not also refresh.
     *
     * A HAND-BUILT BOOT WITH NO CUP WARMER simply has no door, and the four rows on that
     * leaf read absent — the same state an unreachable machine produces, which this screen
     * has to render anyway. */
    const cupWarmer = boot.cupWarmer ?? null;
    if (cupWarmer && typeof cupWarmer.useSchedules === 'function') {
        cupWarmer.useSchedules(() => presence?.get()?.schedules ?? null);
    }

    /* FIVE MACHINE DOCUMENTS, ONE PORT. D9's flow-calibration factor is a plain stepper
     * row in the registry, and the only reason it can be is that the field -> door split
     * lives below the model (`machine-fields-port.js`). The leaf model still sees
     * `{read, write}` and the renderer still has five archetype branches — which is what
     * let the doors go from two to five without a sixth branch anywhere. */
    /* SIX MACHINE DOCUMENTS NOW, and the sixth arrives half by socket. The tank's
     * low-water alert is written over `POST /machine/waterLevels` and read back only on
     * `/ws/v1/machine/waterLevels`, so the door takes the LIVE FEED as its read side —
     * see `waterLevelsDoorFor`. A boot with no live stores (a fixture, a test) simply has
     * no door, and the row falls back exactly as an unreachable machine does. */
    const machine = createMachineFieldsPort({
        settings: settingsPort,
        calibration,
        advanced: advancedPort,
        app,
        workflow: workflowDoorFor(workflow),
        machineInfo: machineInfoDoorFor(machineInfo),
        cupWarmer: cupWarmerDoorFor(cupWarmer),
        presence: presenceDoorFor(presence),
        waterLevels: waterLevelsDoorFor({
            feed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.WATER) : null,
            post: transport ? (body) => callRoute(transport, 'postMachineWaterLevels', { body }) : null,
        }),
    });

    /* THE PANEL DOOR — the TABLET's own settings, which are neither the machine's nor
     * this skin's.
     *
     * ONE ROW USES IT TODAY AND IT IS THE WAKE LOCK. `wakeLockEnabled` was a switch with no
     * reader anywhere in `src/` (see `live-stores.js` `setWakeLock`), so the page promised
     * to keep the screen on and the screen slept whenever the operating system said so. A
     * DOOR rather than a special case in the model, because the shape is the one this
     * codebase already uses for a setting whose value the server owns and whose write is a
     * command: `waterLevelsDoorFor` reads a live feed and writes a route, and this reads a
     * live feed and writes a socket command.
     *
     * THE READ IS `wakeLockOverride`, NOT `wakeLockEnabled`, and the difference is which
     * question the row asks. `wakeLockEnabled` is whether the lock is HELD, which
     * ReaPrime also sets for its own reasons — an awake machine holds one whatever this
     * skin asked for (`display_controller.dart` `_evaluateWakeLock`). `wakeLockOverride`
     * is whether THIS CLIENT asked for it, which is exactly what the switch means.
     *
     * A BOOLEAN OR NOTHING. `readFlag` answers `true`, `false` or a `noReading`, and only
     * the first two are answers — an unread feed returns `undefined` here so the row falls
     * back to the stored preference rather than to a fabricated `false`. */
    const displayFeed = typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.DISPLAY) : null;
    const panel = typeof boot.live?.setWakeLock === 'function'
        ? Object.freeze({
            setWakeLock: (on) => boot.live.setWakeLock(on),
            wakeLockOverride: () => {
                const held = displayFeed?.get?.()?.value?.wakeLockOverride;
                return typeof held === 'boolean' ? held : undefined;
            },
            setBrightness: (value) => boot.live.setBrightness(value),
            /* `brightness` IS WHAT THE PANEL IS AT, `requestedBrightness` IS WHAT IT WAS
             * ASKED FOR, and the first is preferred because the row states the screen and
             * not the request. Neither present means no frame yet, and the row falls back
             * to its stored key rather than to a fabricated number. */
            brightnessServed: () => {
                const frame = displayFeed?.get?.()?.value;
                if (Number.isFinite(frame?.brightness)) return frame.brightness;
                if (Number.isFinite(frame?.requestedBrightness)) return frame.requestedBrightness;
                return undefined;
            },
        })
        : null;

    const model = createSettingsLeafModel({
        settings,
        machine,
        limits,
        machineClass,
        panel,
        logger: boot.logger ?? undefined,
    });

    const capabilities = boot.capabilities ?? null;
    const bundle = Object.freeze({
        leaf: model,
        bespoke: Object.freeze({
            settings,
            machineInfo,
            led,
            calibration,
            skins,
            firmware,
            appInfo,
            app,
            workflow,
            presence,
            plugins,
            account,
            support,
            feedback,
            scaleConnect,
            machineState,
            cupWarmer,
            de1Settings,
            /* THE BESPOKE BUNDLE STILL GETS A TABLE, NOT THE FUNCTION. The model above
             * takes a function so its join re-reads the class-dependent steam row; the
             * bespoke leaves read `deps.limits.<key>` as an object at two call sites and
             * would break on a function. Resolved here, once per boot — the two surfaces
             * that use it (the load-cell keypad range, and the lighting page) read only
             * machine-INDEPENDENT keys, which are in the table whatever the class. */
            limits: typeof limits === 'function' ? limits() : limits,
            languages: AVAILABLE_LANGUAGES,
            defaultLanguage: DEFAULT_LANGUAGE,
            /* THE SCALE FEED, for the ONE bespoke surface that needs a live reading: the
             * load-cell walk's check step, where the whole question is whether the scale
             * reads what the user said the weight is (Ben, 26 Aug 2026).
             *
             * A FEED, NOT A VALUE. The leaf subscribes and throttles its own repaint, the
             * same way `<settings-leaf>` does for the steam temperature. A boot with no
             * live stores simply has no feed, and the check shows a dash — which is what a
             * page with no scale connected shows anyway. */
            scaleFeed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.SCALE) : null,
            /* THE MACHINE'S OWN STATE, for the two maintenance pages (27 August 2026).
             *
             * WHY A FEED AND NOT THE REQUEST STORE. `machineState` above records what this
             * skin ASKED FOR and what the route answered; its own header is emphatic that
             * "A 200 IS NOT A STATE CHANGE … nothing here reports the machine as awake".
             * So a page that pressed Start and then said "Descaling" off a 200 would be
             * asserting a state nobody has observed. The machine's own state arrives on
             * the snapshot feed like every other reading, and that is the only thing that
             * can say a descale or a purge is actually running.
             *
             * THREE SURFACES NEEDED IT AND NONE OF THEM COULD SEE IT. Descaling and
             * Transport Mode said nothing at all after Start — the store publishes SENDING
             * and SENT and the only reader of REQUEST_STATUS anywhere was the refusal
             * branch, two of five published statuses with no reader. Transport Mode also
             * has a PRECONDITION it could not check: a `needsWater` machine refuses the
             * purge outright (Slate's own comment calls it a firmware quirk), and this
             * skin's step 1 tells the user to empty the tank, which is how a machine
             * arrives at `needsWater`. And the completion sentence — the one a person
             * packing a machine actually needs — can only be said on the falling edge of
             * the state, which is a feed reading and nothing else.
             *
             * A boot with no live stores simply has no feed, and the pages fall back to
             * reporting the REQUEST alone: what was asked, and whether it was refused. */
            machineFeed: typeof boot.live?.feed === 'function' ? boot.live.feed(FEED.MACHINE) : null,
            /* THE PANEL, for the one control that commands the TABLET rather than the
             * machine. `/ws/v1/display` carries `setBrightness`, and until 26 August 2026
             * nothing in the skin sent it — the Brightness slider wrote a device-scoped
             * key with no reader and the panel never changed.
             *
             * A FUNCTION OVER THE LIVE STORES, not a second socket. Opening another
             * connection to the same path to send on would give the display two sockets
             * and two reconnect clocks; `live.setBrightness` sends on the channel the
             * display FEED is already attached to. A boot with no live stores has no
             * sender and the slider says so rather than appearing to work. */
            /* THE APP-UPDATE CHANNEL, AND IT IS THE SAME SHAPE AS `display` BELOW because
             * it is the same kind of thing: a live feed the leaf reads, plus the commands
             * that ride the socket that feed is already attached to. `/ws/v1/update` has
             * been attached on every boot since the live layer was written and its frames
             * were parsed and discarded — the reader is complete, and `FEED.UPDATE`
             * appeared nowhere outside `live-stores.js` and `feed-readers.js` until 27
             * August 2026. A boot with no live stores simply has no update block, and the
             * Decaid section draws its facts and no controls, which is exactly what a
             * tablet whose socket is down should look like. */
            appUpdate: typeof boot.live?.checkAppUpdate === 'function'
                ? Object.freeze({
                    feed: typeof boot.live.feed === 'function' ? boot.live.feed(FEED.UPDATE) : null,
                    check: () => boot.live.checkAppUpdate(),
                    install: () => boot.live.installAppUpdate(),
                })
                : null,
            display: typeof boot.live?.setBrightness === 'function'
                ? Object.freeze({
                    setBrightness: (value) => boot.live.setBrightness(value),
                    /* AND THE FEED, BECAUSE THE PANEL IS THE ONE WHO KNOWS. The slider read
                     * a stored `lastBrightness` and fell back to a typed 100 — an invented
                     * number for an unknown value, which is the one thing A7 forbids, and
                     * measurably wrong whenever ReaPrime's low-battery clamp is holding the
                     * panel at 20. `readDisplayFrame` has carried the answer all along and
                     * says so in its own comment: `brightness` is what is APPLIED,
                     * `requestedBrightness` is what was ASKED, and "the pair is why the skin
                     * does not need to remember what it sent". The dep was send-only, so the
                     * leaf had no way to read even though the feed was two lines away. */
                    feed: typeof boot.live.feed === 'function' ? boot.live.feed(FEED.DISPLAY) : null,
                })
                : null,
            /* WHAT THE MACHINE HOLDS FOR ONE FIELD, for the one bespoke surface that has
             * to report values it does not control: the reset page, which lists what is
             * about to move and what it will become (Ben, 26 Aug 2026).
             *
             * A FUNCTION OVER THE MODEL, not a second read. The model has already read the
             * machine document for whichever page opened it, and the reset page's job is
             * to REPORT those values rather than to fetch them again — two readers of one
             * document is how two pages come to disagree about one machine. */
            machineValue: (field) => model.machineValue(field),
            /* RE-READ THE MACHINE DOCUMENT, for the one surface that changes values it does
             * not itself write: the reset page, whose button moves eight fields at once.
             *
             * A FUNCTION OVER THE MODEL, like `machineValue` above and for the same reason.
             * The model holds the document; a second read here would be a second opinion
             * about what the machine holds, and this page's whole job is to report. */
            reloadMachine: () => model.loadMachine(),
            /* A3, ONE EXPRESSION. PRESENT is the only answer that opens a surface; ABSENT
             * and UNKNOWN both close it, and so does having no capability store at all. */
            allowed: (capability) => (
                typeof capabilities?.capability === 'function'
                    ? capabilities.capability(capability) === CAPABILITY.PRESENT
                    : false
            ),
            /* A3 IS ALSO AN EVENT, AND WITHOUT THIS THE GATE LATCHES. `allowed()` answers
             * "may I render" at the moment it is asked, and the capability read is
             * ASYNCHRONOUS — a leaf mounted while `/machine/capabilities` is still in
             * flight (or failing, which is the mock's own behaviour) asks once, is told
             * no, and would never ask again: `deps` is memoised per boot, so nothing about
             * this bundle ever changes identity and no property update follows the answer
             * landing. The subscription is the missing edge. It carries NO capability data
             * — the listener is told only that the answer may have moved, and asks
             * `allowed()` again — so A3 still has exactly one expression.
             *
             * Returns an unsubscribe, always, so a caller needs no branch of its own. */
            watchAllowed: (listener) => (
                typeof capabilities?.subscribe === 'function'
                    ? capabilities.subscribe(listener)
                    : () => {}
            ),
            /* WHICH MACHINE THIS IS, for the one bespoke surface that names OTHER PAGES.
             *
             * `<settings-screen>` has read this since the flow-multiplier leaf was gated
             * (`#machineClass`), and the bespoke half could not: it renders under the
             * screen rather than inside it, so the screen's own getter is out of reach.
             *
             * THE DEFAULT LOAD SETTINGS PAGE IS WHY IT IS NEEDED. Its Page column is derived
             * — each reset field is matched to the registry row that carries it, and the
             * page is that row's leaf — and `leafFor()` searches the whole tree with no
             * machine filter. On a Bengle that printed "Flow Multiplier", a leaf gated
             * `machines: ['de1']` and therefore absent from that machine's nav: a reset page
             * telling you to go and look at a page you cannot open.
             *
             * SAME EXPRESSION AS THE SCREEN'S, and null while the capability read is in
             * flight — `leafShownOn` treats an unknown class as "show everything", so a slow
             * read never hides a page that belongs there. */
            machineClass: () => (
                typeof capabilities?.machineClass === 'function'
                    ? capabilities.machineClass()
                    : null
            ),
        }),
    });
    MODELS.set(boot, bundle);
    return bundle;
}
