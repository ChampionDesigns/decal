/**
 * The owner <live-screen> was promised and never given.
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
