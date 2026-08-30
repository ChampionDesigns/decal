/**
 * scale-connect-store.js — the CONNECTION SURFACE for both connection pages: the
 * remembered device list, the scan, connect/disconnect/forget, and the manually-added
 * WiFi scales.
 *
 * IT WAS NAMED FOR THE SCALE PAGE AND SERVES BOTH SINCE 26 AUGUST 2026. Ben asked for a
 * list of remembered devices on Machine and the same treatment on Scale, so the device
 * list, the three device actions and the scan are one surface over one served list — and
 * one owner is the point. Two stores here would be two answers to "what is connected",
 * which is precisely the state a connection page exists to report. The FILE keeps its
 * name: it is named in `CONTRACTS.json` as the consumer of four routes, and a rename
 * would move that name without moving a single behaviour.
 *
 * THE LEAF'S OWN ROW NAMED THIS FILE BEFORE IT EXISTED. `connection-scale-last` is a
 * READING row whose caption says pairing and forgetting "belong to whoever builds the
 * connection surface", and the registry's pending entry said the same in longer form:
 * "Slate scans from here and can add a WiFi scale by address through its own dialog."
 * This is that surface's data half.
 *
 * ===========================================================================
 * THREE ROUTES, AND THE SCAN IS THE ONE WITH A TRAP IN IT
 * ===========================================================================
 *
 *   GET    /api/v1/devices/scan   -> 200 array of DeviceListEntry
 *   GET    /api/v1/devices/wifi   -> 200 {endpoints: string[]}
 *   POST   /api/v1/devices/wifi   {host} -> 200 {endpoints} · 400 {error}
 *   DELETE /api/v1/devices/wifi   {host} -> 200 {endpoints} · 400 {error}
 *
 * THE SCAN TAKES TWO QUERY FLAGS AND BOTH DEFAULTS ARE WRONG FOR A SETTINGS PAGE
 * (`devices_handler.dart:214-237`, read at 2b047d02):
 *
 *   `connect` DEFAULTS TO TRUE — the test is `!= "false"`, so an ABSENT flag means
 *   `scanAndConnect()`. A bare scan from a settings page would therefore CONNECT to
 *   whatever it found, which is not what a person pressing "Search" asked for. This store
 *   always sends `connect=false`.
 *
 *   `quick` DEFAULTS TO FALSE, and true is the trap: with `quick=true` the handler starts
 *   the scan and RETURNS AN EMPTY ARRAY IMMEDIATELY. A caller reading that as "no devices
 *   found" would report an empty bench every time. So `quick` is never sent, the request
 *   waits for `scanningStream` to go true and then false, and the answer is the real list.
 *
 * That wait is why the scan has its own `scanning` flag and no timeout of this store's
 * own: the length of a scan is the radio's business, and a spinner that gave up early
 * would leave the request running with nobody reading it.
 *
 * ===========================================================================
 * FORGET IS HERE NOW, AND THE OLD REASON IS WHY IT TOOK SO LONG
 * ===========================================================================
 *
 * This section used to say `PUT /api/v1/devices/forget` was "deliberately not called",
 * because forgetting drops a REMEMBERED pairing — the `available:false` third state the
 * device list carries — and that "belongs to the connection surface proper rather than to
 * a scale settings page". The reasoning was right and its conclusion expired the day the
 * connection surface was built here (Ben, 26 August 2026: "end with a list of previously
 * connected devices").
 *
 * FOUR MORE ROUTES, ALL OF THEM ALREADY IN THE TABLE:
 *
 *   GET /api/v1/devices              -> 200 [DeviceListEntry], the SAME shape the socket
 *                                       sends, remembered devices included
 *   PUT /api/v1/devices/connect      {deviceId} -> the connect result
 *   PUT /api/v1/devices/disconnect   {deviceId}
 *   PUT /api/v1/devices/forget       {deviceId} -> 200 null
 *
 * CONNECTING FROM HERE IS THE SIMPLE ROUTE AND NOT THE LINK'S. `createDevicesLink` owns
 * the SOCKET path and the ambiguity handling that comes with an automatic connect; this
 * is a person naming one device and asking for it, which the REST route answers directly.
 * The two are not two answers to one question: one is "connect to whatever is out there",
 * the other is "connect to this".
 */

import { callRoute } from '../data/rea-routes.js';
import { readConnectResult } from '../data/rea-devices.js';
import { createStore } from './store.js';

/**
 * WHICH OPERATION A REFUSAL BELONGS TO.
 *
 * `writeError` was a single slot written by FIVE operations and read in exactly ONE place:
 * the WiFi section of the Scale page, where it printed "That address was refused." So a
 * Forget that ReaPrime answered 503 printed a sentence about an address on the Scale page,
 * and printed NOTHING AT ALL on the Machine page, which has no WiFi section. One of those
 * is a lie and the other is silence, and this fork's charter has an opinion about both.
 *
 * The refusals are worth showing: `devices_handler.dart` answers 404 "Device not found",
 * 409 "Device is inventory-only and cannot be controlled here", 503 on a failed connect and
 * 504 on a timeout. Naming the operation is what lets the surface put the sentence where
 * the button was pressed.
 */
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
    /**
     * EVERY DEVICE ReaPrime KNOWS ABOUT, from `GET /devices` — connected, disconnected and
     * REMEMBERED. Null while unread, which is not the same as an empty bench.
     *
     * SEPARATE FROM `devices` ABOVE, and the difference is what each list is FOR: `devices`
     * is what the last scan turned up, and this is what the machine remembers. Merging
     * them would lose the distinction a user acts on — a remembered device is one you can
     * reconnect to, a scanned one is one you have just met.
     */
    known: null,
    /** The preferred machine and scale ids, from `GET /settings`. Null while unread. */
    preferred: null,
    endpoints: null,
    error: null,
    /**
     * The last refused WRITE, as `{op, result, reason}` — or null.
     *
     * IT CARRIES ITS SOURCE SINCE 26 AUGUST 2026. See `WRITE_OP` above for what a
     * source-less slot cost: one surface read it, so four of the five operations were
     * reported under a sentence about a WiFi address or not reported at all.
     */
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

    /**
     * Publish a refusal, with the operation it belongs to and the server's own words when
     * there are any.
     *
     * THE REASON IS THE SERVER'S, NEVER THIS FILE'S. `readConnectResult` has existed since
     * the devices module was written and had no caller on this path, so a 409 "Device is
     * inventory-only and cannot be controlled here" arrived, was thrown away, and the page
     * said nothing. A refusal a person cannot read is a refusal that reads as a broken
     * button.
     */
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

        /**
         * Every device ReaPrime knows about, remembered ones included.
         *
         * ONE READ PER PAGE OPEN, like the machine document: this is the list a person is
         * looking at, and a page that showed what was true when the screen first opened is
         * the defect O2 closed one layer over. It is not a poll — the socket is where live
         * state belongs, and this list changes when somebody acts on it.
         */
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

        /**
         * The preferred machine and scale, read off ReaPrime's own settings document.
         *
         * A SEPARATE READ FROM THE DEVICE LIST because they are separate documents, and
         * the list's own sort already uses the answer server-side. What the page needs is
         * WHICH device is preferred, so it can mark it.
         */
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

        /**
         * Set — or clear — the preferred device of one kind.
         *
         * NULL IS A REAL VALUE AND IS HOW IT IS CLEARED. The handler takes `String or
         * null` and answers a typed 400 for anything else, so un-preferring a device sends
         * `null` rather than omitting the key, which would leave it untouched.
         *
         * @param {'machine'|'scale'} kind
         * @param {string|null} deviceId
         */
        async setPreferred(kind, deviceId) {
            const key = kind === 'machine' ? 'preferredMachineId' : 'preferredScaleId';
            const result = await callRoute(transport, 'postSettings', {
                body: { [key]: deviceId ?? null },
            });
            if (!result.ok) return refuse(WRITE_OP.PREFERRED, result);
            await this.loadPreferred();
            return true;
        },

        /**
         * Connect to ONE named device, disconnect one, or forget one.
         *
         * THREE ROUTES, ONE SHAPE, ONE RE-READ. Each answers about the device it names and
         * none of them answers with the new LIST, so every one is followed by a re-read —
         * showing what was asked for rather than what happened is the class of lie a
         * connection page cannot afford. A failure publishes the result and changes
         * nothing else, so the page keeps showing the state the machine last reported.
         */
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

        /**
         * RECONNECT TO A REMEMBERED DEVICE — scan first, then connect, and never the
         * other way round.
         *
         * THE DIRECT ROUTE CANNOT SUCCEED FOR THESE ROWS, and that is a fact about
         * ReaPrime rather than a preference. `PUT /devices/connect` looks the id up in
         * `_controller.devices` (`devices_handler.dart:315`), and a REMEMBERED device is
         * BY CONSTRUCTION not in that list — `buildAvailabilityDeviceList`
         * (`:641-655`) emits a `remembered` entry only when `liveIds` does NOT contain
         * the id. So Reconnect on exactly the rows Ben asked this list to exist for
         * returned 404 "Device not found", every single time.
         *
         * SLATE KNEW AND SAID SO: "Reconnect = rescan (the device reconnects when it
         * reappears in discovery — not a direct connect, which would fail with no
         * transport)" (`settings.js:9232-9234`). Slate is right about the mechanism and
         * this keeps Decal's own answer to the second half: Slate's rescan CONNECTS to
         * whatever it finds, because its scan omits `connect` and the handler reads an
         * absent flag as true. This store always sends `connect=false` (see the header),
         * so "connect to THIS one" stays a named request: scan, re-read the list, and
         * connect only if the named device actually came back.
         *
         * NO BLIND 404 IS EVER FIRED. If the scan does not surface it, the refusal is
         * this store's own `not-found` and no PUT leaves at all — which is the honest
         * answer to "it is not switched on", and is faster than waiting for the server to
         * say the same thing about a list it never had the device in.
         */
        async reconnectDevice(deviceId) {
            if (typeof deviceId !== 'string' || deviceId === '') return false;
            /* ONE SCAN, AND THE RE-READ IS THE SCAN'S OWN. `scan()` re-reads the remembered
             * list on success (see its note), so a second `loadDevices()` here would be a
             * second GET for an answer that has just landed — and a second opinion about
             * one list is what this store exists to avoid. */
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
                /* AND RE-READ WHAT IS REMEMBERED, because a scan changes it.
                 *
                 * `loadDevices()` ran once per page open and `scan()` published `devices`
                 * without touching `known`, so the sequence a person actually performs on a
                 * recovery page — see a remembered device marked Unavailable, press Search,
                 * the radio finds it — left the remembered row still saying Unavailable with
                 * a Reconnect that would fail, WHILE `#foundList` filtered the device out of
                 * the found list precisely because it was already in `known`. The two lists
                 * then agreed the device was unreachable at the moment the server had just
                 * proved it was not.
                 *
                 * `act()` already gets this right and says why: "showing what was asked for
                 * rather than what happened is the class of lie a connection page cannot
                 * afford". A scan is the same kind of event, so it does the same thing. */
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

        /**
         * Remove one. THE QUERY, NOT A BODY, and the difference is not cosmetic.
         *
         * `_extractHost` reads the body first and falls back to `?host=`, so both reach
         * the handler — but the SPEC declares `host` as a query parameter on DELETE and
         * declares no request body, and a DELETE body is the one place a fetch stack or
         * an intermediary is entitled to drop what it was given. The route table's
         * `buildQuery` refuses any key the spec does not declare, so this spelling is
         * checked against the contract and the body spelling would not be.
         *
         * POST is the other way round: it declares a body and no query.
         */
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
