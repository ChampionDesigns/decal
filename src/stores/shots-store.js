/**
 * THE SHOTS STORE — the History screen's one door to the shots routes.
 */

import { callRoute } from '../data/rea-routes.js';
import { deriveFromRecord } from '../lib/shot-derivation.js';
import { shotRows } from '../lib/shot-summary.js';
import { createStore } from './store.js';

/** The handler clamps to this and echoes what you asked for. Ask for something honest. */
export const MAX_PAGE_LIMIT = 100;

/** The generated table's own default. The page SIZE is a count, never a height. */
export const DEFAULT_PAGE_LIMIT = 20;

/** The two spellings the handler acts on. Anything else is silently descending. */
export const SHOT_ORDER = Object.freeze({ NEWEST_FIRST: 'desc', OLDEST_FIRST: 'asc' });

export const SHOTS_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
});

const EMPTY_STATE = Object.freeze({
    status: SHOTS_STATUS.IDLE,
    /** The page as ReaPrime sent it — `items`, never `shots`. */
    items: Object.freeze([]),
    /** The row model, one entry per item. The list, the picker and the tables read this. */
    rows: Object.freeze([]),
    /** Derivations by shot id — the one walk per record, held so nothing walks twice. */
    derivations: Object.freeze({}),
    /** `total` is the pager's truth. The echoed `limit` is not. */
    total: null,
    limit: DEFAULT_PAGE_LIMIT,
    offset: 0,
    order: SHOT_ORDER.NEWEST_FIRST,
    /**
     * Counted, not inferred. `conditional` is the number of 304s the transport served;
     * `perRow` is the fetch-per-row count and its only correct value is 0.
     */
    reads: Object.freeze({ list: 0, conditional: 0, byId: 0, perRow: 0, writes: 0, failed: 0 }),
    /** How many times the measurements array has been parsed, across the whole session. */
    walks: 0,
    error: null,
});

const NOOP = { debug() {}, info() {}, warn() {}, error() {} };
const scoped = (logger) => (logger && logger.scope ? logger.scope('shots') : (logger || NOOP));

function shotInstant(item) {
    const raw = item && typeof item === 'object' ? item.timestamp : null;
    if (typeof raw !== 'string' || raw === '') return NaN;
    return Date.parse(raw);
}

export function orderShots(items, order = SHOT_ORDER.NEWEST_FIRST) {
    const list = Array.isArray(items) ? items : [];
    /* Descending unless asked for ascending — the same reading of an unrecognised
     * spelling the handler's own paginated branch makes, and `readPage` refuses to send
     * one, so this can only ever see the two. */
    const sign = order === SHOT_ORDER.OLDEST_FIRST ? -1 : 1;
    /* Decorated so each stamp is parsed ONCE per row rather than once per comparison —
     * a page is at most 100 rows and this runs on every publish, including the two
     * annotation writes that republish the list. */
    const decorated = list.map((item, arrival) => ({ item, arrival, at: shotInstant(item) }));
    decorated.sort((a, b) => {
        const aDated = Number.isFinite(a.at);
        const bDated = Number.isFinite(b.at);
        if (aDated !== bDated) return aDated ? -1 : 1;
        if (aDated && a.at !== b.at) return (b.at - a.at) * sign;
        return a.arrival - b.arrival;
    });
    return decorated.map((entry) => entry.item);
}

export function createShotsStore({
    transport, logger = null, derive = deriveFromRecord, dash = undefined,
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createShotsStore: a transport must be injected (see createReaTransport)');
    }
    const log = scoped(logger);
    const store = createStore({ ...EMPTY_STATE }, { label: 'shots', logger: log });
    /** Records held for the session, by id. Not a mirror: see the header. */
    const records = new Map();
    const derivations = new Map();
    /** Reads in flight, by id, so concurrent callers join one request. See `loadShot`. */
    const inFlight = new Map();

    const rowOptions = () => (dash === undefined ? {} : { dash });

    function publish(fields) {
        const current = store.get();
        const next = { ...current, ...fields };
        const derivationMap = Object.fromEntries(derivations);
        next.derivations = Object.freeze(derivationMap);
        next.rows = shotRows(next.items, { derivations: derivationMap, ...rowOptions() });
        store.set(next);
        return store.get();
    }

    async function readPage({
        limit = store.get().limit,
        offset = store.get().offset,
        order = store.get().order,
    } = {}) {
        if (order !== SHOT_ORDER.NEWEST_FIRST && order !== SHOT_ORDER.OLDEST_FIRST) {
            throw new Error(
                `createShotsStore: order "${order}" is not one of asc, desc. The paginated `
                + 'branch does not validate it and treats anything that is not "asc" as '
                + 'descending, so an unknown spelling is a sort that silently does nothing.',
            );
        }
        const asked = Math.min(Math.max(Math.trunc(limit) || DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
        const from = Math.max(Math.trunc(offset) || 0, 0);
        publish({ status: SHOTS_STATUS.LOADING });

        const result = await callRoute(transport, 'getShots', {
            query: { limit: asked, offset: from, order },
        });
        const reads = store.get().reads;
        if (!result.ok) {
            log.warn(`shots page ${from}+${asked} failed: ${result.message}`);
            return publish({
                status: SHOTS_STATUS.FAILED,
                error: result,
                reads: { ...reads, list: reads.list + 1, failed: reads.failed + 1 },
            });
        }
        const page = result.data && typeof result.data === 'object' ? result.data : null;
        const items = page && Array.isArray(page.items) ? page.items : [];
        return publish({
            status: SHOTS_STATUS.READY,
            items: Object.freeze(orderShots(items, order)),
            /* `total` is the count the pager runs on. `limit`/`offset` are echoed back
             * unclamped, so what is published is what was ASKED after our own clamp. */
            total: page && Number.isFinite(page.total) ? page.total : null,
            limit: asked,
            offset: from,
            order,
            error: null,
            reads: {
                ...reads,
                list: reads.list + 1,
                conditional: reads.conditional + (result.notModified ? 1 : 0),
            },
        });
    }

    async function loadShot(id) {
        if (typeof id !== 'string' || id === '') {
            throw new Error('createShotsStore: loadShot needs a shot id');
        }
        if (records.has(id)) {
            return Object.freeze({ ok: true, id, record: records.get(id), derivation: derivations.get(id), cached: true });
        }
        const held = inFlight.get(id);
        if (held) return held;
        const request = (async () => fetchShot(id))().finally(() => inFlight.delete(id));
        inFlight.set(id, request);
        return request;
    }

    /** The read itself. Only `loadShot` calls it, and only once per id at a time. */
    async function fetchShot(id) {
        const result = await callRoute(transport, 'getShotsById', { params: { id } });
        const reads = store.get().reads;
        if (!result.ok) {
            log.warn(`shot ${id} failed: ${result.message}`);
            publish({ reads: { ...reads, byId: reads.byId + 1, failed: reads.failed + 1 }, error: result });
            return Object.freeze({ ok: false, id, failure: result });
        }
        const record = result.data;
        const derivation = derive(record);
        records.set(id, record);
        derivations.set(id, derivation);
        publish({
            reads: { ...reads, byId: reads.byId + 1 },
            walks: store.get().walks + 1,
            error: null,
        });
        return Object.freeze({ ok: true, id, record, derivation, cached: false });
    }

    async function setEnjoyment(id, value) {
        if (typeof id !== 'string' || id === '') {
            throw new Error('createShotsStore: setEnjoyment needs a shot id');
        }
        if (value !== null && !Number.isFinite(value)) {
            throw new Error(
                'createShotsStore: enjoyment is a nullable double — a finite number, or null '
                + 'to clear it. ReaPrime does not bound it; the 0..100 scale is the rating '
                + "control's and belongs to the component, not to the wire.",
            );
        }
        const result = await callRoute(transport, 'putShotsById', {
            params: { id },
            body: { annotations: { enjoyment: value } },
        });
        const reads = store.get().reads;
        if (!result.ok) {
            log.warn(`enjoyment write for ${id} failed: ${result.message}`);
            publish({ reads: { ...reads, writes: reads.writes + 1, failed: reads.failed + 1 }, error: result });
            return Object.freeze({ ok: false, id, failure: result });
        }
        const items = store.get().items.map((item) => (item && item.id === id
            ? { ...item, annotations: { ...(item.annotations || {}), enjoyment: value } }
            : item));
        if (records.has(id)) {
            const held = records.get(id);
            records.set(id, { ...held, annotations: { ...(held.annotations || {}), enjoyment: value } });
        }
        publish({
            items: Object.freeze(items),
            reads: { ...reads, writes: reads.writes + 1 },
            error: null,
        });
        return Object.freeze({ ok: true, id, enjoyment: value });
    }

    async function setNotes(id, text) {
        if (typeof id !== 'string' || id === '') {
            throw new Error('createShotsStore: setNotes needs a shot id');
        }
        if (typeof text !== 'string') {
            throw new Error(
                'createShotsStore: a shot note is a string — "" clears it. The annotation is '
                + 'the authoritative field and the top-level shotNotes is its shadow, so '
                + 'nothing but annotations.espressoNotes is ever sent.',
            );
        }
        const result = await callRoute(transport, 'putShotsById', {
            params: { id },
            body: { annotations: { espressoNotes: text } },
        });
        const reads = store.get().reads;
        if (!result.ok) {
            log.warn(`note write for ${id} failed: ${result.message}`);
            publish({ reads: { ...reads, writes: reads.writes + 1, failed: reads.failed + 1 }, error: result });
            return Object.freeze({ ok: false, id, failure: result });
        }
        const patch = (record) => ({
            ...record,
            annotations: { ...(record.annotations || {}), espressoNotes: text },
            shotNotes: text,
        });
        const items = store.get().items.map((item) => (item && item.id === id ? patch(item) : item));
        if (records.has(id)) records.set(id, patch(records.get(id)));
        publish({
            items: Object.freeze(items),
            reads: { ...reads, writes: reads.writes + 1 },
            error: null,
        });
        return Object.freeze({ ok: true, id, notes: text });
    }

    return Object.freeze({
        subscribe: store.subscribe,
        get: store.get,
        readPage,
        loadShot,
        setEnjoyment,
        setNotes,
        /** The derivation for a loaded shot, or null. Never walks. */
        derivationOf: (id) => derivations.get(id) ?? null,
        /** The record for a loaded shot, or null. Never fetches. */
        recordOf: (id) => records.get(id) ?? null,
        /** Is there another page after this one? `total`, never the echoed `limit`. */
        hasMore() {
            const { total, offset, items } = store.get();
            return Number.isFinite(total) ? offset + items.length < total : false;
        },
        stop() {
            records.clear();
            derivations.clear();
            store.set({ ...EMPTY_STATE });
        },
    });
}
