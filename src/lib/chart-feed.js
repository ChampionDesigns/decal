/**
 * The shot buffer's road to the chart card, and the only road there is.
 */

import { createSingleFlightFrameScheduler } from './chart-render-scheduler.js';
import { deriveFromBuffer } from './shot-derivation.js';
import { logger } from './logger.js';

const log = logger.scope('chart');

export class ChartFeed {
    #host;

    #buffer = null;

    #unsubscribe = null;

    #derivation = null;

    #record = null;

    #derive;

    #scheduler;

    #derivations = 0;

    /** The buffer revision the current derivation was taken at; null when there is none. */
    #revision = null;

    constructor(host, { record = null, requestFrame, cancelFrame, derive = deriveFromBuffer } = {}) {
        if (!host) throw new Error('ChartFeed: a host is required');
        this.#host = host;
        this.#record = record;
        this.#derive = derive;
        this.#scheduler = createSingleFlightFrameScheduler(() => this.#run(), {
            requestFrame,
            cancelFrame,
            onError: (error) => this.#reportFailure(error),
        });
        host.addController?.(this);
    }

    /** The latest gate-6 derivation, or null before the first one. Handed on as-is. */
    get derivation() { return this.#derivation; }

    /** The buffer being watched, or null. */
    get buffer() { return this.#buffer; }

    /** How many times the derivation has run. Coalescing is provable, not asserted. */
    get derivations() { return this.#derivations; }

    /** The buffer revision the current derivation belongs to. */
    get revision() { return this.#revision; }

    /** Whether a derivation is pending — a frame requested and not yet run. */
    get pending() { return this.#scheduler.state().dirty; }

    get record() { return this.#record; }

    set record(record) {
        if (record === this.#record) return;
        this.#record = record ?? null;
        this.#revision = null;
        if (this.#buffer) this.#runNow();
    }

    watch(buffer) {
        if (buffer === this.#buffer) return this;
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#buffer = buffer ?? null;
        this.#derivation = null;
        this.#revision = null;
        if (!this.#buffer) {
            this.#scheduler.cancelPending();
            this.#host.requestUpdate?.();
            return this;
        }
        this.#subscribe();
        this.#runNow();
        return this;
    }

    #subscribe() {
        const buffer = this.#buffer;
        if (!buffer || typeof buffer.subscribe !== 'function') {
            throw new Error('ChartFeed.watch: a shot buffer with subscribe() is required');
        }
        this.#unsubscribe = buffer.subscribe(() => this.#invalidate());
    }

    /** Mark dirty and let the scheduler decide when. The 15 Hz path's whole cost. */
    #invalidate() {
        this.#scheduler.request();
    }

    /** Derive right now, off the frame — the mount path and the test seam. */
    refresh() {
        this.#runNow();
        return this.#derivation;
    }

    #runNow() {
        this.#scheduler.cancelPending();
        this.#run();
    }

    #reportFailure(error) {
        log.error(`derivation failed: ${error?.message ?? error}`);
    }

    #run() {
        const buffer = this.#buffer;
        if (!buffer) return;
        const revision = typeof buffer.revision === 'function' ? buffer.revision() : null;
        if (revision !== null && revision === this.#revision) return;
        let derivation;
        try {
            derivation = this.#derive(buffer, { record: this.#record });
        } catch (error) {
            this.#reportFailure(error);
            return;
        }
        this.#derivation = derivation;
        this.#revision = revision;
        this.#derivations += 1;
        this.#host.requestUpdate?.();
    }

    hostConnected() {
        if (this.#buffer && !this.#unsubscribe) {
            this.#subscribe();
            this.#runNow();
        }
    }

    hostDisconnected() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#scheduler.cancelPending();
    }

    /** Let go of everything. The host's `disconnectedCallback` is the usual caller. */
    destroy() {
        this.hostDisconnected();
        this.#buffer = null;
        this.#derivation = null;
        this.#revision = null;
    }
}
