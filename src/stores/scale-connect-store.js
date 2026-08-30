/**
 * The CONNECTION SURFACE for both connection pages: the remembered device list, the scan, connect/disconnect/forget, and the manually-added WiFi scales.
 */

import { callRoute } from '../data/rea-routes.js';
import { readConnectResult } from '../data/rea-devices.js';
import { createStore } from './store.js';

export const WRITE_OP = Object.freeze({
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    FORGET: 'forget',
    PREFERRED: 'preferred',
    ENDPOINT: 'endpoint',
});

/** Which op each device route is. One table, so `act()` names no operation of its own. */
const ROUTE_OPS = Object.freeze({
    putDevicesConnect: WRITE_OP.CONNECT,
    putDevicesDisconnect: WRITE_OP.DISCONNECT,
    putDevicesForget: WRITE_OP.FORGET,
});

export const SCAN_STATUS = Object.freeze({
    IDLE: 'idle',
    SCANNING: 'scanning',
    DONE: 'done',
    FAILED: 'failed',
});

const EMPTY_STATE = Object.freeze({
    status: SCAN_STATUS.IDLE,
    /** What the last scan found, as served. Empty is a real answer; null is "not asked". */
    devices: null,
    known: null,
    /** The preferred machine and scale ids, from `GET /settings`. Null while unread. */
    preferred: null,
    endpoints: null,
    error: null,
    writeError: null,
});

export function createScaleConnectStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createScaleConnectStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('scale-connect') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'scale-connect', logger: log });
    let scanning = null;

    const publish = (patch) => {
        store.set({ ...store.get(), ...patch });
        return store.get();
    };

    const refuse = (op, result) => {
        const answer = readConnectResult(result?.data ?? result?.problem ?? null);
        const reason = (answer && (answer.error ?? answer.outcome))
            ?? (typeof result?.problem?.error === 'string' ? result.problem.error : null);
        publish({ writeError: Object.freeze({ op, result, reason: reason ?? null }) });
        return false;
    };

    /** Publish the `{endpoints}` body all three WiFi routes answer with. */
    function takeEndpoints(result) {
        const list = result?.data?.endpoints;
        if (!Array.isArray(list)) return false;
        publish({ endpoints: Object.freeze(list.map(String)), writeError: null });
        return true;
    }

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** The manual endpoint list. Cheap and immediate — no scan involved. */
        async loadEndpoints() {
            const result = await callRoute(transport, 'getDevicesWifi');
            if (!result.ok || !takeEndpoints(result)) {
                publish({ error: result });
                return false;
            }
            return true;
        },

        async loadDevices() {
            const result = await callRoute(transport, 'getDevices');
            if (!result.ok || !Array.isArray(result.data)) {
                publish({ error: result });
                return null;
            }
            const known = Object.freeze(result.data.map((device) => Object.freeze({ ...device })));
            publish({ known, error: null });
            return known;
        },

        async loadPreferred() {
            const result = await callRoute(transport, 'getSettings');
            if (!result.ok || !result.data || typeof result.data !== 'object') {
                publish({ error: result });
                return null;
            }
            const preferred = Object.freeze({
                machine: typeof result.data.preferredMachineId === 'string' ? result.data.preferredMachineId : null,
                scale: typeof result.data.preferredScaleId === 'string' ? result.data.preferredScaleId : null,
            });
            publish({ preferred, error: null });
            return preferred;
        },

        async setPreferred(kind, deviceId) {
            const key = kind === 'machine' ? 'preferredMachineId' : 'preferredScaleId';
            const result = await callRoute(transport, 'postSettings', {
                body: { [key]: deviceId ?? null },
            });
            if (!result.ok) return refuse(WRITE_OP.PREFERRED, result);
            await this.loadPreferred();
            return true;
        },

        async act(route, deviceId) {
            if (typeof deviceId !== 'string' || deviceId === '') return false;
            const result = await callRoute(transport, route, { body: { deviceId } });
            if (!result.ok) return refuse(ROUTE_OPS[route] ?? WRITE_OP.CONNECT, result);
            publish({ writeError: null });
            await this.loadDevices();
            return true;
        },

        /** Connect to a device the machine can SEE. See `reconnectDevice` for one it only
         *  remembers — that call cannot succeed and this one is not it. */
        connectDevice(deviceId) { return this.act('putDevicesConnect', deviceId); },

        async reconnectDevice(deviceId) {
            if (typeof deviceId !== 'string' || deviceId === '') return false;
            await this.scan();
            const known = store.get().known;
            const found = (known ?? []).find((device) => device.id === deviceId);
            if (!found || found.available === false) {
                publish({
                    writeError: Object.freeze({
                        op: WRITE_OP.CONNECT,
                        result: null,
                        reason: 'not-found',
                    }),
                });
                return false;
            }
            return this.connectDevice(deviceId);
        },

        /** Drop the live connection, leaving the pairing remembered. */
        disconnectDevice(deviceId) { return this.act('putDevicesDisconnect', deviceId); },

        /** Drop the PAIRING. The device has to be found again to be used. */
        forgetDevice(deviceId) { return this.act('putDevicesForget', deviceId); },

        /**
         * Scan. ONE AT A TIME: a second press while a scan is running joins the first
         * rather than starting a second radio sweep.
         */
        scan() {
            if (scanning) return scanning;
            publish({ status: SCAN_STATUS.SCANNING, error: null });
            scanning = (async () => {
                const result = await callRoute(transport, 'getDevicesScan', {
                    /* BOTH FLAGS EXPLICIT. See the header: an absent `connect` means
                     * CONNECT, and a `quick` scan answers with an empty array before it
                     * has looked at anything. */
                    query: { connect: 'false' },
                });
                if (!result.ok || !Array.isArray(result.data)) {
                    return publish({ status: SCAN_STATUS.FAILED, error: result });
                }
                publish({
                    status: SCAN_STATUS.DONE,
                    devices: Object.freeze(result.data.map((device) => Object.freeze({ ...device }))),
                    error: null,
                });
                await this.loadDevices();
                return store.get();
            })().finally(() => { scanning = null; });
            return scanning;
        },

        /**
         * Add a WiFi scale by address. The handler trims and validates; a bad host comes
         * back 400 with the service's own message, which the surface shows verbatim.
         */
        async addEndpoint(host) {
            const text = typeof host === 'string' ? host.trim() : '';
            if (text === '') return false;
            const result = await callRoute(transport, 'postDevicesWifi', { body: { host: text } });
            if (!result.ok || !takeEndpoints(result)) {
                if (log && log.warn) log.warn(`WiFi endpoint refused: ${text}`);
                return refuse(WRITE_OP.ENDPOINT, result);
            }
            return true;
        },

        async removeEndpoint(host) {
            const text = typeof host === 'string' ? host.trim() : '';
            if (text === '') return false;
            const result = await callRoute(transport, 'deleteDevicesWifi', { query: { host: text } });
            if (!result.ok || !takeEndpoints(result)) return refuse(WRITE_OP.ENDPOINT, result);
            return true;
        },

        clearWriteError() {
            if (store.get().writeError === null) return;
            publish({ writeError: null });
        },

        stop() { store.destroy(); },
    };
}
