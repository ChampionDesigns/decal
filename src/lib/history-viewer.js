/**
 * history-viewer.js — the History screen's logic, per instance. Wave 5.6, rows
 * `hist-port-history-viewer`, `hist-compare-bar`, `hist-tests-intent`.
 *
 * THE PORT OF `slate/app/src/modules/history-viewer.js`, whose count is
 * `slate-audit-2026-08-16/scope/e2-history-viewer.md`: 1,282 lines, of which the v1
 * surface is 985 and the v1 CARRY is ~600 lines of EDITED logic. This file and
 * `src/lib/history-compare.js` are that carry; `src/lib/shot-summary.js`,
 * `src/lib/history-series.js`, `src/stores/shots-store.js` and
 * `src/lib/alignment-offset.js` are the rest of it, landed earlier in this wave.
 *
 * IN `src/lib/` AND NOT `src/screens/`, WHICH IS THE PORT'S OWN VERDICT ON ITSELF. SCOPE
 * Part 2 §2 puts plain, DOM-free ES modules here, and the whole point of the structural
 * conversion is that there is nothing left in this logic that needs a document. The old
 * suite had to install a DOM shim before it could import the module at all
 * (`slate/app/test/dom-shim.mjs`), and two further suites tested a COPY of the logic
 * re-implemented inline because the real module touched the DOM at import. Being
 * importable by `node:test` in milliseconds is what makes that scaffolding unnecessary,
 * and it is a property this file has to keep rather than a comment it gets to make.
 *
 * DOM-FREE. It takes a HOST with `requestUpdate()` — which is every Lit element and is
 * also a two-line object in a `node:test` — and it never touches an element, a document
 * or a style. The old module's coupling, measured in the count: 37 `document.` refs, 25
 * `getElementById` over 15 distinct id forms, 11 `createElement`, 13 `dataset` writes and
 * 3 `innerHTML`. All of it became the component tree, so this file has none of it, and
 * `test/history-viewer.test.mjs` runs it with no browser at all.
 *
 * ===========================================================================
 * PER-INSTANCE, WHICH IS THE STRUCTURAL CHANGE
 * ===========================================================================
 * Slate's viewer is a MODULE SINGLETON: 92 references to one module-level `state` object
 * and 20 to one `hvPlots`. Two viewers could not exist, so "the History screen" and "the
 * History screen in a gallery entry, in a fixture, and in a capture battery frame" were
 * the same three shots and the same one offset. Here the state is fields of an instance:
 * two viewers over one store hold independent selections, independent offsets and
 * independent failures, and the suite asserts exactly that.
 *
 * IT IS ALSO WHY THE STORE IS INJECTED rather than imported as a singleton — the rule
 * `live-stores.js:7-12` states for the whole tree. A viewer owns no cache: the records
 * and the derivations are the store's, so a second viewer over the same store re-walks
 * nothing (`walks` is counted and the suite reads it).
 *
 * ===========================================================================
 * WHAT DOES NOT COME ACROSS, EACH ONE NAMED SO THE DROP READS AS A REMOVAL
 * ===========================================================================
 * FOUR DOCUMENTED FEATURES THAT DO NOT RENDER TODAY, read off the file's comments rather
 * than off the screen, and none of them ports into v1:
 *
 *   1. THE P-Q CORRESPONDENCE MARKS. `pqTraces` has zero callers. E2's unclear block U1
 *      (80 lines) and register question Q16 — which fix run 6 ANSWERED by building them:
 *      `history-power.js` `correspondenceMarks` ports the arithmetic and its reasoning,
 *      and `history-power-page.js` draws them. The LOOK is pinned for Ben's bench pass;
 *      the mechanism is no longer deferred.
 *   2. THE VERTICAL STEP-NAME LABELS. `stepAnnotations()`'s output is assigned to layout
 *      objects no renderer receives (see chart-C8 / H7 below). The step names DO render
 *      here, through `<ui-chart-card>`'s own label rules, which is a different mechanism
 *      that was already working.
 *   3. THE P-Q TIME KEY (#11) and every `--ui-timekey-*` consumer. BUILT by fix run 6 —
 *      `<ui-time-key>` is component #11 and the power page is its first consumer, which
 *      is where the two orphaned tokens finally got readers.
 *   4. THE RIGHT-HAND y2 AXIS on both charts. `uplot-plot.js` builds a y2 only if the
 *      spec asks for one and neither chart factory accepts one, so Power drew on an
 *      invisible auto-ranged axis. FIXED, not ported: `<ui-chart-card>`'s `y2` property
 *      asks for one, states its range, and the power page's right axis is visible with
 *      its own ticks. The flow page still has no y2 and does not want one.
 *
 * chart-C8 / H7 — THE DEAD-BUT-EXECUTED PLOTLY STRATUM. `buildExpandedLayout` is called
 * on a LIVE render path, its Plotly-shaped result mutated with `stepShapes()` and
 * `stepAnnotations()`, and then never read — on every viewer render, three times. None of
 * that lineage ports AND NEITHER DO THE SHAPE TESTS THAT PIN IT: a test asserting on
 * trace objects nothing renders is a test of the wrong thing, and a rewrite that deletes
 * the stratum would fail tests that were never testing the renderer. Nothing in this
 * file builds a layout object, and nothing under `test/` asserts on one.
 *
 * SIX COUNTED DEFECTS ARE SPECIFICATION INPUT, not behaviour to preserve. Where each one
 * dies:
 *   - `resampleOnto` holds the last value across a gap -> `history-compare.js`, checked
 *     against `gap-contract.js`'s seven claims, and the gap renders.
 *   - `stepRules()` hard-codes one dash and drops opacity -> `comparisonStepRules`, whose
 *     dash is a name in the one table and whose alpha is B's own.
 *   - `trajectoryPoints` pairs flow and pressure BY INDEX -> there is no index pairing in
 *     the port; the one correspondence is the union clock, which is pairing by x.
 *   - the Out column prints `0.0 g` where its docblock promises a dash -> `shot-summary.js`
 *     gates on presence, not truthiness, and the sentinel string does not exist.
 *   - the fetch gate requires duration AND yield missing, so it reduces to "no
 *     actualYield" -> DELETED, not repaired. B5 / Q17 (DECISIONS.md, 16 Aug): the scalars
 *     are computed in the skin from the single walk and an absent value is a dash. There
 *     is no `fillMissingOutcomes` here, no pending queue and no code path to one; the
 *     store's `reads.perRow` is the instrument and its only correct value is 0.
 *   - the alignment restyle reaching into the live plot -> offset-as-redraw, below.
 *
 * NO `localStorage` READ. Slate reads two experimental flags straight off it
 * (`history-viewer.js:106-107`) and the theme elsewhere. Both flags are routed in
 * `storage-routes.js` on the KV layer at `machine-advanced`, and in v1 NEITHER HAS A
 * READER — D1 keeps the derived/fused channels out of the baseline, so the row fixes the
 * layer without a consumer. The theme is `theme.js`'s controller and `<app-root>`'s. This
 * file therefore reads no storage at all, by absence rather than by exemption.
 *
 * ===========================================================================
 * OFFSET-AS-REDRAW
 * ===========================================================================
 * A new offset is a NEW STATE, not a reach into anyone's trace list. Slate's version
 * walked the live plot for traces tagged `meta.slot === 'b'` and rewrote their x arrays
 * in place, because a full redraw was assumed expensive; it addressed one index past the
 * end, the renderer threw, a catch swallowed it (`history-viewer.js:1007-1018`) and the
 * control did nothing at all. A redraw is 4 ms. So the offset is applied where the
 * series are BUILT — `history-series.js` `abRecords`, through `shiftSeriesX` — and this
 * file holds the number and nothing else.
 *
 * THERE IS NO `catch` IN THIS FILE, and that is load-bearing rather than tidy. The store
 * answers a failed read with a typed result the screen can show; a programmer error
 * (no id, a non-number where a nullable double belongs) throws and is meant to. A
 * `try/catch` around either would be the swallowing catch again, wearing a rewrite's
 * name. `test/history-viewer.test.mjs` drives the slider to both ends and past the
 * shorter trace's end with `process.on('uncaughtException')` armed, which is the ported
 * suite's intent expressed as behaviour instead of as a source match (A8).
 */

import {
    ALIGNMENT_SLOT,
    alignmentControlState,
    alignmentOffsetAfterSlotChange,
    clampAlignmentOffset,
} from './alignment-offset.js';
import { comparisonStepRules, compareOnOneClock, comparisonWindow } from './history-compare.js';
/* The typed failure's own reader — `rea-errors.js`'s, so the server's words reach a
 * screen through the function written for it rather than through a second unwrapping
 * of `problem` invented here. Its docblock states the split this file keeps: "Never a
 * UI string - no punctuation decisions, no i18n ... A screen formats it." */
import { reaMessageOf } from '../data/rea-errors.js';
/* The DEFAULT `t` below, and nothing else. `interpolate` is i18n.js's one owner of
 * the {name} placeholder rule — key-as-fallback with the params filled in, which is
 * exactly what the real `t` returns for a key it does not hold — so a caller with no
 * controller (a node test, a store) still gets a finished English sentence, and this
 * module still spells no placeholder logic of its own. i18n.js has no DOM and no
 * import-time I/O, which is the property that lets it be imported from here. */
import { interpolate } from './i18n.js';

/** A host that does not want to be told. Keeps the constructor's contract one line. */
const SILENT_HOST = Object.freeze({ requestUpdate() {} });

const EMPTY_ROWS = Object.freeze([]);

/**
 * The one page of shots the pickers offer.
 *
 * A COUNT, NEVER A HEIGHT. It is the generated table's own default and the handler's own
 * clamp point; the store clamps it again because the handler echoes what it was asked
 * (CB-23), so a caller that paged on the echo would page for ever over the same rows.
 */
export const HISTORY_PAGE_SIZE = 20;

export class HistoryViewer {
    /**
     * @param {object} options
     * @param {object} options.store  a `createShotsStore(...)`. Injected, never imported
     *        as a singleton, and never built here: one store per app, many viewers.
     * @param {object} [options.host]  anything with `requestUpdate()`.
     */
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

    /** The two slots, by shot id. PER INSTANCE — Slate's one module-level `state`. */
    #ids = { a: null, b: null };

    /** The alignment offset in force, in seconds. Per instance for the same reason. */
    #offset = 0;

    /** Which slot the discs mark. View state; the offset's sign follows it. */
    #activeSlot = ALIGNMENT_SLOT.REFERENCE;

    /** The last store snapshot seen. Held so a getter never has to re-read mid-render. */
    #snapshot = null;

    /* ---- lifecycle ---------------------------------------------------------- */

    /**
     * Subscribe and read the first page.
     *
     * ONE LIST READ, and the route is the only conditional one in the shots family
     * (`rea-conditional.js`), so a second visit inside the ETag's life costs a 304 and no
     * body. No shot is loaded here: a record is ~221 KB and is fetched for a shot a
     * person picked, never for a row a list happened to paint (B5 / Q17).
     *
     * @returns {Promise<object>} the store state after the page landed
     */
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

    /* ---- what the screen reads --------------------------------------------- */

    /** The store snapshot, read through one accessor so nothing here caches a stale one. */
    get state() {
        if (!this.#snapshot) this.#snapshot = this.#store.get();
        return this.#snapshot;
    }

    /** The row model the list and the tables draw. The store publishes it; this passes it. */
    get rows() {
        return this.state.rows ?? EMPTY_ROWS;
    }

    /**
     * The pickers' options, `[{value, label}]` — #7's own shape.
     *
     * THE LABEL IS THE CLOCK FIRST, and `shot-summary.js` carries Slate's reason with it:
     * two shots of one profile on one morning is the ordinary case, so a title-first
     * label names both identically — the one thing a comparison label must not do. The
     * mock earns it twice over, since all twenty fixture rows share one profile title.
     */
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

    /**
     * The typed failure the store last reported, VERBATIM, or null.
     *
     * Not re-worded and not swallowed. A screen that turned "404 at /shots/<id>" into
     * "something went wrong" would be the swallowing catch with better manners.
     */
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

    /* ---- what the screen calls --------------------------------------------- */

    /**
     * Put a shot in a slot, and load it if it is not already held.
     *
     * CHOOSING A NEW COMPARISON SHOT RESETS THE ALIGNMENT, and the ported suite says why:
     * an offset chosen for one pair, silently applied to another, is an alignment nobody
     * asked for and nobody can see is wrong. Clearing B resets it too.
     *
     * NO `catch`. `loadShot` answers a failed read with `{ok: false, failure}` — which
     * reaches `failure` above unchanged — and throws only on a programmer error.
     *
     * @param {'a'|'b'} slot
     * @param {string|null} id  null clears the slot
     */
    async select(slot, id) {
        const key = slot === ALIGNMENT_SLOT.MOVING ? 'b' : 'a';
        const next = typeof id === 'string' && id !== '' ? id : null;
        if (this.#ids[key] === next) return null;
        this.#ids = { ...this.#ids, [key]: next };
        /* THE RULE IS THE POLICY MODULE'S, not a literal zero here: Slate resets on the B
         * slot only, and whether changing A should reset too is the one entry in that
         * module's deferred-questions ledger. One line there flips both call sites — this
         * one and `<ui-compare-bar>`'s own `applySlotChange`. */
        this.#offset = alignmentOffsetAfterSlotChange(this.#offset, key);
        this.#host.requestUpdate();
        if (!next) return null;
        return this.#store.loadShot(next);
    }

    /**
     * The offset the compare bar applied.
     *
     * CLAMPED HERE AS WELL AS THERE, and that is not a second policy: both call the one
     * function in `alignment-offset.js`, so what a consumer reads back is what is applied
     * — "no two controls can disagree" (`history-viewer.js:1146`). A viewer driven by a
     * test or a gallery entry rather than by the bar gets the same guarantee.
     *
     * @returns {number} the offset actually applied
     */
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

    /**
     * Mark a slot — which picker the discs show as selected.
     *
     * IT DOES NOT TOUCH THE OFFSET, and the distinction is the one Slate's own rule turns
     * on: the offset resets when the SHOT in the moving slot changes, because an
     * alignment chosen for one pair means nothing for another. Marking a disc changes no
     * shot. Resetting here would throw away an alignment for a glance at the other
     * picker, which is the "control that silently does something nobody asked for" half of
     * the same family of defect as a control that silently does nothing.
     */
    setActiveSlot(slot) {
        const next = slot === ALIGNMENT_SLOT.MOVING ? ALIGNMENT_SLOT.MOVING : ALIGNMENT_SLOT.REFERENCE;
        if (next === this.#activeSlot) return this.#activeSlot;
        this.#activeSlot = next;
        this.#host.requestUpdate();
        return this.#activeSlot;
    }

    /* ---- the comparison, built outside the renderer -------------------------- */

    /**
     * The two shots on one clock, for a given channel list.
     *
     * THE ONLY REASON A SCREEN CALLS THIS is to know WHERE the comparison sits — the x
     * window below. The traces themselves go to the plot as whole `{x, y}` bundles
     * (`history-series.js` `abRecords`), because the plot layer's `alignChannels` forms
     * the same union with the same policy and handing it resampled columns would be two
     * walks to draw one chart.
     */
    compare(channels) {
        return compareOnOneClock({
            channels,
            a: this.derivationA,
            b: this.derivationB,
            offset: this.#offset,
        });
    }

    /**
     * The x window both shots occupy at this offset — `{min, max, span, empty}`.
     *
     * B slid to the negative end of the +/-5 s limit runs before its own origin, and a
     * plot whose x scale opens at a hard zero clips it. See `comparisonWindow`.
     */
    window(channels) {
        return comparisonWindow(this.compare(channels));
    }

    /**
     * Both shots' step boundaries, as `setRules`'s shape.
     *
     * `paint` is the caller's, read from tokens on the element that has them: this file
     * holds no colour and no width (A6 — a module that named a colour would be a private
     * palette the guard cannot see).
     */
    stepRules(paint) {
        return comparisonStepRules({
            a: this.derivationA,
            b: this.derivationB,
            offset: this.#offset,
            paint,
        });
    }

    /* ---- private ------------------------------------------------------------ */

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

/**
 * THE TYPED FAILURE, AS THE TWO SENTENCES A REFUSAL SURFACE SHOWS. `null` when there is
 * no failure — which is the whole of the caller's branch.
 *
 * IT EXISTS BECAUSE `failure` HAD NO READER, and that was measured rather than inferred:
 * with a transport answering `{ok: false, status: 500}` to every request, the screen
 * rendered "Back A B", a picker with zero options and two empty states reading "No shot
 * selected" — a machine that ANSWERED 500 was indistinguishable from a machine with no
 * recorded shots. Nothing threw and nothing was swallowed; the report simply had nowhere
 * to go. The getter above promises the store's failure reaches the screen VERBATIM, and
 * a promise with no reader is the swallowing catch with better manners.
 *
 * THE MACHINE'S WORDS ARE NOT TRANSLATED AND NOT RE-WORDED: the heading IS
 * `reaMessageOf(failure)` — the server's `error`/`message` body, or the transport's own
 * sentence for a request that never reached it. Only the frame around it is a translated
 * string (D2), and it states the ONE fact the message may not carry: what the machine
 * answered, or that it did not answer at all (`status` is null for network/timeout —
 * `rea-errors.js`'s own contract).
 *
 * DOM-FREE, like everything else here: `t` is passed in, so this module still knows
 * nothing about `I18nController`, and a `node:test` calls it with one argument — the
 * default is i18n.js's own key-as-fallback, so the sentence comes back finished.
 *
 * @param {object|null} failure  the store's typed failure, verbatim
 * @param {(key: string, params?: object) => string} [t]
 * @returns {{heading: string, body: string}|null}
 */
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
