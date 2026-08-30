/**
 * workflow-store.js — the owner `<live-screen>` was promised and never given.
 *
 * The screen's `#commit` says it in as many words: a target the user set is "shown at
 * once, reported as an event: the owner of the machine's settings answers by handing
 * `targets` back". Nothing listened to `target-change` — not one line in `src/`, not one
 * test — and nothing ever set `targets`, so every rail control rendered disabled and the
 * one handler that writes `targets` sat behind the controls it needed. This store is that
 * owner: it reads the document the values live on, hands the rail its numbers, and writes
 * one back when the rail reports an intent.
 *
 * THE ROUTE WAS ALREADY GENERATED AND ALREADY HALF-CALLED. `getWorkflow` is in the route
 * table and `profile-library-store.js` calls it — but only to lift the loaded profile's id
 * for the R1 highlight, discarding the `context` block the rail needs. `putWorkflow` was
 * generated and had NO caller anywhere, which is the state DQ-707 recorded and Ben ruled
 * on: the workflow route is the rail's road. This store is that ruling.
 *
 * ONE READER OF THIS DOCUMENT, WHICH IS WHY THE HIGHLIGHT IS NOT MOVED HERE.
 * `profile-library-store` reads the workflow for a different question, at a different
 * moment (a listing load), and answers with a different shape. Folding the two now would
 * couple the selector's listing to the rail's freshness for no gain. That is a real seam
 * and it is stated rather than hidden: if a third reader appears, this is the file that
 * should absorb them.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';
import { targetsFrom, patchFor } from '../lib/workflow-targets.js';

/** What the store knows about the document right now. */
export const WORKFLOW_STATUS = Object.freeze({
    /** Nothing asked yet. */
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** Asked and refused, or the server was not there. The rail keeps its dashes. */
    UNAVAILABLE: 'unavailable',
});

const EMPTY_STATE = Object.freeze({
    status: WORKFLOW_STATUS.IDLE,
    /** The document as served, or null. Held whole: `patchFor` needs the steps. */
    workflow: null,
    /** The rail's keyed numbers, derived from the document. Never partially invented. */
    targets: Object.freeze({}),
    error: null,
    loadedAt: null,
    /** The last write that failed, so a surface can say so. Cleared by the next success. */
    writeError: null,
});

export function createWorkflowStore({ transport, logger = null, now = () => Date.now() } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createWorkflowStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('workflow') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'workflow', logger: log });
    let inFlight = null;
    /* The same generation guard the machine-info store carries, for the same reason: a read
     * in flight across a `forget()` must not land afterwards and re-describe a machine that
     * has gone. */
    let epoch = 0;

    const publish = (next) => store.set(next);
    const publishIfCurrent = (asOf, next) => {
        if (asOf !== epoch) {
            if (log && log.info) log.info('discarding a workflow for a machine that is gone');
            return store.get();
        }
        return publish(next);
    };

    /**
     * The write half both `setTarget` and `apply` run, so there is one answer to what a
     * refused write does and one answer to where the published document comes from.
     *
     * A REFUSED WRITE REVERTS to `before` and records `writeError`; a 200 publishes the
     * SERVER'S OWN document, because the machine clamps (see `setTarget`). A 200 whose
     * body is not a document falls back to a re-read rather than to the value asked for.
     */
    const write = async (patch, before, label) => {
        const asOf = epoch;
        const result = await callRoute(transport, 'putWorkflow', { body: patch });
        if (!result.ok) {
            if (log && log.warn) log.warn(`workflow write refused for ${label}`);
            return publishIfCurrent(asOf, { ...before, writeError: result });
        }
        const served = result.data && typeof result.data === 'object'
            && result.data.profile ? result.data : null;
        if (served) {
            return publishIfCurrent(asOf, {
                status: WORKFLOW_STATUS.READY,
                workflow: served,
                targets: targetsFrom(served),
                error: null,
                loadedAt: now(),
                writeError: null,
            });
        }
        inFlight = null;
        return api.load();
    };

    const api = {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        /** The rail's numbers. The one thing `<live-screen>.targets` wants. */
        targets() { return store.get().targets; },

        /** Ask once. Concurrent callers join the same request. */
        load() {
            if (inFlight) return inFlight;
            const asOf = epoch;
            publish({ ...store.get(), status: WORKFLOW_STATUS.LOADING, error: null });
            inFlight = (async () => {
                const result = await callRoute(transport, 'getWorkflow');
                if (!result.ok) {
                    /* NOT RETRIED, and the rail is honest about it: with no document there
                     * are no targets, every row renders its dash, and every control stays
                     * disabled — which is the truth, not a failure to render. `refresh()`
                     * is the retry and a machine connect is what calls it. */
                    return publishIfCurrent(asOf, {
                        ...EMPTY_STATE,
                        status: WORKFLOW_STATUS.UNAVAILABLE,
                        error: result,
                    });
                }
                const workflow = result.data && typeof result.data === 'object' ? result.data : null;
                return publishIfCurrent(asOf, {
                    status: WORKFLOW_STATUS.READY,
                    workflow,
                    targets: targetsFrom(workflow),
                    error: null,
                    loadedAt: now(),
                    writeError: null,
                });
            })().finally(() => { inFlight = null; });
            return inFlight;
        },

        /** Re-read — after a machine connect, or after a write the server may have adjusted. */
        refresh() {
            inFlight = null;
            return this.load();
        },

        /**
         * Write one target back, and answer with what the machine now holds.
         *
         * OPTIMISTIC, THEN CORRECTED BY THE SERVER'S OWN ANSWER. The rail already shows the
         * pressed value — `<live-screen>#commit` sets it locally before the event leaves —
         * so publishing it here keeps one number on the screen rather than two. The read
         * that follows is not ceremony: the machine CLAMPS. `hotWaterVolume` is packed into
         * one byte upstream and truncates rather than clamps (see `machine-limits.js`), so
         * the value the rail asked for and the value the machine holds can differ, and the
         * only honest source for the second is the machine.
         *
         * A REFUSED WRITE REVERTS. The optimistic value is dropped and the last known
         * document is republished, so the rail shows what the machine actually holds rather
         * than what the user hoped for. `writeError` carries the failure so a surface can
         * say so; nothing here throws, because a rail press is not an exception.
         */
        async setTarget(key, value) {
            const before = store.get();
            const patch = patchFor(before.workflow, key, value);
            if (!patch) {
                if (log && log.warn) log.warn(`no workflow field for target '${key}'`);
                return before;
            }
            const optimistic = { ...before.targets, [key]: value };
            publish({ ...before, targets: Object.freeze(optimistic), writeError: null });
            return write(patch, before, `target '${key}'`);
        },

        /**
         * PUT A PARTIAL DOCUMENT — the road a PROFILE takes onto the machine.
         *
         * WHY A PROFILE IS LOADED THIS WAY AND NOT WITH `POST /machine/profile` ALONE.
         * The two routes do different things and only one of them is the document:
         *
         *   POST /api/v1/machine/profile   `de1handler._profileHandler` -> `de1.setProfile`
         *       Arms the machine. Touches NOTHING else. `WorkflowController.currentWorkflow`
         *       still holds the profile it held before, so `/api/v1/workflow` goes on
         *       serving the OLD title, the OLD `context` and the OLD steps.
         *   PUT  /api/v1/workflow          `workflow_handler._applyUpdate`
         *       Deep-merges into the document and stores it. `WorkflowDeviceSync` watches
         *       the controller and pushes the new profile to the DE1 by itself
         *       (`workflow_device_sync.dart:112`), so the machine is armed either way.
         *
         * ONLY THE SECOND CHANGES THE DOCUMENT, and the document is what everything
         * downstream reads: the Live header's profile title, the rail's dose and drink
         * weight, the grind, and — because ReaPrime stamps every shot record with the
         * workflow as it stood — the profile name in the HISTORY, for ever. Decal armed
         * with the POST alone, so a machine could be running one profile while the app,
         * the rail and every shot it recorded named another. That is the reported bug and
         * it is a data defect, not a display one: the wrong name is in the stored shot.
         *
         * The old app makes the same call and says so in as many words — "Skipping
         * sendProfile call, using updateWorkflow directly"
         * (`slate/app/src/modules/profileManager.js:533`).
         *
         * PARTIAL, LIKE EVERY OTHER WRITE HERE. `deepMergeJson` merges maps and REPLACES
         * anything else, so a `profile` in the body replaces the profile whole (its `steps`
         * array included) while `steamSettings` and `rinseData`, which are not in the body,
         * are left exactly as they were.
         */
        async apply(patch, { label = 'document' } = {}) {
            if (!patch || typeof patch !== 'object') return store.get();
            return write(patch, store.get(), label);
        },

        /** The machine went away. Mirrors `machineInfo.forget()`. */
        forget() {
            epoch += 1;
            inFlight = null;
            return publish({ ...EMPTY_STATE });
        },

        /**
         * Forget a refused write, without touching the document.
         *
         * The value already reverted when the write was refused; what this clears is the
         * RECORD of it, which is what a person pressing Dismiss on the banner is asking
         * for. A no-op when there is nothing recorded, so a dismiss that arrives twice
         * does not republish.
         */
        clearWriteError() {
            const held = store.get();
            if (!held.writeError) return held;
            return publish({ ...held, writeError: null });
        },

        /** Drop every subscriber. This store holds no timer and no socket. */
        stop() { store.destroy(); },
    };

    return api;
}
