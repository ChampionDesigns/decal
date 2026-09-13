/**
 * The workflow document, the Live rail's numbers read off it, and the writes back.
 *
 * A press is held on the rail until its write settles, so a read that lands late
 * cannot revert it, and writes are sent one at a time in the order they were made.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';
import { targetsFrom, patchFor, isWritableTarget } from '../lib/workflow-targets.js';

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

    /* Every read and every write takes a number, and an answer older than the newest one
     * already served is discarded rather than published. */
    let issued = 0;
    let newestAnswer = 0;

    /** Presses made and not yet settled, keyed by rail key. They overlay the served document. */
    const pending = new Map();

    let writes = Promise.resolve();

    const enqueue = (run) => {
        const answer = writes.then(run, run);
        writes = answer.then(() => {}, () => {});
        return answer;
    };

    const publish = (next) => store.set(next);

    const railTargets = (workflow) => {
        const base = targetsFrom(workflow);
        if (pending.size === 0) return base;
        const out = { ...base };
        for (const [key, held] of pending) out[key] = held.value;
        return Object.freeze(out);
    };

    const sameTargets = (a, b) => {
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
    };

    const resettle = (patch = null) => {
        const held = store.get();
        const targets = railTargets(held.workflow);
        if (!patch && sameTargets(held.targets, targets)) return held;
        return publish({ ...held, ...patch, targets });
    };

    const clearPress = (key, op) => {
        if (key === null) return true;
        if (!pending.has(key) || pending.get(key).op !== op) return false;
        pending.delete(key);
        return true;
    };

    const answer = (state, abandoned = false) => Object.freeze({ ...state, abandoned });

    const abandon = (key, op, why) => {
        if (log && log.info) log.info(`a queued workflow write was dropped: ${why}`);
        if (!clearPress(key, op)) return answer(store.get(), true);
        return answer(resettle(), true);
    };

    const settle = (asOf, op, next) => {
        if (asOf !== epoch) {
            if (log && log.info) log.info('discarding a workflow for a machine that is gone');
            return store.get();
        }
        if (op < newestAnswer) {
            if (log && log.info) log.info('discarding a workflow answer a newer one has replaced');
            return resettle();
        }
        newestAnswer = op;
        return publish({ ...next, targets: railTargets(next.workflow) });
    };

    const write = async (patch, label, key, op, asOf) => {
        if (asOf !== epoch) return abandon(key, op, 'the machine it was made against is gone');
        let result;
        try {
            result = await callRoute(transport, 'putWorkflow', { body: patch });
        } catch (error) {
            result = {
                ok: false,
                kind: 'error',
                message: error && error.message ? error.message : String(error),
            };
        }
        const current = clearPress(key, op);
        if (!result.ok) {
            if (log && log.warn) log.warn(`workflow write refused for ${label}`);
            if (!current) return answer(resettle());
            if (asOf !== epoch) return answer(store.get());
            if (op < newestAnswer) return answer(resettle({ writeError: result }));
            return answer(settle(asOf, op, { ...store.get(), writeError: result }));
        }
        const served = result.data && typeof result.data === 'object'
            && result.data.profile ? result.data : null;
        if (served) {
            return answer(settle(asOf, ++issued, {
                status: WORKFLOW_STATUS.READY,
                workflow: served,
                error: null,
                loadedAt: now(),
                writeError: null,
            }));
        }
        inFlight = null;
        return answer(await api.load());
    };

    const sendTarget = (key, value, op, asOf) => {
        if (asOf !== epoch) return abandon(key, op, 'the machine it was made against is gone');
        const patch = patchFor(store.get().workflow, key, value);
        if (!patch) return abandon(key, op, `the document carries no field for '${key}'`);
        return write(patch, `target '${key}'`, key, op, asOf);
    };

    const MAX_CHASED_READS = 1;
    let chasedReads = 0;
    const chaseDiscardedRead = (asOf) => {
        if (asOf !== epoch) return null;
        if (chasedReads >= MAX_CHASED_READS) {
            if (log && log.info) log.info('a discarded workflow read was not chased a second time');
            return null;
        }
        chasedReads += 1;
        if (log && log.info) log.info('re-reading the workflow a newer answer discarded');
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
            const op = ++issued;
            let outranked = false;
            publish({ ...store.get(), status: WORKFLOW_STATUS.LOADING, error: null });
            inFlight = (async () => {
                const result = await callRoute(transport, 'getWorkflow');
                if (!result.ok) {
                    return settle(asOf, op, {
                        ...EMPTY_STATE,
                        status: WORKFLOW_STATUS.UNAVAILABLE,
                        error: result,
                    });
                }
                const workflow = result.data && typeof result.data === 'object' ? result.data : null;
                outranked = asOf === epoch && op < newestAnswer;
                if (!outranked) chasedReads = 0;
                return settle(asOf, op, {
                    status: WORKFLOW_STATUS.READY,
                    workflow,
                    error: null,
                    loadedAt: now(),
                    writeError: null,
                });
            })().finally(() => { inFlight = null; });
            inFlight
                .then(() => (outranked ? chaseDiscardedRead(asOf) : null))
                .catch(() => {});
            return inFlight;
        },

        /** Re-read — after a machine connect, or after a write the server may have adjusted. */
        refresh() {
            inFlight = null;
            return this.load();
        },

        async setTarget(key, value) {
            const before = store.get();
            if (!isWritableTarget(key, value)) {
                if (log && log.warn) log.warn(`no workflow field for target '${key}'`);
                return answer(before, true);
            }
            const asOf = epoch;
            const op = ++issued;
            pending.set(key, { op, value });
            publish({ ...before, targets: railTargets(before.workflow), writeError: null });
            return enqueue(() => sendTarget(key, value, op, asOf));
        },

        async apply(patch, { label = 'document' } = {}) {
            if (!patch || typeof patch !== 'object') return answer(store.get(), true);
            const asOf = epoch;
            const op = ++issued;
            return enqueue(() => write(patch, label, null, op, asOf));
        },

        /** The machine went away. Mirrors `machineInfo.forget()`. */
        forget() {
            epoch += 1;
            inFlight = null;
            pending.clear();
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
