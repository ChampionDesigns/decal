// THE SHOTS STORE — the History screen's one door to the shots routes.
//
// Wave 5.6, items `hist-shot-list-derivation`, `hist-b5-scalars-q17`, `hist-contract-check`.
//
// THESE ARE THE FIRST CALLERS. Until this file, every shots route in the table was
// `declared` — the conditional registry named them, `rea-shot-record.js` read their bodies,
// `shot-mirror.js` cached them — and NOTHING under src/ had ever asked ReaPrime for a shot.
// `rea-routes.js` says so in its own retirement note: the `shots`, `latestShot` and `shot`
// helpers were deleted for having zero consumers, "reachable by callRoute when a shots
// reader exists". This is that reader, and it reaches them the way that note says.
//
// ============================================================================
// EVERY ROUTE, CHECKED AGAINST THE HANDLER AS WRITTEN AT THE PIN 2b047d02
// ============================================================================
//
// `lib/src/services/webserver/shots_handler.dart`, read line by line while these calls were
// written — not from `rest_v1.yml`, not from the generated table, not from memory. Six
// routes are registered (`addRoutes`, :25-31); this file calls TWO of them and the write.
//
// EVERY `:NNN` BELOW RESOLVES IN THAT FILE AT THAT PIN — 316 lines, md5
// `7fa463a61909f5c2765552b519b3894b` — re-verified line by line in wave 5.6's fix pass, which
// is when two thirds of them were found drifting 1 to 3 lines (`c-spine-shell-1`). Not one
// BEHAVIOURAL claim moved; only the numbers pointing at them did. The citation is the durable
// half of a contract check and nothing re-checks it: Gate D re-verifies the handler FILE, the
// registration and the SYMBOL, never a line number. So re-extract the file
// (`git show <pin>:lib/src/services/webserver/shots_handler.dart`) and re-check the numbers
// the next time this header is edited, rather than carrying them forward on trust.
//
//   getShots           GET /api/v1/shots?limit&offset&order            `_getShots` :34
//        THE ONLY ETAG-CONDITIONAL SHOTS ROUTE, and only on its paginated branch:
//        `jsonOkConditional` at :98 (the empty-bean-batch early return) and :133 (the main
//        return). The transport sends `If-None-Match` here on its own — `conditional:'auto'`
//        meets `isConditionalRoute('/shots', query)` — and nothing in this file writes a
//        header. What this file does do is COUNT the 304s, because "the second read was
//        conditional" is a claim the wave has to be able to prove.
//
//        THE LIMIT IS CLAMPED IN THE QUERY AND ECHOED UNCLAMPED IN THE BODY. `:107`
//        clamps `limit.clamp(1,100)` for `getShotsPaginated` while `:136` echoes the raw
//        parsed `limit` into the response. Asking for 200 returns 100 items and reports
//        `limit: 200` (CB-23). So this store clamps ITSELF to 100 and pages on `total` and
//        `items.length`, never on the echoed limit.
//
//        `order` IS VALIDATED ON ONE BRANCH AND NOT THE OTHER. The ids branch checks it and
//        answers 400 (:73-78); the paginated branch is `final ascending = order == 'asc'`
//        (:89-90), so any other spelling is silently descending. This store refuses an
//        unknown order locally rather than sending one, for the same reason `buildQuery`
//        refuses `orderBy`: a sort that silently does nothing looks like a working sort.
//
//        AND THE ANSWER IS RE-ORDERED ON ARRIVAL — `orderShots`, below. The sort the
//        handler runs is real (`shot_dao.dart`, `OrderingTerm.desc(s.timestamp)`) and the
//        measured tablet honours it, but every surface downstream walks this list BY
//        POSITION, so "the shot before this one" meant whatever the wire's array order
//        meant and nothing checked it. Now the page is ordered here, from each record's
//        own `timestamp`, in the direction that was asked for. It is the same rule as the
//        line above, applied to the RESULT instead of to the request.
//
//   getShotsById       GET /api/v1/shots/<id>                          `_getShot` :176
//        Plain `jsonOk` (:183) — NOT conditional, on the one route where a 304 would be
//        worth the most (~221 KB). The id is `Uri.decodeComponent`d by the handler at :177,
//        so it is percent-ENCODED on the way out; `buildPath` does that for every path
//        parameter. 404 `{error:'Shot not found'}` when the id is unknown (:181).
//
//   putShotsById       PUT /api/v1/shots/<id>                          `_updateShot` :190
//        The enjoyment write-back. Four things read off the handler body, each of which
//        changes how the call is written:
//          * THE MERGE BASE IS THE WHOLE RECORD. `_deepMerge(existingShot.toJson(), patch)`
//            at :207 — `toJson`, with measurements — so a partial patch of
//            `{annotations:{enjoyment:n}}` cannot lose the samples. Sending a whole record
//            back would be the risky spelling, not the safe one.
//          * THE ECHO IS THE WHOLE RECORD TOO. `jsonOk(updatedShot.toJson())` at :223 —
//            ~221 KB comes back for a one-number write, the most expensive success in the
//            shots API. This store does not read it beyond `ok`, and does not re-derive
//            from it: annotations are not measurements and the walk would be a second walk.
//          * A MALFORMED BODY IS 500, NOT 400. `jsonDecode(body) as Map<String,dynamic>`
//            (:194) is inside the try, so a body that is valid JSON but not an object fails
//            the cast and lands in the catch-all `jsonError` (:226). The ONLY 400 is the
//            id-mismatch check at :196. A caller that treats 400 as "my body was wrong" and
//            500 as "the server broke" has it backwards here.
//          * THE LEGACY ALIASES ARE REWRITTEN ON EVERY PUT.
//            `_synchronizeLegacyAnnotationAliases` (:211, :276) copies
//            `annotations.espressoNotes` to top-level `shotNotes` and REMOVES `shotNotes`
//            when that annotation is null — likewise `extras`/`metadata`. The annotations
//            object is authoritative; the two top-level fields are its shadow. Write notes
//            through `annotations.espressoNotes` and never through `shotNotes`.
//
// AND THE THREE READ ROUTES THIS FILE DELIBERATELY DOES NOT CALL, named so the absence is a
// decision rather than an oversight:
//
//   getShotsLatest     GET /api/v1/shots/latest                        `_getLatestShot` :166
//        Meta-only, plain `jsonOk`, 200 with a body of literal `null` when nothing has ever
//        been stored. It is Live's "has a new shot landed" poll (CB-26). History reads a
//        PAGE; the newest shot is `items[0]` of that page with `order=desc`, already in
//        hand, so calling it would be a second request for a row we are holding.
//
//   getShotsIds        GET /api/v1/shots/ids                           `_getIds` :156
//        A bare array of every id — 321 of them on the capture fixture. The question it
//        answers ("how many are there") is answered by the list's own `total`, in the same
//        response as the page. Registered BEFORE `/shots/<id>` (:27 before :29) so shelf
//        picks the literal, which is why `/shots/ids` is not read as a shot called "ids".
//
//   getShots?ids=      the batch branch of the same route              `_getShots` :66-86
//        `ids=` with no filter takes a different branch and returns a BARE ARRAY of FULL
//        records — both compared shots in one request, which is genuinely attractive. It is
//        not taken in v1 for three reasons read off the branch: it is plain `jsonOk` (:85)
//        so the batch is never revalidated while the single reads can at least be cached
//        per id; an id that does not resolve is SILENTLY SKIPPED (:70, `if (shot != null)`)
//        so a short array cannot say which id was missing; and the shape switches under a
//        filter, so one call site would have to read two shapes. Two `getShotsById` calls
//        cost one extra round trip and answer both questions. Recorded as reversible.
//
// ============================================================================
// WHAT IS NOT HERE, AND IS NOT AN OMISSION
// ============================================================================
//
// NO PER-ROW FETCH. Q17 (DECISIONS.md, 16 Aug) resolved B5's open half: the list shows a
// DASH where a value is absent rather than downloading a ~221 KB shot to print "28 s" in a
// list cell. `fillMissingOutcomes` and the whole fetch-per-row machinery are not built, and
// `perRowFetches` below exists so a test can assert the count is exactly zero while the list
// paints. There is no scroll trigger, no visible-row queue and no "tried" set, because there
// is nothing for them to drive.
//
// ONE WALK PER RECORD. `derive` is injected so the count is observable, and a record already
// walked is never walked again — `derivations` is keyed by shot id. The store holds the
// derivation, not a second copy of the numbers.
//
// NO IDB MIRROR WIRED HERE. `shot-mirror.js` exists and is the recorded answer to
// `/shots/<id>` not being conditional, but wiring it is a caching decision with its own row;
// this store keeps its records in memory for the session and says so.

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
    /** The page as ReaPrime sent it — `items`, never `shots` (CB-21). */
    items: Object.freeze([]),
    /** The row model, one entry per item. The list, the picker and the tables read this. */
    rows: Object.freeze([]),
    /** Derivations by shot id — the one walk per record, held so nothing walks twice. */
    derivations: Object.freeze({}),
    /** `total` is the pager's truth. The echoed `limit` is not (CB-23). */
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

/**
 * The instant a shot record claims, as a number, or `NaN` when it claims none.
 *
 * ONE FIELD, AND IT IS THE MACHINE'S OWN CLOCK. `timestamp` is what ReaPrime sorts by
 * (`shot_dao.dart getShotsPaginated`, `OrderingTerm.desc(s.timestamp)`), what the list row
 * prints (`shot-summary.js shotClock`) and the only field on a list item that carries a
 * time at all — the payload is `id`, `timestamp`, `workflow`, `annotations`, `stopReason`.
 * The ID IS NOT A SECOND OPINION: it is a content hash, so ordering by it is ordering by
 * noise, which is the trap this function exists to not fall into.
 *
 * READ THE WAY `shotClock` READS IT. ReaPrime writes `timestamp.toIso8601String()` over a
 * local `DateTime`, so the string carries no `Z` and no offset and is local time. Whether
 * the engine resolves that to one instant or another does not matter to an ORDER — the
 * map from string to number is monotonic and every row in a window goes through it — but
 * agreeing with the module that PRINTS the stamp is what keeps the list's order and the
 * list's captions telling one story.
 *
 * MICROSECONDS ARE TRUNCATED, and that is a real limit rather than a rounding note.
 * ReaPrime emits six decimal places (`2026-08-29T13:30:51.851461`) and `Date.parse` keeps
 * three, so two shots inside one millisecond compare EQUAL here. That is honest: at that
 * resolution the field does not tell them apart, and `orderShots` below resolves the tie
 * by arrival rather than by inventing a rule.
 */
function shotInstant(item) {
    const raw = item && typeof item === 'object' ? item.timestamp : null;
    if (typeof raw !== 'string' || raw === '') return NaN;
    return Date.parse(raw);
}

/**
 * A PAGE OF SHOTS IN TIME ORDER — the client's own answer, not the array the wire sent.
 *
 * WHY THE CLIENT ORDERS AT ALL, when the handler has an `ORDER BY` in it. Every surface
 * that walks this list walks it BY POSITION: the Live band's arrows step an integer index
 * (`live-wiring.js #onShotStep`), the History list paints rows top to bottom, and the
 * comparison pickers offer them in the order they are handed. So "the row after this one"
 * is answered by array position and by nothing else, and until this function existed the
 * meaning of that position was entirely the server's to decide. Measured 30 August 2026:
 * with a page emitted in any order but time order, "Older" walked the emission verbatim —
 * from 08:40 to 13:30 to 08:06 to 11:38 — which is Ben's report exactly ("it doesn't show
 * the previous but some other shot, like the order is all messed up").
 *
 * The tablet's own server is not doing that today: all 921 shots on 192.168.1.73 read
 * strictly timestamp-descending across ten pages (read-only, 30 Aug 2026). This is the
 * client refusing to hold a claim it never checked — the same rule `readPage` already
 * applies to the `order` spelling it sends, and for the same stated reason: a sort that
 * silently does nothing looks like a working sort.
 *
 * THE TIE-BREAK IS ARRIVAL ORDER, EXPLICITLY. `Array.prototype.sort` is stable by spec,
 * but a comparator that returns 0 leaves "stable across duplicates" resting on that fact
 * rather than saying it, so the decorated index is compared outright. Two shots at one
 * instant therefore keep the order the server gave them, for ever and on every engine —
 * and the arrows visit both rather than skipping one.
 *
 * A RECORD WITH NO READABLE STAMP SORTS LAST, in BOTH directions, and keeps its arrival
 * order among its own kind. It cannot be placed in time, and the two ends of the list are
 * the two places it would do damage: the head is the shot the Live band opens on and the
 * shot `askShots()` spends 221 KB fetching, and the tail is where the arrows stop. "Not
 * placeable" is not "newest", and it is not "oldest" either — it is out of the running.
 *
 * @param {Array} items    the page as the wire sent it
 * @param {string} order   `SHOT_ORDER.NEWEST_FIRST` or `SHOT_ORDER.OLDEST_FIRST`
 */
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

/**
 * @param {object} deps
 * @param {object} deps.transport                 a `createReaTransport(...)` client
 * @param {object} [deps.logger]
 * @param {(record: object) => object} [deps.derive]  gate 6's walk; injected so it is countable
 * @param {string} [deps.dash]                    the one absent mark, passed to the row model
 */
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

    /**
     * Read one page of the list.
     *
     * `limit` is clamped HERE because the handler clamps silently and echoes what it was
     * asked, so a caller that asked for 200 and read the echo would page for ever over the
     * same hundred rows.
     */
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
            /* IN THE ORDER THIS STORE ASKED FOR, decided here from each shot's own
             * `timestamp` rather than taken from the array's arrival order — see
             * `orderShots`. One ordering owner, so the band's arrows, the History list
             * and the comparison pickers cannot disagree about which shot comes next.
             * A page the server already ordered passes through unchanged. */
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

    /**
     * The full record for one shot, and its derivation — ONE fetch and ONE walk per id.
     *
     * This is the only route in the client that costs ~221 KB, and it is called for a shot
     * a person picked, never for a row a list happened to paint. `reads.perRow` is not
     * incremented anywhere in this file, which is the point.
     */
    async function loadShot(id) {
        if (typeof id !== 'string' || id === '') {
            throw new Error('createShotsStore: loadShot needs a shot id');
        }
        if (records.has(id)) {
            return Object.freeze({ ok: true, id, record: records.get(id), derivation: derivations.get(id), cached: true });
        }
        /* CONCURRENT CALLERS JOIN ONE REQUEST. The memo above only fills when a fetch has
         * RESOLVED, so two asks for one id inside the same tick each issued their own —
         * 221 KB and a full gate-6 walk, twice, for the shot this store promises to fetch
         * and walk exactly once. Reachable the moment two surfaces want the same shot: the
         * History screen opens on the newest one and a person picks that same one, and the
         * suite caught it as a third record at one geometry and not the other, which is
         * what a race looks like from the outside. */
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

    /**
     * Write ReaPrime's own per-shot rating.
     *
     * `{annotations:{enjoyment:n}}` and nothing else. The handler deep-merges over the whole
     * stored record, so the patch is the smallest thing that says what changed; sending the
     * record back would put every field at risk of a round trip it did not need.
     *
     * `null` CLEARS the rating and is a legitimate value, not an absence:
     * `parseOptionalDouble(null)` is null and `ShotAnnotations.toJson` then omits the key.
     * `undefined` is refused, because a body with no enjoyment key is a request that says
     * nothing.
     *
     * The id is NOT put in the body. The handler 400s only when a body id DISAGREES with the
     * path (`_updateShot` :196); omitting it cannot disagree.
     */
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
        /* THE LIST ROW IS UPDATED FROM WHAT WE SENT, NOT FROM THE ECHO — and not by
         * re-reading the page. The value is ours, the merge is additive, and the alternative
         * is a second ~221 KB body or a second list request to learn a number we chose. If
         * the server refuses, the branch above runs and nothing moves. */
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

    /**
     * Write the note a person keeps about a shot (Ben's decision D14, 30 August 2026).
     *
     * `{annotations:{espressoNotes:text}}` and nothing else — the same smallest-honest-patch
     * rule `setEnjoyment` above follows, for the same reason read off the same handler: the
     * merge base is `existingShot.toJson()` with measurements included, so a partial patch
     * cannot lose a sample, and sending the record back would put every field at the mercy
     * of a round trip it did not need.
     *
     * IT WRITES THE ANNOTATION AND NEVER THE TOP-LEVEL `shotNotes`, which is this file's own
     * header rule (`putShotsById`, fourth bullet) and the contract row's:
     * `_normalizeLegacyAnnotationPatch` folds a top-level `shotNotes` into
     * `annotations.espressoNotes` and DELETES it from the patch, and
     * `_synchronizeLegacyAnnotationAliases` then rewrites the top-level field from the
     * merged annotations on every PUT. The annotations object is authoritative; the
     * top-level field is its shadow. A client that writes the shadow is writing to a place
     * the server is about to overwrite from somewhere else.
     *
     * `''` IS A LEGITIMATE VALUE AND MEANS "there is no note", not "say nothing". A person
     * who selects their note and deletes it has made a statement, and an empty string is
     * how that statement reaches the wire; `null` is refused rather than silently treated
     * as the same thing, because `ShotAnnotations` distinguishes them and this store is not
     * the place to decide they are the same. Anything that is not a string is a caller bug.
     */
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
        /* UPDATED FROM WHAT WE SENT, NOT FROM THE ECHO — `setEnjoyment`'s rule, and the
         * reason is the same 221 KB. The TOP-LEVEL SHADOW IS MOVED TOO, because the server
         * has just rewritten it from the annotation and a held record that disagrees would
         * make a reader's precedence rule (annotation first, shadow second) answer with a
         * value that no longer exists anywhere. */
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
