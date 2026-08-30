/**
 * app-info-store.js — WHICH BUILD OF DECAID THIS TABLET IS RUNNING.
 *
 * WHY IT EXISTS, and it is this fork's own defect class caught red-handed. `GET
 * /api/v1/info` has been in the generated route table since the table was generated
 * (`src/data/rea-routes.generated.js`, id `getInfo`), it serves commit, commitShort,
 * branch, buildTime, version, buildNumber, appStore, fullVersion and localIp — and on
 * 27 August 2026 `grep -rn getInfo src/` returned the declaration and NOTHING ELSE. A
 * finished half with no other half: a route the address layer knows how to call, with no
 * client, answering a question the skin asks the user to care about. Send Feedback tells
 * a person it "appends the app version" to their report, and there was nowhere in Decal
 * to read that version.
 *
 * WHERE IT LANDS. Updates › Skin / App, whose NAME IS ALREADY A PROMISE — it has a skin
 * half and had no app half at all. Slate puts its app block on the firmware page instead,
 * and that is not a model to copy here: Ben ruled the firmware leaf down to "the current
 * firmware and whether the machine is a DE1 or a Bengle" on 26 August 2026, and this
 * skin has a page whose title already says where the answer belongs.
 *
 * THE APP IS CALLED DECAID (Ben, 26 August 2026 — the Extensions leaf was renamed on that
 * ruling, `settings-nav.js`). Not decent.app, not ReaPrime-the-product; the section on
 * screen is headed with the name Ben uses.
 *
 * ===========================================================================
 * CONTRACT, read at the pin 2b047d02 (`InfoHandler._infoHandler`)
 * ===========================================================================
 *
 *   GET /api/v1/info   200 {commit, commitShort, branch, buildTime, version, buildNumber,
 *                          appStore, fullVersion, localIp}
 *
 * Every string comes from `build_info.dart`, which is nine `String.fromEnvironment` reads
 * with DEFAULTS: `commit`, `commitShort`, `branch` and `buildTime` all default to the
 * literal `'unknown'`, `version` to `'0.0.0-dev'` and `buildNumber` to `'0'`. `localIp`
 * is `NetworkInfo().getWifiIP() ?? ''` inside a try that answers `''` on a throw.
 *
 * SO THE SERVER HAS TWO WAYS OF SAYING "I DO NOT KNOW" AND BOTH ARE READ AS ABSENCE:
 * the empty string, and the literal word `unknown`. That is not this store inventing a
 * fallback — it is the opposite. A7 says an unread value shows the em dash and never a
 * zero; a build that was compiled without `--dart-define=COMMIT` genuinely has no commit,
 * and printing the word "unknown" beside "Commit" would dress an absence up as a reading.
 * The dash is what the skin shows for every other value nobody could read, and this one
 * is no different for being spelled out.
 *
 * `appStore` IS A BOOLEAN AND IS NOT SUBJECT TO ANY OF THAT. `bool.fromEnvironment`
 * defaults to false, which is a real answer — "this build did not come from an app
 * store" — so it is carried as `true`/`false` and never as an absence.
 *
 * ===========================================================================
 * ONE READ, CACHED, AND A FAILURE IS DATA
 * ===========================================================================
 *
 * A BUILD DOES NOT CHANGE WHILE THE PAGE IS OPEN. `load()` joins a request already in
 * flight and, once one has succeeded, does nothing at all — paging in and out of the leaf
 * costs one request for the life of the store rather than one per visit. `reload()` is
 * the deliberate re-read, and nothing calls it today; it exists so that the day something
 * needs one it does not have to reach past this store to get it.
 *
 * A FAILED READ IS A STATE, NOT AN EXCEPTION AND NOT A GUESS. `status` goes FAILED, every
 * field stays null, and the section draws dashes — which is exactly what a ReaPrime too
 * old to serve `/api/v1/info` should look like. Nothing here manufactures a version out
 * of the skin's own manifest to fill the hole: the skin's version and the app's version
 * are different quantities, and printing one where the other was asked for is a lie that
 * would survive review because it looks plausible.
 *
 * NO DOM. The path comes from the generated table by id.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** Where the one read got to. */
export const APP_INFO_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** The request never landed, or the handler answered something that is not a body. */
    FAILED: 'failed',
});

/**
 * The two spellings of "I do not know" that `build_info.dart` can produce.
 *
 * `'unknown'` is the literal default of four of its nine `String.fromEnvironment` reads;
 * the empty string is what `_localIp` answers when there is no WiFi address or the lookup
 * throws. Neither is a value worth printing, and both are the SERVER's own admission
 * rather than this module's opinion — which is why the comparison is exact rather than a
 * "looks empty-ish" test.
 */
const UNREAD = Object.freeze(['', 'unknown']);

/** One served string, or null where the server said it does not know. */
function readText(source, key) {
    const value = source?.[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return UNREAD.includes(trimmed.toLowerCase()) ? null : trimmed;
}

const EMPTY_INFO = Object.freeze({
    commit: null,
    commitShort: null,
    branch: null,
    buildTime: null,
    version: null,
    buildNumber: null,
    /** `true`, `false`, or null when the body carried no boolean at all. */
    appStore: null,
    fullVersion: null,
    localIp: null,
});

/**
 * The served body, shaped. A body that is not an object is NOT an empty build record —
 * it is an unreadable answer, and the caller is told so by `status` rather than by a
 * record full of nulls that looks like a successful read of an anonymous build.
 */
export function readAppInfo(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return Object.freeze({
        commit: readText(body, 'commit'),
        commitShort: readText(body, 'commitShort'),
        branch: readText(body, 'branch'),
        buildTime: readText(body, 'buildTime'),
        version: readText(body, 'version'),
        buildNumber: readText(body, 'buildNumber'),
        appStore: typeof body.appStore === 'boolean' ? body.appStore : null,
        fullVersion: readText(body, 'fullVersion'),
        localIp: readText(body, 'localIp'),
    });
}

const EMPTY_STATE = Object.freeze({
    status: APP_INFO_STATUS.IDLE,
    info: EMPTY_INFO,
    error: null,
});

/**
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} [deps.logger]
 */
export function createAppInfoStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createAppInfoStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('appInfo') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'appInfo', logger: log });
    let inFlight = null;
    let done = false;

    const read = () => {
        if (inFlight) return inFlight;
        store.set({ ...store.get(), status: APP_INFO_STATUS.LOADING, error: null });
        inFlight = (async () => {
            const result = await callRoute(transport, 'getInfo');
            if (!result.ok) {
                if (log && log.info) log.info(`app info read failed: ${result.status ?? 'no status'}`);
                return store.set({ status: APP_INFO_STATUS.FAILED, info: EMPTY_INFO, error: result });
            }
            const info = readAppInfo(result.data);
            if (info === null) {
                if (log && log.warn) log.warn('app info answered a body that is not a record');
                return store.set({ status: APP_INFO_STATUS.FAILED, info: EMPTY_INFO, error: result });
            }
            done = true;
            return store.set({ status: APP_INFO_STATUS.READY, info, error: null });
        })().finally(() => { inFlight = null; });
        return inFlight;
    };

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /**
         * Read the build record, ONCE.
         *
         * A build cannot change under a running page, so a second visit to the leaf is not
         * a second question. A read that FAILED is retried, though — that failure may have
         * been a machine still coming up, and refusing to ask again would turn a moment's
         * unreachability into a permanent row of dashes.
         */
        load() {
            if (done) return Promise.resolve(store.get());
            return read();
        },

        /** Ask again, whatever happened last time. Declared for the day something needs it. */
        reload() {
            done = false;
            inFlight = null;
            return read();
        },

        stop() { store.destroy(); },
    };
}
