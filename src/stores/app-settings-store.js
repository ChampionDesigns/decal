/**
 * ReaPrime's own preferences, held once.
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
