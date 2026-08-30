/**
 * The History screen's logic, per instance.
 */

import {
    ALIGNMENT_SLOT,
    alignmentControlState,
    alignmentOffsetAfterSlotChange,
    clampAlignmentOffset,
} from './alignment-offset.js';
import { comparisonStepRules, compareOnOneClock, comparisonWindow } from './history-compare.js';
import { reaMessageOf } from '../data/rea-errors.js';
import { interpolate } from './i18n.js';

/** A host that does not want to be told. Keeps the constructor's contract one line. */
const SILENT_HOST = Object.freeze({ requestUpdate() {} });

const EMPTY_ROWS = Object.freeze([]);

export const HISTORY_PAGE_SIZE = 20;

export class HistoryViewer {
    constructor({ store, host = null } = {}) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(
                'HistoryViewer: a shots store must be injected (see createShotsStore). '
                + 'The viewer owns no cache and opens no endpoint: the records, the '
                + 'derivations and the walk count are the store\'s.',
            );
        }
        this.#store = store;
        this.#host = host ?? SILENT_HOST;
    }

    #store;
    #host;
    #unsubscribe = null;

    #ids = { a: null, b: null };

    /** The alignment offset in force, in seconds. Per instance for the same reason. */
    #offset = 0;

    /** Which slot the discs mark. View state; the offset's sign follows it. */
    #activeSlot = ALIGNMENT_SLOT.REFERENCE;

    /** The last store snapshot seen. Held so a getter never has to re-read mid-render. */
    #snapshot = null;

    async start() {
        if (!this.#unsubscribe) {
            this.#unsubscribe = this.#store.subscribe((state) => {
                this.#snapshot = state;
                this.#host.requestUpdate();
            });
        }
        return this.#store.readPage({ limit: HISTORY_PAGE_SIZE });
    }

    /** Drop the subscription. The store keeps its records: another viewer may hold them. */
    stop() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
    }

    /** The store snapshot, read through one accessor so nothing here caches a stale one. */
    get state() {
        if (!this.#snapshot) this.#snapshot = this.#store.get();
        return this.#snapshot;
    }

    /** The row model the list and the tables draw. The store publishes it; this passes it. */
    get rows() {
        return this.state.rows ?? EMPTY_ROWS;
    }

    get shotOptions() {
        return this.rows.map((row) => ({ value: row.id, label: row.label }));
    }

    /** The reference shot's id, and the moving shot's. */
    get shotA() { return this.#ids.a; }
    get shotB() { return this.#ids.b; }

    /** Which slot is marked. */
    get activeSlot() { return this.#activeSlot; }

    /** The offset in force. Always clamped: nothing can put an unclamped number here. */
    get offset() { return this.#offset; }

    /** A's gate-6 derivation, or null. NEVER walks — the store walked it once. */
    get derivationA() { return this.#derivationOf(this.#ids.a); }

    /** B's, or null for "no comparison". */
    get derivationB() { return this.#derivationOf(this.#ids.b); }

    /** Is there a second shot to slide? The bar dims its caption on this. */
    get hasComparison() { return Boolean(this.derivationB); }

    /** The bar's derived state, from the policy module. This file restates no rule. */
    controlState({ hasTimeAxis = true } = {}) {
        return alignmentControlState({
            offset: this.#offset,
            hasComparison: this.hasComparison,
            hasTimeAxis,
        });
    }

    get failure() {
        const { error } = this.state;
        return error ?? null;
    }

    /** `idle` / `loading` / `ready` / `failed`, the store's own vocabulary. */
    get status() { return this.state.status ?? 'idle'; }

    /**
     * The instrument, not a claim: how many reads of each kind this store has served.
     * `perRow` is the fetch-per-row count and its only correct value is 0.
     */
    get reads() { return this.state.reads; }

    async select(slot, id) {
        const key = slot === ALIGNMENT_SLOT.MOVING ? 'b' : 'a';
        const next = typeof id === 'string' && id !== '' ? id : null;
        if (this.#ids[key] === next) return null;
        this.#ids = { ...this.#ids, [key]: next };
        this.#offset = alignmentOffsetAfterSlotChange(this.#offset, key);
        this.#host.requestUpdate();
        if (!next) return null;
        return this.#store.loadShot(next);
    }

    setOffset(seconds) {
        const clamped = clampAlignmentOffset(seconds);
        if (clamped === this.#offset) return clamped;
        this.#offset = clamped;
        this.#host.requestUpdate();
        return clamped;
    }

    /** Reset is only ever an undo. */
    resetOffset() {
        return this.setOffset(0);
    }

    setActiveSlot(slot) {
        const next = slot === ALIGNMENT_SLOT.MOVING ? ALIGNMENT_SLOT.MOVING : ALIGNMENT_SLOT.REFERENCE;
        if (next === this.#activeSlot) return this.#activeSlot;
        this.#activeSlot = next;
        this.#host.requestUpdate();
        return this.#activeSlot;
    }

    compare(channels) {
        return compareOnOneClock({
            channels,
            a: this.derivationA,
            b: this.derivationB,
            offset: this.#offset,
        });
    }

    window(channels) {
        return comparisonWindow(this.compare(channels));
    }

    stepRules(paint) {
        return comparisonStepRules({
            a: this.derivationA,
            b: this.derivationB,
            offset: this.#offset,
            paint,
        });
    }

    #derivationOf(id) {
        if (!id) return null;
        const found = this.#store.derivationOf(id);
        return found && found.ok === true ? found : null;
    }
}

/** The factory form, for a caller that would rather not write `new`. */
export function createHistoryViewer(options) {
    return new HistoryViewer(options);
}

export function failureRefusal(failure, t = interpolate) {
    if (!failure || failure.ok !== false) return null;
    const said = reaMessageOf(failure) ?? (typeof failure.message === 'string' ? failure.message : '');
    const status = Number.isFinite(failure.status) ? failure.status : null;
    return Object.freeze({
        heading: said.trim() || t('The machine did not say why'),
        body: status === null
            ? t('The read failed before the machine answered.')
            : t('The machine answered {status}.', { status }),
    });
}
