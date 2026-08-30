/**
 * The installed WebUI skins, read-only.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export const SKINS_STATUS = Object.freeze({
    NOT_LOADED: 'notLoaded',
    LOADING: 'loading',
    READY: 'ready',
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
    switching: null,
    switchError: null,
    switched: null,
    updating: false,
    updateError: null,
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

                const defaultId = chosen.ok && chosen.data && typeof chosen.data.id === 'string'
                    ? chosen.data.id
                    : null;
                return publish({ status: SKINS_STATUS.READY, skins, defaultId, defaultLoaded: true });
            })().finally(() => { inFlight = null; });
            return inFlight;
        },

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
            const updated = Object.freeze(store.get().skins
                .filter((skin) => before.has(skin.id)
                    && typeof skin.version === 'string'
                    && before.get(skin.id) !== skin.version)
                .map((skin) => Object.freeze({ id: skin.id, from: before.get(skin.id) ?? null, to: skin.version })));
            publish({ updateRan: true, updated });
            return true;
        },

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
