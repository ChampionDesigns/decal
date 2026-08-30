/**
 * app-boot.js — the boot sequence, assembled, with no DOM in it.
 *
 * WHAT THE SHELL HAS TO DO ONCE, IN ORDER, AND NOWHERE ELSE:
 *
 *   1. build the transport and the socket layer from ONE reading of where we are;
 *   2. build the live stores over them and OPEN them (`attachAll()` — subscribing is
 *      what opens a socket, the socket layer's rule E, so this is the moment the app
 *      starts talking to ReaPrime and it is an explicit act);
 *   3. ask for the capability set and the machine info, and let the answers be late — and
 *      go on asking: both are answers ABOUT A MACHINE, so a connect or a swap re-asks
 *      them and a departure forgets them (`watchConnection`);
 *   4. load the screen module the route names, so `<app-root>` has something to mount.
 *
 * ONE ASSEMBLY FUNCTION, NOT MODULE SINGLETONS — the rule `live-stores.js:7-12` states
 * and this file obeys one level up: "the app shell calls this once and passes the result
 * down; a test calls it with fakes". Seven module-level instances would make the sharing
 * depend on ES-module singleton semantics again, and nothing could be built twice in one
 * process, which is the property every test in this tree relies on.
 *
 * EVERY DEPENDENCY IS INJECTED, INCLUDING WHERE WE ARE. No `window`, no `globalThis.fetch`,
 * no `WebSocket`, no `Date.now` a test cannot move. `rea-transport.js:56-58` names the one
 * file allowed to read ambient state — "the app shell reads `window.location` once, at
 * startup, in a file that is allowed to" — and that file is `src/components/app-root.js`,
 * not this one. So this module runs under `node:test` against fakes, which is how the boot
 * SEQUENCE is tested at all rather than only its rendered result.
 *
 * THE SCREEN IS NEVER HELD HOSTAGE BY THE SERVER. `start()` reaches `ready` when the
 * screen module has loaded — not when the capability read has answered and not when a
 * machine has connected. Three reasons, all of them the spec's:
 *
 *   - the capability read can take the transport's full 10 s deadline against a machine
 *     that is off, and ten seconds of "Connecting…" in front of a screen that would
 *     render perfectly is a self-inflicted outage;
 *   - the capability store is FAIL-CLOSED by construction (`offers()` is true only for
 *     PRESENT, `capabilities-store.js:30-45`), so a screen rendered before the answer
 *     arrives hides gated hardware rather than inventing it;
 *   - the connection states — "still trying", "failed", "two machines, pick one" (B8) —
 *     have to be RENDERED SOMEWHERE, and that somewhere is the Live screen. A shell that
 *     waits for a connection before mounting the screen is a shell in which the
 *     disconnected states can never be seen at all.
 *
 * So `phase: 'error'` here means the SHELL could not start — the screen module would not
 * load. A machine that is not there is not a boot error; it is Live's subject matter.
 *
 * WHAT THE BOOT DOES NOT DO. It does not name an endpoint, build a path, or read a
 * ReaPrime field name: the capability read goes through `createReaRoutes`'s helper and
 * the six feeds through `WS_CHANNELS`, so every route string in this screen's boot still
 * lives in exactly one table (Gate D). And it wires no R-item: the R3 capability gates —
 * GHC included — are read off `capabilities` by the components that gate on them, through
 * `adapters-r.js`, which is `live-capability-gates-ghc`'s work and not the shell's.
 */

import { createReaTransport, reaBaseUrl, reaSocketBase } from '../data/rea-transport.js';
import { createReaRoutes } from '../data/rea-routes.js';
import { createReaSockets } from '../data/rea-sockets.js';
import { createDevicesLink } from '../data/rea-devices.js';
import { createLiveStores, FEED } from '../stores/live-stores.js';
import { createWeatherStore } from '../stores/weather-store.js';
import { createCapabilitiesStore } from '../stores/capabilities-store.js';
import { createMachineInfoStore } from '../stores/machine-info-store.js';
import { createWorkflowStore } from '../stores/workflow-store.js';
import { createMachineStateStore } from '../stores/machine-state-store.js';
import { createProfileArmStore } from '../stores/profile-arm-store.js';
import { createProfileEditorStore, SAVE_STATUS } from '../stores/profile-editor-store.js';
import { createProfileLibraryStore } from '../stores/profile-library-store.js';
import { createScaleTareStore } from '../stores/scale-tare-store.js';
import { createShotsStore } from '../stores/shots-store.js';
import { createPluginsStore } from '../stores/plugins-store.js';
import { createSettingsStore } from '../stores/settings-store.js';
import { createCupWarmerStore } from '../stores/cup-warmer.js';
import { createAppSettingsStore } from '../stores/app-settings-store.js';
import { createStore } from '../stores/store.js';
import { createReaKvBackend } from '../data/rea-kv-backend.js';
import { createStorageRouter } from './storage-router.js';
import { createMemoryBackend, createWebStorageBackend } from './storage-backends.js';
import { LAYERS, KV_NAMESPACES, STORAGE_PREFIX } from './storage-routes.js';
import { ROUTES, DEFAULT_ROUTE_ID, assertRouteTable, resolveRoute, hashFor } from './app-routes.js';

/** Where the shell is in its own life. Rendered by `<app-root>`, asserted by the suites. */
/**
 * How many stored-shot rows the shell asks for on boot.
 *
 * IT WAS ONE, and the note here said why: "the Live page wants exactly one thing from
 * the list — the newest shot's id", and `total` answers "how many are there" whatever
 * the limit is (`shots_handler.dart` :136 echoes the count independently of the clamped
 * page). That was true until Ben asked for the band to page, 23 Aug 2026: "The history
 * pannel part on the left needs left and right arrows to allow navigating between old
 * shots in the history, this should update the chart etc."
 *
 * TWENTY-FIVE, and the number is the arrows' reach rather than a guess. A page is what
 * prev/next can walk without a second read; beyond it the band stops rather than
 * fetching, which is a stated limit and not a silent one (the History screen builds its
 * own pager on the same store for the whole archive). The rows are LIST rows — id,
 * timestamp, profile title, annotations — not the 221 KB records; a record is fetched
 * one at a time, by `loadShot`, only when the arrows land on it.
 */
const SHOTS_PAGE = 25;

export const BOOT_PHASE = Object.freeze({
    /** Built, nothing opened. Nothing in this layer starts itself. */
    IDLE: 'idle',
    /** `start()` is running: stores opening, capabilities asked, screen module loading. */
    CONNECTING: 'connecting',
    /** The screen module is loaded and the shell can mount it. */
    READY: 'ready',
    /** The SHELL failed — not the machine. See the header. */
    ERROR: 'error',
});

/** Which of the four steps is in flight, for a surface that wants to say more than
 *  "connecting" and for a report that wants to say where a boot stopped. */
export const BOOT_STEP = Object.freeze({
    STORES: 'stores',
    CAPABILITIES: 'capabilities',
    SCREEN: 'screen',
    DONE: null,
});

/**
 * @param {object} deps
 * @param {Function} deps.fetch            injected; never `globalThis.fetch`
 * @param {(url: string) => object} deps.createSocket  injected socket factory
 *        (`reconnectingSocketFactory()` in the app, a fake in a test)
 * @param {{hostname: string, protocol?: string, port?: number|string}} deps.location
 *        read ONCE by the caller from `window.location`
 * @param {(specifier: string) => Promise<unknown>} [deps.importModule]
 *        how a screen module is loaded. Injected so the sequence is testable under node,
 *        where a bare `src/...` specifier has no importmap to resolve it.
 * @param {object} [deps.routes]           the route table (`app-routes.js`)
 * @param {string} [deps.route]            the id to boot into
 * @param {object} [deps.logger]
 * @param {() => number} [deps.clock]
 * @param {number} [deps.timeoutMs]
 * @param {object} [deps.backends]        storage backends by layer, MERGED OVER the ones
 *        built here. A caller with a Window injects `{local, session}`; nothing else in
 *        the tree may reach for one.
 * @param {string|null} [deps.proxyToken] the bearer ReaPrime injects into every served
 *        skin page, read ONCE from `window.__REA_PROXY_TOKEN__` by `bootFromWindow`.
 *        See the field's own note on the boot object below.
 */
export function createAppBoot({
    fetch: fetchImpl,
    createSocket,
    location,
    importModule = (specifier) => import(specifier),
    routes: routeTable = ROUTES,
    route: initialRouteId = DEFAULT_ROUTE_ID,
    logger = null,
    clock = () => Date.now(),
    timeoutMs = undefined,
    backends = null,
    proxyToken = null,
} = {}) {
    assertRouteTable(routeTable);
    const log = logger && logger.scope ? logger.scope('boot') : logger;
    const note = (level, message) => {
        if (log && log[level]) log[level](message);
    };

    /* ONE reading of where we are, turned into the two origins. Both are pure functions
     * of the object the caller passed; nothing below ever looks at ambient state again. */
    const transport = createReaTransport({
        fetch: fetchImpl,
        baseUrl: reaBaseUrl(location),
        socketBaseUrl: reaSocketBase(location),
        logger,
        ...(timeoutMs === undefined ? null : { timeoutMs }),
    });
    const api = createReaRoutes(transport);
    const sockets = createReaSockets({ createSocket, socketBaseUrl: reaSocketBase(location), logger });
    /* The B8 answer path and the connection feed are the SAME socket, not two:
     * `createLiveStores` attaches the connection feed to `devicesLink.channel` when a
     * link is injected (`live-stores.js:212-214`). */
    const devices = createDevicesLink({ sockets, transport, logger });
    const live = createLiveStores({ sockets, devicesLink: devices, clock, logger });
    const capabilities = createCapabilitiesStore({ routes: api, logger, now: clock });
    /* THE WEATHER PLUGIN'S FEED, attached here because socket assembly is the shell's
     * job. It dials a BOUNDED number of times: a machine without `weather.reaplugin`
     * gets a 404 before the upgrade, so an unbounded reconnecting client would dial it
     * for ever (`rea-ws-channels.js` states that rule for every plugin endpoint). The
     * corner is simply absent on such a machine. */
    const weather = createWeatherStore({ sockets, logger });
    /* THE TWO STORES THE LIVE SCREEN'S GATES AND REFUSAL SURFACE NEED, assembled here
     * because store assembly is the shell's job and nothing else in the tree may own a
     * route. Both are one store, one route:
     *
     *   machineInfo  GET /api/v1/machine/info. The capability store refuses to fetch this
     *                ("one store, one route") and both R3 gates answer from it, so without
     *                an owner `groupHeadController()` and `profileModes()` were pinned at
     *                `unknown` for ever — including the GHC strip, which is the spec's own
     *                named example (`live-capability-gates-ghc`).
     *   arm          POST /api/v1/machine/profile. B9's v1 half: the arm-time 400 is the
     *                refusal the picker surfaces, and it needs no upstream work.
     *                REACHABILITY, SAID PLAINLY: `profile-library-store.js` calls
     *                `arm.arm(record.profile, {profileId})` (wave 5.3) — so the store, the
     *                refusal surface and the dismiss are wired AND the trigger is too, and
     *                B9 ships whole: pick a profile in the selector, press Confirm, and a
     *                typed 400 renders at the point of picking. The selector's own store is
     *                the ONE caller — the profile BODY belongs to the store that owns the
     *                listing — and `test/live-connection-gates.test.mjs` ("B9's trigger")
     *                walks `src/` and fails if a second one appears or the first goes away.
     *                WHAT IS STILL NOT A TRIGGER: `<live-screen>.favourites` is never
     *                populated and `favourite-select` has no listener, so the Live screen
     *                cannot arm anything.
     *
     * The R3 ADAPTERS ARE STILL NOT WIRED HERE. This shell feeds `applyMachineInfo` a body
     * and stops; which key means what is `adapters-r.js`'s, and reading the gate is the
     * screen's. */
    const machineInfo = createMachineInfoStore({ transport, logger, now: clock });

    /* THE RAIL'S OWN DOCUMENT. `<live-screen>` is handed `targets` from here — the ten
     * numbers the Live rail steps live on ONE document and it is the workflow, not
     * `/machine/settings` (wave 2's review found `steamDuration` workflow-side and asked;
     * DQ-707 is Ben's answer). Created beside `machineInfo` because it has the same
     * lifetime and the same trigger: a machine arriving is what makes it worth reading,
     * and a machine leaving is what makes the answer a lie. */
    const workflow = createWorkflowStore({ transport, logger, now: clock });
    /* REAPRIME'S OWN PREFERENCES, HOISTED INTO THE SHELL ON 27 AUGUST 2026 — and hoisted
     * for exactly the reason `machineState` and the cup warmer were hoisted before it.
     *
     * `app-settings-store.js` has existed since the settings pages were built and had ONE
     * constructor, inside `settings-model.js`. That was correct while one screen read the
     * document. It stopped being correct when the Live rail needed `stopHotWaterAtWeight`:
     * that field decides whether a hot-water pour ends on millilitres or on the scale, so
     * it is what the rail's stop caption SAYS and what the unit beside its number MEANS —
     * and until now the rail read a KV copy of its own instead, which is B7's "never two
     * stores for one value" with the two stores one level down.
     *
     * ONE INSTANCE, IN THE SHELL, and the settings screen takes it rather than building a
     * second — the same handover `settings-model.js` already performs for the machine-state
     * store, whose own note explains what two instances cost: "two records of what did we
     * last ask the machine for, and the leaf reads only its own".
     *
     * IT IS NOT MACHINE-GATED. `GET /api/v1/settings` is ReaPrime's own document, not
     * `withDe1`'s, so it answers whether or not a machine is connected — which is why it is
     * read once at start and does NOT ride `machineChanged` beside the workflow. */
    const appSettings = createAppSettingsStore({ transport, logger });
    const arm = createProfileArmStore({ transport, logger, now: clock });
    /* THE WAKE. `<ui-screensaver>` reports the intent and the shell asks; see the store. */
    const machineState = createMachineStateStore({ transport, logger, now: clock });

    /* THE PROFILE EDITOR'S STORE, ASSEMBLED HERE BECAUSE TWO SCREENS TOUCH ONE RECORD
     * (fix run 4, finding `dec-A-B-1`).
     *
     * B10/B11's save path shipped complete and unreachable: `createProfileEditorStore` had
     * no caller anywhere outside `test/`, and the `editor-commit` event `<editor-screen>`
     * dispatches "so the composition root above has one place to listen" had no listener in
     * `src/` at all. The only composition root in the tree was the ten-line one inside
     * `test/harness/editor.js`, which is why the editor route mounted a screen that could
     * never reach `saveAsNewVersion`, `saveMetadata` or `saveInPlace`.
     *
     * IT LIVES IN THE SHELL RATHER THAN IN THE EDITOR SCREEN, and the reason is the same
     * one this file gives for `arm` two lines up: the handoff has two ends. The SELECTOR
     * seats the record (`profileEditor.open(record)`) at the moment the user picks Edit,
     * and the EDITOR reads it back after the route swap — and a route swap destroys the
     * outgoing screen, so a store built inside either screen could not survive the trip.
     * Store assembly is the shell's job; screens take what they are given.
     *
     * ONE STORE, ONE ROUTE, on this side of the line too: everything about a path,
     * a body and a refusal is `profile-editor-store.js`'s, and nothing here names one. */
    const profileEditor = createProfileEditorStore({ transport, logger, now: clock });

    /* THE STORAGE ROUTER, ASSEMBLED HERE FOR THE SAME REASON THE STORES ARE (wave 5.3).
     *
     * `storage-routes.js` is B7's "one owner per setting" table and `createStorageRouter`
     * is the only thing allowed to resolve a logical key to a physical one. Until tonight
     * nothing built one for the APP: `<app-root>` builds a local-backed router for the
     * theme and keeps it private ("a test injecting one brings its own root and its own
     * storage"), and `units.js` takes one by injection from a caller that did not exist.
     * The selector's favourite rail is the first shipping consumer of a `kv` row
     * (`favouriteProfiles`, machine-scoped, and `favouriteProfilesSeeded` beside it), and
     * a screen may not build a router — that is store assembly, and store assembly is the
     * shell's job.
     *
     * THE KV LAYERS ARE REAL AND THE BROWSER LAYERS ARE MEMORY. `createReaKvBackend` needs
     * exactly what this function already holds — the injected `fetch` and the API base off
     * the one reading of where we are — so the machine-scoped rows land on ReaPrime, which
     * is where they belong and where the old skin already put them. `local` and `session`
     * are DEVICE-scoped and need a Window this function deliberately never touches
     * (`bootFromWindow` is the only reader of ambient state); a caller that has one injects
     * `backends`, and everything else gets memory rather than a throw.
     *
     * THE MEMORY DEFAULT IS A FALLBACK, NOT THE SHIPPING PATH, AND THAT DISTINCTION WAS
     * ONCE LOST HERE. This comment used to end "No row this build ships reads a `local`
     * key through this router ... so the memory layer is honest rather than a silent data
     * loss". The screen-saver rows then shipped, all of them `layer: local`, and the
     * sentence stopped being true without anything failing: a write to memory answers ok,
     * the saver changes, and the value is gone at the next load. `bootFromWindow` now
     * injects real browser backends, which is why it must stay the one reader of ambient
     * state. A caller with no Window still gets memory here, deliberately.
     */
    /* NOT CONCATENATED AT ALL ANY MORE, AND THAT WAS A REAL BUG (found parity
     * 7-live-polish).
     *
     * This line read `reaBaseUrl(location) + DEFAULT_API_BASE`, and `reaBaseUrl` ALREADY
     * ends in `API_PREFIX` — its own contract says so ("e.g. 'http://machine:3000/api/v1'"
     * is the example on `createReaKvBackend`'s `baseUrl`). So every KV read and write the
     * app made went to `…/api/v1/api/v1/store/<ns>/<key>`: the favourites rail's five
     * slots, its seeded marker, and every numpad row. It survived since wave 5.3 because
     * nothing exercised the URL end to end — the selector's own suites inject memory
     * backends, and no test asserted the PATH — and it became visible the moment the
     * profile library store moved onto the boot path and the shell suite recorded the
     * calls it makes. Measured, not reasoned: the recorded call was
     * `/api/v1/api/v1/store/decal/favouriteProfiles`.
     *
     * The base is now the one `reaBaseUrl` returns and nothing is spelled here, which is
     * also what keeps Gate D's `collectConstructedPaths` quiet: this file is not a
     * declared route builder and must not become one. */
    const kvBase = reaBaseUrl(location);
    const storage = createStorageRouter({
        backends: {
            [LAYERS.kv]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kv], fetch: fetchImpl, baseUrl: kvBase, logger,
            }),
            [LAYERS.kvNumpad]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kvNumpad], fetch: fetchImpl, baseUrl: kvBase, logger,
            }),
            [LAYERS.local]: createMemoryBackend(),
            [LAYERS.session]: createMemoryBackend(),
            ...(backends || null),
        },
        /* `createStorageRouter` defaults its logger to a no-op and a null would defeat
         * the default — every other factory in this file takes null happily, so the
         * spread keeps the one that does not from being the odd caller. */
        ...(logger ? { logger } : null),
    });

    /* ===========================================================================
     * THE THREE STORES THE LIVE PAGE'S COMPOSITION NEEDS (parity 7-live-polish)
     * ===========================================================================
     * Ben's 22 Aug ruling turns three of the Live page's boxes from structure into
     * data: the favourites rail shows PROFILE NAMES, the chart card carries the
     * loaded profile's name and dose, and the chart and the foot band are about the
     * LAST SHOT. DQ-1-D recorded the gap in those words — "profileName + favourites
     * have NO OWNER" — and it is P-1's shape twice more: a declared property of
     * `<live-screen>` that nothing under src/ ever wrote.
     *
     *   library   the profile listing plus the five KV favourite slots. It already
     *             answers exactly what `<ui-favourites-bank>` takes
     *             (`favouriteEntries()`, five entries, null for empty) and the
     *             SELECTOR already binds that same call, so this is a second reader
     *             of one store rather than a second answer to one question.
     *   shots     the newest stored shot, and its gate-6 derivation. `history-screen`
     *             built its own and said why — "there is no second screen reading
     *             shots, so hoisting it into app-boot would put a store in the shell
     *             only one screen uses". There is a second screen now, so the store
     *             is hoisted and both screens take it from the shell. Store assembly
     *             is the shell's job.
     *   cupWarmer the mat's on/off state and its setpoint. Slate's header carries the
     *             control — ORACLE live-ready #cupwarmer-toggle-btn [i=9] rect
     *             [1293,18,104,82], a tall button reading "Warmer" over "ON" — and
     *             Decal's header had no such button and no reader for the store,
     *             which had been written whole (`src/stores/cup-warmer.js`, its own
     *             suite green) and never called from anywhere under src/. Same shape
     *             as the two above: a finished half with no other half.
     *
     * IT IS THE ONE OF THE THREE THAT MAY ANSWER "NOT AT THIS PIN", and the header is
     * built for that: `tools/mock_rea.py` answers `machine/cupWarmer` **410 with an
     * explicit body**, deliberately, because the committed recording still carries the
     * `prewarm*` keys CB-18/CB-19 retired and "a fixture edited to pass a check has
     * stopped being a recording". So against the mock this store lands in ERROR with
     * `warmer: null` and the button renders its state line as the dash — present, and
     * honest about having no reading (A7). Against a machine that serves the route it
     * reads ON or OFF. Neither case invents a state, and the 404 case (the capability
     * gate's own answer) is the one that HIDES the control, per the contract row.
     *
     * THE PROFILE NAME IS NOT HERE, deliberately: it is on the workflow document the
     * rail already runs on (`workflow.profile.title`), so `<live-screen>` reads it
     * from the store that already owns it. One number, one owner (P-1).
     */
    const scaleTare = createScaleTareStore({
        transport,
        scale: live.feed(FEED.SCALE),
        logger: note ? logger : null,
    });

    const library = createProfileLibraryStore({
        transport, storage, arm, workflow, logger, now: clock,
    });

    /* =======================================================================
     * A SAVE MOVES WHICH RECORD IS "THE ONE" — Ben, 27 August 2026
     * =======================================================================
     *
     * "the profile editor, the save button doesn't seem to be doing anything. I can make a
     * change, hit save exit and go back into the editor and it dosn't seem to have the
     * change."
     *
     * THE SAVE WAS WORKING. Measured end to end through the real shell against a server
     * that stores what it is sent: open "7g basket" (temperature 90), press the matrix's
     * own + once (90 -> 90.5, the band reads "Save (1)"), press Save. One POST
     * /api/v1/profiles goes out carrying temperature 90.5, ReaPrime answers 201 with a NEW
     * record whose parentId is the record the editor opened from, the toast says "Saved.
     * The previous version is kept", and the editor re-seats the saved record. Every one
     * of those is correct and every one of them is DQ-629 working as Ben decided it:
     * "KEEP saveAsNewVersion", so editing never overwrites the version you started from.
     *
     * WHAT NOBODY DID WAS TELL THE REST OF THE APP. The library's listing was read before
     * the save and never re-read, and `selectedId` still named the PARENT. So leaving the
     * editor and pressing Edit again re-seated the parent — temperature back at 90, the
     * work apparently gone. Measured, same run: after the save the listing went 147 -> 148
     * records with the saved one in it, and `selectedId` was still the parent's id.
     *
     * A SAVE THAT CREATES A NEW RECORD IS ONLY HALF AN OPERATION. The other half is that
     * the new record is now the one the person is working on. Nothing owned that half:
     * `<editor-screen>` holds a draft and dispatches events, `profile-editor-store.js` is
     * "the one door to the profile ROUTES" and deliberately knows nothing about a listing,
     * and `profile-library-store.js` owns the listing and the selection and has no idea a
     * save happened. Two correct halves and no seam between them.
     *
     * IT IS THE SHELL'S SEAM, for the reason this file gives for building `profileEditor`
     * here at all: the handoff has two ends and store assembly is the shell's job. Neither
     * store may import the other — that would put the listing inside the editor's door, or
     * a save route inside the library — so the wiring is one subscription, here, where both
     * objects already exist.
     *
     * RE-READ FIRST, THEN SELECT, AND ONLY IF THE RECORD IS REALLY THERE.
     *
     *   * The re-read is the house idiom, not a new one: `hide`, `restore`, `purge` and
     *     `assign` in the library store all end in `await api.load()`. The transport sends
     *     If-None-Match, so a listing that has not moved costs a 304.
     *   * Selecting BEFORE the re-read would point the selection at an id the listing does
     *     not carry yet, and `selected()` answers null for that — a blank detail pane for
     *     as long as the read takes.
     *   * Selecting an id the re-read did NOT bring back would be worse than doing nothing:
     *     app-root's Edit is "NO RECORD, NO ROUTE", so the button would go completely dead
     *     rather than open the previous version. If the listing cannot see the saved
     *     record, the honest thing is to say so in the log and leave the selection alone.
     *
     * ONLY ON THE EDGE INTO `saved`, AND ONLY WHEN THE ID ACTUALLY MOVED. `subscribe`
     * replays the current state synchronously (store.js: "replaying it to late
     * subscribers"), and every later publish — SAVING, the re-seat, a `clearSave` — carries
     * the same `save` value or the same record. `seen` is primed from the state as it is
     * right now so the replay is not mistaken for an event, and the id comparison means a
     * metadata save that ReaPrime answered id-stably (PUT /profiles/{id}, the rename path)
     * asks for nothing: the record the library already has IS the saved one.
     *
     * AND SINCE 27 AUGUST 2026 IT ARMS THE SAVE — BUT ONLY WHEN THE MACHINE WAS ALREADY
     * HOLDING WHAT WAS EDITED.
     *
     * The paragraph that stood here said the opposite, and it was wrong in practice. It
     * argued that arming is B9's route and B9 has exactly one caller by design, so a save
     * must not move `loaded`. Every clause of that is true and the conclusion still cost
     * Ben his work, because of what it left standing: `<app-root>` resolves the Live
     * band's "Edit profile" through `loaded` — the profile the MACHINE is holding — and a
     * save deliberately did not move it. So the loop was:
     *
     *   Edit profile (Live)  -> opens the armed record
     *   change, Save         -> a NEW record is written, correctly, as its child
     *   Edit profile (Live)  -> opens the armed record AGAIN, unchanged
     *
     * DRIVEN ON BEN'S TABLET, 27 August 2026, over ADB: one press of a temperature step
     * took 85.0 to 85.5, Save wrote `profile:4357388e…` at 85.5 and the listing went
     * 101 -> 102 records. Three of the five visible "Pressure Tuning" rows shared ONE
     * parent, `profile:ea352e2e…`, which is the record the machine was holding — the
     * versions were SIBLINGS off a fixed point rather than a chain, because every edit
     * started from the same place. His words: "I can make a change, hit save exit and go
     * back into the editor and it dosn't seem to have the change." Nothing was lost; every
     * version was in the library, and the editor kept re-opening the ancestor.
     *
     * BEN'S RULING, 27 August 2026, asked as a straight question and answered "yes": after
     * you save an edit to the armed profile, the machine should be armed with the new
     * version — so what you pull matches what you edited.
     *
     * IT ARMS EVERY SAVE, AND THAT IS BEN'S SECOND RULING RATHER THAN AN OVERSIGHT.
     *
     * The first version of this guarded the arm: it fired only when the record the editor
     * was seated on WAS the one the machine was holding. The reasoning was that arming
     * every save lets an edit to some unrelated profile change what the machine will brew
     * next, which is a side effect nobody asked for.
     *
     * TWO THINGS RETIRED IT. Ben asked for the plain rule in plain words — 27 August 2026,
     * "pressing save should close and arm, I shouldn't need to press save twice" — and the
     * guard could not answer its own question on his machine anyway. It compared against
     * `loaded.id`, and `loaded` is resolved by MATCHING THE WORKFLOW'S PROFILE TITLE
     * against the listing, because the workflow document carries no record id
     * (`adapters-r.js r1LoadedProfileId`). His bench has FIVE visible records titled
     * "Pressure Tuning" — R1 answers `ambiguous`, `loaded.id` comes back null, and a guard
     * whose premise is null refuses every time. So the guard's failure mode was silence:
     * exactly the "I saved and nothing happened" it was sitting inside.
     *
     * That is written up for upstream as the fifth ask — put the record id in the workflow
     * document — and this rule needs no premise at all, which is the better reason to
     * prefer it. A save is a deliberate act on a profile; arming what you just saved is
     * what the person who pressed it meant.
     *
     * `library.arm` REMAINS THE ONE CALLER OF B9's ROUTE. This does not open a second path
     * to the machine — it calls the same operation the selector calls, which arms and then
     * writes the workflow document, and which refuses and reports exactly as it does there.
     * ======================================================================= */
    let seenSave = profileEditor.get().save;
    const unwatchEditorSave = profileEditor.subscribe((state) => {
        const status = state ? state.save : null;
        const wasSave = seenSave;
        seenSave = status;
        /* THE EDGE INTO `saved` IS THE TRIGGER, and it is the whole guard. Every save
         * patches `SAVING` before it calls the route (`profile-editor-store.js`), so this
         * edge fires exactly once per save and cannot fire twice for one. It also cannot
         * fire for something that is NOT a save: `open()` seats a record without touching
         * `save`, so opening a second profile while the last save is still reported
         * publishes SAVED after SAVED — no edge, no re-read, no selection stolen from
         * whatever the user just picked. An id comparison here instead would have been
         * wrong in both directions: it would miss an id-STABLE save (a rename PUTs the
         * same record, and the listing's copy of its title is then stale) and it would
         * re-fire on an ordinary open. */
        if (status !== SAVE_STATUS.SAVED || wasSave === SAVE_STATUS.SAVED) return;
        const savedId = state.record && typeof state.record === 'object'
            ? state.record.id ?? null : null;
        if (savedId) adoptSavedProfile(savedId);
    });

    /** The half above, performed. Separate so the subscription stays a decision. */
    async function adoptSavedProfile(savedId) {
        try {
            /* THE RE-READ HAPPENS EVEN WHEN THE ID DID NOT MOVE. A rename is
             * `PUT /profiles/{id}` carrying the served content with one string changed, so
             * ReaPrime updates the record in place and the id comes back unchanged — and
             * the listing this app is holding still has the OLD TITLE on it. Skipping the
             * read for "the selection is already right" would leave the selector showing
             * the name the user had just changed. */
            await library.refresh();

            const saved = library.recordFor(savedId);

            if (library.get().selectedId !== savedId && saved) {
                library.select(savedId);
                note('info', `profile editor: the save is now the selected record (${savedId})`);
            }

            if (saved) {
                /* THE FAVOURITE RAIL FOLLOWS THE SAVE TOO.
                 *
                 * Ben, 27 August 2026: "favourite should show the most recent version so I
                 * think do it as you suggest, follow the save."
                 *
                 * A slot stores a RECORD ID, and an id is a content hash, so every content
                 * save mints a new one and the slot went on pointing at the version it was
                 * assigned. Read off his bench before this: slot 4 held
                 * `profile:0546347d…`, two versions behind AND hidden — hidden because
                 * `settleToOneRow` retires a superseded parent, which is the fix that gives
                 * him one row per profile. So the rail drew "Pressure Tuning" and would
                 * have armed 85.0 while the machine and the editor were both on 86.0. It
                 * looked right, which is the worst way for it to be wrong.
                 *
                 * A FAVOURITE MEANS "THIS PROFILE", NOT "THIS VERSION OF IT" — that is the
                 * whole of the argument. Version history is where a particular version is
                 * kept and it is reachable from the editor; a slot that silently points at
                 * a record deliberately removed from the listing is not a snapshot, it is a
                 * trap.
                 *
                 * THE DIRECT PARENT IS ENOUGH FOR THE ORDINARY SAVE, and deliberately so.
                 * The slot is carried forward on every save, so a chain is walked one link
                 * at a time and never needs a search. A save that branches from something
                 * the rail does not hold moves nothing, which is right: that slot is still
                 * pointing at the profile its owner put there.
                 *
                 * -------------------------------------------------------------------
                 * AND IT IS NOT ENOUGH FOR EVERY SAVE. THE HOLE, AND WHAT CLOSED IT.
                 * -------------------------------------------------------------------
                 * Measured on Ben's tablet, 28 August 2026: slot 0 held
                 * `profile:fa35f1ee…`, hidden, with no children — stranded by a save that
                 * this very line watched go past.
                 *
                 * The rule above walks DOWNWARD: parent to child. A save can also resolve
                 * UPWARD, and `settleToOneRow` says so in its own header —
                 * `ProfileController.create` is content-addressed and idempotent, so
                 * saving content the server already holds returns the EXISTING record
                 * instead of storing a new one. Undo an edit and save, and the content
                 * hashes back to the record you started from: the settle un-hides that
                 * ANCESTOR and hides the record the editor was seated on.
                 *
                 * That is what happened. `saved` came back as `profile:f239e4b0…`, whose
                 * `parentId` is `profile:79661405…` — the GRANDPARENT of the record in the
                 * slot. `favouriteSlotHolding` was asked about the grandparent, no slot
                 * held it, nothing moved, and slot 0 was left naming the record the same
                 * save had just hidden. The follow-through did not fail; it was asked the
                 * wrong question.
                 *
                 * SO THE SECOND PASS ASKS THE QUESTION THAT HAS NO DIRECTION IN IT.
                 * `library.healFavourites()` states rule 6 over the freshly re-read
                 * listing — "does any slot name a record the library is hiding, and what
                 * is that profile's living row?" — and answers it by walking down for a
                 * superseded record and up for a dead-end one. It subsumes the forward
                 * case (a hidden parent's newest visible descendant IS the saved record),
                 * so the two agree wherever both apply.
                 *
                 * THE FORWARD PASS IS KEPT ANYWAY, and not out of caution. It is the one
                 * that fires when the parent is still VISIBLE, which is a real and
                 * deliberate state: `settleToOneRow` refuses to hide an `isDefault`
                 * parent, so editing a bundled profile leaves the template on the list.
                 * Rule 6 correctly leaves a visible id alone, and this line correctly
                 * carries the slot to the version just saved. They cover different halves
                 * of Ben's 27 August ruling and neither is the other.
                 *
                 * ORDER IS FORWARD FIRST. The forward pass writes the saved id, which is
                 * visible by construction — `settleToOneRow` makes the saved record
                 * visible BEFORE it hides anything — so the heal that follows sees a
                 * visible id and leaves it. Healing first would reach the same rail; there
                 * would simply be nothing left for the forward pass to do. */
                const slot = library.favouriteSlotHolding(saved.parentId ?? null);
                if (slot !== null) {
                    await library.setFavourite(slot, savedId);
                    note('info', `profile editor: favourite slot ${slot} follows the save `
                        + `(${saved.parentId} -> ${savedId})`);
                }

                /* THE BACKWARD AND HISTORIC CASES, in one call over the whole rail. It
                 * writes only when something actually moved, so an ordinary save that
                 * stranded nothing costs no request at all. */
                const healed = await library.healFavourites();
                for (const change of healed) {
                    note('info', `profile editor: favourite slot ${change.slot} pointed at `
                        + `hidden ${change.from} — healed to ${change.to} (${change.basis})`);
                }

                /* ARM IT. Ben, 27 August 2026: "pressing save should close and arm, I
                 * shouldn't need to press save twice." A refusal is the arm store's to
                 * publish and the Live screen's to show; it is not swallowed here, and the
                 * SAVE has already succeeded either way, so a machine that will not take
                 * the profile costs the version nothing. */
                await library.arm(savedId);
                note('info', `profile editor: the machine now holds the save (${savedId})`);
            }

            if (saved) return;
            /* A7 — REPORTED, NOT PAPERED OVER. The write succeeded (the editor is holding
             * the server's own answer) and the listing cannot see it. Leaving the previous
             * selection standing keeps Edit working on something real, which is strictly
             * more than pointing it at a record nothing can resolve. */
            note('warn', `profile editor: saved ${savedId}, but the re-read listing does not `
                + 'carry it — the selection is left where it was');
        } catch (error) {
            note('warn', 'profile editor: the listing could not be re-read after a save — '
                + `${error && error.message}`);
        }
    }

    const shots = createShotsStore({ transport, logger });

    /* THE INSTALLED-PLUGIN LISTING, HOISTED TO THE SHELL (27 August 2026).
     *
     * It was built inside `settings-model.js` and was the Settings screen's private
     * business, which was true while the Settings screen was its only reader. The Live
     * screen's DYE2 button is the second reader — Ben, 27 August 2026: "Have the button
     * open the bean picker page for now" — and a second `createPluginsStore` over the same
     * transport would be the shape four other stores in this file were already corrected
     * for (the settings store, the cup warmer, the machine-state store and ReaPrime's
     * preferences all say so in their own paragraphs): two in-memory answers to one
     * question, and each screen reading only its own.
     *
     * IT MATTERS HERE MORE THAN IT LOOKS. The two readers ask different questions of the
     * same listing — Settings shows the row and its enable switch, Live asks whether DYE2
     * is loaded at all — so with two stores a person could disable DYE2 on the Plugins page
     * and still be offered the button on Live until something else re-read. That is one
     * store telling the truth and another one not, about a control the first one moved.
     *
     * NOT READ FROM THIS PATH, and that is deliberate — which is a narrower claim than
     * "not read at boot", and the difference is worth stating because the request does in
     * fact go out during a boot. `askLibrary` and `askShots` below fetch from HERE, because
     * the Live page draws their answers whether or not anyone asks. The plugin listing
     * reaches exactly one pixel — whether the DYE2 bean-picker button is drawn — so it is
     * asked by the thing that draws that pixel instead: `<live-wiring>` calls `load()` when
     * the Live screen mounts, and the Settings screen calls it on entering the Extensions
     * leaves. The store's own in-flight guard makes the second caller free.
     *
     * THE LIVE SCREEN IS THE SHELL'S FIRST ROUTE, so on an ordinary boot its reader mounts
     * immediately and the listing is fetched anyway. That does not make the placement
     * pointless: the owner of the request is the screen that reads the answer, so a build
     * that never shows Live never pays for it, and nothing here has to know why the listing
     * matters. `test/render/app-shell.render.test.mjs` pins the call as part of the booted
     * shell's set for exactly this reason — it is observable at boot, and a reader of that
     * suite should not have to reconcile it with a sentence here saying it never happens.
     *
     * Absence draws no button, which is what an unanswered listing should look like (A7).
     */
    const plugins = createPluginsStore({ transport, logger });

    /* THE SETTINGS STORE, AND THERE IS EXACTLY ONE (24 Aug 2026).
     *
     * B7 is "one store per setting", and until now that held everywhere except here:
     * `settings-model.js` built its own `createSettingsStore` per boot for the Settings
     * screen, and nothing else in the app had one at all. That was harmless while the
     * Settings screen was the only reader — and it stopped being harmless the moment a
     * SECOND surface needed a preference.
     *
     * The screensaver is that surface. It reads `screensaverEnabled` (which had a switch,
     * a routing row and a store, and reached nothing), `screensaverType` (Ben, 26 Aug)
     * and `language`. A second store here would be two in-memory answers to one key: the
     * Settings page would turn the clock on, write through, and the blank would go on
     * reading its own copy — the units.js silent-revert defect with a new key.
     *
     * `settings-model.js` now prefers this one. It keeps its own construction as a
     * fallback for a boot assembled by hand, and says so there. */
    /* `logger ?? undefined` because this store's default is a NOOP LOGGER and a default
     * only applies to `undefined` — `logger` is null on a boot built without one, and a
     * null would reach `logger.scope` and throw at construction. */
    const settings = createSettingsStore({ storage, capabilities, logger: logger ?? undefined });
    const cupWarmer = createCupWarmerStore({
        routes: api,
        /* A3: the capability list decides whether the route is worth asking for, and
         * the handler's own 404 is the second, authoritative answer. `entries()` is
         * null until the list lands, which the store reads as "not known yet" rather
         * than as "absent" — its own note says so. */
        readCapabilities: () => capabilities.entries(),
        /* SPREAD, NOT PASSED, and it is not a style choice: this store's parameters
         * default with `=`, which only fires for `undefined`, and it dereferences both
         * on the way in (`logger.scope`, `now()`). An explicit null therefore throws
         * where every other store here shrugs — measured, as twelve app-boot subtests
         * dying on "Cannot read properties of null (reading 'scope')" the moment this
         * store joined the shell. Same shape the storage router above already uses. */
        ...(logger ? { logger } : null),
        ...(clock ? { now: clock } : null),
    });

    const store = createStore({
        phase: BOOT_PHASE.IDLE,
        step: BOOT_STEP.DONE,
        /** `{id, tag, module, match, requested, planned}` — what is mounted, and why. */
        route: null,
        /** The connection feed's own status word, mirrored (never re-derived). */
        connection: null,
        /** The capability store's status word, mirrored. Never a gate — see the header. */
        capabilities: null,
        /** `{message, specifier}` when the SHELL failed. */
        error: null,
    }, { label: 'boot', logger: log });

    let unwatchConnection = null;
    let capabilitiesRead = null;
    let machineInfoRead = null;
    let workflowRead = null;
    let appSettingsRead = null;
    let libraryRead = null;
    let shotsRead = null;
    let cupWarmerRead = null;
    /** The id of the connected machine on the last readable devices frame, or null. */
    let machineId = null;
    let destroyed = false;

    const patch = (fields) => store.set({ ...store.get(), ...fields });

    /**
     * Ask for the capability set and mirror the store's own word for how it went.
     *
     * `load()` IS the retry — `refresh()` delegates to it — so this one function serves
     * the boot read and every re-read. Started, never awaited: see `start()`.
     */
    function askCapabilities() {
        capabilitiesRead = capabilities.load()
            .then((state) => {
                if (!destroyed) patch({ capabilities: state && state.status ? state.status : null });
                return state;
            })
            .catch((error) => {
                note('warn', `the capability read threw: ${error && error.message}`);
                if (!destroyed) patch({ capabilities: 'error' });
                return null;
            });
        return capabilitiesRead;
    }

    /** Ask for `machine/info` and hand the BODY to the capability store — one store, one
     *  route, on both sides of the line. */
    function askMachineInfo() {
        machineInfoRead = machineInfo.load()
            .then((state) => {
                if (!destroyed) capabilities.applyMachineInfo(state ? state.info : null);
                return state;
            })
            .catch((error) => {
                note('warn', `the machine info read threw: ${error && error.message}`);
                return null;
            });
        return machineInfoRead;
    }

    /** Ask for the workflow — the Live rail's ten targets. A refusal is not fatal and is
     *  not retried here: the rail renders its dashes, which is the honest state, and a
     *  machine connect is the event that changes the answer. */
    function askWorkflow() {
        workflowRead = workflow.load()
            .catch((error) => {
                note('warn', `the workflow read threw: ${error && error.message}`);
                return null;
            });
        return workflowRead;
    }

    /** Ask for ReaPrime's own preferences. Not fatal and not awaited: the one surface that
     *  reads it draws its dash until the answer lands, which is what it draws when there is
     *  nothing to say. The store records an unreachable server as `unavailable` state. */
    function askAppSettings() {
        appSettingsRead = appSettings.load()
            .catch((error) => {
                note('warn', `the app settings read threw: ${error && error.message}`);
                return null;
            });
        return appSettingsRead;
    }

    /** Read the profile listing and the favourite slots. Not fatal, not awaited, and
     *  not retried here: with no listing the favourites rail draws five empty slots,
     *  which is what it draws on a machine that has no profiles. */
    function askLibrary() {
        libraryRead = library.load()
            .catch((error) => {
                note('warn', `the profile library read threw: ${error && error.message}`);
                return null;
            });
        return libraryRead;
    }

    /**
     * Read the newest page of stored shots, then the newest shot itself.
     *
     * TWO REQUESTS, AND THE SECOND IS THE EXPENSIVE ONE (~221 KB). It is made for the
     * one shot the Live page is about — the last one — and never per row, which is
     * the counter `shots-store.js` keeps (`reads.perRow`, whose only correct value is
     * 0). The page is asked for at its own smallest useful size: the list's `total` is
     * what the band's stored-shot count reads, and `items[0]` is the newest shot with
     * `order=desc`, so one page answers both.
     */
    function askShots() {
        shotsRead = shots.readPage({ limit: SHOTS_PAGE, offset: 0 })
            .then((state) => {
                const newest = state && state.items && state.items.length ? state.items[0] : null;
                const id = newest && typeof newest.id === 'string' ? newest.id : null;
                return id ? shots.loadShot(id) : null;
            })
            .catch((error) => {
                note('warn', `the shots read threw: ${error && error.message}`);
                return null;
            });
        return shotsRead;
    }

    /**
     * Read the cup warmer. Not fatal and not awaited, on the same terms as the rest:
     * the header's Warmer control renders whatever the store holds, and while it holds
     * nothing that is the dash rather than an assumed OFF.
     *
     * MACHINE-GATED, unlike the library and the shots: this IS a machine reading, so it
     * rides `onMachineChange` below with `machineInfo` and `workflow` — a mat state read
     * off the machine that just left is exactly the stale answer `forget()` exists for.
     */
    function askCupWarmer() {
        /* IT WAITS FOR THE CAPABILITY LIST, AND THAT IS A3 RATHER THAN AN ORDERING
         * PREFERENCE. The store's own sequence is "capability list first, the handler's
         * own 404 second and authoritative", and it reads the list through the callback
         * this shell gave it — which answers `null` until the list lands. Fired on the
         * start path with nothing to chain on, that null means "not known yet", so the
         * store asks for the mat AND for the pre-heat route on every boot, including on
         * machines whose capability list says neither is there. Chaining costs the
         * header nothing (the control draws the dash until the read lands, which it
         * does either way) and buys the gate the answer it was designed around.
         *
         * `capabilitiesRead` is re-armed by `askCapabilities` immediately above every
         * caller of this function, so the chain is this machine's list and never the
         * previous one's. */
        cupWarmerRead = Promise.resolve(capabilitiesRead)
            .catch(() => null)
            .then(() => cupWarmer.refresh())
            .catch((error) => {
                note('warn', `the cup-warmer read threw: ${error && error.message}`);
                return null;
            });
        return cupWarmerRead;
    }

    /**
     * THE MACHINE BEHIND BOTH ANSWERS CHANGED — arrived, went, or was swapped.
     *
     * WHY THIS EXISTS. Both machine-shaped reads happen inside `withDe1`, so both answer
     * 500 when no machine is connected — "the ordinary state of a machine that is off",
     * which is the ordinary way an app opens. The boot read therefore lands on
     * `unavailable`, `applyMachineInfo(null)` is applied, and until tonight NOTHING re-read
     * either one: `refresh()` and `forget()` had no caller anywhere under `src/`, though
     * `machine-info-store.js:117` asserts the opposite ("`refresh()` is the retry, and it
     * is called on a connect, which is the event that changes the answer"). So a user who
     * connected a machine after opening the app — including through this cluster's own
     * picker — kept `groupHeadController()` at UNKNOWN and never saw the GHC strip for the
     * whole session, and a machine SWAP kept the previous machine's flag, which
     * `capabilities-store.js:318-340` says `forget()` exists to prevent.
     *
     * FORGET FIRST, EVEN ON AN ARRIVAL, and that is deliberate. `forget()` bumps the store's
     * epoch AND releases the in-flight read, so a boot read issued while there was no
     * machine cannot be joined by this one and cannot land afterwards describing nothing.
     * Without it the common race — socket frame arrives while the boot's 500 is still in
     * flight — would join that request and re-pin the store at `unavailable`.
     *
     * IT IS ONE SUBSCRIPTION, not a second one beside the mirror: `attachments()` stays 1
     * while running, which is the leak oracle the shell suite asserts.
     */
    function machineChanged(id) {
        capabilities.forget();
        machineInfo.forget();
        workflow.forget();
        /* AND THE MAT'S STATE, for the same reason and by the store's own instruction:
         * "Drop everything on a machine (re)connect so nothing is painted from a machine
         * that is no longer there. The frame goes back to `loading`, not to a synthetic
         * off." Its word for it is `invalidate`, not `forget` — this store holds no
         * in-flight read to release, so there is no epoch to bump. */
        cupWarmer.invalidate();
        // Nothing to ask. Both stores now answer `unknown`, which is the honest state and
        // the fail-closed one — never the departed machine's answer.
        if (id === null) return;
        askCapabilities();
        /* The rail's targets belong to the machine that is here now. A swap re-reads them
         * for the same reason it re-reads the capabilities: the departed machine's numbers
         * are not this one's. */
        askWorkflow();
        askMachineInfo();
        askCupWarmer();
    }

    /** Mirror the connection feed into the boot state, so the boot surface can compose
     *  the connection store rather than asking the socket layer a second question — and
     *  notice, off the same frame, which machine the two machine-shaped answers are about. */
    function watchConnection() {
        if (unwatchConnection) return;
        const feed = live.feed(FEED.CONNECTION);
        unwatchConnection = feed.subscribe((state) => {
            const status = state && state.status ? state.status : null;
            if (store.get().connection !== status) patch({ connection: status });

            /* THE FRAME'S OWN ANSWER TO "WHICH MACHINE", read by the address layer and
             * never sniffed: `readDevicesFrame` sets `machine` to the CONNECTED machine
             * entry or null (rea-devices.js:199). A held frame behind a stale feed still
             * names the machine it named, so a socket blip is not a disconnect here. */
            const frame = state ? state.value : null;
            const id = frame && frame.machine ? frame.machine.id ?? null : null;
            if (id === machineId) return;
            machineId = id;
            machineChanged(id);
        });
    }

    /* THERE IS NO BRIGHTNESS RESTORE HERE, AND THAT IS Q13'S ANSWER.
     *
     * A restore lived here for about an hour on 26 August 2026: it read `lastBrightness`
     * when the display socket opened and sent it, so the preference would survive a
     * reload. `test/overlay-hygiene.test.mjs` refused it, and the guard was right.
     *
     * ReaPrime RESTORES BRIGHTNESS ITSELF when it sees an awake machine at requested
     * brightness 0 (`display_controller.dart:276-285`), and with a fully black screensaver
     * that makes two restore paths on the wake edge — of which exactly one side may drive.
     * The skin drives the DIM and stands back on the RESTORE
     * (`ui-screensaver.js`'s header states the decision and its three reasons). A socket
     * opening after a sleep IS that edge, so a restore here is the second driver.
     *
     * It is also the fallback ladder A7 removed. The only honest pre-sleep brightness is
     * ReaPrime's own `_preSleepBrightness`, which the skin cannot read and which survives a
     * skin reload that a stored copy would fight rather than help.
     *
     * THE SLIDER STILL COMMANDS THE PANEL, because that is a person moving a control and
     * not a wake edge — `live.setBrightness` and the Brightness leaf. What is refused is
     * the skin having an opinion about brightness at a moment ReaPrime already owns.
     */

    const boot = {
        transport,
        /** The generated client. Named `api` because `routes` is the route TABLE here. */
        api,
        sockets,
        devices,
        live,
        capabilities,
        weather,
        machineInfo,
        /** The Live rail's targets and the one road that writes them (DQ-707). */
        workflow,
        arm,
        /** The editor's record: seated by the selector's Edit, read by the editor. */
        profileEditor,
        /**
         * THE SCALE'S WRITE HALF, and the only caller of PUT /scale/tare.
         *
         * Ben, 23 Aug 2026: "with slate, if you tough the weight value it sends the tare
         * command to the machine resetting the weigh to 0.0g". The Live band's WEIGHT
         * tile is the affordance; this store is what it presses.
         *
         * IT IS HANDED THE SCALE FEED because a tare is confirmed by watching the weight
         * and not by the route answering — see the store's own header, and Slate's
         * f813dea, which had been reporting a firmware refusal as success.
         */
        scaleTare,
        /** The profile listing and the five favourite slots. Two readers: the selector
         *  screen and the Live header's favourites rail. */
        library,
        /** Asking the machine for a state — today, the screensaver's wake. */
        machineState,
        /**
          * The stored shot history. Two readers: the History screen and the Live page's
          * chart and foot band, which are about the last shot when none is running.
          *
          * NOT NAMED `shots`, AND THAT IS CB-21 RATHER THAN TASTE. Gate D refuses the
          * spelling `.shots` anywhere in client code, because `response.shots` is
          * undefined on every machine ever built and the old skin's numpad history chips
          * fell through to an empty array behind a debug log. `history-screen.js` made
          * the same move for the same rule ("NAMED shotOptions, NOT shots").
          */
        shotHistory: shots,
        /** ReaPrime's installed-plugin listing. TWO readers, which is why it is assembled
         *  here rather than on a screen: the Settings Extensions leaves draw the rows and
         *  their switches, and the Live screen asks whether DYE2 is loaded before offering
         *  its button. Built, not loaded — see the construction note above. */
        plugins,
        /**
         * THE ACCOUNT-PROXY BEARER, CARRIED AND NOT USED HERE.
         *
         * ReaPrime injects `<meta name="reaprime-proxy-token">` into every skin page it
         * serves and a companion script copies it to `window.__REA_PROXY_TOKEN__`
         * (`webui_service.dart`). It authorises `/api/v1/account/proxy/…`, which is the
         * only way a skin can talk to the Decent backend, and Help › Talk to Decent's
         * message box is the one surface that needs it.
         *
         * IT TRAVELS AS A VALUE BECAUSE THIS IS THE FILE THAT MAY READ AMBIENT STATE.
         * `bootFromWindow` reads the global once, exactly as it reads `location` and the
         * stored ReaPrime hostname, and everything below stays testable without a browser.
         * A store reaching for `window.__REA_PROXY_TOKEN__` itself would be the frozen-base-URL
         * defect (`rea-transport.js`, defect 2) with a different global.
         *
         * `null` IS THE ORDINARY ANSWER OFF A TABLET and it is a stated one, not a fault.
         * The dev harness and the capture battery serve this tree themselves, so nothing
         * injects a meta tag and the message box says why it cannot send rather than
         * drawing a form that would 401.
         */
        proxyToken,
        /** The cup warmer's mat state, for the Live header's Warmer control. One
         *  reader today; the Settings accessories leaf is its second when that leaf
         *  gets wired, which is the reason it is assembled here and not on the screen. */
        cupWarmer,
        /** ReaPrime's own preferences document. TWO readers, which is why it is here: the
         *  Settings screen's rows reach it as a `{read, write}` door through
         *  `machine-fields-port.js`, and the Live rail reads `stopHotWaterAtWeight` off it
         *  to say what ends a hot-water pour. */
        appSettings,
        /** The B7 storage router. One per app; screens take it, never build one. */
        storage,
        /** The B7 settings store, over that router. One per app, for the same reason —
         *  and the screensaver is the second reader that proves it had to be. */
        settings,
        routes: routeTable,

        get state() { return store.get(); },
        subscribe(listener) { return store.subscribe(listener); },
        /** How many listeners are watching the BOOT state — the leak oracle for a shell
         *  element that subscribes on connect and must unsubscribe on disconnect. */
        watchers() { return store.size(); },
        /** How many subscriptions the boot itself holds on the live layer: 1 while
         *  running, 0 when stopped, never 2. The other half of the same leak check —
         *  a start/stop cycle that left one behind is bug S10 with a boot in place of a
         *  resize. */
        attachments() { return unwatchConnection ? 1 : 0; },

        /**
         * Open everything and load the first screen.
         *
         * Resolves when the phase has SETTLED (`ready` or `error`), which is when
         * `<app-root>` has something to mount. The capability read is deliberately still
         * in flight at that moment; `capabilitiesSettled()` is how a test waits for it.
         *
         * Idempotent: a second call re-resolves the route and does not re-open the feeds
         * (`attachAll()` is itself a no-op when already attached, `live-stores.js:207`).
         */
        async start({ route = initialRouteId } = {}) {
            if (destroyed) throw new Error('appBoot: start() after destroy()');
            patch({ phase: BOOT_PHASE.CONNECTING, step: BOOT_STEP.STORES, error: null });

            live.attachAll();
            /* THE WEATHER FEED OPENS HERE, NOT AT ASSEMBLY. It used to call attach() beside
             * its own construction, which broke the layer's first rule — app-shell.test.mjs
             * §"nothing opens at construction — the whole layer waits for start()" — and put
             * one socket outside the start/stop pair every other feed lives in. */
            weather.attach();
            watchConnection();

            patch({ step: BOOT_STEP.CAPABILITIES });
            /* Started, NOT awaited. `.catch` inside the helper rather than a try/await:
             * an unhandled rejection in a boot path is an error the page reports and
             * nobody can act on, and the store already records the failure as state. */
            askCapabilities();

            /* THE SECOND HALF OF THE SAME QUESTION, and it is deliberately NOT awaited
             * either. `GET /api/v1/machine/info` answers 500 through `withDe1` whenever no
             * machine is connected — the ordinary state of a machine that is off — so
             * waiting for it would hold the screen behind exactly the condition the screen
             * exists to render. The two R3 gates answer `unknown` until it lands, which is
             * fail-closed and correct, and the capability store is handed the body rather
             * than the route: one store, one route, on both sides of this line.
             *
             * NEITHER READ IS THE ONLY ONE. This is the read for the machine that is there
             * NOW; `watchConnection` re-asks both the moment a different machine is, which
             * is the event that changes the answer. */
            askMachineInfo();

            /* AND THE RAIL'S OWN DOCUMENT, on the same terms and for the same reason. The
             * workflow answers whether or not a machine is connected, but its numbers only
             * mean something once one is, and holding the screen for it would be the same
             * mistake as holding it for machine info. Until it lands the rail renders its
             * dashes, which is what it renders when there is nothing to say. */
            askWorkflow();

            /* AND THE TWO THE LIVE PAGE'S COMPOSITION RUNS ON, on the same terms as the
             * three above: started, not awaited, and a refusal is a picture rather than
             * an error. Until they land the favourites rail draws five empty slots and
             * the chart says it has no shot yet, which is what each draws when there is
             * nothing to say. Neither is machine-gated — profiles and stored shots
             * outlive the machine being switched on. */
            askLibrary();
            askShots();

            /* AND REAPRIME'S OWN PREFERENCES, on the same terms. One field of this document
             * reaches a pixel — the Live rail's hot-water stop — and until it lands that
             * caption draws its dash rather than claiming a stop condition, which is the
             * same absence the rail's steppers show while the workflow is in flight. Not
             * machine-gated, so it is asked once and not re-asked on a swap. */
            askAppSettings();

            /* AND THE MAT, which IS machine-gated and is asked anyway for the same
             * reason `askMachineInfo` is: this is the read for the machine that is
             * there now, and `watchConnection` re-asks when a different one is. A
             * machine that is off answers through the same gate the other two do, and
             * the header draws the dash rather than an OFF nobody reported. */
            askCupWarmer();

            return boot.goto(route);
        },

        /**
         * Change route: resolve it, load its module, and publish it for `<app-root>` to
         * mount. The MODULE is what is loaded here; the ELEMENT is the shell's business,
         * because creating one needs a document.
         *
         * A module that will not load is the one genuine boot error — the app has no
         * screen to show — and it is reported as state with the specifier in it, not
         * thrown: `start()` is called from `connectedCallback`, where a throw is an
         * unhandled rejection and a blank page.
         */
        async goto(routeIdOrHash = initialRouteId) {
            const resolved = resolveRoute(hashFor(routeIdOrHash), routeTable);
            const { route } = resolved;
            patch({ phase: BOOT_PHASE.CONNECTING, step: BOOT_STEP.SCREEN, error: null });
            try {
                await importModule(route.module);
            } catch (error) {
                note('error', `screen module '${route.module}' failed to load: ${error && error.message}`);
                return patch({
                    phase: BOOT_PHASE.ERROR,
                    step: BOOT_STEP.SCREEN,
                    route: null,
                    error: {
                        message: String((error && error.message) || error),
                        specifier: route.module,
                    },
                });
            }
            if (destroyed) return store.get();
            return patch({
                phase: BOOT_PHASE.READY,
                step: BOOT_STEP.DONE,
                route: {
                    id: route.id,
                    tag: route.tag,
                    module: route.module,
                    label: route.label,
                    match: resolved.match,
                    requested: resolved.requested,
                    planned: resolved.planned,
                },
                error: null,
            });
        },

        /** The capability read's promise — for a test that wants the answer, and for a
         *  diagnostic that wants to know the boot has fully quiesced. */
        capabilitiesSettled() { return capabilitiesRead ?? Promise.resolve(null); },

        /** The machine-info read's promise — the other half of `capabilitiesSettled()`,
         *  and what a test waits on before asking a gate that answers from machineInfo. */
        machineInfoSettled() { return machineInfoRead ?? Promise.resolve(null); },
        /** The rail's document, for a test that wants its numbers before asserting. */
        workflowSettled() { return workflowRead ?? Promise.resolve(null); },
        /** ReaPrime's preferences, for a test that wants the rail's hot-water stop
         *  condition settled before reading the caption it prints. */
        appSettingsSettled() { return appSettingsRead ?? Promise.resolve(null); },
        /** The mat's state, for a test that wants the header's Warmer control settled.
         *  Machine-gated like the two above, so it re-arms on every machine change. */
        cupWarmerSettled() { return cupWarmerRead ?? Promise.resolve(null); },

        /**
         * Close the feeds and stop mirroring. Values survive, marked stale — the deletion
         * rule (`live-stores.js:235`). The reverse of `start()`, and it must leave nothing
         * subscribed: an app shell that leaks one subscription per boot is S10 with a
         * different name.
         */
        stop() {
            if (unwatchConnection) unwatchConnection();
            unwatchConnection = null;
            live.detachAll();
            /* AND IT CLOSES HERE. Without this line stop() left the weather socket
             * subscribed — app-shell.test.mjs measured five listeners still attached after
             * a close, which the same test names as "S10 with a different name": an app
             * shell that leaks one subscription per boot. */
            weather.detach();
            return boot;
        },

        destroy() {
            destroyed = true;
            boot.stop();
            capabilities.stop();
            machineInfo.stop();
            workflow.stop();
            arm.stop();
            machineState.stop();
            appSettings.stop();
            /* The editor's save watcher goes before the store it watches: `stop()` destroys
             * the store, and a subscription outliving its store is S10 with a new name. */
            unwatchEditorSave();
            profileEditor.stop();
            live.destroy();
            store.destroy();
        },
    };

    return boot;
}

/**
 * The app's own wiring: the ONE place ambient state is read.
 *
 * `window.location` once, `globalThis.fetch` once, the real socket factory once — and
 * then straight into `createAppBoot`, which knows none of them. Everything above this
 * function is testable without a browser precisely because this function exists and is
 * three lines long.
 *
 * `port` is deliberately not read from `location`: ReaPrime serves its API on 8080
 * (`rea-transport.js:44`) whatever port the page itself came from — which is how the
 * capture battery reaches it, serving the tree on 8808 while the mock answers on 8080.
 *
 * @param {object} [deps]
 * @param {Window} [deps.window]
 * @param {Function} [deps.createSocket]
 */
export function bootFromWindow({ window: win = globalThis, createSocket, ...rest } = {}) {
    const loc = win.location;
    if (!loc || !loc.hostname) {
        throw new Error('bootFromWindow: no location.hostname — this is the one function that reads it');
    }
    const { backends: injected = null, ...others } = rest;
    return createAppBoot({
        fetch: (...args) => win.fetch(...args),
        createSocket,
        location: { hostname: storedHostname(win) ?? loc.hostname, protocol: loc.protocol },
        proxyToken: proxyTokenOf(win),
        backends: { ...browserBackends(win, others.logger), ...(injected || null) },
        ...others,
    });
}

/**
 * The `local` and `session` layers, backed by the real Window.
 *
 * `createAppBoot` defaults both to memory, on a comment that said "No row this build ships
 * reads a `local` key through this router". THAT STOPPED BEING TRUE. The screen-saver rows
 * ship and every one of them is `layer: local`, so the memory layer became the silent data
 * loss it promised not to be: the write answered ok, the saver changed, and the value was
 * gone at the next load. MEASURED on the bench tablet 28 August 2026 — 23 keys in
 * localStorage and exactly one of them the skin's, `realine.theme`, which persists only
 * because `<app-root>` owns a second, local-backed router for it.
 *
 * This is the right place: `bootFromWindow` is the one function in the tree allowed to
 * read ambient state, which is precisely why `createAppBoot` could not build these itself.
 *
 * A WebView in private mode throws on the property access, so each is built inside a try,
 * exactly as `app-root.js realStorage` already does.
 */
function browserBackends(win, logger) {
    /* THE PROPERTY ACCESS IS INSIDE THE TRY, and that is the whole point of the thunk. A
     * locked-down WebView throws on `win.localStorage` itself, so reading it at the call
     * site puts the throw outside the guard — which is exactly what the first version of
     * this function did, and what `test/app-shell.test.mjs` caught. */
    const one = (pick, label) => {
        try {
            return createWebStorageBackend({ storage: pick(), logger, label });
        } catch {
            return createMemoryBackend();
        }
    };
    return {
        [LAYERS.local]: one(() => win.localStorage, 'localStorage'),
        [LAYERS.session]: one(() => win.sessionStorage, 'sessionStorage'),
    };
}

/**
 * The account-proxy bearer ReaPrime injected into this page, or null.
 *
 * READ HERE AND ONLY HERE, for the reason `storedHostname` below is read here and only
 * here: this is the one function in the tree that touches ambient state, and that is what
 * keeps every module under it testable without a browser.
 *
 * WHERE IT COMES FROM. `webui_service.dart` wraps every `text/html` response the skin
 * server returns: it inserts `<meta name="reaprime-proxy-token" content="…">` at the end of
 * `<head>` and a script that copies the tag's content onto `window.__REA_PROXY_TOKEN__`.
 * The global is therefore the CANONICAL read — it is what ReaPrime's own injected script
 * publishes, and what Slate reads — and this does not go looking for the meta tag itself.
 *
 * ABSENT IS THE COMMON CASE AND IT IS NOT AN ERROR. Serving this tree with
 * `python3 -m http.server`, or through the capture battery's own port, means no injection
 * and no global; so does a ReaPrime started with `--no-account`, which builds no proxy
 * service at all. Every one of those is "this page cannot reach the Decent backend", which
 * the message box states.
 *
 * A NON-STRING OR A BLANK IS `null`. A locked-down WebView, or an injection that produced
 * an empty content attribute, must not become the string "undefined" in an Authorization
 * header — the middleware would answer 401 and the page would then tell the reader their
 * account had come unlinked, which would be a false and actionable-looking claim.
 */
function proxyTokenOf(win) {
    let raw = null;
    try {
        raw = win.__REA_PROXY_TOKEN__ ?? null;
    } catch {
        return null;
    }
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    return value === '' ? null : value;
}

/**
 * The ReaPrime address this device was told to use, or null for "this page's own host".
 *
 * THE FIELD DID NOTHING. Connection › Machine has offered a `ReaPrime address` since the
 * settings screen was built; it wrote the routed key and NOTHING READ IT, so a tablet
 * pointed at another host kept talking to the one that served the page. Found on 26 August
 * 2026 by sweeping every settings row for something on the other end.
 *
 * IT IS READ HERE AND ONLY HERE, for two reasons. This is the one function that touches
 * ambient state, which is what keeps every other module testable. And the key CANNOT be
 * read through the storage router, because the router's `kv` layers are addressed AT the
 * machine this value names — the routing table's own note says so: "Cannot live in the
 * store it addresses." So it is a `local` row, and reading localStorage directly is what a
 * `local` row means at boot.
 *
 * A CHANGE TAKES EFFECT ON THE NEXT LOAD, and the settings row says so. The base URL and
 * the socket origin are composed once, at construction, and re-pointing a live app at
 * another machine mid-session would leave every open socket on the old one.
 *
 * A blank, a non-string or a locked-down WebView all read as "no opinion" — the page's own
 * host, which is the behaviour every tablet has had until now.
 */
function storedHostname(win) {
    let raw = null;
    try {
        raw = win.localStorage?.getItem(`${STORAGE_PREFIX}reaHostname`) ?? null;
    } catch {
        return null;                    // private-mode WebView: not an error, just no answer
    }
    if (raw === null) return null;
    let value = null;
    try {
        value = JSON.parse(raw);        // the web backend JSON-encodes, so "host" has quotes
    } catch {
        return null;
    }
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
