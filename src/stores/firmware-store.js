// firmware-store.js — WHAT FIRMWARE THE MACHINE COULD RUN, AND SENDING IT ONE.
//
// WHY IT EXISTS. Decal shipped with no firmware surface at all: D4 removed the
// hand-picked file upload on the grounds that "a control that flashes firmware from an
// arbitrary file is worse than no control", and the Updates › Firmware Update leaf said
// so in a sentence. Ben reversed it on 24 August 2026: "I should be able to pick a file,
// but it should also have a 'latest' button that pulls it."
//
// WHAT THE MACHINE OFFERS, read at the pin 2b047d02 (`FirmwareHandler`,
// `lib/src/services/webserver/firmware_handler.dart`):
//
//   GET    /api/v1/machine/firmware         the BUNDLED catalog + this machine's build
//   POST   /api/v1/machine/firmware         raw bytes — a file somebody picked
//   POST   /api/v1/machine/firmware/apply   {artifactId, force?} — one bundled artifact
//   DELETE /api/v1/machine/firmware         cancel an upload in progress
//
// "LATEST" IS THE SERVER'S OWN ANSWER, NOT A SORT DONE HERE. The catalog carries
// `recommendedArtifactId` — the highest build whose eligibility the server's own
// validator calls `applicable` for THIS machine's model and installed build — and
// `updateAvailable`, which is `null` when the machine is not connected or any artifact's
// eligibility is unknown. Picking the newest artifact in the list instead would be this
// file re-implementing a model-compatibility rule it cannot see, and offering a person a
// firmware their machine will refuse.
//
// THE ARTIFACTS ARE BUNDLED WITH ReaPrime (`assets/firmware/de1/de1-*.bin`), so "pull the
// latest" is not a download from the internet: it is the newest image the ReaPrime on
// this machine already carries. Nothing here fetches from anywhere else, and there is no
// route that would.
//
// BOTH INSTALL PATHS ANSWER `application/x-ndjson` — one JSON object per line, held open
// for the whole flash: `erasing`, then `uploading` with a progress fraction, then `done`
// or `error`. `rea-transport.js`'s `onLine` reads it; this store turns it into state.
//
// A CANCEL IS 202 AND NOT A PROMISE. `_cancelUpdate` asks the machine to stop and answers
// with whatever state it is in; the stream this store is reading ends on its own shortly
// afterwards. Nothing here reports "cancelled" until that stream says so.

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** Where a read or an install got to. */
export const FIRMWARE_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
});

/** What an install is doing. The first three are the machine's own words. */
export const FLASH_STATE = Object.freeze({
    IDLE: 'idle',
    ERASING: 'erasing',
    UPLOADING: 'uploading',
    DONE: 'done',
    ERROR: 'error',
    /** This store's own: the request never reached the stream. */
    REFUSED: 'refused',
});

const EMPTY_FLASH = Object.freeze({
    state: FLASH_STATE.IDLE,
    /** 0..1 while uploading, else null. The machine's own fraction, never interpolated. */
    progress: null,
    /** What the machine or the route said, verbatim. */
    error: null,
    /** Which artifact, or 'file' for a hand-picked one. */
    what: null,
});

const EMPTY_STATE = Object.freeze({
    status: FIRMWARE_STATUS.IDLE,
    /** The catalog, verbatim: `{artifacts, machine, recommendedArtifactId, updateAvailable, operation}`. */
    catalog: null,
    error: null,
    flash: EMPTY_FLASH,
    at: null,
});

export function createFirmwareStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createFirmwareStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('firmware') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'firmware', logger: log });
    const patch = (fields) => store.set({ ...store.get(), ...fields, at: now() });

    /** The one place a progress line becomes state, so both install paths report alike. */
    const onLine = (what) => (line) => {
        if (!line || typeof line !== 'object') return;
        const state = typeof line.status === 'string' ? line.status : null;
        if (!state) return;
        patch({
            flash: Object.freeze({
                state,
                progress: typeof line.progress === 'number' && line.progress >= 0 ? line.progress : null,
                error: typeof line.error === 'string' ? line.error : null,
                what,
            }),
        });
    };

    /** A request that never became a stream. Its status is the whole story. */
    const refuse = (what, result) => {
        if (log && log.warn) log.warn(`firmware install refused (${result.status}): ${result.message}`);
        return patch({
            flash: Object.freeze({
                state: FLASH_STATE.REFUSED,
                progress: null,
                error: result.problem ?? result.message ?? null,
                what,
            }),
        });
    };

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        async load() {
            patch({ status: FIRMWARE_STATUS.LOADING, error: null });
            const result = await callRoute(transport, 'getMachineFirmware', {});
            if (!result.ok) {
                if (log && log.warn) log.warn(`firmware catalog failed: ${result.message}`);
                return patch({ status: FIRMWARE_STATUS.FAILED, catalog: null, error: result });
            }
            return patch({ status: FIRMWARE_STATUS.READY, catalog: result.data ?? null, error: null });
        },

        async installLatest() {
            const artifactId = store.get().catalog?.recommendedArtifactId ?? null;
            if (!artifactId) {
                return refuse(null, { status: 0, message: 'no recommended artifact', problem: null });
            }
            patch({ flash: Object.freeze({ state: FLASH_STATE.ERASING, progress: 0, error: null, what: artifactId }) });
            const result = await callRoute(transport, 'postMachineFirmwareApply', {
                body: { artifactId },
                onLine: onLine(artifactId),
                /* NO DEADLINE. A flash runs for minutes and the transport's default would
                 * abort it mid-write, which on this route is the one failure that can
                 * leave a machine unbootable. */
                timeoutMs: 0,
            });
            if (!result.ok) return refuse(artifactId, result);
            return store.get();
        },

        async installFile(bytes) {
            const image = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
            if (image.byteLength === 0) {
                return refuse('file', { status: 0, message: 'that file is empty', problem: null });
            }
            patch({ flash: Object.freeze({ state: FLASH_STATE.ERASING, progress: 0, error: null, what: 'file' }) });
            const result = await callRoute(transport, 'postMachineFirmware', {
                raw: image,
                headers: { 'Content-Type': 'application/octet-stream' },
                onLine: onLine('file'),
                timeoutMs: 0,
            });
            if (!result.ok) return refuse('file', result);
            return store.get();
        },

        /** Ask the machine to stop. The stream ends on its own; this does not fake it. */
        async cancel() {
            const result = await callRoute(transport, 'deleteMachineFirmware', {});
            if (!result.ok && log && log.warn) log.warn(`firmware cancel failed: ${result.message}`);
            return store.get();
        },

        /** Forget the last install, so a leaf can go back to offering one. */
        clearFlash() {
            if (store.get().flash.state === FLASH_STATE.IDLE) return store.get();
            return patch({ flash: EMPTY_FLASH });
        },

        stop() { store.destroy(); },
    };
}
