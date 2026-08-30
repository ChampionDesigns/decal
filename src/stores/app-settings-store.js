/**
 * app-settings-store.js — ReaPrime's own preferences, held once.
 *
 * WHY A STORE OVER `rea-app-settings.js` AND NOT THE CLIENT DIRECTLY. Two surfaces need
 * this one document and they need different halves of it:
 *
 *   the SETTINGS ROWS reach it through `machine-fields-port.js` as a `{read, write}`
 *   door, because charging mode, scale power and the two flow multipliers are plain
 *   registry rows and the leaf model owns their staging;
 *
 *   the USB CHARGER's BESPOKE HALF reads `chargingState` and the two night-mode times,
 *   which are not rows at all — a battery report is a reading and a minute-of-day is a
 *   clock face.
 *
 * With the client alone, those are two reads of one document and two in-memory copies of
 * one answer, which is the B7 defect exactly. This store is the one copy: it satisfies the
 * door's `{read, write}` shape AND publishes the document a surface can subscribe to, so
 * a row's Save repaints the status block beside it.
 *
 * THE DOOR CONTRACT IS SATISFIED WITHOUT A CACHE. `read()` performs the request and
 * publishes what came back — the leaf model reads once per leaf load and re-reads after
 * every commit, which is exactly when a fresh answer is wanted. A TTL here would make the
 * re-read after a Save return the pre-Save values, which is the `reatsettingscache` bug
 * `rea-de1-settings.js` carries a paragraph about.
 */

import { createAppSettingsClient } from '../data/rea-app-settings.js';
import { createStore } from './store.js';

export const APP_SETTINGS_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    UNAVAILABLE: 'unavailable',
});

const EMPTY_STATE = Object.freeze({
    status: APP_SETTINGS_STATUS.IDLE,
    /** The document as served, or null. Held WHOLE: the bespoke half reads keys no row
     *  names, and picking out "the ones we use" is how the next one goes missing. */
    document: null,
    error: null,
});

export function createAppSettingsStore({ transport, logger = null } = {}) {
    const client = createAppSettingsClient(transport);
    const log = logger && logger.scope ? logger.scope('app-settings') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'app-settings', logger: log });
    let inFlight = null;

    async function read() {
        const document_ = await client.read();
        if (!document_) {
            store.set({ ...EMPTY_STATE, status: APP_SETTINGS_STATUS.UNAVAILABLE, error: true });
            return null;
        }
        store.set({ status: APP_SETTINGS_STATUS.READY, document: Object.freeze({ ...document_ }), error: null });
        return document_;
    }

    return Object.freeze({
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** The served document, or null. What the bespoke half reads. */
        get document() { return store.get().document; },

        /** THE DOOR'S HALF. `machine-fields-port.js` calls exactly these two. */
        read,
        async write(patch) {
            const ok = await client.write(patch);
            if (!ok) {
                if (log && log.warn) log.warn('the app settings write was refused');
                return false;
            }
            /* THE RE-READ IS THE PUBLISH. The leaf model re-reads after its own commit,
             * but a write that came from the bespoke half (a night-mode time) has no
             * model behind it — so the store refreshes itself and every subscriber sees
             * the settled document, whichever half asked. */
            await read();
            return true;
        },

        /** Read once. Concurrent callers share the flight. */
        load() {
            if (inFlight) return inFlight;
            store.set({ ...store.get(), status: APP_SETTINGS_STATUS.LOADING });
            inFlight = read().finally(() => { inFlight = null; });
            return inFlight;
        },

        refresh() {
            inFlight = null;
            return this.load();
        },

        stop() { store.destroy(); },
    });
}
