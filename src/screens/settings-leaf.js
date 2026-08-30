/**
 * settings-leaf.js — <settings-leaf>, the ONE renderer for every leaf that composes the
 * settings row. Wave 5.4, rows `settings-row-thirty-leaves`, `c6-density-type-scale`,
 * `d8-way-out-of-the-skin`, `a11y-cluster-t15`.
 *
 * `LAYOUT_SPEC_DRAFT.md` §4.4: "**settings row** … this one primitive covers ~30 of the
 * 37 leaves · the five control archetypes (stepper, switch, segmented bank, select,
 * button)".
 *
 * ===========================================================================
 * ONE RENDERER, THIRTY-SEVEN LEAVES — WHICH IS THE CLAIM
 * ===========================================================================
 *
 * There is no per-leaf file, no per-leaf component and no per-leaf branch. This element
 * takes a leaf id and a model and walks a data registry; the only thing that differs
 * between two leaves is the rows the registry hands back. That is what makes the
 * rhythm-and-duplication class structurally dead rather than repaired:
 *
 *   T13  a leaf's header sitting 12px lower because that leaf wrapped its title in a
 *        row — there is one heading element here and every leaf renders it;
 *   T20  fourteen `gap-[Npx]` literals — there is one gap declaration in this file and
 *        it is a token;
 *   T14  contradictory declaration pairs, "leaf gap 32/18 vs 24" among them — one
 *        declaration cannot contradict itself;
 *   T17  twenty hardcoded copies of the switch geometry — this file writes none, because
 *        #5 owns its geometry and this file cannot reach into it.
 *
 * ALL FOUR ARE ABSENCES, and absences need a test that names the mechanism rather than
 * the symptom: `test/settings-leaves.test.mjs` asserts this file writes no length, no
 * geometry and no second gap, and the render suite measures that every leaf's heading
 * lands at the same y and that every row shares one padding.
 *
 * ===========================================================================
 * THE CONTROL IS SLOTTED, AND #29 NAMES IT  (T15)
 * ===========================================================================
 *
 * Every control goes in #29's default slot and #29's four-rule ladder gives it the row's
 * heading as an accessible name: a `label` property for #1/#3/#4/#7, `aria-label` for
 * #5 (role=switch), and NOTHING for a control that names itself from its own contents —
 * a button reading "Leave" in a row headed "Leave this skin" keeps "Leave", which is
 * WCAG 2.5.3 rather than an oversight.
 *
 * T15's own clause is "four of twenty switches have no accessible name". Here a switch
 * cannot be nameless: it is in a row, the row has a heading, and the naming is the row's
 * — one path, exercised in the render suite over every switch the screen can show.
 *
 * NO SYNTHETIC CLICKS ANYWHERE IN THIS CLUSTER. T15's navigation clause ("navigation
 * driven by synthetic `.click()` so focus never moves") is about the nav column, but the
 * same rule holds here: this file dispatches no `click()` at anything, so focus is
 * wherever the user put it.
 *
 * ===========================================================================
 * WHAT THIS FILE DOES NOT DECIDE
 * ===========================================================================
 *
 * Not the layer a value is stored in (the routing table), not a range (the limits table,
 * through the R2 door, as an argument), not whether a surface is shown (the served
 * capability array, fail-closed in the settings store), not the Save wording (#31), and
 * not the leaf's WIDTH — that is the pane's, and it is the whole of T1/T21.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { leafDescription } from 'src/lib/settings-leaf-copy.js';
import { ARCHETYPE, leafAction } from 'src/lib/settings-leaves.js';
import 'src/components/ui-slider.js';
import { NO_READING } from 'src/data/reading.js';

/* THE LIBRARY, COMPOSED. Five archetypes, one row primitive, one text field — every one
 * of them shipped in waves 1-4. A hand-built copy of any of them is scope invention
 * (Part 10 §9), and a sixth control shape would be a second row vocabulary. */
import 'src/components/ui-settings-row.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-switch.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-select.js';
import 'src/components/ui-button.js';
import 'src/components/ui-text-field.js';

/**
 * WHAT AN INERT STEPPER PRINTS. One glyph, one place, and it is the same EN DASH the
 * address layer uses for an absence (`src/data/reading.js` `toText`'s default) — because
 * a reader has no way to tell "the master switch is off" from "nothing has arrived" by
 * looking, and printing two different dashes would suggest there was a difference to see.
 * A function rather than a string because #4 takes `format`, not a value: the NUMBER is
 * untouched, only its rendering changes.
 */
const INERT_VALUE = () => '\u2013';

/**
 * THE LIVE-READING FORMATTERS, MEMOISED BY WHAT THEY SAY.
 *
 * Slate prints "now 22°C" beside the setpoint (`settings.js:1026-1030`), rounded to whole
 * units, and the word is translated. So a formatter depends on two things — the unit and
 * the translated word — and there are two of them in the whole app.
 *
 * MEMOISED BECAUSE lit COMPARES PROPERTIES BY IDENTITY. A closure built fresh in `render`
 * is a new object every frame, so `.readingFormat` would be written on every render even
 * when nothing about it had changed. Keyed by the sentence it produces, which is the only
 * thing that can differ.
 */
const READING_FORMATTERS = new Map();
function liveReadingFormat(word, unit) {
    const key = `live|${word}|${unit}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => `${word} ${Math.round(value)}${unit ? ` ${unit}` : ''}`;
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

/**
 * A MEASURED reading printed beside the choice it is evidence for, with the option it
 * agrees with named.
 *
 * Slate's mains-voltage line, in one function: "Measured at the machine: 245 V —
 * consistent with 220V". The second clause is the useful half — a bare number leaves the
 * reader to compare it against two labels themselves — and it is derived from the ROW'S
 * OWN ITEMS by nearest value, so it cannot name an option the bank does not offer and
 * nothing here knows what a mains voltage is.
 *
 * NO CLAUSE WHEN THERE IS NOTHING TO COMPARE AGAINST: a row with no numeric items prints
 * the measurement alone rather than an empty dash-clause.
 */
function measuredReadingFormat(label, unit, items, agrees) {
    const numeric = (items ?? []).filter((item) => Number.isFinite(Number(item.value)));
    const key = `measured|${label}|${unit}|${agrees}|${numeric.map((i) => `${i.value}:${i.label}`).join(',')}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => {
            const shown = `${label}: ${Math.round(value)}${unit ? ` ${unit}` : ''}`;
            if (numeric.length === 0) return shown;
            const nearest = numeric.reduce((best, item) => (
                Math.abs(Number(item.value) - value) < Math.abs(Number(best.value) - value) ? item : best
            ));
            return `${shown} \u2014 ${agrees} ${nearest.label}`;
        };
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

/**
 * A PLAIN READING WITH A UNIT — the cup warmer's plate temperature, and the one shape #29
 * had no formatter for.
 *
 * `accessories-cup-warmer-now` printed a bare number: no `limit` and no `unit` meant no
 * formatter, so the value went out as whatever the machine sent while the Target stepper
 * directly above it drew "60 °C" and, in Fahrenheit, "140 °F". Two numbers on one page,
 * one of them dimensionless.
 *
 * ONE DECIMAL, WHICH IS SLATE'S RESOLUTION AND THE USEFUL ONE:
 * `formatTemp(cupWarmer.currentTemperature, 1)` (settings.js:3701-3703). A plate creeping
 * to setpoint is exactly the reading where tenths tell you something, and it is the machine
 * that decides how many it can offer — rounding to whole degrees would throw away an answer
 * it took the trouble to send.
 *
 * NOTHING HERE CONVERTS. The value arrives already in the display unit — `valueFor` is the
 * one place a temperature becomes Fahrenheit and `boundsFor` carries the unit that came with
 * it — so this only spells what it is handed.
 *
 * MEMOISED WITH THE OTHER TWO, and for the same reason: lit compares properties by identity,
 * so a closure built fresh in the join would be written on every render.
 */
function unitReadingFormat(unit) {
    const key = `unit|${unit}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => {
            const number = Number(value);
            if (!Number.isFinite(number)) return String(value);
            return `${number.toFixed(1)}${unit ? ` ${unit}` : ''}`;
        };
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

export class SettingsLeaf extends UiElement {
    static properties = {
        /** The leaf id, from `settings-nav.js`. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** The leaf's display name. Content, handed down; this element names nothing. */
        heading: { type: String },

        /**
         * THE CATEGORY EYEBROW — the word above the title ("Machine", "Calibration").
         * A STRING the screen composed from the nav tree, not a lookup done here: this
         * element renders a leaf and names no table, exactly as `heading` does.
         *
         * It was dropped in the rebuild and nothing declared the drop (cmp-sm-3). Empty
         * renders no element, so a leaf shown outside the master-detail — the gallery, a
         * fixture — has a title and no orphaned eyebrow.
         */
        eyebrow: { type: String },

        /** `createSettingsLeafModel(...)`. Absent renders the leaf's heading and no rows. */
        model: { attribute: false },

        /**
         * THE LIVE MACHINE FEED, for the one kind of row that shows a reading beside its
         * setpoint. `boot.live.feed(FEED.MACHINE)` — a `{subscribe, get}` over the
         * snapshot socket, handed down by the screen exactly as `model` is.
         *
         * ABSENT IS A STATE, NOT A FAILURE. A leaf with no feed renders the row without a
         * reading, which is what a page shows on a machine that is not connected — and is
         * what every fixture and every render test sees.
         */
        liveFeed: { attribute: false },

        /** Internal: the last snapshot frame, so one subscription repaints the readings. */
        _snapshot: { state: true },

        /** Internal: the model's change beacon, so one subscription re-renders the leaf. */
        _version: { state: true },
    };

    static styles = [visuallyHidden, typeRoles, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THE WHOLE OF THIS FILE'S GEOMETRY IS HERE AND IT IS FOUR DECLARATIONS.
         *
         * ONE GAP, ONE TOKEN. T20 counted fourteen gap literals in the old shell and
         * T14 counted the leaf gap contradicting itself (32/18 against 24). There is
         * one gap here, it is a token, and no row can add a second because a row is
         * data and data has no gap field.
         *
         * NO PADDING. The pane pads (--ui-space-6, its own declaration) and the row
         * pads (--ui-space-3, inside its own shadow root, T13's 12px now unreachable
         * from outside). A third padding here would be the third owner of one edge. */
        :host {
            display: grid;
            gap: var(--ui-space-4);
            align-content: start;
            min-inline-size: 0;
        }

        /* THE HEADING, ONE ELEMENT, EVERY LEAF. T13 is one leaf's header sitting 12px
         * below the other 36 because that leaf wrapped its title in a row primitive
         * and inherited its padding-block. There is no wrapper here and no leaf can
         * add one: every leaf renders this same element in this same position.
         *
         * THE TITLE ROLE, NOT THE HEADING ROLE, since 21 Aug 2026 (cmp-sm-3). The
         * rebuild set it at .ui-heading (20px) where Slate's leaf title is 28px
         * (ORACLE settings-calibration-load-cells [i=45] p.slate-title, and
         * type-roles.js .ui-title carries exactly that measurement). It is the page
         * title of the pane, one per leaf, so it takes the role that says so - and the
         * role is named, never a literal size, so the density scale still moves it. */
        #leaf-heading {
            margin: 0;
        }

        /* THE EYEBROW AND ITS TITLE ARE ONE BLOCK — one grid item, not two.
         *
         * ORACLE settings-calibration-load-cells [i=44] .slate-eyebrow y=146 h=31
         * against [i=45] .slate-title y=181: 181 - (146 + 31) = 4 = --ui-space-1,
         * where the next block down starts 44px below the title. The pair is a header
         * and reads as one only if it sits tighter than the rows do.
         *
         * SO THIS IS A WRAPPER, AND IT IS NOT T13's. T13 is one LEAF wrapping ITS OWN
         * title in a row primitive and inheriting that row's padding-block, so 36
         * leaves sat at one offset and the 37th at another. This block is in the shared
         * renderer, identical for all thirty-seven, and carries no padding at all — the
         * invariant T13 is about ("every leaf renders this same element in this same
         * position") is exactly what it keeps.
         *
         * AND THE SECOND GAP IS THE HEADER'S, NOT A SECOND RHYTHM. The host's
         * --ui-space-4 is still the one gap between the leaf's blocks; this is the
         * space INSIDE one of them, at the same token ui-settings-row uses between a
         * heading and its caption (--ui-space-1). Two tokens, no literal, and the
         * suite pins both by name. */
        #leaf-title-block {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        #leaf-eyebrow {
            margin: 0;
        }

        /* THE HEAD ROW. The page's name on the left, its one page-level action on the
         * right, both on the same baseline as the title rather than the eyebrow — a button
         * centred against a two-line block would sit between the two lines. */
        #leaf-head-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-inline-size: 0;

            /* THE ROW IS THE BUTTON'S HEIGHT WHETHER OR NOT THERE IS A BUTTON, and that is
             * T13 restated for a row that did not exist before. T13 is one leaf's heading
             * sitting lower than the other thirty-six; a head row that grew only on the
             * pages carrying a Restore defaults button would put every heading on two
             * different lines depending on the page — the same defect, arrived at from the
             * other direction.
             *
             * flex-end DOES THE REST: the title block sits on the row's bottom edge in both
             * cases, so its heading lands on one y across all thirty-eight leaves. */
            min-block-size: var(--ui-control-h);
        }

        #leaf-restore {
            flex: none;
        }

        /* THE RULE UNDER THE PAGE NAME. --ui-seam over --ui-line is the same hairline
         * every other divider in the skin draws; an hr carries a UA border and a UA margin
         * and both are replaced rather than adjusted. */
        #leaf-rule {
            block-size: var(--ui-seam);
            margin: 0;
            border: 0;
            background-color: var(--ui-line);
        }

        /* THE SENTENCE. Prose, so it takes the prose measure rather than the row measure —
         * a description running the full width of a leaf would be the longest line on the
         * page and the hardest to read. */
        #leaf-desc {
            margin: 0;
            max-inline-size: var(--ui-measure);
            color: var(--ui-muted);
        }

        /* The D4 note, and any other sentence a leaf's emptiness needs. Prose, so it
         * takes the prose measure rather than the form measure the pane sets. */
        #note {
            margin: 0;
            max-inline-size: var(--ui-measure);
        }

        /* Rows fill the leaf. The row owns everything inside its own box; what this
         * declaration says is only that a row is as wide as the leaf, which is the
         * pane's measure arriving intact rather than a width of its own (T1/T21). */
        ui-settings-row {
            display: flex;
        }

        /* AN UNSAVED EDIT IS MARKED, AND UNTIL 26 AUGUST 2026 IT WAS NOT.
         *
         * The data-staged attribute has been written on every row since the commit model
         * was built and
         * NO rule anywhere in src/ or styles/ matched it — an attribute that painted
         * nothing, so a person could see the count on the Save button and had no way to
         * find out WHICH of their edits it was counting. The behaviour audit filed it as a
         * half with no other half, and it is Slate's mirror image: Slate designed a
         * dirty dot (slate-components.css:747) and never wired it either.
         * NO BACKTICK IN THIS COMMENT: one ends the css template where it stands.
         *
         * SLATE'S OWN TREATMENT, since it exists and was thought about: a small round dot
         * after the label, one space-2 across, in a neutral ink. Not a colour that means
         * warning — an unsaved edit is not a problem, it is a state — and not a change of
         * weight or size, which would move the row and make the rhythm depend on what has
         * been touched.
         *
         * ON THE HOST, NOT INSIDE THE ROW. #29 owns its own layout and the mark is this
         * screen's business: the row does not know what a commit model is. A ::after on the
         * host paints beside the row without entering it.
         *
         * THE ROUND IS --ui-radius-pill AND NOT SLATE'S OWN 50 PERCENT, corrected on
         * 27 August 2026. Slate writes the circle as a half-of-the-box percentage
         * (slate-components.css:747), and this rule was transcribed with that literal in
         * it; ui-status-chip.js records the skin's mapping for exactly this shape - "spec
         * section 3.4 records that any value greater than or equal to half the height does
         * the same for a pill" - and every other round dot in src/ already goes through the
         * token. A second spelling of one shape is the thing tokens exist to prevent, and
         * the leaf-local-number guard in test/settings-leaves.js is what caught it: that
         * guard reads a bare percentage in this cluster as a leaf inventing a setting's
         * bounds, and it cannot tell a shape from a range. Routing the shape through the
         * token answers both objections with one edit rather than widening a guard. */
        ui-settings-row[data-staged]::after {
            content: "";
            align-self: center;
            flex: none;
            inline-size: var(--ui-space-2);
            block-size: var(--ui-space-2);
            margin-inline-start: var(--ui-space-2);
            border-radius: var(--ui-radius-pill);
            background: var(--ui-muted);
        }

        /* THE ONE ARCHETYPE WITH NO INTRINSIC WIDTH, AND IT SPILLED OFF THE PAGE.
         *
         * MEASURED on connection-machine at the bench: the row's control track computed
         * width 0, the ui-text-field inside it computed width 0, and the field's own
         * label and input drew at x=1207 with the pane ending at 1281 - a control
         * rendering outside the surface that holds it.
         *
         * WHY ONLY THIS ONE. ui-settings-row's control track is flex: none, so its base
         * size is the content's own. A switch, a stepper, a bank and a select all state
         * a size; ui-text-field declares no host block at all and lays out as a block,
         * which contributes zero to a shrink-to-fit track. Every other text field in the
         * skin sits in a grid cell or a form row that hands it a width, so the hole
         * appears only where a text field is slotted straight into a settings row.
         *
         * THE MEASURE IS THE BESPOKE PAGES': --ui-form-control-w is what the rebuilt
         * leaves give a text control, and a leaf built from the registry must not size
         * its fields differently from the leaf next to it. */
        ui-settings-row > ui-text-field {
            inline-size: var(--ui-form-control-w);
        }

    `];

    #i18n = new I18nController(this);

    /**
     * THE WIDEST CONTROL ON THIS PAGE, in CSS pixels, or 0 before the first measure.
     *
     * Ben, 26 August 2026 (O1): "Where the setting has a long text description we should
     * wrap the text earlier, don't go so close to the button ... maybe we look at the
     * widest input in the page, so in the steam page we would use the steam stop toggle
     * row, then have all text be to the left of that by some margin."
     *
     * THAT RULE NEEDS A NUMBER NO ROW CAN KNOW. A row sees its own control; the widest
     * control on the page is a fact about the page, so the page measures it and publishes
     * it as `--_ui-leaf-control-w`. #29 caps its label against that, and because a custom
     * property crosses a shadow boundary neither element reaches into the other.
     *
     * TWO CSS-ONLY ROUTES WERE TRIED FIRST AND BOTH REJECTED, on the rig, measured:
     *   subgrid — the leaf's tracks resolved to 1043.91px and 0px and every label to zero
     *     width, across five track spellings (minmax/auto/fit-content/1fr);
     *   display: contents — laid out correctly (695.482px and 348.432px, every label
     *     ending on 1473) and cost the row its own box, which 27 render assertions and the
     *     component's whole padding contract measure.
     * One number is cheaper than either.
     */
    #controlWidth = 0;

    /** Held so `disconnectedCallback` can undo it — a screen that leaks one subscription
     *  per leaf change is S10 wearing a settings screen. */
    #unwatch = null;

    constructor() {
        super();
        this.leafId = '';
        this.heading = '';
        this.eyebrow = '';
        this.model = null;
        this.liveFeed = null;
        this._version = 0;
        this._snapshot = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watch();
        this.#watchLive();
    }

    disconnectedCallback() {
        if (this.#frame) { cancelAnimationFrame(this.#frame); this.#frame = 0; }
        super.disconnectedCallback?.();
        this.#unwatch?.();
        this.#unwatch = null;
        this.#unfeed?.();
        this.#unfeed = null;
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('model')) this.#watch();
        if (changed.has('liveFeed')) this.#watchLive();
        if (changed.has('leafId') || changed.has('model')) this.#load();

        /* AND THE O1 MEASUREMENT, IN THE SAME HOOK. A class has one `updated`, so a second
         * declaration does not add to this one — it REPLACES it. That is how the leaf
         * briefly stopped calling #load() and #watch() at all: every machine page showed
         * its fallback values because nothing ever asked the machine.
         *
         * SYNCHRONOUS FIRST, AND ONE FRAME ONLY IF THAT READS NOTHING. A write on a later
         * frame moves the rows under anything measuring them on this one — which is what a
         * hit test does. The fallback is for the first paint, where a control is a
         * component that has not laid out and every box reads 0. */
        this.#measureControls();
        if (this.#controlWidth <= 0) {
            if (this.#frame) cancelAnimationFrame(this.#frame);
            this.#frame = requestAnimationFrame(() => {
                this.#frame = 0;
                this.#measureControls();
            });
        }
    }

    #watch() {
        this.#unwatch?.();
        this.#unwatch = null;
        if (!this.model || typeof this.model.subscribe !== 'function') return;
        this.#unwatch = this.model.subscribe((state) => { this._version = state.version; });
    }

    /** The live feed's unsubscribe, kept apart from the model's. */
    #unfeed = null;

    /**
     * Watch the machine snapshot, and REPAINT ONLY WHEN A SHOWN READING MOVES.
     *
     * The snapshot arrives at about 10 Hz during a shot. A settings page that re-rendered
     * on every frame would rebuild thirty rows a second to change one number, and would
     * fight the control-width measurement in `updated()` while doing it. So the frame is
     * kept, and `_snapshot` — the property the render reads — is only reassigned when a
     * channel this leaf actually shows has changed by a whole unit.
     *
     * WHOLE UNITS BECAUSE THAT IS WHAT IS PRINTED. Slate rounds its own live readings to
     * zero decimal places (`formatTemp(value, 0)`), so a change of 0.04 °C is a change
     * nobody can see and a render nobody asked for.
     */
    #watchLive() {
        this.#unfeed?.();
        this.#unfeed = null;
        const feed = this.liveFeed;
        if (!feed || typeof feed.subscribe !== 'function') return;
        this.#unfeed = feed.subscribe((state) => {
            const frame = state?.frame ?? null;
            if (this.#readingsMoved(frame)) this._snapshot = frame;
        });
    }

    /** True when a channel this leaf shows reads a different whole number. */
    #readingsMoved(frame) {
        const channels = (this.model?.rows?.(this.leafId) ?? [])
            .map((view) => view.live)
            .filter(Boolean);
        if (channels.length === 0) return false;
        const before = this._snapshot ?? null;
        return channels.some((channel) => {
            const was = Number(before?.[channel]);
            const now = Number(frame?.[channel]);
            if (!Number.isFinite(was) && !Number.isFinite(now)) return false;
            if (!Number.isFinite(was) || !Number.isFinite(now)) return true;
            return Math.round(was) !== Math.round(now);
        });
    }

    #load() {
        if (!this.model || !this.leafId) return;
        /* Fire and forget, deliberately: the load resolves into the model, the model
         * bumps its beacon and the beacon re-renders this element. Awaiting it here
         * would make `updated()` async for no gain and would swallow the rejection the
         * model has already logged. */
        Promise.resolve(this.model.load(this.leafId)).catch(() => {});
    }

    render() {
        const t = this.#i18n.t;
        const rows = this.model ? this.model.rows(this.leafId) : [];
        const note = this.model ? this.model.note(this.leafId) : null;

        const desc = leafDescription(this.leafId);
        const restorable = this.model?.restorableRows?.(this.leafId)?.length ?? 0;
        /* THE PAGE'S OWN ACTION, if it has one. A registry lookup, not a branch: a leaf
         * gains one by being named in `LEAF_ACTIONS`, and this element still knows nothing
         * about what any of them do. */
        const action = leafAction(this.leafId);
        return html`
            <!-- THE PAGE'S NAME, AND THE ONE ACTION THAT BELONGS TO THE PAGE RATHER THAN
                 TO A ROW. Ben, 26 August 2026 (O7): "we should have a button in on the
                 right above the horizontal dividing line that says 'restore defaults'."

                 IT IS ONLY RENDERED WHEN THERE IS SOMETHING TO RESTORE. The model answers
                 which of this leaf's rows have a decided default; a leaf with none — Machine
                 Info, the Help pages — gets no button rather than a disabled one. -->
            <div id="leaf-head-row">
                <div id="leaf-title-block">
                    ${this.eyebrow
                        ? html`<p id="leaf-eyebrow" class="ui-microcap">${t(this.eyebrow)}</p>`
                        : nothing}
                    <h2 id="leaf-heading" class="ui-title">${t(this.heading)}</h2>
                </div>
                ${action
                    ? html`<ui-button
                        id="leaf-action"
                        data-action=${action.action}
                        @click=${() => this.#pageAction(action)}
                        >${t(action.label)}</ui-button
                    >`
                    : nothing}
                ${restorable > 0
                    ? html`<ui-button
                        id="leaf-restore"
                        @click=${this.#onRestore}
                        >${t('Restore defaults')}</ui-button
                    >`
                    : nothing}
            </div>

            <!-- THE RULE, AND THE SENTENCE UNDER IT. Ben, 26 August 2026 — O5: "Add the
                 horizontal dividing line that Slate has below the page header on all
                 pages", and O6: "All pages below the new horizontal dividing line should
                 describe what the page does."

                 THE RULE IS ALWAYS DRAWN and the sentence is not. The rule separates the
                 page's name from its content and every page has both; a leaf whose
                 description has not been written shows no line rather than an empty one,
                 which is the same rule settings-leaf-copy.js states from the other end. -->
            <hr id="leaf-rule">
            ${desc ? html`<p id="leaf-desc" class="ui-body">${t(desc)}</p>` : nothing}
            ${note ? html`<p id="note" class="ui-caption">${t(note)}</p>` : nothing}
            ${rows.map((view) => this.#row(view))}
        `;
    }

    /**
     * ONE ROW SHAPE. Everything a leaf can say is a property of #29 — heading, hint,
     * caption, reading — and everything it can do is one control in the slot.
     */
    /**
     * Measure the widest control and publish it, once per render.
     *
     * READ FIRST, WRITE ONCE. Every control is measured before anything is written, so the
     * write cannot invalidate a later read — a cap applied mid-loop would shrink a label,
     * reflow the row and change the next control's box.
     *
     * NOTHING IS WRITTEN WHEN THE NUMBER HAS NOT MOVED, which is what stops the write from
     * feeding the next `updated()` and looping: the property only changes when a control's
     * own size changes, and a control's size does not depend on the cap.
     */
    #measureControls() {
        const rows = this.renderRoot?.querySelectorAll?.('ui-settings-row');
        if (!rows || rows.length === 0) return;
        let widest = 0;
        for (const row of rows) {
            const control = row.shadowRoot?.getElementById?.('control');
            /* offsetWidth, NOT getBoundingClientRect().width. This screen draws inside a
             * zoom, and a client rect is in SCALED pixels while a CSS length is not — the
             * cap would come out short by the zoom factor and every label would stop early.
             * offsetWidth is the element's own unscaled box, which is what the CSS calc
             * subtracts from. */
            const width = control?.offsetWidth ?? 0;
            if (width > widest) widest = width;
        }
        if (widest <= 0) return;
        if (Math.abs(widest - this.#controlWidth) < 0.5) return;
        this.#controlWidth = widest;
        this.style.setProperty('--_ui-leaf-control-w', `${widest}px`);
    }

    /**
     * The pending frame, so a leaf swapped out mid-frame does not measure a tree it has
     * left.
     */
    #frame = 0;

    /**
     * MEASURE ON THE NEXT FRAME, not in `updated()`. A row's shadow root exists by the
     * time this runs, but the control inside it is a component of its own and may not have
     * laid out yet — measured on the rig, the first pass reads 0 for every control. One
     * frame later every box is real.
     */

    /**
     * Put the page back to its decided defaults.
     *
     * NO CONFIRMATION, and that is deliberate. On a machine page every value this moves is
     * STAGED, so the band's count goes up and Cancel puts it all back — the undo is already
     * on screen and asking first would be asking about something reversible. The one page
     * where a restore is irreversible is Calibration's own "Default load settings", which
     * has its own button and its own confirm and is not this.
     */
    #onRestore = () => {
        Promise.resolve(this.model?.restoreDefaults?.(this.leafId)).catch(() => {});
    };

    #row(view) {
        const t = this.#i18n.t;
        return html`<ui-settings-row
            data-row=${view.id}
            data-archetype=${view.archetype}
            ?data-staged=${view.staged}
            heading=${t(view.heading)}
            hint=${view.hint}
            caption=${view.caption ? t(view.caption) : ''}
            note=${this.#note(view)}
            .reading=${this.#reading(view)}
            .readingFormat=${this.#readingFormat(view)}
        >${this.#control(view)}</ui-settings-row>`;
    }

    /**
     * WHAT THE ROW PRINTS ABOVE ITS CAPTION: a stored reading, a LIVE machine channel, or
     * nothing at all.
     *
     * THREE OUTCOMES AND THEY ARE #29'S, not three of this file's: unset renders no
     * element, an absence renders the dash, a value renders. So a row with no live channel
     * and no reading of its own is left exactly as it was, and a row whose channel the
     * machine is not reporting says so rather than printing a stale or zero figure —
     * which is Slate's own rule at `settings.js:1009-1014`, quoted in the registry.
     *
     * AN INERT ROW HAS NO LIVE READING. Its master switch is off, so the machine is not
     * heating and "now 22 °C" beside a dashed setpoint would read as a fault.
     */
    /** The formatter for whichever KIND of reading this row carries, or undefined. */
    #readingFormat(view) {
        const t = this.#i18n.t;
        if (view.live) return liveReadingFormat(t('now'), view.bounds?.unit ?? '');
        if (view.row.readingField) {
            return measuredReadingFormat(
                t(view.row.readingLabel ?? 'Measured'),
                view.row.readingUnit ?? '',
                this.#items(view),
                t('consistent with'),
            );
        }
        /* AND A READING ROW THAT DECLARES A UNIT SPELLS IT. Only a READING — a stepper
         * already prints its own unit inside the control, and a second one above it would
         * say the same thing twice. The absence case is untouched: `#reading` hands over
         * the empty string, #29 draws the dash, and no formatter is consulted. */
        if (view.archetype === ARCHETYPE.READING && view.bounds?.unit) {
            return unitReadingFormat(view.bounds.unit);
        }
        return undefined;
    }

    #reading(view) {
        if (!view.live) return view.reading;
        /* AND A ROW WHOSE SOURCE HAS NOT ANSWERED HAS NO READING EITHER (audit F-042):
         * "now 22 °C" beside a value nobody has read is two claims, not one. */
        if (view.inert || view.pending) return NO_READING;
        const value = Number(this._snapshot?.[view.live]);
        return Number.isFinite(value) && value > 0 ? value : NO_READING;
    }

    /**
     * THE SECOND CAPTION LINE, AND IT BELONGS TO AN OPTION RATHER THAN TO THE ROW.
     *
     * Slate's steam-stop block prints two captions: the row's own, and — whenever the
     * Milk Temp option is offered on a machine with no probe — "Requires the Bengle
     * milk temperature probe." ([i=71], settings.js:3307). The Decal rebuild kept the
     * option and dropped the note, undeclared (cmp-sm-1).
     *
     * The note is a property of the OPTION in the registry, so it is here exactly when
     * its option is: the same condition, read from the same array, with nothing to keep
     * in step. One join, in DOM order, so a second noted option would read as one
     * paragraph rather than appearing and disappearing by index.
     *
     * AND THE ROW MAY HAVE ONE OF ITS OWN SINCE 26 AUGUST 2026, which is why the list comes
     * from the model now rather than being read off `view.items` here. The pre-warm pair
     * needs a sentence that belongs to the ROW and appears only on a machine whose firmware
     * cannot pre-warm — a condition the model can evaluate and this element cannot. What
     * stays here is the TRANSLATION: every visible string goes through `t()` at render (D2),
     * and the model deals in keys.
     */
    #note(view) {
        const t = this.#i18n.t;
        return (view.notes ?? [])
            .map((note) => t(note))
            .join(' ');
    }

    /**
     * The five archetypes, one branch each, and no sixth branch that draws anything.
     *
     * THE ORDER OF THESE BRANCHES IS NOT A PRECEDENCE. A row declares exactly one
     * archetype and the registry is frozen, so this is a lookup written as a switch.
     */
    #control(view) {
        const t = this.#i18n.t;
        /**
         * TWO REASONS A CONTROL DRAWS NOTHING IT CAN STAND BEHIND, and they render the
         * same because A7's answer to both is the same (audit F-042, 29 August 2026).
         *
         * `inert` is a master switch being off — the machine holds a value and this row is
         * not live. `pending` is the row's SOURCE not having answered yet, which used to be
         * invisible: `settings-store.value()` hands back the shipped default when nothing
         * is cached, and a machine field falls through to `MACHINE_FALLBACKS`, so a first
         * paint drew a placeholder in exactly the shape of a reading. MEASURED:
         * `machine-water-tank-unit` showed mm on 7 of 9 immediate post-reload reads while
         * the router already held "ml", correcting at about 8 s; the cup warmer's pre-warm
         * switch read FALSE for about 4 s while the server held true.
         *
         * WHAT THE MODEL DECIDES AND WHAT THIS DECIDES. `view.pending` is the model's
         * answer to "has the source spoken?" — it reads `settings.isLoaded(key)` and
         * `machineLoaded`, both of which existed and neither of which anything asked. This
         * line is the only place the two states are joined, so a later reader can still
         * tell them apart at the model.
         *
         * A SWITCH WAS THE WEAK CASE AND IS NO LONGER ONE. A disabled switch still
         * announces checked or unchecked, so a pending switch asserted "off" to a screen
         * reader even while it refused input; `ui-switch` carries `role="switch"` and has
         * no third state. Round 1 left that standing and wrote it down; Ben ruled on it
         * (D08, 30 August 2026) and the SWITCH branch below now draws a skeleton while
         * `view.pending` rather than a control with a boolean on it. **So `off` no longer
         * reaches a switch by the pending route** — every other archetype still joins the
         * two here, because for them disabled-plus-a-dash asserts nothing.
         */
        const off = view.inert || view.pending;
        switch (view.archetype) {
            case ARCHETYPE.STEPPER:
                /* T9/T10 in one line: the control states its own size and nothing
                 * shrinks it. #4 is `flex: none` at its token width in its own sheet,
                 * so a cluster cannot overflow the track it is in. */
                /* EDITABLE, AND IT WAS NOT (Ben, 24 Aug 2026: "In all settings I cannot
                 * seem to open the number pad when chaning a spinners value, tapping the
                 * number should always open the number pad modal").
                 *
                 * #4's value cell is a real button ONLY when `editable` is set, and this
                 * branch never set it — so the number was plain text on all thirty-odd
                 * settings steppers while the Live rail's identical control opened the
                 * numpad. The stepper still opens nothing itself: it says "pressed" and
                 * stops, and the SCREEN owns the one keypad, exactly as the Live screen
                 * does. `data-row` rides on the event through `#onEdit` so the screen
                 * knows which row asked. */
                /* INERT IS DISABLED PLUS A DASH, and the dash is `format`, not a value.
                 *
                 * Ben, 26 August 2026, on the tank's preheat switch: "while it is off the
                 * settings below grey out and read '−'". Blanking the VALUE would be a
                 * lie of a different kind — the machine still holds a number and will use
                 * it the moment the master switch goes back on — so the value is left
                 * alone and only its rendering changes. `off` mutes the ink and drops the
                 * unit, which is #4's own state for exactly this ("OFF bar reads as a
                 * quantity in bar"). */
                /* THE FORMAT SLOT TAKES TWO ANSWERS AND INERT WINS. A converted
                 * temperature carries a formatter of its own so the Fahrenheit face keeps
                 * the Celsius step's decimal places (Ben, 26 Aug 2026: "rounding to same
                 * decimal place as the original value") — 322, not 321.8, on a band that
                 * steps by a whole degree. Both formatters are memoised by the layer that
                 * built them, because lit compares properties by identity. */
                /* AND IT ANNOUNCES THE BAND THE ROW PRINTS — the SAME string, not a second
                 * spelling of it (audit F-047). #4 derives "Range {min} to {max}" from the
                 * two numbers it is handed, which is true of the numbers and false of the
                 * band on the one row whose band has a hole: `steamTemp`'s `min` is 0
                 * because zero is how the machine is told "no steam", so the row printed
                 * "135–170 °C" while the stepper announced "Range 0 to 170 °C". `view.hint`
                 * is `bandHint`'s answer — the one composer — and #29 above is already
                 * drawing it, so handing the same string down leaves nothing to drift. */
                return html`<ui-stepper
                    data-row=${view.id}
                    editable
                    hint=${view.hint}
                    ?disabled=${off}
                    ?off=${off}
                    .format=${off ? INERT_VALUE : (view.bounds.format ?? undefined)}
                    .value=${view.value}
                    .min=${view.bounds.min}
                    .max=${view.bounds.max}
                    .step=${view.bounds.step}
                    unit=${view.bounds.unit}
                    .next=${view.bounds.next}
                    @change=${(event) => this.#write(view, event.detail?.value)}
                    @edit=${() => this.#edit(view)}
                ></ui-stepper>`;

            case ARCHETYPE.SWITCH:
                /* A PENDING SWITCH IS NOT A SWITCH AT ALL, AND THAT IS THE WHOLE FIX
                 * (audit F-042's weak case; Ben's decision D08, 30 August 2026).
                 *
                 * Round 1 painted every pending control disabled and dashed, and said out
                 * loud that this archetype was the one it could not make honest: "a
                 * disabled `ui-switch` still announces checked/unchecked, so a pending
                 * switch asserts 'off' to a screen reader even while it refuses input".
                 * MEASURED then: the cup warmer's pre-warm switch read FALSE for about
                 * four seconds after a reload while the server held TRUE. Ben's ruling —
                 * "a switch whose source has not answered renders as a skeleton/inert
                 * row, never a false 'off'; a screen reader must not hear 'off' while
                 * pending".
                 *
                 * `PENDING` ONLY, NEVER `INERT`, AND THE TWO ARE NOT INTERCHANGEABLE HERE
                 * even though the line below joins them for every other archetype. Inert
                 * is a master switch being off: the machine HOLDS a value, the row knows
                 * it, and drawing that value disabled is true. Pending is nobody knowing.
                 * A dash is the honest face of the first and a placeholder is the honest
                 * face of the second, which is why this branch reads `view.pending` and
                 * the seven below read `off`.
                 *
                 * NO TRI-STATE ON #5, AND THE ARIA IS WHY. `aria-checked="mixed"` is
                 * defined for `role="checkbox"` and NOT for `role="switch"` (ARIA 1.2 —
                 * switch takes true/false and nothing else), so a third state on the
                 * component would be an invalid value that assistive technology is free
                 * to read as false: the same lie with more code behind it. The element
                 * that must not assert is simply not rendered.
                 *
                 * THE SKELETON IS #5's, NOT THIS FILE'S, AND A TEST MOVED IT THERE. The
                 * first version of this fix drew the placeholder here — a span sized
                 * --ui-switch-track-w by --ui-switch-track-h so the row would not jump
                 * when the answer landed. `test/settings-leaves.test.mjs` refused it:
                 * "no switch geometry anywhere in the cluster (T17)", which is bug T17
                 * itself ("twenty hardcoded copies of the switch geometry") stated as a
                 * rule this file cannot break. It is right, and the rule is not being
                 * relaxed: #5 owns its box, so #5 draws the state where its box already
                 * is. What is left here is the DECISION and the SENTENCE.
                 *
                 * WHAT IS RENDERED IS NOT NAMED BY THE ROW EITHER, and that falls out of
                 * #29's own rules rather than needing a new one. A pending #5 drops its
                 * `role`, and `ui-settings-row`'s rule 3 is stated as a guard — "never
                 * name a role-less generic", `isNameable` returning false for a custom
                 * element with no `role` attribute — so `#applyNames` skips it and the
                 * heading stays the row's.
                 *
                 * THE SENTENCE IS A KEY THE CATALOGUE ALREADY HELD, and reusing it was
                 * the right call rather than the lazy one: `Not known` is authored with
                 * the note "the status chip for a machine that has not answered", which
                 * is this state exactly, one screen over. A second near-synonym ("Not yet
                 * loaded", "Waiting for the machine") would be two translation units for
                 * one fact, and the pair drifts on the first language after English.
                 * `i18n/source/strings.json`'s note now names both call sites.
                 *
                 * AND IT IS TRANSLATED HERE, which is why #5 takes it as a property
                 * rather than authoring it: D2 is "every visible string goes through
                 * `t()` at render", and a component that reached for the catalogue would
                 * be the second place a leaf's words come from. */
                if (view.pending) {
                    return html`<ui-switch
                        pending
                        pending-label=${t('Not known')}
                    ></ui-switch>`;
                }
                /* NAMED BY THE ROW. #5 has no `label` property and carries role=switch,
                 * so #29's rule 2 puts the heading on it as `aria-label` — T15's "four
                 * of twenty switches have no accessible name", closed by construction. */
                return html`<ui-switch
                    ?checked=${view.checked}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, event.detail?.checked)}
                ></ui-switch>`;

            case ARCHETYPE.SLIDER:
                /* THE BOUNDS ARE THE ROW'S, NOT THE COMPONENT'S. `ui-slider` defaults to
                 * 0-100 and a brightness that can reach 0 is a screen that goes dark by
                 * accident, which is why `screenBrightness` declares min 10. Reading them
                 * from `view.bounds` keeps the one table in `machine-limits.js` the only
                 * place a bound is stated.
                 *
                 * NAMED BY THE ROW, as #5 is: `ui-slider` carries its own `label`, so the
                 * heading is handed to it rather than left to a wrapper. */
                return html`<ui-slider
                    .min=${view.bounds?.min ?? 0}
                    .max=${view.bounds?.max ?? 100}
                    step=${String(view.bounds?.step ?? 1)}
                    .value=${Number(view.value)}
                    ?disabled=${off}
                    label=${t(view.heading)}
                    value-text=${`${view.value}${view.bounds?.unit ?? ''}`}
                    @change=${(event) => this.#write(view, Number(event.target?.value))}
                ></ui-slider>`;

            case ARCHETYPE.BANK:
                /* THE SAME ROUND TRIP #7 MAKES, AND FOR THE SAME REASON — see `#choose`.
                 *
                 * IT WAS NOT HERE UNTIL 24 AUG 2026 AND NOTHING HAD NOTICED, because
                 * every bank row's values were STRINGS ('mm' / 'ml', 'off' / 'time' /
                 * 'milk-temp') and a string that survives a DOM attribute round trip is
                 * the same string. The refill-kit and mains-voltage rows are the first
                 * banks whose values are NUMBERS, and the defect showed up on the wire
                 * the first time the app was driven against a machine:
                 *
                 *   POST /machine/settings/advanced  {"refillKitSetting":"2"}
                 *
                 * A quoted 2 where the handler reads an int. It happens to survive —
                 * `parseInt` in ReaPrime ends in Dart's `int.parse`, which takes the
                 * string — and that is exactly what makes it the dangerous kind: it works
                 * until a handler somewhere tests `value is int`, which `POST
                 * /api/v1/settings` does for both night-mode times. */
                return html`<ui-bank
                    .items=${this.#items(view)}
                    value=${off ? '' : (view.value ?? '')}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, this.#choose(view, event.detail?.value))}
                ></ui-bank>`;

            case ARCHETYPE.SELECT:
                /* THE BRANCH THAT USED TO BE A NOTE SAYING WHY THERE WAS NO BRANCH.
                 *
                 * It said: "#7 stays in the vocabulary because it is one of Part 5 §4's
                 * five and because the day a long choice lands it is the control for
                 * it. Every live choice in the registry is two to four options, which is
                 * the bank's job." The day arrived with cmp-sm-1: Slate renders steam
                 * purge mode as a <select> (settings.js:3392, .slate-select w-[200px],
                 * measured 214x64 at [i=81]) and the registry now declares one SELECT
                 * row. T7's law is unchanged and still enforced from both directions by
                 * `test/settings-leaves.test.mjs` — every archetype a row uses has a
                 * branch, and every branch is used by a row. A branch nothing dispatches
                 * to would still be the defect; this one is dispatched to.
                 *
                 * THE VALUE COMES BACK AS A STRING, ALWAYS. A DOM <option> holds text,
                 * so #7 normalises every value with String() and announces what the
                 * control holds. `steamPurgeMode` is a NUMBER on the wire (0 Normal,
                 * 1 Two Tap Stop), and posting "0" where the handler reads an int is a
                 * silent type change at the one boundary nobody photographs. So the
                 * write maps the announced string back through the registry's own items
                 * and sends the item's value — the row's list is the only authority on
                 * what type its choices are. */
                return html`<ui-select
                    .options=${this.#items(view)}
                    value=${String(view.value ?? '')}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, this.#choose(view, event.detail?.value))}
                ></ui-select>`;

            case ARCHETYPE.BUTTON:
                /* RULE 0 KEEPS ITS OWN NAME. A button whose visible text is "Leave" is
                 * operable by voice as "Leave"; handing it the row's heading would make
                 * the spoken name differ from the printed one. */
                return html`<ui-button
                    @click=${() => this.#act(view)}
                >${t(view.row.control ?? view.heading)}</ui-button>`;

            case ARCHETYPE.TEXT:
                /* `hide-label` — ONE WORD, AND IT CLOSES TWO DEFECTS AT ONCE.
                 *
                 * THE VISIBLE ONE: the row printed its heading twice. #29 auto-names a
                 * slotted control, and its rule 1 is "a ui-* control with its own `label`
                 * property" gets the heading written onto that property
                 * (`ui-settings-row.js`). #4 then DRAWS any label it is given, because
                 * `showLabel = Boolean(this.label) && !this.hideLabel`. Measured on the
                 * bench: row heading "ReaPrime address", field label property "ReaPrime
                 * address", inner <label> text "ReaPrime address". Neither component is
                 * wrong on its own; the duplication only exists between them.
                 *
                 * THE INVISIBLE ONE, WHICH IS THE WORSE OF THE TWO: the input had NO
                 * ACCESSIBLE NAME AT ALL. #4 sets `aria-label` only when it is NOT drawing
                 * a visible label — a name in two places is a name announced twice — so a
                 * drawn label that the row had written suppressed the aria-label and the
                 * measured `aria-label` on the input was null. The heading is a sibling
                 * <span>, not a <label for>, so nothing named the field.
                 *
                 * #4 ALREADY DOCUMENTS THIS AS THE INTENDED RESOLUTION, at its E14 note:
                 * "with `hide-label` the name survives as `aria-label`". This is that
                 * sentence taken up.
                 *
                 * ONE ROW USES THIS BRANCH — `connection-machine-host` is the only
                 * ARCHETYPE.TEXT row in the registry — so the blast radius is one field,
                 * and `test/render/settings-leaves.render.test.mjs` pins both halves. */
                return html`<ui-text-field
                    hide-label
                    .value=${view.value ?? ''}
                    @change=${(event) => this.#write(view, event.target?.value)}
                ></ui-text-field>`;

            /* READING — no control at all, which is a shipped state of #29 rather than
             * a missing one: the row renders its heading, its caption and its reading,
             * and the slot stays empty. */
            default:
                return nothing;
        }
    }

    /**
     * Bank/select choices, translated at render (D2) and never mutated.
     *
     * `disabled` RIDES ALONG, AND IT WAS BEING DROPPED. `ui-bank` has normalised and painted
     * a per-item `disabled` since it was built — `normaliseItem` reads it, the base dial
     * dims it, and `:host([disabled]) .item:disabled` even stops the two opacities
     * compounding — and this join rebuilt each item as `{value, label}` alone, so nothing
     * ever reached it. The consequence was a page offering choices the machine cannot
     * honour: Milk Temp on a machine with no probe, Weight with no scale connected, both
     * ungreyed and both selectable. The model decides WHICH are disabled (one verdict
     * function, fail-closed on UNKNOWN as well as ABSENT); this only carries the answer.
     */
    #items(view) {
        const t = this.#i18n.t;
        return (view.items ?? []).map((item) => (item.disabled
            ? { value: item.value, label: t(item.label), disabled: true }
            : { value: item.value, label: t(item.label) }));
    }

    /**
     * The registry value an announced string names.
     *
     * #3 AND #7 BOTH SPEAK DOM STRINGS — a bank cell's value rides on an attribute and an
     * <option> holds text — and the REGISTRY owns the type, so the round trip ends here
     * rather than at the store. `steamPurgeMode` and `refillKitSetting` are NUMBERS on
     * the wire, and posting "0" where the handler reads an int is a silent type change at
     * the one boundary nobody photographs.
     *
     * An unrecognised string is returned untouched: swallowing it would write nothing and
     * report success, which is the silent-revert class B7 exists to stop.
     */
    #choose(view, announced) {
        const item = (view.items ?? []).find((choice) => String(choice.value) === String(announced));
        return item ? item.value : announced;
    }

    /**
     * Every write goes to the model, which decides route-or-stage from the ROW.
     *
     * AND THEN IT IS ANNOUNCED — composed and bubbling, carrying the row id and the
     * value, once the write has actually happened. One row in the registry has an effect
     * that is not storage (C6's display size moves the tokens), and this is how the
     * screen hears about it without this element knowing what a token is. `ok` rides
     * along so a listener can tell a stored change from a refused one.
     */
    #write(view, value) {
        if (value === undefined || !this.model) return;
        Promise.resolve(this.model.set(view.row, value))
            .then((result) => {
                this.dispatchEvent(new CustomEvent('leaf-change', {
                    detail: { row: view.id, value, ok: result?.ok !== false, staged: Boolean(result?.staged) },
                    bubbles: true,
                    composed: true,
                }));
            })
            .catch(() => {});
    }

    /**
     * A STEPPER'S NUMBER WAS PRESSED. Relayed to the screen with the row it belongs to.
     *
     * #4 reports the press and stops — "a component that opened its own overlay would be
     * reaching outside its own tree" — and this element is no different: the keypad is
     * #53's, the dialog is #18's, and the SCREEN is where one instance serves every row.
     * What is added here is the row IDENTITY, which the stepper has no business knowing
     * and the screen cannot work without.
     */
    #edit(view) {
        this.dispatchEvent(new CustomEvent('leaf-edit', {
            detail: { row: view.id, leaf: this.leafId, value: view.value },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * An action row asks the SCREEN to do something. The event is composed and bubbles,
     * so it leaves this shadow root and the screen listens once; nothing here navigates,
     * opens a dialog or touches a route.
     */
    #act(view) {
        this.dispatchEvent(new CustomEvent('leaf-action', {
            detail: { action: view.row.action, row: view.id, leaf: this.leafId },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * The PAGE's action, announced the same way a row's is.
     *
     * ONE EVENT FOR BOTH, deliberately: the screen already listens for `leaf-action` and
     * branches on the action name, so a page action and a row action are the same kind of
     * message with different senders. `row` is null, which is what says it belongs to the
     * page rather than to a control.
     */
    #pageAction(action) {
        this.dispatchEvent(new CustomEvent('leaf-action', {
            detail: { action: action.action, row: null, leaf: this.leafId },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('settings-leaf', SettingsLeaf);
