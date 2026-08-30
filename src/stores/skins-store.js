/**
 * skins-store.js — the installed WebUI skins, read-only.
 * Wave 5.4, row `bespoke-leaves-nine` (the `display-skin` 2-up cards and the
 * `updates-skin-app` update list are the same list, read once).
 *
 * TWO LEAVES, ONE LIST, ONE STORE. §4.4 gives `display-skin` a 2-up card grid ("Active
 * skin") and `updates-skin-app` an update list ("Installed skins"), and Slate's own two
 * captures show the same nine entries in both. Two stores over one route would be two
 * answers to one question, which is the units.js class of defect one storey up.
 *
 * ===========================================================================
 * ADOPTION — this store is why these two routes now have contract rows
 * ===========================================================================
 *
 * `GET /api/v1/webui/skins` and `GET /api/v1/webui/skins/default` were RECORDED (both
 * have fixtures: `tools/rea-fixtures/api__v1__webui__skins.json` and
 * `…__skins__default.json`) and handler-checked, but UNADOPTED — no client addressed
 * them, so under the demand-driven rule they had no row in `CONTRACTS.json`. Writing
 * this consumer is what earns them one, and both were re-read at the pin as the rule
 * requires:
 *
 *   webui_handler.dart:12  GET /api/v1/webui/skins
 *       `_storage.installedSkins` -> `jsonOk(skins.map((s) => s.toJson()).toList())`
 *       an ARRAY, never an object; a throw becomes `jsonError` (500).
 *   webui_handler.dart:14  GET /api/v1/webui/skins/default
 *       `_storage.defaultSkin`; NULL -> `jsonNotFound({'error':'No default skin available'})`
 *       — so 404 HERE MEANS "no default is set", which is a real state of a working
 *       server, not a missing feature and not an error to show.
 *
 * THE WRITES, AND FOUR OF THE FIVE ARE ADOPTED (26 August 2026):
 *
 *   PUT    /api/v1/webui/skins/default        switch the active skin       -> `switchTo`
 *   POST   /api/v1/webui/server/stop|start    restart the served skin      -> `switchTo`
 *   POST   /api/v1/webui/skins/update         update every skin            -> `updateAll`
 *   DELETE /api/v1/webui/skins/{id}           remove a skin                -> `remove`
 *   POST   /api/v1/webui/skins/install/*      install from GitHub / a URL  -> nobody
 *
 * THIS PARAGRAPH ARGUED THE OPPOSITE AND WAS LEFT ABOVE A STORE THAT HAD STOPPED AGREEING
 * WITH IT. It read "WHAT IS DELIBERATELY NOT ADOPTED … A card that cannot act is not
 * offered as a button; it is a card" — while `switchTo`, `updateAll` and `remove` sit two
 * hundred lines below it, adopting three of the four routes it listed. Ben settled the
 * question on 26 August ("use Slate completely"), and the header was not revisited. In a
 * codebase where the comment is the spec, that is a defect rather than untidiness.
 *
 * THE SWITCH IS THREE ROUTES IN AN ORDER, which is why it belongs here and not on a leaf:
 * set the default, stop the server, start it again — see `switchTo` for what a partial
 * failure means and why the START is the call whose failure matters. The RELOAD stays the
 * caller's, because a data layer that navigated would be unreachable from a test.
 *
 * DELETE IS GUARDED IN THE STORE, NOT BY THE HANDLER AND NOT BY A CALL SITE. Removing the
 * folder currently being served leaves the tablet with a web UI that cannot be reloaded,
 * and `webui_handler.dart` does not stop you; `remove()` refuses the active id. A guard on
 * whichever button happens to exist today is a guard the second button walks past.
 *
 * INSTALL IS THE ONE STILL UNADOPTED, and for a reason that has not expired: it takes a
 * GitHub coordinate or an arbitrary URL, which is a text entry with a network fetch behind
 * it and no page in the tree asks for one. It is declared here rather than forgotten.
 *
 * ===========================================================================
 * WHAT A SKIN RECORD SAYS
 * ===========================================================================
 *
 * From the served fixture, verbatim keys: `id`, `name`, `path`, `description`, `version`,
 * `isBundled`, and a nested `reaMetadata` carrying `sourceUrl`, `installedAt`,
 * `lastChecked`, `commitHash` and friends. Slate prints name, version, a Bundled/Installed
 * microcap and an "Update available" badge.
 *
 * THERE IS NO "UPDATE AVAILABLE" FIELD. Nothing served says a newer version exists —
 * `lastChecked` is a timestamp, not a verdict — and Slate's badge is drawn from a check
 * that runs against GitHub. This store does NOT invent one: `updateAvailable` is absent
 * from the shape, the update list shows the version it has, and the badge is declared
 * pending with `POST /api/v1/webui/skins/update` named as the route that would answer it.
 * A badge that always said "up to date" would be worse than no badge.
 *
 * ===========================================================================
 * SO THE BADGE REPORTS THE OUTCOME INSTEAD OF PREDICTING IT (27 August 2026)
 * ===========================================================================
 *
 * The paragraph above settled what this store must NOT do and left the user with nothing:
 * a tablet with two pending skin updates looks exactly like a tablet with none, and the
 * only way to find out is to press the button and watch a list that does not visibly
 * change. Slate answers the question by fetching
 * `https://api.github.com/repos/<slug>/releases/latest` STRAIGHT FROM THE WEBVIEW
 * (`slate app/src/settings/settings.js:5320-5333`) and diffing the tag against the
 * installed version. Decal must not copy that, and the reason is a rule rather than a
 * taste: `src/data/README.md` Gate 3 is "One client. It knows where the server is", and a
 * second client aimed at a third-party host — on a tablet that is usually on a local
 * network, under GitHub's unauthenticated rate limit — is a fallback path wearing another
 * name (A7).
 *
 * WHAT IS ALREADY IN HAND IS THE ANSWER AFTER THE FACT. `updateAll` re-reads the list when
 * the POST succeeds, so this store holds the versions BEFORE the run and the versions
 * AFTER it. The difference between those two lists is not a prediction and not a guess: it
 * is what the machine actually did. So the run publishes `updateRan` and `updated`
 * (`[{id, from, to}]`), the leaf prints one sentence and marks the rows that moved, and a
 * run where nothing moved says so in as many words. That is strictly more than Slate's
 * badge can say — Slate names a version it has not installed; this names one it has.
 *
 * THE OUTCOME IS CLEARED BY THE NEXT PLAIN READ, which is why `load()` resets both fields.
 * It is a property of ONE update run and not of the store, and a sentence that survived
 * navigating away and back would be reporting a run the reader may not have made.
 *
 * NO DOM. Paths come from the generated table by id.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export const SKINS_STATUS = Object.freeze({
    NOT_LOADED: 'notLoaded',
    LOADING: 'loading',
    READY: 'ready',
    /** The server answered, and it was not a list. */
    UNREADABLE: 'unreadable',
    /** The request never landed, or the handler threw (its documented 500). */
    UNAVAILABLE: 'unavailable',
});

const EMPTY = Object.freeze({
    status: SKINS_STATUS.NOT_LOADED,
    /** Every installed skin, in the server's order. Empty array is a REAL answer. */
    skins: Object.freeze([]),
    /** The id of the default skin, or null — 404 here means "none set". */
    defaultId: null,
    defaultLoaded: false,
    /* THE WRITE STATES, added 26 August 2026 with the picker (Ben: "use Slate
     * completely"). Each is REPORTED rather than assumed, because every one of these
     * writes can leave the tablet worse off if it half-happens — see `switchTo`. */
    switching: null,
    switchError: null,
    switched: null,
    updating: false,
    updateError: null,
    /* WHETHER AN UPDATE RUN HAS FINISHED IN THIS SITTING, and what it moved. Both are the
     * OUTCOME half described in the header: `updateRan` is false until a run completes, so
     * "every skin was already current" is never said to somebody who has not pressed
     * anything, and `updated` names only the skins whose served version string actually
     * changed across the re-read. A run that fails leaves both alone — a failed POST moved
     * nothing and must not report that it did. */
    updateRan: false,
    updated: Object.freeze([]),
    version: 0,
});

/**
 * One record, shaped. Unreadable entries are DROPPED rather than defaulted: a card
 * headed "undefined" teaches nothing and a shorter list is honest.
 */
export function readSkin(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (typeof raw.id !== 'string' || raw.id === '') return null;
    const meta = raw.reaMetadata && typeof raw.reaMetadata === 'object' ? raw.reaMetadata : null;
    return Object.freeze({
        id: raw.id,
        name: typeof raw.name === 'string' && raw.name !== '' ? raw.name : raw.id,
        version: typeof raw.version === 'string' ? raw.version : null,
        description: typeof raw.description === 'string' ? raw.description : '',
        bundled: raw.isBundled === true,
        /** When the server last asked its source whether there was anything newer. */
        lastChecked: meta && typeof meta.lastChecked === 'string' ? meta.lastChecked : null,
        sourceUrl: meta && typeof meta.sourceUrl === 'string' ? meta.sourceUrl : null,
    });
}

/** The served array, shaped. A body that is not an array is not an empty list. */
export function readSkins(body) {
    if (!Array.isArray(body)) return null;
    return Object.freeze(body.map(readSkin).filter((skin) => skin !== null));
}

/**
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} [deps.logger]
 */
export function createSkinsStore({ transport, logger = NOOP_LOGGER } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createSkinsStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger.scope ? logger.scope('skins') : logger;
    const store = createStore({ ...EMPTY }, { label: 'skins', logger: log, freeze: false });
    let inFlight = null;

    const publish = (patch) => store.set({ ...store.get(), ...patch, version: store.get().version + 1 });

    return {
        subscribe: (listener) => store.subscribe(listener),
        get: () => store.get(),

        /** Every installed skin. Always an array — never null at a call site. */
        skins: () => store.get().skins,

        /** The active skin's record, or null. */
        active() {
            const { skins, defaultId } = store.get();
            return skins.find((skin) => skin.id === defaultId) ?? null;
        },

        /**
         * Read the list and the default. Concurrent callers join one pair of requests —
         * both leaves ask, and a user paging between them must not re-fetch.
         */
        load() {
            if (inFlight) return inFlight;
            /* THE OUTCOME OF THE LAST RUN DIES WITH THE READ THAT FOLLOWS IT. See the
             * header: `updateRan`/`updated` describe one press of one button, and a
             * sentence that outlived the page it was said on would be reporting a run the
             * reader may never have made. `updateAll` publishes its outcome AFTER the
             * refresh it triggers, so this reset never eats the answer it is about to
             * give. */
            publish({ status: SKINS_STATUS.LOADING, updateRan: false, updated: EMPTY.updated });
            inFlight = (async () => {
                const [list, chosen] = await Promise.all([
                    callRoute(transport, 'getWebuiSkins'),
                    callRoute(transport, 'getWebuiSkinsDefault'),
                ]);

                if (!list.ok) {
                    log.info(`webui skins read failed: ${list.status ?? 'no status'}`);
                    return publish({ status: SKINS_STATUS.UNAVAILABLE, skins: EMPTY.skins });
                }
                const skins = readSkins(list.data);
                if (skins === null) {
                    log.warn('webui skins answered a body that is not a list');
                    return publish({ status: SKINS_STATUS.UNREADABLE, skins: EMPTY.skins });
                }

                /* 404 HERE IS "NO DEFAULT SET", not a failure and not a missing feature:
                 * `_handleGetDefaultSkin` returns `jsonNotFound` when `_storage.defaultSkin`
                 * is null. So `defaultLoaded` goes true either way and `defaultId` stays
                 * null — which the leaf renders as "no skin is marked active", a state the
                 * server can genuinely be in. */
                const defaultId = chosen.ok && chosen.data && typeof chosen.data.id === 'string'
                    ? chosen.data.id
                    : null;
                return publish({ status: SKINS_STATUS.READY, skins, defaultId, defaultLoaded: true });
            })().finally(() => { inFlight = null; });
            return inFlight;
        },

        /**
         * SWITCH THE SKIN THIS MACHINE SERVES — four calls, in this order, and the order
         * is the whole of it.
         *
         * `PUT /webui/skins/default` RECORDS A PREFERENCE AND SERVES NOTHING. Read at the
         * pin, `WebUIStorage.setDefaultSkin` calls `setDefaultSkinId` and stops
         * (`webui_storage.dart:243-250`); what decides which FOLDER is served is
         * `POST /webui/server/start`, which reads `_storage.defaultSkin` and calls
         * `serveFolderAtPath` on it (`webui_handler.dart:229-240`). So setting the default
         * without restarting the server changes nothing a reload would show — which is
         * exactly the silent no-op this store exists to avoid.
         *
         * STOPPING THE SERVER THAT SERVES THIS PAGE IS THE RISK AND IT IS SLATE'S TOO
         * (`setActiveSkin`, settings.js:7676-7700). The page is already in memory, so it
         * survives; what does not survive is a `start` that fails, and the tablet is then
         * left with no web UI until ReaPrime restarts. That is why the outcome is REPORTED
         * rather than assumed: a failed start publishes `switchError` and the page says
         * so, instead of showing a reload prompt that would land on nothing.
         *
         * THE RELOAD IS THE CALLER'S. This store does not touch `location`: a data layer
         * that navigated would be unreachable from a test and would take the decision away
         * from the screen that knows whether the user is mid-edit.
         */
        async switchTo(skinId) {
            if (typeof skinId !== 'string' || skinId === '') return false;
            publish({ switching: skinId, switchError: null });
            const set = await callRoute(transport, 'putWebuiSkinsDefault', { body: { skinId } });
            if (!set.ok) {
                publish({ switching: null, switchError: set });
                return false;
            }
            /* A STOP THAT FAILS IS NOT FATAL — the server may already be down, and
             * `start` answers "Already serving" rather than an error when it is up. The
             * START is the call whose failure matters. */
            await callRoute(transport, 'postWebuiServerStop').catch(() => null);
            const started = await callRoute(transport, 'postWebuiServerStart');
            if (!started.ok) {
                publish({ switching: null, switchError: started });
                return false;
            }
            publish({ switching: null, switchError: null, switched: skinId });
            await this.refresh();
            return true;
        },

        /**
         * Ask the machine to update every skin it can.
         *
         * IT IS NOT A CHECK, WHATEVER SLATE'S BUTTON SAYS. `_handleUpdateSkins` calls
         * `updateAllSkins`, which downloads the remote-bundled skins and then re-installs
         * every user skin whose `sourceUrl` names a newer release
         * (`webui_storage.dart:478-520`). A button labelled "Check for updates" that
         * downloads and installs is a button that does something other than its own word,
         * so this skin's says what happens.
         *
         * AND IT REPORTS WHAT IT DID, which is the half the header argues for at length.
         * The versions are snapshotted before the POST and compared against the re-read
         * afterwards, so what reaches the leaf is the machine's own answer to "was there
         * anything to install" rather than a prediction made by asking GitHub. A skin that
         * disappears from the list between the two reads simply does not appear in
         * `updated`: it moved from a version to no record at all, which is a removal and
         * not an update, and naming it here would be this store inventing a story about a
         * row that is no longer on the page.
         */
        async updateAll() {
            const before = new Map(store.get().skins.map((skin) => [skin.id, skin.version]));
            publish({ updating: true, updateError: null, updateRan: false, updated: EMPTY.updated });
            const result = await callRoute(transport, 'postWebuiSkinsUpdate');
            if (!result.ok) {
                publish({ updating: false, updateError: result });
                return false;
            }
            publish({ updating: false, updateError: null });
            await this.refresh();
            /* A MOVE NEEDS A DESTINATION. Inequality alone would also catch a record whose
             * version stopped being readable — `readSkin` answers `version: null` for a
             * non-string — and "updated to nothing" is not an outcome anybody can act on.
             * The `from` side may legitimately be null: a skin the machine could not name a
             * version for before, and can now, really was updated. */
            const updated = Object.freeze(store.get().skins
                .filter((skin) => before.has(skin.id)
                    && typeof skin.version === 'string'
                    && before.get(skin.id) !== skin.version)
                .map((skin) => Object.freeze({ id: skin.id, from: before.get(skin.id) ?? null, to: skin.version })));
            publish({ updateRan: true, updated });
            return true;
        },

        /**
         * Remove an installed skin.
         *
         * THE ACTIVE ONE IS REFUSED HERE rather than by the server: removing the folder
         * being served leaves the tablet with a web UI that cannot be reloaded. The
         * handler does not guard it, so this does.
         */
        async remove(skinId) {
            if (typeof skinId !== 'string' || skinId === '') return false;
            if (skinId === store.get().defaultId) return false;
            const result = await callRoute(transport, 'deleteWebuiSkinsById', { params: { id: skinId } });
            if (!result.ok) {
                publish({ switchError: result });
                return false;
            }
            await this.refresh();
            return true;
        },

        /** Re-read, whatever is in flight. After any write. */
        refresh() {
            inFlight = null;
            return this.load();
        },

        forget() { store.set({ ...EMPTY }); },
        stop() { store.destroy(); },
    };
}
