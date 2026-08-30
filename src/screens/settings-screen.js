/**
 * settings-screen.js — <settings-screen>, the Settings master–detail shell.
 * SCOPE Part 5 §4; `LAYOUT_SPEC_DRAFT.md` §4.4; wave 5.4 (wf-w5p4-settings).
 *
 * ===========================================================================
 * THE GRID  (§4.4, quoted)
 * ===========================================================================
 *
 *     <settings-screen>              display:grid; height:100%
 *       grid-template-rows: var(--ui-band-h) minmax(0,1fr)
 *
 *       ├─ <page-header>             #31, commit mode (D11)
 *       └─ <master-detail>           display:grid; gap: var(--ui-seam)
 *            grid-template-columns: minmax(200px,16%) minmax(220px,22%) minmax(0,1fr)
 *            @container (inline-size < 1100px) -> two columns, nav collapsed, breadcrumbed
 *
 *            ├─ <nav-column>         search field (auto) + category list
 *            ├─ <subnav-column>      leaf list
 *            └─ <leaf-pane>          overflow-y:auto; leaf at one measure, centred
 *
 * Two rows, and the seam between them is the header's underline: display, gap and ground
 * come from the seam utility via the classes added to the HOST in connectedCallback,
 * because a `.seam-grid` rule inside this shadow root can never match its own host
 * (CONVENTIONS §13 (b)). Same construction as `live-screen.js` and `selector-screen.js`.
 *
 * THE GRID HAS EXACTLY TWO CHILDREN. §4.4 names two and this root has two.
 *
 * ===========================================================================
 * WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT
 * ===========================================================================
 * OWNS: the boxes, the composition, the navigation state (which category, which leaf,
 * what was searched) and the wiring between the nav model and the rows.
 *
 * DOES NOT own: a storage key, a limit, a colour, a capability gate, an endpoint, a
 * leaf's contents, or the Save wording. Each has a row of its own in this wave —
 * `b7-storage-routing` resolves every read/write through `src/lib/storage-routes.js`,
 * limits come through the R2 door (`r2MachineLimits`), gates are the served capability
 * array (A3), and D11's sentence is #31's and is never written per screen. This file
 * imports nothing from `src/data/` and nothing from `src/stores/`.
 *
 * ===========================================================================
 * THE ONE-PRIMITIVE CLAIM, AND WHERE IT IS NOW BUILT
 * ===========================================================================
 * §4.4 projects that "this one primitive covers ~30 of the 37 leaves". AS BUILT THE
 * MEASURED NUMBER IS 19, NOT ~30, and the two numbers that get confused here were never
 * the same quantity:
 *
 *   37  leaves in `settings-nav.js`
 *   28  CLASSIFIED primitive — `leafKind()` is NOT-in-`BESPOKE_LEAVES`, a classification
 *       by exclusion (`settings-leaves.js`), never a count of leaves that draw a row
 *    9  bespoke, §4.4's own nine
 *   19  leaves that actually COMPOSE #29 (23 rows over 19 distinct leaves), of which 18
 *       are primitive — the nineteenth is `display-skin`, a bespoke leaf carrying D8's
 *       button row
 *   10  primitive leaves that render a heading and nothing else
 *
 * The shortfall is DECLARED, not hidden: eight of those ten carry a `PENDING_ROWS` entry
 * naming the owner that would build the row, `updates-firmware-update` carries the single
 * `LEAF_NOTE` (D4), and `calibration-default-load-settings` holds zero rows and zero note
 * because it is F3/Q1's leaf and the screen law forbids anything there. The registry is
 * honest; it was the headline that was not. Restating §4.4's projection against the
 * measured 19 is an audit-corpus edit and is recorded as a deferred question.
 *
 * The one-primitive LAW is intact and is the thing that actually matters: no second row
 * shape for a leaf #29 can express — one `ui-settings-row` definition tree-wide, five
 * archetype branches and no sixth that draws.
 *
 * The nine bespoke ones are declared. The skeleton owed them a box whose width they
 * cannot change and a floor they cannot forget; wave 5.4's leaf cluster fills it with
 * ONE renderer — `<settings-leaf>` — over a data registry (`src/lib/settings-leaves.js`).
 * The placeholder that stood here is gone, and this file gained no branch: a leaf is a
 * leaf id and a model, and every difference between two leaves is data.
 *
 * The pane still owns the measure, this screen still owns no width, and the leaf still
 * declares none — which is T1/T21 unchanged by the leaves landing.
 *
 * ===========================================================================
 * D11 — THE COUNT CROSSES, AND NOTHING ELSE
 * ===========================================================================
 * #31 is in `commit` mode, which is where D11's wording lives: "Save (3)" at a dirty
 * count and "Save" at zero, decided in `ui-page-header.js` and nowhere else. THIS
 * WAVE SUPPLIES THE COUNT: `change-count` is a Number property on this screen, default
 * 0, handed straight to the band. Slate's `commitView` object name and `primaryLabel`
 * were both deleted by D11, and a screen that composed the sentence itself would be
 * putting them back.
 *
 * WHAT MAKES IT NON-ZERO (the leaves' rows, wave 5.4): a preference this skin stores is
 * written the moment it changes — losing a setting by walking away is the defect B7
 * exists to remove — while a field of the MACHINE's own settings document is staged, and
 * the count is the number of staged fields. One Save, one POST carrying the subset. That
 * is Slate's own shape (`settings.html:7` `#save-settings-btn`) rather than a commit
 * model invented here.
 *
 * THE BAND CARRIES CANCEL AND SAVE AT EVERY COUNT (Ben, 25 August 2026). This sentence
 * used to end "which is why the band reads 'Close' until you touch the machine", and that
 * was true of a shape that was tried and retired: a header whose buttons appear and
 * disappear as you touch things is a header you have to look at before you can leave. The
 * count still decides the WORDING and the FILL, which is all D11 ever claimed.
 *
 * The band emits ONE event for both states (`commit`, with `dirty` in the detail) plus
 * `cancel`. Dirty commit -> the model writes; clean commit -> Close, which leaves the
 * screen. Leaving the SKIN is a different control and a different row (D8): one button,
 * on a settings row, in the Skin leaf.
 *
 * ===========================================================================
 * D2
 * ===========================================================================
 * Every readable string is a value read through I18nController, from this file's first
 * commit — English only in v1, mechanism never deferred. The nav model's names are
 * content and arrive as values: `t(navName(node))`, one call, on both the browse path
 * and the search path (T12).
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    SETTINGS_TREE,
    NAV_KIND,
    navName,
    categoryFor,
    categoryOf,
    leafFor,
    isSearching,
    searchSettings,
    leavesFor,
    leafShownOn,
} from 'src/lib/settings-nav.js';

import 'src/screens/settings-master-detail.js';
import 'src/screens/settings-nav-column.js';
import 'src/screens/settings-leaf-pane.js';
import 'src/screens/settings-leaf.js';
import 'src/screens/settings-bespoke-leaf.js';
import 'src/components/ui-numeric-keypad.js';

/* THE BOXES' CONTENT — every one a library component, composed. §4.4's component list
 * for this screen. A hand-built copy of any of them is scope invention (Part 10 §9). */
import 'src/components/ui-page-header.js';
import 'src/components/ui-search-field.js';
import 'src/components/ui-nav-row.js';
import 'src/components/ui-subnav-row.js';
import 'src/components/ui-button.js';
import 'src/components/ui-empty-state.js';

import { NAV_LEVEL } from 'src/screens/settings-master-detail.js';

/**
 * THE ONE LEAF WHOSE PENDING CHANGE IS NOT A SETTINGS ROW.
 *
 * Named here rather than typed into the getter that reads it, for the reason `DENSITY_ROW`
 * is exported from the registry: a screen matching on a hand-typed id is how a page quietly
 * stops behaving the day somebody renames a leaf. See `#ledPending`.
 */
const LIGHTING_LEAF = 'accessories-lighting';
import { DEFAULT_ROUTE_ID as HOME_ROUTE } from 'src/lib/app-routes.js';
import { settingsModelFor, settingsBespokeFor } from 'src/screens/settings-model.js';
import { DENSITY_ROW, LEAF_KIND, leafKind } from 'src/lib/settings-leaves.js';
import { applyDensity } from 'src/lib/density.js';
import { FEED } from 'src/stores/live-stores.js';

/**
 * Decent's own quick-start guide.
 *
 * SLATE'S URL, carried rather than re-derived (`settings.js:1932`). One constant, named,
 * because a bare URL inside an event handler is a thing nobody finds when it changes.
 */
const QUICKSTART_GUIDE_URL = 'https://decentespresso.com/doc/quickstart/';

/**
 * WHY A SAVE WAS REFUSED, in words a person can act on.
 *
 * `commit()` answers `COMMIT_REFUSAL.NO_MACHINE_PORT` or `.WRITE_FAILED` and this screen
 * discarded both — a handler with no display, which the behaviour audit filed as a half
 * with no other half. It became visible on 26 August 2026 when Save started leaving the
 * screen on success: a refused write that also navigated away would be a change silently
 * lost, which is the exact shape B7 exists to prevent.
 *
 * TWO REASONS AND A THIRD FOR ANYTHING ELSE. A reason the model grows later prints the
 * general sentence rather than nothing at all, because a blank line under the header is
 * indistinguishable from a save that worked.
 */
const COMMIT_REFUSAL_TEXT = Object.freeze({
    noMachinePort: 'Nothing was saved — this tablet is not connected to a machine.',
    writeFailed: 'The machine refused the change. It may be busy, or not connected.',
    unknown: 'Nothing was saved. The change is still here — try again.',
});

/**
 * WHY A PREFERENCE DID NOT STICK — the other refusal, on the other path.
 *
 * A MACHINE row stages and reports through `commit()`. A ROUTE row — a preference this
 * skin stores — writes the moment it changes, so it has no Save to report through, and
 * `settings-store.js` grew a seam for exactly that: `onWriteFailure(listener)`, documented
 * as "THE SURFACING SEAM — the reason this store can claim a failed write is not silent. A
 * screen subscribes once and shows the failure."
 *
 * NO SCREEN EVER DID. A full listener registry with unsubscribe, four tests exercising it,
 * and zero production subscribers — so a preference that failed to persist left the
 * control snapped back to its old value with nothing said, which is the units.js silent
 * revert the store was built to prevent, one layer up. The behaviour audit filed it; this
 * is the subscriber it was waiting for.
 */
const WRITE_REFUSAL_TEXT = Object.freeze({
    backendFailed: 'That preference could not be saved on this device.',
    capabilityNotPresent: 'This machine does not have that feature.',
    unknown: 'That preference could not be saved.',
});

export class SettingsScreen extends UiElement {
    static properties = {
        /**
         * The app shell's boot object, handed down by <app-root> at creation
         * (`app-root.js:272`). This screen reaches no route through it — the leaves'
         * own rows do — but the door is where every other screen puts it.
         */
        boot: { attribute: false },

        /**
         * D11's count, and the only thing this screen tells the band. A number.
         * `ui-page-header` coerces a negative, fractional or unparseable value to zero
         * changes, because a false-dirty Save is worse than no dirty state.
         */
        changeCount: { type: Number, attribute: 'change-count' },

        /** The selected category id. Settable, so a harness state is one attribute. */
        categoryId: { type: String, attribute: 'category-id' },

        /** The selected leaf id. Settable for the same reason. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** Internal: the search field's text. */
        _query: { state: true },

        /** Internal: which nav column column 1 holds while collapsed. */
        _navLevel: { state: true },

        /**
         * Why the last Save was refused, or null.
         *
         * `commit()` has always reported `{ok, reason}` and this screen discarded it —
         * the behaviour audit filed that as a half with no other half, and it became
         * visible the moment Save started leaving on success: a refused write would have
         * carried a person off the page with their change still unwritten and unmentioned.
         */
        _commitRefusal: { state: true },

        /**
         * Why the last PREFERENCE write was refused, or null.
         *
         * The other half of the same sentence. A machine field reports through `commit()`;
         * a stored preference writes the moment it changes and reports through the store's
         * `onWriteFailure` seam, which had no subscriber until 26 August 2026.
         */
        _writeRefusal: { state: true },

        /**
         * The row whose number is being typed, or null. Ben, 24 Aug 2026: "In all
         * settings I cannot seem to open the number pad when chaning a spinners value,
         * tapping the number should always open the number pad modal."
         *
         * THE ROW ID, NOT THE VALUE. One keypad serves every stepper on every leaf, so
         * what has to be held is WHICH row asked; the value and the range are looked up
         * from the model when the body renders, which is the same shape the Live rail's
         * `_typing` has.
         */
        _typing: { state: true },

        /**
         * The leaf model, built from `boot` by `settings-model.js` — this file names no
         * store, no route and no table. Settable, so a test or a fixture hands one in
         * without a boot at all.
         */
        model: { attribute: false },

        /**
         * The nine bespoke leaves' stores, built from `boot` by the same composition root
         * (`settingsBespokeFor`). Handed straight down to <settings-bespoke-leaf> and
         * never read here: this file still names no store, no route and no table.
         */
        bespoke: { attribute: false },

        /**
         * THE THEME CONTROLLER (`src/lib/theme.js`), handed down by <app-root> at
         * creation beside `boot`. Not built here and not reached for: the shell owns it
         * because it needs a document element and a media query, and Display > Skin owns
         * the only theme control in the app (cmp-ss-3).
         *
         * IT DOES NOT GO THROUGH THE STORAGE ROUTER, and that is the point of passing
         * the object rather than adding a registry row. `controller.set()` stamps the
         * attribute the sheets select on AND records that the user has now chosen, which
         * is what stops `followSystem` overwriting the choice at the next OS change. A
         * bank wired to a routed key would persist the value and leave both of those
         * undone.
         *
         * HANDED TO THE BESPOKE LEAF AS ITS OWN PROPERTY, never merged into `bespoke`.
         * That bundle is the composition root's object and its IDENTITY is a contract —
         * the leaf re-subscribes and re-reads whenever `deps` changes — and a merged
         * copy is also a SNAPSHOT: anything that mutates a field of the bundle in place
         * would stop reaching the leaf. Two properties, no copy, both promises kept.
         */
        theme: { attribute: false },

        /**
         * WHERE C6'S BASE IS WRITTEN. `document.documentElement` in the app, injectable
         * so a test can hand in an element of its own. It has to be the DOCUMENT root:
         * `--ui-nav-row` and friends are resolved on `:root`, so a base declared on a
         * subtree would change nothing at all — silently (`styles/tokens.css`).
         */
        densityRoot: { attribute: false },
    };

    static styles = [typeRoles, seams, css`
        /* THE SEAM BETWEEN THE TWO HALVES OF A BESPOKE LEAF, and it was zero.
         *
         * A bespoke page is TWO elements stacked in the pane: <settings-leaf>, which
         * always draws the eyebrow, the name, the rule, the description and whatever
         * registry rows the leaf has, and <settings-bespoke-leaf> under it. The pane is
         * display: block, so nothing sat between them.
         *
         * MEASURED 26 August 2026, in CSS px at the bench. Every other vertical gap on
         * every settings page is 18 — description to first row, and row to row, on all
         * thirty-seven leaves. The two seams into a bespoke block were 0: on Brightness
         * and Plugins its first heading touched the page description, and on Skin its
         * first group touched the last registry row. Two pages read as one paragraph
         * that had lost its spacing, which is what a rhythm break looks like when
         * nothing overlaps.
         *
         * ONE RULE, THE SAME NUMBER. --ui-space-4 IS that 18, so the seam is not a
         * measurement copied here — it is the token the rows already use. */
        #bespoke {
            margin-block-start: var(--ui-space-4);
        }

        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THE GRID. display / gap / ground come from the seam utility via the host
         * classes added in connectedCallback; :host(.seam-grid) is (0,2,0), so this
         * rule — same selector, written later — is what adds the tracks to it.
         *
         * Two rows and no more, and the seam between them IS the header's underline,
         * which is why the ground is --ui-line-strong (.seam-strong): §3.9 and
         * CONVENTIONS §13 both give that weight for "rail edge, header underline, band
         * top". */
        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long heading cannot widen the screen; the
         * band's own layout is #31's and nothing here reaches into it. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        /* Row 2, both minimums at 0 — the body decides its own columns and the panes
         * decide their own floors. A min-block-size here would be a third owner of a
         * dimension two boxes already own (§2.3). */
        settings-master-detail {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* THE CRUMB'S TWO PARTS. A button that says what it does and a label that says
         * where you are — so neither needs an aria-label overriding its own text, and
         * the visible words and the accessible name are the same words (T15's class).
         * The box, and whether it exists at all, are the body's (it is the collapsed
         * branch's row); these two are just its contents. */
        #crumb-trail {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        #crumb-here {
            min-inline-size: 0;
            overflow-x: clip;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE LEAF. It brings its own rhythm (one gap, one token, in
         * settings-leaf.js) and its WIDTH is the pane's — that is the whole of
         * T1/T21 — so there is nothing left for this file to declare about it. */
    `];

    #i18n = new I18nController(this);

    /** Held so `disconnectedCallback` can undo it: one subscription, never two. */
    #unwatchModel = null;

    /** The settings store's write-failure subscription, for the life of this screen. */
    #unwatchWriteFailure = null;

    /** The LED strip store's, so the header's count moves when a preview goes uncommitted. */
    #unwatchLed = null;

    /** The display feed, watched for the brightness row. See `#watchPanel`. */
    #unwatchPanel = null;

    constructor() {
        super();
        this.boot = null;
        this.changeCount = 0;
        this.categoryId = SETTINGS_TREE[0].id;
        this.leafId = SETTINGS_TREE[0].leaves[0].id;
        this._query = '';
        this._navLevel = NAV_LEVEL.LEAVES;
        this.model = null;
        this.bespoke = null;
        this.theme = null;
        this.densityRoot = null;
        this._typing = null;
    }

    /**
     * The seam classes go on the HOST, not in the constructor — a custom element
     * constructor must not gain attributes (CONVENTIONS §13 (b)).
     */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        if (!this.densityRoot) this.densityRoot = this.ownerDocument?.documentElement ?? null;
        this.#adoptModel();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#unwatchModel?.();
        this.#unwatchModel = null;
        this.#unwatchWriteFailure?.();
        this.#unwatchWriteFailure = null;
        this.#unwatchLed?.();
        this.#unwatchLed = null;
        this.#unwatchPanel?.();
        this.#unwatchPanel = null;
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('boot') || changed.has('model')) this.#adoptModel();
    }

    /**
     * Take the model — the one handed in, or the one this screen's boot object implies —
     * and watch it for D11's count.
     *
     * THE COUNT IS READ, NEVER ACCUMULATED HERE. `changeCount` mirrors the model's number
     * on every beacon; this screen adds nothing to it and subtracts nothing from it, so
     * there is no second tally to drift from the first. A false-dirty Save is worse than
     * no dirty state (#31 coerces for the same reason).
     */
    /**
     * The machine snapshot feed, or null.
     *
     * A GETTER RATHER THAN A FIELD because the boot object is a property that arrives
     * after construction, and because `feed()` THROWS on a name it does not have — the
     * feed table's own rule, so a typo cannot answer undefined and render blank for ever.
     * Asking it once per render, guarded, keeps that rule and keeps this screen from
     * caching a feed belonging to a boot it no longer has.
     */
    /**
     * The machine class, or null while the capability answer is in flight.
     *
     * ONE LEAF DEPENDS ON IT (the flow multiplier, which a Bengle does not need) and
     * nothing else does. Read through the capability store, never inferred from a model
     * string — the served array is what replaced that sniff.
     */
    get #machineClass() {
        const capabilities = this.boot?.capabilities ?? null;
        return typeof capabilities?.machineClass === 'function' ? capabilities.machineClass() : null;
    }

    get #machineFeed() {
        const live = this.boot?.live ?? null;
        if (!live || typeof live.feed !== 'function') return null;
        try {
            return live.feed(FEED.MACHINE);
        } catch {
            return null;
        }
    }

    /**
     * THE LIGHTING LEAF'S UNSAVED PREVIEW, AND WHY IT IS A COUNT AND NOT A BUTTON.
     *
     * A REAL TRAP, and worse than a photograph could show. The Lighting leaf carries NO
     * registry rows, so `changeCount` was always zero on it; `#onCommit` branches on
     * `event.detail.dirty` and, when false, leaves the screen without writing anything. So
     * the header's primary Save on that page WAS A CLOSE BUTTON. Meanwhile every wheel drag
     * and every preset press had already gone to the machine as a live
     * `PUT /machine/ledStrip`, which the store's own contract note says "PUSHES LIVE AND
     * DOES NOT PERSIST" — only `POST /machine/ledStrip/commit` writes NVM. A person picked
     * colours, pressed the big Save at the top right, left, and lost them at the next power
     * cycle.
     *
     * SO AN UNCOMMITTED PREVIEW IS COUNTED LIKE ANY OTHER PENDING CHANGE, which is the
     * one-Save model this screen already states: one commit gesture per screen, and D11 says
     * a count crosses to the header. Save then commits it and Cancel resets it — `reset` is
     * `POST /machine/ledStrip/reset`, i.e. reload NVM, i.e. exactly Cancel's semantics — so
     * "Keep these colours" and the leaf's own Reset button are both redundant and are gone.
     *
     * ONE, NOT A TALLY OF COLOURS. The strip is one document and it either matches NVM or it
     * does not; counting drags would put a number on the header that means nothing to the
     * person who made them.
     *
     * AND ONLY WHILE THAT LEAF IS SHOWING. The preview is live on the machine from any
     * screen, but the gesture that saves it belongs to the page that made it — a Save on the
     * Water Tank page that quietly committed somebody's earlier colour experiment would be a
     * second thing one button does.
     */
    get #ledPending() {
        if (this.#leaf.id !== LIGHTING_LEAF) return false;
        const led = this.bespoke?.led ?? null;
        return typeof led?.get === 'function' && led.get().dirty === true;
    }

    #adoptModel() {
        const model = this.model ?? settingsModelFor(this.boot);
        if (model && model !== this.model) this.model = model;
        const bespoke = this.bespoke ?? settingsBespokeFor(this.boot);
        if (bespoke && bespoke !== this.bespoke) this.bespoke = bespoke;
        /* THE LED STORE GETS A SUBSCRIPTION OF ITS OWN, for the same reason the model does:
         * the header's count has to move when the strip becomes dirty, and the bespoke leaf
         * re-rendering itself tells this element nothing. One subscription for the life of
         * the screen, released with the others. */
        const led = bespoke?.led ?? null;
        if (!this.#unwatchLed && typeof led?.subscribe === 'function') {
            this.#unwatchLed = led.subscribe(() => this.requestUpdate());
        }
        /* AND THE PANEL, FOR THE BRIGHTNESS ROW — THROTTLED TO THE WHOLE PERCENT.
         *
         * The row READS its served brightness through the panel, and a read alone is not
         * enough: ReaPrime's low-battery clamp moves the panel underneath us, so without a
         * subscription the slider shows the value it saw at mount and goes on showing it.
         * That was true of the bespoke page too and it carried this same subscription; the
         * page is gone and the requirement is not, so it moves here rather than lapsing.
         *
         * THE WHOLE PERCENT IS THE THROTTLE, for the reason the old comment gave: the feed
         * republishes on every DisplayState change and what the row draws is an integer, so
         * a repaint is worth taking only when that integer moves. */
        const displayFeed = bespoke?.display?.feed ?? null;
        if (!this.#unwatchPanel && typeof displayFeed?.subscribe === 'function') {
            let last = null;
            this.#unwatchPanel = displayFeed.subscribe((state) => {
                const level = state?.value?.brightness;
                const next = Number.isFinite(level) ? Math.round(level) : null;
                if (next !== last) { last = next; this.requestUpdate(); }
            });
        }
        if (!model || typeof model.subscribe !== 'function') return;
        if (this.#unwatchModel) return;
        this.#unwatchModel = model.subscribe((state) => { this.changeCount = state.changeCount; });

        /* AND THE OTHER REFUSAL PATH. One subscription for the life of the screen, which is
         * what the store's own note asks for; the listener records a reason and the render
         * shows it, so nothing here composes a sentence a screen has no business owning. */
        const settings = this.boot?.settings ?? null;
        if (!this.#unwatchWriteFailure && typeof settings?.onWriteFailure === 'function') {
            this.#unwatchWriteFailure = settings.onWriteFailure((failure) => {
                this._writeRefusal = failure?.reason ?? 'unknown';
            });
        }
    }

    /** The category currently selected, always a real one. */
    get #category() {
        return categoryFor(this.categoryId) ?? SETTINGS_TREE[0];
    }

    /**
     * The leaf currently selected, or the category's first if the id has gone stale.
     *
     * A LEAF THIS MACHINE DOES NOT HAVE IS ALSO STALE. One leaf is machine-dependent, and
     * a stored address pointing at it on the wrong machine would render a page with no
     * row in the sub-nav to leave it by. Falling back to the category's first VISIBLE leaf
     * is the same rule an unknown id already took.
     */
    get #leaf() {
        const shown = leavesFor(this.#category, this.#machineClass);
        const leaf = leafFor(this.leafId);
        if (leaf
            && categoryOf(this.leafId)?.id === this.#category.id
            && leafShownOn(leaf, this.#machineClass)) return leaf;
        return shown[0] ?? this.#category.leaves[0];
    }

    render() {
        const t = this.#i18n.t;
        const category = this.#category;

        return html`
            <ui-page-header
                id="band"
                heading=${t('Settings')}
                commit
                change-count=${this.changeCount + (this.#ledPending ? 1 : 0)}
                @commit=${this.#onCommit}
                @cancel=${this.#onCancel}
            ></ui-page-header>

            <!-- A REFUSED SAVE IS SAID OUT LOUD, and it has to be: Save leaves the screen
                 on success, so a write the machine turned down would otherwise carry a
                 person away from the page with the change still staged and nothing said.
                 The staged Map survives a failure, so the count is still on the button and
                 Save can be pressed again. NO BACKTICK IN THIS COMMENT. -->
            ${this._commitRefusal
                ? html`<p id="commit-refusal" class="ui-caption" role="status"
                    >${t(COMMIT_REFUSAL_TEXT[this._commitRefusal] ?? COMMIT_REFUSAL_TEXT.unknown)}</p>`
                : nothing}

            <!-- THE PREFERENCE THAT DID NOT STICK. A stored preference writes the moment it
                 changes, so there is no Save to report through and the control simply
                 snapped back to its old value with nothing said. NO BACKTICK HERE. -->
            ${this._writeRefusal
                ? html`<p id="write-refusal" class="ui-caption" role="status"
                    >${t(WRITE_REFUSAL_TEXT[this._writeRefusal] ?? WRITE_REFUSAL_TEXT.unknown)}</p>`
                : nothing}

            <settings-master-detail id="body" nav-level=${this._navLevel}>
                <!-- THE CRUMB. Rendered always; the body's container query decides
                     whether it has a box. No JS reads the branch. -->
                <div slot="crumb" id="crumb-trail">
                    <ui-button
                        id="crumb-up"
                        variant="ghost"
                        @click=${this.#onCrumbUp}
                    >${t('All categories')}</ui-button>
                    <span id="crumb-here" class="ui-body">${t(navName(category))}</span>
                </div>

                <!-- THE FIELD SPANS BOTH NAV COLUMNS, which is Slate's own structure and
                     Ben's ask of 26 August 2026: "The search field, Box width should
                     spread over both columns." It was slotted into the nav column, so it
                     was one column wide and the sub-nav had to carry a blank head track of
                     the same height just to keep the two lists level. It is the
                     master-detail's own grid item now. NO BACKTICK IN THIS COMMENT.

                     THE PLACEHOLDER CARRIES SLATE'S THREE DOTS AND THE LABEL DOES NOT.
                     The type audit of 26 August recorded the pair as "three dots apart",
                     and it is a tie on the merits: an ellipsis in a placeholder is a
                     convention meaning "start typing", and it is neither right nor wrong.
                     A tie goes to Slate - that is the whole charter - so the placeholder
                     is Slate's string. The accessible NAME stays the plain sentence,
                     because a name is read aloud and "dot dot dot" is not part of it. -->
                <ui-search-field
                    id="search"
                    slot="search"
                    label=${t('Search settings')}
                    placeholder=${t('Search settings...')}
                    .value=${this._query}
                    @input=${this.#onSearch}
                    @search=${this.#onSearch}
                ></ui-search-field>

                <settings-nav-column
                    slot="nav"
                    id="nav"
                    @navigate=${this.#onNavNavigate}
                >
                    ${this.#navRows()}
                </settings-nav-column>

                <settings-nav-column
                    slot="subnav"
                    id="subnav"
                    @navigate=${this.#onLeafNavigate}
                >
                    <!-- THE LEAF'S ONE HEADLINE SCALAR, ON ITS OWN NAV ROW (Slate's S20,
                         and its own note says why: "Confirming what the machine is set to
                         cost six taps and six page loads"). The DATA was always here;
                         Decal slotted a bare label, which is a half with no other half.

                         THE MODEL IS THE SOURCE AND NOT THE MACHINE DOCUMENT, which is the
                         load-bearing half: navSummary resolves staged-then-machine, so a
                         row AGREES with an unsaved Save rather than contradicting it. A
                         summary read straight off the machine would print 220V beside a
                         control the user has just moved to 110V.

                         NOT D11. D11 is about what a SCREEN tells the commit band - "the
                         count and nothing else" - and this is a nav row reporting a page it
                         is not on. Different channel, different question.

                         NULLISH COALESCING RATHER THAN OR: the model answers null for "no scalar", and
                         an empty string is what #25 already treats as none, so both land on
                         the same no-element branch without a second rule here.
                         NO BACKTICK IN THIS COMMENT. -->
                    ${leavesFor(category, this.#machineClass).map((leaf) => html`<ui-subnav-row
                        data-id=${leaf.id}
                        .value=${leaf.id}
                        summary=${this.model?.navSummary?.(leaf.id) ?? ''}
                        ?current=${leaf.id === this.#leaf.id}
                    >${t(navName(leaf))}</ui-subnav-row>`)}
                </settings-nav-column>

                <settings-leaf-pane slot="leaf" id="leaf-pane">
                    <settings-leaf
                        id="leaf"
                        leaf-id=${this.#leaf.id}
                        eyebrow=${navName(category)}
                        heading=${navName(this.#leaf)}
                        .model=${this.model}
                        .liveFeed=${this.#machineFeed}
                        @leaf-action=${this.#onLeafAction}
                        @leaf-change=${this.#onLeafChange}
                        @leaf-edit=${this.#onLeafEdit}
                    ></settings-leaf>
                    <!-- THE OTHER HALF OF THE PAIR, and only for the nine (spec 4.4).
                         NO BACKTICK IN THIS COMMENT: it is inside a tagged template and
                         one would end it. leafKind is the registry's answer, so a leaf
                         becomes bespoke by being named in BESPOKE_LEAVES and never by a
                         branch here; the element above still renders the heading and the
                         registry rows for all thirty-seven, so T13 stays dead for these
                         nine too. Both sit in the pane's ONE measure box (T1 / T21). -->
                    ${leafKind(this.#leaf.id) === LEAF_KIND.BESPOKE
                        ? html`<settings-bespoke-leaf
                            id="bespoke"
                            leaf-id=${this.#leaf.id}
                            .deps=${this.bespoke}
                            .theme=${this.theme}
                        ></settings-bespoke-leaf>`
                        : nothing}
                </settings-leaf-pane>
            </settings-master-detail>
            ${this.#renderKeypad()}
        `;
    }

    /**
     * THE NUMPAD (#53), IN THE DIALOG SHELL IT ALREADY BRINGS.
     *
     * ONE INSTANCE FOR EVERY LEAF, which is the same arrangement the Live rail has and
     * for the same reason: the body is #18's to open, the ranges are the limits table's
     * to declare, and this screen's whole part is naming the row and putting the
     * confirmed number back through the model.
     *
     * THE KEYPAD IS TOLD THE BAND THE ROW IS DRAWING, AND `limits` STAYS BEHIND IT
     * (27 August 2026). It used to be handed the RAW table and left to ask the port for
     * itself — `hasLimit`, `clamp`, `numpadRange` — which is right for a Celsius tablet
     * and wrong for every other one. MEASURED on Machine › Steam with the temperature
     * preference set to Fahrenheit: the stepper drew 30–85 as 86–185 °F and the keypad
     * over the same row said "30–85 °C" and clamped a typed 150 to 85. The stepper had
     * the converted band all along — `view.bounds`, whose `next` and `clamp` convert in,
     * do the machine's own arithmetic against the machine's own table, and convert out —
     * so the honest fix is to pass THAT rather than to compute a second one here.
     *
     * `limits` IS STILL PASSED and that is deliberate: it is #53's fallback for a caller
     * with no converted band, and leaving it wired means an unbounded row keeps behaving
     * exactly as it did rather than changing shape as a side effect of this change.
     *
     * A ROW WITH NO LIMIT STILL OPENS IT. `limitKey` is empty then, and #53's own
     * contract is that an unstated range is unbounded — which is B2 one storey up, and
     * is why the heater rows that have no served band are still typeable.
     */
    #renderKeypad() {
        const t = this.#i18n.t;
        const view = this.#typingView;
        return html`
            <ui-numeric-keypad
                id="keypad"
                ?open=${Boolean(view)}
                heading=${view ? t(view.heading) : ''}
                .limits=${this.bespoke?.limits ?? null}
                .limitKey=${view?.row?.limit ?? ''}
                .band=${this.#typingBand}
                .value=${view && view.value !== undefined && view.value !== null ? String(view.value) : ''}
                unit=${view ? view.bounds.unit : ''}
                @confirm=${this.#onKeypadConfirm}
                @open-change=${this.#onKeypadClose}
            ></ui-numeric-keypad>`;
    }

    /**
     * The band the row is DRAWING, for the keypad over it — the model's own answer with
     * the model's own hint on it, and not one number of this screen's.
     *
     * IT IS ASSEMBLY AND NOT ARITHMETIC. `view.bounds` is `boundsFor()`, which is the ONE
     * limits table wearing whichever face the temperature preference asks for; `view.hint`
     * is the sentence already printed beside the row's own label, so the keypad and the
     * row it opened from cannot describe the same band differently. This getter picks a
     * bound from neither and computes none.
     *
     * AN UNBOUNDED ROW GETS NO BAND. `bounded: false` means there is nothing to clamp
     * against (`clamp` is null there), and #53 refuses such an object anyway — but saying
     * it here as well keeps the fallback explicit rather than accidental.
     *
     * AND A HOLED ROW GETS `padBounds`, NOT `bounds` (audit F-021, 29 August 2026).
     * `view.bounds` is the STEPPER'S band and its `min` is the off value, because stepping
     * down past the floor to off is a real gesture a person can watch. Typing is not: a
     * below-floor number handed to `clamp` came back as the nearer end of the hole, so a
     * typed 63 on Machine › Steam left as `targetTemperature: 0` and switched the heater
     * off with the row's own hint reading "135–170 °C" the whole time. `view.padBounds` is
     * the same band with the hole spent, composed by the model out of `machine-limits.js`'s
     * own `padBand` — this screen picks a bound from neither and computes none, which is
     * also why the narrowing is not done here: `settings-skeleton.test.mjs` holds this file
     * to importing no store, no endpoint and no limit.
     *
     * THE HINT DOES NOT MOVE WITH IT, because it was already right: `bandHint` prints the
     * working band for a holed row, which is exactly the band the pad now takes. That the
     * sentence needed no change is the evidence that the pad, not the sentence, was wrong.
     */
    get #typingBand() {
        const view = this.#typingView;
        if (!view || !view.bounds?.bounded) return null;
        return { ...(view.padBounds ?? view.bounds), label: view.hint };
    }

    /** The joined row the keypad is typing into, or null. Looked up, never held. */
    get #typingView() {
        if (!this._typing || !this.model || !this.#leaf) return null;
        return this.model.rows(this.#leaf.id).find((view) => view.id === this._typing) ?? null;
    }

    /** A stepper's number was pressed. Open the keypad on that row. */
    #onLeafEdit = (event) => {
        const row = event.detail?.row;
        if (typeof row === 'string' && row !== '') this._typing = row;
    };

    /**
     * A typed number, confirmed. It goes through the MODEL like every other write, so a
     * route row is stored and a machine field is staged — the keypad has no idea which,
     * and that is the whole of B7 arriving at a second control.
     */
    #onKeypadConfirm = (event) => {
        const view = this.#typingView;
        const value = event?.detail?.value;
        this._typing = null;
        if (!view || !Number.isFinite(value)) return;
        Promise.resolve(this.model.set(view.row, value)).catch(() => {});
    };

    /** The dialog announced its own close. Only a CLOSE clears the row — see the wake. */
    #onKeypadClose = (event) => {
        if (event?.detail?.open === false) this._typing = null;
    };

    /**
     * THE NAV COLUMN'S ROWS — categories while browsing, results while searching, and
     * ONE component and ONE naming call for both (T12).
     *
     * §7.5 T12: "Searching restores the ordinals the design removed — 'Machine' becomes
     * '1. Machine'". There is no index in scope in either branch below and `navName`
     * takes none, so the prefix has nowhere to come from; and `searchSettings` returns
     * the tree's own frozen nodes, so the two branches render the same objects.
     */
    #navRows() {
        const t = this.#i18n.t;
        const rows = isSearching(this._query)
            ? searchSettings(this._query, SETTINGS_TREE, this.#machineClass)
            : SETTINGS_TREE.map((category) => ({
                kind: NAV_KIND.CATEGORY, node: category, category,
            }));

        /* A SEARCH THAT FINDS NOTHING SAYS SO, which it did not until 26 August 2026.
         *
         * Typing a word no setting carries emptied the column and left it empty — no rows,
         * no message, and the leaf pane still showing whatever page had been open. From a
         * finger that is indistinguishable from a list that failed to load, and the only
         * way to learn otherwise was to delete characters until something came back.
         *
         * THE COMPONENT ALREADY EXISTS and is what every other empty surface in the skin
         * uses, so this is a state the screen was missing rather than a thing to design.
         * It names the query back, because "nothing matched" and "nothing matched THAT" are
         * different sentences to a person who has just mistyped. */
        if (rows.length === 0) {
            return html`<ui-empty-state
                id="search-empty"
                heading=${t('No settings match')}
                body=${t('Nothing here is called “{query}”. Try a shorter word.', { query: this._query.trim() })}
            ></ui-empty-state>`;
        }

        return rows.map((row) => html`<ui-nav-row
            data-id=${row.node.id}
            data-kind=${row.kind}
            data-category=${row.category.id}
            ?current=${this.#isCurrentRow(row)}
        >${t(navName(row.node))}</ui-nav-row>`);
    }

    /** A category row is current when it is the category; a leaf result, the leaf. */
    #isCurrentRow(row) {
        return row.kind === NAV_KIND.LEAF
            ? row.node.id === this.#leaf.id
            : row.node.id === this.categoryId;
    }

    /* ---- events ---------------------------------------------------------- */

    /**
     * SAVE — write what is staged, then leave.
     *
     * THE BUG THIS FIXES (Ben, on the tablet, 26 August 2026): "the cancel button in
     * Settings is not working, only save can exit."
     *
     * It was the retired band showing through. When the header was ONE button that read
     * "Close" at a count of zero, the clean branch below WAS that Close — press it with
     * nothing staged and you left. Ben replaced it with the Cancel + Save pair on 25
     * August, and these two handlers were never re-thought, so:
     *
     *   nothing staged  Save left the screen. Cancel discarded nothing and stayed, which
     *                   from a finger is a dead button.
     *   something staged  Save wrote and STAYED. Cancel discarded and stayed. Neither
     *                   exited, so the only way out was to press Save twice.
     *
     * WHAT A CANCEL / SAVE PAIR MEANS is what they do now: both leave, and the difference
     * is what they do with the staged changes on the way.
     *
     * A FAILED SAVE STAYS PUT, and that is the one asymmetry worth keeping. `commit()`
     * already reports `{ok, reason}` and this screen discarded it — the behaviour audit
     * filed it as a half with no other half. Leaving on a refused write would carry a
     * person away from the page while their change was still unwritten and unmentioned,
     * which is the same silent loss B7 exists to prevent. The staged Map is untouched by a
     * failure, so the count stays and Save can be pressed again.
     */
    #onCommit = (event) => {
        /* THE LIGHTING LEAF COMMITS TO NVM, and it is the only pending change on that page
         * — see `#ledPending`. It runs before the model's commit rather than instead of it
         * because the two are independent documents, and a leaf can in principle carry
         * both; today the Lighting leaf has no registry rows, so the model's branch below
         * takes the clean path and leaves. */
        if (this.#ledPending) {
            const led = this.bespoke.led;
            Promise.resolve(led.commit())
                .then((ok) => {
                    if (ok === false) {
                        this._commitRefusal = 'writeFailed';
                        return;
                    }
                    this._commitRefusal = null;
                    this.#leaveScreen();
                })
                .catch(() => { this._commitRefusal = 'unknown'; });
            return;
        }
        if (!event.detail?.dirty || !this.model) {
            this.#leaveScreen();
            return;
        }
        Promise.resolve(this.model.commit())
            .then((result) => {
                if (result && result.ok === false) {
                    this._commitRefusal = result.reason ?? 'unknown';
                    return;
                }
                this._commitRefusal = null;
                this._writeRefusal = null;
                this.#leaveScreen();
            })
            .catch(() => { this._commitRefusal = 'unknown'; });
    };

    /**
     * CANCEL — throw the staged changes away and leave.
     *
     * "Nothing stored is touched" is still true and is the half that surprises people:
     * a preference this skin stores was written the moment it changed (B7 — losing a
     * setting by walking away is the defect that rule exists to remove), so Cancel undoes
     * the MACHINE's staged fields and nothing else. What changed on 26 August is that it
     * leaves: a Cancel that stays put is a button with no observable effect on a clean
     * page, which is exactly how it was reported.
     */
    #onCancel = () => {
        /* AND CANCEL PUTS THE STRIP BACK. `reset` is `POST /machine/ledStrip/reset`, which
         * reloads NVM and returns the reloaded state — discarding the preview is exactly
         * what it does, so Cancel on this leaf means what it means everywhere else. Not
         * awaited: the screen leaves either way, as it does for the staged machine fields
         * Cancel throws away above. */
        if (this.#ledPending) Promise.resolve(this.bespoke.led.reset()).catch(() => {});
        this.model?.discard?.();
        this._commitRefusal = null;
        this._writeRefusal = null;
        this.#leaveScreen();
    };

    /**
     * Close.
     *
     * IT ASKED THE BOOT DIRECTLY AND THAT BROKE THE ADDRESS (Ben, 24 Aug 2026: "I can
     * press the button and it opens, then close it, but then I cannot press the button to
     * open settings again. If I then tap say the chart the chart opens then I close the
     * chart and I go to the settings, not the live view").
     *
     * `boot.goto()` moves the mounted screen and writes NOTHING to `location`, so after a
     * close the hash still read `#/settings` while the screen was Live. Both symptoms
     * follow from that one disagreement:
     *
     *   * pressing Settings again ran `location.hash = '#/settings'` — an assignment of
     *     the value the hash ALREADY held, which fires no `hashchange` and therefore does
     *     nothing at all;
     *   * opening the chart pushed `#/history` on top of the stale entry, so the chart's
     *     own `history.back()` popped to `#/settings` and landed there.
     *
     * `app-root.goto`'s own docblock had named this in advance: a route goes "through
     * `goto()` and therefore through the address — never through `boot.goto()` directly,
     * which would move the mounted screen while the hash still" says otherwise. This
     * screen was the one caller that did.
     *
     * SO IT ASKS THE SHELL, by the road every other screen uses: a composed, bubbling
     * `navigate` event. That keeps the property the old comment was protecting — a screen
     * mounted without a shell (a fixture, the gallery) has nobody listening, so nothing
     * navigates a harness page away — and it puts the address and the screen back in
     * step, which asking the boot could not.
     *
     * MEASURED: before, `{hash: '#/settings', route: 'live'}` after a close. After, the
     * two agree, and a second press opens Settings.
     */
    #leaveScreen() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: HOME_ROUTE },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * D8 — THE WAY BACK OUT OF THE SKIN. One control, one row, one intent, arriving here
     * because the leaf dispatched it and this screen is the only thing that navigates.
     *
     * WHERE "OUT" LANDS: the directory above the one this document was loaded from. A
     * skin is served from its own folder under the host that installed it, so its parent
     * is the page that offered it — which is exactly "back to where you came from" and
     * needs no route, no capability and no new contract row. The alternative
     * (`GET /api/v1/webui/skins/default`, recorded and handler-checked but unadopted) is
     * one line away and is recorded as a deferred question.
     *
     * `exit` is injectable so a test can watch it without leaving the page.
     */
    #onLeafAction = (event) => {
        const action = event.detail?.action;
        if (action === 'leave-skin') {
            this.exit(new URL('../', this.ownerDocument?.location?.href ?? 'about:blank').href);
            return;
        }
        /* THE CONNECTION PAGES' SEARCH. One scan for both leaves, through the ONE store
         * that owns `GET /devices/scan` — a second caller would be a second answer to
         * "what does searching mean", and the store already carries the two traps that
         * question has (`connect=false` and never `quick=true`). */
        if (action === 'scan-devices') {
            void this.bespoke?.scaleConnect?.scan?.();
            return;
        }
        /* THE GUIDE IS A DOCUMENT ON DECENT'S OWN SITE, and Slate links exactly this URL
         * from exactly this row (`settings.js:1932`). A NEW CONTEXT with `noopener`: a
         * same-window navigation strands a kiosk with no way back, which is the same
         * reason the plugin pages open the same way. */
        if (action === 'open-quickstart') {
            try {
                this.ownerDocument?.defaultView?.open?.(QUICKSTART_GUIDE_URL, '_blank', 'noopener');
            } catch { /* a webview that refuses to open a window is not an error to report */ }
        }
    };

    /** Overridden in tests. The default is the only navigation this screen performs. */
    exit = (href) => {
        const location = this.ownerDocument?.defaultView?.location;
        if (location && typeof location.assign === 'function') location.assign(href);
    };

    /**
     * C6's PREVIEW. The stored write is the model's (it went through the routing table
     * like every other preference); what happens here is the visible half — the base
     * lands on the document root so the rhythm and the type move under your finger.
     *
     * ONE ROW, MATCHED BY ITS EXPORTED ID. No branch on a leaf name, no string typed
     * twice. Applying at BOOT is somebody else's row (the theme stamp's neighbour) and
     * is recorded as a deferred question.
     */
    #onLeafChange = (event) => {
        if (event.detail?.row !== DENSITY_ROW) return;
        /* A REFUSED WRITE IS NOT A PREVIEW. `ok` rides along on leaf-change precisely so
         * this listener can tell a stored change from a refused one (settings-leaf.js
         * #write); without the check, a density write the store refused — quota, private
         * mode, a wedged backend, reason BACKEND_FAILED — still repainted the document
         * root at the new base and type scale while nothing was stored. The app then sat
         * at a size the stored preference does not contain, and the boot-time apply (this
         * cluster's own deferred question) would silently revert it. That is exactly the
         * units.js silent-revert class B7 exists to stop: a failed write must never look
         * like a stored one. */
        if (event.detail?.ok === false) return;
        applyDensity(this.densityRoot, event.detail.value);
    };

    /**
     * ONE LISTENER PER COLUMN, on the column rather than on every row: `navigate` is
     * composed, the rows live in this shadow tree, so `event.target` retargets to the
     * row that was pressed and nothing needs a per-row closure (which would also churn
     * a listener on every render).
     */
    #onNavNavigate = (event) => {
        const row = event.target;
        const id = row?.dataset?.id;
        if (!id) return;
        const categoryId = row.dataset.category ?? id;
        this.categoryId = categoryId;
        if (row.dataset.kind === NAV_KIND.LEAF) this.leafId = id;
        else this.leafId = categoryFor(categoryId)?.leaves[0]?.id ?? this.leafId;
        /* Collapsed, choosing a category steps you INTO it; wide, this selects
         * nothing, because both nav columns are on screen at once. */
        this._navLevel = NAV_LEVEL.LEAVES;
    };

    /** The sub-nav row carries `value`, which is its own API (#25), so read that. */
    #onLeafNavigate = (event) => {
        const id = event.detail?.value ?? event.target?.dataset?.id;
        if (!id) return;
        /* A REFUSAL BELONGS TO THE PAGE THAT CAUSED IT. Leaving the leaf is the person
         * moving on; carrying the sentence with them would leave a message about a control
         * they can no longer see. The COMMIT refusal is deliberately not cleared here — a
         * staged change survives a leaf change by design, so its refusal has to as well. */
        this._writeRefusal = null;
        this.leafId = id;
    };

    #onCrumbUp = () => {
        this._navLevel = NAV_LEVEL.CATEGORIES;
    };

    #onSearch = (event) => {
        this._query = event.target?.value ?? '';
    };
}

customElements.define('settings-screen', SettingsScreen);
